import React, { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  message,
  Typography,
  Space,
  Avatar,
  Divider,
  Badge,
  Tabs,
  List,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FileTextOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleFilled,
  SyncOutlined,
  EditOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  RobotFilled,
  PaperClipOutlined,
  MessageOutlined
} from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { projectApi, requirementApi } from '../../services/api';
import { taskCenter } from '../../services/taskCenter';
import { Project } from '../../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'draft' | 'review' | 'approved' | 'development' | 'testing' | 'completed' | 'rejected';
  type: 'functional' | 'non-functional' | 'constraint' | 'assumption';
  projectId: string;
  projectName: string;
  assignedTo: string;
  reporter: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  estimatedHours?: number;
  tags: string[];
}

const Requirements: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(false);

  // Selection State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);

  // AI Generation State
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [form] = Form.useForm();

  // Filter State
  const [searchText, setSearchText] = useState('');

  // Load Projects
  useEffect(() => {
    loadProjects();
  }, []);

  // Load Requirements when Project Changes
  useEffect(() => {
    if (selectedProjectId) {
      loadRequirements(selectedProjectId);
    } else {
      setRequirements([]);
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    try {
      const data = await projectApi.getProjects();
      setProjects(data || []);
      if (data && data.length > 0) {
        setSelectedProjectId(data[0].id.toString());
      }
    } catch (error) {
      message.error('加载项目列表失败');
    }
  };

  const loadRequirements = async (projectId: string) => {
    setLoading(true);
    try {
      // API call to get requirements for specific project
      // Note: Assuming API supports filtering or we filter client side after fetching all
      const data = await requirementApi.getRequirements({ project_id: projectId });

      const formattedRequirements = data.map((req: any) => ({
        id: req.id.toString(),
        title: req.title,
        description: req.description,
        priority: req.priority,
        status: req.status,
        type: req.type,
        projectId: req.project_id.toString(),
        projectName: projects.find(p => p.id === req.project_id)?.name || '',
        assignedTo: req.assigned_to || '',
        reporter: req.reporter || '',
        createdAt: req.created_at,
        updatedAt: req.updated_at,
        dueDate: req.due_date,
        estimatedHours: req.estimated_hours,
        tags: req.tags || [],
      })).filter(req => req.projectId === projectId);

      setRequirements(formattedRequirements);
      if (formattedRequirements.length > 0) {
        setSelectedRequirement(formattedRequirements[0]);
      } else {
        setSelectedRequirement(null);
      }
    } catch (error) {
      console.error(error);
      message.error('加载需求列表失败');
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD Operations ---

  const handleCreate = () => {
    setEditingRequirement(null);
    form.resetFields();
    form.setFieldsValue({ projectId: selectedProjectId, priority: 'medium', status: 'draft', type: 'functional' });
    setModalVisible(true);
  };

  const handleEdit = (req: Requirement) => {
    setEditingRequirement(req);
    form.setFieldsValue({
      ...req,
      dueDate: req.dueDate ? dayjs(req.dueDate) : undefined
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const formattedData = {
        ...values,
        project_id: parseInt(values.projectId),
        due_date: values.dueDate ? values.dueDate.toDate() : null,
      };

      if (editingRequirement) {
        await requirementApi.updateRequirement(parseInt(editingRequirement.id), formattedData);
        message.success('需求更新成功');
      } else {
        await requirementApi.createRequirement(formattedData);
        message.success('需求创建成功');
      }
      setModalVisible(false);
      if (selectedProjectId) loadRequirements(selectedProjectId);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDelete = (req: Requirement) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除需求 "${req.title}" 吗？该操作不可逆转。`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await requirementApi.deleteRequirement(parseInt(req.id));
          message.success('需求删除成功');
          if (selectedProjectId) loadRequirements(selectedProjectId);
          setSelectedRequirement(null);
        } catch (error: any) {
          message.error('删除失败');
        }
      }
    });
  };

  // --- Render Helpers ---

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high': return '#FF3B30';
      case 'medium': return '#FF9500';
      case 'low': return '#34C759';
      default: return '#8E8E93';
    }
  };

  const getStatusTag = (s: string) => {
    const map: any = {
      draft: { color: 'default', text: '草稿' },
      review: { color: 'processing', text: '审核中' },
      approved: { color: 'success', text: '已批准' },
      development: { color: 'warning', text: '开发中' },
      testing: { color: 'purple', text: '测试中' },
      completed: { color: 'success', text: '已完成' },
    };
    const conf = map[s] || { color: 'default', text: s };
    return <Tag color={conf.color} bordered={false}>{conf.text}</Tag>;
  };

  const handleGenerateTestCases = () => {
    setGenerateModalVisible(true);
  };

  const handleGenerate = async (model: string) => {
    if (!selectedRequirement) return;
    setGenerating(true);
    const taskId = taskCenter.createTask({
      type: 'ai_generate_requirement',
      title: `AI 生成用例（需求：${selectedRequirement.title}）`,
      detail: `正在提交生成请求（模型：${model}）`,
      status: 'running',
      progress: 12,
    });
    taskCenter.startAutoProgress(taskId, { max: 88, step: 9, intervalMs: 1200 });
    try {
      const res = await requirementApi.generateTestCases(Number(selectedRequirement.id), model);
      taskCenter.markSuccess(taskId, '任务已提交至后台执行，可在测试用例库查看生成结果');
      message.success(res.message || '✅ 生成请求已提交至后台处理中，稍后请在测试用例库查看');
      setGenerateModalVisible(false);
    } catch (e: any) {
      taskCenter.markFailed(taskId, e?.response?.data?.detail || '提交生成任务失败');
      message.error(e?.response?.data?.detail || '提交生成任务失败');
    } finally {
      setGenerating(false);
    }
  };

  const filteredRequirements = requirements.filter(r =>
    r.title.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>需求管理</Title>
          <Text type="secondary">全生命周期需求追踪与管理</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} shape="round" size="large">
          新建需求
        </Button>
      </div>

      {/* 3-Column Layout */}
      <div style={{ display: 'flex', gap: 20, flex: 1, overflow: 'hidden' }}>

        {/* 1. Projects List (Left Pane) */}
        <div className="glass-panel" style={{ flex: '0 0 260px', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(255,255,255,0.4)' }}>
            <Text strong style={{ color: '#888' }}>项目列表</Text>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedProjectId(p.id.toString())}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 4,
                  cursor: 'pointer',
                  background: selectedProjectId === p.id.toString() ? 'rgba(0,122,255,0.1)' : 'transparent',
                  color: selectedProjectId === p.id.toString() ? '#007AFF' : 'inherit',
                  transition: 'background 0.2s',
                  display: 'flex', alignItems: 'center', gap: 10
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: selectedProjectId === p.id.toString() ? '#007AFF' : '#C7C7CC' }} />
                <span style={{ fontWeight: selectedProjectId === p.id.toString() ? 600 : 400 }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Requirements List (Middle Pane) */}
        <div className="glass-panel" style={{ flex: 1, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#ccc' }} />}
              placeholder="搜索需求..."
              bordered={false}
              style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <List
              dataSource={filteredRequirements}
              renderItem={item => {
              let plainText = '';
              if (item.description) {
                const doc = new DOMParser().parseFromString(item.description, 'text/html');
                plainText = doc.body.textContent || "";
              }
              return (
                <div
                  onClick={() => setSelectedRequirement(item)}
                  style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid rgba(0,0,0,0.03)',
                    cursor: 'pointer',
                    background: selectedRequirement?.id === item.id ? 'rgba(0,122,255,0.05)' : 'transparent',
                    borderLeft: selectedRequirement?.id === item.id ? '4px solid #007AFF' : '4px solid transparent',
                    transition: 'all 0.2s'
                  }}
                  className="hover-bg"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 15, color: '#333' }}>{item.title}</Text>
                    {getStatusTag(item.status)}
                  </div>
                  {/* Remove rich text tags for list preview */}
                  <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ fontSize: 13, marginBottom: 8 }}>
                    {plainText}
                  </Paragraph>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#888' }}>
                    <Space size={4}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: getPriorityColor(item.priority) }} />
                      {item.priority === 'high' ? '高优先级' : item.priority === 'medium' ? '中优先级' : '低优先级'}
                    </Space>
                    <Space size={4}>
                      <UserOutlined /> {item.assignedTo || '未分配'}
                    </Space>
                    <Space size={4}>
                      <ClockCircleOutlined /> {dayjs(item.updatedAt).format('MM-DD')}
                    </Space>
                  </div>
                </div>
              )}}
            />
          </div>
        </div>

        {/* 3. Requirement Detail (Right Pane) */}
        <div className="glass-panel" style={{ flex: 1.2, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(255,255,255,0.8)' }}>
          {selectedRequirement ? (
            <>
              {/* Toolbar */}
              <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Tag icon={<FileTextOutlined />} color="blue">RES-{selectedRequirement.id}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>最后更新: {dayjs(selectedRequirement.updatedAt).fromNow()}</Text>
                </Space>
                <Space>
                  <Tooltip title="编辑"><Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(selectedRequirement)} /></Tooltip>
                  <Tooltip title="删除"><Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(selectedRequirement)} /></Tooltip>
                </Space>
              </div>

              {/* Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                <Title level={3} style={{ marginBottom: 16 }}>{selectedRequirement.title}</Title>

                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                  {getStatusTag(selectedRequirement.status)}
                  <Tag>{selectedRequirement.type}</Tag>
                  {selectedRequirement.tags.map(t => <Tag key={t}>#{t}</Tag>)}
                </div>

                <div style={{ marginBottom: 32 }}>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</Text>
                  <div 
                    style={{ marginTop: 8, lineHeight: 1.8, fontSize: 15, background: 'rgba(0,0,0,0.01)', padding: 16, borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)' }}
                    className="rich-text-content"
                    dangerouslySetInnerHTML={{ __html: selectedRequirement.description || '<span style="color: #999">暂无描述</span>' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 20, background: 'rgba(0,0,0,0.02)', borderRadius: 12, marginBottom: 32 }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>负责人</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <Avatar size="small" icon={<UserOutlined />} />
                      <span>{selectedRequirement.assignedTo || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>截止日期</Text>
                    <div style={{ marginTop: 4 }}>
                      <CalendarOutlined style={{ marginRight: 6, color: '#888' }} />
                      {selectedRequirement.dueDate ? dayjs(selectedRequirement.dueDate).format('YYYY-MM-DD') : '-'}
                    </div>
                  </div>
                </div>

                {/* AI Insights Section */}
                <div style={{ background: 'linear-gradient(135deg, rgba(0,122,255,0.05) 0%, rgba(88,86,214,0.05) 100%)', borderRadius: 12, padding: 20, border: '1px solid rgba(0,122,255,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <RobotFilled style={{ color: '#007AFF' }} />
                    <Text strong style={{ color: '#007AFF' }}>AI 关联分析</Text>
                  </div>
                  <Text style={{ fontSize: 13, color: '#555' }}>
                    该功能与 <Text code>支付网关模块</Text> 和 <Text code>用户钱包</Text> 有强依赖关系。
                    建议补充对极端网络延迟情况下的边界测试用例。
                  </Text>
                  <Divider style={{ margin: '12px 0' }} />
                  <Space split={<Divider type="vertical" />}>
                    <Button type="link" size="small" style={{ padding: 0 }} onClick={handleGenerateTestCases}>生成测试用例</Button>
                    <Button type="link" size="small" style={{ padding: 0 }}>检查一致性</Button>
                  </Space>
                </div>

                <Divider />

                <Tabs defaultActiveKey="1">
                  <TabPane tab={<span><MessageOutlined /> 评论</span>} key="1">
                    <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无评论</div>
                  </TabPane>
                  <TabPane tab={<span><PaperClipOutlined /> 附件</span>} key="2">
                    <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无附件</div>
                  </TabPane>
                  <TabPane tab={<span><SyncOutlined /> 变更历史</span>} key="3">
                    <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无变更记录</div>
                  </TabPane>
                </Tabs>

              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              <FileTextOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }} />
              <Text type="secondary">选择一个需求以查看详情</Text>
            </div>
          )}
        </div>

      </div>

      {/* Create/Edit Modal */}
      <Modal
        title={editingRequirement ? '编辑需求' : '新建需求'}
        open={modalVisible}
        onOk={form.submit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="projectId" label="所属项目" rules={[{ required: true }]}>
            <Select>
              {projects.map(p => <Select.Option key={p.id} value={p.id.toString()}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="需求标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="详细描述" style={{ marginBottom: 60 }}>
            <ReactQuill theme="snow" style={{ height: 200 }} placeholder="请输入需求详细说明，支持富文本排版..." />
          </Form.Item>
          <Space size={16} style={{ display: 'flex' }}>
            <Form.Item name="priority" label="优先级" style={{ flex: 1 }}>
              <Select>
                <Select.Option value="high">高</Select.Option>
                <Select.Option value="medium">中</Select.Option>
                <Select.Option value="low">低</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="type" label="类型" style={{ flex: 1 }}>
              <Select>
                <Select.Option value="functional">功能</Select.Option>
                <Select.Option value="non-functional">非功能</Select.Option>
              </Select>
            </Form.Item>
          </Space>
          <Form.Item name="assignedTo" label="负责人">
            <Input prefix={<UserOutlined />} />
          </Form.Item>
        </Form>
      </Modal>

      {/* AI Generate Modal */}
      <Modal
        title="AI生成功能测试用例"
        open={generateModalVisible}
        onCancel={() => setGenerateModalVisible(false)}
        footer={null}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button size="large" icon={<RobotFilled />} onClick={() => handleGenerate('glm')} loading={generating}>使用 GLM-4 生成</Button>
          <Button size="large" icon={<RobotFilled />} onClick={() => handleGenerate('openai')} loading={generating}>使用 GPT-4 / OpenAI 生成</Button>
          <Button size="large" icon={<RobotFilled />} onClick={() => handleGenerate('deepseek')} loading={generating}>使用 DeepSeek 生成</Button>
          <Button size="large" icon={<RobotFilled />} onClick={() => handleGenerate('tongyi')} loading={generating}>使用 通义千问 生成</Button>
          <Button size="large" icon={<RobotFilled />} onClick={() => handleGenerate('siliconflow')} loading={generating}>使用 硅基流动 生成</Button>
        </div>
      </Modal>

    </div>
  );
};

export default Requirements;
