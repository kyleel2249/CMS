import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Target,
  TicketCheck,
  Megaphone,
  Receipt,
  Briefcase,
  Cpu,
  Search,
  Bell,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart2,
  BookOpen,
  Zap,
  MessageSquare,
  Puzzle,
  Radio,
  ShieldAlert,
  Trophy,
  Mail,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { SettingsPanel } from "@/components/layout/SettingsPanel";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/",          label: "Dashboard",     icon: LayoutDashboard },
      { href: "/analytics", label: "Analytics",     icon: BarChart2 },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/crm",       label: "CRM Hub",       icon: Users },
      { href: "/sales",     label: "Sales",         icon: Target },
      { href: "/support",   label: "Support",       icon: TicketCheck },
      { href: "/marketing", label: "Marketing",     icon: Megaphone },
      { href: "/finance",   label: "Finance",       icon: Receipt },
      { href: "/projects",  label: "Projects",      icon: Briefcase },
      { href: "/email",     label: "Email",         icon: Mail },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/activity",     label: "Activity",     icon: Radio },
      { href: "/anomalies",    label: "Anomalies",    icon: ShieldAlert },
      { href: "/goals",        label: "Goals & OKRs", icon: Trophy },
      { href: "/knowledge",    label: "Knowledge",    icon: BookOpen },
      { href: "/automations",  label: "Automations",  icon: Zap },
      { href: "/collaboration",label: "Collaboration", icon: MessageSquare },
      { href: "/extensions",   label: "Extensions",   icon: Puzzle },
      { href: "/ai",           label: "NEXUS AI",     icon: Cpu },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed]     = useState(false);
  const [cmdOpen, setCmdOpen]         = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground selection:bg-primary selection:text-primary-foreground">
      <CommandPalette  open={cmdOpen}      onOpenChange={setCmdOpen} />
      <NotificationPanel open={notifOpen}  onOpenChange={setNotifOpen} />
      <SettingsPanel   open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 240 }}
        className="h-full bg-sidebar border-r border-sidebar-border flex flex-col z-20 shrink-0 overflow-hidden"
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(0,255,255,0.4)]">
                <Cpu className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                NEXUS
              </span>
            </motion.div>
          )}
          {collapsed && (
            <div className="w-8 h-8 mx-auto rounded bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(0,255,255,0.4)]">
              <Cpu className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 py-3 flex flex-col gap-0 px-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-2">
              {!collapsed && (
                <div className="px-3 py-1.5 text-[10px] font-mono font-semibold text-muted-foreground/50 uppercase tracking-widest">
                  {group.label}
                </div>
              )}
              {collapsed && <div className="my-1 border-t border-sidebar-border/50 mx-2" />}
              {group.items.map((navItem) => {
                const isActive = location === navItem.href;
                return (
                  <Link key={navItem.href} href={navItem.href} className="block">
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all duration-200 group relative",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-md shadow-[0_0_10px_rgba(0,255,255,0.5)]"
                        />
                      )}
                      <navItem.icon
                        className={cn(
                          "w-4 h-4 shrink-0",
                          isActive ? "text-primary drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]" : ""
                        )}
                      />
                      {!collapsed && (
                        <span className="font-medium text-sm whitespace-nowrap">{navItem.label}</span>
                      )}
                      {collapsed && (
                        <div className="absolute left-14 px-2 py-1 bg-popover border border-border text-popover-foreground text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 z-50 whitespace-nowrap">
                          {navItem.label}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-sidebar-border shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded hover:bg-sidebar-accent text-muted-foreground transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />

        {/* Topbar */}
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between px-6 z-10 shrink-0">
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center bg-muted/50 rounded-full px-3 py-1.5 w-80 border border-border hover:border-primary/50 hover:ring-1 hover:ring-primary/20 transition-all text-left"
          >
            <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
            <span className="text-sm w-full text-muted-foreground/70 font-mono">
              Query NEXUS...
            </span>
            <div className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border shrink-0">
              <span>⌘</span><span>K</span>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setNotifOpen(true)}
              className="relative text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(0,255,255,0.8)]" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-8 h-8 rounded-full bg-secondary/20 border border-secondary flex items-center justify-center text-sm font-bold text-secondary hover:bg-secondary/30 transition-colors"
            >
              EX
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 z-10 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
