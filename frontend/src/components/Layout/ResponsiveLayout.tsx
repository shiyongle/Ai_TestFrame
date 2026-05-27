import React, { useState, useEffect } from 'react';
import { Layout, Menu, Drawer, Space, Tag } from 'antd';
import type { MenuProps } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  ProjectOutlined,
  BugOutlined,
  ApiOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  SettingOutlined,
  ToolOutlined,
  IdcardOutlined,
  MobileOutlined,
  FileTextOutlined,
  CodeOutlined,
  RocketOutlined,
  FileSearchOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  FunctionOutlined,
  HddOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  ScheduleOutlined,
  FolderOpenOutlined,
  ExperimentOutlined,
  IssuesCloseOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import CabbageIcon from '../common/CabbageIcon';

const { Sider } = Layout;

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  mobileMenuVisible?: boolean;
  onMobileMenuVisibleChange?: (visible: boolean) => void;
}

const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  mobileMenuVisible,
  onMobileMenuVisibleChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [internalMobileVisible, setInternalMobileVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isControlled = typeof mobileMenuVisible === 'boolean';
  const mobileVisible = isControlled ? mobileMenuVisible : internalMobileVisible;
  const setMobileVisible = (visible: boolean) => {
    if (!isControlled) {
      setInternalMobileVisible(visible);
    }
    onMobileMenuVisibleChange?.(visible);
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
        setMobileVisible(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setMobileVisible]);

  const currentPath = location.pathname === '/' ? '/dashboard' : location.pathname;

  const menuItems: MenuProps['items'] = [
    {
      type: 'group' as const,
      label: '概览',
      children: [
        {
          key: '/dashboard',
          icon: <DashboardOutlined />,
          label: '仪表盘',
        },
      ],
    },
    {
      type: 'group' as const,
      label: '项目与协作',
      children: [
        {
          key: '/projects',
          icon: <ProjectOutlined />,
          label: '项目列表',
        },
        {
          key: '/requirements',
          icon: <FileSearchOutlined />,
          label: '需求管理',
        },
        {
          key: '/versions',
          icon: <HistoryOutlined />,
          label: '版本追踪',
        },
      ],
    },
    {
      type: 'group' as const,
      label: '测试资产',
      children: [
        {
          key: 'testcases',
          icon: <AppstoreOutlined />,
          label: '测试用例管理',
          children: [
            {
              key: '/testcases/plans',
              icon: <ScheduleOutlined />,
              label: '测试计划',
            },
            {
              key: '/testcases/suites',
              icon: <FolderOpenOutlined />,
              label: '测试用例集',
            },
            {
              key: '/testcases/functional',
              icon: <FileTextOutlined />,
              label: '功能测试',
            },
            {
              key: '/testcases/interface',
              icon: <ApiOutlined />,
              label: '接口测试',
            },
          ],
        },
      ],
    },
    {
      type: 'group' as const,
      label: '测试执行',
      children: [
        {
          key: 'test',
          icon: <BugOutlined />,
          label: '接口调试',
          children: [
            {
              key: '/test/http',
              icon: <ApiOutlined />,
              label: 'HTTP 测试',
            },
            {
              key: '/test/tcp',
              icon: <ApiOutlined />,
              label: 'TCP 测试',
            },
            {
              key: '/test/mq',
              icon: <ApiOutlined />,
              label: 'MQ 测试',
            },
          ],
        },
        {
          key: '/test/performance',
          icon: <ThunderboltOutlined />,
          label: '性能测试',
        },
        {
          key: 'agent-eval',
          icon: <ExperimentOutlined />,
          label: 'Agent 评测',
          children: [
            {
              key: '/agent-evaluation',
              icon: <ExperimentOutlined />,
              label: '评测执行',
            },
            {
              key: '/agent-evaluation/golden-datasets',
              icon: <DatabaseOutlined />,
              label: '黄金测试集',
            },
            {
              key: '/agent-evaluation/badcases',
              icon: <ExperimentOutlined />,
              label: '被测Agent管理',
            },
            {
              key: '/agent-evaluation/templates',
              icon: <FileTextOutlined />,
              label: '评测模板',
            },
            {
              key: '/agent-evaluation/model-configs',
              icon: <SettingOutlined />,
              label: '模型配置',
            },
          ],
        },
        {
          key: '/automation',
          icon: <RocketOutlined />,
          label: '自动化执行',
          children: [
            {
              key: '/api-automation',
              icon: <ApiOutlined />,
              label: '接口自动化',
            },
            {
              key: '/api-advanced',
              icon: <ApiOutlined />,
              label: '高级接口测试',
            },
            {
              key: '/ui-automation',
              icon: <PlayCircleOutlined />,
              label: 'UI 自动化',
            },
          ],
        },
      ],
    },
    {
      type: 'group' as const,
      label: '数据与报告',
      children: [
        {
          key: '/reports',
          icon: <BarChartOutlined />,
          label: '测试质量报告',
        },
        {
          key: '/traceability',
          icon: <FileSearchOutlined />,
          label: '质量追踪矩阵',
        },
        {
          key: '/impact-analysis',
          icon: <ThunderboltOutlined />,
          label: '需求影响分析',
        },
        {
          key: '/defects',
          icon: <IssuesCloseOutlined />,
          label: '缺陷管理',
        },
      ],
    },
    {
      type: 'group' as const,
      label: '引擎与辅助',
      children: [
        {
          key: 'data-warehouse',
          icon: <DatabaseOutlined />,
          label: '数据引擎',
          children: [
            {
              key: '/data-warehouse/functions',
              icon: <FunctionOutlined />,
              label: '模板内置函数',
            },
            {
              key: '/data-warehouse/business',
              icon: <HddOutlined />,
              label: '业务依赖数据',
            },
          ],
        },
        {
          key: 'tools',
          icon: <ToolOutlined />,
          label: '测试工具箱',
          children: [
            {
              key: '/tools/id-generator',
              icon: <IdcardOutlined />,
              label: '身份证生成',
            },
            {
              key: '/tools/phone-generator',
              icon: <MobileOutlined />,
              label: '手机号生成',
            },
            {
              key: '/tools/json-formatter',
              icon: <CodeOutlined />,
              label: 'JSON 格式化',
            },
            {
              key: '/tools/aes-crypto',
              icon: <SafetyCertificateOutlined />,
              label: 'AES 加解密',
            },
          ],
        },
      ],
    },
    {
      type: 'group' as const,
      label: '系统与治理',
      children: [
        {
          key: 'settings',
          icon: <SettingOutlined />,
          label: '平台设置',
          children: [
            {
              key: '/ai/knowledge',
              icon: <DatabaseOutlined />,
              label: '系统知识引擎',
            },
            {
              key: '/rule-config',
              icon: <SafetyCertificateOutlined />,
              label: '全局测试规则',
            },
            {
              key: '/settings',
              icon: <SettingOutlined />,
              label: '平台配置中心',
            },
          ],
        },
        {
          key: '/operation-logs',
          icon: <ClockCircleOutlined />,
          label: '操作审计日志',
        },
        {
          key: '/test-assets/audit',
          icon: <SafetyCertificateOutlined />,
          label: '测试资产审计',
        },
        {
          key: '/environments',
          icon: <CloudServerOutlined />,
          label: '环境变量管理',
        },
      ],
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    if (isMobile) {
      setMobileVisible(false);
    }
  };

  const getSelectedKeys = () => {
    if (currentPath.startsWith('/test')) {
      return [currentPath];
    }
    return [currentPath];
  };

  const getOpenKeys = () => {
    const openKeys: string[] = [];
    if (currentPath.startsWith('/test') && !currentPath.startsWith('/testcases')) {
      openKeys.push('test');
    }
    if (currentPath.startsWith('/tools')) {
      openKeys.push('tools');
    }
    if (currentPath.startsWith('/testcases')) {
      openKeys.push('testcases');
    }
    if (currentPath.startsWith('/agent-evaluation')) {
      openKeys.push('agent-eval');
    }
    if (currentPath.startsWith('/api-automation') || currentPath.startsWith('/api-advanced') || currentPath.startsWith('/ui-automation')) {
      openKeys.push('automation');
    }
    if (currentPath.startsWith('/requirements') || currentPath.startsWith('/projects')) {
      openKeys.push('projects');
    }
    if (currentPath.startsWith('/ai/knowledge') || currentPath.startsWith('/rule-config') || currentPath.startsWith('/settings')) {
      openKeys.push('settings');
    }
    if (currentPath.startsWith('/data-warehouse')) {
      openKeys.push('data-warehouse');
    }
    // 默认展开工具箱菜单
    if (openKeys.length === 0) {
      openKeys.push('tools');
    }
    return openKeys;
  };

  const siderContent = (
    <>
      <div
        className="logo sidebar-brand"
        style={{
          height: '72px',
          margin: '16px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          color: 'inherit',
          fontWeight: 600,
          fontSize: collapsed ? '16px' : '18px',
          transition: 'all 0.2s',
          padding: collapsed ? '0 14px' : '0 18px',
        }}
      >
        <Space size={collapsed ? 8 : 14} style={{ overflow: 'hidden' }}>
          <CabbageIcon size={22} />
          {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>投石问路</span>}
        </Space>
        {!isMobile && (
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{
              cursor: 'pointer',
              color: '#8c8c8c',
              fontSize: '16px',
              display: collapsed ? 'none' : 'block'
            }}
          >
            <MenuFoldOutlined className="hover-scale" />
          </div>
        )}
      </div>
      {/* 补充折叠状态下点击展开的悬浮按钮 */}
      {collapsed && !isMobile && (
        <div
          onClick={() => setCollapsed(false)}
          style={{
            cursor: 'pointer',
            textAlign: 'center',
            marginBottom: '10px',
            color: '#8c8c8c',
            display: 'block'
          }}
        >
          <MenuUnfoldOutlined className="hover-scale" style={{ fontSize: 16 }} />
        </div>
      )}
      <Menu
        theme="light"
        mode="inline"
        selectedKeys={getSelectedKeys()}
        defaultOpenKeys={getOpenKeys()}
        items={menuItems}
        onClick={handleMenuClick}
        className="source-menu"
        style={{
          borderRight: 0,
          background: 'transparent',
          padding: '0 10px 12px',
        }}
      />
    </>
  );

  if (isMobile) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Drawer
          title={
            <div style={{ color: '#0b0f1a', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '8px', display: 'inline-flex' }}>
                <CabbageIcon size={20} />
              </span>
              投石问路-智能化测试平台
            </div>
          }
          placement="left"
          onClose={() => setMobileVisible(false)}
          open={mobileVisible}
          bodyStyle={{ padding: 0, background: 'rgba(255, 255, 255, 0.96)' }}
          headerStyle={{ background: 'rgba(255, 255, 255, 0.96)', border: 'none' }}
          width={280}
        >
          {siderContent}
        </Drawer>
        <Layout>{children}</Layout>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={260}
        collapsedWidth={80}
        className="glass-panel"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
          borderRight: '1px solid rgba(0,0,0,0.05)',
        }}
        theme="light"
      >
        {siderContent}
      </Sider>
      <Layout style={{
        marginLeft: collapsed ? 80 : 260,
        transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
        background: 'transparent'
      }}>
        {children}
      </Layout>
    </Layout>
  );
};

export default ResponsiveLayout;
