from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import sessionmaker, Session
from typing import List, Optional
from core.database import get_db
from models.database_models import Version, Requirement, VersionRequirement
from pydantic import BaseModel
from datetime import datetime
from services.ai_generator import ai_generator

router = APIRouter()

# Pydantic模型
class VersionBase(BaseModel):
    version_number: str
    description: str
    status: str = "draft"
    release_date: Optional[datetime] = None
    created_by: str

class VersionCreate(VersionBase):
    changes: dict = {}

class VersionUpdate(VersionBase):
    changes: dict = {}

class VersionResponse(VersionBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/versions", response_model=VersionResponse)
async def create_version(
    version: VersionCreate,
    db: Session = Depends(get_db)
):
    """创建版本记录"""
    try:
        db_version = Version(**version.dict())
        db.add(db_version)
        db.commit()
        db.refresh(db_version)
        return db_version
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建版本失败: {str(e)}"
        )

@router.get("/versions")
async def get_versions(
    db: Session = Depends(get_db)
):
    """获取版本历史"""
    try:
        versions = db.query(Version).order_by(Version.created_at.desc()).all()
        
        # 为每个版本添加关联的需求信息
        result = []
        for version in versions:
            # 获取关联的需求
            version_requirements = db.query(VersionRequirement).filter(
                VersionRequirement.version_id == version.id
            ).all()
            
            requirement_ids = [vr.requirement_id for vr in version_requirements]
            requirements = db.query(Requirement).filter(Requirement.id.in_(requirement_ids)).all()
            
            # 构建版本数据
            version_dict = {
                "id": version.id,
                "version_number": version.version_number,
                "description": version.description,
                "status": version.status,
                "release_date": version.release_date.isoformat() if version.release_date else None,
                "created_at": version.created_at.isoformat() if version.created_at else None,
                "created_by": version.created_by,
                "changes": version.changes,
                "requirements": [
                    {
                        "id": req.id,
                        "title": req.title,
                        "description": req.description,
                        "priority": req.priority,
                        "status": req.status,
                        "type": req.type,
                        "project_id": req.project_id,
                        "assigned_to": req.assigned_to,
                        "reporter": req.reporter,
                        "created_at": req.created_at.isoformat() if req.created_at else None
                    }
                    for req in requirements
                ]
            }
            result.append(version_dict)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取版本列表失败: {str(e)}")

@router.get("/versions/{version_id}", response_model=VersionResponse)
async def get_version(
    version_id: int,
    db: Session = Depends(get_db)
):
    """获取指定版本"""
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )
    return version

@router.put("/versions/{version_id}", response_model=VersionResponse)
async def update_version(
    version_id: int,
    version_update: dict,
    db: Session = Depends(get_db)
):
    """更新版本信息"""
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )
    
    try:
        for field, value in version_update.items():
            if hasattr(version, field):
                setattr(version, field, value)
        db.commit()
        db.refresh(version)
        return version
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新版本失败: {str(e)}"
        )

@router.delete("/versions/{version_id}")
async def delete_version(
    version_id: int,
    db: Session = Depends(get_db)
):
    """删除版本"""
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )
    
    try:
        # 先删除与需求的关联关系
        db.query(VersionRequirement).filter(VersionRequirement.version_id == version_id).delete()
        
        # 删除版本
        db.delete(version)
        db.commit()
        return {"message": "版本删除成功"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除版本失败: {str(e)}"
        )

@router.get("/versions/latest", response_model=VersionResponse)
async def get_latest_version(
    db: Session = Depends(get_db)
):
    """获取最新版本"""
    version = db.query(Version).order_by(Version.created_at.desc()).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有找到任何版本"
        )
    return version

@router.post("/versions/{version_id}/requirements")
async def add_requirements_to_version(
    version_id: int,
    requirement_ids: List[int],
    db: Session = Depends(get_db)
):
    """将需求添加到版本中"""
    # 验证版本是否存在
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    # 验证需求是否存在
    requirements = db.query(Requirement).filter(Requirement.id.in_(requirement_ids)).all()
    if len(requirements) != len(requirement_ids):
        raise HTTPException(status_code=404, detail="部分需求不存在")
    
    # 添加关联关系
    for req_id in requirement_ids:
        # 检查是否已经关联
        existing = db.query(VersionRequirement).filter(
            VersionRequirement.version_id == version_id,
            VersionRequirement.requirement_id == req_id
        ).first()
        
        if not existing:
            version_requirement = VersionRequirement(
                version_id=version_id,
                requirement_id=req_id
            )
            db.add(version_requirement)
    
    db.commit()
    return {"message": "需求已成功添加到版本"}

@router.delete("/versions/{version_id}/requirements/{requirement_id}")
async def remove_requirement_from_version(
    version_id: int,
    requirement_id: int,
    db: Session = Depends(get_db)
):
    """从版本中移除需求"""
    version_requirement = db.query(VersionRequirement).filter(
        VersionRequirement.version_id == version_id,
        VersionRequirement.requirement_id == requirement_id
    ).first()
    
    if not version_requirement:
        raise HTTPException(status_code=404, detail="关联关系不存在")
    
    db.delete(version_requirement)
    db.commit()
    return {"message": "需求已从版本中移除"}

@router.get("/versions/{version_id}/requirements")
async def get_version_requirements(
    version_id: int,
    db: Session = Depends(get_db)
):
    """获取版本中的所有需求"""
    # 验证版本是否存在
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )
    
    # 获取关联的需求
    version_requirements = db.query(VersionRequirement).filter(
        VersionRequirement.version_id == version_id
    ).all()
    
    requirement_ids = [vr.requirement_id for vr in version_requirements]
    requirements = db.query(Requirement).filter(Requirement.id.in_(requirement_ids)).all()
    
    return requirements

@router.post("/versions/{version_id}/generate-testcases")
async def generate_test_cases_for_version(
    version_id: int,
    request: dict,
    db: Session = Depends(get_db)
):
    """为版本关联的需求生成测试用例"""
    model = request.get("model", "glm-4.6")
    
    # 验证版本是否存在
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )
    
    # 获取版本关联的需求
    version_requirements = db.query(VersionRequirement).filter(
        VersionRequirement.version_id == version_id
    ).all()
    
    if not version_requirements:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该版本没有关联任何需求"
        )
    
    requirement_ids = [vr.requirement_id for vr in version_requirements]
    requirements = db.query(Requirement).filter(Requirement.id.in_(requirement_ids)).all()
    
    if not requirements:
        raise HTTPException(
            status=status.HTTP_400_BAD_REQUEST,
            detail="未找到有效的需求"
        )
    
    try:
        generated_testcases = []
        
        # 为每个需求生成测试用例
        for requirement in requirements:
            testcase = await ai_generator.generate_test_case_from_requirement(requirement, model)
            generated_testcases.append({
                "requirement_id": requirement.id,
                "requirement_title": requirement.title,
                "testcase": testcase
            })
        
        return {
            "message": "测试用例生成成功",
            "version_id": version_id,
            "model": model,
            "generated_count": len(generated_testcases),
            "testcases": generated_testcases
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成测试用例失败: {str(e)}"
        )