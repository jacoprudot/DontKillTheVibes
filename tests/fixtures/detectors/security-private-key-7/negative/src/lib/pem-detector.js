// security-private-key-7 negative (2026-10-09 adjudication, Jaco id 234):
// a string literal that BUILDS the detector pattern is not a private key. The
// spec now requires base64 body material on the line after the header, so this
// must NOT fire.
export function pemPattern() {
  return /-----BEGIN ([A-Z ]+?)-----([\s\S]+?)-----END \1-----/;
}
