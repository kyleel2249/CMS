import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetDashboardActivity, getGetDashboardActivityQueryKey } from "@workspace/api-client-react";
import { Bell, DollarSign, Users, Target, TicketCheck, Megaphone, FolderOpen, CheckCheck } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TYPE_ICON: Record<string, React.ElementType> = {
  deal:     Target,
  contact:  Users,
  ticket:   TicketCheck,
  campaign: Megaphone,
  invoice:  DollarSign,
  lead:     Users,
  project:  FolderOpen,
};

const TYPE_COLOR: Record<string, string> = {
  deal:     "text-primary bg-primary/10 border-primary/20",
  contact:  "text-secondary bg-secondary/10 border-secondary/20",
  ticket:   "text-destructive bg-destructive/10 border-destructive/20",
  campaign: "text-warning bg-warning/10 border-warning/20",
  invoice:  "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  lead:     "text-violet-400 bg-violet-400/10 border-violet-400/20",
  project:  "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationPanel({ open, onOpenChange }: NotificationPanelProps) {
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const { data: activity, isLoading } = useGetDashboardActivity(
    { limit: 20 },
    { query: { queryKey: getGetDashboardActivityQueryKey(), enabled: open } }
  );

  const markAllRead = () => {
    if (activity) setReadIds(new Set(activity.map(a => a.id)));
  };

  const unreadCount = (activity ?? []).filter(a => !readIds.has(a.id)).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-[400px] flex flex-col p-0">
        <SheetHeader className="p-6 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 font-mono text-base">
              <Bell className="w-4 h-4 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <Badge className="ml-1 px-1.5 py-0 text-[10px] font-mono">{unreadCount}</Badge>
              )}
            </SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5 h-7" onClick={markAllRead}>
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-1">Live activity across all modules</p>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3">
                  <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))
            ) : activity?.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No recent activity.
              </div>
            ) : (
              <AnimatePresence>
                {activity?.map((item, i) => {
                  const Icon = TYPE_ICON[item.type] ?? Bell;
                  const colorClass = TYPE_COLOR[item.type] ?? "text-muted-foreground bg-muted border-border";
                  const isUnread = !readIds.has(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setReadIds(prev => new Set([...prev, item.id]))}
                      className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isUnread
                          ? "border-border bg-muted/30 hover:bg-muted/50"
                          : "border-transparent bg-transparent hover:bg-muted/20"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight line-clamp-1">{item.title}</p>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0 mt-0.5">
                            {timeAgo(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                        {isUnread && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary absolute right-4 top-1/2 -translate-y-1/2" />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border shrink-0">
          <p className="text-[10px] text-muted-foreground font-mono text-center">
            Showing last 20 events across all modules
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
