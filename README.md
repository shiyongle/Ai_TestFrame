# 卷心菜

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
- **AI集成**：OpenAI、智谱GLM、通义千问、DeepSeek、硅基流动
- **RAG引擎**：ChromaDB向量数据库、numpy、scikit-learn、jieba
- **工作流引擎**：异步任务处理、节点编排

### 前端
- React 18 + TypeScript
- Ant Design
- Axios
- React Router
- **可视化组件**：Transfer、Collapse、Drawer等

## AI生成用例架构设计

### 1. 整体架构概述

卷心菜测试平台采用**Agentic工作流 + RAG增强**的智能测试用例生成架构，通过5步智能生成流程实现从需求到测试用例的自动化转换。系统集成了多种大模型API，利用向量数据库实现知识增强，确保生成的测试用例具有高质量和全面性。

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI测试用例生成系统                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      用户输入层                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  需求描述    │  │  验收标准    │  │  历史上下文  │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Agentic工作流引擎（5步生成）                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Step 1   │  │ Step 2   │  │ Step 3   │  │ Step 4   │         │
│  │ 蓝图提取 │→│ 知识检索 │→│ 大纲生成 │→│ 用例扩散 │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│                                                           │      │
│                                                    ┌──────┴──┐ │
│                                                    │ Step 5  │ │
│                                                    │ 审计补全 │─┘
│                                                    └─────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    核心组件层                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   LLM客户端      │  │   RAG引擎        │  │ 工作流引擎   │  │
│  │  (多模型统一)    │  │  (ChromaDB)      │  │ (节点编排)   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    基础设施层                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ 向量数据库    │  │  MySQL数据库  │  │ 大模型API    │           │
│  │  ChromaDB    │  │  (文档元数据) │  │ (多提供商)   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 2. 核心组件详解

#### 2.1 LLM统一客户端（LLM Client）

**设计理念**：抽象统一的AI模型调用接口，支持多种大模型提供商，提供灵活的模型路由和回退机制。

**支持的大模型**：
- OpenAI（GPT系列）
- 智谱GLM（GLM-4系列）
- 阿里云通义千问（Qwen系列）
- DeepSeek（深度求索）
- 硅基流动（聚合平台）

**核心功能**：
```python
class LLMClient:
    - chat_completion()      # 聊天完成接口
    - text_completion()      # 文本完成接口
    - create_embedding()     # 向量化接口
    - get_available_providers()  # 获取可用提供商
    - test_connection()      # 连接测试
```

**技术亮点**：
- **统一的接口抽象**：所有模型提供商实现相同接口，便于切换和扩展
- **智能回退机制**：当主模型不支持某些功能（如Embedding）时，自动回退到备用模型
- **配置热更新**：支持运行时动态更新模型配置
- **错误处理**：完善的异常处理和降级策略

#### 2.2 RAG知识库引擎（RAG Engine）

**设计理念**：基于向量数据库的语义检索系统，为测试用例生成提供领域知识和历史经验支持。

**核心架构**：
```
┌─────────────────────────────────────────────────────────────┐
│                    RAG知识库引擎                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  文档添加    │───→│  文档分块    │───→│  向量化处理  │  │
│  │  add_document│    │  chunk_doc   │    │  embedding   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                     │       │
│                                                     ▼       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              ChromaDB向量数据库                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │  │
│  │  │  Collection: knowledge_base                       │  │
│  │  │  - ID: doc_xxx_chunk_y                           │  │
│  │  │  - Embedding: [0.1, 0.2, ...]                    │  │
│  │  │  - Metadata: {doc_id, chunk_index}               │  │
│  │  │  - Distance: cosine                               │  │
│  │  └──────────┘  └──────────┘  └──────────┘             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                     │       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  查询向量化  │───→│  语义检索    │───→│  上下文构建  │  │
│  │  query       │    │  search()    │    │  get_context │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**核心功能**：
```python
class RAGEngine:
    - add_document()         # 添加文档到知识库
    - search()               # 语义检索相关文档
    - get_context_for_query() # 为查询获取上下文
    - delete_document()      # 删除文档（包括向量）
    - get_categories()       # 获取文档分类
