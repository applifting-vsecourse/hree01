import { useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
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

import { useDeleteQuack } from "@/features/quack/hooks/useDeleteQuack"

type DeleteQuackButtonProps = { quackId: string }

/** Deleting is permanent, so it is confirmed first. */
export function DeleteQuackButton({ quackId }: DeleteQuackButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const deleteQuack = useDeleteQuack()

  const handleOpenChange = (isNowOpen: boolean) => {
    // a failed attempt shouldn't greet the user the next time they open it
    if (isNowOpen) deleteQuack.reset()
    setIsOpen(isNowOpen)
  }

  const handleDelete = async () => {
    try {
      // mutateAsync, not mutate's callbacks: removing the quack from the feed
      // unmounts this component before per-call callbacks would run.
      await deleteQuack.mutateAsync(quackId)
      toast.success("Quack deleted")
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
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete quack"
          className="text-muted-foreground"
        >
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this quack?</DialogTitle>
          <DialogDescription>
            It disappears from the feed for everyone, together with its poll and votes. This
            can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        {deleteQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{deleteQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={deleteQuack.isPending}
            >
              Keep it
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteQuack.isPending}
            onClick={() => void handleDelete()}
          >
            {deleteQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
