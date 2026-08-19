import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';

/**
 * Every field optional. `versions` is omitted deliberately — versions are
 * managed through the nested /services/:id/versions routes so a PATCH cannot
 * silently replace a service's whole version history.
 */
export class UpdateServiceDto extends PartialType(
  OmitType(CreateServiceDto, ['versions'] as const),
) {}
