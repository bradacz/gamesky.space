import React, { useState } from 'react';
import { retroAudio } from '../audio/retroSynth';
import { ZONES, TOTAL_WORLD_WIDTH } from '../hooks/usePlatformerGame';

interface RetroHUDProps {
  score: number;
  coinsCollected: number;
  turboMode: '33' | '66' | '100';
  setTurboMode: (mode: '33' | '66' | '100') => void;
  crtEnabled: boolean;
  setCrtEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  activeZone: number;
  worldOffset: number;
  onWarpToZone: (zoneIndex: number) => void;
  onJump: () => void;
}

export const RetroHUD: React.FC<RetroHUDProps> = ({
  score,
  coinsCollected,
  turboMode,
  setTurboMode,
  crtEnabled,
  setCrtEnabled,
  activeZone,
  worldOffset,
  onWarpToZone,
  onJump,
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [degaussActive, setDegaussActive] = useState<boolean>(false);

  const progressPercent = Math.min(100, Math.round((worldOffset / (TOTAL_WORLD_WIDTH - window.innerWidth)) * 100));

  const handleToggleSound = () => {
    const muted = retroAudio.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      retroAudio.playBlip();
    }
  };

  const handleDegauss = () => {
    retroAudio.playDegauss();
    setDegaussActive(true);
    setTimeout(() => setDegaussActive(false), 750);
  };

  return (
    <>
      {/* Degauss Flash Overlay */}
      {degaussActive && <div className="degauss-flash-fx" />}

      {/* TOP 90s GAME HUD */}
      <header className="retro-top-hud win-outset">
        <div className="hud-left">
          <div className="hud-badge brand-badge">
            <span className="brand-icon">GS</span>
            <strong>GAMESKY.SPACE</strong>
          </div>
          <div className="hud-metric">
            <span className="metric-label">LIVES:</span>
            <span className="metric-val lives-val">♥♥♥</span>
          </div>
          <div className="hud-metric">
            <span className="metric-label">SCORE:</span>
            <span className="metric-val">{score.toString().padStart(6, '0')}</span>
          </div>
          <div className="hud-metric">
            <span className="metric-label">TOKENS:</span>
            <span className="metric-val coins-val">🪙 x{coinsCollected}</span>
          </div>
        </div>

        {/* Center Progress Indicator */}
        <div className="hud-center">
          <span className="zone-name">{ZONES[activeZone]?.name || 'GAMESKY ODYSSEY'}</span>
          <div className="hud-progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <span className="progress-percent">{progressPercent}%</span>
        </div>

        {/* Right Controls */}
        <div className="hud-right">
          {/* Turbo Selector */}
          <div className="turbo-group">
            <span className="turbo-label">CPU:</span>
            <button
              className={`btn-retro-mini ${turboMode === '33' ? 'active' : ''}`}
              onClick={() => { setTurboMode('33'); retroAudio.playBlip(); }}
              title="33 MHz Normal"
            >
              33
            </button>
            <button
              className={`btn-retro-mini ${turboMode === '66' ? 'active' : ''}`}
              onClick={() => { setTurboMode('66'); retroAudio.playBlip(); }}
              title="66 MHz DX2"
            >
              66
            </button>
            <button
              className={`btn-retro-mini turbo-btn ${turboMode === '100' ? 'active' : ''}`}
              onClick={() => { setTurboMode('100'); retroAudio.playRolandFanfare(); }}
              title="100 MHz DX4 Overclock!"
            >
              ⚡100
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            className={`btn-retro-mini ${!isMuted ? 'active-audio' : ''}`}
            onClick={handleToggleSound}
            title="Toggle Sound Blaster Synthesizer"
          >
            {isMuted ? '🔇 MUTE' : '🎵 SB16'}
          </button>

          {/* CRT Filter Toggle */}
          <button
            className={`btn-retro-mini ${crtEnabled ? 'active-crt' : ''}`}
            onClick={() => { setCrtEnabled((c) => !c); retroAudio.playBlip(); }}
            title="Toggle CRT Scanline Shader"
          >
            📺 CRT
          </button>

          {/* Degauss Button */}
          <button
            className="btn-retro-mini degauss-btn"
            onClick={handleDegauss}
            title="Degauss CRT Monitor"
          >
            ⚡ DEGAUSS
          </button>
        </div>
      </header>

      {/* MOBILE TOUCH / JUMP BUTTON */}
      <div className="mobile-touch-bar">
        <button className="mobile-jump-btn" onClick={onJump}>
          ⬆ JUMP (SPACE)
        </button>
      </div>

      {/* BOTTOM NORTON COMMANDER HOTKEY BAR */}
      <footer className="norton-bottom-bar">
        {ZONES.map((zone, idx) => (
          <button
            key={zone.id}
            className={`norton-fkey-btn ${activeZone === idx ? 'fkey-active' : ''}`}
            onClick={() => onWarpToZone(idx)}
            title={`Warp to ${zone.name}`}
          >
            <span className="fkey-num">{zone.fKey}</span>
            <span className="fkey-text">{zone.name.split('\\>')[0]}</span>
          </button>
        ))}
      </footer>
    </>
  );
};
