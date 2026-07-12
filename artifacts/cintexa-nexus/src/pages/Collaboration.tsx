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
  MessageSquare, Plus, Pin, Trash2, Sparkles, X, Tag, Search,
  Edit3, CheckCircle, Clock, Users, FileText,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Note = {
  id: number;
  title: string;
  content: string;
  author: string;
  color: string;
  isPinned: boolean;
  entityType: string | null;
  entityId: number | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
};

const NOTE_COLORS = [
  { value: "default",  label: "Default",  bg: "bg-card",           border: "border-border" },
  { value: "cyan",     label: "Cyan",     bg: "bg-primary/5",      border: "border-primary/30" },
  { value: "violet",   label: "Violet",   bg: "bg-violet-500/5",   border: "border-violet-500/30" },
  { value: "emerald",  label: "Emerald",  bg: "bg-emerald-500/5",  border: "border-emerald-500/30" },
  { value: "amber",    label: "Amber",    bg: "bg-amber-500/5",    border: "border-amber-500/30" },
  { value: "rose",     label: "Rose",     bg: "bg-rose-500/5",     border: "border-rose-500/30" },
];

function noteStyle(color: string) {
  return NOTE_COLORS.find((c) => c.value === color) ?? NOTE_COLORS[0];
}

const TEAM_MEMBERS = ["You", "Jordan Lee", "Sarah Chen", "Alex Rivera", "Morgan Kim"];

