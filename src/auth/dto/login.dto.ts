import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane.doe@brand.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Str0ng!Passw0rd' })
  @IsString()
  @MinLength(8)
  password!: string;
}
