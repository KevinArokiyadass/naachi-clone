import { Injectable, Inject, Req } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request } from 'express';
import { lastValueFrom } from 'rxjs';
import { HTTP_HEADERS } from '../constants/http-headers.constants';
import { ErrorException } from '../errors/custom-error.exception';
import { ExcludedApiRoutes } from '../enums/common.enum';

@Injectable()
export class HttpClientService {
  constructor(
    private readonly httpService: HttpService,
    @Inject('REQUEST') private readonly req: Request
  ) { }

  private getHeaders() {
    const headers = this.req['headers'];
    const intereServiceHeaders = {
      [HTTP_HEADERS.ACCESS_TOKEN]: headers[HTTP_HEADERS.ACCESS_TOKEN],
      [HTTP_HEADERS.ID_TOKEN]: headers[HTTP_HEADERS.ID_TOKEN],
      [HTTP_HEADERS.USER_CURRENT_VIEW]: headers[HTTP_HEADERS.USER_CURRENT_VIEW],
    }
    // if(Helpers.enumToArray(ExcludedApiRoutes).some(route => this.req.path.includes(route as string))){
    //   intereServiceHeaders[HTTP_HEADERS.USER_CURRENT_VIEW] = UserTypeEnum.CRON
    // }
    return intereServiceHeaders;
  }

  private handleError(error: any) {
    if (error.response) {
      const { status = 500, data = {}, message: errorMessage } = error.response;
      const message = errorMessage || data.message || 'An unexpected error occurred';
      const errorCode = data.errorCode || 'ERR404';
      throw new ErrorException(errorCode, message, status);
    } else {
      throw new ErrorException(null, 'No response received from the server', 500);
    }
  }

  private resolveUrl(serviceKey: string): string {
    const serviceUrlEnvVar = `${serviceKey}_URL`;
    const url = process.env[serviceUrlEnvVar];
    if (!url) {
      throw new ErrorException(null, `Service URL for "${serviceKey}" is not defined in environment variables. Please set ${serviceUrlEnvVar}`, 500);
    }
    return url;
  }

  private buildUrl(serviceKey: string, endpoint?: string): string {
    const baseUrl = this.resolveUrl(serviceKey);
    return endpoint ? `${baseUrl}${endpoint}` : baseUrl;
  }

  public async get<T>(serviceKey: string, endpoint?: string, query?: any, skipError: boolean = false): Promise<{ result: T }> {
    try {
      const url = this.buildUrl(serviceKey, endpoint);
      const response$ = this.httpService.get(url, {
        params: query,
        headers: this.getHeaders(),
      });
      const response = await lastValueFrom(response$);
      return response.data.data;
    } catch (error) {
      console.log(error)
      if (!skipError) {
        this.handleError(error);
      }
      return null;
    }
  }

  public async post<T>(serviceKey: string, endpoint?: string, body?: any, query?: any): Promise<{ result: T }> {
    try {
      const url = this.buildUrl(serviceKey, endpoint);
      const response$ = this.httpService.post(url, body, {
        params: query,
        headers: this.getHeaders(),
      });
      const response = await lastValueFrom(response$);
      return response.data.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  public async put<T>(serviceKey: string, endpoint?: string, body?: any): Promise<{ result: T }> {
    try {
      const url = this.buildUrl(serviceKey, endpoint);
      const response$ = this.httpService.put(url, body, {
        headers: this.getHeaders(),
      });
      const response = await lastValueFrom(response$);
      return response.data.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async patch<T>(
    serviceKey: string,
    endpoint?: string,
    body?: any,
  ): Promise<{ result: T }> {
    try {
      const url = this.buildUrl(serviceKey, endpoint);
      const response$ = this.httpService.patch(url, body, {
        headers: this.getHeaders(),
      });
      const response = await lastValueFrom(response$);
      return response.data.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  public async delete<T>(serviceKey: string, endpoint?: string, query?: any): Promise<{ result: T }> {
    try {
      const url = this.buildUrl(serviceKey, endpoint);
      const response$ = this.httpService.delete(url, {
        params: query,
        headers: this.getHeaders(),
      });
      const response = await lastValueFrom(response$);
      return response.data.data;
    } catch (error) {
      this.handleError(error);
    }
  }
}
