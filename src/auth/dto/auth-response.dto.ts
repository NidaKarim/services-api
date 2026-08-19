import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Bearer token for the Authorization header.' })
  accessToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
