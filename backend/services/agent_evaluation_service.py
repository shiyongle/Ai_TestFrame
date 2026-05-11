"""
Agent评测服务（重构版）
支持：黄金测试集关联 → 调用被测Agent → LLM-as-Judge语义评判 → 人工标注覆盖
"""

import asyncio
import json
import re
import time
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session, selectinload

from core.database import SessionLocal
from models.database_models import (
    AgentEvaluation,
    AgentEvaluationItem,
    AgentEvaluationRun,
    AgentEvaluationTemplate,
    DifyAgent,
    GoldenDataset,
    GoldenDatasetItem,
    ModelConfig,
)
from schemas.agent_evaluation_schemas import (
    AgentEvaluationCreate,
    AgentEvaluationRunCreate,
)
from services.ai.llm_client import llm_client


INVALID_ANSWER_PATTERNS = [
    "不知道", "不清楚", "无法回答", "无法确定", "没有相关信息",
    "没有足够信息", "抱歉", "sorry", "i don't know", "cannot answer",
    "can't answer", "as an ai",
]


def parse_llm_eval_result(raw_text: str) -> Tuple[float, str]:
    try:
        result = json.loads(raw_text.strip())
        if isinstance(result, dict):
            score = float(result.get("score", 0))
            reason = str(result.get("reason", ""))
            return min(1.0, max(0.0, score)), reason
    except (json.JSONDecodeError, ValueError):
        pass

    json_patterns = [
        r"```json\s*(.*?)\s*```",
        r"```\s*(.*?)\s*```",
        r"\{[^{}]*\"score\"[^{}]*\}",
    ]
    for pattern in json_patterns:
        match = re.search(pattern, raw_text, re.DOTALL)
        if match:
            try:
                json_str = match.group(1) if "```" in pattern else match.group(0)
                result = json.loads(json_str.strip())
                if isinstance(result, dict):
                    score = float(result.get("score", 0))
                    reason = str(result.get("reason", ""))
                    return min(1.0, max(0.0, score)), reason
            except (json.JSONDecodeError, ValueError):
                continue

    score_match = re.search(r"(?:score|得分|分数|评分)[:\s=]*([0-9]*\.?[0-9]+)", raw_text, re.IGNORECASE)
    if score_match:
        score = float(score_match.group(1))
        if score > 1:
            score = score / 100
        return min(1.0, max(0.0, score)), raw_text.strip()

    return 0.0, raw_text.strip()


def render_prompt(template_str: str, variables: Dict[str, str]) -> str:
    result = template_str
    for key, value in variables.items():
        result = result.replace(f"{{{{{key}}}}}", str(value or ""))
    return result


