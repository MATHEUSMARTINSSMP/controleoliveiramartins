import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: "page" | "section" | "component";
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary] Captured error:", error);
      console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = "section", showDetails = false } = this.props;

      if (level === "component") {
        return <ComponentErrorFallback onRetry={this.handleRetry} />;
      }

      if (level === "section") {
        return (
          <SectionErrorFallback
            onRetry={this.handleRetry}
            error={showDetails ? this.state.error : null}
          />
        );
      }

      return (
        <PageErrorFallback
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
          error={showDetails ? this.state.error : null}
        />
      );
    }

    return this.props.children;
  }
}

interface FallbackProps {
  onRetry: () => void;
  error?: Error | null;
}

function ComponentErrorFallback({ onRetry }: FallbackProps) {
  return (
    <div className="flex items-center justify-center p-4 rounded-lg bg-destructive/5 border border-destructive/20">
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <span>Erro ao carregar</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="h-6 px-2 text-xs"
          data-testid="button-retry-component"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function SectionErrorFallback({ onRetry, error }: FallbackProps) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-destructive">Erro ao carregar seção</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Não foi possível carregar este conteúdo
          </p>
          {error && import.meta.env.DEV && (
            <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted p-2 rounded max-w-md overflow-auto">
              {error.message}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={onRetry}
          className="gap-2"
          data-testid="button-retry-section"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  );
}

interface PageFallbackProps extends FallbackProps {
  onGoHome: () => void;
}

function PageErrorFallback({ onRetry, onGoHome, error }: PageFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <Card className="max-w-md w-full border-destructive/20">
        <CardHeader className="text-center">
          <div className="mx-auto rounded-full bg-destructive/10 p-4 w-fit mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-destructive">Algo deu errado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            Ocorreu um erro inesperado. Por favor, tente novamente ou volte para a página inicial.
          </p>
          {error && import.meta.env.DEV && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs font-mono text-muted-foreground break-all">
                {error.message}
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={onGoHome}
              className="gap-2"
              data-testid="button-go-home"
            >
              <Home className="h-4 w-4" />
              Página inicial
            </Button>
            <Button
              onClick={onRetry}
              className="gap-2"
              data-testid="button-retry-page"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, "children">
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";

  const WithErrorBoundary = (props: P) => (
    <ErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WithErrorBoundary;
}
