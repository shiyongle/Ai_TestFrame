import asyncio
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.database_models import AgentEvaluationItem, AgentEvaluationRun
from schemas.agent_evaluation_schemas import AgentEvaluationRunCreate
from services.ai.llm_client import llm_client


INVALID_ANSWER_PATTERNS = [
    "不知道",
    "不清楚",
    "无法回答",
    "无法确定",
    "没有相关信息",
    "没有足够信息",
    "抱歉",
    "sorry",
    "i don't know",
    "cannot answer",
    "can't answer",
    "as an ai",
]


class AgentEvaluationService:
    def list_runs(self, db: Session, limit: int = 20) -> List[AgentEvaluationRun]:
        return (
            db.query(AgentEvaluationRun)
            .order_by(AgentEvaluationRun.created_at.desc(), AgentEvaluationRun.id.desc())
            .limit(limit)
            .all()
        )

    def get_run(self, db: Session, run_id: int) -> Optional[AgentEvaluationRun]:
        return db.query(AgentEvaluationRun).filter(AgentEvaluationRun.id == run_id).first()

    def create_run(self, db: Session, payload: AgentEvaluationRunCreate) -> AgentEvaluationRun:
        run = AgentEvaluationRun(
            name=payload.name.strip(),
            provider=payload.provider.strip(),
            model=payload.model.strip() if payload.model else None,
            status="pending",
            total_count=len(payload.cases),
            summary={
                "temperature": payload.temperature,
                "max_tokens": payload.max_tokens,
                "pass_threshold": payload.pass_threshold,
            },
        )
        db.add(run)
        db.flush()

        for case in payload.cases:
            db.add(
                AgentEvaluationItem(
                    run_id=run.id,
                    question=case.question.strip(),
                    expected_answer=case.expected_answer.strip() if case.expected_answer else None,
                    status="pending",
                )
            )

        db.commit()
        db.refresh(run)
        return run

    async def execute_run(self, run_id: int) -> None:
        db = SessionLocal()
        try:
            run = self.get_run(db, run_id)
            if not run:
                return

            run.status = "running"
            run.started_at = datetime.utcnow()
            db.commit()

            options = run.summary or {}
            provider = run.provider
            model = run.model
            pass_threshold = float(options.get("pass_threshold", 0.55))
            temperature = float(options.get("temperature", 0.2))
            max_tokens = int(options.get("max_tokens", 1024))

            items = db.query(AgentEvaluationItem).filter(AgentEvaluationItem.run_id == run.id).all()
            for item in items:
                await self._execute_item(
                    db,
                    item,
                    provider=provider,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    pass_threshold=pass_threshold,
                )

            self._refresh_run_stats(db, run.id)
        except Exception as exc:
            db.rollback()
            run = self.get_run(db, run_id)
            if run:
                run.status = "failed"
                run.error_message = str(exc)
                run.completed_at = datetime.utcnow()
                db.commit()
        finally:
            db.close()

    async def _execute_item(
        self,
        db: Session,
        item: AgentEvaluationItem,
        *,
        provider: str,
        model: Optional[str],
        temperature: float,
        max_tokens: int,
        pass_threshold: float,
    ) -> None:
        started = time.perf_counter()
        try:
            messages = [
                {
                    "role": "system",
                    "content": "你是被评测的大模型。请直接回答用户问题，不要输出与问题无关的说明。",
                },
                {"role": "user", "content": item.question},
            ]
            kwargs: Dict[str, Any] = {"temperature": temperature, "max_tokens": max_tokens}
            if model:
                kwargs["model"] = model

            result = await llm_client.chat_completion(messages, provider=provider, **kwargs)
            item.latency_ms = int((time.perf_counter() - started) * 1000)

            if not result.get("success"):
                item.status = "failed"
                item.error_message = result.get("error", "模型调用失败")
                item.completed_at = datetime.utcnow()
                db.commit()
                return

            answer = str(result.get("content") or "").strip()
            item.actual_answer = answer
            score, status, reason = self.evaluate_answer(answer, item.expected_answer, pass_threshold)
            item.score = score
            item.status = status
            item.reason = reason
            item.completed_at = datetime.utcnow()
            db.commit()
        except Exception as exc:
            db.rollback()
            item.status = "failed"
            item.error_message = str(exc)
            item.latency_ms = int((time.perf_counter() - started) * 1000)
            item.completed_at = datetime.utcnow()
            db.add(item)
            db.commit()

    def evaluate_answer(
        self,
        answer: str,
        expected_answer: Optional[str],
        pass_threshold: float = 0.55,
    ) -> Tuple[float, str, str]:
        normalized_answer = self._normalize(answer)
        if len(normalized_answer) < 4:
            return 0.0, "invalid", "回答为空或信息量过低"

        lowered_answer = normalized_answer.lower()
        if any(pattern in lowered_answer for pattern in INVALID_ANSWER_PATTERNS):
            return 0.0, "invalid", "命中拒答、无信息或无法回答模式"

        if not expected_answer or not expected_answer.strip():
            return 1.0, "valid", "未提供期望答案，按非空且非拒答回答判定为有效"

        expected_tokens = self._extract_terms(expected_answer)
        if not expected_tokens:
            return 1.0, "valid", "期望答案无法提取关键词，按回答有效性判定通过"

        answer_text = self._normalize(answer)
        hit_count = sum(1 for token in expected_tokens if token in answer_text)
        coverage = hit_count / len(expected_tokens)

        expected_compact = self._normalize(expected_answer)
        if expected_compact and expected_compact in answer_text:
            coverage = 1.0

        score = round(min(1.0, coverage), 3)
        if score >= pass_threshold:
            return score, "valid", f"命中期望答案关键词 {hit_count}/{len(expected_tokens)}"
        return score, "invalid", f"期望答案关键词覆盖不足，命中 {hit_count}/{len(expected_tokens)}"

    def _refresh_run_stats(self, db: Session, run_id: int) -> None:
        run = self.get_run(db, run_id)
        if not run:
            return

        items = db.query(AgentEvaluationItem).filter(AgentEvaluationItem.run_id == run_id).all()
        total = len(items)
        valid = sum(1 for item in items if item.status == "valid")
        invalid = sum(1 for item in items if item.status == "invalid")
        failed = sum(1 for item in items if item.status == "failed")
        finished = valid + invalid + failed

        run.total_count = total
        run.valid_count = valid
        run.invalid_count = invalid
        run.failed_count = failed
        run.valid_rate = round(valid / total * 100, 2) if total else 0
        run.failure_rate = round((invalid + failed) / total * 100, 2) if total else 0
        run.status = "completed" if finished == total else "running"
        if run.status == "completed":
            run.completed_at = datetime.utcnow()
        run.summary = {
            **(run.summary or {}),
            "invalid_rate": round(invalid / total * 100, 2) if total else 0,
            "call_failed_rate": round(failed / total * 100, 2) if total else 0,
            "avg_latency_ms": round(sum(item.latency_ms for item in items) / total, 1) if total else 0,
        }
        db.commit()

    def serialize_run(self, run: AgentEvaluationRun) -> Dict[str, Any]:
        return {
            "id": run.id,
            "name": run.name,
            "provider": run.provider,
            "model": run.model,
            "status": run.status,
            "total_count": run.total_count,
            "valid_count": run.valid_count,
            "invalid_count": run.invalid_count,
            "failed_count": run.failed_count,
            "valid_rate": run.valid_rate,
            "failure_rate": run.failure_rate,
            "summary": run.summary,
            "error_message": run.error_message,
            "created_at": run.created_at,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "items": [self.serialize_item(item) for item in getattr(run, "items", [])],
        }

    def serialize_item(self, item: AgentEvaluationItem) -> Dict[str, Any]:
        return {
            "id": item.id,
            "question": item.question,
            "expected_answer": item.expected_answer,
            "actual_answer": item.actual_answer,
            "status": item.status,
            "score": item.score,
            "reason": item.reason,
            "error_message": item.error_message,
            "latency_ms": item.latency_ms,
            "created_at": item.created_at,
            "completed_at": item.completed_at,
        }

    def _normalize(self, text: Optional[str]) -> str:
        return re.sub(r"\s+", "", text or "")

    def _extract_terms(self, text: str) -> List[str]:
        normalized = self._normalize(text)
        terms = re.findall(r"[A-Za-z0-9_]{2,}|[\u4e00-\u9fa5]{2,}", normalized)
        if not terms and normalized:
            terms = [normalized]
        return list(dict.fromkeys(terms))


agent_evaluation_service = AgentEvaluationService()
