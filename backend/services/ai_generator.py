#!/usr/bin/env python3
"""
AI测试用例生成服务
升级版：5步 Agentic 工作流结合 RAG 增强
"""

import json
import asyncio
import re
from typing import List, Dict, Any
from models.database_models import Requirement, TestCase, Project
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

class AITestCaseGenerator:
    """AI测试用例生成器（5步Agentic工作流）"""
    
    def __init__(self):
        logger.info("AI测试用例生成器初始化成功（升级为5步Agentic工作流）")
        self._ai_tone_phrases = [
            "确保",
            "全面覆盖",
            "覆盖所有场景",
            "无懈可击",
            "建议补充",
            "建议增加",
            "通常情况下",
            "尽量",
            "可以考虑",
            "需要注意的是",
            "从而提升",
            "进一步优化",
            "最佳实践"
        ]

    def _strip_ai_tone(self, text: Any) -> str:
        """移除常见空泛AI腔表达，保留可执行信息"""
        if not isinstance(text, str):
            return ""
        cleaned = text.strip()
        for phrase in self._ai_tone_phrases:
            cleaned = cleaned.replace(phrase, "")
        # 规整多余空白与标点
        while "  " in cleaned:
            cleaned = cleaned.replace("  ", " ")
        cleaned = cleaned.replace("，，", "，").replace("。。", "。").strip("，。； ")
        return cleaned

    def _post_process_cases(self, cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """生成后做结构和文风清洗，减少AI味"""
        polished_cases: List[Dict[str, Any]] = []

        for idx, case in enumerate(cases):
            if not isinstance(case, dict):
                continue

            title = self._strip_ai_tone(case.get("title") or case.get("name") or f"自动生成用例-{idx+1}")[:80]
            description = self._strip_ai_tone(case.get("description", ""))[:160]
            preconditions = self._strip_ai_tone(case.get("preconditions", "")) or "无"
            test_data = self._strip_ai_tone(case.get("test_data", ""))[:240]
            expected_result = self._strip_ai_tone(case.get("expected_result", ""))[:240]
            notes = self._strip_ai_tone(case.get("notes", ""))[:240]
            priority = case.get("priority", "中")

            # 清洗步骤，保留动作+可验证结果
            raw_steps = case.get("test_steps", [])
            steps = []
            if isinstance(raw_steps, list):
                for sidx, step in enumerate(raw_steps):
                    if not isinstance(step, dict):
                        continue
                    action = self._strip_ai_tone(step.get("action", ""))
                    expected = self._strip_ai_tone(step.get("expected", ""))
                    if not action or not expected:
                        continue
                    steps.append({
                        "step": len(steps) + 1,
                        "action": action[:160],
                        "expected": expected[:200]
                    })

            if not steps:
                steps = [{
                    "step": 1,
                    "action": "执行目标操作",
                    "expected": "返回结果与验收标准一致"
                }]

            polished_cases.append({
                "title": title or f"自动生成用例-{idx+1}",
                "description": description or "基于需求生成的功能测试场景",
                "preconditions": preconditions,
                "test_steps": steps,
                "test_data": test_data or "按需求字段准备有效/无效输入",
                "priority": priority,
                "expected_result": expected_result or "系统返回符合验收标准，关键字段可断言",
                "notes": notes
            })

        return polished_cases

    def _prepare_llm_text(self, text: Any) -> str:
        """规整不同模型返回的 content 结构，统一转为可解析文本"""
        if text is None:
            return ""
        if isinstance(text, str):
            return text.strip()
        if isinstance(text, (dict, list)):
            try:
                return json.dumps(text, ensure_ascii=False)
            except Exception:
                return str(text).strip()
        return str(text).strip()

    def _log_llm_preview(self, step_name: str, content: Any) -> None:
        """记录模型返回预览，便于定位结构化失败原因"""
        text = self._prepare_llm_text(content)
        preview = re.sub(r"\s+", " ", text)[:800]
        logger.info(f"{step_name} LLM原始输出预览: {preview}")

    async def _extract_json_from_text(self, text: Any) -> Any:
        """从不可靠的LLM文本输出中安全提取JSON"""
        text = self._prepare_llm_text(text)

        fenced_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
        if fenced_match:
            text = fenced_match.group(1).strip()
        elif text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]

        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            logger.warning("基础JSON解析失败，尝试高级栈式匹配恢复...")

            candidate_segments = []
            array_match = re.search(r"\[[\s\S]*\]", text)
            if array_match:
                candidate_segments.append(array_match.group(0))
            object_match = re.search(r"\{[\s\S]*\}", text)
            if object_match:
                candidate_segments.append(object_match.group(0))

            for candidate in candidate_segments:
                try:
                    return json.loads(candidate, strict=False)
                except Exception:
                    pass

            # 尝试使用栈式括号匹配逐个提取对象（针对超大数组被截断的终极防御）
            extracted_cases = []
            stack = []
            start_idx = -1

            for i, char in enumerate(text):
                if char == '{':
                    if not stack:
                        start_idx = i
                    stack.append(char)
                elif char == '}':
                    if stack:
                        stack.pop()
                        if not stack and start_idx != -1:
                            obj_str = text[start_idx:i+1]
                            try:
                                obj = json.loads(obj_str, strict=False)
                                extracted_cases.append(obj)
                            except json.JSONDecodeError:
                                pass

            if extracted_cases:
                logger.info(f"高级栈式匹配恢复成功，提取了 {len(extracted_cases)} 个对象")
                return extracted_cases

            if '[' in text and ']' in text:
                try:
                    start = text.find('[')
                    end = text.rfind(']') + 1
                    return json.loads(text[start:end], strict=False)
                except Exception:
                    pass

            if '{' in text and '}' in text:
                try:
                    start = text.find('{')
                    end = text.rfind('}') + 1
                    return json.loads(text[start:end], strict=False)
                except Exception:
                    pass

            raise json.JSONDecodeError("无法提取有效的JSON结构", text, 0)

    async def generate_test_case_from_requirement(
        self,
        requirement: Requirement,
        model: str = "glm-4.6",
        explicit_context: str = "",
        use_rag: bool = True,
        custom_prompt: str = None
    ) -> Dict[str, Any]:
        """基于5步 Agentic 工作流生成测试用例，并返回结构化证据"""
        try:
            from services.ai.llm_client import llm_client
            from services.ai.rag_engine import rag_engine

            # 模型路由：前端传来的 provider 字符串直接使用，兼容所有已配置提供商
            provider_map = {
                "glm": "glm",
                "openai": "openai",
                "gpt-4": "openai",
                "deepseek": "deepseek",
                "tongyi": "tongyi",
                "siliconflow": "siliconflow",
                "newapi": "newapi",
                "new-api": "newapi",
            }
            provider = provider_map.get(model, model)  # 未知的直接透传，让 llm_client 报错

            logger.info(f"=== 开始生成测试用例 (需求: {requirement.title}) ===")
            
            # Step 1: 需求结构化解析与主链路提取
            logger.info("➡️ Step 1: 需求核心主链路提取 (Blueprint Extraction)")
            blueprint = await self._step1_extract_blueprint(requirement, provider, llm_client)
            logger.info(f"   主链路步骤: {blueprint.get('happy_path_steps', [])}")

            # Step 2: 基于补充与主链路进行混合 RAG 检索知识
            logger.info("➡️ Step 2: 准备混合知识 (Hybrid Knowledge Preparation)")
            rag_payload = {
                "query": "",
                "context": "",
                "hits": [],
                "status": "disabled"
            }
            if use_rag:
                rag_payload = await self._step2_retrieve_knowledge(blueprint, rag_engine)
            
            rag_context = rag_payload.get("context", "")
            combined_context = ""
            if explicit_context:
                combined_context += f"【人工强关联的历史业务规则】：\n{explicit_context}\n\n"
            if rag_context and rag_context not in ["（无额外检索条件）", "（检索知识库后未发现相关历史测试规范或关联参考知识片段）", "（知识库检索不可用）"]:
                combined_context += f"【系统隐性匹配的参考常识与规范记录】：\n{rag_context}\n"
                
            if not combined_context:
                combined_context = "（无附加知识规则）"

            # Step 3: 根据约束，生成测试大纲维度
            logger.info("➡️ Step 3: 结合知识与约束生成测试大纲维度")
            test_points = await self._step3_generate_test_points(requirement, blueprint, combined_context, provider, llm_client)
            logger.info(f"   共生成 {len(test_points)} 个测试点维度")

            # Step 4: 基于大纲扩散生成具体用例
            logger.info(f"➡️ Step 4: 扩散生成具体用例 (针对 {len(test_points)} 个测试点)")
            generated_cases = await self._step4_expand_test_cases(requirement, test_points, combined_context, provider, llm_client)

            # Step 5: 自我反思/漏测检查
            logger.info("➡️ Step 5: 自我审计与漏测补全 (Review & Self-Correction)")
            final_cases = await self._step5_review_and_correct(requirement, blueprint, generated_cases, provider, llm_client)
            final_cases = self._post_process_cases(final_cases)
            evidence = self._build_case_evidence(final_cases, explicit_context, rag_payload)

            logger.info(f"=== 测试用例 Agentic 生成完成，共产出 {len(final_cases)} 条用例 ===")
            return {
                "cases": final_cases,
                "evidence": evidence,
                "blueprint": blueprint,
                "rag": rag_payload
            }

        except Exception as e:
            logger.error(f"Agentic 生成测试用例流程中发生崩溃: {e}", exc_info=True)
            logger.warning("Agentic 失败，回退至模拟兜底数据...")
            mock_cases = await self._generate_mock(requirement)
            return {
                "cases": mock_cases,
                "evidence": self._build_case_evidence(mock_cases, explicit_context, {"query": "", "context": "", "hits": [], "status": "error"}),
                "blueprint": {
                    "core_objective": requirement.title,
                    "happy_path_steps": [],
                    "modules": []
                },
                "rag": {
                    "query": "",
                    "context": "",
                    "hits": [],
                    "status": "error",
                    "error": str(e)
                }
            }

    async def _step1_extract_blueprint(self, req: Requirement, provider: str, llm_client) -> Dict[str, Any]:
        """第一步：提取需求主链路与大纲"""
        prompt = f"""
请作为专业的产品分析师，仔细阅读并分析以下产品需求。
1. 提取出该需求的核心业务目标
2. 提取出该需求的主逻辑链路（Happy Path），将其分步骤概括
3. 指出该需求涉及的主要功能模块

必须返回如下格式的纯 JSON 数据：
{{
  "core_objective": "一句话概括核心目标",
  "happy_path_steps": ["正常主链路步骤1", "步骤2", "..."],
  "modules": ["涉及的功能模块1", "模块2"]
}}

【产品需求】：
标题：{req.title}
描述：{req.description}
验收标准：{req.acceptance_criteria}
业务价值：{req.business_value}
"""
        resp = await llm_client.text_completion(prompt, provider=provider)
        if not resp.get('success'): 
            raise Exception(f"Step 1 接口调用失败: {resp.get('error')}")
            
        try:
            return await self._extract_json_from_text(resp.get('content', ''))
        except Exception as e:
            logger.warning(f"Step 1 获取蓝图 JSON 失败，返回缺省值: {e}")
            return {
                "core_objective": req.title, 
                "happy_path_steps": ["执行正常逻辑和验收标准"], 
                "modules": []
            }

    async def _step2_retrieve_knowledge(self, blueprint: Dict[str, Any], rag_engine) -> Dict[str, Any]:
        """第二步：利用提取的主链路和目标去RAG检索相关历史知识/规范"""
        # 构建精简而关键的检索词
        happy_path = " ".join(blueprint.get('happy_path_steps', []))
        query = f"{blueprint.get('core_objective', '')} {happy_path}".strip()
        
        if not query:
            return {
                "query": "",
                "context": "（无额外检索条件）",
                "hits": [],
                "status": "empty_query"
            }
            
        # 调用 RAG 获取上下文
        try:
            search_results = await rag_engine.search(query, top_k=3)
            if not search_results:
                return {
                    "query": query,
                    "context": "（检索知识库后未发现相关历史测试规范或关联参考知识片段）",
                    "hits": [],
                    "status": "no_hits"
                }

            context_parts = []
            current_length = 0
            normalized_hits = []
            for result in search_results:
                content = result.get('content', '') or ''
                title = result.get('title', '未命名知识')
                if current_length < 2000 and content:
                    remaining_length = 2000 - current_length
                    if remaining_length > 0:
                        snippet = content[:remaining_length]
                        context_parts.append(f"【{title}】\n{snippet}{'...' if len(content) > remaining_length else ''}")
                        current_length += len(snippet)
                normalized_hits.append({
                    "doc_id": result.get("doc_id"),
                    "title": title,
                    "content": content,
                    "source": result.get("source", ""),
                    "category": result.get("category", ""),
                    "metadata": result.get("metadata", {}),
                    "similarity": float(result.get("similarity", 0) or 0),
                    "chunk_index": result.get("chunk_index", 0),
                    "chunk_id": f"{result.get('doc_id')}_chunk_{result.get('chunk_index', 0)}" if result.get("doc_id") else None,
                })

            return {
                "query": query,
                "context": "\n\n".join(context_parts),
                "hits": normalized_hits,
                "status": "ok"
            }
        except Exception as e:
            logger.error(f"Step 2 RAG 检索异常: {e}")
            return {
                "query": query,
                "context": "（知识库检索不可用）",
                "hits": [],
                "status": "error",
                "error": str(e)
            }

    async def _step3_generate_test_points(self, req: Requirement, blueprint: Dict[str, Any], context: str, provider: str, llm_client) -> List[str]:
        """第三步：大纲脑图扩散，结合知识生成独立测试点"""
        prompt = f"""
作为资深测试专家，请以【需求本身】为唯一主线生成测试点，知识库内容只能作为补充参考，不能替代、改写或压过需求主体。
不要直接详细写测试用例！不要写步骤！
请基于 等价类划分、边界值分析、正向业务流程、异常流程容忍度、安全与并发 等多维度，
列举出此需求所有必须测试的关键点(Test Points 大纲)。

输出风格要求（严格）：
1. 必须优先围绕需求标题、需求描述、验收标准、业务价值来拆解测试点。
2. 知识库内容仅用于补充业务规则、历史约束、术语口径，不能偏离需求目标单独展开。
3. 每条测试点是“业务动作 + 触发条件 + 可观察结果”的短句，不写空话。
4. 禁止出现“确保/全面覆盖/建议补充/最佳实践/进一步优化”等泛化表达。
5. 每条长度控制在 18~60 字，优先使用需求原文中的术语、字段名、业务动作。
6. 如果知识库与需求存在冲突，以需求与验收标准为准。

必须返回一个纯 JSON 的字符串数组格式：
[
    "当正确输入全部必填项且属于白名单时的保存正向流程",
    "当XX字段超长或者为空时的异常报错拦截验证",
    "验证操作XX时的并发防重机制",
    "验证关联历史规则XX是否生效"
]

【产品需求（主体，优先级最高）】：
标题：{req.title}
描述：{req.description}
分析提炼后的核心目标：{blueprint.get('core_objective')}
提炼后的主链路步骤：{blueprint.get('happy_path_steps')}
验收标准要求：{req.acceptance_criteria}
业务价值：{req.business_value}

【相关业务知识规则（辅助参考，仅补充，不可喧宾夺主）】：
{context}
"""
        resp = await llm_client.text_completion(prompt, provider=provider)
        if not resp.get('success'):
            raise Exception(f"Step 3 接口调用失败: {resp.get('error')}")

        self._log_llm_preview("Step 3", resp.get('content', ''))

        try:
            points = await self._extract_json_from_text(resp.get('content', ''))
            if isinstance(points, list) and len(points) > 0:
                return points
            return ["基本正向流程测试", "基本边界值与异常流测试"]
        except Exception as e:
            logger.warning(f"Step 3 解析测试维度失败，应用默认: {e}")
            return [f"验证 {req.title} 的验收标准"]

    async def _step4_expand_test_cases(self, req: Requirement, test_points: List[str], context: str, provider: str, llm_client) -> List[Dict[str, Any]]:
        """第四步：基于测试大纲定向扩散为结构化的具体测试用例"""
        points_str = "\n".join([f"{i+1}. {p}" for i, p in enumerate(test_points)])
        prompt = f"""
作为高级自动化测试实施工程师，请以【需求内容】为主体，严格针对以下我列出的【测试大纲点（Test Points）】，逐一展开，将其编写成为详细的软件测试用例。
每一个测试大纲点至少对应一条测试用例，必须覆盖异常与边界情况（如果有提及）。
知识库内容仅用于补充历史规则、术语和约束，不能喧宾夺主，更不能脱离需求独立产出用例。

你必须用标准的 JSON 数组格式返回：
[
  {{
    "title": "测试场景用例标题",
    "description": "用例描述说明",
    "preconditions": "所需前置条件（如无则填 '无'）",
    "test_steps": [
        {{"step": 1, "action": "具体操作步骤1", "expected": "预期系统响应结果1"}}
    ],
    "test_data": "测试输入数据说明",
    "priority": "高（核心流）/中/低",
    "expected_result": "最终期望结果总成",
    "notes": "注意事项与附加说明"
  }}
]

【必须遵守】：
1. 绝对不要返回任何不符合 JSON 结构的文本解释。
2. test_steps 必须是数组。
3. 请确保能够完全将下面列出的全部点转化为结构化用例，一个都不能少。
4. 文风必须“工程化、可执行、可验证”，禁止出现空泛AI措辞（如：确保、全面覆盖、无懈可击、建议补充、最佳实践）。
5. title/description 必须贴近业务语义，不要写“测试场景用例标题”这类模板话。
6. test_steps.action 只写具体操作；test_steps.expected 只写可观察结果（状态码、字段值、提示文案、数据落库等）。
7. 禁止出现“可能/通常/尽量/建议”等不确定措辞。
8. 如果上下文中有历史用例风格，请模仿其表达习惯（短句、术语一致），但不要复制内容。
9. 如果知识库与需求冲突，以需求描述与验收标准为准。
10. 每条用例都要能明确映射回某个需求测试点，不允许脱离需求主体自由发挥。
11. 优先使用需求原文里的业务对象、字段、状态、限制条件来组织步骤与断言。

【需求主体信息（优先级最高）】：
需求标题：{req.title}
需求描述：{req.description}
验收标准：{req.acceptance_criteria}
业务价值：{req.business_value}

【要展开转换的测试大纲点】：
{points_str}

【相关常识与背景知识说明（辅助参考）】：
{context}
"""
        resp = await llm_client.text_completion(prompt, provider=provider, max_tokens=8192)
        if not resp.get('success'):
            raise Exception(f"Step 4 接口调用失败: {resp.get('error')}")

        raw_content = resp.get('content', '')
        self._log_llm_preview("Step 4", raw_content)

        try:
            cases = await self._extract_json_from_text(raw_content)
            if not isinstance(cases, list):
                cases = [cases]
            return cases
        except Exception as e:
            logger.warning(f"Step 4 首次JSON解析失败，尝试二次修复: {e}")

            repair_prompt = f"""
请将下面这段模型输出修复为【纯 JSON 数组】。
不要解释，不要补充任何前后缀，只输出合法 JSON。
每个元素必须包含以下字段：title、description、preconditions、test_steps、test_data、priority、expected_result、notes。
其中 test_steps 必须是数组，每个元素格式为：{{"step": 1, "action": "...", "expected": "..."}}。

待修复内容如下：
{self._prepare_llm_text(raw_content)}
"""
            repair_resp = await llm_client.text_completion(repair_prompt, provider=provider, max_tokens=4096)
            if repair_resp.get('success'):
                self._log_llm_preview("Step 4 Repair", repair_resp.get('content', ''))
                repaired_cases = await self._extract_json_from_text(repair_resp.get('content', ''))
                if not isinstance(repaired_cases, list):
                    repaired_cases = [repaired_cases]
                return repaired_cases

            raise Exception(f"Step 4 JSON 解析失败，且二次修复失败: {e}")

    async def _step5_review_and_correct(self, req: Requirement, blueprint: Dict[str, Any], generated_cases: List[Dict[str, Any]], provider: str, llm_client) -> List[Dict[str, Any]]:
        """第五步：测试审计及关键漏测纠正验证"""
        # 提取已选用例简要摘要以节约Token
        try:
            summary = [{"title": c.get("title", ""), "desc": c.get("description", "")} for c in generated_cases]
            cases_summary = json.dumps(summary, ensure_ascii=False)
        except:
            cases_summary = "提取摘要异常"

        prompt = f"""
你是测试总监兼 QA 评审员。请以【原始需求】为最高优先级审阅当前测试用例，知识库只允许作为辅助参考，不能改变需求主体。
请审阅刚才团队编写的初版测试用例列表，核对它们是否真正完整覆盖了原始需求的【所有验收标准】以及【主逻辑链路】。
你的任务：
1. 分析是否遗漏了致命的安全漏洞测试、异常断网、或者显而易见的极端边界。
2. 分析是否遗漏了【验收标准】中明确指出的某一条细节。
3. 如果发现漏测，请补充最多 1 到 3 条全新的测试用例。如果没有明显的遗漏，或者已完全覆盖，则必须返回空数组 []。
4. 补充用例文风要求与主用例一致：简短、可执行、可断言；禁止空泛AI表达。
5. 如果发现已有用例偏离需求、过度受知识库影响，不要保留这种偏离思路，补充的用例必须重新拉回需求主体。

请务必直接返回补充用例构成的纯 JSON 数组（格式与正常用例保持绝对一致）。例如：
[
  {{
    "title": "补充漏洞：...",
    "description": "...",
    "preconditions": "...",
    "test_steps": [ ... ],
    ...
  }}
]

【原始需求标题】：{req.title}
【原始需求描述】：{req.description}
【原始需求验收标准】：{req.acceptance_criteria}
【原始需求业务价值】：{req.business_value}
【需求主链路蓝图】：{blueprint.get('happy_path_steps')}
【待查漏补缺的初版用例简要摘要】：
{cases_summary}
"""
        try:
            resp = await llm_client.text_completion(prompt, provider=provider, max_tokens=3000)
            if resp.get('success'):
                self._log_llm_preview("Step 5", resp.get('content', '[]'))
                missing_cases = await self._extract_json_from_text(resp.get('content', '[]'))
                if isinstance(missing_cases, list) and len(missing_cases) > 0 and isinstance(missing_cases[0], dict):
                    # 安全性检查：确认这不是之前已有的标题
                    existing_titles = set([c.get('title') for c in generated_cases])
                    for mc in missing_cases:
                        if mc.get('title') not in existing_titles and 'test_steps' in mc:
                            logger.info(f"审计自纠察阶段补全了遗漏用例: {mc.get('title')}")
                            generated_cases.append(mc)
        except Exception as e:
            logger.warning(f"Step 5 审计纠正步骤抛出异常，忽略此步骤的影响（继续使用原生成集合）: {e}")
            
        return generated_cases
        
    def _build_case_evidence(self, cases: List[Dict[str, Any]], explicit_context: str, rag_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """为每条生成用例构造轻量知识命中证据"""
        rag_hits = rag_payload.get("hits", []) if isinstance(rag_payload, dict) else []
        evidence_items: List[Dict[str, Any]] = []

        for idx, case in enumerate(cases):
            case_text_parts = [
                str(case.get("title") or case.get("name") or ""),
                str(case.get("description") or ""),
                str(case.get("expected_result") or ""),
                str(case.get("notes") or ""),
                json.dumps(case.get("test_steps", []), ensure_ascii=False),
            ]
            case_text = "\n".join([part for part in case_text_parts if part]).lower()
            citations = []

            for hit in rag_hits:
                content = str(hit.get("content") or "")
                snippet = content[:80].strip()
                score = float(hit.get("similarity", 0) or 0)
                if not content or score < 0.35:
                    continue

                matched = False
                keywords = [token.strip().lower() for token in re.split(r"[\s,，。；;:：()（）]+", snippet) if len(token.strip()) >= 2]
                for keyword in keywords[:8]:
                    if keyword and keyword in case_text:
                        matched = True
                        break

                if matched or score >= 0.72:
                    citations.append({
                        "knowledge_doc_id": hit.get("metadata", {}).get("knowledge_document_id"),
                        "doc_id": hit.get("doc_id"),
                        "doc_title": hit.get("title"),
                        "source_type": "rag",
                        "evidence_type": "chunk",
                        "chunk_id": hit.get("chunk_id"),
                        "chunk_index": hit.get("chunk_index", 0),
                        "matched_text": snippet,
                        "quote_text": snippet,
                        "similarity_score": round(score, 4)
                    })

            evidence_items.append({
                "case_index": idx,
                "case_title": case.get("title") or case.get("name") or f"自动生成用例-{idx+1}",
                "used_explicit_context": bool(explicit_context),
                "used_rag": bool(rag_hits),
                "knowledge_hit_count": len(citations),
                "citation_count": len(citations),
                "hit_score": max([c["similarity_score"] for c in citations], default=0),
                "evidence_summary": f"命中 {len(citations)} 条知识片段" if citations else "未发现明显知识命中",
                "citations": citations,
                "raw_case": case
            })

        return evidence_items

    async def _generate_mock(self, requirement: Requirement) -> List[Dict[str, Any]]:
        """应急模式：当AI能力失效时的退避兜底"""
        return [
            {
                "title": f"[{requirement.title}] - 服务降级保底测试1",
                "description": f"AI服务当前无法生成结构化数据，生成保底用例以完成流程",
                "preconditions": "系统就绪",
                "test_steps": [
                    {
                        "step": 1,
                        "action": "检查并手动测试各项流",
                        "expected": "按说明书执行成功"
                    }
                ],
                "test_data": "N/A",
                "priority": "中",
                "expected_result": "完成人工接管测试",
                "notes": "该用例由于AI后端生成器错误，采用了退避本地桩策略。"
            }
        ]

# 全局单例
ai_generator = AITestCaseGenerator()
