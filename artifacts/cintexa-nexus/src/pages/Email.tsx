import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Star, StarOff, Tag, Reply, Forward, Pencil, Trash2,
  Send, Cpu, RefreshCw, Plus, ChevronRight, X, Loader2,
  Inbox, AlertCircle, CheckCircle2, Clock, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const API = "/api";

type Thread = {
  id: number; subject: string; participants: string[]; lastMessageAt: string;
  isRead: boolean; isStarred: boolean; labels: string[]; aiSummary: string | null; aiTriage: string | null;
};
type Message = {
  id: number; threadId: number; from: string; to: string[]; body: string;
  isOutbound: boolean; isRead: boolean; aiDraft: string | null; sentAt: string;
};

const TRIAGE_COLOR: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  normal: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  low: "bg-muted text-muted-foreground",
};

function ComposeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!to || !subject || !body) { toast.error("Fill in all fields"); return; }
    setLoading(true);
    try {
      await fetch(`${API}/email/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, participants: [to], body, from: "me@cintexa.io" }),
      });
      qc.invalidateQueries({ queryKey: ["email-threads"] });
      toast.success("Email sent");
      onClose(); setTo(""); setSubject(""); setBody("");
    } catch { toast.error("Failed to send"); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader><DialogTitle className="font-mono">New Email</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="To" value={to} onChange={e => setTo(e.target.value)} className="font-mono text-sm" />
          <Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} className="font-mono text-sm" />
          <Textarea placeholder="Write your message..." value={body} onChange={e => setBody(e.target.value)} rows={8} className="font-mono text-sm resize-none" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReplyPanel({ thread, onClose }: { thread: Thread; onClose: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const generateDraft = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`${API}/email/threads/${thread.id}/ai-draft`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: "" }),
      });
      const data = await res.json();
      setBody(data.draft ?? "");
      toast.success("AI draft generated");
    } catch { toast.error("Failed to generate draft"); }
    setAiLoading(false);
  };

  const send = async () => {
    if (!body.trim()) { toast.error("Write a reply first"); return; }
    setSending(true);
    try {
      await fetch(`${API}/email/threads/${thread.id}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "me@cintexa.io", to: thread.participants, body, isOutbound: true }),
      });
      qc.invalidateQueries({ queryKey: ["email-thread", thread.id] });
      qc.invalidateQueries({ queryKey: ["email-threads"] });
      toast.success("Reply sent"); setBody(""); onClose();
    } catch { toast.error("Failed to send reply"); }
    setSending(false);
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-background/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">Reply to thread</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={generateDraft} disabled={aiLoading} className="gap-1 text-xs">
            {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cpu className="h-3 w-3" />} AI Draft
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="h-3 w-3" /></Button>
        </div>
      </div>
      <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your reply..." rows={5} className="font-mono text-sm resize-none" />
      <div className="flex justify-end">
        <Button onClick={send} disabled={sending} size="sm" className="gap-2">
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Send Reply
        </Button>
      </div>
    </div>
  );
}

