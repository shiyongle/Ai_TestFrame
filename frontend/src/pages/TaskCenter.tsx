import React, { useEffect, useState } from 'react';
import { Button, Card, Empty, List, Progress, Space, Tag, Typography } from 'antd';
import { CheckCircleFilled, ClockCircleFilled, CloseCircleFilled, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { taskCenter, TaskItem } from '../services/taskCenter';

const { Title, Text } = Typography;

const statusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  pending: { color: 'default', text: '排队中', icon: <ClockCircleFilled /> },
  running: { color: 'processing', text: '执行中', icon: <SyncOutlined spin /> },
  success: { color: 'success', text: '已完成', icon: <CheckCircleFilled /> },
  failed: { color: 'error', text: '失败', icon: <CloseCircleFilled /> },
};

const TaskCenter: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  const refreshTasks = () => {
    setTasks(taskCenter.getTasks());
  };

  useEffect(() => {
    refreshTasks();
    const unsubscribe = taskCenter.subscribe(refreshTasks);
    return unsubscribe;
  }, []);

  return (
    <div className="app-content fade-in" style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>任务进度</Title>
          <Text type="secondary">AI 生成用例、批量执行、导出等耗时任务状态</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refreshTasks}>刷新</Button>
          <Button onClick={() => { taskCenter.clearFinished(); refreshTasks(); }}>清理已完成</Button>
        </Space>
      </div>

      {tasks.length === 0 ? (
        <Card style={{ borderRadius: 16 }}>
          <Empty description="暂无任务记录" />
        </Card>
      ) : (
        <List
          dataSource={tasks}
          rowKey="id"
          renderItem={(task) => {
            const status = statusMap[task.status] || statusMap.pending;
            return (
              <List.Item>
                <Card style={{ width: '100%', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Space size={8}>
                      <Text strong style={{ fontSize: 15 }}>{task.title}</Text>
                      <Tag color={status.color} icon={status.icon}>{status.text}</Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(task.updatedAt).toLocaleString()}
                    </Text>
                  </div>

                  <Progress
                    percent={Math.max(0, Math.min(100, task.progress))}
                    status={task.status === 'failed' ? 'exception' : task.status === 'success' ? 'success' : 'active'}
                    strokeColor={task.status === 'failed' ? '#ff4d4f' : '#1677ff'}
                  />

                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">{task.detail || '任务执行中...'}</Text>
                  </div>
                </Card>
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );
};

export default TaskCenter;

