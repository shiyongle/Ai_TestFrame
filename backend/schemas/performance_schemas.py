from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PerformanceVariableDefinition(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    scope: Literal["scenario", "vu"] = "vu"
    initial_value: Optional[Any] = None
    secret: bool = False
    description: Optional[str] = None


class PerformanceExtractor(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    source: Literal["json_body", "header", "cookie", "regex", "text"] = "json_body"
    expression: str = Field(..., min_length=1, max_length=300)
    default_value: Optional[Any] = None
    required: bool = False
    transform: Optional[Literal["none", "string", "number", "json"]] = "none"


class PerformanceAssertion(BaseModel):
    type: Literal["status_code", "json_path", "contains", "equals", "regex"] = "status_code"
    operator: str = Field(default="eq", min_length=1, max_length=30)
    expected: Any = None
    target: Optional[str] = None
    message: Optional[str] = None
    enabled: bool = True


class PerformanceScenarioStep(BaseModel):
    step_id: str = Field(..., min_length=1, max_length=80)
    name: str = Field(..., min_length=1, max_length=120)
    enabled: bool = True
    step_type: Literal["http", "rabbitmq"] = "http"
    method: Optional[str] = Field(default="GET", max_length=16)
    url: Optional[str] = None
    headers: Dict[str, Any] = Field(default_factory=dict)
    query: Dict[str, Any] = Field(default_factory=dict)
    body: Optional[Any] = None
    timeout_ms: int = Field(default=10000, ge=100, le=600000)
    think_time_ms: int = Field(default=0, ge=0, le=600000)
    extractors: List[PerformanceExtractor] = Field(default_factory=list)
    assertions: List[PerformanceAssertion] = Field(default_factory=list)
    on_failure: Literal["stop_user", "continue", "stop_scenario"] = "stop_user"
    transaction_name: Optional[str] = None
    weight: int = Field(default=1, ge=1, le=100)


class PerformanceScenarioBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    project_id: Optional[int] = None
    protocol: Literal["http", "rabbitmq"]
    status: Literal["draft", "active", "archived"] = "draft"
    tags: List[str] = Field(default_factory=list)
    target_config: Dict[str, Any] = Field(default_factory=dict)
    steps: List[PerformanceScenarioStep] = Field(default_factory=list)
    variables: List[PerformanceVariableDefinition] = Field(default_factory=list)
    environment_config: Dict[str, Any] = Field(default_factory=dict)
    load_profile: Dict[str, Any] = Field(default_factory=dict)
    assertions: List[PerformanceAssertion] = Field(default_factory=list)
    runtime_options: Dict[str, Any] = Field(default_factory=dict)


class PerformanceScenarioCreate(PerformanceScenarioBase):
    pass


class PerformanceScenarioUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = None
    project_id: Optional[int] = None
    protocol: Optional[Literal["http", "rabbitmq"]] = None
    status: Optional[Literal["draft", "active", "archived"]] = None
    tags: Optional[List[str]] = None
    target_config: Optional[Dict[str, Any]] = None
    steps: Optional[List[PerformanceScenarioStep]] = None
    variables: Optional[List[PerformanceVariableDefinition]] = None
    environment_config: Optional[Dict[str, Any]] = None
    load_profile: Optional[Dict[str, Any]] = None
    assertions: Optional[List[PerformanceAssertion]] = None
    runtime_options: Optional[Dict[str, Any]] = None


class PerformanceScenarioSummary(ORMModel):
    id: int
    name: str
    description: Optional[str] = None
    project_id: Optional[int] = None
    protocol: str
    status: str
    tags: List[str] = Field(default_factory=list)
    step_count: int = 0
    variable_count: int = 0
    last_run_status: Optional[str] = None
    last_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PerformanceScenarioDetail(PerformanceScenarioSummary):
    target_config: Dict[str, Any] = Field(default_factory=dict)
    steps: List[PerformanceScenarioStep] = Field(default_factory=list)
    variables: List[PerformanceVariableDefinition] = Field(default_factory=list)
    environment_config: Dict[str, Any] = Field(default_factory=dict)
    load_profile: Dict[str, Any] = Field(default_factory=dict)
    assertions: List[PerformanceAssertion] = Field(default_factory=list)
    runtime_options: Dict[str, Any] = Field(default_factory=dict)


class PerformanceScenarioCreateResponse(BaseModel):
    scenario: PerformanceScenarioSummary


class PerformanceRunCreate(BaseModel):
    scenario_id: int
    name: Optional[str] = Field(default=None, max_length=150)
    trigger_source: Literal["manual", "scheduled", "api"] = "manual"
    load_profile_override: Optional[Dict[str, Any]] = None
    runtime_options_override: Optional[Dict[str, Any]] = None


class PerformanceMetricPoint(ORMModel):
    id: int
    timestamp_offset: int
    active_users: int
    current_rps: float
    avg_response_time: float
    p95_response_time: float
    p99_response_time: float
    error_rate: float
    total_requests: int
    total_failures: int
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    worker_count: int
    spawned_users: int
    raw_data: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class PerformanceEventItem(ORMModel):
    id: int
    stage: str
    level: str
    message: str
    event_time: datetime
    payload: Optional[Dict[str, Any]] = None


class PerformanceRunStepResult(BaseModel):
    step_id: str
    name: str
    method: Optional[str] = None
    url: Optional[str] = None
    transaction_name: Optional[str] = None
    request_count: int = 0
    failure_count: int = 0
    avg_response_time: float = 0
    p95_response_time: float = 0
    last_status_code: Optional[int] = None
    last_error: Optional[str] = None
    extractor_preview: Dict[str, Any] = Field(default_factory=dict)


class PerformanceRunSummary(ORMModel):
    id: int
    run_no: str
    scenario_id: int
    scenario_name: str
    protocol: str
    status: str
    stage: str
    trigger_source: str
    current_users: int
    target_users: int
    spawn_rate: float
    duration_seconds: int
    progress: int
    current_rps: float
    avg_response_time: float
    p95_response_time: float
    p99_response_time: float
    error_rate: float
    worker_count: int
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime


class PerformanceRunDetail(PerformanceRunSummary):
    scenario_description: Optional[str] = None
    load_profile: Dict[str, Any] = Field(default_factory=dict)
    target_config: Dict[str, Any] = Field(default_factory=dict)
    runtime_options: Dict[str, Any] = Field(default_factory=dict)
    assertions: List[PerformanceAssertion] = Field(default_factory=list)
    steps: List[PerformanceScenarioStep] = Field(default_factory=list)
    variables: List[PerformanceVariableDefinition] = Field(default_factory=list)
    environment_config: Dict[str, Any] = Field(default_factory=dict)
    scenario_snapshot: Dict[str, Any] = Field(default_factory=dict)
    step_summary: List[PerformanceRunStepResult] = Field(default_factory=list)
    engine_metadata: Dict[str, Any] = Field(default_factory=dict)
    summary: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    metrics: List[PerformanceMetricPoint] = Field(default_factory=list)
    events: List[PerformanceEventItem] = Field(default_factory=list)


class PerformanceRunCreateResponse(BaseModel):
    run: PerformanceRunSummary


class PerformanceRunControlResponse(BaseModel):
    run_id: int
    status: str
    stage: str
    message: str


class PerformanceOverviewResponse(BaseModel):
    total_scenarios: int = 0
    active_scenarios: int = 0
    running_runs: int = 0
    completed_runs: int = 0
    latest_avg_response_time: float = 0
    latest_error_rate: float = 0
    protocol_distribution: Dict[str, int] = Field(default_factory=dict)


class PerformanceTrendPoint(BaseModel):
    label: str
    timestamp: Optional[str] = None
    rps: float = 0
    avg_response_time: float = 0
    error_rate: float = 0
    active_users: int = 0


class PerformanceTrendResponse(BaseModel):
    run_id: int
    points: List[PerformanceTrendPoint] = Field(default_factory=list)
