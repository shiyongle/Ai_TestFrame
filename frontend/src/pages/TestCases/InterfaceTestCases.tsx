import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  PlayCircleFilled,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { interfaceTestcaseApi, projectApi, testApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

type Protocol = 'HTTP' | 'TCP' | 'MQ';
type Priority = 'high' | 'medium' | 'low';
type CaseStatus = 'active' | 'inactive';

interface InterfaceTestCase {
  id: string;
  name: string;
  description: string;
  protocol: Protocol;
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, any>;
  body: string;
  assertions: string;
  preconditions: string;
  testData: string;
  notes: string;
  module: string;
  priority: Priority;
  status: CaseStatus;
  projectId?: number;
  createdAt: string;
  updatedAt: string;
  lastRunStatus?: 'pass' | 'fail';
  lastRunTime?: string;
}

interface ProjectOption {
  id: number;
  name: string;
}

interface KVItem {
  key: string;
  value: string;
}

const getMethodColor = (method: string) => {
  const m = method.toUpperCase();
  if (m === 'GET') return '#1677ff';
  if (m === 'POST') return '#52c41a';
  if (m === 'PUT') return '#faad14';
  if (m === 'DELETE') return '#ff4d4f';
  if (m === 'PATCH') return '#13c2c2';
  return '#8c8c8c';
};

const getPriorityTag = (priority: Priority) => {
  if (priority === 'high') return <Tag color="red">高</Tag>;
  if (priority === 'low') return <Tag color="green">低</Tag>;
  return <Tag color="orange">中</Tag>;
};

const normalizeProtocol = (value: string): Protocol => {
  const v = String(value || '').toUpperCase();
  if (v === 'TCP') return 'TCP';
  if (v === 'MQ') return 'MQ';
  return 'HTTP';
};

const safeStringify = (value: any) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const parseObj = (value: any): Record<string, any> => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const objectToKVList = (obj: Record<string, any>): KVItem[] => {
  const entries = Object.entries(obj || {}).map(([k, v]) => ({ key: k, value: String(v) }));
  return entries.length ? entries : [{ key: '', value: '' }];
};

const kvListToObject = (items: KVItem[]): Record<string, string> => {
  return (items || []).reduce((acc, item) => {
    const k = String(item?.key || '').trim();
    if (!k) return acc;
    acc[k] = String(item?.value || '');
    return acc;
  }, {} as Record<string, string>);
};

const mapRawCase = (raw: any): InterfaceTestCase => {
  const cfg = raw?.config || {};
  const protocol = normalizeProtocol(raw?.protocol || cfg?.protocol || 'HTTP');
  const method = String(cfg?.method || raw?.method || 'GET').toUpperCase();
  return {
    id: String(raw?.id ?? Date.now()),
    name: String(raw?.name || cfg?.title || '未命名接口用例'),
    description: String(raw?.description || cfg?.description || ''),
    protocol,
    method,
    url: String(raw?.url || cfg?.url || ''),
    headers: parseObj(raw?.headers ?? cfg?.headers),
    params: parseObj(raw?.params ?? cfg?.params),
    body: safeStringify((raw?.body ?? cfg?.body) || ''),
    assertions: String(raw?.assertions || cfg?.assertions || ''),
    preconditions: String(raw?.preconditions || cfg?.preconditions || ''),
    testData: String(raw?.test_data || raw?.testData || cfg?.test_data || cfg?.testData || ''),
    notes: String(raw?.notes || cfg?.notes || ''),
    module: String(raw?.module || cfg?.module || '通用模块'),
    priority: (raw?.priority || cfg?.priority || 'medium') as Priority,
    status: (raw?.status || cfg?.status || 'active') as CaseStatus,
    projectId: raw?.project_id || raw?.projectId,
    createdAt: raw?.created_at || dayjs().format('YYYY-MM-DD HH:mm:ss'),
    updatedAt: raw?.updated_at || dayjs().format('YYYY-MM-DD HH:mm:ss'),
    lastRunStatus: raw?.last_run_status,
    lastRunTime: raw?.last_run_time,
  };
};

const toInterfacePayload = (item: InterfaceTestCase) => ({
  name: item.name,
  description: item.description || '',
  protocol: String(item.protocol || 'HTTP').toLowerCase(),
  method: item.method,
  url: item.url,
  headers: item.headers,
  params: item.params,
  body: item.body,
  assertions: item.assertions,
  preconditions: item.preconditions,
  test_data: item.testData,
  notes: item.notes,
  module: item.module,
  priority: item.priority,
  status: item.status,
  project_id: item.projectId,
  last_run_status: item.lastRunStatus,
  last_run_time: item.lastRunTime ? dayjs(item.lastRunTime).toISOString() : undefined,
});

const renderKV = (obj: Record<string, any>) => {
  const entries = Object.entries(obj || {});
  if (!entries.length) return <Text type="secondary">无</Text>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 8 }}>
          <Tag style={{ minWidth: 96, textAlign: 'center' }}>{k}</Tag>
          <Text style={{ wordBreak: 'break-all' }}>{String(v)}</Text>
        </div>
      ))}
    </div>
  );
};

