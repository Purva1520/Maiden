import { describe, it, expect } from 'vitest';
import { createHealthResponse } from './index.js';

describe('@maiden/shared', () => {
  it('creates an ok health response by default', () => {
    expect(createHealthResponse()).toEqual({ status: 'ok' });
  });

  it('honours an explicit status', () => {
    expect(createHealthResponse('degraded')).toEqual({ status: 'degraded' });
  });
});
