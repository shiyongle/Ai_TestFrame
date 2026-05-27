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
    real_name = Column(String(100), nullable=True)
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


class RequirementTestAsset(Base):
    """需求与测试资产的统一关联表。"""
    __tablename__ = "requirement_test_assets"

    id = Column(Integer, primary_key=True, index=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False)
    asset_type = Column(String(50), nullable=False)  # functional_case/interface_case/ui_case/performance_scenario/agent_dataset
    asset_id = Column(Integer, nullable=False)
    coverage_type = Column(String(30), nullable=False, default="regression")
    priority = Column(String(20), nullable=False, default="medium")
    source = Column(String(30), nullable=False, default="manual")
    confidence_score = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    requirement = relationship("Requirement")


class QualityExecutionResult(Base):
    """统一质量执行结果表，用于沉淀不同测试资产的执行状态。"""
    __tablename__ = "quality_execution_results"

    id = Column(Integer, primary_key=True, index=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False)
    asset_type = Column(String(50), nullable=False)
    asset_id = Column(Integer, nullable=False)
    execution_ref_type = Column(String(50))
    execution_ref_id = Column(Integer)
    report_id = Column(Integer, ForeignKey("test_reports.id"))
    version_id = Column(Integer, ForeignKey("versions.id"))
    status = Column(String(20), nullable=False, default="not_run")
    defect_id = Column(Integer, ForeignKey("defects.id"))
    executed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    requirement = relationship("Requirement")
    report = relationship("TestReport")
    version = relationship("Version")


