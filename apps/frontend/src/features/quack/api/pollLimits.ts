// Mirrors the server: limits from the backend's domain/poll.ts, messages from
// its CreatePollDto, so client and server never disagree about what is valid.
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 10
export const POLL_OPTION_MAX_LENGTH = 80

export const pollMessages = {
  emptyOption: "Every option needs some text",
  longOption: `Keep each option under ${POLL_OPTION_MAX_LENGTH} characters`,
  duplicateOption: "Options must be different from each other",
} as const
