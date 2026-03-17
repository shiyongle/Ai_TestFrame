from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.deps import get_database, get_test_execution_service, get_test_plan_service
from schemas.test_plan_schemas import TestPlanCreate, TestPlanExecutionResponse, TestPlanResponse, TestPlanUpdate
from utils.activity_logger import log_activity

router = APIRouter()


@router.post("/test-plans", response_model=TestPlanResponse)
async def create_test_plan(
    payload: TestPlanCreate,
    db: Session = Depends(get_database),
    plan_service = Depends(get_test_plan_service),
):
    try:
        plan = plan_service.create_test_plan(db, payload)
        log_activity(db, action="create", module="测试计划", target_name=plan.name, detail=f"计划ID={plan.id}")
        return plan_service.build_plan_response(plan)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"创建测试计划失败: {exc}")


@router.get("/test-plans", response_model=List[TestPlanResponse])
async def get_test_plans(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_database),
    plan_service = Depends(get_test_plan_service),
):
    plans = plan_service.get_test_plans(db, project_id)
    return [plan_service.build_plan_response(plan) for plan in plans]


@router.get("/test-plans/{plan_id}", response_model=TestPlanResponse)
async def get_test_plan(
    plan_id: int,
    db: Session = Depends(get_database),
    plan_service = Depends(get_test_plan_service),
):
    plan = plan_service.get_test_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="测试计划不存在")
    return plan_service.build_plan_response(plan)


@router.put("/test-plans/{plan_id}", response_model=TestPlanResponse)
async def update_test_plan(
    plan_id: int,
    payload: TestPlanUpdate,
    db: Session = Depends(get_database),
    plan_service = Depends(get_test_plan_service),
):
    try:
        plan = plan_service.update_test_plan(db, plan_id, payload)
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="测试计划不存在")
        log_activity(db, action="update", module="测试计划", target_name=plan.name, detail=f"计划ID={plan.id}")
        return plan_service.build_plan_response(plan)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/test-plans/{plan_id}")
async def delete_test_plan(
    plan_id: int,
    db: Session = Depends(get_database),
    plan_service = Depends(get_test_plan_service),
):
    plan = plan_service.get_test_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="测试计划不存在")
    success = plan_service.delete_test_plan(db, plan_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="测试计划不存在")
    log_activity(db, action="delete", module="测试计划", target_name=plan.name, detail=f"计划ID={plan_id}")
    return {"message": "测试计划删除成功"}


@router.post("/test-plans/{plan_id}/execute", response_model=TestPlanExecutionResponse)
async def execute_test_plan(
    plan_id: int,
    db: Session = Depends(get_database),
    plan_service = Depends(get_test_plan_service),
    execution_service = Depends(get_test_execution_service),
):
    plan = plan_service.get_test_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="测试计划不存在")
    try:
        execution = await plan_service.execute_test_plan(db, plan_id, execution_service)
        log_activity(db, action="execute", module="测试计划", target_name=plan.name, detail=f"执行记录ID={execution.id}")
        return execution
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"执行测试计划失败: {exc}")
