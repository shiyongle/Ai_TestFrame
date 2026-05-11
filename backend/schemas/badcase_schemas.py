from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ============ DifyAgent Schemas ============

class DifyAgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="智能体名称")
    base_url: str = Field(..., min_length=1, max_length=500, description="Dify API基础URL")
    app_id: str = Field(..., min_length=1, max_length=100, description="Dify App ID")
    api_key: Optional[str] = Field(default=None, max_length=255, description="Dify API密钥")


class DifyAgentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    base_url: Optional[str] = Field(default=None, max_length=500)
    app_id: Optional[str] = Field(default=None, max_length=100)
    api_key: Optional[str] = Field(default=None, max_length=255)


class DifyAgentResponse(BaseModel):
    id: int
    name: str
    base_url: str
    app_id: str
    api_key: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ BadCase Schemas ============

class BadCaseTurnInput(BaseModel):
    message_id: Optional[str] = Field(default=None, max_length=100)
    query: str = Field(..., min_length=1, description="用户问题")
    answer: str = Field(..., min_length=1, description="Agent回答")
    expected_answer: Optional[str] = Field(default=None, description="期望答案")
    remark: Optional[str] = Field(default=None, description="备注")
    turn_index: int = Field(default=0, description="轮次序号")


class BadCaseCreate(BaseModel):
    agent_id: int = Field(..., description="关联的DifyAgent ID")
    conversation_id: Optional[str] = Field(default=None, max_length=100, description="对话ID")
    remark: Optional[str] = Field(default=None, description="备注")
    turns: List[BadCaseTurnInput] = Field(..., min_length=1, description="轮次列表")


class BadCaseTurnResponse(BaseModel):
    id: int
    message_id: Optional[str] = None
    query: str
    answer: str
    expected_answer: Optional[str] = None
    evaluation_score: Optional[int] = None
    evaluation_reason: Optional[str] = None
    rerun_answer: Optional[str] = None
    rerun_score: Optional[int] = None
    rerun_reason: Optional[str] = None
    remark: Optional[str] = None
    turn_index: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BadCaseResponse(BaseModel):
    id: int
    agent_id: int
    agent_name: Optional[str] = None
    conversation_id: Optional[str] = None
    remark: Optional[str] = None
    turns: List[BadCaseTurnResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BadCaseUpdate(BaseModel):
    conversation_id: Optional[str] = Field(default=None, max_length=100)
    remark: Optional[str] = Field(default=None)


class BadCaseTurnUpdate(BaseModel):
    query: Optional[str] = None
    answer: Optional[str] = None
    expected_answer: Optional[str] = None
    remark: Optional[str] = None