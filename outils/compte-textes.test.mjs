import assert from "node:assert/strict";
import { cumuler } from "./compte-textes.mjs";
const a = cumuler({ depuis: null, ids: [] }, { depuis: "2026-10-21", textes: [{ id: "A" }, { id: "B" }] });
assert.equal(a.cumul.ids.length, 2); assert.equal(a.cumul.depuis, "2026-10-21");
// Le relevé suivant a glissé : A est sorti de la fenêtre, C est nouveau. Rien n'est retiré.
const b = cumuler(a.cumul, { depuis: "2026-10-25", textes: [{ id: "B" }, { id: "C" }] });
assert.deepEqual(b.cumul.ids, ["A", "B", "C"]); assert.equal(b.ajoutes, 1); assert.equal(b.cumul.depuis, "2026-10-21");
console.log("compte-textes : ok");
