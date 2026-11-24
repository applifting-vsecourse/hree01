import { expect, test, type Browser, type Locator, type Page } from "@playwright/test"

import { signIn } from "./signIn"

// Likes: end-to-end flows E1–E2 in cases.md.

const API = "http://localhost:4050/api"

const AUTHOR = { email: "breadcritic@example.com", password: "password3" }
const ME = { email: "caffeinatedduck@example.com", password: "password1" }
const SOMEONE_ELSE = { email: "deepduckthoughts@example.com", password: "password2" }

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

/** The like button of the quack with this text, on the feed. */
function likeButtonOf(page: Page, text: string): Locator {
  return page
    .getByRole("article")
    .filter({ hasText: text })
    .getByRole("button", { name: /^Like\b/ })
}

/** The only number on the button is `count`. */
const showsCount = (count: number) => new RegExp(`^\\D*${count}\\D*$`)

test("I like a quack, it sticks after a reload, and I can take it back", async ({ browser }) => {
  const author = await signedInPage(browser, AUTHOR)
  const text = `E2E quack to like ${Date.now()}`
  const id = await postQuack(author, text)
  const me = await signedInPage(browser, ME)

  try {
    await me.goto("/quacks")
    const like = likeButtonOf(me, text)
    await expect(like).toHaveAttribute("aria-pressed", "false")
    await expect(like).toHaveText(showsCount(0))

    await like.click()
    await expect(like).toHaveAttribute("aria-pressed", "true")
    await expect(like).toHaveText(showsCount(1))

    // Saved on the server, not just in the page.
    await me.reload()
    await expect(like).toHaveAttribute("aria-pressed", "true")
    await expect(like).toHaveText(showsCount(1))

    await like.click()
    await expect(like).toHaveAttribute("aria-pressed", "false")
    await expect(like).toHaveText(showsCount(0))

    await me.reload()
    await expect(like).toHaveAttribute("aria-pressed", "false")
    await expect(like).toHaveText(showsCount(0))
  } finally {
    await author.request.delete(`${API}/quacks/${id}`)
    await author.context().close()
    await me.context().close()
  }
})

test("someone else sees my like in the count, not as theirs", async ({ browser }) => {
  // My own quack: liking it is allowed, and it saves signing in a third user.
  const me = await signedInPage(browser, ME)
  const text = `E2E quack liked by me ${Date.now()}`
  const id = await postQuack(me, text)

  try {
    await me.goto("/quacks")
    await expect(likeButtonOf(me, text)).toHaveText(showsCount(0))
    await likeButtonOf(me, text).click()
    await expect(likeButtonOf(me, text)).toHaveText(showsCount(1))

    const someoneElse = await signedInPage(browser, SOMEONE_ELSE)
    await someoneElse.goto("/quacks")
    const theirs = likeButtonOf(someoneElse, text)
    await expect(theirs).toHaveText(showsCount(1))
    await expect(theirs).toHaveAttribute("aria-pressed", "false")
    await someoneElse.context().close()
  } finally {
    await me.request.delete(`${API}/quacks/${id}`)
    await me.context().close()
  }
})
