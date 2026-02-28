from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from core.database import get_db
from models.database_models import SystemSetting
from pydantic import BaseModel
from services.ai.llm_client import llm_client

router = APIRouter()

class SettingItem(BaseModel):
    setting_key: str
    setting_value: str
    description: str = ""

class SettingsUpdate(BaseModel):
    settings: List[SettingItem]

@router.get("/settings/{category}")
async def get_settings_by_category(
    category: str,
    db: Session = Depends(get_db)
):
    """获取指定类别的所有配置"""
    settings_records = db.query(SystemSetting).filter(SystemSetting.category == category).all()
    
    result = {}
    for record in settings_records:
        result[record.setting_key] = {
            "value": record.setting_value,
            "description": record.description
        }
    return result

@router.put("/settings/{category}")
async def update_settings_by_category(
    category: str,
    payload: SettingsUpdate,
    db: Session = Depends(get_db)
):
    """批量更新指定类别的配置"""
    try:
        for item in payload.settings:
            record = db.query(SystemSetting).filter(
                SystemSetting.category == category,
                SystemSetting.setting_key == item.setting_key
            ).first()
            
            if record:
                # 更新
                record.setting_value = item.setting_value
                if item.description:
                    record.description = item.description
            else:
                # 新增
                new_record = SystemSetting(
                    setting_key=item.setting_key,
                    setting_value=item.setting_value,
                    category=category,
                    description=item.description
                )
                db.add(new_record)
                
        db.commit()
        
        # 刷新全局大模型客户端
        if category == "llm":
            llm_client.refresh_providers()
            
        return {"success": True, "message": f"{category} 配置更新成功"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新配置失败: {str(e)}"
        )
