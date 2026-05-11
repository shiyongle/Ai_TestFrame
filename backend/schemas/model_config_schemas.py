from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ModelConfigCreate(BaseModel):
    provider: str = Field(..., min_length=1, max_length=50, description="模型提供商: openai, bailian, glm, deepseek, siliconflow")
    name: str = Field(..., min_length=1, max_length=100, description="配置名称")
    api_key: str = Field(..., min_length=1, description="API密钥")
    base_url: str = Field(..., min_length=1, max_length=500, description="API基础URL")
    model: str = Field(..., min_length=1, max_length=100, description="模型名称")
    enabled: bool = Field(default=True, description="是否启用")


class ModelConfigUpdate(BaseModel):
    provider: Optional[str] = Field(default=None, max_length=50)
    name: Optional[str] = Field(default=None, max_length=100)
    api_key: Optional[str] = Field(default=None)
    base_url: Optional[str] = Field(default=None, max_length=500)
    model: Optional[str] = Field(default=None, max_length=100)
    enabled: Optional[bool] = Field(default=None)


class ModelConfigResponse(BaseModel):
    id: int
    provider: str
    name: str
    api_key: str
    base_url: str
    model: str
    enabled: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ModelConfigBrief(BaseModel):
    """简要模型配置信息，用于关联展示"""
    id: int
    provider: str
    name: str
    model: str
    enabled: bool

    class Config:
        from_attributes = True