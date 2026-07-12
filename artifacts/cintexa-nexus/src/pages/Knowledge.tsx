import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen, Search, Plus, Pin, Eye, ThumbsUp, ThumbsDown,
  Sparkles, ChevronRight, Tag, X, FileText, Star,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

const CATEGORIES = ["general", "onboarding", "product", "billing", "technical", "process", "hr", "sales"];
const CATEGORY_COLORS: Record<string, string> = {
  general:    "bg-muted/50 text-muted-foreground",
  onboarding: "bg-emerald-500/20 text-emerald-400",
  product:    "bg-primary/20 text-primary",
  billing:    "bg-amber-500/20 text-amber-400",
  technical:  "bg-violet-500/20 text-violet-400",
  process:    "bg-blue-500/20 text-blue-400",
  hr:         "bg-pink-500/20 text-pink-400",
  sales:      "bg-secondary/20 text-secondary",
};

type Article = {
  id: number;
  title: string;
  slug: string;
  content: string;
  category: string;
  tags: string | null;
  author: string;
  status: string;
  views: number;
  helpful: number;
  notHelpful: number;
  isPinned: boolean;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

function ArticleCard({ article, onClick }: { article: Article; onClick: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card
        className="border-border/50 bg-card/50 backdrop-blur hover:border-primary/30 transition-all cursor-pointer group"
        onClick={onClick}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {article.isPinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                <Badge className={`text-[10px] font-mono px-1.5 py-0 ${CATEGORY_COLORS[article.category] ?? "bg-muted/50 text-muted-foreground"}`}>
                  {article.category}
                </Badge>
              </div>
              <CardTitle className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
                {article.title}
              </CardTitle>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {article.aiSummary ? (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex gap-1.5 items-start">
              <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              {article.aiSummary}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {article.content.slice(0, 120)}…
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{article.views}</span>
              <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{article.helpful}</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">{article.author}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ArticleDetail({ article, onClose, onVote, onSummarize, aiLoading }: {
  article: Article;
  onClose: () => void;
  onVote: (id: number, vote: "yes" | "no") => void;
  onSummarize: (id: number) => void;
  aiLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed inset-0 z-50 flex items-start justify-end bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-full bg-card border-l border-border overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <Badge className={`text-[10px] font-mono ${CATEGORY_COLORS[article.category] ?? ""}`}>{article.category}</Badge>
            {article.isPinned && <Pin className="w-3 h-3 text-primary" />}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold mb-2">{article.title}</h1>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
              <span>by {article.author}</span>
              <span>•</span>
              <span>{new Date(article.updatedAt).toLocaleDateString()}</span>
              <span>•</span>
              <span>{article.views} views</span>
            </div>
          </div>

          {article.aiSummary && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2 text-xs font-mono text-primary">
                <Sparkles className="w-3.5 h-3.5" /> AI SUMMARY
              </div>
              <p className="text-sm text-muted-foreground">{article.aiSummary}</p>
            </div>
          )}

          <div className="prose prose-invert prose-sm max-w-none">
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{article.content}</div>
          </div>

          {article.tags && (
            <div className="flex flex-wrap gap-1.5">
              {article.tags.split(",").map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                  <Tag className="w-2.5 h-2.5" />{tag.trim()}
                </span>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs text-muted-foreground font-mono uppercase">Was this helpful?</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onVote(article.id, "yes")}>
                <ThumbsUp className="w-3.5 h-3.5" /> Yes ({article.helpful})
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onVote(article.id, "no")}>
                <ThumbsDown className="w-3.5 h-3.5" /> No ({article.notHelpful})
              </Button>
              {!article.aiSummary && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs ml-auto border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => onSummarize(article.id)}
                  disabled={aiLoading}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiLoading ? "Summarizing…" : "AI Summarize"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NewArticleModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: Partial<Article>) => void }) {
  const [form, setForm] = useState({ title: "", content: "", category: "general", tags: "", author: "You" });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">New Knowledge Article</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <Input placeholder="Article title…" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="font-medium" />
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea
          placeholder="Write your article content here…"
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Input placeholder="Tags (comma-separated)" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => { if (form.title && form.content) { onCreate(form); onClose(); } }}
            disabled={!form.title || !form.content}
          >
            Publish Article
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Knowledge() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: articles = [], isLoading } = useQuery<Article[]>({
    queryKey: ["knowledge", search, activeCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeCategory) params.set("category", activeCategory);
      const r = await fetch(`${API}/knowledge?${params}`);
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Article>) => fetch(`${API}/knowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["knowledge"] }); toast.success("Article published"); },
  });

  const voteMutation = useMutation({
    mutationFn: ({ id, vote }: { id: number; vote: "yes" | "no" }) =>
      fetch(`${API}/knowledge/${id}/helpful`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vote }) }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["knowledge"] });
      if (selectedArticle && selectedArticle.id === updated.id) setSelectedArticle(updated);
      toast.success("Thanks for your feedback");
    },
  });

  const handleSummarize = async (id: number) => {
    setAiLoading(true);
    try {
      const r = await fetch(`${API}/ai/knowledge/${id}/summarize`, { method: "POST" });
      const data = await r.json();
      if (data.content) {
        qc.invalidateQueries({ queryKey: ["knowledge"] });
        if (selectedArticle?.id === id) setSelectedArticle((a) => a ? { ...a, aiSummary: data.content } : a);
        toast.success("AI summary generated");
      } else {
        toast.error("AI not configured — add OPENAI_API_KEY to unlock");
      }
    } catch {
      toast.error("Failed to generate summary");
    } finally {
      setAiLoading(false);
    }
  };

  const pinned = articles.filter((a) => a.isPinned);
  const unpinned = articles.filter((a) => !a.isPinned);

  const stats = {
    total: articles.length,
    categories: new Set(articles.map((a) => a.category)).size,
    totalViews: articles.reduce((s, a) => s + a.views, 0),
    helpful: articles.reduce((s, a) => s + a.helpful, 0),
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      <AnimatePresence>
        {selectedArticle && (
          <ArticleDetail
            article={selectedArticle}
            onClose={() => setSelectedArticle(null)}
            onVote={(id, vote) => voteMutation.mutate({ id, vote })}
            onSummarize={handleSummarize}
            aiLoading={aiLoading}
          />
        )}
        {showNew && (
          <NewArticleModal onClose={() => setShowNew(false)} onCreate={(data) => createMutation.mutate(data)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" /> Knowledge Base
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">AI-powered knowledge hub — every article summarized, searched, and connected.</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4" /> New Article
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Articles", value: stats.total, color: "text-primary" },
          { label: "Categories", value: stats.categories, color: "text-secondary" },
          { label: "Total Views", value: stats.totalViews.toLocaleString(), color: "text-emerald-400" },
          { label: "Helpful Votes", value: stats.helpful, color: "text-amber-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card/30 border border-border/50 rounded-xl px-4 py-3">
            <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">{label}</div>
            <div className={`text-xl font-mono font-bold ${color}`}>{isLoading ? <Skeleton className="h-6 w-10" /> : value}</div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${!activeCategory ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${activeCategory === cat ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Pinned Articles */}
      {pinned.length > 0 && !search && !activeCategory && (
        <div>
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <Star className="w-3 h-3 text-primary" /> Pinned
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinned.map((a) => (
              <ArticleCard key={a.id} article={a} onClick={() => setSelectedArticle(a)} />
            ))}
          </div>
        </div>
      )}

      {/* All Articles */}
      <div>
        {(search || activeCategory || pinned.length === 0) ? null : (
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">All Articles</h2>
        )}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (search || activeCategory ? articles : unpinned).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No articles found. {!search && <button className="text-primary hover:underline" onClick={() => setShowNew(true)}>Create one?</button>}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(search || activeCategory ? articles : unpinned).map((a) => (
              <ArticleCard key={a.id} article={a} onClick={() => setSelectedArticle(a)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
