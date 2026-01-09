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
  Divider
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BugOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectApi } from '../services/api';
import { Project } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
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

  const columns = [
    {
      title: '项目',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Project) => (
        <div className="cell-primary">
          <Text className="cell-title">
            <BugOutlined style={{ marginRight: 8, color: '#0071e3' }} />
            {text}
          </Text>
          <Text className="cell-subtitle">
            {record.description || '暂无描述'}
          </Text>
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Project) => (
        <Space size="middle" className="row-actions">
          <Button 
            type="link" 
            onClick={() => viewTestCases(record.id)}
          >
            测试用例
          </Button>
          <Button 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个项目吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-shell">
      <div className="page-toolbar">
        <div className="page-title">
          <Title level={2} style={{ margin: 0 }}>项目管理</Title>
          <span className="page-subtitle">集中管理测试项目与核心信息</span>
        </div>
        <Space>
          <Button>导出</Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建项目
          </Button>
        </Space>
      </div>

      <div className="split-layout">
        <div className="panel">
          <div className="panel-header">
            <Text strong>项目列表</Text>
            <Text type="secondary">{projects.length} 个项目</Text>
          </div>
          <div className="panel-body">
            <Table
              columns={columns}
              dataSource={projects}
              rowKey="id"
              loading={loading}
              pagination={{
                total: projects.length,
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              onRow={(record) => ({
                onClick: () => setSelectedProject(record),
              })}
              rowClassName={(record) =>
                selectedProject?.id === record.id ? 'ant-table-row-selected' : ''
              }
            />
          </div>
        </div>

        <div className="panel inspector-panel">
          <div className="panel-header">
            <Text strong>项目概览</Text>
          </div>
          <div className="panel-body">
            {selectedProject ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space>
                  <FolderOpenOutlined style={{ color: '#0071e3' }} />
                  <Text strong>{selectedProject.name}</Text>
                </Space>
                <Text type="secondary">{selectedProject.description || '暂无描述'}</Text>
                <Divider style={{ margin: '8px 0' }} />
                <Space direction="vertical" size={6}>
                  <Text type="secondary">创建时间</Text>
                  <Text>{new Date(selectedProject.created_at).toLocaleString()}</Text>
                  <Text type="secondary">更新时间</Text>
                  <Text>{new Date(selectedProject.updated_at).toLocaleString()}</Text>
                </Space>
                <Divider style={{ margin: '8px 0' }} />
                <Button type="primary" block onClick={() => viewTestCases(selectedProject.id)}>
                  查看测试用例
                </Button>
                <Button block onClick={() => handleEdit(selectedProject)}>
                  编辑项目
                </Button>
              </Space>
            ) : (
              <Space direction="vertical" size="small">
                <Text type="secondary">选择一个项目以查看详情</Text>
              </Space>
            )}
          </div>
        </div>
      </div>

      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
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
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="项目描述"
          >
            <TextArea rows={4} placeholder="请输入项目描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Projects;
