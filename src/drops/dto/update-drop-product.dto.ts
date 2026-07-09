import { PartialType } from '@nestjs/swagger';
import { CreateDropProductDto } from './create-drop-product.dto';

export class UpdateDropProductDto extends PartialType(CreateDropProductDto) {}
