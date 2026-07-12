import { useState } from "react";
import {
  useListProjects, useListTasks,
  useCreateProject, useUpdateProject, useDeleteProject,
  useCreateTask, useUpdateTask, useDeleteTask,
  getListProjectsQueryKey, getListTasksQueryKey,
} from "@workspace/api-client-react";
import type { Project, Task, ProjectInput, ProjectUpdate, TaskInput, TaskUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CheckCircle2, Circle, Clock, ListTodo, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { ProjectInputStatus, TaskInputStatus, TaskInputPriority, TaskUpdateStatus } from "@workspace/api-client-react";

const PROJECT_STATUSES: ProjectInputStatus[] = ["planning", "active", "on_hold", "completed", "cancelled"];
const TASK_STATUSES: TaskInputStatus[] = ["todo", "in_progress", "review", "done"];
const TASK_PRIORITIES: TaskInputPriority[] = ["low", "medium", "high", "urgent"];

const statusVariant: Record<string, any> = { active: "success", planning: "warning", on_hold: "secondary", completed: "primary", cancelled: "destructive" };
const priorityColor: Record<string, string> = { urgent: "bg-destructive shadow-destructive", high: "bg-warning", medium: "bg-muted-foreground", low: "bg-muted-foreground/40" };

// ─── Project Dialog ───────────────────────────────────────────────────────────
function ProjectDialog({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project }) {
  const qc = useQueryClient();
  const create = useCreateProject();
  const update = useUpdateProject();
  const [form, setForm] = useState<ProjectInput>({
    name: project?.name ?? "",
    description: project?.description ?? "",
    status: (project?.status as ProjectInputStatus) ?? "planning",
    owner: project?.owner ?? "",
    dueDate: project?.dueDate ? project.dueDate.split("T")[0] : "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListProjectsQueryKey({}) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (project) {
      update.mutate({ id: project.id, data: form as ProjectUpdate }, {
        onSuccess: () => { toast.success("Project updated"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to update project"),
      });
    } else {
      create.mutate({ data: form }, {
        onSuccess: () => { toast.success("Project created"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to create project"),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{project ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Project Name</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="bg-muted/50 border-border resize-none text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as ProjectInputStatus }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Input value={form.owner ?? ""} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))} className="bg-muted/50 border-border" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Due Date</Label>
            <Input type="date" value={form.dueDate ?? ""} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} className="bg-muted/50 border-border font-mono" />
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

// ─── Task Dialog ──────────────────────────────────────────────────────────────
function TaskDialog({ open, onClose, task, projectId }: { open: boolean; onClose: () => void; task?: Task; projectId?: number }) {
  const qc = useQueryClient();
  const create = useCreateTask();
  const update = useUpdateTask();
  const [form, setForm] = useState<TaskInput>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: (task?.status as TaskInputStatus) ?? "todo",
    priority: (task?.priority as TaskInputPriority) ?? "medium",
    projectId: task?.projectId ?? projectId,
    assignedTo: task?.assignedTo ?? "",
    dueDate: task?.dueDate ? task.dueDate.split("T")[0] : "",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListTasksQueryKey({}) });
    qc.invalidateQueries({ queryKey: getListTasksQueryKey({ projectId }) });
    qc.invalidateQueries({ queryKey: getListProjectsQueryKey({}) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (task) {
      update.mutate({ id: task.id, data: form as TaskUpdate }, {
        onSuccess: () => { toast.success("Task updated"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to update task"),
      });
    } else {
      create.mutate({ data: form }, {
        onSuccess: () => { toast.success("Task created"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to create task"),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{task ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Task Title</Label>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="bg-muted/50 border-border resize-none text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as TaskInputStatus }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v as TaskInputPriority }))}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Input value={form.assignedTo ?? ""} onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))} className="bg-muted/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.dueDate ?? ""} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} className="bg-muted/50 border-border font-mono" />
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

// ─── Projects ─────────────────────────────────────────────────────────────────
export default function Projects() {
  const { data: projects, isLoading: projectsLoading } = useListProjects({}, { query: { queryKey: getListProjectsQueryKey({}) } });
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const qc = useQueryClient();
  const deleteProject = useDeleteProject();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();

  const { data: tasks, isLoading: tasksLoading } = useListTasks(
    { projectId: selectedProjectId || undefined },
    { query: { queryKey: getListTasksQueryKey({ projectId: selectedProjectId || undefined }), enabled: !!selectedProjectId } }
  );

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  const handleDeleteProject = (id: number) => {
    if (!confirm("Delete this project?")) return;
    deleteProject.mutate({ id }, {
      onSuccess: () => {
        toast.success("Project deleted");
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey({}) });
        if (selectedProjectId === id) setSelectedProjectId(null);
      },
      onError: () => toast.error("Failed to delete project"),
    });
  };

  const handleDeleteTask = (id: number) => {
    if (!confirm("Delete this task?")) return;
    deleteTask.mutate({ id }, {
      onSuccess: () => {
        toast.success("Task deleted");
        qc.invalidateQueries({ queryKey: getListTasksQueryKey({ projectId: selectedProjectId || undefined }) });
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey({}) });
      },
      onError: () => toast.error("Failed to delete task"),
    });
  };

  const toggleTaskDone = (task: Task) => {
    const newStatus: TaskUpdateStatus = task.status === "done" ? "todo" : "done";
    updateTask.mutate({ id: task.id, data: { status: newStatus } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey({ projectId: selectedProjectId || undefined }) });
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey({}) });
      },
      onError: () => toast.error("Failed to update task"),
    });
  };

  const tasksByStatus = {
    todo: tasks?.filter((t) => t.status === "todo") || [],
    in_progress: tasks?.filter((t) => t.status === "in_progress") || [],
    review: tasks?.filter((t) => t.status === "review") || [],
    done: tasks?.filter((t) => t.status === "done") || [],
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10 flex flex-col h-full">
      {createProjectOpen && <ProjectDialog open onClose={() => setCreateProjectOpen(false)} />}
      {editProject && <ProjectDialog open onClose={() => setEditProject(null)} project={editProject} />}
      {createTaskOpen && <TaskDialog open onClose={() => setCreateTaskOpen(false)} projectId={selectedProjectId || undefined} />}
      {editTask && <TaskDialog open onClose={() => setEditTask(null)} task={editTask} projectId={selectedProjectId || undefined} />}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Project Matrix</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Operational execution and task tracking.</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateProjectOpen(true)}><Plus className="w-4 h-4" /> New Project</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Projects List */}
        <div className="col-span-1 border-r border-border/50 pr-6 overflow-y-auto space-y-3">
          <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase sticky top-0 bg-background py-2 z-10">
            Project Matrices ({projects?.length || 0})
          </h2>
          {projectsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border bg-card/50"><CardContent className="p-4 h-24"><Skeleton className="w-full h-full" /></CardContent></Card>
            ))
          ) : projects?.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">No projects yet.</div>
          ) : (
            projects?.map((project) => (
              <Card
                key={project.id}
                className={`border-border transition-all cursor-pointer hover:border-primary/50 group ${selectedProjectId === project.id ? 'border-primary shadow-[0_0_15px_rgba(0,255,255,0.08)] bg-primary/5' : 'bg-card/50'}`}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold leading-tight text-sm flex-1">{project.name}</h3>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Badge variant={statusVariant[project.status]} className="text-[10px] uppercase font-mono shrink-0">
                        {project.status.replace('_', ' ')}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditProject(project)}><Pencil className="w-3.5 h-3.5 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteProject(project.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {project.description && <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                      <span>Progress</span>
                      <span className={project.progress === 100 ? 'text-primary' : ''}>{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-1.5" />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                    <span className="flex items-center gap-1"><ListTodo className="w-3.5 h-3.5" /> {project.taskCount ?? 0}</span>
                    {project.dueDate && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(project.dueDate).toLocaleDateString()}</span>}
                    {project.owner && <span>{project.owner}</span>}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Tasks Panel */}
        <div className="col-span-1 lg:col-span-2 flex flex-col overflow-hidden">
          {selectedProjectId && selectedProject ? (
            <>
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div>
                  <h2 className="text-sm font-mono font-semibold text-foreground">{selectedProject.name}</h2>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">Task Queue — {tasks?.length || 0} tasks</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 h-8" onClick={() => setCreateTaskOpen(true)}>
                  <Plus className="w-3 h-3" /> Add Task
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {tasksLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i} className="border-border bg-card/30"><CardContent className="p-3"><Skeleton className="h-8 w-full" /></CardContent></Card>
                  ))
                ) : tasks?.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                    No tasks yet. Add one to get started.
                  </div>
                ) : (
                  <AnimatePresence>
                    {tasks?.map((task) => (
                      <motion.div key={task.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                        <Card className="border-border/50 bg-card hover:bg-muted/20 transition-colors group">
                          <CardContent className="p-3 flex items-center gap-3">
                            <button
                              className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                              onClick={() => toggleTaskDone(task)}
                            >
                              {task.status === 'done'
                                ? <CheckCircle2 className="w-5 h-5 text-primary" />
                                : <Circle className="w-5 h-5" />
                              }
                            </button>
                            <div className="flex-1 flex items-center justify-between min-w-0">
                              <div className="min-w-0">
                                <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                                  {task.title}
                                </span>
                                {task.assignedTo && (
                                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{task.assignedTo}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <Badge variant="outline" className="text-[10px] uppercase font-mono border-border/50">
                                  {task.status.replace('_', ' ')}
                                </Badge>
                                <div
                                  className={`w-2 h-2 rounded-full ${priorityColor[task.priority]} shadow-sm`}
                                  title={`Priority: ${task.priority}`}
                                />
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                                      <MoreHorizontal className="w-3.5 h-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setEditTask(task)}><Pencil className="w-3.5 h-3.5 mr-2" />Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* Status summary bar */}
              {tasks && tasks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border shrink-0">
                  <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                    {Object.entries(tasksByStatus).map(([status, list]) => (
                      <span key={status} className="flex items-center gap-1">
                        <span className="font-bold text-foreground">{list.length}</span>
                        {status.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
              Select a project to view its task queue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
