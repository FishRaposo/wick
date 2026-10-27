# Pour oil

*Design spec, lighting / items*

Oil is your light, and right now the only decision about it is "pick up more". We want a way to spend it. You can pour some out to make a fire on the floor: a light you can leave behind.

**The action.** A new action, **pour** (X or E on keyboard, B on gamepad). It costs **15 oil** and a turn, and leaves a burning pool on your tile. You need more than 15 oil to pour, so pouring never leaves you dry. You can't pour on the stairs or on a tile that's already burning. A refused pour costs nothing, no turn and no oil, and says why.

**The pool.**
- Lights everything within **3 tiles** that it can see, for **25 turns**, exactly like the lantern lights the floor: the tiles show as lit and remembered.
- Gutters out visibly in its last few turns.
- At most **3** burn at once; a fourth replaces the oldest.

**How enemies react.**
- **Shades** fear a pool's bright core the way they fear the lantern's: they leave it and won't wander back in. A shade only runs from the light that's burning it, so it never flees one light straight into another.
- **Moths** fly to a pool when it's closer than your lantern (or your lantern is dry) and circle it.
- Hounds don't care: they hunt by sound.

**Feedback.** A flickering flame and a warm glow on the pool. Pouring plays a sizzle; a refusal shows the reason above the player. Add "X pour 15" to the HUD and the control to the title screen.
