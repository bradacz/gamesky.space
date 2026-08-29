import React, { useEffect, useRef } from 'react';
import { retroAudio } from '../audio/retroSynth';

interface VectorOscilloscopeProps {
  width?: number;
  height?: number;
  accentColor?: string;
}

export const VectorOscilloscope: React.FC<VectorOscilloscopeProps> = ({
  width = 240,
  height = 50,
  accentColor = '#00e5ff',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Buffer for time-domain waveform
    const dataArray = new Uint8Array(256);

    const render = () => {
      animId = requestAnimationFrame(render);
      const analyser = retroAudio.getAnalyser();

      ctx.clearRect(0, 0, width, height);

      // Subtle background grid lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (analyser) {
        analyser.getByteTimeDomainData(dataArray);
      } else {
        // Flat idle line if no audio context yet
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = 128;
        }
      }

      // Draw neon oscilloscope waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = accentColor;
      ctx.shadowBlur = 6;
      ctx.shadowColor = accentColor;
      ctx.beginPath();

      const sliceWidth = width / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [width, height, accentColor]);

  return (
    <div className="oscilloscope-widget" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};