```

**技术亮点**：
- **ChromaDB集成**：使用专业向量数据库替代自研方案，性能提升显著
- **智能分块策略**：基于Markdown层级的文档分块，保持语义完整性
- **余弦相似度**：使用余弦距离进行语义匹配，提高检索准确性
- **混合检索**：结合向量检索和元数据过滤，提升召回率
- **异步处理**：文档向量化采用异步处理，不影响主流程

**向量存储方案**：
- **本地持久化**：ChromaDB数据存储在`backend/.chroma/`目录
- **元数据管理**：文档元数据（标题、分类、来源等）仍由MySQL管理
- **数据同步**：通过`doc_id`保持MySQL与ChromaDB的数据一致性

#### 2.3 工作流引擎（Workflow Engine）

**设计理念**：基于DAG（有向无环图）的工作流编排引擎，支持复杂的测试生成流程自动化。

**核心架构**：
```
┌─────────────────────────────────────────────────────────────┐
│                    工作流引擎架构                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │              工作流定义层                            │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │     │
│  │  │  START   │→ │   TASK   │→ │   END    │          │     │
│  │  └──────────┘  └──────────┘  └──────────┘          │     │
│  │                                                              │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │     │
│  │  │  DECISION│→ │ PARALLEL │→ │   WAIT   │          │     │
│  │  └──────────┘  └──────────┘  └──────────┘          │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                    │
│                           ▼                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │              任务执行层                              │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐  │     │
│  │  │  LLMTask     │  │  RAGTask     │  │ Decision│  │     │
│  │  │  大模型调用   │  │  知识检索    │  │  条件判断│  │     │
│  │  └──────────────┘  └──────────────┘  └─────────┘  │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                    │
│                           ▼                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │              上下文管理层                            │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐  │     │
│  │  │  变量存储    │  │  历史记录    │  │  状态   │  │     │
│  │  └──────────────┘  └──────────────┘  └─────────┘  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**核心功能**：
```python
class WorkflowEngine:
    - create_workflow()       # 创建工作流定义
    - execute_workflow()      # 执行工作流
    - get_execution_status()  # 获取执行状态
    - register_task()         # 注册自定义任务类型
```

**支持的节点类型**：
- **START**：开始节点
- **END**：结束节点
- **TASK**：任务节点（LLM调用、数据处理等）
- **DECISION**：决策节点（条件判断）
- **PARALLEL**：并行节点（并发执行）
- **WAIT**：等待节点（定时任务）

**技术亮点**：
- **可视化编排**：支持图形化的工作流设计
- **异步执行**：基于asyncio的异步任务执行
- **状态持久化**：工作流执行状态持久化到数据库
- **错误恢复**：支持工作流中断恢复和错误处理

### 3. 5步Agentic生成流程

#### 3.1 Step 1: 需求结构化解析与主链路提取

**目标**：从非结构化的需求描述中提取核心业务目标和主逻辑链路。

**实现逻辑**：
```python
async def _step1_extract_blueprint(requirement, provider, llm_client):
    prompt = f"""
    请作为专业的产品分析师，仔细阅读并分析以下产品需求。
    1. 提取出该需求的核心业务目标
    2. 提取出该需求的主逻辑链路（Happy Path），将其分步骤概括
    3. 指出该需求涉及的主要功能模块
    
    必须返回如下格式的纯 JSON 数据：
    {{
      "core_objective": "一句话概括核心目标",
      "happy_path_steps": ["正常主链路步骤1", "步骤2", "..."],
      "modules": ["涉及的功能模块1", "模块2"]
    }}
    """
```

