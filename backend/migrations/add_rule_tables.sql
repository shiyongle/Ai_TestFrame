-- 规则配置系统数据库表创建脚本

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

-- 插入示例规则模板
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

-- 查询验证
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
