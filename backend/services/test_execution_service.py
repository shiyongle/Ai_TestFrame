from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from models.database_models import TestReport, BatchTestTask
from schemas.response_schemas import HttpTestRequest, HttpTestResponse, TcpTestRequest, TcpTestResponse, MqTestRequest, MqTestResponse, BatchTestRequest
from utils.http_client import HttpClient
from utils.tcp_client import TcpClient
from utils.mq_client import MqClient
from core.logging import setup_logging
import uuid
import asyncio

logger = setup_logging()[0]


class TestExecutionService:
    """测试执行服务类"""
    
    def __init__(self):
        self.http_client = None
        self.tcp_client = TcpClient()
        self.mq_client = MqClient()
    
    async def execute_http_test(self, request: HttpTestRequest) -> HttpTestResponse:
        """执行HTTP接口测试"""
        try:
            async with HttpClient(timeout=request.timeout) as client:
                result = await client.request(
                    method=request.method,
                    url=request.url,
                    headers=request.headers,
                    params=request.params,
                    data=request.body,
                    verify_ssl=request.verify_ssl,
                    follow_redirects=request.follow_redirects
                )
                
                logger.info(f"HTTP测试完成: {request.method} {request.url}")
                return HttpTestResponse(**result)
        except Exception as e:
            logger.error(f"HTTP测试失败: {request.method} {request.url} - {str(e)}")
            return HttpTestResponse(
                status_code=0,
                headers={},
                body=None,
                execution_time=0,
                success=False,
                error_message=str(e)
            )
    
    async def execute_tcp_test(self, request: TcpTestRequest) -> TcpTestResponse:
        """执行TCP接口测试"""
        try:
            result = await self.tcp_client.connect(
                host=request.host,
                port=request.port,
                data=request.data,
                encoding=request.encoding,
                timeout=request.timeout
            )
            
            logger.info(f"TCP测试完成: {request.host}:{request.port}")
            return TcpTestResponse(**result)
        except Exception as e:
            logger.error(f"TCP测试失败: {request.host}:{request.port} - {str(e)}")
            return TcpTestResponse(
                success=False,
                response_data=None,
                execution_time=0,
                error_message=str(e)
            )
    
    async def execute_mq_test(self, request: MqTestRequest) -> MqTestResponse:
        """执行MQ接口测试"""
        try:
            result = await self.mq_client.send_message(
                mq_type=request.mq_type,
                host=request.host,
                port=request.port,
                queue_name=request.queue_name,
                message=request.message,
                exchange=request.exchange,
                routing_key=request.routing_key,
                username=request.username,
                password=request.password,
                timeout=request.timeout
            )
            
            logger.info(f"MQ测试完成: {request.mq_type} {request.host}:{request.port}")
            return MqTestResponse(**result)
        except Exception as e:
            logger.error(f"MQ测试失败: {request.mq_type} {request.host}:{request.port} - {str(e)}")
            return MqTestResponse(
                success=False,
                message_id=None,
                response_data=None,
                execution_time=0,
                error_message=str(e)
            )
    
    async def execute_batch_test(self, db: Session, batch_request: BatchTestRequest) -> str:
        """执行批量测试"""
        task_id = str(uuid.uuid4())
        
        try:
            # 创建批量测试任务记录
            batch_task = BatchTestTask(
                task_id=task_id,
                project_id=batch_request.project_id,
                testcase_ids=",".join(map(str, batch_request.testcase_ids)),
                status="running",
                total_tests=len(batch_request.testcase_ids),
                passed_tests=0,
                failed_tests=0,
                error_tests=0
            )
            db.add(batch_task)
            db.commit()
            
            logger.info(f"批量测试任务创建成功: {task_id}")
            
            # TODO: 这里应该使用Celery或其他任务队列异步执行
            # 目前简化实现，直接在后台任务中执行
            # await self._execute_batch_test_async(db, task_id, batch_request)
            
            return task_id
        except Exception as e:
            logger.error(f"创建批量测试任务失败: {str(e)}")
            db.rollback()
            raise e
    
    async def get_batch_test_status(self, db: Session, task_id: str) -> Optional[Dict[str, Any]]:
        """获取批量测试任务状态"""
        try:
            task = db.query(BatchTestTask).filter(BatchTestTask.task_id == task_id).first()
            if not task:
                return None
            
            return {
                "task_id": task.task_id,
                "status": task.status,
                "total_tests": task.total_tests,
                "passed_tests": task.passed_tests,
                "failed_tests": task.failed_tests,
                "error_tests": task.error_tests,
                "created_at": task.created_at,
                "completed_at": task.completed_at
            }
        except Exception as e:
            logger.error(f"获取批量测试任务状态失败: {task_id} - {str(e)}")
            raise e
    
    def get_test_report(self, db: Session, report_id: int) -> Optional[TestReport]:
        """获取测试报告"""
        try:
            report = db.query(TestReport).filter(TestReport.id == report_id).first()
            if report:
                logger.info(f"获取测试报告成功: ID {report_id}")
            else:
                logger.warning(f"测试报告不存在: ID {report_id}")
            return report
        except Exception as e:
            logger.error(f"获取测试报告失败: ID {report_id} - {str(e)}")
            raise e
    
    async def generate_test_report(self, db: Session, project_id: int, version_id: Optional[int] = None) -> TestReport:
        """生成测试报告"""
        try:
            from models.database_models import TestCase, TestResult
            
            # 获取项目的所有测试用例
            testcases = db.query(TestCase).filter(TestCase.project_id == project_id).all()
            
            # 获取所有测试结果
            results = db.query(TestResult).join(TestCase).filter(TestCase.project_id == project_id).all()
            
            # 统计测试结果
            total_tests = len(testcases)
            passed_tests = len([r for r in results if r.status == "passed"])
            failed_tests = len([r for r in results if r.status == "failed"])
            error_tests = len([r for r in results if r.status == "error"])
            
            # 计算成功率
            success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
            
            # 生成报告摘要
            summary = {
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "failed_tests": failed_tests,
                "error_tests": error_tests,
                "success_rate": success_rate,
                "average_execution_time": sum(r.execution_time for r in results) / len(results) if results else 0
            }
            
            # 创建测试报告
            report = TestReport(
                version_id=version_id,
                project_id=project_id,
                total_tests=total_tests,
                passed_tests=passed_tests,
                failed_tests=failed_tests,
                error_tests=error_tests,
                summary=str(summary)
            )
            
            db.add(report)
            db.commit()
            db.refresh(report)
            
            logger.info(f"生成测试报告成功: 项目ID {project_id}，报告ID {report.id}")
            return report
        except Exception as e:
            logger.error(f"生成测试报告失败: 项目ID {project_id} - {str(e)}")
            db.rollback()
            raise e