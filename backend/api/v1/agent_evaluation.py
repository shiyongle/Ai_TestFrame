"""
Agent评测 API 路由（重构版）
支持：黄金测试集关联、被测Agent调用、LLM-as-Judge、人工标注
"""

from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from api.deps import get_agent_evaluation_service, get_model_config_service, get_database
from models.database_models import AgentEvaluationRun, DifyAgent, GoldenDataset
from schemas.agent_evaluation_schemas import (
    AgentEvaluationRunCreate,
    AgentEvaluationRunResponse,
    HumanLabelUpdate,
)
from services.agent_evaluation_service import AgentEvaluationService
from services.model_config_service import ModelConfigService
from services.ai.llm_client import llm_client

router = APIRouter()


@router.get("/agent-evaluation/providers")
async def get_agent_evaluation_providers(
    db: Session = Depends(get_database),
    model_config_service: ModelConfigService = Depends(get_model_config_service),
):
    """获取可用的模型提供商列表"""
    llm_client.refresh_providers()
    legacy_providers = llm_client.get_available_providers()
    config_providers = model_config_service.get_available_providers(db)
    # 获取被测Agent列表
    agents = db.query(DifyAgent).order_by(DifyAgent.id.desc()).all()
    # 获取黄金测试集列表
    datasets = db.query(GoldenDataset).order_by(GoldenDataset.id.desc()).all()
    return {
        "providers": legacy_providers,
        "model_configs": config_providers,
        "agents": [
            {"id": a.id, "name": a.name, "agent_type": a.agent_type, "base_url": a.base_url}
            for a in agents
        ],
        "datasets": [
            {"id": d.id, "name": d.name, "item_count": len(d.items) if hasattr(d, 'items') and d.items else 0}
            for d in datasets
        ],
    }


@router.get("/agent-evaluation/runs", response_model=List[AgentEvaluationRunResponse])
async def list_agent_evaluation_runs(
    limit: int = 20,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    runs = service.list_runs(db, limit=min(max(limit, 1), 100))
    return [service.serialize_run(run) for run in runs]


@router.get("/agent-evaluation/runs/{run_id}", response_model=AgentEvaluationRunResponse)
async def get_agent_evaluation_run(
    run_id: int,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    run = (
        db.query(AgentEvaluationRun)
        .options(selectinload(AgentEvaluationRun.items))
        .filter(AgentEvaluationRun.id == run_id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="评测记录不存在")
    return service.serialize_run(run)


@router.post("/agent-evaluation/runs", response_model=AgentEvaluationRunResponse)
async def create_agent_evaluation_run(
    payload: AgentEvaluationRunCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    """创建评测运行，支持黄金测试集+被测Agent"""
    try:
        run = service.create_run(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    background_tasks.add_task(service.execute_run, run.id)
    return service.serialize_run(run)


@router.delete("/agent-evaluation/runs/{run_id}")
async def delete_agent_evaluation_run(
    run_id: int,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    ok = service.delete_run(db, run_id)
    if not ok:
        raise HTTPException(status_code=404, detail="评测记录不存在")
    return {"message": "已删除"}


@router.put("/agent-evaluation/items/{item_id}/human-label")
async def update_human_label(
    item_id: int,
    payload: HumanLabelUpdate,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    """人工标注覆盖"""
    try:
        item = service.update_human_label(db, item_id, payload.human_label, payload.human_comment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not item:
        raise HTTPException(status_code=404, detail="评测条目不存在")
    return service.serialize_item(item)


@router.delete("/agent-evaluation/items/{item_id}/human-label")
async def clear_human_label(
    item_id: int,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    """撤销人工标注"""
    item = service.clear_human_label(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="评测条目不存在")
    return service.serialize_item(item)
