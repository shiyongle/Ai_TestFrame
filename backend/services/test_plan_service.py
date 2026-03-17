from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from core.logging import setup_logging
from models.database_models import (
    InterfaceTestCase,
    Project,
    TestCase,
    TestPlan,
    TestPlanExecution,
    TestPlanFunctionalCase,
    TestPlanInterfaceCase,
)
from schemas.response_schemas import HttpTestRequest, MqTestRequest, TcpTestRequest
from schemas.test_plan_schemas import TestPlanCreate, TestPlanUpdate

logger = setup_logging()[0]


class TestPlanService:
    """测试计划管理服务类"""

    def get_test_plans(self, db: Session, project_id: Optional[int] = None) -> List[TestPlan]:
        query = db.query(TestPlan)
        if project_id:
            query = query.filter(TestPlan.project_id == project_id)
        return query.order_by(TestPlan.updated_at.desc()).all()

    def get_test_plan(self, db: Session, plan_id: int) -> Optional[TestPlan]:
        return db.query(TestPlan).filter(TestPlan.id == plan_id).first()

    def create_test_plan(self, db: Session, payload: TestPlanCreate) -> TestPlan:
        self._ensure_project_exists(db, payload.project_id)
        self._validate_case_ids(db, payload.project_id, payload.functional_case_ids, payload.interface_case_ids)

        plan = TestPlan(
            name=payload.name,
            description=payload.description,
            project_id=payload.project_id,
            owner=payload.owner,
            status=payload.status,
            execution_mode=payload.execution_mode,
            priority=payload.priority,
            entry_criteria=payload.entry_criteria,
            exit_criteria=payload.exit_criteria,
            schedule=payload.schedule,
            tags=payload.tags or [],
        )
        db.add(plan)
        db.flush()
        self._replace_plan_cases(db, plan.id, payload.functional_case_ids, payload.interface_case_ids)
        db.commit()
        db.refresh(plan)
        return plan

    def update_test_plan(self, db: Session, plan_id: int, payload: TestPlanUpdate) -> Optional[TestPlan]:
        plan = self.get_test_plan(db, plan_id)
        if not plan:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        functional_case_ids = update_data.pop("functional_case_ids", None)
        interface_case_ids = update_data.pop("interface_case_ids", None)
        next_project_id = update_data.get("project_id", plan.project_id)

        self._ensure_project_exists(db, next_project_id)
        self._validate_case_ids(
            db,
            next_project_id,
            functional_case_ids if functional_case_ids is not None else [item.testcase_id for item in plan.functional_cases],
            interface_case_ids if interface_case_ids is not None else [item.interface_testcase_id for item in plan.interface_cases],
        )

        for key, value in update_data.items():
            setattr(plan, key, value)

        if functional_case_ids is not None or interface_case_ids is not None:
            self._replace_plan_cases(
                db,
                plan.id,
                functional_case_ids if functional_case_ids is not None else [item.testcase_id for item in plan.functional_cases],
                interface_case_ids if interface_case_ids is not None else [item.interface_testcase_id for item in plan.interface_cases],
            )

        db.commit()
        db.refresh(plan)
        return plan

    def delete_test_plan(self, db: Session, plan_id: int) -> bool:
        plan = self.get_test_plan(db, plan_id)
        if not plan:
            return False
        db.delete(plan)
        db.commit()
        return True

    async def execute_test_plan(self, db: Session, plan_id: int, execution_service) -> Optional[TestPlanExecution]:
        plan = self.get_test_plan(db, plan_id)
        if not plan:
            return None

        db_execution = TestPlanExecution(
            test_plan_id=plan.id,
            status="running",
            total_items=len(plan.functional_cases) + len(plan.interface_cases),
            summary={},
        )
        db.add(db_execution)
        db.commit()
        db.refresh(db_execution)

        details: List[Dict[str, Any]] = []
        counters = {"passed": 0, "failed": 0, "error": 0, "skipped": 0}

        try:
            for item in sorted(plan.functional_cases, key=lambda x: (x.order_index, x.id)):
                result = await self._execute_functional_case(item.testcase, execution_service)
                details.append(result)
                counters[result["status"]] += 1

            for item in sorted(plan.interface_cases, key=lambda x: (x.order_index, x.id)):
                result = await self._execute_interface_case(db, item.interface_testcase, execution_service)
                details.append(result)
                counters[result["status"]] += 1

            final_status = "completed"
            if counters["failed"] or counters["error"]:
                final_status = "completed_with_issues"

            db_execution.status = final_status
            db_execution.passed_items = counters["passed"]
            db_execution.failed_items = counters["failed"]
            db_execution.error_items = counters["error"]
            db_execution.skipped_items = counters["skipped"]
            db_execution.summary = {
                "details": details,
                "functional_case_count": len(plan.functional_cases),
                "interface_case_count": len(plan.interface_cases),
            }
            db_execution.completed_at = datetime.utcnow()
            plan.last_executed_at = db_execution.completed_at
            plan.status = "completed" if final_status == "completed" else "running"
            db.commit()
            db.refresh(db_execution)
            return db_execution
        except Exception as exc:
            db.rollback()
            logger.error(f"执行测试计划失败: {plan_id} - {exc}")
            failed_execution = db.query(TestPlanExecution).filter(TestPlanExecution.id == db_execution.id).first()
            if failed_execution:
                failed_execution.status = "failed"
                failed_execution.completed_at = datetime.utcnow()
                failed_execution.summary = {"error": str(exc), "details": details}
                db.commit()
                db.refresh(failed_execution)
                return failed_execution
            raise

    def build_plan_response(self, plan: TestPlan) -> Dict[str, Any]:
        latest_execution = None
        if plan.executions:
            latest_execution_obj = sorted(
                plan.executions,
                key=lambda item: item.started_at or datetime.min,
                reverse=True,
            )[0]
            latest_execution = self._serialize_execution(latest_execution_obj)

        functional_cases = [
            self._serialize_functional_case(item.testcase)
            for item in sorted(plan.functional_cases, key=lambda x: (x.order_index, x.id))
            if item.testcase
        ]
        interface_cases = [
            self._serialize_interface_case(item.interface_testcase)
            for item in sorted(plan.interface_cases, key=lambda x: (x.order_index, x.id))
            if item.interface_testcase
        ]

        return {
            "id": plan.id,
            "name": plan.name,
            "description": plan.description,
            "project_id": plan.project_id,
            "owner": plan.owner,
            "status": plan.status,
            "execution_mode": plan.execution_mode,
            "priority": plan.priority,
            "entry_criteria": plan.entry_criteria,
            "exit_criteria": plan.exit_criteria,
            "schedule": plan.schedule,
            "tags": plan.tags or [],
            "created_at": plan.created_at,
            "updated_at": plan.updated_at,
            "last_executed_at": plan.last_executed_at,
            "functional_cases": functional_cases,
            "interface_cases": interface_cases,
            "latest_execution": latest_execution,
            "total_case_count": len(functional_cases) + len(interface_cases),
        }

    def _ensure_project_exists(self, db: Session, project_id: int) -> None:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError("项目不存在")

    def _validate_case_ids(
        self,
        db: Session,
        project_id: int,
        functional_case_ids: List[int],
        interface_case_ids: List[int],
    ) -> None:
        if functional_case_ids:
            count = db.query(TestCase).filter(
                TestCase.project_id == project_id,
                TestCase.id.in_(functional_case_ids),
            ).count()
            if count != len(set(functional_case_ids)):
                raise ValueError("部分功能测试用例不存在或不属于当前项目")

        if interface_case_ids:
            count = db.query(InterfaceTestCase).filter(
                InterfaceTestCase.project_id == project_id,
                InterfaceTestCase.id.in_(interface_case_ids),
            ).count()
            if count != len(set(interface_case_ids)):
                raise ValueError("部分接口测试用例不存在或不属于当前项目")

    def _replace_plan_cases(
        self,
        db: Session,
        plan_id: int,
        functional_case_ids: List[int],
        interface_case_ids: List[int],
    ) -> None:
        db.query(TestPlanFunctionalCase).filter(TestPlanFunctionalCase.test_plan_id == plan_id).delete()
        db.query(TestPlanInterfaceCase).filter(TestPlanInterfaceCase.test_plan_id == plan_id).delete()

        for index, case_id in enumerate(functional_case_ids):
            db.add(TestPlanFunctionalCase(test_plan_id=plan_id, testcase_id=case_id, order_index=index))

        for index, case_id in enumerate(interface_case_ids):
            db.add(TestPlanInterfaceCase(test_plan_id=plan_id, interface_testcase_id=case_id, order_index=index))

        db.flush()

    async def _execute_functional_case(self, testcase: Optional[TestCase], execution_service) -> Dict[str, Any]:
        if not testcase:
            return {"case_type": "functional", "status": "error", "message": "功能用例不存在"}

        config = testcase.config or {}
        protocol = str(testcase.protocol or "").lower()

        try:
            if protocol == "http" and config.get("url"):
                response = await execution_service.execute_http_test(
                    HttpTestRequest(
                        url=config.get("url"),
                        method=str(config.get("method", "GET")).upper(),
                        headers=config.get("headers") or {},
                        params=config.get("params") or {},
                        body=config.get("body"),
                        timeout=int(config.get("timeout", 30)),
                        verify_ssl=bool(config.get("verify_ssl", True)),
                        follow_redirects=bool(config.get("follow_redirects", True)),
                    )
                )
                return self._build_result_payload("functional", testcase.id, testcase.name, response.success, response.error_message)

            if protocol == "tcp" and config.get("host") and config.get("port"):
                response = await execution_service.execute_tcp_test(
                    TcpTestRequest(
                        host=config.get("host"),
                        port=int(config.get("port")),
                        data=str(config.get("data", "")),
                        timeout=int(config.get("timeout", 30)),
                        encoding=str(config.get("encoding", "utf-8")),
                    )
                )
                return self._build_result_payload("functional", testcase.id, testcase.name, response.success, response.error_message)

            if protocol == "mq" and config.get("host") and config.get("queue_name"):
                response = await execution_service.execute_mq_test(
                    MqTestRequest(
                        host=config.get("host"),
                        port=int(config.get("port", 5672)),
                        queue_name=config.get("queue_name"),
                        message=str(config.get("message", "")),
                        exchange=config.get("exchange"),
                        routing_key=config.get("routing_key"),
                        timeout=int(config.get("timeout", 30)),
                        mq_type=str(config.get("mq_type", "rabbitmq")),
                        username=str(config.get("username", "guest")),
                        password=str(config.get("password", "guest")),
                    )
                )
                return self._build_result_payload("functional", testcase.id, testcase.name, response.success, response.error_message)

            return {
                "case_type": "functional",
                "case_id": testcase.id,
                "case_name": testcase.name,
                "status": "skipped",
                "message": "功能用例缺少可自动执行的协议配置，已跳过",
            }
        except Exception as exc:
            return {
                "case_type": "functional",
                "case_id": testcase.id,
                "case_name": testcase.name,
                "status": "error",
                "message": str(exc),
            }

    async def _execute_interface_case(self, db: Session, testcase: Optional[InterfaceTestCase], execution_service) -> Dict[str, Any]:
        if not testcase:
            return {"case_type": "interface", "status": "error", "message": "接口用例不存在"}

        protocol = str(testcase.protocol or "").lower()
        try:
            if protocol == "http":
                response = await execution_service.execute_http_test(
                    HttpTestRequest(
                        url=testcase.url or "",
                        method=str(testcase.method or "GET").upper(),
                        headers=testcase.headers or {},
                        params=testcase.params or {},
                        body=testcase.body,
                    )
                )
            elif protocol == "tcp":
                response = await execution_service.execute_tcp_test(
                    TcpTestRequest(
                        host=(testcase.params or {}).get("host", ""),
                        port=int((testcase.params or {}).get("port", 0)),
                        data=testcase.body or "",
                        timeout=int((testcase.params or {}).get("timeout", 30)),
                        encoding=str((testcase.params or {}).get("encoding", "utf-8")),
                    )
                )
            elif protocol == "mq":
                response = await execution_service.execute_mq_test(
                    MqTestRequest(
                        host=(testcase.params or {}).get("host", ""),
                        port=int((testcase.params or {}).get("port", 5672)),
                        queue_name=(testcase.params or {}).get("queue_name", ""),
                        message=testcase.body or "",
                        exchange=(testcase.params or {}).get("exchange"),
                        routing_key=(testcase.params or {}).get("routing_key"),
                        timeout=int((testcase.params or {}).get("timeout", 30)),
                        mq_type=str((testcase.params or {}).get("mq_type", "rabbitmq")),
                        username=str((testcase.params or {}).get("username", "guest")),
                        password=str((testcase.params or {}).get("password", "guest")),
                    )
                )
            else:
                return {
                    "case_type": "interface",
                    "case_id": testcase.id,
                    "case_name": testcase.name,
                    "status": "skipped",
                    "message": "暂不支持该接口协议",
                }

            testcase.last_run_status = "pass" if response.success else "fail"
            testcase.last_run_time = datetime.utcnow()
            db.flush()
            return self._build_result_payload("interface", testcase.id, testcase.name, response.success, response.error_message)
        except Exception as exc:
            return {
                "case_type": "interface",
                "case_id": testcase.id,
                "case_name": testcase.name,
                "status": "error",
                "message": str(exc),
            }

    def _build_result_payload(
        self,
        case_type: str,
        case_id: int,
        case_name: str,
        success: bool,
        error_message: Optional[str],
    ) -> Dict[str, Any]:
        return {
            "case_type": case_type,
            "case_id": case_id,
            "case_name": case_name,
            "status": "passed" if success else "failed",
            "message": error_message or ("执行成功" if success else "执行失败"),
        }

    def _serialize_functional_case(self, testcase: TestCase) -> Dict[str, Any]:
        config = testcase.config or {}
        return {
            "id": testcase.id,
            "name": testcase.name,
            "description": testcase.description,
            "protocol": testcase.protocol,
            "priority": config.get("priority"),
            "project_id": testcase.project_id,
            "case_type": "functional",
            "module": config.get("module"),
            "method": config.get("method"),
            "url": config.get("url"),
        }

    def _serialize_interface_case(self, testcase: InterfaceTestCase) -> Dict[str, Any]:
        return {
            "id": testcase.id,
            "name": testcase.name,
            "description": testcase.description,
            "protocol": testcase.protocol,
            "priority": testcase.priority,
            "project_id": testcase.project_id,
            "case_type": "interface",
            "module": testcase.module,
            "method": testcase.method,
            "url": testcase.url,
        }

    def _serialize_execution(self, execution: TestPlanExecution) -> Dict[str, Any]:
        return {
            "id": execution.id,
            "test_plan_id": execution.test_plan_id,
            "status": execution.status,
            "total_items": execution.total_items,
            "passed_items": execution.passed_items,
            "failed_items": execution.failed_items,
            "error_items": execution.error_items,
            "skipped_items": execution.skipped_items,
            "summary": execution.summary,
            "started_at": execution.started_at,
            "completed_at": execution.completed_at,
        }
