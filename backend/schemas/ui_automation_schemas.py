from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UIAutomationCaseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    project_id: Optional[int] = None
    target_url: str = Field(..., min_length=1, max_length=500)
    auth_scheme: Literal["none", "account_password", "cookie", "token"] = "none"
    auth_payload: Optional[Dict[str, Any]] = None
    natural_language_steps: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)
    assertions: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    status: Literal["draft", "active", "archived"] = "draft"
    debug_mode: bool = False


class UIAutomationCaseCreate(UIAutomationCaseBase):
    pass


class UIAutomationCaseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    project_id: Optional[int] = None
    target_url: Optional[str] = Field(default=None, min_length=1, max_length=500)
    auth_scheme: Optional[Literal["none", "account_password", "cookie", "token"]] = None
    auth_payload: Optional[Dict[str, Any]] = None
    natural_language_steps: Optional[List[Union[str, Dict[str, Any]]]] = None
    assertions: Optional[List[Union[str, Dict[str, Any]]]] = None
    tags: Optional[List[str]] = None
    status: Optional[Literal["draft", "active", "archived"]] = None
    debug_mode: Optional[bool] = None


class UIAutomationCaseSummary(ORMModel):
    id: int
    name: str
    description: Optional[str] = None
    project_id: Optional[int] = None
    target_url: str
    auth_scheme: str
    status: str
    tags: List[str] = Field(default_factory=list)
    debug_mode: bool = False
    last_run_status: Optional[str] = None
    last_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class UIAutomationCaseDetail(UIAutomationCaseSummary):
    auth_payload: Optional[Dict[str, Any]] = None
    natural_language_steps: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)
    assertions: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)


class UIAutomationCreateTaskFromCaseRequest(BaseModel):
    auto_start: bool = True
    debug_mode: Optional[bool] = None


class UIAutomationTaskCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    case_id: Optional[int] = None
    target_url: str = Field(..., min_length=1, max_length=500)
    auth_scheme: Literal["none", "account_password", "cookie", "token"] = "none"
    auth_payload: Optional[Dict[str, Any]] = None
    natural_language_steps: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)
    assertions: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)
    auto_start: bool = True
    debug_mode: bool = False


class UIAutomationTaskQuery(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)


class UIAutomationTaskSummary(ORMModel):
    id: int
    task_no: str
    case_id: Optional[int] = None
    name: str
    target_url: str
    auth_scheme: str
    status: str
    progress: int
    executor: str
    debug_mode: bool = False
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class UIAutomationStepLogItem(ORMModel):
    id: int
    step_index: int
    step_title: str
    status: str
    detail: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class UIAutomationArtifactItem(ORMModel):
    id: int
    artifact_type: str
    artifact_name: str
    artifact_path: Optional[str] = None
    artifact_content: Optional[str] = None
    created_at: datetime


class UIAutomationTaskDetail(UIAutomationTaskSummary):
    error_message: Optional[str] = None
    auth_payload: Optional[Dict[str, Any]] = None
    natural_language_steps: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)
    assertions: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)
    step_logs: List[UIAutomationStepLogItem] = Field(default_factory=list)
    artifacts: List[UIAutomationArtifactItem] = Field(default_factory=list)
    playwright_script: Optional[str] = None
    trace_artifact_name: Optional[str] = None
    replay_script_name: Optional[str] = None


class UIAutomationCaseCreateResponse(BaseModel):
    case: UIAutomationCaseSummary


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


class UIAutomationGenerateStepsRequest(BaseModel):
    natural_language: str


class UIAutomationGenerateStepsResponse(BaseModel):
    steps: List[Dict[str, Any]]
