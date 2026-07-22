// The main character's wardrobe.
// Look 0 is the default body; every other entry is a full rigged GLB of the SAME
// character wearing a different outfit. They all share the Mixamo skeleton, so the
// shared messaggera clips retarget onto any of them at runtime — swapping outfit =
// swapping which GLB the player renders, nothing else.
//
// Free to pick for now (the user chooses in the wardrobe). In v2 these get gated
// behind delivery unlocks — see unlockedLooks()/cycleLook() in questStore.js.
export const OUTFITS = [
  // 'classica' IS assets/refs/outfit-scarf-dress.jpeg — the scarf dress shipped as
  // the default body, so there is no separate scarf-dress GLB to build.
  { id: 'classica', label: 'Classica',  url: '/main-character.glb?v=1' },
  { id: 'teal',     label: 'Tuta Teal', url: '/outfit-teal-jumpsuit.glb?v=1' },
  { id: 'raincoat', label: 'Impermeabile', url: '/outfit-yellow-raincoat.glb?v=1' },
  { id: 'cozy',     label: 'Maglione',  url: '/outfit-cozy-sweater.glb?v=1' },
]
