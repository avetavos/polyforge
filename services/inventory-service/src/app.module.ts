import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InventoryModule } from './inventory/inventory.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [InventoryModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
