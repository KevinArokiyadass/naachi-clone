export interface IInterServiceRequestParams {
  method?: 'get' | 'post' | 'put' | 'delete' | 'patch';
  service: string;
  requestPath: string;
  headers?: Record<string, string>;
  query?: Record<string, any>;
  body?: any;
  throwException?: boolean;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}