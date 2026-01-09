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
  Collapse
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';

const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

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

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/rules/templates`);
      if (response.data.success) {
        setTemplates(response.data.data);
      }
    } catch (error) {
      message.error('获取规则模板失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateDetail = async (id: number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/rules/templates/${id}`);
      if (response.data.success) {
        setSelectedTemplate(response.data.data);
        setIsDetailVisible(true);
      }
    } catch (error) {
      message.error('获取规则详情失败');
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
    fetchTemplateDetail(record.id);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个规则模板吗？',
      onOk: async () => {
        try {
          await axios.delete(`${API_BASE_URL}/rules/templates/${id}`);
          message.success('删除成功');
          fetchTemplates();
        } catch (error) {
          message.error('删除失败');
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
        await axios.put(`${API_BASE_URL}/rules/templates/${editingTemplate.id}`, data);
        message.success('更新成功');
      } else {
        await axios.post(`${API_BASE_URL}/rules/templates`, data);
        message.success('创建成功');
      }

      setIsModalVisible(false);
      fetchTemplates();
    } catch (error) {
      message.error('操作失败');
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

  const columns: ColumnsType<RuleTemplate> = [
    {
      title: '规则',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (text: string, record) => (
        <div className="cell-primary">
          <span className="cell-title">{text}</span>
          <span className="cell-subtitle">{record.description || '暂无描述'}</span>
        </div>
      ),
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 100,
      render: (protocol: string) => {
        const colorMap: Record<string, string> = {
          http: 'blue',
          tcp: 'green',
          mq: 'orange',
        };
        return <Tag color={colorMap[protocol]} className="tag-pill">{protocol.toUpperCase()}</Tag>;
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => {
        const textMap: Record<string, string> = {
          correctness: '正确性',
          security: '安全性',
          performance: '性能',
          compatibility: '兼容性',
        };
        return <Tag className="tag-pill">{textMap[category] || category}</Tag>;
      },
    },
    {
      title: '规则数量',
      dataIndex: 'rule_count',
      key: 'rule_count',
      width: 100,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 100,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'success' : 'default'} className="tag-pill">
          {enabled ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" className="row-actions">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => fetchTemplateDetail(record.id)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-shell">
      <div className="page-toolbar">
        <div className="page-title">
          <h2>规则配置管理</h2>
          <span className="page-subtitle">管理规则模板与断言配置</span>
        </div>
        <Space>
          <Button>导出</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增规则模板
          </Button>
        </Space>
      </div>

      <div className="panel">
        <div className="panel-header">
          <Space>
            <Tag color="blue">模板</Tag>
            <span>共 {templates.length} 个</span>
          </Space>
        </div>
        <div className="panel-body">
          <Table
            columns={columns}
            dataSource={templates}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        </div>
      </div>

      <Modal
        title={editingTemplate ? '编辑规则模板' : '新增规则模板'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        width={900}
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="请输入规则名称" />
          </Form.Item>

          <Form.Item
            name="protocol"
            label="协议类型"
            rules={[{ required: true, message: '请选择协议类型' }]}
          >
            <Select placeholder="请选择协议类型">
              <Option value="http">HTTP</Option>
              <Option value="tcp">TCP</Option>
              <Option value="mq">MQ</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="category"
            label="规则分类"
            rules={[{ required: true, message: '请选择规则分类' }]}
          >
            <Select placeholder="请选择规则分类">
              <Option value="correctness">正确性</Option>
              <Option value="security">安全性</Option>
              <Option value="performance">性能</Option>
              <Option value="compatibility">兼容性</Option>
            </Select>
          </Form.Item>

          <Form.Item name="description" label="规则描述">
            <TextArea rows={3} placeholder="请输入规则描述" />
          </Form.Item>

          <Form.Item name="priority" label="优先级" initialValue={0}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="is_enabled" label="是否启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>

          <Divider>规则定义</Divider>

          <Button type="dashed" onClick={addRuleDefinition} block style={{ marginBottom: 16 }}>
            <PlusOutlined /> 添加规则
          </Button>

          <Collapse>
            {ruleDefinitions.map((rule, ruleIndex) => (
              <Panel
                header={`规则 ${ruleIndex + 1}: ${rule.rule_type}`}
                key={ruleIndex}
                extra={
                  <Button
                    type="link"
                    danger
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRuleDefinition(ruleIndex);
                    }}
                  >
                    删除
                  </Button>
                }
              >
                <Form.Item label="规则类型">
                  <Select
                    value={rule.rule_type}
                    onChange={(value) => updateRuleDefinition(ruleIndex, 'rule_type', value)}
                  >
                    <Option value="status_code_check">状态码检查</Option>
                    <Option value="response_time_check">响应时间检查</Option>
                    <Option value="response_structure_check">响应结构检查</Option>
                    <Option value="field_value_check">字段值检查</Option>
                    <Option value="business_logic_check">业务逻辑检查</Option>
                  </Select>
                </Form.Item>

                <Form.Item label="是否必须">
                  <Switch
                    checked={rule.is_required}
                    onChange={(checked) => updateRuleDefinition(ruleIndex, 'is_required', checked)}
                  />
                </Form.Item>

                <Divider orientation="left">断言配置</Divider>

                <Button
                  type="dashed"
                  size="small"
                  onClick={() => addAssertion(ruleIndex)}
                  style={{ marginBottom: 8 }}
                >
                  添加断言
                </Button>

                {rule.assertions.map((assertion, assertionIndex) => (
                  <Card
                    key={assertionIndex}
                    size="small"
                    style={{ marginBottom: 8 }}
                    extra={
                      <Button
                        type="link"
                        danger
                        size="small"
                        onClick={() => removeAssertion(ruleIndex, assertionIndex)}
                      >
                        删除
                      </Button>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input
                        placeholder="字段路径，如: status_code 或 data.user.id"
                        value={assertion.field_path}
                        onChange={(e) =>
                          updateAssertion(ruleIndex, assertionIndex, 'field_path', e.target.value)
                        }
                      />
                      <Select
                        placeholder="操作符"
                        value={assertion.operator}
                        onChange={(value) => updateAssertion(ruleIndex, assertionIndex, 'operator', value)}
                        style={{ width: '100%' }}
                      >
                        <Option value="==">等于 (==)</Option>
                        <Option value="!=">不等于 (!=)</Option>
                        <Option value=">">大于 (&gt;)</Option>
                        <Option value="<">小于 (&lt;)</Option>
                        <Option value=">=">大于等于 (&gt;=)</Option>
                        <Option value="<=">小于等于 (&lt;=)</Option>
                        <Option value="contains">包含</Option>
                        <Option value="in_range">在范围内</Option>
                      </Select>
                      <Input
                        placeholder="期望值"
                        value={assertion.expected_value}
                        onChange={(e) =>
                          updateAssertion(ruleIndex, assertionIndex, 'expected_value', e.target.value)
                        }
                      />
                      <Input
                        placeholder="错误提示信息"
                        value={assertion.error_message}
                        onChange={(e) =>
                          updateAssertion(ruleIndex, assertionIndex, 'error_message', e.target.value)
                        }
                      />
                    </Space>
                  </Card>
                ))}
              </Panel>
            ))}
          </Collapse>
        </Form>
      </Modal>

      <Drawer
        title="规则模板详情"
        placement="right"
        width={720}
        onClose={() => setIsDetailVisible(false)}
        open={isDetailVisible}
      >
        {selectedTemplate && (
          <div>
            <Divider orientation="left">基本信息</Divider>
            <p><strong>名称:</strong> {selectedTemplate.name}</p>
            <p><strong>协议:</strong> {selectedTemplate.protocol}</p>
            <p><strong>分类:</strong> {selectedTemplate.category}</p>
            <p><strong>描述:</strong> {selectedTemplate.description}</p>
            <p><strong>优先级:</strong> {selectedTemplate.priority}</p>
            <p><strong>状态:</strong> {selectedTemplate.is_enabled ? '启用' : '禁用'}</p>

            <Divider orientation="left">规则定义</Divider>
            <List
              dataSource={selectedTemplate.rule_definitions}
              renderItem={(rule: any) => (
                <List.Item>
                  <Card title={rule.rule_type} size="small" style={{ width: '100%' }}>
                    <p><strong>执行顺序:</strong> {rule.execution_order}</p>
                    <p><strong>是否必须:</strong> {rule.is_required ? '是' : '否'}</p>
                    <Divider orientation="left">断言列表</Divider>
                    {rule.assertions.map((assertion: any, index: number) => (
                      <Card key={index} size="small" style={{ marginBottom: 8 }}>
                        <p><strong>字段:</strong> {assertion.field_path}</p>
                        <p><strong>操作符:</strong> {assertion.operator}</p>
                        <p><strong>期望值:</strong> {assertion.expected_value}</p>
                        <p><strong>错误信息:</strong> {assertion.error_message}</p>
                      </Card>
                    ))}
                  </Card>
                </List.Item>
              )}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default RuleConfig;
