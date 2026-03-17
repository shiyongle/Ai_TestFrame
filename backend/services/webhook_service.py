import base64
import hashlib
import hmac
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.logging import setup_logging
from models.database_models import SystemSetting
from utils.http_client import HttpClient

logger = setup_logging()[0]


@dataclass
class WebhookProviderConfig:
    provider: str
    enabled: bool = False
    url: str = ""
    secret: str = ""
    token: str = ""
    app_id: str = ""
    app_secret: str = ""


class WebhookService:
    """统一的 Webhook 通知服务。"""

    PROVIDER_ALIASES = {
        "dingtalk": "dingtalk",
        "dingtalk": "dingtalk",
        "钉钉": "dingtalk",
        "feishu": "feishu",
        "lark": "feishu",
        "飞书": "feishu",
        "wework": "wework",
        "qiwei": "wework",
        "qywx": "wework",
        "企微": "wework",
        "企业微信": "wework",
        "welink": "welink",
        "华为welink": "welink",
        "openclaw": "openclaw",
        "generic": "generic",
    }

    def get_settings(self, db: Optional[Session] = None) -> Dict[str, str]:
        owns_session = db is None
        if owns_session:
            db = SessionLocal()

        try:
            records = db.query(SystemSetting).filter(SystemSetting.category == "webhook").all()
            return {record.setting_key: record.setting_value or "" for record in records}
        finally:
            if owns_session and db is not None:
                db.close()

    def get_default_provider(self, db: Optional[Session] = None) -> str:
        settings_map = self.get_settings(db)
        configured = settings_map.get("WEBHOOK_DEFAULT_PROVIDER", "").strip()
        normalized = self._normalize_provider(configured) if configured else ""
        if normalized:
            return normalized

        enabled = self.get_enabled_providers(db)
        return enabled[0] if enabled else "generic"

    def get_enabled_providers(self, db: Optional[Session] = None) -> List[str]:
        settings_map = self.get_settings(db)
        enabled = []
        for provider in ["dingtalk", "feishu", "wework", "welink", "openclaw"]:
            config = self._build_provider_config(provider, settings_map)
            if config.enabled and config.url:
                enabled.append(provider)
        return enabled

    async def send_notification(
        self,
        *,
        title: str,
        content: str,
        provider: Optional[str] = None,
        db: Optional[Session] = None,
        mentioned_list: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        settings_map = self.get_settings(db)
        selected_provider = self._normalize_provider(provider or settings_map.get("WEBHOOK_DEFAULT_PROVIDER") or "generic")
        config = self._build_provider_config(selected_provider, settings_map)

        if selected_provider != "generic" and not config.enabled:
            raise ValueError(f"Webhook 渠道未启用: {selected_provider}")
        if not config.url:
            raise ValueError(f"Webhook 渠道未配置 URL: {selected_provider}")

        if selected_provider == "dingtalk":
            return await self._send_dingtalk(config, title, content, mentioned_list, metadata)
        if selected_provider == "feishu":
            return await self._send_feishu(config, title, content, metadata)
        if selected_provider == "wework":
            return await self._send_wework(config, title, content, metadata)
        if selected_provider == "welink":
            return await self._send_welink(config, title, content, metadata)
        if selected_provider == "openclaw":
            return await self._send_openclaw(config, title, content, metadata)
        return await self._send_generic(config, title, content, metadata)

    async def send_notifications(
        self,
        *,
        title: str,
        content: str,
        providers: Optional[List[str]] = None,
        db: Optional[Session] = None,
        mentioned_list: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        targets = providers or self.get_enabled_providers(db)
        if not targets:
            targets = [self.get_default_provider(db)]

        results = []
        for provider in targets:
            try:
                result = await self.send_notification(
                    title=title,
                    content=content,
                    provider=provider,
                    db=db,
                    mentioned_list=mentioned_list,
                    metadata=metadata,
                )
                results.append(result)
            except Exception as exc:
                logger.error(f"发送 Webhook 通知失败: provider={provider}, error={exc}")
                results.append({
                    "success": False,
                    "provider": self._normalize_provider(provider),
                    "error": str(exc),
                })
        return results

    def _build_provider_config(self, provider: str, settings_map: Dict[str, str]) -> WebhookProviderConfig:
        normalized = self._normalize_provider(provider)
        prefix = f"WEBHOOK_{normalized.upper()}_"

        return WebhookProviderConfig(
            provider=normalized,
            enabled=self._as_bool(settings_map.get(f"{prefix}ENABLED")),
            url=settings_map.get(f"{prefix}URL", "").strip(),
            secret=settings_map.get(f"{prefix}SECRET", "").strip(),
            token=settings_map.get(f"{prefix}TOKEN", "").strip(),
            app_id=settings_map.get(f"{prefix}APP_ID", "").strip(),
            app_secret=settings_map.get(f"{prefix}APP_SECRET", "").strip(),
        )

    def _normalize_provider(self, provider: str) -> str:
        normalized = str(provider or "").strip().lower()
        return self.PROVIDER_ALIASES.get(normalized, normalized or "generic")

    def _as_bool(self, value: Optional[str]) -> bool:
        return str(value or "").strip().lower() in {"1", "true", "yes", "on"}

    async def _send_dingtalk(
        self,
        config: WebhookProviderConfig,
        title: str,
        content: str,
        mentioned_list: Optional[List[str]],
        metadata: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        url = config.url
        if config.secret:
            timestamp = str(int(time.time() * 1000))
            string_to_sign = f"{timestamp}\n{config.secret}"
            digest = hmac.new(config.secret.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha256).digest()
            sign = base64.b64encode(digest).decode("utf-8")
            url = self._merge_query(url, {"timestamp": timestamp, "sign": sign})

        payload = {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": f"### {title}\n\n{content}",
            },
        }
        if mentioned_list:
            payload["at"] = {"atMobiles": mentioned_list, "isAtAll": False}

        return await self._post(provider="dingtalk", url=url, payload=payload)

    async def _send_feishu(
        self,
        config: WebhookProviderConfig,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "msg_type": "post",
            "content": {
                "post": {
                    "zh_cn": {
                        "title": title,
                        "content": [[{"tag": "text", "text": content}]],
                    }
                }
            },
        }

        if config.secret:
            timestamp = str(int(time.time()))
            string_to_sign = f"{timestamp}\n{config.secret}"
            digest = hmac.new(string_to_sign.encode("utf-8"), b"", hashlib.sha256).digest()
            payload["timestamp"] = timestamp
            payload["sign"] = base64.b64encode(digest).decode("utf-8")

        if metadata:
            payload["metadata"] = metadata

        return await self._post(provider="feishu", url=config.url, payload=payload)

    async def _send_wework(
        self,
        config: WebhookProviderConfig,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        payload = {
            "msgtype": "markdown",
            "markdown": {
                "content": f"## {title}\n{content}",
            },
        }
        if metadata:
            payload["context"] = metadata

        headers = {"X-Webhook-Secret": config.secret} if config.secret else None
        return await self._post(provider="wework", url=config.url, payload=payload, headers=headers)

    async def _send_welink(
        self,
        config: WebhookProviderConfig,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        payload = {
            "title": title,
            "text": content,
            "markdown": f"### {title}\n\n{content}",
            "appId": config.app_id or None,
            "metadata": metadata or {},
        }
        headers = {}
        if config.app_secret:
            headers["X-App-Secret"] = config.app_secret
        if config.app_id:
            headers["X-App-Id"] = config.app_id

        return await self._post(provider="welink", url=config.url, payload=payload, headers=headers or None)

    async def _send_openclaw(
        self,
        config: WebhookProviderConfig,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        payload = {
            "name": "Ai_TestFrame",
            "title": title,
            "content": content,
            "payload": metadata or {},
        }
        headers = {}
        if config.token:
            headers["Authorization"] = f"Bearer {config.token}"

        return await self._post(provider="openclaw", url=config.url, payload=payload, headers=headers or None)

    async def _send_generic(
        self,
        config: WebhookProviderConfig,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        payload = {
            "title": title,
            "content": content,
            "metadata": metadata or {},
        }
        headers = {"Authorization": f"Bearer {config.token}"} if config.token else None
        return await self._post(provider=config.provider or "generic", url=config.url, payload=payload, headers=headers)

    async def _post(
        self,
        *,
        provider: str,
        url: str,
        payload: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        async with HttpClient(timeout=30) as client:
            response = await client.post(url, headers=headers, data=payload)

        result = {
            "success": response.get("success", False),
            "provider": provider,
            "status_code": response.get("status_code", 0),
            "response": response.get("body"),
            "error": response.get("error_message"),
        }

        if result["success"]:
            logger.info(f"Webhook 通知发送成功: provider={provider}, status={result['status_code']}")
        else:
            logger.error(f"Webhook 通知发送失败: provider={provider}, error={result['error']}")

        return result

    def _merge_query(self, url: str, params: Dict[str, str]) -> str:
        parsed = urlparse(url)
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query.update(params)
        return urlunparse(parsed._replace(query=urlencode(query)))


webhook_service = WebhookService()
