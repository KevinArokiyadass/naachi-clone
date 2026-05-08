import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminUserBulkMetricsService {
  private readonly counters = new Map<string, number>();

  increment(counter: string, count = 1): void {
    this.counters.set(counter, (this.counters.get(counter) || 0) + count);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters.entries());
  }
}

