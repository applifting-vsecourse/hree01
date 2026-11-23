import { useMutation, useQueryClient } from "@tanstack/react-query"

import { deleteReply } from "@/features/quack/api/deleteReply"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Reply } from "@/features/quack/api/quackSchemas"

export function useDeleteReply(quackId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (replyId: string) => deleteReply({ quackId, replyId }),
    onSuccess: async (_, replyId) => {
      queryClient.setQueryData<Reply[]>(quackKeys.replies(quackId), (replies) =>
        replies?.filter((reply) => reply.id !== replyId),
      )
      // The count changes, and the last reply under a placeholder takes the
      // placeholder with it — the feed lists show both after the refetch.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: quackKeys.replies(quackId) }),
        queryClient.invalidateQueries({ queryKey: quackKeys.lists() }),
      ])
    },
  })
}
