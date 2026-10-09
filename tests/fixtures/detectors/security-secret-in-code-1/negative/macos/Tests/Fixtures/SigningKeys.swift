// security-secret-in-code-1 NEGATIVE — the capitalized `Tests/Fixtures` shape.
// The sweep's single largest path false positive was
// `macos/Tests/LitheGitModuleTests/GitModuleTests.swift`: the lower-case
// `__tests__`/`fixtures` sets the old scan-repo walker used never matched it.
export const signingToken = "ghp_16C7e42F292c4612E7c09d6B7d89f5a4";
