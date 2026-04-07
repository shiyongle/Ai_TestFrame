import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  BugOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RocketOutlined,
  RobotOutlined,
  MinusCircleOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { uiAutomationApi } from '../../../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface UIStepConfig {
  action: string;
  target?: string;
  value?: string;
}

interface UITaskSummary {
  id: number;
  task_no: string;
  case_id?: number | null;
  name: string;
  target_url: string;
  auth_scheme: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'paused';
  progress: number;
  executor: string;
  debug_mode: boolean;
  created_at: string;
  started_at?: string;
  finished_at?: string;
}

interface UIStepLog {
  id: number;
  step_index: number;
  step_title: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  detail?: string;
  started_at?: string;
  finished_at?: string;
}

interface UIArtifact {
  id: number;
  artifact_type: string;
  artifact_name: string;
  artifact_path?: string;
  artifact_content?: string;
  created_at: string;
}

interface UITaskDetail extends UITaskSummary {
  error_message?: string;
  auth_payload?: Record<string, any>;
  natural_language_steps: UIStepConfig[];
  assertions: string[];
  step_logs: UIStepLog[];
  artifacts: UIArtifact[];
  playwright_script?: string;
  trace_artifact_name?: string;
  replay_script_name?: string;
}

interface UICaseSummary {
  id: number;
  name: string;
  description?: string;
  project_id?: number | null;
  target_url: string;
  auth_scheme: string;
  auth_payload?: Record<string, any>;
  natural_language_steps: UIStepConfig[];
  assertions: string[];
  tags: string[];
  status: string;
  debug_mode: boolean;
  last_run_status?: string;
  last_run_at?: string;
  created_at: string;
  updated_at: string;
}

interface UICaseDetail extends UICaseSummary {}

const statusColorMap: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  success: 'success',
  failed: 'error',
  paused: 'warning',
  draft: 'default',
  active: 'processing',
};

const statusTextMap: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  success: '成功',
  failed: '失败',
  paused: '已暂停',
  draft: '草稿',
  active: '启用中',
};

const artifactTypeColorMap: Record<string, string> = {
  screenshot: 'blue',
  diagnosis: 'gold',
  dom_snapshot: 'purple',
  trace: 'cyan',
  selector_diagnosis: 'magenta',
  replay_script: 'geekblue',
  error: 'error',
  script: 'green',
};

const artifactSections = [
  { key: 'screenshot', title: '截图证据', description: '成功与失败节点的页面截图。' },
  { key: 'diagnosis', title: '运行诊断', description: '步骤失败时的动作/页面时机诊断。' },
  { key: 'dom_snapshot', title: 'DOM 快照', description: '调试模式下记录的页面 HTML 快照。' },
  { key: 'selector_diagnosis', title: '选择器诊断', description: '候选元素可见性、可编辑性与 outerHTML 信息。' },
  { key: 'trace', title: 'Trace 追踪', description: 'Playwright trace 工件，可用于还原完整执行过程。' },
  { key: 'replay_script', title: '复现脚本', description: '用于最小复现场景的调试脚本。' },
  { key: 'error', title: '错误工件', description: '截图、trace 或诊断写入失败时的错误记录。' },
  { key: 'script', title: '固化脚本', description: '手动固化生成的 Playwright 脚本副本。' },
];

const actionOptions = [
  { label: '🌐 打开网页', value: 'goto' },
  { label: '🖱️ 点击元素', value: 'click' },
  { label: '⌨️ 填入文本', value: 'fill' },
  { label: '✅ 断言期望', value: 'assert' },
  { label: '⏱️ 强制等待', value: 'sleep' },
  { label: '👀 等待元素可见', value: 'wait_for_visible' },
  { label: '🙈 等待元素隐藏', value: 'wait_for_hidden' },
  { label: '🔎 等待文本出现', value: 'wait_for_text' },
];

const formatTime = (value?: string) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
};

