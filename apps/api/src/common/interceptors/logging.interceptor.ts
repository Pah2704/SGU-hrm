import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, tap } from 'rxjs';

type HttpRequestWithUser = {
  method: string;
  url: string;
  originalUrl?: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: {
    id?: string;
    userId?: string;
    roles?: string[];
  };
  requestId?: string;
};

type HttpResponseLike = {
  statusCode: number;
  setHeader?: (name: string, value: string) => void;
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const req = ctx.getRequest<HttpRequestWithUser>();
    const res = ctx.getResponse<HttpResponseLike>();

    const requestId = this.resolveRequestId(req);
    req.requestId = requestId;
    res.setHeader?.('x-request-id', requestId);

    const method = req.method;
    const url = req.originalUrl ?? req.url;
    const userId = req.user?.userId ?? req.user?.id ?? 'anonymous';
    const roles = req.user?.roles?.join(',') ?? '-';
    const ip = req.ip ?? '-';
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startedAt;
          this.logger.log(
            `[${requestId}] ${method} ${url} ${res.statusCode} ${duration}ms user=${userId} roles=${roles} ip=${ip}`,
          );
        },
        error: (error: unknown) => {
          const duration = Date.now() - startedAt;
          const errorStatus = this.resolveErrorStatus(error);
          this.logger.warn(
            `[${requestId}] ${method} ${url} ${errorStatus} ${duration}ms user=${userId} roles=${roles} ip=${ip}`,
          );
        },
      }),
    );
  }

  private resolveRequestId(req: HttpRequestWithUser): string {
    const headerValue = req.headers['x-request-id'];

    if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
      return headerValue;
    }

    if (Array.isArray(headerValue) && headerValue.length > 0) {
      return headerValue[0];
    }

    return randomUUID();
  }

  private resolveErrorStatus(error: unknown): number {
    if (!error || typeof error !== 'object') {
      return 500;
    }

    const maybeError = error as { status?: number; statusCode?: number };
    return maybeError.status ?? maybeError.statusCode ?? 500;
  }
}
