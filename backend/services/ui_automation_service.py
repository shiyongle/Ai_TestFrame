import asyncio
from datetime import datetime
from typing import Dict, List, Optional
import logging
from pathlib import Path
import json

from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.database_models import UIAutomationArtifact, UIAutomationStepLog, UIAutomationTask, SystemSetting
from schemas.ui_automation_schemas import UIAutomationTaskCreate
from config.settings import settings
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
            debug_mode=payload.debug_mode,
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

    def delete_task(self, db: Session, task_id: int) -> bool:
        task = self.get_task(db, task_id)
        if not task:
            return False

        db.query(UIAutomationArtifact).filter(UIAutomationArtifact.task_id == task_id).delete(synchronize_session=False)
        db.query(UIAutomationStepLog).filter(UIAutomationStepLog.task_id == task_id).delete(synchronize_session=False)
        db.delete(task)
        db.commit()
        return True

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
        step_timeout_ms = 8000
        navigation_timeout_ms = 15000
        db = SessionLocal()

        artifacts_root = Path(__file__).resolve().parents[1] / "ui_artifacts"

        def safe_commit() -> bool:
            try:
                db.commit()
                return True
            except Exception:
                db.rollback()
                raise

        def persist_step_detail(step_log: UIAutomationStepLog, detail: str, status: Optional[str] = None) -> None:
            step_log.detail = detail
            if status:
                step_log.status = status
                if status in {"success", "failed"}:
                    step_log.finished_at = datetime.utcnow()
            safe_commit()

        def persist_text_artifact(task: UIAutomationTask, artifact_type: str, artifact_name: str, artifact_content: str) -> None:
            db.add(
                UIAutomationArtifact(
                    task_id=task.id,
                    artifact_type=artifact_type,
                    artifact_name=artifact_name,
                    artifact_content=artifact_content,
                )
            )
            safe_commit()

        def persist_file_artifact(task_id_value: int, artifact_type: str, artifact_name: str, artifact_bytes: bytes, description: str) -> None:
            task_dir = artifacts_root / f"task_{task_id_value}"
            task_dir.mkdir(parents=True, exist_ok=True)
            file_path = task_dir / artifact_name
            file_path.write_bytes(artifact_bytes)
            db.add(
                UIAutomationArtifact(
                    task_id=task_id_value,
                    artifact_type=artifact_type,
                    artifact_name=artifact_name,
                    artifact_path=str(file_path.relative_to(artifacts_root.parent)).replace("\\", "/"),
                    artifact_content=description,
                )
            )
            safe_commit()

        def persist_error_artifact(task_id_value: int, artifact_name: str, error_text: str) -> None:
            try:
                db.add(
                    UIAutomationArtifact(
                        task_id=task_id_value,
                        artifact_type="error",
                        artifact_name=artifact_name,
                        artifact_content=error_text[:60000],
                    )
                )
                safe_commit()
            except Exception:
                logger.exception("错误工件写入失败: task_id=%s, artifact_name=%s", task_id_value, artifact_name)

        async def describe_locator_candidate(candidate) -> Dict[str, object]:
            return await asyncio.wait_for(
                candidate.evaluate(
                    """
                    node => ({
                        tag: (node.tagName || '').toLowerCase(),
                        id: node.id || '',
                        name: node.getAttribute('name') || '',
                        type: node.getAttribute('type') || '',
                        placeholder: node.getAttribute('placeholder') || '',
                        ariaLabel: node.getAttribute('aria-label') || '',
                        className: typeof node.className === 'string' ? node.className : '',
                        value: node.getAttribute('value') || '',
                        role: node.getAttribute('role') || ''
                    })
                    """
                ),
                timeout=2,
            )

        async def build_fallback_selectors(target: str) -> List[str]:
            locator = page.locator(target)
            count = await asyncio.wait_for(locator.count(), timeout=2)
            if count <= 0:
                return []

            candidate = locator.first
            try:
                attrs = await describe_locator_candidate(candidate)
            except Exception:
                return []

            tag = (attrs.get("tag") or "").strip() or "*"
            selectors: List[str] = []

            def add_selector(selector: str) -> None:
                normalized = selector.strip()
                if normalized and normalized != target and normalized not in selectors:
                    selectors.append(normalized)

            name = (attrs.get("name") or "").strip()
            placeholder = (attrs.get("placeholder") or "").strip()
            aria_label = (attrs.get("ariaLabel") or "").strip()
            input_type = (attrs.get("type") or "").strip()
            class_name = (attrs.get("className") or "").strip()
            value = (attrs.get("value") or "").strip()

            if name:
                add_selector(f'{tag}[name="{name}"]')
                add_selector(f'[name="{name}"]')
            if placeholder:
                add_selector(f'{tag}[placeholder="{placeholder}"]')
                add_selector(f'[placeholder="{placeholder}"]')
            if aria_label:
                add_selector(f'{tag}[aria-label="{aria_label}"]')
                add_selector(f'[aria-label="{aria_label}"]')
            if input_type:
                add_selector(f'{tag}[type="{input_type}"]')
            if value:
                add_selector(f'{tag}[value="{value}"]')
            if class_name:
                class_selector = "." + ".".join(part for part in class_name.split() if part)
                if class_selector != ".":
                    add_selector(f"{tag}{class_selector}")
                    add_selector(class_selector)

            return selectors

        async def allow_presence_for_hidden_target(target: str) -> Optional[Dict[str, object]]:
            locator = page.locator(target)
            count = await asyncio.wait_for(locator.count(), timeout=2)
            if count <= 0:
                return None

            candidate = locator.first
            try:
                attrs = await describe_locator_candidate(candidate)
                enabled = await asyncio.wait_for(candidate.is_enabled(), timeout=1)
            except Exception:
                return None

            tag = (attrs.get("tag") or "").strip().lower()
            input_type = (attrs.get("type") or "").strip().lower()
            role = (attrs.get("role") or "").strip().lower()
            class_name = (attrs.get("className") or "").strip().lower()
            value = (attrs.get("value") or "").strip()

            is_button_like = (
                tag == "button"
                or input_type in {"submit", "button", "reset"}
                or role == "button"
                or "btn" in class_name
                or "button" in class_name
            )
            if not is_button_like or not enabled:
                return None

            return {
                "locator": candidate,
                "count": count,
                "reason": f"按钮类元素存在且可用，按 presence 视为等待通过: tag={tag or '[unknown]'}, type={input_type or '[unknown]'}, value={value or '[empty]'}",
            }

        async def resolve_active_locator(target: str, allow_fallback: bool = True):
            locator = page.locator(target)
            count = await asyncio.wait_for(locator.count(), timeout=3)
            if count <= 0:
                raise Exception(f"未找到匹配元素: {target}")

            visible_candidates = []
            hidden_count = 0
            for i in range(count):
                candidate = locator.nth(i)
                try:
                    if await asyncio.wait_for(candidate.is_visible(), timeout=1.5):
                        visible_candidates.append(candidate)
                    else:
                        hidden_count += 1
                except Exception:
                    hidden_count += 1

            if visible_candidates:
                return visible_candidates[0], count, len(visible_candidates), hidden_count

            if allow_fallback:
                fallback_selectors = await build_fallback_selectors(target)
                for fallback_selector in fallback_selectors:
                    try:
                        fallback_locator, fallback_total, fallback_visible, fallback_hidden = await resolve_active_locator(
                            fallback_selector,
                            allow_fallback=False,
                        )
                        logger.info(
                            "选择器回退成功: original=%s, fallback=%s, total=%s, visible=%s, hidden=%s",
                            target,
                            fallback_selector,
                            fallback_total,
                            fallback_visible,
                            fallback_hidden,
                        )
                        return fallback_locator, fallback_total, fallback_visible, fallback_hidden
                    except Exception:
                        continue

            raise Exception(f"匹配到 {count} 个元素，但全部不可见: {target}")

        async def wait_for_active_locator(target: str, timeout_ms: int):
            deadline = asyncio.get_running_loop().time() + max(timeout_ms, 1) / 1000
            last_count = 0
            last_hidden_count = 0
            last_error = ""

            while asyncio.get_running_loop().time() < deadline:
                try:
                    locator, total_count, visible_count, hidden_count = await resolve_active_locator(target)
                    return locator, total_count, visible_count, hidden_count, "matched_visible_candidate"
                except Exception as exc:
                    last_error = str(exc)
                    try:
                        current_locator = page.locator(target)
                        last_count = await asyncio.wait_for(current_locator.count(), timeout=1.5)
                        last_hidden_count = 0
                        for i in range(last_count):
                            candidate = current_locator.nth(i)
                            try:
                                is_visible = await asyncio.wait_for(candidate.is_visible(), timeout=1)
                            except Exception:
                                is_visible = False
                            if not is_visible:
                                last_hidden_count += 1
                    except Exception:
                        last_count = 0
                        last_hidden_count = 0

                await asyncio.sleep(0.2)

            if last_count > 0:
                try:
                    presence_result = await allow_presence_for_hidden_target(target)
                except Exception:
                    presence_result = None
                if presence_result:
                    return (
                        presence_result["locator"],
                        int(presence_result["count"]),
                        0,
                        int(presence_result["count"]),
                        str(presence_result["reason"]),
                    )

                fallback_selectors = []
                try:
                    fallback_selectors = await build_fallback_selectors(target)
                except Exception:
                    fallback_selectors = []
                raise Exception(
                    f"等待元素可见超时: {target}, total={last_count}, visible=0, hidden={last_hidden_count}, timeout_ms={timeout_ms}, fallback_candidates={fallback_selectors[:5]}"
                )
            raise Exception(f"等待元素可见超时: {target}, timeout_ms={timeout_ms}, last_error={last_error or '未找到匹配元素'}")

        async def resolve_clickable_locator(target: str):
            try:
                locator, total_count, visible_count, hidden_count = await resolve_active_locator(target)
                return locator, total_count, visible_count, hidden_count, "matched_visible_candidate", False
            except Exception as exc:
                base_error = str(exc)

            try:
                presence_result = await allow_presence_for_hidden_target(target)
            except Exception:
                presence_result = None

            if presence_result:
                return (
                    presence_result["locator"],
                    int(presence_result["count"]),
                    0,
                    int(presence_result["count"]),
                    str(presence_result["reason"]),
                    True,
                )

            raise Exception(base_error)

        async def dom_force_click_by_selector(target: str) -> str:
            click_result = await asyncio.wait_for(
                page.evaluate(
                    """
                    selector => {
                        const node = document.querySelector(selector);
                        if (!node) {
                            return 'not_found';
                        }

                        const tag = (node.tagName || '').toLowerCase();
                        const type = (node.getAttribute('type') || '').toLowerCase();
                        const isButtonLike = tag === 'button' || ['submit', 'button', 'reset'].includes(type);

                        if (typeof node.focus === 'function') {
                            node.focus();
                        }

                        if (isButtonLike && typeof node.click === 'function') {
                            node.click();
                            return 'dom_click';
                        }

                        node.dispatchEvent(new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true,
                            composed: true,
                        }));
                        return 'dispatch_event';
                    }
                    """,
                    target,
                ),
                timeout=2,
            )
            if click_result == "not_found":
                raise Exception(f"DOM 兜底点击失败，未找到元素: {target}")
            return str(click_result)

        async def click_with_retries(target: str, timeout_ms: int):
            locator, total_count, visible_count, hidden_count, click_note, use_forced_click = await resolve_clickable_locator(target)
            last_error = ""

            if visible_count > 0:
                for attempt in range(2):
                    try:
                        await locator.scroll_into_view_if_needed(timeout=timeout_ms)
                    except Exception:
                        pass

                    try:
                        await locator.click(timeout=timeout_ms)
                        return locator, total_count, visible_count, hidden_count, click_note, "native_click"
                    except Exception as exc:
                        last_error = str(exc)
                        if attempt == 0 and ("Element is not visible" in last_error or "not stable" in last_error or "intercepts pointer events" in last_error):
                            await asyncio.sleep(0.3)
                            locator, total_count, visible_count, hidden_count, click_note, use_forced_click = await resolve_clickable_locator(target)
                            continue
                        raise

            if use_forced_click:
                try:
                    await locator.click(timeout=timeout_ms, force=True)
                    return locator, total_count, visible_count, hidden_count, click_note, "forced_playwright_click"
                except Exception as exc:
                    last_error = str(exc)

                dom_click_result = await dom_force_click_by_selector(target)
                return locator, total_count, visible_count, hidden_count, click_note, dom_click_result

            raise Exception(last_error or f"点击失败，未找到可用目标: {target}")

        async def wait_for_all_hidden(target: str, timeout_ms: int):
            deadline = asyncio.get_running_loop().time() + max(timeout_ms, 1) / 1000
            last_count = 0
            last_visible_count = 0

            while asyncio.get_running_loop().time() < deadline:
                locator = page.locator(target)
                try:
                    count = await asyncio.wait_for(locator.count(), timeout=1.5)
                except Exception:
                    count = 0
                last_count = count
                visible_count = 0

                for i in range(count):
                    candidate = locator.nth(i)
                    try:
                        if await asyncio.wait_for(candidate.is_visible(), timeout=1):
                            visible_count += 1
                    except Exception:
                        continue

                last_visible_count = visible_count
                if count == 0 or visible_count == 0:
                    return count, visible_count

                await asyncio.sleep(0.2)

            raise Exception(
                f"等待元素隐藏超时: {target}, total={last_count}, visible={last_visible_count}, timeout_ms={timeout_ms}"
            )

        def build_failure_category(action: str, detail: str, error_text: str) -> str:
            combined = f"{detail} {error_text}".lower()
            if "缺少" in combined or "暂不支持" in combined:
                return "动作编排问题"
            if "不可输入" in combined or "not editable" in combined:
                return "定位到了元素，但元素不可编辑"
            if "wait_for" in combined or "visible" in combined or "selector" in combined or "locator" in combined:
                return "元素定位/页面时机问题"
            if "timeout" in combined:
                return "步骤执行超时，可能是页面未稳定或动作无法完成"
            return "执行阶段异常，需要结合诊断信息继续判断"

        async def build_runtime_diagnosis(task: UIAutomationTask, idx: int, action: str, target: str, detail: str, error_text: str) -> None:
            if page is None:
                persist_text_artifact(
                    task,
                    "diagnosis",
                    f"step_{idx}_diagnosis.txt",
                    f"步骤={idx}\naction={action}\ntarget={target or '[page]'}\n分类={build_failure_category(action, detail, error_text)}\n错误={error_text}\n页面上下文不可用",
                )
                return

            current_url = page.url or ""
            try:
                page_title = await asyncio.wait_for(page.title(), timeout=3)
            except Exception:
                page_title = "[title unavailable]"

            locator_count_text = "[no target]"
            if target:
                try:
                    locator_count = await asyncio.wait_for(page.locator(target).count(), timeout=3)
                    locator_count_text = str(locator_count)
                except Exception as locator_exc:
                    locator_count_text = f"[count failed: {str(locator_exc)}]"

            persist_text_artifact(
                task,
                "diagnosis",
                f"step_{idx}_diagnosis.txt",
                "\n".join([
                    f"步骤={idx}",
                    f"action={action}",
                    f"target={target or '[page]'}",
                    f"分类={build_failure_category(action, detail, error_text)}",
                    f"最后阶段={detail}",
                    f"错误={error_text}",
                    f"current_url={current_url}",
                    f"page_title={page_title}",
                    f"locator_count={locator_count_text}",
                ]),
            )

        async def capture_screenshot(task: UIAutomationTask, artifact_name: str) -> None:
            task_id_value = task.id
            try:
                screenshot_bytes = await asyncio.wait_for(page.screenshot(), timeout=5)
                persist_file_artifact(
                    task_id_value,
                    "screenshot",
                    artifact_name,
                    screenshot_bytes,
                    f"截图已保存到文件，binary_size={len(screenshot_bytes)} bytes",
                )
            except Exception as screenshot_exc:
                logger.exception("截图采集失败: task_id=%s, artifact_name=%s", task_id_value, artifact_name)
                persist_error_artifact(task_id_value, f"{artifact_name}.error.txt", f"截图采集失败: {str(screenshot_exc)}")

        async def capture_dom_snapshot(task: UIAutomationTask, artifact_name: str) -> None:
            if page is None:
                return
            try:
                content = await asyncio.wait_for(page.content(), timeout=5)
                persist_text_artifact(task, "dom_snapshot", artifact_name, content[:60000])
            except Exception as dom_exc:
                persist_text_artifact(task, "error", f"{artifact_name}.error.txt", f"DOM 快照采集失败: {str(dom_exc)}")

        async def capture_trace_artifact(task: UIAutomationTask, artifact_name: str) -> None:
            if not trace_file_path:
                return
            task_id_value = task.id
            try:
                trace_bytes = Path(trace_file_path).read_bytes()
                persist_file_artifact(
                    task_id_value,
                    "trace",
                    artifact_name,
                    trace_bytes,
                    f"trace 已保存到文件，binary_size={len(trace_bytes)} bytes",
                )
            except Exception as trace_exc:
                persist_error_artifact(task_id_value, f"{artifact_name}.error.txt", f"trace 采集失败: {str(trace_exc)}")

        async def capture_selector_diagnosis(task: UIAutomationTask, idx: int, target: str) -> None:
            if page is None or not target:
                return
            try:
                locator = page.locator(target)
                count = await asyncio.wait_for(locator.count(), timeout=3)
                candidates = []
                for i in range(min(count, 5)):
                    candidate = locator.nth(i)
                    try:
                        visible = await asyncio.wait_for(candidate.is_visible(), timeout=1.5)
                    except Exception:
                        visible = False
                    try:
                        enabled = await asyncio.wait_for(candidate.is_enabled(), timeout=1.5)
                    except Exception:
                        enabled = False
                    try:
                        editable = await asyncio.wait_for(candidate.is_editable(), timeout=1.5)
                    except Exception:
                        editable = False
                    try:
                        text = await asyncio.wait_for(candidate.text_content(), timeout=1.5)
                    except Exception:
                        text = None
                    try:
                        outer_html = await asyncio.wait_for(candidate.evaluate("node => node.outerHTML"), timeout=1.5)
                    except Exception:
                        outer_html = None
                    try:
                        box = await asyncio.wait_for(candidate.bounding_box(), timeout=1.5)
                    except Exception:
                        box = None
                    candidates.append({
                        "index": i,
                        "visible": visible,
                        "enabled": enabled,
                        "editable": editable,
                        "text": text,
                        "bounding_box": box,
                        "outer_html": outer_html,
                    })
                persist_text_artifact(
                    task,
                    "selector_diagnosis",
                    f"step_{idx}_selector_diagnosis.json",
                    json.dumps({"target": target, "count": count, "candidates": candidates}, ensure_ascii=False, indent=2),
                )
            except Exception as selector_exc:
                persist_text_artifact(task, "error", f"step_{idx}_selector_diagnosis.error.txt", f"selector 诊断失败: {str(selector_exc)}")

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

            page = None
            trace_file_path = f"ui_trace_task_{task_id}.zip"
            async with async_playwright() as p:
                debug_mode = bool(getattr(task, "debug_mode", False))
                keep_browser_open_on_failure = False
                failure_observed = False
                last_failed_step_index = None
                last_failed_step_title = None

                browser = await p.chromium.launch(headless=not debug_mode)
                context = await browser.new_context()
                if debug_mode:
                    await context.tracing.start(screenshots=True, snapshots=True, sources=True)
                page = await context.new_page()
                page.set_default_timeout(step_timeout_ms)
                page.set_default_navigation_timeout(navigation_timeout_ms)

                try:
                    # 优先打开目标网站
                    await page.goto(task.target_url, wait_until="domcontentloaded", timeout=navigation_timeout_ms)

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
                            await page.reload(wait_until="domcontentloaded", timeout=navigation_timeout_ms)

                    if debug_mode:
                        replay_script = self._build_playwright_script(task)
                        persist_text_artifact(task, "replay_script", f"task_{task_id}_replay.py", replay_script)

                    # 遍历执行步骤
                    structured_steps_data = task.natural_language_steps or []
                    if len(structured_steps_data) != len(steps):
                        persist_text_artifact(
                            task,
                            "diagnosis",
                            f"task_{task_id}_step_alignment.txt",
                            "\n".join([
                                f"step_logs_count={len(steps)}",
                                f"structured_steps_count={len(structured_steps_data)}",
                                "说明=步骤日志数量与结构化步骤数量不一致，旧逻辑会因 zip 截断导致后续步骤被静默跳过。",
                            ]),
                        )

                    for idx, step_log in enumerate(steps, start=1):
                        step_data = structured_steps_data[idx - 1] if idx - 1 < len(structured_steps_data) else None
                        if not isinstance(step_data, dict):
                            raise Exception(
                                f"步骤数据缺失或格式错误: step_index={idx}, "
                                f"step_data_type={type(step_data).__name__ if step_data is not None else 'None'}"
                            )

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
                        step_log.finished_at = None
                        persist_step_detail(step_log, f"步骤开始执行{'（调试模式）' if debug_mode else ''}")

                        task.progress = int((idx / len(steps)) * 90)
                        db.commit()

                        action = step_data.get("action") if isinstance(step_data, dict) else "unknown"
                        target = (step_data.get("target") or "").strip() if isinstance(step_data, dict) else ""
                        value = (step_data.get("value") or "") if isinstance(step_data, dict) else ""
                        raw_timeout_ms = step_data.get("timeout_ms") if isinstance(step_data, dict) else None
                        step_specific_timeout_ms = step_timeout_ms
                        if raw_timeout_ms not in (None, ""):
                            try:
                                parsed_timeout_ms = int(raw_timeout_ms)
                                if parsed_timeout_ms > 0:
                                    step_specific_timeout_ms = parsed_timeout_ms
                            except (TypeError, ValueError):
                                pass

                        try:
                            async def execute_step_action() -> None:
                                if action == "goto":
                                    destination = (target or value).strip()
                                    if not destination:
                                        raise Exception("goto 步骤缺少目标 URL")
                                    persist_step_detail(step_log, f"开始导航: {destination}")
                                    await page.goto(destination, wait_until="domcontentloaded", timeout=navigation_timeout_ms)
                                    persist_step_detail(step_log, f"导航完成: {destination}")
                                elif action == "click":
                                    if not target:
                                        raise Exception("click 步骤缺少可点击的选择器")
                                    persist_step_detail(step_log, f"click-1/4 解析可点击元素: {target}")
                                    locator, total_count, visible_count, hidden_count, click_note, click_mode = await click_with_retries(target, step_specific_timeout_ms)
                                    persist_step_detail(step_log, f"click-2/4 定位完成: total={total_count}, visible={visible_count}, hidden={hidden_count}, note={click_note}")
                                    persist_step_detail(step_log, f"click-3/4 执行点击策略: mode={click_mode}, target={target}")
                                    persist_step_detail(step_log, f"click-4/4 点击完成: {target}")
                                elif action == "fill":
                                    if not target:
                                        raise Exception("fill 步骤缺少输入框选择器")
                                    persist_step_detail(step_log, f"fill-1/5 解析可见输入框: {target}")
                                    locator, total_count, visible_count, hidden_count = await resolve_active_locator(target)
                                    persist_step_detail(step_log, f"fill-2/5 已定位可见输入框: total={total_count}, visible={visible_count}, hidden={hidden_count}")
                                    await locator.scroll_into_view_if_needed(timeout=step_specific_timeout_ms)
                                    persist_step_detail(step_log, f"fill-3/5 滚动到输入框区域: {target}")
                                    editable = await locator.is_editable(timeout=step_specific_timeout_ms)
                                    if not editable:
                                        raise Exception(f"目标元素不可输入: {target}")
                                    persist_step_detail(step_log, f"fill-4/5 校验输入框可编辑通过: {target}")
                                    await locator.fill(value, timeout=step_specific_timeout_ms)
                                    persist_step_detail(step_log, f"fill-5/5 填值完成: {target}, value_length={len(value)}")
                                elif action == "assert":
                                    if target:
                                        persist_step_detail(step_log, f"assert-1/3 解析可见断言元素: {target}")
                                        locator, total_count, visible_count, hidden_count = await resolve_active_locator(target)
                                        persist_step_detail(step_log, f"assert-2/3 已定位可见断言元素: total={total_count}, visible={visible_count}, hidden={hidden_count}")
                                        if value:
                                            persist_step_detail(step_log, f"assert-3/3 校验文本包含: {value}")
                                            text = await locator.text_content(timeout=step_specific_timeout_ms)
                                            if value not in (text or ""):
                                                raise Exception(f"断言失败: '{value}' 不存在于目标元素中")
                                    else:
                                        persist_step_detail(step_log, f"assert-1/1 校验页面内容包含: {value}")
                                        content = await page.content()
                                        if value not in content:
                                            raise Exception(f"断言失败: '{value}' 不存在于页面中")
                                elif action == "sleep":
                                    wait_seconds = 1.0
                                    raw_sleep = (value or target).strip()
                                    if raw_sleep:
                                        try:
                                            wait_seconds = float(raw_sleep)
                                        except ValueError:
                                            raise Exception("sleep 步骤的 value 必须是数字秒数")
                                    if wait_seconds < 0:
                                        raise Exception("sleep 步骤的等待秒数不能小于 0")
                                    persist_step_detail(step_log, f"sleep-1/2 固定等待 {wait_seconds} 秒")
                                    await asyncio.sleep(wait_seconds)
                                    persist_step_detail(step_log, f"sleep-2/2 固定等待结束 {wait_seconds} 秒")
                                elif action == "wait_for_visible":
                                    if not target:
                                        raise Exception("wait_for_visible 步骤缺少目标选择器")
                                    persist_step_detail(step_log, f"wait_for_visible-1/3 等待任一候选元素可见: {target}")
                                    locator, total_count, visible_count, hidden_count, wait_note = await wait_for_active_locator(target, step_specific_timeout_ms)
                                    persist_step_detail(step_log, f"wait_for_visible-2/3 等待完成: total={total_count}, visible={visible_count}, hidden={hidden_count}, note={wait_note}")
                                    if visible_count > 0:
                                        await locator.scroll_into_view_if_needed(timeout=step_specific_timeout_ms)
                                        persist_step_detail(step_log, f"wait_for_visible-3/3 已滚动到可见元素区域: {target}")
                                    else:
                                        persist_step_detail(step_log, f"wait_for_visible-3/3 宽松通过：{wait_note}")
                                elif action == "wait_for_hidden":
                                    if not target:
                                        raise Exception("wait_for_hidden 步骤缺少目标选择器")
                                    persist_step_detail(step_log, f"wait_for_hidden-1/2 等待全部候选元素隐藏: {target}")
                                    total_count, visible_count = await wait_for_all_hidden(target, step_specific_timeout_ms)
                                    persist_step_detail(step_log, f"wait_for_hidden-2/2 元素已隐藏或不存在: total={total_count}, visible={visible_count}")
                                elif action == "wait_for_text":
                                    wait_text = value.strip()
                                    if not wait_text:
                                        raise Exception("wait_for_text 步骤缺少期望文本 value")
                                    if target:
                                        persist_step_detail(step_log, f"wait_for_text-1/3 等待目标元素文本出现: target={target}, text={wait_text}")
                                        locator = page.locator(target).first
                                        await locator.wait_for(state="visible", timeout=step_specific_timeout_ms)
                                        await page.wait_for_function(
                                            """
                                            ([selector, expected]) => {
                                                const el = document.querySelector(selector);
                                                return !!el && (el.innerText || el.textContent || '').includes(expected);
                                            }
                                            """,
                                            arg=[target, wait_text],
                                            timeout=step_specific_timeout_ms,
                                        )
                                        persist_step_detail(step_log, f"wait_for_text-2/3 目标元素文本已出现: {wait_text}")
                                        text = await locator.text_content(timeout=step_specific_timeout_ms)
                                        persist_step_detail(step_log, f"wait_for_text-3/3 当前文本片段: {(text or '')[:120]}")
                                    else:
                                        persist_step_detail(step_log, f"wait_for_text-1/2 等待页面文本出现: {wait_text}")
                                        await page.wait_for_function(
                                            "expected => document.body && (document.body.innerText || document.body.textContent || '').includes(expected)",
                                            arg=wait_text,
                                            timeout=step_specific_timeout_ms,
                                        )
                                        persist_step_detail(step_log, f"wait_for_text-2/2 页面文本已出现: {wait_text}")
                                else:
                                    raise Exception(f"暂不支持的步骤动作: {action}")

                            await asyncio.wait_for(execute_step_action(), timeout=(navigation_timeout_ms if action == "goto" else step_specific_timeout_ms) / 1000 + 2)

                            persist_step_detail(step_log, f"执行成功: action={action}, target={target or '[page]'}", status="success")

                            if debug_mode:
                                await capture_dom_snapshot(task, f"step_{idx}_dom_snapshot.html")

                            # 截图 (仅部分关键步骤截图，或者最后一步)
                            if idx == len(steps) or action == "assert" or debug_mode:
                                await capture_screenshot(task, f"step_{idx}_success.png")
                            await asyncio.sleep(0.5)
                        except Exception as e:
                            failure_observed = True
                            last_failed_step_index = idx
                            last_failed_step_title = step_log.step_title
                            last_detail = step_log.detail or "步骤开始执行"
                            persist_step_detail(
                                step_log,
                                f"步骤执行失败: action={action}, target={target or '[page]'}, error={str(e)}",
                                status="failed",
                            )
                            await build_runtime_diagnosis(task, idx, action, target, last_detail, str(e))
                            if debug_mode:
                                await capture_dom_snapshot(task, f"step_{idx}_dom_snapshot_failed.html")
                                await capture_selector_diagnosis(task, idx, target)
                            if page is not None:
                                await capture_screenshot(task, f"step_{idx}_failed.png")
                            raise e

                    task.status = "success"
                    task.progress = 100
                    task.finished_at = datetime.utcnow()
                    db.commit()

                finally:
                    if debug_mode:
                        try:
                            await context.tracing.stop(path=trace_file_path)
                            await capture_trace_artifact(task, f"task_{task_id}_trace.zip")
                        except Exception as trace_stop_exc:
                            persist_error_artifact(task_id, f"task_{task_id}_trace.error.txt", f"trace 停止失败: {str(trace_stop_exc)}")

                    if failure_observed and debug_mode:
                        try:
                            current_url = page.url if page is not None else "[page unavailable]"
                        except Exception:
                            current_url = "[page unavailable]"
                        persist_text_artifact(
                            task,
                            "diagnosis",
                            f"task_{task_id}_failure_summary.txt",
                            "\n".join([
                                f"task_id={task_id}",
                                f"failed_step_index={last_failed_step_index}",
                                f"failed_step_title={last_failed_step_title or '[unknown]'}",
                                f"current_url={current_url}",
                                "debug_mode=1",
                                "browser_close_policy=always_closed",
                                "说明=即使调试模式下检测到失败，执行结束后也会自动关闭浏览器；调试信息请查看日志、trace、截图与诊断工件。",
                            ]),
                        )
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

                # 只更新尚未完成的步骤，避免覆盖已成功步骤与原始失败原因
                steps = self.get_task_steps(db, task_id)
                if steps:
                    for s in steps:
                        if s.status == "success":
                            continue
                        if s.status == "failed":
                            if not s.finished_at:
                                s.finished_at = datetime.utcnow()
                            continue
                        s.status = "failed"
                        s.finished_at = datetime.utcnow()
                        if not s.detail:
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
