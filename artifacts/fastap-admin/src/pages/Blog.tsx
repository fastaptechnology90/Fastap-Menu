import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type BlogPost } from "@/lib/apiClient";
import { Plus, Pencil, Trash2, X, Loader2, Newspaper, Eye, Globe, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Draft = Partial<BlogPost>;

export default function Blog() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<BlogPost | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["blogs"], queryFn: api.blogs.list });
  const posts = data?.posts ?? [];

  const saveMutation = useMutation({
    mutationFn: (draft: Draft) => draft.id ? api.blogs.update(draft.id, draft) : api.blogs.create(draft),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blogs"] }); setEditing(null); toast({ title: "Blog saved" }); },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.blogs.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blogs"] }); toast({ title: "Blog deleted" }); },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const published = posts.filter(p => p.status === "published").length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Newspaper className="h-6 w-6" /> Blog</h2>
          <p className="text-muted-foreground">Write and publish blog posts. Managed by the Digital Marketing team.</p>
        </div>
        <Button onClick={() => setEditing({ status: "draft", title: "", content: "", excerpt: "" })}>
          <Plus className="h-4 w-4 mr-1" /> New post
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="py-4"><p className="text-2xl font-extrabold">{posts.length}</p><p className="text-xs text-muted-foreground">Total posts</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-2xl font-extrabold text-emerald-500">{published}</p><p className="text-xs text-muted-foreground">Published</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-2xl font-extrabold text-amber-500">{posts.length - published}</p><p className="text-xs text-muted-foreground">Drafts</p></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : posts.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No blog posts yet. Click "New post" to write your first one.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {posts.map(post => (
            <Card key={post.id} className="flex flex-col">
              {post.coverUrl && <img src={post.coverUrl} alt="" className="h-36 w-full object-cover rounded-t-xl" />}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{post.title}</CardTitle>
                  <Badge variant={post.status === "published" ? "default" : "secondary"} className="shrink-0">
                    {post.status === "published" ? <Globe className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                    {post.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{post.excerpt || post.content.slice(0, 140)}</p>
                <p className="text-xs text-muted-foreground/70 mt-2">By {post.author} · {new Date(post.createdAt).toLocaleDateString()}</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setPreview(post)}><Eye className="h-3.5 w-3.5 mr-1" /> View</Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(post)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => { if (confirm(`Delete "${post.title}"?`)) deleteMutation.mutate(post.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">{editing.id ? "Edit post" : "New post"}</CardTitle>
              <button onClick={() => setEditing(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </CardHeader>
            <CardContent className="space-y-3 overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <input value={editing.title ?? ""} onChange={e => setEditing(p => ({ ...p!, title: e.target.value }))} placeholder="Post title" className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cover image URL (optional)</label>
                <input value={editing.coverUrl ?? ""} onChange={e => setEditing(p => ({ ...p!, coverUrl: e.target.value }))} placeholder="https://…" className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Excerpt (short summary)</label>
                <textarea value={editing.excerpt ?? ""} onChange={e => setEditing(p => ({ ...p!, excerpt: e.target.value }))} rows={2} placeholder="One or two lines shown in the list" className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Content</label>
                <textarea value={editing.content ?? ""} onChange={e => setEditing(p => ({ ...p!, content: e.target.value }))} rows={10} placeholder="Write your blog content here…" className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <select value={editing.status ?? "draft"} onChange={e => setEditing(p => ({ ...p!, status: e.target.value as "draft" | "published" }))} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" disabled={saveMutation.isPending || !editing.title?.trim()} onClick={() => saveMutation.mutate(editing)}>
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-xl">{preview.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">By {preview.author} · {new Date(preview.createdAt).toLocaleDateString()} · {preview.status}</p>
              </div>
              <button onClick={() => setPreview(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              {preview.coverUrl && <img src={preview.coverUrl} alt="" className="w-full rounded-lg mb-4 max-h-64 object-cover" />}
              {preview.excerpt && <p className="text-sm font-medium text-muted-foreground mb-3">{preview.excerpt}</p>}
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{preview.content}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
