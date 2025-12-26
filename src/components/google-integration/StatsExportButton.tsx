import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { GoogleReview } from "@/hooks/use-google-reviews";

interface StatsExportButtonProps {
  stats: {
    totalReviews: number;
    averageRating: number;
    ratingDistribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    responseRate: number;
    repliedReviews: number;
    period: string;
  } | null;
  reviews: GoogleReview[];
  period: string;
}

export function StatsExportButton({
  stats,
  reviews,
  period,
}: StatsExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const exportToPDF = async () => {
    if (!stats) {
      toast.error("Nenhuma estatística disponível para exportar");
      return;
    }

    setExporting(true);
    try {
      // Lazy load jsPDF
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Título
      doc.setFontSize(18);
      doc.text("Relatório de Estatísticas - Google My Business", pageWidth / 2, yPosition, {
        align: "center",
      });
      yPosition += 10;

      // Período
      doc.setFontSize(12);
      const periodLabel =
        period === "7d"
          ? "Últimos 7 dias"
          : period === "30d"
          ? "Últimos 30 dias"
          : period === "90d"
          ? "Últimos 90 dias"
          : "Último ano";
      doc.text(`Período: ${periodLabel}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      // Estatísticas principais
      doc.setFontSize(14);
      doc.text("Estatísticas Principais", 14, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      const statsData = [
        ["Métrica", "Valor"],
        ["Total de Reviews", stats.totalReviews.toString()],
        ["Avaliação Média", stats.averageRating.toFixed(2)],
        ["Taxa de Resposta", `${stats.responseRate.toFixed(1)}%`],
        ["Reviews Respondidas", `${stats.repliedReviews} de ${stats.totalReviews}`],
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [statsData[0]],
        body: statsData.slice(1),
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;

      // Distribuição de ratings
      doc.setFontSize(14);
      doc.text("Distribuição de Ratings", 14, yPosition);
      yPosition += 8;

      const distributionData = [
        ["Rating", "Quantidade"],
        ["5 estrelas", stats.ratingDistribution[5].toString()],
        ["4 estrelas", stats.ratingDistribution[4].toString()],
        ["3 estrelas", stats.ratingDistribution[3].toString()],
        ["2 estrelas", stats.ratingDistribution[2].toString()],
        ["1 estrela", stats.ratingDistribution[1].toString()],
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [distributionData[0]],
        body: distributionData.slice(1),
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129] },
      });

      // Data de geração
      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(8);
      doc.text(
        `Relatório gerado em: ${dateStr}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );

      // Salvar PDF
      const fileName = `google_reviews_stats_${period}_${now.toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);

      toast.success("Relatório exportado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar relatório PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportToPDF}
      disabled={!stats || exporting}
    >
      {exporting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Exportando...
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          Exportar PDF
        </>
      )}
    </Button>
  );
}

