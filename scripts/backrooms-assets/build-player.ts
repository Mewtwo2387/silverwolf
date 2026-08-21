// Assemble the Backrooms player asset from two CC0 Quaternius packs.
//
// Run from wherever the packs are unpacked; see scripts/backrooms-assets/README.md.
// Needs: bun add -d @gltf-transform/core @gltf-transform/functions sharp
//
// The base character (Universal Base Characters) ships a 65-bone UE-standard
// rig with no animation; the Universal Animation Library ships that same rig
// with 43 clips and a throwaway mannequin. The joint lists are byte-for-byte
// identical, so the clips can simply be moved onto the character — no
// retargeting, no bone mapping, nothing to drift.
//
// Output is one GLB: character mesh + only the clips this game can reach.
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, resample, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

// Inputs are wherever you unpacked the two Quaternius zips (see README.md);
// override with argv rather than editing this file.
const CHAR = process.argv[2] || 'build/Superhero_Male_FullBody.gltf';
const ANIMS = process.argv[3]
  || 'ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb';
const OUT = new URL('../../site_src/Assets/backrooms/player.glb', import.meta.url).pathname;

// Every state the player controller can actually be in. Anything else in the
// library is dead weight in a bundle the browser has to download.
const WANT: Record<string, string> = {
  Idle_Loop: 'idle',
  Walk_Loop: 'walk',
  Jog_Fwd_Loop: 'jog',
  Sprint_Loop: 'sprint',
  Crouch_Idle_Loop: 'crouchIdle',
  Crouch_Fwd_Loop: 'crouchWalk',
  Swim_Fwd_Loop: 'swim',
  Swim_Idle_Loop: 'tread',
  Jump_Start: 'jumpStart',
  Jump_Loop: 'jumpLoop',
  Jump_Land: 'jumpLand',
  Death01: 'death',
};

const io = new NodeIO();
const doc = await io.read(CHAR);
const anim = await io.read(ANIMS);

// Index the character's bones by name; the clips address nodes by identity,
// so each channel has to be re-pointed at the character's own node object.
const charNodes = new Map<string, any>();
for (const n of doc.getRoot().listNodes()) {
  const name = n.getName();
  if (name) charNodes.set(name, n);
}

let moved = 0;
const missing = new Set<string>();
for (const clip of anim.getRoot().listAnimations()) {
  const label = WANT[clip.getName()];
  if (!label) continue;
  const copy = doc.createAnimation(label);
  for (const ch of clip.listChannels()) {
    const target = ch.getTargetNode();
    const dest = target ? charNodes.get(target.getName()) : null;
    if (!dest) { if (target) missing.add(target.getName()); continue; }
    const src = ch.getSampler()!;
    // Accessors belong to their own Document, so the keyframe data has to be
    // rebuilt on this side rather than referenced across the boundary.
    const sampler = doc.createAnimationSampler()
      .setInterpolation(src.getInterpolation())
      .setInput(doc.createAccessor().setType('SCALAR').setArray(src.getInput()!.getArray()!.slice()))
      .setOutput(doc.createAccessor().setType(src.getOutput()!.getType()).setArray(src.getOutput()!.getArray()!.slice()));
    copy.addSampler(sampler);
    copy.addChannel(doc.createAnimationChannel()
      .setTargetNode(dest).setTargetPath(ch.getTargetPath()).setSampler(sampler));
  }
  moved += 1;
}
console.log(`clips moved: ${moved}/${Object.keys(WANT).length}`);
if (missing.size) console.log('unmatched bones:', [...missing].slice(0, 8));

await doc.transform(
  resample(),
  dedup(),
  prune({ keepAttributes: false, keepLeaves: false }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
);

await io.write(OUT, doc);
console.log('wrote', OUT, (await Bun.file(OUT).size) / 1024, 'KB');
console.log('animations:', doc.getRoot().listAnimations().map((a) => a.getName()).join(', '));
