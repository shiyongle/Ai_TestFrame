from sqlalchemy.orm import Session
from typing import List, Optional
from models.database_models import TestCase, TestResult
from schemas.response_schemas import TestCaseCreate, TestCaseResponse
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models.database_models import TestCase as TestCaseModel
from core.logging import setup_logging

logger = setup_logging()[0]


class TestCaseService:
    """测试用例管理服务类"""
    
    def create_testcase(self, db: Session, project_id: int, testcase: TestCaseCreate) -> TestCase:
        """创建测试用例"""
        try:
            db_testcase = TestCase(**testcase.dict(), project_id=project_id)
            db.add(db_testcase)
            db.commit()
            db.refresh(db_testcase)
            logger.info(f"创建测试用例成功: {testcase.name} (项目ID: {project_id})")
            return db_testcase
        except Exception as e:
            logger.error(f"创建测试用例失败: {testcase.name} - {str(e)}")
            db.rollback()
            raise e
    
    def get_testcases(self, db: Session, project_id: int) -> List[TestCase]:
        """获取项目的测试用例"""
        try:
            testcases = db.query(TestCase).filter(TestCase.project_id == project_id).all()
            logger.info(f"获取测试用例列表成功，项目ID: {project_id}，共 {len(testcases)} 个用例")
            return testcases
        except Exception as e:
            logger.error(f"获取测试用例列表失败: 项目ID {project_id} - {str(e)}")
            raise e
    
    def get_testcase(self, db: Session, testcase_id: int) -> Optional[TestCase]:
        """获取指定测试用例"""
        try:
            testcase = db.query(TestCase).filter(TestCase.id == testcase_id).first()
            if testcase:
                logger.info(f"获取测试用例成功: {testcase.name} (ID: {testcase_id})")
            else:
                logger.warning(f"测试用例不存在: ID {testcase_id}")
            return testcase
        except Exception as e:
            logger.error(f"获取测试用例失败: ID {testcase_id} - {str(e)}")
            raise e
    
    def update_testcase(self, db: Session, testcase_id: int, testcase_update: dict) -> Optional[TestCase]:
        """更新测试用例"""
        try:
            testcase = db.query(TestCase).filter(TestCase.id == testcase_id).first()
            if not testcase:
                logger.warning(f"更新测试用例失败，用例不存在: ID {testcase_id}")
                return None
            
            for field, value in testcase_update.items():
                if hasattr(testcase, field):
                    setattr(testcase, field, value)
            
            db.commit()
            db.refresh(testcase)
            logger.info(f"更新测试用例成功: {testcase.name} (ID: {testcase_id})")
            return testcase
        except Exception as e:
            logger.error(f"更新测试用例失败: ID {testcase_id} - {str(e)}")
            db.rollback()
            raise e
    
    def delete_testcase(self, db: Session, testcase_id: int) -> bool:
        """删除测试用例"""
        try:
            testcase = db.query(TestCase).filter(TestCase.id == testcase_id).first()
            if not testcase:
                logger.warning(f"删除测试用例失败，用例不存在: ID {testcase_id}")
                return False
            
            testcase_name = testcase.name
            db.delete(testcase)
            db.commit()
            logger.info(f"删除测试用例成功: {testcase_name} (ID: {testcase_id})")
            return True
        except Exception as e:
            logger.error(f"删除测试用例失败: ID {testcase_id} - {str(e)}")
            db.rollback()
            raise e
    
    def get_testcases_by_protocol(self, db: Session, project_id: int, protocol: str) -> List[TestCase]:
        """根据协议类型获取测试用例"""
        try:
            testcases = db.query(TestCase).filter(
                TestCase.project_id == project_id,
                TestCase.protocol == protocol
            ).all()
            logger.info(f"获取协议测试用例成功: {protocol}，项目ID: {project_id}，共 {len(testcases)} 个用例")
            return testcases
        except Exception as e:
            logger.error(f"获取协议测试用例失败: {protocol}，项目ID {project_id} - {str(e)}")
            raise e
    
    def save_test_result(self, db: Session, testcase_id: int, result_data: dict) -> TestResult:
        """保存测试结果"""
        try:
            test_result = TestResult(
                testcase_id=testcase_id,
                status=result_data.get("status", "unknown"),
                response_data=result_data.get("response_data", {}),
                execution_time=result_data.get("execution_time", 0),
                error_message=result_data.get("error_message")
            )
            db.add(test_result)
            db.commit()
            db.refresh(test_result)
            logger.info(f"保存测试结果成功: 测试用例ID {testcase_id}")
            return test_result
        except Exception as e:
            logger.error(f"保存测试结果失败: 测试用例ID {testcase_id} - {str(e)}")
            db.rollback()
            raise e
    
    def get_test_results(self, db: Session, testcase_id: int, limit: int = 10) -> List[TestResult]:
        """获取测试用例的执行历史"""
        try:
            results = db.query(TestResult).filter(
                TestResult.testcase_id == testcase_id
            ).order_by(TestResult.executed_at.desc()).limit(limit).all()
            logger.info(f"获取测试结果历史成功: 测试用例ID {testcase_id}，共 {len(results)} 条记录")
            return results
        except Exception as e:
            logger.error(f"获取测试结果历史失败: 测试用例ID {testcase_id} - {str(e)}")
            raise e