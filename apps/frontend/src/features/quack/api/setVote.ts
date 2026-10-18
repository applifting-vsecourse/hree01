import { api } from "@/lib/api-client"

import { pollSchema, type Poll } from "@/features/quack/api/quackSchemas"

/** Votes for an option, or with `optionId: null` removes the vote. */
export async function setVote(quackId: string, optionId: string | null): Promise<Poll> {
  const json =
    optionId === null
      ? await api.delete(`quacks/${quackId}/vote`).json()
      : await api.put(`quacks/${quackId}/vote`, { json: { optionId } }).json()
  return pollSchema.parse(json)
}
