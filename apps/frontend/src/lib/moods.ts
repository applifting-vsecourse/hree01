import { z } from "zod"

// Shared by the quack feed (a quack's mood) and settings (the default mood for
// new quacks), so it lives outside both features.
export const moods = ["happy", "sad", "angry", "silly"] as const

export const moodSchema = z.enum(moods)

export type Mood = z.infer<typeof moodSchema>

export const moodLabels: Record<Mood, { emoji: string; label: string }> = {
  happy: { emoji: "😄", label: "Happy" },
  sad: { emoji: "😢", label: "Sad" },
  angry: { emoji: "😠", label: "Angry" },
  silly: { emoji: "🤪", label: "Silly" },
}

// Radix Select can't hold an empty value, so "no mood" gets its own option
// in forms and is mapped to null before a request.
export const NO_MOOD = "none"

export const moodOptionSchema = z.enum([NO_MOOD, ...moods])

export type MoodOption = z.infer<typeof moodOptionSchema>

export const toMoodOption = (mood: Mood | null): MoodOption => mood ?? NO_MOOD

export const fromMoodOption = (option: MoodOption): Mood | null =>
  option === NO_MOOD ? null : option