**输出示例**：
```json
{
  "core_objective": "实现用户登录功能，支持账号密码和第三方登录",
  "happy_path_steps": [
    "用户打开登录页面",
    "输入账号密码",
    "点击登录按钮",
    "系统验证用户信息",
    "登录成功跳转首页"
  ],
  "modules": ["用户管理", "认证授权", "第三方集成"]
}
```

#### 3.2 Step 2: 基于补充与主链路进行混合RAG检索知识

**目标**：利用提取的主链路信息，从知识库中检索相关的历史测试规范和业务规则。

**实现逻辑**：
```python
async def _step2_retrieve_knowledge(blueprint, rag_engine):
    # 构建精简而关键的检索词
    happy_path = " ".join(blueprint.get('happy_path_steps', []))
    query = f"{blueprint.get('core_objective', '')} {happy_path}"
    
    # 调用 RAG 获取上下文
    context = await rag_engine.get_context_for_query(query, max_context_length=2000)
    
    return context
```

**检索策略**：
- **查询构建**：结合核心目标和主链路步骤构建检索查询
- **向量匹配**：使用Embedding进行语义相似度匹配
- **上下文限制**：限制返回的上下文长度，避免Token超限
- **知识过滤**：根据分类和时间进行知识过滤

#### 3.3 Step 3: 根据约束，生成测试大纲维度

**目标**：结合需求信息和检索到的知识，生成测试点维度大纲。

**实现逻辑**：
```python
async def _step3_generate_test_points(requirement, blueprint, context, provider, llm_client):
    prompt = f"""
    作为资深测试专家，分析以下产品需求的主链路，并结合给定的历史知识/业务规则规范。
    不要直接详细写测试用例！不要写步骤！
    请基于等价类划分、边界值分析、正向业务流程、异常流程容忍度、安全与并发等多维度，
    列举出此需求所有必须测试的关键点。
    
    必须返回一个纯 JSON 的字符串数组格式：
    [
        "当正确输入全部必填项且属于白名单时的保存正向流程",
        "当XX字段超长或者为空时的异常报错拦截验证",
        "验证操作XX时的并发防重机制"
    ]
    """
```

**输出示例**：
```json
[
  "当正确输入用户名和密码时的正向登录流程",
  "当用户名为空或密码错误时的异常报错验证",
  "验证密码格式不符合要求时的拦截机制",
  "验证连续登录失败后的账户锁定功能",
  "验证第三方登录回调处理逻辑",
  "验证登录状态过期后的自动跳转"
]
```

#### 3.4 Step 4: 基于大纲扩散生成具体用例

**目标**：将测试大纲逐条展开，生成结构化的详细测试用例。

**实现逻辑**：
```python
async def _step4_expand_test_cases(test_points, context, provider, llm_client):
    points_str = "\n".join([f"{i+1}. {p}" for i, p in enumerate(test_points)])
    prompt = f"""
    作为高级自动化测试实施工程师，请严格针对以下我列出的【测试大纲点】，逐一展开，
    将其编写成为详细的软件测试用例。
    
    你必须用标准的 JSON 数组格式返回：
    [
      {{
        "title": "测试场景用例标题",
        "description": "用例描述说明",
        "preconditions": "所需前置条件",
        "test_steps": [ 
            {{"step": 1, "action": "具体操作步骤", "expected": "预期响应"}}
        ],
        "test_data": "测试输入数据说明",
        "priority": "高/中/低",
        "expected_result": "最终期望结果总成",
        "notes": "注意事项与附加说明"
      }}
    ]
    """
```

