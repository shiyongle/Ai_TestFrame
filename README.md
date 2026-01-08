# 投石问路

一个开源的前后端分离的智能化测试平台，支持多种协议的自动化测试。

## 功能特性

- 接口自动化测试（HTTP、TCP、MQ等）
- 移动端自动化测试
- Web自动化测试
- H5自动化测试
- 性能测试
- 持续集成支持
- 数据与脚本分离
- 版本管理和回溯

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

### 前端
- React 18 + TypeScript
- Ant Design
- Axios
- React Router

## 项目结构

```
- ToushiWenLu/
├── backend/                 # 后端服务
│   ├── main.py             # FastAPI应用入口
│   ├── config/             # 配置模块
│   │   └── settings.py     # 应用配置
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
│   │       └── versions.py # 版本管理API
│   ├── services/           # 业务服务层
│   │   ├── project_service.py
│   │   ├── testcase_service.py
│   │   ├── test_execution_service.py
│   │   └── version_service.py
│   ├── utils/              # 工具类
│   │   ├── http_client.py  # HTTP请求工具
│   │   ├── tcp_client.py   # TCP通信工具
│   │   └── mq_client.py    # 消息队列工具
│   ├── models/             # 数据模型
│   │   └── database_models.py
│   ├── schemas/            # 数据验证模式
│   │   └── response_schemas.py
│   ├── .env                # 环境变量配置
│   └── requirements.txt    # Python依赖
├── frontend/               # 前端界面
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API服务
│   │   └── types/         # TypeScript类型
│   └── package.json       # Node.js依赖
├── docs/                  # 文档
├── versions/              # 版本记录
└── README.md
```

## 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- MySQL 5.7+ / 8.0+

### 后端启动
```bash
# 1. 配置数据库
cd backend
cp .env .env
# 编辑 .env 文件，修改数据库连接信息

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
cd frontend
npm install
npm start
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

## 主要功能
- 项目管理：创建和管理测试项目
- 测试用例：支持HTTP、TCP、MQ协议的测试用例
- 测试执行：执行单个或批量测试
- 版本管理：测试用例版本控制和回溯
- 测试报告：详细的测试执行报告和统计