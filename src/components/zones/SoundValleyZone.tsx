import React, { useState } from 'react';
import { retroAudio } from '../../audio/retroSynth';

export const SoundValleyZone: React.FC = () => {
  const [activeChip, setActiveChip] = useState<string>('sb16');

  const testSound = (chip: string) => {
    setActiveChip(chip);
    if (chip === 'sb16') {
      retroAudio.playSoundBlasterJingle();
    } else if (chip === 'mt32') {
      retroAudio.playRolandFanfare();
    } else if (chip === 'pcspeaker') {
      retroAudio.playCoin();
    }
  };

  return (
    <div className="zone-container zone-sound" style={{ left: '3900px' }}>
      {/* Zone Signpost */}
      <div className="zone-signpost">
        <div className="signpost-top">SECTOR 03</div>
        <div className="signpost-title">SOUND BLASTER &amp; ROLAND CANYON</div>
      </div>

      <div className="sound-card-rig win-outset">
        <div className="sound-header">
          <span>🔊 AUDIOLAB: 90s DSP &amp; MIDI EMULATION</span>
          <span className="card-badge">SET BLASTER=A220 I7 D1 H5 T6</span>
        </div>

        <div className="sound-grid">
          {/* Sound Card 1: Sound Blaster 16 */}
          <div className={`sound-chip-card win-inset ${activeChip === 'sb16' ? 'chip-active' : ''}`}>
            <div className="chip-icon">🎛️</div>
            <div className="chip-name">Creative Sound Blaster 16</div>
            <div className="chip-desc">Klasická FM syntéza Yamaha OPL3 pro autentický zvuk her jako Doom, Wolfenstein a Dune II.</div>
            <button
              className="btn-synth-test"
              onClick={() => testSound('sb16')}
            >
              🎵 Test OPL3 FM Syntézy
            </button>
          </div>

          {/* Sound Card 2: Roland MT-32 */}
          <div className={`sound-chip-card win-inset ${activeChip === 'mt32' ? 'chip-active' : ''}`}>
            <div className="chip-icon">🎹</div>
            <div className="chip-name">Roland MT-32 &amp; General MIDI</div>
            <div className="chip-desc">Orchestrální MIDI syntéza přes nativní macOS CoreAudio. Skutečný luxus v Monkey Island 2 a Sierra adventurách.</div>
            <button
              className="btn-synth-test"
              onClick={() => testSound('mt32')}
            >
              🎺 Test Roland MIDI Fanfáry
            </button>
          </div>

          {/* Sound Card 3: Gravis UltraSound & PC Speaker */}
          <div className={`sound-chip-card win-inset ${activeChip === 'pcspeaker' ? 'chip-active' : ''}`}>
            <div className="chip-icon">📢</div>
            <div className="chip-name">Gravis UltraSound &amp; PC Speaker</div>
            <div className="chip-desc">Legendární wavetable GUS pro trackerovou demoscene hudbu i nostalgické 1-bitové pípání PC Speakeru.</div>
            <button
              className="btn-synth-test"
              onClick={() => testSound('pcspeaker')}
            >
              🔔 Test 8-Bit Beeperu
            </button>
          </div>
        </div>

        {/* Oscilloscope Visualizer Bar */}
        <div className="oscilloscope-strip win-inset">
          <div className="osc-label">DSP SIGNAL ANALYZER:</div>
          <div className="osc-bars">
            <span className="bar bar-1"></span>
            <span className="bar bar-2"></span>
            <span className="bar bar-3"></span>
            <span className="bar bar-4"></span>
            <span className="bar bar-5"></span>
            <span className="bar bar-6"></span>
            <span className="bar bar-7"></span>
            <span className="bar bar-8"></span>
          </div>
          <div className="osc-status">STEREO 44.1 kHz / 16-BIT PCM</div>
        </div>
      </div>
    </div>
  );
};
