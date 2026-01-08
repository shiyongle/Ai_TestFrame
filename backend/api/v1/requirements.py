from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from core.database import get_db
from models.database_models import Requirement, Project
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

# Pydantic模型
class RequirementBase(BaseModel):
    title: str
    description: str
    priority: str = "medium"
    status: str = "draft"
    type: str = "functional"
    project_id: int
    assigned_to: Optional[str] = None
    reporter: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[int] = None
    actual_hours: Optional[int] = None
    acceptance_criteria: Optional[str] = None
    business_value: Optional[str] = None
    tags: Optional[List[str]] = None
    attachments: Optional[List[str]] = None
    comments: Optional[List[dict]] = None
    linked_test_cases: Optional[List[dict]] = None
    linked_functional_test_cases: int = 0
    linked_interface_test_cases: int = 0

class RequirementCreate(RequirementBase):
    pass

class RequirementUpdate(RequirementBase):
    pass

class RequirementResponse(RequirementBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/requirements", response_model=List[RequirementResponse])
async def get_requirements(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取需求列表"""
    query = db.query(Requirement)
    
    if project_id:
        query = query.filter(Requirement.project_id == project_id)
    if status:
        query = query.filter(Requirement.status == status)
    if priority:
        query = query.filter(Requirement.priority == priority)
    
    requirements = query.offset(skip).limit(limit).all()
    return requirements

@router.get("/requirements/{requirement_id}", response_model=RequirementResponse)
async def get_requirement(requirement_id: int, db: Session = Depends(get_db)):
    """获取单个需求详情"""
    requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="需求不存在"
        )
    return requirement

@router.post("/requirements", response_model=RequirementResponse)
async def create_requirement(
    requirement: RequirementCreate,
    db: Session = Depends(get_db)
):
    """创建新需求"""
    # 验证项目是否存在
    project = db.query(Project).filter(Project.id == requirement.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    db_requirement = Requirement(**requirement.dict())
    db.add(db_requirement)
    db.commit()
    db.refresh(db_requirement)
    return db_requirement

@router.put("/requirements/{requirement_id}", response_model=RequirementResponse)
async def update_requirement(
    requirement_id: int,
    requirement_update: RequirementUpdate,
    db: Session = Depends(get_db)
):
    """更新需求"""
    db_requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not db_requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="需求不存在"
        )
    
    # 验证项目是否存在
    if requirement_update.project_id:
        project = db.query(Project).filter(Project.id == requirement_update.project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="项目不存在"
            )
    
    update_data = requirement_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_requirement, field, value)
    
    db_requirement.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_requirement)
    return db_requirement

@router.delete("/requirements/{requirement_id}")
async def delete_requirement(requirement_id: int, db: Session = Depends(get_db)):
    """删除需求"""
    db_requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not db_requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="需求不存在"
        )
    
    try:
        # 先删除与版本的关联关系
        from models.database_models import VersionRequirement
        db.query(VersionRequirement).filter(VersionRequirement.requirement_id == requirement_id).delete()
        
        # 删除需求
        db.delete(db_requirement)
        db.commit()
        return {"message": "需求删除成功"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除需求失败: {str(e)}"
        )

@router.get("/projects/{project_id}/requirements", response_model=List[RequirementResponse])
async def get_project_requirements(
    project_id: int,
    db: Session = Depends(get_db)
):
    """获取项目的所有需求"""
    # 验证项目是否存在
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    requirements = db.query(Requirement).filter(Requirement.project_id == project_id).all()
    return requirements

@router.post("/requirements/{requirement_id}/comments")
async def add_requirement_comment(
    requirement_id: int,
    comment: dict,
    db: Session = Depends(get_db)
):
    """添加需求评论"""
    db_requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not db_requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="需求不存在"
        )
    
    # 添加评论
    if not db_requirement.comments:
        db_requirement.comments = []
    
    comment_data = {
        "id": len(db_requirement.comments) + 1,
        "author": comment.get("author"),
        "content": comment.get("content"),
        "created_at": datetime.utcnow().isoformat()
    }
    
    db_requirement.comments.append(comment_data)
    db_requirement.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "评论添加成功", "comment": comment_data}

@router.post("/requirements/{requirement_id}/link-testcases")
async def link_testcases_to_requirement(
    requirement_id: int,
    link_data: dict,
    db: Session = Depends(get_db)
):
    """关联测试用例到需求"""
    db_requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not db_requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="需求不存在"
        )
    
    # 更新关联的测试用例数量
    db_requirement.linked_functional_test_cases = link_data.get("functional_count", 0)
    db_requirement.linked_interface_test_cases = link_data.get("interface_count", 0)
    
    # 更新关联的测试用例列表
    if link_data.get("test_cases"):
        db_requirement.linked_test_cases = link_data["test_cases"]
    
    db_requirement.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "测试用例关联成功"}