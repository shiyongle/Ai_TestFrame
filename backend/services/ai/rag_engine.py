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
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import jieba
import re

from config.settings import settings
from models.database_models import KnowledgeDocument, DocumentEmbedding

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
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words=None,
            ngram_range=(1, 2)
        )
        self._fit_vectorizer = False
        self._vectorizer_lock = threading.Lock()
        self.document_cache = {}
        self._ensure_metadata_column()
        logger.info("RAG引擎初始化完成")

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
        """文档分块"""
        if len(content) <= chunk_size:
            return [content]
        
        chunks = []
        start = 0
        
        while start < len(content):
            end = start + chunk_size
            if end >= len(content):
                chunks.append(content[start:])
                break
            
            # 尝试在句号、换行符等处分割
            split_pos = end
            for sep in ['\n\n', '\n', '。', '！', '？', '.', '!', '?']:
                pos = content.rfind(sep, start, end)
                if pos > start:
                    split_pos = pos + 1
                    break
            
            chunks.append(content[start:split_pos])
            start = split_pos - overlap if split_pos > overlap else 0
        
        return [chunk.strip() for chunk in chunks if chunk.strip()]
    
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
        
        # 在独立的线程池中构建向量，因为外层API已经接入了FastAPI的BackgroundTasks，
        # 所以这里的 await 不会阻塞用户的HTTP响应时间，且能保证任务绝对执行完毕。
        await asyncio.to_thread(self._build_embeddings_for_doc_sync, doc_id, content)
        
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
    
    def _update_vectorizer_sync(self, new_texts=None, new_chunk_ids=None):
        """更新向量化器 - 支持增量更新（同步）"""
        try:
            with self._vectorizer_lock:
                with self.SessionLocal() as session:
                    # 如果是新文档，只处理新添加的文档块
                    if new_texts and new_chunk_ids:
                        texts = new_texts
                        chunk_ids = new_chunk_ids
                    else:
                        # 获取所有没有向量的文档块（兼容旧逻辑）
                        chunks = session.query(DocumentEmbedding).filter(
                            DocumentEmbedding.embedding == ""
                        ).all()
                        texts = [self._preprocess_text(chunk.chunk_content) for chunk in chunks]
                        chunk_ids = [chunk.id for chunk in chunks]
                    
                    if not texts:
                        return
                    
                    # 如果向量化器未训练，需要先训练
                    if not self._fit_vectorizer:
                        # 获取所有已有文档块进行训练
                        all_chunks = session.query(DocumentEmbedding).all()
                        all_texts = [self._preprocess_text(chunk.chunk_content) for chunk in all_chunks]
                        if all_texts:
                            self.vectorizer.fit(all_texts)
                            self._fit_vectorizer = True
                            logger.info(f"向量化器训练完成，使用 {len(all_texts)} 个文档块")
                            
                            # 重新训练后，需要更新所有文档块的向量
                            all_embeddings = self.vectorizer.transform(all_texts).toarray()
                            for i, chunk in enumerate(all_chunks):
                                session.query(DocumentEmbedding).filter(
                                    DocumentEmbedding.id == chunk.id
                                ).update({
                                    DocumentEmbedding.embedding: json.dumps(all_embeddings[i].tolist())
                                })
                            session.commit()
                            logger.info(f"已更新所有 {len(all_chunks)} 个文档块的向量")
                            return
                    
                    # 计算新文档块的向量
                    embeddings = self.vectorizer.transform(texts).toarray()
                    
                    # 批量更新向量
                    for chunk_id, embedding in zip(chunk_ids, embeddings):
                        session.query(DocumentEmbedding).filter(
                            DocumentEmbedding.id == chunk_id
                        ).update({
                            DocumentEmbedding.embedding: json.dumps(embedding.tolist())
                        })
                    
                    session.commit()
                    logger.info(f"成功更新 {len(texts)} 个文档块的向量")
                
        except Exception as e:
            logger.error(f"更新向量化器失败: {e}")
            raise

    async def _update_vectorizer(self, new_texts=None, new_chunk_ids=None):
        """更新向量化器 - 支持增量更新（异步封装）"""
        await asyncio.to_thread(self._update_vectorizer_sync, new_texts, new_chunk_ids)

    async def _schedule_vectorizer_update(self, new_texts=None, new_chunk_ids=None) -> None:
        """后台更新向量化器，避免阻塞请求"""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # 不在事件循环中，回退为同步等待
            await self._update_vectorizer(new_texts, new_chunk_ids)
            return

        async def _run():
            try:
                await self._update_vectorizer(new_texts, new_chunk_ids)
            except Exception as e:
                logger.error(f"后台更新向量化器失败: {e}")

        loop.create_task(_run())

    def _build_embeddings_for_doc_sync(self, doc_id: str, content: str) -> None:
        """为单个文档构建向量化数据（同步）"""
        with self.SessionLocal() as session:
            existing_chunks = session.query(DocumentEmbedding).filter(
                DocumentEmbedding.doc_id == doc_id
            ).all()

            # 如果已有向量，直接跳过
            if existing_chunks and any(chunk.embedding for chunk in existing_chunks):
                return

            if existing_chunks:
                session.query(DocumentEmbedding).filter(
                    DocumentEmbedding.doc_id == doc_id
                ).delete()
                session.commit()

            chunks = self._chunk_document(content)
            new_chunk_ids = []
            new_texts = []
            for i, chunk in enumerate(chunks):
                processed_text = self._preprocess_text(chunk)
                embedding_doc = DocumentEmbedding(
                    doc_id=doc_id,
                    chunk_index=i,
                    chunk_content=chunk,
                    embedding=""
                )
                session.add(embedding_doc)
                session.flush()
                new_chunk_ids.append(embedding_doc.id)
                new_texts.append(processed_text)

            session.commit()

        # 向量化更新放到独立逻辑，避免占用DB会话时间
        self._update_vectorizer_sync(new_texts, new_chunk_ids)

    async def _schedule_embedding_build(self, doc_id: str, content: str) -> None:
        """后台构建向量化数据，由于外层已使用BackgroundTasks或处于async下，直接await线程构建即可"""
        try:
            await asyncio.to_thread(self._build_embeddings_for_doc_sync, doc_id, content)
        except Exception as e:
            logger.error(f"后台构建向量化数据失败: {e}")

    def _schedule_embedding_build_sync(self, doc_id: str, content: str) -> None:
        """同步场景下的后台构建"""
        threading.Thread(
            target=self._build_embeddings_for_doc_sync,
            args=(doc_id, content),
            daemon=True
        ).start()
    
    async def search(
        self, 
        query: str, 
        top_k: int = 5, 
        category: str = None
    ) -> List[Dict[str, Any]]:
        """搜索相关文档"""
        try:
            if not self._fit_vectorizer:
                logger.warning("向量化器未训练，无法进行搜索")
                return []
            
            # 预处理查询
            processed_query = self._preprocess_text(query)
            query_vector = self.vectorizer.transform([processed_query]).toarray()[0]
            
            with self.SessionLocal() as session:
                # 获取所有文档块
                chunks = session.query(DocumentEmbedding).all()
                if category:
                    # 过滤分类
                    doc_ids = session.query(KnowledgeDocument.doc_id).filter(
                        KnowledgeDocument.category == category
                    ).all()
                    doc_ids = [doc_id[0] for doc_id in doc_ids]
                    chunks = [chunk for chunk in chunks if chunk.doc_id in doc_ids]
                
                # 计算相似度
                results = []
                for chunk in chunks:
                    if chunk.embedding:
                        chunk_vector = np.array(json.loads(chunk.embedding))
                        similarity = cosine_similarity([query_vector], [chunk_vector])[0][0]
                        
                        results.append({
                            'doc_id': chunk.doc_id,
                            'chunk_index': chunk.chunk_index,
                            'content': chunk.chunk_content,
                            'similarity': float(similarity)
                        })
                
                # 按相似度排序
                results.sort(key=lambda x: x['similarity'], reverse=True)
                
                # 获取文档详细信息
                top_results = results[:top_k]
                doc_ids = list(set([result['doc_id'] for result in top_results]))
                documents = session.query(KnowledgeDocument).filter(
                    KnowledgeDocument.doc_id.in_(doc_ids)
                ).all()
                
                doc_map = {doc.doc_id: doc for doc in documents}
                
                # 组装最终结果
                final_results = []
                for result in top_results:
                    doc = doc_map.get(result['doc_id'])
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
            logger.error(f"搜索失败: {e}")
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
                session.query(DocumentEmbedding).filter(
                    DocumentEmbedding.doc_id == doc_id
                ).delete()
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
