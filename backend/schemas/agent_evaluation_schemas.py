from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AgentEvaluationCase(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)
    expected_answer: Optional[str] = Field(default=None, max_length=8000)


class AgentEvaluationRunCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    provider: str = Field(..., min_length=1, max_length=50)
    model: Optional[str] = Field(default=None, max_length=100)
    temperature: float = Field(default=0.2, ge=0, le=2)
    max_tokens: int = Field(default=1024, ge=1, le=4096)
    pass_threshold: float = Field(default=0.55, ge=0, le=1)
    cases: List[AgentEvaluationCase] = Field(..., min_length=1, max_length=100)


class AgentEvaluationItemResponse(BaseModel):
    id: int
    question: str
    expected_answer: Optional[str] = None
    actual_answer: Optional[str] = None
    status: str
    score: float
    reason: Optional[str] = None
    error_message: Optional[str] = None
    latency_ms: int
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AgentEvaluationRunResponse(BaseModel):
    id: int
    name: str
    provider: str
    model: Optional[str] = None
    status: str
    total_count: int
    valid_count: int
    invalid_count: int
    failed_count: int
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
