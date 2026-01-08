import React from 'react';
import { Card, Typography, Empty } from 'antd';

const { Title } = Typography;

const MqTest: React.FC = () => {
  return (
    <div>
      <Title level={2}>MQ接口测试</Title>
      <Card>
        <Empty 
          description="MQ接口测试功能开发中..."
          style={{ padding: '40px 0' }}
        />
      </Card>
    </div>
  );
};

export default MqTest;