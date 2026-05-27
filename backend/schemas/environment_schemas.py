from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class EnvironmentCreate(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    project_id: Optional[int] = None
    base_url: Optional[str] = None
    description: Optional[str] = None
    status: str = "active"
    is_default: bool = False
    pre_script: Optional[str] = None
    post_script: Optional[str] = None
    created_by: str = "system"


class EnvironmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    project_id: Optional[int] = None
    base_url: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    is_default: Optional[bool] = None
    pre_script: Optional[str] = None
    post_script: Optional[str] = None


class EnvironmentVariableCreate(BaseModel):
    key: str = Field(..., max_length=100)
    value: Optional[str] = None
    variable_type: str = Field("normal", pattern="^(normal|secret|dynamic)$")
    description: Optional[str] = None
    enabled: bool = True


class EnvironmentVariableUpdate(BaseModel):
    key: Optional[str] = None
    value: Optional[str] = None
    variable_type: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None


class AccountPoolCreate(BaseModel):
    name: str = Field(..., max_length=100)
    strategy: str = Field("round_robin", pattern="^(round_robin|first)$")
    accounts: List[Dict[str, Any]] = []
    enabled: bool = True


class AccountPoolUpdate(BaseModel):
    name: Optional[str] = None
    strategy: Optional[str] = None
    accounts: Optional[List[Dict[str, Any]]] = None
    enabled: Optional[bool] = None


class DataPoolCreate(BaseModel):
    name: str = Field(..., max_length=100)
    strategy: str = Field("round_robin", pattern="^(round_robin|first)$")
    rows: List[Dict[str, Any]] = []
    enabled: bool = True


class DataPoolUpdate(BaseModel):
    name: Optional[str] = None
    strategy: Optional[str] = None
    rows: Optional[List[Dict[str, Any]]] = None
    enabled: Optional[bool] = None
