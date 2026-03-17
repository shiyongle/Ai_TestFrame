import React from 'react';
import { Layout, Typography, Space, Avatar, Dropdown, Button, Badge, Tag, Input } from 'antd';
import {
  BugOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  HourglassOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { taskCenter } from '../../services/taskCenter';
import CabbageIcon from '../common/CabbageIcon';

const { Header } = Layout;
const { Text } = Typography;

interface AppHeaderProps {
  onMobileMenuClick?: () => void;
  isMobile?: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onMobileMenuClick, isMobile = false }) => {
  const navigate = useNavigate();
  const [runningTaskCount, setRunningTaskCount] = React.useState(0);

  React.useEffect(() => {
    const syncCount = () => setRunningTaskCount(taskCenter.getRunningCount());
    syncCount();
    const unsubscribe = taskCenter.subscribe(syncCount);
    return unsubscribe;
  }, []);

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
          <CabbageIcon size={22} />
          <Text strong style={{ fontSize: '17px', color: '#0b0f1a' }}>
            卷心菜
          </Text>
        </Space>
      </Space>

      <Space size="middle">
        <Badge dot>
          <Button type="text" icon={<BellOutlined />} style={{ fontSize: '16px' }} />
        </Badge>
        <Badge count={runningTaskCount} size="small" overflowCount={99}>
          <Button
            type="text"
            icon={<HourglassOutlined />}
            style={{ fontSize: '16px' }}
            onClick={() => navigate('/tasks')}
          />
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
