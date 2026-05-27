import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { FileSearchOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { projectApi, traceabilityApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;

const riskColor: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
};

const ImpactAnalysis: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<number | undefined>();
  const [summary, setSummary] = useState<any>({});
  const [changes, setChanges] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const data = await projectApi.getProjects();
      setProjects(data || []);
    } catch (error) {
      message.error('加载项目列表失败');
    }
  }, []);

  const loadChanges = useCallback(async () => {
    setLoading(true);
    try {
      const data = await traceabilityApi.getImpactChanges({ project_id: projectId, limit: 100 });
      setSummary(data.summary || {});
      setChanges(data.items || []);
    } catch (error) {
      console.error('Failed to load impact changes', error);
      message.error('加载需求变更影响分析失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadChanges();
  }, [loadChanges]);

  const openDetail = async (record: any) => {
    setSelected(record);
    setDrawerOpen(true);
    setDetail(null);
    try {
      const data = await traceabilityApi.getImpactAnalysis(record.requirement_id);
      setDetail(data);
    } catch (error) {
      message.error('加载影响详情失败');
    }
  };

  return (
    <div className="app-content fade-in" style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>需求变更影响分析</Title>
          <Text type="secondary">跟踪需求变更影响范围、推荐回归用例和缺失用例补齐建议</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadChanges}>刷新</Button>
      </div>

      <Space size="large" wrap style={{ marginBottom: 16 }}>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">变更总数</Text>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.total_changes || 0}</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">高影响</Text>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#cf1322' }}>{summary.high_impact || 0}</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">中影响</Text>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#d48806' }}>{summary.medium_impact || 0}</div>
        </Card>
        <Card bordered={false} style={{ minWidth: 180 }}>
          <Text type="secondary">低影响</Text>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#389e0d' }}>{summary.low_impact || 0}</div>
        </Card>
      </Space>

      <Card bordered={false}>
        <div style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="按项目筛选"
            value={projectId}
            onChange={setProjectId}
            style={{ width: 240 }}
            options={projects.map((item) => ({ label: item.name, value: item.id }))}
          />
        </div>

        <Table
          loading={loading}
          rowKey="change_id"
          dataSource={changes}
          columns={[
            {
              title: '需求',
              dataIndex: 'requirement_title',
              render: (text: string, record: any) => (
                <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => openDetail(record)}>
                  {text}
                </Button>
              ),
            },
            {
              title: '影响等级',
              dataIndex: 'impact_level',
              render: (value: string) => <Tag color={riskColor[value] || 'default'}>{value}</Tag>,
            },
            {
              title: '变更字段',
              dataIndex: 'changed_fields',
              render: (value: string[]) => <Space wrap>{(value || []).map((item) => <Tag key={item}>{item}</Tag>)}</Space>,
            },
            {
              title: '关键词',
              dataIndex: 'impact_keywords',
              render: (value: string[]) => <Space wrap>{(value || []).slice(0, 5).map((item) => <Tag key={item}>{item}</Tag>)}</Space>,
            },
            {
              title: '推荐回归',
              dataIndex: 'recommended_count',
              render: (value: number) => <Tag color={value > 0 ? 'blue' : 'default'}>{value}</Tag>,
            },
            {
              title: '缺失建议',
              dataIndex: 'missing_suggestion_count',
              render: (value: number) => <Tag color={value > 0 ? 'orange' : 'green'}>{value}</Tag>,
            },
            {
              title: '变更时间',
              dataIndex: 'created_at',
              render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
            },
          ]}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Drawer title="影响分析详情" width={720} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {selected && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="需求">{selected.requirement_title}</Descriptions.Item>
              <Descriptions.Item label="影响等级"><Tag color={riskColor[detail?.impact_level]}>{detail?.impact_level || selected.impact_level}</Tag></Descriptions.Item>
              <Descriptions.Item label="变更字段">{(detail?.changed_fields || selected.changed_fields || []).join(', ') || '-'}</Descriptions.Item>
              <Descriptions.Item label="影响关键词">
                <Space wrap>{(detail?.impact_keywords || []).map((item: string) => <Tag key={item}>{item}</Tag>)}</Space>
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title={<Space><ThunderboltOutlined /> 推荐回归范围</Space>}>
              <Table
                size="small"
                rowKey={(item: any) => `${item.asset_type}-${item.asset_id}-${item.source}`}
                dataSource={detail?.recommended_regression || []}
                pagination={false}
                columns={[
                  { title: '类型', dataIndex: 'asset_type' },
                  { title: '名称', dataIndex: 'name' },
                  { title: '来源', dataIndex: 'source' },
                ]}
              />
            </Card>

            <Card size="small" title={<Space><FileSearchOutlined /> 缺失用例建议</Space>}>
              {(detail?.missing_case_suggestions || []).map((item: any) => (
                <div key={item.type} style={{ marginBottom: 16 }}>
                  <Text strong>{item.title}</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 6 }}>{item.reason}</Paragraph>
                  <Tag color="blue">{item.type}</Tag>
                  <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{item.prompt}</Paragraph>
                </div>
              ))}
              {!(detail?.missing_case_suggestions || []).length && <Text type="secondary">暂无缺失用例建议</Text>}
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default ImpactAnalysis;