const buildArtifactUrl = (artifactPath?: string) => {
  if (!artifactPath) return '';
  if (/^https?:\/\//i.test(artifactPath)) return artifactPath;

  const normalizedPath = artifactPath.startsWith('/') ? artifactPath : `/${artifactPath}`;
  const envApiUrl = (window as Window & { __RUNTIME_API_URL__?: string }).__RUNTIME_API_URL__ || '';
  const backendOrigin =
    envApiUrl ||
    (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000` : '');

  if (normalizedPath.startsWith('/backend/ui_artifacts/')) {
    return `${backendOrigin}${normalizedPath}`;
  }

  return `${backendOrigin}${normalizedPath}`;
};

const normalizeStep = (step: any): UIStepConfig => ({
  action: typeof step?.action === 'string' ? step.action : '',
  target: typeof step?.target === 'string' ? step.target : '',
  value: typeof step?.value === 'string' ? step.value : '',
});

const buildFormValuesFromCase = (caseDetail: UICaseDetail) => ({
  name: caseDetail.name,
  target_url: caseDetail.target_url,
  auth_scheme: caseDetail.auth_scheme || 'none',
  debug_mode: !!caseDetail.debug_mode,
  description: caseDetail.description || '',
  tags: Array.isArray(caseDetail.tags) ? caseDetail.tags.join(', ') : '',
  username: caseDetail.auth_payload?.username || '',
  password: caseDetail.auth_payload?.password || '',
  token: caseDetail.auth_payload?.token || '',
  cookies: caseDetail.auth_payload?.cookies || '',
  steps: Array.isArray(caseDetail.natural_language_steps)
    ? caseDetail.natural_language_steps.map(normalizeStep)
    : [],
});

const buildCasePayload = (values: any) => ({
  name: values.name,
  description: values.description || '',
  target_url: values.target_url,
  auth_scheme: values.auth_scheme,
  auth_payload: {
    username: values.username || '',
    password: values.password || '',
    token: values.token || '',
    cookies: values.cookies || '',
  },
  natural_language_steps: Array.isArray(values.steps) ? values.steps.map(normalizeStep) : [],
  assertions: [],
  tags: typeof values.tags === 'string'
    ? values.tags.split(',').map((item: string) => item.trim()).filter(Boolean)
    : [],
  status: 'draft',
  debug_mode: !!values.debug_mode,
});

const buildTaskPayload = (values: any) => ({
  name: values.name,
  target_url: values.target_url,
  auth_scheme: values.auth_scheme,
  auth_payload: {
    username: values.username,
    password: values.password,
    token: values.token,
    cookies: values.cookies,
  },
  natural_language_steps: Array.isArray(values.steps) ? values.steps.map(normalizeStep) : [],
  assertions: [],
  auto_start: true,
  debug_mode: !!values.debug_mode,
});

const UiAutomation: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [savingCase, setSavingCase] = useState(false);
  const [tasks, setTasks] = useState<UITaskSummary[]>([]);
  const [cases, setCases] = useState<UICaseSummary[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [taskDetail, setTaskDetail] = useState<UITaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const resetComposer = React.useCallback(() => {
    form.resetFields();
    form.setFieldsValue({
      auth_scheme: 'none',
      debug_mode: false,
      steps: [],
      description: '',
      tags: '',
      username: '',
      password: '',
      token: '',
      cookies: '',
    });
    setSelectedCaseId(null);
  }, [form]);

  const loadCases = React.useCallback(async () => {
    const res = await uiAutomationApi.listCases();
    const list = Array.isArray(res) ? res : [];
    setCases(list);
    setSelectedCaseId((prev) => {
      if (prev && list.some((item) => item.id === prev)) {
        return prev;
      }
      return list[0]?.id ?? null;
    });
  }, []);

  const loadTasks = React.useCallback(async () => {
    const res = await uiAutomationApi.listTasks(30);
    const list = Array.isArray(res) ? res : [];
    setTasks(list);
    if (list.length) {
      setSelectedTaskId((prev) => prev ?? list[0].id);
    } else {
      setSelectedTaskId(null);
      setTaskDetail(null);
    }
  }, []);

  const loadTaskDetail = React.useCallback(async (taskId: number) => {
    setDetailLoading(true);
    try {
      const detail = await uiAutomationApi.getTask(taskId);
      setTaskDetail(detail);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '加载任务详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshAll = React.useCallback(async () => {
    try {
      await Promise.all([loadCases(), loadTasks()]);
      if (selectedTaskId) {
        await loadTaskDetail(selectedTaskId);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '刷新失败');
    }
  }, [loadCases, loadTaskDetail, loadTasks, selectedTaskId]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (selectedTaskId) {
      loadTaskDetail(selectedTaskId);
    }
  }, [loadTaskDetail, selectedTaskId]);

  useEffect(() => {
    if (taskDetail?.status !== 'running') return;
    const timer = window.setInterval(() => {
      if (selectedTaskId) {
        loadTasks();
        loadTaskDetail(selectedTaskId);
        loadCases();
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [loadCases, loadTaskDetail, loadTasks, selectedTaskId, taskDetail?.status]);

  const onDeleteTask = async (taskId: number) => {
    try {
      await uiAutomationApi.deleteTask(taskId);
      message.success('任务已删除');
      const nextTasks = tasks.filter((item) => item.id !== taskId);
      setTasks(nextTasks);
      if (selectedTaskId === taskId) {
        const nextSelectedId = nextTasks[0]?.id;
        setSelectedTaskId(nextSelectedId || null);
        setTaskDetail(null);
        if (nextSelectedId) {
          await loadTaskDetail(nextSelectedId);
        }
      }
      await loadCases();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '删除任务失败');
    }
  };

  const onDeleteCase = async (caseId: number) => {
    try {
      await uiAutomationApi.deleteCase(caseId);
      message.success('用例已删除');
      if (selectedCaseId === caseId) {
        resetComposer();
      }
      await loadCases();
      await loadTasks();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '删除用例失败');
    }
  };

  const onLoadCase = async (caseId: number) => {
    try {
      const res = await uiAutomationApi.getCase(caseId);
      const caseDetail = res?.case || res;
      if (!caseDetail) {
        message.warning('未找到用例详情');
        return;
      }
      form.setFieldsValue(buildFormValuesFromCase(caseDetail));
      setSelectedCaseId(caseDetail.id);
      message.success('已加载用例到编排区');
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '加载用例失败');
    }
  };

  const onSaveCase = async () => {
    try {
      const values = await form.validateFields();
      setSavingCase(true);
      const payload = buildCasePayload(values);
      const res = selectedCaseId
        ? await uiAutomationApi.updateCase(selectedCaseId, payload)
        : await uiAutomationApi.createCase(payload);
      const caseEntity = res?.case || res;
      message.success(selectedCaseId ? '用例已更新' : '用例已保存');
      if (caseEntity?.id) {
        setSelectedCaseId(caseEntity.id);
      }
      await loadCases();
    } catch (error: any) {
      if (error?.errorFields) {
        message.warning('请先补全表单必填项');
      } else {
        message.error(error?.response?.data?.detail || '保存用例失败');
      }
    } finally {
      setSavingCase(false);
    }
  };

  const onCreateTask = async (values: any) => {
    setLoading(true);
    try {
      const payload = buildTaskPayload(values);
      const res = await uiAutomationApi.createTask(payload);
      message.success('UI 任务已创建并启动');
      const taskId = res?.task?.id;
      await loadTasks();
      await loadCases();
      if (taskId) {
        setSelectedTaskId(taskId);
        await loadTaskDetail(taskId);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '创建任务失败');
    } finally {
      setLoading(false);
    }
  };

  const onRunCase = async (caseId: number) => {
    try {
      const caseItem = cases.find((item) => item.id === caseId);
      const res = await uiAutomationApi.runCase(caseId, { auto_start: true, debug_mode: caseItem?.debug_mode });
      const taskId = res?.task?.id;
      message.success('用例已转为执行任务并启动');
      await loadTasks();
      await loadCases();
      if (taskId) {
        setSelectedTaskId(taskId);
        await loadTaskDetail(taskId);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '执行用例失败');
    }
  };

  const onStartTask = async () => {
    if (!selectedTaskId) return;
    try {
      await uiAutomationApi.startTask(selectedTaskId);
      message.success('任务已启动');
      await refreshAll();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '启动任务失败');
    }
  };

  const onPauseTask = async () => {
    if (!selectedTaskId) return;
    try {
      await uiAutomationApi.pauseTask(selectedTaskId);
      message.success('已发送暂停指令，任务即将挂起');
      await refreshAll();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '暂停任务失败');
    }
  };

  const onResumeTask = async () => {
    if (!selectedTaskId) return;
    try {
      await uiAutomationApi.resumeTask(selectedTaskId);
      message.success('任务已恢复执行');
      await refreshAll();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '恢复任务失败');
    }
  };

  const onSolidifyTask = async () => {
    if (!selectedTaskId) return;
    try {
      await uiAutomationApi.solidifyTask(selectedTaskId);
      message.success('已固化为 Playwright 脚本');
      await loadTaskDetail(selectedTaskId);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '固化脚本失败');
    }
  };

  const onGenerateSteps = async () => {
    if (!aiPrompt.trim()) return message.warning('请输入自然语言描述');
    setAiGenerating(true);
    try {
      const res = await uiAutomationApi.generateSteps(aiPrompt);
      const generatedSteps = Array.isArray(res?.steps) ? res.steps.map(normalizeStep) : [];
      const currentSteps = form.getFieldValue('steps') || [];
      form.setFieldsValue({
        steps: currentSteps.concat(generatedSteps),
      });
      message.success('步骤已生成并追加到列表');
      setAiModalVisible(false);
      setAiPrompt('');
    } catch (error: any) {
      message.error(error?.response?.data?.detail || 'AI 生成失败');
    } finally {
      setAiGenerating(false);
    }
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const running = tasks.filter((item) => item.status === 'running').length;
    const success = tasks.filter((item) => item.status === 'success').length;
    const debug = tasks.filter((item) => item.debug_mode).length;
    return { total, running, success, debug };
  }, [tasks]);

  const caseStats = useMemo(() => {
    const total = cases.length;
    const drafted = cases.filter((item) => item.status === 'draft').length;
    const runnable = cases.filter((item) => Array.isArray(item.natural_language_steps) && item.natural_language_steps.length > 0).length;
    return { total, drafted, runnable };
  }, [cases]);

  const selectedArtifacts = useMemo(() => taskDetail?.artifacts || [], [taskDetail]);

  const selectedArtifactGroups = useMemo(() => {
    return artifactSections
      .map((section) => ({
        ...section,
        items: selectedArtifacts.filter((item) => item.artifact_type === section.key),
      }))
      .filter((section) => section.items.length > 0);
  }, [selectedArtifacts]);

  const latestDiagnosisArtifact = useMemo(
    () => selectedArtifacts.find((item) => item.artifact_type === 'diagnosis'),
    [selectedArtifacts],
  );

  const latestSelectorDiagnosisArtifact = useMemo(
    () => selectedArtifacts.find((item) => item.artifact_type === 'selector_diagnosis'),
    [selectedArtifacts],
  );

  const latestRuntimeErrorArtifact = useMemo(
    () => selectedArtifacts.find((item) => item.artifact_type === 'error'),
    [selectedArtifacts],
  );

  const failedStep = useMemo(() => {
    const steps = taskDetail?.step_logs || [];
    return steps.find((item) => item.status === 'failed') || null;
  }, [taskDetail]);

  const debugFailureSummary = useMemo(() => {
    if (!taskDetail || taskDetail.status !== 'failed') return [];

    const rows = [
      failedStep ? `失败步骤：#${failedStep.step_index} ${failedStep.step_title}` : '',
      failedStep?.detail ? `步骤详情：${failedStep.detail}` : '',
      taskDetail.error_message ? `任务错误：${taskDetail.error_message}` : '',
      latestDiagnosisArtifact?.artifact_content ? `运行诊断：${latestDiagnosisArtifact.artifact_content}` : '',
      latestSelectorDiagnosisArtifact?.artifact_content ? `选择器诊断：${latestSelectorDiagnosisArtifact.artifact_content}` : '',
      latestRuntimeErrorArtifact?.artifact_content ? `运行时错误工件：${latestRuntimeErrorArtifact.artifact_content}` : '',
    ];

    return rows.filter((item) => !!item);
  }, [failedStep, latestDiagnosisArtifact, latestRuntimeErrorArtifact, latestSelectorDiagnosisArtifact, taskDetail]);

  const progressStatus = taskDetail?.status === 'failed' ? 'exception' : undefined;

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) || null,
    [cases, selectedCaseId],
  );

  const renderArtifactHint = (item: UIArtifact) => {
    if (item.artifact_type === 'screenshot') {
      return <Text type="secondary">页面截图，可用于还原动作前后状态。</Text>;
    }
    if (item.artifact_type === 'diagnosis') {
      return <Text type="secondary">诊断卡片用于判断是定位失败、页面时机问题还是动作编排异常。</Text>;
    }
    if (item.artifact_type === 'dom_snapshot') {
      return <Text type="secondary">DOM 快照可用于检查当时的页面结构。</Text>;
    }
    if (item.artifact_type === 'trace') {
      return <Text type="secondary">Trace 工件已写入，可结合本地工具回放调试。</Text>;
    }
    if (item.artifact_type === 'selector_diagnosis') {
      return <Text type="secondary">记录候选元素的可见性、可编辑性、文本与 outerHTML。</Text>;
    }
    if (item.artifact_type === 'replay_script') {
      return <Text type="secondary">最小复现脚本，便于开发或测试单独回放问题。</Text>;
    }
    if (item.artifact_type === 'script') {
      return <Text type="secondary">固化后的 Playwright 脚本，可直接复制使用。</Text>;
    }
    if (item.artifact_type === 'error') {
      return <Text type="danger">调试证据写入过程中产生的错误信息。</Text>;
    }
    return <Text type="secondary">类型：{item.artifact_type}</Text>;
  };

  const renderArtifactPreview = (item: UIArtifact) => {
    if (item.artifact_type === 'screenshot') {
      const screenshotUrl = buildArtifactUrl(item.artifact_path);
      if (screenshotUrl) {
        return <img src={screenshotUrl} alt={item.artifact_name || 'screenshot'} className="artifact-image" />;
      }
      if (item.artifact_content) {
        return <img src={`data:image/png;base64,${item.artifact_content}`} alt="screenshot" className="artifact-image" />;
      }
    }

    return (
      <div className="artifact-code-box">
        {item.artifact_content || item.artifact_path || '暂无内容'}
      </div>
    );
  };

  return (
    <div className="ui-automation-page">
      <style>{`
        .ui-automation-page {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(circle at top left, rgba(59,130,246,0.14), transparent 28%),
            radial-gradient(circle at top right, rgba(16,185,129,0.12), transparent 24%),
            linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
        }

        .glass-panel {
          background: rgba(255,255,255,0.82) !important;
          border: 1px solid rgba(148,163,184,0.16) !important;
          border-radius: 24px !important;
          box-shadow: 0 16px 40px rgba(15,23,42,0.06) !important;
          backdrop-filter: blur(12px);
        }

        .hero-card {
          overflow: hidden;
          position: relative;
        }

        .hero-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(37,99,235,0.09), rgba(16,185,129,0.05));
          pointer-events: none;
        }

        .hero-content {
          position: relative;
          z-index: 1;
        }

        .hero-title {
          margin-bottom: 8px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
        }

        .hero-subtitle {
          font-size: 14px;
          color: #475569;
          max-width: 860px;
          display: inline-block;
        }

        .metric-tile {
          background: rgba(255,255,255,0.72);
          border: 1px solid rgba(148,163,184,0.14);
          border-radius: 18px;
          padding: 18px;
          height: 100%;
        }

        .section-title {
          margin: 0 !important;
          color: #0f172a !important;
          font-weight: 700 !important;
        }

        .section-desc {
          color: #64748b;
          font-size: 13px;
        }

        .composer-card .ant-form-item {
          margin-bottom: 14px;
        }

        .step-card {
          position: relative;
          padding: 16px 16px 14px 44px;
          border-radius: 18px;
          border: 1px solid #dbe7f3;
          background: linear-gradient(180deg, #ffffff, #f8fbff);
          margin-bottom: 14px;
        }

        .step-index {
          position: absolute;
          left: 14px;
          top: 18px;
          width: 22px;
          height: 22px;
          border-radius: 11px;
          background: #2563eb;
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .task-list-item,
        .case-list-item {
          border-radius: 18px;
          padding: 14px 16px !important;
          border: 1px solid rgba(148,163,184,0.14);
          background: rgba(255,255,255,0.76);
          margin-bottom: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .task-list-item:hover,
        .case-list-item:hover {
          transform: translateY(-1px);
          border-color: rgba(37,99,235,0.28);
          box-shadow: 0 12px 24px rgba(37,99,235,0.06);
        }

        .task-list-item.active,
        .case-list-item.active {
          border-color: rgba(37,99,235,0.44);
          background: linear-gradient(180deg, rgba(239,246,255,0.95), rgba(255,255,255,0.96));
          box-shadow: 0 14px 30px rgba(37,99,235,0.08);
        }

        .detail-summary-grid,
        .case-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .detail-summary-item,
        .case-summary-item {
          border-radius: 18px;
          padding: 16px;
          background: linear-gradient(180deg, #f8fbff, #ffffff);
          border: 1px solid rgba(148,163,184,0.14);
          min-height: 94px;
        }

        .summary-label {
          color: #64748b;
          font-size: 12px;
          margin-bottom: 8px;
          display: block;
        }

        .terminal-card {
          background: #0b1220 !important;
          border-radius: 24px !important;
          border: 1px solid rgba(71,85,105,0.4) !important;
        }

        .terminal-log {
          border-bottom: 1px dashed rgba(148,163,184,0.16);
          padding: 12px 0;
        }

        .terminal-log:last-child {
          border-bottom: none;
        }

        .artifact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .artifact-card {
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,0.14);
          background: #ffffff;
          box-shadow: 0 8px 20px rgba(15,23,42,0.05);
        }

        .artifact-image {
          display: block;
          width: 100%;
          height: 220px;
          object-fit: cover;
          background: #e2e8f0;
        }

        .artifact-code-box {
          height: 220px;
          overflow: auto;
          padding: 14px;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: Consolas, 'SFMono-Regular', monospace;
          font-size: 12px;
          color: #e2e8f0;
          background: #0f172a;
        }

        .artifact-meta {
          padding: 14px;
          background: #ffffff;
        }

        .script-box {
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 18px;
          padding: 18px;
          white-space: pre-wrap;
          overflow: auto;
          font-family: Consolas, 'SFMono-Regular', monospace;
          max-height: 360px;
          margin: 0;
        }

        @media (max-width: 1400px) {
          .case-summary-grid,
          .detail-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .ui-automation-page {
            padding: 16px;
          }

          .detail-summary-grid,
          .case-summary-grid {
            grid-template-columns: repeat(1, minmax(0, 1fr));
          }
        }
      `}</style>

      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card bordered={false} className="glass-panel hero-card">
          <div className="hero-content">
            <Row gutter={[24, 24]} align="middle">
              <Col xs={24} xl={15}>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Tag color="blue" style={{ width: 'fit-content', borderRadius: 999, padding: '4px 10px' }}>
                    Playwright UI Automation Studio
                  </Tag>
                  <Title level={2} className="hero-title">UI 自动化用例资产与执行工作台</Title>
                  <Text className="hero-subtitle">
                    将任务执行、证据链调试与用例资产管理统一到同一页面，支持保存、复用、加载与一键执行。
                  </Text>
                  <Space wrap>
                    <Button icon={<ReloadOutlined />} onClick={refreshAll} size="large" shape="round">
                      刷新视图
                    </Button>
                    <Button icon={<FileTextOutlined />} size="large" shape="round" onClick={resetComposer}>
                      新建空白用例
                    </Button>
                    <Tag color="cyan">用例资产化</Tag>
                    <Tag color="geekblue">任务执行编排</Tag>
                    <Tag color="purple">Trace / DOM / Selector Diagnosis</Tag>
                  </Space>
                </Space>
              </Col>
              <Col xs={24} xl={9}>
                <Row gutter={[12, 12]}>
                  <Col span={12}>
                    <div className="metric-tile">
                      <Statistic title="任务总数" value={stats.total} prefix={<ApiOutlined />} />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div className="metric-tile">
                      <Statistic title="执行中" value={stats.running} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#2563eb' }} />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div className="metric-tile">
                      <Statistic title="成功任务" value={stats.success} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#059669' }} />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div className="metric-tile">
                      <Statistic title="调试模式" value={stats.debug} prefix={<BugOutlined />} valueStyle={{ color: '#7c3aed' }} />
                    </div>
                  </Col>
                </Row>
              </Col>
            </Row>
          </div>
        </Card>

        <Alert
          showIcon
          type="info"
          message="推荐工作流：创建/加载用例 → AI 生成或手工编排步骤 → 保存为用例资产 → 按用例创建任务执行 → 查看日志与证据链 → 固化脚本。"
          style={{ borderRadius: 18 }}
        />

        <Row gutter={[24, 24]}>
          <Col xs={24} xxl={9}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Card bordered={false} className="glass-panel composer-card">
                <Space direction="vertical" size={4} style={{ marginBottom: 18 }}>
                  <Title level={4} className="section-title">用例编排</Title>
                  <Text className="section-desc">维护可复用的 UI 自动化用例资产，保存后可在下方直接复用与执行。</Text>
                </Space>

                <Form
                  form={form}
                  layout="vertical"
                  initialValues={{ auth_scheme: 'none', debug_mode: false, steps: [], description: '', tags: '' }}
                  onFinish={onCreateTask}
                >
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="name" label="用例 / 任务名称" rules={[{ required: true, message: '请输入名称' }]}>
                        <Input placeholder="例如：搜索页冒烟回归" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="target_url" label="目标站点" rules={[{ required: true, message: '请输入目标 URL' }]}>
                        <Input placeholder="https://example.com" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="description" label="用例说明">
                        <Input placeholder="描述业务场景、前置条件或关注点" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="tags" label="标签">
                        <Input placeholder="冒烟, 登录, 搜索" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="auth_scheme" label="账号方案">
                        <Select
                          options={[
                            { label: '无鉴权', value: 'none' },
                            { label: '账号密码', value: 'account_password' },
                            { label: 'Token', value: 'token' },
                            { label: 'Cookie', value: 'cookie' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="debug_mode"
                        label="调试模式"
                        valuePropName="checked"
                        extra="开启后会采集 trace、DOM 快照与选择器诊断。"
                      >
                        <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item noStyle shouldUpdate>
                    {({ getFieldValue }) => {
                      const scheme = getFieldValue('auth_scheme');
                      return (
                        <Row gutter={12}>
                          {scheme === 'account_password' && (
                            <>
                              <Col span={12}>
                                <Form.Item name="username" label="用户名">
                                  <Input placeholder="username" />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name="password" label="密码">
                                  <Input.Password placeholder="password" />
                                </Form.Item>
                              </Col>
                            </>
                          )}
                          {scheme === 'token' && (
                            <Col span={24}>
                              <Form.Item name="token" label="Token">
                                <Input.Password placeholder="Bearer token" />
                              </Form.Item>
                            </Col>
                          )}
                          {scheme === 'cookie' && (
                            <Col span={24}>
                              <Form.Item name="cookies" label="Cookie">
                                <Input placeholder="name=value; name2=value2" />
                              </Form.Item>
                            </Col>
                          )}
                        </Row>
                      );
                    }}
                  </Form.Item>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <Text strong style={{ fontSize: 16, color: '#0f172a' }}>步骤编排</Text>
                      <div><Text className="section-desc">建议使用结构化动作；慢网速或异步渲染场景可插入等待动作，提高脚本稳定性与可观测性。</Text></div>
                    </div>
                    <Button type="default" icon={<RobotOutlined />} onClick={() => setAiModalVisible(true)}>
                      AI 生成步骤
                    </Button>
                  </div>

                  <Form.List name="steps">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.length === 0 && (
                          <div style={{ padding: 16, borderRadius: 16, background: '#f8fbff', border: '1px dashed #cbd5e1', marginBottom: 14 }}>
                            <Text type="secondary">当前还没有步骤，可以手动添加，或点击“AI 生成步骤”自动补全。</Text>
                          </div>
                        )}
                        {fields.map(({ key, name, ...restField }, index) => (
                          <div key={key} className="step-card">
                            <div className="step-index">{index + 1}</div>
                            <Row gutter={12}>
                              <Col span={7}>
                                <Form.Item
                                  {...restField}
                                  label="动作"
                                  name={[name, 'action']}
                                  rules={[{ required: true, message: '请选择动作' }]}
                                >
                                  <Select options={actionOptions} placeholder="选择动作" />
                                </Form.Item>
                              </Col>
                              <Col span={9}>
                                <Form.Item {...restField} label="目标" name={[name, 'target']}>
                                  <Input placeholder="CSS / XPath / URL（等待文本可留空）" />
                                </Form.Item>
                              </Col>
                              <Col span={6}>
                                <Form.Item {...restField} label="值" name={[name, 'value']}>
                                  <Input placeholder="输入值 / 断言文本 / 等待秒数" />
                                </Form.Item>
                              </Col>
                              <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                              </Col>
                            </Row>
                          </div>
                        ))}
                        <Form.Item style={{ marginBottom: 10 }}>
                          <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add()} style={{ height: 44, borderRadius: 14 }}>
                            添加步骤
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>

                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={savingCase}
                      onClick={onSaveCase}
                      style={{ width: '100%', height: 46, borderRadius: 14, fontWeight: 600 }}
                    >
                      {selectedCaseId ? '更新当前用例' : '保存为用例'}
                    </Button>
                    <Button
                      htmlType="submit"
                      loading={loading}
                      icon={<PlayCircleOutlined />}
                      style={{ width: '100%', height: 46, borderRadius: 14, fontWeight: 600 }}
                    >
                      直接创建执行任务
                    </Button>
                  </Space>
                </Form>
              </Card>

              <Card bordered={false} className="glass-panel">
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <Title level={4} className="section-title">用例资产列表</Title>
                    <Text className="section-desc">已保存的 UI 自动化用例，可加载编辑或直接执行。</Text>
                  </div>
                  <Space>
                    <Tag color="blue">总数 {caseStats.total}</Tag>
                    <Tag color="default">草稿 {caseStats.drafted}</Tag>
                    <Tag color="green">可运行 {caseStats.runnable}</Tag>
                  </Space>
                </Space>
                <List
                  dataSource={cases}
                  locale={{ emptyText: '暂无用例，请先在上方保存' }}
                  renderItem={(item) => (
                    <List.Item
                      className={`case-list-item ${item.id === selectedCaseId ? 'active' : ''}`}
                      onClick={() => setSelectedCaseId(item.id)}
                    >
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Text strong>{item.name}</Text>
                          <Space size={4} wrap>
                            <Badge status={(statusColorMap[item.last_run_status || item.status] as any) || 'default'} text={statusTextMap[item.last_run_status || item.status] || item.status} />
                            <Button
                              size="small"
                              type="text"
                              icon={<FolderOpenOutlined />}
                              onClick={(event) => {
                                event.stopPropagation();
                                onLoadCase(item.id);
                              }}
                            >
                              加载
                            </Button>
                            <Button
                              size="small"
                              type="text"
                              icon={<RocketOutlined />}
                              onClick={(event) => {
                                event.stopPropagation();
                                onRunCase(item.id);
                              }}
                            >
                              运行
                            </Button>
                            <Button
                              danger
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={(event) => {
                                event.stopPropagation();
                                Modal.confirm({
                                  title: '删除用例',
                                  content: `确认删除用例「${item.name}」吗？该操作不可恢复。`,
                                  okText: '删除',
                                  okButtonProps: { danger: true },
                                  cancelText: '取消',
                                  onOk: () => onDeleteCase(item.id),
                                });
                              }}
                            />
                          </Space>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.target_url}</Text>
                        {item.description ? <Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Text> : null}
                        <Space wrap>
                          <Tag color={item.debug_mode ? 'purple' : 'default'}>{item.debug_mode ? '调试模式' : '标准模式'}</Tag>
                          <Tag>{item.auth_scheme}</Tag>
                          <Tag color="blue">步骤 {item.natural_language_steps?.length || 0}</Tag>
                          {item.last_run_at ? <Tag color="geekblue">最近执行 {formatTime(item.last_run_at)}</Tag> : null}
                        </Space>
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>

              <Card bordered={false} className="glass-panel">
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <Title level={4} className="section-title">任务队列</Title>
                    <Text className="section-desc">最近 30 条任务，支持快速切换查看详情。</Text>
                  </div>
                  <Tag color="blue">{tasks.length} 条</Tag>
                </Space>
                <List
                  dataSource={tasks}
                  locale={{ emptyText: '暂无任务' }}
                  renderItem={(item) => (
                    <List.Item
                      className={`task-list-item ${item.id === selectedTaskId ? 'active' : ''}`}
                      onClick={() => setSelectedTaskId(item.id)}
                    >
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Text strong>{item.name}</Text>
                          <Space size={6}>
                            <Badge status={(statusColorMap[item.status] as any) || 'default'} text={statusTextMap[item.status] || item.status} />
                            <Button
                              danger
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              disabled={item.status === 'running'}
                              onClick={(event) => {
                                event.stopPropagation();
                                Modal.confirm({
                                  title: '删除任务记录',
                                  content: `确认删除任务「${item.name}」吗？该操作不可恢复。`,
                                  okText: '删除',
                                  okButtonProps: { danger: true },
                                  cancelText: '取消',
                                  onOk: () => onDeleteTask(item.id),
                                });
                              }}
                            />
                          </Space>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.task_no}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.target_url}</Text>
                        <Space wrap>
                          <Tag color={item.debug_mode ? 'purple' : 'default'}>{item.debug_mode ? '调试模式' : '标准模式'}</Tag>
                          <Tag>{item.auth_scheme}</Tag>
                          {item.case_id ? <Tag color="geekblue">来源用例 #{item.case_id}</Tag> : <Tag>临时任务</Tag>}
                          {item.status === 'running' && <Tag color="orange">运行中不可删除</Tag>}
                        </Space>
                        <Progress percent={item.progress || 0} size="small" status={item.status === 'failed' ? 'exception' : undefined} />
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            </Space>
          </Col>

          <Col xs={24} xxl={15}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Card bordered={false} className="glass-panel">
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
                  <div>
                    <Title level={4} className="section-title">当前选中用例</Title>
                    <Text className="section-desc">查看当前选中的用例资产摘要，并支持一键加载到左侧编排器。</Text>
                  </div>
                  {selectedCase ? (
                    <Space wrap>
                      <Button icon={<FolderOpenOutlined />} onClick={() => onLoadCase(selectedCase.id)}>
                        加载到编排区
                      </Button>
                      <Button type="primary" icon={<RocketOutlined />} onClick={() => onRunCase(selectedCase.id)}>
                        按用例执行
                      </Button>
                    </Space>
                  ) : null}
                </Space>

                {!selectedCase ? (
                  <Empty description="请选择左侧用例查看摘要，或创建新的用例资产" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }} wrap>
                      <div>
                        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>{selectedCase.name}</Title>
                        <Space wrap size={8} style={{ marginTop: 10 }}>
                          <Tag color={selectedCase.debug_mode ? 'purple' : 'default'}>
                            {selectedCase.debug_mode ? 'DEBUG MODE' : 'STANDARD MODE'}
                          </Tag>
                          <Tag color="blue">{selectedCase.auth_scheme}</Tag>
                          <Badge
                            status={(statusColorMap[selectedCase.last_run_status || selectedCase.status] as any) || 'default'}
                            text={statusTextMap[selectedCase.last_run_status || selectedCase.status] || selectedCase.status}
                          />
                        </Space>
                      </div>
                      <Space wrap>
                        <Tag color="geekblue">用例 ID: {selectedCase.id}</Tag>
                        <Tag color="purple">步骤数：{selectedCase.natural_language_steps?.length || 0}</Tag>
                        {selectedCase.last_run_at ? <Tag color="cyan">最近执行：{formatTime(selectedCase.last_run_at)}</Tag> : null}
                      </Space>
                    </Space>

                    {selectedCase.description ? (
                      <Alert type="info" showIcon message="用例说明" description={selectedCase.description} style={{ borderRadius: 14 }} />
                    ) : null}

                    <div className="case-summary-grid">
                      <div className="case-summary-item">
                        <Text className="summary-label">目标站点</Text>
                        <Text strong>{selectedCase.target_url}</Text>
                      </div>
                      <div className="case-summary-item">
                        <Text className="summary-label">鉴权方案</Text>
                        <Text strong>{selectedCase.auth_scheme}</Text>
                      </div>
                      <div className="case-summary-item">
                        <Text className="summary-label">创建时间</Text>
                        <Text strong>{formatTime(selectedCase.created_at)}</Text>
                      </div>
                      <div className="case-summary-item">
                        <Text className="summary-label">最近更新时间</Text>
                        <Text strong>{formatTime(selectedCase.updated_at)}</Text>
                      </div>
                    </div>

                    <Space wrap>
                      {(selectedCase.tags || []).map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                      {!selectedCase.tags?.length ? <Text type="secondary">当前未设置标签</Text> : null}
                    </Space>

                    <Card size="small" style={{ borderRadius: 16 }}>
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Text strong>步骤摘要</Text>
                        {selectedCase.natural_language_steps?.length ? (
                          selectedCase.natural_language_steps.map((step, index) => (
                            <div key={`${selectedCase.id}-${index}`} style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fbff', border: '1px solid #dbe7f3' }}>
                              <Space wrap>
                                <Tag color="blue">#{index + 1}</Tag>
                                <Tag>{step.action || '未设置动作'}</Tag>
                                {step.target ? <Text>目标：{step.target}</Text> : null}
                                {step.value ? <Text>值：{step.value}</Text> : null}
                              </Space>
                            </div>
                          ))
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前用例还没有配置步骤" />
                        )}
                      </Space>
                    </Card>
                  </Space>
                )}
              </Card>

              <Spin spinning={detailLoading}>
                {!taskDetail ? (
                  <Card bordered={false} className="glass-panel" style={{ minHeight: 680, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Empty description="请选择左侧任务查看执行详情与调试证据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  </Card>
                ) : (
                  <Space direction="vertical" size={24} style={{ width: '100%' }}>
                    <Card bordered={false} className="glass-panel">
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }} wrap>
                          <div>
                            <Title level={3} style={{ margin: 0, color: '#0f172a' }}>{taskDetail.name}</Title>
                            <Space wrap size={8} style={{ marginTop: 10 }}>
                              <Text type="secondary">{taskDetail.task_no}</Text>
                              <Tag color="blue">{taskDetail.executor}</Tag>
                              <Tag color={taskDetail.debug_mode ? 'purple' : 'default'}>
                                {taskDetail.debug_mode ? 'DEBUG MODE' : 'STANDARD MODE'}
                              </Tag>
                              {taskDetail.case_id ? <Tag color="geekblue">用例 #{taskDetail.case_id}</Tag> : <Tag>临时任务</Tag>}
                              <Badge status={(statusColorMap[taskDetail.status] as any) || 'default'} text={statusTextMap[taskDetail.status] || taskDetail.status} />
                            </Space>
                          </div>
                          <Space wrap>
                            {(taskDetail.status === 'pending' || taskDetail.status === 'failed' || taskDetail.status === 'success') && (
                              <Button onClick={onStartTask} type="primary" icon={<RocketOutlined />}>
                                启动 / 重跑
                              </Button>
                            )}
                            {taskDetail.status === 'running' && (
                              <Button onClick={onPauseTask} icon={<PauseCircleOutlined />} style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#fff' }}>
                                暂停执行
                              </Button>
                            )}
                            {taskDetail.status === 'paused' && (
                              <Button onClick={onResumeTask} type="primary" icon={<PlayCircleOutlined />}>
                                恢复执行
                              </Button>
                            )}
                            <Button type="dashed" icon={<CodeOutlined />} onClick={onSolidifyTask}>
                              固化 Playwright 脚本
                            </Button>
                          </Space>
                        </Space>

                        <Progress percent={taskDetail.progress || 0} status={progressStatus as any} />

                        {!!taskDetail.error_message && (
                          <Alert
                            type="error"
                            showIcon
                            message="任务执行失败"
                            description={taskDetail.error_message}
                            style={{ borderRadius: 14 }}
                          />
                        )}

                        {taskDetail.status === 'failed' && (
                          <Alert
                            type="warning"
                            showIcon
                            message="失败原因摘要"
                            description={(
                              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                {debugFailureSummary.length ? (
                                  debugFailureSummary.map((line, index) => (
                                    <div key={`${index}-${line.slice(0, 20)}`}>
                                      <Text style={{ whiteSpace: 'pre-wrap' }}>{line}</Text>
                                    </div>
                                  ))
                                ) : (
                                  <Text>当前尚未提取到明确摘要，请查看下方时间线与调试证据。</Text>
                                )}
                                {taskDetail.debug_mode && (
                                  <Text type="secondary">
                                    调试模式下若任务失败，浏览器现场将尽量保留，便于直接观察失败页面。
                                  </Text>
                                )}
                              </Space>
                            )}
                            style={{ borderRadius: 14 }}
                          />
                        )}

                        <div className="detail-summary-grid">
                          <div className="detail-summary-item">
                            <Text className="summary-label">目标站点</Text>
                            <Text strong>{taskDetail.target_url}</Text>
                          </div>
                          <div className="detail-summary-item">
                            <Text className="summary-label">鉴权方案</Text>
                            <Text strong>{taskDetail.auth_scheme}</Text>
                          </div>
                          <div className="detail-summary-item">
                            <Text className="summary-label">开始时间</Text>
                            <Text strong>{formatTime(taskDetail.started_at || taskDetail.created_at)}</Text>
                          </div>
                          <div className="detail-summary-item">
                            <Text className="summary-label">结束时间</Text>
                            <Text strong>{formatTime(taskDetail.finished_at)}</Text>
                          </div>
                        </div>

                        <Space wrap>
                          {taskDetail.trace_artifact_name && <Tag color="cyan">trace: {taskDetail.trace_artifact_name}</Tag>}
                          {taskDetail.replay_script_name && <Tag color="geekblue">replay: {taskDetail.replay_script_name}</Tag>}
                          {failedStep && <Tag color="error">失败步骤：#{failedStep.step_index}</Tag>}
                          {latestDiagnosisArtifact && <Tag color="gold">已生成运行诊断</Tag>}
                          {latestSelectorDiagnosisArtifact && <Tag color="magenta">已生成选择器诊断</Tag>}
                          {latestRuntimeErrorArtifact && <Tag color="volcano">已生成错误工件</Tag>}
                          <Tag color="purple">步骤数：{taskDetail.step_logs?.length || 0}</Tag>
                          <Tag color="blue">工件数：{taskDetail.artifacts?.length || 0}</Tag>
                        </Space>
                      </Space>
                    </Card>

                    <Card bordered={false} className="terminal-card">
                      <Space style={{ marginBottom: 14 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
                        <Text style={{ color: '#94a3b8', marginLeft: 8, fontFamily: 'monospace' }}>Execution Timeline</Text>
                      </Space>
                      {taskDetail.step_logs?.length ? (
                        <div>
                          {taskDetail.step_logs.map((item) => (
                            <div key={item.id} className="terminal-log">
                              <Row gutter={12} align="top">
                                <Col flex="46px">
                                  <Text style={{ color: '#64748b', fontFamily: 'monospace' }}>[{item.step_index}]</Text>
                                </Col>
                                <Col flex="auto">
                                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{item.step_title}</div>
                                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>{item.detail || '等待执行日志写入...'}</div>
                                </Col>
                                <Col>
                                  <Badge status={(statusColorMap[item.status] as any) || 'default'} text={<span style={{ color: '#cbd5e1' }}>{statusTextMap[item.status] || item.status}</span>} />
                                </Col>
                              </Row>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#94a3b8' }}>暂无执行步骤日志</span>} />
                      )}
                    </Card>

                    <Card bordered={false} className="glass-panel">
                      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
                        <div>
                          <Title level={4} className="section-title">调试证据链</Title>
                          <Text className="section-desc">围绕任务执行过程输出截图、诊断、DOM 快照、Trace 与复现脚本。</Text>
                        </div>
                        <Tag color="blue">{taskDetail.artifacts?.length || 0} 个工件</Tag>
                      </Space>

                      {selectedArtifactGroups.length === 0 ? (
                        <Empty description="当前任务尚未产生证据工件" />
                      ) : (
                        <Space direction="vertical" size={20} style={{ width: '100%' }}>
                          {selectedArtifactGroups.map((section) => (
                            <div key={section.key}>
                              <Space direction="vertical" size={4} style={{ marginBottom: 12 }}>
                                <Space wrap>
                                  <Tag color={(artifactTypeColorMap[section.key] as any) || 'default'}>{section.title}</Tag>
                                  <Text type="secondary">{section.description}</Text>
                                </Space>
                              </Space>
                              <div className="artifact-grid">
                                {section.items.map((item) => (
                                  <div key={item.id} className="artifact-card">
                                    {renderArtifactPreview(item)}
                                    <div className="artifact-meta">
                                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                        <Space wrap>
                                          <Tag color={(artifactTypeColorMap[item.artifact_type] as any) || 'blue'} style={{ margin: 0 }}>
                                            {item.artifact_name}
                                          </Tag>
                                          <Text type="secondary" style={{ fontSize: 12 }}>{formatTime(item.created_at)}</Text>
                                        </Space>
                                        {renderArtifactHint(item)}
                                      </Space>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </Space>
                      )}
                    </Card>

                    <Card bordered={false} className="glass-panel">
                      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
                        <div>
                          <Title level={4} className="section-title">Playwright 脚本固化</Title>
                          <Text className="section-desc">将任务编排输出为可复用的 Playwright 脚本。</Text>
                        </div>
                        <Tag color="green">Code Export</Tag>
                      </Space>
                      {taskDetail.playwright_script ? (
                        <Paragraph copyable={{ text: taskDetail.playwright_script }}>
                          <pre className="script-box">{taskDetail.playwright_script}</pre>
                        </Paragraph>
                      ) : (
                        <Empty description="尚未生成固化脚本，点击上方“固化 Playwright 脚本”开始导出。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Card>
                  </Space>
                )}
              </Spin>
            </Space>
          </Col>
        </Row>
      </Space>

      <Modal
        title={<span><RobotOutlined style={{ color: '#2563eb', marginRight: 8 }} />AI 智能编排步骤</span>}
        open={aiModalVisible}
        onCancel={() => setAiModalVisible(false)}
        onOk={onGenerateSteps}
        okText="提交生成"
        confirmLoading={aiGenerating}
      >
        <Alert
          message="请用自然语言描述操作链路，系统会将其转为结构化 Playwright 执行步骤。"
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 12 }}
        />
        <TextArea
          rows={6}
          placeholder={'例如：\n1. 打开百度首页\n2. 点击搜索框\n3. 输入“上证指数”\n4. 点击搜索按钮\n5. 断言页面包含搜索结果'}
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default UiAutomation;
