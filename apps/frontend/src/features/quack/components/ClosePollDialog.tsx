import { useState } from "react"
import { Loader2 } from "lucide-react"

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

import { useClosePoll } from "@/features/quack/hooks/useClosePoll"

type ClosePollDialogProps = { quackId: string }

/** Closing is permanent, so it is confirmed first. */
export function ClosePollDialog({ quackId }: ClosePollDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const closePoll = useClosePoll(quackId)

  const handleOpenChange = (isNowOpen: boolean) => {
    // a failed attempt shouldn't greet the user the next time they open it
    if (isNowOpen) closePoll.reset()
    setIsOpen(isNowOpen)
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
          size="xs"
        >
          Close poll
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close this poll?</DialogTitle>
          <DialogDescription>
            No one will be able to vote or change their vote, and everyone will see the results.
            This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        {closePoll.error ? (
          <Alert variant="destructive">
            <AlertDescription>{closePoll.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={closePoll.isPending}
            >
              Keep it open
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={closePoll.isPending}
            onClick={() => closePoll.mutate(undefined, { onSuccess: () => setIsOpen(false) })}
          >
            {closePoll.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Close poll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
