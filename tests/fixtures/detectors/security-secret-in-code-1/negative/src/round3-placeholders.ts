// security-secret-in-code-1 negative (ronda 3, 2026-10-12 adjudication): each
// value is a declared stand-in — a test/fixture prefix, an example host, a SOPS
// ciphertext marker, an x-group placeholder, a file path, or a public-by-design
// badge URL. The secret-noise value policy must suppress every one; this file
// must NOT fire.

export const config = {
  apiKey: 'test-key-123',
  vendorKey: 'C15TFAKEAMPLITUDEKEY',
  baseUrl: 'https://example.com/api/v1',
  sopsToken: 'ENC[AES256_GCM,data:x8Kd,iv:a1b2,tag:c3d4,type:str]',
  appPassword: 'xxxx-xxxx-xxxx-xxxx',
  page: 'src/webviews/pages/ChangePassword/index.tsx',
};

export const badge = '<img src="https://api.star-history.com/chart?repos=acme/demo&token=sealed_4eC39HqLyjWDarjtT1zdp7dc" />';
