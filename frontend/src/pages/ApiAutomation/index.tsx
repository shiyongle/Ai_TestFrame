import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  TimePicker,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  BranchesOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleFilled,
  PlusOutlined,
  RocketOutlined,
  SearchOutlined,
  SettingOutlined,
  SwapOutlined,
  UpOutlined,
  DownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { interfaceTestcaseApi, projectApi, testApi } from '../../services/api';
import { HttpTestResponse } from '../../types';
import ApiAdvancedTesting from '../ApiAdvancedTesting';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

type StepMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

type ScenarioStatus = 'active' | 'inactive';

type AssertionOperator = 'equals' | 'contains' | 'regex' | 'gt' | 'gte' | 'lt' | 'lte';
type ScheduleType = 'daily' | 'weekly' | 'monthly';

interface StepAssertionRule {
  id: string;
  path: string;
  operator: AssertionOperator;
  expected: string;
  enabled: boolean;
}

interface StepExtractRule {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
}

interface ScheduleRule {
  type: ScheduleType;
  time: string;
  weekday?: number;
  dayOfMonth?: number;
}

interface ApiStep {
  id: string;
  name: string;
  method: StepMethod;
  url: string;
  delay: number;
  assertions: string;
  enabled: boolean;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  body?: string;
  extractRules?: StepExtractRule[];
  assertionRules?: StepAssertionRule[];
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  status: ScenarioStatus;
  tags: string[];
  owner: string;
  projectId: number;
  updatedAt: string;
  steps: ApiStep[];
  schedule?: string;
  lastExecution?: {
    status: 'success' | 'failed';
    passRate: number;
    durationMs: number;
    executedAt: string;
    summary?: string;
    contextSnapshot?: Record<string, any>;
    stepResults?: Array<{
      stepId: string;
      stepName: string;
      success: boolean;
      statusCode: number;
      durationMs: number;
      message: string;
    }>;
  };
}

interface CaseLibraryItem {
  id: string;
  name: string;
  method: StepMethod;
  url: string;
  module: string;
}

interface ProjectOption {
  id: number;
  name: string;
}

const methodColorMap: Record<StepMethod, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'gold',
  DELETE: 'red',
  PATCH: 'purple',
};


const SCHEDULE_MARK = 'AUTO_SCHEDULE::';

const weekdayOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
];

const dayOfMonthOptions = Array.from({ length: 31 }).map((_, i) => ({
  label: `${i + 1} 日`,
  value: i + 1,
}));

const parseScheduleRule = (schedule?: string): ScheduleRule | null => {
  const raw = String(schedule || '').trim();
  if (!raw.startsWith(SCHEDULE_MARK)) return null;
  try {
    const obj = JSON.parse(raw.slice(SCHEDULE_MARK.length));
    if (!obj?.type || !obj?.time) return null;
    return {
      type: obj.type,
      time: obj.time,
      weekday: obj.weekday,
      dayOfMonth: obj.dayOfMonth,
    } as ScheduleRule;
  } catch {
    return null;
  }
};

const stringifyScheduleRule = (rule: ScheduleRule) => `${SCHEDULE_MARK}${JSON.stringify(rule)}`;

const formatScheduleText = (schedule?: string) => {
  const parsed = parseScheduleRule(schedule);
  if (!parsed) return schedule || '未设置';
  if (parsed.type === 'daily') return `每日 ${parsed.time}`;
  if (parsed.type === 'weekly') {
    const weekLabel = weekdayOptions.find((x) => x.value === parsed.weekday)?.label || `周${parsed.weekday}`;
    return `每周 ${weekLabel} ${parsed.time}`;
  }
  return `每月 ${parsed.dayOfMonth || 1} 日 ${parsed.time}`;
};

const buildScenarioStorageKey = (projectId: number) => `api-automation-scenarios:${projectId}`;

const loadScenariosFromStorage = (projectId: number): TestScenario[] => {
  try {
    const raw = window.localStorage.getItem(buildScenarioStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveScenariosToStorage = (projectId: number, list: TestScenario[]) => {
  try {
    window.localStorage.setItem(buildScenarioStorageKey(projectId), JSON.stringify(list));
  } catch {
    // 忽略本地存储异常（例如容量不足或隐私模式）
  }
};

const normalizeMethod = (value: any): StepMethod => {
  const m = String(value || 'GET').toUpperCase();
  if (m === 'POST') return 'POST';
  if (m === 'PUT') return 'PUT';
  if (m === 'DELETE') return 'DELETE';
  if (m === 'PATCH') return 'PATCH';
  return 'GET';
};

const mapRawToLibraryItem = (raw: any): CaseLibraryItem => {
  const cfg = raw?.config || {};
  return {
    id: String(raw?.id ?? `tc-${Date.now()}`),
    name: String(raw?.name || cfg?.title || '未命名接口用例'),
    method: normalizeMethod(raw?.method || cfg?.method),
    url: String(raw?.url || cfg?.url || ''),
    module: String(raw?.module || cfg?.module || '通用模块'),
  };
};

const assertionOperatorOptions: Array<{ label: string; value: AssertionOperator }> = [
  { label: 'equals(=)', value: 'equals' },
  { label: 'contains(包含)', value: 'contains' },
  { label: 'regex(正则)', value: 'regex' },
  { label: 'gt(>)', value: 'gt' },
  { label: 'gte(>=)', value: 'gte' },
  { label: 'lt(<)', value: 'lt' },
  { label: 'lte(<=)', value: 'lte' },
];

const renderTemplateString = (input: string, context: Record<string, any>) =>
  String(input || '')
    .replace(/\$\{\s*([\w.]+)\s*\}/g, (_m, key) => {
      const val = key.split('.').reduce((acc: any, k: string) => (acc == null ? undefined : acc[k]), context);
      return val == null ? '' : String(val);
    })
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
      const val = key.split('.').reduce((acc: any, k: string) => (acc == null ? undefined : acc[k]), context);
      return val == null ? '' : String(val);
    });

const renderTemplateValue = (value: any, context: Record<string, any>): any => {
  if (typeof value === 'string') return renderTemplateString(value, context);
  if (Array.isArray(value)) return value.map((item) => renderTemplateValue(item, context));
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc: Record<string, any>, [k, v]) => {
      acc[k] = renderTemplateValue(v, context);
      return acc;
    }, {});
  }
  return value;
};

