import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image, Wand2, Download, Copy, RefreshCw, Loader2, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API = "/api";

type Generated = {
  imageUrl: string;
  originalPrompt: string;
  enhancedPrompt: string;
  style: string;
  width: number;
  height: number;
  seed: number;
  id: string;
};

const SIZES = [
  { label: "Square 1:1", w: 1024, h: 1024 },
  { label: "Landscape 16:9", w: 1280, h: 720 },
  { label: "Portrait 9:16", w: 720, h: 1280 },
  { label: "Banner 3:1", w: 1200, h: 400 },
  { label: "Card 4:3", w: 1024, h: 768 },
];

export default function Visuals() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("realistic");
  const [sizeIdx, setSizeIdx] = useState(0);
  const [enhance, setEnhance] = useState(true);
  const [gallery, setGallery] = useState<Generated[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Generated | null>(null);
  const [imgLoading, setImgLoading] = useState(false);

  const { data: styles = [] } = useQuery<{ id: string; label: string; description: string }[]>({
    queryKey: ["visual-styles"],
    queryFn: () => fetch(`${API}/visuals/styles`).then(r => r.json()),
    staleTime: Infinity,
  });

  const size = SIZES[sizeIdx];

  const generate = async () => {
    if (!prompt.trim()) { toast.error("Enter a prompt first"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/visuals/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, width: size.w, height: size.h, enhance }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const item: Generated = { ...data, id: Date.now().toString() };
      setGallery(g => [item, ...g]);
      setSelected(item);
      setImgLoading(true);
      toast.success("Image generated!");
    } catch { toast.error("Generation failed"); }
    setLoading(false);
  };

  const download = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.jpg`;
      a.click();
      toast.success("Downloaded!");
    } catch { window.open(url, "_blank"); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Image className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-mono font-semibold">AI Visual Studio</h1>
          <p className="text-xs text-muted-foreground font-mono">Generate stunning visuals with AI — powered by Flux</p>
        </div>
        <Badge variant="outline" className="ml-auto font-mono text-xs gap-1 text-purple-400 border-purple-500/30"><Sparkles className="h-3 w-3" /> AI-Powered</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Prompt</label>
              <Textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe the image you want to create…&#10;e.g. A professional team working in a modern office with natural light"
                rows={4}
                className="font-mono text-sm resize-none"
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
              />
              <p className="text-xs text-muted-foreground font-mono mt-1">Tip: ⌘+Enter to generate</p>
            </div>

            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Style</label>
              <div className="grid grid-cols-3 gap-1.5">
                {styles.map(s => (
                  <button key={s.id} onClick={() => setStyle(s.id)} className={cn("px-2 py-1.5 rounded text-xs font-mono text-center transition-colors border", style === s.id ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-border hover:text-foreground")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Size</label>
              <div className="relative">
                <select value={sizeIdx} onChange={e => setSizeIdx(Number(e.target.value))} className="w-full appearance-none bg-muted/40 border border-border rounded-md px-3 py-2 text-xs font-mono pr-8">
                  {SIZES.map((s, i) => <option key={i} value={i}>{s.label} ({s.w}×{s.h})</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setEnhance(e => !e)} className={cn("w-8 h-4 rounded-full transition-colors relative", enhance ? "bg-primary" : "bg-muted")}>
                <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform", enhance ? "translate-x-4" : "translate-x-0.5")} />
              </div>
              <span className="text-xs font-mono">AI prompt enhancement</span>
            </label>

            <Button onClick={generate} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {loading ? "Generating…" : "Generate Image"}
            </Button>
          </div>

          {/* Gallery thumbnails */}
          {gallery.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs font-mono text-muted-foreground mb-2">Recent ({gallery.length})</p>
              <div className="grid grid-cols-4 gap-1.5">
                {gallery.slice(0, 8).map(item => (
                  <button key={item.id} onClick={() => { setSelected(item); setImgLoading(true); }} className={cn("aspect-square rounded overflow-hidden border-2 transition-colors", selected?.id === item.id ? "border-primary" : "border-transparent hover:border-border")}>
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {!selected ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground gap-3">
              <div className="w-16 h-16 rounded-xl bg-muted/30 flex items-center justify-center">
                <Image className="h-8 w-8 opacity-30" />
              </div>
              <p className="font-mono text-sm">Your generated image will appear here</p>
              <p className="font-mono text-xs opacity-60">Enter a prompt and click Generate</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-medium truncate">{selected.originalPrompt}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selected.style} · {selected.width}×{selected.height}</p>
                </div>
                <div className="flex gap-2 shrink-0 ml-2">
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { navigator.clipboard.writeText(selected.imageUrl); toast.success("URL copied"); }}>
                    <Copy className="h-3 w-3" /> Copy URL
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => download(selected.imageUrl, `nexus-visual-${selected.seed}`)}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => { setImgLoading(true); setSelected({ ...selected, imageUrl: selected.imageUrl + "&_r=" + Date.now() }); }}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center p-4 bg-muted/10 relative min-h-[350px]">
                {imgLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-xs font-mono text-muted-foreground">Generating with Flux AI…</p>
                    </div>
                  </div>
                )}
                <img
                  src={selected.imageUrl}
                  alt={selected.originalPrompt}
                  className="max-w-full max-h-[500px] rounded-lg shadow-lg object-contain"
                  onLoad={() => setImgLoading(false)}
                  onError={() => { setImgLoading(false); toast.error("Image load failed"); }}
                />
              </div>
              {selected.enhancedPrompt !== selected.originalPrompt && (
                <div className="px-4 py-3 border-t border-border bg-muted/10">
                  <p className="text-xs font-mono text-muted-foreground"><span className="text-primary">AI Enhanced:</span> {selected.enhancedPrompt}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
