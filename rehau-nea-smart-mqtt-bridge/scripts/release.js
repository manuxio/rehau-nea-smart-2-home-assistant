#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, silent = false) {
  try {
    const result = execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return silent ? result.trim() : '';
  } catch (error) {
    log(`Error executing: ${command}`, 'red');
    throw error;
  }
}

function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  return packageJson.version;
}

function bumpVersion(type) {
  const currentVersion = getCurrentVersion();
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  return newVersion;
}

function updateVersionInFiles(newVersion) {
  // Update package.json
  const packagePath = 'package.json';
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  log(`✓ Updated ${packagePath}`, 'green');
  
  // Update config.yaml
  const configPath = 'config.yaml';
  if (fs.existsSync(configPath)) {
    let configContent = fs.readFileSync(configPath, 'utf8');
    configContent = configContent.replace(/^version:\s*".*"$/m, `version: "${newVersion}"`);
    fs.writeFileSync(configPath, configContent);
    log(`✓ Updated ${configPath}`, 'green');
  }
}

function getCommitsSinceLastTag() {
  try {
    const lastTag = exec('git describe --tags --abbrev=0', true);
    const commits = exec(`git log ${lastTag}..HEAD --oneline`, true);
    return commits ? commits.split('\n') : [];
  } catch (error) {
    // No tags found, get all commits
    try {
      const commits = exec('git log --oneline', true);
      return commits ? commits.split('\n') : [];
    } catch (e) {
      return [];
    }
  }
}

function generateCommitMessage(newVersion, commits) {
  const message = [`chore: bump version to ${newVersion}`];
  
  if (commits.length > 0) {
    message.push('');
    message.push('Changes:');
    commits.slice(0, 10).forEach(commit => {
      message.push(`- ${commit}`);
    });
    
    if (commits.length > 10) {
      message.push(`... and ${commits.length - 10} more commits`);
    }
  }
  
  return message.join('\n');
}

function hasUncommittedChanges() {
  try {
    const status = exec('git status --porcelain', true);
    return status.length > 0;
  } catch (error) {
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const bumpType = args[0] || 'patch'; // patch, minor, or major
  
  if (!['patch', 'minor', 'major'].includes(bumpType)) {
    log('Usage: npm run release [patch|minor|major]', 'red');
    log('  patch: 1.0.0 -> 1.0.1 (bug fixes)', 'yellow');
    log('  minor: 1.0.0 -> 1.1.0 (new features)', 'yellow');
    log('  major: 1.0.0 -> 2.0.0 (breaking changes)', 'yellow');
    process.exit(1);
  }
  
  log('\n🚀 Starting release process...', 'cyan');
  log('━'.repeat(50), 'cyan');
  
  // Check for uncommitted changes (excluding version files)
  if (hasUncommittedChanges()) {
    const status = exec('git status --porcelain', true);
    const nonVersionChanges = status.split('\n').filter(line => {
      return !line.includes('package.json') && !line.includes('config.yaml');
    });
    
    if (nonVersionChanges.length > 0) {
      log('\n⚠️  Warning: You have uncommitted changes:', 'yellow');
      nonVersionChanges.forEach(line => log(`  ${line}`, 'yellow'));
      log('\nPlease commit or stash your changes first.', 'red');
      process.exit(1);
    }
  }
  
  // Get current version
  const currentVersion = getCurrentVersion();
  log(`\nCurrent version: ${currentVersion}`, 'blue');
  
  // Calculate new version
  const newVersion = bumpVersion(bumpType);
  log(`New version: ${newVersion} (${bumpType})`, 'green');
  
  // Get commits since last tag
  log('\nGathering commits...', 'cyan');
  const commits = getCommitsSinceLastTag();
  if (commits.length > 0) {
    log(`Found ${commits.length} commits since last release`, 'blue');
  }
  
  // Update version in files
  log('\nUpdating version files...', 'cyan');
  updateVersionInFiles(newVersion);
  
  // Stage version files
  log('\nStaging changes...', 'cyan');
  exec('git add package.json config.yaml');
  
  // Generate and display commit message
  const commitMessage = generateCommitMessage(newVersion, commits);
  log('\nCommit message:', 'cyan');
  log('━'.repeat(50), 'cyan');
  log(commitMessage, 'yellow');
  log('━'.repeat(50), 'cyan');
  
  // Commit
  log('\nCommitting changes...', 'cyan');
  exec(`git commit -m "${commitMessage.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
  
  // Create tag
  log('\nCreating git tag...', 'cyan');
  exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
  log(`✓ Created tag v${newVersion}`, 'green');
  
  // Push
  log('\nPushing to remote...', 'cyan');
  exec('git push');
  exec('git push --tags');
  
  log('\n✅ Release complete!', 'green');
  log(`━`.repeat(50), 'green');
  log(`Version ${newVersion} has been released and pushed.`, 'green');
  log('\n');
}

main();
