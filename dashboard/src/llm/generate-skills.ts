/**
 * Auto-generate LLM-friendly skills documentation from manifest.json
 * Usage: npx ts-node src/llm/generate-skills.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

interface ManifestCommand {
  command: string;
  site: string;
  name: string;
  description: string;
  access: 'read' | 'write';
  args: Array<{
    name: string;
    type: string;
    required: boolean;
    help: string;
    choices?: string[];
  }>;
}

function formatArgument(arg: ManifestCommand['args'][0]): string {
  const required = arg.required ? '(required)' : '(optional)';
  const typeInfo = arg.type || 'string';
  const choices = arg.choices?.length ? ` [${arg.choices.join('|')}]` : '';
  return `  --${arg.name} <${typeInfo}> ${required}${choices} — ${arg.help}`;
}

async function generateSkills(): Promise<void> {
  const manifestPath = path.resolve(__dirname, '../../manifest.json');
  const skillsPath = path.resolve(__dirname, '../../skills/webcmd-commands.md');

  console.log('📖 Reading manifest.json...');
  const manifest: ManifestCommand[] = JSON.parse(
    readFileSync(manifestPath, 'utf-8')
  );

  console.log(`Found ${manifest.length} commands`);

  // Group by site
  const bySite = new Map<string, ManifestCommand[]>();
  for (const cmd of manifest) {
    const site = cmd.site || 'unknown';
    if (!bySite.has(site)) {
      bySite.set(site, []);
    }
    bySite.get(site)!.push(cmd);
  }

  let markdown =
    '# Webcmd Available Commands\n\n' +
    '_Auto-generated from manifest.json. This is the reference document for the AI to understand available commands._\n\n';

  // Sort sites for consistent output
  const sites = Array.from(bySite.keys()).sort();

  for (const site of sites) {
    const commands = bySite.get(site)!;

    markdown += `## ${site}\n\n`;

    // Separate read and write commands
    const readCmds = commands.filter((c) => c.access === 'read');
    const writeCmds = commands.filter((c) => c.access === 'write');

    if (readCmds.length > 0) {
      markdown += '### Read Commands\n\n';
      for (const cmd of readCmds) {
        markdown += `#### \`${cmd.name}\`\n${cmd.description}\n\n`;
        if (cmd.args.length > 0) {
          markdown += 'Arguments:\n';
          for (const arg of cmd.args) {
            markdown += formatArgument(arg) + '\n';
          }
          markdown += '\n';
        }
      }
    }

    if (writeCmds.length > 0) {
      markdown += '### Write Commands ⚠️\n\n';
      for (const cmd of writeCmds) {
        markdown += `#### \`${cmd.name}\`\n${cmd.description}\n\n`;
        if (cmd.args.length > 0) {
          markdown += 'Arguments:\n';
          for (const arg of cmd.args) {
            markdown += formatArgument(arg) + '\n';
          }
          markdown += '\n';
        }
      }
    }

    markdown += '\n';
  }

  console.log(`✅ Writing to ${skillsPath}...`);
  writeFileSync(skillsPath, markdown, 'utf-8');
  console.log(`✅ Generated ${skillsPath}`);
}

generateSkills().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
