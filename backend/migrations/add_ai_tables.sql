-- AI接入层相关数据库表
-- 创建时间: 2025-12-23

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

-- 添加外键约束
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

-- 创建索引优化查询性能
-- 注意：MySQL不支持 CREATE INDEX IF NOT EXISTS，需要先检查索引是否存在

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