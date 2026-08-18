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
import { Plus, Loader2, Shield } from "lucide-react";

const ROLES = [
  { id: "super_admin", label: "Super Admin" },
  { id: "finance_admin", label: "Finance Admin" },
  { id: "support_admin", label: "Support Admin" },
  { id: "compliance_admin", label: "Compliance Admin" },
  { id: "sales_admin", label: "Sales Admin" },
  { id: "operations_admin", label: "Operations Admin" },
];

export default function Users() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "support_admin" });

  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: api.users.list });

  const createMutation = useMutation({
    mutationFn: () => api.users.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDialog(false);
      setForm({ name: "", email: "", password: "", role: "support_admin" });
      toast({ title: "Admin user created" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => api.users.update(id, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Role updated" }); },
  });

  const roleLabel = (r: string) => ROLES.find(x => x.id === r)?.label ?? r;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin Users</h2>
          <p className="text-muted-foreground">Manage platform administrators and role assignments.</p>
        </div>
        <Button onClick={() => setDialog(true)}><Plus className="mr-2 h-4 w-4" /> Add Admin</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> {users.length} users</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <DataTable data={users} columns={[
              { header: "Name", cell: (row: AdminUser) => <span className="font-medium">{row.name}</span> },
              { header: "Email", accessorKey: "email" },
              { header: "Role", cell: (row: AdminUser) => (
                <Select value={row.role} onValueChange={v => updateMutation.mutate({ id: row.id, role: v })} disabled={row.role === "super_admin"}>
                  <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              )},
              { header: "Status", cell: () => <Badge variant="outline" className="text-green-500">Active</Badge> },
              { header: "Joined", cell: (row: AdminUser) => <span className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString()}</span> },
            ]} />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending || form.password.length < 8} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
