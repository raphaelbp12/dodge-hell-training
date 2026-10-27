# Killer Bee Queen - Verified Source Extract

Transcribed source material for the Killer Bee Queen encounter. This file is **evidence**, not a design decision and not permission to implement. It exists so that implementation steps never have to re-fetch a page, and so every authored gameplay number can be traced to a line here.

## Provenance And Access Method

| Field | Value |
| ----- | ----- |
| Source | `https://www.realmeye.com/wiki/killer-bee-queen` |
| Secondary source | `https://www.realmeye.com/wiki/status-effects` |
| Page version | Last updated: Exalt Version 5.14.0.0 (July 2025) |
| Retrieved | 2026-10-27 |
| Retrieved by | Claude Opus 5, during the phase 19-24 planning session |

**Access method - read this before trying to fetch another RealmEye page.** The `WebFetch` tool returns an empty document for RealmEye wiki pages: it renders the JavaScript shell and reports no content. The stats, attack table and behaviour prose **are** present in the server-rendered HTML, so fetch with `curl` and parse the markup instead:

```sh
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36" \
  "https://www.realmeye.com/wiki/<page-slug>" -o /tmp/<slug>.html
```

Then strip `<script>`/`<style>`, turn block-level closing tags into newlines, drop the remaining inline tags, and unescape entities. Parse the attack table from its `<tr>`/`<td>` structure and read each projectile's name from the first cell's `<img alt=...>`; the visible table shows a sprite, so the name only exists in the image attribute. Generate tables with a script rather than hand-transcribing them.

If a future step cannot reach the source, that is a **blocker to report**, not licence to invent values.

## Stats

| Field | Value |
| ----- | ----- |
| Base HP | 112,500 (Boss Adaptive HP Scaling) |
| DEF | 50 |
| EXP | 65,000 |
| Hitbox size | 2 |
| Location | The Nest, Plagued Nest |
| Flags | Quest Monster; Levitates off Ground; Counts toward Beast Kills and God Kills |
| Immunities | Stasis, Paralyzed, Petrify; **conditional** Stunned and Dazed |

## Projectile Table

Reproduced from the page's Attacks table in its original row order. `Projectile id` is **this project's** identifier, not a wiki field: it is derived from the sprite name, with a `-vN` suffix where the same sprite appears in several rows with different stats. Lifetime is derived, not authored: `lifetimeSeconds = rangeTiles / speedTilesPerSecond`.

Rows marked `Plagued Nest only` in Comments are out of scope until the Plagued Nest variant is approved - see [the deferred register](deferred-work.md).

**Known ambiguity.** The table does not say which phase fires which row. Where a sprite repeats (for example `red-stinger-large-v1/v2/v3` at 7.5/9.75, 3.5/10.5 and 5/11), the wiki gives no way to bind a variant to a phase. Every phase-to-projectile binding in the authored data is therefore an interpretation and must be marked as one.

