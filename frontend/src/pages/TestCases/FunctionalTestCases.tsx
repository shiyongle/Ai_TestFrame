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
  Tooltip
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined,
  CopyOutlined,
  PlayCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { TextArea } = Input;

interface FunctionalTestCase {
  id: string;
  name: string;
  description: string;
  module: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'inactive';
  steps: string;
  expectedResult: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const FunctionalTestCases: React.FC = () => {
  const [testCases, setTestCases] = useState<FunctionalTestCase[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCase, setEditingCase] = useState<FunctionalTestCase | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [filterModule, setFilterModule] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // 模拟数据
  useEffect(() => {
    const mockData: FunctionalTestCase[] = [
      {
        id: '1',
        name: '用户登录功能测试',
        description: '测试用户使用正确的用户名和密码登录系统',
        module: '用户管理',
        priority: 'high',
        status: 'active',
        steps: '1. 打开登录页面\n2. 输入正确的用户名\n3. 输入正确的密码\n4. 点击登录按钮',
        expectedResult: '成功登录系统，跳转到首页',
        createdBy: '张三',
        createdAt: '2024-01-15',
        updatedAt: '2024-01-15'
      },
      {
        id: '2',
        name: '用户注册功能测试',
        description: '测试新用户注册功能',
        module: '用户管理',
        priority: 'medium',
        status: 'active',
        steps: '1. 打开注册页面\n2. 填写用户信息\n3. 点击注册按钮',
        expectedResult: '注册成功，显示成功提示',
        createdBy: '李四',
        createdAt: '2024-01-16',
        updatedAt: '2024-01-16'
      },
      {
        id: '3',
        name: '商品搜索功能测试',
        description: '测试商品搜索功能',
        module: '商品管理',
        priority: 'high',
        status: 'active',
        steps: '1. 进入商品页面\n2. 输入搜索关键词\n3. 点击搜索按钮',
        expectedResult: '显示相关商品列表',
        createdBy: '王五',
        createdAt: '2024-01-17',
        updatedAt: '2024-01-17'
      }
    ];
    setTestCases(mockData);
  }, []);

  const columns: ColumnsType<FunctionalTestCase> = [
    {
      title: '用例名称',
      dataIndex: 'name',
      key: 'name',
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) => 
        record.name.toLowerCase().includes(value.toString().toLowerCase()),
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      filters: [
        { text: '用户管理', value: '用户管理' },
        { text: '商品管理', value: '商品管理' },
        { text: '订单管理', value: '订单管理' },
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
      title: '创建人',
      dataIndex: 'createdBy',
      key: 'createdBy',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
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
    setModalVisible(true);
  };

  const handleEdit = (record: FunctionalTestCase) => {
    setEditingCase(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleCopy = (record: FunctionalTestCase) => {
    const newCase = { ...record, id: Date.now().toString(), name: `${record.name} - 副本` };
    setTestCases([...testCases, newCase]);
    message.success('用例复制成功');
  };

  const handleExecute = (record: FunctionalTestCase) => {
    message.info(`执行测试用例: ${record.name}`);
  };

  const handleDelete = (record: FunctionalTestCase) => {
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
      if (editingCase) {
        // 编辑
        setTestCases(testCases.map(item => 
          item.id === editingCase.id 
            ? { ...item, ...values, updatedAt: new Date().toISOString().split('T')[0] }
            : item
        ));
        message.success('更新成功');
      } else {
        // 新增
        const newCase: FunctionalTestCase = {
          ...values,
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
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  return (
    <div>
      <Title level={2}>
        <FileTextOutlined /> 功能测试用例
      </Title>
      
      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="搜索用例名称"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="选择模块"
              style={{ width: '100%' }}
              allowClear
              value={filterModule}
              onChange={setFilterModule}
            >
              <Select.Option value="用户管理">用户管理</Select.Option>
              <Select.Option value="商品管理">商品管理</Select.Option>
              <Select.Option value="订单管理">订单管理</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
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
        title={editingCase ? '编辑测试用例' : '新增测试用例'}
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
            priority: 'medium',
            status: 'active',
          }}
        >
          <Form.Item
            name="name"
            label="用例名称"
            rules={[{ required: true, message: '请输入用例名称' }]}
          >
            <Input placeholder="请输入用例名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="用例描述"
            rules={[{ required: true, message: '请输入用例描述' }]}
          >
            <TextArea rows={3} placeholder="请输入用例描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="module"
                label="所属模块"
                rules={[{ required: true, message: '请选择所属模块' }]}
              >
                <Select placeholder="请选择所属模块">
                  <Select.Option value="用户管理">用户管理</Select.Option>
                  <Select.Option value="商品管理">商品管理</Select.Option>
                  <Select.Option value="订单管理">订单管理</Select.Option>
                </Select>
              </Form.Item>
            </Col>
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
          </Row>

          <Form.Item
            name="steps"
            label="测试步骤"
            rules={[{ required: true, message: '请输入测试步骤' }]}
          >
            <TextArea rows={4} placeholder="请输入测试步骤，每行一个步骤" />
          </Form.Item>

          <Form.Item
            name="expectedResult"
            label="预期结果"
            rules={[{ required: true, message: '请输入预期结果' }]}
          >
            <TextArea rows={3} placeholder="请输入预期结果" />
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
    </div>
  );
};

export default FunctionalTestCases;