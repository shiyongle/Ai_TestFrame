from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TestPlanBase(BaseModel):
    name: str = Field(..., max_length=150)
    description: Optional[str] = None
    project_id: int
    owner: Optional[str] = None
    status: str = Field(default="draft", pattern="^(draft|ready|running|completed|archived)$")
    execution_mode: str = Field(default="serial", pattern="^(serial|parallel)$")
    priority: str = Field(default="medium", pattern="^(high|medium|low)$")
    entry_criteria: Optional[str] = None
    exit_criteria: Optional[str] = None
    schedule: Optional[str] = None
    tags: Optional[List[str]] = None
    functional_case_ids: List[int] = Field(default_factory=list)
    interface_case_ids: List[int] = Field(default_factory=list)


class TestPlanCreate(TestPlanBase):
    pass


class TestPlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=150)
    description: Optional[str] = None
    project_id: Optional[int] = None
    owner: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(draft|ready|running|completed|archived)$")
    execution_mode: Optional[str] = Field(default=None, pattern="^(serial|parallel)$")
    priority: Optional[str] = Field(default=None, pattern="^(high|medium|low)$")
    entry_criteria: Optional[str] = None
    exit_criteria: Optional[str] = None
    schedule: Optional[str] = None
    tags: Optional[List[str]] = None
    functional_case_ids: Optional[List[int]] = None
    interface_case_ids: Optional[List[int]] = None


class PlanCaseSummary(ORMModel):
    id: int
    name: str
    description: Optional[str] = None
    protocol: Optional[str] = None
    priority: Optional[str] = None
    project_id: Optional[int] = None
    case_type: str
    module: Optional[str] = None
    method: Optional[str] = None
    url: Optional[str] = None


class TestPlanExecutionResponse(ORMModel):
    id: int
    test_plan_id: int
    status: str
    total_items: int
    passed_items: int
    failed_items: int
    error_items: int
    skipped_items: int
    summary: Optional[Dict[str, Any]] = None
    started_at: datetime
    completed_at: Optional[datetime] = None


class TestPlanResponse(ORMModel):
    id: int
    name: str
    description: Optional[str] = None
    project_id: int
    owner: Optional[str] = None
    status: str
    execution_mode: str
    priority: str
    entry_criteria: Optional[str] = None
    exit_criteria: Optional[str] = None
    schedule: Optional[str] = None
    tags: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    last_executed_at: Optional[datetime] = None
    functional_cases: List[PlanCaseSummary] = Field(default_factory=list)
    interface_cases: List[PlanCaseSummary] = Field(default_factory=list)
    latest_execution: Optional[TestPlanExecutionResponse] = None
    total_case_count: int = 0

