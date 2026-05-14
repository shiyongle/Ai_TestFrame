import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, Drawer, Empty, Form, Input, InputNumber, Modal,
  Progress, Row, Select, Space, Statistic, Table, Tag, Typography,
  message, Tooltip, Divider, Popconfirm,
} from 'antd';
import {
  ExperimentOutlined, PlusOutlined, ReloadOutlined, RobotOutlined,
  CheckCircleOutlined, CloseCircleOutlined, UndoOutlined, DeleteOutlined,
  InfoCircleOutlined, EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { agentEvaluationApi, evaluationTemplateApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;

interface EvaluationItem {
  id: number;
  question: string;
  expected_answer?: string;
  actual_answer?: string;
  evaluation_result?: string;
  status: string;
  score: number;
  reason?: string;
  error_message?: string;
  latency_ms: number;
  human_override: boolean;
  human_label?: string;
  human_comment?: string;
}

interface EvaluationRun {
  id: number;
  name: string;
  dataset_id?: number;
  dataset_name?: string;
  agent_id?: number;
  agent_name?: string;
  template_id?: number;
  eval_mode: string;
  provider: string;
  model?: string;
  status: string;
  total_count: number;
  valid_count: number;
  invalid_count: number;
  failed_count: number;
  human_override_count: number;
  valid_rate: number;
  failure_rate: number;
  summary?: Record<string, any>;
  error_message?: string;
  created_at: string;
  items?: EvaluationItem[];
}

interface AgentOption { id: number; name: string; agent_type: string; base_url: string; }
interface DatasetOption { id: number; name: string; item_count: number; }
interface TemplateOption { id: number; name: string; eval_mode: string; model_config_id?: number; pass_threshold: number; }
interface ModelConfigOption { id: number; provider: string; name: string; model: string; label?: string; }

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待执行' },
  running: { color: 'processing', label: '运行中' },
  completed: { color: 'success', label: '已完成' },
  valid: { color: 'success', label: '通过' },
  invalid: { color: 'warning', label: '不通过' },
  failed: { color: 'error', label: '失败' },
};

const evalModeMap: Record<string, { color: string; label: string }> = {
  f1: { color: 'blue', label: 'F1 关键词' },
  llm: { color: 'purple', label: 'LLM 语义' },
};

const AgentEvaluation: React.FC = () => {
  const [form] = Form.useForm();
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [modelConfigs, setModelConfigs] = useState<ModelConfigOption[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [activeRun, setActiveRun] = useState<EvaluationRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [detailItem, setDetailItem] = useState<EvaluationItem | null>(null);

  const activeRunId = activeRun?.id;
  const isActiveRunning = activeRun?.status === 'pending' || activeRun?.status === 'running';

  const loadOptions = useCallback(async () => {
    try {
      const res = await agentEvaluationApi.getProviders();
      setProviders(res.providers || []);
      setAgents(res.agents || []);
      setDatasets(res.datasets || []);
      const configList = res.model_configs || [];
      setModelConfigs(configList);
    } catch { message.error('加载配置失败'); }
    try {
      const tpls = await evaluationTemplateApi.listTemplates({ limit: 100 });
      setTemplates(tpls || []);
    } catch {}
  }, []);

  const loadRuns = useCallback(async (selectLatest = false) => {
    setLoading(true);
    try {
      const data = await agentEvaluationApi.listRuns(30);
      setRuns(data || []);
      if (selectLatest && data?.length) setActiveRun(data[0]);
    } catch { message.error('评测记录加载失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    form.setFieldsValue({
      name: `Agent评测-${new Date().toLocaleString('zh-CN')}`,
      eval_mode: 'llm',
      pass_threshold: 0.55,
    });
    loadOptions();
    loadRuns(true);
  }, [form, loadOptions, loadRuns]);

  // 自动轮询运行中的任务
  useEffect(() => {
    if (!activeRunId || !isActiveRunning) return;
    const timer = window.setInterval(async () => {
      try {
        const run = await agentEvaluationApi.getRun(activeRunId);
        setActiveRun(run);
        if (run.status === 'completed' || run.status === 'failed') {
          loadRuns(); setRunning(false); window.clearInterval(timer);
        }
      } catch { window.clearInterval(timer); setRunning(false); }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeRunId, isActiveRunning, loadRuns]);

  const handleTemplateChange = (templateId: number) => {
    const t = templates.find(x => x.id === templateId);
    if (t) {
      form.setFieldsValue({
        eval_mode: t.eval_mode,
        model_config_id: t.model_config_id,
        pass_threshold: t.pass_threshold,
      });
    }
  };

  const handleCreateRun = async () => {
    try {
      const values = await form.validateFields();
      if (!values.dataset_id && !values.agent_id) {
        message.warning('请选择黄金测试集和被测Agent'); return;
      }
      setRunning(true);
      const run = await agentEvaluationApi.createRun(values);
      setActiveRun(run);
      loadRuns();
      message.success('评测任务已创建');
    } catch (error: any) {
      if (error?.errorFields) return;
      setRunning(false);
      message.error(error?.response?.data?.detail || '创建失败');
    }
  };

  const handleHumanLabel = async (itemId: number, label: string) => {
    try {
      await agentEvaluationApi.updateHumanLabel(itemId, { human_label: label });
      message.success(label === 'correct' ? '已标记为正确' : '已标记为错误');
      if (activeRunId) {
        const run = await agentEvaluationApi.getRun(activeRunId);
        setActiveRun(run);
        loadRuns();
      }
    } catch { message.error('标注失败'); }
  };

  const handleClearLabel = async (itemId: number) => {
    try {
      await agentEvaluationApi.clearHumanLabel(itemId);
      message.success('已撤销标注');
      if (activeRunId) {
        const run = await agentEvaluationApi.getRun(activeRunId);
        setActiveRun(run);
        loadRuns();
      }
    } catch { message.error('操作失败'); }
  };

  const handleDeleteRun = async (runId: number) => {
    try {
      await agentEvaluationApi.deleteRun(runId);
      message.success('已删除');
      loadRuns();
      if (activeRun?.id === runId) setActiveRun(null);
    } catch { message.error('删除失败'); }
  };

  const progressPercent = useMemo(() => {
    if (!activeRun?.total_count) return 0;
    const finished = activeRun.valid_count + activeRun.invalid_count + activeRun.failed_count;
    return Math.round((finished / activeRun.total_count) * 100);
  }, [activeRun]);

  // 最终判定列
  const getFinalVerdict = (item: EvaluationItem) => {
    if (item.human_override) {
      return item.human_label === 'correct'
        ? { color: 'cyan', label: '人工✓正确' }
        : { color: 'magenta', label: '人工✗错误' };
    }
    return statusMap[item.status] || { color: 'default', label: item.status };
  };

  const itemColumns: ColumnsType<EvaluationItem> = [
    { title: '问题', dataIndex: 'question', width: 200, ellipsis: true },
    { title: '期望答案', dataIndex: 'expected_answer', width: 160, ellipsis: true, render: (t) => t || '-' },
    { title: '实际回答', dataIndex: 'actual_answer', width: 200, ellipsis: true, render: (t) => t || '-' },
    { title: '自动判定', dataIndex: 'status', width: 90,
      render: (s) => { const m = statusMap[s] || { color: 'default', label: s }; return <Tag color={m.color}>{m.label}</Tag>; },
    },
    { title: '得分', dataIndex: 'score', width: 70, render: (v) => Number(v || 0).toFixed(2) },
    { title: '最终判定', width: 110,
      render: (_, record) => {
        const v = getFinalVerdict(record);
        return <Tag color={v.color}>{v.label}</Tag>;
      },
    },
    { title: '原因', dataIndex: 'reason', width: 180, ellipsis: true,
      render: (t, r) => t || r.error_message || '-',
    },
    { title: '耗时', dataIndex: 'latency_ms', width: 80, render: (v) => `${v || 0}ms` },
    { title: '操作', width: 160, fixed: 'right' as const,
      render: (_, record) => {
        if (record.status === 'pending' || record.status === 'failed') return '-';
        return (
          <Space size={4}>
            <Tooltip title="查看详情">
              <Button size="small" type="text" icon={<EyeOutlined />}
                onClick={() => { setDetailItem(record); setDetailDrawer(true); }} />
            </Tooltip>
            {!record.human_override ? (
              <>
                <Tooltip title="标记为正确">
                  <Button size="small" type="text" style={{ color: '#52c41a' }}
                    icon={<CheckCircleOutlined />} onClick={() => handleHumanLabel(record.id, 'correct')} />
                </Tooltip>
                <Tooltip title="标记为错误">
                  <Button size="small" type="text" style={{ color: '#ff4d4f' }}
                    icon={<CloseCircleOutlined />} onClick={() => handleHumanLabel(record.id, 'incorrect')} />
                </Tooltip>
              </>
            ) : (
              <Tooltip title="撤销标注">
                <Button size="small" type="text" icon={<UndoOutlined />}
                  onClick={() => handleClearLabel(record.id)} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  const runColumns: ColumnsType<EvaluationRun> = [
    { title: '评测任务', dataIndex: 'name', ellipsis: true,
      render: (text, record) => (
        <Button type="link" onClick={() => setActiveRun(record)} style={{ padding: 0 }}>{text}</Button>
      ),
    },
    { title: '被测Agent', dataIndex: 'agent_name', width: 120, render: (t) => t || '-' },
    { title: '测试集', dataIndex: 'dataset_name', width: 120, render: (t) => t || '-' },
    { title: '模式', dataIndex: 'eval_mode', width: 90,
      render: (m) => { const meta = evalModeMap[m] || { color: 'default', label: m }; return <Tag color={meta.color}>{meta.label}</Tag>; },
    },
    { title: '状态', width: 90,
      render: (_, r) => { const m = statusMap[r.status] || { color: 'default', label: r.status }; return <Tag color={m.color}>{m.label}</Tag>; },
    },
    { title: '通过率', width: 90, render: (_, r) => `${r.valid_rate || 0}%` },
    { title: '人工覆盖', width: 80, render: (_, r) => r.human_override_count || 0 },
    { title: '操作', width: 70,
      render: (_, r) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteRun(r.id)} okType="danger">
          <Button size="small" danger type="text" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}><ExperimentOutlined /> Agent 评测</Title>
            <Text type="secondary">关联黄金测试集，调用被测Agent，LLM-as-Judge语义评判，支持人工标注覆盖</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => { loadRuns(); loadOptions(); }} loading={loading}>刷新</Button>
        </div>

        <Row gutter={[16, 16]} align="stretch">
          {/* 左侧 — 新建评测 */}
          <Col xs={24} xl={9}>
            <Card title={<Space><RobotOutlined /> 新建评测</Space>} bordered={false}>
              <Form form={form} layout="vertical">
                <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入名称' }]}>
                  <Input placeholder="Agent评测任务" />
                </Form.Item>
                <Form.Item name="dataset_id" label="黄金测试集" rules={[{ required: true, message: '请选择测试集' }]}>
                  <Select placeholder="选择黄金测试集">
                    {datasets.map(d => (
                      <Select.Option key={d.id} value={d.id}>
                        {d.name} <Tag style={{ marginLeft: 4 }}>{d.item_count}条</Tag>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="agent_id" label="被测 Agent" rules={[{ required: true, message: '请选择Agent' }]}>
                  <Select placeholder="选择被测Agent">
                    {agents.map(a => (
                      <Select.Option key={a.id} value={a.id}>
                        {a.name} <Tag color={a.agent_type === 'dify' ? 'blue' : 'green'}>{a.agent_type}</Tag>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="template_id" label={
                  <Space>评测模板<Tooltip title="选择模板后自动填充评测模式和模型配置"><InfoCircleOutlined /></Tooltip></Space>
                }>
                  <Select placeholder="选择评测模板（可选）" allowClear onChange={handleTemplateChange}>
                    {templates.map(t => (
                      <Select.Option key={t.id} value={t.id}>
                        {t.name} ({evalModeMap[t.eval_mode]?.label || t.eval_mode})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="eval_mode" label="评测模式" rules={[{ required: true }]}>
                  <Select>
                    <Select.Option value="llm"><Space><Tag color="purple">LLM</Tag> 语义评判</Space></Select.Option>
                    <Select.Option value="f1"><Space><Tag color="blue">F1</Tag> 关键词覆盖</Space></Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="model_config_id" label="裁判模型配置">
                  <Select placeholder="选择裁判模型（LLM模式需要）" allowClear>
                    {modelConfigs.map(mc => (
                      <Select.Option key={mc.id} value={mc.id}>
                        {mc.label || `${mc.name} (${mc.provider}/${mc.model})`}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="pass_threshold" label="通过阈值">
                  <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
                </Form.Item>
                <Button type="primary" block style={{ marginTop: 8 }} onClick={handleCreateRun}
                  loading={running} disabled={!datasets.length || !agents.length}>
                  开始评测
                </Button>
              </Form>
            </Card>
          </Col>

          {/* 右侧 — 评测概览 + 明细 */}
          <Col xs={24} xl={15}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card title="评测概览" bordered={false}>
                  {activeRun ? (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <Space direction="vertical" size={0}>
                          <Text strong>{activeRun.name}</Text>
                          <Space size={4}>
                            <Tag color={evalModeMap[activeRun.eval_mode]?.color}>{evalModeMap[activeRun.eval_mode]?.label}</Tag>
                            {activeRun.agent_name && <Tag color="blue">Agent: {activeRun.agent_name}</Tag>}
                            {activeRun.dataset_name && <Tag>集: {activeRun.dataset_name}</Tag>}
                          </Space>
                        </Space>
                        <Tag color={(statusMap[activeRun.status] || {}).color}>{(statusMap[activeRun.status] || {}).label}</Tag>
                      </div>
                      <Progress percent={activeRun.status === 'completed' ? 100 : progressPercent}
                        status={activeRun.status === 'failed' ? 'exception' : 'active'} />
                      <Row gutter={16}>
                        <Col xs={8} md={4}><Statistic title="总数" value={activeRun.total_count} /></Col>
                        <Col xs={8} md={4}><Statistic title="通过" value={activeRun.valid_count} valueStyle={{ color: '#52c41a' }} /></Col>
                        <Col xs={8} md={4}><Statistic title="不通过" value={activeRun.invalid_count} valueStyle={{ color: '#faad14' }} /></Col>
                        <Col xs={8} md={4}><Statistic title="失败" value={activeRun.failed_count} valueStyle={{ color: '#ff4d4f' }} /></Col>
                        <Col xs={8} md={4}><Statistic title="通过率" value={activeRun.valid_rate} suffix="%" /></Col>
                        <Col xs={8} md={4}><Statistic title="人工覆盖" value={activeRun.human_override_count} valueStyle={{ color: '#1677ff' }} /></Col>
                      </Row>
                      {activeRun.error_message && <Paragraph type="danger">{activeRun.error_message}</Paragraph>}
                    </Space>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择或创建评测任务" />
                  )}
                </Card>
              </Col>
              <Col span={24}>
                <Card title="评测明细" bordered={false}>
                  <Table rowKey="id" columns={itemColumns} dataSource={activeRun?.items || []}
                    pagination={{ pageSize: 8 }} scroll={{ x: 1200 }} size="middle" />
                </Card>
              </Col>
            </Row>
          </Col>

          {/* 历史记录 */}
          <Col span={24}>
            <Card title="历史记录" bordered={false}>
              <Table rowKey="id" columns={runColumns} dataSource={runs}
                loading={loading} pagination={{ pageSize: 8 }} />
            </Card>
          </Col>
        </Row>
      </Space>

      {/* 详情 Drawer */}
      <Drawer title="评测明细详情" open={detailDrawer} onClose={() => setDetailDrawer(false)} width={600}>
        {detailItem && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" title="问题"><Paragraph>{detailItem.question}</Paragraph></Card>
            <Card size="small" title="期望答案"><Paragraph>{detailItem.expected_answer || '无'}</Paragraph></Card>
            <Card size="small" title="实际回答"><Paragraph>{detailItem.actual_answer || '无'}</Paragraph></Card>
            <Card size="small" title="评判结果">
              <Space direction="vertical" size={4}>
                <Text>得分：<strong>{Number(detailItem.score || 0).toFixed(2)}</strong></Text>
                <Text>自动判定：<Tag color={statusMap[detailItem.status]?.color}>{statusMap[detailItem.status]?.label}</Tag></Text>
                <Text>原因：{detailItem.reason || '-'}</Text>
                {detailItem.human_override && (
                  <Text>人工标注：<Tag color={detailItem.human_label === 'correct' ? 'cyan' : 'magenta'}>
                    {detailItem.human_label === 'correct' ? '✓ 正确' : '✗ 错误'}
                  </Tag> {detailItem.human_comment || ''}</Text>
                )}
              </Space>
            </Card>
            {detailItem.evaluation_result && (
              <Card size="small" title="LLM评判原文">
                <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{detailItem.evaluation_result}</Paragraph>
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default AgentEvaluation;
