import { GameProfile, MachineType, MediaItem, ScalerType, SoundBlasterType } from './types';
import { StorageService, AppPreferences } from './services/storage';
import { generateDosboxConf } from './services/confGenerator';
import { soundFX } from './services/soundEffects';
import { EmulatorLauncher } from './services/emulatorLauncher';
import { searchPresets } from './database/dosGamePresets';
import { ArchiveDownloader, ArchiveGameItem, CatalogSource } from './services/archiveDownloader';
import { SaveManager } from './services/saveManager';
import { ArtworkService } from './services/artworkService';
import { InputProfileService } from './services/inputProfiles';
import {
  applyAutomaticCompatibilityProfile,
  compatibilityAssessment,
  COMPATIBILITY_PROFILE_VERSION,
  recommendedSettingsForGame
} from './services/compatibilityProfiles';

// State
let games: GameProfile[] = [];
let selectedGameId: string | null = null;
let prefs: AppPreferences = StorageService.loadPreferences();

// DOM references
const el = {
  // Toolbar
  tbNewGame: document.getElementById('tbNewGame') as HTMLButtonElement,
  tbOpenPresets: document.getElementById('tbOpenPresets') as HTMLButtonElement,
  tbOnlineArchive: document.getElementById('tbOnlineArchive') as HTMLButtonElement,
  tbGameSaves: document.getElementById('tbGameSaves') as HTMLButtonElement,
  tbSaveLibrary: document.getElementById('tbSaveLibrary') as HTMLButtonElement,
  tbImportLibrary: document.getElementById('tbImportLibrary') as HTMLButtonElement,
  tbDuplicateGame: document.getElementById('tbDuplicateGame') as HTMLButtonElement,
  tbDeleteGame: document.getElementById('tbDeleteGame') as HTMLButtonElement,
  tbThemeToggle: document.getElementById('tbThemeToggle') as HTMLButtonElement,
  tbSoundToggle: document.getElementById('tbSoundToggle') as HTMLButtonElement,
  tbToggleFullscreen: document.getElementById('tbToggleFullscreen') as HTMLButtonElement,
  tbConfig: document.getElementById('tbConfig') as HTMLButtonElement,
  tbHelp: document.getElementById('tbHelp') as HTMLButtonElement,

  // Window Controls
  btnWinMinimize: document.getElementById('btnWinMinimize') as HTMLButtonElement,
  btnWinMaximize: document.getElementById('btnWinMaximize') as HTMLButtonElement,
  btnWinClose: document.getElementById('btnWinClose') as HTMLButtonElement,

  // Menu items
  menuFile: document.getElementById('menuFile') as HTMLDivElement,
  menuEdit: document.getElementById('menuEdit') as HTMLDivElement,
  menuDrives: document.getElementById('menuDrives') as HTMLDivElement,
  menuView: document.getElementById('menuView') as HTMLDivElement,
  menuSettings: document.getElementById('menuSettings') as HTMLDivElement,
  menuHelp: document.getElementById('menuHelp') as HTMLDivElement,

  // Workspace panels & resizers
  panelLeft: document.getElementById('panelLeft') as HTMLDivElement,
  panelCenter: document.getElementById('panelCenter') as HTMLDivElement,
  panelRight: document.getElementById('panelRight') as HTMLDivElement,
  resizerLeft: document.getElementById('resizerLeft') as HTMLDivElement,
  resizerRight: document.getElementById('resizerRight') as HTMLDivElement,

  // Left Panel
  folderFilterInput: document.getElementById('folderFilterInput') as HTMLInputElement,
  libraryViewSelect: document.getElementById('libraryViewSelect') as HTMLSelectElement,
  gameListBox: document.getElementById('gameListBox') as HTMLDivElement,

  // Center Showcase
  centerCoverFrame: document.getElementById('centerCoverFrame') as HTMLDivElement,
  centerCoverImage: document.getElementById('centerCoverImage') as HTMLImageElement,
  centerCoverPlaceholder: document.getElementById('centerCoverPlaceholder') as HTMLDivElement,
  centerTitle: document.getElementById('centerTitle') as HTMLDivElement,
  centerPath: document.getElementById('centerPath') as HTMLDivElement,
  centerDev: document.getElementById('centerDev') as HTMLDivElement,
  centerStatus: document.getElementById('centerStatus') as HTMLDivElement,
  centerGenre: document.getElementById('centerGenre') as HTMLDivElement,
  btnToggleFavorite: document.getElementById('btnToggleFavorite') as HTMLButtonElement,
  btnDiagnoseGame: document.getElementById('btnDiagnoseGame') as HTMLButtonElement,
  btnGameControls: document.getElementById('btnGameControls') as HTMLButtonElement,

  // Right Panel: Drives
  floppyDisplay: document.getElementById('floppyDisplay') as HTMLDivElement,
  btnFloppyBrowse: document.getElementById('btnFloppyBrowse') as HTMLButtonElement,
  btnFloppyEject: document.getElementById('btnFloppyEject') as HTMLButtonElement,
  cdRomDisplay: document.getElementById('cdRomDisplay') as HTMLDivElement,
  btnCdBrowse: document.getElementById('btnCdBrowse') as HTMLButtonElement,
  btnCdBrowseFolder: document.getElementById('btnCdBrowseFolder') as HTMLButtonElement,
  btnCdEject: document.getElementById('btnCdEject') as HTMLButtonElement,

  // Right Panel: Settings
  cyclesRange: document.getElementById('cyclesRange') as HTMLInputElement,
  cyclesValueDisplay: document.getElementById('cyclesValueDisplay') as HTMLSpanElement,
  selMachine: document.getElementById('selMachine') as HTMLSelectElement,
  selScaler: document.getElementById('selScaler') as HTMLSelectElement,
  selSoundCard: document.getElementById('selSoundCard') as HTMLSelectElement,
  selPort: document.getElementById('selPort') as HTMLSelectElement,
  selIrq: document.getElementById('selIrq') as HTMLSelectElement,
  selDma: document.getElementById('selDma') as HTMLSelectElement,
  chkMidi: document.getElementById('chkMidi') as HTMLInputElement,
  chkFullscreenGame: document.getElementById('chkFullscreenGame') as HTMLInputElement,

  // Big Action Buttons
  btnBigCatalog: document.getElementById('btnBigCatalog') as HTMLButtonElement,
  btnRunDosGame: document.getElementById('btnRunDosGame') as HTMLButtonElement,

  // Status Bar
  sbSelectedText: document.getElementById('sbSelectedText') as HTMLDivElement,
  sbCountText: document.getElementById('sbCountText') as HTMLDivElement,
  sbCpuText: document.getElementById('sbCpuText') as HTMLDivElement,
  sbClockText: document.getElementById('sbClockText') as HTMLDivElement,

  // Modal: Game Profile Editor
  modalGameEdit: document.getElementById('modalGameEdit') as HTMLDivElement,
  btnCancelEditX: document.getElementById('btnCancelEditX') as HTMLButtonElement,
  btnCancelProfile: document.getElementById('btnCancelProfile') as HTMLButtonElement,
  btnSaveProfile: document.getElementById('btnSaveProfile') as HTMLButtonElement,
  inputPresetSearch: document.getElementById('inputPresetSearch') as HTMLInputElement,
  presetSuggestionsBox: document.getElementById('presetSuggestionsBox') as HTMLDivElement,
  inputTitle: document.getElementById('inputTitle') as HTMLInputElement,
  inputExecutable: document.getElementById('inputExecutable') as HTMLInputElement,
  btnModalBrowseExecutable: document.getElementById('btnModalBrowseExecutable') as HTMLButtonElement,
  inputDev: document.getElementById('inputDev') as HTMLInputElement,
  inputYearGenre: document.getElementById('inputYearGenre') as HTMLInputElement,
  inputFolder: document.getElementById('inputFolder') as HTMLInputElement,
  btnModalBrowseDir: document.getElementById('btnModalBrowseDir') as HTMLButtonElement,
  inputCdIso: document.getElementById('inputCdIso') as HTMLInputElement,
  btnModalBrowseIso: document.getElementById('btnModalBrowseIso') as HTMLButtonElement,
  btnModalBrowseCdFolder: document.getElementById('btnModalBrowseCdFolder') as HTMLButtonElement,
  inputNotes: document.getElementById('inputNotes') as HTMLInputElement,
  inputFullscreen: document.getElementById('inputFullscreen') as HTMLInputElement,

  // Modal: Config
  modalConfig: document.getElementById('modalConfig') as HTMLDivElement,
  btnCancelConfigX: document.getElementById('btnCancelConfigX') as HTMLButtonElement,
  btnCloseConfig: document.getElementById('btnCloseConfig') as HTMLButtonElement,
  btnSaveConfig: document.getElementById('btnSaveConfig') as HTMLButtonElement,
  btnAutoDetectEmus: document.getElementById('btnAutoDetectEmus') as HTMLButtonElement,
  detectedEmusBox: document.getElementById('detectedEmusBox') as HTMLDivElement,
  btnBrowseDosbox: document.getElementById('btnBrowseDosbox') as HTMLButtonElement,
  btnBrowseStaging: document.getElementById('btnBrowseStaging') as HTMLButtonElement,
  btnBrowseX: document.getElementById('btnBrowseX') as HTMLButtonElement,
  btnBrowseScummvm: document.getElementById('btnBrowseScummvm') as HTMLButtonElement,
  btnBrowseDefaultDir: document.getElementById('btnBrowseDefaultDir') as HTMLButtonElement,
  cfgEmuType: document.getElementById('cfgEmuType') as HTMLSelectElement,
  cfgDosboxPath: document.getElementById('cfgDosboxPath') as HTMLInputElement,
  cfgStagingPath: document.getElementById('cfgStagingPath') as HTMLInputElement,
  cfgXPath: document.getElementById('cfgXPath') as HTMLInputElement,
  cfgScummvmPath: document.getElementById('cfgScummvmPath') as HTMLInputElement,
  panelDrives: document.getElementById('panelDrives') as HTMLDivElement,
  panelDosboxConfig: document.getElementById('panelDosboxConfig') as HTMLDivElement,
  cfgDefaultDir: document.getElementById('cfgDefaultDir') as HTMLInputElement,
  cfgThemeSelect: document.getElementById('cfgThemeSelect') as HTMLSelectElement,
  cfgNortonCommanderPath: document.getElementById('cfgNortonCommanderPath') as HTMLInputElement,
  btnBrowseNortonCommander: document.getElementById('btnBrowseNortonCommander') as HTMLButtonElement,
  cfgDeleteArchiveAfterUnpack: document.getElementById('cfgDeleteArchiveAfterUnpack') as HTMLInputElement,
  cfgAudioEnabled: document.getElementById('cfgAudioEnabled') as HTMLInputElement,
  cfgCheckUpdates: document.getElementById('cfgCheckUpdates') as HTMLInputElement,
  btnCheckUpdates: document.getElementById('btnCheckUpdates') as HTMLButtonElement,
  updateStatus: document.getElementById('updateStatus') as HTMLElement,

  // Center Game Actions
  btnUnpackGameArchive: document.getElementById('btnUnpackGameArchive') as HTMLButtonElement,
  btnLaunchFileManager: document.getElementById('btnLaunchFileManager') as HTMLButtonElement,
  btnLaunchSetup: document.getElementById('btnLaunchSetup') as HTMLButtonElement,
  lblRunDosGame: document.getElementById('lblRunDosGame') as HTMLSpanElement,

  // Post-Install Assistant
  modalPostInstall: document.getElementById('modalPostInstall') as HTMLDivElement,
  btnCancelPostInstallX: document.getElementById('btnCancelPostInstallX') as HTMLButtonElement,
  postInstallDesc: document.getElementById('postInstallDesc') as HTMLParagraphElement,
  postInstallCandidatesList: document.getElementById('postInstallCandidatesList') as HTMLDivElement,
  postInstallTitle: document.getElementById('postInstallTitle') as HTMLSpanElement,
  btnApplyPostInstallExe: document.getElementById('btnApplyPostInstallExe') as HTMLButtonElement,
  btnSkipPostInstall: document.getElementById('btnSkipPostInstall') as HTMLButtonElement,

  // Modal: Launch
  modalLaunch: document.getElementById('modalLaunch') as HTMLDivElement,
  btnCancelLaunchX: document.getElementById('btnCancelLaunchX') as HTMLButtonElement,
  btnCloseLaunchModal: document.getElementById('btnCloseLaunchModal') as HTMLButtonElement,
  launchHeaderMsg: document.getElementById('launchHeaderMsg') as HTMLDivElement,
  launchCmdBox: document.getElementById('launchCmdBox') as HTMLInputElement,
  launchConfBox: document.getElementById('launchConfBox') as HTMLElement,
  btnCopyLaunchCmd: document.getElementById('btnCopyLaunchCmd') as HTMLButtonElement,
  btnSaveLaunchConf: document.getElementById('btnSaveLaunchConf') as HTMLButtonElement,

  // Modal: Online Archive Downloader & Catalog
  modalArchive: document.getElementById('modalArchive') as HTMLDivElement,
  btnCancelArchiveX: document.getElementById('btnCancelArchiveX') as HTMLButtonElement,
  btnCloseArchive: document.getElementById('btnCloseArchive') as HTMLButtonElement,
  archiveSearchInput: document.getElementById('archiveSearchInput') as HTMLInputElement,
  btnArchiveSearch: document.getElementById('btnArchiveSearch') as HTMLButtonElement,
  btnArchiveClear: document.getElementById('btnArchiveClear') as HTMLButtonElement,
  archiveSortSelect: document.getElementById('archiveSortSelect') as HTMLSelectElement,
  catalogSourceSelect: document.getElementById('catalogSourceSelect') as HTMLSelectElement,
  catalogGenreTabs: document.getElementById('catalogGenreTabs') as HTMLDivElement,
  archiveResultsBox: document.getElementById('archiveResultsBox') as HTMLDivElement,
  archiveStatusMsg: document.getElementById('archiveStatusMsg') as HTMLDivElement,

  // Center Game Saves Button
  btnOpenGameSaves: document.getElementById('btnOpenGameSaves') as HTMLButtonElement,
  btnSetArtwork: document.getElementById('btnSetArtwork') as HTMLButtonElement,
  btnChooseExecutable: document.getElementById('btnChooseExecutable') as HTMLButtonElement,

  // Modal: Saves & Checkpoints
  modalSaves: document.getElementById('modalSaves') as HTMLDivElement,
  btnCancelSavesX: document.getElementById('btnCancelSavesX') as HTMLButtonElement,
  btnCloseSaves: document.getElementById('btnCloseSaves') as HTMLButtonElement,
  savesGameTitle: document.getElementById('savesGameTitle') as HTMLSpanElement,
  savesGameFolder: document.getElementById('savesGameFolder') as HTMLDivElement,
  btnOpenFinderSaves: document.getElementById('btnOpenFinderSaves') as HTMLButtonElement,
  tabLiveSaves: document.getElementById('tabLiveSaves') as HTMLButtonElement,
  tabCheckpoints: document.getElementById('tabCheckpoints') as HTMLButtonElement,
  viewLiveSaves: document.getElementById('viewLiveSaves') as HTMLDivElement,
  viewCheckpoints: document.getElementById('viewCheckpoints') as HTMLDivElement,
  liveSavesList: document.getElementById('liveSavesList') as HTMLDivElement,
  checkpointsList: document.getElementById('checkpointsList') as HTMLDivElement,
  btnRefreshLiveSaves: document.getElementById('btnRefreshLiveSaves') as HTMLButtonElement,
  inputCheckpointName: document.getElementById('inputCheckpointName') as HTMLInputElement,
  btnCreateCheckpoint: document.getElementById('btnCreateCheckpoint') as HTMLButtonElement,
  savesStatusBanner: document.getElementById('savesStatusBanner') as HTMLSpanElement,

  // First-run setup
  modalSetupWizard: document.getElementById('modalSetupWizard') as HTMLDivElement,
  btnCloseSetupWizard: document.getElementById('btnCloseSetupWizard') as HTMLButtonElement,
  setupCheckResults: document.getElementById('setupCheckResults') as HTMLDivElement,
  setupLibraryPath: document.getElementById('setupLibraryPath') as HTMLInputElement,
  btnSetupChooseLibrary: document.getElementById('btnSetupChooseLibrary') as HTMLButtonElement,
  btnSetupRunChecks: document.getElementById('btnSetupRunChecks') as HTMLButtonElement,
  btnFinishSetup: document.getElementById('btnFinishSetup') as HTMLButtonElement,

  // Diagnostics
  modalDiagnostics: document.getElementById('modalDiagnostics') as HTMLDivElement,
  btnCloseDiagnosticsX: document.getElementById('btnCloseDiagnosticsX') as HTMLButtonElement,
  btnCloseDiagnostics: document.getElementById('btnCloseDiagnostics') as HTMLButtonElement,
  btnAutoRepairGame: document.getElementById('btnAutoRepairGame') as HTMLButtonElement,
  diagnosticsGameTitle: document.getElementById('diagnosticsGameTitle') as HTMLDivElement,
  diagnosticsResults: document.getElementById('diagnosticsResults') as HTMLDivElement,

  // Multi-disc media manager
  modalMediaManager: document.getElementById('modalMediaManager') as HTMLDivElement,
  btnCloseMediaManagerX: document.getElementById('btnCloseMediaManagerX') as HTMLButtonElement,
  btnCloseMediaManager: document.getElementById('btnCloseMediaManager') as HTMLButtonElement,
  mediaCdMode: document.getElementById('mediaCdMode') as HTMLSelectElement,
  mediaDriveLetter: document.getElementById('mediaDriveLetter') as HTMLSelectElement,
  cdMediaList: document.getElementById('cdMediaList') as HTMLDivElement,
  floppyMediaList: document.getElementById('floppyMediaList') as HTMLDivElement,
  btnAddCdImages: document.getElementById('btnAddCdImages') as HTMLButtonElement,
  btnAddFloppyImages: document.getElementById('btnAddFloppyImages') as HTMLButtonElement,
  btnClearMediaSets: document.getElementById('btnClearMediaSets') as HTMLButtonElement,
  btnSaveMediaSets: document.getElementById('btnSaveMediaSets') as HTMLButtonElement,
  mediaManagerStatus: document.getElementById('mediaManagerStatus') as HTMLDivElement,

  // Controller profiles
  modalControls: document.getElementById('modalControls') as HTMLDivElement,
  btnCloseControlsX: document.getElementById('btnCloseControlsX') as HTMLButtonElement,
  btnCloseControls: document.getElementById('btnCloseControls') as HTMLButtonElement,
  controlsTemplate: document.getElementById('controlsTemplate') as HTMLSelectElement,
  controlsJoystickType: document.getElementById('controlsJoystickType') as HTMLSelectElement,
  controlsDeadzone: document.getElementById('controlsDeadzone') as HTMLInputElement,
  controlsDeadzoneValue: document.getElementById('controlsDeadzoneValue') as HTMLElement,
  controlsAutofire: document.getElementById('controlsAutofire') as HTMLInputElement,
  controlsCircular: document.getElementById('controlsCircular') as HTMLInputElement,
  controlsMapperPreview: document.getElementById('controlsMapperPreview') as HTMLDivElement,
  btnSaveControls: document.getElementById('btnSaveControls') as HTMLButtonElement,
};

