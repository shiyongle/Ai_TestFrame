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

    # 获取被测Agent列表（兼容迁移前）
    agents_data = []
    try:
        agents = db.query(DifyAgent).order_by(DifyAgent.id.desc()).all()
        agents_data = [
            {
                "id": a.id,
                "name": a.name,
                "agent_type": getattr(a, "agent_type", "dify") or "dify",
                "base_url": a.base_url,
            }
            for a in agents
        ]
    except Exception:
        db.rollback()

    # 获取黄金测试集列表
    datasets_data = []
    try:
        datasets = (
            db.query(GoldenDataset)
            .options(selectinload(GoldenDataset.items))
            .order_by(GoldenDataset.id.desc())
            .all()
        )
        datasets_data = [
            {"id": d.id, "name": d.name, "item_count": len(d.items) if d.items else 0}
            for d in datasets
        ]
    except Exception:
        db.rollback()

    return {
        "providers": legacy_providers,
        "model_configs": config_providers,
        "agents": agents_data,
        "datasets": datasets_data,
    }


@router.get("/agent-evaluation/runs")
async def list_agent_evaluation_runs(
    limit: int = 20,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    """获取评测运行列表"""
    try:
        runs = service.list_runs(db, limit=min(max(limit, 1), 100))
        return {
            "success": True,
            "data": [service.serialize_run(run) for run in runs],
            "total": len(runs)
        }
    except Exception as e:
        import logging
        logging.error(f"获取评测列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取评测列表失败: {str(e)}")


@router.get("/agent-evaluation/runs/{run_id}")
async def get_agent_evaluation_run(
    run_id: int,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    """获取单个评测运行详情"""
    try:
        run = (
            db.query(AgentEvaluationRun)
            .options(
                selectinload(AgentEvaluationRun.items),
                selectinload(AgentEvaluationRun.dataset),
                selectinload(AgentEvaluationRun.agent),
            )
            .filter(AgentEvaluationRun.id == run_id)
            .first()
        )
        if not run:
            raise HTTPException(status_code=404, detail="评测记录不存在")
        return {
            "success": True,
            "data": service.serialize_run(run)
        }
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"获取评测详情失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取评测详情失败: {str(e)}")


@router.post("/agent-evaluation/runs")
async def create_agent_evaluation_run(
    payload: AgentEvaluationRunCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    """创建评测运行，支持黄金测试集+被测Agent"""
    try:
        run = service.create_run(db, payload)
        background_tasks.add_task(service.execute_run, run.id)
        return {
            "success": True,
            "data": service.serialize_run(run),
            "message": "评测任务已创建，正在后台执行"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import logging
        logging.error(f"创建评测任务失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建评测任务失败: {str(e)}")


@router.delete("/agent-evaluation/runs/{run_id}")
async def delete_agent_evaluation_run(
    run_id: int,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    """删除评测运行"""
    try:
        ok = service.delete_run(db, run_id)
        if not ok:
            raise HTTPException(status_code=404, detail="评测记录不存在")
        return {"success": True, "message": "已删除"}
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"删除评测记录失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除评测记录失败: {str(e)}")


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
        if not item:
            raise HTTPException(status_code=404, detail="评测条目不存在")
        return {
            "success": True,
            "data": service.serialize_item(item),
            "message": "人工标注已更新"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"更新人工标注失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新人工标注失败: {str(e)}")


@router.delete("/agent-evaluation/items/{item_id}/human-label")
async def clear_human_label(
    item_id: int,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    """撤销人工标注"""
    try:
        item = service.clear_human_label(db, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="评测条目不存在")
        return {
            "success": True,
            "data": service.serialize_item(item),
            "message": "人工标注已撤销"
        }
    except Exception as e:
        import logging
        logging.error(f"撤销人工标注失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"撤销人工标注失败: {str(e)}")
