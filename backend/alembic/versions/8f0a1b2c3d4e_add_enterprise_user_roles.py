"""add_enterprise_user_roles

Revision ID: 8f0a1b2c3d4e
Revises: 8e9f0a1b2c3d
Create Date: 2026-05-28 09:30:00.000000

新增用户级企业角色绑定，用于把用户管理和企业治理 RBAC 串联。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "8f0a1b2c3d4e"
down_revision = "8e9f0a1b2c3d"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    return inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if not _table_exists("enterprise_user_roles"):
        op.create_table(
            "enterprise_user_roles",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("role_id", sa.Integer(), nullable=False),
            sa.Column("scope_type", sa.String(length=30), nullable=False, server_default="platform"),
            sa.Column("scope_id", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("granted_by", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("granted_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["role_id"], ["enterprise_roles.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_enterprise_user_roles_id"), "enterprise_user_roles", ["id"], unique=False)
        op.create_index("ix_enterprise_user_roles_user_id", "enterprise_user_roles", ["user_id"], unique=False)
        op.create_index("ix_enterprise_user_roles_role_id", "enterprise_user_roles", ["role_id"], unique=False)


def downgrade() -> None:
    if _table_exists("enterprise_user_roles"):
        op.drop_table("enterprise_user_roles")
