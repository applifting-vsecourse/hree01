// Example component test — the pattern to copy for your own components.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

const quack = (overrides: Partial<Quack> = {}): Quack => ({
  id: "q1",
  text: "quack quack",
  mood: null,
  poll: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  ...overrides,
})

describe("QuackList", () => {
  it("renders quacks with author info", () => {
    render(<QuackList quacks={[quack()]} />)

    expect(screen.getByText("quack quack")).toBeInTheDocument()
    expect(screen.getByText("Caffeinated Duck")).toBeInTheDocument()
    expect(screen.getByText("@CaffeinatedDuck")).toBeInTheDocument()
  })

  it("explains an empty search and offers to clear it", async () => {
    const onClearSearch = vi.fn()
    render(
      <QuackList
        quacks={[]}
        search="pond"
        onClearSearch={onClearSearch}
      />,
    )

    expect(screen.getByText("No quacks match “pond”.")).toBeInTheDocument()
    expect(screen.queryByText(/No quacks yet/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(onClearSearch).toHaveBeenCalledOnce()
  })

  it("offers delete only on the signed-in user's own quacks", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <QuackList
          currentUserId="u1"
          quacks={[
            quack({ id: "mine", text: "my quack" }),
            quack({
              id: "theirs",
              text: "their quack",
              userId: "u2",
              user: { id: "u2", name: "Naïve Goose", username: "NaiveGoose" },
            }),
          ]}
        />
      </QueryClientProvider>,
    )

    const [mine, theirs] = screen.getAllByRole("article")
    expect(within(mine!).getByRole("button", { name: "Delete quack" })).toBeInTheDocument()
    expect(within(theirs!).queryByRole("button", { name: "Delete quack" })).not.toBeInTheDocument()
  })

  it("shows a custom empty state when there is no search", () => {
    render(
      <QuackList
        quacks={[]}
        emptyState={<p>You haven&apos;t posted any quacks yet.</p>}
      />,
    )

    expect(screen.getByText("You haven't posted any quacks yet.")).toBeInTheDocument()
    expect(screen.queryByText(/No quacks yet/)).not.toBeInTheDocument()
  })

  it("explains an empty search even with a custom empty state", () => {
    render(
      <QuackList
        quacks={[]}
        search="pond"
        emptyState={<p>You haven&apos;t posted any quacks yet.</p>}
      />,
    )

    expect(screen.getByText("No quacks match “pond”.")).toBeInTheDocument()
    expect(screen.queryByText(/You haven't posted/)).not.toBeInTheDocument()
  })

  it("shows the mood of a quack that has one", () => {
    render(<QuackList quacks={[quack({ mood: "silly" })]} />)

    expect(screen.getByText(/Feeling silly/)).toBeInTheDocument()
  })

  it("shows no mood for a quack without one", () => {
    render(<QuackList quacks={[quack()]} />)

    expect(screen.queryByText(/Feeling/)).not.toBeInTheDocument()
  })

  it("shows an error with a working reload button", async () => {
    const onReload = vi.fn()
    render(
      <QuackList
        quacks={[]}
        error={new Error("Server unreachable")}
        onReload={onReload}
      />,
    )

    expect(screen.getByText("Couldn't load quacks")).toBeInTheDocument()
    expect(screen.getByText("Server unreachable")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /reload/i }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
