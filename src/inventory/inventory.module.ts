import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminInventoryController } from './admin-inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AuditModule],
  controllers: [AdminInventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
