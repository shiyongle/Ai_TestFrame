# 投石问路

一个开源的前后端分离的智能化测试平台，支持多种协议的自动化测试，集成AI能力提升测试效率。

## 功能特性

### 核心功能
- **项目管理**：创建和管理测试项目，项目配置和描述
- **需求管理**：需求全生命周期管理，支持7个状态流转
- **测试用例管理**：支持HTTP、TCP、MQ协议的测试用例
- **接口测试**：HTTP、TCP、MQ等多种协议接口测试
- **版本管理**：版本与需求关联，支持版本发布流程
- **测试报告**：详细的测试执行报告和统计分析

### 高级功能
- **规则配置系统**：可视化规则编辑器，自动生成测试用例
- **AI智能化**：集成大模型API，智能测试用例生成和结果分析
- **RAG知识库**：文档检索、向量化存储和知识增强
- **工作流引擎**：工作流编排、任务调度和流程自动化
- **工具箱**：ID生成器、手机号生成器等实用工具

### 测试支持
- **HTTP接口测试**：支持所有HTTP方法，自定义Headers、Params、Body
- **TCP接口测试**：TCP连接测试，数据发送和接收
- **MQ接口测试**：RabbitMQ消息队列测试
- **批量测试**：支持批量测试执行
- **断言验证**：多种断言类型，字段路径支持

## 技术栈

### 后端
- FastAPI (Python)
- SQLAlchemy (ORM)
- MySQL 5.7+/8.0+
- python-dotenv (配置管理)
- colorlog (彩色日志)
- PyMySQL (数据库驱动)
- aiohttp (异步HTTP客户端)
- pika (RabbitMQ客户端)
- **AI集成**：OpenAI、智谱GLM、通义千问、DeepSeek
- **RAG引擎**：numpy、scikit-learn、jieba
- **工作流引擎**：异步任务处理

### 前端
- React 18 + TypeScript
- Ant Design
- Axios
- React Router
- **可视化组件**：Transfer、Collapse、Drawer等

## 项目结构

```
- Ai_TestFrame/
├── backend/                 # 后端服务
│   ├── main.py             # FastAPI应用入口
│   ├── config/             # 配置模块
│   │   └── settings.py     # 应用配置（含AI配置）
│   ├── core/               # 核心模块
│   │   ├── database.py     # 数据库配置
│   │   ├── logging.py      # 日志配置
│   │   └── security.py     # 安全配置
│   ├── api/                # API路由模块
│   │   ├── deps.py         # 依赖注入
│   │   └── v1/             # API v1版本
│   │       ├── projects.py # 项目管理API
│   │       ├── testcases.py # 测试用例API
│   │       ├── tests.py    # 测试执行API
│   │       ├── versions.py # 版本管理API
│   │       ├── requirements.py # 需求管理API
│   │       ├── rules.py    # 规则配置API
│   │       └── ai.py       # AI功能API
│   ├── services/           # 业务服务层
│   │   ├── project_service.py
│   │   ├── testcase_service.py
│   │   ├── test_execution_service.py
│   │   ├── version_service.py
│   │   ├── rule_engine_service.py # 规则引擎
│   │   ├── ai_generator.py # AI生成器
│   │   └── ai/            # AI服务模块
│   │       ├── ai_service.py # AI服务统一接口
│   │       ├── llm_client.py # 大模型客户端
│   │       ├── rag_engine.py # RAG引擎
│   │       └── workflow_engine.py # 工作流引擎
│   ├── utils/              # 工具类
│   │   ├── http_client.py  # HTTP请求工具
│   │   ├── tcp_client.py   # TCP通信工具
│   │   └── mq_client.py    # 消息队列工具
│   ├── models/             # 数据模型
│   │   └── database_models.py
│   ├── schemas/            # 数据验证模式
│   │   └── response_schemas.py
│   ├── .env                # 环境变量配置
│   ├── init_mysql.sql      # 数据库初始化脚本
│   └── requirements.txt    # Python依赖
├── frontend/               # 前端界面
│   ├── src/
│   │   ├── components/     # React组件
│   │   │   └── Layout/     # 布局组件
│   │   ├── pages/         # 页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Projects.tsx
│   │   │   ├── Requirements.tsx # 需求管理
│   │   │   ├── TestCases/
│   │   │   ├── RuleConfig.tsx # 规则配置
│   │   │   ├── ApiAutomation/
│   │   │   └── Tools/      # 工具箱
│   │   ├── services/      # API服务
│   │   └── types/         # TypeScript类型
│   ├── public/
│   └── package.json       # Node.js依赖
├── docs/                  # 文档
│   └── 开发文档.md         # 开发文档
├── versions/              # 版本记录
├── docker-compose.yml     # Docker配置
└── README.md
```

## 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- MySQL 5.7+ / 8.0+
- (可选) Docker & Docker Compose

### 环境变量配置

创建 `backend/.env` 文件：
```bash
# 数据库配置
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=test_system

# AI服务配置（可选）
GLM_API_KEY=your_glm_api_key
OPENAI_API_KEY=your_openai_api_key
TONGYI_API_KEY=your_tongyi_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
```

