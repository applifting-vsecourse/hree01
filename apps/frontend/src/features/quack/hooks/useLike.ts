import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { setLike } from "@/features/quack/api/setLike"
import { applyLike, updateLikesInLists } from "@/features/quack/lib/updateLikesInLists"

/**
 * Liking that feels instant: every click shows at once and is sent at once.
 * Like and unlike are idempotent on the server, so overlapping requests can't
 * double count; once the last click has settled, the feed is refetched so it
 * shows the server's state.
 *
 * As with voting, there is no snapshot rollback: a snapshot taken before
 * click A would also wipe a still-pending click B. Only the newest click
 * applies or undoes anything.
 */
export function useLike(quackId: string) {
  const queryClient = useQueryClient()
  const mutationKey = quackKeys.like(quackId)
  // Includes the mutation whose callback is running — it is still pending then.
  const hasNewerClick = (): boolean => queryClient.isMutating({ mutationKey }) > 1

  return useMutation({
    mutationKey,
    mutationFn: (isLiked: boolean) => setLike(quackId, isLiked),
    onMutate: (isLiked) => {
      // A focus refetch landing now would overwrite the click with stale data.
      // Cancelling takes effect at once; not awaiting it keeps the click (and
      // its undo on failure) from waiting on anything.
      void queryClient.cancelQueries({ queryKey: quackKeys.lists() })
      updateLikesInLists(queryClient, quackId, (likes) => applyLike(likes, isLiked))
    },
    onSuccess: (likes) => {
      // An older response would flash the previous state over the newer one.
      if (!hasNewerClick()) updateLikesInLists(queryClient, quackId, () => likes)
    },
    onError: (_error, isLiked) => {
      toast.error("Couldn't save your like. Try again.")
      // Undo this click, unless a newer one has already replaced it.
      if (!hasNewerClick()) {
        updateLikesInLists(queryClient, quackId, (likes) => applyLike(likes, !isLiked))
      }
    },
    onSettled: async () => {
      // Once the last click has settled, pick up the server's state and
      // everyone else's likes too.
      if (!hasNewerClick()) {
        await queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
      }
    },
  })
}
