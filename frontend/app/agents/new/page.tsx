'use client'
import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useRouter } from 'next/navigation'
import { createAgent, compressContent } from '@/lib/agents-api'
import { signAction } from '@/lib/sign-action'

/**
 * Parse SKILL.md frontmatter format
 */
function parseSkillMd(content: string): { name: string; description: string; systemPrompt: string } | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/)
  if (!fmMatch) return null

  const frontmatter = fmMatch[1]
  const body = fmMatch[2].trim()

  const nameMatch = frontmatter.match(/name:\s*(.+)/)
  const descMatch = frontmatter.match(/description:\s*(.+)/)

  return {
    name: nameMatch?.[1]?.trim() || 'Unnamed Agent',
    description: descMatch?.[1]?.trim() || '',
    systemPrompt: body.slice(0, 8000),
  }
}

export default function UploadAgentPage() {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'manual' | 'import'>('manual')

  // Manual form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'general',
    systemPrompt: '',
    userPromptTemplate: '',
    model: 'gemini-2.5-flash',
    temperature: '0.3',
    maxTokens: '1024',
    ratePerSecond: '0',
    metadataUri: '',
  })
  const [inputFields, setInputFields] = useState<{ name: string; type: string; required: boolean }[]>([])

  // Import state
  const [skillMdContent, setSkillMdContent] = useState('')
  const [patternFiles, setPatternFiles] = useState<{ name: string; content: string }[]>([])
  const [importPreview, setImportPreview] = useState<{ name: string; description: string; patterns: string[] } | null>(null)
  const [importCategory, setImportCategory] = useState('defi')
  const [importPrice, setImportPrice] = useState('100')
  const [autoCompress, setAutoCompress] = useState(true)
  const [compressStatus, setCompressStatus] = useState('')

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const addInputField = () => {
    setInputFields(prev => [...prev, { name: '', type: 'text', required: true }])
  }

  const updateField = (index: number, key: string, value: string | boolean) => {
    setInputFields(prev => prev.map((f, i) => i === index ? { ...f, [key]: value } : f))
  }

  const removeField = (index: number) => {
    setInputFields(prev => prev.filter((_, i) => i !== index))
  }

  const detectVariables = () => {
    const matches = form.userPromptTemplate.match(/\{\{(\w+)\}\}/g)
    if (!matches) return
    const vars = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))]
    const existing = new Set(inputFields.map(f => f.name))
    const newFields = vars.filter(v => !existing.has(v)).map(v => ({ name: v, type: 'text', required: true }))
    if (newFields.length > 0) setInputFields(prev => [...prev, ...newFields])
  }

  const processImportedContent = (content: string, pFiles: { name: string; content: string }[]) => {
    setSkillMdContent(content)
    const parsed = parseSkillMd(content)
    if (parsed) {
      setImportPreview({
        name: parsed.name,
        description: parsed.description,
        patterns: pFiles.map(p => p.name),
      })
    } else {
      setImportPreview(null)
    }
  }

  // Handle Directory Upload
  const handleDirectoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    let masterContent = ''
    const newPatterns: { name: string; content: string }[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.name === 'SKILL.md') {
        masterContent = await file.text()
      } else if (file.webkitRelativePath.includes('/patterns/') && file.name.endsWith('.md')) {
        const content = await file.text()
        newPatterns.push({ name: file.name.replace('.md', ''), content })
      } else if (file.name.endsWith('.md') && file.name !== 'README.md') {
        // Fallback if not inside a strict "patterns/" folder but uploaded together
        const content = await file.text()
        newPatterns.push({ name: file.name.replace('.md', ''), content })
      }
    }
    
    setPatternFiles(newPatterns)
    if (masterContent) {
      processImportedContent(masterContent, newPatterns)
    } else {
      setError('Directory must contain a SKILL.md file at its root.')
    }
  }

  // Submit manual form
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) { setError('Connect wallet first'); return }
    if (!form.name || !form.description || !form.systemPrompt) {
      setError('Name, description, and system prompt are required'); return
    }
    setLoading(true)
    setError('')

    try {
      let inputSchemaJson: string | undefined
      if (inputFields.length > 0) {
        const schema: Record<string, unknown> = {
          type: 'object',
          properties: {} as Record<string, unknown>,
          required: inputFields.filter(f => f.required).map(f => f.name),
        }
        for (const field of inputFields) {
          (schema.properties as Record<string, unknown>)[field.name] = { type: field.type === 'number' ? 'number' : 'string' }
        }
        inputSchemaJson = JSON.stringify(schema)
      }

      // Auto-compress
      let systemPrompt = form.systemPrompt
      if (autoCompress && systemPrompt.length > 3000) {
        setCompressStatus('Compressing system prompt...')
        const result = await compressContent(systemPrompt, 'skill')
        systemPrompt = result.content
        setCompressStatus(`Compression: ${result.original}B -> ${result.compressed}B (${result.ratio})`)
      }

      const auth = await signAction(signMessageAsync, address, 'create-agent')
      const created = await createAgent({
        name: form.name,
        description: form.description,
        category: form.category,
        systemPrompt,
        rawSystemPrompt: systemPrompt !== form.systemPrompt ? form.systemPrompt : undefined,
        userPromptTemplate: form.userPromptTemplate || undefined,
        model: form.model,
        temperature: parseFloat(form.temperature),
        maxTokens: parseInt(form.maxTokens),
        ratePerSecond: parseInt(form.ratePerSecond),
        metadataUri: form.metadataUri || undefined,
        inputSchemaJson,
      }, auth)

      router.push(`/agents/${created.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Submit import
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) { setError('Connect wallet first'); return }

    const parsed = parseSkillMd(skillMdContent)
    if (!parsed) { setError('Invalid SKILL.md format. Must have --- frontmatter ---'); return }

    setLoading(true)
    setError('')
    setCompressStatus('')

    try {
      // Auto-compress if enabled
      let masterPrompt = parsed.systemPrompt
      const processedPatterns = [...patternFiles]

      if (autoCompress && masterPrompt.length > 3000) {
        setCompressStatus('Compressing SKILL.md...')
        const result = await compressContent(masterPrompt, 'skill')
        masterPrompt = result.content
        setCompressStatus(`SKILL.md: ${result.original}B -> ${result.compressed}B (${result.ratio})`)

        for (let i = 0; i < processedPatterns.length; i++) {
          if (processedPatterns[i].content.length > 2000) {
            setCompressStatus(`Compressing ${processedPatterns[i].name}...`)
            const pr = await compressContent(processedPatterns[i].content, 'pattern')
            processedPatterns[i] = { ...processedPatterns[i], content: pr.content }
          }
        }
        setCompressStatus('Compression complete. Deploying...')
      }

      const auth = await signAction(signMessageAsync, address, 'create-agent')
      let createdAgentId = ''

      // Create master agent from SKILL.md
      const created = await createAgent({
        name: parsed.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: parsed.description,
        category: importCategory,
        systemPrompt: masterPrompt,
        rawSystemPrompt: parsed.systemPrompt,
        userPromptTemplate: 'Analyze: {{query}}\n\nChain: {{chain}}\nTarget address (if any): {{address}}',
        model: 'gemini-2.5-flash',
        temperature: 0.2,
        maxTokens: 2048,
        ratePerSecond: parseInt(importPrice),
        metadataUri: form.metadataUri || undefined,
        inputSchemaJson: JSON.stringify({
          type: 'object',
          properties: { query: { type: 'string' }, chain: { type: 'string' }, address: { type: 'string' } },
          required: ['query'],
        }),
      }, auth)
      createdAgentId = created.id

      // Create individual pattern agents
      for (let i = 0; i < processedPatterns.length; i++) {
        const pattern = processedPatterns[i]
        const originalPattern = patternFiles[i]
        const patternAuth = await signAction(signMessageAsync, address, 'create-agent')
        const patternName = pattern.name
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())

        await createAgent({
          name: patternName,
          description: `${patternName} — sub-agent from ${parsed.name}`,
          category: importCategory,
          systemPrompt: pattern.content.slice(0, 8000),
          rawSystemPrompt: originalPattern?.content,
          userPromptTemplate: '{{query}}\n\nTarget: {{address}}\nChain: {{chain}}',
          model: 'gemini-2.5-flash',
          temperature: 0.2,
          maxTokens: 2048,
          ratePerSecond: parseInt(importPrice),
          inputSchemaJson: JSON.stringify({
            type: 'object',
            properties: { query: { type: 'string' }, address: { type: 'string' }, chain: { type: 'string' } },
            required: ['query'],
          }),
        }, patternAuth)
      }

      router.push(`/agents/${createdAgentId}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-surface-dim border border-border-subtle px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none text-sm transition-colors'
  const labelCls = 'block text-xs uppercase tracking-widest font-bold text-text-secondary mb-3'

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-24 py-24">
        <div className="mb-16 border-b border-border-strong pb-8">
          <h1 className="font-display text-6xl font-bold tracking-tight mb-4">
            Upload Agent
          </h1>
          <p className="text-text-secondary text-2xl italic max-w-3xl">
            Deploy a new autonomous agent to the marketplace.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-4 mb-16 border-b border-border-subtle">
          <button type="button" onClick={() => setMode('manual')}
            className={`pb-3 text-xs uppercase tracking-widest font-bold transition-colors ${
              mode === 'manual' 
                ? 'text-text-primary border-b-2 border-text-primary' 
                : 'text-text-tertiary hover:text-text-primary'
            }`}>
            Manual Config
          </button>
          <button type="button" onClick={() => setMode('import')}
            className={`pb-3 text-xs uppercase tracking-widest font-bold transition-colors ${
              mode === 'import' 
                ? 'text-text-primary border-b-2 border-text-primary' 
                : 'text-text-tertiary hover:text-text-primary'
            }`}>
            Import Directory
          </button>
        </div>

        <div className="max-w-3xl">
        {mode === 'import' ? (
          /* ===== IMPORT MODE ===== */
          <form onSubmit={handleImportSubmit} className="space-y-8">
            {/* Directory Upload */}
            <div className="group border border-border-strong p-12 bg-surface-elevated relative overflow-hidden text-center hover:border-accent transition-colors cursor-pointer">
              <label className="block cursor-pointer relative z-10">
                <div className="w-16 h-16 mx-auto border border-border-strong flex items-center justify-center text-text-primary mb-6 group-hover:bg-surface-dim group-hover:border-accent transition-all">
                  <span className="material-symbols-outlined text-2xl">folder_open</span>
                </div>
                <h3 className="text-text-primary font-display font-bold text-2xl mb-3 italic">Upload Skill Directory</h3>
                <p className="text-sm text-text-secondary">
                  Auto-parses SKILL.md and multiple sub-agents from patterns/*.md
                </p>
                {/* @ts-ignore */}
                <input type="file" webkitdirectory="" directory="" onChange={handleDirectoryUpload} className="hidden" />
              </label>
            </div>

            {/* Preview */}
            {importPreview && (
              <div className="bg-surface-elevated border border-border-subtle p-8 mt-8">
                <h3 className="text-xs font-bold text-accent mb-4 tracking-widest uppercase flex items-center gap-2">
                  <span className="w-2 h-2 bg-accent inline-block animate-pulse" />
                  Target Preview
                </h3>
                <p className="text-2xl font-display font-bold text-text-primary mb-2 italic">{importPreview.name}</p>
                <p className="text-sm text-text-secondary mb-6 leading-relaxed max-w-2xl">{importPreview.description}</p>
                <div className="flex items-center gap-3 text-xs uppercase tracking-widest font-bold text-text-tertiary">
                  <span className="px-3 py-1 bg-surface-dim border border-border-subtle text-text-secondary">1 Core</span>
                  {importPreview.patterns.length > 0 && (
                    <>
                      <span>+</span>
                      <span className="px-3 py-1 bg-surface-dim border border-border-subtle text-text-secondary">{importPreview.patterns.length} Sub-agents</span>
                    </>
                  )}
                  <span>=</span>
                  <span className="text-text-primary">{1 + importPreview.patterns.length} Total</span>
                </div>
              </div>
            )}

            {/* Auto-compress toggle */}
            <div className="flex items-center gap-4 py-4 border-y border-border-subtle mt-8">
              <label className="flex items-center gap-3 text-xs uppercase tracking-widest font-bold text-text-secondary cursor-pointer">
                <input type="checkbox" checked={autoCompress} onChange={e => setAutoCompress(e.target.checked)}
                  className="w-4 h-4 border border-border-strong checked:bg-text-primary appearance-none cursor-pointer flex items-center justify-center checked:after:content-['✓'] checked:after:text-surface-elevated checked:after:text-[10px]" />
                Enable Prompt Compression
              </label>
              {compressStatus && (
                <span className="text-xs text-accent uppercase tracking-widest font-bold bg-surface-dim px-3 py-1">
                  {compressStatus}
                </span>
              )}
            </div>

            {/* Category + Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              <div>
                <label className={labelCls}>Category</label>
                <select value={importCategory} onChange={e => setImportCategory(e.target.value)} className={inputCls}>
                  <option value="general">General</option>
                  <option value="defi">DeFi</option>
                  <option value="trading">Trading</option>
                  <option value="research">Research</option>
                  <option value="nft">NFT</option>
                  <option value="security">Security</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Rate (USDC/sec)</label>
                <input type="number" value={importPrice} onChange={e => setImportPrice(e.target.value)}
                  min="0" step="1" className={inputCls} />
              </div>
            </div>

            {error && (
              <div className="bg-surface-dim border border-error/50 text-error p-4 text-sm font-bold mt-8">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !address || !skillMdContent}
              className="w-full mt-12 bg-text-primary text-surface-elevated font-bold tracking-widest py-4 px-8 text-xs uppercase transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Executing...' : !address ? 'Connect Wallet' : `Deploy Agents (${importPreview ? 1 + patternFiles.length : 0})`}
            </button>
          </form>
        ) : (
          /* ===== MANUAL MODE ===== */
          <form onSubmit={handleManualSubmit} className="space-y-8">

            <div>
              <label className={labelCls}>Agent Name <span className="text-accent">*</span></label>
              <input value={form.name} onChange={update('name')} required placeholder="e.g. Data Scraper" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Description <span className="text-accent">*</span></label>
              <textarea value={form.description} onChange={update('description')} required rows={3}
                placeholder="Primary function of this agent..." className={`${inputCls} resize-none`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className={labelCls}>Category</label>
                <select value={form.category} onChange={update('category')} className={inputCls}>
                  <option value="general">General</option>
                  <option value="defi">DeFi</option>
                  <option value="trading">Trading</option>
                  <option value="research">Research</option>
                  <option value="nft">NFT</option>
                  <option value="security">Security</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Model</label>
                <select value={form.model} onChange={update('model')} className={inputCls}>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>System Prompt <span className="text-accent">*</span></label>
              <textarea value={form.systemPrompt} onChange={update('systemPrompt')} required rows={6}
                placeholder="You are an autonomous agent deployed to..."
                className={`${inputCls} resize-none`} />
            </div>

            <div className="bg-surface-elevated border border-border-subtle p-8">
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs uppercase tracking-widest font-bold text-text-primary">
                  User Prompt Template
                </label>
                <span className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">Use {'{{variable}}'} to auto-generate inputs</span>
              </div>
              <textarea value={form.userPromptTemplate} onChange={update('userPromptTemplate')} rows={3}
                placeholder="Analyze {{target}} using {{parameters}}"
                onBlur={detectVariables}
                className={`${inputCls} resize-none bg-surface-dim`} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className={labelCls}>Input Parameters</label>
                <button type="button" onClick={addInputField}
                  className="text-xs uppercase tracking-widest font-bold text-text-primary hover:text-accent transition-colors">
                  + Add Parameter
                </button>
              </div>
              
              <div className="space-y-4">
                {inputFields.map((field, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-surface-elevated p-4 border border-border-subtle">
                    <input value={field.name} onChange={e => updateField(i, 'name', e.target.value)}
                      placeholder="Variable Name"
                      className="flex-1 bg-surface-dim border border-border-subtle px-4 py-2 text-text-primary text-sm focus:border-accent outline-none w-full sm:w-auto" />
                    <select value={field.type} onChange={e => updateField(i, 'type', e.target.value)}
                      className="bg-surface-dim border border-border-subtle px-4 py-2 text-text-primary text-sm focus:border-accent outline-none w-full sm:w-auto">
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="select">Select</option>
                    </select>
                    <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                      <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-text-secondary">
                        <input type="checkbox" checked={field.required}
                          onChange={e => updateField(i, 'required', e.target.checked)} 
                          className="w-4 h-4 border border-border-strong checked:bg-text-primary appearance-none cursor-pointer flex items-center justify-center checked:after:content-['✓'] checked:after:text-surface-elevated checked:after:text-[10px]" />
                        Required
                      </label>
                      <button type="button" onClick={() => removeField(i)}
                        className="text-text-tertiary hover:text-error text-xl font-bold transition-colors">&times;</button>
                    </div>
                  </div>
                ))}
                {inputFields.length === 0 && (
                  <p className="text-sm text-text-tertiary italic p-4 border border-border-subtle border-dashed text-center">No input parameters defined.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <label className={labelCls}>Temperature: {form.temperature}</label>
                <div className="relative pt-2">
                  <input type="range" value={form.temperature} onChange={update('temperature')}
                    min="0" max="2" step="0.1" 
                    className="w-full h-1 bg-border-strong appearance-none accent-text-primary cursor-pointer outline-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Max Tokens</label>
                <input type="number" value={form.maxTokens} onChange={update('maxTokens')}
                  min="128" max="8192" step="128" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Rate (USDC/sec)</label>
                <input type="number" value={form.ratePerSecond} onChange={update('ratePerSecond')}
                  min="0" step="1" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Metadata URL</label>
              <input type="url" value={form.metadataUri} onChange={update('metadataUri')}
                placeholder="https://github.com/..." className={inputCls} />
            </div>

            <div className="flex items-center gap-4 py-4 border-y border-border-subtle mt-8">
              <label className="flex items-center gap-3 text-xs uppercase tracking-widest font-bold text-text-secondary cursor-pointer">
                <input type="checkbox" checked={autoCompress} onChange={e => setAutoCompress(e.target.checked)}
                  className="w-4 h-4 border border-border-strong checked:bg-text-primary appearance-none cursor-pointer flex items-center justify-center checked:after:content-['✓'] checked:after:text-surface-elevated checked:after:text-[10px]" />
                Enable Prompt Compression
              </label>
              {compressStatus && (
                <span className="text-xs text-accent uppercase tracking-widest font-bold bg-surface-dim px-3 py-1">
                  {compressStatus}
                </span>
              )}
            </div>

            {error && (
              <div className="bg-surface-dim border border-error/50 text-error p-4 text-sm font-bold mt-8">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !address}
              className="w-full mt-12 bg-text-primary text-surface-elevated font-bold tracking-widest py-4 px-8 text-xs uppercase transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Deploying...' : !address ? 'Connect Wallet' : 'Deploy Agent'}
            </button>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}
