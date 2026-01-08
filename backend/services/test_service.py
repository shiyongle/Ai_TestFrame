from sqlalchemy.orm import Session
from database import Project, TestCase, TestResult, Version, TestReport, TestData
from schemas import *
from typing import List, Optional
from datetime import datetime
import json
import uuid

class TestService:
    """测试服务类"""
    
    def create_project(self, db: Session, project: ProjectCreate) -> Project:
        """创建测试项目"""
        db_project = Project(**project.dict())
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        return db_project
    
    def get_projects(self, db: Session) -> List[Project]:
        """获取所有项目（按创建时间倒序）"""
        return db.query(Project).order_by(Project.created_at.desc()).all()
    
    def get_project(self, db: Session, project_id: int) -> Optional[Project]:
        """获取指定项目"""
        return db.query(Project).filter(Project.id == project_id).first()
    
    def create_testcase(self, db: Session, project_id: int, testcase: TestCaseCreate) -> TestCase:
        """创建测试用例"""
        db_testcase = TestCase(**testcase.dict(), project_id=project_id)
        db.add(db_testcase)
        db.commit()
        db.refresh(db_testcase)
        return db_testcase
    
    def get_testcases(self, db: Session, project_id: int) -> List[TestCase]:
        """获取项目的测试用例"""
        return db.query(TestCase).filter(TestCase.project_id == project_id).all()
    
    async def test_http(self, request: HttpTestRequest) -> HttpTestResponse:
        """执行HTTP接口测试"""
        import aiohttp
        import time
        
        start_time = time.time()
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.request(
                    method=request.method,
                    url=request.url,
                    headers=request.headers,
                    params=request.params,
                    json=request.body if isinstance(request.body, dict) else None,
                    data=request.body if not isinstance(request.body, dict) else None,
                    timeout=aiohttp.ClientTimeout(total=request.timeout),
                    ssl=request.verify_ssl,
                    allow_redirects=request.follow_redirects
                ) as response:
                    execution_time = int((time.time() - start_time) * 1000)
                    
                    try:
                        body = await response.json()
                    except:
                        body = await response.text()
                    
                    return HttpTestResponse(
                        status_code=response.status,
                        headers=dict(response.headers),
                        body=body,
                        execution_time=execution_time,
                        success=200 <= response.status < 400,
                        error_message=None if 200 <= response.status < 400 else f"HTTP状态码: {response.status}"
                    )
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            return HttpTestResponse(
                status_code=0,
                headers={},
                body=None,
                execution_time=execution_time,
                success=False,
                error_message=str(e)
            )
    
    async def test_tcp(self, request: TcpTestRequest) -> TcpTestResponse:
        """执行TCP接口测试"""
        import asyncio
        import time
        
        start_time = time.time()
        
        try:
            future = asyncio.open_connection(request.host, request.port)
            reader, writer = await asyncio.wait_for(future, timeout=request.timeout)
            
            # 发送数据
            writer.write(request.data.encode(request.encoding))
            await writer.drain()
            
            # 接收响应
            response_data = await asyncio.wait_for(reader.read(1024), timeout=request.timeout)
            response_str = response_data.decode(request.encoding)
            
            writer.close()
            await writer.wait_closed()
            
            execution_time = int((time.time() - start_time) * 1000)
            
            return TcpTestResponse(
                success=True,
                response_data=response_str,
                execution_time=execution_time,
                error_message=None
            )
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            return TcpTestResponse(
                success=False,
                response_data=None,
                execution_time=execution_time,
                error_message=str(e)
            )
    
    async def test_mq(self, request: MqTestRequest) -> MqTestResponse:
        """执行MQ接口测试"""
        import time
        import pika
        import uuid
        
        start_time = time.time()
        
        try:
            if request.mq_type == "rabbitmq":
                credentials = pika.PlainCredentials('guest', 'guest')
                connection = pika.BlockingConnection(
                    pika.ConnectionParameters(
                        host=request.host,
                        port=request.port,
                        credentials=credentials,
                        connection_timeout=request.timeout
                    )
                )
                
                channel = connection.channel()
                
                # 声明队列
                channel.queue_declare(queue=request.queue_name)
                
                # 发送消息
                message_id = str(uuid.uuid4())
                channel.basic_publish(
                    exchange=request.exchange or '',
                    routing_key=request.routing_key or request.queue_name,
                    body=request.message.encode('utf-8'),
                    properties=pika.BasicProperties(
                        message_id=message_id,
                        content_type='text/plain'
                    )
                )
                
                connection.close()
                
                execution_time = int((time.time() - start_time) * 1000)
                
                return MqTestResponse(
                    success=True,
                    message_id=message_id,
                    response_data=f"消息已发送到队列: {request.queue_name}",
                    execution_time=execution_time,
                    error_message=None
                )
            else:
                return MqTestResponse(
                    success=False,
                    message_id=None,
                    response_data=None,
                    execution_time=int((time.time() - start_time) * 1000),
                    error_message=f"暂不支持MQ类型: {request.mq_type}"
                )
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            return MqTestResponse(
                success=False,
                message_id=None,
                response_data=None,
                execution_time=execution_time,
                error_message=str(e)
            )
    
    async def execute_batch_test(self, batch_request: BatchTestRequest, background_tasks) -> str:
        """执行批量测试"""
        task_id = str(uuid.uuid4())
        
        # 这里应该使用Celery或其他任务队列
        # 简化实现，直接返回任务ID
        return task_id
    
    def get_test_report(self, db: Session, report_id: int) -> Optional[TestReport]:
        """获取测试报告"""
        return db.query(TestReport).filter(TestReport.id == report_id).first()

class VersionService:
    """版本管理服务类"""
    
    def create_version(self, db: Session, version: VersionCreate) -> Version:
        """创建版本记录"""
        db_version = Version(**version.dict())
        db.add(db_version)
        db.commit()
        db.refresh(db_version)
        return db_version
    
    def get_versions(self, db: Session) -> List[Version]:
        """获取版本历史"""
        return db.query(Version).order_by(Version.created_at.desc()).all()
    
    def get_version(self, db: Session, version_id: int) -> Optional[Version]:
        """获取指定版本"""
        return db.query(Version).filter(Version.id == version_id).first()
