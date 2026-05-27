from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.deps import get_database, get_environment_service
from schemas.environment_schemas import (
    AccountPoolCreate,
    AccountPoolUpdate,
    DataPoolCreate,
    DataPoolUpdate,
    EnvironmentCreate,
    EnvironmentUpdate,
    EnvironmentVariableCreate,
    EnvironmentVariableUpdate,
)
from services.environment_service import EnvironmentService

router = APIRouter()


@router.get("/environments")
async def list_environments(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    return service.list_environments(db, project_id=project_id)


@router.post("/environments")
async def create_environment(
    payload: EnvironmentCreate,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    return service.serialize_environment(service.create_environment(db, payload.model_dump()), include_children=True)


@router.put("/environments/{environment_id}")
async def update_environment(
    environment_id: int,
    payload: EnvironmentUpdate,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    env = service.update_environment(db, environment_id, payload.model_dump(exclude_unset=True))
    if not env:
        raise HTTPException(status_code=404, detail="执行环境不存在")
    return service.serialize_environment(env, include_children=True)


@router.delete("/environments/{environment_id}")
async def delete_environment(
    environment_id: int,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    if not service.delete_environment(db, environment_id):
        raise HTTPException(status_code=404, detail="执行环境不存在")
    return {"success": True}


@router.post("/environments/{environment_id}/variables")
async def create_variable(
    environment_id: int,
    payload: EnvironmentVariableCreate,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    try:
        return service.serialize_variable(service.create_variable(db, environment_id, payload.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/environment-variables/{variable_id}")
async def update_variable(
    variable_id: int,
    payload: EnvironmentVariableUpdate,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    item = service.update_variable(db, variable_id, payload.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=404, detail="环境变量不存在")
    return service.serialize_variable(item)


@router.delete("/environment-variables/{variable_id}")
async def delete_variable(
    variable_id: int,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    if not service.delete_variable(db, variable_id):
        raise HTTPException(status_code=404, detail="环境变量不存在")
    return {"success": True}


@router.post("/environments/{environment_id}/account-pools")
async def create_account_pool(
    environment_id: int,
    payload: AccountPoolCreate,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    try:
        return service.serialize_account_pool(service.create_account_pool(db, environment_id, payload.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/environment-account-pools/{pool_id}")
async def update_account_pool(
    pool_id: int,
    payload: AccountPoolUpdate,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    item = service.update_account_pool(db, pool_id, payload.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=404, detail="账号池不存在")
    return service.serialize_account_pool(item)


@router.delete("/environment-account-pools/{pool_id}")
async def delete_account_pool(
    pool_id: int,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    if not service.delete_account_pool(db, pool_id):
        raise HTTPException(status_code=404, detail="账号池不存在")
    return {"success": True}


@router.post("/environments/{environment_id}/data-pools")
async def create_data_pool(
    environment_id: int,
    payload: DataPoolCreate,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    try:
        return service.serialize_data_pool(service.create_data_pool(db, environment_id, payload.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/environment-data-pools/{pool_id}")
async def update_data_pool(
    pool_id: int,
    payload: DataPoolUpdate,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    item = service.update_data_pool(db, pool_id, payload.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=404, detail="数据池不存在")
    return service.serialize_data_pool(item)


@router.delete("/environment-data-pools/{pool_id}")
async def delete_data_pool(
    pool_id: int,
    db: Session = Depends(get_database),
    service: EnvironmentService = Depends(get_environment_service),
):
    if not service.delete_data_pool(db, pool_id):
        raise HTTPException(status_code=404, detail="数据池不存在")
    return {"success": True}
