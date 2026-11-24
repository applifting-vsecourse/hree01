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

export const quackDeletedBy = ["author", "moderator"] as const

// A quack is live, or a placeholder for a deleted quack that others replied to.
// A placeholder has `deletedBy` set and no text, mood, poll or author — the
// server sends none of them, so the UI can't show what was deleted.
export const quackSchema = z.object({
  id: z.string(),
  text: z.string().nullable(),
  mood: moodSchema.nullable(),
  userId: z.string().nullable(),
  createdAt: z.coerce.date(),
  user: quackUserSchema.nullable(),
  poll: pollSchema.nullable(),
  deletedBy: z.enum(quackDeletedBy).nullable(),
  replyCount: z.number().int(),
  // Likes (docs/adr/0002). Optional until the API sends them.
  likeCount: z.number().int().optional(),
  likedByMe: z.boolean().optional(),
})

export const quacksSchema = z.array(quackSchema)

// A quack's likes as the signed-in viewer sees them, after liking or unliking.
export const likeStateSchema = z.object({
  likeCount: z.number().int(),
  likedByMe: z.boolean(),
})

export const replySchema = z.object({
  id: z.string(),
  text: z.string(),
  quackId: z.string(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
})

export const repliesSchema = z.array(replySchema)

export type QuackMood = Mood
export type Poll = z.infer<typeof pollSchema>
export type Quack = z.infer<typeof quackSchema>
export type Reply = z.infer<typeof replySchema>
export type LikeState = z.infer<typeof likeStateSchema>
