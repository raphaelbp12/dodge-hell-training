11 shards instead of 4 per burst. interval between bursts is 1 second.
the projectile size is much bigger, the same size of the character.
the emitter position is the same position of the enemy, the shots start in the center.
check the `image.png`, you can see the size of the projectile, also the shape the projectiles are the yellow ones. you can also see the max distance it goes.

camera zoon should be stored in the localStorage.

the player should also have a health bar bellow the character

we should have a damage tooltip. whenever the character receives damage, a sounds should play.

we should have a "controls" modal, listing all the keys we have binded and what they do.

check the sprite sizes present in the `image.png`. create new images cropping the original one selecting only the character, the enemy and the projectile, just to make sure we are talking about the same things.

when we get the sizes comparrison correctly, we can fine tune it better. we will be able to resize our parameters.

also, the arena should be as large as double the reach of the enemy. it means that if the enemy is in the center of the arena, the projectiles would reach the edge of it.
