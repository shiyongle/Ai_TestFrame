import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from models.database_models import (
    Defect,
    InterfaceTestCase,
    QualityExecutionResult,
    Requirement,
    RequirementChangeLog,
    RequirementTestAsset,
    TestCase,
    TestPlan,
    TestPlanFunctionalCase,
    TestPlanInterfaceCase,
    TestResult,
    VersionRequirement,
)
from schemas.traceability_schemas import RequirementAssetLinkRequest


PASSED_STATUSES = {"passed", "pass", "success", "ok"}
FAILED_STATUSES = {"failed", "fail", "error", "blocked"}


class TraceabilityService:
    def list_matrix(
        self,
        db: Session,
        project_id: Optional[int] = None,
        version_id: Optional[int] = None,
        status: Optional[str] = None,
        coverage_status: Optional[str] = None,
    ) -> Dict[str, Any]:
        requirements = self._load_requirements(db, project_id, version_id, status)
        rows = [self._build_requirement_row(db, req, version_id) for req in requirements]
        if coverage_status:
            rows = [row for row in rows if row["coverage_status"] == coverage_status]

        total = len(rows)
        covered = len([row for row in rows if row["coverage_status"] != "uncovered"])
        executed = len([row for row in rows if row["execution_status"] != "not_run"])
        failed = len([row for row in rows if row["execution_status"] in {"failed", "error"} or row["open_defects"] > 0])
        high_risk = len([row for row in rows if row["risk_level"] == "high"])

        return {
            "summary": {
                "total_requirements": total,
                "covered_requirements": covered,
                "uncovered_requirements": total - covered,
                "coverage_rate": round(covered / total * 100, 1) if total else 0,
                "executed_requirements": executed,
                "execution_rate": round(executed / total * 100, 1) if total else 0,
                "failed_requirements": failed,
                "high_risk_requirements": high_risk,
                "open_defects": sum(row["open_defects"] for row in rows),
            },
            "rows": rows,
        }

    def link_assets(self, db: Session, requirement_id: int, assets: List[RequirementAssetLinkRequest]) -> List[RequirementTestAsset]:
        requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
        if not requirement:
            raise ValueError("需求不存在")

        linked = []
        for payload in assets:
            existing = db.query(RequirementTestAsset).filter(
                RequirementTestAsset.requirement_id == requirement_id,
                RequirementTestAsset.asset_type == payload.asset_type,
                RequirementTestAsset.asset_id == payload.asset_id,
            ).first()
            if existing:
                existing.coverage_type = payload.coverage_type
                existing.priority = payload.priority
                existing.source = payload.source
                existing.confidence_score = payload.confidence_score
                linked.append(existing)
                continue
            asset = RequirementTestAsset(
                requirement_id=requirement_id,
                asset_type=payload.asset_type,
                asset_id=payload.asset_id,
                coverage_type=payload.coverage_type,
                priority=payload.priority,
                source=payload.source,
                confidence_score=payload.confidence_score,
            )
            db.add(asset)
            linked.append(asset)
        self._sync_requirement_counts(db, requirement)
        db.commit()
        return linked

    def unlink_asset(self, db: Session, requirement_id: int, asset_id: int) -> bool:
        asset = db.query(RequirementTestAsset).filter(
            RequirementTestAsset.requirement_id == requirement_id,
            RequirementTestAsset.id == asset_id,
        ).first()
        if not asset:
            return False
        requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
        db.delete(asset)
        if requirement:
            self._sync_requirement_counts(db, requirement)
        db.commit()
        return True

    def get_regression_recommendations(self, db: Session, requirement_id: int) -> Dict[str, Any]:
        requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
        if not requirement:
            raise ValueError("需求不存在")
        row = self._build_requirement_row(db, requirement, None)
        keywords = self._extract_keywords(requirement.title, requirement.description, requirement.acceptance_criteria or "")
        direct_assets = row["assets"]
        related_interface_cases = self._find_related_interface_cases(db, requirement.project_id, keywords)
        related_functional_cases = self._find_related_functional_cases(db, requirement.project_id, keywords)
        return {
            "requirement_id": requirement.id,
            "keywords": keywords,
            "recommendations": direct_assets + related_interface_cases + related_functional_cases,
            "reasons": [
                "直接关联需求的测试资产优先回归",
                "标题、描述、验收标准命中的同项目用例建议补充回归",
                "存在未关闭缺陷或最近失败的需求应提高回归优先级",
            ],
        }

    def create_regression_plan(
        self,
        db: Session,
        requirement_id: int,
        owner: str = "QA",
        execution_mode: str = "serial",
        priority: str = "high",
    ) -> Dict[str, Any]:
        requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
        if not requirement:
            raise ValueError("需求不存在")
        recommendations = self.get_regression_recommendations(db, requirement_id)
        functional_ids = []
        interface_ids = []
        for item in recommendations["recommendations"]:
            if item["asset_type"] == "functional_case" and item["asset_id"] not in functional_ids:
                functional_ids.append(item["asset_id"])
            if item["asset_type"] == "interface_case" and item["asset_id"] not in interface_ids:
                interface_ids.append(item["asset_id"])
        if not functional_ids and not interface_ids:
            raise ValueError("暂无可生成测试计划的回归用例")

        plan = TestPlan(
            name=f"REQ-{requirement.id} 回归计划 {datetime.utcnow().strftime('%Y%m%d%H%M')}",
            description=f"由质量追踪矩阵根据需求《{requirement.title}》自动生成。\n关键词：{', '.join(recommendations['keywords'])}",
            project_id=requirement.project_id,
            owner=owner,
            status="ready",
            execution_mode=execution_mode,
            priority=priority,
            entry_criteria="需求变更已确认，相关缺陷已进入待回归状态。",
            exit_criteria="推荐回归范围全部执行完成，失败项已关联缺陷。",
            tags=["regression", "traceability", f"requirement:{requirement.id}"],
        )
        db.add(plan)
        db.flush()
        for index, case_id in enumerate(functional_ids):
            db.add(TestPlanFunctionalCase(test_plan_id=plan.id, testcase_id=case_id, order_index=index))
        for index, case_id in enumerate(interface_ids):
            db.add(TestPlanInterfaceCase(test_plan_id=plan.id, interface_testcase_id=case_id, order_index=index))
        db.commit()
        db.refresh(plan)
        return {
            "id": plan.id,
            "name": plan.name,
            "project_id": plan.project_id,
            "functional_case_ids": functional_ids,
            "interface_case_ids": interface_ids,
            "total_case_count": len(functional_ids) + len(interface_ids),
        }

    def analyze_impact(self, db: Session, requirement_id: int) -> Dict[str, Any]:
        requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
        if not requirement:
            raise ValueError("需求不存在")
        latest_change = db.query(RequirementChangeLog).filter(
            RequirementChangeLog.requirement_id == requirement_id
        ).order_by(RequirementChangeLog.created_at.desc()).first()
        keywords = latest_change.impact_keywords if latest_change and latest_change.impact_keywords else self._extract_keywords(
            requirement.title, requirement.description, requirement.acceptance_criteria or ""
        )
        recommendations = self.get_regression_recommendations(db, requirement_id)
        return {
            "requirement_id": requirement_id,
            "changed_fields": latest_change.changed_fields if latest_change else [],
            "impact_keywords": keywords,
            "recommended_regression": recommendations["recommendations"],
            "missing_case_suggestions": self._missing_case_suggestions(requirement, recommendations["recommendations"], keywords),
            "impact_level": self._calc_impact_level(requirement, recommendations["recommendations"]),
        }

    def list_change_impacts(self, db: Session, project_id: Optional[int] = None, limit: int = 50) -> Dict[str, Any]:
        query = db.query(RequirementChangeLog).order_by(RequirementChangeLog.created_at.desc())
        if project_id:
            query = query.filter(RequirementChangeLog.project_id == project_id)
        logs = query.limit(limit).all()
        items = []
        for log in logs:
            requirement = db.query(Requirement).filter(Requirement.id == log.requirement_id).first()
            if not requirement:
                continue
            impact = self.analyze_impact(db, requirement.id)
            items.append({
                "change_id": log.id,
                "requirement_id": requirement.id,
                "requirement_title": requirement.title,
                "project_id": log.project_id,
                "changed_fields": log.changed_fields or [],
                "impact_keywords": impact["impact_keywords"],
                "impact_level": impact["impact_level"],
                "recommended_count": len(impact["recommended_regression"]),
                "missing_suggestion_count": len(impact["missing_case_suggestions"]),
                "created_at": log.created_at,
            })
        return {
            "items": items,
            "summary": {
                "total_changes": len(items),
                "high_impact": len([item for item in items if item["impact_level"] == "high"]),
                "medium_impact": len([item for item in items if item["impact_level"] == "medium"]),
                "low_impact": len([item for item in items if item["impact_level"] == "low"]),
            },
        }

    def record_requirement_change(
        self,
        db: Session,
        requirement: Requirement,
        old_content: Dict[str, Any],
        new_content: Dict[str, Any],
        operator: str = "system",
    ) -> None:
        changed_fields = [key for key, value in new_content.items() if old_content.get(key) != value]
        if not changed_fields:
            return
        keywords = self._extract_keywords(
            str(new_content.get("title", "")),
            str(new_content.get("description", "")),
            str(new_content.get("acceptance_criteria", "")),
        )
        db.add(
            RequirementChangeLog(
                requirement_id=requirement.id,
                project_id=requirement.project_id,
                old_content=old_content,
                new_content=new_content,
                changed_fields=changed_fields,
                impact_keywords=keywords,
                operator=operator,
            )
        )

    def apply_suggested_status(self, db: Session, requirement_id: int, status: str) -> Requirement:
        requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
        if not requirement:
            raise ValueError("需求不存在")
        requirement.status = status
        requirement.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(requirement)
        return requirement

    def _load_requirements(
        self,
        db: Session,
        project_id: Optional[int],
        version_id: Optional[int],
        status: Optional[str],
    ) -> List[Requirement]:
        query = db.query(Requirement)
        if project_id:
            query = query.filter(Requirement.project_id == project_id)
        if version_id:
            req_ids = db.query(VersionRequirement.requirement_id).filter(VersionRequirement.version_id == version_id)
            query = query.filter(Requirement.id.in_(req_ids))
        if status:
            query = query.filter(Requirement.status == status)
        return query.order_by(Requirement.updated_at.desc()).all()

    def _build_requirement_row(self, db: Session, requirement: Requirement, version_id: Optional[int]) -> Dict[str, Any]:
        assets = self._load_assets(db, requirement)
        latest_results = [self._latest_result_for_asset(db, asset, version_id) for asset in assets]
        latest_results = [result for result in latest_results if result]
        execution_status = self._aggregate_execution_status(assets, latest_results)
        open_defects = self._count_open_defects(db, requirement, assets)
        coverage_status = "uncovered" if not assets else "covered"
        suggested_status = self._suggest_requirement_status(coverage_status, execution_status, open_defects)
        risk_level = self._risk_level(requirement, coverage_status, execution_status, open_defects)
        pass_rate = self._pass_rate(latest_results)
        return {
            "requirement_id": requirement.id,
            "title": requirement.title,
            "project_id": requirement.project_id,
            "status": requirement.status,
            "priority": requirement.priority,
            "type": requirement.type,
            "coverage_status": coverage_status,
            "asset_count": len(assets),
            "automation_asset_count": len([a for a in assets if a["asset_type"] in {"interface_case", "ui_case", "performance_scenario", "agent_dataset"}]),
            "execution_status": execution_status,
            "pass_rate": pass_rate,
            "open_defects": open_defects,
            "risk_level": risk_level,
            "suggested_status": suggested_status,
            "assets": assets,
            "latest_results": latest_results,
            "updated_at": requirement.updated_at,
        }

    def _load_assets(self, db: Session, requirement: Requirement) -> List[Dict[str, Any]]:
        rows = db.query(RequirementTestAsset).filter(RequirementTestAsset.requirement_id == requirement.id).all()
        assets = [self._serialize_asset(db, row) for row in rows]
        seen = {(item["asset_type"], item["asset_id"]) for item in assets}
        for legacy in requirement.linked_test_cases or []:
            asset_type, asset_id = self._parse_legacy_asset(legacy)
            if asset_type and asset_id and (asset_type, asset_id) not in seen:
                assets.append(self._serialize_asset_ref(db, asset_type, asset_id, "legacy"))
                seen.add((asset_type, asset_id))
        return assets

    def _serialize_asset(self, db: Session, row: RequirementTestAsset) -> Dict[str, Any]:
        item = self._serialize_asset_ref(db, row.asset_type, row.asset_id, row.source)
        item.update({
            "link_id": row.id,
            "coverage_type": row.coverage_type,
            "priority": row.priority,
            "confidence_score": row.confidence_score,
        })
        return item

    def _serialize_asset_ref(self, db: Session, asset_type: str, asset_id: int, source: str) -> Dict[str, Any]:
        name = f"{asset_type} #{asset_id}"
        if asset_type == "functional_case":
            case = db.query(TestCase).filter(TestCase.id == asset_id).first()
            if case:
                name = case.name
        elif asset_type == "interface_case":
            case = db.query(InterfaceTestCase).filter(InterfaceTestCase.id == asset_id).first()
            if case:
                name = case.name
        return {"asset_type": asset_type, "asset_id": asset_id, "name": name, "source": source}

    def _parse_legacy_asset(self, legacy: Any) -> Tuple[Optional[str], Optional[int]]:
        if not isinstance(legacy, dict):
            return None, None
        raw_type = legacy.get("asset_type") or legacy.get("type") or legacy.get("case_type") or "functional_case"
        raw_id = legacy.get("asset_id") or legacy.get("id") or legacy.get("testcase_id") or legacy.get("case_id")
        type_map = {
            "functional": "functional_case",
            "testcase": "functional_case",
            "interface": "interface_case",
            "api": "interface_case",
        }
        try:
            return type_map.get(str(raw_type), str(raw_type)), int(raw_id)
        except Exception:
            return None, None

    def _latest_result_for_asset(self, db: Session, asset: Dict[str, Any], version_id: Optional[int]) -> Optional[Dict[str, Any]]:
        persisted = db.query(QualityExecutionResult).filter(
            QualityExecutionResult.asset_type == asset["asset_type"],
            QualityExecutionResult.asset_id == asset["asset_id"],
        )
        if version_id:
            persisted = persisted.filter(QualityExecutionResult.version_id == version_id)
        result = persisted.order_by(QualityExecutionResult.executed_at.desc()).first()
        if result:
            return {
                "asset_type": result.asset_type,
                "asset_id": result.asset_id,
                "status": result.status,
                "executed_at": result.executed_at,
                "report_id": result.report_id,
            }

        if asset["asset_type"] == "functional_case":
            test_result = db.query(TestResult).filter(TestResult.testcase_id == asset["asset_id"]).order_by(TestResult.executed_at.desc()).first()
            if test_result:
                return {
                    "asset_type": asset["asset_type"],
                    "asset_id": asset["asset_id"],
                    "status": self._normalize_status(test_result.status),
                    "executed_at": test_result.executed_at,
                    "report_id": None,
                }
        if asset["asset_type"] == "interface_case":
            case = db.query(InterfaceTestCase).filter(InterfaceTestCase.id == asset["asset_id"]).first()
            if case and case.last_run_status:
                return {
                    "asset_type": asset["asset_type"],
                    "asset_id": asset["asset_id"],
                    "status": self._normalize_status(case.last_run_status),
                    "executed_at": case.last_run_time,
                    "report_id": None,
                }
        return None

    def _aggregate_execution_status(self, assets: List[Dict[str, Any]], results: List[Dict[str, Any]]) -> str:
        if not assets or not results:
            return "not_run"
        statuses = {item["status"] for item in results}
        if statuses & {"failed", "error"}:
            return "failed"
        if statuses == {"passed"} and len(results) >= len(assets):
            return "passed"
        if "passed" in statuses:
            return "partial"
        return "not_run"

    def _normalize_status(self, status: str) -> str:
        value = (status or "").strip().lower()
        if value in PASSED_STATUSES:
            return "passed"
        if value in FAILED_STATUSES:
            return "failed" if value != "error" else "error"
        return value or "not_run"

    def _count_open_defects(self, db: Session, requirement: Requirement, assets: List[Dict[str, Any]]) -> int:
        query = db.query(Defect).filter(Defect.status != "closed")
        direct_count = query.filter(Defect.requirement_id == requirement.id).count()
        asset_count = 0
        for asset in assets:
            if asset["asset_type"] == "functional_case":
                asset_count += query.filter(Defect.testcase_id == asset["asset_id"]).count()
            elif asset["asset_type"] == "interface_case":
                asset_count += query.filter(Defect.interface_testcase_id == asset["asset_id"]).count()
        return direct_count + asset_count

    def _suggest_requirement_status(self, coverage_status: str, execution_status: str, open_defects: int) -> str:
        if coverage_status == "uncovered":
            return "draft"
        if execution_status == "not_run":
            return "testing"
        if open_defects > 0 or execution_status in {"failed", "error"}:
            return "testing"
        if execution_status in {"passed", "partial"}:
            return "completed"
        return "review"

    def _risk_level(self, requirement: Requirement, coverage_status: str, execution_status: str, open_defects: int) -> str:
        if requirement.priority == "high" and (coverage_status == "uncovered" or open_defects > 0 or execution_status in {"failed", "error"}):
            return "high"
        if coverage_status == "uncovered" or open_defects > 0 or execution_status in {"failed", "error"}:
            return "medium"
        return "low"

    def _pass_rate(self, results: List[Dict[str, Any]]) -> float:
        if not results:
            return 0
        passed = len([item for item in results if item["status"] == "passed"])
        return round(passed / len(results) * 100, 1)

    def _sync_requirement_counts(self, db: Session, requirement: Requirement) -> None:
        assets = db.query(RequirementTestAsset).filter(RequirementTestAsset.requirement_id == requirement.id).all()
        requirement.linked_functional_test_cases = len([item for item in assets if item.asset_type == "functional_case"])
        requirement.linked_interface_test_cases = len([item for item in assets if item.asset_type == "interface_case"])
        requirement.updated_at = datetime.utcnow()

    def _extract_keywords(self, *texts: str) -> List[str]:
        joined = " ".join([text or "" for text in texts])
        tokens = re.findall(r"[\u4e00-\u9fa5]{2,}|[A-Za-z0-9_]{3,}", joined)
        stop_words = {"需求", "用户", "系统", "功能", "支持", "测试", "接口", "数据", "the", "and", "for"}
        keywords = []
        for token in tokens:
            if token.lower() in stop_words or token in keywords:
                continue
            keywords.append(token)
            if len(keywords) >= 12:
                break
        return keywords

    def _find_related_interface_cases(self, db: Session, project_id: int, keywords: List[str]) -> List[Dict[str, Any]]:
        if not keywords:
            return []
        cases = db.query(InterfaceTestCase).filter(InterfaceTestCase.project_id == project_id).limit(500).all()
        results = []
        for case in cases:
            haystack = " ".join([case.name or "", case.description or "", case.module or "", case.url or ""])
            if any(keyword.lower() in haystack.lower() for keyword in keywords):
                results.append({"asset_type": "interface_case", "asset_id": case.id, "name": case.name, "source": "impact_analysis"})
            if len(results) >= 10:
                break
        return results

    def _find_related_functional_cases(self, db: Session, project_id: int, keywords: List[str]) -> List[Dict[str, Any]]:
        if not keywords:
            return []
        cases = db.query(TestCase).filter(TestCase.project_id == project_id).limit(500).all()
        results = []
        for case in cases:
            haystack = " ".join([case.name or "", case.description or "", case.protocol or ""])
            if any(keyword.lower() in haystack.lower() for keyword in keywords):
                results.append({"asset_type": "functional_case", "asset_id": case.id, "name": case.name, "source": "impact_analysis"})
            if len(results) >= 10:
                break
        return results

    def _calc_impact_level(self, requirement: Requirement, recommendations: List[Dict[str, Any]]) -> str:
        if requirement.priority == "high" or len(recommendations) >= 8:
            return "high"
        if len(recommendations) >= 3:
            return "medium"
        return "low"

    def _missing_case_suggestions(self, requirement: Requirement, recommendations: List[Dict[str, Any]], keywords: List[str]) -> List[Dict[str, Any]]:
        direct_sources = {item.get("source") for item in recommendations}
        suggestions = []
        if not recommendations:
            suggestions.append({
                "type": "coverage_gap",
                "title": "补充基础正向验收用例",
                "reason": "该需求暂无可回归测试资产，建议优先补齐主流程验证。",
                "prompt": f"基于需求《{requirement.title}》生成覆盖主流程的功能测试用例。",
            })
        if "legacy" not in direct_sources and "manual" not in direct_sources:
            suggestions.append({
                "type": "traceability_gap",
                "title": "建立需求与已有用例的追踪关系",
                "reason": "推荐范围主要来自影响分析匹配，缺少明确人工确认的需求-用例关联。",
                "prompt": f"请核对关键词 {', '.join(keywords[:5])} 命中的用例，并确认是否关联到需求 {requirement.id}。",
            })
        if requirement.priority == "high":
            suggestions.append({
                "type": "risk_gap",
                "title": "补充边界和异常场景",
                "reason": "高优先级需求变更应覆盖边界值、异常输入、权限和兼容性场景。",
                "prompt": f"基于需求《{requirement.title}》生成边界、异常、权限类测试用例。",
            })
        return suggestions


traceability_service = TraceabilityService()
