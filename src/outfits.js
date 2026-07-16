// The main character's wardrobe.
// Look 0 is the default body; every other entry is a full rigged GLB of the SAME
// character wearing a different outfit. They all share the Mixamo skeleton, so the
// shared messaggera clips retarget onto any of them at runtime — swapping outfit =
// swapping which GLB the player renders, nothing else.
//
// Free to pick for now (the user chooses in the wardrobe). In v2 these get gated
// behind delivery unlocks — see unlockedLooks()/cycleLook() in questStore.js.
export const OUTFITS = [
  { id: 'classica', label: 'Classica',  url: '/main-character.glb?v=1' },
  { id: 'teal',     label: 'Tuta Teal', url: '/outfit-teal-jumpsuit.glb?v=1' },
  // coming next (each needs the Hunyuan -> Mixamo pass, then process_outfit.py):
  // { id: 'cozy',    label: 'Maglione',  url: '/outfit-cozy-sweater.glb?v=1' },
  // { id: 'scarf',   label: 'Foulard',   url: '/outfit-scarf-dress.glb?v=1' },
  // { id: 'raincoat',label: 'Impermeabile', url: '/outfit-yellow-raincoat.glb?v=1' },
]