function NoteCard({ note, onPin, onDelete, onEdit, onAiInsight, aiLoadingId }: {
  note: Note;
  onPin: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (note: Note) => void;
  onAiInsight: (id: number) => void;
  aiLoadingId: number | null;
}) {
  const style = noteStyle(note.color);
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <Card className={`${style.bg} ${style.border} border transition-all hover:shadow-md group relative`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold leading-snug flex-1">{note.title}</CardTitle>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onPin(note.id)}
                className={`p-1 rounded hover:bg-muted/50 transition-colors ${note.isPinned ? "text-primary" : "text-muted-foreground"}`}
              >
                <Pin className="w-3 h-3" />
              </button>
              <button onClick={() => onEdit(note)} className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground">
                <Edit3 className="w-3 h-3" />
              </button>
              <button onClick={() => onDelete(note.id)} className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-4">{note.content}</p>

          {note.tags && (
            <div className="flex flex-wrap gap-1">
              {note.tags.split(",").map((t) => (
                <span key={t} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground flex items-center gap-0.5">
                  <Tag className="w-2 h-2" />{t.trim()}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
              <span className="w-5 h-5 rounded-full bg-secondary/20 border border-secondary flex items-center justify-center text-[9px] font-bold text-secondary">
                {note.author.slice(0, 1)}
              </span>
              <span>{note.author}</span>
              <span>•</span>
              <Clock className="w-2.5 h-2.5" />
              <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
            </div>
            <button
              onClick={() => onAiInsight(note.id)}
              disabled={aiLoadingId === note.id}
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded border border-transparent hover:border-primary/20"
            >
              <Sparkles className="w-2.5 h-2.5" />
              {aiLoadingId === note.id ? "…" : "AI"}
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function NoteModal({ note, onClose, onSave }: {
  note?: Note;
  onClose: () => void;
  onSave: (data: Partial<Note>) => void;
}) {
  const [form, setForm] = useState({
    title: note?.title ?? "",
    content: note?.content ?? "",
    author: note?.author ?? "You",
    color: note?.color ?? "default",
    tags: note?.tags ?? "",
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {note ? "Edit Note" : "New Note"}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <input
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Note title…"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <textarea
          className="w-full h-36 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Write your note…"
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <select
            value={form.author}
            onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {TEAM_MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Tags (comma-separated)"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          />
        </div>
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-2 uppercase">Color</p>
          <div className="flex gap-2">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                className={`w-6 h-6 rounded-full border-2 transition-all ${c.bg} ${form.color === c.value ? "border-primary scale-125" : "border-border"}`}
                title={c.label}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (form.title && form.content) { onSave(form); onClose(); } }} disabled={!form.title || !form.content}>
            {note ? "Save Changes" : "Create Note"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Collaboration() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | undefined>();
  const [aiLoadingId, setAiLoadingId] = useState<number | null>(null);
  const [activeInsight, setActiveInsight] = useState<{ title: string; content: string; actions: string[] } | null>(null);

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ["notes", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const r = await fetch(`${API}/notes?${params}`);
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Note>) => fetch(`${API}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); toast.success("Note created"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Note> }) =>
      fetch(`${API}/notes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); toast.success("Note updated"); },
  });

  const pinMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/notes/${id}/pin`, { method: "PATCH" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); toast.success("Note deleted"); },
  });

  const handleAiInsight = async (id: number) => {
    setAiLoadingId(id);
    try {
      const r = await fetch(`/api/ai/insights?module=notes&entityId=${id}&limit=1`);
      const existing = await r.json();
      if (existing.length > 0) {
        const ins = existing[0];
        setActiveInsight({ title: ins.title, content: ins.content, actions: ins.metadata?.actionItems ?? [] });
        return;
      }

      const r2 = await fetch(`${API}/ai/insights?entityId=${id}&kind=note_insight`);
      const data2 = await r2.json();
      if (data2.length > 0) {
        const ins = data2[0];
        setActiveInsight({ title: ins.title, content: ins.content, actions: ins.metadata?.actionItems ?? [] });
      } else {
        toast.info("Add an OPENAI_API_KEY to extract AI action items from notes");
      }
    } catch {
      toast.error("Failed to load AI insight");
    } finally {
      setAiLoadingId(null);
    }
  };

  const pinned = notes.filter((n) => n.isPinned);
  const unpinned = notes.filter((n) => !n.isPinned);
  const authors = [...new Set(notes.map((n) => n.author))];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      <AnimatePresence>
        {(showNew || editingNote) && (
          <NoteModal
            note={editingNote}
            onClose={() => { setShowNew(false); setEditingNote(undefined); }}
            onSave={(data) => {
              if (editingNote) {
                updateMutation.mutate({ id: editingNote.id, data });
                setEditingNote(undefined);
              } else {
                createMutation.mutate(data);
                setShowNew(false);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* AI Insight Panel */}
      <AnimatePresence>
        {activeInsight && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border border-primary/30 rounded-xl bg-primary/5 p-4 relative"
          >
            <button onClick={() => setActiveInsight(null)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-2 text-xs font-mono text-primary">
              <Sparkles className="w-3.5 h-3.5" /> NEXUS AI INSIGHT
            </div>
            <p className="text-sm font-medium mb-2">{activeInsight.title}</p>
            {activeInsight.actions.length > 0 && (
              <div className="space-y-1">
                {activeInsight.actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    {a}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-primary" /> Collaboration
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">Shared notes, team context, and AI-extracted action items.</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4" /> New Note
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Notes", value: notes.length, color: "text-primary" },
          { label: "Pinned", value: pinned.length, color: "text-amber-400" },
          { label: "Contributors", value: authors.length, color: "text-secondary" },
          { label: "This Week", value: notes.filter((n) => new Date(n.createdAt) > new Date(Date.now() - 7 * 86400000)).length, color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card/30 border border-border/50 rounded-xl px-4 py-3">
            <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">{label}</div>
            <div className={`text-xl font-mono font-bold ${color}`}>{isLoading ? <Skeleton className="h-6 w-10" /> : value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Team Avatars */}
      {authors.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground uppercase">Contributors</span>
          <div className="flex -space-x-2">
            {authors.map((a) => (
              <div key={a} title={a} className="w-7 h-7 rounded-full bg-secondary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold text-secondary">
                {a.slice(0, 1)}
              </div>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{notes.length} notes across {authors.length} contributors</span>
        </div>
      )}

      {/* Notes */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notes yet. <button className="text-primary hover:underline" onClick={() => setShowNew(true)}>Create the first one.</button></p>
        </div>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <div>
              <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <Pin className="w-3 h-3 text-amber-400" /> Pinned
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinned.map((n) => (
                  <NoteCard key={n.id} note={n} onPin={(id) => pinMutation.mutate(id)} onDelete={(id) => deleteMutation.mutate(id)} onEdit={setEditingNote} onAiInsight={handleAiInsight} aiLoadingId={aiLoadingId} />
                ))}
              </div>
            </div>
          )}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">All Notes</h2>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unpinned.map((n) => (
                  <NoteCard key={n.id} note={n} onPin={(id) => pinMutation.mutate(id)} onDelete={(id) => deleteMutation.mutate(id)} onEdit={setEditingNote} onAiInsight={handleAiInsight} aiLoadingId={aiLoadingId} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
