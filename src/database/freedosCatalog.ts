import type { ArchiveGameItem } from '../services/archiveDownloader';

const FREEDOS_GAMES_BASE = 'https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.4/games';

type FreeDosEntry = {
  package: string;
  title: string;
  category: ArchiveGameItem['category'];
  version: string;
  year: string;
  author: string;
  license: string;
  crc32: string;
  description: string;
};

const entries: FreeDosEntry[] = [
  { package: 'blkdrop', title: 'BlockDrop', category: 'puzzle', version: '0.2', year: '2025', author: 'Jerome Shidel', license: 'BSD 3-Clause License', crc32: '0A472A65', description: 'A falling block game that is nothing like Tetris. Requires a mouse and 386+.' },
  { package: 'bolitare', title: 'Bolitaire', category: 'puzzle', version: '0.62b', year: '2015', author: 'Yogesh', license: 'GNU GPL v2', crc32: '0BFBB52A', description: 'A Freecell card game for DOS.' },
  { package: 'boom', title: 'Boom + Freedoom', category: 'action', version: '2.02a', year: '2013', author: 'Jim Flynn and contributors', license: 'GNU GPL v2', crc32: '961A7813', description: 'A GPL Doom source port packaged with Freedoom for a complete playable game.' },
  { package: 'dosdef', title: 'DOS Defender', category: 'action', version: '1.1.0', year: '2014', author: 'skeeto', license: 'Unlicense / Public Domain', crc32: 'B4B8B772', description: 'An x86 real-mode 2D shooter designed primarily for DOSBox.' },
  { package: 'drmind', title: 'Dr. Mind', category: 'puzzle', version: '1.0', year: '2019', author: 'Mateusz Viste', license: 'CC BY-ND 4.0', crc32: 'A0EA0C73', description: 'PC adaptation of a code-breaking board game.' },
  { package: 'eliza', title: 'Eliza', category: 'adventure', version: '1.01a', year: '2015', author: 'Michael Day', license: 'Public Domain', crc32: 'CFA4AFE5', description: 'One of the earliest computer AI chatterbots.' },
  { package: 'empong', title: 'Emeritus Pong', category: 'action', version: '0.92', year: '2013', author: 'Mateusz Viste', license: 'GNU GPL v3', crc32: 'F2CF3E76', description: 'A clone of the classic Pong game.' },
  { package: 'ev4de', title: 'EV4DE', category: 'action', version: '1.2a', year: '2017', author: 'OokiePigster', license: 'GNU GPL v3', crc32: '7B0358B3', description: 'Fly a ship through space, avoid asteroids and chase a high score.' },
  { package: 'ewsnake', title: 'EW Snake', category: 'puzzle', version: '0.5a', year: '2013', author: 'Federico Marverti', license: 'GNU GPL v2', crc32: '4B952B2C', description: 'A version of the classic Snake game for DOS.' },
  { package: 'flpybird', title: 'Floppy Bird', category: 'action', version: '1.0a', year: '2015', author: 'Mihail Szabolcs', license: 'MIT License', crc32: '317EDCAF', description: 'Fly a bird through obstacles by tapping the spacebar.' },
  { package: 'fmines', title: 'FancyMines', category: 'puzzle', version: '1.00', year: '2012', author: 'Mateusz Viste', license: 'GNU GPL v3', crc32: '6D63D30A', description: 'A Minesweeper-like game with graphical themes.' },
  { package: 'freedoom', title: 'Freedoom', category: 'action', version: '3.30c', year: '2024', author: 'Simon Howard, Lee Killough, John Carmack', license: 'Open source — see package licenses', crc32: '24D5FD1F', description: 'Doom source port with Freedoom Phase 1 and Phase 2 game data.' },
  { package: 'gnuchess', title: 'GNU Chess', category: 'strategy', version: '4.0 patch 60', year: '2013', author: 'Stuart Cracraft', license: 'GNU GPL v2', crc32: '808505AA', description: 'The classic communal GNU Chess program for DOS.' },
  { package: 'hangman', title: 'Hangman', category: 'puzzle', version: '1.05b', year: '2021', author: 'Mateusz Viste', license: 'GNU GPL v2', crc32: '6DACE76A', description: 'A multilingual Hangman word game.' },
  { package: 'ivan', title: 'Iter Vehemens ad Necem (IVAN)', category: 'adventure', version: '0.50', year: '2013', author: 'Timo Kiviluoto', license: 'GNU GPL v2', crc32: '71067C0C', description: 'A graphical fantasy roguelike.' },
  { package: 'kiloblas', title: 'Kiloblaster', category: 'action', version: '2.0a', year: '2015', author: 'Allen Pilgrim', license: 'Kiloblaster and Xargon Freeware License', crc32: '3D3B7B81', description: 'A fast-paced space shooter arcade game.' },
  { package: 'kraptor', title: 'KRaptor', category: 'action', version: 'Apr 2004', year: '2006', author: 'Kronoman', license: 'MIT License', crc32: '7AAA0D2D', description: 'An open-source Raptor-like vertical shooter with several levels.' },
  { package: 'lincrawl', title: "Linley's Dungeon Crawl", category: 'adventure', version: '4.0.0b26', year: '2013', author: 'Linley Henzell', license: 'Crawl General Public License', crc32: '9D107B27', description: 'A dungeon crawler in the tradition of Rogue, Hack and Moria.' },
  { package: 'liquiwar', title: 'Liquid War', category: 'strategy', version: '5.6.4', year: '2007', author: 'Christian Mauduit', license: 'GNU GPL v2', crc32: 'E7463D6F', description: 'A unique real-time multiplayer wargame.' },
  { package: 'mirmagic', title: 'Mirror Magic', category: 'puzzle', version: '2.0.2a', year: '2013', author: 'Holger Schemel', license: 'GNU GPL v2', crc32: '1EA0D1BD', description: 'An arcade puzzle game inspired by Deflektor and Mindbender.' },
  { package: 'mistral', title: 'The Mistral Report: Invisible Affairs', category: 'adventure', version: '1.1', year: '2020', author: 'Daniel Monteiro', license: 'GNU GPL v3', crc32: '21B21C19', description: 'An espionage-themed turn-based retro RPG.' },
  { package: 'nethack', title: 'NetHack', category: 'adventure', version: '3.6.7', year: '2023', author: 'NetHack DevTeam', license: 'NetHack General Public License', crc32: '32092F9A', description: 'The renowned single-player dungeon exploration game.' },
  { package: 'nge_nibb', title: 'NGE Nibbles', category: 'puzzle', version: '0.1.0a', year: '2013', author: 'Andrea Fazzi', license: 'GNU GPL v2', crc32: 'B05AED60', description: 'A graphical version of the classic Snake game.' },
  { package: 'noudar', title: 'Dungeons of Noudar 3D', category: 'adventure', version: '1.2', year: '2022', author: 'Daniel Monteiro', license: 'BSD 2-Clause License', crc32: '6042100C', description: 'A first-person 2.5D dungeon crawler inspired by 1990s RPGs.' },
  { package: 'psrinvad', title: 'INVADERS', category: 'action', version: '1.1l', year: '2023', author: 'Paul S. Reid', license: 'Open Source', crc32: '5696627A', description: 'A Space Invaders arcade clone.' },
  { package: 'qtetris', title: 'TETRIS Queen', category: 'puzzle', version: '1.4.1a', year: '2013', author: 'David A. Capello', license: 'GNU GPL v2', crc32: '6D988515', description: 'A Tetris clone and tribute to the band Queen.' },
  { package: 'row4', title: 'Four in a Row', category: 'strategy', version: '2023-08-15', year: '2017', author: 'Andreas K. Foerster', license: 'GNU AGPL v3+', crc32: '7F94A81E', description: 'A vertical four-in-a-row board game.' },
  { package: 'sayswho', title: 'SaysWho', category: 'puzzle', version: '0.2', year: '2022', author: 'Jerome Shidel', license: 'BSD 3-Clause License', crc32: '389E011D', description: 'A simple classic memory game for 386+.' },
  { package: 'senet', title: 'Senet', category: 'strategy', version: '1.0a', year: '2020', author: 'James Hall', license: 'GNU GPL v2', crc32: 'A1829D6D', description: 'A modern interpretation of the ancient Egyptian board game.' },
  { package: 'smiley', title: 'Smiley', category: 'action', version: '2021-11-10 alpha', year: '2021', author: 'Jerome Shidel', license: 'BSD 3-Clause License', crc32: '23DA8BDE', description: 'A simple Pong-style VGA game for 386+.' },
  { package: 'sudoku86', title: 'Sudoku86', category: 'puzzle', version: '1.0.3a', year: '2015', author: 'Mateusz Viste', license: 'BSD 2-Clause License', crc32: 'C11EA3E4', description: 'A 16-bit Sudoku game for 8086 and 8088 CPUs.' },
  { package: 'vertigo', title: 'Vertigo', category: 'racing', version: '0.26a', year: '2013', author: 'Anton Norup Sorensen', license: 'GNU GPL v2', crc32: 'B87920B6', description: 'A flight simulator focused on a realistic flight model.' },
  { package: 'vitetris', title: 'Vitetris', category: 'puzzle', version: '0.55a', year: '2013', author: 'Victor Nilsson', license: 'BSD 2-Clause License', crc32: 'CB1DC7A5', description: 'A terminal-based Tetris clone.' },
  { package: 'wing', title: 'Wing', category: 'action', version: '0.7a', year: '2013', author: 'Adam Hiatt, Anil Shrestra', license: 'GNU GPL v2', crc32: '860EB088', description: 'A Galaga-like space shooter.' },
  { package: 'zmiy', title: 'Zmiy', category: 'puzzle', version: '0.85.2a', year: '2015', author: 'Mateusz Viste', license: 'BSD 2-Clause License', crc32: '4F20C6A9', description: 'A Snake-style game for DOS and 8086.' }
];

export const FREEDOS_CATALOG: ArchiveGameItem[] = entries.map(entry => ({
  identifier: entry.package,
  title: entry.title,
  category: entry.category,
  year: entry.year,
  creator: entry.author,
  genre: `FreeDOS ${entry.category}`,
  description: entry.description,
  rating: 4.5,
  source: 'freedos',
  version: entry.version,
  license: entry.license,
  expectedCrc32: entry.crc32,
  downloadUrls: [`${FREEDOS_GAMES_BASE}/${entry.package}.zip`]
}));
