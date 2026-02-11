import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Input,
  Button,
  Typography,
  Space,
  message,
  Tag,
  Select,
  Tooltip,
  Divider
} from 'antd';
import {
  ApiOutlined,
  SendOutlined,
  DisconnectOutlined,
  LinkOutlined,
  DeleteOutlined,
  SettingOutlined,
  DownOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface Message {
  id: string;
  type: 'sent' | 'received' | 'system';
  content: string;
  time: string;
  isHex?: boolean;
}

const TcpTest: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('8080');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'hex'>('text');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConnect = () => {
    if (!host || !port) return message.error('请输入 Host 和 Port');
    message.loading('正在连接...', 1).then(() => {
      setConnected(true);
      addMessage('system', `Connected to ${host}:${port}`);
      message.success('连接成功');

      // Simulate receiving a welcome message
      setTimeout(() => {
        addMessage('received', 'Welcome to TCP Mock Server v1.0');
      }, 500);
    });
  };

  const handleDisconnect = () => {
    setConnected(false);
    addMessage('system', 'Disconnected from server');
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    const content = inputText;
    addMessage('sent', content, inputMode === 'hex');
    setInputText('');

    // Simulate echo response
    if (connected) {
      setTimeout(() => {
        addMessage('received', `Echo: ${content}`);
      }, 600);
    } else {
      message.error('未连接到服务器');
    }
  };

  const addMessage = (type: 'sent' | 'received' | 'system', content: string, isHex = false) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type,
      content,
      time: dayjs().format('HH:mm:ss.SSS'),
      isHex
    }]);
  };

  const clearLog = () => {
    setMessages([]);
  };

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700 }}>TCP 调试助手</Title>
        <Text type="secondary">TCP 客户端模式，支持 HEX/文本 收发</Text>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>

        {/* Top Bar: Connection Config */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 12, alignItems: 'center', background: '#fafafa' }}>
          <Input.Group compact style={{ display: 'flex' }}>
            <Input
              style={{ width: 200 }}
              placeholder="Host / IP"
              value={host}
              onChange={e => setHost(e.target.value)}
              prefix={<ApiOutlined style={{ color: '#ccc' }} />}
              disabled={connected}
            />
            <Input
              style={{ width: 100 }}
              placeholder="Port"
              value={port}
              onChange={e => setPort(e.target.value)}
              disabled={connected}
            />
          </Input.Group>

          {!connected ? (
            <Button type="primary" icon={<LinkOutlined />} onClick={handleConnect}>连接</Button>
          ) : (
            <Button danger icon={<DisconnectOutlined />} onClick={handleDisconnect}>断开</Button>
          )}

          <div style={{ flex: 1 }} />

          <Button icon={<DeleteOutlined />} onClick={clearLog}>清空日志</Button>
          <Button icon={<SettingOutlined />}>编码设置</Button>
        </div>

        {/* Message Log */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#fff', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 100, color: '#ccc' }}>
              <ApiOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
              <div>暂无消息记录</div>
            </div>
          )}

          {messages.map(msg => {
            if (msg.type === 'system') {
              return (
                <div key={msg.id} style={{ textAlign: 'center', margin: '8px 0' }}>
                  <span style={{ background: '#f5f5f5', padding: '4px 12px', borderRadius: 12, fontSize: 12, color: '#999' }}>
                    {msg.time} • {msg.content}
                  </span>
                </div>
              );
            }

            const isSent = msg.type === 'sent';
            return (
              <div key={msg.id} style={{ alignSelf: isSent ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{
                  display: 'flex',
                  gap: 8,
                  flexDirection: isSent ? 'row-reverse' : 'row',
                  alignItems: 'flex-end'
                }}>
                  <div style={{
                    padding: '10px 16px',
                    borderRadius: 12,
                    background: isSent ? '#e6f7ff' : '#f5f5f5',
                    border: isSent ? '1px solid #91d5ff' : '1px solid #f0f0f0',
                    borderBottomRightRadius: isSent ? 2 : 12,
                    borderBottomLeftRadius: isSent ? 12 : 2
                  }}>
                    <div style={{ fontSize: 13, fontFamily: 'Monaco, monospace', whiteSpace: 'pre-wrap', color: '#333' }}>
                      {msg.content}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: '#ccc', marginBottom: 4 }}>{msg.time}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Bar: Input */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
          <Input.Group compact style={{ display: 'flex' }}>
            <Select value={inputMode} onChange={setInputMode} style={{ width: 90 }}>
              <Option value="text">Text</Option>
              <Option value="hex">HEX</Option>
            </Select>
            <Input
              style={{ flex: 1 }}
              placeholder={inputMode === 'hex' ? "输入 HEX 字符串，如 AA BB CC" : "输入发送内容..."}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onPressEnter={handleSend}
            />
            <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!connected}>
              发送
            </Button>
          </Input.Group>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Tag style={{ cursor: 'pointer' }} onClick={() => setInputText('PING')}>PING</Tag>
            <Tag style={{ cursor: 'pointer' }} onClick={() => setInputText('Status')}>Status</Tag>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TcpTest;