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
  Divider,
  Alert,
  Tag
} from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const PhoneGenerator: React.FC = () => {
  const [generatedPhones, setGeneratedPhones] = useState<string[]>([]);
  const [count, setCount] = useState<number>(1);
  const [operator, setOperator] = useState<string>('');
  const [province, setProvince] = useState<string>('');

  // 运营商配置
  const operators = [
    { 
      code: 'china_mobile', 
      name: '中国移动',
      prefixes: ['134', '135', '136', '137', '138', '139', '147', '150', '151', '152', '157', '158', '159', '172', '178', '182', '183', '184', '187', '188', '198']
    },
    { 
      code: 'china_unicom', 
      name: '中国联通',
      prefixes: ['130', '131', '132', '145', '155', '156', '166', '171', '175', '176', '185', '186', '196']
    },
    { 
      code: 'china_telecom', 
      name: '中国电信',
      prefixes: ['133', '149', '153', '173', '177', '180', '181', '189', '191', '193', '199']
    },
    { 
      code: 'china_virtual', 
      name: '虚拟运营商',
      prefixes: ['162', '165', '167', '170', '171']
    }
  ];

  // 省份代码
  const provinces = [
    { code: '10', name: '北京', mobilePrefix: '10' },
    { code: '20', name: '上海', mobilePrefix: '21' },
    { code: '30', name: '天津', mobilePrefix: '22' },
    { code: '40', name: '重庆', mobilePrefix: '23' },
    { code: '50', name: '河北', mobilePrefix: '311' },
    { code: '60', name: '山西', mobilePrefix: '351' },
    { code: '70', name: '辽宁', mobilePrefix: '24' },
    { code: '80', name: '吉林', mobilePrefix: '431' },
    { code: '90', name: '黑龙江', mobilePrefix: '451' },
    { code: '100', name: '江苏', mobilePrefix: '25' },
    { code: '110', name: '浙江', mobilePrefix: '571' },
    { code: '120', name: '安徽', mobilePrefix: '551' },
    { code: '130', name: '福建', mobilePrefix: '591' },
    { code: '140', name: '江西', mobilePrefix: '791' },
    { code: '150', name: '山东', mobilePrefix: '531' },
    { code: '160', name: '河南', mobilePrefix: '371' },
    { code: '170', name: '湖北', mobilePrefix: '27' },
    { code: '180', name: '湖南', mobilePrefix: '731' },
    { code: '190', name: '广东', mobilePrefix: '20' },
    { code: '200', name: '海南', mobilePrefix: '898' },
    { code: '210', name: '四川', mobilePrefix: '28' },
    { code: '220', name: '贵州', mobilePrefix: '851' },
    { code: '230', name: '云南', mobilePrefix: '871' },
    { code: '240', name: '陕西', mobilePrefix: '29' },
    { code: '250', name: '甘肃', mobilePrefix: '931' },
    { code: '260', name: '青海', mobilePrefix: '971' },
    { code: '270', name: '内蒙古', mobilePrefix: '471' },
    { code: '280', name: '广西', mobilePrefix: '771' },
    { code: '290', name: '西藏', mobilePrefix: '891' },
    { code: '300', name: '宁夏', mobilePrefix: '951' },
    { code: '310', name: '新疆', mobilePrefix: '991' }
  ];

  // 生成随机手机号码
  const generatePhoneNumber = (): string => {
    let selectedPrefixes: string[] = [];
    
    if (operator) {
      const selectedOperator = operators.find(op => op.code === operator);
      if (selectedOperator) {
        selectedPrefixes = selectedOperator.prefixes;
      }
    } else {
      // 如果没有选择运营商，使用所有前缀
      operators.forEach(op => {
        selectedPrefixes = selectedPrefixes.concat(op.prefixes);
      });
    }

    // 随机选择前缀
    const prefix = selectedPrefixes[Math.floor(Math.random() * selectedPrefixes.length)];
    
    // 生成后8位数字
    let suffix = '';
    for (let i = 0; i < 8; i++) {
      suffix += Math.floor(Math.random() * 10).toString();
    }

    return prefix + suffix;
  };

  // 获取运营商信息
  const getOperatorInfo = (phoneNumber: string) => {
    const prefix = phoneNumber.substring(0, 3);
    
    for (const op of operators) {
      if (op.prefixes.includes(prefix)) {
        return op.name;
      }
    }
    
    return '未知';
  };

  // 批量生成手机号码
  const handleGenerate = () => {
    const phones: string[] = [];
    for (let i = 0; i < count; i++) {
      phones.push(generatePhoneNumber());
    }
    setGeneratedPhones(phones);
    message.success(`成功生成 ${count} 个手机号码`);
  };

  // 复制到剪贴板
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  // 复制所有
  const handleCopyAll = () => {
    const allText = generatedPhones.join('\n');
    navigator.clipboard.writeText(allText);
    message.success('已复制所有号码到剪贴板');
  };

  // 清空结果
  const handleClear = () => {
    setGeneratedPhones([]);
  };

  // 获取运营商颜色
  const getOperatorColor = (operatorName: string) => {
    switch (operatorName) {
      case '中国移动':
        return 'blue';
      case '中国联通':
        return 'red';
      case '中国电信':
        return 'green';
      default:
        return 'default';
    }
  };

  return (
    <div>
      <Title level={2}>手机号码生成器</Title>
      
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
                <Text strong>运营商：</Text>
                <Select
                  value={operator}
                  onChange={setOperator}
                  placeholder="随机运营商"
                  allowClear
                  style={{ width: '100%', marginTop: 8 }}
                >
                  {operators.map(op => (
                    <Select.Option key={op.code} value={op.code}>
                      {op.name}
                    </Select.Option>
                  ))}
                </Select>
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
              generatedPhones.length > 0 && (
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
            {generatedPhones.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {generatedPhones.map((phone, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Space>
                      <Text code>{phone}</Text>
                      <Tag color={getOperatorColor(getOperatorInfo(phone))}>
                        {getOperatorInfo(phone)}
                      </Tag>
                    </Space>
                    <Button 
                      size="small" 
                      type="text" 
                      icon={<CopyOutlined />}
                      onClick={() => handleCopy(phone)}
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
            <p>• 生成的手机号码符合中国手机号码格式（11位）</p>
            <p>• 支持按运营商筛选：中国移动、中国联通、中国电信、虚拟运营商</p>
            <p>• 号码仅用于测试目的，请勿用于非法用途</p>
            <p>• 生成的号码都是虚拟号码，不会实际分配给用户</p>
          </div>
        }
        type="info"
        showIcon
      />

      <Divider />

      <Title level={4}>运营商号段说明</Title>
      <Row gutter={[16, 16]}>
        {operators.map(op => (
          <Col xs={24} md={12} key={op.code}>
            <Card size="small" title={op.name}>
              <Space wrap>
                {op.prefixes.map(prefix => (
                  <Tag key={prefix} color={getOperatorColor(op.name)}>
                    {prefix}
                  </Tag>
                ))}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default PhoneGenerator;