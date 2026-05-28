import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  BankOutlined,
  CheckOutlined,
  CloudSyncOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { enterpriseGovernanceApi, projectApi, systemApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const parseList = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value;
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const formatTime = (value?: string) => (value ? value.replace('T', ' ').slice(0, 19) : '-');

const EnterpriseGovernance: React.FC = () => {
  const [orgForm] = Form.useForm();
  const [teamForm] = Form.useForm();
  const [roleForm] = Form.useForm();
  const [userRoleForm] = Form.useForm();
  const [projectRoleForm] = Form.useForm();
  const [ssoForm] = Form.useForm();
  const [tokenForm] = Form.useForm();
  const [secretForm] = Form.useForm();
  const [approvalForm] = Form.useForm();
  const [userForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState<any>({});
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [userRoleBindings, setUserRoleBindings] = useState<any[]>([]);
  const [projectRoles, setProjectRoles] = useState<any[]>([]);
  const [ssoProviders, setSsoProviders] = useState<any[]>([]);
  const [apiTokens, setApiTokens] = useState<any[]>([]);
  const [secrets, setSecrets] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [createdToken, setCreatedToken] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const location = useLocation();
  const initialUserId = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('user_id');
    return raw ? Number(raw) : undefined;
  }, [location.search]);

  const userOptions = useMemo(
    () => users.map((item) => ({ label: item.real_name ? `${item.real_name} (${item.username})` : item.username, value: item.id })),
    [users]
  );
  const projectOptions = useMemo(
    () => projects.map((item) => ({ label: item.name, value: item.id })),
    [projects]
  );
  const roleOptions = useMemo(
    () => roles.map((item) => ({ label: `${item.name} (${item.code})`, value: item.id })),
    [roles]
  );
  const userNameMap = useMemo(
    () => new Map(users.map((item) => [item.id, item.real_name ? `${item.real_name} (${item.username})` : item.username])),
    [users]
  );
  const projectNameMap = useMemo(
    () => new Map(projects.map((item) => [item.id, item.name])),
    [projects]
  );
  const roleNameMap = useMemo(
    () => new Map(roles.map((item) => [item.id, `${item.name} (${item.code})`])),
    [roles]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        overviewRes,
        orgRes,
        teamRes,
        roleRes,
        userRoleRes,
        projectRoleRes,
        ssoRes,
        tokenRes,
        secretRes,
        approvalRes,
        auditRes,
        userRes,
        projectRes,
      ] = await Promise.all([
        enterpriseGovernanceApi.getOverview(),
        enterpriseGovernanceApi.listOrganizations(),
        enterpriseGovernanceApi.listTeams(),
        enterpriseGovernanceApi.listRoles(),
        enterpriseGovernanceApi.listUserRoleBindings(initialUserId),
        enterpriseGovernanceApi.listProjectRoles(),
        enterpriseGovernanceApi.listSsoProviders(),
        enterpriseGovernanceApi.listApiTokens(),
        enterpriseGovernanceApi.listSecrets(),
        enterpriseGovernanceApi.listApprovals(),
        enterpriseGovernanceApi.listAudits({ limit: 100 }),
        systemApi.getUsers(),
        projectApi.getProjects(),
      ]);
      setOverview(overviewRes || {});
      setOrganizations(orgRes || []);
      setTeams(teamRes || []);
      setRoles(roleRes || []);
      setUserRoleBindings(userRoleRes || []);
      setProjectRoles(projectRoleRes || []);
      setSsoProviders(ssoRes || []);
      setApiTokens(tokenRes || []);
      setSecrets(secretRes || []);
      setApprovals(approvalRes || []);
      setAudits(auditRes || []);
      setUsers(userRes || []);
      setProjects(projectRes || []);
      if (initialUserId) {
        userRoleForm.setFieldsValue({ user_id: initialUserId, scope_type: 'platform' });
        projectRoleForm.setFieldsValue({ user_id: initialUserId });
        try {
          const profile = await enterpriseGovernanceApi.getUserGovernanceProfile(initialUserId);
          setSelectedProfile(profile);
        } catch {
          setSelectedProfile(null);
        }
      }
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '加载企业治理数据失败');
    } finally {
      setLoading(false);
    }
  }, [initialUserId, projectRoleForm, userRoleForm]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const submit = async (action: () => Promise<any>, successText: string, form?: any) => {
    setLoading(true);
    try {
      const result = await action();
      message.success(successText);
      form?.resetFields();
      await loadAll();
      return result;
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '操作失败');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const openCreateUserModal = () => {
    setEditingUser(null);
    userForm.resetFields();
    setUserModalOpen(true);
  };

  const openEditUserModal = (user: any) => {
    setEditingUser(user);
    userForm.setFieldsValue({
      username: user.username,
      real_name: user.real_name,
      password: '',
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      const values = await userForm.validateFields();
      await submit(
        () => editingUser
          ? systemApi.updateUser(editingUser.id, {
              username: values.username,
              real_name: values.real_name,
              password: values.password || undefined,
            })
          : systemApi.createUser({
              username: values.username,
              real_name: values.real_name,
              password: values.password,
            }),
        editingUser ? '用户更新成功' : '用户创建成功'
      );
      setUserModalOpen(false);
      setEditingUser(null);
      userForm.resetFields();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.detail || '保存用户失败');
      }
    }
  };

  const handleDeleteUser = async (user: any) => {
    await submit(() => systemApi.deleteUser(user.id), '用户删除成功');
  };

  const openUserAuthorization = async (user: any) => {
    userRoleForm.setFieldsValue({ user_id: user.id, scope_type: 'platform' });
    projectRoleForm.setFieldsValue({ user_id: user.id });
    setActiveTab('rbac');
    try {
      const profile = await enterpriseGovernanceApi.getUserGovernanceProfile(user.id);
      const bindings = await enterpriseGovernanceApi.listUserRoleBindings(user.id);
      setSelectedProfile(profile);
      setUserRoleBindings(bindings || []);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '加载用户授权失败');
    }
  };

  const overviewCards = [
    { title: '组织', value: overview.organizations || 0, icon: <BankOutlined /> },
    { title: '团队', value: overview.teams || 0, icon: <TeamOutlined /> },
    { title: 'RBAC 角色', value: overview.roles || 0, icon: <SafetyCertificateOutlined /> },
    { title: '用户角色', value: overview.user_roles || 0, icon: <TeamOutlined /> },
    { title: '项目授权', value: overview.project_roles || 0, icon: <LockOutlined /> },
    { title: 'SSO 启用', value: overview.sso_enabled || 0, icon: <CloudSyncOutlined /> },
    { title: 'API Token', value: overview.api_tokens || 0, icon: <ApiOutlined /> },
    { title: '托管密钥', value: overview.secrets || 0, icon: <KeyOutlined /> },
    { title: '待审批', value: overview.pending_approvals || 0, icon: <CheckOutlined /> },
  ];

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1500, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ marginBottom: 6 }}>权限与企业治理</Title>
          <Text type="secondary">组织、团队、RBAC、项目数据隔离、SSO、API Token、密钥托管、审批和访问审计统一治理。</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>刷新</Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16, borderRadius: 8 }}
        message="治理边界"
        description="当前版本先提供企业治理配置中心和 API Token 认证入口；项目角色与权限已沉淀为结构化数据，后续可逐步接入各业务接口做细粒度拦截。"
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: '治理总览',
            children: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                {overviewCards.map((item) => (
                  <Card key={item.title} bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                    <Statistic title={item.title} value={item.value} prefix={item.icon} />
                  </Card>
                ))}
              </div>
            ),
          },
          {
            key: 'users',
            label: '用户管理',
            children: (
              <Card bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <Title level={4} style={{ marginBottom: 6 }}>用户管理</Title>
                    <Text type="secondary">统一维护登录账号，并从这里进入角色绑定、项目授权和团队归属管理。</Text>
                  </div>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateUserModal}>新增用户</Button>
                </div>
                <Table
                  rowKey="id"
                  loading={loading}
                  dataSource={users}
                  pagination={{ pageSize: 8 }}
                  columns={[
                    { title: '用户名', dataIndex: 'username' },
                    { title: '真实姓名', dataIndex: 'real_name', render: (v) => v || '-' },
                    { title: '系统角色', dataIndex: 'role', render: (v) => <Tag color={v === 'super_admin' ? 'red' : 'blue'}>{v}</Tag> },
                    { title: '状态', dataIndex: 'is_active', render: (v) => v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
                    { title: '创建时间', dataIndex: 'created_at', render: formatTime },
                    {
                      title: '操作',
                      width: 260,
                      render: (_: any, record: any) => (
                        <Space size="small">
                          <Button type="link" icon={<SafetyCertificateOutlined />} onClick={() => openUserAuthorization(record)}>授权</Button>
                          <Button type="link" icon={<EditOutlined />} onClick={() => openEditUserModal(record)}>编辑</Button>
                          <Popconfirm title="确认删除该用户？" onConfirm={() => handleDeleteUser(record)}>
                            <Button type="link" danger icon={<DeleteOutlined />} disabled={record.role === 'super_admin'}>删除</Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'org',
            label: '组织与团队',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card title="新增组织" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                  <Form form={orgForm} layout="inline" onFinish={(values) => submit(() => enterpriseGovernanceApi.createOrganization(values), '组织创建成功', orgForm)}>
                    <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="组织名称" /></Form.Item>
                    <Form.Item name="code" rules={[{ required: true }]}><Input placeholder="组织编码" /></Form.Item>
                    <Form.Item name="description"><Input placeholder="说明" /></Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={loading}>新增组织</Button>
                  </Form>
                </Card>
                <Card title="新增团队" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                  <Form form={teamForm} layout="inline" onFinish={(values) => submit(() => enterpriseGovernanceApi.createTeam(values), '团队创建成功', teamForm)}>
                    <Form.Item name="organization_id" rules={[{ required: true }]}><Select placeholder="所属组织" options={organizations.map((item) => ({ label: item.name, value: item.id }))} style={{ width: 180 }} /></Form.Item>
                    <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="团队名称" /></Form.Item>
                    <Form.Item name="code" rules={[{ required: true }]}><Input placeholder="团队编码" /></Form.Item>
                    <Form.Item name="owner"><Input placeholder="Owner" /></Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={loading}>新增团队</Button>
                  </Form>
                </Card>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Card title="组织列表" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                    <Table rowKey="id" loading={loading} dataSource={organizations} pagination={{ pageSize: 6 }} columns={[
                      { title: '名称', dataIndex: 'name' },
                      { title: '编码', dataIndex: 'code' },
                      { title: '状态', dataIndex: 'status', render: (v) => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
                    ]} />
                  </Card>
                  <Card title="团队列表" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                    <Table rowKey="id" loading={loading} dataSource={teams} pagination={{ pageSize: 6 }} columns={[
                      { title: '团队', dataIndex: 'name' },
                      { title: '组织ID', dataIndex: 'organization_id' },
                      { title: 'Owner', dataIndex: 'owner', render: (v) => v || '-' },
                    ]} />
                  </Card>
                </div>
              </Space>
            ),
          },
          {
            key: 'rbac',
            label: 'RBAC 与项目隔离',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card title="新增角色" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                  <Form form={roleForm} layout="vertical" onFinish={(values) => submit(
                    () => enterpriseGovernanceApi.createRole({ ...values, permissions: parseList(values.permissions) }),
                    '角色创建成功',
                    roleForm
                  )}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                      <Form.Item label="角色名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
                      <Form.Item label="角色编码" name="code" rules={[{ required: true }]}><Input /></Form.Item>
                      <Form.Item label="作用域" name="scope" initialValue="project"><Select options={[{ label: '平台', value: 'system' }, { label: '项目', value: 'project' }, { label: '团队', value: 'team' }]} /></Form.Item>
                      <Form.Item label="权限点" name="permissions"><Input placeholder="project:read,testcase:write" /></Form.Item>
                    </div>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>新增角色</Button>
                  </Form>
                </Card>
                <Card title="授予项目角色" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                  <Form form={projectRoleForm} layout="inline" onFinish={(values) => submit(
                    () => enterpriseGovernanceApi.grantProjectRole({ ...values, permissions: parseList(values.permissions) }),
                    '项目角色授权成功',
                    projectRoleForm
                  )}>
                    <Form.Item name="user_id" rules={[{ required: true }]}><Select placeholder="用户" options={userOptions} style={{ width: 220 }} /></Form.Item>
                    <Form.Item name="project_id" rules={[{ required: true }]}><Select placeholder="项目" options={projectOptions} style={{ width: 220 }} /></Form.Item>
                    <Form.Item name="role_id"><Select allowClear placeholder="角色" options={roleOptions} style={{ width: 220 }} /></Form.Item>
                    <Form.Item name="role_code" initialValue="tester"><Input placeholder="角色编码" /></Form.Item>
                    <Form.Item name="permissions"><Input placeholder="附加权限点" /></Form.Item>
                    <Button type="primary" htmlType="submit">授权</Button>
                  </Form>
                </Card>
                <Card title="绑定用户角色" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                  <Form form={userRoleForm} layout="inline" onFinish={(values) => submit(
                    () => enterpriseGovernanceApi.bindUserRole(values),
                    '用户角色绑定成功',
                    userRoleForm
                  )}>
                    <Form.Item name="user_id" rules={[{ required: true }]}><Select placeholder="用户" options={userOptions} style={{ width: 220 }} /></Form.Item>
                    <Form.Item name="role_id" rules={[{ required: true }]}><Select placeholder="角色" options={roleOptions} style={{ width: 240 }} /></Form.Item>
                    <Form.Item name="scope_type" initialValue="platform"><Select style={{ width: 150 }} options={[
                      { label: '平台', value: 'platform' },
                      { label: '组织', value: 'organization' },
                      { label: '团队', value: 'team' },
                    ]} /></Form.Item>
                    <Form.Item name="scope_id"><InputNumber placeholder="范围ID" min={1} /></Form.Item>
                    <Button type="primary" htmlType="submit">绑定角色</Button>
                  </Form>
                  {selectedProfile && (
                    <Alert
                      type="success"
                      showIcon
                      style={{ marginTop: 16, borderRadius: 8 }}
                      message={`${selectedProfile.user?.real_name || selectedProfile.user?.username} 的治理画像`}
                      description={`平台角色 ${selectedProfile.role_bindings?.length || 0} 个，项目授权 ${selectedProfile.project_roles?.length || 0} 个，团队 ${selectedProfile.teams?.length || 0} 个。`}
                    />
                  )}
                </Card>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Card title="角色矩阵" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                    <Table rowKey="id" loading={loading} dataSource={roles} pagination={{ pageSize: 6 }} columns={[
                      { title: '角色', dataIndex: 'name' },
                      { title: '编码', dataIndex: 'code' },
                      { title: '作用域', dataIndex: 'scope' },
                      { title: '权限', dataIndex: 'permissions', render: (items: string[] = []) => <Space wrap>{items.map((item) => <Tag key={item}>{item}</Tag>)}</Space> },
                    ]} />
                  </Card>
                  <Card title="项目数据隔离授权" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                    <Table rowKey="id" loading={loading} dataSource={projectRoles} pagination={{ pageSize: 6 }} columns={[
                      { title: '用户', dataIndex: 'user_id', render: (v) => userNameMap.get(v) || `用户 #${v}` },
                      { title: '项目', dataIndex: 'project_id', render: (v) => projectNameMap.get(v) || `项目 #${v}` },
                      { title: '角色', render: (_: any, record: any) => record.role_id ? (roleNameMap.get(record.role_id) || record.role_code) : record.role_code },
                      { title: '状态', dataIndex: 'status' },
                    ]} />
                  </Card>
                </div>
                <Card title="用户角色绑定" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                  <Table rowKey="id" loading={loading} dataSource={userRoleBindings} pagination={{ pageSize: 6 }} columns={[
                    { title: '用户', dataIndex: 'user_id', render: (v) => userNameMap.get(v) || `用户 #${v}` },
                    { title: '角色', dataIndex: 'role_id', render: (v) => roleNameMap.get(v) || `角色 #${v}` },
                    {
                      title: '范围',
                      dataIndex: 'scope_type',
                      render: (v) => ({ platform: '平台', organization: '组织', team: '团队' } as Record<string, string>)[v] || v,
                    },
                    { title: '范围ID', dataIndex: 'scope_id', render: (v) => v || '-' },
                    { title: '状态', dataIndex: 'status' },
                    {
                      title: '操作',
                      render: (_: any, record: any) => (
                        <Popconfirm title="确认解除该角色绑定？" onConfirm={() => submit(() => enterpriseGovernanceApi.deleteUserRoleBinding(record.id), '用户角色绑定已解除')}>
                          <Button type="link" danger>解除</Button>
                        </Popconfirm>
                      ),
                    },
                  ]} />
                </Card>
              </Space>
            ),
          },
          {
            key: 'identity',
            label: 'SSO 与 API Token',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card title="SSO/OIDC/SAML/LDAP 配置" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                  <Form form={ssoForm} layout="vertical" onFinish={(values) => submit(() => enterpriseGovernanceApi.createSsoProvider(values), 'SSO 配置已保存', ssoForm)}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                      <Form.Item label="名称" name="name" rules={[{ required: true }]}><Input placeholder="企业 OIDC" /></Form.Item>
                      <Form.Item label="类型" name="provider_type" initialValue="oidc"><Select options={['oidc', 'saml', 'ldap'].map((v) => ({ label: v.toUpperCase(), value: v }))} /></Form.Item>
                      <Form.Item label="启用" name="enabled" valuePropName="checked" initialValue={false}><Switch /></Form.Item>
                      <Form.Item label="Issuer URL" name="issuer_url"><Input /></Form.Item>
                      <Form.Item label="Metadata URL" name="metadata_url"><Input /></Form.Item>
                      <Form.Item label="Client ID" name="client_id"><Input /></Form.Item>
                      <Form.Item label="Client Secret" name="client_secret"><Input.Password /></Form.Item>
                      <Form.Item label="LDAP URL" name="ldap_url"><Input /></Form.Item>
                      <Form.Item label="企业域" name="domain"><Input placeholder="example.com" /></Form.Item>
                    </div>
                    <Button type="primary" htmlType="submit">保存 SSO 配置</Button>
                  </Form>
                </Card>
                <Card title="创建 API Token" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                  <Form form={tokenForm} layout="inline" onFinish={async (values) => {
                    const result = await submit(
                      () => enterpriseGovernanceApi.createApiToken({ ...values, scopes: parseList(values.scopes) }),
                      'API Token 创建成功',
                      tokenForm
                    );
                    if (result?.token) setCreatedToken(result.token);
                  }}>
                    <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="Token 名称" /></Form.Item>
                    <Form.Item name="user_id"><Select allowClear placeholder="绑定用户" options={userOptions} style={{ width: 220 }} /></Form.Item>
                    <Form.Item name="scopes"><Input placeholder="project:read,execution:run" /></Form.Item>
                    <Button type="primary" htmlType="submit">生成 Token</Button>
                  </Form>
                </Card>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Card title="SSO 配置列表" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                    <Table rowKey="id" loading={loading} dataSource={ssoProviders} pagination={{ pageSize: 6 }} columns={[
                      { title: '名称', dataIndex: 'name' },
                      { title: '类型', dataIndex: 'provider_type' },
                      { title: '启用', dataIndex: 'enabled', render: (v) => v ? <Tag color="green">启用</Tag> : <Tag>关闭</Tag> },
                    ]} />
                  </Card>
                  <Card title="API Token 列表" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                    <Table rowKey="id" loading={loading} dataSource={apiTokens} pagination={{ pageSize: 6 }} columns={[
                      { title: '名称', dataIndex: 'name' },
                      { title: '前缀', dataIndex: 'token_prefix' },
                      { title: '状态', dataIndex: 'revoked_at', render: (v) => v ? <Tag>已撤销</Tag> : <Tag color="green">有效</Tag> },
                      {
                        title: '操作',
                        render: (_: any, record: any) => (
                          <Popconfirm title="确认撤销该 Token？" onConfirm={() => submit(() => enterpriseGovernanceApi.revokeApiToken(record.id), 'Token 已撤销')}>
                            <Button type="link" danger disabled={Boolean(record.revoked_at)}>撤销</Button>
                          </Popconfirm>
                        ),
                      },
                    ]} />
                  </Card>
                </div>
              </Space>
            ),
          },
          {
            key: 'secret',
            label: '密钥与审批',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card title="密钥托管" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                  <Form form={secretForm} layout="inline" onFinish={(values) => submit(() => enterpriseGovernanceApi.createSecret(values), '密钥已托管', secretForm)}>
                    <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="密钥名称" /></Form.Item>
                    <Form.Item name="secret_type" initialValue="api_key"><Input placeholder="类型" /></Form.Item>
                    <Form.Item name="owner_scope" initialValue="platform"><Select style={{ width: 140 }} options={[{ label: '平台', value: 'platform' }, { label: '项目', value: 'project' }, { label: '团队', value: 'team' }]} /></Form.Item>
                    <Form.Item name="secret_value" rules={[{ required: true }]}><Input.Password placeholder="密钥值" /></Form.Item>
                    <Form.Item name="rotation_period_days" initialValue={90}><InputNumber min={1} max={3650} /></Form.Item>
                    <Button type="primary" htmlType="submit">托管密钥</Button>
                  </Form>
                </Card>
                <Card title="发起操作审批" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                  <Form form={approvalForm} layout="vertical" onFinish={(values) => submit(
                    () => enterpriseGovernanceApi.createApproval({ ...values, payload: { reason: values.reason || '' } }),
                    '审批已发起',
                    approvalForm
                  )}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                      <Form.Item label="标题" name="title" rules={[{ required: true }]}><Input /></Form.Item>
                      <Form.Item label="动作" name="action_type" rules={[{ required: true }]}><Input placeholder="grant_role / rotate_secret" /></Form.Item>
                      <Form.Item label="资源类型" name="resource_type" rules={[{ required: true }]}><Input placeholder="project / secret / user" /></Form.Item>
                      <Form.Item label="资源ID" name="resource_id"><Input /></Form.Item>
                    </div>
                    <Form.Item label="原因" name="reason"><TextArea rows={3} /></Form.Item>
                    <Button type="primary" htmlType="submit">发起审批</Button>
                  </Form>
                </Card>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Card title="托管密钥" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                    <Table rowKey="id" loading={loading} dataSource={secrets} pagination={{ pageSize: 6 }} columns={[
                      { title: '名称', dataIndex: 'name' },
                      { title: '类型', dataIndex: 'secret_type' },
                      { title: '密钥', dataIndex: 'masked_value' },
                      { title: '轮换周期', dataIndex: 'rotation_period_days', render: (v) => `${v} 天` },
                    ]} />
                  </Card>
                  <Card title="审批流" bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                    <Table rowKey="id" loading={loading} dataSource={approvals} pagination={{ pageSize: 6 }} columns={[
                      { title: '标题', dataIndex: 'title' },
                      { title: '动作', dataIndex: 'action_type' },
                      { title: '状态', dataIndex: 'status', render: (v) => <Tag color={v === 'pending' ? 'orange' : v === 'approved' ? 'green' : 'red'}>{v}</Tag> },
                      {
                        title: '操作',
                        render: (_: any, record: any) => record.status === 'pending' ? (
                          <Space>
                            <Button type="link" onClick={() => submit(() => enterpriseGovernanceApi.decideApproval(record.id, { decision: 'approved' }), '审批已通过')}>通过</Button>
                            <Button type="link" danger onClick={() => submit(() => enterpriseGovernanceApi.decideApproval(record.id, { decision: 'rejected' }), '审批已拒绝')}>拒绝</Button>
                          </Space>
                        ) : '-',
                      },
                    ]} />
                  </Card>
                </div>
              </Space>
            ),
          },
          {
            key: 'audit',
            label: '访问审计',
            children: (
              <Card bordered={false} className="glass-panel" style={{ borderRadius: 12 }}>
                <Paragraph type="secondary">记录企业治理相关的授权、Token、密钥、审批等高风险操作。</Paragraph>
                <Table rowKey="id" loading={loading} dataSource={audits} pagination={{ pageSize: 10 }} columns={[
                  { title: '时间', dataIndex: 'created_at', render: formatTime },
                  { title: '用户', dataIndex: 'username' },
                  { title: '事件', dataIndex: 'event_type' },
                  { title: '资源', dataIndex: 'resource_type' },
                  { title: '资源ID', dataIndex: 'resource_id', render: (v) => v || '-' },
                  { title: '结果', dataIndex: 'result', render: (v) => <Tag color={v === 'success' ? 'green' : 'red'}>{v}</Tag> },
                  { title: 'IP', dataIndex: 'ip_address', render: (v) => v || '-' },
                ]} />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="API Token 已生成"
        open={Boolean(createdToken)}
        onCancel={() => setCreatedToken('')}
        onOk={() => setCreatedToken('')}
        okText="我已保存"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Alert
          type="warning"
          showIcon
          message="Token 仅展示一次"
          description="关闭窗口后无法再次查看完整 Token，请在调用外部接口前保存到安全位置。"
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea value={createdToken} rows={4} readOnly />
      </Modal>

      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={userModalOpen}
        onCancel={() => {
          setUserModalOpen(false);
          setEditingUser(null);
          userForm.resetFields();
        }}
        onOk={handleSaveUser}
        confirmLoading={loading}
        destroyOnHidden
        okText={editingUser ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={userForm} layout="vertical">
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="登录用户名" />
          </Form.Item>
          <Form.Item label="真实姓名" name="real_name" rules={[{ required: true, message: '请输入真实姓名' }]}>
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item
            label={editingUser ? '重置密码' : '登录密码'}
            name="password"
            rules={editingUser ? [] : [{ required: true, message: '请输入登录密码' }]}
          >
            <Input.Password placeholder={editingUser ? '不填写则不修改密码' : '登录密码'} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EnterpriseGovernance;
