from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from models.database_models import InterfaceTestCase
from services.test_asset_audit_service import test_asset_audit_service
from services.api_testing_advanced_service import api_testing_advanced_service


class InterfaceTestCaseService:
    """接口测试用例服务（独立表）"""

    def get_all(self, db: Session) -> List[InterfaceTestCase]:
        return db.query(InterfaceTestCase).order_by(InterfaceTestCase.updated_at.desc()).all()

    def get_by_project(self, db: Session, project_id: int) -> List[InterfaceTestCase]:
        return (
            db.query(InterfaceTestCase)
            .filter(InterfaceTestCase.project_id == project_id)
            .order_by(InterfaceTestCase.updated_at.desc())
            .all()
        )

    def get_one(self, db: Session, case_id: int) -> Optional[InterfaceTestCase]:
        return db.query(InterfaceTestCase).filter(InterfaceTestCase.id == case_id).first()

    def create(self, db: Session, payload: Dict[str, Any]) -> InterfaceTestCase:
        obj = InterfaceTestCase(**payload)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        test_asset_audit_service.record_asset_version(
            db,
            "interface_case",
            obj,
            action="create",
            actor="system",
            source="manual",
        )
        return obj

    def bulk_create(self, db: Session, payloads: List[Dict[str, Any]]) -> List[InterfaceTestCase]:
        if not payloads:
            return []
        objects = [InterfaceTestCase(**payload) for payload in payloads]
        db.add_all(objects)
        db.commit()
        for obj in objects:
            db.refresh(obj)
            test_asset_audit_service.record_asset_version(
                db,
                "interface_case",
                obj,
                action="create",
                actor="system",
                source="import",
            )
        return objects

    def update(self, db: Session, case_id: int, payload: Dict[str, Any]) -> Optional[InterfaceTestCase]:
        obj = self.get_one(db, case_id)
        if not obj:
            return None
        test_asset_audit_service.assert_asset_editable(db, "interface_case", case_id)
        before_snapshot = test_asset_audit_service.serialize_asset("interface_case", obj)
        api_before_snapshot = api_testing_advanced_service._case_snapshot(obj)
        for key, value in payload.items():
            if hasattr(obj, key):
                setattr(obj, key, value)
        db.commit()
        db.refresh(obj)
        test_asset_audit_service.record_asset_version(
            db,
            "interface_case",
            obj,
            action="update",
            before_snapshot=before_snapshot,
            actor="system",
                source="manual",
            )
        api_testing_advanced_service.record_interface_change(
            db,
            obj,
            api_before_snapshot,
            source="manual",
            operator="system",
            commit=True,
        )
        return obj

    def delete(self, db: Session, case_id: int) -> bool:
        obj = self.get_one(db, case_id)
        if not obj:
            return False
        test_asset_audit_service.assert_asset_editable(db, "interface_case", case_id)
        before_snapshot = test_asset_audit_service.serialize_asset("interface_case", obj)
        test_asset_audit_service.record_asset_version(
            db,
            "interface_case",
            obj,
            action="delete",
            before_snapshot=before_snapshot,
            actor="system",
            source="manual",
            commit=False,
        )
        db.delete(obj)
        db.commit()
        return True
