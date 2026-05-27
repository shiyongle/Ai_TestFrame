import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  DiffOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { assetAuditApi, projectApi, versionApi } from '../services/api';

const { Title, Text } = Typography;

const assetTypeText: Record<string, string> = {
  functional_case: '功能用例',
  interface_case: '接口用例',
};

const approvalColor: Record<string, string> = {
  approved: 'green',
  pending: 'orange',
  rejected: 'red',
  unversioned: 'default',
};

const TestAssetAudit: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<number | undefined>();
  const [assetType, setAssetType] = useState<string | undefined>();
  const [summary, setSummary] = useState<any>({});
  const [assets, setAssets] = useState<any[]>([]);
  const [baselines, setBaselines] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [versionsList, setVersionsList] = useState<any[]>([]);
  const [diffDetail, setDiffDetail] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [baselineOpen, setBaselineOpen] = useState(false);
  const [baselineForm] = Form.useForm();

  const loadOptions = useCallback(async () => {
    try {
      const [projectList, versionList] = await Promise.all([
        projectApi.getProjects(),
        versionApi.getVersions(),
      ]);
      setProjects(projectList || []);
      setVersions(versionList || []);
    } catch (error) {
      message.error('加载项目或版本失败');
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { project_id: projectId };
      const [summaryData, assetData, baselineData, eventData] = await Promise.all([
        assetAuditApi.getSummary(params),
        assetAuditApi.listAssets({ project_id: projectId, asset_type: assetType }),
        assetAuditApi.listBaselines(params),
        assetAuditApi.listEvents({ project_id: projectId, limit: 100 }),
      ]);
      setSummary(summaryData || {});
      setAssets(assetData.items || []);
      setBaselines(baselineData || []);
      setEvents(eventData || []);
    } catch (error) {
      console.error('Failed to load asset audit data', error);
      message.error('加载测试资产审计数据失败');
    } finally {
      setLoading(false);
    }
  }, [assetType, projectId]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAsset = async (record: any) => {
    setSelectedAsset(record);
    setDrawerOpen(true);
    setDiffDetail(null);
    try {
      const data = await assetAuditApi.listVersions(record.asset_type, record.asset_id);
      setVersionsList(data || []);
    } catch (error) {
      message.error('加载版本历史失败');
    }
  };

  const loadDiff = async (versionId: number) => {
    try {
      const data = await assetAuditApi.getVersionDiff(versionId);
      setDiffDetail(data);
    } catch (error) {
      message.error('加载版本 Diff 失败');
    }
  };

  const approve = async (versionId: number, decision: string) => {
    try {
      await assetAuditApi.approveVersion(versionId, {
        decision,
        approver: 'QA',
        comment: decision === 'approved' ? '审计页面确认通过' : '审计页面驳回',
      });
      message.success(decision === 'approved' ? '版本已确认' : '版本已驳回');
      if (selectedAsset) {
        openAsset(selectedAsset);
      }
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '审批失败');
    }
  };

  const confirmAiCase = async (record: any) => {
    if (!record.ai_evidence_id) {
      return;
    }
    try {
      await assetAuditApi.confirmAiCase(record.ai_evidence_id, {
        approver: 'QA',
        comment: '确认 AI 生成用例可纳入基线候选',
      });
      message.success('AI 生成用例已确认');
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '确认 AI 用例失败');
    }
  };

  const createBaseline = async () => {
    try {
      const values = await baselineForm.validateFields();
      await assetAuditApi.createBaseline({
        ...values,
        project_id: values.project_id || projectId,
        freeze: true,
        created_by: 'QA',
      });
      message.success('基线已创建并冻结');
      setBaselineOpen(false);
      baselineForm.resetFields();
      loadData();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.response?.data?.detail || '创建基线失败');
    }
  };

  const freezeBaseline = async (baselineId: number) => {
    try {
      await assetAuditApi.freezeBaseline(baselineId, { frozen_by: 'QA' });
      message.success('基线已冻结');
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '冻结基线失败');
    }
  };

  return (
    <div className="app-content fade-in" style={{ padding: 24, maxWidth: 1680, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>测试资产审计</Title>
          <Text type="secondary">用例版本历史、审批确认、基线冻结、AI 生成证据与不可变审计事件</Text>
        </div>
        <Space>
          <Button icon={<LockOutlined />} type="primary" onClick={() => setBaselineOpen(true)}>创建冻结基线</Button>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
        </Space>
      </div>

      <Space size="large" wrap style={{ marginBottom: 16 }}>
        <Card bordered={false} style={{ minWidth: 170 }}>
          <Text type="secondary">资产总数</Text>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.total_assets || 0}</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 170 }}>
          <Text type="secondary">待审批</Text>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#d48806' }}>{summary.pending_approvals || 0}</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 170 }}>
          <Text type="secondary">冻结资产</Text>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>{summary.frozen_assets || 0}</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 170 }}>
          <Text type="secondary">版本记录</Text>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.version_records || 0}</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 170 }}>
          <Text type="secondary">审计事件</Text>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.audit_events || 0}</div>
        </Card>
      </Space>

      <Card bordered={false}>
        <Tabs
          items={[
            {
              key: 'assets',
              label: '资产版本',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Select
                      allowClear
                      placeholder="项目"
                      value={projectId}
                      onChange={setProjectId}
                      style={{ width: 220 }}
                      options={projects.map((item) => ({ label: item.name, value: item.id }))}
                    />
                    <Select
                      allowClear
                      placeholder="资产类型"
                      value={assetType}
                      onChange={setAssetType}
                      style={{ width: 160 }}
                      options={[
                        { label: '功能用例', value: 'functional_case' },
                        { label: '接口用例', value: 'interface_case' },
                      ]}
                    />
                  </Space>
                  <Table
                    loading={loading}
                    rowKey={(item) => `${item.asset_type}-${item.asset_id}`}
                    dataSource={assets}
                    columns={[
                      {
                        title: '资产',
                        dataIndex: 'name',
                        render: (text: string, record: any) => (
                          <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => openAsset(record)}>
                            {text}
                          </Button>
                        ),
                      },
                      { title: '类型', dataIndex: 'asset_type', render: (value: string) => assetTypeText[value] || value },
                      { title: '当前版本', dataIndex: 'current_version', render: (value: number) => <Tag>v{value || 0}</Tag> },
                      {
                        title: '审批',
                        dataIndex: 'approval_status',
                        render: (value: string) => <Tag color={approvalColor[value] || 'default'}>{value}</Tag>,
                      },
                      { title: '来源', dataIndex: 'source', render: (value: string) => <Tag>{value}</Tag> },
                      {
                        title: '冻结',
                        dataIndex: 'is_frozen',
                        render: (value: boolean, record: any) => value ? (
                          <Space wrap>{(record.frozen_baselines || []).map((item: any) => <Tag color="blue" key={item.id}>{item.name}</Tag>)}</Space>
                        ) : <Tag color="default">未冻结</Tag>,
                      },
                      {
                        title: 'AI 证据',
                        dataIndex: 'ai_generated',
                        render: (value: boolean, record: any) => value ? (
                          <Space>
                            <Tag color="purple">AI生成</Tag>
                            <Button size="small" icon={<CheckCircleOutlined />} onClick={() => confirmAiCase(record)}>确认</Button>
                          </Space>
                        ) : '-',
                      },
                      { title: '更新时间', dataIndex: 'updated_at', render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-' },
                    ]}
                    pagination={{ pageSize: 10 }}
                  />
                </>
              ),
            },
            {
              key: 'baselines',
              label: '冻结基线',
              children: (
                <Table
                  loading={loading}
                  rowKey="id"
                  dataSource={baselines}
                  columns={[
                    { title: '基线名称', dataIndex: 'name' },
                    { title: '资产数', dataIndex: 'item_count', render: (value: number) => <Tag>{value}</Tag> },
                    { title: '状态', dataIndex: 'status', render: (value: string) => <Tag color={value === 'frozen' ? 'blue' : 'default'}>{value}</Tag> },
                    { title: '创建人', dataIndex: 'created_by' },
                    { title: '冻结人', dataIndex: 'frozen_by', render: (value: string) => value || '-' },
                    { title: '冻结时间', dataIndex: 'frozen_at', render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-' },
                    {
                      title: '操作',
                      render: (_: any, record: any) => record.status !== 'frozen' && (
                        <Button size="small" icon={<LockOutlined />} onClick={() => freezeBaseline(record.id)}>冻结</Button>
                      ),
                    },
                  ]}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'events',
              label: '审计事件',
              children: (
                <Table
                  loading={loading}
                  rowKey="id"
                  dataSource={events}
                  columns={[
                    { title: '动作', dataIndex: 'action', render: (value: string) => <Tag>{value}</Tag> },
                    { title: '资产', render: (_: any, record: any) => `${assetTypeText[record.asset_type] || record.asset_type} #${record.asset_id}` },
                    { title: '操作者', dataIndex: 'actor' },
                    { title: '说明', dataIndex: 'detail', ellipsis: true },
                    { title: '事件哈希', dataIndex: 'event_hash', render: (value: string) => <Text code>{value?.slice(0, 12)}</Text> },
                    { title: '时间', dataIndex: 'created_at', render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-' },
                  ]}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Drawer title="资产版本历史" open={drawerOpen} width={760} onClose={() => setDrawerOpen(false)}>
        {selectedAsset && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="资产">{selectedAsset.name}</Descriptions.Item>
              <Descriptions.Item label="类型">{assetTypeText[selectedAsset.asset_type]}</Descriptions.Item>
              <Descriptions.Item label="冻结状态">{selectedAsset.is_frozen ? '已冻结' : '未冻结'}</Descriptions.Item>
            </Descriptions>
            <Table
              size="small"
              rowKey="id"
              dataSource={versionsList}
              pagination={false}
              columns={[
                { title: '版本', dataIndex: 'version_no', render: (value: number) => <Tag>v{value}</Tag> },
                { title: '动作', dataIndex: 'action' },
                { title: '来源', dataIndex: 'source' },
                { title: '审批', dataIndex: 'approval_status', render: (value: string) => <Tag color={approvalColor[value]}>{value}</Tag> },
                { title: '说明', dataIndex: 'change_summary' },
                {
                  title: '操作',
                  render: (_: any, record: any) => (
                    <Space>
                      <Button size="small" icon={<DiffOutlined />} onClick={() => loadDiff(record.id)}>Diff</Button>
                      {record.approval_status === 'pending' && (
                        <Button size="small" icon={<CheckCircleOutlined />} onClick={() => approve(record.id, 'approved')}>确认</Button>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
            {diffDetail && (
              <Card size="small" title={<Space><DiffOutlined /> 变更 Diff</Space>}>
                <Table
                  size="small"
                  rowKey="field"
                  dataSource={diffDetail.diff || []}
                  pagination={false}
                  columns={[
                    { title: '字段', dataIndex: 'field', width: 160 },
                    { title: '变更前', dataIndex: 'before', render: (value: any) => <Text>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}</Text> },
                    { title: '变更后', dataIndex: 'after', render: (value: any) => <Text>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}</Text> },
                  ]}
                />
              </Card>
            )}
          </Space>
        )}
      </Drawer>

      <Modal
        title="创建冻结基线"
        open={baselineOpen}
        onCancel={() => setBaselineOpen(false)}
        onOk={createBaseline}
        okText="创建并冻结"
      >
        <Form form={baselineForm} layout="vertical" initialValues={{ project_id: projectId }}>
          <Form.Item name="name" label="基线名称" rules={[{ required: true, message: '请输入基线名称' }]}>
            <Input placeholder="例如：v1.2 回归测试基线" />
          </Form.Item>
          <Form.Item name="project_id" label="项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select options={projects.map((item) => ({ label: item.name, value: item.id }))} />
          </Form.Item>
          <Form.Item name="version_id" label="关联版本">
            <Select allowClear options={versions.map((item) => ({ label: item.version_number || item.name || `版本 #${item.id}`, value: item.id }))} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} placeholder="记录本次冻结范围和用途" />
          </Form.Item>
          <Text type="secondary"><SafetyCertificateOutlined /> 默认纳入所选项目当前全部功能用例和接口用例，并立即冻结。</Text>
        </Form>
      </Modal>
    </div>
  );
};

export default TestAssetAudit;
