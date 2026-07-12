import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Send, Loader2, TrendingUp, BarChart3, AlertTriangle,
  Zap, Brain, Target, DollarSign, Users, ChevronRight,
  Sparkles, RefreshCw, MessageSquare, ArrowUpRight, Shield,
  TrendingDown, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API = "/api";

type Message = { role: "user" | "assistant"; content: string; suggestions?: string[] };
type DealScore = { id: number; title: string; stage: string; value: number; probability: number; winProbability: number; contactName: string; companyName: string; };
type Intelligence = { pipelineValue: number; closedWonValue: number; totalInvoiced: number; totalPaid: number; hotLeads: number; trend: { month: string; revenue: number; deals: number }[]; insights: string[]; enabled: boolean; };
type Brief = { greeting?: string; summary?: string; priorities?: string[]; highlights?: string[]; enabled: boolean; };
type AnomalyItem = { id?: number; title: string; module: string; description: string; severity?: string; };

const QUICK_PROMPTS = [
  "What deals need my attention today?",
  "Summarize pipeline health",
  "Which leads are ready to qualify?",
  "What's my revenue forecast this quarter?",
  "Show top risks in my pipeline",
  "Analyze overdue invoices",
];

function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery({ queryKey: ["ai-status"], queryFn: () => fetch(`${API}/ai/status`).then(r => r.json()) });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || loading) return;
    setInput("");
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/ai/copilot`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, suggestions: data.suggestions }]);
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect to the AI service." }]); }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      {!status?.enabled && (
        <div className="mx-4 mt-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-yellow-300">Full AI requires an <strong>OPENAI_API_KEY</strong> secret. Features work with smart defaults until then.</p>
        </div>
      )}

      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-mono font-semibold text-lg mb-1">NEXUS Copilot</h3>
          <p className="text-muted-foreground font-mono text-sm text-center mb-6">Ask anything about your pipeline, contacts, revenue, or operations.</p>
          <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => send(p)}
                className="text-left p-3 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-muted/50 transition-colors text-xs font-mono text-muted-foreground hover:text-foreground">
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-xl p-3", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border")}>
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Cpu className="h-3 w-3 text-primary" />
                      <span className="text-xs font-mono text-primary font-semibold">NEXUS</span>
                    </div>
                  )}
                  <p className="text-sm font-mono whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {m.suggestions.map(s => (
                        <button key={s} onClick={() => send(s)} className="text-xs font-mono px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors">{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-xs font-mono text-muted-foreground">Thinking…</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={bottomRef} />
        </ScrollArea>
      )}

      <div className="p-4 border-t border-border shrink-0">
        <div className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()} placeholder="Ask anything about your business…" className="font-mono text-sm" />
          <Button onClick={() => send()} disabled={!input.trim() || loading} size="sm" className="px-3">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WinProbabilityPanel() {
  const { data, isLoading } = useQuery<{ deals: DealScore[]; enabled: boolean }>({
    queryKey: ["win-probability"],
    queryFn: () => fetch(`${API}/ai/deals/win-probability`).then(r => r.json()),
  });

  const STAGE_ORDER = ["prospecting", "qualification", "proposal", "negotiation", "closed-won", "closed-lost"];

  const chartData = data?.deals.map(d => ({ name: d.title.substring(0, 16), score: d.winProbability, value: Math.round(d.value / 1000) })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono font-semibold">Deal Win Probability</h3>
        {!data?.enabled && <Badge variant="outline" className="font-mono text-xs text-yellow-400 border-yellow-500/30">Heuristic mode</Badge>}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          {chartData.length > 0 && (
            <Card className="border-border">
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "monospace" }} stroke="rgba(255,255,255,0.2)" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontFamily: "monospace" }} stroke="rgba(255,255,255,0.2)" />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Win Probability"]} contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "monospace", fontSize: 12 }} />
                    <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {(data?.deals ?? []).slice(0, 8).map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{d.companyName} · {d.stage}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono text-green-400">${d.value.toLocaleString()}</p>
                  <div className={cn("text-sm font-mono font-bold", d.winProbability >= 60 ? "text-green-400" : d.winProbability >= 30 ? "text-yellow-400" : "text-red-400")}>
                    {d.winProbability}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RevenueIntelPanel() {
  const { data, isLoading, refetch } = useQuery<Intelligence>({
    queryKey: ["revenue-intelligence"],
    queryFn: () => fetch(`${API}/ai/revenue-intelligence`).then(r => r.json()),
  });

  const fmt = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono font-semibold">Revenue Intelligence</h3>
        <Button size="sm" variant="ghost" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Weighted Pipeline", value: fmt(data?.pipelineValue ?? 0), icon: Target, color: "text-blue-400" },
              { label: "Closed Won", value: fmt(data?.closedWonValue ?? 0), icon: TrendingUp, color: "text-green-400" },
              { label: "Invoiced", value: fmt(data?.totalInvoiced ?? 0), icon: DollarSign, color: "text-purple-400" },
              { label: "Hot Leads", value: String(data?.hotLeads ?? 0), icon: Users, color: "text-orange-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <Icon className={cn("h-4 w-4 shrink-0", color)} />
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">{label}</p>
                    <p className={cn("text-lg font-mono font-bold", color)}>{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {data?.insights && data.insights.length > 0 && (
            <div className="space-y-2">
              {data.insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs font-mono text-foreground/80">{ins}</p>
                </div>
              ))}
            </div>
          )}

          {data?.trend && data.trend.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-mono">Revenue Trend (6mo)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={data.trend}>
                    <defs>
                      <linearGradient id="rvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "monospace" }} stroke="rgba(255,255,255,0.2)" />
                    <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fontFamily: "monospace" }} stroke="rgba(255,255,255,0.2)" />
                    <Tooltip formatter={(v: any) => [fmt(Number(v)), "Revenue"]} contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "monospace", fontSize: 12 }} />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#rvGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MorningBriefPanel() {
  const { data, isLoading, refetch } = useQuery<Brief>({
    queryKey: ["morning-brief"],
    queryFn: () => fetch(`${API}/ai/morning-brief`).then(r => r.json()),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono font-semibold">Morning Brief</h3>
        <Button size="sm" variant="ghost" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {data?.greeting && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-primary" /><span className="font-mono text-sm font-semibold text-primary">Good morning</span></div>
              <p className="font-mono text-sm">{data.greeting}</p>
            </div>
          )}
          {data?.summary && (
            <div>
              <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">Summary</p>
              <p className="font-mono text-sm">{data.summary}</p>
            </div>
          )}
          {data?.priorities && data.priorities.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">Today's Priorities</p>
              <div className="space-y-2">
                {data.priorities.map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs font-mono text-primary font-bold shrink-0 mt-0.5">{i + 1}.</span>
                    <p className="text-sm font-mono">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data?.highlights && data.highlights.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">Highlights</p>
              <div className="space-y-1">
                {data.highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-mono">
                    <ChevronRight className="h-3 w-3 text-primary" />{h}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!data?.enabled && (
            <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
              <p className="text-xs font-mono text-yellow-300">Add <strong>OPENAI_API_KEY</strong> to unlock AI-generated briefs.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AiCommandCenter() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Cpu className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-mono font-bold">NEXUS AI</h1>
          <p className="text-muted-foreground font-mono text-sm">Copilot · Revenue Intelligence · Win Probability · Forecasting</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Copilot chat — takes more space */}
        <div className="lg:col-span-3">
          <Card className="border-border h-[600px] flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <CardTitle className="font-mono text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Copilot Chat
              </CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-hidden">
              <ChatPanel />
            </div>
          </Card>
        </div>

        {/* Right panel tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="brief">
            <TabsList className="font-mono w-full">
              <TabsTrigger value="brief" className="flex-1">Brief</TabsTrigger>
              <TabsTrigger value="revenue" className="flex-1">Revenue</TabsTrigger>
              <TabsTrigger value="deals" className="flex-1">Deals</TabsTrigger>
            </TabsList>
            <TabsContent value="brief" className="mt-4">
              <Card className="border-border"><CardContent className="p-4"><MorningBriefPanel /></CardContent></Card>
            </TabsContent>
            <TabsContent value="revenue" className="mt-4">
              <Card className="border-border"><CardContent className="p-4"><RevenueIntelPanel /></CardContent></Card>
            </TabsContent>
            <TabsContent value="deals" className="mt-4">
              <Card className="border-border"><CardContent className="p-4"><WinProbabilityPanel /></CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