| # | Projectile id | Wiki sprite | Damage | Speed (t/s) | Range (t) | Lifetime (s) = range/speed | Condition effects | Comments |
| - | ------------- | ----------- | ------ | ----------- | --------- | -------------------------- | ----------------- | -------- |
| 1 | `red-stinger-small` | EH Queen Red Stinger Small | 100 | 8.5 | 9.5 | 1.117647 | - | Ignores defense of target Shots hit multiple targets |
| 2 | `red-stinger-large-v1` | EH Queen Red Stinger Large | 130 | 7.5 | 9.75 | 1.3 | Exposed for 4s | Ignores defense of target |
| 3 | `yellow-stinger-small-v1` | EH Queen Yellow Stinger Small | 100 | 7.5 | 9.75 | 1.3 | Paralyzed for 1.4s | Shots hit multiple targets |
| 4 | `yellow-stinger-large` | EH Queen Yellow Stinger Large | 140 | 5.5 | 7.15 | 1.3 | Dazed for 3s | Ignores defense of target |
| 5 | `blue-stinger-small-v1` | EH Queen Blue Stinger Small | 100 | 8.5 | 11.05 | 1.3 | Silenced for 4s | - |
| 6 | `blue-stinger-large` | EH Queen Blue Stinger Large | 120 | 8 | 10.4 | 1.3 | Pet Stasis for 4s | - |
| 7 | `red-glaive-v1` | EH Red Glaive | 0 | 14 | 9.8 | 0.7 | Armor Broken for 7s | Shots hit multiple targets |
| 8 | `blue-ball-v1` | EH Blue Ball | 0 | 3 | 10.5 | 3.5 | Pet Stasis for 3s | - |
| 9 | `blue-ball-v2` | EH Blue Ball | 90 | 6 | 10.5 | 1.75 | Pet Stasis for 4s | Shots hit multiple targets |
| 10 | `yellow-ball-v1` | EH Yellow Ball | 90 | 4.5 | 9 | 2 | Paralyzed for 0.8s | Shots hit multiple targets |
| 11 | `yellow-glaive-v1` | EH Yellow Glaive | 70 | 2.5 | 10.63 | 4.252 | Paralyzed for 0.8s Dazed for 3s | Shots hit multiple targets |
| 12 | `red-glaive-v2` | EH Red Glaive | 90 | 4 | 9 | 2.25 | Armor Broken for 3s | Ignores defense of target Shots hit multiple targets |
| 13 | `blue-glaive-v1` | EH Blue Glaive | 80 | 6 | 9.54 | 1.59 | Quiet for 2s Pet Stasis for 6s | Shots hit multiple targets |
| 14 | `red-ball` | EH Red Ball | 80 | 5.5 | 11 | 2 | Curse for 3s | Shots hit multiple targets |
| 15 | `hive-spiral-shot-v1` | EH Hive Spiral Shot | 200 | 8 | 9.6 | 1.2 | - | Ignores defense of target Shots hit multiple targets |
| 16 | `hive-range-shot-v1` | EH Hive Range Shot | 120 | 4 | 10 | 2.5 | Pet Stasis for 5s Weak for 3s | Shots hit multiple targets |
| 17 | `hive-shot-v1` | EH Hive Shot | 150 | 8 | 9.6 | 1.2 | Dazed for 3s | Shots hit multiple targets |
| 18 | `blue-stinger-small-v2` | EH Queen Blue Stinger Small | 100 | 7 | 9.1 | 1.3 | Silenced for 4s | Shots hit multiple targets |
| 19 | `yellow-ball-v2` | EH Yellow Ball | 90 | 5 | 10 | 2 | Paralyzed for 0.6s | Shots hit multiple targets |
| 20 | `blue-ball-v3` | EH Blue Ball | 90 | 4 | 6 | 1.5 | Pet Stasis for 4s | Ignores defense of target Shots hit multiple targets |
| 21 | `red-stinger-large-v2` | EH Queen Red Stinger Large | 130 | 3.5 | 10.5 | 3 | Exposed for 4s | Ignores defense of target |
| 22 | `yellow-stinger-small-v2` | EH Queen Yellow Stinger Small | 100 | 4.5 | 9 | 2 | Paralyzed for 1.4s | Shots hit multiple targets |
| 23 | `red-stinger-large-v3` | EH Queen Red Stinger Large | 100 | 5 | 11 | 2.2 | Exposed for 4s | - |
| 24 | `bee-shot` | EH Bee Shot | 130 | 5 | 10 | 2 | Slowed for 0.8s | Ignores defense of target Shots hit multiple targets |
| 25 | `red-bomb-v1` | Red Bomb | 80 | - | - | n/a (bomb) | Confused for 3s | Radius: 2 |
| 26 | `red-bomb-v2` | Red Bomb | 80 | - | - | n/a (bomb) | Armor Broken for 3s | Radius: 2 |
| 27 | `white-bomb-v1` | White Bomb | 100 | - | - | n/a (bomb) | Dazed for 2s | Radius: 2 |
| 28 | `white-bomb-v2` | White Bomb | 120 | - | - | n/a (bomb) | Dazed for 2s | Radius: 3 |
| 29 | `white-bomb-v3` | White Bomb | 175 | - | - | n/a (bomb) | Dazed for 3s | Radius: 2 |
| 30 | `blue-bomb` | Blue Bomb | 80 | - | - | n/a (bomb) | Quiet for 1s | Radius: 2 |
| 31 | `green-stinger-large-v1` | EH Queen Green Stinger Large | 130 | 5 | 15 | 3 | Unstable for 4s | Plagued Nest only Ignores defense of target |
| 32 | `green-stinger-large-v2` | EH Queen Green Stinger Large | 130 | 4 | 15.2 | 3.8 | Sick for 1.8s | Plagued Nest only Ignores defense of target Turn Rate: 70 Faces Direction |
| 33 | `green-stinger-large-v3` | EH Queen Green Stinger Large | 130 | 4 | 15.2 | 3.8 | Sick for 1.8s | Plagued Nest only Ignores defense of target Turn Rate: -70 Faces Direction |
| 34 | `green-stinger-small` | EH Queen Green Stinger Small | 120 | 8 | 8.944 | 1.118 | - | Plagued Nest only Ignores defense of target Shots hit multiple targets |
| 35 | `green-ball-v1` | EH Green Ball | 120 | 6 | 10.5 | 1.75 | Unstable for 3s | Plagued Nest only Shots hit multiple targets |
| 36 | `green-glaive-v1` | EH Green Glaive | 80 | 4.5 | 9 | 2 | Sick for 1s | Plagued Nest only Shots hit multiple targets |
| 37 | `green-stinger-large-v4` | EH Queen Green Stinger Large | 140 | 6 | 15 | 2.5 | - | Plagued Nest only Shots hit multiple targets Turn Rate: -20 |
| 38 | `green-ball-v2` | EH Green Ball | 120 | 4 | 14 | 3.5 | Unstable for 4s | Plagued Nest only Shots hit multiple targets Turn Rate: 20 |
| 39 | `green-glaive-v2` | EH Green Glaive | 100 | 3 | 13.5 | 4.5 | Sick for 1.8s | Plagued Nest only Shots hit multiple targets |
| 40 | `hive-green-shot-v1` | EH Hive Green Shot | 130 | 8 | 14.4 | 1.8 | Unstable for 3s | Plagued Nest only Shots hit multiple targets Amplitude: 0.8 Frequency: 1 |
| 41 | `hive-green-shot-v2` | EH Hive Green Shot | 130 | 7 | 10.5 | 1.5 | Unstable for 3s | Plagued Nest only Shots hit multiple targets |
| 42 | `green-ball-v3` | EH Green Ball | 80 | 2 | 3 | 1.5 | Sick for 2s | Plagued Nest only Shots hit multiple targets |
| 43 | `green-ball-v4` | EH Green Ball | 100 | 4 | 14 | 3.5 | Unstable for 3s | Plagued Nest only Shots hit multiple targets |
| 44 | `yellow-glaive-v2` | EH Yellow Glaive | 70 | 4.5 | 9 | 2 | Paralyzed for 0.8s Dazed for 3s | Plagued Nest only Shots hit multiple targets |
| 45 | `red-glaive-v3` | EH Red Glaive | 90 | 4.5 | 9 | 2 | Armor Broken for 3s | Plagued Nest only Ignores defense of target Shots hit multiple targets |
| 46 | `blue-glaive-v2` | EH Blue Glaive | 80 | 4.5 | 9 | 2 | Quiet for 2s Pet Stasis for 6s | Plagued Nest only Shots hit multiple targets |
| 47 | `hive-green-shot-v3` | EH Hive Green Shot | 130 | 6 | 10.8 | 1.8 | Unstable for 3s | Plagued Nest only Shots hit multiple targets |
| 48 | `hive-spiral-shot-v2` | EH Hive Spiral Shot | 130 | 6 | 10.8 | 1.8 | Curse for 3s | Plagued Nest only Shots hit multiple targets |
| 49 | `hive-range-shot-v2` | EH Hive Range Shot | 130 | 6 | 10.8 | 1.8 | Weak for 3s | Plagued Nest only Shots hit multiple targets |
| 50 | `hive-shot-v2` | EH Hive Shot | 130 | 6 | 10.8 | 1.8 | Dazed for 3s | Plagued Nest only Shots hit multiple targets |

