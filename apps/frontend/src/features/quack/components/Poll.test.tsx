import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { Poll as PollData } from "@/features/quack/api/quackSchemas"
import { percentOf, Poll } from "@/features/quack/components/Poll"

const aPoll = (overrides: Partial<PollData> = {}): PollData => ({
  resultsVisibility: "right_away",
  isClosed: false,
  isAuthor: false,
  myOptionId: null,
  resultsVisible: true,
  totalVotes: 3,
  options: [
    { id: "o1", text: "The café by the pond", votes: 1 },
    { id: "o2", text: "Bakery on the corner", votes: 2 },
    { id: "o3", text: "Leftover crusts", votes: 0 },
  ],
  ...overrides,
})

const option = (name: RegExp) => screen.getByRole("button", { name })

describe("Poll", () => {
  it("shows each option with its share and the total", () => {
    render(<Poll poll={aPoll()} />)

    expect(option(/café/i)).toHaveTextContent("33% · 1 vote")
    expect(option(/bakery/i)).toHaveTextContent("67% · 2 votes")
    expect(option(/crusts/i)).toHaveTextContent("0% · 0 votes")
    expect(screen.getByText("3 votes")).toBeInTheDocument()
  })

  it("marks the viewer's own vote in words, not only visually", () => {
    render(<Poll poll={aPoll({ myOptionId: "o2" })} />)

    expect(option(/bakery/i)).toHaveAttribute("aria-pressed", "true")
    expect(within(option(/bakery/i)).getByText("Your vote")).toBeInTheDocument()
    expect(option(/café/i)).toHaveAttribute("aria-pressed", "false")
  })

  it("hides counts until the viewer votes", () => {
    render(
      <Poll
        poll={aPoll({
          resultsVisibility: "after_voting",
          resultsVisible: false,
          totalVotes: null,
          options: aPoll().options.map((o) => ({ ...o, votes: null })),
        })}
      />,
    )

    expect(screen.getByText("Results appear after you vote")).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it("shows a closed poll's results and does not let anyone vote", async () => {
    const onVote = vi.fn()
    render(
      <Poll
        poll={aPoll({ isClosed: true })}
        onVote={onVote}
      />,
    )

    expect(screen.getByText("3 votes · Closed")).toBeInTheDocument()
    expect(option(/café/i)).toBeDisabled()
    await userEvent.click(option(/café/i))
    expect(onVote).not.toHaveBeenCalled()
  })

  it("votes for an option, and removes the vote when the same option is clicked again", async () => {
    const onVote = vi.fn()
    render(
      <Poll
        poll={aPoll({ myOptionId: "o2" })}
        onVote={onVote}
      />,
    )

    await userEvent.click(option(/café/i))
    expect(onVote).toHaveBeenLastCalledWith("o1")

    await userEvent.click(option(/bakery/i))
    expect(onVote).toHaveBeenLastCalledWith(null)
  })
})

describe("percentOf", () => {
  it("rounds each share on its own and handles no votes", () => {
    expect([1, 1, 1].map((votes) => percentOf(votes, 3))).toEqual([33, 33, 33])
    expect(percentOf(2, 3)).toBe(67)
    expect(percentOf(0, 0)).toBe(0)
  })
})
