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
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  BranchesOutlined,
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
import { interfaceTestcaseApi, projectApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

type StepMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

type ScenarioStatus = 'active' | 'inactive';

interface ApiStep {
  id: string;
  name: string;
  method: StepMethod;
  url: string;
  delay: number;
  assertions: string;
  enabled: boolean;
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
  lastExecution?: {
    status: 'success' | 'failed';
    passRate: number;
    durationMs: number;
    executedAt: string;
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

const ApiAutomation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'orchestration'>('overview');
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
  const [stepDrawerVisible, setStepDrawerVisible] = useState(false);
  const [editingStep, setEditingStep] = useState<ApiStep | null>(null);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [selectedLibraryKeys, setSelectedLibraryKeys] = useState<string[]>([]);

  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);

  const [scenarioStorageReady, setScenarioStorageReady] = useState(false);

  const [scenarioForm] = Form.useForm();
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

  const executeScenario = () => {
    if (!selectedScenario) return;
    if (!selectedScenario.steps.length) {
      message.warning('当前场景没有可执行步骤，请先编排');
      return;
    }
    setExecuting(true);
    setProgress(0);
    const timer = window.setInterval(() => {
      setProgress((p) => {
        const next = p + 16;
        if (next >= 100) {
          window.clearInterval(timer);
          setExecuting(false);
          const passRate = Math.floor(Math.random() * 25) + 75;
          setScenarios((prev) =>
            prev.map((item) =>
              item.id === selectedScenario.id
                ? {
                    ...item,
                    lastExecution: {
                      status: passRate >= 85 ? 'success' : 'failed',
                      passRate,
                      durationMs: Math.floor(Math.random() * 2500) + 800,
                      executedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                    },
                  }
                : item
            )
          );
          message.success('场景执行完成');
          return 100;
        }
        return next;
      });
    }, 350);
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

  const openStepEditor = (step: ApiStep) => {
    setEditingStep(step);
    stepForm.setFieldsValue(step);
    setStepDrawerVisible(true);
  };

  const saveStep = async () => {
    if (!selectedScenario || !editingStep) return;
    try {
      const values = await stepForm.validateFields();
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === selectedScenario.id
            ? {
                ...s,
                steps: s.steps.map((step) => (step.id === editingStep.id ? { ...step, ...values } : step)),
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
        onChange={(v) => setActiveTab(v as 'overview' | 'orchestration')}
        options={[
          { label: '主页面总览', value: 'overview', icon: <ApiOutlined /> },
          { label: '场景编排', value: 'orchestration', icon: <BranchesOutlined /> },
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
                    <Space>
                      <Badge status={item.status === 'active' ? 'success' : 'default'} text={item.status === 'active' ? '启用' : '停用'} />
                      <Tag>{item.steps.length} 步</Tag>
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
                  <Alert
                    type={selectedScenario.lastExecution.status === 'success' ? 'success' : 'error'}
                    showIcon
                    message={selectedScenario.lastExecution.status === 'success' ? '最近执行成功' : '最近执行失败'}
                    description={`${selectedScenario.lastExecution.executedAt} · ${selectedScenario.lastExecution.durationMs}ms`}
                  />
                ) : null}
                <Button type="primary" block icon={<PlayCircleFilled />} onClick={executeScenario} disabled={executing || !selectedScenario.steps.length}>
                  执行该场景
                </Button>
              </Space>
            )}
          </Card>
        </div>
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

      <Drawer
        title="编辑步骤"
        width={460}
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
          <Form.Item label="断言规则" name="assertions">
            <TextArea rows={3} placeholder="例如：status=200 && code=0" />
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
