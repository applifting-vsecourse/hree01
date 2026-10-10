import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { QuackSearch } from "@/features/quack/components/QuackSearch"

describe("QuackSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const type = (value: string) =>
    fireEvent.change(screen.getByLabelText("Search quacks"), { target: { value } })

  it("searches with the trimmed text once typing pauses", async () => {
    const onSearch = vi.fn()
    render(
      <QuackSearch
        value=""
        onSearch={onSearch}
      />,
    )

    type("  pond ")
    await act(() => vi.advanceTimersByTimeAsync(299))
    expect(onSearch).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(onSearch).toHaveBeenCalledExactlyOnceWith("pond")
  })

  it("rejects a search over 100 characters without running it", async () => {
    const onSearch = vi.fn()
    render(
      <QuackSearch
        value=""
        onSearch={onSearch}
      />,
    )

    type("a".repeat(101))
    await act(() => vi.advanceTimersByTimeAsync(1000))

    expect(screen.getByText("Keep it under 100 characters")).toBeInTheDocument()
    expect(screen.getByLabelText("Search quacks")).toHaveAttribute("aria-invalid", "true")
    expect(onSearch).not.toHaveBeenCalled()
  })

  it("clears the search immediately", () => {
    const onSearch = vi.fn()
    render(
      <QuackSearch
        value="pond"
        onSearch={onSearch}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))

    expect(onSearch).toHaveBeenCalledExactlyOnceWith("")
    expect(screen.getByLabelText("Search quacks")).toHaveValue("")
  })

  it("follows the search when it changes from outside", () => {
    const { rerender } = render(
      <QuackSearch
        value="pond"
        onSearch={vi.fn()}
      />,
    )

    rerender(
      <QuackSearch
        value="duck"
        onSearch={vi.fn()}
      />,
    )

    expect(screen.getByLabelText("Search quacks")).toHaveValue("duck")
  })
})
