from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RequirementAssetLinkRequest(BaseModel):
    asset_type: str = Field(..., min_length=1, max_length=50)
    asset_id: int
    coverage_type: str = "regression"
    priority: str = "medium"
    source: str = "manual"
    confidence_score: float = 1.0


class RequirementAssetLinkBatchRequest(BaseModel):
    assets: List[RequirementAssetLinkRequest]


class TraceabilityMatrixQuery(BaseModel):
    project_id: Optional[int] = None
    version_id: Optional[int] = None
    status: Optional[str] = None
    coverage_status: Optional[str] = None


class RequirementStatusApplyRequest(BaseModel):
    status: str
    comment: str = ""


class RegressionPlanCreateRequest(BaseModel):
    owner: str = "QA"
    execution_mode: str = "serial"
    priority: str = "high"


class ImpactAnalysisRequest(BaseModel):
    old_content: Optional[Dict[str, Any]] = None
    new_content: Dict[str, Any]
