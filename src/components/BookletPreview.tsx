import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  Download,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookletPreviewProps {
  htmlContent: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDownloadPDF: () => void;
  className?: string;
}

export function BookletPreview({ 
  htmlContent, 
  currentPage, 
  totalPages, 
  onPageChange, 
  onDownloadPDF,
  className 
}: BookletPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'print' | 'web'>('print');
  const previewRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const zoomLevels = [50, 75, 100, 125, 150, 200];

  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(zoom);
    if (currentIndex < zoomLevels.length - 1) {
      setZoom(zoomLevels[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(zoom);
    if (currentIndex > 0) {
      setZoom(zoomLevels[currentIndex - 1]);
    }
  };

  const handleFitToWidth = () => {
    setZoom(100);
  };

  const scrollToPage = (pageNumber: number) => {
    if (iframeRef.current?.contentDocument) {
      const page = iframeRef.current.contentDocument.querySelector(`[data-page="${pageNumber}"]`);
      if (page) {
        page.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        
        // Add page data attributes for navigation
        const pages = doc.querySelectorAll('.booklet-page');
        pages.forEach((page, index) => {
          page.setAttribute('data-page', (index + 1).toString());
        });
      }
    }
  }, [htmlContent]);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      {/* Preview Toolbar */}
      <div className="border-b bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewMode(previewMode === 'print' ? 'web' : 'print')}
              className="text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              {previewMode === 'print' ? 'Print' : 'Web'} Preview
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {/* Page Navigation */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <select 
              value={currentPage} 
              onChange={(e) => {
                const page = parseInt(e.target.value);
                onPageChange(page);
                scrollToPage(page);
              }}
              className="px-2 py-1 text-xs border rounded bg-background min-w-16"
            >
              {pageNumbers.map(num => (
                <option key={num} value={num}>Page {num}</option>
              ))}
            </select>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {/* Zoom Controls */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= zoomLevels[0]}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <select 
              value={zoom} 
              onChange={(e) => setZoom(parseInt(e.target.value))}
              className="px-2 py-1 text-xs border rounded bg-background min-w-16"
            >
              {zoomLevels.map(level => (
                <option key={level} value={level}>{level}%</option>
              ))}
            </select>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= zoomLevels[zoomLevels.length - 1]}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleFitToWidth}
              title="Fit to Width"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            {/* Fullscreen Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            {/* Download PDF */}
            <Button
              variant="default"
              size="sm"
              onClick={onDownloadPDF}
              className="ml-2"
            >
              <Download className="h-4 w-4 mr-1" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className={cn(
        "flex-1 relative",
        isFullscreen && "fixed inset-0 z-50 bg-background"
      )}>
        <ScrollArea className="h-full">
          <div className="p-4 flex justify-center">
            <div 
              className="bg-white shadow-xl rounded-lg overflow-hidden transition-transform duration-200"
              style={{ 
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                width: previewMode === 'print' ? '8.5in' : '100%',
                maxWidth: previewMode === 'print' ? '8.5in' : '800px'
              }}
            >
              <iframe
                ref={iframeRef}
                className="w-full border-0"
                style={{ 
                  height: previewMode === 'print' ? '11in' : '1200px',
                  minHeight: '800px'
                }}
                title="Booklet Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </ScrollArea>

        {/* Page Thumbnails Sidebar (when fullscreen) */}
        {isFullscreen && (
          <div className="absolute left-4 top-4 bottom-4 w-48 bg-background/95 backdrop-blur-sm border rounded-lg p-2">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {pageNumbers.map(num => (
                  <Button
                    key={num}
                    variant={currentPage === num ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      onPageChange(num);
                      scrollToPage(num);
                    }}
                    className="w-full justify-start text-xs"
                  >
                    Page {num}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </Card>
  );
}