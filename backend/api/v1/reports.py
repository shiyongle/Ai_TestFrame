from datetime import datetime, timedelta
import ast
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from models.database_models import TestReport, TestCase, InterfaceTestCase

router = APIRouter()


def _parse_summary(summary: Any) -> Dict[str, Any]:
    if isinstance(summary, dict):
        return summary
    if isinstance(summary, str) and summary.strip():
        text = summary.strip()
        try:
            return json.loads(text)
        except Exception:
            try:
                value = ast.literal_eval(text)
                return value if isinstance(value, dict) else {}
            except Exception:
                return {}
    return {}


def _calc_duration_ms(summary: Dict[str, Any], total_tests: int) -> int:
    direct_keys = ["total_duration_ms", "total_execution_time_ms", "duration_ms"]
    for key in direct_keys:
        value = summary.get(key)
        if isinstance(value, (int, float)):
            return int(max(0, value))

    avg_keys = ["average_execution_time", "avg_execution_time", "average_execution_time_ms"]
    for key in avg_keys:
        value = summary.get(key)
        if isinstance(value, (int, float)):
            return int(max(0, value) * max(0, total_tests))

    return 0


def _format_duration(ms: int) -> str:
    seconds = max(0, ms // 1000)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if hours > 0:
        return f"{hours}h {minutes}m"
    if minutes > 0:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


@router.get("/reports/overview/stats")
def get_reports_overview(
    start_date: Optional[str] = Query(default=None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(default=None, description="结束日期 YYYY-MM-DD"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """获取测试报告页真实数据（汇总、趋势、模块分布、报告列表）"""

    query = db.query(TestReport)

    if start_date:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        query = query.filter(TestReport.created_at >= start_dt)

    if end_date:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        query = query.filter(TestReport.created_at < end_dt)

    all_reports = query.order_by(TestReport.created_at.desc()).all()
    total_count = len(all_reports)

    total_tests = 0
    total_passed = 0
    total_failed = 0
    total_duration_ms = 0

    trend_map: Dict[str, Dict[str, Any]] = {}
    report_items = []

    for report in all_reports:
        summary = _parse_summary(report.summary)
        report_total = report.total_tests or 0
        report_passed = report.passed_tests or 0
        report_failed = (report.failed_tests or 0) + (report.error_tests or 0)
        report_skipped = summary.get("skipped_tests", 0)

        duration_ms = _calc_duration_ms(summary, report_total)

        total_tests += report_total
        total_passed += report_passed
        total_failed += report_failed
        total_duration_ms += duration_ms

        pass_rate = round((report_passed / report_total) * 100, 1) if report_total > 0 else 0
        if pass_rate >= 90:
            status = "success"
        elif pass_rate >= 70:
            status = "unstable"
        else:
            status = "failed"

        created_at = report.created_at or datetime.utcnow()
        date_key = created_at.strftime("%Y-%m-%d")
        if date_key not in trend_map:
            trend_map[date_key] = {"date": date_key, "passed": 0, "failed": 0, "total": 0}

        trend_map[date_key]["passed"] += report_passed
        trend_map[date_key]["failed"] += report_failed
        trend_map[date_key]["total"] += report_total

        report_items.append(
            {
                "id": report.id,
                "name": summary.get("report_name") or f"测试报告 #{report.id}",
                "date": created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "duration_ms": duration_ms,
                "duration": _format_duration(duration_ms),
                "total": report_total,
                "passed": report_passed,
                "failed": report_failed,
                "skipped": report_skipped,
                "pass_rate": pass_rate,
                "status": status,
                "executor": summary.get("executor") or "system",
                "project_id": report.project_id,
                "version_id": report.version_id,
            }
        )

    weighted_pass_rate = round((total_passed / total_tests) * 100, 1) if total_tests > 0 else 0

    # 趋势：返回最近7天，缺失日期补0
    today = datetime.utcnow().date()
    trend = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        key = day.strftime("%Y-%m-%d")
        trend.append(trend_map.get(key, {"date": key, "passed": 0, "failed": 0, "total": 0}))

    # 模块分布：优先使用接口用例 module 字段
    module_counter: Dict[str, int] = {}
    interface_rows = db.query(InterfaceTestCase.module).all()
    for (module_name,) in interface_rows:
        if module_name and module_name.strip():
            module_counter[module_name.strip()] = module_counter.get(module_name.strip(), 0) + 1

    if not module_counter:
        testcase_rows = db.query(TestCase.protocol).all()
        for (protocol,) in testcase_rows:
            label = protocol or "unknown"
            module_counter[label] = module_counter.get(label, 0) + 1

    module_distribution = [
        {"module": key, "count": value}
        for key, value in sorted(module_counter.items(), key=lambda item: item[1], reverse=True)
    ]

    paged_items = report_items[offset: offset + limit]

    return {
        "summary": {
            "total_executions": total_count,
            "avg_pass_rate": weighted_pass_rate,
            "bugs_found": total_failed,
            "total_duration_ms": total_duration_ms,
            "total_duration": _format_duration(total_duration_ms),
            "total_tests": total_tests,
            "total_passed": total_passed,
            "total_failed": total_failed,
        },
        "trend": trend,
        "module_distribution": module_distribution,
        "reports": paged_items,
        "pagination": {
            "total": total_count,
            "limit": limit,
            "offset": offset,
        },
    }
