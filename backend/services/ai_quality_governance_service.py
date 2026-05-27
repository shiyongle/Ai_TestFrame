from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.database_models import (
    AIABExperiment,
    AIGenerationReview,
    AIGenerationSession,
    AIGeneratedCaseEvidence,
    AIKnowledgeQualityScan,
    AIModelBudget,
    AIPromptVersion,
    AgentEvaluationRun,
    KnowledgeDocument,
    ModelConfig,
)


class AIQualityGovernanceService:
    def overview(self, db: Session) -> Dict[str, Any]:
        review_count = db.query(AIGenerationReview).count()
        adopted_count = db.query(AIGenerationReview).filter(AIGenerationReview.status == "adopted").count()
        avg_quality = db.query(func.avg(AIGenerationReview.quality_score)).scalar() or 0
        avg_hallucination = db.query(func.avg(AIGenerationReview.hallucination_score)).scalar() or 0
        total_tokens = db.query(func.sum(AgentEvaluationRun.total_tokens)).scalar() or 0
        total_cost = db.query(func.sum(AgentEvaluationRun.avg_cost * AgentEvaluationRun.total_count)).scalar() or 0
        generation_count = db.query(AIGeneratedCaseEvidence).count()
        cited_generation_count = db.query(AIGeneratedCaseEvidence).filter(AIGeneratedCaseEvidence.citation_count > 0).count()
        stale_knowledge_count = (
            db.query(KnowledgeDocument)
            .filter(KnowledgeDocument.updated_at < datetime.utcnow() - timedelta(days=180))
            .count()
        )
        return {
            "prompt_versions": db.query(AIPromptVersion).count(),
            "reviews": review_count,
            "adoption_rate": round(adopted_count / review_count * 100, 1) if review_count else 0,
            "avg_quality_score": round(float(avg_quality), 1),
            "avg_hallucination_score": round(float(avg_hallucination), 1),
            "model_configs": db.query(ModelConfig).count(),
            "total_tokens": int(total_tokens),
            "total_cost": round(float(total_cost), 4),
            "knowledge_docs": db.query(KnowledgeDocument).count(),
            "stale_knowledge_docs": stale_knowledge_count,
            "generation_citation_rate": round(cited_generation_count / generation_count * 100, 1) if generation_count else 0,
            "running_evaluations": db.query(AgentEvaluationRun).filter(AgentEvaluationRun.status == "running").count(),
        }

    def list_prompts(self, db: Session, prompt_type: Optional[str] = None) -> List[Dict[str, Any]]:
        query = db.query(AIPromptVersion)
        if prompt_type:
            query = query.filter(AIPromptVersion.prompt_type == prompt_type)
        return [self.serialize_prompt(row) for row in query.order_by(AIPromptVersion.updated_at.desc()).all()]

    def create_prompt(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        row = AIPromptVersion(**payload)
        db.add(row)
        db.commit()
        db.refresh(row)
        return self.serialize_prompt(row)

    def activate_prompt(self, db: Session, prompt_id: int) -> Dict[str, Any]:
        row = db.query(AIPromptVersion).filter(AIPromptVersion.id == prompt_id).first()
        if not row:
            raise ValueError("Prompt 版本不存在")
        db.query(AIPromptVersion).filter(AIPromptVersion.prompt_type == row.prompt_type).update({"status": "archived"})
        row.status = "active"
        row.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(row)
        return self.serialize_prompt(row)

    def list_reviews(self, db: Session, status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        query = db.query(AIGenerationReview)
        if status:
            query = query.filter(AIGenerationReview.status == status)
        rows = query.order_by(AIGenerationReview.updated_at.desc()).limit(limit).all()
        return [self.serialize_review(row) for row in rows]

    def create_review(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        score = self.score_generation(payload.get("content") or {})
        payload.setdefault("quality_score", score["quality_score"])
        payload.setdefault("hallucination_score", score["hallucination_score"])
        payload.setdefault("hallucination_flags", score["flags"])
        row = AIGenerationReview(**payload)
        db.add(row)
        db.commit()
        db.refresh(row)
        return self.serialize_review(row)

    def update_review(self, db: Session, review_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
        row = db.query(AIGenerationReview).filter(AIGenerationReview.id == review_id).first()
        if not row:
            raise ValueError("生成评审记录不存在")
        for key, value in payload.items():
            if hasattr(row, key):
                setattr(row, key, value)
        if row.status == "adopted" and not row.adopted_at:
            row.adopted_at = datetime.utcnow()
        row.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(row)
        return self.serialize_review(row)

    def score_generation(self, content: Dict[str, Any]) -> Dict[str, Any]:
        text = self._content_text(content)
        flags = []
        if not text.strip():
            flags.append({"type": "empty_output", "message": "生成内容为空"})
        if len(text) < 80:
            flags.append({"type": "too_short", "message": "生成内容过短，可能缺少步骤、断言或上下文"})
        uncertain_terms = ["可能", "大概", "猜测", "无法确定", "TODO", "待确认", "假设"]
        hits = [term for term in uncertain_terms if term.lower() in text.lower()]
        if hits:
            flags.append({"type": "uncertain_statement", "message": f"包含不确定表达: {', '.join(hits[:5])}"})
        citation_like = any(key in content for key in ["citations", "evidence", "knowledge_refs", "source_refs"])
        if not citation_like:
            flags.append({"type": "missing_evidence", "message": "未携带引用、证据或知识来源"})
        hallucination_score = min(100, len(flags) * 25)
        quality_score = max(0, 100 - hallucination_score)
        if "steps" in content and isinstance(content["steps"], list) and content["steps"]:
            quality_score = min(100, quality_score + 10)
        if "assertions" in content and content["assertions"]:
            quality_score = min(100, quality_score + 10)
        return {
            "quality_score": round(quality_score, 1),
            "hallucination_score": round(hallucination_score, 1),
            "flags": flags,
        }

    def list_budgets(self, db: Session) -> List[Dict[str, Any]]:
        return [self.serialize_budget(row) for row in db.query(AIModelBudget).order_by(AIModelBudget.updated_at.desc()).all()]

    def create_budget(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        row = AIModelBudget(**payload)
        db.add(row)
        db.commit()
        db.refresh(row)
        return self.serialize_budget(row)

    def sync_budget_usage(self, db: Session) -> Dict[str, Any]:
        month = datetime.utcnow().strftime("%Y-%m")
        rows = db.query(AIModelBudget).filter(AIModelBudget.period_month == month).all()
        updated = 0
        for row in rows:
            query = db.query(AgentEvaluationRun).filter(AgentEvaluationRun.model == row.model)
            row.used_tokens = int(query.with_entities(func.sum(AgentEvaluationRun.total_tokens)).scalar() or 0)
            row.used_cost = float(query.with_entities(func.sum(AgentEvaluationRun.avg_cost * AgentEvaluationRun.total_count)).scalar() or 0)
            row.updated_at = datetime.utcnow()
            updated += 1
        db.commit()
        return {"period_month": month, "updated": updated}

    def list_experiments(self, db: Session) -> List[Dict[str, Any]]:
        return [self.serialize_experiment(row) for row in db.query(AIABExperiment).order_by(AIABExperiment.updated_at.desc()).all()]

    def create_experiment(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        row = AIABExperiment(**payload)
        row.result_summary = row.result_summary or self._build_ab_summary(db, payload)
        if not row.winner:
            score_a = (row.result_summary or {}).get("a_score", 0)
            score_b = (row.result_summary or {}).get("b_score", 0)
            row.winner = "A" if score_a > score_b else "B" if score_b > score_a else "tie"
        db.add(row)
        db.commit()
        db.refresh(row)
        return self.serialize_experiment(row)

    def list_knowledge_scans(self, db: Session, limit: int = 50) -> List[Dict[str, Any]]:
        rows = db.query(AIKnowledgeQualityScan).order_by(AIKnowledgeQualityScan.scanned_at.desc()).limit(limit).all()
        return [self.serialize_knowledge_scan(row) for row in rows]

    def scan_knowledge(self, db: Session, max_docs: int = 100) -> Dict[str, Any]:
        docs = db.query(KnowledgeDocument).order_by(KnowledgeDocument.updated_at.desc()).limit(max_docs).all()
        created = 0
        for doc in docs:
            result = self._score_knowledge_doc(doc)
            db.add(AIKnowledgeQualityScan(document_id=doc.id, **result))
            created += 1
        db.commit()
        return {"scanned": created}

    def _score_knowledge_doc(self, doc: KnowledgeDocument) -> Dict[str, Any]:
        issues = []
        content = doc.content or ""
        age_days = (datetime.utcnow() - (doc.updated_at or doc.created_at or datetime.utcnow())).days
        if len(content.strip()) < 200:
            issues.append({"type": "too_short", "message": "知识内容过短"})
        if age_days > 180:
            issues.append({"type": "stale", "message": f"知识已 {age_days} 天未更新"})
        if not doc.category:
            issues.append({"type": "missing_category", "message": "缺少知识分类"})
        freshness_score = max(0, 100 - max(0, age_days - 30) * 0.4)
        coverage_score = min(100, len(content) / 20)
        quality_score = max(0, min(100, (freshness_score * 0.4 + coverage_score * 0.4 + (100 - len(issues) * 25) * 0.2)))
        return {
            "scan_type": "quality_freshness",
            "quality_score": round(quality_score, 1),
            "freshness_score": round(freshness_score, 1),
            "coverage_score": round(coverage_score, 1),
            "issue_count": len(issues),
            "issues": issues,
            "status": "completed",
            "scanned_at": datetime.utcnow(),
        }

    def _build_ab_summary(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        model_a = db.query(ModelConfig).filter(ModelConfig.id == payload.get("model_a_id")).first() if payload.get("model_a_id") else None
        model_b = db.query(ModelConfig).filter(ModelConfig.id == payload.get("model_b_id")).first() if payload.get("model_b_id") else None
        a_score = self._model_avg_valid_rate(db, model_a.model if model_a else None)
        b_score = self._model_avg_valid_rate(db, model_b.model if model_b else None)
        return {"a_score": a_score, "b_score": b_score, "metric": payload.get("metric_name") or "valid_rate"}

    def _model_avg_valid_rate(self, db: Session, model: Optional[str]) -> float:
        if not model:
            return 0
        return round(float(db.query(func.avg(AgentEvaluationRun.valid_rate)).filter(AgentEvaluationRun.model == model).scalar() or 0), 1)

    def _content_text(self, content: Dict[str, Any]) -> str:
        if isinstance(content, dict):
            return " ".join(str(v) for v in content.values())
        return str(content or "")

    def _dt(self, value: Any) -> Optional[str]:
        return value.isoformat() if value else None

    def serialize_prompt(self, row: AIPromptVersion) -> Dict[str, Any]:
        return {
            "id": row.id,
            "name": row.name,
            "prompt_type": row.prompt_type,
            "version": row.version,
            "system_prompt": row.system_prompt,
            "user_prompt": row.user_prompt,
            "model_config_id": row.model_config_id,
            "status": row.status,
            "change_log": row.change_log,
            "metrics": row.metrics or {},
            "created_by": row.created_by,
            "created_at": self._dt(row.created_at),
            "updated_at": self._dt(row.updated_at),
        }

    def serialize_review(self, row: AIGenerationReview) -> Dict[str, Any]:
        return {
            "id": row.id,
            "source_type": row.source_type,
            "source_id": row.source_id,
            "prompt_version_id": row.prompt_version_id,
            "model_config_id": row.model_config_id,
            "title": row.title,
            "content": row.content or {},
            "status": row.status,
            "quality_score": row.quality_score,
            "hallucination_score": row.hallucination_score,
            "hallucination_flags": row.hallucination_flags or [],
            "reviewer": row.reviewer,
            "review_comment": row.review_comment,
            "adopted_at": self._dt(row.adopted_at),
            "created_at": self._dt(row.created_at),
            "updated_at": self._dt(row.updated_at),
        }

    def serialize_budget(self, row: AIModelBudget) -> Dict[str, Any]:
        token_usage = row.used_tokens / row.token_budget * 100 if row.token_budget else 0
        cost_usage = row.used_cost / row.cost_budget * 100 if row.cost_budget else 0
        return {
            "id": row.id,
            "name": row.name,
            "provider": row.provider,
            "model": row.model,
            "period_month": row.period_month,
            "token_budget": row.token_budget,
            "cost_budget": row.cost_budget,
            "used_tokens": row.used_tokens,
            "used_cost": row.used_cost,
            "token_usage_rate": round(token_usage, 1),
            "cost_usage_rate": round(cost_usage, 1),
            "alert_threshold": row.alert_threshold,
            "enabled": row.enabled,
            "updated_at": self._dt(row.updated_at),
        }

    def serialize_experiment(self, row: AIABExperiment) -> Dict[str, Any]:
        return {
            "id": row.id,
            "name": row.name,
            "prompt_a_id": row.prompt_a_id,
            "prompt_b_id": row.prompt_b_id,
            "model_a_id": row.model_a_id,
            "model_b_id": row.model_b_id,
            "metric_name": row.metric_name,
            "sample_size": row.sample_size,
            "result_summary": row.result_summary or {},
            "winner": row.winner,
            "status": row.status,
            "updated_at": self._dt(row.updated_at),
        }

    def serialize_knowledge_scan(self, row: AIKnowledgeQualityScan) -> Dict[str, Any]:
        return {
            "id": row.id,
            "document_id": row.document_id,
            "document_title": row.document.title if row.document else None,
            "scan_type": row.scan_type,
            "quality_score": row.quality_score,
            "freshness_score": row.freshness_score,
            "coverage_score": row.coverage_score,
            "issue_count": row.issue_count,
            "issues": row.issues or [],
            "status": row.status,
            "scanned_at": self._dt(row.scanned_at),
        }


ai_quality_governance_service = AIQualityGovernanceService()