const parseKVText = (input: string): Record<string, any> => {
  const out: Record<string, any> = {};
  (input || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf(':');
      if (idx <= 0) return;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      out[k] = v;
    });
  return out;
};

const toKVText = (obj?: Record<string, any>) =>
  Object.entries(obj || {})
    .map(([k, v]) => `${k}: ${String(v ?? '')}`)
    .join('\n');

const parseAssertionRulesText = (input: string): StepAssertionRule[] =>
  (input || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const [path = '', operator = 'equals', expected = ''] = line.split('|').map((s) => s.trim());
      const op = assertionOperatorOptions.some((x) => x.value === (operator as AssertionOperator))
        ? (operator as AssertionOperator)
        : 'equals';
      return {
        id: `ar-${Date.now()}-${idx}`,
        path,
        operator: op,
        expected,
        enabled: true,
      };
    })
    .filter((x) => x.path);

const toAssertionRulesText = (rules?: StepAssertionRule[]) =>
  (rules || []).map((r) => `${r.path}|${r.operator}|${r.expected}`).join('\n');

const parseExtractRulesText = (input: string): StepExtractRule[] =>
  (input || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const [name = '', path = ''] = line.split('|').map((s) => s.trim());
      return {
        id: `er-${Date.now()}-${idx}`,
        name,
        path,
        enabled: true,
      };
    })
    .filter((x) => x.name && x.path);

const toExtractRulesText = (rules?: StepExtractRule[]) =>
  (rules || []).map((r) => `${r.name}|${r.path}`).join('\n');

const resolvePathValue = (source: any, path: string): any => {
  const p = (path || '').trim();
  if (!p) return source;
  return p.split('.').reduce((acc: any, key: string) => {
    if (acc == null) return undefined;
    return acc[key];
  }, source);
};

const applyOperator = (actual: any, expectedRaw: string, operator: AssertionOperator): boolean => {
  const expected = expectedRaw ?? '';
  if (operator === 'equals') return String(actual ?? '') === String(expected);
  if (operator === 'contains') return String(actual ?? '').includes(String(expected));
  if (operator === 'regex') {
    try {
      return new RegExp(expected).test(String(actual ?? ''));
    } catch {
      return false;
    }
  }
  const a = Number(actual);
  const b = Number(expected);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (operator === 'gt') return a > b;
  if (operator === 'gte') return a >= b;
  if (operator === 'lt') return a < b;
  if (operator === 'lte') return a <= b;
  return false;
};

const setPathValue = (target: Record<string, any>, path: string, value: any) => {
  const keys = String(path || '')
    .split('.')
    .map((x) => x.trim())
    .filter(Boolean);
  if (!keys.length) return;
  let cursor: Record<string, any> = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    if (!cursor[key] || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  });
};

const parseBodyValue = (bodyText: string | undefined, context: Record<string, any>) => {
  const rendered = renderTemplateString(String(bodyText || ''), context).trim();
  if (!rendered) return undefined;
  try {
    return JSON.parse(rendered);
  } catch {
    return rendered;
  }
};

