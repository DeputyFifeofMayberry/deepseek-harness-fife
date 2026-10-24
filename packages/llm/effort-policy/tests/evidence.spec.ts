import { describe, expect, it } from 'vitest'
import { TOOL_ABORTED } from '@deepseek-ai/dsh-tools'
import { classifyOutcome, verifierIdentity, type ToolOutcome } from '../src/evidence.ts'
import type { ResolvedConfig } from '../src/config.ts'

function config(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    enabled: true,
    baseLevel: 'standard',
    verifiers: [{
      tool: 'pwsh',
      commandPattern: 'npm test',
      passPattern: 'passed',
      failPattern: 'failed',
      outcome: 'text',
    }],
    mutators: ['write', 'edit'],
    readOnlyCommands: ['git status', 'git diff'],
    infrastructureFailureCodes: [],
    shellTools: ['bash', 'pwsh'],
    ignoredArgumentKeys: ['description'],
    ...overrides,
  }
}

function outcome(overrides: Partial<ToolOutcome> = {}): ToolOutcome {
  return {
    tool: 'pwsh',
    argumentsText: '{"command":"npm test"}',
    workingDirectory: '/workspace',
    text: '3 passed',
    isError: false,
    ...overrides,
  }
}

/** Configuration with a single verifier that reads the error flag. */
function errorVerifier(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return config({
    verifiers: [{
      tool: 'typecheck', commandPattern: '', passPattern: '', failPattern: '', outcome: 'error',
    }],
    ...overrides,
  })
}

describe('classifyOutcome', () => {
  it('reads a configured verifier by its patterns', () => {
    const rule = config()
    expect(classifyOutcome(rule, outcome())).toBe('verification-pass')
    expect(classifyOutcome(rule, outcome({ text: '1 failed' }))).toBe('verification-failure')
  })

  it('treats a verifier crash as infrastructure, not a failed check', () => {
    expect(classifyOutcome(config(), outcome({ text: 'spawn failed', isError: true }))).toBe('infrastructure')
  })

  it('reads an error-outcome verifier by the error flag', () => {
    const cfg = errorVerifier()
    expect(classifyOutcome(cfg, outcome({ tool: 'typecheck', argumentsText: '{}', text: '', isError: true })))
      .toBe('verification-failure')
    expect(classifyOutcome(cfg, outcome({ tool: 'typecheck', argumentsText: '{}', text: '', isError: false })))
      .toBe('verification-pass')
  })

  it('treats a cancellation as infrastructure even when the verifier reads the error flag', () => {
    const cfg = errorVerifier()
    expect(classifyOutcome(cfg, outcome({
      tool: 'typecheck', argumentsText: '{}', text: 'aborted', isError: true, failureCode: TOOL_ABORTED,
    }))).toBe('infrastructure')
  })

  it('treats a configured failure category as infrastructure', () => {
    const cfg = errorVerifier({ infrastructureFailureCodes: ['PROVIDER_OVERLOADED'] })
    expect(classifyOutcome(cfg, outcome({
      tool: 'typecheck', argumentsText: '{}', text: 'overloaded', isError: true, failureCode: 'PROVIDER_OVERLOADED',
    }))).toBe('infrastructure')
    // A code the deployment did not classify is the verifier's own verdict.
    expect(classifyOutcome(cfg, outcome({
      tool: 'typecheck', argumentsText: '{}', text: '3 errors', isError: true, failureCode: 'TYPECHECK_FAILED',
    }))).toBe('verification-failure')
  })

  it('counts a configured mutator as a mutation', () => {
    expect(classifyOutcome(config(), outcome({
      tool: 'write', argumentsText: '{"file_path":"a.ts"}', text: 'ok',
    }))).toBe('mutation')
  })

  it('counts an unrecognized shell command as a mutation', () => {
    expect(classifyOutcome(config(), outcome({ argumentsText: '{"command":"rm -rf dist"}', text: '' })))
      .toBe('mutation')
  })

  it('leaves a configured read-only command out of the revision', () => {
    expect(classifyOutcome(config(), outcome({ argumentsText: '{"command":"git status"}', text: '' })))
      .toBe('ignored')
  })

  it('ignores a tool that neither verifies nor mutates', () => {
    expect(classifyOutcome(config(), outcome({
      tool: 'read', argumentsText: '{"file_path":"a.ts"}', text: 'contents',
    }))).toBe('ignored')
  })

  it('treats a verifier-named tool that does not match the command as a shell mutation', () => {
    expect(classifyOutcome(config(), outcome({ argumentsText: '{"command":"ls"}', text: '' }))).toBe('mutation')
  })
})

describe('verifierIdentity', () => {
  it('separates tools and their exact arguments', () => {
    const first = verifierIdentity(outcome({ argumentsText: '{"command":"npm test"}' }))
    const second = verifierIdentity(outcome({ argumentsText: '{"command":"npm run lint"}' }))
    expect(first).not.toBe(second)
    expect(first).toContain('pwsh')
  })

  it('separates the same command in different directories', () => {
    const here = verifierIdentity(outcome({ workingDirectory: '/workspace/a' }))
    const there = verifierIdentity(outcome({ workingDirectory: '/workspace/b' }))
    expect(here).not.toBe(there)
  })

  it('separates a directory-less run from a run in the workspace root', () => {
    expect(verifierIdentity(outcome({ workingDirectory: '' })))
      .not.toBe(verifierIdentity(outcome({ workingDirectory: '.' })))
  })
})
