import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { InventoryTransactionType } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  inventoryItem: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  inventoryLogs: { create: jest.Mock };
  $transaction: jest.Mock;
};

function createMockPrisma(): MockPrisma {
  const prisma: MockPrisma = {
    inventoryItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryLogs: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((cb) => cb(prisma));
  return prisma;
}

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<InventoryService>(InventoryService);
  });

  describe('getAllItems', () => {
    it('returns only non-deleted items', async () => {
      const items = [{ sku: 'ABC' }];
      prisma.inventoryItem.findMany.mockResolvedValue(items);

      const result = await service.getAllItems();

      expect(result).toBe(items);
      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });
  });

  describe('getItemBySku', () => {
    it('returns the item when it exists', async () => {
      const item = { sku: 'ABC', available: 5 };
      prisma.inventoryItem.findFirst.mockResolvedValue(item);

      await expect(service.getItemBySku('ABC')).resolves.toBe(item);
      expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith({
        where: { sku: 'ABC', deletedAt: null },
      });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(service.getItemBySku('ABC')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('addItem', () => {
    it('creates the item and writes a CREATE log', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      const created = { sku: 'ABC', available: 3 };
      prisma.inventoryItem.create.mockResolvedValue(created);

      const result = await service.addItem('user-1', {
        sku: 'ABC',
        quantity: 3,
      });

      expect(result).toBe(created);
      expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
        data: { sku: 'ABC', available: 3 },
      });
      expect(prisma.inventoryLogs.create).toHaveBeenCalledWith({
        data: {
          sku: 'ABC',
          userId: 'user-1',
          type: InventoryTransactionType.CREATE,
          quantity: 3,
        },
      });
    });

    it('throws ConflictException when the SKU already exists', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ sku: 'ABC' });

      await expect(
        service.addItem('user-1', { sku: 'ABC', quantity: 3 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
    });
  });

  describe('updateItemBySku', () => {
    it('increments availability and writes an UPDATE log', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ sku: 'ABC' });
      const updated = { sku: 'ABC', available: 8 };
      prisma.inventoryItem.update.mockResolvedValue(updated);

      const result = await service.updateItemBySku('user-1', 'ABC', {
        quantity: 5,
      });

      expect(result).toBe(updated);
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { sku: 'ABC' },
        data: { available: { increment: 5 } },
      });
      expect(prisma.inventoryLogs.create).toHaveBeenCalledWith({
        data: {
          sku: 'ABC',
          userId: 'user-1',
          type: InventoryTransactionType.UPDATE,
          quantity: 5,
        },
      });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateItemBySku('user-1', 'ABC', { quantity: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteItemBySku', () => {
    it('soft-deletes and writes a DELETE log', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ sku: 'ABC' });
      prisma.inventoryItem.update.mockResolvedValue({
        sku: 'ABC',
        available: 4,
      });

      await service.deleteItemBySku('user-1', 'ABC');

      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { sku: 'ABC' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.inventoryLogs.create).toHaveBeenCalledWith({
        data: {
          sku: 'ABC',
          userId: 'user-1',
          type: InventoryTransactionType.DELETE,
          quantity: 4,
        },
      });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteItemBySku('user-1', 'ABC'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
    });
  });
});