let activeCatalogCategory = 'all';
let activeCatalogSource: CatalogSource = 'all';
let currentCatalogItems: ArchiveGameItem[] = [];
let launchingGameId: string | null = null;
let editingCdMedia: MediaItem[] = [];
let editingFloppyMedia: MediaItem[] = [];
const artworkCacheInFlight = new Set<string>();
let activeSetupLaunchGameId: string | null = null;
let postInstallTargetGame: GameProfile | null = null;
let postInstallSelectedCandidate: import('./services/emulatorLauncher').ExecutableCandidate | null = null;
let selectedGameSetupCandidate: import('./services/emulatorLauncher').ExecutableCandidate | null = null;
let selectedGameArchives: import('./types').DiscoveredArchiveItem[] = [];
// Set when the folder being imported holds a ScummVM game rather than a DOS one.
let pendingScummvmGame: { gameId: string; description: string; path: string } | null = null;

// --------------------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------------------
async function init() {
  const nativeState = await StorageService.initializeNativePersistence();
  games = nativeState?.games ?? StorageService.loadGames();
  prefs = nativeState?.preferences ?? StorageService.loadPreferences();
  migrateToNortonRefresh();
  applyPreferences();
  loadSavedColumnWidths();

  if (games.length > 0) {
    selectedGameId = games[0].id;
  }

  startLiveClock();
  renderGameList();
  renderSelectedGame();
  setupEvents();
  setupColumnResizers();
  void setupNativeSessionListener();
  renderPresetSuggestions('');
  void initializeNativeLibrary();
  if (prefs.checkForUpdates && EmulatorLauncher.isTauriEnvironment()) {
    window.setTimeout(() => {
      if (!document.querySelector('.modal-overlay.open')) void checkForUpdates(false);
    }, 10_000);
  }
}

async function setupNativeSessionListener() {
  if (!EmulatorLauncher.isTauriEnvironment()) return;
  try {
    const { listen } = await import('@tauri-apps/api/event');
    await listen<{
      gameId: string;
      sessionId: number;
      durationSeconds: number;
      exitStatus: string;
    }>('game-session-ended', event => {
      const game = games.find(item => item.id === event.payload.gameId);
      if (!game) return;
      game.playTimeSeconds = (game.playTimeSeconds || 0) + event.payload.durationSeconds;
      StorageService.saveGames(games);
      if (selectedGameId === game.id) {
        el.centerStatus.textContent = `Status: Finished · ${formatPlayTime(game.playTimeSeconds)}`;
        renderSelectedGame();
      }
      renderGameList();

      if (activeSetupLaunchGameId === game.id) {
        activeSetupLaunchGameId = null;
        void checkPostInstallCandidates(game);
      }
    });
  } catch (error) {
    console.warn('Game session listener is unavailable:', error);
  }
}

function formatPlayTime(totalSeconds = 0): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function migrateToNortonRefresh() {
  const migrationKey = 'dosbox_retro_norton_refresh_v1';
  if (localStorage.getItem(migrationKey)) return;
  prefs.theme = 'norton-blue';
  StorageService.savePreferences(prefs);
  localStorage.setItem(migrationKey, '1');
}

async function initializeNativeLibrary() {
  await ensureAvailableEmulatorIsConfigured();
  if (!EmulatorLauncher.isTauriEnvironment()) return;

  const defaultDir = prefs.defaultCDrive || '~/DOSGAMES';
  const discovered = await EmulatorLauncher.scanInstalledGames(defaultDir);
  let changed = false;

  // 1. Deduplicate in-memory games array by slug and purge orphaned app entries
  const deduped: GameProfile[] = [];
  const seenSlugs = new Set<string>();
  for (const g of games) {
    const slug = g.title.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (
      slug === 'app' ||
      g.drives.cDrivePath.endsWith('/app') ||
      g.title.toLowerCase() === 'app'
    ) {
      changed = true;
      continue;
    }
    if (!seenSlugs.has(slug)) {
      seenSlugs.add(slug);
      deduped.push(g);
    } else {
      changed = true;
    }
  }
  games = deduped;

  // 2. Synchronize with newly discovered items
  for (const installed of discovered) {
    const slug = installed.title.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const existingIndex = games.findIndex(
      g => g.title.toLowerCase().replace(/[^a-z0-9]+/g, '') === slug
    );

    if (existingIndex >= 0) {
      const existing = games[existingIndex];
      let updated = false;

      // Update C: drive & executable if discovered target folder is more specific
      if (
        installed.targetFolder &&
        installed.targetFolder !== defaultDir &&
        existing.drives.cDrivePath !== installed.targetFolder
      ) {
        existing.drives.cDrivePath = installed.targetFolder;
        existing.executable = installed.executable;
        existing.workingDir = installed.workingDir;
        updated = true;
      }
      // Always synchronize executable if discovered is better (e.g. ALBION.EXE instead of MAIN.EXE)
      if (installed.executable && existing.executable !== installed.executable) {
        existing.executable = installed.executable;
        existing.workingDir = installed.workingDir;
        updated = true;
      }
      // Update CD-ROM path if discovered and not currently set
      if (
        installed.cdRomPath &&
        (!existing.drives.cdRomPath || existing.drives.cdRomPath.trim() === '')
      ) {
        existing.drives.cdRomPath = installed.cdRomPath;
        updated = true;
      }
      if (updated) changed = true;
      continue;
    }

    const isPackageArchive =
      installed.executable.toLowerCase().includes('package') ||
      installed.executable.toLowerCase().endsWith('.zip') ||
      installed.executable.toLowerCase().endsWith('.7z') ||
      installed.executable.toLowerCase().endsWith('.rar');

    const discoveredProfile: GameProfile = {
      id: stableLocalGameId(installed.targetFolder, installed.executable),
      title: installed.title,
      developer: 'Unknown',
      genre: 'DOS game',
      executable: installed.executable,
      workingDir: installed.workingDir,
      drives: {
        cDrivePath: installed.targetFolder,
        cdRomPath: installed.cdRomPath || '',
        floppyPath: ''
      },
      settings: recommendedSettingsForGame({
        title: installed.title,
        genre: 'DOS game'
      }, prefs.activeEmulator),
      compatibilityProfileVersion: COMPATIBILITY_PROFILE_VERSION,
      ...compatibilityAssessment({ title: installed.title, genre: 'DOS game' }),
      installationState: isPackageArchive ? 'needs-attention' : 'ready',
      createdAt: Date.now()
    };
    games.push(discoveredProfile);
    changed = true;
  }

  if (changed) {
    games.sort((a, b) => a.title.localeCompare(b.title));
    selectedGameId = selectedGameId || games[0]?.id || null;
    StorageService.saveGames(games);
    renderGameList();
    renderSelectedGame();
  }
  if (!prefs.setupCompleted) {
    openSetupWizard();
  }
}

function stableLocalGameId(folder: string, executable = ''): string {
  const combined = `${folder}::${executable}`;
  let hash = 2166136261;
  for (let index = 0; index < combined.length; index += 1) {
    hash ^= combined.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `game-local-${(hash >>> 0).toString(16)}`;
}

async function ensureAvailableEmulatorIsConfigured() {
  if (!EmulatorLauncher.isTauriEnvironment() || prefs.activeEmulator === 'custom') return;

  const installations = (await EmulatorLauncher.detectInstallations()).filter(item => item.exists);
  if (installations.length === 0) return;

  let changed = false;
  for (const installation of installations) {
    if (installation.emulatorType === 'dosbox' && prefs.dosboxPath !== installation.path) {
      prefs.dosboxPath = installation.path;
      changed = true;
    } else if (installation.emulatorType === 'dosbox-staging' && prefs.dosboxStagingPath !== installation.path) {
      prefs.dosboxStagingPath = installation.path;
      changed = true;
    } else if (installation.emulatorType === 'dosbox-x' && prefs.dosboxXPath !== installation.path) {
      prefs.dosboxXPath = installation.path;
      changed = true;
    }
  }

  const activePath = prefs.activeEmulator === 'dosbox-staging'
    ? prefs.dosboxStagingPath
    : prefs.activeEmulator === 'dosbox-x'
      ? prefs.dosboxXPath
      : prefs.dosboxPath;
  const activeIsAvailable = installations.some(item => item.path === activePath);
  const standardDefaultPaths = [
    '/Applications/DOSBox.app/Contents/MacOS/DOSBox',
    '/Applications/DOSBox Staging.app/Contents/MacOS/dosbox',
    '/Applications/DOSBox-X.app/Contents/MacOS/dosbox-x'
  ];

  if (!activeIsAvailable && standardDefaultPaths.includes(activePath)) {
    const preferred = installations.find(item => item.emulatorType === 'dosbox-staging') || installations[0];
    prefs.activeEmulator = preferred.emulatorType as AppPreferences['activeEmulator'];
    changed = true;
  }

  if (changed) {
    StorageService.savePreferences(prefs);
    applyPreferences();
  }
}

function applyPreferences() {
  soundFX.setEnabled(prefs.soundEffectsEnabled);
  el.tbSoundToggle.textContent = prefs.soundEffectsEnabled ? 'SND+' : 'SND-';
  el.cfgEmuType.value = prefs.activeEmulator;
  el.cfgDosboxPath.value = prefs.dosboxPath;
  el.cfgStagingPath.value = prefs.dosboxStagingPath;
  el.cfgXPath.value = prefs.dosboxXPath;
  el.cfgScummvmPath.value = prefs.scummvmPath;
  el.cfgDefaultDir.value = prefs.defaultCDrive;
  el.cfgThemeSelect.value = prefs.theme || 'classic-win95';
  el.cfgAudioEnabled.checked = prefs.soundEffectsEnabled;
  el.cfgCheckUpdates.checked = prefs.checkForUpdates;

  applyTheme(prefs.theme || 'classic-win95');
}

function applyTheme(themeName: string) {
  document.body.classList.remove('theme-norton', 'theme-dos-matrix', 'theme-apple');
  if (themeName === 'norton-blue') {
    document.body.classList.add('theme-norton');
  } else if (themeName === 'dos-matrix') {
    document.body.classList.add('theme-dos-matrix');
  } else if (themeName === 'apple-light') {
    document.body.classList.add('theme-apple');
  }
}

function startLiveClock() {
  const updateClock = () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    el.sbClockText.textContent = `${hours}:${minutes} ${ampm}`;
  };
  updateClock();
  setInterval(updateClock, 1000);
}

function getSelectedGame(): GameProfile | undefined {
  return games.find(g => g.id === selectedGameId);
}

function showAppHelp() {
  soundFX.playButtonClick();
  alert('GameSky.space\n\n- Click ▶ next to a game, press F9, or double-click its row to run it.\n- Add only real games from Catalog, HDD, or flash drive.\n- CD images and mounted discs are available in Media.\n- The bottom F-key strip is fully functional.');
}

// --------------------------------------------------------------------------
// COLUMN RESIZING & PERSISTENCE
// --------------------------------------------------------------------------
function setupColumnResizers() {
  let isDraggingLeft = false;
  let isDraggingRight = false;

  // Left resizer
  el.resizerLeft.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDraggingLeft = true;
    el.resizerLeft.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
  });

  // Right resizer
  el.resizerRight.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDraggingRight = true;
    el.resizerRight.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (isDraggingLeft) {
      const containerLeft = el.panelLeft.parentElement?.getBoundingClientRect().left || 0;
      const newWidth = Math.max(180, Math.min(500, e.clientX - containerLeft));
      el.panelLeft.style.width = `${newWidth}px`;
      localStorage.setItem('dosbox_col_left_width', newWidth.toString());
    } else if (isDraggingRight) {
      const containerRight = el.panelRight.parentElement?.getBoundingClientRect().right || window.innerWidth;
      const newWidth = Math.max(240, Math.min(550, containerRight - e.clientX));
      el.panelRight.style.width = `${newWidth}px`;
      localStorage.setItem('dosbox_col_right_width', newWidth.toString());
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDraggingLeft || isDraggingRight) {
      isDraggingLeft = false;
      isDraggingRight = false;
      el.resizerLeft.classList.remove('dragging');
      el.resizerRight.classList.remove('dragging');
      document.body.style.cursor = '';
    }
  });
}

