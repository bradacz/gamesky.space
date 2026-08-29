import React, { useState } from 'react';
import { retroAudio } from '../audio/retroSynth';

interface BandConfig {
  label: string;
  sub: string;
  defaultVal: number;
}

const BANDS: BandConfig[] = [
  { label: '60 Hz', sub: 'Sub-Bass', defaultVal: 2 },
  { label: '250 Hz', sub: 'Low Punch', defaultVal: 0 },
  { label: '1 kHz', sub: 'OPL3 Mid', defaultVal: 4 },
  { label: '4 kHz', sub: 'Presence', defaultVal: 2 },
  { label: '16 kHz', sub: 'High Air', defaultVal: -2 },
];

export const AudioEqualizer: React.FC = () => {
  const [gains, setGains] = useState<number[]>([2, 0, 4, 2, -2]);

  const handleGainChange = (index: number, val: number) => {
    const newGains = [...gains];
    newGains[index] = val;
    setGains(newGains);
    retroAudio.setEqBand(index, val);
  };

  const applyPreset = (presetGains: number[]) => {
    setGains(presetGains);
    presetGains.forEach((g, idx) => retroAudio.setEqBand(idx, g));
    retroAudio.playBlip();
  };

  return (
    <div className="audio-equalizer-deck">
      <div className="eq-deck-header">
        <div className="eq-title">
          <span>🎛️ SOUND BLASTER 16 MASTER DSP EQUALIZER</span>
        </div>
        <div className="eq-presets-group">
          <button
            className="btn-eq-preset"
            onClick={() => applyPreset([0, 0, 0, 0, 0])}
          >
            Flat
          </button>
          <button
            className="btn-eq-preset"
            onClick={() => applyPreset([3, 1, 6, 4, 0])}
          >
            OPL3 Clarity
          </button>
          <button
            className="btn-eq-preset"
            onClick={() => applyPreset([4, 2, 2, 5, 3])}
          >
            Roland Warmth
          </button>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="eq-sliders-grid">
        {BANDS.map((band, idx) => (
          <div key={band.label} className="eq-channel">
            <div className="channel-db-val">
              {gains[idx] > 0 ? `+${gains[idx]}` : gains[idx]} dB
            </div>
            <div className="channel-slider-track">
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={gains[idx]}
                onChange={(e) => handleGainChange(idx, parseInt(e.target.value, 10))}
                className="eq-vertical-range"
              />
            </div>
            <div className="channel-label">{band.label}</div>
            <div className="channel-sub">{band.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
