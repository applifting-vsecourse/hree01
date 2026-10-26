import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { signIn } from "./signIn"

const API = "http://localhost:4050/api"

type ApiQuack = { id: string; text: string }

async function findQuackByText(request: APIRequestContext, text: string) {
  const quacks: ApiQuack[] = await (await request.get(`${API}/quacks`)).json()
  return quacks.find((quack) => quack.text === text)
}

/** Posts through the API as whoever `page` is signed in as. */
async function postQuack(page: Page, text: string): Promise<string> {
  const response = await page.request.post(`${API}/quacks`, { data: { text } })
  expect(response.status()).toBe(201)
  return ((await response.json()) as ApiQuack).id
}

test("author can post a quack and delete it", async ({ page }) => {
  const text = `E2E quack ${Date.now()}`
  await signIn(page, "caffeinatedduck@example.com", "password1")
  await page.goto("/quacks")

  try {
    await page.getByLabel("New quack").fill(text)
    await page.getByRole("button", { name: "Quack", exact: true }).click()
    const quack = page.getByRole("article").filter({ hasText: text })
    await expect(quack).toBeVisible()

    await quack.getByRole("button", { name: "Delete quack" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
    await expect(quack).toHaveCount(0)

    // Gone on the server too, not just from the page's cache.
    await page.reload()
    await expect(page.getByRole("article").first()).toBeVisible()
    await expect(quack).toHaveCount(0)
    expect(await findQuackByText(page.request, text)).toBeUndefined()
  } finally {
    // Leave nothing behind if the test failed before deleting.
    const leftover = await findQuackByText(page.request, text)
    if (leftover) await page.request.delete(`${API}/quacks/${leftover.id}`)
  }
})

test("nobody can delete someone else's quack", async ({ browser }) => {
  // The author's own test quack, so a broken ownership check can't delete real data.
  const authorPage = await (await browser.newContext()).newPage()
  await signIn(authorPage, "caffeinatedduck@example.com", "password1")
  const text = `E2E not yours ${Date.now()}`
  const id = await postQuack(authorPage, text)

  const page = await (await browser.newContext()).newPage()
  try {
    await signIn(page, "deepduckthoughts@example.com", "password2")
    await page.goto("/quacks")

    // Wait for the quack first, otherwise "no delete button" passes on an empty page.
    const othersQuack = page.getByRole("article").filter({ hasText: text })
    await expect(othersQuack).toBeVisible()
    await expect(othersQuack.getByRole("button", { name: "Delete quack" })).toHaveCount(0)

    // The button is hidden. Now skip the UI and ask the server directly.
    const response = await page.request.delete(`${API}/quacks/${id}`)
    expect(response.status()).toBe(403)
    expect(await findQuackByText(page.request, text)).toBeDefined()
  } finally {
    await authorPage.request.delete(`${API}/quacks/${id}`)
    await authorPage.context().close()
    await page.context().close()
  }
})

test("Mine shows only my quacks and never sends a user id", async ({ page }) => {
  await signIn(page, "caffeinatedduck@example.com", "password1")
  const session = await (await page.request.get(`${API}/auth/get-session`)).json()
  const myId: string = session.user.id

  const feedRequest = page.waitForRequest(
    (request) => request.url().startsWith(`${API}/quacks`) && request.method() === "GET",
  )
  await page.goto("/quacks?feed=mine")
  const request = await feedRequest

  // The server works out who "mine" is from the session.
  expect(new URL(request.url()).searchParams.get("mine")).toBe("true")
  expect(request.url()).not.toContain(myId)
  expect(page.url()).not.toContain(myId)

  const mine = page.getByRole("tabpanel").getByRole("article")
  await expect(mine.first()).toBeVisible()
  for (const quack of await mine.all()) {
    await expect(quack).toContainText("@CaffeinatedDuck")
  }

  // Asking for someone else's quacks by id isn't possible.
  const response = await page.request.get(`${API}/quacks?authorId=${myId}`)
  expect(response.status()).toBe(400)
})
