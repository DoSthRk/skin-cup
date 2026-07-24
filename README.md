# Skin Cup

Skin Cup 是一个简体中文、移动端优先的无畏契约皮肤偏好淘汰赛。玩家选择一种武器后，让该武器当前获准的全部皮肤参加小组赛和单败淘汰赛，最终选出自己的冠军皮肤；配置了遗珠名额的枪械会在两个阶段之间增加复活赛。

这是一个非官方、无后端的静态前端项目，当前包含以下武器和皮肤池：

| 武器 | 全量入围 | 小组赛 | 遗珠复活赛 | 淘汰赛 |
| --- | ---: | --- | --- | --- |
| 狂徒 | 42 | 14 组，每组 3 选 2 | 14 把落选皮肤中选 4 | 32 强 |
| 幻影 | 36 | 12 组，每组 3 选 2 | 12 把落选皮肤中选 8 | 32 强 |
| 正义 | 24 | 6 组，每组 4 选 2 | 12 把落选皮肤中选 4 | 16 强 |
| 近战武器 | 118 | 22 组 4 选 2、10 组 3 选 2 | 无 | 64 强 |

每次开赛都会按品级均衡地重新分组，但不会随机删减参赛皮肤。近战皮肤池来自用户逐款审核后的固定 UUID 名单；新皮肤默认不自动加入。当前暂不包含账号系统、全站排行、后端数据库或可在线访问的赛果链接。

## 主要功能

- 四套独立赛制，220 款获准皮肤全部入围。
- 小组赛按规定席位多选；狂徒、幻影和正义通过复活赛补足淘汰赛名额，近战武器直接产生 64 强。
- 淘汰赛逐场二选一，直到产生冠军、亚军和四强。
- 支持后退一步、重新开赛和浏览器本地续赛。
- 冠军页可生成 JPEG 分享图、下载图片；设备支持时可唤起系统分享。
- 单张皮肤图片加载失败时显示占位内容，不阻断比赛。

## 技术栈

- React 18
- TypeScript 5
- Vite 6
- Vitest、Testing Library、jsdom
- 纯静态构建，无服务端运行时和数据库

建议使用 Node.js 20 LTS 或 22 LTS；项目当前依赖与这两个版本兼容。包管理器使用 npm，锁文件为 `package-lock.json`。

## 本地开发

先安装依赖：

```bash
npm install
```

从公开目录刷新皮肤信息，并根据项目内的准入规则重新生成 `src/data/generated-skin-catalog.ts`：

```bash
npm run sync:skins
```

同步成功时命令必须报告以下精确计数：

```text
狂徒: 42
幻影: 36
正义: 24
近战武器: 118
```

如果上游接口不可用或返回的数据导致计数不符，同步脚本会失败，不会用不完整目录覆盖现有生成文件。提交目录刷新前，必须重新运行同步命令并确认上述四个计数。

启动本地开发服务器：

```bash
npm run dev
```

运行一次完整测试（适合 CI 和发布前验证）：

```bash
npm test -- --run
```

生成生产构建；该命令会先运行 TypeScript 类型检查，再由 Vite 输出静态文件：

```bash
npm run build
```

构建结果位于 `dist/`。

## 目录结构

```text
skin-cup/
├─ scripts/
│  ├─ skin-policy.mjs            # 武器配置、品级和特效皮肤准入规则
│  └─ sync-skin-catalog.mjs      # 构建时目录同步、校验和原子写入
├─ src/
│  ├─ components/                # 选武器、各赛段、皮肤卡和冠军页
│  ├─ data/
│  │  └─ generated-skin-catalog.ts # 同步脚本生成的前端静态目录
│  ├─ domain/                    # 目录类型与纯函数赛事引擎
│  ├─ lib/                       # 本地存档和分享图生成
│  ├─ App.tsx                    # 页面状态与赛段编排
│  └─ styles.css                 # 移动端优先视觉与响应式样式
├─ tests/                        # 目录、同步、赛制、存档、界面和分享测试
├─ index.html
├─ package.json
└─ vite.config.ts
```

## 皮肤目录与运行时行为

`npm run sync:skins` 在开发或发布准备阶段请求 [Valorant-API](https://valorant-api.com/) 的简体中文武器与品级目录，校验上游结构后，按 `scripts/skin-policy.mjs` 中的规则筛选并生成本地数据文件。准入规则包括品级至少为卓越、排除无畏契约 GO 系列、识别获准特效，以及项目已确认的保留和排除例外。

网站运行时不会调用第三方皮肤目录 API，赛事逻辑直接读取随构建产物发布的静态目录。皮肤图片地址来自公开目录所提供的资源地址，因此浏览器显示图片时仍可能访问对应的远程图片 CDN；图片不可用只会触发本地占位显示。

## 本地存档与隐私

赛事进度以版本化数据保存到当前浏览器的 `localStorage`，固定键名为 `skin-cup:v1`。存档只包含所选武器、皮肤 ID、赛程选择和对阵进度，不需要账号，也不会由本项目上传到服务器。重新开赛会覆盖当前本地赛事；用户也可通过浏览器的网站数据设置清除存档。

生成分享图完全在浏览器 Canvas 中完成。只有用户主动点击系统分享时，浏览器才会把生成的图片交给设备的原生分享界面；不支持文件分享或分享失败时，应用会回退为本地下载。

## 静态部署

生产站点为 `https://valorant-cup.dosthrk.com`。执行 `npm run build` 后，将 `dist/` 内的静态文件复制到服务器独立目录 `/var/www/valorant-cup/releases/<commit>`，再原子切换 `/var/www/valorant-cup/current` 软链接。Nginx 只读取该目录，不依赖 Node.js 运行时。

发布前运行 `npm run sync:skins`、`npm test -- --run` 和 `npm run build`。该站点与服务器上的 TURNS 内部项目使用不同目录、Nginx server block 和运行方式，发布时不得修改 TURNS 的 Java 进程或 `8080` 端口。

## 流量统计

生产环境使用 GoAccess 读取 VALORANT-CUP 独立的 Nginx 访问日志，并每五分钟重新生成一次简体中文静态统计报告。后台入口为 `https://valorant-cup.dosthrk.com/traffic`，由 Nginx Basic Auth 保护且禁止搜索引擎索引；后台自身请求写入另一份日志，不会污染主站统计。服务器需生成 `zh_CN.UTF-8` locale，报告任务只在自身进程内使用该语言环境，不改变系统默认语言。

相关部署文件位于 `deploy/goaccess/`、`deploy/systemd/` 和 `deploy/nginx/valorant-cup.conf`。统计任务只读 `/var/log/nginx/valorant-cup.access.log` 及轮转日志，只写 `/var/www/valorant-cup-analytics`，不读取或修改 TURNS 的目录、进程与端口。

## 资源来源与免责声明

皮肤名称、品级及图片地址来自 Valorant-API 汇总的公开游戏数据；该服务及其数据可用性不由本项目控制。无畏契约、VALORANT、Riot Games 及相关名称、商标和游戏素材归其各自权利人所有。

Skin Cup 是非官方的玩家工具，与 Riot Games 不存在隶属、赞助或背书关系。项目未声称取得 Riot Games 或 Valorant-API 的授权；实际公开发布前，部署者应自行核对最新的素材使用政策、第三方接口条款和所在地法律要求。
