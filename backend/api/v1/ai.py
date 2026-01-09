"""
AI相关API路由
提供AI能力的RESTful接口
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
import logging

from services.ai.ai_service import ai_service
# 简单的用户认证依赖（后续可以实现JWT认证）
async def get_current_user():
    return {"user_id": "1", "username": "admin"}

logger = logging.getLogger(__name__)
router = APIRouter()

# 请求模型
class TestCaseGenerationRequest(BaseModel):
    """测试用例生成请求"""
    title: str = Field(..., description="需求标题")
    description: str = Field(..., description="需求描述")
    priority: str = Field("medium", description="优先级")
    type: str = Field("functional", description="需求类型")
    acceptance_criteria: str = Field("", description="验收标准")
    business_value: str = Field("", description="业务价值")
    provider: str = Field("glm", description="AI提供商")
    use_rag: bool = Field(True, description="是否使用RAG增强")

class TestAnalysisRequest(BaseModel):
    """测试结果分析请求"""
    test_results: List[Dict[str, Any]] = Field(..., description="测试结果列表")
    provider: str = Field("glm", description="AI提供商")

class TestReportRequest(BaseModel):
    """测试报告生成请求"""
    execution_data: Dict[str, Any] = Field(..., description="执行数据")
    provider: str = Field("glm", description="AI提供商")

class KnowledgeDocumentRequest(BaseModel):
    """知识文档添加请求"""
    title: str = Field(..., description="文档标题")
    content: str = Field(..., description="文档内容")
    source: str = Field("", description="文档来源")
    category: str = Field("general", description="文档分类")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")

class KnowledgeSearchRequest(BaseModel):
    """知识搜索请求"""
    query: str = Field(..., description="搜索查询")
    top_k: int = Field(5, description="返回结果数量")
    category: str = Field(None, description="文档分类过滤")

class KnowledgeLinkRequest(BaseModel):
    """知识文档关联请求"""
    requirement_ids: List[int] = Field(default_factory=list, description="关联需求ID")
    testcase_ids: List[int] = Field(default_factory=list, description="关联用例ID")

class WorkflowCreateRequest(BaseModel):
    """工作流创建请求"""
    workflow_id: str = Field(..., description="工作流ID")
    name: str = Field(..., description="工作流名称")
    description: str = Field("", description="工作流描述")

class WorkflowExecuteRequest(BaseModel):
    """工作流执行请求"""
    workflow_id: str = Field(..., description="工作流ID")
    initial_variables: Dict[str, Any] = Field(default_factory=dict, description="初始变量")

# 响应模型
class APIResponse(BaseModel):
    """通用API响应"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@router.post("/generate-test-case", response_model=APIResponse)
async def generate_test_case(
    request: TestCaseGenerationRequest,
    current_user: Dict = Depends(get_current_user)
):
    """生成测试用例"""
    try:
        requirement_data = {
            'title': request.title,
            'description': request.description,
            'priority': request.priority,
            'type': request.type,
            'acceptance_criteria': request.acceptance_criteria,
            'business_value': request.business_value
        }
        
        result = await ai_service.generate_test_case_from_requirement(
            requirement_data=requirement_data,
            provider=request.provider,
            use_rag=request.use_rag
        )
        
        if result.get('success'):
            return APIResponse(
                success=True,
                message="测试用例生成成功",
                data=result
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"生成失败: {result.get('error')}"
            )
            
    except Exception as e:
        logger.error(f"生成测试用例API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-test-results", response_model=APIResponse)
async def analyze_test_results(
    request: TestAnalysisRequest,
    current_user: Dict = Depends(get_current_user)
):
    """分析测试结果"""
    try:
        result = await ai_service.analyze_test_results(
            test_results=request.test_results,
            provider=request.provider
        )
        
        if result.get('success'):
            return APIResponse(
                success=True,
                message="测试结果分析成功",
                data=result
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"分析失败: {result.get('error')}"
            )
            
    except Exception as e:
        logger.error(f"分析测试结果API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-test-report", response_model=APIResponse)
