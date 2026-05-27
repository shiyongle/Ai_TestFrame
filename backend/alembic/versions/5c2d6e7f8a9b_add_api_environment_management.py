"""add_api_environment_management

Revision ID: 5c2d6e7f8a9b
Revises: 4b1c2d3e4f5a
Create Date: 2026-05-27 16:00:00.000000

新增 API 环境、变量、账号池和数据池。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "5c2d6e7f8a9b"
down_revision = "4b1c2d3e4f5a"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    return inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if not _table_exists("api_environments"):
        op.create_table(
            "api_environments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("code", sa.String(length=50), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=True),
            sa.Column("base_url", sa.Text(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("is_default", sa.Boolean(), nullable=True),
            sa.Column("pre_script", sa.Text(), nullable=True),
            sa.Column("post_script", sa.Text(), nullable=True),
            sa.Column("created_by", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_environments_id"), "api_environments", ["id"], unique=False)
        op.create_index(op.f("ix_api_environments_code"), "api_environments", ["code"], unique=False)

    if not _table_exists("api_environment_variables"):
        op.create_table(
            "api_environment_variables",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("environment_id", sa.Integer(), nullable=False),
            sa.Column("key", sa.String(length=100), nullable=False),
            sa.Column("value", sa.Text(), nullable=True),
            sa.Column("variable_type", sa.String(length=20), nullable=False, server_default="normal"),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["environment_id"], ["api_environments.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_environment_variables_id"), "api_environment_variables", ["id"], unique=False)
        op.create_index("ix_api_environment_variables_env_key", "api_environment_variables", ["environment_id", "key"], unique=False)

    if not _table_exists("api_account_pools"):
        op.create_table(
            "api_account_pools",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("environment_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("strategy", sa.String(length=20), nullable=False, server_default="round_robin"),
            sa.Column("accounts", sa.JSON(), nullable=True),
            sa.Column("current_index", sa.Integer(), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["environment_id"], ["api_environments.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_account_pools_id"), "api_account_pools", ["id"], unique=False)
        op.create_index("ix_api_account_pools_environment_id", "api_account_pools", ["environment_id"], unique=False)

    if not _table_exists("api_data_pools"):
        op.create_table(
            "api_data_pools",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("environment_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("strategy", sa.String(length=20), nullable=False, server_default="round_robin"),
            sa.Column("rows", sa.JSON(), nullable=True),
            sa.Column("current_index", sa.Integer(), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["environment_id"], ["api_environments.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_data_pools_id"), "api_data_pools", ["id"], unique=False)
        op.create_index("ix_api_data_pools_environment_id", "api_data_pools", ["environment_id"], unique=False)


def downgrade() -> None:
    if _table_exists("api_data_pools"):
        op.drop_index("ix_api_data_pools_environment_id", table_name="api_data_pools")
        op.drop_index(op.f("ix_api_data_pools_id"), table_name="api_data_pools")
        op.drop_table("api_data_pools")
    if _table_exists("api_account_pools"):
        op.drop_index("ix_api_account_pools_environment_id", table_name="api_account_pools")
        op.drop_index(op.f("ix_api_account_pools_id"), table_name="api_account_pools")
        op.drop_table("api_account_pools")
    if _table_exists("api_environment_variables"):
        op.drop_index("ix_api_environment_variables_env_key", table_name="api_environment_variables")
        op.drop_index(op.f("ix_api_environment_variables_id"), table_name="api_environment_variables")
        op.drop_table("api_environment_variables")
    if _table_exists("api_environments"):
        op.drop_index(op.f("ix_api_environments_code"), table_name="api_environments")
        op.drop_index(op.f("ix_api_environments_id"), table_name="api_environments")
        op.drop_table("api_environments")
