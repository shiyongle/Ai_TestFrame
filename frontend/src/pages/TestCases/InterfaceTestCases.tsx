import React, { useState, useEffect } from 'react';
import {
  Button,
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
  Space,
  List,
  Badge,
  Card,
  Tooltip,
  Divider,
  Empty
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  PlayCircleFilled,
  SaveOutlined,
  ApiOutlined,
  DeleteOutlined,
  CopyOutlined,
  HistoryOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  GlobalOutlined,
  SendOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface InterfaceTestCase {
  id: string;
  name: string;
  description: string;
  protocol: 'HTTP' | 'TCP' | 'MQ';
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, any>;
  body: string;
  assertions: string;
  module: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastRunTime?: string;
  lastRunStatus?: 'pass' | 'fail';
}

const InterfaceTestCases: React.FC = () => {
  const [testCases, setTestCases] = useState<InterfaceTestCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<InterfaceTestCase | null>(null);

  // Create Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  // Temporary State for Edit Panel
  const [activeTab, setActiveTab] = useState('params');
  const [requestUrl, setRequestUrl] = useState('');
  const [requestMethod, setRequestMethod] = useState('GET');
  const [requestParams, setRequestParams] = useState<any[]>([]);
  const [requestHeaders, setRequestHeaders] = useState<any[]>([]);
  const [requestBody, setRequestBody] = useState('');

  // Execution Simulation
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    // Mock Data
    const mockData: InterfaceTestCase[] = [
      {
        id: '1',
        name: 'Login API Test',
        description: 'Verify user login functionality',
        protocol: 'HTTP',
        method: 'POST',
        url: 'https://api.example.com/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        params: {},
        body: '{\n  "username": "admin",\n  "password": "password123"\n}',
        assertions: 'status === 200',
        module: 'Auth',
        priority: 'high',
        status: 'active',
        createdBy: 'Admin',
        createdAt: '2024-02-01',
        updatedAt: '2024-02-01',
        lastRunStatus: 'pass'
      },
      {
        id: '2',
        name: 'Get User Profile',
        description: 'Fetch current user details',
        protocol: 'HTTP',
        method: 'GET',
        url: 'https://api.example.com/v1/users/me',
        headers: { 'Authorization': 'Bearer {token}' },
        params: { 'include': 'roles' },
        body: '',
        assertions: 'status === 200 && body.id != null',
        module: 'User',
        priority: 'medium',
        status: 'active',
        createdBy: 'Admin',
        createdAt: '2024-02-02',
        updatedAt: '2024-02-02'
      }
    ];
    setTestCases(mockData);
    if (mockData.length > 0) handleSelectCase(mockData[0]);
  }, []);

  const handleSelectCase = (record: InterfaceTestCase) => {
    setSelectedCase(record);
    setRequestUrl(record.url);
    setRequestMethod(record.method || 'GET');
    setRequestBody(record.body || '');

    // Convert object to array for editable table feeling
    const pArr = Object.entries(record.params || {}).map(([k, v]) => ({ key: k, value: v, active: true }));
    setRequestParams(pArr.length ? pArr : [{ key: '', value: '', active: false }]);

    const hArr = Object.entries(record.headers || {}).map(([k, v]) => ({ key: k, value: v, active: true }));
    setRequestHeaders(hArr.length ? hArr : [{ key: '', value: '', active: false }]);

    setResponse(null);
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const newCase: InterfaceTestCase = {
        id: Date.now().toString(),
        name: values.name,
        module: values.module,
        protocol: values.protocol,
        method: values.method || 'GET',
        url: '',
        headers: {},
        params: {},
        body: '',
        assertions: '',
        description: '',
        priority: 'medium',
        status: 'active',
        createdBy: 'User',
        createdAt: dayjs().format('YYYY-MM-DD'),
        updatedAt: dayjs().format('YYYY-MM-DD')
      };
      setTestCases([...testCases, newCase]);
      setCreateModalVisible(false);
      createForm.resetFields();
      handleSelectCase(newCase);
      message.success('创建成功，请在右侧完善详情');
    } catch (e) { }
  };

  const handleSave = () => {
    if (!selectedCase) return;

    // Convert arrays back to objects
    const finalParams = requestParams.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {});

    const finalHeaders = requestHeaders.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {});

    const updatedCase = {
      ...selectedCase,
      url: requestUrl,
      method: requestMethod,
      body: requestBody,
      params: finalParams,
      headers: finalHeaders,
      updatedAt: dayjs().format('YYYY-MM-DD')
    };

    setTestCases(testCases.map(c => c.id === selectedCase.id ? updatedCase : c));
    setSelectedCase(updatedCase);
    message.success('保存成功');
  };

  const handleRun = () => {
    setLoading(true);
    // Simulate API Call
    setTimeout(() => {
      setLoading(false);
      setResponse({
        status: 200,
        time: '124ms',
        size: '1.2KB',
        body: {
          success: true,
          data: {
            id: 123,
            username: "test_user",
            roles: ["admin", "editor"]
          },
          message: "Operation successful"
        }
      });
      message.success('请求发送成功');
    }, 800);
  };

  const getMethodColor = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return '#007AFF';
      case 'POST': return '#34C759';
      case 'PUT': return '#FF9500';
      case 'DELETE': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  // Helper to render Key-Value inputs
  const renderKeyValueEditor = (
    data: any[],
    setData: (d: any[]) => void,
    placeholderKey = "Key",
    placeholderValue = "Value"
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((item, index) => (
        <div key={index} style={{ display: 'flex', gap: 8 }}>
          <Input
            placeholder={placeholderKey}
            value={item.key}
            onChange={(e) => {
              const newData = [...data];
              newData[index].key = e.target.value;
              if (index === data.length - 1 && e.target.value) newData.push({ key: '', value: '', active: false });
              setData(newData);
            }}
            style={{ flex: 1 }}
          />
          <Input
            placeholder={placeholderValue}
            value={item.value}
            onChange={(e) => {
              const newData = [...data];
              newData[index].value = e.target.value;
              setData(newData);
            }}
            style={{ flex: 1 }}
          />
          <Button
            icon={<DeleteOutlined />}
            type="text"
            danger
            disabled={data.length === 1 && !item.key}
            onClick={() => {
              const newData = data.filter((_, i) => i !== index);
              setData(newData.length ? newData : [{ key: '', value: '', active: false }]);
            }}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>接口测试</Title>
          <Text type="secondary">API 调试与自动化测试用例管理</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)} shape="round" size="large">
          新建接口用例
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 20, flex: 1, overflow: 'hidden' }}>

        {/* Left Sidebar: List */}
        <div className="glass-panel" style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <Input prefix={<SearchOutlined style={{ color: '#ccc' }} />} placeholder="搜索 API..." value={searchText} onChange={e => setSearchText(e.target.value)} bordered={false} style={{ background: '#f5f5f7', borderRadius: 8 }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {testCases.filter(t => t.name.toLowerCase().includes(searchText.toLowerCase())).map(t => (
              <div
                key={t.id}
                className="hover-bg"
                onClick={() => handleSelectCase(t)}
                style={{
                  padding: '12px',
                  borderRadius: 10,
                  marginBottom: 4,
                  cursor: 'pointer',
                  background: selectedCase?.id === t.id ? 'rgba(0,122,255,0.1)' : 'transparent',
                  borderLeft: selectedCase?.id === t.id ? '3px solid #007AFF' : '3px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 13, color: selectedCase?.id === t.id ? '#007AFF' : '#333' }} ellipsis>{t.name}</Text>
                  {t.lastRunStatus && (
                    <Badge status={t.lastRunStatus === 'pass' ? 'success' : 'error'} />
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: getMethodColor(t.method),
                    background: `${getMethodColor(t.method)}15`,
                    padding: '2px 6px', borderRadius: 4
                  }}>
                    {t.method}
                  </span>
                  <Text type="secondary" style={{ fontSize: 11 }} ellipsis>{t.url || 'No URL'}</Text>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Workspace */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
          {selectedCase ? (
            <>
              {/* Top Bar: Request Config */}
              <div style={{ padding: 20, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 12, alignItems: 'center', background: '#fafafa' }}>
                <Select
                  value={requestMethod}
                  onChange={setRequestMethod}
                  style={{ width: 110 }}
                  size="large"
                >
                  <Select.Option value="GET" style={{ color: '#007AFF' }}>GET</Select.Option>
                  <Select.Option value="POST" style={{ color: '#34C759' }}>POST</Select.Option>
                  <Select.Option value="PUT" style={{ color: '#FF9500' }}>PUT</Select.Option>
                  <Select.Option value="DELETE" style={{ color: '#FF3B30' }}>DELETE</Select.Option>
                </Select>
                <Input
                  size="large"
                  value={requestUrl}
                  onChange={e => setRequestUrl(e.target.value)}
                  placeholder="输入接口 URL"
                  prefix={<GlobalOutlined style={{ color: '#ccc' }} />}
                />
                <Button type="primary" size="large" icon={<SendOutlined />} onClick={handleRun} loading={loading}>
                  发送
                </Button>
                <Button size="large" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
              </div>

              {/* Main Content Area */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Request Editor */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '0 20px 20px 20px', borderRight: '1px solid #f0f0f0' }}>
                  <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginTop: 10 }}>
                    <TabPane tab="Params" key="params">
                      <div style={{ padding: '12px 0' }}>
                        <Title level={5} style={{ marginBottom: 16 }}>Query Parameters</Title>
                        {renderKeyValueEditor(requestParams, setRequestParams, "Key", "Value")}
                      </div>
                    </TabPane>
                    <TabPane tab="Headers" key="headers">
                      <div style={{ padding: '12px 0' }}>
                        <Title level={5} style={{ marginBottom: 16 }}>Request Headers</Title>
                        {renderKeyValueEditor(requestHeaders, setRequestHeaders, "Header", "Value")}
                      </div>
                    </TabPane>
                    <TabPane tab="Body" key="body">
                      <div style={{ padding: '12px 0', height: '100%' }}>
                        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                          <Text strong>Request Body (JSON)</Text>
                          <Button type="link" size="small" icon={<ApiOutlined />}>Format JSON</Button>
                        </div>
                        <TextArea
                          value={requestBody}
                          onChange={e => setRequestBody(e.target.value)}
                          rows={12}
                          style={{ fontFamily: 'Monaco, monospace', fontSize: 13, background: '#fbfbfb', border: '1px solid #e0e0e0', borderRadius: 8 }}
                          placeholder="{ ... }"
                        />
                      </div>
                    </TabPane>
                    <TabPane tab="Assertions" key="assertions">
                      <div style={{ padding: '12px 0' }}>
                        <Title level={5}>Test Predictions (断言)</Title>
                        <TextArea rows={6} placeholder="status === 200" style={{ fontFamily: 'monospace' }} />
                      </div>
                    </TabPane>
                  </Tabs>
                </div>

                {/* Response Viewer */}
                <div style={{ flex: 1, flexDirection: 'column', display: 'flex', background: '#fafafa' }}>
                  {response ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee', display: 'flex', gap: 16, alignItems: 'center' }}>
                        <Text strong style={{ color: response.status === 200 ? '#34C759' : '#FF3B30', fontSize: 16 }}>
                          {response.status} OK
                        </Text>
                        <Text type="secondary"><span style={{ fontSize: 12 }}>Time:</span> {response.time}</Text>
                        <Text type="secondary"><span style={{ fontSize: 12 }}>Size:</span> {response.size}</Text>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                        <pre style={{
                          fontSize: 12, lineHeight: 1.5, fontFamily: 'Monaco, monospace',
                          color: '#333', background: 'transparent'
                        }}>
                          {JSON.stringify(response.body, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#ccc' }}>
                      <ApiOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
                      <Text type="secondary">发送请求以查看响应</Text>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <Empty description="Select an API to start debugging" style={{ marginTop: 100 }} />
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        title="创建新接口用例"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => setCreateModalVisible(false)}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="用例名称" rules={[{ required: true }]}>
            <Input placeholder="输入用例名称" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="protocol" label="协议" initialValue="HTTP">
                <Select>
                  <Select.Option value="HTTP">HTTP</Select.Option>
                  <Select.Option value="TCP">TCP</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="method" label="默认方法" initialValue="GET">
                <Select>
                  <Select.Option value="GET">GET</Select.Option>
                  <Select.Option value="POST">POST</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="module" label="所属模块" initialValue="User">
            <Select>
              <Select.Option value="User">User</Select.Option>
              <Select.Option value="Auth">Auth</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InterfaceTestCases;