## Behaviour Prose - Verbatim

Reproduced verbatim from the page's "Beehavior" section. Bullet formatting is this file's; wording is the source's. This is the **only** description of phase structure that exists, and it is qualitative: it names patterns and projectile colours but gives shot counts for only a few attacks and gives cadences for almost none.


#### Beehavior

- The Killer Bee Queen is found in a circular room with a pool of Killer Honey in the middle and Maggot Eggs along the edges. She is initially protected by a squad of assorted Killer Bees, and any Soldier Bees that enter the room will abandon their normal behavior to protect the Queen, orbiting her while healing her and attacking enemies. Once closely approached, she will flash white for a few seconds before attacking. She gains a few seconds of invulnerability when switching phases.
- Note that although she is not normally immune to Stun and Daze, she will gain conditional immunity during many of her attacks, particularly Stun immunity. Some phases where she’s vulnerable will be noted below.

#### Phase 1

- The Queen switches between circling the room and circling the pond of Killer Honey in the middle, throwing radial spreads of Quieting Blue Bombs around it while throwing targeted Dazing White Bombs at players. In addition, it fires directed spreads of Large Blue/Red Stingers and Small Yellow Stingers at nearby players. Watch out, as it may sometimes look like the Queen is firing only 3 stingers, but in fact that is 9 shots with each color stinger stacked ontop of each other.
- Note that the Queen is vulnerable to Stun for the duration of this phase.

#### Phase 2

- At 90% HP, the bridge to the boss room and the outer areas of the boss room itself slowly flood with Killer Honey, limiting the ground in the boss room to a small ring around the Queen. At this point, all players in the dungeon are teleported to the boss room.
- The Queen herself will alternate between the following attacks:
- After flashing red, she chases players quickly while firing multi-directional spreads of Small Red Stingers and single directed Large Red Stingers. All the while, she tosses radial bursts of Red Bombs that inflict Confused.
- After flashing blue, she chases players while firing directed spreads of Large Blue Stingers and spirals of Small Blue Stingers. She also fires a messy omnidirectional spray of Blue Balls along with radial bursts of Blue Bombs that Quiet.
- After flashing yellow, she fires 3-way spreads of Large Yellow Stingers and a messy spiral of Yellow Balls, all while tossing a large number of White Bombs that Daze around her.
- For each color, she also spawns in a number of the respective Killer Bees, which despawn when she switches attacks. She is invulnerable in between attacks.

#### Phase 3

