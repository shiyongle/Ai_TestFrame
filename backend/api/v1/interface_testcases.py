from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from api.deps import get_database, get_interface_testcase_service
from models.database_models import Project
from services.interface_import_service import InterfaceImportService

router = APIRouter()


class InterfaceTestCaseBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    protocol: str = Field("http", pattern="^(http|tcp|mq)$")
    method: str = Field("GET", max_length=10)
    url: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    params: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    assertions: Optional[str] = None
    preconditions: Optional[str] = None
    test_data: Optional[str] = None
    notes: Optional[str] = None
    module: Optional[str] = None
    priority: str = Field("medium", max_length=20)
    status: str = Field("active", max_length=20)
    last_run_status: Optional[str] = None
    last_run_time: Optional[datetime] = None
    project_id: int


class InterfaceTestCaseCreate(InterfaceTestCaseBase):
    pass


class InterfaceTestCaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    protocol: Optional[str] = None
    method: Optional[str] = None
    url: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    params: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    assertions: Optional[str] = None
    preconditions: Optional[str] = None
    test_data: Optional[str] = None
    notes: Optional[str] = None
    module: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    last_run_status: Optional[str] = None
    last_run_time: Optional[datetime] = None
    project_id: Optional[int] = None


class InterfaceTestCaseResponse(InterfaceTestCaseBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InterfaceTestCaseImportResponse(BaseModel):
    imported_count: int
    skipped_count: int = 0
    source_type: str
    created_cases: List[InterfaceTestCaseResponse]


@router.get("/interface-testcases", response_model=List[InterfaceTestCaseResponse])
async def get_all_interface_testcases(
    project_id: Optional[int] = None,
    db: Session = Depends(get_database),
    service=Depends(get_interface_testcase_service),
):
    if project_id:
        return service.get_by_project(db, project_id)
    return service.get_all(db)


@router.get("/interface-testcases/{case_id}", response_model=InterfaceTestCaseResponse)
async def get_interface_testcase(
    case_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_interface_testcase_service),
):
    obj = service.get_one(db, case_id)
    if not obj:
        raise HTTPException(status_code=404, detail="接口测试用例不存在")
    return obj


@router.post("/interface-testcases", response_model=InterfaceTestCaseResponse)
async def create_interface_testcase(
    payload: InterfaceTestCaseCreate,
    db: Session = Depends(get_database),
    service=Depends(get_interface_testcase_service),
):
    return service.create(db, payload.model_dump())


@router.put("/interface-testcases/{case_id}", response_model=InterfaceTestCaseResponse)
async def update_interface_testcase(
    case_id: int,
    payload: InterfaceTestCaseUpdate,
    db: Session = Depends(get_database),
    service=Depends(get_interface_testcase_service),
):
    obj = service.update(db, case_id, payload.model_dump(exclude_unset=True))
    if not obj:
        raise HTTPException(status_code=404, detail="接口测试用例不存在")
    return obj


@router.delete("/interface-testcases/{case_id}")
async def delete_interface_testcase(
    case_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_interface_testcase_service),
):
    ok = service.delete(db, case_id)
    if not ok:
        raise HTTPException(status_code=404, detail="接口测试用例不存在")
    return {"message": "接口测试用例删除成功"}


@router.post("/interface-testcases/import", response_model=InterfaceTestCaseImportResponse)
async def import_interface_testcases(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    module: Optional[str] = Form(None),
    max_cases: int = Form(300),
    db: Session = Depends(get_database),
    service=Depends(get_interface_testcase_service),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="所属项目不存在")

    if max_cases <= 0:
        raise HTTPException(status_code=400, detail="max_cases 必须大于 0")
    max_cases = min(max_cases, 1000)

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="导入文件为空")

        importer = InterfaceImportService()
        cases_payload, source_type = importer.parse_file(
            file_name=file.filename or "unnamed",
            file_bytes=content,
            project_id=project_id,
            module=module,
            max_cases=max_cases,
        )
        if not cases_payload:
            raise HTTPException(status_code=400, detail="未识别到可导入的接口定义")

        created_cases = service.bulk_create(db, cases_payload)

        return InterfaceTestCaseImportResponse(
            imported_count=len(created_cases),
            skipped_count=0,
            source_type=source_type,
            created_cases=created_cases,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"导入失败: {exc}") from exc
