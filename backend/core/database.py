from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config.settings import settings
import logging

# 设置SQL日志
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
logging.getLogger('sqlalchemy.pool').setLevel(logging.INFO)

# 创建数据库引擎
engine = create_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout,
    pool_recycle=settings.db_pool_recycle,
    pool_pre_ping=settings.db_pool_pre_ping,
    echo=True  # 启用SQL日志
)
print(f"DEBUG: Database Engine created with URL: {settings.database_url.replace(settings.mysql_password, '******')}")

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基础模型类
Base = declarative_base()

# 依赖注入：获取数据库会话
def get_db():
    """获取数据库会话"""
    print("DEBUG: get_db called, creating session...")
    db = SessionLocal()
    try:
        print("DEBUG: Session created, yielding...")
        yield db
    finally:
        print("DEBUG: Closing session...")
        db.close()

# 创建所有表
def create_tables():
    """创建所有数据库表"""
    Base.metadata.create_all(bind=engine)