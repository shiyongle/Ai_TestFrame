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
  List,
  Timeline,
  Statistic,
  DatePicker,
  Drawer,
  Spin,
  Empty,
  Progress,
  Descriptions,
  Collapse
} from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  UserOutlined,
  CheckCircleFilled,
  EditOutlined,
  DeleteOutlined,
  RobotFilled,
  BranchesOutlined,
  HistoryOutlined,
  BugOutlined,
  ProjectOutlined,
  DatabaseOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { versionApi, requirementApi, aiApi, projectApi } from '../services/api';
import { taskCenter } from '../services/taskCenter';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Version {
  id: number;
  version_number: string;
  description: string;
  changes: any;
  status: string;
  release_date: string;
  created_at: string;
  created_by: string;
  project_id?: number;
  project?: any;
  requirements?: any[];
}

interface AIGenerationSessionItem {
  session_id: string;
  model: string;
  status: string;
  total_requirements: number;
  total_generated_cases: number;
  total_hit_cases: number;
  total_citations: number;
  explicit_doc_count: number;
  knowledge_hit_rate: number;
  summary?: any;
  error_message?: string;
  created_at?: string;
  completed_at?: string;
}

interface AIGenerationEvidenceItem {
  id: number;
  testcase_id?: number;
  requirement_id: number;
  case_index: number;
  case_title: string;
  used_explicit_context: boolean;
  used_rag: boolean;
  knowledge_hit_count: number;
  citation_count: number;
  hit_score: number;
  evidence_summary?: string;
  raw_case?: any;
  citations: Array<{
    id?: number;
    knowledge_doc_id?: number;
    requirement_id?: number;
    source_type: string;
    evidence_type: string;
    chunk_id?: string;
    chunk_index?: number;
    doc_title?: string;
    matched_text?: string;
    quote_text?: string;
    similarity_score?: number;
  }>;
}

