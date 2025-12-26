import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { GoogleReview } from "@/hooks/use-google-reviews";

interface ReviewsExportPDFProps {
  reviews: GoogleReview[];
  disabled?: boolean;
}

export function ReviewsExportPDF({ reviews, disabled = false }: ReviewsExportPDFProps) {
  const [exporting, setExporting] = useState(false);

  const exportToPDF = async () => {
    if (reviews.length === 0) {
      toast.error("Nenhum review para exportar");
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
      doc.text("Relatório de Reviews - Google My Business", pageWidth / 2, yPosition, {
        align: "center",
      });
      yPosition += 10;

      // Informações do relatório
      doc.setFontSize(10);
      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.text(`Total de reviews: ${reviews.length}`, 14, yPosition);
      yPosition += 5;
      doc.text(`Data de geração: ${dateStr}`, 14, yPosition);
      yPosition += 15;

      // Preparar dados para tabela
      const tableData = reviews.map((review, index) => [
        (index + 1).toString(),
        review.author_name || "Anônimo",
        review.rating.toString() + " ⭐",
        review.comment?.substring(0, 100) + (review.comment && review.comment.length > 100 ? "..." : "") || "Sem comentário",
        review.review_date
          ? format(new Date(review.review_date), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : "N/A",
        review.reply ? "Sim" : "Não",
        review.is_read ? "Sim" : "Não",
      ]);

      // Tabela principal
      autoTable(doc, {
        startY: yPosition,
        head: [["#", "Autor", "Rating", "Comentário", "Data", "Respondida", "Lida"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 40 },
          2: { cellWidth: 25 },
          3: { cellWidth: 60 },
          4: { cellWidth: 35 },
          5: { cellWidth: 25 },
          6: { cellWidth: 20 },
        },
        margin: { left: 14, right: 14 },
      });

      // Rodapé
      // @ts-ignore
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      if (finalY < pageHeight - 20) {
        doc.setFontSize(8);
        doc.text(
          `Relatório gerado em: ${dateStr}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      // Salvar PDF
      const fileName = `google_reviews_${now.toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);

      toast.success("Reviews exportados em PDF com sucesso!");
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
      disabled={disabled || exporting || reviews.length === 0}
    >
      {exporting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Exportando...
        </>
      ) : (
        <>
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </>
      )}
    </Button>
  );
}


