import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

export interface ApiErrorResponse {
  success: boolean;
  statusCode: number;
  message: string;
  error: string;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode = exception.getStatus();
    const res = exception.getResponse();

    let message = exception.message || 'Terjadi kesalahan pada server';
    let error = HttpStatus[statusCode] || 'ERR_HTTP_EXCEPTION';

    if (typeof res === 'string') {
      message = res;
    } else if (typeof res === 'object' && res !== null) {
      const resObj = res as Record<string, any>;

      if (Array.isArray(resObj.message)) {
        message = resObj.message.join(', ');
      } else if (typeof resObj.message === 'string') {
        message = resObj.message;
      }

      if (typeof resObj.error === 'string') {
        error = resObj.error;
      }
    }

    const payload: ApiErrorResponse = {
      success: false,
      statusCode,
      message,
      error,
    };

    response.status(statusCode).json(payload);
  }
}
