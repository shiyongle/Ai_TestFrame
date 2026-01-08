import React from 'react';
import { Layout, Typography, Space, Avatar, Dropdown, Button, Badge, Tag } from 'antd';
import {
  BugOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  MenuOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Header } = Layout;
const { Text } = Typography;

interface AppHeaderProps {
  onMobileMenuClick?: () => void;
  isMobile?: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onMobileMenuClick, isMobile = false }) => {
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '账户设置',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  return (
    <Header
      style={{
        padding: '0 24px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.85))',
        borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 999,
        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Space align="center" size="middle">
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={onMobileMenuClick}
            style={{
              fontSize: '18px',
              width: 44,
              height: 44,
            }}
          />
        )}
        <Space size="small" align="center">
          <ThunderboltOutlined style={{ fontSize: '22px', color: '#2b8df7' }} />
          <Text strong style={{ fontSize: '18px', color: '#0f172a' }}>
            投石问路-智能化测试平台
          </Text>
          <Tag color="blue" style={{ marginLeft: 6, borderRadius: 999, border: 'none' }}>
            Copilot Ready
          </Tag>
        </Space>
        {!isMobile && (
          <div className="metric-pill">
            <BugOutlined />
            实时监控
          </div>
        )}
      </Space>

      <Space size="middle">
        <Badge dot>
          <Button type="text" icon={<BellOutlined />} style={{ fontSize: '16px' }} />
        </Badge>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} />
            {!isMobile && <Text>管理员</Text>}
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default AppHeader;
