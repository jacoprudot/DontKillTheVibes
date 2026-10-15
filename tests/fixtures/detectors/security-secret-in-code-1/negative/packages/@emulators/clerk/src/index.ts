// Fixture — an emulator package's OWN fake credentials (vercel-labs__emulate shape).
// Ronda 4 (version_audit, census ids 160-163/201-202/251-254/317-324): the package
// is npm-scoped — `packages/@emulators/...` — and the `@` scope marker used to
// hide the `emulators` noise segment from isSecretNoisePath. The value itself
// survives every value test (`clerk` is not a placeholder word), so ONLY the
// path segment comparison can suppress this line: this file must NOT fire.
export const config = {
  client_secret: "clerk_emulate_secret",
};
