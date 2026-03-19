from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class UIAutomationTaskCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    target_url: str = Field(..., min_length=1, max_length=500)
    auth_scheme: Literal["none", "account_password", "cookie", "token"] = "none"
    auth_payload: Optional[Dict[str, Any]] = None
    natural_language_steps: List[str] = Field(default_factory=list)
    assertions: List[str] = Field(default_factory=list)
    auto_start: bool = True


class UIAutomationTaskQuery(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)


class UIAutomationTaskSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_no: str
    name: str
    target_url: str
    auth_scheme: str
    status: str
    progress: int
    executor: str
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class UIAutomationStepLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    step_index: int
    step_title: str
    status: str
    detail: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class UIAutomationArtifactItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    artifact_type: str
    artifact_name: str
    artifact_path: Optional[str] = None
    artifact_content: Optional[str] = None
    created_at: datetime


class UIAutomationTaskDetail(UIAutomationTaskSummary):
    error_message: Optional[str] = None
    auth_payload: Optional[Dict[str, Any]] = None
    natural_language_steps: List[str] = Field(default_factory=list)
    assertions: List[str] = Field(default_factory=list)
    step_logs: List[UIAutomationStepLogItem] = Field(default_factory=list)
    artifacts: List[UIAutomationArtifactItem] = Field(default_factory=list)
    playwright_script: Optional[str] = None


class UIAutomationTaskCreateResponse(BaseModel):
    task: UIAutomationTaskSummary


class UIAutomationStartResponse(BaseModel):
    task_id: int
    status: str
    message: str


class UIAutomationSolidifyResponse(BaseModel):
    task_id: int
    script_name: str
    script_content: str
