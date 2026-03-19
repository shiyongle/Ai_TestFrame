import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  TimePicker,
  Typography,
  message,
} from 'antd';
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleFilled,
  PlusOutlined,
  ProjectOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { interfaceTestcaseApi, projectApi, testcaseApi, testPlanApi } from '../../services/api';
import { taskCenter } from '../../services/taskCenter';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ProjectOption {
  id: number;
  name: string;
}

interface PlanCaseSummary {
  id: number;
  name: string;
  description?: string;
  protocol?: string;
  priority?: string;
  case_type: 'functional' | 'interface';
  module?: string;
  method?: string;
  url?: string;
}

interface PlanExecution {
  id: number;
  status: string;
  total_items: number;
  passed_items: number;
  failed_items: number;
  error_items: number;
  skipped_items: number;
  started_at: string;
  completed_at?: string;
  summary?: {
    details?: Array<{
      case_id: number;
      case_name: string;
      case_type: string;
      status: string;
      message: string;
    }>;
  };
}

type ScheduleType = 'daily' | 'weekly' | 'monthly';

interface ScheduleRule {
  type: ScheduleType;
  time: string;
  weekday?: number;
  dayOfMonth?: number;
}

interface TestPlan {
  id: number;
  name: string;
  description?: string;
  project_id: number;
  owner?: string;
  status: string;
  execution_mode: string;
  priority: string;
  entry_criteria?: string;
  exit_criteria?: string;
  schedule?: string;
  tags?: string[];
  functional_cases: PlanCaseSummary[];
  interface_cases: PlanCaseSummary[];
  latest_execution?: PlanExecution | null;
  total_case_count: number;
  created_at: string;
  updated_at: string;
  last_executed_at?: string;
}

const priorityMap: Record<string, { text: string; color: string }> = {
  high: { text: '高', color: 'red' },
  medium: { text: '中', color: 'orange' },
  low: { text: '低', color: 'green' },
};

const statusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  ready: { text: '就绪', color: 'blue' },
  running: { text: '执行中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  archived: { text: '已归档', color: 'default' },
  completed_with_issues: { text: '完成但有问题', color: 'warning' },
  failed: { text: '失败', color: 'error' },
  passed: { text: '通过', color: 'success' },
  error: { text: '错误', color: 'error' },
  skipped: { text: '跳过', color: 'default' },
};

const SCHEDULE_MARK = 'AUTO_SCHEDULE::';

const weekdayOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
];

const dayOfMonthOptions = Array.from({ length: 31 }).map((_, i) => ({
  label: `${i + 1} 日`,
  value: i + 1,
}));

const parseScheduleRule = (schedule?: string): ScheduleRule | null => {
  const raw = String(schedule || '').trim();
  if (!raw.startsWith(SCHEDULE_MARK)) return null;
  try {
    const obj = JSON.parse(raw.slice(SCHEDULE_MARK.length));
    if (!obj?.type || !obj?.time) return null;
    return {
      type: obj.type,
      time: obj.time,
      weekday: obj.weekday,
      dayOfMonth: obj.dayOfMonth,
    } as ScheduleRule;
  } catch {
    return null;
  }
};

const stringifyScheduleRule = (rule: ScheduleRule) => `${SCHEDULE_MARK}${JSON.stringify(rule)}`;

const formatScheduleText = (schedule?: string) => {
  const parsed = parseScheduleRule(schedule);
  if (!parsed) return schedule || '未设置';
  if (parsed.type === 'daily') return `每日 ${parsed.time}`;
  if (parsed.type === 'weekly') {
    const weekLabel = weekdayOptions.find((x) => x.value === parsed.weekday)?.label || `周${parsed.weekday}`;
    return `每周 ${weekLabel} ${parsed.time}`;
  }
  return `每月 ${parsed.dayOfMonth || 1} 日 ${parsed.time}`;
};

