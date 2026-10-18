import { useId } from "react"
import { Plus, X } from "lucide-react"
import type { Control, FieldArrayWithId } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "@/features/quack/api/pollLimits"
import type { QuackFormValues } from "@/features/quack/components/quackFormSchema"

const resultsLabels = {
  right_away: "Right away",
  after_voting: "After voting",
} as const

type PollEditorProps = {
  control: Control<QuackFormValues>
  fields: FieldArrayWithId<QuackFormValues, "pollOptions">[]
  onAddOption: () => void
  onRemoveOption: (index: number) => void
  onRemovePoll: () => void
  isDisabled: boolean
}

/** The poll part of the new-quack form; the quack's text is the question. */
export function PollEditor({
  control,
  fields,
  onAddOption,
  onRemoveOption,
  onRemovePoll,
  isDisabled,
}: PollEditorProps) {
  const canRemoveOption = fields.length > POLL_MIN_OPTIONS
  const canAddOption = fields.length < POLL_MAX_OPTIONS
  const resultsLabelId = useId()

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-medium">Poll</legend>

      {fields.map((field, index) => (
        <FormField
          key={field.id}
          control={control}
          name={`pollOptions.${index}.text`}
          render={({ field: input }) => (
            <FormItem>
              <FormLabel>Option {index + 1}</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    autoComplete="off"
                    {...input}
                    disabled={isDisabled}
                  />
                </FormControl>
                {canRemoveOption ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() => onRemoveOption(index)}
                    disabled={isDisabled}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}

      <div className="flex flex-wrap items-center gap-3">
        {canAddOption ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddOption}
            disabled={isDisabled}
          >
            <Plus />
            Add option
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemovePoll}
          disabled={isDisabled}
        >
          Remove poll
        </Button>
      </div>

      <FormField
        control={control}
        name="resultsVisibility"
        render={({ field }) => (
          <FormItem>
            <FormLabel id={resultsLabelId}>Show results</FormLabel>
            <FormControl>
              <RadioGroup
                aria-labelledby={resultsLabelId}
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled}
                className="flex flex-wrap gap-4"
              >
                {(Object.keys(resultsLabels) as (keyof typeof resultsLabels)[]).map((value) => (
                  <div
                    key={value}
                    className="flex items-center gap-2"
                  >
                    <RadioGroupItem
                      value={value}
                      id={`${resultsLabelId}-${value}`}
                    />
                    <label
                      htmlFor={`${resultsLabelId}-${value}`}
                      className="text-sm"
                    >
                      {resultsLabels[value]}
                    </label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </fieldset>
  )
}
