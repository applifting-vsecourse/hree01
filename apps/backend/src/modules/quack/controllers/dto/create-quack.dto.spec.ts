import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateQuackDto } from './create-quack.dto';

// Runs the real decorators, the same way the controller's ValidationPipe does.
const errorsFor = async (body: object): Promise<string[]> => {
  const dto = plainToInstance(CreateQuackDto, body);
  const errors = await validate(dto, { whitelist: true });
  const collect = (list: typeof errors): string[] =>
    list.flatMap((error) => [
      ...Object.values(error.constraints ?? {}),
      ...collect(error.children ?? []),
    ]);
  return collect(errors);
};

const withOptions = (options: unknown[]): object => ({
  text: 'Where do we go for lunch?',
  poll: { options },
});

describe('CreateQuackDto poll validation', () => {
  it('accepts a quack without a poll', async () => {
    await expect(errorsFor({ text: 'Just quacking' })).resolves.toEqual([]);
  });

  it('accepts 2 options and trims them', async () => {
    const dto = plainToInstance(
      CreateQuackDto,
      withOptions(['  Café ', 'Bakery']),
    );

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.poll?.options).toEqual(['Café', 'Bakery']);
  });

  it('needs at least 2 and at most 10 options', async () => {
    await expect(errorsFor(withOptions(['Café']))).resolves.toContain(
      'A poll needs at least 2 options',
    );
    await expect(
      errorsFor(
        withOptions(Array.from({ length: 11 }, (_, i) => `Option ${i}`)),
      ),
    ).resolves.toContain('A poll can have at most 10 options');
  });

  it('rejects an empty or whitespace-only option', async () => {
    await expect(errorsFor(withOptions(['Café', '   ']))).resolves.toContain(
      'Every option needs some text',
    );
  });

  it('rejects an option over 80 characters', async () => {
    await expect(
      errorsFor(withOptions(['Café', 'a'.repeat(81)])),
    ).resolves.toContain('Keep each option under 80 characters');
  });

  it('rejects options that differ only in case or surrounding spaces', async () => {
    await expect(errorsFor(withOptions(['Café', ' CAFÉ']))).resolves.toContain(
      'Options must be different from each other',
    );
  });

  it('rejects an unknown results setting', async () => {
    const errors = await errorsFor({
      text: 'Lunch?',
      poll: { options: ['Café', 'Bakery'], resultsVisibility: 'never' },
    });

    expect(errors).toHaveLength(1);
  });
});
