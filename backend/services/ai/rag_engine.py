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
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import jieba
import re

from config.settings import settings

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

class KnowledgeDocument(Base):
    """知识文档表"""
    __tablename__ = "knowledge_documents"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    doc_id = Column(String(100), unique=True, nullable=False)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)
    doc_metadata = Column(Text)  # JSON格式，避免与SQLAlchemy保留字冲突
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DocumentEmbedding(Base):
    """文档向量表"""
    __tablename__ = "document_embeddings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    doc_id = Column(String(100), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_content = Column(Text, nullable=False)
    embedding = Column(Text)  # JSON格式的向量
    created_at = Column(DateTime, default=datetime.utcnow)

class RAGEngine:
    """RAG知识库引擎"""
    
    def __init__(self):
        self.engine = create_engine(settings.database_url)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words=None,
            ngram_range=(1, 2)
        )
        self._fit_vectorizer = False
        self.document_cache = {}
        
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
        """添加文档到知识库"""
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
                
                # 文档分块并存储向量
                chunks = self._chunk_document(content)
                for i, chunk in enumerate(chunks):
                    # 预处理文本
                    processed_text = self._preprocess_text(chunk)
                    
                    # 存储文档块
                    embedding_doc = DocumentEmbedding(
                        doc_id=doc_id,
                        chunk_index=i,
                        chunk_content=chunk,
                        embedding=""  # 后续会更新
                    )
                    session.add(embedding_doc)
                
                session.commit()
            
            # 更新向量化器
            await self._update_vectorizer()
            
            logger.info(f"成功添加文档: {title} (ID: {doc_id})")
            return doc_id
            
        except Exception as e:
            logger.error(f"添加文档失败: {e}")
            raise
    
    async def _update_vectorizer(self):
        """更新向量化器"""
        try:
            with self.SessionLocal() as session:
                # 获取所有文档块
                chunks = session.query(DocumentEmbedding.chunk_content).all()
                texts = [self._preprocess_text(chunk[0]) for chunk in chunks]
                
                if texts:
                    # 训练向量化器
                    self.vectorizer.fit(texts)
                    self._fit_vectorizer = True
                    
                    # 更新所有文档块的向量
                    embeddings = self.vectorizer.transform(texts).toarray()
                    
                    for i, embedding in enumerate(embeddings):
                        chunk = chunks[i]
                        chunk.embedding = json.dumps(embedding.tolist())
                    
                    session.commit()
                    logger.info(f"更新了 {len(texts)} 个文档块的向量")
                    
        except Exception as e:
            logger.error(f"更新向量化器失败: {e}")
    
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

# 全局实例
rag_engine = RAGEngine()
