import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"

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
import { Input } from "@/components/ui/input"
import { HTTPError } from "@/lib/api-client"

import { replyFormSchema, type ReplyFormValues } from "@/features/quack/components/replyFormSchema"
import { useAddReply } from "@/features/quack/hooks/useAddReply"

type ReplyFormProps = {
  quackId: string
}

// 400 is a validation error about the text. Anything else (the quack was
// deleted meanwhile, or is gone) belongs to no field.
const isTextError = (error: Error | null): boolean =>
  error instanceof HTTPError && error.response.status === 400

/** A one-line reply: Enter posts it. */
export function ReplyForm({ quackId }: ReplyFormProps) {
  const addReply = useAddReply(quackId)
  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replyFormSchema),
    defaultValues: { text: "" },
  })
  const isPending = addReply.isPending

  const handleSubmit = (values: ReplyFormValues) => {
    addReply.mutate(values.text, {
      // empty again and still focused, ready for the next reply
      onSuccess: () => form.reset(),
      onError: (error) => {
        if (isTextError(error)) {
          form.setError("text", { message: error.message }, { shouldFocus: true })
        }
      },
    })
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-2"
      >
        {addReply.error && !isTextError(addReply.error) ? (
          <Alert variant="destructive">
            <AlertDescription>{addReply.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your reply</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  placeholder="The café by the pond, obviously."
                  {...field}
                  // read-only, not disabled, so focus stays here for the next reply
                  readOnly={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Reply
          </Button>
        </div>
      </form>
    </Form>
  )
}
