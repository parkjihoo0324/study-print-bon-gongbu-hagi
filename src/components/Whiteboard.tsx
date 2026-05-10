import React, { useRef, useEffect, useState } from 'react';
import { RotateCcw, Pen, RectangleHorizontal as Eraser } from 'lucide-react';

interface WhiteboardProps {
  isDark?: boolean;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({ isDark = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(isDark ? '#ffffff' : '#0f172a');
  const [lineWidth, setLineWidth] = useState(3);
  const [mode, setMode] = useState<'pen' | 'eraser'>('pen');

  // Handle color reset when theme changes
  useEffect(() => {
    if (mode === 'pen') {
      setColor(isDark ? '#10b981' : '#0f172a');
    }
  }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      
      const { width, height } = container.getBoundingClientRect();
      
      // Save current content
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      canvas.width = width;
      canvas.height = height;
      
      // Restore content and settings
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.drawImage(tempCanvas, 0, 0);
    };

    // Initial resize
    setTimeout(resizeCanvas, 0);
    
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Scale coordinates to match canvas internal resolution
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = mode === 'eraser' ? (isDark ? '#0f172a' : '#ffffff') : color;
    ctx.lineWidth = lineWidth;
    setIsDrawing(true);
    
    if ('touches' in e) e.preventDefault();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();
    
    if ('touches' in e) e.preventDefault();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-border overflow-hidden dark:bg-slate-900 dark:border-slate-800 transition-colors">
      <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 border-b border-border dark:bg-slate-800/50 dark:border-slate-700">
        <div className="flex items-center gap-1 border-r border-border pr-4 dark:border-slate-700">
          <button
            onClick={() => setMode('pen')}
            className={`p-2 rounded-lg transition-all ${mode === 'pen' ? 'bg-primary text-white shadow-md dark:bg-accent dark:text-primary' : 'hover:bg-slate-200 text-slate-500 dark:hover:bg-slate-700'}`}
          >
            <Pen size={14} />
          </button>
          <button
            onClick={() => setMode('eraser')}
            className={`p-2 rounded-lg transition-all ${mode === 'eraser' ? 'bg-primary text-white shadow-md dark:bg-accent dark:text-primary' : 'hover:bg-slate-200 text-slate-500 dark:hover:bg-slate-700'}`}
          >
            <Eraser size={14} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {[ isDark ? '#ffffff' : '#0f172a', '#10b981', '#3b82f6', '#ef4444', '#f59e0b' ].map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setMode('pen'); }}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c && mode === 'pen' ? (isDark ? 'border-accent' : 'border-primary') : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="h-4 w-[1px] bg-border dark:bg-slate-700 mx-2" />
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Size</span>
            <input
              type="range"
              min="1" max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary dark:accent-accent dark:bg-slate-700"
            />
          </div>
        </div>

        <div className="ml-auto">
          <button
            onClick={clearCanvas}
            className="text-[10px] uppercase font-bold tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 px-3 py-2 rounded-lg transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className={`flex-1 relative touch-none overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair block"
        />
      </div>
    </div>
  );
};

