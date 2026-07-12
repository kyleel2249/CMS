import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Plus, X, Loader2, LayoutGrid, List, Timeline,
  FileText, Flag, CheckCircle2, Circle, Clock, ChevronRight,
  GripVertical, Milestone, BookOpen, Trash2, Edit2, Users,
  BarChart3, Calendar, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, isPast, parseISO } from "date-fns";

const API = "/api";

type Project = { id: number; name: string; description: string | null; status: string; progress: number; owner: string | null; dueDate: string | null; taskCount: number; createdAt: string; };
type Task = { id: number; title: string; description: string | null; status: string; priority: string; projectId: number | null; assignedTo: string | null; dueDate: string | null; createdAt: string; };
type Document = { id: number; projectId: number; title: string; content: string; author: string | null; isPinned: boolean; updatedAt: string; };
type ProjectMilestone = { id: number; projectId: number; title: string; description: string | null; status: string; dueDate: string | null; order: number; };

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  "on-hold": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  cancelled: "bg-muted text-muted-foreground",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400", high: "text-orange-400", medium: "text-yellow-400", low: "text-muted-foreground",
};
const TASK_STATUSES = ["todo", "in-progress", "review", "done"];
const TASK_STATUS_ICON: Record<string, typeof Circle> = { todo: Circle, "in-progress": Clock, review: BarChart3, done: CheckCircle2 };

