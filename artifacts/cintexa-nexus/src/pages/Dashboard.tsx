import {
  useGetDashboardStats,
  useGetRevenueChart,
  useGetPipelineSummary,
  useGetDashboardActivity,
  useGetMorningBrief,
  getGetDashboardStatsQueryKey,
  getGetRevenueChartQueryKey,
  getGetPipelineSummaryQueryKey,
  getGetDashboardActivityQueryKey,
  getGetMorningBriefQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import {
  DollarSign, Users, Target, TicketCheck,
  TrendingUp, Activity, Zap, ArrowRight,
  Briefcase, ChevronRight, ShieldAlert, AlertTriangle, Info, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type AnomalySeverity = "critical" | "warning" | "info";
type Anomaly = {
  id: string; module: string; severity: AnomalySeverity;
  title: string; description: string; aiExplanation: string | null;
};

function AnomalyWidget({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { data, isLoading } = useQuery<{ anomalies: Anomaly[] }>({
    queryKey: ["anomalies-widget"],
    queryFn: () => fetch(`${API}/anomalies`).then((r) => r.json()),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const anomalies = data?.anomalies ?? [];
  const criticals = anomalies.filter((a) => a.severity === "critical").length;
  const warnings  = anomalies.filter((a) => a.severity === "warning").length;
  const top = anomalies.slice(0, 3);

  const SEV_ICON: Record<AnomalySeverity, React.ElementType> = {
    critical: ShieldAlert, warning: AlertTriangle, info: Info,
  };
  const SEV_COLOR: Record<AnomalySeverity, string> = {
    critical: "text-rose-400", warning: "text-amber-400", info: "text-blue-400",
  };
  const SEV_BG: Record<AnomalySeverity, string> = {
    critical: "bg-rose-500/10 border-rose-500/20", warning: "bg-amber-500/10 border-amber-500/20", info: "bg-blue-500/10 border-blue-500/20",
  };

  const headerBorder = criticals > 0
    ? "border-rose-500/30 bg-gradient-to-b from-rose-500/5 to-card"
    : warnings > 0
    ? "border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-card"
    : "border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-card";

  return (
    <Card className={`border ${headerBorder} backdrop-blur`}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/30">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <ShieldAlert className={`w-4 h-4 ${criticals > 0 ? "text-rose-400" : warnings > 0 ? "text-amber-400" : "text-emerald-400"}`} />
          Anomaly Detection
        </CardTitle>
        <button
          onClick={() => onNavigate("/anomalies")}
          className="text-xs text-muted-foreground hover:text-primary font-mono flex items-center gap-1 transition-colors"
        >
          View All <ChevronRight className="w-3 h-3" />
        </button>
      </CardHeader>
      <CardContent className="pt-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : top.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-mono">All systems nominal</span>
          </div>
        ) : (
          top.map((a) => {
            const Icon = SEV_ICON[a.severity];
            return (
              <button
                key={a.id}
                onClick={() => onNavigate("/anomalies")}
                className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border text-left hover:brightness-110 transition-all ${SEV_BG[a.severity]}`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${SEV_COLOR[a.severity]}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold leading-snug ${SEV_COLOR[a.severity]}`}>{a.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{a.description}</p>
                </div>
              </button>
            );
          })
        )}
        {anomalies.length > 3 && (
          <button
            onClick={() => onNavigate("/anomalies")}
            className="w-full text-center text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors pt-1"
          >
            +{anomalies.length - 3} more anomal{anomalies.length - 3 === 1 ? "y" : "ies"} →
          </button>
        )}
      </CardContent>
    </Card>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const STAGE_COLORS: Record<string, string> = {
  prospecting: "hsl(var(--muted-foreground))",
  qualification: "#60a5fa",
  proposal: "#facc15",
  negotiation: "#fb923c",
  closed_won: "hsl(var(--primary))",
  closed_lost: "hsl(var(--destructive))",
};

const ACTIVITY_TYPE_COLOR: Record<string, string> = {
  deal: "bg-primary/20 text-primary",
  contact: "bg-secondary/20 text-secondary",
  ticket: "bg-destructive/20 text-destructive",
  campaign: "bg-warning/20 text-warning",
  invoice: "bg-emerald-500/20 text-emerald-400",
  lead: "bg-violet-500/20 text-violet-400",
  project: "bg-blue-500/20 text-blue-400",
};

export default function Dashboard() {
  const [, navigate] = useLocation();

  const { data: stats,    isLoading: statsLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
  const { data: revenue,  isLoading: revLoading }   = useGetRevenueChart({}, { query: { queryKey: getGetRevenueChartQueryKey() } });
  const { data: pipeline, isLoading: pipeLoading }  = useGetPipelineSummary({ query: { queryKey: getGetPipelineSummaryQueryKey() } });
  const { data: activity, isLoading: actLoading }   = useGetDashboardActivity({ limit: 10 }, { query: { queryKey: getGetDashboardActivityQueryKey() } });
  const { data: brief,    isLoading: briefLoading }  = useGetMorningBrief({ query: { queryKey: getGetMorningBriefQueryKey() } });

  const kpis = [
    {
      title: "Total Revenue",
      value: stats?.totalRevenue ? `$${stats.totalRevenue.toLocaleString()}` : null,
      icon: DollarSign,
      trend: stats?.monthlyGrowth,
      trendLabel: "vs last month",
      href: "/finance",
      color: "primary",
    },
    {
      title: "Active Contacts",
      value: stats?.totalContacts,
      icon: Users,
      href: "/crm",
      color: "secondary",
    },
    {
      title: "Open Deals",
      value: stats?.totalDeals,
      icon: Target,
      trend: stats?.winRate,
      trendLabel: "win rate",
      isPercent: true,
      href: "/sales",
      color: "primary",
    },
    {
      title: "Open Tickets",
      value: stats?.openTickets,
      icon: TicketCheck,
      href: "/support",
      color: "destructive",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            NEXUS{" "}
            <span className="text-primary font-mono text-xl border border-primary/30 px-2 py-0.5 rounded bg-primary/10">
              v2.4.1
            </span>
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            System operational. All modules nominal.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded border border-border">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIVE FEED</span>
          </div>
          <Button variant="outline" size="sm" className="gap-2 text-xs font-mono" onClick={() => navigate("/analytics")}>
            <TrendingUp className="w-3.5 h-3.5" /> Analytics
          </Button>
        </div>
      </div>

      {/* KPI Cards — clickable */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {kpis.map((kpi) => (
          <motion.div key={kpi.title} variants={item}>
            <Card
              className="border-border/50 bg-card/50 backdrop-blur hover:border-primary/40 transition-all group cursor-pointer hover:shadow-[0_0_20px_rgba(0,255,255,0.06)] active:scale-[0.98]"
              onClick={() => navigate(kpi.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {kpi.title}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <kpi.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold font-mono">
                    {kpi.value !== undefined && kpi.value !== null
                      ? typeof kpi.value === "string"
                        ? kpi.value
                        : kpi.value.toLocaleString()
                      : "—"}
                  </div>
                )}
                {kpi.trend !== undefined && !statsLoading && (
                  <p className="text-xs mt-1 flex items-center gap-1">
                    <span
                      className={cn(
                        "font-mono font-medium",
                        kpi.trend > 0 ? "text-emerald-500" : kpi.trend < 0 ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {kpi.trend > 0 ? "+" : ""}{kpi.trend}{kpi.isPercent ? "%" : "%"}
                    </span>
                    <span className="text-muted-foreground">{kpi.trendLabel}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Secondary stats row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          { label: "Total Leads",      value: stats?.totalLeads,      href: "/crm",      color: "text-violet-400" },
          { label: "Active Projects",  value: stats?.activeProjects,  href: "/projects", color: "text-blue-400"   },
          { label: "Win Rate",         value: stats?.winRate ? `${stats.winRate}%` : "—", href: "/sales", color: "text-emerald-400" },
          { label: "MoM Growth",       value: stats?.monthlyGrowth ? `+${stats.monthlyGrowth}%` : "—", href: "/analytics", color: "text-primary" },
        ].map(({ label, value, href, color }) => (
          <button
            key={label}
            onClick={() => navigate(href)}
            className="bg-card/30 border border-border/50 rounded-xl px-4 py-3 text-left hover:border-primary/30 hover:bg-card/50 transition-all group"
          >
            <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">{label}</div>
            <div className={`text-xl font-mono font-bold ${color}`}>
              {statsLoading ? <Skeleton className="h-6 w-12" /> : (value ?? "—")}
            </div>
          </button>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue chart */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Revenue Trajectory
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={() => navigate("/analytics")}>
                Full Analytics <ArrowRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full mt-2">
                {revLoading ? (
                  <Skeleton className="w-full h-full rounded" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenue || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v / 1000}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pipeline chart */}
          <Card
            className="border-border/50 bg-card/50 backdrop-blur cursor-pointer hover:border-secondary/30 transition-colors"
            onClick={() => navigate("/sales")}
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-secondary" /> Pipeline Health
              </CardTitle>
              <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                View Pipeline <ChevronRight className="w-3 h-3" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="h-[230px] w-full mt-2">
                {pipeLoading ? (
                  <Skeleton className="w-full h-full rounded" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipeline || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v / 1000}k`} />
                      <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} width={100} />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                        formatter={(v: number) => [`$${v.toLocaleString()}`, "Value"]}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                        {(pipeline || []).map((entry, idx) => (
                          <Cell key={idx} fill={STAGE_COLORS[entry.stage] ?? "hsl(var(--secondary))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Morning Brief + Activity */}
        <div className="space-y-6">
          {/* Morning Brief */}
          <Card className="border-primary/30 shadow-[0_0_15px_rgba(0,255,255,0.05)] bg-gradient-to-b from-card to-primary/5">
            <CardHeader className="pb-3 border-b border-primary/10">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
                <Zap className="w-5 h-5 fill-primary text-primary drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]" />
                NEXUS Morning Brief
              </CardTitle>
              {briefLoading ? (
                <Skeleton className="h-4 w-24 mt-1" />
              ) : (
                <CardDescription className="font-mono text-xs uppercase">{brief?.date}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {briefLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              ) : brief ? (
                <div className="space-y-4">
                  <p className="font-medium text-foreground leading-snug">{brief.headline}</p>
                  <div>
                    <p className="text-xs font-mono text-muted-foreground mb-2 uppercase">Key Insights</p>
                    <ul className="space-y-2">
                      {brief.insights.map((insight, i) => (
                        <li key={i} className="text-sm flex gap-2 items-start">
                          <span className="text-primary mt-0.5">•</span>
                          <span className="text-muted-foreground">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-muted-foreground mb-2 uppercase">Priorities</p>
                    <ul className="space-y-2">
                      {brief.priorities.map((priority, i) => (
                        <li key={i} className="text-sm flex gap-2 items-start">
                          <span className="text-secondary mt-0.5 font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                          <span className="text-foreground">{priority}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No brief available today.</p>
              )}
            </CardContent>
          </Card>

          {/* Anomaly Detection Widget */}
          <AnomalyWidget onNavigate={navigate} />

          {/* Activity Feed */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" /> Activity Feed
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] font-mono">{activity?.length || 0} events</Badge>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
              {actLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-2 p-2">
                      <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    </div>
                  ))
                : activity?.map((evt) => {
                    const dot = ACTIVITY_TYPE_COLOR[evt.type] ?? "bg-muted/50 text-muted-foreground";
                    return (
                      <div
                        key={evt.id}
                        className="flex gap-2.5 p-2 rounded-lg hover:bg-muted/20 transition-colors group"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${dot} text-[10px] font-mono font-bold uppercase`}>
                          {evt.type.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">
                            {evt.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{evt.description}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0 self-start mt-0.5">
                          {new Date(evt.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
