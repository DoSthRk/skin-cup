import type { Skin } from '../src/domain/types';

export interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type FetchImplementation = (url: string) => Promise<FetchResponse>;

export interface SyncSkinCatalogOptions {
  readonly fetchImpl?: FetchImplementation;
  readonly outputPath?: string;
}

export const weaponsEndpoint: string;
export const contentTiersEndpoint: string;
export const generatedCatalogPath: string;

export function normalizeRawSkins(weapons: unknown[], tierById: Map<string, unknown>): unknown[];
export function validateCatalog(catalog: unknown[]): void;
export function renderGeneratedCatalog(catalog: readonly Skin[]): string;
export function writeCatalogAtomically(outputPath: string, contents: string): Promise<void>;
export function syncSkinCatalog(options?: SyncSkinCatalogOptions): Promise<Skin[]>;
