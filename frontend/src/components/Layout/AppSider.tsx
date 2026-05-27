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
  RobotOutlined,
  FileTextOutlined,
  AlertOutlined,
  ControlOutlined,
  IssuesCloseOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  CloudServerOutlined,
  AppstoreOutlined,
  ScheduleOutlined,
  FolderOpenOutlined,
  DatabaseOutlined,
  FunctionOutlined,
  HddOutlined,
  PlayCircleOutlined,
  CodeOutlined,
  RocketOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const AppSider: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/projects', icon: <ProjectOutlined />, label: '项目列表' },
    { key: '/requirements', icon: <FileSearchOutlined />, label: '需求管理' },
    { key: '/versions', icon: <HistoryOutlined />, label: '版本追踪' },
    {
      key: 'testcases',
      icon: <AppstoreOutlined />,
      label: '用例与计划',
      children: [
        { key: '/testcases/plans', icon: <ScheduleOutlined />, label: '测试计划' },
        { key: '/testcases/suites', icon: <FolderOpenOutlined />, label: '测试用例集' },
        { key: '/testcases/functional', icon: <FileTextOutlined />, label: '功能测试用例' },
        { key: '/testcases/interface', icon: <ApiOutlined />, label: '接口测试用例' },
      ],
    },
    {
      key: '/automation',
      icon: <RocketOutlined />,
      label: '自动化执行',
      children: [
        { key: '/api-automation', icon: <ApiOutlined />, label: '接口自动化' },
        { key: '/ui-automation', icon: <PlayCircleOutlined />, label: 'UI 自动化' },
      ],
    },
    {
      key: 'test',
      icon: <BugOutlined />,
      label: '接口调试',
      children: [
        { key: '/test/http', icon: <ApiOutlined />, label: 'HTTP 测试' },
        { key: '/test/tcp', icon: <ApiOutlined />, label: 'TCP 测试' },
        { key: '/test/mq', icon: <ApiOutlined />, label: 'MQ 测试' },
      ],
    },
    { key: '/test/performance', icon: <ThunderboltOutlined />, label: '性能测试' },
    {
      key: 'agent-eval',
      icon: <RobotOutlined />,
      label: 'AI 与智能评测',
      children: [
        { key: '/ai-quality', icon: <SafetyCertificateOutlined />, label: 'AI 质量治理' },
        { key: '/agent-evaluation', icon: <ApiOutlined />, label: '评测执行' },
        { key: '/agent-evaluation/golden-datasets', icon: <DatabaseOutlined />, label: '黄金测试集' },
        { key: '/agent-evaluation/badcases', icon: <AlertOutlined />, label: '被测Agent管理' },
        { key: '/agent-evaluation/templates', icon: <FileTextOutlined />, label: '评测模板' },
        { key: '/agent-evaluation/model-configs', icon: <ControlOutlined />, label: '模型配置' },
        { key: '/ai/knowledge', icon: <DatabaseOutlined />, label: 'AI 知识库' },
      ],
    },
    { key: '/traceability', icon: <FileSearchOutlined />, label: '需求-用例矩阵' },
    { key: '/impact-analysis', icon: <ThunderboltOutlined />, label: '变更影响分析' },
    { key: '/defects', icon: <IssuesCloseOutlined />, label: '缺陷管理' },
    { key: '/reports', icon: <BarChartOutlined />, label: '测试质量报告' },
    { key: '/test-assets/audit', icon: <SafetyCertificateOutlined />, label: '测试资产审计' },
    { key: '/environments', icon: <CloudServerOutlined />, label: '环境变量管理' },
    {
      key: 'data-warehouse',
      icon: <DatabaseOutlined />,
      label: '数据引擎',
      children: [
        { key: '/data-warehouse/functions', icon: <FunctionOutlined />, label: '模板内置函数' },
        { key: '/data-warehouse/business', icon: <HddOutlined />, label: '业务依赖数据' },
      ],
    },
    {
      key: 'tools',
      icon: <ToolOutlined />,
      label: '测试工具箱',
      children: [
        { key: '/tools/id-generator', icon: <IdcardOutlined />, label: '身份证生成' },
        { key: '/tools/phone-generator', icon: <MobileOutlined />, label: '手机号生成' },
        { key: '/tools/json-formatter', icon: <CodeOutlined />, label: 'JSON 格式化' },
        { key: '/tools/aes-crypto', icon: <SafetyCertificateOutlined />, label: 'AES 加解密' },
      ],
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '平台设置',
      children: [
        { key: '/rule-config', icon: <SettingOutlined />, label: '全局测试规则' },
        { key: '/settings', icon: <SettingOutlined />, label: '平台配置中心' },
        { key: '/enterprise-governance', icon: <SafetyCertificateOutlined />, label: '权限与企业治理' },
        { key: '/operation-logs', icon: <HistoryOutlined />, label: '操作审计日志' },
      ],
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const getSelectedKeys = () => {
    return [location.pathname];
  };

  const getOpenKeys = () => {
    const openKeys: string[] = [];
    if (location.pathname.startsWith('/testcases')) {
      openKeys.push('testcases');
    }
    if (location.pathname.startsWith('/api-automation') || location.pathname.startsWith('/ui-automation')) {
      openKeys.push('/automation');
    }
    if (location.pathname.startsWith('/test') && !location.pathname.startsWith('/testcases')) {
      openKeys.push('test');
    }
    if (location.pathname.startsWith('/tools')) {
      openKeys.push('tools');
    }
    if (
      location.pathname.startsWith('/agent-evaluation')
      || location.pathname.startsWith('/ai-quality')
      || location.pathname.startsWith('/ai/knowledge')
    ) {
      openKeys.push('agent-eval');
    }
    if (location.pathname.startsWith('/data-warehouse')) {
      openKeys.push('data-warehouse');
    }
    if (
      location.pathname.startsWith('/rule-config')
      || location.pathname.startsWith('/settings')
      || location.pathname.startsWith('/enterprise-governance')
      || location.pathname.startsWith('/operation-logs')
    ) {
      openKeys.push('settings');
    }
    return openKeys;
  };

  const [openKeys, setOpenKeys] = useState<string[]>(getOpenKeys());

  React.useEffect(() => {
    const newOpenKeys = getOpenKeys();
    setOpenKeys(newOpenKeys);
  }, [location.pathname]);

  const handleOpenChange = (keys: string[]) => {
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
