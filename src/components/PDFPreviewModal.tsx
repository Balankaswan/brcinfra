import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Printer,
  Download,
  FileText,
  Loader2,
} from 'lucide-react';

interface PDFPreviewModalProps {
  /** Blob URL of the generated PDF (e.g. from pdf.output('bloburl')) */
  blobUrl: string;
  /** Display title shown in the toolbar */
  title: string;
  /** Called when the user wants to download the PDF (triggers the original save fn) */
  onDownload: () => void;
  /** Called when the user closes the modal */
  onClose: () => void;
}

const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const ZOOM_DEFAULT = 1.0;

const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  blobUrl,
  title,
  onDownload,
  onClose,
}) => {
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Keyboard: Escape → close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const zoomIn = () => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  const fitWidth = () => setZoom(ZOOM_DEFAULT);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  // Click on dark backdrop → close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    /* Animated backdrop */
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{
        background: 'rgba(10, 10, 20, 0.82)',
        backdropFilter: 'blur(4px)',
        animation: 'brcFadeIn 0.18s ease',
      }}
    >
      <style>{`
        @keyframes brcFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes brcSlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* ── Sticky Toolbar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-700 shadow-xl z-10">
        {/* Left: doc icon + title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-sm truncate max-w-xs">{title}</span>
        </div>

        {/* Centre: zoom controls */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1">
          <button
            onClick={zoomOut}
            disabled={zoom <= ZOOM_MIN}
            title="Zoom Out"
            className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={fitWidth}
            title="Fit to Width (100%)"
            className="px-2 py-1 text-xs font-mono text-gray-200 hover:text-white hover:bg-gray-700 rounded transition-colors min-w-[46px] text-center"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= ZOOM_MAX}
            title="Zoom In"
            className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          <button
            onClick={fitWidth}
            title="Reset Zoom"
            className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            title="Print"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-200 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={onDownload}
            title="Download PDF"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── PDF Viewer Area ── */}
      <div
        className="flex-1 overflow-auto flex justify-center py-6 px-4"
        style={{ background: '#3a3a4a' }}
      >
        {/* Loading skeleton */}
        {!loaded && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            style={{ background: 'rgba(30,30,50,0.85)', zIndex: 20 }}
          >
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            <p className="text-gray-300 text-sm">Generating PDF preview…</p>
          </div>
        )}

        {/* PDF iframe */}
        <div
          style={{
            transformOrigin: 'top center',
            transform: `scale(${zoom})`,
            transition: 'transform 0.2s ease',
            animation: loaded ? 'brcSlideUp 0.22s ease' : 'none',
            width: '210mm',    // A4 portrait width
            minHeight: '297mm',
            boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
            borderRadius: 4,
            overflow: 'hidden',
            flexShrink: 0,
            background: '#fff',
          }}
        >
          <iframe
            ref={iframeRef}
            src={blobUrl}
            title="PDF Preview"
            onLoad={() => setLoaded(true)}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '297mm',
              border: 'none',
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewModal;
