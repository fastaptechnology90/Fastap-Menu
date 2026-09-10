import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api, type CreateVendorData, type Vendor } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { PageHeader, Toolbar } from "@/components/shared/Page";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Plus, MoreHorizontal, Eye, ShieldBan, ShieldCheck, Loader2,
  RefreshCcw, Download, KeyRound, Snowflake, Archive, Check, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PLANS = ["free", "starter", "pro", "enterprise"] as const;
const TYPES = ["Restaurant", "Hotel", "Café", "Bar", "Resort", "Cloud Kitchen"];

/** Type labels are free text on the way in, so compare case- and accent-insensitively. */
function normalizeType(v: string) {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

const isArchived = (v: Vendor) => Boolean(v.platformControls?.deletedAt);
/** A registration that has never been approved is not a suspension — it is a queue item. */
const isAwaiting = (v: Vendor) => !v.isActive && v.kycStatus === "pending" && !isArchived(v);
const isTrading = (v: Vendor) => v.isActive && !isArchived(v);
const isSuspended = (v: Vendor) => !v.isActive && !isAwaiting(v) && !isArchived(v);

type StateKey = "all" | "trading" | "awaiting" | "suspended" | "archived";

const STATE_MATCH: Record<StateKey, (v: Vendor) => boolean> = {
  all: v => !isArchived(v),
  trading: isTrading,
  awaiting: isAwaiting,
  suspended: isSuspended,
  archived: isArchived,
};

export default function Vendors() {
  const [state, setState] = useState<StateKey>("all");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<CreateVendorData>({ name: "", email: "", ownerName: "", phone: "", businessType: "Restaurant", plan: "starter" });

  const { toast } = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const qc = useQueryClient();

  // Archived venues are fetched always, so the "Archived" tab can be counted and opened
  // without a second round trip that used to make the headline numbers jump.
  const { data: vendors = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["superadmin-vendors", true],
    queryFn: () => api.vendors.list(true),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["superadmin-vendors"] });
  const onError = (e: Error) => toast({ title: "That did not go through", description: e.message, variant: "destructive" });

  const toggleMutation = useMutation({ mutationFn: (id: number) => api.vendors.toggle(id), onSuccess: () => { invalidate(); toast({ title: "Trading status updated" }); }, onError });
  const approveMutation = useMutation({
    // KYC ids are `kyc_<restaurantId>`; the route strips the prefix, so the bare id works.
    mutationFn: (id: number) => api.kyc.approve(String(id)),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["kyc"] }); toast({ title: "Venue approved", description: "The owner can now sign in." }); },
    onError,
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => api.kyc.reject(String(id), reason),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["kyc"] }); toast({ title: "Registration declined" }); },
    onError,
  });
  const planMutation = useMutation({ mutationFn: ({ id, plan }: { id: number; plan: string }) => api.vendors.updatePlan(id, plan), onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["subscriptions"] }); toast({ title: "Plan changed" }); }, onError });
  const deleteMutation = useMutation({ mutationFn: (id: number) => api.vendors.delete(id), onSuccess: () => { invalidate(); toast({ title: "Venue archived" }); }, onError });
  const restoreMutation = useMutation({ mutationFn: (id: number) => api.vendors.restore(id), onSuccess: () => { invalidate(); toast({ title: "Venue restored" }); }, onError });
  const freezeMutation = useMutation({ mutationFn: (id: number) => api.vendors.freezePayouts(id), onSuccess: () => { invalidate(); toast({ title: "Payouts frozen" }); }, onError });
  const resetPasswordMutation = useMutation({ mutationFn: (id: number) => api.vendors.resetPassword(id), onSuccess: d => toast({ title: "Password reset", description: `Temporary password: ${d.temporaryPassword}` }), onError });
  const createMutation = useMutation({
    mutationFn: (data: CreateVendorData) => api.vendors.create(data),
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setForm({ name: "", email: "", ownerName: "", phone: "", businessType: "Restaurant", plan: "starter" });
      toast({ title: "Venue created" });
    },
    onError,
  });
  const bulkMutation = useMutation({
    mutationFn: (action: string) => api.vendors.bulkAction(selected, action),
    onSuccess: (_, action) => { setSelected([]); invalidate(); toast({ title: `${action.replace("_", " ")} applied to ${selected.length} venues` }); },
    onError,
  });

  const counts = useMemo(() => ({
    all: vendors.filter(STATE_MATCH.all).length,
    trading: vendors.filter(STATE_MATCH.trading).length,
    awaiting: vendors.filter(STATE_MATCH.awaiting).length,
    suspended: vendors.filter(STATE_MATCH.suspended).length,
    archived: vendors.filter(STATE_MATCH.archived).length,
  }), [vendors]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter(v => {
      if (!STATE_MATCH[state](v)) return false;
      if (planFilter !== "all" && v.plan !== planFilter) return false;
      if (typeFilter !== "all" && normalizeType(v.businessType || "Restaurant") !== normalizeType(typeFilter)) return false;
      if (!q) return true;
      return v.name.toLowerCase().includes(q)
        || (v.ownerEmail ?? "").toLowerCase().includes(q)
        || (v.ownerName ?? "").toLowerCase().includes(q)
        || String(v.id) === q;
    });
  }, [vendors, state, planFilter, typeFilter, search]);

  const filtered = planFilter !== "all" || typeFilter !== "all" || search.trim() !== "";

  const exportCsv = () => {
    const headers = ["ID", "Venue", "Owner", "Email", "Type", "Plan", "State", "Orders", "Joined"];
    const stateLabel = (v: Vendor) => isArchived(v) ? "Archived" : isAwaiting(v) ? "Awaiting approval" : v.isActive ? "Trading" : "Suspended";
    // Venue names routinely contain commas ("Bistro, Inc"), which silently shifted every
    // later column in the exported file. Quote every cell instead.
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...rows.map(v => [v.id, v.name, v.ownerName, v.ownerEmail, v.businessType || "Restaurant", v.plan, stateLabel(v), v.totalOrders, new Date(v.createdAt).toLocaleDateString()])]
      .map(r => r.map(cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "vendors.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${rows.length} venues exported` });
  };

  const askArchive = async (v: Vendor) => {
    const ok = await confirm({
      title: `Archive ${v.name}?`,
      description: "The venue stops trading and drops off the list. Nothing is deleted — you can restore it from the Archived tab.",
      destructive: true,
      confirmLabel: "Archive venue",
    });
    if (ok) deleteMutation.mutate(v.id);
  };

  const askSuspend = async (v: Vendor) => {
    const ok = await confirm({
      title: `Suspend ${v.name}?`,
      description: "Staff are signed out and the venue stops taking orders immediately. You can reactivate it here at any time.",
      destructive: true,
      confirmLabel: "Suspend venue",
    });
    if (ok) toggleMutation.mutate(v.id);
  };

  const askReject = async (v: Vendor) => {
    const ok = await confirm({
      title: `Decline ${v.name}'s registration?`,
      description: "The owner is told their documents were not accepted and is asked to submit again.",
      destructive: true,
      confirmLabel: "Decline",
    });
    if (ok) rejectMutation.mutate({ id: v.id, reason: "Documents not accepted" });
  };

  const TABS: { key: StateKey; label: string }[] = [
    { key: "all", label: "All venues" },
    { key: "trading", label: "Trading" },
    { key: "awaiting", label: "Awaiting approval" },
    { key: "suspended", label: "Suspended" },
    { key: "archived", label: "Archived" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Every venue on the platform, what it is paying for, and whether it is trading."
        badge={<Badge variant="muted">{isLoading ? "Loading…" : `${counts.all} on platform`}</Badge>}
        actions={
          <>
            <Button variant="outline" size="icon-sm" aria-label="Refresh" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCcw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export</Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add venue</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Add a venue</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4 pt-2">
                  <div className="space-y-2"><Label htmlFor="v-name">Business name *</Label><Input id="v-name" placeholder="The Grand Hotel" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                  <div className="space-y-2"><Label htmlFor="v-owner">Owner name</Label><Input id="v-owner" placeholder="John Smith" value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="v-email">Owner email *</Label><Input id="v-email" type="email" placeholder="owner@hotel.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Business type</Label>
                      <Select value={form.businessType} onValueChange={v => setForm(f => ({ ...f, businessType: v }))}>
                        <SelectTrigger className="min-h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>{["Restaurant", "Hotel", "Café", "Bar", "Resort", "Cloud Kitchen", "Lounge", "Food Court"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Plan</Label>
                      <Select value={form.plan} onValueChange={v => setForm(f => ({ ...f, plan: v }))}>
                        <SelectTrigger className="min-h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>{PLANS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="v-phone">Phone</Label><Input id="v-phone" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create venue
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {/* The state of the estate, as one row of controls rather than a row of tiles that
          restate what the table already shows. Every number here is a filter. */}
      <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain border-b pb-3 no-scrollbar">
        {TABS.map(t => {
          const on = state === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setState(t.key); setSelected([]); }}
              aria-pressed={on}
              className={on
                ? "flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-foreground"
                : "flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-muted-foreground hover:bg-muted"}
            >
              {t.label}
              <span className="tabular-nums text-xs font-semibold">{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      {counts.awaiting > 0 && state !== "awaiting" && (
        <div className="flex flex-col gap-3 rounded-md border border-warning-border bg-warning-subtle px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="min-w-0 text-sm text-warning">
            <span className="font-semibold">{counts.awaiting} {counts.awaiting === 1 ? "venue is" : "venues are"} waiting to be approved.</span>{" "}
            Their owners cannot sign in until you do.
          </p>
          <Button variant="outline" size="sm" className="w-full sm:ml-auto sm:w-auto" onClick={() => setState("awaiting")}>Review them</Button>
        </div>
      )}

      <Toolbar>
        <div className="relative w-full min-w-0 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search venue, owner, email or id…" className="min-h-10 pl-8" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search venues" />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="min-h-10 w-full sm:w-[130px]" aria-label="Filter by plan"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any plan</SelectItem>
            {PLANS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="min-h-10 w-full sm:w-[140px]" aria-label="Filter by type"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any type</SelectItem>
            {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="ghost" size="sm" className="min-h-10" onClick={() => { setSearch(""); setPlanFilter("all"); setTypeFilter("all"); }}>Clear</Button>
        )}
        <span className="w-full text-sm text-muted-foreground tabular-nums sm:ml-auto sm:w-auto">{rows.length} shown</span>
      </Toolbar>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate("activate")}>Activate</Button>
            <Button size="sm" variant="outline" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate("suspend")}>Suspend</Button>
            <Button size="sm" variant="outline" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate("freeze_payouts")}>Freeze payouts</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Cancel</Button>
          </div>
        </div>
      )}

      <DataTable
        data={rows}
        pageSize={15}
        loading={isLoading}
        error={isError}
        onRetry={() => { void refetch(); }}
        errorMessage="We could not load the venue list."
        keyExtractor={v => v.id}
        emptyMessage={filtered ? "No venues match those filters" : state === "awaiting" ? "Nothing waiting for approval" : "No venues yet"}
        emptyDescription={filtered ? "Clear the search or filters to see the rest." : "Venues appear here once they register or you add one."}
        columns={[
          {
            header: (
              <Checkbox
                aria-label="Select all venues"
                checked={rows.length > 0 && selected.length === rows.length}
                onCheckedChange={() => setSelected(selected.length === rows.length ? [] : rows.map(v => v.id))}
              />
            ),
            cell: v => (
              <Checkbox
                aria-label={`Select ${v.name}`}
                checked={selected.includes(v.id)}
                onCheckedChange={() => setSelected(p => p.includes(v.id) ? p.filter(x => x !== v.id) : [...p, v.id])}
                onClick={e => e.stopPropagation()}
              />
            ),
          },
          {
            header: "Venue",
            sortable: true,
            sortValue: v => v.name,
            searchValue: v => v.name,
            cell: v => (
              <div className="min-w-0">
                <Link href={`/vendors/${v.id}`} className="font-medium hover:text-primary hover:underline">{v.name}</Link>
                <p className="truncate text-xs text-muted-foreground">
                  #{v.id} · {v.businessType || "Restaurant"}{v.ownerName ? ` · ${v.ownerName}` : ""}
                </p>
              </div>
            ),
          },
          { header: "Owner email", cell: v => <span className="text-xs text-muted-foreground">{v.ownerEmail || "—"}</span> },
          {
            header: "Plan",
            sortable: true,
            sortValue: v => v.plan,
            cell: v => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="rounded-md" aria-label={`Change plan for ${v.name}, currently ${v.plan}`}>
                    <Badge variant="outline" className="capitalize hover:bg-muted">{v.plan}</Badge>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Move to plan</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {PLANS.map(p => (
                    <DropdownMenuItem key={p} disabled={p === v.plan || planMutation.isPending} className="capitalize" onClick={() => planMutation.mutate({ id: v.id, plan: p })}>
                      {p}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
          {
            header: "State",
            sortable: true,
            sortValue: v => isArchived(v) ? 3 : isAwaiting(v) ? 0 : v.isActive ? 1 : 2,
            cell: v => (
              <div className="flex items-center gap-1.5">
                <StatusBadge status={isArchived(v) ? "Archived" : isAwaiting(v) ? "Awaiting approval" : v.isActive ? "Trading" : "Suspended"} />
                {v.payoutsFrozen && <Badge variant="warning" title="Payouts are frozen for this venue"><Snowflake /> Frozen</Badge>}
              </div>
            ),
          },
          { header: "Orders", sortable: true, sortValue: v => v.totalOrders ?? 0, cell: v => <span className="tabular-nums">{(v.totalOrders ?? 0).toLocaleString()}</span> },
          { header: "Joined", sortable: true, sortValue: v => new Date(v.createdAt), cell: v => <span className="text-xs text-muted-foreground tabular-nums">{new Date(v.createdAt).toLocaleDateString()}</span> },
          {
            header: "",
            cell: v => (
              <div className="flex items-center justify-end gap-1">
                {/* The one decision this screen exists to make is surfaced as a real button
                    rather than hidden two clicks deep in a kebab. */}
                {isAwaiting(v) && (
                  <>
                    <Button size="sm" className="h-8" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(v.id)}>
                      <Check className="mr-1 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => askReject(v)}>
                      <X className="mr-1 h-3.5 w-3.5" /> Decline
                    </Button>
                  </>
                )}
                {isArchived(v) && (
                  <Button size="sm" variant="outline" className="h-8" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate(v.id)}>
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Restore
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${v.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/vendors/${v.id}`} className="flex cursor-pointer items-center"><Eye className="mr-2 h-4 w-4" /> Open profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {!isArchived(v) && (
                      <>
                        {v.isActive
                          ? <DropdownMenuItem className="text-destructive" onClick={() => askSuspend(v)}><ShieldBan className="mr-2 h-4 w-4" /> Suspend</DropdownMenuItem>
                          : <DropdownMenuItem onClick={() => toggleMutation.mutate(v.id)}><ShieldCheck className="mr-2 h-4 w-4" /> Reactivate</DropdownMenuItem>}
                        {/* Freezing is one-way on the API side, so re-clicking it on an
                            already frozen venue did nothing but pop a success toast. */}
                        <DropdownMenuItem disabled={Boolean(v.payoutsFrozen)} onClick={() => freezeMutation.mutate(v.id)}>
                          <Snowflake className="mr-2 h-4 w-4" /> {v.payoutsFrozen ? "Payouts already frozen" : "Freeze payouts"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => resetPasswordMutation.mutate(v.id)}><KeyRound className="mr-2 h-4 w-4" /> Reset owner password</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => askArchive(v)}><Archive className="mr-2 h-4 w-4" /> Archive venue</DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          },
        ]}
      />
      {confirmDialog}
    </div>
  );
}
