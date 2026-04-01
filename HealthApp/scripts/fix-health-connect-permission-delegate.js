const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-health-connect',
  'android',
  'src',
  'main',
  'java',
  'dev',
  'matinzd',
  'healthconnect',
  'permissions',
  'HealthConnectPermissionDelegate.kt',
);

if (!fs.existsSync(targetFile)) {
  process.exit(0);
}

const source = fs.readFileSync(targetFile, 'utf8');
const oldSnippet =
  '    val contract = PermissionController.createRequestPermissionResultContract(providerPackageName)';
const newSnippet =
  '    val contract = PermissionController.createRequestPermissionResultContract()';

if (!source.includes(oldSnippet) || source.includes(newSnippet)) {
  process.exit(0);
}

fs.writeFileSync(targetFile, source.replace(oldSnippet, newSnippet));
