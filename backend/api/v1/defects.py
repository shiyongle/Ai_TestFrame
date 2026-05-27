from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from api.deps import get_database, get_defect_service
from schemas.defect_schemas import (
    DefectCreate,
    DefectExternalSync,
    DefectFromReportCreate,
    DefectRegressionVerify,
    DefectResponse,
    DefectTransition,
    DefectUpdate,
)
from services.defect_service import DefectService

router = APIRouter()


def _operator(request: Request) -> str:
    user = getattr(request.state, "user", {}) or {}
    return user.get("sub") or user.get("username") or "system"


@router.get("/defects", response_model=List[DefectResponse])
async def list_defects(
    status: Optional[str] = Query(default=None),
    project_id: Optional[int] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_database),
    service: DefectService = Depends(get_defect_service),
):
    defects = service.list_defects(db, status=status, project_id=project_id, keyword=keyword, limit=limit, offset=offset)
    return [service.serialize_defect(item) for item in defects]


@router.get("/defects/{defect_id}", response_model=DefectResponse)
async def get_defect(
    defect_id: int,
    db: Session = Depends(get_database),
    service: DefectService = Depends(get_defect_service),
):
    defect = service.get_defect(db, defect_id)
    if not defect:
        raise HTTPException(status_code=404, detail="缺陷不存在")
    return service.serialize_defect(defect)


@router.post("/defects", response_model=DefectResponse)
async def create_defect(
    payload: DefectCreate,
    request: Request,
    db: Session = Depends(get_database),
    service: DefectService = Depends(get_defect_service),
):
    try:
        defect = service.create_defect(db, payload, _operator(request))
        return service.serialize_defect(defect)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/reports/{report_id}/defects", response_model=DefectResponse)
async def create_defect_from_report(
    report_id: int,
    payload: DefectFromReportCreate,
    request: Request,
    db: Session = Depends(get_database),
    service: DefectService = Depends(get_defect_service),
):
    try:
        defect = service.create_from_report(db, report_id, payload, _operator(request))
        return service.serialize_defect(defect)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/defects/{defect_id}", response_model=DefectResponse)
async def update_defect(
    defect_id: int,
    payload: DefectUpdate,
    request: Request,
    db: Session = Depends(get_database),
    service: DefectService = Depends(get_defect_service),
):
    defect = service.update_defect(db, defect_id, payload, _operator(request))
    if not defect:
        raise HTTPException(status_code=404, detail="缺陷不存在")
    return service.serialize_defect(defect)


@router.post("/defects/{defect_id}/transition", response_model=DefectResponse)
async def transition_defect(
    defect_id: int,
    payload: DefectTransition,
    request: Request,
    db: Session = Depends(get_database),
    service: DefectService = Depends(get_defect_service),
):
    try:
        defect = service.transition_defect(db, defect_id, payload, _operator(request))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not defect:
        raise HTTPException(status_code=404, detail="缺陷不存在")
    return service.serialize_defect(defect)


@router.post("/defects/{defect_id}/regression", response_model=DefectResponse)
async def verify_defect_regression(
    defect_id: int,
    payload: DefectRegressionVerify,
    request: Request,
    db: Session = Depends(get_database),
    service: DefectService = Depends(get_defect_service),
):
    defect = service.verify_regression(db, defect_id, payload, _operator(request))
    if not defect:
        raise HTTPException(status_code=404, detail="缺陷不存在")
    return service.serialize_defect(defect)


@router.post("/defects/{defect_id}/external-sync", response_model=DefectResponse)
async def sync_external_defect_status(
    defect_id: int,
    payload: DefectExternalSync,
    request: Request,
    db: Session = Depends(get_database),
    service: DefectService = Depends(get_defect_service),
):
    defect = service.sync_external_status(db, defect_id, payload, _operator(request))
    if not defect:
        raise HTTPException(status_code=404, detail="缺陷不存在")
    return service.serialize_defect(defect)


@router.post("/defects/{defect_id}/pull-external", response_model=DefectResponse)
async def pull_external_defect_status(
    defect_id: int,
    request: Request,
    db: Session = Depends(get_database),
    service: DefectService = Depends(get_defect_service),
):
    try:
        defect = service.pull_external_status(db, defect_id, _operator(request))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not defect:
        raise HTTPException(status_code=404, detail="缺陷不存在")
    return service.serialize_defect(defect)


@router.post("/defects/integrations/test")
async def test_defect_integration(
    db: Session = Depends(get_database),
    service: DefectService = Depends(get_defect_service),
):
    try:
        return service.test_integration(db)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
