import React, { useState, useEffect } from 'react';
import { Card, Avatar, Tag, Button, Typography, Space, Tooltip } from 'antd';
import {
  ProjectOutlined,
  BugOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleOutlined,
  ThunderboltFilled,
  ArrowRightOutlined,
  PlusOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { projectApi } from '../services/api';
import dayjs from 'dayjs';

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

      // Mock data replacement
      setStats({
        totalProjects: projects?.length || 12,
        totalTestCases: 145,
        passedTests: 132,
        failedTests: 13,
      });

      setRecentTests([
        { id: 1, name: '用户登录接口', status: 'success', time: '10:23', duration: '120ms', user: 'Admin' },
        { id: 2, name: '订单创建流程', status: 'failed', time: '10:15', duration: '890ms', user: 'Dev' },
        { id: 3, name: '支付网关回调', status: 'success', time: '09:45', duration: '240ms', user: 'Admin' },
        { id: 4, name: '库存扣减检查', status: 'success', time: '09:30', duration: '56ms', user: 'System' },
        { id: 5, name: '消息推送服务', status: 'pending', time: '09:12', duration: '-', user: 'Bot' },
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    }
  };

  const BentoCard = ({ children, style, className, title, extra }: any) => (
    <div
      className={`panel ${className}`}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...style
      }}
    >
      {(title || extra) && (
        <div className="panel-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <Text strong style={{ fontSize: 16 }}>{title}</Text>
          {extra}
        </div>
      )}
      <div className="panel-body" style={{ flex: 1, padding: '20px' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header Section */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 14 }}>{dayjs().format('MMMM D, dddd')}</Text>
          <Title level={2} style={{ margin: '4px 0 0', fontWeight: 800, letterSpacing: '-0.5px' }}>
            早安，管理员
          </Title>
        </div>
        <Space>
          <Button icon={<PlusOutlined />}>新建项目</Button>
          <Button type="primary" icon={<ThunderboltFilled />}>快速测试</Button>
        </Space>
      </div>

      {/* Bento Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: 'repeat(2, 180px) auto',
        gap: '20px'
      }}>

        {/* 1. Projects Stats - Tall */}
        <BentoCard
          style={{ gridRow: 'span 2', background: 'linear-gradient(135deg, #007AFF 0%, #00C6FF 100%)', color: 'white' }}
          className="dark-text-white"
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 }}>
                <ProjectOutlined style={{ fontSize: 24, color: 'white' }} />
              </div>
              <Tooltip title="Manage Projects"><MoreOutlined style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }} /></Tooltip>
            </div>
            <div>
              <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{stats.totalProjects}</div>
              <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>活跃项目</div>
            </div>
            <div style={{ fontSize: 12, background: 'rgba(0,0,0,0.1)', padding: '8px 12px', borderRadius: 8, marginTop: 16 }}>
              +3 本周新增
            </div>
          </div>
        </BentoCard>

        {/* 2. Success Rate - Wide */}
        <BentoCard style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Text type="secondary">本周通过率</Text>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#34C759', margin: '4px 0' }}>
                91.4%
              </div>
              <Space>
                <Tag color="success" style={{ border: 'none', background: 'rgba(52, 199, 89, 0.15)', color: '#34C759' }}>
                  <CheckCircleFilled /> {stats.passedTests} 通过
                </Tag>
                <Tag color="error" style={{ border: 'none', background: 'rgba(255, 59, 48, 0.15)', color: '#FF3B30' }}>
                  <CloseCircleFilled /> {stats.failedTests} 失败
                </Tag>
              </Space>
            </div>
            {/* Visual placeholder for chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '80%', paddingBottom: 10 }}>
              {[40, 60, 45, 70, 85, 91, 75].map((h, i) => (
                <div key={i} style={{
                  width: 8,
                  height: `${h}%`,
                  background: i === 5 ? '#34C759' : '#E5E5EA',
                  borderRadius: 4
                }} />
              ))}
            </div>
          </div>
        </BentoCard>

        {/* 3. Total Cases - Small */}
        <BentoCard>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <BugOutlined style={{ fontSize: 28, color: '#FF9500', marginBottom: 12 }} />
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.totalTestCases}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>总测试用例</Text>
          </div>
        </BentoCard>

        {/* 4. Quick Actions / Tools - Small */}
        <BentoCard style={{ background: '#F2F2F7', border: 'none' }}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }} className="hover-scale">
            <div style={{ background: 'white', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <ThunderboltFilled style={{ fontSize: 20, color: '#007AFF' }} />
            </div>
            <Text style={{ fontWeight: 600 }}>一键回归</Text>
          </div>
        </BentoCard>

        {/* 5. Recent Failures - Wide (Span 2) */}
        <BentoCard style={{ gridColumn: 'span 2' }} title="需要关注">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
            {recentTests.filter(t => t.status === 'failed').length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: '#34C759' }}>
                <CheckCircleFilled style={{ marginRight: 8 }} /> 所有系统运行正常
              </div>
            ) : (
              recentTests.filter(t => t.status === 'failed').map(test => (
                <div key={test.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(255, 59, 48, 0.08)', padding: '12px 16px', borderRadius: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CloseCircleFilled style={{ color: '#FF3B30', fontSize: 18 }} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#333' }}>{test.name}</div>
                      <div style={{ fontSize: 12, color: '#FF3B30' }}>耗时 {test.duration} · {test.time}</div>
                    </div>
                  </div>
                  <Button size="small" danger ghost>重试</Button>
                </div>
              ))
            )}
          </div>
        </BentoCard>

        {/* 6. Recent Tests List - Vertical Full Height */}
        <div style={{ gridColumn: 'span 2', gridRow: 'span 2' }} className="panel">
          <div className="panel-header">
            <Text strong style={{ fontSize: 16 }}>最近动态</Text>
            <Button type="link" size="small" icon={<ArrowRightOutlined />}>全部</Button>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {recentTests.map((item, index) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 24px',
                borderBottom: index < recentTests.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                transition: 'background 0.2s'
              }} className="hover-bg">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: item.status === 'success' ? 'rgba(52, 199, 89, 0.15)' : item.status === 'failed' ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255, 149, 0, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {item.status === 'success' ? <CheckCircleFilled style={{ color: '#34C759' }} /> :
                      item.status === 'failed' ? <CloseCircleFilled style={{ color: '#FF3B30' }} /> :
                        <ClockCircleOutlined style={{ color: '#FF9500' }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1d1d1f' }}>{item.name}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.user} · {item.time}</Text>
                  </div>
                </div>
                <Tag style={{ border: 'none', background: 'transparent', color: '#86868b' }}>
                  {item.duration}
                </Tag>
              </div>
            ))}
          </div>
        </div>

        {/* 7. AI Insights - Vertical Full Height (Span 2) */}
        <BentoCard style={{ gridColumn: 'span 2', gridRow: 'span 2', background: 'linear-gradient(135deg, #F9F9FB 0%, #FFFFFF 100%)' }} title={
          <Space>
            <span style={{ background: 'linear-gradient(90deg, #FF2E63, #007AFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>AI 智能洞察</span>
            <Tag color="purple" style={{ border: 'none', borderRadius: 999 }}>Beta</Tag>
          </Space>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Insight 1 */}
            <div style={{ background: 'rgba(0, 122, 255, 0.04)', padding: 16, borderRadius: 12, border: '1px solid rgba(0, 122, 255, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ThunderboltFilled style={{ color: '#007AFF' }} />
                <Text strong>性能异常检测</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                检测到 <Text code>订单创建接口</Text> 响应时间在过去 1 小时内波动较大（平均 +150ms）。建议检查数据库死锁或索引命中情况。
              </Text>
            </div>

            {/* Insight 2 */}
            <div style={{ background: 'rgba(52, 199, 89, 0.04)', padding: 16, borderRadius: 12, border: '1px solid rgba(52, 199, 89, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CheckCircleFilled style={{ color: '#34C759' }} />
                <Text strong>测试覆盖率分析</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                <Text code>支付模块</Text> 的边界值测试覆盖率较低（仅 45%）。AI 已为您生成 3 个推荐的边界测试用例，点击即可应用。
              </Text>
              <Button type="link" size="small" style={{ padding: '8px 0 0 0', height: 'auto' }}>
                查看推荐用例 <ArrowRightOutlined />
              </Button>
            </div>

            {/* Daily Summary */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>今日运行摘要</Text>
              <div style={{ display: 'flex', gap: 8 }}>
                <Tag style={{ padding: '4px 12px', borderRadius: 8, background: '#F2F2F7', border: 'none' }}>🛡️ 安全扫描通过</Tag>
                <Tag style={{ padding: '4px 12px', borderRadius: 8, background: '#F2F2F7', border: 'none' }}>⚡ API 性能从优</Tag>
              </div>
            </div>

          </div>
        </BentoCard>
      </div>
    </div>
  );
};

export default Dashboard;
