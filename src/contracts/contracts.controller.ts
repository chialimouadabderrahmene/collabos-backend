import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { createReadStream } from 'node:fs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import { VoidContractDto } from './dto/void-contract.dto';
import { toVersionResponse } from './mappers/contract.mapper';
import { ContractEventsService } from './services/contract-events.service';
import { ContractPdfService } from './services/contract-pdf.service';
import { ContractsService } from './services/contracts.service';
import { SignaturesService } from './services/signatures.service';
import {
  ContractEventResponse,
  ContractResponse,
  ContractVersionResponse,
  PaginatedContractsResponse,
  SignatureResponse,
} from './types/contract-response.types';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly signaturesService: SignaturesService,
    private readonly eventsService: ContractEventsService,
    private readonly pdfService: ContractPdfService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a contract from an active deal (brand owner or admin)',
  })
  @ApiResponse({ status: 201, type: ContractResponse })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContractDto,
  ): Promise<ContractResponse> {
    return this.contractsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my contracts (as brand owner or creator)' })
  @ApiResponse({ status: 200, type: PaginatedContractsResponse })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListContractsQueryDto,
  ): Promise<PaginatedContractsResponse> {
    return this.contractsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a contract' })
  @ApiResponse({ status: 200, type: ContractResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponse> {
    return this.contractsService.findOneOrThrow(id, user);
  }

  @Post(':id/versions')
  @ApiOperation({
    summary: 'Create a new contract version (resets agreement status to draft)',
  })
  @ApiResponse({ status: 201, type: ContractResponse })
  createVersion(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVersionDto,
  ): Promise<ContractResponse> {
    return this.contractsService.createVersion(id, user, dto);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List all versions of a contract' })
  @ApiResponse({ status: 200, type: [ContractVersionResponse] })
  async findVersions(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractVersionResponse[]> {
    const contract = await this.contractsService.findEntityOrThrow(id);
    await this.contractsService.assertParticipant(contract, user);

    const versions = await this.contractsService.findVersionsWithSignatures(id);
    return versions.map((version) => toVersionResponse(version));
  }

  @Get(':id/versions/:versionNumber/pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Download the PDF for a specific contract version' })
  async downloadPdf(
    @Param('id') id: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const contract = await this.contractsService.findEntityOrThrow(id);
    await this.contractsService.assertParticipant(contract, user);

    const version = await this.contractsService.getVersionOrThrow(
      id,
      versionNumber,
    );
    const filePath = this.pdfService.getFilePath(version.pdfFilename as string);

    return new StreamableFile(createReadStream(filePath));
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send the current draft version for signature' })
  @ApiResponse({ status: 200, type: ContractResponse })
  sendForSignature(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponse> {
    return this.contractsService.sendForSignature(id, user);
  }

  @Post(':id/void')
  @ApiOperation({ summary: 'Void a contract before it is fully executed' })
  @ApiResponse({ status: 200, type: ContractResponse })
  void(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VoidContractDto,
  ): Promise<ContractResponse> {
    return this.contractsService.void(id, user, dto);
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign the current version of a contract' })
  @ApiResponse({ status: 201, type: SignatureResponse })
  sign(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SignContractDto,
    @Req() request: Request,
  ): Promise<SignatureResponse> {
    return this.signaturesService.sign(id, user, dto, request.ip);
  }

  @Get(':id/signatures')
  @ApiOperation({ summary: 'List signatures on the current version' })
  @ApiResponse({ status: 200, type: [SignatureResponse] })
  findSignatures(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SignatureResponse[]> {
    return this.signaturesService.findAll(id, user);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get the full audit history of a contract' })
  @ApiResponse({ status: 200, type: [ContractEventResponse] })
  async findHistory(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractEventResponse[]> {
    const contract = await this.contractsService.findEntityOrThrow(id);
    await this.contractsService.assertParticipant(contract, user);

    return this.eventsService.findAll(id);
  }
}
