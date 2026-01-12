import { BadRequestException } from '@nestjs/common';
import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { IInterServiceRequestParams } from '../interfaces/interservice.request';

function logRequest(config: AxiosRequestConfig): void {
  console.log('Starting Request', config);
}

function logResponse(response: any): void {
  console.log('Response:', response);
}

function logError(error: AxiosError): void {
  console.error('Error:', error);
}

async function retryRequest(
  requestFn: () => Promise<any>,
  retries: number,
  retryDelay: number,
): Promise<any> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await requestFn();
    } catch (error) {
      attempt++;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        throw error;
      }
    }
  }
}

const axiosInstance = axios.create({
  timeout: 10000,
});

axiosInstance.interceptors.request.use(
  (config) => {
    logRequest(config);
    return config;
  },
  (error) => {
    logError(error);
    return Promise.reject(error);
  },
);

axiosInstance.interceptors.response.use(
  (response) => {
    logResponse(response);
    return response;
  },
  (error) => {
    logError(error);
    return Promise.reject(error);
  },
);

export async function interServiceRequestHelper({
  method = 'get',
  service,
  requestPath,
  headers = {},
  query = {},
  body = {},
  timeout,
  retries = 3,
  retryDelay = 1000,
}: IInterServiceRequestParams): Promise<any | null> {
  // Simply convert service name to uppercase and replace hyphen with underscore
  const serviceUrlEnvVar = service.toUpperCase().replace(/-/g, '_') + '_URL';
  const serviceUrl = process.env[serviceUrlEnvVar];

  if (!serviceUrl) {
    throw new BadRequestException(
      `Service URL for "${service}" is not defined in environment variables. Please set ${serviceUrlEnvVar}`,
    );
  }

  const fullUrl = `${serviceUrl}/${requestPath.startsWith('/') ? requestPath.slice(1) : requestPath}`;

  const config: AxiosRequestConfig = {
    method,
    url: fullUrl,
    headers,
    params: query,
    data: body,
    timeout,
  };

  try {
    const apiResponse = await retryRequest(
      () => axiosInstance.request(config),
      retries,
      retryDelay,
    );
    return apiResponse.data.data || apiResponse.data;
  } catch (error) {
    console.log('Error-occured', error);
    throw error;
  }
}
