import type { QueryClient } from "@tanstack/react-query"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"

/** Rewrites one quack's poll in every cached feed list, search results included. */
export function updatePollInLists(
  queryClient: QueryClient,
  quackId: string,
  update: (poll: Poll) => Poll,
): void {
  queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
    quacks?.map((quack) =>
      quack.id === quackId && quack.poll ? { ...quack, poll: update(quack.poll) } : quack,
    ),
  )
}
