import React from 'react';
import { CoinBlock, TOTAL_WORLD_WIDTH } from '../hooks/usePlatformerGame';

interface ParallaxBackgroundProps {
  worldOffset: number;
  coinBlocks: CoinBlock[];
}

export const ParallaxBackground: React.FC<ParallaxBackgroundProps> = ({
  worldOffset,
  coinBlocks,
}) => {
  // Parallax translation amounts
  const layer0Offset = -worldOffset * 0.05; // Stars
  const layer1Offset = -worldOffset * 0.18; // Mountains
  const layer2Offset = -worldOffset * 0.45; // DOS Landmarks
  const trackOffset = -worldOffset;        // Main track (1.0x)

  return (
    <div className="parallax-viewport">
      {/* LAYER 0: Starfield & Demoscene Nebula */}
      <div
        className="parallax-layer layer-0"
        style={{ transform: `translate3d(${layer0Offset}px, 0, 0)` }}
      >
        <div className="stars-grid"></div>
        <div className="retro-moon">
          <div className="moon-rings"></div>
          <span className="moon-text">GAMESKY.SPACE</span>
        </div>
      </div>

      {/* LAYER 1: Pixel Mountain Skyline & CRT Towers */}
      <div
        className="parallax-layer layer-1"
        style={{ transform: `translate3d(${layer1Offset}px, 0, 0)` }}
      >
        <svg className="mountains-svg" viewBox="0 0 3000 200" preserveAspectRatio="none">
          <polygon points="0,200 150,80 300,160 500,40 700,180 900,60 1100,150 1350,30 1600,170 1900,70 2200,140 2500,45 2800,160 3000,200" fill="#000033" opacity="0.85" />
          <polygon points="50,200 250,110 450,180 650,85 850,175 1050,90 1250,180 1500,65 1750,180 2050,95 2350,165 2650,80 2950,190 3000,200" fill="#000055" opacity="0.75" />
        </svg>
      </div>

      {/* LAYER 2: Iconic 90s DOS Landmarks */}
      <div
        className="parallax-layer layer-2"
        style={{ transform: `translate3d(${layer2Offset}px, 0, 0)` }}
      >
        {/* Dune II Spice Harvester Landmark */}
        <div className="landmark landmark-dune" style={{ left: '1200px' }}>
          <div className="landmark-badge">ARRAKIS SECTOR C:</div>
          <div className="harvester-art">🚜 DUNE II HARVESTER</div>
        </div>

        {/* Wolfenstein 3D Castle Keep */}
        <div className="landmark landmark-wolf" style={{ left: '3200px' }}>
          <div className="landmark-badge">CASTLE HOLLEHAMMER</div>
          <div className="castle-art">🏰 WOLFENSTEIN 3D</div>
        </div>

        {/* Warcraft II Orc Watchtower */}
        <div className="landmark landmark-warcraft" style={{ left: '5200px' }}>
          <div className="landmark-badge">TIDES OF DARKNESS</div>
          <div className="tower-art">⚔️ WARCRAFT II RIG</div>
        </div>

        {/* Monkey Island 2 Scumm Bar */}
        <div className="landmark landmark-monkey" style={{ left: '7200px' }}>
          <div className="landmark-badge">WOODTICK PIRATE BAY</div>
          <div className="ship-art">🏴‍☠️ MONKEY ISLAND 2</div>
        </div>
      </div>

      {/* LAYER 3: Main Platform Track & Coin Blocks */}
      <div
        className="parallax-layer layer-track"
        style={{
          width: `${TOTAL_WORLD_WIDTH}px`,
          transform: `translate3d(${trackOffset}px, 0, 0)`,
        }}
      >
        {/* Floating Coin Blocks [?] */}
        {coinBlocks.map((block) => (
          <div
            key={block.id}
            className={`coin-block ${block.collected ? 'collected' : 'active'}`}
            style={{
              left: `${block.worldX}px`,
              bottom: `${block.worldY}px`,
            }}
          >
            <div className="block-box">
              {block.collected ? '—' : block.label || '?'}
            </div>
            {block.collected && <div className="coin-sparkle">+100</div>}
          </div>
        ))}

        {/* Ground Platform Tiles */}
        <div className="ground-track">
          <div className="ground-top-grass"></div>
          <div className="ground-subsoil">
            <span className="ground-pattern">░▒▓█░▒▓█░▒▓█░▒▓█░▒▓█░▒▓█░▒▓█░▒▓█░▒▓█░▒▓█░▒▓█░▒▓█</span>
          </div>
        </div>
      </div>
    </div>
  );
};
