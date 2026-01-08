-- 投石问路 MySQL 数据库初始化脚本
-- 版本: v2.1.0 (包含AI接入层和规则配置系统)
-- 创建时间: 2025-12-23
-- 说明: 本文件包含所有数据库表结构和初始数据

-- 创建数据库
CREATE DATABASE IF NOT EXISTS test_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE test_system;

-- ==================== 基础业务表 ====================

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_projects_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 测试用例表
CREATE TABLE IF NOT EXISTS testcases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    protocol VARCHAR(20) NOT NULL COMMENT 'http, tcp, mq',
    config JSON,
    project_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_testcases_project (project_id),
    INDEX idx_testcases_protocol (protocol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 测试结果表
CREATE TABLE IF NOT EXISTS test_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    testcase_id INT NOT NULL,
    status VARCHAR(20) NOT NULL COMMENT 'success, fail, error',
    response_data JSON,
    execution_time INT COMMENT '毫秒',
    error_message TEXT,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (testcase_id) REFERENCES testcases(id) ON DELETE CASCADE,
    INDEX idx_test_results_testcase (testcase_id),
    INDEX idx_test_results_status (status),
    INDEX idx_test_results_executed_at (executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 版本管理表
CREATE TABLE IF NOT EXISTS versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    version_number VARCHAR(50) NOT NULL,
    description TEXT,
    changes JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    INDEX idx_versions_number (version_number),
    INDEX idx_versions_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 测试报告表
CREATE TABLE IF NOT EXISTS test_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    version_id INT,
    project_id INT NOT NULL,
    total_tests INT DEFAULT 0,
    passed_tests INT DEFAULT 0,
    failed_tests INT DEFAULT 0,
    error_tests INT DEFAULT 0,
    summary JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_test_reports_version (version_id),
    INDEX idx_test_reports_project (project_id),
    INDEX idx_test_reports_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 测试数据表
CREATE TABLE IF NOT EXISTS test_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    data_type VARCHAR(50) COMMENT 'request_data, response_data, config',
    content JSON,
    project_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_test_data_project (project_id),
    INDEX idx_test_data_type (data_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 规则配置系统表 (v2.0.0新增) ====================

-- 规则模板表
CREATE TABLE IF NOT EXISTS rule_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '规则名称',
    category VARCHAR(50) NOT NULL COMMENT '分类：correctness/security/performance/compatibility',
    protocol VARCHAR(20) NOT NULL COMMENT '协议：http/tcp/mq',
    description TEXT COMMENT '规则描述',
    is_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    priority INT DEFAULT 0 COMMENT '优先级',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_protocol (protocol),
    INDEX idx_category (category),
    INDEX idx_enabled (is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则模板表';

-- 规则定义表
CREATE TABLE IF NOT EXISTS rule_definitions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id INT NOT NULL COMMENT '关联规则模板ID',
    rule_type VARCHAR(50) NOT NULL COMMENT '规则类型：status_code/response_time/field_check等',
    rule_config JSON COMMENT '规则配置（JSON格式）',
    execution_order INT DEFAULT 0 COMMENT '执行顺序',
    is_required BOOLEAN DEFAULT TRUE COMMENT '是否必须',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    FOREIGN KEY (template_id) REFERENCES rule_templates(id) ON DELETE CASCADE,
    INDEX idx_template (template_id),
    INDEX idx_rule_type (rule_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则定义表';

-- 断言规则表
CREATE TABLE IF NOT EXISTS assertion_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rule_definition_id INT NOT NULL COMMENT '关联规则定义ID',
    assertion_type VARCHAR(50) NOT NULL COMMENT '断言类型：equals/contains/range/regex等',
    field_path VARCHAR(200) COMMENT '字段路径，如：data.user.id',
    operator VARCHAR(20) COMMENT '操作符：==, !=, >, <, contains等',
    expected_value TEXT COMMENT '期望值',
    error_message TEXT COMMENT '错误提示信息',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    FOREIGN KEY (rule_definition_id) REFERENCES rule_definitions(id) ON DELETE CASCADE,
    INDEX idx_rule_definition (rule_definition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='断言规则表';

-- 测试用例规则关联表
CREATE TABLE IF NOT EXISTS testcase_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    testcase_id INT NOT NULL COMMENT '测试用例ID',
    rule_template_id INT NOT NULL COMMENT '规则模板ID',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
    custom_config JSON COMMENT '自定义配置（覆盖模板配置）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    FOREIGN KEY (testcase_id) REFERENCES testcases(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_template_id) REFERENCES rule_templates(id) ON DELETE CASCADE,
    INDEX idx_testcase (testcase_id),
    INDEX idx_rule_template (rule_template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试用例规则关联表';

-- ==================== AI接入层相关表 (v2.1.0新增) ====================

-- 知识文档表
CREATE TABLE IF NOT EXISTS `knowledge_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `doc_id` varchar(100) NOT NULL,
  `title` varchar(500) NOT NULL,
  `content` longtext NOT NULL,
  `source` varchar(200) NOT NULL DEFAULT '',
  `category` varchar(100) NOT NULL DEFAULT 'general',
  `doc_metadata` longtext COMMENT 'JSON格式的元数据',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_doc_id` (`doc_id`),
  KEY `idx_category` (`category`),
  KEY `idx_source` (`source`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识文档表';

-- 文档向量表
CREATE TABLE IF NOT EXISTS `document_embeddings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `doc_id` varchar(100) NOT NULL,
  `chunk_index` int NOT NULL,
  `chunk_content` longtext NOT NULL,
  `embedding` longtext COMMENT 'JSON格式的向量',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doc_id` (`doc_id`),
  KEY `idx_doc_chunk` (`doc_id`, `chunk_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文档向量表';

-- 工作流定义表
CREATE TABLE IF NOT EXISTS `workflow_definitions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `workflow_id` varchar(100) NOT NULL,
  `name` varchar(200) NOT NULL,
  `description` longtext,
  `definition` longtext NOT NULL COMMENT 'JSON格式的工作流定义',
  `version` varchar(20) NOT NULL DEFAULT '1.0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_workflow_id` (`workflow_id`),
  KEY `idx_active` (`active`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流定义表';

-- 工作流执行记录表
CREATE TABLE IF NOT EXISTS `workflow_executions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `execution_id` varchar(100) NOT NULL,
  `workflow_id` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `context` longtext COMMENT 'JSON格式的上下文',
  `current_node` varchar(100),
  `error_message` longtext,
  `start_time` datetime,
  `end_time` datetime,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_execution_id` (`execution_id`),
  KEY `idx_workflow_id` (`workflow_id`),
  KEY `idx_status` (`status`),
  KEY `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流执行记录表';

-- ==================== 外键约束 ====================

-- AI接入层相关外键约束
ALTER TABLE `document_embeddings` 
ADD CONSTRAINT `fk_embeddings_doc_id` 
FOREIGN KEY (`doc_id`) 
REFERENCES `knowledge_documents` (`doc_id`) 
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `workflow_executions` 
ADD CONSTRAINT `fk_executions_workflow_id` 
FOREIGN KEY (`workflow_id`) 
REFERENCES `workflow_definitions` (`workflow_id`) 
ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== 索引优化 ====================

-- AI接入层相关索引优化
-- 为 knowledge_documents 表创建索引
ALTER TABLE `knowledge_documents` 
ADD INDEX `idx_knowledge_docs_title` (`title`(100)),
ADD INDEX `idx_knowledge_docs_content` (`content`(255));

-- 为 document_embeddings 表创建索引  
ALTER TABLE `document_embeddings`
ADD INDEX `idx_embeddings_content` (`chunk_content`(255));

-- 为 workflow_definitions 表创建索引
ALTER TABLE `workflow_definitions`
ADD INDEX `idx_workflows_name` (`name`);

-- 为 workflow_executions 表创建索引
ALTER TABLE `workflow_executions`
ADD INDEX `idx_executions_created` (`created_at`);

-- ==================== 初始数据 ====================

-- 基础业务表初始数据
INSERT INTO projects (name, description) VALUES 
('示例项目', '这是一个示例测试项目'),
('API测试项目', '用于API接口自动化测试');

INSERT INTO testcases (name, description, protocol, config, project_id) VALUES 
('用户登录接口', '测试用户登录功能', 'http', '{"url": "https://api.example.com/login", "method": "POST"}', 1),
('获取用户信息', '测试获取用户信息接口', 'http', '{"url": "https://api.example.com/user", "method": "GET"}', 1),
('TCP连接测试', '测试TCP连接功能', 'tcp', '{"host": "localhost", "port": 8080}', 2);

-- 规则配置系统初始数据
INSERT INTO rule_templates (name, category, protocol, description, is_enabled, priority) VALUES
('HTTP基础校验规则', 'correctness', 'http', '包含状态码检查、响应时间检查、响应结构检查', TRUE, 10),
('HTTP安全检查规则', 'security', 'http', '包含SQL注入、XSS等安全检查', TRUE, 8),
('TCP连接检查规则', 'correctness', 'tcp', 'TCP连接和数据传输检查', TRUE, 10),
('MQ消息检查规则', 'correctness', 'mq', '消息队列发送和接收检查', TRUE, 10);

-- 为HTTP基础校验规则添加规则定义
INSERT INTO rule_definitions (template_id, rule_type, rule_config, execution_order, is_required) VALUES
(1, 'status_code_check', '{"expected_codes": [200, 201], "error_codes": [400, 401, 403, 404, 500]}', 1, TRUE),
(1, 'response_time_check', '{"max_time_ms": 3000, "warning_time_ms": 1000}', 2, TRUE),
(1, 'response_structure_check', '{"required_fields": ["code", "message", "data"]}', 3, TRUE);

-- 为状态码检查添加断言规则
INSERT INTO assertion_rules (rule_definition_id, assertion_type, field_path, operator, expected_value, error_message) VALUES
(1, 'in_range', 'status_code', 'in_range', '[200, 299]', 'HTTP状态码应在2xx范围内'),
(2, 'less_than', 'response_time', '<', '3000', '响应时间不应超过3秒'),
(3, 'field_exists', 'code', 'exists', '', '响应必须包含code字段'),
(3, 'field_exists', 'message', 'exists', '', '响应必须包含message字段'),
(3, 'field_exists', 'data', 'exists', '', '响应必须包含data字段');

-- ==================== 验证查询 ====================

-- 验证规则模板配置
SELECT 
    rt.name AS template_name,
    rd.rule_type,
    ar.assertion_type,
    ar.field_path,
    ar.operator,
    ar.expected_value
FROM rule_templates rt
LEFT JOIN rule_definitions rd ON rt.id = rd.template_id
LEFT JOIN assertion_rules ar ON rd.id = ar.rule_definition_id
WHERE rt.id = 1;

-- 显示所有表
SHOW TABLES;

-- 显示数据库状态
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    DATA_LENGTH,
    INDEX_LENGTH,
    (DATA_LENGTH + INDEX_LENGTH) as TOTAL_SIZE
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'test_system'
ORDER BY TOTAL_SIZE DESC;