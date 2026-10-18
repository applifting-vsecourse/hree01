import { useMutation, useQueryClient } from "@tanstack/react-query"

import { profileKeys } from "@/features/profile/api/profileKeys"
import { updateProfile } from "@/features/profile/api/updateProfile"

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: async (profile) => {
      queryClient.setQueryData(profileKeys.mine(), profile)
      // The name and @username show up everywhere — the header menu (session),
      // the feed, search results — so refresh every query rather than
      // reaching into other features' keys.
      await queryClient.invalidateQueries()
    },
  })
}
