import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  message,
  Typography,
  Row,
  Col,
  Tooltip,
  Tree,
  Upload,
  Drawer,
  Divider,
  Alert,
  Switch,
  InputNumber,
  Progress,
  Transfer,
  List,
  Avatar,
  Menu,
  Timeline,
  Statistic,
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CopyOutlined,
  PlayCircleOutlined,
  ApiOutlined,
  LinkOutlined,
  UploadOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DragOutlined,
  SyncOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  DashboardOutlined,
  FileTextOutlined,
  RocketOutlined,
  CodeOutlined,
  SafetyCertificateOutlined,
  InboxOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { DirectoryTree } = Tree;
const { Dragger } = Upload;

// --- Interfaces ---

interface ApiStep {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, any>;
  body: string;
  assertions: string;
  extractVariables: Record<string, string>;
  delay: number;
  enabled: boolean;
  testCaseId?: string;
  testCaseName?: string;
}

interface InterfaceTestCase {
  id: string;
  name: string;
  description: string;
  protocol: 'HTTP' | 'TCP' | 'MQ';
  method?: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, any>;
  body: string;
  assertions: string;
  module: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'inactive';
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  category: 'api' | 'performance' | 'security';
  steps: ApiStep[];
  globalVariables: Record<string, any>;
  settings: {
    timeout: number;
    retries: number;
    parallel: boolean;
    thinkTime: number;
  };
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastExecution?: {
    status: 'success' | 'failed' | 'running';
    duration: number;
    executedAt: string;
    passRate: number;
  };
}

interface ExecutionRecord {
  id: string;
  scenarioName: string;
  status: 'success' | 'failed';
  startTime: string;
  duration: string;
  trigger: string;
}

// --- Main Component ---

