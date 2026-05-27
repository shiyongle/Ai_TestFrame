import json
import random
import re
import uuid
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from sqlalchemy.orm import Session

from models.database_models import ApiAccountPool, ApiDataPool, ApiEnvironment, ApiEnvironmentVariable


VAR_PATTERN = re.compile(r"\{\{\s*([^{}]+?)\s*\}\}")


class EnvironmentService:
    def list_environments(self, db: Session, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        query = db.query(ApiEnvironment)
        if project_id:
            query = query.filter((ApiEnvironment.project_id == project_id) | (ApiEnvironment.project_id.is_(None)))
        rows = query.order_by(ApiEnvironment.is_default.desc(), ApiEnvironment.updated_at.desc()).all()
        return [self.serialize_environment(row, include_children=True) for row in rows]

    def get_environment(self, db: Session, environment_id: int) -> Optional[ApiEnvironment]:
        return db.query(ApiEnvironment).filter(ApiEnvironment.id == environment_id).first()

    def create_environment(self, db: Session, payload: Dict[str, Any]) -> ApiEnvironment:
        if payload.get("is_default"):
            self._clear_default(db, payload.get("project_id"))
        env = ApiEnvironment(**payload)
        db.add(env)
        db.commit()
        db.refresh(env)
        return env

    def update_environment(self, db: Session, environment_id: int, payload: Dict[str, Any]) -> Optional[ApiEnvironment]:
        env = self.get_environment(db, environment_id)
        if not env:
            return None
        if payload.get("is_default"):
            self._clear_default(db, payload.get("project_id", env.project_id), exclude_id=environment_id)
        for key, value in payload.items():
            if hasattr(env, key):
                setattr(env, key, value)
        env.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(env)
        return env

    def delete_environment(self, db: Session, environment_id: int) -> bool:
        env = self.get_environment(db, environment_id)
        if not env:
            return False
        db.delete(env)
        db.commit()
        return True

    def create_variable(self, db: Session, environment_id: int, payload: Dict[str, Any]) -> ApiEnvironmentVariable:
        self._require_environment(db, environment_id)
        variable = ApiEnvironmentVariable(environment_id=environment_id, **payload)
        db.add(variable)
        db.commit()
        db.refresh(variable)
        return variable

    def update_variable(self, db: Session, variable_id: int, payload: Dict[str, Any]) -> Optional[ApiEnvironmentVariable]:
        variable = db.query(ApiEnvironmentVariable).filter(ApiEnvironmentVariable.id == variable_id).first()
        if not variable:
            return None
        for key, value in payload.items():
            if hasattr(variable, key):
                setattr(variable, key, value)
        variable.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(variable)
        return variable

    def delete_variable(self, db: Session, variable_id: int) -> bool:
        variable = db.query(ApiEnvironmentVariable).filter(ApiEnvironmentVariable.id == variable_id).first()
        if not variable:
            return False
        db.delete(variable)
        db.commit()
        return True

    def create_account_pool(self, db: Session, environment_id: int, payload: Dict[str, Any]) -> ApiAccountPool:
        self._require_environment(db, environment_id)
        pool = ApiAccountPool(environment_id=environment_id, **payload)
        db.add(pool)
        db.commit()
        db.refresh(pool)
        return pool

    def update_account_pool(self, db: Session, pool_id: int, payload: Dict[str, Any]) -> Optional[ApiAccountPool]:
        pool = db.query(ApiAccountPool).filter(ApiAccountPool.id == pool_id).first()
        if not pool:
            return None
        for key, value in payload.items():
            if hasattr(pool, key):
                setattr(pool, key, value)
        pool.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(pool)
        return pool

    def delete_account_pool(self, db: Session, pool_id: int) -> bool:
        pool = db.query(ApiAccountPool).filter(ApiAccountPool.id == pool_id).first()
        if not pool:
            return False
        db.delete(pool)
        db.commit()
        return True

    def create_data_pool(self, db: Session, environment_id: int, payload: Dict[str, Any]) -> ApiDataPool:
        self._require_environment(db, environment_id)
        pool = ApiDataPool(environment_id=environment_id, **payload)
        db.add(pool)
        db.commit()
        db.refresh(pool)
        return pool

    def update_data_pool(self, db: Session, pool_id: int, payload: Dict[str, Any]) -> Optional[ApiDataPool]:
        pool = db.query(ApiDataPool).filter(ApiDataPool.id == pool_id).first()
        if not pool:
            return None
        for key, value in payload.items():
            if hasattr(pool, key):
                setattr(pool, key, value)
        pool.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(pool)
        return pool

    def delete_data_pool(self, db: Session, pool_id: int) -> bool:
        pool = db.query(ApiDataPool).filter(ApiDataPool.id == pool_id).first()
        if not pool:
            return False
        db.delete(pool)
        db.commit()
        return True

    def prepare_http_request(self, db: Optional[Session], request: Any) -> Dict[str, Any]:
        variables: Dict[str, Any] = {}
        secret_keys = set()
        environment = None
        selected_account = None
        selected_data = None

        if db and getattr(request, "environment_id", None):
            environment = self.get_environment(db, request.environment_id)
            if not environment:
                raise ValueError("执行环境不存在")
            variables["base_url"] = environment.base_url or ""
            for item in environment.variables:
                if not item.enabled:
                    continue
                variables[item.key] = item.value or ""
                if item.variable_type == "secret":
                    secret_keys.add(item.key)

            selected_account = self._pick_account(db, request.account_pool_id, environment)
            if selected_account:
                for key, value in selected_account.items():
                    variables[f"account.{key}"] = value
                    if "password" in key.lower() or "token" in key.lower() or "secret" in key.lower():
                        secret_keys.add(f"account.{key}")

            selected_data = self._pick_data(db, request.data_pool_id, environment)
            if selected_data:
                for key, value in selected_data.items():
                    variables[f"data.{key}"] = value

            variables.update(self._run_pre_script(environment.pre_script, variables))

        variables.update(getattr(request, "variable_overrides", None) or {})
        variables.update(self._run_pre_script(getattr(request, "pre_script", None), variables))

        rendered_url = self._render(getattr(request, "url"), variables)
        if environment and environment.base_url and rendered_url and rendered_url.startswith("/"):
            rendered_url = urljoin(environment.base_url.rstrip("/") + "/", rendered_url.lstrip("/"))

        rendered = {
            "url": rendered_url,
            "method": getattr(request, "method"),
            "headers": self._render_value(getattr(request, "headers", None) or {}, variables),
            "params": self._render_value(getattr(request, "params", None) or {}, variables),
            "body": self._render_value(getattr(request, "body", None), variables),
            "timeout": getattr(request, "timeout"),
            "verify_ssl": getattr(request, "verify_ssl"),
            "follow_redirects": getattr(request, "follow_redirects"),
        }
        return {
            "request": rendered,
            "variables": variables,
            "secret_keys": secret_keys,
            "environment": self.serialize_environment(environment, include_children=False) if environment else None,
            "selected_account": self._mask(selected_account, {"password", "token", "secret"}) if selected_account else None,
            "selected_data": selected_data,
        }

    def extract_after_http(self, db: Optional[Session], request: Any, response: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        extractors = list(getattr(request, "extractors", None) or [])
        extractors.extend(self._parse_extractors(getattr(request, "post_script", None)))
        environment = context.get("environment")
        if db and getattr(request, "environment_id", None):
            env = self.get_environment(db, request.environment_id)
            if env:
                extractors.extend(self._parse_extractors(env.post_script))

        extracted: Dict[str, Any] = {}
        for extractor in extractors:
            name = extractor.get("name")
            source = extractor.get("source", "json")
            path = extractor.get("path", "")
            if not name:
                continue
            value = self._extract_value(response, source, path)
            if value is not None:
                extracted[name] = value

        if db and getattr(request, "persist_extracted", False) and getattr(request, "environment_id", None):
            for key, value in extracted.items():
                self._upsert_dynamic_variable(db, request.environment_id, key, value)
            db.commit()
        return extracted

    def serialize_environment(self, env: Optional[ApiEnvironment], include_children: bool = False) -> Optional[Dict[str, Any]]:
        if not env:
            return None
        data = {
            "id": env.id,
            "name": env.name,
            "code": env.code,
            "project_id": env.project_id,
            "base_url": env.base_url,
            "description": env.description,
            "status": env.status,
            "is_default": env.is_default,
            "pre_script": env.pre_script,
            "post_script": env.post_script,
            "created_by": env.created_by,
            "created_at": self._dt(env.created_at),
            "updated_at": self._dt(env.updated_at),
        }
        if include_children:
            data["variables"] = [self.serialize_variable(item) for item in env.variables]
            data["account_pools"] = [self.serialize_account_pool(item) for item in env.account_pools]
            data["data_pools"] = [self.serialize_data_pool(item) for item in env.data_pools]
        return data

    def serialize_variable(self, item: ApiEnvironmentVariable) -> Dict[str, Any]:
        value = item.value
        if item.variable_type == "secret" and value:
            value = "******"
        return {
            "id": item.id,
            "environment_id": item.environment_id,
            "key": item.key,
            "value": value,
            "variable_type": item.variable_type,
            "description": item.description,
            "enabled": item.enabled,
            "created_at": self._dt(item.created_at),
            "updated_at": self._dt(item.updated_at),
        }

    def serialize_account_pool(self, item: ApiAccountPool) -> Dict[str, Any]:
        return {
            "id": item.id,
            "environment_id": item.environment_id,
            "name": item.name,
            "strategy": item.strategy,
            "accounts": [self._mask(row, {"password", "token", "secret"}) for row in (item.accounts or [])],
            "current_index": item.current_index or 0,
            "enabled": item.enabled,
            "created_at": self._dt(item.created_at),
            "updated_at": self._dt(item.updated_at),
        }

    def serialize_data_pool(self, item: ApiDataPool) -> Dict[str, Any]:
        return {
            "id": item.id,
            "environment_id": item.environment_id,
            "name": item.name,
            "strategy": item.strategy,
            "rows": item.rows or [],
            "current_index": item.current_index or 0,
            "enabled": item.enabled,
            "created_at": self._dt(item.created_at),
            "updated_at": self._dt(item.updated_at),
        }

    def _pick_account(self, db: Session, pool_id: Optional[int], env: ApiEnvironment) -> Optional[Dict[str, Any]]:
        pool = None
        if pool_id:
            pool = db.query(ApiAccountPool).filter(ApiAccountPool.id == pool_id, ApiAccountPool.environment_id == env.id).first()
        if not pool:
            pool = next((item for item in env.account_pools if item.enabled), None)
        return self._pick_pool_row(db, pool, "accounts") if pool and pool.enabled else None

    def _pick_data(self, db: Session, pool_id: Optional[int], env: ApiEnvironment) -> Optional[Dict[str, Any]]:
        pool = None
        if pool_id:
            pool = db.query(ApiDataPool).filter(ApiDataPool.id == pool_id, ApiDataPool.environment_id == env.id).first()
        if not pool:
            pool = next((item for item in env.data_pools if item.enabled), None)
        return self._pick_pool_row(db, pool, "rows") if pool and pool.enabled else None

    def _pick_pool_row(self, db: Session, pool: Any, field: str) -> Optional[Dict[str, Any]]:
        rows = getattr(pool, field) or []
        if not rows:
            return None
        if pool.strategy == "first":
            return rows[0]
        index = (pool.current_index or 0) % len(rows)
        selected = rows[index]
        pool.current_index = index + 1
        db.commit()
        return selected

    def _run_pre_script(self, script: Optional[str], variables: Dict[str, Any]) -> Dict[str, Any]:
        updates = {}
        for raw_line in (script or "").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("set ") and "=" in line:
                key, value = line[4:].split("=", 1)
                updates[key.strip()] = self._render(value.strip(), {**variables, **updates})
        return updates

    def _parse_extractors(self, script: Optional[str]) -> List[Dict[str, Any]]:
        extractors = []
        for raw_line in (script or "").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 4 and parts[0] == "extract":
                extractors.append({"name": parts[1], "source": parts[2], "path": " ".join(parts[3:])})
        return extractors

    def _render_value(self, value: Any, variables: Dict[str, Any]) -> Any:
        if isinstance(value, str):
            return self._render(value, variables)
        if isinstance(value, list):
            return [self._render_value(item, variables) for item in value]
        if isinstance(value, dict):
            return {key: self._render_value(item, variables) for key, item in value.items()}
        return value

    def _render(self, text: Any, variables: Dict[str, Any]) -> str:
        raw = "" if text is None else str(text)

        def replace(match: re.Match) -> str:
            key = match.group(1).strip()
            if key.startswith("$"):
                return self._dynamic_value(key)
            return str(variables.get(key, match.group(0)))

        return VAR_PATTERN.sub(replace, raw)

    def _dynamic_value(self, key: str) -> str:
        if key == "$timestamp":
            return str(int(datetime.utcnow().timestamp()))
        if key == "$isoTimestamp":
            return datetime.utcnow().isoformat()
        if key == "$uuid":
            return str(uuid.uuid4())
        if key.startswith("$randomInt"):
            parts = key.split(":")
            low = int(parts[1]) if len(parts) > 1 else 0
            high = int(parts[2]) if len(parts) > 2 else 999999
            return str(random.randint(low, high))
        return ""

    def _extract_value(self, response: Dict[str, Any], source: str, path: str) -> Any:
        if source == "header":
            headers = response.get("headers") or {}
            return headers.get(path) or headers.get(path.lower())
        if source == "body":
            return response.get("body")
        body = response.get("body")
        if isinstance(body, str):
            try:
                body = json.loads(body)
            except Exception:
                return None
        return self._json_path(body, path)

    def _json_path(self, payload: Any, path: str) -> Any:
        if not path or path == "$":
            return payload
        current = payload
        normalized = path[2:] if path.startswith("$.") else path
        for part in normalized.split("."):
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, list) and part.isdigit():
                current = current[int(part)]
            else:
                return None
        return current

    def _upsert_dynamic_variable(self, db: Session, environment_id: int, key: str, value: Any) -> None:
        variable = (
            db.query(ApiEnvironmentVariable)
            .filter(ApiEnvironmentVariable.environment_id == environment_id, ApiEnvironmentVariable.key == key)
            .first()
        )
        if variable:
            variable.value = str(value)
            variable.variable_type = "dynamic"
            variable.enabled = True
            variable.updated_at = datetime.utcnow()
            return
        db.add(
            ApiEnvironmentVariable(
                environment_id=environment_id,
                key=key,
                value=str(value),
                variable_type="dynamic",
                enabled=True,
            )
        )

    def _clear_default(self, db: Session, project_id: Optional[int], exclude_id: Optional[int] = None) -> None:
        query = db.query(ApiEnvironment).filter(ApiEnvironment.project_id == project_id)
        if exclude_id:
            query = query.filter(ApiEnvironment.id != exclude_id)
        query.update({ApiEnvironment.is_default: False}, synchronize_session=False)

    def _require_environment(self, db: Session, environment_id: int) -> ApiEnvironment:
        env = self.get_environment(db, environment_id)
        if not env:
            raise ValueError("执行环境不存在")
        return env

    def _mask(self, payload: Optional[Dict[str, Any]], sensitive_keys: set) -> Optional[Dict[str, Any]]:
        if not payload:
            return payload
        masked = deepcopy(payload)
        for key in list(masked.keys()):
            if any(word in key.lower() for word in sensitive_keys):
                masked[key] = "******"
        return masked

    def _dt(self, value: Any) -> Optional[str]:
        return value.isoformat() if value else None


environment_service = EnvironmentService()
