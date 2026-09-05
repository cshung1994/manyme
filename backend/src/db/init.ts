import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { getDb } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function initDb(): void {
  const db = getDb();

  const schemaPath = resolve(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  const count = db.prepare('SELECT COUNT(*) as cnt FROM agents').get() as { cnt: number };
  if (count.cnt === 0) {
    console.log('Seeding demo agents and skills...');
    seedAgents();
    const seededSkills = seedSkillsFromDir();
    console.log(`Seeded demo agents and ${seededSkills} skills.`);
  } else {
    console.log(`DB already has ${count.cnt} agent(s), skipping seed.`);
  }
}

function seedAgents(): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO agents (
      id, creator_wallet, name, description, category,
      system_prompt, model, temperature, tools_json,
      active, created_at, updated_at
    )
    VALUES (
      $id, $creator_wallet, $name, $description, $category,
      $system_prompt, $model, $temperature, $tools_json,
      1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  const agents = [
    {
      $id: randomUUID(),
      $creator_wallet: '0x0000000000000000000000000000000000000001',
      $name: 'DeFi Pool Analyst',
      $description: 'Analyzes DEX pool health, TVL, volume, and fee activity using OnchainOS Market API.',
      $category: 'defi',
      $system_prompt: JSON.stringify({
        analysisTemplates: ['pool-snapshot'],
      }),
      $model: 'gemini-2.5-flash',
      $temperature: 0.2,
      $tools_json: JSON.stringify([{ type: 'onchainos-market', description: 'Fetch pool data' }]),
    },
    {
      $id: randomUUID(),
      $creator_wallet: '0x0000000000000000000000000000000000000002',
      $name: 'Yield Comparator',
      $description: 'Compares yield opportunities across pools and vaults, ranking by risk-adjusted returns.',
      $category: 'defi',
      $system_prompt: JSON.stringify({
        analysisTemplates: ['yield-compare'],
      }),
      $model: 'gemini-2.5-flash',
      $temperature: 0.2,
      $tools_json: JSON.stringify([{ type: 'onchainos-market', description: 'Fetch yield data' }]),
    },
  ];

  const insertMany = db.transaction(() => {
    for (const agent of agents) {
      insert.run(agent);
    }
  });

  insertMany();
}

function parseFrontmatter(content: string): { name: string; description: string; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/)
  if (!match) return null
  const fm = match[1]
  return {
    name: fm.match(/name:\s*(.*)/)?.[1]?.trim() || 'Unnamed Skill',
    description: fm.match(/description:\s*(.*)/)?.[1]?.trim() || '',
    body: match[2].trim(),
  }
}

function inferCategory(name: string, desc: string): string {
  const n = name.toLowerCase()
  const text = `${name} ${desc}`.toLowerCase()
  // Check name first for strong signals
  if (n.includes('nft')) return 'nft'
  if (n.includes('security') || n.includes('audit')) return 'security'
  if (n.includes('trading') || n.includes('signal')) return 'trading'
  if (n.includes('defi') || n.includes('onchain') || n.includes('on-chain')) return 'defi'
  // Fallback to description
  if (text.includes('nft') || text.includes('collection') || text.includes('floor price')) return 'nft'
  if (text.includes('secur') || text.includes('audit') || text.includes('vulnerab')) return 'security'
  if (text.includes('trad') || text.includes('signal') || text.includes('momentum')) return 'trading'
  if (text.includes('defi') || text.includes('pool') || text.includes('vault') || text.includes('dex')) return 'defi'
  return 'general'
}

function seedSkillsFromDir(): number {
  const db = getDb();
  const skillsRoot = resolve(__dirname, '../../../skills');
  if (!existsSync(skillsRoot)) return 0;

  const insert = db.prepare(`
    INSERT INTO agents (
      id, creator_wallet, name, description, category,
      system_prompt, user_prompt_template, model, temperature, max_tokens,
      input_schema_json, tools_json, rate_per_second, migrated_from, active, created_at, updated_at
    )
    VALUES (
      $id, $creator, $name, $desc, $category,
      $systemPrompt, $userPromptTemplate, $model, $temperature, $maxTokens,
      $inputSchema, $toolsJson, 100, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  // RPC tools config for DeFi/Security skills
  const RPC_TOOLS = JSON.stringify({
    type: 'rpc',
    methods: ['eth_blockNumber', 'eth_getBalance', 'eth_getCode', 'eth_call', 'eth_getLogs', 'eth_getStorageAt', 'eth_getTransactionReceipt', 'eth_getBlockByNumber'],
  });

  const CURATOR = 'system';
  const defaultSchema = JSON.stringify({
    type: 'object',
    properties: { query: { type: 'string' }, address: { type: 'string' }, chain: { type: 'string' } },
    required: ['query'],
  });
  let count = 0;

  // Scan all directories under skills/
  const dirs = readdirSync(skillsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))

  const seedAll = db.transaction(() => {
    for (const dir of dirs) {
      const skillDir = resolve(skillsRoot, dir.name);
      const skillMdPath = resolve(skillDir, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;

      const skillMd = readFileSync(skillMdPath, 'utf-8');
      const parsed = parseFrontmatter(skillMd);
      if (!parsed) continue;

      const category = inferCategory(parsed.name, parsed.description);
      const displayName = parsed.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      // Enable RPC tools for defi and security skills
      const enableTools = ['defi', 'security'].includes(category)

      // Master skill from SKILL.md
      insert.run({
        $id: randomUUID(),
        $creator: CURATOR,
        $name: displayName,
        $desc: parsed.description,
        $category: category,
        $systemPrompt: parsed.body.slice(0, 8000),
        $userPromptTemplate: '{{query}}\n\nChain: {{chain}}\nTarget: {{address}}',
        $model: 'gemini-2.5-flash',
        $temperature: 0.2,
        $maxTokens: enableTools ? 4096 : 2048,
        $inputSchema: defaultSchema,
        $toolsJson: enableTools ? RPC_TOOLS : null,
      });
      count++;
      console.log(`  [master] ${displayName}`);

      // Pattern sub-skills
      const patternsDir = resolve(skillDir, 'patterns');
      if (!existsSync(patternsDir)) continue;

      const patternFiles = readdirSync(patternsDir).filter(f => f.endsWith('.md'));
      for (const pf of patternFiles) {
        const content = readFileSync(resolve(patternsDir, pf), 'utf-8');
        const patternName = pf.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const firstLine = content.split('\n').find(l => l.startsWith('# '))?.slice(2) || patternName;

        insert.run({
          $id: randomUUID(),
          $creator: CURATOR,
          $name: firstLine,
          $desc: `${firstLine} — from ${displayName} skill pack`,
          $category: category,
          $systemPrompt: content.slice(0, 8000),
          $userPromptTemplate: '{{query}}\n\nTarget: {{address}}\nChain: {{chain}}',
          $model: 'gemini-2.5-flash',
          $temperature: 0.2,
          $maxTokens: enableTools ? 4096 : 2048,
          $inputSchema: defaultSchema,
          $toolsJson: enableTools ? RPC_TOOLS : null,
        });
        count++;
        console.log(`  [pattern] ${firstLine}`);
      }
    }
  });
  seedAll();

  return count;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('init.ts')) {
  initDb();
  console.log('DB initialized successfully.');
}
