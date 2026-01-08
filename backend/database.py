from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, ForeignKey, JSON, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
import logging
import time
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# MySQL数据库连接配置
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "password")
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "test_system")

SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
    echo=True  # 启用SQL语句日志
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

# 配置SQL执行日志
sql_logger = logging.getLogger("sqlalchemy.engine")

@event.listens_for(engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """SQL执行前的日志记录"""
    context._query_start_time = time.time()

@event.listens_for(engine, "after_cursor_execute")
def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """SQL执行后的日志记录"""
    total = time.time() - context._query_start_time
    sql_logger.info(f"SQL执行耗时: {total:.3f}s - 参数: {parameters}")
    
    # 记录慢查询（超过0.5秒）
    if total > 0.5:
        sql_logger.warning(f"慢查询检测: {total:.3f}s - SQL: {statement[:100]}...")

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 项目表
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    testcases = relationship("TestCase", back_populates="project")

# 测试用例表
class TestCase(Base):
    __tablename__ = "testcases"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    protocol = Column(String(20), nullable=False)  # http, tcp, mq
    config = Column(JSON)  # 测试配置
    project_id = Column(Integer, ForeignKey("projects.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = relationship("Project", back_populates="testcases")
    test_results = relationship("TestResult", back_populates="testcase")

# 测试结果表
class TestResult(Base):
    __tablename__ = "test_results"
    
    id = Column(Integer, primary_key=True, index=True)
    testcase_id = Column(Integer, ForeignKey("testcases.id"))
    status = Column(String(20), nullable=False)  # success, fail, error
    response_data = Column(JSON)
    execution_time = Column(Integer)  # 毫秒
    error_message = Column(Text)
    executed_at = Column(DateTime, default=datetime.utcnow)
    
    testcase = relationship("TestCase", back_populates="test_results")

# 版本管理表
class Version(Base):
    __tablename__ = "versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version_number = Column(String(50), nullable=False)
    description = Column(Text)
    changes = Column(JSON)  # 变更内容
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100))
    
    test_reports = relationship("TestReport", back_populates="version")

# 测试报告表
class TestReport(Base):
    __tablename__ = "test_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("versions.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    total_tests = Column(Integer, default=0)
    passed_tests = Column(Integer, default=0)
    failed_tests = Column(Integer, default=0)
    error_tests = Column(Integer, default=0)
    summary = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    version = relationship("Version", back_populates="test_reports")

# 测试数据表
class TestData(Base):
    __tablename__ = "test_data"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    data_type = Column(String(50))  # request_data, response_data, config
    content = Column(JSON)
    project_id = Column(Integer, ForeignKey("projects.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# 创建所有表（仅在连接成功时）
try:
    Base.metadata.create_all(bind=engine)
    print("数据库表创建成功")
except Exception as e:
    print(f"数据库连接失败: {e}")
    print("请检查MySQL服务是否启动，以及.env配置是否正确")
