import React from 'react';
import { retroAudio } from '../audio/retroSynth';

export interface SwitchboardState {
  coreAudioBridge: boolean;
  cyclesGovernor: boolean;
  saveVaultSandbox: boolean;
  vesaLfb: boolean;
}

interface SwitchboardProps {
  state: SwitchboardState;
  onChange: (key: keyof SwitchboardState, val: boolean) => void;
}

export const Switchboard: React.FC<SwitchboardProps> = ({ state, onChange }) => {
  const toggle = (key: keyof SwitchboardState) => {
    const nextVal = !state[key];
    retroAudio.playSwitchClick(nextVal);
    onChange(key, nextVal);
  };

  return (
    <div className="switchboard-container">
      <div className="switchboard-title">
        <span>🎚️ HARDWARE EMULATION TOGGLE RACK</span>
        <span className="rack-live-badge">HOT-SWAP READY</span>
      </div>

      <div className="switch-grid">
        {/* Switch 1 */}
        <div className={`switch-unit ${state.coreAudioBridge ? 'unit-on' : ''}`} onClick={() => toggle('coreAudioBridge')}>
          <div className="switch-led"></div>
          <div className="switch-text-group">
            <div className="switch-label">macOS CoreAudio MIDI Bridge</div>
            <div className="switch-sub">Roland MT-32 &amp; General MIDI</div>
          </div>
          <div className="rocker-lever">
            <span>{state.coreAudioBridge ? 'ON' : 'OFF'}</span>
          </div>
        </div>

        {/* Switch 2 */}
        <div className={`switch-unit ${state.cyclesGovernor ? 'unit-on' : ''}`} onClick={() => toggle('cyclesGovernor')}>
          <div className="switch-led"></div>
          <div className="switch-text-group">
            <div className="switch-label">Dynamic CPU Cycle Governor</div>
            <div className="switch-sub">Auto-throttle to prevent speed bugs</div>
          </div>
          <div className="rocker-lever">
            <span>{state.cyclesGovernor ? 'ON' : 'OFF'}</span>
          </div>
        </div>

        {/* Switch 3 */}
        <div className={`switch-unit ${state.saveVaultSandbox ? 'unit-on' : ''}`} onClick={() => toggle('saveVaultSandbox')}>
          <div className="switch-led"></div>
          <div className="switch-text-group">
            <div className="switch-label">Sandboxed Save Vault Time Machine</div>
            <div className="switch-sub">Zero-overwrite recursive snapshots</div>
          </div>
          <div className="rocker-lever">
            <span>{state.saveVaultSandbox ? 'ON' : 'OFF'}</span>
          </div>
        </div>

        {/* Switch 4 */}
        <div className={`switch-unit ${state.vesaLfb ? 'unit-on' : ''}`} onClick={() => toggle('vesaLfb')}>
          <div className="switch-led"></div>
          <div className="switch-text-group">
            <div className="switch-label">VESA 2.0 Linear Framebuffer (LFB)</div>
            <div className="switch-sub">640×480 &amp; 800×600 SVGA acceleration</div>
          </div>
          <div className="rocker-lever">
            <span>{state.vesaLfb ? 'ON' : 'OFF'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