**输出示例**：
```json
[
  {
    "title": "用户正确登录流程",
    "description": "验证用户使用正确的用户名和密码能够成功登录",
    "preconditions": "系统已注册用户，账户状态正常",
    "test_steps": [
      {
        "step": 1,
        "action": "打开登录页面，输入正确的用户名和密码",
        "expected": "输入框正常显示，可以输入内容"
      },
      {
        "step": 2,
        "action": "点击登录按钮",
        "expected": "系统验证用户信息"
      },
      {
        "step": 3,
        "action": "等待系统响应",
        "expected": "登录成功，跳转到首页"
      }
    ],
    "test_data": "用户名：testuser，密码：password123",
    "priority": "高",
    "expected_result": "用户成功登录，跳转到系统首页",
    "notes": "核心功能测试，必须确保通过"
  }
]
```

#### 3.5 Step 5: 自我反思/漏测检查

**目标**：对生成的测试用例进行审计，检查是否遗漏关键测试点，并进行补全。

**实现逻辑**：
```python
async def _step5_review_and_correct(requirement, blueprint, generated_cases, provider, llm_client):
    # 提取已选用例简要摘要
    summary = [{"title": c.get("title", ""), "desc": c.get("description", "")} 
               for c in generated_cases]
    
    prompt = f"""
    你是测试总监兼 QA 评审员。我们要确保提交给研发团队的测试用例是无懈可击的。
    请审阅刚才团队编写的初版测试用例列表，核对它们是否真正完整覆盖了原始需求的
    【所有验收标准】以及【主逻辑链路】。
    
    你的任务：
    1. 分析是否遗漏了致命的安全漏洞测试、异常断网、或者显而易见的极端边界。
    2. 分析是否遗漏了【验收标准】中明确指出的某一条细节。
    3. 如果发现漏测，请补充最多 1 到 3 条全新的测试用例。
    """
```

**审计维度**：
- **验收标准覆盖**：检查是否覆盖所有验收标准
- **主链路完整性**：验证主链路的每个步骤都有测试覆盖
- **边界条件**：检查是否遗漏极端边界值测试
- **安全测试**：验证是否包含安全相关测试用例
- **异常处理**：检查异常场景的测试覆盖

### 4. 技术亮点与创新

#### 4.1 多模型统一架构

**设计优势**：
- **接口统一**：所有模型提供商实现相同的接口，便于切换和扩展
- **智能路由**：根据任务类型自动选择最合适的模型
- **降级机制**：当主模型不可用时，自动切换到备用模型
- **成本优化**：根据任务复杂度选择不同成本的模型

**实现示例**：
```python
# 模型路由逻辑
provider_map = {
    "glm": "glm",
    "openai": "openai",
    "deepseek": "deepseek",
    "tongyi": "tongyi",
    "siliconflow": "siliconflow",
}
provider = provider_map.get(model, model)
```

#### 4.2 混合知识增强

**知识来源**：
- **人工强关联**：用户提供的显式业务规则和约束条件
- **系统隐性匹配**：通过RAG检索的历史测试规范和最佳实践
- **领域知识库**：积累的测试经验和常见问题解决方案

**知识融合策略**：
```python
combined_context = ""
if explicit_context:
    combined_context += f"【人工强关联的历史业务规则】：\n{explicit_context}\n\n"
if rag_context and rag_context != "（无额外检索条件）":
    combined_context += f"【系统隐性匹配的参考常识与规范记录】：\n{rag_context}\n"
```

#### 4.3 智能错误恢复

**JSON解析容错**：
```python
async def _extract_json_from_text(self, text: str) -> Any:
    # 尝试基础JSON解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # 高级栈式匹配恢复
        extracted_cases = []
        stack = []
        start_idx = -1
        
        for i, char in enumerate(text):
            if char == '{':
                if not stack:
                    start_idx = i
                stack.append(char)
            elif char == '}':
                if stack:
                    stack.pop()
                    if not stack and start_idx != -1:
                        obj_str = text[start_idx:i+1]
                        try:
                            obj = json.loads(obj_str, strict=False)
                            extracted_cases.append(obj)
                        except json.JSONDecodeError:
                            pass
```

