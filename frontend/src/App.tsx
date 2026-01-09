import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import AppHeader from './components/Layout/AppHeader';
import ResponsiveLayout from './components/Layout/ResponsiveLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import TestCases from './pages/TestCases';
import HttpTest from './pages/HttpTest';
import TcpTest from './pages/TcpTest';
import MqTest from './pages/MqTest';
import Reports from './pages/Reports';
import Versions from './pages/Versions';
import IdGenerator from './pages/Tools/IdGenerator';
import PhoneGenerator from './pages/Tools/PhoneGenerator';
import TestMenu from './TestMenu';
import FunctionalTestCases from './pages/TestCases/FunctionalTestCases';
import InterfaceTestCases from './pages/TestCases/InterfaceTestCases';
import ApiAutomation from './pages/ApiAutomation';
import Requirements from './pages/Requirements';
import RuleConfig from './pages/RuleConfig';
import AiKnowledge from './pages/AiKnowledge';

const { Content } = Layout;

const App: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMobileMenuClick = () => {
    setMobileMenuVisible(!mobileMenuVisible);
  };

  const contentStyle = {
    margin: isMobile ? '8px 0 16px' : '12px 0 24px',
    padding: 0,
    background: 'transparent',
    minHeight: 'calc(100vh - 72px)',
    overflow: 'visible',
  };

  return (
    <ResponsiveLayout
      mobileMenuVisible={mobileMenuVisible}
      onMobileMenuVisibleChange={setMobileMenuVisible}
    >
      <Layout>
        <AppHeader 
          onMobileMenuClick={handleMobileMenuClick}
          isMobile={isMobile}
        />
        <Content style={contentStyle}>
          <div className="app-content fade-in">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:projectId/testcases" element={<TestCases />} />
              <Route path="/requirements" element={<Requirements />} />
              <Route path="/testcases/functional" element={<FunctionalTestCases />} />
              <Route path="/testcases/interface" element={<InterfaceTestCases />} />
              <Route path="/api-automation" element={<ApiAutomation />} />
              <Route path="/test/http" element={<HttpTest />} />
              <Route path="/test/tcp" element={<TcpTest />} />
              <Route path="/test/mq" element={<MqTest />} />
              <Route path="/rule-config" element={<RuleConfig />} />
              <Route path="/ai/knowledge" element={<AiKnowledge />} />
              <Route path="/tools/id-generator" element={<IdGenerator />} />
              <Route path="/tools/phone-generator" element={<PhoneGenerator />} />
              <Route path="/test-menu" element={<TestMenu />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/versions" element={<Versions />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </ResponsiveLayout>
  );
};

export default App;
