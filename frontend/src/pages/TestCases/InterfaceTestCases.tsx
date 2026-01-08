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
  Collapse
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined,
  CopyOutlined,
  PlayCircleOutlined,
  CodeOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

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
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const InterfaceTestCases: React.FC = () => {
  const [testCases, setTestCases] = useState<InterfaceTestCase[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCase, setEditingCase] = useState<InterfaceTestCase | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [filterProtocol, setFilterProtocol] = useState<string>('');
  const [filterModule, setFilterModule] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [params, setParams] = useState<Record<string, any>>({});

  // 模拟数据
  useEffect(() => {
    const mockData: InterfaceTestCase[] = [
      {
        id: '1',
        name: '用户登录接口',
        description: '测试用户登录接口',
        protocol: 'HTTP',
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'Content-Type': 'application/json' },
        params: {},
        body: '{"username": "test", "password": "123456"}',
        assertions: 'status == 200 && response.token != null',
        module: '用户管理',
        priority: 'high',
        status: 'active',
        createdBy: '张三',
        createdAt: '2024-01-15',
        updatedAt: '2024-01-15'
      },
      {
        id: '2',
        name: '获取用户信息接口',
        description: '测试获取用户信息接口',
        protocol: 'HTTP',
        method: 'GET',
        url: '/api/user/info',
        headers: { 'Authorization': 'Bearer token' },
        params: { userId: '123' },
        body: '',
        assertions: 'status == 200 && response.data.id != null',
        module: '用户管理',
        priority: 'high',
        status: 'active',
        createdBy: '李四',
        createdAt: '2024-01-16',
        updatedAt: '2024-01-16'
      },
      {
        id: '3',
        name: 'TCP连接测试',
        description: '测试TCP连接',
        protocol: 'TCP',
        url: 'localhost:8080',
        headers: {},
        params: { timeout: 5000 },
        body: 'test message',
        assertions: 'response.contains("success")',
        module: '系统测试',
        priority: 'medium',
        status: 'active',
        createdBy: '王五',
        createdAt: '2024-01-17',
        updatedAt: '2024-01-17'
      }
    ];
    setTestCases(mockData);
  }, []);

  const columns: ColumnsType<InterfaceTestCase> = [
    {
      title: '用例名称',
      dataIndex: 'name',
      key: 'name',
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) => 
        record.name.toLowerCase().includes(value.toString().toLowerCase()),
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      render: (protocol: string) => {
        const color = protocol === 'HTTP' ? 'blue' : protocol === 'TCP' ? 'green' : 'orange';
        return <Tag color={color}>{protocol}</Tag>;
      },
      filters: [
        { text: 'HTTP', value: 'HTTP' },
        { text: 'TCP', value: 'TCP' },
        { text: 'MQ', value: 'MQ' },
      ],
      filteredValue: filterProtocol ? [filterProtocol] : null,
      onFilter: (value, record) => record.protocol === value,
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      render: (method: string) => method ? <Tag color="blue">{method}</Tag> : '-',
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      filters: [
        { text: '用户管理', value: '用户管理' },
        { text: '商品管理', value: '商品管理' },
        { text: '系统测试', value: '系统测试' },
      ],
      filteredValue: filterModule ? [filterModule] : null,
      onFilter: (value, record) => record.module === value,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => {
        const color = priority === 'high' ? 'red' : priority === 'medium' ? 'orange' : 'green';
        const text = priority === 'high' ? '高' : priority === 'medium' ? '中' : '低';
        return <Tag color={color}>{text}</Tag>;
      },
      filters: [
        { text: '高', value: 'high' },
        { text: '中', value: 'medium' },
        { text: '低', value: 'low' },
      ],
      onFilter: (value, record) => record.priority === value,
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
    setEditingCase(null);
    form.resetFields();
    setHeaders({});
    setParams({});
    setModalVisible(true);
  };

  const handleEdit = (record: InterfaceTestCase) => {
    setEditingCase(record);
    form.setFieldsValue(record);
    setHeaders(record.headers || {});
    setParams(record.params || {});
    setModalVisible(true);
  };

  const handleCopy = (record: InterfaceTestCase) => {
    const newCase = { ...record, id: Date.now().toString(), name: `${record.name} - 副本` };
    setTestCases([...testCases, newCase]);
    message.success('用例复制成功');
  };

  const handleExecute = (record: InterfaceTestCase) => {
    message.info(`执行测试用例: ${record.name}`);
  };

  const handleDelete = (record: InterfaceTestCase) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除测试用例 "${record.name}" 吗？`,
      onOk: () => {
        setTestCases(testCases.filter(item => item.id !== record.id));
        message.success('删除成功');
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const finalValues = {
        ...values,
        headers,
        params,
      };
      
      if (editingCase) {
        // 编辑
        setTestCases(testCases.map(item => 
          item.id === editingCase.id 
            ? { ...item, ...finalValues, updatedAt: new Date().toISOString().split('T')[0] }
            : item
        ));
        message.success('更新成功');
      } else {
        // 新增
        const newCase: InterfaceTestCase = {
          ...finalValues,
          id: Date.now().toString(),
          createdBy: '当前用户',
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
        };
        setTestCases([...testCases, newCase]);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      setHeaders({});
      setParams({});
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const addHeader = () => {
    const newKey = `header_${Date.now()}`;
    setHeaders({ ...headers, [newKey]: '' });
  };

  const updateHeader = (key: string, value: string) => {
    setHeaders({ ...headers, [key]: value });
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...headers };
    delete newHeaders[key];
    setHeaders(newHeaders);
  };

  const addParam = () => {
    const newKey = `param_${Date.now()}`;
    setParams({ ...params, [newKey]: '' });
  };

  const updateParam = (key: string, value: any) => {
    setParams({ ...params, [key]: value });
  };

  const removeParam = (key: string) => {
    const newParams = { ...params };
    delete newParams[key];
    setParams(newParams);
  };

  return (
    <div>
      <Title level={2}>
        <CodeOutlined /> 接口测试用例
      </Title>
      
      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="搜索用例名称"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="选择协议"
              style={{ width: '100%' }}
              allowClear
              value={filterProtocol}
              onChange={setFilterProtocol}
            >
              <Select.Option value="HTTP">HTTP</Select.Option>
              <Select.Option value="TCP">TCP</Select.Option>
              <Select.Option value="MQ">MQ</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="选择模块"
              style={{ width: '100%' }}
              allowClear
              value={filterModule}
              onChange={setFilterModule}
            >
              <Select.Option value="用户管理">用户管理</Select.Option>
              <Select.Option value="商品管理">商品管理</Select.Option>
              <Select.Option value="系统测试">系统测试</Select.Option>
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
        </Row>

        <Row style={{ marginBottom: 16 }}>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增用例
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={testCases}
          rowKey="id"
          pagination={{
            total: testCases.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title={editingCase ? '编辑接口测试用例' : '新增接口测试用例'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setHeaders({});
          setParams({});
        }}
        width={1000}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            protocol: 'HTTP',
            method: 'GET',
            priority: 'medium',
            status: 'active',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="用例名称"
                rules={[{ required: true, message: '请输入用例名称' }]}
              >
                <Input placeholder="请输入用例名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="protocol"
                label="协议类型"
                rules={[{ required: true, message: '请选择协议类型' }]}
              >
                <Select placeholder="请选择协议类型">
                  <Select.Option value="HTTP">HTTP</Select.Option>
                  <Select.Option value="TCP">TCP</Select.Option>
                  <Select.Option value="MQ">MQ</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="用例描述"
            rules={[{ required: true, message: '请输入用例描述' }]}
          >
            <TextArea rows={2} placeholder="请输入用例描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="url"
                label="接口地址"
                rules={[{ required: true, message: '请输入接口地址' }]}
              >
                <Input placeholder="请输入接口地址，如：/api/user/login" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="method"
                label="请求方法"
              >
                <Select placeholder="请选择请求方法">
                  <Select.Option value="GET">GET</Select.Option>
                  <Select.Option value="POST">POST</Select.Option>
                  <Select.Option value="PUT">PUT</Select.Option>
                  <Select.Option value="DELETE">DELETE</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="module"
                label="所属模块"
                rules={[{ required: true, message: '请选择所属模块' }]}
              >
                <Select placeholder="请选择所属模块">
                  <Select.Option value="用户管理">用户管理</Select.Option>
                  <Select.Option value="商品管理">商品管理</Select.Option>
                  <Select.Option value="系统测试">系统测试</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Collapse ghost>
            <Panel header="请求头配置" key="headers">
              <Space direction="vertical" style={{ width: '100%' }}>
                {Object.entries(headers).map(([key, value]) => (
                  <Row key={key} gutter={8}>
                    <Col span={8}>
                      <Input
                        placeholder="Header名称"
                        value={key}
                        onChange={(e) => {
                          const newHeaders = { ...headers };
                          delete newHeaders[key];
                          newHeaders[e.target.value] = value;
                          setHeaders(newHeaders);
                        }}
                      />
                    </Col>
                    <Col span={12}>
                      <Input
                        placeholder="Header值"
                        value={value}
                        onChange={(e) => updateHeader(key, e.target.value)}
                      />
                    </Col>
                    <Col span={4}>
                      <Button 
                        type="text" 
                        danger 
                        onClick={() => removeHeader(key)}
                      >
                        删除
                      </Button>
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={addHeader} style={{ width: '100%' }}>
                  添加请求头
                </Button>
              </Space>
            </Panel>

            <Panel header="请求参数" key="params">
              <Space direction="vertical" style={{ width: '100%' }}>
                {Object.entries(params).map(([key, value]) => (
                  <Row key={key} gutter={8}>
                    <Col span={8}>
                      <Input
                        placeholder="参数名"
                        value={key}
                        onChange={(e) => {
                          const newParams = { ...params };
                          delete newParams[key];
                          newParams[e.target.value] = value;
                          setParams(newParams);
                        }}
                      />
                    </Col>
                    <Col span={12}>
                      <Input
                        placeholder="参数值"
                        value={value}
                        onChange={(e) => updateParam(key, e.target.value)}
                      />
                    </Col>
                    <Col span={4}>
                      <Button 
                        type="text" 
                        danger 
                        onClick={() => removeParam(key)}
                      >
                        删除
                      </Button>
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={addParam} style={{ width: '100%' }}>
                  添加参数
                </Button>
              </Space>
            </Panel>
          </Collapse>

          <Form.Item
            name="body"
            label="请求体"
            style={{ marginTop: 16 }}
          >
            <TextArea rows={4} placeholder="请输入请求体内容（JSON格式）" />
          </Form.Item>

          <Form.Item
            name="assertions"
            label="断言规则"
            rules={[{ required: true, message: '请输入断言规则' }]}
          >
            <TextArea rows={3} placeholder="请输入断言规则，如：status == 200" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="优先级"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Select placeholder="请选择优先级">
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="low">低</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
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
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default InterfaceTestCases;