import React, { useState, useEffect } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  Typography,
  Space,
  message,
  Popconfirm,
  Divider,
  Avatar,
  Tag,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BugOutlined,
  FolderOpenOutlined,
  SearchOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectApi } from '../services/api';
import { Project } from '../types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await projectApi.getProjects();
      setProjects(data || []);
      if (data && data.length > 0 && !selectedProject) {
        setSelectedProject(data[0]);
      }
    } catch (error) {
      message.error('加载项目列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingProject(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    form.setFieldsValue(project);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await projectApi.deleteProject(id);
      message.success('项目删除成功');
      loadProjects();
      if (selectedProject?.id === id) {
        setSelectedProject(null);
      }
    } catch (error) {
      message.error('删除项目失败');
      console.error(error);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingProject) {
        await projectApi.updateProject(editingProject.id, values);
        message.success('项目更新成功');
      } else {
        await projectApi.createProject(values);
        message.success('项目创建成功');
      }
      setModalVisible(false);
      loadProjects();
    } catch (error) {
      message.error('操作失败');
      console.error(error);
    }
  };

  const viewTestCases = (projectId: number) => {
    navigate(`/projects/${projectId}/testcases`);
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  // Helper to generate a consistent color based on string
  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  }

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Project) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `linear-gradient(135deg, ${stringToColor(text)} 0%, ${stringToColor(text + 'dark')} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 600, fontSize: 16,
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
          }}>
            {text.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong style={{ fontSize: 14 }}>{text}</Text>
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: record.description }}>
              {record.description || '暂无描述'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => <Text type="secondary" style={{ fontSize: 13 }}>{dayjs(text).format('YYYY-MM-DD')}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Project) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Tooltip title="更多操作">
            <Button type="text" shape="circle" icon={<MoreOutlined />} />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header & Toolbar */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>项目管理</Title>
          <Text type="secondary">集中管理测试项目与核心配置</Text>
        </div>
        <Space size="middle">
          <Input
            prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />}
            placeholder="搜索项目..."
            style={{ width: 240, borderRadius: 20 }}
            allowClear
            onChange={e => setSearchText(e.target.value)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} shape="round" size="large">
            新建项目
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>

        {/* Left: Project List */}
        <div className="glass-panel" style={{ flex: 7, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Table
            columns={columns}
            dataSource={filteredProjects}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            onRow={(record) => ({
              onClick: () => setSelectedProject(record),
              style: { cursor: 'pointer' }
            })}
            rowClassName={(record) => selectedProject?.id === record.id ? 'ant-table-row-selected' : 'table-row-hover'}
            style={{ background: 'transparent' }}
          />
        </div>

        {/* Right: Inspector Panel */}
        <div className="glass-panel" style={{ flex: 3, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column' }}>
          {selectedProject ? (
            <div className="fade-in" key={selectedProject.id} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

              {/* Project Header */}
              <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 20,
                  background: `linear-gradient(135deg, ${stringToColor(selectedProject.name)} 0%, ${stringToColor(selectedProject.name + 'dark')} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 32,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                  marginBottom: 16
                }}>
                  {selectedProject.name.charAt(0).toUpperCase()}
                </div>
                <Title level={4} style={{ margin: 0 }}>{selectedProject.name}</Title>
                <Tag color="blue" style={{ marginTop: 8 }}>普通项目</Tag>
              </div>

              <div style={{ flex: 1 }}>
                <Text type="secondary" style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>项目描述</Text>
                <Paragraph type="secondary" style={{ background: 'rgba(0,0,0,0.02)', padding: 12, borderRadius: 8 }}>
                  {selectedProject.description || '该项目暂无描述信息。'}
                </Paragraph>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>创建时间</Text>
                    <div style={{ fontWeight: 500 }}>{dayjs(selectedProject.created_at).format('YYYY-MM-DD')}</div>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>更新时间</Text>
                    <div style={{ fontWeight: 500 }}>{dayjs(selectedProject.updated_at).format('YYYY-MM-DD')}</div>
                  </div>
                </div>
              </div>

              <Divider />

              <Space direction="vertical" style={{ width: '100%' }}>
                <Button type="primary" block size="large" icon={<FolderOpenOutlined />} onClick={() => viewTestCases(selectedProject.id)}>
                  进入项目
                </Button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Button icon={<EditOutlined />} onClick={() => handleEdit(selectedProject)}>编辑</Button>
                  <Popconfirm
                    title="确定要删除这个项目吗？"
                    description="删除后无法恢复，且会删除所有关联的测试用例。"
                    onConfirm={() => handleDelete(selectedProject.id)}
                    okText="确定删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </div>
              </Space>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              <FolderOpenOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
              <Text type="secondary">选择左侧项目查看详情</Text>
            </div>
          )}
        </div>

      </div>

      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        centered
        width={480}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="给项目起个名字" size="large" />
          </Form.Item>
          <Form.Item
            name="description"
            label="项目描述"
          >
            <TextArea rows={4} placeholder="描述该项目的主要功能..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Projects;
