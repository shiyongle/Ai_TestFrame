from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from api.deps import get_database, get_project_service
from schemas.response_schemas import ProjectCreate, ProjectResponse
from models.database_models import Project
from utils.activity_logger import log_activity

router = APIRouter()


@router.post("/projects", response_model=ProjectResponse)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """创建测试项目"""
    print(f"DEBUG: Receiving create project request: {project.name}")
    import logging
    logging.getLogger("main").info(f"DEBUG: Receiving create project request: {project.name}")
    try:
        result = project_service.create_project(db, project)
        log_activity(db, action="create", module="项目", target_name=project.name)
        logging.getLogger("main").info(f"DEBUG: Project created successfully: {result.id}")
        return result
    except Exception as e:
        logging.getLogger("main").error(f"DEBUG: Error creating project: {e}")
        raise e


@router.get("/projects", response_model=List[ProjectResponse])
def get_projects(
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """获取所有测试项目"""
    projects = project_service.get_projects(db)
    log_activity(db, action="query", module="项目", target_name="项目列表", detail=f"数量={len(projects)}")
    return projects


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """获取指定项目"""
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    log_activity(db, action="query", module="项目", target_name=project.name, detail=f"项目ID={project_id}")
    return project


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_update: dict,
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """更新项目信息"""
    project = project_service.update_project(db, project_id, project_update)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    log_activity(db, action="update", module="项目", target_name=project.name)
    return project


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """删除项目"""
    success = project_service.delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="项目不存在")
    log_activity(db, action="delete", module="项目", target_name=f"ID={project_id}")
    return {"message": "项目删除成功"}


@router.get("/projects/{project_id}/statistics")
def get_project_statistics(
    project_id: int,
    db: Session = Depends(get_database),
    project_service = Depends(get_project_service)
):
    """获取项目统计信息"""
    statistics = project_service.get_project_statistics(db, project_id)
    if not statistics:
        raise HTTPException(status_code=404, detail="项目不存在")
    log_activity(db, action="query", module="项目", target_name=f"ID={project_id}", detail="查看项目统计")
    return statistics
