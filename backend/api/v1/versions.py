from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import sessionmaker, Session
from typing import List, Optional
from core.database import get_db, SessionLocal
from models.database_models import Version, Requirement, VersionRequirement, VersionKnowledge, TestCase
from pydantic import BaseModel
from datetime import datetime
from services.ai.ai_service import ai_service
from models.database_models import (
    KnowledgeDocument,
    TestSuite,
    TestSuiteCase,
    AIGenerationSession,
    AIGeneratedCaseEvidence,
    AIGeneratedCaseCitation,
)
from utils.activity_logger import log_activity
import json
import uuid


def _recalculate_ai_session_stats(db: Session, session_row: AIGenerationSession) -> None:
    evidence_rows = db.query(AIGeneratedCaseEvidence).filter(
        AIGeneratedCaseEvidence.session_id == session_row.id
    ).all()
    evidence_ids = [row.id for row in evidence_rows]
    total_citations = db.query(AIGeneratedCaseCitation).filter(
        AIGeneratedCaseCitation.generated_case_id.in_(evidence_ids)
    ).count() if evidence_ids else 0
    total_generated_cases = len(evidence_rows)
    total_hit_cases = sum(1 for row in evidence_rows if (row.knowledge_hit_count or 0) > 0)

    session_row.total_generated_cases = total_generated_cases
    session_row.total_hit_cases = total_hit_cases
    session_row.total_citations = total_citations
    session_row.knowledge_hit_rate = round((total_hit_cases / total_generated_cases), 4) if total_generated_cases else 0

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
    """为版本关联的需求生成测试用例（后台异步执行并记录知识命中证据）"""
    model = request.get("model", "glm")

    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )

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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未找到有效的需求"
        )

    linked_knowledge_entries = db.query(VersionKnowledge).filter(
        VersionKnowledge.version_id == version_id
    ).all()
    linked_doc_ids = [k.knowledge_doc_id for k in linked_knowledge_entries]
    linked_docs = []
    explicit_context = ""
    if linked_doc_ids:
        linked_docs = db.query(KnowledgeDocument).filter(KnowledgeDocument.id.in_(linked_doc_ids)).all()
        explicit_context = "\n\n".join([f"【{doc.title}】\n{doc.content}" for doc in linked_docs])

    session_id = uuid.uuid4().hex
    generation_session = AIGenerationSession(
        session_id=session_id,
        version_id=version.id,
        project_id=version.project_id,
        model=model,
        status="pending",
        total_requirements=len(requirements),
        explicit_doc_count=len(linked_docs),
        summary={
            "version_number": version.version_number,
            "requirement_ids": requirement_ids,
            "knowledge_doc_ids": linked_doc_ids,
        }
    )
    db.add(generation_session)
    db.commit()

    project_id = version.project_id
    log_activity(
        db,
        action="generate",
        module="版本",
        target_name=version.version_number,
        detail=f"开始生成测试用例，model={model}，session_id={session_id}",
    )

    async def _bg_generate_testcases(
        reqs: List[Requirement],
        req_explicit_context: str,
        ai_model: str,
        proj_id: int,
        ver_number: str,
        session_identifier: str,
        version_identifier: int,
        explicit_docs: List[dict],
    ):
        """后台异步处理测使用例生成、证据记录与入库逻辑"""
        try:
            with SessionLocal() as bg_db:
                session_row = bg_db.query(AIGenerationSession).filter(
                    AIGenerationSession.session_id == session_identifier
                ).first()
                if not session_row:
                    return

                session_row.status = "running"
                session_row.started_at = datetime.utcnow()
                bg_db.commit()

                newly_created_test_cases = []
                total_hit_cases = 0
                total_citations = 0
                req_summary = []
                explicit_doc_map = {doc["id"]: doc for doc in explicit_docs}
                explicit_title_map = {doc["title"]: doc for doc in explicit_docs}

                for req in reqs:
                    req_data = {
                        'id': req.id,
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

                    if not res.get('success'):
                        req_summary.append({
                            "requirement_id": req.id,
                            "title": req.title,
                            "generated_cases": 0,
                            "hit_cases": 0,
                            "error": res.get('error')
                        })
                        continue

                    test_cases_json = res.get('test_case', [])
                    evidence_list = res.get('evidence', []) or []
                    rag_payload = res.get('rag', {}) or {}

                    if isinstance(test_cases_json, str):
                        try:
                            test_cases_json = json.loads(test_cases_json)
                        except Exception:
                            test_cases_json = []

                    if not isinstance(test_cases_json, list):
                        test_cases_json = [test_cases_json]

                    if not isinstance(evidence_list, list):
                        evidence_list = []

                    local_generated = 0
                    local_hit_cases = 0

                    for case_idx, tc_json in enumerate(test_cases_json):
                        if not isinstance(tc_json, dict):
                            continue

                        tc_name = tc_json.get('name') or tc_json.get('title') or f"[{req.title}] 自动生成用例"
                        tc_desc = tc_json.get('description', '')
                        tc_protocol = tc_json.get('protocol', 'http')

                        new_tc = TestCase(
                            name=tc_name,
                            description=tc_desc,
                            protocol=tc_protocol,
                            config=tc_json,
                            project_id=proj_id
                        )
                        bg_db.add(new_tc)
                        bg_db.flush()
                        newly_created_test_cases.append(new_tc)
                        local_generated += 1

                        evidence_item = evidence_list[case_idx] if case_idx < len(evidence_list) and isinstance(evidence_list[case_idx], dict) else {}
                        generated_case = AIGeneratedCaseEvidence(
                            session_id=session_row.id,
                            testcase_id=new_tc.id,
                            requirement_id=req.id,
                            case_index=int(evidence_item.get('case_index', case_idx) or case_idx),
                            case_title=evidence_item.get('case_title') or tc_name,
                            used_explicit_context=bool(evidence_item.get('used_explicit_context', bool(req_explicit_context))),
                            used_rag=bool(evidence_item.get('used_rag', bool(rag_payload.get('hits')))),
                            knowledge_hit_count=int(evidence_item.get('knowledge_hit_count', 0) or 0),
                            citation_count=int(evidence_item.get('citation_count', 0) or 0),
                            hit_score=float(evidence_item.get('hit_score', 0) or 0),
                            evidence_summary=evidence_item.get('evidence_summary', ''),
                            raw_case=tc_json,
                        )
                        bg_db.add(generated_case)
                        bg_db.flush()

                        citations = evidence_item.get('citations', []) if isinstance(evidence_item.get('citations', []), list) else []
                        if citations:
                            local_hit_cases += 1
                            total_hit_cases += 1

                        for citation in citations:
                            if not isinstance(citation, dict):
                                continue
                            doc_id = citation.get('knowledge_doc_id')
                            doc_title = citation.get('doc_title')
                            if not doc_id and doc_title in explicit_title_map:
                                doc_id = explicit_title_map[doc_title]["id"]
                            citation_row = AIGeneratedCaseCitation(
                                session_id=session_row.id,
                                generated_case_id=generated_case.id,
                                knowledge_doc_id=doc_id,
                                requirement_id=req.id,
                                source_type=citation.get('source_type', 'rag'),
                                evidence_type=citation.get('evidence_type', 'chunk'),
                                chunk_id=citation.get('chunk_id'),
                                chunk_index=citation.get('chunk_index'),
                                doc_title=doc_title,
                                matched_text=citation.get('matched_text'),
                                quote_text=citation.get('quote_text'),
                                similarity_score=float(citation.get('similarity_score', 0) or 0),
                            )
                            bg_db.add(citation_row)
                            total_citations += 1

                        if generated_case.used_explicit_context and generated_case.knowledge_hit_count == 0 and explicit_doc_map:
                            explicit_added = 0
                            for explicit_doc in explicit_docs:
                                bg_db.add(AIGeneratedCaseCitation(
                                    session_id=session_row.id,
                                    generated_case_id=generated_case.id,
                                    knowledge_doc_id=explicit_doc.get('id'),
                                    requirement_id=req.id,
                                    source_type='explicit',
                                    evidence_type='document',
                                    chunk_id=None,
                                    chunk_index=None,
                                    doc_title=explicit_doc.get('title'),
                                    matched_text=explicit_doc.get('content', '')[:160],
                                    quote_text=explicit_doc.get('content', '')[:160],
                                    similarity_score=0.85,
                                ))
                                explicit_added += 1
                                total_citations += 1

                            if explicit_added > 0:
                                generated_case.knowledge_hit_count += explicit_added
                                generated_case.citation_count += explicit_added
                                generated_case.hit_score = max(generated_case.hit_score or 0, 0.85)
                                generated_case.evidence_summary = generated_case.evidence_summary or f'关联并引用 {explicit_added} 条显式知识文档作为辅助参考'
                                if local_hit_cases < local_generated:
                                    local_hit_cases += 1
                                    total_hit_cases += 1

                    req_summary.append({
                        "requirement_id": req.id,
                        "title": req.title,
                        "generated_cases": local_generated,
                        "hit_cases": local_hit_cases,
                        "rag_status": rag_payload.get('status') if isinstance(rag_payload, dict) else None,
                    })

                if newly_created_test_cases:
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    new_suite = TestSuite(
                        name=f"AI-{ver_number}-{timestamp}",
                        description=f"基于版本 {ver_number} / 需求生成的 AI 测试用例集合",
                        project_id=proj_id
                    )
                    bg_db.add(new_suite)
                    bg_db.flush()

                    for idx, tc in enumerate(newly_created_test_cases):
                        bg_db.add(TestSuiteCase(
                            suite_id=new_suite.id,
                            testcase_id=tc.id,
                            order_index=idx
                        ))

                session_row.status = "completed"
                session_row.total_generated_cases = len(newly_created_test_cases)
                session_row.total_hit_cases = total_hit_cases
                session_row.total_citations = total_citations
                session_row.knowledge_hit_rate = round((total_hit_cases / len(newly_created_test_cases)), 4) if newly_created_test_cases else 0
                session_row.completed_at = datetime.utcnow()
                session_row.summary = {
                    "version_id": version_identifier,
                    "version_number": ver_number,
                    "requirements": req_summary,
                    "suite_name": f"AI-{ver_number}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                }
                bg_db.commit()
                print(f"[AI Generate] Successfully saved generated test cases and evidence for Version ID {version_identifier}.")
        except Exception as bg_e:
            with SessionLocal() as err_db:
                session_row = err_db.query(AIGenerationSession).filter(
                    AIGenerationSession.session_id == session_identifier
                ).first()
                if session_row:
                    session_row.status = "failed"
                    session_row.error_message = str(bg_e)
                    session_row.completed_at = datetime.utcnow()
                    err_db.commit()
            import traceback
            traceback.print_exc()

    background_tasks.add_task(
        _bg_generate_testcases,
        requirements,
        explicit_context,
        model,
        project_id,
        version.version_number,
        session_id,
        version.id,
        [
            {"id": doc.id, "title": doc.title, "content": doc.content}
            for doc in linked_docs
        ],
    )

    return {
        "message": "AI分配任务已提交，系统正在后台生成并保存测试用例",
        "version_id": version_id,
        "model": model,
        "session_id": session_id,
        "generated_count": 0,
        "testcases": []
    }

@router.get("/versions/{version_id}/ai-generation-sessions")
async def get_version_ai_generation_sessions(
    version_id: int,
    db: Session = Depends(get_db)
):
    """获取版本下的 AI 生成会话列表"""
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    sessions = db.query(AIGenerationSession).filter(
        AIGenerationSession.version_id == version_id
    ).order_by(AIGenerationSession.created_at.desc()).all()

    return [
        {
            "session_id": item.session_id,
            "version_id": item.version_id,
            "project_id": item.project_id,
            "model": item.model,
            "status": item.status,
            "total_requirements": item.total_requirements,
            "total_generated_cases": item.total_generated_cases,
            "total_hit_cases": item.total_hit_cases,
            "total_citations": item.total_citations,
            "explicit_doc_count": item.explicit_doc_count,
            "knowledge_hit_rate": item.knowledge_hit_rate,
            "summary": item.summary,
            "error_message": item.error_message,
            "started_at": item.started_at.isoformat() if item.started_at else None,
            "completed_at": item.completed_at.isoformat() if item.completed_at else None,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }
        for item in sessions
    ]

@router.delete("/versions/{version_id}/ai-generation-evidence/{evidence_id}")
async def delete_version_ai_generation_evidence(
    version_id: int,
    evidence_id: int,
    db: Session = Depends(get_db)
):
    """删除单条 AI 生成证据及其引用明细"""
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    evidence_row = db.query(AIGeneratedCaseEvidence).join(
        AIGenerationSession,
        AIGeneratedCaseEvidence.session_id == AIGenerationSession.id
    ).filter(
        AIGeneratedCaseEvidence.id == evidence_id,
        AIGenerationSession.version_id == version_id
    ).first()
    if not evidence_row:
        raise HTTPException(status_code=404, detail="AI 生成证据不存在")

    session_row = db.query(AIGenerationSession).filter(
        AIGenerationSession.id == evidence_row.session_id
    ).first()
    if not session_row:
        raise HTTPException(status_code=404, detail="关联 AI 生成会话不存在")

    try:
        db.query(AIGeneratedCaseCitation).filter(
            AIGeneratedCaseCitation.generated_case_id == evidence_row.id
        ).delete(synchronize_session=False)
        db.delete(evidence_row)
        db.flush()
        _recalculate_ai_session_stats(db, session_row)
        db.commit()
        return {"message": "AI 生成证据删除成功", "evidence_id": evidence_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除 AI 生成证据失败: {str(e)}")

@router.get("/versions/{version_id}/ai-generation-sessions/{session_id}")
async def get_version_ai_generation_session_detail(
    version_id: int,
    session_id: str,
    db: Session = Depends(get_db)
):
    """获取单次 AI 生成会话详情与知识命中证据"""
    version = db.query(Version).filter(Version.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    session_row = db.query(AIGenerationSession).filter(
        AIGenerationSession.version_id == version_id,
        AIGenerationSession.session_id == session_id
    ).first()
    if not session_row:
        raise HTTPException(status_code=404, detail="AI 生成会话不存在")

    evidence_rows = db.query(AIGeneratedCaseEvidence).filter(
        AIGeneratedCaseEvidence.session_id == session_row.id
    ).order_by(
        AIGeneratedCaseEvidence.requirement_id.asc(),
        AIGeneratedCaseEvidence.case_index.asc(),
        AIGeneratedCaseEvidence.id.asc()
    ).all()

    case_ids = [row.id for row in evidence_rows]
    citation_rows = db.query(AIGeneratedCaseCitation).filter(
        AIGeneratedCaseCitation.generated_case_id.in_(case_ids)
    ).order_by(AIGeneratedCaseCitation.id.asc()).all() if case_ids else []

    citation_map = {}
    for citation in citation_rows:
        citation_map.setdefault(citation.generated_case_id, []).append({
            "id": citation.id,
            "knowledge_doc_id": citation.knowledge_doc_id,
            "requirement_id": citation.requirement_id,
            "source_type": citation.source_type,
            "evidence_type": citation.evidence_type,
            "chunk_id": citation.chunk_id,
            "chunk_index": citation.chunk_index,
            "doc_title": citation.doc_title,
            "matched_text": citation.matched_text,
            "quote_text": citation.quote_text,
            "similarity_score": citation.similarity_score,
            "created_at": citation.created_at.isoformat() if citation.created_at else None,
        })

    evidence_list = []
    for row in evidence_rows:
        evidence_list.append({
            "id": row.id,
            "testcase_id": row.testcase_id,
            "requirement_id": row.requirement_id,
            "case_index": row.case_index,
            "case_title": row.case_title,
            "used_explicit_context": row.used_explicit_context,
            "used_rag": row.used_rag,
            "knowledge_hit_count": row.knowledge_hit_count,
            "citation_count": row.citation_count,
            "hit_score": row.hit_score,
            "evidence_summary": row.evidence_summary,
            "raw_case": row.raw_case,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            "citations": citation_map.get(row.id, []),
        })

    return {
        "session_id": session_row.session_id,
        "version_id": session_row.version_id,
        "project_id": session_row.project_id,
        "model": session_row.model,
        "status": session_row.status,
        "total_requirements": session_row.total_requirements,
        "total_generated_cases": session_row.total_generated_cases,
        "total_hit_cases": session_row.total_hit_cases,
        "total_citations": session_row.total_citations,
        "explicit_doc_count": session_row.explicit_doc_count,
        "knowledge_hit_rate": session_row.knowledge_hit_rate,
        "summary": session_row.summary,
        "error_message": session_row.error_message,
        "started_at": session_row.started_at.isoformat() if session_row.started_at else None,
        "completed_at": session_row.completed_at.isoformat() if session_row.completed_at else None,
        "created_at": session_row.created_at.isoformat() if session_row.created_at else None,
        "updated_at": session_row.updated_at.isoformat() if session_row.updated_at else None,
        "evidence": evidence_list,
    }
