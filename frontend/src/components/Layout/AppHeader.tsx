import React from 'react';
import { Layout, Typography, Space, Avatar, Dropdown, Button, Badge, Tag, Input } from 'antd';
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
      className="glass-header"
      style={{
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
        boxShadow: 'none',
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
          <ThunderboltOutlined style={{ fontSize: '22px', color: '#0071e3' }} />
          <Text strong style={{ fontSize: '17px', color: '#0b0f1a' }}>
            卷心菜
          </Text>
        </Space>
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
