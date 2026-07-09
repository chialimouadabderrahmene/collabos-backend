import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, ShipmentStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShipmentDto } from '../dto/create-shipment.dto';
import { UpdateShipmentStatusDto } from '../dto/update-shipment-status.dto';
import { toShipmentResponse } from '../mappers/order.mapper';
import { ShipmentResponse } from '../types/order-response.types';
import { OrdersService } from './orders.service';

const SHIPPABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.FULFILLED,
];

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  async create(
    orderId: string,
    user: AuthenticatedUser,
    dto: CreateShipmentDto,
  ): Promise<ShipmentResponse> {
    const order = await this.ordersService.findEntityOrThrow(orderId);
    await this.ordersService.assertBrandOwnerOrAdmin(order, user);

    if (!SHIPPABLE_STATUSES.includes(order.status)) {
      throw new ConflictException('This order cannot be shipped yet');
    }

    const shipment = await this.prisma.shipment.create({
      data: {
        orderId,
        carrier: dto.carrier,
        trackingNumber: dto.trackingNumber,
        trackingUrl: dto.trackingUrl,
      },
    });

    if (order.status === OrderStatus.PAID) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.FULFILLED },
      });
    }

    return toShipmentResponse(shipment);
  }

  async findAll(
    orderId: string,
    user: AuthenticatedUser,
  ): Promise<ShipmentResponse[]> {
    const order = await this.ordersService.findEntityOrThrow(orderId);
    await this.ordersService.assertParticipant(order, user);

    const shipments = await this.prisma.shipment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    return shipments.map((shipment) => toShipmentResponse(shipment));
  }

  async updateStatus(
    orderId: string,
    shipmentId: string,
    user: AuthenticatedUser,
    dto: UpdateShipmentStatusDto,
  ): Promise<ShipmentResponse> {
    const order = await this.ordersService.findEntityOrThrow(orderId);
    await this.ordersService.assertBrandOwnerOrAdmin(order, user);

    const shipment = await this.findShipmentOrThrow(orderId, shipmentId);

    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: dto.status,
        shippedAt:
          dto.status === ShipmentStatus.SHIPPED
            ? new Date()
            : shipment.shippedAt,
        deliveredAt:
          dto.status === ShipmentStatus.DELIVERED
            ? new Date()
            : shipment.deliveredAt,
      },
    });

    if (dto.status === ShipmentStatus.DELIVERED) {
      const remainingShipments = await this.prisma.shipment.findMany({
        where: { orderId },
      });

      const allDelivered = remainingShipments.every(
        (item) => item.status === ShipmentStatus.DELIVERED,
      );

      if (allDelivered) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.COMPLETED, completedAt: new Date() },
        });
      }
    }

    return toShipmentResponse(updated);
  }

  private async findShipmentOrThrow(orderId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment || shipment.orderId !== orderId) {
      throw new NotFoundException('Shipment not found');
    }

    return shipment;
  }
}
