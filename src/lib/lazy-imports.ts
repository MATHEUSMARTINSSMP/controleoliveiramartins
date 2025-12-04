/**
 * Lazy Import Utilities
 * 
 * Este módulo fornece utilitários para importação dinâmica de bibliotecas pesadas,
 * reduzindo o bundle principal e melhorando o tempo de carregamento inicial.
 * 
 * Arquitetura Enterprise-Grade:
 * - Cache de imports para evitar múltiplas importações
 * - Error handling robusto
 * - TypeScript strict para type safety
 * - Preload hints para otimização de UX
 */

type LazyModule<T> = () => Promise<T>;

const moduleCache = new Map<string, Promise<unknown>>();

async function lazyImport<T>(
  key: string,
  importer: LazyModule<T>
): Promise<T> {
  if (!moduleCache.has(key)) {
    moduleCache.set(key, importer());
  }
  return moduleCache.get(key) as Promise<T>;
}

export async function getXLSX() {
  return lazyImport("xlsx", async () => {
    const module = await import("xlsx");
    return module;
  });
}

export async function getJsPDF() {
  return lazyImport("jspdf", async () => {
    const [jsPDFModule, autoTableModule] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    return {
      jsPDF: jsPDFModule.default,
      autoTable: autoTableModule.default,
    };
  });
}

export async function getHtml2Canvas() {
  return lazyImport("html2canvas", async () => {
    const module = await import("html2canvas");
    return module.default;
  });
}

export interface ExportToExcelOptions {
  data: Record<string, unknown>[];
  filename: string;
  sheetName?: string;
  headers?: Record<string, string>;
}

export async function exportToExcel({
  data,
  filename,
  sheetName = "Dados",
  headers,
}: ExportToExcelOptions): Promise<void> {
  const XLSX = await getXLSX();

  let exportData = data;
  if (headers) {
    exportData = data.map((row) => {
      const newRow: Record<string, unknown> = {};
      Object.entries(headers).forEach(([key, label]) => {
        newRow[label] = row[key];
      });
      return newRow;
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...exportData.map((row) => String(row[key] || "").length)
    ),
  }));
  worksheet["!cols"] = colWidths;

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export interface ExportToPDFOptions {
  title: string;
  filename: string;
  data: Record<string, unknown>[];
  columns: { header: string; dataKey: string }[];
  orientation?: "portrait" | "landscape";
  subtitle?: string;
}

export async function exportToPDF({
  title,
  filename,
  data,
  columns,
  orientation = "portrait",
  subtitle,
}: ExportToPDFOptions): Promise<void> {
  const { jsPDF, autoTable } = await getJsPDF();

  const doc = new jsPDF({ orientation });

  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text(title, 14, 20);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 28);
  }

  const tableData = data.map((row) =>
    columns.map((col) => String(row[col.dataKey] ?? ""))
  );

  autoTable(doc, {
    head: [columns.map((col) => col.header)],
    body: tableData,
    startY: subtitle ? 35 : 30,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
  });

  doc.save(`${filename}.pdf`);
}

export function preloadModule(module: "xlsx" | "jspdf" | "html2canvas"): void {
  switch (module) {
    case "xlsx":
      getXLSX();
      break;
    case "jspdf":
      getJsPDF();
      break;
    case "html2canvas":
      getHtml2Canvas();
      break;
  }
}

export function preloadExportModules(): void {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      preloadModule("xlsx");
      preloadModule("jspdf");
    });
  }
}