function loadSavedColumnWidths() {
  const leftW = localStorage.getItem('dosbox_col_left_width');
  if (leftW) {
    el.panelLeft.style.width = `${leftW}px`;
  }
  const rightW = localStorage.getItem('dosbox_col_right_width');
  if (rightW) {
    el.panelRight.style.width = `${rightW}px`;
  }
}

// --------------------------------------------------------------------------
// RENDER GAME LIST (LEFT COLUMN)
// --------------------------------------------------------------------------
function renderGameList() {
  const filter = el.folderFilterInput.value.trim().toLowerCase();
  const view = el.libraryViewSelect.value;
  const viewGames = games.filter(game => {
    if (view === 'favorites') return game.favorite === true;
    if (view === 'recent') return typeof game.lastPlayed === 'number';
    if (view === 'needs-attention') return game.installationState === 'needs-attention' || game.installationState === 'broken';
    return true;
  });
  if (view === 'recent') viewGames.sort((left, right) => (right.lastPlayed || 0) - (left.lastPlayed || 0));
  const filtered = viewGames.filter(g => 
    g.title.toLowerCase().includes(filter) || 
    (g.executable && g.executable.toLowerCase().includes(filter)) ||
    (g.workingDir && g.workingDir.toLowerCase().includes(filter)) ||
    (g.drives.cDrivePath && g.drives.cDrivePath.toLowerCase().includes(filter)) ||
    filter === 'c:\\games\\' || filter === 'c:\\' || filter === ''
  );

  el.sbCountText.textContent = `${filtered.length}/${games.length} Games`;
  el.gameListBox.innerHTML = '';

  if (filtered.length === 0) {
    el.gameListBox.innerHTML = `
      <div style="padding: 8px; text-align: center; color: #666; font-size:14px">
        No installed games.<br/>Use <b>Catalog</b> or click <b>📄</b> to load one from disk.
      </div>
    `;
    return;
  }

  filtered.forEach(game => {
    const item = document.createElement('div');
    item.className = `game-list-item ${game.id === selectedGameId ? 'selected' : ''}`;

    const initials = game.title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() || '')
      .join('') || 'DOS';

    item.innerHTML = `
      <div class="game-thumb-box">
        <span class="game-thumb-fallback">${escapeHtml(initials)}</span>
        <img class="game-thumb-img" alt="${escapeHtml(game.title)} artwork" hidden />
      </div>
      <div class="game-list-copy">
        <div class="game-title-text">${escapeHtml(game.title)}</div>
        <div class="game-list-meta">${game.favorite ? '★ ' : ''}${escapeHtml(game.executable)}${game.lastPlayed ? ` · ${formatPlayTime(game.playTimeSeconds)}` : ''}</div>
      </div>
      <button class="game-list-play" type="button" aria-label="Play ${escapeHtml(game.title)}">
        ${launchingGameId === game.id ? '…' : '▶'}
      </button>
    `;

    item.addEventListener('click', () => {
      soundFX.playButtonClick();
      selectedGameId = game.id;
      renderGameList();
      renderSelectedGame();
    });

    item.addEventListener('dblclick', () => {
      void launchGameDirect(game);
    });

    item.addEventListener('contextmenu', event => {
      event.preventDefault();
      selectedGameId = game.id;
      renderGameList();
      renderSelectedGame();
      showGameContextMenu(event.clientX, event.clientY, game);
    });

    const playButton = item.querySelector('.game-list-play') as HTMLButtonElement;
    playButton.disabled = launchingGameId !== null;
    playButton.addEventListener('click', event => {
      event.stopPropagation();
      void launchGameDirect(game);
    });

    const thumbImage = item.querySelector('.game-thumb-img') as HTMLImageElement;
    const thumbFallback = item.querySelector('.game-thumb-fallback') as HTMLSpanElement;
    ArtworkService.loadInto(
      thumbImage,
      ArtworkService.candidates(game),
      url => {
        thumbFallback.hidden = true;
        persistResolvedArtwork(game, url);
      },
      () => { thumbFallback.hidden = false; }
    );

    el.gameListBox.appendChild(item);
  });
}

// --------------------------------------------------------------------------
// RENDER SELECTED GAME
// --------------------------------------------------------------------------
/** DOSBox drives, CPU, scaler and sound cards mean nothing to ScummVM, which
 *  manages its own engine settings, so those panels are hidden for its games. */
function applyEngineSpecificUi(game: GameProfile) {
  const isScummvm = (game.settings.emulatorType || prefs.activeEmulator) === 'scummvm';
  el.panelDrives.style.display = isScummvm ? 'none' : '';
  el.panelDosboxConfig.style.display = isScummvm ? 'none' : '';
  el.btnLaunchFileManager.style.display = isScummvm ? 'none' : '';
  el.btnChooseExecutable.style.display = isScummvm ? 'none' : '';
  if (isScummvm) {
    el.btnLaunchSetup.style.display = 'none';
  }
}

function renderSelectedGame() {
  const game = getSelectedGame();
  if (!game) {
    el.centerCoverImage.hidden = true;
    el.centerCoverImage.removeAttribute('src');
    el.centerCoverPlaceholder.hidden = false;
    el.centerCoverPlaceholder.textContent = 'DOS';
    el.centerTitle.textContent = 'NO GAME SELECTED';
    el.centerPath.textContent = 'Install from Catalog or load from disk';
    el.centerDev.textContent = 'Developer: -';
    el.centerStatus.textContent = 'Status: Idle';
    el.centerGenre.textContent = 'Only real local installations are shown';
    el.floppyDisplay.textContent = '[None]';
    el.cdRomDisplay.textContent = '[None]';
    el.sbSelectedText.textContent = 'No Game Selected';
    el.sbCpuText.textContent = 'CPU: -';
    el.btnRunDosGame.disabled = true;
    el.btnToggleFavorite.disabled = true;
    el.btnDiagnoseGame.disabled = true;
    el.btnGameControls.disabled = true;
    el.btnLaunchFileManager.disabled = true;
    el.btnLaunchSetup.style.display = 'none';
    el.btnUnpackGameArchive.style.display = 'none';
    el.panelDrives.style.display = '';
    el.panelDosboxConfig.style.display = '';
    el.btnLaunchFileManager.style.display = '';
    el.btnChooseExecutable.style.display = '';
    if (el.lblRunDosGame) el.lblRunDosGame.textContent = 'RUN GAME';
    return;
  }

  applyEngineSpecificUi(game);

  // Center Showcase
  el.centerCoverPlaceholder.textContent = game.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'DOS';
  el.centerCoverPlaceholder.hidden = false;
  el.centerCoverImage.alt = `${game.title} artwork`;
  ArtworkService.loadInto(
    el.centerCoverImage,
    ArtworkService.candidates(game),
    url => {
      el.centerCoverPlaceholder.hidden = true;
      persistResolvedArtwork(game, url);
    },
    () => { el.centerCoverPlaceholder.hidden = false; }
  );
  el.centerTitle.textContent = game.title.toUpperCase();
  const folder = game.workingDir ? `C:\\GAMES\\${game.workingDir.toUpperCase()}\\` : 'C:\\GAMES\\';
  el.centerPath.textContent = `${folder}${game.executable.toUpperCase()}`;
  el.centerDev.textContent = `Developer: ${game.developer || 'Unknown'}`;
  const stateLabel = game.installationState === 'needs-attention' || game.installationState === 'broken'
    ? 'Needs attention'
    : 'Ready';
  const confidenceLabel = game.compatibilityConfidence
    ? ` · profile ${game.compatibilityConfidence.toUpperCase()}`
    : '';
  el.centerStatus.textContent = `Status: ${stateLabel}${confidenceLabel}`;
  el.centerStatus.title = game.compatibilityReason || '';
  el.centerGenre.textContent = `${game.year || 'Unknown year'} · ${game.genre || 'DOS game'} · ${game.playCount || 0} launches · ${formatPlayTime(game.playTimeSeconds)}`;
  el.btnToggleFavorite.disabled = false;
  el.btnDiagnoseGame.disabled = false;
  el.btnGameControls.disabled = false;
  el.btnToggleFavorite.textContent = game.favorite ? '★ FAVORITE' : '☆ FAVORITE';

  // Drives Panel
  const managedFloppies = (game.drives.mediaSets || []).flatMap(set => set.items.filter(item => item.kind === 'floppy'));
  if (managedFloppies.length > 0) {
    el.floppyDisplay.textContent = `[${managedFloppies.length} DISK${managedFloppies.length === 1 ? '' : 'S'}]`;
    el.floppyDisplay.style.color = '#008000';
  } else if (game.drives.floppyPath && game.drives.floppyPath.trim() !== '') {
    const filename = game.drives.floppyPath.split('/').pop() || game.drives.floppyPath;
    el.floppyDisplay.textContent = `[${filename}]`;
    el.floppyDisplay.style.color = '#008000';
  } else {
    el.floppyDisplay.textContent = '[None]';
    el.floppyDisplay.style.color = '#555';
  }

  const managedCds = (game.drives.mediaSets || []).flatMap(set => set.items.filter(item => item.kind === 'cdrom' || item.kind === 'directory'));
  if (managedCds.length > 0) {
    el.cdRomDisplay.textContent = `[${managedCds.length} CD${managedCds.length === 1 ? '' : 'S'}]`;
    el.cdRomDisplay.style.color = '#008000';
  } else if (game.drives.cdRomPath && game.drives.cdRomPath.trim() !== '') {
    const filename = game.drives.cdRomPath.split('/').pop() || game.drives.cdRomPath;
    el.cdRomDisplay.textContent = `[${filename}]`;
    el.cdRomDisplay.style.color = '#008000';
  } else {
    el.cdRomDisplay.textContent = '[None]';
    el.cdRomDisplay.style.color = '#555';

    if (game.drives.cDrivePath && EmulatorLauncher.isTauriEnvironment()) {
      EmulatorLauncher.prepareGame(game).then(prepared => {
        if (prepared.drives.cdRomPath && prepared.drives.cdRomPath !== game.drives.cdRomPath) {
          game.drives.cdRomPath = prepared.drives.cdRomPath;
          StorageService.saveGames(games);
          const fname = game.drives.cdRomPath.split('/').pop() || game.drives.cdRomPath;
          el.cdRomDisplay.textContent = `[${fname}]`;
          el.cdRomDisplay.style.color = '#008000';
        }
      }).catch(() => {});
    }
  }

  // Settings Panel
  const s = game.settings;
  const cyclesNum = typeof s.cycles === 'number' ? s.cycles : 15000;
  el.cyclesRange.value = cyclesNum.toString();
  el.cyclesValueDisplay.textContent = typeof s.cycles === 'number' ? `${s.cycles} cycles` : s.cycles.toUpperCase();

  el.selMachine.value = s.machine;
  el.selScaler.value = s.scaler;
  el.selSoundCard.value = s.soundBlaster;
  el.selPort.value = s.sbPort;
  el.selIrq.value = s.sbIrq.toString();
  el.selDma.value = s.sbDma.toString();
  el.chkMidi.checked = s.enableMidi;
  el.chkFullscreenGame.checked = s.fullscreen === true;

  // Status Bar
  el.sbSelectedText.textContent = `${game.title.toUpperCase()} - Selected`;
  el.sbCpuText.textContent = `CPU: Normal [${s.cycles}]`;
  el.btnRunDosGame.disabled = launchingGameId !== null;
  el.btnLaunchFileManager.disabled = launchingGameId !== null;
  void updateGameActionButtons(game);
}

function persistResolvedArtwork(game: GameProfile, url: string) {
  if (game.coverImage === url) return;
  game.coverImage = url;
  StorageService.saveGames(games);
  if (prefs.automaticArtwork && ArtworkService.isRemoteArtwork(url) && !artworkCacheInFlight.has(game.id)) {
    artworkCacheInFlight.add(game.id);
    void ArtworkService.cache(game.id, url).then(localUrl => {
      if (localUrl && game.coverImage === url) {
        game.coverImage = localUrl;
        StorageService.saveGames(games);
      }
    }).finally(() => artworkCacheInFlight.delete(game.id));
  }
}

async function handleSetArtwork() {
  const game = getSelectedGame();
  if (!game) {
    alert('Select a game first.');
    return;
  }
  if (!EmulatorLauncher.isTauriEnvironment()) return;
  soundFX.playButtonClick();

  const picked = await EmulatorLauncher.browseForFile({
    title: `Select cover image for "${game.title}"`,
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']
  });
  if (!picked) return;

  try {
    const assetUrl = await ArtworkService.importLocalFile(game.id, picked);
    if (!assetUrl) {
      alert('Could not import that image.');
      return;
    }
    game.coverImage = assetUrl;
    StorageService.saveGames(games);
    renderGameList();
    renderSelectedGame();
    el.centerStatus.textContent = 'Status: Artwork updated';
  } catch (err) {
    soundFX.playPcSpeakerBeep(260, 0.25);
    alert(`Could not set artwork:\n${String(err)}`);
  }
}

async function launchGameDirect(requestedGame: GameProfile) {
  if (launchingGameId) return;

  selectedGameId = requestedGame.id;
  let game = requestedGame;
  if (game.catalogIdentifier || game.id.startsWith('game_')) {
    const configured = applyAutomaticCompatibilityProfile(game, prefs.activeEmulator);
    if (configured !== game) {
      games = games.map(item => item.id === configured.id ? configured : item);
      game = configured;
      StorageService.saveGames(games);
    }
  }

  launchingGameId = game.id;
  renderSelectedGame();
  el.centerStatus.textContent = 'Status: Starting…';
  el.btnRunDosGame.disabled = true;
  el.btnRunDosGame.querySelector('span:last-child')!.textContent = 'STARTING…';
  renderGameList();
  soundFX.playLaunchChime();

  const res = await EmulatorLauncher.launchGame(game, prefs);
  launchingGameId = null;

  if (res.success) {
    game.lastPlayed = Date.now();
    game.playCount = (game.playCount || 0) + 1;
    StorageService.saveGames(games);
    el.centerStatus.textContent = 'Status: Running';
    el.sbSelectedText.textContent = `${game.title.toUpperCase()} - Running`;
  } else {
    soundFX.playPcSpeakerBeep(260, 0.25);
    el.centerStatus.textContent = 'Status: Launch failed';
    el.launchHeaderMsg.textContent = res.message;
    el.launchCmdBox.value = res.commandExecuted || '';
    el.launchConfBox.textContent = res.confGenerated || generateDosboxConf(game);
    el.modalLaunch.classList.add('open');
  }

  el.btnRunDosGame.querySelector('span:last-child')!.textContent = 'RUN GAME';
  renderGameList();
  el.btnRunDosGame.disabled = false;
}

