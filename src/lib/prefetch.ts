/**
 * Prefetch System
 * 
 * Sistema de pré-carregamento inteligente para melhorar UX,
 * carregando recursos antecipadamente quando o usuário interage.
 */

type RouteModuleImporter = () => Promise<unknown>;

const routeModules: Record<string, RouteModuleImporter> = {
  "/admin": () => import("../pages/AdminDashboard"),
  "/loja": () => import("../pages/LojaDashboard"),
  "/me": () => import("../pages/ColaboradoraDashboard"),
  "/admin/relatorios": () => import("../pages/Relatorios"),
  "/admin/colaboradores": () => import("../pages/Colaboradores"),
  "/admin/lancamentos": () => import("../pages/Lancamentos"),
  "/erp/dashboard": () => import("../pages/erp/ERPDashboard"),
  "/erp/category-reports": () => import("../pages/erp/CategoryReports"),
  "/erp/product-intelligence": () => import("../pages/erp/ProductSalesIntelligence"),
  "/erp/customer-intelligence": () => import("../pages/erp/CustomerIntelligence"),
};

const prefetchedRoutes = new Set<string>();

export function prefetchRoute(route: string): void {
  if (prefetchedRoutes.has(route)) return;
  
  const importer = routeModules[route];
  if (importer) {
    prefetchedRoutes.add(route);
    importer().catch(() => {
      prefetchedRoutes.delete(route);
    });
  }
}

export function prefetchOnHover(route: string): { onMouseEnter: () => void; onFocus: () => void } {
  return {
    onMouseEnter: () => prefetchRoute(route),
    onFocus: () => prefetchRoute(route),
  };
}

export function prefetchRelatedRoutes(currentRoute: string): void {
  const relatedRoutes: Record<string, string[]> = {
    "/admin": ["/admin/relatorios", "/admin/colaboradores", "/admin/lancamentos"],
    "/loja": ["/admin"],
    "/me": ["/solicitar-adiantamento"],
    "/erp/dashboard": ["/erp/category-reports", "/erp/product-intelligence"],
  };

  const routes = relatedRoutes[currentRoute];
  if (routes) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => {
        routes.forEach(prefetchRoute);
      });
    } else {
      setTimeout(() => {
        routes.forEach(prefetchRoute);
      }, 1000);
    }
  }
}

export function createPrefetchLink(route: string) {
  return {
    href: route,
    ...prefetchOnHover(route),
  };
}

let exportModulesPreloaded = false;

export function preloadExportModulesOnce(): void {
  if (exportModulesPreloaded) return;
  exportModulesPreloaded = true;

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(
      () => {
        import("../lib/lazy-imports").then(({ preloadExportModules }) => {
          preloadExportModules();
        });
      },
      { timeout: 5000 }
    );
  }
}

export function useRoutePrefetch(currentRoute: string): void {
  if (typeof window === "undefined") return;

  if (
    currentRoute.startsWith("/admin") ||
    currentRoute.startsWith("/loja") ||
    currentRoute.startsWith("/erp")
  ) {
    preloadExportModulesOnce();
  }

  prefetchRelatedRoutes(currentRoute);
}
