import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { rbacApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save, RotateCcw, Check, X, Users, Lock, Plus, ChevronDown, Crown, Building2, CreditCard, UtensilsCrossed, ChefHat, Puzzle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PERMISSION_GROUPS = [
  { group:"Orders", permissions:[
    {key:"view_orders",label:"View Orders"},
    {key:"create_orders",label:"Create Orders"},
    {key:"edit_orders",label:"Edit/Modify Orders"},
    {key:"cancel_orders",label:"Cancel Orders"},
    {key:"apply_discount",label:"Apply Discounts"},
    {key:"void_item",label:"Void Items"},
  ]},
  { group:"Menu", permissions:[
    {key:"view_menu",label:"View Menu"},
    {key:"edit_menu",label:"Edit Menu Items"},
    {key:"add_menu_item",label:"Add New Items"},
    {key:"delete_menu_item",label:"Delete Items"},
    {key:"change_price",label:"Change Prices"},
    {key:"toggle_availability",label:"Toggle Item Availability"},
  ]},
  { group:"Billing & Payments", permissions:[
    {key:"view_billing",label:"View Bills"},
    {key:"process_payment",label:"Process Payments"},
    {key:"issue_refund",label:"Issue Refunds"},
    {key:"open_cash_drawer",label:"Open Cash Drawer"},
    {key:"view_transactions",label:"View Transactions"},
    {key:"settlement_reports",label:"Settlement Reports"},
  ]},
  { group:"Staff", permissions:[
    {key:"view_staff",label:"View Staff"},
    {key:"add_staff",label:"Add Staff"},
    {key:"edit_staff",label:"Edit Staff"},
    {key:"delete_staff",label:"Remove Staff"},
    {key:"view_attendance",label:"View Attendance"},
    {key:"manage_schedule",label:"Manage Schedule"},
  ]},
  { group:"Reports & Analytics", permissions:[
    {key:"view_analytics",label:"View Analytics"},
    {key:"export_reports",label:"Export Reports"},
    {key:"view_finance",label:"View Finance Reports"},
    {key:"view_payroll",label:"View Payroll"},
  ]},
  { group:"Settings", permissions:[
    {key:"restaurant_settings",label:"Restaurant Settings"},
    {key:"manage_tables",label:"Manage Tables"},
    {key:"manage_integrations",label:"Manage Integrations"},
    {key:"manage_roles",label:"Manage Roles (Super)"},
    {key:"audit_logs",label:"View Audit Logs"},
    {key:"system_config",label:"System Configuration"},
  ]},
];

const DEFAULT_ROLES: Record<string,Record<string,boolean>> = {
  owner: Object.fromEntries(PERMISSION_GROUPS.flatMap(g=>g.permissions.map(p=>[p.key,true]))),
  manager: Object.fromEntries(PERMISSION_GROUPS.flatMap(g=>g.permissions.map(p=>[p.key,!["delete_menu_item","manage_roles","system_config","view_payroll"].includes(p.key)]))),
  cashier: Object.fromEntries(PERMISSION_GROUPS.flatMap(g=>g.permissions.map(p=>[p.key,["view_orders","view_billing","process_payment","open_cash_drawer","view_transactions","view_menu","toggle_availability"].includes(p.key)]))),
  waiter: Object.fromEntries(PERMISSION_GROUPS.flatMap(g=>g.permissions.map(p=>[p.key,["view_orders","create_orders","view_menu","toggle_availability"].includes(p.key)]))),
  kitchen: Object.fromEntries(PERMISSION_GROUPS.flatMap(g=>g.permissions.map(p=>[p.key,["view_orders","view_menu"].includes(p.key)]))),
  chef: Object.fromEntries(PERMISSION_GROUPS.flatMap(g=>g.permissions.map(p=>[p.key,["view_orders","view_menu","edit_menu","add_menu_item","toggle_availability"].includes(p.key)]))),
};

const ROLE_CFG: Record<string,{label:string;icon:LucideIcon;color:string;bg:string}> = {
  owner:   {label:"Owner",     icon:Crown,color:"text-warning",bg:"bg-warning-subtle"},
  manager: {label:"Manager",   icon:Building2,color:"text-muted-foreground",bg:"bg-muted"},
  cashier: {label:"Cashier",   icon:CreditCard,color:"text-info",  bg:"bg-info-subtle"},
  waiter:  {label:"Waiter",    icon:UtensilsCrossed,color:"text-warning",bg:"bg-warning-subtle"},
  kitchen: {label:"Kitchen",   icon:ChefHat,color:"text-primary", bg:"bg-primary/15"},
  chef:    {label:"Chef",      icon:ChefHat,color:"text-primary", bg:"bg-primary/15"},
};

// Config for any role not in ROLE_CFG (loaded backend roles + user-created custom roles),
// so saved roles remain visible and editable after reload.
function roleCfg(role: string): { label: string; icon: LucideIcon; color: string; bg: string } {
  if (ROLE_CFG[role]) return ROLE_CFG[role];
  const label = role.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return { label, icon: Puzzle, color: "text-success", bg: "bg-success-subtle" };
}

export default function RBACPermissions() {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Record<string, Record<string, boolean>>>(DEFAULT_ROLES);
  const [selectedRole, setSelectedRole] = useState("manager");
  const [saved, setSaved] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(PERMISSION_GROUPS.map(g=>g.group)));
  const [showAdd, setShowAdd] = useState(false);
  const [newRole, setNewRole] = useState({ name:"", copyFrom:"waiter" });

  useEffect(()=>{
    if(!restaurantId)return;
    rbacApi.get(restaurantId).then(d=>{
      if(d?.permissions) setRoles(prev=>({...prev,...d.permissions}));
      // Falling back to the built-in defaults without saying so would show an
      // owner permissions their staff do not actually have.
    }).catch(e => toast({ title: "Showing default permissions", description: e instanceof Error ? e.message : "Your saved roles could not be loaded.", variant: "destructive" }));
  },[restaurantId]);

  function toggle(role:string, perm:string) {
    if(role==="owner")return;
    setRoles(r=>({...r,[role]:{...r[role],[perm]:!r[role]?.[perm]}}));
  }

  function toggleGroup(role:string, group:typeof PERMISSION_GROUPS[0]) {
    if(role==="owner")return;
    const allOn = group.permissions.every(p=>roles[role]?.[p.key]);
    setRoles(r=>{
      const updated={...r[role]};
      group.permissions.forEach(p=>{updated[p.key]=!allOn;});
      return {...r,[role]:updated};
    });
  }

  function toggleGroupExpand(group:string) {
    setExpandedGroups(prev=>{const n=new Set(prev);n.has(group)?n.delete(group):n.add(group);return n;});
  }

  async function savePermissions() {
    if(!restaurantId)return;
    try {
      await rbacApi.updateAll(restaurantId, roles);
      setSaved(true); setTimeout(()=>setSaved(false),2000);
      toast({ title: "Permissions saved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message || "Could not save permissions." });
    }
  }

  function resetRole() {
    if(selectedRole==="owner")return;
    // Built-in roles reset to their defaults; custom roles reset to no access.
    const allOff = Object.fromEntries(PERMISSION_GROUPS.flatMap(g=>g.permissions.map(p=>[p.key,false])));
    setRoles(r=>({...r,[selectedRole]:{...(DEFAULT_ROLES[selectedRole]||allOff)}}));
  }

  const allRoles = Object.keys(roles);
  const currentRolePerms = roles[selectedRole] || {};
  const enabledCount = Object.values(currentRolePerms).filter(Boolean).length;
  const totalPerms = PERMISSION_GROUPS.reduce((s,g)=>s+g.permissions.length,0);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">RBAC Permissions</h1>
          <p className="text-xs text-muted-foreground">Role-based access control for restaurant staff</p>
        </div>
        <div className="flex gap-2">
          <button onClick={resetRole} disabled={selectedRole==="owner"} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted hover-elevate text-sm font-semibold disabled:opacity-30 transition-colors">
            <RotateCcw className="h-4 w-4"/>Reset
          </button>
          <button onClick={savePermissions} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${saved?"bg-success text-background":"bg-primary hover:bg-primary/90 text-primary-foreground"}`}>
            {saved?<><Check className="h-4 w-4"/>Saved!</>:<><Save className="h-4 w-4"/>Save Changes</>}
          </button>
        </div>
      </div>

      {/* Role Selector */}
      <div className="flex gap-2 flex-wrap">
        {allRoles.map((role)=>{
          const cfg = roleCfg(role);
          const count = Object.values(roles[role]||{}).filter(Boolean).length;
          return (
            <button key={role} onClick={()=>setSelectedRole(role)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${selectedRole===role?`${cfg.bg} border-border ${cfg.color}`:"border-border bg-muted text-muted-foreground hover:border-border"}`}>
              <cfg.icon className="h-4 w-4" />
              <span>{cfg.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full bg-muted ${selectedRole===role?cfg.color:"text-muted-foreground"}`}>{count}</span>
            </button>
          );
        })}
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:border-border hover:text-muted-foreground text-sm font-semibold transition-colors">
          <Plus className="h-4 w-4"/>Custom Role
        </button>
      </div>

      {/* Role Info */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-lg ${roleCfg(selectedRole).bg} ${roleCfg(selectedRole).color} flex items-center justify-center`}>{(() => { const RoleIcon = roleCfg(selectedRole).icon; return <RoleIcon className="h-6 w-6" />; })()}</div>
          <div>
            <p className="font-semibold">{roleCfg(selectedRole).label} Role</p>
            <p className="text-xs text-muted-foreground">{enabledCount} of {totalPerms} permissions enabled</p>
          </div>
        </div>
        <div className="w-32">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Access</span>
            <span>{Math.round((enabledCount/totalPerms)*100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full bg-primary`} style={{width:`${(enabledCount/totalPerms)*100}%`}}/>
          </div>
        </div>
        {selectedRole==="owner"&&<div className="text-xs text-warning bg-warning-subtle px-3 py-1.5 rounded-full font-semibold flex items-center gap-1"><Lock className="h-3 w-3"/>Owner (all access — locked)</div>}
      </div>

      {/* Permissions */}
      <div className="space-y-3">
        {PERMISSION_GROUPS.map(group=>{
          const allOn = group.permissions.every(p=>currentRolePerms[p.key]);
          const someOn = group.permissions.some(p=>currentRolePerms[p.key]);
          const expanded = expandedGroups.has(group.group);
          return (
            <div key={group.group} className="bg-card border border-border rounded-lg overflow-hidden">
              <button onClick={()=>toggleGroupExpand(group.group)} className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${allOn?"bg-success":someOn?"bg-warning":"bg-muted"}`}/>
                  <span className="font-semibold">{group.group}</span>
                  <span className="text-xs text-muted-foreground">{group.permissions.filter(p=>currentRolePerms[p.key]).length}/{group.permissions.length}</span>
                </div>
                <div className="flex items-center gap-3">
                  {selectedRole!=="owner"&&(
                    <button onClick={e=>{e.stopPropagation();toggleGroup(selectedRole,group);}} className={`text-xs px-3 py-1 rounded-lg border font-semibold transition-colors ${allOn?"border-danger-border bg-danger-subtle text-danger hover-elevate":"border-success-border bg-success-subtle text-success hover-elevate"}`}>
                      {allOn?"Disable All":"Enable All"}
                    </button>
                  )}
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded?"rotate-180":""}`}/>
                </div>
              </button>
              {expanded&&(
                <div className="border-t border-border px-4 py-3">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {group.permissions.map(perm=>{
                      const enabled = currentRolePerms[perm.key] || false;
                      const locked = selectedRole==="owner";
                      return (
                        <button key={perm.key} onClick={()=>toggle(selectedRole,perm.key)} disabled={locked} className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition-colors ${enabled?"border-success-border bg-success-subtle":"border-border bg-card hover:border-border"} ${locked?"cursor-not-allowed opacity-70":""}`}>
                          <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 transition-colors ${enabled?"bg-success border-success-border":"border border-border bg-transparent"}`}>
                            {enabled&&<Check className="h-2.5 w-2.5 text-foreground"/>}
                          </div>
                          <span className={`text-xs font-medium leading-tight ${enabled?"text-foreground":"text-muted-foreground"}`}>{perm.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All Roles Summary */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold mb-4">All Roles — Permission Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="pb-3 pr-4">Permission</th>
                {allRoles.map(r=><th key={r} className="pb-3 px-2 text-center capitalize">{roleCfg(r).label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PERMISSION_GROUPS.flatMap(g=>g.permissions).slice(0,12).map(perm=>(
                <tr key={perm.key} className="hover:bg-muted">
                  <td className="py-2 pr-4 text-muted-foreground">{perm.label}</td>
                  {allRoles.map(r=>(
                    <td key={r} className="py-2 px-2 text-center">
                      {roles[r]?.[perm.key] ? <Check className="h-3.5 w-3.5 text-success mx-auto"/> : <X className="h-3.5 w-3.5 text-muted-foreground mx-auto"/>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd&&(
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">Create Custom Role</h2>
              <button onClick={()=>setShowAdd(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Role Name</label>
                <input value={newRole.name} onChange={e=>setNewRole(p=>({...p,name:e.target.value}))} placeholder="e.g. Supervisor, Barista..." className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Copy permissions from</label>
                <select value={newRole.copyFrom} onChange={e=>setNewRole(p=>({...p,copyFrom:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground">
                  {allRoles.map((r)=><option key={r} value={r}>{roleCfg(r).label}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
                <button onClick={()=>{
                  if(!newRole.name)return;
                  const key=newRole.name.toLowerCase().replace(/\s+/g,"-");
                  setRoles(r=>({...r,[key]:{...r[newRole.copyFrom]||{}}}));
                  setSelectedRole(key);
                  setShowAdd(false);
                  setNewRole({name:"",copyFrom:"waiter"});
                }} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm">Create Role</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
