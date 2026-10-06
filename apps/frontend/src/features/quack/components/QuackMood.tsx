import type { QuackMood as Mood } from "@/features/quack/api/quackSchemas"

export const moodLabels: Record<Mood, { emoji: string; label: string }> = {
  happy: { emoji: "😄", label: "Happy" },
  sad: { emoji: "😢", label: "Sad" },
  angry: { emoji: "😠", label: "Angry" },
  silly: { emoji: "🤪", label: "Silly" },
}

type QuackMoodProps = { mood: Mood }

export function QuackMood({ mood }: QuackMoodProps) {
  const { emoji, label } = moodLabels[mood]

  return (
    <span className="text-xs text-muted-foreground">
      <span aria-hidden="true">{emoji}</span> Feeling {label.toLowerCase()}
    </span>
  )
}
