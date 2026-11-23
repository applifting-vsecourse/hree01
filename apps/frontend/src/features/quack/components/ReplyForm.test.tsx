import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HTTPError } from "ky"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { addReply } from "@/features/quack/api/addReply"
import type { Reply } from "@/features/quack/api/quackSchemas"
import { ReplyForm } from "@/features/quack/components/ReplyForm"

vi.mock("@/lib/api-client", async () => ({ HTTPError: (await import("ky")).HTTPError }))
vi.mock("@/features/quack/api/addReply", () => ({ addReply: vi.fn() }))

// What ky throws for an API error, without a real request.
const apiError = (status: number, message: string): HTTPError =>
  Object.assign(Object.create(HTTPError.prototype) as HTTPError, {
    message,
    response: new Response(null, { status }),
  })

const renderForm = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <ReplyForm quackId="q1" />
    </QueryClientProvider>,
  )

const replyInput = () => screen.getByLabelText("Your reply")

describe("ReplyForm", () => {
  beforeEach(() => {
    vi.mocked(addReply).mockReset()
  })

  it("posts the trimmed reply on Enter and clears the field", async () => {
    vi.mocked(addReply).mockResolvedValue({} as Reply)
    renderForm()

    await userEvent.type(replyInput(), "  The café by the pond  {Enter}")

    expect(addReply).toHaveBeenCalledWith({ quackId: "q1", text: "The café by the pond" })
    await vi.waitFor(() => expect(replyInput()).toHaveValue(""))
  })

  it("focuses an empty reply and says what is wrong", async () => {
    renderForm()

    await userEvent.click(screen.getByRole("button", { name: "Reply" }))

    expect(await screen.findByText("Write something first")).toBeInTheDocument()
    expect(replyInput()).toHaveFocus()
    expect(addReply).not.toHaveBeenCalled()
  })

  it("puts the server's message about the text on the field and keeps what was typed", async () => {
    vi.mocked(addReply).mockRejectedValue(apiError(400, "Keep it under 280 characters"))
    renderForm()

    await userEvent.type(replyInput(), "Naïve question{Enter}")

    expect(await screen.findByText("Keep it under 280 characters")).toBeInTheDocument()
    expect(replyInput()).toHaveValue("Naïve question")
    expect(replyInput()).toHaveFocus()
    expect(replyInput()).toHaveAttribute("aria-invalid", "true")
  })

  it("shows an error that belongs to no field above the form, keeping the text", async () => {
    vi.mocked(addReply).mockRejectedValue(apiError(409, "This quack was deleted"))
    renderForm()

    await userEvent.type(replyInput(), "Too late{Enter}")

    expect(await screen.findByRole("alert")).toHaveTextContent("This quack was deleted")
    expect(replyInput()).toHaveValue("Too late")
    expect(replyInput()).not.toHaveAttribute("aria-invalid", "true")
  })
})
