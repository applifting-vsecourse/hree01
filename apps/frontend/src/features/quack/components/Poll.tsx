import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { Poll as PollData } from "@/features/quack/api/quackSchemas"

/** Whole percent, each option rounded on its own — totals may be 99 or 101. */
export const percentOf = (votes: number, total: number): number =>
  total === 0 ? 0 : Math.round((votes / total) * 100)

const votesLabel = (count: number): string => (count === 1 ? "1 vote" : `${count} votes`)

type PollProps = {
  poll: PollData
  /** Vote for an option, or pass null to remove the vote. Omit to show the poll read-only. */
  onVote?: (optionId: string | null) => void
}

export function Poll({ poll, onVote }: PollProps) {
  const canVote = Boolean(onVote) && !poll.isClosed

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label="Poll options"
        className="flex flex-col gap-2"
      >
        {poll.options.map((option) => {
          const isMine = poll.myOptionId === option.id
          const percent =
            poll.resultsVisible && option.votes !== null && poll.totalVotes !== null
              ? percentOf(option.votes, poll.totalVotes)
              : null

          return (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              aria-pressed={isMine}
              disabled={!canVote}
              // clicking your own choice again removes the vote
              onClick={() => onVote?.(isMine ? null : option.id)}
              className={cn(
                "relative h-auto w-full justify-between gap-3 overflow-hidden py-2 text-left whitespace-normal",
                isMine && "border-foreground",
                // a closed or read-only poll stays readable, not greyed out
                "disabled:opacity-100",
              )}
            >
              {percent !== null ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-secondary"
                  style={{ width: `${percent}%` }}
                />
              ) : null}
              <span className="relative flex items-center gap-2">
                {isMine ? <Check className="size-4" /> : null}
                <span>{option.text}</span>
                {isMine ? <span className="text-xs text-muted-foreground">Your vote</span> : null}
              </span>
              {percent !== null && option.votes !== null ? (
                <span className="relative shrink-0 text-sm text-muted-foreground">
                  {percent}% · {votesLabel(option.votes)}
                </span>
              ) : null}
            </Button>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {poll.resultsVisible && poll.totalVotes !== null
          ? votesLabel(poll.totalVotes)
          : "Results appear after you vote"}
        {poll.isClosed ? " · Closed" : null}
      </p>
    </div>
  )
}
