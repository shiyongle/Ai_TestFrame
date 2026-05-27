import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { projectApi, traceabilityApi, versionApi } from '../services/api';

const { Title, Text } = Typography;

const statusText: Record<string, string> = {
  draft: '草稿',
  review: '评审中',
  approved: '已批准',
  development: '开发中',
  testing: '测试中',
  completed: '已完成',
  rejected: '已拒绝',
};

const coverageText: Record<string, string> = {
  covered: '已覆盖',
  uncovered: '未覆盖',
};

const executionText: Record<string, string> = {
  not_run: '未执行',
  partial: '部分执行',
  passed: '通过',
  failed: '失败',
  error: '异常',
};

const riskColor: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
};

const TraceabilityMatrix: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<number | undefined>();
  const [versionId, setVersionId] = useState<number | undefined>();
  const [coverageStatus, setCoverageStatus] = useState<string | undefined>();
  const [summary, setSummary] = useState<any>({});
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [impact, setImpact] = useState<any | null>(null);
  const [recommendations, setRecommendations] = useState<any | null>(null);

  const loadOptions = useCallback(async () => {
    try {
      const [projectList, versionList] = await Promise.all([
        projectApi.getProjects(),
        versionApi.getVersions(),
      ]);
      setProjects(projectList || []);
      setVersions(versionList || []);
    } catch (error) {
      message.error('加载项目或版本列表失败');
    }
  }, []);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const data = await traceabilityApi.getMatrix({
        project_id: projectId,
        version_id: versionId,
        coverage_status: coverageStatus,
      });
      setSummary(data.summary || {});
      setRows(data.rows || []);
    } catch (error) {
      console.error('Failed to load traceability matrix', error);
      message.error('加载质量追踪矩阵失败');
    } finally {
      setLoading(false);
    }
  }, [coverageStatus, projectId, versionId]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const openDetail = async (record: any) => {
    setSelected(record);
    setDrawerOpen(true);
    setImpact(null);
    setRecommendations(null);
    try {
      const [impactData, recommendationData] = await Promise.all([
        traceabilityApi.getImpactAnalysis(record.requirement_id),
        traceabilityApi.getRegressionRecommendations(record.requirement_id),
      ]);
      setImpact(impactData);
      setRecommendations(recommendationData);
    } catch (error) {
      console.error('Failed to load traceability detail', error);
    }
  };

  const applySuggestedStatus = async (record: any) => {
    try {
      await traceabilityApi.applySuggestedStatus(record.requirement_id, record.suggested_status);
      message.success('需求状态已更新');
      loadMatrix();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '更新需求状态失败');
    }
  };

  const createRegressionPlan = async () => {
    if (!selected) {
      return;
    }
    try {
      const plan = await traceabilityApi.createRegressionPlan(selected.requirement_id, {
        owner: 'QA',
        execution_mode: 'serial',
        priority: selected.risk_level === 'high' ? 'high' : 'medium',
      });
      message.success(`已生成回归测试计划：${plan.name}`);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '生成回归测试计划失败');
    }
  };

  return (
    <div className="app-content fade-in" style={{ padding: 24, maxWidth: 1680, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>质量追踪矩阵</Title>
          <Text type="secondary">需求-用例-执行-缺陷全链路追踪、回归推荐与影响分析</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadMatrix}>刷新</Button>
      </div>

      <Space size="large" wrap style={{ marginBottom: 16 }}>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">需求总数</Text>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.total_requirements || 0}</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">覆盖率</Text>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.coverage_rate || 0}%</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">执行率</Text>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.execution_rate || 0}%</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">失败需求</Text>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#cf1322' }}>{summary.failed_requirements || 0}</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">未关闭缺陷</Text>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#cf1322' }}>{summary.open_defects || 0}</div>
        </Card>
      </Space>

      <Card bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <Space wrap>
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
              placeholder="版本"
              value={versionId}
              onChange={setVersionId}
              style={{ width: 220 }}
              options={versions.map((item) => ({ label: item.version_number || item.name || `版本 #${item.id}`, value: item.id }))}
            />
            <Select
              allowClear
              placeholder="覆盖状态"
              value={coverageStatus}
              onChange={setCoverageStatus}
              style={{ width: 160 }}
              options={[
                { label: '已覆盖', value: 'covered' },
                { label: '未覆盖', value: 'uncovered' },
              ]}
            />
          </Space>
        </div>

        <Table
          loading={loading}
          dataSource={rows}
          rowKey="requirement_id"
          columns={[
            {
              title: '需求',
              dataIndex: 'title',
              render: (text: string, record: any) => (
                <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => openDetail(record)}>
                  {text}
                </Button>
              ),
            },
            {
              title: '覆盖',
              dataIndex: 'coverage_status',
              render: (value: string, record: any) => (
                <Space>
                  <Tag color={value === 'covered' ? 'green' : 'red'}>{coverageText[value] || value}</Tag>
                  <Text type="secondary">{record.asset_count} 个资产</Text>
                </Space>
              ),
            },
            {
              title: '自动化',
              dataIndex: 'automation_asset_count',
              render: (value: number) => <Tag color="blue">{value || 0}</Tag>,
            },
            {
              title: '执行',
              dataIndex: 'execution_status',
              render: (value: string, record: any) => (
                <Space>
                  <Tag color={value === 'passed' ? 'green' : value === 'failed' ? 'red' : 'default'}>
                    {executionText[value] || value}
                  </Tag>
                  <Progress percent={record.pass_rate || 0} size="small" style={{ width: 90 }} />
                </Space>
              ),
            },
            {
              title: '缺陷',
              dataIndex: 'open_defects',
              render: (value: number) => <Tag color={value > 0 ? 'red' : 'green'}>{value}</Tag>,
            },
            {
              title: '风险',
              dataIndex: 'risk_level',
              render: (value: string) => <Tag color={riskColor[value] || 'default'}>{value}</Tag>,
            },
            {
              title: '当前状态',
              dataIndex: 'status',
              render: (value: string) => <Tag>{statusText[value] || value}</Tag>,
            },
            {
              title: '建议状态',
              dataIndex: 'suggested_status',
              render: (value: string, record: any) => (
                <Space>
                  <Tag color={value === 'completed' ? 'green' : 'processing'}>{statusText[value] || value}</Tag>
                  {value && value !== record.status && (
                    <Button size="small" icon={<CheckCircleOutlined />} onClick={() => applySuggestedStatus(record)}>应用</Button>
                  )}
                </Space>
              ),
            },
            {
              title: '更新时间',
              dataIndex: 'updated_at',
              render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
            },
          ]}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Drawer title="追踪详情" open={drawerOpen} width={720} onClose={() => setDrawerOpen(false)}>
        {selected && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="需求">{selected.title}</Descriptions.Item>
              <Descriptions.Item label="覆盖状态">{coverageText[selected.coverage_status] || selected.coverage_status}</Descriptions.Item>
              <Descriptions.Item label="执行状态">{executionText[selected.execution_status] || selected.execution_status}</Descriptions.Item>
              <Descriptions.Item label="风险等级"><Tag color={riskColor[selected.risk_level]}>{selected.risk_level}</Tag></Descriptions.Item>
              <Descriptions.Item label="建议状态">{statusText[selected.suggested_status] || selected.suggested_status}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title={<Space><ApartmentOutlined /> 关联测试资产</Space>}>
              <Table
                size="small"
                rowKey={(item: any) => `${item.asset_type}-${item.asset_id}`}
                dataSource={selected.assets || []}
                pagination={false}
                columns={[
                  { title: '类型', dataIndex: 'asset_type' },
                  { title: '名称', dataIndex: 'name' },
                  { title: '来源', dataIndex: 'source' },
                ]}
              />
            </Card>

            <Card
              size="small"
              title={<Space><ThunderboltOutlined /> 推荐回归范围</Space>}
              extra={<Button size="small" type="primary" onClick={createRegressionPlan}>生成回归计划</Button>}
            >
              <Table
                size="small"
                rowKey={(item: any) => `${item.asset_type}-${item.asset_id}-${item.source}`}
                dataSource={recommendations?.recommendations || []}
                pagination={false}
                columns={[
                  { title: '类型', dataIndex: 'asset_type' },
                  { title: '名称', dataIndex: 'name' },
                  { title: '推荐来源', dataIndex: 'source' },
                ]}
              />
            </Card>

            <Card size="small" title={<Space><FileSearchOutlined /> 影响分析</Space>}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="影响等级">
                  <Tag color={riskColor[impact?.impact_level] || 'default'}>{impact?.impact_level || '-'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="变更字段">{(impact?.changed_fields || []).join(', ') || '-'}</Descriptions.Item>
                <Descriptions.Item label="影响关键词">
                  <Space wrap>{(impact?.impact_keywords || []).map((item: string) => <Tag key={item}>{item}</Tag>)}</Space>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default TraceabilityMatrix;
