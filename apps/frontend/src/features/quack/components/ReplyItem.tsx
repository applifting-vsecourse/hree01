import { formatDate } from "@/lib/date"

import type { Reply } from "@/features/quack/api/quackSchemas"
import { DeleteReplyButton } from "@/features/quack/components/DeleteReplyButton"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

type ReplyItemProps = {
  reply: Reply
  /** Same choice as on a quack. Only convenience: the API enforces the rule. */
  deleteAction?: "own" | "moderate" | null
}

export function ReplyItem({ reply, deleteAction = null }: ReplyItemProps) {
  const { name, username } = reply.user

  return (
    <div className="flex gap-3">
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span>
            <UsersName name={name} /> <UsersUserName username={username} />
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <time className="text-xs text-muted-foreground">{formatDate(reply.createdAt)}</time>
        </div>
        <p className="text-sm break-words whitespace-pre-line">{reply.text}</p>
      </div>

      {deleteAction ? (
        <DeleteReplyButton
          quackId={reply.quackId}
          replyId={reply.id}
          moderatedUsername={deleteAction === "moderate" ? username : undefined}
        />
      ) : null}
    </div>
  )
}
