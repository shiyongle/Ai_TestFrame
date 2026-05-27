"""add_defect_lifecycle

Revision ID: 2c9d8f1a4b6e
Revises: 1b4047033fb2
Create Date: 2026-05-26 10:00:00.000000

新增缺陷闭环表：
- defects: 缺陷主表，支持报告来源、外部平台映射、回归状态
- defect_status_histories: 状态流转记录
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "2c9d8f1a4b6e"
down_revision = "1b4047033fb2"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    return inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if not _table_exists("defects"):
        op.create_table(
            "defects",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("severity", sa.String(length=20), nullable=False, server_default="major"),
            sa.Column("priority", sa.String(length=20), nullable=False, server_default="P2"),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="open"),
            sa.Column("source_type", sa.String(length=30), nullable=False, server_default="manual"),
            sa.Column("project_id", sa.Integer(), nullable=True),
            sa.Column("report_id", sa.Integer(), nullable=True),
            sa.Column("testcase_id", sa.Integer(), nullable=True),
            sa.Column("interface_testcase_id", sa.Integer(), nullable=True),
            sa.Column("external_provider", sa.String(length=50), nullable=True, server_default="local"),
            sa.Column("external_key", sa.String(length=100), nullable=True),
            sa.Column("external_url", sa.Text(), nullable=True),
            sa.Column("external_status", sa.String(length=50), nullable=True),
            sa.Column("last_synced_at", sa.DateTime(), nullable=True),
            sa.Column("regression_status", sa.String(length=30), nullable=False, server_default="not_started"),
            sa.Column("regression_report_id", sa.Integer(), nullable=True),
            sa.Column("regression_notes", sa.Text(), nullable=True),
            sa.Column("created_by", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("assigned_to", sa.String(length=100), nullable=True),
            sa.Column("resolved_at", sa.DateTime(), nullable=True),
            sa.Column("verified_at", sa.DateTime(), nullable=True),
            sa.Column("closed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["interface_testcase_id"], ["interface_testcases.id"]),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.ForeignKeyConstraint(["regression_report_id"], ["test_reports.id"]),
            sa.ForeignKeyConstraint(["report_id"], ["test_reports.id"]),
            sa.ForeignKeyConstraint(["testcase_id"], ["testcases.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_defects_id"), "defects", ["id"], unique=False)
        op.create_index("ix_defects_status", "defects", ["status"], unique=False)
        op.create_index("ix_defects_report_id", "defects", ["report_id"], unique=False)

    if not _table_exists("defect_status_histories"):
        op.create_table(
            "defect_status_histories",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("defect_id", sa.Integer(), nullable=False),
            sa.Column("from_status", sa.String(length=30), nullable=True),
            sa.Column("to_status", sa.String(length=30), nullable=False),
            sa.Column("action", sa.String(length=50), nullable=False),
            sa.Column("operator", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column("external_status", sa.String(length=50), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["defect_id"], ["defects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_defect_status_histories_id"), "defect_status_histories", ["id"], unique=False)
        op.create_index("ix_defect_status_histories_defect_id", "defect_status_histories", ["defect_id"], unique=False)


def downgrade() -> None:
    if _table_exists("defect_status_histories"):
        op.drop_index("ix_defect_status_histories_defect_id", table_name="defect_status_histories")
        op.drop_index(op.f("ix_defect_status_histories_id"), table_name="defect_status_histories")
        op.drop_table("defect_status_histories")

    if _table_exists("defects"):
        op.drop_index("ix_defects_report_id", table_name="defects")
        op.drop_index("ix_defects_status", table_name="defects")
        op.drop_index(op.f("ix_defects_id"), table_name="defects")
        op.drop_table("defects")
