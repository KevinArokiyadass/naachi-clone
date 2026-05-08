import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class AdminUserBulkRateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, number[]>();
  private readonly windowMs = 60_000;
  private readonly maxRequests = 5;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userKey = request?.user?.sub || request?.user?.username || request?.ip || 'anonymous';
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const history = (this.requests.get(userKey) || []).filter((timestamp) => timestamp > windowStart);
    if (history.length >= this.maxRequests) {
      throw new HttpException('Bulk upload rate limit exceeded. Please retry later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    history.push(now);
    this.requests.set(userKey, history);
    return true;
  }
}

