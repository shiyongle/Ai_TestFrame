-- 投石问路 MySQL 数据库初始化脚本
-- 版本: v2.6.0+
-- 更新时间: 2026-04-07
-- 说明: 根据当前 [`backend/models/database_models.py`](backend/models/database_models.py) 汇总的完整初始化 DDL 与基础数据

CREATE DATABASE IF NOT EXISTS test_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE test_system;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ==================== 基础配置表 ====================

CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(50) NOT NULL DEFAULT 'user',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_users_username` (`username`),
    KEY `ix_users_id` (`id`),
    KEY `ix_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

CREATE TABLE IF NOT EXISTS `system_settings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` TEXT NULL,
    `category` VARCHAR(50) DEFAULT 'llm',
    `description` VARCHAR(255) NULL,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_system_settings_key` (`setting_key`),
    KEY `ix_system_settings_id` (`id`),
    KEY `ix_system_settings_setting_key` (`setting_key`),
    KEY `ix_system_settings_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统设置表';

-- ==================== 基础业务表 ====================

CREATE TABLE IF NOT EXISTS `projects` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `ix_projects_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目表';

CREATE TABLE IF NOT EXISTS `knowledge_documents` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `doc_id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `source` VARCHAR(200) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `doc_metadata` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_knowledge_documents_doc_id` (`doc_id`),
    KEY `ix_knowledge_documents_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识文档表';

CREATE TABLE IF NOT EXISTS `versions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `version_number` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `changes` JSON NULL,
    `status` VARCHAR(20) DEFAULT 'draft',
    `release_date` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `created_by` VARCHAR(100) NULL,
    `project_id` INT NULL,
    KEY `ix_versions_id` (`id`),
    CONSTRAINT `fk_versions_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='版本管理表';

CREATE TABLE IF NOT EXISTS `requirements` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `priority` VARCHAR(20) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `type` VARCHAR(20) NOT NULL DEFAULT 'functional',
    `project_id` INT NOT NULL,
    `assigned_to` VARCHAR(100) NULL,
    `reporter` VARCHAR(100) NULL,
    `due_date` DATETIME NULL,
    `estimated_hours` INT NULL,
    `actual_hours` INT NULL,
    `acceptance_criteria` TEXT NULL,
    `business_value` TEXT NULL,
    `tags` JSON NULL,
    `attachments` JSON NULL,
    `comments` JSON NULL,
    `linked_test_cases` JSON NULL,
    `linked_functional_test_cases` INT DEFAULT 0,
    `linked_interface_test_cases` INT DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `ix_requirements_id` (`id`),
    CONSTRAINT `fk_requirements_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='需求管理表';

CREATE TABLE IF NOT EXISTS `testcases` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `protocol` VARCHAR(20) NOT NULL,
    `config` JSON NULL,
    `project_id` INT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `ix_testcases_id` (`id`),
    CONSTRAINT `fk_testcases_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='功能测试用例表';

CREATE TABLE IF NOT EXISTS `interface_testcases` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `protocol` VARCHAR(20) NOT NULL DEFAULT 'http',
    `method` VARCHAR(10) NOT NULL DEFAULT 'GET',
    `url` TEXT NULL,
    `headers` JSON NULL,
    `params` JSON NULL,
    `body` TEXT NULL,
    `assertions` TEXT NULL,
    `preconditions` TEXT NULL,
    `test_data` TEXT NULL,
    `notes` TEXT NULL,
    `module` VARCHAR(100) NULL,
    `priority` VARCHAR(20) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `last_run_status` VARCHAR(10) NULL,
    `last_run_time` DATETIME NULL,
    `project_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `ix_interface_testcases_id` (`id`),
    CONSTRAINT `fk_interface_testcases_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='接口测试用例表';

CREATE TABLE IF NOT EXISTS `test_suites` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `project_id` INT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `ix_test_suites_id` (`id`),
    CONSTRAINT `fk_test_suites_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测试用例集表';

CREATE TABLE IF NOT EXISTS `test_suite_cases` (
    `suite_id` INT NOT NULL,
    `testcase_id` INT NOT NULL,
    `order_index` INT DEFAULT 0,
    PRIMARY KEY (`suite_id`, `testcase_id`),
    CONSTRAINT `fk_test_suite_cases_suite_id` FOREIGN KEY (`suite_id`) REFERENCES `test_suites` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `fk_test_suite_cases_testcase_id` FOREIGN KEY (`testcase_id`) REFERENCES `testcases` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测试用例集与功能用例关联表';

CREATE TABLE IF NOT EXISTS `test_plans` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `project_id` INT NOT NULL,
    `owner` VARCHAR(100) NULL,
    `status` VARCHAR(20) DEFAULT 'draft',
    `execution_mode` VARCHAR(20) DEFAULT 'serial',
    `priority` VARCHAR(20) DEFAULT 'medium',
    `entry_criteria` TEXT NULL,
    `exit_criteria` TEXT NULL,
    `schedule` VARCHAR(100) NULL,
    `tags` JSON NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `last_executed_at` DATETIME NULL,
    KEY `ix_test_plans_id` (`id`),
    CONSTRAINT `fk_test_plans_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测试计划表';

