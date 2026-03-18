import React, { useState, useEffect } from 'react';
import {
    Card,
    Form,
    Input,
    Button,
    message,
    Typography,
    Tabs,
    Divider,
    Alert,
    Switch
} from 'antd';
import {
    SettingOutlined,
    SaveOutlined,
    RobotOutlined,
    SafetyCertificateOutlined,
    NotificationOutlined
} from '@ant-design/icons';
import { systemApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SystemSettings: React.FC = () => {
    const [aiForm] = Form.useForm();
    const [webhookForm] = Form.useForm();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const [llmRes, webhookRes] = await Promise.all([
                systemApi.getSettings('llm'),
                systemApi.getSettings('webhook')
            ]);

            const llmValues: any = {};
            Object.keys(llmRes || {}).forEach(key => {
                llmValues[key] = llmRes[key].value;
            });

            const webhookValues: any = {};
            Object.keys(webhookRes || {}).forEach(key => {
                const rawValue = webhookRes[key].value;
                webhookValues[key] = rawValue === 'true' ? true : rawValue === 'false' ? false : rawValue;
            });

            aiForm.setFieldsValue(llmValues);
            webhookForm.setFieldsValue(webhookValues);
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

    const handleSaveWebhookConfig = async (values: any) => {
        setLoading(true);
        try {
            const settingsPayload = Object.keys(values).map(key => ({
                setting_key: key,
                setting_value: typeof values[key] === 'boolean' ? String(values[key]) : (values[key] || ''),
                description: getWebhookDescription(key)
            }));

            await systemApi.updateSettings('webhook', { settings: settingsPayload });
            message.success('Webhook 配置保存成功');
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
            'NEWAPI_API_KEY': 'New-API 平台 API Key (OpenAI Compatible)',
            'NEWAPI_BASE_URL': 'New-API 接口地址 (通常以 /v1 结尾)',
            'NEWAPI_CHAT_MODEL': 'New-API 默认对话模型名称',
        };
        return map[key] || '';
    };

    const getWebhookDescription = (key: string) => {
        const map: any = {
            'WEBHOOK_DEFAULT_PROVIDER': '默认启用的 Webhook 渠道标识',
            'WEBHOOK_MESSAGE_TEMPLATE': '默认通知消息模板',

            'WEBHOOK_DINGTALK_ENABLED': '钉钉机器人开关',
            'WEBHOOK_DINGTALK_URL': '钉钉机器人 Webhook 地址',
            'WEBHOOK_DINGTALK_SECRET': '钉钉加签密钥',

            'WEBHOOK_FEISHU_ENABLED': '飞书机器人开关',
            'WEBHOOK_FEISHU_URL': '飞书机器人 Webhook 地址',
            'WEBHOOK_FEISHU_SECRET': '飞书签名或校验密钥',

            'WEBHOOK_WEWORK_ENABLED': '企微机器人开关',
            'WEBHOOK_WEWORK_URL': '企微群机器人 Webhook 地址',
            'WEBHOOK_WEWORK_SECRET': '企微附加密钥或占位字段',

            'WEBHOOK_WELINK_ENABLED': 'Welink 机器人开关',
            'WEBHOOK_WELINK_URL': 'Welink 机器人 Webhook 地址',
            'WEBHOOK_WELINK_APP_ID': 'Welink 应用或机器人 ID',
            'WEBHOOK_WELINK_APP_SECRET': 'Welink 应用密钥',

            'WEBHOOK_OPENCLAW_ENABLED': 'OpenClaw 渠道开关',
            'WEBHOOK_OPENCLAW_URL': 'OpenClaw Webhook 地址',
            'WEBHOOK_OPENCLAW_TOKEN': 'OpenClaw Token / 密钥',
        };
        return map[key] || '';
    };

    const webhookCards = [
        {
            title: '钉钉',
            fields: [
                { type: 'switch', label: '启用渠道', name: 'WEBHOOK_DINGTALK_ENABLED' },
                { label: 'Webhook URL', name: 'WEBHOOK_DINGTALK_URL', placeholder: 'https://oapi.dingtalk.com/robot/send?...' },
                { label: '加签 Secret', name: 'WEBHOOK_DINGTALK_SECRET', placeholder: 'SEC...' }
            ]
        },
        {
            title: '飞书',
            fields: [
                { type: 'switch', label: '启用渠道', name: 'WEBHOOK_FEISHU_ENABLED' },
                { label: 'Webhook URL', name: 'WEBHOOK_FEISHU_URL', placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...' },
                { label: '签名 Secret', name: 'WEBHOOK_FEISHU_SECRET', placeholder: '签名密钥，可选' }
            ]
        },
        {
            title: '企微',
            fields: [
                { type: 'switch', label: '启用渠道', name: 'WEBHOOK_WEWORK_ENABLED' },
                { label: 'Webhook URL', name: 'WEBHOOK_WEWORK_URL', placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...' },
                { label: '扩展 Secret', name: 'WEBHOOK_WEWORK_SECRET', placeholder: '如无需可留空' }
            ]
        },
        {
            title: 'Welink',
            fields: [
                { type: 'switch', label: '启用渠道', name: 'WEBHOOK_WELINK_ENABLED' },
                { label: 'Webhook URL', name: 'WEBHOOK_WELINK_URL', placeholder: 'Welink 机器人地址' },
                { label: 'App ID', name: 'WEBHOOK_WELINK_APP_ID', placeholder: '应用或机器人 ID' },
                { label: 'App Secret', name: 'WEBHOOK_WELINK_APP_SECRET', placeholder: '应用密钥' }
            ]
        },
        {
            title: 'OpenClaw',
            fields: [
                { type: 'switch', label: '启用渠道', name: 'WEBHOOK_OPENCLAW_ENABLED' },
                { label: 'Webhook URL', name: 'WEBHOOK_OPENCLAW_URL', placeholder: 'OpenClaw Webhook 地址' },
                { label: 'Token', name: 'WEBHOOK_OPENCLAW_TOKEN', placeholder: '访问 Token / API Key' }
            ]
        }
    ];

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
                <Tabs
                    defaultActiveKey="ai"
                    tabPosition="left"
                    style={{ minHeight: 600 }}
                    items={[
                        {
                            key: 'ai',
                            label: <span><RobotOutlined /> AI 大模型配置</span>,
                            children: (
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
                                form={aiForm}
                                layout="vertical"
                                onFinish={handleSaveAIConfig}
                                initialValues={{
                                    OPENAI_BASE_URL: 'https://api.openai.com/v1',
                                    GLM_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
                                    DEEPSEEK_BASE_URL: 'https://api.deepseek.com/v1',
                                    TONGYI_BASE_URL: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                                    SILICONFLOW_BASE_URL: 'https://api.siliconflow.cn/v1',
                                    SILICONFLOW_CHAT_MODEL: 'Qwen/Qwen2.5-7B-Instruct',
                                    NEWAPI_BASE_URL: 'https://your-newapi-host/v1',
                                    NEWAPI_CHAT_MODEL: 'gpt-4o-mini'
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

                                    {/* New-API Card */}
                                    <Card size="small" title="New-API (OpenAI Compatible)" className="glass-panel" style={{ borderRadius: 12 }}>
                                        <Form.Item label="API Key" name="NEWAPI_API_KEY" tooltip="兼容 OpenAI Authorization: Bearer {key} 形式">
                                            <Input.Password placeholder="new-api key" />
                                        </Form.Item>
                                        <Form.Item label="Base URL" name="NEWAPI_BASE_URL" tooltip="示例: https://your-newapi-host/v1">
                                            <Input placeholder="https://your-newapi-host/v1" />
                                        </Form.Item>
                                        <Form.Item label="对话模型" name="NEWAPI_CHAT_MODEL" tooltip="默认 completion/chat-completions 使用的模型名称">
                                            <Input placeholder="gpt-4o-mini" />
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
                            )
                        },
                        {
                            key: 'webhook',
                            label: <span><NotificationOutlined /> Webhook 通知配置</span>,
                            children: (
                                <div style={{ padding: '0 24px' }}>
                                    <Title level={4}><NotificationOutlined /> Webhook 渠道管理</Title>
                                    <Paragraph type="secondary" style={{ marginBottom: 24 }}>
                                        配置测试执行、告警通知、AI 任务结果等场景可使用的 Webhook 渠道。当前支持钉钉、飞书、企微、Welink、OpenClaw，也预留了默认渠道和统一消息模板配置。
                                    </Paragraph>

                                    <Alert
                                        message="配置建议"
                                        description="建议至少配置一个默认可用渠道。URL、Token、Secret 等字段按各平台机器人规范填写；未启用的渠道可留空。"
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: 32, borderRadius: 8 }}
                                    />

                                    <Form
                                        form={webhookForm}
                                        layout="vertical"
                                        onFinish={handleSaveWebhookConfig}
                                        initialValues={{
                                            WEBHOOK_DEFAULT_PROVIDER: 'dingtalk',
                                            // eslint-disable-next-line no-template-curly-in-string
                                            WEBHOOK_MESSAGE_TEMPLATE: '【投石问路】${title}\n状态：${status}\n内容：${content}',
                                            WEBHOOK_DINGTALK_ENABLED: false,
                                            WEBHOOK_FEISHU_ENABLED: false,
                                            WEBHOOK_WEWORK_ENABLED: false,
                                            WEBHOOK_WELINK_ENABLED: false,
                                            WEBHOOK_OPENCLAW_ENABLED: false,
                                        }}
                                    >
                                        <Card size="small" title="全局策略" className="glass-panel" style={{ borderRadius: 12, marginBottom: 24 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                                                <Form.Item label="默认渠道" name="WEBHOOK_DEFAULT_PROVIDER">
                                                    <Input placeholder="dingtalk / feishu / wework / welink / openclaw" />
                                                </Form.Item>
                                                <Form.Item label="统一消息模板" name="WEBHOOK_MESSAGE_TEMPLATE" style={{ gridColumn: '1 / -1' }}>
                                                    <TextArea rows={4} placeholder="支持保存默认通知模板，例如标题、状态、正文等变量占位内容。" />
                                                </Form.Item>
                                            </div>
                                        </Card>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                                            {webhookCards.map(card => (
                                                <Card key={card.title} size="small" title={card.title} className="glass-panel" style={{ borderRadius: 12 }}>
                                                    {card.fields.map((field: any) => (
                                                        field.type === 'switch' ? (
                                                            <Form.Item key={field.name} label={field.label} name={field.name} valuePropName="checked">
                                                                <Switch checkedChildren="启用" unCheckedChildren="关闭" />
                                                            </Form.Item>
                                                        ) : (
                                                            <Form.Item key={field.name} label={field.label} name={field.name}>
                                                                {String(field.name).includes('SECRET') || String(field.name).includes('TOKEN') ? (
                                                                    <Input.Password placeholder={field.placeholder} />
                                                                ) : (
                                                                    <Input placeholder={field.placeholder} />
                                                                )}
                                                            </Form.Item>
                                                        )
                                                    ))}
                                                </Card>
                                            ))}
                                        </div>

                                        <Divider />
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                                            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large" style={{ minWidth: 160, borderRadius: 8 }}>
                                                保存 Webhook 配置
                                            </Button>
                                        </div>
                                    </Form>
                                </div>
                            )
                        }
                    ]}
                />
            </Card>
        </div>
    );
};

export default SystemSettings;
