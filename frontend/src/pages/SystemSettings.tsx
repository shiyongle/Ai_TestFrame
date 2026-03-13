import React, { useState, useEffect } from 'react';
import {
    Card,
    Form,
    Input,
    Button,
    message,
    Typography,
    Tabs,
    Space,
    Divider,
    Alert
} from 'antd';
import {
    SettingOutlined,
    SaveOutlined,
    RobotOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';
import { systemApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const SystemSettings: React.FC = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const res = await systemApi.getSettings('llm');
            // res returns { "OPENAI_API_KEY": { value: "...", description: "..." }, ... }
            const initValues: any = {};
            Object.keys(res).forEach(key => {
                initValues[key] = res[key].value;
            });
            form.setFieldsValue(initValues);
        } catch (error) {
            message.error('加载系统配置失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAIConfig = async (values: any) => {
        setLoading(true);
        try {
            const settingsPayload = Object.keys(values).map(key => ({
                setting_key: key,
                setting_value: values[key] || '',
                description: getAIDescription(key)
            }));

            await systemApi.updateSettings('llm', { settings: settingsPayload });
            message.success('大模型配置保存成功');
            loadSettings();
        } catch (error) {
            message.error('保存失败');
        } finally {
            setLoading(false);
        }
    };

    // 映射英文Key和帮助说明
    const getAIDescription = (key: string) => {
        const map: any = {
            'OPENAI_API_KEY': 'OpenAI (GPT-4) 官方或代理 API Key',
            'OPENAI_BASE_URL': 'OpenAI 接口地址 (覆盖默认的 api.openai.com/v1)',
            'GLM_API_KEY': '智谱AI (GLM-4) 开发者 API Key',
            'GLM_BASE_URL': '智谱AI 接口地址 (支持覆盖代理)',
            'TONGYI_API_KEY': '阿里云百炼 (通义千问) API Key',
            'TONGYI_BASE_URL': '通义千问 接口地址 (支持覆盖代理)',
            'DEEPSEEK_API_KEY': 'DeepSeek API Key',
            'DEEPSEEK_BASE_URL': 'DeepSeek 接口地址 (支持覆盖代理)',
            'SILICONFLOW_API_KEY': '硅基流动 (Siliconflow) API Key',
            'SILICONFLOW_BASE_URL': '硅基流动 接口地址',
            'SILICONFLOW_CHAT_MODEL': '硅基流动 对话模型名称',
        };
        return map[key] || '';
    };

    return (
        <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <SettingOutlined style={{ fontSize: 28, color: '#1890ff' }} />
                <div>
                    <Title level={2} style={{ margin: 0 }}>系统设置</Title>
                    <Text type="secondary">管理系统全局参数与第三方凭证</Text>
                </div>
            </div>

            <Card bordered={false} className="glass-panel" style={{ borderRadius: 16 }}>
                <Tabs defaultActiveKey="ai" tabPosition="left" style={{ minHeight: 600 }}>

                    <TabPane
                        tab={<span><RobotOutlined /> AI 大模型配置</span>}
                        key="ai"
                    >
                        <div style={{ padding: '0 24px' }}>
                            <Title level={4}><SafetyCertificateOutlined /> LLM API 凭证管理</Title>
                            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
                                在这里配置各类商业大模型的通讯凭证。系统支持热更新，保存后即刻生效，无需重启后端服务。如果留空，系统将尝试从后端的 <code>.env</code> 文件读取。
                            </Paragraph>

                            <Alert
                                message="安全提示"
                                description="您的 API Key 将被明文持久化储存于系统数据库内，请确保您的数据库和内网环境安全可靠。"
                                type="warning"
                                showIcon
                                style={{ marginBottom: 32, borderRadius: 8 }}
                            />

                            <Form
                                form={form}
                                layout="vertical"
                                onFinish={handleSaveAIConfig}
                                initialValues={{
                                    OPENAI_BASE_URL: 'https://api.openai.com/v1',
                                    GLM_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
                                    DEEPSEEK_BASE_URL: 'https://api.deepseek.com/v1',
                                    TONGYI_BASE_URL: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                                    SILICONFLOW_BASE_URL: 'https://api.siliconflow.cn/v1',
                                    SILICONFLOW_CHAT_MODEL: 'Qwen/Qwen2.5-7B-Instruct'
                                }}
                            >
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                                    {/* OpenAI Card */}
                                    <Card size="small" title="OpenAI" className="glass-panel" style={{ borderRadius: 12 }}>
                                        <Form.Item label="API Key" name="OPENAI_API_KEY" tooltip="以 sk- 开头的接口凭证">
                                            <Input.Password placeholder="sk-..." />
                                        </Form.Item>
                                        <Form.Item label="Base URL" name="OPENAI_BASE_URL" tooltip="用于配置国内API代理地址">
                                            <Input placeholder="https://api.openai.com/v1" />
                                        </Form.Item>
                                    </Card>

                                    {/* DeepSeek Card */}
                                    <Card size="small" title="DeepSeek" className="glass-panel" style={{ borderRadius: 12 }}>
                                        <Form.Item label="API Key" name="DEEPSEEK_API_KEY">
                                            <Input.Password placeholder="DeepSeek API Key" />
                                        </Form.Item>
                                        <Form.Item label="Base URL" name="DEEPSEEK_BASE_URL" tooltip="支持替换为代理地址">
                                            <Input placeholder="https://api.deepseek.com/v1" />
                                        </Form.Item>
                                    </Card>

                                    {/* GLM Card */}
                                    <Card size="small" title="智谱清言 (GLM)" className="glass-panel" style={{ borderRadius: 12 }}>
                                        <Form.Item label="API Key" name="GLM_API_KEY">
                                            <Input.Password placeholder="智谱大模型开放平台 API Key" />
                                        </Form.Item>
                                        <Form.Item label="Base URL" name="GLM_BASE_URL">
                                            <Input placeholder="https://open.bigmodel.cn/api/paas/v4" />
                                        </Form.Item>
                                    </Card>

                                    {/* Tongyi Card */}
                                    <Card size="small" title="通义千问 (Qwen)" className="glass-panel" style={{ borderRadius: 12 }}>
                                        <Form.Item label="API Key" name="TONGYI_API_KEY">
                                            <Input.Password placeholder="阿里云百炼 API Key" />
                                        </Form.Item>
                                        <Form.Item label="Base URL" name="TONGYI_BASE_URL">
                                            <Input placeholder="https://dashscope.aliyuncs.com..." />
                                        </Form.Item>
                                    </Card>

                                    {/* Siliconflow Card */}
                                    <Card size="small" title="硅基流动 (Siliconflow)" className="glass-panel" style={{ borderRadius: 12 }}>
                                        <Form.Item label="API Key" name="SILICONFLOW_API_KEY">
                                            <Input.Password placeholder="硅基流动平台 API Key" />
                                        </Form.Item>
                                        <Form.Item label="Base URL" name="SILICONFLOW_BASE_URL">
                                            <Input placeholder="https://api.siliconflow.cn/v1" />
                                        </Form.Item>
                                        <Form.Item label="对话模型" name="SILICONFLOW_CHAT_MODEL" tooltip="用于对话和生成的模型名称，如 Qwen/Qwen2.5-7B-Instruct">
                                            <Input placeholder="Qwen/Qwen2.5-7B-Instruct" />
                                        </Form.Item>
                                    </Card>
                                </div>

                                <Divider />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large" style={{ minWidth: 160, borderRadius: 8 }}>
                                        保存所有配置
                                    </Button>
                                </div>
                            </Form>
                        </div>
                    </TabPane>

                </Tabs>
            </Card>
        </div>
    );
};

export default SystemSettings;
