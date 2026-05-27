import hashlib
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.database_models import (
    AIGeneratedCaseCitation,
    AIGeneratedCaseEvidence,
    AIGenerationSession,
    InterfaceTestCase,
    TestAssetApproval,
    TestAssetAuditEvent,
    TestAssetBaseline,
    TestAssetBaselineItem,
    TestAssetVersion,
    TestCase,
)


ASSET_TYPES = {"functional_case", "interface_case"}


class TestAssetAuditService:
    def serialize_asset(self, asset_type: str, asset: Any) -> Dict[str, Any]:
        if asset_type == "functional_case":
            return {
                "id": asset.id,
                "name": asset.name,
                "description": asset.description,
                "protocol": asset.protocol,
                "config": asset.config,
                "project_id": asset.project_id,
                "created_at": self._dt(asset.created_at),
                "updated_at": self._dt(asset.updated_at),
            }
        if asset_type == "interface_case":
            return {
                "id": asset.id,
                "name": asset.name,
                "description": asset.description,
                "protocol": asset.protocol,
                "method": asset.method,
                "url": asset.url,
                "headers": asset.headers,
                "params": asset.params,
                "body": asset.body,
                "assertions": asset.assertions,
                "preconditions": asset.preconditions,
                "test_data": asset.test_data,
                "notes": asset.notes,
                "module": asset.module,
                "priority": asset.priority,
                "status": asset.status,
                "last_run_status": asset.last_run_status,
                "last_run_time": self._dt(asset.last_run_time),
                "project_id": asset.project_id,
                "created_at": self._dt(asset.created_at),
                "updated_at": self._dt(asset.updated_at),
            }
        raise ValueError("不支持的测试资产类型")

    def record_asset_version(
        self,
        db: Session,
        asset_type: str,
        asset: Any,
        action: str,
        before_snapshot: Optional[Dict[str, Any]] = None,
        source: str = "manual",
        source_ref_type: Optional[str] = None,
        source_ref_id: Optional[str] = None,
        requirement_id: Optional[int] = None,
        actor: str = "system",
        approval_status: Optional[str] = None,
        commit: bool = True,
    ) -> TestAssetVersion:
        if asset_type not in ASSET_TYPES:
            raise ValueError("不支持的测试资产类型")

        snapshot = None if action == "delete" else self.serialize_asset(asset_type, asset)
        content_hash = self._hash(snapshot or before_snapshot or {})
        latest = self._latest_version(db, asset_type, asset.id)
        version_no = (latest.version_no + 1) if latest else 1
        diff = self._diff(before_snapshot or {}, snapshot or {})
        status = approval_status or ("pending" if source == "ai_generation" else "approved")
        project_id = getattr(asset, "project_id")

        version = TestAssetVersion(
            asset_type=asset_type,
            asset_id=asset.id,
            project_id=project_id,
            version_no=version_no,
            action=action,
            snapshot=snapshot,
            diff=diff,
            change_summary=self._change_summary(diff, action),
            source=source,
            source_ref_type=source_ref_type,
            source_ref_id=str(source_ref_id) if source_ref_id is not None else None,
            requirement_id=requirement_id,
            created_by=actor,
            approval_status=status,
            approved_by=actor if status == "approved" else None,
            approved_at=datetime.utcnow() if status == "approved" else None,
            content_hash=content_hash,
            previous_hash=latest.content_hash if latest else None,
        )
        db.add(version)
        db.flush()

        self.record_audit_event(
            db,
            asset_type=asset_type,
            asset_id=asset.id,
            project_id=project_id,
            action=f"asset_{action}",
            actor=actor,
            detail=version.change_summary,
            before_hash=version.previous_hash,
            after_hash=version.content_hash,
            metadata={"version_id": version.id, "version_no": version.version_no, "source": source},
            commit=False,
        )
        if commit:
            db.commit()
            db.refresh(version)
        return version

    def record_audit_event(
        self,
        db: Session,
        asset_type: str,
        asset_id: int,
        project_id: int,
        action: str,
        actor: str = "system",
        detail: Optional[str] = None,
        before_hash: Optional[str] = None,
        after_hash: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        commit: bool = True,
    ) -> TestAssetAuditEvent:
        previous = (
            db.query(TestAssetAuditEvent)
            .filter(TestAssetAuditEvent.asset_type == asset_type, TestAssetAuditEvent.asset_id == asset_id)
            .order_by(TestAssetAuditEvent.id.desc())
            .first()
        )
        event_hash = self._hash(
            {
                "previous_event_hash": previous.event_hash if previous else None,
                "asset_type": asset_type,
                "asset_id": asset_id,
                "project_id": project_id,
                "action": action,
                "actor": actor,
                "detail": detail,
                "before_hash": before_hash,
                "after_hash": after_hash,
                "metadata": metadata or {},
                "created_at": datetime.utcnow().isoformat(),
            }
        )
        event = TestAssetAuditEvent(
            asset_type=asset_type,
            asset_id=asset_id,
            project_id=project_id,
            action=action,
            actor=actor,
            detail=detail,
            before_hash=before_hash,
            after_hash=after_hash,
            metadata_json=metadata or {},
            event_hash=event_hash,
        )
        db.add(event)
        if commit:
            db.commit()
            db.refresh(event)
        return event

    def assert_asset_editable(self, db: Session, asset_type: str, asset_id: int) -> None:
        baselines = self._frozen_baselines_for_asset(db, asset_type, asset_id)
        if baselines:
            names = "、".join(item.name for item in baselines[:3])
            raise ValueError(f"该测试资产已纳入冻结基线，不能直接改删：{names}")

    def list_assets(self, db: Session, project_id: Optional[int] = None, asset_type: Optional[str] = None) -> Dict[str, Any]:
        asset_types = [asset_type] if asset_type in ASSET_TYPES else ["functional_case", "interface_case"]
        items = []
        for current_type in asset_types:
            assets = self._query_assets(db, current_type, project_id)
            for asset in assets:
                latest = self._latest_version(db, current_type, asset.id)
                frozen = self._frozen_baselines_for_asset(db, current_type, asset.id)
                ai_evidence = self._ai_evidence_for_asset(db, current_type, asset.id)
                items.append(
                    {
                        "asset_type": current_type,
                        "asset_id": asset.id,
                        "name": asset.name,
                        "project_id": asset.project_id,
                        "current_version": latest.version_no if latest else 0,
                        "approval_status": latest.approval_status if latest else "unversioned",
                        "source": latest.source if latest else "legacy",
                        "is_frozen": bool(frozen),
                        "frozen_baselines": [{"id": item.id, "name": item.name} for item in frozen],
                        "ai_generated": bool(ai_evidence),
                        "ai_evidence_id": ai_evidence.id if ai_evidence else None,
                        "updated_at": self._dt(getattr(asset, "updated_at", None)),
                    }
                )
        items.sort(key=lambda item: item.get("updated_at") or "", reverse=True)
        return {
            "items": items,
            "summary": {
                "total_assets": len(items),
                "frozen_assets": len([item for item in items if item["is_frozen"]]),
                "pending_approvals": len([item for item in items if item["approval_status"] == "pending"]),
                "ai_generated_assets": len([item for item in items if item["ai_generated"]]),
            },
        }

    def list_versions(self, db: Session, asset_type: str, asset_id: int) -> List[Dict[str, Any]]:
        rows = (
            db.query(TestAssetVersion)
            .filter(TestAssetVersion.asset_type == asset_type, TestAssetVersion.asset_id == asset_id)
            .order_by(TestAssetVersion.version_no.desc())
            .all()
        )
        return [self._serialize_version(row) for row in rows]

    def get_version_diff(self, db: Session, version_id: int) -> Dict[str, Any]:
        version = db.query(TestAssetVersion).filter(TestAssetVersion.id == version_id).first()
        if not version:
            raise ValueError("测试资产版本不存在")
        previous = (
            db.query(TestAssetVersion)
            .filter(
                TestAssetVersion.asset_type == version.asset_type,
                TestAssetVersion.asset_id == version.asset_id,
                TestAssetVersion.version_no < version.version_no,
            )
            .order_by(TestAssetVersion.version_no.desc())
            .first()
        )
        return {
            "version": self._serialize_version(version),
            "previous_snapshot": previous.snapshot if previous else {},
            "current_snapshot": version.snapshot or {},
            "diff": version.diff or [],
        }

    def approve_version(self, db: Session, version_id: int, decision: str, approver: str, comment: Optional[str] = None) -> Dict[str, Any]:
        version = db.query(TestAssetVersion).filter(TestAssetVersion.id == version_id).first()
        if not version:
            raise ValueError("测试资产版本不存在")
        version.approval_status = decision
        version.approved_by = approver
        version.approved_at = datetime.utcnow()
        approval = TestAssetApproval(
            asset_version_id=version.id,
            decision=decision,
            approver=approver,
            comment=comment,
        )
        db.add(approval)
        self.record_audit_event(
            db,
            version.asset_type,
            version.asset_id,
            version.project_id,
            action=f"asset_{decision}",
            actor=approver,
            detail=comment or f"测试资产版本 v{version.version_no} {decision}",
            before_hash=version.previous_hash,
            after_hash=version.content_hash,
            metadata={"version_id": version.id, "approval_id": None},
            commit=False,
        )
        db.commit()
        db.refresh(version)
        return self._serialize_version(version)

    def confirm_ai_case(self, db: Session, evidence_id: int, approver: str, comment: Optional[str] = None) -> Dict[str, Any]:
        evidence = db.query(AIGeneratedCaseEvidence).filter(AIGeneratedCaseEvidence.id == evidence_id).first()
        if not evidence or not evidence.testcase_id:
            raise ValueError("AI 生成证据不存在或未关联测试用例")
        asset = db.query(TestCase).filter(TestCase.id == evidence.testcase_id).first()
        if not asset:
            raise ValueError("AI 生成用例不存在")
        latest = self._latest_version(db, "functional_case", asset.id)
        if not latest:
            session = db.query(AIGenerationSession).filter(AIGenerationSession.id == evidence.session_id).first()
            latest = self.record_asset_version(
                db,
                "functional_case",
                asset,
                "create",
                source="ai_generation",
                source_ref_type="ai_generation_session",
                source_ref_id=session.session_id if session else evidence.session_id,
                requirement_id=evidence.requirement_id,
                actor="AI",
                approval_status="pending",
                commit=False,
            )
        return self.approve_version(db, latest.id, "approved", approver, comment or "确认 AI 生成用例并纳入可回归资产")

    def list_baselines(self, db: Session, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        query = db.query(TestAssetBaseline)
        if project_id:
            query = query.filter(TestAssetBaseline.project_id == project_id)
        rows = query.order_by(TestAssetBaseline.created_at.desc()).all()
        return [self._serialize_baseline(row) for row in rows]

    def create_baseline(
        self,
        db: Session,
        name: str,
        project_id: int,
        version_id: Optional[int] = None,
        description: Optional[str] = None,
        asset_refs: Optional[List[Dict[str, Any]]] = None,
        freeze: bool = True,
        created_by: str = "QA",
    ) -> Dict[str, Any]:
        refs = asset_refs or self._all_project_asset_refs(db, project_id)
        if not refs:
            raise ValueError("当前项目暂无可纳入基线的测试资产")
        baseline = TestAssetBaseline(
            name=name,
            description=description,
            project_id=project_id,
            version_id=version_id,
            status="frozen" if freeze else "draft",
            created_by=created_by,
            frozen_by=created_by if freeze else None,
            frozen_at=datetime.utcnow() if freeze else None,
        )
        db.add(baseline)
        db.flush()

        for ref in refs:
            asset_type = ref["asset_type"]
            asset_id = int(ref["asset_id"])
            asset = self._get_asset(db, asset_type, asset_id)
            if not asset or asset.project_id != project_id:
                continue
            latest = self._latest_version(db, asset_type, asset_id)
            if not latest:
                latest = self.record_asset_version(
                    db,
                    asset_type,
                    asset,
                    "baseline_snapshot",
                    source="baseline",
                    actor=created_by,
                    commit=False,
                )
            db.add(
                TestAssetBaselineItem(
                    baseline_id=baseline.id,
                    asset_type=asset_type,
                    asset_id=asset_id,
                    asset_version_id=latest.id,
                    snapshot=latest.snapshot,
                    content_hash=latest.content_hash,
                )
            )
            self.record_audit_event(
                db,
                asset_type,
                asset_id,
                project_id,
                action="baseline_add",
                actor=created_by,
                detail=f"纳入基线：{name}",
                before_hash=latest.previous_hash,
                after_hash=latest.content_hash,
                metadata={"baseline_id": baseline.id, "baseline_name": name, "frozen": freeze},
                commit=False,
            )
        db.commit()
        db.refresh(baseline)
        return self._serialize_baseline(baseline)

    def freeze_baseline(self, db: Session, baseline_id: int, frozen_by: str = "QA") -> Dict[str, Any]:
        baseline = db.query(TestAssetBaseline).filter(TestAssetBaseline.id == baseline_id).first()
        if not baseline:
            raise ValueError("测试资产基线不存在")
        baseline.status = "frozen"
        baseline.frozen_by = frozen_by
        baseline.frozen_at = datetime.utcnow()
        baseline.updated_at = datetime.utcnow()
        for item in baseline.items:
            self.record_audit_event(
                db,
                item.asset_type,
                item.asset_id,
                baseline.project_id,
                action="baseline_freeze",
                actor=frozen_by,
                detail=f"冻结基线：{baseline.name}",
                after_hash=item.content_hash,
                metadata={"baseline_id": baseline.id, "baseline_name": baseline.name},
                commit=False,
            )
        db.commit()
        db.refresh(baseline)
        return self._serialize_baseline(baseline)

    def list_events(
        self,
        db: Session,
        project_id: Optional[int] = None,
        asset_type: Optional[str] = None,
        asset_id: Optional[int] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        query = db.query(TestAssetAuditEvent)
        if project_id:
            query = query.filter(TestAssetAuditEvent.project_id == project_id)
        if asset_type:
            query = query.filter(TestAssetAuditEvent.asset_type == asset_type)
        if asset_id:
            query = query.filter(TestAssetAuditEvent.asset_id == asset_id)
        rows = query.order_by(TestAssetAuditEvent.created_at.desc()).limit(limit).all()
        return [self._serialize_event(row) for row in rows]

    def summary(self, db: Session, project_id: Optional[int] = None) -> Dict[str, Any]:
        assets = self.list_assets(db, project_id=project_id)["summary"]
        version_query = db.query(TestAssetVersion)
        baseline_query = db.query(TestAssetBaseline)
        event_query = db.query(TestAssetAuditEvent)
        if project_id:
            version_query = version_query.filter(TestAssetVersion.project_id == project_id)
            baseline_query = baseline_query.filter(TestAssetBaseline.project_id == project_id)
            event_query = event_query.filter(TestAssetAuditEvent.project_id == project_id)
        return {
            **assets,
            "version_records": version_query.with_entities(func.count(TestAssetVersion.id)).scalar() or 0,
            "frozen_baselines": baseline_query.filter(TestAssetBaseline.status == "frozen").with_entities(func.count(TestAssetBaseline.id)).scalar() or 0,
            "audit_events": event_query.with_entities(func.count(TestAssetAuditEvent.id)).scalar() or 0,
        }

    def _query_assets(self, db: Session, asset_type: str, project_id: Optional[int]) -> List[Any]:
        model = TestCase if asset_type == "functional_case" else InterfaceTestCase
        query = db.query(model)
        if project_id:
            query = query.filter(model.project_id == project_id)
        return query.order_by(model.updated_at.desc()).all()

    def _get_asset(self, db: Session, asset_type: str, asset_id: int) -> Optional[Any]:
        if asset_type == "functional_case":
            return db.query(TestCase).filter(TestCase.id == asset_id).first()
        if asset_type == "interface_case":
            return db.query(InterfaceTestCase).filter(InterfaceTestCase.id == asset_id).first()
        return None

    def _all_project_asset_refs(self, db: Session, project_id: int) -> List[Dict[str, Any]]:
        refs = [{"asset_type": "functional_case", "asset_id": item.id} for item in db.query(TestCase).filter(TestCase.project_id == project_id).all()]
        refs.extend(
            {"asset_type": "interface_case", "asset_id": item.id}
            for item in db.query(InterfaceTestCase).filter(InterfaceTestCase.project_id == project_id).all()
        )
        return refs

    def _latest_version(self, db: Session, asset_type: str, asset_id: int) -> Optional[TestAssetVersion]:
        return (
            db.query(TestAssetVersion)
            .filter(TestAssetVersion.asset_type == asset_type, TestAssetVersion.asset_id == asset_id)
            .order_by(TestAssetVersion.version_no.desc())
            .first()
        )

    def _frozen_baselines_for_asset(self, db: Session, asset_type: str, asset_id: int) -> List[TestAssetBaseline]:
        return (
            db.query(TestAssetBaseline)
            .join(TestAssetBaselineItem, TestAssetBaselineItem.baseline_id == TestAssetBaseline.id)
            .filter(
                TestAssetBaseline.status == "frozen",
                TestAssetBaselineItem.asset_type == asset_type,
                TestAssetBaselineItem.asset_id == asset_id,
            )
            .all()
        )

    def _ai_evidence_for_asset(self, db: Session, asset_type: str, asset_id: int) -> Optional[AIGeneratedCaseEvidence]:
        if asset_type != "functional_case":
            return None
        return (
            db.query(AIGeneratedCaseEvidence)
            .filter(AIGeneratedCaseEvidence.testcase_id == asset_id)
            .order_by(AIGeneratedCaseEvidence.created_at.desc())
            .first()
        )

    def _serialize_version(self, row: TestAssetVersion) -> Dict[str, Any]:
        return {
            "id": row.id,
            "asset_type": row.asset_type,
            "asset_id": row.asset_id,
            "project_id": row.project_id,
            "version_no": row.version_no,
            "action": row.action,
            "change_summary": row.change_summary,
            "source": row.source,
            "source_ref_type": row.source_ref_type,
            "source_ref_id": row.source_ref_id,
            "requirement_id": row.requirement_id,
            "created_by": row.created_by,
            "approval_status": row.approval_status,
            "approved_by": row.approved_by,
            "approved_at": self._dt(row.approved_at),
            "content_hash": row.content_hash,
            "previous_hash": row.previous_hash,
            "created_at": self._dt(row.created_at),
            "diff": row.diff or [],
        }

    def _serialize_baseline(self, row: TestAssetBaseline) -> Dict[str, Any]:
        return {
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "project_id": row.project_id,
            "version_id": row.version_id,
            "status": row.status,
            "created_by": row.created_by,
            "frozen_by": row.frozen_by,
            "frozen_at": self._dt(row.frozen_at),
            "created_at": self._dt(row.created_at),
            "updated_at": self._dt(row.updated_at),
            "item_count": len(row.items or []),
        }

    def _serialize_event(self, row: TestAssetAuditEvent) -> Dict[str, Any]:
        return {
            "id": row.id,
            "asset_type": row.asset_type,
            "asset_id": row.asset_id,
            "project_id": row.project_id,
            "action": row.action,
            "actor": row.actor,
            "detail": row.detail,
            "metadata": row.metadata_json or {},
            "before_hash": row.before_hash,
            "after_hash": row.after_hash,
            "event_hash": row.event_hash,
            "created_at": self._dt(row.created_at),
        }

    def _diff(self, before: Dict[str, Any], after: Dict[str, Any]) -> List[Dict[str, Any]]:
        fields = sorted(set(before.keys()) | set(after.keys()))
        return [
            {"field": field, "before": before.get(field), "after": after.get(field)}
            for field in fields
            if before.get(field) != after.get(field)
        ]

    def _change_summary(self, diff: List[Dict[str, Any]], action: str) -> str:
        if action == "create":
            return "创建测试资产版本快照"
        if action == "delete":
            return "删除测试资产并保留删除前快照"
        if action == "baseline_snapshot":
            return "纳入基线前生成版本快照"
        fields = [item["field"] for item in diff if item["field"] not in {"updated_at"}]
        return "变更字段：" + "、".join(fields[:8]) if fields else "无内容变更"

    def _hash(self, payload: Dict[str, Any]) -> str:
        raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _dt(self, value: Any) -> Optional[str]:
        return value.isoformat() if value else None


test_asset_audit_service = TestAssetAuditService()
