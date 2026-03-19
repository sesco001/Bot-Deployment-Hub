import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Users, Bot, Receipt, TrendingUp, Search,
  PlusCircle, MinusCircle, Trash2, RefreshCw, ShieldCheck,
  Lock, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_KEY_STORAGE = "mkm_admin_key";
const ADMIN_KEY_VALUE   = "makames_admin_2026";

type Tab = "overview" | "users" | "deployments" | "transactions";

// ── helpers ──────────────────────────────────────────────────
function apiFetch(path: string, opts: RequestInit = {}) {
  return fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY_VALUE, ...(opts.headers ?? {}) },
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "bg-green-500/20 text-green-400 border border-green-500/30",
    stopped: "bg-red-500/20 text-red-400 border border-red-500/30",
    pending: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  };
  return (
    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full capitalize", map[status] ?? "bg-white/10 text-white/60")}>
      {status}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", color)}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function Admin() {
  const { toast } = useToast();
  const [authed, setAuthed]   = useState(() => localStorage.getItem(ADMIN_KEY_STORAGE) === ADMIN_KEY_VALUE);
  const [keyInput, setKeyInput] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Data
  const [stats, setStats]     = useState<any>(null);
  const [users, setUsers]     = useState<any[]>([]);
  const [deps, setDeps]       = useState<any[]>([]);
  const [txs, setTxs]         = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [search, setSearch]   = useState("");
  const [creditUser, setCreditUser]   = useState<any>(null);
  const [creditAmt, setCreditAmt]     = useState("");
  const [creditNote, setCreditNote]   = useState("");
  const [creditType, setCreditType]   = useState<"credit" | "deduct">("credit");
  const [creditLoading, setCreditLoading] = useState(false);
  const [expandedDep, setExpandedDep] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    try {
      const [sRes, uRes, dRes, tRes] = await Promise.all([
        apiFetch("/admin/stats"),
        apiFetch("/admin/users"),
        apiFetch("/admin/deployments"),
        apiFetch("/admin/transactions"),
      ]);
      setStats(await sRes.json());
      setUsers(await uRes.json());
      setDeps(await dRes.json());
      setTxs(await tRes.json());
    } catch {
      toast({ variant: "destructive", title: "Failed to load admin data" });
    } finally {
      setLoading(false);
    }
  }, [authed, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const login = () => {
    if (keyInput === ADMIN_KEY_VALUE) {
      localStorage.setItem(ADMIN_KEY_STORAGE, ADMIN_KEY_VALUE);
      setAuthed(true);
    } else {
      toast({ variant: "destructive", title: "Wrong admin key" });
    }
  };

  const handleCredit = async () => {
    if (!creditUser || !creditAmt) return;
    setCreditLoading(true);
    try {
      const endpoint = creditType === "credit" ? "credit" : "deduct";
      const res = await apiFetch(`/admin/users/${creditUser.id}/${endpoint}`, {
        method: "PATCH",
        body: JSON.stringify({ amountMd: parseInt(creditAmt), note: creditNote }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast({ title: `${creditType === "credit" ? "Credited" : "Deducted"} ${creditAmt} MD to ${creditUser.username}` });
      setCreditUser(null); setCreditAmt(""); setCreditNote("");
      await loadAll();
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message });
    } finally {
      setCreditLoading(false);
    }
  };

  const handleDepStatus = async (id: string, status: string) => {
    await apiFetch(`/admin/deployments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setDeps((prev) => prev.map((d) => d.id === id ? { ...d, status } : d));
    toast({ title: `Status updated to "${status}"` });
  };

  const handleDepDelete = async (id: string) => {
    if (!confirm("Delete this deployment? This cannot be undone.")) return;
    await apiFetch(`/admin/deployments/${id}`, { method: "DELETE" });
    setDeps((prev) => prev.filter((d) => d.id !== id));
    toast({ title: "Deployment deleted" });
  };

  // ── Auth screen ──────────────────────────────────────────────
  if (!authed) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="glass-panel rounded-3xl p-10 max-w-sm w-full flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Admin Access</h2>
              <p className="text-muted-foreground text-sm mt-1">Enter your admin key to continue</p>
            </div>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="Admin key..."
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-white outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button onClick={login} className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90">
              Unlock Dashboard
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const filteredUsers = users.filter((u) =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDeps = deps.filter((d) =>
    d.botName?.toLowerCase().includes(search.toLowerCase()) ||
    d.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
    d.botTypeId?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTxs = txs.filter((t) =>
    t.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "overview",     label: "Overview",     icon: TrendingUp },
    { id: "users",        label: `Users (${users.length})`, icon: Users },
    { id: "deployments",  label: `Bots (${deps.length})`,  icon: Bot },
    { id: "transactions", label: `Transactions (${txs.length})`, icon: Receipt },
  ];

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-display font-bold text-white">Admin Dashboard</h1>
          </div>
          <p className="text-muted-foreground">Manage users, bots, and payments</p>
        </div>
        <button onClick={loadAll} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors text-sm">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
              activeTab === t.id ? "bg-primary text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
            )}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* ── OVERVIEW ─────────────────────────────────────────── */}
          {activeTab === "overview" && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users}        label="Total Users"       value={stats.totalUsers}         color="bg-blue-500/20 text-blue-400" />
                <StatCard icon={Bot}          label="Total Bots"        value={stats.totalDeployments}   color="bg-secondary/20 text-secondary" />
                <StatCard icon={Clock}        label="Pending Bots"      value={stats.pendingDeployments} color="bg-yellow-500/20 text-yellow-400" />
                <StatCard icon={TrendingUp}   label="Total Deposited"   value={`${stats.totalDeposited} MD`} color="bg-green-500/20 text-green-400" />
              </div>
              <StatCard icon={Receipt} label="Total Wallet Balance (all users)" value={`${stats.totalWalletBalance} MD`} color="bg-primary/20 text-primary" />

              {/* Quick credit panel */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-secondary" /> Quick Wallet Credit
                </h3>
                <p className="text-muted-foreground text-sm mb-4">Search a user below and credit or deduct their balance instantly.</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search user by name or email..."
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-white outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                {search && (
                  <div className="mt-2 border border-border rounded-xl overflow-hidden">
                    {filteredUsers.slice(0, 5).map((u) => (
                      <button key={u.id} onClick={() => { setCreditUser(u); setSearch(""); setActiveTab("users"); }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-left border-b border-border/50 last:border-0">
                        <span className="text-white text-sm font-medium">{u.username}</span>
                        <span className="text-muted-foreground text-xs">{u.email} · {u.wallet?.balanceMd ?? 0} MD</span>
                      </button>
                    ))}
                    {filteredUsers.length === 0 && <p className="text-muted-foreground text-sm p-4">No users found</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── USERS ────────────────────────────────────────────── */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-white outline-none focus:ring-2 focus:ring-primary/50" />
              </div>

              {/* Credit Modal */}
              {creditUser && (
                <div className="glass-panel rounded-2xl p-6 border border-primary/30">
                  <h3 className="text-white font-bold mb-1">Adjust Wallet — <span className="text-primary">{creditUser.username}</span></h3>
                  <p className="text-muted-foreground text-sm mb-4">Current balance: <strong className="text-white">{creditUser.wallet?.balanceMd ?? 0} MD</strong></p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {(["credit", "deduct"] as const).map((t) => (
                      <button key={t} onClick={() => setCreditType(t)}
                        className={cn("py-2.5 rounded-xl font-medium text-sm transition-all",
                          creditType === t ? (t === "credit" ? "bg-green-600 text-white" : "bg-red-600 text-white") : "bg-white/5 text-muted-foreground"
                        )}>
                        {t === "credit" ? <span className="flex items-center justify-center gap-1"><PlusCircle className="w-4 h-4" /> Credit</span>
                          : <span className="flex items-center justify-center gap-1"><MinusCircle className="w-4 h-4" /> Deduct</span>}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <input type="number" value={creditAmt} onChange={(e) => setCreditAmt(e.target.value)} placeholder="Amount in MD"
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-white outline-none focus:ring-2 focus:ring-primary/50" />
                    <input value={creditNote} onChange={(e) => setCreditNote(e.target.value)} placeholder="Note (optional) e.g. M-Pesa ref ABC123"
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-white outline-none focus:ring-2 focus:ring-primary/50" />
                    <div className="flex gap-2">
                      <button onClick={handleCredit} disabled={creditLoading || !creditAmt}
                        className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                        {creditLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Confirm {creditType === "credit" ? "Credit" : "Deduct"}
                      </button>
                      <button onClick={() => setCreditUser(null)} className="px-4 py-3 rounded-xl bg-white/5 text-muted-foreground hover:text-white">Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{u.username}</p>
                          <p className="text-muted-foreground text-xs">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground pl-10">
                        <span className="text-white font-bold">{u.wallet?.balanceMd ?? 0} MD</span>
                        <span>Referral: {u.referralCode}</span>
                        <span>Free days: {u.freeDeployDaysLeft}</span>
                        <span>Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pl-10 sm:pl-0">
                      <button onClick={() => { setCreditUser(u); setCreditType("credit"); }}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs font-medium">
                        <PlusCircle className="w-3.5 h-3.5" /> Credit
                      </button>
                      <button onClick={() => { setCreditUser(u); setCreditType("deduct"); }}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium">
                        <MinusCircle className="w-3.5 h-3.5" /> Deduct
                      </button>
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && <p className="text-muted-foreground text-center py-12">No users found</p>}
              </div>
            </div>
          )}

          {/* ── DEPLOYMENTS ──────────────────────────────────────── */}
          {activeTab === "deployments" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bots or users..."
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-white outline-none focus:ring-2 focus:ring-primary/50" />
              </div>

              <div className="space-y-2">
                {filteredDeps.map((d) => (
                  <div key={d.id} className="glass-panel rounded-2xl overflow-hidden">
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Bot className="w-4 h-4 text-secondary shrink-0" />
                          <span className="text-white font-medium">{d.botName}</span>
                          <StatusBadge status={d.status} />
                          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{d.botTypeId}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>User: <span className="text-white">{d.user?.username ?? d.userId}</span></span>
                          {d.apiKey && <span>VPS ID: <span className="text-primary font-mono">{d.apiKey}</span></span>}
                          <span>Deployed: {new Date(d.deployedAt).toLocaleString()}</span>
                          {d.expiresAt && <span>Expires: {new Date(d.expiresAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={d.status}
                          onChange={(e) => handleDepStatus(d.id, e.target.value)}
                          className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-white outline-none focus:ring-1 focus:ring-primary/50"
                        >
                          <option value="running">Running</option>
                          <option value="stopped">Stopped</option>
                          <option value="pending">Pending</option>
                        </select>
                        <button onClick={() => setExpandedDep(expandedDep === d.id ? null : d.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground">
                          {expandedDep === d.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleDepDelete(d.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {expandedDep === d.id && (
                      <div className="border-t border-white/5 px-4 pb-4 pt-3 text-xs text-muted-foreground">
                        <p><span className="text-white font-medium">Config:</span> {d.config ?? "—"}</p>
                        <p className="mt-1"><span className="text-white font-medium">Free deployment:</span> {d.isFreeDeployment ? "Yes" : "No"}</p>
                      </div>
                    )}
                  </div>
                ))}
                {filteredDeps.length === 0 && <p className="text-muted-foreground text-center py-12">No deployments found</p>}
              </div>
            </div>
          )}

          {/* ── TRANSACTIONS ─────────────────────────────────────── */}
          {activeTab === "transactions" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions..."
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-white outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="space-y-2">
                {filteredTxs.map((t) => (
                  <div key={t.id} className="glass-panel rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", t.type === "deposit"
                          ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                          {t.type === "deposit" ? "+" : ""}{t.amountMd} MD
                        </span>
                        <span className="text-white text-sm truncate">{t.description}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{t.user?.username ?? `User #${t.userId}`}</span>
                        <span>{new Date(t.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    {t.type === "deposit"
                      ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  </div>
                ))}
                {filteredTxs.length === 0 && <p className="text-muted-foreground text-center py-12">No transactions found</p>}
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
