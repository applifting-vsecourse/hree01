import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Loader2, RefreshCw } from "lucide-react"

import { Seo } from "@/components/Seo"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import { profileQueryOptions } from "@/features/profile/api/profileQueryOptions"
import { ProfileForm } from "@/features/profile/components/ProfileForm"

export const Route = createFileRoute("/_ProtectedPages/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  const profileQuery = useQuery(profileQueryOptions())

  return (
    <>
      <Seo title="Settings" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

        {profileQuery.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : null}

        {profileQuery.error ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t load your settings</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{profileQuery.error.message}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void profileQuery.refetch()}
              >
                <RefreshCw className="size-4" />
                Reload
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Keyed so the form only takes the saved profile as its starting
            values once — a background refetch must not wipe unsaved edits. */}
        {profileQuery.data ? (
          <ProfileForm
            key={profileQuery.data.id}
            profile={profileQuery.data}
          />
        ) : null}
      </section>
    </>
  )
}
