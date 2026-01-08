from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from api.deps import get_db
from models.database_models import RuleTemplate, RuleDefinition, AssertionRule
from services.rule_engine_service import RuleEngineService
from datetime import datetime

router = APIRouter()


class AssertionRuleCreate(BaseModel):
    assertion_type: str
    field_path: Optional[str] = None
    operator: Optional[str] = "=="
    expected_value: Optional[str] = None
    error_message: Optional[str] = None


class RuleDefinitionCreate(BaseModel):
    rule_type: str
    rule_config: Optional[dict] = None
    execution_order: int = 0
    is_required: bool = True
    assertions: List[AssertionRuleCreate] = []


class RuleTemplateCreate(BaseModel):
    name: str
    category: str
    protocol: str
    description: Optional[str] = None
    is_enabled: bool = True
    priority: int = 0
    rule_definitions: List[RuleDefinitionCreate] = []


class RuleTemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    protocol: Optional[str] = None
    description: Optional[str] = None
    is_enabled: Optional[bool] = None
    priority: Optional[int] = None


class GenerateTestCasesRequest(BaseModel):
    api_info: dict
    rule_template_ids: List[int]


@router.get("/templates")
def get_rule_templates(
    protocol: Optional[str] = None,
    category: Optional[str] = None,
    is_enabled: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(RuleTemplate)
    
    if protocol:
        query = query.filter(RuleTemplate.protocol == protocol)
    if category:
        query = query.filter(RuleTemplate.category == category)
    if is_enabled is not None:
        query = query.filter(RuleTemplate.is_enabled == is_enabled)
    
    templates = query.order_by(RuleTemplate.priority.desc()).all()
    
    result = []
    for template in templates:
        result.append({
            "id": template.id,
            "name": template.name,
            "category": template.category,
            "protocol": template.protocol,
            "description": template.description,
            "is_enabled": template.is_enabled,
            "priority": template.priority,
            "rule_count": len(template.rule_definitions),
            "created_at": template.created_at.isoformat() if template.created_at else None,
            "updated_at": template.updated_at.isoformat() if template.updated_at else None
        })
    
    return {"success": True, "data": result}


@router.get("/templates/{template_id}")
def get_rule_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(RuleTemplate).filter(RuleTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="规则模板不存在")
    
    rule_defs = []
    for rule_def in template.rule_definitions:
        assertions = []
        for assertion in rule_def.assertion_rules:
            assertions.append({
                "id": assertion.id,
                "assertion_type": assertion.assertion_type,
                "field_path": assertion.field_path,
                "operator": assertion.operator,
                "expected_value": assertion.expected_value,
                "error_message": assertion.error_message
            })
        
        rule_defs.append({
            "id": rule_def.id,
            "rule_type": rule_def.rule_type,
            "rule_config": rule_def.rule_config,
            "execution_order": rule_def.execution_order,
            "is_required": rule_def.is_required,
            "assertions": assertions
        })
    
    result = {
        "id": template.id,
        "name": template.name,
        "category": template.category,
        "protocol": template.protocol,
        "description": template.description,
        "is_enabled": template.is_enabled,
        "priority": template.priority,
        "rule_definitions": rule_defs,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None
    }
    
    return {"success": True, "data": result}


@router.post("/templates")
def create_rule_template(
    template_data: RuleTemplateCreate,
    db: Session = Depends(get_db)
):
    template = RuleTemplate(
        name=template_data.name,
        category=template_data.category,
        protocol=template_data.protocol,
        description=template_data.description,
        is_enabled=template_data.is_enabled,
        priority=template_data.priority
    )
    
    db.add(template)
    db.flush()
    
    for rule_def_data in template_data.rule_definitions:
        rule_def = RuleDefinition(
            template_id=template.id,
            rule_type=rule_def_data.rule_type,
            rule_config=rule_def_data.rule_config,
            execution_order=rule_def_data.execution_order,
            is_required=rule_def_data.is_required
        )
        db.add(rule_def)
        db.flush()
        
        for assertion_data in rule_def_data.assertions:
            assertion = AssertionRule(
                rule_definition_id=rule_def.id,
                assertion_type=assertion_data.assertion_type,
                field_path=assertion_data.field_path,
                operator=assertion_data.operator,
                expected_value=assertion_data.expected_value,
                error_message=assertion_data.error_message
            )
            db.add(assertion)
    
    db.commit()
    db.refresh(template)
    
    return {
        "success": True,
        "message": "规则模板创建成功",
        "data": {"id": template.id}
    }


@router.put("/templates/{template_id}")
def update_rule_template(
    template_id: int,
    template_data: RuleTemplateUpdate,
    db: Session = Depends(get_db)
):
    template = db.query(RuleTemplate).filter(RuleTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="规则模板不存在")
    
    if template_data.name is not None:
        template.name = template_data.name
    if template_data.category is not None:
        template.category = template_data.category
    if template_data.protocol is not None:
        template.protocol = template_data.protocol
    if template_data.description is not None:
        template.description = template_data.description
    if template_data.is_enabled is not None:
        template.is_enabled = template_data.is_enabled
    if template_data.priority is not None:
        template.priority = template_data.priority
    
    template.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"success": True, "message": "规则模板更新成功"}


@router.delete("/templates/{template_id}")
def delete_rule_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(RuleTemplate).filter(RuleTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="规则模板不存在")
    
    db.delete(template)
    db.commit()
    
    return {"success": True, "message": "规则模板删除成功"}


@router.post("/generate-testcases")
def generate_testcases(
    request: GenerateTestCasesRequest,
    db: Session = Depends(get_db)
):
    rule_engine = RuleEngineService(db)
    
    try:
        testcases = rule_engine.generate_testcases_by_rules(
            request.api_info,
            request.rule_template_ids
        )
        
        return {
            "success": True,
            "message": f"成功生成 {len(testcases)} 个测试用例",
            "data": testcases
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成测试用例失败: {str(e)}")


@router.get("/categories")
def get_rule_categories():
    categories = [
        {"value": "correctness", "label": "正确性"},
        {"value": "security", "label": "安全性"},
        {"value": "performance", "label": "性能"},
        {"value": "compatibility", "label": "兼容性"}
    ]
    return {"success": True, "data": categories}


@router.get("/rule-types")
def get_rule_types():
    rule_types = [
        {"value": "status_code_check", "label": "状态码检查"},
        {"value": "response_time_check", "label": "响应时间检查"},
        {"value": "response_structure_check", "label": "响应结构检查"},
        {"value": "field_value_check", "label": "字段值检查"},
        {"value": "business_logic_check", "label": "业务逻辑检查"}
    ]
    return {"success": True, "data": rule_types}


@router.get("/assertion-types")
def get_assertion_types():
    assertion_types = [
        {"value": "equals", "label": "等于"},
        {"value": "not_equals", "label": "不等于"},
        {"value": "contains", "label": "包含"},
        {"value": "not_contains", "label": "不包含"},
        {"value": "greater_than", "label": "大于"},
        {"value": "less_than", "label": "小于"},
        {"value": "in_range", "label": "在范围内"},
        {"value": "regex", "label": "正则匹配"},
        {"value": "field_exists", "label": "字段存在"},
        {"value": "field_type", "label": "字段类型"}
    ]
    return {"success": True, "data": assertion_types}
