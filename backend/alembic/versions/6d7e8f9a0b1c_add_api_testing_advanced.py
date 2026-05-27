"""add_api_testing_advanced

Revision ID: 6d7e8f9a0b1c
Revises: 5c2d6e7f8a9b
Create Date: 2026-05-27 17:30:00.000000

新增接口集合 Runner、Mock、契约、变更 Diff 和监控探测。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "6d7e8f9a0b1c"
down_revision = "5c2d6e7f8a9b"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    return inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if not _table_exists("api_test_collections"):
        op.create_table(
            "api_test_collections",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("environment_id", sa.Integer(), nullable=True),
            sa.Column("pre_script", sa.Text(), nullable=True),
            sa.Column("post_script", sa.Text(), nullable=True),
            sa.Column("tags", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("created_by", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["environment_id"], ["api_environments.id"]),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_test_collections_id"), "api_test_collections", ["id"], unique=False)
        op.create_index("ix_api_test_collections_project_id", "api_test_collections", ["project_id"], unique=False)

    if not _table_exists("api_test_collection_items"):
        op.create_table(
            "api_test_collection_items",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("collection_id", sa.Integer(), nullable=False),
            sa.Column("interface_testcase_id", sa.Integer(), nullable=False),
            sa.Column("order_index", sa.Integer(), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=True),
            sa.Column("extractors", sa.JSON(), nullable=True),
            sa.Column("assertions", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["collection_id"], ["api_test_collections.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["interface_testcase_id"], ["interface_testcases.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_test_collection_items_id"), "api_test_collection_items", ["id"], unique=False)
        op.create_index("ix_api_test_collection_items_collection_id", "api_test_collection_items", ["collection_id"], unique=False)

    if not _table_exists("api_test_runs"):
        op.create_table(
            "api_test_runs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("collection_id", sa.Integer(), nullable=True),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("environment_id", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="running"),
            sa.Column("total_items", sa.Integer(), nullable=True),
            sa.Column("passed_items", sa.Integer(), nullable=True),
            sa.Column("failed_items", sa.Integer(), nullable=True),
            sa.Column("duration_ms", sa.Integer(), nullable=True),
            sa.Column("context_snapshot", sa.JSON(), nullable=True),
            sa.Column("summary", sa.JSON(), nullable=True),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["collection_id"], ["api_test_collections.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["environment_id"], ["api_environments.id"]),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_test_runs_id"), "api_test_runs", ["id"], unique=False)
        op.create_index("ix_api_test_runs_project_id", "api_test_runs", ["project_id"], unique=False)

    if not _table_exists("api_test_run_items"):
        op.create_table(
            "api_test_run_items",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("run_id", sa.Integer(), nullable=False),
            sa.Column("collection_item_id", sa.Integer(), nullable=True),
            sa.Column("interface_testcase_id", sa.Integer(), nullable=True),
            sa.Column("name", sa.String(length=150), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="failed"),
            sa.Column("status_code", sa.Integer(), nullable=True),
            sa.Column("duration_ms", sa.Integer(), nullable=True),
            sa.Column("assertions", sa.JSON(), nullable=True),
            sa.Column("extracted_variables", sa.JSON(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("response_snapshot", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["collection_item_id"], ["api_test_collection_items.id"]),
            sa.ForeignKeyConstraint(["interface_testcase_id"], ["interface_testcases.id"]),
            sa.ForeignKeyConstraint(["run_id"], ["api_test_runs.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_test_run_items_id"), "api_test_run_items", ["id"], unique=False)
        op.create_index("ix_api_test_run_items_run_id", "api_test_run_items", ["run_id"], unique=False)

    if not _table_exists("api_mock_endpoints"):
        op.create_table(
            "api_mock_endpoints",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("mock_key", sa.String(length=80), nullable=False),
            sa.Column("method", sa.String(length=10), nullable=False, server_default="GET"),
            sa.Column("path", sa.String(length=300), nullable=False),
            sa.Column("status_code", sa.Integer(), nullable=True),
            sa.Column("headers", sa.JSON(), nullable=True),
            sa.Column("response_body", sa.JSON(), nullable=True),
            sa.Column("delay_ms", sa.Integer(), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_mock_endpoints_id"), "api_mock_endpoints", ["id"], unique=False)
        op.create_index(op.f("ix_api_mock_endpoints_mock_key"), "api_mock_endpoints", ["mock_key"], unique=False)

    if not _table_exists("api_contract_schemas"):
        op.create_table(
            "api_contract_schemas",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("interface_testcase_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("expected_status_codes", sa.JSON(), nullable=True),
            sa.Column("response_schema", sa.JSON(), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["interface_testcase_id"], ["interface_testcases.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_contract_schemas_id"), "api_contract_schemas", ["id"], unique=False)
        op.create_index("ix_api_contract_schemas_case_id", "api_contract_schemas", ["interface_testcase_id"], unique=False)

    if not _table_exists("api_interface_change_logs"):
        op.create_table(
            "api_interface_change_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("interface_testcase_id", sa.Integer(), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("old_snapshot", sa.JSON(), nullable=True),
            sa.Column("new_snapshot", sa.JSON(), nullable=True),
            sa.Column("diff", sa.JSON(), nullable=True),
            sa.Column("source", sa.String(length=50), nullable=True, server_default="manual"),
            sa.Column("operator", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["interface_testcase_id"], ["interface_testcases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_interface_change_logs_id"), "api_interface_change_logs", ["id"], unique=False)
        op.create_index("ix_api_interface_change_logs_case_id", "api_interface_change_logs", ["interface_testcase_id"], unique=False)

    if not _table_exists("api_monitor_probes"):
        op.create_table(
            "api_monitor_probes",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("interface_testcase_id", sa.Integer(), nullable=False),
            sa.Column("environment_id", sa.Integer(), nullable=True),
            sa.Column("interval_seconds", sa.Integer(), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=True),
            sa.Column("last_status", sa.String(length=20), nullable=True),
            sa.Column("last_status_code", sa.Integer(), nullable=True),
            sa.Column("last_latency_ms", sa.Integer(), nullable=True),
            sa.Column("last_checked_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["environment_id"], ["api_environments.id"]),
            sa.ForeignKeyConstraint(["interface_testcase_id"], ["interface_testcases.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_api_monitor_probes_id"), "api_monitor_probes", ["id"], unique=False)


def downgrade() -> None:
    for table in [
        "api_monitor_probes",
        "api_interface_change_logs",
        "api_contract_schemas",
        "api_mock_endpoints",
        "api_test_run_items",
        "api_test_runs",
        "api_test_collection_items",
        "api_test_collections",
    ]:
        if _table_exists(table):
            op.drop_table(table)
