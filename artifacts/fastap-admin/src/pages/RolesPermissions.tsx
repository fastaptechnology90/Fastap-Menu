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
import { ShieldCheck, Save, Loader2, Plus, X, UserPlus, FilePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Roles &amp; Permissions</h2>
          <p className="text-muted-foreground">Control which team can access which pages. Toggle a page on/off, then Save.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddTeam(true)}><UserPlus className="h-4 w-4 mr-1" /> Add team</Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddPage(true)}><FilePlus className="h-4 w-4 mr-1" /> Add page</Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <p className="font-medium text-sm">Super Admin</p>
            <p className="text-xs text-muted-foreground">Always has full access to every page — not editable. Configure the other teams below.</p>
          </div>
        </CardContent>
      </Card>

      {/* Role selector */}
      <div className="flex flex-wrap gap-2">
        {allRoles.map(role => (
          <div key={role} className="relative group">
            <button
              onClick={() => setActiveRole(role)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${activeRole === role ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
            >
              {roleLabel(role)}
              <Badge variant="secondary" className="text-[10px]">{config[role]?.length ?? 0}</Badge>
              {!isBuiltInRole(role) && <span className="text-[9px] uppercase tracking-wide text-amber-500 font-bold">new</span>}
            </button>
            {!isBuiltInRole(role) && (
              <button onClick={() => removeTeam(role)} title="Remove team" className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white items-center justify-center hidden group-hover:flex">
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
                        <button onClick={() => removePage(item.href)} title="Remove page" className="text-red-400 hover:text-red-500"><X className="h-3 w-3" /></button>
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
      {showAddTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddTeam(false)}>
          <Card className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add new team</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <input autoFocus value={newTeamName} onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addTeam(); }} placeholder="Team name (e.g. Digital Marketing)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <p className="text-xs text-muted-foreground">A new team starts with no page access — toggle the pages it should see, then Save changes.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddTeam(false)}>Cancel</Button>
                <Button size="sm" onClick={addTeam}><Plus className="h-4 w-4 mr-1" /> Add team</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add page modal */}
      {showAddPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddPage(false)}>
          <Card className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FilePlus className="h-4 w-4" /> Add new page</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <input autoFocus value={newPageTitle} onChange={e => setNewPageTitle(e.target.value)} placeholder="Page name (e.g. Blog)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={newPagePath} onChange={e => setNewPagePath(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addPage(); }} placeholder="Path (optional, e.g. /blog)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <p className="text-xs text-muted-foreground">The page appears under "Custom Pages" and can be toggled on/off per team.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddPage(false)}>Cancel</Button>
                <Button size="sm" onClick={addPage}><Plus className="h-4 w-4 mr-1" /> Add page</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
