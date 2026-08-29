import { FREEDOS_CATALOG } from '../database/freedosCatalog';

export type CatalogSource = 'all' | 'internet-archive' | 'freedos';

export interface ArchiveGameItem {
  identifier: string;
  title: string;
  category: 'action' | 'adventure' | 'strategy' | 'platformer' | 'racing' | 'puzzle';
  year?: string;
  creator?: string;
  genre?: string;
  description?: string;
  downloads?: number;
  rating?: number;
  thumbnailUrl?: string;
  downloadUrls?: string[];
  source?: 'internet-archive' | 'freedos';
  version?: string;
  license?: string;
  expectedCrc32?: string;
  licenseStatus?: 'verified-redistributable' | 'unknown';
  licenseEvidence?: string;
}

export interface DownloadResult {
  success: boolean;
  message: string;
  installed?: boolean;
  targetFolder?: string;
  executable?: string;
  workingDir?: string;
}

// Curated popular instant games with direct verified multi-source mirrors
export const CURATED_CATALOG: ArchiveGameItem[] = [
  // ACTION & FPS
  {
    identifier: "msdos_Wolfenstein_3D_1992",
    title: "Wolfenstein 3D",
    category: "action",
    year: "1992",
    genre: "3D First-Person Shooter",
    creator: "id Software / Apogee",
    description: "The legendary grandfather of 3D shooters. Escape from Castle Wolfenstein.",
    rating: 4.9,
    downloads: 1400000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Wolfenstein_3D_1992",
    downloadUrls: [
      "https://archive.org/download/msdos_Wolfenstein_3D_1992/Wolfenstein_3D_1992.zip"
    ]
  },
  {
    identifier: "doom_dos",
    title: "DOOM (Shareware)",
    category: "action",
    year: "1993",
    genre: "3D First-Person Shooter",
    creator: "id Software",
    description: "Fight through the infested moon base on Phobos in the ultimate action masterpiece.",
    rating: 5.0,
    downloads: 595000,
    thumbnailUrl: "https://archive.org/services/img/doom_dos",
    downloadUrls: [
      "https://archive.org/download/doom_dos/doom.zip",
      "https://archive.org/download/Doom-2/Doom2.zip"
    ]
  },
  {
    identifier: "DUKE3D_DOS",
    title: "Duke Nukem 3D",
    category: "action",
    year: "1996",
    genre: "3D First-Person Shooter",
    creator: "3D Realms",
    description: "Hail to the king, baby! Kick alien ass through dynamic Los Angeles cityscapes.",
    rating: 4.8,
    downloads: 129000,
    thumbnailUrl: "https://archive.org/services/img/DUKE3D_DOS",
    downloadUrls: [
      "https://archive.org/download/DUKE3D_DOS/DUKE3D.zip"
    ]
  },
  {
    identifier: "duke-nukem2-sw",
    title: "Duke Nukem II",
    category: "action",
    year: "1993",
    genre: "Action Side-Scroller",
    creator: "Apogee Software",
    description: "Duke escapes Rigelat alien captors with high power laser cannons and rocket launchers.",
    rating: 4.7,
    downloads: 98000,
    thumbnailUrl: "https://archive.org/services/img/duke-nukem2-sw",
    downloadUrls: [
      "https://archive.org/download/duke-nukem2-sw/duke2.zip"
    ]
  },
  {
    identifier: "msdos_Heretic_-_Shadow_of_the_Serpent_Riders_1996",
    title: "Heretic: Shadow of the Serpent Riders",
    category: "action",
    year: "1994",
    genre: "Dark Fantasy FPS",
    creator: "Raven Software / id",
    description: "Dark fantasy action with magic wands, crossbows, flight items, and undead hordes.",
    rating: 4.7,
    downloads: 120000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Heretic_-_Shadow_of_the_Serpent_Riders_1996",
    downloadUrls: [
      "https://archive.org/download/msdos_Heretic_-_Shadow_of_the_Serpent_Riders_1996/Heretic_-_Shadow_of_the_Serpent_Riders_1996.zip",
      "https://archive.org/download/msdos_Heretic_1994/Heretic_1994.zip"
    ]
  },
  {
    identifier: "msdos_Tyrian_2000_1999",
    title: "Tyrian 2000",
    category: "action",
    year: "1995",
    genre: "Vertical Arcade Shmup",
    creator: "Epic MegaGames",
    description: "The peak of 90s vertical arcade shoot-em-ups with ship upgrades and epic soundtrack.",
    rating: 4.8,
    downloads: 95000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Tyrian_2000_1999",
    downloadUrls: [
      "https://archive.org/download/msdos_Tyrian_2000_1999/Tyrian_2000_1999.zip"
    ]
  },
  {
    identifier: "Raptor-sw1",
    title: "Raptor: Call of the Shadows",
    category: "action",
    year: "1994",
    genre: "Mercenary Air Shmup",
    creator: "Cygnus Studios / Apogee",
    description: "Fly the advanced Raptor starfighter as a mercenary destroying corporate forces.",
    rating: 4.8,
    downloads: 145000,
    thumbnailUrl: "https://archive.org/services/img/Raptor-sw1",
    downloadUrls: [
      "https://archive.org/download/Raptor-sw1/raptor.zip"
    ]
  },

  // PLATFORMERS & ARCADE
  {
    identifier: "msdos_Jazz_Jackrabbit_1994",
    title: "Jazz Jackrabbit",
    category: "platformer",
    year: "1994",
    genre: "Fast Action Platformer",
    creator: "Epic MegaGames",
    description: "High speed green hare platformer adventure blasting turtles across planets.",
    rating: 4.9,
    downloads: 210000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Jazz_Jackrabbit_1994",
    downloadUrls: [
      "https://archive.org/download/msdos_Jazz_Jackrabbit_1994/Jazz_Jackrabbit_1994.zip"
    ]
  },
  {
    identifier: "Keen4e-sw",
    title: "Commander Keen 4: Secret of the Oracle",
    category: "platformer",
    year: "1991",
    genre: "Smooth Scrolling Platformer",
    creator: "id Software / Apogee",
    description: "Billy Blaze in his pogo stick mission on Shadowlands to rescue the Gnosticus council.",
    rating: 4.9,
    downloads: 160000,
    thumbnailUrl: "https://archive.org/services/img/Keen4e-sw",
    downloadUrls: [
      "https://archive.org/download/msdos_Commander_Keen_4_-_Secret_of_the_Oracle_1991/Commander_Keen_4_-_Secret_of_the_Oracle_1991.zip"
    ]
  },
  {
    identifier: "msdos_Prince_of_Persia_1990",
    title: "Prince of Persia",
    category: "platformer",
    year: "1990",
    genre: "Cinematic Platformer",
    creator: "Broderbund Software",
    description: "Classic rotoscoped cinematic platformer to rescue the princess in 60 minutes.",
    rating: 4.9,
    downloads: 2160000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Prince_of_Persia_1990",
    downloadUrls: [
      "https://archive.org/download/msdos_Prince_of_Persia_1990/Prince_of_Persia_1990.zip"
    ]
  },
  {
    identifier: "msdos_Rayman_1995",
    title: "Rayman",
    category: "platformer",
    year: "1995",
    genre: "Artistic Platformer",
    creator: "Ubisoft",
    description: "Gorgeous hand-drawn colorful animated world featuring the limbless hero Rayman.",
    rating: 4.7,
    downloads: 110000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Rayman_1995",
    downloadUrls: [
      "https://archive.org/download/msdos_Rayman_1995/msdos_Rayman_1995.zip"
    ]
  },
  {
    identifier: "msdos_Prehistorik_2_1993",
    title: "Prehistorik 2",
    category: "platformer",
    year: "1993",
    genre: "Cartoon Platformer",
    creator: "Titus Interactive",
    description: "A caveman with a big club hunting dinosaurs and food across beautiful levels.",
    rating: 4.7,
    downloads: 599000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Prehistorik_2_1993",
    downloadUrls: [
      "https://archive.org/download/msdos_Prehistorik_2_1993/Prehistorik_2_1993.zip"
    ]
  },
  {
    identifier: "msdos_Earthworm_Jim_1995",
    title: "Earthworm Jim",
    category: "platformer",
    year: "1995",
    genre: "Surreal Action Platformer",
    creator: "Shiny Entertainment",
    description: "An ordinary earthworm inside an ultra-high-tech robotic space suit.",
    rating: 4.8,
    downloads: 140000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Earthworm_Jim_1995",
    downloadUrls: [
      "https://archive.org/download/msdos_Earthworm_Jim_1995/msdos_Earthworm_Jim_1995.zip"
    ]
  },
  {
    identifier: "msdos_Dangerous_Dave_in_the_Deserted_Pirates_Hideout_1990",
    title: "Dangerous Dave",
    category: "platformer",
    year: "1990",
    genre: "Classic Arcade Platformer",
    creator: "John Romero",
    description: "Navigate through 10 perilous levels collecting trophies and jetpacks.",
    rating: 4.6,
    downloads: 74000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Dangerous_Dave_in_the_Deserted_Pirates_Hideout_1990",
    downloadUrls: [
      "https://archive.org/download/msdos_Dangerous_Dave_in_the_Deserted_Pirates_Hideout_1990/Dangerous_Dave_in_the_Deserted_Pirates_Hideout_1990.zip"
    ]
  },
  {
    identifier: "msdos_Alley_Cat_1984",
    title: "Alley Cat",
    category: "platformer",
    year: "1984",
    genre: "Retro Arcade Classic",
    creator: "Synapse Software / IBM",
    description: "Guide Freddy the cat through alleyways, dog fights, and fish bowls.",
    rating: 4.5,
    downloads: 99000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Alley_Cat_1984",
    downloadUrls: [
      "https://archive.org/download/msdos_Alley_Cat_1984/Alley_Cat_1984.zip"
    ]
  },

  // STRATEGY & CITY BUILDERS
  {
    identifier: "SimCity-2",
    title: "SimCity 2000",
    category: "strategy",
    year: "1993",
    genre: "Isometric City Builder",
    creator: "Maxis Software",
    description: "The definitive isometric city management simulation. Build roads, subways, and arcologies.",
    rating: 4.9,
    downloads: 290000,
    thumbnailUrl: "https://archive.org/services/img/SimCity-2",
    downloadUrls: [
      "https://archive.org/download/SimCity-2/simcity2000.zip",
      "https://archive.org/download/msdos_SimCity_1989/SimCity_1989.zip"
    ]
  },
  {
    identifier: "msdos_SimCity_1989",
    title: "SimCity Classic",
    category: "strategy",
    year: "1989",
    genre: "City Building Simulation",
    creator: "Maxis Software",
    description: "The original city simulation that started it all. Zone residential, commercial, industrial.",
    rating: 4.8,
    downloads: 1059000,
    thumbnailUrl: "https://archive.org/services/img/msdos_SimCity_1989",
    downloadUrls: [
      "https://archive.org/download/msdos_SimCity_1989/SimCity_1989.zip"
    ]
  },
  {
    identifier: "msdos_Dune_2_-_The_Building_of_a_Dynasty_1992",
    title: "Dune II: The Building of a Dynasty",
    category: "strategy",
    year: "1992",
    genre: "Real-Time Strategy (RTS)",
    creator: "Westwood Studios",
    description: "The forefather of modern RTS. Control Atreides, Harkonnen, or Ordos to harvest Spice.",
    rating: 4.9,
    downloads: 313000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Dune_2_-_The_Building_of_a_Dynasty_1992",
    downloadUrls: [
      "https://archive.org/download/msdos_Dune_2_-_The_Building_of_a_Dynasty_1992/Dune_2_-_The_Building_of_a_Dynasty_1992.zip",
      "https://archive.org/download/DuneII/DuneII.zip"
    ]
  },
  {
    identifier: "CIVILIZATION_201902",
    title: "Civilization",
    category: "strategy",
    year: "1991",
    genre: "Turn-Based 4X Strategy",
    creator: "MicroProse",
    description: "Build an empire that will stand the test of time from 4000 BC to the space age.",
    rating: 4.9,
    downloads: 195000,
    thumbnailUrl: "https://archive.org/services/img/CIVILIZATION_201902",
    downloadUrls: [
      "https://archive.org/download/CIVILIZATION_201902/CIVILIZATION.zip",
      "https://archive.org/download/msdos_Sid_Meiers_Civilization_1991/Sid_Meiers_Civilization_1991.zip"
    ]
  },
  {
    identifier: "msdos_Master_of_Orion_1993",
    title: "Master of Orion",
    category: "strategy",
    year: "1993",
    genre: "Space 4X Strategy",
    creator: "SimTex / MicroProse",
    description: "Rule the galaxy through deep space exploration, diplomacy, ship design, and fleet conquest.",
    rating: 4.8,
    downloads: 213000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Master_of_Orion_1993",
    downloadUrls: [
      "https://archive.org/download/msdos_Master_of_Orion_1993/Master_of_Orion_1993.zip"
    ]
  },
  {
    identifier: "msdos_Super_Worms_2003",
    title: "Worms & Artillery",
    category: "strategy",
    year: "1995",
    genre: "Artillery Combat",
    creator: "Team17 / Scorched",
    description: "Turn-based tactical artillery combat featuring destructible terrain and explosives.",
    rating: 4.8,
    downloads: 130000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Super_Worms_2003",
    downloadUrls: [
      "https://archive.org/download/msdos_Super_Worms_2003/Super_Worms_2003.zip",
      "https://archive.org/download/msdos_Scorched_Earth_1991/Scorched_Earth_1991.zip"
    ]
  },

  // RACING & FLIGHT
  {
    identifier: "msdos_Death_Rally_1996",
    title: "Death Rally",
    category: "racing",
    year: "1996",
    genre: "Top-Down Combat Racing",
    creator: "Remedy Entertainment / Apogee",
    description: "Arm your muscle car with gatling guns, mines, and spike bumpers. Win at all costs.",
    rating: 4.8,
    downloads: 165000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Death_Rally_1996",
    downloadUrls: [
      "https://archive.org/download/msdos_Death_Rally_1996/Death_Rally_1996.zip"
    ]
  },
  {
    identifier: "msdos_Wacky_Wheels_1994",
    title: "Wacky Wheels",
    category: "racing",
    year: "1994",
    genre: "Kart Combat Racing",
    creator: "Beavis-Soft / Apogee",
    description: "Hilarious zoo animal go-kart racing with hedgehogs, firecrackers, and oil slicks.",
    rating: 4.7,
    downloads: 130000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Wacky_Wheels_1994",
    downloadUrls: [
      "https://archive.org/download/msdos_Wacky_Wheels_1994/Wacky_Wheels_1994.zip"
    ]
  },
  {
    identifier: "msdos_Lotus_-_The_Ultimate_Challenge_1993",
    title: "Lotus The Ultimate Challenge (Lotus III)",
    category: "racing",
    year: "1993",
    genre: "Arcade Racing",
    creator: "Magnetic Fields / Gremlin",
    description: "High speed arcade racing featuring the Lotus Esprit Turbo and RECS track creator.",
    rating: 4.6,
    downloads: 65000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Lotus_-_The_Ultimate_Challenge_1993",
    downloadUrls: [
      "https://archive.org/download/msdos_Lotus_-_The_Ultimate_Challenge_1993/Lotus_-_The_Ultimate_Challenge_1993.zip"
    ]
  },

  // RPG & ADVENTURE
  {
    identifier: "msdos_Secret_of_Monkey_Island_The_1990",
    title: "The Secret of Monkey Island",
    category: "adventure",
    year: "1990",
    genre: "Point & Click Adventure",
    creator: "Lucasfilm Games",
    description: "Guybrush Threepwood's hilarious quest to become a mighty pirate in the Caribbean.",
    rating: 5.0,
    downloads: 380000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Secret_of_Monkey_Island_The_1990",
    downloadUrls: [
      "https://archive.org/download/msdos_Secret_of_Monkey_Island_The_1990/Secret_of_Monkey_Island_The_1990.zip"
    ]
  },
  {
    identifier: "msdos_Monkey_Island_2_-_LeChucks_Revenge_1991",
    title: "Monkey Island 2: LeChuck's Revenge",
    category: "adventure",
    year: "1991",
    genre: "Point & Click Adventure",
    creator: "Lucasfilm Games",
    description: "Guybrush returns searching for the legendary treasure of Big Whoop.",
    rating: 5.0,
    downloads: 290000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Monkey_Island_2_-_LeChucks_Revenge_1991",
    downloadUrls: [
      "https://archive.org/download/msdos_Monkey_Island_2_-_LeChucks_Revenge_1991/Monkey_Island_2_-_LeChucks_Revenge_1991.zip"
    ]
  },
  {
    identifier: "msdos_Alone_in_the_Dark_1992",
    title: "Alone in the Dark",
    category: "adventure",
    year: "1992",
    genre: "Survival Horror Adventure",
    creator: "Infogrames",
    description: "The pioneer of 3D survival horror. Investigate the haunted Derceto mansion.",
    rating: 4.7,
    downloads: 145000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Alone_in_the_Dark_1992",
    downloadUrls: [
      "https://archive.org/download/msdos_Alone_in_the_Dark_1992/Alone_in_the_Dark_1992.zip"
    ]
  },
  {
    identifier: "msdos_Golden_Axe_1990",
    title: "Golden Axe",
    category: "adventure",
    year: "1990",
    genre: "Hack and Slash Beat-Em-Up",
    creator: "SEGA",
    description: "Fight with Ax Battler, Tyris Flare, or Gilius Thunderhead to vanquish Death Adder.",
    rating: 4.8,
    downloads: 284000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Golden_Axe_1990",
    downloadUrls: [
      "https://archive.org/download/msdos_Golden_Axe_1990/Golden_Axe_1990.zip"
    ]
  },

  // PUZZLE & LOGIC
  {
    identifier: "lemmings_original_ms-dos_201705",
    title: "Lemmings",
    category: "puzzle",
    year: "1991",
    genre: "Logic & Lemmings Guiding",
    creator: "DMA Design / Psygnosis",
    description: "Assign skills (digging, climbing, blocking) to guide the green-haired lemmings to safety.",
    rating: 4.9,
    downloads: 290000,
    thumbnailUrl: "https://archive.org/services/img/lemmings_original_ms-dos_201705",
    downloadUrls: [
      "https://archive.org/download/lemmings_original_ms-dos_201705/lemmings.zip",
      "https://archive.org/download/msdos_Lemmings_1991/Lemmings_1991.zip"
    ]
  },
  {
    identifier: "the_incredible_machine_1992",
    title: "The Incredible Machine",
    category: "puzzle",
    year: "1992",
    genre: "Physics Puzzle",
    creator: "Dynamix / Sierra",
    description: "Construct intricate Rube Goldberg machines using pulleys, hamster motors, and lasers.",
    rating: 4.8,
    downloads: 175000,
    thumbnailUrl: "https://archive.org/services/img/the_incredible_machine_1992",
    downloadUrls: [
      "https://archive.org/download/the_incredible_machine_1992/tim1.zip"
    ]
  },
  {
    identifier: "msdos_Lost_Vikings_The_1993",
    title: "The Lost Vikings",
    category: "puzzle",
    year: "1993",
    genre: "Teamwork Puzzle Platformer",
    creator: "Silicon & Synapse (Blizzard)",
    description: "Control Erik, Baleog, and Olaf with unique abilities to escape extraterrestrial alien worlds.",
    rating: 4.9,
    downloads: 160000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Lost_Vikings_The_1993",
    downloadUrls: [
      "https://archive.org/download/msdos_Lost_Vikings_The_1993/Lost_Vikings_The_1993.zip"
    ]
  },
  {
    identifier: "msdos_Supaplex_1991",
    title: "Supaplex",
    category: "puzzle",
    year: "1991",
    genre: "Grid Puzzle Adventure",
    creator: "Digital Integration",
    description: "Navigate Murphy the red smiley through 111 challenging hardware circuit board puzzles.",
    rating: 4.7,
    downloads: 115000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Supaplex_1991",
    downloadUrls: [
      "https://archive.org/download/msdos_Supaplex_1991/Supaplex_1991.zip"
    ]
  },
  {
    identifier: "msdos_Hocus_Pocus_1994",
    title: "Hocus Pocus",
    category: "platformer",
    year: "1994",
    genre: "Wizard Fantasy Action",
    creator: "Moonlite Software / Apogee",
    description: "Young wizard Hocus Pocus on a magical quest to join the Council of Wizards.",
    rating: 4.7,
    downloads: 85000,
    thumbnailUrl: "https://archive.org/services/img/msdos_Hocus_Pocus_1994",
    downloadUrls: [
      "https://archive.org/download/msdos_Hocus_Pocus_1994/Hocus_Pocus_1994.zip"
    ]
  }
];

