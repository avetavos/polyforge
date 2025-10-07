import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { InventoryService } from './inventory.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { SkuParamDto } from './dto/sku-param.dto';

@Controller('inventory')
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getListOfItems(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.inventoryService.getAllItems();
      res.status(HttpStatus.OK).send({
        message: 'List of inventory items',
        data,
      });
    } catch (error) {
      this.logger.error('Failed to fetch inventory items', error);
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ message: 'Internal server error' });
    }
  }

  @Get('/:sku')
  async getItemBySku(
    @Req() req: Request,
    @Res() res: Response,
    @Param() params: SkuParamDto,
  ) {
    try {
      const data = await this.inventoryService.getItemBySku(params.sku);
      res.status(HttpStatus.OK).send({
        message: `Item with SKU ${params.sku}`,
        data,
      });
    } catch (error) {
      if (error.message === 'Item with SKU does not exist') {
        res
          .status(HttpStatus.NOT_FOUND)
          .send({ message: `Item with SKU ${params.sku} does not exist` });
      } else {
        this.logger.error('Failed to fetch inventory item', error);
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send({ message: 'Internal server error' });
      }
    }
  }

  @Post()
  async addItem(
    @Req() req: Request,
    @Res() res: Response,
    @Body() payload: CreateItemDto,
  ) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const data = await this.inventoryService.addItem(userId, payload);
      res.status(HttpStatus.CREATED).send({
        message: 'Item created successfully',
        data,
      });
    } catch (error) {
      if (error.message === 'Item with SKU already exists') {
        res
          .status(HttpStatus.NOT_FOUND)
          .send({ message: `Item with SKU ${payload.sku} already exists` });
      } else {
        this.logger.error('Failed to create inventory item', error);
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send({ message: 'Internal server error' });
      }
    }
  }

  @Patch('/:sku/quantity')
  async updateItemBySku(
    @Req() req: Request,
    @Res() res: Response,
    @Param() params: SkuParamDto,
    @Body() payload: UpdateItemDto,
  ) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const data = await this.inventoryService.updateItemBySku(
        userId,
        params.sku,
        payload,
      );
      res.status(HttpStatus.OK).send({
        message: `Item with SKU ${params.sku} updated successfully`,
        data,
      });
    } catch (error) {
      if (error.message === 'Item with SKU does not exist') {
        res
          .status(HttpStatus.NOT_FOUND)
          .send({ message: `Item with SKU ${params.sku} does not exist` });
      } else {
        this.logger.error('Failed to update inventory item', error);
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send({ message: 'Internal server error' });
      }
    }
  }

  @Delete('/:sku')
  async deleteItemBySku(
    @Req() req: Request,
    @Res() res: Response,
    @Param() params: SkuParamDto,
  ) {
    try {
      const userId = req.headers['x-user-id'] as string;
      await this.inventoryService.deleteItemBySku(userId, params.sku);
      res.status(HttpStatus.NO_CONTENT).send({
        message: `Item with SKU ${params.sku} deleted successfully`,
      });
    } catch (error) {
      if (error.message === 'Item with SKU does not exist') {
        res
          .status(HttpStatus.NOT_FOUND)
          .send({ message: `Item with SKU ${params.sku} does not exist` });
      } else {
        this.logger.error('Failed to delete inventory item', error);
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send({ message: 'Internal server error' });
      }
    }
  }
}