- At 75% HP, the Queen despawns all Killer Bees and moves to the center of the room, flashing white. She then becomes stationary and begins firing a messy omnidirectional barrage of Red, Blue, and Yellow Balls along with Slowing bees, occasionally lobbing White Bombs along the cardinal/intermediate directions. Every 7 seconds and at the start of the phase, she fires an unavoidable wave of Red Glaives that do no damage but Armor Break for 7 seconds: essentially meaning that you’re permanently Armor Broken for this phase.
- The barrage looks randomized, but it actually follows a distinct pattern:
- Two 3-armed spirals of blue orbs, each one rotating in a different direction
- One two-armed spiral of red orbs, rotating clockwise
- Frequent rings of yellow orbs
- Occasional 4-way bursts of bee projectiles
- Note that the Queen is vulnerable to stun while she is flashing white, meaning the initial blasts of the phase can be avoided.

#### Phase 4

- At 60% HP, the Queen begins to slowly circle counter-clockwise in the center of the room while firing 4-directional spreads of Yellow, Red, and Blue Glaives at a rapid pace. Each one is aimed at a different angle so that it cannot be dodged just by standing still. It is imperative to dodge the yellow shots as they will paralyze you and make you tank half of the next wave.

#### Phase 5

- At 45% HP, the entrance tiles starts to harden further, acting as walls - though shots can still travel over them. Standing on a changing tile will disconnect the player. The Queen spawns in a number of Killer Bees of all colors and begins using colored attacks again. Like before, every time she uses a colored attack she spawns in a group of the respective color Killer Bee.
- For Red, she rapidly circles the pool of Killer Honey in the middle of the room, firing streams of Red Balls in various directions while also firing radial bursts of Red Glaives and 3-directional shotguns of red Hive Spiral Shots. She also fires radial bursts of Large Red Stingers.
- For Blue, she rapidly chases players, firing a messy bombardment of Blue Balls in all directions (akin to a Djinn’s pattern) while using radial bursts of Blue Glaives and 4-directional Small Blue Stingers. She also fires wide, directed shotguns of blue Hive Range Shots.
- For Yellow, she slowly wanders in the center of the room, firing short spiralling bursts of bee projetiles and 4-directional spreads of Yellow Glaives. She also uses radial bursts of Large Yellow Stingers and 4-directional yellow Hive Shots.
- Once again, the Queen is vulnerable to Stun for a few seconds during every color switch.

#### Phase 6

- At 25% HP, the Queen despawns all Killer Bees, moves back to the center of the room while flashing red, and spawns 3 Killer Bee Nests along the edges of the room which attack with different colored bullets that inflict different status effects. The Nests will turn vulnerable during the attack and can be destroyed, though this will alter how the fight proceeds (see notes below). The Queen herself will be stationary and invulnerable while firing a 2-way shot-machinegun of Small Red Stingers that rotates clockwise for 29 seconds, with two gaps in the rotation. The shot-machinegun is initially aimed at the top and bottom of the room and will expand over the first few seconds to cover the top-right and bottom-left corners of the room, meaning players should start in either the top-left or bottom-right to avoid this attack. This attack is extremely dangerous and most likely instant death if not avoided.
- The 3 Nests will periodically spawn Small Worker Bees and gradually swell in size until they break open to reveal three Adolescent Beehemoths, each spawning the one with corresponding color, which then join the Queen for her last phases.
- A few things to note:
- 3 Adolescent Beehemoths will always be spawned at the end of this phase, but depending on which (if any) of the Nests are broken, their colors will vary.
- Destroying a single Nest will prevent the Adolescent Beehemoth of that color from spawning but one of the other Nests will now spawn 2 Adolescent Beehemoths of its color instead. For example, destroying the Red Nest will prevent the Adolescent Red Beehemoth from spawning but either the Blue or Yellow Nest will spawn 2 Adolescent Blue Beehemoths or 2 Adolescent Yellow Beehemoths, respectively.
- Destroying 2 Nests will almost immediately stop this phase but will cause the remaining Nest to spawn 3 Adolescent Beehemoths of its color to make up for the destroyed nests. For example, destroying the Red and Blue Nests will cause the Yellow Nest to spawn 3 Adolescent Yellow Beehemoths.
- With this in mind, it is important to focus the Killer Bee Nests that you do not want to face. Despite the Adolescent Beehemoths having relatively identical stats, keep in mind what each one does: the Red one inflicts Curse and Armor Break, the Blue one inflicts Quiet, Weak, and Pet Stasis, and the Yellow one inflicts Paralyze and Daze.

#### Phase 7