const InterfaceTestCases: React.FC = () => {
  const [testCases, setTestCases] = useState<InterfaceTestCase[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [protocolFilter, setProtocolFilter] = useState<'all' | Protocol>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<string>('');
  const [form] = Form.useForm();

  const loadCases = async () => {
    setLoading(true);
    try {
      const rawList = await interfaceTestcaseApi.getAll(projectFilter !== 'all' ? Number(projectFilter) : undefined);
      const mapped = (rawList || []).map(mapRawCase);
      setTestCases(mapped);
      if (mapped.length && !selectedCaseId) setSelectedCaseId(mapped[0].id);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '加载接口测试用例失败');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const list = await projectApi.getProjects();
      setProjects(list || []);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '加载项目列表失败');
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadCases();
  }, [projectFilter]);

  const filteredCases = useMemo(
    () =>
      testCases.filter((c) => {
        const matchedSearch =
          !searchText ||
          c.name.toLowerCase().includes(searchText.toLowerCase()) ||
          c.url.toLowerCase().includes(searchText.toLowerCase()) ||
          c.module.toLowerCase().includes(searchText.toLowerCase());
        const matchedProject = projectFilter === 'all' || String(c.projectId || '') === projectFilter;
        const matchedProtocol = protocolFilter === 'all' || c.protocol === protocolFilter;
        const matchedPriority = priorityFilter === 'all' || c.priority === priorityFilter;
        return matchedSearch && matchedProject && matchedProtocol && matchedPriority;
      }),
    [testCases, searchText, projectFilter, protocolFilter, priorityFilter]
  );

  useEffect(() => {
    if (!filteredCases.length) {
      setSelectedCaseId('');
      return;
    }
    if (!filteredCases.some((c) => c.id === selectedCaseId)) {
      setSelectedCaseId(filteredCases[0].id);
    }
  }, [filteredCases, selectedCaseId]);

  const selectedCase = useMemo(
    () => testCases.find((c) => c.id === selectedCaseId) || null,
    [testCases, selectedCaseId]
  );

  const getProjectName = (projectId?: number) => {
    if (!projectId) return '未关联';
    return projects.find((p) => p.id === projectId)?.name || `项目#${projectId}`;
  };

  const handleCreate = () => {
    setEditingCaseId('');
    form.resetFields();
    form.setFieldsValue({
      projectId: projectFilter !== 'all' ? Number(projectFilter) : undefined,
      protocol: 'HTTP',
      method: 'GET',
      priority: 'medium',
      status: 'active',
      headersList: [{ key: '', value: '' }],
      paramsList: [{ key: '', value: '' }],
    });
    setModalVisible(true);
  };

  const handleEdit = () => {
    if (!selectedCase) return;
    setEditingCaseId(selectedCase.id);
    form.setFieldsValue({
      ...selectedCase,
      projectId: selectedCase.projectId,
      headersList: objectToKVList(selectedCase.headers),
      paramsList: objectToKVList(selectedCase.params),
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const nextCase: InterfaceTestCase = {
        id: editingCaseId || String(Date.now()),
        name: values.name,
        description: values.description || '',
        protocol: values.protocol,
        method: String(values.method || 'GET').toUpperCase(),
        url: values.url || '',
        headers: kvListToObject(values.headersList || []),
        params: kvListToObject(values.paramsList || []),
        body: values.body || '',
        assertions: values.assertions || '',
        preconditions: values.preconditions || '',
        testData: values.testData || '',
        notes: values.notes || '',
        module: values.module || '通用模块',
        priority: values.priority || 'medium',
        status: values.status || 'active',
        projectId: values.projectId ? Number(values.projectId) : undefined,
        createdAt: editingCaseId ? selectedCase?.createdAt || now : now,
        updatedAt: now,
        lastRunStatus: editingCaseId ? selectedCase?.lastRunStatus : undefined,
        lastRunTime: editingCaseId ? selectedCase?.lastRunTime : undefined,
      };

      if (!nextCase.projectId) {
        message.error('所属项目不能为空');
        return;
      }

      if (editingCaseId) {
        const updated = await interfaceTestcaseApi.update(Number(editingCaseId), toInterfacePayload(nextCase));
        setTestCases((prev) => prev.map((item) => (item.id === editingCaseId ? mapRawCase(updated) : item)));
        setSelectedCaseId(String(updated.id));
        message.success('接口用例更新成功');
      } else {
        const created = await interfaceTestcaseApi.create(toInterfacePayload(nextCase));
        setTestCases((prev) => [mapRawCase(created), ...prev]);
        setSelectedCaseId(String(created.id));
        message.success('接口用例创建成功');
      }
      setModalVisible(false);
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验由 antd 提示
      message.error(e?.response?.data?.detail || '保存失败');
    }
  };

  const handleDelete = () => {
    if (!selectedCase) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定删除接口用例“${selectedCase.name}”吗？`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await interfaceTestcaseApi.delete(Number(selectedCase.id));
          setTestCases((prev) => prev.filter((item) => item.id !== selectedCase.id));
          message.success('删除成功');
        } catch (e: any) {
          message.error(e?.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  const handleCopy = () => {
    if (!selectedCase) return;
    if (!selectedCase.projectId) {
      message.error('该用例缺少所属项目，无法复制');
      return;
    }
    const copied: InterfaceTestCase = {
      ...selectedCase,
      name: `${selectedCase.name}（副本）`,
      lastRunStatus: undefined,
      lastRunTime: undefined,
    };
    interfaceTestcaseApi
      .create(toInterfacePayload(copied))
      .then((created) => {
        const mapped = mapRawCase(created);
        setTestCases((prev) => [mapped, ...prev]);
        setSelectedCaseId(mapped.id);
        message.success('复制成功');
      })
      .catch((e: any) => {
        message.error(e?.response?.data?.detail || '复制失败');
      });
  };

  const handleRun = async () => {
    if (!selectedCase) return;
    try {
      let success = false;
      if (selectedCase.protocol === 'HTTP') {
        const result = await testApi.testHttp({
          url: selectedCase.url,
          method: (selectedCase.method || 'GET').toUpperCase(),
          headers: selectedCase.headers || {},
          params: selectedCase.params || {},
          body: selectedCase.body || '',
          timeout: 30,
          verify_ssl: true,
          follow_redirects: true,
        } as any);
        success = !!result?.success;
      } else if (selectedCase.protocol === 'TCP') {
        const url = selectedCase.url || '';
        const host = url.includes(':') ? url.split(':')[0] : url || '127.0.0.1';
        const portStr = url.includes(':') ? url.split(':')[1] : '80';
        const result = await testApi.testTcp({
          host,
          port: Number(portStr) || 80,
          data: selectedCase.body || selectedCase.testData || '',
          timeout: 30,
          encoding: 'utf-8',
        } as any);
        success = !!result?.success;
      } else {
        const result = await testApi.testMq({
          host: selectedCase.url || '127.0.0.1',
          port: 5672,
          queue_name: 'default',
          message: selectedCase.body || selectedCase.testData || '',
          exchange: '',
          routing_key: '',
          timeout: 30,
          mq_type: 'rabbitmq',
          username: 'guest',
          password: 'guest',
        } as any);
        success = !!result?.success;
      }

      const status: 'pass' | 'fail' = success ? 'pass' : 'fail';
      const runTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const runTimeIso = dayjs().toISOString();
      setTestCases((prev) =>
        prev.map((item) =>
          item.id === selectedCase.id
            ? { ...item, lastRunStatus: status, lastRunTime: runTime, updatedAt: runTime }
            : item
        )
      );
      interfaceTestcaseApi.update(Number(selectedCase.id), {
        last_run_status: status,
        last_run_time: runTimeIso,
      }).catch(() => undefined);
      message.success(status === 'pass' ? '执行通过' : '执行失败');
    } catch (e: any) {
      const runTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
      setTestCases((prev) =>
        prev.map((item) =>
          item.id === selectedCase.id
            ? { ...item, lastRunStatus: 'fail', lastRunTime: runTime, updatedAt: runTime }
            : item
        )
      );
      message.error(e?.response?.data?.detail || '执行失败');
    }
  };

  return (
    <div
      className="app-content fade-in"
      style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
            接口测试用例
          </Title>
          <Text type="secondary">统一管理接口用例定义，展示协议、请求与断言信息</Text>
        </div>
        <Space size={12}>
          <Select
            value={projectFilter}
            onChange={setProjectFilter}
            style={{ width: 180 }}
            options={[
              { value: 'all', label: '全部项目' },
              ...projects.map((p) => ({ value: String(p.id), label: p.name })),
            ]}
          />
          <Select
            value={protocolFilter}
            onChange={setProtocolFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部协议' },
              { value: 'HTTP', label: 'HTTP' },
              { value: 'TCP', label: 'TCP' },
              { value: 'MQ', label: 'MQ' },
            ]}
          />
          <Select
            value={priorityFilter}
            onChange={setPriorityFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部等级' },
              { value: 'high', label: '高' },
              { value: 'medium', label: '中' },
              { value: 'low', label: '低' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} shape="round" size="large" onClick={handleCreate}>
            新增接口用例
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 20, flex: 1, overflow: 'hidden' }}>
        <div className="glass-panel" style={{ flex: '0 0 360px', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#ccc' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索名称 / URL / 模块"
              bordered={false}
              style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            <List
              loading={loading}
              dataSource={filteredCases}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无接口用例" /> }}
              renderItem={(item) => (
                <List.Item style={{ padding: 0, border: 'none' }}>
                  <div
                    onClick={() => setSelectedCaseId(item.id)}
                    style={{
                      width: '100%',
                      marginBottom: 8,
                      borderRadius: 10,
                      padding: '12px 12px 10px',
                      cursor: 'pointer',
                      background: selectedCaseId === item.id ? 'rgba(22,119,255,0.1)' : 'transparent',
                      borderLeft: selectedCaseId === item.id ? '3px solid #1677ff' : '3px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text strong style={{ color: selectedCaseId === item.id ? '#1677ff' : '#1f1f1f' }}>
                        {item.name}
                      </Text>
                      <Space size={4}>
                        {item.lastRunStatus && (
                          <Tag color={item.lastRunStatus === 'pass' ? 'success' : 'error'}>
                            {item.lastRunStatus === 'pass' ? '最近通过' : '最近失败'}
                          </Tag>
                        )}
                      </Space>
                    </div>
                    <Space size={6} wrap>
                      <Tag color="blue">{item.protocol}</Tag>
                      <Tag style={{ color: getMethodColor(item.method), borderColor: `${getMethodColor(item.method)}66` }}>
                        {item.method}
                      </Tag>
                      {getPriorityTag(item.priority)}
                    </Space>
                    <div style={{ marginTop: 6 }}>
                      <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                        {item.url || '未配置请求地址'}
                      </Text>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </div>
        </div>

        <div className="glass-panel" style={{ flex: 1, borderRadius: 16, overflowY: 'auto', background: 'rgba(255,255,255,0.88)' }}>
          {selectedCase ? (
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <Space align="center" size={8}>
                    <Avatar icon={<ApiOutlined />} size="small" />
                    <Text type="secondary">API-{selectedCase.id}</Text>
                  </Space>
                  <Title level={3} style={{ margin: '8px 0 6px' }}>
                    {selectedCase.name}
                  </Title>
                  <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    {selectedCase.description || '暂无描述'}
                  </Paragraph>
                  <Space wrap>
                    <Tag color="blue">{selectedCase.protocol}</Tag>
                    <Tag style={{ color: getMethodColor(selectedCase.method), borderColor: `${getMethodColor(selectedCase.method)}66` }}>
                      {selectedCase.method}
                    </Tag>
                    {getPriorityTag(selectedCase.priority)}
                    <Tag color={selectedCase.status === 'active' ? 'success' : 'default'}>
                      {selectedCase.status === 'active' ? '激活' : '停用'}
                    </Tag>
                  </Space>
                </div>

                <Space>
                  <Tooltip title="执行">
                    <Button type="primary" icon={<PlayCircleFilled />} onClick={handleRun}>
                      执行
                    </Button>
                  </Tooltip>
                  <Tooltip title="编辑">
                    <Button icon={<EditOutlined />} onClick={handleEdit} />
                  </Tooltip>
                  <Tooltip title="复制">
                    <Button icon={<CopyOutlined />} onClick={handleCopy} />
                  </Tooltip>
                  <Tooltip title="删除">
                    <Button danger icon={<DeleteOutlined />} onClick={handleDelete} />
                  </Tooltip>
                </Space>
              </div>

              <Divider />

              <Row gutter={12}>
                <Col span={8}>
                  <Card size="small" style={{ borderRadius: 10 }}>
                    <Text type="secondary">模块</Text>
                    <div style={{ marginTop: 6 }}>
                      <Text>{selectedCase.module}</Text>
                    </div>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" style={{ borderRadius: 10 }}>
                    <Text type="secondary">所属项目</Text>
                    <div style={{ marginTop: 6 }}>
                      <Text>{getProjectName(selectedCase.projectId)}</Text>
                    </div>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" style={{ borderRadius: 10 }}>
                    <Text type="secondary">最近执行</Text>
                    <div style={{ marginTop: 6 }}>
                      <Text>{selectedCase.lastRunTime || '暂无'}</Text>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <Card size="small" style={{ borderRadius: 10, marginBottom: 12 }}>
                <Text type="secondary">请求地址</Text>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GlobalOutlined style={{ color: '#8c8c8c' }} />
                  <Text code style={{ fontSize: 12 }}>
                    {selectedCase.url || '未配置 URL'}
                  </Text>
                </div>
              </Card>

              <Row gutter={12}>
                <Col span={12}>
                  <Card size="small" title="请求头 Headers" style={{ borderRadius: 10 }}>
                    {renderKV(selectedCase.headers)}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="请求参数 Params" style={{ borderRadius: 10 }}>
                    {renderKV(selectedCase.params)}
                  </Card>
                </Col>
              </Row>

              <Card size="small" title="请求体 Body" style={{ borderRadius: 10, marginTop: 12 }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
                  {selectedCase.body || '无'}
                </pre>
              </Card>

              <Row gutter={12} style={{ marginTop: 12 }}>
                <Col span={12}>
                  <Card size="small" title="断言" style={{ borderRadius: 10 }}>
                    <Text>{selectedCase.assertions || '无'}</Text>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="测试数据" style={{ borderRadius: 10 }}>
                    <Text>{selectedCase.testData || '无'}</Text>
                  </Card>
                </Col>
              </Row>

              <Row gutter={12} style={{ marginTop: 12 }}>
                <Col span={12}>
                  <Card size="small" title="前置条件" style={{ borderRadius: 10 }}>
                    <Text>{selectedCase.preconditions || '无'}</Text>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="备注" style={{ borderRadius: 10 }}>
                    <Text>{selectedCase.notes || '无'}</Text>
                  </Card>
                </Col>
              </Row>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', color: '#8c8c8c', fontSize: 12 }}>
                <span>创建时间：{dayjs(selectedCase.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                <span>更新时间：{dayjs(selectedCase.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</span>
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty description="请选择左侧接口用例查看详情" />
            </div>
          )}
        </div>
      </div>

      <Modal
        title={editingCaseId ? '编辑接口用例' : '新增接口用例'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={900}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Card size="small" title="基础信息" style={{ borderRadius: 10, marginBottom: 12 }}>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="name" label="用例名称" rules={[{ required: true, message: '请输入用例名称' }]}>
                  <Input placeholder="例如：查询用户详情接口鉴权校验" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="projectId" label="所属项目" rules={[{ required: true, message: '请选择所属项目' }]}>
                  <Select
                    placeholder="请选择项目"
                    options={projects.map((p) => ({ value: p.id, label: p.name }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="module" label="所属模块">
                  <Input placeholder="如：用户中心 / 订单中心" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="description" label="描述">
                  <Input placeholder="简述该接口用例覆盖的业务目标" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="protocol" label="协议">
                  <Select
                    options={[
                      { value: 'HTTP', label: 'HTTP' },
                      { value: 'TCP', label: 'TCP' },
                      { value: 'MQ', label: 'MQ' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="method" label="方法">
                  <Select
                    options={[
                      { value: 'GET', label: 'GET' },
                      { value: 'POST', label: 'POST' },
                      { value: 'PUT', label: 'PUT' },
                      { value: 'DELETE', label: 'DELETE' },
                      { value: 'PATCH', label: 'PATCH' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="priority" label="优先级">
                  <Select
                    options={[
                      { value: 'high', label: '高' },
                      { value: 'medium', label: '中' },
                      { value: 'low', label: '低' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="status" label="状态">
                  <Select
                    options={[
                      { value: 'active', label: '激活' },
                      { value: 'inactive', label: '停用' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="url" label="请求地址">
              <Input placeholder="https://api.example.com/v1/..." prefix={<GlobalOutlined style={{ color: '#bfbfbf' }} />} />
            </Form.Item>
          </Card>

          <Row gutter={12}>
            <Col span={12}>
              <Card
                size="small"
                title="请求头 Headers"
                style={{ borderRadius: 10, marginBottom: 12 }}
                extra={<Text type="secondary" style={{ fontSize: 12 }}>键值方式录入</Text>}
              >
                <Form.List name="headersList">
                  {(fields, { add, remove }) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {fields.map((field) => (
                        <Space key={field.key} align="baseline" style={{ display: 'flex' }}>
                          <Form.Item name={[field.name, 'key']} style={{ marginBottom: 0, width: 160 }}>
                            <Input placeholder="Header Key" />
                          </Form.Item>
                          <Form.Item name={[field.name, 'value']} style={{ marginBottom: 0, flex: 1 }}>
                            <Input placeholder="Header Value" />
                          </Form.Item>
                          <Button
                            type="text"
                            danger
                            icon={<MinusCircleOutlined />}
                            onClick={() => remove(field.name)}
                          />
                        </Space>
                      ))}
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ key: '', value: '' })}>
                        添加 Header
                      </Button>
                    </div>
                  )}
                </Form.List>
              </Card>
            </Col>
            <Col span={12}>
              <Card
                size="small"
                title="请求参数 Params"
                style={{ borderRadius: 10, marginBottom: 12 }}
                extra={<Text type="secondary" style={{ fontSize: 12 }}>键值方式录入</Text>}
              >
                <Form.List name="paramsList">
                  {(fields, { add, remove }) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {fields.map((field) => (
                        <Space key={field.key} align="baseline" style={{ display: 'flex' }}>
                          <Form.Item name={[field.name, 'key']} style={{ marginBottom: 0, width: 160 }}>
                            <Input placeholder="Param Key" />
                          </Form.Item>
                          <Form.Item name={[field.name, 'value']} style={{ marginBottom: 0, flex: 1 }}>
                            <Input placeholder="Param Value" />
                          </Form.Item>
                          <Button
                            type="text"
                            danger
                            icon={<MinusCircleOutlined />}
                            onClick={() => remove(field.name)}
                          />
                        </Space>
                      ))}
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ key: '', value: '' })}>
                        添加 Param
                      </Button>
                    </div>
                  )}
                </Form.List>
              </Card>
            </Col>
          </Row>

          <Card size="small" title="请求体与校验" style={{ borderRadius: 10 }}>
            <Form.Item name="body" label="Body">
              <TextArea rows={4} placeholder="支持 JSON / 文本格式" style={{ fontFamily: 'Consolas, Monaco, monospace' }} />
            </Form.Item>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="assertions" label="断言">
                  <TextArea rows={2} placeholder="例如：status === 200 && body.code === 0" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="testData" label="测试数据">
                  <TextArea rows={2} placeholder="例如：userId=1001, token=xxx" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="preconditions" label="前置条件">
                  <TextArea rows={2} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="notes" label="备注">
                  <TextArea rows={2} />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Form>
      </Modal>
    </div>
  );
};

export default InterfaceTestCases;
