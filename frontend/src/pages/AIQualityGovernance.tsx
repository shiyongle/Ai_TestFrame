import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { CheckCircleOutlined, PlusOutlined, ReloadOutlined, ScanOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { aiQualityApi, modelConfigApi } from '../services/api';

const { Title, Text } = Typography;

const AIQualityGovernance: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<any>({});
  const [prompts, setPrompts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [experiments, setExperiments] = useState<any[]>([]);
  const [knowledgeScans, setKnowledgeScans] = useState<any[]>([]);
  const [modelConfigs, setModelConfigs] = useState<any[]>([]);
  const [promptOpen, setPromptOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [promptForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [budgetForm] = Form.useForm();
  const [experimentForm] = Form.useForm();

  const modelOptions = modelConfigs.map((item) => ({
    label: `${item.name} / ${item.model}`,
    value: item.id,
  }));

  const promptOptions = prompts.map((item) => ({
    label: `${item.name} ${item.version}`,
    value: item.id,
  }));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewData, promptList, reviewList, budgetList, experimentList, scanList, models] = await Promise.all([
        aiQualityApi.getOverview(),
        aiQualityApi.listPrompts(),
        aiQualityApi.listReviews({ limit: 100 }),
        aiQualityApi.listBudgets(),
        aiQualityApi.listExperiments(),
        aiQualityApi.listKnowledgeScans({ limit: 100 }),
        modelConfigApi.listConfigs(false),
      ]);
      setOverview(overviewData || {});
      setPrompts(promptList || []);
      setReviews(reviewList || []);
      setBudgets(budgetList || []);
      setExperiments(experimentList || []);
      setKnowledgeScans(scanList || []);
      setModelConfigs(models || []);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '加载 AI 质量治理数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createPrompt = async () => {
    try {
      const values = await promptForm.validateFields();
      await aiQualityApi.createPrompt(values);
      message.success('Prompt 版本已创建');
      setPromptOpen(false);
      promptForm.resetFields();
      loadData();
    } catch (error: any) {
      if (!error?.errorFields) message.error(error?.response?.data?.detail || '创建 Prompt 失败');
    }
  };

  const createReview = async () => {
    try {
      const values = await reviewForm.validateFields();
      await aiQualityApi.createReview({
        ...values,
        content: JSON.parse(values.content || '{}'),
      });
      message.success('生成评审已创建');
      setReviewOpen(false);
      reviewForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '评审内容 JSON 格式错误');
    }
  };

  const updateReviewStatus = async (record: any, status: string) => {
    try {
      await aiQualityApi.updateReview(record.id, { status, reviewer: 'system' });
      message.success('评审状态已更新');
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '更新评审失败');
    }
  };

  const createBudget = async () => {
    try {
      const values = await budgetForm.validateFields();
      await aiQualityApi.createBudget(values);
      message.success('预算已创建');
      setBudgetOpen(false);
      budgetForm.resetFields();
      loadData();
    } catch (error: any) {
      if (!error?.errorFields) message.error(error?.response?.data?.detail || '创建预算失败');
    }
  };

  const createExperiment = async () => {
    try {
      const values = await experimentForm.validateFields();
      await aiQualityApi.createExperiment(values);
      message.success('A/B 实验已创建');
      setExperimentOpen(false);
      experimentForm.resetFields();
      loadData();
    } catch (error: any) {
      if (!error?.errorFields) message.error(error?.response?.data?.detail || '创建 A/B 实验失败');
    }
  };

  const runKnowledgeScan = async () => {
    try {
      const res = await aiQualityApi.runKnowledgeScan(100);
      message.success(`知识库扫描完成：${res.scanned || 0} 条`);
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '知识库扫描失败');
    }
  };

  const syncBudgetUsage = async () => {
    try {
      await aiQualityApi.syncBudgetUsage();
      message.success('预算消耗已同步');
      loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '同步预算消耗失败');
    }
  };

  return (
    <div className="app-content fade-in" style={{ padding: 24, maxWidth: 1680, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>AI 质量治理</Title>
          <Text type="secondary">Prompt 版本、生成评审、幻觉检测、采纳率、预算、A/B 实验与知识库质量闭环</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
      </div>

      <Space size="large" wrap style={{ marginBottom: 16 }}>
        <Card bordered={false} style={{ minWidth: 160 }}><Text type="secondary">Prompt 版本</Text><div style={{ fontSize: 28, fontWeight: 700 }}>{overview.prompt_versions || 0}</div></Card>
        <Card bordered={false} style={{ minWidth: 160 }}><Text type="secondary">评审采纳率</Text><div style={{ fontSize: 28, fontWeight: 700 }}>{overview.adoption_rate || 0}%</div></Card>
        <Card bordered={false} style={{ minWidth: 160 }}><Text type="secondary">平均质量分</Text><div style={{ fontSize: 28, fontWeight: 700 }}>{overview.avg_quality_score || 0}</div></Card>
        <Card bordered={false} style={{ minWidth: 160 }}><Text type="secondary">幻觉风险</Text><div style={{ fontSize: 28, fontWeight: 700 }}>{overview.avg_hallucination_score || 0}</div></Card>
        <Card bordered={false} style={{ minWidth: 160 }}><Text type="secondary">过期知识</Text><div style={{ fontSize: 28, fontWeight: 700 }}>{overview.stale_knowledge_docs || 0}</div></Card>
      </Space>

      <Card bordered={false}>
        <Tabs
          items={[
            {
              key: 'prompts',
              label: 'Prompt 版本',
              children: (
                <>
                  <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setPromptOpen(true)}>新增 Prompt</Button>
                  <Table loading={loading} rowKey="id" dataSource={prompts} columns={[
                    { title: '名称', dataIndex: 'name' },
                    { title: '类型', dataIndex: 'prompt_type' },
                    { title: '版本', dataIndex: 'version', render: (value: string) => <Tag>{value}</Tag> },
                    { title: '状态', dataIndex: 'status', render: (value: string) => <Tag color={value === 'active' ? 'green' : 'default'}>{value}</Tag> },
                    { title: '更新时间', dataIndex: 'updated_at', render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-' },
                    { title: '操作', render: (_: any, record: any) => <Button size="small" icon={<CheckCircleOutlined />} onClick={() => aiQualityApi.activatePrompt(record.id).then(loadData)}>设为生效</Button> },
                  ]} />
                </>
              ),
            },
            {
              key: 'reviews',
              label: '生成评审',
              children: (
                <>
                  <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setReviewOpen(true)}>新增评审</Button>
                  <Table loading={loading} rowKey="id" dataSource={reviews} columns={[
                    { title: '标题', dataIndex: 'title' },
                    { title: '来源', dataIndex: 'source_type' },
                    { title: '状态', dataIndex: 'status', render: (value: string) => <Tag color={value === 'adopted' ? 'green' : value === 'rejected' ? 'red' : 'blue'}>{value}</Tag> },
                    { title: '质量分', dataIndex: 'quality_score', render: (value: number) => <Progress percent={Math.round(value || 0)} size="small" /> },
                    { title: '幻觉风险', dataIndex: 'hallucination_score', render: (value: number) => <Tag color={(value || 0) > 50 ? 'red' : 'green'}>{value || 0}</Tag> },
                    { title: '风险项', dataIndex: 'hallucination_flags', render: (value: any[]) => <Space wrap>{(value || []).map((item) => <Tag key={item.type}>{item.type}</Tag>)}</Space> },
                    { title: '操作', render: (_: any, record: any) => <Space><Button size="small" onClick={() => updateReviewStatus(record, 'adopted')}>采纳</Button><Button size="small" danger onClick={() => updateReviewStatus(record, 'rejected')}>驳回</Button></Space> },
                  ]} />
                </>
              ),
            },
            {
              key: 'budgets',
              label: '模型预算',
              children: (
                <>
                  <Space style={{ marginBottom: 12 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setBudgetOpen(true)}>新增预算</Button>
                    <Button onClick={syncBudgetUsage}>同步消耗</Button>
                  </Space>
                  <Table loading={loading} rowKey="id" dataSource={budgets} columns={[
                    { title: '名称', dataIndex: 'name' },
                    { title: '模型', render: (_: any, record: any) => `${record.provider}/${record.model}` },
                    { title: '周期', dataIndex: 'period_month' },
                    { title: 'Token 使用', render: (_: any, record: any) => <Progress percent={Math.min(100, Math.round(record.token_usage_rate || 0))} size="small" /> },
                    { title: '成本使用', render: (_: any, record: any) => <Progress percent={Math.min(100, Math.round(record.cost_usage_rate || 0))} size="small" /> },
                  ]} />
                </>
              ),
            },
            {
              key: 'experiments',
              label: '模型 A/B',
              children: (
                <>
                  <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setExperimentOpen(true)}>新增实验</Button>
                  <Table loading={loading} rowKey="id" dataSource={experiments} columns={[
                    { title: '实验', dataIndex: 'name' },
                    { title: '指标', dataIndex: 'metric_name' },
                    { title: '样本数', dataIndex: 'sample_size' },
                    { title: '胜出', dataIndex: 'winner', render: (value: string) => <Tag color={value === 'tie' ? 'default' : 'green'}>{value || '-'}</Tag> },
                    { title: '状态', dataIndex: 'status' },
                  ]} />
                </>
              ),
            },
            {
              key: 'knowledge',
              label: '知识质量',
              children: (
                <>
                  <Button type="primary" icon={<ScanOutlined />} style={{ marginBottom: 12 }} onClick={runKnowledgeScan}>运行知识扫描</Button>
                  <Table loading={loading} rowKey="id" dataSource={knowledgeScans} columns={[
                    { title: '文档', dataIndex: 'document_title', render: (value: string) => value || '-' },
                    { title: '质量分', dataIndex: 'quality_score', render: (value: number) => <Progress percent={Math.round(value || 0)} size="small" /> },
                    { title: '新鲜度', dataIndex: 'freshness_score' },
                    { title: '覆盖度', dataIndex: 'coverage_score' },
                    { title: '问题数', dataIndex: 'issue_count', render: (value: number) => <Tag color={value ? 'red' : 'green'}>{value}</Tag> },
                    { title: '扫描时间', dataIndex: 'scanned_at', render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-' },
                  ]} />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="新增 Prompt 版本" open={promptOpen} onCancel={() => setPromptOpen(false)} onOk={createPrompt} width={760}>
        <Form form={promptForm} layout="vertical" initialValues={{ prompt_type: 'testcase_generation', version: 'v1', status: 'draft' }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="prompt_type" label="类型"><Select options={['testcase_generation', 'rag_answer', 'agent_judge', 'knowledge_extract'].map((item) => ({ label: item, value: item }))} /></Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="model_config_id" label="默认模型"><Select allowClear options={modelOptions} /></Form.Item>
          <Form.Item name="system_prompt" label="System Prompt"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="user_prompt" label="User Prompt" rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item>
          <Form.Item name="change_log" label="变更说明"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增生成评审" open={reviewOpen} onCancel={() => setReviewOpen(false)} onOk={createReview} width={760}>
        <Form form={reviewForm} layout="vertical" initialValues={{ source_type: 'manual', status: 'pending', content: '{\n  "title": "生成用例",\n  "steps": [],\n  "assertions": [],\n  "citations": []\n}' }}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="source_type" label="来源"><Select options={['manual', 'testcase_generation', 'rag', 'agent'].map((item) => ({ label: item, value: item }))} /></Form.Item>
          <Form.Item name="prompt_version_id" label="Prompt 版本"><Select allowClear options={promptOptions} /></Form.Item>
          <Form.Item name="model_config_id" label="模型"><Select allowClear options={modelOptions} /></Form.Item>
          <Form.Item name="content" label="生成内容 JSON" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增模型预算" open={budgetOpen} onCancel={() => setBudgetOpen(false)} onOk={createBudget}>
        <Form form={budgetForm} layout="vertical" initialValues={{ period_month: dayjs().format('YYYY-MM'), token_budget: 1000000, cost_budget: 100, alert_threshold: 0.8 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="provider" label="Provider" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="model" label="模型" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="period_month" label="周期" rules={[{ required: true }]}><Input placeholder="2026-05" /></Form.Item>
          <Form.Item name="token_budget" label="Token 预算"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="cost_budget" label="成本预算"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增 A/B 实验" open={experimentOpen} onCancel={() => setExperimentOpen(false)} onOk={createExperiment}>
        <Form form={experimentForm} layout="vertical" initialValues={{ metric_name: 'quality_score', status: 'draft', sample_size: 0 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="prompt_a_id" label="Prompt A"><Select allowClear options={promptOptions} /></Form.Item>
          <Form.Item name="prompt_b_id" label="Prompt B"><Select allowClear options={promptOptions} /></Form.Item>
          <Form.Item name="model_a_id" label="模型 A"><Select allowClear options={modelOptions} /></Form.Item>
          <Form.Item name="model_b_id" label="模型 B"><Select allowClear options={modelOptions} /></Form.Item>
          <Form.Item name="metric_name" label="指标"><Input /></Form.Item>
          <Form.Item name="sample_size" label="样本数"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AIQualityGovernance;
