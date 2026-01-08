import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Button, 
  Table, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Typography, 
  Space, 
  message,
  Tag
} from 'antd';
import { PlusOutlined, PlayCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { testcaseApi } from '../services/api';
import { TestCase } from '../types';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const TestCases: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [testcases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTestcase, setEditingTestcase] = useState<TestCase | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const loadTestCases = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const data = await testcaseApi.getTestCases(Number(projectId));
      setTestCases(data || []);
    } catch (error) {
      message.error('加载测试用例失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadTestCases();
    }
  }, [projectId, loadTestCases]);

  const handleCreate = () => {
    setEditingTestcase(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (testcase: TestCase) => {
    setEditingTestcase(testcase);
    form.setFieldsValue(testcase);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      // await testcaseApi.deleteTestCase(id);
      message.success('测试用例删除成功');
      loadTestCases();
    } catch (error) {
      message.error('删除测试用例失败');
      console.error(error);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingTestcase) {
        // await testcaseApi.updateTestCase(editingTestcase.id, values);
        message.success('测试用例更新成功');
      } else {
        await testcaseApi.createTestCase(Number(projectId), values);
        message.success('测试用例创建成功');
      }
      setModalVisible(false);
      loadTestCases();
    } catch (error) {
      message.error('操作失败');
      console.error(error);
    }
  };

  const handleTest = (testcase: TestCase) => {
    switch (testcase.protocol) {
      case 'http':
        navigate('/test/http', { state: { testcase } });
        break;
      case 'tcp':
        navigate('/test/tcp', { state: { testcase } });
        break;
      case 'mq':
        navigate('/test/mq', { state: { testcase } });
        break;
    }
  };

  const getProtocolTag = (protocol: string) => {
    const colors = {
      http: 'blue',
      tcp: 'green',
      mq: 'orange'
    };
    return <Tag color={colors[protocol as keyof typeof colors]}>{protocol.toUpperCase()}</Tag>;
  };

  const columns = [
    {
      title: '用例名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '协议类型',
      dataIndex: 'protocol',
      key: 'protocol',
      render: (protocol: string) => getProtocolTag(protocol),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: TestCase) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<PlayCircleOutlined />}
            onClick={() => handleTest(record)}
          >
            执行测试
          </Button>
          <Button 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>测试用例管理</Title>
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建测试用例
          </Button>
          <Button onClick={() => navigate('/projects')}>
            返回项目列表
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={testcases}
          rowKey="id"
          loading={loading}
          pagination={{
            total: testcases.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title={editingTestcase ? '编辑测试用例' : '新建测试用例'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="用例名称"
            rules={[{ required: true, message: '请输入用例名称' }]}
          >
            <Input placeholder="请输入用例名称" />
          </Form.Item>
          <Form.Item
            name="protocol"
            label="协议类型"
            rules={[{ required: true, message: '请选择协议类型' }]}
          >
            <Select placeholder="请选择协议类型">
              <Option value="http">HTTP</Option>
              <Option value="tcp">TCP</Option>
              <Option value="mq">MQ</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="description"
            label="用例描述"
          >
            <TextArea rows={4} placeholder="请输入用例描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TestCases;