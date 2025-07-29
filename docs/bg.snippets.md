bg.js 
(() => {

      const { $memory: t } = e;

      t.controller = { init() {} };

    })(),

    (() => {

      const { $netRules: t, $utils: n, $bus: a } = e;

      t.controller = {

        async init() {

          ((t.register = this._register.bind(this)),

            (t.unregister = this._unregister.bind(this)),

            (this._lastRuleId = 1),

            (this._rules = []),

            a.on('netRules.register', this._register, this),

            a.on('netRules.unregister', this._unregister, this),

            await this._dropAllSessionRules(),

            this._cleanupTabRulesPeriodically());

        },

        async _register(e) {

          const t = Array.isArray(e);

          e = (e = n.ensureArray(e).map((e) => {

            const t = this._lastRuleId;

            return (

              (this._lastRuleId += 1),

              {

                id: t,

                priority: 1,

                ...e,

                key: e.key || String(t),

                condition: {

                  resourceTypes: [

                    'main_frame',

                    'sub_frame',

                    'stylesheet',

                    'script',

                    'image',

                    'font',

                    'object',

                    'xmlhttprequest',

                    'ping',

                    'csp_report',

                    'media',

                    'websocket',

                    'webtransport',

                    'webbundle',

                    'other',

                  ],

                  ...e.condition,

                },

              }

            );

          })).filter((t, n) => n === e.findLastIndex((e) => e.key === t.key));

          const a =

              this._rules.length > 0 ? new Set(e.map((e) => e.key)) : null,

            o = this._rules.filter((e) => a.has(e.key)).map((e) => e.id);

          this._rules.push(

            ...e.map((e) => ({

              id: e.id,

              key: e.key,

              tabIds: e.condition.tabIds || null,

            }))

          );

          const i = e.map((e) => e.key);

          return (

            e.forEach((e) => delete e.key),

            await chrome.declarativeNetRequest.updateSessionRules({

              addRules: e,

            }),

            await this._unregisterByIds(o),

            t ? i : i[0]

          );

        },

        async _unregister(e) {

          const t = n.ensureArray(e);

          if (t.length === 0) return;

          const a = this._rules

            .filter((e) => t.includes(e.key))

            .map((e) => e.id);

          await this._unregisterByIds(a);

        },

        async _unregisterByIds(e) {

          e.length !== 0 &&

            ((this._rules = this._rules.filter((t) => !e.includes(t.id))),

            await chrome.declarativeNetRequest.updateSessionRules({

              removeRuleIds: e,

            }));

        },

        async _dropAllSessionRules() {

          const e = await chrome.declarativeNetRequest.getSessionRules();

          e.length !== 0 &&

            (await chrome.declarativeNetRequest.updateSessionRules({

              removeRuleIds: e.map((e) => e.id),

            }));

        },

        _cleanupTabRulesPeriodically() {

          n.chrome.alarms.run(this._cleanUpTabRules.bind(this), {

            name: 'netRules.cleanupTabRules',

            periodInMinutes: 5,

          });

        },

        async _cleanUpTabRules() {

          const e = [];

          e: for (const t of this._rules) {

            if (!t.tabIds) continue;

            let n = !1;

            for (const e of t.tabIds) {

              if (!e) continue;

              if (-1 === e) continue e;

              (await chrome.tabs.get(e)) && (n = !0);

            }

            n || e.push(t.id);

          }

          await this._unregisterByIds(e);

        },

      };

    })(),
   bus
       (() => {

      const { $bus: bus, $env: env, $utils: utils } = data;

      bus.controller = {

        async init() {

          ((bus.on = this.on.bind(this)),

            (bus.off = this.off.bind(this)),

            (bus.once = this.once.bind(this)),

            (bus.send = this._wrapThrowIfError(this.send)),

            (bus.call = this._wrapThrowIfError(this.call)),

            (bus.poll = this.poll.bind(this)),

            (bus.getTabId = this.getTabId.bind(this)),

            (this._locus = env.getLocus()),

            (this._serialize = this._serialize.bind(this)),

            (this._handlers = {}),

            this._is('pp')

              ? (this._setupPp(), (this._tabId = await bus.getTabId()))

              : this._is('bg')

                ? ((this._blobs = {}),

                  (this._channel = new BroadcastChannel('bus.channel')),

                  this._setupBg())

                : this._is('cs')

                  ? await this._setupCs()

                  : this._is('nj')

                    ? this._setupNj()

                    : this._is('os')

                      ? ((bus.setIframe = (e) => (this._iframe = e)),

                        (this._iframe = null),

                        (this._channel = new BroadcastChannel('bus.channel')),

                        this._setupOs())

                      : this._is('oi') && this._setupOi());

        },

        on(e, t, n = null) {

          this._on(e, null, t, n);

        },

        off(e, t = null) {

          this._off(e, null, t);

        },

        once(e, t) {

          const n = async (...a) => (this.off(e, n), await t(...a));

          this.on(e, n);

        },

        async send(e, ...n) {

          if (utils.is.numeric(e)) {

            const t = Number(e);

            return (

              (e = n[0]),

              (n = n.slice(1)),

              await this._pick([

                this._sendToCs(t, e, ...n),

                this._sendToExt(t, e, ...n),

              ])

            );

          }

          if (this._is('pp')) return await this._sendToExt(e, ...n);

          if (this._is('nj')) return await this._sendToPage(e, ...n);

          if (this._is('oi')) return await this._sendToParent(e, ...n);

          if (this._is('bg', 'cs', 'os'))

            return await this._pick([

              this._sendToExt(e, ...n),

              this._callHandlers(

                {

                  name: e,

                  args: n,

                },

                (e) => e.proxy

              ),

            ]);

          if (this._is('fg')) {

            if (e === 'store.actions') return;

            if (e === 'idb.change') return;

            bus.log(e, ...n);

          }

        },

        async call(e, ...t) {

          return this._callHandlers(

            {

              name: e,

              args: t,

            },

            (e) => !e.proxy

          );

        },

        async poll(e, ...t) {

          return await utils.waitFor(() => this.send(e, ...t));

        },

        async getTabId() {

          if (this._is('bg')) return null;

          if (this._is('pp')) {

            const tabId = new URL(location.href).searchParams.get('tabId');

            if (tabId) return Number(tabId);

          }

          const { tabId: e } = await this.send('bus.getTabData');

          return e;

        },

        _on(e, t, n, a = null) {

          (this._handlers[e] || (this._handlers[e] = []),

            this._is('cs', 'nj', 'oi') &&

              this._handlers[e].length === 0 &&

              this._sendToProxier('bus.proxy', e, !0));

          const o = {

            fn: n,

            name: e,

          };

          (t && (o.proxy = t), a && (o.this = a), this._handlers[e].push(o));

        },

        _off(e, t = null, n = null) {

          this._handlers[e] &&

            ((this._handlers[e] = this._handlers[e].filter((e) => {

              const a = !n || n === e.fn,

                o = t === (e.proxy || null);

              return !a || !o;

            })),

            this._handlers[e].length === 0 &&

              (delete this._handlers[e],

              this._is('cs', 'nj', 'oi') &&

                this._sendToProxier('bus.proxy', e, !1)));

        },

        _setupPp() {},

        _setupBg() {

          (chrome.runtime.onMessage.addListener((e, t, n) => {

            if (!this._isBusMsg(e)) return;

            const a = t.tab?.id || null;

            if (e.name === 'bus.proxy')

              return void (async () => {

                const [t, n] = await this._deserialize(e.argsStr);

                if (!a) return;

                const o = `cs-${a}`;

                n

                  ? this._on(t, o, (...e) => this._sendToCs(a, t, ...e))

                  : this._off(t, o);

              })();

            if (e.name === 'bus.removeCsProxies')

              return void this._removeProxyHandlers(`cs-${a}`);

            if (e.name === 'bus.getTabData') {

              const windowId = t.tab?.windowId || null;

              return (

                n(

                  this._serialize({

                    tabId: a,

                    windowId: windowId,

                  })

                ),

                !0

              );

            }

            if (e.name === 'bus.sendToCs')

              return (

                (async () => {

                  const t = await this._deserialize(e.argsStr),

                    a = await this._sendToCs(...t);

                  n(this._serialize(a));

                })(),

                !0

              );

            if (e.name === 'bus.blobIdToObjectUrl')

              return (

                (async () => {

                  const [t] = await this._deserialize(e.argsStr),

                    a = await this._blobIdToObjectUrl(t);

                  n(this._serialize(a));

                })(),

                !0

              );

            const o = this._callHandlers(e, (e) => e.proxy !== `cs-${a}`);

            return o ? (o.then(this._serialize).then(n), !0) : undefined;

          }),

            chrome.tabs.onRemoved.addListener((e) => {

              this._removeProxyHandlers(`cs-${e}`);

            }));

        },

        async _setupCs() {},

        _setupNj() {},

        _setupOs() {},

        _setupOi() {},

        async _sendToExt(e, ...n) {

          let o = null;

          utils.is.numeric(e) &&

            ((o = Number(e)), (e = n[0]), (n = n.slice(1)));

          const i = this._serialize(n),

            r = this._createBusMsg({

              name: e,

              argsStr: i,

              target: o,

            }),

            s = await new Promise((e) => {

              try {

                chrome.runtime.sendMessage(r, (t) => {

                  chrome.runtime.lastError ? e(null) : e(t);

                });

              } catch (n) {

                if (n.message === 'Extension context invalidated.') return;

                (bus.error(n), e(null));

              }

            });

          return await this._deserialize(s);

        },

        async _sendToCs(e, t, ...n) {

          if (!chrome.tabs?.sendMessage)

            return await this.send('bus.sendToCs', e, t, ...n);

          const a = this._serialize(n),

            o = this._createBusMsg({

              name: t,

              argsStr: a,

              target: 'cs',

            }),

            i = await new Promise((t) => {

              chrome.tabs.sendMessage(e, o, (e) => {

                chrome.runtime.lastError ? t(null) : t(e);

              });

            });

          return await this._deserialize(i);

        },

        async _sendToPage(e, ...t) {

          const n = this._generateId(),

            a = this._createBusMsg({

              name: e,

              args: t,

              reqId: n,

              locus: this._locus,

            });

          return (

            window.postMessage(a, '*'),

            await this._waitForResponseMessage(n)

          );

        },

        async _sendToIframe(e, ...t) {

          if (!this._iframe) return null;

          const n = this._generateId(),

            a = this._createBusMsg({

              name: e,

              args: t,

              reqId: n,

            });

          return (

            this._iframe.contentWindow.postMessage(a, '*'),

            await this._waitForResponseMessage(n)

          );

        },

        async _sendToParent(e, ...t) {

          const n = this._generateId(),

            a = this._createBusMsg({

              name: e,

              args: t,

              reqId: n,

            });

          return (

            parent.postMessage(a, '*'),

            await this._waitForResponseMessage(n)

          );

        },

        async _sendToProxier(e, ...t) {

          return this._is('cs')

            ? await this._sendToExt(e, ...t)

            : this._is('nj')

              ? await this._sendToPage(e, ...t)

              : this._is('oi')

                ? await this._sendToParent(e, ...t)

                : undefined;

        },

        _waitForResponseMessage: async (e) =>

          await new Promise((t) => {

            const n = ({ data: a }) => {

              !(!a || a.resId !== e) &&

                (window.removeEventListener('message', n), t(a.result));

            };

            window.addEventListener('message', n);

          }),

        _callHandlers({ name: e, args: n, argsStr: a }, o = null) {

          let i = this._handlers[e];

          return i

            ? (o && (i = i.filter(o)),

              i.length === 0

                ? null

                : new Promise(async (e) => {

                    a && (n = await this._deserialize(a));

                    e(

                      await this._pick(

                        i.map(async (e) => {

                          try {

                            return await e.fn.call(e.this, ...n);

                          } catch (n) {

                            return (

                              bus.error(`failed to handle "${e.name}".`, n),

                              n

                            );

                          }

                        })

                      )

                    );

                  }))

            : null;

        },

        _removeProxyHandlers(e) {

          Object.keys(this._handlers).forEach((t) => {

            ((this._handlers[t] = this._handlers[t].filter(

              (t) => t.proxy !== e

            )),

              this._handlers[t].length === 0 && delete this._handlers[t]);

          });

        },

        _serialize(e) {

          return utils.is.nil(e)

            ? null

            : JSON.stringify(e, (e, t) => {

                if (utils.is.blob(t)) {

                  if (this._is('bg')) {

                    const newId = this._generateId();

                    return ((this._blobs[newId] = t), `bus.blob.${newId}`);

                  }

                  return `bus.blob.${utils.objectUrl.create(t, !0)}`;

                }

                return utils.is.error(t) ? `bus.error.${t.message}` : t;

              });

        },

        async _deserialize(e) {

          if (!utils.is.string(e)) return null;

          const t = new Map(),

            n = JSON.parse(e, (e, n) => {

              const o = utils.is.string(n);

              return o && n.startsWith('bus.blob.')

                ? (t.set(n, n.slice(9)), n)

                : o && n.startsWith('bus.error.')

                  ? new Error(n.slice(10))

                  : n;

            });

          return (

            await Promise.all(

              [...t.keys()].map(async (e) => {

                let n;

                const a = t.get(e);

                n = a.startsWith('blob:')

                  ? a

                  : await this._sendToExt('bus.blobIdToObjectUrl', a);

                const o = await fetch(n).then((e) => e.blob());

                t.set(e, o);

              })

            ),

            this._applyBlobs(n, t)

          );

        },

        _applyBlobs(e, t) {

          if (t.has(e)) return t.get(e);

          if (utils.is.array(e) || utils.is.object(e))

            for (const n in e) e[n] = this._applyBlobs(e[n], t);

          return e;

        },

        async _blobIdToObjectUrl(e) {

          const t = this._blobs[e];

          let n;

          return (

            utils.is.string(t)

              ? (n = t)

              : ((n = await this._blobToObjectUrl(t)), (this._blobs[e] = n)),

            setTimeout(() => delete this._blobs[e], 60000),

            n

          );

        },

        async _blobToObjectUrl(e) {

          const t = this._generateId();

          return (

            this._channel.postMessage({

              reqId: t,

              blob: e,

            }),

            await new Promise((e) => {

              const n = ({ data: a }) => {

                !(!a || a.resId !== t) &&

                  (this._channel.removeEventListener('message', n),

                  e(a.objectUrl));

              };

              this._channel.addEventListener('message', n);

            })

          );

        },

        _is(...e) {

          return e.includes(this._locus);

        },

        _isBusMsg: (t) => t && t.$bus && t.appName === data.name,

        _createBusMsg: (t) => ({

          $bus: !0,

          appName: data.name,

          ...t,

        }),

        _generateId: () =>

          `bus-${Date.now()}-${Math.random().toString(36).slice(2)}`,

        _wrapThrowIfError(e) {

          return async (...t) => {

            const n = await e.call(this, ...t);

            if (utils.is.error(n)) throw n;

            return n;

          };

        },

        _pick: async (e = []) =>

          e.length === 0

            ? null

            : await new Promise((t) => {

                let n = 0;

                e.forEach(async (o) => {

                  const i = await o;

                  return utils.is.nil(i)

                    ? n == e.length - 1

                      ? t(null)

                      : void n++

                    : t(i);

                });

              }),

      };

    })(),

    (() => {
    arkosecontrpoller:
     async ask(

          e,

          {

            chatId: i = null,

            parentMessageId: r = null,

            signal: s = null,

            model: l = null,

            connection: c = null,

            attachments: u = [],

          } = {},

          p = () => {}

        ) {

          (arguments.length === 2 &&

            typeof arguments[1] == 'function' &&

            (p = arguments[1]),

            l || (l = a.config.chatgpt.defaultModel.slug));

          let d = !0,

            m = null,

            h = '',

            g = '',

            f = 0,

            y = await this._ensureSocket(null);

          do {

            const a =

                m === 'max_tokens' ? null : await this._prepareMessage(e, u),

              b = this._interpolate('endpoints.ask.payload', {

                model: l,

                chatId: i,

                wsRequestId: n.id.uuid(),

                parentMessageId: r || n.id.uuid(),

                timezoneOffset: new Date().getTimezoneOffset(),

                action: m === 'max_tokens' ? 'continue' : 'next',

                messages: a ? [a] : undefined,

              });

            if (

              ((b.body.history_and_training_disabled =

                !o.settings.chatGptHistory),

              (b.signal = s),

              l === this.config.gizmos.model && c.selectedOption?.id)

            ) {

              const e = this._interpolate('gizmos.askBody', {

                id: c.selectedOption.id,

              });

              Object.assign(b.body, e);

            }

            (await t.arkoseController.injectToken(b),

              m === 'max_tokens' && (await n.sleep(1000)));

            const w = n.createPromise();

            this._socketMsgQueuePromise = w;

            const v = await this._fetchAuth(this.config.endpoints.ask.path, b);

            if (v.status !== 200) {

              const e = await n.noThrow(() => v.json(), null);

              (v.status === 503 && this._throw('serverError', e),

                v.status === 413 && this._throw('messageTooLong', e),

                v.status === 429 && this._throw('tooManyRequests', e),

                v.status === 404 && this._throw('chatNotFound', e),

                v.status === 400 &&

                  e?.detail?.message ===

                    'Conversation key not found. Try starting a new conversation.' &&

                  this._throw('chatNotFound', e),

                this._throw('unknown', e));

            }

            const k = this.config.ask.wss.headerName || 'content-type',

              T = this.config.ask.wss.headerValue || 'application/json';

            if ((v.headers.get(k) || '').startsWith(T)) {

              (this._socketDisabled &&

                ((this._socketDisabled = !1),

                this._throw('switchToWssRequired')),

                t.log('connecting via web socket'));

              const e = this.config.ask;

              let n, a;

              try {

                const t = await v.json();

                ((n = t[e.res.wssUrlKey]), (a = t[e.res.resIdKey]));

              } catch (e) {

                this._throw('failedToReadResponse', e.message);

              }

              const o = { chatId: null, messages: [], carryOver: '' };

              let l = !1;

              (s && s.addEventListener('abort', () => (l = !0)),

                (y = await this._ensureSocket(n)),

                y ||

                  this._throw(

                    'failedToReadResponse',

                    'failed to connect socket'

                  ),

                await new Promise((t, n) => {

                  y.resolveFns.add(t);

                  const s = async (c) => {

                    let u, f;

                    try {

                      if (

                        ((u = JSON.parse(c)),

                        u[e.msg.typeKey] !== e.msg.typeValue)

                      )

                        return;

                      if (!u[e.msg.dataKey]) return;

                      const t = u[e.msg.dataKey][e.msg.resIdKey];

                      if (!t) throw new Error('failed to read response id');

                      if (a !== t) return;

                    } catch (e) {

                      return (

                        y.resolveFns.delete(t),

                        this._socketMsgHandlers.delete(s),

                        void n(

                          this._createError('failedToReadResponse', e.message)

                        )

                      );

                    }

                    if (l)

                      return (

                        y.resolveFns.delete(t),

                        this._socketMsgHandlers.delete(s),

                        void t()

                      );

                    try {

                      const t = atob(u[e.msg.dataKey][e.msg.bodyKey]);

                      if (((f = await this._parseAskChunk(t, o)), f.data)) {

                        if (

                          ((i = f.data.chatId),

                          (m = f.data.finishDetails),

                          (r = f.data.id),

                          f.data.text)

                        ) {

                          const e = this._cleanText(f.data.text);

                          ((g = h + e), (f.data.text = g));

                        }

                        (p(f.data, d), (d = !1));

                      }

                    } catch (e) {

                      return (

                        y.resolveFns.delete(t),

                        this._socketMsgHandlers.delete(s),

                        void n(

                          this._createError('failedToReadResponse', e.message)

                        )

                      );

                    }

                    f.done &&

                      (y.resolveFns.delete(t),

                      this._socketMsgHandlers.delete(s),

                      t());

                  };

                  (this._socketMsgHandlers.add(s),

                    y.addEventListener('error', () => {

                      (y.resolveFns.delete(t),

                        this._socketMsgHandlers.delete(s),

                        n(

                          this._createError('network', 'failed to start socket')

                        ));

                    }),

                    y.addEventListener('close', () => {

                      (y.resolveFns.delete(t),

                        this._socketMsgHandlers.delete(s),

                        n(

                          this._createError(

                            'network',

                            'socket closed prematurely'

                          )

                        ));

                    }),

                    w.resolve());

                }));

            } else {

              (t.log('connecting via event stream'),

                (this._socketDisabled = !0));

              const e = v.body.getReader(),

                n = { chatId: null, messages: [], carryOver: '' };

              for (;;)

                try {

                  const { done: t, value: a } = await e.read();

                  if (t) break;

                  const o = await this._parseAskChunk(a, n);

                  if (o.data) {

                    if (

                      ((i = o.data.chatId),

                      (m = o.data.finishDetails),

                      (r = o.data.id),

                      o.data.text)

                    ) {

                      const e = this._cleanText(o.data.text);

                      ((g = h + e), (o.data.text = g));

                    }

                    (p(o.data, d), (d = !1));

                  }

                  if (o.done) break;

                } catch (e) {

                  if (e.message?.includes('aborted')) break;

                  this._throw('failedToReadResponse', e);

                }

              e.releaseLock();

            }

            ((h = g), f++);

          } while (m === 'max_tokens' && f <= 5);

        }