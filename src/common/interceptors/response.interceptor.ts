import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { ApiSuccessResponse, PaginatedResult } from '../interfaces/api-response.interface';

function isPaginatedResult(value: unknown): value is PaginatedResult<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as PaginatedResult<unknown>).items) &&
    typeof (value as PaginatedResult<unknown>).meta === 'object'
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T | T[]>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T | T[]>> {
    return next.handle().pipe(
      map((data) => {
        const message =
          this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
            context.getHandler(),
            context.getClass(),
          ]) ?? 'Request completed successfully';

        if (isPaginatedResult(data)) {
          return {
            success: true as const,
            data: data.items as unknown as T,
            message,
            meta: data.meta,
          };
        }

        return {
          success: true as const,
          data,
          message,
        };
      }),
    );
  }
}
