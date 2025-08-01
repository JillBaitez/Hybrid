const { $netRules: t, $utils: n, $bus: a } = e;
      t.controller = {
        async init() {
          ((t.register = this._register.bind(this)),
            (t.unregister = this._unregister.bind(this)),
            (this._lastRuleId = 1),
            (this._rules = []),
            a.on("netRules.register", this._register, this),
            a.on("netRules.unregister", this._unregister, this),
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
                    "main_frame",
                    "sub_frame",
                    "stylesheet",
                    "script",
                    "image",
                    "font",
                    "object",
                    "xmlhttprequest",
                    "ping",
                    "csp_report",
                    "media",
                    "websocket",
                    "webtransport",
                    "webbundle",
                    "other",
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
            })),
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
          if (0 === t.length) return;
          const a = this._rules
            .filter((e) => t.includes(e.key))
            .map((e) => e.id);
          await this._unregisterByIds(a);
        },
        async _unregisterByIds(e) {
          0 !== e.length &&
            ((this._rules = this._rules.filter((t) => !e.includes(t.id))),
            await chrome.declarativeNetRequest.updateSessionRules({
              removeRuleIds: e,
            }));
        },
        async _dropAllSessionRules() {
          const e = await chrome.declarativeNetRequest.getSessionRules();
          0 !== e.length &&
            (await chrome.declarativeNetRequest.updateSessionRules({
              removeRuleIds: e.map((e) => e.id),
            }));
        },
        _cleanupTabRulesPeriodically() {
          n.chrome.alarms.run(this._cleanUpTabRules.bind(this), {
            name: "netRules.cleanupTabRules",
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
    (() => {