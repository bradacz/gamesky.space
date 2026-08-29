import { DOS_GAME_PRESETS } from '../database/dosGamePresets';
import { EmulatorType, EmulationSettings, GameProfile } from '../types';
import { DEFAULT_EMULATION_SETTINGS } from './storage';

export const COMPATIBILITY_PROFILE_VERSION = 2;

function normalizedTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findPreset(title: string) {
  const normalized = normalizedTitle(title);
  return DOS_GAME_PRESETS.find(preset => {
    const candidate = normalizedTitle(preset.name);
    return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
  });
}

function genericCycles(year: number | undefined, genre: string): number | 'max' {
  const normalizedGenre = genre.toLowerCase();
  if (normalizedGenre.includes('puzzle') || normalizedGenre.includes('card')) return 8000;
  if (normalizedGenre.includes('adventure')) return 10000;
  if (year && year <= 1989) return 3000;
  if (year && year <= 1992) return 8000;
  if (year && year <= 1995) return 18000;
  if (year && year <= 1999) return 30000;
  return 20000;
}

export function recommendedSettingsForGame(
  game: Pick<GameProfile, 'title' | 'year' | 'genre'>,
  emulatorType: EmulatorType
): EmulationSettings {
  const preset = findPreset(game.title);
  const year = game.year;
  const oldGame = typeof year === 'number' && year <= 1992;

  return {
    ...DEFAULT_EMULATION_SETTINGS,
    emulatorType,
    cycles: preset?.recommendedCycles ?? genericCycles(year, game.genre || ''),
    machine: preset?.recommendedMachine ?? (oldGame ? 'vga' : 'svga_s3'),
    scaler: preset?.recommendedScaler ?? 'normal2x',
    soundBlaster: preset?.recommendedSound ?? (oldGame ? 'sbpro2' : 'sb16'),
    memSizeMb: oldGame ? 16 : 32
  };
}

export function compatibilityAssessment(
  game: Pick<GameProfile, 'title' | 'year' | 'genre'>
): Pick<GameProfile, 'compatibilityConfidence' | 'compatibilityReason'> {
  const preset = findPreset(game.title);
  if (preset) {
    return {
      compatibilityConfidence: 'high',
      compatibilityReason: `Matched bundled profile for ${preset.name}`
    };
  }
  if (game.year || game.genre) {
    return {
      compatibilityConfidence: 'medium',
      compatibilityReason: 'Safe profile estimated from release year and genre'
    };
  }
  return {
    compatibilityConfidence: 'low',
    compatibilityReason: 'Conservative generic DOS defaults; run diagnostics after first launch'
  };
}

export function applyAutomaticCompatibilityProfile(
  game: GameProfile,
  emulatorType: EmulatorType
): GameProfile {
  if (game.compatibilityProfileVersion === COMPATIBILITY_PROFILE_VERSION) {
    return game;
  }

  if (game.settings.settingsLocked) {
    return {
      ...game,
      compatibilityProfileVersion: COMPATIBILITY_PROFILE_VERSION,
      compatibilityConfidence: game.compatibilityConfidence || 'medium',
      compatibilityReason: game.compatibilityReason || 'User settings preserved'
    };
  }

  return {
    ...game,
    settings: { ...recommendedSettingsForGame(game, emulatorType), settingsLocked: false },
    compatibilityProfileVersion: COMPATIBILITY_PROFILE_VERSION,
    ...compatibilityAssessment(game)
  };
}
