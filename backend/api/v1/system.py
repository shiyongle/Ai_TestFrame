from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_db
from fastapi.security import HTTPAuthorizationCredentials
from models.database_models import SystemSetting, User
from pydantic import BaseModel, Field, ConfigDict
from services.ai.llm_client import llm_client
from core.security import (
    get_user_by_token,
    hash_password,
    security,
)

router = APIRouter()

class SettingItem(BaseModel):
    setting_key: str
    setting_value: str
    description: str = ""

class SettingsUpdate(BaseModel):
    settings: List[SettingItem]


class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=100)
    real_name: str = Field(..., min_length=1, max_length=100)


class UserUpdateRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: Optional[str] = Field(default=None, min_length=1, max_length=100)
    real_name: str = Field(..., min_length=1, max_length=100)


class UserItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    real_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


def require_super_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    current_user = get_user_by_token(db, credentials.credentials)
    if current_user.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可执行该操作")
    return current_user

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


@router.get("/users", response_model=List[UserItemResponse])
async def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return db.query(User).order_by(User.id.desc()).all()


@router.post("/users", response_model=UserItemResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    username = payload.username.strip()
    real_name = payload.real_name.strip()
    if not username or not real_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名和真实姓名不能为空")

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")

    user = User(
        username=username,
        password_hash=hash_password(payload.password),
        real_name=real_name,
        role="user",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserItemResponse)
async def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    username = payload.username.strip()
    real_name = payload.real_name.strip()
    if not username or not real_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名和真实姓名不能为空")

    duplicate = db.query(User).filter(User.username == username, User.id != user_id).first()
    if duplicate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")

    user.username = username
    user.real_name = real_name
    if payload.password:
        user.password_hash = hash_password(payload.password)

    if user.id == current_user.id:
        user.role = "super_admin"

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能删除当前登录用户")

    db.delete(user)
    db.commit()
    return {"success": True, "message": "用户删除成功"}