function ProjectDialog({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: project?.name ?? "", description: project?.description ?? "", status: project?.status ?? "planning", owner: project?.owner ?? "", dueDate: project?.dueDate ?? "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const url = project ? `${API}/projects/${project.id}` : `${API}/projects`;
      await fetch(url, { method: project ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(project ? "Updated" : "Project created"); onClose();
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle className="font-mono">{project ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Project name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="font-mono text-sm" />
          <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="font-mono text-sm" rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{["planning","active","on-hold","completed","cancelled"].map(s => <SelectItem key={s} value={s} className="font-mono capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Owner" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} className="font-mono text-sm" />
          </div>
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="font-mono text-sm" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ open, onClose, projectId, task }: { open: boolean; onClose: () => void; projectId: number; task?: Task }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: task?.title ?? "", description: task?.description ?? "", status: task?.status ?? "todo", priority: task?.priority ?? "medium", assignedTo: task?.assignedTo ?? "", dueDate: task?.dueDate ?? "", projectId });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const url = task ? `${API}/tasks/${task.id}` : `${API}/tasks`;
      await fetch(url, { method: task ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      toast.success(task ? "Updated" : "Task created"); onClose();
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle className="font-mono">{task ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Task title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="font-mono text-sm" />
          <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="font-mono text-sm" rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
              <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{["urgent","high","medium","low"].map(p => <SelectItem key={p} value={p} className="font-mono capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Assigned to" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className="font-mono text-sm" />
          </div>
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="font-mono text-sm" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocDialog({ open, onClose, projectId, doc }: { open: boolean; onClose: () => void; projectId: number; doc?: Document }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: doc?.title ?? "", content: doc?.content ?? "", author: doc?.author ?? "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const url = doc ? `${API}/projects/documents/${doc.id}` : `${API}/projects/${projectId}/documents`;
      await fetch(url, { method: doc ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      qc.invalidateQueries({ queryKey: ["project-docs", projectId] });
      toast.success("Saved"); onClose();
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader><DialogTitle className="font-mono">{doc ? "Edit Document" : "New Document"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Document title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="font-mono text-sm" />
          <Input placeholder="Author" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} className="font-mono text-sm" />
          <Textarea placeholder="Write your document content here..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="font-mono text-sm" rows={12} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KanbanBoard({ tasks, projectId, onAdd }: { tasks: Task[]; projectId: number; onAdd: () => void }) {
  const qc = useQueryClient();
  const move = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => fetch(`${API}/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => fetch(`${API}/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {TASK_STATUSES.map(status => {
        const col = tasks.filter(t => t.status === status);
        const Icon = TASK_STATUS_ICON[status] ?? Circle;
        return (
          <div key={status} className="min-w-64 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-mono font-semibold capitalize text-muted-foreground">{status.replace("-", " ")}</span>
                <Badge variant="secondary" className="font-mono text-xs h-5">{col.length}</Badge>
              </div>
            </div>
            <div className="space-y-2 min-h-16">
              {col.map(task => (
                <motion.div key={task.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-card border border-border rounded-lg p-3 group hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-mono font-medium leading-snug">{task.title}</p>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100" onClick={() => del.mutate(task.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  {task.assignedTo && <p className="text-xs text-muted-foreground font-mono mt-1">{task.assignedTo}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline" className={cn("text-xs font-mono px-1 h-4", PRIORITY_COLORS[task.priority])}>{task.priority}</Badge>
                    {task.dueDate && (
                      <span className={cn("text-xs font-mono", isPast(parseISO(task.dueDate)) && task.status !== "done" ? "text-red-400" : "text-muted-foreground")}>
                        {format(parseISO(task.dueDate), "MMM d")}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {TASK_STATUSES.filter(s => s !== status).map(s => (
                      <button key={s} onClick={() => move.mutate({ id: task.id, status: s })}
                        className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors">→ {s.replace("-", " ")}</button>
                    ))}
                  </div>
                </motion.div>
              ))}
              <button onClick={onAdd} className="w-full border border-dashed border-border rounded-lg p-2 text-xs font-mono text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center gap-1 justify-center">
                <Plus className="h-3 w-3" /> Add task
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MilestoneTimeline({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");

  const { data: milestones = [] } = useQuery<ProjectMilestone[]>({
    queryKey: ["milestones", projectId],
    queryFn: () => fetch(`${API}/projects/${projectId}/milestones`).then(r => r.json()),
  });

  const addMilestone = useMutation({
    mutationFn: () => fetch(`${API}/projects/${projectId}/milestones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTitle, dueDate: newDue, order: milestones.length }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["milestones", projectId] }); setAdding(false); setNewTitle(""); setNewDue(""); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`${API}/projects/milestones/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", projectId] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono font-semibold">Milestones</h3>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1 text-xs font-mono"><Plus className="h-3 w-3" /> Add</Button>
      </div>
      {milestones.length === 0 && !adding && (
        <div className="text-center py-6 text-muted-foreground text-xs font-mono">No milestones yet</div>
      )}
      <div className="relative">
        {milestones.length > 0 && <div className="absolute left-3 top-3 bottom-3 w-px bg-border" />}
        <div className="space-y-3">
          {milestones.map(m => (
            <div key={m.id} className="flex items-start gap-4 pl-2">
              <button onClick={() => toggle.mutate({ id: m.id, status: m.status === "completed" ? "pending" : "completed" })}
                className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors z-10 relative",
                  m.status === "completed" ? "border-green-500 bg-green-500/20" : "border-border bg-background hover:border-primary/50")}>
                {m.status === "completed" && <CheckCircle2 className="h-3 w-3 text-green-400" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-mono", m.status === "completed" && "line-through text-muted-foreground")}>{m.title}</p>
                {m.dueDate && <p className={cn("text-xs font-mono mt-0.5", m.status !== "completed" && isPast(parseISO(m.dueDate)) ? "text-red-400" : "text-muted-foreground")}>{format(parseISO(m.dueDate), "MMM d, yyyy")}</p>}
              </div>
              <Badge variant="outline" className={cn("text-xs font-mono shrink-0", m.status === "completed" ? "bg-green-500/20 text-green-400" : "text-muted-foreground")}>{m.status}</Badge>
            </div>
          ))}
        </div>
      </div>
      {adding && (
        <div className="flex gap-2">
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Milestone title" className="font-mono text-sm h-8" />
          <Input type="date" value={newDue} onChange={e => setNewDue(e.target.value)} className="font-mono text-sm h-8 w-36" />
          <Button size="sm" onClick={() => addMilestone.mutate()} disabled={!newTitle}>Add</Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newProject, setNewProject] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [newDoc, setNewDoc] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [view, setView] = useState<"kanban" | "docs" | "milestones">("kanban");

  const { data: projects = [], isLoading } = useQuery<Project[]>({ queryKey: ["projects"], queryFn: () => fetch(`${API}/projects`).then(r => r.json()) });
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks", selectedId],
    queryFn: () => fetch(`${API}/tasks?projectId=${selectedId}`).then(r => r.json()),
    enabled: !!selectedId,
  });
  const { data: docs = [] } = useQuery<Document[]>({
    queryKey: ["project-docs", selectedId],
    queryFn: () => fetch(`${API}/projects/${selectedId}/documents`).then(r => r.json()),
    enabled: !!selectedId,
  });

  const deleteProject = useMutation({
    mutationFn: (id: number) => fetch(`${API}/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); if (selectedId) setSelectedId(null); },
  });
  const deleteDoc = useMutation({
    mutationFn: (id: number) => fetch(`${API}/projects/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-docs", selectedId] }),
  });

  const selected = projects.find(p => p.id === selectedId) ?? null;

  return (
    <div className="-m-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Briefcase className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-mono font-semibold">Projects & Work</h1>
          <Badge variant="outline" className="font-mono text-xs">{projects.filter(p => p.status === "active").length} active</Badge>
        </div>
        <Button onClick={() => setNewProject(true)} size="sm" className="gap-2 font-mono"><Plus className="h-4 w-4" /> New Project</Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Project list sidebar */}
        <div className="w-72 border-r border-border flex flex-col shrink-0">
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="p-2 space-y-1">
                {projects.map(p => (
                  <button key={p.id} onClick={() => setSelectedId(p.id)}
                    className={cn("w-full text-left rounded-lg p-3 hover:bg-muted/50 transition-colors group", selectedId === p.id && "bg-muted")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono font-medium truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={cn("text-xs font-mono px-1 h-4", STATUS_COLORS[p.status])}>{p.status}</Badge>
                          <span className="text-xs text-muted-foreground font-mono">{p.taskCount} tasks</span>
                        </div>
                        <Progress value={p.progress} className="mt-2 h-1" />
                        <span className="text-xs text-muted-foreground font-mono">{p.progress}%</span>
                      </div>
                    </div>
                  </button>
                ))}
                {projects.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Briefcase className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-xs font-mono">No projects</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Project detail */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Briefcase className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-mono text-sm">Select a project to get started</p>
            </div>
          ) : (
            <>
              {/* Project header */}
              <div className="px-6 py-4 border-b border-border shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-mono font-bold">{selected.name}</h2>
                      <Badge variant="outline" className={cn("font-mono text-xs", STATUS_COLORS[selected.status])}>{selected.status}</Badge>
                    </div>
                    {selected.description && <p className="text-sm text-muted-foreground font-mono mt-1">{selected.description}</p>}
                    <div className="flex items-center gap-4 mt-2">
                      {selected.owner && <span className="text-xs text-muted-foreground font-mono flex items-center gap-1"><Users className="h-3 w-3" /> {selected.owner}</span>}
                      {selected.dueDate && <span className="text-xs text-muted-foreground font-mono flex items-center gap-1"><Calendar className="h-3 w-3" /> {selected.dueDate}</span>}
                      <div className="flex items-center gap-2">
                        <Progress value={selected.progress} className="w-24 h-1.5" />
                        <span className="text-xs font-mono text-muted-foreground">{selected.progress}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditProject(selected)}><Edit2 className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => { deleteProject.mutate(selected.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>

                {/* View tabs */}
                <div className="flex gap-2 mt-3">
                  {([["kanban", LayoutGrid, "Board"], ["docs", BookOpen, "Docs"], ["milestones", Flag, "Milestones"]] as const).map(([v, Icon, label]) => (
                    <button key={v} onClick={() => setView(v as any)}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                      <Icon className="h-3.5 w-3.5" />{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* View content */}
              <ScrollArea className="flex-1">
                <div className="p-6">
                  {view === "kanban" && (
                    <KanbanBoard tasks={tasks} projectId={selected.id} onAdd={() => setNewTask(true)} />
                  )}

                  {view === "docs" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-mono text-muted-foreground">{docs.length} document{docs.length !== 1 ? "s" : ""}</p>
                        <Button size="sm" onClick={() => setNewDoc(true)} className="gap-2 font-mono"><Plus className="h-4 w-4" /> New Doc</Button>
                      </div>
                      {docs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground"><BookOpen className="h-10 w-10 mb-2 mx-auto opacity-30" /><p className="font-mono text-sm">No documents yet</p></div>
                      ) : (
                        <div className="grid gap-3">
                          {docs.map(doc => (
                            <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              <Card className="border-border hover:border-primary/30 transition-colors group">
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <h3 className="font-mono font-semibold">{doc.title}</h3>
                                        {doc.isPinned && <Badge variant="outline" className="text-xs font-mono px-1 h-4">Pinned</Badge>}
                                      </div>
                                      {doc.author && <p className="text-xs text-muted-foreground font-mono mt-1">{doc.author}</p>}
                                      <p className="text-sm text-muted-foreground font-mono mt-2 line-clamp-2">{doc.content || "Empty document"}</p>
                                    </div>
                                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => deleteDoc.mutate(doc.id)}>
                                      <Trash2 className="h-4 w-4 text-red-400" />
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {view === "milestones" && <MilestoneTimeline projectId={selected.id} />}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>

      <ProjectDialog open={newProject} onClose={() => setNewProject(false)} />
      {editProject && <ProjectDialog open onClose={() => setEditProject(null)} project={editProject} />}
      {selected && <TaskDialog open={newTask} onClose={() => setNewTask(false)} projectId={selected.id} />}
      {selected && <DocDialog open={newDoc} onClose={() => setNewDoc(false)} projectId={selected.id} />}
    </div>
  );
}
