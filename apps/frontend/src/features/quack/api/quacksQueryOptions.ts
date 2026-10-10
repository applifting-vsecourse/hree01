import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

// The server does the filtering, so every search is visible to it (that is how
// search usage gets measured). A blank search is the plain feed.
export const quacksQueryOptions = (search = "") =>
  queryOptions({
    queryKey: quackKeys.list(search),
    queryFn: async () =>
      quacksSchema.parse(
        await api.get("quacks", { searchParams: search ? { q: search } : {} }).json(),
      ),
    // Keep showing the previous results while the next search loads, so the
    // feed narrows smoothly instead of flashing a spinner on every keystroke.
    placeholderData: keepPreviousData,
  })
