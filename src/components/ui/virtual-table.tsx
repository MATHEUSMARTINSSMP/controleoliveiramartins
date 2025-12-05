/**
 * Virtual Table Component
 * Efficient rendering for large datasets using virtualization
 */

import { useRef, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton-loaders";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  sortable?: boolean;
  render?: (item: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
}

interface VirtualTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  containerHeight?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  emptyMessage?: string;
  isLoading?: boolean;
  onRowClick?: (item: T, index: number) => void;
  getRowKey: (item: T, index: number) => string;
  className?: string;
}

type SortDirection = "asc" | "desc" | null;

export function VirtualTable<T>({
  data,
  columns,
  rowHeight = 52,
  containerHeight = 400,
  searchable = false,
  searchPlaceholder = "Buscar...",
  searchKeys = [],
  emptyMessage = "Nenhum registro encontrado",
  isLoading = false,
  onRowClick,
  getRowKey,
  className,
}: VirtualTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const filteredData = useMemo(() => {
    let result = [...data];

    if (searchQuery && searchKeys.length > 0) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        searchKeys.some((key) => {
          const value = item[key];
          return value && String(value).toLowerCase().includes(query);
        })
      );
    }

    if (sortColumn && sortDirection) {
      result.sort((a, b) => {
        const aValue = (a as Record<string, unknown>)[sortColumn];
        const bValue = (b as Record<string, unknown>)[sortColumn];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const comparison = aValue < bValue ? -1 : 1;
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchQuery, searchKeys, sortColumn, sortDirection]);

  const visibleRowCount = Math.ceil(containerHeight / rowHeight) + 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 1);
  const endIndex = Math.min(filteredData.length, startIndex + visibleRowCount);
  const visibleData = filteredData.slice(startIndex, endIndex);

  const totalHeight = filteredData.length * rowHeight;
  const offsetY = startIndex * rowHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />;
    }
    if (sortDirection === "asc") {
      return <ChevronUp className="h-4 w-4" />;
    }
    return <ChevronDown className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className={cn("rounded-lg border overflow-hidden", className)}>
        <div className="bg-muted/30 p-3 border-b">
          <div className="flex gap-4">
            {columns.map((col, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3 flex gap-4">
              {columns.map((_, j) => (
                <Skeleton key={j} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-table-search"
          />
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  style={{ width: column.width }}
                  className={cn(
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right"
                  )}
                >
                  {column.sortable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 gap-1"
                      onClick={() => handleSort(String(column.key))}
                      data-testid={`button-sort-${String(column.key)}`}
                    >
                      {column.header}
                      {getSortIcon(String(column.key))}
                    </Button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>

        <div
          ref={containerRef}
          className="overflow-auto"
          style={{ height: containerHeight }}
          onScroll={handleScroll}
        >
          <div style={{ height: totalHeight, position: "relative" }}>
            <Table>
              <TableBody
                style={{
                  transform: `translateY(${offsetY}px)`,
                  position: "absolute",
                  width: "100%",
                }}
              >
                {visibleData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleData.map((item, i) => {
                    const actualIndex = startIndex + i;
                    return (
                      <TableRow
                        key={getRowKey(item, actualIndex)}
                        className={cn(onRowClick && "cursor-pointer hover-elevate")}
                        onClick={() => onRowClick?.(item, actualIndex)}
                        style={{ height: rowHeight, maxHeight: rowHeight, minHeight: rowHeight }}
                        data-testid={`row-${getRowKey(item, actualIndex)}`}
                      >
                        {columns.map((column) => (
                          <TableCell
                            key={String(column.key)}
                            style={{ 
                              width: column.width,
                              maxHeight: rowHeight - 16,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            className={cn(
                              column.align === "center" && "text-center",
                              column.align === "right" && "text-right"
                            )}
                          >
                            {column.render
                              ? column.render(item, actualIndex)
                              : String((item as Record<string, unknown>)[String(column.key)] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground text-right">
        {filteredData.length} registro{filteredData.length !== 1 ? "s" : ""}
        {searchQuery && ` (filtrado de ${data.length})`}
      </div>
    </div>
  );
}
