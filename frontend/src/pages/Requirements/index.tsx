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
  Transfer,
  List,
  Avatar,
  Drawer,
  Divider,
  Alert,
  InputNumber,
  DatePicker,
  Steps,
  Timeline,
  Badge
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined,
  CopyOutlined,
  LinkOutlined,
  FileTextOutlined,
  CodeOutlined,
  BugOutlined,
  UserOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import moment from 'moment';
import { projectApi, requirementApi } from '../../services/api';
import { Project } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Step } = Steps;

interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'draft' | 'review' | 'approved' | 'development' | 'testing' | 'completed' | 'rejected';
  type: 'functional' | 'non-functional' | 'constraint' | 'assumption';
  projectId: string;
  projectName: string;
  assignedTo: string;
  reporter: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  acceptanceCriteria: string;
  businessValue: string;
  tags: string[];
  attachments: string[];
  comments: Comment[];
  linkedTestCases: LinkedTestCase[];
  linkedFunctionalTestCases: number;
  linkedInterfaceTestCases: number;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface LinkedTestCase {
  id: string;
  name: string;
  type: 'functional' | 'interface';
  status: string;
}

// Project interface is now imported from types

interface FunctionalTestCase {
  id: string;
  name: string;
  description: string;
  module: string;
  priority: string;
  status: string;
}

interface InterfaceTestCase {
  id: string;
  name: string;
  description: string;
  protocol: string;
  method: string;
  module: string;
  priority: string;
  status: string;
}

