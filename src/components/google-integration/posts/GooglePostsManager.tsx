import { useEffect, useState } from "react";
import { useGooglePosts } from "@/hooks/use-google-posts";
import { PostList } from "./PostList";
import { PostCreateDialog } from "./PostCreateDialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

interface GooglePostsManagerProps {
    locationId?: string;
}

export function GooglePostsManager({ locationId }: GooglePostsManagerProps) {
    const { posts, loading, fetchPosts, createPost, deletePost } = useGooglePosts();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    useEffect(() => {
        if (locationId) {
            fetchPosts(locationId);
        }
    }, [locationId]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Postagens</h2>
                    <p className="text-muted-foreground">Gerencie as novidades, ofertas e eventos do seu perfil.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Postagem
                </Button>
            </div>

            {loading && posts.length === 0 ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <PostList posts={posts} onDelete={deletePost} />
            )}

            <PostCreateDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSubmit={createPost}
            />
        </div>
    );
}
