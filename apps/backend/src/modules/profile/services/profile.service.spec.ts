import { Profile, UsernameTakenError } from '@/modules/profile/domain/profile';
import { ProfileRepository } from '@/modules/profile/repositories/profile.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { ProfileService } from './profile.service';

const aProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'u1',
  name: 'Caffeinated Duck',
  username: 'CaffeinatedDuck',
  bio: null,
  defaultMood: null,
  ...overrides,
});

const user = { id: 'u1' } as Identity;

describe('ProfileService', () => {
  it('returns the profile of the signed-in user', async () => {
    const repository = mock<ProfileRepository>();
    repository.getProfile.mockResolvedValue(aProfile());

    const service = new ProfileService(repository);

    await expect(service.getProfile(user)).resolves.toEqual(aProfile());
    expect(repository.getProfile).toHaveBeenCalledWith('u1');
  });

  it('throws 404 when the user no longer exists', async () => {
    const repository = mock<ProfileRepository>();
    repository.getProfile.mockResolvedValue(null);

    const service = new ProfileService(repository);

    await expect(service.getProfile(user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates the profile of the signed-in user only', async () => {
    const update = {
      name: 'Decaf Duck',
      username: 'Decaf.Duck',
      bio: 'Trying to cut down.',
      defaultMood: 'sad' as const,
    };
    const repository = mock<ProfileRepository>();
    repository.updateProfile.mockResolvedValue(aProfile(update));

    const service = new ProfileService(repository);

    await expect(service.updateProfile(user, update)).resolves.toEqual(
      aProfile(update),
    );
    expect(repository.updateProfile).toHaveBeenCalledWith('u1', update);
  });

  it('reports a taken username as a 409 aimed at the username field', async () => {
    const repository = mock<ProfileRepository>();
    repository.updateProfile.mockRejectedValue(
      new UsernameTakenError('BreadCritic'),
    );

    const service = new ProfileService(repository);
    const result = service.updateProfile(user, {
      name: 'Caffeinated Duck',
      username: 'BreadCritic',
      bio: null,
      defaultMood: null,
    });

    await expect(result).rejects.toBeInstanceOf(ConflictException);
    await expect(result).rejects.toMatchObject({
      response: {
        field: 'username',
        message: 'That username is already taken',
      },
    });
  });
});
