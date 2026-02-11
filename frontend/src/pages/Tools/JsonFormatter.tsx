import React, { useState } from 'react';
import { Card, Input, Button, Space, Typography, message, Tooltip, Row, Col } from 'antd';
import {
    FormatPainterOutlined,
    CopyOutlined,
    DeleteOutlined,
    CompressOutlined,
    CheckCircleOutlined,
    CloseCircleFilled,
    CodeOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

const JsonFormatter: React.FC = () => {
    const [inputJson, setInputJson] = useState('');
    const [outputJson, setOutputJson] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleFormat = () => {
        try {
            if (!inputJson.trim()) {
                setOutputJson('');
                setError(null);
                return;
            }
            const parsed = JSON.parse(inputJson);
            setOutputJson(JSON.stringify(parsed, null, 2));
            setError(null);
            message.success('JSON Formatted Successfully');
        } catch (err: any) {
            setError(err.message);
            setOutputJson('');
            message.error('Invalid JSON');
        }
    };

    const handleMinify = () => {
        try {
            if (!inputJson.trim()) {
                setOutputJson('');
                setError(null);
                return;
            }
            const parsed = JSON.parse(inputJson);
            setOutputJson(JSON.stringify(parsed));
            setError(null);
            message.success('JSON Minified');
        } catch (err: any) {
            setError(err.message);
            setOutputJson('');
            message.error('Invalid JSON');
        }
    };

    const handleCopy = () => {
        if (!outputJson) return;
        navigator.clipboard.writeText(outputJson);
        message.success('Copied to clipboard');
    };

    const handleClear = () => {
        setInputJson('');
        setOutputJson('');
        setError(null);
    };

    return (
        <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <Title level={2} style={{ margin: 0, fontWeight: 700 }}>JSON 格式化</Title>
                <Text type="secondary">格式化、压缩和校验 JSON 数据</Text>
            </div>

            <div className="glass-panel" style={{ flex: 1, padding: 24, borderRadius: 16, display: 'flex', flexDirection: 'column' }}>

                {/* Toolbar */}
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                    <Space>
                        <Button type="primary" icon={<FormatPainterOutlined />} onClick={handleFormat}>格式化</Button>
                        <Button icon={<CompressOutlined />} onClick={handleMinify}>压缩</Button>
                        <Button icon={<CopyOutlined />} onClick={handleCopy} disabled={!outputJson}>复制结果</Button>
                        <Button danger icon={<DeleteOutlined />} onClick={handleClear}>清空</Button>
                    </Space>
                </div>

                {/* Editors */}
                <Row gutter={24} style={{ flex: 1, minHeight: 0 }}>
                    <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>Input JSON</Text>
                        <TextArea
                            className="glass-panel"
                            style={{
                                flex: 1,
                                resize: 'none',
                                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                                fontSize: 14,
                                backgroundColor: 'rgba(255,255,255,0.5)',
                                border: error ? '1px solid #ff4d4f' : undefined
                            }}
                            placeholder="Paste your JSON here..."
                            value={inputJson}
                            onChange={(e) => setInputJson(e.target.value)}
                            spellCheck={false}
                        />
                        {error && (
                            <Text type="danger" style={{ marginTop: 8 }}>
                                <CloseCircleFilled style={{ marginRight: 4 }} /> {error}
                            </Text>
                        )}
                    </Col>
                    <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>Output</Text>
                        <TextArea
                            className="glass-panel"
                            style={{
                                flex: 1,
                                resize: 'none',
                                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                                fontSize: 14,
                                backgroundColor: error ? 'rgba(255, 77, 79, 0.05)' : 'rgba(246, 255, 237, 0.5)',
                                color: '#333'
                            }}
                            readOnly
                            value={outputJson}
                            placeholder="Formatted JSON will appear here..."
                        />
                    </Col>
                </Row>

            </div>
        </div>
    );
};

export default JsonFormatter;
