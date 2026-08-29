import React, { useEffect, useRef } from 'react';

interface HexNode {
  x: number;
  y: number;
  hex: string;
  baseAlpha: number;
  alpha: number;
}

const SAMPLE_HEX = ['A220', '0388', 'E000', '0080', 'C800', '640K', 'IRQ7', 'DMA1', 'DX66', '386P', 'MT32', 'OPL3', '0x1F', '0x9C', '0xFF'];

export const HexMatrixBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = -9999;
    let mouseY = -9999;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initNodes();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    let nodes: HexNode[] = [];
    const spacing = 120;

    const initNodes = () => {
      nodes = [];
      const cols = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          nodes.push({
            x: c * spacing + (r % 2 === 0 ? 0 : spacing / 2) + 20,
            y: r * spacing + 40,
            hex: SAMPLE_HEX[(r * cols + c) % SAMPLE_HEX.length],
            baseAlpha: 0.08,
            alpha: 0.08,
          });
        }
      }
    };

    initNodes();

    const render = () => {
      animId = requestAnimationFrame(render);
      ctx.clearRect(0, 0, width, height);

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const node of nodes) {
        const dx = mouseX - node.x;
        const dy = mouseY - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 160) {
          const targetAlpha = 0.5 * (1 - dist / 160) + node.baseAlpha;
          node.alpha += (targetAlpha - node.alpha) * 0.15;
        } else {
          node.alpha += (node.baseAlpha - node.alpha) * 0.05;
        }

        ctx.fillStyle = `rgba(0, 229, 255, ${node.alpha})`;
        ctx.fillText(node.hex, node.x, node.y);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="hex-matrix-canvas"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: -1,
      }}
    />
  );
};
