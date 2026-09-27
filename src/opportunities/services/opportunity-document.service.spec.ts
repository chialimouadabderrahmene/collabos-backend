import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { OPPORTUNITY_SPEC_VERSION } from '../schemas/opportunity-spec.schema';
import { OpportunityDocumentService } from './opportunity-document.service';

describe('OpportunityDocumentService — R1 opportunity spec', () => {
  const service = new OpportunityDocumentService();

  describe('validateMetadata', () => {
    it('accepts metadata with no spec at all (pre-R1 opportunities)', () => {
      const result = service.validateMetadata({
        collaborationType: 'Capsule collection',
        season: 'AW27',
      });
      expect(result).toEqual({
        collaborationType: 'Capsule collection',
        season: 'AW27',
      });
    });

    it('accepts an empty metadata object', () => {
      expect(service.validateMetadata({})).toEqual({});
    });

    it('validates and normalizes a valid, complete spec, setting specVersion', () => {
      const result = service.validateMetadata({
        spec: {
          intent: 'Explore a summer campaign',
          objective: 'Produce a lookbook',
        },
      }) as Record<string, unknown>;

      expect(result.specVersion).toBe(OPPORTUNITY_SPEC_VERSION);
      expect(result.spec).toEqual({
        intent: 'Explore a summer campaign',
        objective: 'Produce a lookbook',
      });
    });

    it('validates a partial (incomplete) spec — structural validation, not readiness', () => {
      const result = service.validateMetadata({
        spec: { intent: 'Just an idea for now' },
      }) as Record<string, unknown>;

      expect(result.specVersion).toBe(OPPORTUNITY_SPEC_VERSION);
      expect(result.spec).toEqual({ intent: 'Just an idea for now' });
    });

    it('preserves unrelated existing metadata fields alongside the spec', () => {
      const result = service.validateMetadata({
        collaborationType: 'Capsule collection',
        season: 'AW27',
        presentation: { typography: 'editorial' },
        spec: { intent: 'Explore a summer campaign' },
      }) as Record<string, unknown>;

      expect(result.collaborationType).toBe('Capsule collection');
      expect(result.season).toBe('AW27');
      expect(result.presentation).toEqual({ typography: 'editorial' });
      expect(result.spec).toEqual({ intent: 'Explore a summer campaign' });
      expect(result.specVersion).toBe(OPPORTUNITY_SPEC_VERSION);
    });

    it('rejects a structurally invalid spec (wrong field type)', () => {
      expect(() =>
        service.validateMetadata({ spec: { intent: 12345 } }),
      ).toThrow(BadRequestException);
    });

    it('rejects a spec with an unknown key', () => {
      expect(() =>
        service.validateMetadata({ spec: { madeUpField: 'nope' } }),
      ).toThrow(BadRequestException);
    });

    it('rejects an unsupported specVersion sent by the client', () => {
      expect(() =>
        service.validateMetadata({
          specVersion: 2,
          spec: { intent: 'ok' },
        }),
      ).toThrow(BadRequestException);
    });

    it('accepts a client-sent specVersion that matches the current version', () => {
      const result = service.validateMetadata({
        specVersion: OPPORTUNITY_SPEC_VERSION,
        spec: { intent: 'ok' },
      }) as Record<string, unknown>;
      expect(result.specVersion).toBe(OPPORTUNITY_SPEC_VERSION);
    });

    it('still rejects metadata that references assets, spec or not', () => {
      expect(() =>
        service.validateMetadata({
          spec: { intent: 'ok' },
          link: 'asset:11111111-1111-4111-8111-111111111111',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('assertPublishableMetadata', () => {
    it('passes when there is no spec', () => {
      expect(() => service.assertPublishableMetadata({})).not.toThrow();
      expect(() => service.assertPublishableMetadata(null)).not.toThrow();
    });

    it('passes for a valid, already-normalized spec', () => {
      expect(() =>
        service.assertPublishableMetadata({
          specVersion: OPPORTUNITY_SPEC_VERSION,
          spec: { intent: 'ok' },
        }),
      ).not.toThrow();
    });

    it('rejects a structurally invalid stored spec (defence in depth)', () => {
      expect(() =>
        service.assertPublishableMetadata({ spec: { intent: 12345 } }),
      ).toThrow(UnprocessableEntityException);
    });
  });
});