async function updateGameActionButtons(game: GameProfile) {
  if (!EmulatorLauncher.isTauriEnvironment() || !game.drives.cDrivePath) {
    el.btnUnpackGameArchive.style.display = 'none';
    el.btnLaunchFileManager.disabled = false;
    el.btnLaunchSetup.style.display = 'none';
    if (el.lblRunDosGame) el.lblRunDosGame.textContent = 'RUN GAME';
    return;
  }

  // 1. Check archives in game folder or executable path
  let archives: import('./types').DiscoveredArchiveItem[] = [];
  try {
    archives = await EmulatorLauncher.scanGameArchives(game.drives.cDrivePath);
    if (
      archives.length === 0 &&
      (game.executable.toLowerCase().endsWith('.zip') ||
        game.executable.toLowerCase().includes('package'))
    ) {
      const fullPath = `${game.drives.cDrivePath}/${game.executable}`;
      const single = await EmulatorLauncher.scanGameArchives(fullPath);
      if (single.length > 0) archives = single;
    }
    selectedGameArchives = archives;
    if (archives.length > 0) {
      el.btnUnpackGameArchive.style.display = 'inline-flex';
      el.btnUnpackGameArchive.title = `Unpack archive (${archives[0].fileName})`;
      if (
        game.installationState === 'needs-attention' ||
        game.executable.toLowerCase().endsWith('.zip') ||
        game.executable.toLowerCase().includes('package')
      ) {
        el.centerStatus.textContent = `Status: 📦 Package archive · Click Unpack to extract`;
        if (el.lblRunDosGame) el.lblRunDosGame.textContent = 'UNPACK & PLAY';
      } else {
        if (el.lblRunDosGame) el.lblRunDosGame.textContent = 'RUN GAME';
      }
    } else {
      el.btnUnpackGameArchive.style.display = 'none';
      if (el.lblRunDosGame) el.lblRunDosGame.textContent = 'RUN GAME';
    }
  } catch {
    selectedGameArchives = [];
    el.btnUnpackGameArchive.style.display = 'none';
    if (el.lblRunDosGame) el.lblRunDosGame.textContent = 'RUN GAME';
  }

  // 2. Check setup/installer candidates
  try {
    const candidates = await EmulatorLauncher.inspectGameFolder(game.drives.cDrivePath);
    const setupCandidate = candidates.find(c => c.role === 'installer' || c.role === 'configuration');
    selectedGameSetupCandidate = setupCandidate || null;
    if (setupCandidate) {
      el.btnLaunchSetup.style.display = 'inline-flex';
      el.btnLaunchSetup.title = `Run ${setupCandidate.executable}`;
    } else {
      el.btnLaunchSetup.style.display = 'none';
    }
  } catch {
    selectedGameSetupCandidate = null;
    el.btnLaunchSetup.style.display = 'none';
  }
}

async function launchFileManagerDirect(requestedGame: GameProfile) {
  if (launchingGameId) return;
  selectedGameId = requestedGame.id;
  const game = requestedGame;

  launchingGameId = game.id;
  renderSelectedGame();
  el.centerStatus.textContent = 'Status: Starting DOS File Manager…';
  el.btnRunDosGame.disabled = true;
  el.btnLaunchFileManager.disabled = true;
  soundFX.playLaunchChime();

  const res = await EmulatorLauncher.launchFileManager(game, prefs);
  launchingGameId = null;
  el.btnLaunchFileManager.disabled = false;
  el.btnRunDosGame.disabled = false;

  if (res.success) {
    el.centerStatus.textContent = 'Status: DOS File Manager Running';
    el.sbSelectedText.textContent = `${game.title.toUpperCase()} - File Manager`;
  } else {
    soundFX.playPcSpeakerBeep(260, 0.25);
    el.centerStatus.textContent = 'Status: Launch failed';
    el.launchHeaderMsg.textContent = res.message;
    el.launchCmdBox.value = res.commandExecuted || '';
    el.launchConfBox.textContent = res.confGenerated || '';
    el.modalLaunch.classList.add('open');
  }
  renderGameList();
}

async function launchSetupDirect(
  requestedGame: GameProfile,
  candidate: import('./services/emulatorLauncher').ExecutableCandidate
) {
  if (launchingGameId) return;
  selectedGameId = requestedGame.id;
  const game = requestedGame;

  activeSetupLaunchGameId = game.id;
  launchingGameId = game.id;
  renderSelectedGame();
  el.centerStatus.textContent = `Status: Starting ${candidate.executable}…`;
  el.btnRunDosGame.disabled = true;
  el.btnLaunchSetup.disabled = true;
  soundFX.playLaunchChime();

  const res = await EmulatorLauncher.launchInstaller(game, candidate.executable, candidate.workingDir, prefs);
  launchingGameId = null;
  el.btnLaunchSetup.disabled = false;
  el.btnRunDosGame.disabled = false;

  if (res.success) {
    el.centerStatus.textContent = `Status: Running ${candidate.executable}`;
    el.sbSelectedText.textContent = `${game.title.toUpperCase()} - Setup`;
  } else {
    soundFX.playPcSpeakerBeep(260, 0.25);
    el.centerStatus.textContent = 'Status: Launch failed';
    el.launchHeaderMsg.textContent = res.message;
    el.launchCmdBox.value = res.commandExecuted || '';
    el.launchConfBox.textContent = res.confGenerated || '';
    el.modalLaunch.classList.add('open');
  }
  renderGameList();
}

async function unpackArchiveDirect(game: GameProfile, archivePath: string) {
  if (!EmulatorLauncher.isTauriEnvironment()) return;
  soundFX.playButtonClick();

  let destinationFolder = game.drives.cDrivePath;
  const isDirectFile =
    archivePath === game.drives.cDrivePath ||
    !destinationFolder ||
    destinationFolder === prefs.defaultCDrive;
  if (isDirectFile) {
    const cleanSubdir =
      game.title.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'GAME';
    const baseDir = prefs.defaultCDrive || '~/DOSGAMES';
    destinationFolder = `${baseDir}/${cleanSubdir}`;
  }

  el.centerStatus.textContent = 'Status: ⏳ Unpacking package archive…';
  el.btnUnpackGameArchive.disabled = true;
  if (el.lblRunDosGame) el.lblRunDosGame.textContent = 'UNPACKING…';

  try {
    const res = await EmulatorLauncher.unpackGameArchive(
      archivePath,
      destinationFolder,
      true,
      prefs.deleteArchiveAfterUnpack === true
    );

    el.btnUnpackGameArchive.disabled = false;
    if (res.success) {
      soundFX.playLaunchChime();
      game.drives.cDrivePath = destinationFolder;
      if (res.discoveredCdRomPath) {
        game.drives.cdRomPath = res.discoveredCdRomPath;
      }
      if (res.discoveredExecutable) {
        game.executable = res.discoveredExecutable;
        if (res.discoveredWorkingDir !== undefined) {
          game.workingDir = res.discoveredWorkingDir;
        }
      }
      if (res.discoveredTitle && res.discoveredTitle.trim() !== '') {
        game.title = res.discoveredTitle.trim();
      }

      // No DOS executable can still mean a playable game: GOG's Mac releases of
      // adventure titles ship ScummVM data. Ask ScummVM before giving up.
      let scummvmNote = '';
      if (!res.discoveredExecutable) {
        const detected = await EmulatorLauncher.detectScummvmGame(
          prefs.scummvmPath,
          destinationFolder
        ).catch(() => null);
        if (detected) {
          game.settings.emulatorType = 'scummvm';
          game.scummvmGameId = detected.gameId;
          if (detected.path && detected.path.trim() !== '') {
            game.drives.cDrivePath = detected.path;
          }
          game.executable = '';
          game.workingDir = '';
          game.drives.cdRomPath = '';
          game.compatibilityReason = `ScummVM game '${detected.gameId}'`;
          scummvmNote = `\n\n🎮 Recognised by ScummVM as:\n${detected.description}`;
        }
      }

      game.installationState = 'ready';
      game.compatibilityConfidence = 'high';
      if (!game.compatibilityReason?.startsWith('ScummVM')) {
        game.compatibilityReason = 'Extracted package archive';
      }
      StorageService.saveGames(games);
      renderGameList();
      renderSelectedGame();
      alert(`Package extracted successfully! Extracted ${res.extractedFilesCount} file(s) into:\n${destinationFolder}${res.discoveredCdRomPath ? `\n\n💿 Auto-mounted CD-ROM media:\n${res.discoveredCdRomPath}` : ''}${scummvmNote}`);
    } else {
      soundFX.playPcSpeakerBeep(260, 0.25);
      alert(`Failed to unpack archive:\n${res.message}`);
      renderSelectedGame();
    }
  } catch (err) {
    el.btnUnpackGameArchive.disabled = false;
    soundFX.playPcSpeakerBeep(260, 0.25);
    alert(`Error unpacking archive: ${String(err)}`);
    renderSelectedGame();
  }
}

async function checkPostInstallCandidates(game: GameProfile) {
  if (!EmulatorLauncher.isTauriEnvironment() || !game.drives.cDrivePath) return;
  try {
    const candidates = await EmulatorLauncher.inspectGameFolder(game.drives.cDrivePath);
    const gameExecutables = candidates.filter(c => c.role === 'game');
    if (gameExecutables.length === 0) return;

    const currentIsInstaller = candidates.some(
      c => c.executable.toLowerCase() === game.executable.toLowerCase() && (c.role === 'installer' || c.role === 'configuration')
    );
    const topCandidate = gameExecutables[0];

    if (currentIsInstaller || (topCandidate && topCandidate.executable.toLowerCase() !== game.executable.toLowerCase())) {
      showExecutablePicker(
        game,
        gameExecutables,
        `Installation / configuration of "${game.title}" finished. We detected newly configured game executables in this folder:`
      );
    }
  } catch (err) {
    console.warn('Failed to inspect game folder after install:', err);
  }
}

/** Lists executables for a game and lets the user pick which one launches it. */
function showExecutablePicker(
  game: GameProfile,
  candidates: import('./services/emulatorLauncher').ExecutableCandidate[],
  description: string,
  title = '🎉 Installation / Setup Complete'
) {
  el.postInstallTitle.textContent = title;
  postInstallTargetGame = game;
  const current = candidates.find(
    c => c.executable.toLowerCase() === game.executable.toLowerCase()
  );
  postInstallSelectedCandidate = current || candidates[0];
  el.postInstallDesc.textContent = description;
  el.postInstallCandidatesList.innerHTML = '';

  candidates.forEach(cand => {
    const isCurrent = cand === postInstallSelectedCandidate;
    const row = document.createElement('div');
    row.className = `post-install-candidate ${isCurrent ? 'selected' : ''}`;
    const roleLabel = cand.role === 'game' ? '' : ` · ${cand.role}`;
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(cand.executable)}</strong>${isCurrent ? ' <span style="opacity:0.7">(current)</span>' : ''}
        ${cand.workingDir ? `<small style="display:block; opacity:0.8;">Working dir: ${escapeHtml(cand.workingDir)}</small>` : ''}
      </div>
      <span style="font-size:11px; opacity:0.8;">${escapeHtml((cand.reason || 'Game') + roleLabel)}</span>
    `;
    row.addEventListener('click', () => {
      el.postInstallCandidatesList.querySelectorAll('.post-install-candidate').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      postInstallSelectedCandidate = cand;
    });
    el.postInstallCandidatesList.appendChild(row);
  });

  el.modalPostInstall.classList.add('open');
}

/** Opens the picker on demand so a game's launch target can be corrected. */
async function chooseGameExecutable() {
  const game = getSelectedGame();
  if (!game) {
    alert('Select a game first.');
    return;
  }
  if ((game.settings.emulatorType || prefs.activeEmulator) === 'scummvm') {
    alert('ScummVM games are launched by engine id, not by an executable.');
    return;
  }
  if (!game.drives.cDrivePath) {
    alert('This game has no folder configured yet.');
    return;
  }
  soundFX.playButtonClick();
  try {
    // Everything runnable is offered, not just the best guess: the automatic
    // pick is what the user is here to override.
    const candidates = await EmulatorLauncher.inspectGameFolder(game.drives.cDrivePath);
    if (candidates.length === 0) {
      alert('No EXE, COM or BAT file was found in this game folder.');
      return;
    }
    showExecutablePicker(
      game,
      candidates,
      `Choose which file starts "${game.title}".`,
      '🎯 Choose Launch File'
    );
  } catch (error) {
    alert(`Could not inspect the game folder:\n${String(error)}`);
  }
}

function showGameContextMenu(x: number, y: number, game: GameProfile) {
  const existing = document.getElementById('retroGameContextMenu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'retroGameContextMenu';
  menu.className = 'win-outset';
  menu.style.position = 'fixed';
  menu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 220)}px`;
  menu.style.zIndex = '99999';
  menu.style.background = 'var(--win-btn-face, #c0c0c0)';
  menu.style.padding = '2px';
  menu.style.minWidth = '210px';
  menu.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.5)';
  menu.style.fontFamily = 'var(--font-retro)';
  menu.style.fontSize = '13px';

  const addItem = (label: string, icon: string, action: () => void, disabled = false) => {
    const item = document.createElement('div');
    item.style.padding = '4px 8px';
    item.style.cursor = disabled ? 'default' : 'pointer';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '8px';
    item.style.opacity = disabled ? '0.5' : '1';
    item.innerHTML = `<span>${icon}</span><span>${escapeHtml(label)}</span>`;
    if (!disabled) {
      item.addEventListener('mouseenter', () => {
        item.style.background = '#004080';
        item.style.color = '#ffffff';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
        item.style.color = 'inherit';
      });
      item.addEventListener('click', () => {
        menu.remove();
        action();
      });
    }
    menu.appendChild(item);
  };

  const addDivider = () => {
    const div = document.createElement('div');
    div.style.borderTop = '1px solid var(--win-shadow, #808080)';
    div.style.borderBottom = '1px solid var(--win-light, #ffffff)';
    div.style.margin = '2px 0';
    menu.appendChild(div);
  };

  addItem(`Play ${game.title}`, '▶', () => void launchGameDirect(game));
  addItem('Open in DOS File Manager (NC)', '📁', () => void launchFileManagerDirect(game));
  if (selectedGameSetupCandidate) {
    addItem(`Run Setup (${selectedGameSetupCandidate.executable})`, '⚙️', () => {
      if (selectedGameSetupCandidate) void launchSetupDirect(game, selectedGameSetupCandidate);
    });
  }
  if (selectedGameArchives.length > 0) {
    addItem(`Unpack Archive (${selectedGameArchives[0].fileName})`, '📦', () => {
      if (selectedGameArchives[0]) void unpackArchiveDirect(game, selectedGameArchives[0].filePath);
    });
  }
  addDivider();
  if (game.drives.cDrivePath) {
    addItem('Reveal Folder in Finder', '🗂️', async () => {
      if (EmulatorLauncher.isTauriEnvironment()) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('open_folder_in_finder', { folderPath: game.drives.cDrivePath });
        } catch (e) {
          console.warn('Failed to open folder:', e);
        }
      }
    });
  }
  addItem(game.favorite ? 'Remove from Favorites' : 'Add to Favorites', '★', () => {
    game.favorite = !game.favorite;
    StorageService.saveGames(games);
    renderGameList();
    renderSelectedGame();
  });
  addItem('Remove Game', '🗑️', () => {
    if (confirm(`Delete "${game.title}" from library?`)) {
      soundFX.playButtonClick();
      games = games.filter(g => g.id !== game.id);
      selectedGameId = games.length > 0 ? games[0].id : null;
      StorageService.saveGames(games);
      renderGameList();
      renderSelectedGame();
    }
  });

  document.body.appendChild(menu);

  const closeMenu = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('contextmenu', closeMenu);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
    document.addEventListener('contextmenu', closeMenu);
  }, 10);
}

function saveActiveGameSettings() {
  const game = getSelectedGame();
  if (!game) return;

  const cyclesVal = parseInt(el.cyclesRange.value, 10);
  game.settings.cycles = cyclesVal;
  el.cyclesValueDisplay.textContent = `${cyclesVal} cycles`;

  game.settings.machine = el.selMachine.value as MachineType;
  game.settings.scaler = el.selScaler.value as ScalerType;
  game.settings.soundBlaster = el.selSoundCard.value as SoundBlasterType;
  game.settings.sbPort = el.selPort.value;
  game.settings.sbIrq = parseInt(el.selIrq.value, 10);
  game.settings.sbDma = parseInt(el.selDma.value, 10);
  game.settings.enableMidi = el.chkMidi.checked;
  game.settings.fullscreen = el.chkFullscreenGame.checked;
  game.settings.settingsLocked = true;
  game.compatibilityReason = 'User-customized settings';

  StorageService.saveGames(games);
  el.sbCpuText.textContent = `CPU: Normal [${game.settings.cycles}]`;
}

