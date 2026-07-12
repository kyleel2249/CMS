import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, Target, TicketCheck, Megaphone,
  Receipt, Briefcase, Cpu, BarChart2, Plus, User, Building2,
  DollarSign, FileText, Folder, TrendingUp, Loader2,
} from "lucide-react";
import {
  useListContacts, useListDeals, useListTickets, useListLeads,
  getListContactsQueryKey, getListDealsQueryKey,
  getListTicketsQueryKey, getListLeadsQueryKey,
} from "@workspace/api-client-react";

const NAV_ITEMS = [
  { label: "Dashboard",         href: "/",          icon: LayoutDashboard, desc: "Overview & KPIs" },
  { label: "CRM Hub",           href: "/crm",       icon: Users,           desc: "Contacts, companies, leads" },
  { label: "Sales Pipeline",    href: "/sales",     icon: Target,          desc: "Deals by stage" },
  { label: "Support Nexus",     href: "/support",   icon: TicketCheck,     desc: "Tickets & resolution" },
  { label: "Marketing Vectors", href: "/marketing", icon: Megaphone,       desc: "Campaign telemetry" },
  { label: "Financial Ledger",  href: "/finance",   icon: Receipt,         desc: "Invoices & revenue" },
  { label: "Project Matrix",    href: "/projects",  icon: Briefcase,       desc: "Projects & tasks" },
  { label: "Analytics",         href: "/analytics", icon: BarChart2,       desc: "Cross-module intelligence" },
  { label: "NEXUS AI",          href: "/ai",        icon: Cpu,             desc: "AI command center" },
];

