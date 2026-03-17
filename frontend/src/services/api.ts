import axios from 'axios';
import { HttpTestRequest, HttpTestResponse, TcpTestRequest, TcpTestResponse, MqTestRequest, MqTestResponse, Project } from '../types';

const API_BASE_URL =
  process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const uploadApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证token等
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// 项目相关API
export const projectApi = {
  getProjects: (): Promise<Project[]> => api.get('/api/v1/projects'),
  createProject: (data: any): Promise<Project> => api.post('/api/v1/projects', data),
  getProject: (id: number): Promise<Project> => api.get(`/api/v1/projects/${id}`),
  updateProject: (id: number, data: any): Promise<Project> => api.put(`/api/v1/projects/${id}`, data),
  deleteProject: (id: number): Promise<any> => api.delete(`/api/v1/projects/${id}`),
};

// 测试用例相关API
export const testcaseApi = {
  getTestCases: (projectId: number): Promise<any[]> => api.get(`/api/v1/projects/${projectId}/testcases`),
  createTestCase: (projectId: number, data: any): Promise<any> => api.post(`/api/v1/projects/${projectId}/testcases`, data),
  getAllTestCases: (): Promise<any[]> => api.get('/api/v1/testcases'),
  updateTestCase: (id: number, data: any): Promise<any> => api.put(`/api/v1/testcases/${id}`, data),
  deleteTestCase: (id: number): Promise<any> => api.delete(`/api/v1/testcases/${id}`),
};

// 接口测试用例（独立数据表）API
export const interfaceTestcaseApi = {
  getAll: (projectId?: number): Promise<any[]> => api.get('/api/v1/interface-testcases', { params: { project_id: projectId } }),
  getOne: (id: number): Promise<any> => api.get(`/api/v1/interface-testcases/${id}`),
  create: (data: any): Promise<any> => api.post('/api/v1/interface-testcases', data),
  update: (id: number, data: any): Promise<any> => api.put(`/api/v1/interface-testcases/${id}`, data),
  delete: (id: number): Promise<any> => api.delete(`/api/v1/interface-testcases/${id}`),
  importCases: (data: FormData): Promise<any> => uploadApi.post('/api/v1/interface-testcases/import', data).then((res) => res.data),
};

// 测试相关API
export const testApi = {
  testHttp: (data: HttpTestRequest): Promise<HttpTestResponse> => api.post('/api/v1/test/http', data),
  testTcp: (data: TcpTestRequest): Promise<TcpTestResponse> => api.post('/api/v1/test/tcp', data),
  testMq: (data: MqTestRequest): Promise<MqTestResponse> => api.post('/api/v1/test/mq', data),
  executeBatch: (data: any) => api.post('/api/v1/test/batch', data),
  getReport: (id: number) => api.get(`/api/v1/reports/${id}`),
};

// 测试用例集API
export const testSuiteApi = {
  getTestSuites: (projectId: number): Promise<any[]> => api.get(`/api/v1/${projectId}/test-suites`),
  createTestSuite: (projectId: number, data: any): Promise<any> => api.post(`/api/v1/${projectId}/test-suites`, data),
  getTestSuite: (id: number): Promise<any> => api.get(`/api/v1/test-suites/${id}`),
  updateTestSuite: (id: number, data: any): Promise<any> => api.put(`/api/v1/test-suites/${id}`, data),
  deleteTestSuite: (id: number): Promise<any> => api.delete(`/api/v1/test-suites/${id}`),
  addCasesToSuite: (suiteId: number, testcaseIds: number[]): Promise<any> => api.post(`/api/v1/test-suites/${suiteId}/cases`, { testcase_ids: testcaseIds }),
  removeCasesFromSuite: (suiteId: number, testcaseIds: number[]): Promise<any> => api.request({ method: 'DELETE', url: `/api/v1/test-suites/${suiteId}/cases`, data: { testcase_ids: testcaseIds } }),
};

// 测试计划 API
export const testPlanApi = {
  getTestPlans: (projectId?: number): Promise<any[]> => api.get('/api/v1/test-plans', { params: { project_id: projectId } }),
  getTestPlan: (id: number): Promise<any> => api.get(`/api/v1/test-plans/${id}`),
  createTestPlan: (data: any): Promise<any> => api.post('/api/v1/test-plans', data),
  updateTestPlan: (id: number, data: any): Promise<any> => api.put(`/api/v1/test-plans/${id}`, data),
  deleteTestPlan: (id: number): Promise<any> => api.delete(`/api/v1/test-plans/${id}`),
  executeTestPlan: (id: number): Promise<any> => api.post(`/api/v1/test-plans/${id}/execute`),
};

