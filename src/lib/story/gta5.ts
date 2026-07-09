/**
 * GTA V — Story Pack (pilot). Act 1: Prologue → The Jewel Store Job (13 missions).
 *
 * Generic content pack: the engine reads `StoryPack` and never mentions GTA directly,
 * so swapping this file for another game (Witcher 3, RDR2…) needs no code changes.
 * Data scraped from gtabase.com — summaries and objectives are third-party IP, kept
 * local, not for redistribution.
 *
 * Goal = 100% completion: every objective of every mission is a mandatory task. No
 * optional missions, no Gold Medal bonuses — you just do all the steps to pass the game.
 *
 * Map coordinates target the 8192px Los Santos image already shipped in the app
 * (same system as economy.ts: `pos = [-y, x]`, larger y = further south/city).
 * They are hand-approximated per location and meant to be tuned by feel.
 *
 * Step types: everything defaults to `checkbox` for now. The timer-vs-checkbox policy
 * (which finale steps become deep-work timers) is not finalized — `type`/`minutes`/
 * `target` stay on the model so we can flip steps later without a data migration.
 */

export type Protagonist = "michael" | "franklin" | "trevor";

export type StoryStepType = "checkbox" | "counter" | "timer";

export interface StoryStep {
  /** What you actually do — the scraped objective, verbatim. */
  label: string;
  type: StoryStepType;
  /** For `counter`: how many to tally. */
  target?: number;
  /** For `timer`: deep-work minutes to bank. */
  minutes?: number;
}

export interface StoryMission {
  /** Stable slug, matches the gtabase URL slug. */
  id: string;
  /** Position within the pack, 1-based. */
  order: number;
  title: string;
  /** Drives blip colour on the map (Michael=blue, Franklin=green, Trevor=orange). */
  protagonist: Protagonist;
  /** Who hands out the mission, if anyone. */
  giver?: string;
  act: number;
  /** Human-readable place name. */
  location: string;
  /** Blip position on the 8192px map. */
  map: { x: number; y: number };
  /** Plot beat, revealed as the "reward" when the mission completes. */
  summary: string;
  /** Every objective is its own mandatory task. */
  steps: StoryStep[];
  /** Mission ids that must be completed before this one unlocks. */
  requires: string[];
}

export interface StoryPack {
  id: string;
  title: string;
  missions: StoryMission[];
}

/** Helper: turn a flat list of objective labels into checkbox steps. */
const checks = (labels: string[]): StoryStep[] =>
  labels.map((label) => ({ label, type: "checkbox" }));

