import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDate } from "@/lib/date"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { DeleteQuackButton } from "@/features/quack/components/DeleteQuackButton"
import { LikeButton, LikeCount } from "@/features/quack/components/LikeButton"
import { QuackMood } from "@/features/quack/components/QuackMood"
import { QuackPoll } from "@/features/quack/components/QuackPoll"
import { QuackReplies } from "@/features/quack/components/QuackReplies"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

type QuackItemProps = {
  quack: Quack
  /**
   * Which delete action to offer: the author's own, a moderator's "Remove" on
   * someone else's quack, or none. Only convenience: the API enforces the rule.
   */
  deleteAction?: "own" | "moderate" | null
  /** The signed-in user and whether they moderate, for the replies' actions. */
  currentUserId?: string
  isModerator?: boolean
  /** Off for static previews, which have no replies to load. */
  shouldShowReplies?: boolean
  /** Off where nobody is signed in to like as: the count shows, no button. */
  canLike?: boolean
}

const articleClassName = "flex w-full gap-4 border-b border-border pt-2 pb-4 last:border-b-0"

export function QuackItem({
  quack,
  deleteAction = null,
  currentUserId,
  isModerator = false,
  shouldShowReplies = true,
  canLike = true,
}: QuackItemProps) {
  // A deleted quack that others replied to: no author, text, mood, poll or
  // likes, only what happened to it and the replies, which can't be added to.
  if (quack.deletedBy !== null || quack.user === null) {
    return (
      <article className={articleClassName}>
        <div
          className="size-12 shrink-0"
          aria-hidden
        />
        <div className="flex flex-1 flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {quack.deletedBy === "moderator"
              ? "This quack was removed by a moderator"
              : "This quack was deleted"}
          </p>
          {shouldShowReplies ? (
            <QuackReplies
              quackId={quack.id}
              replyCount={quack.replyCount}
              canReply={false}
              currentUserId={currentUserId}
              isModerator={isModerator}
            />
          ) : null}
        </div>
      </article>
    )
  }

  const { name, username } = quack.user

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const likeButton = canLike ? (
    <LikeButton
      quackId={quack.id}
      likeCount={quack.likeCount ?? 0}
      likedByMe={quack.likedByMe ?? false}
    />
  ) : (
    <LikeCount likeCount={quack.likeCount ?? 0} />
  )

  return (
    <article className={articleClassName}>
      <Avatar className="size-12">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span>
            <UsersName name={name} /> <UsersUserName username={username} />
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <time className="text-xs text-muted-foreground">{formatDate(quack.createdAt)}</time>
          {quack.mood ? (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <QuackMood mood={quack.mood} />
            </>
          ) : null}
        </div>
        <p className="text-sm break-words whitespace-pre-line">{quack.text}</p>
        {quack.poll ? (
          <div className="mt-2">
            <QuackPoll
              quackId={quack.id}
              poll={quack.poll}
            />
          </div>
        ) : null}
        <div className="mt-2">
          {shouldShowReplies ? (
            <QuackReplies
              quackId={quack.id}
              replyCount={quack.replyCount}
              canReply
              currentUserId={currentUserId}
              isModerator={isModerator}
              actions={likeButton}
            />
          ) : (
            likeButton
          )}
        </div>
      </div>

      {deleteAction ? (
        <DeleteQuackButton
          quackId={quack.id}
          moderatedUsername={deleteAction === "moderate" ? username : undefined}
          hasReplies={quack.replyCount > 0}
        />
      ) : null}
    </article>
  )
}
