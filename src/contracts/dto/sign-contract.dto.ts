import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SignContractDto {
  @ApiProperty({
    example: 'Jane Doe',
    description: 'Full legal name entered as signature',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  signedName!: string;
}