CREATE TABLE IF NOT EXISTS `test_plan_functional_cases` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `test_plan_id` INT NOT NULL,
    `testcase_id` INT NOT NULL,
    `order_index` INT DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_test_plan_functional_cases_id` (`id`),
    CONSTRAINT `fk_test_plan_functional_cases_plan_id` FOREIGN KEY (`test_plan_id`) REFERENCES `test_plans` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `fk_test_plan_functional_cases_testcase_id` FOREIGN KEY (`testcase_id`) REFERENCES `testcases` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测试计划关联功能用例';

CREATE TABLE IF NOT EXISTS `test_plan_interface_cases` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `test_plan_id` INT NOT NULL,
    `interface_testcase_id` INT NOT NULL,
    `order_index` INT DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_test_plan_interface_cases_id` (`id`),
    CONSTRAINT `fk_test_plan_interface_cases_plan_id` FOREIGN KEY (`test_plan_id`) REFERENCES `test_plans` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `fk_test_plan_interface_cases_case_id` FOREIGN KEY (`interface_testcase_id`) REFERENCES `interface_testcases` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测试计划关联接口用例';

CREATE TABLE IF NOT EXISTS `test_plan_executions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `test_plan_id` INT NOT NULL,
    `status` VARCHAR(20) DEFAULT 'running',
    `total_items` INT DEFAULT 0,
    `passed_items` INT DEFAULT 0,
    `failed_items` INT DEFAULT 0,
    `error_items` INT DEFAULT 0,
    `skipped_items` INT DEFAULT 0,
    `summary` JSON NULL,
    `started_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `completed_at` DATETIME NULL,
    KEY `ix_test_plan_executions_id` (`id`),
    CONSTRAINT `fk_test_plan_executions_plan_id` FOREIGN KEY (`test_plan_id`) REFERENCES `test_plans` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测试计划执行记录';

CREATE TABLE IF NOT EXISTS `test_results` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `testcase_id` INT NULL,
    `status` VARCHAR(20) NOT NULL,
    `response_data` JSON NULL,
    `execution_time` INT NULL,
    `error_message` TEXT NULL,
    `executed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_test_results_id` (`id`),
    CONSTRAINT `fk_test_results_testcase_id` FOREIGN KEY (`testcase_id`) REFERENCES `testcases` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测试结果表';

CREATE TABLE IF NOT EXISTS `version_requirements` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `version_id` INT NOT NULL,
    `requirement_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_version_requirements_id` (`id`),
    CONSTRAINT `fk_version_requirements_version_id` FOREIGN KEY (`version_id`) REFERENCES `versions` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `fk_version_requirements_requirement_id` FOREIGN KEY (`requirement_id`) REFERENCES `requirements` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='版本需求关联表';

CREATE TABLE IF NOT EXISTS `version_knowledge` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `version_id` INT NOT NULL,
    `knowledge_doc_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_version_knowledge_id` (`id`),
    CONSTRAINT `fk_version_knowledge_version_id` FOREIGN KEY (`version_id`) REFERENCES `versions` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `fk_version_knowledge_doc_id` FOREIGN KEY (`knowledge_doc_id`) REFERENCES `knowledge_documents` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='版本与知识库关联表';

