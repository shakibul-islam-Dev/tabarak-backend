import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './database/prisma.service';

@Public()
@Controller('health')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    let database = 'up';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    if (database === 'down') {
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return {
      status: 'ok',
      database,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
