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
  HistoryOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  IdcardOutlined,
  MobileOutlined,
  FileTextOutlined,
  CodeOutlined,
  RocketOutlined,
  FileSearchOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';

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
      label: '项目与需求',
      children: [
        {
          key: 'projects',
          icon: <ProjectOutlined />,
          label: '项目管理',
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
          ],
        },
        {
          key: '/versions',
          icon: <HistoryOutlined />,
          label: '版本管理',
        },
        {
          key: 'testcases',
          icon: <FileTextOutlined />,
          label: '测试用例',
          children: [
            {
              key: '/testcases/functional',
              icon: <FileTextOutlined />,
              label: '功能测试用例',
            },
            {
              key: '/testcases/interface',
              icon: <CodeOutlined />,
              label: '接口测试用例',
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
          label: '接口测试',
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
          key: '/automation',
          icon: <RocketOutlined />,
          label: '自动化测试',
          children: [
            {
              key: '/api-automation',
              icon: <ApiOutlined />,
              label: '接口自动化',
            },
          ],
        },
        {
          key: '/reports',
          icon: <BarChartOutlined />,
          label: '测试报告',
        },
      ],
    },
    {
      type: 'group' as const,
      label: '工具',
      children: [
        {
          key: 'tools',
          icon: <ToolOutlined />,
          label: '工具箱',
          children: [
            {
              key: '/tools/id-generator',
              icon: <IdcardOutlined />,
              label: '身份证号码',
            },
            {
              key: '/tools/phone-generator',
              icon: <MobileOutlined />,
              label: '手机号码',
            },
          ],
        },
      ],
    },
    {
      type: 'group' as const,
      label: '系统',
      children: [
        {
          key: 'settings',
          icon: <SettingOutlined />,
          label: '系统设置',
          children: [
            {
              key: '/rule-config',
              icon: <SettingOutlined />,
              label: '规则配置',
            },
            {
              key: '/ai/knowledge',
              icon: <DatabaseOutlined />,
              label: 'RAG 知识库',
            },
          ],
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
    if (currentPath.startsWith('/test')) {
      openKeys.push('test');
    }
    if (currentPath.startsWith('/tools')) {
      openKeys.push('tools');
    }
    if (currentPath.startsWith('/testcases')) {
      openKeys.push('testcases');
    }
    if (currentPath.startsWith('/api-automation')) {
      openKeys.push('automation');
    }
    if (currentPath.startsWith('/requirements')) {
      openKeys.push('projects');
    }
    if (currentPath.startsWith('/ai/knowledge')) {
      openKeys.push('settings');
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
        <Space size={collapsed ? 8 : 14}>
          <ThunderboltOutlined style={{ fontSize: '22px', color: '#0071e3' }} />
          {!collapsed && <span>投石问路</span>}
        </Space>
        {!collapsed && (
          <Tag
            color="default"
            className="brand-badge"
            style={{
              margin: 0,
              borderRadius: 999,
              border: 'none',
              background: 'rgba(0, 113, 227, 0.1)',
              color: '#0071e3',
              fontWeight: 600,
            }}
          >
            AI Copilot
          </Tag>
        )}
      </div>
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
              <ThunderboltOutlined style={{ marginRight: '8px', fontSize: '20px', color: '#0071e3' }} />
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
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        collapsedWidth={80}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          boxShadow: '2px 0 20px rgba(0,0,0,0.2)',
          zIndex: 1000,
          paddingTop: 6,
        }}
        theme="light"
      >
        {siderContent}
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        {children}
      </Layout>
    </Layout>
  );
};

export default ResponsiveLayout;
