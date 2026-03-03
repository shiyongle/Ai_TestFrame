from sqlalchemy.orm import Session
from typing import List, Optional
from models.database_models import TestSuite, TestCase, TestSuiteCase
from schemas.test_suite_schemas import TestSuiteCreate, TestSuiteUpdate
from core.logging import setup_logging

logger = setup_logging()[0]

class TestSuiteService:
    """测试用例集管理服务类"""

    def create_test_suite(self, db: Session, suite_create: TestSuiteCreate) -> TestSuite:
        try:
            db_suite = TestSuite(**suite_create.dict())
            db.add(db_suite)
            db.commit()
            db.refresh(db_suite)
            logger.info(f"创建测试用例集成功: {db_suite.name}")
            return db_suite
        except Exception as e:
            db.rollback()
            logger.error(f"创建测试用例集失败: {str(e)}")
            raise e

    def get_test_suites(self, db: Session, project_id: int) -> List[TestSuite]:
        try:
            return db.query(TestSuite).filter(TestSuite.project_id == project_id).all()
        except Exception as e:
            logger.error(f"获取测试用例集列表失败: {str(e)}")
            raise e

    def get_test_suite(self, db: Session, suite_id: int) -> Optional[TestSuite]:
        try:
            return db.query(TestSuite).filter(TestSuite.id == suite_id).first()
        except Exception as e:
            logger.error(f"获取测试用例集详情失败: {str(e)}")
            raise e

    def update_test_suite(self, db: Session, suite_id: int, suite_update: TestSuiteUpdate) -> Optional[TestSuite]:
        try:
            db_suite = self.get_test_suite(db, suite_id)
            if not db_suite:
                return None
            
            update_data = suite_update.dict(exclude_unset=True)
            for key, value in update_data.items():
                setattr(db_suite, key, value)
                
            db.commit()
            db.refresh(db_suite)
            return db_suite
        except Exception as e:
            db.rollback()
            logger.error(f"更新测试用例集失败: {str(e)}")
            raise e

    def delete_test_suite(self, db: Session, suite_id: int) -> bool:
        try:
            db_suite = self.get_test_suite(db, suite_id)
            if not db_suite:
                return False
            
            # test_suite_cases are handled by cascade in DB model
            db.delete(db_suite)
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"删除测试用例集失败: {str(e)}")
            raise e

    def add_cases_to_suite(self, db: Session, suite_id: int, testcase_ids: List[int]) -> bool:
        try:
            suite = self.get_test_suite(db, suite_id)
            if not suite:
                return False
            
            # Determine max existing order index
            existing = db.query(TestSuiteCase).filter(TestSuiteCase.suite_id == suite_id).all()
            max_order_index = max([rel.order_index for rel in existing] + [-1])
            
            # Find already added to prevent duplicates
            existing_case_ids = [rel.testcase_id for rel in existing]
            
            new_relations = []
            for i, tc_id in enumerate(testcase_ids):
                if tc_id not in existing_case_ids:
                    rel = TestSuiteCase(suite_id=suite_id, testcase_id=tc_id, order_index=max_order_index + i + 1)
                    new_relations.append(rel)
                    
            if new_relations:
                db.add_all(new_relations)
                db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"为测试用例集添加用例失败: {str(e)}")
            raise e

    def remove_cases_from_suite(self, db: Session, suite_id: int, testcase_ids: List[int]) -> bool:
        try:
            db.query(TestSuiteCase).filter(
                TestSuiteCase.suite_id == suite_id,
                TestSuiteCase.testcase_id.in_(testcase_ids)
            ).delete(synchronize_session=False)
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"从测试用例集中移除用例失败: {str(e)}")
            raise e
