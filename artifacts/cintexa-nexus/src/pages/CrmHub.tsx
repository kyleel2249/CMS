import { useState } from "react";
import {
  useListContacts, useListCompanies, useListLeads,
  useCreateContact, useUpdateContact, useDeleteContact,
  useCreateCompany, useUpdateCompany, useDeleteCompany,
  useCreateLead, useUpdateLead, useDeleteLead,
  useAiQualifyLead, useRecalculateLeadScore, useRecalculateAllLeadScores,
  getListContactsQueryKey, getListCompaniesQueryKey, getListLeadsQueryKey,
} from "@workspace/api-client-react";
import type {
  Contact, Company, Lead,
  ContactInput, ContactUpdate,
  CompanyInput, CompanyUpdate,
  LeadInput, LeadUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Plus, MoreHorizontal, Pencil, Trash2, Sparkles, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Contact Dialog ───────────────────────────────────────────────────────────
function ContactDialog({
  open, onClose, contact,
}: { open: boolean; onClose: () => void; contact?: Contact }) {
  const qc = useQueryClient();
  const create = useCreateContact();
  const update = useUpdateContact();
  const [form, setForm] = useState<ContactInput & { score?: number }>({
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    company: contact?.company ?? "",
    jobTitle: contact?.jobTitle ?? "",
    status: (contact?.status as any) ?? "prospect",
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalidate = () => qc.invalidateQueries({ queryKey: getListContactsQueryKey({}) });
    if (contact) {
      update.mutate({ id: contact.id, data: form as ContactUpdate }, {
        onSuccess: () => { toast.success("Contact updated"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to update contact"),
      });
    } else {
      create.mutate({ data: form }, {
        onSuccess: () => { toast.success("Contact created"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to create contact"),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{contact ? "Edit Contact" : "New Contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First Name</Label>
              <Input value={form.firstName} onChange={f("firstName")} required className="bg-muted/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input value={form.lastName} onChange={f("lastName")} required className="bg-muted/50 border-border" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={f("email")} required className="bg-muted/50 border-border font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone ?? ""} onChange={f("phone")} className="bg-muted/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as any }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["active", "inactive", "prospect"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input value={form.company ?? ""} onChange={f("company")} className="bg-muted/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Job Title</Label>
              <Input value={form.jobTitle ?? ""} onChange={f("jobTitle")} className="bg-muted/50 border-border" />
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

// ─── Company Dialog ───────────────────────────────────────────────────────────
function CompanyDialog({ open, onClose, company }: { open: boolean; onClose: () => void; company?: Company }) {
  const qc = useQueryClient();
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const [form, setForm] = useState<CompanyInput>({
    name: company?.name ?? "",
    industry: company?.industry ?? "",
    website: company?.website ?? "",
    size: company?.size ?? "",
    country: company?.country ?? "",
    revenue: company?.revenue ?? undefined,
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, revenue: form.revenue ? Number(form.revenue) : undefined };
    const invalidate = () => qc.invalidateQueries({ queryKey: getListCompaniesQueryKey({}) });
    if (company) {
      update.mutate({ id: company.id, data: payload as CompanyUpdate }, {
        onSuccess: () => { toast.success("Company updated"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to update company"),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { toast.success("Company created"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to create company"),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{company ? "Edit Company" : "New Company"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input value={form.name} onChange={f("name")} required className="bg-muted/50 border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Input value={form.industry ?? ""} onChange={f("industry")} className="bg-muted/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Size</Label>
              <Select value={form.size ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, size: v }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {["1-10", "10-50", "50-100", "100-500", "500-1000", "1000+"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={form.website ?? ""} onChange={f("website")} className="bg-muted/50 border-border font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={form.country ?? ""} onChange={f("country")} className="bg-muted/50 border-border" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Annual Revenue ($)</Label>
            <Input type="number" value={form.revenue ?? ""} onChange={(e) => setForm((p) => ({ ...p, revenue: e.target.value ? Number(e.target.value) : undefined }))} className="bg-muted/50 border-border font-mono" />
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

// ─── Lead Dialog ──────────────────────────────────────────────────────────────
function LeadDialog({ open, onClose, lead }: { open: boolean; onClose: () => void; lead?: Lead }) {
  const qc = useQueryClient();
  const create = useCreateLead();
  const update = useUpdateLead();
  const [form, setForm] = useState<LeadInput>({
    name: lead?.name ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    company: lead?.company ?? "",
    source: (lead?.source as any) ?? "website",
    status: (lead?.status as any) ?? "new",
    score: lead?.score ?? 50,
    notes: lead?.notes ?? "",
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalidate = () => qc.invalidateQueries({ queryKey: getListLeadsQueryKey({}) });
    if (lead) {
      update.mutate({ id: lead.id, data: form as LeadUpdate }, {
        onSuccess: () => { toast.success("Lead updated"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to update lead"),
      });
    } else {
      create.mutate({ data: form }, {
        onSuccess: () => { toast.success("Lead created"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to create lead"),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{lead ? "Edit Lead" : "New Lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={form.name} onChange={f("name")} required className="bg-muted/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={f("email")} required className="bg-muted/50 border-border font-mono text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input value={form.company ?? ""} onChange={f("company")} className="bg-muted/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone ?? ""} onChange={f("phone")} className="bg-muted/50 border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm((p) => ({ ...p, source: v as any }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["website", "referral", "social", "email", "cold_call", "event", "other"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as any }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["new", "contacted", "qualified", "unqualified", "converted"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Score (0–100)</Label>
            <Input type="number" min={0} max={100} value={form.score ?? ""} onChange={(e) => setForm((p) => ({ ...p, score: Number(e.target.value) }))} className="bg-muted/50 border-border font-mono" />
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

// ─── AI Qualify Dialog ──────────────────────────────────────────────────────
function AiQualifyDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const qualify = useAiQualifyLead();
  const [insight, setInsight] = useState<{ content: string; score?: number; recommendation?: string } | null>(null);

  const run = () => {
    setInsight(null);
    qualify.mutate({ id: lead.id }, {
      onSuccess: (res) => {
        setInsight({ content: res.content, score: (res.metadata as any)?.score, recommendation: (res.metadata as any)?.recommendation });
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey({}) });
      },
      onError: (err: any) => toast.error(err?.error ?? "AI qualification failed — check that OPENAI_API_KEY is configured"),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI Qualify — {lead.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Button onClick={run} disabled={qualify.isPending} className="gap-2 w-full">
            <Sparkles className="w-4 h-4" /> {qualify.isPending ? "Analyzing..." : insight ? "Re-run" : "Qualify with AI"}
          </Button>
          {insight && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              {(insight.score != null || insight.recommendation) && (
                <div className="flex gap-2">
                  {insight.score != null && <Badge variant="outline" className="text-[10px] uppercase">Score: {insight.score}</Badge>}
                  {insight.recommendation && <Badge variant="outline" className="text-[10px] uppercase">{insight.recommendation}</Badge>}
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{insight.content}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CrmHub ───────────────────────────────────────────────────────────────────
export default function CrmHub() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("contacts");
  const [dialog, setDialog] = useState<{ type: "contact" | "company" | "lead"; record?: any } | null>(null);
  const [aiLead, setAiLead] = useState<Lead | null>(null);
  const qc = useQueryClient();

  const { data: contacts, isLoading: contactsLoading } = useListContacts({ search }, { query: { queryKey: getListContactsQueryKey({ search }) } });
  const { data: companies, isLoading: companiesLoading } = useListCompanies({ search }, { query: { queryKey: getListCompaniesQueryKey({ search }) } });
  const { data: leads, isLoading: leadsLoading } = useListLeads({}, { query: { queryKey: getListLeadsQueryKey({}) } });

  const deleteContact = useDeleteContact();
  const deleteCompany = useDeleteCompany();
  const deleteLead = useDeleteLead();
  const recalcScore = useRecalculateLeadScore();
  const recalcAllScores = useRecalculateAllLeadScores();

  const handleRecalcOne = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    recalcScore.mutate({ id }, {
      onSuccess: () => { toast.success("Score recalculated"); qc.invalidateQueries({ queryKey: getListLeadsQueryKey({}) }); },
      onError: () => toast.error("Failed to recalculate score"),
    });
  };

  const handleRecalcAll = () => {
    recalcAllScores.mutate(undefined, {
      onSuccess: (res) => { toast.success(`Recalculated ${res.total} leads — ${res.updated} scores changed`); qc.invalidateQueries({ queryKey: getListLeadsQueryKey({}) }); },
      onError: () => toast.error("Failed to recalculate scores"),
    });
  };

  const handleDelete = (type: "contact" | "company" | "lead", id: number) => {
    if (!confirm("Delete this record?")) return;
    const configs = {
      contact: { mut: deleteContact, key: getListContactsQueryKey({}) },
      company: { mut: deleteCompany, key: getListCompaniesQueryKey({}) },
      lead: { mut: deleteLead, key: getListLeadsQueryKey({}) },
    };
    const { mut, key } = configs[type];
    (mut as any).mutate({ id }, {
      onSuccess: () => { toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`); qc.invalidateQueries({ queryKey: key }); },
      onError: () => toast.error(`Failed to delete ${type}`),
    });
  };

  const openNew = () => {
    const typeMap: Record<string, "contact" | "company" | "lead"> = { contacts: "contact", companies: "company", leads: "lead" };
    setDialog({ type: typeMap[tab] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10 h-full flex flex-col">
      {/* Dialogs */}
      {dialog?.type === "contact" && <ContactDialog open onClose={() => setDialog(null)} contact={dialog.record} />}
      {dialog?.type === "company" && <CompanyDialog open onClose={() => setDialog(null)} company={dialog.record} />}
      {dialog?.type === "lead" && <LeadDialog open onClose={() => setDialog(null)} lead={dialog.record} />}
      {aiLead && <AiQualifyDialog lead={aiLead} onClose={() => setAiLead(null)} />}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">CRM Hub</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Manage entity relations across the nexus.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="text" placeholder="Search directory..." className="pl-9 bg-card border-border font-mono text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button className="gap-2" onClick={openNew}><Plus className="w-4 h-4" /> New Record</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 h-auto space-x-6 shrink-0">
          {[
            { value: "contacts", count: contacts?.length },
            { value: "companies", count: companies?.length },
            { value: "leads", count: leads?.length },
          ].map(({ value, count }) => (
            <TabsTrigger key={value} value={value} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 px-1 capitalize">
              {value} <Badge variant="secondary" className="ml-2 bg-secondary/20">{count || 0}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-auto mt-6">
          {/* Contacts */}
          <TabsContent value="contacts" className="m-0 h-full">
            <Card className="border-border bg-card/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactsLoading ? <TableSkeleton rows={5} cols={6} /> : contacts?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No contacts found.</TableCell></TableRow>
                  ) : contacts?.map((c) => (
                    <TableRow key={c.id} className="border-border/50 hover:bg-muted/20 cursor-pointer group" onClick={() => setDialog({ type: "contact", record: c })}>
                      <TableCell className="font-medium">{c.firstName} {c.lastName}
                        {c.jobTitle && <div className="text-xs text-muted-foreground mt-0.5">{c.jobTitle}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.company || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{c.email}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'active' ? 'success' : c.status === 'prospect' ? 'warning' : 'secondary'}>{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{c.score || '-'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDialog({ type: "contact", record: c })}><Pencil className="w-3.5 h-3.5 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete("contact", c.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Companies */}
          <TabsContent value="companies" className="m-0 h-full">
            <Card className="border-border bg-card/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead>Name</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesLoading ? <TableSkeleton rows={5} cols={6} /> : companies?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No companies found.</TableCell></TableRow>
                  ) : companies?.map((c) => (
                    <TableRow key={c.id} className="border-border/50 hover:bg-muted/20 cursor-pointer group" onClick={() => setDialog({ type: "company", record: c })}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.industry || '-'}</TableCell>
                      <TableCell className="font-mono text-xs text-primary">{c.website || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{c.size || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{c.revenue ? `$${c.revenue.toLocaleString()}` : '-'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDialog({ type: "company", record: c })}><Pencil className="w-3.5 h-3.5 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete("company", c.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Leads */}
          <TabsContent value="leads" className="m-0 h-full space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-1.5 font-mono text-xs" onClick={handleRecalcAll} disabled={recalcAllScores.isPending}>
                <RefreshCw className={`w-3.5 h-3.5 ${recalcAllScores.isPending ? "animate-spin" : ""}`} />
                {recalcAllScores.isPending ? "Recalculating..." : "Recalculate All Scores"}
              </Button>
            </div>
            <Card className="border-border bg-card/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead>Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Added</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsLoading ? <TableSkeleton rows={5} cols={6} /> : leads?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No leads found.</TableCell></TableRow>
                  ) : leads?.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase())).map((l) => (
                    <TableRow key={l.id} className="border-border/50 hover:bg-muted/20 cursor-pointer group" onClick={() => setDialog({ type: "lead", record: l })}>
                      <TableCell className="font-medium">
                        {l.name}
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{l.company || l.email}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">{l.source.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <Badge variant={l.status === 'converted' ? 'success' : l.status === 'qualified' ? 'default' : l.status === 'unqualified' ? 'destructive' : 'outline'}>{l.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-secondary/20 rounded-full overflow-hidden">
                            <div className="h-full bg-secondary transition-all" style={{ width: `${l.score}%` }} />
                          </div>
                          <span className="font-mono text-xs">{l.score}</span>
                          {l.scoreBand && (
                            <Badge variant={l.scoreBand === "hot" ? "destructive" : l.scoreBand === "warm" ? "warning" : l.scoreBand === "cold" ? "secondary" : "outline"} className="text-[9px] px-1 py-0 uppercase">
                              {l.scoreBand}
                            </Badge>
                          )}
                          {l.scoreBreakdown && l.scoreBreakdown.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-popover text-popover-foreground border border-border max-w-xs">
                                <div className="space-y-1">
                                  {l.scoreBreakdown.map((f, i) => (
                                    <div key={i} className="flex justify-between gap-3 text-[11px]">
                                      <span>{f.label}</span>
                                      <span className={f.points < 0 ? "text-destructive" : "text-primary"}>{f.points > 0 ? "+" : ""}{f.points}</span>
                                    </div>
                                  ))}
                                  {l.liveScore !== l.score && (
                                    <div className="pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
                                      Live score is {l.liveScore} — click recalculate to sync
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">{new Date(l.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {l.liveScore !== l.score && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleRecalcOne(l.id, e)} disabled={recalcScore.isPending}>
                                  <RefreshCw className="w-3.5 h-3.5 text-yellow-400" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Recalculate score (live: {l.liveScore})</TooltipContent>
                            </Tooltip>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setAiLead(l)}><Sparkles className="w-3.5 h-3.5 mr-2" />AI Qualify</DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleRecalcOne(l.id, e)}><RefreshCw className="w-3.5 h-3.5 mr-2" />Recalculate Score</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDialog({ type: "lead", record: l })}><Pencil className="w-3.5 h-3.5 mr-2" />Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete("lead", l.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
