import React from 'react';

interface HeroSpriteProps {
  heroState: 'idle' | 'run-right' | 'run-left' | 'jump';
  heroY: number;
  turboMode: '33' | '66' | '100';
  godMode: boolean;
  onJump: () => void;
}

export const HeroSprite: React.FC<HeroSpriteProps> = ({
  heroState,
  heroY,
  turboMode,
  godMode,
  onJump,
}) => {
  const isFacingLeft = heroState === 'run-left';
  const isTurbo100 = turboMode === '100';

  return (
    <div
      className="hero-container"
      style={{
        transform: `translate3d(0, -${heroY}px, 0)`,
        bottom: '82px',
        left: '140px',
      }}
      onClick={onJump}
      title="Click or press SPACE to Jump & collect coins!"
    >
      {/* Ground Shadow */}
      <div
        className="hero-shadow"
        style={{
          transform: `scale(${Math.max(0.4, 1 - heroY / 150)})`,
          opacity: Math.max(0.2, 0.7 - heroY / 200),
        }}
      />

      {/* Turbo Particle Trail */}
      {isTurbo100 && (
        <div className="hero-turbo-trail">
          <span></span>
          <span></span>
        </div>
      )}

      {/* Hero Pixel Character */}
      <div
        className={`hero-pixel-body ${heroState} ${godMode ? 'god-mode-glow' : ''}`}
        style={{
          transform: isFacingLeft ? 'scaleX(-1)' : 'scaleX(1)',
        }}
      >
        {/* SVG Pixel Character: 90s DOS Explorer */}
        <svg
          width="48"
          height="54"
          viewBox="0 0 16 18"
          className="hero-svg"
          style={{ imageRendering: 'pixelated' }}
        >
          {/* Helmet Visor */}
          <rect x="5" y="1" width="6" height="5" fill="#00ffff" />
          <rect x="6" y="2" width="4" height="3" fill="#ffffff" />
          {/* Helmet Base */}
          <rect x="4" y="0" width="8" height="2" fill="#0000aa" />
          <rect x="3" y="2" width="2" height="4" fill="#0000aa" />
          <rect x="11" y="2" width="2" height="4" fill="#0000aa" />
          
          {/* Body Armor - Norton Blue & Gold */}
          <rect x="4" y="6" width="8" height="6" fill="#0000aa" />
          <rect x="6" y="7" width="4" height="3" fill="#ffff55" />
          
          {/* 3.5" Floppy Disk on Back (Backpack) */}
          <rect x="2" y="7" width="2" height="4" fill="#333333" />
          <rect x="2" y="8" width="1" height="2" fill="#aaaaaa" />

          {/* Arms */}
          <rect x="3" y="8" width="2" height="3" fill="#00aaaa" />
          <rect x="11" y="8" width="2" height="3" fill="#00aaaa" />

          {/* Legs / Feet */}
          {heroY > 0 ? (
            // Jump Frame
            <>
              <rect x="3" y="12" width="4" height="3" fill="#000055" />
              <rect x="9" y="13" width="4" height="3" fill="#000055" />
              <rect x="2" y="14" width="4" height="2" fill="#ffff55" />
              <rect x="10" y="15" width="4" height="2" fill="#ffff55" />
            </>
          ) : heroState !== 'idle' ? (
            // Running Frames
            <>
              <rect x="4" y="12" width="3" height="4" fill="#000055" className="leg-left-run" />
              <rect x="9" y="12" width="3" height="4" fill="#000055" className="leg-right-run" />
              <rect x="3" y="15" width="4" height="2" fill="#ffff55" />
              <rect x="9" y="15" width="4" height="2" fill="#ffff55" />
            </>
          ) : (
            // Idle Frame
            <>
              <rect x="4" y="12" width="3" height="4" fill="#000055" />
              <rect x="9" y="12" width="3" height="4" fill="#000055" />
              <rect x="3" y="15" width="4" height="2" fill="#ffff55" />
              <rect x="9" y="15" width="4" height="2" fill="#ffff55" />
            </>
          )}
        </svg>

        {/* Hovering Floppy Board in 100MHz Turbo Mode */}
        {isTurbo100 && (
          <div className="floppy-hoverboard">
            <span className="floppy-label">1.44M</span>
          </div>
        )}
      </div>
    </div>
  );
};
