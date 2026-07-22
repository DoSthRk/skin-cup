import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  allowedEffectItems,
  filterRawCatalog,
  weaponConfigs,
  weaponIds,
} from './skin-policy.mjs';

export const weaponsEndpoint = 'https://valorant-api.com/v1/weapons?language=zh-CN';
export const contentTiersEndpoint = 'https://valorant-api.com/v1/contenttiers?language=zh-CN';
export const generatedCatalogPath = resolve('src/data/generated-skin-catalog.ts');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertUuid(value, field) {
  assert(typeof value === 'string' && uuidPattern.test(value), `${field} must be a UUID`);
}

function assertNullableUuid(value, field) {
  assert(value === null || (typeof value === 'string' && uuidPattern.test(value)), `${field} must be a UUID or null`);
}

function assertName(value, field) {
  assert(typeof value === 'string' && value.trim().length > 0, `${field} must be a non-empty string`);
}

function assertNullableString(value, field) {
  assert(value === null || typeof value === 'string', `${field} must be a string or null`);
}

function validatePayload(payload, endpoint) {
  assert(isRecord(payload), `${endpoint} payload must be an object`);
  assert(payload.status === 200, `${endpoint} payload status must be 200`);
  assert(Array.isArray(payload.data), `${endpoint} payload data must be an array`);
  return payload.data;
}

function validateWeapons(weapons) {
  weapons.forEach((weapon, weaponIndex) => {
    const weaponPath = `weapons.data[${weaponIndex}]`;
    assert(isRecord(weapon), `${weaponPath} must be an object`);
    assertUuid(weapon.uuid, `${weaponPath}.uuid`);
    assertName(weapon.displayName, `${weaponPath}.displayName`);
    assert(Array.isArray(weapon.skins), `${weaponPath}.skins must be an array`);

    weapon.skins.forEach((skin, skinIndex) => {
      const skinPath = `${weaponPath}.skins[${skinIndex}]`;
      assert(isRecord(skin), `${skinPath} must be an object`);
      assertUuid(skin.uuid, `${skinPath}.uuid`);
      assertName(skin.displayName, `${skinPath}.displayName`);
      assertNullableUuid(skin.contentTierUuid, `${skinPath}.contentTierUuid`);
      assertNullableString(skin.displayIcon, `${skinPath}.displayIcon`);
      assert(Array.isArray(skin.levels), `${skinPath}.levels must be an array`);
      assert(Array.isArray(skin.chromas), `${skinPath}.chromas must be an array`);

      skin.levels.forEach((level, levelIndex) => {
        const levelPath = `${skinPath}.levels[${levelIndex}]`;
        assert(isRecord(level), `${levelPath} must be an object`);
        assert(level.levelItem === null || typeof level.levelItem === 'string', `${levelPath}.levelItem must be a string or null`);
      });

      skin.chromas.forEach((chroma, chromaIndex) => {
        const chromaPath = `${skinPath}.chromas[${chromaIndex}]`;
        assert(isRecord(chroma), `${chromaPath} must be an object`);
        assertNullableString(chroma.fullRender, `${chromaPath}.fullRender`);
      });
    });
  });
}

function validateContentTiers(contentTiers) {
  contentTiers.forEach((tier, index) => {
    const tierPath = `contenttiers.data[${index}]`;
    assert(isRecord(tier), `${tierPath} must be an object`);
    assertUuid(tier.uuid, `${tierPath}.uuid`);
    assertName(tier.displayName, `${tierPath}.displayName`);
    assert(typeof tier.rank === 'number' && Number.isFinite(tier.rank), `${tierPath}.rank must be a finite number`);
  });
}

async function fetchPayload(fetchImpl, endpoint) {
  const response = await fetchImpl(endpoint);
  assert(isRecord(response), `${endpoint} response must be an object`);
  assert(typeof response.ok === 'boolean', `${endpoint} response.ok must be a boolean`);
  assert(typeof response.json === 'function', `${endpoint} response.json must be a function`);

  if (!response.ok) {
    throw new Error(`${endpoint} request failed with ${response.status}`);
  }

  return response.json();
}

