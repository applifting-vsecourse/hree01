import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListQuacksQueryDto } from './list-quacks.query.dto';

// Runs the real decorators with the controller's ValidationPipe options.
const parse = async (
  query: object,
): Promise<{ dto: ListQuacksQueryDto; errors: string[] }> => {
  const dto = plainToInstance(ListQuacksQueryDto, query);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors: errors.map((error) => error.property) };
};

describe('ListQuacksQueryDto', () => {
  it('reads mine=true and mine=false from the query string', async () => {
    await expect(parse({ mine: 'true' })).resolves.toMatchObject({
      dto: { mine: true },
      errors: [],
    });
    await expect(parse({ mine: 'false' })).resolves.toMatchObject({
      dto: { mine: false },
      errors: [],
    });
  });

  it('rejects anything else as mine', async () => {
    await expect(parse({ mine: 'yes' })).resolves.toMatchObject({
      errors: ['mine'],
    });
  });

  it('refuses a user id in the request', async () => {
    // "mine" always means the session's user, so there is no way to ask for someone else's
    await expect(parse({ authorId: 'u2' })).resolves.toMatchObject({
      errors: ['authorId'],
    });
  });
});