CREATE TABLE IF NOT EXISTS `ai_generation_sessions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `session_id` VARCHAR(64) NOT NULL,
    `version_id` INT NOT NULL,
    `project_id` INT NOT NULL,
    `model` VARCHAR(50) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `total_requirements` INT DEFAULT 0,
    `total_generated_cases` INT DEFAULT 0,
    `total_hit_cases` INT DEFAULT 0,
    `total_citations` INT DEFAULT 0,
    `explicit_doc_count` INT DEFAULT 0,
    `knowledge_hit_rate` FLOAT DEFAULT 0,
    `summary` JSON NULL,
    `error_message` TEXT NULL,
    `started_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `completed_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_ai_generation_sessions_session_id` (`session_id`),
    KEY `ix_ai_generation_sessions_id` (`id`),
    KEY `ix_ai_generation_sessions_session_id` (`session_id`),
    CONSTRAINT `fk_ai_generation_sessions_version_id` FOREIGN KEY (`version_id`) REFERENCES `versions` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `fk_ai_generation_sessions_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI生成会话表';

CREATE TABLE IF NOT EXISTS `ai_generated_case_evidence` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `session_id` INT NOT NULL,
    `testcase_id` INT NULL,
    `requirement_id` INT NOT NULL,
    `case_index` INT DEFAULT 0,
    `case_title` VARCHAR(255) NOT NULL,
    `used_explicit_context` TINYINT(1) DEFAULT 0,
    `used_rag` TINYINT(1) DEFAULT 0,
    `knowledge_hit_count` INT DEFAULT 0,
    `citation_count` INT DEFAULT 0,
    `hit_score` FLOAT DEFAULT 0,
    `evidence_summary` TEXT NULL,
    `raw_case` JSON NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `ix_ai_generated_case_evidence_id` (`id`),
    CONSTRAINT `fk_ai_generated_case_evidence_session_id` FOREIGN KEY (`session_id`) REFERENCES `ai_generation_sessions` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `fk_ai_generated_case_evidence_testcase_id` FOREIGN KEY (`testcase_id`) REFERENCES `testcases` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `fk_ai_generated_case_evidence_requirement_id` FOREIGN KEY (`requirement_id`) REFERENCES `requirements` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI生成用例证据表';

CREATE TABLE IF NOT EXISTS `ai_generated_case_citations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `session_id` INT NOT NULL,
    `generated_case_id` INT NOT NULL,
    `knowledge_doc_id` INT NULL,
    `requirement_id` INT NOT NULL,
    `source_type` VARCHAR(30) NOT NULL DEFAULT 'explicit',
    `evidence_type` VARCHAR(30) NOT NULL DEFAULT 'document',
    `chunk_id` VARCHAR(100) NULL,
    `chunk_index` INT NULL,
    `doc_title` VARCHAR(500) NULL,
    `matched_text` TEXT NULL,
    `quote_text` TEXT NULL,
    `similarity_score` FLOAT DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `ix_ai_generated_case_citations_id` (`id`),
    CONSTRAINT `fk_ai_generated_case_citations_session_id` FOREIGN KEY (`session_id`) REFERENCES `ai_generation_sessions` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `fk_ai_generated_case_citations_generated_case_id` FOREIGN KEY (`generated_case_id`) REFERENCES `ai_generated_case_evidence` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `fk_ai_generated_case_citations_doc_id` FOREIGN KEY (`knowledge_doc_id`) REFERENCES `knowledge_documents` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `fk_ai_generated_case_citations_requirement_id` FOREIGN KEY (`requirement_id`) REFERENCES `requirements` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI生成用例引用明细表';

CREATE TABLE IF NOT EXISTS `test_reports` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `version_id` INT NULL,
    `project_id` INT NULL,
    `total_tests` INT DEFAULT 0,
    `passed_tests` INT DEFAULT 0,
    `failed_tests` INT DEFAULT 0,
    `error_tests` INT DEFAULT 0,
    `summary` JSON NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_test_reports_id` (`id`),
    CONSTRAINT `fk_test_reports_version_id` FOREIGN KEY (`version_id`) REFERENCES `versions` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `fk_test_reports_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测试报告表';

CREATE TABLE IF NOT EXISTS `test_data` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `data_type` VARCHAR(50) NULL,
    `content` JSON NULL,
    `project_id` INT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `ix_test_data_id` (`id`),
    CONSTRAINT `fk_test_data_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测试数据表';

CREATE TABLE IF NOT EXISTS `batch_test_tasks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `task_id` VARCHAR(50) NOT NULL,
    `project_id` INT NULL,
    `testcase_ids` TEXT NULL,
    `status` VARCHAR(20) DEFAULT 'pending',
    `total_tests` INT DEFAULT 0,
    `passed_tests` INT DEFAULT 0,
    `failed_tests` INT DEFAULT 0,
    `error_tests` INT DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `completed_at` DATETIME NULL,
    UNIQUE KEY `uk_batch_test_tasks_task_id` (`task_id`),
    KEY `ix_batch_test_tasks_id` (`id`),
    CONSTRAINT `fk_batch_test_tasks_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='批量测试任务表';

-- ==================== 规则配置系统表 ====================

CREATE TABLE IF NOT EXISTS `rule_templates` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `protocol` VARCHAR(20) NOT NULL,
    `description` TEXT NULL,
    `is_enabled` TINYINT(1) DEFAULT 1,
    `priority` INT DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `ix_rule_templates_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='规则模板表';

