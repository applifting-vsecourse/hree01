import { z } from "zod"

import { quackTextSchema } from "@/features/quack/components/quackFormSchema"

// A reply's text follows the same rules, limits and messages as a quack's.
export const replyFormSchema = z.object({
  text: quackTextSchema,
})

export type ReplyFormValues = z.infer<typeof replyFormSchema>
