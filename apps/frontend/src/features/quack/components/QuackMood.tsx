import { moodLabels, type Mood } from "@/lib/moods"

type QuackMoodProps = { mood: Mood }

export function QuackMood({ mood }: QuackMoodProps) {
  const { emoji, label } = moodLabels[mood]

  return (
    <span className="text-xs text-muted-foreground">
      <span aria-hidden="true">{emoji}</span> Feeling {label.toLowerCase()}
    </span>
  )
}