**降级策略**：
- **Agentic失败降级**：当AI生成失败时，返回保底测试用例
- **检索失败降级**：当RAG检索失败时，使用纯模式生成
- **连接失败降级**：当模型连接失败时，切换到备用模型

#### 4.4 异步性能优化

**异步处理策略**：
- **文档向量化异步**：文档添加后立即返回，向量构建在后台异步进行
- **工作流异步执行**：工作流启动后立即返回执行ID，后台异步执行
- **并发请求处理**：支持多个生成任务并发执行

**实现示例**：
```python
# 异步构建向量
asyncio.create_task(self._build_embeddings_for_doc_async(doc_id, content))

# 异步执行工作流
asyncio.create_task(self._run_workflow(execution_id, definition, context))
```

### 5. 配置与部署

#### 5.1 环境变量配置

**AI模型配置**：
```bash
# OpenAI配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1

# 智谱GLM配置
GLM_API_KEY=your_glm_api_key

# 通义千问配置
TONGYI_API_KEY=your_tongyi_api_key

# DeepSeek配置
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# 硅基流动配置
SILICONFLOW_API_KEY=your_siliconflow_api_key
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_CHAT_MODEL=Qwen/Qwen2.5-7B-Instruct

# Embedding配置
EMBEDDING_PROVIDER=siliconflow

# RAG配置
CHROMA_PERSIST_DIR=.chroma
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=50
```

#### 5.2 数据库配置

**MySQL配置**：
```bash
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=test_system

# 连接池配置
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_TIMEOUT=30
```

#### 5.3 向量数据库配置

**ChromaDB配置**：
```bash
# 向量数据存储路径
CHROMA_PERSIST_DIR=.chroma

# 集合配置
COLLECTION_NAME=knowledge_base
METRIC=cosine  # 余弦相似度
```

### 6. API接口文档

#### 6.1 AI测试用例生成

**生成测试用例**：
```http
POST /api/v1/ai/generate-test-case
Content-Type: application/json

{
  "requirement_id": 1,
  "title": "用户登录功能",
  "description": "实现用户登录，支持账号密码和第三方登录",
  "priority": "high",
  "type": "functional",
  "acceptance_criteria": "支持账号密码登录，支持第三方登录，登录失败有明确提示",
  "business_value": "提升用户体验，增加用户粘性",
  "provider": "glm",
  "use_rag": true
}
```

**响应示例**：
```json
{
  "success": true,
  "message": "测试用例生成成功",
  "data": {
    "test_cases": [
      {
        "title": "用户正确登录流程",
        "description": "验证用户使用正确的用户名和密码能够成功登录",
        "preconditions": "系统已注册用户，账户状态正常",
        "test_steps": [
          {
            "step": 1,
            "action": "打开登录页面，输入正确的用户名和密码",
            "expected": "输入框正常显示，可以输入内容"
          }
        ],
        "test_data": "用户名：testuser，密码：password123",
        "priority": "高",
        "expected_result": "用户成功登录，跳转到系统首页",
        "notes": "核心功能测试，必须确保通过"
      }
    ]
  }
}
```

#### 6.2 RAG知识库管理

**添加知识文档**：
```http
POST /api/v1/ai/knowledge/add
Content-Type: application/json

{
  "title": "登录功能测试规范",
  "content": "登录功能的详细测试规范和注意事项...",
  "source": "测试文档",
  "category": "security",
  "metadata": {
    "version": "1.0",
    "author": "测试团队"
  }
}
```

**检索知识**：
```http
POST /api/v1/ai/knowledge/search
Content-Type: application/json

{
  "query": "用户登录安全性测试",
  "top_k": 5,
  "category": "security"
}
```

#### 6.3 工作流管理

**创建工作流**：
```http
POST /api/v1/ai/workflow/create
Content-Type: application/json

{
  "workflow_id": "test_case_generation",
  "name": "测试用例生成工作流",
  "description": "基于需求的智能测试用例生成流程"
}
```