function renderDiagnosticItems(container: HTMLElement, items: Array<{ status: string; label: string; message: string }>) {
  container.innerHTML = '';
  if (items.length === 0) {
    container.innerHTML = '<div class="diagnostic-item warning"><span class="diagnostic-mark">…</span><b>Waiting</b><small>Run the check to inspect this system.</small></div>';
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = `diagnostic-item ${item.status}`;
    const mark = item.status === 'ok' ? '✓' : item.status === 'warning' ? '!' : '✕';
    row.innerHTML = `<span class="diagnostic-mark">${mark}</span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.message)}</small>`;
    container.appendChild(row);
  }
}

function openSetupWizard() {
  el.setupLibraryPath.value = prefs.defaultCDrive || '~/DOSGAMES';
  renderDiagnosticItems(el.setupCheckResults, []);
  el.modalSetupWizard.classList.add('open');
  void runSetupChecks();
}

async function runSetupChecks() {
  el.btnSetupRunChecks.disabled = true;
  el.btnSetupRunChecks.textContent = 'CHECKING…';
  const checks: Array<{ status: string; label: string; message: string }> = [];
  const installations = await EmulatorLauncher.detectInstallations();
  const available = installations.filter(item => item.exists);
  checks.push(available.length > 0
    ? { status: 'ok', label: 'DOSBox emulator', message: available.map(item => item.name).join(', ') }
    : { status: 'error', label: 'DOSBox emulator', message: 'No supported DOSBox installation was found.' });
  const libraryPath = el.setupLibraryPath.value || prefs.defaultCDrive;
  if (EmulatorLauncher.isTauriEnvironment()) {
    try {
      const discovered = await EmulatorLauncher.scanInstalledGames(libraryPath);
      checks.push({ status: 'ok', label: 'Game library', message: `${libraryPath} · ${discovered.length} real game folder(s) detected` });
    } catch (error) {
      checks.push({ status: 'error', label: 'Game library', message: String(error) });
    }
  } else {
    checks.push({ status: 'warning', label: 'Native features', message: 'Browser preview cannot launch or install games.' });
  }
  checks.push({ status: 'ok', label: 'Sample data', message: 'No sample games will be created.' });
  renderDiagnosticItems(el.setupCheckResults, checks);
  el.btnFinishSetup.disabled = checks.some(item => item.status === 'error');
  el.btnSetupRunChecks.disabled = false;
  el.btnSetupRunChecks.textContent = 'RUN SYSTEM CHECK';
}

async function openGameDiagnostics() {
  const game = getSelectedGame();
  if (!game) return;
  el.diagnosticsGameTitle.textContent = game.title.toUpperCase();
  renderDiagnosticItems(el.diagnosticsResults, []);
  el.modalDiagnostics.classList.add('open');
  const results = await EmulatorLauncher.diagnoseGame(game, prefs);
  renderDiagnosticItems(el.diagnosticsResults, results);
  const diagnosticStatus = results.some(item => item.status === 'error')
    ? 'error'
    : results.some(item => item.status === 'warning') ? 'warning' : 'ok';
  game.installationState = diagnosticStatus === 'error' ? 'needs-attention' : 'ready';
  StorageService.saveGames(games);
  if (EmulatorLauncher.isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('database_save_diagnostics', {
        gameId: game.id,
        status: diagnosticStatus,
        payloadJson: JSON.stringify(results)
      });
    } catch (error) {
      console.warn('Could not persist diagnostic result:', error);
    }
  }
  renderGameList();
}

async function autoRepairSelectedGame() {
  const game = getSelectedGame();
  if (!game) return;
  el.btnAutoRepairGame.disabled = true;
  el.btnAutoRepairGame.textContent = 'REPAIRING…';
  await ensureAvailableEmulatorIsConfigured();
  try {
    const candidates = await EmulatorLauncher.inspectGameFolder(game.drives.cDrivePath);
    const best = candidates.find(candidate => candidate.role === 'game' && candidate.score > 0);
    if (best) {
      game.executable = best.executable;
      game.workingDir = best.workingDir;
    }
    if (!game.settings.settingsLocked) {
      const recommended = recommendedSettingsForGame(game, prefs.activeEmulator);
      game.settings = { ...recommended, settingsLocked: false };
      game.compatibilityProfileVersion = COMPATIBILITY_PROFILE_VERSION;
      game.compatibilityConfidence = best && best.score >= 200 ? 'high' : 'medium';
      game.compatibilityReason = best?.reason || 'Safe defaults based on title, year and genre';
    }
    game.installationState = 'ready';
    StorageService.saveGames(games);
    renderSelectedGame();
    await openGameDiagnostics();
  } catch (error) {
    renderDiagnosticItems(el.diagnosticsResults, [{ status: 'error', label: 'Automatic repair', message: String(error) }]);
  } finally {
    el.btnAutoRepairGame.disabled = false;
    el.btnAutoRepairGame.textContent = 'REPAIR AUTOMATICALLY';
  }
}

