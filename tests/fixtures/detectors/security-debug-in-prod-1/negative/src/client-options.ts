// security-debug-in-prod-1 NEGATIVE — the object-property shape.
//
// THE MEASURED DEFECT (2026-10-08, second pass). The first anchored pattern still
// fired on `debug: true` used as a FUNCTION OPTION or an object property in
// JS/TS — 25 of 26 sweep hits were this shape, e.g. `Debug: true,` inside
// `client.imagine({ ... })` in zcpua__midjourney-api/example/*.ts. A debug flag on
// a request object is not a production debug mode.
//
// Two constraints remove it, both as RESTRICTIONS on the earlier pattern:
//   - the assignment must be the WHOLE line (a trailing comma means an object
//     property, or a continuation of another argument list), and
//   - files under a declared test/fixture/example/doc path are out of scope
//     (`params.noise: "secret-path"`, counted in findings.json.suppressions).
const options = client.imagine({
  prompt,
  Debug: true,
  retries: 2,
});

export const apiOptions = { debug: true, verbose: false };
