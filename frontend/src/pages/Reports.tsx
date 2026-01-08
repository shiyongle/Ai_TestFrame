import React from 'react';
import { Card, Typography, Empty } from 'antd';

const { Title } = Typography;

const Reports: React.FC = () => {
  return (
    <div>
      <Title level={2}>测试报告</Title>
      <Card>
        <Empty 
          description="测试报告功能开发中..."
          style={{ padding: '40px 0' }}
        />
      </Card>
    </div>
  );
};

export default Reports;