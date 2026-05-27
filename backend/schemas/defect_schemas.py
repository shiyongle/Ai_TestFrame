from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class DefectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    severity: str = "major"
    priority: str = "P2"
    source_type: str = "manual"
    requirement_id: Optional[int] = None
    project_id: Optional[int] = None
    report_id: Optional[int] = None
    testcase_id: Optional[int] = None
    interface_testcase_id: Optional[int] = None
    assigned_to: Optional[str] = None
    sync_external: bool = False


class DefectFromReportCreate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: str = "major"
    priority: str = "P2"
    assigned_to: Optional[str] = None
    sync_external: bool = False


class DefectUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None


class DefectTransition(BaseModel):
    status: str
    comment: str = ""
    sync_external: bool = False


class DefectRegressionVerify(BaseModel):
    passed: bool
    report_id: Optional[int] = None
    notes: str = ""
    sync_external: bool = False


class DefectExternalSync(BaseModel):
    external_status: Optional[str] = None
    external_key: Optional[str] = None
    external_url: Optional[str] = None
    raw_payload: Optional[Dict[str, Any]] = None


class DefectHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    defect_id: int
    from_status: Optional[str] = None
    to_status: str
    action: str
    operator: Optional[str] = None
    comment: Optional[str] = None
    external_status: Optional[str] = None
    created_at: datetime


class DefectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    severity: str
    priority: str
    status: str
    source_type: str
    project_id: Optional[int] = None
    requirement_id: Optional[int] = None
    report_id: Optional[int] = None
    testcase_id: Optional[int] = None
    interface_testcase_id: Optional[int] = None
    external_provider: Optional[str] = None
    external_key: Optional[str] = None
    external_url: Optional[str] = None
    external_status: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    regression_status: str
    regression_report_id: Optional[int] = None
    regression_notes: Optional[str] = None
    created_by: Optional[str] = None
    assigned_to: Optional[str] = None
    resolved_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    histories: List[DefectHistoryResponse] = []
