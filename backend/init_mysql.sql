-- 投石问路 MySQL 数据库初始化脚本

-- 创建数据库
CREATE DATABASE IF NOT EXISTS test_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE test_system;

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

-- 插入示例数据
INSERT INTO projects (name, description) VALUES 
('示例项目', '这是一个示例测试项目'),
('API测试项目', '用于API接口自动化测试');

INSERT INTO testcases (name, description, protocol, config, project_id) VALUES 
('用户登录接口', '测试用户登录功能', 'http', '{"url": "https://api.example.com/login", "method": "POST"}', 1),
('获取用户信息', '测试获取用户信息接口', 'http', '{"url": "https://api.example.com/user", "method": "GET"}', 1),
('TCP连接测试', '测试TCP连接功能', 'tcp', '{"host": "localhost", "port": 8080}', 2);