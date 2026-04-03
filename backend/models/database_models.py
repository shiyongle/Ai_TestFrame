from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from core.database import Base
from datetime import datetime

# 用户表
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="user")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# 项目表
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    testcases = relationship("TestCase", back_populates="project")
    interface_testcases = relationship("InterfaceTestCase", back_populates="project")

# 系统设置表
class SystemSetting(Base):
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String(100), unique=True, index=True, nullable=False)
    setting_value = Column(Text, nullable=True) # Could be keys, JSON, etc
    category = Column(String(50), index=True, default='llm')
    description = Column(String(255))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
    suites = relationship("TestSuite", secondary="test_suite_cases", back_populates="testcases")

# 接口测试用例表（独立于通用 testcases）
class InterfaceTestCase(Base):
    __tablename__ = "interface_testcases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    protocol = Column(String(20), nullable=False, default="http")  # http, tcp, mq
    method = Column(String(10), nullable=False, default="GET")
    url = Column(Text)
    headers = Column(JSON)
    params = Column(JSON)
    body = Column(Text)
    assertions = Column(Text)
    preconditions = Column(Text)
    test_data = Column(Text)
    notes = Column(Text)
    module = Column(String(100))
    priority = Column(String(20), nullable=False, default="medium")
    status = Column(String(20), nullable=False, default="active")
    last_run_status = Column(String(10))
    last_run_time = Column(DateTime)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="interface_testcases")

# 测试用例集表
class TestSuite(Base):
    __tablename__ = "test_suites"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = relationship("Project")
    testcases = relationship("TestCase", secondary="test_suite_cases", back_populates="suites")

# 用例集与用例的多对多关联表
class TestSuiteCase(Base):
    __tablename__ = "test_suite_cases"
    
    suite_id = Column(Integer, ForeignKey("test_suites.id", ondelete="CASCADE"), primary_key=True)
    testcase_id = Column(Integer, ForeignKey("testcases.id", ondelete="CASCADE"), primary_key=True)
    order_index = Column(Integer, default=0)

# 测试计划表
class TestPlan(Base):
    __tablename__ = "test_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    owner = Column(String(100))
    status = Column(String(20), default="draft")  # draft, ready, running, completed, archived
    execution_mode = Column(String(20), default="serial")  # serial, parallel
    priority = Column(String(20), default="medium")
    entry_criteria = Column(Text)
    exit_criteria = Column(Text)
    schedule = Column(String(100))
    tags = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_executed_at = Column(DateTime)

    project = relationship("Project")
    functional_cases = relationship("TestPlanFunctionalCase", back_populates="plan", cascade="all, delete-orphan")
    interface_cases = relationship("TestPlanInterfaceCase", back_populates="plan", cascade="all, delete-orphan")
    executions = relationship("TestPlanExecution", back_populates="plan", cascade="all, delete-orphan")

