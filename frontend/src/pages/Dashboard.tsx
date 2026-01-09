import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, List, Avatar, Tag, Progress, Space, Button } from 'antd';
import {
  ProjectOutlined,
  BugOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { projectApi } from '../services/api';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalTestCases: 0,
    passedTests: 0,
    failedTests: 0,
  });

  const [recentTests, setRecentTests] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const projects = await projectApi.getProjects();

      // 模拟统计数据（实际应从 API 获取）
      setStats({
        totalProjects: projects?.length || 0,
        totalTestCases: 45,
        passedTests: 38,
        failedTests: 7,
      });

      // 模拟最近测试数据
      setRecentTests([
        {
          id: 1,
          name: '用户登录接口测试',
          status: 'success',
          time: '2023-12-03 15:30:00',
          duration: '245ms',
        },
        {
          id: 2,
          name: '订单创建接口测试',
          status: 'failed',
          time: '2023-12-03 15:25:00',
          duration: '1200ms',
        },
        {
          id: 3,
          name: 'TCP 连接测试',
          status: 'success',
          time: '2023-12-03 15:20:00',
          duration: '89ms',
        },
      ]);
    } catch (error) {
      console.error('加载仪表盘数据失败', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'success':
        return <Tag color="success">成功</Tag>;
      case 'failed':
        return <Tag color="error">失败</Tag>;
      default:
        return <Tag color="warning">进行中</Tag>;
    }
  };

  const executedTotal = Math.max(stats.passedTests + stats.failedTests, 1);
  const successRate = Math.round((stats.passedTests / executedTotal) * 100);

  return (
    <div className="page-shell fade-in">
      <div className="page-toolbar">
        <div className="page-title">
          <Text className="page-subtitle">实时概览 · AI 测试驾驶舱</Text>
          <Title level={2} style={{ margin: 0 }}>
            智能仪表盘
          </Title>
        </div>
        <Space>
          <Button>查看报告</Button>
          <Button type="primary">新建测试</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="总项目数"
              value={stats.totalProjects}
              prefix={<ProjectOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="测试用例"
              value={stats.totalTestCases}
              prefix={<BugOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="成功测试"
              value={stats.passedTests}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="失败测试"
              value={stats.failedTests}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          <div className="panel">
            <div className="panel-header">
              <Space>
                <TrophyOutlined style={{ color: '#f5a524' }} />
                <Text strong>测试统计</Text>
              </Space>
              <Space>
                <Text type="secondary">成功率</Text>
                <Text strong style={{ color: '#2fbf71' }}>
                  {successRate}%
                </Text>
              </Space>
            </div>
            <div className="panel-body" style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={successRate}
                format={(percent) => `${percent}%`}
                size={120}
                strokeColor={{
                  '0%': '#1f87ff',
                  '100%': '#2fbf71',
                }}
              />
              <div style={{ marginTop: 16 }}>
                <Space split={<Text type="secondary">|</Text>}>
                  <Space>
                    <CheckCircleOutlined style={{ color: '#2fbf71' }} />
                    <Text>成功 {stats.passedTests}</Text>
                  </Space>
                  <Space>
                    <CloseCircleOutlined style={{ color: '#e5484d' }} />
                    <Text>失败 {stats.failedTests}</Text>
                  </Space>
                </Space>
              </div>
            </div>
          </div>
        </Col>
        <Col xs={24} lg={8}>
          <div className="panel">
            <div className="panel-header">
              <Space>
                <ClockCircleOutlined style={{ color: '#0071e3' }} />
                <Text strong>最近测试</Text>
              </Space>
              <Button type="link" size="small">
                查看全部
              </Button>
            </div>
            <div className="panel-body">
              <List
                itemLayout="horizontal"
                dataSource={recentTests}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          icon={getStatusIcon(item.status)}
                          style={{
                            backgroundColor: item.status === 'success' ? '#eefbf3' : '#fff1f0',
                            color: item.status === 'success' ? '#2fbf71' : '#e5484d',
                          }}
                        />
                      }
                      title={
                        <Space>
                          <Text>{item.name}</Text>
                          {getStatusTag(item.status)}
                        </Space>
                      }
                      description={
                        <Space split={<Text type="secondary">·</Text>}>
                          <Text type="secondary">{item.time}</Text>
                          <Text type="secondary">{item.duration}</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
