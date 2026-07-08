/**
 * One-time asset fetcher. Downloads the Los Santos map, GTA blip icons,
 * starter artwork and fonts into public/. Re-running skips existing files.
 *
 * All GTA imagery is Rockstar Games IP — private, local use only.
 * public/assets and public/map are gitignored for that reason.
 *
 * Run: npx tsx scripts/fetch-assets.ts
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const ROOT = join(import.meta.dirname, "..");
const PUB = join(ROOT, "public");

// ---------------------------------------------------------------- helpers

async function resolveWikiFile(fileName: string): Promise<string> {
  const api = `https://gta.fandom.com/api.php?action=query&titles=File:${encodeURIComponent(
    fileName
  )}&prop=imageinfo&iiprop=url&format=json`;
  const res = await fetch(api, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`wiki api ${res.status} for ${fileName}`);
  const data = (await res.json()) as {
    query: { pages: Record<string, { imageinfo?: { url: string }[] }> };
  };
  const page = Object.values(data.query.pages)[0];
  const url = page.imageinfo?.[0]?.url;
  if (!url) throw new Error(`no imageinfo for ${fileName}`);
  return url;
}

async function download(url: string, dest: string): Promise<"saved" | "skipped"> {
  const abs = join(PUB, dest);
  if (existsSync(abs)) return "skipped";
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  let buf = Buffer.from(await res.arrayBuffer());
  const isSvg = dest.endsWith(".svg");
  if (isSvg && !buf.subarray(0, 100).toString().includes("<svg")) {
    throw new Error(`not an svg from ${url}`);
  }
  if (!isSvg && buf.length < 500) {
    throw new Error(`suspiciously small file (${buf.length}B) from ${url}`);
  }
  if (isSvg) {
    // game-icons ship a black background square — strip it so the icon
    // works as a recolorable CSS mask.
    buf = Buffer.from(buf.toString().replace('<path d="M0 0h512v512H0z"/>', ""));
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, buf);
  return "saved";
}

/** Wikimedia Commons: resolve a thumbnail URL (full-size photos can be 10MB+). */
async function resolveCommonsFile(fileName: string, width = 640): Promise<string> {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(
    fileName
  )}&prop=imageinfo&iiprop=url&iiurlwidth=${width}&format=json`;
  const res = await fetch(api, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`commons api ${res.status} for ${fileName}`);
  const data = (await res.json()) as {
    query: {
      pages: Record<string, { imageinfo?: { url: string; thumburl?: string }[] }>;
    };
  };
  const info = Object.values(data.query.pages)[0].imageinfo?.[0];
  const url = info?.thumburl ?? info?.url;
  if (!url) throw new Error(`no imageinfo for ${fileName}`);
  return url;
}

async function commonsDownload(fileName: string, dest: string) {
  const abs = join(PUB, dest);
  if (existsSync(abs)) {
    console.log(`  skip  ${dest}`);
    return;
  }
  const url = await resolveCommonsFile(fileName);
  await download(url, dest);
  console.log(`  saved ${dest}`);
}

async function wikiDownload(fileName: string, dest: string) {
  const abs = join(PUB, dest);
  if (existsSync(abs)) {
    console.log(`  skip  ${dest}`);
    return;
  }
  const url = await resolveWikiFile(fileName);
  await download(url, dest);
  console.log(`  saved ${dest}`);
}

// ---------------------------------------------------------------- manifest

const MAP: [string, string][] = [
  // 8192x8192 full Southern San Andreas atlas map
  ["SouthernSanAndreas-GTAV-Map.jpg", "map/los-santos.jpg"],
];

const BLIPS: [string, string][] = [
  ["Blips-GTAO-826-Agency.png", "map/blips/agency.png"],
  ["Blips-GTAO-819-MusicStudio.png", "map/blips/studio.png"],
  ["Blips-GTAO-557-PropertyBunker.png", "map/blips/bunker.png"],
  ["Blips-GTAO-524-WarehouseVehicle.png", "map/blips/vehicle-warehouse.png"],
  ["Blips-GTAO-473-Warehouse.png", "map/blips/warehouse.png"],
  ["Blips-GTAO-Nightclub.png", "map/blips/nightclub.png"],
  ["Blips-GTAO-475-Office.png", "map/blips/office.png"],
  ["Blips-GTAO-Facility.png", "map/blips/facility.png"],
  ["Blips-GTAO-Kosatka.png", "map/blips/kosatka.png"],
  ["Blips-GTAO-455-Yacht.png", "map/blips/yacht.png"],
  ["Blips-GTAO-679-Casino.png", "map/blips/casino.png"],
  ["Blips-GTAV-40-Safehouse.png", "map/blips/safehouse.png"],
  ["Blips-GTAV-357-Garage.png", "map/blips/garage.png"],
  ["Blips-GTAO-569-SMHangar.png", "map/blips/hangar.png"],
  ["Blips-GTAO-740-Arcade.png", "map/blips/arcade.png"],
];

// Card artwork, keyed by catalog assetId (dest filename must equal assetId —
// src/lib/art.ts resolves art by that convention).
const ART: [string, string][] = [
  // businesses & properties
  ["WarehouseInterior2-GTAO-SS1.png", "assets/properties/cargo-warehouse.png"],
  ["DocumentForgeryOffice-GTAOe-ProductionUnderway.png", "assets/properties/forgery-office.png"],
  ["Bunker-GTAO-Chumash.png", "assets/properties/bunker.png"],
  ["Arcades-GTAO-ArcadeOverview.png", "assets/properties/arcade.png"],
  ["Nightclubs-GTAO-Del_Perro.png", "assets/properties/nightclub.png"],
  ["EclipseTowersDay-GTAV.png", "assets/properties/eclipse-towers.png"],
  ["MazeBankWest-GTAV.png", "assets/properties/maze-bank-west.png"],
  ["Dynasty8Executive-GTAO-MazeBankTower.png", "assets/properties/maze-bank-tower.png"],
  ["Facilities-GTAO-CCTV-01-HeistPlanningRoom.png", "assets/properties/the-facility.png"],
  ["Kosatka-GTAO-front.png", "assets/properties/kosatka.png"],
  ["TheDiamondCasino&Resort-GTAO-NightView.png", "assets/properties/casino-penthouse.png"],
  ["Hangar-GTAO-Interior.PNG", "assets/properties/lsia-hangar.png"],
  ["OrionYacht-GTAO-front.png", "assets/properties/galaxy-super-yacht.png"],
  // vehicles
  ["Faggio-GTAV-front.png", "assets/vehicles/faggio.png"],
  ["Sanchez2-GTAV-front.png", "assets/vehicles/sanchez.png"],
  ["Akuma-GTAV-front.png", "assets/vehicles/akuma.png"],
  ["Bati801-GTAV-front.png", "assets/vehicles/bati-801.png"],
  ["Gauntlet-GTAV-front.png", "assets/vehicles/gauntlet.png"],
  ["Dominator-GTAV-front.png", "assets/vehicles/dominator.png"],
  ["ElegyRH8-GTAVee-FrontQuarter.png", "assets/vehicles/elegy-rh8.png"],
  ["Comet-GTAVee-FrontQuarter.png", "assets/vehicles/comet.png"],
  ["Banshee-GTAVee-FrontQuarter.png", "assets/vehicles/banshee.png"],
  ["9F-GTAVee-FrontQuarter.png", "assets/vehicles/9f.png"],
  ["Feltzer-GTAVee-FrontQuarter.png", "assets/vehicles/feltzer.png"],
  ["Voltic-GTAVee-FrontQuarter.png", "assets/vehicles/voltic.png"],
  ["Bullet-GTAVe-front.png", "assets/vehicles/bullet.png"],
  ["Carbonizzare-GTAVee-FrontQuarter.png", "assets/vehicles/carbonizzare.png"],
  ["Monroe-GTAV-front.png", "assets/vehicles/monroe.png"],
  ["Stinger-GTAV-front.png", "assets/vehicles/stinger.png"],
  ["Infernus-GTAVee-FrontQuarter.png", "assets/vehicles/infernus.png"],
  ["TurismoR-GTAVee-FrontQuarter.png", "assets/vehicles/turismo-r.png"],
  ["Cheetah-GTAVee-FrontQuarter.png", "assets/vehicles/cheetah.png"],
  ["Zentorno-GTAVee-FrontQuarter.png", "assets/vehicles/zentorno.png"],
  ["EntityXF-GTAVee-FrontQuarter.png", "assets/vehicles/entity-xf.png"],
  ["Adder-GTAV-front.png", "assets/vehicles/adder.png"],
  ["Osiris-GTAVee-FrontQuarter.png", "assets/vehicles/osiris.png"],
  ["T20-GTAVe-front.png", "assets/vehicles/t20.png"],
  ["X80Proto-GTAO-front.png", "assets/vehicles/x80-proto.png"],
  ["Frogger-GTAV-front.png", "assets/vehicles/frogger.png"],
  ["Luxor-GTAV-front.png", "assets/vehicles/luxor.png"],
  ["BuzzardAttackChopper-GTAV-front.png", "assets/vehicles/buzzard.png"],
];

// game-icons.net silhouettes (CC BY 3.0) for wardrobe items and award badges.
const GAME_ICONS: [string, string][] = [
  // wardrobe (dest name = catalog assetId)
  ["delapouite/gloves.svg", "assets/wardrobe/perseus-gloves.svg"],
  ["delapouite/sunglasses.svg", "assets/wardrobe/designer-shades.svg"],
  ["delapouite/chelsea-boot.svg", "assets/wardrobe/crocodile-loafers.svg"],
  ["delapouite/tie.svg", "assets/wardrobe/ponsonbys-suit.svg"],
  ["delapouite/pirate-coat.svg", "assets/wardrobe/cashmere-overcoat.svg"],
  ["delapouite/double-necklace.svg", "assets/wardrobe/gold-chain.svg"],
  ["delapouite/crystal-earrings.svg", "assets/wardrobe/diamond-studs.svg"],
  ["delapouite/watch.svg", "assets/wardrobe/medici-watch.svg"],
  ["delapouite/diamond-ring.svg", "assets/wardrobe/vinewood-ring.svg"],
  ["lorc/front-teeth.svg", "assets/wardrobe/platinum-grill.svg"],
  // awards (dest name = award id)
  ["lorc/fist.svg", "assets/awards/grinder.svg"],
  ["lorc/stopwatch.svg", "assets/awards/deep-focus.svg"],
  ["delapouite/carnival-mask.svg", "assets/awards/mastermind.svg"],
  ["delapouite/star-struck.svg", "assets/awards/elite-thief.svg"],
  ["delapouite/factory.svg", "assets/awards/empire-builder.svg"],
  ["skoll/race-car.svg", "assets/awards/collector.svg"],
  ["lorc/profit.svg", "assets/awards/millionaires-club.svg"],
  ["lorc/cash.svg", "assets/awards/rainmaker.svg"],
  ["delapouite/warehouse.svg", "assets/awards/salesman.svg"],
  ["lorc/gem-chain.svg", "assets/awards/high-roller.svg"],
];

// Character portraits: official GTA artwork (realistic faces for the wizard).
const PORTRAITS: [string, string][] = [
  ["Artwork-MichaelDeSanta-GTAV.jpg", "assets/portraits/michael.jpg"],
  ["Artwork-FranklinClinton-GTAV.jpg", "assets/portraits/franklin.jpg"],
  ["Artwork-TrevorPhilips-GTAV.jpg", "assets/portraits/trevor.jpg"],
  ["Artwork-Lester-GTAV.jpg", "assets/portraits/lester.jpg"],
  ["Artwork-Lamar-GTAV.jpg", "assets/portraits/lamar.jpg"],
  ["Artwork-GTAO-GayTony.jpg", "assets/portraits/tony.jpg"],
  ["Artwork-MichaelVangelico-GTAV.jpg", "assets/portraits/michael-suit.jpg"],
  ["Artwork-Chop-GTAV.jpg", "assets/portraits/chop.jpg"],
];

// Founder gear photos from Wikimedia Commons (freely licensed), keyed by assetId.
const GEAR_ART: [string, string][] = [
  ["MacBook Pro (16-inch, M4 Pro, Silver).jpg", "assets/gear/macbook-pro.jpg"],
  ["Mac Studio (2022) front.jpg", "assets/gear/mac-studio.jpg"],
  ["Aeron Chair by Herman Miller (9446986497).jpg", "assets/gear/aeron-chair.jpg"],
  ["Shure SM7.jpg", "assets/gear/sm7b.jpg"],
  [
    "Sony α7S III with Sony FE 55mm F1.8 ZA - by Henry Söderlund (50427553021).jpg",
    "assets/gear/a7s-camera.jpg",
  ],
  ["La Marzocco GB5.jpg", "assets/gear/espresso-machine.jpg"],
  ["Standing Desk by Amrish Kawa 07.jpg", "assets/gear/standing-desk.jpg"],
  ["Beautiful Mechanical Keyboard.jpg", "assets/gear/mech-keyboard.jpg"],
];

const FONT_ZIPS: { url: string; zipDest: string; extract: [string, string][] }[] = [
  {
    url: "https://dl.dafont.com/dl/?f=pricedown",
    zipDest: "/tmp/pricedown.zip",
    // [path inside zip, dest under public/]
    extract: [["pricedown bl.otf", "fonts/pricedown.otf"]],
  },
  {
    url: "https://github.com/keshikan/DSEG/releases/download/v0.46/fonts-DSEG_v046.zip",
    zipDest: "/tmp/dseg.zip",
    extract: [
      [
        "fonts-DSEG_v046/DSEG7-Classic/DSEG7Classic-Bold.woff2",
        "fonts/dseg7-bold.woff2",
      ],
    ],
  },
];

// ---------------------------------------------------------------- run

async function main() {
  console.log("Map:");
  for (const [file, dest] of MAP) await wikiDownload(file, dest);

  console.log("Blips:");
  for (const [file, dest] of BLIPS) await wikiDownload(file, dest);

  console.log("Artwork:");
  for (const [file, dest] of ART) {
    try {
      await wikiDownload(file, dest);
    } catch (err) {
      console.warn(`  WARN ${file}: ${(err as Error).message}`);
    }
  }

  console.log("Game icons:");
  for (const [path, dest] of GAME_ICONS) {
    const abs = join(PUB, dest);
    if (existsSync(abs)) {
      console.log(`  skip  ${dest}`);
      continue;
    }
    await download(`https://raw.githubusercontent.com/game-icons/icons/master/${path}`, dest);
    console.log(`  saved ${dest}`);
  }

  console.log("Portraits:");
  for (const [file, dest] of PORTRAITS) {
    try {
      await wikiDownload(file, dest);
    } catch (err) {
      console.warn(`  WARN ${file}: ${(err as Error).message}`);
    }
  }

  console.log("Founder gear:");
  for (const [file, dest] of GEAR_ART) {
    // Commons rate-limits aggressively — space the requests out.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await commonsDownload(file, dest);
        break;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("429") && attempt < 3) {
          await new Promise((r) => setTimeout(r, 15_000 * attempt));
          continue;
        }
        console.warn(`  WARN ${file}: ${msg}`);
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }

  console.log("Fonts:");
  for (const { url, zipDest, extract } of FONT_ZIPS) {
    const allExist = extract.every(([, dest]) => existsSync(join(PUB, dest)));
    if (allExist) {
      extract.forEach(([, dest]) => console.log(`  skip  ${dest}`));
      continue;
    }
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    writeFileSync(zipDest, Buffer.from(await res.arrayBuffer()));
    const tmpDir = zipDest.replace(/\.zip$/, "-extracted");
    execSync(`unzip -o -q "${zipDest}" -d "${tmpDir}"`);
    for (const [src, dest] of extract) {
      const abs = join(PUB, dest);
      mkdirSync(dirname(abs), { recursive: true });
      execSync(`cp "${join(tmpDir, src)}" "${abs}"`);
      console.log(`  saved ${dest}`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
