from sqlalchemy.orm import Session
from core.database import get_db

# 数据库依赖 - 直接使用get_db生成器
get_database = get_db

# 服务实例依赖
from services.project_service import ProjectService
from services.testcase_service import TestCaseService
from services.test_execution_service import TestExecutionService
from services.version_service import VersionService
from services.test_suite_service import TestSuiteService
from services.interface_testcase_service import InterfaceTestCaseService
from services.test_plan_service import TestPlanService

def get_project_service() -> ProjectService:
    """获取项目服务实例"""
    return ProjectService()

def get_test_suite_service() -> TestSuiteService:
    """获取测试用例集服务实例"""
    return TestSuiteService()

def get_testcase_service() -> TestCaseService:
    """获取测试用例服务实例"""
    return TestCaseService()

def get_test_execution_service() -> TestExecutionService:
    """获取测试执行服务实例"""
    return TestExecutionService()

def get_version_service() -> VersionService:
    """获取版本管理服务实例"""
    return VersionService()

def get_interface_testcase_service() -> InterfaceTestCaseService:
    """获取接口测试用例服务实例"""
    return InterfaceTestCaseService()

def get_test_plan_service() -> TestPlanService:
    """获取测试计划服务实例"""
    return TestPlanService()
