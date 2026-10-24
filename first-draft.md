# First draft

This document aggregates some ideas and components for this game, and also some descriptions and goals.

## Guidelines for the agent

We should always follow YAGNI, DRY, TDD and SOLID principles. Do never assume anything, always ask me design questions. We should reuse code as much as we can. Avoid magic numbers, we should have constants defined and used for that.

## Technology

The app should be a ReactJS app. Pure frontend. Deployed to github pages by a workflow whenever main receives a new commit. The styling lib can be chosen by you. The game lib can be chosen by you.

We should devide the game in independent layers. Help me to identify the layers. For now, I can see the web components, the game data layer, game logic, game models, game engine, game drawing.

## Goal

Have an app deployed to github pages that will be a game to train for other bullet hell games. We can start small, with reduced features, to have a vertical slice.

In the first version, the player will open the app and see a home screen with a big start button, some description, changelog and a few links.

Then they will start the game session, they will have a simple character, one enemy inside an arena. I will specify those components later.

## Gameplay

This game is a training session to improve in the Realm of the Mad God game. We should try to mimetize as much as possible the gameplay experience in the ROTMG game. But we want to add many quality of life and focus on specific combats. We don't need many gameplay aspects, the goal here is pure training.

The game is a topdown view. The character moves with WASD. The character has healthbar. First version will be a time survival. The enemy will fire projectiles, the player should survive. We could store the time history in the localStorage for comparison later.

### Graphics

The sprites don't matter for now, we can use emojis or geometric shapes, they are only placeholders. We can also use free stuff from the internet.

As ROTMG, the game should be 2d, although the sprites have a notion of depth/height, determined by the rendering order/layer, I believe, not sure.

### Character

The player will have only one character. The character has some primary attributes and secondary attributes. The character won't attack in this first version.

We should start with a subset of attributes from ROTMG, the player doesn't attack for now, for instance.

Primary attributes, the ones the player sees: health, vitality, speed, defense.
Secondary attributes, the ones that will be calculated after the primary, needed to implement the gameplay.

### Enemy

We will start implementing a specific monster. It is called `Crystal Worm Child`. We can check the attributes in the `https://www.realmeye.com/wiki/crystal-worm-child` page.

We are only interested in implementing the `Crystal Worm Child Head`.

we are interested in implementing the following:

```
It then haphazardly moves around the arena, frequently firing a spiralling barrage of yellow shards that return to their position of firing. It is possible to rotate clockwise around the head to avoid all damage, however newer players might find this difficult.
```

those `shards` are projectiles that has the boomerang effect. it means that after some time, the projectile returns to the firing position.

Every time this enemy shoots, it shoots a sequence of 4 projectiles with small cooldown between them, and then it stays a few seconds without shooting. Let's call this 4 projectiles sequence as "burst" for now. This enemy shoots 4 bursts at the same time, the firing position are equally distanced between them, it means that they have a 90 degrees offset between the fire positions. And the fire direction is always in the radius direction. The firing positions spins around the enemy, they always spin keeping the 90 degress offset. It also means that when the burst happens, every projectile while have a slightly different firing position. It will create an interesting bullet hell shape, the player will need to dodge it.

You can take the projectile data from the wiki page. It has 160 damage, 8 tiles/sec, range of 19.2 tiles.

The enemy will chase the player, the enemy should be slower than the player.

### Arena

For now, we can have a standard arena, let's make it circular, the player spawns in the center, the enemy spawns close to one edge.

Later, it would be interesting to have a mechanic that the arena shrinks, or the floor turns to be lava or something like it.
