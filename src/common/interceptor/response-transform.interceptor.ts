import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { isBulkUploadSummaryPayload } from '../utils/bulk-upload-outcome.util';

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

                    let envelopeMessage = value?.message;
                    if (!envelopeMessage) {
                        if (isBulkUploadSummaryPayload(value)) {
                            if (value.failureCount === 0) {
                                envelopeMessage = 'Bulk upload completed successfully.';
                            } else if (value.successCount > 0) {
                                envelopeMessage = 'Bulk upload completed with errors on one or more rows.';
                            } else {
                                envelopeMessage = 'Bulk upload failed.';
                            }
                        } else {
                            envelopeMessage = "Success";
                        }
                    }

                    // If it's direct data, wrap it in the standard format
                    return {
                        statusCode: response.statusCode,
                        timestamp: new Date().toISOString(),
                        method: request.method,
                        path: request.url,
                        message: envelopeMessage,
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