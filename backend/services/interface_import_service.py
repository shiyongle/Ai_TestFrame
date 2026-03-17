import json
import re
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET


class InterfaceImportService:
    """解析常见接口文档并生成接口测试用例。"""

    SUPPORTED_EXTENSIONS = {".json", ".jmx", ".yaml", ".yml"}
    HTTP_METHODS = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}

    def parse_file(
        self,
        file_name: str,
        file_bytes: bytes,
        project_id: int,
        module: Optional[str] = None,
        max_cases: int = 300,
    ) -> Tuple[List[Dict[str, Any]], str]:
        ext = self._extension(file_name)
        if ext not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"不支持的文件类型: {ext}，仅支持 {', '.join(sorted(self.SUPPORTED_EXTENSIONS))}")

        if ext == ".jmx":
            parsed_items = self._parse_jmx(file_bytes)
            return self._to_cases(parsed_items, project_id, module, source_type="jmx", max_cases=max_cases), "jmx"

        text = self._decode_text(file_bytes)
        if ext in {".yaml", ".yml"}:
            data = self._parse_yaml(text)
        else:
            data = self._parse_json(text)

        source_type = self._detect_source_type(file_name, data)
        if source_type == "openapi":
            parsed_items = self._parse_openapi(data)
        elif source_type == "postman":
            parsed_items = self._parse_postman(data)
        else:
            parsed_items = self._parse_generic_json(data)

        return self._to_cases(parsed_items, project_id, module, source_type=source_type, max_cases=max_cases), source_type

    def _extension(self, file_name: str) -> str:
        idx = file_name.rfind(".")
        return file_name[idx:].lower() if idx >= 0 else ""

    def _decode_text(self, file_bytes: bytes) -> str:
        for enc in ("utf-8", "utf-8-sig", "gbk"):
            try:
                return file_bytes.decode(enc)
            except Exception:
                continue
        return file_bytes.decode("utf-8", errors="ignore")

    def _parse_json(self, text: str) -> Any:
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError(f"JSON 解析失败: {exc}") from exc

    def _parse_yaml(self, text: str) -> Any:
        try:
            import yaml  # type: ignore
        except Exception as exc:
            raise ValueError("当前环境未安装 PyYAML，无法解析 yaml/yml 文件，请改为 json 或安装依赖") from exc
        try:
            return yaml.safe_load(text)
        except Exception as exc:
            raise ValueError(f"YAML 解析失败: {exc}") from exc

    def _detect_source_type(self, file_name: str, data: Any) -> str:
        if isinstance(data, dict):
            if "openapi" in data or "swagger" in data:
                return "openapi"
            schema_text = str(data.get("info", {}).get("schema", "")).lower()
            if "postman" in schema_text:
                return "postman"
            if "item" in data and "info" in data:
                return "postman"

        lower_name = file_name.lower()
        if "postman" in lower_name:
            return "postman"
        if "swagger" in lower_name or "openapi" in lower_name:
            return "openapi"
        return "json"

    def _parse_openapi(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        paths = data.get("paths", {}) if isinstance(data, dict) else {}
        servers = data.get("servers") if isinstance(data, dict) else None
        server_url = ""
        if isinstance(servers, list) and servers:
            first = servers[0] if isinstance(servers[0], dict) else {}
            server_url = str(first.get("url", "")).rstrip("/")

        parsed: List[Dict[str, Any]] = []
        for path, item in paths.items():
            if not isinstance(item, dict):
                continue
            for method, operation in item.items():
                m = str(method).upper()
                if m not in self.HTTP_METHODS:
                    continue
                if not isinstance(operation, dict):
                    operation = {}
                full_url = f"{server_url}{path}" if server_url else str(path)
                headers, params = self._extract_openapi_parameters(operation)
                body = self._extract_openapi_body(operation)
                assertions = self._build_openapi_assertions(operation)
                required_fields = self._extract_required_fields(operation)
                parsed.append(
                    {
                        "name": operation.get("summary") or operation.get("operationId") or f"{m} {path}",
                        "description": operation.get("description") or "",
                        "method": m,
                        "url": full_url,
                        "headers": headers,
                        "params": params,
                        "body": body,
                        "assertions": assertions,
                        "required_fields": required_fields,
                    }
                )
        return parsed

    def _extract_openapi_parameters(self, operation: Dict[str, Any]) -> Tuple[Dict[str, str], Dict[str, str]]:
        headers: Dict[str, str] = {}
        params: Dict[str, str] = {}
        parameters = operation.get("parameters") if isinstance(operation, dict) else []
        if not isinstance(parameters, list):
            return headers, params

        for p in parameters:
            if not isinstance(p, dict):
                continue
            location = str(p.get("in", "")).lower()
            key = str(p.get("name", "")).strip()
            if not key:
                continue
            schema = p.get("schema") if isinstance(p.get("schema"), dict) else {}
            value = schema.get("example")
            if value is None:
                value = schema.get("default")
            if value is None:
                value = "<required>" if p.get("required") else ""
            if location == "header":
                headers[key] = str(value)
            elif location in {"query", "path"}:
                params[key] = str(value)
        return headers, params

    def _extract_openapi_body(self, operation: Dict[str, Any]) -> str:
        request_body = operation.get("requestBody")
        if not isinstance(request_body, dict):
            return ""
        content = request_body.get("content")
        if not isinstance(content, dict):
            return ""

        # 优先 json 作为用例输入体
        json_like = (
            content.get("application/json")
            or content.get("application/*+json")
            or next((v for k, v in content.items() if "json" in str(k).lower()), None)
        )
        if not isinstance(json_like, dict):
            return ""
        schema = json_like.get("schema") if isinstance(json_like.get("schema"), dict) else {}
        example = json_like.get("example")
        if example is not None:
            return self._safe_stringify(example)
        examples = json_like.get("examples")
        if isinstance(examples, dict) and examples:
            first = next(iter(examples.values()))
            if isinstance(first, dict) and first.get("value") is not None:
                return self._safe_stringify(first.get("value"))
        return self._safe_stringify(self._schema_to_sample(schema))

    def _extract_required_fields(self, operation: Dict[str, Any]) -> List[str]:
        required_names: List[str] = []
        parameters = operation.get("parameters")
        if isinstance(parameters, list):
            for p in parameters:
                if isinstance(p, dict) and p.get("required") and p.get("name"):
                    required_names.append(str(p.get("name")))

        request_body = operation.get("requestBody")
        if isinstance(request_body, dict) and request_body.get("required"):
            required_names.append("requestBody")
        return required_names

    def _build_openapi_assertions(self, operation: Dict[str, Any]) -> str:
        responses = operation.get("responses") if isinstance(operation, dict) else {}
        status_candidates: List[str] = []
        if isinstance(responses, dict):
            for key in responses.keys():
                k = str(key)
                if re.fullmatch(r"[1-5]\d\d", k):
                    status_candidates.append(k)
                elif k.lower() == "default":
                    status_candidates.append("200")
        if not status_candidates:
            status_candidates = ["200"]

        lines = [
            f"响应状态码在 {sorted(set(status_candidates))} 范围内",
            "响应时间 < 2000ms",
            "响应体为合法 JSON（若接口返回 JSON）",
        ]
        return "；".join(lines)

    def _parse_postman(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        parsed: List[Dict[str, Any]] = []
        items = data.get("item") if isinstance(data, dict) else []
        if not isinstance(items, list):
            return parsed

        for node in items:
            self._walk_postman_item(node, parsed, parent_name="")
        return parsed

    def _walk_postman_item(self, node: Any, parsed: List[Dict[str, Any]], parent_name: str) -> None:
        if not isinstance(node, dict):
            return
        node_name = str(node.get("name") or "").strip()
        cur_name = f"{parent_name}/{node_name}".strip("/") if node_name else parent_name

        if isinstance(node.get("item"), list):
            for child in node.get("item", []):
                self._walk_postman_item(child, parsed, cur_name)
            return

        request = node.get("request")
        if not isinstance(request, dict):
            return

        method = str(request.get("method", "GET")).upper()
        if method not in self.HTTP_METHODS:
            method = "GET"

        url = request.get("url")
        raw_url = ""
        params: Dict[str, str] = {}
        if isinstance(url, str):
            raw_url = url
        elif isinstance(url, dict):
            raw_url = str(url.get("raw", ""))
            query = url.get("query")
            if isinstance(query, list):
                for q in query:
                    if isinstance(q, dict) and q.get("key"):
                        params[str(q.get("key"))] = str(q.get("value") or "")

        headers: Dict[str, str] = {}
        for h in request.get("header", []) if isinstance(request.get("header"), list) else []:
            if isinstance(h, dict) and h.get("key"):
                headers[str(h.get("key"))] = str(h.get("value") or "")

        body = ""
        body_node = request.get("body")
        if isinstance(body_node, dict):
            mode = str(body_node.get("mode", "")).lower()
            if mode == "raw":
                body = str(body_node.get("raw") or "")
            elif mode == "urlencoded":
                pairs = body_node.get("urlencoded")
                if isinstance(pairs, list):
                    body = self._safe_stringify({str(x.get("key")): x.get("value") for x in pairs if isinstance(x, dict) and x.get("key")})
            elif mode == "formdata":
                pairs = body_node.get("formdata")
                if isinstance(pairs, list):
                    body = self._safe_stringify({str(x.get("key")): x.get("value") for x in pairs if isinstance(x, dict) and x.get("key")})

        parsed.append(
            {
                "name": cur_name or f"{method} {raw_url}",
                "description": str(node.get("description") or ""),
                "method": method,
                "url": raw_url,
                "headers": headers,
                "params": params,
                "body": body,
                "assertions": "响应状态码为 2xx；响应时间 < 2000ms；关键字段校验通过",
                "required_fields": [],
            }
        )

    def _parse_generic_json(self, data: Any) -> List[Dict[str, Any]]:
        if isinstance(data, list):
            return self._parse_generic_json_list(data)
        if isinstance(data, dict):
            if isinstance(data.get("apis"), list):
                return self._parse_generic_json_list(data.get("apis"))
            if isinstance(data.get("endpoints"), list):
                return self._parse_generic_json_list(data.get("endpoints"))
        return []

    def _parse_generic_json_list(self, items: List[Any]) -> List[Dict[str, Any]]:
        parsed: List[Dict[str, Any]] = []
        for raw in items:
            if not isinstance(raw, dict):
                continue
            method = str(raw.get("method", "GET")).upper()
            if method not in self.HTTP_METHODS:
                method = "GET"
            url = str(raw.get("url") or raw.get("path") or "")
            if not url:
                continue
            parsed.append(
                {
                    "name": str(raw.get("name") or raw.get("title") or f"{method} {url}"),
                    "description": str(raw.get("description") or ""),
                    "method": method,
                    "url": url,
                    "headers": raw.get("headers") if isinstance(raw.get("headers"), dict) else {},
                    "params": raw.get("params") if isinstance(raw.get("params"), dict) else {},
                    "body": self._safe_stringify(raw.get("body") or ""),
                    "assertions": "响应状态码为 2xx；响应时间 < 2000ms",
                    "required_fields": [],
                }
            )
        return parsed

    def _parse_jmx(self, file_bytes: bytes) -> List[Dict[str, Any]]:
        text = self._decode_text(file_bytes)
        try:
            root = ET.fromstring(text)
        except ET.ParseError as exc:
            raise ValueError(f"JMX 解析失败: {exc}") from exc

        parsed: List[Dict[str, Any]] = []
        for sampler in root.findall(".//HTTPSamplerProxy"):
            method = self._find_jmx_property(sampler, "HTTPSampler.method") or "GET"
            domain = self._find_jmx_property(sampler, "HTTPSampler.domain") or ""
            port = self._find_jmx_property(sampler, "HTTPSampler.port") or ""
            path = self._find_jmx_property(sampler, "HTTPSampler.path") or ""
            protocol = (self._find_jmx_property(sampler, "HTTPSampler.protocol") or "http").lower()
            raw_name = sampler.attrib.get("testname") or f"{method} {path}"
            url = self._build_url(protocol, domain, port, path)
            parsed.append(
                {
                    "name": raw_name,
                    "description": "从 JMX 场景导入",
                    "method": str(method).upper(),
                    "url": url,
                    "headers": {},
                    "params": {},
                    "body": "",
                    "assertions": "响应状态码为 2xx；响应时间 < 2000ms；内容断言满足预期",
                    "required_fields": [],
                }
            )
        return parsed

    def _find_jmx_property(self, sampler: ET.Element, name: str) -> str:
        for prop in sampler.findall(".//stringProp"):
            if prop.attrib.get("name") == name:
                return (prop.text or "").strip()
        return ""

    def _build_url(self, protocol: str, domain: str, port: str, path: str) -> str:
        p = path if str(path).startswith("/") else f"/{path}" if path else ""
        if domain:
            if port:
                return f"{protocol}://{domain}:{port}{p}"
            return f"{protocol}://{domain}{p}"
        return p

    def _to_cases(
        self,
        parsed_items: List[Dict[str, Any]],
        project_id: int,
        module: Optional[str],
        source_type: str,
        max_cases: int,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        target_module = module or "导入用例"

        for item in parsed_items:
            if len(results) >= max_cases:
                break
            base_case = self._build_positive_case(item, project_id, target_module, source_type)
            results.append(base_case)

            required_fields = item.get("required_fields") or []
            if required_fields and len(results) < max_cases:
                results.append(self._build_missing_required_case(item, project_id, target_module, source_type, required_fields))
        return results

    def _build_positive_case(
        self,
        item: Dict[str, Any],
        project_id: int,
        module: str,
        source_type: str,
    ) -> Dict[str, Any]:
        method = str(item.get("method") or "GET").upper()
        url = str(item.get("url") or "")
        raw_name = str(item.get("name") or f"{method} {url}").strip()

        return {
            "name": f"{raw_name} - 正向验证",
            "description": str(item.get("description") or "").strip(),
            "protocol": "http",
            "method": method,
            "url": url,
            "headers": item.get("headers") if isinstance(item.get("headers"), dict) else {},
            "params": item.get("params") if isinstance(item.get("params"), dict) else {},
            "body": str(item.get("body") or ""),
            "assertions": str(item.get("assertions") or "响应状态码为 2xx；响应时间 < 2000ms"),
            "preconditions": "服务可访问；鉴权信息有效（如需要）",
            "test_data": self._build_test_data_text(item),
            "notes": f"来源: {source_type} 导入；规则: 正向功能+状态码+时延校验",
            "module": module,
            "priority": "medium",
            "status": "active",
            "project_id": project_id,
        }

    def _build_missing_required_case(
        self,
        item: Dict[str, Any],
        project_id: int,
        module: str,
        source_type: str,
        required_fields: List[str],
    ) -> Dict[str, Any]:
        method = str(item.get("method") or "GET").upper()
        url = str(item.get("url") or "")
        raw_name = str(item.get("name") or f"{method} {url}").strip()
        hints = "、".join(required_fields[:3])

        return {
            "name": f"{raw_name} - 必填项缺失校验",
            "description": f"校验接口在缺少必填项({hints})时的错误处理行为",
            "protocol": "http",
            "method": method,
            "url": url,
            "headers": item.get("headers") if isinstance(item.get("headers"), dict) else {},
            "params": {},
            "body": "",
            "assertions": "响应状态码为 4xx；错误码与错误信息符合约定；无服务异常",
            "preconditions": "服务可访问；已准备无效/缺失参数场景",
            "test_data": f"缺失字段: {hints}",
            "notes": f"来源: {source_type} 导入；规则: 必填参数负向校验",
            "module": module,
            "priority": "high",
            "status": "active",
            "project_id": project_id,
        }

    def _build_test_data_text(self, item: Dict[str, Any]) -> str:
        chunks: List[str] = []
        if item.get("params"):
            chunks.append(f"Query/Path: {self._safe_stringify(item.get('params'))}")
        if item.get("headers"):
            chunks.append(f"Headers: {self._safe_stringify(item.get('headers'))}")
        if item.get("body"):
            chunks.append(f"Body: {str(item.get('body'))}")
        return " | ".join(chunks) if chunks else ""

    def _schema_to_sample(self, schema: Dict[str, Any]) -> Any:
        if not isinstance(schema, dict):
            return {}
        schema_type = schema.get("type")
        if schema.get("example") is not None:
            return schema.get("example")
        if schema.get("default") is not None:
            return schema.get("default")
        if isinstance(schema.get("enum"), list) and schema.get("enum"):
            return schema["enum"][0]

        if schema_type == "object":
            props = schema.get("properties", {})
            if isinstance(props, dict):
                return {k: self._schema_to_sample(v if isinstance(v, dict) else {}) for k, v in props.items()}
            return {}
        if schema_type == "array":
            items = schema.get("items", {})
            return [self._schema_to_sample(items if isinstance(items, dict) else {})]
        if schema_type == "integer":
            return 1
        if schema_type == "number":
            return 1.0
        if schema_type == "boolean":
            return True
        return "sample"

    def _safe_stringify(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        try:
            return json.dumps(value, ensure_ascii=False, indent=2)
        except Exception:
            return str(value)
