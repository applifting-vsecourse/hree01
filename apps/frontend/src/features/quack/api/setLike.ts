import type { LikeState } from "@/features/quack/api/quackSchemas"

/** Likes the quack, or with `isLiked: false` takes the like back. */
export function setLike(quackId: string, isLiked: boolean): Promise<LikeState> {
  return Promise.reject(new Error(`Not implemented: set like on quack ${quackId} to ${isLiked}`))
}
