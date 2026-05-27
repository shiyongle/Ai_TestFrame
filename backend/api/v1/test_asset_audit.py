from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.deps import get_database, get_test_asset_audit_service
from schemas.test_asset_audit_schemas import (
    AiCaseConfirmRequest,
    AssetApprovalRequest,
    AuditEventCreateRequest,
    BaselineCreateRequest,
    BaselineFreezeRequest,
)
from services.test_asset_audit_service import TestAssetAuditService

router = APIRouter()


@router.get("/test-assets/audit/summary")
async def get_asset_audit_summary(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_database),
    service: TestAssetAuditService = Depends(get_test_asset_audit_service),
):
    return service.summary(db, project_id=project_id)


@router.get("/test-assets/audit/assets")
async def list_test_assets(
    project_id: Optional[int] = Query(default=None),
    asset_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_database),
    service: TestAssetAuditService = Depends(get_test_asset_audit_service),
):
    return service.list_assets(db, project_id=project_id, asset_type=asset_type)


@router.get("/test-assets/audit/assets/{asset_type}/{asset_id}/versions")
async def list_asset_versions(
    asset_type: str,
    asset_id: int,
    db: Session = Depends(get_database),
    service: TestAssetAuditService = Depends(get_test_asset_audit_service),
):
    return service.list_versions(db, asset_type, asset_id)


@router.get("/test-assets/audit/versions/{version_id}/diff")
async def get_asset_version_diff(
    version_id: int,
    db: Session = Depends(get_database),
    service: TestAssetAuditService = Depends(get_test_asset_audit_service),
):
    try:
        return service.get_version_diff(db, version_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/test-assets/audit/versions/{version_id}/approval")
async def approve_asset_version(
    version_id: int,
    payload: AssetApprovalRequest,
    db: Session = Depends(get_database),
    service: TestAssetAuditService = Depends(get_test_asset_audit_service),
):
    try:
        return service.approve_version(db, version_id, payload.decision, payload.approver, payload.comment)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/test-assets/audit/ai-evidence/{evidence_id}/confirm")
async def confirm_ai_generated_case(
    evidence_id: int,
    payload: AiCaseConfirmRequest,
    db: Session = Depends(get_database),
    service: TestAssetAuditService = Depends(get_test_asset_audit_service),
):
    try:
        return service.confirm_ai_case(db, evidence_id, payload.approver, payload.comment)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/test-assets/audit/baselines")
async def list_asset_baselines(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_database),
    service: TestAssetAuditService = Depends(get_test_asset_audit_service),
):
    return service.list_baselines(db, project_id=project_id)


@router.post("/test-assets/audit/baselines")
async def create_asset_baseline(
    payload: BaselineCreateRequest,
    db: Session = Depends(get_database),
    service: TestAssetAuditService = Depends(get_test_asset_audit_service),
):
    try:
        refs = [item.model_dump() for item in payload.asset_refs] if payload.asset_refs else None
        return service.create_baseline(
            db,
            name=payload.name,
            project_id=payload.project_id,
            version_id=payload.version_id,
            description=payload.description,
            asset_refs=refs,
            freeze=payload.freeze,
            created_by=payload.created_by,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/test-assets/audit/baselines/{baseline_id}/freeze")
async def freeze_asset_baseline(
    baseline_id: int,
    payload: BaselineFreezeRequest,
    db: Session = Depends(get_database),
    service: TestAssetAuditService = Depends(get_test_asset_audit_service),
):
    try:
        return service.freeze_baseline(db, baseline_id, payload.frozen_by)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/test-assets/audit/events")
async def list_asset_audit_events(
    project_id: Optional[int] = Query(default=None),
    asset_type: Optional[str] = Query(default=None),
    asset_id: Optional[int] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_database),
    service: TestAssetAuditService = Depends(get_test_asset_audit_service),
):
    return service.list_events(db, project_id=project_id, asset_type=asset_type, asset_id=asset_id, limit=limit)


@router.post("/test-assets/audit/events")
async def record_external_audit_event(
    payload: AuditEventCreateRequest,
    db: Session = Depends(get_database),
    service: TestAssetAuditService = Depends(get_test_asset_audit_service),
):
    return service.record_audit_event(
        db,
        asset_type=payload.asset_type,
        asset_id=payload.asset_id,
        project_id=payload.project_id,
        action=payload.action,
        actor=payload.actor,
        detail=payload.detail,
        after_hash=payload.after_hash,
        metadata=payload.metadata,
    )
