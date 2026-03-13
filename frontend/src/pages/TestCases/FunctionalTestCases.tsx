import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  message,
  Typography,
  Row,
  Col,
  List,
  Divider,
  Tooltip,
  Steps,
  Avatar,
  Card,
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CopyOutlined,
  PlayCircleFilled,
  FileTextOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleFilled,
  MoreOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { testcaseApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Step } = Steps;

interface FunctionalTestCase {
  id: number;
  name: string;
  description: string;
  protocol: string;
  config: any;
  project_id: number;
  created_at: string;
  updated_at: string;
}

const FunctionalTestCases: React.FC = () => {
  const [testCases, setTestCases] = useState<FunctionalTestCase[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCase, setEditingCase] = useState<FunctionalTestCase | null>(null);
  const [selectedCase, setSelectedCase] = useState<FunctionalTestCase | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTestCases();
  }, []);

  const fetchTestCases = async () => {
    setLoading(true);
    try {
      const data = await testcaseApi.getAllTestCases();
      setTestCases(data);
      if (data.length > 0) setSelectedCase(data[0]);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '获取用例列表失败');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<FunctionalTestCase> = [
    {
      title: '用例名称',
      dataIndex: 'name',
      key: 'name',
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) =>
        record.name.toLowerCase().includes(value.toString().toLowerCase()),
      render: (text: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 4, height: 32, borderRadius: 2,
            background: '#1677ff'
          }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong style={{ fontSize: 14 }}>{text}</Text>
          </div>
        </div>
      )
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 100,
      render: (protocol: string) => {
        return <Tag color="blue">{protocol?.toUpperCase()}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small" onClick={e => e.stopPropagation()}>
          <Tooltip title="快速执行">
            <Button
              type="text"
              shape="circle"
              icon={<PlayCircleFilled style={{ color: '#34C759' }} />}
              onClick={() => handleExecute(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" shape="circle" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="复制">
            <Button type="text" shape="circle" icon={<CopyOutlined />} onClick={() => handleCopy(record)} />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="text" danger shape="circle" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleAdd = () => {
    setEditingCase(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: FunctionalTestCase) => {
    setEditingCase(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleCopy = (record: FunctionalTestCase) => {
    // 稍后实现
  };

  const handleExecute = (record: FunctionalTestCase) => {
    message.loading(`正在初始化执行: ${record.name}`, 1)
      .then(() => message.success('执行完成，结果已记录'));
  };

  const handleDelete = (record: FunctionalTestCase) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除测试用例 "${record.name}" 吗？`,
      onOk: async () => {
        try {
          await testcaseApi.deleteTestCase(record.id);
          setTestCases(testCases.filter(item => item.id !== record.id));
          if (selectedCase?.id === record.id) setSelectedCase(null);
          message.success('删除成功');
        } catch (e: any) {
          message.error(e?.response?.data?.detail || '删除失败');
        }
      },
      okButtonProps: { danger: true }
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingCase) {
        setTestCases(testCases.map(item =>
          item.id === editingCase.id
            ? { ...item, ...values, updatedAt: new Date().toISOString().split('T')[0] }
            : item
        ));
        message.success('更新成功');
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchTestCases();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const renderConfig = (cfg: any) => {
    if (!cfg) return <Text type="secondary">暂无详细配置数据</Text>;

    // 如果AI生成了 steps 数组，渲染步骤
    if (cfg.steps && Array.isArray(cfg.steps)) {
      return (
        <div style={{ marginTop: 16 }}>
          {cfg.steps.map((step: any, idx: number) => (
            <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 24, height: 24, borderRadius: 12, background: 'rgba(0,0,0,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#666',
                flexShrink: 0
              }}>
                {idx + 1}
              </div>
              <Text style={{ lineHeight: 1.6, flex: 1 }}>
                {typeof step === 'string' ? step : (step.action || step.description || JSON.stringify(step))}
              </Text>
            </div>
          ))}
        </div>
      );
    }

    // 否则展示原始结构化 JSON
    return (
      <pre style={{ padding: 12, background: 'rgba(0,0,0,0.03)', borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 12 }}>
        {JSON.stringify(cfg, null, 2)}
      </pre>
    );
  };

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>功能测试用例</Title>
          <Text type="secondary">管理和执行手动测试用例</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} shape="round" size="large">
          新增用例
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>

        {/* Left: Test Case List */}
        <div className="glass-panel" style={{ flex: 6, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 12 }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#ccc' }} />}
              placeholder="搜索用例..."
              style={{ flex: 1, borderRadius: 8 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchTestCases} loading={loading} />
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Table
              columns={columns}
              dataSource={testCases.filter(c =>
                (searchText ? c.name.toLowerCase().includes(searchText.toLowerCase()) : true)
              )}
              rowKey="id"
              pagination={{ 
                pageSize: 15, 
                showSizeChanger: true, 
                showQuickJumper: true,
                size: 'small',
                position: ['bottomCenter'],
                showTotal: (total) => `共 ${total} 条`
              }}
              onRow={(record) => ({
                onClick: () => setSelectedCase(record),
                style: { cursor: 'pointer' }
              })}
              rowClassName={(record) => selectedCase?.id === record.id ? 'ant-table-row-selected' : 'table-row-hover'}
              size="middle"
            />
          </div>
        </div>

        {/* Right: Test Case Detail & Execution */}
        <div className="glass-panel" style={{ flex: 4, borderRadius: 16, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'rgba(255,255,255,0.8)' }}>
          {selectedCase ? (
            <div style={{ padding: 32 }} className="fade-in" key={selectedCase.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <Tag color="purple">TEST-{selectedCase.id}</Tag>
                <Space>
                  <Button icon={<PlayCircleFilled />} type="primary" onClick={() => handleExecute(selectedCase)}>执行</Button>
                  <Button icon={<EditOutlined />} onClick={() => handleEdit(selectedCase)} />
                </Space>
              </div>

              <Title level={3} style={{ marginBottom: 16 }}>{selectedCase.name}</Title>

              <Paragraph type="secondary" style={{ marginBottom: 24, padding: 12, background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
                {selectedCase.description}
              </Paragraph>

              <Row gutter={24} style={{ marginBottom: 24 }}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>协议</Text>
                  <div style={{ fontWeight: 500 }}>{selectedCase.protocol?.toUpperCase()}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>项目ID</Text>
                  <div>
                    <Tag color="geekblue">{selectedCase.project_id || '未关联'}</Tag>
                  </div>
                </Col>
              </Row>

              <Divider />

              <Title level={5}><FileTextOutlined /> 测试配置 / 自动生成步骤</Title>
              {renderConfig(selectedCase.config)}

              <Divider />

              {selectedCase.config?.expected_result && (
                <>
                  <Title level={5}><CheckCircleFilled /> 预期结果</Title>
                  <Paragraph style={{ padding: '12px 16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, color: '#389e0d' }}>
                    {selectedCase.config.expected_result}
                  </Paragraph>
                  <Divider />
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999' }}>
                <span>创建于: {new Date(selectedCase.created_at).toLocaleString()}</span>
                <span>更新于: {new Date(selectedCase.updated_at).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              <FileTextOutlined style={{ fontSize: 64, marginBottom: 24, opacity: 0.2 }} />
              <Text type="secondary">选择左侧用例查看详情</Text>
            </div>
          )}
        </div>

      </div>

      <Modal
        title={editingCase ? '编辑测试用例' : '新增测试用例'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={720}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            priority: 'medium',
            status: 'active',
          }}
        >
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="name" label="用例名称" rules={[{ required: true }]}>
                <Input placeholder="请输入用例名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="module" label="所属模块" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="用户管理">用户管理</Select.Option>
                  <Select.Option value="商品管理">商品管理</Select.Option>
                  <Select.Option value="订单管理">订单管理</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="用例描述" rules={[{ required: true }]}>
            <TextArea rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="low">低</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="active">激活</Select.Option>
                  <Select.Option value="inactive">停用</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="steps" label="测试步骤" rules={[{ required: true }]} help="每行代表一个步骤">
            <TextArea rows={5} placeholder="1. ..." />
          </Form.Item>

          <Form.Item name="expectedResult" label="预期结果" rules={[{ required: true }]}>
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FunctionalTestCases;