function mediaItemFromPath(path: string, kind: MediaItem['kind'], index: number): MediaItem {
  return {
    id: `${kind}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    path,
    discNumber: index + 1,
    label: path.split('/').pop() || `${kind} ${index + 1}`
  };
}

function openMediaManager() {
  const game = getSelectedGame();
  if (!game) return;
  const sets = game.drives.mediaSets || [];
  const cdSet = sets.find(set => set.items.some(item => item.kind === 'cdrom' || item.kind === 'directory'));
  const floppySet = sets.find(set => set.items.some(item => item.kind === 'floppy'));
  editingCdMedia = cdSet
    ? cdSet.items.map(item => ({ ...item }))
    : game.drives.cdRomPath ? [mediaItemFromPath(game.drives.cdRomPath, 'cdrom', 0)] : [];
  editingFloppyMedia = floppySet
    ? floppySet.items.map(item => ({ ...item }))
    : game.drives.floppyPath ? [mediaItemFromPath(game.drives.floppyPath, 'floppy', 0)] : [];
  el.mediaCdMode.value = cdSet?.mode || (editingCdMedia.length > 1 ? 'swap' : 'single');
  el.mediaDriveLetter.value = cdSet?.driveLetter || 'D';
  el.mediaManagerStatus.textContent = 'Images are validated when the set is saved and before every launch.';
  renderMediaManagerLists();
  el.modalMediaManager.classList.add('open');
}

function renderMediaManagerLists() {
  const render = (container: HTMLElement, items: MediaItem[], kind: 'cd' | 'floppy') => {
    container.innerHTML = '';
    if (items.length === 0) {
      container.innerHTML = '<div class="media-item-row"><span>—</span><span>No media selected</span><span></span></div>';
      return;
    }
    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'media-item-row';
      row.innerHTML = `<span>${index + 1}</span><span title="${escapeHtml(item.path)}">${escapeHtml(item.label || item.path)}</span><button class="btn-3d" type="button">REMOVE</button>`;
      row.querySelector('button')!.addEventListener('click', () => {
        if (kind === 'cd') editingCdMedia.splice(index, 1);
        else editingFloppyMedia.splice(index, 1);
        renderMediaManagerLists();
      });
      container.appendChild(row);
    });
  };
  render(el.cdMediaList, editingCdMedia, 'cd');
  render(el.floppyMediaList, editingFloppyMedia, 'floppy');
}

async function saveMediaSets() {
  const game = getSelectedGame();
  if (!game) return;
  const sets = [];
  if (editingCdMedia.length > 0) {
    sets.push({
      id: `media-cd-${game.id}`,
      name: `${game.title} CD-ROM`,
      driveLetter: el.mediaDriveLetter.value,
      mode: el.mediaCdMode.value as 'single' | 'swap' | 'separate-drives',
      items: editingCdMedia.map((item, index) => ({ ...item, discNumber: index + 1 }))
    });
  }
  if (editingFloppyMedia.length > 0) {
    sets.push({
      id: `media-floppy-${game.id}`,
      name: `${game.title} Floppies`,
      driveLetter: 'A',
      mode: (editingFloppyMedia.length > 1 ? 'swap' : 'single') as 'single' | 'swap',
      items: editingFloppyMedia.map((item, index) => ({ ...item, discNumber: index + 1 }))
    });
  }
  game.drives.mediaSets = sets;
  game.drives.cdRomPath = editingCdMedia[0]?.path || '';
  game.drives.floppyPath = editingFloppyMedia[0]?.path || '';
  try {
    await EmulatorLauncher.prepareGame(game);
    game.installationState = 'ready';
    el.mediaManagerStatus.textContent = `✓ ${editingCdMedia.length} CD and ${editingFloppyMedia.length} floppy image(s) verified.`;
    StorageService.saveGames(games);
    renderSelectedGame();
  } catch (error) {
    game.installationState = 'needs-attention';
    el.mediaManagerStatus.textContent = `✕ ${String(error)}`;
    StorageService.saveGames(games);
    return;
  }
  el.modalMediaManager.classList.remove('open');
}

function openControlsManager() {
  const game = getSelectedGame();
  if (!game) return;
  const profile = game.inputProfile || InputProfileService.create('platformer', game.id);
  el.controlsTemplate.value = profile.name.toLowerCase().includes('fps') ? 'fps'
    : profile.name.toLowerCase().includes('racing') ? 'racing'
      : profile.name.toLowerCase().includes('adventure') ? 'adventure'
        : profile.mode === 'native-joystick' ? 'native' : 'platformer';
  el.controlsJoystickType.value = profile.joystickType;
  el.controlsDeadzone.value = profile.deadzone.toString();
  el.controlsDeadzoneValue.textContent = `${profile.deadzone}%`;
  el.controlsAutofire.checked = profile.autofire;
  el.controlsCircular.checked = profile.circularInput;
  el.controlsMapperPreview.textContent = InputProfileService.preview(profile);
  el.modalControls.classList.add('open');
}

function previewControlsTemplate() {
  const game = getSelectedGame();
  if (!game) return;
  const profile = InputProfileService.create(el.controlsTemplate.value, game.id);
  profile.joystickType = el.controlsJoystickType.value as typeof profile.joystickType;
  profile.deadzone = parseInt(el.controlsDeadzone.value, 10);
  profile.autofire = el.controlsAutofire.checked;
  profile.circularInput = el.controlsCircular.checked;
  el.controlsDeadzoneValue.textContent = `${profile.deadzone}%`;
  el.controlsMapperPreview.textContent = InputProfileService.preview(profile);
}

async function saveControlsProfile() {
  const game = getSelectedGame();
  if (!game) return;
  const profile = InputProfileService.create(el.controlsTemplate.value, game.id);
  profile.joystickType = el.controlsJoystickType.value as typeof profile.joystickType;
  profile.deadzone = parseInt(el.controlsDeadzone.value, 10);
  profile.autofire = el.controlsAutofire.checked;
  profile.circularInput = el.controlsCircular.checked;
  profile.mapperFilePath = await InputProfileService.save(game.id, profile);
  game.inputProfile = profile;
  game.settings.mapperFilePath = profile.mapperFilePath;
  game.settings.joystickType = profile.joystickType;
  game.settings.joystickDeadzone = profile.deadzone;
  game.settings.joystickAutofire = profile.autofire;
  game.settings.joystickCircularInput = profile.circularInput;
  StorageService.saveGames(games);
  el.modalControls.classList.remove('open');
}

async function inspectImportFolder(folder: string) {
  el.presetSuggestionsBox.innerHTML = '<div class="preset-empty">Scanning DOS executables…</div>';
  try {
    const candidates = await EmulatorLauncher.inspectGameFolder(folder);
    if (candidates.length === 0) {
      // Adventure games run on ScummVM and have no DOS executable at all.
      const scummvm = await EmulatorLauncher.detectScummvmGame(prefs.scummvmPath, folder)
        .catch(() => null);
      if (scummvm) {
        pendingScummvmGame = scummvm;
        if (scummvm.path && scummvm.path.trim() !== '') {
          el.inputFolder.value = scummvm.path;
        }
        el.inputExecutable.value = '';
        if (!el.inputTitle.value.trim()) el.inputTitle.value = scummvm.description;
        el.presetSuggestionsBox.innerHTML =
          `<div class="preset-empty">🎮 ScummVM game detected: <b>${escapeHtml(scummvm.description)}</b><br>It will run on ScummVM — no DOS executable needed.</div>`;
        return;
      }
      el.presetSuggestionsBox.innerHTML = '<div class="preset-empty">No DOS EXE, COM or BAT file was found.</div>';
      return;
    }
    pendingScummvmGame = null;
    el.presetSuggestionsBox.innerHTML = '';
    for (const candidate of candidates.slice(0, 8)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `preset-suggestion executable-${candidate.role}`;
      button.innerHTML = `<b>${escapeHtml(candidate.executable)}</b><span>${escapeHtml(candidate.reason)}</span><small>${escapeHtml(candidate.workingDir || 'Game root')} · score ${candidate.score}</small>`;
      button.addEventListener('click', () => {
        el.inputExecutable.value = candidate.executable;
        el.inputFolder.value = folder;
        if (!el.inputTitle.value.trim()) {
          el.inputTitle.value = folder.split('/').filter(Boolean).pop()?.replace(/[_-]+/g, ' ') || candidate.executable;
        }
        el.inputNotes.value = `Auto-detected by GameSky.space: ${candidate.reason}`;
      });
      el.presetSuggestionsBox.appendChild(button);
    }
    const best = candidates.find(candidate => candidate.role === 'game' && candidate.score > 0);
    if (best) {
      el.inputExecutable.value = best.executable;
      if (!el.inputTitle.value.trim()) {
        el.inputTitle.value = folder.split('/').filter(Boolean).pop()?.replace(/[_-]+/g, ' ') || best.executable;
      }
    }
  } catch (error) {
    el.presetSuggestionsBox.innerHTML = `<div class="preset-empty">${escapeHtml(String(error))}</div>`;
  }
}

async function checkForUpdates(interactive: boolean) {
  if (!EmulatorLauncher.isTauriEnvironment()) {
    if (interactive) el.updateStatus.textContent = 'Native app required.';
    return;
  }
  el.btnCheckUpdates.disabled = true;
  if (interactive) el.updateStatus.textContent = 'Checking signed release feed…';
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const update = await invoke<{ available: boolean; version?: string; notes?: string }>('check_for_update');
    if (!update.available) {
      if (interactive) el.updateStatus.textContent = 'GameSky.space is up to date.';
      return;
    }
    el.updateStatus.textContent = `Version ${update.version} is available.`;
    if (confirm(`GameSky.space ${update.version} is available. Download, verify and install it now?\n\n${update.notes || ''}`)) {
      el.updateStatus.textContent = 'Downloading and verifying signed update…';
      await invoke('install_available_update');
    }
  } catch (error) {
    if (interactive) el.updateStatus.textContent = String(error);
    else console.info('Automatic update check unavailable:', error);
  } finally {
    el.btnCheckUpdates.disabled = false;
  }
}

// --------------------------------------------------------------------------
// EVENTS SETUP
// --------------------------------------------------------------------------
function setupEvents() {
  // Folder filter input
  el.folderFilterInput.addEventListener('input', () => {
    renderGameList();
  });
  el.libraryViewSelect.addEventListener('change', renderGameList);

  el.btnToggleFavorite.addEventListener('click', () => {
    const game = getSelectedGame();
    if (!game) return;
    game.favorite = !game.favorite;
    StorageService.saveGames(games);
    renderGameList();
    renderSelectedGame();
  });
  el.btnDiagnoseGame.addEventListener('click', () => void openGameDiagnostics());
  el.btnGameControls.addEventListener('click', openControlsManager);

  // Settings inputs
  el.cyclesRange.addEventListener('input', () => {
    saveActiveGameSettings();
  });

  [el.selMachine, el.selScaler, el.selSoundCard, el.selPort, el.selIrq, el.selDma, el.chkMidi].forEach(ctrl => {
    ctrl.addEventListener('change', () => {
      soundFX.playButtonClick();
      saveActiveGameSettings();
    });
  });

  // Drives interactions
  el.btnCdBrowse.addEventListener('click', async () => {
    soundFX.playButtonClick();
    const file = await EmulatorLauncher.browseForFile({
      title: 'Select CD-ROM ISO/CUE Image',
      extensions: ['iso', 'cue', 'bin', 'img', 'nrg']
    });
    if (file) {
      soundFX.playCdMountSound();
      const game = getSelectedGame();
      if (game) {
        game.drives.cdRomPath = file;
        game.drives.mediaSets = (game.drives.mediaSets || []).filter(set =>
          !set.items.some(item => item.kind === 'cdrom' || item.kind === 'directory')
        );
        StorageService.saveGames(games);
        renderGameList();
        renderSelectedGame();
      }
    }
  });

  el.btnCdBrowseFolder.addEventListener('click', async () => {
    soundFX.playButtonClick();
    const folder = await EmulatorLauncher.browseForFolder('Select mounted CD-ROM or game data folder');
    if (folder) {
      soundFX.playCdMountSound();
      const game = getSelectedGame();
      if (game) {
        game.drives.cdRomPath = folder;
        game.drives.mediaSets = (game.drives.mediaSets || []).filter(set =>
          !set.items.some(item => item.kind === 'cdrom' || item.kind === 'directory')
        );
        StorageService.saveGames(games);
        renderSelectedGame();
      }
    }
  });

  el.btnCdEject.addEventListener('click', () => {
    soundFX.playButtonClick();
    const game = getSelectedGame();
    if (game) {
      game.drives.cdRomPath = '';
      game.drives.mediaSets = (game.drives.mediaSets || []).filter(set =>
        !set.items.some(item => item.kind === 'cdrom' || item.kind === 'directory')
      );
      StorageService.saveGames(games);
      renderGameList();
      renderSelectedGame();
    }
  });

  el.btnFloppyBrowse.addEventListener('click', async () => {
    soundFX.playButtonClick();
    const file = await EmulatorLauncher.browseForFile({
      title: 'Select Floppy Image',
      extensions: ['img', 'ima', 'vfd']
    });
    if (file) {
      soundFX.playFloppySeek();
      const game = getSelectedGame();
      if (game) {
        game.drives.floppyPath = file;
        game.drives.mediaSets = (game.drives.mediaSets || []).filter(set =>
          !set.items.some(item => item.kind === 'floppy')
        );
        StorageService.saveGames(games);
        renderGameList();
        renderSelectedGame();
      }
    }
  });

  el.btnFloppyEject.addEventListener('click', () => {
    soundFX.playButtonClick();
    const game = getSelectedGame();
    if (game) {
      game.drives.floppyPath = '';
      game.drives.mediaSets = (game.drives.mediaSets || []).filter(set =>
        !set.items.some(item => item.kind === 'floppy')
      );
      StorageService.saveGames(games);
      renderGameList();
      renderSelectedGame();
    }
  });

  // Big Action Buttons
  if (el.btnBigCatalog) {
    el.btnBigCatalog.addEventListener('click', openArchiveModal);
  }

  // A selected game launches directly; if it is an unextracted package/archive, triggers unpack.
  el.btnRunDosGame.addEventListener('click', () => {
    const game = getSelectedGame();
    if (!game) return;
    if (
      selectedGameArchives.length > 0 &&
      (game.installationState === 'needs-attention' ||
        game.executable.toLowerCase().endsWith('.zip') ||
        game.executable.toLowerCase().includes('package'))
    ) {
      void unpackArchiveDirect(game, selectedGameArchives[0].filePath);
    } else {
      void launchGameDirect(game);
    }
  });

  // Theme Toggle Button
  el.tbThemeToggle.addEventListener('click', () => {
    soundFX.playButtonClick();
    const themes: AppPreferences['theme'][] = ['classic-win95', 'norton-blue', 'dos-matrix', 'apple-light'];
    const currentIdx = themes.indexOf(prefs.theme || 'classic-win95');
    const nextTheme = themes[(currentIdx + 1) % themes.length];
    prefs.theme = nextTheme;
    StorageService.savePreferences(prefs);
    applyPreferences();
  });

  // Toolbar Actions
  el.tbNewGame.addEventListener('click', openAddGameModal);
  el.tbOpenPresets.addEventListener('click', openAddGameModal);
  el.tbSaveLibrary.addEventListener('click', async () => {
    soundFX.playButtonClick();
    if (EmulatorLauncher.isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const path = await invoke<string | null>('export_library_backup', {
          gamesJson: JSON.stringify(games),
          preferencesJson: JSON.stringify(prefs)
        });
        if (path) alert(`Portable backup created:\n${path}\n\nGame files are not duplicated; their paths are preserved.`);
      } catch (error) {
        alert(`Backup failed:\n${String(error)}`);
      }
      return;
    }
    const json = StorageService.exportLibraryAsJson(games);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GameSky-space-library-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    soundFX.playPcSpeakerBeep(1000, 0.1);
  });

  el.tbImportLibrary.addEventListener('click', async () => {
    soundFX.playButtonClick();
    if (!EmulatorLauncher.isTauriEnvironment()) {
      alert('Portable backup import is available in the native GameSky.space app.');
      return;
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const backup = await invoke<{ gamesJson: string; preferencesJson: string; sourcePath: string } | null>('import_library_backup');
      if (!backup) return;
      const importedGames = StorageService.importLibraryFromJson(backup.gamesJson);
      if (!importedGames) throw new Error('The backup contains no valid game library.');
      const importedPreferences = JSON.parse(backup.preferencesJson) as Partial<AppPreferences>;
      games = importedGames;
      prefs = { ...prefs, ...importedPreferences };
      selectedGameId = games[0]?.id || null;
      StorageService.saveGames(games);
      StorageService.savePreferences(prefs);
      applyPreferences();
      renderGameList();
      renderSelectedGame();
      alert(`Backup imported from:\n${backup.sourcePath}\n\n${games.length} real game profile(s) loaded.`);
    } catch (error) {
      alert(`Backup import failed:\n${String(error)}`);
    }
  });

  el.tbDuplicateGame.addEventListener('click', () => {
    const game = getSelectedGame();
    if (!game) return;
    soundFX.playButtonClick();
    const duplicate: GameProfile = {
      ...JSON.parse(JSON.stringify(game)),
      id: `game-${Date.now()}`,
      title: `${game.title} (Copy)`,
      createdAt: Date.now()
    };
    games.push(duplicate);
    selectedGameId = duplicate.id;
    StorageService.saveGames(games);
    renderGameList();
    renderSelectedGame();
  });

  el.tbDeleteGame.addEventListener('click', () => {
    const game = getSelectedGame();
    if (!game) return;
    if (confirm(`Delete "${game.title}" from library?`)) {
      soundFX.playButtonClick();
      games = games.filter(g => g.id !== game.id);
      selectedGameId = games.length > 0 ? games[0].id : null;
      StorageService.saveGames(games);
      renderGameList();
      renderSelectedGame();
    }
  });

  el.tbSoundToggle.addEventListener('click', () => {
    prefs.soundEffectsEnabled = !prefs.soundEffectsEnabled;
    soundFX.setEnabled(prefs.soundEffectsEnabled);
    el.tbSoundToggle.textContent = prefs.soundEffectsEnabled ? 'SND+' : 'SND-';
    if (prefs.soundEffectsEnabled) soundFX.playPcSpeakerBeep(800, 0.1);
    StorageService.savePreferences(prefs);
  });

  el.tbToggleFullscreen.addEventListener('click', toggleAppFullscreen);
  el.btnWinMaximize.addEventListener('click', toggleAppFullscreen);
  if (el.btnWinMinimize) {
    el.btnWinMinimize.addEventListener('click', async () => {
      soundFX.playButtonClick();
      if (EmulatorLauncher.isTauriEnvironment()) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          getCurrentWindow().minimize();
        } catch (e) {}
      }
    });
  }
  if (el.btnWinClose) {
    el.btnWinClose.addEventListener('click', async () => {
      soundFX.playButtonClick();
      if (EmulatorLauncher.isTauriEnvironment()) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          getCurrentWindow().close();
        } catch (e) {}
      }
    });
  }

  // Keyboard shortcuts mirror the functional 90s command strip.
  window.addEventListener('keydown', (e) => {
    const functionTargets: Record<string, string> = {
      F1: 'tbHelp',
      F2: 'tbNewGame',
      F3: 'tbOnlineArchive',
      F4: 'tbOpenPresets',
      F5: 'tbGameSaves',
      F8: 'tbDeleteGame',
      F9: 'btnRunDosGame',
      F10: 'tbConfig'
    };
    const targetId = functionTargets[e.key];
    if (targetId) {
      e.preventDefault();
      if (!e.repeat) document.getElementById(targetId)?.click();
      return;
    }
    if (e.key === 'F11' || (e.altKey && e.key === 'Enter')) {
      e.preventDefault();
      toggleAppFullscreen();
    }
  });

  el.tbConfig.addEventListener('click', openConfigModal);

  el.tbHelp.addEventListener('click', showAppHelp);

  document.querySelectorAll<HTMLButtonElement>('.function-key').forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.target;
      if (target) document.getElementById(target)?.click();
    });
  });

  // Menu items
  el.menuFile.addEventListener('click', openAddGameModal);
  el.menuEdit.addEventListener('click', openAddGameModal);
  el.menuDrives.addEventListener('click', openMediaManager);
  el.menuView.addEventListener('click', () => toggleAppFullscreen());
  el.menuSettings.addEventListener('click', openConfigModal);
  el.menuHelp.addEventListener('click', showAppHelp);

  // First-run setup and system diagnostics
  el.btnCloseSetupWizard.addEventListener('click', () => el.modalSetupWizard.classList.remove('open'));
  el.btnSetupChooseLibrary.addEventListener('click', async () => {
    const folder = await EmulatorLauncher.browseForFolder('Choose your DOS games library');
    if (folder) {
      el.setupLibraryPath.value = folder;
      await runSetupChecks();
    }
  });
  el.btnSetupRunChecks.addEventListener('click', () => void runSetupChecks());
  el.btnFinishSetup.addEventListener('click', () => {
    prefs.defaultCDrive = el.setupLibraryPath.value.trim() || prefs.defaultCDrive;
    prefs.setupCompleted = true;
    StorageService.savePreferences(prefs);
    applyPreferences();
    el.modalSetupWizard.classList.remove('open');
    void initializeNativeLibrary();
  });

  el.btnCloseDiagnosticsX.addEventListener('click', () => el.modalDiagnostics.classList.remove('open'));
  el.btnCloseDiagnostics.addEventListener('click', () => el.modalDiagnostics.classList.remove('open'));
  el.btnAutoRepairGame.addEventListener('click', () => void autoRepairSelectedGame());

  // CD-ROM, floppy and multi-disc media
  el.btnCloseMediaManagerX.addEventListener('click', () => el.modalMediaManager.classList.remove('open'));
  el.btnCloseMediaManager.addEventListener('click', () => el.modalMediaManager.classList.remove('open'));
  el.btnAddCdImages.addEventListener('click', async () => {
    const paths = await EmulatorLauncher.browseForFiles({
      title: 'Add CD-ROM image(s)',
      extensions: ['iso', 'cue', 'bin', 'img', 'nrg', 'mds', 'mdf']
    });
    const known = new Set(editingCdMedia.map(item => item.path));
    for (const path of paths) {
      if (!known.has(path)) editingCdMedia.push(mediaItemFromPath(path, 'cdrom', editingCdMedia.length));
    }
    renderMediaManagerLists();
  });
  el.btnAddFloppyImages.addEventListener('click', async () => {
    const paths = await EmulatorLauncher.browseForFiles({
      title: 'Add floppy image(s)',
      extensions: ['img', 'ima', 'vfd']
    });
    const known = new Set(editingFloppyMedia.map(item => item.path));
    for (const path of paths) {
      if (!known.has(path)) editingFloppyMedia.push(mediaItemFromPath(path, 'floppy', editingFloppyMedia.length));
    }
    renderMediaManagerLists();
  });
  el.btnClearMediaSets.addEventListener('click', () => {
    editingCdMedia = [];
    editingFloppyMedia = [];
    renderMediaManagerLists();
  });
  el.btnSaveMediaSets.addEventListener('click', () => void saveMediaSets());

  // Controller/keyboard profiles
  el.btnCloseControlsX.addEventListener('click', () => el.modalControls.classList.remove('open'));
  el.btnCloseControls.addEventListener('click', () => el.modalControls.classList.remove('open'));
  [el.controlsTemplate, el.controlsJoystickType, el.controlsDeadzone, el.controlsAutofire, el.controlsCircular]
    .forEach(control => control.addEventListener('input', previewControlsTemplate));
  el.btnSaveControls.addEventListener('click', () => void saveControlsProfile());

  // Modal Game Profile Editor
  el.btnCancelEditX.addEventListener('click', () => el.modalGameEdit.classList.remove('open'));
  el.btnCancelProfile.addEventListener('click', () => el.modalGameEdit.classList.remove('open'));
  el.inputPresetSearch.addEventListener('input', () => {
    renderPresetSuggestions(el.inputPresetSearch.value);
  });

  // The detected game belongs to the folder it was found in; typing a
  // different path invalidates it.
  el.inputFolder.addEventListener('input', () => {
    pendingScummvmGame = null;
  });

  el.btnModalBrowseDir.addEventListener('click', async () => {
    const f = await EmulatorLauncher.browseForFolder('Select game folder on Mac');
    if (f) {
      el.inputFolder.value = f;
      await inspectImportFolder(f);
    }
  });

  el.btnModalBrowseExecutable.addEventListener('click', async () => {
    const executablePath = await EmulatorLauncher.browseForFile({
      title: 'Select the real DOS game executable',
      extensions: ['exe', 'com', 'bat']
    });
    if (!executablePath) return;

    const normalized = executablePath.replace(/\\/g, '/');
    const separator = normalized.lastIndexOf('/');
    const fileName = separator >= 0 ? normalized.slice(separator + 1) : normalized;
    const parentFolder = separator >= 0 ? normalized.slice(0, separator) : '';
    pendingScummvmGame = null;
    el.inputExecutable.value = fileName;
    if (parentFolder) el.inputFolder.value = parentFolder;
    if (!el.inputTitle.value.trim()) {
      el.inputTitle.value = fileName.replace(/\.(exe|com|bat)$/i, '').replace(/[_-]+/g, ' ');
    }
  });

  el.btnModalBrowseIso.addEventListener('click', async () => {
    const f = await EmulatorLauncher.browseForFile({
      title: 'Select CD-ROM ISO',
      extensions: ['iso', 'cue', 'bin', 'img']
    });
    if (f) el.inputCdIso.value = f;
  });

  el.btnModalBrowseCdFolder.addEventListener('click', async () => {
    const folder = await EmulatorLauncher.browseForFolder('Select mounted CD-ROM or CD data folder');
    if (folder) el.inputCdIso.value = folder;
  });

  el.btnSaveProfile.addEventListener('click', async () => {
    const title = el.inputTitle.value.trim();
    const exec = el.inputExecutable.value.trim();
    const gameFolder = el.inputFolder.value.trim();

    const scummvmTarget = pendingScummvmGame;
    if (!title || !gameFolder || (!exec && !scummvmTarget)) {
      soundFX.playPcSpeakerBeep(300, 0.2);
      alert('Game title, real executable, and game folder are required.');
      return;
    }

    soundFX.playButtonClick();

    const yearAndGenre = el.inputYearGenre.value.trim();
    const parsedYear = parseInt(yearAndGenre, 10);
    const genre = yearAndGenre.replace(/^\d{4}\s*[-–]?\s*/, '').trim() || 'DOS game';
    const automaticSettings = recommendedSettingsForGame({
      title,
      year: Number.isFinite(parsedYear) ? parsedYear : undefined,
      genre
    }, prefs.activeEmulator);

    const newGame: GameProfile = {
      id: `game-${Date.now()}`,
      title,
      developer: el.inputDev.value.trim() || 'Unknown',
      executable: exec,
      year: Number.isFinite(parsedYear) ? parsedYear : undefined,
      genre,
      description: el.inputNotes.value.trim(),
      drives: {
        cDrivePath: gameFolder,
        cdRomPath: el.inputCdIso.value.trim(),
        floppyPath: ''
      },
      settings: {
        ...automaticSettings,
        emulatorType: scummvmTarget ? 'scummvm' : automaticSettings.emulatorType,
        fullscreen: el.inputFullscreen.checked,
        settingsLocked: false
      },
      scummvmGameId: scummvmTarget?.gameId,
      compatibilityProfileVersion: COMPATIBILITY_PROFILE_VERSION,
      ...compatibilityAssessment({
        title,
        year: Number.isFinite(parsedYear) ? parsedYear : undefined,
        genre
      }),
      createdAt: Date.now()
    };

    let verifiedGame: GameProfile;
    if (scummvmTarget) {
      // prepare_game_launch validates a DOS executable on disk; a ScummVM game
      // is addressed by engine id instead, so there is nothing to verify here.
      verifiedGame = { ...newGame, compatibilityReason: `ScummVM game '${scummvmTarget.gameId}'` };
    } else {
      try {
        verifiedGame = await EmulatorLauncher.prepareGame(newGame);
      } catch (error) {
        soundFX.playPcSpeakerBeep(260, 0.25);
        alert(`The game was not added because its files could not be verified:\n${String(error)}`);
        return;
      }
    }

    games.unshift(verifiedGame);
    selectedGameId = verifiedGame.id;
    StorageService.saveGames(games);
    renderGameList();
    renderSelectedGame();

    pendingScummvmGame = null;
    el.modalGameEdit.classList.remove('open');
  });

  function openConfigModal() {
    soundFX.playButtonClick();
    el.cfgEmuType.value = prefs.activeEmulator;
    el.cfgDosboxPath.value = prefs.dosboxPath;
    el.cfgStagingPath.value = prefs.dosboxStagingPath;
    el.cfgXPath.value = prefs.dosboxXPath;
    el.cfgScummvmPath.value = prefs.scummvmPath;
    el.cfgDefaultDir.value = prefs.defaultCDrive;
    el.cfgThemeSelect.value = prefs.theme;
    el.cfgAudioEnabled.checked = prefs.soundEffectsEnabled;
    el.cfgCheckUpdates.checked = prefs.checkForUpdates;
    el.cfgNortonCommanderPath.value = prefs.customNortonCommanderPath || '';
    el.cfgDeleteArchiveAfterUnpack.checked = prefs.deleteArchiveAfterUnpack === true;
    el.modalConfig.classList.add('open');
  }

  // Secondary launch actions
  el.btnLaunchFileManager.addEventListener('click', () => {
    const game = getSelectedGame();
    if (game) void launchFileManagerDirect(game);
  });

  el.btnLaunchSetup.addEventListener('click', () => {
    const game = getSelectedGame();
    if (game && selectedGameSetupCandidate) {
      void launchSetupDirect(game, selectedGameSetupCandidate);
    }
  });

  el.btnUnpackGameArchive.addEventListener('click', () => {
    const game = getSelectedGame();
    if (game && selectedGameArchives.length > 0) {
      void unpackArchiveDirect(game, selectedGameArchives[0].filePath);
    }
  });

  // Modal Config
  el.btnCancelConfigX.addEventListener('click', () => el.modalConfig.classList.remove('open'));
  el.btnCloseConfig.addEventListener('click', () => el.modalConfig.classList.remove('open'));
  el.btnAutoDetectEmus.addEventListener('click', runAutoDetectEmulators);
  el.btnCheckUpdates.addEventListener('click', () => void checkForUpdates(true));

  el.btnBrowseNortonCommander.addEventListener('click', async () => {
    soundFX.playButtonClick();
    const p = await EmulatorLauncher.browseForFile({
      title: 'Select Norton Commander, Volkov Commander, or DOS Utility Folder',
      extensions: ['exe', 'com', 'bat', '']
    });
    if (p) el.cfgNortonCommanderPath.value = p;
  });

  el.btnBrowseDosbox.addEventListener('click', async () => {
    soundFX.playButtonClick();
    const p = await EmulatorLauncher.browseForEmulator('Select DOSBox App or Executable');
    if (p) el.cfgDosboxPath.value = p;
  });

  el.btnBrowseStaging.addEventListener('click', async () => {
    soundFX.playButtonClick();
    const p = await EmulatorLauncher.browseForEmulator('Select DOSBox Staging App or Executable');
    if (p) el.cfgStagingPath.value = p;
  });

  el.btnBrowseX.addEventListener('click', async () => {
    soundFX.playButtonClick();
    const p = await EmulatorLauncher.browseForEmulator('Select DOSBox-X App or Executable');
    if (p) el.cfgXPath.value = p;
  });

  el.btnBrowseScummvm.addEventListener('click', async () => {
    soundFX.playButtonClick();
    const p = await EmulatorLauncher.browseForEmulator('Select ScummVM App or Executable');
    if (p) el.cfgScummvmPath.value = p;
  });

  el.btnBrowseDefaultDir.addEventListener('click', async () => {
    soundFX.playButtonClick();
    const p = await EmulatorLauncher.browseForFolder('Select Default DOS Games Folder (C:\\)');
    if (p) el.cfgDefaultDir.value = p;
  });

  el.btnSaveConfig.addEventListener('click', () => {
    soundFX.playButtonClick();
    prefs.activeEmulator = el.cfgEmuType.value as any;
    prefs.dosboxPath = el.cfgDosboxPath.value.trim();
    prefs.dosboxStagingPath = el.cfgStagingPath.value.trim();
    prefs.dosboxXPath = el.cfgXPath.value.trim();
    prefs.scummvmPath = el.cfgScummvmPath.value.trim();
    prefs.defaultCDrive = el.cfgDefaultDir.value.trim();
    prefs.theme = el.cfgThemeSelect.value as any;
    prefs.soundEffectsEnabled = el.cfgAudioEnabled.checked;
    prefs.checkForUpdates = el.cfgCheckUpdates.checked;
    prefs.customNortonCommanderPath = el.cfgNortonCommanderPath.value.trim();
    prefs.deleteArchiveAfterUnpack = el.cfgDeleteArchiveAfterUnpack.checked;
    StorageService.savePreferences(prefs);
    applyPreferences();
    renderSelectedGame();
    el.modalConfig.classList.remove('open');
  });

  // Post-Install modal
  el.btnCancelPostInstallX.addEventListener('click', () => el.modalPostInstall.classList.remove('open'));
  el.btnSkipPostInstall.addEventListener('click', () => el.modalPostInstall.classList.remove('open'));
  el.btnApplyPostInstallExe.addEventListener('click', () => {
    if (postInstallTargetGame && postInstallSelectedCandidate) {
      soundFX.playButtonClick();
      postInstallTargetGame.executable = postInstallSelectedCandidate.executable;
      if (postInstallSelectedCandidate.workingDir !== undefined) {
        postInstallTargetGame.workingDir = postInstallSelectedCandidate.workingDir;
      }
      postInstallTargetGame.installationState = 'ready';
      StorageService.saveGames(games);
      renderGameList();
      renderSelectedGame();
    }
    el.modalPostInstall.classList.remove('open');
  });

  // Modal Launch
  el.btnCancelLaunchX.addEventListener('click', () => el.modalLaunch.classList.remove('open'));
  el.btnCloseLaunchModal.addEventListener('click', () => el.modalLaunch.classList.remove('open'));
  el.btnCopyLaunchCmd.addEventListener('click', () => {
    soundFX.playButtonClick();
    navigator.clipboard.writeText(el.launchCmdBox.value);
    el.btnCopyLaunchCmd.textContent = '✅ Copied!';
    setTimeout(() => { el.btnCopyLaunchCmd.textContent = '📋 Copy Command'; }, 2000);
  });
  el.btnSaveLaunchConf.addEventListener('click', () => {
    soundFX.playButtonClick();
    const blob = new Blob([el.launchConfBox.textContent || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dosbox_${selectedGameId || 'config'}.conf`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Modal Online Archive & Catalog
  el.tbOnlineArchive.addEventListener('click', openArchiveModal);
  el.btnCancelArchiveX.addEventListener('click', () => el.modalArchive.classList.remove('open'));
  el.btnCloseArchive.addEventListener('click', () => el.modalArchive.classList.remove('open'));
  el.btnArchiveSearch.addEventListener('click', performArchiveSearch);
  el.archiveSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performArchiveSearch();
  });
  el.btnArchiveClear.addEventListener('click', () => {
    soundFX.playButtonClick();
    el.archiveSearchInput.value = '';
    performArchiveSearch();
  });
  el.archiveSortSelect.addEventListener('change', () => {
    soundFX.playButtonClick();
    sortAndRenderCatalogItems();
  });
  el.catalogSourceSelect.addEventListener('change', () => {
    soundFX.playButtonClick();
    activeCatalogSource = el.catalogSourceSelect.value as CatalogSource;
    performArchiveSearch();
  });

  el.catalogGenreTabs.querySelectorAll('.genre-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      soundFX.playButtonClick();
      el.catalogGenreTabs.querySelectorAll('.genre-tab').forEach(t => t.classList.remove('active'));
      const target = e.currentTarget as HTMLButtonElement;
      target.classList.add('active');
      activeCatalogCategory = target.getAttribute('data-category') || 'all';
      performArchiveSearch();
    });
  });

  // Modal Saves & Checkpoints
  el.tbGameSaves.addEventListener('click', openSavesModal);
  el.btnOpenGameSaves.addEventListener('click', openSavesModal);
  el.btnSetArtwork.addEventListener('click', handleSetArtwork);
  el.btnChooseExecutable.addEventListener('click', chooseGameExecutable);
  el.btnCancelSavesX.addEventListener('click', () => el.modalSaves.classList.remove('open'));
  el.btnCloseSaves.addEventListener('click', () => el.modalSaves.classList.remove('open'));
  el.tabLiveSaves.addEventListener('click', () => switchSavesTab('live'));
  el.tabCheckpoints.addEventListener('click', () => switchSavesTab('checkpoints'));
  el.btnRefreshLiveSaves.addEventListener('click', refreshLiveSaves);
  el.btnCreateCheckpoint.addEventListener('click', handleCreateCheckpoint);
  el.btnOpenFinderSaves.addEventListener('click', () => {
    const game = getSelectedGame();
    if (game && game.drives.cDrivePath) {
      SaveManager.openInFinder(game.drives.cDrivePath);
    }
  });
}