CREATE TABLE IF NOT EXISTS `rule_definitions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `template_id` INT NOT NULL,
    `rule_type` VARCHAR(50) NOT NULL,
    `rule_config` JSON NULL,
    `execution_order` INT DEFAULT 0,
    `is_required` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_rule_definitions_id` (`id`),
    CONSTRAINT `fk_rule_definitions_template_id` FOREIGN KEY (`template_id`) REFERENCES `rule_templates` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='规则定义表';

CREATE TABLE IF NOT EXISTS `assertion_rules` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `rule_definition_id` INT NOT NULL,
    `assertion_type` VARCHAR(50) NOT NULL,
    `field_path` VARCHAR(200) NULL,
    `operator` VARCHAR(20) NULL,
    `expected_value` TEXT NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_assertion_rules_id` (`id`),
    CONSTRAINT `fk_assertion_rules_rule_definition_id` FOREIGN KEY (`rule_definition_id`) REFERENCES `rule_definitions` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='断言规则表';

CREATE TABLE IF NOT EXISTS `testcase_rules` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `testcase_id` INT NOT NULL,
    `rule_template_id` INT NOT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `custom_config` JSON NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_testcase_rules_id` (`id`),
    CONSTRAINT `fk_testcase_rules_testcase_id` FOREIGN KEY (`testcase_id`) REFERENCES `testcases` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `fk_testcase_rules_rule_template_id` FOREIGN KEY (`rule_template_id`) REFERENCES `rule_templates` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测试用例规则关联表';

CREATE TABLE IF NOT EXISTS `activity_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user` VARCHAR(100) NOT NULL DEFAULT '管理员',
    `action` VARCHAR(50) NOT NULL,
    `module` VARCHAR(50) NOT NULL,
    `target_name` VARCHAR(200) NOT NULL,
    `detail` TEXT NULL,
    `status` VARCHAR(20) DEFAULT 'success',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_activity_logs_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- ==================== UI 自动化表 ====================

CREATE TABLE IF NOT EXISTS `ui_automation_cases` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `project_id` INT NULL,
    `target_url` VARCHAR(500) NOT NULL,
    `auth_scheme` VARCHAR(30) NOT NULL DEFAULT 'none',
    `auth_payload` JSON NULL,
    `natural_language_steps` JSON NULL,
    `assertions` JSON NULL,
    `tags` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `debug_mode` TINYINT(1) NOT NULL DEFAULT 0,
    `last_run_status` VARCHAR(20) NULL,
    `last_run_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `ix_ui_automation_cases_id` (`id`),
    KEY `ix_ui_automation_cases_project_id` (`project_id`),
    CONSTRAINT `fk_ui_automation_cases_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='UI自动化用例表';

CREATE TABLE IF NOT EXISTS `ui_automation_tasks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `task_no` VARCHAR(40) NOT NULL,
    `case_id` INT NULL,
    `name` VARCHAR(120) NOT NULL,
    `target_url` VARCHAR(500) NOT NULL,
    `auth_scheme` VARCHAR(30) NOT NULL DEFAULT 'none',
    `auth_payload` JSON NULL,
    `natural_language_steps` JSON NULL,
    `assertions` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `progress` INT NOT NULL DEFAULT 0,
    `executor` VARCHAR(30) NOT NULL DEFAULT 'browser_use',
    `debug_mode` TINYINT(1) NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `playwright_script` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `started_at` DATETIME NULL,
    `finished_at` DATETIME NULL,
    UNIQUE KEY `uk_ui_automation_tasks_task_no` (`task_no`),
    KEY `ix_ui_automation_tasks_id` (`id`),
    KEY `ix_ui_automation_tasks_task_no` (`task_no`),
    KEY `ix_ui_automation_tasks_case_id` (`case_id`),
    CONSTRAINT `fk_ui_automation_tasks_case_id` FOREIGN KEY (`case_id`) REFERENCES `ui_automation_cases` (`id`)
        ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='UI自动化任务表';

CREATE TABLE IF NOT EXISTS `ui_automation_step_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `task_id` INT NOT NULL,
    `step_index` INT NOT NULL,
    `step_title` VARCHAR(255) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `detail` TEXT NULL,
    `started_at` DATETIME NULL,
    `finished_at` DATETIME NULL,
    KEY `ix_ui_automation_step_logs_id` (`id`),
    KEY `ix_ui_automation_step_logs_task_id` (`task_id`),
    CONSTRAINT `fk_ui_automation_step_logs_task_id` FOREIGN KEY (`task_id`) REFERENCES `ui_automation_tasks` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='UI自动化步骤日志';

