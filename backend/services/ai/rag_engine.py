"""
RAG知识库引擎
提供文档检索、向量化存储和知识增强功能
"""

import json
import asyncio
import hashlib
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import logging
import threading
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import numpy as np
import jieba
import re
import os
import chromadb
from chromadb.config import Settings as ChromaSettings

from config.settings import settings
from models.database_models import KnowledgeDocument

logger = logging.getLogger(__name__)
Base = declarative_base()

@dataclass
class DocumentChunk:
    """文档片段"""
    id: str
    content: str
    metadata: Dict[str, Any]
    embedding: Optional[np.ndarray] = None
    source: str = ""
    chunk_index: int = 0

    chunk_index: int = 0

class RAGEngine:
    """RAG知识库引擎"""
    
    def __init__(self):
        # 预加载jieba分词
        import jieba
        jieba.initialize()
        # 测试分词以确保初始化完成
        jieba.lcut("测试")
        
        self.engine = create_engine(
            settings.database_url,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout,
            pool_recycle=settings.db_pool_recycle,
            pool_pre_ping=settings.db_pool_pre_ping,
            connect_args={"connect_timeout": settings.db_pool_timeout}
        )
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.document_cache = {}
        self._ensure_metadata_column()
        
        # 初始化 ChromaDB 客户端
        chroma_persist_dir = getattr(settings, 'CHROMA_PERSIST_DIR', '.chroma')
        os.makedirs(chroma_persist_dir, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(path=chroma_persist_dir)
        # 获取或创建集合 (知识库集合)
        self.collection = self.chroma_client.get_or_create_collection(
            name="knowledge_base",
            metadata={"hnsw:space": "cosine"} # 使用余弦相似度
        )
        
        logger.info("RAG引擎初始化完成 (已成功挂载 ChromaDB)")

    def _ensure_metadata_column(self) -> None:
        """确保知识文档表包含 doc_metadata 列"""
        try:
            with self.engine.connect() as conn:
                result = conn.execute(
                    text(
                        "SELECT COUNT(*) FROM information_schema.COLUMNS "
                        "WHERE TABLE_SCHEMA = DATABASE() "
                        "AND TABLE_NAME = 'knowledge_documents' "
                        "AND COLUMN_NAME = 'doc_metadata'"
                    )
                ).scalar()
                if result == 0:
                    conn.execute(
                        text("ALTER TABLE knowledge_documents ADD COLUMN doc_metadata LONGTEXT")
                    )
                    conn.commit()
                    logger.info("已补齐 knowledge_documents.doc_metadata 列")
        except Exception as e:
            logger.error(f"检查/补齐 doc_metadata 列失败: {e}")
        
    def _preprocess_text(self, text: str) -> str:
        """文本预处理"""
        # 清理HTML标签
        text = re.sub(r'<[^>]+>', '', text)
        # 清理特殊字符
        text = re.sub(r'[^\w\s\u4e00-\u9fff]', ' ', text)
        # 中文分词
        words = jieba.lcut(text)
        # 过滤停用词和短词
        words = [word.strip() for word in words if len(word.strip()) > 1]
        return ' '.join(words)
    
    def _chunk_document(self, content: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """按Markdown层级与长度进行高级切分"""
        if len(content) <= chunk_size:
            return [content.strip()]
            
        chunks = []
        # 以Markdown标题进行粗切分 (H1-H4)
        sections = re.split(r'\n(?=#{1,4}\s)', content)
        
        current_chunk = ""
        for sec in sections:
            sec = sec.strip()
            if not sec: continue
            
            # 如果当前块 + 新段落 < 限制，直接合并
            if len(current_chunk) + len(sec) < chunk_size + overlap:
                current_chunk = current_chunk + "\n\n" + sec if current_chunk else sec
            else:
                # current_chunk已比较饱满，归档旧的
                if current_chunk:
                    chunks.append(current_chunk.strip())
                
                # 处理超长新段落
                if len(sec) >= chunk_size:
                    start = 0
                    while start < len(sec):
                        end = start + chunk_size
                        # 努力在换行符/句号处切分
                        if end < len(sec):
                            for sep in ['\n\n', '\n', '。', '！', '？', '.', '!', '?']:
                                pos = sec.rfind(sep, start, end)
                                if pos > start + (chunk_size // 2):
                                    end = pos + 1
                                    break
                        chunks.append(sec[start:end].strip())
                        start = end - overlap if end < len(sec) else len(sec)
                    current_chunk = ""
                else:
                    current_chunk = sec
                    
        if current_chunk:
            chunks.append(current_chunk.strip())
            
        return [c for c in chunks if c]
    
    def _generate_doc_id(self, title: str, content: str) -> str:
        """生成文档ID"""
        content_hash = hashlib.md5(f"{title}{content}".encode()).hexdigest()
        return f"doc_{content_hash[:16]}"
    
    async def add_document(
        self, 
        title: str, 
        content: str, 
        source: str = "",
        category: str = "general",
        metadata: Dict[str, Any] = None
    ) -> str:
        """添加文档到知识库并构建向量"""
        doc_id = await asyncio.to_thread(
            self._add_document_sync, title, content, source, category, metadata
        )
        
        # 异步构建基于真实大模型 Embedding 的向量任务
        asyncio.create_task(self._build_embeddings_for_doc_async(doc_id, content))
        
        return doc_id

    def _add_document_sync(
        self,
        title: str,
        content: str,
        source: str = "",
        category: str = "general",
        metadata: Dict[str, Any] = None
    ) -> str:
        """添加文档到知识库（同步，仅入库）"""
        try:
            doc_id = self._generate_doc_id(title, content)
            metadata = metadata or {}
            
            # 检查文档是否已存在
            with self.SessionLocal() as session:
                existing_doc = session.query(KnowledgeDocument).filter(
                    KnowledgeDocument.doc_id == doc_id
                ).first()
                
                if existing_doc:
                    logger.info(f"文档已存在: {doc_id}")
                    return doc_id
                
                # 创建文档记录
                doc = KnowledgeDocument(
                    doc_id=doc_id,
                    title=title,
                    content=content,
                    source=source,
                    category=category,
                    doc_metadata=json.dumps(metadata, ensure_ascii=False)
                )
                session.add(doc)
                session.commit()
            
            logger.info(f"成功添加文档: {title} (ID: {doc_id})")
            return doc_id
            
        except Exception as e:
            logger.error(f"添加文档失败: {e}")
            raise

    async def _build_embeddings_for_doc_async(self, doc_id: str, content: str) -> None:
        """为单个文档异步构建基于LLM的Embedding"""
        try:
            from services.ai.llm_client import llm_client
            # Fetch default provider from db config
            db_settings = {}
            with self.SessionLocal() as db:
                from models.database_models import SystemSetting
                records = db.query(SystemSetting).filter(SystemSetting.category == 'llm').all()
                for rec in records:
                    db_settings[rec.setting_key] = rec.setting_value
            
            provider = "glm"
            if db_settings.get("OPENAI_API_KEY"): provider = "openai"
            elif db_settings.get("GLM_API_KEY"): provider = "glm"
            elif db_settings.get("TONGYI_API_KEY"): provider = "tongyi"

            chunks = self._chunk_document(content)
            
            # 删除此文档在 Chroma 里的旧 chunks
            try:
                self.collection.delete(
                    where={"doc_id": doc_id}
                )
            except Exception as e:
                logger.warning(f"从 ChromaDB 删除旧 chunk 失败: {e}")

            # 收集用于批量存入的列表
            chunk_ids = []
            chunk_embeddings = []
            chunk_texts = []
            chunk_metadatas = []
            
            for i, chunk_text in enumerate(chunks):
                # Request Embedding (llm_client 内部已做 fallback)
                response = await llm_client.create_embedding(text=chunk_text, provider=provider)
                
                if response.get("success"):
                    embedding_vector = response["embedding"]
                    # 只有成功生成了 embedding 时，才计入存入列表
                    chunk_id = f"{doc_id}_chunk_{i}"
                    chunk_ids.append(chunk_id)
                    chunk_embeddings.append(embedding_vector)
                    chunk_texts.append(chunk_text)
                    chunk_metadatas.append({
                        "doc_id": doc_id,
                        "chunk_index": i
                    })
                else:
                    logger.error(f"构建Embedding失败(chunk {i}): {response.get('error')}")
                    
            # 批量写入 ChromaDB
            if chunk_ids:
                self.collection.add(
                    ids=chunk_ids,
                    embeddings=chunk_embeddings,
                    documents=chunk_texts,
                    metadatas=chunk_metadatas
                )
            
            logger.info(f"增量构建Embedding成功: {doc_id}, 共存入 ChromaDB {len(chunk_ids)} 块")
        except Exception as e:
            logger.error(f"异步构建结构化知识库向量失败: {e}", exc_info=True)
    
    async def search(
        self, 
        query: str, 
        top_k: int = 5, 
        category: str = None
    ) -> List[Dict[str, Any]]:
        """搜索相关文档(升级版基于稠密向量)"""
        try:
            from services.ai.llm_client import llm_client
            # Fetch default provider from db config
            db_settings = {}
            with self.SessionLocal() as db:
                from models.database_models import SystemSetting
                records = db.query(SystemSetting).filter(SystemSetting.category == 'llm').all()
                for rec in records:
                    db_settings[rec.setting_key] = rec.setting_value
            
            provider = "glm"
            if db_settings.get("OPENAI_API_KEY"): provider = "openai"
            elif db_settings.get("GLM_API_KEY"): provider = "glm"
            elif db_settings.get("TONGYI_API_KEY"): provider = "tongyi"

            # 生成查询向量
            response = await llm_client.create_embedding(text=query, provider=provider)
            if not response.get("success"):
                logger.error("检索查询向量生成失败，无法基于语义搜索")
                return []
                
            query_vector = np.array(response["embedding"])
            
            # 获取所有相关文档元数据以便验证
            with self.SessionLocal() as session:
                doc_query = session.query(KnowledgeDocument)
                if category:
                    doc_query = doc_query.filter(KnowledgeDocument.category == category)
                
                valid_docs = doc_query.all()
                valid_doc_map = {d.doc_id: d for d in valid_docs}
                
                if not valid_doc_map:
                    return []
            
            # 使用 ChromaDB 进行查询
            query_filter = None
            # 如果没有特别指定分类，可以不传 filter。但由于我们的 schema category 在 MySQL 中，
            # 这里 Chroma 返回结果后再根据 valid_doc_map 进行过滤，这是一种联表策略。
            
            chroma_results = self.collection.query(
                query_embeddings=[query_vector],
                n_results=top_k * 3  # 多取一些，方便业务端结合分类/权限进行过滤
            )
            
            if not chroma_results['ids'] or not chroma_results['ids'][0]:
                return []
                
            results = []
            
            distances = chroma_results['distances'][0]
            metadatas = chroma_results['metadatas'][0]
            documents = chroma_results['documents'][0]
            
            # ChromaDB 余弦距离: 越小表示越相似 (Distance = 1 - Cosine Similarity)
            for i in range(len(chroma_results['ids'][0])):
                meta = metadatas[i]
                doc_id = meta.get("doc_id")
                
                if doc_id in valid_doc_map:
                    # 转换距离为相似度
                    similarity = 1.0 - distances[i] if distances[i] is not None else 0.0
                    results.append({
                        'doc_id': doc_id,
                        'chunk_index': meta.get('chunk_index', 0),
                        'content': documents[i],
                        'similarity': float(similarity)
                    })
            
            # 因为取余弦相似度所以降序排列
            results.sort(key=lambda x: x['similarity'], reverse=True)
            top_results = results[:top_k]
            
            final_results = []
            for result in top_results:
                doc = valid_doc_map.get(result['doc_id'])
                if doc:
                    final_results.append({
                        'doc_id': result['doc_id'],
                        'title': doc.title,
                        'content': result['content'],
                        'source': doc.source,
                        'category': doc.category,
                        'metadata': json.loads(doc.doc_metadata) if doc.doc_metadata else {},
                        'similarity': result['similarity']
                    })
            
            return final_results
                
        except Exception as e:
            logger.error(f"知识库检索失败: {e}", exc_info=True)
            return []
    
    async def get_context_for_query(self, query: str, max_context_length: int = 2000) -> str:
        """为查询获取上下文"""
        search_results = await self.search(query, top_k=3)
        
        context_parts = []
        current_length = 0
        
        for result in search_results:
            content = result['content']
            if current_length + len(content) <= max_context_length:
                context_parts.append(f"【{result['title']}】\n{content}")
                current_length += len(content)
            else:
                # 截断内容
                remaining_length = max_context_length - current_length
                if remaining_length > 100:  # 至少保留100字符
                    truncated_content = content[:remaining_length] + "..."
                    context_parts.append(f"【{result['title']}】\n{truncated_content}")
                break
        
        return "\n\n".join(context_parts)
    
    def get_categories(self) -> List[str]:
        """获取所有文档分类"""
        try:
            with self.SessionLocal() as session:
                categories = session.query(KnowledgeDocument.category).distinct().all()
                return [cat[0] for cat in categories]
        except Exception as e:
            logger.error(f"获取分类失败: {e}")
            return []
    
    def get_document_count(self) -> int:
        """获取文档总数"""
        try:
            with self.SessionLocal() as session:
                return session.query(KnowledgeDocument).count()
        except Exception as e:
            logger.error(f"获取文档数量失败: {e}")
            return 0

    def get_all_documents(self) -> List[Dict[str, Any]]:
        """获取所有知识库文档"""
        try:
            with self.SessionLocal() as session:
                documents = session.query(KnowledgeDocument).order_by(
                    KnowledgeDocument.updated_at.desc()
                ).all()
                return [
                    {
                        'id': doc.id,
                        'doc_id': doc.doc_id,
                        'title': doc.title,
                        'content': doc.content,
                        'source': doc.source,
                        'category': doc.category,
                        'metadata': json.loads(doc.doc_metadata) if doc.doc_metadata else {},
                        'created_at': doc.created_at.isoformat() if doc.created_at else None,
                        'updated_at': doc.updated_at.isoformat() if doc.updated_at else None
                    }
                    for doc in documents
                ]
        except Exception as e:
            logger.error(f"获取知识文档失败: {e}")
            return []

    def delete_document(self, document_id: int) -> Dict[str, Any]:
        """删除知识库文档"""
        try:
            with self.SessionLocal() as session:
                doc = session.query(KnowledgeDocument).filter(
                    KnowledgeDocument.id == document_id
                ).first()
                if not doc:
                    return {'success': False, 'error': '文档不存在'}

                doc_id = doc.doc_id
                
                # 同步删除 ChromaDB 中的向量块
                try:
                    self.collection.delete(
                        where={"doc_id": doc_id}
                    )
                except Exception as ce:
                    logger.warning(f"同步删除 ChromaDB 数据失败: {ce}")
                    
                session.delete(doc)
                session.commit()

                return {'success': True, 'doc_id': doc_id}
        except Exception as e:
            logger.error(f"删除文档失败: {e}")
            return {'success': False, 'error': str(e)}

    def update_document_links(
        self,
        document_id: int,
        requirement_ids: List[int] = None,
        testcase_ids: List[int] = None
    ) -> Dict[str, Any]:
        """更新知识文档关联"""
        try:
            with self.SessionLocal() as session:
                doc = session.query(KnowledgeDocument).filter(
                    KnowledgeDocument.id == document_id
                ).first()
                if not doc:
                    return {'success': False, 'error': '文档不存在'}

                metadata = json.loads(doc.doc_metadata) if doc.doc_metadata else {}
                metadata['linked_requirements'] = requirement_ids or []
                metadata['linked_testcases'] = testcase_ids or []
                doc.doc_metadata = json.dumps(metadata, ensure_ascii=False)
                session.commit()

                return {
                    'success': True,
                    'document_id': document_id,
                    'linked_requirements': metadata['linked_requirements'],
                    'linked_testcases': metadata['linked_testcases']
                }
        except Exception as e:
            logger.error(f"更新文档关联失败: {e}")
            return {'success': False, 'error': str(e)}

# 全局实例
rag_engine = RAGEngine()
