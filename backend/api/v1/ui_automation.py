import asyncio
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.orm import Session

from api.deps import get_database, get_ui_automation_service
from schemas.ui_automation_schemas import (
    UIAutomationSolidifyResponse,
    UIAutomationStartResponse,
    UIAutomationTaskCreate,
    UIAutomationTaskCreateResponse,
    UIAutomationTaskDetail,
    UIAutomationTaskSummary,
)
from utils.activity_logger import log_activity

router = APIRouter()


def _build_task_summary(task) -> UIAutomationTaskSummary:
    return UIAutomationTaskSummary.model_validate(task)


def _build_task_detail(task, steps, artifacts) -> UIAutomationTaskDetail:
    return UIAutomationTaskDetail(
        id=task.id,
        task_no=task.task_no,
        name=task.name,
        target_url=task.target_url,
        auth_scheme=task.auth_scheme,
        status=task.status,
        progress=task.progress,
        executor=task.executor,
        created_at=task.created_at,
        started_at=task.started_at,
        finished_at=task.finished_at,
        error_message=task.error_message,
        auth_payload=task.auth_payload or {},
        natural_language_steps=task.natural_language_steps or [],
        assertions=task.assertions or [],
        step_logs=steps,
        artifacts=artifacts,
        playwright_script=task.playwright_script,
    )


@router.post("/ui-automation/tasks", response_model=UIAutomationTaskCreateResponse)
async def create_ui_task(
    payload: UIAutomationTaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    task = service.create_task(db, payload)
    log_activity(db, action="create", module="UI自动化", target_name=task.name, detail=f"任务ID={task.id}")

    if payload.auto_start:
        service.mark_task_running(db, task)
        background_tasks.add_task(service.run_task_async, task.id)

    refreshed = service.get_task(db, task.id)
    return UIAutomationTaskCreateResponse(task=_build_task_summary(refreshed))


@router.get("/ui-automation/tasks", response_model=List[UIAutomationTaskSummary])
async def list_ui_tasks(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    tasks = service.list_tasks(db, limit=limit)
    return [_build_task_summary(item) for item in tasks]


@router.get("/ui-automation/tasks/{task_id}", response_model=UIAutomationTaskDetail)
async def get_ui_task_detail(
    task_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    task = service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化任务不存在")
    steps = service.get_task_steps(db, task_id)
    artifacts = service.get_task_artifacts(db, task_id)
    return _build_task_detail(task, steps, artifacts)


@router.post("/ui-automation/tasks/{task_id}/start", response_model=UIAutomationStartResponse)
async def start_ui_task(
    task_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    task = service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化任务不存在")

    if task.status == "running":
        return UIAutomationStartResponse(task_id=task.id, status=task.status, message="任务已在执行中")

    service.mark_task_running(db, task)
    background_tasks.add_task(service.run_task_async, task.id)
    log_activity(db, action="execute", module="UI自动化", target_name=task.name, detail=f"任务ID={task.id}")
    latest = service.get_task(db, task.id)
    return UIAutomationStartResponse(task_id=latest.id, status=latest.status, message="任务已启动")


@router.post("/ui-automation/tasks/{task_id}/solidify", response_model=UIAutomationSolidifyResponse)
async def solidify_ui_task(
    task_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    task = service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化任务不存在")

    result = service.solidify_to_playwright(db, task)
    log_activity(
        db,
        action="generate",
        module="UI自动化",
        target_name=task.name,
        detail=f"固化为脚本: {result['script_name']}",
    )
    return UIAutomationSolidifyResponse(task_id=task.id, **result)
