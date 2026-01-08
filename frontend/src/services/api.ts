import axios from 'axios';
import { HttpTestRequest, HttpTestResponse, TcpTestRequest, TcpTestResponse, MqTestRequest, MqTestResponse, Project } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
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
};

// 测试相关API
export const testApi = {
  testHttp: (data: HttpTestRequest): Promise<HttpTestResponse> => api.post('/api/v1/test/http', data),
  testTcp: (data: TcpTestRequest): Promise<TcpTestResponse> => api.post('/api/v1/test/tcp', data),
  testMq: (data: MqTestRequest): Promise<MqTestResponse> => api.post('/api/v1/test/mq', data),
  executeBatch: (data: any) => api.post('/api/v1/test/batch', data),
  getReport: (id: number) => api.get(`/api/v1/reports/${id}`),
};

// 版本管理API
export const versionApi = {
  getVersions: (): Promise<any[]> => api.get('/api/v1/versions'),
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
};

export default api;