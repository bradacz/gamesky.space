import { GameProfile } from '../types';

export interface GenerateConfOptions {
  mode?: 'game' | 'installer' | 'file-manager';
  overrideExecutable?: string;
  overrideWorkingDir?: string;
  overrideParameters?: string;
  toolsMountPath?: string;
  customNortonCommanderPath?: string;
}

export function generateDosboxConf(game: GameProfile, options?: GenerateConfOptions): string {
  const { settings, drives } = game;
  const mode = options?.mode || 'game';
  const executable = options?.overrideExecutable !== undefined ? options.overrideExecutable : game.executable;
  const workingDir = options?.overrideWorkingDir !== undefined ? options.overrideWorkingDir : game.workingDir;
  const parameters = options?.overrideParameters !== undefined ? options.overrideParameters : game.parameters;

  const mediaSets = drives.mediaSets || [];
  const hasManagedFloppy = mediaSets.some(set => set.items.some(item => item.kind === 'floppy'));
  const hasManagedCd = mediaSets.some(set => set.items.some(item => item.kind === 'cdrom' || item.kind === 'directory'));

  const modeBadge = mode === 'file-manager'
    ? ' [DOS File Manager Mode]'
    : mode === 'installer'
      ? ' [Setup / Installer Mode]'
      : '';

  // Autoexec commands generation
  const autoexecLines: string[] = [
    `@echo off`,
    `echo ====================================================`,
    `echo   GameSky.space - Launcher Engine${modeBadge}`,
    `echo   Title: ${sanitizeDosLine(game.title)}`,
    `echo ====================================================`,
    `echo.`
  ];

  // SoundBlaster Environment variables
  if (settings.soundBlaster !== 'none') {
    const tVal = settings.soundBlaster === 'sb16' ? '6' : settings.soundBlaster === 'sbpro2' ? '4' : '3';
    autoexecLines.push(
      `SET BLASTER=A${settings.sbPort} I${settings.sbIrq} D${settings.sbDma} H${settings.sbHdma} T${tVal}`
    );
  }

  // Mount Tools Drive Y: in file-manager mode
  let toolsFolder = options?.toolsMountPath && options.toolsMountPath.trim() !== '' ? options.toolsMountPath.trim() : '';
  let customExeName = '';

  if (mode === 'file-manager') {
    const customNC = options?.customNortonCommanderPath?.trim();
    if (customNC) {
      if (/\.(exe|com|bat)$/i.test(customNC)) {
        const lastSlash = Math.max(customNC.lastIndexOf('/'), customNC.lastIndexOf('\\'));
        if (lastSlash > 0) {
          toolsFolder = customNC.substring(0, lastSlash);
          customExeName = customNC.substring(lastSlash + 1);
        } else {
          customExeName = customNC;
        }
      } else {
        toolsFolder = customNC;
        customExeName = 'nc.exe';
      }
    }

    if (toolsFolder) {
      autoexecLines.push(`mount y "${escapePath(toolsFolder)}"`);
      autoexecLines.push(`SET PATH=Y:\\;%PATH%`);
    }
  }

  // Mount Floppy Drive A:
  if (!hasManagedFloppy && drives.floppyPath && drives.floppyPath.trim() !== '') {
    const p = drives.floppyPath.trim();
    if (p.endsWith('.img') || p.endsWith('.ima') || p.endsWith('.vfd')) {
      autoexecLines.push(`imgmount a "${escapePath(p)}" -t floppy`);
    } else {
      autoexecLines.push(`mount a "${escapePath(p)}"`);
    }
  }

  // Mount Hard Disk C:
  if (drives.cDrivePath && drives.cDrivePath.trim() !== '') {
    autoexecLines.push(`mount c "${escapePath(drives.cDrivePath.trim())}"`);
  } else {
    // Fallback if not specified: mount default working directory
    autoexecLines.push(`mount c "."`);
  }

  // Mount CD-ROM D:
  if (!hasManagedCd && drives.cdRomPath && drives.cdRomPath.trim() !== '') {
    const cd = drives.cdRomPath.trim();
    const lowerCd = cd.toLowerCase();
    const isImage =
      lowerCd.endsWith('.iso') ||
      lowerCd.endsWith('.cue') ||
      lowerCd.endsWith('.bin') ||
      lowerCd.endsWith('.img') ||
      lowerCd.endsWith('.nrg') ||
      lowerCd.endsWith('.mds') ||
      lowerCd.endsWith('.mdf') ||
      lowerCd.endsWith('.ins');
    const needsIsoFs = needsExplicitIsoFilesystem(lowerCd);
    const fallbackLabel =
      game.title.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/)[0]?.toUpperCase() || 'ALBION';
    const labelArg = drives.cdRomLabel && drives.cdRomLabel.trim() !== ''
      ? ` -label "${drives.cdRomLabel.trim()}"`
      : ` -label "${fallbackLabel}"`;

    if (isImage) {
      // imgmount takes the label from the image itself; passing -label makes
      // DOSBox read it as a second disc path.
      const fsArg = needsIsoFs ? ' -fs iso' : '';
      autoexecLines.push(`imgmount d "${escapePath(cd)}" -t iso${fsArg}`);
    } else {
      autoexecLines.push(`mount d "${escapePath(cd)}" -t cdrom${labelArg}`);
    }
  }

  // Managed single- and multi-disc sets.
  for (const mediaSet of mediaSets) {
    const items = mediaSet.items.filter(item => item.path.trim() !== '');
    if (items.length === 0) continue;
    const baseLetter = /^[A-Y]$/i.test(mediaSet.driveLetter) ? mediaSet.driveLetter.toLowerCase() : 'd';
    const kind = items[0].kind;

    if (kind === 'directory') {
      autoexecLines.push(`mount ${baseLetter} "${escapePath(items[0].path)}" -t cdrom`);
    } else if (mediaSet.mode === 'separate-drives') {
      const baseCode = baseLetter.toUpperCase().charCodeAt(0);
      items.forEach((item, index) => {
        const letter = String.fromCharCode(baseCode + index).toLowerCase();
        const mountType = kind === 'floppy' ? 'floppy' : 'iso';
        const fsArg = kind !== 'floppy' && needsExplicitIsoFilesystem(item.path) ? ' -fs iso' : '';
        autoexecLines.push(`imgmount ${letter} "${escapePath(item.path)}" -t ${mountType}${fsArg}`);
      });
    } else {
      const paths = items.map(item => `"${escapePath(item.path)}"`).join(' ');
      const mountType = kind === 'floppy' ? 'floppy' : 'iso';
      const fsArg =
        kind !== 'floppy' && items.some(item => needsExplicitIsoFilesystem(item.path))
          ? ' -fs iso'
          : '';
      autoexecLines.push(`imgmount ${baseLetter} ${paths} -t ${mountType}${fsArg}`);
    }
  }

  // Extra Drives
  if (drives.mountExtraDrives && drives.mountExtraDrives.length > 0) {
    for (const extra of drives.mountExtraDrives) {
      if (extra.path && extra.driveLetter) {
        if (extra.type === 'cdrom') {
          autoexecLines.push(`imgmount ${extra.driveLetter.toLowerCase()} "${escapePath(extra.path)}" -t cdrom`);
        } else if (extra.type === 'floppy') {
          autoexecLines.push(`imgmount ${extra.driveLetter.toLowerCase()} "${escapePath(extra.path)}" -t floppy`);
        } else {
          autoexecLines.push(`mount ${extra.driveLetter.toLowerCase()} "${escapePath(extra.path)}"`);
        }
      }
    }
  }

  // Navigate to C:
  autoexecLines.push(`c:`);

  // Navigate to game subfolder if specified
  if (workingDir && workingDir.trim() !== '') {
    const cleanWdir = sanitizeDosArgument(workingDir.trim()).replace(/\//g, '\\');
    autoexecLines.push(`cd ${cleanWdir}`);
  }

  // User custom autoexec lines
  if (settings.customAutoexecLines && settings.customAutoexecLines.length > 0) {
    autoexecLines.push(...settings.customAutoexecLines);
  }

  // Launch execution depending on mode
  if (mode === 'file-manager') {
    if (customExeName) {
      autoexecLines.push(`if exist y:\\${customExeName} y:\\${customExeName}`);
    }
    autoexecLines.push(`call y:\\nc.bat`);
  } else if (executable && executable.trim() !== '') {
    const params = parameters ? ` ${sanitizeDosLine(parameters.trim())}` : '';
    const safeExecutable = sanitizeDosArgument(executable.trim()).replace(/\//g, '\\');
    autoexecLines.push(`${safeExecutable}${params}`);
  }

  // Cycles setting formatting
  let cyclesStr = 'auto';
  if (settings.cycles === 'max') {
    cyclesStr = 'max';
  } else if (typeof settings.cycles === 'number') {
    cyclesStr = `fixed ${settings.cycles}`;
  }

  // Render output formatting
  const output = settings.renderOutput === 'default' ? 'opengl' : settings.renderOutput;

  // Scaler
  const scalerVal = settings.scaler === 'none' ? 'normal2x' : settings.scaler;

  const isFullscreen = settings.fullscreen === true;
  const fullres = isFullscreen ? 'desktop' : 'original';

  const confContent = `
# GameSky.space Configuration
# Generated for: ${game.title}

[sdl]
fullscreen=${isFullscreen ? 'true' : 'false'}
fulldouble=${isFullscreen ? 'true' : 'false'}
fullresolution=${fullres}
windowresolution=${settings.windowResolution || '1280x960'}
output=${output}
autolock=true
sensitivity=100
waitonerror=true
priority=higher,normal
usescancodes=true
${settings.mapperFilePath ? `mapperfile=${settings.mapperFilePath}` : ''}

[dosbox]
language=
machine=${settings.machine}
captures=capture
memsize=${settings.memSizeMb || 32}

[render]
frameskip=0
aspect=${settings.aspectCorrection ? 'true' : 'false'}
scaler=${scalerVal}

[cpu]
core=${settings.cpuCore}
cputype=${settings.cpuType}
cycles=${cyclesStr}
cycleup=${settings.cycleUp || 500}
cycledown=${settings.cycleDown || 500}

[mixer]
nosound=false
rate=44100
blocksize=1024
prebuffer=20

[midi]
mpu401=intelligent
mididevice=${settings.midiDevice === 'coreaudio' ? 'coreaudio' : 'default'}
midiconfig=

[sblaster]
sbtype=${settings.soundBlaster}
sbbase=${settings.sbPort}
irq=${settings.sbIrq}
dma=${settings.sbDma}
hdma=${settings.sbHdma}
sbmixer=true
oplmode=auto
oplemu=default
oplrate=44100

[gus]
gus=${settings.enableGus ? 'true' : 'false'}
gusrate=44100
gusbase=240
gusirq=5
gusdma=3
ultradir=C:\\ULTRASND

[speaker]
pcspeaker=${settings.enablePcSpeaker ? 'true' : 'false'}
pcrate=44100
tandy=auto
tandyrate=44100
disney=true

[joystick]
joysticktype=${settings.joystickType || 'auto'}
timed=true
autofire=${settings.joystickAutofire ? 'true' : 'false'}
swap34=false
buttonwrap=false
deadzone=${settings.joystickDeadzone ?? 10}
circularinput=${settings.joystickCircularInput ? 'true' : 'false'}

[serial]
serial1=dummy
serial2=dummy
serial3=disabled
serial4=disabled

[dos]
xms=true
ems=true
umb=true
keyboardlayout=auto

[autoexec]
${autoexecLines.join('\n')}
`.trim();

  return confContent;
}

/**
 * Raw-sector images (CUE sheets, GOG's .ins, bare .bin) need an explicit
 * filesystem; without it DOSBox reads the sector layout as the volume and
 * games that probe the disc report it as missing.
 */
function needsExplicitIsoFilesystem(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith('.cue') || lower.endsWith('.ins') || lower.endsWith('.bin');
}

function escapePath(p: string): string {
  return sanitizeDosArgument(p);
}

function sanitizeDosLine(value: string): string {
  return value.replace(/[\r\n]/g, ' ').replace(/[&|<>]/g, '');
}

function sanitizeDosArgument(value: string): string {
  return value.replace(/[\r\n]/g, ' ').replace(/"/g, '');
}
