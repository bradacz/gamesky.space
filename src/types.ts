export type EmulatorType = 'dosbox' | 'dosbox-staging' | 'dosbox-x' | 'scummvm' | 'custom';

export type MachineType = 'vga' | 'svga_s3' | 'svga_et4000' | 'svga_paradise' | 'cga' | 'ega' | 'tandy' | 'hercules' | 'pc98';

export type CpuCore = 'auto' | 'dynamic' | 'normal' | 'simple';
export type CpuType = 'auto' | '386' | '386_prefetch' | '486_slow' | 'pentium_slow';

export type ScalerType = 'none' | 'normal2x' | 'normal3x' | 'advmame2x' | 'advmame3x' | 'hq2x' | 'hq3x' | '2xsai' | 'super2xsai' | 'supereagle' | 'rgb2x' | 'rgb3x' | 'scan2x' | 'scan3x';

export type SoundBlasterType = 'none' | 'sb1' | 'sb2' | 'sbpro1' | 'sbpro2' | 'sb16' | 'gb';

export type InstallationState = 'discovered' | 'ready' | 'installing' | 'needs-attention' | 'broken';
export type MediaKind = 'cdrom' | 'floppy' | 'directory';
export type MediaMountMode = 'single' | 'swap' | 'separate-drives';

export interface MediaItem {
  id: string;
  kind: MediaKind;
  path: string;
  label?: string;
  discNumber?: number;
  checksum?: string;
}

export interface MediaSet {
  id: string;
  name: string;
  driveLetter: string;
  mode: MediaMountMode;
  items: MediaItem[];
  activeIndex?: number;
}

export interface InputMapping {
  dosEvent: string;
  bindings: string[];
}

export interface InputProfile {
  id: string;
  name: string;
  mode: 'native-joystick' | 'keyboard-mapper';
  joystickType: 'auto' | '2axis' | '4axis' | 'fcs' | 'ch' | 'hidden' | 'disabled';
  deadzone: number;
  autofire: boolean;
  circularInput: boolean;
  mappings: InputMapping[];
  mapperFilePath?: string;
}

export interface DriveConfig {
  cDrivePath: string; // Mac folder mounted as C:\
  cdRomPath: string; // .iso, .cue, .bin, .img or folder
  cdRomLabel?: string;
  floppyPath: string; // .img, .ima
  mountExtraDrives?: { driveLetter: string; path: string; type: 'dir' | 'cdrom' | 'floppy' }[];
  mediaSets?: MediaSet[];
}

export interface EmulationSettings {
  emulatorType: EmulatorType;
  customEmulatorPath?: string;
  
  // CPU
  cpuCore: CpuCore;
  cpuType: CpuType;
  cycles: number | 'auto' | 'max';
  cycleUp: number;
  cycleDown: number;
  
  // Display & Video
  machine: MachineType;
  scaler: ScalerType;
  aspectCorrection: boolean;
  fullscreen: boolean;
  windowResolution: string;
  renderOutput: 'opengl' | 'openglnb' | 'surface' | 'texture' | 'default';
  
  // Memory
  memSizeMb: number; // e.g. 16, 32, 64 MB
  
  // Sound
  soundBlaster: SoundBlasterType;
  sbPort: string; // "220", "240"
  sbIrq: number; // 7, 5
  sbDma: number; // 1
  sbHdma: number; // 5
  enableGus: boolean;
  enableMidi: boolean;
  midiDevice: 'default' | 'coreaudio' | 'mt32' | 'fluidsynth';
  enablePcSpeaker: boolean;
  
  // Custom script / commands
  customAutoexecLines?: string[];
  settingsLocked?: boolean;
  mapperFilePath?: string;
  joystickType?: InputProfile['joystickType'];
  joystickDeadzone?: number;
  joystickAutofire?: boolean;
  joystickCircularInput?: boolean;
}

export interface GameProfile {
  id: string;
  title: string;
  developer?: string;
  publisher?: string;
  year?: number;
  genre?: string;
  description?: string;
  coverImage?: string; // Data URL or URL
  favorite?: boolean;
  installationState?: InstallationState;
  collections?: string[];
  
  // Execution
  executable: string; // e.g., "DOOM.EXE", "PLAY.BAT"
  /** ScummVM target id (e.g. "sky"); the launch target when emulatorType is scummvm. */
  scummvmGameId?: string;
  parameters?: string; // e.g., "-skill 4"
  workingDir?: string; // Subfolder inside C:\ if applicable (e.g., "DOOM2")
  
  // Drives
  drives: DriveConfig;
  
  // Emulation settings (inherited from defaults or customized)
  settings: EmulationSettings;

  // Tracks settings chosen automatically from the bundled compatibility database.
  compatibilityProfileVersion?: number;
  compatibilityConfidence?: 'high' | 'medium' | 'low';
  compatibilityReason?: string;
  catalogSource?: 'internet-archive' | 'freedos';
  catalogIdentifier?: string;
  inputProfile?: InputProfile;
  
  createdAt: number;
  lastPlayed?: number;
  playTimeMinutes?: number;
  playTimeSeconds?: number;
  playCount?: number;
}

export interface GamePreset {
  name: string;
  genre: string;
  year: number;
  developer: string;
  recommendedCycles: number | 'auto' | 'max';
  recommendedMachine: MachineType;
  recommendedScaler: ScalerType;
  recommendedSound: SoundBlasterType;
  executable: string;
  coverQuery: string;
  description: string;
}

export interface DiscoveredArchiveItem {
  fileName: string;
  filePath: string;
  relativePath: string;
  format: 'zip' | 'sfx_exe' | '7z' | 'rar' | 'arj' | 'lha' | 'inno' | string;
  sizeBytes: number;
}

export interface UnpackArchiveResult {
  success: boolean;
  message: string;
  extractedFilesCount: number;
  discoveredExecutable?: string;
  discoveredWorkingDir?: string;
  discoveredCdRomPath?: string;
  /** Real game name from bundled store metadata (e.g. GOG), when available. */
  discoveredTitle?: string;
  installerCandidates: import('./services/emulatorLauncher').ExecutableCandidate[];
}

export interface LibraryEntry {
  name: string;
  path: string;
  /** 'game' | 'scummvm' (installed) · 'archive' (needs unpacking) · 'empty' · 'file' */
  kind: string;
  title: string;
  executable: string;
  workingDir: string;
  sizeBytes: number;
  /** Folder name to unpack an archive into, cleaned of installer noise. */
  suggestedFolder: string;
  detail: string;
}
