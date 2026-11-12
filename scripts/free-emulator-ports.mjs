#!/usr/bin/env node
// On Windows the Firestore emulator's Java process sometimes survives
// `firebase emulators:exec`. This frees the emulator ports before a run.
// Only Java processes listening on 8180/9099 are stopped. No-op elsewhere.
import { execSync } from 'node:child_process';

if (process.platform === 'win32') {
  try {
    execSync('powershell -NoProfile -Command "foreach($p in 8180,9099){ Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | % { $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if ($proc -and $proc.ProcessName -eq \'java\') { Stop-Process -Id $proc.Id -Force } } }"', { stdio: 'ignore' });
  } catch { /* nothing to free */ }
}
