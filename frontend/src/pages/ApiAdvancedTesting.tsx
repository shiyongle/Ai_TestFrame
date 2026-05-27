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
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiAdvancedApi, environmentApi, interfaceTestcaseApi, projectApi } from '../services/api';

const { Title, Text } = Typography;

interface ApiAdvancedTestingProps {
  embedded?: boolean;
  defaultProjectId?: number;
}

const ApiAdvancedTesting: React.FC<ApiAdvancedTestingProps> = ({ embedded = false, defaultProjectId }) => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<number | undefined>(defaultProjectId);
  const [summary, setSummary] = useState<any>({});
  const [mocks, setMocks] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [monitors, setMonitors] = useState<any[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [mockOpen, setMockOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [docSyncResult, setDocSyncResult] = useState<any>();
  const [docSyncForm] = Form.useForm();
  const [mockForm] = Form.useForm();
  const [contractForm] = Form.useForm();
  const [monitorForm] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { project_id: projectId };
      const [projectList, envList, caseList, summaryData, mockList, contractList, monitorList, changeList] = await Promise.all([
        projectApi.getProjects(),
        environmentApi.list(),
        interfaceTestcaseApi.getAll(projectId),
        apiAdvancedApi.getSummary(params),
        apiAdvancedApi.listMocks(params),
        apiAdvancedApi.listContracts(),
        apiAdvancedApi.listMonitors(),
        apiAdvancedApi.listChanges({ project_id: projectId, limit: 50 }),
      ]);
      setProjects(projectList || []);
      setEnvironments(envList || []);
      setCases(caseList || []);
      setSummary(summaryData || {});
      setMocks(mockList || []);
      setContracts(contractList || []);
      setMonitors(monitorList || []);
      setChanges(changeList || []);
    } catch (error) {
      message.error('加载接口自动化扩展数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (defaultProjectId) {
      setProjectId(defaultProjectId);
    }
  }, [defaultProjectId]);

  useEffect(() => {
    if (projectId) {
      docSyncForm.setFieldsValue({ project_id: projectId });
    }
  }, [docSyncForm, projectId]);

  const syncDocs = async () => {
    try {
      const values = await docSyncForm.validateFields();
      const res = await apiAdvancedApi.syncDocs(values);
      setDocSyncResult(res);
      message.success(`同步完成：新增 ${res.created}，更新 ${res.updated}`);
      loadData();
    } catch (error: any) {
      if (!error?.errorFields) message.error(error?.response?.data?.detail || '接口文档同步失败');
    }
  };

  const createMock = async () => {
    try {
      const values = await mockForm.validateFields();
      await apiAdvancedApi.createMock({
        ...values,
        response_body: JSON.parse(values.response_body || '{}'),
        headers: values.headers ? JSON.parse(values.headers) : {},
      });
      message.success('Mock 已创建');
      setMockOpen(false);
      mockForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || 'Mock JSON 格式错误');
    }
  };

  const createContract = async () => {
    try {
      const values = await contractForm.validateFields();
      await apiAdvancedApi.createContract({
        ...values,
        expected_status_codes: String(values.expected_status_codes || '200').split(',').map((item) => Number(item.trim())),
        response_schema: JSON.parse(values.response_schema || '{}'),
      });
      message.success('契约已创建');
      setContractOpen(false);
      contractForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '契约 Schema JSON 格式错误');
    }
  };

  const createMonitor = async () => {
    try {
      const values = await monitorForm.validateFields();
      await apiAdvancedApi.createMonitor(values);
      message.success('监控探测已创建');
      setMonitorOpen(false);
      monitorForm.resetFields();
      loadData();
    } catch (error: any) {
      if (!error?.errorFields) message.error(error?.response?.data?.detail || '创建监控失败');
    }
  };

  const runMonitor = async (record: any) => {
    try {
      await apiAdvancedApi.runMonitor(record.id);
      message.success('探测完成');
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '探测失败');
    }
  };

  return (
    <div className={embedded ? 'fade-in' : 'app-content fade-in'} style={{ padding: embedded ? 0 : 24, maxWidth: embedded ? 'none' : 1680, margin: embedded ? 0 : '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={embedded ? 3 : 2} style={{ margin: 0, fontWeight: 700 }}>接口自动化扩展能力</Title>
          <Text type="secondary">接口文档同步、契约校验、Mock Server、监控探测、接口变更 Diff 与 API 资产治理</Text>
        </div>
        <Space>
          <Select
            allowClear
            placeholder="项目筛选"
            value={projectId}
            onChange={setProjectId}
            style={{ width: 220 }}
            options={projects.map((item) => ({ label: item.name, value: item.id }))}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
        </Space>
      </div>

      <Space size="large" wrap style={{ marginBottom: 16 }}>
        <Card bordered={false} style={{ minWidth: 160 }}><Text type="secondary">接口资产</Text><div style={{ fontSize: 28, fontWeight: 700 }}>{summary.interface_cases || 0}</div></Card>
        <Card bordered={false} style={{ minWidth: 160 }}><Text type="secondary">契约</Text><div style={{ fontSize: 28, fontWeight: 700 }}>{summary.contracts || 0}</div></Card>
        <Card bordered={false} style={{ minWidth: 160 }}><Text type="secondary">Mock</Text><div style={{ fontSize: 28, fontWeight: 700 }}>{summary.mocks || 0}</div></Card>
        <Card bordered={false} style={{ minWidth: 160 }}><Text type="secondary">监控</Text><div style={{ fontSize: 28, fontWeight: 700 }}>{summary.monitors || 0}</div></Card>
      </Space>

      <Card bordered={false}>
        <Tabs
          items={[
            {
              key: 'docs',
              label: '接口文档同步',
              children: (
                <div style={{ maxWidth: 920 }}>
                  <Form
                    form={docSyncForm}
                    layout="vertical"
                    initialValues={{ project_id: projectId, module: '接口文档同步', max_cases: 300 }}
                  >
                    <Form.Item name="project_id" label="项目" rules={[{ required: true }]}>
                      <Select options={projects.map((item) => ({ label: item.name, value: item.id }))} />
                    </Form.Item>
                    <Form.Item name="docs_url" label="OpenAPI/Swagger 文档 URL" rules={[{ required: true }]}>
                      <Input placeholder="http://localhost:8000/openapi.json" />
                    </Form.Item>
                    <Space size="middle" wrap>
                      <Form.Item name="module" label="模块" style={{ width: 260 }}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="max_cases" label="最大用例数" style={{ width: 180 }}>
                        <InputNumber min={1} max={1000} style={{ width: '100%' }} />
                      </Form.Item>
                    </Space>
                    <div>
                      <Button type="primary" onClick={syncDocs}>同步接口文档</Button>
                    </div>
                  </Form>
                  {docSyncResult && (
                    <Space size="large" wrap style={{ marginTop: 16 }}>
                      <Text>来源：<Text code>{docSyncResult.source_type}</Text></Text>
                      <Text>新增：<Text strong>{docSyncResult.created}</Text></Text>
                      <Text>更新：<Text strong>{docSyncResult.updated}</Text></Text>
                      <Text>跳过：<Text strong>{docSyncResult.skipped}</Text></Text>
                    </Space>
                  )}
                </div>
              ),
            },
            {
              key: 'mocks',
              label: 'Mock Server',
              children: (
                <>
                  <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setMockOpen(true)}>新增 Mock</Button>
                  <Table loading={loading} rowKey="id" dataSource={mocks} columns={[
                    { title: '名称', dataIndex: 'name' },
                    { title: '方法', dataIndex: 'method', render: (value: string) => <Tag color="blue">{value}</Tag> },
                    { title: '路径', dataIndex: 'path' },
                    { title: 'Mock URL', dataIndex: 'mock_url', render: (value: string) => <Text code>{value}</Text> },
                    { title: '状态码', dataIndex: 'status_code' },
                  ]} />
                </>
              ),
            },
            {
              key: 'contracts',
              label: '契约 Schema',
              children: (
                <>
                  <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setContractOpen(true)}>新增契约</Button>
                  <Table loading={loading} rowKey="id" dataSource={contracts} columns={[
                    { title: '契约', dataIndex: 'name' },
                    { title: '接口', dataIndex: 'interface_testcase_id', render: (value: number) => cases.find((item) => item.id === value)?.name || value },
                    { title: '期望状态码', dataIndex: 'expected_status_codes', render: (value: number[]) => (value || []).join(',') },
                    { title: '启用', dataIndex: 'enabled', render: (value: boolean) => value ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag> },
                  ]} />
                </>
              ),
            },
            {
              key: 'monitors',
              label: '监控探测',
              children: (
                <>
                  <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setMonitorOpen(true)}>新增探测</Button>
                  <Table loading={loading} rowKey="id" dataSource={monitors} columns={[
                    { title: '名称', dataIndex: 'name' },
                    { title: '接口', dataIndex: 'case_name' },
                    { title: '最近状态', dataIndex: 'last_status', render: (value: string) => value ? <Tag color={value === 'passed' ? 'green' : 'red'}>{value}</Tag> : '-' },
                    { title: '最近状态码', dataIndex: 'last_status_code' },
                    { title: '延迟', dataIndex: 'last_latency_ms', render: (value: number) => value ? `${value}ms` : '-' },
                    { title: '操作', render: (_: any, record: any) => <Button size="small" onClick={() => runMonitor(record)}>立即探测</Button> },
                  ]} />
                </>
              ),
            },
            {
              key: 'changes',
              label: '接口变更 Diff',
              children: <Table loading={loading} rowKey="id" dataSource={changes} columns={[
                { title: '接口', dataIndex: 'interface_testcase_id', render: (value: number) => cases.find((item) => item.id === value)?.name || value },
                { title: '来源', dataIndex: 'source' },
                { title: '变更字段', dataIndex: 'diff', render: (value: any[]) => <Space wrap>{(value || []).map((item) => <Tag key={item.field}>{item.field}</Tag>)}</Space> },
                { title: '时间', dataIndex: 'created_at', render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-' },
              ]} />,
            },
          ]}
        />
      </Card>

      <Modal title="新增 Mock" open={mockOpen} onCancel={() => setMockOpen(false)} onOk={createMock} width={720}>
        <Form form={mockForm} layout="vertical" initialValues={{ method: 'GET', status_code: 200, response_body: '{\n  "ok": true\n}', mock_key: 'default' }}>
          <Form.Item name="project_id" label="项目" rules={[{ required: true }]}><Select options={projects.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="mock_key" label="Mock Key" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="method" label="方法"><Select options={['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((item) => ({ label: item, value: item }))} /></Form.Item>
          <Form.Item name="path" label="路径" rules={[{ required: true }]}><Input placeholder="/users" /></Form.Item>
          <Form.Item name="status_code" label="状态码"><InputNumber min={100} max={599} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="headers" label="响应头 JSON"><Input.TextArea rows={3} placeholder={'{"X-Mock":"1"}'} /></Form.Item>
          <Form.Item name="response_body" label="响应体 JSON"><Input.TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增契约" open={contractOpen} onCancel={() => setContractOpen(false)} onOk={createContract} width={720}>
        <Form form={contractForm} layout="vertical" initialValues={{ expected_status_codes: '200', response_schema: '{\n  "type": "object"\n}' }}>
          <Form.Item name="interface_testcase_id" label="接口用例" rules={[{ required: true }]}><Select options={cases.map((item) => ({ label: `${item.method} ${item.name}`, value: item.id }))} /></Form.Item>
          <Form.Item name="name" label="契约名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="expected_status_codes" label="期望状态码"><Input placeholder="200,201" /></Form.Item>
          <Form.Item name="response_schema" label="响应 JSON Schema"><Input.TextArea rows={8} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增监控探测" open={monitorOpen} onCancel={() => setMonitorOpen(false)} onOk={createMonitor}>
        <Form form={monitorForm} layout="vertical" initialValues={{ interval_seconds: 300 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="interface_testcase_id" label="接口用例" rules={[{ required: true }]}><Select options={cases.map((item) => ({ label: `${item.method} ${item.name}`, value: item.id }))} /></Form.Item>
          <Form.Item name="environment_id" label="环境"><Select allowClear options={environments.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Form.Item name="interval_seconds" label="探测间隔秒"><InputNumber min={30} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApiAdvancedTesting;
