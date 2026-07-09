import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateBriefDto } from './create-brief.dto';

export class UpdateBriefDto extends PartialType(
  OmitType(CreateBriefDto, ['brandId'] as const),
) {}
