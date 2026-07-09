import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateContractDto {
  @ApiProperty({ description: 'Active deal this contract formalizes' })
  @IsUUID('4')
  dealId!: string;

  @ApiProperty({ description: 'Full contract terms text' })
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  content!: string;
}
