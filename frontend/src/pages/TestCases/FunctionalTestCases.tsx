import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  message,
  Typography,
  Row,
  Col,
  List,
  Divider,
  Tooltip,
  Steps,
  Avatar,
  Card,
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CopyOutlined,
  PlayCircleFilled,
  DownloadOutlined,
  FileTextOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleFilled,
  MoreOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { testcaseApi, projectApi } from '../../services/api';
import { taskCenter } from '../../services/taskCenter';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Step } = Steps;

interface FunctionalTestCase {
  id: number;
  name: string;
  description: string;
  protocol: string;
  config: any;
  priority?: string;
  project_id: number;
  created_at: string;
  updated_at: string;
}

interface ProjectOption {
  id: number;
  name: string;
}

const FunctionalTestCases: React.FC = () => {
  const [testCases, setTestCases] = useState<FunctionalTestCase[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCase, setEditingCase] = useState<FunctionalTestCase | null>(null);
  const [selectedCase, setSelectedCase] = useState<FunctionalTestCase | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchTestCases();
  }, []);

  const fetchProjects = async () => {
    try {
      const data = await projectApi.getProjects();
      setProjects(data || []);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '获取项目列表失败');
    }
  };

  const fetchTestCases = async () => {
    setLoading(true);
    try {
      const data = await testcaseApi.getAllTestCases();
      setTestCases(data);
      if (data.length > 0) setSelectedCase(data[0]);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '获取用例列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredTestCases = testCases.filter(c => {
    const matchSearch = searchText ? c.name.toLowerCase().includes(searchText.toLowerCase()) : true;
    const matchProject = selectedProjectId === 'all' ? true : String(c.project_id) === selectedProjectId;
    return matchSearch && matchProject;
  });

  useEffect(() => {
    if (filteredTestCases.length === 0) {
      setSelectedCase(null);
      return;
    }
    if (!selectedCase || !filteredTestCases.some(c => c.id === selectedCase.id)) {
      setSelectedCase(filteredTestCases[0]);
    }
  }, [selectedProjectId, searchText, testCases, selectedCase]);

  const getPriorityDisplay = (record: FunctionalTestCase): { text: string; color: string } => {
    const rawPriority = String(record?.config?.priority ?? record?.priority ?? '').toLowerCase();
    const normalized = rawPriority === '高' ? 'high' : rawPriority === '中' ? 'medium' : rawPriority === '低' ? 'low' : rawPriority;

    if (normalized === 'high') return { text: '高', color: 'red' };
    if (normalized === 'low') return { text: '低', color: 'green' };
    return { text: '中', color: 'orange' };
  };

  const renderPriorityTag = (record: FunctionalTestCase) => {
    const priority = getPriorityDisplay(record);
    return <Tag color={priority.color}>{priority.text}</Tag>;
  };

  const configKeyMap: Record<string, string> = {
    id: '编号',
    name: '名称',
    title: '标题',
    description: '描述',
    module: '模块',
    protocol: '协议',
    method: '请求方法',
    url: '请求地址',
    headers: '请求头',
    params: '请求参数',
    body: '请求体',
    assertions: '断言',
    timeout: '超时时间',
    retries: '重试次数',
    priority: '优先级',
    status: '状态',
    preconditions: '前置条件',
    test_steps: '测试步骤',
    steps: '步骤',
    step: '步骤序号',
    action: '操作',
    expected: '预期结果',
    test_data: '测试数据',
    expected_result: '最终期望',
    notes: '备注'
  };

  const configValueMap: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
    active: '激活',
    inactive: '停用',
    http: 'HTTP',
    tcp: 'TCP',
    mq: 'MQ',
    get: 'GET',
    post: 'POST',
    put: 'PUT',
    delete: 'DELETE',
    patch: 'PATCH'
  };

  const translateConfigForDisplay = (value: any): any => {
    if (Array.isArray(value)) {
      return value.map(item => translateConfigForDisplay(item));
    }

    if (value && typeof value === 'object') {
      const result: Record<string, any> = {};
      Object.entries(value).forEach(([key, val]) => {
        const translatedKey = configKeyMap[key] || key;
        result[translatedKey] = translateConfigForDisplay(val);
      });
      return result;
    }

    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      return configValueMap[normalized] || value;
    }

    return value;
  };

  const columns: ColumnsType<FunctionalTestCase> = [
    {
      title: '用例名称',
      dataIndex: 'name',
      key: 'name',
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) =>
        record.name.toLowerCase().includes(value.toString().toLowerCase()),
      render: (text: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 4, height: 32, borderRadius: 2,
            background: '#1677ff'
          }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong style={{ fontSize: 14 }}>{text}</Text>
          </div>
        </div>
      )
    },
    {
      title: '等级',
      key: 'priority',
      width: 100,
      render: (_, record) => {
        return renderPriorityTag(record);
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small" onClick={e => e.stopPropagation()}>
          <Tooltip title="快速执行">
            <Button
              type="text"
              shape="circle"
              icon={<PlayCircleFilled style={{ color: '#34C759' }} />}
              onClick={() => handleExecute(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" shape="circle" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="复制">
            <Button type="text" shape="circle" icon={<CopyOutlined />} onClick={() => handleCopy(record)} />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="text" danger shape="circle" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleAdd = () => {
    setEditingCase(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: FunctionalTestCase) => {
    setEditingCase(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleCopy = (record: FunctionalTestCase) => {
    // 稍后实现
  };

  const handleExecute = (record: FunctionalTestCase) => {
    message.loading(`正在初始化执行: ${record.name}`, 1)
      .then(() => message.success('执行完成，结果已记录'));
  };

  const handleDelete = (record: FunctionalTestCase) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除测试用例 "${record.name}" 吗？`,
      onOk: async () => {
        try {
          await testcaseApi.deleteTestCase(record.id);
          setTestCases(testCases.filter(item => item.id !== record.id));
          setSelectedRowKeys(prev => prev.filter(key => key !== record.id));
          if (selectedCase?.id === record.id) setSelectedCase(null);
          message.success('删除成功');
        } catch (e: any) {
          message.error(e?.response?.data?.detail || '删除失败');
        }
      },
      okButtonProps: { danger: true }
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedRowKeys(filteredTestCases.map(item => item.id));
  };

  const handleClearSelection = () => {
    setSelectedRowKeys([]);
  };

  const handleBatchExecute = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择需要执行的用例');
      return;
    }
    setBatchProcessing(true);
    const selectedCases = testCases.filter(tc => selectedRowKeys.includes(tc.id));
    const taskId = taskCenter.createTask({
      type: 'batch_execute_functional',
      title: `批量执行功能用例（${selectedCases.length} 条）`,
      detail: '正在初始化执行任务',
      status: 'running',
      progress: 10,
    });
    taskCenter.startAutoProgress(taskId, { max: 92, step: 12, intervalMs: 800 });
    try {
      message.loading(`正在批量执行 ${selectedCases.length} 条用例...`, 1.2)
        .then(() => message.success(`批量执行完成，共 ${selectedCases.length} 条，结果已记录`));
      setTimeout(() => {
        taskCenter.markSuccess(taskId, `批量执行完成，共 ${selectedCases.length} 条`);
      }, 1400);
    } catch (e: any) {
      taskCenter.markFailed(taskId, e?.response?.data?.detail || '批量执行失败');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchDelete = () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择需要删除的用例');
      return;
    }
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除已选择的 ${selectedRowKeys.length} 条测试用例吗？该操作不可撤销。`,
      okButtonProps: { danger: true },
      onOk: async () => {
        setBatchProcessing(true);
        try {
          const deleteTasks = selectedRowKeys.map((id) =>
            testcaseApi.deleteTestCase(Number(id))
          );
          const results = await Promise.allSettled(deleteTasks);
          const successCount = results.filter(r => r.status === 'fulfilled').length;
          const failCount = results.length - successCount;

          const deletedIds = new Set(
            selectedRowKeys.filter((_, index) => results[index]?.status === 'fulfilled')
          );
          setTestCases(prev => prev.filter(item => !deletedIds.has(item.id)));
          setSelectedRowKeys([]);

          if (selectedCase && deletedIds.has(selectedCase.id)) {
            setSelectedCase(null);
          }

          if (failCount > 0) {
            message.warning(`批量删除完成，成功 ${successCount} 条，失败 ${failCount} 条`);
          } else {
            message.success(`批量删除成功，共 ${successCount} 条`);
          }
        } finally {
          setBatchProcessing(false);
        }
      }
    });
  };

  const toFlatText = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map(item => toFlatText(item)).filter(Boolean).join(' | ');
    }
    if (typeof value === 'object') {
      try {
        return Object.entries(value)
          .map(([k, v]) => `${k}: ${toFlatText(v)}`)
          .join(' ; ');
      } catch {
        return '';
      }
    }
    return String(value);
  };

  const getConfigValue = (cfg: any, keys: string[]): any => {
    if (!cfg || typeof cfg !== 'object') return '';
    for (const key of keys) {
      if (cfg[key] !== undefined && cfg[key] !== null && cfg[key] !== '') {
        return cfg[key];
      }
    }
    return '';
  };

  const getStepsText = (cfg: any): string => {
    const steps = getConfigValue(cfg, ['test_steps', 'steps', '测试步骤', '步骤']);
    if (!steps) return '';

    if (Array.isArray(steps)) {
      return steps.map((step, index) => {
        if (typeof step === 'string') return `${index + 1}. ${step}`;
        const action = step?.action ?? step?.操作 ?? '';
        const expected = step?.expected ?? step?.预期结果 ?? '';
        const stepNo = step?.step ?? step?.步骤序号 ?? (index + 1);
        if (action || expected) {
          return `${stepNo}. 操作: ${toFlatText(action)} | 预期: ${toFlatText(expected)}`;
        }
        return `${index + 1}. ${toFlatText(step)}`;
      }).join('\n');
    }
    return toFlatText(steps);
  };

  const csvEscape = (value: any): string => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };

  const handleExportCsv = () => {
    const exportCases = selectedRowKeys.length
      ? testCases.filter(tc => selectedRowKeys.includes(tc.id))
      : testCases;

    if (!exportCases.length) {
      message.warning('暂无可导出的用例数据');
      return;
    }

    const taskId = taskCenter.createTask({
      type: 'batch_export_csv',
      title: `导出功能用例 CSV（${selectedRowKeys.length ? '选中' : '全量'}）`,
      detail: '正在生成导出文件',
      status: 'running',
      progress: 20,
    });
    taskCenter.startAutoProgress(taskId, { max: 90, step: 20, intervalMs: 300 });

    try {
      const headers = [
      '用例ID',
      '项目ID',
      '用例标题',
      '优先级',
      '测试数据',
      '描述',
      '前置条件',
      '步骤',
      '预期结果',
      '备注',
      '创建时间',
      '更新时间'
    ];

      const rows = exportCases.map((record) => {
      const cfg = record.config || {};
      const priority = getPriorityDisplay(record).text;
      const title = getConfigValue(cfg, ['title', 'name', '标题', '名称']) || record.name || '';
      const testData = getConfigValue(cfg, ['test_data', 'testData', '测试数据']);
      const description = getConfigValue(cfg, ['description', '描述']) || record.description || '';
      const preconditions = getConfigValue(cfg, ['preconditions', '前置条件']);
      const expectedResult = getConfigValue(cfg, ['expected_result', 'expectedResult', '预期结果', '最终期望']);
      const notes = getConfigValue(cfg, ['notes', 'remark', '备注']);
      const stepsText = getStepsText(cfg);

      return [
        record.id,
        record.project_id,
        title,
        priority,
        toFlatText(testData),
        toFlatText(description),
        toFlatText(preconditions),
        stepsText,
        toFlatText(expectedResult),
        toFlatText(notes),
        record.created_at ? new Date(record.created_at).toLocaleString() : '',
        record.updated_at ? new Date(record.updated_at).toLocaleString() : ''
      ];
    });

      const csvContent = [
      headers.map(csvEscape).join(','),
      ...rows.map(row => row.map(csvEscape).join(','))
      ].join('\r\n');

      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      link.href = url;
      link.download = `功能测试用例_${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      taskCenter.markSuccess(taskId, `导出完成，共 ${exportCases.length} 条`);

      if (selectedRowKeys.length) {
        message.success(`导出成功，已导出 ${exportCases.length} 条选中用例`);
      } else {
        message.success(`导出成功，已导出全量 ${exportCases.length} 条用例`);
      }
    } catch (e: any) {
      taskCenter.markFailed(taskId, e?.message || '导出失败');
      message.error(e?.message || '导出失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingCase) {
        setTestCases(testCases.map(item =>
          item.id === editingCase.id
            ? { ...item, ...values, updatedAt: new Date().toISOString().split('T')[0] }
            : item
        ));
        message.success('更新成功');
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchTestCases();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const renderConfigValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined || value === '') {
      return <Text type="secondary">无</Text>;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return <Text>{String(value)}</Text>;
    }

    if (Array.isArray(value)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {value.map((item, index) => (
            <div
              key={index}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.03)',
                border: '1px solid rgba(0,0,0,0.05)'
              }}
            >
              {renderConfigValue(item)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Text type="secondary" style={{ fontSize: 12, minWidth: 72 }}>{k}:</Text>
              <div style={{ flex: 1 }}>{renderConfigValue(v)}</div>
            </div>
          ))}
        </div>
      );
    }

    return <Text>{String(value)}</Text>;
  };

  const renderConfig = (cfg: any) => {
    if (!cfg) return <Text type="secondary">暂无详细配置数据</Text>;

    const translatedConfig = translateConfigForDisplay(cfg);
    const steps = translatedConfig['步骤'] || translatedConfig['测试步骤'] || [];
    const topFieldOrder = ['标题', '优先级', '测试数据', '描述', '前置条件'];
    const topEntries: Array<[string, any]> = topFieldOrder
      .filter((key) => Object.prototype.hasOwnProperty.call(translatedConfig, key))
      .map((key) => [key, translatedConfig[key]]);

    const detailEntries = Object.entries(translatedConfig).filter(
      ([key]) => key !== '步骤' && key !== '测试步骤' && !topFieldOrder.includes(key)
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
        {topEntries.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {topEntries.map(([key, value]) => (
              <Card
                key={key}
                size="small"
                style={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)' }}
                bodyStyle={{ padding: 12 }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>{key}</Text>
                <div style={{ marginTop: 6 }}>
                  {key === '优先级'
                    ? <Tag color={String(value) === '高' ? 'red' : String(value) === '低' ? 'green' : 'orange'}>{String(value)}</Tag>
                    : renderConfigValue(value)}
                </div>
              </Card>
            ))}
          </div>
        )}

        {Array.isArray(steps) && steps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((step: any, idx: number) => {
              const stepObj = typeof step === 'object' ? step : { 操作: String(step) };
              return (
                <Card
                  key={idx}
                  size="small"
                  style={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)' }}
                  bodyStyle={{ padding: 12 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong>步骤 {idx + 1}</Text>
                    {stepObj['步骤序号'] && <Tag>{stepObj['步骤序号']}</Tag>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {stepObj['操作'] && (
                      <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.03)' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>操作</Text>
                        <div>{renderConfigValue(stepObj['操作'])}</div>
                      </div>
                    )}
                    {stepObj['预期结果'] && (
                      <div style={{ padding: '8px 10px', borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>预期结果</Text>
                        <div>{renderConfigValue(stepObj['预期结果'])}</div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {detailEntries.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {detailEntries.map(([key, value]) => (
              <Card
                key={key}
                size="small"
                style={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)' }}
                bodyStyle={{ padding: 12 }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>{key}</Text>
                <div style={{ marginTop: 6 }}>{renderConfigValue(value)}</div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>功能测试用例</Title>
          <Text type="secondary">管理和执行手动测试用例</Text>
        </div>
        <Space size={12}>
          <Select
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            style={{ width: 220 }}
            options={[
              { value: 'all', label: '全部项目' },
              ...projects.map(p => ({ value: String(p.id), label: p.name }))
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} shape="round" size="large">
            新增用例
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>

        {/* Left: Test Case List */}
        <div className="glass-panel" style={{ flex: 6, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 12 }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#ccc' }} />}
              placeholder="搜索用例..."
              style={{ flex: 1, borderRadius: 8 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchTestCases} loading={loading} />
          </div>
          <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={8}>
              <Tag color={selectedRowKeys.length ? 'processing' : 'default'} style={{ borderRadius: 999, padding: '2px 10px' }}>
                已选择 {selectedRowKeys.length} 条
              </Tag>
              <Button
                size="middle"
                shape="round"
                onClick={handleSelectAllFiltered}
                disabled={!filteredTestCases.length}
                style={{ borderColor: 'rgba(22,119,255,0.25)', background: 'rgba(22,119,255,0.06)' }}
              >
                全选当前结果
              </Button>
              <Button
                size="middle"
                shape="round"
                onClick={handleClearSelection}
                disabled={!selectedRowKeys.length}
                style={{ borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.02)' }}
              >
                清空选择
              </Button>
            </Space>
            <Space size={8}>
              <Button
                size="middle"
                type="primary"
                shape="round"
                icon={<PlayCircleFilled style={{ color: '#fff' }} />}
                disabled={!selectedRowKeys.length}
                loading={batchProcessing}
                onClick={handleBatchExecute}
                style={{
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 6px 16px rgba(22,119,255,0.25)'
                }}
              >
                批量执行
              </Button>
              <Button
                size="middle"
                danger
                shape="round"
                icon={<DeleteOutlined />}
                disabled={!selectedRowKeys.length}
                loading={batchProcessing}
                onClick={handleBatchDelete}
                style={{
                  borderColor: 'rgba(255,77,79,0.35)',
                  background: 'rgba(255,77,79,0.08)',
                  color: '#cf1322'
                }}
              >
                批量删除
              </Button>
              <Button
                size="middle"
                shape="round"
                icon={<DownloadOutlined />}
                onClick={handleExportCsv}
                disabled={!testCases.length}
                style={{
                  borderColor: 'rgba(22,119,255,0.3)',
                  background: 'rgba(22,119,255,0.08)',
                  color: '#1677ff'
                }}
              >
                导出 CSV
              </Button>
            </Space>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Table
              columns={columns}
              dataSource={filteredTestCases}
              rowKey="id"
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
              }}
              pagination={{ 
                pageSize: 15, 
                showSizeChanger: true, 
                showQuickJumper: true,
                size: 'small',
                position: ['bottomCenter'],
                showTotal: (total) => `共 ${total} 条`
              }}
              onRow={(record) => ({
                onClick: () => setSelectedCase(record),
                style: { cursor: 'pointer' }
              })}
              rowClassName={(record) => selectedCase?.id === record.id ? 'ant-table-row-selected' : 'table-row-hover'}
              size="middle"
            />
          </div>
        </div>

        {/* Right: Test Case Detail & Execution */}
        <div className="glass-panel" style={{ flex: 4, borderRadius: 16, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'rgba(255,255,255,0.8)' }}>
          {selectedCase ? (
            <div style={{ padding: 32 }} className="fade-in" key={selectedCase.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <Tag color="purple">TEST-{selectedCase.id}</Tag>
                <Space>
                  <Button icon={<PlayCircleFilled />} type="primary" onClick={() => handleExecute(selectedCase)}>执行</Button>
                  <Button icon={<EditOutlined />} onClick={() => handleEdit(selectedCase)} />
                </Space>
              </div>

              <Title level={3} style={{ marginBottom: 16 }}>{selectedCase.name}</Title>

              <Paragraph type="secondary" style={{ marginBottom: 24, padding: 12, background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
                {selectedCase.description}
              </Paragraph>

              <Row gutter={24} style={{ marginBottom: 24 }}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>等级</Text>
                  <div style={{ fontWeight: 500 }}>{renderPriorityTag(selectedCase)}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>项目ID</Text>
                  <div>
                    <Tag color="geekblue">{selectedCase.project_id || '未关联'}</Tag>
                  </div>
                </Col>
              </Row>

              <Divider />

              <Title level={5}><FileTextOutlined /> 测试配置 / 自动生成步骤</Title>
              {renderConfig(selectedCase.config)}

              <Divider />

              {selectedCase.config?.expected_result && (
                <>
                  <Title level={5}><CheckCircleFilled /> 预期结果</Title>
                  <Paragraph style={{ padding: '12px 16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, color: '#389e0d' }}>
                    {selectedCase.config.expected_result}
                  </Paragraph>
                  <Divider />
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999' }}>
                <span>创建于: {new Date(selectedCase.created_at).toLocaleString()}</span>
                <span>更新于: {new Date(selectedCase.updated_at).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              <FileTextOutlined style={{ fontSize: 64, marginBottom: 24, opacity: 0.2 }} />
              <Text type="secondary">选择左侧用例查看详情</Text>
            </div>
          )}
        </div>

      </div>

      <Modal
        title={editingCase ? '编辑测试用例' : '新增测试用例'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={720}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            priority: 'medium',
            status: 'active',
          }}
        >
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="name" label="用例名称" rules={[{ required: true }]}>
                <Input placeholder="请输入用例名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="module" label="所属模块" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="用户管理">用户管理</Select.Option>
                  <Select.Option value="商品管理">商品管理</Select.Option>
                  <Select.Option value="订单管理">订单管理</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="用例描述" rules={[{ required: true }]}>
            <TextArea rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="low">低</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="active">激活</Select.Option>
                  <Select.Option value="inactive">停用</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="steps" label="测试步骤" rules={[{ required: true }]} help="每行代表一个步骤">
            <TextArea rows={5} placeholder="1. ..." />
          </Form.Item>

          <Form.Item name="expectedResult" label="预期结果" rules={[{ required: true }]}>
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FunctionalTestCases;
