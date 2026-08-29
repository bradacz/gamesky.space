import React from 'react';
import { retroAudio } from '../../audio/retroSynth';

export const DownloadZone: React.FC = () => {
  const handleDownload = () => {
    retroAudio.playVictory();
    window.open('https://github.com/bradacz/poly2alerts/releases', '_blank');
  };

  return (
    <div className="zone-container zone-download" style={{ left: '11500px' }}>
      {/* Zone Signpost */}
      <div className="zone-signpost">
        <div className="signpost-top">FINAL SECTOR 07</div>
        <div className="signpost-title">LEVEL COMPLETE &amp; LAUNCHPAD</div>
      </div>

      <div className="download-rig win-outset">
        {/* Victory Header */}
        <div className="victory-banner win-inset">
          <div className="victory-title">🏆 STAGE CLEAR! MISSION ACCOMPLISHED 🏆</div>
          <p className="victory-subtext">Dostali jste se na konec retro trasy. GameSky.space je připraven pro váš Mac.</p>
        </div>

        <div className="download-main-grid">
          {/* Main Download Call To Action */}
          <div className="download-cta-pane win-inset">
            <div className="dmg-boxart">
              <div className="dmg-icon">💾</div>
              <div className="dmg-name">GameSky.space for macOS</div>
              <div className="dmg-version">Verze 1.0.0 (Apple Silicon M1-M4 &amp; Intel x64)</div>
            </div>

            <button
              className="btn-download-mega"
              onClick={handleDownload}
              title="Stáhnout GameSky.space pro macOS"
            >
              <span className="btn-down-icon">⬇</span>
              <span className="btn-down-text">STÁHNOUT PRO macOS (.DMG)</span>
              <span className="btn-down-sub">Bezpečný balíček se všemi presety a katalogy</span>
            </button>

            <div className="download-specs-list">
              <div className="spec-item">✅ Nativní Tauri v2 &amp; Rust (žádný Electron)</div>
              <div className="spec-item">✅ Plná podpora DOSBox, DOSBox-Staging &amp; DOSBox-X</div>
              <div className="spec-item">✅ 35 FreeDOS her v základu + Internet Archive</div>
            </div>
          </div>

          {/* High Scores & Badges */}
          <div className="leaderboard-pane win-inset">
            <div className="board-title">👾 HALL OF FAME HIGH SCORES:</div>
            <table className="score-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>PILOT</th>
                  <th>SCORE</th>
                  <th>STAGE</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1ST</td>
                  <td>GSK</td>
                  <td>999,990</td>
                  <td>ALL CLEAR</td>
                </tr>
                <tr>
                  <td>2ND</td>
                  <td>IDD</td>
                  <td>666,000</td>
                  <td>DOOM II</td>
                </tr>
                <tr>
                  <td>3RD</td>
                  <td>DUK</td>
                  <td>350,000</td>
                  <td>L.A. MELTDOWN</td>
                </tr>
                <tr>
                  <td>4TH</td>
                  <td>GUY</td>
                  <td>128,400</td>
                  <td>SCUMM BAR</td>
                </tr>
              </tbody>
            </table>

            {/* 90s Web Badges */}
            <div className="retro-badges-grid">
              <div className="badge-chip">🌐 Best Viewed in 800×600</div>
              <div className="badge-chip">🦀 Rust &amp; Tauri v2</div>
              <div className="badge-chip">☁️ Cloudflare Pages Ready</div>
              <div className="badge-chip">📟 Netscape 3.0 Compatible</div>
            </div>

            {/* 90s Hit Counter */}
            <div className="hit-counter-box">
              <span className="counter-label">VISITOR NUMBER:</span>
              <span className="counter-digits">0 0 0 4 2 0 6 9</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="download-footer win-inset">
          <span>GameSky.space &copy; 2026. Zlatá éra DOS her na moderním macOS.</span>
          <a
            href="https://github.com/bradacz/poly2alerts"
            target="_blank"
            rel="noreferrer"
            className="gh-link"
          >
            GitHub Repository &amp; Source Code ➔
          </a>
        </div>
      </div>
    </div>
  );
};
