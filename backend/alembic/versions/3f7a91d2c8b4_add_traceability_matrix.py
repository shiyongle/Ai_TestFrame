"""add_traceability_matrix

Revision ID: 3f7a91d2c8b4
Revises: 2c9d8f1a4b6e
Create Date: 2026-05-27 11:00:00.000000

新增需求-测试资产追踪矩阵、统一执行结果和需求变更日志。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "3f7a91d2c8b4"
down_revision = "2c9d8f1a4b6e"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    return inspect(op.get_bind()).has_table(table_name)


def _column_exists(table_name: str, column_name: str) -> bool:
    columns = inspect(op.get_bind()).get_columns(table_name) if _table_exists(table_name) else []
    return any(column["name"] == column_name for column in columns)


def upgrade() -> None:
    if _table_exists("defects") and not _column_exists("defects", "requirement_id"):
        with op.batch_alter_table("defects") as batch_op:
            batch_op.add_column(sa.Column("requirement_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key("fk_defects_requirement_id", "requirements", ["requirement_id"], ["id"])
            batch_op.create_index("ix_defects_requirement_id", ["requirement_id"], unique=False)

    if not _table_exists("requirement_test_assets"):
        op.create_table(
            "requirement_test_assets",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("requirement_id", sa.Integer(), nullable=False),
            sa.Column("asset_type", sa.String(length=50), nullable=False),
            sa.Column("asset_id", sa.Integer(), nullable=False),
            sa.Column("coverage_type", sa.String(length=30), nullable=False, server_default="regression"),
            sa.Column("priority", sa.String(length=20), nullable=False, server_default="medium"),
            sa.Column("source", sa.String(length=30), nullable=False, server_default="manual"),
            sa.Column("confidence_score", sa.Float(), nullable=True, server_default="1"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["requirement_id"], ["requirements.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_requirement_test_assets_id"), "requirement_test_assets", ["id"], unique=False)
        op.create_index("ix_requirement_test_assets_requirement_id", "requirement_test_assets", ["requirement_id"], unique=False)
        op.create_index("ix_requirement_test_assets_asset", "requirement_test_assets", ["asset_type", "asset_id"], unique=False)

    if not _table_exists("quality_execution_results"):
        op.create_table(
            "quality_execution_results",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("requirement_id", sa.Integer(), nullable=False),
            sa.Column("asset_type", sa.String(length=50), nullable=False),
            sa.Column("asset_id", sa.Integer(), nullable=False),
            sa.Column("execution_ref_type", sa.String(length=50), nullable=True),
            sa.Column("execution_ref_id", sa.Integer(), nullable=True),
            sa.Column("report_id", sa.Integer(), nullable=True),
            sa.Column("version_id", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="not_run"),
            sa.Column("defect_id", sa.Integer(), nullable=True),
            sa.Column("executed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["defect_id"], ["defects.id"]),
            sa.ForeignKeyConstraint(["report_id"], ["test_reports.id"]),
            sa.ForeignKeyConstraint(["requirement_id"], ["requirements.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["version_id"], ["versions.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_quality_execution_results_id"), "quality_execution_results", ["id"], unique=False)
        op.create_index("ix_quality_execution_results_requirement_id", "quality_execution_results", ["requirement_id"], unique=False)
        op.create_index("ix_quality_execution_results_asset", "quality_execution_results", ["asset_type", "asset_id"], unique=False)

    if not _table_exists("requirement_change_logs"):
        op.create_table(
            "requirement_change_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("requirement_id", sa.Integer(), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("old_content", sa.JSON(), nullable=True),
            sa.Column("new_content", sa.JSON(), nullable=True),
            sa.Column("changed_fields", sa.JSON(), nullable=True),
            sa.Column("impact_keywords", sa.JSON(), nullable=True),
            sa.Column("operator", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.ForeignKeyConstraint(["requirement_id"], ["requirements.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_requirement_change_logs_id"), "requirement_change_logs", ["id"], unique=False)
        op.create_index("ix_requirement_change_logs_requirement_id", "requirement_change_logs", ["requirement_id"], unique=False)


def downgrade() -> None:
    if _table_exists("requirement_change_logs"):
        op.drop_index("ix_requirement_change_logs_requirement_id", table_name="requirement_change_logs")
        op.drop_index(op.f("ix_requirement_change_logs_id"), table_name="requirement_change_logs")
        op.drop_table("requirement_change_logs")

    if _table_exists("quality_execution_results"):
        op.drop_index("ix_quality_execution_results_asset", table_name="quality_execution_results")
        op.drop_index("ix_quality_execution_results_requirement_id", table_name="quality_execution_results")
        op.drop_index(op.f("ix_quality_execution_results_id"), table_name="quality_execution_results")
        op.drop_table("quality_execution_results")

    if _table_exists("requirement_test_assets"):
        op.drop_index("ix_requirement_test_assets_asset", table_name="requirement_test_assets")
        op.drop_index("ix_requirement_test_assets_requirement_id", table_name="requirement_test_assets")
        op.drop_index(op.f("ix_requirement_test_assets_id"), table_name="requirement_test_assets")
        op.drop_table("requirement_test_assets")

    if _table_exists("defects") and _column_exists("defects", "requirement_id"):
        with op.batch_alter_table("defects") as batch_op:
            batch_op.drop_index("ix_defects_requirement_id")
            batch_op.drop_constraint("fk_defects_requirement_id", type_="foreignkey")
            batch_op.drop_column("requirement_id")
