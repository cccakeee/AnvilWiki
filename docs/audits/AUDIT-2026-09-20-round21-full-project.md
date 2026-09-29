# AUDIT-2026-09-20 — 第 21 轮红队深挖(全项目)

- **范围**:全项目(root src/scripts/tests/workflows + tools/anvil-ops 边界面);改动窗口 v2.32.0→v2.33.1(IndexNow 链路 / fork 内容感知删除 / 模板展示页)加压。
- **方法**:三类证据纪律——A=机器枚举(临时脚本,禁止手数)/ B=语义深读(逐类过码)/ C=执行验证(真实运行)。全部发现本人当面核实(本轮未派子代理,无转述虚报面)。
- **基线**:main @ 8b0fcd9 (v2.33.1),工作树干净。审计全程只读(临时脚本在 /tmp,build 产物 gitignored)。
- **门禁结果(Phase C)**:`pnpm typecheck` ✅ `pnpm lint` ✅ `pnpm test` ✅(21 套件 / 286 tests)`pnpm build`+postbuild ✅(本机无 INDEXNOW_KEY env 时 key 文件按设计跳发)。

## 结论:0×P0,0×P1,3×P2,3×P3

---

## P2-1 IndexNow 旧所有权 key 三面泄漏:旧 key 文件仍在生产伺服 + 兼容路径拾取 + 本地 .env 死配置

**证据类型:A+B+C(全部实锤) | 置信度:高**

三面互相独立、同根因(commit a536be6 的旧代 key 文件 `public/39a73e7c4264b418baa6757d20446910.txt` 从未退役):

1. **生产双 key 并存(C)**:`https://anvil.wiki/39a73e….txt` 与 `https://anvil.wiki/736d86….txt` 当前**同时 HTTP 200**。旧 key 在 git 历史永久公开,只要文件在线,任何人可持旧 key 对 anvil.wiki 提交 IndexNow(强制重爬/索引噪音,10k URL/天/key 限额)——v2.33.1 的「key 轮换四处面」文档(wrangler/Actions var/.env/注册表)**漏了第五处:已部署的旧 key 文件本身**。
2. **fork 纯净性破口(A+B)**:该文件不在 `DEMO_PUBLIC_FILES`(scripts/lib/apply-rewrites.ts:785-797),`clear-demo-public.ts` / e2e(scripts/e2e-apply-template.mjs:128-137 只断言 google8362 html + 6 个 ads html)/ `template-audit` 三通道均不检——每个 fork 的 dist 都带上 anvil.wiki 的所有权凭据文件。
3. **本地提交静默用旧 key(C)**:`submit-indexnow.ts:195-208` `detectCommittedKey()` 的向后兼容路径扫 `public/*.txt`(内容=name 即命中,39a73e 文件像素级满足)。tsx **不加载 .env**(全文件零 dotenv,本地 .env 的 INDEXNOW_KEY 是死配置——790cb7d 的「本地 .env 双通道同步」实际无读者)。本仓执行复现:`env -u INDEXNOW_KEY pnpm submit-indexnow -- --dry-run` → **`[IndexNow] Key source: public`**(选中旧 key,而非 .env 里的新 key)。`tests/indexnow.test.ts` 对 key 优先级零覆盖,坑被「兼容特性」身份无测试祝福。

**修复方向**:删除 public/39a73e….txt(或先入 DEMO_PUBLIC_FILES 双通道);submit-indexnow 本地模式加 dotenv 加载或直接删掉 public/ fallback(生成式 key 早已被 env 模式取代);deployment.md 轮换节补「旧 key 文件下线后才算轮换完成」。

## P2-2 [vars] 重写双通道静默丢弃模板清单外用户自定义键

**证据类型:B+C | 置信度:高**

`rewriteWranglerVars`(scripts/lib/apply-rewrites.ts:686-708)解析出现有 [vars] 后**只重发 WRANGLER_VARS_TEMPLATE 内的 22 键**,清单外键直接消失、零警告;setup.yml 的 python 通道以同样的固定模板整段替换,同病。执行复现(纯函数直跑):夹带 `PUBLIC_TWITTER_HANDLE`/`DISCORD_INVITE` 的 fixture 重写后两键消失,输出无任何提示。价值感知保留(v2.29.0)只保护已知键——用户自加的 env(未提交时)重跑即永久丢失。对照:locale nav 有 ownable 过滤+保留警告、文章有 classify+警告保留,**唯独 wrangler 通道没有 unknown-key 警告**。

