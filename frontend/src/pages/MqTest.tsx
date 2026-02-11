import React, { useState } from 'react';
import {
  Card,
  Input,
  Button,
  Typography,
  Space,
  message,
  Select,
  Row,
  Col,
  List,
  Tag,
  Form,
  Switch,
  Tooltip,
  Badge
} from 'antd';
import {
  CloudServerOutlined,
  SendOutlined,
  DisconnectOutlined,
  LinkOutlined,
  DatabaseOutlined,
  NotificationOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ClearOutlined,
  UserOutlined,
  LockOutlined,
  NumberOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface LogMessage {
  id: string;
  topic: string;
  content: string;
  time: string;
  size: string;
  qos?: number;
}

const MqTest: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);

  // Connection State
  const [brokerType, setBrokerType] = useState('mqtt');
  const [host, setHost] = useState('broker.emqx.io'); // Public broker for demo
  const [port, setPort] = useState('1883');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState(`client_${Math.random().toString(16).substr(2, 8)}`);

  // Producer State
  const [pubTopic, setPubTopic] = useState('test/topic');
  const [msgContent, setMsgContent] = useState('{"msg": "Hello World"}');
  const [qos, setQos] = useState(0);
  const [retain, setRetain] = useState(false);

  // Consumer State
  const [subTopic, setSubTopic] = useState('#');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subQos, setSubQos] = useState(0);

  const handleConnect = () => {
    setLoading(true);
    // Simulate Connection
    setTimeout(() => {
      setConnected(true);
      setLoading(false);
      message.success(`Connected to ${host}:${port}`);
    }, 1000);
  };

  const handleDisconnect = () => {
    setConnected(false);
    setIsSubscribing(false);
    message.info('Disconnected');
  };

  const handlePublish = () => {
    if (!msgContent) return;
    message.success(`Message sent to ${pubTopic} (QoS ${qos})`);

    // If subscribing to matching pattern, echo for demo
    if (isSubscribing) {
      setTimeout(() => {
        addLog(pubTopic, msgContent, qos);
      }, 200);
    }
  };

  const toggleSubscribe = () => {
    if (isSubscribing) {
      setIsSubscribing(false);
      message.info('Stopped subscription');
    } else {
      setIsSubscribing(true);
      message.success(`Subscribed to ${subTopic} (QoS ${subQos})`);
    }
  };

  const addLog = (topic: string, content: string, qosVal: number) => {
    setLogs(prev => [{
      id: Date.now().toString(),
      topic,
      content,
      time: dayjs().format('HH:mm:ss.SSS'),
      size: `${content.length} B`,
      qos: qosVal
    }, ...prev].slice(0, 100)); // Keep last 100
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700 }}>MQ 调试工具</Title>
        <Text type="secondary">MQTT 消息代理服务连接与消息测试</Text>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>

        {/* Top Bar: Connection Config */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
          <Row gutter={16} align="middle">
            <Col>
              <Select value={brokerType} onChange={setBrokerType} style={{ width: 90 }} disabled={connected}>
                <Option value="mqtt">MQTT</Option>
                <Option value="ws">WS</Option>
              </Select>
            </Col>
            <Col flex="auto">
              <Input.Group compact style={{ display: 'flex' }}>
                <Input
                  placeholder="Broker Host"
                  value={host}
                  onChange={e => setHost(e.target.value)}
                  style={{ width: '35%' }}
                  disabled={connected}
                  prefix={<CloudServerOutlined style={{ color: '#ccc' }} />}
                />
                <Input
                  placeholder="Port"
                  value={port}
                  onChange={e => setPort(e.target.value)}
                  style={{ width: '15%' }}
                  disabled={connected}
                />
                <Input
                  placeholder="Username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{ width: '25%' }}
                  disabled={connected}
                  prefix={<UserOutlined style={{ color: '#ccc' }} />}
                />
                <Input.Password
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ width: '25%' }}
                  disabled={connected}
                  prefix={<LockOutlined style={{ color: '#ccc' }} />}
                />
              </Input.Group>
            </Col>
            <Col>
              <Input
                placeholder="Client ID"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                style={{ width: 150 }}
                disabled={connected}
              />
            </Col>
            <Col>
              {!connected ? (
                <Button type="primary" icon={<LinkOutlined />} onClick={handleConnect} loading={loading}>连接</Button>
              ) : (
                <Button danger icon={<DisconnectOutlined />} onClick={handleDisconnect}>断开</Button>
              )}
            </Col>
          </Row>
        </div>

        {/* Main Area */}
        <Row style={{ flex: 1 }} gutter={0}>

          {/* Left: Publisher */}
          <Col span={9} style={{ borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fff' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0' }}>
              <Title level={4} style={{ margin: 0 }}><SendOutlined /> 发布 (Publisher)</Title>
            </div>

            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
              <Form layout="vertical">
                <Form.Item label="Target Topic">
                  <Input
                    prefix={<NumberOutlined style={{ color: '#ccc' }} />}
                    value={pubTopic}
                    onChange={e => setPubTopic(e.target.value)}
                    disabled={!connected}
                    placeholder="e.g. sensor/temp"
                  />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="QoS Level">
                      <Select value={qos} onChange={setQos} disabled={!connected}>
                        <Option value={0}>0 - At most once</Option>
                        <Option value={1}>1 - At least once</Option>
                        <Option value={2}>2 - Exactly once</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Options">
                      <Space>
                        <Tooltip title="Retain Message">
                          <Switch
                            checkedChildren="Retain"
                            unCheckedChildren="Retain"
                            checked={retain}
                            onChange={setRetain}
                            disabled={!connected}
                          />
                        </Tooltip>
                      </Space>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="Payload (消息体)">
                  <TextArea
                    rows={12}
                    placeholder="输入消息内容..."
                    value={msgContent}
                    onChange={e => setMsgContent(e.target.value)}
                    disabled={!connected}
                    style={{ fontFamily: 'Monaco, monospace', fontSize: 13, background: '#fafafa', borderRadius: 8 }}
                  />
                </Form.Item>

                <Form.Item>
                  <Button type="primary" icon={<SendOutlined />} onClick={handlePublish} disabled={!connected} block size="large">
                    发布消息
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </Col>

          {/* Right: Subscriber */}
          <Col span={15} style={{ display: 'flex', flexDirection: 'column', background: '#fbfbfb' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}><NotificationOutlined /> 订阅 (Subscriber)</Title>
                <Button icon={<ClearOutlined />} onClick={clearLogs} size="small">清空</Button>
              </div>
              <Input.Group compact style={{ display: 'flex' }}>
                <Select value={subQos} onChange={setSubQos} style={{ width: 90 }} disabled={!connected || isSubscribing}>
                  <Option value={0}>QoS 0</Option>
                  <Option value={1}>QoS 1</Option>
                  <Option value={2}>QoS 2</Option>
                </Select>
                <Input
                  placeholder="Topic Filter (# for all)"
                  value={subTopic}
                  onChange={e => setSubTopic(e.target.value)}
                  style={{ flex: 1 }}
                  disabled={!connected || isSubscribing}
                />
                <Button
                  type={isSubscribing ? 'default' : 'primary'}
                  danger={isSubscribing}
                  icon={isSubscribing ? <StopOutlined /> : <PlayCircleOutlined />}
                  onClick={toggleSubscribe}
                  disabled={!connected}
                >
                  {isSubscribing ? '停止' : '订阅'}
                </Button>
              </Input.Group>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {logs.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ccc' }}>
                  <DatabaseOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
                  <Text type="secondary">暂无消息，请确保已连接并订阅 Topic</Text>
                </div>
              ) : (
                <List
                  dataSource={logs}
                  renderItem={item => (
                    <List.Item style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', background: '#fff', marginBottom: 8, borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                          <Space>
                            <Tag color="cyan" style={{ fontFamily: 'monospace' }}>{item.topic}</Tag>
                            <Tag color="blue">QoS {item.qos}</Tag>
                          </Space>
                          <Space size="small">
                            <Text type="secondary" style={{ fontSize: 12 }}>{item.size}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>{item.time}</Text>
                          </Space>
                        </div>
                        <div style={{
                          fontFamily: 'Monaco, monospace',
                          fontSize: 13,
                          background: '#fafafa',
                          padding: '8px 12px',
                          borderRadius: 6,
                          color: '#333',
                          border: '1px solid #f5f5f5',
                          wordBreak: 'break-all'
                        }}>
                          {item.content}
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </Col>
        </Row>

      </div>
    </div>
  );
};

export default MqTest;