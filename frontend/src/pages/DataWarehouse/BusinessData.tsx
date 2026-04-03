import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  List,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  HddOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

interface BuiltinSampleItem {
  id: string;
  name: string;
  category: 'account' | 'order' | 'contact' | 'payment' | 'device';
  description: string;
  generate: () => string;
  expression: string;
}

interface CustomSampleItem {
  id: string;
  name: string;
  category: string;
  value: string;
  description?: string;
  createdAt: string;
}

const CUSTOM_SAMPLES_KEY = 'data-warehouse:business-samples:v1';

const randomInt = (min: number, max: number) => {
  const n1 = Math.min(min, max);
  const n2 = Math.max(min, max);
  return Math.floor(Math.random() * (n2 - n1 + 1)) + n1;
};

const randomString = (len: number, chars = 'abcdefghijklmnopqrstuvwxyz0123456789') => {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
};

const loadCustomSamples = (): CustomSampleItem[] => {
  try {
    const raw = window.localStorage.getItem(CUSTOM_SAMPLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveCustomSamples = (items: CustomSampleItem[]) => {
  try {
    window.localStorage.setItem(CUSTOM_SAMPLES_KEY, JSON.stringify(items));
  } catch {
    message.warning('本地保存失败，请检查浏览器存储空间');
  }
};

const buildBuiltinSamples = (): BuiltinSampleItem[] => [
  {
    id: 'test_account',
    name: '随机测试账号',
    category: 'account',
    description: '生成可读的测试账号名，适合注册/登录类场景。',
    expression: '{{data.test_account()}}',
    generate: () => `test_${randomString(6)}`,
  },
  {
    id: 'order_id_18_19',
    name: '订单 ID（18~19 位）',
    category: 'order',
    description: '生成 18 或 19 位数字订单号。',
    expression: '{{data.order_id(length=18|19)}}',
    generate: () => {
      const len = randomInt(18, 19);
      return `${randomInt(1, 9)}${String(randomInt(0, 10 ** (len - 1) - 1)).padStart(len - 1, '0')}`;
    },
  },
  {
    id: 'email_account',
    name: '随机邮箱账号',
    category: 'contact',
    description: '生成邮箱地址，适用于邮箱绑定/通知场景。',
    expression: "{{data.email(domain='example.com')}}",
    generate: () => `u_${randomString(8)}@example.com`,
  },
  {
    id: 'phone_cn',
    name: '随机手机号',
    category: 'contact',
    description: '生成中国大陆 11 位手机号。',
    expression: '{{data.phone_cn()}}',
    generate: () => `1${randomInt(30, 99)}${String(randomInt(0, 99999999)).padStart(8, '0')}`,
  },
  {
    id: 'pay_amount',
    name: '随机支付金额',
    category: 'payment',
    description: '生成 0.01 ~ 9999.99 两位小数金额。',
    expression: '{{data.pay_amount(min=0.01,max=9999.99)}}',
    generate: () => (randomInt(1, 999999) / 100).toFixed(2),
  },
  {
    id: 'device_sn',
    name: '设备序列号',
    category: 'device',
    description: '生成设备 SN（字母+数字）。',
    expression: '{{data.device_sn(prefix="SN")}}',
    generate: () => `SN-${randomString(4, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')}-${randomString(8, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')}`,
  },
  {
    id: 'idempotent_key',
    name: '幂等键',
    category: 'order',
    description: '生成幂等请求 Key，适合下单/支付幂等校验。',
    expression: '{{data.idempotent_key()}}',
    generate: () => `idem_${Date.now()}_${randomString(6)}`,
  },
  {
    id: 'trace_id',
    name: '调用链 TraceId',
    category: 'account',
    description: '生成 trace id，便于日志关联。',
    expression: '{{data.trace_id()}}',
    generate: () => `${Date.now().toString(16)}${randomString(16, 'abcdef0123456789')}`,
  },
];

const categoryOptions = [
  { label: '全部分类', value: 'all' },
  { label: '账号类', value: 'account' },
  { label: '订单类', value: 'order' },
  { label: '联系方式', value: 'contact' },
  { label: '支付类', value: 'payment' },
  { label: '设备类', value: 'device' },
] as const;

const categoryColorMap: Record<string, string> = {
  account: 'blue',
  order: 'purple',
  contact: 'green',
  payment: 'gold',
  device: 'cyan',
};

const BusinessData: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<'all' | 'account' | 'order' | 'contact' | 'payment' | 'device'>('all');
  const [customItems, setCustomItems] = useState<CustomSampleItem[]>(loadCustomSamples);
  const [previewMap, setPreviewMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    buildBuiltinSamples().forEach((item) => {
      map[item.id] = item.generate();
    });
    return map;
  });
  const [form] = Form.useForm();

  const builtinItems = useMemo(() => buildBuiltinSamples(), []);

  const filteredBuiltin = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return builtinItems.filter((item) => {
      const categoryMatched = category === 'all' || item.category === category;
      const text = `${item.name} ${item.description} ${item.expression}`.toLowerCase();
      return categoryMatched && (!kw || text.includes(kw));
    });
  }, [builtinItems, keyword, category]);

  const regenerateAll = () => {
    const next: Record<string, string> = {};
    builtinItems.forEach((item) => {
      next[item.id] = item.generate();
    });
    setPreviewMap(next);
    message.success('已刷新全部随机样本');
  };

  const copyText = async (text: string, successMsg = '复制成功') => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(successMsg);
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  const refreshOne = (item: BuiltinSampleItem) => {
    setPreviewMap((prev) => ({
      ...prev,
      [item.id]: item.generate(),
    }));
  };

  const handleSaveCustom = async () => {
    try {
      const values = await form.validateFields();
      const item: CustomSampleItem = {
        id: `sample-${Date.now()}`,
        name: String(values.name || '').trim(),
        category: String(values.category || 'custom').trim(),
        value: String(values.value || '').trim(),
        description: String(values.description || '').trim(),
        createdAt: new Date().toISOString(),
      };
      const next = [item, ...customItems];
      setCustomItems(next);
      saveCustomSamples(next);
      form.resetFields();
      message.success('样本已保存');
    } catch {
      // form validation
    }
  };

  const handleDeleteCustom = (id: string) => {
    const next = customItems.filter((it) => it.id !== id);
    setCustomItems(next);
    saveCustomSamples(next);
    message.success('已删除样本');
  };

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1700, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={2} style={{ marginBottom: 6 }}>
          <HddOutlined style={{ marginRight: 8 }} />
          业务数据
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          左侧提供常见业务随机样本（账号/订单ID/邮箱等），右侧维护可复用的自定义数据样本。
        </Paragraph>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={15}>
          <Card bordered={false} className="glass-panel" style={{ borderRadius: 16 }}>
            <Space wrap style={{ marginBottom: 12 }}>
              <Input
                allowClear
                size="large"
                style={{ width: 280 }}
                placeholder="搜索样本名称/表达式"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Select
                size="large"
                style={{ width: 280 }}
                options={categoryOptions as any}
                value={category}
                onChange={(v) => setCategory(v)}
              />
              <Button icon={<ReloadOutlined />} onClick={regenerateAll}>刷新随机值</Button>
              <Tag color="blue">{filteredBuiltin.length} 个内置样本</Tag>
            </Space>

            <Row gutter={[12, 12]}>
              {filteredBuiltin.map((item) => (
                <Col xs={24} md={12} xl={8} key={item.id}>
                  <Card
                    size="small"
                    hoverable
                    style={{
                      borderRadius: 12,
                      height: '100%',
                      background: 'linear-gradient(135deg, rgba(22,119,255,0.26) 0%, rgba(119,170,255,0.18) 35%, rgba(245,250,255,0.98) 100%)',
                      border: '1px solid rgba(22,119,255,0.34)',
                      boxShadow: '0 10px 22px rgba(22,119,255,0.14)',
                    }}
                    title={
                      <Space size={6} wrap>
                        <Text strong style={{ fontSize: 13 }}>{item.name}</Text>
                        <Tag color={categoryColorMap[item.category]}>
                          {categoryOptions.find((x) => x.value === item.category)?.label}
                        </Tag>
                      </Space>
                    }
                    extra={
                      <Space size={4}>
                        <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => refreshOne(item)} />
                        <Button
                          size="small"
                          type="text"
                          icon={<CopyOutlined />}
                          onClick={() => copyText(previewMap[item.id] || '', `已复制：${item.name}`)}
                        >
                          复制
                        </Button>
                      </Space>
                    }
                  >
                    <Paragraph type="secondary" ellipsis={{ rows: 2, tooltip: item.description }} style={{ marginBottom: 8 }}>
                      {item.description}
                    </Paragraph>
                    <Text code style={{ display: 'block', marginBottom: 6 }}>{item.expression}</Text>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      示例值：{previewMap[item.id] || '-'}
                    </Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card bordered={false} className="glass-panel" style={{ borderRadius: 16 }}>
            <Title level={4} style={{ marginTop: 0 }}>自定义数据样本</Title>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="可维护固定样本，如测试白名单账号、特定订单号、约定地址等。"
              description="数据会保存到当前浏览器本地，支持复制到接口测试与接口自动化场景。"
            />

            <Form form={form} layout="vertical">
              <Form.Item
                name="name"
                label="样本名称"
                rules={[{ required: true, message: '请输入样本名称' }]}
              >
                <Input placeholder="例如：回归测试账号A" />
              </Form.Item>
              <Form.Item
                name="category"
                label="样本分类"
                rules={[{ required: true, message: '请输入样本分类' }]}
              >
                <Input placeholder="例如：账号/订单/地址" />
              </Form.Item>
              <Form.Item
                name="value"
                label="样本值"
                rules={[{ required: true, message: '请输入样本值' }]}
              >
                <Input.TextArea rows={3} placeholder="例如：test_regression_001 / 2026031900012345678" />
              </Form.Item>
              <Form.Item name="description" label="说明（可选）">
                <Input placeholder="例如：用于支付回归的固定账号" />
              </Form.Item>
              <Button type="primary" icon={<SaveOutlined />} block onClick={handleSaveCustom}>
                保存样本
              </Button>
            </Form>

            <Divider style={{ margin: '16px 0' }} />
            <Space style={{ marginBottom: 8 }}>
              <Title level={5} style={{ margin: 0 }}>已保存样本</Title>
              <Tag>{customItems.length}</Tag>
            </Space>

            <List
              size="small"
              dataSource={customItems}
              rowKey="id"
              locale={{ emptyText: '暂无自定义样本' }}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Space>
                        <Text strong>{item.name}</Text>
                        <Tag>{item.category}</Tag>
                      </Space>
                      <Space>
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyText(item.value, '样本值已复制')}
                        >
                          复制
                        </Button>
                        <Popconfirm title="确认删除该样本？" onConfirm={() => handleDeleteCustom(item.id)}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    </Space>
                    <Text code ellipsis={{ tooltip: item.value }}>{item.value}</Text>
                    <Text type="secondary" ellipsis>{item.description || '无说明'}</Text>
                  </Space>
                </List.Item>
              )}
            />

            <Button
              style={{ marginTop: 10 }}
              block
              icon={<PlusOutlined />}
              onClick={() => form.resetFields()}
            >
              新建样本
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default BusinessData;
