import React, { useState } from 'react';
import { retroAudio } from '../../audio/retroSynth';

interface Checkpoint {
  id: string;
  game: string;
  label: string;
  timestamp: string;
  size: string;
}

const SAMPLE_CHECKPOINTS: Checkpoint[] = [
  { id: '1', game: 'DOOM II', label: 'Before Icon of Sin (Map 30)', timestamp: '1994-10-10 23:42', size: '142 KB' },
  { id: '2', game: 'Dune II', label: 'House Atreides Final Mission', timestamp: '1992-12-05 18:20', size: '64 KB' },
  { id: '3', game: 'Monkey Island 2', label: 'Woodtick Treasure Vault', timestamp: '1991-11-20 14:15', size: '88 KB' },
  { id: '4', game: 'Prehistorik 2', label: 'Volcano Boss Secret Exit', timestamp: '1993-04-18 16:50', size: '32 KB' },
];

export const SaveVaultZone: React.FC = () => {
  const [activeCheckpoint, setActiveCheckpoint] = useState<Checkpoint>(SAMPLE_CHECKPOINTS[0]);
  const [vaultRestored, setVaultRestored] = useState<boolean>(false);

  const handleRestore = (cp: Checkpoint) => {
    setActiveCheckpoint(cp);
    retroAudio.playFloppySeek();
    setVaultRestored(true);
    setTimeout(() => setVaultRestored(false), 2200);
  };

  return (
    <div className="zone-container zone-vault" style={{ left: '7700px' }}>
      {/* Zone Signpost */}
      <div className="zone-signpost">
        <div className="signpost-top">SECTOR 05</div>
        <div className="signpost-title">SAVE VAULT &amp; TIME MACHINE</div>
      </div>

      <div className="vault-rig win-outset">
        <div className="vault-header">
          <span>💾 SAVE GAMES &amp; CHECKPOINTS VAULT</span>
          <span className="vault-badge">ZERO DATA LOSS SECURITY</span>
        </div>

        <div className="vault-body">
          {/* Left: Vault Door Artwork */}
          <div className="vault-door-pane win-inset">
            <div className="vault-wheel">
              <div className="vault-monogram">VV</div>
            </div>
            <div className="vault-label">GAMESKY SECURE VAULT</div>
            <p className="vault-subtext">Rekurzivní ochrana uložených pozic před přepsáním nebo reinstalací hry.</p>
          </div>

          {/* Right: Checkpoint Timeline */}
          <div className="vault-timeline-pane win-inset">
            <div className="timeline-header">HISTORIE CHECKPOINTŮ:</div>
            <div className="checkpoint-list">
              {SAMPLE_CHECKPOINTS.map((cp) => (
                <div
                  key={cp.id}
                  className={`checkpoint-row ${activeCheckpoint.id === cp.id ? 'checkpoint-selected' : ''}`}
                  onClick={() => handleRestore(cp)}
                >
                  <div className="cp-left">
                    <span className="cp-icon">💾</span>
                    <div>
                      <strong>{cp.game}:</strong> <span>{cp.label}</span>
                    </div>
                  </div>
                  <div className="cp-right">
                    <span className="cp-time">{cp.timestamp}</span>
                    <button className="btn-cp-restore">Obnovit</button>
                  </div>
                </div>
              ))}
            </div>

            {vaultRestored && (
              <div className="vault-success-banner">
                ✨ Checkpoint [{activeCheckpoint.label}] úspěšně obnoven do virtuálního disku!
              </div>
            )}
          </div>
        </div>

        <div className="vault-footer win-inset">
          <span>🔒 Bezpečný sandbox: Uložené pozice jsou odděleny od systémových souborů vašeho Macu.</span>
        </div>
      </div>
    </div>
  );
};