class AgentEvaluationService:

    # ---- 被测 Agent 调用 ----

    async def _call_agent(self, agent: DifyAgent, question: str) -> str:
        """调用被测Agent获取回答，支持 Dify 和通用 HTTP API"""
        if agent.agent_type == "dify":
            return await self._call_dify_agent(agent, question)
        elif agent.agent_type == "http_api":
            return await self._call_http_agent(agent, question)
        else:
            raise ValueError(f"不支持的 Agent 类型: {agent.agent_type}")

    async def _call_dify_agent(self, agent: DifyAgent, question: str) -> str:
        url = f"{agent.base_url.rstrip('/')}/chat-messages"
        headers = {
            "Authorization": f"Bearer {agent.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "inputs": {},
            "query": question,
            "response_mode": "blocking",
            "user": "eval-system",
        }
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data.get("answer", "") or data.get("message", "") or str(data)

    async def _call_http_agent(self, agent: DifyAgent, question: str) -> str:
        config = agent.request_config or {}
        headers = config.get("headers", {"Content-Type": "application/json"})
        if agent.api_key:
            headers.setdefault("Authorization", f"Bearer {agent.api_key}")
        method = config.get("method", "POST").upper()
        body_template = config.get("body_template", '{"query": "{{question}}"}')
        body_str = body_template.replace("{{question}}", question)
        answer_path = config.get("answer_path", "answer")

        async with httpx.AsyncClient(timeout=120) as client:
            if method == "POST":
                resp = await client.post(agent.base_url, json=json.loads(body_str), headers=headers)
            else:
                resp = await client.get(agent.base_url, params={"query": question}, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        # 按 answer_path 提取
        result = data
        for key in answer_path.split("."):
            if isinstance(result, dict):
                result = result.get(key, "")
            else:
                break
        return str(result) if result else str(data)

    # ---- 批量评测 Run 管理 ----

    def list_runs(self, db: Session, limit: int = 20) -> List[AgentEvaluationRun]:
        return (
            db.query(AgentEvaluationRun)
            .order_by(AgentEvaluationRun.created_at.desc(), AgentEvaluationRun.id.desc())
            .limit(limit)
            .all()
        )

    def get_run(self, db: Session, run_id: int) -> Optional[AgentEvaluationRun]:
        return db.query(AgentEvaluationRun).filter(AgentEvaluationRun.id == run_id).first()

    def get_run_with_items(self, db: Session, run_id: int) -> Optional[AgentEvaluationRun]:
        return (
            db.query(AgentEvaluationRun)
            .options(selectinload(AgentEvaluationRun.items))
            .filter(AgentEvaluationRun.id == run_id)
            .first()
        )

    def delete_run(self, db: Session, run_id: int) -> bool:
        run = db.query(AgentEvaluationRun).filter(AgentEvaluationRun.id == run_id).first()
        if not run:
            return False
        db.delete(run)
        db.commit()
        return True

    def create_run(self, db: Session, payload: AgentEvaluationRunCreate) -> AgentEvaluationRun:
        """创建评测运行，支持关联黄金测试集+被测Agent"""
        # 验证黄金测试集
        dataset_items = []
        if payload.dataset_id:
            dataset = db.query(GoldenDataset).options(
                selectinload(GoldenDataset.items)
            ).filter(GoldenDataset.id == payload.dataset_id).first()
            if not dataset:
                raise ValueError(f"黄金测试集不存在: {payload.dataset_id}")
            dataset_items = dataset.items or []
            if not dataset_items:
                raise ValueError("黄金测试集为空，请先添加测试条目")

        # 验证被测Agent
        if payload.agent_id:
            agent = db.query(DifyAgent).filter(DifyAgent.id == payload.agent_id).first()
            if not agent:
                raise ValueError(f"被测Agent不存在: {payload.agent_id}")

        # 验证模板
        template = None
        if payload.template_id:
            template = db.query(AgentEvaluationTemplate).filter(
                AgentEvaluationTemplate.id == payload.template_id
            ).first()
            if not template:
                raise ValueError(f"评测模板不存在: {payload.template_id}")

        # 验证模型配置
        if payload.model_config_id:
            mc = db.query(ModelConfig).filter(ModelConfig.id == payload.model_config_id).first()
            if not mc:
                raise ValueError(f"模型配置不存在: {payload.model_config_id}")

        # 确定用例来源
        cases = []
        if dataset_items:
            cases = [{"question": item.question, "expected_answer": item.expected_answer, "dataset_item_id": item.id}
                     for item in dataset_items]
        elif payload.cases:
            cases = [{"question": c.question, "expected_answer": c.expected_answer, "dataset_item_id": None}
                     for c in payload.cases]
        else:
            raise ValueError("必须指定黄金测试集或手动提供用例")

        run = AgentEvaluationRun(
            name=payload.name.strip(),
            dataset_id=payload.dataset_id,
            agent_id=payload.agent_id,
            template_id=payload.template_id,
            eval_mode=payload.eval_mode,
            provider=payload.provider or "",
            model=payload.model,
            model_config_id=payload.model_config_id,
            status="pending",
            total_count=len(cases),
            summary={
                "temperature": payload.temperature,
                "max_tokens": payload.max_tokens,
                "pass_threshold": payload.pass_threshold,
            },
        )
        db.add(run)
        db.flush()

        for case in cases:
            db.add(AgentEvaluationItem(
                run_id=run.id,
                dataset_item_id=case.get("dataset_item_id"),
                question=case["question"].strip(),
                expected_answer=case["expected_answer"].strip() if case.get("expected_answer") else None,
                status="pending",
            ))

        db.commit()
        db.refresh(run)
        return run

    async def execute_run(self, run_id: int) -> None:
        """执行评测：调用被测Agent → LLM-as-Judge评判"""
        db = SessionLocal()
        try:
            run = self.get_run(db, run_id)
            if not run:
                return
            run.status = "running"
            run.started_at = datetime.utcnow()
            db.commit()

            options = run.summary or {}
            pass_threshold = float(options.get("pass_threshold", 0.55))
            temperature = float(options.get("temperature", 0.2))
            max_tokens = int(options.get("max_tokens", 1024))

            # 加载被测Agent
            agent = None
            if run.agent_id:
                agent = db.query(DifyAgent).filter(DifyAgent.id == run.agent_id).first()

            # 加载评测模板
            template = None
            if run.template_id:
                template = db.query(AgentEvaluationTemplate).filter(
                    AgentEvaluationTemplate.id == run.template_id
                ).first()

            # 加载模型配置
            model_config = None
            if run.model_config_id:
                model_config = db.query(ModelConfig).filter(ModelConfig.id == run.model_config_id).first()
            elif template and template.model_config_id:
                model_config = db.query(ModelConfig).filter(ModelConfig.id == template.model_config_id).first()

            items = db.query(AgentEvaluationItem).filter(AgentEvaluationItem.run_id == run.id).all()
            for item in items:
                await self._execute_item(
                    db, item, agent=agent, template=template, model_config=model_config,
                    provider=run.provider, model=run.model,
                    temperature=temperature, max_tokens=max_tokens,
                    pass_threshold=pass_threshold, eval_mode=run.eval_mode,
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
        self, db: Session, item: AgentEvaluationItem, *,
        agent: Optional[DifyAgent], template: Optional[AgentEvaluationTemplate],
        model_config: Optional[ModelConfig], provider: str, model: Optional[str],
        temperature: float, max_tokens: int, pass_threshold: float, eval_mode: str,
    ) -> None:
        started = time.perf_counter()
        try:
            # Step 1: 获取被测Agent的回答
            if agent:
                answer = await self._call_agent(agent, item.question)
            else:
                # 兼容旧模式：直接调用LLM
                messages = [
                    {"role": "system", "content": "你是被评测的大模型。请直接回答用户问题。"},
                    {"role": "user", "content": item.question},
                ]
                kwargs: Dict[str, Any] = {"temperature": temperature, "max_tokens": max_tokens}
                if model:
                    kwargs["model"] = model
                result = await llm_client.chat_completion(messages, provider=provider, **kwargs)
                if not result.get("success"):
                    item.status = "failed"
                    item.error_message = result.get("error", "模型调用失败")
                    item.completed_at = datetime.utcnow()
                    db.commit()
                    return
                answer = str(result.get("content") or "").strip()

            item.actual_answer = answer

            # Step 2: 评判
            if eval_mode == "llm":
                await self._judge_item_llm(
                    db, item, answer=answer, template=template,
                    model_config=model_config, provider=provider, model=model,
                    max_tokens=max_tokens, pass_threshold=pass_threshold,
                )
            else:
                score, status, reason = self.evaluate_answer_f1(answer, item.expected_answer, pass_threshold)
                item.score = score
                item.status = status
                item.reason = reason

            item.latency_ms = int((time.perf_counter() - started) * 1000)
            item.completed_at = datetime.utcnow()
            db.commit()
        except Exception as exc:
            db.rollback()
            item.status = "failed"
            item.error_message = str(exc)[:500]
            item.latency_ms = int((time.perf_counter() - started) * 1000)
            item.completed_at = datetime.utcnow()
            db.add(item)
            db.commit()

    async def _judge_item_llm(
        self, db: Session, item: AgentEvaluationItem, *, answer: str,
        template: Optional[AgentEvaluationTemplate], model_config: Optional[ModelConfig],
        provider: str, model: Optional[str], max_tokens: int, pass_threshold: float,
    ) -> None:
        """LLM-as-Judge语义评判"""
        if template:
            system_prompt = template.system_prompt or ""
            user_prompt = render_prompt(
                template.user_prompt,
                {"query": item.question, "expected_answer": item.expected_answer or "", "answer": answer},
            )
        else:
            system_prompt = (
                "你是一个专业的AI回答质量评估专家。评估AI回答与期望答案的语义一致性。"
                "请以JSON格式返回：{\"score\": <0到1的分数>, \"reason\": <评估理由>}"
            )
            user_prompt = (
                f"问题：{item.question}\n"
                f"期望答案：{item.expected_answer or '无'}\n"
                f"实际回答：{answer}\n\n"
                f"请评估实际回答与期望答案的语义一致性，给出0-1的分数和理由。"
            )

        judge_provider = provider
        judge_kwargs: Dict[str, Any] = {"temperature": 0.1, "max_tokens": max_tokens}
        if model_config:
            judge_provider = model_config.provider
            judge_kwargs.update({
                "model": model_config.model,
                "base_url": model_config.base_url,
                "api_key": model_config.api_key,
            })
        elif model:
            judge_kwargs["model"] = model

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})

        result = await llm_client.chat_completion(messages, provider=judge_provider, **judge_kwargs)
        if not result.get("success"):
            item.status = "failed"
            item.error_message = f"LLM-as-judge调用失败: {result.get('error', '未知错误')}"
            return

        judge_output = str(result.get("content") or "").strip()
        item.evaluation_result = judge_output
        score, reason = parse_llm_eval_result(judge_output)
        item.score = score
        item.reason = reason
        item.status = "valid" if score >= pass_threshold else "invalid"

    # ---- 人工标注 ----

    def update_human_label(self, db: Session, item_id: int, label: str, comment: Optional[str] = None) -> Optional[AgentEvaluationItem]:
        item = db.query(AgentEvaluationItem).filter(AgentEvaluationItem.id == item_id).first()
        if not item:
            return None
        if label not in ("correct", "incorrect"):
            raise ValueError("human_label 必须为 correct 或 incorrect")
        item.human_override = True
        item.human_label = label
        item.human_comment = comment
        db.commit()
        db.refresh(item)
        # 刷新 run 统计
        self._refresh_run_stats(db, item.run_id)
        return item

    def clear_human_label(self, db: Session, item_id: int) -> Optional[AgentEvaluationItem]:
        item = db.query(AgentEvaluationItem).filter(AgentEvaluationItem.id == item_id).first()
        if not item:
            return None
        item.human_override = False
        item.human_label = None
        item.human_comment = None
        db.commit()
        db.refresh(item)
        self._refresh_run_stats(db, item.run_id)
        return item

    # ---- 单条评测 ----

    def list_evaluations(self, db: Session, template_id: Optional[int] = None, limit: int = 20, offset: int = 0) -> Tuple[List[AgentEvaluation], int]:
        query = db.query(AgentEvaluation)
        if template_id:
            query = query.filter(AgentEvaluation.template_id == template_id)
        total = query.count()
        evaluations = query.order_by(AgentEvaluation.created_at.desc()).offset(offset).limit(limit).all()
        return evaluations, total

    def get_evaluation(self, db: Session, evaluation_id: int) -> Optional[AgentEvaluation]:
        return db.query(AgentEvaluation).filter(AgentEvaluation.id == evaluation_id).first()

    def create_evaluation(self, db: Session, payload: AgentEvaluationCreate) -> AgentEvaluation:
        evaluation = AgentEvaluation(
            template_id=payload.template_id,
            bad_case_turn_id=payload.bad_case_turn_id,
            query=payload.query.strip(),
            answer=payload.answer.strip(),
            expected_answer=payload.expected_answer,
            status="pending",
        )
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)
        return evaluation

    # ---- f1 评分 ----

    def evaluate_answer_f1(self, answer: str, expected_answer: Optional[str], pass_threshold: float = 0.55) -> Tuple[float, str, str]:
        normalized_answer = self._normalize(answer)
        if len(normalized_answer) < 4:
            return 0.0, "invalid", "回答为空或信息量过低"
        lowered = normalized_answer.lower()
        if any(p in lowered for p in INVALID_ANSWER_PATTERNS):
            return 0.0, "invalid", "命中拒答模式"
        if not expected_answer or not expected_answer.strip():
            return 1.0, "valid", "未提供期望答案，按非拒答判定有效"
        expected_tokens = self._extract_terms(expected_answer)
        if not expected_tokens:
            return 1.0, "valid", "期望答案无关键词，判定通过"
        answer_text = self._normalize(answer)
        hit = sum(1 for t in expected_tokens if t in answer_text)
        coverage = hit / len(expected_tokens)
        expected_compact = self._normalize(expected_answer)
        if expected_compact and expected_compact in answer_text:
            coverage = 1.0
        score = round(min(1.0, coverage), 3)
        if score >= pass_threshold:
            return score, "valid", f"命中关键词 {hit}/{len(expected_tokens)}"
        return score, "invalid", f"关键词覆盖不足 {hit}/{len(expected_tokens)}"

    # ---- 统计刷新 ----

    def _refresh_run_stats(self, db: Session, run_id: int) -> None:
        run = self.get_run(db, run_id)
        if not run:
            return
        items = db.query(AgentEvaluationItem).filter(AgentEvaluationItem.run_id == run_id).all()
        total = len(items)

        # 计算最终判定（考虑人工覆盖）
        final_valid = 0
        final_invalid = 0
        failed = 0
        human_override_count = 0
        for item in items:
            if item.status == "failed":
                failed += 1
                continue
            if item.human_override:
                human_override_count += 1
                if item.human_label == "correct":
                    final_valid += 1
                elif item.human_label == "incorrect":
                    final_invalid += 1
            else:
                if item.status == "valid":
                    final_valid += 1
                elif item.status == "invalid":
                    final_invalid += 1

        finished = final_valid + final_invalid + failed
        run.total_count = total
        run.valid_count = final_valid
        run.invalid_count = final_invalid
        run.failed_count = failed
        run.human_override_count = human_override_count
        run.valid_rate = round(final_valid / total * 100, 2) if total else 0
        run.failure_rate = round((final_invalid + failed) / total * 100, 2) if total else 0
        run.status = "completed" if finished == total else "running"
        if run.status == "completed":
            run.completed_at = datetime.utcnow()
        latencies = [i.latency_ms for i in items if i.latency_ms]
        run.summary = {
            **(run.summary or {}),
            "avg_latency_ms": round(sum(latencies) / len(latencies), 1) if latencies else 0,
        }
        db.commit()

    # ---- 序列化 ----

    def serialize_run(self, run: AgentEvaluationRun) -> Dict[str, Any]:
        dataset_name = None
        if hasattr(run, "dataset") and run.dataset:
            dataset_name = run.dataset.name
        agent_name = None
        if hasattr(run, "agent") and run.agent:
            agent_name = run.agent.name
        return {
            "id": run.id,
            "name": run.name,
            "dataset_id": run.dataset_id,
            "dataset_name": dataset_name,
            "agent_id": run.agent_id,
            "agent_name": agent_name,
            "template_id": run.template_id,
            "eval_mode": run.eval_mode or "f1",
            "provider": run.provider,
            "model": run.model,
            "model_config_id": run.model_config_id,
            "status": run.status,
            "total_count": run.total_count,
            "valid_count": run.valid_count,
            "invalid_count": run.invalid_count,
            "failed_count": run.failed_count,
            "human_override_count": run.human_override_count,
            "valid_rate": run.valid_rate,
            "failure_rate": run.failure_rate,
            "summary": run.summary,
            "error_message": run.error_message,
            "created_at": run.created_at,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "items": [self.serialize_item(i) for i in getattr(run, "items", [])],
        }

    def serialize_item(self, item: AgentEvaluationItem) -> Dict[str, Any]:
        return {
            "id": item.id,
            "dataset_item_id": item.dataset_item_id,
            "question": item.question,
            "expected_answer": item.expected_answer,
            "actual_answer": item.actual_answer,
            "evaluation_result": item.evaluation_result,
            "status": item.status,
            "score": item.score,
            "reason": item.reason,
            "error_message": item.error_message,
            "latency_ms": item.latency_ms,
            "human_override": item.human_override,
            "human_label": item.human_label,
            "human_comment": item.human_comment,
            "created_at": item.created_at,
            "completed_at": item.completed_at,
        }

    def serialize_evaluation(self, evaluation: AgentEvaluation) -> Dict[str, Any]:
        template_name = evaluation.template.name if evaluation.template else None
        return {
            "id": evaluation.id, "template_id": evaluation.template_id,
            "template_name": template_name, "query": evaluation.query,
            "answer": evaluation.answer, "expected_answer": evaluation.expected_answer,
            "score": evaluation.score, "reason": evaluation.reason,
            "status": evaluation.status, "error_message": evaluation.error_message,
            "latency_ms": evaluation.latency_ms, "created_at": evaluation.created_at,
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
