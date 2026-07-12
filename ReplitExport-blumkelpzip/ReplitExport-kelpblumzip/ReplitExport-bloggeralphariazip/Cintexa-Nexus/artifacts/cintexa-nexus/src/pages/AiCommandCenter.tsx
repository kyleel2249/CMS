import { useState, useRef, useEffect, useCallback } from "react";
import { useAiChat, useGetMorningBrief, getGetMorningBriefQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cpu, Send, Zap, User, Sparkles, Terminal, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Message = {
  role: "user" | "ai";
  content: string;
  suggestions?: string[];
  id: string;
};

// ── Live system log ───────────────────────────────────────────────────────────
const BOOT_LINES = [
  "NEXUS CORE v2.4.1 INITIALIZING",
  "Loading NLP inference engine...",
  "CRM module: 10 contacts indexed",
  "Sales module: 10 deals tracked",
  "Support module: 8 tickets loaded",
  "Finance module: 10 invoices synced",
  "Projects module: 6 matrices active",
  "Marketing module: 8 campaigns loaded",
  "Morning Brief compiled successfully",
  "All systems nominal. Ready for input.",
];

const AMBIENT_LINES = [
  "Heartbeat OK — 12ms latency",
  "Query cache hit rate: 94%",
  "Memory utilization: 31%",
  "AI context window: 128k tokens",
  "Pipeline value recalculated",
  "Activity feed synced",
  "Revenue chart refreshed",
  "Session uptime: optimal",
  "Anomaly detection: no alerts",
  "Vector store: 2,847 embeddings active",
  "Background sync complete",
  "Rate limiter: nominal",
];

function useSystemLog() {
  const [lines, setLines] = useState<{ text: string; ts: string }[]>([]);

  useEffect(() => {
    // Boot sequence
    BOOT_LINES.forEach((text, i) => {
      setTimeout(() => {
        const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLines((prev) => [...prev.slice(-19), { text, ts }]);
      }, i * 280);
    });

    // Ambient ticks after boot
    const interval = setInterval(() => {
      const text = AMBIENT_LINES[Math.floor(Math.random() * AMBIENT_LINES.length)];
      const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLines((prev) => [...prev.slice(-19), { text, ts }]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  return lines;
}

export default function AiCommandCenter() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "ai",
      content:
        "NEXUS Core Intelligence initialized. I have complete access to your CRM, pipeline, support tickets, and financial data. How can I assist you in optimizing operations today?",
      suggestions: [
        "Analyze current pipeline risk",
        "Summarize critical support tickets",
        "Generate Q3 revenue forecast",
      ],
    },
  ]);

  const { data: brief } = useGetMorningBrief({ query: { queryKey: getGetMorningBriefQueryKey() } });
  const chatMutation = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const systemLog = useSystemLog();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [systemLog]);

  const handleSend = useCallback(
    (text: string = input) => {
      if (!text.trim() || chatMutation.isPending) return;
      const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      chatMutation.mutate(
        { data: { message: text } },
        {
          onSuccess: (data) => {
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: "ai",
                content: data.reply,
                suggestions: data.suggestions,
              },
            ]);
          },
        }
      );
    },
    [input, chatMutation]
  );

  const quickPrompts = [
    "What are the top 3 deals at risk?",
    "Summarize overdue invoices",
    "Which campaigns have the best ROI?",
    "What's blocking our Q3 target?",
  ];

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 max-w-7xl mx-auto pb-6">
      {/* ── Main Chat ──────────────────────────────────────────────────── */}
      <Card className="flex-1 flex flex-col border-primary/30 shadow-[0_0_20px_rgba(0,255,255,0.05)] bg-card overflow-hidden">
        <CardHeader className="border-b border-primary/10 bg-muted/20 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-primary font-mono text-sm">
              <Terminal className="w-4 h-4" /> NEXUS CLI
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground">CORE ONLINE</span>
            </div>
          </div>
          {/* Quick prompts */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                disabled={chatMutation.isPending}
                className="text-[10px] font-mono px-2 py-1 rounded border border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
              >
                {p}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${
                      msg.role === "ai"
                        ? "bg-primary/20 text-primary border border-primary/50 shadow-[0_0_10px_rgba(0,255,255,0.2)]"
                        : "bg-secondary/20 text-secondary border border-secondary/50"
                    }`}
                  >
                    {msg.role === "ai" ? <Cpu className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  <div className={`space-y-3 ${msg.role === "user" ? "items-end flex flex-col" : ""}`}>
                    <div
                      className={`p-4 rounded-xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-secondary/10 border border-secondary/20 text-foreground"
                          : "bg-card border border-primary/20 text-foreground shadow-sm"
                      }`}
                    >
                      {msg.content}
                    </div>

                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {msg.suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(s)}
                            disabled={chatMutation.isPending}
                            className="text-xs font-mono px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1.5 disabled:opacity-40"
                          >
                            <Sparkles className="w-3 h-3" /> {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {chatMutation.isPending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                  <div className="w-8 h-8 rounded bg-primary/20 text-primary border border-primary/50 flex items-center justify-center animate-pulse">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-primary/20 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="text-xs font-mono text-primary ml-2">PROCESSING</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-primary/10 bg-card shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="relative flex items-center"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Query NEXUS intelligence..."
                className="pr-12 bg-muted/50 border-primary/30 focus-visible:ring-primary h-12 font-mono"
                disabled={chatMutation.isPending}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1 h-10 w-10"
                disabled={!input.trim() || chatMutation.isPending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground font-mono mt-2 text-center">
              NEXUS AI processes queries against live CRM, pipeline, support, and finance data.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Right Panel ───────────────────────────────────────────────── */}
      <div className="w-full md:w-80 flex flex-col gap-6 shrink-0">
        {/* Morning Brief context */}
        <Card className="border-border bg-card/50">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Zap className="w-4 h-4 text-warning" /> Current Context
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {brief ? (
              <>
                <div>
                  <div className="text-xs text-muted-foreground font-mono mb-1 uppercase">Directive</div>
                  <div className="text-sm font-medium">{brief.headline}</div>
                </div>
                <div className="space-y-2">
                  {brief.priorities.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex gap-2 text-sm border border-border/50 p-2 rounded bg-muted/20">
                      <span className="font-mono text-secondary shrink-0">{i + 1}.</span>
                      <span className="text-muted-foreground leading-tight">{p}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Skeleton className="h-24 w-full" />
            )}
          </CardContent>
        </Card>

        {/* Live system log */}
        <Card className="border-border bg-card/50 flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50 shrink-0">
            <CardTitle className="text-sm font-medium text-muted-foreground font-mono flex items-center justify-between">
              <span>SYSTEM LOG</span>
              <div className="flex items-center gap-1.5">
                <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-500">LIVE</span>
              </div>
            </CardTitle>
          </CardHeader>
          <div
            ref={logEndRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-1 custom-scrollbar"
          >
            <AnimatePresence initial={false}>
              {systemLog.map((line, i) => (
                <motion.div
                  key={`${line.ts}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2 text-muted-foreground"
                >
                  <span className="text-primary/40 shrink-0">{line.ts}</span>
                  <span className={i === systemLog.length - 1 ? "text-foreground" : ""}>&gt; {line.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>

        {/* Message count badge */}
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-1">
          <span>Session: {messages.length} messages</span>
          <Badge variant="outline" className="text-[10px] font-mono h-5">
            {chatMutation.isPending ? "THINKING" : "READY"}
          </Badge>
        </div>
      </div>
    </div>
  );
}
