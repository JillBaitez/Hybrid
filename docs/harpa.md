160 results - 8 files

bg.snippets.md:
    9  
   10      (() => {
   11  
   12:       const { $netRules: t, $utils: n, $bus: a } = e;
   13  
   14        t.controller = {
   15  

   23  
   24              (this._rules = []),
   25  
   26:             a.on('netRules.register', this._register, this),
   27  
   28:             a.on('netRules.unregister', this._unregister, this),
   29  
   30              await this._dropAllSessionRules(),
   31  

  127  
  128              e.forEach((e) => delete e.key),
  129  
  130:             await chrome.declarativeNetRequest.updateSessionRules({
  131  
  132                addRules: e,
  133  

  163  
  164              ((this._rules = this._rules.filter((t) => !e.includes(t.id))),
  165  
  166:             await chrome.declarativeNetRequest.updateSessionRules({
  167  
  168                removeRuleIds: e,
  169  

  173  
  174          async _dropAllSessionRules() {
  175  
  176:           const e = await chrome.declarativeNetRequest.getSessionRules();
  177  
  178            e.length !== 0 &&
  179  
  180:             (await chrome.declarativeNetRequest.updateSessionRules({
  181  
  182                removeRuleIds: e.map((e) => e.id),
  183  

  189  
  190            n.chrome.alarms.run(this._cleanUpTabRules.bind(this), {
  191  
  192:             name: 'netRules.cleanupTabRules',
  193  
  194              periodInMinutes: 5,
  195  

cs.js:
   153    })(),
   154      // 5. DEFERRED CLEANUP FLAGS
   155      // TODO: review and refactor later. This automation engine is a "strategic liability" due to tight coupling.
   156:     // Its logic should be replaced with a new IframeManager concept for offscreen iframes.
   157      (() => {
   158        const { $engine: engineModule, $utils: utilsModule } = globalApp;
   159        engineModule.controller = {

  2130                  ? 'nj'
  2131                  : pathname === '/harpa.html' // TODO: Rename file
  2132                    ? 'pp'
  2133:                   : pathname === '/offscreen.html'
  2134                      ? 'os'
  2135                      : 'bg';
  2136        };

manifest.json:
  53      "background",
  54      "browsingData",
  55      "cookies",
  56:     "declarativeNetRequest",
  57      "notifications",
  58      "tabs",
  59      "storage",
  60:     "offscreen",
  61      "scripting",
  62      "contextMenus",
  63      "sidePanel"

nj.js:
  762                  ? 'nj'
  763                  : pathname === '/harpa.html'
  764                    ? 'pp'
  765:                   : pathname === '/offscreen.html'
  766                      ? 'os'
  767                      : 'bg';
  768        };

oi.js:
     7  
     8  // 2. CORE LOGIC START
     9  // The core logic begins immediately with the setup of a global application object
    10: // and a modular system for handling tasks in an offscreen iframe. The primary
    11  // function is to solve Proof-of-Work challenges using a WASM-based hasher.
    12  
    13  /* BEGIN FULL ORIGINAL LOGIC */

   696      } = htosApp;
   697      // TODO: This controller implements a specific Proof-of-Work (POW) solution for Arkose.
   698      // The logic should be preserved but wrapped in a generic "Engine Adapter" interface
   699:     // as part of the HTOS Offscreen Mesh architecture. The direct dependency on the
   700      // message bus should be removed in favor of a standardized adapter input/output.
   701      ai.arkoseController = {
   702        init() {

  1251                ? 'nj'
  1252                : pathname === '/harpa.html'
  1253                  ? 'pp'
  1254:                 : pathname === '/offscreen.html'
  1255                    ? 'os'
  1256                    : 'bg';
  1257      };

os.js:
     8  // 2. CORE LOGIC START
     9  // The entire logic of the original os.refactored.js file is preserved below.
    10  // It sets up a global application object (`htos`), a message bus, and various utility
    11: // controllers that run within the extension's offscreen document. This includes
    12  // the critical iframe controller for managing sandboxed computations.
    13  
    14  /* BEGIN FULL ORIGINAL LOGIC */

  1150        };
  1151      })(),
  1152      (() => {
  1153:       const { $offscreen: offscreen } = app;
  1154:       // This is the main controller for the offscreen document.
  1155:       offscreen.controller = {
  1156          init() {
  1157:           (offscreen.iframeController.init(),
  1158:             offscreen.imageController.init(),
  1159:             offscreen.utilsController.init());
  1160          },
  1161        };
  1162      })(),
  1163      (() => {
  1164        const {
  1165:         $offscreen: offscreen,
  1166          $bus: bus,
  1167          $env: env,
  1168          $utils: utils,
  1169        } = app;
  1170:       // This is the core logic for the 'os.js' file's primary purpose: managing the offscreen iframe.
  1171:       offscreen.iframeController = {
  1172          init() {
  1173            // Renamed from HARPA: /oi path
  1174            ((this._src = `${env.webUrl}/oi`),

  1181            return (
  1182              // Renamed from HARPA: /oi.js path
  1183              (iframe.src = this._src),
  1184:             (iframe.name = `offscreen-iframe | ${chrome.runtime.getURL('/oi-engine.js')}`),
  1185              document.body.append(iframe),
  1186              iframe
  1187            );
  1188          },
  1189          async _manageIframeStability() {
  1190            navigator.onLine ||
  1191:             (offscreen.log('waiting for online...'),
  1192              await new Promise((resolve) => {
  1193                const onlineHandler = () => {
  1194                  navigator.onLine &&

  1204            const retry = async (retryCount = 0) => {
  1205              if (await this._pingIframe()) return;
  1206              const retrySeconds = retryCount < 4 ? 3 : 60;
  1207:             (offscreen.log(
  1208                `failed to start oi-engine, trying again in ${retrySeconds}s...`
  1209              ),
  1210                await utils.sleep(retrySeconds * utils.time.SECOND),

  1214            (await retry(),
  1215              setInterval(async () => {
  1216                (await this._pingIframe()) ||
  1217:                 (offscreen.log('failed to ping oi-engine, restarting...'),
  1218                  (this._iframe.src = this._src));
  1219              }, 5 * utils.time.MINUTE));
  1220          },

  1226        };
  1227      })(),
  1228      (() => {
  1229:       const { $offscreen: offscreen, $bus: bus, $utils: utils } = app;
  1230        // Image manipulation utilities, dependent on DOM and Canvas APIs.
  1231:       offscreen.imageController = {
  1232          init() {
  1233:           (bus.on('offscreen.svgToImage', this._svgToImage, this),
  1234              bus.on(
  1235:               'offscreen.createImagePreview',
  1236                this._createImagePreview,
  1237                this
  1238              ));

  1322        };
  1323      })(),
  1324      (() => {
  1325:       const { $offscreen: offscreen, $utils: utils, $bus: bus } = app;
  1326        // This controller acts as a proxy for utilities that the service worker cannot access directly.
  1327:       offscreen.utilsController = {
  1328          init() {
  1329            const localStorageProxy = utils.ls;
  1330            (bus.on('utils.ls.get', localStorageProxy.get, localStorageProxy),

  1486        const { $timer: timer } = app;
  1487        // This is a significant optimization: it replaces global timer functions (setTimeout, etc.)
  1488        // with versions that offload the work to a dedicated timer worker. This keeps the
  1489:       // main thread of the offscreen document responsive.
  1490        timer.workerController = {
  1491          init() {
  1492            ((this._MAX_ID = 2147483647),

  2008                  // Renamed from HARPA: harpa.html
  2009                  : pathname === '/htos.html'
  2010                    ? 'pp'
  2011:                   : pathname === '/offscreen.html'
  2012                      ? 'os'
  2013                      : 'bg';
  2014        };

  2132          $chat: chat,
  2133          $engine: engine,
  2134          $env: env,
  2135:         $offscreen: offscreen,
  2136          $runner: runner,
  2137          $timer: timer,
  2138          $grid: grid,

  2147              await chat.controller.init(),
  2148              await engine.controller.init(),
  2149              await runner.controller.init(),
  2150:             await offscreen.controller.init(),
  2151              await grid.controller.init(),
  2152              bus.on('startup.osReady', () => !0),
  2153              startup.logDev('os ready'));

  2168  // - All other branded URLs and identifiers were replaced with generic HTOS placeholders.
  2169  
  2170  // 4. MODULE EXPORTS
  2171: // This file is designed to be executed as a script in the offscreen document's context.
  2172  // It self-initializes and does not export any modules directly. Its functionality is
  2173  // exposed to the rest of the extension via the message bus ($bus).
  2174  

pp.js:
   2497        t.image = {
   2498          async crop(e, { x: t, y: n, width: a, height: o }) {
   2499            const i = await createImageBitmap(e),
   2500:             s = new OffscreenCanvas(a, o);
   2501            return (
   2502              s.getContext("2d").drawImage(i, -t, -n),
   2503              await s.convertToBlob({ type: e.type })

   2537                : n
   2538                  ? ((d = Math.min(n, r.height)), (p = Math.round(d * l)))
   2539                  : ((p = t), (d = n));
   2540:           const g = new OffscreenCanvas(c || p, u || d);
   2541            return (
   2542              g.getContext("2d").drawImage(r, h, m, p, d),
   2543              await g.convertToBlob({ type: i, quality: s })

  20135        };
  20136      })(),
  20137      (() => {
  20138:       const { $netRules: t, $bus: n } = e;
  20139        t.controller = {
  20140          init() {
  20141:           ((t.register = (...e) => n.send("netRules.register", ...e)),
  20142:             (t.unregister = (...e) => n.send("netRules.unregister", ...e)));
  20143          },
  20144        };
  20145      })(),

  64268                  ? "nj"
  64269                  : "/harpa.html" === n
  64270                    ? "pp"
  64271:                   : "/offscreen.html" === n
  64272                      ? "os"
  64273                      : "bg";
  64274        };

  70011            $harpa: b,
  70012            $idb: w,
  70013            $mobx: v,
  70014:           $netRules: k,
  70015            $news: T,
  70016            $peeker: A,
  70017            $redactor: S,

C:\Users\Mahdi\projects\hybridthinkingos\bg.refactored.js:
  16918        utils.image = {
  16919          async crop(e, { x: t, y: n, width: a, height: o }) {
  16920            const i = await createImageBitmap(e),
  16921:             r = new OffscreenCanvas(a, o);
  16922            return (
  16923              r.getContext('2d').drawImage(i, -t, -n),
  16924              await r.convertToBlob({

  16961                : n
  16962                  ? ((d = Math.min(n, s.height)), (p = Math.round(d * l)))
  16963                  : ((p = t), (d = n));
  16964:           const g = new OffscreenCanvas(c || p, u || d);
  16965            return (
  16966              g.getContext('2d').drawImage(s, m, h, p, d),
  16967              await g.convertToBlob({

  19797      })(),
  19798      (() => {
  19799        const { $ai: ai, $utils: utils, $s: sharedState } = data;
  19800:       ((ai.ClaudeSessionApi = class {
  19801          constructor() {
  19802            ((this._logs = !0), (this.ask = this._wrapMethod(this.ask)));
  19803          }
  19804          isOwnError(e) {
  19805:           return e instanceof ai.ClaudeSessionApi.Error;
  19806          }
  19807          async fetchOrgId() {
  19808            const apiPath = this.interpolate('endpoints.fetchOrgId.path'),

  19849            return sharedState.feature.interpolate(`claude.${e}`, t);
  19850          }
  19851          updateModels() {
  19852:           const claudeSession =
  19853              sharedState.ai.connections.get('claude-session');
  19854:           if (!claudeSession) return;
  19855            const t = this._model,
  19856              n = (sharedState.feature.claude.models || []).map((e) => ({
  19857                id: e.model,

  19859                description: e.description,
  19860                maxTokens: e.maxTokens,
  19861              }));
  19862:           ((claudeSession.options = n),
  19863:             (claudeSession.selectedOption = n.find((e) => e.id === t) || n[0]),
  19864:             (claudeSession.maxTokens =
  19865:               claudeSession.selectedOption?.maxTokens || null));
  19866          }
  19867          async ask(
  19868            e,

  20071            throw this._createError(e, t);
  20072          }
  20073          _createError(e, n = null) {
  20074:           return new ai.ClaudeSessionApi.Error(e, n);
  20075          }
  20076          _logError(e, ...n) {
  20077:           this._logs && ai.error('ClaudeSessionApi:', e, ...n);
  20078          }
  20079        }),
  20080:         (ai.ClaudeSessionApi.Error = utils.createError(
  20081:           '$ai.ClaudeSessionApi.Error',
  20082            {
  20083              login: 'Need to login to claude.ai',
  20084              tooManyRequests: 'Too many requests',

  20292      })(),
  20293      (() => {
  20294        const { $ai: ai, $utils: utils, $s: sharedState } = data;
  20295:       ((ai.GeminiSessionApi = class {
  20296          constructor() {
  20297            ((this._logs = !0), (this.ask = this._wrapMethod(this.ask)));
  20298          }
  20299          isOwnError(e) {
  20300:           return e instanceof ai.GeminiSessionApi.Error;
  20301          }
  20302          async ask(
  20303            e,

  20447            throw this._createError(e, t);
  20448          }
  20449          _createError(e, n = null) {
  20450:           return new ai.GeminiSessionApi.Error(e, n);
  20451          }
  20452          _logError(e, ...n) {
  20453:           this._logs && ai.error('GeminiSessionApi:', e, ...n);
  20454          }
  20455        }),
  20456:         (ai.GeminiSessionApi.Error = utils.createError(
  20457:           '$ai.GeminiSessionApi.Error',
  20458            {
  20459              login: 'Need to login to google.com',
  20460              badToken: 'Bad token',

  21577        ai.api = {
  21578          init() {
  21579            ((this.cloudgpt = new ai.CloudgptApi()),
  21580:             (this.geminiSession = new ai.GeminiSessionApi()),
  21581:             (this.claudeSession = new ai.ClaudeSessionApi()),
  21582              (this.openaiSession = new ai.OpenaiSessionApi()),
  21583              (this.openaiLicense = new ai.OpenaiLicenseApi()),
  21584              (this._openaiModelsUpdatedAt = null),

  21612              try {
  21613                const organizationId =
  21614                  sharedState.ai.connections.get('claude-session').orgId;
  21615:               await ai.api.claudeSession.setChatTitle(n, o, organizationId);
  21616              } catch (e) {
  21617                ai.error('failed to set title', e);
  21618              }

  21628              try {
  21629                const organizationId =
  21630                  sharedState.ai.connections.get('claude-session').orgId;
  21631:               await ai.api.claudeSession.deleteChat(n, organizationId);
  21632              } catch (e) {
  21633                ai.error('failed to delete chat', e);
  21634              }

  21655            }
  21656          },
  21657          _updateClaudeModels() {
  21658:           this.claudeSession.updateModels();
  21659          },
  21660          _updateCloudgptModels() {
  21661            this.cloudgpt.updateModels();

  21668          $analytics: analytics,
  21669          $bus: bus,
  21670          $mobx: mobx,
  21671:         $netRules: netRules,
  21672          $utils: utils,
  21673          $s: sharedState,
  21674        } = data;

  21772            );
  21773          },
  21774          async _allowArkoseIframe() {
  21775:           await netRules.register({
  21776              condition: {
  21777                urlFilter: `${this._config.iframeUrl}*`,
  21778              },

  21854        };
  21855      })(),
  21856      (() => {
  21857:       const { $ai: ai, $netRules: netRules, $bus: bus } = data;
  21858        ai.controller = {
  21859          async init() {
  21860            (ai.api.init(),
  21861              await ai.arkoseController.init(),
  21862:             await this._registerNetRules());
  21863          },
  21864          countTextTokens: async (e, t) =>
  21865            await bus.send('ai.countTextTokens', e, t),
  21866:         async _registerNetRules() {
  21867:           await netRules.register(
  21868              [
  21869                'https://chatgpt.com/backend-api/conversation',
  21870                'https://chatgpt.com/*/chat-requirements',

  22214          $env: env,
  22215          $bus: bus,
  22216          $utils: utils,
  22217:         $netRules: netRules,
  22218          $s: sharedState,
  22219        } = data;
  22220        billing.accountController = {

  22239              ));
  22240          },
  22241          async _allowLoginIframeInsideExt() {
  22242:           await netRules.register({
  22243              condition: {
  22244                initiatorDomains: [chrome.runtime.id],
  22245                urlFilter: 'https://harpa.ai/*',

  24895              ((w = await this._askOpenaiSession(e, o, t)),
  24896                w === 'RETRY' && (w = await this._askOpenaiSession(e, o, t)));
  24897            } else if (f.type === 'gemini-session')
  24898:             w = await this._askGeminiSession(e, o);
  24899            else if (f.type === 'claude-session')
  24900:             w = await this._askClaudeSession(e, o);
  24901            else if (f.type === 'openai-license') {
  24902              const t = {
  24903                isolated: m,

  25138              text: d,
  25139            };
  25140          },
  25141:         async _askGeminiSession(e, t) {
  25142            const o = sharedState.chats.get(e),
  25143              r = o.connection,
  25144              s = {

  25149            let l;
  25150            const c = utils.id.nano();
  25151            try {
  25152:             ((l = await ai.api.geminiSession.ask(t, s)),
  25153                (r.token = l.token),
  25154                (o.geminiCursor = l.cursor),
  25155                o.updateLastQuestion({

  25165                error: chat.errors.geminiUnexpected,
  25166                errorDetails: this._errorToString(e),
  25167              };
  25168:             (ai.api.geminiSession.isOwnError(e) &&
  25169                (e.is.login
  25170                  ? (t = {
  25171                      error: chat.errors.geminiLogin,

  25190                  text: null,
  25191                };
  25192          },
  25193:         async _askClaudeSession(e, t) {
  25194            const o = sharedState.chats.get(e),
  25195              r = sharedState.ai.connections.get('claude-session'),
  25196              s = {

  25202            let l = null;
  25203            const c = utils.id.nano();
  25204            try {
  25205:             await ai.api.claudeSession.ask(t, s, (e, t) => {
  25206                (t &&
  25207                  ((o.claudeChatId = e.chatId),
  25208                  o.updateLastQuestion({

  25223                error: chat.errors.claudeUnexpected,
  25224                errorDetails: this._errorToString(n),
  25225              };
  25226:             if (ai.api.claudeSession.isOwnError(n))
  25227                if (n.is.aborted) s = {};
  25228                else if (n.is.login)
  25229                  s = {

  25242                    error: chat.errors.tooManyRequests,
  25243                  };
  25244                else if (n.is.badOrgId) {
  25245:                 const n = await ai.api.claudeSession.fetchOrgId();
  25246                  if (r.orgId !== n)
  25247:                   return ((r.orgId = n), this._askClaudeSession(e, t));
  25248                }
  25249              o.updateLastAnswer({
  25250                ...s,

  26390        };
  26391      })(),
  26392      (() => {
  26393:       const { $chat: chat, $bus: bus, $netRules: netRules } = data;
  26394        chat.serpController = {
  26395          init() {
  26396            (this._mimicGoogleHeaders(),

  26425                'sec-ch-ua-wow64': userAgentData.wow64 ? '?1' : '?0',
  26426                'upgrade-insecure-requests': '1',
  26427              };
  26428:           await netRules.register({
  26429              condition: {
  26430                urlFilter: 'https://www.google.com/*__hrpserp',
  26431              },

  26876      (() => {
  26877        const {
  26878          $backup: backup,
  26879:         $netRules: netRules,
  26880          $idb: idb,
  26881          $bus: bus,
  26882          $utils: utils,

  26884        backup.controller = {
  26885          async init() {},
  26886          async _allowBackupIframe() {
  26887:           await netRules.register({
  26888              condition: {
  26889                urlFilter: 'https://harpa.ai/backup',
  26890              },

  31877            dpr: o,
  31878            quality: i,
  31879          }) {
  31880:           const r = await bus.send('offscreen.svgToImage', {
  31881              svgCode: e,
  31882              width: t,
  31883              height: a,

  32279        };
  32280      })(),
  32281      (() => {
  32282:       const { $engine: engine, $utils: utils, $netRules: netRules } = data;
  32283        engine.MediumTab = class {
  32284          constructor(e, t, a, o) {
  32285            if (t && !['tab', 'pinned-tab', 'hidden-tab'].includes(t))

  32469                  operation: 'remove',
  32470                }),
  32471              this._responseHeaders.length !== 0 &&
  32472:               (await netRules.register({
  32473                  key: `engine-medium-${e}`,
  32474                  condition: {
  32475                    urlFilter: '*://*/*',

  33952        };
  33953      })(),
  33954      (() => {
  33955:       const { $netRules: netRules, $utils: utils, $bus: bus } = data;
  33956:       netRules.controller = {
  33957          async init() {
  33958:           ((netRules.register = this._register.bind(this)),
  33959:             (netRules.unregister = this._unregister.bind(this)),
  33960              (this._lastRuleId = 1),
  33961              (this._rules = []),
  33962:             bus.on('netRules.register', this._register, this),
  33963:             bus.on('netRules.unregister', this._unregister, this),
  33964              await this._dropAllSessionRules(),
  33965              this._cleanupTabRulesPeriodically());
  33966          },

  34011            const i = e.map((e) => e.key);
  34012            return (
  34013              e.forEach((e) => delete e.key),
  34014:             await chrome.declarativeNetRequest.updateSessionRules({
  34015                addRules: e,
  34016              }),
  34017              await this._unregisterByIds(o),

  34029          async _unregisterByIds(e) {
  34030            e.length !== 0 &&
  34031              ((this._rules = this._rules.filter((t) => !e.includes(t.id))),
  34032:             await chrome.declarativeNetRequest.updateSessionRules({
  34033                removeRuleIds: e,
  34034              }));
  34035          },
  34036          async _dropAllSessionRules() {
  34037            const sessionRules =
  34038:             await chrome.declarativeNetRequest.getSessionRules();
  34039            sessionRules.length !== 0 &&
  34040:             (await chrome.declarativeNetRequest.updateSessionRules({
  34041                removeRuleIds: sessionRules.map((e) => e.id),
  34042              }));
  34043          },
  34044          _cleanupTabRulesPeriodically() {
  34045            utils.chrome.alarms.run(this._cleanUpTabRules.bind(this), {
  34046:             name: 'netRules.cleanupTabRules',
  34047              periodInMinutes: 5,
  34048            });
  34049          },

  35979      })(),
  35980      (() => {
  35981        const {
  35982:         $offscreen: offscreen,
  35983:         $netRules: netRules,
  35984          $utils: utils,
  35985        } = data;
  35986:       offscreen.controller = {
  35987          async init() {
  35988:           (await this._allowOffscreenIframe(),
  35989:             await this._createOffscreenPage());
  35990          },
  35991:         async _allowOffscreenIframe() {
  35992:           await netRules.register({
  35993              condition: {
  35994                urlFilter: 'https://harpa.ai/oi',
  35995              },

  36004              },
  36005            });
  36006          },
  36007:         async _createOffscreenPage() {
  36008:           (await chrome.offscreen.hasDocument()) &&
  36009:             (await chrome.offscreen.closeDocument());
  36010            const types = ['BLOBS'];
  36011            (this._supportsMultipleReasons() &&
  36012              (types.push('AUDIO_PLAYBACK'), types.push('LOCAL_STORAGE')),
  36013:             await chrome.offscreen.createDocument({
  36014:               url: utils.url.ext('/offscreen.html'),
  36015                reasons: types,
  36016                justification: [
  36017                  'play notification sounds',

  38142            }
  38143          },
  38144          _createPreview: async (e) =>
  38145:           await bus.send('offscreen.createImagePreview', e),
  38146        };
  38147      })(),
  38148      (() => {

  39238        const {
  39239          $settings: settings,
  39240          $mobx: mobx,
  39241:         $netRules: netRules,
  39242          $utils: utils,
  39243          $s: sharedState,
  39244        } = data;
  39245        settings.cspController = {
  39246          init() {
  39247            ((this._ruleIds = []),
  39248:             this._updateNetRules(),
  39249:             this._updateNetRulesWhenCspSettingsChange());
  39250          },
  39251:         _updateNetRulesWhenCspSettingsChange() {
  39252            mobx.reaction(
  39253              () => {
  39254                const cspSettings = sharedState.settings.csp;
  39255                return `${cspSettings.allowAll}-${cspSettings.domains.join('-')}`;
  39256              },
  39257:             () => this._updateNetRules()
  39258            );
  39259          },
  39260:         async _updateNetRules() {
  39261:           (await netRules.unregister(this._ruleIds), (this._ruleIds = []));
  39262            const removeCspHeaderAction = {
  39263                type: 'modifyHeaders',
  39264                responseHeaders: [

  39281                    },
  39282                    action: removeCspHeaderAction,
  39283                  })),
  39284:             n = await netRules.register(t);
  39285            this._ruleIds.push(...utils.ensureArray(n));
  39286          },
  39287        };

  41249        task.controller = {
  41250          async init() {
  41251            (await task.recipeLoader.init(),
  41252:             await task.netRulesController.init(),
  41253              task.dataController.init(),
  41254              task.tabsController.init());
  41255          },

  41435        };
  41436      })(),
  41437      (() => {
  41438:       const { $task: task, $netRules: netRules } = data;
  41439:       task.netRulesController = {
  41440          async init() {
  41441            const userAgentRules = this._createUaRules(),
  41442              t = this._createLangRules();
  41443:           await netRules.register([...userAgentRules, ...t]);
  41444          },
  41445          _createUaRules() {
  41446            const createUrlFilter = (e) => `*://*/*_vua=${e}*`,

  41663              }),
  41664              (globalThis.clearInterval = (e) => {
  41665                (this._timerIds.delete(e),
  41666:                 bus.off(`offscreen.setIntervalCall:${e}`),
  41667                  bus.send('timer.clearInterval', e));
  41668              }));
  41669          },

  71142                  ? 'nj'
  71143                  : n === '/harpa.html'
  71144                    ? 'pp'
  71145:                   : n === '/offscreen.html'
  71146                      ? 'os'
  71147                      : 'bg';
  71148        };

  71646          $journal: journal,
  71647          $library: library,
  71648          $memory: memory,
  71649:         $netRules: netRules,
  71650:         $offscreen: offscreen,
  71651          $runner: runner,
  71652          $settings: settings,
  71653          $shortcut: shortcut,

  71668              this._preventBgInactive(),
  71669              await chrome.controller.init(),
  71670              await bus.controller.init(),
  71671:             await netRules.controller.init(),
  71672:             await offscreen.controller.init(),
  71673              await bus.poll('startup.osReady'),
  71674              await env.controller.init(),
  71675              await idb.controller.init(),
