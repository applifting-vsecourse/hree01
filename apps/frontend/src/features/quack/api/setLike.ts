import { api } from "@/lib/api-client"

import { likeStateSchema, type LikeState } from "@/features/quack/api/quackSchemas"

/** Likes the quack, or with `isLiked: false` takes the like back. */
export async function setLike(quackId: string, isLiked: boolean): Promise<LikeState> {
  const url = `quacks/${encodeURIComponent(quackId)}/like`
  const json = isLiked ? await api.put(url).json() : await api.delete(url).json()
  return likeStateSchema.parse(json)
}
