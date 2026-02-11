import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  message,
  Drawer,
  Divider,
  List,
  Collapse,
  Badge,
  Tooltip,
  Typography
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  StopOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  CodeOutlined,
  MoreOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';

const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;
const { Title, Text } = Typography;

interface RuleTemplate {
  id: number;
  name: string;
  category: string;
  protocol: string;
  description: string;
  is_enabled: boolean;
  priority: number;
  rule_count: number;
  created_at: string;
  updated_at: string;
}

interface AssertionRule {
  id?: number;
  assertion_type: string;
  field_path: string;
  operator: string;
  expected_value: string;
  error_message: string;
}

interface RuleDefinition {
  id?: number;
  rule_type: string;
  rule_config: any;
  execution_order: number;
  is_required: boolean;
  assertions: AssertionRule[];
}

const RuleConfig: React.FC = () => {
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RuleTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [form] = Form.useForm();
  const [ruleDefinitions, setRuleDefinitions] = useState<RuleDefinition[]>([]);

  const API_BASE_URL = 'http://localhost:8000/api/v1';

  // Mock Data for Demo (If API fails or is empty during UI Dev)
  const mockTemplates: RuleTemplate[] = [
    { id: 1, name: 'HTTP Status Check', category: 'correctness', protocol: 'http', description: 'Ensure response status is 200 OK', is_enabled: true, priority: 10, rule_count: 1, created_at: '2024-02-01', updated_at: '2024-02-01' },
    { id: 2, name: 'SLA Response Time', category: 'performance', protocol: 'http', description: 'Response time must be under 500ms', is_enabled: true, priority: 5, rule_count: 1, created_at: '2024-02-02', updated_at: '2024-02-02' },
    { id: 3, name: 'Security Headers', category: 'security', protocol: 'http', description: 'Check for security headers presence', is_enabled: false, priority: 8, rule_count: 3, created_at: '2024-02-03', updated_at: '2024-02-03' },
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      // Try fetching from API
      const response = await axios.get(`${API_BASE_URL}/rules/templates`);
      if (response.data.success) {
        setTemplates(response.data.data);
      } else {
        setTemplates(mockTemplates); // Fallback
      }
    } catch (error) {
      // message.error('Failed to fetch templates, using mock data');
      setTemplates(mockTemplates); // Fallback
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateDetail = async (id: number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/rules/templates/${id}`);
      if (response.data.success) {
        setSelectedTemplate(response.data.data);
      } else {
        // Mock Detail
        setSelectedTemplate({
          ...mockTemplates.find(t => t.id === id),
          rule_definitions: []
        });
      }
      setIsDetailVisible(true);
    } catch (error) {
      // Only show error if we can't show anything
      setSelectedTemplate({
        ...mockTemplates.find(t => t.id === id),
        rule_definitions: []
      });
      setIsDetailVisible(true);
    }
  };

  const handleAdd = () => {
    setEditingTemplate(null);
    setRuleDefinitions([]);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: RuleTemplate) => {
    setEditingTemplate(record);
    // In a real app we'd fetch details to populate the form fully including definitions
    // For now just basic fields
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个规则模板吗？',
      okType: 'danger',
      onOk: async () => {
        try {
          await axios.delete(`${API_BASE_URL}/rules/templates/${id}`);
          message.success('删除成功');
          fetchTemplates();
        } catch (error) {
          message.success('Mock delete success'); // Fallback
          setTemplates(prev => prev.filter(t => t.id !== id));
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        rule_definitions: ruleDefinitions
      };

      if (editingTemplate) {
        // Mock update
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, ...values } : t));
        message.success('更新成功');
      } else {
        // Mock create
        const newTemp = { ...values, id: Date.now(), rule_count: ruleDefinitions.length, created_at: new Date().toISOString() };
        setTemplates([...templates, newTemp]);
        message.success('创建成功');
      }

      setIsModalVisible(false);
    } catch (error) {
      console.error(error);
    }
  };

  const addRuleDefinition = () => {
    const newRule: RuleDefinition = {
      rule_type: 'status_code_check',
      rule_config: {},
      execution_order: ruleDefinitions.length,
      is_required: true,
      assertions: []
    };
    setRuleDefinitions([...ruleDefinitions, newRule]);
  };

  const removeRuleDefinition = (index: number) => {
    const newRules = ruleDefinitions.filter((_, i) => i !== index);
    setRuleDefinitions(newRules);
  };

  const updateRuleDefinition = (index: number, field: string, value: any) => {
    const newRules = [...ruleDefinitions];
    newRules[index] = { ...newRules[index], [field]: value };
    setRuleDefinitions(newRules);
  };

  const addAssertion = (ruleIndex: number) => {
    const newAssertion: AssertionRule = {
      assertion_type: 'equals',
      field_path: '',
      operator: '==',
      expected_value: '',
      error_message: ''
    };
    const newRules = [...ruleDefinitions];
    newRules[ruleIndex].assertions.push(newAssertion);
    setRuleDefinitions(newRules);
  };

  const removeAssertion = (ruleIndex: number, assertionIndex: number) => {
    const newRules = [...ruleDefinitions];
    newRules[ruleIndex].assertions = newRules[ruleIndex].assertions.filter((_, i) => i !== assertionIndex);
    setRuleDefinitions(newRules);
  };

  const updateAssertion = (ruleIndex: number, assertionIndex: number, field: string, value: any) => {
    const newRules = [...ruleDefinitions];
    newRules[ruleIndex].assertions[assertionIndex] = {
      ...newRules[ruleIndex].assertions[assertionIndex],
      [field]: value
    };
    setRuleDefinitions(newRules);
  };

  const getProtocolTag = (protocol: string) => {
    const map: any = {
      http: { color: 'blue', icon: <GlobalOutlined /> },
      tcp: { color: 'purple', icon: <CodeOutlined /> },
      mq: { color: 'orange', icon: <ThunderboltOutlined /> }
    };
    const conf = map[protocol.toLowerCase()] || { color: 'default', icon: null };
    return <Tag color={conf.color} icon={conf.icon}>{protocol.toUpperCase()}</Tag>;
  };

  const getCategoryTag = (cat: string) => {
    const map: any = {
      correctness: { color: 'success', text: 'Correctness' },
      security: { color: 'error', text: 'Security' },
      performance: { color: 'warning', text: 'Performance' },
      compatibility: { color: 'Processing', text: 'Compatibility' }
    };
    const conf = map[cat.toLowerCase()] || { color: 'default', text: cat };
    return <Badge status={conf.color as any} text={conf.text} />;
  };

  const columns: ColumnsType<RuleTemplate> = [
    {
      title: '规则模板',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: 15 }}>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description || 'No description provided'}</Text>
        </Space>
      ),
    },
    {
      title: '协议 & 分类',
      key: 'meta',
      width: 250,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          {getProtocolTag(record.protocol)}
          {getCategoryTag(record.category)}
        </Space>
      ),
    },
    {
      title: '统计',
      key: 'stats',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="Rule Count">
            <Tag><SettingOutlined /> {record.rule_count}</Tag>
          </Tooltip>
          <Tooltip title="Priority">
            <Tag color="cyan">P{record.priority}</Tag>
          </Tooltip>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 120,
      render: (enabled: boolean) => (
        enabled ?
          <Tag color="success" icon={<CheckCircleOutlined />}>Active</Tag> :
          <Tag color="default" icon={<StopOutlined />}>Disabled</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="详情">
            <Button type="text" icon={<EyeOutlined />} onClick={() => fetchTemplateDetail(record.id)} />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>规则配置</Title>
          <Text type="secondary">配置与管理自动化测试所需的校验规则模板</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleAdd} style={{ borderRadius: 8 }}>
          新建模板
        </Button>
      </div>

      <div className="glass-panel" style={{ flex: 1, borderRadius: 16, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <Table
          className="glass-table"
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          style={{ flex: 1 }}
        />
      </div>

      <Modal
        title={editingTemplate ? '编辑规则模板' : '新建规则模板'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        width={900}
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical">
          <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
            <Space style={{ display: 'flex', marginBottom: 16 }} size="large" align="start">
              <Form.Item name="name" label="规则名称" rules={[{ required: true }]} style={{ width: 300 }}>
                <Input placeholder="e.g. Standard HTTP Check" />
              </Form.Item>
              <Form.Item name="protocol" label="协议" rules={[{ required: true }]} style={{ width: 150 }}>
                <Select>
                  <Option value="http">HTTP</Option>
                  <Option value="tcp">TCP</Option>
                  <Option value="mq">MQ</Option>
                </Select>
              </Form.Item>
              <Form.Item name="category" label="分类" rules={[{ required: true }]} style={{ width: 150 }}>
                <Select>
                  <Option value="correctness">Correctness</Option>
                  <Option value="security">Security</Option>
                  <Option value="performance">Performance</Option>
                </Select>
              </Form.Item>
              <Form.Item name="is_enabled" label="状态" valuePropName="checked">
                <Switch checkedChildren="ON" unCheckedChildren="OFF" />
              </Form.Item>
              <Form.Item name="priority" label="优先级" initialValue={10}>
                <InputNumber min={0} max={100} />
              </Form.Item>
            </Space>
            <Form.Item name="description" label="描述">
              <TextArea rows={2} />
            </Form.Item>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}>规则定义</Title>
            <Button type="dashed" onClick={addRuleDefinition} icon={<PlusOutlined />}>添加规则</Button>
          </div>

          <Collapse ghost>
            {ruleDefinitions.map((rule, ruleIndex) => (
              <Panel
                header={<Space><Tag color="blue">{rule.rule_type}</Tag> <Text type="secondary">Order: {ruleIndex + 1}</Text></Space>}
                key={ruleIndex}
                extra={
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); removeRuleDefinition(ruleIndex); }} />
                }
              >
                <div style={{ padding: '0 12px 12px 12px' }}>
                  <Space style={{ marginBottom: 16 }}>
                    <Select
                      value={rule.rule_type}
                      onChange={(value) => updateRuleDefinition(ruleIndex, 'rule_type', value)}
                      style={{ width: 200 }}
                    >
                      <Option value="status_code_check">Status Code</Option>
                      <Option value="response_time_check">Response Time</Option>
                      <Option value="json_schema_check">JSON Schema</Option>
                      <Option value="field_value_check">Field Value</Option>
                    </Select>
                    <Switch
                      checked={rule.is_required}
                      onChange={(checked) => updateRuleDefinition(ruleIndex, 'is_required', checked)}
                      checkedChildren="Required"
                      unCheckedChildren="Optional"
                    />
                  </Space>

                  <Card size="small" title="Assertions" extra={<Button type="link" size="small" onClick={() => addAssertion(ruleIndex)}>+ Add Assertion</Button>}>
                    {rule.assertions.map((assertion, assertionIndex) => (
                      <div key={assertionIndex} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <Input placeholder="Field (e.g. data.id)" value={assertion.field_path} onChange={e => updateAssertion(ruleIndex, assertionIndex, 'field_path', e.target.value)} style={{ width: 200 }} />
                        <Select value={assertion.operator} onChange={v => updateAssertion(ruleIndex, assertionIndex, 'operator', v)} style={{ width: 120 }}>
                          <Option value="==">==</Option>
                          <Option value="!=">!=</Option>
                          <Option value=">">&gt;</Option>
                          <Option value="<">&lt;</Option>
                          <Option value="contains">Contains</Option>
                        </Select>
                        <Input placeholder="Expected Value" value={assertion.expected_value} onChange={e => updateAssertion(ruleIndex, assertionIndex, 'expected_value', e.target.value)} style={{ flex: 1 }} />
                        <Button icon={<DeleteOutlined />} danger type="text" onClick={() => removeAssertion(ruleIndex, assertionIndex)} />
                      </div>
                    ))}
                    {rule.assertions.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>No assertions defined.</Text>}
                  </Card>
                </div>
              </Panel>
            ))}
          </Collapse>
        </Form>
      </Modal>

      <Drawer
        title={<Space><SafetyCertificateOutlined /> {selectedTemplate?.name}</Space>}
        placement="right"
        width={600}
        onClose={() => setIsDetailVisible(false)}
        open={isDetailVisible}
      >
        {selectedTemplate && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card bordered={false} style={{ background: '#fafafa' }}>
              <p><strong>Protocol:</strong> {selectedTemplate.protocol?.toUpperCase()}</p>
              <p><strong>Category:</strong> {selectedTemplate.category}</p>
              <p><strong>Description:</strong> {selectedTemplate.description}</p>
              <p><strong>Priority:</strong> {selectedTemplate.priority}</p>
            </Card>

            <div>
              <Title level={5}>Rules Sequence</Title>
              <List
                itemLayout="horizontal"
                dataSource={selectedTemplate.rule_definitions || []}
                renderItem={(rule: any, index) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Tag color="blue">{index + 1}</Tag>}
                      title={rule.rule_type}
                      description={
                        <Space direction="vertical" size={2}>
                          <Text type="secondary">{rule.is_required ? 'Required Rule' : 'Optional Rule'}</Text>
                          <div>
                            {rule.assertions?.map((a: any, i: number) => (
                              <Tag key={i}>{a.field_path} {a.operator} {a.expected_value}</Tag>
                            ))}
                          </div>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default RuleConfig;
