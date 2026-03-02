import React, { useEffect, useState } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Divider,
  Upload,
  Tabs,
  Transfer,
  List,
  Card,
  Avatar,
  Badge,
  Tooltip,
  Empty,
  Col,
  Row
} from 'antd';
import {
  BookOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  UploadOutlined,
  LinkOutlined,
  SearchOutlined,
  ReadOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  FileMarkdownOutlined
} from '@ant-design/icons';
import { aiApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface KnowledgeDoc {
  id: number;
  doc_id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  created_at?: string;
  updated_at?: string;
  similarity?: number;
}

// Mock Data for UI Dev if API fails
const mockDocs: KnowledgeDoc[] = [
  { id: 1, doc_id: 'd1', title: 'Login Authentication Logic', content: 'Detailed logic about how login works... This includes OAuth2 flows and JWT validation steps.', source: 'Wiki', category: 'logic', updated_at: '2024-02-10' },
  { id: 2, doc_id: 'd2', title: 'Payment Gateway Integration', content: 'API specs for Stripe integration... Includes webhooks and signature verification.', source: 'API Docs', category: 'integration', updated_at: '2024-02-09' },
  { id: 3, doc_id: 'd3', title: 'User Roles & Permissions', content: 'RBAC definition table... Admin vs User vs Guest capabilities.', source: 'Product Spec', category: 'security', updated_at: '2024-02-08' },
];

const AiKnowledge: React.FC = () => {
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [linkVisible, setLinkVisible] = useState(false);

  // Search & Filter
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  const [form] = Form.useForm();
  const [reqKeys, setReqKeys] = useState<string[]>([]);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    console.log('Loading documents...');
    try {
      const res = await aiApi.getKnowledgeList();
      setDocuments(res?.data?.documents || res?.data || mockDocs);
      // Extract categories
      const docs = res?.data?.documents || res?.data || mockDocs;
      const cats = Array.from(new Set(docs.map((d: any) => d.category))).filter(Boolean) as string[];
      setCategories(cats);
    } catch {
      setDocuments(mockDocs); // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleLink = () => {
    if (!selectedDoc) return;
    setLinkVisible(true);
    setReqKeys([]);
  };

  const handleDelete = async (id: number) => {
    try {
      await aiApi.deleteKnowledgeDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      if (selectedDoc?.id === id) setSelectedDoc(null);
      message.success('文档删除成功');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '删除失败');
    }
  };

  const handleAddSubmit = async () => {
    try {
      const values = await form.validateFields();
      await aiApi.addKnowledgeDocument(values);
      message.success('文档已提交处理');
      setModalVisible(false);
      form.resetFields();
      setTimeout(loadDocuments, 1000); // give backend a moment to persist
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e?.response?.data?.detail || '添加失败');
    }
  };

  const handleImport = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append('files', file);
    formData.append('category', 'general');
    formData.append('source', 'upload');

    try {
      const res = await aiApi.importKnowledgeFiles(formData);
      message.success(res.message || '导入成功');
      onSuccess?.(res);
      setImportVisible(false);
      loadDocuments();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '导入失败');
      onError?.(e);
    }
  };

  const renderDocList = () => (
    <div style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#ccc' }} />}
          placeholder="Search documents..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ marginBottom: 8 }}
          allowClear
        />
        <Select
          placeholder="Filter by Category"
          allowClear
          style={{ width: '100%' }}
          value={filterCategory}
          onChange={setFilterCategory}
        >
          {categories.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
        </Select>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <List
          dataSource={documents.filter(d =>
            (!searchText || d.title.toLowerCase().includes(searchText.toLowerCase())) &&
            (!filterCategory || d.category === filterCategory)
          )}
          renderItem={item => (
            <div
              className={`hover-card-light ${selectedDoc?.id === item.id ? 'active-card-blue' : ''}`}
              onClick={() => setSelectedDoc(item)}
              style={{
                padding: '12px 16px',
                marginBottom: 8,
                background: selectedDoc?.id === item.id ? '#e6f7ff' : '#fff',
                borderRadius: 8,
                border: selectedDoc?.id === item.id ? '1px solid #1890ff' : '1px solid #f0f0f0',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Avatar
                  shape="square"
                  icon={<FileMarkdownOutlined />}
                  style={{ backgroundColor: selectedDoc?.id === item.id ? '#1890ff' : '#f56a00' }}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <Text strong ellipsis style={{ display: 'block', marginBottom: 4 }}>{item.title}</Text>
                  <Space size={4} wrap>
                    <Tag style={{ margin: 0, fontSize: 10 }}>{item.category}</Tag>
                    <Text type="secondary" style={{ fontSize: 10 }}>{item.source}</Text>
                  </Space>
                </div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );

  const renderDetail = () => {
    if (!selectedDoc) return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
        <div style={{ background: '#f5f5f5', padding: 24, borderRadius: '50%', marginBottom: 16 }}>
          <ReadOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
        </div>
        <Title level={4} type="secondary" style={{ marginBottom: 8 }}>No Document Selected</Title>
        <Text type="secondary">Select a document from the list to view details</Text>
      </div>
    );

    return (
      <div className="fade-in" style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Title level={3} style={{ margin: '0 0 8px 0' }}>{selectedDoc.title}</Title>
            <Space split={<Divider type="vertical" />}>
              <Tag color="blue">{selectedDoc.category}</Tag>
              <Text type="secondary"><CloudUploadOutlined /> {selectedDoc.source}</Text>
              <Text type="secondary">ID: {selectedDoc.doc_id || selectedDoc.id}</Text>
            </Space>
          </div>
          <Space>
            <Tooltip title="Link to Requirements">
              <Button icon={<LinkOutlined />} onClick={handleLink} />
            </Tooltip>
            <Tooltip title="Delete Document">
              <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(selectedDoc.id)} />
            </Tooltip>
          </Space>
        </div>

        <Card title="Content Preview" bordered={false} style={{ background: '#fafafa', marginBottom: 24 }}>
          <Paragraph style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', fontSize: 14, lineHeight: 1.8, color: '#333' }}>
            {selectedDoc.content}
          </Paragraph>
        </Card>

        <Card size="small" title="Metadata">
          <List size="small" split={false}>
            <List.Item style={{ padding: '4px 0' }}><Text type="secondary" style={{ width: 100, display: 'inline-block' }}>Created:</Text> {selectedDoc.created_at || 'N/A'}</List.Item>
            <List.Item style={{ padding: '4px 0' }}><Text type="secondary" style={{ width: 100, display: 'inline-block' }}>Updated:</Text> {selectedDoc.updated_at || 'N/A'}</List.Item>
            <List.Item style={{ padding: '4px 0' }}><Text type="secondary" style={{ width: 100, display: 'inline-block' }}>Similarity:</Text> {selectedDoc.similarity ? `${Math.round(selectedDoc.similarity * 100)}%` : 'N/A'}</List.Item>
          </List>
        </Card>
      </div>
    );
  };

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>RAG 知识库</Title>
          <Text type="secondary">管理用于 AI 测试生成的上下文知识文档</Text>
        </div>
        <Space>
          <Button icon={<CloudUploadOutlined />} onClick={() => setImportVisible(true)}>导入文件</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModalVisible(true); form.resetFields(); }}>添加文档</Button>
        </Space>
      </div>

      <div className="glass-panel" style={{ flex: 1, borderRadius: 16, overflow: 'hidden', background: '#fff', display: 'flex', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

        {/* Left: List */}
        <div style={{ width: 360, background: '#f9f9f9', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
          {renderDocList()}
        </div>

        {/* Right: Answer/Detail */}
        <div style={{ flex: 1, background: '#fff', position: 'relative' }}>
          {renderDetail()}
        </div>

      </div>

      {/* Add Modal */}
      <Modal title="Add Knowledge Document" open={modalVisible} onCancel={() => setModalVisible(false)} onOk={handleAddSubmit} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input placeholder="e.g. Login Specs" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="category" label="Category"><Input placeholder="e.g. Logic" /></Form.Item></Col>
            <Col span={12}><Form.Item name="source" label="Source"><Input placeholder="e.g. Wiki" /></Form.Item></Col>
          </Row>
          <Form.Item name="content" label="Content" rules={[{ required: true }]}><TextArea rows={8} placeholder="Enter document content..." /></Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal title="Import Documents" open={importVisible} onCancel={() => setImportVisible(false)} footer={null}>
        <Upload.Dragger style={{ padding: 40 }} multiple showUploadList={false} customRequest={handleImport}>
          <p className="ant-upload-drag-icon"><ExperimentOutlined style={{ color: '#1890ff' }} /></p>
          <p className="ant-upload-text">Click or drag file to this area to upload</p>
          <p className="ant-upload-hint">Support for .md, .txt, .pdf</p>
        </Upload.Dragger>
      </Modal>

      {/* Link Modal */}
      <Modal title="Link Requirements" open={linkVisible} onCancel={() => setLinkVisible(false)} width={600}>
        <Transfer
          dataSource={[] as any[]}
          render={(item: any) => item.title}
          targetKeys={reqKeys}
          onChange={(tk) => setReqKeys(tk as string[])}
          listStyle={{ width: '100%', height: 300 }}
          titles={['Available', 'Linked']}
        />
        <Empty description="No Requirements Loaded" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 24 }} />
      </Modal>

    </div>
  );
};

export default AiKnowledge;
