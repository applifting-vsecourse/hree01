import {
  Profile,
  ProfileUpdate,
  UsernameTakenError,
} from '@/modules/profile/domain/profile';
import { ProfileRepository } from '@/modules/profile/repositories/profile.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class ProfileService {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async getProfile(user: Identity): Promise<Profile> {
    const profile = await this.profileRepository.getProfile(user.id);
    if (!profile) throw new NotFoundException();
    return profile;
  }

  async updateProfile(user: Identity, update: ProfileUpdate): Promise<Profile> {
    try {
      // the profile is always the signed-in user's own, never one from the body
      return await this.profileRepository.updateProfile(user.id, update);
    } catch (error) {
      if (error instanceof UsernameTakenError) {
        // `field` lets the client show the message next to the username input.
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'That username is already taken',
          field: 'username',
        });
      }
      throw error;
    }
  }
}
