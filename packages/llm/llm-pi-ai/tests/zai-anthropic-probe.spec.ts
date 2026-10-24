import { describe, expect, it } from 'vitest'
import {
  maskSecret,
  streamedEventNames,
  thinkingSignatureObservation,
  truncateEvidence,
} from './zai-anthropic-probe.ts'

describe('maskSecret', () => {
  it('masks every occurrence of the credential', () => {
    expect(maskSecret('key leaked: sk-abc, again sk-abc', 'sk-abc')).toBe('key leaked: [redacted:key], again [redacted:key]')
  })

  it('masks the credential inside structured response bodies', () => {
    expect(maskSecret('{"echo":"sk-abc"}', 'sk-abc')).toBe('{"echo":"[redacted:key]"}')
  })

  it('leaves text unchanged when no credential is supplied', () => {
    expect(maskSecret('plain error text', undefined)).toBe('plain error text')
    expect(maskSecret('plain error text', '')).toBe('plain error text')
  })
})

describe('truncateEvidence', () => {
  it('keeps text at or under the cap unchanged', () => {
    expect(truncateEvidence('short', 10)).toBe('short')
  })

  it('cuts long text and states the trimmed count', () => {
    expect(truncateEvidence('abcdefghij', 4)).toBe('abcd... [truncated 6 chars]')
  })
})

describe('thinkingSignatureObservation', () => {
  it('reports present for a thinking block with a signature', () => {
    expect(thinkingSignatureObservation('{"content":[{"type":"thinking","thinking":"mull","signature":"sig-1"}]}'))
      .toBe('present')
  })

  it('reports absent for a thinking block without a signature', () => {
    expect(thinkingSignatureObservation('{"content":[{"type":"thinking","thinking":"mull"}]}')).toBe('absent')
  })

  it('reports none-observed without a thinking block, without content, or without JSON', () => {
    expect(thinkingSignatureObservation('{"content":[{"type":"text","text":"ok"}]}')).toBe('none-observed')
    expect(thinkingSignatureObservation('{"type":"error","error":{"message":"nope"}}')).toBe('none-observed')
    expect(thinkingSignatureObservation('not json')).toBe('none-observed')
  })

  it('reports absent for an empty signature (present but unusable)', () => {
    expect(thinkingSignatureObservation('{"content":[{"type":"thinking","thinking":"mull","signature":""}]}'))
      .toBe('absent')
  })
})

describe('streamedEventNames', () => {
  it('collects unique event names in first-seen order', () => {
    expect(streamedEventNames('event: message_start\ndata: {}\n\nevent: thinking_delta\ndata: {}\n\nevent: message_start\n'))
      .toEqual(['message_start', 'thinking_delta'])
  })

  it('ignores lines without an event name and caps the retained set', () => {
    const many = Array.from({ length: 30 }, (_, index) => `event: e${index}`).join('\n')
    expect(streamedEventNames(`data: {}\n${many}`)).toHaveLength(20)
    expect(streamedEventNames('data: {}\nno events here')).toEqual([])
  })
})
