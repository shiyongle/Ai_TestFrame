from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import sessionmaker, Session
from typing import List, Optional
from core.database import get_db, SessionLocal
from models.database_models import Version, Requirement, VersionRequirement, VersionKnowledge, TestCase
from pydantic import BaseModel
from datetime import datetime
from services.ai_generator import ai_generator
from services.ai.ai_service import ai_service
from models.database_models import KnowledgeDocument, TestSuite, TestSuiteCase
from datetime import datetime
from utils.activity_logger import log_activity

router = APIRouter()

# Pydantic模型
class VersionBase(BaseModel):
    version_number: str
    description: Optional[str] = None
    status: str = "draft"
    release_date: Optional[datetime] = None
    created_by: Optional[str] = None
    project_id: Optional[int] = None

class VersionCreate(VersionBase):
    changes: dict = {}

class VersionUpdate(VersionBase):
    changes: dict = {}

class VersionResponse(VersionBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/versions", response_model=VersionResponse)
async def create_version(
    version: VersionCreate,
    db: Session = Depends(get_db)
):
    """创建版本记录"""
    try:
        db_version = Version(**version.dict())
        db.add(db_version)
        db.commit()
        db.refresh(db_version)
        log_activity(db, action="create", module="版本", target_name=db_version.version_number)
        return db_version
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建版本失败: {str(e)}"
        )

@router.get("/versions")
async def get_versions(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """获取版本历史"""
    try:
        query = db.query(Version)
        if project_id:
            query = query.filter(Version.project_id == project_id)
        versions = query.order_by(Version.created_at.desc()).all()
        log_activity(
            db,
            action="query",
            module="版本",
            target_name="版本列表",
            detail=f"project_id={project_id if project_id is not None else 'all'}, 数量={len(versions)}",
        )
        
        # 为每个版本添加关联的需求信息
        result = []
        for version in versions:
            # 获取关联的需求
            version_requirements = db.query(VersionRequirement).filter(
                VersionRequirement.version_id == version.id
            ).all()
            
            requirement_ids = [vr.requirement_id for vr in version_requirements]
            requirements = db.query(Requirement).filter(Requirement.id.in_(requirement_ids)).all()
            
            # 构建版本数据
            version_dict = {
                "id": version.id,
                "version_number": version.version_number,
                "description": version.description,
                "status": version.status,
                "release_date": version.release_date.isoformat() if version.release_date else None,
                "created_at": version.created_at.isoformat() if version.created_at else None,
                "created_by": version.created_by,
                "project_id": version.project_id,
                "project": {"id": version.project.id, "name": version.project.name} if version.project else None,
                "changes": version.changes,
                "requirements": [
                    {
                        "id": req.id,
                        "title": req.title,
                        "description": req.description,
                        "priority": req.priority,
                        "status": req.status,
                        "type": req.type,
                        "project_id": req.project_id,
                        "assigned_to": req.assigned_to,
                        "reporter": req.reporter,
                        "created_at": req.created_at.isoformat() if req.created_at else None
                    }
                    for req in requirements
                ]
            }
            result.append(version_dict)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取版本列表失败: {str(e)}")

@router.get("/versions/{version_id}", response_model=VersionResponse)
async def get_version(
    version_id: int,
    db: Session = Depends(get_db)
):
    """获取指定版本"""
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )
    log_activity(db, action="query", module="版本", target_name=version.version_number, detail=f"版本ID={version_id}")
    return version

@router.put("/versions/{version_id}", response_model=VersionResponse)
async def update_version(
    version_id: int,
    version_update: dict,
    db: Session = Depends(get_db)
):
    """更新版本信息"""
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )
    
    try:
        for field, value in version_update.items():
            if hasattr(version, field):
                setattr(version, field, value)
        db.commit()
        db.refresh(version)
        log_activity(db, action="update", module="版本", target_name=version.version_number, detail=f"版本ID={version_id}")
        return version
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新版本失败: {str(e)}"
        )

@router.delete("/versions/{version_id}")
async def delete_version(
    version_id: int,
    db: Session = Depends(get_db)
):
    """删除版本"""
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )
    
    try:
        version_name = version.version_number
        # 先删除与需求的关联关系
        db.query(VersionRequirement).filter(VersionRequirement.version_id == version_id).delete()
        
        # 删除版本
        db.delete(version)
        db.commit()
        log_activity(db, action="delete", module="版本", target_name=version_name, detail=f"版本ID={version_id}")
        return {"message": "版本删除成功"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除版本失败: {str(e)}"
        )

@router.get("/versions/latest", response_model=VersionResponse)
async def get_latest_version(
    db: Session = Depends(get_db)
):
    """获取最新版本"""
    version = db.query(Version).order_by(Version.created_at.desc()).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有找到任何版本"
        )
    log_activity(db, action="query", module="版本", target_name=version.version_number, detail="查看最新版本")
    return version

