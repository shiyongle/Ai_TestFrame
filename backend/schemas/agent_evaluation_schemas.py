from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ============ 黄金测试集 Schemas ============

class GoldenDatasetItemCreate(BaseModel):
    question: str = Field(..., min_length=1, max_length=8000, description="问题")
    expected_answer: str = Field(..., min_length=1, max_length=8000, description="期望答案")
    category: Optional[str] = Field(default=None, max_length=100, description="分类")
    priority: str = Field(default="medium", description="优先级: high, medium, low")
    tags: Optional[List[str]] = Field(default=None, description="标签")


class GoldenDatasetItemUpdate(BaseModel):
    question: Optional[str] = Field(default=None, max_length=8000)
    expected_answer: Optional[str] = Field(default=None, max_length=8000)
    category: Optional[str] = Field(default=None, max_length=100)
    priority: Optional[str] = Field(default=None)
    tags: Optional[List[str]] = Field(default=None)


class GoldenDatasetItemResponse(BaseModel):
    id: int
    dataset_id: int
    question: str
    expected_answer: str
    category: Optional[str] = None
    priority: str = "medium"
    tags: Optional[List[str]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GoldenDatasetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="测试集名称")
    description: Optional[str] = Field(default=None, max_length=2000, description="描述")
    tags: Optional[List[str]] = Field(default=None, description="标签")
    items: Optional[List[GoldenDatasetItemCreate]] = Field(default=None, description="初始条目列表")


class GoldenDatasetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=150)
    description: Optional[str] = Field(default=None, max_length=2000)
    tags: Optional[List[str]] = Field(default=None)


class GoldenDatasetResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    item_count: int = 0
    items: List[GoldenDatasetItemResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GoldenDatasetBriefResponse(BaseModel):
    """列表用的简要响应，不含 items"""
    id: int
    name: str
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    item_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ 评测模板 Schemas ============

class AgentEvaluationTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="模板名称")
    description: Optional[str] = Field(default=None, max_length=2000, description="模板描述")
    system_prompt: Optional[str] = Field(default=None, max_length=4000, description="系统提示词")
    user_prompt: str = Field(..., min_length=1, max_length=4000, description="用户提示词，支持 {{query}}, {{expected_answer}}, {{answer}} 变量")
    eval_mode: str = Field(default="f1", description="评测模式: f1(关键词覆盖率) 或 llm(LLM-as-judge)")
    model_config_id: Optional[int] = Field(default=None, description="关联的模型配置ID（llm模式必填）")
    pass_threshold: float = Field(default=0.55, ge=0, le=1, description="f1模式通过阈值")


class AgentEvaluationTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=150)
    description: Optional[str] = Field(default=None, max_length=2000)
    system_prompt: Optional[str] = Field(default=None, max_length=4000)
    user_prompt: Optional[str] = Field(default=None, max_length=4000)
    eval_mode: Optional[str] = Field(default=None)
    model_config_id: Optional[int] = Field(default=None)
    pass_threshold: Optional[float] = Field(default=None, ge=0, le=1)


class AgentEvaluationTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    user_prompt: str
    eval_mode: str
    model_config_id: Optional[int] = None
    model_config_name: Optional[str] = None
    pass_threshold: float
    evaluation_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ 单条评测 Schemas ============

class AgentEvaluationCreate(BaseModel):
    """创建单条评测（对应xapp的AgentEvaluation）"""
    template_id: int = Field(..., description="评测模板ID")
    bad_case_turn_id: Optional[int] = Field(default=None, description="关联的BadCaseTurn ID")
    query: str = Field(..., min_length=1, max_length=4000, description="用户问题")
    answer: str = Field(..., min_length=1, max_length=4000, description="Agent回答")
    expected_answer: Optional[str] = Field(default=None, max_length=8000, description="期望答案")


class AgentEvaluationResponse(BaseModel):
    id: int
    template_id: int
    template_name: Optional[str] = None
    bad_case_turn_id: Optional[int] = None
    query: str
    answer: str
    expected_answer: Optional[str] = None
    extracted_items: Optional[str] = None
    evaluation_result: Optional[str] = None
    score: float = 0
    reason: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    latency_ms: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ 批量评测 Schemas ============

class AgentEvaluationCase(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)
    expected_answer: Optional[str] = Field(default=None, max_length=8000)


class AgentEvaluationRunCreate(BaseModel):
    """创建批量评测运行"""
    name: str = Field(..., min_length=1, max_length=150)
    dataset_id: Optional[int] = Field(default=None, description="黄金测试集ID（优先使用）")
    agent_id: Optional[int] = Field(default=None, description="被测Agent ID")
    template_id: Optional[int] = Field(default=None, description="评测模板ID")
    eval_mode: str = Field(default="llm", description="评测模式: f1 或 llm")
    provider: str = Field(default="", max_length=50, description="模型提供商（兼容旧模式）")
    model: Optional[str] = Field(default=None, max_length=100, description="模型名称")
    model_config_id: Optional[int] = Field(default=None, description="模型配置ID")
    temperature: float = Field(default=0.2, ge=0, le=2)
    max_tokens: int = Field(default=1024, ge=1, le=4096)
    pass_threshold: float = Field(default=0.55, ge=0, le=1)
    cases: Optional[List[AgentEvaluationCase]] = Field(default=None, description="手动指定的用例列表（不使用dataset时）")


class AgentEvaluationItemResponse(BaseModel):
    id: int
    dataset_item_id: Optional[int] = None
    question: str
    expected_answer: Optional[str] = None
    actual_answer: Optional[str] = None
    evaluation_result: Optional[str] = None
    status: str
    score: float
    reason: Optional[str] = None
    error_message: Optional[str] = None
    latency_ms: int
    human_override: bool = False
    human_label: Optional[str] = None
    human_comment: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AgentEvaluationRunResponse(BaseModel):
    id: int
    name: str
    dataset_id: Optional[int] = None
    dataset_name: Optional[str] = None
    agent_id: Optional[int] = None
    agent_name: Optional[str] = None
    template_id: Optional[int] = None
    eval_mode: str = "f1"
    provider: str = ""
    model: Optional[str] = None
    model_config_id: Optional[int] = None
    status: str
    total_count: int
    valid_count: int
    invalid_count: int
    failed_count: int
    human_override_count: int = 0
    valid_rate: float
    failure_rate: float
    summary: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    items: List[AgentEvaluationItemResponse] = []

    class Config:
        from_attributes = True


# ============ 人工标注 Schema ============

class HumanLabelUpdate(BaseModel):
    """人工标注更新"""
    human_label: str = Field(..., description="人工标注: correct 或 incorrect")
    human_comment: Optional[str] = Field(default=None, max_length=2000, description="标注备注")