CREATE TABLE IF NOT EXISTS `ui_automation_artifacts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `task_id` INT NOT NULL,
    `artifact_type` VARCHAR(30) NOT NULL,
    `artifact_name` VARCHAR(200) NOT NULL,
    `artifact_path` VARCHAR(500) NULL,
    `artifact_content` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_ui_automation_artifacts_id` (`id`),
    KEY `ix_ui_automation_artifacts_task_id` (`task_id`),
    CONSTRAINT `fk_ui_automation_artifacts_task_id` FOREIGN KEY (`task_id`) REFERENCES `ui_automation_tasks` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='UI自动化产物表';

-- ==================== 性能测试表 ====================

CREATE TABLE IF NOT EXISTS `performance_scenarios` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `project_id` INT NULL,
    `protocol` VARCHAR(20) NOT NULL DEFAULT 'http',
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `tags` JSON NULL,
    `target_config` JSON NULL,
    `steps` JSON NULL,
    `variables` JSON NULL,
    `environment_config` JSON NULL,
    `load_profile` JSON NULL,
    `assertions` JSON NULL,
    `runtime_options` JSON NULL,
    `last_run_status` VARCHAR(20) NULL,
    `last_run_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `ix_performance_scenarios_id` (`id`),
    KEY `ix_performance_scenarios_project_id` (`project_id`),
    CONSTRAINT `fk_performance_scenarios_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='性能测试场景表';

CREATE TABLE IF NOT EXISTS `performance_test_runs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `run_no` VARCHAR(40) NOT NULL,
    `scenario_id` INT NOT NULL,
    `scenario_name` VARCHAR(150) NOT NULL,
    `protocol` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `stage` VARCHAR(30) NOT NULL DEFAULT 'created',
    `trigger_source` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `load_profile` JSON NULL,
    `target_config` JSON NULL,
    `scenario_snapshot` JSON NULL,
    `step_summary` JSON NULL,
    `engine_metadata` JSON NULL,
    `runtime_options` JSON NULL,
    `assertions` JSON NULL,
    `current_users` INT NOT NULL DEFAULT 0,
    `target_users` INT NOT NULL DEFAULT 0,
    `spawn_rate` DOUBLE NOT NULL DEFAULT 1,
    `duration_seconds` INT NOT NULL DEFAULT 0,
    `progress` INT NOT NULL DEFAULT 0,
    `current_rps` DOUBLE NOT NULL DEFAULT 0,
    `avg_response_time` DOUBLE NOT NULL DEFAULT 0,
    `p95_response_time` DOUBLE NOT NULL DEFAULT 0,
    `p99_response_time` DOUBLE NOT NULL DEFAULT 0,
    `error_rate` DOUBLE NOT NULL DEFAULT 0,
    `worker_count` INT NOT NULL DEFAULT 1,
    `summary` JSON NULL,
    `error_message` TEXT NULL,
    `started_at` DATETIME NULL,
    `finished_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_performance_test_runs_run_no` (`run_no`),
    KEY `ix_performance_test_runs_id` (`id`),
    KEY `ix_performance_test_runs_run_no` (`run_no`),
    KEY `ix_performance_test_runs_scenario_id` (`scenario_id`),
    CONSTRAINT `fk_performance_test_runs_scenario_id` FOREIGN KEY (`scenario_id`) REFERENCES `performance_scenarios` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='性能测试运行记录表';

CREATE TABLE IF NOT EXISTS `performance_metric_points` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `run_id` INT NOT NULL,
    `timestamp_offset` INT NOT NULL DEFAULT 0,
    `active_users` INT NOT NULL DEFAULT 0,
    `current_rps` DOUBLE NOT NULL DEFAULT 0,
    `avg_response_time` DOUBLE NOT NULL DEFAULT 0,
    `p95_response_time` DOUBLE NOT NULL DEFAULT 0,
    `p99_response_time` DOUBLE NOT NULL DEFAULT 0,
    `error_rate` DOUBLE NOT NULL DEFAULT 0,
    `total_requests` INT NOT NULL DEFAULT 0,
    `total_failures` INT NOT NULL DEFAULT 0,
    `cpu_usage` DOUBLE NULL,
    `memory_usage` DOUBLE NULL,
    `worker_count` INT NOT NULL DEFAULT 1,
    `spawned_users` INT NOT NULL DEFAULT 0,
    `raw_data` JSON NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_performance_metric_points_id` (`id`),
    KEY `ix_performance_metric_points_run_id` (`run_id`),
    CONSTRAINT `fk_performance_metric_points_run_id` FOREIGN KEY (`run_id`) REFERENCES `performance_test_runs` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='性能测试指标时序表';