function openArchiveModal() {
  soundFX.playButtonClick();
  el.archiveSearchInput.value = '';
  activeCatalogCategory = 'all';
  activeCatalogSource = 'all';
  el.catalogSourceSelect.value = 'all';
  el.catalogGenreTabs.querySelectorAll('.genre-tab').forEach((t, i) => {
    if (i === 0) t.classList.add('active');
    else t.classList.remove('active');
  });
  performArchiveSearch();
  el.modalArchive.classList.add('open');
}

async function performArchiveSearch() {
  const query = el.archiveSearchInput.value.trim();
  el.archiveStatusMsg.textContent = `🔍 Loading DOS games catalog...`;
  el.archiveResultsBox.innerHTML = '<div style="padding:20px; text-align:center; color:#555; grid-column: 1 / -1;">Loading games catalog...</div>';
  
  currentCatalogItems = await ArchiveDownloader.searchArchive(query, activeCatalogCategory, activeCatalogSource);
  sortAndRenderCatalogItems();
}

function sortAndRenderCatalogItems() {
  const sortMode = el.archiveSortSelect.value;
  let items = [...currentCatalogItems];

  if (sortMode === 'popular') {
    items.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
  } else if (sortMode === 'rating') {
    items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sortMode === 'year-desc') {
    items.sort((a, b) => parseInt(b.year || '0') - parseInt(a.year || '0'));
  } else if (sortMode === 'year-asc') {
    items.sort((a, b) => parseInt(a.year || '0') - parseInt(b.year || '0'));
  } else if (sortMode === 'title') {
    items.sort((a, b) => a.title.localeCompare(b.title));
  }

  const sourceLabel = activeCatalogSource === 'freedos'
    ? 'FreeDOS 1.4'
    : activeCatalogSource === 'internet-archive'
      ? 'Internet Archive'
      : 'all sources';
  const installableCount = items.filter(item => ArchiveDownloader.canInstall(item)).length;
  el.archiveStatusMsg.textContent = `Displaying ${items.length} MS-DOS entries from ${sourceLabel}: ${installableCount} license-verified package(s) can be installed automatically; source-only entries require your own legal copy.`;
  renderArchiveItems(items);
}

