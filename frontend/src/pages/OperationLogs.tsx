import React, { useEffect, useMemo, useState } from 'react';
import { Card, Typography, Space, Button, Tag, Input, Select } from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  FormOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { dashboardApi } from '../services/api';

const { Title, Text } = Typography;

const ACTION_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  create: { icon: <PlusOutlined />, color: 'rgba(52,199,89,0.15)', label: '新建' },
  update: { icon: <EditOutlined />, color: 'rgba(0,122,255,0.12)', label: '修改' },
  delete: { icon: <DeleteOutlined />, color: 'rgba(255,59,48,0.12)', label: '删除' },
  execute: { icon: <PlayCircleOutlined />, color: 'rgba(255,149,0,0.12)', label: '执行' },
  generate: { icon: <RobotOutlined />, color: 'rgba(88,86,214,0.12)', label: 'AI生成' },
  default: { icon: <FormOutlined />, color: 'rgba(0,0,0,0.05)', label: '操作' },
};

const OperationLogs: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | 'success' | 'failed'>('all');

  const loadActivities = async () => {
    setLoading(true);
    try {
      const data = await dashboardApi.getActivities({ limit: 100 });
      setActivities(data.items || []);
    } catch (error) {
      console.error('Failed to load operation logs', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return activities.filter((item) => {
      if (status !== 'all' && item.status !== status) {
        return false;
      }
      if (!k) {
        return true;
      }
      const text = `${item.user || ''} ${item.module || ''} ${item.target_name || ''} ${item.action || ''}`.toLowerCase();
      return text.includes(k);
    });
  }, [activities, keyword, status]);

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1500, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={2} style={{ marginBottom: 6 }}>
          操作日志
        </Title>
        <Text type="secondary">展示平台操作行为流水（复用仪表盘最近动态数据源）</Text>
      </div>

      <Card bordered={false} className="glass-panel" style={{ borderRadius: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            allowClear
            placeholder="搜索用户/模块/目标"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            value={status}
            onChange={(v) => setStatus(v)}
            style={{ width: 160 }}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '成功', value: 'success' },
              { label: '失败', value: 'failed' },
            ]}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadActivities}>
            刷新
          </Button>
        </Space>

        <div style={{ border: '1px solid rgba(0,0,0,0.04)', borderRadius: 12, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无操作记录</div>
          ) : (
            filtered.map((item, index) => {
              const actionInfo = ACTION_MAP[item.action] || ACTION_MAP.default;
              return (
                <div
                  key={item.id || `${item.user}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: index < filtered.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: actionInfo.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        color: '#555',
                      }}
                    >
                      {actionInfo.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {item.user}{' '}
                        <Text type="secondary" style={{ fontWeight: 400 }}>
                          {actionInfo.label}了
                        </Text>{' '}
                        {item.target_name}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.module} · {item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : ''}
                      </Text>
                    </div>
                  </div>

                  <Tag
                    style={{
                      border: 'none',
                      background: item.status === 'success' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
                      color: item.status === 'success' ? '#34C759' : '#FF3B30',
                      borderRadius: 6,
                    }}
                  >
                    {item.status === 'success' ? '成功' : '失败'}
                  </Tag>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};

export default OperationLogs;
