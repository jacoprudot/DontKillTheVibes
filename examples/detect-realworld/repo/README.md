# Snapshot: realworld-control (demo target)

Source: clone of the public RealWorld app used by `docs/CASE_STUDY.md`
(committed so the README demo reproduces without network).
Snapshot date: 2026-10-07. Omitted from the snapshot: `.git/`,
`node_modules/`, `package-lock.json`, `.dontkillthevibes/` — none are needed
to run the detector.

Reproduce the README demo:

```bash
pnpm detect --target examples/detect-realworld/repo
pnpm detect:report --target examples/detect-realworld/repo
```

The committed report in this directory was generated from this snapshot:
`../report.md`, `../prompts.md`, `../findings.json`.