### 后端启动
```bash
# 1. 进入后端目录
cd backend

# 2. 创建虚拟环境
python -m venv .venv

# 3. 激活虚拟环境
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

# 4. 安装依赖
pip install -r requirements.txt

# 5. 初始化数据库
mysql -u root -p < init_mysql.sql

# 6. 启动服务
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 前端启动
```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm start
```

### Docker部署
```bash
# 使用Docker Compose一键启动
docker-compose up -d
```

### 一键启动 (Windows)
```bash
# 运行根目录下的启动脚本
start.bat
```

## 访问地址
- 前端界面: http://localhost:3000
- 后端API: http://localhost:8000
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## 主要功能模块

### 1. 项目管理
- 创建和管理测试项目
- 项目配置和描述
- 项目级别的测试用例组织

### 2. 需求管理
- 需求全生命周期管理（草稿、审核中、已批准、开发中、测试中、已完成、已拒绝）
- 需求与项目关联
- 需求与测试用例关联
- 需求状态流转和跟踪

### 3. 测试用例管理
- 支持HTTP、TCP、MQ协议
- 功能测试用例和接口测试用例分类
- 测试用例的创建、编辑、删除
- 测试配置的灵活设置

### 4. 规则配置系统
- 可视化规则编辑器
- 自动生成正向、负向、边界值测试用例
- 灵活的断言配置系统
- 规则模板管理
- 规则分类（正确性、安全性、性能、兼容性）

### 5. AI智能化功能
- 大模型API集成（OpenAI、智谱GLM、通义千问、DeepSeek等）
- 智能测试用例生成
- 测试结果分析
- 智能报告生成
- RAG知识库检索

### 6. 版本管理
- 版本与需求关联
- 版本状态管理（草稿、已发布、已归档）
- 需求二次汇总功能
- 版本发布流程

### 7. 接口测试
- HTTP接口测试：支持所有HTTP方法，自定义Headers、Params、Body
- TCP接口测试：TCP连接测试，数据发送和接收
- MQ接口测试：RabbitMQ消息队列测试
- 批量测试执行

### 8. 测试报告
- 详细的测试执行报告
- 成功率统计
- 错误信息记录
- 可视化图表展示

### 9. 工具箱
- ID生成器
- 手机号生成器
- 其他实用工具

## API接口

### 项目管理
- `GET /api/v1/projects` - 获取项目列表
- `POST /api/v1/projects` - 创建项目
- `GET /api/v1/projects/{id}` - 获取项目详情

### 需求管理
- `GET /api/v1/requirements` - 获取需求列表
- `POST /api/v1/requirements` - 创建需求
- `PUT /api/v1/requirements/{id}` - 更新需求

### 测试用例
- `GET /api/v1/projects/{project_id}/testcases` - 获取测试用例
- `POST /api/v1/projects/{project_id}/testcases` - 创建测试用例

### 测试执行
- `POST /api/v1/test/http` - 执行HTTP测试
- `POST /api/v1/test/tcp` - 执行TCP测试
- `POST /api/v1/test/mq` - 执行MQ测试
- `POST /api/v1/test/batch` - 执行批量测试

### 规则配置
- `GET /api/v1/rules/templates` - 获取规则模板列表
- `POST /api/v1/rules/templates` - 创建规则模板
- `POST /api/v1/rules/generate-testcases` - 根据规则生成测试用例

### AI功能
- `POST /api/v1/ai/generate-test-case` - 智能生成测试用例
- `POST /api/v1/ai/analyze-test-results` - 分析测试结果
- `POST /api/v1/ai/generate-test-report` - 生成测试报告

### 版本管理
- `GET /api/v1/versions` - 获取版本列表
- `POST /api/v1/versions` - 创建版本记录

## 开发指南

### 数据库迁移
```bash
# 执行数据库迁移脚本
mysql -u root -p test_system < backend/migrations/add_rule_tables.sql
mysql -u root -p test_system < backend/migrations/add_ai_tables.sql
```

### 日志管理
- 应用日志：`backend/backend.log`
- 请求日志：`backend/requests.log`
- SQL日志：`backend/sql.log`

### 贡献指南
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 更新日志

### v2.1.0 (2025-12-23)
- 集成大模型API统一接口
- 实现RAG知识库引擎
- 添加Workflow工作流引擎
- 提供完整的AI功能API

### v2.0.0 (2025-12-18)
- 规则配置系统
- 可视化规则编辑器
- 自动生成测试用例
- 断言规则配置

### v1.9.0 (2025-12-09)
- 版本管理模块
- 版本与需求关联
- 需求二次汇总功能

### v1.8.0 (2025-12-08)
- 需求管理模块
- 需求全生命周期管理
- 需求与测试用例关联

### v1.1.0 (2025-12-03)
- 基础框架搭建
- 项目管理、测试用例管理
- HTTP接口测试功能
- TCP、MQ接口测试框架