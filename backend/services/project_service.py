from sqlalchemy.orm import Session
from typing import List, Optional
from models.database_models import Project
from schemas.response_schemas import ProjectCreate, ProjectResponse
from core.logging import setup_logging

logger = setup_logging()[0]


class ProjectService:
    """项目管理服务类"""
    
    def create_project(self, db: Session, project: ProjectCreate) -> Project:
        """创建测试项目"""
        try:
            db_project = Project(**project.dict())
            db.add(db_project)
            db.commit()
            db.refresh(db_project)
            logger.info(f"创建项目成功: {project.name} (ID: {db_project.id})")
            return db_project
        except Exception as e:
            logger.error(f"创建项目失败: {project.name} - {str(e)}")
            db.rollback()
            raise e
    
    def get_projects(self, db: Session) -> List[Project]:
        """获取所有项目（按创建时间倒序）"""
        try:
            projects = db.query(Project).order_by(Project.created_at.desc()).all()
            logger.info(f"获取项目列表成功，共 {len(projects)} 个项目")
            return projects
        except Exception as e:
            logger.error(f"获取项目列表失败: {str(e)}")
            raise e
    
    def get_project(self, db: Session, project_id: int) -> Optional[Project]:
        """获取指定项目"""
        try:
            project = db.query(Project).filter(Project.id == project_id).first()
            if project:
                logger.info(f"获取项目成功: {project.name} (ID: {project_id})")
            else:
                logger.warning(f"项目不存在: ID {project_id}")
            return project
        except Exception as e:
            logger.error(f"获取项目失败: ID {project_id} - {str(e)}")
            raise e
    
    def update_project(self, db: Session, project_id: int, project_update: dict) -> Optional[Project]:
        """更新项目信息"""
        try:
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                logger.warning(f"更新项目失败，项目不存在: ID {project_id}")
                return None
            
            for field, value in project_update.items():
                if hasattr(project, field):
                    setattr(project, field, value)
            
            db.commit()
            db.refresh(project)
            logger.info(f"更新项目成功: {project.name} (ID: {project_id})")
            return project
        except Exception as e:
            logger.error(f"更新项目失败: ID {project_id} - {str(e)}")
            db.rollback()
            raise e
    
    def delete_project(self, db: Session, project_id: int) -> bool:
        """删除项目"""
        try:
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                logger.warning(f"删除项目失败，项目不存在: ID {project_id}")
                return False
            
            project_name = project.name
            db.delete(project)
            db.commit()
            logger.info(f"删除项目成功: {project_name} (ID: {project_id})")
            return True
        except Exception as e:
            logger.error(f"删除项目失败: ID {project_id} - {str(e)}")
            db.rollback()
            raise e
    
    def get_project_statistics(self, db: Session, project_id: int) -> dict:
        """获取项目统计信息"""
        try:
            from models.database_models import TestCase, TestResult
            
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                return None
            
            # 测试用例统计
            total_testcases = db.query(TestCase).filter(TestCase.project_id == project_id).count()
            
            # 测试结果统计
            total_results = db.query(TestResult).join(TestCase).filter(TestCase.project_id == project_id).count()
            passed_results = db.query(TestResult).join(TestCase).filter(
                TestCase.project_id == project_id,
                TestResult.status == "passed"
            ).count()
            failed_results = db.query(TestResult).join(TestCase).filter(
                TestCase.project_id == project_id,
                TestResult.status == "failed"
            ).count()
            
            statistics = {
                "project_id": project_id,
                "project_name": project.name,
                "total_testcases": total_testcases,
                "total_results": total_results,
                "passed_results": passed_results,
                "failed_results": failed_results,
                "success_rate": (passed_results / total_results * 100) if total_results > 0 else 0
            }
            
            logger.info(f"获取项目统计信息成功: {project.name} (ID: {project_id})")
            return statistics
        except Exception as e:
            logger.error(f"获取项目统计信息失败: ID {project_id} - {str(e)}")
            raise e