from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from models.database_models import InterfaceTestCase


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
        return obj

    def bulk_create(self, db: Session, payloads: List[Dict[str, Any]]) -> List[InterfaceTestCase]:
        if not payloads:
            return []
        objects = [InterfaceTestCase(**payload) for payload in payloads]
        db.add_all(objects)
        db.commit()
        for obj in objects:
            db.refresh(obj)
        return objects

    def update(self, db: Session, case_id: int, payload: Dict[str, Any]) -> Optional[InterfaceTestCase]:
        obj = self.get_one(db, case_id)
        if not obj:
            return None
        for key, value in payload.items():
            if hasattr(obj, key):
                setattr(obj, key, value)
        db.commit()
        db.refresh(obj)
        return obj

    def delete(self, db: Session, case_id: int) -> bool:
        obj = self.get_one(db, case_id)
        if not obj:
            return False
        db.delete(obj)
        db.commit()
        return True
