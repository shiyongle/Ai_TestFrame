import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Tooltip,
} from 'antd';
import {
  FileTextOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { evaluationTemplateApi, modelConfigApi } from '../../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface TemplateItem {
  id: number;
  name: string;
  description?: string;
  system_prompt?: string;
  user_prompt: string;
  eval_mode: string;
  model_config_id?: number;
  model_config_name?: string;
  pass_threshold: number;
  evaluation_count: number;
  created_at: string;
  updated_at?: string;
}

interface ModelConfigItem {
  id: number;
  provider: string;
  name: string;
  model: string;
  enabled: boolean;
  label?: string;
}

const evalModeMap: Record<string, { color: string; label: string }> = {
  f1: { color: 'blue', label: 'F1 关键词覆盖率' },
  llm: { color: 'purple', label: 'LLM-as-Judge' },
};

const EvaluationTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [modelConfigs, setModelConfigs] = useState<ModelConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);
  const [form] = Form.useForm();
  const [keyword, setKeyword] = useState('');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await evaluationTemplateApi.listTemplates({ keyword, limit: 100 });
      setTemplates(data || []);
    } catch {
      message.error('评测模板加载失败');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  const loadModelConfigs = useCallback(async () => {
    try {
      const data = await modelConfigApi.listConfigs(true);
      setModelConfigs(data || []);
    } catch {
      message.error('模型配置加载失败');
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadModelConfigs();
  }, [loadTemplates, loadModelConfigs]);

  const handleCreate = () => {
    setEditingTemplate(null);
    form.resetFields();
    form.setFieldsValue({ eval_mode: 'f1', pass_threshold: 0.55 });
    setModalVisible(true);
  };

  const handleEdit = (template: TemplateItem) => {
    setEditingTemplate(template);
    form.setFieldsValue({
      name: template.name,
      description: template.description,
      system_prompt: template.system_prompt,
      user_prompt: template.user_prompt,
      eval_mode: template.eval_mode,
      model_config_id: template.model_config_id,
      pass_threshold: template.pass_threshold,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除评测模板将同时删除其关联的所有评测记录，此操作不可恢复',
      okType: 'danger',
      onOk: async () => {
        try {
          await evaluationTemplateApi.deleteTemplate(id);
          message.success('模板已删除');
          loadTemplates();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (values.eval_mode === 'llm' && !values.model_config_id) {
        message.warning('LLM评测模式必须选择模型配置');
        return;
      }

      if (editingTemplate) {
        await evaluationTemplateApi.updateTemplate(editingTemplate.id, values);
        message.success('模板已更新');
      } else {
        await evaluationTemplateApi.createTemplate(values);
        message.success('模板已创建');
      }
      setModalVisible(false);
      loadTemplates();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.detail || '操作失败');
    }
  };

  const columns: ColumnsType<TemplateItem> = [
    {
      title: '模板名称',
      dataIndex: 'name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '评测模式',
      dataIndex: 'eval_mode',
      width: 140,
      render: (mode: string) => {
        const meta = evalModeMap[mode] || { color: 'default', label: mode };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '模型配置',
      dataIndex: 'model_config_name',
      width: 150,
      render: (text: string, record: TemplateItem) => text || (record.model_config_id ? `ID:${record.model_config_id}` : '-'),
    },
    {
      title: '通过阈值',
      dataIndex: 'pass_threshold',
      width: 80,
      render: (val: number) => val ?? '-',
    },
    {
      title: '评测数',
      dataIndex: 'evaluation_count',
      width: 80,
      render: (val: number) => val || 0,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, record: TemplateItem) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  const currentEvalMode = Form.useWatch('eval_mode', form);

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              <FileTextOutlined /> 评测模板管理
            </Title>
            <Text type="secondary">管理 Agent 评测模板，支持 F1 关键词覆盖率 和 LLM-as-Judge 评测模式</Text>
          </div>
          <Space>
            <Input.Search
              placeholder="搜索模板"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onSearch={() => loadTemplates()}
              style={{ width: 200 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={loadTemplates} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建模板</Button>
          </Space>
        </div>

        <Card bordered={false}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={templates}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Space>

      <Modal
        title={editingTemplate ? '编辑评测模板' : '新建评测模板'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="例如：客服问答评测模板" maxLength={150} />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="模板功能说明" maxLength={2000} />
          </Form.Item>

          <Form.Item name="eval_mode" label="评测模式" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="f1">
                <Space><Tag color="blue">F1</Tag> 关键词覆盖率评分</Space>
              </Select.Option>
              <Select.Option value="llm">
                <Space><Tag color="purple">LLM</Tag> LLM-as-Judge 评分</Space>
              </Select.Option>
            </Select>
          </Form.Item>

          {currentEvalMode === 'llm' && (
            <Form.Item
              name="model_config_id"
              label={
                <Space>
                  评测模型配置
                  <Tooltip title="LLM-as-Judge 使用的评测模型配置，用于对回答进行评分">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              rules={[{ required: currentEvalMode === 'llm', message: 'LLM模式必须选择模型配置' }]}
            >
              <Select placeholder="选择评测模型配置">
                {modelConfigs.map(mc => (
                  <Select.Option key={mc.id} value={mc.id}>
                    {mc.label || `${mc.name} (${mc.provider}/${mc.model})`}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="pass_threshold" label="通过阈值">
            <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="system_prompt"
            label={
              <Space>
                系统提示词
                <Tooltip title="LLM-as-Judge 模式下，系统提示词用于定义评测模型的角色和行为">
                  <InfoCircleOutlined />
                </Tooltip>
              </Space>
            }
          >
            <TextArea rows={3} placeholder="例如：你是一个专业的AI回答质量评估专家..." maxLength={4000} />
          </Form.Item>

          <Form.Item
            name="user_prompt"
            label="用户提示词"
            rules={[{ required: true, message: '请输入用户提示词' }]}
            extra={
              <Space size={4}>
                <Text type="secondary">支持变量替换：</Text>
                <Tag>{'{{query}}'}</Tag>
                <Tag>{'{{expected_answer}}'}</Tag>
                <Tag>{'{{answer}}'}</Tag>
              </Space>
            }
          >
            <TextArea
              rows={6}
              placeholder={`例如：请评估以下回答的质量\n问题：{{query}}\n期望答案：{{expected_answer}}\n实际回答：{{answer}}`}
              maxLength={4000}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EvaluationTemplates;