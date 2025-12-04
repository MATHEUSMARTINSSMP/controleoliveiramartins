import { lazy, Suspense, ComponentType } from "react";
import { Skeleton } from "@/components/ui/skeleton-loaders";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const LazyAreaChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.AreaChart }))
);
const LazyBarChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.BarChart }))
);
const LazyLineChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.LineChart }))
);
const LazyPieChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.PieChart }))
);
const LazyResponsiveContainer = lazy(() =>
  import("recharts").then((m) => ({ default: m.ResponsiveContainer }))
);

export {
  LazyAreaChart as AreaChart,
  LazyBarChart as BarChart,
  LazyLineChart as LineChart,
  LazyPieChart as PieChart,
  LazyResponsiveContainer as ResponsiveContainer,
};

export const Area = lazy(() =>
  import("recharts").then((m) => ({ default: m.Area }))
);
export const Bar = lazy(() =>
  import("recharts").then((m) => ({ default: m.Bar }))
);
export const Line = lazy(() =>
  import("recharts").then((m) => ({ default: m.Line }))
);
export const Pie = lazy(() =>
  import("recharts").then((m) => ({ default: m.Pie }))
);
export const Cell = lazy(() =>
  import("recharts").then((m) => ({ default: m.Cell }))
);
export const XAxis = lazy(() =>
  import("recharts").then((m) => ({ default: m.XAxis }))
);
export const YAxis = lazy(() =>
  import("recharts").then((m) => ({ default: m.YAxis }))
);
export const CartesianGrid = lazy(() =>
  import("recharts").then((m) => ({ default: m.CartesianGrid }))
);
export const Tooltip = lazy(() =>
  import("recharts").then((m) => ({ default: m.Tooltip }))
);
export const Legend = lazy(() =>
  import("recharts").then((m) => ({ default: m.Legend }))
);

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-lg bg-muted/30 flex items-end gap-1 p-4"
      style={{ height }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-t animate-pulse"
          style={{
            height: `${Math.random() * 60 + 20}%`,
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}

interface ChartWrapperProps {
  children: React.ReactNode;
  height?: number;
  className?: string;
}

export function ChartWrapper({ children, height = 300, className }: ChartWrapperProps) {
  return (
    <ErrorBoundary level="component">
      <Suspense fallback={<ChartSkeleton height={height} />}>
        <div className={className}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

export function withChartSuspense<P extends object>(
  ChartComponent: ComponentType<P>,
  height = 300
) {
  const displayName = ChartComponent.displayName || ChartComponent.name || "Chart";

  const WithSuspense = (props: P) => (
    <ErrorBoundary level="component">
      <Suspense fallback={<ChartSkeleton height={height} />}>
        <ChartComponent {...props} />
      </Suspense>
    </ErrorBoundary>
  );

  WithSuspense.displayName = `withChartSuspense(${displayName})`;
  return WithSuspense;
}