- The Queen swells in size and reverts to colored attacks by flying to the respectively colored Nest and charging a bit before firing, although now the Adolescent Beehemoths protect her while firing back at players.
- For Yellow, she stays in the middle of the room, firing a rotating spiral of Slowing bees while firing another spiral of Yellow Balls rotating the other way. She also fires radial bursts of Large Yellow Stingers and yellow blasts, along with 4 White Bombs that Daze, at a 15 degree-increasing angle each time. She is Armored for the sub-phase's duration. The Adolescent Beehemoths circle along the edges of the room taking shots at nearby players.
- For Red, she circles the area slowly while firing rings of Red Balls and red Hive Spiral Shots, along with wide spreads of Large Red Stingers and radial Red bombs. She makes a total of two rotations, being Armored for the first half rotation. The Adolescent Beehemoths orbit her closely during this phase.
- For Blue, she fires sprials of Blue Glaives, radial bombardments of Blue Balls, targeted spreads of Small/Large Blue Stingers, and enormous radial blasts of blue Hive Range Shots while quickly chasing the nearest player. She is Armored for some time after starting this phase. The Adolescent Beehemoths follow her loosely.
- During this phase, the dead Nests will fire their radial attacks constantly. Also, both the Beehemoths and the Queen will have periods of invulnerability, and the Beehemoths will heal for 7,500 HP up to 3 times as their health decreases. The Beehemoths also heal the Queen every 10 seconds, with the amount depending on the number of players in the boss room when the Beehemoths are spawned.
- With less than 5 players, they will each heal for 600 HP;
- Between 5 and 10, for 3000 HP;
- Between 10 and 20, for 6000 HP;
- More than 20, for 15,000 HP.

#### Phase 8

- At 12.5% HP, the Queen returns to the center of the room and begins to fire slow, radial bursts of Large Red Stingers, Small Yellow Stingers, Blue Balls, Hive Range Shots, and all her Glaives. The Adolescent Beehemoths orbit her closely, firing radial stingers and spreads of Glaives at players, and they will cease healing the boss if her HP decreases further. This phase lasts until her death, upon which she drops her loot, the Killer Honey turns into solid ground, any remaining Beehemoths wander around for a few seconds while flashing white before self-destructing into rings of shots, and the dead Nests stop firing.
- The Queen, as well as the Beehemoths, are vulnerable to Stun during this phase, making it exceptionally easy so long as the Quiet-inflicting shots are avoided.

#### Plagued Nest

- In the Plagued Nest, the Killer Bee Queen will be able to spawn Green enemy variants in phases where she summons assorted minions. In addition, many of her phases will be modified to be harder and to accommodate these new bee types and attacks.

#### Phase 1

- Fires additional 3-way spreads of large green stingers that pierce armor.

#### Phase 2

- Gains a new green attack where the Queen chases players, firing dense turning rings of large green spinners and 2-way shotguns of small green stingers, with the back shotgun being much wider than the frontal one. Midway through the attack, she will also spawn a large number of Green Killer Bees.

#### Phase 3

- Fires an additional 2-armed counterclockwise spiral of green orbs inflicting Unstable.

#### Phase 4

- The 4-way spreads of spinners are now fired much faster and at regular intervals, and now include green spinners that inflict Sick. The Queen will also be firing a 4-way spiral of multicolored bullets, which alternates between rotating clockwise and counterclockwise.

#### Phase 5

- Gains a new green attack where the Queen chases players, firing 3-way spreads of green blasts, pairs of wavy green blasts, and a trail of small green orbs. She will periodically become Armored, pause in place, and fire a 3-layered ring of turning green stingers, green orbs, and green stars while spawning 4 Green Killer Bees.

#### Phase 6

- The Killer Bee Queen’s shot-machinegun now fires in 3 directions instead of two, greatly reducing the available space to dodge. Four Killer Bee Nests will spawn instead of 3, with the new one firing green shots that inflict Sick ( Unstable when destroyed). At the end of the phase, if the green Nest is alive, it will spawn an additional Adolescent Green Beehemoth for a total of 4 Beehemoths, following the same summoning logic as the normal version of the phase.

#### Phase 7

- Gains a new green attack where the Queen remains in the center of the arena, firing a dense spiraling barrage of green orbs, along with rings of turning stingers and four oscillating streams of green blasts. She will be Armored during this phase, and the Adolescent Beehemoths will circle around the edges of the room while periodically shooting large stingers in 3 directions.

#### Phase 8

- Seemingly unchanged outside of the presence of the fourth Adolescent Beehemoth.

## Reproduction - Spawned Enemies

The Queen's page lists her as spawning Red, Blue and Yellow Killer Bees, a Green Killer Bee in the Plagued Nest only, and the Killer Bee Nest (Queen). Phases 6 and 7 additionally involve Small Worker Bees and the three Adolescent Beehemoths.

All eight non-Plagued minions are transcribed below, retrieved 2026-10-27 by the same `curl` method. Note the Nest's page slug is `killer-bee-nest-queen`; `killer-bee-nest` is a different, unrelated stub page. The Green Killer Bee is deliberately not transcribed, per the Plagued Nest deferral.

Three facts from these pages change how the encounter must be built, and are called out because they are easy to miss in the tables:

