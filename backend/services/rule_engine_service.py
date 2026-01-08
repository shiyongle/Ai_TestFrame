from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models.database_models import RuleTemplate, RuleDefinition, AssertionRule, TestCaseRule
import json
import copy


class RuleEngineService:
    
    def __init__(self, db: Session):
        self.db = db
    
    def generate_testcases_by_rules(
        self, 
        api_info: Dict[str, Any], 
        rule_template_ids: List[int]
    ) -> List[Dict[str, Any]]:
        testcases = []
        
        for template_id in rule_template_ids:
            template = self.get_rule_template_with_details(template_id)
            if not template or not template.is_enabled:
                continue
            
            positive_case = self._generate_positive_case(api_info, template)
            testcases.append(positive_case)
            
            negative_cases = self._generate_negative_cases(api_info, template)
            testcases.extend(negative_cases)
            
            boundary_cases = self._generate_boundary_cases(api_info, template)
            testcases.extend(boundary_cases)
        
        return testcases
    
    def get_rule_template_with_details(self, template_id: int) -> Optional[RuleTemplate]:
        return self.db.query(RuleTemplate).filter(
            RuleTemplate.id == template_id
        ).first()
    
    def _generate_positive_case(
        self, 
        api_info: Dict[str, Any], 
        template: RuleTemplate
    ) -> Dict[str, Any]:
        case = {
            "name": f"{api_info.get('name', 'API')}_正向测试",
            "description": "正常参数测试，验证接口正确性",
            "method": api_info.get('method', 'GET'),
            "url": api_info.get('url', ''),
            "headers": api_info.get('headers', {}),
            "params": self._generate_valid_params(api_info),
            "body": api_info.get('body', {}),
            "assertions": self._build_assertions(template, "positive"),
            "rule_template_id": template.id,
            "case_type": "positive"
        }
        return case
    
    def _generate_negative_cases(
        self, 
        api_info: Dict[str, Any], 
        template: RuleTemplate
    ) -> List[Dict[str, Any]]:
        cases = []
        
        params = api_info.get('params', {})
        if params:
            missing_param_case = self._generate_missing_param_case(api_info, template)
            if missing_param_case:
                cases.append(missing_param_case)
            
            wrong_type_case = self._generate_wrong_type_case(api_info, template)
            if wrong_type_case:
                cases.append(wrong_type_case)
        
        return cases
    
    def _generate_boundary_cases(
        self, 
        api_info: Dict[str, Any], 
        template: RuleTemplate
    ) -> List[Dict[str, Any]]:
        cases = []
        
        params = api_info.get('params', {})
        for param_name, param_info in params.items():
            if isinstance(param_info, dict) and 'type' in param_info:
                if param_info['type'] in ['integer', 'number']:
                    boundary_case = self._generate_boundary_value_case(
                        api_info, template, param_name, param_info
                    )
                    if boundary_case:
                        cases.append(boundary_case)
        
        return cases
    
    def _generate_missing_param_case(
        self, 
        api_info: Dict[str, Any], 
        template: RuleTemplate
    ) -> Optional[Dict[str, Any]]:
        params = api_info.get('params', {})
        required_params = [k for k, v in params.items() 
                          if isinstance(v, dict) and v.get('required', False)]
        
        if not required_params:
            return None
        
        missing_param = required_params[0]
        test_params = copy.deepcopy(params)
        test_params.pop(missing_param, None)
        
        case = {
            "name": f"{api_info.get('name', 'API')}_缺少必填参数_{missing_param}",
            "description": f"缺少必填参数 {missing_param}，预期返回400错误",
            "method": api_info.get('method', 'GET'),
            "url": api_info.get('url', ''),
            "headers": api_info.get('headers', {}),
            "params": self._extract_param_values(test_params),
            "body": api_info.get('body', {}),
            "assertions": self._build_negative_assertions(template, 400),
            "rule_template_id": template.id,
            "case_type": "negative_missing_param"
        }
        return case
    
    def _generate_wrong_type_case(
        self, 
        api_info: Dict[str, Any], 
        template: RuleTemplate
    ) -> Optional[Dict[str, Any]]:
        params = api_info.get('params', {})
        
        for param_name, param_info in params.items():
            if isinstance(param_info, dict) and param_info.get('type') == 'integer':
                test_params = copy.deepcopy(params)
                test_params[param_name] = "invalid_string"
                
                case = {
                    "name": f"{api_info.get('name', 'API')}_参数类型错误_{param_name}",
                    "description": f"参数 {param_name} 类型错误，预期返回400错误",
                    "method": api_info.get('method', 'GET'),
                    "url": api_info.get('url', ''),
                    "headers": api_info.get('headers', {}),
                    "params": self._extract_param_values(test_params),
                    "body": api_info.get('body', {}),
                    "assertions": self._build_negative_assertions(template, 400),
                    "rule_template_id": template.id,
                    "case_type": "negative_wrong_type"
                }
                return case
        
        return None
    
    def _generate_boundary_value_case(
        self,
        api_info: Dict[str, Any],
        template: RuleTemplate,
        param_name: str,
        param_info: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        min_value = param_info.get('min', 0)
        max_value = param_info.get('max', 100)
        
        test_params = copy.deepcopy(api_info.get('params', {}))
        test_params[param_name] = max_value + 1
        
        case = {
            "name": f"{api_info.get('name', 'API')}_边界值测试_{param_name}",
            "description": f"参数 {param_name} 超出最大值，预期返回400错误",
            "method": api_info.get('method', 'GET'),
            "url": api_info.get('url', ''),
            "headers": api_info.get('headers', {}),
            "params": self._extract_param_values(test_params),
            "body": api_info.get('body', {}),
            "assertions": self._build_negative_assertions(template, 400),
            "rule_template_id": template.id,
            "case_type": "boundary_value"
        }
        return case
    
    def _generate_valid_params(self, api_info: Dict[str, Any]) -> Dict[str, Any]:
        params = api_info.get('params', {})
        valid_params = {}
        
        for param_name, param_info in params.items():
            if isinstance(param_info, dict):
                param_type = param_info.get('type', 'string')
                if param_type == 'integer':
                    valid_params[param_name] = param_info.get('default', 1)
                elif param_type == 'string':
                    valid_params[param_name] = param_info.get('default', 'test')
                elif param_type == 'boolean':
                    valid_params[param_name] = param_info.get('default', True)
                else:
                    valid_params[param_name] = param_info.get('default', '')
            else:
                valid_params[param_name] = param_info
        
        return valid_params
    
    def _extract_param_values(self, params: Dict[str, Any]) -> Dict[str, Any]:
        result = {}
        for key, value in params.items():
            if isinstance(value, dict) and 'default' in value:
                result[key] = value['default']
            else:
                result[key] = value
        return result
    
    def _build_assertions(
        self, 
        template: RuleTemplate, 
        case_type: str
    ) -> List[Dict[str, Any]]:
        assertions = []
        
        for rule_def in template.rule_definitions:
            for assertion_rule in rule_def.assertion_rules:
                assertion = {
                    "type": assertion_rule.assertion_type,
                    "field": assertion_rule.field_path,
                    "operator": assertion_rule.operator,
                    "expected": assertion_rule.expected_value,
                    "message": assertion_rule.error_message
                }
                assertions.append(assertion)
        
        return assertions
    
    def _build_negative_assertions(
        self, 
        template: RuleTemplate, 
        expected_status: int
    ) -> List[Dict[str, Any]]:
        assertions = [
            {
                "type": "equals",
                "field": "status_code",
                "operator": "==",
                "expected": str(expected_status),
                "message": f"状态码应为 {expected_status}"
            }
        ]
        return assertions
    
    def validate_testcase_result(
        self, 
        result: Dict[str, Any], 
        assertions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        validation_result = {
            "success": True,
            "passed_assertions": 0,
            "failed_assertions": 0,
            "errors": []
        }
        
        for assertion in assertions:
            try:
                is_valid = self._validate_single_assertion(result, assertion)
                if is_valid:
                    validation_result["passed_assertions"] += 1
                else:
                    validation_result["failed_assertions"] += 1
                    validation_result["success"] = False
                    validation_result["errors"].append({
                        "assertion": assertion,
                        "message": assertion.get("message", "断言失败")
                    })
            except Exception as e:
                validation_result["failed_assertions"] += 1
                validation_result["success"] = False
                validation_result["errors"].append({
                    "assertion": assertion,
                    "message": f"断言执行错误: {str(e)}"
                })
        
        return validation_result
    
    def _validate_single_assertion(
        self, 
        result: Dict[str, Any], 
        assertion: Dict[str, Any]
    ) -> bool:
        field_path = assertion.get("field", "")
        expected = assertion.get("expected")
        operator = assertion.get("operator", "==")
        
        actual_value = self._get_nested_value(result, field_path)
        
        if operator == "==":
            return str(actual_value) == str(expected)
        elif operator == "!=":
            return str(actual_value) != str(expected)
        elif operator == ">":
            return float(actual_value) > float(expected)
        elif operator == "<":
            return float(actual_value) < float(expected)
        elif operator == ">=":
            return float(actual_value) >= float(expected)
        elif operator == "<=":
            return float(actual_value) <= float(expected)
        elif operator == "contains":
            return str(expected) in str(actual_value)
        elif operator == "in_range":
            range_values = json.loads(expected) if isinstance(expected, str) else expected
            return range_values[0] <= actual_value <= range_values[1]
        
        return False
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        keys = path.split('.')
        value = data
        
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
        
        return value
