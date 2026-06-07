import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: {
    getAllItems: jest.Mock;
    getItemBySku: jest.Mock;
    addItem: jest.Mock;
    updateItemBySku: jest.Mock;
    deleteItemBySku: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getAllItems: jest.fn(),
      getItemBySku: jest.fn(),
      addItem: jest.fn(),
      updateItemBySku: jest.fn(),
      deleteItemBySku: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: service }],
    }).compile();
    controller = module.get<InventoryController>(InventoryController);
  });

  it('getListOfItems returns the list envelope', async () => {
    const data = [{ sku: 'ABC' }];
    service.getAllItems.mockResolvedValue(data);

    await expect(controller.getListOfItems()).resolves.toEqual({
      message: 'List of inventory items',
      data,
    });
  });

  it('getItemBySku returns the item envelope', async () => {
    const data = { sku: 'ABC' };
    service.getItemBySku.mockResolvedValue(data);

    await expect(controller.getItemBySku({ sku: 'ABC' })).resolves.toEqual({
      message: 'Item with SKU ABC',
      data,
    });
    expect(service.getItemBySku).toHaveBeenCalledWith('ABC');
  });

  it('addItem delegates with the user id and returns the created envelope', async () => {
    const data = { sku: 'ABC', available: 2 };
    service.addItem.mockResolvedValue(data);

    await expect(
      controller.addItem('user-1', { sku: 'ABC', quantity: 2 }),
    ).resolves.toEqual({ message: 'Item created successfully', data });
    expect(service.addItem).toHaveBeenCalledWith('user-1', {
      sku: 'ABC',
      quantity: 2,
    });
  });

  it('updateItemBySku delegates and returns the updated envelope', async () => {
    const data = { sku: 'ABC', available: 7 };
    service.updateItemBySku.mockResolvedValue(data);

    await expect(
      controller.updateItemBySku('user-1', { sku: 'ABC' }, { quantity: 5 }),
    ).resolves.toEqual({
      message: 'Item with SKU ABC updated successfully',
      data,
    });
    expect(service.updateItemBySku).toHaveBeenCalledWith('user-1', 'ABC', {
      quantity: 5,
    });
  });

  it('deleteItemBySku delegates and returns void', async () => {
    service.deleteItemBySku.mockResolvedValue(undefined);

    await expect(
      controller.deleteItemBySku('user-1', { sku: 'ABC' }),
    ).resolves.toBeUndefined();
    expect(service.deleteItemBySku).toHaveBeenCalledWith('user-1', 'ABC');
  });
});