const Requirements: React.FC = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [functionalTestCases, setFunctionalTestCases] = useState<FunctionalTestCase[]>([]);
  const [interfaceTestCases, setInterfaceTestCases] = useState<InterfaceTestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [activeTab, setActiveTab] = useState('list');
  const [linkType, setLinkType] = useState<'functional' | 'interface'>('functional');
  const [targetKeys, setTargetKeys] = useState<string[]>([]);

  // 加载真实项目数据
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await projectApi.getProjects();
      setProjects(data || []);
    } catch (error) {
      message.error('加载项目列表失败');
      console.error(error);
      // 如果API调用失败，使用模拟数据作为后备
      const mockProjects: Project[] = [
        { id: 1, name: '电商平台', description: '在线购物平台', created_at: '', updated_at: '' },
        { id: 2, name: '用户管理系统', description: '用户权限管理系统', created_at: '', updated_at: '' },
        { id: 3, name: '订单管理系统', description: '订单处理系统', created_at: '', updated_at: '' }
      ];
      setProjects(mockProjects);
    }
  };

  const loadRequirements = async () => {
    setLoading(true);
    try {
      const data = await requirementApi.getRequirements();
      // 转换后端数据格式为前端所需格式
      const formattedRequirements = data.map((req: any) => ({
        id: req.id.toString(),
        title: req.title,
        description: req.description,
        priority: req.priority,
        status: req.status,
        type: req.type,
        projectId: req.project_id.toString(),
        projectName: projects.find(p => p.id === req.project_id)?.name || '',
        assignedTo: req.assigned_to || '',
        reporter: req.reporter || '',
        createdAt: req.created_at ? new Date(req.created_at).toISOString().split('T')[0] : '',
        updatedAt: req.updated_at ? new Date(req.updated_at).toISOString().split('T')[0] : '',
        dueDate: req.due_date ? new Date(req.due_date).toISOString().split('T')[0] : undefined,
        estimatedHours: req.estimated_hours,
        actualHours: req.actual_hours,
        acceptanceCriteria: req.acceptance_criteria || '',
        businessValue: req.business_value || '',
        tags: req.tags || [],
        attachments: req.attachments || [],
        comments: req.comments || [],
        linkedTestCases: req.linked_test_cases || [],
        linkedFunctionalTestCases: req.linked_functional_test_cases || 0,
        linkedInterfaceTestCases: req.linked_interface_test_cases || 0
      }));
      setRequirements(formattedRequirements);
    } catch (error) {
      message.error('加载需求列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 当项目数据加载完成后，加载需求数据
  useEffect(() => {
    if (projects.length > 0) {
      loadRequirements();
    }
  }, [projects]);

  // 模拟测试用例数据（暂时保留，后续可以从API获取）
  useEffect(() => {
    const mockFunctionalTestCases: FunctionalTestCase[] = [
      { id: 'ft-1', name: '用户注册测试用例', description: '测试用户注册流程', module: '用户管理', priority: 'high', status: 'active' },
      { id: 'ft-2', name: '商品搜索测试', description: '测试商品搜索功能', module: '商品管理', priority: 'medium', status: 'active' },
      { id: 'ft-3', name: '订单创建测试', description: '测试订单创建流程', module: '订单管理', priority: 'high', status: 'active' }
    ];

    const mockInterfaceTestCases: InterfaceTestCase[] = [
      { id: 'it-1', name: '注册接口测试', description: '测试用户注册API', protocol: 'HTTP', method: 'POST', module: '用户管理', priority: 'high', status: 'active' },
      { id: 'it-2', name: '搜索接口测试', description: '测试商品搜索API', protocol: 'HTTP', method: 'GET', module: '商品管理', priority: 'medium', status: 'active' },
      { id: 'it-3', name: '订单接口测试', description: '测试订单API', protocol: 'HTTP', method: 'POST', module: '订单管理', priority: 'high', status: 'active' }
    ];

    setFunctionalTestCases(mockFunctionalTestCases);
    setInterfaceTestCases(mockInterfaceTestCases);
  }, []);

  const columns: ColumnsType<Requirement> = [
    {
      title: '需求标题',
      dataIndex: 'title',
      key: 'title',
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) => 
        record.title.toLowerCase().includes(value.toString().toLowerCase()),
    },
    {
      title: '项目',
      dataIndex: 'projectName',
      key: 'projectName',
      filters: projects.map(p => ({ text: p.name, value: p.id.toString() })),
      filteredValue: filterProject ? [filterProject] : null,
      onFilter: (value, record) => record.projectId === value.toString(),
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
      filteredValue: filterPriority ? [filterPriority] : null,
      onFilter: (value, record) => record.priority === value,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          draft: { color: 'default', text: '草稿' },
          review: { color: 'processing', text: '审核中' },
          approved: { color: 'success', text: '已批准' },
          development: { color: 'warning', text: '开发中' },
          testing: { color: 'processing', text: '测试中' },
          completed: { color: 'success', text: '已完成' },
          rejected: { color: 'error', text: '已拒绝' }
        };
        const config = statusConfig[status as keyof typeof statusConfig];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
      filters: [
        { text: '草稿', value: 'draft' },
        { text: '审核中', value: 'review' },
        { text: '已批准', value: 'approved' },
        { text: '开发中', value: 'development' },
        { text: '测试中', value: 'testing' },
        { text: '已完成', value: 'completed' },
        { text: '已拒绝', value: 'rejected' },
      ],
      filteredValue: filterStatus ? [filterStatus] : null,
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeConfig = {
          functional: { color: 'blue', text: '功能性' },
          'non-functional': { color: 'purple', text: '非功能性' },
          constraint: { color: 'orange', text: '约束' },
          assumption: { color: 'cyan', text: '假设' }
        };
        const config = typeConfig[type as keyof typeof typeConfig];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '负责人',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      render: (text: string) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <Text>{text}</Text>
        </Space>
      ),
    },
    {
      title: '关联测试用例',
      key: 'linkedTestCases',
      render: (_, record) => (
        <Space>
          <Badge count={record.linkedFunctionalTestCases} showZero>
            <Tag color="blue" icon={<FileTextOutlined />}>功能</Tag>
          </Badge>
          <Badge count={record.linkedInterfaceTestCases} showZero>
            <Tag color="green" icon={<CodeOutlined />}>接口</Tag>
          </Badge>
        </Space>
      ),
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
          <Tooltip title="关联测试用例">
            <Button 
              type="text" 
              icon={<LinkOutlined />} 
              onClick={() => handleLinkTestCases(record)}
            />
          </Tooltip>
          <Tooltip title="查看详情">
            <Button 
              type="text" 
              icon={<BugOutlined />} 
              onClick={() => handleView(record)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => handleCopy(record)}
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
    setEditingRequirement(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Requirement) => {
    setEditingRequirement(record);
    form.setFieldsValue({
      ...record,
      dueDate: record.dueDate ? moment(record.dueDate) : undefined
    });
    setModalVisible(true);
  };

  const handleView = (record: Requirement) => {
    setSelectedRequirement(record);
    setDrawerVisible(true);
  };

  const handleCopy = async (record: Requirement) => {
    try {
      // 获取原始需求数据
      const originalRequirement = await requirementApi.getRequirement(parseInt(record.id));
      
      // 创建副本数据
      const copyData = {
        title: `${originalRequirement.title} - 副本`,
        description: originalRequirement.description,
        priority: originalRequirement.priority,
        status: 'draft', // 副本重置为草稿状态
        type: originalRequirement.type,
        project_id: originalRequirement.project_id,
        assigned_to: originalRequirement.assigned_to,
        reporter: originalRequirement.reporter,
        due_date: originalRequirement.due_date,
        estimated_hours: originalRequirement.estimated_hours,
        acceptance_criteria: originalRequirement.acceptance_criteria,
        business_value: originalRequirement.business_value,
        tags: originalRequirement.tags || [],
        attachments: [],
        comments: [],
        linked_test_cases: [],
        linked_functional_test_cases: 0,
        linked_interface_test_cases: 0
      };
      
      await requirementApi.createRequirement(copyData);
      message.success('需求复制成功');
      loadRequirements(); // 重新加载数据
    } catch (error) {
      console.error('复制失败:', error);
      message.error('复制失败，请重试');
    }
  };

  const handleDelete = (record: Requirement) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除需求 "${record.title}" 吗？`,
      onOk: async () => {
        try {
          await requirementApi.deleteRequirement(parseInt(record.id));
          message.success('删除成功');
          loadRequirements(); // 重新加载数据
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败，请重试');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // 格式化数据以匹配后端API
      const formattedData = {
        title: values.title,
        description: values.description,
        priority: values.priority,
        status: values.status,
        type: values.type,
        project_id: parseInt(values.projectId),
        assigned_to: values.assignedTo,
        reporter: values.reporter,
        due_date: values.dueDate ? values.dueDate.toDate() : null,
        estimated_hours: values.estimatedHours,
        actual_hours: values.actualHours,
        acceptance_criteria: values.acceptanceCriteria,
        business_value: values.businessValue,
        tags: values.tags || [],
        attachments: [],
        comments: [],
        linked_test_cases: [],
        linked_functional_test_cases: 0,
        linked_interface_test_cases: 0
      };
      
      if (editingRequirement) {
        // 编辑
        await requirementApi.updateRequirement(parseInt(editingRequirement.id), formattedData);
        message.success('更新成功');
      } else {
        // 新增
        await requirementApi.createRequirement(formattedData);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      form.resetFields();
      loadRequirements(); // 重新加载数据
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败，请重试');
    }
  };

  const handleLinkTestCases = (record: Requirement) => {
    setSelectedRequirement(record);
    setLinkModalVisible(true);
    setLinkType('functional');
    setTargetKeys([]);
  };

  const handleTestCaseTransfer = (targetKeys: React.Key[]) => {
    setTargetKeys(targetKeys as string[]);
  };

  const handleLinkTypeChange = (activeKey: string) => {
    setLinkType(activeKey as 'functional' | 'interface');
    setTargetKeys([]); // 切换类型时清空已选择的用例
  };

  const handleSaveLinkTestCases = async () => {
    if (!selectedRequirement) return;

    try {
      const linkData = {
        functional_count: linkType === 'functional' ? targetKeys.length : selectedRequirement.linkedFunctionalTestCases,
        interface_count: linkType === 'interface' ? targetKeys.length : selectedRequirement.linkedInterfaceTestCases,
        test_cases: targetKeys.map(id => ({
          id,
          name: linkType === 'functional' 
            ? functionalTestCases.find(tc => tc.id === id)?.name
            : interfaceTestCases.find(tc => tc.id === id)?.name,
          type: linkType,
          status: 'active'
        }))
      };

      await requirementApi.linkTestCases(parseInt(selectedRequirement.id), linkData);
      message.success('测试用例关联成功');
      setLinkModalVisible(false);
      loadRequirements(); // 重新加载数据
    } catch (error) {
      console.error('关联失败:', error);
      message.error('关联失败，请重试');
    }
  };

  const getStatusSteps = (status: string) => {
    const statusMap = {
      draft: 0,
      review: 1,
      approved: 2,
      development: 3,
      testing: 4,
      completed: 5
    };
    return statusMap[status as keyof typeof statusMap] || 0;
  };

  return (
    <div>
      <Title level={2}>
        <FileSearchOutlined /> 需求管理
      </Title>
      
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="需求列表" key="list">
          <Card>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12} md={6}>
                <Input
                  placeholder="搜索需求标题"
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="选择项目"
                  style={{ width: '100%' }}
                  allowClear
                  value={filterProject}
                  onChange={setFilterProject}
                >
                  {projects.map(p => (
                    <Select.Option key={p.id} value={p.id.toString()}>
                      {p.name}
                    </Select.Option>
                  ))}
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
                  <Select.Option value="draft">草稿</Select.Option>
                  <Select.Option value="review">审核中</Select.Option>
                  <Select.Option value="approved">已批准</Select.Option>
                  <Select.Option value="development">开发中</Select.Option>
                  <Select.Option value="testing">测试中</Select.Option>
                  <Select.Option value="completed">已完成</Select.Option>
                  <Select.Option value="rejected">已拒绝</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="选择优先级"
                  style={{ width: '100%' }}
                  allowClear
                  value={filterPriority}
                  onChange={setFilterPriority}
                >
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="low">低</Select.Option>
                </Select>
              </Col>
            </Row>

            <Row style={{ marginBottom: 16 }}>
              <Col>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                  新建需求
                </Button>
              </Col>
            </Row>

            <Table
              columns={columns}
              dataSource={requirements}
              rowKey="id"
              loading={loading}
              pagination={{
                total: requirements.length,
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          </Card>
        </TabPane>
        
        <TabPane tab="需求统计" key="statistics">
          <Card>
            <Alert
              message="需求统计"
              description="这里显示需求的统计分析信息，包括按状态、优先级、项目等维度的统计数据。"
              type="info"
              showIcon
            />
          </Card>
        </TabPane>
        
        <TabPane tab="需求跟踪" key="tracking">
          <Card>
            <Alert
              message="需求跟踪"
              description="这里显示需求的跟踪信息，包括需求变更记录、状态变更历史、关联关系等。"
              type="info"
              showIcon
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* 新建/编辑需求弹窗 */}
      <Modal
        title={editingRequirement ? '编辑需求' : '新建需求'}
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
            status: 'draft',
            type: 'functional',
            estimatedHours: 0
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="需求标题"
                rules={[{ required: true, message: '请输入需求标题' }]}
              >
                <Input placeholder="请输入需求标题" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="projectId"
                label="所属项目"
                rules={[{ required: true, message: '请选择所属项目' }]}
              >
                <Select placeholder="请选择所属项目">
                  {projects.map(p => (
                    <Select.Option key={p.id} value={p.id.toString()}>
                      {p.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="需求描述"
            rules={[{ required: true, message: '请输入需求描述' }]}
          >
            <TextArea rows={3} placeholder="请输入需求描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={6}>
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
            <Col span={6}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select placeholder="请选择状态">
                  <Select.Option value="draft">草稿</Select.Option>
                  <Select.Option value="review">审核中</Select.Option>
                  <Select.Option value="approved">已批准</Select.Option>
                  <Select.Option value="development">开发中</Select.Option>
                  <Select.Option value="testing">测试中</Select.Option>
                  <Select.Option value="completed">已完成</Select.Option>
                  <Select.Option value="rejected">已拒绝</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="type"
                label="需求类型"
                rules={[{ required: true, message: '请选择需求类型' }]}
              >
                <Select placeholder="请选择需求类型">
                  <Select.Option value="functional">功能性</Select.Option>
                  <Select.Option value="non-functional">非功能性</Select.Option>
                  <Select.Option value="constraint">约束</Select.Option>
                  <Select.Option value="assumption">假设</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="assignedTo"
                label="负责人"
                rules={[{ required: true, message: '请输入负责人' }]}
              >
                <Input placeholder="请输入负责人" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="dueDate"
                label="截止日期"
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择截止日期" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="estimatedHours"
                label="预估工时"
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="请输入预估工时"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="reporter"
                label="报告人"
                rules={[{ required: true, message: '请输入报告人' }]}
              >
                <Input placeholder="请输入报告人" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="acceptanceCriteria"
            label="验收标准"
            rules={[{ required: true, message: '请输入验收标准' }]}
          >
            <TextArea rows={4} placeholder="请输入验收标准" />
          </Form.Item>

          <Form.Item
            name="businessValue"
            label="业务价值"
            rules={[{ required: true, message: '请输入业务价值' }]}
          >
            <TextArea rows={3} placeholder="请输入业务价值" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 关联测试用例弹窗 */}
      <Modal
        title="关联测试用例"
        open={linkModalVisible}
        onOk={handleSaveLinkTestCases}
        onCancel={() => setLinkModalVisible(false)}
        width={1000}
        okText="保存关联"
        cancelText="取消"
      >
        <Tabs activeKey={linkType} onChange={handleLinkTypeChange}>
          <TabPane tab="功能测试用例" key="functional">
            <Transfer
              dataSource={functionalTestCases.map(tc => ({
                key: tc.id,
                title: tc.name,
                description: `${tc.description} | ${tc.module} | ${tc.priority} | ${tc.status}`
              }))}
              targetKeys={targetKeys}
              onChange={handleTestCaseTransfer}
              render={item => (
                <List.Item style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                  <List.Item.Meta
                    avatar={<Avatar icon={<FileTextOutlined />} />}
                    title={item.title}
                    description={
                      <Space direction="vertical" size="small">
                        <Text type="secondary">{item.description.split(' | ')[0]}</Text>
                        <Space>
                          <Tag color="blue">{item.description.split(' | ')[1]}</Tag>
                          <Tag color="orange">{item.description.split(' | ')[2]}</Tag>
                          <Tag color="green">{item.description.split(' | ')[3]}</Tag>
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
          </TabPane>
          
          <TabPane tab="接口测试用例" key="interface">
            <Transfer
              dataSource={interfaceTestCases.map(tc => ({
                key: tc.id,
                title: tc.name,
                description: `${tc.description} | ${tc.protocol} | ${tc.method} | ${tc.module}`
              }))}
              targetKeys={targetKeys}
              onChange={handleTestCaseTransfer}
              render={item => (
                <List.Item style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                  <List.Item.Meta
                    avatar={<Avatar icon={<CodeOutlined />} />}
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
          </TabPane>
        </Tabs>
      </Modal>

      {/* 需求详情抽屉 */}
      <Drawer
        title={selectedRequirement?.title}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={800}
      >
        {selectedRequirement && (
          <div>
            <Paragraph>{selectedRequirement.description}</Paragraph>
            
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Text strong>优先级：</Text>
                <Tag color={selectedRequirement.priority === 'high' ? 'red' : selectedRequirement.priority === 'medium' ? 'orange' : 'green'}>
                  {selectedRequirement.priority === 'high' ? '高' : selectedRequirement.priority === 'medium' ? '中' : '低'}
                </Tag>
              </Col>
              <Col span={12}>
                <Text strong>状态：</Text>
                <Steps size="small" current={getStatusSteps(selectedRequirement.status)} style={{ marginTop: 8 }}>
                  <Step title="草稿" />
                  <Step title="审核" />
                  <Step title="批准" />
                  <Step title="开发" />
                  <Step title="测试" />
                  <Step title="完成" />
                </Steps>
              </Col>
            </Row>

            <Divider>验收标准</Divider>
            <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
              {selectedRequirement.acceptanceCriteria}
            </pre>

            <Divider>业务价值</Divider>
            <Paragraph>{selectedRequirement.businessValue}</Paragraph>

            <Divider>关联测试用例</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Title level={5}>功能测试用例 ({selectedRequirement.linkedFunctionalTestCases})</Title>
                <List
                  size="small"
                  dataSource={selectedRequirement.linkedTestCases.filter(tc => tc.type === 'functional')}
                  renderItem={item => (
                    <List.Item>
                      <Space>
                        <FileTextOutlined />
                        <Text>{item.name}</Text>
                        <Tag color="blue">{item.status}</Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              </Col>
              <Col span={12}>
                <Title level={5}>接口测试用例 ({selectedRequirement.linkedInterfaceTestCases})</Title>
                <List
                  size="small"
                  dataSource={selectedRequirement.linkedTestCases.filter(tc => tc.type === 'interface')}
                  renderItem={item => (
                    <List.Item>
                      <Space>
                        <CodeOutlined />
                        <Text>{item.name}</Text>
                        <Tag color="green">{item.status}</Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              </Col>
            </Row>

            <Divider>评论</Divider>
            <Timeline>
              {selectedRequirement.comments.map(comment => (
                <Timeline.Item key={comment.id}>
                  <Text strong>{comment.author}</Text>
                  <Text type="secondary"> - {comment.createdAt}</Text>
                  <br />
                  <Text>{comment.content}</Text>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Requirements;