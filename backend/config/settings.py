from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置类"""
    
    # 应用基础配置
    app_name: str = "投石问路API"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # 数据库配置
    mysql_user: str = ""
    mysql_password: str = ""
    mysql_host: str = ""
    mysql_port: int = 3306
    mysql_database: str = "test_system"
    
    # 数据库连接池配置
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_recycle: int = 300
    db_pool_pre_ping: bool = True
    
    # CORS配置
    cors_origins: list = ["*"]
    cors_methods: list = ["*"]
    cors_headers: list = ["*"]
    
    # 日志配置
    log_level: str = "INFO"
    log_file: str = "backend.log"
    request_log_file: str = "requests.log"
    sql_log_file: str = "sql.log"
    
    # 测试配置
    default_http_timeout: int = 30
    default_tcp_timeout: int = 30
    default_mq_timeout: int = 30
    
    # AI配置 - OpenAI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    
    # AI配置 - 智谱GLM
    GLM_API_KEY: Optional[str] = None
    
    # AI配置 - 通义千问
    TONGYI_API_KEY: Optional[str] = None
    
    # AI配置 - DeepSeek
    DEEPSEEK_API_KEY: Optional[str] = None
    
    # RAG配置
    RAG_CHUNK_SIZE: int = 500
    RAG_CHUNK_OVERLAP: int = 50
    RAG_MAX_FEATURES: int = 1000
    
    # Workflow配置
    WORKFLOW_MAX_EXECUTION_TIME: int = 3600  # 1小时
    WORKFLOW_MAX_CONCURRENT: int = 10
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8"
    }
    
    @property
    def database_url(self) -> str:
        """获取数据库连接URL"""
        return f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}"


# 全局配置实例
settings = Settings()