"""
Agent评测模板管理服务
参考 xapp 的 evaluation-templates API，支持模板 CRUD + 评测数量统计
"""

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.database_models import AgentEvaluation, AgentEvaluationTemplate, ModelConfig
from schemas.agent_evaluation_schemas import (
    AgentEvaluationTemplateCreate,
    AgentEvaluationTemplateUpdate,
)


class EvaluationTemplateService:

    def list_templates(
        self, db: Session, keyword: Optional[str] = None, limit: int = 20, offset: int = 0
    ) -> tuple:
        """列出评测模板，支持关键词搜索和分页"""
        query = db.query(AgentEvaluationTemplate)
        if keyword:
            search_pattern = f"%{keyword}%"
            query = query.filter(
                AgentEvaluationTemplate.name.ilike(search_pattern)
                | AgentEvaluationTemplate.description.ilike(search_pattern)
            )
        total = query.count()
        templates = query.order_by(
            AgentEvaluationTemplate.updated_at.desc(), AgentEvaluationTemplate.id.desc()
        ).offset(offset).limit(limit).all()
        return templates, total

    def get_template(self, db: Session, template_id: int) -> Optional[AgentEvaluationTemplate]:
        return db.query(AgentEvaluationTemplate).filter(
            AgentEvaluationTemplate.id == template_id
        ).first()

    def create_template(
        self, db: Session, payload: AgentEvaluationTemplateCreate
    ) -> AgentEvaluationTemplate:
        # llm 模式必须关联 model_config_id
        if payload.eval_mode == "llm" and not payload.model_config_id:
            raise ValueError("LLM评测模式必须指定 model_config_id")

        template = AgentEvaluationTemplate(
            name=payload.name.strip(),
            description=payload.description,
            system_prompt=payload.system_prompt,
            user_prompt=payload.user_prompt.strip(),
            eval_mode=payload.eval_mode,
            model_config_id=payload.model_config_id,
            pass_threshold=payload.pass_threshold,
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        return template

    def update_template(
        self, db: Session, template_id: int, payload: AgentEvaluationTemplateUpdate
    ) -> Optional[AgentEvaluationTemplate]:
        template = self.get_template(db, template_id)
        if not template:
            return None

        update_data = payload.dict(exclude_unset=True)
        # llm 模式校验
        new_eval_mode = update_data.get("eval_mode", template.eval_mode)
        new_model_config_id = update_data.get("model_config_id", template.model_config_id)
        if new_eval_mode == "llm" and not new_model_config_id:
            raise ValueError("LLM评测模式必须指定 model_config_id")

        for key, value in update_data.items():
            if value is not None and isinstance(value, str):
                value = value.strip()
            setattr(template, key, value)

        db.commit()
        db.refresh(template)
        return template

    def delete_template(self, db: Session, template_id: int) -> bool:
        template = self.get_template(db, template_id)
        if not template:
            return False
        db.delete(template)
        db.commit()
        return True

    def serialize_template(self, db: Session, template: AgentEvaluationTemplate) -> Dict[str, Any]:
        """序列化模板，包含关联的模型配置名称和评测数量"""
        model_config_name = None
        if template.model_config:
            model_config_name = template.model_config.name

        evaluation_count = db.query(AgentEvaluation).filter(
            AgentEvaluation.template_id == template.id
        ).count()

        return {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "system_prompt": template.system_prompt,
            "user_prompt": template.user_prompt,
            "eval_mode": template.eval_mode,
            "model_config_id": template.model_config_id,
            "model_config_name": model_config_name,
            "pass_threshold": template.pass_threshold,
            "evaluation_count": evaluation_count,
            "created_at": template.created_at,
            "updated_at": template.updated_at,
        }


evaluation_template_service = EvaluationTemplateService()