import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    const isValidationError =
      typeof body === 'object' &&
      body !== null &&
      Array.isArray((body as { message?: unknown }).message);

    const KNOWN_KEYS = new Set(['statusCode', 'message', 'error']);
    const extraFields =
      typeof body === 'object' && body !== null
        ? Object.fromEntries(
            Object.entries(body).filter(([key]) => !KNOWN_KEYS.has(key)),
          )
        : {};

    response.status(status).json({
      error: {
        code: HttpStatus[status] ?? String(status),
        message: isValidationError
          ? 'Validation failed'
          : typeof body === 'string'
            ? body
            : ((body as { message?: string }).message ?? exception.message),
        ...(isValidationError
          ? { fields: (body as { message: string[] }).message }
          : {}),
        ...extraFields,
      },
    });
  }
}
