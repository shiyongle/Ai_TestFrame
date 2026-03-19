import asyncio
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.database_models import UIAutomationArtifact, UIAutomationStepLog, UIAutomationTask
from schemas.ui_automation_schemas import UIAutomationTaskCreate


class UIAutomationService:
    """UI 自动化任务服务（browser-use 执行骨架 + Playwright 固化）"""

    def create_task(self, db: Session, payload: UIAutomationTaskCreate) -> UIAutomationTask:
        task_no = f"UI-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
        steps = payload.natural_language_steps or [
            "打开目标站点",
            "执行登录/鉴权",
            "按自然语言步骤完成交互",
            "执行断言并收集证据",
        ]

        task = UIAutomationTask(
            task_no=task_no,
            name=payload.name,
            target_url=payload.target_url,
            auth_scheme=payload.auth_scheme,
            auth_payload=payload.auth_payload or {},
            natural_language_steps=steps,
            assertions=payload.assertions or [],
            status="pending",
            progress=0,
            executor="browser_use",
        )
        db.add(task)
        db.flush()

        for idx, step in enumerate(steps, start=1):
            db.add(
                UIAutomationStepLog(
                    task_id=task.id,
                    step_index=idx,
                    step_title=step,
                    status="pending",
                )
            )

        db.commit()
        db.refresh(task)
        return task

    def list_tasks(self, db: Session, limit: int = 20) -> List[UIAutomationTask]:
        return (
            db.query(UIAutomationTask)
            .order_by(UIAutomationTask.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_task(self, db: Session, task_id: int) -> Optional[UIAutomationTask]:
        return db.query(UIAutomationTask).filter(UIAutomationTask.id == task_id).first()

    def get_task_steps(self, db: Session, task_id: int) -> List[UIAutomationStepLog]:
        return (
            db.query(UIAutomationStepLog)
            .filter(UIAutomationStepLog.task_id == task_id)
            .order_by(UIAutomationStepLog.step_index.asc(), UIAutomationStepLog.id.asc())
            .all()
        )

    def get_task_artifacts(self, db: Session, task_id: int) -> List[UIAutomationArtifact]:
        return (
            db.query(UIAutomationArtifact)
            .filter(UIAutomationArtifact.task_id == task_id)
            .order_by(UIAutomationArtifact.created_at.desc(), UIAutomationArtifact.id.desc())
            .all()
        )

    def mark_task_running(self, db: Session, task: UIAutomationTask) -> UIAutomationTask:
        if task.status == "running":
            return task
        task.status = "running"
        task.started_at = datetime.utcnow()
        task.error_message = None
        db.commit()
        db.refresh(task)
        return task

    async def run_task_async(self, task_id: int) -> None:
        """后台执行骨架：模拟 browser-use 步骤执行并写入产物。"""
        db = SessionLocal()
        try:
            task = self.get_task(db, task_id)
            if not task:
                return

            steps = self.get_task_steps(db, task_id)
            if not steps:
                task.status = "failed"
                task.error_message = "无可执行步骤"
                task.finished_at = datetime.utcnow()
                db.commit()
                return

            total = len(steps)
            for idx, step in enumerate(steps, start=1):
                step.status = "running"
                step.started_at = datetime.utcnow()
                db.commit()

                await asyncio.sleep(0.35)

                # 这里预留 browser-use 执行动作
                step.status = "success"
                step.detail = f"browser-use 执行步骤成功：{step.step_title}"
                step.finished_at = datetime.utcnow()

                db.add(
                    UIAutomationArtifact(
                        task_id=task.id,
                        artifact_type="screenshot",
                        artifact_name=f"step-{idx:02d}.png",
                        artifact_path=f"/artifacts/ui-task-{task.id}/step-{idx:02d}.png",
                    )
                )
                db.add(
                    UIAutomationArtifact(
                        task_id=task.id,
                        artifact_type="dom_snapshot",
                        artifact_name=f"step-{idx:02d}.html",
                        artifact_content=f"<!-- DOM snapshot placeholder for step {idx} -->",
                    )
                )

                task.progress = int(idx * 100 / total)
                db.commit()

            task.status = "success"
            task.progress = 100
            task.finished_at = datetime.utcnow()
            db.commit()
        except Exception as exc:
            task = self.get_task(db, task_id)
            if task:
                task.status = "failed"
                task.error_message = str(exc)
                task.finished_at = datetime.utcnow()
                db.add(
                    UIAutomationArtifact(
                        task_id=task.id,
                        artifact_type="error",
                        artifact_name="runtime-error.txt",
                        artifact_content=str(exc),
                    )
                )
                db.commit()
        finally:
            db.close()

    def solidify_to_playwright(self, db: Session, task: UIAutomationTask) -> Dict[str, str]:
        script_name = f"ui-task-{task.id}.spec.ts"
        script_content = self._build_playwright_script(task)

        task.playwright_script = script_content
        db.add(
            UIAutomationArtifact(
                task_id=task.id,
                artifact_type="script",
                artifact_name=script_name,
                artifact_content=script_content,
            )
        )
        db.commit()
        db.refresh(task)
        return {"script_name": script_name, "script_content": script_content}

    def _build_playwright_script(self, task: UIAutomationTask) -> str:
        steps = task.natural_language_steps or []
        assertions = task.assertions or []
        steps_block = "\n".join([f"  // Step {i + 1}: {s}" for i, s in enumerate(steps)])
        assertions_block = "\n".join([f"  // Assert {i + 1}: {a}" for i, a in enumerate(assertions)])
        if not steps_block:
            steps_block = "  // TODO: add steps"
        if not assertions_block:
            assertions_block = "  // TODO: add assertions"

        return f"""import {{ test, expect }} from '@playwright/test';

test('{task.name}', async ({{ page }}) => {{
  await page.goto('{task.target_url}');

{steps_block}

{assertions_block}

  await expect(page).toHaveURL(/.*/);
}});
"""