**执行工作流**：
```http
POST /api/v1/ai/workflow/execute
Content-Type: application/json

{
  "workflow_id": "test_case_generation",
  "initial_variables": {
    "requirement": "用户登录功能需求",
    "provider": "glm"
  }
}
```

**获取执行状态**：
```http
GET /api/v1/ai/workflow/status/{execution_id}
```

### 7. 使用示例

#### 7.1 基础测试用例生成

**场景**：为用户登录功能生成测试用例

```python
# 前端调用示例
const generateTestCases = async () => {
  const response = await aiApi.generateTestCase({
    title: "用户登录功能",
    description: "实现用户登录，支持账号密码和第三方登录",
    acceptance_criteria: "支持账号密码登录，支持第三方登录，登录失败有明确提示",
    provider: "glm",
    use_rag: true
  });
  
  console.log('生成的测试用例:', response.data.test_cases);
};
```

#### 7.2 知识库增强生成

**场景**：结合历史测试规范生成更高质量的测试用例

```python
# 1. 添加历史测试规范到知识库
await aiApi.addKnowledgeDocument({
  title: "登录功能测试规范",
  content: "登录功能需要测试的要点：...",
  category: "security"
});

# 2. 生成测试用例时会自动检索相关知识
const response = await aiApi.generateTestCase({
  title: "用户登录功能",
  use_rag: true  // 启用RAG增强
});
```

#### 7.3 工作流自动化

**场景**：创建自定义的测试生成工作流

```python
# 定义工作流
const workflow = {
  workflow_id: "custom_test_generation",
  name: "自定义测试生成流程",
  definition: {
    start_node: "start",
    nodes: [
      {
        id: "start",
        type: "start",
        name: "开始",
        next_nodes: ["rag_retrieve"]
      },
      {
        id: "rag_retrieve",
        type: "task",
        name: "RAG检索",
        config: {
          task_type: "rag",
          query: "{requirement}",
          top_k: 5
        },
        next_nodes: ["llm_generate"]
      },
      {
        id: "llm_generate",
        type: "task",
        name: "LLM生成",
        config: {
          task_type: "llm",
          prompt_template: "根据以下需求生成测试用例：{rag_retrieve_context} {requirement}"
        },
        next_nodes: ["end"]
      },
      {
        id: "end",
        type: "end",
        name: "结束"
      }
    ]
  }
};

// 创建并执行工作流
await aiApi.createWorkflow(workflow);
const execution = await aiApi.executeWorkflow({
  workflow_id: "custom_test_generation",
  initial_variables: {
    requirement: "用户登录功能需求"
  }
});
```

### 8. 性能优化与最佳实践

#### 8.1 性能优化策略

**向量化优化**：
- **批量处理**：支持批量文档向量化，减少API调用次数
- **异步处理**：向量构建在后台异步进行，不阻塞主流程
- **缓存机制**：对相同内容的文档复用向量结果

**检索优化**：
- **索引优化**：使用ChromaDB的HNSW索引提高检索速度
- **查询优化**：限制检索的文档数量和上下文长度
- **预加载**：常用知识预先加载到内存

**生成优化**：
- **Token控制**：合理控制各步骤的Token使用，避免超限
- **并行处理**：支持多个测试点并行生成测试用例
- **结果缓存**：对相同需求的生成结果进行缓存

#### 8.2 最佳实践

**知识库管理**：
- **分类清晰**：按照功能模块、业务领域对知识文档进行分类
- **版本控制**：对知识文档进行版本管理，便于追溯和回滚
- **定期更新**：定期更新知识库，保持知识的时效性

**模型选择**：
- **成本效益**：根据任务复杂度选择不同成本的模型
- **性能平衡**：在生成质量和响应速度之间找到平衡
- **容错设计**：配置备用模型，确保服务稳定性

