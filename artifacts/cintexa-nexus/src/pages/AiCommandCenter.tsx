import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Send, Loader2, Zap, Globe, Image, FileText, Database,
  Sparkles, RefreshCw, MessageSquare, ChevronRight, X, Download,
  Trash2, Plus, Search, BookOpen, Cpu, BarChart3, TrendingUp,
  DollarSign, Users, Target, Shield, Code2, Cloud, Palette,
  Map, Activity, Wrench, Smartphone, PenLine, Bot, Eye,
  CheckCircle, Clock, AlertTriangle, Video, File, Wand2, Star,
  Copy, MemoryStick, Network, CircleDot, Crown, Building2,
  Gem, Rocket, UserCheck, Crosshair, Headphones, Scale, UserSearch,
  FlaskConical, Monitor, PenSquare, LineChart, Trophy, Calendar,
  Settings, Shuffle, LayoutDashboard, Clapperboard, Layers,
  Swords, Lightbulb, Cpu as CpuIcon, FileSearch, Mic, ScanEye,
  Keyboard, GitMerge, Workflow, Telescope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API = "/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Expert = { id: string; name: string; icon: string; color: string; specialty: string; category?: string };
type ExpertResponse = { expertId: string; name: string; icon: string; response: string };
type Memory = { id: number; memoryType: string; key: string; value: string; confidence: number; source: string; tags: string[]; createdAt: string };
type GeneratedFile = { id: number; title: string; fileType: string; mimeType: string; url?: string; content?: string; prompt?: string; createdAt: string };

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  expertResponses?: ExpertResponse[];
  webSearchUsed?: boolean;
  imageUrl?: string;
  document?: { title: string; content: string; type: string; filename: string };
  memoriesSaved?: number;
  suggestedPrompts?: string[];
  experts?: string[];
  timestamp: Date;
  isStreaming?: boolean;
};

// ── Expert icon map ───────────────────────────────────────────────────────────

const EXPERT_ICONS: Record<string, React.ElementType> = {
  // Domain Experts
  sales: TrendingUp, marketing: Zap, finance: DollarSign, projects: CheckCircle,
  "software-architect": Code2, "ai-ml": Brain, cto: Wrench, database: Database,
  devops: Cloud, security: Shield, "ux-design": Palette, product: Map,
  bi: BarChart3, automation: Activity, api: Network, qa: CircleDot,
  mobile: Smartphone, "technical-writer": PenLine,
  // AI Employees
  "ai-ceo": Crown, "ai-coo": Building2, "ai-cfo": Gem, "ai-cmo": Rocket,
  "ai-hr": UserCheck, "ai-sales-manager": Crosshair, "ai-customer-support": Headphones,
  "ai-legal": Scale, "ai-recruiting": UserSearch, "ai-research": FlaskConical,
  "ai-developer": Monitor, "ai-content": PenSquare, "ai-data-analyst": LineChart,
  "ai-consultant": Trophy, "ai-meeting-assistant": Calendar,
  "ai-automation-builder": Settings, "ai-workflow-designer": Shuffle,
  "ai-bi-manager": LayoutDashboard,
  // Platform Intelligence
  "content-creator": Clapperboard, "salesforce-agentforce": Cloud,
  "microsoft-copilot": Layers, "hubspot-ai": Zap, "zoho-zia": Database,
  "freddy-ai": Star, "clickup-ai": CheckCircle, "notion-ai": BookOpen,
  "intercom-fin": MessageSquare, "gohighlevel-ai": TrendingUp,
  // Capability Agents
  forecasting: Telescope, "competitive-analysis": Swords, recommendations: Lightbulb,
  "autonomous-execution": CpuIcon, "document-intelligence": FileSearch,
  "voice-intelligence": Mic, "vision-analysis": ScanEye,
  "code-generation": Keyboard, "multi-agent": GitMerge,
  "memory-reasoning": MemoryStick, "planning-agent": Workflow,
};

// ── Markdown-lite renderer ────────────────────────────────────────────────────

function RenderMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) return <h3 key={i} className="font-mono font-bold text-sm text-primary mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("## "))  return <h2 key={i} className="font-mono font-bold text-base text-foreground mt-4 mb-1">{line.slice(3)}</h2>;
        if (line.startsWith("# "))   return <h1 key={i} className="font-mono font-bold text-lg text-foreground mt-4 mb-2">{line.slice(2)}</h1>;
        if (line.startsWith("- ") || line.startsWith("• ")) return (
          <div key={i} className="flex items-start gap-2 ml-2">
            <span className="text-primary shrink-0 mt-1">•</span>
            <span className="font-mono text-sm leading-relaxed">{formatInline(line.slice(2))}</span>
          </div>
        );
        if (/^\d+\. /.test(line)) {
          const [num, ...rest] = line.split(". ");
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <span className="text-primary font-bold shrink-0 mt-0.5 text-xs">{num}.</span>
              <span className="font-mono text-sm leading-relaxed">{formatInline(rest.join(". "))}</span>
            </div>
          );
        }
        if (line.startsWith("```")) return <div key={i} className="bg-black/40 rounded px-3 py-1 font-mono text-xs text-green-400 my-1">{line}</div>;
        if (line === "") return <div key={i} className="h-2" />;
        return <p key={i} className="font-mono text-sm leading-relaxed">{formatInline(line)}</p>;
      })}
    </div>
  );
}

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i} className="italic text-foreground/90">{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="bg-black/40 text-green-400 px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}

// ── Quick prompts per category ────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { label: "Pipeline Review", prompt: "Give me a full pipeline health review with actionable recommendations", icon: TrendingUp },
  { label: "Revenue Forecast", prompt: "Create a detailed Q3/Q4 revenue forecast with scenario modeling (base, bull, bear case)", icon: DollarSign },
  { label: "Competitive Intel", prompt: "Analyze our competitive landscape versus Salesforce, HubSpot, and other CRM/AI platforms and give me a differentiation strategy", icon: Swords },
  { label: "AI Strategy", prompt: "Design a comprehensive AI implementation roadmap for our business operations for the next 12 months", icon: Brain },
  { label: "CEO Briefing", prompt: "As my AI CEO, give me an executive brief on our current business health and the top 3 strategic priorities", icon: Crown },
  { label: "Automation Map", prompt: "Identify the top 10 manual processes in our business that should be automated and build an execution plan", icon: Settings },
  { label: "Board Report", prompt: "Generate a comprehensive executive board report covering all business metrics, risks, and strategic recommendations", icon: FileText },
  { label: "Growth Plan", prompt: "Create a detailed growth plan targeting 40% ARR increase in the next 2 quarters with specific tactics", icon: Rocket },
  { label: "Market Research", prompt: "Search the web for the latest B2B SaaS market trends and AI-powered CRM competitive landscape in 2026", icon: Globe },
  { label: "Security Audit", prompt: "Conduct a security audit of our operations and identify top 5 vulnerability areas with remediation steps", icon: Shield },
  { label: "UX Analysis", prompt: "Analyze our current user experience and recommend improvements to increase conversion and retention", icon: Palette },
  { label: "HR & Culture", prompt: "As my AI HR Director, assess our team structure and recommend improvements to culture, retention, and hiring", icon: Users },
];

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, onSend, onDownloadDoc }: {
  msg: Message;
  onSend: (text: string) => void;
  onDownloadDoc: (doc: { content: string; filename: string; mimeType: string }) => void;
}) {
  const [showExperts, setShowExperts] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (msg.role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div className="max-w-[75%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-3">
          <p className="font-mono text-sm leading-relaxed">{msg.content}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
      <div className="max-w-[90%] space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Cpu className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-mono font-bold text-primary">NEXUS AI</span>
          {msg.webSearchUsed && (
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 h-4 border-blue-500/40 text-blue-400 gap-1">
              <Globe className="h-2.5 w-2.5" /> Web
            </Badge>
          )}
          {msg.experts && msg.experts.length > 0 && (
            <button onClick={() => setShowExperts(v => !v)}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <Bot className="h-2.5 w-2.5" />
              {msg.experts.length} expert{msg.experts.length !== 1 ? "s" : ""}
            </button>
          )}
          {msg.memoriesSaved && msg.memoriesSaved > 0 ? (
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 h-4 border-emerald-500/40 text-emerald-400 gap-1">
              <MemoryStick className="h-2.5 w-2.5" /> Learned {msg.memoriesSaved}
            </Badge>
          ) : null}
        </div>

        {/* Expert badges expanded */}
        <AnimatePresence>
          {showExperts && msg.expertResponses && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden">
              {msg.expertResponses.map(er => {
                const IconComp = EXPERT_ICONS[er.expertId] ?? Bot;
                return (
                  <div key={er.expertId} className="bg-black/30 rounded-lg p-3 border border-border/50">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm">{er.icon}</span>
                      <span className="font-mono text-xs font-semibold text-foreground/80">{er.name}</span>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed line-clamp-4">{er.response}</p>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 space-y-3">
          {msg.isStreaming ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-xs font-mono text-muted-foreground">Synthesizing expert insights…</span>
            </div>
          ) : (
            <RenderMarkdown text={msg.content} />
          )}

          {/* Generated image */}
          {msg.imageUrl && (
            <div className="mt-3">
              <div className="rounded-lg overflow-hidden border border-border">
                <img src={msg.imageUrl} alt="AI generated" className="w-full max-h-64 object-cover" onError={e => (e.currentTarget.style.display = "none")} />
              </div>
              <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs font-mono text-primary hover:underline mt-1 flex items-center gap-1">
                <Eye className="h-3 w-3" /> View full image
              </a>
            </div>
          )}

          {/* Generated document */}
          {msg.document && (
            <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-mono text-xs font-semibold">{msg.document.title}</span>
                </div>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs font-mono gap-1"
                  onClick={() => onDownloadDoc({ content: msg.document!.content, filename: msg.document!.filename, mimeType: `text/${msg.document!.type}` })}>
                  <Download className="h-3 w-3" /> Download
                </Button>
              </div>
              <pre className="text-xs font-mono text-muted-foreground bg-black/30 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">{msg.document.content.substring(0, 500)}{msg.document.content.length > 500 ? "…" : ""}</pre>
            </div>
          )}

          {/* Actions */}
          {!msg.isStreaming && (
            <div className="flex items-center gap-1 pt-1">
              <button onClick={copy} className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
                {copied ? <CheckCircle className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.suggestedPrompts.map(p => (
              <button key={p} onClick={() => onSend(p)}
                className="text-[11px] font-mono px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

function ChatPanel({ experts }: { experts: Expert[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [genImage, setGenImage] = useState(false);
  const [genDoc, setGenDoc] = useState<"" | "markdown" | "html" | "csv" | "json" | "video_script">("");
  const [selectedExperts, setSelectedExperts] = useState<string[]>([]);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const downloadDoc = ({ content, filename, mimeType }: { content: string; filename: string; mimeType: string }) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const send = useCallback(async (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: msg, timestamp: new Date() };
    const thinkingMsg: Message = {
      id: `a-${Date.now()}`, role: "assistant",
      content: "Consulting expert agents…", isStreaming: true,
      timestamp: new Date(), experts: selectedExperts.length > 0 ? selectedExperts : undefined,
    };

    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content, expertName: undefined }));
      const res = await fetch(`${API}/nexus/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg, history, sessionId,
          useWebSearch, generateImage: genImage,
          generateDocument: genDoc || undefined,
          requestedExperts: selectedExperts.length > 0 ? selectedExperts : undefined,
        }),
      });
      const data = await res.json();

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.synthesis ?? data.reply ?? "No response generated.",
        expertResponses: data.expertResponses,
        webSearchUsed: data.webSearchUsed,
        imageUrl: data.imageUrl,
        document: data.document,
        memoriesSaved: data.memoriesSaved,
        suggestedPrompts: data.suggestedPrompts,
        experts: data.expertResponses?.map((e: ExpertResponse) => e.expertId),
        timestamp: new Date(),
      };

      setMessages(prev => prev.slice(0, -1).concat(assistantMsg));
    } catch {
      setMessages(prev => prev.slice(0, -1).concat({
        id: `e-${Date.now()}`, role: "assistant",
        content: "Connection error — please try again.", timestamp: new Date(),
      }));
    }
    setLoading(false);
  }, [input, loading, messages, sessionId, useWebSearch, genImage, genDoc, selectedExperts]);

  const toggleExpert = (id: string) => {
    setSelectedExperts(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls bar */}
      <div className="px-4 py-2 border-b border-border flex flex-wrap items-center gap-3 shrink-0 bg-card/50">
        <div className="flex items-center gap-2">
          <Switch id="web-search" checked={useWebSearch} onCheckedChange={setUseWebSearch} className="scale-75" />
          <Label htmlFor="web-search" className="text-xs font-mono flex items-center gap-1 cursor-pointer">
            <Globe className="h-3 w-3 text-blue-400" /> Web Search
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="gen-img" checked={genImage} onCheckedChange={setGenImage} className="scale-75" />
          <Label htmlFor="gen-img" className="text-xs font-mono flex items-center gap-1 cursor-pointer">
            <Image className="h-3 w-3 text-purple-400" /> Image
          </Label>
        </div>
        <Select value={genDoc} onValueChange={(v: any) => setGenDoc(v)}>
          <SelectTrigger className="h-6 w-28 text-xs font-mono border-border/50">
            <SelectValue placeholder="📄 Document" />
          </SelectTrigger>
          <SelectContent className="font-mono text-xs">
            <SelectItem value="">No document</SelectItem>
            <SelectItem value="markdown">Markdown</SelectItem>
            <SelectItem value="html">HTML Report</SelectItem>
            <SelectItem value="csv">CSV Export</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="video_script">Video Script</SelectItem>
          </SelectContent>
        </Select>
        {selectedExperts.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono text-muted-foreground">{selectedExperts.length} experts locked</span>
            <button onClick={() => setSelectedExperts([])} className="text-xs text-red-400 hover:text-red-300">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Messages or empty state */}
      {messages.length === 0 ? (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center mx-auto mb-3">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-mono font-bold text-lg mb-1">NEXUS AI</h3>
            <p className="text-muted-foreground font-mono text-xs max-w-sm mx-auto mb-2">
              {experts.length}+ parallel agents · Domain Experts · AI Employees · Platform Intelligence · Capability Agents
            </p>
            <div className="flex flex-wrap justify-center gap-1 max-w-sm mx-auto">
              {["Memory", "Reasoning", "Planning", "Forecasting", "Multi-agent", "Code Gen", "Vision", "Voice", "Autonomous"].map(cap => (
                <span key={cap} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-primary/20 text-primary/60">{cap}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_PROMPTS.map(({ label, prompt, icon: Icon }) => (
              <button key={label} onClick={() => send(prompt)}
                className="text-left p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all group">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-xs font-semibold group-hover:text-primary transition-colors">{label}</span>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{prompt}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-5">
            {messages.map(m => (
              <MessageBubble key={m.id} msg={m} onSend={send} onDownloadDoc={downloadDoc} />
            ))}
          </div>
          <div ref={bottomRef} />
        </ScrollArea>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask anything… Shift+Enter for new line"
            className="font-mono text-sm min-h-[40px] max-h-32 resize-none"
            rows={1}
          />
          <Button onClick={() => send()} disabled={!input.trim() || loading} size="sm" className="px-3 shrink-0 self-end">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {useWebSearch && <span className="text-[10px] font-mono text-blue-400 flex items-center gap-0.5"><Globe className="h-2.5 w-2.5" /> Searching web</span>}
          {genImage && <span className="text-[10px] font-mono text-purple-400 flex items-center gap-0.5"><Image className="h-2.5 w-2.5" /> Generating image</span>}
          {genDoc && <span className="text-[10px] font-mono text-orange-400 flex items-center gap-0.5"><FileText className="h-2.5 w-2.5" /> Creating {genDoc}</span>}
          {selectedExperts.length > 0 && (
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
              <Bot className="h-2.5 w-2.5" /> {selectedExperts.length} selected expert{selectedExperts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Category color map ────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  "Domain Experts":       "border-blue-500/40 text-blue-400",
  "AI Employees":         "border-emerald-500/40 text-emerald-400",
  "Platform Intelligence":"border-orange-500/40 text-orange-400",
  "Capability Agents":    "border-purple-500/40 text-purple-400",
};

// ── Experts Panel ─────────────────────────────────────────────────────────────

function ExpertsPanel({ experts, onAskExpert }: { experts: Expert[]; onAskExpert: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const categories = ["all", ...Array.from(new Set(experts.map((e: any) => e.category).filter(Boolean)))];

  const filtered = experts.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.specialty.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "all" || (e as any).category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const askExpert = async () => {
    if (!selected || !query.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const res = await fetch(`${API}/nexus/expert/${selected}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });
      const data = await res.json();
      setResult(data.response ?? "No response");
    } catch { setResult("Failed to reach expert."); }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${experts.length} agents…`} className="pl-9 font-mono text-xs h-8" />
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={cn("px-2 py-0.5 rounded-full font-mono text-[10px] border transition-all",
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary"
                : cn("border-border text-muted-foreground hover:border-primary/40", cat !== "all" && CATEGORY_COLORS[cat]))}>
            {cat === "all" ? `All (${experts.length})` : cat.replace("Agents", "").replace("Intelligence", "Intel").trim()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {filtered.map(e => {
          const IconComp = EXPERT_ICONS[e.id] ?? Bot;
          const catColor = CATEGORY_COLORS[(e as any).category ?? ""] ?? "";
          return (
            <button key={e.id} onClick={() => setSelected(sel => sel === e.id ? null : e.id)}
              className={cn("p-2.5 rounded-xl border text-left transition-all",
                selected === e.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40 hover:bg-primary/5")}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{e.icon}</span>
                <span className="font-mono text-[10px] font-semibold truncate leading-tight">{e.name}</span>
              </div>
              <p className="font-mono text-[9px] text-muted-foreground leading-relaxed line-clamp-2">{e.specialty}</p>
              {(e as any).category && (
                <Badge variant="outline" className={cn("mt-1.5 text-[8px] font-mono px-1 h-3.5", catColor)}>
                  {(e as any).category.split(" ")[0]}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
            <p className="font-mono text-xs text-primary font-semibold mb-1">
              {experts.find(e => e.id === selected)?.icon} Consulting: {experts.find(e => e.id === selected)?.name}
            </p>
            <Textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="Ask this expert a specific question…"
              className="font-mono text-xs min-h-[60px] resize-none bg-transparent border-border/50 mt-2" rows={2} />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={askExpert} disabled={!query.trim() || loading} className="text-xs font-mono gap-1">
                {loading ? <><Loader2 className="h-3 w-3 animate-spin" /> Asking…</> : <><Send className="h-3 w-3" /> Ask</>}
              </Button>
            </div>
          </div>
          {result && (
            <div className="p-3 bg-card border border-border rounded-xl">
              <RenderMarkdown text={result} />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Memory Panel ──────────────────────────────────────────────────────────────

function MemoryPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ memories: Memory[]; total: number }>({
    queryKey: ["nexus-memory"],
    queryFn: () => fetch(`${API}/nexus/memory`).then(r => r.json()),
  });

  const learn = useMutation({
    mutationFn: () => fetch(`${API}/nexus/learn`, { method: "POST" }).then(r => r.json()),
    onSuccess: (d) => { toast.success(d.message ?? "Learning complete"); qc.invalidateQueries({ queryKey: ["nexus-memory"] }); },
  });

  const forget = useMutation({
    mutationFn: (id: number) => fetch(`${API}/nexus/memory/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nexus-memory"] }),
  });

  const typeColors: Record<string, string> = {
    fact: "text-blue-400 border-blue-500/30",
    preference: "text-yellow-400 border-yellow-500/30",
    pattern: "text-purple-400 border-purple-500/30",
    insight: "text-emerald-400 border-emerald-500/30",
    learning: "text-orange-400 border-orange-500/30",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-mono font-semibold text-sm">NEXUS Memory</h3>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            {data?.total ?? 0} facts learned · continuously growing
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => learn.mutate()} disabled={learn.isPending}
          className="text-xs font-mono gap-1.5">
          {learn.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3 text-yellow-400" />}
          Learn Now
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {(data?.memories ?? []).map(m => (
              <motion.div key={m.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 4 }}>
                <div className="p-3 bg-card border border-border rounded-xl flex items-start gap-3 group hover:border-primary/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5 h-4", typeColors[m.memoryType] ?? "text-foreground")}>
                        {m.memoryType}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">conf: {m.confidence}%</span>
                    </div>
                    <p className="font-mono text-xs font-semibold text-foreground/90 truncate">{m.key}</p>
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{m.value}</p>
                  </div>
                  <button onClick={() => forget.mutate(m.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {(data?.memories ?? []).length === 0 && (
            <div className="text-center py-10">
              <MemoryStick className="h-8 w-8 mx-auto opacity-20 mb-2" />
              <p className="font-mono text-xs text-muted-foreground">No memories yet — chat with NEXUS to start learning</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create Panel (images, documents, files) ───────────────────────────────────

function CreatePanel() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"image" | "document">("image");

  // Image
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const [imgResult, setImgResult] = useState<{ url: string; prompt: string } | null>(null);

  // Document
  const [docTopic, setDocTopic] = useState("");
  const [docType, setDocType] = useState<"markdown" | "html" | "csv" | "json" | "video_script">("markdown");
  const [docLoading, setDocLoading] = useState(false);
  const [docResult, setDocResult] = useState<{ title: string; content: string; filename: string; type: string } | null>(null);

  const { data: filesData, refetch: refetchFiles } = useQuery<{ files: GeneratedFile[] }>({
    queryKey: ["nexus-files"],
    queryFn: () => fetch(`${API}/nexus/files`).then(r => r.json()),
  });

  const generateImage = async () => {
    if (!imgPrompt.trim()) return;
    setImgLoading(true); setImgResult(null);
    try {
      const res = await fetch(`${API}/nexus/generate-image`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imgPrompt }),
      });
      const data = await res.json();
      setImgResult({ url: data.url, prompt: data.prompt });
      refetchFiles();
      toast.success("Image generated!");
    } catch { toast.error("Image generation failed"); }
    setImgLoading(false);
  };

  const generateDocument = async () => {
    if (!docTopic.trim()) return;
    setDocLoading(true); setDocResult(null);
    try {
      const res = await fetch(`${API}/nexus/generate-document`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: docTopic, type: docType }),
      });
      const data = await res.json();
      setDocResult(data);
      refetchFiles();
      toast.success("Document created!");
    } catch { toast.error("Document generation failed"); }
    setDocLoading(false);
  };

  const downloadDoc = (doc: typeof docResult) => {
    if (!doc) return;
    const mimeMap: Record<string, string> = {
      markdown: "text/markdown", html: "text/html", csv: "text/csv",
      json: "application/json", video_script: "text/plain",
    };
    const blob = new Blob([doc.content], { type: mimeMap[doc.type] ?? "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = doc.filename; a.click();
    URL.revokeObjectURL(url);
  };

  const docTypeIcons: Record<string, React.ElementType> = {
    markdown: FileText, html: Globe, csv: BarChart3, json: Code2, video_script: Video,
  };

  return (
    <div className="space-y-4">
      {/* Mode switch */}
      <div className="flex gap-2">
        {(["image", "document"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={cn("flex-1 py-2 rounded-lg font-mono text-xs font-semibold transition-all border",
              mode === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
            {m === "image" ? "🖼️ Image" : "📄 Document"}
          </button>
        ))}
      </div>

      {mode === "image" ? (
        <div className="space-y-3">
          <Textarea value={imgPrompt} onChange={e => setImgPrompt(e.target.value)}
            placeholder="Describe the image… e.g. 'Q3 revenue growth dashboard, dark theme, professional business visualization'"
            className="font-mono text-xs min-h-[80px] resize-none" rows={3} />
          <Button onClick={generateImage} disabled={!imgPrompt.trim() || imgLoading} className="w-full font-mono text-xs gap-2">
            {imgLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Wand2 className="h-4 w-4" /> Generate Image</>}
          </Button>
          {imgResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              <div className="rounded-xl overflow-hidden border border-border">
                <img src={imgResult.url} alt={imgResult.prompt} className="w-full object-cover max-h-56"
                  onError={e => (e.currentTarget.parentElement!.innerHTML = `<div class="p-4 text-center font-mono text-xs text-muted-foreground">Image loading from Pollinations.ai…<br/><a href="${imgResult.url}" target="_blank" class="text-primary underline mt-1 block">Open directly</a></div>`)} />
              </div>
              <div className="flex gap-2">
                <a href={imgResult.url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-1.5 rounded-lg border border-border text-xs font-mono text-center hover:border-primary/40 transition-colors flex items-center justify-center gap-1">
                  <Eye className="h-3 w-3" /> Open full size
                </a>
                <a href={imgResult.url} download="nexus-image.jpg"
                  className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-mono text-center flex items-center justify-center gap-1">
                  <Download className="h-3 w-3" /> Download
                </a>
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
            <SelectTrigger className="font-mono text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="font-mono text-xs">
              {(["markdown", "html", "csv", "json", "video_script"] as const).map(t => {
                const DocIcon = docTypeIcons[t] ?? File;
                return <SelectItem key={t} value={t}><span className="flex items-center gap-2"><DocIcon className="h-3 w-3" />{t}</span></SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Textarea value={docTopic} onChange={e => setDocTopic(e.target.value)}
            placeholder="Describe what to create… e.g. 'Executive board report with all business KPIs and Q3 strategy'"
            className="font-mono text-xs min-h-[80px] resize-none" rows={3} />
          <Button onClick={generateDocument} disabled={!docTopic.trim() || docLoading} className="w-full font-mono text-xs gap-2">
            {docLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : <><Sparkles className="h-4 w-4" /> Create Document</>}
          </Button>
          {docResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              <div className="p-3 bg-card border border-border rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-semibold">{docResult.title}</span>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs font-mono gap-1" onClick={() => downloadDoc(docResult)}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
                <pre className="font-mono text-[10px] text-muted-foreground bg-black/30 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">
                  {docResult.content.substring(0, 600)}{docResult.content.length > 600 ? "…" : ""}
                </pre>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Files library */}
      {(filesData?.files ?? []).length > 0 && (
        <div>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Generated Files</p>
          <div className="space-y-1.5">
            {(filesData?.files ?? []).slice(0, 8).map(f => {
              const FileIcon = f.fileType === "image" ? Image : f.fileType === "html" ? Globe : f.fileType === "csv" ? BarChart3 : f.fileType === "video_script" ? Video : FileText;
              return (
                <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card/50 hover:border-primary/30 transition-colors">
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs truncate">{f.title}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{f.fileType} · {new Date(f.createdAt).toLocaleDateString()}</p>
                  </div>
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0">
                      <Eye className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AiCommandCenter() {
  const { data: expertsData } = useQuery<Expert[]>({
    queryKey: ["nexus-experts"],
    queryFn: () => fetch(`${API}/nexus/experts`).then(r => r.json()),
  });
  const { data: status } = useQuery({
    queryKey: ["nexus-status"],
    queryFn: () => fetch(`${API}/nexus/status`).then(r => r.json()),
  });

  const experts = expertsData ?? [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div className={cn("absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
              status?.enabled ? "bg-green-400" : "bg-yellow-400")} />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold flex items-center gap-2">
              NEXUS AI
              {status?.enabled && <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5 border-green-500/40 text-green-400">ONLINE</Badge>}
            </h1>
            <p className="text-muted-foreground font-mono text-xs">
              {experts.length || "60"}+ parallel agents · AI Employees · Platform Intel · Capabilities · No restrictions
            </p>
          </div>
        </div>

        {/* Expert pills */}
        <div className="hidden lg:flex items-center gap-1 flex-wrap max-w-md">
          {experts.slice(0, 8).map(e => (
            <div key={e.id} className="text-lg" title={e.name}>{e.icon}</div>
          ))}
          {experts.length > 8 && <span className="font-mono text-xs text-muted-foreground">+{experts.length - 8}</span>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Chat — takes dominant space */}
        <div className="flex-1 min-w-0 border-r border-border flex flex-col">
          <ChatPanel experts={experts} />
        </div>

        {/* Right sidebar — tabbed panels */}
        <div className="w-96 shrink-0 flex flex-col overflow-hidden">
          <Tabs defaultValue="experts" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="font-mono text-xs shrink-0 mx-3 mt-3 grid grid-cols-3">
              <TabsTrigger value="experts" className="gap-1"><Bot className="h-3 w-3" /> Experts</TabsTrigger>
              <TabsTrigger value="create" className="gap-1"><Wand2 className="h-3 w-3" /> Create</TabsTrigger>
              <TabsTrigger value="memory" className="gap-1"><MemoryStick className="h-3 w-3" /> Memory</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-hidden">
              <TabsContent value="experts" className="h-full m-0 p-3 overflow-auto">
                <ExpertsPanel experts={experts} onAskExpert={() => {}} />
              </TabsContent>
              <TabsContent value="create" className="h-full m-0 p-3 overflow-auto">
                <CreatePanel />
              </TabsContent>
              <TabsContent value="memory" className="h-full m-0 p-3 overflow-auto">
                <MemoryPanel />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
