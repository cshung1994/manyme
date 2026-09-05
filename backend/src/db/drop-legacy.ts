import { getDb } from './client.js'

function dropLegacy(): void {
  const db = getDb()
  
  db.exec('DROP TABLE IF EXISTS skill_ratings')
  db.exec('DROP TABLE IF EXISTS skill_executions')
  db.exec('DROP TABLE IF EXISTS query_sales')
  db.exec('DROP TABLE IF EXISTS skills')
  
  db.exec('DROP TABLE IF EXISTS curator_earnings')
  db.exec('DROP TABLE IF EXISTS sessions')
  db.exec('DROP TABLE IF EXISTS agents')
  
  db.exec('ALTER TABLE agents_v2 RENAME TO agents')
  
  console.log('Legacy tables dropped, agents_v2 renamed to agents ✓')
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
  console.log('Remaining tables:', tables.map((t: any) => t.name).join(', '))
}

if (import.meta.main) {
  dropLegacy()
}

export { dropLegacy }