**流程设计**：
- **模块化**：将复杂的生成流程拆分为多个模块
- **可配置**：支持流程参数的可配置化
- **可监控**：提供详细的执行日志和监控指标

### 9. 故障排查

#### 9.1 常见问题

**问题1：AI生成失败**
- **现象**：调用生成接口返回错误
- **排查**：
  1. 检查模型API Key是否正确配置
  2. 检查网络连接是否正常
  3. 查看后端日志获取详细错误信息
  4. 尝试切换到备用模型

**问题2：RAG检索无结果**
- **现象**：生成测试用例时没有检索到相关知识
- **排查**：
  1. 检查知识库是否有相关文档
  2. 检查ChromaDB服务是否正常运行
  3. 检查文档向量化是否成功完成
  4. 调整检索参数（top_k、相似度阈值）

**问题3：向量构建失败**
- **现象**：添加文档后向量构建失败
- **排查**：
  1. 检查Embedding模型是否支持
  2. 检查API调用次数限制
  3. 查看向量构建的异步任务日志
  4. 手动触发向量重建

#### 9.2 日志分析

**日志位置**：
- 应用日志：`backend/backend.log`
- 请求日志：`backend/requests.log`
- SQL日志：`backend/sql.log`

**关键日志**：
```
[INFO] === 开始生成测试用例 (需求: 用户登录功能) ===
[INFO] ➡️ Step 1: 需求核心主链路提取
[INFO] ➡️ Step 2: 准备混合知识
[INFO] ➡️ Step 3: 结合知识与约束生成测试大纲维度
[INFO] ➡️ Step 4: 扩散生成具体用例
[INFO] ➡️ Step 5: 自我审计与漏测补全
[INFO] === 测试用例 Agentic 生成完成，共产出 6 条用例 ===
```

### 10. 未来规划

#### 10.1 功能增强

**多模态支持**：
- 支持从图片、视频等多媒体内容生成测试用例
- 支持语音交互的需求描述

**智能推荐**：
- 基于历史生成数据推荐最优测试策略
- 智能推荐相关测试用例和测试数据

**自动化测试**：
- 生成的测试用例自动转换为可执行的自动化脚本
- 支持多种自动化测试框架（Selenium、Playwright等）

#### 10.2 性能优化

**模型优化**：
- 引入更高效的小型模型
- 支持模型量化和压缩
- 优化Prompt工程，提高生成质量

**架构优化**：
- 引入分布式向量数据库
- 支持模型服务的水平扩展
- 优化工作流调度算法

#### 10.3 生态建设

**模板市场**：
- 建立测试用例生成模板市场
- 支持用户分享和导入模板

**插件系统**：
- 开放插件接口，支持第三方扩展
- 提供插件开发文档和示例

**社区建设**：
- 建立用户社区，分享使用经验
- 定期举办线上分享和培训

## 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- MySQL 5.7+ / 8.0+
- (可选) Docker & Docker Compose

### 后端启动
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 前端启动
```bash
cd frontend
npm install
npm start
```

### Docker部署
```bash
docker-compose up -d
```

## 访问地址
- 前端界面: http://localhost:3000
- 后端API: http://localhost:8000
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## 贡献指南
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证
本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 更新日志

### v2.4.0 (2026-03-13)
- 向量数据库迁移至 ChromaDB
- Embedding 多模型回退机制
- 新增硅基流动平台支持

### v2.1.0 (2025-12-23)
- 集成大模型API统一接口
- 实现RAG知识库引擎
- 添加Workflow工作流引擎

### v2.0.0 (2025-12-18)
- 规则配置系统
- 可视化规则编辑器
- 自动生成测试用例

### v1.1.0 (2025-12-03)
- 基础框架搭建
- 项目管理、测试用例管理
- HTTP接口测试功能

---

**注意**：AI功能需要配置相应的大模型API Key才能正常使用。请在系统设置中配置所需的模型凭据。