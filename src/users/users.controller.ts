import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersService } from './services/users.service';
import {
  MessageResponse,
  PaginatedUsersResponse,
  UserResponse,
} from './types/user-response.types';

@ApiTags('users')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (admin only)' })
  @ApiResponse({ status: 200, type: PaginatedUsersResponse })
  findAll(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersResponse> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id (admin only)' })
  @ApiResponse({ status: 200, type: UserResponse })
  findOne(@Param('id') id: string): Promise<UserResponse> {
    return this.usersService.findOneOrThrow(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (admin only)' })
  @ApiResponse({ status: 200, type: UserResponse })
  update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<UserResponse> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a user (admin only)' })
  @ApiResponse({ status: 200, type: MessageResponse })
  remove(@Param('id') id: string): Promise<MessageResponse> {
    return this.usersService.remove(id);
  }
}
