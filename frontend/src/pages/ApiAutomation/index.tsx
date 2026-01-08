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
  Tabs,
  Tooltip,
  Tree,
  Upload,
  Drawer,
  Steps,
  Divider,
  Alert,
  Switch,
  InputNumber,
  Progress,
  Transfer,
  List,
  Avatar
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
  SyncOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { DirectoryTree } = Tree;

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
  };
}

const ApiAutomation: React.FC = () => {
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingScenario, setEditingScenario] = useState<TestScenario | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState('list');
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  
  // 用例编排相关状态
  const [testCaseModalVisible, setTestCaseModalVisible] = useState(false);
  const [availableTestCases, setAvailableTestCases] = useState<InterfaceTestCase[]>([]);
  const [selectedTestCases, setSelectedTestCases] = useState<InterfaceTestCase[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [stepConfigModalVisible, setStepConfigModalVisible] = useState(false);
  const [configuringStep, setConfiguringStep] = useState<ApiStep | null>(null);
  const [stepForm] = Form.useForm();

  // 模拟数据
  useEffect(() => {
    const mockScenarios: TestScenario[] = [
      {
        id: '1',
        name: '用户注册登录流程',
        description: '完整的用户注册和登录流程测试',
        category: 'api',
        steps: [
          {
            id: '1-1',
            name: '用户注册',
            method: 'POST',
            url: '/api/auth/register',
            headers: { 'Content-Type': 'application/json' },
            params: {},
            body: '{"username": "${username}", "password": "${password}"}', // eslint-disable-line no-template-curly-in-string
            assertions: 'status == 200 && response.userId != null',
            extractVariables: { userId: 'response.userId', token: 'response.token' },
            delay: 1000,
            enabled: true,
            testCaseId: 'tc-001',
            testCaseName: '用户注册接口'
          },
          {
            id: '1-2',
            name: '用户登录',
            method: 'POST',
            url: '/api/auth/login',
            headers: { 'Content-Type': 'application/json' },
            params: {},
            body: '{"username": "${username}", "password": "${password}"}', // eslint-disable-line no-template-curly-in-string
            assertions: 'status == 200 && response.token != null',
            extractVariables: { token: 'response.token' },
            delay: 500,
            enabled: true,
            testCaseId: 'tc-002',
            testCaseName: '用户登录接口'
          }
        ],
        globalVariables: {
          username: 'testuser',
          password: '123456'
        },
        settings: {
          timeout: 30000,
          retries: 3,
          parallel: false,
          thinkTime: 1000
        },
        status: 'active',
        createdBy: '张三',
        createdAt: '2024-01-15',
        updatedAt: '2024-01-15'
      }
    ];
    
    const mockTestCases: InterfaceTestCase[] = [
      {
        id: 'tc-001',
        name: '用户注册接口',
        description: '测试用户注册功能',
        protocol: 'HTTP',
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'Content-Type': 'application/json' },
        params: {},
        body: '{"username": "test", "password": "123456"}',
        assertions: 'status == 200 && response.userId != null',
        module: '用户管理',
        priority: 'high',
        status: 'active'
      },
      {
        id: 'tc-002',
        name: '用户登录接口',
        description: '测试用户登录功能',
        protocol: 'HTTP',
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'Content-Type': 'application/json' },
        params: {},
        body: '{"username": "test", "password": "123456"}',
        assertions: 'status == 200 && response.token != null',
        module: '用户管理',
        priority: 'high',
        status: 'active'
      },
      {
        id: 'tc-003',
        name: '获取用户信息接口',
        description: '测试获取用户信息功能',
        protocol: 'HTTP',
        method: 'GET',
        url: '/api/user/info',
        headers: { 'Authorization': 'Bearer token' },
        params: { userId: '123' },
        body: '',
        assertions: 'status == 200 && response.data.id != null',
        module: '用户管理',
        priority: 'high',
        status: 'active'
      },
      {
        id: 'tc-004',
        name: '获取商品列表接口',
        description: '测试获取商品列表功能',
        protocol: 'HTTP',
        method: 'GET',
        url: '/api/products',
        headers: { 'Authorization': 'Bearer token' },
        params: { page: 1, size: 10 },
        body: '',
        assertions: 'status == 200 && response.data.length > 0',
        module: '商品管理',
        priority: 'medium',
        status: 'active'
      },
      {
        id: 'tc-005',
        name: '添加购物车接口',
        description: '测试添加商品到购物车功能',
        protocol: 'HTTP',
        method: 'POST',
        url: '/api/cart/add',
        headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
        params: {},
        body: '{"productId": "123", "quantity": 1}',
        assertions: 'status == 200',
        module: '购物车管理',
        priority: 'medium',
        status: 'active'
      }
    ];
    
    setScenarios(mockScenarios);
    setAvailableTestCases(mockTestCases);
  }, []);

  const columns: ColumnsType<TestScenario> = [
    {
      title: '场景名称',
      dataIndex: 'name',
      key: 'name',
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) => 
        record.name.toLowerCase().includes(value.toString().toLowerCase()),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const color = category === 'api' ? 'blue' : category === 'performance' ? 'orange' : 'red';
        const text = category === 'api' ? 'API测试' : category === 'performance' ? '性能测试' : '安全测试';
        return <Tag color={color}>{text}</Tag>;
      },
      filters: [
        { text: 'API测试', value: 'api' },
        { text: '性能测试', value: 'performance' },
        { text: '安全测试', value: 'security' },
      ],
      filteredValue: filterCategory ? [filterCategory] : null,
      onFilter: (value, record) => record.category === value,
    },
    {
      title: '步骤数',
      key: 'steps',
      render: (_, record) => (
        <Tag color="green">{record.steps.length} 个步骤</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'active' ? 'green' : 'default';
        const text = status === 'active' ? '激活' : '停用';
        return <Tag color={color}>{text}</Tag>;
      },
      filters: [
        { text: '激活', value: 'active' },
        { text: '停用', value: 'inactive' },
      ],
      filteredValue: filterStatus ? [filterStatus] : null,
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '最后执行',
      key: 'lastExecution',
      render: (_, record) => {
        if (!record.lastExecution) return <Text type="secondary">未执行</Text>;
        
        const { status, duration, executedAt } = record.lastExecution;
        const statusIcon = status === 'success' ? 
          <CheckCircleOutlined style={{ color: '#52c41a' }} /> : 
          status === 'failed' ? 
          <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> : 
          <ClockCircleOutlined style={{ color: '#1890ff' }} />;
        
        return (
          <Space>
            {statusIcon}
            <Text>{duration}ms</Text>
            <Text type="secondary">{executedAt}</Text>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="查看详情">
            <Button 
              type="text" 
              icon={<BranchesOutlined />} 
              onClick={() => handleView(record)}
            />
          </Tooltip>
          <Tooltip title="用例编排">
            <Button 
              type="text" 
              icon={<SyncOutlined />} 
              onClick={() => handleArrangeTestCases(record)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => handleCopy(record)}
            />
          </Tooltip>
          <Tooltip title="执行">
            <Button 
              type="text" 
              icon={<PlayCircleOutlined />} 
              onClick={() => handleExecute(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleAdd = () => {
    setEditingScenario(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: TestScenario) => {
    setEditingScenario(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleView = (record: TestScenario) => {
    setSelectedScenario(record);
    setDrawerVisible(true);
  };

  const handleArrangeTestCases = (record: TestScenario) => {
    setEditingScenario(record);
    // 设置已选择的测试用例
    const selectedCaseIds = record.steps.map(step => step.testCaseId).filter((id): id is string => Boolean(id));
    setTargetKeys(selectedCaseIds);
    setSelectedTestCases(availableTestCases.filter(tc => selectedCaseIds.includes(tc.id)));
    setTestCaseModalVisible(true);
  };

  const handleTestCaseTransfer = (targetKeys: React.Key[], direction: 'left' | 'right', moveKeys: React.Key[]) => {
    const stringKeys = targetKeys as string[];
    setTargetKeys(stringKeys);
    const selected = availableTestCases.filter(tc => stringKeys.includes(tc.id));
    setSelectedTestCases(selected);
  };

  const handleSaveTestCaseArrangement = () => {
    if (!editingScenario) return;
    
    // 将选中的测试用例转换为步骤
    const newSteps: ApiStep[] = selectedTestCases.map((testCase, index) => ({
      id: `step-${Date.now()}-${index}`,
      name: testCase.name,
      method: testCase.method || 'GET',
      url: testCase.url,
      headers: testCase.headers,
      params: testCase.params,
      body: testCase.body,
      assertions: testCase.assertions,
      extractVariables: {},
      delay: 1000,
      enabled: true,
      testCaseId: testCase.id,
      testCaseName: testCase.name
    }));
    
    // 更新场景的步骤
    const updatedScenarios = scenarios.map(scenario => 
      scenario.id === editingScenario.id 
        ? { ...scenario, steps: newSteps, updatedAt: new Date().toISOString().split('T')[0] }
        : scenario
    );
    
    setScenarios(updatedScenarios);
    setTestCaseModalVisible(false);
    message.success('用例编排保存成功');
  };

  const handleStepConfig = (step: ApiStep) => {
    setConfiguringStep(step);
    stepForm.setFieldsValue({
      name: step.name,
      delay: step.delay,
      enabled: step.enabled,
      extractVariables: step.extractVariables
    });
    setStepConfigModalVisible(true);
  };

  const handleSaveStepConfig = async () => {
    if (!configuringStep || !editingScenario) return;
    
    try {
      const values = await stepForm.validateFields();
      
      const updatedScenarios = scenarios.map(scenario => 
        scenario.id === editingScenario.id 
          ? {
              ...scenario,
              steps: scenario.steps.map(step => 
                step.id === configuringStep.id 
                  ? { ...step, ...values }
                  : step
              )
            }
          : scenario
      );
      
      setScenarios(updatedScenarios);
      setStepConfigModalVisible(false);
      message.success('步骤配置保存成功');
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  

  const handleCopy = (record: TestScenario) => {
    const newScenario = { 
      ...record, 
      id: Date.now().toString(), 
      name: `${record.name} - 副本`,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    };
    setScenarios([...scenarios, newScenario]);
    message.success('场景复制成功');
  };

  const handleExecute = (record: TestScenario) => {
    setExecutionStatus('running');
    setExecutionProgress(0);
    
    // 模拟执行过程
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setExecutionProgress(progress);
      
      if (progress >= 100) {
        clearInterval(interval);
        setExecutionStatus('success');
        
        // 更新场景的最后执行信息
        setScenarios(scenarios.map(item => 
          item.id === record.id 
            ? { 
                ...item, 
                lastExecution: {
                  status: 'success',
                  duration: Math.floor(Math.random() * 5000) + 1000,
                  executedAt: new Date().toLocaleString()
                }
              }
            : item
        ));
        
        message.success('场景执行完成');
        setTimeout(() => {
          setExecutionStatus('idle');
          setExecutionProgress(0);
        }, 2000);
      }
    }, 200);
  };

  const handleDelete = (record: TestScenario) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除测试场景 "${record.name}" 吗？`,
      onOk: () => {
        setScenarios(scenarios.filter(item => item.id !== record.id));
        message.success('删除成功');
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingScenario) {
        // 编辑
        setScenarios(scenarios.map(item => 
          item.id === editingScenario.id 
            ? { ...item, ...values, updatedAt: new Date().toISOString().split('T')[0] }
            : item
        ));
        message.success('更新成功');
      } else {
        // 新增
        const newScenario: TestScenario = {
          ...values,
          id: Date.now().toString(),
          steps: [],
          globalVariables: {},
          settings: {
            timeout: 30000,
            retries: 3,
            parallel: false,
            thinkTime: 1000
          },
          createdBy: '当前用户',
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
        };
        setScenarios([...scenarios, newScenario]);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    const fileType = file.name.split('.').pop()?.toLowerCase();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      if (fileType === 'json') {
        parseJsonFile(content);
      } else if (fileType === 'jmx') {
        parseJmxFile(content);
      } else {
        message.error('不支持的文件格式，请上传 .json 或 .jmx 文件');
      }
    };
    
    reader.readAsText(file);
    return false; // 阻止默认上传行为
  };

  const parseJsonFile = (content: string) => {
    try {
      const data = JSON.parse(content);
      // 解析JSON文件为测试场景
      const scenario: TestScenario = {
        id: Date.now().toString(),
        name: data.name || '导入的场景',
        description: data.description || '从JSON文件导入',
        category: data.category || 'api',
        steps: data.steps || [],
        globalVariables: data.globalVariables || {},
        settings: data.settings || {
          timeout: 30000,
          retries: 3,
          parallel: false,
          thinkTime: 1000
        },
        status: 'active',
        createdBy: '导入用户',
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0]
      };
      
      setScenarios([...scenarios, scenario]);
      message.success('JSON文件导入成功');
      setImportModalVisible(false);
    } catch (error) {
      message.error('JSON文件格式错误');
    }
  };

  const parseJmxFile = (content: string) => {
    try {
      // 简化的JMX解析逻辑
      const scenario: TestScenario = {
        id: Date.now().toString(),
        name: 'JMX导入场景',
        description: '从JMX文件导入的测试场景',
        category: 'performance',
        steps: [],
        globalVariables: {},
        settings: {
          timeout: 30000,
          retries: 1,
          parallel: false,
          thinkTime: 1000
        },
        status: 'active',
        createdBy: '导入用户',
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0]
      };
      
      setScenarios([...scenarios, scenario]);
      message.success('JMX文件导入成功');
      setImportModalVisible(false);
    } catch (error) {
      message.error('JMX文件格式错误');
    }
  };

  const renderStepTree = (steps: ApiStep[]): DataNode[] => {
    return steps.map((step, index) => ({
      title: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <DragOutlined style={{ cursor: 'move', color: '#999' }} />
            <Tag color="blue">{step.method}</Tag>
            <Text>{step.name}</Text>
            {step.testCaseName && <Text type="secondary">({step.testCaseName})</Text>}
            <Text type="secondary" code>{step.url}</Text>
          </Space>
          <Space>
            <Tooltip title="配置步骤">
              <Button 
                type="text" 
                size="small" 
                icon={<SettingOutlined />} 
                onClick={() => handleStepConfig(step)}
              />
            </Tooltip>
            <Switch size="small" checked={step.enabled} />
            <Text type="secondary">{step.delay}ms</Text>
          </Space>
        </div>
      ),
      key: step.id,
      icon: <ApiOutlined />,
      children: step.extractVariables && Object.keys(step.extractVariables).length > 0 ? [
        {
          title: (
            <Space>
              <LinkOutlined />
              <Text>提取变量</Text>
            </Space>
          ),
          key: `${step.id}-extract`,
          children: Object.entries(step.extractVariables).map(([key, value]) => ({
            title: (
              <Space>
                <Text>${key}</Text>
                <Text type="secondary">←</Text>
                <Text code>{value}</Text>
              </Space>
            ),
            key: `${step.id}-extract-${key}`,
            isLeaf: true
          }))
        }
      ] : undefined
    }));
  };

  return (
    <div>
      <Title level={2}>
        <ThunderboltOutlined /> 接口自动化测试
      </Title>
      
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="场景管理" key="list">
          <Card>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12} md={6}>
                <Input
                  placeholder="搜索场景名称"
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="选择类型"
                  style={{ width: '100%' }}
                  allowClear
                  value={filterCategory}
                  onChange={setFilterCategory}
                >
                  <Select.Option value="api">API测试</Select.Option>
                  <Select.Option value="performance">性能测试</Select.Option>
                  <Select.Option value="security">安全测试</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="选择状态"
                  style={{ width: '100%' }}
                  allowClear
                  value={filterStatus}
                  onChange={setFilterStatus}
                >
                  <Select.Option value="active">激活</Select.Option>
                  <Select.Option value="inactive">停用</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Space>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    新建场景
                  </Button>
                  <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
                    导入场景
                  </Button>
                </Space>
              </Col>
            </Row>

            {executionStatus === 'running' && (
              <Alert
                message="场景执行中"
                description={
                  <Progress percent={executionProgress} status="active" />
                }
                type="info"
                style={{ marginBottom: 16 }}
              />
            )}

            <Table
              columns={columns}
              dataSource={scenarios}
              rowKey="id"
              pagination={{
                total: scenarios.length,
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          </Card>
        </TabPane>
        
        <TabPane tab="执行历史" key="history">
          <Card>
            <Alert
              message="执行历史"
              description="这里显示所有测试场景的执行历史记录，包括执行时间、结果、耗时等信息。"
              type="info"
              showIcon
            />
          </Card>
        </TabPane>
        
        <TabPane tab="性能监控" key="monitor">
          <Card>
            <Alert
              message="性能监控"
              description="这里显示接口自动化测试的性能监控数据，包括响应时间、吞吐量、错误率等指标。"
              type="info"
              showIcon
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* 新建/编辑场景弹窗 */}
      <Modal
        title={editingScenario ? '编辑测试场景' : '新建测试场景'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            category: 'api',
            status: 'active',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="场景名称"
                rules={[{ required: true, message: '请输入场景名称' }]}
              >
                <Input placeholder="请输入场景名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="category"
                label="场景类型"
                rules={[{ required: true, message: '请选择场景类型' }]}
              >
                <Select placeholder="请选择场景类型">
                  <Select.Option value="api">API测试</Select.Option>
                  <Select.Option value="performance">性能测试</Select.Option>
                  <Select.Option value="security">安全测试</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="场景描述"
            rules={[{ required: true, message: '请输入场景描述' }]}
          >
            <TextArea rows={3} placeholder="请输入场景描述" />
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Select.Option value="active">激活</Select.Option>
              <Select.Option value="inactive">停用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 场景详情抽屉 */}
      <Drawer
        title={selectedScenario?.name}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={800}
      >
        {selectedScenario && (
          <div>
            <Paragraph>{selectedScenario.description}</Paragraph>
            
            <Divider>执行步骤</Divider>
            <DirectoryTree
              treeData={renderStepTree(selectedScenario.steps)}
              defaultExpandAll
            />
            
            <Divider>全局变量</Divider>
            <pre>{JSON.stringify(selectedScenario.globalVariables, null, 2)}</pre>
            
            <Divider>执行设置</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Text>超时时间: {selectedScenario.settings.timeout}ms</Text>
              </Col>
              <Col span={12}>
                <Text>重试次数: {selectedScenario.settings.retries}</Text>
              </Col>
              <Col span={12}>
                <Text>并行执行: {selectedScenario.settings.parallel ? '是' : '否'}</Text>
              </Col>
              <Col span={12}>
                <Text>思考时间: {selectedScenario.settings.thinkTime}ms</Text>
              </Col>
            </Row>
          </div>
        )}
      </Drawer>

      {/* 导入场景弹窗 */}
      <Modal
        title="导入测试场景"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
      >
        <Alert
          message="支持文件格式"
          description="支持 .json 和 .jmx 格式的文件导入。JSON文件应包含场景配置信息，JMX文件将转换为性能测试场景。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Upload.Dragger
          accept=".json,.jmx"
          beforeUpload={handleImport}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48 }} />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 .json 和 .jmx 格式文件</p>
        </Upload.Dragger>
      </Modal>

      {/* 用例编排弹窗 */}
      <Modal
        title="编排测试用例"
        open={testCaseModalVisible}
        onOk={handleSaveTestCaseArrangement}
        onCancel={() => setTestCaseModalVisible(false)}
        width={1000}
        okText="保存编排"
        cancelText="取消"
      >
        <Alert
          message="用例编排说明"
          description="从左侧选择接口测试用例，拖拽到右侧进行编排。右侧的用例将按顺序执行，支持参数关联和变量传递。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Transfer
          dataSource={availableTestCases.map(tc => ({
            key: tc.id,
            title: tc.name,
            description: `${tc.description} | ${tc.protocol} | ${tc.method || 'GET'} | ${tc.module}`
          }))}
          targetKeys={targetKeys}
          onChange={handleTestCaseTransfer}
          render={item => (
            <List.Item style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
              <List.Item.Meta
                avatar={<Avatar icon={<ApiOutlined />} />}
                title={item.title}
                description={
                  <Space direction="vertical" size="small">
                    <Text type="secondary">{item.description.split(' | ')[0]}</Text>
                    <Space>
                      <Tag color="blue">{item.description.split(' | ')[1]}</Tag>
                      <Tag color="green">{item.description.split(' | ')[2]}</Tag>
                      <Tag color="orange">{item.description.split(' | ')[3]}</Tag>
                    </Space>
                  </Space>
                }
              />
            </List.Item>
          )}
          listStyle={{
            width: 450,
            height: 400,
          }}
          titles={['可用测试用例', '已选择的用例']}
          showSearch
        />
        
        {selectedTestCases.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Title level={5}>执行顺序预览</Title>
            <List
              size="small"
              bordered
              dataSource={selectedTestCases}
              renderItem={(item, index) => (
                <List.Item>
                  <Space>
                    <Text strong>{index + 1}.</Text>
                    <Text>{item.name}</Text>
                    <Text type="secondary">→</Text>
                    <Text code>{item.url}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        )}
      </Modal>

      {/* 步骤配置弹窗 */}
      <Modal
        title="配置步骤"
        open={stepConfigModalVisible}
        onOk={handleSaveStepConfig}
        onCancel={() => setStepConfigModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        {configuringStep && (
          <Form
            form={stepForm}
            layout="vertical"
          >
            <Form.Item
              name="name"
              label="步骤名称"
              rules={[{ required: true, message: '请输入步骤名称' }]}
            >
              <Input placeholder="请输入步骤名称" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="delay"
                  label="延迟时间 (ms)"
                  rules={[{ required: true, message: '请输入延迟时间' }]}
                >
                  <InputNumber
                    min={0}
                    max={60000}
                    style={{ width: '100%' }}
                    placeholder="延迟时间"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="enabled"
                  label="启用状态"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="extractVariables"
              label="提取变量"
            >
              <TextArea
                rows={4}
                placeholder="请输入提取变量配置，格式：&#10;变量名: response.fieldName&#10;例如：&#10;userId: response.data.userId&#10;token: response.data.token"
              />
            </Form.Item>

            <Alert
              message="变量提取说明"
              description="从接口响应中提取变量，用于后续接口使用。格式为 '变量名: 响应路径'，每行一个配置。"
              type="info"
              showIcon
            />
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ApiAutomation;