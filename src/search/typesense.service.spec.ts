import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectAlreadyExists } from 'typesense/lib/Typesense/Errors';
import { TypesenseService } from './typesense.service';

const collectionsApiMock = { create: vi.fn() };
const documentsApiMock = {
  upsert: vi.fn(),
  search: vi.fn(),
  delete: vi.fn(),
};
const clientConstructorMock = vi.fn();

vi.mock('typesense', () => ({
  Client: vi.fn().mockImplementation((...args: unknown[]) => {
    clientConstructorMock(...args);
    return {
      collections: (name?: string) =>
        name ? { documents: () => documentsApiMock } : collectionsApiMock,
    };
  }),
}));

function buildConfig(configured: boolean) {
  const values: Record<string, unknown> = configured
    ? {
        'typesense.host': 'localhost',
        'typesense.port': 8108,
        'typesense.protocol': 'http',
        'typesense.apiKey': 'test-key',
      }
    : {};

  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('TypesenseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('is false when no host is configured', () => {
      const service = new TypesenseService(buildConfig(false));

      expect(service.isConfigured()).toBe(false);
      expect(clientConstructorMock).not.toHaveBeenCalled();
    });

    it('is true when a host is configured', () => {
      const service = new TypesenseService(buildConfig(true));

      expect(service.isConfigured()).toBe(true);
      expect(clientConstructorMock).toHaveBeenCalled();
    });
  });

  describe('when not configured', () => {
    it('ensureCollection is a safe no-op', async () => {
      const service = new TypesenseService(buildConfig(false));

      await expect(
        service.ensureCollection({ name: 'products', fields: [] }),
      ).resolves.toBeUndefined();
      expect(collectionsApiMock.create).not.toHaveBeenCalled();
    });

    it('upsertDocument throws', async () => {
      const service = new TypesenseService(buildConfig(false));

      await expect(
        service.upsertDocument('products', { id: '1' }),
      ).rejects.toThrow('Typesense is not configured');
    });
  });

  describe('when configured', () => {
    it('creates a collection', async () => {
      const service = new TypesenseService(buildConfig(true));

      await service.ensureCollection({ name: 'products', fields: [] });

      expect(collectionsApiMock.create).toHaveBeenCalledWith({
        name: 'products',
        fields: [],
      });
    });

    it('swallows ObjectAlreadyExists when the collection already exists', async () => {
      collectionsApiMock.create.mockRejectedValueOnce(
        new ObjectAlreadyExists('Collection already exists'),
      );
      const service = new TypesenseService(buildConfig(true));

      await expect(
        service.ensureCollection({ name: 'products', fields: [] }),
      ).resolves.toBeUndefined();
    });

    it('upserts a document', async () => {
      const service = new TypesenseService(buildConfig(true));

      await service.upsertDocument('products', { id: '1', name: 'Tee' });

      expect(documentsApiMock.upsert).toHaveBeenCalledWith({
        id: '1',
        name: 'Tee',
      });
    });

    it('searches a collection', async () => {
      documentsApiMock.search.mockResolvedValue({ found: 1, hits: [] });
      const service = new TypesenseService(buildConfig(true));

      const result = await service.search('products', 'shirt', 'name', 1, 20);

      expect(documentsApiMock.search).toHaveBeenCalledWith({
        q: 'shirt',
        query_by: 'name',
        page: 1,
        per_page: 20,
      });
      expect(result).toEqual({ found: 1, hits: [] });
    });
  });
});
