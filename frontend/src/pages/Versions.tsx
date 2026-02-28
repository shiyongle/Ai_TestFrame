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
  Timeline,
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
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
  RocketOutlined,
  BranchesOutlined,
  HistoryOutlined,
  BugOutlined
} from '@ant-design/icons';
import { versionApi, requirementApi, aiApi } from '../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface Version {
  id: number;
  version_number: string;
  description: string;
  changes: any;
  status: string;
  release_date: string;
  created_at: string;
  created_by: string;
  requirements?: any[];
}

const Versions: React.FC = () => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);

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
  const [generatedTestCases, setGeneratedTestCases] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedReqIds, setSelectedReqIds] = useState<number[]>([]);

  const [linkKnowledgeVisible, setLinkKnowledgeVisible] = useState(false);
  const [allKnowledge, setAllKnowledge] = useState<any[]>([]);
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<number[]>([]);

  useEffect(() => {
    loadVersions();
    loadRequirements();
    loadKnowledge();
  }, []);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await versionApi.getVersions();
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
          loadVersions();
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
      loadVersions(); // Refresh the list
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
      };

      if (editingVersion) {
        await versionApi.updateVersion(editingVersion.id, payload);
        message.success('更新成功');
      } else {
        await versionApi.createVersion(payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadVersions();
    } catch (e) { message.error('操作失败'); }
  };

  const handleGenerateTestCases = () => {
    setGenerateModalVisible(true);
    setGeneratedTestCases([]);
  };

  const handleGenerate = async (model: string) => {
    if (!selectedVersion) return;
    setGenerating(true);
    try {
      const res = await versionApi.generateTestCases(selectedVersion.id, model);
      if (res.generated_count > 0) {
        setGeneratedTestCases(res.testcases);
        message.success(`已生成 ${res.generated_count} 个用例`);
      } else {
        message.warning('未生成用例');
      }
    } catch (e) { message.error('生成失败'); }
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

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>版本管理</Title>
          <Text type="secondary">版本发布时间轴与变更追踪</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} shape="round" size="large">
          新建版本
        </Button>
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
                  <Text type="secondary" style={{ fontSize: 16 }}>
                    发布于 {selectedVersion.release_date ? dayjs(selectedVersion.release_date).format('YYYY年MM月DD日') : '待定'}
                  </Text>
                </div>
                <Space>
                  <Button icon={<EditOutlined />} onClick={() => handleEdit(selectedVersion)}>编辑</Button>
                  <Button icon={<RobotFilled />} onClick={handleGenerateTestCases}>AI生成用例</Button>
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

              {/* Associated Requirements */}
              <div>
                <Title level={4}><FileTextOutlined /> 关联需求</Title>
                <List
                  dataSource={selectedVersion.requirements || []}
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar style={{ backgroundColor: '#87d068' }} icon={<UserOutlined />} />}
                        title={item.title}
                        description={item.description}
                      />
                      <Tag color="blue">{item.priority}</Tag>
                    </List.Item>
                  )}
                  locale={{ emptyText: '暂无关联需求' }}
                />
                <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 16 }} onClick={handleOpenLinkModal}>关联更多需求</Button>
                <Button type="dashed" block icon={<FileTextOutlined />} style={{ marginTop: 8 }} onClick={handleOpenKnowledgeModal}>绑定 RAG 知识库</Button>
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
          <Button size="large" icon={<RobotFilled />} onClick={() => handleGenerate('glm-4')} loading={generating}>使用 GLM-4 生成</Button>
          <Button size="large" icon={<RobotFilled />} onClick={() => handleGenerate('gpt-4')} loading={generating}>使用 GPT-4 生成</Button>
          <Button size="large" icon={<RobotFilled />} onClick={() => handleGenerate('deepseek')} loading={generating}>使用 DeepSeek 生成</Button>
        </div>
        {generatedTestCases.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <Text type="success"><CheckCircleFilled /> 生成成功！请前往测试用例库查看。</Text>
          </div>
        )}
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

    </div>
  );
};

export default Versions;
