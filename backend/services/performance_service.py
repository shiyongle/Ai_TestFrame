from __future__ import annotations

import threading
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.logging import setup_logging
from models.database_models import (
    PerformanceMetricPoint,
    PerformanceRunEvent,
    PerformanceScenario,
    PerformanceTestRun,
    Project,
)
from schemas.performance_schemas import PerformanceRunCreate, PerformanceScenarioCreate, PerformanceScenarioUpdate

logger = setup_logging()[0]


class PerformanceService:
    """性能测试场景与运行管理服务。"""

    _threads: Dict[int, threading.Thread] = {}
    _stop_flags: Dict[int, threading.Event] = {}
    _lock = threading.Lock()

    def list_scenarios(self, db: Session, project_id: Optional[int] = None) -> List[PerformanceScenario]:
        query = db.query(PerformanceScenario)
        if project_id is not None:
            query = query.filter(PerformanceScenario.project_id == project_id)
        return query.order_by(PerformanceScenario.updated_at.desc(), PerformanceScenario.id.desc()).all()

    def get_scenario(self, db: Session, scenario_id: int) -> Optional[PerformanceScenario]:
        return db.query(PerformanceScenario).filter(PerformanceScenario.id == scenario_id).first()

    def create_scenario(self, db: Session, payload: PerformanceScenarioCreate) -> PerformanceScenario:
        if payload.project_id is not None:
            self._ensure_project_exists(db, payload.project_id)

        normalized = self._normalize_scenario_payload(payload.model_dump())
        scenario = PerformanceScenario(**normalized)
        db.add(scenario)
        db.commit()
        db.refresh(scenario)
        return scenario

    def update_scenario(self, db: Session, scenario_id: int, payload: PerformanceScenarioUpdate) -> Optional[PerformanceScenario]:
        scenario = self.get_scenario(db, scenario_id)
        if not scenario:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        if update_data.get("project_id") is not None:
            self._ensure_project_exists(db, int(update_data["project_id"]))

        normalized = self._normalize_scenario_payload(update_data, current=scenario)
        for key, value in normalized.items():
            setattr(scenario, key, value)

        db.commit()
        db.refresh(scenario)
        return scenario

    def delete_scenario(self, db: Session, scenario_id: int) -> bool:
        scenario = self.get_scenario(db, scenario_id)
        if not scenario:
            return False
        db.delete(scenario)
        db.commit()
        return True

    def list_runs(self, db: Session, project_id: Optional[int] = None, limit: int = 20) -> List[PerformanceTestRun]:
        query = db.query(PerformanceTestRun)
        if project_id is not None:
            query = query.join(PerformanceScenario, PerformanceScenario.id == PerformanceTestRun.scenario_id).filter(
                PerformanceScenario.project_id == project_id
            )
        return query.order_by(PerformanceTestRun.created_at.desc(), PerformanceTestRun.id.desc()).limit(limit).all()

    def get_run(self, db: Session, run_id: int) -> Optional[PerformanceTestRun]:
        return db.query(PerformanceTestRun).filter(PerformanceTestRun.id == run_id).first()

    def get_run_metrics(self, db: Session, run_id: int, limit: int = 300) -> List[PerformanceMetricPoint]:
        return (
            db.query(PerformanceMetricPoint)
            .filter(PerformanceMetricPoint.run_id == run_id)
            .order_by(PerformanceMetricPoint.timestamp_offset.asc(), PerformanceMetricPoint.id.asc())
            .limit(limit)
            .all()
        )

    def get_run_events(self, db: Session, run_id: int, limit: int = 200) -> List[PerformanceRunEvent]:
        return (
            db.query(PerformanceRunEvent)
            .filter(PerformanceRunEvent.run_id == run_id)
            .order_by(PerformanceRunEvent.event_time.desc(), PerformanceRunEvent.id.desc())
            .limit(limit)
            .all()
        )

    def create_run(self, db: Session, payload: PerformanceRunCreate) -> PerformanceTestRun:
        scenario = self.get_scenario(db, payload.scenario_id)
        if not scenario:
            raise ValueError("性能测试场景不存在")

        merged_load_profile = dict(scenario.load_profile or {})
        if payload.load_profile_override:
            merged_load_profile.update(payload.load_profile_override)

        merged_runtime_options = dict(scenario.runtime_options or {})
        if payload.runtime_options_override:
            merged_runtime_options.update(payload.runtime_options_override)

        scenario_steps = self._normalize_steps(scenario.steps, scenario.target_config, scenario.protocol)
        scenario_variables = self._normalize_variables(scenario.variables)
        scenario_environment = self._normalize_environment_config(scenario.environment_config)
        scenario_snapshot = self._build_scenario_snapshot(
            scenario=scenario,
            load_profile=merged_load_profile,
            runtime_options=merged_runtime_options,
            steps=scenario_steps,
            variables=scenario_variables,
            environment_config=scenario_environment,
        )

        target_users = int(merged_load_profile.get("users", 10) or 10)
        spawn_rate = float(merged_load_profile.get("spawn_rate", 1) or 1)
        duration_seconds = int(merged_load_profile.get("duration_seconds", 60) or 60)

        run = PerformanceTestRun(
            run_no=f"PERF-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}",
            scenario_id=scenario.id,
            scenario_name=payload.name or scenario.name,
            protocol=scenario.protocol,
            status="pending",
            stage="created",
            trigger_source=payload.trigger_source,
            load_profile=merged_load_profile,
            target_config=scenario.target_config or {},
            runtime_options=merged_runtime_options,
            assertions=scenario.assertions or [],
            scenario_snapshot=scenario_snapshot,
            step_summary=self._build_step_summary_from_steps(scenario_steps),
            engine_metadata={
                "engine": "locust-adapter",
                "mode": "simulation",
                "supports_multi_step": bool(scenario_steps),
                "supports_variable_passing": bool(scenario_variables),
                "protocol": scenario.protocol,
            },
            current_users=0,
            target_users=target_users,
            spawn_rate=spawn_rate,
            duration_seconds=duration_seconds,
            progress=0,
            current_rps=0,
            avg_response_time=0,
            p95_response_time=0,
            p99_response_time=0,
            error_rate=0,
            worker_count=int(merged_runtime_options.get("worker_count", 1) or 1),
            summary={
                "engine": "locust-adapter",
                "mode": "simulation",
                "step_count": len(scenario_steps),
                "variable_count": len(scenario_variables),
            },
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        scenario.last_run_status = "pending"
        scenario.last_run_at = datetime.utcnow()
        db.commit()

        self._append_event(
            db,
            run.id,
            stage="created",
            level="info",
            message="性能测试任务已创建",
            payload={
                "scenario_id": scenario.id,
                "step_count": len(scenario_steps),
                "variable_count": len(scenario_variables),
            },
        )
        db.refresh(run)
        return run

    def start_run(self, db: Session, run_id: int) -> PerformanceTestRun:
        run = self.get_run(db, run_id)
        if not run:
            raise ValueError("性能测试运行记录不存在")
        if run.status == "running":
            return run
        if run.status in {"completed", "failed", "stopped"}:
            raise ValueError("当前运行状态不允许再次启动")

        self._mark_run_started(db, run)
        stop_event = threading.Event()
        worker = threading.Thread(target=self._simulate_run, args=(run.id, stop_event), daemon=True)
        with self._lock:
            self._threads[run.id] = worker
            self._stop_flags[run.id] = stop_event
        worker.start()
        db.refresh(run)
        return run

    def stop_run(self, db: Session, run_id: int) -> PerformanceTestRun:
        run = self.get_run(db, run_id)
        if not run:
            raise ValueError("性能测试运行记录不存在")

        with self._lock:
            stop_event = self._stop_flags.get(run.id)
        if stop_event:
            stop_event.set()

        run.status = "stopped"
        run.stage = "stopping"
        run.finished_at = datetime.utcnow()
        db.commit()
        db.refresh(run)
        self._append_event(db, run.id, stage="stopping", level="warning", message="收到停止指令")
        self._update_scenario_last_status(db, run.scenario_id, "stopped")
        return run

    def build_run_detail(self, db: Session, run: PerformanceTestRun) -> Dict[str, Any]:
        scenario = self.get_scenario(db, run.scenario_id)
        metrics = self.get_run_metrics(db, run.id)
        events = list(reversed(self.get_run_events(db, run.id)))
        snapshot = run.scenario_snapshot or {}
        return {
            **self.serialize_run(run),
            "scenario_description": scenario.description if scenario else snapshot.get("description"),
            "load_profile": run.load_profile or snapshot.get("load_profile") or {},
            "target_config": run.target_config or snapshot.get("target_config") or {},
            "runtime_options": run.runtime_options or snapshot.get("runtime_options") or {},
            "assertions": run.assertions or snapshot.get("assertions") or [],
            "steps": snapshot.get("steps") or [],
            "variables": snapshot.get("variables") or [],
            "environment_config": snapshot.get("environment_config") or {},
            "scenario_snapshot": snapshot,
            "step_summary": run.step_summary or self._build_step_summary_from_steps(snapshot.get("steps") or []),
            "engine_metadata": run.engine_metadata or {},
            "summary": run.summary or {},
            "error_message": run.error_message,
            "metrics": [self.serialize_metric(item) for item in metrics],
            "events": [self.serialize_event(item) for item in events],
        }

    def build_overview(self, db: Session, project_id: Optional[int] = None) -> Dict[str, Any]:
        scenarios = self.list_scenarios(db, project_id)
        runs = self.list_runs(db, project_id, limit=200)
        latest_run = runs[0] if runs else None
        protocol_distribution: Dict[str, int] = {}
        for scenario in scenarios:
            protocol_distribution[scenario.protocol] = protocol_distribution.get(scenario.protocol, 0) + 1

        return {
            "total_scenarios": len(scenarios),
            "active_scenarios": len([item for item in scenarios if item.status == "active"]),
            "running_runs": len([item for item in runs if item.status == "running"]),
            "completed_runs": len([item for item in runs if item.status == "completed"]),
            "latest_avg_response_time": float(getattr(latest_run, "avg_response_time", 0) or 0),
            "latest_error_rate": float(getattr(latest_run, "error_rate", 0) or 0),
            "protocol_distribution": protocol_distribution,
        }

    def build_trend(self, db: Session, run_id: int) -> Dict[str, Any]:
        metrics = self.get_run_metrics(db, run_id)
        return {
            "run_id": run_id,
            "points": [
                {
                    "label": f"T+{item.timestamp_offset}s",
                    "timestamp": item.created_at.isoformat() if item.created_at else None,
                    "rps": float(item.current_rps or 0),
                    "avg_response_time": float(item.avg_response_time or 0),
                    "error_rate": float(item.error_rate or 0),
                    "active_users": int(item.active_users or 0),
                }
                for item in metrics
            ],
        }

    def serialize_scenario(self, scenario: PerformanceScenario) -> Dict[str, Any]:
        steps = self._normalize_steps(scenario.steps, scenario.target_config, scenario.protocol)
        variables = self._normalize_variables(scenario.variables)
        return {
            "id": scenario.id,
            "name": scenario.name,
            "description": scenario.description,
            "project_id": scenario.project_id,
            "protocol": scenario.protocol,
            "status": scenario.status,
            "tags": scenario.tags or [],
            "step_count": len(steps),
            "variable_count": len(variables),
            "last_run_status": scenario.last_run_status,
            "last_run_at": scenario.last_run_at,
            "created_at": scenario.created_at,
            "updated_at": scenario.updated_at,
        }

    def serialize_scenario_detail(self, scenario: PerformanceScenario) -> Dict[str, Any]:
        steps = self._normalize_steps(scenario.steps, scenario.target_config, scenario.protocol)
        variables = self._normalize_variables(scenario.variables)
        return {
            **self.serialize_scenario(scenario),
            "target_config": scenario.target_config or {},
            "load_profile": scenario.load_profile or {},
            "assertions": scenario.assertions or [],
            "runtime_options": scenario.runtime_options or {},
            "steps": steps,
            "variables": variables,
            "environment_config": self._normalize_environment_config(scenario.environment_config),
        }

    def serialize_run(self, run: PerformanceTestRun) -> Dict[str, Any]:
        return {
            "id": run.id,
            "run_no": run.run_no,
            "scenario_id": run.scenario_id,
            "scenario_name": run.scenario_name,
            "protocol": run.protocol,
            "status": run.status,
            "stage": run.stage,
            "trigger_source": run.trigger_source,
            "current_users": int(run.current_users or 0),
            "target_users": int(run.target_users or 0),
            "spawn_rate": float(run.spawn_rate or 0),
            "duration_seconds": int(run.duration_seconds or 0),
            "progress": int(run.progress or 0),
            "current_rps": float(run.current_rps or 0),
            "avg_response_time": float(run.avg_response_time or 0),
            "p95_response_time": float(run.p95_response_time or 0),
            "p99_response_time": float(run.p99_response_time or 0),
            "error_rate": float(run.error_rate or 0),
            "worker_count": int(run.worker_count or 1),
            "started_at": run.started_at,
            "finished_at": run.finished_at,
            "created_at": run.created_at,
        }

    def serialize_metric(self, metric: PerformanceMetricPoint) -> Dict[str, Any]:
        return {
            "id": metric.id,
            "timestamp_offset": metric.timestamp_offset,
            "active_users": metric.active_users,
            "current_rps": float(metric.current_rps or 0),
            "avg_response_time": float(metric.avg_response_time or 0),
            "p95_response_time": float(metric.p95_response_time or 0),
            "p99_response_time": float(metric.p99_response_time or 0),
            "error_rate": float(metric.error_rate or 0),
            "total_requests": int(metric.total_requests or 0),
            "total_failures": int(metric.total_failures or 0),
            "cpu_usage": metric.cpu_usage,
            "memory_usage": metric.memory_usage,
            "worker_count": int(metric.worker_count or 1),
            "spawned_users": int(metric.spawned_users or 0),
            "raw_data": metric.raw_data or {},
            "created_at": metric.created_at,
        }

    def serialize_event(self, event: PerformanceRunEvent) -> Dict[str, Any]:
        return {
            "id": event.id,
            "stage": event.stage,
            "level": event.level,
            "message": event.message,
            "event_time": event.event_time,
            "payload": event.payload or {},
        }

    def _ensure_project_exists(self, db: Session, project_id: int) -> None:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError("项目不存在")

    def _mark_run_started(self, db: Session, run: PerformanceTestRun) -> None:
        run.status = "running"
        run.stage = "initializing"
        run.started_at = datetime.utcnow()
        run.finished_at = None
        run.progress = 1
        db.commit()
        self._append_event(db, run.id, stage="initializing", level="info", message="运行环境初始化完成")
        self._update_scenario_last_status(db, run.scenario_id, "running")

    def _append_event(self, db: Session, run_id: int, *, stage: str, level: str, message: str, payload: Optional[Dict[str, Any]] = None) -> None:
        event = PerformanceRunEvent(
            run_id=run_id,
            stage=stage,
            level=level,
            message=message[:500],
            payload=payload or {},
            event_time=datetime.utcnow(),
        )
        db.add(event)
        db.commit()

    def _append_metric(self, db: Session, run_id: int, payload: Dict[str, Any]) -> None:
        metric = PerformanceMetricPoint(
            run_id=run_id,
            timestamp_offset=int(payload.get("timestamp_offset", 0)),
            active_users=int(payload.get("active_users", 0)),
            current_rps=float(payload.get("current_rps", 0)),
            avg_response_time=float(payload.get("avg_response_time", 0)),
            p95_response_time=float(payload.get("p95_response_time", 0)),
            p99_response_time=float(payload.get("p99_response_time", 0)),
            error_rate=float(payload.get("error_rate", 0)),
            total_requests=int(payload.get("total_requests", 0)),
            total_failures=int(payload.get("total_failures", 0)),
            cpu_usage=payload.get("cpu_usage"),
            memory_usage=payload.get("memory_usage"),
            worker_count=int(payload.get("worker_count", 1)),
            spawned_users=int(payload.get("spawned_users", 0)),
            raw_data=payload.get("raw_data") or {},
            created_at=datetime.utcnow(),
        )
        db.add(metric)
        db.commit()

    def _update_scenario_last_status(self, db: Session, scenario_id: int, status: str) -> None:
        scenario = self.get_scenario(db, scenario_id)
        if not scenario:
            return
        scenario.last_run_status = status
        scenario.last_run_at = datetime.utcnow()
        db.commit()

    def _simulate_run(self, run_id: int, stop_event: threading.Event) -> None:
        db = SessionLocal()
        try:
            run = self.get_run(db, run_id)
            if not run:
                return

            snapshot = run.scenario_snapshot or {}
            steps = snapshot.get("steps") or []
            duration = max(int(run.duration_seconds or 60), 10)
            target_users = max(int(run.target_users or 1), 1)
            spawn_rate = max(float(run.spawn_rate or 1), 0.5)
            protocol = str(run.protocol or "http").lower()

            self._append_event(
                db,
                run.id,
                stage="ramping",
                level="info",
                message="开始升压",
                payload={"step_count": len(steps), "engine": "locust-adapter", "mode": "simulation"},
            )

            total_requests = 0
            total_failures = 0
            for second in range(1, duration + 1):
                run = self.get_run(db, run_id)
                if not run:
                    return
                if stop_event.is_set() or run.status == "stopped":
                    run.status = "stopped"
                    run.stage = "stopped"
                    run.finished_at = datetime.utcnow()
                    db.commit()
                    self._append_event(db, run.id, stage="stopped", level="warning", message="运行已停止")
                    self._update_scenario_last_status(db, run.scenario_id, "stopped")
                    return

                stage = "ramping" if second < max(3, duration // 4) else "steady"
                current_users = min(target_users, max(1, int(second * spawn_rate)))
                step_factor = max(1, len(steps))
                base_rps = current_users * (3.2 if protocol == "http" else 2.1) * min(step_factor, 4)
                rps = round(base_rps + ((second % 5) * 0.7), 2)
                avg_response_time = round(
                    120 + current_users * (2.8 if protocol == "http" else 4.2) + step_factor * 8 + (second % 7) * 3,
                    2,
                )
                p95_response_time = round(avg_response_time * 1.35, 2)
                p99_response_time = round(avg_response_time * 1.6, 2)
                error_rate = round(
                    min(8.5, current_users / max(target_users, 1) * (1.4 if protocol == "http" else 2.4) + max(step_factor - 1, 0) * 0.25),
                    2,
                )
                total_requests += int(rps)
                total_failures += int(total_requests * (error_rate / 100.0)) - total_failures
                progress = min(99, int(second / duration * 100))
                step_summary = self._build_step_runtime_summary(steps, total_requests, total_failures, avg_response_time, p95_response_time)

                run.stage = stage
                run.current_users = current_users
                run.progress = progress
                run.current_rps = rps
                run.avg_response_time = avg_response_time
                run.p95_response_time = p95_response_time
                run.p99_response_time = p99_response_time
                run.error_rate = error_rate
                run.step_summary = step_summary
                run.engine_metadata = {
                    **(run.engine_metadata or {}),
                    "engine": "locust-adapter",
                    "mode": "simulation",
                    "last_stage": stage,
                    "last_second": second,
                }
                run.summary = {
                    "engine": "locust-adapter",
                    "mode": "simulation",
                    "protocol": protocol,
                    "requests": total_requests,
                    "failures": total_failures,
                    "last_second": second,
                    "step_count": len(steps),
                }
                db.commit()

                self._append_metric(
                    db,
                    run.id,
                    {
                        "timestamp_offset": second,
                        "active_users": current_users,
                        "current_rps": rps,
                        "avg_response_time": avg_response_time,
                        "p95_response_time": p95_response_time,
                        "p99_response_time": p99_response_time,
                        "error_rate": error_rate,
                        "total_requests": total_requests,
                        "total_failures": total_failures,
                        "cpu_usage": round(18 + current_users * 0.35, 2),
                        "memory_usage": round(128 + current_users * 1.2, 2),
                        "worker_count": int(run.worker_count or 1),
                        "spawned_users": current_users,
                        "raw_data": {
                            "engine": "locust-adapter",
                            "protocol": protocol,
                            "stage": stage,
                            "step_summary": step_summary,
                        },
                    },
                )

                if second in {1, max(2, duration // 2), duration - 1}:
                    self._append_event(
                        db,
                        run.id,
                        stage=stage,
                        level="info",
                        message=f"阶段更新：{stage}，并发用户 {current_users}，RPS {rps}",
                        payload={
                            "second": second,
                            "current_users": current_users,
                            "rps": rps,
                            "step_summary": step_summary,
                        },
                    )

                time.sleep(1)

            run = self.get_run(db, run_id)
            if not run:
                return
            run.status = "completed"
            run.stage = "completed"
            run.progress = 100
            run.finished_at = datetime.utcnow()
            run.engine_metadata = {
                **(run.engine_metadata or {}),
                "engine": "locust-adapter",
                "mode": "simulation",
                "completed": True,
            }
            run.summary = {
                **(run.summary or {}),
                "engine": "locust-adapter",
                "mode": "simulation",
                "completed": True,
                "requests": int((run.summary or {}).get("requests", 0)),
                "failures": int((run.summary or {}).get("failures", 0)),
            }
            db.commit()
            self._append_event(db, run.id, stage="completed", level="success", message="性能测试运行完成")
            self._update_scenario_last_status(db, run.scenario_id, "completed")
        except Exception as exc:
            logger.exception("性能测试运行线程异常: %s", exc)
            try:
                run = self.get_run(db, run_id)
                if run:
                    run.status = "failed"
                    run.stage = "failed"
                    run.finished_at = datetime.utcnow()
                    run.error_message = str(exc)
                    db.commit()
                    self._append_event(db, run.id, stage="failed", level="error", message="性能测试运行异常", payload={"error": str(exc)})
                    self._update_scenario_last_status(db, run.scenario_id, "failed")
            except Exception:
                logger.exception("性能测试异常状态回写失败")
        finally:
            db.close()
            with self._lock:
                self._threads.pop(run_id, None)
                self._stop_flags.pop(run_id, None)

    def _normalize_scenario_payload(self, data: Dict[str, Any], current: Optional[PerformanceScenario] = None) -> Dict[str, Any]:
        payload = dict(data)
        protocol = str(payload.get("protocol") or getattr(current, "protocol", "http") or "http").lower()
        target_config = payload.get("target_config")
        if target_config is None and current is not None:
            target_config = current.target_config or {}
        target_config = target_config or {}

        steps = payload.get("steps")
        if steps is None and current is not None:
            steps = current.steps
        normalized_steps = self._normalize_steps(steps, target_config, protocol)

        variables = payload.get("variables")
        if variables is None and current is not None:
            variables = current.variables
        environment_config = payload.get("environment_config")
        if environment_config is None and current is not None:
            environment_config = current.environment_config

        payload["protocol"] = protocol
        payload["tags"] = payload.get("tags") or (current.tags if current else []) or []
        payload["target_config"] = target_config
        payload["load_profile"] = payload.get("load_profile") or (current.load_profile if current else {}) or {}
        payload["assertions"] = payload.get("assertions") or (current.assertions if current else []) or []
        payload["runtime_options"] = payload.get("runtime_options") or (current.runtime_options if current else {}) or {}
        payload["steps"] = normalized_steps
        payload["variables"] = self._normalize_variables(variables)
        payload["environment_config"] = self._normalize_environment_config(environment_config)
        return payload

    def _normalize_steps(self, steps: Any, target_config: Optional[Dict[str, Any]], protocol: str) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        raw_steps = steps or []
        for index, raw in enumerate(raw_steps, start=1):
            if not isinstance(raw, dict):
                continue
            step_type = str(raw.get("step_type") or protocol or "http").lower()
            step_id = str(raw.get("step_id") or f"step_{index}")
            name = str(raw.get("name") or f"步骤 {index}")
            normalized.append(
                {
                    "step_id": step_id,
                    "name": name,
                    "enabled": bool(raw.get("enabled", True)),
                    "step_type": step_type,
                    "method": str(raw.get("method") or "GET").upper() if step_type == "http" else raw.get("method"),
                    "url": raw.get("url"),
                    "headers": raw.get("headers") or {},
                    "query": raw.get("query") or {},
                    "body": raw.get("body"),
                    "timeout_ms": int(raw.get("timeout_ms", 10000) or 10000),
                    "think_time_ms": int(raw.get("think_time_ms", 0) or 0),
                    "extractors": self._normalize_extractors(raw.get("extractors")),
                    "assertions": self._normalize_assertions(raw.get("assertions")),
                    "on_failure": raw.get("on_failure") or "stop_user",
                    "transaction_name": raw.get("transaction_name") or name,
                    "weight": int(raw.get("weight", 1) or 1),
                }
            )

        if normalized:
            return normalized

        if protocol == "http" and target_config:
            return [
                {
                    "step_id": "step_1",
                    "name": target_config.get("name") or "默认 HTTP 步骤",
                    "enabled": True,
                    "step_type": "http",
                    "method": str(target_config.get("method") or "GET").upper(),
                    "url": target_config.get("url"),
                    "headers": target_config.get("headers") or {},
                    "query": target_config.get("query") or {},
                    "body": target_config.get("body"),
                    "timeout_ms": int(target_config.get("timeout_ms", 10000) or 10000),
                    "think_time_ms": int(target_config.get("think_time_ms", 0) or 0),
                    "extractors": self._normalize_extractors(target_config.get("extractors")),
                    "assertions": self._normalize_assertions(target_config.get("assertions")),
                    "on_failure": target_config.get("on_failure") or "stop_user",
                    "transaction_name": target_config.get("transaction_name") or "默认 HTTP 步骤",
                    "weight": int(target_config.get("weight", 1) or 1),
                }
            ]

        if protocol == "rabbitmq" and target_config:
            return [
                {
                    "step_id": "step_1",
                    "name": target_config.get("name") or "默认 MQ 步骤",
                    "enabled": True,
                    "step_type": "rabbitmq",
                    "method": None,
                    "url": None,
                    "headers": {},
                    "query": {},
                    "body": target_config.get("message"),
                    "timeout_ms": int(target_config.get("timeout_ms", 10000) or 10000),
                    "think_time_ms": int(target_config.get("think_time_ms", 0) or 0),
                    "extractors": self._normalize_extractors(target_config.get("extractors")),
                    "assertions": self._normalize_assertions(target_config.get("assertions")),
                    "on_failure": target_config.get("on_failure") or "stop_user",
                    "transaction_name": target_config.get("transaction_name") or "默认 MQ 步骤",
                    "weight": int(target_config.get("weight", 1) or 1),
                }
            ]

        return []

    def _normalize_variables(self, variables: Any) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for item in variables or []:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            normalized.append(
                {
                    "name": name,
                    "scope": item.get("scope") or "vu",
                    "initial_value": item.get("initial_value"),
                    "secret": bool(item.get("secret", False)),
                    "description": item.get("description"),
                }
            )
        return normalized

    def _normalize_environment_config(self, environment_config: Any) -> Dict[str, Any]:
        if isinstance(environment_config, dict):
            return environment_config
        return {}

    def _normalize_extractors(self, extractors: Any) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for item in extractors or []:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            expression = str(item.get("expression") or "").strip()
            if not name or not expression:
                continue
            normalized.append(
                {
                    "name": name,
                    "source": item.get("source") or "json_body",
                    "expression": expression,
                    "default_value": item.get("default_value"),
                    "required": bool(item.get("required", False)),
                    "transform": item.get("transform") or "none",
                }
            )
        return normalized

    def _normalize_assertions(self, assertions: Any) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for item in assertions or []:
            if not isinstance(item, dict):
                continue
            normalized.append(
                {
                    "type": item.get("type") or "status_code",
                    "operator": item.get("operator") or "eq",
                    "expected": item.get("expected"),
                    "target": item.get("target"),
                    "message": item.get("message"),
                    "enabled": bool(item.get("enabled", True)),
                }
            )
        return normalized

    def _build_scenario_snapshot(
        self,
        *,
        scenario: PerformanceScenario,
        load_profile: Dict[str, Any],
        runtime_options: Dict[str, Any],
        steps: List[Dict[str, Any]],
        variables: List[Dict[str, Any]],
        environment_config: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "scenario_id": scenario.id,
            "name": scenario.name,
            "description": scenario.description,
            "project_id": scenario.project_id,
            "protocol": scenario.protocol,
            "status": scenario.status,
            "tags": scenario.tags or [],
            "target_config": scenario.target_config or {},
            "load_profile": load_profile,
            "runtime_options": runtime_options,
            "assertions": scenario.assertions or [],
            "steps": steps,
            "variables": variables,
            "environment_config": environment_config,
        }

    def _build_step_summary_from_steps(self, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        summary: List[Dict[str, Any]] = []
        for step in steps:
            summary.append(
                {
                    "step_id": step.get("step_id"),
                    "name": step.get("name"),
                    "method": step.get("method"),
                    "url": step.get("url"),
                    "transaction_name": step.get("transaction_name"),
                    "request_count": 0,
                    "failure_count": 0,
                    "avg_response_time": 0,
                    "p95_response_time": 0,
                    "last_status_code": None,
                    "last_error": None,
                    "extractor_preview": {
                        extractor.get("name"): extractor.get("default_value")
                        for extractor in step.get("extractors", [])
                        if isinstance(extractor, dict) and extractor.get("name")
                    },
                }
            )
        return summary

    def _build_step_runtime_summary(
        self,
        steps: List[Dict[str, Any]],
        total_requests: int,
        total_failures: int,
        avg_response_time: float,
        p95_response_time: float,
    ) -> List[Dict[str, Any]]:
        if not steps:
            return []

        step_count = len(steps)
        request_base = total_requests // step_count
        failure_base = total_failures // step_count if step_count else 0
        summary: List[Dict[str, Any]] = []
        for index, step in enumerate(steps, start=1):
            request_count = request_base + (1 if index <= total_requests % step_count else 0)
            failure_count = failure_base + (1 if index <= total_failures % step_count else 0)
            summary.append(
                {
                    "step_id": step.get("step_id"),
                    "name": step.get("name"),
                    "method": step.get("method"),
                    "url": step.get("url"),
                    "transaction_name": step.get("transaction_name"),
                    "request_count": request_count,
                    "failure_count": failure_count,
                    "avg_response_time": round(avg_response_time + index * 4, 2),
                    "p95_response_time": round(p95_response_time + index * 6, 2),
                    "last_status_code": 200 if failure_count == 0 else 500,
                    "last_error": None if failure_count == 0 else "模拟步骤失败",
                    "extractor_preview": {
                        extractor.get("name"): extractor.get("default_value")
                        for extractor in step.get("extractors", [])
                        if isinstance(extractor, dict) and extractor.get("name")
                    },
                }
            )
        return summary
