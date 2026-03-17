import React, { useState, useEffect, useRef } from 'react';
import { Avatar, Tag, Button, Typography, Space, Tooltip, Modal, List, Badge } from 'antd';
import {
  ProjectOutlined,
  BugOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleOutlined,
  ThunderboltFilled,
  ArrowRightOutlined,
  PlusOutlined,
  MoreOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { dashboardApi } from '../services/api';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

// Greeting logic based on current hour
const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '早安';
  if (hour >= 12 && hour < 18) return '下午好';
  return '晚上好';
};

// Current user (from localStorage or default)
const getCurrentUser = (): string => {
  return localStorage.getItem('username') || '管理员';
};

// Map action to icon & color
const ACTION_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  create:   { icon: <PlusOutlined />,       color: 'rgba(52,199,89,0.15)',  label: '新建' },
  update:   { icon: <EditOutlined />,       color: 'rgba(0,122,255,0.12)', label: '修改' },
  delete:   { icon: <DeleteOutlined />,     color: 'rgba(255,59,48,0.12)', label: '删除' },
  execute:  { icon: <PlayCircleOutlined />, color: 'rgba(255,149,0,0.12)', label: '执行' },
  generate: { icon: <RobotOutlined />,      color: 'rgba(88,86,214,0.12)', label: 'AI生成' },
  default:  { icon: <FormOutlined />,       color: 'rgba(0,0,0,0.05)',     label: '操作' },
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalTestCases: 0,
    passedTests: 0,
    failedTests: 0,
    passRate: 0,
    totalRunsThisWeek: 0,
  });

  const [activities, setActivities] = useState<any[]>([]);
  const [allActivities, setAllActivities] = useState<any[]>([]);
  const [viewAllVisible, setViewAllVisible] = useState(false);
  const [allLoading, setAllLoading] = useState(false);

  // AI Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: '你好，我是你的 AI 测试助手 (OpenClaw)。你可以让我帮忙查询测试数据、编排回归策略，或是分析报错日志。今天需要我做些什么？', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const newMessages = [...chatMessages, { role: 'user', content: chatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
    setChatMessages(newMessages);
    setChatInput('');
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '这个功能正在接入 OpenClaw 智能体中。敬请期待！', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }, 1000);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsData, activitiesData] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getActivities({ limit: 8 }),
      ]);
      setStats({
        totalProjects: statsData.total_projects || 0,
        totalTestCases: statsData.total_testcases || 0,
        passedTests: statsData.passed_this_week || 0,
        failedTests: statsData.failed_this_week || 0,
        passRate: statsData.pass_rate || 0,
        totalRunsThisWeek: statsData.total_runs_this_week || 0,
      });
      setActivities(activitiesData.items || []);
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    }
  };

  const handleViewAll = async () => {
    setViewAllVisible(true);
    setAllLoading(true);
    try {
      const data = await dashboardApi.getActivities({ limit: 100 });
      setAllActivities(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setAllLoading(false);
    }
  };

  const handleCreateProject = () => {
    navigate('/projects?open=create');
  };

  const handleQuickTest = () => {
    navigate('/testcases/plans');
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
          <Text type="secondary" style={{ fontSize: 14 }}>{dayjs().format('YYYY年MM月DD日 dddd')}</Text>
          <Title level={2} style={{ margin: '4px 0 0', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {getGreeting()}，{getCurrentUser()}
          </Title>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={handleCreateProject}>新建项目</Button>
          <Button type="primary" icon={<ThunderboltFilled />} onClick={handleQuickTest}>快速测试</Button>
        </Space>
      </div>

      {/* Main Layout Content */}
      <div style={{
        display: 'flex',
        gap: '24px',
        height: 'calc(100vh - 160px)', // Fill viewport minus header and padding
        alignItems: 'stretch'
      }}>
        
        {/* Left Area: Stats & Recent Activity */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          minWidth: 0
        }}>
          
          {/* Top Stats Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1.5fr 1fr',
            gap: '24px',
            height: '160px' // Fixed height for top stats
          }}>
            
            {/* 1. Projects Stats */}
            <BentoCard
              style={{ background: 'linear-gradient(135deg, #007AFF 0%, #00C6FF 100%)', color: 'white' }}
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
                  <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>{stats.totalProjects}</div>
                  <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>活跃项目 <span style={{ marginLeft: 8, background: 'rgba(0,0,0,0.1)', padding: '2px 8px', borderRadius: 10 }}>+3 本周新增</span></div>
                </div>
              </div>
            </BentoCard>

            {/* 2. Success Rate */}
            <BentoCard>
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
                {/* Bar chart placeholder */}
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

            {/* 3. Total Cases */}
            <BentoCard>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <BugOutlined style={{ fontSize: 28, color: '#FF9500', marginBottom: 12 }} />
                <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.totalTestCases}</div>
                <Text type="secondary" style={{ fontSize: 13 }}>总测试用例</Text>
              </div>
            </BentoCard>
          </div>

          {/* Activity Log List */}
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="panel-header" style={{ padding: '16px 24px', flexShrink: 0 }}>
              <Text strong style={{ fontSize: 16 }}>最近动态</Text>
              <Button type="link" size="small" icon={<ArrowRightOutlined />} onClick={handleViewAll}>全部</Button>
            </div>
            <div className="panel-body" style={{ padding: 0, overflowY: 'auto', flex: 1 }}>
              {activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无操作记录</div>
              ) : activities.map((item: any, index: number) => {
                const actionInfo = ACTION_MAP[item.action] || ACTION_MAP.default;
                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 24px',
                    borderBottom: index < activities.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    transition: 'background 0.2s'
                  }} className="hover-bg">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: actionInfo.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, color: '#555'
                      }}>
                        {actionInfo.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1d1d1f', fontSize: 14 }}>
                          {item.user} <Text type="secondary" style={{ fontWeight: 400 }}>{actionInfo.label}了</Text> {item.target_name}
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.module} · {item.created_at ? dayjs(item.created_at).format('MM-DD HH:mm') : ''}
                        </Text>
                      </div>
                    </div>
                    <Tag style={{
                      border: 'none',
                      background: item.status === 'success' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
                      color: item.status === 'success' ? '#34C759' : '#FF3B30',
                      borderRadius: 6
                    }}>
                      {item.status === 'success' ? '成功' : '失败'}
                    </Tag>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Area: AI Chat Widget */}
        <BentoCard 
          style={{ 
            width: '400px', // Fixed width for sidebar
            flexShrink: 0,
            background: 'rgba(255,255,255,0.7)', 
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            padding: 0
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Chat Header */}
            <div style={{ 
              padding: '20px 24px', 
              background: 'linear-gradient(135deg, rgba(0,122,255,0.05) 0%, rgba(88,86,214,0.05) 100%)',
              borderBottom: '1px solid rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar 
                  size={46} 
                  icon={<RobotOutlined />} 
                  style={{ background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)', boxShadow: '0 4px 12px rgba(0,122,255,0.3)' }} 
                />
                <div>
                  <Title level={4} style={{ margin: 0, fontSize: 18, color: '#1d1d1f' }}>OpenClaw AI</Title>
                  <Space size={4} style={{ fontSize: 12, color: '#52c41a' }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: '#52c41a', display: 'inline-block' }} />
                    在线就绪
                  </Space>
                </div>
              </div>
              <Tag color="purple" style={{ borderRadius: 12, padding: '4px 12px', border: 'none' }}>Agent 版</Tag>
            </div>

            {/* Chat Messages Area */}
            <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {chatMessages.map((msg, index) => (
                <div key={index} style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  gap: 12,
                  alignItems: 'flex-start'
                }}>
                  <Avatar 
                    size={36} 
                    icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />} 
                    style={{ 
                      background: msg.role === 'user' ? '#f0f0f0' : 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                      color: msg.role === 'user' ? '#666' : 'white',
                      flexShrink: 0
                    }} 
                  />
                  <div style={{
                    maxWidth: '75%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: msg.role === 'user' ? '#007AFF' : 'rgba(0,0,0,0.03)',
                      color: msg.role === 'user' ? 'white' : '#1d1d1f',
                      boxShadow: msg.role === 'user' ? '0 4px 12px rgba(0,122,255,0.2)' : 'none',
                      fontSize: 14,
                      lineHeight: 1.6
                    }}>
                      {msg.content}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      {msg.time}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(0,0,0,0.05)', background: 'white' }}>
              <div style={{
                display: 'flex',
                background: '#f2f2f7',
                borderRadius: 24,
                padding: '4px 4px 4px 16px',
                alignItems: 'center',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="让 AI 帮你写测试脚本、分析日志..." 
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 15,
                    color: '#1d1d1f'
                  }}
                />
                <Button 
                  type="primary" 
                  shape="circle" 
                  icon={<SendOutlined />} 
                  size="large"
                  onClick={handleSendMessage}
                  style={{ 
                    background: chatInput.trim() ? '#007AFF' : '#d1d1d6', 
                    borderColor: 'transparent',
                    boxShadow: chatInput.trim() ? '0 4px 12px rgba(0,122,255,0.3)' : 'none',
                  }}
                />
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {['分析昨天的失败用例', '统计各项目的测试通过率', '帮我写一段登录接口的自动化'].map(suggestion => (
                  <Tag 
                    key={suggestion} 
                    style={{ 
                      borderRadius: 12, 
                      padding: '4px 12px', 
                      background: 'rgba(0,122,255,0.08)', 
                      color: '#007AFF',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={() => setChatInput(suggestion)}
                  >
                    {suggestion}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* View All Activities Modal */}
      <Modal
        title="全部操作动态"
        open={viewAllVisible}
        onCancel={() => setViewAllVisible(false)}
        footer={null}
        width={700}
      >
        <List
          loading={allLoading}
          dataSource={allActivities}
          renderItem={(item: any, index: number) => {
            const actionInfo = ACTION_MAP[item.action] || ACTION_MAP.default;
            return (
              <List.Item key={item.id} style={{ padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: actionInfo.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#555' }}>
                      {actionInfo.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {item.user} <Text type="secondary" style={{ fontWeight: 400 }}>{actionInfo.label}了</Text> {item.target_name}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.module} · {item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : ''}</Text>
                    </div>
                  </div>
                  <Tag style={{ border: 'none', background: item.status === 'success' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: item.status === 'success' ? '#34C759' : '#FF3B30', borderRadius: 6 }}>
                    {item.status === 'success' ? '成功' : '失败'}
                  </Tag>
                </div>
              </List.Item>
            );
          }}
        />
      </Modal>
    </div>
  );
};

export default Dashboard;
