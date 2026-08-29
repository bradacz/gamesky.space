import React, { useRef, useState, ReactNode } from 'react';

interface MagneticCardProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const MagneticCard: React.FC<MagneticCardProps> = ({
  children,
  className = '',
  maxTilt = 8,
  onClick,
  style = {},
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<string>('perspective(800px) rotateX(0deg) rotateY(0deg)');
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; opacity: number }>({ x: 0, y: 0, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;

    setTransform(`perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`);
    setSpotlight({ x, y, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setSpotlight((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      className={`magnetic-card-root ${className}`}
      style={{
        ...style,
        transform,
        transition: 'transform 0.1s ease-out',
        position: 'relative',
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Specular Spotlight Reflection */}
      <div
        className="specular-spotlight-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          pointerEvents: 'none',
          opacity: spotlight.opacity,
          background: `radial-gradient(400px circle at ${spotlight.x}px ${spotlight.y}px, rgba(0, 229, 255, 0.12), transparent 80%)`,
          transition: 'opacity 0.25s ease',
          zIndex: 10,
        }}
      />
      {children}
    </div>
  );
};