export default function Email() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "starred">("all");
  const [search, setSearch] = useState("");

  const { data: threads = [], isLoading } = useQuery<Thread[]>({
    queryKey: ["email-threads", filter],
    queryFn: () => fetch(`${API}/email/threads?${filter === "starred" ? "starred=true" : ""}`).then(r => r.json()),
  });

  const { data: threadDetail } = useQuery<{ thread: Thread; messages: Message[] }>({
    queryKey: ["email-thread", selectedId],
    queryFn: () => fetch(`${API}/email/threads/${selectedId}`).then(r => r.json()),
    enabled: !!selectedId,
  });

  const triage = useMutation({
    mutationFn: (id: number) => fetch(`${API}/email/threads/${id}/ai-triage`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-threads"] }); qc.invalidateQueries({ queryKey: ["email-thread", selectedId] }); toast.success("AI triage complete"); },
    onError: () => toast.error("Triage failed"),
  });

  const toggleStar = useMutation({
    mutationFn: ({ id, starred }: { id: number; starred: boolean }) =>
      fetch(`${API}/email/threads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isStarred: !starred }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-threads"] }); qc.invalidateQueries({ queryKey: ["email-thread", selectedId] }); },
  });

  const filtered = threads.filter(t => {
    if (filter === "unread" && t.isRead) return false;
    if (filter === "starred" && !t.isStarred) return false;
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selected = threadDetail?.thread ?? threads.find(t => t.id === selectedId) ?? null;
  const messages = threadDetail?.messages ?? [];

  return (
    <div className="-m-6 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-mono font-semibold">Email</h1>
          <Badge variant="outline" className="font-mono text-xs">{threads.filter(t => !t.isRead).length} unread</Badge>
        </div>
        <Button onClick={() => setComposing(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Compose
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Thread list */}
        <div className="w-80 border-r border-border flex flex-col shrink-0">
          {/* Filters + Search */}
          <div className="p-3 space-y-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-8 h-8 text-xs font-mono" />
            </div>
            <div className="flex gap-1">
              {(["all", "unread", "starred"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={cn("px-2 py-1 rounded text-xs font-mono capitalize transition-colors", filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Inbox className="h-8 w-8 mb-2" /><span className="text-xs font-mono">No emails</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(thread => (
                  <motion.button
                    key={thread.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => { setSelectedId(thread.id); setReplying(false); }}
                    className={cn("w-full text-left p-3 hover:bg-muted/50 transition-colors relative", selectedId === thread.id && "bg-muted", !thread.isRead && "border-l-2 border-l-primary")}
                  >
                    {!thread.isRead && <div className="absolute top-3 left-1 w-1.5 h-1.5 rounded-full bg-primary" />}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={cn("text-xs font-mono truncate", !thread.isRead ? "font-semibold text-foreground" : "text-muted-foreground")}>{thread.subject}</span>
                      {thread.isStarred && <Star className="h-3 w-3 text-yellow-400 shrink-0 fill-yellow-400" />}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate">{thread.participants[0] ?? "Unknown"}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}</span>
                    </div>
                    {thread.aiTriage && (
                      <Badge variant="outline" className={cn("mt-1 text-xs font-mono", TRIAGE_COLOR[thread.aiTriage])}>{thread.aiTriage}</Badge>
                    )}
                    {thread.labels.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {thread.labels.slice(0, 2).map(l => <Badge key={l} variant="secondary" className="text-xs font-mono px-1 h-4">{l}</Badge>)}
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Thread detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Mail className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-mono text-sm">Select an email to read</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-6 py-4 border-b border-border shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-mono font-semibold truncate">{selected.subject}</h2>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{selected.participants.join(", ")}</p>
                    {selected.aiSummary && (
                      <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-primary/40 pl-2">{selected.aiSummary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => triage.mutate(selected.id)} disabled={triage.isPending} className="gap-1 text-xs">
                      {triage.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cpu className="h-3 w-3" />} AI Triage
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleStar.mutate({ id: selected.id, starred: selected.isStarred })}>
                      {selected.isStarred ? <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" /> : <StarOff className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplying(!replying)}>
                      <Reply className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm font-mono py-8">No messages in this thread yet.</div>
                  ) : (
                    messages.map(msg => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("rounded-lg p-4 border", msg.isOutbound ? "border-primary/20 bg-primary/5 ml-8" : "border-border bg-card mr-8")}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold", msg.isOutbound ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                              {msg.from.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-mono font-medium">{msg.from}</span>
                            {msg.isOutbound && <Badge variant="outline" className="text-xs font-mono px-1 h-4">Sent</Badge>}
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{formatDistanceToNow(new Date(msg.sentAt), { addSuffix: true })}</span>
                        </div>
                        <p className="text-sm font-mono whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                      </motion.div>
                    ))
                  )}
                  {replying && selected && (
                    <ReplyPanel thread={selected} onClose={() => setReplying(false)} />
                  )}
                </div>
              </ScrollArea>

              {/* Footer quick actions */}
              {!replying && (
                <div className="px-6 py-3 border-t border-border shrink-0">
                  <Button onClick={() => setReplying(true)} size="sm" variant="outline" className="gap-2 font-mono text-xs">
                    <Reply className="h-3 w-3" /> Reply
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ComposeDialog open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}