- **The Small Worker Bee's slow is contact damage, not a shot.** Its only attack is an `[Invisible]` projectile at speed 0 and range 0, and its behaviour text is "Charges at player attempting to do contact damage." Forty armour-piercing damage and Slowed for 1.6 seconds, applied on touch.
- **The Killer Bee Nest has two distinct states.** Alive, it fires radial bursts of its colour's Hive Shot. As a corpse - which it becomes either by being destroyed or by breaking open at the end of the phase - it fires a slow, short-range radial ball of its colour instead, "constantly". The two states have entirely different attack rows, marked `<colour> nest only` and `<colour> nest corpse only`.
- **The Adolescent Beehemoths also have two states.** Normally they fire "pairs or spreads of large stingers at the nearest player"; during the Queen's final phase they fire "radial bursts of large stingers and spreads of Glaives", or of orbs for the red one.

## Minion Source Extracts

### Red Killer Bee

Source: `https://www.realmeye.com/wiki/red-killer-bee`, retrieved 2026-10-27.

| Field | Value |
| ----- | ----- |
| HP | 400 |
| DEF | 25 |
| EXP | 28 |
| Flag | Levitates off of ground |
| Flag | Immune to Paralyze |
| Flag | Immune to Petrify |
| Flag | Counts toward Critter Kills |

**Behaviour, verbatim:** Chases players while firing single shots at them.

| Sprite | Damage | Condition effects | Speed (t/s) | Range (t) | Lifetime (s) | Comments |
| ------ | ------ | ----------------- | ----------- | --------- | ------------ | -------- |
| EH Red Stinger Small | 80 | - | 7 | 10.5 | 1.5 | Ignores defense of target Shots hit multiple targets |

### Blue Killer Bee

Source: `https://www.realmeye.com/wiki/blue-killer-bee`, retrieved 2026-10-27.

| Field | Value |
| ----- | ----- |
| HP | 400 |
| DEF | 25 |
| EXP | 5 |
| Flag | Levitates off of ground |
| Flag | Immune to Petrify |
| Flag | Counts toward Critter Kills |

**Behaviour, verbatim:** Chases players while firing single shots at them.

| Sprite | Damage | Condition effects | Speed (t/s) | Range (t) | Lifetime (s) | Comments |
| ------ | ------ | ----------------- | ----------- | --------- | ------------ | -------- |
| EH Blue Stinger Small | 100 | Silenced for 3s | 7.5 | 9.75 | 1.3 | Shots hit multiple targets |

### Yellow Killer Bee

Source: `https://www.realmeye.com/wiki/yellow-killer-bee`, retrieved 2026-10-27.

| Field | Value |
| ----- | ----- |
| HP | 400 |
| DEF | 25 |
| EXP | 28 |
| Flag | Levitates off of ground |
| Flag | Immune to Stun |
| Flag | Immune to Petrify |
| Flag | Counts toward Critter Kills |

**Behaviour, verbatim:** Chases players while firing single shots at them.

| Sprite | Damage | Condition effects | Speed (t/s) | Range (t) | Lifetime (s) | Comments |
| ------ | ------ | ----------------- | ----------- | --------- | ------------ | -------- |
| EH Yellow Stinger Small | 130 | - | 6 | 10.5 | 1.75 | Shots hit multiple targets |

### Small Worker Bee

Source: `https://www.realmeye.com/wiki/small-worker-bee`, retrieved 2026-10-27.

| Field | Value |
| ----- | ----- |
| HP | 125 |
| DEF | 25 |
| EXP | 5 |
| Flag | Levitates off of ground |
| Flag | Counts toward Critter Kills |

**Behaviour, verbatim:** Charges at player attempting to do contact damage.

| Sprite | Damage | Condition effects | Speed (t/s) | Range (t) | Lifetime (s) | Comments |
| ------ | ------ | ----------------- | ----------- | --------- | ------------ | -------- |
| [Invisible] | 40 | Slowed for 1.6s | 0 | 0 | n/a (contact) | Ignores defense of target |

### Killer Bee Nest (Queen)

Source: `https://www.realmeye.com/wiki/killer-bee-nest-queen`, retrieved 2026-10-27.

| Field | Value |
| ----- | ----- |
| HP | 400,000 |
| DEF | 40 |
| EXP | 300 |
| Flag | Immune to Stasis |
| Flag | Immune to Petrify |
| Flag | Counts toward Structure Kills |
| Flag | Counts toward Lesser God Kills |

**Behaviour, verbatim:** 3 Killer Bee Nests will be spawned by the Killer Bee Queen during one of her last phases. Each one will fire radial bursts of a single color of Hive Shots, so that there is 1 Nest per color. While they do this, the Nests will flash and grow at a rapid pace while spawning Small Worker Bees. The Nests have periods of invulnerability every few seconds, and although they have very high max HP (400k each), they can be killed before the next phase. Only a fraction of their HP needs to be depleted before they are destroyed and their sprite changes to the corpse. After approximately 30 seconds, the Nests will break open and each will spawn a respectively-colored Adolescent Beehemoth. The destroyed nests will continue to fire radial bursts of respectively-colored balls until the Queen is dead. The Nests have unique behavior if destroyed prematurely. If one is destroyed, one of the two surviving nests will spawn an additional Adolescent Beehemoth to make up for the one that no longer can spawn. If two are destroyed, the phase ends prematurely and the remaining one will spawn 3 of the same kind of Adolescent Beehemoth. Note that their corpses will still fire shots during the next phases.

