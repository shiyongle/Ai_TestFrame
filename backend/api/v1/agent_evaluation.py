from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from api.deps import get_agent_evaluation_service, get_database
from models.database_models import AgentEvaluationRun
from schemas.agent_evaluation_schemas import AgentEvaluationRunCreate, AgentEvaluationRunResponse
from services.agent_evaluation_service import AgentEvaluationService
from services.ai.llm_client import llm_client

router = APIRouter()


@router.get("/agent-evaluation/providers")
async def get_agent_evaluation_providers():
    llm_client.refresh_providers()
    return {"providers": llm_client.get_available_providers()}


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
    llm_client.refresh_providers()
    if payload.provider not in llm_client.get_available_providers():
        raise HTTPException(status_code=400, detail=f"模型提供商未配置或不可用: {payload.provider}")

    run = service.create_run(db, payload)
    background_tasks.add_task(service.execute_run, run.id)
    return service.serialize_run(run)
