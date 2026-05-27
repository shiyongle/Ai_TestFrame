from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from api.deps import get_database, get_testcase_service
from schemas.response_schemas import TestCaseCreate, TestCaseResponse
from models.database_models import TestCase
from utils.activity_logger import log_activity

router = APIRouter()


@router.post("/projects/{project_id}/testcases", response_model=TestCaseResponse)
async def create_testcase(
    project_id: int,
    testcase: TestCaseCreate,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """创建测试用例"""
    created = testcase_service.create_testcase(db, project_id, testcase)
    log_activity(db, action="create", module="测试用例", target_name=created.name, detail=f"测试用例ID={created.id}, project_id={project_id}")
    return created


@router.get("/projects/{project_id}/testcases", response_model=List[TestCaseResponse])
async def get_testcases(
    project_id: int,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """获取项目的测试用例"""
    items = testcase_service.get_testcases(db, project_id)
    log_activity(db, action="query", module="测试用例", target_name=f"项目ID={project_id}", detail=f"查看项目测试用例，数量={len(items)}")
    return items


@router.get("/testcases", response_model=List[TestCaseResponse])
async def get_all_testcases(
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """获取所有测试用例"""
    items = testcase_service.get_all_testcases(db)
    log_activity(db, action="query", module="测试用例", target_name="全部测试用例", detail=f"数量={len(items)}")
    return items


@router.get("/testcases/{testcase_id}", response_model=TestCaseResponse)
async def get_testcase(
    testcase_id: int,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """获取指定测试用例"""
    testcase = testcase_service.get_testcase(db, testcase_id)
    if not testcase:
        raise HTTPException(status_code=404, detail="测试用例不存在")
    log_activity(db, action="query", module="测试用例", target_name=testcase.name, detail=f"测试用例ID={testcase_id}")
    return testcase


@router.put("/testcases/{testcase_id}", response_model=TestCaseResponse)
async def update_testcase(
    testcase_id: int,
    testcase_update: dict,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """更新测试用例"""
    try:
        testcase = testcase_service.update_testcase(db, testcase_id, testcase_update)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if not testcase:
        raise HTTPException(status_code=404, detail="测试用例不存在")
    log_activity(db, action="update", module="测试用例", target_name=testcase.name, detail=f"测试用例ID={testcase_id}")
    return testcase


@router.delete("/testcases/{testcase_id}")
async def delete_testcase(
    testcase_id: int,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """删除测试用例"""
    testcase = testcase_service.get_testcase(db, testcase_id)
    if not testcase:
        raise HTTPException(status_code=404, detail="测试用例不存在")

    try:
        success = testcase_service.delete_testcase(db, testcase_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if not success:
        raise HTTPException(status_code=404, detail="测试用例不存在")
    log_activity(db, action="delete", module="测试用例", target_name=testcase.name, detail=f"测试用例ID={testcase_id}")
    return {"message": "测试用例删除成功"}


@router.get("/projects/{project_id}/testcases/protocol/{protocol}", response_model=List[TestCaseResponse])
async def get_testcases_by_protocol(
    project_id: int,
    protocol: str,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """根据协议类型获取测试用例"""
    items = testcase_service.get_testcases_by_protocol(db, project_id, protocol)
    log_activity(
        db,
        action="query",
        module="测试用例",
        target_name=f"协议={protocol}",
        detail=f"project_id={project_id}, 数量={len(items)}",
    )
    return items


@router.get("/testcases/{testcase_id}/results")
async def get_testcase_results(
    testcase_id: int,
    limit: int = 10,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """获取测试用例的执行历史"""
    results = testcase_service.get_test_results(db, testcase_id, limit)
    log_activity(db, action="query", module="测试用例", target_name=f"ID={testcase_id}", detail=f"查看执行历史，limit={limit}")
    return results