export const GTA5_STORY: StoryPack = {
  id: "gta5",
  title: "Grand Theft Auto V — Act 1",
  missions: [
    {
      id: "prologue",
      order: 1,
      title: "Prologue",
      protagonist: "michael",
      giver: undefined,
      act: 1,
      location: "Ludendorff, North Yankton",
      map: { x: 4000, y: 420 }, // off the LS map — placed far north as a flashback marker
      summary:
        "Set in 2004, nine years before the events of GTA V. Michael, Trevor and Brad are robbing a Bobcat security storage facility in Ludendorff, North Yankton. Trevor blows open the vault and they steal roughly $180,000 — but as they start to escape, a guard catches Michael and holds him at gunpoint.",
      steps: checks([
        "Go to the guard.",
        "Aim at the hostages to make them move.",
        "Use the phone to trigger the explosive charge.",
        "Collect the cash.",
        "Take out the guard.",
        "Get to cover.",
        "Open the shutter door.",
        "Escape the Cops.",
        "Get to the car.",
        "Wait for the crew.",
        "Drive to the helicopter pick up point.",
        "Hold off the Cops.",
      ]),
      requires: [],
    },
    {
      id: "franklin-and-lamar",
      order: 2,
      title: "Franklin and Lamar",
      protagonist: "franklin",
      giver: "Simeon Yetarian",
      act: 1,
      location: "Vespucci Beach / Del Perro",
      map: { x: 2700, y: 6400 },
      summary:
        "Franklin and Lamar repossess two convertibles for an Armenian car dealer, Simeon — turning the job into a chase through Los Santos before delivering the cars to the dealership.",
      steps: checks([
        "Choose one of the cars.",
        "Follow Lamar.",
        "Park next to Lamar.",
        "Lose the Cops.",
        "Take the car back to the dealership.",
        "Get in your car.",
        "Go to Franklin's house.",
      ]),
      requires: ["prologue"],
    },
    {
      id: "repossession",
      order: 3,
      title: "Repossession",
      protagonist: "franklin",
      giver: "Simeon Yetarian",
      act: 1,
      location: "Vespucci Beach",
      map: { x: 2600, y: 6650 },
      summary:
        "Franklin and Lamar head to a shady part of Vespucci Beach to repo a bike for Simeon — and run into the Vagos before the job is done.",
      steps: checks([
        "Go to Vespucci Beach.",
        "Follow Lamar.",
        "Search the garages.",
        "Pick up a weapon.",
        "Take out the Vagos.",
        "Get the bike.",
        "Get on the bike.",
        "Go to the car wash.",
      ]),
      requires: ["franklin-and-lamar"],
    },
    {
      id: "complications",
      order: 4,
      title: "Complications",
      protagonist: "franklin",
      giver: "Simeon Yetarian",
      act: 1,
      location: "Rockford Hills",
      map: { x: 3300, y: 5980 },
      summary:
        "Simeon gives Franklin another job: repossess an SUV from James de Santa in Rockford Hills. The owner turns out to be asleep in the back seat — and the whole scam ends through a dealership window.",
      steps: checks([
        "Go to the house.",
        "Find a way into the house.",
        "Take out the gardener.",
        "Retrieve the car.",
        "Take the car to the dealership.",
        "Ram through the dealership window.",
        "Beat up Simeon.",
      ]),
      requires: ["repossession"],
    },
    {
      id: "father-son",
      order: 5,
      title: "Father/Son",
      protagonist: "michael",
      giver: "Michael De Santa",
      act: 1,
      location: "Pacific Bluffs",
      map: { x: 2400, y: 5750 },
      summary:
        "Jimmy gets in trouble with some gangsters and calls Michael for help. Michael and Franklin chase down the stolen family yacht on the Western Highway — and end the day at Los Santos Customs.",
      steps: checks([
        "Go to Pacific Bluffs.",
        "Get Franklin close to the yacht.",
        "Shoot the thief.",
        "Chase the yacht.",
        "Catch Jimmy.",
        "Catch Franklin.",
        "Go to Los Santos Customs.",
        "Get Amanda's car repaired.",
        "Go to Michael's house.",
      ]),
      requires: ["complications"],
    },
    {
      id: "chop",
      order: 6,
      title: "Chop",
      protagonist: "franklin",
      giver: "Lamar Davis",
      act: 1,
      location: "Strawberry / Vinewood",
      map: { x: 3950, y: 6720 },
      summary:
        "Lamar shows up with his dog Chop and a plan to kidnap D, a member of the Ballas. After a chase through Los Santos and a rail-yard search, Franklin and Chop run him down.",
      steps: checks([
        "Follow Lamar.",
        "Get in the van.",
        "Wait for Lamar.",
        "Go to Vinewood Boulevard.",
        "Get back in the van.",
        "Open the boxcars to see if D is hiding inside.",
        "Go to Chop and pull him off the dog.",
        "Take D to Lamar's house.",
        "Stop the van to let D out.",
        "Drop Lamar off at the rec center.",
      ]),
      requires: ["father-son"],
    },
    {
      id: "marriage-counseling",
      order: 7,
      title: "Marriage Counseling",
      protagonist: "michael",
      giver: "Michael De Santa",
      act: 1,
      location: "Rockford Hills",
      map: { x: 3180, y: 5870 },
      summary:
        "Michael comes home, finds two tennis rackets by the door, and heads upstairs to find Amanda's tennis coach Kyle in their bed. The chase ends with the wrong house pulled off a cliff — and crime boss Martin Madrazo demanding $2.5 million.",
      steps: checks([
        "Get in the truck.",
        "Follow the tennis coach.",
        "Drive to the canyon.",
        "Get in the truck.",
        "Go back to Michael's house.",
        "Lose Madrazo's men.",
      ]),
      requires: ["chop"],
    },
    {
      id: "daddys-little-girl",
      order: 8,
      title: "Daddy's Little Girl",
      protagonist: "michael",
      giver: "Michael De Santa",
      act: 1,
      location: "Vespucci Beach",
      map: { x: 2750, y: 6720 },
      summary:
        "Michael and Jimmy pop out for some father/son bonding at Vespucci Beach — which escalates when Jimmy reveals his sister Tracey is on a nearby party yacht.",
      steps: checks([
        "Go to the bike rental stand.",
        "Select a bike.",
        "Race Jimmy to the pier.",
        "Swim to the yacht.",
        "Lose the pursuers.",
        "Go to the shore.",
      ]),
      requires: ["marriage-counseling"],
    },
    {
      id: "friend-request",
      order: 9,
      title: "Friend Request",
      protagonist: "michael",
      giver: "Lester Crest",
      act: 1,
      location: "Murrieta Heights / Lifeinvader",
      map: { x: 4850, y: 6280 },
      summary:
        "Michael needs a job and turns to an old friend. He visits Lester to plan a heist to pay back the $2.5 million owed to Madrazo — starting by rigging a tech CEO's prototype phone during his own keynote.",
      steps: checks([
        "Go to the Suburban store in Vinewood.",
        "Buy a suitable outfit.",
        "Go to the Lifeinvader offices.",
        "Go to the rear entrance.",
        "Follow the programmer.",
        "Close the popups to reveal the antivirus shortcut.",
        "Run the antivirus software.",
        "Rig the prototype.",
        "Exit the building.",
        "Watch the keynote at Michael's house.",
        "Wait for Jay Norris to pull out the prototype phone and then give him a call.",
      ]),
      requires: ["daddys-little-girl"],
    },
    {
      id: "the-long-stretch",
      order: 10,
      title: "The Long Stretch",
      protagonist: "franklin",
      giver: "Lamar Davis",
      act: 1,
      location: "Strawberry / Cypress Flats",
      map: { x: 4650, y: 6620 },
      summary:
        "Lamar and a freshly-released Stretch walk up Franklin's path. The 'business' deal they set up at a recycling plant turns out to be an ambush — and turns into a running gunfight out to the street.",
      steps: checks([
        "Go to Ammu-Nation.",
        "Buy a pump shotgun and a flashlight mod.",
        "Go to the meeting at the recycling plant.",
        "Escape the recycling plant.",
        "Escape the junkyard.",
        "Lose the Cops.",
        "Go back to Franklin's house.",
      ]),
      requires: ["friend-request"],
    },
    {
      id: "the-good-husband",
      order: 11,
      title: "The Good Husband",
      protagonist: "michael",
      giver: "Amanda De Santa",
      act: 1,
      location: "Rockford Hills",
      map: { x: 3450, y: 5920 },
      summary:
        "Amanda calls about a 'misunderstanding' at a Didier Sachs store in Rodeo. Michael finds her in the back of a cop car, steals it with her still inside, loses a three-star wanted level, and drives her home — where she admits she was shoplifting.",
      steps: checks([
        "Go to Amanda.",
        "Get in the Cop car.",
        "Lose the Cops.",
        "Take Amanda home.",
      ]),
      requires: ["the-long-stretch"],
    },
    {
      id: "casing-the-jewel-store",
      order: 12,
      title: "Casing the Jewel Store",
      protagonist: "michael",
      giver: "Lester Crest",
      act: 1,
      location: "Vangelico, Little Portola",
      map: { x: 3520, y: 5990 },
      summary:
        "Michael and Lester scout out the Vangelico jewelers in Little Portola. Michael photographs the security features through glasses with hidden cameras, then studies the rooftop vents to plan the robbery.",
      steps: checks([
        "Go to the jewelers.",
        "Take a picture of the alarm system.",
        "Take a picture of the ventilation outlet and the security camera.",
        "Speak with the assistant.",
        "Get back in your car.",
        "Find an access point to the roof top.",
        "Go to the roof top.",
        "Get to high ground and take some shots.",
        "Go to the vantage point.",
        "Get back in your car.",
        "Go to the garment factory.",
      ]),
      requires: ["the-long-stretch"],
    },
    {
      id: "the-jewel-store-job",
      order: 13,
      title: "The Jewel Store Job (Smart Approach)",
      protagonist: "michael",
      giver: "Lester Crest",
      act: 1,
      location: "Vangelico → LS Sewers",
      map: { x: 3600, y: 6010 },
      summary:
        "In need of money to pay Madrazo, Michael takes down the Rockford Hills jewel store with Franklin and a crew — knockout gas empties the store, the crew clears the cabinets, and the getaway runs through the sewers under police fire.",
      steps: checks([
        "Get in the car.",
        "Go to the jewelry store.",
        "Go to the roof.",
        "Throw the BZ gas into the air vent.",
        "Steal the jewelry.",
        "Follow your crew into the sewers.",
        "Take out the police cars and protect your crew.",
        "Rendezvous with your crew.",
        "Go to the lockup.",
      ]),
      requires: ["casing-the-jewel-store"],
    },
  ],
};
