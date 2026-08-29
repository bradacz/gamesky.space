import { useState, useEffect, useRef, useCallback } from 'react';
import { retroAudio } from '../audio/retroSynth';

export interface CoinBlock {
  id: number;
  worldX: number; // in px
  worldY: number; // px from ground
  collected: boolean;
  type: 'coin' | 'turbo' | 'easteregg';
  label?: string;
}

export interface ZoneAnchor {
  id: string;
  name: string;
  worldX: number;
  fKey: string;
}

export const ZONES: ZoneAnchor[] = [
  { id: 'zone-1', name: 'C:\\> PROMPT', worldX: 100, fKey: 'F1' },
  { id: 'zone-2', name: 'NORTON GATE', worldX: 1900, fKey: 'F2' },
  { id: 'zone-3', name: 'SOUND CANYON', worldX: 3800, fKey: 'F3' },
  { id: 'zone-4', name: 'DRIVE BAY', worldX: 5700, fKey: 'F4' },
  { id: 'zone-5', name: 'SAVE VAULT', worldX: 7600, fKey: 'F5' },
  { id: 'zone-6', name: 'HALL OF FAME', worldX: 9500, fKey: 'F6' },
  { id: 'zone-7', name: 'DOWNLOAD', worldX: 11400, fKey: 'F10' },
];

export const TOTAL_WORLD_WIDTH = 13000;

