import { useMutation, useQueryClient } from "@tanstack/react-query"

import { closePoll } from "@/features/quack/api/closePoll"
import { quackKeys } from "@/features/quack/api/quackKeys"
import { updatePollInLists } from "@/features/quack/lib/updatePollInLists"

export function useClosePoll(quackId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => closePoll(quackId),
    onSuccess: async (poll) => {
      updatePollInLists(queryClient, quackId, () => poll)
      await queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
    },
  })
}
