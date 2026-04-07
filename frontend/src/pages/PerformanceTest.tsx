import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tabs,
  Typography,
  message,
} from 'antd';
import {
  ClockCircleOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  ProfileOutlined,
  RocketOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { performanceApi, projectApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface ProjectOption {
  id: number;
  name: string;
}

interface PerformanceExtractor {
  name: string;
  source?: string;
  expression: string;
  default_value?: any;
  required?: boolean;
  transform?: string;
}

interface PerformanceAssertion {
  type?: string;
  operator?: string;
  expected?: any;
  target?: string;
  message?: string;
  enabled?: boolean;
}

interface PerformanceVariableDefinition {
  name: string;
  scope?: 'scenario' | 'vu';
  initial_value?: any;
  secret?: boolean;
  description?: string;
}

interface PerformanceScenarioStep {
  step_id: string;
  name: string;
  enabled?: boolean;
  step_type?: 'http' | 'rabbitmq';
  method?: string;
  url?: string;
  headers?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
  timeout_ms?: number;
  think_time_ms?: number;
  extractors?: PerformanceExtractor[];
  assertions?: PerformanceAssertion[];
  on_failure?: string;
  transaction_name?: string;
  weight?: number;
}

interface PerformanceScenario {
  id: number;
  name: string;
  description?: string;
  project_id?: number;
  protocol: 'http' | 'rabbitmq';
  status: string;
  tags: string[];
  step_count?: number;
  variable_count?: number;
  last_run_status?: string;
  last_run_at?: string;
  created_at: string;
  updated_at: string;
  target_config?: Record<string, any>;
  load_profile?: Record<string, any>;
  assertions?: PerformanceAssertion[];
  runtime_options?: Record<string, any>;
  steps?: PerformanceScenarioStep[];
  variables?: PerformanceVariableDefinition[];
  environment_config?: Record<string, any>;
}

interface RunMetricPoint {
  id: number;
  timestamp_offset: number;
  active_users: number;
  current_rps: number;
  avg_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  error_rate: number;
}

interface RunEventItem {
  id: number;
  stage: string;
  level: string;
  message: string;
  event_time: string;
  payload?: Record<string, any>;
}

interface RunStepResult {
  step_id: string;
  name: string;
  method?: string;
  url?: string;
  transaction_name?: string;
  request_count: number;
  failure_count: number;
  avg_response_time: number;
  p95_response_time: number;
  last_status_code?: number | null;
  last_error?: string | null;
  extractor_preview?: Record<string, any>;
}

interface PerformanceRun {
  id: number;
  run_no: string;
  scenario_id: number;
  scenario_name: string;
  protocol: string;
  status: string;
  stage: string;
  trigger_source: string;
  current_users: number;
  target_users: number;
  spawn_rate: number;
  duration_seconds: number;
  progress: number;
  current_rps: number;
  avg_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  error_rate: number;
  worker_count: number;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  metrics?: RunMetricPoint[];
  events?: RunEventItem[];
  summary?: Record<string, any>;
  target_config?: Record<string, any>;
  load_profile?: Record<string, any>;
  runtime_options?: Record<string, any>;
  assertions?: PerformanceAssertion[];
  error_message?: string;
  steps?: PerformanceScenarioStep[];
  variables?: PerformanceVariableDefinition[];
  environment_config?: Record<string, any>;
  scenario_snapshot?: Record<string, any>;
  step_summary?: RunStepResult[];
  engine_metadata?: Record<string, any>;
  scenario_description?: string;
}

interface OverviewStats {
  total_scenarios: number;
  active_scenarios: number;
  running_runs: number;
  completed_runs: number;
  latest_avg_response_time: number;
  latest_error_rate: number;
  protocol_distribution: Record<string, number>;
}

type ScenarioFormVariable = {
  name?: string;
  scope?: 'scenario' | 'vu';
  initial_value?: string;
  secret?: boolean;
  description?: string;
};

type ScenarioFormStep = {
  step_id?: string;
  name?: string;
  enabled?: boolean;
  method?: string;
  url?: string;
  headers?: string;
  query?: string;
  body?: string;
  timeout_ms?: number;
  think_time_ms?: number;
  extractors?: string;
  assertions?: string;
  on_failure?: string;
  transaction_name?: string;
  weight?: number;
};

interface ScenarioFormValues {
  name?: string;
  description?: string;
  protocol?: 'http' | 'rabbitmq';
  status?: string;
  tags?: string;
  users?: number;
  spawn_rate?: number;
  duration_seconds?: number;
  worker_count?: number;
  hatch_interval?: number;
  environment_config?: string;
  runtime_options_json?: string;
  scenario_assertions?: string;
  variables?: ScenarioFormVariable[];
  steps?: ScenarioFormStep[];
}

const protocolOptions = [
  { label: 'HTTP', value: 'http' },
  { label: 'RabbitMQ', value: 'rabbitmq' },
];

const httpMethodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((value) => ({ label: value, value }));
const variableScopeOptions = [
  { label: '场景级', value: 'scenario' },
  { label: 'VU 级', value: 'vu' },
];
const failureStrategyOptions = [
  { label: '停止用户', value: 'stop_user' },
  { label: '继续执行', value: 'continue' },
  { label: '停止场景', value: 'stop_scenario' },
];

const scenarioStatusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  active: { text: '启用', color: 'processing' },
  archived: { text: '归档', color: 'default' },
  pending: { text: '待执行', color: 'default' },
  running: { text: '执行中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  stopped: { text: '已停止', color: 'warning' },
  failed: { text: '失败', color: 'error' },
};

const stageColorMap: Record<string, string> = {
  created: 'default',
  initializing: 'cyan',
  ramping: 'processing',
  steady: 'success',
  stopping: 'warning',
  stopped: 'warning',
  completed: 'success',
  failed: 'error',
};

const createDefaultStep = (index = 1): ScenarioFormStep => ({
  step_id: `step_${index}`,
  name: index === 1 ? '鉴权获取 Token' : `业务步骤 ${index}`,
  enabled: true,
  method: index === 1 ? 'POST' : 'GET',
  url: index === 1 ? 'https://example.com/api/login' : 'https://example.com/api/order',
  headers: index === 1 ? '{\n  "Content-Type": "application/json"\n}' : '{\n  "Authorization": "Bearer {{access_token}}"\n}',
  query: '{}',
  body: index === 1 ? '{\n  "username": "perf_user",\n  "password": "{{password}}"\n}' : '{\n  "orderNo": "{{order_no}}"\n}',
  timeout_ms: 10000,
  think_time_ms: index === 1 ? 0 : 200,
  extractors:
    index === 1
      ? '[\n  {\n    "name": "access_token",\n    "source": "json_body",\n    "expression": "$.data.token",\n    "required": true\n  }\n]'
      : '[]',
  assertions:
    index === 1
      ? '[\n  {\n    "type": "status_code",\n    "operator": "eq",\n    "expected": 200\n  }\n]'
      : '[\n  {\n    "type": "status_code",\n    "operator": "eq",\n    "expected": 200\n  }\n]',
  on_failure: 'stop_user',
  transaction_name: index === 1 ? 'auth_login' : `business_step_${index}`,
  weight: 1,
});

const createDefaultVariable = (): ScenarioFormVariable => ({
  name: 'password',
  scope: 'vu',
  initial_value: 'perf_password',
  secret: true,
  description: '登录密码或动态令牌占位变量',
});

const getInitialFormValues = (): ScenarioFormValues => ({
  protocol: 'http',
  status: 'draft',
  users: 10,
  spawn_rate: 1,
  duration_seconds: 60,
  worker_count: 1,
  hatch_interval: 1,
  environment_config: '{\n  "base_url": "https://example.com"\n}',
  runtime_options_json: '{}',
  scenario_assertions: '[]',
  variables: [createDefaultVariable()],
  steps: [createDefaultStep(1), createDefaultStep(2)],
});

const PerformanceTest: React.FC = () => {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [overview, setOverview] = useState<OverviewStats>({
    total_scenarios: 0,
    active_scenarios: 0,
    running_runs: 0,
    completed_runs: 0,
    latest_avg_response_time: 0,
    latest_error_rate: 0,
    protocol_distribution: {},
  });
  const [scenarios, setScenarios] = useState<PerformanceScenario[]>([]);
  const [runs, setRuns] = useState<PerformanceRun[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState<PerformanceRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [form] = Form.useForm<ScenarioFormValues>();

  const selectedScenario = useMemo(
    () => scenarios.find((item) => item.id === selectedScenarioId) || null,
    [scenarios, selectedScenarioId]
  );

  const metricData = selectedRunDetail?.metrics || [];
  const recentEvents = selectedRunDetail?.events || [];
  const stepSummary = selectedRunDetail?.step_summary || [];
  const runtimeSteps = selectedRunDetail?.steps || selectedRunDetail?.scenario_snapshot?.steps || [];
  const runtimeVariables = selectedRunDetail?.variables || selectedRunDetail?.scenario_snapshot?.variables || [];

  useEffect(() => {
    loadProjects();
    form.setFieldsValue(getInitialFormValues());
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setScenarios([]);
      setRuns([]);
      setSelectedScenarioId(null);
      setSelectedRunId(null);
      setSelectedRunDetail(null);
      return;
    }
    void refreshAll(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedRunId) return;
    const timer = window.setInterval(() => {
      void loadRunDetail(selectedRunId, false);
      void loadRuns(selectedProjectId);
      void loadOverview(selectedProjectId);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [selectedRunId, selectedProjectId]);

  const loadProjects = async () => {
    try {
      const data = await projectApi.getProjects();
      setProjects(data || []);
      if (data?.length) {
        setSelectedProjectId(data[0].id);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '加载项目失败');
    }
  };

  const loadOverview = async (projectId?: number) => {
    try {
      const data = await performanceApi.getOverview(projectId);
      setOverview(data || {});
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '加载概览数据失败');
    }
  };

  const loadScenarios = async (projectId?: number) => {
    const data = await performanceApi.listScenarios(projectId);
    setScenarios(data || []);
    setSelectedScenarioId((prev) => {
      const next = (data || []).find((item: PerformanceScenario) => item.id === prev);
      return next ? next.id : data?.[0]?.id ?? null;
    });
  };

  const loadRuns = async (projectId?: number) => {
    const data = await performanceApi.listRuns(projectId, 30);
    setRuns(data || []);
    setSelectedRunId((prev) => {
      const next = (data || []).find((item: PerformanceRun) => item.id === prev);
      return next ? next.id : data?.[0]?.id ?? null;
    });
  };

  const loadRunDetail = async (runId: number, showLoading = true) => {
    if (showLoading) setDetailLoading(true);
    try {
      const detail = await performanceApi.getRun(runId);
      setSelectedRunDetail(detail || null);
      setSelectedRunId(runId);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '加载运行详情失败');
    } finally {
      if (showLoading) setDetailLoading(false);
    }
  };

  const refreshAll = async (projectId?: number) => {
    setLoading(true);
    try {
      await Promise.all([loadOverview(projectId), loadScenarios(projectId), loadRuns(projectId)]);
    } finally {
      setLoading(false);
    }
  };

  const safeParseJson = (value: any, fallback: any = {}) => {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'string') return value;
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const buildPayload = (values: ScenarioFormValues) => {
    const tags = String(values.tags || '')
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    const steps = (values.steps || [])
      .filter((item) => item?.name || item?.url)
      .map((item, index) => ({
        step_id: item.step_id || `step_${index + 1}`,
        name: item.name || `步骤 ${index + 1}`,
        enabled: item.enabled !== false,
        step_type: 'http',
        method: item.method || 'GET',
        url: item.url,
        headers: safeParseJson(item.headers, {}),
        query: safeParseJson(item.query, {}),
        body: safeParseJson(item.body, item.body || null),
        timeout_ms: item.timeout_ms || 10000,
        think_time_ms: item.think_time_ms || 0,
        extractors: safeParseJson(item.extractors, []),
        assertions: safeParseJson(item.assertions, []),
        on_failure: item.on_failure || 'stop_user',
        transaction_name: item.transaction_name || item.step_id || `transaction_${index + 1}`,
        weight: item.weight || 1,
      }));

    const variables = (values.variables || [])
      .filter((item) => item?.name)
      .map((item) => ({
        name: item.name,
        scope: item.scope || 'vu',
        initial_value: safeParseJson(item.initial_value, item.initial_value || null),
        secret: !!item.secret,
        description: item.description,
      }));

    const scenarioAssertions = safeParseJson(values.scenario_assertions, []);
    const runtimeExtra = safeParseJson(values.runtime_options_json, {});
    const environmentConfig = safeParseJson(values.environment_config, {});
    const firstStep = steps[0] || {};

    return {
      name: values.name,
      description: values.description,
      project_id: selectedProjectId,
      protocol: values.protocol,
      status: values.status,
      tags,
      target_config: {
        method: firstStep.method,
        url: firstStep.url,
        headers: firstStep.headers || {},
        query: firstStep.query || {},
        body: firstStep.body,
        timeout_ms: firstStep.timeout_ms || 10000,
        transaction_name: firstStep.transaction_name,
      },
      steps,
      variables,
      environment_config: environmentConfig,
      load_profile: {
        users: values.users,
        spawn_rate: values.spawn_rate,
        duration_seconds: values.duration_seconds,
      },
      assertions: scenarioAssertions,
      runtime_options: {
        worker_count: values.worker_count,
        hatch_interval: values.hatch_interval,
        ...runtimeExtra,
      },
    };
  };

  const formatStepForForm = (step: PerformanceScenarioStep, index: number): ScenarioFormStep => ({
    step_id: step.step_id || `step_${index + 1}`,
    name: step.name || `步骤 ${index + 1}`,
    enabled: step.enabled !== false,
    method: step.method || 'GET',
    url: step.url,
    headers: JSON.stringify(step.headers || {}, null, 2),
    query: JSON.stringify(step.query || {}, null, 2),
    body: typeof step.body === 'string' ? step.body : JSON.stringify(step.body ?? {}, null, 2),
    timeout_ms: step.timeout_ms || 10000,
    think_time_ms: step.think_time_ms || 0,
    extractors: JSON.stringify(step.extractors || [], null, 2),
    assertions: JSON.stringify(step.assertions || [], null, 2),
    on_failure: step.on_failure || 'stop_user',
    transaction_name: step.transaction_name || step.name,
    weight: step.weight || 1,
  });

  const handleSaveScenario = async () => {
    try {
      const values = await form.validateFields();
      const payload = buildPayload(values);
      setSaving(true);
      if (selectedScenario) {
        await performanceApi.updateScenario(selectedScenario.id, payload);
        message.success('性能场景已更新');
      } else {
        const result = await performanceApi.createScenario(payload);
        message.success('性能场景已创建');
        setSelectedScenarioId(result?.scenario?.id ?? null);
      }
      await refreshAll(selectedProjectId);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.detail || '保存性能场景失败');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadScenario = (scenario: PerformanceScenario) => {
    const steps: PerformanceScenarioStep[] = scenario.steps?.length
      ? scenario.steps
      : scenario.target_config
        ? [
            {
              step_id: 'step_1',
              name: '默认 HTTP 步骤',
              step_type: 'http',
              method: scenario.target_config?.method || 'GET',
              url: scenario.target_config?.url,
              headers: scenario.target_config?.headers || {},
              query: scenario.target_config?.query || {},
              body: scenario.target_config?.body,
              timeout_ms: scenario.target_config?.timeout_ms || 10000,
              think_time_ms: scenario.target_config?.think_time_ms || 0,
              extractors: scenario.target_config?.extractors || [],
              assertions: scenario.target_config?.assertions || [],
              on_failure: scenario.target_config?.on_failure || 'stop_user',
              transaction_name: scenario.target_config?.transaction_name || 'default_http_step',
              weight: scenario.target_config?.weight || 1,
            },
          ]
        : [
            {
              step_id: 'step_1',
              name: '默认 HTTP 步骤',
              step_type: 'http',
              method: 'GET',
              url: '',
              headers: {},
              query: {},
              body: null,
              timeout_ms: 10000,
              think_time_ms: 0,
              extractors: [],
              assertions: [],
              on_failure: 'stop_user',
              transaction_name: 'default_http_step',
              weight: 1,
            },
          ];

    const runtimeOptions = scenario.runtime_options || {};
    const filteredRuntimeOptions: Record<string, any> = {};
    for (const key in runtimeOptions) {
      if (key !== 'worker_count' && key !== 'hatch_interval') {
        filteredRuntimeOptions[key] = runtimeOptions[key];
      }
    }

    setSelectedScenarioId(scenario.id);
    form.setFieldsValue({
      name: scenario.name,
      description: scenario.description,
      protocol: scenario.protocol,
      status: scenario.status,
      tags: (scenario.tags || []).join(', '),
      users: scenario.load_profile?.users || 10,
      spawn_rate: scenario.load_profile?.spawn_rate || 1,
      duration_seconds: scenario.load_profile?.duration_seconds || 60,
      worker_count: runtimeOptions.worker_count || 1,
      hatch_interval: runtimeOptions.hatch_interval || 1,
      environment_config: JSON.stringify(scenario.environment_config || {}, null, 2),
      runtime_options_json: JSON.stringify(filteredRuntimeOptions, null, 2),
      scenario_assertions: JSON.stringify(scenario.assertions || [], null, 2),
      variables: (scenario.variables?.length ? scenario.variables : [createDefaultVariable()]).map((item) => ({
        name: item.name,
        scope: item.scope || 'vu',
        initial_value:
          typeof item.initial_value === 'string' ? item.initial_value : JSON.stringify(item.initial_value ?? '', null, 2),
        secret: !!item.secret,
        description: item.description,
      })),
      steps: steps.map(formatStepForForm),
    });
  };

  const handleCreateBlank = () => {
    setSelectedScenarioId(null);
    form.resetFields();
    form.setFieldsValue(getInitialFormValues());
  };

  const handleStartRun = async () => {
    if (!selectedScenario) {
      message.warning('请先选择性能场景');
      return;
    }
    try {
      setStarting(true);
      const created = await performanceApi.createRun({
        scenario_id: selectedScenario.id,
        trigger_source: 'manual',
      });
      const runId = created?.run?.id;
      if (runId) {
        await performanceApi.startRun(runId);
        message.success('性能测试已启动');
        await refreshAll(selectedProjectId);
        await loadRunDetail(runId);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '启动性能测试失败');
    } finally {
      setStarting(false);
    }
  };

  const handleStopRun = async () => {
    if (!selectedRunDetail?.id) return;
    try {
      await performanceApi.stopRun(selectedRunDetail.id);
      message.success('已发送停止指令');
      await loadRunDetail(selectedRunDetail.id);
      await refreshAll(selectedProjectId);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '停止性能测试失败');
    }
  };

  return (
    <div style={{ padding: 8 }}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Card
          bordered={false}
          style={{
            borderRadius: 24,
            background: 'linear-gradient(135deg, rgba(0,122,255,0.12) 0%, rgba(88,86,214,0.10) 55%, rgba(15,23,42,0.08) 100%)',
            boxShadow: '0 18px 48px rgba(15, 23, 42, 0.08)',
          }}
        >
          <Space direction="vertical" size={18} style={{ width: '100%' }}>
            <Space wrap>
              <Tag color="processing" icon={<ThunderboltOutlined />}>多接口链路压测</Tag>
              <Tag color="purple" icon={<LineChartOutlined />}>变量提取 / 传递</Tag>
              <Tag color="gold" icon={<ClockCircleOutlined />}>Locust 适配骨架</Tag>
            </Space>
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>性能测试控制台</Title>
              <Paragraph style={{ marginBottom: 0, color: '#475569', maxWidth: 980 }}>
                面向 HTTP 鉴权链路、多步骤事务流、运行快照与阶段诊断的专业性能工作台。当前版本已支持步骤编排、变量上下文、步骤级摘要和运行观测，后续将继续切换到真实 Locust 执行内核。
              </Paragraph>
            </div>
            <Space wrap>
              <Select
                style={{ minWidth: 240 }}
                placeholder="选择项目"
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                options={projects.map((item) => ({ label: item.name, value: item.id }))}
              />
              <Button icon={<PlusOutlined />} onClick={handleCreateBlank}>新建场景</Button>
              <Button type="primary" icon={<RocketOutlined />} loading={starting} onClick={handleStartRun}>
                启动压测
              </Button>
              <Button icon={<PauseCircleOutlined />} disabled={!selectedRunDetail || selectedRunDetail.status !== 'running'} onClick={handleStopRun}>
                停止当前运行
              </Button>
            </Space>
          </Space>
        </Card>

        <Spin spinning={loading}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} xl={6}>
              <Card bordered={false} style={{ borderRadius: 20 }}>
                <Statistic title="场景总数" value={overview.total_scenarios} />
              </Card>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Card bordered={false} style={{ borderRadius: 20 }}>
                <Statistic title="启用场景" value={overview.active_scenarios} />
              </Card>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Card bordered={false} style={{ borderRadius: 20 }}>
                <Statistic title="运行中任务" value={overview.running_runs} />
              </Card>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Card bordered={false} style={{ borderRadius: 20 }}>
                <Statistic title="最近平均响应(ms)" value={overview.latest_avg_response_time || 0} precision={2} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 4 }}>
            <Col xs={24} xxl={10}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card bordered={false} style={{ borderRadius: 20 }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 14 }} wrap>
                    <div>
                      <Title level={4} style={{ margin: 0 }}>场景编排工作区</Title>
                      <Text type="secondary">拆分为概览、变量、步骤三个工作面板，避免单页长表单</Text>
                    </div>
                    <Space wrap>
                      <Tag color="blue">HTTP First</Tag>
                      <Tag color="purple">Compact Composer</Tag>
                    </Space>
                  </Space>
                  <Form form={form} layout="vertical" initialValues={getInitialFormValues()}>
                    <Card
                      size="small"
                      style={{ borderRadius: 16, marginBottom: 16, background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)' }}
                    >
                      <Row gutter={[12, 12]} align="middle">
                        <Col xs={24} md={14}>
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <Space wrap>
                              <Tag color="processing">场景概览</Tag>
                              <Tag color="geekblue">配置前置区</Tag>
                            </Space>
                            <Text strong style={{ fontSize: 16 }}>
                              {selectedScenario?.name || form.getFieldValue('name') || '未命名场景'}
                            </Text>
                            <Text type="secondary">
                              {selectedScenario?.description || form.getFieldValue('description') || '建议在这里先定义链路目标、鉴权入口和关键事务。'}
                            </Text>
                          </Space>
                        </Col>
                        <Col xs={24} md={10}>
                          <Row gutter={[8, 8]}>
                            <Col span={12}>
                              <Card size="small" style={{ borderRadius: 12, textAlign: 'center' }}>
                                <Statistic title="变量数" value={(form.getFieldValue('variables') || []).length} />
                              </Card>
                            </Col>
                            <Col span={12}>
                              <Card size="small" style={{ borderRadius: 12, textAlign: 'center' }}>
                                <Statistic title="步骤数" value={(form.getFieldValue('steps') || []).length} />
                              </Card>
                            </Col>
                          </Row>
                        </Col>
                      </Row>
                    </Card>

                    <Tabs
                      defaultActiveKey="basic"
                      items={[
                        {
                          key: 'basic',
                          label: (
                            <Space size={6}>
                              <ProfileOutlined />
                              基础与负载
                            </Space>
                          ),
                          children: (
                            <Space direction="vertical" size={16} style={{ width: '100%' }}>
                              <Card size="small" title="基础信息" style={{ borderRadius: 16 }}>
                                <Form.Item label="场景名称" name="name" rules={[{ required: true, message: '请输入场景名称' }]}>
                                  <Input placeholder="例如：支付下单鉴权链路稳态压测" />
                                </Form.Item>
                                <Form.Item label="场景描述" name="description">
                                  <TextArea rows={3} placeholder="说明链路目标、鉴权方式、关键事务和风险点" />
                                </Form.Item>
                                <Row gutter={12}>
                                  <Col span={12}>
                                    <Form.Item label="协议" name="protocol" rules={[{ required: true }]}>
                                      <Select options={protocolOptions} />
                                    </Form.Item>
                                  </Col>
                                  <Col span={12}>
                                    <Form.Item label="状态" name="status" rules={[{ required: true }]}>
                                      <Select options={[{ label: '草稿', value: 'draft' }, { label: '启用', value: 'active' }, { label: '归档', value: 'archived' }]} />
                                    </Form.Item>
                                  </Col>
                                </Row>
                                <Form.Item label="标签" name="tags">
                                  <Input placeholder="核心链路, 鉴权, 支付, 晚高峰" />
                                </Form.Item>
                              </Card>

                              <Card size="small" title="负载与运行配置" style={{ borderRadius: 16 }}>
                                <Row gutter={12}>
                                  <Col span={8}><Form.Item label="并发用户" name="users"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                                  <Col span={8}><Form.Item label="升压速率" name="spawn_rate"><InputNumber min={0.1} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
                                  <Col span={8}><Form.Item label="持续时间(s)" name="duration_seconds"><InputNumber min={10} style={{ width: '100%' }} /></Form.Item></Col>
                                </Row>
                                <Row gutter={12}>
                                  <Col span={12}><Form.Item label="Worker 数量" name="worker_count"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                                  <Col span={12}><Form.Item label="Hatch 间隔(s)" name="hatch_interval"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                                </Row>
                                <Divider style={{ margin: '8px 0 16px' }} />
                                <Form.Item label="环境配置(JSON)" name="environment_config">
                                  <TextArea rows={4} placeholder='{"base_url":"https://example.com","env":"staging"}' />
                                </Form.Item>
                                <Form.Item label="运行扩展选项(JSON)" name="runtime_options_json">
                                  <TextArea rows={3} placeholder='{"host":"https://perf.example.com"}' />
                                </Form.Item>
                                <Form.Item label="场景级断言(JSON 数组)" name="scenario_assertions">
                                  <TextArea rows={4} placeholder='[{"type":"equals","operator":"eq","expected":"completed"}]' />
                                </Form.Item>
                              </Card>
                            </Space>
                          ),
                        },
                        {
                          key: 'variables',
                          label: (
                            <Space size={6}>
                              <DatabaseOutlined />
                              变量上下文
                            </Space>
                          ),
                          children: (
                            <Card size="small" title="变量上下文" style={{ borderRadius: 16 }}>
                              <Form.List name="variables">
                                {(fields, { add, remove }) => (
                                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                    <Alert
                                      type="info"
                                      showIcon
                                      message="变量用于承接鉴权 token、租户号、订单号等动态值，可在步骤中通过 {{variable_name}} 引用。"
                                    />
                                    {fields.map(({ key, name, ...restField }) => (
                                      <Card key={key} size="small" style={{ borderRadius: 14, background: '#fafcff' }}>
                                        <Row gutter={12}>
                                          <Col xs={24} md={8}>
                                            <Form.Item {...restField} name={[name, 'name']} label="变量名" rules={[{ required: true, message: '请输入变量名' }]}>
                                              <Input placeholder="access_token" />
                                            </Form.Item>
                                          </Col>
                                          <Col xs={12} md={6}>
                                            <Form.Item {...restField} name={[name, 'scope']} label="作用域">
                                              <Select options={variableScopeOptions} />
                                            </Form.Item>
                                          </Col>
                                          <Col xs={12} md={6}>
                                            <Form.Item {...restField} name={[name, 'secret']} label="敏感变量">
                                              <Select options={[{ label: '否', value: false }, { label: '是', value: true }]} />
                                            </Form.Item>
                                          </Col>
                                          <Col xs={24} md={4}>
                                            <Button danger style={{ marginTop: 30, width: '100%' }} onClick={() => remove(name)}>删除</Button>
                                          </Col>
                                        </Row>
                                        <Form.Item {...restField} name={[name, 'initial_value']} label="初始值 / JSON">
                                          <TextArea rows={2} placeholder='"perf_password" 或 {"tenant":"A"}' />
                                        </Form.Item>
                                        <Form.Item {...restField} name={[name, 'description']} label="说明">
                                          <Input placeholder="变量用途说明" />
                                        </Form.Item>
                                      </Card>
                                    ))}
                                    <Button block onClick={() => add(createDefaultVariable())}>新增变量</Button>
                                  </Space>
                                )}
                              </Form.List>
                            </Card>
                          ),
                        },
                        {
                          key: 'steps',
                          label: (
                            <Space size={6}>
                              <SettingOutlined />
                              步骤编排
                            </Space>
                          ),
                          children: (
                            <Card size="small" title="链路步骤编排" style={{ borderRadius: 16 }}>
                              <Form.List name="steps">
                                {(fields, { add, remove }) => (
                                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                    <Alert
                                      type="success"
                                      showIcon
                                      message="步骤详情改为折叠式编辑，只展开你当前关注的节点，减少纵向滚动长度。"
                                    />
                                    {fields.map(({ key, name, ...restField }, index) => (
                                      <Collapse
                                        key={key}
                                        defaultActiveKey={index === 0 ? ['summary'] : []}
                                        style={{ background: 'transparent' }}
                                      >
                                        <Panel
                                          key="summary"
                                          header={(
                                            <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                                              <Space>
                                                <Tag color="blue">步骤 {index + 1}</Tag>
                                                <Text strong>{form.getFieldValue(['steps', name, 'name']) || '未命名步骤'}</Text>
                                              </Space>
                                              <Space wrap>
                                                <Tag color={(form.getFieldValue(['steps', name, 'enabled']) ?? true) ? 'success' : 'default'}>
                                                  {(form.getFieldValue(['steps', name, 'enabled']) ?? true) ? '启用' : '停用'}
                                                </Tag>
                                                <Tag>{form.getFieldValue(['steps', name, 'method']) || 'GET'}</Tag>
                                                <Tag color="purple">{form.getFieldValue(['steps', name, 'transaction_name']) || '未设置事务名'}</Tag>
                                              </Space>
                                            </Space>
                                          )}
                                          extra={<Button danger size="small" onClick={(event) => { event.stopPropagation(); remove(name); }}>删除步骤</Button>}
                                        >
                                          <Row gutter={12}>
                                            <Col xs={24} md={6}>
                                              <Form.Item {...restField} name={[name, 'step_id']} label="步骤 ID" rules={[{ required: true, message: '请输入步骤 ID' }]}>
                                                <Input placeholder="auth_login" />
                                              </Form.Item>
                                            </Col>
                                            <Col xs={24} md={10}>
                                              <Form.Item {...restField} name={[name, 'name']} label="步骤名称" rules={[{ required: true, message: '请输入步骤名称' }]}>
                                                <Input placeholder="鉴权获取 Token" />
                                              </Form.Item>
                                            </Col>
                                            <Col xs={12} md={4}>
                                              <Form.Item {...restField} name={[name, 'enabled']} label="启用">
                                                <Select options={[{ label: '是', value: true }, { label: '否', value: false }]} />
                                              </Form.Item>
                                            </Col>
                                            <Col xs={12} md={4}>
                                              <Form.Item {...restField} name={[name, 'method']} label="方法">
                                                <Select options={httpMethodOptions} />
                                              </Form.Item>
                                            </Col>
                                          </Row>
                                          <Form.Item {...restField} name={[name, 'url']} label="URL" rules={[{ required: true, message: '请输入 URL' }]}>
                                            <Input placeholder="https://example.com/api/order" />
                                          </Form.Item>
                                          <Row gutter={12}>
                                            <Col xs={24} md={12}>
                                              <Form.Item {...restField} name={[name, 'transaction_name']} label="事务名">
                                                <Input placeholder="order_create" />
                                              </Form.Item>
                                            </Col>
                                            <Col xs={12} md={6}>
                                              <Form.Item {...restField} name={[name, 'timeout_ms']} label="超时(ms)">
                                                <InputNumber min={100} style={{ width: '100%' }} />
                                              </Form.Item>
                                            </Col>
                                            <Col xs={12} md={6}>
                                              <Form.Item {...restField} name={[name, 'think_time_ms']} label="思考时间(ms)">
                                                <InputNumber min={0} style={{ width: '100%' }} />
                                              </Form.Item>
                                            </Col>
                                          </Row>
                                          <Row gutter={12}>
                                            <Col xs={24} md={12}>
                                              <Form.Item {...restField} name={[name, 'on_failure']} label="失败策略">
                                                <Select options={failureStrategyOptions} />
                                              </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                              <Form.Item {...restField} name={[name, 'weight']} label="权重">
                                                <InputNumber min={1} max={100} style={{ width: '100%' }} />
                                              </Form.Item>
                                            </Col>
                                          </Row>
                                          <Form.Item {...restField} name={[name, 'headers']} label="请求头(JSON)">
                                            <TextArea rows={3} placeholder='{"Authorization":"Bearer {{access_token}}"}' />
                                          </Form.Item>
                                          <Form.Item {...restField} name={[name, 'query']} label="Query(JSON)">
                                            <TextArea rows={2} placeholder='{"tenantId":"{{tenant_id}}"}' />
                                          </Form.Item>
                                          <Form.Item {...restField} name={[name, 'body']} label="请求体 / JSON">
                                            <TextArea rows={4} placeholder='{"orderNo":"{{order_no}}"}' />
                                          </Form.Item>
                                          <Form.Item {...restField} name={[name, 'extractors']} label="提取器(JSON 数组)">
                                            <TextArea rows={4} placeholder='[{"name":"access_token","source":"json_body","expression":"$.data.token"}]' />
                                          </Form.Item>
                                          <Form.Item {...restField} name={[name, 'assertions']} label="步骤断言(JSON 数组)">
                                            <TextArea rows={4} placeholder='[{"type":"status_code","operator":"eq","expected":200}]' />
                                          </Form.Item>
                                        </Panel>
                                      </Collapse>
                                    ))}
                                    <Button block onClick={() => add(createDefaultStep(fields.length + 1))}>新增步骤</Button>
                                  </Space>
                                )}
                              </Form.List>
                            </Card>
                          ),
                        },
                      ]}
                    />

                    <Button type="primary" block loading={saving} onClick={handleSaveScenario}>保存场景</Button>
                  </Form>
                </Card>

                <Card bordered={false} style={{ borderRadius: 20 }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Title level={4} style={{ margin: 0 }}>场景目录</Title>
                    <Tag color="blue">{scenarios.length}</Tag>
                  </Space>
                  {scenarios.length ? (
                    <List
                      dataSource={scenarios}
                      renderItem={(item) => {
                        const state = scenarioStatusMap[item.status] || { text: item.status, color: 'default' };
                        return (
                          <List.Item style={{ cursor: 'pointer' }} onClick={() => handleLoadScenario(item)}>
                            <Space direction="vertical" size={6} style={{ width: '100%' }}>
                              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Text strong>{item.name}</Text>
                                <Space>
                                  <Tag color={item.protocol === 'http' ? 'processing' : 'purple'}>{item.protocol.toUpperCase()}</Tag>
                                  <Tag color={state.color}>{state.text}</Tag>
                                </Space>
                              </Space>
                              <Text type="secondary">{item.description || '暂无描述'}</Text>
                              <Space wrap>
                                <Tag color="geekblue">步骤 {item.step_count || item.steps?.length || 0}</Tag>
                                <Tag color="purple">变量 {item.variable_count || item.variables?.length || 0}</Tag>
                                {(item.tags || []).map((tag) => <Tag key={`${item.id}-${tag}`}>{tag}</Tag>)}
                              </Space>
                            </Space>
                          </List.Item>
                        );
                      }}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无性能场景" />
                  )}
                </Card>
              </Space>
            </Col>

            <Col xs={24} xxl={14}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card bordered={false} style={{ borderRadius: 20 }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 14 }}>
                    <Title level={4} style={{ margin: 0 }}>运行历史</Title>
                    <Text type="secondary">展示最近 30 次运行</Text>
                  </Space>
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={runs}
                    onRow={(record) => ({ onClick: () => void loadRunDetail(record.id) })}
                    columns={[
                      { title: '运行编号', dataIndex: 'run_no', key: 'run_no', width: 220 },
                      { title: '场景', dataIndex: 'scenario_name', key: 'scenario_name' },
                      { title: '协议', dataIndex: 'protocol', key: 'protocol', width: 100, render: (value: string) => <Tag color={value === 'http' ? 'processing' : 'purple'}>{String(value || '').toUpperCase()}</Tag> },
                      {
                        title: '状态', dataIndex: 'status', key: 'status', width: 110, render: (value: string) => {
                          const state = scenarioStatusMap[value] || { text: value, color: 'default' };
                          return <Tag color={state.color}>{state.text}</Tag>;
                        },
                      },
                      { title: '阶段', dataIndex: 'stage', key: 'stage', width: 120, render: (value: string) => <Tag color={stageColorMap[value] || 'default'}>{value}</Tag> },
                      { title: 'RPS', dataIndex: 'current_rps', key: 'current_rps', width: 100, render: (value: number) => value?.toFixed?.(2) ?? value },
                      { title: '错误率(%)', dataIndex: 'error_rate', key: 'error_rate', width: 110, render: (value: number) => value?.toFixed?.(2) ?? value },
                    ]}
                  />
                </Card>

                <Spin spinning={detailLoading}>
                  <Card bordered={false} style={{ borderRadius: 20 }}>
                    {!selectedRunDetail ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择一条运行记录查看详情" />
                    ) : (
                      <Space direction="vertical" size={18} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                          <div>
                            <Title level={4} style={{ marginBottom: 8 }}>{selectedRunDetail.scenario_name}</Title>
                            <Space wrap>
                              <Tag color="blue">{selectedRunDetail.run_no}</Tag>
                              <Tag color={stageColorMap[selectedRunDetail.stage] || 'default'}>{selectedRunDetail.stage}</Tag>
                              <Tag color={scenarioStatusMap[selectedRunDetail.status]?.color || 'default'}>
                                {scenarioStatusMap[selectedRunDetail.status]?.text || selectedRunDetail.status}
                              </Tag>
                            </Space>
                          </div>
                          <Alert
                            type={selectedRunDetail.status === 'failed' ? 'error' : selectedRunDetail.status === 'running' ? 'info' : 'success'}
                            showIcon
                            message={`当前并发 ${selectedRunDetail.current_users} / ${selectedRunDetail.target_users}`}
                            description={`RPS ${selectedRunDetail.current_rps?.toFixed?.(2) || 0}，P95 ${selectedRunDetail.p95_response_time?.toFixed?.(2) || 0} ms，错误率 ${selectedRunDetail.error_rate?.toFixed?.(2) || 0}%`}
                          />
                        </Space>

                        {selectedRunDetail.error_message ? (
                          <Alert type="error" showIcon message="运行异常" description={selectedRunDetail.error_message} />
                        ) : null}

                        <Row gutter={[16, 16]}>
                          <Col xs={24} md={8}><Card size="small" style={{ borderRadius: 16 }}><Statistic title="实时 RPS" value={selectedRunDetail.current_rps || 0} precision={2} /></Card></Col>
                          <Col xs={24} md={8}><Card size="small" style={{ borderRadius: 16 }}><Statistic title="平均响应(ms)" value={selectedRunDetail.avg_response_time || 0} precision={2} /></Card></Col>
                          <Col xs={24} md={8}><Card size="small" style={{ borderRadius: 16 }}><Statistic title="错误率(%)" value={selectedRunDetail.error_rate || 0} precision={2} /></Card></Col>
                        </Row>

                        <Descriptions bordered size="small" column={2}>
                          <Descriptions.Item label="协议">{selectedRunDetail.protocol?.toUpperCase()}</Descriptions.Item>
                          <Descriptions.Item label="触发来源">{selectedRunDetail.trigger_source}</Descriptions.Item>
                          <Descriptions.Item label="目标并发">{selectedRunDetail.target_users}</Descriptions.Item>
                          <Descriptions.Item label="升压速率">{selectedRunDetail.spawn_rate}/s</Descriptions.Item>
                          <Descriptions.Item label="持续时间">{selectedRunDetail.duration_seconds}s</Descriptions.Item>
                          <Descriptions.Item label="Worker 数">{selectedRunDetail.worker_count}</Descriptions.Item>
                          <Descriptions.Item label="步骤数">{runtimeSteps.length}</Descriptions.Item>
                          <Descriptions.Item label="变量数">{runtimeVariables.length}</Descriptions.Item>
                        </Descriptions>

                        <Card size="small" title="执行链路快照" style={{ borderRadius: 16 }}>
                          {runtimeSteps.length ? (
                            <List<PerformanceScenarioStep>
                              dataSource={runtimeSteps}
                              renderItem={(item, index) => (
                                <List.Item>
                                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                    <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                                      <Space>
                                        <Tag color="blue">{index + 1}</Tag>
                                        <Text strong>{item.name}</Text>
                                        <Tag>{item.method || item.step_type}</Tag>
                                      </Space>
                                      <Space>
                                        <Tag color="purple">事务 {item.transaction_name || item.step_id}</Tag>
                                        <Tag color="geekblue">失败策略 {item.on_failure || 'stop_user'}</Tag>
                                      </Space>
                                    </Space>
                                    <Text type="secondary">{item.url || '非 HTTP 步骤'}</Text>
                                  </Space>
                                </List.Item>
                              )}
                            />
                          ) : (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无步骤快照" />
                          )}
                        </Card>

                        <Card size="small" title="步骤级汇总" style={{ borderRadius: 16 }}>
                          {stepSummary.length ? (
                            <Table
                              rowKey="step_id"
                              size="small"
                              pagination={false}
                              dataSource={stepSummary}
                              columns={[
                                { title: '步骤', dataIndex: 'name', key: 'name' },
                                { title: '方法', dataIndex: 'method', key: 'method', width: 90 },
                                { title: '请求数', dataIndex: 'request_count', key: 'request_count', width: 100 },
                                { title: '失败数', dataIndex: 'failure_count', key: 'failure_count', width: 100 },
                                { title: 'Avg(ms)', dataIndex: 'avg_response_time', key: 'avg_response_time', width: 110, render: (value: number) => value?.toFixed?.(2) ?? value },
                                { title: 'P95(ms)', dataIndex: 'p95_response_time', key: 'p95_response_time', width: 110, render: (value: number) => value?.toFixed?.(2) ?? value },
                                { title: '最近状态码', dataIndex: 'last_status_code', key: 'last_status_code', width: 120 },
                              ]}
                            />
                          ) : (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无步骤级汇总" />
                          )}
                        </Card>

                        <Card size="small" title="引擎元数据 / 变量快照" style={{ borderRadius: 16 }}>
                          <Row gutter={[16, 16]}>
                            <Col xs={24} lg={12}>
                              <Descriptions bordered size="small" column={1}>
                                {(() => {
                                  const engineMetadata = selectedRunDetail.engine_metadata || {};
                                  const metadataKeys = Object.keys(engineMetadata);
                                  if (!metadataKeys.length) {
                                    return <Descriptions.Item label="engine">暂无元数据</Descriptions.Item>;
                                  }
                                  return metadataKeys.map((key) => {
                                    const value = engineMetadata[key];
                                    return <Descriptions.Item key={key} label={key}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</Descriptions.Item>;
                                  });
                                })()}
                              </Descriptions>
                            </Col>
                            <Col xs={24} lg={12}>
                              {runtimeVariables.length ? (
                                <List<PerformanceVariableDefinition>
                                  size="small"
                                  dataSource={runtimeVariables}
                                  renderItem={(item) => (
                                    <List.Item>
                                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                                        <Space>
                                          <Text strong>{item.name}</Text>
                                          <Tag color="purple">{item.scope || 'vu'}</Tag>
                                          {item.secret ? <Tag color="red">secret</Tag> : null}
                                        </Space>
                                        <Text type="secondary">{item.description || '暂无说明'}</Text>
                                      </Space>
                                    </List.Item>
                                  )}
                                />
                              ) : (
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无变量快照" />
                              )}
                            </Col>
                          </Row>
                        </Card>

                        <Card size="small" title="指标趋势（最近采样点）" style={{ borderRadius: 16 }}>
                          {metricData.length ? (
                            <Table
                              rowKey="id"
                              size="small"
                              pagination={false}
                              dataSource={metricData.slice(-10)}
                              columns={[
                                { title: '时间', dataIndex: 'timestamp_offset', key: 'timestamp_offset', width: 90, render: (value: number) => `T+${value}s` },
                                { title: '并发', dataIndex: 'active_users', key: 'active_users', width: 90 },
                                { title: 'RPS', dataIndex: 'current_rps', key: 'current_rps', width: 100, render: (value: number) => value?.toFixed?.(2) ?? value },
                                { title: 'Avg(ms)', dataIndex: 'avg_response_time', key: 'avg_response_time', width: 110, render: (value: number) => value?.toFixed?.(2) ?? value },
                                { title: 'P95(ms)', dataIndex: 'p95_response_time', key: 'p95_response_time', width: 110, render: (value: number) => value?.toFixed?.(2) ?? value },
                                { title: 'P99(ms)', dataIndex: 'p99_response_time', key: 'p99_response_time', width: 110, render: (value: number) => value?.toFixed?.(2) ?? value },
                                { title: '错误率(%)', dataIndex: 'error_rate', key: 'error_rate', width: 100, render: (value: number) => value?.toFixed?.(2) ?? value },
                              ]}
                            />
                          ) : (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无指标采样点" />
                          )}
                        </Card>

                        <Card size="small" title="阶段事件流" style={{ borderRadius: 16 }}>
                          {recentEvents.length ? (
                            <List
                              dataSource={recentEvents}
                              renderItem={(item) => (
                                <List.Item>
                                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                      <Space>
                                        <Tag color={stageColorMap[item.stage] || 'default'}>{item.stage}</Tag>
                                        <Tag color={item.level === 'error' ? 'error' : item.level === 'warning' ? 'warning' : item.level === 'success' ? 'success' : 'default'}>{item.level}</Tag>
                                      </Space>
                                      <Text type="secondary">{item.event_time}</Text>
                                    </Space>
                                    <Text>{item.message}</Text>
                                    {item.payload ? <Text type="secondary">{JSON.stringify(item.payload)}</Text> : null}
                                  </Space>
                                </List.Item>
                              )}
                            />
                          ) : (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无阶段事件" />
                          )}
                        </Card>
                      </Space>
                    )}
                  </Card>
                </Spin>
              </Space>
            </Col>
          </Row>
        </Spin>
      </Space>
    </div>
  );
};

export default PerformanceTest;
