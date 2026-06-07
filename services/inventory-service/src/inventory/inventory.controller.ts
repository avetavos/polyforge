import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { SkuParamDto } from './dto/sku-param.dto';
import { UserId } from '../common/decorators/user-id.decorator';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getListOfItems() {
    const data = await this.inventoryService.getAllItems();
    return { message: 'List of inventory items', data };
  }

  @Get('/:sku')
  async getItemBySku(@Param() params: SkuParamDto) {
    const data = await this.inventoryService.getItemBySku(params.sku);
    return { message: `Item with SKU ${params.sku}`, data };
  }

  @Post()
  async addItem(@UserId() userId: string, @Body() payload: CreateItemDto) {
    const data = await this.inventoryService.addItem(userId, payload);
    return { message: 'Item created successfully', data };
  }

  @Patch('/:sku/quantity')
  async updateItemBySku(
    @UserId() userId: string,
    @Param() params: SkuParamDto,
    @Body() payload: UpdateItemDto,
  ) {
    const data = await this.inventoryService.updateItemBySku(
      userId,
      params.sku,
      payload,
    );
    return {
      message: `Item with SKU ${params.sku} updated successfully`,
      data,
    };
  }

  @Delete('/:sku')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteItemBySku(
    @UserId() userId: string,
    @Param() params: SkuParamDto,
  ) {
    await this.inventoryService.deleteItemBySku(userId, params.sku);
  }
}
