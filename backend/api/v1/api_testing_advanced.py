from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.deps import get_api_testing_advanced_service, get_database
from services.api_testing_advanced_service import ApiTestingAdvancedService

router = APIRouter()


class CollectionCreate(BaseModel):
    name: str = Field(..., max_length=150)
    project_id: int
    description: Optional[str] = None
    environment_id: Optional[int] = None
    pre_script: Optional[str] = None
    post_script: Optional[str] = None
    tags: Optional[list] = None
    status: str = "active"
    created_by: str = "system"
    items: Optional[list] = None


class CollectionRunRequest(BaseModel):
    environment_id: Optional[int] = None
    iterations: int = Field(1, ge=1, le=50)
    data_pool_id: Optional[int] = None


class DocsSyncRequest(BaseModel):
    docs_url: str = Field(..., max_length=1000)
    project_id: int
    module: Optional[str] = None
    max_cases: int = Field(300, ge=1, le=1000)


class MockCreate(BaseModel):
    project_id: int
    name: str
    mock_key: str
    method: str = "GET"
    path: str
    status_code: int = 200
    headers: Optional[dict] = None
    response_body: Optional[object] = None
    delay_ms: int = 0
    enabled: bool = True


class ContractCreate(BaseModel):
    interface_testcase_id: int
    name: str
    expected_status_codes: Optional[list] = None
    response_schema: Optional[dict] = None
    enabled: bool = True


class MonitorCreate(BaseModel):
    name: str
    interface_testcase_id: int
    environment_id: Optional[int] = None
    interval_seconds: int = 300
    enabled: bool = True


@router.get("/api-advanced/assets/summary")
async def get_api_asset_summary(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    return service.asset_summary(db, project_id=project_id)


@router.get("/api-advanced/collections")
async def list_collections(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    return service.list_collections(db, project_id=project_id)


@router.post("/api-advanced/collections")
async def create_collection(
    payload: CollectionCreate,
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    return service.create_collection(db, payload.model_dump())


@router.post("/api-advanced/collections/{collection_id}/run")
async def run_collection(
    collection_id: int,
    payload: CollectionRunRequest,
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    try:
        return await service.run_collection(
            db,
            collection_id,
            environment_id=payload.environment_id,
            iterations=payload.iterations,
            data_pool_id=payload.data_pool_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/api-advanced/runs")
async def list_runs(
    collection_id: Optional[int] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    return service.list_runs(db, collection_id=collection_id, limit=limit)


@router.post("/api-advanced/docs/sync")
async def sync_api_document(
    payload: DocsSyncRequest,
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    try:
        return await service.sync_openapi_document(
            db,
            docs_url=payload.docs_url,
            project_id=payload.project_id,
            module=payload.module,
            max_cases=payload.max_cases,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"接口文档同步失败: {exc}") from exc


@router.get("/api-advanced/mocks")
async def list_mocks(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    return service.list_mocks(db, project_id=project_id)


@router.post("/api-advanced/mocks")
async def create_mock(
    payload: MockCreate,
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    data = payload.model_dump()
    data["method"] = data["method"].upper()
    if not data["path"].startswith("/"):
        data["path"] = "/" + data["path"]
    return service.create_mock(db, data)


@router.api_route("/api-advanced/mock/{mock_key}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
async def serve_mock(
    mock_key: str,
    path: str,
    request: Request,
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    mock = await service.serve_mock(db, mock_key, request.method, path)
    if not mock:
        raise HTTPException(status_code=404, detail="Mock endpoint not found")
    return JSONResponse(
        status_code=mock["status_code"],
        content=mock["response_body"],
        headers={str(k): str(v) for k, v in (mock.get("headers") or {}).items()},
    )


@router.get("/api-advanced/contracts")
async def list_contracts(
    interface_testcase_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    return service.list_contracts(db, interface_testcase_id=interface_testcase_id)


@router.post("/api-advanced/contracts")
async def create_contract(
    payload: ContractCreate,
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    return service.create_contract(db, payload.model_dump())


@router.get("/api-advanced/monitors")
async def list_monitors(
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    return service.list_monitors(db)


@router.post("/api-advanced/monitors")
async def create_monitor(
    payload: MonitorCreate,
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    return service.create_monitor(db, payload.model_dump())


@router.post("/api-advanced/monitors/{probe_id}/run")
async def run_monitor(
    probe_id: int,
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    try:
        return await service.run_monitor(db, probe_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/api-advanced/changes")
async def list_interface_changes(
    project_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_database),
    service: ApiTestingAdvancedService = Depends(get_api_testing_advanced_service),
):
    return service.list_change_logs(db, project_id=project_id, limit=limit)
