/**
 * Pulls a readable message out of an API error body. NestJS returns
 * `{ message: string | string[] }`; validation failures use the array form.
 * Returns undefined when the body has no usable message.
 */
export function getApiErrorMessage(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("message" in body)) return undefined
  const { message } = body
  if (typeof message === "string") return message || undefined
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === "string" && part !== "")
    return parts.length > 0 ? parts.join(", ") : undefined
  }
  return undefined
}
