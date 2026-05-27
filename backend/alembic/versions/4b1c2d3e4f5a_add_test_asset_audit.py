"""add_test_asset_audit

Revision ID: 4b1c2d3e4f5a
Revises: 3f7a91d2c8b4
Create Date: 2026-05-27 14:30:00.000000

新增测试资产版本化、基线冻结、审批记录和不可变审计事件。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "4b1c2d3e4f5a"
down_revision = "3f7a91d2c8b4"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    return inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if not _table_exists("test_asset_versions"):
        op.create_table(
            "test_asset_versions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("asset_type", sa.String(length=50), nullable=False),
            sa.Column("asset_id", sa.Integer(), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("version_no", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("action", sa.String(length=30), nullable=False, server_default="update"),
            sa.Column("snapshot", sa.JSON(), nullable=True),
            sa.Column("diff", sa.JSON(), nullable=True),
            sa.Column("change_summary", sa.Text(), nullable=True),
            sa.Column("source", sa.String(length=50), nullable=False, server_default="manual"),
            sa.Column("source_ref_type", sa.String(length=50), nullable=True),
            sa.Column("source_ref_id", sa.String(length=100), nullable=True),
            sa.Column("requirement_id", sa.Integer(), nullable=True),
            sa.Column("created_by", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("approval_status", sa.String(length=20), nullable=False, server_default="approved"),
            sa.Column("approved_by", sa.String(length=100), nullable=True),
            sa.Column("approved_at", sa.DateTime(), nullable=True),
            sa.Column("content_hash", sa.String(length=64), nullable=False),
            sa.Column("previous_hash", sa.String(length=64), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.ForeignKeyConstraint(["requirement_id"], ["requirements.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_test_asset_versions_id"), "test_asset_versions", ["id"], unique=False)
        op.create_index("ix_test_asset_versions_asset", "test_asset_versions", ["asset_type", "asset_id"], unique=False)
        op.create_index("ix_test_asset_versions_project_id", "test_asset_versions", ["project_id"], unique=False)

    if not _table_exists("test_asset_baselines"):
        op.create_table(
            "test_asset_baselines",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("version_id", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
            sa.Column("created_by", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("frozen_by", sa.String(length=100), nullable=True),
            sa.Column("frozen_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.ForeignKeyConstraint(["version_id"], ["versions.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_test_asset_baselines_id"), "test_asset_baselines", ["id"], unique=False)
        op.create_index("ix_test_asset_baselines_project_id", "test_asset_baselines", ["project_id"], unique=False)

    if not _table_exists("test_asset_baseline_items"):
        op.create_table(
            "test_asset_baseline_items",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("baseline_id", sa.Integer(), nullable=False),
            sa.Column("asset_type", sa.String(length=50), nullable=False),
            sa.Column("asset_id", sa.Integer(), nullable=False),
            sa.Column("asset_version_id", sa.Integer(), nullable=True),
            sa.Column("snapshot", sa.JSON(), nullable=True),
            sa.Column("content_hash", sa.String(length=64), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["asset_version_id"], ["test_asset_versions.id"]),
            sa.ForeignKeyConstraint(["baseline_id"], ["test_asset_baselines.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_test_asset_baseline_items_id"), "test_asset_baseline_items", ["id"], unique=False)
        op.create_index("ix_test_asset_baseline_items_baseline_id", "test_asset_baseline_items", ["baseline_id"], unique=False)
        op.create_index("ix_test_asset_baseline_items_asset", "test_asset_baseline_items", ["asset_type", "asset_id"], unique=False)

    if not _table_exists("test_asset_approvals"):
        op.create_table(
            "test_asset_approvals",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("asset_version_id", sa.Integer(), nullable=False),
            sa.Column("decision", sa.String(length=20), nullable=False),
            sa.Column("approver", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["asset_version_id"], ["test_asset_versions.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_test_asset_approvals_id"), "test_asset_approvals", ["id"], unique=False)
        op.create_index("ix_test_asset_approvals_version_id", "test_asset_approvals", ["asset_version_id"], unique=False)

    if not _table_exists("test_asset_audit_events"):
        op.create_table(
            "test_asset_audit_events",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("asset_type", sa.String(length=50), nullable=False),
            sa.Column("asset_id", sa.Integer(), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("action", sa.String(length=50), nullable=False),
            sa.Column("actor", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("detail", sa.Text(), nullable=True),
            sa.Column("metadata_json", sa.JSON(), nullable=True),
            sa.Column("before_hash", sa.String(length=64), nullable=True),
            sa.Column("after_hash", sa.String(length=64), nullable=True),
            sa.Column("event_hash", sa.String(length=64), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_test_asset_audit_events_id"), "test_asset_audit_events", ["id"], unique=False)
        op.create_index("ix_test_asset_audit_events_asset", "test_asset_audit_events", ["asset_type", "asset_id"], unique=False)
        op.create_index("ix_test_asset_audit_events_project_id", "test_asset_audit_events", ["project_id"], unique=False)


def downgrade() -> None:
    if _table_exists("test_asset_audit_events"):
        op.drop_index("ix_test_asset_audit_events_project_id", table_name="test_asset_audit_events")
        op.drop_index("ix_test_asset_audit_events_asset", table_name="test_asset_audit_events")
        op.drop_index(op.f("ix_test_asset_audit_events_id"), table_name="test_asset_audit_events")
        op.drop_table("test_asset_audit_events")

    if _table_exists("test_asset_approvals"):
        op.drop_index("ix_test_asset_approvals_version_id", table_name="test_asset_approvals")
        op.drop_index(op.f("ix_test_asset_approvals_id"), table_name="test_asset_approvals")
        op.drop_table("test_asset_approvals")

    if _table_exists("test_asset_baseline_items"):
        op.drop_index("ix_test_asset_baseline_items_asset", table_name="test_asset_baseline_items")
        op.drop_index("ix_test_asset_baseline_items_baseline_id", table_name="test_asset_baseline_items")
        op.drop_index(op.f("ix_test_asset_baseline_items_id"), table_name="test_asset_baseline_items")
        op.drop_table("test_asset_baseline_items")

    if _table_exists("test_asset_baselines"):
        op.drop_index("ix_test_asset_baselines_project_id", table_name="test_asset_baselines")
        op.drop_index(op.f("ix_test_asset_baselines_id"), table_name="test_asset_baselines")
        op.drop_table("test_asset_baselines")

    if _table_exists("test_asset_versions"):
        op.drop_index("ix_test_asset_versions_project_id", table_name="test_asset_versions")
        op.drop_index("ix_test_asset_versions_asset", table_name="test_asset_versions")
        op.drop_index(op.f("ix_test_asset_versions_id"), table_name="test_asset_versions")
        op.drop_table("test_asset_versions")
