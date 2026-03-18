import React, { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi, authStorage } from '../services/api';
import { LoginResponse } from '../types';

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const result: LoginResponse = await authApi.login(values);
      authStorage.setToken(result.access_token);
      authStorage.setUser(result.user);
      message.success('登录成功');
      const targetPath = (location.state as { from?: string } | null)?.from || '/dashboard';
      navigate(targetPath, { replace: true });
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes auroraShift {
          0% { transform: translate3d(-10%, -8%, 0) scale(1); }
          25% { transform: translate3d(8%, 6%, 0) scale(1.08); }
          50% { transform: translate3d(12%, -4%, 0) scale(1.15); }
          75% { transform: translate3d(-6%, 10%, 0) scale(1.06); }
          100% { transform: translate3d(-10%, -8%, 0) scale(1); }
        }

        @keyframes floatOrb {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-18px) translateX(12px); }
        }

        @keyframes gridMove {
          0% { transform: translateY(0px); }
          100% { transform: translateY(48px); }
        }

        @keyframes cardGlow {
          0%, 100% { box-shadow: 0 20px 60px rgba(15, 23, 42, 0.22), 0 0 0 rgba(99, 102, 241, 0.0); }
          50% { box-shadow: 0 28px 80px rgba(15, 23, 42, 0.28), 0 0 40px rgba(99, 102, 241, 0.18); }
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.35); }
        }

        @keyframes meteorFall {
          0% { transform: translate3d(0, 0, 0) rotate(215deg) scaleX(0.7); opacity: 0; }
          8% { opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translate3d(-420px, 420px, 0) rotate(215deg) scaleX(1); opacity: 0; }
        }

        .login-glass-card.ant-card {
          background: linear-gradient(180deg, rgba(15,23,42,0.78) 0%, rgba(17,24,39,0.74) 100%) !important;
          border: 1px solid rgba(255,255,255,0.14) !important;
        }

        .login-glass-card .ant-card-body {
          background: transparent !important;
        }

        .login-glass-card .ant-input-affix-wrapper,
        .login-glass-card .ant-input,
        .login-glass-card .ant-input-password {
          background: rgba(255,255,255,0.08) !important;
          color: #ffffff !important;
          border-color: rgba(255,255,255,0.12) !important;
          box-shadow: none !important;
        }

        .login-glass-card .ant-input {
          background: transparent !important;
          color: #ffffff !important;
        }

        .login-glass-card .ant-input::placeholder {
          color: rgba(255,255,255,0.38) !important;
        }

        .login-glass-card .ant-input-password-icon,
        .login-glass-card .ant-input-prefix {
          color: rgba(255,255,255,0.5) !important;
        }

        .login-glass-card .ant-form-item-label > label {
          color: rgba(255,255,255,0.86) !important;
        }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background:
            'radial-gradient(circle at top left, rgba(56, 189, 248, 0.25), transparent 30%), radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.22), transparent 26%), linear-gradient(135deg, #060816 0%, #0f172a 45%, #111827 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: -120,
            background:
              'conic-gradient(from 180deg at 50% 50%, rgba(59,130,246,0.16), rgba(99,102,241,0.10), rgba(168,85,247,0.18), rgba(45,212,191,0.14), rgba(59,130,246,0.16))',
            filter: 'blur(60px)',
            animation: 'auroraShift 16s ease-in-out infinite',
          }}
        />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.9))',
            animation: 'gridMove 8s linear infinite',
            opacity: 0.25,
          }}
        />

        {[
          { top: '12%', left: '18%', size: 3, delay: '0s', duration: '3.6s' },
          { top: '22%', left: '72%', size: 2, delay: '1.2s', duration: '4.2s' },
          { top: '34%', left: '58%', size: 4, delay: '2.4s', duration: '3.8s' },
          { top: '62%', left: '14%', size: 3, delay: '0.8s', duration: '4.8s' },
          { top: '68%', left: '78%', size: 2, delay: '1.8s', duration: '3.4s' },
          { top: '48%', left: '88%', size: 3, delay: '2.8s', duration: '4.6s' },
          { top: '18%', left: '42%', size: 2, delay: '1.5s', duration: '3.9s' },
          { top: '80%', left: '36%', size: 4, delay: '0.4s', duration: '5s' },
          { top: '54%', left: '30%', size: 2, delay: '2.1s', duration: '4.1s' },
        ].map((star, index) => (
          <div
            key={`star-${index}`}
            style={{
              position: 'absolute',
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 0 10px rgba(255,255,255,0.9)',
              animation: `twinkle ${star.duration} ease-in-out ${star.delay} infinite`,
              zIndex: 1,
            }}
          />
        ))}

        {[
          { top: '16%', right: '10%', delay: '0s', duration: '4.8s' },
          { top: '30%', right: '24%', delay: '2.4s', duration: '5.6s' },
          { top: '10%', right: '34%', delay: '1.1s', duration: '6.4s' },
        ].map((meteor, index) => (
          <div
            key={`meteor-${index}`}
            style={{
              position: 'absolute',
              top: meteor.top,
              right: meteor.right,
              width: 180,
              height: 2,
              background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.95), rgba(96,165,250,0.55), rgba(255,255,255,0))',
              borderRadius: 999,
              boxShadow: '0 0 18px rgba(147,197,253,0.45)',
              transformOrigin: 'right center',
              animation: `meteorFall ${meteor.duration} linear ${meteor.delay} infinite`,
              zIndex: 1,
            }}
          />
        ))}

        <div
          style={{
            position: 'absolute',
            top: '14%',
            left: '10%',
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,211,238,0.42) 0%, rgba(34,211,238,0.04) 70%, transparent 100%)',
            filter: 'blur(8px)',
            animation: 'floatOrb 7s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '12%',
            bottom: '12%',
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(168,85,247,0.34) 0%, rgba(168,85,247,0.05) 68%, transparent 100%)',
            filter: 'blur(10px)',
            animation: 'floatOrb 9s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '18%',
            top: '18%',
            width: 140,
            height: 140,
            borderRadius: 32,
            transform: 'rotate(24deg)',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(45,212,191,0.08))',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            animation: 'floatOrb 11s ease-in-out infinite',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: 1120,
            display: 'grid',
            gridTemplateColumns: '1.1fr 420px',
            gap: 32,
            alignItems: 'center',
          }}
        >
          <div style={{ color: '#fff', padding: '0 12px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(12px)',
                marginBottom: 24,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 12px #22d3ee' }} />
              <Text style={{ color: 'rgba(255,255,255,0.82)' }}>AI 智能测试平台</Text>
            </div>

            <Title style={{ color: '#fff', fontSize: 56, lineHeight: 1.12, marginBottom: 18, fontWeight: 800 }}>
              投石问路
              <br />
              智能测试中枢
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 18, display: 'block', maxWidth: 560, lineHeight: 1.8 }}>
              统一管理项目、需求、测试计划与执行结果，让自动化测试、接口治理和 AI 辅助分析在一个平台内高效协同。
            </Text>

            <div style={{ display: 'flex', gap: 16, marginTop: 32, flexWrap: 'wrap' }}>
              {['项目管理', '测试计划', '接口自动化', 'AI 知识库'].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.88)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <Card
            className="login-glass-card"
            style={{
              width: '100%',
              borderRadius: 28,
              background: 'linear-gradient(180deg, rgba(15,23,42,0.78) 0%, rgba(17,24,39,0.74) 100%)',
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 20px 60px rgba(15, 23, 42, 0.22)',
              backdropFilter: 'blur(24px) saturate(140%)',
              WebkitBackdropFilter: 'blur(24px) saturate(140%)',
              animation: 'cardGlow 6s ease-in-out infinite',
              overflow: 'hidden',
            }}
            styles={{
              body: {
                padding: 32,
                position: 'relative',
                zIndex: 2,
              },
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(168,85,247,0.06) 45%, rgba(15,23,42,0.08))',
                pointerEvents: 'none',
              }}
            />
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <Title level={2} style={{ marginBottom: 8, color: '#fff' }}>欢迎登录</Title>
              <Text style={{ color: 'rgba(255,255,255,0.72)' }}>进入你的智能测试工作台</Text>
            </div>
            <Form layout="vertical" onFinish={handleSubmit} initialValues={{ username: 'admin', password: 'admin' }}>
              <Form.Item
                name="username"
                label={<span style={{ color: 'rgba(255,255,255,0.86)' }}>账号</span>}
                rules={[{ required: true, message: '请输入账号' }]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.5)' }} />}
                  placeholder="请输入账号"
                  size="large"
                  style={{
                    height: 48,
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.12)',
                    color: '#fff',
                  }}
                />
              </Form.Item>
              <Form.Item
                name="password"
                label={<span style={{ color: 'rgba(255,255,255,0.86)' }}>密码</span>}
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.5)' }} />}
                  placeholder="请输入密码"
                  size="large"
                  style={{
                    height: 48,
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.12)',
                    color: '#fff',
                  }}
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                style={{
                  height: 48,
                  borderRadius: 14,
                  marginTop: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                  boxShadow: '0 12px 30px rgba(79,70,229,0.35)',
                  fontWeight: 700,
                }}
              >
                登录系统
              </Button>
            </Form>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Login;
