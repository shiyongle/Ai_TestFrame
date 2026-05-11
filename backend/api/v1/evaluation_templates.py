"""
评测模板管理 API 路由
参考 xapp 的 evaluation-templates API 架构
"""

from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from api.deps import get_database, get_evaluation_template_service, get_agent_evaluation_service
from models.database_models import AgentEvaluationTemplate
from schemas.agent_evaluation_schemas import (
    AgentEvaluationCreate,
    AgentEvaluationResponse,
    AgentEvaluationTemplateCreate,
    AgentEvaluationTemplateResponse,
    AgentEvaluationTemplateUpdate,
)
from services.evaluation_template_service import EvaluationTemplateService
from services.agent_evaluation_service import AgentEvaluationService

router = APIRouter()


# ============ 评测模板 CRUD ============

@router.get("/evaluation-templates", response_model=List[AgentEvaluationTemplateResponse])
async def list_evaluation_templates(
    keyword: str = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_database),
    service: EvaluationTemplateService = Depends(get_evaluation_template_service),
):
    """列出评测模板，支持关键词搜索和分页"""
    templates, total = service.list_templates(db, keyword=keyword, limit=limit, offset=offset)
    # 需要加载关联的 model_config
    result = []
    for t in templates:
        full_template = db.query(AgentEvaluationTemplate).options(
            selectinload(AgentEvaluationTemplate.model_config),
        ).filter(AgentEvaluationTemplate.id == t.id).first()
        result.append(service.serialize_template(db, full_template))
    return result


@router.get("/evaluation-templates/count")
async def get_evaluation_templates_count(
    keyword: str = None,
    db: Session = Depends(get_database),
    service: EvaluationTemplateService = Depends(get_evaluation_template_service),
):
    """获取评测模板总数"""
    _, total = service.list_templates(db, keyword=keyword, limit=0, offset=0)
    return {"total": total}


@router.get("/evaluation-templates/{template_id}", response_model=AgentEvaluationTemplateResponse)
async def get_evaluation_template(
    template_id: int,
    db: Session = Depends(get_database),
    service: EvaluationTemplateService = Depends(get_evaluation_template_service),
):
    template = db.query(AgentEvaluationTemplate).options(
        selectinload(AgentEvaluationTemplate.model_config),
    ).filter(AgentEvaluationTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="评测模板不存在")
    return service.serialize_template(db, template)


@router.post("/evaluation-templates", response_model=AgentEvaluationTemplateResponse)
async def create_evaluation_template(
    payload: AgentEvaluationTemplateCreate,
    db: Session = Depends(get_database),
    service: EvaluationTemplateService = Depends(get_evaluation_template_service),
):
    try:
        template = service.create_template(db, payload)
        # 重新查询以获取关联数据
        full_template = db.query(AgentEvaluationTemplate).options(
            selectinload(AgentEvaluationTemplate.model_config),
        ).filter(AgentEvaluationTemplate.id == template.id).first()
        return service.serialize_template(db, full_template)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/evaluation-templates/{template_id}", response_model=AgentEvaluationTemplateResponse)
async def update_evaluation_template(
    template_id: int,
    payload: AgentEvaluationTemplateUpdate,
    db: Session = Depends(get_database),
    service: EvaluationTemplateService = Depends(get_evaluation_template_service),
):
    try:
        template = service.update_template(db, template_id, payload)
        if not template:
            raise HTTPException(status_code=404, detail="评测模板不存在")
        # 重新查询以获取关联数据
        full_template = db.query(AgentEvaluationTemplate).options(
            selectinload(AgentEvaluationTemplate.model_config),
        ).filter(AgentEvaluationTemplate.id == template.id).first()
        return service.serialize_template(db, full_template)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/evaluation-templates/{template_id}")
async def delete_evaluation_template(
    template_id: int,
    db: Session = Depends(get_database),
    service: EvaluationTemplateService = Depends(get_evaluation_template_service),
):
    success = service.delete_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="评测模板不存在")
    return {"success": True}


# ============ 单条评测（基于模板） ============

@router.get("/agent-evaluations", response_model=List[AgentEvaluationResponse])
async def list_agent_evaluations(
    template_id: int = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    """列出单条评测记录"""
    evaluations, total = service.list_evaluations(db, template_id=template_id, limit=limit, offset=offset)
    return [service.serialize_evaluation(e) for e in evaluations]


@router.get("/agent-evaluations/{evaluation_id}", response_model=AgentEvaluationResponse)
async def get_agent_evaluation(
    evaluation_id: int,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    evaluation = service.get_evaluation(db, evaluation_id)
    if not evaluation:
        raise HTTPException(status_code=404, detail="评测记录不存在")
    return service.serialize_evaluation(evaluation)


@router.post("/agent-evaluations", response_model=AgentEvaluationResponse)
async def create_agent_evaluation(
    payload: AgentEvaluationCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_database),
    service: AgentEvaluationService = Depends(get_agent_evaluation_service),
):
    """创建单条评测并异步执行"""
    try:
        evaluation = service.create_evaluation(db, payload)
        background_tasks.add_task(service.execute_evaluation, evaluation.id)
        return service.serialize_evaluation(evaluation)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))