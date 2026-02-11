import React, { useState } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  message,
  Select,
  InputNumber,
  Row,
  Col,
  List,
  Tag,
  Tooltip,
  Badge,
  Divider,
  Empty
} from 'antd';
import {
  CopyOutlined,
  ReloadOutlined,
  DeleteOutlined,
  MobileOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  PhoneOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const PhoneGenerator: React.FC = () => {
  const [generatedPhones, setGeneratedPhones] = useState<string[]>([]);
  const [count, setCount] = useState<number>(10);
  const [operator, setOperator] = useState<string>('');
  const [province, setProvince] = useState<string>('');

  // Operators
  const operators = [
    { code: 'china_mobile', name: '中国移动', color: 'blue', prefixes: ['134', '135', '136', '137', '138', '139', '147', '150', '151', '152', '157', '158', '159', '172', '178', '182', '183', '184', '187', '188', '198'] },
    { code: 'china_unicom', name: '中国联通', color: 'red', prefixes: ['130', '131', '132', '145', '155', '156', '166', '171', '175', '176', '185', '186', '196'] },
    { code: 'china_telecom', name: '中国电信', color: 'green', prefixes: ['133', '149', '153', '173', '177', '180', '181', '189', '191', '193', '199'] },
    { code: 'china_virtual', name: '虚拟运营商', color: 'default', prefixes: ['162', '165', '167', '170', '171'] }
  ];

  // Provinces (Mock Data for demo logic)
  const provinces = [
    { code: '10', name: '北京' }, { code: '20', name: '上海' }, { code: '30', name: '天津' }, { code: '40', name: '重庆' },
    { code: '100', name: '江苏' }, { code: '110', name: '浙江' }, { code: '190', name: '广东' }
  ];

  const generatePhoneNumber = (): string => {
    let prefixes: string[] = [];
    if (operator) {
      prefixes = operators.find(op => op.code === operator)?.prefixes || [];
    } else {
      operators.forEach(op => prefixes.push(...op.prefixes));
    }

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    let suffix = '';
    for (let i = 0; i < 8; i++) suffix += Math.floor(Math.random() * 10);
    return prefix + suffix;
  };

  const handleGenerate = () => {
    const list = [];
    for (let i = 0; i < count; i++) list.push(generatePhoneNumber());
    setGeneratedPhones(list);
    message.success(`Generated ${count} numbers`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied!');
  };

  const getOperatorInfo = (phone: string) => {
    const prefix = phone.substring(0, 3);
    for (const op of operators) {
      if (op.prefixes.includes(prefix)) return op;
    }
    return { name: 'Unknown', color: 'default' };
  };

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700 }}>手机号码生成器</Title>
        <Text type="secondary">随机生成国内主流运营商手机号码</Text>
      </div>

      <div className="glass-panel" style={{ flex: 1, borderRadius: 16, overflow: 'hidden', background: '#fff', display: 'flex' }}>

        {/* Left: Config */}
        <div style={{ width: 360, background: '#fafafa', borderRight: '1px solid #f0f0f0', padding: 24, display: 'flex', flexDirection: 'column' }}>
          <Title level={4} style={{ marginBottom: 24 }}><MobileOutlined /> 配置选项</Title>

          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>生成数量</div>
              <InputNumber min={1} max={100} value={count} onChange={v => setCount(v || 1)} style={{ width: '100%' }} size="large" />
            </div>

            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}><InfoCircleOutlined /> 运营商</div>
              <Select placeholder="随机运营商" style={{ width: '100%' }} size="large" allowClear value={operator} onChange={setOperator}>
                {operators.map(op => (
                  <Option key={op.code} value={op.code}>
                    <Tag color={op.color}>{op.name}</Tag>
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}><EnvironmentOutlined /> 归属地</div>
              <Select placeholder="随机归属地" style={{ width: '100%' }} size="large" allowClear value={province} onChange={setProvince}>
                {provinces.map(p => <Option key={p.code} value={p.code}>{p.name}</Option>)}
              </Select>
            </div>

            <Button type="primary" size="large" icon={<ReloadOutlined />} block onClick={handleGenerate} style={{ height: 48, marginTop: 12 }}>
              立即生成
            </Button>

            <Divider />

            <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #eee' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>常用号段参考：</Text>
              <Space size={[4, 4]} wrap>
                <Tag color="blue">138 (移动)</Tag>
                <Tag color="red">186 (联通)</Tag>
                <Tag color="green">189 (电信)</Tag>
              </Space>
            </div>
          </Space>
        </div>

        {/* Right: Result */}
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Space>
              <Title level={4} style={{ margin: 0 }}>生成结果</Title>
              <Badge count={generatedPhones.length} style={{ backgroundColor: '#1890ff' }} />
            </Space>
            <Space>
              <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(generatedPhones.join('\n'))} disabled={generatedPhones.length === 0}>复制全部</Button>
              <Button icon={<DeleteOutlined />} danger onClick={() => setGeneratedPhones([])} disabled={generatedPhones.length === 0}>清空</Button>
            </Space>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {generatedPhones.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                <PhoneOutlined style={{ fontSize: 64, marginBottom: 16, opacity: 0.2 }} />
                <Text type="secondary">请选择配置并点击生成</Text>
              </div>
            ) : (
              <List
                grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3 }}
                dataSource={generatedPhones}
                renderItem={(phone) => {
                  const opInfo = getOperatorInfo(phone);
                  return (
                    <List.Item>
                      <div style={{
                        padding: '12px',
                        background: '#fcfcfc',
                        borderRadius: 8,
                        border: '1px solid #f0f0f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                        className="hover-card"
                        onClick={() => copyToClipboard(phone)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Tag color={opInfo.color} style={{ marginRight: 0 }}>{opInfo.name}</Tag>
                          <CopyOutlined style={{ color: '#ccc', fontSize: 12 }} />
                        </div>
                        <Text strong style={{ fontFamily: 'Monaco, monospace', fontSize: 18, color: '#333', textAlign: 'center', display: 'block' }}>
                          {phone.substring(0, 3)} {phone.substring(3, 7)} {phone.substring(7)}
                        </Text>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PhoneGenerator;