// Only packages explicitly published as shareware are installable from the
// Internet Archive catalog. Presence on an archive is not a redistribution license.
const VERIFIED_IA_SHAREWARE = new Set([
  'doom_dos',
  'duke-nukem2-sw',
  'Raptor-sw1',
  'Keen4e-sw'
]);

function withRights(item: ArchiveGameItem): ArchiveGameItem {
  if (item.source === 'freedos') {
    return {
      ...item,
      licenseStatus: 'verified-redistributable',
      licenseEvidence: item.license ? `FreeDOS repository: ${item.license}` : 'Official FreeDOS repository package'
    };
  }
  const verified = VERIFIED_IA_SHAREWARE.has(item.identifier);
  return {
    ...item,
    licenseStatus: verified ? 'verified-redistributable' : 'unknown',
    licenseEvidence: verified ? 'Publisher-distributed shareware package' : 'Ownership or redistribution rights not verified'
  };
}

export class ArchiveDownloader {
  public static async searchArchive(query: string, category: string = 'all', source: CatalogSource = 'all'): Promise<ArchiveGameItem[]> {
    const q = query.trim();

    const archiveItems = CURATED_CATALOG.map(item => withRights({ ...item, source: 'internet-archive' as const }));
    const freeDosItems = FREEDOS_CATALOG.map(item => withRights({ ...item, source: 'freedos' as const }));
    let localMatches = source === 'freedos'
      ? freeDosItems
      : source === 'internet-archive'
        ? archiveItems
        : [...freeDosItems, ...archiveItems];
    if (category !== 'all') {
      localMatches = localMatches.filter(g => g.category === category);
    }
    if (q) {
      localMatches = localMatches.filter(g => 
        g.title.toLowerCase().includes(q.toLowerCase()) || 
        (g.creator && g.creator.toLowerCase().includes(q.toLowerCase())) ||
        (g.description && g.description.toLowerCase().includes(q.toLowerCase())) ||
        (g.genre && g.genre.toLowerCase().includes(q.toLowerCase()))
      );
    }

    if (!q || source === 'freedos') {
      return localMatches;
    }

    // Search online Internet Archive for custom search queries
    const encoded = encodeURIComponent(`collection:softwarelibrary_msdos_games AND (${q})`);
    const url = `https://archive.org/advancedsearch.php?q=${encoded}&fl[]=identifier,title,description,year,creator,downloads&sort[]=downloads+desc&rows=30&output=json`;

    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.response && Array.isArray(data.response.docs)) {
          const onlineItems: ArchiveGameItem[] = data.response.docs.map((doc: any) => ({
            identifier: doc.identifier,
            title: doc.title || doc.identifier,
            category: 'action' as const,
            year: doc.year ? doc.year.toString() : undefined,
            creator: doc.creator || 'DOS Developer',
            genre: 'MS-DOS Classic',
            description: typeof doc.description === 'string' ? doc.description.replace(/<[^>]*>?/gm, '') : undefined,
            downloads: doc.downloads || 1000,
            rating: 4.5,
            thumbnailUrl: `https://archive.org/services/img/${doc.identifier}`,
            source: 'internet-archive' as const,
            licenseStatus: 'unknown' as const,
            licenseEvidence: 'Ownership or redistribution rights not verified'
          }));

          // Merge local curated results at top
          const seen = new Set(localMatches.map(m => m.identifier));
          const uniqueOnline = onlineItems.filter(item => !seen.has(item.identifier));
          return [...localMatches, ...uniqueOnline];
        }
      }
    } catch (err) {
      console.warn('Archive search fetch error:', err);
    }

    return localMatches;
  }

  public static async downloadAndInstall(item: ArchiveGameItem, defaultDir: string): Promise<DownloadResult> {
    if (!this.canInstall(item)) {
      return {
        success: false,
        message: 'Automatic installation is disabled because redistribution rights for this item are not verified. Import your own legally acquired files instead.'
      };
    }
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const res = await invoke<any>('download_and_install_archive_game', {
          identifier: item.identifier,
          title: item.title,
          targetBaseDir: defaultDir,
          directUrls: item.downloadUrls || [],
          provider: item.source || 'internet-archive',
          expectedCrc32: item.expectedCrc32 || null
        });

        return {
          success: res.success,
          message: res.message,
          installed: res.installed ?? res.success,
          targetFolder: res.targetFolder || res.target_folder,
          executable: res.executable,
          workingDir: res.workingDir || res.working_dir || ''
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Download error: ${err.toString()}`
        };
      }
    }

    // A browser cannot silently write and extract an archive into ~/DOSGAMES.
    // Start a real browser download, but do not pretend that the game was installed.
    const directUrl = (item.downloadUrls && item.downloadUrls[0])
      || (item.source === 'freedos' ? null : await this.discoverBrowserZipUrl(item.identifier));
    const downloadLink = document.createElement('a');
    downloadLink.href = directUrl || `https://archive.org/details/${encodeURIComponent(item.identifier)}`;
    downloadLink.target = '_blank';
    downloadLink.rel = 'noopener noreferrer';
    downloadLink.click();
    return {
      success: true,
      installed: false,
      message: directUrl
        ? `The ZIP download for "${item.title}" was opened in your browser. Automatic extraction requires the native app (npm run tauri dev).`
        : `No downloadable ZIP was found automatically. The Internet Archive item page was opened instead.`
    };
  }

  public static canInstall(item: ArchiveGameItem): boolean {
    return item.licenseStatus === 'verified-redistributable';
  }

  public static async openSourcePage(item: ArchiveGameItem): Promise<void> {
    const url = item.source === 'freedos'
      ? 'https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.4/games/'
      : `https://archive.org/details/${encodeURIComponent(item.identifier)}`;
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_catalog_source', { identifier: item.identifier, provider: item.source || 'internet-archive' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private static async discoverBrowserZipUrl(identifier: string): Promise<string | null> {
    try {
      const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
      if (!response.ok) return null;
      const metadata = await response.json();
      const files = Array.isArray(metadata?.files) ? metadata.files : [];
      const zip = files
        .filter((file: any) => typeof file?.name === 'string' && file.name.toLowerCase().endsWith('.zip'))
        .sort((a: any, b: any) => Number(b?.source === 'original') - Number(a?.source === 'original'))[0];
      if (!zip) return null;
      const encodedPath = zip.name.split('/').map((part: string) => encodeURIComponent(part)).join('/');
      return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodedPath}`;
    } catch {
      return null;
    }
  }
}
