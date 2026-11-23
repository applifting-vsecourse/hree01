import { useMutation, useQueryClient } from "@tanstack/react-query"

import { addReply } from "@/features/quack/api/addReply"
import { quackKeys } from "@/features/quack/api/quackKeys"

export function useAddReply(quackId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (text: string) => addReply({ quackId, text }),
    onSuccess: async () => {
      // the new reply, and the count on the quack in every feed list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: quackKeys.replies(quackId) }),
        queryClient.invalidateQueries({ queryKey: quackKeys.lists() }),
      ])
    },
  })
}
