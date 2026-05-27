"""add_ai_quality_governance

Revision ID: 7e8f9a0b1c2d
Revises: 6d7e8f9a0b1c
Create Date: 2026-05-27 17:40:00.000000

新增 AI 质量治理相关表：Prompt 版本、生成评审、模型预算、A/B 实验、知识质量扫描。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "7e8f9a0b1c2d"
down_revision = "6d7e8f9a0b1c"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    return inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if not _table_exists("ai_prompt_versions"):
        op.create_table(
            "ai_prompt_versions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("prompt_type", sa.String(length=50), nullable=False, server_default="testcase_generation"),
            sa.Column("version", sa.String(length=50), nullable=False, server_default="v1"),
            sa.Column("system_prompt", sa.Text(), nullable=True),
            sa.Column("user_prompt", sa.Text(), nullable=False),
            sa.Column("model_config_id", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
            sa.Column("change_log", sa.Text(), nullable=True),
            sa.Column("metrics", sa.JSON(), nullable=True),
            sa.Column("created_by", sa.String(length=100), nullable=True, server_default="system"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["model_config_id"], ["model_configs.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_ai_prompt_versions_id"), "ai_prompt_versions", ["id"], unique=False)

    if not _table_exists("ai_generation_reviews"):
        op.create_table(
            "ai_generation_reviews",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("source_type", sa.String(length=50), nullable=False, server_default="manual"),
            sa.Column("source_id", sa.Integer(), nullable=True),
            sa.Column("prompt_version_id", sa.Integer(), nullable=True),
            sa.Column("model_config_id", sa.Integer(), nullable=True),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("content", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
            sa.Column("quality_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("hallucination_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("hallucination_flags", sa.JSON(), nullable=True),
            sa.Column("reviewer", sa.String(length=100), nullable=True),
            sa.Column("review_comment", sa.Text(), nullable=True),
            sa.Column("adopted_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["model_config_id"], ["model_configs.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["prompt_version_id"], ["ai_prompt_versions.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_ai_generation_reviews_id"), "ai_generation_reviews", ["id"], unique=False)

    if not _table_exists("ai_model_budgets"):
        op.create_table(
            "ai_model_budgets",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("provider", sa.String(length=50), nullable=False),
            sa.Column("model", sa.String(length=100), nullable=False),
            sa.Column("period_month", sa.String(length=7), nullable=False),
            sa.Column("token_budget", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("cost_budget", sa.Float(), nullable=False, server_default="0"),
            sa.Column("used_tokens", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("used_cost", sa.Float(), nullable=False, server_default="0"),
            sa.Column("alert_threshold", sa.Float(), nullable=False, server_default="0.8"),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_ai_model_budgets_id"), "ai_model_budgets", ["id"], unique=False)

    if not _table_exists("ai_ab_experiments"):
        op.create_table(
            "ai_ab_experiments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("prompt_a_id", sa.Integer(), nullable=True),
            sa.Column("prompt_b_id", sa.Integer(), nullable=True),
            sa.Column("model_a_id", sa.Integer(), nullable=True),
            sa.Column("model_b_id", sa.Integer(), nullable=True),
            sa.Column("metric_name", sa.String(length=80), nullable=False, server_default="quality_score"),
            sa.Column("sample_size", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("result_summary", sa.JSON(), nullable=True),
            sa.Column("winner", sa.String(length=20), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["model_a_id"], ["model_configs.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["model_b_id"], ["model_configs.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["prompt_a_id"], ["ai_prompt_versions.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["prompt_b_id"], ["ai_prompt_versions.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_ai_ab_experiments_id"), "ai_ab_experiments", ["id"], unique=False)

    if not _table_exists("ai_knowledge_quality_scans"):
        op.create_table(
            "ai_knowledge_quality_scans",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("document_id", sa.Integer(), nullable=True),
            sa.Column("scan_type", sa.String(length=50), nullable=False, server_default="quality"),
            sa.Column("quality_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("freshness_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("coverage_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("issue_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("issues", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="completed"),
            sa.Column("scanned_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["document_id"], ["knowledge_documents.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_ai_knowledge_quality_scans_id"), "ai_knowledge_quality_scans", ["id"], unique=False)


def downgrade() -> None:
    for table in [
        "ai_knowledge_quality_scans",
        "ai_ab_experiments",
        "ai_model_budgets",
        "ai_generation_reviews",
        "ai_prompt_versions",
    ]:
        if _table_exists(table):
            op.drop_table(table)
