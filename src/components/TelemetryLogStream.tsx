import React, { useState, useEffect } from 'react';

const LOG_MESSAGES = [
  { tag: 'CORE', text: 'DOSBox-Staging 0.82.0 macOS native pipeline mapped', color: '#00ff77' },
  { tag: 'AUDIO', text: 'Roland MT-32 CoreAudio MIDI endpoint initialized (44.1 kHz PCM)', color: '#00e5ff' },
  { tag: 'MEDIA', text: 'Drive Bay verified ISO 9660 & CUE/BIN multi-track support', color: '#ffaa00' },
  { tag: 'MEM', text: 'DPMI 32-bit Protected Mode Memory Pool: 64 MB allocated', color: '#00ff77' },
  { tag: 'VAULT', text: 'Save Vault sandbox snapshot daemon running (0 collisions)', color: '#00e5ff' },
  { tag: 'GPU', text: 'VESA 2.0 Linear Framebuffer hardware acceleration active', color: '#ff3b5c' },
];

export const TelemetryLogStream: React.FC = () => {
  const [currentIdx, setCurrentIdx] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % LOG_MESSAGES.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const msg = LOG_MESSAGES[currentIdx];

  return (
    <div className="telemetry-log-stream win-inset">
      <div className="log-tag" style={{ color: msg.color, borderColor: msg.color }}>
        [{msg.tag}]
      </div>
      <div className="log-text">
        {msg.text}
      </div>
      <div className="log-blinker">_</div>
    </div>
  );
};
