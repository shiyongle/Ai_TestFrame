import React from 'react';
import { Typography, Empty } from 'antd';

const { Title } = Typography;

const TestPlans: React.FC = () => {
    return (
        <div className="glass-panel fade-in" style={{ padding: 24, borderRadius: 16 }}>
            <Title level={4}>测试计划管理</Title>
            <div style={{ marginTop: 40, padding: 40, background: 'rgba(0,0,0,0.02)', borderRadius: 12 }}>
                <Empty description="该功能模块建设中..." />
            </div>
        </div>
    );
};

export default TestPlans;
