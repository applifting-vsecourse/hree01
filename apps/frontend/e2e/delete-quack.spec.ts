import { expect, test, type APIRequestContext, type Browser } from "@playwright/test"

// Runs against the app that is already up (frontend :3050, API :4050) and the
// seeded users. Every quack a test creates is removed again at the end.
const API_URL = "http://localhost:4050/api"
const FRONTEND_URL = "http://localhost:3050"

const AUTHOR = { email: "caffeinatedduck@example.com", password: "password1" }
const OTHER_USER = { email: "deepduckthoughts@example.com", password: "password2" }

type Credentials = typeof AUTHOR

/** A browser context signed in as `user`. Cookies are per host, so they reach both ports. */
async function signedInContext(browser: Browser, user: Credentials) {
  const context = await browser.newContext()
  const response = await context.request.post(`${API_URL}/auth/sign-in/email`, {
    data: user,
    // BetterAuth only accepts sign-ins from trusted origins
    headers: { Origin: FRONTEND_URL },
  })
  expect(response.ok(), `sign in as ${user.email}`).toBe(true)
  return context
}

async function postQuack(request: APIRequestContext, text: string): Promise<string> {
  const response = await request.post(`${API_URL}/quacks`, { data: { text } })
  expect(response.status()).toBe(201)
  const { id } = (await response.json()) as { id: string }
  return id
}

async function quackExists(request: APIRequestContext, id: string): Promise<boolean> {
  const response = await request.get(`${API_URL}/quacks`)
  expect(response.ok()).toBe(true)
  const quacks = (await response.json()) as { id: string }[]
  return quacks.some((quack) => quack.id === id)
}

const uniqueText = (label: string) =>
  `E2E ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

test("the author deletes their quack after confirming, and it is gone for good", async ({
  browser,
}) => {
  const context = await signedInContext(browser, AUTHOR)
  const text = uniqueText("delete me")
  const id = await postQuack(context.request, text)

  try {
    const page = await context.newPage()
    await page.goto("/quacks")
    const quack = page.getByRole("article").filter({ hasText: text })

    // keeping it changes nothing
    await quack.getByRole("button", { name: "Delete quack" }).click()
    await page.getByRole("button", { name: "Keep it" }).click()
    await expect(quack).toBeVisible()

    await quack.getByRole("button", { name: "Delete quack" }).click()
    const dialog = page.getByRole("dialog", { name: "Delete this quack?" })
    await dialog.getByRole("button", { name: "Delete" }).click()

    await expect(dialog).toBeHidden()
    await expect(quack).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole("article").filter({ hasText: text })).toHaveCount(0)
    expect(await quackExists(context.request, id)).toBe(false)
  } finally {
    // no-op when the test got as far as deleting it
    await context.request.delete(`${API_URL}/quacks/${id}`)
    await context.close()
  }
})

test("nobody else can delete a quack, not even by calling the API", async ({ browser }) => {
  const authorContext = await signedInContext(browser, AUTHOR)
  const otherContext = await signedInContext(browser, OTHER_USER)
  const text = uniqueText("not yours")
  const id = await postQuack(authorContext.request, text)

  try {
    // the UI offers no delete on someone else's quack...
    const page = await otherContext.newPage()
    await page.goto("/quacks")
    const quack = page.getByRole("article").filter({ hasText: text })
    await expect(quack).toBeVisible()
    await expect(quack.getByRole("button", { name: "Delete quack" })).toHaveCount(0)

    // ...and the API refuses the request when it is sent directly
    const response = await otherContext.request.delete(`${API_URL}/quacks/${id}`)
    expect(response.status()).toBe(403)
    expect(await response.json()).toMatchObject({
      message: "You can only delete your own quacks",
    })

    expect(await quackExists(authorContext.request, id)).toBe(true)
  } finally {
    await authorContext.request.delete(`${API_URL}/quacks/${id}`)
    await authorContext.close()
    await otherContext.close()
  }
})

test("a signed-out caller cannot delete anything", async ({ browser, request }) => {
  const authorContext = await signedInContext(browser, AUTHOR)
  const id = await postQuack(authorContext.request, uniqueText("signed out"))

  try {
    // `request` carries no session cookie
    const response = await request.delete(`${API_URL}/quacks/${id}`)
    expect(response.status()).toBe(401)
    expect(await quackExists(authorContext.request, id)).toBe(true)
  } finally {
    await authorContext.request.delete(`${API_URL}/quacks/${id}`)
    await authorContext.close()
  }
})
