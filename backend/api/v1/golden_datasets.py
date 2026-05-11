"""
黄金测试集 API 路由
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_database
from schemas.agent_evaluation_schemas import (
    GoldenDatasetCreate,
    GoldenDatasetItemCreate,
    GoldenDatasetItemUpdate,
    GoldenDatasetUpdate,
)
from services.golden_dataset_service import golden_dataset_service

router = APIRouter()


@router.get("/golden-datasets")
async def list_golden_datasets(
    keyword: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_database),
):
    datasets, total = golden_dataset_service.list_datasets(db, keyword=keyword, limit=limit, offset=offset)
    return {
        "total": total,
        "items": [golden_dataset_service.serialize_dataset(d) for d in datasets],
    }


@router.post("/golden-datasets")
async def create_golden_dataset(
    payload: GoldenDatasetCreate,
    db: Session = Depends(get_database),
):
    dataset = golden_dataset_service.create_dataset(db, payload)
    return golden_dataset_service.serialize_dataset(dataset, include_items=True)


@router.get("/golden-datasets/{dataset_id}")
async def get_golden_dataset(
    dataset_id: int,
    db: Session = Depends(get_database),
):
    dataset = golden_dataset_service.get_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="黄金测试集不存在")
    return golden_dataset_service.serialize_dataset(dataset, include_items=True)


@router.put("/golden-datasets/{dataset_id}")
async def update_golden_dataset(
    dataset_id: int,
    payload: GoldenDatasetUpdate,
    db: Session = Depends(get_database),
):
    dataset = golden_dataset_service.update_dataset(db, dataset_id, payload)
    if not dataset:
        raise HTTPException(status_code=404, detail="黄金测试集不存在")
    return golden_dataset_service.serialize_dataset(dataset)


@router.delete("/golden-datasets/{dataset_id}")
async def delete_golden_dataset(
    dataset_id: int,
    db: Session = Depends(get_database),
):
    ok = golden_dataset_service.delete_dataset(db, dataset_id)
    if not ok:
        raise HTTPException(status_code=404, detail="黄金测试集不存在")
    return {"message": "已删除"}


@router.post("/golden-datasets/{dataset_id}/items")
async def add_golden_dataset_items(
    dataset_id: int,
    items: List[GoldenDatasetItemCreate],
    db: Session = Depends(get_database),
):
    try:
        created = golden_dataset_service.add_items(db, dataset_id, items)
        return [golden_dataset_service.serialize_item(i) for i in created]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/golden-dataset-items/{item_id}")
async def update_golden_dataset_item(
    item_id: int,
    payload: GoldenDatasetItemUpdate,
    db: Session = Depends(get_database),
):
    item = golden_dataset_service.update_item(db, item_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="条目不存在")
    return golden_dataset_service.serialize_item(item)


@router.delete("/golden-dataset-items/{item_id}")
async def delete_golden_dataset_item(
    item_id: int,
    db: Session = Depends(get_database),
):
    ok = golden_dataset_service.delete_item(db, item_id)
    if not ok:
        raise HTTPException(status_code=404, detail="条目不存在")
    return {"message": "已删除"}
