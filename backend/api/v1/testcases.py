from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from api.deps import get_database, get_testcase_service
from schemas.response_schemas import TestCaseCreate, TestCaseResponse
from models.database_models import TestCase

router = APIRouter()


@router.post("/projects/{project_id}/testcases", response_model=TestCaseResponse)
async def create_testcase(
    project_id: int,
    testcase: TestCaseCreate,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """创建测试用例"""
    return testcase_service.create_testcase(db, project_id, testcase)


@router.get("/projects/{project_id}/testcases", response_model=List[TestCaseResponse])
async def get_testcases(
    project_id: int,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """获取项目的测试用例"""
    return testcase_service.get_testcases(db, project_id)


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
    return testcase


@router.put("/testcases/{testcase_id}", response_model=TestCaseResponse)
async def update_testcase(
    testcase_id: int,
    testcase_update: dict,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """更新测试用例"""
    testcase = testcase_service.update_testcase(db, testcase_id, testcase_update)
    if not testcase:
        raise HTTPException(status_code=404, detail="测试用例不存在")
    return testcase


@router.delete("/testcases/{testcase_id}")
async def delete_testcase(
    testcase_id: int,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """删除测试用例"""
    success = testcase_service.delete_testcase(db, testcase_id)
    if not success:
        raise HTTPException(status_code=404, detail="测试用例不存在")
    return {"message": "测试用例删除成功"}


@router.get("/projects/{project_id}/testcases/protocol/{protocol}", response_model=List[TestCaseResponse])
async def get_testcases_by_protocol(
    project_id: int,
    protocol: str,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """根据协议类型获取测试用例"""
    return testcase_service.get_testcases_by_protocol(db, project_id, protocol)


@router.get("/testcases/{testcase_id}/results")
async def get_testcase_results(
    testcase_id: int,
    limit: int = 10,
    db: Session = Depends(get_database),
    testcase_service = Depends(get_testcase_service)
):
    """获取测试用例的执行历史"""
    return testcase_service.get_test_results(db, testcase_id, limit)