// 版本管理API
export const versionApi = {
  getVersions: (projectId?: number): Promise<any[]> =>
    api.get('/api/v1/versions', { params: { project_id: projectId } }),
  createVersion: (data: any): Promise<any> => api.post('/api/v1/versions', data),
  getVersion: (id: number): Promise<any> => api.get(`/api/v1/versions/${id}`),
  updateVersion: (id: number, data: any): Promise<any> => api.put(`/api/v1/versions/${id}`, data),
  deleteVersion: (id: number): Promise<any> => api.delete(`/api/v1/versions/${id}`),
  getLatestVersion: (): Promise<any> => api.get('/api/v1/versions/latest'),
  addRequirementsToVersion: (versionId: number, requirementIds: number[]): Promise<any> =>
    api.post(`/api/v1/versions/${versionId}/requirements`, requirementIds),
  removeRequirementFromVersion: (versionId: number, requirementId: number): Promise<any> =>
    api.delete(`/api/v1/versions/${versionId}/requirements/${requirementId}`),
  getVersionRequirements: (versionId: number): Promise<any[]> =>
    api.get(`/api/v1/versions/${versionId}/requirements`),
  generateTestCases: (versionId: number, model: string): Promise<any> =>
    api.post(`/api/v1/versions/${versionId}/generate-testcases`, { model }),
  linkKnowledgeToVersion: (versionId: number, knowledgeIds: number[]): Promise<any> =>
    api.post(`/api/v1/versions/${versionId}/knowledge`, knowledgeIds),
  getLinkedKnowledge: (versionId: number): Promise<any[]> =>
    api.get(`/api/v1/versions/${versionId}/knowledge`),
};

// 需求管理API
export const requirementApi = {
  getRequirements: (params?: any): Promise<any[]> => api.get('/api/v1/requirements', { params }),
  getRequirement: (id: number): Promise<any> => api.get(`/api/v1/requirements/${id}`),
  createRequirement: (data: any): Promise<any> => api.post('/api/v1/requirements', data),
  updateRequirement: (id: number, data: any): Promise<any> => api.put(`/api/v1/requirements/${id}`, data),
  deleteRequirement: (id: number): Promise<any> => api.delete(`/api/v1/requirements/${id}`),
  getProjectRequirements: (projectId: number): Promise<any[]> => api.get(`/api/v1/projects/${projectId}/requirements`),
  addComment: (id: number, comment: any): Promise<any> => api.post(`/api/v1/requirements/${id}/comments`, comment),
  linkTestCases: (id: number, linkData: any): Promise<any> => api.post(`/api/v1/requirements/${id}/link-testcases`, linkData),
  generateTestCases: (id: number, model: string): Promise<any> => api.post(`/api/v1/requirements/${id}/generate-testcases`, { model }),
};

// AI 知识库 API
export const aiApi = {
  getKnowledgeList: (): Promise<any> => api.get('/api/v1/ai/knowledge/list'),
  addKnowledgeDocument: (data: any): Promise<any> => api.post('/api/v1/ai/knowledge/add', data),
  searchKnowledge: (data: any): Promise<any> => api.post('/api/v1/ai/knowledge/search', data),
  deleteKnowledgeDocument: (id: number): Promise<any> => api.delete(`/api/v1/ai/knowledge/${id}`),
  getKnowledgeCategories: (): Promise<any> => api.get('/api/v1/ai/knowledge/categories'),
  importKnowledgeFiles: (data: FormData): Promise<any> =>
    uploadApi.post('/api/v1/ai/knowledge/import', data),
  updateKnowledgeLinks: (id: number, data: any): Promise<any> =>
    api.post(`/api/v1/ai/knowledge/${id}/links`, data),
};
// 系统设置 API
export const systemApi = {
  getSettings: (category: string): Promise<any> => api.get(`/api/v1/system/settings/${category}`),
  updateSettings: (category: string, data: any): Promise<any> => api.put(`/api/v1/system/settings/${category}`, data),
};

// 仪表盘 API
export const dashboardApi = {
  getStats: (): Promise<any> => api.get('/api/v1/dashboard/stats'),
  getActivities: (params?: { limit?: number; offset?: number }): Promise<any> => api.get('/api/v1/dashboard/activities', { params }),
};

// 测试报告 API
export const reportApi = {
  getOverview: (params?: { start_date?: string; end_date?: string; limit?: number; offset?: number }): Promise<any> =>
    api.get('/api/v1/reports/overview/stats', { params }),
};
export default api;


