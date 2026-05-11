"""
BadCase & DifyAgent 管理 API 路由
参考 xapp 的 agents + badcases API 架构
"""

from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from api.deps import get_database, get_dify_agent_service, get_bad_case_service, get_agent_evaluation_service
from models.database_models import BadCase, DifyAgent
from schemas.badcase_schemas import (
    BadCaseCreate,
    BadCaseResponse,
    BadCaseTurnResponse,
    BadCaseTurnUpdate,
    BadCaseUpdate,
    DifyAgentCreate,
    DifyAgentResponse,
    DifyAgentUpdate,
)
from services.badcase_service import DifyAgentService, BadCaseService
from services.agent_evaluation_service import AgentEvaluationService

router = APIRouter()


# ============ DifyAgent 管理 ============

@router.get("/dify-agents", response_model=List[DifyAgentResponse])
async def list_dify_agents(
    db: Session = Depends(get_database),
    service: DifyAgentService = Depends(get_dify_agent_service),
):
    agents = service.list_agents(db)
    return [service.serialize_agent(a) for a in agents]


@router.get("/dify-agents/{agent_id}", response_model=DifyAgentResponse)
async def get_dify_agent(
    agent_id: int,
    db: Session = Depends(get_database),
    service: DifyAgentService = Depends(get_dify_agent_service),
):
    agent = service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="智能体不存在")
    return service.serialize_agent(agent)


@router.post("/dify-agents", response_model=DifyAgentResponse)
async def create_dify_agent(
    payload: DifyAgentCreate,
    db: Session = Depends(get_database),
    service: DifyAgentService = Depends(get_dify_agent_service),
):
    try:
        agent = service.create_agent(db, payload)
        return service.serialize_agent(agent)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/dify-agents/{agent_id}", response_model=DifyAgentResponse)
async def update_dify_agent(
    agent_id: int,
    payload: DifyAgentUpdate,
    db: Session = Depends(get_database),
    service: DifyAgentService = Depends(get_dify_agent_service),
):
    agent = service.update_agent(db, agent_id, payload)
    if not agent:
        raise HTTPException(status_code=404, detail="智能体不存在")
    return service.serialize_agent(agent)


@router.delete("/dify-agents/{agent_id}")
async def delete_dify_agent(
    agent_id: int,
    db: Session = Depends(get_database),
    service: DifyAgentService = Depends(get_dify_agent_service),
):
    success = service.delete_agent(db, agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="智能体不存在")
    return {"success": True}


# ============ BadCase 管理 ============

@router.get("/bad-cases", response_model=List[BadCaseResponse])
async def list_bad_cases(
    agent_id: int = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_database),
    service: BadCaseService = Depends(get_bad_case_service),
):
    """列出不良案例，支持按 agent_id 筛选和分页"""
    cases, total = service.list_bad_cases(db, agent_id=agent_id, limit=limit, offset=offset)
    # 需要加载关联数据
    cases_with_details = []
    for case in cases:
        # 重新查询以获取关联数据
        full_case = db.query(BadCase).options(
            selectinload(BadCase.agent),
            selectinload(BadCase.turns),
        ).filter(BadCase.id == case.id).first()
        if full_case:
            cases_with_details.append(service.serialize_bad_case(full_case))
    return cases_with_details


@router.get("/bad-cases/count")
async def get_bad_cases_count(
    agent_id: int = None,
    db: Session = Depends(get_database),
    service: BadCaseService = Depends(get_bad_case_service),
):
    """获取不良案例总数"""
    _, total = service.list_bad_cases(db, agent_id=agent_id, limit=0, offset=0)
    return {"total": total}


@router.get("/bad-cases/{case_id}", response_model=BadCaseResponse)
async def get_bad_case(
    case_id: int,
    db: Session = Depends(get_database),
    service: BadCaseService = Depends(get_bad_case_service),
):
    case = db.query(BadCase).options(
        selectinload(BadCase.agent),
        selectinload(BadCase.turns),
    ).filter(BadCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="不良案例不存在")
    return service.serialize_bad_case(case)


@router.post("/bad-cases", response_model=BadCaseResponse)
async def create_bad_case(
    payload: BadCaseCreate,
    db: Session = Depends(get_database),
    service: BadCaseService = Depends(get_bad_case_service),
):
    try:
        case = service.create_bad_case(db, payload)
        # 重新查询以获取关联数据
        full_case = db.query(BadCase).options(
            selectinload(BadCase.agent),
            selectinload(BadCase.turns),
        ).filter(BadCase.id == case.id).first()
        return service.serialize_bad_case(full_case)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/bad-cases/{case_id}", response_model=BadCaseResponse)
async def update_bad_case(
    case_id: int,
    payload: BadCaseUpdate,
    db: Session = Depends(get_database),
    service: BadCaseService = Depends(get_bad_case_service),
):
    case = service.update_bad_case(db, case_id, payload)
    if not case:
        raise HTTPException(status_code=404, detail="不良案例不存在")
    # 重新查询以获取关联数据
    full_case = db.query(BadCase).options(
        selectinload(BadCase.agent),
        selectinload(BadCase.turns),
    ).filter(BadCase.id == case.id).first()
    return service.serialize_bad_case(full_case)


@router.delete("/bad-cases/{case_id}")
async def delete_bad_case(
    case_id: int,
    db: Session = Depends(get_database),
    service: BadCaseService = Depends(get_bad_case_service),
):
    success = service.delete_bad_case(db, case_id)
    if not success:
        raise HTTPException(status_code=404, detail="不良案例不存在")
    return {"success": True}


# ============ BadCaseTurn 管理 ============

@router.put("/bad-case-turns/{turn_id}", response_model=BadCaseTurnResponse)
async def update_bad_case_turn(
    turn_id: int,
    payload: BadCaseTurnUpdate,
    db: Session = Depends(get_database),
    service: BadCaseService = Depends(get_bad_case_service),
):
    turn = service.update_turn(db, turn_id, payload)
    if not turn:
        raise HTTPException(status_code=404, detail="轮次不存在")
    return service.serialize_turn(turn)


@router.delete("/bad-case-turns/{turn_id}")
async def delete_bad_case_turn(
    turn_id: int,
    db: Session = Depends(get_database),
    service: BadCaseService = Depends(get_bad_case_service),
):
    success = service.delete_turn(db, turn_id)
    if not success:
        raise HTTPException(status_code=404, detail="轮次不存在")
    return {"success": True}


@router.post("/bad-case-turns/{turn_id}/evaluate")
async def evaluate_bad_case_turn(
    turn_id: int,
    template_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_database),
    service: BadCaseService = Depends(get_bad_case_service),
    eval_service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    """对 BadCaseTurn 进行评测"""
    turn = db.query(BadCaseTurn).filter(BadCaseTurn.id == turn_id).first()
    if not turn:
        raise HTTPException(status_code=404, detail="轮次不存在")

    from schemas.agent_evaluation_schemas import AgentEvaluationCreate
    payload = AgentEvaluationCreate(
        template_id=template_id,
        bad_case_turn_id=turn_id,
        query=turn.query,
        answer=turn.answer,
        expected_answer=turn.expected_answer,
    )
    try:
        evaluation = eval_service.create_evaluation(db, payload)
        background_tasks.add_task(eval_service.execute_evaluation, evaluation.id)
        return eval_service.serialize_evaluation(evaluation)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))