import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
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
} from '@ant-design/icons';

const { Sider } = Layout;

const AppSider: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  console.log('AppSider rendered, collapsed:', collapsed);

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/projects',
      icon: <ProjectOutlined />,
      label: '项目管理',
    },
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
    {
      key: 'test',
      icon: <BugOutlined />,
      label: '接口测试',
      children: [
        {
          key: '/test/http',
          icon: <ApiOutlined />,
          label: 'HTTP测试',
        },
        {
          key: '/test/tcp',
          icon: <ApiOutlined />,
          label: 'TCP测试',
        },
        {
          key: '/test/mq',
          icon: <ApiOutlined />,
          label: 'MQ测试',
        },
      ],
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: '测试报告',
    },
    {
      key: '/versions',
      icon: <HistoryOutlined />,
      label: '版本管理',
    },
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
      ],
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    console.log('Menu clicked:', key);
    console.log('Current openKeys:', openKeys);
    navigate(key);
  };

  const getSelectedKeys = () => {
    return [location.pathname];
  };

  const getOpenKeys = () => {
    const openKeys: string[] = [];
    if (location.pathname.startsWith('/test')) {
      openKeys.push('test');
    }
    if (location.pathname.startsWith('/tools')) {
      openKeys.push('tools');
    }
    if (location.pathname.startsWith('/rule-config')) {
      openKeys.push('settings');
    }
    return openKeys;
  };

  const [openKeys, setOpenKeys] = useState<string[]>(['test', 'tools', 'settings']); // 默认展开工具箱、接口测试和系统设置

  // 监听路由变化，动态更新菜单展开状态
  React.useEffect(() => {
    const newOpenKeys = getOpenKeys();
    console.log('Route changed to:', location.pathname, 'Setting openKeys to:', newOpenKeys);
    // 确保工具箱菜单始终可见
    if (!newOpenKeys.includes('tools')) {
      newOpenKeys.push('tools');
    }
    setOpenKeys(newOpenKeys);
  }, [location.pathname]);

  // 处理菜单展开/收起
  const handleOpenChange = (keys: string[]) => {
    console.log('Menu openChange:', keys);
    // 确保工具箱菜单始终可以展开
    setOpenKeys(keys);
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={240}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
      }}
      theme="dark"
    >
      <div 
        className="logo" 
        style={{
          height: '64px',
          margin: '16px',
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: collapsed ? '16px' : '18px',
          transition: 'all 0.2s',
          backdropFilter: 'blur(10px)',
        }}
      >
        <ThunderboltOutlined style={{ marginRight: collapsed ? '0' : '8px', fontSize: '20px' }} />
        {!collapsed && '投石问路'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={getSelectedKeys()}
        openKeys={openKeys}
        onOpenChange={handleOpenChange}
        items={menuItems}
        onClick={handleMenuClick}
        style={{
          borderRight: 0,
          background: 'transparent',
        }}
      />
    </Sider>
  );
};

export default AppSider;