@router.post("/versions/{version_id}/requirements")
async def add_requirements_to_version(
    version_id: int,
    requirement_ids: List[int],
    db: Session = Depends(get_db)
):
    """将需求添加到版本中"""
    # 验证版本是否存在
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    # 验证需求是否存在
    requirements = db.query(Requirement).filter(Requirement.id.in_(requirement_ids)).all()
    if len(requirements) != len(requirement_ids):
        raise HTTPException(status_code=404, detail="部分需求不存在")
    
    # 添加关联关系
    for req_id in requirement_ids:
        # 检查是否已经关联
        existing = db.query(VersionRequirement).filter(
            VersionRequirement.version_id == version_id,
            VersionRequirement.requirement_id == req_id
        ).first()
        
        if not existing:
            version_requirement = VersionRequirement(
                version_id=version_id,
                requirement_id=req_id
            )
            db.add(version_requirement)
    
    db.commit()
    log_activity(
        db,
        action="update",
        module="版本",
        target_name=version.version_number,
        detail=f"添加需求: {','.join(map(str, requirement_ids))}",
    )
    return {"message": "需求已成功添加到版本"}

@router.delete("/versions/{version_id}/requirements/{requirement_id}")
async def remove_requirement_from_version(
    version_id: int,
    requirement_id: int,
    db: Session = Depends(get_db)
):
    """从版本中移除需求"""
    version_requirement = db.query(VersionRequirement).filter(
        VersionRequirement.version_id == version_id,
        VersionRequirement.requirement_id == requirement_id
    ).first()
    
    if not version_requirement:
        raise HTTPException(status_code=404, detail="关联关系不存在")
    version = db.query(Version).filter(Version.id == version_id).first()
    db.delete(version_requirement)
    db.commit()
    log_activity(
        db,
        action="update",
        module="版本",
        target_name=version.version_number if version else f"ID={version_id}",
        detail=f"移除需求: {requirement_id}",
    )
    return {"message": "需求已从版本中移除"}

@router.get("/versions/{version_id}/requirements")
async def get_version_requirements(
    version_id: int,
    db: Session = Depends(get_db)
):
    """获取版本中的所有需求"""
    # 验证版本是否存在
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )
    
    # 获取关联的需求
    version_requirements = db.query(VersionRequirement).filter(
        VersionRequirement.version_id == version_id
    ).all()
    
    requirement_ids = [vr.requirement_id for vr in version_requirements]
    requirements = db.query(Requirement).filter(Requirement.id.in_(requirement_ids)).all()
    log_activity(
        db,
        action="query",
        module="版本",
        target_name=version.version_number,
        detail=f"查看关联需求，数量={len(requirements)}",
    )
    return requirements

@router.post("/versions/{version_id}/knowledge")
async def link_knowledge_to_version(
    version_id: int,
    knowledge_ids: List[int],
    db: Session = Depends(get_db)
):
    """将知识文档关联到版本"""
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    # 验证知识文档是否存在
    valid_docs = db.query(KnowledgeDocument).filter(KnowledgeDocument.id.in_(knowledge_ids)).all()
    if len(valid_docs) != len(knowledge_ids):
        raise HTTPException(status_code=404, detail="部分知识文档不存在")
        
    # 首先全量删除已有关系，再重新增加，确保为最新的多选
    db.query(VersionKnowledge).filter(VersionKnowledge.version_id == version_id).delete()
    
    for doc_id in knowledge_ids:
        new_link = VersionKnowledge(version_id=version_id, knowledge_doc_id=doc_id)
        db.add(new_link)
        
    db.commit()
    log_activity(
        db,
        action="update",
        module="版本",
        target_name=version.version_number,
        detail=f"关联知识文档: {','.join(map(str, knowledge_ids))}",
    )
    return {"message": "知识文档已成功关联到版本"}

@router.get("/versions/{version_id}/knowledge")
async def get_version_knowledge(
    version_id: int,
    db: Session = Depends(get_db)
):
    """获取版本关联的知识文档"""
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
        
    links = db.query(VersionKnowledge).filter(VersionKnowledge.version_id == version_id).all()
    doc_ids = [link.knowledge_doc_id for link in links]
    docs = db.query(KnowledgeDocument).filter(KnowledgeDocument.id.in_(doc_ids)).all()
    log_activity(
        db,
        action="query",
        module="版本",
        target_name=version.version_number,
        detail=f"查看关联知识文档，数量={len(docs)}",
    )
    return docs

