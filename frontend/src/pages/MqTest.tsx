import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ClockCircleOutlined,
  HistoryOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { testApi } from '../services/api';
import { MqTestResponse } from '../types';

const { Title, Text } = Typography;
const { TextArea, Password } = Input;

interface HistoryItem {
  mqType: string;
  host: string;
  port: number;
  queueName: string;
  executionTime: number;
  success: boolean;
  createdAt: string;
}

const codeBlockStyle: React.CSSProperties = {
  margin: 0,
  maxHeight: 300,
  overflow: 'auto',
  background: '#0f172a',
  color: '#dbeafe',
  padding: 12,
  borderRadius: 8,
  fontSize: 12,
  lineHeight: 1.55,
};

const MqTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MqTestResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [mqType, setMqType] = useState<'rabbitmq' | 'activemq' | 'kafka'>('rabbitmq');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(5672);
  const [username, setUsername] = useState('guest');
  const [password, setPassword] = useState('guest');
  const [queueName, setQueueName] = useState('default');
  const [exchange, setExchange] = useState('');
  const [routingKey, setRoutingKey] = useState('');
  const [timeout, setTimeoutValue] = useState(30);
  const [messageBody, setMessageBody] = useState('');

  const responseText = useMemo(() => {
    if (!result) return '';
    if (!result.response_data) return '';
    return String(result.response_data);
  }, [result]);

  const handleSend = async () => {
    if (!host.trim()) {
      message.error('请输入 Host');
      return;
    }
    if (!queueName.trim()) {
      message.error('请输入队列名');
      return;
    }
    if (!messageBody.trim()) {
      message.error('请输入消息体');
      return;
    }

    setLoading(true);
    try {
      const res = await testApi.testMq({
        host: host.trim(),
        port,
        queue_name: queueName.trim(),
        message: messageBody,
        exchange: exchange.trim() || undefined,
        routing_key: routingKey.trim() || undefined,
        timeout,
        mq_type: mqType,
        username: username || undefined,
        password: password || undefined,
      } as any);
      setResult(res);
      setHistory((prev) => [
        {
          mqType,
          host: host.trim(),
          port,
          queueName: queueName.trim(),
          executionTime: res.execution_time,
          success: !!res.success,
          createdAt: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 12));

      if (res.success) message.success('MQ 测试成功');
      else message.warning(res.error_message || 'MQ 测试失败');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'MQ 测试失败');
      setResult({
        success: false,
        execution_time: 0,
        response_data: '',
        error_message: e?.response?.data?.detail || 'MQ 测试失败',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="app-content fade-in"
      style={{ padding: 24, maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>MQ 测试</Title>
          <Text type="secondary">连接消息中间件并快速验证发送链路与响应</Text>
        </div>
        <Space>
          <Tag icon={<HistoryOutlined />} color="blue">最近记录 {history.length}</Tag>
          <Tag icon={<ClockCircleOutlined />} color="geekblue">超时 {timeout}s</Tag>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '58% 42%', gap: 14, flex: 1, minHeight: 0 }}>
        <Card title="请求配置" style={{ borderRadius: 16 }} bodyStyle={{ overflow: 'auto' }}>
          <Row gutter={[12, 12]}>
            <Col span={8}>
              <Text type="secondary">MQ 类型</Text>
              <Select
                style={{ marginTop: 6, width: '100%' }}
                value={mqType}
                onChange={setMqType}
                options={[
                  { value: 'rabbitmq', label: 'RabbitMQ' },
                  { value: 'activemq', label: 'ActiveMQ' },
                  { value: 'kafka', label: 'Kafka' },
                ]}
              />
            </Col>
            <Col span={10}>
              <Text type="secondary">Host</Text>
              <Input style={{ marginTop: 6 }} value={host} onChange={(e) => setHost(e.target.value)} />
            </Col>
            <Col span={6}>
              <Text type="secondary">Port</Text>
              <InputNumber min={1} max={65535} style={{ marginTop: 6, width: '100%' }} value={port} onChange={(v) => setPort(Number(v) || 5672)} />
            </Col>

            <Col span={12}>
              <Text type="secondary">用户名</Text>
              <Input style={{ marginTop: 6 }} value={username} onChange={(e) => setUsername(e.target.value)} />
            </Col>
            <Col span={12}>
              <Text type="secondary">密码</Text>
              <Password style={{ marginTop: 6 }} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Col>

            <Col span={12}>
              <Text type="secondary">队列名</Text>
              <Input style={{ marginTop: 6 }} value={queueName} onChange={(e) => setQueueName(e.target.value)} />
            </Col>
            <Col span={12}>
              <Text type="secondary">超时(秒)</Text>
              <InputNumber min={1} max={300} style={{ marginTop: 6, width: '100%' }} value={timeout} onChange={(v) => setTimeoutValue(Number(v) || 30)} />
            </Col>

            <Col span={12}>
              <Text type="secondary">Exchange（可选）</Text>
              <Input style={{ marginTop: 6 }} value={exchange} onChange={(e) => setExchange(e.target.value)} />
            </Col>
            <Col span={12}>
              <Text type="secondary">Routing Key（可选）</Text>
              <Input style={{ marginTop: 6 }} value={routingKey} onChange={(e) => setRoutingKey(e.target.value)} />
            </Col>

            <Col span={24}>
              <Text type="secondary">消息体</Text>
              <TextArea
                rows={11}
                style={{ marginTop: 6, fontFamily: 'Consolas, Monaco, monospace', fontSize: 13, borderRadius: 10 }}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder='例如：{"event":"order.created","id":1001}'
              />
            </Col>
          </Row>

          <div style={{ marginTop: 14 }}>
            <Button type="primary" shape="round" size="large" icon={<SendOutlined />} loading={loading} onClick={handleSend} style={{ fontWeight: 700 }}>
              发送并测试
            </Button>
          </div>
        </Card>

        <Card
          title="响应结果"
          extra={<Tag color={result?.success ? 'success' : result ? 'error' : 'default'}>{result ? (result.success ? '成功' : '失败') : '待执行'}</Tag>}
          style={{ borderRadius: 16 }}
          bodyStyle={{ overflow: 'auto' }}
        >
          {!result ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="执行 MQ 测试后在这里查看结果" />
            </div>
          ) : (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div style={{ background: '#f7fbff', border: '1px solid #d6e4ff', borderRadius: 12, padding: 10 }}>
                <Row gutter={10}>
                  <Col span={12}>
                    <Text type="secondary">耗时</Text>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{result.execution_time} ms</div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">Message ID</Text>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{result.message_id || '--'}</div>
                  </Col>
                </Row>
              </div>

              {result.error_message && (
                <Alert type="error" showIcon message="测试失败" description={result.error_message} />
              )}

              <Card size="small" title="返回数据" style={{ borderRadius: 10 }}>
                <pre style={codeBlockStyle}>
                  {responseText || '无返回数据'}
                </pre>
              </Card>
            </Space>
          )}
        </Card>
      </div>

      {history.length > 0 && (
        <Card title="最近请求记录" style={{ marginTop: 14, borderRadius: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((item, idx) => (
              <div
                key={`${item.host}-${item.port}-${item.createdAt}-${idx}`}
                style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 80px 90px', gap: 8, padding: 8, borderRadius: 8, background: '#f8fafc', border: '1px solid #f0f0f0' }}
              >
                <Tag style={{ margin: 0 }}>{item.mqType}</Tag>
                <Text>{item.host}:{item.port} / {item.queueName}</Text>
                <Text>{item.executionTime}ms</Text>
                <Text>{item.success ? '成功' : '失败'}</Text>
                <Text type="secondary">{item.createdAt}</Text>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default MqTest;
