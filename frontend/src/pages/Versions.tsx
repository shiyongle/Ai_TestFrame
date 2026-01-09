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
  Tabs,
  Tooltip,
  Transfer,
  List,
  Avatar,
  Drawer,
  Divider,
  Badge,
  DatePicker,
  Empty
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined,
  CopyOutlined,
  LinkOutlined,
  FileTextOutlined,
  UserOutlined,
  RobotOutlined,
  BookOutlined,
  EyeOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import moment from 'moment';
import { versionApi, requirementApi } from '../services/api';

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
  requirements?: Requirement[];
}

interface Requirement {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  type: string;
  project_id: number;
  assigned_to: string;
  created_at: string;
}

const Versions: React.FC = () => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingVersion, setEditingVersion] = useState<Version | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState('list');
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedTestCases, setGeneratedTestCases] = useState<any[]>([]);

  useEffect(() => {
    loadVersions();
    loadRequirements();
  }, []);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await versionApi.getVersions();
      setVersions(data || []);
    } catch (error) {
      message.error('加载版本列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequirements = async () => {
    try {
      const data = await requirementApi.getRequirements();
      setRequirements(data || []);
    } catch (error) {
      console.error('加载需求列表失败:', error);
    }
  };

  const columns: ColumnsType<Version> = [
    {
      title: '版本',
      dataIndex: 'version_number',
      key: 'version_number',
      render: (text: string, record) => (
        <div className="cell-primary">
          <Text className="cell-title">
            <BookOutlined style={{ marginRight: 8, color: '#0071e3' }} />
            {text}
          </Text>
          <Text className="cell-subtitle">{record.description || '暂无描述'}</Text>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          draft: { color: 'default', text: '草稿' },
          released: { color: 'success', text: '已发布' },
          archived: { color: 'warning', text: '已归档' }
        };
        const config = statusConfig[status as keyof typeof statusConfig];
        return <Tag color={config.color} className="tag-pill">{config.text}</Tag>;
      },
      filters: [
        { text: '草稿', value: 'draft' },
        { text: '已发布', value: 'released' },
        { text: '已归档', value: 'archived' },
      ],
      filteredValue: filterStatus ? [filterStatus] : null,
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '关联需求数',
      key: 'requirements_count',
      render: (_, record) => (
        <Badge count={record.requirements?.length || 0} showZero>
          <Tag color="blue" className="tag-pill">需求</Tag>
        </Badge>
      ),
    },
    {
      title: '发布日期',
      dataIndex: 'release_date',
      key: 'release_date',
      render: (date: string) => date ? moment(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      render: (text: string) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <Text>{text}</Text>
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => moment(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle" className="row-actions">
          <Tooltip title="查看详情">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handleView(record)}
            />
          </Tooltip>
          <Tooltip title="关联需求">
            <Button 
              type="text" 
              icon={<LinkOutlined />} 
              onClick={() => handleLinkRequirements(record)}
            />
          </Tooltip>
          <Tooltip title="生成测试用例">
            <Button 
              type="text" 
              icon={<RobotOutlined />} 
              onClick={() => handleGenerateTestCases(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => {}}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleAdd = () => {
    setEditingVersion(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Version) => {
    setEditingVersion(record);
    form.setFieldsValue({
      ...record,
      release_date: record.release_date ? moment(record.release_date) : undefined
    });
    setModalVisible(true);
  };

  const handleView = (record: Version) => {
    setSelectedVersion(record);
    setDrawerVisible(true);
  };

  const handleDelete = (record: Version) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除版本 "${record.version_number}" 吗？`,
      onOk: async () => {
        try {
          await versionApi.deleteVersion(record.id);
          message.success('删除成功');
          loadVersions();
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败，请重试');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const formattedData = {
        version_number: values.version_number,
        description: values.description,
        changes: values.changes || {},
        status: values.status || 'draft',
        release_date: values.release_date ? values.release_date.toDate() : null,
        created_by: values.created_by
      };
      
      if (editingVersion) {
        await versionApi.updateVersion(editingVersion.id, formattedData);
        message.success('更新成功');
      } else {
        await versionApi.createVersion(formattedData);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      form.resetFields();
      loadVersions();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败，请重试');
    }
  };

  const handleLinkRequirements = (record: Version) => {
    setSelectedVersion(record);
    setLinkModalVisible(true);
    // 设置已关联的需求
    const linkedRequirementIds = record.requirements?.map((req: Requirement) => req.id.toString()) || [];
    setTargetKeys(linkedRequirementIds);
  };

  const handleTransferChange = (targetKeys: React.Key[]) => {
    setTargetKeys(targetKeys as string[]);
  };

  const handleSaveLinkRequirements = async () => {
    if (!selectedVersion) return;

    try {
      await versionApi.addRequirementsToVersion(selectedVersion.id, targetKeys.map(id => parseInt(id)));
      message.success('需求关联成功');
      setLinkModalVisible(false);
      loadVersions();
    } catch (error) {
      console.error('关联失败:', error);
      message.error('关联失败，请重试');
    }
  };

  const handleGenerateTestCases = async (record: Version) => {
    setSelectedVersion(record);
    setGenerateModalVisible(true);
    setGeneratedTestCases([]);
  };

  const handleGenerate = async (model: string) => {
    if (!selectedVersion) return;

    setGenerating(true);
    try {
      const response = await versionApi.generateTestCases(selectedVersion.id, model);
      
      if (response.generated_count > 0) {
        setGeneratedTestCases(response.testcases);
        message.success(`成功生成 ${response.generated_count} 个测试用例`);
      } else {
        message.warning('没有生成任何测试用例');
      }
    } catch (error) {
      console.error('生成测试用例失败:', error);
      message.error('生成测试用例失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  

  return (
    <div className="page-shell">
      <div className="page-toolbar">
        <div className="page-title">
          <Title level={2} style={{ margin: 0 }}>版本管理</Title>
          <span className="page-subtitle">汇总需求并管理版本发布节奏</span>
        </div>
        <Space>
          <Button>导出</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建版本
          </Button>
        </Space>
      </div>
      
      <Tabs className="mac-tabs" activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="版本列表" key="list">
          <div className="split-layout">
            <div className="panel">
              <div className="panel-body">
                <div className="filter-bar">
                  <Space wrap>
                    <Input
                      placeholder="搜索版本号或描述"
                      prefix={<SearchOutlined />}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      style={{ width: 220 }}
                    />
                    <Select
                      placeholder="选择状态"
                      style={{ width: 160 }}
                      allowClear
                      value={filterStatus}
                      onChange={setFilterStatus}
                    >
                      <Select.Option value="draft">草稿</Select.Option>
                      <Select.Option value="released">已发布</Select.Option>
                      <Select.Option value="archived">已归档</Select.Option>
                    </Select>
                  </Space>
                  <Space>
                    <Button>重置</Button>
                  </Space>
                </div>

                <Table
                  columns={columns}
                  dataSource={versions.filter(version => 
                    (searchText ? version.version_number.toLowerCase().includes(searchText.toLowerCase()) || 
                               version.description?.toLowerCase().includes(searchText.toLowerCase()) : true) &&
                    (filterStatus ? version.status === filterStatus : true)
                  )}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    total: versions.length,
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条记录`,
                  }}
                  onRow={(record) => ({
                    onClick: () => setSelectedVersion(record),
                  })}
                  rowClassName={(record) =>
                    selectedVersion?.id === record.id ? 'ant-table-row-selected' : ''
                  }
                />
              </div>
            </div>

            <div className="panel inspector-panel">
              <div className="panel-header">
                <Text strong>版本概览</Text>
              </div>
              <div className="panel-body">
                {selectedVersion ? (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Space>
                      <BookOutlined style={{ color: '#0071e3' }} />
                      <Text strong>{selectedVersion.version_number}</Text>
                    </Space>
                    <Text type="secondary">{selectedVersion.description || '暂无描述'}</Text>
                    <Tag color={selectedVersion.status === 'released' ? 'success' : selectedVersion.status === 'archived' ? 'warning' : 'default'}>
                      {selectedVersion.status === 'released' ? '已发布' : selectedVersion.status === 'archived' ? '已归档' : '草稿'}
                    </Tag>
                    <Divider style={{ margin: '8px 0' }} />
                    <Space direction="vertical" size={6}>
                      <Text type="secondary">发布日期</Text>
                      <Text>{selectedVersion.release_date ? moment(selectedVersion.release_date).format('YYYY-MM-DD') : '未设置'}</Text>
                      <Text type="secondary">关联需求</Text>
                      <Text>{selectedVersion.requirements?.length || 0} 个</Text>
                    </Space>
                    <Divider style={{ margin: '8px 0' }} />
                    <Button type="primary" block onClick={() => handleView(selectedVersion)}>
                      查看详情
                    </Button>
                    <Button block onClick={() => handleLinkRequirements(selectedVersion)}>
                      关联需求
                    </Button>
                    <Button block onClick={() => handleGenerateTestCases(selectedVersion)}>
                      生成测试用例
                    </Button>
                    <Button block onClick={() => handleEdit(selectedVersion)}>
                      编辑版本
                    </Button>
                  </Space>
                ) : (
                  <Text type="secondary">选择一个版本以查看详情</Text>
                )}
              </div>
            </div>
          </div>
        </TabPane>
        
        <TabPane tab="版本统计" key="statistics">
          <div className="panel">
            <div className="panel-body">
              <Empty 
                description="版本统计功能开发中..."
                style={{ padding: '40px 0' }}
              />
            </div>
          </div>
        </TabPane>
      </Tabs>

      {/* 新建/编辑版本弹窗 */}
      <Modal
        title={editingVersion ? '编辑版本' : '新建版本'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: 'draft'
          }}
        >
          <Form.Item
            name="version_number"
            label="版本号"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input placeholder="请输入版本号，如：v1.0.0" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="版本描述"
            rules={[{ required: true, message: '请输入版本描述' }]}
          >
            <TextArea rows={3} placeholder="请输入版本描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select placeholder="请选择状态">
                  <Select.Option value="draft">草稿</Select.Option>
                  <Select.Option value="released">已发布</Select.Option>
                  <Select.Option value="archived">已归档</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="release_date"
                label="发布日期"
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择发布日期" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="created_by"
            label="创建人"
            rules={[{ required: true, message: '请输入创建人' }]}
          >
            <Input placeholder="请输入创建人" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 关联需求弹窗 */}
      <Modal
        title="关联需求"
        open={linkModalVisible}
        onOk={handleSaveLinkRequirements}
        onCancel={() => setLinkModalVisible(false)}
        width={1000}
        okText="保存关联"
        cancelText="取消"
      >
        <Transfer
          dataSource={requirements.map(req => ({
            key: req.id.toString(),
            title: req.title,
            description: `${req.description} | ${req.priority} | ${req.status}`
          }))}
          targetKeys={targetKeys}
          onChange={handleTransferChange}
          render={item => (
            <List.Item style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
              <List.Item.Meta
                avatar={<Avatar icon={<FileTextOutlined />} />}
                title={item.title}
                description={
                  <Space direction="vertical" size="small">
                    <Text type="secondary">{item.description.split(' | ')[0]}</Text>
                    <Space>
                      <Tag color="blue">{item.description.split(' | ')[1]}</Tag>
                      <Tag color="green">{item.description.split(' | ')[2]}</Tag>
                    </Space>
                  </Space>
                }
              />
            </List.Item>
          )}
          listStyle={{
            width: 450,
            height: 400,
          }}
          titles={['可用需求', '已选择的需求']}
          showSearch
        />
      </Modal>

      {/* 生成测试用例弹窗 */}
      <Modal
        title="生成测试用例"
        open={generateModalVisible}
        onCancel={() => setGenerateModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setGenerateModalVisible(false)}>
            取消
          </Button>,
          <Button key="glm" onClick={() => handleGenerate('glm-4.6')} loading={generating}>
            GLM-4.6 生成
          </Button>,
          <Button key="tongyi" onClick={() => handleGenerate('tongyi')} loading={generating}>
            通义千问生成
          </Button>,
          <Button key="deepseek" onClick={() => handleGenerate('deepseek')} loading={generating}>
            DeepSeek生成
          </Button>,
          <Button key="gpt4" type="primary" onClick={() => handleGenerate('gpt-4')} loading={generating}>
            GPT-4 生成
          </Button>,
        ]}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>选择AI模型为版本关联的需求生成测试用例：</Text>
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {selectedVersion?.requirements?.length || 0} 个需求
          </Tag>
        </div>

        {generatedTestCases.length > 0 && (
          <div>
            <Title level={5}>生成的测试用例：</Title>
            <List
              dataSource={generatedTestCases}
              renderItem={(item, index) => (
                <List.Item key={index}>
                  <List.Item.Meta
                    avatar={<Avatar icon={<FileTextOutlined />} />}
                    title={item.requirement_title}
                    description={
                      <Space direction="vertical" size="small">
                        <Text type="secondary">{item.testcase.description}</Text>
                        <Space>
                          <Tag color="blue">{item.testcase.priority}</Tag>
                          <Tag color="green">步骤数: {item.testcase.test_steps?.length || 0}</Tag>
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </Modal>

      {/* 版本详情抽屉 */}
      <Drawer
        title={selectedVersion?.version_number}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={800}
      >
        {selectedVersion && (
          <div>
            <Paragraph>{selectedVersion.description}</Paragraph>
            
            <Divider orientation="left">基本信息</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>状态： </Text>
                <Tag color={
                  selectedVersion.status === 'draft' ? 'default' : 
                  selectedVersion.status === 'released' ? 'success' : 'warning'
                }>
                  {selectedVersion.status === 'draft' ? '草稿' : 
                   selectedVersion.status === 'released' ? '已发布' : '已归档'}
                </Tag>
              </Col>
              <Col span={12}>
                <Text strong>发布日期： </Text>
                <Text>{selectedVersion.release_date ? moment(selectedVersion.release_date).format('YYYY-MM-DD') : '未设置'}</Text>
              </Col>
            </Row>
            
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Text strong>创建人： </Text>
                <Text>{selectedVersion.created_by}</Text>
              </Col>
              <Col span={12}>
                <Text strong>创建时间： </Text>
                <Text>{moment(selectedVersion.created_at).format('YYYY-MM-DD HH:mm')}</Text>
              </Col>
            </Row>

            <Divider orientation="left">关联需求</Divider>
            {selectedVersion.requirements && selectedVersion.requirements.length > 0 ? (
              <List
                dataSource={selectedVersion.requirements}
                renderItem={(req: Requirement) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar icon={<FileTextOutlined />} />}
                      title={req.title}
                      description={
                        <Space>
                          <Tag color="blue">{req.priority}</Tag>
                          <Tag color="green">{req.status}</Tag>
                          <Tag color="orange">{req.type}</Tag>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无关联需求" />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Versions;
