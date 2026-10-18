import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"
import { setVote } from "@/features/quack/api/setVote"
import { applyVote } from "@/features/quack/lib/applyVote"

/** Rewrites one quack's poll in every cached feed list, search results included. */
const updatePollInLists = (
  queryClient: QueryClient,
  quackId: string,
  update: (poll: Poll) => Poll,
): void => {
  queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
    quacks?.map((quack) =>
      quack.id === quackId && quack.poll ? { ...quack, poll: update(quack.poll) } : quack,
    ),
  )
}

/**
 * Voting that feels instant. Clicks on one poll are sent in order (`scope`),
 * so the last click wins on the server too.
 *
 * TanStack runs `onMutate` on click even while an earlier click on the same
 * poll is still in flight, so there is no snapshot rollback: a snapshot taken
 * before click A would also wipe a still-pending click B. Instead the server's
 * state is applied, and only once no newer click on this poll is pending.
 */
export function useVote(quackId: string) {
  const queryClient = useQueryClient()
  const mutationKey = quackKeys.vote(quackId)
  // Includes the mutation whose callback is running — it is still pending then.
  const hasNewerClick = (): boolean => queryClient.isMutating({ mutationKey }) > 1

  return useMutation({
    mutationKey,
    scope: { id: mutationKey.join("/") },
    mutationFn: (optionId: string | null) => setVote(quackId, optionId),
    onMutate: async (optionId) => {
      // A focus refetch landing now would overwrite the click with stale data.
      await queryClient.cancelQueries({ queryKey: quackKeys.lists() })
      updatePollInLists(queryClient, quackId, (poll) => applyVote(poll, optionId))
    },
    onSuccess: (poll) => {
      // An older response would flash the previous choice over the newer one.
      if (!hasNewerClick()) updatePollInLists(queryClient, quackId, () => poll)
    },
    onError: async () => {
      // The vote didn't happen: show what the server has. A newer click will
      // bring its own server state, so leave that one alone.
      if (!hasNewerClick()) {
        await queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
      }
    },
    onSettled: async (_poll, error) => {
      // Once the last click has settled, pick up everyone else's votes too.
      if (!error && !hasNewerClick()) {
        await queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
      }
    },
  })
}