# 测试计划关联功能测试用例
class TestPlanFunctionalCase(Base):
    __tablename__ = "test_plan_functional_cases"

    id = Column(Integer, primary_key=True, index=True)
    test_plan_id = Column(Integer, ForeignKey("test_plans.id", ondelete="CASCADE"), nullable=False)
    testcase_id = Column(Integer, ForeignKey("testcases.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("TestPlan", back_populates="functional_cases")
    testcase = relationship("TestCase")

# 测试计划关联接口测试用例
class TestPlanInterfaceCase(Base):
    __tablename__ = "test_plan_interface_cases"

    id = Column(Integer, primary_key=True, index=True)
    test_plan_id = Column(Integer, ForeignKey("test_plans.id", ondelete="CASCADE"), nullable=False)
    interface_testcase_id = Column(Integer, ForeignKey("interface_testcases.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("TestPlan", back_populates="interface_cases")
    interface_testcase = relationship("InterfaceTestCase")

# 测试计划执行记录
class TestPlanExecution(Base):
    __tablename__ = "test_plan_executions"

    id = Column(Integer, primary_key=True, index=True)
    test_plan_id = Column(Integer, ForeignKey("test_plans.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="running")  # running, completed, completed_with_issues, failed
    total_items = Column(Integer, default=0)
    passed_items = Column(Integer, default=0)
    failed_items = Column(Integer, default=0)
    error_items = Column(Integer, default=0)
    skipped_items = Column(Integer, default=0)
    summary = Column(JSON)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    plan = relationship("TestPlan", back_populates="executions")

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

class VersionKnowledge(Base):
    """版本与知识库关联表"""
    __tablename__ = "version_knowledge"
    
    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("versions.id"), nullable=False)
    knowledge_doc_id = Column(Integer, ForeignKey("knowledge_documents.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关联关系
    version = relationship("Version", back_populates="knowledge_docs")
    # Using string reference for KnowledgeDocument since it's defined elsewhere or later
    # We can use backref implicitly, or rely on explicit manual queries.

class KnowledgeDocument(Base):
    """知识文档表"""
    __tablename__ = "knowledge_documents"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    doc_id = Column(String(100), unique=True, nullable=False)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)
    doc_metadata = Column(Text)  # JSON格式，避免与SQLAlchemy保留字冲突
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# AI 生成会话表
class AIGenerationSession(Base):
    __tablename__ = "ai_generation_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), unique=True, index=True, nullable=False)
    version_id = Column(Integer, ForeignKey("versions.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    model = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, running, completed, failed
    total_requirements = Column(Integer, default=0)
    total_generated_cases = Column(Integer, default=0)
    total_hit_cases = Column(Integer, default=0)
    total_citations = Column(Integer, default=0)
    explicit_doc_count = Column(Integer, default=0)
    knowledge_hit_rate = Column(Float, default=0)
    summary = Column(JSON)
    error_message = Column(Text)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    version = relationship("Version")
    project = relationship("Project")
    generated_cases = relationship("AIGeneratedCaseEvidence", back_populates="session", cascade="all, delete-orphan")
    citations = relationship("AIGeneratedCaseCitation", back_populates="session", cascade="all, delete-orphan")

# AI 生成用例证据表
class AIGeneratedCaseEvidence(Base):
    __tablename__ = "ai_generated_case_evidence"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("ai_generation_sessions.id"), nullable=False)
    testcase_id = Column(Integer, ForeignKey("testcases.id"))
    requirement_id = Column(Integer, ForeignKey("requirements.id"), nullable=False)
    case_index = Column(Integer, default=0)
    case_title = Column(String(255), nullable=False)
    used_explicit_context = Column(Boolean, default=False)
    used_rag = Column(Boolean, default=False)
    knowledge_hit_count = Column(Integer, default=0)
    citation_count = Column(Integer, default=0)
    hit_score = Column(Float, default=0)
    evidence_summary = Column(Text)
    raw_case = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("AIGenerationSession", back_populates="generated_cases")
    testcase = relationship("TestCase")
    requirement = relationship("Requirement")
    citations = relationship("AIGeneratedCaseCitation", back_populates="generated_case", cascade="all, delete-orphan")

# AI 生成用例引用明细表
class AIGeneratedCaseCitation(Base):
    __tablename__ = "ai_generated_case_citations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("ai_generation_sessions.id"), nullable=False)
    generated_case_id = Column(Integer, ForeignKey("ai_generated_case_evidence.id"), nullable=False)
    knowledge_doc_id = Column(Integer, ForeignKey("knowledge_documents.id"))
    requirement_id = Column(Integer, ForeignKey("requirements.id"), nullable=False)
    source_type = Column(String(30), nullable=False, default="explicit")  # explicit, rag, inferred
    evidence_type = Column(String(30), nullable=False, default="document")  # document, chunk, semantic_match
    chunk_id = Column(String(100))
    chunk_index = Column(Integer)
    doc_title = Column(String(500))
    matched_text = Column(Text)
    quote_text = Column(Text)
    similarity_score = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("AIGenerationSession", back_populates="citations")
    generated_case = relationship("AIGeneratedCaseEvidence", back_populates="citations")
    knowledge_document = relationship("KnowledgeDocument")
    requirement = relationship("Requirement")

# 已废弃：自2.3.x版本引入ChromaDB后不再使用表存向量
# class DocumentEmbedding(Base):
#     """文档向量表"""
#     __tablename__ = "document_embeddings"
#     
#     id = Column(Integer, primary_key=True, autoincrement=True)
#     doc_id = Column(String(100), nullable=False)
#     chunk_index = Column(Integer, nullable=False)
#     chunk_content = Column(Text, nullable=False)
#     embedding = Column(Text)  # JSON格式的向量

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
    project_id = Column(Integer, ForeignKey("projects.id"))
    
    # 关联关系
    project = relationship("Project")
    test_reports = relationship("TestReport", back_populates="version")
    requirements = relationship("VersionRequirement", back_populates="version")
    knowledge_docs = relationship("VersionKnowledge", back_populates="version", cascade="all, delete-orphan")

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

# 操作日志表
class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user = Column(String(100), nullable=False, default="管理员")  # 操作用户
    action = Column(String(50), nullable=False)  # create, update, delete, execute, generate
    module = Column(String(50), nullable=False)  # project, requirement, testcase, version, testsuite
    target_name = Column(String(200), nullable=False)  # 操作对象名称
    detail = Column(Text)  # 详细描述
    status = Column(String(20), default="success")  # success, failed
    created_at = Column(DateTime, default=datetime.utcnow)


# UI 自动化任务表
class UIAutomationTask(Base):
    __tablename__ = "ui_automation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_no = Column(String(40), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    target_url = Column(String(500), nullable=False)
    auth_scheme = Column(String(30), nullable=False, default="none")
    auth_payload = Column(JSON)
    natural_language_steps = Column(JSON)
    assertions = Column(JSON)
    status = Column(String(20), nullable=False, default="pending")  # pending, running, success, failed
    progress = Column(Integer, nullable=False, default=0)
    executor = Column(String(30), nullable=False, default="browser_use")
    debug_mode = Column(Boolean, nullable=False, default=False)
    error_message = Column(Text)
    playwright_script = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)


# UI 自动化步骤日志
class UIAutomationStepLog(Base):
    __tablename__ = "ui_automation_step_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("ui_automation_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    step_index = Column(Integer, nullable=False)
    step_title = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, running, success, failed
    detail = Column(Text)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)


# UI 自动化产物表
class UIAutomationArtifact(Base):
    __tablename__ = "ui_automation_artifacts"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("ui_automation_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    artifact_type = Column(String(30), nullable=False)  # screenshot, dom_snapshot, video, error, script
    artifact_name = Column(String(200), nullable=False)
    artifact_path = Column(String(500))
    artifact_content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
