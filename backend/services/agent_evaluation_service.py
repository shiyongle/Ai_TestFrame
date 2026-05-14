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


def parse_llm_eval_result(raw_text: str) -> Tuple[float, str, Dict[str, Any]]:
    """
    解析 LLM 评判结果，返回 (score, reason, dimensions)

    增强版：支持更多格式、更健壮的错误处理
    """
    dimensions = {}

    def _extract(data: dict) -> Tuple[float, str, Dict[str, Any]]:
        """从字典中提取评分信息，并验证数据有效性"""
        # 提取score（支持多种字段名）
        score = 0.0
        for score_key in ("score", "Score", "评分", "分数"):
            if score_key in data:
                try:
                    score = float(data[score_key])
                    break
                except (ValueError, TypeError):
                    continue

        # 提取reason（支持多种字段名）
        reason = ""
        for reason_key in ("reason", "Reason", "原因", "理由", "评价"):
            if reason_key in data:
                reason = str(data[reason_key])
                break

        # 提取维度数据并验证范围
        dims = {}
        for dim_key in ("accuracy", "completeness", "hallucination", "准确性", "完整性", "幻觉"):
            if dim_key in data:
                try:
                    dim_value = float(data[dim_key])
                    # 验证范围并修正
                    if dim_value > 1:
                        dim_value = dim_value / 100
                    dims[dim_key] = round(max(0.0, min(1.0, dim_value)), 3)
                except (ValueError, TypeError):
                    pass

        # 验证并修正score范围
        if score > 1:
            score = score / 100
        score = max(0.0, min(1.0, score))

        return score, reason, dims

    # 1. 尝试直接JSON解析
    try:
        result = json.loads(raw_text.strip())
        if isinstance(result, dict):
            return _extract(result)
    except (json.JSONDecodeError, ValueError):
        pass

    # 2. 尝试提取markdown代码块中的JSON
    json_patterns = [
        r"```json\s*(.*?)\s*```",
        r"```\s*(.*?)\s*```",
        r"\{[^{}]*\"score\"[^{}]*\}",
        r"\{[^{}]*\"Score\"[^{}]*\}",
        r"\{[^{}]*\"评分\"[^{}]*\}",
    ]
    for pattern in json_patterns:
        match = re.search(pattern, raw_text, re.DOTALL | re.IGNORECASE)
        if match:
            try:
                json_str = match.group(1) if "```" in pattern else match.group(0)
                # 尝试修复常见JSON格式问题
                json_str = json_str.strip()
                # 移除可能的注释
                json_str = re.sub(r'//.*?\n', '\n', json_str)
                json_str = re.sub(r'/\*.*?\*/', '', json_str, flags=re.DOTALL)

                result = json.loads(json_str)
                if isinstance(result, dict):
                    return _extract(result)
            except (json.JSONDecodeError, ValueError):
                continue

    # 3. 尝试使用正则提取score和reason
    score_match = re.search(
        r"(?:score|Score|得分|分数|评分)[:\s=：]*([0-9]*\.?[0-9]+)",
        raw_text,
        re.IGNORECASE
    )
    if score_match:
        try:
            score = float(score_match.group(1))
            if score > 1:
                score = score / 100
            score = max(0.0, min(1.0, score))

            # 尝试提取reason
            reason_match = re.search(
                r"(?:reason|Reason|原因|理由|评价)[:\s=：]*(.*?)(?:\n|$)",
                raw_text,
                re.IGNORECASE
            )
            reason = reason_match.group(1).strip() if reason_match else raw_text.strip()

            return score, reason, {}
        except (ValueError, TypeError):
            pass

    # 4. 如果包含"通过"、"合格"等关键词，给予基础分
    if any(keyword in raw_text for keyword in ["通过", "合格", "正确", "准确", "pass", "correct"]):
        return 0.6, raw_text.strip(), {}

    # 5. 如果包含"不通过"、"不合格"等关键词，给予低分
    if any(keyword in raw_text for keyword in ["不通过", "不合格", "错误", "不准确", "fail", "incorrect"]):
        return 0.3, raw_text.strip(), {}

    # 6. 默认返回0分
    return 0.0, raw_text.strip(), {}


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
        try:
            return (
                db.query(AgentEvaluationRun)
                .options(
                    selectinload(AgentEvaluationRun.dataset),
                    selectinload(AgentEvaluationRun.agent),
                )
                .order_by(AgentEvaluationRun.created_at.desc(), AgentEvaluationRun.id.desc())
                .limit(limit)
                .all()
            )
        except Exception as e:
            db.rollback()
            try:
                # 回退：不加载关系
                return (
                    db.query(AgentEvaluationRun)
                    .order_by(AgentEvaluationRun.created_at.desc(), AgentEvaluationRun.id.desc())
                    .limit(limit)
                    .all()
                )
            except Exception:
                db.rollback()
                # 最终回退：用 raw SQL 查已有列，构建最小 Run 对象
                from sqlalchemy import text
                rows = db.execute(text(
                    "SELECT id, name, template_id, eval_mode, provider, model, model_config_id, "
                    "status, total_count, valid_count, invalid_count, failed_count, "
                    "valid_rate, failure_rate, summary, error_message, "
                    "created_at, started_at, completed_at "
                    "FROM agent_evaluation_runs ORDER BY created_at DESC LIMIT :lim"
                ), {"lim": limit}).fetchall()
                results = []
                for row in rows:
                    run = AgentEvaluationRun()
                    run.id = row[0]; run.name = row[1]; run.template_id = row[2]
                    run.eval_mode = row[3]; run.provider = row[4] or ""; run.model = row[5]
                    run.model_config_id = row[6]; run.status = row[7]; run.total_count = row[8]
                    run.valid_count = row[9]; run.invalid_count = row[10]; run.failed_count = row[11]
                    run.valid_rate = row[12]; run.failure_rate = row[13]
                    run.summary = row[14]; run.error_message = row[15]
                    run.created_at = row[16]; run.started_at = row[17]; run.completed_at = row[18]
                    results.append(run)
                return results

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
        """执行评测：并发调用被测Agent → LLM-as-Judge评判，逐条更新进度

        优化点：
        1. 分批处理，避免大数据集内存溢出
        2. 每个item使用独立session，避免并发冲突
        3. 降低统计刷新频率，减少数据库写入
        """
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

            # 预加载配置（避免在并发中重复查询）
            agent = None
            if run.agent_id:
                agent = db.query(DifyAgent).filter(DifyAgent.id == run.agent_id).first()

            template = None
            if run.template_id:
                template = db.query(AgentEvaluationTemplate).filter(
                    AgentEvaluationTemplate.id == run.template_id
                ).first()

            model_config = None
            if run.model_config_id:
                model_config = db.query(ModelConfig).filter(ModelConfig.id == run.model_config_id).first()
            elif template and template.model_config_id:
                model_config = db.query(ModelConfig).filter(ModelConfig.id == template.model_config_id).first()

            # 分批处理，避免大数据集一次性加载
            BATCH_SIZE = 50
            total_count = db.query(AgentEvaluationItem).filter(
                AgentEvaluationItem.run_id == run.id,
                AgentEvaluationItem.status.in_(["pending", "failed"])
            ).count()

            semaphore = asyncio.Semaphore(3)  # 最多3条并发
            completed_count = 0

            async def _exec_with_sem(item_id: int):
                """使用独立session执行单个item，避免并发冲突"""
                nonlocal completed_count
                item_db = SessionLocal()
                try:
                    async with semaphore:
                        # 重新查询item（使用独立session）
                        item = item_db.query(AgentEvaluationItem).filter(
                            AgentEvaluationItem.id == item_id
                        ).first()
                        if not item:
                            return

                        await self._execute_item(
                            item_db, item, agent=agent, template=template, model_config=model_config,
                            provider=run.provider, model=run.model,
                            temperature=temperature, max_tokens=max_tokens,
                            pass_threshold=pass_threshold, eval_mode=run.eval_mode,
                        )

                        completed_count += 1

                        # 每完成10条或30%概率刷新统计（降低写入频率）
                        if completed_count % 10 == 0 or (completed_count < 10 and completed_count % 3 == 0):
                            stats_db = SessionLocal()
                            try:
                                self._refresh_run_stats(stats_db, run.id)
                            except Exception:
                                pass
                            finally:
                                stats_db.close()
                finally:
                    item_db.close()

            # 分批加载并执行
            for offset in range(0, total_count, BATCH_SIZE):
                batch_items = db.query(AgentEvaluationItem).filter(
                    AgentEvaluationItem.run_id == run.id,
                    AgentEvaluationItem.status.in_(["pending", "failed"])
                ).offset(offset).limit(BATCH_SIZE).all()

                # 只传递item_id，避免跨session使用对象
                item_ids = [item.id for item in batch_items]
                await asyncio.gather(*[_exec_with_sem(item_id) for item_id in item_ids], return_exceptions=True)

            # 最终刷新统计
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
        """LLM-as-Judge语义评判（多维度）"""
        if template:
            system_prompt = template.system_prompt or ""
            user_prompt = render_prompt(
                template.user_prompt,
                {"query": item.question, "expected_answer": item.expected_answer or "", "answer": answer},
            )
        else:
            system_prompt = (
                "你是一个专业的AI回答质量评估专家。请从多个维度评估AI回答的质量。\n"
                "请严格以JSON格式返回：\n"
                "{\n"
                '  "score": <0到1的综合分数>,\n'
                '  "accuracy": <0到1，答案是否正确>,\n'
                '  "completeness": <0到1，是否覆盖了期望答案的关键信息>,\n'
                '  "hallucination": <0到1，0=无幻觉/1=严重幻觉，即编造了不存在的信息>,\n'
                '  "reason": <一句话评估理由>\n'
                "}"
            )
            user_prompt = (
                f"问题：{item.question}\n"
                f"期望答案：{item.expected_answer or '无'}\n"
                f"实际回答：{answer}\n\n"
                f"请从准确性(accuracy)、完整性(completeness)、幻觉程度(hallucination)三个维度评估，并给出综合分数。"
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
        score, reason, dimensions = parse_llm_eval_result(judge_output)
        item.score = score
        item.reason = reason
        item.status = "valid" if score >= pass_threshold else "invalid"
        # 存储原始输出和维度明细
        item.evaluation_result = json.dumps(
            {"raw": judge_output, "dimensions": dimensions},
            ensure_ascii=False,
        ) if dimensions else judge_output

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

    # ---- 单条重试 (P1-4) ----

    async def retry_item(self, db: Session, item_id: int) -> Optional[AgentEvaluationItem]:
        """重试单条失败的评测"""
        item = db.query(AgentEvaluationItem).filter(AgentEvaluationItem.id == item_id).first()
        if not item:
            return None

        run = self.get_run(db, item.run_id)
        if not run:
            return None

        # 重置状态
        item.status = "pending"
        item.error_message = None
        item.actual_answer = None
        item.score = 0
        item.reason = None
        item.evaluation_result = None
        item.latency_ms = 0
        item.completed_at = None
        db.commit()

        options = run.summary or {}
        pass_threshold = float(options.get("pass_threshold", 0.55))
        temperature = float(options.get("temperature", 0.2))
        max_tokens = int(options.get("max_tokens", 1024))

        agent = db.query(DifyAgent).filter(DifyAgent.id == run.agent_id).first() if run.agent_id else None
        template = db.query(AgentEvaluationTemplate).filter(
            AgentEvaluationTemplate.id == run.template_id).first() if run.template_id else None
        model_config = None
        if run.model_config_id:
            model_config = db.query(ModelConfig).filter(ModelConfig.id == run.model_config_id).first()
        elif template and template.model_config_id:
            model_config = db.query(ModelConfig).filter(ModelConfig.id == template.model_config_id).first()

        await self._execute_item(
            db, item, agent=agent, template=template, model_config=model_config,
            provider=run.provider, model=run.model,
            temperature=temperature, max_tokens=max_tokens,
            pass_threshold=pass_threshold, eval_mode=run.eval_mode,
        )
        self._refresh_run_stats(db, item.run_id)
        db.refresh(item)
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

    # ---- F1 评分 (P2-8 增强 + jieba分词优化) ----

    def evaluate_answer_f1(self, answer: str, expected_answer: Optional[str], pass_threshold: float = 0.55) -> Tuple[float, str, str]:
        """
        F1评分算法（增强版）

        改进点：
        1. 使用jieba进行中文分词，提升语义匹配准确性
        2. 支持精确匹配 + N-gram模糊匹配 + 双向F1计算
        3. 完整包含检查
        """
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
        answer_tokens = self._extract_terms(answer)

        # 精确匹配 + N-gram 模糊匹配
        hit = 0
        partial_hit = 0
        for t in expected_tokens:
            if t in answer_text:
                hit += 1
            elif self._fuzzy_match(t, answer_tokens, answer_text):
                partial_hit += 1

        # 全文包含检查
        expected_compact = self._normalize(expected_answer)
        if expected_compact and expected_compact in answer_text:
            return 1.0, "valid", "完整包含期望答案"

        total_hit = hit + partial_hit * 0.6  # 模糊匹配降权
        coverage = total_hit / len(expected_tokens) if expected_tokens else 0

        # 计算双向 F1（Precision & Recall）
        if answer_tokens and expected_tokens:
            # Recall: expected 中被 answer 覆盖的比例
            recall = total_hit / len(expected_tokens)
            # Precision: answer 中与 expected 相关的比例
            ans_hit = sum(1 for t in answer_tokens if t in expected_compact)
            precision = ans_hit / len(answer_tokens) if answer_tokens else 0
            if precision + recall > 0:
                f1 = 2 * precision * recall / (precision + recall)
            else:
                f1 = 0
            score = round(max(coverage, f1), 3)
        else:
            score = round(min(1.0, coverage), 3)

        if score >= pass_threshold:
            return score, "valid", f"关键词命中 {hit}+模糊{partial_hit}/{len(expected_tokens)}, F1={score}"
        return score, "invalid", f"覆盖不足 {hit}+模糊{partial_hit}/{len(expected_tokens)}, F1={score}"

    def _fuzzy_match(self, term: str, answer_tokens: List[str], answer_text: str) -> bool:
        """模糊匹配：N-gram 子串 + 编辑距离近似"""
        # 子串匹配（>= 2字符重叠）
        if len(term) >= 3:
            for i in range(len(term) - 1):
                bigram = term[i:i+2]
                if bigram in answer_text:
                    return True
        # 在 answer_tokens 中找近似
        for at in answer_tokens:
            if len(at) >= 2 and len(term) >= 2:
                # 共同字符比例
                common = set(at) & set(term)
                if len(common) / max(len(set(at)), len(set(term))) >= 0.6:
                    return True
        return False

    # ---- Run 对比 (P1-3) ----

    def compare_runs(self, db: Session, run_a_id: int, run_b_id: int) -> Dict[str, Any]:
        """对比两次评测运行的结果"""
        run_a = self.get_run(db, run_a_id)
        run_b = self.get_run(db, run_b_id)
        if not run_a or not run_b:
            return {"error": "Run 不存在"}

        items_a = db.query(AgentEvaluationItem).filter(AgentEvaluationItem.run_id == run_a_id).all()
        items_b = db.query(AgentEvaluationItem).filter(AgentEvaluationItem.run_id == run_b_id).all()

        # 按 question 建立索引
        map_a = {i.question.strip(): i for i in items_a}
        map_b = {i.question.strip(): i for i in items_b}
        all_questions = set(map_a.keys()) | set(map_b.keys())

        improved = []  # A不通过 → B通过
        regressed = []  # A通过 → B不通过
        unchanged_pass = 0
        unchanged_fail = 0

        for q in all_questions:
            a = map_a.get(q)
            b = map_b.get(q)
            a_pass = self._is_final_pass(a) if a else None
            b_pass = self._is_final_pass(b) if b else None

            if a_pass is True and b_pass is False:
                regressed.append({
                    "question": q,
                    "score_a": a.score if a else 0,
                    "score_b": b.score if b else 0,
                    "answer_a": a.actual_answer if a else "",
                    "answer_b": b.actual_answer if b else "",
                })
            elif a_pass is False and b_pass is True:
                improved.append({
                    "question": q,
                    "score_a": a.score if a else 0,
                    "score_b": b.score if b else 0,
                    "answer_a": a.actual_answer if a else "",
                    "answer_b": b.actual_answer if b else "",
                })
            elif a_pass is True and b_pass is True:
                unchanged_pass += 1
            else:
                unchanged_fail += 1

        return {
            "run_a": {"id": run_a.id, "name": run_a.name, "valid_rate": run_a.valid_rate, "total": run_a.total_count},
            "run_b": {"id": run_b.id, "name": run_b.name, "valid_rate": run_b.valid_rate, "total": run_b.total_count},
            "improved": improved,
            "regressed": regressed,
            "unchanged_pass": unchanged_pass,
            "unchanged_fail": unchanged_fail,
            "summary": {
                "rate_change": round((run_b.valid_rate or 0) - (run_a.valid_rate or 0), 2),
                "improved_count": len(improved),
                "regressed_count": len(regressed),
            },
        }

    def _get_final_status(self, item: AgentEvaluationItem) -> Tuple[str, bool]:
        """
        统一获取最终状态和是否通过

        优先级：人工标注 > 自动评测
        """
        if item.status == "failed":
            return "failed", False

        if item.status == "pending":
            return "pending", False

        # 人工标注优先
        if item.human_override:
            is_pass = item.human_label == "correct"
            return "human_correct" if is_pass else "human_incorrect", is_pass

        # 自动评测结果
        is_pass = item.status == "valid"
        return item.status, is_pass

    def _is_final_pass(self, item: AgentEvaluationItem) -> bool:
        """判断item最终是否通过（用于对比分析）"""
        _, is_pass = self._get_final_status(item)
        return is_pass

    # ---- 统计刷新 ----

    def _refresh_run_stats(self, db: Session, run_id: int) -> None:
        """
        刷新评测运行的统计数据（简化版）

        统计维度：
        1. 基础统计：总数、通过、不通过、失败、待处理
        2. 人工标注统计：人工覆盖数量
        3. 分类统计：按category分组统计
        4. 性能统计：平均延迟
        """
        run = self.get_run(db, run_id)
        if not run:
            return

        items = db.query(AgentEvaluationItem).filter(AgentEvaluationItem.run_id == run_id).all()
        total = len(items)

        # 基础统计
        stats = {
            "total": total,
            "valid": 0,
            "invalid": 0,
            "failed": 0,
            "pending": 0,
            "human_override": 0,
        }

        latencies = []
        category_stats = {}

        for item in items:
            status, is_pass = self._get_final_status(item)

            # 基础计数
            if status == "pending":
                stats["pending"] += 1
            elif status == "failed":
                stats["failed"] += 1
            elif is_pass:
                stats["valid"] += 1
            else:
                stats["invalid"] += 1

            # 人工标注计数
            if item.human_override:
                stats["human_override"] += 1

            # 延迟统计
            if item.latency_ms:
                latencies.append(item.latency_ms)

            # 分类统计
            cat = self._get_item_category(db, item)
            if cat not in category_stats:
                category_stats[cat] = {"total": 0, "valid": 0, "invalid": 0, "failed": 0}

            category_stats[cat]["total"] += 1
            if status == "failed":
                category_stats[cat]["failed"] += 1
            elif is_pass:
                category_stats[cat]["valid"] += 1
            else:
                category_stats[cat]["invalid"] += 1

        # 计算分类通过率
        for cat, st in category_stats.items():
            st["valid_rate"] = round(st["valid"] / st["total"] * 100, 1) if st["total"] else 0

        # 更新run统计
        finished = stats["valid"] + stats["invalid"] + stats["failed"]
        run.total_count = total
        run.valid_count = stats["valid"]
        run.invalid_count = stats["invalid"]
        run.failed_count = stats["failed"]
        run.human_override_count = stats["human_override"]
        run.valid_rate = round(stats["valid"] / total * 100, 2) if total else 0
        run.failure_rate = round((stats["invalid"] + stats["failed"]) / total * 100, 2) if total else 0
        run.status = "completed" if finished == total else "running"

        if run.status == "completed":
            run.completed_at = datetime.utcnow()

        # 更新summary
        run.summary = {
            **(run.summary or {}),
            "avg_latency_ms": round(sum(latencies) / len(latencies), 1) if latencies else 0,
            "category_stats": category_stats,
        }

        db.commit()

    def _get_item_category(self, db: Session, item: AgentEvaluationItem) -> str:
        """获取item的分类标签"""
        cat = getattr(item, "category", None) or "未分类"

        # 如果item没有分类，尝试从关联的dataset_item获取
        if cat == "未分类" and getattr(item, "dataset_item_id", None):
            try:
                ds_item = db.query(GoldenDatasetItem).filter(
                    GoldenDatasetItem.id == item.dataset_item_id
                ).first()
                if ds_item and ds_item.category:
                    cat = ds_item.category
            except Exception:
                pass

        return cat

    # ---- 序列化 ----

    def serialize_run(self, run: AgentEvaluationRun) -> Dict[str, Any]:
        dataset_name = None
        agent_name = None
        try:
            ds = getattr(run, "dataset", None)
            if ds:
                dataset_name = ds.name
        except Exception:
            pass
        try:
            ag = getattr(run, "agent", None)
            if ag:
                agent_name = ag.name
        except Exception:
            pass

        # items 只在已 eager load 的情况下序列化，避免 lazy-load 触发 SQL 异常
        items_list = []
        try:
            loaded = run.__dict__.get("items")
            if loaded is not None:
                items_list = [self.serialize_item(i) for i in loaded]
        except Exception:
            pass

        return {
            "id": run.id,
            "name": run.name,
            "dataset_id": getattr(run, "dataset_id", None),
            "dataset_name": dataset_name,
            "agent_id": getattr(run, "agent_id", None),
            "agent_name": agent_name,
            "template_id": run.template_id,
            "eval_mode": run.eval_mode or "f1",
            "provider": run.provider or "",
            "model": run.model,
            "model_config_id": run.model_config_id,
            "status": run.status,
            "total_count": run.total_count,
            "valid_count": run.valid_count,
            "invalid_count": run.invalid_count,
            "failed_count": run.failed_count,
            "human_override_count": getattr(run, "human_override_count", 0) or 0,
            "valid_rate": run.valid_rate,
            "failure_rate": run.failure_rate,
            "summary": run.summary,
            "error_message": run.error_message,
            "created_at": run.created_at,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "items": items_list,
        }

    def serialize_item(self, item: AgentEvaluationItem) -> Dict[str, Any]:
        return {
            "id": item.id,
            "dataset_item_id": getattr(item, "dataset_item_id", None),
            "question": item.question,
            "expected_answer": item.expected_answer,
            "actual_answer": item.actual_answer,
            "evaluation_result": item.evaluation_result,
            "status": item.status,
            "score": item.score,
            "reason": item.reason,
            "error_message": item.error_message,
            "latency_ms": item.latency_ms,
            "human_override": getattr(item, "human_override", False) or False,
            "human_label": getattr(item, "human_label", None),
            "human_comment": getattr(item, "human_comment", None),
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

    async def execute_evaluation(self, evaluation_id: int) -> None:
        """执行单条评测（兼容旧的单条评测流程）"""
        db = SessionLocal()
        try:
            evaluation = db.query(AgentEvaluation).filter(AgentEvaluation.id == evaluation_id).first()
            if not evaluation:
                return
            evaluation.status = "running"
            db.commit()

            template = db.query(AgentEvaluationTemplate).filter(
                AgentEvaluationTemplate.id == evaluation.template_id
            ).first()
            if not template:
                evaluation.status = "failed"
                evaluation.error_message = "评测模板不存在"
                db.commit()
                return

            model_config = None
            if template.model_config_id:
                model_config = db.query(ModelConfig).filter(ModelConfig.id == template.model_config_id).first()

            started = time.perf_counter()
            try:
                if template.eval_mode == "llm":
                    system_prompt = template.system_prompt or ""
                    user_prompt = render_prompt(template.user_prompt, {
                        "query": evaluation.query,
                        "expected_answer": evaluation.expected_answer or "",
                        "answer": evaluation.answer,
                    })

                    judge_kwargs = {"temperature": 0.1, "max_tokens": 1024}
                    judge_provider = ""
                    if model_config:
                        judge_provider = model_config.provider
                        judge_kwargs.update({
                            "model": model_config.model,
                            "base_url": model_config.base_url,
                            "api_key": model_config.api_key,
                        })

                    messages = []
                    if system_prompt:
                        messages.append({"role": "system", "content": system_prompt})
                    messages.append({"role": "user", "content": user_prompt})

                    result = await llm_client.chat_completion(messages, provider=judge_provider, **judge_kwargs)
                    if not result.get("success"):
                        evaluation.status = "failed"
                        evaluation.error_message = result.get("error", "LLM调用失败")
                    else:
                        raw = str(result.get("content", "")).strip()
                        evaluation.evaluation_result = raw
                        score, reason, _ = parse_llm_eval_result(raw)
                        evaluation.score = score
                        evaluation.reason = reason
                        evaluation.status = "completed"
                else:
                    score, status, reason = self.evaluate_answer_f1(
                        evaluation.answer, evaluation.expected_answer, template.pass_threshold
                    )
                    evaluation.score = score
                    evaluation.reason = reason
                    evaluation.status = "completed"
            except Exception as exc:
                evaluation.status = "failed"
                evaluation.error_message = str(exc)[:500]

            evaluation.latency_ms = int((time.perf_counter() - started) * 1000)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    def _normalize(self, text: Optional[str]) -> str:
        """标准化文本：去除空白字符"""
        return re.sub(r"\s+", "", text or "")

    def _extract_terms(self, text: str) -> List[str]:
        """
        提取关键词（增强版）

        使用jieba进行中文分词，提升语义匹配准确性
        """
        import jieba

        normalized = self._normalize(text)

        # 中文分词（过滤停用词和单字）
        chinese_terms = []
        for word in jieba.cut(normalized):
            # 过滤长度小于2的词和常见停用词
            if len(word) >= 2 and word not in ["的", "了", "是", "在", "有", "和", "与", "或", "等", "及"]:
                chinese_terms.append(word)

        # 英文和数字提取
        en_terms = re.findall(r"[A-Za-z0-9_]{2,}", normalized)

        # 合并去重，保持顺序
        all_terms = chinese_terms + en_terms
        seen = set()
        result = []
        for term in all_terms:
            if term not in seen:
                seen.add(term)
                result.append(term)

        # 如果没有提取到任何词，返回原文本
        if not result and normalized:
            result = [normalized]

        return result


agent_evaluation_service = AgentEvaluationService()
