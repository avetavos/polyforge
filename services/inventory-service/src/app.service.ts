import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prismaService: PrismaService) {}
  async healthz(): Promise<{
    service: 'UP' | 'DOWN';
    database: 'UP' | 'DOWN';
  }> {
    let dbStatus = 'UP';
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'DOWN';
    }

    return {
      service: 'UP',
      database: dbStatus as 'UP' | 'DOWN',
    };
  }
}
