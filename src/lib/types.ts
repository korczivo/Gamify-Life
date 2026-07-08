/** Plain-JSON shapes crossing the RSC/client boundary. */

export interface SerializedMission {
  _id: string;
  name: string;
  businessType: "marketing" | "content" | "dev" | "admin";
  objectiveType: "checkbox" | "counter" | "timer";
  targetCount?: number;
  durationMinutes?: number;
  difficulty: "easy" | "medium" | "hard";
  cashReward: number;
  rpReward: number;
  periodKey: string;
  progress: number;
  status: "open" | "completed";
  isOneOff: boolean;
  heistId?: string;
  prepKind?: "mandatory" | "optional";
}

export interface SerializedTemplate {
  _id: string;
  name: string;
  businessType: "marketing" | "content" | "dev" | "admin";
  objectiveType: "checkbox" | "counter" | "timer";
  targetCount?: number;
  durationMinutes?: number;
  difficulty: "easy" | "medium" | "hard";
  cashReward: number;
  rpReward: number;
  schedule: { kind: "daily" | "weekly"; timesPerPeriod: number };
  active: boolean;
}

export interface SerializedHeist {
  _id: string;
  name: string;
  tier: "small" | "medium" | "big" | "cayo";
  status: "scoping" | "active" | "completed" | "archived";
  buyIn: number;
  basePayout: number;
  loot?: { kind?: string; multiplier?: number };
  preps: {
    _id: string;
    missionId: string;
    name: string;
    kind: "mandatory" | "optional";
    completed: boolean;
  }[];
  finaleName: string;
  hardMode: boolean;
  payout?: number;
  eliteAchieved?: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface SerializedOwnedAsset {
  _id: string;
  assetId: string;
  class: "business" | "property" | "vehicle" | "gear";
  purchasePrice: number;
  supplyUnits: number;
  stockUnits: number;
  upgrades: string[];
  totalEarned: number;
  isDailyDriver: boolean;
  createdAt: string;
}
