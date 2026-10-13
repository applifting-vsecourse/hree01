import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { MoodSelect } from "@/components/MoodSelect"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { HTTPError } from "@/lib/api-client"
import { fromMoodOption, moodOptionSchema, toMoodOption } from "@/lib/moods"
import { cn } from "@/lib/utils"

import {
  BIO_MAX_LENGTH,
  NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  type Profile,
} from "@/features/profile/api/profileSchemas"
import { useUpdateProfile } from "@/features/profile/hooks/useUpdateProfile"

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a display name")
    .max(NAME_MAX_LENGTH, `Keep it under ${NAME_MAX_LENGTH} characters`),
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH, `Use at least ${USERNAME_MIN_LENGTH} characters`)
    .max(USERNAME_MAX_LENGTH, `Keep it under ${USERNAME_MAX_LENGTH} characters`)
    .regex(USERNAME_PATTERN, "Use only letters, numbers, dots and underscores"),
  bio: z.string().trim().max(BIO_MAX_LENGTH, `Keep it under ${BIO_MAX_LENGTH} characters`),
  defaultMood: moodOptionSchema,
})

type FormValues = z.infer<typeof schema>

const toFormValues = (profile: Profile): FormValues => ({
  name: profile.name,
  username: profile.username,
  bio: profile.bio ?? "",
  defaultMood: toMoodOption(profile.defaultMood),
})

const isUsernameTaken = (error: unknown): error is HTTPError =>
  error instanceof HTTPError && error.response.status === 409

type ProfileFormProps = { profile: Profile }

export function ProfileForm({ profile }: ProfileFormProps) {
  const updateProfile = useUpdateProfile()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(profile),
  })

  const bio = useWatch({ control: form.control, name: "bio" })
  const bioLength = bio?.length ?? 0
  const isPending = updateProfile.isPending

  const handleSubmit = (values: FormValues) => {
    updateProfile.mutate(
      {
        name: values.name,
        username: values.username,
        bio: values.bio || null,
        defaultMood: fromMoodOption(values.defaultMood),
      },
      {
        onSuccess: (saved) => {
          // what was just saved becomes what "Discard changes" returns to
          form.reset(toFormValues(saved))
          toast.success("Settings saved")
        },
        onError: (error) => {
          // Shown at the field; the typed value stays so it can be tweaked.
          if (isUsernameTaken(error)) {
            form.setError("username", { message: error.message }, { shouldFocus: true })
          }
        },
      },
    )
  }

  const handleDiscard = () => {
    updateProfile.reset()
    form.reset()
  }

  // A taken username is reported at its field, everything else up top.
  const formError =
    updateProfile.error && !isUsernameTaken(updateProfile.error) ? updateProfile.error : null

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-6"
      >
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
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
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  {...field}
                  disabled={isPending}
                />
              </FormControl>
              <FormDescription>
                {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} characters: letters, numbers, dots and
                underscores.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Mostly here for the bread."
                  {...field}
                  disabled={isPending}
                />
              </FormControl>
              <div className="flex items-start justify-between gap-3">
                <FormMessage />
                <span
                  className={cn(
                    "ml-auto text-sm",
                    bioLength > BIO_MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {bioLength}/{BIO_MAX_LENGTH}
                </span>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultMood"
          render={({ field }) => (
            <FormItem className="sm:w-60">
              <FormLabel>Default mood for new quacks</FormLabel>
              <MoodSelect
                value={field.value}
                onValueChange={field.onChange}
                isDisabled={isPending}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={isPending || !form.formState.isDirty}
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>
    </Form>
  )
}
