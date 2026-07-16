import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Globe, Users, Eye, AlertTriangle, Zap, Copy, Code2, TrendingUp, Monitor, Smartphone, Tablet, RefreshCw, Cpu, CheckCircle2, ChevronDown, ChevronUp, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

const API = "/api";
const COLORS = ["#00d4ff", "#a855f7", "#22c55e", "#f97316", "#f43f5e", "#eab308", "#06b6d4", "#8b5cf6"];

type Range = "7d" | "30d" | "90d";

function StatCard({ label, value, sub, icon: Icon, color = "text-primary" }: any) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <span className="text-2xl font-mono font-bold">{value ?? "—"}</span>
      {sub && <span className="text-xs text-muted-foreground font-mono">{sub}</span>}
    </div>
  );
}

function fmtDuration(s: number) {
  if (!s) return "0s";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function WebsiteAnalytics() {
  const [range, setRange] = useState<Range>("7d");
  const [scriptOpen, setScriptOpen] = useState(false);

  const { data: summary, refetch: refetchSummary } = useQuery<any>({
    queryKey: ["wa-summary", range],
    queryFn: () => fetch(`${API}/website-analytics/summary?range=${range}`).then(r => r.json()),
    refetchInterval: 30_000,
  });
  const { data: timeseries = [] } = useQuery<any[]>({
    queryKey: ["wa-timeseries", range],
    queryFn: () => fetch(`${API}/website-analytics/timeseries?range=${range}`).then(r => r.json()),
  });
  const { data: pages = [] } = useQuery<any[]>({
    queryKey: ["wa-pages", range],
    queryFn: () => fetch(`${API}/website-analytics/pages?range=${range}`).then(r => r.json()),
  });
  const { data: sources = [] } = useQuery<any[]>({
    queryKey: ["wa-sources", range],
    queryFn: () => fetch(`${API}/website-analytics/sources?range=${range}`).then(r => r.json()),
  });
  const { data: countries = [] } = useQuery<any[]>({
    queryKey: ["wa-countries", range],
    queryFn: () => fetch(`${API}/website-analytics/countries?range=${range}`).then(r => r.json()),
  });
  const { data: devices } = useQuery<any>({
    queryKey: ["wa-devices", range],
    queryFn: () => fetch(`${API}/website-analytics/devices?range=${range}`).then(r => r.json()),
  });
  const { data: errors = [] } = useQuery<any[]>({
    queryKey: ["wa-errors"],
    queryFn: () => fetch(`${API}/website-analytics/errors`).then(r => r.json()),
  });
  const { data: clicks = [] } = useQuery<any[]>({
    queryKey: ["wa-clicks", range],
    queryFn: () => fetch(`${API}/website-analytics/clicks?range=${range}`).then(r => r.json()),
  });
  const { data: script } = useQuery<string>({
    queryKey: ["wa-script"],
    queryFn: () => fetch(`${API}/website-analytics/script`).then(r => r.text()),
    staleTime: Infinity,
  });

  const insights = useMutation({
    mutationFn: () => fetch(`${API}/website-analytics/ai-insights?range=${range}`, { method: "POST" }).then(r => r.json()),
  });

  const copyScript = () => {
    if (script) { navigator.clipboard.writeText(script); toast.success("Tracking script copied!"); }
  };

  const tsData = timeseries.map((r: any) => ({ day: format(new Date(r.day), "MMM d"), visits: Number(r.visits) }));
  const deviceData = (devices?.devices || []).map((d: any) => ({ name: d.name, value: Number(d.count) }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-mono font-semibold">Website Analytics</h1>
            <p className="text-xs text-muted-foreground font-mono">cintexa.com</p>
          </div>
          {(summary?.realtime ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-mono text-green-400">{summary.realtime} live</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
            {(["7d", "30d", "90d"] as Range[]).map(r => (
              <button key={r} onClick={() => setRange(r)} className={cn("px-2 py-1 rounded text-xs font-mono transition-colors", range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {r}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => refetchSummary()} className="gap-1"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Visits" value={summary?.visits?.toLocaleString()} sub="unique sessions" icon={Users} />
        <StatCard label="Pageviews" value={summary?.pageviews?.toLocaleString()} sub="total impressions" icon={Eye} />
        <StatCard label="Bounce Rate" value={`${summary?.bounceRate ?? 0}%`} sub="single-page sessions" icon={TrendingUp} color="text-orange-400" />
        <StatCard label="Avg Duration" value={fmtDuration(summary?.avgDuration ?? 0)} sub="per session" icon={Activity} color="text-blue-400" />
        <StatCard label="JS Errors" value={summary?.errors?.toLocaleString()} sub="tracked errors" icon={AlertTriangle} color="text-red-400" />
        <StatCard label="Live Now" value={summary?.realtime} sub="active 5 min" icon={Zap} color="text-green-400" />
      </div>

      {/* Visits Over Time */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-mono font-semibold mb-4">Visits Over Time</h2>
        {tsData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-xs font-mono">No data yet — embed the tracking script on cintexa.com</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={tsData}>
              <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} /><stop offset="95%" stopColor="#00d4ff" stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontFamily: "monospace", fontSize: 11 }} />
              <Area type="monotone" dataKey="visits" stroke="#00d4ff" fill="url(#gv)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Pages */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-mono font-semibold mb-3">Top Pages</h2>
          {pages.length === 0 ? <p className="text-xs text-muted-foreground font-mono">No data yet</p> : (
            <div className="space-y-2">
              {pages.slice(0, 8).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <span className="text-xs font-mono truncate">{p.path || "/"}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground">{p.visitors} visitors</span>
                    <Badge variant="outline" className="font-mono text-xs">{p.views} views</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Traffic Sources */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-mono font-semibold mb-3">Traffic Sources</h2>
          {sources.length === 0 ? <p className="text-xs text-muted-foreground font-mono">No data yet</p> : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={sources} dataKey="sessions" nameKey="source" cx="50%" cy="50%" innerRadius={30} outerRadius={55}>
                    {sources.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontFamily: "monospace", fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {sources.slice(0, 6).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs font-mono flex-1 truncate">{s.source}</span>
                    <span className="text-xs font-mono text-muted-foreground">{s.sessions}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Countries */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-mono font-semibold mb-3">Geography</h2>
          {countries.length === 0 ? <p className="text-xs text-muted-foreground font-mono">No data yet</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={countries.slice(0, 8)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <YAxis dataKey="country" type="category" tick={{ fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontFamily: "monospace", fontSize: 11 }} />
                <Bar dataKey="sessions" fill="#a855f7" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Devices */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-mono font-semibold mb-3">Devices & Browsers</h2>
          {!devices || !devices.devices?.length ? <p className="text-xs text-muted-foreground font-mono">No data yet</p> : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-2">Devices</p>
                {(devices.devices || []).map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    {d.name === "Mobile" ? <Smartphone className="h-3 w-3 text-muted-foreground" /> : d.name === "Tablet" ? <Tablet className="h-3 w-3 text-muted-foreground" /> : <Monitor className="h-3 w-3 text-muted-foreground" />}
                    <span className="text-xs font-mono flex-1">{d.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{d.count}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-2">Browsers</p>
                {(devices.browsers || []).slice(0, 5).map((b: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs font-mono flex-1">{b.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Clicks */}
      {clicks.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-mono font-semibold mb-3">Top Clicks & Navigations</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead><tr className="text-muted-foreground border-b border-border"><th className="text-left pb-2">Page</th><th className="text-left pb-2">Element</th><th className="text-left pb-2">Text</th><th className="text-right pb-2">Clicks</th></tr></thead>
              <tbody className="divide-y divide-border">
                {clicks.slice(0, 10).map((c: any, i: number) => (
                  <tr key={i}><td className="py-1.5 truncate max-w-[120px]">{c.path}</td><td className="py-1.5">{c.element}</td><td className="py-1.5 truncate max-w-[140px] text-muted-foreground">{c.elementText || "—"}</td><td className="py-1.5 text-right">{c.clicks}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* JS Errors */}
      {errors.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-mono font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-400" /> JavaScript Errors</h2>
          <div className="space-y-2">
            {errors.slice(0, 5).map((e: any) => (
              <div key={e.id} className="flex items-start gap-2 p-2 bg-red-500/5 border border-red-500/20 rounded">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-mono text-foreground truncate">{e.message}</p>
                  <p className="text-xs font-mono text-muted-foreground">{e.path} · {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-mono font-semibold flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /> AI Improvement Suggestions</h2>
          <Button size="sm" variant="outline" onClick={() => insights.mutate()} disabled={insights.isPending} className="gap-1 text-xs">
            {insights.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Cpu className="h-3 w-3" />} Analyze
          </Button>
        </div>
        {insights.data ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 bg-muted/40 rounded-full h-2 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${insights.data.overallScore}%` }} /></div>
              <span className="text-sm font-mono font-bold text-primary">{insights.data.overallScore}/100</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono italic">{insights.data.summary}</p>
            {(insights.data.insights || []).map((ins: any, i: number) => (
              <div key={i} className={cn("p-3 rounded-lg border", ins.priority === "high" ? "border-red-500/30 bg-red-500/5" : ins.priority === "medium" ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-muted/20")}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-mono font-semibold">{ins.title}</span>
                  <Badge variant="outline" className="ml-auto text-xs font-mono">{ins.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono pl-5">{ins.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground font-mono">Click "Analyze" to get AI-powered improvement suggestions for cintexa.com.</p>
        )}
      </div>

      {/* Tracking Script */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <button onClick={() => setScriptOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-xs font-mono hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2"><Code2 className="h-3.5 w-3.5 text-primary" /> Tracking Script — paste before &lt;/head&gt; on cintexa.com</div>
          {scriptOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {scriptOpen && (
          <div className="border-t border-border">
            <div className="flex justify-end p-2 border-b border-border bg-muted/20">
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={copyScript}><Copy className="h-3 w-3" /> Copy</Button>
            </div>
            <ScrollArea className="h-48">
              <pre className="p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">{script}</pre>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
