import { Button } from "@/components/ui/button"

import type { Poll as PollData } from "@/features/quack/api/quackSchemas"
import { ClosePollDialog } from "@/features/quack/components/ClosePollDialog"
import { Poll } from "@/features/quack/components/Poll"
import { useVote } from "@/features/quack/hooks/useVote"

type QuackPollProps = { quackId: string; poll: PollData }

/** A poll the viewer can vote in, with the failure shown right where they clicked. */
export function QuackPoll({ quackId, poll }: QuackPollProps) {
  const vote = useVote(quackId)

  return (
    <div className="flex flex-col gap-2">
      <Poll
        poll={poll}
        onVote={(optionId) => vote.mutate(optionId)}
      />
      {/* Tracks the latest click: an earlier failure followed by a success is not an error. */}
      {vote.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3"
        >
          <p className="text-sm text-destructive">Your vote didn&apos;t go through.</p>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => vote.mutate(vote.variables ?? null)}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {poll.isAuthor && !poll.isClosed ? (
        <div>
          <ClosePollDialog quackId={quackId} />
        </div>
      ) : null}
    </div>
  )
}
