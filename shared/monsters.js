// Monster definitions — abilities, weaknesses, counterplay and lore.
export const MONSTERS = {
  mimic: {
    id: 'mimic', name: 'THE MIMIC', color: 0x2a2a2a, weapon: 'lantern', specialCd: 20,
    special: 'Disguise [Q]: take the outfit of a survivor. While disguised it cannot kill, but can set traps, break enchantments and carry the fallen.',
    passive: 'In demon form it strikes with the lantern in its hand.',
    weakness: 'Candles and lit areas expose it and hurl it a random distance across the map. It casts no shadow.',
    counter: 'Place candles (limited, long burn). A candle beside an enchanted tomb makes it unbreakable. Light and snuff them as needed.',
    lore: 'Tobiah Wren was a travelling actor who stole the faces of the dead for his stage. One night the faces stole him back. Now he wears whoever you trust most, and his lantern burns with the last breath of his own name.',
  },
  wanderer: {
    id: 'wanderer', name: 'THE WANDERER', color: 0x3b2f2a, weapon: 'axe', specialCd: 35,
    special: 'Crow Sight [Q]: crows perched on the stone bollards screech when they see a survivor. Teleport to the last screeching crow. Failed enchantments are revealed to it.',
    passive: 'Strikes with a woodsman axe, then carries the victim away.',
    weakness: 'The crow teleport has a long cooldown.',
    counter: 'Keep clear of crows (crouching sneaks past them) and never fail an enchantment.',
    lore: 'A shepherd who fed his flock to the crows during the long famine so that he might live. The crows remembered. They gave him their eyes, and took his rest.',
  },
  puppeteer: {
    id: 'puppeteer', name: 'THE PUPPETEER', color: 0x3a1f2a, weapon: 'string', specialCd: 60,
    special: 'Blackout [Q]: every light in the realm dies, only faint moonlight remains for 10s. The Puppeteer sees clearly.',
    passive: 'Lashes a puppet string [RMB] (short range) that pulls the survivor in.',
    weakness: 'Blackout is short with a long cooldown. The string cannot reach far.',
    counter: 'During Blackout stay still or crawl into tall grass. The Puppeteer barely sees motionless survivors.',
    lore: 'Madame Liesl carved marionettes from the coffin wood of children no one came to bury. When the village burned her workshop, the strings found her wrists instead.',
  },
  ravager: {
    id: 'ravager', name: 'THE RAVAGER', color: 0x3a2a1a, weapon: 'chainsaw', specialCd: 40,
    special: 'Blood Trail [Q]: footprints bloom around every survivor within 30m for a short time.',
    passive: 'Hears running survivors far better than any other demon. Must rev the chainsaw [R] to down a survivor.',
    weakness: 'It struggles to pinpoint sounds. The chainsaw roar is heard across the whole realm.',
    counter: 'Read the chainsaw direction (shown faintly on screen). Crouch-walking leaves no footprints and no noise.',
    lore: 'Gunnar Holt cleared the old forest for the mill, though the trees screamed. He went deaf so he would not hear them. In the dark, the forest gave him back his hearing: every sound, all at once, forever.',
  },
  stalker: {
    id: 'stalker', name: 'THE STALKER', color: 0x1f2a33, weapon: 'trident', specialCd: 18,
    special: 'Tidecaller [Hold RMB, release]: throws a returning trident with long range. Aiming calls lightning from the aimed direction, visible to all.',
    passive: 'Completely silent. Survivors only notice it by their own shadow flickering and the world turning wrong. Can impale and carry.',
    weakness: 'The trident has a cooldown. Lightning betrays every aim.',
    counter: 'Hold a candle and watch your shadow. Candles burn twice as long against the Stalker.',
    lore: 'A drowned fisherman who swore to the sea he would bring back every soul it lost. The sea took him at his word. He walks out of the fog without a sound, still dripping, still counting.',
  },
};
export const MONSTER_IDS = Object.keys(MONSTERS);
