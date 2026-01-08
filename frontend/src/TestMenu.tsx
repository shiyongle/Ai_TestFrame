import React from 'react';
import {
  DashboardOutlined,
  ProjectOutlined,
  BugOutlined,
  ApiOutlined,
  BarChartOutlined,
  HistoryOutlined,
  SettingOutlined,
  ToolOutlined,
  IdcardOutlined,
  MobileOutlined,
} from '@ant-design/icons';

// 测试菜单配置
const testMenuItems = [
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
    key: '/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
  },
];

const TestMenu: React.FC = () => {
  console.log('Menu items:', testMenuItems);
  
  return (
    <div style={{ padding: 24 }}>
      <h2>菜单测试</h2>
      <p>检查控制台输出以确认菜单项配置</p>
      <pre>{JSON.stringify(testMenuItems, null, 2)}</pre>
    </div>
  );
};

export default TestMenu;