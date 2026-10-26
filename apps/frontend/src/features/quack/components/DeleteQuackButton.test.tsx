import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { DeleteQuackButton } from "@/features/quack/components/DeleteQuackButton"

vi.mock("@/features/quack/api/deleteQuack", () => ({ deleteQuack: vi.fn() }))

const aQuack = (id: string): Quack => ({
  id,
  text: "quack quack",
  mood: null,
  poll: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
})

const renderWithClient = (ui: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  return queryClient
}

const openDialog = () => userEvent.click(screen.getByRole("button", { name: "Delete quack" }))

describe("DeleteQuackButton", () => {
  beforeEach(() => {
    vi.mocked(deleteQuack).mockReset()
  })

  it("asks before deleting and does nothing when the user keeps it", async () => {
    renderWithClient(<DeleteQuackButton quackId="q1" />)

    await openDialog()
    expect(screen.getByRole("dialog", { name: "Delete this quack?" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Keep it" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(deleteQuack).not.toHaveBeenCalled()
  })

  it("deletes once confirmed and drops the quack from every feed list", async () => {
    vi.mocked(deleteQuack).mockResolvedValue()
    const queryClient = renderWithClient(<DeleteQuackButton quackId="q1" />)
    queryClient.setQueryData(quackKeys.list(""), [aQuack("q1"), aQuack("q2")])
    queryClient.setQueryData(quackKeys.list("", true), [aQuack("q1")])

    await openDialog()
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(vi.mocked(deleteQuack).mock.calls[0]?.[0]).toBe("q1")
    expect(queryClient.getQueryData<Quack[]>(quackKeys.list(""))?.map((q) => q.id)).toEqual(["q2"])
    expect(queryClient.getQueryData<Quack[]>(quackKeys.list("", true))).toEqual([])
  })

  it("as a moderator, says whose quack is being removed and removes it", async () => {
    vi.mocked(deleteQuack).mockResolvedValue()
    renderWithClient(
      <DeleteQuackButton
        quackId="q1"
        moderatedUsername="BreadCritic"
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "Remove" }))
    const dialog = screen.getByRole("dialog", { name: "Remove @BreadCritic's quack?" })
    expect(dialog).toHaveTextContent("You're removing it as a moderator.")

    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(vi.mocked(deleteQuack).mock.calls[0]?.[0]).toBe("q1")
  })

  it("keeps the dialog open with the API's message when deleting fails", async () => {
    vi.mocked(deleteQuack).mockRejectedValue(new Error("You can only delete your own quacks"))
    renderWithClient(<DeleteQuackButton quackId="q1" />)

    await openDialog()
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("You can only delete your own quacks")).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })
})
