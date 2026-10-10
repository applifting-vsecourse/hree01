import { useEffect, useId, useRef, useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Mirrors the server-side DTO (MaxLength(100)).
export const SEARCH_MAX_LENGTH = 100
const DEBOUNCE_MS = 300

type QuackSearchProps = {
  /** The search currently applied to the feed (from the URL). */
  value: string
  /** Called with the trimmed search; an empty string clears it. */
  onSearch: (search: string) => void
  className?: string
}

export function QuackSearch({ value, onSearch, className }: QuackSearchProps) {
  const [input, setInput] = useState(value)
  const [appliedValue, setAppliedValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const errorId = `${id}-error`

  // Follow the URL when it changes from outside (back button, a shared link).
  // Compared trimmed so a trailing space the user is still typing survives.
  if (value !== appliedValue) {
    setAppliedValue(value)
    if (input.trim() !== value) setInput(value)
  }

  const trimmed = input.trim()
  const isTooLong = trimmed.length > SEARCH_MAX_LENGTH

  useEffect(() => {
    if (isTooLong || trimmed === value) return
    const timeout = setTimeout(() => onSearch(trimmed), DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [trimmed, isTooLong, value, onSearch])

  const clear = () => {
    setInput("")
    onSearch("")
    inputRef.current?.focus()
  }

  return (
    <div
      role="search"
      className={className}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>Search quacks</Label>
        <div className="relative">
          <Input
            ref={inputRef}
            id={id}
            type="text"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="pond, Caffeinated Duck, @CaffeinatedDuck"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-invalid={isTooLong || undefined}
            aria-describedby={isTooLong ? errorId : undefined}
            className={input ? "pr-12" : undefined}
          />
          {input ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Clear search"
              onClick={clear}
              className="absolute top-1/2 right-1 -translate-y-1/2"
            >
              <X />
            </Button>
          ) : null}
        </div>
        {isTooLong ? (
          <p
            id={errorId}
            className="text-sm text-destructive"
          >
            Keep it under {SEARCH_MAX_LENGTH} characters
          </p>
        ) : null}
      </div>
    </div>
  )
}
