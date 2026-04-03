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
  FunctionOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface BuiltinFunctionItem {
  id: string;
  name: string;
  category: 'time' | 'number' | 'string' | 'encode' | 'extract';
  description: string;
  expression: string;
  examples: string[];
  keywords?: string[];
  preview: () => string;
}

interface CustomFunctionItem {
  id: string;
  name: string;
  params: string;
  description: string;
  code: string;
  createdAt: string;
}

const CUSTOM_FUNCTIONS_KEY = 'data-warehouse:custom-python-functions:v1';

const randomInt = (min: number, max: number) => {
  const m1 = Math.min(min, max);
  const m2 = Math.max(min, max);
  return Math.floor(Math.random() * (m2 - m1 + 1)) + m1;
};

const randomString = (len: number, chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') => {
  let result = '';
  for (let i = 0; i < len; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const randomChoice = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const buildBuiltinFunctions = (): BuiltinFunctionItem[] => [
  {
    id: 'random_timestamp_ms',
    name: '随机时间戳（毫秒）',
    category: 'time',
    description: '返回当前时间附近的随机毫秒时间戳。',
    expression: '{{func.random_timestamp_ms()}}',
    examples: ['订单号后缀', 'traceId'],
    keywords: ['timestamp', '毫秒', 'time'],
    preview: () => String(Date.now() + randomInt(0, 9999)),
  },
  {
    id: 'random_timestamp_sec',
    name: '随机时间戳（秒）',
    category: 'time',
    description: '返回当前时间附近的随机秒级时间戳。',
    expression: '{{func.random_timestamp_sec()}}',
    examples: ['事件时间', '过期时间基准'],
    keywords: ['timestamp', '秒'],
    preview: () => String(Math.floor(Date.now() / 1000) + randomInt(0, 3600)),
  },
  {
    id: 'now_format',
    name: '当前时间格式化',
    category: 'time',
    description: '按格式返回当前时间。',
    expression: "{{func.now(format='YYYY-MM-DD HH:mm:ss')}}",
    examples: ['请求时间', '日志时间'],
    keywords: ['date', 'format'],
    preview: () => new Date().toLocaleString(),
  },
  {
    id: 'now_plus',
    name: '时间偏移',
    category: 'time',
    description: '在当前时间基础上加减天/小时等。',
    expression: "{{func.now_plus(days=1, hours=2, format='YYYY-MM-DD HH:mm:ss')}}",
    examples: ['到期时间', '预约时间'],
    keywords: ['plus', 'offset'],
    preview: () => new Date(Date.now() + 26 * 3600 * 1000).toLocaleString(),
  },
  {
    id: 'random_number',
    name: '随机长度数字串',
    category: 'number',
    description: '按长度生成纯数字字符串。',
    expression: '{{func.random_number(length=8)}}',
    examples: ['验证码', '会员号'],
    keywords: ['digit', 'length'],
    preview: () => String(randomInt(10 ** 7, 10 ** 8 - 1)),
  },
  {
    id: 'increment_number',
    name: '自增数字',
    category: 'number',
    description: '按 key 维度维护序列号。',
    expression: "{{func.inc(key='order_seq', start=1000, step=1)}}",
    examples: ['订单序列', '批次号'],
    keywords: ['inc', 'sequence'],
    preview: () => String(randomInt(1000, 9999)),
  },
  {
    id: 'range_number',
    name: '范围随机数字',
    category: 'number',
    description: '生成 [min, max] 区间随机整数。',
    expression: '{{func.random_int(min=1, max=100)}}',
    examples: ['库存', '年龄', '数量'],
    keywords: ['random', 'range', 'int'],
    preview: () => String(randomInt(1, 100)),
  },
  {
    id: 'random_choice',
    name: '随机枚举值',
    category: 'number',
    description: '从给定列表中随机取值。',
    expression: "{{func.choice(items='A,B,C')}}",
    examples: ['随机渠道', '随机状态'],
    keywords: ['enum', 'choice'],
    preview: () => randomChoice(['A', 'B', 'C']),
  },
  {
    id: 'random_string',
    name: '随机字符串',
    category: 'string',
    description: '按长度生成字母数字混合字符串。',
    expression: "{{func.random_str(length=12, chars='a-zA-Z0-9')}}",
    examples: ['用户名', 'nonce'],
    keywords: ['string', 'random'],
    preview: () => randomString(10),
  },
  {
    id: 'uuid_v4',
    name: 'UUID（v4）',
    category: 'string',
    description: '生成标准 UUID v4。',
    expression: '{{func.uuid()}}',
    examples: ['requestId', '幂等键'],
    keywords: ['uuid', 'guid'],
    preview: () => {
      const tpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
      return tpl.replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
  },
  {
    id: 'random_email',
    name: '随机邮箱',
    category: 'string',
    description: '生成随机邮箱地址。',
    expression: "{{func.random_email(domain='example.com')}}",
    examples: ['注册账号', '联系邮箱'],
    keywords: ['email', 'mail'],
    preview: () => `u_${randomString(6).toLowerCase()}@example.com`,
  },
  {
    id: 'random_phone_cn',
    name: '随机手机号（中国）',
    category: 'string',
    description: '生成 1 开头的 11 位手机号。',
    expression: '{{func.random_phone_cn()}}',
    examples: ['手机号字段', '联系人信息'],
    keywords: ['phone', 'mobile'],
    preview: () => `1${randomInt(30, 99)}${String(randomInt(0, 99999999)).padStart(8, '0')}`,
  },
  {
    id: 'substr',
    name: '字符串截取',
    category: 'string',
    description: '从原始字符串中截取片段。',
    expression: "{{func.substr(value='abcdef', start=1, end=4)}}",
    examples: ['证件号脱敏', '短码生成'],
    keywords: ['substring', 'slice'],
    preview: () => 'abcdef'.slice(1, 4),
  },
  {
    id: 'replace',
    name: '字符串替换',
    category: 'string',
    description: '对字符串进行替换。',
    expression: "{{func.replace(value='A-B-C', old='-', new='_')}}",
    examples: ['模板修正', '格式转换'],
    keywords: ['replace'],
    preview: () => 'A-B-C'.replace(/-/g, '_'),
  },
  {
    id: 'base64_encode',
    name: 'Base64 编码',
    category: 'encode',
    description: '将明文编码为 Base64。',
    expression: "{{func.base64_encode(value='hello')}}",
    examples: ['Header 组装', 'payload 包装'],
    keywords: ['base64', 'encode'],
    preview: () => 'aGVsbG8=',
  },
  {
    id: 'base64_decode',
    name: 'Base64 解码',
    category: 'encode',
    description: '将 Base64 字符串还原为明文。',
    expression: "{{func.base64_decode(value='aGVsbG8=')}}",
    examples: ['响应解码', '字段还原'],
    keywords: ['base64', 'decode'],
    preview: () => 'hello',
  },
  {
    id: 'url_encode',
    name: 'URL 编码',
    category: 'encode',
    description: '对参数进行 URL 编码。',
    expression: "{{func.url_encode(value='中文 空格')}}",
    examples: ['query 参数', '回调地址'],
    keywords: ['url', 'encode'],
    preview: () => encodeURIComponent('中文 空格'),
  },
  {
    id: 'url_decode',
    name: 'URL 解码',
    category: 'encode',
    description: '对 URL 编码值进行解码。',
    expression: "{{func.url_decode(value='%E4%B8%AD%E6%96%87%20%E7%A9%BA%E6%A0%BC')}}",
    examples: ['参数还原'],
    keywords: ['url', 'decode'],
    preview: () => decodeURIComponent('%E4%B8%AD%E6%96%87%20%E7%A9%BA%E6%A0%BC'),
  },
  {
    id: 'md5',
    name: 'MD5 摘要',
    category: 'encode',
    description: '对字符串计算 MD5 摘要（执行端实现）。',
    expression: "{{func.md5(value='hello')}}",
    examples: ['签名串', '摘要校验'],
    keywords: ['hash', 'md5'],
    preview: () => '5d41402abc4b2a76b9719d911017c592',
  },
  {
    id: 'sha256',
    name: 'SHA256 摘要',
    category: 'encode',
    description: '对字符串计算 SHA256 摘要（执行端实现）。',
    expression: "{{func.sha256(value='hello')}}",
    examples: ['安全签名', '完整性校验'],
    keywords: ['hash', 'sha256'],
    preview: () => '2cf24dba5fb0a30e... (示意)',
  },
  {
    id: 'json_path',
    name: 'JSON 路径提取',
    category: 'extract',
    description: '从 JSON 文本/对象中按路径提取字段。',
    expression: "{{func.json_get(path='data.user.id', default='0')}}",
    examples: ['提取 token', '关联字段回填'],
    keywords: ['json', 'path', 'extract'],
    preview: () => '1024',
  },
  {
    id: 'regex_extract',
    name: '正则提取',
    category: 'extract',
    description: '按正则表达式提取内容。',
    expression: "{{func.regex_extract(pattern='token=(\\w+)', group=1)}}",
    examples: ['Header 提取', '文本响应解析'],
    keywords: ['regex', 'extract'],
    preview: () => 'token_abc123',
  },
];

const loadCustomFunctions = (): CustomFunctionItem[] => {
  try {
    const raw = window.localStorage.getItem(CUSTOM_FUNCTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveCustomFunctions = (items: CustomFunctionItem[]) => {
  try {
    window.localStorage.setItem(CUSTOM_FUNCTIONS_KEY, JSON.stringify(items));
  } catch {
    message.warning('本地存储失败，请检查浏览器存储空间');
  }
};

const categoryOptions = [
  { label: '全部分类', value: 'all' },
  { label: '时间', value: 'time' },
  { label: '数字', value: 'number' },
  { label: '字符串', value: 'string' },
  { label: '编码/摘要', value: 'encode' },
  { label: '提取/解析', value: 'extract' },
] as const;

const categoryColorMap: Record<string, string> = {
  time: 'geekblue',
  number: 'gold',
  string: 'green',
  encode: 'purple',
  extract: 'cyan',
};

const CommonFunctions: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<'all' | 'time' | 'number' | 'string' | 'encode' | 'extract'>('all');
  const [customFunctions, setCustomFunctions] = useState<CustomFunctionItem[]>(loadCustomFunctions);
  const [customForm] = Form.useForm();

  const builtinFunctions = useMemo(() => buildBuiltinFunctions(), []);

  const filteredBuiltin = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return builtinFunctions.filter((item) => {
      const categoryMatched = category === 'all' || item.category === category;
      const indexText = [
        item.name,
        item.description,
        item.expression,
        ...(item.keywords || []),
        ...item.examples,
      ]
        .join(' ')
        .toLowerCase();
      const keywordMatched = !kw || indexText.includes(kw);
      return categoryMatched && keywordMatched;
    });
  }, [builtinFunctions, keyword, category]);

  const copyText = async (text: string, successMsg = '已复制到剪贴板') => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(successMsg);
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  const handleSaveCustom = async () => {
    try {
      const values = await customForm.validateFields();
      const name = String(values.name || '').trim();
      const params = String(values.params || '').trim();
      const description = String(values.description || '').trim();
      const code = String(values.code || '').trim();

      if (!name || !code) {
        message.warning('函数名称与代码不能为空');
        return;
      }

      const item: CustomFunctionItem = {
        id: `cf-${Date.now()}`,
        name,
        params,
        description,
        code,
        createdAt: new Date().toISOString(),
      };
      const next = [item, ...customFunctions];
      setCustomFunctions(next);
      saveCustomFunctions(next);
      customForm.resetFields();
      customForm.setFieldValue(
        'code',
        "def my_func(ctx):\n    # ctx 为执行上下文（dict）\n    return 'hello'"
      );
      message.success('自定义函数已保存');
    } catch {
      // 表单校验
    }
  };

  const handleDeleteCustom = (id: string) => {
    const next = customFunctions.filter((item) => item.id !== id);
    setCustomFunctions(next);
    saveCustomFunctions(next);
    message.success('已删除自定义函数');
  };

  const customCallExpr = (item: CustomFunctionItem) => {
    const params = item.params ? `(${item.params})` : '()';
    return `{{py.${item.name}${params}}}`;
  };

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1720, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={2} style={{ marginBottom: 6 }}>
          <FunctionOutlined style={{ marginRight: 8 }} />
          常用函数
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          内置函数支持一键复制，兼容接口测试与接口自动化；右侧可编写 Python 自定义函数。
        </Paragraph>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={15}>
          <Card bordered={false} className="glass-panel" style={{ borderRadius: 16 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <Input
                allowClear
                size="large"
                style={{ width: 280 }}
                placeholder="搜索函数名称/表达式/关键字"
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
              <Tag color="blue">共 {filteredBuiltin.length} 个</Tag>
            </div>

            <Row gutter={[12, 12]}>
              {filteredBuiltin.map((item) => (
                <Col xs={24} md={12} xl={8} key={item.id}>
                  <Card
                    size="small"
                    hoverable
                    style={{
                      borderRadius: 12,
                      height: '100%',
                      background: 'linear-gradient(135deg, rgba(22,119,255,0.28) 0%, rgba(123,177,255,0.18) 35%, rgba(240,248,255,0.98) 100%)',
                      border: '1px solid rgba(22,119,255,0.35)',
                      boxShadow: '0 10px 22px rgba(22,119,255,0.16)',
                    }}
                    bodyStyle={{
                      background: 'transparent',
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
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyText(item.expression, `已复制：${item.name}`)}
                      >
                        复制
                      </Button>
                    }
                  >
                    <Paragraph type="secondary" ellipsis={{ rows: 2, tooltip: item.description }} style={{ marginBottom: 8 }}>
                      {item.description}
                    </Paragraph>
                    <Text code style={{ display: 'block', marginBottom: 6 }}>{item.expression}</Text>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      示例：{item.preview()}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      场景：{item.examples.join(' / ')}
                    </Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card bordered={false} className="glass-panel" style={{ borderRadius: 16 }}>
            <Title level={4} style={{ marginTop: 0 }}>Python 自定义函数</Title>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="函数保存到本地浏览器，可在接口测试/接口自动化中按表达式调用。"
              description="建议调用格式：{{py.函数名(...)}}（后续由执行引擎统一接入）"
            />

            <Form
              form={customForm}
              layout="vertical"
              initialValues={{
                code: "def my_func(ctx):\n    # ctx 为执行上下文（dict）\n    return 'hello'",
              }}
            >
              <Form.Item
                name="name"
                label="函数名"
                rules={[
                  { required: true, message: '请输入函数名' },
                  { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: '函数名仅支持字母/数字/下划线，且不能数字开头' },
                ]}
              >
                <Input placeholder="例如：build_sign" />
              </Form.Item>
              <Form.Item name="params" label="参数定义（可选）">
                <Input placeholder="例如：app_id, secret, timestamp" />
              </Form.Item>
              <Form.Item name="description" label="说明（可选）">
                <Input placeholder="例如：生成签名" />
              </Form.Item>
              <Form.Item name="code" label="Python 代码" rules={[{ required: true, message: '请输入函数代码' }]}>
                <TextArea rows={10} style={{ fontFamily: 'Menlo,Consolas,monospace' }} />
              </Form.Item>
              <Button type="primary" icon={<SaveOutlined />} block onClick={handleSaveCustom}>
                保存自定义函数
              </Button>
            </Form>

            <Divider style={{ margin: '16px 0' }} />
            <Space style={{ marginBottom: 8 }}>
              <Title level={5} style={{ margin: 0 }}>已保存函数</Title>
              <Tag>{customFunctions.length}</Tag>
            </Space>

            <List
              size="small"
              dataSource={customFunctions}
              rowKey="id"
              locale={{ emptyText: '暂无自定义函数' }}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Text strong>{item.name}</Text>
                      <Space>
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyText(customCallExpr(item), '调用表达式已复制')}
                        >
                          复制调用
                        </Button>
                        <Popconfirm title="确认删除该函数？" onConfirm={() => handleDeleteCustom(item.id)}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    </Space>
                    <Text type="secondary" ellipsis>{item.description || '无描述'}</Text>
                    <Text code>{customCallExpr(item)}</Text>
                  </Space>
                </List.Item>
              )}
            />

            <Button
              style={{ marginTop: 10 }}
              block
              icon={<PlusOutlined />}
              onClick={() =>
                customForm.setFieldsValue({
                  name: '',
                  params: '',
                  description: '',
                  code: "def my_func(ctx):\n    # ctx 为执行上下文（dict）\n    return 'hello'",
                })
              }
            >
              新建函数模板
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CommonFunctions;
