import { PartialType } from '@nestjs/swagger';
import { CreateServiceVersionDto } from './create-service-version.dto';

export class UpdateServiceVersionDto extends PartialType(
  CreateServiceVersionDto,
) {}
