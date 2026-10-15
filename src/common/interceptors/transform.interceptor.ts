import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response as ExpressResponse } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<ExpressResponse>();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data) => {
        let message = 'Operasi berhasil';
        let responseData = data;

        if (
          data &&
          typeof data === 'object' &&
          !Array.isArray(data) &&
          'message' in data &&
          typeof (data as Record<string, any>).message === 'string'
        ) {
          message = (data as Record<string, any>).message;
          if ('data' in data) {
            responseData = (data as Record<string, any>).data;
          } else {
            const rest = { ...(data as Record<string, any>) };
            delete rest.message;
            responseData = rest;
          }
        }

        return {
          success: true,
          statusCode,
          message,
          data: responseData ?? null,
        };
      }),
    );
  }
}
