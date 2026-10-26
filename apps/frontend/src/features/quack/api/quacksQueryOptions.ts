import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

// The server does the filtering, so every search is visible to it (that is how
// search usage gets measured). A blank search is the plain feed. `isMine` asks
// for the signed-in user's own quacks; the server knows who that is, so no user
// id is ever sent.
export const quacksQueryOptions = (search = "", isMine = false) =>
  queryOptions({
    queryKey: quackKeys.list(search, isMine),
    queryFn: async () =>
      quacksSchema.parse(
        await api
          .get("quacks", {
            searchParams: {
              ...(search ? { q: search } : {}),
              ...(isMine ? { mine: "true" } : {}),
            },
          })
          .json(),
      ),
    // Keep showing the previous results while the next search loads, so the
    // feed narrows smoothly instead of flashing a spinner on every keystroke.
    placeholderData: keepPreviousData,
  })
