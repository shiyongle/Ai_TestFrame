"""
AI服务统一接口
整合LLM、RAG、Workflow等AI能力，提供统一的业务接口
"""

import json
import asyncio
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from .llm_client import llm_client
from .rag_engine import rag_engine
from .workflow_engine import workflow_engine
from ..ai_generator import AITestCaseGenerator

logger = logging.getLogger(__name__)

class AIService:
    """AI服务统一接口"""
    
    def __init__(self):
        self.test_case_generator = AITestCaseGenerator()
    
    async def generate_test_case_from_requirement(
        self, 
        requirement_data: Dict[str, Any],
        provider: str = "glm",
        use_rag: bool = True
    ) -> Dict[str, Any]:
        """根据需求生成测试用例"""
        try:
            # 构建需求对象
            from models.database_models import Requirement
            requirement = Requirement(
                title=requirement_data.get('title', ''),
                description=requirement_data.get('description', ''),
                priority=requirement_data.get('priority', 'medium'),
                type=requirement_data.get('type', 'functional'),
                acceptance_criteria=requirement_data.get('acceptance_criteria', ''),
                business_value=requirement_data.get('business_value', '')
            )
            
            # 如果启用RAG，先获取相关知识
            context = ""
            if use_rag:
                context = await rag_engine.get_context_for_query(
                    f"{requirement.title} {requirement.description}",
                    max_context_length=1500
                )
            
            # 构建增强的提示词
            if context:
                enhanced_prompt = self._build_rag_enhanced_prompt(requirement, context)
                result = await llm_client.text_completion(
                    prompt=enhanced_prompt,
                    provider=provider,
                    max_tokens=2000
                )
                
                if result.get('success'):
                    try:
                        test_case = json.loads(result['content'])
                        return {
                            'success': True,
                            'test_case': test_case,
                            'provider': provider,
                            'used_rag': True,
                            'context_sources': len(context.split('【')) - 1 if context else 0
                        }
                    except json.JSONDecodeError:
                        logger.warning("AI返回的不是有效JSON，使用备用生成器")
                        # 使用备用生成器
                        return await self._fallback_generation(requirement, provider)
                else:
                    logger.error(f"AI生成失败: {result.get('error')}")
                    return await self._fallback_generation(requirement, provider)
            else:
                # 使用原有的生成器
                test_case = await self.test_case_generator.generate_test_case_from_requirement(
                    requirement, provider
                )
                return {
                    'success': True,
                    'test_case': test_case,
                    'provider': provider,
                    'used_rag': False
                }
                
        except Exception as e:
            logger.error(f"生成测试用例失败: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _build_rag_enhanced_prompt(self, requirement, context: str) -> str:
        """构建RAG增强的提示词"""
        return f"""
作为专业的软件测试工程师，请根据以下需求和相关知识库内容生成详细的功能测试用例：

相关知识库内容：
{context}

需求信息：
- 标题：{requirement.title}
- 描述：{requirement.description}
- 优先级：{requirement.priority}
- 类型：{requirement.type}
- 验收标准：{requirement.acceptance_criteria}
- 业务价值：{requirement.business_value}

请参考知识库中的相似案例和最佳实践，生成JSON格式的测试用例，包含以下字段：
{{
  "title": "测试用例标题",
  "description": "测试用例描述",
  "preconditions": "前置条件",
  "test_steps": [
    {{
      "step": 1,
      "action": "操作步骤",
      "expected": "预期结果"
    }}
  ],
  "test_data": "测试数据",
  "priority": "高/中/低",
  "expected_result": "预期结果",
  "notes": "注意事项"
}}

请确保：
1. 测试步骤详细且可执行
2. 覆盖正常流程和异常流程
3. 基于验收标准设计测试点
4. 考虑业务价值和优先级
5. 参考知识库中的最佳实践
6. 返回标准JSON格式

只返回JSON，不要包含其他文字。
"""
    
    async def _fallback_generation(self, requirement, provider: str) -> Dict[str, Any]:
        """备用生成方法"""
        try:
            test_case = await self.test_case_generator.generate_test_case_from_requirement(
                requirement, provider
            )
            return {
                'success': True,
                'test_case': test_case,
                'provider': provider,
                'used_rag': False,
                'fallback': True
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"备用生成也失败: {str(e)}"
            }
    
    async def analyze_test_results(
        self, 
        test_results: List[Dict[str, Any]],
        provider: str = "glm"
    ) -> Dict[str, Any]:
        """分析测试结果"""
        try:
            # 构建分析提示词
            results_text = json.dumps(test_results, ensure_ascii=False, indent=2)
            prompt = f"""
作为测试分析专家，请分析以下测试结果并提供洞察：

测试结果数据：
{results_text}

请提供以下分析：
1. 总体测试概况
2. 失败测试的原因分析
3. 风险评估
4. 改进建议
5. 优先级建议

请以JSON格式返回分析结果：
{{
  "summary": "测试概况总结",
  "failure_analysis": "失败原因分析",
  "risk_assessment": "风险评估",
  "recommendations": ["改进建议1", "改进建议2"],
  "priority_actions": ["优先行动1", "优先行动2"],
  "trends": "趋势分析"
}}
"""
            
            result = await llm_client.text_completion(
                prompt=prompt,
                provider=provider,
                max_tokens=2000
            )
            
            if result.get('success'):
                try:
                    analysis = json.loads(result['content'])
                    return {
                        'success': True,
                        'analysis': analysis,
                        'provider': provider
                    }
                except json.JSONDecodeError:
                    return {
                        'success': True,
                        'analysis': {'summary': result['content']},
                        'provider': provider,
                        'raw_response': True
                    }
            else:
                return {
                    'success': False,
                    'error': result.get('error')
                }
                
        except Exception as e:
            logger.error(f"分析测试结果失败: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def generate_test_report(
        self, 
        execution_data: Dict[str, Any],
        provider: str = "glm"
    ) -> Dict[str, Any]:
        """生成测试报告"""
        try:
            prompt = f"""
作为测试报告专家，请根据以下测试执行数据生成专业的测试报告：

执行数据：
{json.dumps(execution_data, ensure_ascii=False, indent=2)}

请生成包含以下内容的测试报告：
1. 执行概况
2. 测试覆盖率分析
3. 质量评估
4. 问题总结
5. 改进建议

请以JSON格式返回：
{{
  "executive_summary": "执行摘要",
  "test_coverage": "测试覆盖率",
  "quality_metrics": "质量指标",
  "issues_summary": "问题总结",
  "recommendations": ["建议1", "建议2"],
  "next_steps": ["下一步1", "下一步2"]
}}
"""
            
            result = await llm_client.text_completion(
                prompt=prompt,
                provider=provider,
                max_tokens=2000
            )
            
            if result.get('success'):
                try:
                    report = json.loads(result['content'])
                    return {
                        'success': True,
                        'report': report,
                        'provider': provider
                    }
                except json.JSONDecodeError:
                    return {
                        'success': True,
                        'report': {'summary': result['content']},
                        'provider': provider,
                        'raw_response': True
                    }
            else:
                return {
                    'success': False,
                    'error': result.get('error')
                }
                
        except Exception as e:
            logger.error(f"生成测试报告失败: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def add_knowledge_document(
        self,
        title: str,
        content: str,
        source: str = "",
        category: str = "general",
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """添加知识文档"""
        try:
            doc_id = await rag_engine.add_document(
                title=title,
                content=content,
                source=source,
                category=category,
                metadata=metadata
            )
            
            return {
                'success': True,
                'doc_id': doc_id,
                'message': '文档添加成功'
            }
        except Exception as e:
            logger.error(f"添加知识文档失败: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def search_knowledge(
        self,
        query: str,
        top_k: int = 5,
        category: str = None
    ) -> Dict[str, Any]:
        """搜索知识库"""
        try:
            results = await rag_engine.search(
                query=query,
                top_k=top_k,
                category=category
            )
            
            return {
                'success': True,
                'results': results,
                'total': len(results)
            }
        except Exception as e:
            logger.error(f"搜索知识库失败: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def create_test_generation_workflow(
        self,
        workflow_id: str,
        name: str = "智能测试用例生成工作流"
    ) -> Dict[str, Any]:
        """创建测试用例生成工作流"""
        try:
            workflow_definition = {
                'start_node': 'start',
                'nodes': [
                    {
                        'id': 'start',
                        'type': 'start',
                        'name': '开始',
                        'next_nodes': ['rag_search']
                    },
                    {
                        'id': 'rag_search',
                        'type': 'task',
                        'name': 'RAG知识检索',
                        'config': {
                            'task_type': 'rag',
                            'query': '{requirement_title} {requirement_description}',
                            'top_k': 3,
                            'category': 'test_cases'
                        },
                        'next_nodes': ['llm_generation']
                    },
                    {
                        'id': 'llm_generation',
                        'type': 'task',
                        'name': 'AI生成测试用例',
                        'config': {
                            'task_type': 'llm',
                            'prompt_template': '''
根据以下需求和相关知识生成测试用例：

需求：{requirement_title}
描述：{requirement_description}
相关知识：{rag_search_context}

请生成详细的测试用例。
                            ''',
                            'provider': 'glm',
                            'model': 'glm-4'
                        },
                        'next_nodes': ['end']
                    },
                    {
                        'id': 'end',
                        'type': 'end',
                        'name': '结束'
                    }
                ]
            }
            
            success = await workflow_engine.create_workflow(
                workflow_id=workflow_id,
                name=name,
                definition=workflow_definition,
                description="基于RAG和LLM的智能测试用例生成工作流"
            )
            
            if success:
                return {
                    'success': True,
                    'workflow_id': workflow_id,
                    'message': '工作流创建成功'
                }
            else:
                return {
                    'success': False,
                    'error': '工作流创建失败'
                }
                
        except Exception as e:
            logger.error(f"创建工作流失败: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def execute_test_generation_workflow(
        self,
        workflow_id: str,
        requirement_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """执行测试用例生成工作流"""
        try:
            execution_id = await workflow_engine.execute_workflow(
                workflow_id=workflow_id,
                initial_variables=requirement_data
            )
            
            return {
                'success': True,
                'execution_id': execution_id,
                'message': '工作流执行已启动'
            }
        except Exception as e:
            logger.error(f"执行工作流失败: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_workflow_status(self, execution_id: str) -> Dict[str, Any]:
        """获取工作流执行状态"""
        return workflow_engine.get_execution_status(execution_id)
    
    def get_ai_status(self) -> Dict[str, Any]:
        """获取AI服务状态"""
        try:
            # 检查LLM提供商
            available_providers = llm_client.get_available_providers()
            provider_status = {}
            
            for provider in available_providers:
                # 这里可以异步检查连接状态，但为了简化，先返回可用状态
                provider_status[provider] = 'available'
            
            # 检查知识库状态
            doc_count = rag_engine.get_document_count()
            categories = rag_engine.get_categories()
            
            # 检查工作流状态
            workflows = workflow_engine.get_workflows()
            
            return {
                'success': True,
                'llm_providers': provider_status,
                'knowledge_base': {
                    'document_count': doc_count,
                    'categories': categories
                },
                'workflows': {
                    'count': len(workflows),
                    'list': workflows
                },
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"获取AI状态失败: {e}")
            return {
                'success': False,
                'error': str(e)
            }

# 全局实例
ai_service = AIService()