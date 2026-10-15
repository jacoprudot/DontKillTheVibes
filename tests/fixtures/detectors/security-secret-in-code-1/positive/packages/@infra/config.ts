// FN-safe companion to the @emulators negative fixture: an npm scope is NOT an
// emulator declaration. A real credential under `packages/@infra/` must STILL
// fire — ronda 4 strips at most one leading `@` for the noise-segment lookup,
// and `@infra` is not a noise segment.
export const config = {
  api_key: "aK3x9Lm2Qp7Rs4Tw8Vb1Yz5Nh0Jc6Df",
};
