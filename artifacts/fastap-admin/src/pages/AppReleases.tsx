import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell, PanelCard, EmptyState } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { api, type AppRelease, type AppCatalogEntry, type AppVisibilityRow, type AppDownloadRow } from "@/lib/apiClient";
import {
  Smartphone, Upload, Rocket, Trash2, Search, Link2, HardDriveDownload,
  ChefHat, ConciergeBell, BedDouble, CheckCircle2, Eye, EyeOff, Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const APP_ICON: Record<string, typeof ChefHat> = {
  kitchen: ChefHat,
  waiter: ConciergeBell,
  housekeeping: BedDouble,
};

const APP_TINT: Record<string, string> = {
  kitchen: "bg-warning-subtle text-warning border-warning-border",
  waiter: "bg-info-subtle text-info border-info-border",
  housekeeping: "bg-success-subtle text-success border-success-border",
};

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: AppRelease["status"]) {
  const map: Record<string, string> = {
    published: "bg-success-subtle text-success border-success-border",
    draft: "bg-warning-subtle text-warning border-warning-border",
    ready: "bg-info-subtle text-info border-info-border",
    archived: "bg-muted text-muted-foreground",
  };
  const label = status === "published" ? "LIVE" : status.toUpperCase();
  return <Badge variant="outline" className={`text-[10px] font-bold ${map[status] ?? ""}`}>{label}</Badge>;
}

type UploadForm = {
  appKey: string;
  version: string;
  changelog: string;
  mode: "file" | "link";
  downloadUrl: string;
  file: File | null;
};

const EMPTY_FORM: UploadForm = { appKey: "kitchen", version: "", changelog: "", mode: "file", downloadUrl: "", file: null };

