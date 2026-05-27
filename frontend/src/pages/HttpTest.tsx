import React, { useEffect, useMemo, useState } from 'react';
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
  Switch,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  GlobalOutlined,
  HistoryOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { environmentApi, testApi } from '../services/api';
import { HttpTestRequest, HttpTestResponse } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

type Method = HttpTestRequest['method'];

interface KVItem {
  key: string;
  value: string;
}

interface HistoryItem {
  method: Method;
  url: string;
  status: number;
  executionTime: number;
  createdAt: string;
}

const METHODS: Method[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
const codeBlockStyle: React.CSSProperties = {
  margin: 0,
  padding: 12,
  borderRadius: 10,
  background: '#0f172a',
  color: '#dbeafe',
  fontSize: 12,
  lineHeight: 1.55,
  maxHeight: 320,
  overflow: 'auto',
};

const getMethodColor = (method: Method | string) => {
  const m = String(method).toUpperCase();
  if (m === 'GET') return '#1677ff';
  if (m === 'POST') return '#52c41a';
  if (m === 'PUT') return '#faad14';
  if (m === 'DELETE') return '#ff4d4f';
  if (m === 'PATCH') return '#13c2c2';
  return '#8c8c8c';
};

const initialKV = (): KVItem[] => [{ key: '', value: '' }];

const kvToObject = (rows: KVItem[]): Record<string, string> =>
  rows.reduce((acc, row) => {
    const k = String(row.key || '').trim();
    if (!k) return acc;
    acc[k] = String(row.value || '');
    return acc;
  }, {} as Record<string, string>);

const getResponseSize = (body: any) => {
  const text = typeof body === 'string' ? body : JSON.stringify(body || '');
  return `${Math.max(1, Math.round((text.length || 0) / 1024))} KB`;
};

const HttpTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HttpTestResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [environmentId, setEnvironmentId] = useState<number | undefined>();
  const [accountPoolId, setAccountPoolId] = useState<number | undefined>();
  const [dataPoolId, setDataPoolId] = useState<number | undefined>();
  const [preScript, setPreScript] = useState('');
  const [postScript, setPostScript] = useState('');
  const [persistExtracted, setPersistExtracted] = useState(false);

  const [method, setMethod] = useState<Method>('GET');
  const [url, setUrl] = useState('');
  const [paramsRows, setParamsRows] = useState<KVItem[]>(initialKV());
  const [headerRows, setHeaderRows] = useState<KVItem[]>(initialKV());
  const [bodyType, setBodyType] = useState<'json' | 'raw'>('json');
  const [bodyText, setBodyText] = useState('');
  const [timeout, setTimeoutValue] = useState(30);
  const [verifySSL, setVerifySSL] = useState(true);
  const [followRedirects, setFollowRedirects] = useState(true);

  useEffect(() => {
    environmentApi
      .list()
      .then((items) => {
        setEnvironments(items || []);
        const defaultEnv = (items || []).find((item: any) => item.is_default);
        if (defaultEnv) {
          setEnvironmentId(defaultEnv.id);
        }
      })
      .catch(() => message.warning('环境列表加载失败，仍可直接请求'));
  }, []);

  const selectedEnvironment = useMemo(
    () => environments.find((item) => item.id === environmentId),
    [environmentId, environments]
  );

  const responseBodyText = useMemo(() => {
    if (!result) return '';
    if (typeof result.body === 'string') return result.body;
    try {
      return JSON.stringify(result.body, null, 2);
    } catch {
      return String(result.body);
    }
  }, [result]);

  const renderKVEditor = (
    rows: KVItem[],
    setRows: React.Dispatch<React.SetStateAction<KVItem[]>>,
    keyLabel: string,
    valueLabel: string
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 8 }}>
        <Text type="secondary">{keyLabel}</Text>
        <Text type="secondary">{valueLabel}</Text>
        <span />
      </div>
      {rows.map((row, idx) => (
        <div key={`${idx}-${row.key}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 8 }}>
          <Input
            value={row.key}
            placeholder={keyLabel}
            onChange={(e) =>
              setRows((prev) => prev.map((item, i) => (i === idx ? { ...item, key: e.target.value } : item)))
            }
          />
          <Input
            value={row.value}
            placeholder={valueLabel}
            onChange={(e) =>
              setRows((prev) => prev.map((item, i) => (i === idx ? { ...item, value: e.target.value } : item)))
            }
          />
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={() =>
              setRows((prev) => {
                const next = prev.filter((_, i) => i !== idx);
                return next.length ? next : initialKV();
              })
            }
          />
        </div>
      ))}
      <Button
        onClick={() => setRows((prev) => [...prev, { key: '', value: '' }])}
        style={{ borderStyle: 'dashed' }}
      >
        新增一行
      </Button>
    </div>
  );

  const handleSend = async () => {
    if (!url.trim()) {
      message.error('请输入请求 URL');
      return;
    }

    let parsedBody: any = bodyText;
    if (bodyType === 'json' && bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        message.error('Body 不是合法 JSON');
        return;
      }
    }

    const payload: HttpTestRequest = {
      url: url.trim(),
      method,
      headers: kvToObject(headerRows),
      params: kvToObject(paramsRows),
      body: parsedBody,
      timeout,
      verify_ssl: verifySSL,
      follow_redirects: followRedirects,
      environment_id: environmentId,
      account_pool_id: accountPoolId,
      data_pool_id: dataPoolId,
      pre_script: preScript,
      post_script: postScript,
      persist_extracted: persistExtracted,
    };

    setLoading(true);
    try {
      const res = await testApi.testHttp(payload);
      setResult(res);
      setHistory((prev) => [
        {
          method,
          url: payload.url,
          status: res.status_code,
          executionTime: res.execution_time,
          createdAt: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 12));

      if (res.success) message.success('请求成功');
      else message.warning(res.error_message || '请求已完成，返回非成功状态');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '请求失败');
      setResult({
        success: false,
        status_code: 0,
        execution_time: 0,
        headers: {},
        body: '',
        error_message: e?.response?.data?.detail || '请求失败',
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
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>HTTP 测试</Title>
          <Text type="secondary">参数清晰、响应直观的接口调试面板</Text>
        </div>
        <Space>
          {selectedEnvironment && <Tag color="processing">环境 {selectedEnvironment.name}</Tag>}
          <Tag icon={<HistoryOutlined />} color="blue">最近记录 {history.length}</Tag>
          <Tag icon={<ClockCircleOutlined />} color="geekblue">超时 {timeout}s</Tag>
        </Space>
      </div>

      <div className="glass-panel" style={{ borderRadius: 16, background: '#fff', padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '190px 130px 1fr 120px', gap: 10 }}>
          <Select
            allowClear
            size="large"
            placeholder="选择环境"
            value={environmentId}
            onChange={(value) => {
              setEnvironmentId(value);
              setAccountPoolId(undefined);
              setDataPoolId(undefined);
            }}
            options={environments.map((item) => ({ label: `${item.name}${item.base_url ? ` - ${item.base_url}` : ''}`, value: item.id }))}
          />
          <Select value={method} onChange={setMethod} size="large">
            {METHODS.map((m) => (
              <Select.Option key={m} value={m}>
                <span style={{ color: getMethodColor(m), fontWeight: 700 }}>{m}</span>
              </Select.Option>
            ))}
          </Select>
          <Input
            size="large"
            value={url}
            placeholder="请输入请求地址，例如 https://api.example.com/v1/users"
            prefix={<GlobalOutlined style={{ color: '#91a2c0' }} />}
            onChange={(e) => setUrl(e.target.value)}
            onPressEnter={handleSend}
            style={{ fontSize: 14, fontWeight: 500 }}
          />
          <Button
            type="primary"
            size="large"
            icon={<SendOutlined />}
            loading={loading}
            onClick={handleSend}
            style={{ fontWeight: 700 }}
          >
            发送请求
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '56% 44%', gap: 14, flex: 1, minHeight: 0 }}>
        <Card
          title="请求配置"
          style={{ borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ paddingTop: 10, overflow: 'auto' }}
        >
          <Tabs
            defaultActiveKey="params"
            items={[
              {
                key: 'params',
                label: 'Query 参数',
                children: renderKVEditor(paramsRows, setParamsRows, '参数名', '参数值'),
              },
              {
                key: 'headers',
                label: 'Headers',
                children: renderKVEditor(headerRows, setHeaderRows, 'Header 名', 'Header 值'),
              },
              {
                key: 'body',
                label: 'Body',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size={10}>
                    <Space>
                      <Text strong>格式</Text>
                      <Select
                        value={bodyType}
                        onChange={(v) => setBodyType(v)}
                        options={[
                          { value: 'json', label: 'JSON' },
                          { value: 'raw', label: 'Raw Text' },
                        ]}
                        style={{ width: 140 }}
                      />
                      <Tag icon={<CodeOutlined />} color="processing">建议使用 JSON</Tag>
                    </Space>
                    <TextArea
                      rows={12}
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      placeholder={bodyType === 'json' ? '{\n  "id": 1\n}' : '输入原始文本'}
                      style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 13, borderRadius: 10 }}
                    />
                  </Space>
                ),
              },
              {
                key: 'settings',
                label: '环境与脚本',
                children: (
                  <Row gutter={[12, 12]}>
                    <Col span={12}>
                      <Text type="secondary">账号池</Text>
                      <Select
                        allowClear
                        value={accountPoolId}
                        onChange={setAccountPoolId}
                        style={{ width: '100%', marginTop: 6 }}
                        options={(selectedEnvironment?.account_pools || []).map((item: any) => ({ label: item.name, value: item.id }))}
                      />
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">数据池</Text>
                      <Select
                        allowClear
                        value={dataPoolId}
                        onChange={setDataPoolId}
                        style={{ width: '100%', marginTop: 6 }}
                        options={(selectedEnvironment?.data_pools || []).map((item: any) => ({ label: item.name, value: item.id }))}
                      />
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">超时（秒）</Text>
                      <InputNumber
                        min={1}
                        max={300}
                        value={timeout}
                        onChange={(v) => setTimeoutValue(Number(v) || 30)}
                        style={{ width: '100%', marginTop: 6 }}
                      />
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">SSL 证书校验</Text>
                      <div style={{ marginTop: 10 }}><Switch checked={verifySSL} onChange={setVerifySSL} /></div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">跟随重定向</Text>
                      <div style={{ marginTop: 10 }}><Switch checked={followRedirects} onChange={setFollowRedirects} /></div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">提取变量写回环境</Text>
                      <div style={{ marginTop: 10 }}><Switch checked={persistExtracted} onChange={setPersistExtracted} /></div>
                    </Col>
                    <Col span={24}>
                      <Text type="secondary">前置脚本</Text>
                      <TextArea
                        rows={4}
                        value={preScript}
                        onChange={(e) => setPreScript(e.target.value)}
                        placeholder={'set token={{account.token}}\nset requestId={{$uuid}}'}
                        style={{ marginTop: 6, fontFamily: 'Consolas, Monaco, monospace' }}
                      />
                    </Col>
                    <Col span={24}>
                      <Text type="secondary">后置脚本 / 依赖取值</Text>
                      <TextArea
                        rows={4}
                        value={postScript}
                        onChange={(e) => setPostScript(e.target.value)}
                        placeholder={'extract token json $.data.token\nextract traceId header X-Trace-Id'}
                        style={{ marginTop: 6, fontFamily: 'Consolas, Monaco, monospace' }}
                      />
                    </Col>
                  </Row>
                ),
              },
            ]}
          />
        </Card>

        <Card
          title="响应结果"
          style={{ borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ paddingTop: 10, overflow: 'auto' }}
          extra={
            <Tag color={result?.success ? 'success' : result ? 'error' : 'default'}>
              {result ? (result.success ? '成功' : '失败') : '待执行'}
            </Tag>
          }
        >
          {!result ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="发送请求后在这里查看响应详情" />
            </div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  background: '#f7fbff',
                  border: '1px solid #d6e4ff',
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div>
                  <Text type="secondary">状态码</Text>
                  <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: result.status_code >= 200 && result.status_code < 300 ? '#389e0d' : '#cf1322' }}>
                    {result.status_code || '--'}
                  </div>
                </div>
                <div>
                  <Text type="secondary">耗时</Text>
                  <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{result.execution_time} ms</div>
                </div>
                <div>
                  <Text type="secondary">大小</Text>
                  <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{getResponseSize(result.body)}</div>
                </div>
              </div>

              {result.error_message && (
                <Alert type="error" showIcon message="请求异常" description={result.error_message} />
              )}
              {result.extracted_variables && Object.keys(result.extracted_variables).length > 0 && (
                <Alert
                  type="success"
                  showIcon
                  message="已提取变量"
                  description={<pre style={{ margin: 0 }}>{JSON.stringify(result.extracted_variables, null, 2)}</pre>}
                />
              )}

              <Tabs
                defaultActiveKey="body"
                items={[
                  {
                    key: 'body',
                    label: 'Body',
                    children: (
                      <pre style={codeBlockStyle}>
                        {responseBodyText || '无响应体'}
                      </pre>
                    ),
                  },
                  {
                    key: 'headers',
                    label: 'Headers',
                    children: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Object.keys(result.headers || {}).length ? Object.entries(result.headers || {}).map(([k, v]) => (
                          <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, padding: 8, borderRadius: 8, background: '#fafafa' }}>
                            <Text strong>{k}</Text>
                            <Text style={{ wordBreak: 'break-all' }}>{String(v)}</Text>
                          </div>
                        )) : <Text type="secondary">无响应头</Text>}
                      </div>
                    ),
                  },
                ]}
              />
            </Space>
          )}
        </Card>
      </div>

      {history.length > 0 && (
        <Card style={{ marginTop: 14, borderRadius: 16 }} title="最近请求记录">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((item, idx) => (
              <div
                key={`${item.url}-${item.createdAt}-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr 80px 90px 90px',
                  gap: 8,
                  alignItems: 'center',
                  padding: 8,
                  borderRadius: 8,
                  background: '#fafafa',
                }}
              >
                <Tag style={{ margin: 0, color: getMethodColor(item.method), borderColor: `${getMethodColor(item.method)}66` }}>
                  {item.method}
                </Tag>
                <Text ellipsis={{ tooltip: item.url }}>{item.url}</Text>
                <Text>{item.status}</Text>
                <Text>{item.executionTime}ms</Text>
                <Text type="secondary">{item.createdAt}</Text>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default HttpTest;
