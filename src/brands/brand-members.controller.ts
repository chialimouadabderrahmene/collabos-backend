import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import {
  AddBrandMemberDto,
  UpdateBrandMemberDto,
} from './dto/brand-member.dto';
import { BrandMembersService } from './services/brand-members.service';
import { BrandMemberResponse } from './types/brand-member-response.types';
import { MessageResponse } from './types/brand-response.types';

@ApiTags('brands/members')
@ApiBearerAuth()
@Controller('brands/:brandId/members')
export class BrandMembersController {
  constructor(private readonly membersService: BrandMembersService) {}

  @Get()
  @ApiOperation({ summary: 'List brand team members (any member)' })
  @ApiResponse({ status: 200, type: [BrandMemberResponse] })
  list(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BrandMemberResponse[]> {
    return this.membersService.list(brandId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Add an existing user to the brand team (admin+)' })
  @ApiResponse({ status: 201, type: BrandMemberResponse })
  add(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddBrandMemberDto,
  ): Promise<BrandMemberResponse> {
    return this.membersService.add(brandId, user, dto);
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Change a member role (admin+)' })
  @ApiResponse({ status: 200, type: BrandMemberResponse })
  updateRole(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBrandMemberDto,
  ): Promise<BrandMemberResponse> {
    return this.membersService.updateRole(brandId, memberUserId, user, dto);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove a member, or leave the brand yourself' })
  @ApiResponse({ status: 200, type: MessageResponse })
  remove(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.membersService.remove(brandId, memberUserId, user);
  }
}
