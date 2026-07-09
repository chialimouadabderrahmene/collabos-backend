import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartService } from './services/cart.service';
import { CartResponse } from './types/order-response.types';

@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get my cart' })
  @ApiResponse({ status: 200, type: CartResponse })
  getCart(@CurrentUser() user: AuthenticatedUser): Promise<CartResponse> {
    return this.cartService.getOrCreate(user.id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an item to my cart' })
  @ApiResponse({ status: 201, type: CartResponse })
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCartItemDto,
  ): Promise<CartResponse> {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update a cart item quantity' })
  @ApiResponse({ status: 200, type: CartResponse })
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponse> {
    return this.cartService.updateItem(user.id, itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove an item from my cart' })
  @ApiResponse({ status: 200, type: CartResponse })
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId') itemId: string,
  ): Promise<CartResponse> {
    return this.cartService.removeItem(user.id, itemId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear my cart' })
  @ApiResponse({ status: 200, type: CartResponse })
  clear(@CurrentUser() user: AuthenticatedUser): Promise<CartResponse> {
    return this.cartService.clear(user.id);
  }
}
