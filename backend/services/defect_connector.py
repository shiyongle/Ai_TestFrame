from datetime import datetime
from typing import Any, Dict, Optional

import requests
from sqlalchemy.orm import Session

from models.database_models import Defect, SystemSetting


class DefectConnector:
    """外部缺陷平台连接器基类。"""

    provider = "local"

    def create_external_defect(self, defect: Defect) -> Dict[str, Any]:
        return {}

    def update_external_defect(self, defect: Defect, action: str) -> Dict[str, Any]:
        return {}

    def get_external_defect(self, defect: Defect) -> Dict[str, Any]:
        return {}

    def test_connection(self) -> Dict[str, Any]:
        return {"success": True, "provider": self.provider}


class LocalDefectConnector(DefectConnector):
    provider = "local"


class WebhookDefectConnector(DefectConnector):
    """通用 Webhook 连接器，成熟平台可通过中间层适配 Jira/禅道/TAPD 等。"""

    provider = "webhook"

    def __init__(self, webhook_url: str, token: Optional[str] = None):
        self.webhook_url = webhook_url
        self.token = token

    def _post(self, event: str, defect: Defect, action: str = "") -> Dict[str, Any]:
        if not self.webhook_url:
            return {}

        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        payload = {
            "event": event,
            "action": action,
            "defect": {
                "id": defect.id,
                "title": defect.title,
                "description": defect.description,
                "severity": defect.severity,
                "priority": defect.priority,
                "status": defect.status,
                "source_type": defect.source_type,
                "project_id": defect.project_id,
                "report_id": defect.report_id,
                "external_key": defect.external_key,
            },
            "timestamp": datetime.utcnow().isoformat(),
        }
        response = requests.post(self.webhook_url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        try:
            data = response.json()
        except Exception:
            data = {}
        return data if isinstance(data, dict) else {}

    def create_external_defect(self, defect: Defect) -> Dict[str, Any]:
        return self._post("defect.created", defect)

    def update_external_defect(self, defect: Defect, action: str) -> Dict[str, Any]:
        return self._post("defect.updated", defect, action)


class JiraDefectConnector(DefectConnector):
    """Jira Cloud 直连连接器。"""

    provider = "jira"

    def __init__(self, settings: Dict[str, str]):
        self.base_url = settings.get("base_url", "").strip().rstrip("/")
        self.email = settings.get("email", "").strip()
        self.api_token = settings.get("api_token", "").strip()
        self.project_key = settings.get("project_key", "").strip()
        self.issue_type = settings.get("issue_type", "Bug").strip() or "Bug"
        self.status_open = settings.get("status_open", "To Do").strip() or "To Do"
        self.status_in_progress = settings.get("status_in_progress", "In Progress").strip() or "In Progress"
        self.status_resolved = settings.get("status_resolved", "Done").strip() or "Done"
        self.status_verified = settings.get("status_verified", "Done").strip() or "Done"
        self.status_closed = settings.get("status_closed", "Done").strip() or "Done"
        self.status_reopened = settings.get("status_reopened", "To Do").strip() or "To Do"

    def _auth(self):
        return (self.email, self.api_token)

    def _headers(self) -> Dict[str, str]:
        return {"Accept": "application/json", "Content-Type": "application/json"}

    def _request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        if not self.base_url or not self.email or not self.api_token:
            raise ValueError("Jira 配置不完整：base_url、email、api_token 不能为空")
        url = f"{self.base_url}{path}"
        response = requests.request(
            method,
            url,
            auth=self._auth(),
            headers=self._headers(),
            timeout=15,
            **kwargs,
        )
        response.raise_for_status()
        if response.status_code == 204 or not response.text:
            return {}
        data = response.json()
        return data if isinstance(data, dict) else {}

    def _adf(self, text: str) -> Dict[str, Any]:
        lines = (text or "").splitlines() or [""]
        content = []
        for line in lines:
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": line or " "}],
            })
        return {"type": "doc", "version": 1, "content": content}

    def _target_jira_status(self, defect_status: str) -> str:
        return {
            "open": self.status_open,
            "in_progress": self.status_in_progress,
            "resolved": self.status_resolved,
            "verified": self.status_verified,
            "closed": self.status_closed,
            "reopened": self.status_reopened,
        }.get(defect_status, self.status_open)

    def create_external_defect(self, defect: Defect) -> Dict[str, Any]:
        if not self.project_key:
            raise ValueError("Jira 配置不完整：project_key 不能为空")
        payload = {
            "fields": {
                "project": {"key": self.project_key},
                "summary": defect.title,
                "description": self._adf(defect.description or ""),
                "issuetype": {"name": self.issue_type},
            }
        }
        data = self._request("POST", "/rest/api/3/issue", json=payload)
        key = data.get("key")
        result = {
            "external_key": key,
            "external_url": f"{self.base_url}/browse/{key}" if key else None,
            "external_status": self.status_open,
        }
        if key:
            self._add_comment(key, f"投石问路缺陷 ID: {defect.id}，来源: {defect.source_type}")
        return result

    def update_external_defect(self, defect: Defect, action: str) -> Dict[str, Any]:
        if not defect.external_key:
            return self.create_external_defect(defect)
        target_status = self._target_jira_status(defect.status)
        self._transition_issue(defect.external_key, target_status)
        if action:
            self._add_comment(defect.external_key, f"投石问路状态同步：{action} -> {defect.status}")
        issue = self._get_issue(defect.external_key)
        return self._serialize_issue(issue)

    def get_external_defect(self, defect: Defect) -> Dict[str, Any]:
        if not defect.external_key:
            raise ValueError("缺陷尚未关联 Jira Issue")
        return self._serialize_issue(self._get_issue(defect.external_key))

    def test_connection(self) -> Dict[str, Any]:
        user = self._request("GET", "/rest/api/3/myself")
        project = None
        if self.project_key:
            project = self._request("GET", f"/rest/api/3/project/{self.project_key}")
        return {
            "success": True,
            "provider": self.provider,
            "account": user.get("displayName") or user.get("emailAddress"),
            "project": project.get("key") if project else self.project_key,
        }

    def _get_issue(self, issue_key: str) -> Dict[str, Any]:
        return self._request("GET", f"/rest/api/3/issue/{issue_key}?fields=status,summary")

    def _serialize_issue(self, issue: Dict[str, Any]) -> Dict[str, Any]:
        key = issue.get("key")
        status = ((issue.get("fields") or {}).get("status") or {}).get("name")
        return {
            "external_key": key,
            "external_url": f"{self.base_url}/browse/{key}" if key else None,
            "external_status": status,
        }

    def _transition_issue(self, issue_key: str, target_status: str) -> None:
        transitions = self._request("GET", f"/rest/api/3/issue/{issue_key}/transitions").get("transitions", [])
        target_lower = target_status.strip().lower()
        matched = None
        for transition in transitions:
            transition_name = (transition.get("name") or "").strip().lower()
            to_name = (((transition.get("to") or {}).get("name")) or "").strip().lower()
            if transition_name == target_lower or to_name == target_lower:
                matched = transition
                break
        if not matched:
            return
        self._request(
            "POST",
            f"/rest/api/3/issue/{issue_key}/transitions",
            json={"transition": {"id": matched.get("id")}},
        )

    def _add_comment(self, issue_key: str, text: str) -> None:
        try:
            self._request("POST", f"/rest/api/3/issue/{issue_key}/comment", json={"body": self._adf(text)})
        except Exception:
            pass


def _get_setting_map(db: Session) -> Dict[str, str]:
    records = db.query(SystemSetting).filter(SystemSetting.category == "defect").all()
    return {item.setting_key: item.setting_value or "" for item in records}


def get_defect_connector(db: Session) -> DefectConnector:
    settings = _get_setting_map(db)
    provider = (settings.get("provider") or "local").strip().lower()
    if provider == "webhook":
        return WebhookDefectConnector(
            webhook_url=settings.get("webhook_url", "").strip(),
            token=settings.get("webhook_token", "").strip() or None,
        )
    if provider == "jira":
        return JiraDefectConnector(settings)
    return LocalDefectConnector()
