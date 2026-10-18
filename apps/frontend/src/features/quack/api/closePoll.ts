import { api } from "@/lib/api-client"

import { pollSchema, type Poll } from "@/features/quack/api/quackSchemas"

/** Closes a poll for good. Only its author may. */
export async function closePoll(quackId: string): Promise<Poll> {
  const json = await api.post(`quacks/${quackId}/poll/close`).json()
  return pollSchema.parse(json)
}
