import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HTTPError } from "ky"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Profile } from "@/features/profile/api/profileSchemas"
import { updateProfile } from "@/features/profile/api/updateProfile"
import { ProfileForm } from "@/features/profile/components/ProfileForm"

vi.mock("@/lib/api-client", async () => ({ HTTPError: (await import("ky")).HTTPError }))
vi.mock("@/features/profile/api/updateProfile", () => ({ updateProfile: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const profile: Profile = {
  id: "u1",
  name: "Caffeinated Duck",
  username: "CaffeinatedDuck",
  bio: "Running on espresso.",
  defaultMood: "silly",
}

// What ky throws for a 409 from the API, without a real request.
const usernameTakenError = (): HTTPError =>
  Object.assign(Object.create(HTTPError.prototype) as HTTPError, {
    message: "That username is already taken",
    response: new Response(null, { status: 409 }),
  })

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfileForm profile={profile} />
    </QueryClientProvider>,
  )

const usernameInput = () => screen.getByLabelText("Username")

describe("ProfileForm", () => {
  beforeEach(() => {
    vi.mocked(updateProfile).mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it("starts with the saved profile", () => {
    renderForm()

    expect(screen.getByLabelText("Display name")).toHaveValue("Caffeinated Duck")
    expect(usernameInput()).toHaveValue("CaffeinatedDuck")
    expect(screen.getByLabelText("Bio")).toHaveValue("Running on espresso.")
    expect(screen.getByRole("combobox", { name: /default mood/i })).toHaveTextContent("Silly")
  })

  it("saves on Enter", async () => {
    vi.mocked(updateProfile).mockImplementation((update) =>
      Promise.resolve({ id: "u1", ...update }),
    )
    renderForm()

    await userEvent.type(usernameInput(), "2{Enter}")

    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ username: "CaffeinatedDuck2" }),
      expect.anything(),
    )
  })

  it("moves the cursor to an empty required field and says what is wrong", async () => {
    renderForm()

    await userEvent.clear(screen.getByLabelText("Display name"))
    await userEvent.type(usernameInput(), "{Enter}")

    expect(await screen.findByText("Enter a display name")).toBeInTheDocument()
    expect(screen.getByLabelText("Display name")).toHaveFocus()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("rejects an invalid username without saving", async () => {
    renderForm()

    await userEvent.clear(usernameInput())
    await userEvent.type(usernameInput(), "no spaces!")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(
      await screen.findByText("Use only letters, numbers, dots and underscores"),
    ).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("shows a taken username at its field and keeps what was typed", async () => {
    vi.mocked(updateProfile).mockRejectedValue(usernameTakenError())
    renderForm()

    await userEvent.clear(usernameInput())
    await userEvent.type(usernameInput(), "BreadCritic")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("That username is already taken")).toBeInTheDocument()
    expect(usernameInput()).toHaveValue("BreadCritic")
    expect(usernameInput()).toHaveAttribute("aria-invalid", "true")
    expect(usernameInput()).toHaveFocus()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("saves, confirms and treats the saved values as the new baseline", async () => {
    vi.mocked(updateProfile).mockImplementation((update) =>
      Promise.resolve({ id: "u1", ...update }),
    )
    renderForm()

    await userEvent.clear(usernameInput())
    await userEvent.type(usernameInput(), "Decaf.Duck")
    await userEvent.clear(screen.getByLabelText("Bio"))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(updateProfile).toHaveBeenCalledWith(
      {
        name: "Caffeinated Duck",
        username: "Decaf.Duck",
        bio: null,
        defaultMood: "silly",
      },
      expect.anything(),
    )
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Settings saved"))
    expect(usernameInput()).toHaveValue("Decaf.Duck")
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled()
  })

  it("discards changes back to what is saved", async () => {
    renderForm()

    await userEvent.clear(screen.getByLabelText("Display name"))
    await userEvent.type(screen.getByLabelText("Display name"), "Someone Else")
    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }))

    expect(screen.getByLabelText("Display name")).toHaveValue("Caffeinated Duck")
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
