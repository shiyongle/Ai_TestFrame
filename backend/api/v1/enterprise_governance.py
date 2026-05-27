import base64
import hashlib
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.deps import get_database
from config.settings import settings
from core.security import get_user_by_api_token, get_user_by_token, hash_api_token, security
from models.database_models import (
    EnterpriseAccessAudit,
    EnterpriseApiToken,
    EnterpriseApprovalRequest,
    EnterpriseOrganization,
    EnterpriseProjectRole,
    EnterpriseRole,
    EnterpriseSecret,
    EnterpriseSsoProvider,
    EnterpriseTeam,
    EnterpriseTeamMember,
    Project,
    User,
)

router = APIRouter(prefix="/enterprise-governance")


DEFAULT_PERMISSIONS = {
    "platform_admin": ["*"],
    "project_owner": [
        "project:read",
        "project:write",
        "requirement:write",
        "testcase:write",
        "execution:run",
        "defect:manage",
    ],
    "test_manager": ["project:read", "testcase:write", "execution:run", "report:read", "defect:manage"],
    "tester": ["project:read", "testcase:write", "execution:run", "defect:write"],
    "auditor": ["project:read", "report:read", "audit:read"],
}


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class OrganizationPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    code: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = None
    status: str = "active"


class OrganizationResponse(OrganizationPayload, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


class TeamPayload(BaseModel):
    organization_id: int
    name: str = Field(..., min_length=1, max_length=150)
    code: str = Field(..., min_length=1, max_length=80)
    owner: Optional[str] = None
    description: Optional[str] = None
    status: str = "active"


class TeamResponse(TeamPayload, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


class TeamMemberPayload(BaseModel):
    user_id: int
    member_role: str = "member"


class TeamMemberResponse(ORMModel):
    id: int
    team_id: int
    user_id: int
    member_role: str
    joined_at: datetime


class RolePayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    code: str = Field(..., min_length=1, max_length=80)
    scope: str = "project"
    permissions: List[str] = Field(default_factory=list)
    description: Optional[str] = None


class RoleResponse(RolePayload, ORMModel):
    id: int
    built_in: bool
    created_at: datetime
    updated_at: datetime


class ProjectRolePayload(BaseModel):
    user_id: int
    project_id: int
    role_id: Optional[int] = None
    role_code: str = "project_viewer"
    permissions: List[str] = Field(default_factory=list)
    status: str = "active"


class ProjectRoleResponse(ProjectRolePayload, ORMModel):
    id: int
    granted_by: Optional[str] = None
    granted_at: datetime


class SsoProviderPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    provider_type: str = "oidc"
    enabled: bool = False
    issuer_url: Optional[str] = None
    metadata_url: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    ldap_url: Optional[str] = None
    domain: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)


class SsoProviderResponse(SsoProviderPayload, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


class ApiTokenPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    user_id: Optional[int] = None
    scopes: List[str] = Field(default_factory=list)
    expires_at: Optional[datetime] = None


class ApiTokenResponse(ORMModel):
    id: int
    name: str
    token_prefix: str
    user_id: Optional[int] = None
    scopes: Optional[List[str]] = None
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime


class ApiTokenCreatedResponse(ApiTokenResponse):
    token: str


class SecretPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    secret_type: str = "api_key"
    owner_scope: str = "platform"
    owner_id: Optional[int] = None
    secret_value: str = Field(..., min_length=1)
    description: Optional[str] = None
    rotation_period_days: int = 90


class SecretResponse(ORMModel):
    id: int
    name: str
    secret_type: str
    owner_scope: str
    owner_id: Optional[int] = None
    masked_value: Optional[str] = None
    description: Optional[str] = None
    rotation_period_days: int
    last_rotated_at: datetime
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ApprovalPayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    action_type: str
    resource_type: str
    resource_id: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)


class ApprovalDecisionPayload(BaseModel):
    decision: str = Field(..., pattern="^(approved|rejected|cancelled)$")
    comment: Optional[str] = None


class ApprovalResponse(ORMModel):
    id: int
    title: str
    action_type: str
    resource_type: str
    resource_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    status: str
    requester_id: Optional[int] = None
    requester: Optional[str] = None
    approver_id: Optional[int] = None
    decision_comment: Optional[str] = None
    requested_at: datetime
    decided_at: Optional[datetime] = None


class AuditResponse(ORMModel):
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    event_type: str
    resource_type: str
    resource_id: Optional[str] = None
    result: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    detail: Optional[str] = None
    created_at: datetime


def _mask_secret(value: str) -> str:
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}{'*' * 8}{value[-4:]}"


