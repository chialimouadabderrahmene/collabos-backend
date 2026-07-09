import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jane.doe@brand.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Str0ng!Passw0rd',
    description:
      'Minimum 8 characters, must include upper, lower, number and symbol',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z])/, {
    message:
      'password must include an uppercase letter, a lowercase letter, a number and a symbol',
  })
  password!: string;
}
