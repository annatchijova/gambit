import { describe, expect, it } from 'vitest';
import { chatRequestSchema } from '../src/lib/schemas/chat_schema';

/**
 * The assistant's replies are generative and only meaningful live; what is
 * testable is the request contract the route depends on.
 */

describe('chat request contract', () => {
  it('accepts a well-formed transcript', () => {
    const r = chatRequestSchema.safeParse({
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'check this clause' },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('rejects an empty transcript and empty content', () => {
    expect(chatRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: [{ role: 'user', content: '' }] }).success).toBe(false);
  });

  it('rejects an unknown role', () => {
    expect(
      chatRequestSchema.safeParse({ messages: [{ role: 'system', content: 'x' }] }).success,
    ).toBe(false);
  });
});
