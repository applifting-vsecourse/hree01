import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider, queryOptions } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteReply } from "@/features/quack/api/deleteReply"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack, Reply } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

const fetchReplies = vi.hoisted(() => vi.fn<(quackId: string) => Promise<Reply[]>>())

vi.mock("@/features/quack/api/repliesQueryOptions", () => ({
  repliesQueryOptions: (quackId: string) =>
    queryOptions({
      queryKey: quackKeys.replies(quackId),
      queryFn: () => fetchReplies(quackId),
    }),
}))
vi.mock("@/features/quack/api/deleteReply", () => ({ deleteReply: vi.fn() }))

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: "q1",
  text: "Lunch at the café?",
  mood: null,
  poll: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  deletedBy: null,
  replyCount: 0,
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  ...overrides,
})

const placeholder = (deletedBy: "author" | "moderator"): Quack =>
  aQuack({ text: null, userId: null, user: null, deletedBy, replyCount: 2 })

const aReply = (overrides: Partial<Reply> = {}): Reply => ({
  id: "r1",
  text: "The café, obviously.",
  quackId: "q1",
  userId: "u2",
  createdAt: new Date("2026-01-01T12:05:00Z"),
  user: { id: "u2", name: "Naïve Goose", username: "NaiveGoose" },
  ...overrides,
})

const renderWithClient = (ui: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  return queryClient
}

describe("replies under a quack", () => {
  beforeEach(() => {
    fetchReplies.mockReset()
    vi.mocked(deleteReply).mockReset()
  })

  it("counts the replies and loads them only when expanded", async () => {
    fetchReplies.mockResolvedValue([aReply(), aReply({ id: "r2", text: "Bakery." })])
    renderWithClient(<QuackList quacks={[aQuack({ replyCount: 2 })]} />)

    const toggle = screen.getByRole("button", { name: "2 replies" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(fetchReplies).not.toHaveBeenCalled()

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute("aria-expanded", "true")
    const replies = await screen.findByRole("list", { name: "Replies" })
    expect(within(replies).getAllByRole("listitem")).toHaveLength(2)
    expect(within(replies).getByText("The café, obviously.")).toBeInTheDocument()
    expect(within(replies).getAllByText("@NaiveGoose")).toHaveLength(2)
    expect(screen.getByLabelText("Your reply")).toBeInTheDocument()
  })

  it("invites the first reply when there is none", async () => {
    fetchReplies.mockResolvedValue([])
    renderWithClient(<QuackList quacks={[aQuack()]} />)

    await userEvent.click(screen.getByRole("button", { name: "Reply" }))

    expect(await screen.findByText("No replies yet. Be the first to reply.")).toBeInTheDocument()
  })

  it("shows the error with a way to retry", async () => {
    fetchReplies.mockRejectedValueOnce(new Error("Quack not found")).mockResolvedValue([])
    renderWithClient(<QuackList quacks={[aQuack({ replyCount: 1 })]} />)

    await userEvent.click(screen.getByRole("button", { name: "1 reply" }))
    expect(await screen.findByText("Quack not found")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("No replies yet. Be the first to reply.")).toBeInTheDocument()
  })

  it("offers delete on your own replies and Remove on others' only to a moderator", async () => {
    fetchReplies.mockResolvedValue([
      aReply({ id: "mine", text: "my reply", userId: "u1" }),
      aReply({ id: "theirs", text: "their reply" }),
    ])
    renderWithClient(
      <QuackList
        quacks={[aQuack({ replyCount: 2 })]}
        currentUserId="u1"
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "2 replies" }))
    const list = await screen.findByRole("list", { name: "Replies" })
    const mine = within(list).getByText("my reply").closest("li")
    const theirs = within(list).getByText("their reply").closest("li")
    if (!mine || !theirs) throw new Error("Both replies should be listed")

    expect(within(mine).getByRole("button", { name: "Delete reply" })).toBeInTheDocument()
    expect(within(theirs).queryByRole("button", { name: /reply/i })).not.toBeInTheDocument()
  })

  it("lets a moderator remove someone else's reply and drops it from the list", async () => {
    fetchReplies.mockResolvedValue([aReply()])
    vi.mocked(deleteReply).mockResolvedValue()
    const queryClient = renderWithClient(
      <QuackList
        quacks={[aQuack({ replyCount: 1 })]}
        currentUserId="a1"
        isModerator
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "1 reply" }))
    await userEvent.click(await screen.findByRole("button", { name: "Remove reply" }))
    const dialog = screen.getByRole("dialog", { name: "Remove @NaiveGoose's reply?" })
    fetchReplies.mockResolvedValue([])
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(deleteReply).toHaveBeenCalledWith({ quackId: "q1", replyId: "r1" })
    expect(queryClient.getQueryData(quackKeys.replies("q1"))).toEqual([])
  })

  it.each([
    ["author", "This quack was deleted"],
    ["moderator", "This quack was removed by a moderator"],
  ] as const)(
    "shows a placeholder deleted by the %s with its replies and no way to add one",
    async (deletedBy, message) => {
      fetchReplies.mockResolvedValue([aReply()])
      renderWithClient(
        <QuackList
          quacks={[placeholder(deletedBy)]}
          currentUserId="u1"
          isModerator
        />,
      )

      const article = screen.getByRole("article")
      expect(article).toHaveTextContent(message)
      // no author, no content, no delete action
      expect(within(article).queryByText("@CaffeinatedDuck")).not.toBeInTheDocument()
      expect(within(article).queryByRole("button", { name: /delete quack|^remove$/i })).toBeNull()

      await userEvent.click(within(article).getByRole("button", { name: "2 replies" }))

      expect(await screen.findByText("The café, obviously.")).toBeInTheDocument()
      expect(screen.queryByLabelText("Your reply")).not.toBeInTheDocument()
    },
  )
})
