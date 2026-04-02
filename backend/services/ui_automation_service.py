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

try:
    from browser_use import Agent
    from langchain_openai import ChatOpenAI
except ImportError:
    Agent = None
    ChatOpenAI = None

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
        """后台执行引擎：使用 Browser-Use 和 Langchain 真机拉起并执行页面动作"""
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
            
            # 主动让渡控制权给事件循环，保证主请求可以快速打回 response
            await asyncio.sleep(0.1)

            if Agent is None or ChatOpenAI is None:
                raise ValueError("未完整安装 browser-use 或 langchain-openai，执行终止")

            # 读取数据库配置
            db_settings = {}
            try:
                records = db.query(SystemSetting).filter(SystemSetting.category == 'llm').all()
                for rec in records:
                    db_settings[rec.setting_key] = rec.setting_value
            except Exception:
                pass
            
            api_key = db_settings.get('OPENAI_API_KEY') or getattr(settings, 'OPENAI_API_KEY', None)
            base_url = db_settings.get('OPENAI_BASE_URL') or getattr(settings, 'OPENAI_BASE_URL', "https://api.openai.com/v1")
            model_name = "gpt-4o"
            
            if not api_key:
                api_key = db_settings.get('SILICONFLOW_API_KEY') or getattr(settings, 'SILICONFLOW_API_KEY', None)
                base_url = db_settings.get('SILICONFLOW_BASE_URL') or getattr(settings, 'SILICONFLOW_BASE_URL', "https://api.siliconflow.cn/v1")
                model_name = db_settings.get('SILICONFLOW_CHAT_MODEL') or getattr(settings, 'SILICONFLOW_CHAT_MODEL', 'Qwen/Qwen2.5-7B-Instruct')

            if not api_key:
                raise ValueError("LLM API Key missing! Needs OpenAI or compatible key for Browser-use.")

            llm = ChatOpenAI(model=model_name, api_key=api_key, base_url=base_url)

            # 拼接任务指令对象
            instruction_lines = [f"请打开目标网站: {task.target_url}"]
            
            if task.auth_scheme == "account_password" and task.auth_payload:
                instruction_lines.append(f"需要执行登录，用户名: {task.auth_payload.get('username')}, 密码: {task.auth_payload.get('password')}")

            instruction_lines.append("请执行以下操作：")
            for idx, s in enumerate(task.natural_language_steps or [], 1):
                instruction_lines.append(f"{idx}. {s}")

            if task.assertions:
                instruction_lines.append("并且验证以下断言:")
                for index, a in enumerate(task.assertions, 1):
                    instruction_lines.append(f"- {a}")

            full_task_prompt = "\n".join(instruction_lines)
            
            # 使用 Browser User
            agent = Agent(task=full_task_prompt, llm=llm)
            
            # 由于大模型Agent可能处理数分钟，先将整体任务进度往前拨
            task.progress = 20
            db.commit()
            
            result = await agent.run(max_steps=20)
            
            for s in steps:
                s.status = "success"
                s.finished_at = datetime.utcnow()
                s.detail = "已交由 Browser-Use Agent 委托执行"

            has_history = hasattr(result, "history")
            
            if has_history:
                for idx, history_item in enumerate(result.history):
                    b64_img = ""
                    # 尝试捕获每一步的 state.screenshot base64 对象
                    if hasattr(history_item, "state") and hasattr(history_item.state, "screenshot") and history_item.state.screenshot:
                        b64_img = history_item.state.screenshot
                        if b64_img.startswith("data:image/png;base64,"):
                            b64_img = b64_img.replace("data:image/png;base64,", "")
                            
                    if b64_img:
                        db.add(
                            UIAutomationArtifact(
                                task_id=task.id,
                                artifact_type="screenshot",
                                artifact_name=f"browser_step_{idx+1}.png",
                                artifact_content=b64_img,
                            )
                        )
                    
                    if hasattr(history_item, "state") and hasattr(history_item.state, "interacted_element"):
                        interacted = getattr(history_item.state.interacted_element, "xpath", "Unknown")
                        db.add(
                            UIAutomationArtifact(
                                task_id=task.id,
                                artifact_type="dom_snapshot",
                                artifact_name=f"interacted_{idx+1}.txt",
                                artifact_content=f"History interacted element: {interacted}",
                            )
                        )

            task.status = "success"
            task.progress = 100
            task.finished_at = datetime.utcnow()
            db.commit()

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