CREATE TABLE IF NOT EXISTS `performance_run_events` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `run_id` INT NOT NULL,
    `stage` VARCHAR(30) NOT NULL,
    `level` VARCHAR(20) NOT NULL DEFAULT 'info',
    `message` VARCHAR(500) NOT NULL,
    `payload` JSON NULL,
    `event_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `ix_performance_run_events_id` (`id`),
    KEY `ix_performance_run_events_run_id` (`run_id`),
    CONSTRAINT `fk_performance_run_events_run_id` FOREIGN KEY (`run_id`) REFERENCES `performance_test_runs` (`id`)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='性能测试事件表';

SET FOREIGN_KEY_CHECKS = 1;

-- ==================== 基础初始化数据 ====================

INSERT INTO `projects` (`name`, `description`) VALUES
('示例项目', '这是一个示例测试项目'),
('API测试项目', '用于API接口自动化测试');

INSERT INTO `testcases` (`name`, `description`, `protocol`, `config`, `project_id`) VALUES
('用户登录接口', '测试用户登录功能', 'http', '{"url": "https://api.example.com/login", "method": "POST"}', 1),
('获取用户信息', '测试获取用户信息接口', 'http', '{"url": "https://api.example.com/user", "method": "GET"}', 1),
('TCP连接测试', '测试TCP连接功能', 'tcp', '{"host": "localhost", "port": 8080}', 2);

INSERT INTO `rule_templates` (`name`, `category`, `protocol`, `description`, `is_enabled`, `priority`) VALUES
('HTTP基础校验规则', 'correctness', 'http', '包含状态码检查、响应时间检查、响应结构检查', TRUE, 10),
('HTTP安全检查规则', 'security', 'http', '包含SQL注入、XSS等安全检查', TRUE, 8),
('TCP连接检查规则', 'correctness', 'tcp', 'TCP连接和数据传输检查', TRUE, 10),
('MQ消息检查规则', 'correctness', 'mq', '消息队列发送和接收检查', TRUE, 10);

INSERT INTO `rule_definitions` (`template_id`, `rule_type`, `rule_config`, `execution_order`, `is_required`) VALUES
(1, 'status_code_check', '{"expected_codes": [200, 201], "error_codes": [400, 401, 403, 404, 500]}', 1, TRUE),
(1, 'response_time_check', '{"max_time_ms": 3000, "warning_time_ms": 1000}', 2, TRUE),
(1, 'response_structure_check', '{"required_fields": ["code", "message", "data"]}', 3, TRUE);

INSERT INTO `assertion_rules` (`rule_definition_id`, `assertion_type`, `field_path`, `operator`, `expected_value`, `error_message`) VALUES
(1, 'in_range', 'status_code', 'in_range', '[200, 299]', 'HTTP状态码应在2xx范围内'),
(2, 'less_than', 'response_time', '<', '3000', '响应时间不应超过3秒'),
(3, 'field_exists', 'code', 'exists', '', '响应必须包含code字段'),
(3, 'field_exists', 'message', 'exists', '', '响应必须包含message字段'),
(3, 'field_exists', 'data', 'exists', '', '响应必须包含data字段');

-- ==================== 验证查询 ====================

SELECT
    rt.name AS template_name,
    rd.rule_type,
    ar.assertion_type,
    ar.field_path,
    ar.operator,
    ar.expected_value
FROM `rule_templates` rt
LEFT JOIN `rule_definitions` rd ON rt.id = rd.template_id
LEFT JOIN `assertion_rules` ar ON rd.id = ar.rule_definition_id
WHERE rt.id = 1;

SHOW TABLES;

SELECT
    TABLE_NAME,
    TABLE_ROWS,
    DATA_LENGTH,
    INDEX_LENGTH,
    (DATA_LENGTH + INDEX_LENGTH) AS TOTAL_SIZE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'test_system'
ORDER BY TOTAL_SIZE DESC;
