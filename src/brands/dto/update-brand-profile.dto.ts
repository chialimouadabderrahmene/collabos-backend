import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateBrandProfileDto {
  @ApiPropertyOptional({ example: 'Independent Parisian atelier since 2018.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://ateliernoir.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  websiteUrl?: string;

  @ApiPropertyOptional({ example: 'ateliernoir' })
  @IsOptional()
  @IsString()
  @Matches(/^@?[a-zA-Z0-9_.]{1,30}$/, {
    message: 'instagramHandle must be a valid Instagram username',
  })
  instagramHandle?: string;

  @ApiPropertyOptional({ example: 'contact@ateliernoir.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 2018 })
  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(new Date().getFullYear())
  foundedYear?: number;

  @ApiPropertyOptional({ example: 'Paris, France' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;
}
