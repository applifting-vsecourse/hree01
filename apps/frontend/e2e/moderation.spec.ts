import { expect, test, type Browser, type Page } from "@playwright/test"

import { signIn } from "./signIn"

const API = "http://localhost:4050/api"

const AUTHOR = { email: "breadcritic@example.com", password: "password3" }
const ADMIN = { email: "admin@example.com", password: "adminpassword" }
const REGULAR_USER = { email: "deepduckthoughts@example.com", password: "password2" }

async function signedInPage(browser: Browser, user: { email: string; password: string }) {
  const page = await (await browser.newContext()).newPage()
  await signIn(page, user.email, user.password)
  return page
}

/** Posts through the API as whoever `page` is signed in as. */
async function postQuack(page: Page, text: string): Promise<string> {
  const response = await page.request.post(`${API}/quacks`, { data: { text } })
  expect(response.status()).toBe(201)
  return ((await response.json()) as { id: string }).id
}

async function quackExists(page: Page, id: string): Promise<boolean> {
  const quacks: { id: string }[] = await (await page.request.get(`${API}/quacks`)).json()
  return quacks.some((quack) => quack.id === id)
}

test("an admin removes someone else's quack after confirming", async ({ browser }) => {
  const author = await signedInPage(browser, AUTHOR)
  const text = `E2E nasty quack ${Date.now()}`
  const id = await postQuack(author, text)
  const admin = await signedInPage(browser, ADMIN)

  try {
    await admin.goto("/quacks")
    const quack = admin.getByRole("article").filter({ hasText: text })
    await expect(quack).toBeVisible()
    // a moderator's action, not the author's trash can
    await expect(quack.getByRole("button", { name: "Delete quack" })).toHaveCount(0)

    await quack.getByRole("button", { name: "Remove" }).click()
    const dialog = admin.getByRole("dialog", { name: "Remove @BreadCritic's quack?" })
    await expect(dialog).toContainText("You're removing it as a moderator.")
    await dialog.getByRole("button", { name: "Remove" }).click()

    await expect(dialog).toBeHidden()
    await expect(quack).toHaveCount(0)
    // gone on the server for everyone, not just from the admin's page
    await admin.reload()
    await expect(admin.getByRole("article").first()).toBeVisible()
    await expect(quack).toHaveCount(0)
    expect(await quackExists(author, id)).toBe(false)
  } finally {
    await author.request.delete(`${API}/quacks/${id}`)
    await author.context().close()
    await admin.context().close()
  }
})

test("a regular user still can't remove someone else's quack", async ({ browser }) => {
  const author = await signedInPage(browser, AUTHOR)
  const text = `E2E not a moderator ${Date.now()}`
  const id = await postQuack(author, text)
  const user = await signedInPage(browser, REGULAR_USER)

  try {
    await user.goto("/quacks")
    const quack = user.getByRole("article").filter({ hasText: text })
    await expect(quack).toBeVisible()
    await expect(quack.getByRole("button", { name: "Remove" })).toHaveCount(0)
    await expect(quack.getByRole("button", { name: "Delete quack" })).toHaveCount(0)

    const response = await user.request.delete(`${API}/quacks/${id}`)
    expect(response.status()).toBe(403)
    expect(await quackExists(author, id)).toBe(true)
  } finally {
    await author.request.delete(`${API}/quacks/${id}`)
    await author.context().close()
    await user.context().close()
  }
})
