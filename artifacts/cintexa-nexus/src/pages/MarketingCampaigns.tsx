import { useState } from "react";
import {
  useListCampaigns, useCreateCampaign, useUpdateCampaign, useDeleteCampaign,
  getListCampaignsQueryKey, useAiGenerateCampaignCopy,
  useGetCampaignInsights, getGetCampaignInsightsQueryKey,
} from "@workspace/api-client-react";
import type { Campaign, CampaignInput, CampaignUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Mail, MessageSquare, MonitorPlay, MousePointerClick, Eye, Users, MoreHorizontal, Pencil, Trash2, Sparkles, TrendingUp, TrendingDown, Trophy, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { CampaignInputType, CampaignInputStatus } from "@workspace/api-client-react";

const TYPES: CampaignInputType[] = ["email", "sms", "social", "ads", "push"];
const STATUSES: CampaignInputStatus[] = ["draft", "scheduled", "active", "paused", "completed"];
const statusVariant: Record<string, any> = { active: "success", scheduled: "warning", draft: "secondary", paused: "secondary", completed: "outline" };
const performanceBandVariant: Record<string, any> = { top: "success", average: "secondary", underperforming: "destructive", insufficient_data: "outline" };
const performanceBandLabel: Record<string, string> = { top: "Top Performer", average: "On Par", underperforming: "Underperforming", insufficient_data: "No Data Yet" };
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

function TypeIcon({ type }: { type: string }) {
  if (type === "email") return <Mail className="w-5 h-5" />;
  if (type === "sms") return <MessageSquare className="w-5 h-5" />;
  if (type === "social") return <Users className="w-5 h-5" />;
  if (type === "ads") return <MonitorPlay className="w-5 h-5" />;
  return <Mail className="w-5 h-5" />;
}

// ─── Campaign Dialog ──────────────────────────────────────────────────────────
function CampaignDialog({ open, onClose, campaign }: { open: boolean; onClose: () => void; campaign?: Campaign }) {
  const qc = useQueryClient();
  const create = useCreateCampaign();
  const update = useUpdateCampaign();
  const [form, setForm] = useState<CampaignInput>({
    name: campaign?.name ?? "",
    type: (campaign?.type as CampaignInputType) ?? "email",
    status: (campaign?.status as CampaignInputStatus) ?? "draft",
    audienceSize: campaign?.audienceSize ?? 0,
    scheduledAt: campaign?.scheduledAt ? campaign.scheduledAt.split("T")[0] : "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListCampaignsQueryKey({}) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, audienceSize: Number(form.audienceSize), scheduledAt: form.scheduledAt || undefined };
    if (campaign) {
      update.mutate({ id: campaign.id, data: payload as CampaignUpdate }, {
        onSuccess: () => { toast.success("Campaign updated"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to update campaign"),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { toast.success("Campaign initialized"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to create campaign"),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{campaign ? "Edit Campaign" : "Initialize Campaign"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Campaign Name</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="bg-muted/50 border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as CampaignInputType }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as CampaignInputStatus }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Audience Size</Label>
              <Input type="number" min={0} value={form.audienceSize ?? ""} onChange={(e) => setForm((p) => ({ ...p, audienceSize: Number(e.target.value) }))} className="bg-muted/50 border-border font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Launch Date</Label>
              <Input type="date" value={form.scheduledAt ?? ""} onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))} className="bg-muted/50 border-border font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : campaign ? "Save" : "Initialize"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── AI Copy Dialog ───────────────────────────────────────────────────────────
function AiCopyDialog({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const generateCopy = useAiGenerateCampaignCopy();
  const [copy, setCopy] = useState<string | null>(null);
  const [brief, setBrief] = useState("");

  const run = () => {
    setCopy(null);
    generateCopy.mutate({ id: campaign.id, data: { brief: brief || undefined } }, {
      onSuccess: (insight) => setCopy(insight.content),
      onError: (err: any) => toast.error(err?.error ?? "AI copy generation failed — check that OPENAI_API_KEY is configured"),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI Copy — {campaign.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Creative brief (optional)</Label>
            <Input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. focus on urgency, offer 20% off" className="bg-muted/50 border-border" />
          </div>
          <Button onClick={run} disabled={generateCopy.isPending} className="gap-2 w-full">
            <Sparkles className="w-4 h-4" /> {generateCopy.isPending ? "Generating..." : copy ? "Regenerate" : "Generate Copy"}
          </Button>
          {copy && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed whitespace-pre-wrap">
              {copy}
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

// ─── Campaign Insights Panel ────────────────────────────────────────────────
// NEXUS Campaign Intelligence: HubSpot-style funnel view merged with a
// GoHighLevel-style relative performance ranking (vs. this account's own
// channel benchmarks, since no ad-spend data exists to compute true ROAS).
function InsightsPanel() {
  const { data: insights, isLoading } = useGetCampaignInsights({ query: { queryKey: getGetCampaignInsightsQueryKey() } });

  if (isLoading || !insights) return <Skeleton className="h-32 w-full rounded-xl" />;

  const { funnel, topPerformer, needsAttention } = insights;

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5 space-y-4">
        <h3 className="font-mono text-sm font-semibold text-foreground">Funnel Intelligence</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Audience", value: funnel.totalAudience.toLocaleString() },
            { label: "Sent", value: funnel.totalSent.toLocaleString() },
            { label: "Open Rate", value: pct(funnel.overallOpenRate) },
            { label: "CTR", value: pct(funnel.overallClickRate) },
            { label: "Conv. Rate", value: pct(funnel.overallConversionRate) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
              <div className="font-mono font-bold text-lg text-foreground">{value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {topPerformer && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
              <Trophy className="w-4 h-4 text-primary shrink-0" />
              <div className="text-xs">
                <div className="text-muted-foreground">Top performer</div>
                <div className="font-medium text-foreground">{topPerformer.name} <span className="text-primary font-mono">({topPerformer.performanceScore})</span></div>
              </div>
            </div>
          )}
          {needsAttention.length > 0 && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <div className="text-xs">
                <div className="text-muted-foreground">Needs attention</div>
                <div className="font-medium text-foreground">{needsAttention.map((n) => n.name).join(", ")}</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MarketingCampaigns ───────────────────────────────────────────────────────
export default function MarketingCampaigns() {
  const { data: campaigns, isLoading } = useListCampaigns({}, { query: { queryKey: getListCampaignsQueryKey({}) } });
  const qc = useQueryClient();
  const deleteCampaign = useDeleteCampaign();
  const [createOpen, setCreateOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [aiCampaign, setAiCampaign] = useState<Campaign | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const handleDelete = (id: number) => {
    if (!confirm("Delete this campaign?")) return;
    deleteCampaign.mutate({ id }, {
      onSuccess: () => { toast.success("Campaign deleted"); qc.invalidateQueries({ queryKey: getListCampaignsQueryKey({}) }); },
      onError: () => toast.error("Failed to delete campaign"),
    });
  };

  const filtered = campaigns?.filter((c) => statusFilter === "all" || c.status === statusFilter);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {createOpen && <CampaignDialog open onClose={() => setCreateOpen(false)} />}
      {editCampaign && <CampaignDialog open onClose={() => setEditCampaign(null)} campaign={editCampaign} />}
      {aiCampaign && <AiCopyDialog campaign={aiCampaign} onClose={() => setAiCampaign(null)} />}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Marketing Vectors</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Outbound intelligence and campaign telemetry.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-card border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Initialize Campaign</Button>
        </div>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active", value: campaigns?.filter((c) => c.status === "active").length || 0, color: "text-primary" },
          { label: "Total Audience", value: (campaigns?.reduce((acc, c) => acc + c.audienceSize, 0) || 0).toLocaleString(), color: "text-foreground" },
          { label: "Total Sent", value: (campaigns?.reduce((acc, c) => acc + (c.sent || 0), 0) || 0).toLocaleString(), color: "text-foreground" },
          { label: "Converted", value: (campaigns?.reduce((acc, c) => acc + (c.converted || 0), 0) || 0).toLocaleString(), color: "text-success" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card/50 border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground font-mono uppercase mb-1">{label}</div>
            <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <InsightsPanel />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border bg-card/50">
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
          ))
        ) : filtered?.length === 0 ? (
          <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
            No campaigns match this filter.
          </div>
        ) : (
          filtered?.map((campaign, i) => (
            <motion.div key={campaign.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.3) }}>
              <Card className="border-border/50 bg-card hover:border-primary/40 transition-colors h-full flex flex-col group relative">
                {/* Actions */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-card/80 backdrop-blur-sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setAiCampaign(campaign)}><Sparkles className="w-3.5 h-3.5 mr-2" />AI Generate Copy</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditCampaign(campaign)}><Pencil className="w-3.5 h-3.5 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(campaign.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0 pr-10">
                  <div className="space-y-1">
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary mb-2 group-hover:scale-110 transition-transform">
                      <TypeIcon type={campaign.type} />
                    </div>
                    <CardTitle className="text-base font-bold leading-tight">{campaign.name}</CardTitle>
                    <div className="text-xs font-mono text-muted-foreground uppercase">{campaign.type}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={statusVariant[campaign.status]}>{campaign.status}</Badge>
                    {campaign.performanceBand && campaign.performanceBand !== "insufficient_data" && (
                      <Badge variant={performanceBandVariant[campaign.performanceBand]} className="text-[10px] gap-1">
                        {campaign.performanceBand === "top" ? <TrendingUp className="w-3 h-3" /> : campaign.performanceBand === "underperforming" ? <TrendingDown className="w-3 h-3" /> : null}
                        {performanceBandLabel[campaign.performanceBand]}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pb-3 flex-1">
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground font-mono uppercase">Audience</div>
                      <div className="font-mono font-medium">{campaign.audienceSize.toLocaleString()}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground font-mono uppercase">Sent</div>
                      <div className="font-mono font-medium">{campaign.sent?.toLocaleString() || '-'}</div>
                    </div>
                  </div>
                  {(campaign.opened != null || campaign.clicked != null) && (
                    <div className="mt-4 pt-4 border-t border-border/50 flex gap-6">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-mono font-medium">{campaign.opened ? Math.round((campaign.opened / (campaign.sent || 1)) * 100) : 0}%</span>
                        <span className="text-[10px] text-muted-foreground">open</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <MousePointerClick className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-mono font-medium">{campaign.clicked ? Math.round((campaign.clicked / (campaign.opened || 1)) * 100) : 0}%</span>
                        <span className="text-[10px] text-muted-foreground">CTR</span>
                      </div>
                      {campaign.converted != null && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="font-mono font-bold text-primary">{campaign.converted}</span>
                          <span className="text-[10px] text-muted-foreground">conv.</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-0 pb-4 px-6 border-t border-border/10 mt-auto bg-muted/10">
                  <div className="w-full flex justify-between items-center pt-3 text-xs text-muted-foreground font-mono">
                    <span>ID: {campaign.id.toString().padStart(4, '0')}</span>
                    {campaign.scheduledAt && <span>Launch: {new Date(campaign.scheduledAt).toLocaleDateString()}</span>}
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