export function usePlatformerGame() {
  const [worldOffset, setWorldOffset] = useState<number>(0);
  const [targetOffset, setTargetOffset] = useState<number>(0);
  const [heroState, setHeroState] = useState<'idle' | 'run-right' | 'run-left' | 'jump'>('idle');
  const [heroY, setHeroY] = useState<number>(0); // 0 is ground, > 0 is jumping
  const [isJumping, setIsJumping] = useState<boolean>(false);
  const [score, setScore] = useState<number>(4860);
  const [coinsCollected, setCoinsCollected] = useState<number>(0);
  const [turboMode, setTurboMode] = useState<'33' | '66' | '100'>('66');
  const [crtEnabled, setCrtEnabled] = useState<boolean>(true);
  const [activeZone, setActiveZone] = useState<number>(0);
  const [godMode, setGodMode] = useState<boolean>(false);

  const [coinBlocks, setCoinBlocks] = useState<CoinBlock[]>([
    { id: 1, worldX: 650, worldY: 130, collected: false, type: 'coin', label: '?' },
    { id: 2, worldX: 850, worldY: 130, collected: false, type: 'coin', label: '?' },
    { id: 3, worldX: 1200, worldY: 160, collected: false, type: 'turbo', label: '⚡' },
    { id: 4, worldX: 2500, worldY: 140, collected: false, type: 'coin', label: '?' },
    { id: 5, worldX: 2800, worldY: 170, collected: false, type: 'coin', label: '?' },
    { id: 6, worldX: 4400, worldY: 150, collected: false, type: 'coin', label: '?' },
    { id: 7, worldX: 6300, worldY: 150, collected: false, type: 'coin', label: '?' },
    { id: 8, worldX: 8200, worldY: 150, collected: false, type: 'coin', label: '?' },
    { id: 9, worldX: 10100, worldY: 160, collected: false, type: 'easteregg', label: '★' },
    { id: 10, worldX: 11000, worldY: 140, collected: false, type: 'coin', label: '?' },
  ]);

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const cheatBuffer = useRef<string>('');
  const lastTimeRef = useRef<number>(performance.now());
  const jumpVelocityRef = useRef<number>(0);

  // Jump Trigger
  const triggerJump = useCallback(() => {
    if (isJumping) return;
    setIsJumping(true);
    jumpVelocityRef.current = 14;
    retroAudio.playJump();
  }, [isJumping]);

  // Warp to specific Zone (F1-F10)
  const warpToZone = useCallback((zoneIndex: number) => {
    if (zoneIndex >= 0 && zoneIndex < ZONES.length) {
      const target = ZONES[zoneIndex].worldX;
      setTargetOffset(target);
      retroAudio.playFloppySeek();
    }
  }, []);

  // Wheel / Touch Scroll Handler
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Delta normalization
      const delta = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * 1.5;
      const speedMultiplier = turboMode === '100' ? 2.0 : turboMode === '66' ? 1.2 : 0.8;

      setTargetOffset((prev) => {
        const next = Math.max(0, Math.min(TOTAL_WORLD_WIDTH - window.innerWidth, prev + delta * speedMultiplier));
        return next;
      });

      if (delta > 20) {
        setHeroState('run-right');
      } else if (delta < -20) {
        setHeroState('run-left');
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [turboMode]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;

      // Space -> Jump
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        triggerJump();
      }

      // F-Keys
      if (e.key === 'F1') { e.preventDefault(); warpToZone(0); }
      if (e.key === 'F2') { e.preventDefault(); warpToZone(1); }
      if (e.key === 'F3') { e.preventDefault(); warpToZone(2); }
      if (e.key === 'F4') { e.preventDefault(); warpToZone(3); }
      if (e.key === 'F5') { e.preventDefault(); warpToZone(4); }
      if (e.key === 'F6') { e.preventDefault(); warpToZone(5); }
      if (e.key === 'F10') { e.preventDefault(); warpToZone(6); }

      // Cheat code detection (IDDQD / DNKROZ / TURBO)
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        cheatBuffer.current += e.key.toUpperCase();
        if (cheatBuffer.current.length > 10) {
          cheatBuffer.current = cheatBuffer.current.slice(-10);
        }
        if (cheatBuffer.current.includes('IDDQD')) {
          setGodMode(true);
          setScore((s) => s + 99999);
          retroAudio.playVictory();
          cheatBuffer.current = '';
        } else if (cheatBuffer.current.includes('TURBO')) {
          setTurboMode('100');
          retroAudio.playRolandFanfare();
          cheatBuffer.current = '';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [triggerJump, warpToZone]);

  // Main Game Loop (Physics, Lerp, Coins Collision)
  useEffect(() => {
    let animationFrameId: number;

    const gameLoop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = currentTime;

      const speedBase = turboMode === '100' ? 900 : turboMode === '66' ? 550 : 350;
      let movingDirection = 0;

      if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
        movingDirection += 1;
      }
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
        movingDirection -= 1;
      }

      if (movingDirection !== 0) {
        setTargetOffset((prev) => {
          const next = prev + movingDirection * speedBase * dt;
          return Math.max(0, Math.min(TOTAL_WORLD_WIDTH - window.innerWidth, next));
        });
        setHeroState(movingDirection > 0 ? 'run-right' : 'run-left');
      } else if (!isJumping) {
        setHeroState('idle');
      }

      // Smooth Lerp for world offset
      setWorldOffset((prev) => {
        const diff = targetOffset - prev;
        if (Math.abs(diff) < 0.2) return targetOffset;
        return prev + diff * 0.15;
      });

      // Jump Physics
      if (isJumping) {
        setHeroY((prevY) => {
          const nextY = prevY + jumpVelocityRef.current;
          jumpVelocityRef.current -= 0.8; // gravity
          if (nextY <= 0) {
            setIsJumping(false);
            jumpVelocityRef.current = 0;
            return 0;
          }
          return nextY;
        });
      }

      // Collision Check with Coin Blocks
      // Hero screen center X is ~150px (or fixed hero X)
      const currentHeroWorldX = worldOffset + 180;
      const currentHeroTopY = (isJumping ? heroY : 0) + 70; // hero height

      setCoinBlocks((blocks) => {
        let changed = false;
        const newBlocks = blocks.map((b) => {
          if (!b.collected) {
            // Check if hero is near and jumping up
            const distanceX = Math.abs(currentHeroWorldX - b.worldX);
            if (distanceX < 50 && currentHeroTopY >= b.worldY && currentHeroTopY <= b.worldY + 40) {
              changed = true;
              retroAudio.playCoin();
              setScore((s) => s + 100);
              setCoinsCollected((c) => c + 1);
              return { ...b, collected: true };
            }
          }
          return b;
        });
        return changed ? newBlocks : blocks;
      });

      // Determine active zone based on worldOffset
      const screenMid = worldOffset + window.innerWidth / 2;
      let closestZone = 0;
      for (let i = 0; i < ZONES.length; i++) {
        if (screenMid >= ZONES[i].worldX) {
          closestZone = i;
        }
      }
      setActiveZone(closestZone);

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [targetOffset, worldOffset, isJumping, heroY, turboMode]);

  return {
    worldOffset,
    targetOffset,
    heroState,
    heroY,
    isJumping,
    score,
    coinsCollected,
    turboMode,
    setTurboMode,
    crtEnabled,
    setCrtEnabled,
    activeZone,
    godMode,
    coinBlocks,
    triggerJump,
    warpToZone,
    setTargetOffset,
  };
}