export default function AppReleases() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const releasesQuery = useQuery({ queryKey: ["app-releases"], queryFn: api.appReleases.list });
  const visibilityQuery = useQuery({ queryKey: ["app-releases-visibility"], queryFn: api.appReleases.visibility });
  const downloadsQuery = useQuery({ queryKey: ["app-releases-downloads"], queryFn: api.appReleases.downloads });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<UploadForm>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const catalog: AppCatalogEntry[] = releasesQuery.data?.catalog ?? [];
  const releases: AppRelease[] = releasesQuery.data?.releases ?? [];
  const restaurants: AppVisibilityRow[] = visibilityQuery.data?.restaurants ?? [];

  const filteredRestaurants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter(r => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));
  }, [restaurants, search]);

  const downloads: AppDownloadRow[] = downloadsQuery.data?.downloads ?? [];

  /** The version each app is meant to be on, so an out-of-date venue can be spotted. */
  const liveVersionOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const app of catalog) {
      const live = releases.find(r => r.id === app.liveReleaseId);
      if (live) map[app.appKey] = live.version;
    }
    return map;
  }, [catalog, releases]);

  /**
   * "Which venue is on which build" — the question a platform owner actually asks, and
   * the one a chronological log of every tap cannot answer. Ordered by the venues that
   * are behind, because those are the ones worth chasing.
   */
  const fleet = useMemo(() => {
    const byVenue = downloadsQuery.data?.byVenue ?? {};
    return Object.entries(byVenue)
      .map(([key, venue]) => {
        const stale = catalog.filter(app => {
          const got = venue.apps[app.appKey]?.version;
          return got && liveVersionOf[app.appKey] && got !== liveVersionOf[app.appKey];
        }).map(app => app.appKey);
        return { key, ...venue, stale };
      })
      .sort((a, b) => (b.stale.length - a.stale.length) || a.restaurant.localeCompare(b.restaurant));
  }, [downloadsQuery.data, catalog, liveVersionOf]);

  const downloadColumns: DataTableColumn<AppDownloadRow>[] = [
    {
      header: "When", sortable: true,
      sortValue: r => new Date(r.downloadedAt),
      searchValue: r => new Date(r.downloadedAt).toLocaleString(),
      cell: r => <span className="text-xs text-muted-foreground">{new Date(r.downloadedAt).toLocaleString()}</span>,
    },
    {
      header: "App", accessorKey: "appKey", sortable: true,
      cell: r => <span className="capitalize text-sm">{r.appKey}</span>,
    },
    {
      header: "Version", accessorKey: "version", sortable: true,
      cell: r => <span className="font-mono text-xs">{r.version ? `v${r.version}` : "—"}</span>,
    },
    {
      header: "Venue", sortable: true,
      sortValue: r => r.restaurantName ?? "",
      searchValue: r => r.restaurantName ?? "Direct link",
      cell: r => <span className="text-sm">{r.restaurantName ?? <span className="text-muted-foreground">Direct link</span>}</span>,
    },
    {
      header: "Staff", sortable: true,
      sortValue: r => r.staffName ?? "",
      searchValue: r => r.staffName ?? "",
      cell: r => <span className="text-sm">{r.staffName ?? "—"}</span>,
    },
  ];

  function openUpload(appKey: string) {
    setForm({ ...EMPTY_FORM, appKey });
    setProgress(0);
    setDialogOpen(true);
  }

  async function submitUpload() {
    if (!form.version.trim()) {
      toast.error("Enter a version number, e.g. 1.4.0");
      return;
    }
    if (form.mode === "file" && !form.file) {
      toast.error("Choose an APK file");
      return;
    }
    if (form.mode === "link" && !/^https?:\/\//i.test(form.downloadUrl.trim())) {
      toast.error("Enter a valid https link");
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const { release } = await api.appReleases.create({
        appKey: form.appKey,
        version: form.version.trim(),
        changelog: form.changelog.trim(),
        fileName: form.file?.name,
        fileSize: form.file?.size ?? 0,
        storage: form.mode === "file" ? "db" : "link",
        downloadUrl: form.mode === "link" ? form.downloadUrl.trim() : undefined,
      });

      if (form.mode === "file" && form.file) {
        await api.appReleases.uploadFile(release.id, form.file, (sent, total) => {
          setProgress(Math.round((sent / total) * 100));
        });
      }

      await api.appReleases.publish(release.id);
      toast.success(`${form.version} is live — every restaurant will see it`);
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["app-releases"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function publish(id: number) {
    setBusyId(id);
    try {
      await api.appReleases.publish(id);
      toast.success("This version is now live");
      qc.invalidateQueries({ queryKey: ["app-releases"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    setBusyId(id);
    try {
      await api.appReleases.remove(id);
      toast.success("Build deleted");
      qc.invalidateQueries({ queryKey: ["app-releases"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleOne(restaurantId: number, appKey: string, visible: boolean) {
    // Flip it on screen straight away, then put it back if the server says no.
    qc.setQueryData(["app-releases-visibility"], (old: { restaurants: AppVisibilityRow[] } | undefined) => old && ({
      restaurants: old.restaurants.map(r => r.id === restaurantId ? { ...r, apps: { ...r.apps, [appKey]: visible } } : r),
    }));
    try {
      await api.appReleases.setVisibility(restaurantId, appKey, visible);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      qc.invalidateQueries({ queryKey: ["app-releases-visibility"] });
    }
  }

  async function toggleAll(appKey: string, visible: boolean) {
    try {
      const res = await api.appReleases.setVisibilityForAll(appKey, visible);
      toast.success(`Turned ${visible ? "on" : "off"} for ${res.updated} restaurants`);
      qc.invalidateQueries({ queryKey: ["app-releases-visibility"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <PageShell
      title="Staff App Releases"
      description="Upload an APK and publish it — every restaurant's owner panel updates on its own. Below, turn each app on or off per restaurant."
      icon={<Smartphone className="h-6 w-6" />}
      accent="violet"
      loading={releasesQuery.isLoading}
      onRefresh={() => { releasesQuery.refetch(); visibilityQuery.refetch(); downloadsQuery.refetch(); }}
      refreshing={releasesQuery.isFetching || visibilityQuery.isFetching || downloadsQuery.isFetching}
    >
      {/* ── The three apps and what is live right now ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {catalog.map(app => {
          const Icon = APP_ICON[app.appKey] ?? Smartphone;
          const live = releases.find(r => r.id === app.liveReleaseId);
          return (
            <div key={app.appKey} className="admin-card-elevated p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${APP_TINT[app.appKey] ?? ""}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate">{app.name}</h3>
                  <p className="text-xs text-muted-foreground">{app.role}</p>
                </div>
              </div>

              {live ? (
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-semibold">v{live.version}</span>
                    {statusBadge("published")}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formatSize(live.fileSize)} · {live.downloads} downloads
                    {live.publishedAt ? ` · ${new Date(live.publishedAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                  No version published yet
                </div>
              )}

              <div className="mt-auto flex items-center gap-2">
                <Button size="sm" className="rounded-xl flex-1" onClick={() => openUpload(app.appKey)}>
                  <Upload className="mr-2 h-4 w-4" /> New version
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" title="Show for all restaurants"
                  onClick={() => toggleAll(app.appKey, true)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" title="Hide for all restaurants"
                  onClick={() => toggleAll(app.appKey, false)}>
                  <EyeOff className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Which venue is running which build ── */}
      <PanelCard
        title="Which venue is on which build"
        description="Taken from what each venue actually downloaded. A version in red is behind the build that is live."
        action={
          <Button size="sm" variant="outline" className="rounded-xl" disabled={downloadsQuery.isFetching}
            onClick={() => downloadsQuery.refetch()}>
            {downloadsQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDriveDownload className="h-4 w-4" />}
            <span className="ml-1.5 hidden sm:inline">Refresh</span>
          </Button>
        }
      >
        {downloadsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : downloadsQuery.isError ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm">
              We could not read the download history.{" "}
              <span className="text-muted-foreground">
                {downloadsQuery.error instanceof Error ? downloadsQuery.error.message : ""}
              </span>
            </p>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => downloadsQuery.refetch()}>Try again</Button>
          </div>
        ) : fleet.length === 0 ? (
          <EmptyState icon={<Smartphone className="h-8 w-8" />} title="No venue has installed an app yet"
            description="Once a restaurant downloads a build from its Staff Apps page, its version shows here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium">Venue</th>
                  {catalog.map(app => (
                    <th key={app.appKey} className="px-3 py-2 text-left font-medium capitalize">
                      {app.appKey}
                      {liveVersionOf[app.appKey] && (
                        <span className="ml-1.5 font-normal opacity-60">live v{liveVersionOf[app.appKey]}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {fleet.map(venue => (
                  <tr key={venue.key}>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{venue.restaurant}</span>
                      {venue.stale.length > 0 && (
                        <Badge variant="outline" className="ml-2 gap-1 border-warning-border bg-warning-subtle text-[10px] text-warning">
                          <AlertTriangle className="h-3 w-3" /> behind
                        </Badge>
                      )}
                    </td>
                    {catalog.map(app => {
                      const got = venue.apps[app.appKey];
                      const behind = got?.version && liveVersionOf[app.appKey] && got.version !== liveVersionOf[app.appKey];
                      return (
                        <td key={app.appKey} className="px-3 py-2.5">
                          {got ? (
                            <>
                              <span className={`font-mono text-xs font-semibold ${behind ? "text-destructive" : "text-success"}`}>
                                v{got.version ?? "?"}
                              </span>
                              <span className="ml-2 text-[11px] text-muted-foreground">
                                {new Date(got.last).toLocaleDateString()} · {got.count}×
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">not installed</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      {/* ── The raw log, for when a specific install has to be traced ── */}
      <PanelCard title="Download log" description="Every install, newest first — who took which build and when.">
        <DataTable
          columns={downloadColumns}
          data={downloads}
          keyExtractor={r => r.id}
          loading={downloadsQuery.isLoading}
          error={downloadsQuery.isError ? downloadsQuery.error : undefined}
          onRetry={() => downloadsQuery.refetch()}
          errorMessage="We couldn't load the download log."
          emptyMessage="No downloads recorded yet"
          emptyDescription="This fills in as staff install the apps from their venue's Staff Apps page."
          searchable
          searchPlaceholder="Search venue, staff or version…"
          pageSize={15}
        />
      </PanelCard>

      {/* ── Every build ever uploaded ── */}
      <PanelCard title="Version history" description="The previous build is kept for rollback. A live build cannot be deleted.">
        {releases.length === 0 ? (
          <EmptyState icon={<Smartphone className="h-8 w-8" />} title="No builds uploaded yet"
            description="Pick an app above and hit 'New version'." />
        ) : (
          <div className="space-y-2">
            {releases.map(r => {
              const Icon = APP_ICON[r.appKey] ?? Smartphone;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${APP_TINT[r.appKey] ?? ""}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">v{r.version}</span>
                      {statusBadge(r.status)}
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {r.storage === "link" ? <><Link2 className="h-3 w-3" /> Link</> : <><HardDriveDownload className="h-3 w-3" /> Uploaded</>}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {r.appKey} · {formatSize(r.fileSize)} · {r.downloads} downloads
                      {r.publishedBy ? ` · ${r.publishedBy}` : ""}
                    </p>
                    {r.changelog && <p className="text-xs mt-1 line-clamp-2">{r.changelog}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status !== "published" && (
                      <Button size="sm" variant="outline" className="rounded-xl" disabled={busyId === r.id}
                        onClick={() => publish(r.id)}>
                        {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                        <span className="ml-1.5 hidden sm:inline">Publish</span>
                      </Button>
                    )}
                    {r.status !== "published" && (
                      <Button size="sm" variant="ghost" className="rounded-xl text-destructive" disabled={busyId === r.id}
                        onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PanelCard>

      {/* ── Per-restaurant show / hide ── */}
      <PanelCard
        title="Which restaurant sees which app"
        description="Switching an app off removes it from that restaurant's owner panel and disables its download link."
        action={
          <div className="relative w-56 max-w-[45vw]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search restaurants"
              className="h-9 pl-9 rounded-xl" />
          </div>
        }
      >
        {visibilityQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filteredRestaurants.length === 0 ? (
          <EmptyState icon={<Search className="h-8 w-8" />} title="No restaurant found" />
        ) : (
          <div className="space-y-2">
            {filteredRestaurants.map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-xl border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{r.name}</span>
                    {!r.isActive && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">/{r.slug} · {r.plan}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {catalog.map(app => {
                    const Icon = APP_ICON[app.appKey] ?? Smartphone;
                    const on = r.apps[app.appKey] !== false;
                    return (
                      <div key={app.appKey} className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${on ? "text-foreground" : "text-muted-foreground/40"}`} />
                        <Label className="text-xs capitalize w-20">{app.appKey}</Label>
                        <Switch checked={on} onCheckedChange={v => toggleOne(r.id, app.appKey, v)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      {/* ── Upload dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!uploading) setDialogOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">{form.appKey} app — new version</DialogTitle>
            <DialogDescription>
              Once published, this build appears for every restaurant that has this app switched on.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={form.mode === "file" ? "default" : "outline"} className="rounded-xl"
                onClick={() => setForm(f => ({ ...f, mode: "file" }))} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" /> Upload APK
              </Button>
              <Button type="button" variant={form.mode === "link" ? "default" : "outline"} className="rounded-xl"
                onClick={() => setForm(f => ({ ...f, mode: "link" }))} disabled={uploading}>
                <Link2 className="mr-2 h-4 w-4" /> Paste link
              </Button>
            </div>

            <div>
              <Label className="text-xs">Version</Label>
              <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                placeholder="1.4.0" className="h-9 mt-1 rounded-xl" disabled={uploading} />
            </div>

            {form.mode === "file" ? (
              <div>
                <Label className="text-xs">APK file</Label>
                <input ref={fileInput} type="file" accept=".apk,application/vnd.android.package-archive"
                  className="hidden"
                  onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))} />
                <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}
                  className="mt-1 w-full rounded-xl border border-dashed p-4 text-left hover:bg-muted/40 transition disabled:opacity-60">
                  {form.file ? (
                    <span className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="truncate">{form.file.name}</span>
                      <span className="text-muted-foreground shrink-0">{formatSize(form.file.size)}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Upload className="h-4 w-4" /> Click to choose an .apk file
                    </span>
                  )}
                </button>
              </div>
            ) : (
              <div>
                <Label className="text-xs">Download link</Label>
                <Input value={form.downloadUrl} onChange={e => setForm(f => ({ ...f, downloadUrl: e.target.value }))}
                  placeholder="https://…/Fastap-Kitchen.apk" className="h-9 mt-1 rounded-xl" disabled={uploading} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  If the file is hosted elsewhere (GitHub Release, Drive), paste the direct link.
                </p>
              </div>
            )}

            <div>
              <Label className="text-xs">What's new (shown to owners)</Label>
              <Textarea value={form.changelog} onChange={e => setForm(f => ({ ...f, changelog: e.target.value }))}
                rows={3} className="mt-1 rounded-xl" disabled={uploading}
                placeholder="New login screen, payment options in the waiter app, bug fixes" />
            </div>

            {uploading && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Uploading…</span>
                  <span className="font-semibold">{progress}%</span>
                </div>
                <Progress value={progress} />
                <p className="text-[11px] text-muted-foreground mt-1">Please keep this window open.</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" className="rounded-xl" disabled={uploading} onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl" disabled={uploading} onClick={submitUpload}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                Publish
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
