import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
  Typography,
  Space,
  message,
} from 'antd';
import {
  ControlOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { modelConfigApi } from '../../services/api';

const { Title, Text } = Typography;

interface ModelConfigItem {
  id: number;
  provider: string;
  name: string;
  api_key: string;
  base_url: string;
  model: string;
  enabled: boolean;
  created_at: string;
  updated_at?: string;
}

const providerOptions = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'bailian', label: '百炼 (Bailian)' },
  { value: 'glm', label: '智谱 GLM' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'siliconflow', label: '硅基流动' },
  { value: 'tongyi', label: '通义千问' },
];

const ModelConfigs: React.FC = () => {
  const [configs, setConfigs] = useState<ModelConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ModelConfigItem | null>(null);
  const [form] = Form.useForm();

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await modelConfigApi.listConfigs(false);
      setConfigs(data || []);
    } catch {
      message.error('模型配置加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleCreate = () => {
    setEditingConfig(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true });
    setModalVisible(true);
  };

  const handleEdit = (config: ModelConfigItem) => {
    setEditingConfig(config);
    form.setFieldsValue({
      provider: config.provider,
      name: config.name,
      api_key: config.api_key,
      base_url: config.base_url,
      model: config.model,
      enabled: config.enabled,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingConfig) {
        await modelConfigApi.updateConfig(editingConfig.id, values);
        message.success('模型配置已更新');
      } else {
        await modelConfigApi.createConfig(values);
        message.success('模型配置已创建');
      }
      setModalVisible(false);
      loadConfigs();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.detail || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除模型配置可能影响关联的评测模板，请确认无关联后再删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await modelConfigApi.deleteConfig(id);
          message.success('模型配置已删除');
          loadConfigs();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleToggleEnabled = async (id: number, enabled: boolean) => {
    try {
      await modelConfigApi.updateConfig(id, { enabled });
      message.success(enabled ? '已启用' : '已禁用');
      loadConfigs();
    } catch {
      message.error('状态更新失败');
    }
  };

  const columns: ColumnsType<ModelConfigItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      width: 120,
      render: (provider: string) => {
        const option = providerOptions.find(o => o.value === provider);
        return option ? <Tag color="blue">{option.label}</Tag> : <Tag>{provider}</Tag>;
      },
    },
    {
      title: '模型',
      dataIndex: 'model',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Base URL',
      dataIndex: 'base_url',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (enabled: boolean, record: ModelConfigItem) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={(val) => handleToggleEnabled(record.id, val)}
        />
      ),
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
      render: (_: any, record: ModelConfigItem) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              <ControlOutlined /> 模型配置管理
            </Title>
            <Text type="secondary">管理 LLM-as-Judge 评测使用的模型配置，支持多提供商切换</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadConfigs} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增配置</Button>
          </Space>
        </div>

        <Card bordered={false}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={configs}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Space>

      <Modal
        title={editingConfig ? '编辑模型配置' : '新增模型配置'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="provider" label="模型提供商" rules={[{ required: true, message: '请选择提供商' }]}>
            <Select placeholder="选择模型提供商">
              {providerOptions.map(opt => (
                <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：GPT-4o 评测模型" maxLength={100} />
          </Form.Item>

          <Form.Item name="base_url" label="API Base URL" rules={[{ required: true, message: '请输入 Base URL' }]}>
            <Input placeholder="例如：https://api.openai.com/v1" maxLength={500} />
          </Form.Item>

          <Form.Item name="model" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="例如：gpt-4o" maxLength={100} />
          </Form.Item>

          <Form.Item name="api_key" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}>
            <Input.Password placeholder="sk-xxxx" />
          </Form.Item>

          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModelConfigs;