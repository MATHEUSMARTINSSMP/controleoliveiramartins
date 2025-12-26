import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GoogleReview } from "@/hooks/use-google-reviews";
import { Star, Download, Share2, Palette } from "lucide-react";
import { toast } from "sonner";

interface ReviewCardGeneratorProps {
    review: GoogleReview;
}

export function ReviewCardGenerator({ review }: ReviewCardGeneratorProps) {
    const [bgColor, setBgColor] = useState("bg-white");
    const [textColor, setTextColor] = useState("text-black");
    const [showDate, setShowDate] = useState(true);
    const [showAuthor, setShowAuthor] = useState(true);
    const cardRef = useRef<HTMLDivElement>(null);

    const handleDownload = () => {
        // Em um cenário real, usaria html2canvas
        toast.success("Card baixado com sucesso! (Simulado)");
    };

    const renderStars = (rating: number) => {
        return Array.from({ length: 5 }).map((_, i) => (
            <Star
                key={i}
                className={`h-5 w-5 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
            />
        ));
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Share2 className="h-4 w-4 mr-2" />
                    Gerar Card
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Gerador de Card de Avaliação</DialogTitle>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-6 py-4">
                    {/* Controles */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Cor de Fundo</Label>
                            <div className="flex gap-2">
                                {["bg-white", "bg-slate-900", "bg-blue-50", "bg-purple-50", "bg-gradient-to-r from-blue-500 to-purple-500"].map((bg) => (
                                    <button
                                        key={bg}
                                        className={`w-8 h-8 rounded-full border ${bg} ${bgColor === bg ? "ring-2 ring-primary" : ""}`}
                                        onClick={() => {
                                            setBgColor(bg);
                                            setTextColor(bg.includes("slate-900") || bg.includes("gradient") ? "text-white" : "text-black");
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Opções de Exibição</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="showDate"
                                    checked={showDate}
                                    onChange={(e) => setShowDate(e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                <Label htmlFor="showDate">Mostrar Data</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="showAuthor"
                                    checked={showAuthor}
                                    onChange={(e) => setShowAuthor(e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                <Label htmlFor="showAuthor">Mostrar Autor</Label>
                            </div>
                        </div>
                        <Button onClick={handleDownload} className="w-full">
                            <Download className="h-4 w-4 mr-2" />
                            Baixar Imagem (PNG)
                        </Button>
                    </div>

                    {/* Preview */}
                    <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 p-6 rounded-lg">
                        <div
                            ref={cardRef}
                            className={`p-8 rounded-xl shadow-lg max-w-sm w-full transition-colors ${bgColor} ${textColor}`}
                        >
                            <div className="flex justify-center mb-4">
                                {renderStars(review.rating)}
                            </div>
                            <p className="text-center text-lg font-medium italic mb-6">
                                "{review.comment}"
                            </p>
                            <div className="flex flex-col items-center">
                                {showAuthor && (
                                    <span className="font-bold">{review.author_name}</span>
                                )}
                                {showDate && review.review_date && (
                                    <span className={`text-xs mt-1 opacity-70`}>
                                        {new Date(review.review_date).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                            <div className="mt-6 flex justify-center">
                                <div className="text-xs font-semibold opacity-50 uppercase tracking-widest">
                                    Google Review
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
