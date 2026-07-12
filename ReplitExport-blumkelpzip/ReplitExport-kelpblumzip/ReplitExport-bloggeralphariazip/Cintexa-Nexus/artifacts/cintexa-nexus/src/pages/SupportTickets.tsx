import { useState } from "react";
import {
  useListTickets, useCreateTicket, useUpdateTicket, useDeleteTicket,
  getListTicketsQueryKey, useAiTriageTicket,
  useGetTicketsSlaSummary, getGetTicketsSlaSummaryQueryKey,
  suggestTicketAssignee,
} from "@workspace/api-client-react";
import type { Ticket, TicketInput, TicketUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Plus, MoreHorizontal, Pencil, Trash2, MessageSquare, Mail, Phone, Globe, Filter, Sparkles, Timer, AlertTriangle, UserCog } from "lucide-react";
import { toast } from "sonner";
import type { TicketInputStatus, TicketInputPriority, TicketInputChannel, TicketUpdateStatus, TicketUpdatePriority } from "@workspace/api-client-react";

const PRIORITIES: TicketInputPriority[] = ["low", "medium", "high", "urgent"];
const STATUSES: TicketInputStatus[] = ["open", "in_progress", "waiting", "resolved", "closed"];
const CHANNELS: TicketInputChannel[] = ["email", "chat", "phone", "portal"];

const priorityVariant: Record<string, any> = { urgent: "destructive", high: "warning", medium: "secondary", low: "outline" };
const statusVariant: Record<string, any> = { open: "default", in_progress: "warning", waiting: "secondary", resolved: "success", closed: "secondary" };
const slaBandVariant: Record<string, any> = { breached: "destructive", at_risk: "warning", on_track: "outline", met: "success" };
const slaBandLabel: Record<string, string> = { breached: "Breached", at_risk: "At Risk", on_track: "On Track", met: "Met" };

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "email") return <Mail className="w-4 h-4" />;
  if (channel === "chat") return <MessageSquare className="w-4 h-4" />;
  if (channel === "phone") return <Phone className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
}

