import React from 'react';
import { retroAudio } from '../audio/retroSynth';

export type CpuSpeedStep = '4.77' | '33' | '66' | '120' | '200';

interface CpuTachometerProps {
  currentSpeed: CpuSpeedStep;
  onSpeedChange: (speed: CpuSpeedStep) => void;
}

const SPEED_CONFIG: Record<CpuSpeedStep, { angle: number; label: string; sub: string; color: string }> = {
  '4.77': { angle: -120, label: '4.77 MHz', sub: '8086 Real Mode', color: '#00e5ff' },
  '33': { angle: -60, label: '33 MHz', sub: '386 DX Classic', color: '#00ff77' },
  '66': { angle: 0, label: '66 MHz', sub: '486 DX2 Nominal', color: '#00ff77' },
  '120': { angle: 60, label: '120 MHz', sub: 'Pentium SVGA', color: '#ffaa00' },
  '200': { angle: 120, label: '200 MHz', sub: 'MMX Overdrive', color: '#ff3b5c' },
};

export const CpuTachometer: React.FC<CpuTachometerProps> = ({ currentSpeed, onSpeedChange }) => {
  const activeCfg = SPEED_CONFIG[currentSpeed];

  const handleSelect = (speed: CpuSpeedStep) => {
    onSpeedChange(speed);
    if (speed === '200') {
      retroAudio.playRolandFanfare();
    } else {
      retroAudio.playSwitchClick(true);
    }
  };

  return (
    <div className="cpu-tachometer-widget">
      <div className="tachometer-dial-frame">
        {/* SVG Dial Gauge */}
        <svg viewBox="0 0 200 130" className="tachometer-svg">
          {/* Outer Arc */}
          <path
            d="M 25 110 A 80 80 0 1 1 175 110"
            fill="none"
            stroke="rgba(0, 229, 255, 0.15)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Active Accent Arc */}
          <path
            d="M 25 110 A 80 80 0 0 1 100 20"
            fill="none"
            stroke="url(#tachGradient)"
            strokeWidth="8"
            strokeLinecap="round"
          />

          <defs>
            <linearGradient id="tachGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00e5ff" />
              <stop offset="50%" stopColor="#00ff77" />
              <stop offset="100%" stopColor="#ffaa00" />
            </linearGradient>
          </defs>

          {/* Tick Labels */}
          <text x="22" y="122" className="dial-tick-text">4.77</text>
          <text x="42" y="60" className="dial-tick-text">33</text>
          <text x="100" y="38" className="dial-tick-text" textAnchor="middle">66</text>
          <text x="158" y="60" className="dial-tick-text">120</text>
          <text x="178" y="122" className="dial-tick-text" textAnchor="end">200</text>

          {/* Needle Center Hub */}
          <circle cx="100" cy="110" r="10" fill="#11182c" stroke="#00e5ff" strokeWidth="2" />

          {/* Rotating Needle */}
          <g transform={`rotate(${activeCfg.angle}, 100, 110)`} style={{ transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <line x1="100" y1="110" x2="100" y2="35" stroke={activeCfg.color} strokeWidth="3" strokeLinecap="round" />
            <polygon points="98,35 102,35 100,28" fill={activeCfg.color} />
          </g>
        </svg>

        {/* Digital Readout */}
        <div className="tachometer-digital-readout">
          <span className="digital-mhz" style={{ color: activeCfg.color }}>{activeCfg.label}</span>
          <span className="digital-sub">{activeCfg.sub}</span>
        </div>
      </div>

      {/* Speed Selector Buttons */}
      <div className="tachometer-buttons-grid">
        {(Object.keys(SPEED_CONFIG) as CpuSpeedStep[]).map((step) => (
          <button
            key={step}
            className={`btn-speed-step ${currentSpeed === step ? 'speed-active' : ''}`}
            style={{
              borderColor: currentSpeed === step ? SPEED_CONFIG[step].color : undefined,
              color: currentSpeed === step ? '#ffffff' : undefined,
            }}
            onClick={() => handleSelect(step)}
          >
            {step}M
          </button>
        ))}
      </div>
    </div>
  );
};