const QUICK_ACTIONS = [
  { label: "New Contact",  href: "/crm",       icon: User,      value: "new contact create" },
  { label: "New Deal",     href: "/sales",     icon: Target,    value: "new deal create" },
  { label: "New Ticket",   href: "/support",   icon: TicketCheck,value: "new ticket support" },
  { label: "New Invoice",  href: "/finance",   icon: Receipt,   value: "new invoice finance" },
  { label: "New Campaign", href: "/marketing", icon: Megaphone, value: "new campaign marketing" },
  { label: "New Project",  href: "/projects",  icon: Folder,    value: "new project tasks" },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");

  // Only fetch when palette is open
  const enabled = open;
  const { data: contacts, isLoading: cLoad } = useListContacts({}, { query: { queryKey: getListContactsQueryKey({}), enabled } });
  const { data: deals,    isLoading: dLoad } = useListDeals({},    { query: { queryKey: getListDealsQueryKey({}),    enabled } });
  const { data: tickets,  isLoading: tLoad } = useListTickets({},  { query: { queryKey: getListTicketsQueryKey({}),  enabled } });
  const { data: leads,    isLoading: lLoad } = useListLeads({},    { query: { queryKey: getListLeadsQueryKey({}),    enabled } });

  const searching = cLoad || dLoad || tLoad || lLoad;

  // Reset query when palette closes
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const runCommand = (href: string) => {
    onOpenChange(false);
    navigate(href);
  };

  const q = query.trim().toLowerCase();

  // Filtered results — only show when user has typed something
  const filteredContacts = useMemo(() => {
    if (!q || !contacts) return [];
    return contacts.filter(c =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q)
    ).slice(0, 4);
  }, [contacts, q]);

  const filteredDeals = useMemo(() => {
    if (!q || !deals) return [];
    return deals.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.stage.toLowerCase().includes(q) ||
      (d.contactName ?? "").toLowerCase().includes(q)
    ).slice(0, 4);
  }, [deals, q]);

  const filteredTickets = useMemo(() => {
    if (!q || !tickets) return [];
    return tickets.filter(t =>
      t.subject.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q) ||
      (t.contactName ?? "").toLowerCase().includes(q)
    ).slice(0, 3);
  }, [tickets, q]);

  const filteredLeads = useMemo(() => {
    if (!q || !leads) return [];
    return leads.filter(l =>
      `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.source.toLowerCase().includes(q)
    ).slice(0, 3);
  }, [leads, q]);

  const hasResults = filteredContacts.length + filteredDeals.length + filteredTickets.length + filteredLeads.length > 0;
  const isSearching = q.length > 0;

  // Filtered nav items
  const filteredNav = q
    ? NAV_ITEMS.filter(n => n.label.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q))
    : NAV_ITEMS;

  const filteredActions = q
    ? QUICK_ACTIONS.filter(a => a.label.toLowerCase().includes(q) || a.value.includes(q))
    : QUICK_ACTIONS;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search contacts, deals, tickets or navigate…"
        className="font-mono"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[480px]">
        {/* Loading indicator */}
        {isSearching && searching && (
          <div className="py-2 px-4 flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <Loader2 className="w-3 h-3 animate-spin" /> Searching NEXUS data…
          </div>
        )}

        {/* No results */}
        {isSearching && !searching && !hasResults && filteredNav.length === 0 && (
          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground font-mono">
            No results for "{query}"
          </CommandEmpty>
        )}

        {/* Live Contacts */}
        {filteredContacts.length > 0 && (
          <>
            <CommandGroup heading="Contacts">
              {filteredContacts.map(c => (
                <CommandItem
                  key={`contact-${c.id}`}
                  value={`contact ${c.firstName} ${c.lastName} ${c.email}`}
                  onSelect={() => runCommand("/crm")}
                  className="gap-3 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-secondary/20 border border-secondary/40 flex items-center justify-center text-secondary text-xs font-bold shrink-0">
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{c.firstName} {c.lastName}</span>
                    <span className="text-xs text-muted-foreground ml-2">{c.email}</span>
                  </div>
                  {c.company && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{c.company}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Live Deals */}
        {filteredDeals.length > 0 && (
          <>
            <CommandGroup heading="Deals">
              {filteredDeals.map(d => (
                <CommandItem
                  key={`deal-${d.id}`}
                  value={`deal ${d.name} ${d.stage}`}
                  onSelect={() => runCommand("/sales")}
                  className="gap-3 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 capitalize">{d.stage.replace("_", " ")}</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 shrink-0">${d.value.toLocaleString()}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Live Tickets */}
        {filteredTickets.length > 0 && (
          <>
            <CommandGroup heading="Tickets">
              {filteredTickets.map(t => (
                <CommandItem
                  key={`ticket-${t.id}`}
                  value={`ticket ${t.subject} ${t.status}`}
                  onSelect={() => runCommand("/support")}
                  className="gap-3 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center justify-center shrink-0">
                    <TicketCheck className="w-3.5 h-3.5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium line-clamp-1">{t.subject}</span>
                  </div>
                  <span className={`text-[10px] font-mono shrink-0 capitalize px-1.5 py-0.5 rounded ${
                    t.priority === "urgent" ? "bg-destructive/20 text-destructive" :
                    t.priority === "high" ? "bg-orange-500/20 text-orange-400" : "bg-muted text-muted-foreground"
                  }`}>{t.priority}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Live Leads */}
        {filteredLeads.length > 0 && (
          <>
            <CommandGroup heading="Leads">
              {filteredLeads.map(l => (
                <CommandItem
                  key={`lead-${l.id}`}
                  value={`lead ${l.firstName} ${l.lastName} ${l.email}`}
                  onSelect={() => runCommand("/crm")}
                  className="gap-3 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{l.firstName} {l.lastName}</span>
                    <span className="text-xs text-muted-foreground ml-2 capitalize">{l.source.replace("_", " ")}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">Score {l.score}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        {filteredNav.length > 0 && (
          <>
            <CommandGroup heading={isSearching ? "Modules" : "Navigation"}>
              {filteredNav.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.label + " " + item.desc}
                  onSelect={() => runCommand(item.href)}
                  className="gap-3 cursor-pointer"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium">{item.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{item.desc}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Quick Actions */}
        {filteredActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              {filteredActions.map((action) => (
                <CommandItem
                  key={action.value}
                  value={action.value}
                  onSelect={() => runCommand(action.href)}
                  className="gap-3 cursor-pointer"
                >
                  <div className="w-5 h-5 rounded border border-dashed border-border flex items-center justify-center shrink-0">
                    <Plus className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <span>{action.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>

      <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground font-mono">
        <span><kbd className="px-1 py-0.5 rounded border border-border">↑↓</kbd> navigate</span>
        <span><kbd className="px-1 py-0.5 rounded border border-border">↵</kbd> open</span>
        <span><kbd className="px-1 py-0.5 rounded border border-border">esc</kbd> close</span>
      </div>
    </CommandDialog>
  );
}
