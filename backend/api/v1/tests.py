from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from api.deps import get_database, get_test_execution_service
from schemas.response_schemas import (
    HttpTestRequest, HttpTestResponse,
    TcpTestRequest, TcpTestResponse,
    MqTestRequest, MqTestResponse,
    BatchTestRequest
)

router = APIRouter()


@router.post("/test/http", response_model=HttpTestResponse)
async def test_http_interface(
    test_request: HttpTestRequest,
    test_execution_service = Depends(get_test_execution_service)
):
    """执行HTTP接口测试"""
    try:
        result = await test_execution_service.execute_http_test(test_request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test/tcp", response_model=TcpTestResponse)
async def test_tcp_interface(
    test_request: TcpTestRequest,
    test_execution_service = Depends(get_test_execution_service)
):
    """执行TCP接口测试"""
    try:
        result = await test_execution_service.execute_tcp_test(test_request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test/mq", response_model=MqTestResponse)
async def test_mq_interface(
    test_request: MqTestRequest,
    test_execution_service = Depends(get_test_execution_service)
):
    """执行MQ接口测试"""
    try:
        result = await test_execution_service.execute_mq_test(test_request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test/batch")
async def execute_batch_test(
    batch_request: BatchTestRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_database),
    test_execution_service = Depends(get_test_execution_service)
):
    """执行批量测试"""
    try:
        task_id = await test_execution_service.execute_batch_test(db, batch_request)
        return {"task_id": task_id, "message": "批量测试已开始执行"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test/batch/{task_id}")
async def get_batch_test_status(
    task_id: str,
    db: Session = Depends(get_database),
    test_execution_service = Depends(get_test_execution_service)
):
    """获取批量测试任务状态"""
    try:
        status = await test_execution_service.get_batch_test_status(db, task_id)
        if not status:
            raise HTTPException(status_code=404, detail="批量测试任务不存在")
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/{report_id}")
async def get_test_report(
    report_id: int,
    db: Session = Depends(get_database),
    test_execution_service = Depends(get_test_execution_service)
):
    """获取测试报告"""
    report = test_execution_service.get_test_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report


@router.post("/projects/{project_id}/reports")
async def generate_test_report(
    project_id: int,
    version_id: int = None,
    db: Session = Depends(get_database),
    test_execution_service = Depends(get_test_execution_service)
):
    """生成测试报告"""
    try:
        report = await test_execution_service.generate_test_report(db, project_id, version_id)
        return {"report_id": report.id, "message": "测试报告生成成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))