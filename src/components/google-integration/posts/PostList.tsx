import { GooglePost } from "@/hooks/use-google-posts";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ExternalLink, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PostListProps {
    posts: GooglePost[];
    onDelete: (postName: string) => void;
}

import { memo } from "react";

export function PostList({ posts, onDelete }: PostListProps) {
    if (posts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/10 border-dashed">
                <div className="bg-background p-4 rounded-full mb-4 shadow-sm">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">Nenhuma postagem encontrada</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
                    Crie postagens para manter seus clientes informados sobre novidades, ofertas e eventos.
                </p>
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
                <PostCard key={post.name} post={post} onDelete={onDelete} />
            ))}
        </div>
    );
}

const PostCard = memo(function PostCard({ post, onDelete }: { post: GooglePost; onDelete: (name: string) => void }) {
    return (
        <Card className="flex flex-col">
            {post.media && post.media.length > 0 && (
                <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                    <img
                        src={post.media[0].googleUrl}
                        alt="Post media"
                        className="w-full h-full object-cover"
                    />
                </div>
            )}
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <Badge variant={post.state === "LIVE" ? "default" : "secondary"}>
                        {post.state === "LIVE" ? "Publicado" : post.state}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDistanceToNow(new Date(post.createTime), { addSuffix: true, locale: ptBR })}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="flex-1 py-2">
                <p className="text-sm line-clamp-4 whitespace-pre-wrap">{post.summary}</p>
            </CardContent>
            <CardFooter className="pt-2 border-t flex justify-between">
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(post.name)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                </Button>
                {post.callToAction && (
                    <Button variant="outline" size="sm" asChild>
                        <a href={post.callToAction.url} target="_blank" rel="noopener noreferrer">
                            {post.callToAction.actionType} <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
});
