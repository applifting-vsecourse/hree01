import { useState } from "react"
import { Heart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { LikeState } from "@/features/quack/api/quackSchemas"
import { useLike } from "@/features/quack/hooks/useLike"
import { applyLike } from "@/features/quack/lib/updateLikesInLists"

type LikeButtonProps = {
  quackId: string
  likeCount: number
  likedByMe: boolean
}

/** Likes to show instead of the props while the props are still `stale`. */
type Undo = { stale: LikeState; shown: LikeState }

const likesLabel = (count: number): string => `${count} ${count === 1 ? "like" : "likes"}`

/** A toggle: pressed means "I like this quack". Shows the count, even 0. */
export function LikeButton({ quackId, likeCount, likedByMe: isLikedByMe }: LikeButtonProps) {
  const like = useLike(quackId)
  // The feed cache is the source of truth (useLike updates it at once), but
  // TanStack hands cache changes to components on a later tick. Undoing a
  // failed click shouldn't wait for that, so the undo shows right away and
  // gives way as soon as the props move off the optimistic state.
  const [undo, setUndo] = useState<Undo | null>(null)
  const isStale =
    undo !== null && undo.stale.likeCount === likeCount && undo.stale.likedByMe === isLikedByMe
  const shown: LikeState = isStale ? undo.shown : { likeCount, likedByMe: isLikedByMe }

  const handleClick = () => {
    const isLiked = !shown.likedByMe
    setUndo(null)
    like.mutate(isLiked, {
      // Only the newest click gets this callback, so an older failure can't
      // undo a newer click.
      onError: () => setUndo({ stale: applyLike(shown, isLiked), shown }),
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className={cn(shown.likedByMe ? "text-foreground" : "text-muted-foreground")}
      aria-pressed={shown.likedByMe}
      aria-label={`Like, ${likesLabel(shown.likeCount)}`}
      onClick={handleClick}
    >
      <Heart className={cn(shown.likedByMe && "fill-current")} />
      {shown.likeCount}
    </Button>
  )
}

/** The count alone, where there is nobody signed in to like as. */
export function LikeCount({ likeCount }: { likeCount: number }) {
  return (
    <span
      role="img"
      aria-label={likesLabel(likeCount)}
      className="inline-flex h-6 items-center gap-1 px-1.5 text-xs text-muted-foreground"
    >
      <Heart className="size-3" />
      {likeCount}
    </span>
  )
}
