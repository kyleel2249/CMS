import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PenSquare, Plus, Trash2, Globe, FileText, Cpu, Search, BookOpen, Loader2, Save, Eye, Lightbulb, ChevronRight, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const API = "/api";

type Post = {
  id: number; title: string; slug: string; excerpt: string | null; content: string;
  status: string; author: string; seoTitle: string | null; seoDescription: string | null;
  seoKeywords: string | null; targetQuestion: string | null; wordCount: number | null;
  readingTime: number | null; aiGenerated: boolean; publishedAt: string | null;
  createdAt: string; updatedAt: string; coverImageUrl: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  published: "text-green-400 border-green-500/30 bg-green-500/10",
  draft: "text-muted-foreground border-border",
  archived: "text-orange-400 border-orange-500/30",
};

const emptyPost = { title: "", content: "", excerpt: "", status: "draft", author: "Admin", seoTitle: "", seoDescription: "", seoKeywords: "", targetQuestion: "", coverImageUrl: "" };

export default function Blog() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editorData, setEditorData] = useState<Record<string, string>>(emptyPost);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [aiForm, setAiForm] = useState({ topic: "", targetQuestion: "", keywords: "", tone: "professional", targetWordCount: "1200" });
  const [researchForm, setResearchForm] = useState({ niche: "", website: "cintexa.com", count: "10" });
  const [aiLoading, setAiLoading] = useState(false);
  const [researchData, setResearchData] = useState<any[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["blog-posts"],
    queryFn: () => fetch(`${API}/blog/posts`).then(r => r.json()),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetch(`${API}/blog/posts/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blog-posts"] }); setSelectedId(null); setIsNew(false); toast.success("Post deleted"); },
  });

  const filtered = posts.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()));
  const selected = selectedId ? posts.find(p => p.id === selectedId) : null;

  const openPost = (post: Post) => {
    setSelectedId(post.id);
    setIsNew(false);
    setEditorData({ title: post.title, content: post.content, excerpt: post.excerpt || "", status: post.status, author: post.author, seoTitle: post.seoTitle || "", seoDescription: post.seoDescription || "", seoKeywords: post.seoKeywords || "", targetQuestion: post.targetQuestion || "", coverImageUrl: post.coverImageUrl || "" });
  };

  const newPost = () => {
    setSelectedId(null);
    setIsNew(true);
    setEditorData({ ...emptyPost });
  };

  const save = async () => {
    if (!editorData.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const url = isNew ? `${API}/blog/posts` : `${API}/blog/posts/${selectedId}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(editorData) });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      setIsNew(false);
      setSelectedId(saved.id);
      toast.success(isNew ? "Post created!" : "Saved!");
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  const aiGenerate = async () => {
    if (!aiForm.topic && !aiForm.targetQuestion) { toast.error("Enter a topic or question"); return; }
    setAiLoading(true);
    try {
      const res = await fetch(`${API}/blog/ai-generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...aiForm, targetWordCount: Number(aiForm.targetWordCount) }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEditorData(d => ({ ...d, title: data.title || d.title, content: data.content || d.content, excerpt: data.excerpt || d.excerpt, seoTitle: data.seoTitle || d.seoTitle, seoDescription: data.seoDescription || d.seoDescription, seoKeywords: data.seoKeywords || d.seoKeywords, targetQuestion: aiForm.targetQuestion }));
      setAiOpen(false);
      if (!isNew && !selectedId) { setIsNew(true); }
      toast.success("AI blog post generated!");
    } catch { toast.error("AI generation failed"); }
    setAiLoading(false);
  };

  const research = async () => {
    setResearchLoading(true);
    try {
      const res = await fetch(`${API}/blog/research`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...researchForm, count: Number(researchForm.count) }) });
      const data = await res.json();
      setResearchData(data.topics || []);
    } catch { toast.error("Research failed"); }
    setResearchLoading(false);
  };

  const useQuestion = (question: string) => {
    setAiForm(f => ({ ...f, targetQuestion: question, topic: question }));
    setResearchOpen(false);
    setAiOpen(true);
    newPost();
  };

  const wc = editorData.content ? editorData.content.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="-m-6 h-[calc(100vh-4rem)] flex">
      {/* Post list */}
      <div className="w-72 border-r border-border flex flex-col shrink-0 bg-card">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <PenSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-mono font-semibold">Blog CMS</span>
            <Badge variant="outline" className="ml-auto font-mono text-xs">{posts.length}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts…" className="pl-8 h-8 text-xs font-mono" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" className="flex-1 gap-1 text-xs" onClick={newPost}><Plus className="h-3.5 w-3.5" /> New</Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { newPost(); setAiOpen(true); }}><Cpu className="h-3.5 w-3.5" /> AI</Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setResearchOpen(true)}><Lightbulb className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : filtered.length === 0 ? <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><BookOpen className="h-8 w-8 mb-2 opacity-30" /><p className="text-xs font-mono">No posts yet</p></div>
            : <div className="divide-y divide-border">
              {filtered.map(p => (
                <button key={p.id} onClick={() => openPost(p)} className={cn("w-full text-left p-3 hover:bg-muted/40 transition-colors", (selectedId === p.id && !isNew) && "bg-muted/60")}>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-xs font-mono font-medium leading-tight line-clamp-2">{p.title}</span>
                    {p.aiGenerated && <Cpu className="h-3 w-3 text-primary shrink-0 mt-0.5" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs font-mono px-1 h-4", STATUS_COLOR[p.status])}>{p.status}</Badge>
                    {p.wordCount && <span className="text-xs text-muted-foreground font-mono">{p.wordCount} words</span>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}</p>
                </button>
              ))}
            </div>
          }
        </ScrollArea>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isNew && !selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
            <PenSquare className="h-12 w-12 opacity-20" />
            <p className="font-mono text-sm">Select a post to edit or create a new one</p>
            <div className="flex gap-2">
              <Button onClick={newPost} className="gap-2"><Plus className="h-4 w-4" /> New Post</Button>
              <Button variant="outline" onClick={() => { newPost(); setAiOpen(true); }} className="gap-2"><Cpu className="h-4 w-4" /> AI Generate</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Editor Toolbar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background/50 shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isNew && <Badge variant="outline" className="font-mono text-xs">New</Badge>}
                {selected?.aiGenerated && <Badge variant="outline" className="font-mono text-xs gap-1 text-primary border-primary/30"><Cpu className="h-2.5 w-2.5" /> AI</Badge>}
                <span className="text-xs font-mono text-muted-foreground">{wc} words</span>
                {editorData.readingTime && <span className="text-xs font-mono text-muted-foreground">· ~{editorData.readingTime} min read</span>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setSeoOpen(true)}>SEO</Button>
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setAiOpen(true)}><Cpu className="h-3.5 w-3.5" /> AI Generate</Button>
                {selectedId && <Button size="sm" variant="outline" className="gap-1 text-xs text-red-400 hover:text-red-300" onClick={() => confirm("Delete this post?") && deleteMut.mutate(selectedId)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                <select value={editorData.status} onChange={e => setEditorData(d => ({ ...d, status: e.target.value }))} className="bg-muted/40 border border-border rounded text-xs font-mono px-2">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
                <Button size="sm" onClick={save} disabled={saving} className="gap-1"><Save className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save"}</Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 max-w-4xl mx-auto space-y-4">
                <Input
                  value={editorData.title}
                  onChange={e => setEditorData(d => ({ ...d, title: e.target.value }))}
                  placeholder="Post title…"
                  className="text-xl font-mono font-bold h-auto py-2 bg-transparent border-none shadow-none focus-visible:ring-0 px-0"
                />
                {editorData.targetQuestion && (
                  <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-md">
                    <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="text-xs font-mono text-muted-foreground">{editorData.targetQuestion}</p>
                  </div>
                )}
                <Input value={editorData.excerpt} onChange={e => setEditorData(d => ({ ...d, excerpt: e.target.value }))} placeholder="Short excerpt / summary…" className="font-mono text-sm text-muted-foreground bg-transparent border-border/50" />
                <Input value={editorData.coverImageUrl} onChange={e => setEditorData(d => ({ ...d, coverImageUrl: e.target.value }))} placeholder="Cover image URL (optional)…" className="font-mono text-xs bg-transparent border-border/50" />
                {editorData.coverImageUrl && <img src={editorData.coverImageUrl} alt="Cover" className="w-full max-h-48 object-cover rounded-lg" />}
                <Textarea
                  value={editorData.content}
                  onChange={e => setEditorData(d => ({ ...d, content: e.target.value }))}
                  placeholder="Write your blog post here… (Markdown supported)"
                  className="font-mono text-sm resize-none min-h-[420px] bg-transparent border-border/50"
                  rows={20}
                />
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* AI Generate Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="font-mono flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /> AI Blog Generator</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-mono text-muted-foreground">Topic / Title</label><Input value={aiForm.topic} onChange={e => setAiForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. How AI improves CRM efficiency" className="font-mono text-sm mt-1" /></div>
            <div><label className="text-xs font-mono text-muted-foreground">Target Question (for SEO)</label><Input value={aiForm.targetQuestion} onChange={e => setAiForm(f => ({ ...f, targetQuestion: e.target.value }))} placeholder="e.g. What is the best CRM software for small business?" className="font-mono text-sm mt-1" /></div>
            <div><label className="text-xs font-mono text-muted-foreground">Keywords</label><Input value={aiForm.keywords} onChange={e => setAiForm(f => ({ ...f, keywords: e.target.value }))} placeholder="CRM software, AI automation, small business" className="font-mono text-sm mt-1" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-mono text-muted-foreground">Tone</label>
                <select value={aiForm.tone} onChange={e => setAiForm(f => ({ ...f, tone: e.target.value }))} className="w-full mt-1 bg-muted/40 border border-border rounded px-2 py-1.5 text-xs font-mono">
                  {["professional", "conversational", "authoritative", "educational", "friendly"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-mono text-muted-foreground">Target Words</label><Input type="number" value={aiForm.targetWordCount} onChange={e => setAiForm(f => ({ ...f, targetWordCount: e.target.value }))} className="font-mono text-sm mt-1" /></div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAiOpen(false)}>Cancel</Button>
            <Button onClick={aiGenerate} disabled={aiLoading} className="gap-2">{aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}{aiLoading ? "Writing…" : "Generate Post"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Research Dialog */}
      <Dialog open={researchOpen} onOpenChange={setResearchOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader><DialogTitle className="font-mono flex items-center gap-2"><Lightbulb className="h-4 w-4 text-primary" /> Topic Research</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={researchForm.niche} onChange={e => setResearchForm(f => ({ ...f, niche: e.target.value }))} placeholder="Niche (e.g. SaaS, CRM, AI tools)…" className="font-mono text-sm flex-1" />
              <Input type="number" value={researchForm.count} onChange={e => setResearchForm(f => ({ ...f, count: e.target.value }))} className="font-mono text-sm w-20" min="5" max="20" />
              <Button onClick={research} disabled={researchLoading} className="gap-1">{researchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Research</Button>
            </div>
            {researchData.length > 0 && (
              <ScrollArea className="h-80">
                <div className="space-y-2 pr-2">
                  {researchData.map((t: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 border border-border rounded-lg hover:border-primary/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-medium">{t.question}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className={cn("text-xs font-mono", t.difficulty === "low" ? "text-green-400 border-green-500/30" : t.difficulty === "high" ? "text-red-400 border-red-500/30" : "text-orange-400 border-orange-500/30")}>{t.difficulty}</Badge>
                          <Badge variant="outline" className="text-xs font-mono">{t.searchVolume} volume</Badge>
                          <Badge variant="outline" className="text-xs font-mono">{t.intent}</Badge>
                        </div>
                        {t.suggestedKeywords && <p className="text-xs text-muted-foreground font-mono mt-1">{t.suggestedKeywords}</p>}
                      </div>
                      <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0" onClick={() => useQuestion(t.question)}><CheckCircle2 className="h-3 w-3" /> Use</Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SEO Dialog */}
      <Dialog open={seoOpen} onOpenChange={setSeoOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="font-mono flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> SEO Settings</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-mono text-muted-foreground">SEO Title <span className={cn("ml-1", (editorData.seoTitle?.length ?? 0) > 60 ? "text-red-400" : "text-muted-foreground")}>{editorData.seoTitle?.length ?? 0}/60</span></label>
              <Input value={editorData.seoTitle} onChange={e => setEditorData(d => ({ ...d, seoTitle: e.target.value }))} className="font-mono text-sm mt-1" />
            </div>
            <div><label className="text-xs font-mono text-muted-foreground">Meta Description <span className={cn("ml-1", (editorData.seoDescription?.length ?? 0) > 155 ? "text-red-400" : "text-muted-foreground")}>{editorData.seoDescription?.length ?? 0}/155</span></label>
              <Textarea value={editorData.seoDescription} onChange={e => setEditorData(d => ({ ...d, seoDescription: e.target.value }))} rows={3} className="font-mono text-sm mt-1 resize-none" />
            </div>
            <div><label className="text-xs font-mono text-muted-foreground">Keywords (comma-separated)</label><Input value={editorData.seoKeywords} onChange={e => setEditorData(d => ({ ...d, seoKeywords: e.target.value }))} placeholder="keyword1, keyword2, keyword3" className="font-mono text-sm mt-1" /></div>
            <div><label className="text-xs font-mono text-muted-foreground">Target Question</label><Input value={editorData.targetQuestion} onChange={e => setEditorData(d => ({ ...d, targetQuestion: e.target.value }))} placeholder="What question does this post answer?" className="font-mono text-sm mt-1" /></div>
            {editorData.seoTitle && (
              <div className="p-3 bg-muted/30 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground font-mono mb-2">Search Preview</p>
                <p className="text-sm text-blue-400 font-medium">{editorData.seoTitle}</p>
                <p className="text-xs text-green-600 font-mono">cintexa.com/blog/{selected?.slug || "your-post-slug"}</p>
                <p className="text-xs text-muted-foreground mt-1">{editorData.seoDescription || "No meta description set."}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end"><Button onClick={() => setSeoOpen(false)}>Done</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
