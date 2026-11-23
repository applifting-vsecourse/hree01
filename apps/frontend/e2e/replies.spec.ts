import { expect, test, type Browser, type Page } from "@playwright/test"

import { signIn } from "./signIn"

const API = "http://localhost:4050/api"

const AUTHOR = { email: "breadcritic@example.com", password: "password3" }
const REPLIER = { email: "deepduckthoughts@example.com", password: "password2" }

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

type ApiQuack = { id: string; text: string | null; deletedBy: string | null }

async function findQuack(page: Page, id: string): Promise<ApiQuack | undefined> {
  const quacks: ApiQuack[] = await (await page.request.get(`${API}/quacks`)).json()
  return quacks.find((quack) => quack.id === id)
}

test("a reply outlives the deleted quack, and the placeholder goes with the last reply", async ({
  browser,
}) => {
  const author = await signedInPage(browser, AUTHOR)
  const replier = await signedInPage(browser, REPLIER)
  const text = `E2E quack to reply to ${Date.now()}`
  const replyText = `E2E reply ${Date.now()}`
  const id = await postQuack(author, text)

  try {
    // Someone replies under the quack.
    await replier.goto("/quacks")
    const quack = replier.getByRole("article").filter({ hasText: text })
    await quack.getByRole("button", { name: "Reply" }).click()
    await quack.getByLabel("Your reply").fill(replyText)
    await quack.getByLabel("Your reply").press("Enter")
    await expect(quack.getByRole("list", { name: "Replies" })).toContainText(replyText)
    await expect(quack.getByRole("button", { name: "1 reply" })).toBeVisible()

    // The author deletes it: the content goes, the reply stays.
    await author.goto("/quacks")
    const ownQuack = author.getByRole("article").filter({ hasText: text })
    await ownQuack.getByRole("button", { name: "Delete quack" }).click()
    const dialog = author.getByRole("dialog", { name: "Delete this quack?" })
    await expect(dialog).toContainText("Its replies stay visible under a placeholder.")
    await dialog.getByRole("button", { name: "Delete" }).click()
    await expect(author.getByText(text)).toHaveCount(0)

    const stored = await findQuack(author, id)
    expect(stored).toMatchObject({ text: null, deletedBy: "author" })
    // no new replies under a placeholder
    const late = await replier.request.post(`${API}/quacks/${id}/replies`, {
      data: { text: "Too late" },
    })
    expect(late.status()).toBe(409)

    await replier.reload()
    const placeholder = replier
      .getByRole("article")
      .filter({ hasText: "This quack was deleted" })
      .filter({ has: replier.getByRole("button", { name: "1 reply" }) })
    await placeholder.getByRole("button", { name: "1 reply" }).click()
    await expect(placeholder).toContainText(replyText)
    await expect(placeholder.getByLabel("Your reply")).toHaveCount(0)

    // The replier deletes their reply, the last one: the placeholder goes too.
    await placeholder.getByRole("button", { name: "Delete reply" }).click()
    await replier
      .getByRole("dialog", { name: "Delete this reply?" })
      .getByRole("button", { name: "Delete" })
      .click()
    await expect(replier.getByText(replyText)).toHaveCount(0)
    expect(await findQuack(replier, id)).toBeUndefined()
  } finally {
    // Clean up whatever a failed run left behind (a 404 here is fine).
    const replies: { id: string; userId: string }[] = await (
      await replier.request.get(`${API}/quacks/${id}/replies`)
    )
      .json()
      .catch(() => [])
    for (const reply of Array.isArray(replies) ? replies : []) {
      await replier.request.delete(`${API}/quacks/${id}/replies/${reply.id}`)
    }
    await author.request.delete(`${API}/quacks/${id}`)
    await author.context().close()
    await replier.context().close()
  }
})
