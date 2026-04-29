import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { agentEvaluationApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface EvaluationCase {
  question: string;
  expected_answer?: string;
}

interface EvaluationItem {
  id: number;
  question: string;
  expected_answer?: string;
  actual_answer?: string;
  status: string;
  score: number;
  reason?: string;
  error_message?: string;
  latency_ms: number;
}

interface EvaluationRun {
  id: number;
  name: string;
  provider: string;
  model?: string;
  status: string;
  total_count: number;
  valid_count: number;
  invalid_count: number;
  failed_count: number;
  valid_rate: number;
  failure_rate: number;
  summary?: Record<string, any>;
  error_message?: string;
  created_at: string;
  items?: EvaluationItem[];
}

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待执行' },
  running: { color: 'processing', label: '运行中' },
  completed: { color: 'success', label: '已完成' },
  valid: { color: 'success', label: '有效' },
  invalid: { color: 'warning', label: '无效' },
  failed: { color: 'error', label: '失败' },
};

const defaultCases: EvaluationCase[] = [
  { question: '投石问路平台支持哪些接口测试协议？', expected_answer: 'HTTP、TCP、MQ' },
  { question: 'RAG 知识库使用什么向量数据库？', expected_answer: 'ChromaDB' },
];

const AgentEvaluation: React.FC = () => {
  const [form] = Form.useForm();
  const [providers, setProviders] = useState<string[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [activeRun, setActiveRun] = useState<EvaluationRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const activeRunId = activeRun?.id;
  const isActiveRunning = activeRun?.status === 'pending' || activeRun?.status === 'running';

  const loadProviders = useCallback(async () => {
    try {
      const res = await agentEvaluationApi.getProviders();
      const list = res.providers || [];
      setProviders(list);
      if (list.length > 0) {
        form.setFieldValue('provider', list[0]);
      }
    } catch {
      message.error('模型提供商加载失败');
    }
  }, [form]);

  const loadRuns = useCallback(async (selectLatest = false) => {
    setLoading(true);
    try {
      const data = await agentEvaluationApi.listRuns(20);
      setRuns(data || []);
      if (selectLatest && data?.length) {
        setActiveRun(data[0]);
      }
    } catch {
      message.error('评测记录加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    form.setFieldsValue({
      name: `Agent评测-${new Date().toLocaleString('zh-CN')}`,
      temperature: 0.2,
      max_tokens: 1024,
      pass_threshold: 0.55,
      cases: defaultCases,
    });
    loadProviders();
    loadRuns(true);
  }, [form, loadProviders, loadRuns]);

  useEffect(() => {
    if (!activeRunId || !isActiveRunning) return;

    const timer = window.setInterval(async () => {
      try {
        const run = await agentEvaluationApi.getRun(activeRunId);
        setActiveRun(run);
        if (run.status === 'completed' || run.status === 'failed') {
          loadRuns();
          setRunning(false);
          window.clearInterval(timer);
        }
      } catch {
        window.clearInterval(timer);
        setRunning(false);
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [activeRunId, isActiveRunning, loadRuns]);

  const handleCreateRun = async () => {
    try {
      const values = await form.validateFields();
      const cases = (values.cases || [])
        .map((item: EvaluationCase) => ({
          question: item.question?.trim(),
          expected_answer: item.expected_answer?.trim() || undefined,
        }))
        .filter((item: EvaluationCase) => item.question);

      if (!cases.length) {
        message.warning('至少需要一条问题');
        return;
      }

      setRunning(true);
      const run = await agentEvaluationApi.createRun({ ...values, cases });
      setActiveRun(run);
      loadRuns();
      message.success('评测任务已创建');
    } catch (error: any) {
      if (error?.errorFields) return;
      setRunning(false);
      message.error(error?.response?.data?.detail || '创建评测任务失败');
    }
  };

  const runColumns: ColumnsType<EvaluationRun> = [
    {
      title: '评测任务',
      dataIndex: 'name',
      ellipsis: true,
      render: (text, record) => (
        <Button type="link" onClick={() => setActiveRun(record)} style={{ padding: 0 }}>
          {text}
        </Button>
      ),
    },
    {
      title: '模型',
      width: 120,
      render: (_, record) => <Text>{record.provider}</Text>,
    },
    {
      title: '状态',
      width: 90,
      render: (_, record) => {
        const meta = statusMap[record.status] || { color: 'default', label: record.status };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '有效率',
      width: 90,
      render: (_, record) => `${record.valid_rate || 0}%`,
    },
  ];

  const itemColumns: ColumnsType<EvaluationItem> = [
    {
      title: '问题',
      dataIndex: 'question',
      width: 220,
      ellipsis: true,
    },
    {
      title: '期望答案',
      dataIndex: 'expected_answer',
      width: 180,
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '实际回答',
      dataIndex: 'actual_answer',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '判定',
      dataIndex: 'status',
      width: 90,
      render: (status) => {
        const meta = statusMap[status] || { color: 'default', label: status };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '得分',
      dataIndex: 'score',
      width: 80,
      render: (score) => Number(score || 0).toFixed(2),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      width: 220,
      ellipsis: true,
      render: (text, record) => text || record.error_message || '-',
    },
    {
      title: '耗时',
      dataIndex: 'latency_ms',
      width: 90,
      render: (value) => `${value || 0}ms`,
    },
  ];

  const progressPercent = useMemo(() => {
    if (!activeRun?.total_count) return 0;
    const finished = activeRun.valid_count + activeRun.invalid_count + activeRun.failed_count;
    return Math.round((finished / activeRun.total_count) * 100);
  }, [activeRun]);

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              <ExperimentOutlined /> Agent 评测
            </Title>
            <Text type="secondary">大模型问答有效性评测与失败分析</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => loadRuns()} loading={loading}>
            刷新
          </Button>
        </div>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} xl={9}>
            <Card title={<Space><RobotOutlined /> 新建评测</Space>} bordered={false}>
              <Form form={form} layout="vertical">
                <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
                  <Input placeholder="Agent评测任务" />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="provider" label="模型提供商" rules={[{ required: true, message: '请选择模型提供商' }]}>
                      <Select placeholder="选择提供商">
                        {providers.map(provider => (
                          <Select.Option key={provider} value={provider}>{provider}</Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="model" label="模型名称">
                      <Input placeholder="默认模型" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={8}>
                    <Form.Item name="temperature" label="温度">
                      <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="max_tokens" label="最大输出">
                      <InputNumber min={1} max={4096} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="pass_threshold" label="通过阈值">
                      <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.List name="cases">
                  {(fields, { add, remove }) => (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      {fields.map((field, index) => (
                        <div key={field.key} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text strong>用例 {index + 1}</Text>
                            {fields.length > 1 && (
                              <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                            )}
                          </div>
                          <Form.Item
                            {...field}
                            name={[field.name, 'question']}
                            rules={[{ required: true, message: '请输入问题' }]}
                            style={{ marginBottom: 8 }}
                          >
                            <TextArea rows={2} placeholder="用户问题" />
                          </Form.Item>
                          <Form.Item {...field} name={[field.name, 'expected_answer']} style={{ marginBottom: 0 }}>
                            <TextArea rows={2} placeholder="期望答案或关键词" />
                          </Form.Item>
                        </div>
                      ))}
                      <Button block icon={<PlusOutlined />} onClick={() => add({ question: '', expected_answer: '' })}>
                        添加用例
                      </Button>
                    </Space>
                  )}
                </Form.List>

                <Button
                  type="primary"
                  block
                  style={{ marginTop: 16 }}
                  onClick={handleCreateRun}
                  loading={running}
                  disabled={!providers.length}
                >
                  开始评测
                </Button>
              </Form>
            </Card>
          </Col>

          <Col xs={24} xl={15}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card title="评测概览" bordered={false}>
                  {activeRun ? (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <Space direction="vertical" size={0}>
                          <Text strong>{activeRun.name}</Text>
                          <Text type="secondary">{activeRun.provider}{activeRun.model ? ` / ${activeRun.model}` : ''}</Text>
                        </Space>
                        <Tag color={(statusMap[activeRun.status] || {}).color}>{(statusMap[activeRun.status] || {}).label || activeRun.status}</Tag>
                      </div>
                      <Progress percent={activeRun.status === 'completed' ? 100 : progressPercent} status={activeRun.status === 'failed' ? 'exception' : 'active'} />
                      <Row gutter={16}>
                        <Col xs={12} md={6}><Statistic title="总数" value={activeRun.total_count} /></Col>
                        <Col xs={12} md={6}><Statistic title="有效" value={activeRun.valid_count} /></Col>
                        <Col xs={12} md={6}><Statistic title="无效/失败" value={activeRun.invalid_count + activeRun.failed_count} /></Col>
                        <Col xs={12} md={6}><Statistic title="有效率" value={activeRun.valid_rate} suffix="%" /></Col>
                      </Row>
                      <Row gutter={16}>
                        <Col xs={12} md={6}><Statistic title="失败率" value={activeRun.failure_rate} suffix="%" /></Col>
                        <Col xs={12} md={6}><Statistic title="平均耗时" value={activeRun.summary?.avg_latency_ms || 0} suffix="ms" /></Col>
                      </Row>
                      {activeRun.error_message && <Paragraph type="danger">{activeRun.error_message}</Paragraph>}
                    </Space>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </Card>
              </Col>
              <Col span={24}>
                <Card title="评测明细" bordered={false}>
                  <Table
                    rowKey="id"
                    columns={itemColumns}
                    dataSource={activeRun?.items || []}
                    pagination={{ pageSize: 6 }}
                    scroll={{ x: 980 }}
                    size="middle"
                  />
                </Card>
              </Col>
            </Row>
          </Col>

          <Col span={24}>
            <Card title="历史记录" bordered={false}>
              <Table
                rowKey="id"
                columns={runColumns}
                dataSource={runs}
                loading={loading}
                pagination={{ pageSize: 8 }}
              />
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  );
};

export default AgentEvaluation;
