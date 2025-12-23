import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Monitor, Smartphone, Download, ExternalLink, RefreshCw } from "lucide-react";
import type { SiteData } from "./types";
import { renderSiteHTML, downloadHTML } from "@/lib/site-templates/renderer";

interface SitePreviewProps {
  site: SiteData;
  onRefresh?: () => void;
}

export function SitePreview({ site, onRefresh }: SitePreviewProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [key, setKey] = useState(0);
  
  const html = renderSiteHTML(site);
  const blob = new Blob([html], { type: 'text/html' });
  const previewUrl = URL.createObjectURL(blob);
  
  const handleDownload = () => {
    const filename = site.slug || site.company_name.toLowerCase().replace(/\s+/g, '-');
    downloadHTML(html, filename);
  };
  
  const handleRefresh = () => {
    setKey(prev => prev + 1);
    onRefresh?.();
  };

  return (
    <Card className="flex flex-col min-h-[700px]">
      <div className="flex items-center justify-between gap-2 p-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'desktop' | 'mobile')}>
            <TabsList className="h-8">
              <TabsTrigger value="desktop" className="px-3 py-1" data-testid="button-preview-desktop">
                <Monitor className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="mobile" className="px-3 py-1" data-testid="button-preview-mobile">
                <Smartphone className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            data-testid="button-preview-refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            data-testid="button-download-html"
          >
            <Download className="h-4 w-4 mr-1" />
            Baixar HTML
          </Button>
          
          {site.netlify_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(site.netlify_url!, '_blank')}
              data-testid="button-open-site"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Abrir Site
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex-1 bg-muted/30 p-4 flex items-center justify-center overflow-auto">
        <div
          className={`bg-white rounded-lg shadow-lg transition-all duration-300 overflow-hidden ${
            viewMode === 'mobile' 
              ? 'w-[375px] h-[667px]' 
              : 'w-full max-w-[1200px] h-[600px]'
          }`}
        >
          <iframe
            key={key}
            src={previewUrl}
            className="w-full h-full border-0"
            title="Preview do Site"
            sandbox="allow-scripts"
            data-testid="iframe-site-preview"
          />
        </div>
      </div>
      
      <div className="p-3 border-t bg-muted/20 flex-shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          {site.slug}.eleveaone.com.br
          {site.status === 'published' && (
            <span className="ml-2 text-green-600">Publicado</span>
          )}
          {site.status === 'generating' && (
            <span className="ml-2 text-yellow-600">Gerando...</span>
          )}
          {site.status === 'draft' && (
            <span className="ml-2 text-muted-foreground">Rascunho</span>
          )}
        </p>
      </div>
    </Card>
  );
}
