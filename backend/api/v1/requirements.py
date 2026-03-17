from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from core.database import get_db, SessionLocal
from models.database_models import Requirement, Project, TestCase, TestSuite, TestSuiteCase
from pydantic import BaseModel
from datetime import datetime
from services.ai.ai_service import ai_service
from utils.activity_logger import log_activity

router = APIRouter()

# Pydantic模型
class RequirementBase(BaseModel):
    title: str
    description: str
    priority: str = "medium"
    status: str = "draft"
    type: str = "functional"
    project_id: int
    assigned_to: Optional[str] = None
    reporter: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[int] = None
    actual_hours: Optional[int] = None
    acceptance_criteria: Optional[str] = None
    business_value: Optional[str] = None
    tags: Optional[List[str]] = None
    attachments: Optional[List[str]] = None
    comments: Optional[List[dict]] = None
    linked_test_cases: Optional[List[dict]] = None
    linked_functional_test_cases: int = 0
    linked_interface_test_cases: int = 0

class RequirementCreate(RequirementBase):
    pass

class RequirementUpdate(RequirementBase):
    pass

class RequirementResponse(RequirementBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/requirements", response_model=List[RequirementResponse])
async def get_requirements(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取需求列表"""
    query = db.query(Requirement)
    
    if project_id:
        query = query.filter(Requirement.project_id == project_id)
    if status:
        query = query.filter(Requirement.status == status)
    if priority:
        query = query.filter(Requirement.priority == priority)
    
    requirements = query.offset(skip).limit(limit).all()
    log_activity(
        db,
        action="query",
        module="需求",
        target_name="需求列表",
        detail=f"project_id={project_id if project_id is not None else 'all'}, status={status or 'all'}, priority={priority or 'all'}, 数量={len(requirements)}",
    )
    return requirements

@router.get("/requirements/{requirement_id}", response_model=RequirementResponse)
async def get_requirement(requirement_id: int, db: Session = Depends(get_db)):
    """获取单个需求详情"""
    requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="需求不存在"
        )
    log_activity(db, action="query", module="需求", target_name=requirement.title, detail=f"需求ID={requirement_id}")
    return requirement

@router.post("/requirements", response_model=RequirementResponse)
async def create_requirement(
    requirement: RequirementCreate,
    db: Session = Depends(get_db)
):
    """创建新需求"""
    # 验证项目是否存在
    project = db.query(Project).filter(Project.id == requirement.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    db_requirement = Requirement(**requirement.dict())
    db.add(db_requirement)
    db.commit()
    db.refresh(db_requirement)
    log_activity(db, action="create", module="需求", target_name=db_requirement.title, detail=f"需求ID={db_requirement.id}")
    return db_requirement

@router.put("/requirements/{requirement_id}", response_model=RequirementResponse)
async def update_requirement(
    requirement_id: int,
    requirement_update: RequirementUpdate,
    db: Session = Depends(get_db)
):
    """更新需求"""
    db_requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not db_requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="需求不存在"
        )
    
    # 验证项目是否存在
    if requirement_update.project_id:
        project = db.query(Project).filter(Project.id == requirement_update.project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="项目不存在"
            )
    
    update_data = requirement_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_requirement, field, value)
    
    db_requirement.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_requirement)
    log_activity(db, action="update", module="需求", target_name=db_requirement.title, detail=f"需求ID={requirement_id}")
    return db_requirement

@router.delete("/requirements/{requirement_id}")
async def delete_requirement(requirement_id: int, db: Session = Depends(get_db)):
    """删除需求"""
    db_requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not db_requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="需求不存在"
        )
    
    try:
        target_title = db_requirement.title
        # 先删除与版本的关联关系
        from models.database_models import VersionRequirement
        db.query(VersionRequirement).filter(VersionRequirement.requirement_id == requirement_id).delete()
        
        # 删除需求
        db.delete(db_requirement)
        db.commit()
        log_activity(db, action="delete", module="需求", target_name=target_title, detail=f"需求ID={requirement_id}")
        return {"message": "需求删除成功"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除需求失败: {str(e)}"
        )

@router.get("/projects/{project_id}/requirements", response_model=List[RequirementResponse])
async def get_project_requirements(
    project_id: int,
    db: Session = Depends(get_db)
):
    """获取项目的所有需求"""
    # 验证项目是否存在
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    requirements = db.query(Requirement).filter(Requirement.project_id == project_id).all()
    log_activity(db, action="query", module="需求", target_name=f"项目ID={project_id}", detail=f"查看项目需求，数量={len(requirements)}")
    return requirements

@router.post("/requirements/{requirement_id}/comments")
async def add_requirement_comment(
    requirement_id: int,
    comment: dict,
    db: Session = Depends(get_db)
):
    """添加需求评论"""
    db_requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not db_requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="需求不存在"
        )
    
    # 添加评论
    if not db_requirement.comments:
        db_requirement.comments = []
    
    comment_data = {
        "id": len(db_requirement.comments) + 1,
        "author": comment.get("author"),
        "content": comment.get("content"),
        "created_at": datetime.utcnow().isoformat()
    }
    
    db_requirement.comments.append(comment_data)
    db_requirement.updated_at = datetime.utcnow()
    db.commit()
    log_activity(db, action="update", module="需求", target_name=db_requirement.title, detail=f"添加评论，需求ID={requirement_id}")
    return {"message": "评论添加成功", "comment": comment_data}

@router.post("/requirements/{requirement_id}/link-testcases")
async def link_testcases_to_requirement(
    requirement_id: int,
    link_data: dict,
    db: Session = Depends(get_db)
):
    """关联测试用例到需求"""
    db_requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not db_requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="需求不存在"
        )
    
    # 更新关联的测试用例数量
    db_requirement.linked_functional_test_cases = link_data.get("functional_count", 0)
    db_requirement.linked_interface_test_cases = link_data.get("interface_count", 0)
    
    # 更新关联的测试用例列表
    if link_data.get("test_cases"):
        db_requirement.linked_test_cases = link_data["test_cases"]
    
    db_requirement.updated_at = datetime.utcnow()
    db.commit()
    log_activity(
        db,
        action="update",
        module="需求",
        target_name=db_requirement.title,
        detail=f"关联测试用例，functional={db_requirement.linked_functional_test_cases}, interface={db_requirement.linked_interface_test_cases}",
    )
    return {"message": "测试用例关联成功"}


@router.post("/requirements/{requirement_id}/generate-testcases")
async def generate_test_cases_for_requirement(
    requirement_id: int,
    request: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """为单一需求生成测试用例（后台异步执行）"""
    model = request.get("model", "glm")
    
    # 验证需求是否存在
    requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="需求不存在"
        )
    log_activity(
        db,
        action="generate",
        module="需求",
        target_name=requirement.title,
        detail=f"开始生成测试用例，model={model}",
    )
        
    project_id = requirement.project_id

    async def _bg_generate_testcases(
        req: Requirement,
        ai_model: str,
        proj_id: int
    ):
        """后台异步处理独立需求的测试用例生成和入库逻辑"""
        try:
            # We must use a short-lived DB session in the background
            with SessionLocal() as bg_db:
                newly_created_test_cases = []
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
                    explicit_context=None
                )
                
                if res.get('success'):
                    test_cases_json = res.get('test_case', [])
                    
                    if isinstance(test_cases_json, str):
                        import json
                        try:
                            test_cases_json = json.loads(test_cases_json)
                        except:
                            test_cases_json = []

                    if not isinstance(test_cases_json, list):
                        test_cases_json = [test_cases_json]

                    for tc_json in test_cases_json:
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
                        newly_created_test_cases.append(new_tc)
                
                bg_db.flush()
                
                if newly_created_test_cases:
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    suite_name = f"AI-Req{req.id}-{timestamp}"
                    suite_desc = f"基于需求: {req.title} 生成的 AI 测试用例集合"
                    
                    new_suite = TestSuite(
                        name=suite_name,
                        description=suite_desc,
                        project_id=proj_id
                    )
                    bg_db.add(new_suite)
                    bg_db.flush() 
                    
                    suite_id = new_suite.id
                    for idx, tc in enumerate(newly_created_test_cases):
                        suite_case_link = TestSuiteCase(
                            suite_id=suite_id,
                            testcase_id=tc.id,
                            order_index=idx
                        )
                        bg_db.add(suite_case_link)
                
                bg_db.commit()
                
        except Exception as e:
            print(f"Agentic 生成单一需求测试用例流程中发生崩溃: {e}")
            import traceback
            traceback.print_exc()

    # 提交后台任务
    background_tasks.add_task(
        _bg_generate_testcases,
        req=requirement,
        ai_model=model,
        proj_id=project_id,
    )
    
    return {"message": "AI 开始在后台生成用例，请稍后在测试大库中查看"}
