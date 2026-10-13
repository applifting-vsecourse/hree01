import { describe, expect, it } from "vitest"

import { getApiErrorMessage } from "@/lib/api-error"

describe("getApiErrorMessage", () => {
  it("reads a single message", () => {
    expect(getApiErrorMessage({ statusCode: 409, message: "That username is already taken" })).toBe(
      "That username is already taken",
    )
  })

  it("joins validation messages", () => {
    expect(
      getApiErrorMessage({
        message: ["name should not be empty", "bio must be shorter than 160 characters"],
      }),
    ).toBe("name should not be empty, bio must be shorter than 160 characters")
  })

  it("returns undefined when there is nothing readable", () => {
    expect(getApiErrorMessage(undefined)).toBeUndefined()
    expect(getApiErrorMessage("Bad Gateway")).toBeUndefined()
    expect(getApiErrorMessage({ message: "" })).toBeUndefined()
    expect(getApiErrorMessage({ message: [] })).toBeUndefined()
  })
})