| Sprite | Damage | Condition effects | Speed (t/s) | Range (t) | Lifetime (s) | Comments |
| ------ | ------ | ----------------- | ----------- | --------- | ------------ | -------- |
| EH Hive Spiral Shot | 100 | - | 5 | 7 | 1.4 | Red nest only Ignores defense of target Shots hit multiple targets |
| EH Hive Range Shot | 120 | Weak for 2s | 5.5 | 7.15 | 1.3 | Blue nest only Shots hit multiple targets |
| EH Hive Shot | 120 | Dazed for 2s | 4.5 | 6.75 | 1.5 | Yellow nest only Shots hit multiple targets |
| EH Hive Green Shot | 120 | Sick for 2s | 4.5 | 6.75 | 1.5 | Green nest only Shots hit multiple targets (Plagued Nest only) |
| EH Red Ball | 45 | Curse for 2s | 2.5 | 1.875 | 0.75 | Red nest corpse only Shots hit multiple targets |
| EH Blue Ball | 45 | Pet Stasis for 4s | 2.5 | 1.875 | 0.75 | Blue nest corpse only Shots hit multiple targets |
| EH Yellow Ball | 45 | Dazed for 2s | 2.5 | 1.875 | 0.75 | Yellow nest corpse only Shots hit multiple targets |
| EH Green Ball | 45 | Unstable for 2s | 2.5 | 1.875 | 0.75 | Green nest corpse only Shots hit multiple targets (Plagued Nest only) |

### Adolescent Red Beehemoth

Source: `https://www.realmeye.com/wiki/adolescent-red-beehemoth`, retrieved 2026-10-27.

| Field | Value |
| ----- | ----- |
| HP | 20,000 |
| DEF | 40 |
| EXP | 195 |
| Flag | Levitates off ground |
| Flag | Immune to Stasis |
| Flag | Immune to Paralyzed |
| Flag | Immune to Petrify |
| Flag | Counts toward Beast Kills |
| Flag | Counts toward Lesser God Kills |

**Behaviour, verbatim:** Fires pairs or spreads of large stingers at the nearest player. During the Killer Bee Queen’s final phase, fires radial bursts of large stingers and spreads of orbs.

| Sprite | Damage | Condition effects | Speed (t/s) | Range (t) | Lifetime (s) | Comments |
| ------ | ------ | ----------------- | ----------- | --------- | ------------ | -------- |
| EH Red Stinger Large | 100 | Armor Broken for 4s | 6 | 10.5 | 1.75 | Shots hit multiple targets |
| EH Red Ball | 60 | Curse for 2s | 7 | 10.5 | 1.5 | - |

### Adolescent Blue Beehemoth

Source: `https://www.realmeye.com/wiki/adolescent-blue-beehemoth`, retrieved 2026-10-27.

| Field | Value |
| ----- | ----- |
| HP | 20,000 |
| DEF | 40 |
| EXP | 195 |
| Flag | Levitates off ground |
| Flag | Immune to Stasis |
| Flag | Immune to Paralyzed |
| Flag | Immune to Petrify |
| Flag | Counts toward Beast Kills |
| Flag | Counts toward Lesser God Kills |

**Behaviour, verbatim:** Fires pairs or spreads of large stingers at the nearest player. During the Killer Bee Queen’s final phase, fires radial bursts of large stingers and spreads of Glaives.

| Sprite | Damage | Condition effects | Speed (t/s) | Range (t) | Lifetime (s) | Comments |
| ------ | ------ | ----------------- | ----------- | --------- | ------------ | -------- |
| EH Blue Stinger Large | 120 | Weak for 2s Pet Stasis for 3s | 6.5 | 9.75 | 1.5 | Shots hit multiple targets |
| EH Blue Glaive | 60 | Quiet for 3s | 7.5 | 10.5 | 1.4 | - |

### Adolescent Yellow Beehemoth

Source: `https://www.realmeye.com/wiki/adolescent-yellow-beehemoth`, retrieved 2026-10-27.

| Field | Value |
| ----- | ----- |
| HP | 20,000 |
| DEF | 40 |
| EXP | 195 |
| Flag | Levitates off ground |
| Flag | Immune to Stasis |
| Flag | Immune to Paralyzed |
| Flag | Immune to Petrify |
| Flag | Counts toward Beast Kills |
| Flag | Counts toward Lesser God Kills |

**Behaviour, verbatim:** Fires pairs or spreads of large stingers at the nearest player. During the Killer Bee Queen’s final phase, fires radial bursts of large stingers and spreads of Glaives.

| Sprite | Damage | Condition effects | Speed (t/s) | Range (t) | Lifetime (s) | Comments |
| ------ | ------ | ----------------- | ----------- | --------- | ------------ | -------- |
| EH Yellow Stinger Large | 150 | Dazed for 2s | 7 | 9.8 | 1.4 | Shots hit multiple targets |
| EH Yellow Glaive | 80 | Paralyzed for 0.8s | 5 | 8.5 | 1.7 | - |


