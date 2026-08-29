import { GameProfile } from '../types';

export function generateDosboxConf(game: GameProfile): string {
  const { settings, drives, executable, parameters, workingDir } = game;
  const mediaSets = drives.mediaSets || [];
  const hasManagedFloppy = mediaSets.some(set => set.items.some(item => item.kind === 'floppy'));
  const hasManagedCd = mediaSets.some(set => set.items.some(item => item.kind === 'cdrom' || item.kind === 'directory'));

  // Autoexec commands generation
  const autoexecLines: string[] = [
    `@echo off`,
    `echo ====================================================`,
    `echo   GameSky.space - Launcher Engine`,
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
    const isImage = lowerCd.endsWith('.iso') || lowerCd.endsWith('.cue') || lowerCd.endsWith('.bin') || lowerCd.endsWith('.img') || lowerCd.endsWith('.nrg') || lowerCd.endsWith('.mds') || lowerCd.endsWith('.mdf');
    if (isImage) {
      autoexecLines.push(`imgmount d "${escapePath(cd)}" -t iso`);
    } else {
      autoexecLines.push(`mount d "${escapePath(cd)}" -t cdrom`);
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
        autoexecLines.push(`imgmount ${letter} "${escapePath(item.path)}" -t ${mountType}`);
      });
    } else {
      const paths = items.map(item => `"${escapePath(item.path)}"`).join(' ');
      const mountType = kind === 'floppy' ? 'floppy' : 'iso';
      autoexecLines.push(`imgmount ${baseLetter} ${paths} -t ${mountType}`);
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
    autoexecLines.push(`cd "${sanitizeDosArgument(workingDir.trim())}"`);
  }

  // User custom autoexec lines
  if (settings.customAutoexecLines && settings.customAutoexecLines.length > 0) {
    autoexecLines.push(...settings.customAutoexecLines);
  }

  // Launch executable
  if (executable && executable.trim() !== '') {
    const params = parameters ? ` ${sanitizeDosLine(parameters.trim())}` : '';
    const safeExecutable = sanitizeDosArgument(executable.trim());
    const executableCommand = /^[A-Za-z0-9_~.$!#@%&'()+,;=\-\\]+$/.test(safeExecutable)
      ? safeExecutable
      : `"${safeExecutable}"`;
    autoexecLines.push(`${executableCommand}${params}`);
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

function escapePath(p: string): string {
  return sanitizeDosArgument(p);
}

function sanitizeDosLine(value: string): string {
  return value.replace(/[\r\n]/g, ' ').replace(/[&|<>]/g, '');
}

function sanitizeDosArgument(value: string): string {
  return value.replace(/[\r\n]/g, ' ').replace(/"/g, '');
}
