import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GUEST_ID_HEADER = 'x-guest-id';

/**
 * Reads the guest cart identifier supplied by the storefront. The identifier is
 * generated client-side (UUID v4) and persisted by the browser for guests.
 */
export const GuestId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string | string[]> }>();
  const header = request.headers[GUEST_ID_HEADER];

  return Array.isArray(header) ? header[0] : header;
});