## Quantitative Facts Present In The Prose

These are the only numbers the behaviour text supplies. Everything else about cadence and shot count is absent from the source.

| Phase | Fact |
| ----- | ---- |
| 1 | Three visible stingers are in fact 9 shots - one of each colour stacked on top of each other |
| 2 | Enters at 90% HP; three colour sub-attacks (red, blue, yellow) alternate; invulnerable between attacks |
| 3 | Enters at 75% HP; Red Glaive armour-break wave at phase start and **every 7 seconds**; two 3-armed blue spirals rotating in opposite directions; one 2-armed red spiral rotating clockwise; frequent yellow rings; occasional 4-way bee bursts |
| 4 | Enters at 60% HP; slow counter-clockwise circling; 4-directional glaive spreads, each aimed at a different angle |
| 5 | Enters at 45% HP; three colour sub-attacks; red uses 3-directional shotguns, blue uses 4-directional small stingers, yellow uses 4-directional spreads and 4-directional hive shots |
| 6 | Enters at 25% HP; 3 Nests; **2-way** rotating shot-machinegun, clockwise, **29 seconds**, two gaps in the rotation, starting aimed top/bottom and expanding to cover top-right/bottom-left |
| 7 | Yellow sub-phase fires 4 White Bombs at a **15-degree-increasing** angle each time; red sub-phase makes **two** rotations, armoured for the first half rotation; Beehemoths heal the Queen every **10 seconds**, **600 HP** with fewer than 5 players; Beehemoths heal themselves **7,500 HP** up to **3 times** |
| 8 | Enters at 12.5% HP; lasts until death; Queen and Beehemoths vulnerable to Stun |

## Status Effect Magnitudes

From `https://www.realmeye.com/wiki/status-effects`, retrieved 2026-10-27, for every condition the Queen's projectiles inflict. "Player effect" is the quoted rule.

| Condition | Player effect, as published | Changes dodging or survival? |
| --------- | --------------------------- | ---------------------------- |
| Paralyzed | "Renders entity completely immobile." | **Yes** - movement |
| Slowed | "Reduces player SPD to 0 during movement speed calculation, resulting in a base speed of 4 tiles/second. Nullifies effects of Speedy." | **Yes** - movement |
| Confused | "Changes controls by swapping directional controls and reversing rotation controls. Left > Down, Down > Left, Right > Up, Up > Right." | **Yes** - input |
| Armor Broken | "Reduces affected entity's DEF stat to 0 during damage calculations. If the target's DEF is reduced to a negative value (ie. via Exposed), only negates their positive DEF." | **Yes** - damage |
| Exposed | "Reduces affected entity's DEF by 20 during damage calculations. Affected targets can have their Defense reduced below 0... Exposed does affect Armor Piercing attacks and attacks on an Armor Broken target, making them deal 20 more damage per hit. As it affects defense calculations, Exposed is calculated before Cursed." | **Yes** - damage |
| Curse | "Affected targets receive 25% more damage, calculated after defense and defense modifiers." | **Yes** - damage |
| Sick | "Stops natural HP regeneration by VIT, and causes all forms of HP recovery to stop functioning." | **Yes** - regeneration |
| Dazed | "Reduces player's Dexterity to 0 during fire rate calculations, resulting in a base fire rate of 1.5 attacks per second." | No - fire rate only |
| Silenced | "Prevents player from using their ability." | No - no abilities exist |
| Quiet | "Stops all forms of MP regeneration for its duration." | No - no MP exists |
| Weak | "Reduces player ATT to 0 during damage calculations." | No - player deals no damage |
| Unstable | "Weapons gain random shot deviation when aiming... Abilities that require aiming... will fire in random directions." | No - no weapon exists |
| Pet Stasis | "Turns player's pet into a chicken... Players who do not have a pet equipped cannot be inflicted with Pet Stasis." | No - no pet exists |

**Published ordering rule:** defense modifiers first (Exposed, then Armor Broken), then the defense subtraction, then Curse. The source states Exposed is "calculated before Cursed" and Curse is applied "after defense and defense modifiers".

**Gap in the source.** The page does not state how Curse interacts with the game's minimum-damage floor, which this project implements as `STAT_RULES.damage.minimumFraction = 0.1` in `app/src/game/config/stats.ts`. Any chosen ordering is an interpretation and must be recorded as one.

## Out-Of-Scope Mechanics Present In The Source

Recorded so later readers can see they were considered and deliberately excluded, with reasons in [the deferred register](deferred-work.md): Killer Honey flooding and hardening tiles; teleporting all players to the boss room; Boss Adaptive HP Scaling; group-size-scaled Beehemoth healing above 5 players; Nest destruction and its effect on Beehemoth colours; Stun vulnerability windows; Maggot Eggs; Soldier Bees entering from outside the room; the Plagued Nest variant.
