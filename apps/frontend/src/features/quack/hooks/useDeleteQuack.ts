import { useMutation, useQueryClient } from "@tanstack/react-query"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"

export function useDeleteQuack() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteQuack,
    onSuccess: async (_, quackId) => {
      // Gone from every cached list (All, Mine, search results) right away,
      // then refetched to be sure.
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
        quacks?.filter((quack) => quack.id !== quackId),
      )
      await queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
    },
  })
}
