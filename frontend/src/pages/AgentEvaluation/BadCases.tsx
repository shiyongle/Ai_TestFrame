import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  AlertOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { difyAgentApi, badCaseApi } from '../../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface DifyAgentItem {
  id: number;
  name: string;
  base_url: string;
  app_id: string;
  api_key?: string;
  created_at: string;
  updated_at?: string;
}

interface BadCaseTurnItem {
  id: number;
  message_id?: string;
  query: string;
  answer: string;
  expected_answer?: string;
  evaluation_score?: number;
  evaluation_reason?: string;
  rerun_answer?: string;
  rerun_score?: number;
  rerun_reason?: string;
  remark?: string;
  turn_index: number;
  created_at: string;
  updated_at?: string;
}

interface BadCaseItem {
  id: number;
  agent_id: number;
  agent_name?: string;
  conversation_id?: string;
  remark?: string;
  turns: BadCaseTurnItem[];
  created_at: string;
  updated_at?: string;
}

const BadCases: React.FC = () => {
  const [agents, setAgents] = useState<DifyAgentItem[]>([]);
  const [badCases, setBadCases] = useState<BadCaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentModalVisible, setAgentModalVisible] = useState(false);
  const [badCaseModalVisible, setBadCaseModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<DifyAgentItem | null>(null);
  const [selectedBadCase, setSelectedBadCase] = useState<BadCaseItem | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>(undefined);
  const [agentForm] = Form.useForm();
  const [badCaseForm] = Form.useForm();

  // ---- DifyAgent 管理 ----
  const loadAgents = useCallback(async () => {
    try {
      const data = await difyAgentApi.listAgents();
      setAgents(data || []);
    } catch {
      message.error('智能体列表加载失败');
    }
  }, []);

  const handleSaveAgent = async () => {
    try {
      const values = await agentForm.validateFields();
      if (editingAgent) {
        await difyAgentApi.updateAgent(editingAgent.id, values);
        message.success('智能体已更新');
      } else {
        await difyAgentApi.createAgent(values);
        message.success('智能体已创建');
      }
      setAgentModalVisible(false);
      loadAgents();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.detail || '操作失败');
    }
  };

  const handleEditAgent = (agent: DifyAgentItem) => {
    setEditingAgent(agent);
    agentForm.setFieldsValue({
      name: agent.name,
      base_url: agent.base_url,
      app_id: agent.app_id,
      api_key: agent.api_key,
    });
    setAgentModalVisible(true);
  };

  const handleDeleteAgent = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除智能体将同时删除关联的 BadCase，此操作不可恢复',
      okType: 'danger',
      onOk: async () => {
        try {
          await difyAgentApi.deleteAgent(id);
          message.success('智能体已删除');
          loadAgents();
          loadBadCases();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  // ---- BadCase 管理 ----
  const loadBadCases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await badCaseApi.listBadCases({
        agent_id: selectedAgentId,
        limit: 20,
      });
      setBadCases(data || []);
    } catch {
      message.error('BadCase列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadAgents();
    loadBadCases();
  }, [loadAgents, loadBadCases]);

  const handleCreateBadCase = async () => {
    try {
      const values = await badCaseForm.validateFields();
      const turns = values.turns || [];
      const payload = {
        agent_id: values.agent_id,
        conversation_id: values.conversation_id,
        remark: values.remark,
        turns: turns.map((t: any, index: number) => ({
          ...t,
          turn_index: index,
        })),
      };
      await badCaseApi.createBadCase(payload);
      message.success('BadCase已创建');
      setBadCaseModalVisible(false);
      loadBadCases();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.detail || '操作失败');
    }
  };

  const handleDeleteBadCase = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除此 BadCase 及其所有轮次，此操作不可恢复',
      okType: 'danger',
      onOk: async () => {
        try {
          await badCaseApi.deleteBadCase(id);
          message.success('BadCase已删除');
          loadBadCases();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleViewDetail = (caseItem: BadCaseItem) => {
    setSelectedBadCase(caseItem);
    setDetailModalVisible(true);
  };

  // ---- DifyAgent 表格列 ----
  const agentColumns: ColumnsType<DifyAgentItem> = [
    { title: '名称', dataIndex: 'name', width: 150, ellipsis: true },
    { title: 'Base URL', dataIndex: 'base_url', width: 200, ellipsis: true },
    { title: 'App ID', dataIndex: 'app_id', width: 120, ellipsis: true },
    {
      title: '操作', width: 120,
      render: (_: any, record: DifyAgentItem) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditAgent(record)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteAgent(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  // ---- BadCase 表格列 ----
  const badCaseColumns: ColumnsType<BadCaseItem> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '智能体', dataIndex: 'agent_name', width: 120, render: (text: string) => text || '-' },
    { title: '对话ID', dataIndex: 'conversation_id', width: 120, render: (text: string) => text || '-' },
    { title: '轮次', width: 60, render: (_: any, record: BadCaseItem) => record.turns?.length || 0 },
    { title: '备注', dataIndex: 'remark', width: 150, ellipsis: true, render: (text: string) => text || '-' },
    {
      title: '创建时间', dataIndex: 'created_at', width: 160,
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作', width: 120,
      render: (_: any, record: BadCaseItem) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>详情</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteBadCase(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  // ---- BadCaseTurn 表格列 ----
  const turnColumns: ColumnsType<BadCaseTurnItem> = [
    { title: '轮次', dataIndex: 'turn_index', width: 60 },
    { title: '问题', dataIndex: 'query', width: 200, ellipsis: true },
    { title: '回答', dataIndex: 'answer', width: 200, ellipsis: true },
    { title: '期望答案', dataIndex: 'expected_answer', width: 150, ellipsis: true, render: (text: string) => text || '-' },
    {
      title: '评测得分', dataIndex: 'evaluation_score', width: 80,
      render: (val: number) => val != null ? <Tag color={val >= 60 ? 'green' : 'red'}>{val}</Tag> : '-',
    },
    { title: '评测原因', dataIndex: 'evaluation_reason', width: 150, ellipsis: true, render: (text: string) => text || '-' },
    { title: '备注', dataIndex: 'remark', width: 100, ellipsis: true, render: (text: string) => text || '-' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              <AlertOutlined /> BadCase 管理
            </Title>
            <Text type="secondary">管理 Dify 智能体和不良案例，追踪和评估 Agent 回答质量</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => { loadAgents(); loadBadCases(); }} loading={loading}>
            刷新
          </Button>
        </div>

        {/* DifyAgent 管理 */}
        <Card title="Dify 智能体" bordered={false} extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditingAgent(null);
            agentForm.resetFields();
            setAgentModalVisible(true);
          }}>新增智能体</Button>
        }>
          <Table
            rowKey="id"
            columns={agentColumns}
            dataSource={agents}
            pagination={{ pageSize: 5 }}
            size="small"
          />
        </Card>

        {/* BadCase 管理 */}
        <Card title="不良案例" bordered={false} extra={
          <Space>
            <Select
              placeholder="按智能体筛选"
              value={selectedAgentId}
              onChange={val => setSelectedAgentId(val)}
              allowClear
              style={{ width: 180 }}
            >
              {agents.map(a => (
                <Select.Option key={a.id} value={a.id}>{a.name}</Select.Option>
              ))}
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              badCaseForm.resetFields();
              badCaseForm.setFieldsValue({ turns: [{ query: '', answer: '' }] });
              setBadCaseModalVisible(true);
            }}>新增 BadCase</Button>
          </Space>
        }>
          <Table
            rowKey="id"
            columns={badCaseColumns}
            dataSource={badCases}
            loading={loading}
            pagination={{ pageSize: 8 }}
            size="small"
          />
        </Card>
      </Space>

      {/* DifyAgent 创建/编辑 Modal */}
      <Modal
        title={editingAgent ? '编辑智能体' : '新增智能体'}
        open={agentModalVisible}
        onOk={handleSaveAgent}
        onCancel={() => setAgentModalVisible(false)}
        destroyOnClose
      >
        <Form form={agentForm} layout="vertical">
          <Form.Item name="name" label="智能体名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：客服助手" maxLength={100} />
          </Form.Item>
          <Form.Item name="base_url" label="Dify API Base URL" rules={[{ required: true }]}>
            <Input placeholder="例如：https://api.dify.ai/v1" maxLength={500} />
          </Form.Item>
          <Form.Item name="app_id" label="Dify App ID" rules={[{ required: true }]}>
            <Input placeholder="例如：app-xxxx" maxLength={100} />
          </Form.Item>
          <Form.Item name="api_key" label="API Key">
            <Input.Password placeholder="Dify API密钥" maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      {/* BadCase 创建 Modal */}
      <Modal
        title="新增 BadCase"
        open={badCaseModalVisible}
        onOk={handleCreateBadCase}
        onCancel={() => setBadCaseModalVisible(false)}
        width={720}
        destroyOnClose
      >
        <Form form={badCaseForm} layout="vertical">
          <Form.Item name="agent_id" label="关联智能体" rules={[{ required: true, message: '请选择智能体' }]}>
            <Select placeholder="选择智能体">
              {agents.map(a => (
                <Select.Option key={a.id} value={a.id}>{a.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="conversation_id" label="对话ID">
            <Input placeholder="可选，对话ID" maxLength={100} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="BadCase备注说明" />
          </Form.Item>

          <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>对话轮次</Typography.Text>
          <Form.List name="turns">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {fields.map((field, index) => (
                  <div key={field.key} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text strong>轮次 {index + 1}</Text>
                      {fields.length > 1 && (
                        <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                      )}
                    </div>
                    <Form.Item
                      {...field}
                      name={[field.name, 'query']}
                      rules={[{ required: true, message: '请输入问题' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <TextArea rows={2} placeholder="用户问题" />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'answer']}
                      rules={[{ required: true, message: '请输入回答' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <TextArea rows={2} placeholder="Agent回答" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'expected_answer']} style={{ marginBottom: 0 }}>
                      <TextArea rows={2} placeholder="期望答案（可选）" />
                    </Form.Item>
                  </div>
                ))}
                <Button block icon={<PlusOutlined />} onClick={() => add({ query: '', answer: '' })}>
                  添加轮次
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* BadCase 详情 Modal */}
      <Modal
        title={`BadCase 详情 #${selectedBadCase?.id || ''}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedBadCase && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered size="small">
              <Descriptions.Item label="智能体">{selectedBadCase.agent_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="对话ID">{selectedBadCase.conversation_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注">{selectedBadCase.remark || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{new Date(selectedBadCase.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
              <Descriptions.Item label="轮次数">{selectedBadCase.turns?.length || 0}</Descriptions.Item>
            </Descriptions>
            <Table
              rowKey="id"
              columns={turnColumns}
              dataSource={selectedBadCase.turns || []}
              pagination={false}
              size="small"
            />
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default BadCases;