import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

export interface ApiErrorResponse {
  success: boolean;
  statusCode: number;
  message: string;
  error: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        'Terjadi kesalahan tak terduga',
        exception instanceof Error ? exception.stack : String(exception),
      );

      const payload: ApiErrorResponse = {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Terjadi kesalahan pada server',
        error: 'ERR_INTERNAL',
      };

      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
      return;
    }

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

    // ThrottlerException memakai nama error internal "ThrottlerException";
    // samakan dengan kontrak error ERR_TOO_MANY_REQUESTS.
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      error = 'ERR_TOO_MANY_REQUESTS';
      if (!message || message.startsWith('ThrottlerException')) {
        message = 'Terlalu banyak permintaan, coba lagi nanti';
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
