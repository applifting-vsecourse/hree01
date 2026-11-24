// The like button on a quack: rules R13–R18 in cases.md.
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { LikeState, Quack } from "@/features/quack/api/quackSchemas"
import { setLike } from "@/features/quack/api/setLike"
import { QuackItem } from "@/features/quack/components/QuackItem"

vi.mock("@/features/quack/api/setLike", () => ({ setLike: vi.fn() }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const aQuack = (likes: LikeState): Quack => ({
  id: "q1",
  text: "Bread is the best part of the pond",
  mood: null,
  userId: "u2",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  deletedBy: null,
  replyCount: 0,
  user: { id: "u2", name: "The Bread Critic", username: "BreadCritic" },
  poll: null,
  ...likes,
})

const aPlaceholder = (): Quack => ({
  id: "q2",
  text: null,
  mood: null,
  userId: null,
  createdAt: new Date("2026-01-01T12:00:00Z"),
  deletedBy: "author",
  replyCount: 1,
  user: null,
  poll: null,
  likeCount: 0,
  likedByMe: false,
})

/** A like request the test answers when it chooses to. */
const pendingLike = () => {
  let resolve!: (likes: LikeState) => void
  let reject!: (error: Error) => void
  const promise = new Promise<LikeState>((res, rej) => {
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

/** Stands in for the backend: what the feed returns when it is refetched. */
type Server = { quack: Quack }

/** Renders the quack from the cached feed, the way the real page does. */
const renderFromFeed = (quack: Quack): Server => {
  const server: Server = { quack }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(quackKeys.list(""), [quack])

  function Feed() {
    // The key must match the real feed so a like updates this cache entry;
    // `server` is the fake backend, not an input of the query.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    const { data } = useQuery({
      queryKey: quackKeys.list(""),
      queryFn: () => Promise.resolve([server.quack]),
      staleTime: Infinity,
    })
    const shown = data?.[0]
    return shown ? (
      <QuackItem
        quack={shown}
        shouldShowReplies={false}
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

// The button is named "Like" and shows the count; pressed means "I like it".
const likeButton = () => screen.getByRole("button", { name: /^Like\b/ })
/** The only number on the button is `count`. */
const showsCount = (count: number) => new RegExp(`^\\D*${count}\\D*$`)
const failureMessage = "Couldn't save your like. Try again."

describe("Liking a quack", () => {
  beforeEach(() => {
    vi.mocked(setLike).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  // R13
  it("shows a like button with the count on every live quack, even 0", () => {
    renderFromFeed(aQuack({ likeCount: 0, likedByMe: false }))

    expect(likeButton()).toHaveAttribute("aria-pressed", "false")
    expect(likeButton()).toHaveTextContent(showsCount(0))
  })

  // R14
  it("shows a quack I like as liked", () => {
    renderFromFeed(aQuack({ likeCount: 4, likedByMe: true }))

    expect(likeButton()).toHaveAttribute("aria-pressed", "true")
    expect(likeButton()).toHaveTextContent(showsCount(4))
  })

  // R15
  it("changes the button right away, before the server answers", async () => {
    const like = pendingLike()
    vi.mocked(setLike).mockReturnValue(like.promise)
    const server = renderFromFeed(aQuack({ likeCount: 1, likedByMe: false }))

    await userEvent.click(likeButton())

    expect(setLike).toHaveBeenCalledWith("q1", true)
    expect(likeButton()).toHaveAttribute("aria-pressed", "true")
    expect(likeButton()).toHaveTextContent(showsCount(2))

    server.quack = aQuack({ likeCount: 2, likedByMe: true })
    like.resolve({ likeCount: 2, likedByMe: true })
    await flush()
    expect(likeButton()).toHaveAttribute("aria-pressed", "true")
    expect(likeButton()).toHaveTextContent(showsCount(2))
  })

  // R16
  it("undoes a failed like and says so in a toast", async () => {
    const like = pendingLike()
    vi.mocked(setLike).mockReturnValue(like.promise)
    renderFromFeed(aQuack({ likeCount: 1, likedByMe: false }))

    await userEvent.click(likeButton())
    like.reject(new Error("Network down"))
    await flush()

    expect(likeButton()).toHaveAttribute("aria-pressed", "false")
    expect(likeButton()).toHaveTextContent(showsCount(1))
    expect(toast.error).toHaveBeenCalledWith(failureMessage)
  })

  // R17
  it("ends where the last of several fast clicks left it", async () => {
    const first = pendingLike()
    const second = pendingLike()
    const third = pendingLike()
    vi.mocked(setLike)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise)
    const server = renderFromFeed(aQuack({ likeCount: 0, likedByMe: false }))

    await userEvent.click(likeButton())
    await userEvent.click(likeButton())
    await userEvent.click(likeButton())

    expect(likeButton()).toHaveAttribute("aria-pressed", "true")
    expect(likeButton()).toHaveTextContent(showsCount(1))
    expect(vi.mocked(setLike).mock.calls).toEqual([
      ["q1", true],
      ["q1", false],
      ["q1", true],
    ])

    // The server answers in order; the earlier answers must not flash back.
    first.resolve({ likeCount: 1, likedByMe: true })
    second.resolve({ likeCount: 0, likedByMe: false })
    server.quack = aQuack({ likeCount: 1, likedByMe: true })
    third.resolve({ likeCount: 1, likedByMe: true })
    await flush()

    expect(likeButton()).toHaveAttribute("aria-pressed", "true")
    expect(likeButton()).toHaveTextContent(showsCount(1))
  })

  // R18
  it("shows no like button and no count on a placeholder", () => {
    renderFromFeed(aPlaceholder())

    expect(screen.getByText("This quack was deleted")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /like/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/like/i)).not.toBeInTheDocument()
  })
})
