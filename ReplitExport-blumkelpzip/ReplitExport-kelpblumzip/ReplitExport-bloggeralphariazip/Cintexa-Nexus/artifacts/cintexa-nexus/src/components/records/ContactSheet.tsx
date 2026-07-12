import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useListLeads, useListCompanies,
  getListLeadsQueryKey, getListCompaniesQueryKey,
} from "@workspace/api-client-react";
import type { Contact } from "@workspace/api-client-react";
import {
  Mail, Phone, Building2, Globe, MapPin, Star,
  User, Tag, Briefcase, Edit, ExternalLink,
} from "lucide-react";

interface ContactSheetProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (contact: Contact) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  inactive: "bg-muted text-muted-foreground border-border",
  prospect: "bg-primary/20 text-primary border-primary/30",
  customer: "bg-secondary/20 text-secondary border-secondary/30",
};

function ScoreBar({ score }: { score: number }) {
  const pct = score;
  const color = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-primary" : score >= 30 ? "bg-orange-400" : "bg-muted-foreground";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-muted-foreground">Lead Score</span>
        <span className={score >= 80 ? "text-emerald-400" : score >= 50 ? "text-primary" : "text-muted-foreground"}>{score}/100</span>
      </div>
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ContactSheet({ contact, open, onOpenChange, onEdit }: ContactSheetProps) {
  const { data: leads } = useListLeads({}, {
    query: { queryKey: getListLeadsQueryKey({}), enabled: open && !!contact }
  });
  const { data: companies } = useListCompanies({}, {
    query: { queryKey: getListCompaniesQueryKey({}), enabled: open && !!contact }
  });

  if (!contact) return null;

  const contactLeads = (leads ?? []).filter(l => l.email === contact.email);
  const linkedCompany = contact.companyId
    ? (companies ?? []).find(c => c.id === contact.companyId)
    : null;

  const initials = `${contact.firstName[0]}${contact.lastName[0]}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-[480px] flex flex-col p-0">
        <SheetHeader className="p-6 border-b border-border shrink-0">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-secondary/20 border border-secondary/40 flex items-center justify-center text-secondary text-xl font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg">{contact.firstName} {contact.lastName}</SheetTitle>
              {contact.title && <p className="text-sm text-muted-foreground">{contact.title}</p>}
              {contact.company && (
                <p className="text-xs font-mono text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {contact.company}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Badge className={`text-xs border ${STATUS_COLORS[contact.status] ?? "bg-muted"}`} variant="outline">
                {contact.status}
              </Badge>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => { onOpenChange(false); onEdit(contact); }}>
                <Edit className="w-3 h-3" /> Edit
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Score */}
            <ScoreBar score={contact.score ?? 0} />

            <Separator className="bg-border/50" />

            {/* Contact details */}
            <section className="space-y-3">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Contact Details</h3>
              <div className="space-y-2.5">
                {[
                  { icon: Mail, label: "Email", value: contact.email, href: `mailto:${contact.email}` },
                  { icon: Phone, label: "Phone", value: contact.phone },
                  { icon: Globe, label: "Website", value: contact.website, href: contact.website ? (contact.website.startsWith("http") ? contact.website : `https://${contact.website}`) : undefined },
                  { icon: MapPin, label: "Location", value: [contact.city, contact.country].filter(Boolean).join(", ") || null },
                ].filter(r => r.value).map(({ icon: Icon, label, value, href }) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <div className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-muted-foreground text-xs w-16 shrink-0">{label}</span>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        {value} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-foreground">{value}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Tags */}
            {contact.tags && contact.tags.length > 0 && (
              <>
                <Separator className="bg-border/50" />
                <section className="space-y-2">
                  <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3 h-3" /> Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs font-mono">{tag}</Badge>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Linked Company */}
            {linkedCompany && (
              <>
                <Separator className="bg-border/50" />
                <section className="space-y-2">
                  <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> Company
                  </h3>
                  <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                    <div className="font-medium text-sm">{linkedCompany.name}</div>
                    {linkedCompany.industry && <div className="text-xs text-muted-foreground">{linkedCompany.industry}</div>}
                    <div className="flex items-center gap-3 mt-2 text-xs font-mono text-muted-foreground">
                      {linkedCompany.employees && <span>{linkedCompany.employees.toLocaleString()} employees</span>}
                      {linkedCompany.revenue && <span>${(linkedCompany.revenue / 1e6).toFixed(1)}M revenue</span>}
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* Linked Leads */}
            {contactLeads.length > 0 && (
              <>
                <Separator className="bg-border/50" />
                <section className="space-y-2">
                  <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Associated Leads
                  </h3>
                  <div className="space-y-2">
                    {contactLeads.map(lead => (
                      <div key={lead.id} className="p-2.5 rounded-lg border border-border bg-muted/10 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{lead.firstName} {lead.lastName}</div>
                          <div className="text-xs text-muted-foreground capitalize">{lead.source.replace("_", " ")} · {lead.status}</div>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-mono">
                          <Star className="w-3 h-3 text-warning fill-warning" />
                          <span>{lead.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Notes */}
            {contact.notes && (
              <>
                <Separator className="bg-border/50" />
                <section className="space-y-2">
                  <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Notes</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/50">
                    {contact.notes}
                  </p>
                </section>
              </>
            )}

            {/* Metadata */}
            <Separator className="bg-border/50" />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>ID #{contact.id}</span>
              {contact.createdAt && (
                <span>Created {new Date(contact.createdAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
