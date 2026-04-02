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
    UIAutomationGenerateStepsRequest,
    UIAutomationGenerateStepsResponse,
)
from services.ai.llm_client import llm_client
import json
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


@router.post("/ui-automation/tasks/{task_id}/pause", response_model=UIAutomationStartResponse)
async def pause_task(
    task_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    task = service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化任务不存在")
    if task.status != "running":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="任务当前不是运行状态，无法暂停")

    updated_task = service.pause_task(db, task_id)
    log_activity(db, action="execute", module="UI自动化", target_name=task.name, detail=f"任务ID={task.id} 暂停运行")
    return UIAutomationStartResponse(task_id=updated_task.id, status=updated_task.status, message="任务已暂停")

@router.post("/ui-automation/tasks/{task_id}/resume", response_model=UIAutomationStartResponse)
async def resume_task(
    task_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    task = service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化任务不存在")
    if task.status != "paused":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="任务当前不是暂停状态，无法恢复")

    updated_task = service.resume_task(db, task_id)
    log_activity(db, action="execute", module="UI自动化", target_name=task.name, detail=f"任务ID={task.id} 恢复运行")
    return UIAutomationStartResponse(task_id=updated_task.id, status=updated_task.status, message="任务已恢复执行")

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

@router.post("/ui-automation/generate-steps", response_model=UIAutomationGenerateStepsResponse)
async def generate_steps_from_nl(payload: UIAutomationGenerateStepsRequest):
    prompt = f"""
请将以下自然语言转化为结构化的 UI 自动化测试步骤。
自然语言要求：
"{payload.natural_language}"

请严格返回一个 JSON 数组，每个元素包含：
- action: 必须是 "goto", "click", "fill", "assert" 之一。
- target: 目标站点的 URL 或 CSS/XPath 选择器（如果不需要则留空字符串）。
- value: 需要输入的值或断言的内容（如果不需要则留空字符串）。

例如：
[
    {{"action": "goto", "target": "https://example.com/", "value": ""}},
    {{"action": "fill", "target": "#search", "value": "手机"}},
    {{"action": "click", "target": "#submit", "value": ""}}
]

只返回 JSON 数组，不要返回任何其他内容（不要有 markdown 语法如 ```json）。
"""
    providers = llm_client.get_available_providers()
    if not providers:
        raise HTTPException(status_code=500, detail="系统未配置任何大模型提供商")
    
    provider = providers[0]
    
    res = await llm_client.text_completion(prompt, temperature=0.1, provider=provider)
    
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=f"AI 生成失败: {res.get('error')}")
        
    content = res.get("content", "").strip()
    # 移除可能存在的 markdown 代码块
    if content.startswith("```json"):
        content = content[7:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()
    
    try:
        steps = json.loads(content)
        return UIAutomationGenerateStepsResponse(steps=steps)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI 返回的格式错误，无法解析为 JSON")

