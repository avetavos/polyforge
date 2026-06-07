import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Resolves the authenticated user id from the trusted `x-user-id` header
 * injected by the gateway. Throws 400 if it is missing so a downstream write
 * never fails with a 500 on a null `userId`.
 */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const userId = request.headers['x-user-id'] as string | undefined;
    if (!userId) {
      throw new BadRequestException('Missing required x-user-id header');
    }
    return userId;
  },
);
