import { createRef } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { addQuack } from "@/features/quack/api/addQuack"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackForm, type QuackFormHandle } from "@/features/quack/components/QuackForm"

vi.mock("@/features/quack/api/addQuack", () => ({ addQuack: vi.fn() }))

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuackForm />
    </QueryClientProvider>,
  )

const question = () => screen.getByLabelText("New quack")
const optionInput = (n: number) => screen.getByLabelText(`Option ${n}`)
const addPoll = () => userEvent.click(screen.getByRole("button", { name: "Add poll" }))

describe("QuackForm", () => {
  it("can be focused from outside, e.g. from an empty feed", async () => {
    const ref = createRef<QuackFormHandle>()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <QuackForm ref={ref} />
      </QueryClientProvider>,
    )

    act(() => ref.current?.focus())

    // react-hook-form focuses on the next tick
    await waitFor(() => expect(question()).toHaveFocus())
  })
})

describe("QuackForm poll", () => {
  beforeEach(() => {
    vi.mocked(addQuack).mockReset()
    vi.mocked(addQuack).mockResolvedValue({} as Quack)
  })

  it("starts a poll with two empty options and focuses the first", async () => {
    renderForm()

    await addPoll()

    expect(optionInput(1)).toHaveFocus()
    expect(optionInput(2)).toHaveValue("")
    expect(screen.queryByLabelText("Option 3")).not.toBeInTheDocument()
    // two is the minimum, so neither can be removed yet
    expect(screen.queryByRole("button", { name: /remove option/i })).not.toBeInTheDocument()
  })

  it("posts the question, trimmed options and the results setting on Enter", async () => {
    renderForm()

    await userEvent.type(question(), "Where do we go for lunch?")
    await addPoll()
    await userEvent.type(optionInput(1), "  The café by the pond ")
    await userEvent.type(optionInput(2), "Bakery on the corner")
    await userEvent.click(screen.getByRole("radio", { name: "After voting" }))
    await userEvent.type(optionInput(2), "{Enter}")

    expect(addQuack).toHaveBeenCalledWith(
      {
        text: "Where do we go for lunch?",
        mood: null,
        poll: {
          options: ["The café by the pond", "Bakery on the corner"],
          resultsVisibility: "after_voting",
        },
      },
      expect.anything(),
    )
  })

  it("puts an empty option's error on that option and moves the cursor there", async () => {
    renderForm()

    await userEvent.type(question(), "Lunch?")
    await addPoll()
    await userEvent.type(optionInput(1), "Café")
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))

    expect(await screen.findByText("Every option needs some text")).toBeInTheDocument()
    expect(optionInput(2)).toHaveFocus()
    expect(optionInput(2)).toHaveAttribute("aria-invalid", "true")
    expect(addQuack).not.toHaveBeenCalled()
  })

  it("flags the repeated option when two differ only in case", async () => {
    renderForm()

    await userEvent.type(question(), "Lunch?")
    await addPoll()
    await userEvent.type(optionInput(1), "Café")
    await userEvent.type(optionInput(2), "CAFÉ")
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))

    expect(await screen.findByText("Options must be different from each other")).toBeInTheDocument()
    expect(optionInput(2)).toHaveAttribute("aria-invalid", "true")
    expect(optionInput(1)).not.toHaveAttribute("aria-invalid", "true")
    expect(addQuack).not.toHaveBeenCalled()
  })

  it("adds options up to 10 and removes them down to 2", async () => {
    renderForm()

    await addPoll()
    for (let i = 0; i < 8; i++) {
      await userEvent.click(screen.getByRole("button", { name: "Add option" }))
    }

    expect(optionInput(10)).toHaveFocus()
    expect(screen.queryByRole("button", { name: "Add option" })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Remove option 10" }))
    expect(screen.queryByLabelText("Option 10")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add option" })).toBeInTheDocument()
  })

  it("removes the whole poll and hands focus back to 'Add poll'", async () => {
    renderForm()

    await addPoll()
    await userEvent.click(screen.getByRole("button", { name: "Remove poll" }))

    expect(screen.queryByLabelText("Option 1")).not.toBeInTheDocument()
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Add poll" })).toHaveFocus())
  })

  it("posts a plain quack without a poll", async () => {
    renderForm()

    await userEvent.type(question(), "Just quacking")
    // Enter in the textarea is a new line, so the button posts it
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))

    expect(addQuack).toHaveBeenCalledWith(
      { text: "Just quacking", mood: null, poll: null },
      expect.anything(),
    )
  })
})
