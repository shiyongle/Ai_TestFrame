"""
Workflow引擎
提供工作流编排、任务调度和流程自动化功能
"""

import json
import asyncio
import uuid
from typing import Dict, Any, List, Optional, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import logging
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from config.settings import settings
from .llm_client import llm_client
from .rag_engine import rag_engine

logger = logging.getLogger(__name__)
Base = declarative_base()

class TaskStatus(Enum):
    """任务状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class NodeType(Enum):
    """节点类型"""
    START = "start"
    END = "end"
    TASK = "task"
    DECISION = "decision"
    PARALLEL = "parallel"
    WAIT = "wait"

@dataclass
class WorkflowContext:
    """工作流上下文"""
    workflow_id: str
    variables: Dict[str, Any] = field(default_factory=dict)
    history: List[Dict[str, Any]] = field(default_factory=list)
    current_node: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    def set_variable(self, key: str, value: Any):
        """设置变量"""
        self.variables[key] = value
        self.history.append({
            'timestamp': datetime.utcnow().isoformat(),
            'action': 'set_variable',
            'key': key,
            'value': value
        })
    
    def get_variable(self, key: str, default: Any = None) -> Any:
        """获取变量"""
        return self.variables.get(key, default)

@dataclass
class WorkflowNode:
    """工作流节点"""
    id: str
    type: NodeType
    name: str
    config: Dict[str, Any] = field(default_factory=dict)
    next_nodes: List[str] = field(default_factory=list)
    condition: Optional[str] = None

class WorkflowDefinition(Base):
    """工作流定义表"""
    __tablename__ = "workflow_definitions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(String(100), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    definition = Column(Text, nullable=False)  # JSON格式的工作流定义
    version = Column(String(20), default="1.0")
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class WorkflowExecution(Base):
    """工作流执行记录表"""
    __tablename__ = "workflow_executions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    execution_id = Column(String(100), unique=True, nullable=False)
    workflow_id = Column(String(100), nullable=False)
    status = Column(String(20), default=TaskStatus.PENDING.value)
    context = Column(Text)  # JSON格式的上下文
    current_node = Column(String(100))
    error_message = Column(Text)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

class WorkflowTask:
    """工作流任务基类"""
    
    def __init__(self, node: WorkflowNode):
        self.node = node
    
    async def execute(self, context: WorkflowContext) -> Dict[str, Any]:
        """执行任务"""
        raise NotImplementedError

class LLMTask(WorkflowTask):
    """大模型任务"""
    
    async def execute(self, context: WorkflowContext) -> Dict[str, Any]:
        """执行大模型任务"""
        config = self.node.config
        prompt_template = config.get('prompt_template', '')
        provider = config.get('provider', 'glm')
        model = config.get('model', 'glm-4')
        
        # 渲染提示词模板
        prompt = self._render_template(prompt_template, context.variables)
        
        # 调用大模型
        result = await llm_client.text_completion(
            prompt=prompt,
            provider=provider,
            model=model,
            **config.get('llm_params', {})
        )
        
        if result.get('success'):
            context.set_variable(f"{self.node.id}_result", result['content'])
            return {'success': True, 'result': result['content']}
        else:
            return {'success': False, 'error': result.get('error', 'Unknown error')}
    
    def _render_template(self, template: str, variables: Dict[str, Any]) -> str:
        """渲染模板"""
        try:
            return template.format(**variables)
        except KeyError as e:
            logger.error(f"模板渲染失败，缺少变量: {e}")
            return template

class RAGTask(WorkflowTask):
    """RAG检索任务"""
    
    async def execute(self, context: WorkflowContext) -> Dict[str, Any]:
        """执行RAG检索任务"""
        config = self.node.config
        query = config.get('query', '')
        top_k = config.get('top_k', 5)
        category = config.get('category')
        
        # 渲染查询模板
        rendered_query = self._render_template(query, context.variables)
        
        # 执行检索
        search_results = await rag_engine.search(
            query=rendered_query,
            top_k=top_k,
            category=category
        )
        
        # 获取上下文
        context_text = await rag_engine.get_context_for_query(rendered_query)
        
        context.set_variable(f"{self.node.id}_results", search_results)
        context.set_variable(f"{self.node.id}_context", context_text)
        
        return {
            'success': True,
            'results': search_results,
            'context': context_text
        }
    
    def _render_template(self, template: str, variables: Dict[str, Any]) -> str:
        """渲染模板"""
        try:
            return template.format(**variables)
        except KeyError as e:
            logger.error(f"模板渲染失败，缺少变量: {e}")
            return template

class DecisionTask(WorkflowTask):
    """决策任务"""
    
    async def execute(self, context: WorkflowContext) -> Dict[str, Any]:
        """执行决策任务"""
        config = self.node.config
        condition = config.get('condition', '')
        
        # 评估条件
        try:
            result = self._evaluate_condition(condition, context.variables)
            context.set_variable(f"{self.node.id}_decision", result)
            return {'success': True, 'decision': result}
        except Exception as e:
            logger.error(f"条件评估失败: {e}")
            return {'success': False, 'error': str(e)}
    
    def _evaluate_condition(self, condition: str, variables: Dict[str, Any]) -> bool:
        """评估条件表达式"""
        # 简单的条件评估实现
        # 在实际项目中可以使用更安全的表达式引擎
        try:
            # 创建安全的执行环境
            safe_vars = {k: v for k, v in variables.items() if isinstance(v, (str, int, float, bool))}
            return eval(condition, {"__builtins__": {}}, safe_vars)
        except Exception as e:
            logger.error(f"条件评估错误: {e}")
            return False

class WorkflowEngine:
    """工作流引擎"""
    
    def __init__(self):
        self.engine = create_engine(settings.database_url)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.task_registry = {
            NodeType.TASK: LLMTask,
            'llm': LLMTask,
            'rag': RAGTask,
            NodeType.DECISION: DecisionTask,
        }
        self.running_workflows = {}
    
    def register_task(self, task_type: str, task_class: type):
        """注册任务类型"""
        self.task_registry[task_type] = task_class
    
    async def create_workflow(
        self, 
        workflow_id: str, 
        name: str, 
        definition: Dict[str, Any],
        description: str = ""
    ) -> bool:
        """创建工作流定义"""
        try:
            with self.SessionLocal() as session:
                # 检查是否已存在
                existing = session.query(WorkflowDefinition).filter(
                    WorkflowDefinition.workflow_id == workflow_id
                ).first()
                
                if existing:
                    # 更新现有工作流
                    existing.definition = json.dumps(definition, ensure_ascii=False)
                    existing.updated_at = datetime.utcnow()
                else:
                    # 创建新工作流
                    workflow_def = WorkflowDefinition(
                        workflow_id=workflow_id,
                        name=name,
                        description=description,
                        definition=json.dumps(definition, ensure_ascii=False)
                    )
                    session.add(workflow_def)
                
                session.commit()
                logger.info(f"创建工作流成功: {workflow_id}")
                return True
                
        except Exception as e:
            logger.error(f"创建工作流失败: {e}")
            return False
    
    async def execute_workflow(
        self, 
        workflow_id: str, 
        initial_variables: Dict[str, Any] = None
    ) -> str:
        """执行工作流"""
        execution_id = str(uuid.uuid4())
        
        try:
            # 获取工作流定义
            with self.SessionLocal() as session:
                workflow_def = session.query(WorkflowDefinition).filter(
                    WorkflowDefinition.workflow_id == workflow_id,
                    WorkflowDefinition.active == True
                ).first()
                
                if not workflow_def:
                    raise ValueError(f"工作流不存在: {workflow_id}")
                
                definition = json.loads(workflow_def.definition)
            
            # 创建执行上下文
            context = WorkflowContext(
                workflow_id=workflow_id,
                variables=initial_variables or {},
                start_time=datetime.utcnow()
            )
            
            # 记录执行开始
            with self.SessionLocal() as session:
                execution = WorkflowExecution(
                    execution_id=execution_id,
                    workflow_id=workflow_id,
                    status=TaskStatus.RUNNING.value,
                    context=json.dumps({
                        'variables': context.variables,
                        'history': context.history
                    }, ensure_ascii=False),
                    start_time=datetime.utcnow()
                )
                session.add(execution)
                session.commit()
            
            # 异步执行工作流
            asyncio.create_task(self._run_workflow(execution_id, definition, context))
            
            logger.info(f"工作流执行开始: {execution_id}")
            return execution_id
            
        except Exception as e:
            logger.error(f"启动工作流失败: {e}")
            # 记录失败
            with self.SessionLocal() as session:
                execution = WorkflowExecution(
                    execution_id=execution_id,
                    workflow_id=workflow_id,
                    status=TaskStatus.FAILED.value,
                    error_message=str(e),
                    start_time=datetime.utcnow(),
                    end_time=datetime.utcnow()
                )
                session.add(execution)
                session.commit()
            raise
    
    async def _run_workflow(
        self, 
        execution_id: str, 
        definition: Dict[str, Any], 
        context: WorkflowContext
    ):
        """运行工作流"""
        try:
            nodes = self._parse_nodes(definition)
            current_node_id = definition.get('start_node')
            
            while current_node_id and current_node_id != 'end':
                node = nodes.get(current_node_id)
                if not node:
                    raise ValueError(f"节点不存在: {current_node_id}")
                
                context.current_node = current_node_id
                context.status = TaskStatus.RUNNING
                
                # 执行节点
                result = await self._execute_node(node, context)
                
                if not result.get('success'):
                    raise Exception(f"节点执行失败: {result.get('error')}")
                
                # 确定下一个节点
                current_node_id = self._get_next_node(node, context, result)
            
            # 工作流完成
            context.status = TaskStatus.COMPLETED
            context.end_time = datetime.utcnow()
            
            # 更新执行记录
            with self.SessionLocal() as session:
                execution = session.query(WorkflowExecution).filter(
                    WorkflowExecution.execution_id == execution_id
                ).first()
                if execution:
                    execution.status = TaskStatus.COMPLETED.value
                    execution.context = json.dumps({
                        'variables': context.variables,
                        'history': context.history
                    }, ensure_ascii=False)
                    execution.end_time = datetime.utcnow()
                    session.commit()
            
            logger.info(f"工作流执行完成: {execution_id}")
            
        except Exception as e:
            logger.error(f"工作流执行失败: {e}")
            context.status = TaskStatus.FAILED
            context.end_time = datetime.utcnow()
            
            # 更新执行记录
            with self.SessionLocal() as session:
                execution = session.query(WorkflowExecution).filter(
                    WorkflowExecution.execution_id == execution_id
                ).first()
                if execution:
                    execution.status = TaskStatus.FAILED.value
                    execution.error_message = str(e)
                    execution.end_time = datetime.utcnow()
                    session.commit()
    
    def _parse_nodes(self, definition: Dict[str, Any]) -> Dict[str, WorkflowNode]:
        """解析节点定义"""
        nodes = {}
        for node_data in definition.get('nodes', []):
            node = WorkflowNode(
                id=node_data['id'],
                type=NodeType(node_data['type']),
                name=node_data['name'],
                config=node_data.get('config', {}),
                next_nodes=node_data.get('next_nodes', []),
                condition=node_data.get('condition')
            )
            nodes[node.id] = node
        return nodes
    
    async def _execute_node(self, node: WorkflowNode, context: WorkflowContext) -> Dict[str, Any]:
        """执行节点"""
        task_type = node.config.get('task_type', node.type.value)
        
        if task_type in self.task_registry:
            task_class = self.task_registry[task_type]
            task = task_class(node)
            return await task.execute(context)
        else:
            # 默认处理
            logger.warning(f"未知任务类型: {task_type}")
            return {'success': True, 'message': f"跳过节点: {node.name}"}
    
    def _get_next_node(self, node: WorkflowNode, context: WorkflowContext, result: Dict[str, Any]) -> Optional[str]:
        """获取下一个节点"""
        if node.type == NodeType.END:
            return None
        
        if not node.next_nodes:
            return None
        
        if len(node.next_nodes) == 1:
            return node.next_nodes[0]
        
        # 决策节点
        if node.type == NodeType.DECISION:
            decision = context.get_variable(f"{node.id}_decision", False)
            if decision and len(node.next_nodes) > 0:
                return node.next_nodes[0]
            elif not decision and len(node.next_nodes) > 1:
                return node.next_nodes[1]
        
        # 默认返回第一个节点
        return node.next_nodes[0]
    
    def get_execution_status(self, execution_id: str) -> Dict[str, Any]:
        """获取执行状态"""
        try:
            with self.SessionLocal() as session:
                execution = session.query(WorkflowExecution).filter(
                    WorkflowExecution.execution_id == execution_id
                ).first()
                
                if not execution:
                    return {'error': '执行记录不存在'}
                
                return {
                    'execution_id': execution.execution_id,
                    'workflow_id': execution.workflow_id,
                    'status': execution.status,
                    'current_node': execution.current_node,
                    'context': json.loads(execution.context) if execution.context else {},
                    'error_message': execution.error_message,
                    'start_time': execution.start_time.isoformat() if execution.start_time else None,
                    'end_time': execution.end_time.isoformat() if execution.end_time else None
                }
        except Exception as e:
            logger.error(f"获取执行状态失败: {e}")
            return {'error': str(e)}
    
    def get_workflows(self) -> List[Dict[str, Any]]:
        """获取所有工作流"""
        try:
            with self.SessionLocal() as session:
                workflows = session.query(WorkflowDefinition).filter(
                    WorkflowDefinition.active == True
                ).all()
                
                return [
                    {
                        'workflow_id': w.workflow_id,
                        'name': w.name,
                        'description': w.description,
                        'version': w.version,
                        'created_at': w.created_at.isoformat(),
                        'updated_at': w.updated_at.isoformat()
                    }
                    for w in workflows
                ]
        except Exception as e:
            logger.error(f"获取工作流列表失败: {e}")
            return []

# 全局实例
workflow_engine = WorkflowEngine()