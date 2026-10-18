import { describe, expect, it } from "vitest"

import type { Poll } from "@/features/quack/api/quackSchemas"
import { applyVote } from "@/features/quack/lib/applyVote"

const aPoll = (overrides: Partial<Poll> = {}): Poll => ({
  resultsVisibility: "right_away",
  isClosed: false,
  isAuthor: false,
  myOptionId: null,
  resultsVisible: true,
  totalVotes: 3,
  options: [
    { id: "o1", text: "Café", votes: 1 },
    { id: "o2", text: "Bakery", votes: 2 },
  ],
  ...overrides,
})

const votes = (poll: Poll) => poll.options.map((option) => option.votes)

describe("applyVote", () => {
  it("adds a first vote to the option and the total", () => {
    const poll = applyVote(aPoll(), "o1")

    expect(poll.myOptionId).toBe("o1")
    expect(votes(poll)).toEqual([2, 2])
    expect(poll.totalVotes).toBe(4)
  })

  it("moves a vote without changing the total", () => {
    const poll = applyVote(aPoll({ myOptionId: "o2" }), "o1")

    expect(votes(poll)).toEqual([2, 1])
    expect(poll.totalVotes).toBe(3)
  })

  it("removes a vote", () => {
    const poll = applyVote(aPoll({ myOptionId: "o2" }), null)

    expect(poll.myOptionId).toBeNull()
    expect(votes(poll)).toEqual([1, 1])
    expect(poll.totalVotes).toBe(2)
  })

  it("only changes the selection while results are hidden", () => {
    const hidden = aPoll({
      resultsVisibility: "after_voting",
      resultsVisible: false,
      totalVotes: null,
      options: aPoll().options.map((option) => ({ ...option, votes: null })),
    })

    const poll = applyVote(hidden, "o1")

    expect(poll.myOptionId).toBe("o1")
    expect(poll.resultsVisible).toBe(false)
    expect(votes(poll)).toEqual([null, null])
  })

  it("hides an open 'after voting' poll's results again when the vote is removed", () => {
    const poll = applyVote(aPoll({ resultsVisibility: "after_voting", myOptionId: "o1" }), null)

    expect(poll.resultsVisible).toBe(false)
    expect(poll.totalVotes).toBeNull()
  })

  it("returns the same poll when nothing changes", () => {
    const poll = aPoll({ myOptionId: "o1" })

    expect(applyVote(poll, "o1")).toBe(poll)
  })
})
