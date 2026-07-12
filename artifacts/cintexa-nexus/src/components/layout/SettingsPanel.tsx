import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings, User, Bell, Shield, Database, Cpu,
  Palette, Globe, KeyRound, Zap, ChevronRight,
} from "lucide-react";
import { useState } from "react";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODULE_STATUS = [
  { name: "CRM Hub",        status: "online",  latency: "12ms"  },
  { name: "Sales Engine",   status: "online",  latency: "8ms"   },
  { name: "Support Matrix", status: "online",  latency: "14ms"  },
  { name: "Marketing Grid", status: "online",  latency: "9ms"   },
  { name: "Finance Ledger", status: "online",  latency: "11ms"  },
  { name: "Project Matrix", status: "online",  latency: "7ms"   },
  { name: "NEXUS AI Core",  status: "online",  latency: "22ms"  },
];

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const [notifEnabled, setNotifEnabled]   = useState(true);
  const [aiAssist, setAiAssist]           = useState(true);
  const [compactMode, setCompactMode]     = useState(false);
  const [autoRefresh, setAutoRefresh]     = useState(true);
  const [darkMode]                        = useState(true);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-[420px] flex flex-col p-0">
        <SheetHeader className="p-6 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 font-mono text-base">
            <Settings className="w-4 h-4 text-primary" />
            System Settings
          </SheetTitle>
          <p className="text-xs text-muted-foreground font-mono mt-1">NEXUS v2.4.1 — workspace configuration</p>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {/* Profile */}
            <section className="space-y-3">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Profile
              </h3>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="w-12 h-12 rounded-full bg-secondary/20 border-2 border-secondary flex items-center justify-center font-bold text-secondary text-lg">
                  EX
                </div>
                <div>
                  <div className="font-semibold text-sm">Executive User</div>
                  <div className="text-xs text-muted-foreground font-mono">admin@nexus.io</div>
                  <Badge className="mt-1 text-[10px] px-1.5" variant="secondary">Super Admin</Badge>
                </div>
              </div>
            </section>

            <Separator className="bg-border/50" />

            {/* Preferences */}
            <section className="space-y-4">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-3.5 h-3.5" /> Preferences
              </h3>
              {[
                { id: "dark",    label: "Dark Mode",             sub: "Command-center aesthetic",    value: darkMode,      set: () => {} },
                { id: "notif",   label: "Notifications",          sub: "Activity feed alerts",         value: notifEnabled,  set: setNotifEnabled },
                { id: "ai",      label: "AI Assist",              sub: "Inline suggestions & brief",   value: aiAssist,      set: setAiAssist },
                { id: "compact", label: "Compact Mode",           sub: "Denser table rows",            value: compactMode,   set: setCompactMode },
                { id: "refresh", label: "Auto-refresh Data",      sub: "Poll every 60 seconds",        value: autoRefresh,   set: setAutoRefresh },
              ].map(({ id, label, sub, value, set }) => (
                <div key={id} className="flex items-center justify-between">
                  <div>
                    <Label htmlFor={id} className="font-medium text-sm cursor-pointer">{label}</Label>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <Switch id={id} checked={value} onCheckedChange={set} />
                </div>
              ))}
            </section>

            <Separator className="bg-border/50" />

            {/* System Status */}
            <section className="space-y-3">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" /> Module Status
              </h3>
              <div className="space-y-2">
                {MODULE_STATUS.map(({ name, status, latency }) => (
                  <div key={name} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <span className="text-sm font-medium">{name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-muted-foreground">{latency}</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${status === "online" ? "bg-emerald-500" : "bg-destructive"} ${status === "online" ? "animate-pulse" : ""}`} />
                        <span className={`text-[10px] font-mono ${status === "online" ? "text-emerald-500" : "text-destructive"}`}>
                          {status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <Separator className="bg-border/50" />

            {/* Quick links */}
            <section className="space-y-2">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" /> Quick Access
              </h3>
              {[
                { icon: Database, label: "Database Console" },
                { icon: KeyRound, label: "API Keys & Tokens" },
                { icon: Shield,   label: "Security & Audit Log" },
                { icon: Bell,     label: "Notification Rules" },
                { icon: Globe,    label: "Workspace Integrations" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors text-sm text-muted-foreground hover:text-foreground group"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </section>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border shrink-0 flex gap-2">
          <Button variant="outline" className="flex-1 text-sm">Reset Defaults</Button>
          <Button className="flex-1 text-sm" onClick={() => onOpenChange(false)}>Apply</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
