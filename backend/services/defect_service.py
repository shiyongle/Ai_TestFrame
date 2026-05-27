from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from models.database_models import Defect, DefectStatusHistory, TestReport
from schemas.defect_schemas import (
    DefectCreate,
    DefectExternalSync,
    DefectFromReportCreate,
    DefectRegressionVerify,
    DefectTransition,
    DefectUpdate,
)
from services.defect_connector import get_defect_connector


STATUS_TRANSITIONS = {
    "open": {"in_progress", "resolved", "closed"},
    "in_progress": {"resolved", "open", "closed"},
    "resolved": {"verified", "reopened", "closed"},
    "verified": {"closed", "reopened"},
    "reopened": {"in_progress", "resolved", "closed"},
    "closed": {"reopened"},
}

EXTERNAL_STATUS_MAP = {
    "new": "open",
    "open": "open",
    "todo": "open",
    "doing": "in_progress",
    "in_progress": "in_progress",
    "fixed": "resolved",
    "resolved": "resolved",
    "done": "resolved",
    "verified": "verified",
    "closed": "closed",
    "reopened": "reopened",
    "to do": "open",
    "selected for development": "open",
    "in progress": "in_progress",
}


class DefectService:
    def list_defects(
        self,
        db: Session,
        status: Optional[str] = None,
        project_id: Optional[int] = None,
        keyword: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Defect]:
        query = db.query(Defect).options(joinedload(Defect.histories)).order_by(Defect.updated_at.desc())
        if status:
            query = query.filter(Defect.status == status)
        if project_id:
            query = query.filter(Defect.project_id == project_id)
        if keyword:
            like_value = f"%{keyword.strip()}%"
            query = query.filter(Defect.title.like(like_value))
        return query.offset(offset).limit(limit).all()

    def get_defect(self, db: Session, defect_id: int) -> Optional[Defect]:
        return (
            db.query(Defect)
            .options(joinedload(Defect.histories))
            .filter(Defect.id == defect_id)
            .first()
        )

    def create_defect(self, db: Session, payload: DefectCreate, operator: str = "system") -> Defect:
        defect = Defect(
            title=payload.title.strip(),
            description=payload.description or "",
            severity=payload.severity,
            priority=payload.priority,
            source_type=payload.source_type,
            requirement_id=payload.requirement_id,
            project_id=payload.project_id,
            report_id=payload.report_id,
            testcase_id=payload.testcase_id,
            interface_testcase_id=payload.interface_testcase_id,
            assigned_to=payload.assigned_to,
            created_by=operator,
        )
        db.add(defect)
        db.flush()
        self._add_history(db, defect, None, "open", "create", operator, "创建缺陷")
        if payload.sync_external:
            self._sync_external_create(db, defect)
        db.commit()
        db.refresh(defect)
        return defect

    def create_from_report(self, db: Session, report_id: int, payload: DefectFromReportCreate, operator: str = "system") -> Defect:
        report = db.query(TestReport).filter(TestReport.id == report_id).first()
        if not report:
            raise ValueError("测试报告不存在")

        failed_count = (report.failed_tests or 0) + (report.error_tests or 0)
        if failed_count <= 0:
            raise ValueError("该报告没有失败或异常用例，无需提 Bug")

        existing = db.query(Defect).filter(Defect.report_id == report_id, Defect.status != "closed").first()
        if existing:
            return existing

        title = payload.title or f"测试报告 #{report.id} 发现 {failed_count} 个失败/异常"
        description = payload.description or self._build_report_description(report, failed_count)
        defect_payload = DefectCreate(
            title=title,
            description=description,
            severity=payload.severity,
            priority=payload.priority,
            source_type="test_report",
            project_id=report.project_id,
            report_id=report.id,
            assigned_to=payload.assigned_to,
            sync_external=payload.sync_external,
        )
        return self.create_defect(db, defect_payload, operator)

    def update_defect(self, db: Session, defect_id: int, payload: DefectUpdate, operator: str = "system") -> Optional[Defect]:
        defect = self.get_defect(db, defect_id)
        if not defect:
            return None
        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if isinstance(value, str):
                value = value.strip()
            setattr(defect, key, value)
        self._add_history(db, defect, defect.status, defect.status, "update", operator, "更新缺陷信息")
        db.commit()
        db.refresh(defect)
        return defect

    def transition_defect(self, db: Session, defect_id: int, payload: DefectTransition, operator: str = "system") -> Optional[Defect]:
        defect = self.get_defect(db, defect_id)
        if not defect:
            return None

        target_status = payload.status.strip()
        if target_status not in STATUS_TRANSITIONS.get(defect.status, set()):
            raise ValueError(f"缺陷状态不允许从 {defect.status} 流转到 {target_status}")

        old_status = defect.status
        self._apply_status(defect, target_status)
        self._add_history(db, defect, old_status, target_status, "transition", operator, payload.comment)
        if payload.sync_external:
            self._sync_external_update(db, defect, "transition")
        db.commit()
        db.refresh(defect)
        return defect

    def verify_regression(self, db: Session, defect_id: int, payload: DefectRegressionVerify, operator: str = "system") -> Optional[Defect]:
        defect = self.get_defect(db, defect_id)
        if not defect:
            return None

        old_status = defect.status
        defect.regression_status = "passed" if payload.passed else "failed"
        defect.regression_report_id = payload.report_id
        defect.regression_notes = payload.notes
        if payload.passed:
            self._apply_status(defect, "verified")
            action = "regression_passed"
            comment = payload.notes or "回归验证通过"
        else:
            self._apply_status(defect, "reopened")
            action = "regression_failed"
            comment = payload.notes or "回归验证失败，重新打开缺陷"
        self._add_history(db, defect, old_status, defect.status, action, operator, comment)
        if payload.sync_external:
            self._sync_external_update(db, defect, action)
        db.commit()
        db.refresh(defect)
        return defect

    def sync_external_status(self, db: Session, defect_id: int, payload: DefectExternalSync, operator: str = "system") -> Optional[Defect]:
        defect = self.get_defect(db, defect_id)
        if not defect:
            return None

        old_status = defect.status
        if payload.external_key:
            defect.external_key = payload.external_key
        if payload.external_url:
            defect.external_url = payload.external_url
        if payload.external_status:
            defect.external_status = payload.external_status
            mapped_status = EXTERNAL_STATUS_MAP.get(payload.external_status.strip().lower())
            if mapped_status and mapped_status != defect.status:
                self._apply_status(defect, mapped_status)
        defect.last_synced_at = datetime.utcnow()
        self._add_history(db, defect, old_status, defect.status, "external_sync", operator, "同步外部缺陷状态", payload.external_status)
        db.commit()
        db.refresh(defect)
        return defect

    def pull_external_status(self, db: Session, defect_id: int, operator: str = "system") -> Optional[Defect]:
        defect = self.get_defect(db, defect_id)
        if not defect:
            return None
        connector = get_defect_connector(db)
        data = connector.get_external_defect(defect)
        payload = DefectExternalSync(
            external_status=data.get("external_status"),
            external_key=data.get("external_key"),
            external_url=data.get("external_url"),
        )
        return self.sync_external_status(db, defect_id, payload, operator)

    def test_integration(self, db: Session) -> Dict[str, Any]:
        connector = get_defect_connector(db)
        return connector.test_connection()

    def serialize_defect(self, defect: Defect) -> Dict[str, Any]:
        histories = sorted(defect.histories or [], key=lambda item: item.created_at, reverse=True)
        return {
            "id": defect.id,
            "title": defect.title,
            "description": defect.description,
            "severity": defect.severity,
            "priority": defect.priority,
            "status": defect.status,
            "source_type": defect.source_type,
            "requirement_id": defect.requirement_id,
            "project_id": defect.project_id,
            "report_id": defect.report_id,
            "testcase_id": defect.testcase_id,
            "interface_testcase_id": defect.interface_testcase_id,
            "external_provider": defect.external_provider,
            "external_key": defect.external_key,
            "external_url": defect.external_url,
            "external_status": defect.external_status,
            "last_synced_at": defect.last_synced_at,
            "regression_status": defect.regression_status,
            "regression_report_id": defect.regression_report_id,
            "regression_notes": defect.regression_notes,
            "created_by": defect.created_by,
            "assigned_to": defect.assigned_to,
            "resolved_at": defect.resolved_at,
            "verified_at": defect.verified_at,
            "closed_at": defect.closed_at,
            "created_at": defect.created_at,
            "updated_at": defect.updated_at,
            "histories": histories,
        }

    def _build_report_description(self, report: TestReport, failed_count: int) -> str:
        return (
            f"来源：测试报告 #{report.id}\n"
            f"项目ID：{report.project_id or '-'}\n"
            f"版本ID：{report.version_id or '-'}\n"
            f"总用例：{report.total_tests or 0}\n"
            f"通过：{report.passed_tests or 0}\n"
            f"失败：{report.failed_tests or 0}\n"
            f"异常：{report.error_tests or 0}\n"
            f"需处理失败/异常数：{failed_count}\n"
        )

    def _apply_status(self, defect: Defect, status: str) -> None:
        defect.status = status
        now = datetime.utcnow()
        if status == "resolved":
            defect.resolved_at = now
        elif status == "verified":
            defect.verified_at = now
        elif status == "closed":
            defect.closed_at = now
        elif status == "reopened":
            defect.closed_at = None
            defect.verified_at = None

    def _add_history(
        self,
        db: Session,
        defect: Defect,
        from_status: Optional[str],
        to_status: str,
        action: str,
        operator: str,
        comment: str = "",
        external_status: Optional[str] = None,
    ) -> None:
        db.add(
            DefectStatusHistory(
                defect_id=defect.id,
                from_status=from_status,
                to_status=to_status,
                action=action,
                operator=operator,
                comment=comment,
                external_status=external_status,
            )
        )

    def _sync_external_create(self, db: Session, defect: Defect) -> None:
        connector = get_defect_connector(db)
        defect.external_provider = connector.provider
        data = connector.create_external_defect(defect)
        defect.external_key = data.get("external_key") or data.get("key") or defect.external_key
        defect.external_url = data.get("external_url") or data.get("url") or defect.external_url
        defect.external_status = data.get("external_status") or data.get("status") or defect.external_status
        defect.last_synced_at = datetime.utcnow()

    def _sync_external_update(self, db: Session, defect: Defect, action: str) -> None:
        connector = get_defect_connector(db)
        defect.external_provider = connector.provider
        data = connector.update_external_defect(defect, action)
        defect.external_key = data.get("external_key") or data.get("key") or defect.external_key
        defect.external_url = data.get("external_url") or data.get("url") or defect.external_url
        defect.external_status = data.get("external_status") or data.get("status") or defect.external_status
        defect.last_synced_at = datetime.utcnow()


defect_service = DefectService()
