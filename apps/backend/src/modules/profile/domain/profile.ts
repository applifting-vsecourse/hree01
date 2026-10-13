import { QuackMood } from '@/modules/quack/domain/quack';

// Same rule as BetterAuth's username plugin, so a name that passes here would
// also pass at sign-up.
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
export const NAME_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 160;

export type Profile = {
  id: string;
  name: string;
  /** As the user typed it, e.g. "CaffeinatedDuck". */
  username: string;
  bio: string | null;
  defaultMood: QuackMood | null;
};

export type ProfileUpdate = Omit<Profile, 'id'>;

/** Usernames are unique regardless of case, so they are stored lowercased. */
export const normalizeUsername = (username: string): string =>
  username.toLowerCase();

export class UsernameTakenError extends Error {
  constructor(username: string) {
    super(`Username "${username}" is already taken`);
  }
}
