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
    <div className="fade-in">
      <Card style={{ marginBottom: 24 }} bordered={false} bodyStyle={{ padding: 20 }}>
        <Space direction="vertical" size={6}>
          <Text type="secondary" className="subtle-text">
            实时可视化 · AI 测试驾驶舱
          </Text>
          <Title level={2} style={{ margin: 0, color: '#111827' }}>
            投石问路-智能仪表盘
          </Title>
          <Space size="middle">
            <div className="metric-pill">
              <BugOutlined />
              测试运行良好
            </div>
            <Text className="subtle-text">快速洞察项目、用例与执行质量</Text>
          </Space>
        </Space>
      </Card>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总项目数"
              value={stats.totalProjects}
              prefix={<ProjectOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="测试用例"
              value={stats.totalTestCases}
              prefix={<BugOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="成功测试"
              value={stats.passedTests}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="失败测试"
              value={stats.failedTests}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#faad14' }} />
                <span>测试统计</span>
              </Space>
            }
            extra={
              <Space>
                <Text type="secondary">成功率</Text>
                <Text strong style={{ color: '#52c41a' }}>
                  {successRate}%
                </Text>
              </Space>
            }
          >
            <div style={{ padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
              <Progress
                type="circle"
                percent={successRate}
                format={(percent) => `${percent}%`}
                size={120}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
            </div>
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <Space split={<Text type="secondary">|</Text>}>
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <Text>成功 {stats.passedTests}</Text>
                </Space>
                <Space>
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  <Text>失败 {stats.failedTests}</Text>
                </Space>
              </Space>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#1890ff' }} />
                <span>最近测试</span>
              </Space>
            }
            extra={<Button type="link" size="small">查看全部</Button>}
          >
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
                          backgroundColor: item.status === 'success' ? '#f6ffed' : '#fff2f0',
                          color: item.status === 'success' ? '#52c41a' : '#ff4d4f',
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
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
