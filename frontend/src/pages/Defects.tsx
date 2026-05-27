import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import {
  BugOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudSyncOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { defectApi, projectApi } from '../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'open' },
  { label: '处理中', value: 'in_progress' },
  { label: '已解决', value: 'resolved' },
  { label: '已验证', value: 'verified' },
  { label: '已关闭', value: 'closed' },
  { label: '重新打开', value: 'reopened' },
];

const statusColor: Record<string, string> = {
  open: 'red',
  in_progress: 'processing',
  resolved: 'blue',
  verified: 'green',
  closed: 'default',
  reopened: 'orange',
};

const statusText: Record<string, string> = {
  open: '待处理',
  in_progress: '处理中',
  resolved: '已解决',
  verified: '已验证',
  closed: '已关闭',
  reopened: '重新打开',
};

const nextStatuses: Record<string, string[]> = {
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['resolved', 'open', 'closed'],
  resolved: ['verified', 'reopened', 'closed'],
  verified: ['closed', 'reopened'],
  reopened: ['in_progress', 'resolved', 'closed'],
  closed: ['reopened'],
};

const Defects: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [defects, setDefects] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [projectId, setProjectId] = useState<number | undefined>();
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [externalSyncOpen, setExternalSyncOpen] = useState(false);
  const [externalSyncTarget, setExternalSyncTarget] = useState<any | null>(null);
  const [form] = Form.useForm();
  const [externalSyncForm] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await defectApi.list({
        status: status || undefined,
        project_id: projectId,
        keyword: keyword || undefined,
        limit: 300,
        offset: 0,
      });
      setDefects(data || []);
    } catch (error) {
      console.error('Failed to load defects', error);
      message.error('加载缺陷列表失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, projectId, status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    projectApi.getProjects()
      .then((data) => setProjects(data || []))
      .catch((error) => {
        console.error('Failed to load projects', error);
        message.error('加载项目列表失败');
      });
  }, []);

  const summary = useMemo(() => {
    const openCount = defects.filter((item) => !['closed', 'verified'].includes(item.status)).length;
    const closedCount = defects.filter((item) => item.status === 'closed').length;
    const regressionFailed = defects.filter((item) => item.regression_status === 'failed').length;
    return { openCount, closedCount, regressionFailed };
  }, [defects]);

  const refreshSelected = async (id: number) => {
    const detail = await defectApi.get(id);
    setSelected(detail);
    await loadData();
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    try {
      await defectApi.create({ ...values, source_type: 'manual' });
      message.success('缺陷已创建');
      setCreateOpen(false);
      form.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '创建缺陷失败');
    }
  };

  const handleTransition = async (record: any, targetStatus: string) => {
    try {
      const updated = await defectApi.transition(record.id, {
        status: targetStatus,
        comment: `状态流转为 ${statusText[targetStatus] || targetStatus}`,
        sync_external: Boolean(record.external_key || record.external_provider === 'jira'),
      });
      message.success('状态已更新');
      setSelected(updated);
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '状态流转失败');
    }
  };

  const handleRegression = async (record: any, passed: boolean) => {
    try {
      const updated = await defectApi.verifyRegression(record.id, {
        passed,
        notes: passed ? '回归验证通过' : '回归验证失败',
        sync_external: Boolean(record.external_key || record.external_provider === 'jira'),
      });
      message.success(passed ? '回归通过，缺陷已验证' : '回归失败，缺陷已重新打开');
      setSelected(updated);
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '回归验证失败');
    }
  };

  const handleExternalSync = async (record: any) => {
    setExternalSyncTarget(record);
    externalSyncForm.setFieldsValue({
      external_status: record.external_status || record.status || 'open',
      external_key: record.external_key,
      external_url: record.external_url,
    });
    setExternalSyncOpen(true);
  };

  const handleExternalSyncSubmit = async () => {
    if (!externalSyncTarget) {
      return;
    }
    const values = await externalSyncForm.validateFields();
    try {
      const updated = await defectApi.syncExternal(externalSyncTarget.id, values);
      setSelected(updated);
      setExternalSyncOpen(false);
      setExternalSyncTarget(null);
      message.success('外部状态已同步');
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '外部状态同步失败');
    }
  };

  const handlePullExternal = async (record: any) => {
    try {
      const updated = await defectApi.pullExternal(record.id);
      setSelected(updated);
      message.success('已从外部平台拉取最新状态');
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '拉取外部状态失败');
    }
  };

  return (
    <div className="app-content fade-in" style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>缺陷管理</Title>
          <Text type="secondary">失败提 Bug、状态同步、回归验证与关闭的闭环管理</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建缺陷</Button>
        </Space>
      </div>

      <Space size="large" style={{ marginBottom: 16 }}>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">未关闭缺陷</Text>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.openCount}</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">已关闭</Text>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.closedCount}</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">回归失败</Text>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#cf1322' }}>{summary.regressionFailed}</div>
        </Card>
      </Space>

      <Card bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <Space>
            <Select
              allowClear
              placeholder="按项目筛选"
              value={projectId}
              onChange={setProjectId}
              style={{ width: 220 }}
              options={projects.map((project) => ({ label: project.name, value: project.id }))}
            />
            <Select value={status} onChange={setStatus} options={statusOptions} style={{ width: 140 }} />
            <Input.Search placeholder="搜索缺陷标题" allowClear onSearch={setKeyword} style={{ width: 260 }} />
          </Space>
        </div>
        <Table
          loading={loading}
          dataSource={defects}
          rowKey="id"
          columns={[
            {
              title: '缺陷',
              dataIndex: 'title',
              render: (text: string, record: any) => (
                <Space>
                  <BugOutlined style={{ color: '#cf1322' }} />
                  <div>
                    <Button
                      type="link"
                      style={{ padding: 0, height: 'auto' }}
                      onClick={() => {
                        setSelected(record);
                        setDrawerOpen(true);
                        refreshSelected(record.id);
                      }}
                    >
                      {text}
                    </Button>
                    <div style={{ fontSize: 12, color: '#999' }}>ID: {record.id} | 来源: {record.source_type}</div>
                  </div>
                </Space>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value: string) => <Tag color={statusColor[value] || 'default'}>{statusText[value] || value}</Tag>,
            },
            {
              title: '严重程度',
              dataIndex: 'severity',
              render: (value: string) => <Tag color={value === 'critical' ? 'red' : value === 'major' ? 'orange' : 'blue'}>{value}</Tag>,
            },
            {
              title: '优先级',
              dataIndex: 'priority',
              render: (value: string) => <Tag>{value}</Tag>,
            },
            {
              title: '回归',
              dataIndex: 'regression_status',
              render: (value: string) => <Tag color={value === 'passed' ? 'green' : value === 'failed' ? 'red' : 'default'}>{value}</Tag>,
            },
            {
              title: '外部平台',
              render: (_: any, record: any) => (
                <Space direction="vertical" size={0}>
                  <Text>{record.external_provider || 'local'}</Text>
                  {record.external_key && <Text type="secondary">{record.external_key}</Text>}
                </Space>
              ),
            },
            {
              title: '更新时间',
              dataIndex: 'updated_at',
              render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
            },
            {
              title: '操作',
              width: 300,
              render: (_: any, record: any) => (
                <Space wrap>
                  <Select
                    size="small"
                    placeholder="流转"
                    style={{ width: 110 }}
                    onChange={(value: string) => handleTransition(record, value)}
                    options={(nextStatuses[record.status] || []).map((item) => ({ label: statusText[item] || item, value: item }))}
                  />
                  <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleRegression(record, true)}>回归通过</Button>
                  <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleRegression(record, false)}>失败</Button>
                  <Button size="small" icon={<CloudSyncOutlined />} onClick={() => handleExternalSync(record)}>同步</Button>
                  <Button size="small" icon={<SyncOutlined />} onClick={() => handlePullExternal(record)}>拉取</Button>
                </Space>
              ),
            },
          ]}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Drawer title="缺陷详情" open={drawerOpen} width={640} onClose={() => setDrawerOpen(false)}>
        {selected && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="标题">{selected.title}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColor[selected.status]}>{statusText[selected.status] || selected.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="优先级">{selected.priority}</Descriptions.Item>
              <Descriptions.Item label="严重程度">{selected.severity}</Descriptions.Item>
              <Descriptions.Item label="外部缺陷">{selected.external_url ? <a href={selected.external_url} target="_blank" rel="noreferrer">{selected.external_key || selected.external_url}</a> : selected.external_key || '-'}</Descriptions.Item>
              <Descriptions.Item label="描述"><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selected.description || '-'}</pre></Descriptions.Item>
            </Descriptions>
            <div>
              <Title level={5}>流转记录</Title>
              <Timeline
                items={(selected.histories || []).map((item: any) => ({
                  dot: item.action === 'external_sync' ? <SyncOutlined /> : undefined,
                  children: (
                    <div>
                      <Text strong>{item.action}</Text>
                      <div>{item.from_status || '-'} {'->'} {item.to_status}</div>
                      <Text type="secondary">{item.operator} | {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
                      {item.comment && <div>{item.comment}</div>}
                    </div>
                  ),
                }))}
              />
            </div>
          </Space>
        )}
      </Drawer>

      <Modal title="新建缺陷" open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ severity: 'major', priority: 'P2' }}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入缺陷标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={5} />
          </Form.Item>
          <Space>
            <Form.Item label="严重程度" name="severity">
              <Select style={{ width: 140 }} options={[
                { label: 'critical', value: 'critical' },
                { label: 'major', value: 'major' },
                { label: 'minor', value: 'minor' },
              ]} />
            </Form.Item>
            <Form.Item label="优先级" name="priority">
              <Select style={{ width: 140 }} options={[
                { label: 'P0', value: 'P0' },
                { label: 'P1', value: 'P1' },
                { label: 'P2', value: 'P2' },
                { label: 'P3', value: 'P3' },
              ]} />
            </Form.Item>
          </Space>
          <Form.Item name="sync_external" valuePropName="checked">
            <Checkbox>创建后同步到 Jira/外部缺陷平台</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="同步外部缺陷状态"
        open={externalSyncOpen}
        onOk={handleExternalSyncSubmit}
        onCancel={() => setExternalSyncOpen(false)}
        destroyOnClose
      >
        <Form form={externalSyncForm} layout="vertical">
          <Form.Item label="外部状态" name="external_status" rules={[{ required: true, message: '请选择外部状态' }]}>
            <Select
              options={[
                { label: 'Open', value: 'open' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Resolved', value: 'resolved' },
                { label: 'Verified', value: 'verified' },
                { label: 'Closed', value: 'closed' },
                { label: 'Reopened', value: 'reopened' },
              ]}
            />
          </Form.Item>
          <Form.Item label="外部缺陷编号" name="external_key">
            <Input placeholder="例如 JIRA-123 / BUG-20260527-001" />
          </Form.Item>
          <Form.Item label="外部缺陷链接" name="external_url">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Defects;
