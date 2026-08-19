import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 20 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
  @ApiProperty({ example: 1 }) totalPages: number;
  @ApiProperty({ example: false }) hasNextPage: boolean;
  @ApiProperty({ example: false }) hasPreviousPage: boolean;
}

export class PaginatedResponseDto<T> {
  data: T[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;

  constructor(data: T[], total: number, page: number, limit: number) {
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    this.data = data;
    this.meta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
