try:
    # Pydantic v2
    from pydantic import BaseModel, Field, ConfigDict
    _HAS_V2 = True
except ImportError:  # pragma: no cover - fallback to v1
    from pydantic import BaseModel, Field  # type: ignore
    ConfigDict = None  # type: ignore
    _HAS_V2 = False
from typing import Optional, Dict, Any, List
from datetime import datetime

# 项目相关模型
class ORMModel(BaseModel):
    """兼容 Pydantic v1/v2 的 ORM 基类，避免 orm_mode/from_attributes 提示。"""
    if _HAS_V2:
        model_config = ConfigDict(from_attributes=True)
    else:  # pragma: no cover
        class Config:
            orm_mode = True


class ProjectBase(ORMModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

# 测试用例相关模型
class TestCaseBase(ORMModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    protocol: str = Field(..., pattern="^(http|tcp|mq)$")
    config: Optional[Dict[str, Any]] = None

class TestCaseCreate(TestCaseBase):
    pass

class TestCaseResponse(TestCaseBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

# HTTP测试请求模型
class HttpTestRequest(BaseModel):
    url: str
    method: str = Field(..., pattern="^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$")
    headers: Optional[Dict[str, str]] = None
    params: Optional[Dict[str, Any]] = None
    body: Optional[Any] = None
    timeout: int = Field(default=30, ge=1, le=300)
    verify_ssl: bool = True
    follow_redirects: bool = True

class HttpTestResponse(BaseModel):
    status_code: int
    headers: Dict[str, str]
    body: Any
    execution_time: int  # 毫秒
    success: bool
    error_message: Optional[str] = None

# TCP测试请求模型
class TcpTestRequest(BaseModel):
    host: str
    port: int = Field(..., ge=1, le=65535)
    data: str
    timeout: int = Field(default=30, ge=1, le=300)
    encoding: str = "utf-8"

class TcpTestResponse(BaseModel):
    success: bool
    response_data: Optional[str] = None
    execution_time: int
    error_message: Optional[str] = None

# MQ测试请求模型
class MqTestRequest(BaseModel):
    host: str
    port: int = Field(..., ge=1, le=65535)
    queue_name: str
    message: str
    exchange: Optional[str] = None
    routing_key: Optional[str] = None
    timeout: int = Field(default=30, ge=1, le=300)
    mq_type: str = Field(..., pattern="^(rabbitmq|activemq|kafka)$")

class MqTestResponse(BaseModel):
    success: bool
    message_id: Optional[str] = None
    response_data: Optional[str] = None
    execution_time: int
    error_message: Optional[str] = None

# 批量测试请求模型
class BatchTestRequest(BaseModel):
    project_id: int
    testcase_ids: List[int]
    parallel: bool = False
    max_workers: int = Field(default=5, ge=1, le=20)

class BatchTestResponse(BaseModel):
    task_id: str
    total_tests: int
    status: str

# 版本管理模型
class VersionBase(ORMModel):
    version_number: str = Field(..., max_length=50)
    description: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None
    created_by: Optional[str] = None

class VersionCreate(VersionBase):
    pass

class VersionResponse(VersionBase):
    id: int
    created_at: datetime

# 测试结果模型
class TestResultResponse(ORMModel):
    id: int
    testcase_id: int
    status: str
    response_data: Optional[Dict[str, Any]]
    execution_time: Optional[int]
    error_message: Optional[str]
    executed_at: datetime

# 测试报告模型
class TestReportResponse(ORMModel):
    id: int
    version_id: int
    project_id: int
    total_tests: int
    passed_tests: int
    failed_tests: int
    error_tests: int
    summary: Optional[Dict[str, Any]]
    created_at: datetime

# 通用响应模型
class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
