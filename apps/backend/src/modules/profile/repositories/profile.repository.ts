import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma, User as PrismaUser } from '@/generated/prisma/client';
import {
  normalizeUsername,
  Profile,
  ProfileUpdate,
  UsernameTakenError,
} from '@/modules/profile/domain/profile';
import { Injectable } from '@nestjs/common';

const mapPrismaUserToProfile = (user: PrismaUser): Profile => ({
  id: user.id,
  name: user.name,
  username: user.displayUsername ?? user.username ?? '',
  bio: user.bio,
  defaultMood: user.defaultMood,
});

@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<Profile | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? mapPrismaUserToProfile(user) : null;
  }

  async updateProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: update.name,
          username: normalizeUsername(update.username),
          displayUsername: update.username,
          bio: update.bio,
          defaultMood: update.defaultMood,
        },
      });
      return mapPrismaUserToProfile(user);
    } catch (error) {
      // The unique index on the lowercased username is the source of truth, so
      // two people racing for the same name can't both get it.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new UsernameTakenError(update.username);
      }
      throw error;
    }
  }
}
