import type { Poll } from "@/features/quack/api/quackSchemas"

/**
 * The poll as it will look once the vote goes through, for showing a click
 * immediately. The selection always changes. Counts change only if they are
 * already visible: for a hidden "after voting" poll the client doesn't know
 * them, so they arrive with the server's response.
 */
export function applyVote(poll: Poll, optionId: string | null): Poll {
  const previous = poll.myOptionId
  if (previous === optionId) return poll

  // Removing a vote from an open "after voting" poll hides its results again.
  if (optionId === null && poll.resultsVisibility === "after_voting" && !poll.isClosed) {
    return {
      ...poll,
      myOptionId: null,
      resultsVisible: false,
      totalVotes: null,
      options: poll.options.map((option) => ({ ...option, votes: null })),
    }
  }

  if (!poll.resultsVisible || poll.totalVotes === null) {
    return { ...poll, myOptionId: optionId }
  }

  const delta = (id: string): number => (id === optionId ? 1 : 0) - (id === previous ? 1 : 0)
  return {
    ...poll,
    myOptionId: optionId,
    totalVotes: poll.totalVotes + (optionId === null ? -1 : previous === null ? 1 : 0),
    options: poll.options.map((option) => ({
      ...option,
      votes: option.votes === null ? null : option.votes + delta(option.id),
    })),
  }
}
