"""
模型配置管理服务
管理Agent评测使用的LLM模型配置，支持多提供商切换
"""

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.database_models import ModelConfig
from schemas.model_config_schemas import ModelConfigCreate, ModelConfigUpdate


class ModelConfigService:

    def list_configs(self, db: Session, enabled_only: bool = False) -> List[ModelConfig]:
        query = db.query(ModelConfig).order_by(ModelConfig.created_at.desc())
        if enabled_only:
            query = query.filter(ModelConfig.enabled == True)
        return query.all()

    def get_config(self, db: Session, config_id: int) -> Optional[ModelConfig]:
        return db.query(ModelConfig).filter(ModelConfig.id == config_id).first()

    def create_config(self, db: Session, payload: ModelConfigCreate) -> ModelConfig:
        config = ModelConfig(
            provider=payload.provider.strip(),
            name=payload.name.strip(),
            api_key=payload.api_key.strip(),
            base_url=payload.base_url.strip(),
            model=payload.model.strip(),
            enabled=payload.enabled,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return config

    def update_config(self, db: Session, config_id: int, payload: ModelConfigUpdate) -> Optional[ModelConfig]:
        config = self.get_config(db, config_id)
        if not config:
            return None

        update_data = payload.dict(exclude_unset=True)
        for key, value in update_data.items():
            if value is not None and isinstance(value, str):
                value = value.strip()
            setattr(config, key, value)

        db.commit()
        db.refresh(config)
        return config

    def delete_config(self, db: Session, config_id: int) -> bool:
        config = self.get_config(db, config_id)
        if not config:
            return False
        db.delete(config)
        db.commit()
        return True

    def serialize_config(self, config: ModelConfig) -> Dict[str, Any]:
        return {
            "id": config.id,
            "provider": config.provider,
            "name": config.name,
            "api_key": config.api_key,
            "base_url": config.base_url,
            "model": config.model,
            "enabled": config.enabled,
            "created_at": config.created_at,
            "updated_at": config.updated_at,
        }

    def serialize_config_brief(self, config: ModelConfig) -> Dict[str, Any]:
        """简要序列化，用于关联展示"""
        return {
            "id": config.id,
            "provider": config.provider,
            "name": config.name,
            "model": config.model,
            "enabled": config.enabled,
        }

    def get_available_providers(self, db: Session) -> List[Dict[str, Any]]:
        """获取所有已启用的模型配置，按提供商分组"""
        configs = self.list_configs(db, enabled_only=True)
        providers = []
        for config in configs:
            providers.append({
                "id": config.id,
                "provider": config.provider,
                "name": config.name,
                "model": config.model,
                "label": f"{config.name} ({config.provider}/{config.model})",
            })
        return providers


model_config_service = ModelConfigService()