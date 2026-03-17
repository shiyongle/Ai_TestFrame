import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  DatePicker,
  Typography,
  Progress,
  List,
  Avatar,
  Tooltip,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FilePdfOutlined,
  DownloadOutlined,
  PieChartOutlined,
  LineChartOutlined,
  CalendarOutlined,
  BugOutlined,
  ExperimentOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { reportApi } from '../services/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface ReportSummary {
  total_executions: number;
  avg_pass_rate: number;
  bugs_found: number;
  total_duration: string;
}

interface TrendItem {
  date: string;
  passed: number;
  failed: number;
  total: number;
}

interface ModuleItem {
  module: string;
  count: number;
}

interface ReportItem {
  id: number;
  name: string;
  date: string;
  duration: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  pass_rate: number;
  status: 'success' | 'unstable' | 'failed';
  executor: string;
}

const defaultSummary: ReportSummary = {
  total_executions: 0,
  avg_pass_rate: 0,
  bugs_found: 0,
  total_duration: '0s',
};

const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ReportSummary>(defaultSummary);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);

  const loadReportsData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: 200, offset: 0 };
      if (dateRange?.[0]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
      }
      if (dateRange?.[1]) {
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const data = await reportApi.getOverview(params);
      setSummary(data.summary || defaultSummary);
      setTrend(data.trend || []);
      setModules(data.module_distribution || []);
      setReports(data.reports || []);
    } catch (error) {
      console.error('Failed to load reports data', error);
      message.error('加载测试报告数据失败');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  const moduleTotal = useMemo(() => modules.reduce((sum, item) => sum + (item.count || 0), 0), [modules]);

  const handleExportCSV = () => {
    if (!reports.length) {
      message.info('暂无可导出的报告数据');
      return;
    }

    const headers = ['id', 'name', 'date', 'executor', 'total', 'passed', 'failed', 'skipped', 'pass_rate', 'duration'];
    const rows = reports.map((item) => [
      item.id,
      `"${String(item.name).replace(/"/g, '""')}"`,
      item.date,
      `"${String(item.executor).replace(/"/g, '""')}"`,
      item.total,
      item.passed,
      item.failed,
      item.skipped,
      item.pass_rate,
      item.duration,
    ]);

    const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reports_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderSummaryCards = () => (
    <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false} className="stat-card" style={{ height: '100%' }} loading={loading}>
          <Statistic
            title="Total Executions"
            value={summary.total_executions}
            prefix={<ExperimentOutlined style={{ color: '#1890ff' }} />}
          />
          <div style={{ marginTop: 12 }}>
            <Progress percent={Math.min(100, summary.total_executions ? 100 : 0)} showInfo={false} strokeColor="#1890ff" size="small" />
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false} className="stat-card" style={{ height: '100%' }} loading={loading}>
          <Statistic
            title="Avg Pass Rate"
            value={summary.avg_pass_rate}
            precision={1}
            suffix="%"
            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            valueStyle={{ color: '#52c41a' }}
          />
          <div style={{ marginTop: 12 }}>
            <Progress percent={summary.avg_pass_rate} showInfo={false} strokeColor="#52c41a" size="small" />
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false} className="stat-card" style={{ height: '100%' }} loading={loading}>
          <Statistic
            title="Bugs Found"
            value={summary.bugs_found}
            prefix={<BugOutlined style={{ color: '#ff4d4f' }} />}
            valueStyle={{ color: '#ff4d4f' }}
          />
          <div style={{ marginTop: 12 }}>
            <Progress percent={Math.min(100, summary.bugs_found)} showInfo={false} strokeColor="#ff4d4f" size="small" />
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false} className="stat-card" style={{ height: '100%' }} loading={loading}>
          <Statistic
            title="Total Duration"
            value={summary.total_duration}
            prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
          />
          <div style={{ marginTop: 12 }}>
            <Progress percent={60} showInfo={false} strokeColor="#fa8c16" size="small" />
          </div>
        </Card>
      </Col>
    </Row>
  );

  const renderCharts = () => (
    <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
      <Col xs={24} lg={16}>
        <Card
          title={<Space><LineChartOutlined /> <span>Pass/Fail Trend (Last 7 Days)</span></Space>}
          bordered={false}
          style={{ borderRadius: 12 }}
          loading={loading}
        >
          <List
            dataSource={trend}
            locale={{ emptyText: '暂无趋势数据' }}
            renderItem={(item) => {
              const rate = item.total > 0 ? Math.round((item.passed / item.total) * 100) : 0;
              return (
                <List.Item>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <Text>{item.date}</Text>
                    <Space>
                      <Tag color="success">{item.passed} Pass</Tag>
                      <Tag color="error">{item.failed} Fail</Tag>
                      <Text type="secondary">{rate}%</Text>
                    </Space>
                  </div>
                </List.Item>
              );
            }}
          />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card
          title={<Space><PieChartOutlined /> <span>Module Distribution</span></Space>}
          bordered={false}
          style={{ borderRadius: 12 }}
          loading={loading}
        >
          <List
            dataSource={modules.slice(0, 8)}
            locale={{ emptyText: '暂无模块分布数据' }}
            renderItem={(item) => {
              const percent = moduleTotal > 0 ? Math.round((item.count / moduleTotal) * 100) : 0;
              return (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text>{item.module}</Text>
                      <Text type="secondary">{item.count}</Text>
                    </div>
                    <Progress percent={percent} showInfo={false} size="small" />
                  </div>
                </List.Item>
              );
            }}
          />
        </Card>
      </Col>
    </Row>
  );

  const renderReportList = () => (
    <div className="glass-panel" style={{ background: '#fff', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Detailed Reports</Title>
        <Space>
          <RangePicker value={dateRange as any} onChange={(dates) => setDateRange((dates as any) || null)} />
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>Export CSV</Button>
        </Space>
      </div>

      <Table
        loading={loading}
        dataSource={reports}
        rowKey="id"
        className="glass-table"
        columns={[
          {
            title: 'Report Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: ReportItem) => (
              <Space>
                <Avatar shape="square" style={{ backgroundColor: record.status === 'success' ? '#f6ffed' : '#fff2f0', color: record.status === 'success' ? '#52c41a' : '#ff4d4f' }}>
                  <FilePdfOutlined />
                </Avatar>
                <div>
                  <Text strong>{text}</Text>
                  <div style={{ fontSize: 12, color: '#999' }}>ID: {record.id}</div>
                </div>
              </Space>
            ),
          },
          {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            render: (text: string) => <Space><CalendarOutlined style={{ color: '#999' }} /> {text}</Space>,
          },
          {
            title: 'Status',
            key: 'status',
            render: (_: any, record: ReportItem) => (
              <Space>
                <Progress
                  type="circle"
                  percent={record.pass_rate}
                  width={30}
                  strokeColor={record.pass_rate > 90 ? '#52c41a' : record.pass_rate > 70 ? '#fa8c16' : '#ff4d4f'}
                />
                <Text>{record.pass_rate}%</Text>
              </Space>
            ),
          },
          {
            title: 'Summary',
            key: 'summary',
            render: (_: any, record: ReportItem) => (
              <Space size="small">
                <Tag color="success">{record.passed} Pass</Tag>
                <Tag color="error">{record.failed} Fail</Tag>
                <Tag color="default">{record.skipped} Skip</Tag>
              </Space>
            ),
          },
          {
            title: 'Duration',
            dataIndex: 'duration',
            key: 'duration',
            render: (text: string) => <Tag icon={<ClockCircleOutlined />}>{text}</Tag>,
          },
          {
            title: 'Executor',
            dataIndex: 'executor',
            key: 'executor',
          },
          {
            title: 'Actions',
            key: 'actions',
            render: () => (
              <Space>
                <Tooltip title="View Details"><Button type="text" icon={<EyeOutlined />} /></Tooltip>
                <Tooltip title="Download PDF"><Button type="text" icon={<DownloadOutlined />} /></Tooltip>
              </Space>
            ),
          },
        ]}
        pagination={{ pageSize: 8 }}
      />
    </div>
  );

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700 }}>测试报告</Title>
        <Text type="secondary">自动化测试执行结果统计与分析</Text>
      </div>

      {renderSummaryCards()}
      {renderCharts()}
      {renderReportList()}
    </div>
  );
};

export default Reports;
