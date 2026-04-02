import asyncio
import asyncio
from datetime import datetime
from typing import Dict, List, Optional
import logging

from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.database_models import UIAutomationArtifact, UIAutomationStepLog, UIAutomationTask, SystemSetting
from schemas.ui_automation_schemas import UIAutomationTaskCreate
from config.settings import settings
import base64
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)


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
            if isinstance(step, dict):
                title = f"[{step.get('action')}] {step.get('target', '')} {step.get('value', '')}".strip()
            else:
                title = str(step)
            db.add(
                UIAutomationStepLog(
                    task_id=task.id,
                    step_index=idx,
                    step_title=title,
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

    def pause_task(self, db: Session, task_id: int) -> UIAutomationTask:
        task = self.get_task(db, task_id)
        if task and task.status == "running":
            task.status = "paused"
            db.commit()
            db.refresh(task)
        return task

    def resume_task(self, db: Session, task_id: int) -> UIAutomationTask:
        task = self.get_task(db, task_id)
        if task and task.status == "paused":
            task.status = "running"
            db.commit()
            db.refresh(task)
        return task

    async def run_task_async(self, task_id: int) -> None:
        """后台执行引擎：使用 Playwright 执行骨架"""
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

            # 主动让渡控制权给事件循环，保证主请求可以快速打回 response
            await asyncio.sleep(0.1)

            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                page = await context.new_page()

                try:
                    # 优先打开目标网站
                    await page.goto(task.target_url)
                    
                    # 鉴权预处理
                    if task.auth_scheme == "cookie" and task.auth_payload:
                        cookies_str = task.auth_payload.get("cookies", "")
                        # 简单的一维 cookie 解析 (a=b; c=d)
                        cookies_list = []
                        if cookies_str:
                            for c in cookies_str.split(";"):
                                if "=" in c:
                                    k, v = c.strip().split("=", 1)
                                    cookies_list.append({"name": k, "value": v, "url": task.target_url})
                        if cookies_list:
                            await context.add_cookies(cookies_list)
                            await page.reload()

                    # 遍历执行步骤
                    structured_steps_data = task.natural_language_steps or []
                    for idx, (step_log, step_data) in enumerate(zip(steps, structured_steps_data), start=1):
                        
                        # ======== 热暂停锁 ========
                        # 每次进入下个步骤前，检查任务状态。如果被标记为 paused，则进入死等。
                        while True:
                            db.refresh(task)
                            if task.status == "paused":
                                await asyncio.sleep(2)
                            elif task.status == "cancelled":
                                raise Exception("执行被人工强行终止(Cancelled)")
                            else:
                                break
                        # ==========================
                        
                        step_log.status = "running"
                        step_log.started_at = datetime.utcnow()
                        db.commit()
                        
                        task.progress = int((idx / len(steps)) * 90)
                        db.commit()

                        action = step_data.get("action") if isinstance(step_data, dict) else "unknown"
                        target = step_data.get("target") if isinstance(step_data, dict) else ""
                        value = step_data.get("value") if isinstance(step_data, dict) else ""

                        try:
                            if action == "goto":
                                await page.goto(target or value)
                            elif action == "click":
                                await page.click(target)
                            elif action == "fill":
                                await page.fill(target, value)
                            elif action == "assert":
                                if target:
                                    # 简单的断言元素是否存在并包含文本
                                    locator = page.locator(target)
                                    await locator.wait_for(state="visible", timeout=5000)
                                    if value:
                                        text = await locator.text_content()
                                        if value not in (text or ""):
                                            raise Exception(f"断言失败: '{value}' 不存在于目标元素中")
                                else:
                                    # 如果没有 target，则在页面整体检查
                                    content = await page.content()
                                    if value not in content:
                                        raise Exception(f"断言失败: '{value}' 不存在于页面中")
                            else:
                                pass # skip unknown or legacy text steps
                            
                            step_log.status = "success"
                            step_log.finished_at = datetime.utcnow()
                            
                            # 截图 (仅部分关键步骤截图，或者最后一步)
                            if idx == len(steps) or action == "assert":
                                screenshot_bytes = await page.screenshot()
                                b64_img = base64.b64encode(screenshot_bytes).decode('utf-8')
                                db.add(
                                    UIAutomationArtifact(
                                        task_id=task.id,
                                        artifact_type="screenshot",
                                        artifact_name=f"step_{idx}_success.png",
                                        artifact_content=b64_img,
                                    )
                                )
                            db.commit()
                            await asyncio.sleep(0.5)
                        except Exception as e:
                            step_log.status = "failed"
                            step_log.finished_at = datetime.utcnow()
                            step_log.detail = str(e)
                            # 失败截图
                            screenshot_bytes = await page.screenshot()
                            b64_img = base64.b64encode(screenshot_bytes).decode('utf-8')
                            db.add(
                                UIAutomationArtifact(
                                    task_id=task.id,
                                    artifact_type="screenshot",
                                    artifact_name=f"step_{idx}_failed.png",
                                    artifact_content=b64_img,
                                )
                            )
                            db.commit()
                            raise e 

                    task.status = "success"
                    task.progress = 100
                    task.finished_at = datetime.utcnow()
                    db.commit()

                finally:
                    await browser.close()

        except Exception as exc:
            task = self.get_task(db, task_id)
            if task:
                task.status = "failed"
                task.error_message = f"执行报错: {str(exc)}"
                task.finished_at = datetime.utcnow()
                db.add(
                    UIAutomationArtifact(
                        task_id=task.id,
                        artifact_type="error",
                        artifact_name="runtime-error.txt",
                        artifact_content=str(exc),
                    )
                )
                
                # 级联更新步骤表
                steps = self.get_task_steps(db, task_id)
                if steps:
                    for s in steps:
                        s.status = "failed"
                        s.finished_at = datetime.utcnow()
                        s.detail = "执行被意外中断"
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
        steps_blocks = []
        for i, s in enumerate(steps):
            if isinstance(s, dict):
                action = s.get("action")
                target = s.get("target")
                value = s.get("value")
                if action == "goto":
                    steps_blocks.append(f"  await page.goto('{target or value}');")
                elif action == "click":
                    steps_blocks.append(f"  await page.click('{target}');")
                elif action == "fill":
                    steps_blocks.append(f"  await page.fill('{target}', '{value}');")
                elif action == "assert":
                    if target:
                        steps_blocks.append(f"  await expect(page.locator('{target}')).toContainText('{value}');")
                    else:
                        steps_blocks.append(f"  // assert global text '{value}'")
            else:
                steps_blocks.append(f"  // Step {i + 1}: {s}")

        steps_str = "\n".join(steps_blocks)
        if not steps_str:
            steps_str = "  // TODO: add structured steps"

        return f"""import {{ test, expect }} from '@playwright/test';

test('{task.name}', async ({{ page }}) => {{
  await page.goto('{task.target_url}');

{steps_str}

  await expect(page).toHaveURL(/.*/);
}});
"""
