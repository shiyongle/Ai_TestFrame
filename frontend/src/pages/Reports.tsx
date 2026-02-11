import React, { useState } from 'react';
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
  Tooltip
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FilePdfOutlined,
  DownloadOutlined,
  PieChartOutlined,
  LineChartOutlined,
  BarChartOutlined,
  CalendarOutlined,
  BugOutlined,
  ExperimentOutlined,
  EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// --- Mock Data ---

const mockReports = Array.from({ length: 15 }).map((_, i) => ({
  id: `RPT-${20240211 - i}`,
  name: `Daily Regression Test - Build #${1024 - i}`,
  date: dayjs().subtract(i, 'day').format('YYYY-MM-DD HH:mm'),
  duration: '12m 30s',
  total: 150,
  passed: 142 - (i % 5),
  failed: 5 + (i % 5),
  skipped: 3,
  passRate: Math.floor(((142 - (i % 5)) / 150) * 100),
  status: (142 - (i % 5)) > 140 ? 'success' : 'unstable',
  executor: 'CI/CD Bot'
}));

const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // --- Renderers ---

  const renderSummaryCards = () => (
    <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false} className="stat-card" style={{ height: '100%' }}>
          <Statistic
            title="Total Executions"
            value={128}
            prefix={<ExperimentOutlined style={{ color: '#1890ff' }} />}
            suffix={<Text type="secondary" style={{ fontSize: 12 }}>+12% this week</Text>}
          />
          <div style={{ marginTop: 12 }}>
            <Progress percent={80} showInfo={false} strokeColor="#1890ff" size="small" />
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false} className="stat-card" style={{ height: '100%' }}>
          <Statistic
            title="Avg Pass Rate"
            value={94.5}
            precision={1}
            suffix="%"
            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            valueStyle={{ color: '#52c41a' }}
          />
          <div style={{ marginTop: 12 }}>
            <Progress percent={94.5} showInfo={false} strokeColor="#52c41a" size="small" />
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false} className="stat-card" style={{ height: '100%' }}>
          <Statistic
            title="Bugs Found"
            value={23}
            prefix={<BugOutlined style={{ color: '#ff4d4f' }} />}
            valueStyle={{ color: '#ff4d4f' }}
          />
          <div style={{ marginTop: 12 }}>
            <Progress percent={30} showInfo={false} strokeColor="#ff4d4f" size="small" />
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false} className="stat-card" style={{ height: '100%' }}>
          <Statistic
            title="Total Duration"
            value="48h 20m"
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
        >
          <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 8, border: '1px dashed #e8e8e8' }}>
            <Text type="secondary">Line Chart Placeholder (Passed vs Failed)</Text>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card
          title={<Space><PieChartOutlined /> <span>Module Distribution</span></Space>}
          bordered={false}
          style={{ borderRadius: 12 }}
        >
          <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 8, border: '1px dashed #e8e8e8' }}>
            <Text type="secondary">Pie Chart Placeholder</Text>
          </div>
        </Card>
      </Col>
    </Row>
  );

  const renderReportList = () => (
    <div className="glass-panel" style={{ background: '#fff', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Detailed Reports</Title>
        <Space>
          <RangePicker onChange={(dates) => setDateRange(dates as any)} />
          <Button icon={<DownloadOutlined />}>Export CSV</Button>
        </Space>
      </div>

      <Table
        dataSource={mockReports}
        rowKey="id"
        className="glass-table"
        columns={[
          {
            title: 'Report Name',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
              <Space>
                <Avatar shape="square" style={{ backgroundColor: record.status === 'success' ? '#f6ffed' : '#fff2f0', color: record.status === 'success' ? '#52c41a' : '#ff4d4f' }}>
                  <FilePdfOutlined />
                </Avatar>
                <div>
                  <Text strong>{text}</Text>
                  <div style={{ fontSize: 12, color: '#999' }}>ID: {record.id}</div>
                </div>
              </Space>
            )
          },
          {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            render: text => <Space><CalendarOutlined style={{ color: '#999' }} /> {text}</Space>
          },
          {
            title: 'Status',
            key: 'status',
            render: (_, record) => (
              <Space>
                <Progress
                  type="circle"
                  percent={record.passRate}
                  width={30}
                  strokeColor={record.passRate > 90 ? '#52c41a' : record.passRate > 70 ? '#fa8c16' : '#ff4d4f'}
                />
                <Text>{record.passRate}%</Text>
              </Space>
            )
          },
          {
            title: 'Summary',
            key: 'summary',
            render: (_, record) => (
              <Space size="small">
                <Tag color="success">{record.passed} Pass</Tag>
                <Tag color="error">{record.failed} Fail</Tag>
                <Tag color="default">{record.skipped} Skip</Tag>
              </Space>
            )
          },
          {
            title: 'Duration',
            dataIndex: 'duration',
            key: 'duration',
            render: text => <Tag icon={<ClockCircleOutlined />}>{text}</Tag>
          },
          {
            title: 'Actions',
            key: 'actions',
            render: () => (
              <Space>
                <Tooltip title="View Details"><Button type="text" icon={<EyeOutlined />} /></Tooltip>
                <Tooltip title="Download PDF"><Button type="text" icon={<DownloadOutlined />} /></Tooltip>
              </Space>
            )
          }
        ]}
        pagination={{ pageSize: 8 }}
      />
    </div>
  );

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
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