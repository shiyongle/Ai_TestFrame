from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.orm import Session

from api.deps import get_database, get_ui_automation_service
from schemas.ui_automation_schemas import (
    UIAutomationCaseCreate,
    UIAutomationCaseCreateResponse,
    UIAutomationCaseDetail,
    UIAutomationCaseSummary,
    UIAutomationCaseUpdate,
    UIAutomationCreateTaskFromCaseRequest,
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


def _build_case_summary(case) -> UIAutomationCaseSummary:
    return UIAutomationCaseSummary.model_validate(case)


def _build_task_summary(task) -> UIAutomationTaskSummary:
    return UIAutomationTaskSummary.model_validate(task)


def _build_task_detail(task, steps, artifacts) -> UIAutomationTaskDetail:
    trace_artifact = next((item for item in artifacts if item.artifact_type == "trace"), None)
    replay_script = next((item for item in artifacts if item.artifact_type == "replay_script"), None)
    return UIAutomationTaskDetail(
        id=task.id,
        task_no=task.task_no,
        case_id=getattr(task, "case_id", None),
        name=task.name,
        target_url=task.target_url,
        auth_scheme=task.auth_scheme,
        status=task.status,
        progress=task.progress,
        executor=task.executor,
        debug_mode=bool(getattr(task, "debug_mode", False)),
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
        trace_artifact_name=trace_artifact.artifact_name if trace_artifact else None,
        replay_script_name=replay_script.artifact_name if replay_script else None,
    )


@router.get("/ui-automation/cases", response_model=list[UIAutomationCaseSummary])
async def list_ui_cases(
    project_id: int | None = Query(default=None),
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    cases = service.list_cases(db, project_id=project_id)
    return [_build_case_summary(item) for item in cases]


@router.get("/ui-automation/cases/{case_id}", response_model=UIAutomationCaseDetail)
async def get_ui_case(
    case_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    case = service.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化用例不存在")
    return UIAutomationCaseDetail.model_validate(case)


@router.post("/ui-automation/cases", response_model=UIAutomationCaseCreateResponse)
async def create_ui_case(
    payload: UIAutomationCaseCreate,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    case = service.create_case(db, payload)
    log_activity(db, action="create", module="UI自动化用例", target_name=case.name, detail=f"用例ID={case.id}")
    return UIAutomationCaseCreateResponse(case=_build_case_summary(case))


@router.put("/ui-automation/cases/{case_id}", response_model=UIAutomationCaseCreateResponse)
async def update_ui_case(
    case_id: int,
    payload: UIAutomationCaseUpdate,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    case = service.update_case(db, case_id, payload.model_dump(exclude_unset=True))
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化用例不存在")
    log_activity(db, action="update", module="UI自动化用例", target_name=case.name, detail=f"用例ID={case.id}")
    return UIAutomationCaseCreateResponse(case=_build_case_summary(case))


@router.delete("/ui-automation/cases/{case_id}")
async def delete_ui_case(
    case_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    case = service.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化用例不存在")
    success = service.delete_case(db, case_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化用例不存在")
    log_activity(db, action="delete", module="UI自动化用例", target_name=case.name, detail=f"用例ID={case.id}")
    return {"message": "用例删除成功"}


@router.post("/ui-automation/cases/{case_id}/run", response_model=UIAutomationTaskCreateResponse)
async def run_ui_case(
    case_id: int,
    payload: UIAutomationCreateTaskFromCaseRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    case = service.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化用例不存在")

    task = service.create_task_from_case(db, case, auto_start=payload.auto_start, debug_mode=payload.debug_mode)
    log_activity(db, action="execute", module="UI自动化用例", target_name=case.name, detail=f"用例ID={case.id}, 任务ID={task.id}")

    if payload.auto_start:
        service.mark_task_running(db, task)
        background_tasks.add_task(service.run_task_async, task.id)

    refreshed = service.get_task(db, task.id)
    return UIAutomationTaskCreateResponse(task=_build_task_summary(refreshed))


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


@router.get("/ui-automation/tasks", response_model=list[UIAutomationTaskSummary])
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


@router.delete("/ui-automation/tasks/{task_id}")
async def delete_ui_task(
    task_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_ui_automation_service),
):
    task = service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化任务不存在")
    if task.status == "running":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="任务执行中，暂不支持删除")

    success = service.delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UI 自动化任务不存在")

    log_activity(db, action="delete", module="UI自动化", target_name=task.name, detail=f"任务ID={task.id}")
    return {"message": "任务删除成功"}


@router.post("/ui-automation/generate-steps", response_model=UIAutomationGenerateStepsResponse)
async def generate_steps_from_nl(payload: UIAutomationGenerateStepsRequest):
    prompt = """
请将以下自然语言转化为结构化的 UI 自动化测试步骤。
自然语言要求：
"{natural_language}"

请严格返回一个 JSON 数组，每个元素包含：
- action: 必须是 "goto", "click", "fill", "assert", "sleep", "wait_for_visible", "wait_for_hidden", "wait_for_text" 之一。
- target: 目标站点的 URL、CSS/XPath 选择器；如果是 wait_for_text，则 target 可为空字符串，表示等待整页文本出现。
- value: 需要输入的值、断言内容、等待文本或等待秒数（如果不需要则留空字符串）。

生成规则：
- 仅输出当前执行器支持的 8 种动作，不要输出 press、hover、select、drag、upload 等动作。
- 如果是 fill，target 必须是明确可输入的 input/textarea/contenteditable 元素选择器，不要把按钮、容器、文本节点当作输入框。
- 如果页面存在异步渲染、接口加载、弹窗动画、搜索结果刷新等不稳定时机，可优先插入 wait_for_visible / wait_for_hidden / wait_for_text / sleep 步骤。
- sleep 的 value 必须是数字秒数，例如 "1"、"2"、"0.5"。
- wait_for_visible 与 wait_for_hidden 的 target 必须是明确选择器，value 留空字符串。
- wait_for_text 的 value 必须是要等待出现的文本；如果有稳定容器，可同时提供 target；如果没有稳定容器，target 留空字符串。
- 优先使用稳定、具体的选择器，例如 id、name、data-testid；避免使用容易变化的 class 组合或模糊层级。
- 如果页面是搜索/表单场景，fill 之后可视情况补充 wait_for_visible、click、assert 等步骤，保证流程闭环。
- assert 优先断言稳定可见的结果元素，不要断言瞬时态或容易变化的大段文本。
- 如果无法确定可靠选择器，宁可返回更保守、更短的步骤，不要臆造选择器。

例如：
[
    {{"action": "goto", "target": "https://example.com/", "value": ""}},
    {{"action": "wait_for_visible", "target": "#search", "value": ""}},
    {{"action": "fill", "target": "#search", "value": "手机"}},
    {{"action": "click", "target": "#submit", "value": ""}},
    {{"action": "wait_for_text", "target": "", "value": "搜索结果"}}
]

只返回 JSON 数组，不要返回任何其他内容（不要有 markdown 语法如 ```json）。
""".format(natural_language=payload.natural_language)
    providers = llm_client.get_available_providers()
    if not providers:
        raise HTTPException(status_code=500, detail="系统未配置任何大模型提供商")

    provider = providers[0]

    res = await llm_client.text_completion(prompt, temperature=0.1, provider=provider)

    if not res.get("success"):
        raise HTTPException(status_code=500, detail=f"AI 生成失败: {res.get('error')}")

    content = res.get("content", "").strip()
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
