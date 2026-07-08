# EMPIRE

GTA Online-style gamified productivity app. Real work is the only fuel: missions pay
cash + RP, deliver supplies to your businesses, tick production across the empire and
check off heist preps. Local, single-user, no auth.

## Quickstart

```bash
docker compose up -d        # MongoDB on localhost:27017
npm install
npm run fetch-assets        # downloads the LS map, blips, GTA artwork, fonts (one-time)
npm run seed                # player + starter mission templates
npm run dev                 # http://localhost:3000
```

## The loop

1. **Missions** (`/missions`) — checkbox / counter (+1) / 45-min timer jobs from daily &
   weekly templates. Completing one pays cash+RP, bumps your permanent residual income,
   delivers +1 supply to the matching business and ticks production everywhere.
2. **Empire** (`/empire`) — the real Los Santos map. Buy businesses (supply → stock →
   SELL, fuller warehouse pays up to ×1.5), upgrade Staff/Equipment, unlock heist tiers
   with properties (Eclipse Towers → Facility → Kosatka).
3. **Heists** (`/heists`) — buy-in up front, scope-out rolls the loot (Pink Diamond ×1.5),
   mandatory preps light up the finale, optional preps +10% each, Elite +15%,
   back-to-back heists within 24h = hard mode ×1.25.
4. **Garage** (`/garage`) — the collection. Garage slots come from properties;
   LS Customs tuning per car; pick your daily driver.
5. **Stats** (`/stats`) — net worth curve, activity heatmap, full ledger.

## Notes

- All economy numbers live in `src/lib/economy.ts` (real GTA$ prices). Owned assets
  snapshot price/params at purchase, so retuning never corrupts history.
- Domain logic: `src/lib/game.ts`. End-to-end domain test: `npm run test:domain`
  (uses a throwaway `empire_test` database).
- `public/map` + `public/assets` contain Rockstar imagery fetched from GTA Wiki —
  private use only, gitignored, never redistribute.
