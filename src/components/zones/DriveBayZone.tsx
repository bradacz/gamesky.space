import React, { useState } from 'react';
import { retroAudio } from '../../audio/retroSynth';

export const DriveBayZone: React.FC = () => {
  const [mountedDrive, setMountedDrive] = useState<string | null>('CD-ROM (D:)');

  const mountMedia = (mediaType: string) => {
    retroAudio.playFloppySeek();
    setMountedDrive(mediaType);
  };

  return (
    <div className="zone-container zone-drives" style={{ left: '5800px' }}>
      {/* Zone Signpost */}
      <div className="zone-signpost">
        <div className="signpost-top">SECTOR 04</div>
        <div className="signpost-title">VIRTUAL DRIVE BAY ARCHIPELAGO</div>
      </div>

      <div className="drive-bay-rig win-outset">
        <div className="drive-bay-header">
          <span>💿 HARDWARE MOUNT BAY: ISO / CUE / IMG / HDD</span>
          <span className="bay-status">READY FOR DISK INSERTION</span>
        </div>

        <div className="drive-grid">
          {/* Drive 1: Floppy Drive A: */}
          <div className={`drive-card win-inset ${mountedDrive === 'Floppy A: (1.44 MB)' ? 'drive-mounted' : ''}`}>
            <div className="drive-front">
              <div className="drive-slot floppy-slot"></div>
              <div className="drive-led-row">
                <span className="led-light">●</span>
                <span className="drive-label">DRIVE A:\ 3.5" HD (1.44 MB)</span>
              </div>
            </div>
            <p className="drive-card-desc">Podpora <code>.img</code> disketových obrazů se starými DOS instalátory a bootovacími médii.</p>
            <button
              className="btn-drive-action"
              onClick={() => mountMedia('Floppy A: (1.44 MB)')}
            >
              💾 Vložit disketu A:
            </button>
          </div>

          {/* Drive 2: CD-ROM 4x Drive D: */}
          <div className={`drive-card win-inset ${mountedDrive === 'CD-ROM (D:)' ? 'drive-mounted' : ''}`}>
            <div className="drive-front">
              <div className="drive-slot cdrom-slot">
                <div className="cd-disc-art">💿</div>
              </div>
              <div className="drive-led-row">
                <span className="led-light active">●</span>
                <span className="drive-label">CD-ROM DRIVE D:\ (4X SPEED)</span>
              </div>
            </div>
            <p className="drive-card-desc">Připojení <code>.iso</code>, <code>.cue/.bin</code> a <code>.nrg</code> obrazů včetně RedBook audio stop pro hudbu na CD.</p>
            <button
              className="btn-drive-action"
              onClick={() => mountMedia('CD-ROM (D:)')}
            >
              💿 Připojit ISO obraz
            </button>
          </div>

          {/* Drive 3: HDD & Mac Folder */}
          <div className={`drive-card win-inset ${mountedDrive === 'Mac Folder (C:)' ? 'drive-mounted' : ''}`}>
            <div className="drive-front">
              <div className="drive-slot hdd-slot">
                <span className="hdd-symbol">🗄️</span>
              </div>
              <div className="drive-led-row">
                <span className="led-light">●</span>
                <span className="drive-label">LOCAL HDD C:\ (macOS FOLDER)</span>
              </div>
            </div>
            <p className="drive-card-desc">Připojení libovolné složky z vašeho Macu nebo USB flashdisku jako virtuálního pevného disku <code>C:</code>.</p>
            <button
              className="btn-drive-action"
              onClick={() => mountMedia('Mac Folder (C:)')}
            >
              📁 Namountovat Mac složku
            </button>
          </div>
        </div>

        {/* Live Mount Status Box */}
        <div className="drive-status-footer win-inset">
          <span className="status-title">STATUS:</span>
          <span className="status-text">
            {mountedDrive ? `Aktivní médium: [ ${mountedDrive} ] namountováno bez kolize s 8.3 aliasy!` : 'Žádné médium není vloženo'}
          </span>
        </div>
      </div>
    </div>
  );
};
