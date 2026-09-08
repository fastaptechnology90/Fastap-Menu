import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { api, type AdminUser } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Shield, Search } from "lucide-react";

const ROLES = [
  { id: "super_admin", label: "Super Admin" },
  { id: "finance_admin", label: "Finance Admin" },
  { id: "support_admin", label: "Support Admin" },
  { id: "compliance_admin", label: "Compliance Admin" },
  { id: "sales_admin", label: "Sales Admin" },
  { id: "operations_admin", label: "Operations Admin" },
];

// The users endpoint returns every account in the system, restaurant owners and staff
// included. Only the platform's own admin roles belong on this screen — showing a
// restaurant account here with a platform-role dropdown would let one click promote a
// restaurant owner into platform staff.
const PLATFORM_ROLE_IDS = new Set(ROLES.map(r => r.id));

export default function Users() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "support_admin" });

  const { data: allUsers = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: api.users.list });

  const adminUsers = allUsers.filter(u => PLATFORM_ROLE_IDS.has(u.role));

  const users = adminUsers.filter(u => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const createMutation = useMutation({
    mutationFn: () => api.users.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDialog(false);
      setForm({ name: "", email: "", password: "", role: "support_admin" });
      toast({ title: "Admin user created" });
    },
    onError: (e: Error) => toast({ title: "Could not create admin", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => api.users.update(id, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Role updated" }); },
    // Without this the API rejecting a role change looked identical to it succeeding.
    onError: (e: Error) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Role not changed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin Users</h2>
          <p className="text-muted-foreground">Platform staff accounts and their role assignments.</p>
        </div>
        <Button onClick={() => setDialog(true)}><Plus className="mr-2 h-4 w-4" /> Add Admin</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> {adminUsers.length} platform admins</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name or email" className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <>
              <DataTable data={users} columns={[
                { header: "Name", cell: (row: AdminUser) => <span className="font-medium">{row.name}</span> },
                { header: "Email", accessorKey: "email" },
                { header: "Role", cell: (row: AdminUser) => (
                  <Select
                    value={row.role}
                    onValueChange={v => { if (v !== row.role) updateMutation.mutate({ id: row.id, role: v }); }}
                    disabled={row.role === "super_admin" || updateMutation.isPending}
                  >
                    <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.filter(r => r.id !== "super_admin" || row.role === "super_admin").map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )},
                { header: "Joined", cell: (row: AdminUser) => <span className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString()}</span> },
              ]} />
              <p className="text-xs text-muted-foreground mt-3">
                Platform staff only. Restaurant owners and their staff are a separate role system, managed from the restaurant.
              </p>
              {users.length === 0 && adminUsers.length > 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">No admin matches that search.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Admin User</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Password (min 8)</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.filter(r => r.id !== "super_admin").map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              This creates a platform staff account. Restaurant owners and their staff are created from the restaurant side.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending || !form.name.trim() || !form.email.trim() || form.password.length < 8} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