async def generate_test_report(
    request: TestReportRequest,
    current_user: Dict = Depends(get_current_user)
):
    """生成测试报告"""
    try:
        result = await ai_service.generate_test_report(
            execution_data=request.execution_data,
            provider=request.provider
        )
        
        if result.get('success'):
            return APIResponse(
                success=True,
                message="测试报告生成成功",
                data=result
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"生成失败: {result.get('error')}"
            )
            
    except Exception as e:
        logger.error(f"生成测试报告API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/knowledge/add", response_model=APIResponse)
async def add_knowledge_document(
    request: KnowledgeDocumentRequest,
    current_user: Dict = Depends(get_current_user)
):
    """添加知识文档"""
    try:
        result = await ai_service.add_knowledge_document(
            title=request.title,
            content=request.content,
            source=request.source,
            category=request.category,
            metadata=request.metadata
        )
        
        if result.get('success'):
            return APIResponse(
                success=True,
                message="知识文档添加成功",
                data=result
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"添加失败: {result.get('error')}"
            )
            
    except Exception as e:
        logger.error(f"添加知识文档API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/knowledge/search", response_model=APIResponse)
async def search_knowledge(
    request: KnowledgeSearchRequest,
    current_user: Dict = Depends(get_current_user)
):
    """搜索知识库"""
    try:
        result = await ai_service.search_knowledge(
            query=request.query,
            top_k=request.top_k,
            category=request.category
        )
        
        if result.get('success'):
            return APIResponse(
                success=True,
                message="知识搜索成功",
                data=result
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"搜索失败: {result.get('error')}"
            )
            
    except Exception as e:
            logger.error(f"搜索知识API错误: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/knowledge/import", response_model=APIResponse)
async def import_knowledge_files(
    files: List[UploadFile] = File(...),
    category: str = Form("general"),
    source: str = Form("upload"),
    current_user: Dict = Depends(get_current_user)
):
    """导入知识文档文件"""
    try:
        from services.ai.knowledge_importer import parse_multiple_files
        file_payload = []
        for f in files:
            content = await f.read()
            file_payload.append((f.filename, content))

        parsed_docs = parse_multiple_files(file_payload)
        created = []
        for doc in parsed_docs:
            result = await ai_service.add_knowledge_document(
                title=doc["title"],
                content=doc["content"],
                source=source or "upload",
                category=category or "general",
                metadata={"file_name": doc["title"]}
            )
            created.append(result)

        return APIResponse(
            success=True,
            message="导入成功",
            data={"count": len(created), "documents": created}
        )
    except Exception as e:
        logger.error(f"导入知识文档失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/workflow/create", response_model=APIResponse)
async def create_workflow(
    request: WorkflowCreateRequest,
    current_user: Dict = Depends(get_current_user)
):
    """创建工作流"""
    try:
        result = await ai_service.create_test_generation_workflow(
            workflow_id=request.workflow_id,
            name=request.name
        )
        
        if result.get('success'):
            return APIResponse(
                success=True,
                message="工作流创建成功",
                data=result
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"创建失败: {result.get('error')}"
            )
            
    except Exception as e:
        logger.error(f"创建工作流API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/workflow/execute", response_model=APIResponse)
async def execute_workflow(
    request: WorkflowExecuteRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
):
    """执行工作流"""
    try:
        result = await ai_service.execute_test_generation_workflow(
            workflow_id=request.workflow_id,
            requirement_data=request.initial_variables
        )
        
        if result.get('success'):
            return APIResponse(
                success=True,
                message="工作流执行已启动",
                data=result
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"执行失败: {result.get('error')}"
            )
            
    except Exception as e:
        logger.error(f"执行工作流API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workflow/status/{execution_id}", response_model=APIResponse)
