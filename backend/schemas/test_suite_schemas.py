from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from schemas.response_schemas import ORMModel, TestCaseResponse

class TestSuiteBase(ORMModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    project_id: int

class TestSuiteCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    project_id: Optional[int] = None

class TestSuiteUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None

class TestSuiteResponse(TestSuiteBase):
    id: int
    created_at: datetime
    updated_at: datetime
    testcases: Optional[List[TestCaseResponse]] = []

class SetupTestCaseInSuite(BaseModel):
    testcase_ids: List[int]
