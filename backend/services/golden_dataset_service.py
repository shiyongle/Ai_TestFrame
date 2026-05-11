"""
黄金测试集服务
支持黄金测试集（Q&A数据集）的完整 CRUD 管理
"""

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session, selectinload

from models.database_models import GoldenDataset, GoldenDatasetItem
from schemas.agent_evaluation_schemas import (
    GoldenDatasetCreate,
    GoldenDatasetItemCreate,
    GoldenDatasetItemUpdate,
    GoldenDatasetUpdate,
)


class GoldenDatasetService:

    # ---- 测试集 CRUD ----

    def list_datasets(
        self, db: Session, keyword: Optional[str] = None, limit: int = 50, offset: int = 0
    ) -> Tuple[List[GoldenDataset], int]:
        query = db.query(GoldenDataset)
        if keyword:
            query = query.filter(GoldenDataset.name.ilike(f"%{keyword}%"))
        total = query.count()
        datasets = (
            query
            .order_by(GoldenDataset.updated_at.desc(), GoldenDataset.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return datasets, total

    def get_dataset(self, db: Session, dataset_id: int) -> Optional[GoldenDataset]:
        return (
            db.query(GoldenDataset)
            .options(selectinload(GoldenDataset.items))
            .filter(GoldenDataset.id == dataset_id)
            .first()
        )

    def create_dataset(self, db: Session, payload: GoldenDatasetCreate) -> GoldenDataset:
        dataset = GoldenDataset(
            name=payload.name.strip(),
            description=payload.description,
            tags=payload.tags,
        )
        db.add(dataset)
        db.flush()

        # 如果提供了初始条目
        if payload.items:
            for item_data in payload.items:
                item = GoldenDatasetItem(
                    dataset_id=dataset.id,
                    question=item_data.question.strip(),
                    expected_answer=item_data.expected_answer.strip(),
                    category=item_data.category,
                    priority=item_data.priority,
                    tags=item_data.tags,
                )
                db.add(item)

        db.commit()
        db.refresh(dataset)
        return dataset

    def update_dataset(self, db: Session, dataset_id: int, payload: GoldenDatasetUpdate) -> Optional[GoldenDataset]:
        dataset = db.query(GoldenDataset).filter(GoldenDataset.id == dataset_id).first()
        if not dataset:
            return None
        if payload.name is not None:
            dataset.name = payload.name.strip()
        if payload.description is not None:
            dataset.description = payload.description
        if payload.tags is not None:
            dataset.tags = payload.tags
        db.commit()
        db.refresh(dataset)
        return dataset

    def delete_dataset(self, db: Session, dataset_id: int) -> bool:
        dataset = db.query(GoldenDataset).filter(GoldenDataset.id == dataset_id).first()
        if not dataset:
            return False
        db.delete(dataset)
        db.commit()
        return True

    # ---- 条目管理 ----

    def add_items(
        self, db: Session, dataset_id: int, items: List[GoldenDatasetItemCreate]
    ) -> List[GoldenDatasetItem]:
        dataset = db.query(GoldenDataset).filter(GoldenDataset.id == dataset_id).first()
        if not dataset:
            raise ValueError(f"黄金测试集不存在: {dataset_id}")

        created_items = []
        for item_data in items:
            item = GoldenDatasetItem(
                dataset_id=dataset_id,
                question=item_data.question.strip(),
                expected_answer=item_data.expected_answer.strip(),
                category=item_data.category,
                priority=item_data.priority,
                tags=item_data.tags,
            )
            db.add(item)
            created_items.append(item)

        db.commit()
        for item in created_items:
            db.refresh(item)
        return created_items

    def update_item(self, db: Session, item_id: int, payload: GoldenDatasetItemUpdate) -> Optional[GoldenDatasetItem]:
        item = db.query(GoldenDatasetItem).filter(GoldenDatasetItem.id == item_id).first()
        if not item:
            return None
        if payload.question is not None:
            item.question = payload.question.strip()
        if payload.expected_answer is not None:
            item.expected_answer = payload.expected_answer.strip()
        if payload.category is not None:
            item.category = payload.category
        if payload.priority is not None:
            item.priority = payload.priority
        if payload.tags is not None:
            item.tags = payload.tags
        db.commit()
        db.refresh(item)
        return item

    def delete_item(self, db: Session, item_id: int) -> bool:
        item = db.query(GoldenDatasetItem).filter(GoldenDatasetItem.id == item_id).first()
        if not item:
            return False
        db.delete(item)
        db.commit()
        return True

    # ---- 序列化 ----

    def serialize_dataset(self, dataset: GoldenDataset, include_items: bool = False) -> Dict[str, Any]:
        result = {
            "id": dataset.id,
            "name": dataset.name,
            "description": dataset.description,
            "tags": dataset.tags,
            "item_count": len(dataset.items) if hasattr(dataset, "items") and dataset.items else 0,
            "created_at": dataset.created_at,
            "updated_at": dataset.updated_at,
        }
        if include_items:
            result["items"] = [self.serialize_item(item) for item in (dataset.items or [])]
        else:
            result["items"] = []
        return result

    def serialize_item(self, item: GoldenDatasetItem) -> Dict[str, Any]:
        return {
            "id": item.id,
            "dataset_id": item.dataset_id,
            "question": item.question,
            "expected_answer": item.expected_answer,
            "category": item.category,
            "priority": item.priority,
            "tags": item.tags,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        }


golden_dataset_service = GoldenDatasetService()
