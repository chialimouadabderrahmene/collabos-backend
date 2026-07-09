import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CorrelationIdMiddleware,
  REQUEST_ID_HEADER,
} from './correlation-id.middleware';
import { getRequestId } from './request-context';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let req: { header: ReturnType<typeof vi.fn> };
  let res: { setHeader: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
    req = { header: vi.fn() };
    res = { setHeader: vi.fn() };
    next = vi.fn();
  });

  it('generates a new request id when no header is present', () => {
    req.header.mockReturnValue(undefined);

    middleware.use(req as never, res as never, next);

    expect(req.header).toHaveBeenCalledWith(REQUEST_ID_HEADER);
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      expect.any(String),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses an incoming x-request-id header', () => {
    req.header.mockReturnValue('incoming-id-1');

    middleware.use(req as never, res as never, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'incoming-id-1');
  });

  it('makes the request id available via getRequestId inside the request scope', () => {
    req.header.mockReturnValue('incoming-id-2');
    next.mockImplementation(() => {
      expect(getRequestId()).toBe('incoming-id-2');
    });

    middleware.use(req as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
