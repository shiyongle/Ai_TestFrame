from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.deps import get_database
from services.ai_quality_governance_service import ai_quality_governance_service


router = APIRouter()


class PromptCreate(BaseModel):
    name: str = Field(..., max_length=150)
    prompt_type: str = "testcase_generation"
    version: str = "v1"
    system_prompt: Optional[str] = None
    user_prompt: str
    model_config_id: Optional[int] = None
    status: str = "draft"
    change_log: Optional[str] = None
    metrics: Optional[dict] = None
    created_by: str = "system"


class ReviewCreate(BaseModel):
    source_type: str = "manual"
    source_id: Optional[int] = None
    prompt_version_id: Optional[int] = None
    model_config_id: Optional[int] = None
    title: str
    content: Optional[dict] = None
    status: str = "pending"
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None


class ReviewUpdate(BaseModel):
    status: Optional[str] = None
    quality_score: Optional[float] = None
    hallucination_score: Optional[float] = None
    hallucination_flags: Optional[list] = None
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None


class BudgetCreate(BaseModel):
    name: str
    provider: str
    model: str
    period_month: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    token_budget: int = 0
    cost_budget: float = 0
    used_tokens: int = 0
    used_cost: float = 0
    alert_threshold: float = 0.8
    enabled: bool = True


class ExperimentCreate(BaseModel):
    name: str
    prompt_a_id: Optional[int] = None
    prompt_b_id: Optional[int] = None
    model_a_id: Optional[int] = None
    model_b_id: Optional[int] = None
    metric_name: str = "quality_score"
    sample_size: int = 0
    result_summary: Optional[dict] = None
    winner: Optional[str] = None
    status: str = "draft"


@router.get("/ai-quality/overview")
async def get_overview(db: Session = Depends(get_database)):
    return ai_quality_governance_service.overview(db)


@router.get("/ai-quality/prompts")
async def list_prompts(prompt_type: Optional[str] = Query(default=None), db: Session = Depends(get_database)):
    return ai_quality_governance_service.list_prompts(db, prompt_type=prompt_type)


@router.post("/ai-quality/prompts")
async def create_prompt(payload: PromptCreate, db: Session = Depends(get_database)):
    return ai_quality_governance_service.create_prompt(db, payload.model_dump())


@router.post("/ai-quality/prompts/{prompt_id}/activate")
async def activate_prompt(prompt_id: int, db: Session = Depends(get_database)):
    try:
        return ai_quality_governance_service.activate_prompt(db, prompt_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/ai-quality/reviews")
async def list_reviews(
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_database),
):
    return ai_quality_governance_service.list_reviews(db, status=status, limit=limit)


@router.post("/ai-quality/reviews")
async def create_review(payload: ReviewCreate, db: Session = Depends(get_database)):
    return ai_quality_governance_service.create_review(db, payload.model_dump())


@router.put("/ai-quality/reviews/{review_id}")
async def update_review(review_id: int, payload: ReviewUpdate, db: Session = Depends(get_database)):
    try:
        return ai_quality_governance_service.update_review(db, review_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/ai-quality/budgets")
async def list_budgets(db: Session = Depends(get_database)):
    return ai_quality_governance_service.list_budgets(db)


@router.post("/ai-quality/budgets")
async def create_budget(payload: BudgetCreate, db: Session = Depends(get_database)):
    return ai_quality_governance_service.create_budget(db, payload.model_dump())


@router.post("/ai-quality/budgets/sync-usage")
async def sync_budget_usage(db: Session = Depends(get_database)):
    return ai_quality_governance_service.sync_budget_usage(db)


@router.get("/ai-quality/experiments")
async def list_experiments(db: Session = Depends(get_database)):
    return ai_quality_governance_service.list_experiments(db)


@router.post("/ai-quality/experiments")
async def create_experiment(payload: ExperimentCreate, db: Session = Depends(get_database)):
    return ai_quality_governance_service.create_experiment(db, payload.model_dump())


@router.get("/ai-quality/knowledge-scans")
async def list_knowledge_scans(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_database),
):
    return ai_quality_governance_service.list_knowledge_scans(db, limit=limit)


@router.post("/ai-quality/knowledge-scans/run")
async def run_knowledge_scan(
    max_docs: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_database),
):
    return ai_quality_governance_service.scan_knowledge(db, max_docs=max_docs)