**修复方向**:解析后对 `existing` 中不在模板的键逐个 `⚠️ kept-in-place 或 dropped` 响亮警告(推荐保留重发,与「破坏性方向宁可保留」的既有哲学一致),契约测试钉住。

## P2-3 setup.yml `gh pr create … || echo "PR already exists"` 吞掉一切失败形态

**证据类型:B | 置信度:高(无执行复现,推理链完整:.green 前提下无 PR=用户可见的假成功)**

setup.yml 收尾 `gh pr create … || echo "PR already exists — leaving the existing one open."`——限流/认证失败/网络错误/分支规则拦截**全部**被降级为一句误导性成功文案,workflow 绿灯但 init PR 不存在。T2 口径的 exit-0 早退新变体;workflows.test.ts 契约未覆盖此 run 步骤。

**修复方向**:按 `gh` 输出区分「已存在」(grep `already exists`)与真失败(否则 `exit 1`),或改用 `gh pr list` 先判再建。

## P3-4 landingLinkEnabled 翻转双通道均静默 no-op 且零断言

**证据类型:A+B | 置信度:中高(潜伏缺陷,当前字节恰好匹配)**

CLI 通道 `src.replace('landingLinkEnabled = true', …)`(scripts/apply-template.ts:572)无匹配时静默跳过(flipped===src 无 else 警告);Actions 通道 `sed 's/landingLinkEnabled = true/…/'`(.github/workflows/setup.yml:145)同样无匹配即无操作。`tests/` 与 e2e **均无**「翻转发生」断言。project.ts 一旦被重排版(prettier/手改),fork 导航/页头指向已删除的 /landing/ 路由,构建不红、只有 404。正是本仓元规律「同一逻辑多通道漂移」的未钉实例。

**修复方向**:CLI 通道 no-match 时 `⚠️` 响亮警告;e2e 加一条 `landingLinkEnabled === false` 断言(两通道一次钉死)。

## P3-5 template-audit 对 wrangler [vars] demo 值的覆盖缺口

**证据类型:A+B | 置信度:高**

`DEMO_VAR_VALUES` 注册表 13 个 demo 值(Giscus×2/Adsterra×6/GA4/IndexNow key/SITE_URL×2),template-audit 的 wrangler 检查只查 SITE_URL(:347)与 Giscus(:361),**grep INDEXNOW/GA_ID/ADSTERRA 零命中**。清理通道(apply-template/setup.yml)是全覆盖的,但 fork 自检工具对「没跑清理就上线」的 fork 不报 demo GA ID(数据进 demo 的 GA4 属性)与 demo 广告单元 key。

**修复方向**:template-audit 复用 `DEMO_VAR_VALUES` 逐值扫 [vars],一处注册表三处受益。

## P3-6 clear-demo-content 按「提及 demo 游戏名」删文件——用户文章提及字样即被删

**证据类型:B | 置信度:高(行为确定;触发窄)**

`isDemoArticleContent = src.includes('Anvil Quest')`(scripts/lib/apply-rewrites.ts:834-836),`clear-demo-content.ts:37-40` 对命中文件直接 unlink,仅 stdout 一行 `🗑️`(kept 才走 stderr ⚠️)。用户写「Unlike Anvil Quest, …」对比句即中招。这是 v2.25.1 声明的设计哲学(内容标记而非路径清单),按协议如实定级 P3:缓解=workflow 日志可见+设计文档已声明;不改判「无需修复」。

**修复方向**(低成本):frontmatter 有 `watermark`/author 等更强身份信号时可加入判定;至少把 🗑️ 行改 stderr 与 ⚠️ 同通道。

---

## 核清勿重查(本轮逐项过,零发现)

