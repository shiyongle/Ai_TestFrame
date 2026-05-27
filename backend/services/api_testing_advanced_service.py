import asyncio
import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from models.database_models import (
    ApiContractSchema,
    ApiInterfaceChangeLog,
    ApiMockEndpoint,
    ApiMonitorProbe,
    ApiTestCollection,
    ApiTestCollectionItem,
    ApiTestRun,
    ApiTestRunItem,
    InterfaceTestCase,
)
from schemas.response_schemas import HttpTestRequest
from services.interface_import_service import InterfaceImportService
from services.test_execution_service import TestExecutionService


class ApiTestingAdvancedService:
    def __init__(self):
        self.execution_service = TestExecutionService()
        self.import_service = InterfaceImportService()

    def list_collections(self, db: Session, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        query = db.query(ApiTestCollection)
        if project_id:
            query = query.filter(ApiTestCollection.project_id == project_id)
        rows = query.order_by(ApiTestCollection.updated_at.desc()).all()
        return [self.serialize_collection(row) for row in rows]

    def create_collection(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        items = payload.pop("items", []) or []
        collection = ApiTestCollection(**payload)
        db.add(collection)
        db.flush()
        for index, item in enumerate(items):
            db.add(
                ApiTestCollectionItem(
                    collection_id=collection.id,
                    interface_testcase_id=item["interface_testcase_id"],
                    order_index=item.get("order_index", index),
                    enabled=item.get("enabled", True),
                    extractors=item.get("extractors"),
                    assertions=item.get("assertions"),
                )
            )
        db.commit()
        db.refresh(collection)
        return self.serialize_collection(collection)

    async def sync_openapi_document(
        self,
        db: Session,
        docs_url: str,
        project_id: int,
        module: Optional[str] = None,
        max_cases: int = 300,
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            response = await client.get(docs_url)
            response.raise_for_status()

        file_name = self._doc_file_name(docs_url, response.headers.get("content-type", ""))
        cases_payload, source_type = self.import_service.parse_file(
            file_name=file_name,
            file_bytes=response.content,
            project_id=project_id,
            module=module or "接口文档同步",
            max_cases=max(1, min(max_cases, 1000)),
        )

        created = 0
        updated = 0
        skipped = 0
        changed_case_ids: List[int] = []
        for payload in cases_payload:
            method = str(payload.get("method") or "GET").upper()
            url = str(payload.get("url") or "")
            if not url:
                skipped += 1
                continue
            existing = (
                db.query(InterfaceTestCase)
                .filter(
                    InterfaceTestCase.project_id == project_id,
                    InterfaceTestCase.method == method,
                    InterfaceTestCase.url == url,
                )
                .first()
            )
            if existing:
                old_snapshot = self._case_snapshot(existing)
                for key, value in payload.items():
                    if hasattr(existing, key):
                        setattr(existing, key, value)
                self.record_interface_change(
                    db,
                    existing,
                    old_snapshot,
                    source="docs_sync",
                    operator="system",
                    commit=False,
                )
                updated += 1
                changed_case_ids.append(existing.id)
            else:
                obj = InterfaceTestCase(**payload)
                db.add(obj)
                db.flush()
                created += 1
                changed_case_ids.append(obj.id)

        db.commit()
        return {
            "source_type": source_type,
            "docs_url": docs_url,
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "total": created + updated,
            "case_ids": changed_case_ids,
        }

    async def run_collection(
        self,
        db: Session,
        collection_id: int,
        environment_id: Optional[int] = None,
        iterations: int = 1,
        data_pool_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        collection = db.query(ApiTestCollection).filter(ApiTestCollection.id == collection_id).first()
        if not collection:
            raise ValueError("接口测试集合不存在")
        env_id = environment_id or collection.environment_id
        run = ApiTestRun(
            collection_id=collection.id,
            project_id=collection.project_id,
            environment_id=env_id,
            status="running",
            total_items=0,
            passed_items=0,
            failed_items=0,
            context_snapshot={},
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        started = time.perf_counter()
        context_vars: Dict[str, Any] = {}
        passed = 0
        failed = 0
        total = 0

        for _ in range(max(1, iterations)):
            for item in sorted(collection.items, key=lambda x: x.order_index or 0):
                if not item.enabled or not item.interface_testcase:
                    continue
                total += 1
                case = item.interface_testcase
                request = self._case_to_http_request(
                    case,
                    environment_id=env_id,
                    data_pool_id=data_pool_id,
                    variable_overrides=context_vars,
                    pre_script=collection.pre_script,
                    post_script=collection.post_script,
                    extractors=item.extractors or [],
                )
                response = await self.execution_service.execute_http_test(request, db)
                contract_results = self._validate_contracts(db, case.id, response)
                custom_results = self._validate_assertions(item.assertions or [], response)
                assertion_results = contract_results + custom_results
                ok = response.success and all(row["passed"] for row in assertion_results)
                if ok:
                    passed += 1
                else:
                    failed += 1
                context_vars.update(response.extracted_variables or {})
                db.add(
                    ApiTestRunItem(
                        run_id=run.id,
                        collection_item_id=item.id,
                        interface_testcase_id=case.id,
                        name=case.name,
                        status="passed" if ok else "failed",
                        status_code=response.status_code,
                        duration_ms=response.execution_time,
                        assertions=assertion_results,
                        extracted_variables=response.extracted_variables,
                        error_message=response.error_message,
                        response_snapshot={
                            "headers": response.headers,
                            "body": response.body,
                            "resolved_request": response.resolved_request,
                        },
                    )
                )

        run.status = "passed" if failed == 0 else "failed"
        run.total_items = total
        run.passed_items = passed
        run.failed_items = failed
        run.duration_ms = int((time.perf_counter() - started) * 1000)
        run.context_snapshot = context_vars
        run.summary = {"pass_rate": round(passed / total * 100, 1) if total else 0}
        run.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(run)
        return self.serialize_run(run, include_items=True)

    def list_runs(self, db: Session, collection_id: Optional[int] = None, limit: int = 20) -> List[Dict[str, Any]]:
        query = db.query(ApiTestRun)
        if collection_id:
            query = query.filter(ApiTestRun.collection_id == collection_id)
        rows = query.order_by(ApiTestRun.started_at.desc()).limit(limit).all()
        return [self.serialize_run(row, include_items=False) for row in rows]

    def create_mock(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        mock = ApiMockEndpoint(**payload)
        db.add(mock)
        db.commit()
        db.refresh(mock)
        return self.serialize_mock(mock)

    def list_mocks(self, db: Session, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        query = db.query(ApiMockEndpoint)
        if project_id:
            query = query.filter(ApiMockEndpoint.project_id == project_id)
        return [self.serialize_mock(row) for row in query.order_by(ApiMockEndpoint.updated_at.desc()).all()]

    async def serve_mock(self, db: Session, mock_key: str, method: str, path: str) -> Optional[Dict[str, Any]]:
        normalized = "/" + path.strip("/")
        mock = (
            db.query(ApiMockEndpoint)
            .filter(
                ApiMockEndpoint.mock_key == mock_key,
                ApiMockEndpoint.method == method.upper(),
                ApiMockEndpoint.path == normalized,
                ApiMockEndpoint.enabled.is_(True),
            )
            .first()
        )
        if not mock:
            return None
        if mock.delay_ms:
            await asyncio.sleep((mock.delay_ms or 0) / 1000)
        return self.serialize_mock(mock)

    def create_contract(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        contract = ApiContractSchema(**payload)
        db.add(contract)
        db.commit()
        db.refresh(contract)
        return self.serialize_contract(contract)

    def list_contracts(self, db: Session, interface_testcase_id: Optional[int] = None) -> List[Dict[str, Any]]:
        query = db.query(ApiContractSchema)
        if interface_testcase_id:
            query = query.filter(ApiContractSchema.interface_testcase_id == interface_testcase_id)
        return [self.serialize_contract(row) for row in query.order_by(ApiContractSchema.updated_at.desc()).all()]

    def create_monitor(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        probe = ApiMonitorProbe(**payload)
        db.add(probe)
        db.commit()
        db.refresh(probe)
        return self.serialize_monitor(probe)

    def list_monitors(self, db: Session) -> List[Dict[str, Any]]:
        return [self.serialize_monitor(row) for row in db.query(ApiMonitorProbe).order_by(ApiMonitorProbe.updated_at.desc()).all()]

    async def run_monitor(self, db: Session, probe_id: int) -> Dict[str, Any]:
        probe = db.query(ApiMonitorProbe).filter(ApiMonitorProbe.id == probe_id).first()
        if not probe or not probe.interface_testcase:
            raise ValueError("监控探测不存在")
        request = self._case_to_http_request(probe.interface_testcase, environment_id=probe.environment_id)
        response = await self.execution_service.execute_http_test(request, db)
        probe.last_status = "passed" if response.success else "failed"
        probe.last_status_code = response.status_code
        probe.last_latency_ms = response.execution_time
        probe.last_checked_at = datetime.utcnow()
        probe.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(probe)
        return self.serialize_monitor(probe)

    def record_interface_change(
        self,
        db: Session,
        case: InterfaceTestCase,
        old_snapshot: Dict[str, Any],
        source: str = "manual",
        operator: str = "system",
        commit: bool = False,
    ) -> None:
        new_snapshot = self._case_snapshot(case)
        diff = self._diff(old_snapshot, new_snapshot)
        if not diff:
            return
        db.add(
            ApiInterfaceChangeLog(
                interface_testcase_id=case.id,
                project_id=case.project_id,
                old_snapshot=old_snapshot,
                new_snapshot=new_snapshot,
                diff=diff,
                source=source,
                operator=operator,
            )
        )
        if commit:
            db.commit()

    def list_change_logs(self, db: Session, project_id: Optional[int] = None, limit: int = 50) -> List[Dict[str, Any]]:
        query = db.query(ApiInterfaceChangeLog)
        if project_id:
            query = query.filter(ApiInterfaceChangeLog.project_id == project_id)
        rows = query.order_by(ApiInterfaceChangeLog.created_at.desc()).limit(limit).all()
        return [
            {
                "id": row.id,
                "interface_testcase_id": row.interface_testcase_id,
                "project_id": row.project_id,
                "diff": row.diff or [],
                "source": row.source,
                "operator": row.operator,
                "created_at": self._dt(row.created_at),
            }
            for row in rows
        ]

    def asset_summary(self, db: Session, project_id: Optional[int] = None) -> Dict[str, Any]:
        case_query = db.query(InterfaceTestCase)
        mock_query = db.query(ApiMockEndpoint)
        collection_query = db.query(ApiTestCollection)
        contract_query = db.query(ApiContractSchema)
        monitor_query = db.query(ApiMonitorProbe)
        if project_id:
            case_query = case_query.filter(InterfaceTestCase.project_id == project_id)
            mock_query = mock_query.filter(ApiMockEndpoint.project_id == project_id)
            collection_query = collection_query.filter(ApiTestCollection.project_id == project_id)
            contract_query = contract_query.join(InterfaceTestCase).filter(InterfaceTestCase.project_id == project_id)
            monitor_query = monitor_query.join(InterfaceTestCase).filter(InterfaceTestCase.project_id == project_id)
        return {
            "interface_cases": case_query.count(),
            "collections": collection_query.count(),
            "mocks": mock_query.count(),
            "contracts": contract_query.count(),
            "monitors": monitor_query.count(),
        }

    def _doc_file_name(self, docs_url: str, content_type: str) -> str:
        lower_url = docs_url.lower()
        lower_type = content_type.lower()
        if lower_url.endswith((".yaml", ".yml")) or "yaml" in lower_type:
            return "openapi.yaml"
        return "openapi.json"

    def _case_to_http_request(
        self,
        case: InterfaceTestCase,
        environment_id: Optional[int] = None,
        data_pool_id: Optional[int] = None,
        variable_overrides: Optional[Dict[str, Any]] = None,
        pre_script: Optional[str] = None,
        post_script: Optional[str] = None,
        extractors: Optional[List[Dict[str, Any]]] = None,
    ) -> HttpTestRequest:
        body: Any = case.body
        if isinstance(body, str) and body.strip():
            try:
                body = json.loads(body)
            except Exception:
                pass
        return HttpTestRequest(
            url=case.url or "",
            method=case.method,
            headers=case.headers or {},
            params=case.params or {},
            body=body,
            timeout=30,
            verify_ssl=True,
            follow_redirects=True,
            environment_id=environment_id,
            data_pool_id=data_pool_id,
            variable_overrides=variable_overrides or {},
            pre_script=pre_script,
            post_script=post_script,
            extractors=extractors or [],
            persist_extracted=False,
        )

    def _validate_contracts(self, db: Session, case_id: int, response: Any) -> List[Dict[str, Any]]:
        contracts = db.query(ApiContractSchema).filter(
            ApiContractSchema.interface_testcase_id == case_id,
            ApiContractSchema.enabled.is_(True),
        ).all()
        results = []
        for contract in contracts:
            expected_codes = contract.expected_status_codes or []
            if expected_codes:
                results.append({
                    "name": f"{contract.name}: 状态码",
                    "passed": response.status_code in expected_codes,
                    "message": f"expected={expected_codes}, actual={response.status_code}",
                })
            if contract.response_schema:
                errors = self._validate_schema(response.body, contract.response_schema)
                results.append({
                    "name": f"{contract.name}: Schema",
                    "passed": not errors,
                    "message": "; ".join(errors[:5]) if errors else "schema matched",
                })
        return results

    def _validate_assertions(self, assertions: List[Dict[str, Any]], response: Any) -> List[Dict[str, Any]]:
        results = []
        for assertion in assertions:
            kind = assertion.get("type", "status_code")
            if kind == "status_code":
                expected = int(assertion.get("expected", 200))
                results.append({
                    "name": assertion.get("name") or "状态码断言",
                    "passed": response.status_code == expected,
                    "message": f"expected={expected}, actual={response.status_code}",
                })
        return results

    def _validate_schema(self, payload: Any, schema: Dict[str, Any], path: str = "$") -> List[str]:
        errors = []
        schema_type = schema.get("type")
        if schema_type == "object":
            if not isinstance(payload, dict):
                return [f"{path} expected object"]
            for field in schema.get("required", []) or []:
                if field not in payload:
                    errors.append(f"{path}.{field} required")
            props = schema.get("properties") or {}
            for key, child_schema in props.items():
                if key in payload and isinstance(child_schema, dict):
                    errors.extend(self._validate_schema(payload[key], child_schema, f"{path}.{key}"))
        elif schema_type == "array":
            if not isinstance(payload, list):
                return [f"{path} expected array"]
            item_schema = schema.get("items") or {}
            if payload and isinstance(item_schema, dict):
                errors.extend(self._validate_schema(payload[0], item_schema, f"{path}[0]"))
        elif schema_type == "string" and not isinstance(payload, str):
            errors.append(f"{path} expected string")
        elif schema_type == "integer" and not isinstance(payload, int):
            errors.append(f"{path} expected integer")
        elif schema_type == "number" and not isinstance(payload, (int, float)):
            errors.append(f"{path} expected number")
        elif schema_type == "boolean" and not isinstance(payload, bool):
            errors.append(f"{path} expected boolean")
        return errors

    def _case_snapshot(self, case: InterfaceTestCase) -> Dict[str, Any]:
        return {
            "name": case.name,
            "description": case.description,
            "method": case.method,
            "url": case.url,
            "headers": case.headers,
            "params": case.params,
            "body": case.body,
            "assertions": case.assertions,
            "module": case.module,
            "priority": case.priority,
            "status": case.status,
        }

    def _diff(self, before: Dict[str, Any], after: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            {"field": key, "before": before.get(key), "after": after.get(key)}
            for key in sorted(set(before.keys()) | set(after.keys()))
            if before.get(key) != after.get(key)
        ]

    def serialize_collection(self, row: ApiTestCollection) -> Dict[str, Any]:
        return {
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "project_id": row.project_id,
            "environment_id": row.environment_id,
            "status": row.status,
            "item_count": len(row.items or []),
            "items": [
                {
                    "id": item.id,
                    "interface_testcase_id": item.interface_testcase_id,
                    "name": item.interface_testcase.name if item.interface_testcase else None,
                    "order_index": item.order_index,
                    "enabled": item.enabled,
                    "extractors": item.extractors or [],
                    "assertions": item.assertions or [],
                }
                for item in sorted(row.items or [], key=lambda x: x.order_index or 0)
            ],
            "created_at": self._dt(row.created_at),
            "updated_at": self._dt(row.updated_at),
        }

    def serialize_run(self, row: ApiTestRun, include_items: bool = False) -> Dict[str, Any]:
        data = {
            "id": row.id,
            "collection_id": row.collection_id,
            "project_id": row.project_id,
            "environment_id": row.environment_id,
            "status": row.status,
            "total_items": row.total_items,
            "passed_items": row.passed_items,
            "failed_items": row.failed_items,
            "duration_ms": row.duration_ms,
            "summary": row.summary or {},
            "started_at": self._dt(row.started_at),
            "completed_at": self._dt(row.completed_at),
        }
        if include_items:
            data["items"] = [
                {
                    "id": item.id,
                    "name": item.name,
                    "status": item.status,
                    "status_code": item.status_code,
                    "duration_ms": item.duration_ms,
                    "assertions": item.assertions or [],
                    "extracted_variables": item.extracted_variables or {},
                    "error_message": item.error_message,
                }
                for item in row.items
            ]
        return data

    def serialize_mock(self, row: ApiMockEndpoint) -> Dict[str, Any]:
        return {
            "id": row.id,
            "project_id": row.project_id,
            "name": row.name,
            "mock_key": row.mock_key,
            "method": row.method,
            "path": row.path,
            "status_code": row.status_code,
            "headers": row.headers or {},
            "response_body": row.response_body,
            "delay_ms": row.delay_ms,
            "enabled": row.enabled,
            "mock_url": f"/api/v1/api-advanced/mock/{row.mock_key}{row.path}",
            "created_at": self._dt(row.created_at),
            "updated_at": self._dt(row.updated_at),
        }

    def serialize_contract(self, row: ApiContractSchema) -> Dict[str, Any]:
        return {
            "id": row.id,
            "interface_testcase_id": row.interface_testcase_id,
            "name": row.name,
            "expected_status_codes": row.expected_status_codes or [],
            "response_schema": row.response_schema or {},
            "enabled": row.enabled,
            "created_at": self._dt(row.created_at),
            "updated_at": self._dt(row.updated_at),
        }

    def serialize_monitor(self, row: ApiMonitorProbe) -> Dict[str, Any]:
        return {
            "id": row.id,
            "name": row.name,
            "interface_testcase_id": row.interface_testcase_id,
            "case_name": row.interface_testcase.name if row.interface_testcase else None,
            "environment_id": row.environment_id,
            "interval_seconds": row.interval_seconds,
            "enabled": row.enabled,
            "last_status": row.last_status,
            "last_status_code": row.last_status_code,
            "last_latency_ms": row.last_latency_ms,
            "last_checked_at": self._dt(row.last_checked_at),
        }

    def _dt(self, value: Any) -> Optional[str]:
        return value.isoformat() if value else None


api_testing_advanced_service = ApiTestingAdvancedService()