// ─── SLA Summary Panel ────────────────────────────────────────────────────────
// NEXUS Support Intelligence: Zendesk-style SLA breach tracking merged with
// Freshworks-style load-balanced auto-routing, in one panel above the queue.
function SlaSummaryPanel() {
  const { data: sla, isLoading } = useGetTicketsSlaSummary({ query: { queryKey: getGetTicketsSlaSummaryQueryKey() } });

  if (isLoading || !sla) return <Skeleton className="h-28 w-full rounded-xl" />;

  const total = sla.breached + sla.atRisk + sla.onTrack + sla.met || 1;
  const cards = [
    { label: "Breached", value: sla.breached, tone: "text-destructive", icon: AlertTriangle },
    { label: "At Risk", value: sla.atRisk, tone: "text-yellow-400", icon: Timer },
    { label: "On Track", value: sla.onTrack, tone: "text-blue-400", icon: Timer },
    { label: "Met", value: sla.met, tone: "text-primary", icon: Timer },
  ];

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm font-semibold text-foreground">SLA Health</h3>
          <div className="flex gap-4 text-[11px] font-mono text-muted-foreground">
            <span>Avg first response: <span className="text-foreground font-semibold">{sla.avgFirstResponseMinutes != null ? `${sla.avgFirstResponseMinutes}m` : "—"}</span></span>
            <span>Avg resolution: <span className="text-foreground font-semibold">{sla.avgResolutionMinutes != null ? `${(sla.avgResolutionMinutes / 60).toFixed(1)}h` : "—"}</span></span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {cards.map(({ label, value, tone, icon: Icon }) => (
            <div key={label} className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                <Icon className={`w-3 h-3 ${tone}`} />
                {label}
              </div>
              <div className={`font-mono font-bold text-lg ${tone}`}>{value}</div>
            </div>
          ))}
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
          <div className="h-full bg-destructive" style={{ width: `${(sla.breached / total) * 100}%` }} />
          <div className="h-full bg-yellow-400" style={{ width: `${(sla.atRisk / total) * 100}%` }} />
          <div className="h-full bg-blue-400" style={{ width: `${(sla.onTrack / total) * 100}%` }} />
          <div className="h-full bg-primary" style={{ width: `${(sla.met / total) * 100}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Suggest Assignee Button ─────────────────────────────────────────────────
function SuggestAssigneeButton({ onSuggest }: { onSuggest: (agent: string) => void }) {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await suggestTicketAssignee();
      if (res.suggestion) {
        onSuggest(res.suggestion);
        toast.success(`Suggested ${res.suggestion} (lowest current load)`);
      } else {
        toast.error("No prior agents found to route to");
      }
    } catch {
      toast.error("Failed to suggest an assignee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={run} disabled={loading}>
          <UserCog className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Auto-suggest least-loaded agent</TooltipContent>
    </Tooltip>
  );
}

// ─── Ticket Dialog (create/edit) ─────────────────────────────────────────────
function TicketDialog({ open, onClose, ticket }: { open: boolean; onClose: () => void; ticket?: Ticket }) {
  const qc = useQueryClient();
  const create = useCreateTicket();
  const update = useUpdateTicket();
  const [form, setForm] = useState<TicketInput & { description?: string }>({
    subject: ticket?.subject ?? "",
    description: ticket?.description ?? "",
    status: (ticket?.status as TicketInputStatus) ?? "open",
    priority: (ticket?.priority as TicketInputPriority) ?? "medium",
    channel: (ticket?.channel as TicketInputChannel) ?? "email",
    contactName: ticket?.contactName ?? "",
    assignedTo: ticket?.assignedTo ?? "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTicketsQueryKey({}) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticket) {
      update.mutate({ id: ticket.id, data: { subject: form.subject, description: form.description, status: form.status as TicketUpdateStatus, priority: form.priority as TicketUpdatePriority, assignedTo: form.assignedTo } }, {
        onSuccess: () => { toast.success("Ticket updated"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to update ticket"),
      });
    } else {
      create.mutate({ data: form }, {
        onSuccess: () => { toast.success("Ticket created"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to create ticket"),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">{ticket ? `Edit Ticket #${ticket.id}` : "New Ticket"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} required className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="bg-muted/50 border-border resize-none font-mono text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v as TicketInputPriority }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as TicketInputStatus }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm((p) => ({ ...p, channel: v as TicketInputChannel }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact Name</Label>
              <Input value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} required className="bg-muted/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <div className="flex gap-1.5">
                <Input value={form.assignedTo ?? ""} onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))} className="bg-muted/50 border-border" />
                <SuggestAssigneeButton onSuggest={(agent) => setForm((p) => ({ ...p, assignedTo: agent }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ticket Detail Sheet ──────────────────────────────────────────────────────
function TicketSheet({ ticket, onClose, onEdit }: { ticket: Ticket | null; onClose: () => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const update = useUpdateTicket();
  const triage = useAiTriageTicket();
  const [draftReply, setDraftReply] = useState<{ content: string; priority?: string; sentiment?: string } | null>(null);

  const setStatus = (status: TicketUpdateStatus) => {
    if (!ticket) return;
    update.mutate({ id: ticket.id, data: { status } }, {
      onSuccess: () => { toast.success(`Status → ${status.replace("_", " ")}`); qc.invalidateQueries({ queryKey: getListTicketsQueryKey({}) }); },
      onError: () => toast.error("Failed to update status"),
    });
  };

  const handleAiDraft = () => {
    if (!ticket) return;
    setDraftReply(null);
    triage.mutate({ id: ticket.id }, {
      onSuccess: (insight) => {
        setDraftReply({ content: insight.content, priority: (insight.metadata as any)?.priority, sentiment: (insight.metadata as any)?.sentiment });
        qc.invalidateQueries({ queryKey: getListTicketsQueryKey({}) });
        toast.success("NEXUS AI drafted a reply");
      },
      onError: (err: any) => toast.error(err?.error ?? "AI triage failed — check that OPENAI_API_KEY is configured"),
    });
  };

  return (
    <Sheet open={!!ticket} onOpenChange={() => onClose()}>
      <SheetContent className="bg-card border-border w-[480px]">
        {ticket && (
          <>
            <SheetHeader className="mb-6">
              <div className="flex items-center justify-between">
                <SheetTitle className="font-mono text-sm text-muted-foreground">#{ticket.id} — {ticket.channel}</SheetTitle>
                <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="w-3.5 h-3.5 mr-1.5" />Edit</Button>
              </div>
              <h2 className="text-lg font-semibold mt-2">{ticket.subject}</h2>
            </SheetHeader>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Badge variant={priorityVariant[ticket.priority]} className="uppercase text-[10px]">{ticket.priority}</Badge>
                <Badge variant={statusVariant[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
                {ticket.sla && (
                  <Badge variant={slaBandVariant[ticket.sla.resolutionBand]} className="text-[10px]">
                    SLA: {slaBandLabel[ticket.sla.resolutionBand]}
                  </Badge>
                )}
              </div>

              {ticket.sla && (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">First response due</span>
                    <span className={ticket.sla.firstResponseBand === "breached" ? "text-destructive" : "text-foreground"}>{new Date(ticket.sla.firstResponseDueAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Resolution due</span>
                    <span className={ticket.sla.resolutionBand === "breached" ? "text-destructive" : "text-foreground"}>{new Date(ticket.sla.resolutionDueAt).toLocaleString()}</span>
                  </div>
                  {ticket.sla.minutesToResolutionBreach != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Time remaining</span>
                      <span className={ticket.sla.minutesToResolutionBreach < 0 ? "text-destructive" : "text-foreground"}>
                        {ticket.sla.minutesToResolutionBreach < 0
                          ? `${Math.abs(ticket.sla.minutesToResolutionBreach)}m overdue`
                          : `${ticket.sla.minutesToResolutionBreach}m left`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {ticket.description && (
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground font-mono uppercase">Description</div>
                  <p className="text-sm text-foreground leading-relaxed">{ticket.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-mono uppercase">Contact</div>
                  <div className="font-medium">{ticket.contactName}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-mono uppercase">Assigned To</div>
                  <div className="font-medium">{ticket.assignedTo || "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-mono uppercase">Created</div>
                  <div className="font-mono text-xs">{new Date(ticket.createdAt).toLocaleString()}</div>
                </div>
                {ticket.tags && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-mono uppercase">Tags</div>
                    <div className="flex flex-wrap gap-1">{ticket.tags.split(",").map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t.trim()}</Badge>)}</div>
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="text-xs text-muted-foreground font-mono uppercase mb-3">Update Status</div>
                <div className="grid grid-cols-2 gap-2">
                  {(["open", "in_progress", "waiting", "resolved", "closed"] as TicketUpdateStatus[]).map((s) => (
                    <Button key={s} variant={ticket.status === s ? "default" : "outline"} size="sm" className="text-xs capitalize" onClick={() => setStatus(s)} disabled={update.isPending}>
                      {s.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted-foreground font-mono uppercase">NEXUS AI</div>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleAiDraft} disabled={triage.isPending}>
                    <Sparkles className="w-3.5 h-3.5" /> {triage.isPending ? "Drafting..." : "AI Draft Reply"}
                  </Button>
                </div>
                {draftReply && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                    {(draftReply.priority || draftReply.sentiment) && (
                      <div className="flex gap-2">
                        {draftReply.priority && <Badge variant="outline" className="text-[10px] uppercase">Suggested: {draftReply.priority}</Badge>}
                        {draftReply.sentiment && <Badge variant="outline" className="text-[10px] uppercase">{draftReply.sentiment}</Badge>}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{draftReply.content}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── SupportTickets ───────────────────────────────────────────────────────────
export default function SupportTickets() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [editTicket, setEditTicket] = useState<Ticket | null>(null);
  const qc = useQueryClient();
  const deleteTicket = useDeleteTicket();

  const { data: tickets, isLoading } = useListTickets({}, { query: { queryKey: getListTicketsQueryKey({}) } });

  const filtered = tickets?.filter((t) => {
    const matchSearch = !search || t.subject.toLowerCase().includes(search.toLowerCase()) || t.id.toString().includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const handleDelete = (id: number) => {
    if (!confirm("Delete this ticket?")) return;
    deleteTicket.mutate({ id }, {
      onSuccess: () => { toast.success("Ticket deleted"); qc.invalidateQueries({ queryKey: getListTicketsQueryKey({}) }); },
      onError: () => toast.error("Failed to delete ticket"),
    });
  };

  const openEdit = () => {
    if (selectedTicket) { setEditTicket(selectedTicket); setSelectedTicket(null); }
  };

  // Count by status for header stats
  const open = tickets?.filter((t) => t.status === "open").length || 0;
  const inProgress = tickets?.filter((t) => t.status === "in_progress").length || 0;
  const urgent = tickets?.filter((t) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed").length || 0;
  const breached = tickets?.filter((t) => t.sla?.resolutionBand === "breached" || t.sla?.firstResponseBand === "breached").length || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {createOpen && <TicketDialog open onClose={() => setCreateOpen(false)} />}
      {editTicket && <TicketDialog open onClose={() => setEditTicket(null)} ticket={editTicket} />}
      <TicketSheet ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onEdit={openEdit} />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Support Nexus</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Resolve and monitor client issues.</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New Ticket</Button>
      </div>

      {/* Stats Row */}
      <div className="flex gap-4">
        {[
          { label: "Open", value: open, color: "text-primary" },
          { label: "In Progress", value: inProgress, color: "text-warning" },
          { label: "Urgent", value: urgent, color: "text-destructive" },
          { label: "SLA Breached", value: breached, color: "text-destructive" },
          { label: "Total", value: tickets?.length || 0, color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2 bg-card/50 border border-border rounded-lg px-4 py-2.5">
            <span className={`font-mono font-bold text-xl ${color}`}>{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <SlaSummaryPanel />

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="text" placeholder="Search tickets..." className="pl-9 bg-card border-border font-mono text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-card border-border text-sm"><Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36 bg-card border-border text-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border bg-card/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-16">ID</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead className="text-right">Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : filtered?.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No tickets found.</TableCell></TableRow>
            ) : filtered?.map((ticket) => (
              <TableRow key={ticket.id} className="border-border/50 group cursor-pointer hover:bg-muted/20" onClick={() => setSelectedTicket(ticket)}>
                <TableCell className="font-mono text-xs text-muted-foreground">#{ticket.id}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground"><ChannelIcon channel={ticket.channel} /></span>
                    <span className="group-hover:text-primary transition-colors line-clamp-1">{ticket.subject}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{ticket.contactName}</TableCell>
                <TableCell><Badge variant={priorityVariant[ticket.priority]} className="uppercase text-[10px]">{ticket.priority}</Badge></TableCell>
                <TableCell><Badge variant={statusVariant[ticket.status]}>{ticket.status.replace('_', ' ')}</Badge></TableCell>
                <TableCell>
                  {ticket.sla && (
                    <Badge variant={slaBandVariant[ticket.sla.resolutionBand]} className="text-[10px] gap-1">
                      {ticket.sla.resolutionBand === "breached" && <AlertTriangle className="w-3 h-3" />}
                      {slaBandLabel[ticket.sla.resolutionBand]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{ticket.assignedTo || "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground text-xs font-mono">{new Date(ticket.createdAt).toLocaleDateString()}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditTicket(ticket)}><Pencil className="w-3.5 h-3.5 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(ticket.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
