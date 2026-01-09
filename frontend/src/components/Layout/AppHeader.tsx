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
      style={{
        padding: '0 20px',
        background: 'rgba(255, 255, 255, 0.82)',
        borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 999,
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
        backdropFilter: 'blur(14px)',
        height: 64,
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
            投石问路
          </Text>
          <Tag color="blue" style={{ marginLeft: 6, borderRadius: 999, border: 'none' }}>
            Copilot Ready
          </Tag>
        </Space>
      </Space>

      <Space size="middle">
        {!isMobile && (
          <Input.Search
            placeholder="搜索项目 / 需求 / 用例"
            style={{ width: 260 }}
            size="middle"
          />
        )}
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