class RequirementChangeLog(Base):
    """需求变更快照，用于影响分析和回归范围推荐。"""
    __tablename__ = "requirement_change_logs"

    id = Column(Integer, primary_key=True, index=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    old_content = Column(JSON)
    new_content = Column(JSON)
    changed_fields = Column(JSON)
    impact_keywords = Column(JSON)
    operator = Column(String(100), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)

    requirement = relationship("Requirement")
    project = relationship("Project")


class TestAssetVersion(Base):
    """测试资产版本快照，记录用例每次变更的内容、diff、来源和审批状态。"""
    __tablename__ = "test_asset_versions"

    id = Column(Integer, primary_key=True, index=True)
    asset_type = Column(String(50), nullable=False)  # functional_case/interface_case
    asset_id = Column(Integer, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    version_no = Column(Integer, nullable=False, default=1)
    action = Column(String(30), nullable=False, default="update")
    snapshot = Column(JSON)
    diff = Column(JSON)
    change_summary = Column(Text)
    source = Column(String(50), nullable=False, default="manual")
    source_ref_type = Column(String(50))
    source_ref_id = Column(String(100))
    requirement_id = Column(Integer, ForeignKey("requirements.id"))
    created_by = Column(String(100), default="system")
    approval_status = Column(String(20), nullable=False, default="approved")  # pending, approved, rejected
    approved_by = Column(String(100))
    approved_at = Column(DateTime)
    content_hash = Column(String(64), nullable=False)
    previous_hash = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    requirement = relationship("Requirement")


class TestAssetBaseline(Base):
    """测试资产基线，可冻结某项目/版本的一组测试资产。"""
    __tablename__ = "test_asset_baselines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    version_id = Column(Integer, ForeignKey("versions.id"))
    status = Column(String(20), nullable=False, default="draft")  # draft, frozen, archived
    created_by = Column(String(100), default="system")
    frozen_by = Column(String(100))
    frozen_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    version = relationship("Version")
    items = relationship("TestAssetBaselineItem", back_populates="baseline", cascade="all, delete-orphan")


class TestAssetBaselineItem(Base):
    """基线内的测试资产快照，冻结后作为可审计依据。"""
    __tablename__ = "test_asset_baseline_items"

    id = Column(Integer, primary_key=True, index=True)
    baseline_id = Column(Integer, ForeignKey("test_asset_baselines.id", ondelete="CASCADE"), nullable=False)
    asset_type = Column(String(50), nullable=False)
    asset_id = Column(Integer, nullable=False)
    asset_version_id = Column(Integer, ForeignKey("test_asset_versions.id"))
    snapshot = Column(JSON)
    content_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    baseline = relationship("TestAssetBaseline", back_populates="items")
    asset_version = relationship("TestAssetVersion")


class TestAssetApproval(Base):
    """测试资产版本审批记录，记录谁确认、何时确认以及审批意见。"""
    __tablename__ = "test_asset_approvals"

    id = Column(Integer, primary_key=True, index=True)
    asset_version_id = Column(Integer, ForeignKey("test_asset_versions.id", ondelete="CASCADE"), nullable=False)
    decision = Column(String(20), nullable=False)  # approved, rejected
    approver = Column(String(100), default="system")
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    asset_version = relationship("TestAssetVersion")


class TestAssetAuditEvent(Base):
    """测试资产不可变审计事件，使用哈希链记录关键动作。"""
    __tablename__ = "test_asset_audit_events"

    id = Column(Integer, primary_key=True, index=True)
    asset_type = Column(String(50), nullable=False)
    asset_id = Column(Integer, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    action = Column(String(50), nullable=False)
    actor = Column(String(100), default="system")
    detail = Column(Text)
    metadata_json = Column(JSON)
    before_hash = Column(String(64))
    after_hash = Column(String(64))
    event_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")


class ApiEnvironment(Base):
    """API 执行环境，承载 dev/test/stage/prod 的基础地址和脚本配置。"""
    __tablename__ = "api_environments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    base_url = Column(Text)
    description = Column(Text)
    status = Column(String(20), nullable=False, default="active")
    is_default = Column(Boolean, default=False)
    pre_script = Column(Text)
    post_script = Column(Text)
    created_by = Column(String(100), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    variables = relationship("ApiEnvironmentVariable", back_populates="environment", cascade="all, delete-orphan")
    account_pools = relationship("ApiAccountPool", back_populates="environment", cascade="all, delete-orphan")
    data_pools = relationship("ApiDataPool", back_populates="environment", cascade="all, delete-orphan")


class ApiEnvironmentVariable(Base):
    """环境变量，支持普通变量、密钥变量和动态变量。"""
    __tablename__ = "api_environment_variables"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("api_environments.id", ondelete="CASCADE"), nullable=False)
    key = Column(String(100), nullable=False)
    value = Column(Text)
    variable_type = Column(String(20), nullable=False, default="normal")  # normal, secret, dynamic
    description = Column(Text)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    environment = relationship("ApiEnvironment", back_populates="variables")


class ApiAccountPool(Base):
    """账号池，可在执行时按策略取账号并注入 account.* 变量。"""
    __tablename__ = "api_account_pools"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("api_environments.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    strategy = Column(String(20), nullable=False, default="round_robin")  # round_robin, first
    accounts = Column(JSON)
    current_index = Column(Integer, default=0)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    environment = relationship("ApiEnvironment", back_populates="account_pools")


class ApiDataPool(Base):
    """数据池，可在执行时按策略取一行数据并注入 data.* 变量。"""
    __tablename__ = "api_data_pools"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("api_environments.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    strategy = Column(String(20), nullable=False, default="round_robin")  # round_robin, first
    rows = Column(JSON)
    current_index = Column(Integer, default=0)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    environment = relationship("ApiEnvironment", back_populates="data_pools")


class ApiTestCollection(Base):
    """接口测试集合，支持集合级 Runner 和前后置脚本。"""
    __tablename__ = "api_test_collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    environment_id = Column(Integer, ForeignKey("api_environments.id"))
    pre_script = Column(Text)
    post_script = Column(Text)
    tags = Column(JSON)
    status = Column(String(20), nullable=False, default="active")
    created_by = Column(String(100), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    environment = relationship("ApiEnvironment")
    items = relationship("ApiTestCollectionItem", back_populates="collection", cascade="all, delete-orphan")


class ApiTestCollectionItem(Base):
    """接口测试集合步骤。"""
    __tablename__ = "api_test_collection_items"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("api_test_collections.id", ondelete="CASCADE"), nullable=False)
    interface_testcase_id = Column(Integer, ForeignKey("interface_testcases.id"), nullable=False)
    order_index = Column(Integer, default=0)
    enabled = Column(Boolean, default=True)
    extractors = Column(JSON)
    assertions = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    collection = relationship("ApiTestCollection", back_populates="items")
    interface_testcase = relationship("InterfaceTestCase")


class ApiTestRun(Base):
    """接口集合运行记录。"""
    __tablename__ = "api_test_runs"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("api_test_collections.id", ondelete="SET NULL"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    environment_id = Column(Integer, ForeignKey("api_environments.id"))
    status = Column(String(20), nullable=False, default="running")
    total_items = Column(Integer, default=0)
    passed_items = Column(Integer, default=0)
    failed_items = Column(Integer, default=0)
    duration_ms = Column(Integer, default=0)
    context_snapshot = Column(JSON)
    summary = Column(JSON)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    collection = relationship("ApiTestCollection")
    project = relationship("Project")
    environment = relationship("ApiEnvironment")
    items = relationship("ApiTestRunItem", back_populates="run", cascade="all, delete-orphan")


class ApiTestRunItem(Base):
    """接口集合运行步骤结果。"""
    __tablename__ = "api_test_run_items"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("api_test_runs.id", ondelete="CASCADE"), nullable=False)
    collection_item_id = Column(Integer, ForeignKey("api_test_collection_items.id"))
    interface_testcase_id = Column(Integer, ForeignKey("interface_testcases.id"))
    name = Column(String(150))
    status = Column(String(20), nullable=False, default="failed")
    status_code = Column(Integer, default=0)
    duration_ms = Column(Integer, default=0)
    assertions = Column(JSON)
    extracted_variables = Column(JSON)
    error_message = Column(Text)
    response_snapshot = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("ApiTestRun", back_populates="items")
    interface_testcase = relationship("InterfaceTestCase")


class ApiMockEndpoint(Base):
    """Mock Server 端点。"""
    __tablename__ = "api_mock_endpoints"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(150), nullable=False)
    mock_key = Column(String(80), nullable=False, index=True)
    method = Column(String(10), nullable=False, default="GET")
    path = Column(String(300), nullable=False)
    status_code = Column(Integer, default=200)
    headers = Column(JSON)
    response_body = Column(JSON)
    delay_ms = Column(Integer, default=0)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")


class ApiContractSchema(Base):
    """接口契约 Schema。"""
    __tablename__ = "api_contract_schemas"

    id = Column(Integer, primary_key=True, index=True)
    interface_testcase_id = Column(Integer, ForeignKey("interface_testcases.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    expected_status_codes = Column(JSON)
    response_schema = Column(JSON)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    interface_testcase = relationship("InterfaceTestCase")


class ApiInterfaceChangeLog(Base):
    """接口资产变更 Diff 日志。"""
    __tablename__ = "api_interface_change_logs"

    id = Column(Integer, primary_key=True, index=True)
    interface_testcase_id = Column(Integer, ForeignKey("interface_testcases.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    old_snapshot = Column(JSON)
    new_snapshot = Column(JSON)
    diff = Column(JSON)
    source = Column(String(50), default="manual")
    operator = Column(String(100), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)

    interface_testcase = relationship("InterfaceTestCase")
    project = relationship("Project")


class ApiMonitorProbe(Base):
    """接口监控探测配置。"""
    __tablename__ = "api_monitor_probes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    interface_testcase_id = Column(Integer, ForeignKey("interface_testcases.id", ondelete="CASCADE"), nullable=False)
    environment_id = Column(Integer, ForeignKey("api_environments.id"))
    interval_seconds = Column(Integer, default=300)
    enabled = Column(Boolean, default=True)
    last_status = Column(String(20))
    last_status_code = Column(Integer)
    last_latency_ms = Column(Integer)
    last_checked_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    interface_testcase = relationship("InterfaceTestCase")
    environment = relationship("ApiEnvironment")

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


class Defect(Base):
    """缺陷闭环主表，支持内置流转与外部缺陷平台映射。"""
    __tablename__ = "defects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    severity = Column(String(20), nullable=False, default="major")
    priority = Column(String(20), nullable=False, default="P2")
    status = Column(String(30), nullable=False, default="open")
    source_type = Column(String(30), nullable=False, default="manual")
    requirement_id = Column(Integer, ForeignKey("requirements.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    report_id = Column(Integer, ForeignKey("test_reports.id"))
    testcase_id = Column(Integer, ForeignKey("testcases.id"))
    interface_testcase_id = Column(Integer, ForeignKey("interface_testcases.id"))
    external_provider = Column(String(50), default="local")
    external_key = Column(String(100))
    external_url = Column(Text)
    external_status = Column(String(50))
    last_synced_at = Column(DateTime)
    regression_status = Column(String(30), nullable=False, default="not_started")
    regression_report_id = Column(Integer, ForeignKey("test_reports.id"))
    regression_notes = Column(Text)
    created_by = Column(String(100), default="system")
    assigned_to = Column(String(100))
    resolved_at = Column(DateTime)
    verified_at = Column(DateTime)
    closed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    requirement = relationship("Requirement")
    report = relationship("TestReport", foreign_keys=[report_id])
    regression_report = relationship("TestReport", foreign_keys=[regression_report_id])
    testcase = relationship("TestCase")
    interface_testcase = relationship("InterfaceTestCase")
    histories = relationship("DefectStatusHistory", back_populates="defect", cascade="all, delete-orphan")


class DefectStatusHistory(Base):
    """缺陷状态流转记录。"""
    __tablename__ = "defect_status_histories"

    id = Column(Integer, primary_key=True, index=True)
    defect_id = Column(Integer, ForeignKey("defects.id", ondelete="CASCADE"), nullable=False)
    from_status = Column(String(30))
    to_status = Column(String(30), nullable=False)
    action = Column(String(50), nullable=False)
    operator = Column(String(100), default="system")
    comment = Column(Text)
    external_status = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    defect = relationship("Defect", back_populates="histories")


# UI 自动化用例表
class UIAutomationCase(Base):
    __tablename__ = "ui_automation_cases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    target_url = Column(String(500), nullable=False)
    auth_scheme = Column(String(30), nullable=False, default="none")
    auth_payload = Column(JSON)
    natural_language_steps = Column(JSON)
    assertions = Column(JSON)
    tags = Column(JSON)
    status = Column(String(20), nullable=False, default="draft")
    debug_mode = Column(Boolean, nullable=False, default=False)
    last_run_status = Column(String(20))
    last_run_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# UI 自动化任务表
class UIAutomationTask(Base):
    __tablename__ = "ui_automation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_no = Column(String(40), unique=True, nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("ui_automation_cases.id", ondelete="SET NULL"), index=True)
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


# 性能测试场景表
class PerformanceScenario(Base):
    __tablename__ = "performance_scenarios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    protocol = Column(String(20), nullable=False, default="http")
    status = Column(String(20), nullable=False, default="draft")
    tags = Column(JSON)
    target_config = Column(JSON)
    steps = Column(JSON)
    variables = Column(JSON)
    environment_config = Column(JSON)
    load_profile = Column(JSON)
    assertions = Column(JSON)
    runtime_options = Column(JSON)
    last_run_status = Column(String(20))
    last_run_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# 性能测试运行记录表
class PerformanceTestRun(Base):
    __tablename__ = "performance_test_runs"

    id = Column(Integer, primary_key=True, index=True)
    run_no = Column(String(40), unique=True, nullable=False, index=True)
    scenario_id = Column(Integer, ForeignKey("performance_scenarios.id", ondelete="CASCADE"), nullable=False, index=True)
    scenario_name = Column(String(150), nullable=False)
    protocol = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    stage = Column(String(30), nullable=False, default="created")
    trigger_source = Column(String(20), nullable=False, default="manual")
    load_profile = Column(JSON)
    target_config = Column(JSON)
    scenario_snapshot = Column(JSON)
    step_summary = Column(JSON)
    engine_metadata = Column(JSON)
    runtime_options = Column(JSON)
    assertions = Column(JSON)
    current_users = Column(Integer, nullable=False, default=0)
    target_users = Column(Integer, nullable=False, default=0)
    spawn_rate = Column(Float, nullable=False, default=1)
    duration_seconds = Column(Integer, nullable=False, default=0)
    progress = Column(Integer, nullable=False, default=0)
    current_rps = Column(Float, nullable=False, default=0)
    avg_response_time = Column(Float, nullable=False, default=0)
    p95_response_time = Column(Float, nullable=False, default=0)
    p99_response_time = Column(Float, nullable=False, default=0)
    error_rate = Column(Float, nullable=False, default=0)
    worker_count = Column(Integer, nullable=False, default=1)
    summary = Column(JSON)
    error_message = Column(Text)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# 性能测试指标时序表
class PerformanceMetricPoint(Base):
    __tablename__ = "performance_metric_points"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("performance_test_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp_offset = Column(Integer, nullable=False, default=0)
    active_users = Column(Integer, nullable=False, default=0)
    current_rps = Column(Float, nullable=False, default=0)
    avg_response_time = Column(Float, nullable=False, default=0)
    p95_response_time = Column(Float, nullable=False, default=0)
    p99_response_time = Column(Float, nullable=False, default=0)
    error_rate = Column(Float, nullable=False, default=0)
    total_requests = Column(Integer, nullable=False, default=0)
    total_failures = Column(Integer, nullable=False, default=0)
    cpu_usage = Column(Float)
    memory_usage = Column(Float)
    worker_count = Column(Integer, nullable=False, default=1)
    spawned_users = Column(Integer, nullable=False, default=0)
    raw_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


# 性能测试事件表
class PerformanceRunEvent(Base):
    __tablename__ = "performance_run_events"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("performance_test_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    stage = Column(String(30), nullable=False)
    level = Column(String(20), nullable=False, default="info")
    message = Column(String(500), nullable=False)
    payload = Column(JSON)
    event_time = Column(DateTime, default=datetime.utcnow)


# 模型配置表（Agent评测专用，支持多模型切换）
class ModelConfig(Base):
    __tablename__ = "model_configs"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), nullable=False)  # openai, bailian, glm, deepseek, siliconflow
    name = Column(String(100), nullable=False)  # 配置名称
    api_key = Column(Text, nullable=False)
    base_url = Column(String(500), nullable=False)
    model = Column(String(100), nullable=False)  # 具体模型名称
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    extraction_templates = relationship("ExtractionTemplate", back_populates="model_config")
    recognition_templates = relationship("RecognitionTemplate", back_populates="model_config")
    agent_evaluation_templates = relationship("AgentEvaluationTemplate", back_populates="model_config")


# 黄金测试集表
class GoldenDataset(Base):
    """黄金测试集"""
    __tablename__ = "golden_datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    tags = Column(JSON)  # 标签列表
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("GoldenDatasetItem", back_populates="dataset", cascade="all, delete-orphan")


# 黄金测试集条目表
class GoldenDatasetItem(Base):
    """黄金测试集中的单条 Q&A"""
    __tablename__ = "golden_dataset_items"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("golden_datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    expected_answer = Column(Text, nullable=False)
    category = Column(String(100))  # 分类标签
    priority = Column(String(20), default="medium")  # high, medium, low
    tags = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dataset = relationship("GoldenDataset", back_populates="items")


# 被测 Agent 配置表（支持 Dify 和通用 HTTP API）
class DifyAgent(Base):
    __tablename__ = "dify_agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    agent_type = Column(String(20), nullable=False, default="dify")  # dify, http_api
    base_url = Column(String(500), nullable=False)
    app_id = Column(String(100), nullable=False, default="")  # Dify 专用
    api_key = Column(String(255))
    request_config = Column(JSON)  # 通用 HTTP Agent 配置: {headers, answer_path, method, body_template}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    bad_cases = relationship("BadCase", back_populates="agent", cascade="all, delete-orphan")


# BadCase（不良案例）表
class BadCase(Base):
    __tablename__ = "bad_cases"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("dify_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(String(100))
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agent = relationship("DifyAgent", back_populates="bad_cases")
    turns = relationship("BadCaseTurn", back_populates="bad_case", cascade="all, delete-orphan")


# BadCaseTurn（不良案例轮次）表
class BadCaseTurn(Base):
    __tablename__ = "bad_case_turns"

    id = Column(Integer, primary_key=True, index=True)
    bad_case_id = Column(Integer, ForeignKey("bad_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    message_id = Column(String(100))
    query = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    expected_answer = Column(Text)
    evaluation_score = Column(Integer)  # LLM评测得分
    evaluation_reason = Column(Text)  # LLM评测原因
    evaluation_id = Column(Integer, ForeignKey("agent_evaluations.id"))  # 关联的评测记录
    rerun_answer = Column(Text)  # 重跑后的回答
    rerun_score = Column(Integer)  # 重跑后评测得分
    rerun_reason = Column(Text)  # 重跑后评测原因
    rerun_evaluation_id = Column(Integer, ForeignKey("agent_evaluations.id"))  # 重跑关联评测
    remark = Column(Text)
    turn_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    bad_case = relationship("BadCase", back_populates="turns")


# Agent 评测模板表
class AgentEvaluationTemplate(Base):
    __tablename__ = "agent_evaluation_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    system_prompt = Column(Text)
    user_prompt = Column(Text, nullable=False)  # 支持 {{query}}, {{expected_answer}}, {{answer}} 变量
    eval_mode = Column(String(20), nullable=False, default="f1")  # f1, llm
    model_config_id = Column(Integer, ForeignKey("model_configs.id", ondelete="SET NULL"))
    pass_threshold = Column(Float, default=0.55)  # f1模式通过阈值
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    model_config = relationship("ModelConfig", back_populates="agent_evaluation_templates")
    evaluations = relationship("AgentEvaluation", back_populates="template", cascade="all, delete-orphan")


# Agent 评测记录表（单条评测，对应xapp的AgentEvaluation）
class AgentEvaluation(Base):
    __tablename__ = "agent_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("agent_evaluation_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    bad_case_turn_id = Column(Integer, ForeignKey("bad_case_turns.id"), index=True)  # 可关联BadCaseTurn
    query = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    expected_answer = Column(Text)
    extracted_items = Column(Text)  # LLM提取的结构化评测项
    evaluation_result = Column(Text)  # LLM原始评测结果
    score = Column(Float, default=0)
    reason = Column(Text)
    status = Column(String(20), nullable=False, default="pending")  # pending, running, completed, failed
    error_message = Column(Text)
    latency_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    template = relationship("AgentEvaluationTemplate", back_populates="evaluations")


# Agent 评测运行记录表（批量评测，保留原有结构并增强）
class AgentEvaluationRun(Base):
    __tablename__ = "agent_evaluation_runs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    dataset_id = Column(Integer, ForeignKey("golden_datasets.id"), index=True)  # 关联黄金测试集
    agent_id = Column(Integer, ForeignKey("dify_agents.id"), index=True)  # 关联被测 Agent
    template_id = Column(Integer, ForeignKey("agent_evaluation_templates.id"), index=True)  # 关联评测模板
    eval_mode = Column(String(20), nullable=False, default="f1")  # f1, llm, semantic, multi_judge, rouge, bleu
    provider = Column(String(50), nullable=False, default="")  # 兼容旧数据
    model = Column(String(100))
    model_config_id = Column(Integer, ForeignKey("model_configs.id"))  # 关联模型配置
    baseline_run_id = Column(Integer, index=True)  # 回归测试基线
    status = Column(String(20), nullable=False, default="pending")  # pending, running, completed, failed
    total_count = Column(Integer, nullable=False, default=0)
    valid_count = Column(Integer, nullable=False, default=0)
    invalid_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    human_override_count = Column(Integer, nullable=False, default=0)
    valid_rate = Column(Float, nullable=False, default=0)
    failure_rate = Column(Float, nullable=False, default=0)
    avg_cost = Column(Float, nullable=False, default=0)  # 平均成本
    avg_latency_ms = Column(Float, nullable=False, default=0)  # 平均延迟
    total_tokens = Column(Integer, nullable=False, default=0)  # 总token消耗
    summary = Column(JSON)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    items = relationship("AgentEvaluationItem", back_populates="run", cascade="all, delete-orphan")
    template = relationship("AgentEvaluationTemplate")
    dataset = relationship("GoldenDataset")
    agent = relationship("DifyAgent")


# Agent 评测明细表（批量评测中的单条，保留原有结构并增强）
class AgentEvaluationItem(Base):
    __tablename__ = "agent_evaluation_items"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("agent_evaluation_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_item_id = Column(Integer, ForeignKey("golden_dataset_items.id"), index=True)  # 关联黄金测试集条目
    evaluation_id = Column(Integer, ForeignKey("agent_evaluations.id"), index=True)  # 可关联单条评测
    question = Column(Text, nullable=False)
    expected_answer = Column(Text)
    actual_answer = Column(Text)
    evaluation_result = Column(Text)  # LLM原始评测结果（llm模式）
    status = Column(String(20), nullable=False, default="pending")  # pending, valid, invalid, failed
    score = Column(Float, nullable=False, default=0)
    reason = Column(Text)
    error_message = Column(Text)
    latency_ms = Column(Integer, nullable=False, default=0)
    cost = Column(Float, nullable=False, default=0)  # 本次评测成本
    tokens = Column(Integer, nullable=False, default=0)  # token消耗
    semantic_score = Column(Float)  # 语义相似度分数
    rouge_score = Column(Float)  # ROUGE-L分数
    bleu_score = Column(Float)  # BLEU分数
    multi_judge_scores = Column(JSON)  # 多模型评分 {"gpt-4": 0.9, "claude": 0.85}
    human_override = Column(Boolean, nullable=False, default=False)  # 是否有人工标注
    human_label = Column(String(20))  # correct, incorrect
    human_comment = Column(Text)  # 人工标注备注
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    run = relationship("AgentEvaluationRun", back_populates="items")


# 知识提取模板表
class ExtractionTemplate(Base):
    __tablename__ = "extraction_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    system_prompt = Column(Text)
    user_prompt = Column(Text, nullable=False)
    model_config_id = Column(Integer, ForeignKey("model_configs.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    model_config = relationship("ModelConfig", back_populates="extraction_templates")
    extractions = relationship("Extraction", back_populates="template", cascade="all, delete-orphan")


# 知识提取记录表
class Extraction(Base):
    __tablename__ = "extractions"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("extraction_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    input_text = Column(Text, nullable=False)
    output_text = Column(Text)
    status = Column(String(20), nullable=False, default="pending")  # pending, running, completed, failed
    error = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    template = relationship("ExtractionTemplate", back_populates="extractions")


# 知识识别模板表
class RecognitionTemplate(Base):
    __tablename__ = "recognition_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    system_prompt = Column(Text)
    user_prompt = Column(Text, nullable=False)
    model_config_id = Column(Integer, ForeignKey("model_configs.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    model_config = relationship("ModelConfig", back_populates="recognition_templates")
    recognitions = relationship("Recognition", back_populates="template", cascade="all, delete-orphan")


# 知识识别记录表
class Recognition(Base):
    __tablename__ = "recognitions"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("recognition_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    input_text = Column(Text, nullable=False)
    scoring_items = Column(Text)  # 评分项
    output_text = Column(Text)
    status = Column(String(20), nullable=False, default="pending")  # pending, running, completed, failed
    error = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    template = relationship("RecognitionTemplate", back_populates="recognitions")
