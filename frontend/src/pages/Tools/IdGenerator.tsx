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
  Divider,
  Alert
} from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const IdGenerator: React.FC = () => {
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  const [count, setCount] = useState<number>(1);
  const [province, setProvince] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [birthYear, setBirthYear] = useState<number | null>(null);

  // 省份代码映射
  const provinces = [
    { code: '11', name: '北京市' },
    { code: '12', name: '天津市' },
    { code: '13', name: '河北省' },
    { code: '14', name: '山西省' },
    { code: '15', name: '内蒙古自治区' },
    { code: '21', name: '辽宁省' },
    { code: '22', name: '吉林省' },
    { code: '23', name: '黑龙江省' },
    { code: '31', name: '上海市' },
    { code: '32', name: '江苏省' },
    { code: '33', name: '浙江省' },
    { code: '34', name: '安徽省' },
    { code: '35', name: '福建省' },
    { code: '36', name: '江西省' },
    { code: '37', name: '山东省' },
    { code: '41', name: '河南省' },
    { code: '42', name: '湖北省' },
    { code: '43', name: '湖南省' },
    { code: '44', name: '广东省' },
    { code: '45', name: '广西壮族自治区' },
    { code: '46', name: '海南省' },
    { code: '50', name: '重庆市' },
    { code: '51', name: '四川省' },
    { code: '52', name: '贵州省' },
    { code: '53', name: '云南省' },
    { code: '54', name: '西藏自治区' },
    { code: '61', name: '陕西省' },
    { code: '62', name: '甘肃省' },
    { code: '63', name: '青海省' },
    { code: '64', name: '宁夏回族自治区' },
    { code: '65', name: '新疆维吾尔自治区' },
  ];

  // 生成随机身份证号码
  const generateIdCard = (): string => {
    // 地区代码（6位）
    let areaCode = '';
    if (province) {
      // 如果选择了省份，将2位代码扩展为6位
      const cityCode = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      const districtCode = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      areaCode = province + cityCode + districtCode;
    } else {
      // 如果没有选择省份，生成一个随机的6位地区代码
      const provinceCodes = ['110000', '120000', '130000', '140000', '150000', '210000', '220000', '230000', '310000', '320000', '330000', '340000', '350000', '360000', '370000', '410000', '420000', '430000', '440000', '450000', '460000', '500000', '510000', '520000', '530000', '540000', '610000', '620000', '630000', '640000', '650000'];
      const selectedProvince = provinceCodes[Math.floor(Math.random() * provinceCodes.length)];
      // 生成后4位地区代码
      const cityCode = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      const districtCode = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      areaCode = selectedProvince.substring(0, 2) + cityCode + districtCode;
    }
    
    // 出生日期（8位）
    const year = birthYear || Math.floor(Math.random() * 50) + 1970;
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const birthDate = `${year.toString().padStart(4, '0')}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
    
    // 顺序码（3位）
    let sequence = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    
    // 性别码（第17位，奇数为男，偶数为女）
    if (gender === 'male') {
      // 男性：确保最后一位是奇数
      const lastDigit = parseInt(sequence.slice(-1));
      if (lastDigit % 2 === 0) {
        sequence = (parseInt(sequence) + 1).toString().padStart(3, '0');
      }
    } else if (gender === 'female') {
      // 女性：确保最后一位是偶数
      const lastDigit = parseInt(sequence.slice(-1));
      if (lastDigit % 2 === 1) {
        sequence = (parseInt(sequence) + 1).toString().padStart(3, '0');
      }
    }
    
    // 前17位
    const first17 = areaCode + birthDate + sequence;
    
    // 校验码（第18位）
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(first17[i]) * weights[i];
    }
    
    const checkCode = checkCodes[sum % 11];
    
    return first17 + checkCode;
  };

  // 批量生成身份证号码
  const handleGenerate = () => {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(generateIdCard());
    }
    setGeneratedIds(ids);
    message.success(`成功生成 ${count} 个身份证号码`);
  };

  // 复制到剪贴板
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  // 复制所有
  const handleCopyAll = () => {
    const allText = generatedIds.join('\n');
    navigator.clipboard.writeText(allText);
    message.success('已复制所有号码到剪贴板');
  };

  // 清空结果
  const handleClear = () => {
    setGeneratedIds([]);
  };

  return (
    <div>
      <Title level={2}>身份证号码生成器</Title>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="生成配置" style={{ height: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong>生成数量：</Text>
                <InputNumber
                  min={1}
                  max={100}
                  value={count}
                  onChange={(value) => setCount(value || 1)}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>

              <div>
                <Text strong>省份地区：</Text>
                <Select
                  value={province}
                  onChange={setProvince}
                  placeholder="随机省份"
                  allowClear
                  style={{ width: '100%', marginTop: 8 }}
                >
                  {provinces.map(p => (
                    <Select.Option key={p.code} value={p.code}>
                      {p.name}
                    </Select.Option>
                  ))}
                </Select>
              </div>

              <div>
                <Text strong>性别：</Text>
                <Select
                  value={gender}
                  onChange={setGender}
                  placeholder="随机性别"
                  allowClear
                  style={{ width: '100%', marginTop: 8 }}
                >
                  <Select.Option value="male">男</Select.Option>
                  <Select.Option value="female">女</Select.Option>
                </Select>
              </div>

              <div>
                <Text strong>出生年份：</Text>
                <InputNumber
                  min={1900}
                  max={new Date().getFullYear()}
                  value={birthYear}
                  onChange={setBirthYear}
                  placeholder="随机年份"
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>

              <Space>
                <Button 
                  type="primary" 
                  icon={<ReloadOutlined />}
                  onClick={handleGenerate}
                >
                  生成号码
                </Button>
                <Button onClick={handleClear}>
                  清空结果
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card 
            title="生成结果" 
            extra={
              generatedIds.length > 0 && (
                <Button 
                  size="small" 
                  icon={<CopyOutlined />}
                  onClick={handleCopyAll}
                >
                  复制全部
                </Button>
              )
            }
            style={{ height: '100%' }}
          >
            {generatedIds.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {generatedIds.map((id, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text code>{id}</Text>
                    <Button 
                      size="small" 
                      type="text" 
                      icon={<CopyOutlined />}
                      onClick={() => handleCopy(id)}
                    />
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="secondary">点击"生成号码"按钮开始生成</Text>
            )}
          </Card>
        </Col>
      </Row>

      <Divider />

      <Alert
        message="使用说明"
        description={
          <div>
            <p>• 身份证号码符合国家标准GB 11643-1999</p>
            <p>• 生成的号码仅用于测试目的，请勿用于非法用途</p>
            <p>• 号码包含完整的地区代码、出生日期、顺序码和校验码</p>
            <p>• 可以根据需要筛选省份、性别和出生年份</p>
          </div>
        }
        type="info"
        showIcon
      />
    </div>
  );
};

export default IdGenerator;