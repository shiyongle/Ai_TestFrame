from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from core.database import Base
from datetime import datetime

# 项目表
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    testcases = relationship("TestCase", back_populates="project")

# 测试用例表
class TestCase(Base):
    __tablename__ = "testcases"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    protocol = Column(String(20), nullable=False)  # http, tcp, mq
    config = Column(JSON)  # 测试配置
    project_id = Column(Integer, ForeignKey("projects.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = relationship("Project", back_populates="testcases")
    test_results = relationship("TestResult", back_populates="testcase")

# 测试结果表
class TestResult(Base):
    __tablename__ = "test_results"
    
    id = Column(Integer, primary_key=True, index=True)
    testcase_id = Column(Integer, ForeignKey("testcases.id"))
    status = Column(String(20), nullable=False)  # success, fail, error
    response_data = Column(JSON)
    execution_time = Column(Integer)  # 毫秒
    error_message = Column(Text)
    executed_at = Column(DateTime, default=datetime.utcnow)
    
    testcase = relationship("TestCase", back_populates="test_results")

# 版本需求关联表
class VersionRequirement(Base):
    __tablename__ = "version_requirements"
    
    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("versions.id"), nullable=False)
    requirement_id = Column(Integer, ForeignKey("requirements.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关联关系
    version = relationship("Version", back_populates="requirements")
    requirement = relationship("Requirement")

# 版本管理表
class Version(Base):
    __tablename__ = "versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version_number = Column(String(50), nullable=False)
    description = Column(Text)
    changes = Column(JSON)  # 变更内容
    status = Column(String(20), default="draft")  # draft, released, archived
    release_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100))
    
    # 关联关系
    test_reports = relationship("TestReport", back_populates="version")
    requirements = relationship("VersionRequirement", back_populates="version")

# 测试报告表
class TestReport(Base):
    __tablename__ = "test_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("versions.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    total_tests = Column(Integer, default=0)
    passed_tests = Column(Integer, default=0)
    failed_tests = Column(Integer, default=0)
    error_tests = Column(Integer, default=0)
    summary = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    version = relationship("Version", back_populates="test_reports")

# 测试数据表
class TestData(Base):
    __tablename__ = "test_data"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    data_type = Column(String(50))  # request_data, response_data, config
    content = Column(JSON)
    project_id = Column(Integer, ForeignKey("projects.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# 需求管理表
class Requirement(Base):
    __tablename__ = "requirements"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), nullable=False, default="medium")  # high, medium, low
    status = Column(String(20), nullable=False, default="draft")  # draft, review, approved, development, testing, completed, rejected
    type = Column(String(20), nullable=False, default="functional")  # functional, non-functional, constraint, assumption
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    assigned_to = Column(String(100))
    reporter = Column(String(100))
    due_date = Column(DateTime)
    estimated_hours = Column(Integer)
    actual_hours = Column(Integer)
    acceptance_criteria = Column(Text)
    business_value = Column(Text)
    tags = Column(JSON)  # 标签列表
    attachments = Column(JSON)  # 附件列表
    comments = Column(JSON)  # 评论列表
    linked_test_cases = Column(JSON)  # 关联的测试用例
    linked_functional_test_cases = Column(Integer, default=0)
    linked_interface_test_cases = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = relationship("Project")

# 批量测试任务表
class BatchTestTask(Base):
    __tablename__ = "batch_test_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(50), unique=True, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    testcase_ids = Column(Text)  # 逗号分隔的测试用例ID
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    total_tests = Column(Integer, default=0)
    passed_tests = Column(Integer, default=0)
    failed_tests = Column(Integer, default=0)
    error_tests = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

# 规则模板表
class RuleTemplate(Base):
    __tablename__ = "rule_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)  # correctness, security, performance
    protocol = Column(String(20), nullable=False)  # http, tcp, mq
    description = Column(Text)
    is_enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    rule_definitions = relationship("RuleDefinition", back_populates="template", cascade="all, delete-orphan")
    testcase_rules = relationship("TestCaseRule", back_populates="rule_template")

# 规则定义表
class RuleDefinition(Base):
    __tablename__ = "rule_definitions"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("rule_templates.id"), nullable=False)
    rule_type = Column(String(50), nullable=False)  # status_code, response_time, field_check
    rule_config = Column(JSON)
    execution_order = Column(Integer, default=0)
    is_required = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    template = relationship("RuleTemplate", back_populates="rule_definitions")
    assertion_rules = relationship("AssertionRule", back_populates="rule_definition", cascade="all, delete-orphan")

# 断言规则表
class AssertionRule(Base):
    __tablename__ = "assertion_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_definition_id = Column(Integer, ForeignKey("rule_definitions.id"), nullable=False)
    assertion_type = Column(String(50), nullable=False)  # equals, contains, range, regex
    field_path = Column(String(200))  # 字段路径
    operator = Column(String(20))  # ==, !=, >, <, contains
    expected_value = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    rule_definition = relationship("RuleDefinition", back_populates="assertion_rules")

# 测试用例规则关联表
class TestCaseRule(Base):
    __tablename__ = "testcase_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    testcase_id = Column(Integer, ForeignKey("testcases.id"), nullable=False)
    rule_template_id = Column(Integer, ForeignKey("rule_templates.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    custom_config = Column(JSON)  # 自定义配置覆盖
    created_at = Column(DateTime, default=datetime.utcnow)
    
    rule_template = relationship("RuleTemplate", back_populates="testcase_rules")