async def get_workflow_status(
    execution_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """获取工作流执行状态"""
    try:
        result = ai_service.get_workflow_status(execution_id)
        
        if 'error' not in result:
            return APIResponse(
                success=True,
                message="获取状态成功",
                data=result
            )
        else:
            raise HTTPException(
                status_code=404,
                detail=result.get('error')
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取工作流状态API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status", response_model=APIResponse)
async def get_ai_status(current_user: Dict = Depends(get_current_user)):
    """获取AI服务状态"""
    try:
        result = ai_service.get_ai_status()
        
        if result.get('success'):
            return APIResponse(
                success=True,
                message="获取AI状态成功",
                data=result
            )
        else:
            return APIResponse(
                success=False,
                message="获取AI状态失败",
                error=result.get('error')
            )
            
    except Exception as e:
        logger.error(f"获取AI状态API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/providers", response_model=APIResponse)
async def get_available_providers(current_user: Dict = Depends(get_current_user)):
    """获取可用的AI提供商"""
    try:
        from services.ai.llm_client import llm_client
        providers = llm_client.get_available_providers()
        
        return APIResponse(
            success=True,
            message="获取提供商列表成功",
            data={"providers": providers}
        )
        
    except Exception as e:
        logger.error(f"获取提供商API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/knowledge/list", response_model=APIResponse)
async def get_knowledge_list(current_user: Dict = Depends(get_current_user)):
    """获取知识库文档列表"""
    try:
        from services.ai.rag_engine import rag_engine
        documents = rag_engine.get_all_documents()
        
        return APIResponse(
            success=True,
            message="获取知识库列表成功",
            data=documents
        )
        
    except Exception as e:
        logger.error(f"获取知识库列表API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/knowledge/{document_id}", response_model=APIResponse)
async def delete_knowledge_document(
    document_id: int,
    current_user: Dict = Depends(get_current_user)
):
    """删除知识库文档"""
    try:
        from services.ai.rag_engine import rag_engine
        result = rag_engine.delete_document(document_id)
        
        if result.get('success'):
            return APIResponse(
                success=True,
                message="知识文档删除成功",
                data=result
            )
        else:
            raise HTTPException(
                status_code=404,
                detail=f"删除失败: {result.get('error')}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
            logger.error(f"删除知识文档API错误: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/knowledge/{document_id}/links", response_model=APIResponse)
async def update_knowledge_links(
    document_id: int,
    request: KnowledgeLinkRequest,
    current_user: Dict = Depends(get_current_user)
):
    """更新知识文档关联关系"""
    try:
        from services.ai.rag_engine import rag_engine
        result = rag_engine.update_document_links(
            document_id=document_id,
            requirement_ids=request.requirement_ids,
            testcase_ids=request.testcase_ids
        )
        if result.get('success'):
            return APIResponse(
                success=True,
                message="关联更新成功",
                data=result
            )
        else:
            raise HTTPException(status_code=400, detail=result.get('error'))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新知识文档关联API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/knowledge/categories", response_model=APIResponse)
async def get_knowledge_categories(current_user: Dict = Depends(get_current_user)):
    """获取知识库分类"""
    try:
        from services.ai.rag_engine import rag_engine
        categories = rag_engine.get_categories()
        
        return APIResponse(
            success=True,
            message="获取分类列表成功",
            data={"categories": categories}
        )
        
    except Exception as e:
        logger.error(f"获取知识分类API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workflows", response_model=APIResponse)
async def get_workflows(current_user: Dict = Depends(get_current_user)):
    """获取所有工作流"""
    try:
        from services.ai.workflow_engine import workflow_engine
        workflows = workflow_engine.get_workflows()
        
        return APIResponse(
            success=True,
            message="获取工作流列表成功",
            data={"workflows": workflows}
        )
        
    except Exception as e:
        logger.error(f"获取工作流API错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))
