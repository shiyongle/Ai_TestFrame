export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: number;
  name: string;
  description?: string;
  protocol: 'http' | 'tcp' | 'mq';
  config?: any;
  project_id: number;
  created_at: string;
  updated_at: string;
}

export interface HttpTestRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  body?: any;
  timeout?: number;
  verify_ssl?: boolean;
  follow_redirects?: boolean;
}

export interface HttpTestResponse {
  status_code: number;
  headers: Record<string, string>;
  body: any;
  execution_time: number;
  success: boolean;
  error_message?: string;
}

export interface TcpTestRequest {
  host: string;
  port: number;
  data: string;
  timeout?: number;
  encoding?: string;
}

export interface TcpTestResponse {
  success: boolean;
  response_data?: string;
  execution_time: number;
  error_message?: string;
}

export interface MqTestRequest {
  host: string;
  port: number;
  queue_name: string;
  message: string;
  exchange?: string;
  routing_key?: string;
  timeout?: number;
  mq_type: 'rabbitmq' | 'activemq' | 'kafka';
}

export interface MqTestResponse {
  success: boolean;
  message_id?: string;
  response_data?: string;
  execution_time: number;
  error_message?: string;
}

export interface Version {
  id: number;
  version_number: string;
  description?: string;
  changes?: any;
  created_by?: string;
  created_at: string;
}

export interface TestReport {
  id: number;
  version_id: number;
  project_id: number;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  error_tests: number;
  summary?: any;
  created_at: string;
}