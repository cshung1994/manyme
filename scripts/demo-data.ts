const API_BASE = 'http://localhost:3001'

async function seedDemoData() {
  console.log('Seeding demo data...')
  
  // Check existing agents
  const existing = await fetch(`${API_BASE}/api/agents`).then(r => r.json())
  console.log(`Found ${existing.length} existing agents`)
  
  // Create demo sessions to show history
  const sessions = [
    { agentId: 1, userWallet: '0xAlice', totalRate: 1300, curatorRate: 1000, platformFee: 300, depositAmount: 10000000 },
    { agentId: 2, userWallet: '0xBob', totalRate: 1100, curatorRate: 800, platformFee: 300, depositAmount: 5000000 },
  ]
  
  for (const session of sessions) {
    const res = await fetch(`${API_BASE}/api/sessions/0/spawn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    })
    const data = await res.json()
    console.log(`Created session: ${data.sessionId}`)
  }
  
  console.log('Demo data seeded!')
}

seedDemoData().catch(console.error)
