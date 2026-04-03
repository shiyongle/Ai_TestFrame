import React, { useState } from 'react';
import { Card, Input, Button, Space, Typography, message, Row, Col, Divider } from 'antd';
import {
    LockOutlined,
    UnlockOutlined,
    CopyOutlined,
    DeleteOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

const AesCrypto: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [outputText, setOutputText] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Helper to derive a key from a password
    const deriveKey = async (password: string, salt: Uint8Array) => {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );
        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    };

    const handleEncrypt = async () => {
        try {
            if (!inputText || !secretKey) {
                message.warning('Please enter text and a secret key');
                return;
            }

            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const key = await deriveKey(secretKey, salt);
            const enc = new TextEncoder();

            const encrypted = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                enc.encode(inputText)
            );

            // Combine salt + iv + ciphertext for portability
            const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            combined.set(salt);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encrypted), salt.length + iv.length);

            // Convert to Base64
            // Fix: Use Array.from to avoid iteration issues with Uint8Array
            const base64 = btoa(String.fromCharCode.apply(null, Array.from(combined)));
            setOutputText(base64);
            setError(null);
            message.success('Encrypted successfully');
        } catch (err: any) {
            console.error(err);
            setError('Encryption failed');
            message.error('Encryption failed');
        }
    };

    const handleDecrypt = async () => {
        try {
            if (!inputText || !secretKey) {
                message.warning('Please enter ciphertext and a secret key');
                return;
            }

            // Decode Base64
            const combined = new Uint8Array(atob(inputText).split('').map(c => c.charCodeAt(0)));

            // Extract salt, iv, ciphertext
            const salt = combined.slice(0, 16);
            const iv = combined.slice(16, 16 + 12);
            const data = combined.slice(16 + 12);

            const key = await deriveKey(secretKey, salt);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                data
            );

            const dec = new TextDecoder();
            setOutputText(dec.decode(decrypted));
            setError(null);
            message.success('Decrypted successfully');
        } catch (err: any) {
            console.error(err);
            setError('Decryption failed. Check your key or input.');
            message.error('Decryption failed (Wrong Key?)');
        }
    };

    const handleCopy = () => {
        if (!outputText) return;
        navigator.clipboard.writeText(outputText);
        message.success('Copied to clipboard');
    };

    const handleClear = () => {
        setInputText('');
        setOutputText('');
        setSecretKey('');
        setError(null);
    };

    return (
        <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <Title level={2} style={{ margin: 0, fontWeight: 700 }}>AES 加解密</Title>
                <Text type="secondary">使用 AES-GCM 算法进行安全文本加解密</Text>
            </div>

            <div className="glass-panel" style={{ flex: 1, padding: 24, borderRadius: 16, display: 'flex', flexDirection: 'column' }}>

                {/* Secret Key Input */}
                <div style={{ marginBottom: 24, padding: 20, background: 'rgba(255,255,255,0.4)', borderRadius: 12 }}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Secret Key (密码)</Text>
                    <Input.Password
                        placeholder="Enter your secret key here..."
                        value={secretKey}
                        onChange={e => setSecretKey(e.target.value)}
                        style={{ maxWidth: 400 }}
                        prefix={<SafetyCertificateOutlined style={{ color: '#rgba(0,0,0,0.25)' }} />}
                    />
                </div>

                {/* Toolbar */}
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', gap: 16 }}>
                    <Button type="primary" icon={<LockOutlined />} onClick={handleEncrypt} size="large" style={{ minWidth: 120 }}>
                        加密 (Encrypt)
                    </Button>
                    <Button type="primary" icon={<UnlockOutlined />} onClick={handleDecrypt} size="large" style={{ minWidth: 120 }}>
                        解密 (Decrypt)
                    </Button>
                    <Button icon={<DeleteOutlined />} onClick={handleClear} size="large">
                        清空
                    </Button>
                </div>

                {/* Editors */}
                <Row gutter={24} style={{ flex: 1, minHeight: 0 }}>
                    <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>Input Text (Plain or Cipher)</Text>
                        <TextArea
                            className="glass-panel"
                            style={{
                                flex: 1,
                                resize: 'none',
                                fontSize: 14,
                                backgroundColor: 'rgba(255,255,255,0.5)',
                            }}
                            placeholder="Enter text to encrypt or decrypt..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                        />
                    </Col>
                    <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text type="secondary">Output Result</Text>
                            <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopy} disabled={!outputText}>Copy</Button>
                        </div>
                        <TextArea
                            className="glass-panel"
                            style={{
                                flex: 1,
                                resize: 'none',
                                fontSize: 14,
                                backgroundColor: error ? 'rgba(255, 77, 79, 0.05)' : 'rgba(246, 255, 237, 0.5)',
                                color: error ? '#ff4d4f' : '#333'
                            }}
                            readOnly
                            value={error || outputText}
                            placeholder="Result will appear here..."
                        />
                    </Col>
                </Row>

            </div>
        </div>
    );
};

export default AesCrypto;
