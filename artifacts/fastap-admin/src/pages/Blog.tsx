import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type BlogPost } from "@/lib/apiClient";
import { Plus, Pencil, Trash2, X, Loader2, Newspaper, Eye, Globe, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AsyncButton } from "@/components/shared/AsyncButton";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/Page";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";

type Draft = Partial<BlogPost>;

export default function Blog() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm, confirmDialog } = useConfirm();
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
    <div className="space-y-6">
      <PageHeader
        title="Blog"
        description="Write and publish blog posts. Managed by the Digital Marketing team."
        actions={
          <>
            <Button onClick={() => setEditing({ status: "draft", title: "", content: "", excerpt: "" })}>
            <Plus className="h-4 w-4 mr-1" /> New post
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="py-4"><p className="text-2xl font-semibold">{posts.length}</p><p className="text-xs text-muted-foreground">Total posts</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-2xl font-semibold text-success">{published}</p><p className="text-xs text-muted-foreground">Published</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-2xl font-semibold text-warning">{posts.length - published}</p><p className="text-xs text-muted-foreground">Drafts</p></CardContent></Card>
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
                  <AsyncButton
                    variant="outline" size="sm" title="Delete post"
                    errorMessage="Delete failed"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Delete "${post.title}"?`,
                        description: "The post and its published page are removed for good.",
                        destructive: true,
                        confirmLabel: "Delete post",
                      });
                      if (!ok) return;
                      await deleteMutation.mutateAsync(post.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </AsyncButton>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor */}
      {/* Both editors were bare fixed overlays: no focus trap, no Escape, and the page
          behind them still reachable by Tab. */}
      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit post" : "New post"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <FormField label="Title">
                <Input value={editing.title ?? ""} onChange={e => setEditing(p => ({ ...p!, title: e.target.value }))} placeholder="Post title" />
              </FormField>
              <FormField label="Cover image URL" hint="Optional.">
                <Input value={editing.coverUrl ?? ""} onChange={e => setEditing(p => ({ ...p!, coverUrl: e.target.value }))} placeholder="https://…" />
              </FormField>
              <FormField label="Excerpt" hint="One or two lines shown in the list.">
                <Textarea value={editing.excerpt ?? ""} onChange={e => setEditing(p => ({ ...p!, excerpt: e.target.value }))} rows={2} />
              </FormField>
              <FormField label="Content">
                <Textarea value={editing.content ?? ""} onChange={e => setEditing(p => ({ ...p!, content: e.target.value }))} rows={10} placeholder="Write the post here…" />
              </FormField>
              <FormField label="Status">
                <Select value={editing.status ?? "draft"} onValueChange={v => setEditing(p => ({ ...p!, status: v as "draft" | "published" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={saveMutation.isPending || !editing?.title?.trim()} onClick={() => editing && saveMutation.mutate(editing)}>
              {saveMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            {preview && (
              <p className="text-xs text-muted-foreground">
                By {preview.author} · {new Date(preview.createdAt).toLocaleDateString("en-IN")} · {preview.status}
              </p>
            )}
          </DialogHeader>
          {preview && (
            <div>
              {preview.coverUrl && <img src={preview.coverUrl} alt="" className="mb-4 max-h-64 w-full rounded-md object-cover" />}
              {preview.excerpt && <p className="mb-3 text-sm font-medium text-muted-foreground">{preview.excerpt}</p>}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{preview.content}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
