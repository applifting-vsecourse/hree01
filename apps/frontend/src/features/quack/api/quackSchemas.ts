import { z } from "zod"

import { moodSchema, type Mood } from "@/lib/moods"

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

export const pollResultsVisibilities = ["right_away", "after_voting"] as const

// A poll as the signed-in viewer sees it. The server sends null counts while
// results are hidden from them, so hidden results can't leak to the client.
export const pollSchema = z.object({
  resultsVisibility: z.enum(pollResultsVisibilities),
  isClosed: z.boolean(),
  isAuthor: z.boolean(),
  myOptionId: z.string().nullable(),
  resultsVisible: z.boolean(),
  totalVotes: z.number().int().nullable(),
  options: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      votes: z.number().int().nullable(),
    }),
  ),
})

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  mood: moodSchema.nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
  poll: pollSchema.nullable(),
})

export const quacksSchema = z.array(quackSchema)

export type QuackMood = Mood
export type Poll = z.infer<typeof pollSchema>
export type Quack = z.infer<typeof quackSchema>