export function normalizeRawSkins(weapons, tierById) {
  return weapons.flatMap((weapon) => {
    if (!weaponIds[weapon.displayName]) {
      return [];
    }

    return weapon.skins.flatMap((skin) => {
      if (skin.contentTierUuid === null) {
        return [];
      }

      const tier = tierById.get(skin.contentTierUuid);
      assert(tier, `${skin.displayName} references an unknown content tier UUID`);

      return {
        id: skin.uuid,
        name: skin.displayName,
        weapon: weapon.displayName,
        tier: tier.name,
        tierRank: tier.rank,
        levels: skin.levels.map((level) => ({ levelItem: level.levelItem })),
        image: skin.displayIcon,
        fullRender: skin.chromas[0]?.fullRender ?? null,
      };
    });
  });
}

export function validateCatalog(catalog) {
  assert(Array.isArray(catalog), 'Generated catalog must be an array');
  const ids = new Set();

  catalog.forEach((skin, index) => {
    const skinPath = `catalog[${index}]`;
    assert(isRecord(skin), `${skinPath} must be an object`);
    assertUuid(skin.id, `${skinPath}.id`);
    assert(!ids.has(skin.id), `${skinPath}.id must be unique`);
    ids.add(skin.id);
    assertName(skin.name, `${skinPath}.name`);
    assert(Object.hasOwn(weaponConfigs, skin.weapon), `${skinPath}.weapon is not configured`);
    assertName(skin.tier, `${skinPath}.tier`);
    assert(typeof skin.tierRank === 'number' && skin.tierRank >= 2, `${skinPath}.tierRank must be at least 2`);
    assert(Array.isArray(skin.effects), `${skinPath}.effects must be an array`);
    skin.effects.forEach((effect, effectIndex) => {
      assert(typeof effect === 'string' && allowedEffectItems.has(effect), `${skinPath}.effects[${effectIndex}] is not approved`);
    });
    assertNullableString(skin.image, `${skinPath}.image`);
    assertNullableString(skin.fullRender, `${skinPath}.fullRender`);
  });

  const mismatches = Object.entries(weaponConfigs)
    .map(([weapon, config]) => {
      const actualCount = catalog.filter((skin) => skin.weapon === weapon).length;
      return actualCount === config.expectedCount
        ? null
        : `${config.label}: expected ${config.expectedCount}, got ${actualCount}`;
    })
    .filter(Boolean);

  if (mismatches.length > 0) {
    throw new Error(`Approved skin counts do not match: ${mismatches.join('; ')}`);
  }
}

export function renderGeneratedCatalog(catalog) {
  return `// Generated by scripts/sync-skin-catalog.mjs. Do not edit manually.\nimport type { Skin } from '../domain/types';\n\nexport const skinCatalog = ${JSON.stringify(catalog, null, 2)} as const satisfies readonly Skin[];\n\nexport default skinCatalog;\n`;
}

export async function writeCatalogAtomically(outputPath, contents) {
  const targetPath = resolve(outputPath);
  const targetDirectory = dirname(targetPath);
  const temporaryPath = resolve(
    targetDirectory,
    `.${basename(targetPath)}.tmp-${randomUUID()}`,
  );

  await mkdir(targetDirectory, { recursive: true });
  try {
    await writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' });
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function syncSkinCatalog({
  fetchImpl = fetch,
  outputPath = generatedCatalogPath,
} = {}) {
  assert(typeof fetchImpl === 'function', 'fetchImpl must be a function');
  const [weaponPayload, contentTierPayload] = await Promise.all([
    fetchPayload(fetchImpl, weaponsEndpoint),
    fetchPayload(fetchImpl, contentTiersEndpoint),
  ]);
  const weapons = validatePayload(weaponPayload, 'weapons');
  const contentTiers = validatePayload(contentTierPayload, 'contenttiers');

  validateWeapons(weapons);
  validateContentTiers(contentTiers);
  const tierById = new Map(
    contentTiers.map((tier) => [
      tier.uuid,
      { name: tier.displayName, rank: tier.rank },
    ]),
  );
  const catalog = filterRawCatalog(normalizeRawSkins(weapons, tierById));

  validateCatalog(catalog);
  await writeCatalogAtomically(outputPath, renderGeneratedCatalog(catalog));
  return catalog;
}

async function main() {
  const catalog = await syncSkinCatalog();

  for (const [weapon, config] of Object.entries(weaponConfigs)) {
    const count = catalog.filter((skin) => skin.weapon === weapon).length;
    console.log(`${config.label}: ${count}`);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
