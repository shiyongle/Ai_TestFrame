from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from core.database import get_db
from models.database_models import (
    Project, TestCase, TestResult, Requirement,
    ActivityLog, BatchTestTask
)
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()


@router.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """获取首页仪表盘统计数据"""

    # 1. 总项目数
    total_projects = db.query(func.count(Project.id)).scalar() or 0

    # 2. 本周起止时间
    today = datetime.utcnow()
    week_start = today - timedelta(days=today.weekday())  # 本周一
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    # 3. 本周测试结果（接口测试用例）
    week_results = db.query(TestResult).filter(
        TestResult.executed_at >= week_start
    ).all()

    total_runs_this_week = len(week_results)
    passed_this_week = sum(1 for r in week_results if r.status == "success")
    failed_this_week = total_runs_this_week - passed_this_week
    pass_rate = round(passed_this_week / total_runs_this_week * 100, 1) if total_runs_this_week > 0 else 0

    # 4. 总测试用例数（接口 testcases 表）
    total_testcases = db.query(func.count(TestCase.id)).scalar() or 0

    # 5. 功能测试用例（来自 AI 生成，存在 test_suites 里，套件下的用例）
    # 暂时仅用 testcases 数量（功能用例单独统计后续扩展）
    total_all_cases = total_testcases

    return {
        "total_projects": total_projects,
        "total_testcases": total_all_cases,
        "pass_rate": pass_rate,
        "passed_this_week": passed_this_week,
        "failed_this_week": failed_this_week,
        "total_runs_this_week": total_runs_this_week,
    }


@router.get("/dashboard/activities")
def get_activity_logs(
    limit: int = Query(default=8, le=100),
    offset: int = Query(default=0),
    db: Session = Depends(get_db)
):
    """获取最近的操作动态"""
    total = db.query(func.count(ActivityLog.id)).scalar() or 0
    logs = (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "items": [
            {
                "id": log.id,
                "user": log.user,
                "action": log.action,
                "module": log.module,
                "target_name": log.target_name,
                "detail": log.detail,
                "status": log.status,
                "created_at": log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else "",
            }
            for log in logs
        ]
    }
