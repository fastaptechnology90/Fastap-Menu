import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared/Icon";
import { api, type RolePermissionsConfig } from "@/lib/apiClient";
import { adminNavGroups } from "@/config/adminNav";
import { MANAGEABLE_ADMIN_ROLES, ADMIN_ROLE_LABELS, defaultRolePages, setAdminPageOverrides } from "@/lib/adminRbac";
import { ShieldCheck, Save, Loader2, Plus, X, UserPlus, FilePlus, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/Page";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Team = { key: string; label: string };
type Page = { href: string; title: string; group?: string };

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export default function RolesPermissions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeRole, setActiveRole] = useState(MANAGEABLE_ADMIN_ROLES[0]);
  const [config, setConfig] = useState<Record<string, string[]>>({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddPage, setShowAddPage] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPagePath, setNewPagePath] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["role-permissions"], queryFn: api.rolePermissions.get });

  const allRoles = [...MANAGEABLE_ADMIN_ROLES, ...teams.map(t => t.key)];
  const roleLabel = (r: string) => ADMIN_ROLE_LABELS[r] ?? teams.find(t => t.key === r)?.label ?? r;
  const isBuiltInRole = (r: string) => MANAGEABLE_ADMIN_ROLES.includes(r);

  // Built-in nav groups + a synthetic group for any custom pages the admin added.
  const groups = [
    ...adminNavGroups,
    ...(pages.length ? [{ title: "CUSTOM PAGES", items: pages.map(p => ({ title: p.title, href: p.href, icon: "description" })) }] : []),
  ];
  const allHrefs = groups.flatMap(g => g.items.map(i => i.href));

  useEffect(() => {
    if (!data) return;
    const savedTeams = data.teams ?? [];
    const savedPages = data.pages ?? [];
    setTeams(savedTeams);
    setPages(savedPages);
    const saved = data.roles ?? {};
    const next: Record<string, string[]> = {};
    for (const role of MANAGEABLE_ADMIN_ROLES) next[role] = saved[role] ?? defaultRolePages(role);
    for (const t of savedTeams) next[t.key] = saved[t.key] ?? [];
    setConfig(next);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: RolePermissionsConfig = { roles: config, teams, pages };
      return api.rolePermissions.save(payload);
    },
    onSuccess: (res) => {
      setAdminPageOverrides(res.roles);
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      toast({ title: "Permissions saved" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const allowed = new Set(config[activeRole] ?? []);
  const totalPages = allHrefs.length;

  function togglePage(href: string, on: boolean) {
    setConfig(prev => {
      const set = new Set(prev[activeRole] ?? []);
      if (on) set.add(href); else set.delete(href);
      return { ...prev, [activeRole]: [...set] };
    });
  }
  function setAll(on: boolean) {
    setConfig(prev => ({ ...prev, [activeRole]: on ? [...allHrefs] : [] }));
  }

  function addTeam() {
    const label = newTeamName.trim();
    if (!label) return;
    let key = slugify(label);
    if (!key) key = `team_${teams.length + 1}`;
    // ensure unique against built-ins and existing teams
    if (allRoles.includes(key)) { let n = 2; while (allRoles.includes(`${key}_${n}`)) n++; key = `${key}_${n}`; }
    setTeams(prev => [...prev, { key, label }]);
    setConfig(prev => ({ ...prev, [key]: [] }));
    setActiveRole(key);
    setNewTeamName("");
    setShowAddTeam(false);
  }

  function addPage() {
    const title = newPageTitle.trim();
    if (!title) return;
    let href = newPagePath.trim();
    if (!href) href = `/custom-${slugify(title)}`;
    if (!href.startsWith("/")) href = `/${href}`;
    if (allHrefs.includes(href)) { toast({ title: "That page path already exists", variant: "destructive" }); return; }
    setPages(prev => [...prev, { href, title, group: "CUSTOM PAGES" }]);
    setNewPageTitle("");
    setNewPagePath("");
    setShowAddPage(false);
  }

  function removeTeam(key: string) {
    setTeams(prev => prev.filter(t => t.key !== key));
    setConfig(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (activeRole === key) setActiveRole(MANAGEABLE_ADMIN_ROLES[0]);
  }
  function removePage(href: string) {
    setPages(prev => prev.filter(p => p.href !== href));
    setConfig(prev => {
      const n: Record<string, string[]> = {};
      for (const [r, list] of Object.entries(prev)) n[r] = list.filter(h => h !== href);
      return n;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Choose which pages each team sees in the navigation. Toggle a page on or off, then save."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowAddTeam(true)}><UserPlus className="h-4 w-4 mr-1" /> Add team</Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddPage(true)}><FilePlus className="h-4 w-4 mr-1" /> Add page</Button>
          </>
        }
      />

      <Card>
        <CardContent className="flex items-start gap-3 py-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
          <div>
            <p className="text-sm font-medium">Super Admin</p>
            <p className="text-xs text-muted-foreground">Always has full access to every page — not editable. Configure the other teams below.</p>
          </div>
        </CardContent>
      </Card>

      {/* What these toggles do, and what they do not. The saved list drives the
          navigation and the in-app route guards; the API enforces its own coarser
          module permissions (finance / support / kyc / platform …) and does not read
          this list, so revoking a page here hides it without closing the endpoint
          behind it to a session that already holds the cookie. */}
      <Card className="border-warning-border bg-warning-subtle">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium">These toggles control the navigation, not the API</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Turning a page off removes it from the menu and blocks in-app navigation to it.
              The server still enforces its own module-level permissions, which are the ones
              that actually stop a request — so this is a tidiness control, not a security boundary.
            </p>
          </div>
        </CardContent>
      </Card>

      {(teams.length > 0 || pages.length > 0) && (
        <Card className="border-warning-border bg-warning-subtle">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Custom teams and pages are saved, but not yet wired up.</p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc pl-4">
                {teams.length > 0 && <li>An admin account cannot be put on a custom team yet — Admin Users only accepts the six built-in roles.</li>}
                {pages.length > 0 && <li>A custom page has no screen behind it, so opening its path lands back on the dashboard.</li>}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role selector */}
      <div className="flex flex-wrap gap-2">
        {allRoles.map(role => (
          <div key={role} className="relative group">
            <button
              onClick={() => setActiveRole(role)}
              className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${activeRole === role ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover-elevate"}`}
            >
              {roleLabel(role)}
              <Badge variant="muted">{config[role]?.length ?? 0}</Badge>
              {!isBuiltInRole(role) && <span className="text-2xs font-medium uppercase tracking-wide text-warning">new</span>}
            </button>
            {!isBuiltInRole(role) && (
              <button onClick={() => removeTeam(role)} title="Remove team" className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-danger text-white group-hover:flex">
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{roleLabel(activeRole)}</span> can access <span className="font-semibold text-foreground">{allowed.size}</span> of {totalPages} pages
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAll(true)}>Enable all</Button>
          <Button variant="outline" size="sm" onClick={() => setAll(false)}>Disable all</Button>
          <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save changes
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(group => (
            <Card key={group.title}>
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{group.title}</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {group.items.map(item => (
                  <div key={item.href} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Icon name={item.icon} size={18} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{item.title}</span>
                      {group.title === "CUSTOM PAGES" && (
                        <button onClick={() => removePage(item.href)} title="Remove page" className="text-danger hover:text-danger"><X className="h-3 w-3" /></button>
                      )}
                    </div>
                    <Switch checked={allowed.has(item.href)} onCheckedChange={(v) => togglePage(item.href, v)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add team modal */}
      <Dialog open={showAddTeam} onOpenChange={setShowAddTeam}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add new team</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input autoFocus value={newTeamName} onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addTeam(); }} placeholder="Team name (e.g. Digital Marketing)" aria-label="Team name" />
            <p className="text-xs text-muted-foreground">A new team starts with no page access — toggle the pages it should see, then save changes.</p>
            <p className="text-xs text-warning">The team is saved, but no admin account can be assigned to it yet — Admin Users only accepts the six built-in roles.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddTeam(false)}>Cancel</Button>
            <Button size="sm" onClick={addTeam}><Plus className="mr-1 h-4 w-4" /> Add team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add page modal */}
      <Dialog open={showAddPage} onOpenChange={setShowAddPage}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FilePlus className="h-4 w-4" /> Add new page</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input autoFocus value={newPageTitle} onChange={e => setNewPageTitle(e.target.value)} placeholder="Page name (e.g. Blog)" aria-label="Page name" />
            <Input value={newPagePath} onChange={e => setNewPagePath(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addPage(); }} placeholder="Path (optional, e.g. /blog)" aria-label="Page path" />
            <p className="text-xs text-muted-foreground">The page appears under “Custom pages” and can be toggled on or off per team.</p>
            <p className="text-xs text-warning">This records the path only. There is no screen behind it yet, so opening it lands back on the dashboard.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddPage(false)}>Cancel</Button>
            <Button size="sm" onClick={addPage}><Plus className="mr-1 h-4 w-4" /> Add page</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
