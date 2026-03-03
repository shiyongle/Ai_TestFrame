from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from api.deps import get_database, get_test_suite_service
from schemas.test_suite_schemas import TestSuiteCreate, TestSuiteResponse, TestSuiteUpdate, SetupTestCaseInSuite
from models.database_models import TestSuite

router = APIRouter()

@router.post("/{project_id}/test-suites", response_model=TestSuiteResponse)
async def create_test_suite(
    project_id: int,
    suite: TestSuiteCreate,
    db: Session = Depends(get_database),
    suite_service = Depends(get_test_suite_service)
):
    """创建测试用例集"""
    # Ensure project_id matches
    suite.project_id = project_id
    return suite_service.create_test_suite(db, suite)

@router.get("/{project_id}/test-suites", response_model=List[TestSuiteResponse])
async def get_test_suites(
    project_id: int,
    db: Session = Depends(get_database),
    suite_service = Depends(get_test_suite_service)
):
    """获取项目的测试用例集"""
    return suite_service.get_test_suites(db, project_id)

@router.get("/test-suites/{suite_id}", response_model=TestSuiteResponse)
async def get_test_suite(
    suite_id: int,
    db: Session = Depends(get_database),
    suite_service = Depends(get_test_suite_service)
):
    """获取指定测试用例集"""
    suite = suite_service.get_test_suite(db, suite_id)
    if not suite:
        raise HTTPException(status_code=404, detail="测试用例集不存在")
    return suite

@router.put("/test-suites/{suite_id}", response_model=TestSuiteResponse)
async def update_test_suite(
    suite_id: int,
    suite_update: TestSuiteUpdate,
    db: Session = Depends(get_database),
    suite_service = Depends(get_test_suite_service)
):
    """更新测试用例集"""
    suite = suite_service.update_test_suite(db, suite_id, suite_update)
    if not suite:
        raise HTTPException(status_code=404, detail="测试用例集不存在")
    return suite

@router.delete("/test-suites/{suite_id}")
async def delete_test_suite(
    suite_id: int,
    db: Session = Depends(get_database),
    suite_service = Depends(get_test_suite_service)
):
    """删除测试用例集"""
    success = suite_service.delete_test_suite(db, suite_id)
    if not success:
        raise HTTPException(status_code=404, detail="测试用例集不存在")
    return {"message": "测试用例集删除成功"}

@router.post("/test-suites/{suite_id}/cases")
async def add_cases_to_suite(
    suite_id: int,
    request: SetupTestCaseInSuite,
    db: Session = Depends(get_database),
    suite_service = Depends(get_test_suite_service)
):
    """将测试用例添加到用例集"""
    success = suite_service.add_cases_to_suite(db, suite_id, request.testcase_ids)
    if not success:
        raise HTTPException(status_code=404, detail="测试用例集不存在")
    return {"message": "用例添加成功"}

@router.delete("/test-suites/{suite_id}/cases")
async def remove_cases_from_suite(
    suite_id: int,
    request: SetupTestCaseInSuite,
    db: Session = Depends(get_database),
    suite_service = Depends(get_test_suite_service)
):
    """从测试用例集中移除测试用例"""
    success = suite_service.remove_cases_from_suite(db, suite_id, request.testcase_ids)
    if not success:
        raise HTTPException(status_code=404, detail="操作失败")
    return {"message": "用例移除成功"}
