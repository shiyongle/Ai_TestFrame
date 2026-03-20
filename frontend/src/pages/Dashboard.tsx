import React, { useState, useEffect, useRef } from 'react';
import { Avatar, Tag, Button, Typography, Space, Tooltip, Input } from 'antd';
import {
  ProjectOutlined,
  BugOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ThunderboltFilled,
  PlusOutlined,
  MoreOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
  FileSearchOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  SettingOutlined,
  ApiOutlined,
  RocketOutlined,
  ScheduleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { agentApi, dashboardApi } from '../services/api';
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

const quickEntries = [
  {
    title: '需求管理',
    desc: '管理需求池与评审状态',
    path: '/requirements',
    icon: <FileSearchOutlined />,
    tag: '高频',
    color: 'linear-gradient(135deg, rgba(0,122,255,0.14) 0%, rgba(88,86,214,0.12) 100%)',
  },
  {
    title: '数据仓库',
    desc: '常用函数与业务样本管理',
    path: '/data-warehouse/functions',
    icon: <DatabaseOutlined />,
    tag: '推荐',
    color: 'linear-gradient(135deg, rgba(52,199,89,0.16) 0%, rgba(50,173,230,0.10) 100%)',
  },
  {
    title: '版本管理',
    desc: '追踪版本周期与发布节点',
    path: '/versions',
    icon: <HistoryOutlined />,
    tag: '核心',
    color: 'linear-gradient(135deg, rgba(255,149,0,0.18) 0%, rgba(255,94,58,0.12) 100%)',
  },
  {
    title: '系统设置',
    desc: '全局配置与模型参数',
    path: '/settings',
    icon: <SettingOutlined />,
    tag: '配置',
    color: 'linear-gradient(135deg, rgba(88,86,214,0.16) 0%, rgba(175,82,222,0.12) 100%)',
  },
  {
    title: '接口自动化',
    desc: '场景编排与定时执行',
    path: '/api-automation',
    icon: <RocketOutlined />,
    tag: '执行',
    color: 'linear-gradient(135deg, rgba(255,59,48,0.16) 0%, rgba(255,149,0,0.12) 100%)',
  },
  {
    title: '测试计划',
    desc: '计划编排与执行追踪',
    path: '/testcases/plans',
    icon: <ScheduleOutlined />,
    tag: '计划',
    color: 'linear-gradient(135deg, rgba(0,199,190,0.16) 0%, rgba(0,122,255,0.12) 100%)',
  },
  {
    title: '接口测试用例',
    desc: '接口用例维护与调试',
    path: '/testcases/interface',
    icon: <ApiOutlined />,
    tag: '用例',
    color: 'linear-gradient(135deg, rgba(90,200,250,0.16) 0%, rgba(0,122,255,0.10) 100%)',
  },
  {
    title: '操作日志',
    desc: '查看全局操作流水',
    path: '/operation-logs',
    icon: <HistoryOutlined />,
    tag: '追踪',
    color: 'linear-gradient(135deg, rgba(142,142,147,0.16) 0%, rgba(72,72,74,0.10) 100%)',
  },
];

const BentoCard = ({ children, style, bodyStyle, className, title, extra }: any) => (
  <div
    className={`panel ${className}`}
    style={{
      height: '100%',
      minHeight: 0,
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
    <div
      className="panel-body"
      style={{
        flex: 1,
        minHeight: 0,
        padding: '20px',
        ...bodyStyle,
      }}
    >
      {children}
    </div>
  </div>
);

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


  // AI Chat State
  const [chatInput, setChatInput] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: '你好，我是你的 AI 测试助手 (OpenClaw)。我可以帮你查询系统统计、执行指定项目测试计划。', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text || agentLoading) return;

    setChatMessages(prev => [...prev, { role: 'user', content: text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setChatInput('');
    setAgentLoading(true);

    try {
      const res = await agentApi.chat({ message: text });
      const reply = res?.reply || '已接收请求，但暂未返回内容。';
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      if (res?.data?.refresh_dashboard) {
        await loadDashboardData();
      }
    } catch (error) {
      console.error('Agent chat failed', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: '执行失败，请稍后重试或换一种表达方式。', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setAgentLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const statsData = await dashboardApi.getStats();
      setStats({
        totalProjects: statsData.total_projects || 0,
        totalTestCases: statsData.total_testcases || 0,
        passedTests: statsData.passed_this_week || 0,
        failedTests: statsData.failed_this_week || 0,
        passRate: statsData.pass_rate || 0,
        totalRunsThisWeek: statsData.total_runs_this_week || 0,
      });
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    }
  };

  const handleCreateProject = () => {
    navigate('/projects?open=create');
  };

  const handleQuickTest = () => {
    navigate('/testcases/plans');
  };

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
        height: 'calc(100vh - 170px)',
        minHeight: 680,
        alignItems: 'stretch'
      }}>
        
        {/* Left Area: Stats */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          minWidth: 0,
          height: '100%'
        }}>
          
          {/* Top Stats Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1.5fr 1fr',
            gap: '24px',
            minHeight: '160px'
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
                    {stats.passRate}%
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

          <div className="panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ padding: '16px 24px' }}>
              <Text strong style={{ fontSize: 16 }}>工作台快捷入口</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>高频功能推荐，点击即达</Text>
            </div>
            <div className="panel-body" style={{ padding: '10px 16px 16px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
                {quickEntries.slice(0, 4).map((item) => (
                  <div
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    style={{
                      borderRadius: 16,
                      border: '1px solid rgba(255,255,255,0.7)',
                      background: item.color,
                      padding: 16,
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(15,23,42,.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      minHeight: 126,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.9)', color: '#1f2d3d', fontSize: 17 }}>
                        {item.icon}
                      </div>
                      <Tag style={{ margin: 0, border: 'none', borderRadius: 10, background: 'rgba(255,255,255,.78)', fontWeight: 600 }}>
                        {item.tag}
                      </Tag>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{item.title}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>
                    </div>
                    <div style={{ marginTop: 'auto', color: '#334155', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      立即进入
                      <ArrowRightOutlined />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                {quickEntries.slice(4).map((item) => (
                  <div
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    style={{
                      borderRadius: 12,
                      border: '1px solid rgba(15,23,42,0.06)',
                      background: 'rgba(255,255,255,0.72)',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.06)', color: '#334155' }}>
                        {item.icon}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.desc}</div>
                      </div>
                    </div>
                    <ArrowRightOutlined style={{ color: '#64748b', fontSize: 12 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Right Area: AI Chat Widget */}
        <BentoCard
          style={{
            width: '400px',
            flexShrink: 0,
            alignSelf: 'stretch',
            minHeight: 0,
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            height: '100%'
          }}
          bodyStyle={{
            padding: 0,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
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
            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: 24,
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
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
                <Input.TextArea
                  value={chatInput}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  onChange={(e) => setChatInput(e.target.value)}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  onPressEnter={(e) => {
                    if (e.shiftKey || isComposing) return;
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  placeholder="让 AI 帮你写测试脚本、分析日志..."
                  variant="borderless"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    fontSize: 15,
                    color: '#1d1d1f',
                    resize: 'none',
                    padding: '8px 0'
                  }}
                />
                <Button 
                  type="primary" 
                  shape="circle" 
                  icon={<SendOutlined />} 
                  size="large"
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || agentLoading}
                  style={{
                    background: chatInput.trim() && !agentLoading ? '#007AFF' : '#d1d1d6',
                    borderColor: 'transparent',
                    boxShadow: chatInput.trim() && !agentLoading ? '0 4px 12px rgba(0,122,255,0.3)' : 'none',
                  }}
                />
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {['系统内当前有多少测试用例？', '接口自动化场景有多少，通过率是多少？', '帮我执行支付项目的2个测试计划'].map(suggestion => (
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

    </div>
  );
};

export default Dashboard;