const ApiAutomation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'orchestration' | 'governance'>('overview');
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [library, setLibrary] = useState<CaseLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ScenarioStatus>('all');

  const [scenarioModalVisible, setScenarioModalVisible] = useState(false);
  const [editingScenarioId, setEditingScenarioId] = useState<string>('');
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduleEditingScenario, setScheduleEditingScenario] = useState<TestScenario | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [stepDrawerVisible, setStepDrawerVisible] = useState(false);
  const [editingStep, setEditingStep] = useState<ApiStep | null>(null);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [selectedLibraryKeys, setSelectedLibraryKeys] = useState<string[]>([]);

  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);

  const [scenarioStorageReady, setScenarioStorageReady] = useState(false);

  const [scenarioForm] = Form.useForm();
  const [scheduleForm] = Form.useForm();
  const [stepForm] = Form.useForm();

  const loadProjects = useCallback(async () => {
    try {
      const data = await projectApi.getProjects();
      const list = (data || []) as ProjectOption[];
      setProjects(list);
      if (list.length) {
        setSelectedProjectId((prev) => prev ?? list[0].id);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '加载项目失败');
    }
  }, []);

  const loadLibraryCases = useCallback(async (projectId?: number) => {
    setLibraryLoading(true);
    try {
      const rawList = await interfaceTestcaseApi.getAll(projectId);
      const mapped = (rawList || []).map(mapRawToLibraryItem);
      setLibrary(mapped);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '加载接口测试用例失败');
      setLibrary([]);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadLibraryCases(selectedProjectId);
  }, [loadLibraryCases, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setScenarios([]);
      setSelectedScenarioId('');
      setScenarioStorageReady(false);
      return;
    }

    const stored = loadScenariosFromStorage(selectedProjectId);
    setScenarios(stored);
    setSelectedScenarioId(stored[0]?.id || '');
    setScenarioStorageReady(true);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !scenarioStorageReady) return;
    saveScenariosToStorage(selectedProjectId, scenarios);
  }, [selectedProjectId, scenarios, scenarioStorageReady]);

  useEffect(() => {
    if (!scenarios.length) {
      setSelectedScenarioId('');
      return;
    }
    setSelectedScenarioId((prev) => (scenarios.some((s) => s.id === prev) ? prev : scenarios[0].id));
  }, [scenarios]);

  const filteredScenarios = useMemo(
    () =>
      scenarios.filter((s) => {
        const hitSearch =
          !searchText ||
          s.name.toLowerCase().includes(searchText.toLowerCase()) ||
          s.description.toLowerCase().includes(searchText.toLowerCase());
        const hitStatus = statusFilter === 'all' || s.status === statusFilter;
        return hitSearch && hitStatus;
      }),
    [scenarios, searchText, statusFilter]
  );

  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId) || null,
    [scenarios, selectedScenarioId]
  );

  const totalSteps = useMemo(
    () => scenarios.reduce((sum, s) => sum + s.steps.length, 0),
    [scenarios]
  );

  const avgPassRate = useMemo(() => {
    const items = scenarios.filter((s) => s.lastExecution);
    if (!items.length) return 0;
    return Math.round(items.reduce((sum, s) => sum + (s.lastExecution?.passRate || 0), 0) / items.length);
  }, [scenarios]);

  const openCreateScenario = () => {
    setEditingScenarioId('');
    scenarioForm.resetFields();
    scenarioForm.setFieldsValue({ status: 'active', tags: [] });
    setScenarioModalVisible(true);
  };

  const openEditScenario = (scenario: TestScenario) => {
    setEditingScenarioId(scenario.id);
    scenarioForm.setFieldsValue({
      name: scenario.name,
      description: scenario.description,
      status: scenario.status,
      tags: scenario.tags,
      owner: scenario.owner,
    });
    setScenarioModalVisible(true);
  };

  const saveScenario = async () => {
    try {
      const values = await scenarioForm.validateFields();
      if (editingScenarioId) {
        setScenarios((prev) =>
          prev.map((item) =>
            item.id === editingScenarioId
              ? {
                  ...item,
                  ...values,
                  tags: Array.isArray(values.tags) ? values.tags : [],
                  updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
                }
              : item
          )
        );
        message.success('场景已更新');
      } else {
        if (!selectedProjectId) {
          message.warning('请先选择项目后再创建场景');
          return;
        }
        const newScenario: TestScenario = {
          id: `s-${Date.now()}`,
          name: values.name,
          description: values.description || '',
          status: values.status || 'active',
          tags: Array.isArray(values.tags) ? values.tags : [],
          owner: values.owner || '管理员',
          projectId: selectedProjectId,
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
          steps: [],
        };
        setScenarios((prev) => [newScenario, ...prev]);
        setSelectedScenarioId(newScenario.id);
        setActiveTab('orchestration');
        message.success('场景已创建，请在编排页配置步骤');
      }
      setScenarioModalVisible(false);
    } catch {
      // antd 表单校验
    }
  };

  const deleteScenario = (scenario: TestScenario) => {
    Modal.confirm({
      title: '确认删除场景',
      content: `删除后不可恢复：${scenario.name}`,
      okButtonProps: { danger: true },
      onOk: () => {
        setScenarios((prev) => {
          const remain = prev.filter((item) => item.id !== scenario.id);
          if (selectedScenarioId === scenario.id) {
            setSelectedScenarioId(remain[0]?.id || '');
          }
          return remain;
        });
        message.success('场景已删除');
      },
    });
  };

  const executeScenario = async () => {
    if (!selectedScenario) return;
    if (!selectedScenario.steps.length) {
      message.warning('当前场景没有可执行步骤，请先编排');
      return;
    }

    const scenario = selectedScenario;
    const enabledSteps = scenario.steps.filter((s) => s.enabled !== false);
    if (!enabledSteps.length) {
      message.warning('当前场景步骤全部被禁用，请先启用后再执行');
      return;
    }

    setExecuting(true);
    setProgress(0);
    const startedAt = Date.now();
    const context: Record<string, any> = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      projectId: scenario.projectId,
      now: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    };
    const stepResults: NonNullable<TestScenario['lastExecution']>['stepResults'] = [];
    let failed = false;

    try {
      for (let i = 0; i < scenario.steps.length; i += 1) {
        const step = scenario.steps[i];
        const progressBase = Math.round((i / scenario.steps.length) * 100);
        setProgress(progressBase);

        if (step.enabled === false) {
          stepResults.push({
            stepId: step.id,
            stepName: step.name,
            success: true,
            statusCode: 0,
            durationMs: 0,
            message: '步骤已禁用，跳过执行',
          });
          continue;
        }

        if (step.delay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, step.delay));
        }

        const reqUrl = renderTemplateString(step.url, context);
        const reqHeaders = renderTemplateValue(step.headers || {}, context) as Record<string, string>;
        const reqParams = renderTemplateValue(step.params || {}, context) as Record<string, any>;
        const reqBody = parseBodyValue(step.body, context);

        try {
          const response: HttpTestResponse = await testApi.testHttp({
            url: reqUrl,
            method: step.method as any,
            headers: reqHeaders,
            params: reqParams,
            body: reqBody,
            timeout: 30000,
          });

          const responseScope = {
            status: response.status_code,
            status_code: response.status_code,
            headers: response.headers,
            body: response.body,
            execution_time: response.execution_time,
            success: response.success,
            error_message: response.error_message,
            context,
          };

          let assertionPassed = true;
          const assertionMessages: string[] = [];
          const assertionRules = (step.assertionRules || []).filter((x) => x.enabled !== false);

          if (assertionRules.length) {
            assertionRules.forEach((rule) => {
              const expected = renderTemplateString(rule.expected || '', context);
              const actual = resolvePathValue(responseScope, rule.path);
              const pass = applyOperator(actual, expected, rule.operator);
              if (!pass) {
                assertionPassed = false;
                assertionMessages.push(
                  `断言失败：${rule.path} ${rule.operator} ${expected}，实际=${String(actual ?? 'undefined')}`
                );
              }
            });
          }

          if (step.assertions && step.assertions.trim()) {
            const legacyRules = step.assertions
              .split('&&')
              .map((x) => x.trim())
              .filter(Boolean);
            legacyRules.forEach((rule) => {
              const [left = '', right = ''] = rule.split('=').map((x) => x.trim());
              if (!left) return;
              const expected = renderTemplateString(right, context);
              const path = left === 'status' ? 'status_code' : left;
              const actual = resolvePathValue(responseScope, path);
              if (String(actual ?? '') !== String(expected)) {
                assertionPassed = false;
                assertionMessages.push(`断言失败：${left}=${expected}，实际=${String(actual ?? 'undefined')}`);
              }
            });
          }

          const extractRules = (step.extractRules || []).filter((x) => x.enabled !== false);
          extractRules.forEach((rule) => {
            const val = resolvePathValue(responseScope, rule.path);
            setPathValue(context, rule.name, val);
          });

          const stepSuccess = Boolean(response.success) && assertionPassed;
          if (!stepSuccess) {
            failed = true;
          }

          stepResults.push({
            stepId: step.id,
            stepName: step.name,
            success: stepSuccess,
            statusCode: response.status_code,
            durationMs: response.execution_time,
            message: stepSuccess ? '执行成功' : assertionMessages.join('；') || response.error_message || '步骤执行失败',
          });

          if (!stepSuccess) {
            break;
          }
        } catch (error: any) {
          failed = true;
          stepResults.push({
            stepId: step.id,
            stepName: step.name,
            success: false,
            statusCode: 0,
            durationMs: 0,
            message: error?.response?.data?.detail || error?.message || '请求执行失败',
          });
          break;
        } finally {
          const nextProgress = Math.round(((i + 1) / scenario.steps.length) * 100);
          setProgress(nextProgress);
        }
      }

      const passedCount = stepResults.filter((x) => x.success).length;
      const passRate = stepResults.length ? Math.round((passedCount / stepResults.length) * 100) : 0;
      const durationMs = Date.now() - startedAt;
      const summary = `通过 ${passedCount}/${stepResults.length} 步${failed ? '，执行中断' : ''}`;

      setScenarios((prev) =>
        prev.map((item) =>
          item.id === scenario.id
            ? {
                ...item,
                lastExecution: {
                  status: failed ? 'failed' : 'success',
                  passRate,
                  durationMs,
                  executedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                  summary,
                  contextSnapshot: context,
                  stepResults,
                },
              }
            : item
        )
      );

      if (failed) {
        message.error('场景执行失败，已在失败步骤处中断');
      } else {
        message.success('场景执行完成');
      }
    } finally {
      setExecuting(false);
      setProgress(100);
    }
  };

  const moveStep = (index: number, dir: 'up' | 'down') => {
    if (!selectedScenario) return;
    const steps = [...selectedScenario.steps];
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    setScenarios((prev) => prev.map((s) => (s.id === selectedScenario.id ? { ...s, steps, updatedAt: dayjs().format('YYYY-MM-DD HH:mm') } : s)));
  };

  const removeStep = (stepId: string) => {
    if (!selectedScenario) return;
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === selectedScenario.id
          ? { ...s, steps: s.steps.filter((step) => step.id !== stepId), updatedAt: dayjs().format('YYYY-MM-DD HH:mm') }
          : s
      )
    );
  };

  const openScheduleModal = (scenario: TestScenario) => {
    setScheduleEditingScenario(scenario);
    const parsed = parseScheduleRule(scenario.schedule);
    scheduleForm.setFieldsValue({
      type: parsed?.type || 'daily',
      weekday: parsed?.weekday || 1,
      dayOfMonth: parsed?.dayOfMonth || 1,
      time: dayjs(`2000-01-01 ${parsed?.time || '09:00:00'}`),
    });
    setScheduleModalVisible(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleEditingScenario) return;
    try {
      const values = await scheduleForm.validateFields();
      const rule: ScheduleRule = {
        type: values.type,
        time: values.time.format('HH:mm:ss'),
        weekday: values.type === 'weekly' ? values.weekday : undefined,
        dayOfMonth: values.type === 'monthly' ? values.dayOfMonth : undefined,
      };
      setScheduleSaving(true);
      setScenarios((prev) =>
        prev.map((item) =>
          item.id === scheduleEditingScenario.id
            ? {
                ...item,
                schedule: stringifyScheduleRule(rule),
                updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
              }
            : item
        )
      );
      setScheduleModalVisible(false);
      message.success('定时执行已保存');
    } catch {
      // antd 表单校验
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleClearSchedule = async () => {
    if (!scheduleEditingScenario) return;
    setScheduleSaving(true);
    setScenarios((prev) =>
      prev.map((item) =>
        item.id === scheduleEditingScenario.id
          ? {
              ...item,
              schedule: undefined,
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
            }
          : item
      )
    );
    setScheduleSaving(false);
    setScheduleModalVisible(false);
    message.success('已清除定时执行');
  };

  const openStepEditor = (step: ApiStep) => {
    setEditingStep(step);
    stepForm.setFieldsValue({
      ...step,
      headersText: toKVText(step.headers),
      paramsText: toKVText(step.params),
      bodyText: step.body || '',
      assertionRulesText: toAssertionRulesText(step.assertionRules),
      extractRulesText: toExtractRulesText(step.extractRules),
    });
    setStepDrawerVisible(true);
  };

  const saveStep = async () => {
    if (!selectedScenario || !editingStep) return;
    try {
      const values = await stepForm.validateFields();
      const headers = parseKVText(values.headersText || '');
      const params = parseKVText(values.paramsText || '');
      const assertionRules = parseAssertionRulesText(values.assertionRulesText || '');
      const extractRules = parseExtractRulesText(values.extractRulesText || '');
      const bodyText = String(values.bodyText || '').trim();

      setScenarios((prev) =>
        prev.map((s) =>
          s.id === selectedScenario.id
            ? {
                ...s,
                steps: s.steps.map((step) =>
                  step.id === editingStep.id
                    ? {
                        ...step,
                        name: values.name,
                        method: values.method,
                        url: values.url,
                        assertions: values.assertions || '',
                        delay: Number(values.delay) || 0,
                        enabled: values.enabled !== false,
                        headers: Object.keys(headers).length ? headers : undefined,
                        params: Object.keys(params).length ? params : undefined,
                        body: bodyText || undefined,
                        assertionRules: assertionRules.length ? assertionRules : undefined,
                        extractRules: extractRules.length ? extractRules : undefined,
                      }
                    : step
                ),
                updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
              }
            : s
        )
      );
      setStepDrawerVisible(false);
      message.success('步骤已更新');
    } catch {
      // 表单校验
    }
  };

  const addStepsFromLibrary = () => {
    if (!selectedScenario) return;
    if (!library.length) {
      message.warning('当前项目暂无可用接口测试用例');
      return;
    }
    const selected = library.filter((item) => selectedLibraryKeys.includes(item.id));
    if (!selected.length) {
      message.warning('请先选择要加入的用例');
      return;
    }
    const newSteps: ApiStep[] = selected.map((item) => ({
      id: `st-${Date.now()}-${item.id}`,
      name: item.name,
      method: item.method,
      url: item.url,
      delay: 0,
      assertions: 'status=200',
      enabled: true,
      headers: {},
      params: {},
      body: '',
      assertionRules: [],
      extractRules: [],
    }));

    setScenarios((prev) =>
      prev.map((s) =>
        s.id === selectedScenario.id
          ? { ...s, steps: [...s.steps, ...newSteps], updatedAt: dayjs().format('YYYY-MM-DD HH:mm') }
          : s
      )
    );
    setLibraryVisible(false);
    setSelectedLibraryKeys([]);
    message.success(`已添加 ${newSteps.length} 个步骤`);
  };

  return (
    <div className="app-content fade-in" style={{ padding: 24, maxWidth: 1700, margin: '0 auto' }}>
      <div className="page-toolbar" style={{ marginBottom: 18 }}>
        <div className="page-title">
          <Title level={2} style={{ margin: 0 }}>接口自动化</Title>
          <span className="page-subtitle">从场景管理到步骤编排，一页完成创建、编排、执行与回看</span>
        </div>
        <Space wrap>
          <Select
            style={{ width: 240 }}
            placeholder="选择项目（加载接口用例）"
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            options={projects.map((item) => ({ label: item.name, value: item.id }))}
          />
          <Button icon={<PlusOutlined />} onClick={openCreateScenario} disabled={!selectedProjectId}>新建场景</Button>
          <Button type="primary" icon={<PlayCircleFilled />} onClick={executeScenario} disabled={!selectedScenario || executing}>
            执行当前场景
          </Button>
        </Space>
      </div>

      {executing && (
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 16, borderRadius: 10 }}
          message={`正在执行：${selectedScenario?.name || '-'}`}
          description={<Progress percent={progress} status="active" />}
        />
      )}

      <Segmented
        style={{ marginBottom: 16 }}
        value={activeTab}
        onChange={(v) => setActiveTab(v as 'overview' | 'orchestration' | 'governance')}
        options={[
          { label: '主页面总览', value: 'overview', icon: <ApiOutlined /> },
          { label: '场景编排', value: 'orchestration', icon: <BranchesOutlined /> },
          { label: '接口资产增强', value: 'governance', icon: <SettingOutlined /> },
        ]}
      />

      {activeTab === 'overview' && (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={8}>
              <Card bordered={false} className="glass-panel">
                <Statistic title="自动化场景" value={filteredScenarios.length} prefix={<ApiOutlined />} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card bordered={false} className="glass-panel">
                <Statistic title="总步骤数" value={totalSteps} prefix={<BranchesOutlined />} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card bordered={false} className="glass-panel">
                <Statistic title="平均通过率" value={avgPassRate} suffix="%" prefix={<CheckCircleOutlined />} />
              </Card>
            </Col>
          </Row>

          <Card bordered={false} className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <Space>
                <Input
                  allowClear
                  style={{ width: 260 }}
                  prefix={<SearchOutlined />}
                  placeholder="搜索场景名称/描述"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: 140 }}
                  options={[
                    { label: '全部状态', value: 'all' },
                    { label: '启用', value: 'active' },
                    { label: '停用', value: 'inactive' },
                  ]}
                />
              </Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateScenario} disabled={!selectedProjectId}>新建场景</Button>
            </div>

            <List
              dataSource={filteredScenarios}
              locale={{ emptyText: <Empty description="暂无场景" /> }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Tooltip title="进入编排" key="orchestrate">
                      <Button
                        type="text"
                        icon={<SwapOutlined />}
                        onClick={() => {
                          setSelectedScenarioId(item.id);
                          setActiveTab('orchestration');
                        }}
                      />
                    </Tooltip>,
                    <Tooltip title="定时执行" key="schedule">
                      <Button type="text" icon={<CalendarOutlined />} onClick={() => openScheduleModal(item)} />
                    </Tooltip>,
                    <Tooltip title="编辑场景" key="edit">
                      <Button type="text" icon={<EditOutlined />} onClick={() => openEditScenario(item)} />
                    </Tooltip>,
                    <Tooltip title="删除场景" key="delete">
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => deleteScenario(item)} />
                    </Tooltip>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.name}</Text>
                        <Tag color={item.status === 'active' ? 'success' : 'default'}>{item.status === 'active' ? '启用' : '停用'}</Tag>
                        <Tag icon={<BranchesOutlined />}>{item.steps.length} 步</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={4}>
                        <Text type="secondary">{item.description || '暂无描述'}</Text>
                        <Space wrap>
                          {item.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                          <Tag icon={<ClockCircleOutlined />}>更新于 {item.updatedAt}</Tag>
                          {item.schedule ? <Tag icon={<CalendarOutlined />}>{formatScheduleText(item.schedule)}</Tag> : null}
                          {item.lastExecution ? (
                            <Tag color={item.lastExecution.status === 'success' ? 'success' : 'error'}>
                              最近执行 {item.lastExecution.passRate}% · {item.lastExecution.durationMs}ms
                            </Tag>
                          ) : null}
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </div>
      )}

      {activeTab === 'orchestration' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 360px', gap: 16 }}>
          <Card bordered={false} className="glass-panel" title="场景列表">
            <Space direction="vertical" style={{ width: '100%' }} size={10}>
              {filteredScenarios.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedScenarioId(item.id)}
                  style={{
                    border: item.id === selectedScenarioId ? '1px solid #1677ff' : '1px solid rgba(15,23,42,0.08)',
                    borderRadius: 10,
                    padding: 12,
                    cursor: 'pointer',
                    background: item.id === selectedScenarioId ? 'rgba(22,119,255,0.08)' : '#fff',
                  }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text strong>{item.name}</Text>
                    <Text type="secondary" ellipsis>{item.description || '暂无描述'}</Text>
                    <Space wrap>
                      <Badge status={item.status === 'active' ? 'success' : 'default'} text={item.status === 'active' ? '启用' : '停用'} />
                      <Tag>{item.steps.length} 步</Tag>
                      {item.schedule ? <Tag icon={<CalendarOutlined />}>{formatScheduleText(item.schedule)}</Tag> : null}
                      <Button
                        size="small"
                        type="text"
                        icon={<CalendarOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openScheduleModal(item);
                        }}
                      >
                        定时执行
                      </Button>
                    </Space>
                  </Space>
                </div>
              ))}
            </Space>
          </Card>

          <Card
            bordered={false}
            className="glass-panel"
            title={
              <Space>
                <BranchesOutlined />
                <span>步骤编排</span>
                <Tag color="blue">{selectedScenario?.name || '未选择场景'}</Tag>
              </Space>
            }
            extra={
              <Space>
                <Tag color="processing">用例库 {libraryLoading ? '加载中' : `${library.length} 条`}</Tag>
                <Button icon={<PlusOutlined />} onClick={() => setLibraryVisible(true)} disabled={!selectedScenario || libraryLoading}>从用例库添加</Button>
              </Space>
            }
          >
            {!selectedScenario ? (
              <Empty description="请选择左侧场景进行编排" />
            ) : !selectedScenario.steps.length ? (
              <Empty description="暂无步骤，点击“从用例库添加”开始编排" />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {selectedScenario.steps.map((step, index) => (
                  <Card key={step.id} size="small" style={{ borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <Space align="start">
                        <Badge count={index + 1} color="#1677ff" />
                        <div>
                          <Space>
                            <Tag color={methodColorMap[step.method]}>{step.method}</Tag>
                            <Text strong>{step.name}</Text>
                            {!step.enabled && <Tag>已禁用</Tag>}
                          </Space>
                          <div style={{ marginTop: 4 }}>
                            <Text code>{step.url}</Text>
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary">断言：{step.assertions || '无'}</Text>
                            <Divider type="vertical" />
                            <Text type="secondary">结构化断言：{(step.assertionRules || []).length} 条</Text>
                            <Divider type="vertical" />
                            <Text type="secondary">提取变量：{(step.extractRules || []).length} 条</Text>
                            <Divider type="vertical" />
                            <Text type="secondary">延迟：{step.delay} ms</Text>
                          </div>
                        </div>
                      </Space>
                      <Space>
                        <Tooltip title="上移"><Button icon={<UpOutlined />} onClick={() => moveStep(index, 'up')} disabled={index === 0} /></Tooltip>
                        <Tooltip title="下移"><Button icon={<DownOutlined />} onClick={() => moveStep(index, 'down')} disabled={index === selectedScenario.steps.length - 1} /></Tooltip>
                        <Tooltip title="编辑"><Button icon={<SettingOutlined />} onClick={() => openStepEditor(step)} /></Tooltip>
                        <Tooltip title="删除"><Button danger icon={<DeleteOutlined />} onClick={() => removeStep(step.id)} /></Tooltip>
                      </Space>
                    </div>
                  </Card>
                ))}
              </Space>
            )}
          </Card>

          <Card bordered={false} className="glass-panel" title="场景信息">
            {!selectedScenario ? (
              <Empty description="未选择场景" />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                <Title level={5} style={{ margin: 0 }}>{selectedScenario.name}</Title>
                <Paragraph type="secondary" style={{ marginBottom: 4 }}>{selectedScenario.description || '暂无描述'}</Paragraph>
                <Space wrap>
                  <Tag>负责人：{selectedScenario.owner}</Tag>
                  <Tag>更新时间：{selectedScenario.updatedAt}</Tag>
                  <Tag color={selectedScenario.status === 'active' ? 'success' : 'default'}>{selectedScenario.status === 'active' ? '启用' : '停用'}</Tag>
                  <Tag icon={<CalendarOutlined />}>排期：{formatScheduleText(selectedScenario.schedule)}</Tag>
                </Space>
                <Divider style={{ margin: '8px 0' }} />
                <Statistic title="步骤数" value={selectedScenario.steps.length} prefix={<BranchesOutlined />} />
                <Statistic
                  title="最近执行"
                  value={selectedScenario.lastExecution ? `${selectedScenario.lastExecution.passRate}%` : '未执行'}
                  suffix={selectedScenario.lastExecution ? '通过率' : ''}
                  prefix={<RocketOutlined />}
                />
                {selectedScenario.lastExecution ? (
                  <>
                    <Alert
                      type={selectedScenario.lastExecution.status === 'success' ? 'success' : 'error'}
                      showIcon
                      message={selectedScenario.lastExecution.status === 'success' ? '最近执行成功' : '最近执行失败'}
                      description={`${selectedScenario.lastExecution.executedAt} · ${selectedScenario.lastExecution.durationMs}ms · ${selectedScenario.lastExecution.summary || ''}`}
                    />
                    {(selectedScenario.lastExecution.stepResults || []).length ? (
                      <List
                        size="small"
                        bordered
                        dataSource={selectedScenario.lastExecution.stepResults || []}
                        renderItem={(item) => (
                          <List.Item>
                            <Space direction="vertical" size={0} style={{ width: '100%' }}>
                              <Space>
                                <Tag color={item.success ? 'success' : 'error'}>{item.success ? 'PASS' : 'FAIL'}</Tag>
                                <Text strong>{item.stepName}</Text>
                              </Space>
                              <Text type="secondary">HTTP {item.statusCode || '-'} · {item.durationMs}ms</Text>
                              <Text type={item.success ? 'secondary' : 'danger'}>{item.message}</Text>
                            </Space>
                          </List.Item>
                        )}
                      />
                    ) : null}
                    {selectedScenario.lastExecution.contextSnapshot ? (
                      <Form layout="vertical">
                        <Form.Item label="上下文快照（执行后）" style={{ marginBottom: 0 }}>
                          <TextArea
                            rows={6}
                            readOnly
                            value={JSON.stringify(selectedScenario.lastExecution.contextSnapshot, null, 2)}
                          />
                        </Form.Item>
                      </Form>
                    ) : null}
                  </>
                ) : null}
                <Space.Compact block>
                  <Button icon={<CalendarOutlined />} onClick={() => openScheduleModal(selectedScenario)}>
                    定时执行
                  </Button>
                  <Button type="primary" icon={<PlayCircleFilled />} onClick={executeScenario} disabled={executing || !selectedScenario.steps.length}>
                    执行该场景
                  </Button>
                </Space.Compact>
              </Space>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'governance' && (
        <ApiAdvancedTesting embedded defaultProjectId={selectedProjectId} />
      )}

      <Modal
        title={editingScenarioId ? '编辑场景' : '新建场景'}
        open={scenarioModalVisible}
        onCancel={() => setScenarioModalVisible(false)}
        onOk={saveScenario}
        okText="保存"
      >
        <Form form={scenarioForm} layout="vertical">
          <Form.Item label="场景名称" name="name" rules={[{ required: true, message: '请输入场景名称' }]}>
            <Input placeholder="例如：订单下单支付回归" />
          </Form.Item>
          <Form.Item label="场景描述" name="description">
            <TextArea rows={3} placeholder="简要描述该场景覆盖范围" />
          </Form.Item>
          <Form.Item label="负责人" name="owner">
            <Input placeholder="例如：测试A" />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select
              options={[
                { label: '启用', value: 'active' },
                { label: '停用', value: 'inactive' },
              ]}
            />
          </Form.Item>
          <Form.Item label="标签" name="tags">
            <Select mode="tags" placeholder="输入后回车" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="从接口用例库添加步骤"
        open={libraryVisible}
        onCancel={() => setLibraryVisible(false)}
        onOk={addStepsFromLibrary}
        okText="添加为步骤"
        width={760}
      >
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary">
            {selectedProjectId ? `当前项目 ID: ${selectedProjectId}` : '未选择项目'} · 数据来源：接口测试用例
          </Text>
          <Button size="small" onClick={() => loadLibraryCases(selectedProjectId)} loading={libraryLoading}>刷新</Button>
        </div>
        <Spin spinning={libraryLoading}>
          <List
            bordered
            dataSource={library}
            locale={{ emptyText: <Empty description="当前项目暂无接口测试用例" /> }}
            rowKey="id"
            renderItem={(item) => {
              const checked = selectedLibraryKeys.includes(item.id);
              return (
                <List.Item
                  onClick={() => {
                    setSelectedLibraryKeys((prev) =>
                      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                    );
                  }}
                  style={{ cursor: 'pointer', background: checked ? 'rgba(22,119,255,0.08)' : '#fff' }}
                >
                  <Space>
                    <Badge status={checked ? 'processing' : 'default'} />
                    <Tag color={methodColorMap[item.method]}>{item.method}</Tag>
                    <Text strong>{item.name}</Text>
                    <Text type="secondary">{item.url || '未配置URL'}</Text>
                    <Tag>{item.module}</Tag>
                  </Space>
                </List.Item>
              );
            }}
          />
        </Spin>
      </Modal>

      <Modal
        title={`定时执行配置${scheduleEditingScenario ? ` · ${scheduleEditingScenario.name}` : ''}`}
        open={scheduleModalVisible}
        onCancel={() => setScheduleModalVisible(false)}
        onOk={handleSaveSchedule}
        okText="保存"
        confirmLoading={scheduleSaving}
        destroyOnClose
        footer={(
          <Space>
            <Button onClick={() => setScheduleModalVisible(false)}>取消</Button>
            <Button danger onClick={handleClearSchedule} loading={scheduleSaving} disabled={!scheduleEditingScenario?.schedule}>清除</Button>
            <Button type="primary" onClick={handleSaveSchedule} loading={scheduleSaving}>保存</Button>
          </Space>
        )}
      >
        <Form form={scheduleForm} layout="vertical" initialValues={{ type: 'daily', weekday: 1, dayOfMonth: 1 }}>
          <Form.Item name="type" label="执行频率" rules={[{ required: true, message: '请选择执行频率' }]}>
            <Select
              options={[
                { label: '每日', value: 'daily' },
                { label: '每周', value: 'weekly' },
                { label: '每月', value: 'monthly' },
              ]}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const type = getFieldValue('type') as ScheduleType;
              if (type === 'weekly') {
                return (
                  <Form.Item name="weekday" label="每周执行日" rules={[{ required: true, message: '请选择每周执行日' }]}>
                    <Select options={weekdayOptions} />
                  </Form.Item>
                );
              }
              if (type === 'monthly') {
                return (
                  <Form.Item name="dayOfMonth" label="每月执行日" rules={[{ required: true, message: '请选择每月执行日' }]}>
                    <Select options={dayOfMonthOptions} />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="time" label="执行时间（时:分:秒）" rules={[{ required: true, message: '请选择执行时间' }]}>
            <TimePicker format="HH:mm:ss" style={{ width: '100%' }} />
          </Form.Item>

          <Text type="secondary">说明：当前仅提供定时规则配置入口，后续可由调度器读取该规则自动触发执行。</Text>
        </Form>
      </Modal>

      <Drawer
        title="编辑步骤"
        width={560}
        open={stepDrawerVisible}
        onClose={() => setStepDrawerVisible(false)}
        extra={<Button type="primary" onClick={saveStep}>保存</Button>}
      >
        <Form form={stepForm} layout="vertical">
          <Form.Item label="步骤名称" name="name" rules={[{ required: true, message: '请输入步骤名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="请求方法" name="method" rules={[{ required: true }]}>
            <Select
              options={['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => ({ label: m, value: m }))}
            />
          </Form.Item>
          <Form.Item label="请求 URL" name="url" rules={[{ required: true, message: '请输入 URL' }]}>
            <Input placeholder="/api/path" />
          </Form.Item>
          <Form.Item label="兼容断言（旧）" name="assertions">
            <TextArea rows={2} placeholder="例如：status=200 && body.code=0" />
          </Form.Item>
          <Form.Item label="请求头（每行 key: value）" name="headersText">
            <TextArea rows={4} placeholder={"Authorization: Bearer {{token}}\nX-Trace-Id: {{traceId}}"} />
          </Form.Item>
          <Form.Item label="Query 参数（每行 key: value）" name="paramsText">
            <TextArea rows={4} placeholder={"page: 1\nsize: 20\nuserId: {{user.id}}"} />
          </Form.Item>
          <Form.Item label="请求体 Body（支持 JSON + 模板变量）" name="bodyText">
            <TextArea rows={6} placeholder={'{"orderId": "{{order.id}}", "token": "{{auth.token}}"}'} />
          </Form.Item>
          <Form.Item label="结构化断言（每行 path|operator|expected）" name="assertionRulesText">
            <TextArea rows={6} placeholder={"status_code|equals|200\nbody.code|equals|0\nbody.message|contains|success"} />
          </Form.Item>
          <Form.Item label="结果提取（每行 name|path）" name="extractRulesText">
            <TextArea rows={4} placeholder={"auth.token|body.data.token\norder.id|body.data.id"} />
          </Form.Item>
          <Form.Item label="步骤延迟（ms）" name="delay">
            <Input type="number" min={0} />
          </Form.Item>
          <Form.Item label="启用步骤" name="enabled">
            <Select
              options={[
                { label: '启用', value: true },
                { label: '禁用', value: false },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default ApiAutomation;
