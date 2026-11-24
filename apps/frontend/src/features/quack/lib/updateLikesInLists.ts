import type { QueryClient } from "@tanstack/react-query"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { LikeState, Quack } from "@/features/quack/api/quackSchemas"

/** Rewrites one quack's likes in every cached feed list, search results included. */
export function updateLikesInLists(
  queryClient: QueryClient,
  quackId: string,
  update: (likes: LikeState) => LikeState,
): void {
  queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
    quacks?.map((quack) =>
      quack.id === quackId
        ? {
            ...quack,
            ...update({ likeCount: quack.likeCount ?? 0, likedByMe: quack.likedByMe ?? false }),
          }
        : quack,
    ),
  )
}

/** The likes as they will look once the like (or unlike) goes through. */
export function applyLike(likes: LikeState, isLiked: boolean): LikeState {
  if (likes.likedByMe === isLiked) return likes
  return { likeCount: Math.max(0, likes.likeCount + (isLiked ? 1 : -1)), likedByMe: isLiked }
}