def _encode_secret(value: str) -> str:
    key = hashlib.sha256(settings.auth_secret_key.encode("utf-8")).digest()
    raw = value.encode("utf-8")
    encrypted = bytes(byte ^ key[index % len(key)] for index, byte in enumerate(raw))
    return base64.urlsafe_b64encode(encrypted).decode("utf-8")


def _client_ip(request: Optional[Request]) -> Optional[str]:
    return request.client.host if request and request.client else None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_database),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    try:
        return get_user_by_token(db, credentials.credentials)
    except HTTPException:
        return get_user_by_api_token(db, credentials.credentials)


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅超级管理员可管理企业治理配置")
    return current_user


def record_audit(
    db: Session,
    user: User,
    event_type: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    result: str = "success",
    detail: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    db.add(
        EnterpriseAccessAudit(
            user_id=user.id,
            username=user.username,
            event_type=event_type,
            resource_type=resource_type,
            resource_id=resource_id,
            result=result,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent") if request else None,
            detail=detail,
        )
    )


def ensure_default_roles(db: Session) -> None:
    for code, permissions in DEFAULT_PERMISSIONS.items():
        role = db.query(EnterpriseRole).filter(EnterpriseRole.code == code).first()
        if not role:
            db.add(
                EnterpriseRole(
                    name={
                        "platform_admin": "平台管理员",
                        "project_owner": "项目负责人",
                        "test_manager": "测试经理",
                        "tester": "测试工程师",
                        "auditor": "审计员",
                    }[code],
                    code=code,
                    scope="system" if code == "platform_admin" else "project",
                    permissions=permissions,
                    built_in=True,
                    description="系统内置角色",
                )
            )
    db.commit()


@router.get("/overview")
def get_overview(
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    ensure_default_roles(db)
    return {
        "organizations": db.query(func.count(EnterpriseOrganization.id)).scalar() or 0,
        "teams": db.query(func.count(EnterpriseTeam.id)).scalar() or 0,
        "roles": db.query(func.count(EnterpriseRole.id)).scalar() or 0,
        "project_roles": db.query(func.count(EnterpriseProjectRole.id)).scalar() or 0,
        "sso_enabled": db.query(func.count(EnterpriseSsoProvider.id)).filter(EnterpriseSsoProvider.enabled.is_(True)).scalar() or 0,
        "api_tokens": db.query(func.count(EnterpriseApiToken.id)).filter(EnterpriseApiToken.revoked_at.is_(None)).scalar() or 0,
        "secrets": db.query(func.count(EnterpriseSecret.id)).scalar() or 0,
        "pending_approvals": db.query(func.count(EnterpriseApprovalRequest.id)).filter(EnterpriseApprovalRequest.status == "pending").scalar() or 0,
        "audits": db.query(func.count(EnterpriseAccessAudit.id)).scalar() or 0,
        "current_user": {"id": current_user.id, "username": current_user.username, "role": current_user.role},
    }


@router.get("/organizations", response_model=List[OrganizationResponse])
def list_organizations(db: Session = Depends(get_database), _: User = Depends(require_super_admin)):
    return db.query(EnterpriseOrganization).order_by(EnterpriseOrganization.id.desc()).all()


@router.post("/organizations", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationPayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    org = EnterpriseOrganization(**payload.model_dump())
    db.add(org)
    db.flush()
    record_audit(db, current_user, "create", "organization", str(org.id), org.name, request=request)
    db.commit()
    db.refresh(org)
    return org


@router.put("/organizations/{org_id}", response_model=OrganizationResponse)
def update_organization(
    org_id: int,
    payload: OrganizationPayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    org = db.query(EnterpriseOrganization).filter(EnterpriseOrganization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")
    for key, value in payload.model_dump().items():
        setattr(org, key, value)
    record_audit(db, current_user, "update", "organization", str(org.id), org.name, request=request)
    db.commit()
    db.refresh(org)
    return org


@router.get("/teams", response_model=List[TeamResponse])
def list_teams(organization_id: Optional[int] = None, db: Session = Depends(get_database), _: User = Depends(require_super_admin)):
    query = db.query(EnterpriseTeam)
    if organization_id:
        query = query.filter(EnterpriseTeam.organization_id == organization_id)
    return query.order_by(EnterpriseTeam.id.desc()).all()


@router.post("/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamPayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    if not db.query(EnterpriseOrganization).filter(EnterpriseOrganization.id == payload.organization_id).first():
        raise HTTPException(status_code=404, detail="组织不存在")
    team = EnterpriseTeam(**payload.model_dump())
    db.add(team)
    db.flush()
    record_audit(db, current_user, "create", "team", str(team.id), team.name, request=request)
    db.commit()
    db.refresh(team)
    return team


@router.post("/teams/{team_id}/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def add_team_member(
    team_id: int,
    payload: TeamMemberPayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    if not db.query(EnterpriseTeam).filter(EnterpriseTeam.id == team_id).first():
        raise HTTPException(status_code=404, detail="团队不存在")
    if not db.query(User).filter(User.id == payload.user_id).first():
        raise HTTPException(status_code=404, detail="用户不存在")
    existing = db.query(EnterpriseTeamMember).filter(
        EnterpriseTeamMember.team_id == team_id,
        EnterpriseTeamMember.user_id == payload.user_id,
    ).first()
    if existing:
        existing.member_role = payload.member_role
        member = existing
    else:
        member = EnterpriseTeamMember(team_id=team_id, **payload.model_dump())
        db.add(member)
    db.flush()
    record_audit(db, current_user, "grant", "team_member", str(member.id), request=request)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/team-members/{member_id}")
def delete_team_member(
    member_id: int,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    member = db.query(EnterpriseTeamMember).filter(EnterpriseTeamMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="团队成员不存在")
    db.delete(member)
    record_audit(db, current_user, "revoke", "team_member", str(member_id), request=request)
    db.commit()
    return {"success": True}


@router.get("/roles", response_model=List[RoleResponse])
def list_roles(db: Session = Depends(get_database), _: User = Depends(require_super_admin)):
    ensure_default_roles(db)
    return db.query(EnterpriseRole).order_by(EnterpriseRole.built_in.desc(), EnterpriseRole.id.desc()).all()


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RolePayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    role = EnterpriseRole(**payload.model_dump(), built_in=False)
    db.add(role)
    db.flush()
    record_audit(db, current_user, "create", "rbac_role", str(role.id), role.code, request=request)
    db.commit()
    db.refresh(role)
    return role


@router.put("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    payload: RolePayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    role = db.query(EnterpriseRole).filter(EnterpriseRole.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.built_in and role.code in DEFAULT_PERMISSIONS:
        payload_data = payload.model_dump()
        payload_data["code"] = role.code
        payload_data["scope"] = role.scope
    else:
        payload_data = payload.model_dump()
    for key, value in payload_data.items():
        setattr(role, key, value)
    record_audit(db, current_user, "update", "rbac_role", str(role.id), role.code, request=request)
    db.commit()
    db.refresh(role)
    return role


@router.get("/project-roles", response_model=List[ProjectRoleResponse])
def list_project_roles(project_id: Optional[int] = None, db: Session = Depends(get_database), _: User = Depends(require_super_admin)):
    query = db.query(EnterpriseProjectRole)
    if project_id:
        query = query.filter(EnterpriseProjectRole.project_id == project_id)
    return query.order_by(EnterpriseProjectRole.id.desc()).all()


@router.post("/project-roles", response_model=ProjectRoleResponse, status_code=status.HTTP_201_CREATED)
def grant_project_role(
    payload: ProjectRolePayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    if not db.query(User).filter(User.id == payload.user_id).first():
        raise HTTPException(status_code=404, detail="用户不存在")
    if not db.query(Project).filter(Project.id == payload.project_id).first():
        raise HTTPException(status_code=404, detail="项目不存在")
    existing = db.query(EnterpriseProjectRole).filter(
        EnterpriseProjectRole.user_id == payload.user_id,
        EnterpriseProjectRole.project_id == payload.project_id,
    ).first()
    if existing:
        target = existing
        for key, value in payload.model_dump().items():
            setattr(target, key, value)
    else:
        target = EnterpriseProjectRole(**payload.model_dump(), granted_by=current_user.username)
        db.add(target)
    db.flush()
    record_audit(db, current_user, "grant", "project_role", str(target.id), request=request)
    db.commit()
    db.refresh(target)
    return target


@router.get("/sso-providers", response_model=List[SsoProviderResponse])
def list_sso_providers(db: Session = Depends(get_database), _: User = Depends(require_super_admin)):
    return db.query(EnterpriseSsoProvider).order_by(EnterpriseSsoProvider.id.desc()).all()


@router.post("/sso-providers", response_model=SsoProviderResponse, status_code=status.HTTP_201_CREATED)
def create_sso_provider(
    payload: SsoProviderPayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    provider = EnterpriseSsoProvider(**payload.model_dump())
    db.add(provider)
    db.flush()
    record_audit(db, current_user, "create", "sso_provider", str(provider.id), provider.provider_type, request=request)
    db.commit()
    db.refresh(provider)
    return provider


@router.put("/sso-providers/{provider_id}", response_model=SsoProviderResponse)
def update_sso_provider(
    provider_id: int,
    payload: SsoProviderPayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    provider = db.query(EnterpriseSsoProvider).filter(EnterpriseSsoProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="SSO 配置不存在")
    for key, value in payload.model_dump().items():
        setattr(provider, key, value)
    record_audit(db, current_user, "update", "sso_provider", str(provider.id), provider.provider_type, request=request)
    db.commit()
    db.refresh(provider)
    return provider


@router.get("/api-tokens", response_model=List[ApiTokenResponse])
def list_api_tokens(db: Session = Depends(get_database), _: User = Depends(require_super_admin)):
    return db.query(EnterpriseApiToken).order_by(EnterpriseApiToken.id.desc()).all()


@router.post("/api-tokens", response_model=ApiTokenCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_api_token(
    payload: ApiTokenPayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    user_id = payload.user_id or current_user.id
    if not db.query(User).filter(User.id == user_id).first():
        raise HTTPException(status_code=404, detail="用户不存在")
    prefix = secrets.token_hex(4)
    raw_secret = secrets.token_urlsafe(32)
    raw_token = f"taf_{prefix}_{raw_secret}"
    record = EnterpriseApiToken(
        name=payload.name,
        token_prefix=prefix,
        token_hash=hash_api_token(raw_token),
        user_id=user_id,
        scopes=payload.scopes,
        expires_at=payload.expires_at,
        created_by=current_user.username,
    )
    db.add(record)
    db.flush()
    record_audit(db, current_user, "create", "api_token", str(record.id), record.name, request=request)
    db.commit()
    db.refresh(record)
    data = ApiTokenCreatedResponse.model_validate(record).model_dump()
    data["token"] = raw_token
    return data


@router.delete("/api-tokens/{token_id}")
def revoke_api_token(
    token_id: int,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    token = db.query(EnterpriseApiToken).filter(EnterpriseApiToken.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="API Token 不存在")
    token.revoked_at = datetime.utcnow()
    record_audit(db, current_user, "revoke", "api_token", str(token.id), token.name, request=request)
    db.commit()
    return {"success": True}


@router.get("/secrets", response_model=List[SecretResponse])
def list_secrets(db: Session = Depends(get_database), _: User = Depends(require_super_admin)):
    return db.query(EnterpriseSecret).order_by(EnterpriseSecret.id.desc()).all()


@router.post("/secrets", response_model=SecretResponse, status_code=status.HTTP_201_CREATED)
def create_secret(
    payload: SecretPayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    secret = EnterpriseSecret(
        name=payload.name,
        secret_type=payload.secret_type,
        owner_scope=payload.owner_scope,
        owner_id=payload.owner_id,
        encrypted_value=_encode_secret(payload.secret_value),
        masked_value=_mask_secret(payload.secret_value),
        description=payload.description,
        rotation_period_days=payload.rotation_period_days,
        created_by=current_user.username,
    )
    db.add(secret)
    db.flush()
    record_audit(db, current_user, "create", "secret", str(secret.id), secret.name, request=request)
    db.commit()
    db.refresh(secret)
    return secret


@router.post("/secrets/{secret_id}/rotate", response_model=SecretResponse)
def rotate_secret(
    secret_id: int,
    payload: SecretPayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    secret = db.query(EnterpriseSecret).filter(EnterpriseSecret.id == secret_id).first()
    if not secret:
        raise HTTPException(status_code=404, detail="密钥不存在")
    secret.name = payload.name
    secret.secret_type = payload.secret_type
    secret.owner_scope = payload.owner_scope
    secret.owner_id = payload.owner_id
    secret.encrypted_value = _encode_secret(payload.secret_value)
    secret.masked_value = _mask_secret(payload.secret_value)
    secret.description = payload.description
    secret.rotation_period_days = payload.rotation_period_days
    secret.last_rotated_at = datetime.utcnow()
    record_audit(db, current_user, "rotate", "secret", str(secret.id), secret.name, request=request)
    db.commit()
    db.refresh(secret)
    return secret


@router.get("/approvals", response_model=List[ApprovalResponse])
def list_approvals(status_filter: Optional[str] = None, db: Session = Depends(get_database), _: User = Depends(require_super_admin)):
    query = db.query(EnterpriseApprovalRequest)
    if status_filter:
        query = query.filter(EnterpriseApprovalRequest.status == status_filter)
    return query.order_by(EnterpriseApprovalRequest.id.desc()).all()


@router.post("/approvals", response_model=ApprovalResponse, status_code=status.HTTP_201_CREATED)
def create_approval(
    payload: ApprovalPayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    approval = EnterpriseApprovalRequest(
        **payload.model_dump(),
        requester_id=current_user.id,
        requester=current_user.username,
    )
    db.add(approval)
    db.flush()
    record_audit(db, current_user, "request", "approval", str(approval.id), approval.title, request=request)
    db.commit()
    db.refresh(approval)
    return approval


@router.post("/approvals/{approval_id}/decision", response_model=ApprovalResponse)
def decide_approval(
    approval_id: int,
    payload: ApprovalDecisionPayload,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_super_admin),
):
    approval = db.query(EnterpriseApprovalRequest).filter(EnterpriseApprovalRequest.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="审批单不存在")
    if approval.status != "pending":
        raise HTTPException(status_code=400, detail="审批单已处理")
    approval.status = payload.decision
    approval.approver_id = current_user.id
    approval.decision_comment = payload.comment
    approval.decided_at = datetime.utcnow()
    record_audit(db, current_user, payload.decision, "approval", str(approval.id), approval.title, request=request)
    db.commit()
    db.refresh(approval)
    return approval


@router.get("/audits", response_model=List[AuditResponse])
def list_audits(
    event_type: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_database),
    _: User = Depends(require_super_admin),
):
    query = db.query(EnterpriseAccessAudit)
    if event_type:
        query = query.filter(EnterpriseAccessAudit.event_type == event_type)
    return query.order_by(EnterpriseAccessAudit.id.desc()).limit(min(limit, 500)).all()
