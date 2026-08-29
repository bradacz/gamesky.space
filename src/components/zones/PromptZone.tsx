import React from 'react';
import { retroAudio } from '../../audio/retroSynth';

export const PromptZone: React.FC = () => {
  return (
    <div className="zone-container zone-prompt" style={{ left: '200px' }}>
      {/* Zone Signpost */}
      <div className="zone-signpost">
        <div className="signpost-top">SECTOR 01</div>
        <div className="signpost-title">C:\&gt; PROMPT WASTELAND</div>
      </div>

      {/* BIOS POST & CLI Hell Card */}
      <div className="retro-terminal-box win-outset">
        <div className="terminal-titlebar">
          <span>Award Modular BIOS v4.51PG (C) 1995</span>
          <span>640 KB BASE / 32 MB EXT</span>
        </div>
        <div className="terminal-screen win-inset">
          <div className="terminal-line"><span className="term-green">C:\&gt;</span> cd games\doom2</div>
          <div className="terminal-line"><span className="term-green">C:\GAMES\DOOM2\&gt;</span> doom2.exe</div>
          <div className="terminal-line term-error">Error: Conventional Memory Exhausted (Need 580 KB, Have 512 KB).</div>
          <div className="terminal-line"><span className="term-green">C:\&gt;</span> edit config.sys</div>
          <div className="terminal-line term-dim">DEVICE=C:\DOS\HIMEM.SYS /TESTMEM:OFF</div>
          <div className="terminal-line term-dim">DEVICE=C:\DOS\EMM386.EXE NOEMS HIGHSCAN</div>
          <div className="terminal-line term-dim">DOS=HIGH,UMB</div>
          <div className="terminal-line term-warn">Sound Blaster IRQ Conflict on Port 220, IRQ 7, DMA 1!</div>
          <div className="terminal-line term-blink">_</div>
        </div>

        <div className="terminal-footer">
          <p className="terminal-caption">
            <strong>Pamatujete na noční můru spouštění DOS her?</strong> Ruční psaní <code className="code-chip">mount c ~/dosgames</code>, laborování s EMS pamětí a ladění IRQ konfliktů...
          </p>
          <div className="terminal-action-row">
            <span className="arrow-callout">PROBĚHNĚTE BRÁNOU DO BUDOUCNOSTI ➔</span>
          </div>
        </div>
      </div>

      {/* Dimensional Warp Gate */}
      <div
        className="warp-portal"
        onClick={() => retroAudio.playRolandFanfare()}
        title="Click to activate Warp Gate!"
      >
        <div className="warp-ring ring-1"></div>
        <div className="warp-ring ring-2"></div>
        <div className="warp-core">
          <span>GAMESKY</span>
          <small>WARP GATE</small>
        </div>
      </div>
    </div>
  );
};
