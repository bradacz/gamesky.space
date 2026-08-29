import React, { useState } from 'react';
import { retroAudio } from '../../audio/retroSynth';

interface DemoGame {
  id: string;
  name: string;
  year: number;
  genre: string;
  cycles: string;
  audio: string;
  coverArt: string;
}

const DEMO_GAMES: DemoGame[] = [
  { id: 'doom2', name: 'DOOM II: Hell on Earth', year: 1994, genre: 'FPS / Action', cycles: '15,000 (Dynamic)', audio: 'SB16 + General MIDI', coverArt: '💀' },
  { id: 'dune2', name: 'Dune II: Building of a Dynasty', year: 1992, genre: 'RTS Strategy', cycles: '10,000 (386 Core)', audio: 'Roland MT-32', coverArt: '🪐' },
  { id: 'pre2', name: 'Prehistorik 2', year: 1993, genre: 'Platformer', cycles: '12,000 (Auto)', audio: 'Sound Blaster Pro', coverArt: '🦖' },
  { id: 'duke3d', name: 'Duke Nukem 3D', year: 1996, genre: 'FPS / 3D Realms', cycles: '35,000 (Pentium)', audio: 'Gravis UltraSound', coverArt: '☢️' },
  { id: 'war2', name: 'Warcraft II: Tides of Darkness', year: 1995, genre: 'RTS Strategy', cycles: '30,000 (SVGA)', audio: 'SB16 / Roland MT-32', coverArt: '⚔️' },
];

export const NortonWarpZone: React.FC = () => {
  const [selectedGame, setSelectedGame] = useState<DemoGame>(DEMO_GAMES[0]);
  const [launchingState, setLaunchingState] = useState<string | null>(null);

  const handleSelectGame = (game: DemoGame) => {
    setSelectedGame(game);
    retroAudio.playBlip();
  };

  const handleLaunch = () => {
    retroAudio.playFloppySeek();
    setLaunchingState('MOUNTING VIRTUAL C:\\ DRIVE...');
    setTimeout(() => {
      setLaunchingState(`INITIALIZING DOSBOX WITH ${selectedGame.cycles}...`);
    }, 400);
    setTimeout(() => {
      setLaunchingState(`BOOTING ${selectedGame.name}! ENJOY!`);
      retroAudio.playSoundBlasterJingle();
    }, 900);
    setTimeout(() => {
      setLaunchingState(null);
    }, 2800);
  };

  return (
    <div className="zone-container zone-norton" style={{ left: '2000px' }}>
      {/* Zone Signpost */}
      <div className="zone-signpost">
        <div className="signpost-top">SECTOR 02</div>
        <div className="signpost-title">GAMESKY.SPACE WORKSTATION</div>
      </div>

      {/* Live Interactive App Preview in Norton Commander Palette */}
      <div className="norton-app-window win-outset">
        {/* Titlebar */}
        <div className="norton-titlebar">
          <span className="norton-title-text">
            <strong>GameSky.space v1.0.0</strong> [macOS Native DOSBox Station]
          </span>
          <div className="norton-window-btns">
            <span className="win-btn">_</span>
            <span className="win-btn">□</span>
            <span className="win-btn">✕</span>
          </div>
        </div>

        {/* 3-Column Norton Rig */}
        <div className="norton-app-body">
          {/* Left Column: Game List */}
          <div className="norton-pane pane-left win-inset">
            <div className="pane-header">A:\ MY_DOS_GAMES</div>
            <div className="norton-list">
              {DEMO_GAMES.map((game) => (
                <div
                  key={game.id}
                  className={`norton-list-row ${selectedGame.id === game.id ? 'row-selected' : ''}`}
                  onClick={() => handleSelectGame(game)}
                >
                  <span className="game-icon">{game.coverArt}</span>
                  <span className="game-title-text">{game.name}</span>
                  <span className="game-year">{game.year}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Center Column: Showcase & Big Box Preview */}
          <div className="norton-pane pane-center win-inset">
            <div className="boxart-preview-frame">
              <div className="boxart-placeholder">
                <span className="boxart-big-emoji">{selectedGame.coverArt}</span>
                <span className="boxart-label">{selectedGame.name}</span>
              </div>
            </div>
            <div className="game-meta-box">
              <div className="meta-row"><strong>Žánr:</strong> {selectedGame.genre}</div>
              <div className="meta-row"><strong>CPU Cykly:</strong> {selectedGame.cycles}</div>
              <div className="meta-row"><strong>Zvuková karta:</strong> {selectedGame.audio}</div>
              <div className="meta-row status-ready">🟢 Automatický profil připraven</div>
            </div>
          </div>

          {/* Right Column: 1-Click Launch Button */}
          <div className="norton-pane pane-right win-outset">
            <div className="launch-panel">
              <div className="drive-indicator">
                <span className="drive-led active">●</span>
                <span>DRIVE C: MOUNTED</span>
              </div>
              <div className="quick-info">
                Žádný terminál. Žádné ruční příkazy.
              </div>
              <button
                className="btn-run-big"
                onClick={handleLaunch}
                title="Click to simulate 1-click launch!"
              >
                ▶ F9 RUN GAME
              </button>

              {launchingState && (
                <div className="launch-simulation-badge">
                  {launchingState}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid Below */}
        <div className="norton-features-footer">
          <div className="feat-chip">⚡ 1-Click Direct Launch</div>
          <div className="feat-chip">🖼️ Automatické Boxarty z Libretro &amp; IA</div>
          <div className="feat-chip">🍏 Optimalizováno pro Apple Silicon M1-M4 &amp; Intel</div>
        </div>
      </div>
    </div>
  );
};
