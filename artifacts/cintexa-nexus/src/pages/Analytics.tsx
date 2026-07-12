import {
  useListContacts, useListLeads, useListDeals,
  useListTickets, useListCampaigns, useListInvoices,
  getListContactsQueryKey, getListLeadsQueryKey, getListDealsQueryKey,
  getListTicketsQueryKey, getListCampaignsQueryKey, getListInvoicesQueryKey,
  useGetPipelineSummary, getGetPipelineSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  FunnelChart, Funnel, LabelList,
} from "recharts";
import { BarChart2, TrendingUp, Users, Target, TicketCheck, Megaphone, Receipt } from "lucide-react";
import { motion } from "framer-motion";

// ── Colour palettes ───────────────────────────────────────────────────────────
const CYAN   = "hsl(var(--primary))";
const INDIGO = "hsl(var(--secondary))";
const WARN   = "hsl(var(--warning, 38 92% 50%))";
const DESTR  = "hsl(var(--destructive))";
const MUT    = "hsl(var(--muted-foreground))";

const PIE_COLORS = [CYAN, INDIGO, "#a78bfa", "#34d399", WARN, DESTR, "#f472b6", "#60a5fa"];

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" },
  itemStyle: { color: "hsl(var(--foreground))" },
};

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h2 className="font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground font-mono">{subtitle}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, children, loading, className = "" }: { title: string; children: React.ReactNode; loading: boolean; className?: string }) {
  return (
    <Card className={`border-border/50 bg-card/50 ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="w-full h-52 rounded" /> : children}
      </CardContent>
    </Card>
  );
}

// ── Custom label for pie slices ───────────────────────────────────────────────
const renderPieLabel = ({ name, percent }: any) =>
  percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : "";

export default function Analytics() {
  const { data: contacts, isLoading: cLoad } = useListContacts({}, { query: { queryKey: getListContactsQueryKey({}) } });
  const { data: leads,    isLoading: lLoad } = useListLeads({},    { query: { queryKey: getListLeadsQueryKey({}) } });
  const { data: deals,    isLoading: dLoad } = useListDeals({},    { query: { queryKey: getListDealsQueryKey({}) } });
  const { data: tickets,  isLoading: tLoad } = useListTickets({},  { query: { queryKey: getListTicketsQueryKey({}) } });
  const { data: campaigns,isLoading: mLoad } = useListCampaigns({},{ query: { queryKey: getListCampaignsQueryKey({}) } });
  const { data: invoices, isLoading: iLoad } = useListInvoices({}, { query: { queryKey: getListInvoicesQueryKey({}) } });
  const { data: pipeline, isLoading: pLoad } = useGetPipelineSummary({ query: { queryKey: getGetPipelineSummaryQueryKey() } });

  // ── Derived data ─────────────────────────────────────────────────────────
  // Contact status breakdown
  const contactStatus = Object.entries(
    (contacts ?? []).reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] || 0) + 1 }), {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Lead source breakdown
  const leadSource = Object.entries(
    (leads ?? []).reduce((acc, l) => ({ ...acc, [l.source]: (acc[l.source] || 0) + 1 }), {} as Record<string, number>)
  ).map(([name, value]) => ({ name: name.replace("_", " "), value })).sort((a, b) => b.value - a.value);

  // Lead status funnel
  const statusOrder = ["new", "contacted", "qualified", "converted"];
  const leadFunnel = statusOrder
    .map(s => ({ name: s, value: (leads ?? []).filter(l => l.status === s).length }))
    .filter(x => x.value > 0);

  // Deal stage value (already from pipeline summary)
  const pipelineData = (pipeline ?? []).map(p => ({
    stage: p.stage.replace("_", " "),
    value: p.value,
    count: p.count,
  }));

  // Ticket priority breakdown
  const ticketPriority = Object.entries(
    (tickets ?? []).reduce((acc, t) => ({ ...acc, [t.priority]: (acc[t.priority] || 0) + 1 }), {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Ticket status breakdown
  const ticketStatus = Object.entries(
    (tickets ?? []).reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }), {} as Record<string, number>)
  ).map(([name, value]) => ({ name: name.replace("_", " "), value }));

  // Campaign performance (open rate vs click rate)
  const campaignPerf = (campaigns ?? [])
    .filter(c => c.sent && c.sent > 0)
    .map(c => ({
      name: c.name.length > 20 ? c.name.slice(0, 20) + "…" : c.name,
      openRate: c.opened ? Math.round((c.opened / c.sent!) * 100) : 0,
      clickRate: c.clicked ? Math.round((c.clicked / (c.opened || 1)) * 100) : 0,
      conversions: c.converted ?? 0,
    }));

  // Invoice status breakdown
  const invoiceStatus = Object.entries(
    (invoices ?? []).reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status] || 0) + i.amount }), {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value: Math.round(value) }));

  // Contact score distribution (bucketed)
  const scoreBuckets = [
    { range: "0–25",  count: (contacts ?? []).filter(c => (c.score ?? 0) <= 25).length },
    { range: "26–50", count: (contacts ?? []).filter(c => (c.score ?? 0) > 25 && (c.score ?? 0) <= 50).length },
    { range: "51–75", count: (contacts ?? []).filter(c => (c.score ?? 0) > 50 && (c.score ?? 0) <= 75).length },
    { range: "76–100",count: (contacts ?? []).filter(c => (c.score ?? 0) > 75).length },
  ];

  // Deal win/loss rate
  const wonCount  = (deals ?? []).filter(d => d.stage === "closed_won").length;
  const lostCount = (deals ?? []).filter(d => d.stage === "closed_lost").length;
  const openCount = (deals ?? []).length - wonCount - lostCount;
  const winLoss = [
    { name: "Won",  value: wonCount  },
    { name: "Lost", value: lostCount },
    { name: "Open", value: openCount },
  ].filter(x => x.value > 0);

  // Radar: module health scores (0-100)
  const radarData = [
    { subject: "CRM",       score: Math.min(100, (contacts?.length ?? 0) * 10) },
    { subject: "Pipeline",  score: Math.min(100, wonCount > 0 ? Math.round(wonCount / ((deals?.length || 1)) * 100) : 20) },
    { subject: "Support",   score: Math.min(100, tickets ? Math.round(((tickets.filter(t => t.status === "resolved" || t.status === "closed").length) / (tickets.length || 1)) * 100) : 0) },
    { subject: "Marketing", score: Math.min(100, campaigns ? Math.round((campaigns.filter(c => c.status === "active" || c.status === "completed").length / (campaigns.length || 1)) * 100) : 0) },
    { subject: "Finance",   score: Math.min(100, invoices ? Math.round((invoices.filter(i => i.status === "paid").length / (invoices.length || 1)) * 100) : 0) },
    { subject: "Leads",     score: Math.min(100, leads ? Math.round((leads.filter(l => l.score >= 70).length / (leads.length || 1)) * 100) : 0) },
  ];

  const anyLoading = cLoad || lLoad || dLoad || tLoad || mLoad || iLoad || pLoad;

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Cross-module intelligence and performance telemetry.</p>
        </div>
        {anyLoading && (
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Loading data streams…
          </div>
        )}
      </div>

      {/* ── Overview KPIs ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Contacts", value: contacts?.length, icon: Users, color: "text-primary" },
          { label: "Qualified Leads", value: leads?.filter(l => l.status === "qualified" || l.status === "converted").length, icon: Target, color: "text-secondary" },
          { label: "Ticket Resolution", value: tickets ? `${Math.round((tickets.filter(t => t.status === "resolved" || t.status === "closed").length / (tickets.length || 1)) * 100)}%` : "—", icon: TicketCheck, color: "text-emerald-400" },
          { label: "Revenue Collected", value: invoices ? `$${invoices.filter(i => i.status === "paid").reduce((a, i) => a + i.amount, 0).toLocaleString()}` : "—", icon: Receipt, color: "text-warning" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50 bg-card/50">
            <CardContent className="p-5">
              <div className={`flex items-center gap-2 mb-2 ${color}`}>
                <Icon className="w-4 h-4" />
                <span className="text-xs font-mono uppercase">{label}</span>
              </div>
              <div className={`text-3xl font-mono font-bold ${color}`}>
                {value ?? "—"}
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* ── Module Health Radar ───────────────────────────────────────── */}
      <section>
        <SectionTitle icon={BarChart2} title="Module Health Radar" subtitle="Composite health score per business unit (0–100)" />
        <ChartCard title="Health by Module" loading={anyLoading}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Radar name="Score" dataKey="score" stroke={CYAN} fill={CYAN} fillOpacity={0.2} strokeWidth={2} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}/100`, "Score"]} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      {/* ── CRM Analytics ─────────────────────────────────────────────── */}
      <section>
        <SectionTitle icon={Users} title="CRM Analytics" subtitle="Contact quality, lead origins, and conversion funnel" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ChartCard title="Contact Status Breakdown" loading={cLoad}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={contactStatus} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={renderPieLabel} labelLine={false}>
                    {contactStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Lead Source Distribution" loading={lLoad}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadSource} layout="vertical" margin={{ left: 20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUT }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} width={65} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="value" fill={CYAN} radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Lead Conversion Funnel" loading={lLoad}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Funnel dataKey="value" data={leadFunnel} isAnimationActive>
                    <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" style={{ fontSize: 11 }} />
                    {leadFunnel.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Contact score distribution */}
        <ChartCard title="Contact Score Distribution" loading={cLoad} className="mt-6">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreBuckets} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUT }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUT }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Contacts" fill={INDIGO} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      {/* ── Sales Analytics ───────────────────────────────────────────── */}
      <section>
        <SectionTitle icon={Target} title="Sales Analytics" subtitle="Pipeline value by stage and win/loss breakdown" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ChartCard title="Pipeline Value by Stage" loading={pLoad} className="md:col-span-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUT }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUT }} tickFormatter={v => `$${v/1000}k`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`, "Value"]} />
                  <Bar dataKey="value" fill={CYAN} radius={[4, 4, 0, 0]}>
                    {pipelineData.map((_, i) => (
                      <Cell key={i} fill={
                        _.stage === "closed won" ? "#34d399" :
                        _.stage === "closed lost" ? DESTR :
                        CYAN
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Win / Loss / Open" loading={dLoad}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={winLoss} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {winLoss.map((entry, i) => (
                      <Cell key={i} fill={entry.name === "Won" ? "#34d399" : entry.name === "Lost" ? DESTR : INDIGO} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </section>

      {/* ── Support Analytics ─────────────────────────────────────────── */}
      <section>
        <SectionTitle icon={TicketCheck} title="Support Analytics" subtitle="Ticket priority, status, and resolution distribution" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title="Tickets by Priority" loading={tLoad}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ticketPriority} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={renderPieLabel} labelLine={false}>
                    {ticketPriority.map((entry, i) => (
                      <Cell key={i} fill={
                        entry.name === "urgent" ? DESTR :
                        entry.name === "high" ? WARN :
                        entry.name === "medium" ? INDIGO : MUT
                      } />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Tickets by Status" loading={tLoad}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ticketStatus} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUT }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUT }} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {ticketStatus.map((entry, i) => (
                      <Cell key={i} fill={
                        entry.name === "resolved" || entry.name === "closed" ? "#34d399" :
                        entry.name === "open" ? CYAN :
                        INDIGO
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </section>

      {/* ── Marketing Analytics ───────────────────────────────────────── */}
      {campaignPerf.length > 0 && (
        <section>
          <SectionTitle icon={Megaphone} title="Marketing Analytics" subtitle="Campaign open rate vs click-through rate" />
          <ChartCard title="Campaign Performance Comparison" loading={mLoad}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignPerf} margin={{ left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: MUT }} angle={-25} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUT }} tickFormatter={v => `${v}%`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="openRate" name="Open Rate" fill={CYAN} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="clickRate" name="Click Rate" fill={INDIGO} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </section>
      )}

      {/* ── Finance Analytics ─────────────────────────────────────────── */}
      <section>
        <SectionTitle icon={Receipt} title="Finance Analytics" subtitle="Revenue realization by invoice status" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title="Revenue by Invoice Status ($)" loading={iLoad}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={invoiceStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3} label={({ name }) => name} labelLine={true}>
                    {invoiceStatus.map((entry, i) => (
                      <Cell key={i} fill={
                        entry.name === "paid" ? "#34d399" :
                        entry.name === "overdue" ? DESTR :
                        entry.name === "sent" ? WARN :
                        MUT
                      } />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Invoice Count by Status" loading={iLoad}>
            <div className="h-52 flex flex-col justify-center gap-3 px-2">
              {Object.entries(
                (invoices ?? []).reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status] || 0) + 1 }), {} as Record<string, number>)
              ).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                const total = invoices?.length || 1;
                const pct = Math.round((count / total) * 100);
                const color = status === "paid" ? "bg-emerald-500" : status === "overdue" ? "bg-destructive" : status === "sent" ? "bg-warning" : "bg-muted-foreground";
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="capitalize text-foreground">{status}</span>
                      <span className="text-muted-foreground">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      </section>
    </div>
  );
}
