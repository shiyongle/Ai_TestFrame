import React, { useState } from 'react';
import {
  Card,
  Button,
  Input,
  Typography,
  Space,
  message,
  Select,
  InputNumber,
  Row,
  Col,
  List,
  Tooltip,
  Badge,
  Tag
} from 'antd';
import {
  CopyOutlined,
  ReloadOutlined,
  DeleteOutlined,
  IdcardOutlined,
  UserOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ManOutlined,
  WomanOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const IdGenerator: React.FC = () => {
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  const [count, setCount] = useState<number>(5);
  const [province, setProvince] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [birthYear, setBirthYear] = useState<number | null>(null);

  // Province Data
  const provinces = [
    { code: '11', name: '北京市' }, { code: '12', name: '天津市' }, { code: '13', name: '河北省' },
    { code: '14', name: '山西省' }, { code: '15', name: '内蒙古' }, { code: '21', name: '辽宁省' },
    { code: '22', name: '吉林省' }, { code: '23', name: '黑龙江' }, { code: '31', name: '上海市' },
    { code: '32', name: '江苏省' }, { code: '33', name: '浙江省' }, { code: '34', name: '安徽省' },
    { code: '35', name: '福建省' }, { code: '36', name: '江西省' }, { code: '37', name: '山东省' },
    { code: '41', name: '河南省' }, { code: '42', name: '湖北省' }, { code: '43', name: '湖南省' },
    { code: '44', name: '广东省' }, { code: '45', name: '广西' }, { code: '46', name: '海南省' },
    { code: '50', name: '重庆市' }, { code: '51', name: '四川省' }, { code: '52', name: '贵州省' },
    { code: '53', name: '云南省' }, { code: '54', name: '西藏' }, { code: '61', name: '陕西省' },
    { code: '62', name: '甘肃省' }, { code: '63', name: '青海省' }, { code: '64', name: '宁夏' },
    { code: '65', name: '新疆' },
  ];

  const generateIdCard = (): string => {
    // Area Code
    let areaCode = '';
    if (province) {
      const cityCode = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      const districtCode = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      areaCode = province + cityCode + districtCode;
    } else {
      const selectedProvince = provinces[Math.floor(Math.random() * provinces.length)].code;
      const cityCode = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      const districtCode = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      areaCode = selectedProvince + cityCode + districtCode;
    }

    // Birthday
    const year = birthYear || Math.floor(Math.random() * 50) + 1970;
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const birthDate = `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;

    // Sequence
    let sequence = Math.floor(Math.random() * 999).toString().padStart(3, '0');

    // Gender Logic (17th digit: Odd Male, Even Female)
    const lastDigit = parseInt(sequence.slice(-1));
    if (gender === 'male' && lastDigit % 2 === 0) {
      sequence = (parseInt(sequence) + 1).toString().padStart(3, '0');
    } else if (gender === 'female' && lastDigit % 2 === 1) {
      sequence = (parseInt(sequence) + 1).toString().padStart(3, '0');
    }

    // Check Code (18th digit)
    const first17 = areaCode + birthDate + sequence;
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(first17[i]) * weights[i];
    }
    return first17 + checkCodes[sum % 11];
  };

  const handleGenerate = () => {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) ids.push(generateIdCard());
    setGeneratedIds(ids);
    message.success(`Generated ${count} IDs`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied!');
  };

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700 }}>身份证生成器</Title>
        <Text type="secondary">符合 GB 11643-1999 标准的随机身份证号码生成</Text>
      </div>

      <div className="glass-panel" style={{ flex: 1, borderRadius: 16, overflow: 'hidden', background: '#fff', display: 'flex' }}>

        {/* Left: Config */}
        <div style={{ width: 360, background: '#fafafa', borderRight: '1px solid #f0f0f0', padding: 24, display: 'flex', flexDirection: 'column' }}>
          <Title level={4} style={{ marginBottom: 24 }}><IdcardOutlined /> 配置选项</Title>

          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>生成数量</div>
              <InputNumber min={1} max={50} value={count} onChange={v => setCount(v || 1)} style={{ width: '100%' }} size="large" />
            </div>

            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}><EnvironmentOutlined /> 省份</div>
              <Select
                showSearch
                placeholder="随机省份"
                style={{ width: '100%' }}
                size="large"
                allowClear
                value={province}
                onChange={setProvince}
                optionFilterProp="children"
              >
                {provinces.map(p => <Option key={p.code} value={p.code}>{p.name}</Option>)}
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}><UserOutlined /> 性别</div>
              <Select placeholder="随机性别" style={{ width: '100%' }} size="large" allowClear value={gender} onChange={setGender}>
                <Option value="male"><ManOutlined /> 男</Option>
                <Option value="female"><WomanOutlined /> 女</Option>
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}><CalendarOutlined /> 出生年份</div>
              <InputNumber placeholder="随机年份 (e.g. 1990)" style={{ width: '100%' }} size="large" min={1900} max={2024} value={birthYear} onChange={setBirthYear} />
            </div>

            <Button type="primary" size="large" icon={<ReloadOutlined />} block onClick={handleGenerate} style={{ height: 48, marginTop: 12 }}>
              立即生成
            </Button>
          </Space>
        </div>

        {/* Right: Result */}
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Space>
              <Title level={4} style={{ margin: 0 }}>生成结果</Title>
              <Badge count={generatedIds.length} style={{ backgroundColor: '#52c41a' }} />
            </Space>
            <Space>
              <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(generatedIds.join('\n'))} disabled={generatedIds.length === 0}>复制全部</Button>
              <Button icon={<DeleteOutlined />} danger onClick={() => setGeneratedIds([])} disabled={generatedIds.length === 0}>清空</Button>
            </Space>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {generatedIds.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                <IdcardOutlined style={{ fontSize: 64, marginBottom: 16, opacity: 0.2 }} />
                <Text type="secondary">点击左侧按钮生成号码</Text>
              </div>
            ) : (
              <List
                grid={{ gutter: 16, column: 2 }}
                dataSource={generatedIds}
                renderItem={(id, index) => (
                  <List.Item>
                    <div style={{
                      padding: '16px',
                      background: '#f8f9fa',
                      borderRadius: 8,
                      border: '1px solid #eee',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                      className="hover-card"
                      onClick={() => copyToClipboard(id)}
                    >
                      <Text strong style={{ fontFamily: 'Monaco, monospace', fontSize: 16, letterSpacing: 1, color: '#333' }}>
                        {id}
                      </Text>
                      <Tooltip title="点击复制">
                        <CopyOutlined style={{ color: '#1890ff' }} />
                      </Tooltip>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default IdGenerator;