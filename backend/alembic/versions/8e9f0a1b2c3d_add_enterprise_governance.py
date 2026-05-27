"""add_enterprise_governance

Revision ID: 8e9f0a1b2c3d
Revises: 7e8f9a0b1c2d
Create Date: 2026-05-27 18:30:00.000000

新增企业治理表：组织、团队、RBAC、项目授权、SSO、API Token、密钥托管、审批和访问审计。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "8e9f0a1b2c3d"
down_revision = "7e8f9a0b1c2d"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    return inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if not _table_exists("enterprise_organizations"):
        op.create_table(
            "enterprise_organizations",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("code", sa.String(length=80), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_enterprise_organizations_id"), "enterprise_organizations", ["id"], unique=False)
        op.create_index(op.f("ix_enterprise_organizations_code"), "enterprise_organizations", ["code"], unique=False)

    if not _table_exists("enterprise_teams"):
        op.create_table(
            "enterprise_teams",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("organization_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("code", sa.String(length=80), nullable=False),
            sa.Column("owner", sa.String(length=100), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["organization_id"], ["enterprise_organizations.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_enterprise_teams_id"), "enterprise_teams", ["id"], unique=False)
        op.create_index(op.f("ix_enterprise_teams_code"), "enterprise_teams", ["code"], unique=False)
        op.create_index("ix_enterprise_teams_organization_id", "enterprise_teams", ["organization_id"], unique=False)

    if not _table_exists("enterprise_team_members"):
        op.create_table(
            "enterprise_team_members",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("team_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("member_role", sa.String(length=50), nullable=False, server_default="member"),
            sa.Column("joined_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["team_id"], ["enterprise_teams.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_enterprise_team_members_id"), "enterprise_team_members", ["id"], unique=False)
        op.create_index("ix_enterprise_team_members_team_id", "enterprise_team_members", ["team_id"], unique=False)
        op.create_index("ix_enterprise_team_members_user_id", "enterprise_team_members", ["user_id"], unique=False)

    if not _table_exists("enterprise_roles"):
        op.create_table(
            "enterprise_roles",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("code", sa.String(length=80), nullable=False),
            sa.Column("scope", sa.String(length=30), nullable=False, server_default="project"),
            sa.Column("permissions", sa.JSON(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("built_in", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_enterprise_roles_id"), "enterprise_roles", ["id"], unique=False)
        op.create_index(op.f("ix_enterprise_roles_code"), "enterprise_roles", ["code"], unique=False)

    if not _table_exists("enterprise_project_roles"):
        op.create_table(
            "enterprise_project_roles",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("role_id", sa.Integer(), nullable=True),
            sa.Column("role_code", sa.String(length=80), nullable=False, server_default="project_viewer"),
            sa.Column("permissions", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("granted_by", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("granted_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["role_id"], ["enterprise_roles.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_enterprise_project_roles_id"), "enterprise_project_roles", ["id"], unique=False)
        op.create_index("ix_enterprise_project_roles_project_id", "enterprise_project_roles", ["project_id"], unique=False)
        op.create_index("ix_enterprise_project_roles_user_id", "enterprise_project_roles", ["user_id"], unique=False)

    if not _table_exists("enterprise_sso_providers"):
        op.create_table(
            "enterprise_sso_providers",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("provider_type", sa.String(length=30), nullable=False, server_default="oidc"),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("issuer_url", sa.Text(), nullable=True),
            sa.Column("metadata_url", sa.Text(), nullable=True),
            sa.Column("client_id", sa.String(length=255), nullable=True),
            sa.Column("client_secret", sa.Text(), nullable=True),
            sa.Column("ldap_url", sa.Text(), nullable=True),
            sa.Column("domain", sa.String(length=150), nullable=True),
            sa.Column("config", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_enterprise_sso_providers_id"), "enterprise_sso_providers", ["id"], unique=False)

    if not _table_exists("enterprise_api_tokens"):
        op.create_table(
            "enterprise_api_tokens",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("token_prefix", sa.String(length=16), nullable=False),
            sa.Column("token_hash", sa.String(length=128), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("scopes", sa.JSON(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("last_used_at", sa.DateTime(), nullable=True),
            sa.Column("created_by", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_enterprise_api_tokens_id"), "enterprise_api_tokens", ["id"], unique=False)
        op.create_index(op.f("ix_enterprise_api_tokens_token_prefix"), "enterprise_api_tokens", ["token_prefix"], unique=False)

    if not _table_exists("enterprise_secrets"):
        op.create_table(
            "enterprise_secrets",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("secret_type", sa.String(length=50), nullable=False, server_default="api_key"),
            sa.Column("owner_scope", sa.String(length=30), nullable=False, server_default="platform"),
            sa.Column("owner_id", sa.Integer(), nullable=True),
            sa.Column("encrypted_value", sa.Text(), nullable=False),
            sa.Column("masked_value", sa.String(length=120), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("rotation_period_days", sa.Integer(), nullable=True, server_default="90"),
            sa.Column("last_rotated_at", sa.DateTime(), nullable=True),
            sa.Column("created_by", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_enterprise_secrets_id"), "enterprise_secrets", ["id"], unique=False)

    if not _table_exists("enterprise_approval_requests"):
        op.create_table(
            "enterprise_approval_requests",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("action_type", sa.String(length=80), nullable=False),
            sa.Column("resource_type", sa.String(length=80), nullable=False),
            sa.Column("resource_id", sa.String(length=80), nullable=True),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
            sa.Column("requester_id", sa.Integer(), nullable=True),
            sa.Column("requester", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("approver_id", sa.Integer(), nullable=True),
            sa.Column("decision_comment", sa.Text(), nullable=True),
            sa.Column("requested_at", sa.DateTime(), nullable=True),
            sa.Column("decided_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["approver_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_enterprise_approval_requests_id"), "enterprise_approval_requests", ["id"], unique=False)

    if not _table_exists("enterprise_access_audits"):
        op.create_table(
            "enterprise_access_audits",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("username", sa.String(length=100), nullable=True),
            sa.Column("event_type", sa.String(length=80), nullable=False),
            sa.Column("resource_type", sa.String(length=80), nullable=False),
            sa.Column("resource_id", sa.String(length=80), nullable=True),
            sa.Column("result", sa.String(length=20), nullable=False, server_default="success"),
            sa.Column("ip_address", sa.String(length=80), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
            sa.Column("detail", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_enterprise_access_audits_id"), "enterprise_access_audits", ["id"], unique=False)


def downgrade() -> None:
    for table in [
        "enterprise_access_audits",
        "enterprise_approval_requests",
        "enterprise_secrets",
        "enterprise_api_tokens",
        "enterprise_sso_providers",
        "enterprise_project_roles",
        "enterprise_roles",
        "enterprise_team_members",
        "enterprise_teams",
        "enterprise_organizations",
    ]:
        if _table_exists(table):
            op.drop_table(table)
