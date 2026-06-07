import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryItem,
  InventoryTransactionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async getAllItems(): Promise<InventoryItem[]> {
    return this.prismaService.inventoryItem.findMany({
      where: { deletedAt: null },
    });
  }

  async getItemBySku(sku: string): Promise<InventoryItem> {
    const item = await this.prismaService.inventoryItem.findFirst({
      where: { sku, deletedAt: null },
    });
    if (!item) {
      throw new NotFoundException(`Item with SKU ${sku} does not exist`);
    }
    return item;
  }

  async addItem(
    userId: string,
    payload: CreateItemDto,
  ): Promise<InventoryItem> {
    const existing = await this.prismaService.inventoryItem.findFirst({
      where: { sku: payload.sku, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Item with SKU ${payload.sku} already exists`,
      );
    }

    try {
      return await this.prismaService.$transaction(async (tx) => {
        const createdItem = await tx.inventoryItem.create({
          data: { sku: payload.sku, available: payload.quantity },
        });
        await tx.inventoryLogs.create({
          data: {
            sku: payload.sku,
            userId,
            type: InventoryTransactionType.CREATE,
            quantity: payload.quantity,
          },
        });
        return createdItem;
      });
    } catch (error) {
      // Unique-constraint violation (P2002): a concurrent request won the race,
      // or the SKU already exists as a soft-deleted row. Surface a clean 409
      // instead of letting it bubble up as a 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Item with SKU ${payload.sku} already exists`,
        );
      }
      throw error;
    }
  }

  async updateItemBySku(
    userId: string,
    sku: string,
    payload: UpdateItemDto,
  ): Promise<InventoryItem> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findFirst({
        where: { sku, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Item with SKU ${sku} does not exist`);
      }

      const updatedItem = await tx.inventoryItem.update({
        where: { sku },
        data: { available: { increment: payload.quantity } },
      });
      await tx.inventoryLogs.create({
        data: {
          sku,
          userId,
          type: InventoryTransactionType.UPDATE,
          quantity: payload.quantity,
        },
      });
      return updatedItem;
    });
  }

  async deleteItemBySku(userId: string, sku: string): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findFirst({
        where: { sku, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Item with SKU ${sku} does not exist`);
      }

      const deletedItem = await tx.inventoryItem.update({
        where: { sku },
        data: { deletedAt: new Date() },
      });
      await tx.inventoryLogs.create({
        data: {
          sku,
          userId,
          type: InventoryTransactionType.DELETE,
          quantity: deletedItem.available,
        },
      });
    });
  }
}