const ApiAutomation: React.FC = () => {
  const [activeSection, setActiveSection] = useState('scenarios');
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [history, setHistory] = useState<ExecutionRecord[]>([]);

  // Modals & Drawers
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingScenario, setEditingScenario] = useState<TestScenario | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);

  // Forms & Filters
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  // Execution Simulation
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');

  // Orchestration & Steps
  const [testCaseModalVisible, setTestCaseModalVisible] = useState(false);
  const [availableTestCases, setAvailableTestCases] = useState<InterfaceTestCase[]>([]);
  const [selectedTestCases, setSelectedTestCases] = useState<InterfaceTestCase[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [stepConfigModalVisible, setStepConfigModalVisible] = useState(false);
  const [configuringStep, setConfiguringStep] = useState<ApiStep | null>(null);
  const [stepForm] = Form.useForm();

  // Mock Data Initialization
  useEffect(() => {
    // Mock Scenarios
    const mockScenarios: TestScenario[] = [
      {
        id: '1',
        name: '用户注册登录全流程',
        description: '覆盖用户注册、激活、登录及获取Token的完整业务闭环',
        category: 'api',
        steps: Array(5).fill(null).map((_, i) => ({
          id: `step-${i}`, name: `Step ${i + 1}`, method: 'POST', url: '/api/test',
          headers: {}, params: {}, body: '', assertions: '', extractVariables: {}, delay: 0, enabled: true
        })),
        globalVariables: { env: 'stage' },
        settings: { timeout: 30000, retries: 3, parallel: false, thinkTime: 1000 },
        status: 'active',
        createdBy: 'Admin',
        createdAt: '2024-02-10',
        updatedAt: '2024-02-11',
        lastExecution: { status: 'success', duration: 1240, executedAt: '10 mins ago', passRate: 100 }
      },
      {
        id: '2',
        name: '订单创建性能测试',
        description: '高并发下的订单创建接口响应时间测试',
        category: 'performance',
        steps: [],
        globalVariables: {},
        settings: { timeout: 10000, retries: 0, parallel: true, thinkTime: 0 },
        status: 'active',
        createdBy: 'Li',
        createdAt: '2024-02-09',
        updatedAt: '2024-02-09',
        lastExecution: { status: 'failed', duration: 5400, executedAt: '2 hours ago', passRate: 85 }
      }
    ];
    setScenarios(mockScenarios);

    // Mock History
    setHistory([
      { id: '1', scenarioName: '用户注册登录全流程', status: 'success', startTime: '2024-02-11 14:30:00', duration: '1.2s', trigger: 'Manual' },
      { id: '2', scenarioName: '订单创建性能测试', status: 'failed', startTime: '2024-02-11 12:00:00', duration: '5.4s', trigger: 'CI/CD' },
      { id: '3', scenarioName: '商品搜索接口回归', status: 'success', startTime: '2024-02-10 09:15:00', duration: '0.8s', trigger: 'Scheduled' },
      { id: '4', scenarioName: '支付网关集成测试', status: 'success', startTime: '2024-02-09 18:20:00', duration: '2.1s', trigger: 'Manual' },
    ]);

    // Mock TestCases for Selection
    setAvailableTestCases([
      { id: 'tc1', name: 'Login', description: 'User Login', protocol: 'HTTP', method: 'POST', url: '/auth/login', headers: {}, params: {}, body: '{}', assertions: '', module: 'Auth', priority: 'high', status: 'active' },
      { id: 'tc2', name: 'Get Profile', description: 'User Profile', protocol: 'HTTP', method: 'GET', url: '/user/me', headers: {}, params: {}, body: '', assertions: '', module: 'User', priority: 'medium', status: 'active' },
      { id: 'tc3', name: 'Create Order', description: 'Order Creation', protocol: 'HTTP', method: 'POST', url: '/orders', headers: {}, params: {}, body: '{}', assertions: '', module: 'Order', priority: 'high', status: 'active' },
    ]);
  }, []);

  // --- Handlers ---

  const handleExecute = (record: TestScenario) => {
    setExecutionStatus('running');
    setExecutionProgress(0);
    message.loading({ content: `正在执行场景: ${record.name}`, key: 'executing' });

    let p = 0;
    const interval = setInterval(() => {
      p += 20;
      setExecutionProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setExecutionStatus('success');
        message.success({ content: '执行完成', key: 'executing' });
        setTimeout(() => setExecutionStatus('idle'), 2000);

        // Update Mock History
        const newRecord: ExecutionRecord = {
          id: Date.now().toString(),
          scenarioName: record.name,
          status: 'success',
          startTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          duration: `${(Math.random() * 2).toFixed(1)}s`,
          trigger: 'Manual'
        };
        setHistory([newRecord, ...history]);
      }
    }, 400);
  };

  const handleSaveScenario = async () => {
    try {
      const values = await form.validateFields();
      const newScenario = {
        ...editingScenario,
        ...values,
        id: editingScenario ? editingScenario.id : Date.now().toString(),
        steps: editingScenario?.steps || [],
        settings: editingScenario?.settings || { timeout: 30000, retries: 3 },
        createdAt: editingScenario?.createdAt || dayjs().format('YYYY-MM-DD'),
        updatedAt: dayjs().format('YYYY-MM-DD')
      };

      if (editingScenario) {
        setScenarios(scenarios.map(s => s.id === editingScenario.id ? newScenario : s));
        message.success('更新成功');
      } else {
        setScenarios([newScenario, ...scenarios]);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
    } catch (e) { }
  };

  // --- Renderers ---

  const renderScenarioList = () => (
    <div className="fade-in">
      {/* Toolbar */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="middle">
          <Input
            placeholder="搜索场景..."
            prefix={<SearchOutlined style={{ color: '#ccc' }} />}
            style={{ width: 240, borderRadius: 8 }}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          <Select placeholder="类型" style={{ width: 120 }} allowClear>
            <Select.Option value="api">API</Select.Option>
            <Select.Option value="performance">性能</Select.Option>
          </Select>
        </Space>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>导入</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingScenario(null); setModalVisible(true); }}>新建场景</Button>
        </Space>
      </div>

      {/* Progress Bar for Running Execution */}
      {executionStatus === 'running' && (
        <div style={{ marginBottom: 16, background: '#e6f7ff', padding: '12px 24px', borderRadius: 8, border: '1px solid #91d5ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text strong style={{ color: '#1890ff' }}><RocketOutlined spin /> 场景执行中...</Text>
            <Text type="secondary">{executionProgress}%</Text>
          </div>
          <Progress percent={executionProgress} showInfo={false} strokeColor="#1890ff" size="small" />
        </div>
      )}

      {/* Table */}
      <Table
        className="glass-table"
        columns={[
          {
            title: '场景名称', dataIndex: 'name', key: 'name',
            render: (text, record) => (
              <Space>
                <Avatar shape="square" icon={<FileTextOutlined />} style={{ background: record.category === 'api' ? '#e6f7ff' : '#fff7e6', color: record.category === 'api' ? '#1890ff' : '#fa8c16' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{text}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{record.description}</div>
                </div>
              </Space>
            )
          },
          {
            title: '类型', dataIndex: 'category', key: 'category', width: 100,
            render: (cat) => cat === 'api' ? <Tag color="blue">API Automation</Tag> : <Tag color="orange">Performance</Tag>
          },
          {
            title: '步骤数', dataIndex: 'steps', key: 'steps', width: 100,
            render: (steps) => <Badge count={steps.length} showZero color="#eb2f96" />
          },
          {
            title: '上次执行', key: 'lastExecution', width: 250,
            render: (_, record) => record.lastExecution ? (
              <Space size="middle">
                <Tag color={record.lastExecution.status === 'success' ? 'success' : 'error'} icon={record.lastExecution.status === 'success' ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}>
                  {record.lastExecution.status.toUpperCase()}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>{record.lastExecution.executedAt}</Text>
              </Space>
            ) : <Text type="secondary">-</Text>
          },
          {
            title: '操作', key: 'action', width: 200, align: 'right',
            render: (_, record) => (
              <Space className="table-actions">
                <Tooltip title="执行"><Button type="text" icon={<PlayCircleOutlined />} onClick={() => handleExecute(record)} /></Tooltip>
                <Tooltip title="编排"><Button type="text" icon={<BranchesOutlined />} onClick={() => { setEditingScenario(record); setTestCaseModalVisible(true); }} /></Tooltip>
                <Tooltip title="详情"><Button type="text" icon={<SettingOutlined />} onClick={() => { setSelectedScenario(record); setDrawerVisible(true); }} /></Tooltip>
                <Tooltip title="删除"><Button type="text" danger icon={<DeleteOutlined />} /></Tooltip>
              </Space>
            )
          }
        ]}
        dataSource={scenarios.filter(s => s.name.includes(searchText))}
        rowKey="id"
        pagination={{ pageSize: 8 }}
      />
    </div>
  );

  const renderHistory = () => (
    <div className="fade-in" style={{ padding: 24, maxWidth: 800 }}>
      <Timeline mode="left">
        {history.map(item => (
          <Timeline.Item
            key={item.id}
            color={item.status === 'success' ? 'green' : 'red'}
            label={<Text type="secondary">{item.startTime}</Text>}
          >
            <Card size="small" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong style={{ fontSize: 16 }}>{item.scenarioName}</Text>
                  <div style={{ marginTop: 4 }}>
                    <Tag>{item.trigger}</Tag>
                    <Text type="secondary">Duration: {item.duration}</Text>
                  </div>
                </div>
                {item.status === 'success' ?
                  <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} /> :
                  <ExclamationCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                }
              </div>
            </Card>
          </Timeline.Item>
        ))}
      </Timeline>
    </div>
  );

  const renderMonitor = () => (
    <div className="fade-in">
      <Row gutter={[24, 24]}>
        <Col span={6}>
          <Card bordered={false} className="stat-card">
            <Statistic title="Total Requests" value={18934} prefix={<ApiOutlined />} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className="stat-card">
            <Statistic title="Avg Response Time" value={234} suffix="ms" prefix={<ClockCircleOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className="stat-card">
            <Statistic title="Error Rate" value={1.2} suffix="%" prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className="stat-card">
            <Statistic title="Active Scenarios" value={12} prefix={<RunningOutlinedIcon />} />
          </Card>
        </Col>
      </Row>
      <Card title="Performance Trends (Mock)" style={{ marginTop: 24 }} bordered={false}>
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 8 }}>
          <Text type="secondary">Chart Visualization Placeholder (RPS / Latency)</Text>
        </div>
      </Card>
    </div>
  );

  const RunningOutlinedIcon = () => <RocketOutlined />;

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700 }}>接口自动化</Title>
        <Text type="secondary">测试场景编排、执行与监控一体化平台</Text>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>

        {/* Sidebar Menu */}
        <div style={{ width: 240, borderRight: '1px solid #f0f0f0', background: '#fafafa', padding: '16px 0' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeSection]}
            onClick={({ key }) => setActiveSection(key)}
            style={{ background: 'transparent', border: 'none' }}
          >
            <Menu.Item key="scenarios" icon={<AppstoreOutlined />}>场景管理</Menu.Item>
            <Menu.Item key="history" icon={<HistoryOutlined />}>执行历史</Menu.Item>
            <Menu.Item key="monitor" icon={<DashboardOutlined />}>性能监控</Menu.Item>
          </Menu>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {activeSection === 'scenarios' && renderScenarioList()}
          {activeSection === 'history' && renderHistory()}
          {activeSection === 'monitor' && renderMonitor()}
        </div>

      </div>

      {/* Edit/Create Modal */}
      <Modal
        title={editingScenario ? "编辑场景" : "新建场景"}
        open={modalVisible}
        onOk={handleSaveScenario}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="场景名称" rules={[{ required: true }]}>
            <Input placeholder="输入名称" />
          </Form.Item>
          <Form.Item name="category" label="类型" initialValue="api">
            <Select>
              <Select.Option value="api">API Automation</Select.Option>
              <Select.Option value="performance">Performance Test</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title="导入场景"
        open={importModalVisible}
        footer={null}
        onCancel={() => setImportModalVisible(false)}
      >
        <Dragger style={{ padding: 32 }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件到此区域</p>
          <p className="ant-upload-hint">支持 .json / .jmx 格式文件</p>
        </Dragger>
      </Modal>

      {/* Orchestration Modal */}
      <Modal
        title="编排测试用例"
        open={testCaseModalVisible}
        width={900}
        onCancel={() => setTestCaseModalVisible(false)}
        onOk={() => { message.success('编排已保存'); setTestCaseModalVisible(false); }}
      >
        <Transfer
          dataSource={availableTestCases.map(tc => ({ key: tc.id, title: tc.name, description: tc.url }))}
          titles={['可用用例', '已选步骤']}
          targetKeys={targetKeys}
          onChange={keys => setTargetKeys(keys as string[])}
          render={item => item.title}
          listStyle={{ width: 400, height: 400 }}
          showSearch
        />
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedScenario?.name}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        <Divider orientation="left">基本信息</Divider>
        <p><Text type="secondary">ID: </Text> {selectedScenario?.id}</p>
        <p><Text type="secondary">Description: </Text> {selectedScenario?.description}</p>

        <Divider orientation="left">测试步骤</Divider>
        <Timeline>
          {selectedScenario?.steps?.length ? selectedScenario.steps.map(s => (
            <Timeline.Item key={s.id} dot={<ApiOutlined />}>
              <Text strong>{s.name}</Text>
              <div style={{ fontSize: 12, color: '#999' }}>{s.method} {s.url}</div>
            </Timeline.Item>
          )) : <Text type="secondary">暂无步骤</Text>}
        </Timeline>
      </Drawer>
    </div>
  );
};

export default ApiAutomation;