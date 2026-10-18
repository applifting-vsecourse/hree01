export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  list: (search: string) => [...quackKeys.lists(), { search }] as const,
  // mutation key for voting in one poll
  vote: (quackId: string) => [...quackKeys.all(), "vote", quackId] as const,
}
