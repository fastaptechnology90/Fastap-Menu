import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { rbacApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save, RotateCcw, Check, X, Users, Lock, Plus, ChevronDown } from "lucide-react";

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

const ROLE_CFG: Record<string,{label:string;icon:string;color:string;bg:string}> = {
  owner:   {label:"Owner",     icon:"👑",color:"text-yellow-400",bg:"bg-yellow-500/15"},
  manager: {label:"Manager",   icon:"🏢",color:"text-violet-400",bg:"bg-violet-500/15"},
  cashier: {label:"Cashier",   icon:"💳",color:"text-blue-400",  bg:"bg-blue-500/15"},
  waiter:  {label:"Waiter",    icon:"🍽️",color:"text-orange-400",bg:"bg-orange-500/15"},
  kitchen: {label:"Kitchen",   icon:"🍳",color:"text-amber-400", bg:"bg-amber-500/15"},
  chef:    {label:"Chef",      icon:"👨‍🍳",color:"text-amber-400", bg:"bg-amber-500/15"},
};

// Config for any role not in ROLE_CFG (loaded backend roles + user-created custom roles),
// so saved roles remain visible and editable after reload.
function roleCfg(role: string): { label: string; icon: string; color: string; bg: string } {
  if (ROLE_CFG[role]) return ROLE_CFG[role];
  const label = role.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return { label, icon: "🧩", color: "text-teal-400", bg: "bg-teal-500/15" };
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
    }).catch(()=>{});
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">RBAC Permissions</h1>
          <p className="text-xs text-white/40">Role-based access control for restaurant staff</p>
        </div>
        <div className="flex gap-2">
          <button onClick={resetRole} disabled={selectedRole==="owner"} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold disabled:opacity-30 transition-all">
            <RotateCcw className="h-4 w-4"/>Reset
          </button>
          <button onClick={savePermissions} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${saved?"bg-emerald-500 text-white":"bg-amber-500 hover:bg-amber-400 text-black"}`}>
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
            <button key={role} onClick={()=>setSelectedRole(role)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${selectedRole===role?`${cfg.bg} border-white/20 ${cfg.color}`:"border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}>
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full bg-white/10 ${selectedRole===role?cfg.color:"text-white/30"}`}>{count}</span>
            </button>
          );
        })}
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-white/20 text-white/30 hover:border-white/40 hover:text-white/50 text-sm font-semibold transition-all">
          <Plus className="h-4 w-4"/>Custom Role
        </button>
      </div>

      {/* Role Info */}
      <div className="flex items-center justify-between bg-white/[0.03] border border-white/8 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-2xl ${roleCfg(selectedRole).bg} flex items-center justify-center text-2xl`}>{roleCfg(selectedRole).icon}</div>
          <div>
            <p className="font-extrabold">{roleCfg(selectedRole).label} Role</p>
            <p className="text-xs text-white/40">{enabledCount} of {totalPerms} permissions enabled</p>
          </div>
        </div>
        <div className="w-32">
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>Access</span>
            <span>{Math.round((enabledCount/totalPerms)*100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full bg-amber-500`} style={{width:`${(enabledCount/totalPerms)*100}%`}}/>
          </div>
        </div>
        {selectedRole==="owner"&&<div className="text-xs text-yellow-400 bg-yellow-500/15 px-3 py-1.5 rounded-full font-semibold flex items-center gap-1"><Lock className="h-3 w-3"/>Owner (all access — locked)</div>}
      </div>

      {/* Permissions */}
      <div className="space-y-3">
        {PERMISSION_GROUPS.map(group=>{
          const allOn = group.permissions.every(p=>currentRolePerms[p.key]);
          const someOn = group.permissions.some(p=>currentRolePerms[p.key]);
          const expanded = expandedGroups.has(group.group);
          return (
            <div key={group.group} className="bg-[#0e1520] border border-white/5 rounded-2xl overflow-hidden">
              <button onClick={()=>toggleGroupExpand(group.group)} className="w-full flex items-center justify-between p-4 hover:bg-white/3 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${allOn?"bg-emerald-400":someOn?"bg-yellow-400":"bg-white/20"}`}/>
                  <span className="font-semibold">{group.group}</span>
                  <span className="text-xs text-white/30">{group.permissions.filter(p=>currentRolePerms[p.key]).length}/{group.permissions.length}</span>
                </div>
                <div className="flex items-center gap-3">
                  {selectedRole!=="owner"&&(
                    <button onClick={e=>{e.stopPropagation();toggleGroup(selectedRole,group);}} className={`text-xs px-3 py-1 rounded-lg border font-semibold transition-all ${allOn?"border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20":"border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}>
                      {allOn?"Disable All":"Enable All"}
                    </button>
                  )}
                  <ChevronDown className={`h-4 w-4 text-white/30 transition-transform ${expanded?"rotate-180":""}`}/>
                </div>
              </button>
              {expanded&&(
                <div className="border-t border-white/5 px-4 py-3">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {group.permissions.map(perm=>{
                      const enabled = currentRolePerms[perm.key] || false;
                      const locked = selectedRole==="owner";
                      return (
                        <button key={perm.key} onClick={()=>toggle(selectedRole,perm.key)} disabled={locked} className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${enabled?"border-emerald-500/30 bg-emerald-500/8":"border-white/8 bg-white/[0.02] hover:border-white/15"} ${locked?"cursor-not-allowed opacity-70":""}`}>
                          <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 transition-all ${enabled?"bg-emerald-500 border-emerald-500":"border border-white/20 bg-transparent"}`}>
                            {enabled&&<Check className="h-2.5 w-2.5 text-white"/>}
                          </div>
                          <span className={`text-xs font-medium leading-tight ${enabled?"text-white/80":"text-white/40"}`}>{perm.label}</span>
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
      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
        <h3 className="font-bold mb-4">All Roles — Permission Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-white/30 border-b border-white/5">
                <th className="pb-3 pr-4">Permission</th>
                {allRoles.map(r=><th key={r} className="pb-3 px-2 text-center capitalize">{roleCfg(r).icon} {roleCfg(r).label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {PERMISSION_GROUPS.flatMap(g=>g.permissions).slice(0,12).map(perm=>(
                <tr key={perm.key} className="hover:bg-white/3">
                  <td className="py-2 pr-4 text-white/60">{perm.label}</td>
                  {allRoles.map(r=>(
                    <td key={r} className="py-2 px-2 text-center">
                      {roles[r]?.[perm.key] ? <Check className="h-3.5 w-3.5 text-emerald-400 mx-auto"/> : <X className="h-3.5 w-3.5 text-white/15 mx-auto"/>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">Create Custom Role</h2>
              <button onClick={()=>setShowAdd(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Role Name</label>
                <input value={newRole.name} onChange={e=>setNewRole(p=>({...p,name:e.target.value}))} placeholder="e.g. Supervisor, Barista..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Copy permissions from</label>
                <select value={newRole.copyFrom} onChange={e=>setNewRole(p=>({...p,copyFrom:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-white">
                  {allRoles.map((r)=><option key={r} value={r}>{roleCfg(r).label}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={()=>{
                  if(!newRole.name)return;
                  const key=newRole.name.toLowerCase().replace(/\s+/g,"-");
                  setRoles(r=>({...r,[key]:{...r[newRole.copyFrom]||{}}}));
                  setSelectedRole(key);
                  setShowAdd(false);
                  setNewRole({name:"",copyFrom:"waiter"});
                }} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">Create Role</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
