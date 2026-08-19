import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

const build = (query: Record<string, unknown>) =>
  plainToInstance(PaginationQueryDto, query);

describe('PaginationQueryDto', () => {
  it('defaults to page 1 with a limit of 20', () => {
    const dto = build({});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('coerces numeric query strings', async () => {
    const dto = build({ page: '3', limit: '50' });
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('computes skip from page and limit', () => {
    expect(build({ page: '1', limit: '20' }).skip).toBe(0);
    expect(build({ page: '4', limit: '25' }).skip).toBe(75);
  });

  it.each([
    ['page below 1', { page: '0' }],
    ['a limit above the ceiling', { limit: '101' }],
    ['a non-integer page', { page: '1.5' }],
  ])('rejects %s', async (_label, query) => {
    const errors = await validate(build(query));
    expect(errors.length).toBeGreaterThan(0);
  });
});
