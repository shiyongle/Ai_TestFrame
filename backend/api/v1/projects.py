from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from api.deps import get_database, get_project_service
from schemas.response_schemas import ProjectCreate, ProjectResponse
from models.database_models import Project

router = APIRouter()


@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """创建测试项目"""
    return project_service.create_project(db, project)


@router.get("/projects", response_model=List[ProjectResponse])
async def get_projects(
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """获取所有测试项目"""
    return project_service.get_projects(db)


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """获取指定项目"""
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_update: dict,
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """更新项目信息"""
    project = project_service.update_project(db, project_id, project_update)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """删除项目"""
    success = project_service.delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"message": "项目删除成功"}


@router.get("/projects/{project_id}/statistics")
async def get_project_statistics(
    project_id: int,
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """获取项目统计信息"""
    statistics = project_service.get_project_statistics(db, project_id)
    if not statistics:
        raise HTTPException(status_code=404, detail="项目不存在")
    return statistics