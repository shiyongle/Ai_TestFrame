from sqlalchemy.orm import Session
from typing import List, Optional
from models.database_models import Version
from schemas.response_schemas import VersionCreate, VersionResponse
from core.logging import setup_logging

logger = setup_logging()[0]


class VersionService:
    """版本管理服务类"""
    
    def create_version(self, db: Session, version: VersionCreate) -> Version:
        """创建版本记录"""
        try:
            db_version = Version(**version.dict())
            db.add(db_version)
            db.commit()
            db.refresh(db_version)
            logger.info(f"创建版本成功: {version.version_number}")
            return db_version
        except Exception as e:
            logger.error(f"创建版本失败: {version.version_number} - {str(e)}")
            db.rollback()
            raise e
    
    def get_versions(self, db: Session) -> List[Version]:
        """获取版本历史"""
        try:
            versions = db.query(Version).order_by(Version.created_at.desc()).all()
            logger.info(f"获取版本列表成功，共 {len(versions)} 个版本")
            return versions
        except Exception as e:
            logger.error(f"获取版本列表失败: {str(e)}")
            raise e
    
    def get_version(self, db: Session, version_id: int) -> Optional[Version]:
        """获取指定版本"""
        try:
            version = db.query(Version).filter(Version.id == version_id).first()
            if version:
                logger.info(f"获取版本成功: {version.version_number} (ID: {version_id})")
            else:
                logger.warning(f"版本不存在: ID {version_id}")
            return version
        except Exception as e:
            logger.error(f"获取版本失败: ID {version_id} - {str(e)}")
            raise e
    
    def get_version_by_number(self, db: Session, version_number: str) -> Optional[Version]:
        """根据版本号获取版本"""
        try:
            version = db.query(Version).filter(Version.version_number == version_number).first()
            if version:
                logger.info(f"根据版本号获取版本成功: {version_number}")
            else:
                logger.warning(f"版本不存在: {version_number}")
            return version
        except Exception as e:
            logger.error(f"根据版本号获取版本失败: {version_number} - {str(e)}")
            raise e
    
    def update_version(self, db: Session, version_id: int, version_update: dict) -> Optional[Version]:
        """更新版本信息"""
        try:
            version = db.query(Version).filter(Version.id == version_id).first()
            if not version:
                logger.warning(f"更新版本失败，版本不存在: ID {version_id}")
                return None
            
            for field, value in version_update.items():
                if hasattr(version, field):
                    setattr(version, field, value)
            
            db.commit()
            db.refresh(version)
            logger.info(f"更新版本成功: {version.version_number} (ID: {version_id})")
            return version
        except Exception as e:
            logger.error(f"更新版本失败: ID {version_id} - {str(e)}")
            db.rollback()
            raise e
    
    def delete_version(self, db: Session, version_id: int) -> bool:
        """删除版本"""
        try:
            version = db.query(Version).filter(Version.id == version_id).first()
            if not version:
                logger.warning(f"删除版本失败，版本不存在: ID {version_id}")
                return False
            
            version_number = version.version_number
            db.delete(version)
            db.commit()
            logger.info(f"删除版本成功: {version_number} (ID: {version_id})")
            return True
        except Exception as e:
            logger.error(f"删除版本失败: ID {version_id} - {str(e)}")
            db.rollback()
            raise e
    
    def get_latest_version(self, db: Session) -> Optional[Version]:
        """获取最新版本"""
        try:
            version = db.query(Version).order_by(Version.created_at.desc()).first()
            if version:
                logger.info(f"获取最新版本成功: {version.version_number}")
            else:
                logger.warning("没有找到任何版本")
            return version
        except Exception as e:
            logger.error(f"获取最新版本失败: {str(e)}")
            raise e