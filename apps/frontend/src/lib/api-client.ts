import ky, { HTTPError } from "ky"

import { env } from "@/config/env"
import { queryClient } from "@/config/react-query"
import { getApiErrorMessage } from "@/lib/api-error"
import { authKeys } from "@/lib/auth-keys"

// Single shared HTTP client. Per the Applifting frontend playbook:
// - send credentials so better-auth's session cookie travels with every request
// - on 401 invalidate the auth session query so route loaders re-resolve auth
//   and redirect through the login flow
// - turn API errors into readable messages (see beforeError below)
//
// Paths are joined onto `prefix`, and a leading slash is normalised away, so
// both `api.get("quacks")` and `api.get("/quacks")` hit the same endpoint.
export const api = ky.create({
  prefix: env.VITE_API_URL,
  credentials: "include",
  retry: { limit: 0 },
  hooks: {
    // NestJS returns { message: string | string[] } on validation failures.
    // Without this the user would see ky's generic "Request failed with status
    // code 400" and never learn what was actually wrong.
    //
    // ky v2 has already read the body into `error.data` by the time this runs,
    // so `error.response.json()` would fail here — read `error.data` instead.
    beforeError: [
      ({ error }) => {
        if (!(error instanceof HTTPError)) return error
        // no usable message in the body — keep ky's default
        const message = getApiErrorMessage(error.data)
        if (message) error.message = message
        return error
      },
    ],
    afterResponse: [
      ({ response }) => {
        if (response.status === 401) {
          void queryClient.invalidateQueries({ queryKey: authKeys.session() })
        }
      },
    ],
  },
})

export { HTTPError }
