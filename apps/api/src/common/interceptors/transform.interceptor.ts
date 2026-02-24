import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type PaginatedPayload<T> = {
  data: T;
  meta: Record<string, unknown>;
};

type MessagePayload = {
  message: string;
};

type LegacyEnvelope<T> = {
  statusCode: number;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
};

export type ApiSuccessResponse<T> =
  | { data: T }
  | PaginatedPayload<T>
  | MessagePayload;

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (this.isLegacyEnvelope<T>(data)) {
          if (this.isPaginatedPayload(data)) {
            return { data: data.data, meta: data.meta };
          }

          if (typeof data.message === 'string' && data.data === undefined) {
            return { message: data.message };
          }

          return { data: data.data as T };
        }

        if (this.isPaginatedPayload(data)) {
          return { data: data.data, meta: data.meta };
        }

        if (this.isMessagePayload(data)) {
          return { message: data.message };
        }

        if (typeof data === 'undefined') {
          return { message: 'OK' };
        }

        return { data: data as T };
      }),
    );
  }

  private isPaginatedPayload(value: unknown): value is PaginatedPayload<T> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      'meta' in value
    );
  }

  private isMessagePayload(value: unknown): value is MessagePayload {
    if (typeof value !== 'object' || value === null || !('message' in value)) {
      return false;
    }

    const typedValue = value as Record<string, unknown>;
    return (
      typeof typedValue.message === 'string' &&
      !('data' in typedValue) &&
      !('meta' in typedValue)
    );
  }

  private isLegacyEnvelope<U>(value: unknown): value is LegacyEnvelope<U> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'statusCode' in value &&
      'message' in value
    );
  }
}
