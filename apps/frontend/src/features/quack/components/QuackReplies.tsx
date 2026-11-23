import { useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, MessageCircle, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import { repliesQueryOptions } from "@/features/quack/api/repliesQueryOptions"
import { ReplyForm } from "@/features/quack/components/ReplyForm"
import { ReplyItem } from "@/features/quack/components/ReplyItem"

type QuackRepliesProps = {
  quackId: string
  replyCount: number
  /** False under a placeholder: its replies stay readable, but no new ones. */
  canReply: boolean
  /** The signed-in user; their own replies get a delete action. */
  currentUserId?: string
  /** A moderator (admin) can also remove everyone else's replies. */
  isModerator?: boolean
}

const toggleLabel = (count: number): string =>
  count === 0 ? "Reply" : count === 1 ? "1 reply" : `${count} replies`

/** The "Reply" toggle under a quack, and its replies once expanded. */
export function QuackReplies({
  quackId,
  replyCount,
  canReply,
  currentUserId,
  isModerator = false,
}: QuackRepliesProps) {
  const [isOpen, setIsOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          onClick={() => setIsOpen((isOpenNow) => !isOpenNow)}
        >
          <MessageCircle />
          {toggleLabel(replyCount)}
        </Button>
      </div>

      {isOpen ? (
        <RepliesPanel
          id={panelId}
          quackId={quackId}
          canReply={canReply}
          currentUserId={currentUserId}
          isModerator={isModerator}
        />
      ) : null}
    </div>
  )
}

type RepliesPanelProps = Omit<QuackRepliesProps, "replyCount"> & { id: string }

// Mounted only while expanded, so replies load on demand.
function RepliesPanel({ id, quackId, canReply, currentUserId, isModerator }: RepliesPanelProps) {
  const repliesQuery = useQuery(repliesQueryOptions(quackId))
  const replies = repliesQuery.data ?? []

  return (
    <div
      id={id}
      className="flex flex-col gap-4 border-l border-border pl-4"
    >
      {repliesQuery.isLoading ? (
        <div className="flex items-center py-2 text-muted-foreground">
          <Loader2
            className="size-4 animate-spin"
            aria-label="Loading replies"
          />
        </div>
      ) : null}

      {repliesQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load replies</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{repliesQuery.error.message}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void repliesQuery.refetch()}
            >
              <RefreshCw className="size-4" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {repliesQuery.isSuccess && replies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replies yet. Be the first to reply.</p>
      ) : null}

      {replies.length > 0 ? (
        <ul
          aria-label="Replies"
          className="flex flex-col gap-3"
        >
          {replies.map((reply) => (
            <li key={reply.id}>
              <ReplyItem
                reply={reply}
                deleteAction={
                  currentUserId !== undefined && reply.userId === currentUserId
                    ? "own"
                    : isModerator
                      ? "moderate"
                      : null
                }
              />
            </li>
          ))}
        </ul>
      ) : null}

      {canReply ? <ReplyForm quackId={quackId} /> : null}
    </div>
  )
}
