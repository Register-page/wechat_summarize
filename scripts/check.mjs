import { spawnSync } from 'node:child_process';

const checks = [
    ['node', ['--check', 'bot-config.js']],
    ['node', ['--check', 'bot-logic.js']],
    ['node', ['--test']]
];

for (const [command, args] of checks) {
    const result = spawnSync(command, args, { stdio: 'inherit' });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
