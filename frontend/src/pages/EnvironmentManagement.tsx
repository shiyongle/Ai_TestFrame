import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { CloudServerOutlined, KeyOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { environmentApi, projectApi } from '../services/api';

const { Title, Text } = Typography;

const defaultAccounts = JSON.stringify([{ username: 'tester', password: 'secret', token: 'token-value' }], null, 2);
const defaultRows = JSON.stringify([{ userId: 1001, mobile: '13800000000' }], null, 2);

const EnvironmentManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [envForm] = Form.useForm();
  const [variableForm] = Form.useForm();
  const [accountForm] = Form.useForm();
  const [dataForm] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectList, envList] = await Promise.all([
        projectApi.getProjects(),
        environmentApi.list(),
      ]);
      setProjects(projectList || []);
      setEnvironments(envList || []);
      if (selected) {
        const nextSelected = (envList || []).find((item: any) => item.id === selected.id);
        setSelected(nextSelected || null);
      }
    } catch (error) {
      message.error('加载环境配置失败');
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openEnvModal = (record?: any) => {
    envForm.resetFields();
    if (record) {
      envForm.setFieldsValue(record);
    } else {
      envForm.setFieldsValue({ code: 'test', status: 'active', is_default: environments.length === 0 });
    }
    setEnvModalOpen(true);
  };

  const submitEnv = async () => {
    try {
      const values = await envForm.validateFields();
      const id = envForm.getFieldValue('id');
      if (id) {
        await environmentApi.update(id, values);
      } else {
        await environmentApi.create(values);
      }
      message.success('环境已保存');
      setEnvModalOpen(false);
      loadData();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.detail || '保存环境失败');
      }
    }
  };

  const openDetail = (record: any) => {
    setSelected(record);
    setDrawerOpen(true);
  };

  const submitVariable = async () => {
    if (!selected) return;
    try {
      const values = await variableForm.validateFields();
      await environmentApi.createVariable(selected.id, values);
      message.success('变量已保存');
      setVariableModalOpen(false);
      variableForm.resetFields();
      loadData();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.detail || '保存变量失败');
      }
    }
  };

  const submitAccountPool = async () => {
    if (!selected) return;
    try {
      const values = await accountForm.validateFields();
      await environmentApi.createAccountPool(selected.id, {
        ...values,
        accounts: JSON.parse(values.accounts || '[]'),
      });
      message.success('账号池已保存');
      setAccountModalOpen(false);
      accountForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '账号池 JSON 格式错误');
    }
  };

  const submitDataPool = async () => {
    if (!selected) return;
    try {
      const values = await dataForm.validateFields();
      await environmentApi.createDataPool(selected.id, {
        ...values,
        rows: JSON.parse(values.rows || '[]'),
      });
      message.success('数据池已保存');
      setDataModalOpen(false);
      dataForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '数据池 JSON 格式错误');
    }
  };

  return (
    <div className="app-content fade-in" style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>环境与变量管理</Title>
          <Text type="secondary">dev/test/stage/prod 环境、变量、密钥、账号池、数据池和前后置脚本</Text>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEnvModal()}>新增环境</Button>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
        </Space>
      </div>

      <Card bordered={false}>
        <Table
          loading={loading}
          rowKey="id"
          dataSource={environments}
          columns={[
            {
              title: '环境',
              dataIndex: 'name',
              render: (text: string, record: any) => (
                <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => openDetail(record)}>
                  {text}
                </Button>
              ),
            },
            { title: '标识', dataIndex: 'code', render: (value: string) => <Tag color="blue">{value}</Tag> },
            { title: 'Base URL', dataIndex: 'base_url', ellipsis: true },
            { title: '变量数', render: (_: any, record: any) => <Tag>{(record.variables || []).length}</Tag> },
            { title: '账号池', render: (_: any, record: any) => <Tag>{(record.account_pools || []).length}</Tag> },
            { title: '数据池', render: (_: any, record: any) => <Tag>{(record.data_pools || []).length}</Tag> },
            { title: '默认', dataIndex: 'is_default', render: (value: boolean) => value ? <Tag color="green">默认</Tag> : '-' },
            { title: '更新时间', dataIndex: 'updated_at', render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-' },
            { title: '操作', render: (_: any, record: any) => <Button size="small" onClick={() => openEnvModal(record)}>编辑</Button> },
          ]}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Drawer title="环境详情" open={drawerOpen} width={820} onClose={() => setDrawerOpen(false)}>
        {selected && (
          <Tabs
            items={[
              {
                key: 'vars',
                label: '变量',
                children: (
                  <>
                    <Button icon={<KeyOutlined />} type="primary" style={{ marginBottom: 12 }} onClick={() => setVariableModalOpen(true)}>新增变量</Button>
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={selected.variables || []}
                      pagination={false}
                      columns={[
                        { title: 'Key', dataIndex: 'key' },
                        { title: 'Value', dataIndex: 'value', ellipsis: true },
                        { title: '类型', dataIndex: 'variable_type', render: (value: string) => <Tag>{value}</Tag> },
                        { title: '启用', dataIndex: 'enabled', render: (value: boolean) => value ? '是' : '否' },
                      ]}
                    />
                  </>
                ),
              },
              {
                key: 'accounts',
                label: '账号池',
                children: (
                  <>
                    <Button icon={<PlusOutlined />} type="primary" style={{ marginBottom: 12 }} onClick={() => {
                      accountForm.setFieldsValue({ strategy: 'round_robin', accounts: defaultAccounts });
                      setAccountModalOpen(true);
                    }}>新增账号池</Button>
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={selected.account_pools || []}
                      pagination={false}
                      columns={[
                        { title: '名称', dataIndex: 'name' },
                        { title: '策略', dataIndex: 'strategy' },
                        { title: '账号数', dataIndex: 'accounts', render: (value: any[]) => <Tag>{(value || []).length}</Tag> },
                      ]}
                    />
                  </>
                ),
              },
              {
                key: 'data',
                label: '数据池',
                children: (
                  <>
                    <Button icon={<PlusOutlined />} type="primary" style={{ marginBottom: 12 }} onClick={() => {
                      dataForm.setFieldsValue({ strategy: 'round_robin', rows: defaultRows });
                      setDataModalOpen(true);
                    }}>新增数据池</Button>
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={selected.data_pools || []}
                      pagination={false}
                      columns={[
                        { title: '名称', dataIndex: 'name' },
                        { title: '策略', dataIndex: 'strategy' },
                        { title: '数据行', dataIndex: 'rows', render: (value: any[]) => <Tag>{(value || []).length}</Tag> },
                      ]}
                    />
                  </>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      <Modal title="环境配置" open={envModalOpen} onCancel={() => setEnvModalOpen(false)} onOk={submitEnv} width={720}>
        <Form form={envForm} layout="vertical">
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="测试环境" /></Form.Item>
          <Form.Item name="code" label="标识" rules={[{ required: true }]}><Select options={['dev', 'test', 'stage', 'prod'].map((item) => ({ label: item, value: item }))} /></Form.Item>
          <Form.Item name="project_id" label="项目"><Select allowClear options={projects.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Form.Item name="base_url" label="Base URL"><Input prefix={<CloudServerOutlined />} placeholder="https://api.example.com" /></Form.Item>
          <Form.Item name="is_default" label="默认环境" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="pre_script" label="环境前置脚本"><Input.TextArea rows={3} placeholder="set token={{account.token}}" /></Form.Item>
          <Form.Item name="post_script" label="环境后置脚本"><Input.TextArea rows={3} placeholder="extract token json $.data.token" /></Form.Item>
          <Form.Item name="description" label="说明"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增变量" open={variableModalOpen} onCancel={() => setVariableModalOpen(false)} onOk={submitVariable}>
        <Form form={variableForm} layout="vertical" initialValues={{ variable_type: 'normal', enabled: true }}>
          <Form.Item name="key" label="Key" rules={[{ required: true }]}><Input placeholder="token" /></Form.Item>
          <Form.Item name="value" label="Value"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="variable_type" label="类型"><Select options={[
            { label: '普通变量', value: 'normal' },
            { label: '密钥变量', value: 'secret' },
            { label: '动态变量', value: 'dynamic' },
          ]} /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增账号池" open={accountModalOpen} onCancel={() => setAccountModalOpen(false)} onOk={submitAccountPool} width={680}>
        <Form form={accountForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="测试账号池" /></Form.Item>
          <Form.Item name="strategy" label="取值策略"><Select options={[
            { label: '轮询', value: 'round_robin' },
            { label: '固定第一条', value: 'first' },
          ]} /></Form.Item>
          <Form.Item name="accounts" label="账号 JSON 数组" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增数据池" open={dataModalOpen} onCancel={() => setDataModalOpen(false)} onOk={submitDataPool} width={680}>
        <Form form={dataForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="用户数据池" /></Form.Item>
          <Form.Item name="strategy" label="取值策略"><Select options={[
            { label: '轮询', value: 'round_robin' },
            { label: '固定第一条', value: 'first' },
          ]} /></Form.Item>
          <Form.Item name="rows" label="数据 JSON 数组" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EnvironmentManagement;
