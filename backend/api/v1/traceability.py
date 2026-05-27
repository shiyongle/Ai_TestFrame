from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.deps import get_database, get_traceability_service
from schemas.traceability_schemas import RegressionPlanCreateRequest, RequirementAssetLinkBatchRequest, RequirementStatusApplyRequest
from services.traceability_service import TraceabilityService

router = APIRouter()


@router.get("/traceability/matrix")
async def get_traceability_matrix(
    project_id: Optional[int] = Query(default=None),
    version_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    coverage_status: Optional[str] = Query(default=None),
    db: Session = Depends(get_database),
    service: TraceabilityService = Depends(get_traceability_service),
):
    return service.list_matrix(
        db,
        project_id=project_id,
        version_id=version_id,
        status=status,
        coverage_status=coverage_status,
    )


@router.get("/traceability/impact-changes")
async def list_requirement_change_impacts(
    project_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_database),
    service: TraceabilityService = Depends(get_traceability_service),
):
    return service.list_change_impacts(db, project_id=project_id, limit=limit)


@router.post("/requirements/{requirement_id}/test-assets")
async def link_requirement_assets(
    requirement_id: int,
    payload: RequirementAssetLinkBatchRequest,
    db: Session = Depends(get_database),
    service: TraceabilityService = Depends(get_traceability_service),
):
    try:
        linked = service.link_assets(db, requirement_id, payload.assets)
        return {"success": True, "linked_count": len(linked)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/requirements/{requirement_id}/test-assets/{link_id}")
async def unlink_requirement_asset(
    requirement_id: int,
    link_id: int,
    db: Session = Depends(get_database),
    service: TraceabilityService = Depends(get_traceability_service),
):
    if not service.unlink_asset(db, requirement_id, link_id):
        raise HTTPException(status_code=404, detail="关联关系不存在")
    return {"success": True}


@router.get("/requirements/{requirement_id}/regression-recommendations")
async def get_regression_recommendations(
    requirement_id: int,
    db: Session = Depends(get_database),
    service: TraceabilityService = Depends(get_traceability_service),
):
    try:
        return service.get_regression_recommendations(db, requirement_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/requirements/{requirement_id}/impact-analysis")
async def get_requirement_impact_analysis(
    requirement_id: int,
    db: Session = Depends(get_database),
    service: TraceabilityService = Depends(get_traceability_service),
):
    try:
        return service.analyze_impact(db, requirement_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/requirements/{requirement_id}/regression-plan")
async def create_requirement_regression_plan(
    requirement_id: int,
    payload: RegressionPlanCreateRequest,
    db: Session = Depends(get_database),
    service: TraceabilityService = Depends(get_traceability_service),
):
    try:
        return service.create_regression_plan(
            db,
            requirement_id,
            owner=payload.owner,
            execution_mode=payload.execution_mode,
            priority=payload.priority,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/requirements/{requirement_id}/apply-suggested-status")
async def apply_requirement_suggested_status(
    requirement_id: int,
    payload: RequirementStatusApplyRequest,
    db: Session = Depends(get_database),
    service: TraceabilityService = Depends(get_traceability_service),
):
    try:
        requirement = service.apply_suggested_status(db, requirement_id, payload.status)
        return {"success": True, "requirement_id": requirement.id, "status": requirement.status}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
