import type { InputMapping, InputProfile } from '../types';

type TemplateId = 'platformer' | 'fps' | 'adventure' | 'racing' | 'native';

const keyboardDefaults: Record<string, string> = {
  key_up: 'key 82',
  key_down: 'key 81',
  key_left: 'key 80',
  key_right: 'key 79',
  key_space: 'key 44',
  key_lctrl: 'key 224',
  key_lalt: 'key 226',
  key_enter: 'key 40',
  key_esc: 'key 41',
  key_w: 'key 26',
  key_a: 'key 4',
  key_s: 'key 22',
  key_d: 'key 7'
};

const templates: Record<TemplateId, { name: string; mode: InputProfile['mode']; joystickType: InputProfile['joystickType']; mappings: InputMapping[] }> = {
  platformer: {
    name: 'Platformer', mode: 'keyboard-mapper', joystickType: 'hidden', mappings: [
      { dosEvent: 'key_up', bindings: ['stick_0 hat 0 1', 'stick_0 axis 1 0'] },
      { dosEvent: 'key_right', bindings: ['stick_0 hat 0 2', 'stick_0 axis 0 1'] },
      { dosEvent: 'key_down', bindings: ['stick_0 hat 0 4', 'stick_0 axis 1 1'] },
      { dosEvent: 'key_left', bindings: ['stick_0 hat 0 8', 'stick_0 axis 0 0'] },
      { dosEvent: 'key_space', bindings: ['stick_0 button 0'] },
      { dosEvent: 'key_lctrl', bindings: ['stick_0 button 1'] },
      { dosEvent: 'key_enter', bindings: ['stick_0 button 7'] },
      { dosEvent: 'key_esc', bindings: ['stick_0 button 6'] }
    ]
  },
  fps: {
    name: 'FPS / WASD', mode: 'keyboard-mapper', joystickType: 'hidden', mappings: [
      { dosEvent: 'key_w', bindings: ['stick_0 hat 0 1', 'stick_0 axis 1 0'] },
      { dosEvent: 'key_d', bindings: ['stick_0 hat 0 2', 'stick_0 axis 0 1'] },
      { dosEvent: 'key_s', bindings: ['stick_0 hat 0 4', 'stick_0 axis 1 1'] },
      { dosEvent: 'key_a', bindings: ['stick_0 hat 0 8', 'stick_0 axis 0 0'] },
      { dosEvent: 'key_lctrl', bindings: ['stick_0 button 0'] },
      { dosEvent: 'key_space', bindings: ['stick_0 button 1'] },
      { dosEvent: 'key_enter', bindings: ['stick_0 button 7'] },
      { dosEvent: 'key_esc', bindings: ['stick_0 button 6'] }
    ]
  },
  adventure: {
    name: 'Adventure', mode: 'keyboard-mapper', joystickType: 'hidden', mappings: [
      { dosEvent: 'key_up', bindings: ['stick_0 hat 0 1'] },
      { dosEvent: 'key_right', bindings: ['stick_0 hat 0 2'] },
      { dosEvent: 'key_down', bindings: ['stick_0 hat 0 4'] },
      { dosEvent: 'key_left', bindings: ['stick_0 hat 0 8'] },
      { dosEvent: 'key_enter', bindings: ['stick_0 button 0', 'stick_0 button 7'] },
      { dosEvent: 'key_esc', bindings: ['stick_0 button 1', 'stick_0 button 6'] }
    ]
  },
  racing: {
    name: 'Racing', mode: 'keyboard-mapper', joystickType: 'hidden', mappings: [
      { dosEvent: 'key_up', bindings: ['stick_0 axis 5 2', 'stick_0 button 0'] },
      { dosEvent: 'key_down', bindings: ['stick_0 axis 2 2', 'stick_0 button 1'] },
      { dosEvent: 'key_left', bindings: ['stick_0 axis 0 0'] },
      { dosEvent: 'key_right', bindings: ['stick_0 axis 0 1'] },
      { dosEvent: 'key_enter', bindings: ['stick_0 button 7'] },
      { dosEvent: 'key_esc', bindings: ['stick_0 button 6'] }
    ]
  },
  native: {
    name: 'Native DOS Joystick', mode: 'native-joystick', joystickType: 'auto', mappings: []
  }
};

export class InputProfileService {
  public static create(templateId: string, gameId: string): InputProfile {
    const template = templates[(templateId in templates ? templateId : 'platformer') as TemplateId];
    return {
      id: `input-${gameId}`,
      name: template.name,
      mode: template.mode,
      joystickType: template.joystickType,
      deadzone: 10,
      autofire: false,
      circularInput: templateId === 'racing',
      mappings: template.mappings.map(mapping => ({ ...mapping, bindings: [...mapping.bindings] }))
    };
  }

  public static mapperText(profile: InputProfile): string {
    const lines = [
      '# GameSky.space per-game controller profile',
      `# ${profile.name}`
    ];
    for (const mapping of profile.mappings) {
      const bindings = [keyboardDefaults[mapping.dosEvent], ...mapping.bindings]
        .filter(Boolean)
        .map(binding => `"${binding}"`)
        .join(' ');
      lines.push(`${mapping.dosEvent} ${bindings}`);
    }
    return `${lines.join('\n')}\n`;
  }

  public static preview(profile: InputProfile): string {
    if (profile.mode === 'native-joystick') {
      return 'Native DOS joystick mode\nDOSBox receives the controller as an emulated analog joystick.';
    }
    return profile.mappings
      .map(mapping => `${mapping.dosEvent.replace('key_', '').toUpperCase().padEnd(8)} ← ${mapping.bindings.join(' + ')}`)
      .join('\n');
  }

  public static async save(gameId: string, profile: InputProfile): Promise<string | undefined> {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) return undefined;
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('save_mapper_profile', {
      gameId,
      content: this.mapperText(profile)
    });
  }
}
