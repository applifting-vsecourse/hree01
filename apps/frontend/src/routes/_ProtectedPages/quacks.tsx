import { useCallback, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { Seo } from "@/components/Seo"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useSession } from "@/features/auth/hooks/useSession"
import { profileQueryOptions } from "@/features/profile/api/profileQueryOptions"
import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackForm, type QuackFormHandle } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"
import { QuackSearch } from "@/features/quack/components/QuackSearch"

const quacksSearchParamsSchema = z.object({
  // The router parses "?q=123" as a number, so accept that and keep it a string.
  q: z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .optional(),
  // "All" is the default and stays out of the URL; "Mine" is ?feed=mine.
  feed: z.literal("mine").optional().catch(undefined),
})

type Feed = "all" | "mine"

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  component: QuacksPage,
  validateSearch: quacksSearchParamsSchema,
})

function QuacksPage() {
  const { q: search = "", feed = "all" } = Route.useSearch()
  const navigate = Route.useNavigate()
  // Only used to preselect the default mood; the form works without it.
  const profileQuery = useQuery(profileQueryOptions())
  const formRef = useRef<QuackFormHandle>(null)

  // The search lives in the URL so it survives a reload and can be shared.
  // `replace` keeps typing from filling the history with one entry per word.
  const setSearch = useCallback(
    (next: string) =>
      void navigate({ search: (prev) => ({ ...prev, q: next || undefined }), replace: true }),
    [navigate],
  )

  const setFeed = (next: string) =>
    void navigate({
      search: (prev) => ({ ...prev, feed: next === "mine" ? "mine" : undefined }),
    })

  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <QuackForm
          ref={formRef}
          defaultMood={profileQuery.data?.defaultMood}
          className="mb-6"
        />

        <QuackSearch
          value={search}
          onSearch={setSearch}
          className="mb-4"
        />

        <Tabs
          value={feed}
          onValueChange={setFeed}
          className="gap-4"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="mine">Mine</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <FeedList
              feed="all"
              search={search}
              onClearSearch={() => setSearch("")}
            />
          </TabsContent>
          <TabsContent value="mine">
            <FeedList
              feed="mine"
              search={search}
              onClearSearch={() => setSearch("")}
              onCompose={() => formRef.current?.focus()}
            />
          </TabsContent>
        </Tabs>
      </section>
    </>
  )
}

type FeedListProps = {
  feed: Feed
  search: string
  onClearSearch: () => void
  onCompose?: () => void
}

function FeedList({ feed, search, onClearSearch, onCompose }: FeedListProps) {
  // Only decides which quacks get a delete action; it is never sent to the API.
  const { user } = useSession()
  const quacksQuery = useQuery(quacksQueryOptions(search, feed === "mine"))

  return (
    <QuackList
      quacks={quacksQuery.data ?? []}
      isLoading={quacksQuery.isLoading}
      error={quacksQuery.error ?? undefined}
      // Only the error state offers a retry — posting or deleting invalidates
      // the list, and refocusing the tab refetches it.
      onReload={() => void quacksQuery.refetch()}
      search={search}
      onClearSearch={onClearSearch}
      currentUserId={user?.id}
      emptyState={
        feed === "mine" ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-center text-sm text-muted-foreground">
              You haven&apos;t posted any quacks yet.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onCompose}
            >
              Write your first quack
            </Button>
          </div>
        ) : undefined
      }
    />
  )
}
