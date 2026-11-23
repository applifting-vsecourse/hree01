import { useState } from "react"
import { Loader2, ShieldX, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { useDeleteReply } from "@/features/quack/hooks/useDeleteReply"

type DeleteReplyButtonProps = {
  quackId: string
  replyId: string
  /** Set when a moderator removes someone else's reply: the author's username. */
  moderatedUsername?: string
}

/** Deleting a reply is permanent, so it is confirmed first, like a quack. */
export function DeleteReplyButton({ quackId, replyId, moderatedUsername }: DeleteReplyButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const deleteReply = useDeleteReply(quackId)
  const isModerating = moderatedUsername !== undefined
  const verb = isModerating ? "Remove" : "Delete"

  const handleOpenChange = (isNowOpen: boolean) => {
    // a failed attempt shouldn't greet the user the next time they open it
    if (isNowOpen) deleteReply.reset()
    setIsOpen(isNowOpen)
  }

  const handleDelete = async () => {
    try {
      // mutateAsync: removing the reply unmounts this component
      await deleteReply.mutateAsync(replyId)
      toast.success(isModerating ? "Reply removed" : "Reply deleted")
      setIsOpen(false)
    } catch {
      // the error is shown in the dialog
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        {isModerating ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-label="Remove reply"
            className="text-muted-foreground"
          >
            <ShieldX />
            Remove
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Delete reply"
            className="text-muted-foreground"
          >
            <Trash2 />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isModerating ? `Remove @${moderatedUsername}'s reply?` : "Delete this reply?"}
          </DialogTitle>
          <DialogDescription>
            {isModerating ? "You're removing it as a moderator. " : null}
            It disappears for everyone. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        {deleteReply.error ? (
          <Alert variant="destructive">
            <AlertDescription>{deleteReply.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={deleteReply.isPending}
            >
              Keep it
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteReply.isPending}
            onClick={() => void handleDelete()}
          >
            {deleteReply.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
