import { useEffect, useImperativeHandle, useRef, type Ref } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ListChecks, Loader2 } from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"

import { MoodSelect } from "@/components/MoodSelect"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { fromMoodOption, toMoodOption, type Mood } from "@/lib/moods"
import { cn } from "@/lib/utils"

import { POLL_MIN_OPTIONS } from "@/features/quack/api/pollLimits"
import { PollEditor } from "@/features/quack/components/PollEditor"
import {
  QUACK_MAX_LENGTH,
  quackFormSchema,
  type QuackFormValues,
} from "@/features/quack/components/quackFormSchema"
import { useAddQuack } from "@/features/quack/hooks/useAddQuack"

export type QuackFormHandle = { focus: () => void }

type QuackFormProps = {
  /** Preselected for every new quack — the user's default mood from settings. */
  defaultMood?: Mood | null
  className?: string
  /** Lets the page send the user here, e.g. from an empty feed. */
  ref?: Ref<QuackFormHandle>
}

export function QuackForm({ defaultMood = null, className, ref }: QuackFormProps) {
  const addQuack = useAddQuack()
  const defaultMoodOption = toMoodOption(defaultMood)
  const form = useForm<QuackFormValues>({
    resolver: zodResolver(quackFormSchema),
    defaultValues: {
      text: "",
      mood: defaultMoodOption,
      pollOptions: [],
      resultsVisibility: "right_away",
    },
  })
  const pollOptions = useFieldArray({ control: form.control, name: "pollOptions" })
  const hasPoll = pollOptions.fields.length > 0
  const addPollRef = useRef<HTMLButtonElement>(null)

  useImperativeHandle(ref, () => ({ focus: () => form.setFocus("text") }), [form])

  // The default mood can arrive after the form mounts (it is loaded with the
  // profile). Adopt it unless the user has already picked a mood themselves.
  useEffect(() => {
    if (form.getFieldState("mood").isDirty) return
    form.resetField("mood", { defaultValue: defaultMoodOption })
  }, [defaultMoodOption, form])

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0
  const isPending = addQuack.isPending

  const addPoll = () => {
    // append would focus the last new option; the first is where typing starts
    pollOptions.append(
      Array.from({ length: POLL_MIN_OPTIONS }, () => ({ text: "" })),
      { focusIndex: 0 },
    )
  }

  const removePoll = () => {
    pollOptions.remove()
    // The poll's own buttons are gone, so focus returns to "Add poll".
    requestAnimationFrame(() => addPollRef.current?.focus())
  }

  const handleSubmit = (values: QuackFormValues) => {
    addQuack.mutate(
      {
        text: values.text,
        mood: fromMoodOption(values.mood),
        poll:
          values.pollOptions.length > 0
            ? {
                options: values.pollOptions.map((option) => option.text),
                resultsVisibility: values.resultsVisibility,
              }
            : null,
      },
      // back to an empty text, no poll and the default mood, ready for the next quack
      { onSuccess: () => form.reset() },
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
      >
        {addQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>New quack</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={hasPoll ? "Ask a question..." : "Quack something..."}
                    {...field}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem className="sm:w-40">
                <FormLabel>Mood</FormLabel>
                <MoodSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  isDisabled={isPending}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {hasPoll ? (
          <PollEditor
            control={form.control}
            fields={pollOptions.fields}
            onAddOption={() => pollOptions.append({ text: "" })}
            onRemoveOption={(index) => pollOptions.remove(index)}
            onRemovePoll={removePoll}
            isDisabled={isPending}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {hasPoll ? null : (
            <Button
              ref={addPollRef}
              type="button"
              variant="ghost"
              size="sm"
              onClick={addPoll}
              disabled={isPending}
            >
              <ListChecks />
              Add poll
            </Button>
          )}
          <span
            className={cn(
              "ml-auto text-sm",
              length > QUACK_MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {length}/{QUACK_MAX_LENGTH}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Quack
          </Button>
        </div>
      </form>
    </Form>
  )
}
