# 广告变现:什么时候接、怎么接、钱怎么收

> 模板广告位的**接入操作**(AdSense 4 个环境变量、Cloudflare 里填哪里)见站内[学习手册 · 课 22「开广告:时机与接入」](https://anvil.wiki/zh/landing/docs/enable-ads)和 [deployment.md 环境变量清单](deployment.md#环境变量清单)。
> 本文解决剩下的四个实战问题:**什么时候把广告打开**(时机错了会掉排名)、**AdSense 的钱怎么进国内银行卡**(三道验证 + 电汇)、**Adsterra 怎么从注册接到上线**(格式取舍 + 与 AdSense 共存的红线)、**广告平台怎么随流量升级**(起步/进阶/成熟三档 + 游戏垂直网络)。

## 你的广告开关在哪(30 秒背景)

模板内置 3 个广告位(Sticky 粘底 / Sidebar 侧栏 / InContent 文中),由 `PUBLIC_ADSENSE_CLIENT` + 3 个 slot 环境变量控制,**留空 = 不渲染,默认全关**。这个"默认关"正是为下面的时机策略设计的——站可以先干净上线,时机到了再填变量打开。

AdSense 之外的常用备选是 Adsterra(审核快、零流量门槛),它的广告单元是一段独立脚本,在你自己的 fork 里粘到对应位置即可——具体粘哪、怎么和模板 3 个 AdSense 位共存,见本文第三节。

---

## 一、什么时候把广告打开(时机)

**核心结论:广告晚开一两天,收入少几十块;开早了,排名掉了损失的是整个站。**

1. **上线后先跑 1-2 天再接广告**。让 Google 第一次收录、第一批用户访问看到的是干净、快的页面——用户体验信号(Clarity 里能看到)直接影响排名,别在起跑线上赌。
2. **同类站原则:第一页的对手都没挂广告时,你也不挂。** 新游戏窗口期大家拼的是排名,排名没稳定前,别为一点广告费赌体验和排名。

> 实战案例:某站主关键词做到第一后马上加了 banner 广告,排名随后**持续下滑**;撤掉广告后排名恢复。广告是变现手段,不是起量手段——顺序别反了。

**开广告前的自查清单(全部满足再动手):**

- ☐ 上线 ≥ 1-2 天,且已被 Google 收录(GSC 能看到数据)
- ☐ 核心词排名稳定(进前 10,或在持续上升)
- ☐ 第一页的同类站已经在挂广告(对手先赚这个钱,说明生态成熟了)
- ☐ 广告位打开后 Lighthouse 仍然 ≥ 95(模板广告位是懒加载的,正常不影响)

开完之后,用 [Clarity 热力图](deployment.md#用-microsoft-clarity-看用户在你站点上干什么免费)盯一件事:**广告位有没有被点**。冷清就挪位置,别让它白占版面。

### 申请 AdSense 前的体检:22 项 AD-\* 清单

上面那份自查清单管的是「什么时候开广告」;**交 AdSense 申请之前**,还有一道更前置的体检:「我这个站现在交上去,是过、是拒、还是白交」。逐项四态判定(Pass / Fail / Unknown / N-A),按 Blocker / High / Medium 分级,Blocker 未清零别提交——**被拒记录跟着 AdSense 账户走,别拿站点去试错**。

清单归 `/anvil-adsense-audit` 技能维护(支持技能的 AI 助手输入斜杠命令即可跑全项,模板已解决的项会自动给证据),这里只放速查版:

| 组 | 查什么 | 高频 Fail 项 |
|---|---|---|
| A 资格与所有权 | 自有域名(非 pages.dev)、所有权信号(关于/联系页真实内容) | 免费 `*.pages.dev` 域名基本过不了审 |
| B 内容质量 | 篇数 ≥15、原创性、深度、时效(codes 页 7 天内)、语言一致性、分类全非空 | 正文是抓取摘要无增量评论;过期码挂「有效」 |
| C 技术与抓取 | check-links 零死链、build 全绿、sitemap 200、无登录墙、robots.txt 不挡 `Mediapartners-Google`/`AdsBot-Google` | 自加 robots.txt 时误挡广告爬虫 |
| D 体验与信任 | 导航可达、无欺骗性交互、内链健康 | — |
| E 隐私与合规 | 隐私页广告 cookie 披露完好(模板已内置)、儿童向判定、素材版权 | 隐私页被改写过丢了披露段 |
| F 申请时机 | 排名未稳可申请但过审后缓开广告、被拒复审先要拒因、申请期清空联盟位 | 拿不到拒因就盲改重交 |

**模板现状参照**(2026-08-31 对 demo 站跑过一次全项审计,基线随 v2.6.0 内容整备批更新):机制层全部就绪——隐私披露/ads.txt 就绪行(过审删 `#` 填 ID 即生效)/零广告门禁/死链门禁/sitemap/法律页五件套全 Pass;**不能过审的只有内容经营本身**:demo 9 篇英文文章(仍 <15)、codes 页演示日期会随时间过期(用 `pnpm refresh-audit` 检查)、域名是 pages.dev——原审计的空 `items` 分类已由 v2.6.0 补齐(现有 2 篇),不再是缺口。剩下的正好是每个 fork 用户申请前自己要补齐的事,模板机制帮不了——见 [game-selection.md](game-selection.md)(选品)与学习手册「内容生产」阶段(产页)。

---

## 二、AdSense:让钱真正进你的银行卡

AdSense 审核通过、广告上线,后台开始积累余额——但从"后台有余额"到"钱进你的国内银行卡",中间还隔着**三道有周期的验证 + 一个收款方式**。最常见的翻车剧本:攒到 $100 才发现 PIN 没验证,付款挂起,白白多等一个月。

先记住出账节奏,再看怎么把每道关卡提前办掉:

- **起付 $100**,达到后自动出账(可设自动付款,不用手动申请)
- **每月 21 日出账打款**(北京时间 22 日凌晨),电汇 **1-3 个工作日**到账
- **当月 20 日前**完成下面所有验证与设置的,才赶得上当月付款窗口

### 第一道:税务信息(W-8BEN 表,10 分钟)

不提交税务信息,美国访客产生的收入默认按 30% 预扣;中美有税收协定,提交后降到 10%:

1. AdSense 后台 → **付款** → **管理设置** → **税务信息** → 提交 W-8BEN
2. 受益人身份选个人,国家/地区选**中国**,税号填身份证号
3. 关键一步:**勾选「申请税收协定优惠」**,条款选 Royalties(特许权使用费),协定税率会自动带出(中美 10%)
4. 电子签名提交,立即生效

### 第二道:地址 PIN 明信片(被动等待 2-4 周,最容易卡住的一道)

余额到 **$10** 时,Google 自动生成 6 位 PIN,平信寄到你账户里的收款地址(中国一般从新加坡/马来西亚寄出,2-4 周到,有一定丢失率):

- 收到后:后台 → **付款** → **验证检查** → 输入 PIN,立即通过
- 一共 **4 次机会**:1 次自动寄出 + 3 次手动重发(间隔几周,后台「付款」页可申请)
- **PIN 生成后 4 个月内没验证,Google 会暂停你站上的广告展示**——钱不丢,验证后恢复,但收入断档
- 4 次都收不到:走官方表单申请**人工验证**(上传身份证/银行账单等地址证明,几天通过)

两个预防动作:**注册时就把地址写规范**(英文格式,门牌号→街道→区→市→省逐级写全),并且**别等 $10 才想起来**——审核通过当天就核对一遍地址。

### 第三道:身份验证(按提示做)

部分账户会触发 KYC 身份验证,按提示上传证件即可。注意一个反直觉细节:**身份验证的姓名用汉字**(与证件一致),而下面银行收款人用**拼音**——两处长得不一样是正常的,别手痒改统一。

### 绑电汇收款方式(10 分钟)

1. 后台 → **付款** → **添加付款方式** → 选**电汇(Wire Transfer)**
2. 收款人姓名用**拼音**,和银行卡开户名对得上;填卡号、银行名称和 **SWIFT 码**(开户行官网可查,或打客服电话问"接收美元电汇的 SWIFT 码")
3. 任何支持接收跨境美元电汇的**普通储蓄卡**都行,不必专门办外币卡
4. 顺手设置**自动付款**——每满 $100 自动打款,不用惦记

### 到账后:结汇

电汇到账的是美元,在手机银行 App 里直接**结汇**成人民币(按银行当日汇率;个人每年 5 万美元结汇额度,个人站长远远用不完)。

> 三道验证 + 收款方式,操作量加起来不到 1 小时,但每道都有等待周期。**审核通过当天就全办掉**,别和付款窗口赛跑。逐步细节见 [Google 官方「获得付款的步骤」](https://support.google.com/adsense/answer/1709858?hl=zh-Hans)。

---

## 三、Adsterra 接入:从注册到广告上线

Adsterra 是 AdSense 之外最常用的备选:**零流量门槛、审核分钟级、USDT $100 起付**。三种典型用法:

- **AdSense 被拒 / 还在审核等待期**:先挂 Adsterra 回血,过了再切换或共存
- **站还太小,AdSense 收入可怜**:Adsterra 不挑流量
- **完全不想依赖 Google**:Adsterra 一条龙(广告 + 第五节同层的备胎平台)

### 注册和加站(10 分钟)

1. 打开 [Adsterra 注册入口](https://beta.publishers.adsterra.com/referral/tF1usSmNwD) → 右上角 **Sign Up** → 身份选 **Publisher**
2. 去邮箱点验证链接,进后台
3. **Websites → Add Website**:填你的域名、选网站分类(游戏站选 Games 或 Entertainment)、勾选想要的广告格式
4. 等审核——官方口径 **5-10 分钟**(自动化审核),慢则几小时。**没有最低流量要求**;被拒基本只有三种原因:违法/成人内容、误导性内容、采集拼凑的垃圾内容——认真写攻略的站不会踩
5. 通过后,每种格式各拿到一段代码片段

> **透明披露**:上面的注册入口(以及第五节平台表里的 Adsterra 链接)是 AnvilWiki 的**推荐链接**:通过它注册,Adsterra 会按官方推荐计划把被推荐发布者收入的 5% 终身返佣给本项目——奖励由 Adsterra 侧支付,不影响你的收益和账号条件([官方说明](https://adsterra.com/blog/extra-income-with-adsterra-referral-program/))。介意的话直接访问 [adsterra.com](https://adsterra.com) 注册,流程完全一样。

### 广告格式怎么选

| 格式 | 是什么 | 单价量级 | 体验伤害 | 对本站的建议 |
| --- | --- | --- | --- | --- |
| **Banner** | 常规横幅(300×250 / 320×50 / 728×90 等标准尺寸) | CPM 约 $2-10,随地区浮动 | 低 | **首选**,和模板广告位同性质 |
| **Direct Link** | 一条纯 URL,点了跳广告页;放哪都行(文中、按钮、社媒) | CPM/CPA 混合计价 | 零(不放就不存在) | 灵活零成本,适合嵌在"相关工具/下载"类链接位 |
| **In-Page Push** | 页面内小卡片通知样式,不弹窗 | CPC/CPM/CPA | 中低 | 可选的补充格式 |
| **Social Bar** | Adsterra 独有,in-page push 加强版(插屏+横幅组合模板) | 高于普通 banner | 中 | 流量起来后再试,小站先别 |
| **Popunder** | 打开/关闭页面时在背后弹整页 | CPM 全格式最高(部分国家/品类极高) | **高** | **挂 AdSense 的站禁用**,见下方红线 |

新手公式:**一两个 Banner + 一个 Direct Link 起步**,收入曲线稳了再考虑加格式。Adsterra 官方博客推荐的"多 banner + Social Bar + Popunder"是追求极限收入的配置,以牺牲体验为代价——游戏攻略站靠 Google 排名吃饭,别学。

### ⚠️ 与 AdSense 共存的红线(必读)

Google 的[广告投放位置政策](https://support.google.com/adsense/answer/1346295?hl=zh-Hans)明确:**挂着 AdSense 的站,不允许触发 popunder(背后弹页)——哪怕弹出的页面里没有 Google 广告也算违规**。轻则停广告展示,重则封 AdSense 账号。所以:

- AdSense + Adsterra **可以共存**,前提是 Adsterra 侧只开 Banner / Direct Link / In-Page Push
- **Popunder 和 AdSense 二选一**:要么不挂 AdSense 专心跑 Popunder,要么永远别碰这个格式
- 共存时别把第三方广告做成和 AdSense 一模一样的样式(政策禁止混淆布局)
- 最后数一下**全页广告总数别超过 4-5 个**:密度过高既是 AdSense 政策风险,也伤排名

### 广告位怎么挂(后台原码直挂,不套 iframe,必读)

> **合规警告(2026-10 收到)**:Adsterra 通知原文要点——*"placing an ad code inside an iframe is not permitted … 若违反以下任一条,账号可能被无预警停用:iframe 缩小了广告可视面积或遮挡其他元素;iframe 延迟广告加载或妨碍交互;同一个 iframe 或同一页面放了不止一份广告码;iframe 改变了点击/曝光追踪;iframe 使用动态缩放/滚动/跳转影响广告展示。"*
>
> 旧版本(v2.26.0–v2.38.0)把每个单元装进**我们自己的** sandbox iframe(`<iframe src="/ads/xxx.html">`),正是这条禁令点名的写法。**本版本已全部去掉**。此前文档里「外层再套一层 iframe 是行业普遍做法 / Adsterra 允许」的结论**作废**——以平台的实际通知为准。

**现在的挂法**:每个广告位仍是一个文件 `public/ads/<name>.html`,里面就是 Adsterra 后台(Ad Units → GET CODE)拿到的原码,**一个字都不要改**;构建时 `AdsterraSlot` 把它的 `<body>` 内容**原样内联**进页面。Adsterra 脚本自己建的那个广告 frame 就是广告本体(不是我们加的包装层)。

```
public/ads/sidebar-300x250.html   ← 贴后台原码(含 atOptions 与 invoke.js 两段脚本)
PUBLIC_ADSTERRA_SLOT_SIDEBAR_300X250=<单元 key>   ← env 门控,留空=该位零渲染
<AdsterraSlot name="sidebar-300x250" width={300} height={250} />
```

- **不会串号(旧方案「必须 iframe 隔离」的前提是错的)**:各单元共用 `window.atOptions` 全局,但 `invoke.js` 一执行就**读走并删除**它;`<script>atOptions=…</script><script src=…/invoke.js>` 这种**解析器插入**的脚本严格按文档顺序同步执行,每对都在下一对赋值前消费完自己的配置。实测(真 Chromium,同页两个单元):两条广告请求各带自己的 `key=`,互不污染。**只有「异步/乱序加载」才会串号**——所以不要给这些脚本加 `async`/`defer`、不要用动态 `createElement('script')` 去挂 banner 单元。
- **硬规则 1:同一单元 key 每页只挂一次**。违反=「同一页面放了不止一份广告码」,而且 Native 格式的 `container-<key>` id 会重复。`AdsterraSlot` 在同一页第二次挂同名单元时直接丢弃并在构建日志告警。需要同类位置用**不同单元**(Adsterra 后台多建几个)。
- **硬规则 2:不要用 CSS 隐藏已挂载的单元**(`hidden md:block` 这种)——被隐藏的单元脚本照样执行、照样发广告请求,记一次**没人看见的曝光**(无效流量)。随视口取舍请用 `minViewport`:解析期按 `matchMedia` 决定「写不写这段代码」,窄屏上根本不请求(728/468 这类宽创意用它)。
- **硬规则 3:不要缩放/裁剪广告**。容器只预留最小高度(防 CLS),不加 `overflow:hidden`、不改 Adsterra 自建 frame 的尺寸。
- **没有同意门控**:本 fork 是静默统计/广告模式(无同意横幅)。上游版本曾经的「`data-src` 延迟装载」只服务于 iframe 方案,已随之移除;若将来恢复横幅并要给 Adsterra 做门控,须用别的机制,不要把 iframe 请回来。
- **`public/ads/*.html` 现在只是「原码来源文件」**:站内没有任何链接指向它们(`_headers` 已给 `/ads/*` 加 `X-Robots-Tag: noindex`),不要把它们当页面用。
- **加载性能**:Adsterra 脚本是解析阻塞的(标准代码如此)。所以浮动广告(`TopStickyAd`)挂在布局**末尾**(它 `position: fixed`,DOM 顺序不影响位置),避免第三方请求挡在正文之前。
- **Popunder / Social Bar 这类行为触发型格式**依旧要直贴 `BaseLayout.astro` 的 `<head>`(要捕捉主页面交互),现在和其它单元一样都不在 iframe 里了。

**浮动卡片(顶部 728×90 与底部 320×50)**

- 顶部 `TopStickyAd`:`position: fixed`、贴在 56px 吸顶导航下方,**不占文档流、不挤内容**(早期版本用 `sticky`,那是流内定位,会把正文往下推);仅 ≥768px 渲染(窄屏不写代码;手机顶部不放 native-banner——它在窄屏会变成约 525px 高的竖排,悬浮后会盖掉大半屏)。
- 底部 `MobileAnchorAd`(`PUBLIC_ADSTERRA_SLOT_STICKY_320X50`):全视口(桌面也显示),居中悬浮卡片,展开时给 `<body>` 加底部内边距并把回到顶部按钮上抬,避免盖住文末内容。
- 两张卡片都**不是铺满一整条**:宽度贴合广告本身,两侧透明且不拦点击。**没有关闭按钮**,只有图标按钮切换展开/收起(默认展开,同一浏览会话内记忆;新访问重新展开)。收起只是隐藏卡片主体——广告在展开期间已经加载。
- ⚠️ 残留风险(请自行评估):警告里「iframe … overlays other elements」的精神是不要用广告**遮盖页面其它元素/诱导误点**。浮动卡片会盖住页面顶部(导航下方约 140px)或底部的一小块内容——卡片可一键收起、不覆盖导航与阅读进度条,但它依然是**悬浮覆盖**。若 Adsterra 后续对此再有反馈,优先改回流内(不覆盖)的摆法。

**文章页挂位**(每个单元每页一次):

| 位置 | 单元 | 说明 |
|---|---|---|
| 页面顶部浮动 | `incontent-728x90`(728×90) | `TopStickyAd`,仅 ≥768px |
| 正文**第二个 H2 之前**(第一小节结束后) | `sidebar-300x250`(300×250) | `ArticleH2`(MDX `h2` 覆盖)按 `headings` 里第二个 H2 的 slug 注入;不足两个 H2 的短文不挂 |
| 文章尾部(相关文章之后) | `incontent-468x60`(468×60) | 仅 ≥500px;**单元需要你在 Adsterra 后台新建**(见下),env 留空时不渲染 |
| 页面底部浮动 | `sticky-320x50`(320×50) | `MobileAnchorAd`,全视口 |

文章页**不再挂 `native-banner`**(它只留在落地页/手册页/文档目录页,每页一个)。

> **新建 468×60 单元**:Adsterra 后台 → Websites → 你的站点 → Add Ad Unit → Banner → 468×60,拿到代码后整段贴进 `public/ads/incontent-468x60.html`(`<body>` 里),再把单元 key 填进 `wrangler.toml` 的 `PUBLIC_ADSTERRA_SLOT_INCONTENT_468X60` 并取消注释。env 与文件缺一不可:只填 env 不建文件,构建会告警并跳过该位。

**模板预挂位总清单**(均为 env 门控:对应 `PUBLIC_ADSTERRA_SLOT_*` 留空 = 该位零渲染;html 文件也要放进 `public/ads/`,env 有值而文件缺失 = 构建告警并跳过):

| 单元(`public/ads/*.html`) | 尺寸 | 挂载点 |
|---|---|---|
| `incontent-728x90` | 728×90(仅 ≥768px) | wiki 各页顶部浮动卡 `TopStickyAd`;手册课页、主落地页(en+zh)、对比页(en+zh)、社群精华(en+zh)——`AdsterraSlotPair` 前置位 |
| `native-banner` | 响应式 Native(700×240 基准) | 落地页/手册课页顶部(面包屑/H1 之前,**每页唯一一个**——所以这两类页的 Pair 不再带结尾 native);文档中心三目录页(en+zh);对比/社群/模板页的 Pair 后置位。宽度是载重参数:实测窄于 ~700px 时响应式脚本切成更高的竖排堆叠(560w→525h),「做小」只能靠这档紧凑横排,不能收窄 |
| `sticky-320x50` | 320×50 | 文章页底部浮动卡 `MobileAnchorAd` |
| `sidebar-300x250` | 300×250 | 文章正文第二个 H2 之前(`ArticleH2`) |
| `incontent-468x60` | 468×60(仅 ≥500px) | 文章尾部(**待建单元**) |
| `sidebar-160x300` | 160×300(仅 ≥1024px) | 手册课页**左栏**目录上方(右侧是目录 TOC,广告都放左边) |
| `sidebar-160x600` | 160×600(仅 ≥1700px) | 手册课页**左侧**页边固定(单个单元只能挂一次,所以不再有右侧那份) |

> fork 清理:这些 html 初始化时按**内容**判定清理——把内容换成你自己的广告代码后,重跑 apply-template 不会被误删;仍含模板 demo 单元 key 的原样文件才会被移除。

全站生效格式(Popunder / Social Bar 类)是另一条路:这类**行为触发型**格式必须直接粘进 `src/components/layout/BaseLayout.astro` 的 `<head>`(要捕捉主页面的用户交互才能触发)——但**挂 AdSense 的站禁用 Popunder**(见上节红线),Social Bar 流量起来前也别碰,所以正常路径用不到它。

模板自带的 3 个 AdSense 位**不需要任何改动**——它们由 AdSense 的 4 个环境变量控制,和 Adsterra 单元互不干扰。

### 怎么验证广告真的在展示

只信两样:**手机关 Wi-Fi 用 4G 流量实测** + **Adsterra 后台的 Impressions 数据**。先排掉两个常见误判:

- 开着代理/电脑环境,广告经常不加载——「后台有数据」不等于正常显示
- 用无头浏览器/自动化工具测试返回 403,那是 Adsterra 的**反自动化检测**,不是广告坏了,别拿它验证

第三种信号对照:GSC 有点击但 Impressions 很低 → 广告没正常加载(查代理/广告位代码/位置是不是太深滚不到);Impressions 高但收益平 → 先观察一两周再说,别天天换位。

---

## 四、Adsterra 收款:两条路线

Adsterra 满 **$100** 起付(USDT 路线;2026 年起**前两笔付款**所有方式放宽到 $20)。收款有两条常用路线,按你对加密货币的接受度选:

| 路线 | 门槛 | 到账形态 | 适合谁 |
| --- | --- | --- | --- |
| USDT(经 OKX) | 余额 ≥ $100 | 稳定币,交易所内换汇出金 | 有交易所账号、想快 |
| Payoneer(欧元账户 + wire transfer) | 余额 ≥ $100(需找客服调) | 直接到 Payoneer,再提现到银行卡 | 不想碰加密货币 |

> 还有更低的官方备选:Paxum $5、PayPal $25、本地货币 $25(数字以 [Adsterra 官方 payout 说明](https://adsterra.com/blog/adsterra-minimum-payout-for-publishers/)实时为准)。

### 路线一:USDT(OKX)

1. OKX App → **充值** → 选 **USDT** → 网络选 **TRC-20** → 复制充值地址(一串 `T` 开头的字符)
2. Adsterra 后台 → **Payouts** → 添加收款方式 → 选 **USDT (Tether, TRC-20)** → 粘贴地址 → 保存并设为默认
3. 余额 ≥ $100 后,在 Payouts 页发起提现申请,等审核打币(通常 1-2 个工作日)
4. USDT 到账 OKX 后,在交易所内卖出提现(换成人民币走 C2C/出金,按平台当时规则)

> ⚠️ 链上转账**不可逆**:Adsterra 提现网络和 OKX 充值地址网络必须是同一个(TRC-20 对 TRC-20),地址复制粘贴后逐位核对再提交。

### 路线二:Payoneer(欧元账户 + wire transfer)

Adsterra 的 wire transfer(电汇)默认最低支付额是 $1000(另收手续费),所以要找客服调到 $100。全程英文沟通,照抄话术即可:

1. 注册 [Payoneer](https://www.payoneer.com),开通**欧元(EUR)收款账户**,拿到它的银行账户信息(银行名、IBAN、SWIFT/BIC——在 Payoneer 后台「收款」→「全球付款服务」里)
2. Adsterra 后台 → **Payouts** → 收款方式选 **Wire transfer** → **全英文**填写 Payoneer 的 EUR 账户信息并保存
3. 找 Adsterra 客服(后台 ticket 或右下角 live chat)把最低支付额调到 $100,话术直接复制:

   ```text
   Hi, I've saved my wire transfer payout information with my Payoneer EUR receiving account. Could you please lower my minimum payout threshold to $100? Thank you!
   ```

4. 余额到 **$100** 后,再找客服**签一份 payout 协议**(客服会把协议发你,确认金额与账户信息),签完才能发起提现
5. 款项到 Payoneer 的 EUR 账户后,在 Payoneer 里提现到你的国内银行卡(按 Payoneer 当日汇率结汇)

### 怎么选

- 两边都注册也行(先跑通一条,另一条当备胎)——**不要**等余额攒到快 $100 才去开账户、调门槛,提前把步骤 1-3 做完。
- 提现费与汇率两家各有标准,以官方页面实时数字为准;大额收款前先用第一笔小额跑通全流程验证一遍。

---

## 五、广告平台全景:起步/进阶/成熟三档

接广告不是一次性决定。流量长起来后,该换"管理型"广告平台(它们替你对接几十家广告主实时竞价,RPM 通常高于 AdSense)。按站点阶段选档,平台名都挂了官网直链:

| 档位 | 平台 | 门槛(2026-08 快照) | 起付/结算 | 一句话定位 |
| --- | --- | --- | --- | --- |
| 起步·主力 | [Google AdSense](https://adsense.google.com) | 无流量门槛,内容审核制 | $100,月结 21 日 | 默认起点;完整教程见手册课 22「开广告」+ 本文第二节 |
| 起步·备胎 | [Adsterra](https://beta.publishers.adsterra.com/referral/tF1usSmNwD) | 零流量门槛,分钟级审核 | USDT $100(首两笔 $20) | AdSense 被拒/等待期的回血位;教程见本文第三节 |
| 起步·备胎 | [PropellerAds](https://propellerads.com) / [HilltopAds](https://hilltopads.com) | 无流量门槛 | 约 $20-100,按收款方式 | 和 Adsterra 同模式(注册→加站→粘脚本);popunder 类格式体验差,只做兜底 |
| 进阶 | [Journey by Mediavine](https://www.journeymv.com) | 1,000 sessions/月 + 连 GA4 + 原创 brand-safe 内容 | 平台分成(发布商约七成),月结 | 2026 年起门槛大降,1 千 session 就能上车的正规军 |
| 进阶 | [Monumetric(Propel 档)](https://www.monumetric.com) | 10,000 pageviews/月,需至少 6 个广告位 | 一次性 $99 安装费,NET-60 | 管理型;小站先算清 $99+两月账期能不能回本 |
| 进阶·游戏垂直 | [NitroPay](https://nitropay.com) | 100,000 pageviews/月(小站可人工批) | 发布商 80%,NET-7 | Overwolf 旗下,官方定位就是 niche gaming wikis;游戏站到量后的首选候选 |
| 成熟 | [Raptive](https://raptive.com)(原 AdThrive) | 25,000 pageviews/月(原 10 万,已大降) | 月结 | 娱乐流量 RPM 天花板,游戏站终局候选 |
| 成熟 | [Mediavine(主产品)](https://www.mediavine.com) | 年广告收入 $5,000+(2026 年取消了 5 万 sessions 门槛) | 月结 | 行业标杆,布局优化全程替你管;游戏站申请可能被转介到自家 PubNation |
| 成熟·游戏垂直 | [Venatus](https://www.venatus.com) | 约 150 万 pageviews/月 + 20% Tier-1 流量(第三方口径,以官网洽谈为准) | 月结 | 服务 Rovio/EA/OP.GG 的游戏娱乐垂直网络(OP.GG 就是游戏工具站,和 wiki 同画像) |
| 成熟·游戏垂直 | [Playwire](https://www.playwire.com) | 约 100 万 pageviews/月 + 英语国家流量为主 | 月结 | 游戏垂直老牌(前身 Intergi),游戏站案例 Raider.IO |
| 成熟·游戏垂直 | [PubNation](https://www.pubnation.com) | 百万级 sessions(排他申请制,无公开门槛) | 月结 | Mediavine 旗下游戏/体育/科技垂直线,企业级全托管 |

### 游戏垂直网络:你这类站的隐藏加分项

通用平台给游戏流量的定价天生偏低——受众以 18-40 男性为主,广告主出价不积极(一线站长社区有 60 万 PV 月入 $133 的极端案例,低 Tier-1 占比 + 弱竞价是主因)。而**游戏垂直网络直采游戏广告主**(游戏发行商的买量预算直接进来),同一份流量往往能卖出更高的价。游戏 wiki 站到量之后,垂直层通常比通用大厂更划算:

- **[NitroPay](https://nitropay.com)**:Overwolf 旗下,门槛 10 万 PV/月(没到也可以发邮件申请人工批),发布商分 80%、**NET-7 结算**(每月结束后 7 天内打款,全行业最快档),官方定位原话就是 "niche gaming wikis"。注意它近年有 RPM 下滑的社区报告(同流量对比 Mediavine 系,有站长收入腰斩)——**到量后先小流量并行测试一两个月,数据说话再整体切换**,别盲信"垂直 = 高价"。
- **[Venatus](https://www.venatus.com)**:游戏/体育/娱乐垂直,客户有 Rovio、EA、OP.GG。门槛约 150 万 PV/月 + 20% Tier-1 流量(US/UK/CA/AU/DE/FR),第三方对比口径,以官网洽谈为准。
- **[Playwire](https://www.playwire.com)**:游戏垂直老牌(前身 Intergi),游戏站案例 Raider.IO,Google 认证发布伙伴。门槛约 100 万 PV/月,要求英语国家流量为主。
- **[PubNation](https://www.pubnation.com)**:Mediavine 旗下专做游戏/体育/科技的排他制高端线——你申请 Mediavine 主产品时,如果是游戏站,可能被他们主动转介到这里(同集团里更懂游戏流量的团队),有体育站加入后 RPM 翻倍的公开案例。

同量级还有 [Snigel](https://www.snigel.com)(已并入 Publisher Collective,无公开硬门槛、质量评估制)和 [Freestar](https://www.freestar.com)(约 100 万 PV 门槛),了解即可。**AdInPlay 没进表**:它偏浏览器游戏门户(页游站)画像,wiki 攻略站不是它的最佳匹配。

### 游戏 wiki 站的分阶段路线

把上面的表按"你的站现在多少量"拉成一条直线:

| 你的站(每月) | 主力方案 | 备注 |
| --- | --- | --- |
| 0 - 1k sessions | [AdSense](https://adsense.google.com) + [Adsterra](https://beta.publishers.adsterra.com/referral/tF1usSmNwD) 备胎 | 唯一零门槛正规军 |
| 1k - 10k sessions | [Journey by Mediavine](https://www.journeymv.com) | 2026 年起的最低上车点,需连 GA4 |
| 10k - 100k PV | Journey 续跑 / [Raptive](https://raptive.com)(25k PV 起) / [Monumetric](https://www.monumetric.com) | Monumetric 的 $99 安装费 + NET-60 要先算账 |
| 100k - 100 万 PV | [NitroPay](https://nitropay.com)(游戏垂直) / Journey / Raptive | 到这档先并行测试 NitroPay 再决定切不切 |
| 100 万+ PV | [Venatus](https://www.venatus.com) / [Playwire](https://www.playwire.com) / [PubNation](https://www.pubnation.com) / [Mediavine 主产品](https://www.mediavine.com) | 游戏垂直天花板层 |

收入预期锚点:Mediavine 系游戏文章 RPM 约 $5-8,AdSense 约 $5——想突破这个量级,靠的是 **Tier-1 流量占比**和**管理型平台的竞价密度**,不是多挂几家平台。

### 进阶/成熟档怎么接(申请制,流程都一样)

进阶/成熟档(含四家游戏垂直网络)都是"管理型"平台:**不是你粘完脚本就完事,而是提交申请 → 人工审核(几天到两周) → 通过后按邮件指引接入**(多数也是给脚本你粘,或 GA4 授权),之后他们持续替你优化广告布局。要点:

1. **先装 GA4**:Journey 明确要求连接 GA4,其余各家审核也都看 GA 数据——装法见手册课 20「装好两个计数器」与课 24「接入 GA4」的教程
2. 申请表**如实填流量数据**(他们自己会核,虚报直接拒)
3. 通过后按邮件指引走,一般 1-2 周完成切换
4. **切换 = 换主力,不是叠加**——见下面铁律

### 三条铁律

1. **同一时期,主力广告平台只挂一家。** 多家横幅混挂 = 广告密度失控(AdSense 政策红线 + 排名双伤)+ 管理复杂 + 单价被稀释。要换平台是"下架旧的、再上新的",不是"往上叠"。(AdSense + Adsterra Direct Link 这类轻量共存不算,红线见第三节)
2. **数字会变,申请前核对官方页面。** 上表门槛/起付是 2026 年 8 月的快照,而且这一行正集体降门槛(Mediavine 从 5 万 sessions 改为收入门槛、Raptive 从 10 万降到 2.5 万、Journey 降到 1 千)——动手前以各家官方 requirements 页面实时数字为准。
3. **两家明确不推荐**:Ezoic(要求接管 DNS / 走它的代理集成,和 Cloudflare Pages 架构冲突,本模板用户别碰);Media.net(偏美英加 + 金融科技流量,游戏 wiki 不匹配)。

## 下一步

- [deployment.md](deployment.md) 上线后的数据复盘指标 + Clarity 热力图(看广告位有没有被点)
- [seo.md](seo.md) 外链策略——和本文同一个原则:排名没起来前,先把内容和体验做好
- 回到 [文档中心](README.md)