const TestPlans: React.FC = () => {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [functionalCases, setFunctionalCases] = useState<any[]>([]);
  const [interfaceCases, setInterfaceCases] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);

  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TestPlan | null>(null);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduleEditingPlan, setScheduleEditingPlan] = useState<TestPlan | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [form] = Form.useForm();
  const [scheduleForm] = Form.useForm();

  const selectedPlan = useMemo(
    () => plans.find((item) => item.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  const functionalOptions = useMemo(
    () =>
      (functionalCases || []).map((item) => ({
        label: `${item.name}${item.config?.module ? ` · ${item.config.module}` : ''}`,
        value: item.id,
      })),
    [functionalCases]
  );

  const interfaceOptions = useMemo(
    () =>
      (interfaceCases || []).map((item) => ({
        label: `${item.name}${item.url ? ` · ${item.url}` : ''}`,
        value: Number(item.id),
      })),
    [interfaceCases]
  );

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const syncLayout = () => setIsCompactLayout(window.innerWidth < 1280);
    syncLayout();
    window.addEventListener('resize', syncLayout);
    return () => window.removeEventListener('resize', syncLayout);
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setPlans([]);
      setSelectedPlanId(null);
      return;
    }
    loadPlans(selectedProjectId);
    loadCases(selectedProjectId);
  }, [selectedProjectId]);

  const loadProjects = async () => {
    try {
      const data = await projectApi.getProjects();
      setProjects(data || []);
      if (data?.length) setSelectedProjectId(data[0].id);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '加载项目失败');
    }
  };

  const loadPlans = async (projectId: number) => {
    setLoading(true);
    try {
      const data = await testPlanApi.getTestPlans(projectId);
      setPlans(data || []);
      setSelectedPlanId((prev) => {
        const next = (data || []).find((item: TestPlan) => item.id === prev);
        return next ? next.id : data?.[0]?.id ?? null;
      });
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '加载测试计划失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCases = async (projectId: number) => {
    try {
      const [functional, apiCases] = await Promise.all([
        testcaseApi.getTestCases(projectId),
        interfaceTestcaseApi.getAll(projectId),
      ]);
      setFunctionalCases(functional || []);
      setInterfaceCases(apiCases || []);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '加载测试用例失败');
    }
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    form.resetFields();
    form.setFieldsValue({
      project_id: selectedProjectId,
      owner: '管理员',
      status: 'draft',
      execution_mode: 'serial',
      priority: 'medium',
      tags: [],
      functional_case_ids: [],
      interface_case_ids: [],
    });
    setModalVisible(true);
  };

  const openEditModal = (plan: TestPlan) => {
    setEditingPlan(plan);
    form.setFieldsValue({
      ...plan,
      functional_case_ids: plan.functional_cases.map((item) => item.id),
      interface_case_ids: plan.interface_cases.map((item) => item.id),
    });
    setModalVisible(true);
  };

  const handleDelete = (plan: TestPlan) => {
    Modal.confirm({
      title: '确认删除测试计划',
      content: `删除后无法恢复：${plan.name}`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await testPlanApi.deleteTestPlan(plan.id);
          message.success('测试计划已删除');
          if (selectedProjectId) await loadPlans(selectedProjectId);
        } catch (e: any) {
          message.error(e?.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        project_id: values.project_id || selectedProjectId,
        tags: Array.isArray(values.tags)
          ? values.tags
          : String(values.tags || '')
              .split(/[,\n]/)
              .map((item) => item.trim())
              .filter(Boolean),
      };

      if (editingPlan) {
        await testPlanApi.updateTestPlan(editingPlan.id, payload);
        message.success('测试计划更新成功');
      } else {
        await testPlanApi.createTestPlan(payload);
        message.success('测试计划创建成功');
      }

      setModalVisible(false);
      if (selectedProjectId) await loadPlans(selectedProjectId);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.detail || '操作失败');
    }
  };

  const handleExecute = async (plan: TestPlan) => {
    setExecuting(true);
    const taskId = taskCenter.createTask({
      type: 'execute_test_plan',
      title: `执行测试计划：${plan.name}`,
      detail: '正在初始化计划执行',
      status: 'running',
      progress: 12,
      meta: { planId: plan.id },
    });
    taskCenter.startAutoProgress(taskId, { max: 88, step: 9, intervalMs: 700 });

    try {
      const execution = await testPlanApi.executeTestPlan(plan.id);
      taskCenter.markSuccess(
        taskId,
        `执行完成，通过 ${execution.passed_items}，失败 ${execution.failed_items}，错误 ${execution.error_items}，跳过 ${execution.skipped_items}`
      );
      message.success('测试计划执行完成');
      if (selectedProjectId) await loadPlans(selectedProjectId);
    } catch (e: any) {
      taskCenter.markFailed(taskId, e?.response?.data?.detail || '计划执行失败');
      message.error(e?.response?.data?.detail || '计划执行失败');
    } finally {
      setExecuting(false);
    }
  };

  const openScheduleModal = (plan: TestPlan) => {
    setScheduleEditingPlan(plan);
    const parsed = parseScheduleRule(plan.schedule);
    scheduleForm.setFieldsValue({
      type: parsed?.type || 'daily',
      weekday: parsed?.weekday || 1,
      dayOfMonth: parsed?.dayOfMonth || 1,
      time: dayjs(`2000-01-01 ${parsed?.time || '09:00:00'}`),
    });
    setScheduleModalVisible(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleEditingPlan) return;
    try {
      const values = await scheduleForm.validateFields();
      const rule: ScheduleRule = {
        type: values.type,
        time: values.time.format('HH:mm:ss'),
        weekday: values.type === 'weekly' ? values.weekday : undefined,
        dayOfMonth: values.type === 'monthly' ? values.dayOfMonth : undefined,
      };
      setScheduleSaving(true);
      await testPlanApi.updateTestPlan(scheduleEditingPlan.id, {
        schedule: stringifyScheduleRule(rule),
      });
      message.success('定时执行已保存');
      setScheduleModalVisible(false);
      if (selectedProjectId) await loadPlans(selectedProjectId);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.detail || '保存定时执行失败');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleClearSchedule = async () => {
    if (!scheduleEditingPlan) return;
    try {
      setScheduleSaving(true);
      await testPlanApi.updateTestPlan(scheduleEditingPlan.id, { schedule: null });
      message.success('已清除定时执行');
      setScheduleModalVisible(false);
      if (selectedProjectId) await loadPlans(selectedProjectId);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '清除定时执行失败');
    } finally {
      setScheduleSaving(false);
    }
  };

  const renderPriorityTag = (priority?: string) => {
    const meta = priorityMap[String(priority || 'medium').toLowerCase()] || priorityMap.medium;
    return <Tag color={meta.color}>{meta.text}</Tag>;
  };

  const renderStatusTag = (status?: string) => {
    const meta = statusMap[String(status || 'draft').toLowerCase()] || statusMap.draft;
    return <Tag color={meta.color}>{meta.text}</Tag>;
  };

  return (
    <div className="app-content fade-in" style={{ padding: 24, maxWidth: 1680, margin: '0 auto' }}>
      <div className="page-toolbar" style={{ marginBottom: 20 }}>
        <div className="page-title">
          <Title level={2} style={{ margin: 0 }}>测试计划</Title>
          <span className="page-subtitle">围绕项目组织功能测试与接口测试的执行集合</span>
        </div>
        <Space wrap>
          <Select
            style={{ width: 220 }}
            placeholder="选择项目"
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            options={projects.map((item) => ({ label: item.name, value: item.id }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} disabled={!selectedProjectId}>
            新建测试计划
          </Button>
        </Space>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: isCompactLayout ? 'column' : 'row',
          alignItems: 'stretch',
          gap: 20,
        }}
      >
        <div
          className="panel"
          style={{
            flex: isCompactLayout ? '1 1 auto' : '0 0 390px',
            width: isCompactLayout ? '100%' : 390,
            minWidth: 0,
          }}
        >
          <div className="panel-header">
            <Text strong>计划列表</Text>
            <Text type="secondary">{plans.length} 个计划</Text>
          </div>
          <div className="panel-body" style={{ minHeight: 640 }}>
            <Spin spinning={loading}>
              <List
                locale={{ emptyText: <Empty description="当前项目暂无测试计划" /> }}
                dataSource={plans}
                renderItem={(plan) => (
                  <div
                    onClick={() => setSelectedPlanId(plan.id)}
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      cursor: 'pointer',
                      marginBottom: 12,
                      border: selectedPlan?.id === plan.id ? '1px solid #1677ff' : '1px solid rgba(15,23,42,0.08)',
                      background: selectedPlan?.id === plan.id ? 'rgba(22,119,255,0.08)' : 'rgba(255,255,255,0.78)',
                    }}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <Text strong>{plan.name}</Text>
                        {renderStatusTag(plan.status)}
                      </div>
                      <Text type="secondary" ellipsis>{plan.description || '未填写计划说明'}</Text>
                      <Space wrap size={[8, 8]}>
                        {renderPriorityTag(plan.priority)}
                        <Tag icon={<ProjectOutlined />}>{plan.total_case_count} 项</Tag>
                        <Tag icon={<CalendarOutlined />}>
                          {formatScheduleText(plan.schedule) || dayjs(plan.updated_at).format('MM-DD HH:mm')}
                        </Tag>
                      </Space>
                    </Space>
                  </div>
                )}
              />
            </Spin>
          </div>
        </div>

        <div
          className="panel inspector-panel"
          style={{
            flex: 1,
            minWidth: 0,
            width: isCompactLayout ? '100%' : 'auto',
          }}
        >
          <div className="panel-header">
            <Text strong>计划详情</Text>
          </div>
          <div className="panel-body" style={{ minHeight: 640 }}>
            {!selectedPlan ? (
              <Empty description="选择左侧测试计划查看详情" />
            ) : (
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div>
                    <Title level={3} style={{ margin: 0 }}>{selectedPlan.name}</Title>
                    <Paragraph type="secondary" style={{ marginTop: 8, maxWidth: 860 }}>
                      {selectedPlan.description || '暂无描述'}
                    </Paragraph>
                    <Space wrap size={[8, 8]}>
                      {renderStatusTag(selectedPlan.status)}
                      {renderPriorityTag(selectedPlan.priority)}
                      <Tag>{selectedPlan.execution_mode === 'parallel' ? '并行执行' : '串行执行'}</Tag>
                      {selectedPlan.owner ? <Tag>{selectedPlan.owner}</Tag> : null}
                    </Space>
                  </div>
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => openEditModal(selectedPlan)}>编辑</Button>
                    <Button icon={<CalendarOutlined />} onClick={() => openScheduleModal(selectedPlan)}>定时执行</Button>
                    <Button
                      type="primary"
                      icon={<PlayCircleFilled />}
                      loading={executing}
                      onClick={() => handleExecute(selectedPlan)}
                    >
                      执行计划
                    </Button>
                    <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(selectedPlan)}>删除</Button>
                  </Space>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                  <Card><Statistic title="功能用例" value={selectedPlan.functional_cases.length} /></Card>
                  <Card><Statistic title="接口用例" value={selectedPlan.interface_cases.length} /></Card>
                  <Card><Statistic title="总覆盖项" value={selectedPlan.total_case_count} /></Card>
                  <Card>
                    <Statistic
                      title="最近执行"
                      value={selectedPlan.last_executed_at ? dayjs(selectedPlan.last_executed_at).format('MM-DD HH:mm') : '未执行'}
                    />
                  </Card>
                </div>

                <Card title="计划信息">
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="排期">{formatScheduleText(selectedPlan.schedule)}</Descriptions.Item>
                    <Descriptions.Item label="标签">
                      {selectedPlan.tags?.length ? (
                        <Space wrap>{selectedPlan.tags.map((tag) => <Tag key={tag} icon={<TagsOutlined />}>{tag}</Tag>)}</Space>
                      ) : '无'}
                    </Descriptions.Item>
                    <Descriptions.Item label="进入准则">{selectedPlan.entry_criteria || '未设置'}</Descriptions.Item>
                    <Descriptions.Item label="退出准则">{selectedPlan.exit_criteria || '未设置'}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Card title={`功能测试用例 (${selectedPlan.functional_cases.length})`}>
                    <List
                      locale={{ emptyText: '未关联功能测试用例' }}
                      dataSource={selectedPlan.functional_cases}
                      renderItem={(item) => (
                        <List.Item>
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <Text strong>{item.name}</Text>
                              {renderPriorityTag(item.priority)}
                            </div>
                            <Text type="secondary">{item.module || item.description || '无附加说明'}</Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </Card>

                  <Card title={`接口测试用例 (${selectedPlan.interface_cases.length})`}>
                    <List
                      locale={{ emptyText: '未关联接口测试用例' }}
                      dataSource={selectedPlan.interface_cases}
                      renderItem={(item) => (
                        <List.Item>
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <Text strong>{item.name}</Text>
                              <Space>
                                <Tag>{String(item.protocol || '').toUpperCase()}</Tag>
                                {item.method ? <Tag color="blue">{item.method}</Tag> : null}
                              </Space>
                            </div>
                            <Text type="secondary">{item.url || item.module || item.description || '无附加说明'}</Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </Card>
                </div>

                <Card title="最近一次执行结果">
                  {!selectedPlan.latest_execution ? (
                    <Empty description="还没有执行记录" />
                  ) : (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      <Space wrap size={[8, 8]}>
                        {renderStatusTag(selectedPlan.latest_execution.status)}
                        <Tag color="success">通过 {selectedPlan.latest_execution.passed_items}</Tag>
                        <Tag color="error">失败 {selectedPlan.latest_execution.failed_items}</Tag>
                        <Tag color="warning">错误 {selectedPlan.latest_execution.error_items}</Tag>
                        <Tag>跳过 {selectedPlan.latest_execution.skipped_items}</Tag>
                      </Space>
                      <Text type="secondary">
                        开始时间：{dayjs(selectedPlan.latest_execution.started_at).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                      <Divider style={{ margin: '4px 0' }} />
                      <List
                        locale={{ emptyText: '暂无明细' }}
                        dataSource={selectedPlan.latest_execution.summary?.details || []}
                        renderItem={(item) => (
                          <List.Item>
                            <div style={{ width: '100%' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <Text strong>{item.case_name}</Text>
                                {renderStatusTag(item.status)}
                              </div>
                              <Text type="secondary">{item.case_type === 'functional' ? '功能测试' : '接口测试'} · {item.message}</Text>
                            </div>
                          </List.Item>
                        )}
                      />
                    </Space>
                  )}
                </Card>
              </Space>
            )}
          </div>
        </div>
      </div>

      <Modal
        title={editingPlan ? '编辑测试计划' : '新建测试计划'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={920}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="name" label="计划名称" rules={[{ required: true, message: '请输入计划名称' }]}>
              <Input placeholder="例如：支付核心回归计划 / V2.4 发布冒烟计划" />
            </Form.Item>
            <Form.Item name="project_id" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
              <Select options={projects.map((item) => ({ label: item.name, value: item.id }))} />
            </Form.Item>
            <Form.Item name="owner" label="负责人">
              <Input placeholder="负责人" />
            </Form.Item>
            <Form.Item name="schedule" label="执行排期">
              <Input placeholder="例如：每周四回归 / 版本发布前一天" />
            </Form.Item>
            <Form.Item name="status" label="计划状态">
              <Select
                options={[
                  { label: '草稿', value: 'draft' },
                  { label: '就绪', value: 'ready' },
                  { label: '执行中', value: 'running' },
                  { label: '已完成', value: 'completed' },
                  { label: '已归档', value: 'archived' },
                ]}
              />
            </Form.Item>
            <Form.Item name="priority" label="优先级">
              <Select
                options={[
                  { label: '高', value: 'high' },
                  { label: '中', value: 'medium' },
                  { label: '低', value: 'low' },
                ]}
              />
            </Form.Item>
            <Form.Item name="execution_mode" label="执行方式">
              <Select
                options={[
                  { label: '串行执行', value: 'serial' },
                  { label: '并行执行', value: 'parallel' },
                ]}
              />
            </Form.Item>
            <Form.Item name="tags" label="标签">
              <Select mode="tags" tokenSeparators={[',']} placeholder="输入标签后回车" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="计划说明">
            <TextArea rows={3} placeholder="说明计划目标、覆盖范围、适用场景和里程碑。" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="entry_criteria" label="进入准则">
              <TextArea rows={3} placeholder="例如：需求冻结、环境就绪、核心接口联通。" />
            </Form.Item>
            <Form.Item name="exit_criteria" label="退出准则">
              <TextArea rows={3} placeholder="例如：P0/P1 缺陷关闭，关键链路通过率达到 95%。" />
            </Form.Item>
          </div>

          <Form.Item name="functional_case_ids" label="关联功能测试用例">
            <Select
              mode="multiple"
              placeholder="选择纳入计划的功能测试用例"
              options={functionalOptions}
              optionFilterProp="label"
              maxTagCount="responsive"
            />
          </Form.Item>

          <Form.Item name="interface_case_ids" label="关联接口测试用例">
            <Select
              mode="multiple"
              placeholder="选择纳入计划的接口测试用例"
              options={interfaceOptions}
              optionFilterProp="label"
              maxTagCount="responsive"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`定时执行配置${scheduleEditingPlan ? ` · ${scheduleEditingPlan.name}` : ''}`}
        open={scheduleModalVisible}
        onCancel={() => setScheduleModalVisible(false)}
        onOk={handleSaveSchedule}
        okText="保存"
        confirmLoading={scheduleSaving}
        destroyOnClose
        footer={(
          <Space>
            <Button onClick={() => setScheduleModalVisible(false)}>取消</Button>
            <Button danger onClick={handleClearSchedule} loading={scheduleSaving} disabled={!scheduleEditingPlan?.schedule}>清除</Button>
            <Button type="primary" onClick={handleSaveSchedule} loading={scheduleSaving}>保存</Button>
          </Space>
        )}
      >
        <Form form={scheduleForm} layout="vertical" initialValues={{ type: 'daily', weekday: 1, dayOfMonth: 1 }}>
          <Form.Item name="type" label="执行频率" rules={[{ required: true, message: '请选择执行频率' }]}>
            <Select
              options={[
                { label: '每日', value: 'daily' },
                { label: '每周', value: 'weekly' },
                { label: '每月', value: 'monthly' },
              ]}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const type = getFieldValue('type') as ScheduleType;
              if (type === 'weekly') {
                return (
                  <Form.Item name="weekday" label="每周执行日" rules={[{ required: true, message: '请选择每周执行日' }]}>
                    <Select options={weekdayOptions} />
                  </Form.Item>
                );
              }
              if (type === 'monthly') {
                return (
                  <Form.Item name="dayOfMonth" label="每月执行日" rules={[{ required: true, message: '请选择每月执行日' }]}>
                    <Select options={dayOfMonthOptions} />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="time" label="执行时间（时:分:秒）" rules={[{ required: true, message: '请选择执行时间' }]}>
            <TimePicker format="HH:mm:ss" style={{ width: '100%' }} />
          </Form.Item>

          <Text type="secondary">说明：当前仅提供定时规则配置入口，后续可由调度器读取该规则自动触发执行。</Text>
        </Form>
      </Modal>
    </div>
  );
};

export default TestPlans;
