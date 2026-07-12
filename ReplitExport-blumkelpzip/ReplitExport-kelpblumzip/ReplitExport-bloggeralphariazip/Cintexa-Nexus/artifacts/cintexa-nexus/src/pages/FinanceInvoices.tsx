import { useState } from "react";
import {
  useListInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice,
  useAiFinanceForecast,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import type { Invoice, InvoiceInput, InvoiceUpdate } from "@workspace/api-client-react";
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
import { Plus, MoreHorizontal, Pencil, Trash2, DollarSign, FileText, ArrowUpRight, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { InvoiceInputStatus, InvoiceUpdateStatus } from "@workspace/api-client-react";

const STATUSES: InvoiceInputStatus[] = ["draft", "sent", "paid", "overdue", "cancelled"];
const statusVariant: Record<string, any> = { paid: "success", overdue: "destructive", sent: "warning", draft: "outline", cancelled: "secondary" };

// ─── Invoice Dialog ───────────────────────────────────────────────────────────
function InvoiceDialog({ open, onClose, invoice }: { open: boolean; onClose: () => void; invoice?: Invoice }) {
  const qc = useQueryClient();
  const create = useCreateInvoice();
  const update = useUpdateInvoice();
  const [form, setForm] = useState<InvoiceInput>({
    clientName: invoice?.clientName ?? "",
    amount: invoice?.amount ?? 0,
    tax: invoice?.tax ?? 0,
    status: (invoice?.status as InvoiceInputStatus) ?? "draft",
    dueDate: invoice?.dueDate ? invoice.dueDate.split("T")[0] : "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListInvoicesQueryKey({}) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, amount: Number(form.amount), tax: form.tax ? Number(form.tax) : undefined };
    if (invoice) {
      update.mutate({ id: invoice.id, data: payload as InvoiceUpdate }, {
        onSuccess: () => { toast.success("Invoice updated"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to update invoice"),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { toast.success("Invoice created"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to create invoice"),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{invoice ? `Edit ${invoice.number}` : "Issue Invoice"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Client Name</Label>
            <Input value={form.clientName} onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))} required className="bg-muted/50 border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: Number(e.target.value) }))} required className="bg-muted/50 border-border font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Tax ($)</Label>
              <Input type="number" min={0} step="0.01" value={form.tax ?? ""} onChange={(e) => setForm((p) => ({ ...p, tax: Number(e.target.value) }))} className="bg-muted/50 border-border font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as InvoiceInputStatus }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} required className="bg-muted/50 border-border font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : invoice ? "Save" : "Issue"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice Detail Sheet ─────────────────────────────────────────────────────
function InvoiceSheet({ invoice, onClose, onEdit }: { invoice: Invoice | null; onClose: () => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const update = useUpdateInvoice();

  const markPaid = () => {
    if (!invoice) return;
    update.mutate({ id: invoice.id, data: { status: "paid" as InvoiceUpdateStatus, paidAt: new Date().toISOString() } }, {
      onSuccess: () => { toast.success("Invoice marked as paid"); qc.invalidateQueries({ queryKey: getListInvoicesQueryKey({}) }); onClose(); },
      onError: () => toast.error("Failed to update invoice"),
    });
  };

  const total = invoice ? invoice.amount + (invoice.tax || 0) : 0;

  return (
    <Sheet open={!!invoice} onOpenChange={() => onClose()}>
      <SheetContent className="bg-card border-border w-[420px]">
        {invoice && (
          <>
            <SheetHeader className="mb-6">
              <div className="flex items-center justify-between">
                <SheetTitle className="font-mono text-primary">{invoice.number}</SheetTitle>
                <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="w-3.5 h-3.5 mr-1.5" />Edit</Button>
              </div>
            </SheetHeader>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Badge variant={statusVariant[invoice.status]} className="capitalize">{invoice.status}</Badge>
              </div>

              <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-semibold">{invoice.clientName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">${invoice.amount.toLocaleString()}</span>
                </div>
                {invoice.tax != null && invoice.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-mono">${invoice.tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-border pt-3">
                  <span>Total</span>
                  <span className="font-mono text-primary">${total.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-mono uppercase">Due Date</div>
                  <div className="font-mono text-sm">{new Date(invoice.dueDate).toLocaleDateString()}</div>
                </div>
                {invoice.paidAt && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-mono uppercase">Paid At</div>
                    <div className="font-mono text-sm text-primary">{new Date(invoice.paidAt).toLocaleDateString()}</div>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-mono uppercase">Created</div>
                  <div className="font-mono text-xs">{new Date(invoice.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                <Button className="w-full gap-2" onClick={markPaid} disabled={update.isPending}>
                  <CheckCircle2 className="w-4 h-4" />
                  {update.isPending ? "Updating..." : "Mark as Paid"}
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── AI Forecast Dialog ─────────────────────────────────────────────────────
function AiForecastDialog({ onClose }: { onClose: () => void }) {
  const forecast = useAiFinanceForecast();
  const [result, setResult] = useState<{ narrative: string; openPipelineValue: number; weightedPipeline: number } | null>(null);

  const run = () => {
    setResult(null);
    forecast.mutate(undefined, {
      onSuccess: (res) => setResult({ narrative: res.narrative, openPipelineValue: res.openPipelineValue, weightedPipeline: res.weightedPipeline }),
      onError: (err: any) => toast.error(err?.error ?? "AI forecast failed — check that OPENAI_API_KEY is configured"),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI Revenue Forecast</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Button onClick={run} disabled={forecast.isPending} className="gap-2 w-full">
            <Sparkles className="w-4 h-4" /> {forecast.isPending ? "Forecasting..." : result ? "Regenerate" : "Generate Forecast"}
          </Button>
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/30 border border-border rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground font-mono uppercase">Open Pipeline</div>
                  <div className="font-mono font-bold text-lg">${result.openPipelineValue.toLocaleString()}</div>
                </div>
                <div className="bg-muted/30 border border-border rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground font-mono uppercase">Weighted Pipeline</div>
                  <div className="font-mono font-bold text-lg text-primary">${result.weightedPipeline.toLocaleString()}</div>
                </div>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {result.narrative}
              </div>
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

// ─── FinanceInvoices ──────────────────────────────────────────────────────────
export default function FinanceInvoices() {
  const { data: invoices, isLoading } = useListInvoices({}, { query: { queryKey: getListInvoicesQueryKey({}) } });
  const qc = useQueryClient();
  const deleteInvoice = useDeleteInvoice();
  const [createOpen, setCreateOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [forecastOpen, setForecastOpen] = useState(false);

  const handleDelete = (id: number) => {
    if (!confirm("Delete this invoice?")) return;
    deleteInvoice.mutate({ id }, {
      onSuccess: () => { toast.success("Invoice deleted"); qc.invalidateQueries({ queryKey: getListInvoicesQueryKey({}) }); },
      onError: () => toast.error("Failed to delete invoice"),
    });
  };

  const totalPaid = invoices?.filter((i) => i.status === "paid").reduce((acc, i) => acc + i.amount, 0) || 0;
  const totalOutstanding = invoices?.filter((i) => i.status === "sent" || i.status === "overdue").reduce((acc, i) => acc + i.amount, 0) || 0;
  const totalOverdue = invoices?.filter((i) => i.status === "overdue").reduce((acc, i) => acc + i.amount, 0) || 0;

  const filtered = invoices?.filter((i) => statusFilter === "all" || i.status === statusFilter);

  const openEdit = () => { if (selectedInvoice) { setEditInvoice(selectedInvoice); setSelectedInvoice(null); } };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {createOpen && <InvoiceDialog open onClose={() => setCreateOpen(false)} />}
      {editInvoice && <InvoiceDialog open onClose={() => setEditInvoice(null)} invoice={editInvoice} />}
      {forecastOpen && <AiForecastDialog onClose={() => setForecastOpen(false)} />}
      <InvoiceSheet invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} onEdit={openEdit} />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Financial Ledger</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Invoice tracking and revenue realization.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setForecastOpen(true)}><Sparkles className="w-4 h-4" /> AI Forecast</Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Issue Invoice</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2"><DollarSign className="w-4 h-4" /><span className="text-sm font-medium">Total Paid (YTD)</span></div>
            <div className="text-3xl font-mono font-bold text-foreground">${totalPaid.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-warning mb-2"><ArrowUpRight className="w-4 h-4" /><span className="text-sm font-medium">Outstanding</span></div>
            <div className="text-3xl font-mono font-bold text-warning">${totalOutstanding.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive mb-2"><AlertCircle className="w-4 h-4" /><span className="text-sm font-medium">Overdue</span></div>
            <div className="text-3xl font-mono font-bold text-destructive">${totalOverdue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2"><FileText className="w-4 h-4" /><span className="text-sm font-medium">Total Invoices</span></div>
            <div className="text-3xl font-mono font-bold text-foreground">{invoices?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-card border-border text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border bg-card/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead>Invoice #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : filtered?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No invoices found.</TableCell></TableRow>
            ) : filtered?.map((invoice) => (
              <TableRow key={invoice.id} className="border-border/50 hover:bg-muted/20 cursor-pointer group" onClick={() => setSelectedInvoice(invoice)}>
                <TableCell className="font-mono text-sm font-medium text-primary">{invoice.number}</TableCell>
                <TableCell className="font-medium">{invoice.clientName}</TableCell>
                <TableCell className="font-mono font-bold">${invoice.amount.toLocaleString()}</TableCell>
                <TableCell className="font-mono text-muted-foreground text-sm">{invoice.tax ? `$${invoice.tax.toLocaleString()}` : '-'}</TableCell>
                <TableCell><Badge variant={statusVariant[invoice.status]}>{invoice.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-sm font-mono">{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditInvoice(invoice)}><Pencil className="w-3.5 h-3.5 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(invoice.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
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
