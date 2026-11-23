import { api } from "@/lib/api-client"

export async function deleteReply(input: { quackId: string; replyId: string }): Promise<void> {
  await api.delete(
    `quacks/${encodeURIComponent(input.quackId)}/replies/${encodeURIComponent(input.replyId)}`,
  )
}
