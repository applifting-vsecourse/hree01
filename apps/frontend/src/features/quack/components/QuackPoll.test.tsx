import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"
import { setVote } from "@/features/quack/api/setVote"
import { QuackPoll } from "@/features/quack/components/QuackPoll"

vi.mock("@/features/quack/api/setVote", () => ({ setVote: vi.fn() }))

const options = (cafe: number | null, bakery: number | null): Poll["options"] => [
  { id: "o1", text: "The café by the pond", votes: cafe },
  { id: "o2", text: "Bakery on the corner", votes: bakery },
]

const aPoll = (overrides: Partial<Poll> = {}): Poll => ({
  resultsVisibility: "right_away",
  isClosed: false,
  isAuthor: false,
  myOptionId: null,
  resultsVisible: true,
  totalVotes: 2,
  options: options(1, 1),
  ...overrides,
})

const aQuack = (poll: Poll): Quack => ({
  id: "q1",
  text: "Where do we go for lunch?",
  mood: null,
  userId: "u2",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u2", name: "The Bread Critic", username: "BreadCritic" },
  poll,
})

/** Stands in for the backend: what the feed returns when it is refetched. */
type Server = { poll: Poll }

/** A vote request the test answers when it chooses to. */
const pendingVote = () => {
  let resolve!: (poll: Poll) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Poll>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** The server records the vote and answers with it. */
const serverAccepts = async (
  server: Server,
  vote: ReturnType<typeof pendingVote>,
  poll: Poll,
): Promise<void> => {
  server.poll = poll
  vote.resolve(poll)
  await flush()
}

const serverFails = async (vote: ReturnType<typeof pendingVote>): Promise<void> => {
  vote.reject(new Error("Network down"))
  await flush()
}

/** Renders the poll from the cached feed, the way the real page does. */
const renderFromFeed = (initialPoll: Poll): Server => {
  const server: Server = { poll: initialPoll }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(quackKeys.list(""), [aQuack(initialPoll)])

  function Feed() {
    // The key must match the real feed so the hook updates this cache entry;
    // `server` is the fake backend, not an input of the query.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    const { data } = useQuery({
      queryKey: quackKeys.list(""),
      queryFn: () => Promise.resolve([aQuack(server.poll)]),
      staleTime: Infinity,
    })
    const quack = data?.[0]
    return quack?.poll ? (
      <QuackPoll
        quackId={quack.id}
        poll={quack.poll}
      />
    ) : null
  }

  render(
    <QueryClientProvider client={queryClient}>
      <Feed />
    </QueryClientProvider>,
  )
  return server
}

const option = (name: RegExp) => screen.getByRole("button", { name })
const failureMessage = "Your vote didn't go through."

describe("QuackPoll voting", () => {
  beforeEach(() => {
    vi.mocked(setVote).mockReset()
  })

  it("shows the vote immediately, before the server answers", async () => {
    const vote = pendingVote()
    vi.mocked(setVote).mockReturnValue(vote.promise)
    const server = renderFromFeed(aPoll())

    await userEvent.click(option(/café/i))

    expect(setVote).toHaveBeenCalledWith("q1", "o1")
    expect(option(/café/i)).toHaveAttribute("aria-pressed", "true")
    expect(option(/café/i)).toHaveTextContent("67% · 2 votes")

    await serverAccepts(
      server,
      vote,
      aPoll({ myOptionId: "o1", totalVotes: 3, options: options(2, 1) }),
    )
    expect(option(/café/i)).toHaveAttribute("aria-pressed", "true")
  })

  it("puts the server's state back and offers to try again when a vote fails", async () => {
    const failed = pendingVote()
    vi.mocked(setVote).mockReturnValueOnce(failed.promise)
    const server = renderFromFeed(aPoll())

    await userEvent.click(option(/café/i))
    await serverFails(failed)

    expect(await screen.findByText(failureMessage)).toBeInTheDocument()
    expect(option(/café/i)).toHaveAttribute("aria-pressed", "false")
    expect(option(/café/i)).toHaveTextContent("50% · 1 vote")

    const retry = pendingVote()
    vi.mocked(setVote).mockReturnValueOnce(retry.promise)
    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    await serverAccepts(
      server,
      retry,
      aPoll({ myOptionId: "o1", totalVotes: 3, options: options(2, 1) }),
    )

    expect(setVote).toHaveBeenLastCalledWith("q1", "o1")
    expect(option(/café/i)).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByText(failureMessage)).not.toBeInTheDocument()
  })

  it("keeps the later click when an earlier one fails", async () => {
    const first = pendingVote()
    const second = pendingVote()
    vi.mocked(setVote).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const server = renderFromFeed(aPoll())

    await userEvent.click(option(/café/i))
    await userEvent.click(option(/bakery/i))
    expect(option(/bakery/i)).toHaveAttribute("aria-pressed", "true")

    // The earlier click fails while the later one is still pending.
    await serverFails(first)
    expect(option(/bakery/i)).toHaveAttribute("aria-pressed", "true")

    await serverAccepts(
      server,
      second,
      aPoll({ myOptionId: "o2", totalVotes: 3, options: options(1, 2) }),
    )
    expect(option(/bakery/i)).toHaveAttribute("aria-pressed", "true")
    expect(option(/bakery/i)).toHaveTextContent("67% · 2 votes")
    expect(screen.queryByText(failureMessage)).not.toBeInTheDocument()
  })

  it("reveals an 'after voting' poll's results when the server answers", async () => {
    const hidden = aPoll({
      resultsVisibility: "after_voting",
      resultsVisible: false,
      totalVotes: null,
      options: options(null, null),
    })
    const vote = pendingVote()
    vi.mocked(setVote).mockReturnValue(vote.promise)
    const server = renderFromFeed(hidden)

    await userEvent.click(option(/bakery/i))

    expect(option(/bakery/i)).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("Results appear after you vote")).toBeInTheDocument()

    await serverAccepts(
      server,
      vote,
      aPoll({
        resultsVisibility: "after_voting",
        myOptionId: "o2",
        totalVotes: 3,
        options: options(1, 2),
      }),
    )
    expect(await screen.findByText("3 votes")).toBeInTheDocument()
  })
})
