import React, { useState, useEffect } from 'react';
import {
    Layout, Typography, Button, Space, Table, Modal, Form, Input, Select,
    message, Tag, Popconfirm, Divider, List, Spin, Transfer, Checkbox, Row, Col
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    AppstoreOutlined, ProfileOutlined, FolderAddOutlined, ArrowRightOutlined, RobotFilled
} from '@ant-design/icons';
import { testSuiteApi, projectApi, testcaseApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Sider, Content } = Layout;

interface TestSuite {
    id: number;
    name: string;
    description: string;
    project_id: number;
    created_at: string;
    testcases: any[];
}

const TestSuites: React.FC = () => {
    // Project state
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);

    // Suite state
    const [suites, setSuites] = useState<TestSuite[]>([]);
    const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
    const [loading, setLoading] = useState(false);

    // Test Case state (for adding to suite)
    const [allTestCases, setAllTestCases] = useState<any[]>([]);

    // Modals
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null);
    const [addTestCasesModalVisible, setAddTestCasesModalVisible] = useState(false);
    const [targetKeys, setTargetKeys] = useState<string[]>([]);
    const [form] = Form.useForm();

    useEffect(() => {
        loadProjects();
    }, []);

    useEffect(() => {
        if (selectedProjectId) {
            loadSuites(selectedProjectId);
            loadAllTestCases(selectedProjectId);
        } else {
            setSuites([]);
            setAllTestCases([]);
            setSelectedSuite(null);
        }
    }, [selectedProjectId]);

    const loadProjects = async () => {
        try {
            const data = await projectApi.getProjects();
            setProjects(data || []);
            if (data && data.length > 0) {
                setSelectedProjectId(data[0].id);
            }
        } catch (e) {
            console.error('Failed to load projects');
        }
    };

    const loadSuites = async (projectId: number) => {
        setLoading(true);
        try {
            const data = await testSuiteApi.getTestSuites(projectId);
            setSuites(data || []);
            if (data && data.length > 0) {
                // Refresh selected suite if exists, otherwise pick first
                setSelectedSuite(prev => {
                    if (!prev) return data[0];
                    const updated = data.find((s: any) => s.id === prev.id);
                    return updated || data[0];
                });
            } else {
                setSelectedSuite(null);
            }
        } catch (e) {
            message.error('加载测试用例集失败');
        } finally {
            setLoading(false);
        }
    };

    const loadAllTestCases = async (projectId: number) => {
        try {
            const data = await testcaseApi.getTestCases(projectId);
            setAllTestCases(data || []);
        } catch (e) {
            console.error('Failed to load test cases');
        }
    };

    const handleCreateSuite = () => {
        setEditingSuite(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEditSuite = (suite: TestSuite) => {
        setEditingSuite(suite);
        form.setFieldsValue({
            name: suite.name,
            description: suite.description
        });
        setModalVisible(true);
    };

    const handleDeleteSuite = async (id: number) => {
        try {
            await testSuiteApi.deleteTestSuite(id);
            message.success('删除成功');
            if (selectedProjectId) loadSuites(selectedProjectId);
            if (selectedSuite?.id === id) setSelectedSuite(null);
        } catch (e) {
            message.error('删除失败');
        }
    };

    const handleSubmitSuite = async () => {
        try {
            const values = await form.validateFields();
            if (!selectedProjectId) return;

            if (editingSuite) {
                await testSuiteApi.updateTestSuite(editingSuite.id, values);
                message.success('更新成功');
            } else {
                await testSuiteApi.createTestSuite(selectedProjectId, values);
                message.success('创建成功');
            }
            setModalVisible(false);
            loadSuites(selectedProjectId);
        } catch (e) {
            message.error('操作失败');
        }
    };

    const showAddTestCasesModal = () => {
        if (!selectedSuite) return;
        // Map already associated test cases to targetKeys
        const existingIds = (selectedSuite.testcases || []).map(tc => tc.id.toString());
        setTargetKeys(existingIds);
        setAddTestCasesModalVisible(true);
    };

    const handleTransferChange = (nextTargetKeys: React.Key[]) => {
        setTargetKeys(nextTargetKeys as string[]);
    };

    const submitAddTestCases = async () => {
        if (!selectedSuite || !selectedProjectId) return;
        try {
            const newIds = targetKeys.map(k => parseInt(k, 10));
            const existingIds = (selectedSuite.testcases || []).map(t => t.id);

            // Calculate what to add and what to remove
            const toAdd = newIds.filter(id => !existingIds.includes(id));
            const toRemove = existingIds.filter(id => !newIds.includes(id));

            if (toAdd.length > 0) {
                await testSuiteApi.addCasesToSuite(selectedSuite.id, toAdd);
            }
            if (toRemove.length > 0) {
                await testSuiteApi.removeCasesFromSuite(selectedSuite.id, toRemove);
            }

            message.success('更新用例成功');
            setAddTestCasesModalVisible(false);
            loadSuites(selectedProjectId);
        } catch (e) {
            message.error('更新用例失败');
        }
    };

    // Render components
    // ... (Further implementation below)

    return (
        <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Title level={2} style={{ margin: 0, fontWeight: 700 }}>测试用例集</Title>
                    <Text type="secondary">管理和组合测试用例，支持AI生成用例归档</Text>
                </div>
                <Space>
                    <Select
                        placeholder="选择项目"
                        style={{ width: 220 }}
                        value={selectedProjectId}
                        onChange={setSelectedProjectId}
                    >
                        {projects.map(p => (
                            <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                        ))}
                    </Select>
                    <Button type="primary" icon={<FolderAddOutlined />} onClick={handleCreateSuite} shape="round" size="large" disabled={!selectedProjectId}>
                        新建用例集
                    </Button>
                </Space>
            </div>

            <Layout className="glass-panel" style={{ flex: 1, borderRadius: 16, overflow: 'hidden', background: 'transparent' }}>
                <Sider width={320} style={{ background: 'rgba(255,255,255,0.4)', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
                    <Spin spinning={loading}>
                        <div style={{ padding: 16 }}>
                            <List
                                dataSource={suites}
                                locale={{ emptyText: '暂无用例集' }}
                                renderItem={suite => (
                                    <div
                                        className="hover-scale"
                                        onClick={() => setSelectedSuite(suite)}
                                        style={{
                                            padding: '16px',
                                            background: selectedSuite?.id === suite.id ? 'rgba(0,122,255,0.1)' : 'rgba(255,255,255,0.6)',
                                            borderRadius: 12,
                                            marginBottom: 12,
                                            cursor: 'pointer',
                                            border: selectedSuite?.id === suite.id ? '1px solid #007AFF' : '1px solid transparent',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <Text strong style={{ fontSize: 16 }}>{suite.name}</Text>
                                            <Tag color="blue">{suite.testcases?.length || 0} 用例</Tag>
                                        </div>
                                        <Text type="secondary" ellipsis style={{ fontSize: 13, display: 'block' }}>
                                            {suite.description || '暂无描述'}
                                        </Text>
                                    </div>
                                )}
                            />
                        </div>
                    </Spin>
                </Sider>

                <Content style={{ padding: 32, background: 'rgba(255,255,255,0.6)', overflowY: 'auto' }}>
                    {selectedSuite ? (
                        <div className="fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                                <div>
                                    <Title level={3} style={{ marginTop: 0 }}>{selectedSuite.name}</Title>
                                    <Paragraph type="secondary" style={{ maxWidth: 600 }}>
                                        {selectedSuite.description || '无详细描述'}
                                    </Paragraph>
                                </div>
                                <Space>
                                    <Button icon={<EditOutlined />} onClick={() => handleEditSuite(selectedSuite)}>编辑信息</Button>
                                    <Popconfirm title="确定删除此用例集吗？" onConfirm={() => handleDeleteSuite(selectedSuite.id)}>
                                        <Button danger icon={<DeleteOutlined />}>删除基线</Button>
                                    </Popconfirm>
                                </Space>
                            </div>

                            <Divider style={{ margin: '16px 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Title level={5} style={{ margin: 0 }}><ProfileOutlined /> 用例列表</Title>
                                <Space>
                                    <Button type="dashed" icon={<PlusOutlined />} onClick={showAddTestCasesModal}>
                                        关联/移除用例
                                    </Button>
                                    <Button type="primary" icon={<RobotFilled />}>
                                        AI自动分析并加入
                                    </Button>
                                </Space>
                            </div>

                            <Table
                                dataSource={selectedSuite.testcases || []}
                                rowKey="id"
                                pagination={{ pageSize: 15 }}
                                size="middle"
                                columns={[
                                    { title: '用例名称', dataIndex: 'name', key: 'name', render: (text) => <Text strong>{text}</Text> },
                                    { title: '协议', dataIndex: 'protocol', key: 'protocol', render: (text) => <Tag color={text === 'http' ? 'green' : text === 'tcp' ? 'blue' : 'purple'}>{text.toUpperCase()}</Tag> },
                                    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
                                ]}
                            />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
                            <AppstoreOutlined style={{ fontSize: 64, marginBottom: 24, opacity: 0.2 }} />
                            <Title level={4} type="secondary">从左侧选择或创建一个用例集</Title>
                        </div>
                    )}
                </Content>
            </Layout>

            {/* Create/Edit Suite Modal */}
            <Modal
                title={editingSuite ? "编辑用例集" : "新建用例集"}
                open={modalVisible}
                onOk={handleSubmitSuite}
                onCancel={() => setModalVisible(false)}
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入用例集名称' }]}>
                        <Input placeholder="输入名称例如 'V2.3 核心回归测试集合'" />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                        <Input.TextArea rows={4} placeholder="描述此集合的用途和包含的范围..." />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Add Cases to Suite Modal */}
            <Modal
                title={`管理用例 - ${selectedSuite?.name}`}
                open={addTestCasesModalVisible}
                onOk={submitAddTestCases}
                onCancel={() => setAddTestCasesModalVisible(false)}
                width={800}
                destroyOnClose
            >
                <Transfer
                    dataSource={allTestCases.map(tc => ({
                        key: tc.id.toString(),
                        title: tc.name,
                        description: tc.description || '',
                        protocol: tc.protocol
                    }))}
                    showSearch
                    listStyle={{ width: 350, height: 400 }}
                    targetKeys={targetKeys}
                    onChange={handleTransferChange}
                    render={item => `${item.title} [${item.protocol.toUpperCase()}]`}
                />
            </Modal>

        </div>
    );
};

export default TestSuites;
