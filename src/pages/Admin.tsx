import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Shield, Users, Key, BarChart3, Mail, Plus, RefreshCw, Trash2 } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

interface AccessCode {
  id: string;
  code: string;
  tier: string;
  active: boolean;
  max_uses: number | null;
  current_uses: number;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string;
  created_at: string;
  avatar_url: string | null;
}

interface UserAccess {
  id: string;
  user_id: string;
  tier: string;
  granted_at: string;
  code_id: string;
}

interface ApprovedEmail {
  id: string;
  email: string;
  tier: string;
  source: string;
  created_at: string;
  notes: string | null;
}

// ── Admin Dashboard ──────────────────────────────────────────────

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (!authLoading && !adminLoading && user && !isAdmin) navigate("/");
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  if (authLoading || adminLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-primary animate-pulse font-display text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pt-20 px-4 sm:px-6 pb-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="font-display text-2xl sm:text-3xl text-foreground">
            GalaxiForge <span className="text-primary">Admin</span>
          </h1>
        </div>

        <Tabs defaultValue="codes" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="codes" className="gap-1.5 text-xs"><Key className="w-3.5 h-3.5" /> Codes</TabsTrigger>
            <TabsTrigger value="emails" className="gap-1.5 text-xs"><Mail className="w-3.5 h-3.5" /> Approved Emails</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" /> Users</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="codes"><CodesPanel /></TabsContent>
          <TabsContent value="emails"><ApprovedEmailsPanel /></TabsContent>
          <TabsContent value="users"><UsersPanel /></TabsContent>
          <TabsContent value="analytics"><AnalyticsPanel /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Codes Panel ──────────────────────────────────────────────────

function CodesPanel() {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [newTier, setNewTier] = useState("free");
  const [newMaxUses, setNewMaxUses] = useState("");

  const fetchCodes = async () => {
    setLoading(true);
    const { data } = await supabase.from("access_codes").select("*").order("created_at", { ascending: false });
    setCodes((data ?? []) as AccessCode[]);
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const createCode = async () => {
    if (!newCode.trim()) return;
    const { error } = await supabase.from("access_codes").insert({
      code: newCode.toUpperCase().trim(),
      tier: newTier,
      max_uses: newMaxUses ? parseInt(newMaxUses) : null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Code created", description: `${newCode.toUpperCase()} (${newTier})` });
      setNewCode("");
      setNewMaxUses("");
      fetchCodes();
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("access_codes").update({ active: !active }).eq("id", id);
    fetchCodes();
  };

  const deleteCode = async (id: string) => {
    await supabase.from("access_codes").delete().eq("id", id);
    fetchCodes();
  };

  return (
    <div className="space-y-6">
      {/* Create new code */}
      <div className="p-4 rounded-xl bg-card border border-border space-y-3">
        <h3 className="text-sm font-display text-foreground">Create Access Code</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Code (e.g. FORGE2026)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            className="bg-secondary border-border text-xs flex-1"
          />
          <Select value={newTier} onValueChange={setNewTier}>
            <SelectTrigger className="bg-secondary border-border w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="export">Export</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Max uses (∞)"
            value={newMaxUses}
            onChange={(e) => setNewMaxUses(e.target.value.replace(/\D/g, ""))}
            className="bg-secondary border-border text-xs w-28"
          />
          <Button onClick={createCode} size="sm" className="bg-primary text-primary-foreground gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Create
          </Button>
        </div>
      </div>

      {/* Codes list */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-display text-foreground">Access Codes ({codes.length})</h3>
          <Button variant="ghost" size="sm" onClick={fetchCodes} className="gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="divide-y divide-border">
            {codes.map((code) => (
              <div key={code.id} className="p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors">
                <code className="font-mono text-xs text-foreground font-bold flex-1">{code.code}</code>
                <Badge variant={code.active ? "default" : "secondary"} className="text-[10px]">
                  {code.tier}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {code.current_uses}/{code.max_uses ?? "∞"} uses
                </span>
                <Switch checked={code.active} onCheckedChange={() => toggleActive(code.id, code.active)} />
                <Button variant="ghost" size="sm" onClick={() => deleteCode(code.id)} className="text-destructive hover:text-destructive h-7 w-7 p-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Approved Emails Panel ────────────────────────────────────────

function ApprovedEmailsPanel() {
  const [emails, setEmails] = useState<ApprovedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newTier, setNewTier] = useState("pro");
  const [newNotes, setNewNotes] = useState("");

  const fetchEmails = async () => {
    setLoading(true);
    const { data } = await supabase.from("approved_emails").select("*").order("created_at", { ascending: false });
    setEmails((data ?? []) as ApprovedEmail[]);
    setLoading(false);
  };

  useEffect(() => { fetchEmails(); }, []);

  const addEmail = async () => {
    if (!newEmail.trim()) return;
    const { error } = await supabase.from("approved_emails").insert({
      email: newEmail.toLowerCase().trim(),
      tier: newTier,
      source: "admin",
      notes: newNotes || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email approved", description: `${newEmail} → ${newTier}` });
      setNewEmail("");
      setNewNotes("");
      fetchEmails();
    }
  };

  const removeEmail = async (id: string) => {
    await supabase.from("approved_emails").delete().eq("id", id);
    fetchEmails();
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-card border border-border space-y-3">
        <h3 className="text-sm font-display text-foreground">Add Approved Email</h3>
        <p className="text-[10px] text-muted-foreground">
          Users who sign up with an approved email will automatically receive access. 
          Use this for GalaxiForge customers — add their email here after purchase.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="user@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="bg-secondary border-border text-xs flex-1"
            type="email"
          />
          <Select value={newTier} onValueChange={setNewTier}>
            <SelectTrigger className="bg-secondary border-border w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Notes (optional)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            className="bg-secondary border-border text-xs w-40"
          />
          <Button onClick={addEmail} size="sm" className="bg-primary text-primary-foreground gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-display text-foreground">Approved Emails ({emails.length})</h3>
          <Button variant="ghost" size="sm" onClick={fetchEmails} className="gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : emails.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No approved emails yet</div>
        ) : (
          <div className="divide-y divide-border">
            {emails.map((e) => (
              <div key={e.id} className="p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors">
                <span className="text-xs text-foreground flex-1 truncate">{e.email}</span>
                <Badge className="text-[10px]">{e.tier}</Badge>
                <span className="text-[10px] text-muted-foreground">{e.source}</span>
                {e.notes && <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]">{e.notes}</span>}
                <Button variant="ghost" size="sm" onClick={() => removeEmail(e.id)} className="text-destructive h-7 w-7 p-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Users Panel ──────────────────────────────────────────────────

function UsersPanel() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userAccess, setUserAccess] = useState<UserAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const [profilesRes, accessRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_access").select("*"),
    ]);
    setProfiles((profilesRes.data ?? []) as Profile[]);
    setUserAccess((accessRes.data ?? []) as UserAccess[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const getUserTiers = (userId: string) => {
    return userAccess.filter((a) => a.user_id === userId).map((a) => a.tier);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-display text-foreground">Users ({profiles.length})</h3>
          <Button variant="ghost" size="sm" onClick={fetchUsers} className="gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="divide-y divide-border">
            {profiles.map((p) => {
              const tiers = getUserTiers(p.id);
              return (
                <div key={p.id} className="p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                    {p.display_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground font-medium truncate">{p.display_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Joined {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {tiers.length === 0 ? (
                      <Badge variant="secondary" className="text-[10px]">No access</Badge>
                    ) : (
                      tiers.map((t, i) => (
                        <Badge key={i} className="text-[10px]">{t}</Badge>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Analytics Panel ──────────────────────────────────────────────

function AnalyticsPanel() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCodes: 0,
    totalRedemptions: 0,
    approvedEmails: 0,
    tierBreakdown: {} as Record<string, number>,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [profilesRes, codesRes, accessRes, emailsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("access_codes").select("id", { count: "exact", head: true }),
        supabase.from("user_access").select("tier"),
        supabase.from("approved_emails").select("id", { count: "exact", head: true }),
      ]);

      const tiers: Record<string, number> = {};
      (accessRes.data ?? []).forEach((a: any) => {
        tiers[a.tier] = (tiers[a.tier] || 0) + 1;
      });

      setStats({
        totalUsers: profilesRes.count ?? 0,
        totalCodes: codesRes.count ?? 0,
        totalRedemptions: (accessRes.data ?? []).length,
        approvedEmails: emailsRes.count ?? 0,
        tierBreakdown: tiers,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading analytics...</div>;

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users },
    { label: "Access Codes", value: stats.totalCodes, icon: Key },
    { label: "Redemptions", value: stats.totalRedemptions, icon: BarChart3 },
    { label: "Approved Emails", value: stats.approvedEmails, icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4 text-primary" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-2xl font-display text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tier breakdown */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <h3 className="text-sm font-display text-foreground mb-3">Access Tier Breakdown</h3>
        {Object.keys(stats.tierBreakdown).length === 0 ? (
          <p className="text-xs text-muted-foreground">No redemptions yet</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(stats.tierBreakdown).map(([tier, count]) => (
              <div key={tier} className="flex items-center gap-3">
                <Badge className="text-[10px] w-20 justify-center">{tier}</Badge>
                <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, (count / stats.totalRedemptions) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GalaxiForge sync status */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <h3 className="text-sm font-display text-foreground mb-2">GalaxiForge Sync</h3>
        <p className="text-[10px] text-muted-foreground mb-3">
          Email-based auto-grant is active. Users whose email is in the approved list 
          will automatically receive access upon signup.
        </p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs text-accent">Auto-grant trigger active</span>
        </div>
      </div>
    </div>
  );
}
