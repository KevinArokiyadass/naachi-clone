import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
  } from '@nestjs/common';
  import { Observable, map, catchError, throwError } from 'rxjs';
  
  @Injectable()
  export class ResponseWrapInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      return next.handle().pipe(
        map((data) => {
          return { result: data };
        }),
        catchError((error) => {
          // Re-throw the error so it can be handled by the exception filter
          return throwError(() => error);
        })
      );
    }
  }