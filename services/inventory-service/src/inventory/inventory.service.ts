import { Injectable } from '@nestjs/common';
import { InventoryItem, InventoryTransactionType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async getAllItems(): Promise<InventoryItem[]> {
    return await this.prismaService.inventoryItem.findMany({
      where: { deletedAt: null },
    });
  }

  async getItemBySku(sku: string): Promise<InventoryItem | null> {
    const isExisting = await this.isExisting(sku);
    if (!isExisting) {
      throw new Error(`Item with SKU does not exist`);
    }
    return await this.prismaService.inventoryItem.findUnique({
      where: { sku },
    });
  }

  async addItem(
    userId: string,
    payload: CreateItemDto,
  ): Promise<InventoryItem> {
    const isExisting = await this.isExisting(payload.sku);
    if (isExisting) {
      throw new Error(`Item with SKU already exists`);
    }

    const item = await this.prismaService.$transaction(async (tx) => {
      const createdItem = await tx.inventoryItem.create({
        data: {
          sku: payload.sku,
          available: payload.quantity,
        },
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

    return item;
  }

  async updateItemBySku(
    userId: string,
    sku: string,
    payload: UpdateItemDto,
  ): Promise<InventoryItem> {
    const isExisting = await this.isExisting(sku);
    if (!isExisting) {
      throw new Error(`Item with SKU does not exist`);
    }

    const item = await this.prismaService.$transaction(async (tx) => {
      const updatedItem = await tx.inventoryItem.update({
        where: { sku },
        data: {
          available: {
            increment: payload.quantity,
          },
        },
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

    return item;
  }

  async deleteItemBySku(userId: string, sku: string): Promise<void> {
    const isExisting = await this.isExisting(sku);
    if (!isExisting) {
      throw new Error(`Item with SKU does not exist`);
    }

    await this.prismaService.$transaction(async (tx) => {
      const deletedItem = await tx.inventoryItem.update({
        where: { sku },
        data: {
          deletedAt: new Date(),
        },
      });

      await tx.inventoryLogs.create({
        data: {
          sku,
          type: InventoryTransactionType.DELETE,
          quantity: deletedItem.available,
          userId,
        },
      });
    });
  }

  private async isExisting(sku: string): Promise<boolean> {
    const item = await this.prismaService.inventoryItem.findUnique({
      where: { sku, deletedAt: null },
    });
    return !!item;
  }
}
