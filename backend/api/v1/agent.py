from datetime import datetime, timedelta
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.deps import get_database, get_test_execution_service, get_test_plan_service
from models.database_models import InterfaceTestCase, Project, TestCase, TestPlan, TestResult
from utils.activity_logger import log_activity

router = APIRouter()


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="用户输入")
    session_id: Optional[str] = Field(default=None, description="会话ID")


class AgentChatResponse(BaseModel):
    success: bool = True
    intent: str
    reply: str
    data: Optional[Dict[str, Any]] = None


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", "", (text or "").strip().lower())


def _parse_plan_count(text: str) -> Optional[int]:
    patterns = [
        r"(\d+)\s*个\s*测试计划",
        r"执行\s*(\d+)\s*个",
        r"run\s*(\d+)\s*plans?",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return max(1, int(match.group(1)))
            except ValueError:
                return None
    return None


def _parse_project_name(raw_text: str) -> Optional[str]:
    # 示例：执行xxx项目的2个测试计划 / 帮我去执行xxx项目
    patterns = [
        r"执行\s*(.+?)\s*项目",
        r"帮我去执行\s*(.+?)\s*项目",
        r"run\s*project\s*[:：]?\s*([\w\-\u4e00-\u9fa5]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            name = (match.group(1) or "").strip().strip("“”\"'，,。")
            if name:
                return name
    return None


def _is_stats_query(normalized_text: str) -> bool:
    keywords = ["多少", "统计", "通过率", "测试用例", "接口自动化", "场景", "概览", "dashboard"]
    return any(k in normalized_text for k in keywords)


def _is_execute_plan_query(normalized_text: str) -> bool:
    if "测试计划" in normalized_text and ("执行" in normalized_text or "run" in normalized_text):
        return True
    return bool(re.search(r"run\s*plans?", normalized_text, re.IGNORECASE))


def _build_stats(db: Session) -> Dict[str, Any]:
    total_projects = db.query(func.count(Project.id)).scalar() or 0
    total_testcases = db.query(func.count(TestCase.id)).scalar() or 0
    total_interface_cases = db.query(func.count(InterfaceTestCase.id)).scalar() or 0
    total_test_plans = db.query(func.count(TestPlan.id)).scalar() or 0

    today = datetime.utcnow()
    week_start = today - timedelta(days=today.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    week_results = db.query(TestResult).filter(TestResult.executed_at >= week_start).all()
    total_runs_this_week = len(week_results)
    passed_this_week = sum(1 for r in week_results if str(r.status).lower() in {"success", "passed"})
    failed_this_week = total_runs_this_week - passed_this_week
    pass_rate = round((passed_this_week / total_runs_this_week) * 100, 1) if total_runs_this_week else 0.0

    return {
        "total_projects": total_projects,
        "total_testcases": total_testcases,
        "total_interface_testcases": total_interface_cases,
        "total_api_automation_scenarios": total_test_plans,
        "pass_rate": pass_rate,
        "passed_this_week": passed_this_week,
        "failed_this_week": failed_this_week,
        "total_runs_this_week": total_runs_this_week,
    }


@router.post("/agent/chat", response_model=AgentChatResponse)
async def agent_chat(
    payload: AgentChatRequest,
    request: Request,
    db: Session = Depends(get_database),
    plan_service=Depends(get_test_plan_service),
    execution_service=Depends(get_test_execution_service),
):
    raw_message = (payload.message or "").strip()
    if not raw_message:
        raise HTTPException(status_code=400, detail="message 不能为空")

    normalized_message = _normalize_text(raw_message)

    # 1) 执行测试计划意图
    if _is_execute_plan_query(normalized_message):
        project_name = _parse_project_name(raw_message)
        plan_count = _parse_plan_count(raw_message) or 1

        query = db.query(Project)
        if project_name:
            query = query.filter(Project.name.like(f"%{project_name}%"))

        project = query.order_by(Project.updated_at.desc()).first()
        if not project:
            return AgentChatResponse(
                success=True,
                intent="execute_test_plan",
                reply="未找到匹配的项目。请使用“执行xxx项目的2个测试计划”这种格式重试。",
                data={"project_name": project_name, "executed_count": 0},
            )

        plans = (
            db.query(TestPlan)
            .filter(TestPlan.project_id == project.id)
            .order_by(TestPlan.updated_at.desc(), TestPlan.id.desc())
            .all()
        )

        if not plans:
            return AgentChatResponse(
                success=True,
                intent="execute_test_plan",
                reply=f"项目【{project.name}】下没有可执行的测试计划。",
                data={"project_id": project.id, "project_name": project.name, "executed_count": 0},
            )

        selected_plans = plans[:plan_count]
        execution_results: List[Dict[str, Any]] = []

        for plan in selected_plans:
            execution = await plan_service.execute_test_plan(db, plan.id, execution_service)
            execution_results.append(
                {
                    "plan_id": plan.id,
                    "plan_name": plan.name,
                    "execution_id": execution.id if execution else None,
                    "status": execution.status if execution else "failed",
                    "passed_items": execution.passed_items if execution else 0,
                    "failed_items": execution.failed_items if execution else 0,
                    "error_items": execution.error_items if execution else 0,
                }
            )

        user = getattr(getattr(request, "state", None), "user", {}) or {}
        username = user.get("username", "system")
        log_activity(
            db,
            action="execute",
            module="Agent执行",
            target_name=project.name,
            detail=f"会话执行测试计划 {len(selected_plans)} 个",
            user=username,
            status="success",
        )

        success_count = sum(1 for item in execution_results if item["status"] in {"completed", "completed_with_issues"})
        lines = [
            f"已执行项目【{project.name}】的 {len(selected_plans)} 个测试计划。",
            f"成功发起并完成: {success_count}/{len(selected_plans)}。",
        ]
        for idx, item in enumerate(execution_results, start=1):
            lines.append(
                f"{idx}. {item['plan_name']} -> 状态: {item['status']}，通过/失败/错误: "
                f"{item['passed_items']}/{item['failed_items']}/{item['error_items']}"
            )

        return AgentChatResponse(
            success=True,
            intent="execute_test_plan",
            reply="\n".join(lines),
            data={
                "project_id": project.id,
                "project_name": project.name,
                "requested_count": plan_count,
                "executed_count": len(selected_plans),
                "items": execution_results,
                "refresh_dashboard": True,
            },
        )

    # 2) 统计查询意图
    if _is_stats_query(normalized_message):
        stats = _build_stats(db)
        reply = (
            "当前系统统计如下：\n"
            f"- 测试用例总数：{stats['total_testcases']}\n"
            f"- 接口自动化场景（测试计划）总数：{stats['total_api_automation_scenarios']}\n"
            f"- 接口测试用例总数：{stats['total_interface_testcases']}\n"
            f"- 本周执行总次数：{stats['total_runs_this_week']}\n"
            f"- 本周通过率：{stats['pass_rate']}%（通过 {stats['passed_this_week']} / 失败 {stats['failed_this_week']}）"
        )
        return AgentChatResponse(success=True, intent="query_stats", reply=reply, data=stats)

    # 3) 默认兜底
    return AgentChatResponse(
        success=True,
        intent="fallback",
        reply=(
            "我目前支持两类操作：\n"
            "1) 统计查询：例如“系统内有多少测试用例，接口自动化场景多少，通过率是多少”\n"
            "2) 执行计划：例如“帮我执行支付项目的2个测试计划”"
        ),
        data={"supported_intents": ["query_stats", "execute_test_plan"]},
    )
