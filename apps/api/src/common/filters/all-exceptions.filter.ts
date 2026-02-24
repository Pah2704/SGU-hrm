import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

type NormalizedError = {
  statusCode: number;
  message: string;
  errors?: Array<string | { field?: string; message: string }>;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const rawRequest = ctx.getRequest<unknown>();
    const request = this.extractRequest(rawRequest);
    const requestUrl = httpAdapter.getRequestUrl(
      request as unknown as Record<string, unknown>,
    ) as unknown;

    const normalized = this.normalizeException(exception);

    const responseBody = {
      statusCode: normalized.statusCode,
      message: normalized.message,
      ...(normalized.errors && normalized.errors.length > 0
        ? { errors: normalized.errors }
        : {}),
      timestamp: new Date().toISOString(),
      path: typeof requestUrl === 'string' ? requestUrl : request.url,
      ...(request.requestId ? { requestId: request.requestId } : {}),
    };

    if (normalized.statusCode >= 500) {
      this.logger.error(
        `[${request.requestId ?? 'n/a'}] ${request.method} ${request.url} ${
          normalized.statusCode
        } ${normalized.message}`,
        exception instanceof Error
          ? exception.stack
          : JSON.stringify(exception),
      );
    } else {
      this.logger.warn(
        `[${request.requestId ?? 'n/a'}] ${request.method} ${request.url} ${
          normalized.statusCode
        } ${normalized.message}`,
      );
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, normalized.statusCode);
  }

  private normalizeException(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { statusCode, message: response };
      }

      if (typeof response === 'object' && response !== null) {
        const body = response as {
          message?: string | string[];
          errors?: Array<string | { field?: string; message: string }>;
        };

        const arrayMessage = Array.isArray(body.message) ? body.message : null;
        const message =
          typeof body.message === 'string'
            ? body.message
            : arrayMessage
              ? 'Validation failed'
              : exception.message;

        const errors =
          body.errors ??
          (arrayMessage
            ? arrayMessage.map((item) => ({
                message: item,
              }))
            : undefined);

        return { statusCode, message, errors };
      }

      return {
        statusCode,
        message: exception.message || 'Request failed',
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaException(exception);
    }

    if (exception instanceof Error) {
      const isProduction = process.env.NODE_ENV === 'production';
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: isProduction ? 'Internal server error' : exception.message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private mapPrismaException(
    exception: Prisma.PrismaClientKnownRequestError,
  ): NormalizedError {
    switch (exception.code) {
      case 'P2002': {
        const targets = this.extractPrismaTargets(exception.meta?.target);

        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Resource already exists',
          errors: targets.map((field) => ({
            field,
            message: `${field} already exists`,
          })),
        };
      }
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Operation violates related data constraints',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Database request failed',
        };
    }
  }

  private extractPrismaTargets(target: unknown): string[] {
    if (Array.isArray(target)) {
      return target
        .filter((item): item is string => typeof item === 'string')
        .filter((item) => item.trim().length > 0);
    }

    if (typeof target === 'string' && target.trim().length > 0) {
      return [target];
    }

    return ['unique field'];
  }

  private extractRequest(value: unknown): {
    method: string;
    url: string;
    requestId?: string;
  } {
    if (typeof value !== 'object' || value === null) {
      return {
        method: 'UNKNOWN',
        url: 'UNKNOWN',
      };
    }

    const request = value as {
      method?: unknown;
      url?: unknown;
      requestId?: unknown;
    };

    return {
      method: typeof request.method === 'string' ? request.method : 'UNKNOWN',
      url: typeof request.url === 'string' ? request.url : 'UNKNOWN',
      requestId:
        typeof request.requestId === 'string' ? request.requestId : undefined,
    };
  }
}
