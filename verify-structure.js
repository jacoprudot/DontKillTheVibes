#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const baseDir = process.cwd();

console.log('Verifying dontkillthevibes toolkit structure...\n');

// Check required directories
const requiredDirs = [
  'skills',
  'mcps',
  'mcps/git-mcp',
  'mcps/benchmark-mcp',
  'agents',
  'templates',
  'examples',
  'scripts',
  'docs',
  '.github',
  '.github/ISSUE_TEMPLATE',
  '.github/workflows'
];

let missingDirs = [];
for (const dir of requiredDirs) {
  const fullPath = path.join(baseDir, dir);
  if (!fs.existsSync(fullPath)) {
    missingDirs.push(dir);
  }
}

// Check required files
const requiredFiles = [
  'package.json',
  'tsconfig.base.json',
  'README.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'templates/finding-schema.json',
  'templates/SKILL_TEMPLATE.md',
  'templates/MCP_TEMPLATE.md',
  'templates/security-model.md'
];

let missingFiles = [];
for (const file of requiredFiles) {
  const fullPath = path.join(baseDir, file);
  if (!fs.existsSync(fullPath)) {
    missingFiles.push(file);
  }
}

// Check skill files
const skillFiles = [
  'database-assessment.skill.md',
  'code-quality-assessment.skill.md',
  'structure-assessment.skill.md',
  'flows-assessment.skill.md',
  'github-intelligence.skill.md',
  'security-assessment.skill.md',
  'cost-analysis.skill.md',
  'performance-assessment.skill.md'
];

let missingSkills = [];
for (const skill of skillFiles) {
  const fullPath = path.join(baseDir, 'skills', skill);
  if (!fs.existsSync(fullPath)) {
    missingSkills.push(skill);
  }
}

// Check MCP directories
const mcpTypes = ['git-mcp', 'benchmark-mcp'];
let missingMCPStructure = [];

for (const mcpType of mcpTypes) {
  const mcpDir = path.join(baseDir, 'mcps', mcpType);
  const requiredMCPFiles = [
    'package.json',
    'tsconfig.json',
    'README.md',
    'SECURITY.md',
    path.join('src', 'index.ts')
  ];
  
  for (const file of requiredMCPFiles) {
    const fullPath = path.join(mcpDir, file);
    if (!fs.existsSync(fullPath)) {
      missingMCPStructure.push(`${mcpType}/${file}`);
    }
  }
}

// Report results
if (missingDirs.length === 0 && missingFiles.length === 0 && missingSkills.length === 0 && missingMCPStructure.length === 0) {
  console.log('✅ All required files and directories are present!');
  process.exit(0);
} else {
  console.log('❌ Missing items found:');
  
  if (missingDirs.length > 0) {
    console.log('\nMissing directories:');
    missingDirs.forEach(dir => console.log(`  - ${dir}`));
  }
  
  if (missingFiles.length > 0) {
    console.log('\nMissing files:');
    missingFiles.forEach(file => console.log(`  - ${file}`));
  }
  
  if (missingSkills.length > 0) {
    console.log('\nMissing skill files:');
    missingSkills.forEach(skill => console.log(`  - ${skill}`));
  }
  
  if (missingMCPStructure.length > 0) {
    console.log('\nMissing MCP structure items:');
    missingMCPStructure.forEach(item => console.log(`  - ${item}`));
  }
  
  process.exit(1);
}