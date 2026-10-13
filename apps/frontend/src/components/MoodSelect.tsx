import { FormControl } from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { moodLabels, moods, NO_MOOD, type MoodOption } from "@/lib/moods"

type MoodSelectProps = {
  value: MoodOption
  onValueChange: (value: MoodOption) => void
  isDisabled?: boolean
}

/** A mood picker for use inside a react-hook-form `FormField`. */
export function MoodSelect({ value, onValueChange, isDisabled }: MoodSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next as MoodOption)}
      disabled={isDisabled}
    >
      <FormControl>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        <SelectItem value={NO_MOOD}>No mood</SelectItem>
        {moods.map((mood) => (
          <SelectItem
            key={mood}
            value={mood}
          >
            <span aria-hidden="true">{moodLabels[mood].emoji}</span>
            {moodLabels[mood].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
