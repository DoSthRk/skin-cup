import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { syncSkinCatalog } from '../scripts/sync-skin-catalog.mjs';

function response(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

describe('syncSkinCatalog', () => {
  it('accepts Valorant API UUID formats before checking catalog counts', async () => {
    const weaponUuid = '9c82e19d-4575-0200-1a81-3eacf00cf872';
    const tierUuid = '60bca009-4182-7998-dee7-b8a2558dc369';

    await expect(
      syncSkinCatalog({
        outputPath: join(tmpdir(), `unused-skin-catalog-${Date.now()}.ts`),
        fetchImpl: async (url) =>
          response(
            url.includes('/weapons')
              ? {
                  status: 200,
                  data: [{ uuid: weaponUuid, displayName: '狂徒', skins: [] }],
                }
              : {
                  status: 200,
                  data: [{ uuid: tierUuid, displayName: '卓越', rank: 2 }],
                },
          ),
      }),
    ).rejects.toThrow(/Approved skin counts do not match/);
  });

  it('accepts unranked upstream base skins with a null content tier', async () => {
    const weaponUuid = '9c82e19d-4575-0200-1a81-3eacf00cf872';
    const skinUuid = '9c134f41-4c29-1bd8-682e-178e7f349c9b';
    const tierUuid = '60bca009-4182-7998-dee7-b8a2558dc369';

    await expect(
      syncSkinCatalog({
        outputPath: join(tmpdir(), `unused-skin-catalog-${Date.now()}.ts`),
        fetchImpl: async (url) =>
          response(
            url.includes('/weapons')
              ? {
                  status: 200,
                  data: [
                    {
                      uuid: weaponUuid,
                      displayName: '狂徒',
                      skins: [
                        {
                          uuid: skinUuid,
                          displayName: '从个人最爱中随机选择',
                          contentTierUuid: null,
                          displayIcon: null,
                          levels: [{ levelItem: null }],
                          chromas: [{ fullRender: null }],
                        },
                      ],
                    },
                  ],
                }
              : {
                  status: 200,
                  data: [{ uuid: tierUuid, displayName: '卓越', rank: 2 }],
                },
          ),
      }),
    ).rejects.toThrow(/Approved skin counts do not match/);
  });

  it('rejects malformed upstream data without replacing the committed catalog', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'skin-catalog-'));
    const outputPath = join(directory, 'generated-skin-catalog.ts');
    await writeFile(outputPath, 'previous catalog', 'utf8');

    try {
      await expect(
        syncSkinCatalog({
          outputPath,
          fetchImpl: async () =>
            response({
              status: 200,
              data: [{ uuid: 'not-a-uuid', displayName: '狂徒', skins: [] }],
            }),
        }),
      ).rejects.toThrow(/uuid/i);

      expect(await readFile(outputPath, 'utf8')).toBe('previous catalog');
      expect((await readdir(directory)).filter((name) => name.includes('.tmp-'))).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