const Versions: React.FC = () => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [, setLoading] = useState(false);

  // Selection
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVersion, setEditingVersion] = useState<Version | null>(null);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [form] = Form.useForm();

  // Data State
  const [allRequirements, setAllRequirements] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedReqIds, setSelectedReqIds] = useState<number[]>([]);
  const [aiSessions, setAiSessions] = useState<AIGenerationSessionItem[]>([]);
  const [aiSessionsLoading, setAiSessionsLoading] = useState(false);
  const [aiEvidenceVisible, setAiEvidenceVisible] = useState(false);
  const [aiEvidenceLoading, setAiEvidenceLoading] = useState(false);
  const [selectedAiSession, setSelectedAiSession] = useState<any>(null);

  const [linkKnowledgeVisible, setLinkKnowledgeVisible] = useState(false);
  const [allKnowledge, setAllKnowledge] = useState<any[]>([]);
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<number[]>([]);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);

  useEffect(() => {
    loadProjects();
    loadRequirements();
    loadKnowledge();
  }, []);

  useEffect(() => {
    loadVersions(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedVersion?.id) {
      loadAiSessions(selectedVersion.id);
    } else {
      setAiSessions([]);
    }
  }, [selectedVersion?.id]);

  const loadProjects = async () => {
    try {
      const data = await projectApi.getProjects();
      setProjects(data || []);
    } catch (e) { console.error(e); }
  };

  const loadVersions = async (projectId?: number) => {
    setLoading(true);
    try {
      const data = await versionApi.getVersions(projectId);
      // Sort by created_at desc
      const sorted = (data || []).sort((a: Version, b: Version) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
      setVersions(sorted);
      if (sorted.length > 0) {

        // When reloading, preserve selection if possible
        setSelectedVersion(prev => {
          if (!prev) return sorted[0];
          const updated = sorted.find(v => v.id === prev.id);
          return updated || sorted[0];
        });
      }
    } catch (error) {
      message.error('加载版本列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRequirements = async () => {
    try {
      const data = await requirementApi.getRequirements();
      setAllRequirements(data || []);
    } catch (e) { console.error(e); }
  };

  const loadKnowledge = async () => {
    try {
      const res = await aiApi.getKnowledgeList();
      setAllKnowledge(res?.data?.documents || res?.data || []);
    } catch (e) { console.error(e); }
  };

  const loadAiSessions = async (versionId: number) => {
    setAiSessionsLoading(true);
    try {
      const data = await versionApi.getAiGenerationSessions(versionId);
      setAiSessions(data || []);
    } catch (e) {
      console.error(e);
      setAiSessions([]);
    } finally {
      setAiSessionsLoading(false);
    }
  };

  const openAiEvidence = async (sessionId: string) => {
    if (!selectedVersion) return;
    setAiEvidenceVisible(true);
    setAiEvidenceLoading(true);
    try {
      const detail = await versionApi.getAiGenerationSessionDetail(selectedVersion.id, sessionId);
      setSelectedAiSession(detail || null);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '加载 AI 证据详情失败');
      setSelectedAiSession(null);
    } finally {
      setAiEvidenceLoading(false);
    }
  };

  // --- Actions ---

  const handleCreate = () => {
    setEditingVersion(null);
    form.resetFields();
    form.setFieldsValue({ status: 'draft' });
    setModalVisible(true);
  };

  const handleEdit = (v: Version) => {
    setEditingVersion(v);
    form.setFieldsValue({
      ...v,
      release_date: v.release_date ? dayjs(v.release_date) : undefined
    });
    setModalVisible(true);
  };

  const handleDelete = (v: Version) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除版本 ${v.version_number} 吗？`,
      onOk: async () => {
        try {
          await versionApi.deleteVersion(v.id);
          message.success('删除成功');
          loadVersions(selectedProjectId);
          if (selectedVersion?.id === v.id) setSelectedVersion(null);
        } catch (e) { message.error('删除失败'); }
      },
      okButtonProps: { danger: true }
    });
  };

  const handleOpenLinkModal = () => {
    setSelectedReqIds([]);
    setLinkModalVisible(true);
  };

  const handleLinkRequirements = async () => {
    if (!selectedVersion) return;
    if (selectedReqIds.length === 0) {
      message.warning('请选择要关联的需求');
      return;
    }

    try {
      await versionApi.addRequirementsToVersion(selectedVersion.id, selectedReqIds);
      message.success('关联成功');
      setLinkModalVisible(false);
      loadVersions(selectedProjectId); // Refresh the list
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '关联失败');
    }
  };

  const handleOpenKnowledgeModal = async () => {
    if (!selectedVersion) return;
    try {
      const res = await versionApi.getLinkedKnowledge(selectedVersion.id);
      setSelectedKnowledgeIds(res.map((k: any) => k.id));
      setLinkKnowledgeVisible(true);
    } catch (e) { message.error('获取已关联知识文档失败'); }
  };

  const handleLinkKnowledge = async () => {
    if (!selectedVersion) return;
    try {
      await versionApi.linkKnowledgeToVersion(selectedVersion.id, selectedKnowledgeIds);
      message.success('关联知识库成功');
      setLinkKnowledgeVisible(false);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '关联失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        release_date: values.release_date ? values.release_date.toDate() : null,
        changes: values.changes || {},
        created_by: values.created_by || 'Admin',
        description: values.description || '',
      };

      if (editingVersion) {
        await versionApi.updateVersion(editingVersion.id, payload);
        message.success('更新成功');
      } else {
        await versionApi.createVersion(payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadVersions(selectedProjectId);
    } catch (e) { message.error('操作失败'); }
  };

  const handleGenerateTestCases = () => {
    setGenerateModalVisible(true);
  };

  const handleGenerate = async (model: string) => {
    if (!selectedVersion) return;
    setGenerating(true);
    const taskId = taskCenter.createTask({
      type: 'ai_generate_version',
      title: `AI 生成用例（版本：${selectedVersion.version_number}）`,
      detail: `正在提交生成请求（模型：${model}）`,
      status: 'running',
      progress: 12,
    });
    taskCenter.startAutoProgress(taskId, { max: 88, step: 9, intervalMs: 1200 });
    try {
      const res = await versionApi.generateTestCases(selectedVersion.id, model);
      taskCenter.markSuccess(taskId, `任务已提交至后台执行，证据会话：${res.session_id || '未返回'}`);
      message.success(res.message || '✅ 生成请求已提交至后台处理中，稍后请在测试用例库查看');
      setGenerateModalVisible(false);
      if (selectedVersion?.id) {
        loadAiSessions(selectedVersion.id);
      }
    } catch (e: any) {
      taskCenter.markFailed(taskId, e?.response?.data?.detail || '提交生成任务失败');
      message.error(e?.response?.data?.detail || '提交生成任务失败');
    }
    finally { setGenerating(false); }
  };

  // --- Render Helpers ---

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'released': return 'success';
      case 'draft': return 'processing';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    const map: any = { released: '已发布', draft: '草稿', archived: '已归档' };
    return map[status] || status;
  };

  const getSessionStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'gold',
      running: 'processing',
      completed: 'success',
      failed: 'error'
    };
    return map[status] || 'default';
  };

  const getSessionStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: '排队中',
      running: '生成中',
      completed: '已完成',
      failed: '失败'
    };
    return map[status] || status;
  };

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>版本管理</Title>
          <Text type="secondary">版本发布时间轴与变更追踪</Text>
        </div>
        <Space>
          <Select
            placeholder="全项目 (所有版本)"
            allowClear
            style={{ width: 200 }}
            value={selectedProjectId}
            onChange={(val) => setSelectedProjectId(val)}
          >
            {projects.map(p => (
              <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
            ))}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} shape="round" size="large">
            新建版本
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>

        {/* Left: Timeline Navigation */}
        <div className="glass-panel" style={{ flex: '0 0 320px', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 24 }}>
          <Title level={4} style={{ marginBottom: 24 }}>Release History</Title>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 10 }}>
            {versions.length === 0 ? <p style={{ color: '#999', textAlign: 'center' }}>暂无版本</p> : (
              <Timeline
                items={versions.map(v => ({
                  color: v.status === 'released' ? 'green' : v.status === 'draft' ? 'blue' : 'gray',
                  dot: selectedVersion?.id === v.id ? <CheckCircleFilled style={{ fontSize: 16, color: '#007AFF' }} /> : undefined,
                  children: (
                    <div
                      className="hover-scale"
                      onClick={() => setSelectedVersion(v)}
                      style={{
                        cursor: 'pointer',
                        padding: '12px 16px',
                        background: selectedVersion?.id === v.id ? 'rgba(0,122,255,0.08)' : 'rgba(255,255,255,0.5)',
                        borderRadius: 12,
                        marginBottom: 8,
                        border: selectedVersion?.id === v.id ? '1px solid #007AFF' : '1px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 16 }}>{v.version_number}</Text>
                        <Tag color={getStatusColor(v.status)} bordered={false} style={{ marginRight: 0 }}>{getStatusLabel(v.status)}</Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                        {v.release_date ? dayjs(v.release_date).format('YYYY-MM-DD') : '未发布'}
                      </Text>
                      <Text type="secondary" ellipsis style={{ fontSize: 12 }}>{v.description}</Text>
                    </div>
                  )
                }))}
              />
            )}
          </div>
        </div>

        {/* Right: Detail View */}
        <div className="glass-panel" style={{ flex: 1, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 32, overflowY: 'auto' }}>
          {selectedVersion ? (
            <div className="fade-in">
              {/* Top Banner for Latest/Released */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <Title level={1} style={{ margin: 0 }}>{selectedVersion.version_number}</Title>
                    <Tag color={getStatusColor(selectedVersion.status)} style={{ fontSize: 14, padding: '4px 10px' }}>{getStatusLabel(selectedVersion.status)}</Tag>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Text type="secondary" style={{ fontSize: 16 }}>
                      发布于 {selectedVersion.release_date ? dayjs(selectedVersion.release_date).format('YYYY年MM月DD日') : '待定'}
                    </Text>
                    {selectedVersion.project && (
                      <Tag color="cyan" style={{ fontSize: 14, padding: '2px 8px', borderRadius: 6, margin: 0 }}>
                        <ProjectOutlined style={{ marginRight: 4 }} />
                        {selectedVersion.project.name}
                      </Tag>
                    )}
                  </div>
                </div>
                <Space>
                  <Button icon={<EditOutlined />} onClick={() => handleEdit(selectedVersion)}>编辑</Button>
                  <Button icon={<FileTextOutlined />} onClick={handleOpenKnowledgeModal}>绑定 RAG 知识库</Button>
                  <Button type="primary" icon={<RobotFilled />} onClick={handleGenerateTestCases}>AI生成用例</Button>
                  <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(selectedVersion)} />
                </Space>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
                <div style={{ background: 'rgba(0,122,255,0.05)', padding: 20, borderRadius: 12 }}>
                  <Statistic title="关联需求" value={selectedVersion.requirements?.length || 0} prefix={<FileTextOutlined />} />
                </div>
                <div style={{ background: 'rgba(52,199,89,0.05)', padding: 20, borderRadius: 12 }}>
                  <Statistic title="Bug修复" value={0} prefix={<BugOutlined />} suffix="个" />
                </div>
                <div style={{ background: 'rgba(255,149,0,0.05)', padding: 20, borderRadius: 12 }}>
                  <Statistic title="测试覆盖率" value="--" suffix="%" prefix={<CheckCircleFilled />} />
                </div>
              </div>

              <Divider />

              {/* Description & Changelog */}
              <div style={{ marginBottom: 40 }}>
                <Title level={4}><BranchesOutlined /> 变更日志</Title>
                <Paragraph style={{ fontSize: 15, lineHeight: 1.8, color: '#444' }}>
                  {selectedVersion.description || '暂无详细描述。'}
                </Paragraph>

                {/* AI Changelog Placeholder */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%)',
                  borderRadius: 12,
                  padding: 24,
                  border: '1px solid #bae7ff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <RobotFilled style={{ color: '#1890ff', fontSize: 20 }} />
                    <Text strong style={{ color: '#1890ff', fontSize: 16 }}>AI 智能摘要</Text>
                  </div>
                  <ul style={{ paddingLeft: 20, margin: 0, color: '#595959' }}>
                    <li>此版本主要集中在 <Text strong>用户体验优化</Text> 和 <Text strong>性能提升</Text>。</li>
                    <li>检测到涉及 <Text code>Authentication</Text> 模块的底层重构，建议进行回归测试。</li>
                    <li>新增了 3 个 API 端点，已自动生成对应的接口测试用例。</li>
                  </ul>
                </div>
              </div>

              {/* AI 知识命中分析 */}
              <div style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Title level={4} style={{ margin: 0 }}><DatabaseOutlined /> AI 知识命中分析</Title>
                  <Button onClick={() => selectedVersion && loadAiSessions(selectedVersion.id)}>刷新会话</Button>
                </div>
                {aiSessionsLoading ? (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}><Spin /></div>
                ) : aiSessions.length === 0 ? (
                  <Empty description="暂无 AI 生成证据会话" />
                ) : (
                  <List
                    dataSource={aiSessions}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          <Button key="view" type="link" icon={<EyeOutlined />} onClick={() => openAiEvidence(item.session_id)}>
                            查看证据
                          </Button>
                        ]}
                      >
                        <List.Item.Meta
                          avatar={<Avatar style={{ backgroundColor: '#1677ff' }} icon={<RobotFilled />} />}
                          title={
                            <Space>
                              <Text strong>{item.model}</Text>
                              <Tag color={getSessionStatusColor(item.status)}>{getSessionStatusLabel(item.status)}</Tag>
                              <Text type="secondary">{item.session_id.slice(0, 8)}</Text>
                            </Space>
                          }
                          description={
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <Space wrap>
                                <Text>生成用例：{item.total_generated_cases || 0}</Text>
                                <Text>命中用例：{item.total_hit_cases || 0}</Text>
                                <Text>引用条数：{item.total_citations || 0}</Text>
                                <Text>显式知识：{item.explicit_doc_count || 0}</Text>
                              </Space>
                              <Progress
                                percent={Math.round((item.knowledge_hit_rate || 0) * 100)}
                                size="small"
                                status={item.status === 'failed' ? 'exception' : undefined}
                              />
                              <Text type="secondary">
                                创建时间：{item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : '--'}
                              </Text>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </div>

              {/* Associated Requirements */}
              <div>
                <Title level={4}><FileTextOutlined /> 关联需求</Title>
                <List
                  dataSource={selectedVersion.requirements || []}
                  renderItem={(item: any) => {
                    let plainText = '';
                    if (item.description) {
                      const doc = new DOMParser().parseFromString(item.description, 'text/html');
                      plainText = doc.body.textContent || "";
                    }
                    return (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar style={{ backgroundColor: '#87d068' }} icon={<UserOutlined />} />}
                        title={item.title}
                        description={plainText}
                      />
                      <Tag color="blue">{item.priority}</Tag>
                    </List.Item>
                  )}}
                  locale={{ emptyText: '暂无关联需求' }}
                />
                <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 16 }} onClick={handleOpenLinkModal}>关联更多需求</Button>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              <HistoryOutlined style={{ fontSize: 64, marginBottom: 24, opacity: 0.2 }} />
              <Title level={4} type="secondary">选择左侧版本查看详情</Title>
            </div>
          )}
        </div>

      </div>

      {/* Create/Edit Modal */}
      <Modal
        title={editingVersion ? "编辑版本" : "发布新版本"}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="project_id" label="所属项目" rules={[{ required: true, message: '请选择所属项目' }]}>
            <Select placeholder="选择关联项目">
              {projects.map(p => (
                <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="version_number" label="版本号" rules={[{ required: true }]}>
            <Input placeholder="v1.0.0" />
          </Form.Item>
          <Form.Item name="release_date" label="发布日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value="draft">草稿 (Draft)</Select.Option>
              <Select.Option value="released">已发布 (Released)</Select.Option>
              <Select.Option value="archived">已归档 (Archived)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="版本描述 / Changelog">
            <TextArea rows={6} placeholder="列出此版本的主要变更..." />
          </Form.Item>
          <Form.Item name="created_by" label="负责人">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* AI Generate Modal */}
      <Modal
        title="AI生成测试用例"
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

      {/* Link Requirements Modal */}
      <Modal
        title="关联更多需求"
        open={linkModalVisible}
        onOk={handleLinkRequirements}
        onCancel={() => setLinkModalVisible(false)}
        destroyOnClose
      >
        <div style={{ padding: '20px 0' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            请选择要关联到当前版本 {selectedVersion?.version_number} 的需求：
          </Text>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="请选择需求..."
            value={selectedReqIds}
            onChange={setSelectedReqIds}
            optionFilterProp="children"
            showSearch
          >
            {allRequirements
              .filter(req => {
                // exclude already linked requirements
                if (!selectedVersion?.requirements) return true;
                return !selectedVersion.requirements.some(linked => linked.id === req.id);
              })
              .map(req => (
                <Select.Option key={req.id} value={req.id}>
                  [{req.id}] {req.title}
                </Select.Option>
              ))}
          </Select>
        </div>
      </Modal>

      {/* Link Knowledge Modal */}
      <Modal
        title="关联知识库"
        open={linkKnowledgeVisible}
        onOk={handleLinkKnowledge}
        onCancel={() => setLinkKnowledgeVisible(false)}
        destroyOnClose
      >
        <div style={{ padding: '20px 0' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            请选择要关联到当前版本 {selectedVersion?.version_number} 的知识库文档（此为按需限定生成上下文的前提）：
          </Text>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="请选择知识库文档..."
            value={selectedKnowledgeIds}
            onChange={setSelectedKnowledgeIds}
            optionFilterProp="children"
            showSearch
          >
            {allKnowledge.map(doc => (
              <Select.Option key={doc.id} value={doc.id}>
                [{doc.category || '默认'}] {doc.title}
              </Select.Option>
            ))}
          </Select>
        </div>
      </Modal>

      <Drawer
        title="AI 生成证据详情"
        open={aiEvidenceVisible}
        onClose={() => setAiEvidenceVisible(false)}
        width={720}
      >
        {aiEvidenceLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}><Spin /></div>
        ) : !selectedAiSession ? (
          <Empty description="暂无会话详情" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="会话ID">{selectedAiSession.session_id}</Descriptions.Item>
              <Descriptions.Item label="模型">{selectedAiSession.model}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getSessionStatusColor(selectedAiSession.status)}>{getSessionStatusLabel(selectedAiSession.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="命中率">{Math.round((selectedAiSession.knowledge_hit_rate || 0) * 100)}%</Descriptions.Item>
              <Descriptions.Item label="生成用例数">{selectedAiSession.total_generated_cases || 0}</Descriptions.Item>
              <Descriptions.Item label="命中用例数">{selectedAiSession.total_hit_cases || 0}</Descriptions.Item>
            </Descriptions>

            <List
              dataSource={selectedAiSession.evidence || []}
              locale={{ emptyText: '暂无证据明细' }}
              renderItem={(item: AIGenerationEvidenceItem) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      <Space wrap>
                        <Text strong>{item.case_title}</Text>
                        <Tag color={item.knowledge_hit_count > 0 ? 'success' : 'default'}>
                          命中 {item.knowledge_hit_count || 0}
                        </Tag>
                        {item.used_explicit_context && <Tag color="blue">显式知识</Tag>}
                        {item.used_rag && <Tag color="purple">RAG</Tag>}
                      </Space>
                      <Text type="secondary">{item.evidence_summary || '暂无摘要'}</Text>
                      <Collapse
                        size="small"
                        items={[
                          {
                            key: `citations-${item.id}`,
                            label: `查看引用明细（${item.citations?.length || 0}）`,
                            children: (
                              <List
                                size="small"
                                dataSource={item.citations || []}
                                locale={{ emptyText: '暂无引用明细' }}
                                renderItem={(citation: any) => (
                                  <List.Item>
                                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                                      <Space wrap>
                                        <Tag color="cyan">{citation.source_type}</Tag>
                                        <Tag>{citation.evidence_type}</Tag>
                                        <Text strong>{citation.doc_title || '未命名知识文档'}</Text>
                                        <Text type="secondary">相似度 {Number(citation.similarity_score || 0).toFixed(2)}</Text>
                                      </Space>
                                      <Text type="secondary">{citation.quote_text || citation.matched_text || '无片段预览'}</Text>
                                    </Space>
                                  </List.Item>
                                )}
                              />
                            )
                          }
                        ]}
                      />
                    </Space>
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}
      </Drawer>

    </div>
  );
};

export default Versions;
