import { useState } from "react";
import { Bell, Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { GoogleReview } from "@/hooks/use-google-reviews";
import { NotificationSettingsDialog } from "./notifications/NotificationSettingsDialog";

interface GoogleNotificationsProps {
    unreadCount: number;
    reviews: GoogleReview[];
    onMarkAllAsRead: () => void;
    onMarkAsRead: (reviewId: string) => void;
}

export function GoogleNotifications({
    unreadCount,
    reviews,
    onMarkAllAsRead,
    onMarkAsRead,
}: GoogleNotificationsProps) {
    const [open, setOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const unreadReviews = reviews.filter((r) => !r.is_read);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full p-0 text-xs"
                        >
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold">Notificações</h4>
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setIsSettingsOpen(true)}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                        <NotificationSettingsDialog
                            open={isSettingsOpen}
                            onOpenChange={setIsSettingsOpen}
                        />

                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-auto p-1"
                                onClick={onMarkAllAsRead}
                            >
                                <Check className="h-3 w-3 mr-1" />
                                Marcar tudo como lido
                            </Button>
                        )}
                    </div>
                </div>
                <ScrollArea className="h-[300px]">
                    {unreadReviews.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                            <Bell className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">Nenhuma notificação nova</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {unreadReviews.map((review) => (
                                <div
                                    key={review.review_id_external}
                                    className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                                    onClick={() => onMarkAsRead(review.review_id_external)}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-sm line-clamp-1">
                                            {review.author_name || "Anônimo"}
                                        </span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                            {review.review_date &&
                                                formatDistanceToNow(new Date(review.review_date), {
                                                    addSuffix: true,
                                                    locale: ptBR,
                                                })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 mb-1">
                                        <span className="text-xs font-medium text-yellow-600">
                                            {review.rating} ★
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {review.comment || "Sem comentário"}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
