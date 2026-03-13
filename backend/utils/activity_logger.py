"""
活动日志写入辅助函数
Usage:
    from utils.activity_logger import log_activity

    log_activity(db, user="管理员", action="create", module="项目", target_name="卷心菜平台")
"""
from models.database_models import ActivityLog
from sqlalchemy.orm import Session


def log_activity(
    db: Session,
    *,
    user: str = "管理员",
    action: str,          # create / update / delete / execute / generate
    module: str,          # 项目 / 需求 / 测试用例 / 版本 / 测试套件
    target_name: str,
    detail: str = "",
    status: str = "success"
):
    """向数据库写入一条操作日志记录。"""
    try:
        entry = ActivityLog(
            user=user,
            action=action,
            module=module,
            target_name=target_name[:200],
            detail=detail,
            status=status,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        # 日志写入失败不影响主业务
        db.rollback()
        print(f"[ActivityLog] 写入失败: {e}")
