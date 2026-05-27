import axios from 'axios';
import { HttpTestRequest, HttpTestResponse, TcpTestRequest, TcpTestResponse, MqTestRequest, MqTestResponse, Project } from '../types';

const runtimeApiUrl =
  typeof window !== 'undefined' ? (window as Window & { __RUNTIME_API_URL__?: string }).__RUNTIME_API_URL__ || '' : '';

export const API_BASE_URL = runtimeApiUrl || (typeof window !== 'undefined' ? window.location.origin : '');

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

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

export const authStorage = {
  getToken: () => localStorage.getItem(AUTH_TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(AUTH_TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(AUTH_TOKEN_KEY),
  getUser: () => {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (user: any) => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem('username', user.username);
  },
  clearUser: () => {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem('username');
  },
  clear: () => {
    authStorage.clearToken();
    authStorage.clearUser();
  },
};

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = authStorage.getToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
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
    if (error?.response?.status === 401) {
      authStorage.clear();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

uploadApi.interceptors.request.use(
  (config) => {
    const token = authStorage.getToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
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
  getAiGenerationSessions: (versionId: number): Promise<any[]> =>
    api.get(`/api/v1/versions/${versionId}/ai-generation-sessions`),
  getAiGenerationSessionDetail: (versionId: number, sessionId: string): Promise<any> =>
    api.get(`/api/v1/versions/${versionId}/ai-generation-sessions/${sessionId}`),
  deleteAiGenerationEvidence: (versionId: number, evidenceId: number): Promise<any> =>
    api.delete(`/api/v1/versions/${versionId}/ai-generation-evidence/${evidenceId}`),
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

// UI 自动化 API
export const uiAutomationApi = {
  listCases: (projectId?: number): Promise<any[]> => api.get('/api/v1/ui-automation/cases', { params: { project_id: projectId } }),
  getCase: (caseId: number): Promise<any> => api.get(`/api/v1/ui-automation/cases/${caseId}`),
  createCase: (data: any): Promise<any> => api.post('/api/v1/ui-automation/cases', data),
  updateCase: (caseId: number, data: any): Promise<any> => api.put(`/api/v1/ui-automation/cases/${caseId}`, data),
  deleteCase: (caseId: number): Promise<any> => api.delete(`/api/v1/ui-automation/cases/${caseId}`),
  runCase: (caseId: number, data: { auto_start?: boolean; debug_mode?: boolean } = {}): Promise<any> =>
    api.post(`/api/v1/ui-automation/cases/${caseId}/run`, data),
  createTask: (data: any): Promise<any> => api.post('/api/v1/ui-automation/tasks', data),
  listTasks: (limit = 20): Promise<any[]> => api.get('/api/v1/ui-automation/tasks', { params: { limit } }),
  getTask: (taskId: number): Promise<any> => api.get(`/api/v1/ui-automation/tasks/${taskId}`),
  startTask: (taskId: number): Promise<any> => api.post(`/api/v1/ui-automation/tasks/${taskId}/start`),
  solidifyTask: (taskId: number): Promise<any> => api.post(`/api/v1/ui-automation/tasks/${taskId}/solidify`),
  generateSteps: (naturalLanguage: string): Promise<any> => api.post('/api/v1/ui-automation/generate-steps', { natural_language: naturalLanguage }),
  pauseTask: (taskId: number): Promise<any> => api.post(`/api/v1/ui-automation/tasks/${taskId}/pause`),
  resumeTask: (taskId: number): Promise<any> => api.post(`/api/v1/ui-automation/tasks/${taskId}/resume`),
  deleteTask: (taskId: number): Promise<any> => api.delete(`/api/v1/ui-automation/tasks/${taskId}`),
};

// 性能测试 API
export const performanceApi = {
  getOverview: (projectId?: number): Promise<any> => api.get('/api/v1/performance/overview', { params: { project_id: projectId } }),
  listScenarios: (projectId?: number): Promise<any[]> => api.get('/api/v1/performance/scenarios', { params: { project_id: projectId } }),
  getScenario: (scenarioId: number): Promise<any> => api.get(`/api/v1/performance/scenarios/${scenarioId}`),
  createScenario: (data: any): Promise<any> => api.post('/api/v1/performance/scenarios', data),
  updateScenario: (scenarioId: number, data: any): Promise<any> => api.put(`/api/v1/performance/scenarios/${scenarioId}`, data),
  deleteScenario: (scenarioId: number): Promise<any> => api.delete(`/api/v1/performance/scenarios/${scenarioId}`),
  listRuns: (projectId?: number, limit = 20): Promise<any[]> => api.get('/api/v1/performance/runs', { params: { project_id: projectId, limit } }),
  getRun: (runId: number): Promise<any> => api.get(`/api/v1/performance/runs/${runId}`),
  createRun: (data: any): Promise<any> => api.post('/api/v1/performance/runs', data),
  startRun: (runId: number): Promise<any> => api.post(`/api/v1/performance/runs/${runId}/start`),
  stopRun: (runId: number): Promise<any> => api.post(`/api/v1/performance/runs/${runId}/stop`),
  getTrend: (runId: number): Promise<any> => api.get(`/api/v1/performance/runs/${runId}/trend`),
};

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

export const aiQualityApi = {
  getOverview: (): Promise<any> => api.get('/api/v1/ai-quality/overview'),
  listPrompts: (params?: { prompt_type?: string }): Promise<any[]> => api.get('/api/v1/ai-quality/prompts', { params }),
  createPrompt: (data: any): Promise<any> => api.post('/api/v1/ai-quality/prompts', data),
  activatePrompt: (id: number): Promise<any> => api.post(`/api/v1/ai-quality/prompts/${id}/activate`),
  listReviews: (params?: { status?: string; limit?: number }): Promise<any[]> => api.get('/api/v1/ai-quality/reviews', { params }),
  createReview: (data: any): Promise<any> => api.post('/api/v1/ai-quality/reviews', data),
  updateReview: (id: number, data: any): Promise<any> => api.put(`/api/v1/ai-quality/reviews/${id}`, data),
  listBudgets: (): Promise<any[]> => api.get('/api/v1/ai-quality/budgets'),
  createBudget: (data: any): Promise<any> => api.post('/api/v1/ai-quality/budgets', data),
  syncBudgetUsage: (): Promise<any> => api.post('/api/v1/ai-quality/budgets/sync-usage'),
  listExperiments: (): Promise<any[]> => api.get('/api/v1/ai-quality/experiments'),
  createExperiment: (data: any): Promise<any> => api.post('/api/v1/ai-quality/experiments', data),
  listKnowledgeScans: (params?: { limit?: number }): Promise<any[]> => api.get('/api/v1/ai-quality/knowledge-scans', { params }),
  runKnowledgeScan: (maxDocs = 100): Promise<any> => api.post('/api/v1/ai-quality/knowledge-scans/run', null, { params: { max_docs: maxDocs } }),
};
// 系统设置 API
export const systemApi = {
  getSettings: (category: string): Promise<any> => api.get(`/api/v1/system/settings/${category}`),
  updateSettings: (category: string, data: any): Promise<any> => api.put(`/api/v1/system/settings/${category}`, data),
  getUsers: (): Promise<any[]> => api.get('/api/v1/system/users'),
  createUser: (data: { username: string; password: string; real_name: string }): Promise<any> => api.post('/api/v1/system/users', data),
  updateUser: (id: number, data: { username: string; password?: string; real_name: string }): Promise<any> => api.put(`/api/v1/system/users/${id}`, data),
  deleteUser: (id: number): Promise<any> => api.delete(`/api/v1/system/users/${id}`),
};

export const enterpriseGovernanceApi = {
  getOverview: (): Promise<any> => api.get('/api/v1/enterprise-governance/overview'),
  listOrganizations: (): Promise<any[]> => api.get('/api/v1/enterprise-governance/organizations'),
  createOrganization: (data: any): Promise<any> => api.post('/api/v1/enterprise-governance/organizations', data),
  updateOrganization: (id: number, data: any): Promise<any> => api.put(`/api/v1/enterprise-governance/organizations/${id}`, data),
  listTeams: (organizationId?: number): Promise<any[]> =>
    api.get('/api/v1/enterprise-governance/teams', { params: { organization_id: organizationId } }),
  createTeam: (data: any): Promise<any> => api.post('/api/v1/enterprise-governance/teams', data),
  addTeamMember: (teamId: number, data: any): Promise<any> =>
    api.post(`/api/v1/enterprise-governance/teams/${teamId}/members`, data),
  deleteTeamMember: (memberId: number): Promise<any> =>
    api.delete(`/api/v1/enterprise-governance/team-members/${memberId}`),
  listRoles: (): Promise<any[]> => api.get('/api/v1/enterprise-governance/roles'),
  createRole: (data: any): Promise<any> => api.post('/api/v1/enterprise-governance/roles', data),
  updateRole: (id: number, data: any): Promise<any> => api.put(`/api/v1/enterprise-governance/roles/${id}`, data),
  listProjectRoles: (projectId?: number): Promise<any[]> =>
    api.get('/api/v1/enterprise-governance/project-roles', { params: { project_id: projectId } }),
  grantProjectRole: (data: any): Promise<any> => api.post('/api/v1/enterprise-governance/project-roles', data),
  listSsoProviders: (): Promise<any[]> => api.get('/api/v1/enterprise-governance/sso-providers'),
  createSsoProvider: (data: any): Promise<any> => api.post('/api/v1/enterprise-governance/sso-providers', data),
  updateSsoProvider: (id: number, data: any): Promise<any> =>
    api.put(`/api/v1/enterprise-governance/sso-providers/${id}`, data),
  listApiTokens: (): Promise<any[]> => api.get('/api/v1/enterprise-governance/api-tokens'),
  createApiToken: (data: any): Promise<any> => api.post('/api/v1/enterprise-governance/api-tokens', data),
  revokeApiToken: (id: number): Promise<any> => api.delete(`/api/v1/enterprise-governance/api-tokens/${id}`),
  listSecrets: (): Promise<any[]> => api.get('/api/v1/enterprise-governance/secrets'),
  createSecret: (data: any): Promise<any> => api.post('/api/v1/enterprise-governance/secrets', data),
  rotateSecret: (id: number, data: any): Promise<any> =>
    api.post(`/api/v1/enterprise-governance/secrets/${id}/rotate`, data),
  listApprovals: (statusFilter?: string): Promise<any[]> =>
    api.get('/api/v1/enterprise-governance/approvals', { params: { status_filter: statusFilter } }),
  createApproval: (data: any): Promise<any> => api.post('/api/v1/enterprise-governance/approvals', data),
  decideApproval: (id: number, data: { decision: string; comment?: string }): Promise<any> =>
    api.post(`/api/v1/enterprise-governance/approvals/${id}/decision`, data),
  listAudits: (params?: { event_type?: string; limit?: number }): Promise<any[]> =>
    api.get('/api/v1/enterprise-governance/audits', { params }),
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

export const defectApi = {
  list: (params?: { status?: string; project_id?: number; keyword?: string; limit?: number; offset?: number }): Promise<any[]> =>
    api.get('/api/v1/defects', { params }),
  get: (id: number): Promise<any> => api.get(`/api/v1/defects/${id}`),
  create: (data: any): Promise<any> => api.post('/api/v1/defects', data),
  createFromReport: (reportId: number, data: any): Promise<any> => api.post(`/api/v1/reports/${reportId}/defects`, data),
  update: (id: number, data: any): Promise<any> => api.put(`/api/v1/defects/${id}`, data),
  transition: (id: number, data: { status: string; comment?: string; sync_external?: boolean }): Promise<any> =>
    api.post(`/api/v1/defects/${id}/transition`, data),
  verifyRegression: (id: number, data: { passed: boolean; report_id?: number; notes?: string; sync_external?: boolean }): Promise<any> =>
    api.post(`/api/v1/defects/${id}/regression`, data),
  syncExternal: (id: number, data: { external_status?: string; external_key?: string; external_url?: string }): Promise<any> =>
    api.post(`/api/v1/defects/${id}/external-sync`, data),
  pullExternal: (id: number): Promise<any> => api.post(`/api/v1/defects/${id}/pull-external`),
  testIntegration: (): Promise<any> => api.post('/api/v1/defects/integrations/test'),
};

export const traceabilityApi = {
  getMatrix: (params?: { project_id?: number; version_id?: number; status?: string; coverage_status?: string }): Promise<any> =>
    api.get('/api/v1/traceability/matrix', { params }),
  getImpactChanges: (params?: { project_id?: number; limit?: number }): Promise<any> =>
    api.get('/api/v1/traceability/impact-changes', { params }),
  linkAssets: (requirementId: number, assets: any[]): Promise<any> =>
    api.post(`/api/v1/requirements/${requirementId}/test-assets`, { assets }),
  unlinkAsset: (requirementId: number, linkId: number): Promise<any> =>
    api.delete(`/api/v1/requirements/${requirementId}/test-assets/${linkId}`),
  getRegressionRecommendations: (requirementId: number): Promise<any> =>
    api.get(`/api/v1/requirements/${requirementId}/regression-recommendations`),
  createRegressionPlan: (requirementId: number, data?: { owner?: string; execution_mode?: string; priority?: string }): Promise<any> =>
    api.post(`/api/v1/requirements/${requirementId}/regression-plan`, data || {}),
  getImpactAnalysis: (requirementId: number): Promise<any> =>
    api.get(`/api/v1/requirements/${requirementId}/impact-analysis`),
  applySuggestedStatus: (requirementId: number, status: string): Promise<any> =>
    api.post(`/api/v1/requirements/${requirementId}/apply-suggested-status`, { status }),
};

export const assetAuditApi = {
  getSummary: (params?: { project_id?: number }): Promise<any> =>
    api.get('/api/v1/test-assets/audit/summary', { params }),
  listAssets: (params?: { project_id?: number; asset_type?: string }): Promise<any> =>
    api.get('/api/v1/test-assets/audit/assets', { params }),
  listVersions: (assetType: string, assetId: number): Promise<any[]> =>
    api.get(`/api/v1/test-assets/audit/assets/${assetType}/${assetId}/versions`),
  getVersionDiff: (versionId: number): Promise<any> =>
    api.get(`/api/v1/test-assets/audit/versions/${versionId}/diff`),
  approveVersion: (versionId: number, data: { decision: string; approver?: string; comment?: string }): Promise<any> =>
    api.post(`/api/v1/test-assets/audit/versions/${versionId}/approval`, data),
  confirmAiCase: (evidenceId: number, data: { approver?: string; comment?: string }): Promise<any> =>
    api.post(`/api/v1/test-assets/audit/ai-evidence/${evidenceId}/confirm`, data),
  listBaselines: (params?: { project_id?: number }): Promise<any[]> =>
    api.get('/api/v1/test-assets/audit/baselines', { params }),
  createBaseline: (data: any): Promise<any> =>
    api.post('/api/v1/test-assets/audit/baselines', data),
  freezeBaseline: (baselineId: number, data: { frozen_by?: string }): Promise<any> =>
    api.post(`/api/v1/test-assets/audit/baselines/${baselineId}/freeze`, data),
  listEvents: (params?: { project_id?: number; asset_type?: string; asset_id?: number; limit?: number }): Promise<any[]> =>
    api.get('/api/v1/test-assets/audit/events', { params }),
};

export const environmentApi = {
  list: (params?: { project_id?: number }): Promise<any[]> => api.get('/api/v1/environments', { params }),
  create: (data: any): Promise<any> => api.post('/api/v1/environments', data),
  update: (id: number, data: any): Promise<any> => api.put(`/api/v1/environments/${id}`, data),
  delete: (id: number): Promise<any> => api.delete(`/api/v1/environments/${id}`),
  createVariable: (environmentId: number, data: any): Promise<any> => api.post(`/api/v1/environments/${environmentId}/variables`, data),
  updateVariable: (id: number, data: any): Promise<any> => api.put(`/api/v1/environment-variables/${id}`, data),
  deleteVariable: (id: number): Promise<any> => api.delete(`/api/v1/environment-variables/${id}`),
  createAccountPool: (environmentId: number, data: any): Promise<any> => api.post(`/api/v1/environments/${environmentId}/account-pools`, data),
  updateAccountPool: (id: number, data: any): Promise<any> => api.put(`/api/v1/environment-account-pools/${id}`, data),
  deleteAccountPool: (id: number): Promise<any> => api.delete(`/api/v1/environment-account-pools/${id}`),
  createDataPool: (environmentId: number, data: any): Promise<any> => api.post(`/api/v1/environments/${environmentId}/data-pools`, data),
  updateDataPool: (id: number, data: any): Promise<any> => api.put(`/api/v1/environment-data-pools/${id}`, data),
  deleteDataPool: (id: number): Promise<any> => api.delete(`/api/v1/environment-data-pools/${id}`),
};

export const apiAdvancedApi = {
  getSummary: (params?: { project_id?: number }): Promise<any> =>
    api.get('/api/v1/api-advanced/assets/summary', { params }),
  listCollections: (params?: { project_id?: number }): Promise<any[]> =>
    api.get('/api/v1/api-advanced/collections', { params }),
  createCollection: (data: any): Promise<any> =>
    api.post('/api/v1/api-advanced/collections', data),
  runCollection: (collectionId: number, data: { environment_id?: number; iterations?: number; data_pool_id?: number }): Promise<any> =>
    api.post(`/api/v1/api-advanced/collections/${collectionId}/run`, data),
  listRuns: (params?: { collection_id?: number; limit?: number }): Promise<any[]> =>
    api.get('/api/v1/api-advanced/runs', { params }),
  syncDocs: (data: { docs_url: string; project_id: number; module?: string; max_cases?: number }): Promise<any> =>
    api.post('/api/v1/api-advanced/docs/sync', data),
  listMocks: (params?: { project_id?: number }): Promise<any[]> =>
    api.get('/api/v1/api-advanced/mocks', { params }),
  createMock: (data: any): Promise<any> =>
    api.post('/api/v1/api-advanced/mocks', data),
  listContracts: (params?: { interface_testcase_id?: number }): Promise<any[]> =>
    api.get('/api/v1/api-advanced/contracts', { params }),
  createContract: (data: any): Promise<any> =>
    api.post('/api/v1/api-advanced/contracts', data),
  listMonitors: (): Promise<any[]> =>
    api.get('/api/v1/api-advanced/monitors'),
  createMonitor: (data: any): Promise<any> =>
    api.post('/api/v1/api-advanced/monitors', data),
  runMonitor: (probeId: number): Promise<any> =>
    api.post(`/api/v1/api-advanced/monitors/${probeId}/run`),
  listChanges: (params?: { project_id?: number; limit?: number }): Promise<any[]> =>
    api.get('/api/v1/api-advanced/changes', { params }),
};

export const agentApi = {
  chat: (data: { message: string; session_id?: string }): Promise<any> => api.post('/api/v1/agent/chat', data),
};

export const agentEvaluationApi = {
  getProviders: (): Promise<any> => api.get('/api/v1/agent-evaluation/providers'),
  listRuns: async (limit = 20): Promise<any[]> => {
    const response = await api.get('/api/v1/agent-evaluation/runs', { params: { limit } });
    return response.data || [];
  },
  getRun: async (runId: number): Promise<any> => {
    const response = await api.get(`/api/v1/agent-evaluation/runs/${runId}`);
    return response.data;
  },
  createRun: async (data: any): Promise<any> => {
    const response = await api.post('/api/v1/agent-evaluation/runs', data);
    return response.data;
  },
  deleteRun: async (runId: number): Promise<any> => {
    const response = await api.delete(`/api/v1/agent-evaluation/runs/${runId}`);
    return response;
  },
  updateHumanLabel: async (itemId: number, data: { human_label: string; human_comment?: string }): Promise<any> => {
    const response = await api.put(`/api/v1/agent-evaluation/items/${itemId}/human-label`, data);
    return response.data;
  },
  clearHumanLabel: async (itemId: number): Promise<any> => {
    const response = await api.delete(`/api/v1/agent-evaluation/items/${itemId}/human-label`);
    return response.data;
  },
};

export const goldenDatasetApi = {
  list: (params?: { keyword?: string; limit?: number; offset?: number }): Promise<any> =>
    api.get('/api/v1/golden-datasets', { params }),
  get: (id: number): Promise<any> => api.get(`/api/v1/golden-datasets/${id}`),
  create: (data: any): Promise<any> => api.post('/api/v1/golden-datasets', data),
  update: (id: number, data: any): Promise<any> => api.put(`/api/v1/golden-datasets/${id}`, data),
  delete: (id: number): Promise<any> => api.delete(`/api/v1/golden-datasets/${id}`),
  addItems: (datasetId: number, items: any[]): Promise<any> =>
    api.post(`/api/v1/golden-datasets/${datasetId}/items`, items),
  updateItem: (itemId: number, data: any): Promise<any> =>
    api.put(`/api/v1/golden-dataset-items/${itemId}`, data),
  deleteItem: (itemId: number): Promise<any> =>
    api.delete(`/api/v1/golden-dataset-items/${itemId}`),
  downloadTemplate: async (): Promise<void> => {
    const response = await api.get('/api/v1/golden-datasets/template/download', {
      responseType: 'blob',
    });
    const blob = new Blob([response as any], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'golden_dataset_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
  importExcel: (datasetId: number, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/v1/golden-datasets/${datasetId}/import-excel`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// 模型配置管理 API
export const modelConfigApi = {
  listConfigs: (enabledOnly = false): Promise<any[]> => api.get('/api/v1/model-configs', { params: { enabled_only: enabledOnly } }),
  getConfig: (configId: number): Promise<any> => api.get(`/api/v1/model-configs/${configId}`),
  createConfig: (data: any): Promise<any> => api.post('/api/v1/model-configs', data),
  updateConfig: (configId: number, data: any): Promise<any> => api.put(`/api/v1/model-configs/${configId}`, data),
  deleteConfig: (configId: number): Promise<any> => api.delete(`/api/v1/model-configs/${configId}`),
  getProviders: (): Promise<any> => api.get('/api/v1/model-configs/providers'),
};

// DifyAgent 管理 API
export const difyAgentApi = {
  listAgents: (): Promise<any[]> => api.get('/api/v1/dify-agents'),
  getAgent: (agentId: number): Promise<any> => api.get(`/api/v1/dify-agents/${agentId}`),
  createAgent: (data: any): Promise<any> => api.post('/api/v1/dify-agents', data),
  updateAgent: (agentId: number, data: any): Promise<any> => api.put(`/api/v1/dify-agents/${agentId}`, data),
  deleteAgent: (agentId: number): Promise<any> => api.delete(`/api/v1/dify-agents/${agentId}`),
};

// BadCase 管理 API
export const badCaseApi = {
  listBadCases: (params?: { agent_id?: number; limit?: number; offset?: number }): Promise<any[]> =>
    api.get('/api/v1/bad-cases', { params }),
  getBadCase: (caseId: number): Promise<any> => api.get(`/api/v1/bad-cases/${caseId}`),
  createBadCase: (data: any): Promise<any> => api.post('/api/v1/bad-cases', data),
  updateBadCase: (caseId: number, data: any): Promise<any> => api.put(`/api/v1/bad-cases/${caseId}`, data),
  deleteBadCase: (caseId: number): Promise<any> => api.delete(`/api/v1/bad-cases/${caseId}`),
  updateTurn: (turnId: number, data: any): Promise<any> => api.put(`/api/v1/bad-case-turns/${turnId}`, data),
  deleteTurn: (turnId: number): Promise<any> => api.delete(`/api/v1/bad-case-turns/${turnId}`),
  evaluateTurn: (turnId: number, templateId: number): Promise<any> =>
    api.post(`/api/v1/bad-case-turns/${turnId}/evaluate`, { template_id: templateId }),
};

// 评测模板管理 API
export const evaluationTemplateApi = {
  listTemplates: (params?: { keyword?: string; limit?: number; offset?: number }): Promise<any[]> =>
    api.get('/api/v1/evaluation-templates', { params }),
  getTemplate: (templateId: number): Promise<any> => api.get(`/api/v1/evaluation-templates/${templateId}`),
  createTemplate: (data: any): Promise<any> => api.post('/api/v1/evaluation-templates', data),
  updateTemplate: (templateId: number, data: any): Promise<any> => api.put(`/api/v1/evaluation-templates/${templateId}`, data),
  deleteTemplate: (templateId: number): Promise<any> => api.delete(`/api/v1/evaluation-templates/${templateId}`),
};

// 单条评测 API
export const agentEvaluationRecordApi = {
  listEvaluations: (params?: { template_id?: number; limit?: number; offset?: number }): Promise<any[]> =>
    api.get('/api/v1/agent-evaluations', { params }),
  getEvaluation: (evaluationId: number): Promise<any> => api.get(`/api/v1/agent-evaluations/${evaluationId}`),
  createEvaluation: (data: any): Promise<any> => api.post('/api/v1/agent-evaluations', data),
};

export const authApi = {
  login: (data: { username: string; password: string }): Promise<any> => api.post('/api/v1/auth/login', data),
  me: (): Promise<any> => api.get('/api/v1/auth/me'),
  logout: () => authStorage.clear(),
};

export default api;
