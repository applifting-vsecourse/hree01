import { z } from "zod"

import { moodOptionSchema } from "@/lib/moods"

import {
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  pollMessages,
} from "@/features/quack/api/pollLimits"
import { pollResultsVisibilities } from "@/features/quack/api/quackSchemas"

// Mirrors the server-side DTO (MaxLength(280)) so the user is told before
// the request is made — the server still validates independently.
export const QUACK_MAX_LENGTH = 280

export const quackFormSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(QUACK_MAX_LENGTH, `Keep it under ${QUACK_MAX_LENGTH} characters`),
  mood: moodOptionSchema,
  // No options means no poll; "Add poll" starts it with two empty ones.
  pollOptions: z
    .array(
      z.object({
        text: z
          .string()
          .trim()
          .min(1, pollMessages.emptyOption)
          .max(POLL_OPTION_MAX_LENGTH, pollMessages.longOption),
      }),
    )
    .refine(
      (options) =>
        options.length === 0 ||
        (options.length >= POLL_MIN_OPTIONS && options.length <= POLL_MAX_OPTIONS),
      `A poll needs ${POLL_MIN_OPTIONS}–${POLL_MAX_OPTIONS} options`,
    )
    .superRefine((options, ctx) => {
      // The error goes on the repeated option, so the user sees which one.
      const seen = new Set<string>()
      options.forEach(({ text }, index) => {
        const key = text.trim().toLowerCase()
        if (key === "") return
        if (seen.has(key)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "text"],
            message: pollMessages.duplicateOption,
          })
        }
        seen.add(key)
      })
    }),
  resultsVisibility: z.enum(pollResultsVisibilities),
})

export type QuackFormValues = z.infer<typeof quackFormSchema>
