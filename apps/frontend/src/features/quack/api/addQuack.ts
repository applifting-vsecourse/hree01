import { api } from "@/lib/api-client"

import {
  quackSchema,
  type Poll,
  type Quack,
  type QuackMood,
} from "@/features/quack/api/quackSchemas"

export type NewPoll = {
  options: string[]
  resultsVisibility: Poll["resultsVisibility"]
}

export async function addQuack(input: {
  text: string
  mood: QuackMood | null
  poll: NewPoll | null
}): Promise<Quack> {
  const json = await api.post("quacks", { json: input }).json()
  return quackSchema.parse(json)
}
