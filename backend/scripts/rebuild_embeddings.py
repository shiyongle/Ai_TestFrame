import os
import sys
import asyncio
import logging

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal
from models.database_models import KnowledgeDocument, DocumentEmbedding
from services.ai.rag_engine import rag_engine

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("rebuild_embeddings")

async def rebuild_all():
    logger.info("开始重建知识库 Embedding...")
    with SessionLocal() as db:
        # 1. 删除旧的向量记录 (基于 TF-IDF 或者旧维度的错误记录)
        deleted = db.query(DocumentEmbedding).delete()
        db.commit()
        logger.info(f"成功清理 {deleted} 条历史无效向量记录")
        
        # 2. 获取所有知识库文档
        docs = db.query(KnowledgeDocument).all()
        logger.info(f"发现 {len(docs)} 篇知识文档等待重新向量化")
        
        for i, doc in enumerate(docs):
            logger.info(f"[{i+1}/{len(docs)}] 正在处理文档: {doc.title} ({doc.doc_id})")
            try:
                # 调用新的异步大模型构建方法
                await rag_engine._build_embeddings_for_doc_async(doc.doc_id, doc.content)
            except Exception as e:
                logger.error(f"   构建失败: {e}")
                
    logger.info("全部文档重建完成！")

if __name__ == "__main__":
    asyncio.run(rebuild_all())