- `_redirects` 36 条:全为 landing-doc slug 重定向,源无遮蔽、目标全存在、无链;fork 整文件删除,零交互。
- 空 catch 9 处(CodeBlock/ShareButton/LandingHero 剪贴板、check-sitemap×2/apply-template/submit-indexnow 回退)全部有意且注释在位;check-sitemap 最终 `main().catch → exit(1)`。
- `exit(0)` 7 处逐一裁决:--help ×2、用户拒绝 Proceed(有提示)、write-indexnow-key 无 key 跳过(设计)、e2e/apply-template/sync-codes 均有完成标记或契约测试钉住。
- 日期面:today.ts 五脚本收口无旁路;LegalContent 版权年构建期取值(静态站接受);ops gsc UTC 切片(既有裁决);无 `toISOString().split('T')[0]` 自然日陷阱。
- schema↔代码:nav keys/内容目录/category 枚举三方一致(check-config 另有门禁);consent 门控 Adsterra/MobileAnchorAd 同 `aw:consent-accepted` 门,ads.txt 注释态安全。
- `walk.ts` 不跟随符号链接(Dirent.isDirectory 对 symlink 为 false),无环风险。
- workflows:除本地 `./.github/actions/gates` 外全部 40-hex SHA pin(第 20 轮已验);indexnow.yml 五重门控+时间预算(wait 150×2+install ≈450s < timeout 600s);setup.yml [vars] 行首锚定+ASCII 警示块剥离两通道一致。
- IndexNow `pnpm run -- --site` 的 `--` 穿透:生产 202 实证(第 20 轮)+源码 `if (arg === '--') continue` 兜底+契约测试钉住。
- `pnpm submit-indexnow` CI 通道不受 P2-1 影响:Actions 显式注入 INDEXNOW_KEY env,env 优先级最高,生产提交仍用新 key(第 20 轮 202 日志 key source=env 为证)。

## 执行层覆盖缺口(被 mock/文本契约掩护、真实执行稀薄的面)

1. **submit-indexnow 的 HTTP 面**(waitForDeployment/waitForLiveKey/submitBatch 三次退避):单元测试为零,唯一真实执行是两次生产成功跑;429/5xx 重试路径从未被真实触发过。
2. **setup.yml 全 workflow**:python [vars] 重写/sed/rm 清单只有文本契约与真实 fork 用户背书,本仓无执行层测试(与 CLI 通道的 e2e 不对称——e2e 只测 CLI 通道;上述 P2-2/P2-3/P3-4 全部位于 Actions 通道侧)。
3. **auto-content / content-pipeline / release-ops**:仅 schedule/tag 触发,契约测试为源码文本断言(设计使然,如实交代)。
4. **transpile-pagefind main()**:每次 build 真跑(本轮 exit 0),但 `?v=` 指纹的 8 URL 位点形态依赖 pagefind 1.5.2 bundle 实证,升级 pagefind 时该假设需重验(契约测试在位)。

## 修复批次建议

- **批次 1(P2-1)**:旧 key 文件退役+detectCommittedKey fallback 处置+轮换文档补第五处——一次 IndexNow 面收口,先删文件再谈其它。
- **批次 2(P2-2+P2-3)**:「静默假成功」专项——[vars] unknown-key 警告+`gh pr create` 失败显形,各配契约测试。
- **批次 3(P3-4+P3-5)**:fork 自检工具补盲——landingLinkEnabled 断言+template-audit 全值扫描。
- **批次 4(P3-6)**:🗑️ 行 stderr 化,判定信号增强另行评估。

## 本次脚本检查覆盖清单(Phase A 全录,/tmp/audit21/)

a1-env-mirror(代码读取面↔.env.example↔wrangler↔注册表,16/22/22/13 对齐,仅 BASE_URL/DEV/GITHUB_STEP_SUMMARY 三枚进程内变量合法豁免)· a2-demo-registries(DEMO_COVERS 9/磁盘 9 对齐、gallery/article/ads 六单元/DEMO_PUBLIC_FILES/LANDING_PATHS↔setup.yml rm 双通道一致)· a4-redirects(36 条拓扑)· a5-fix(空 catch/exit(0)/未 await 粗筛/日期面全枚举)· a7-schema(schema↔消费面↔目录)· a8-workflows(pin/permissions/secrets/触发器)· r2-unknown-var(P2-2 复现)· 干跑+双 key 在线验证(P2-1 复现)。