@router.post("/versions/{version_id}/generate-testcases")
async def generate_test_cases_for_version(
    version_id: int,
    request: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """为版本关联的需求生成测试用例（后台异步执行并自带绑定的RAG上下文）"""
    model = request.get("model", "glm")
    
    # 验证版本是否存在
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )
    
    # 获取版本关联的需求
    version_requirements = db.query(VersionRequirement).filter(
        VersionRequirement.version_id == version_id
    ).all()
    
    if not version_requirements:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该版本没有关联任何需求"
        )
    
    requirement_ids = [vr.requirement_id for vr in version_requirements]
    requirements = db.query(Requirement).filter(Requirement.id.in_(requirement_ids)).all()
    
    if not requirements:
        raise HTTPException(
            status=status.HTTP_400_BAD_REQUEST,
            detail="未找到有效的需求"
        )
        
    # 查询当前版本具体关联的RAG知识库文档，组装硬性上下文
    linked_knowledge_entries = db.query(VersionKnowledge).filter(
        VersionKnowledge.version_id == version_id
    ).all()
    
    explicit_context = ""
    if linked_knowledge_entries:
        doc_ids = [k.knowledge_doc_id for k in linked_knowledge_entries]
        docs = db.query(KnowledgeDocument).filter(KnowledgeDocument.id.in_(doc_ids)).all()
        parts = []
        for doc in docs:
            parts.append(f"【{doc.title}】\n{doc.content}")
        explicit_context = "\n\n".join(parts)
        
    project_id = version.project_id
    log_activity(
        db,
        action="generate",
        module="版本",
        target_name=version.version_number,
        detail=f"开始生成测试用例，model={model}",
    )

    async def _bg_generate_testcases(
        reqs: List[Requirement],
        req_explicit_context: str,
        ai_model: str,
        proj_id: int,
        ver_number: str
    ):
        """后台异步处理测使用例生成和入库逻辑"""
        try:
            # We must use a short-lived DB session in the background
            with SessionLocal() as bg_db:
                newly_created_test_cases = []
                for req in reqs:
                    req_data = {
                        'title': req.title,
                        'description': req.description,
                        'priority': req.priority,
                        'type': req.type,
                        'acceptance_criteria': req.acceptance_criteria,
                        'business_value': req.business_value
                    }
                    
                    res = await ai_service.generate_test_case_from_requirement(
                        req_data, 
                        provider=ai_model, 
                        use_rag=True, 
                        explicit_context=req_explicit_context if req_explicit_context else None
                    )
                    
                    if res.get('success'):
                        test_cases_json = res.get('test_case', [])
                        
                        # Handle potential string format error in case parsing fails earlier
                        if isinstance(test_cases_json, str):
                            import json
                            try:
                                test_cases_json = json.loads(test_cases_json)
                            except:
                                test_cases_json = []

                        # Force format to iterable array
                        if not isinstance(test_cases_json, list):
                            test_cases_json = [test_cases_json]

                        for tc_json in test_cases_json:
                            if not isinstance(tc_json, dict):
                                continue

                            tc_name = tc_json.get('name') or tc_json.get('title') or f"[{req.title}] 自动生成用例"
                            tc_desc = tc_json.get('description', '')
                            tc_protocol = tc_json.get('protocol', 'http')
                            
                            # Save directly into TestCase model
                            new_tc = TestCase(
                                name=tc_name,
                                description=tc_desc,
                                protocol=tc_protocol,
                                config=tc_json,
                                project_id=proj_id
                            )
                            bg_db.add(new_tc)
                            newly_created_test_cases.append(new_tc)
                
                # Flush the session to get the auto-incremented IDs for the new test cases
                bg_db.flush()
                
                # If we generated at least one test case, create a Test Suite
                if newly_created_test_cases:
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    suite_name = f"AI-{ver_number}-{timestamp}"
                    suite_desc = f"基于版本 {ver_number} / 需求生成的 AI 测试用例集合"
                    
                    new_suite = TestSuite(
                        name=suite_name,
                        description=suite_desc,
                        project_id=proj_id
                    )
                    bg_db.add(new_suite)
                    bg_db.flush() # Get suite ID
                    
                    # Link them together
                    suite_id = new_suite.id
                    for idx, tc in enumerate(newly_created_test_cases):
                        suite_case_link = TestSuiteCase(
                            suite_id=suite_id,
                            testcase_id=tc.id,
                            order_index=idx
                        )
                        bg_db.add(suite_case_link)
                
                # Commit ALL generated test cases and the suite
                bg_db.commit()
                print(f"[AI Generate] Successfully saved generated test cases for Version ID {version_id}.")
        except Exception as bg_e:
            import traceback
            traceback.print_exc()

    # Schedule background task
    background_tasks.add_task(
        _bg_generate_testcases,
        requirements,
        explicit_context,
        model,
        project_id,
        version.version_number
    )
    
    return {
        "message": "AI分配任务已提交，系统正在后台生成并保存测试用例",
        "version_id": version_id,
        "model": model,
        "generated_count": 0,
        "testcases": []
    }
