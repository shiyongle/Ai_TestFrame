"""
模型配置管理 API 路由
管理 Agent 评测使用的 LLM 模型配置
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_database, get_model_config_service
from schemas.model_config_schemas import (
    ModelConfigCreate,
    ModelConfigResponse,
    ModelConfigUpdate,
)
from services.model_config_service import ModelConfigService

router = APIRouter()


@router.get("/model-configs", response_model=List[ModelConfigResponse])
async def list_model_configs(
    enabled_only: bool = False,
    db: Session = Depends(get_database),
    service: ModelConfigService = Depends(get_model_config_service),
):
    configs = service.list_configs(db, enabled_only=enabled_only)
    return [service.serialize_config(c) for c in configs]


@router.get("/model-configs/{config_id}", response_model=ModelConfigResponse)
async def get_model_config(
    config_id: int,
    db: Session = Depends(get_database),
    service: ModelConfigService = Depends(get_model_config_service),
):
    config = service.get_config(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="模型配置不存在")
    return service.serialize_config(config)


@router.post("/model-configs", response_model=ModelConfigResponse)
async def create_model_config(
    payload: ModelConfigCreate,
    db: Session = Depends(get_database),
    service: ModelConfigService = Depends(get_model_config_service),
):
    try:
        config = service.create_config(db, payload)
        return service.serialize_config(config)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/model-configs/{config_id}", response_model=ModelConfigResponse)
async def update_model_config(
    config_id: int,
    payload: ModelConfigUpdate,
    db: Session = Depends(get_database),
    service: ModelConfigService = Depends(get_model_config_service),
):
    config = service.update_config(db, config_id, payload)
    if not config:
        raise HTTPException(status_code=404, detail="模型配置不存在")
    return service.serialize_config(config)


@router.delete("/model-configs/{config_id}")
async def delete_model_config(
    config_id: int,
    db: Session = Depends(get_database),
    service: ModelConfigService = Depends(get_model_config_service),
):
    success = service.delete_config(db, config_id)
    if not success:
        raise HTTPException(status_code=404, detail="模型配置不存在")
    return {"success": True}


@router.get("/model-configs/providers")
async def get_available_providers(
    db: Session = Depends(get_database),
    service: ModelConfigService = Depends(get_model_config_service),
):
    """获取所有已启用的模型配置，按提供商分组"""
    providers = service.get_available_providers(db)
    return {"providers": providers}