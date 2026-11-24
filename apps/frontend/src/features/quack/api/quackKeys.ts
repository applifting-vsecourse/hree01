export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  list: (search: string, isMine = false) => [...quackKeys.lists(), { search, isMine }] as const,
  replies: (quackId: string) => [...quackKeys.all(), "replies", quackId] as const,
  // mutation key for voting in one poll
  vote: (quackId: string) => [...quackKeys.all(), "vote", quackId] as const,
  // mutation key for liking one quack
  like: (quackId: string) => [...quackKeys.all(), "like", quackId] as const,
}
