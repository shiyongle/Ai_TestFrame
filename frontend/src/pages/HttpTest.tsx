import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Typography,
  Space,
  message,
  Switch,
  InputNumber,
  Alert,
  Row,
  Col,
} from 'antd';
import { PlayCircleOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { testApi } from '../services/api';
import { HttpTestRequest, HttpTestResponse } from '../types';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const HttpTest: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<HttpTestResponse | null>(null);
  const [headersText, setHeadersText] = useState('');
  const [paramsText, setParamsText] = useState('');
  const location = useLocation();

  useEffect(() => {
    if (location.state?.testcase) {
      const testcase = location.state.testcase;
      form.setFieldsValue({
        name: testcase.name,
        url: testcase.config?.url || '',
        method: testcase.config?.method || 'GET',
        headers: JSON.stringify(testcase.config?.headers || {}, null, 2),
        params: JSON.stringify(testcase.config?.params || {}, null, 2),
        body: JSON.stringify(testcase.config?.body || {}, null, 2),
        timeout: testcase.config?.timeout || 30,
        verify_ssl: testcase.config?.verify_ssl !== false,
        follow_redirects: testcase.config?.follow_redirects !== false,
      });
      setHeadersText(JSON.stringify(testcase.config?.headers || {}, null, 2));
      setParamsText(JSON.stringify(testcase.config?.params || {}, null, 2));
    }
  }, [location.state, form]);

  const handleTest = async (values: any) => {
    setLoading(true);
    setTestResult(null);

    try {
      let headers = {};
      let params = {};
      let body = values.body;

      try {
        headers = headersText ? JSON.parse(headersText) : {};
      } catch (e) {
        message.error('Headers 格式错误，请输入有效的 JSON');
        setLoading(false);
        return;
      }

      try {
        params = paramsText ? JSON.parse(paramsText) : {};
      } catch (e) {
        message.error('Params 格式错误，请输入有效的 JSON');
        setLoading(false);
        return;
      }

      try {
        if (typeof body === 'string' && body.trim()) {
          body = JSON.parse(body);
        }
      } catch (e) {
        // 允许 Body 为原始字符串
      }

      const testRequest: HttpTestRequest = {
        url: values.url,
        method: values.method,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        params: Object.keys(params).length > 0 ? params : undefined,
        body: body,
        timeout: values.timeout,
        verify_ssl: values.verify_ssl,
        follow_redirects: values.follow_redirects,
      };

      const result = await testApi.testHttp(testRequest);
      setTestResult(result);

      if (result.success) {
        message.success('测试执行成功');
      } else {
        message.error('测试执行失败');
      }
    } catch (error) {
      message.error('测试执行出错');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    message.info('保存功能待实现');
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return '#52c41a';
    if (statusCode >= 300 && statusCode < 400) return '#1890ff';
    if (statusCode >= 400 && statusCode < 500) return '#faad14';
    if (statusCode >= 500) return '#ff4d4f';
    return '#666';
  };

  return (
    <div className="fade-in">
      <Card
        bordered={false}
        style={{ marginBottom: 24 }}
        bodyStyle={{ padding: 20 }}
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#2b8df7' }} />
            <span>HTTP 接口测试</span>
          </Space>
        }
        extra={<Text type="secondary">智能请求构建 · 即时回显</Text>}
      >
        <Text className="subtle-text">
          支持多种 HTTP 方法、Header/Params/Body 自定义，快速验证接口连通性与响应表现。
        </Text>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <PlayCircleOutlined style={{ color: '#1890ff' }} />
                <span>测试配置</span>
              </Space>
            }
            className="test-card"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleTest}
              initialValues={{
                method: 'GET',
                timeout: 30,
                verify_ssl: true,
                follow_redirects: true,
              }}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="请求方法"
                    name="method"
                    rules={[{ required: true, message: '请选择请求方法' }]}
                  >
                    <Select size="large">
                      <Option value="GET">GET</Option>
                      <Option value="POST">POST</Option>
                      <Option value="PUT">PUT</Option>
                      <Option value="DELETE">DELETE</Option>
                      <Option value="PATCH">PATCH</Option>
                      <Option value="HEAD">HEAD</Option>
                      <Option value="OPTIONS">OPTIONS</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item
                    label="请求 URL"
                    name="url"
                    rules={[{ required: true, message: '请输入请求 URL' }]}
                  >
                    <Input size="large" placeholder="https://api.example.com/users" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label={
                  <Space>
                    <Text>Headers</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      (JSON 格式)
                    </Text>
                  </Space>
                }
              >
                <TextArea
                  size="large"
                  rows={4}
                  placeholder='{"Content-Type": "application/json", "Authorization": "Bearer token"}'
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  className="json-editor"
                />
              </Form.Item>

              <Form.Item
                label={
                  <Space>
                    <Text>Params</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      (JSON 格式)
                    </Text>
                  </Space>
                }
              >
                <TextArea
                  size="large"
                  rows={3}
                  placeholder='{"page": 1, "limit": 10}'
                  value={paramsText}
                  onChange={(e) => setParamsText(e.target.value)}
                  className="json-editor"
                />
              </Form.Item>

              <Form.Item
                label={
                  <Space>
                    <Text>Body</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      (JSON 或原始文本)
                    </Text>
                  </Space>
                }
                name="body"
              >
                <TextArea
                  size="large"
                  rows={6}
                  placeholder='{"name": "test", "email": "test@example.com"}'
                  className="json-editor"
                />
              </Form.Item>

              <Card size="small" style={{ background: '#fafafa', marginBottom: '16px' }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="超时时间(秒)" name="timeout">
                      <InputNumber min={1} max={300} style={{ width: '100%' }} size="large" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="验证 SSL" name="verify_ssl" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="跟随重定向" name="follow_redirects" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <Form.Item style={{ marginBottom: 0 }}>
                <Space size="large">
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    icon={<PlayCircleOutlined />}
                    size="large"
                  >
                    执行测试
                  </Button>
                  <Button icon={<SaveOutlined />} onClick={handleSave} size="large">
                    保存用例
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          {testResult ? (
            <Card
              title={
                <Space>
                  <span
                    style={{
                      color: testResult.success ? '#52c41a' : '#ff4d4f',
                      fontWeight: 700,
                    }}
                  >
                    ●
                  </span>
                  <span>测试结果</span>
                </Space>
              }
              className="test-result fade-in"
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Row gutter={16}>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: 'center' }}>
                      <div>
                        <Text type="secondary">状态</Text>
                        <div>
                          <Text
                            strong
                            style={{
                              color: testResult.success ? '#52c41a' : '#ff4d4f',
                              fontSize: '18px',
                            }}
                          >
                            {testResult.success ? '成功' : '失败'}
                          </Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: 'center' }}>
                      <div>
                        <Text type="secondary">状态码</Text>
                        <div>
                          <Text
                            strong
                            style={{
                              color: getStatusColor(testResult.status_code),
                              fontSize: '18px',
                            }}
                          >
                            {testResult.status_code}
                          </Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: 'center' }}>
                      <div>
                        <Text type="secondary">执行时间</Text>
                        <div>
                          <Text strong style={{ fontSize: '18px' }}>
                            {testResult.execution_time}ms
                          </Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>

                {testResult.error_message && (
                  <Alert
                    message="错误信息"
                    description={testResult.error_message}
                    type="error"
                    showIcon
                    style={{ borderRadius: '6px' }}
                  />
                )}

                <Card size="small" title="响应 Headers" style={{ background: '#fafafa' }}>
                  <pre
                    style={{
                      background: '#fff',
                      padding: '12px',
                      borderRadius: '6px',
                      margin: 0,
                      fontSize: '12px',
                      maxHeight: '200px',
                      overflow: 'auto',
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    {JSON.stringify(testResult.headers, null, 2)}
                  </pre>
                </Card>

                <Card size="small" title="响应 Body" style={{ background: '#fafafa' }}>
                  <pre
                    style={{
                      background: '#fff',
                      padding: '12px',
                      borderRadius: '6px',
                      margin: 0,
                      fontSize: '12px',
                      maxHeight: '300px',
                      overflow: 'auto',
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    {typeof testResult.body === 'object'
                      ? JSON.stringify(testResult.body, null, 2)
                      : testResult.body}
                  </pre>
                </Card>
              </Space>
            </Card>
          ) : (
            <Card
              title="测试结果"
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'linear-gradient(135deg, rgba(43, 141, 247, 0.08), rgba(124, 58, 237, 0.08))',
              }}
            >
              <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
                <PlayCircleOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#2b8df7' }} />
                <div>执行测试后，实时结果会展示在这里</div>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default HttpTest;
