import {
  Contract,
  ContractEvent,
  ContractSignature,
  ContractVersion,
} from '@prisma/client';
import {
  ContractEventResponse,
  ContractResponse,
  ContractVersionResponse,
  SignatureResponse,
} from '../types/contract-response.types';

export function toContractResponse(
  contract: Contract,
  currentVersionNumber: number,
): ContractResponse {
  return {
    id: contract.id,
    dealId: contract.dealId,
    brandId: contract.brandId,
    creatorId: contract.creatorId,
    status: contract.status,
    currentVersionNumber,
    executedAt: contract.executedAt,
    voidedAt: contract.voidedAt,
    voidReason: contract.voidReason,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
  };
}

export function toSignatureResponse(
  signature: ContractSignature,
): SignatureResponse {
  return {
    id: signature.id,
    party: signature.party,
    signerId: signature.signerId,
    signedName: signature.signedName,
    signedAt: signature.signedAt,
  };
}

export function toVersionResponse(
  version: ContractVersion & { signatures: ContractSignature[] },
): ContractVersionResponse {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    content: version.content,
    pdfAvailable: !!version.pdfFilename,
    createdById: version.createdById,
    createdAt: version.createdAt,
    signatures: version.signatures.map((signature) =>
      toSignatureResponse(signature),
    ),
  };
}

export function toEventResponse(event: ContractEvent): ContractEventResponse {
  return {
    id: event.id,
    type: event.type,
    actorId: event.actorId,
    metadata: event.metadata as Record<string, unknown> | null,
    createdAt: event.createdAt,
  };
}
