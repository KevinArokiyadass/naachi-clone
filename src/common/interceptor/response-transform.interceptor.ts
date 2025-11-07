import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();
        return next
            .handle()
            .pipe(
                map((value: any) => {
                    // Check if the value is already a formatted API response
                    if (value && typeof value === 'object' && 'statusCode' in value && 'data' in value) {
                        // If it's already formatted, return as is
                        return value;
                    }

                    // Check if the value has a result property (APIResponse format)
                    if (value && typeof value === 'object' && 'result' in value) {
                        return {
                            statusCode: response.statusCode,
                            timestamp: new Date().toISOString(),
                            method: request.method,
                            path: request.url,
                            message: value?.message || "Success",
                            data: value.result,
                        };
                    }

                    // If it's direct data, wrap it in the standard format
                    return {
                        statusCode: response.statusCode,
                        timestamp: new Date().toISOString(),
                        method: request.method,
                        path: request.url,
                        message: "Success",
                        data: value,
                    };
                }),
            );
    }
}

export interface APIResponse {
    result: any;
    message?: string;
}