function renderArchiveItems(items: ArchiveGameItem[]) {
  el.archiveResultsBox.innerHTML = '';
  if (items.length === 0) {
    el.archiveResultsBox.innerHTML = '<div style="padding:20px; text-align:center; color:#555; grid-column:1/-1;">No games found matching criteria. Try a different search or genre tab.</div>';
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'catalog-card';
    
    const fallbackCover = catalogCoverFallback(item.source, item.title);
    const stars = '★'.repeat(Math.round(item.rating || 4.5)) + '☆'.repeat(5 - Math.round(item.rating || 4.5));
    const dlStr = item.source === 'freedos'
      ? `v${item.version || '?'} · ${item.license || 'Open source'}`
      : item.downloads ? `${(item.downloads / 1000).toFixed(0)}k DLs` : 'Popular';
    const installable = ArchiveDownloader.canInstall(item);
    const rightsLabel = installable ? '✓ verified license' : 'ⓘ source only';
    const actionLabel = installable
      ? (EmulatorLauncher.isTauriEnvironment() ? '⬇️ Install' : '📦 Download ZIP')
      : '↗ View source';

    card.innerHTML = `
      <div class="catalog-card-header">
        <img class="catalog-card-img" src="${escapeHtml(fallbackCover)}" alt="${escapeHtml(item.title)} artwork" />
        <span class="catalog-card-genre">${escapeHtml(item.genre || item.category)}</span>
        <span class="catalog-card-year">${item.source === 'freedos' ? 'FreeDOS' : escapeHtml(item.year || 'DOS')}</span>
      </div>
      <div class="catalog-card-body">
        <div class="catalog-card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
        <div class="catalog-card-author">🏢 ${escapeHtml(item.creator || 'MS-DOS')}</div>
        <div class="catalog-card-desc">${escapeHtml(item.description || 'Classic MS-DOS game available for instant download and emulation.')}</div>
        <div class="catalog-rights ${installable ? 'verified' : 'unknown'}" title="${escapeHtml(item.licenseEvidence || '')}">${rightsLabel}</div>
        <div class="catalog-card-footer">
          <span class="catalog-card-rating" title="Rating: ${item.rating || 4.5}/5">${stars} <span style="font-size:10px; color:#666">(${dlStr})</span></span>
          <button class="btn-download-action" data-id="${escapeHtml(item.identifier)}">${actionLabel}</button>
        </div>
      </div>
    `;

    const coverImage = card.querySelector('.catalog-card-img') as HTMLImageElement;
    ArtworkService.loadInto(
      coverImage,
      ArtworkService.candidates({
        title: item.title,
        year: item.year,
        coverImage: undefined,
        catalogIdentifier: item.identifier,
        catalogSource: item.source
      }),
      url => { item.thumbnailUrl = url; },
      () => {
        coverImage.hidden = false;
        coverImage.src = fallbackCover;
      }
    );

    const btnInstall = card.querySelector('.btn-download-action') as HTMLButtonElement;
    btnInstall.addEventListener('click', async () => {
      soundFX.playButtonClick();
      if (!installable) {
        try {
          await ArchiveDownloader.openSourcePage(item);
          el.archiveStatusMsg.textContent = `Rights for "${item.title}" are not verified. Its source page was opened; import your legally owned copy.`;
        } catch (error) {
          el.archiveStatusMsg.textContent = String(error);
        }
        return;
      }
      btnInstall.disabled = true;
      btnInstall.textContent = '⏳ Downloading...';
      el.archiveStatusMsg.textContent = `⬇️ Downloading "${item.title}" across verified mirrors...`;

      try {
        const res = await ArchiveDownloader.downloadAndInstall(item, prefs.defaultCDrive || '~/DOSGAMES');
        if (res.success && res.installed === false) {
          btnInstall.disabled = false;
          btnInstall.textContent = '📦 Download ZIP';
          el.archiveStatusMsg.textContent = `📦 ${res.message}`;
          alert(res.message);
        } else if (res.success && res.targetFolder) {
          soundFX.playLaunchChime();
          btnInstall.textContent = '✅ Ready!';
          el.archiveStatusMsg.textContent = `✅ Successfully installed "${item.title}"! (Executable: ${res.executable || 'START.EXE'})`;

          // Add to games library
          const newGame: GameProfile = {
            id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            title: item.title,
            workingDir: res.workingDir || '',
            executable: res.executable || 'START.EXE',
            developer: item.creator || 'MS-DOS Developer',
            publisher: item.creator || 'MS-DOS',
            year: parseInt(item.year || '1993') || 1993,
            genre: item.genre || 'Classic DOS',
            description: item.description || `Downloaded from ${item.source === 'freedos' ? 'FreeDOS' : 'Internet Archive'} (${item.identifier})`,
            coverImage: item.thumbnailUrl,
            favorite: true,
            drives: {
              cDrivePath: res.targetFolder,
              cdRomPath: '',
              floppyPath: ''
            },
            settings: recommendedSettingsForGame({
              title: item.title,
              year: parseInt(item.year || '1993') || 1993,
              genre: item.genre || 'Classic DOS'
            }, prefs.activeEmulator),
            compatibilityProfileVersion: COMPATIBILITY_PROFILE_VERSION,
            ...compatibilityAssessment({
              title: item.title,
              year: parseInt(item.year || '1993') || 1993,
              genre: item.genre || 'Classic DOS'
            }),
            catalogSource: item.source || 'internet-archive',
            catalogIdentifier: item.identifier,
            createdAt: Date.now()
          };

          games.unshift(newGame);
          selectedGameId = newGame.id;
          StorageService.saveGames(games);
          renderGameList();
          renderSelectedGame();

          setTimeout(() => {
            el.modalArchive.classList.remove('open');
          }, 1200);
        } else {
          btnInstall.disabled = false;
          btnInstall.textContent = '⬇️ Try Again';
          el.archiveStatusMsg.textContent = `❌ ${res.message || 'Download failed.'}`;
          alert(`Download failed for "${item.title}":\n${res.message || 'Could not connect to archive mirror.'}`);
        }
      } catch (err: any) {
        btnInstall.disabled = false;
        btnInstall.textContent = '⬇️ Try Again';
        el.archiveStatusMsg.textContent = `❌ Error: ${err.toString()}`;
        alert(`Error downloading "${item.title}":\n${err.toString()}`);
      }
    });

    el.archiveResultsBox.appendChild(card);
  });
}

async function runAutoDetectEmulators() {
  soundFX.playButtonClick();
  el.btnAutoDetectEmus.textContent = '⏳ Scanning Mac for DOSBox...';
  el.detectedEmusBox.style.display = 'block';
  el.detectedEmusBox.innerHTML = '<div style="color:#555">Scanning /Applications, Homebrew, and system paths...</div>';

  const list = await EmulatorLauncher.detectInstallations();
  const found = list.filter(item => item.exists);

  if (found.length === 0) {
    el.detectedEmusBox.innerHTML = '<div style="color:#a00">⚠️ No DOSBox installation automatically found in standard paths. Use the Browse... button next to the input to select your DOSBox app.</div>';
  } else {
    let html = '<div style="color:#006600; font-weight:bold; margin-bottom:4px">✓ Detected DOSBox on your Mac:</div>';
    found.forEach(item => {
      html += `<div style="padding:4px 0; border-bottom:1px dotted #ccc; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:12px"><b>${escapeHtml(item.name)}</b><br/><code style="font-size:11px; color:#444">${escapeHtml(item.path)}</code></span>
        <button class="btn-3d" style="padding:2px 6px; font-size:12px; margin-left:6px" data-use-path="${escapeHtml(item.path)}" data-type="${item.emulatorType}">Use This</button>
      </div>`;
    });
    el.detectedEmusBox.innerHTML = html;

    // Attach Use This click handlers
    el.detectedEmusBox.querySelectorAll('button[data-use-path]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const p = target.getAttribute('data-use-path') || '';
        const t = target.getAttribute('data-type') || 'dosbox';
        soundFX.playButtonClick();
        if (t === 'dosbox') {
          el.cfgDosboxPath.value = p;
          el.cfgEmuType.value = 'dosbox';
        } else if (t === 'dosbox-staging') {
          el.cfgStagingPath.value = p;
          el.cfgEmuType.value = 'dosbox-staging';
        } else if (t === 'dosbox-x') {
          el.cfgXPath.value = p;
          el.cfgEmuType.value = 'dosbox-x';
        } else if (t === 'scummvm') {
          el.cfgScummvmPath.value = p;
        }
      });
    });

    // Fill in every emulator we found. ScummVM only fills its own path — it is
    // chosen per game, so it must not become the library-wide default.
    for (const install of found) {
      if (install.emulatorType === 'scummvm') el.cfgScummvmPath.value = install.path;
    }

    // Auto-fill active emulator path
    const first = found.find(install => install.emulatorType !== 'scummvm');
    if (!first) {
      // Nothing but ScummVM is installed; leave the DOSBox selection alone.
    } else if (first.emulatorType === 'dosbox-staging') {
      el.cfgStagingPath.value = first.path;
      el.cfgEmuType.value = 'dosbox-staging';
    } else if (first.emulatorType === 'dosbox-x') {
      el.cfgXPath.value = first.path;
      el.cfgEmuType.value = 'dosbox-x';
    } else {
      el.cfgDosboxPath.value = first.path;
      el.cfgEmuType.value = 'dosbox';
    }
  }

  el.btnAutoDetectEmus.textContent = '🔍 Auto-Detect DOSBox Installed on Mac';
}

// --------------------------------------------------------------------------
// SAVE MANAGER & CHECKPOINTS
// --------------------------------------------------------------------------
function openSavesModal() {
  soundFX.playButtonClick();
  const game = getSelectedGame();
  if (!game) {
    alert('Please select a game first.');
    return;
  }

  el.savesGameTitle.textContent = `💾 Saves for: ${game.title}`;
  el.savesGameFolder.textContent = `Folder: ${game.drives.cDrivePath || '[Not configured]'}`;
  el.inputCheckpointName.value = '';
  el.savesStatusBanner.textContent = '';

  switchSavesTab('live');
  el.modalSaves.classList.add('open');
}

function switchSavesTab(tab: 'live' | 'checkpoints') {
  soundFX.playButtonClick();
  if (tab === 'live') {
    el.tabLiveSaves.classList.add('active');
    el.tabCheckpoints.classList.remove('active');
    el.viewLiveSaves.style.display = 'block';
    el.viewCheckpoints.style.display = 'none';
    refreshLiveSaves();
  } else {
    el.tabLiveSaves.classList.remove('active');
    el.tabCheckpoints.classList.add('active');
    el.viewLiveSaves.style.display = 'none';
    el.viewCheckpoints.style.display = 'block';
    refreshCheckpoints();
  }
}

async function refreshLiveSaves() {
  const game = getSelectedGame();
  if (!game || !game.drives.cDrivePath) {
    el.liveSavesList.innerHTML = '<div style="padding:10px; color:#a00">Drive C: folder is not set for this game.</div>';
    return;
  }

  el.liveSavesList.innerHTML = '<div style="padding:10px; color:#555">Scanning game directory for save files...</div>';
  const saves = await SaveManager.scanGameSaves(game.drives.cDrivePath);

  if (saves.length === 0) {
    el.liveSavesList.innerHTML = '<div style="padding:10px; color:#666">No active save files found in game folder yet. Play the game and save in-game to see files here.</div>';
    return;
  }

  el.liveSavesList.innerHTML = '';
  saves.forEach(save => {
    const item = document.createElement('div');
    item.className = 'save-file-item';
    const dateStr = SaveManager.formatTimestamp(save.modifiedTimestamp);
    const sizeStr = SaveManager.formatBytes(save.sizeBytes);

    item.innerHTML = `
      <div>
        <span style="font-weight:bold; color:#003366">📄 ${escapeHtml(save.relativePath || save.fileName)}</span>
        <span style="color:#777; font-size:11px; margin-left:6px">(${sizeStr})</span>
      </div>
      <div style="font-size:11px; color:#555">
        🕒 ${dateStr}
      </div>
    `;
    el.liveSavesList.appendChild(item);
  });
}

async function refreshCheckpoints() {
  const game = getSelectedGame();
  if (!game) return;

  el.checkpointsList.innerHTML = '<div style="padding:10px; color:#555">Loading saved checkpoints...</div>';
  const list = await SaveManager.listCheckpoints(game.id);

  if (list.length === 0) {
    el.checkpointsList.innerHTML = '<div style="padding:14px; text-align:center; color:#666">No backup checkpoints stored yet.<br/>Switch to "In-Game Save Files" tab and click "Create Checkpoint".</div>';
    return;
  }

  el.checkpointsList.innerHTML = '';
  list.forEach(chk => {
    const item = document.createElement('div');
    item.className = 'checkpoint-item';
    const dateStr = SaveManager.formatTimestamp(chk.timestamp);

    item.innerHTML = `
      <div>
        <div class="checkpoint-title">💾 ${escapeHtml(chk.name)}</div>
        <div class="checkpoint-meta">📅 ${dateStr} &bull; 📦 ${chk.fileCount} save files</div>
      </div>
      <div style="display:flex; gap:4px">
        <button class="btn-3d btn-restore-chk" style="background:#005500; color:#fff; font-size:12px; padding:2px 8px">⏪ Restore</button>
        <button class="btn-3d btn-delete-chk" style="background:#880000; color:#fff; font-size:12px; padding:2px 6px">🗑️</button>
      </div>
    `;

    const btnRestore = item.querySelector('.btn-restore-chk') as HTMLButtonElement;
    btnRestore.addEventListener('click', async () => {
      soundFX.playButtonClick();
      if (confirm(`Restore checkpoint "${chk.name}"? This will overwrite current in-game saves with this snapshot.`)) {
        btnRestore.disabled = true;
        btnRestore.textContent = 'Restoring...';
        const ok = await SaveManager.restoreCheckpoint(game.id, game.drives.cDrivePath, chk.folderPath);
        btnRestore.disabled = false;
        btnRestore.textContent = '⏪ Restore';
        if (ok) {
          soundFX.playLaunchChime();
          el.savesStatusBanner.textContent = `✓ Restored checkpoint "${chk.name}"!`;
          setTimeout(() => { el.savesStatusBanner.textContent = ''; }, 3000);
        } else {
          el.savesStatusBanner.textContent = `❌ Failed to restore checkpoint "${chk.name}".`;
        }
      }
    });

    const btnDelete = item.querySelector('.btn-delete-chk') as HTMLButtonElement;
    btnDelete.addEventListener('click', async () => {
      soundFX.playButtonClick();
      if (confirm(`Delete checkpoint "${chk.name}"?`)) {
        const deleted = await SaveManager.deleteCheckpoint(game.id, chk.folderPath, chk.id);
        if (deleted) {
          refreshCheckpoints();
        } else {
          el.savesStatusBanner.textContent = `❌ Failed to delete checkpoint "${chk.name}".`;
        }
      }
    });

    el.checkpointsList.appendChild(item);
  });
}

async function handleCreateCheckpoint() {
  const game = getSelectedGame();
  if (!game || !game.drives.cDrivePath) {
    alert('Drive C: is not set for this game.');
    return;
  }

  const name = el.inputCheckpointName.value.trim() || `Save Checkpoint ${new Date().toLocaleTimeString()}`;
  soundFX.playButtonClick();
  el.btnCreateCheckpoint.disabled = true;
  el.btnCreateCheckpoint.textContent = 'Saving...';

  try {
    const res = await SaveManager.createCheckpoint(game.id, game.drives.cDrivePath, name);
    soundFX.playLaunchChime();
    el.savesStatusBanner.textContent = `✓ Created checkpoint "${res.name}" with ${res.fileCount} files!`;
    el.inputCheckpointName.value = '';
    setTimeout(() => {
      switchSavesTab('checkpoints');
    }, 600);
  } catch (err: any) {
    alert(`Failed to create checkpoint: ${err.toString()}`);
  } finally {
    el.btnCreateCheckpoint.disabled = false;
    el.btnCreateCheckpoint.textContent = '💾 Create Checkpoint';
  }
}

async function toggleAppFullscreen() {
  soundFX.playButtonClick();
  if (EmulatorLauncher.isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke<boolean>('toggle_app_fullscreen');
      return;
    } catch (err) {
      console.warn('Tauri toggle_app_fullscreen error:', err);
    }
  }

  // Web fallback Fullscreen API
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function openAddGameModal() {
  soundFX.playButtonClick();
  pendingScummvmGame = null;
  el.inputPresetSearch.value = '';
  renderPresetSuggestions('');
  el.inputTitle.value = '';
  el.inputExecutable.value = '';
  el.inputDev.value = '';
  el.inputYearGenre.value = '';
  el.inputFolder.value = prefs.defaultCDrive;
  el.inputCdIso.value = '';
  el.inputNotes.value = '';
  if (el.inputFullscreen) el.inputFullscreen.checked = false;
  el.modalGameEdit.classList.add('open');
}

function renderPresetSuggestions(query: string) {
  el.presetSuggestionsBox.innerHTML = '';
  if (!query.trim()) {
    el.presetSuggestionsBox.innerHTML = '<div style="padding:6px; color:#666">Select a real EXE/COM/BAT below. Compatibility settings are applied automatically.</div>';
    return;
  }
  const presets = searchPresets(query).slice(0, 15);

  presets.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'preset-chip-item';
    chip.innerHTML = `⭐ <b>${escapeHtml(p.name)}</b> <span style="color:#666">(${p.year} / ${escapeHtml(p.executable)})</span>`;
    
    chip.addEventListener('click', () => {
      soundFX.playButtonClick();
      el.inputTitle.value = p.name;
      el.inputExecutable.value = p.executable;
      el.inputDev.value = p.developer;
      el.inputYearGenre.value = `${p.year} - ${p.genre}`;
      el.inputNotes.value = p.description;
    });

    el.presetSuggestionsBox.appendChild(chip);
  });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function catalogCoverFallback(source?: ArchiveGameItem['source'], title = 'DOS GAME'): string {
  return ArtworkService.titleFallback(
    title,
    source === 'freedos' ? 'FreeDOS' : 'DOS ARCHIVE'
  );
}

// Launch
window.addEventListener('DOMContentLoaded', () => { void init(); });
