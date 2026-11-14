function xi() {
  const n = [];
  let t = !1;
  const e = () => {
    const r = n.shift();
    r ? r() : t = !1;
  }, s = () => {
    let r = !1;
    return () => {
      r || (r = !0, e());
    };
  };
  return () => t ? new Promise((r) => {
    n.push(() => r(s()));
  }) : (t = !0, s());
}
function kd(n, t) {
  const e = (s) => {
    const r = t(), i = (a) => () => {
      a(), s();
    };
    return typeof r == "function" ? i(r) : r.then(i);
  };
  return () => {
    const s = n();
    return typeof s == "function" ? e(s) : s.then(e);
  };
}
const Zo = Symbol("aparte.approvalGate");
function Ed(n) {
  return n?.[Zo];
}
function Cd(n, t) {
  const e = async (s, r) => {
    const i = n(), a = typeof i == "function" ? i : await i;
    try {
      return await t(s, r);
    } finally {
      a();
    }
  };
  return e[Zo] = { turn: n, ask: t }, e;
}
const xd = 300 * 1e3, Td = 10, Ti = /* @__PURE__ */ new Set();
function Id(n) {
  const t = String(n?.type ?? "undefined");
  Ti.has(t) || (Ti.add(t), console.warn(
    `[runStreamAgent] Ignoring unrecognised stream event "${t}". The reply is unaffected; this usually means the provider or its SDK emits a part this version of aparté does not map yet.`
  ));
}
async function Ii(n) {
  const {
    transportCall: t,
    toolLookup: e,
    toolConfigLookup: s,
    emitter: r,
    signal: i,
    maxTurns: a = Td,
    toolTimeoutMs: o = xd,
    deferral: l,
    parallelTools: c = !0
  } = n;
  let d = n.baseRequest, h = 0;
  const u = n.idGen ?? ((I) => `${I}-${h++}`), p = Nd(r, u, i, o), f = Ed(n.approvalResolver), _ = f ? kd(xi(), f.turn) : xi(), g = f ? f.ask : n.approvalResolver, v = {
    emitter: r,
    canAsk: !l && g !== void 0,
    canBackground: !l,
    transportCall: t,
    toolLookup: e,
    toolConfigLookup: s,
    approvalResolver: c && g ? Cd(_, g) : g,
    maxTurns: a,
    toolTimeoutMs: o,
    parallelTools: c,
    idGen: u,
    background: p
  }, S = [...d.messages], A = (I) => {
    S.push(I), n.onHistoryAppend?.(I);
  };
  let C = !0, b = 0, y, E;
  r({ type: "run-start" });
  try {
    return await R();
  } finally {
    p.close();
  }
  async function R() {
    const I = l ? Rd(S) : [];
    if (I.length > 0) {
      const O = [], N = { turns: 1, maxTurns: a, toolLookup: e, toolConfigLookup: s, approvalResolver: g, approvalTurn: _, emitter: r, signal: i, toolTimeoutMs: o, declareCall: () => {
      }, append: A, deferral: l, runBase: v };
      for (const [G, B] of I.entries()) {
        if (O.length > 0) {
          O.push({ toolCallId: B.id, name: B.name, input: B.input, reason: er(B, s) });
          continue;
        }
        let j;
        try {
          j = await nr(B, N);
        } catch (x) {
          for (const P of I.slice(G + 1)) r({ type: "tool-aborted", toolCallId: P.id });
          throw x;
        }
        if (typeof j == "object") {
          O.push({ toolCallId: B.id, name: B.name, input: B.input, reason: j.defer });
          continue;
        }
        if (j === "stop-run") {
          for (const x of I.slice(G + 1)) r({ type: "tool-aborted", toolCallId: x.id });
          C = !1;
          break;
        }
      }
      if (O.length > 0 && !i.aborted) {
        p.stopAll(), r({ type: "run-suspended", pending: O });
        return;
      }
    }
    for (; C && !i.aborted; ) {
      if (b++, E = void 0, b > a) {
        r({ type: "turn-limit-exceeded", scope: "global", limit: a });
        break;
      }
      const O = d.toolChoice;
      if (b === 1 && O && typeof O == "object" && !Array.isArray(O) && O.input !== void 0) {
        const V = O, H = u("synthetic-tool");
        r({ type: "tool-start", toolCallId: H, name: V.name, input: V.input });
        const xt = e(V.name);
        if (!xt) {
          r({ type: "tool-aborted", toolCallId: H, cause: "no-handler" }), C = !1;
          continue;
        }
        const J = await tl(xt, { id: H, name: V.name, input: V.input }, i, o, v);
        if (J.status === "aborted") {
          r(J.cause ? { type: "tool-aborted", toolCallId: H, cause: J.cause } : { type: "tool-aborted", toolCallId: H }), C = !1;
          continue;
        }
        if (J.status === "failed")
          throw r({ type: "tool-failed", toolCallId: H, error: Fr(J.error) }), J.error;
        r({ type: "tool-resolved", toolCallId: H, result: J.content, structuredResult: J.structuredContent }), A({ role: "assistant", content: "", toolCalls: [{ id: H, name: V.name, input: V.input }] }), A({ role: "tool", content: J.content, toolCallId: H, toolName: V.name }), d = { ...d, toolChoice: "none", tools: void 0 };
      }
      const N = { ...d, messages: S }, G = d.toolChoice;
      G && typeof G == "object" && (d = { ...d, toolChoice: "auto" });
      let B;
      try {
        B = await t(N);
      } catch (V) {
        if (i.aborted || V?.name === "AbortError") {
          C = !1;
          break;
        }
        throw V;
      }
      if (typeof B == "string") {
        if (r({ type: "turn-start" }), r({ type: "text-delta", delta: B }), r({ type: "text-flush" }), await w(B)) continue;
        break;
      }
      r({ type: "turn-start" });
      let j = "";
      const x = [];
      let P = !1, W = null;
      const U = (V) => {
        x.push(V), !W && (W = { role: "assistant", content: j.trim(), toolCalls: x }, A(W));
      }, nt = () => {
        W && (W.content = j.trim());
      }, Y = /* @__PURE__ */ new Set(), K = (V) => {
        let H = V;
        for (let xt = 2; Y.has(H); xt++) H = `${V}#${xt}`;
        return Y.add(H), H;
      }, it = [], ht = {
        turns: b,
        maxTurns: a,
        toolLookup: e,
        toolConfigLookup: s,
        approvalResolver: g,
        approvalTurn: _,
        emitter: r,
        signal: i,
        toolTimeoutMs: o,
        declareCall: U,
        append: A,
        deferral: l && { ...l, outcomes: void 0 },
        runBase: v
      }, ct = c ? Ld(ht) : void 0;
      let _e = !1;
      const te = B[Symbol.asyncIterator](), me = async () => {
        if (!i.aborted) return !1;
        try {
          await te.return?.(void 0);
        } catch {
        }
        return C = !1, !0;
      };
      try {
        for (; !(await me() || ct?.halted()); ) {
          let V;
          try {
            const wt = te.next();
            if (ct?.busy()) {
              const Ne = await Promise.race([wt, ct.onHalt.then(() => Ri)]);
              if (Ne === Ri) {
                _e = !0, Promise.resolve(wt).catch(() => {
                });
                break;
              }
              V = Ne;
            } else
              V = await wt;
          } catch (wt) {
            if (await me()) break;
            throw wt;
          }
          if (await me() || ct?.halted() || V.done) break;
          const H = V.value;
          if (H.type === "thinking") {
            r({ type: "thinking-delta", delta: H.delta });
            continue;
          }
          if (H.type === "text") {
            j += H.delta, r({ type: "text-delta", delta: H.delta });
            continue;
          }
          if (H.type === "sources") {
            r({ type: "sources", sources: H.sources, ...H.citations ? { citations: H.citations } : {} });
            continue;
          }
          if (H.type === "step-start" || H.type === "step-end") {
            r({ type: H.type, name: H.name });
            continue;
          }
          if (H.type === "activity") {
            r({ type: "activity", id: H.id, activityType: H.activityType, content: H.content });
            continue;
          }
          if (H.type === "done") {
            H.usage && (y = H.usage), H.finishReason && (E = H.finishReason);
            continue;
          }
          if (H.type === "error")
            throw H.code === void 0 ? new Error(H.message) : Object.assign(new Error(H.message), { code: H.code });
          if (H.type !== "tool_use") {
            Id(H);
            continue;
          }
          P = !0;
          const xt = K(H.id);
          r({ type: "tool-start", toolCallId: xt, name: H.name, input: H.input });
          const J = { id: xt, name: H.name, input: H.input };
          if (ct) {
            ct.start(J);
            continue;
          }
          if (it.length > 0) {
            U(J);
            const wt = er(J, s);
            wt === "approval" && r({ type: "tool-awaiting-approval", toolCallId: J.id, name: J.name, input: J.input }), it.push({ toolCallId: J.id, name: J.name, input: J.input, reason: wt });
            continue;
          }
          const qt = await nr(J, ht);
          if (typeof qt == "object") {
            U(J), it.push({ toolCallId: J.id, name: J.name, input: J.input, reason: qt.defer });
            continue;
          }
          if (qt === "stop-run") {
            C = !1;
            break;
          }
          if (qt === "stop-turn") break;
        }
        if (ct) {
          const V = await ct.finish();
          if (V.failure) throw V.failure.error;
          it.push(...V.pending), V.stopRun && (C = !1);
        }
        r({ type: "text-flush" }), nt();
      } finally {
        try {
          const V = te.return?.(void 0);
          _e ? Promise.resolve(V).catch(() => {
          }) : await V;
        } catch {
        }
        ct && await ct.abandon();
      }
      if (it.length > 0 && !i.aborted)
        return p.stopAll(), r({ type: "run-suspended", pending: it, usage: y }), y;
      !P && !await w(j) && (C = !1);
    }
    return p.stopAll(), i.aborted && r({ type: "run-aborted" }), r({ type: "run-done", usage: y, ...E ? { finishReason: E } : {} }), y;
  }
  async function w(I) {
    if (i.aborted || !p.pending()) return !1;
    if (b >= a)
      return p.stopAll(), r({ type: "turn-limit-exceeded", scope: "global", limit: a }), !1;
    if (await p.settled(), i.aborted) return !1;
    const O = p.report();
    if (!O) return !1;
    const N = I.trim();
    return N && A({ role: "assistant", content: N }), A({ role: "user", content: O }), !0;
  }
}
function Rd(n) {
  for (let t = n.length - 1; t >= 0; t--) {
    const e = n[t];
    if (e.role === "assistant") {
      if (!e.toolCalls?.length) return [];
      const s = new Set(n.slice(t + 1).filter((r) => r.role === "tool").map((r) => r.toolCallId));
      return e.toolCalls.filter((r) => !s.has(r.id));
    }
    if (e.role !== "tool") return [];
  }
  return [];
}
function er(n, t) {
  const e = t?.(n.name);
  if (e?.external) return "external";
  const s = typeof e?.needsApproval == "function" ? e.needsApproval({ id: n.id, name: n.name, input: n.input }) : e?.needsApproval;
  return s && s !== "deny" ? "approval" : "queued";
}
function Ot(n, t) {
  return n.decided?.(t), t;
}
function Jo(n) {
  const t = n.reason?.trim(), e = n.by ?? (t ? "policy" : "person"), s = t || (e === "policy" ? "Tool execution was refused by the approval policy." : e === "earlier-refusal" ? "Not run: an earlier call of the same step was refused." : n.instruction ? `The user rejected this tool call and said: ${n.instruction}` : "Tool execution was rejected by the user.");
  return n.instruction ? { reason: s, by: e, instruction: n.instruction } : { reason: s, by: e };
}
function ws(n, t, e) {
  const s = Jo(e);
  return n.emitter({ type: "tool-rejected", toolCallId: t.id, ...s }), n.declareCall(t), n.append({ role: "tool", content: s.reason, toolCallId: t.id, toolName: t.name }), Ot(n, "stop-turn");
}
async function nr(n, t) {
  const { signal: e } = t, s = n.input, r = t.toolConfigLookup?.(n.name), i = t.deferral?.outcomes?.[n.id];
  if (i?.kind === "decision" && !i.approved) return ws(t, n, i);
  const a = r?.maxTurns ?? t.maxTurns;
  if (t.turns > a)
    return t.emitter({ type: "turn-limit-exceeded", scope: "tool", limit: a, toolCallId: n.id }), Ot(t, "stop-run");
  if (r?.external) {
    if (!t.deferral)
      return t.emitter({ type: "tool-aborted", toolCallId: n.id, cause: "no-handler" }), Ot(t, "stop-run");
    if (!i || i.kind === "decision") return Ot(t, { defer: "external" });
    if (i.kind === "failed")
      throw t.emitter({ type: "tool-failed", toolCallId: n.id, error: i.error }), new Error(i.error);
    return t.emitter({ type: "tool-resolved", toolCallId: n.id, result: i.content, structuredResult: i.structuredContent }), t.declareCall(n), t.append({ role: "tool", content: i.content, toolCallId: n.id, toolName: n.name }), "continue";
  }
  const o = t.toolLookup(n.name);
  if (!o)
    return t.emitter({ type: "tool-aborted", toolCallId: n.id, cause: "no-handler" }), Ot(t, "stop-run");
  let l = n.input;
  const c = typeof r?.needsApproval == "function" ? r.needsApproval({ id: n.id, name: n.name, input: s }) : r?.needsApproval;
  if (c) {
    const h = i?.kind === "decision" && c !== "deny" ? i : void 0;
    let u;
    if (!h && t.approvalResolver && !(t.deferral && c !== "deny")) {
      const f = t.approvalTurn();
      if (typeof f == "function")
        u = f;
      else {
        if (u = await f, e.aborted)
          return u(), t.emitter({ type: "tool-aborted", toolCallId: n.id, cause: "stopped" }), Ot(t, "stop-run");
        if (t.stepRefused?.())
          return u(), ws(t, n, { by: "earlier-refusal" });
      }
    }
    let p = h;
    try {
      if (c !== "deny" && !h && t.emitter({ type: "tool-awaiting-approval", toolCallId: n.id, name: n.name, input: n.input }), !h && t.deferral && c !== "deny") return Ot(t, { defer: "approval" });
      if (!h && !t.approvalResolver)
        return t.emitter({ type: "tool-aborted", toolCallId: n.id, cause: "no-resolver" }), Ot(t, "stop-run");
      if (!p && !e.aborted && t.approvalResolver)
        try {
          p = await t.approvalResolver(
            { id: n.id, name: n.name, input: s },
            e
          );
        } catch (f) {
          if (!e.aborted && f?.name !== "AbortError") throw f;
        }
    } finally {
      u?.();
    }
    if (e.aborted || !p)
      return t.emitter({ type: "tool-aborted", toolCallId: n.id, cause: "stopped" }), Ot(t, "stop-run");
    if (!p.approved)
      return ws(t, n, p), "stop-turn";
    p.payload && typeof p.payload == "object" && !Array.isArray(p.payload) && (l = { ...s, ...p.payload }), t.emitter({ type: "tool-approved", toolCallId: n.id });
  }
  const d = await tl(
    o,
    { id: n.id, name: n.name, input: l },
    e,
    t.toolTimeoutMs,
    t.runBase
  );
  if (d.status === "aborted")
    return t.emitter(d.cause ? { type: "tool-aborted", toolCallId: n.id, cause: d.cause } : { type: "tool-aborted", toolCallId: n.id }), Ot(t, "stop-run");
  if (d.status === "failed")
    throw t.emitter({ type: "tool-failed", toolCallId: n.id, error: Fr(d.error) }), d.error;
  return t.emitter({ type: "tool-resolved", toolCallId: n.id, result: d.content, structuredResult: d.structuredContent }), t.declareCall(n), t.append({ role: "tool", content: d.content, toolCallId: n.id, toolName: n.name }), "continue";
}
const Ri = Symbol("halted");
function Ld(n) {
  const t = new AbortController(), e = () => t.abort();
  n.signal.aborted ? t.abort() : n.signal.addEventListener("abort", e, { once: !0 });
  const s = [], r = [];
  let i = 0, a = !1, o = !1, l = !1, c, d;
  const h = new Promise((_) => {
    d = _;
  }), u = () => {
    for (; i < s.length && s[i].settled; ) {
      const _ = s[i++];
      _.declared && !(l && _.pending) && n.declareCall(_.call);
      for (const g of _.messages) n.append(g);
    }
  }, p = () => {
    l = !0, t.abort(), d();
  }, f = async () => {
    await Promise.all(r), n.signal.removeEventListener("abort", e), u();
  };
  return {
    /** Resolves once a call stopped the step: the reply is read no further. */
    onHalt: h,
    halted: () => o || l,
    /** Whether a call is still running: only then can the step stop while the reply is read. */
    busy: () => i < s.length,
    start(_) {
      const g = { call: _, declared: !1, messages: [], settled: !1 };
      if (s.push(g), a) {
        const S = er(_, n.toolConfigLookup);
        S === "approval" && n.emitter({ type: "tool-awaiting-approval", toolCallId: _.id, name: _.name, input: _.input }), g.declared = !0, g.pending = { toolCallId: _.id, name: _.name, input: _.input, reason: S }, g.settled = !0, u();
        return;
      }
      const v = {
        ...n,
        signal: t.signal,
        declareCall: () => {
          g.declared = !0;
        },
        append: (S) => {
          g.messages.push(S);
        },
        decided: (S) => {
          typeof S == "object" ? a = !0 : S === "stop-run" ? p() : (o = !0, d());
        },
        stepRefused: () => o
      };
      r.push(nr(_, v).then(
        (S) => {
          typeof S == "object" && (g.declared = !0, g.pending = { toolCallId: _.id, name: _.name, input: _.input, reason: S.defer });
        },
        // A crash: the first one fails the run, once the others are stopped.
        (S) => {
          c ??= { error: S }, p();
        }
      ).finally(() => {
        g.settled = !0, u();
      }));
    },
    /** Waits for every call, and says what the step decided. */
    async finish() {
      if (await f(), l) {
        for (const _ of s)
          _.pending && n.emitter({ type: "tool-aborted", toolCallId: _.call.id, cause: "stopped" });
        return { ...c ? { failure: c } : {}, stopRun: l, pending: [] };
      }
      return {
        ...c ? { failure: c } : {},
        stopRun: l,
        pending: s.flatMap((_) => _.pending ? [_.pending] : [])
      };
    },
    /** The turn failed on its own: the calls still running are stopped, and waited for. */
    async abandon() {
      t.abort(), await f();
    }
  };
}
async function tl(n, t, e, s, r) {
  if (e.aborted) return { status: "aborted", cause: "stopped" };
  const i = new AbortController(), a = () => i.abort();
  e.addEventListener("abort", a, { once: !0 });
  let o;
  const l = new Promise((_) => {
    o = () => _({ status: "aborted", cause: "stopped" }), e.addEventListener("abort", o, { once: !0 });
  });
  let c, d = !1;
  const h = new Promise((_) => {
    c = setTimeout(() => {
      d = !0, i.abort(), _({ status: "aborted", cause: "timeout" });
    }, s);
  }), { run: u, closeOpen: p } = $d(r, t.id, i.signal);
  let f;
  try {
    return await Promise.race([
      n(t, i.signal, u).then((g) => ({ status: "resolved", content: g.content, structuredContent: g.structuredContent })),
      h,
      l
    ]);
  } catch (_) {
    return _?.name === "AbortError" ? e.aborted ? { status: "aborted", cause: "stopped" } : d ? { status: "aborted", cause: "timeout" } : { status: "aborted" } : (f = { error: _ }, { status: "failed", error: _ });
  } finally {
    clearTimeout(c), e.removeEventListener("abort", a), o && e.removeEventListener("abort", o), p(f ? "failed" : "stopped", f ? { error: Fr(f.error) } : void 0);
  }
}
const Md = /* @__PURE__ */ new Set(["run-start", "run-done", "run-aborted", "run-suspended"]), Od = (n) => Md.has(n.type);
function $d(n, t, e) {
  const { emitter: s, background: r, ...i } = n, a = [];
  return {
    run: {
      ...i,
      startAgent: (o) => {
        if (o.background) return r.open(o);
        const l = sr(s, n.idGen("agent"), o.detached ? void 0 : t, o, e);
        return a.push(l), l;
      }
    },
    closeOpen: (o, l) => {
      for (const c of a.reverse()) c.end(o, l);
      a.length = 0;
    }
  };
}
function sr(n, t, e, s, r, i) {
  let a = !r.aborted;
  const o = /* @__PURE__ */ new Map(), l = (d, h) => {
    if (a) {
      a = !1, r.removeEventListener("abort", c);
      for (const [u, p] of [...o].reverse())
        n({ type: "agent-end", agentId: u, status: "stopped", ...p ? { parentAgentId: p } : {} });
      o.clear(), n({
        type: "agent-end",
        agentId: t,
        status: d,
        ...h?.result !== void 0 ? { result: h.result } : {},
        ...h?.error !== void 0 ? { error: h.error } : {}
      }), i?.(d, h);
    }
  }, c = () => l("stopped");
  return a && (n({
    type: "agent-start",
    agentId: t,
    ...s.name !== void 0 ? { name: s.name } : {},
    ...s.description !== void 0 ? { description: s.description } : {},
    ...e !== void 0 ? { toolCallId: e } : {}
  }), r.addEventListener("abort", c, { once: !0 })), {
    agentId: t,
    signal: r,
    emit(d) {
      if (!(!a || Od(d))) {
        if (d.type === "agent-start" || d.type === "agent-end") {
          const h = d.parentAgentId ? d : { ...d, parentAgentId: t };
          h.type === "agent-start" ? o.set(h.agentId, h.parentAgentId) : o.delete(h.agentId), n(h);
          return;
        }
        n(d.agentId ? d : { ...d, agentId: t });
      }
    },
    end: l
  };
}
function Nd(n, t, e, s) {
  const r = [];
  let i = null, a = !1;
  const o = () => r.some((l) => !l.ended);
  return {
    open(l) {
      const c = new AbortController();
      if (a || e.aborted)
        return c.abort(), sr(n, t("agent"), void 0, l, c.signal);
      const d = () => c.abort();
      e.addEventListener("abort", d, { once: !0 });
      const h = setTimeout(() => c.abort(), s), u = { handle: void 0, name: l.name, description: l.description, stop: c, told: !1 };
      return u.handle = sr(n, t("agent"), void 0, l, c.signal, (p, f) => {
        clearTimeout(h), e.removeEventListener("abort", d), u.ended = { status: p, ...f }, o() || i?.();
      }), r.push(u), u.handle;
    },
    close() {
      a = !0;
      for (const l of r) l.ended || l.stop.abort();
    },
    pending: () => r.some((l) => !l.ended || !l.told),
    settled: () => o() ? new Promise((l) => {
      i = () => {
        i = null, l();
      };
    }) : Promise.resolve(),
    report() {
      const l = r.filter((d) => d.ended && !d.told);
      for (const d of l) d.told = !0;
      if (l.length === 0) return "";
      const c = l.map((d) => {
        const h = `Sub-agent "${d.name ?? d.handle.agentId}"${d.description ? ` (${d.description})` : ""}`, u = d.ended;
        return u.status === "done" ? `${h} is done:
${u.result?.trim() || "(it wrote nothing)"}` : u.status === "failed" ? `${h} failed: ${u.error ?? "no reason given"}` : `${h} was stopped before it answered.`;
      });
      return `${l.length === 1 ? "A sub-agent you started is back." : "The sub-agents you started are back."}

${c.join(`

`)}`;
    },
    stopAll() {
      for (const l of r) l.ended || l.stop.abort();
    }
  };
}
function Fr(n) {
  return n instanceof Error ? n.message || n.name : typeof n == "string" ? n : String(n);
}
function yt(n) {
  return n.replace(/["\\]/g, "\\$&").replace(/[\n\r\f]/g, (t) => `\\${t.charCodeAt(0).toString(16)} `);
}
function Dt(n) {
  return n.composedPath?.()[0] ?? n.target;
}
function xe(n) {
  return n.getRootNode();
}
function Et(n) {
  return n.getRootNode().activeElement ?? document.activeElement;
}
function el(n, t, e = {}) {
  const { gap: s = 4, margin: r = 8, side: i = "below", align: a = "start", rtl: o = !1 } = e, l = t.getBoundingClientRect(), c = (u, p, f) => Math.max(r, Math.min(u, p - f - r));
  let d, h;
  if (i === "beside") {
    const u = n.right + s, p = n.left - l.width - s, [f, _] = o ? [p, u] : [u, p], g = (v) => v >= r && v + l.width <= window.innerWidth - r;
    h = g(f) || !g(_) ? f : _, d = n.top;
  } else {
    const u = n.bottom + s, p = n.top - l.height - s, f = u + l.height <= window.innerHeight - r, _ = p >= r;
    i === "below" ? d = f || !_ ? u : p : d = _ || !f ? p : u, h = a === "start" !== o ? n.left : n.right - l.width;
  }
  t.style.top = `${c(d, window.innerHeight, l.height)}px`, t.style.left = `${c(h, window.innerWidth, l.width)}px`;
}
const On = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]', Pd = 500;
let we = null;
function Dd(n, t) {
  for (let e = n; e && e !== t; e = e.parentElement)
    if (e.hidden) return !1;
  return !0;
}
function Wn(n, t) {
  return !n.disabled && n.getAttribute("aria-disabled") !== "true" && Dd(n, t);
}
function nl(n, t) {
  return n.tagName === "BUTTON" || n.tagName === "A" && t === "Enter";
}
function sl(n) {
  return getComputedStyle(n).direction === "rtl";
}
function Hd(n) {
  return (n.getAttribute("aria-label") ?? n.textContent ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}
function Bd(n) {
  return !!n?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}
function qd(n, t) {
  for (let e = t; e; ) {
    if (e === n) return !0;
    const s = e.assignedSlot, r = e.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? e.host ?? null : null;
    e = s ?? e.parentNode ?? r;
  }
  return !1;
}
function rl(n, t) {
  let e = !1, s = null, r = null, i = !1, a = "", o = 0;
  const l = () => [...n.querySelectorAll(On)].filter((b) => {
    const y = b.parentElement?.closest('[role="menu"]');
    return (!y || y === n || !n.contains(y)) && Wn(b, n);
  }), c = (b) => b?.focus({ preventScroll: !0 }), d = (b) => {
    const y = Dt(b);
    i = !!y && (n.contains(y) || !!t.owns?.(y)), !i && C.close(!1);
  }, h = () => {
    i = !1;
  }, u = (b) => {
    const y = Dt(b);
    y instanceof Node && n.contains(y) || y instanceof Node && r?.isConnected && !qd(y, r) || C.close(!1);
  }, p = () => C.close(!1), f = (b) => {
    if (!e) return;
    const y = b.relatedTarget;
    !y && i || y && (n.contains(y) || t.owns?.(y)) || C.close(!1);
  }, _ = (b) => {
    if (!e || b.isComposing) return;
    const y = b.target;
    if (b.key === "Escape") {
      b.preventDefault(), C.close(!0);
      return;
    }
    if (b.key === "Tab") {
      C.close(!0);
      return;
    }
    if (b.altKey || b.ctrlKey || b.metaKey || Bd(y)) return;
    const E = l();
    if (!E.length) return;
    const R = E.indexOf(Et(n)), w = (B) => {
      b.preventDefault(), c(E[(B + E.length) % E.length]);
    };
    switch (b.key) {
      case "ArrowDown":
        w(R + 1);
        return;
      case "ArrowUp":
        w(R < 0 ? E.length - 1 : R - 1);
        return;
      case "Home":
        w(0);
        return;
      case "End":
        w(E.length - 1);
        return;
      case "Enter":
      case " ": {
        const B = y.closest(On);
        B && n.contains(B) && !nl(B, b.key) && (b.preventDefault(), B.click());
        return;
      }
    }
    if ([...b.key].length !== 1) return;
    b.preventDefault();
    const I = Date.now();
    a = I - o > Pd ? b.key : a + b.key, o = I;
    const O = [...a.toLocaleLowerCase()], N = O.every((B) => B === O[0]) ? O[0] : O.join(""), G = [...N].length === 1 ? R + 1 : Math.max(R, 0);
    for (let B = 0; B < E.length; B++) {
      const j = E[(G + B) % E.length];
      if (Hd(j).startsWith(N)) {
        c(j);
        return;
      }
    }
  }, g = (b) => {
    if (!e) return;
    const y = b.target.closest?.(`${On}, button`);
    if (!y || y === n || !n.contains(y) || !Wn(y, n)) return;
    n.dispatchEvent(new CustomEvent("aparte-menu-select", {
      detail: { item: y },
      bubbles: !0,
      composed: !0,
      cancelable: !0
    })) && C.close(!0);
  }, v = (b) => {
    e && b.preventDefault();
  };
  n.addEventListener("keydown", _), n.addEventListener("click", g), n.addEventListener("focusout", f), n.addEventListener("contextmenu", v);
  const S = { position: n.style.position, top: n.style.top, left: n.style.left };
  n.hidden = !0;
  const A = !n.hasAttribute("role");
  A && n.setAttribute("role", "menu");
  const C = {
    isOpen: () => e,
    open(b, y, E, R, w) {
      we && we !== C && we.close(!1), e = !0, we = C, s = R, r = w, a = "", n.hidden = !1, n.style.position = "fixed", el(b, n, y), document.addEventListener("pointerdown", d, !0), document.addEventListener("pointerup", h, !0), document.addEventListener("pointercancel", h, !0), window.addEventListener("scroll", u, !0), window.addEventListener("resize", p), t.onToggle?.(!0);
      const I = l(), O = I.find((N) => N.getAttribute("role") === "menuitemradio" && N.getAttribute("aria-checked") === "true");
      c(E === "last" ? I[I.length - 1] : O ?? I[0]);
    },
    close(b) {
      e && (e = !1, we === C && (we = null), i = !1, document.removeEventListener("pointerdown", d, !0), document.removeEventListener("pointerup", h, !0), document.removeEventListener("pointercancel", h, !0), window.removeEventListener("scroll", u, !0), window.removeEventListener("resize", p), b && s?.isConnected && s.focus(), s = null, r = null, n.hidden = !0, t.onToggle?.(!1), t.onClose?.());
    },
    release() {
      C.close(!1), n.removeEventListener("keydown", _), n.removeEventListener("click", g), n.removeEventListener("focusout", f), n.removeEventListener("contextmenu", v), n.style.position = S.position, n.style.top = S.top, n.style.left = S.left, n.getAttribute("style") || n.removeAttribute("style"), A && n.removeAttribute("role");
    },
    returnTarget: () => s
  };
  return C;
}
function Li(n, t, e, s = !1) {
  const r = n.getAttribute(t);
  return (r === null || !s) && n.setAttribute(t, e), () => {
    r === null ? n.removeAttribute(t) : n.setAttribute(t, r);
  };
}
function Fd(n, t, e = {}) {
  const { onOpen: s, onClose: r, ...i } = e, a = [
    Li(n, "aria-haspopup", "menu", !0),
    Li(n, "aria-expanded", "false")
  ], o = rl(t, {
    owns: (u) => n.contains(u),
    onToggle: (u) => n.setAttribute("aria-expanded", String(u)),
    onClose: r
  }), l = (u) => {
    if (o.isOpen()) {
      const p = [...t.querySelectorAll(On)].filter((f) => Wn(f, t));
      (u === "last" ? p[p.length - 1] : p[0])?.focus({ preventScroll: !0 });
      return;
    }
    s?.() !== !1 && o.open(n.getBoundingClientRect(), { ...i, rtl: i.rtl ?? sl(n) }, u, n, n);
  }, c = () => {
    o.isOpen() ? o.close(!0) : l("first");
  }, d = () => c(), h = (u) => {
    u.altKey || u.ctrlKey || u.metaKey || u.isComposing || (u.key === "ArrowDown" || u.key === "ArrowUp" ? (u.preventDefault(), l(u.key === "ArrowUp" ? "last" : "first")) : (u.key === "Enter" || u.key === " ") && !nl(n, u.key) && (u.preventDefault(), c()));
  };
  return n.addEventListener("click", d), n.addEventListener("keydown", h), () => {
    o.release(), n.removeEventListener("click", d), n.removeEventListener("keydown", h);
    for (const u of a) u();
  };
}
function Ud(n, t, e = {}) {
  const { onOpen: s, onClose: r, gap: i, margin: a, rtl: o } = e, l = rl(t, { onClose: r }), c = (u, p, f) => {
    const _ = Et(n), g = _ && _ !== document.body && !t.contains(_) ? _ : l.returnTarget();
    return l.close(!1), s?.(u) === !1 ? !1 : (l.open(p, {
      // At the pointer it opens on the spot, the way the browser's own does.
      gap: f ? 0 : i,
      margin: a,
      side: "below",
      align: "start",
      rtl: o ?? sl(n)
    }, "first", g, u), !0);
  }, d = (u) => {
    const p = Dt(u);
    if (!p) return;
    if (p instanceof Node && t.contains(p)) {
      u.preventDefault();
      return;
    }
    const f = { top: u.clientY, bottom: u.clientY, left: u.clientX, right: u.clientX };
    c(p, f, !0) && u.preventDefault();
  }, h = (u) => {
    if (!(u.key === "F10" && u.shiftKey || u.key === "ContextMenu")) return;
    const p = Dt(u);
    !p || t.contains(p) || c(p, p.getBoundingClientRect(), !1) && u.preventDefault();
  };
  return n.addEventListener("contextmenu", d), n.addEventListener("keydown", h), () => {
    l.release(), n.removeEventListener("contextmenu", d), n.removeEventListener("keydown", h);
  };
}
function Wd(n, t = {}) {
  const e = t.activation === "manual", s = () => [...n.querySelectorAll('[role="tab"]')].filter((u) => u.closest('[role="tablist"]') === n), r = (u) => Wn(u, n), i = () => s().find((u) => u.getAttribute("aria-selected") === "true") ?? null, a = (u) => {
    const p = u.getAttribute("aria-controls");
    return p ? n.getRootNode().querySelector(`[id="${yt(p)}"]`) : null;
  }, o = (u) => {
    for (const p of s()) {
      const f = p === u;
      p.setAttribute("aria-selected", String(f)), p.tabIndex = f ? 0 : -1;
      const _ = a(p);
      _ && (_.hidden = !f);
    }
  }, l = (u) => {
    const p = i();
    if (u === p) return !0;
    const f = n.dispatchEvent(new CustomEvent("aparte-tab-change", {
      detail: { tab: u, panel: a(u), previous: p },
      bubbles: !0,
      composed: !0,
      cancelable: !0
    }));
    return f && o(u), f;
  }, c = (u) => {
    const p = u.target.closest?.('[role="tab"]');
    !p || !s().includes(p) || !r(p) || l(p);
  }, d = (u) => {
    if (u.altKey || u.ctrlKey || u.metaKey || u.isComposing) return;
    const p = u.target.closest?.('[role="tab"]'), f = s(), _ = p ? f.indexOf(p) : -1;
    if (!p || _ < 0) return;
    if (u.key === "Enter" || u.key === " ") {
      e && p.tagName !== "BUTTON" && r(p) && (u.preventDefault(), l(p));
      return;
    }
    const g = n.getAttribute("aria-orientation") === "vertical", v = !g && getComputedStyle(n).direction === "rtl", S = g ? "ArrowDown" : v ? "ArrowLeft" : "ArrowRight", A = g ? "ArrowUp" : v ? "ArrowRight" : "ArrowLeft";
    let C, b;
    if (u.key === S)
      C = _ + 1, b = 1;
    else if (u.key === A)
      C = _ - 1, b = -1;
    else if (u.key === "Home")
      C = 0, b = 1;
    else if (u.key === "End")
      C = f.length - 1, b = -1;
    else return;
    u.preventDefault();
    for (let y = 0; y < f.length; y++) {
      const E = f[((C + y * b) % f.length + f.length) % f.length];
      if (r(E)) {
        (e || l(E)) && E.focus();
        return;
      }
    }
  };
  n.addEventListener("click", c), n.addEventListener("keydown", d);
  const h = i() ?? s().find(r);
  return h && o(h), () => {
    n.removeEventListener("click", c), n.removeEventListener("keydown", d);
  };
}
const zd = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/></svg>', Gd = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5 9.5 17.5 19.5 7"/></svg>', jd = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3 3.7 10.4a.9.9 0 0 0 .1 1.7l6.2 2 2 6.2a.9.9 0 0 0 1.7.1L21 3Z"/><path d="M10 14 21 3"/></svg>', Kd = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="aparte-icon aparte-icon-spin"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>', Vd = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.75v5"/><path d="M12 16.25h.01"/></svg>', Xd = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 9.5 12 16l6.5-6.5"/></svg>', Yd = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 14.5 12 8l6.5 6.5"/></svg>', Qd = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4.5h5.5V10"/><path d="M10 19.5H4.5V14"/><path d="m19.5 4.5-6 6"/><path d="m4.5 19.5 6-6"/></svg>', Zd = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 10H14V4.5"/><path d="M4.5 14H10v5.5"/><path d="m14 10 5.5-5.5"/><path d="m10 14-5.5 5.5"/></svg>', Jd = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6.5 10.5 12 5 17.5"/><path d="M13 18h6"/></svg>', tu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.4 21a5.2 5.2 0 0 1-3.7-8.9l8.6-8.6a3.5 3.5 0 0 1 4.9 4.9l-8.6 8.6a1.7 1.7 0 0 1-2.5-2.5l7.4-7.4"/></svg>', eu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="8.5" cy="9" r="1.5"/><path d="M20.5 15.5l-4-4-8 8"/></svg>', nu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8.5Z"/><path d="M13.5 3v5.5H19"/></svg>', su = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5v15"/><path d="M6 13.5l6 6 6-6"/></svg>', ru = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.35-5.65L4 8.5"/><path d="M4 3.5v5h5"/></svg>', iu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5H6a2 2 0 0 0-2 2v11.5a2 2 0 0 0 2 2h11.5a2 2 0 0 0 2-2V13"/><path d="M17.75 3.25a2.05 2.05 0 0 1 2.9 2.9l-9.15 9.15-3.9 1 1-3.9Z"/></svg>', au = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 10.5v10"/><path d="M6.5 10.5h3l3.2-6.4a1.75 1.75 0 0 1 3.3.8V9h4a2 2 0 0 1 2 2.35l-1.3 7.3a2 2 0 0 1-2 1.6H9.5"/></svg>', ou = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 13.5v-10"/><path d="M17.5 13.5h-3l-3.2 6.4a1.75 1.75 0 0 1-3.3-.8V15h-4a2 2 0 0 1-2-2.35l1.3-7.3a2 2 0 0 1 2-1.6h9.1"/></svg>', lu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6 9 12l5.5 6"/></svg>', cu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6 15 12l-5.5 6"/></svg>', du = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5a5.5 5.5 0 0 0-5.1 7.6L3.5 17l3.5 3.5 5.9-5.9a5.5 5.5 0 0 0 7.6-5.1l-3.1 3.1-2.7-.8-.8-2.7 3.1-3.1Z"/></svg>', uu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11"/><path d="M17.5 6.5l-11 11"/></svg>', hu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5"/></svg>', pu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.5" height="14" rx="1.5"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5"/></svg>', fu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.25"/><path d="M12 7.75h.01"/></svg>', gu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 21 8"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><polyline points="9 14 12 11 15 14"/><line x1="12" y1="11" x2="12" y2="19"/></svg>', _u = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 21 8"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><polyline points="9 14 12 17 15 14"/><line x1="12" y1="11" x2="12" y2="17"/></svg>', mu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v12m0 0-4.5-4.5M12 15.5l4.5-4.5M4.5 20h15"/></svg>', bu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18.5" cy="12" r="1.1"/></svg>', vu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 3.5h7"/><path d="M10 3.5v5l-3 3.5V14h10v-2l-3-3.5v-5"/><path d="M12 14v6.5"/></svg>', yu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M8 7V5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 5v2"/><path d="m6.5 7 .8 12a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/><path d="M10 11v5.5M14 11v5.5"/></svg>', wu = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9.5L4.5 21V6.5A2.5 2.5 0 0 1 6.5 4Z"/></svg>', Su = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M4.5 12h15M4.5 17h15"/></svg>', Au = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 4.3 2.9 18a1.5 1.5 0 0 0 1.3 2.3h15.6a1.5 1.5 0 0 0 1.3-2.3L13.3 4.3a1.5 1.5 0 0 0-2.6 0Z"/><path d="M12 9.5V14M12 17.2v.1"/></svg>', ku = {
  copy: zd,
  check: Gd,
  send: jd,
  loading: Kd,
  error: Vd,
  expand: Xd,
  collapse: Yd,
  maximize: Qd,
  minimize: Zd,
  terminal: Jd,
  paperclip: tu,
  image: eu,
  file: nu,
  scrollDown: su,
  retry: ru,
  edit: iu,
  thumbUp: au,
  thumbDown: ou,
  prevBranch: lu,
  nextBranch: cu,
  tool: du,
  close: uu,
  stop: hu,
  pause: pu,
  info: fu,
  archive: gu,
  unarchive: _u,
  download: mu,
  more: bu,
  pin: vu,
  trash: yu,
  menu: Su,
  alertTriangle: Au,
  messageSquare: wu
};
function il(n) {
  return typeof n == "string" ? n : n.filter((t) => t.type === "text").map((t) => t.text).join("");
}
var tt = /* @__PURE__ */ ((n) => (n.CONFIG_NO_PROVIDER = "CONFIG_NO_PROVIDER", n.CONFIG_MISSING_KEY = "CONFIG_MISSING_KEY", n.CONFIG_INVALID_KEY = "CONFIG_INVALID_KEY", n.CONFIG_INVALID_MODEL = "CONFIG_INVALID_MODEL", n.USAGE_RATE_LIMIT = "USAGE_RATE_LIMIT", n.USAGE_CONTEXT_EXCEEDED = "USAGE_CONTEXT_EXCEEDED", n.USAGE_BAD_REQUEST = "USAGE_BAD_REQUEST", n.NET_OFFLINE = "NET_OFFLINE", n.NET_TIMEOUT = "NET_TIMEOUT", n.NET_ERROR = "NET_ERROR", n.PROVIDER_ERROR = "PROVIDER_ERROR", n.PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE", n.PROVIDER_POLICY = "PROVIDER_POLICY", n.PROVIDER_MISCONFIGURED = "PROVIDER_MISCONFIGURED", n.MAX_TURNS_EXCEEDED = "MAX_TURNS_EXCEEDED", n.UNKNOWN_ERROR = "UNKNOWN_ERROR", n))(tt || {});
class ut extends Error {
  constructor(t, e, s, r, i) {
    super(t), this.message = t, this.code = e, this.data = s, this.originalError = r, this.httpStatus = i, this.name = "AparteError";
  }
  /**
   * The code an HTTP status stands for — the table the enum's own comments promise.
   * `undefined` for a status the enum does not name (a 404 can be a wrong model or a
   * wrong URL; the message says which, a code would guess).
   */
  static codeForStatus(t) {
    switch (t) {
      case 400:
        return "USAGE_BAD_REQUEST";
      case 401:
      case 403:
        return "CONFIG_INVALID_KEY";
      case 408:
        return "NET_TIMEOUT";
      case 429:
        return "USAGE_RATE_LIMIT";
      case 503:
        return "PROVIDER_UNAVAILABLE";
      default:
        return t !== void 0 && t >= 500 ? "PROVIDER_ERROR" : void 0;
    }
  }
  static from(t, e = "UNKNOWN_ERROR", s) {
    if (t instanceof ut) return t;
    const r = t instanceof Error ? t.message : String(t), i = t?.status || t?.statusCode || s, a = t?.code, o = e !== "UNKNOWN_ERROR" ? e : ut.carriedCode(a) ?? ut.codeForStatus(i) ?? ut.codeForFailure(t) ?? e;
    return new ut(r, o, void 0, t, i);
  }
  /** The value as an {@link AparteErrorCode}, when it is one — a Node `ECONNRESET` or a vendor's own string is not. */
  static carriedCode(t) {
    return typeof t == "string" && Object.values(tt).includes(t) ? t : void 0;
  }
  /**
   * What a thrown, statusless error says about itself. `fetch` rejects a network
   * failure with a TypeError whose message names the fetch ("Failed to fetch",
   * "NetworkError when attempting to fetch resource.", "Load failed") — any other
   * TypeError is a bug, not the network, and stays unclassified. `AbortSignal.timeout()`
   * rejects with a TimeoutError.
   */
  static codeForFailure(t) {
    if (t instanceof Error) {
      if (t.name === "TimeoutError") return "NET_TIMEOUT";
      if (t instanceof TypeError && /fetch|network|load failed/i.test(t.message))
        return typeof navigator < "u" && navigator.onLine === !1 ? "NET_OFFLINE" : "NET_ERROR";
    }
  }
}
const wn = ku, Ve = {
  inputPlaceholder: "Type a message...",
  sendButton: "Send",
  copy: "Copy",
  copied: "Copied!",
  retry: "Retry",
  thinking: "Thinking",
  elicitationOther: "Other…",
  elicitationOtherPlaceholder: "Type your answer…",
  elicitationOtherLabel: "Custom answer",
  submitButton: "Submit",
  stopButton: "Stop",
  elicitationRecommended: "Recommended",
  elicitationSkip: "Skip",
  elicitationHide: "Hide for now",
  elicitationWaiting: "Waiting for your answer",
  elicitationYes: "Yes",
  elicitationNo: "No",
  elicitationAnswerLabel: "Your answer",
  approvalInstructionPlaceholder: "Or tell it what to do instead…",
  approvalAsk: "Allow {tool}?",
  approvalAskBy: "Allow {tool} for {agent}?",
  approvalWaiting: "Waiting",
  scrollToBottom: "Scroll to bottom",
  suggestionsLabel: "Suggested prompts",
  contextLabel: "Context window",
  contextSystem: "System prompt",
  contextTools: "Tools",
  contextSummary: "Summary",
  contextMessages: "Messages",
  contextOther: "Other",
  contextFree: "Free",
  contextTotal: "Total",
  contextReclaim: "Compacting now would free ~{n} tokens",
  contextCompactNow: "Compact now",
  checkpointCount: "{n} messages summarised for the model",
  checkpointCountOne: "1 message summarised for the model",
  checkpointLegacy: "Earlier messages were summarised",
  checkpointGroup: "Context summary",
  checkpointShow: "Show summary",
  checkpointHide: "Hide summary",
  checkpointRestore: "Restore",
  checkpointRestoreConfirm: "Send the original messages to the model again?",
  checkpointPending: "Summarising the context…",
  checkpointFailed: "Couldn't summarise the context",
  toolRunning: "Running",
  toolCompleted: "Done",
  toolRejected: "Rejected",
  toolStopped: "Stopped",
  toolFailed: "Failed",
  toolInput: "Input",
  toolOutput: "Output",
  toolRejectedSaid: "You said: “{instruction}”",
  toolRefusedByPolicy: "Refused by policy",
  toolNotRunAfterRefusal: "Not run: an earlier call was refused",
  toolTimedOut: "Timed out",
  toolUnavailable: "Not available here",
  toolNoApprover: "No one could approve it",
  toolTurnLimit: "Turn limit reached",
  maxTurnsReached: "Stopped after {n} turns to avoid an endless loop.",
  sourcesCount: "{n} sources",
  sourcesOne: "1 source",
  sourcesCard: "Sources",
  sourcePrevious: "Previous source",
  sourceNext: "Next source",
  sourcePosition: "Source {i} of {n}",
  opensInNewTab: "(opens in a new tab)",
  imageLoad: "Load the image from {host}",
  imageLoadNamed: "Load the image “{alt}” from {host}",
  questionDeclined: "You declined to answer.",
  artifactNotCreated: "Not created",
  thoughtFor: "Thought for {duration}",
  thought: "Thought",
  turnWorking: "Working…",
  turnWorked: "Worked {duration}",
  turnUsed: "Used {tools}",
  turnTools: "one:{n} tool|other:{n} tools",
  feedbackReasonTitle: "What went wrong?",
  feedbackReasonDismiss: "Not now",
  triggersLoading: "Loading…",
  triggersEmpty: "No results",
  triggersError: "This list could not be loaded",
  triggersRetry: "Try again",
  triggersBack: "Back",
  triggersCommandNew: "Start a new conversation",
  triggersCommandStop: "Stop the reply",
  triggersCommandRetry: "Answer again",
  triggersCommandCopy: "Copy the last reply",
  triggersCommandCompact: "Summarise the earlier messages",
  triggersCompactNothing: "There is nothing to compact yet",
  triggersCompactBusy: "Wait for the reply to finish",
  triggersCompactNoWindow: "This model does not say how much it can read",
  triggersCompactFailed: "The summary could not be written",
  triggersCommandModel: "Change the model",
  triggersCommandApproval: "Change the approval mode",
  approvalOptionsLabel: "Your decision",
  approvalArgsLabel: "Arguments",
  actionUpload: "Attach file",
  removeAttachment: "Remove {name}",
  messageFrom: "Message from {name}",
  selectSearchPlaceholder: "Search…",
  selectSearchLabel: "Search options",
  loading: "Loading…",
  download: "Download",
  openArtifact: "Open",
  closeArtifact: "Close",
  artifactVersion: "Version {n} of {total}",
  previousVersion: "Previous version",
  nextVersion: "Next version",
  modelContextWindow: "{n} context",
  previewPending: "Press Preview to run this artifact.",
  sandboxError: "The sandbox failed during generation.",
  sandboxErrorHint: "Common cause: the model produced invalid code (undefined variable, wrong argument type). Retry the request — the model may produce different code.",
  preview: "Preview",
  code: "Code",
  generating: "Generating…",
  rebuildingPreview: "Rebuilding preview…",
  typing: "Typing",
  responseCutOff: "Cut off at the model's length limit.",
  error: "Error",
  errorUnreachable: "The assistant can’t be reached right now. Try again in a moment.",
  errorTimeout: "The answer took too long. Try again in a moment.",
  errorRefused: "The assistant isn’t allowed to answer right now.",
  errorRateLimited: "Too many requests right now. Try again in a moment.",
  errorTooLong: "This conversation is too long for the model. Start a new one.",
  errorFailed: "The assistant couldn’t answer. Try again in a moment.",
  errorNoAnswer: "The assistant couldn’t answer this request.",
  running: "Running...",
  run: "Run",
  file: "File",
  modelSelectorPlaceholder: "Select a model...",
  approvalModeLabel: "Approval mode",
  roleNameUser: "You",
  roleNameAssistant: "Assistant",
  yourMessage: "Your message",
  assistantResponse: "Assistant response",
  messageActions: "Message actions",
  edit: "Edit message",
  editConfirm: "Send",
  editCancel: "Cancel",
  feedbackPositive: "Good response",
  feedbackNegative: "Bad response",
  previousResponse: "Previous response",
  nextResponse: "Next response",
  approveTool: "Approve",
  rejectTool: "Reject",
  messageInfo: "Details",
  newChat: "New Chat",
  loadingConversations: "Loading conversations",
  conversationSearchEmpty: "No conversation matches",
  conversationList: "Conversations",
  loadingConversation: "Loading the conversation",
  deleteConversation: "Delete",
  archiveConversation: "Archive",
  unarchiveConversation: "Unarchive",
  conversationActions: "Conversation actions",
  conversationRunning: "Answering",
  conversationWaiting: "Waiting for you",
  renameConversation: "Rename",
  conversationTitle: "Conversation title",
  pinConversation: "Pin",
  unpinConversation: "Unpin",
  deleteConversationConfirm: "Delete “{title}”?",
  cancel: "Cancel",
  conversationGroupPinned: "Pinned",
  conversationGroupToday: "Today",
  conversationGroupYesterday: "Yesterday",
  conversationGroupWeek: "Previous 7 days",
  conversationGroupMonth: "Previous 30 days",
  scrollRailLabel: "Conversation outline",
  sidebarLabel: "Conversations",
  splitHandleLabel: "Resize the panes",
  launcherOpen: "Open the chat",
  launcherClose: "Close the chat",
  launcherHeading: "Chat",
  launcherMaximize: "Expand the chat",
  launcherRestore: "Shrink the chat",
  transcript: "Transcript"
};
function Eu(n) {
  return typeof n.buildRequest == "function" && typeof n.parseStream == "function" && typeof n.defaultEndpoint == "string" && (typeof n.authHeaders == "function" || typeof n.authQuery == "function");
}
function Cu(n) {
  return typeof n == "string" ? { key: n } : n && typeof n == "object" ? { key: n.apiKey, endpoint: n.endpoint } : {};
}
function xu(n, t, e) {
  const s = n?.error, r = typeof s == "object" ? s?.message : s;
  return typeof r == "string" && r ? r : `${e} ${t}`;
}
function Tu(n) {
  return typeof n == "string" && Object.values(tt).includes(n);
}
async function Iu(n, t = "HTTP", e) {
  const s = await n.json().catch(() => {
  }), r = xu(s, n.status, t), i = s?.error?.code, a = e?.classifyError?.(n.status, s) ?? (Tu(i) ? i : void 0) ?? ut.codeForStatus(n.status) ?? tt.UNKNOWN_ERROR;
  return new ut(r, a, void 0, void 0, n.status);
}
async function Ru(n, t, e) {
  const s = await t.json();
  if (typeof n.parseText != "function")
    throw new Error(`Provider "${e}" cannot resolve a non-streaming response: parseText is not implemented.`);
  const r = n.parseText(s);
  let i;
  try {
    i = n.parseSources?.(s);
  } catch {
    i = void 0;
  }
  return Lu(r, i);
}
function Lu(n, t) {
  if (!t || t.sources.length === 0) return n;
  const e = [{ type: "text", delta: n }, { type: "sources", ...t }, { type: "done" }];
  return new ReadableStream({
    pull(s) {
      const r = e.shift();
      r ? s.enqueue(r) : s.close();
    }
  });
}
class Mu {
  byok;
  warnedBrowserKey = !1;
  constructor(t = {}) {
    this.byok = t.byok ?? !1;
  }
  async chat(t, e, s, r) {
    const { key: i, endpoint: a } = Cu(s);
    if (!this.byok && i && this.warnBrowserKeyOnce(r.providerId), !Eu(t)) {
      if (typeof t.chat != "function")
        throw new Error(`Provider "${r.providerId}" exposes neither a format-adapter surface nor chat().`);
      return t.chat(e, s, r);
    }
    const o = a || t.defaultEndpoint, l = t.buildRequest(e);
    let c = `${o}${l.path}`;
    const d = { "Content-Type": "application/json", ...l.headers };
    if (i && t.authHeaders && Object.assign(d, t.authHeaders(i)), i && t.authQuery) {
      const u = new URLSearchParams(t.authQuery(i)).toString();
      c += (c.includes("?") ? "&" : "?") + u;
    }
    const h = await fetch(c, {
      method: "POST",
      headers: d,
      body: JSON.stringify(l.body),
      signal: r.signal
    });
    if (!h.ok)
      throw await Iu(h, "HTTP", t);
    if (e.stream === !1)
      return Ru(t, h, r.providerId);
    if (!h.body)
      throw new Error(`Provider "${r.providerId}" returned no response body for a streaming request.`);
    return t.parseStream(h.body);
  }
  warnBrowserKeyOnce(t) {
    this.warnedBrowserKey || (this.warnedBrowserKey = !0, console.warn(
      `[Aparte] AparteDirectTransport is sending the "${t}" API key straight from the browser — it is visible to anyone who opens devtools. Fine for BYOK or local models: pass new AparteDirectTransport({ byok: true }) to silence this. For a server-held key, use AparteBackendTransport so the key never reaches the client.`
    ));
  }
}
function pt() {
  return typeof crypto < "u" && typeof crypto.randomUUID == "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
const Ou = [
  { start: "<think>", end: "</think>" },
  { start: "<thinking>", end: "</thinking>" }
];
class rr {
  _options;
  /** Normalized to an array; the parser matches whichever pair opens first. */
  _thinkingDelimiters;
  /** The registered block grammars, in registration order. */
  _blocks;
  _state;
  /**
   * A block already BUILT and waiting for its turn to be emitted — a self-closing
   * tag that followed prose, whose text run has to go out first. One segment per
   * step, but `toSegment` is still called exactly once, as `AparteStreamBlock`
   * documents: re-reading the tag on the next step called a consumer's grammar
   * twice for one tag.
   */
  _pendingSegment = null;
  constructor(t = {}) {
    const e = t.thinkingDelimiters;
    this._thinkingDelimiters = e ? Array.isArray(e) ? e : [e] : Ou, this._blocks = t.blocks ?? [], this._options = {
      autoGenerateIds: t.autoGenerateIds ?? !0,
      idPrefix: t.idPrefix ?? "seg"
    }, this._state = this._createInitialState();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Parse a chunk of streamed content
   * Call this for each chunk received from the LLM
   */
  parse(t) {
    this._state.buffer += t;
    const e = [];
    for (; this._state.buffer.length > 0 || this._pendingSegment; ) {
      const s = this._parseNext();
      if (!s)
        break;
      s.segment && e.push(s.segment), this._state.buffer = s.remaining;
    }
    return {
      segments: e,
      remaining: this._state.buffer,
      state: { ...this._state }
    };
  }
  /**
   * Finalize parsing - flush any remaining content as text
   */
  finalize() {
    const t = [], e = (s) => s.replace(/\n?```[ \t]*$/, "");
    if (this._state.activeSegment) {
      if ("content" in this._state.activeSegment) {
        const s = this._state.activeSegment;
        let r = s.content + this._state.buffer;
        (s.type === "text" || s.type === "code") && (r = e(r)), s.content = r;
      }
      t.push(this._closed(this._state.activeSegment)), this._state.activeSegment = null;
    } else this._state.buffer.trim() && t.push(this._closed(this._createTextSegment(e(this._state.buffer))));
    return this._state.mode = "text", this._state.buffer = "", this._state.codeLanguage = void 0, this._state.thinkingEnd = void 0, this._state.blockEnd = void 0, t;
  }
  /**
   * Reset parser state
   */
  reset() {
    this._state = this._createInitialState(), this._pendingSegment = null;
  }
  /**
   * Get current parser state (for debugging/inspection)
   */
  getState() {
    return { ...this._state };
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private Parsing Logic
  // ─────────────────────────────────────────────────────────────────────────
  _parseNext() {
    if (this._pendingSegment) {
      const e = this._pendingSegment;
      return this._pendingSegment = null, { segment: e, remaining: this._state.buffer };
    }
    const t = this._state.buffer;
    switch (this._state.mode) {
      case "text":
        return this._parseTextMode(t);
      case "code":
        return this._parseCodeMode(t);
      case "thinking":
        return this._parseThinkingMode(t);
      case "block":
        return this._parseBlockMode(t);
      default:
        return null;
    }
  }
  _parseTextMode(t) {
    const e = t.indexOf("```");
    let s = -1;
    for (const c of this._thinkingDelimiters) {
      const d = t.indexOf(c.start);
      d !== -1 && (s === -1 || d < s) && (s = d);
    }
    let r = -1, i;
    for (const c of this._blocks) {
      const d = this._indexOfTag(t, c.tag);
      d !== -1 && (r === -1 || d < r) && (r = d, i = c);
    }
    const a = [];
    if (e !== -1 && a.push({ type: "code", index: e }), s !== -1 && a.push({ type: "thinking", index: s }), r !== -1 && a.push({ type: "block", index: r }), a.sort((c, d) => c.index - d.index), a.length === 0)
      return t.endsWith("`") || t.endsWith("``") || this._thinkingDelimiters.some((c) => this._isPartialMatch(t, c.start)) || // `<ta`, and also the whole `<tag` with nothing after it yet.
      this._blocks.some((c) => this._isPartialMatch(t, "<" + c.tag) || t.endsWith("<" + c.tag)) ? null : ((!this._state.activeSegment || this._state.activeSegment.type !== "text") && (this._state.activeSegment = this._createTextSegment("")), this._state.activeSegment.content += t, { segment: null, remaining: "" });
    const o = a[0];
    if (o.index > 0) {
      const c = t.slice(0, o.index);
      return !this._state.activeSegment || this._state.activeSegment.type !== "text" ? this._state.activeSegment = this._createTextSegment(c) : this._state.activeSegment.content += c, { segment: null, remaining: t.slice(o.index) };
    }
    let l = null;
    if (this._state.activeSegment && this._state.activeSegment.type === "text" && (l = this._closed(this._state.activeSegment), this._state.activeSegment = null), o.type === "code") {
      const c = this._startCodeBlock(t);
      return c ? { segment: l, remaining: c.remaining } : (l && (this._state.activeSegment = l), null);
    } else if (o.type === "thinking") {
      const c = this._startThinkingBlock(t);
      return c ? { segment: l, remaining: c.remaining } : (l && (this._state.activeSegment = l), null);
    } else {
      const c = this._startBlock(t, i);
      return c ? c.segment && l ? (this._pendingSegment = c.segment, { segment: l, remaining: c.remaining }) : { segment: l ?? c.segment, remaining: c.remaining } : (l && (this._state.activeSegment = l), null);
    }
  }
  _startCodeBlock(t) {
    const e = t.indexOf(`
`);
    if (e === -1)
      return null;
    const r = t.slice(0, e).slice(3).trim() || "markdown";
    return r === "markdown" || r === "md" ? { segment: null, remaining: t.slice(e + 1) } : (this._state.mode = "code", this._state.codeLanguage = r, this._state.activeSegment = this._createCodeSegment(r, ""), this._state.activeSegment.isStreaming = !0, { segment: null, remaining: t.slice(e + 1) });
  }
  _parseCodeMode(t) {
    const e = t.indexOf("\n```");
    if (e === -1) {
      if (t.length > 4) {
        const o = t.slice(0, -4);
        return this._state.activeSegment && "content" in this._state.activeSegment && (this._state.activeSegment.content += o), { segment: null, remaining: t.slice(-4) };
      }
      return null;
    }
    const s = t.slice(0, e);
    this._state.activeSegment && "content" in this._state.activeSegment && (this._state.activeSegment.content += s);
    const r = this._closed(this._state.activeSegment);
    this._state.mode = "text", this._state.activeSegment = null;
    const i = t.slice(e + 4), a = i.startsWith(`
`) ? i.slice(1) : i;
    return { segment: r, remaining: a };
  }
  _startThinkingBlock(t) {
    const e = this._thinkingDelimiters.find((s) => t.startsWith(s.start));
    return e ? (this._state.mode = "thinking", this._state.thinkingEnd = e.end, this._state.activeSegment = this._createThinkingSegment(""), { segment: null, remaining: t.slice(e.start.length) }) : null;
  }
  _parseThinkingMode(t) {
    const e = this._state.thinkingEnd ?? this._thinkingDelimiters[0].end, s = t.indexOf(e);
    if (s === -1) {
      if (this._isPartialMatch(t, e)) {
        const a = this._getPartialMatchLength(t, e), o = t.slice(0, t.length - a);
        return o && this._state.activeSegment && "content" in this._state.activeSegment && (this._state.activeSegment.content += o), o ? { segment: null, remaining: t.slice(-a) } : null;
      }
      if (t.length > e.length) {
        const a = t.slice(0, -e.length);
        return this._state.activeSegment && "content" in this._state.activeSegment && (this._state.activeSegment.content += a), { segment: null, remaining: t.slice(-e.length) };
      }
      return null;
    }
    const r = t.slice(0, s);
    this._state.activeSegment && "content" in this._state.activeSegment && (this._state.activeSegment.content += r);
    const i = this._closed(this._state.activeSegment);
    return this._state.mode = "text", this._state.activeSegment = null, this._state.thinkingEnd = void 0, { segment: i, remaining: t.slice(s + e.length) };
  }
  // ─── registered blocks ──────────────────────────────────────────────────
  /**
   * Where `<tag` opens a block in `buffer`, or -1. A hit needs the name to END
   * there: `<artifacts>` is not `<artifact>`, so the character after the name must
   * be whitespace, `/` or `>`. A `<tag` sitting at the very end of the buffer is
   * undecidable and reported as -1 — the partial-match hold in `_parseTextMode`
   * keeps it for the next chunk.
   */
  _indexOfTag(t, e) {
    const s = "<" + e;
    let r = 0;
    for (; ; ) {
      const i = t.indexOf(s, r);
      if (i === -1) return -1;
      const a = t[i + s.length];
      if (a === void 0) return -1;
      if (a === ">" || a === "/" || /\s/.test(a)) return i;
      r = i + 1;
    }
  }
  /**
   * Where the opening `<tag …>` ends, or -1 while it is still incomplete.
   *
   * The first `>` is not the answer: `<note title="v1 -> v2">` carries one inside
   * a quoted value, and cutting there loses every attribute AND leaks the rest of
   * the tag into the body as raw markup. A quote only OPENS after an `=`, so a
   * stray `"` written in an attribute-less tag cannot hold the buffer open.
   *
   * A quote the model never closes must not hold it open either. `-1` means
   * "wait", and waiting on a value that runs to the end of the reply freezes the
   * stream: nothing is emitted until `finalize()` flushes the whole tail as raw
   * text. These tag conventions are single-line, so a newline reached inside an
   * open value says the quote was a typo — and the tag is then read the way it
   * has always been read, at its first `>`.
   */
  _tagEnd(t, e) {
    let s = null, r = !1, i = -1;
    for (let a = 1 + e.length; a < t.length; a++) {
      const o = t[a];
      if (o === ">" && i === -1 && (i = a), s) {
        if (o === s) s = null;
        else if (o === `
`) return i;
        continue;
      }
      if (o === ">") return a;
      if (o === "=") {
        r = !0;
        continue;
      }
      if (r && (o === '"' || o === "'")) {
        s = o, r = !1;
        continue;
      }
      /\s/.test(o) || (r = !1);
    }
    return -1;
  }
  /**
   * Open a registered block. The buffer starts with `<tag`; the whole opening tag
   * must be present (its `>`) or we wait. Attributes are read as written —
   * `a="x"`, `a='x'`, `a=x` — and a self-closing `<tag …/>` is a block with no
   * body, returned closed at once.
   */
  _startBlock(t, e) {
    const s = this._tagEnd(t, e.tag);
    if (s === -1) return null;
    const r = t.slice(1 + e.tag.length, s), i = r.trimEnd().endsWith("/"), a = i ? r.trimEnd().slice(0, -1) : r, o = /* @__PURE__ */ Object.create(null);
    for (const d of a.matchAll(/([A-Za-z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g))
      o[d[1]] = d[2] ?? d[3] ?? d[4] ?? "";
    const l = e.toSegment({ attrs: o, id: this._options.autoGenerateIds ? this._generateId() : "" });
    l.content = "";
    const c = t.slice(s + 1);
    return i ? { segment: this._closed(l), remaining: c } : (l.isStreaming = !0, this._state.mode = "block", this._state.blockEnd = `</${e.tag}>`, this._state.activeSegment = l, { segment: null, remaining: c });
  }
  /**
   * Stream the body of the open block until its closing tag — the same
   * partial-delimiter handling the thinking mode uses, so a closing
   * tag split across two chunks is never emitted as content.
   */
  _parseBlockMode(t) {
    const e = this._state.blockEnd, s = t.indexOf(e), r = this._state.activeSegment;
    if (s === -1) {
      if (this._isPartialMatch(t, e)) {
        const a = this._getPartialMatchLength(t, e), o = t.slice(0, t.length - a);
        return o && r && (r.content += o), o ? { segment: null, remaining: t.slice(-a) } : null;
      }
      if (t.length > e.length) {
        const a = t.slice(0, -e.length);
        return r && (r.content += a), { segment: null, remaining: t.slice(-e.length) };
      }
      return null;
    }
    r && (r.content += t.slice(0, s));
    const i = this._closed(this._state.activeSegment);
    return this._state.mode = "text", this._state.activeSegment = null, this._state.blockEnd = void 0, { segment: i, remaining: t.slice(s + e.length) };
  }
  _createInitialState() {
    return {
      mode: "text",
      buffer: "",
      segments: [],
      activeSegment: null,
      segmentCounter: 0
    };
  }
  _generateId() {
    return ++this._state.segmentCounter, `${this._options.idPrefix}-${pt()}`;
  }
  /**
   * Mark a segment the parser has just CLOSED.
   *
   * The end of a delimited segment is not a guess: the closing token IS the end.
   * `</think>`, a closing fence, `</artifact>` — and, for a text run, the opening
   * of whatever comes next. The parser computes that moment at six sites and used
   * to drop it, emitting the finished segment with no flag saying so.
   *
   * What that cost: nothing downstream could tell a finished reasoning block from
   * one still streaming, so the only remaining signal was the END OF THE TURN. A
   * reader watched "Thinking" for as long as the answer took to stream — twenty
   * seconds after the model had stopped thinking — and the Markdown flush and the
   * highlight-on-settle waited exactly as long. Two workarounds were written
   * before this one: close at the end of the message (wrong value), and close when
   * the next segment opens (right value, wrong moment, and no help for a reply
   * that is reasoning and nothing else).
   *
   * Both agent loops share this parser, so saying it here says it once.
   *
   * Not every end is in band, and the exceptions are honest: a text run that ends
   * only because the STREAM ended has no delimiter — `finalize()` is its truth —
   * and a `tool_call` never passes through here at all, since its end is its
   * `status`.
   */
  _closed(t) {
    return t && (t.isStreaming = !1), t;
  }
  _createTextSegment(t) {
    return {
      id: this._options.autoGenerateIds ? this._generateId() : "",
      type: "text",
      content: t
    };
  }
  _createCodeSegment(t, e) {
    return {
      id: this._options.autoGenerateIds ? this._generateId() : "",
      type: "code",
      language: t,
      content: e
    };
  }
  _createThinkingSegment(t) {
    return {
      id: this._options.autoGenerateIds ? this._generateId() : "",
      type: "thinking",
      content: t
    };
  }
  _isPartialMatch(t, e) {
    for (let s = 1; s < e.length; s++)
      if (t.endsWith(e.slice(0, s)))
        return !0;
    return !1;
  }
  _getPartialMatchLength(t, e) {
    for (let s = e.length - 1; s >= 1; s--)
      if (t.endsWith(e.slice(0, s)))
        return s;
    return 0;
  }
}
function $u(n, t) {
  const e = new rr(t), s = e.parse(n), r = e.finalize();
  return [...s.segments, ...r];
}
const Nu = /* @__PURE__ */ new Set(["pending", "awaiting-approval"]), Pu = ["content", "output", "result"];
function Du(n) {
  return Pu.some((t) => t in n);
}
function Mi(n, t, e, s) {
  const r = qu(t, s);
  return {
    ...r,
    messageId: t.messageId ?? e,
    index: t.index ?? n.length,
    // A start already present is kept — a segment a consumer rebuilt from their own
    // storage keeps the number it was persisted with. `adoptSegment` is the path
    // that never writes one at all.
    ...zn(r, { startedAt: as(t)?.startedAt ?? Date.now() })
  };
}
function Hu(n, t, e, s = !1) {
  return {
    ...t,
    messageId: e,
    index: n.length,
    isStreaming: !1,
    ...t.type === "tool_call" && (t.status === "awaiting-approval" || t.status === "pending" && !s) && !t.deferred?.ticket ? { status: "aborted" } : {}
  };
}
const Bu = /* @__PURE__ */ new Set(["id", "type", "messageId", "index"]);
function as(n) {
  return n.meta?.aparte;
}
function zn(n, t) {
  return { meta: { ...n.meta, aparte: { ...n.meta?.aparte, ...t } } };
}
function qu(n, t) {
  if (!t) return n;
  const e = { ...n };
  for (const [s, r] of Object.entries(t))
    if (!(Bu.has(s) || s in n)) {
      if (s === "meta") {
        const { aparte: i, ...a } = r ?? {};
        e.meta = a;
        continue;
      }
      e[s] = r;
    }
  return e;
}
function de(n) {
  return n.type === "tool_call" ? !Nu.has(n.status) : n.isStreaming === !1;
}
function Fu(n, t) {
  if (de(n)) return t;
  const e = { ...n, ...t };
  if (de(e)) {
    const s = as(n)?.endedAt;
    return { ...t, ...zn(n, { endedAt: s ?? Date.now() }) };
  }
  return Du(t) ? { ...t, ...zn(n, { endedAt: Date.now() }) } : t;
}
function al(n, t) {
  const e = { ...n, ...t };
  return "meta" in t ? {
    ...e,
    meta: {
      ...n.meta,
      ...t.meta,
      // Neither side's timing wins by accident: whichever one carries it, wins,
      // and a consumer writing `meta` without an `aparte` key keeps ours.
      ...n.meta?.aparte || t.meta?.aparte ? { aparte: { ...n.meta?.aparte, ...t.meta?.aparte } } : {}
    }
  } : e;
}
function Uu(n) {
  const { startedAt: t, endedAt: e } = as(n) ?? {};
  if (!(t == null || e == null))
    return e - t;
}
function Wu(n) {
  return de(n) ? {} : zn(n, { endedAt: Date.now() });
}
function Ss(n) {
  return {
    content: n.content,
    ...n.isStreaming === !1 ? { isStreaming: !1 } : {}
  };
}
function ol(n) {
  return n != null && n !== "streaming" && n !== "pending";
}
function zu(n) {
  return n.filter((t) => !de(t)).map((t) => t.id);
}
function $n(n) {
  if (!n.segments?.length) return { ...n };
  const t = n.status === "streaming" || n.status === "pending";
  return {
    ...n,
    segments: n.segments.reduce((e, s) => (e.push(Hu(e, s, n.id, t)), e), [])
  };
}
function Gu(n) {
  for (let t = 0; t < n.length; t++) {
    const e = n[t];
    e.index !== t && (n[t] = { ...e, index: t });
  }
}
const Gn = "data-aparte-host", jn = Symbol.for("aparte.instanceConfig");
function ju(n, t, e) {
  if (t === e) return;
  const s = (r) => {
    const i = r.aparteConfigChanged;
    typeof i == "function" && i.call(r, t, e);
  };
  s(n);
  for (const r of n.querySelectorAll("*")) s(r);
}
function ll(n, t) {
  const e = n[jn] ?? $(n.parentElement);
  n[jn] = t, n.setAttribute(Gn, ""), ju(n, t, e);
}
function $(n) {
  const t = `[${Gn}]`;
  let e = n?.closest?.(t);
  for (; e && !e[jn]; ) e = e.parentElement?.closest(t);
  return e?.[jn] ?? _t;
}
let Nn = null;
function gt(n, t) {
  const e = Nn;
  Nn = n;
  try {
    return t();
  } finally {
    Nn = e;
  }
}
function M(n) {
  return Nn ?? $(n);
}
function kt(n, t, e, s) {
  const r = s ?? (n.id || void 0), i = e && typeof e == "object" ? { targetId: r, ...e } : e;
  n.dispatchEvent(new CustomEvent(t, { bubbles: !0, composed: !0, detail: i }));
}
function q(n) {
  let t = "";
  for (let e = 0; e < n.length; e++) {
    const s = n[e];
    s === "&" ? t += "&amp;" : s === "<" ? t += "&lt;" : s === ">" ? t += "&gt;" : s === '"' ? t += "&quot;" : s === "'" ? t += "&#039;" : t += s;
  }
  return t;
}
const D = q, nn = "aparte-code-drawing", cl = "aparte-code-pending", Oi = "data-aparte-open", dl = "data-aparte-drawn", Ku = 4 * 1024 * 1024;
class Vu {
  entries = /* @__PURE__ */ new Map();
  size = 0;
  get(t) {
    const e = this.entries.get(t);
    return e && (this.entries.delete(t), this.entries.set(t, e)), e;
  }
  set(t, e) {
    const s = this.entries.get(t);
    s && (this.size -= As(t, s), this.entries.delete(t));
    const r = { html: e };
    this.entries.set(t, r), this.size += As(t, r);
    for (const [i, a] of this.entries) {
      if (this.size <= Ku || i === t) break;
      this.entries.delete(i), this.size -= As(i, a);
    }
    return r;
  }
}
const As = (n, t) => n.length + (t.html?.length ?? 0), Ht = /* @__PURE__ */ new WeakMap(), Ur = /* @__PURE__ */ new WeakMap(), $i = /* @__PURE__ */ new WeakMap(), Ni = /* @__PURE__ */ new WeakMap(), Pi = /* @__PURE__ */ new WeakMap(), ul = /* @__PURE__ */ new WeakMap(), hl = /* @__PURE__ */ new WeakMap(), pl = /* @__PURE__ */ new WeakMap(), Di = /* @__PURE__ */ new WeakSet(), Hi = /* @__PURE__ */ new WeakSet(), ks = /* @__PURE__ */ new WeakMap(), Bi = /* @__PURE__ */ new WeakMap(), Sn = /* @__PURE__ */ new WeakMap();
function Xu(n) {
  let t = $i.get(n);
  return t || (t = new Vu(), $i.set(n, t)), t;
}
function Yu(n) {
  let t = Ni.get(n);
  return t || (t = /* @__PURE__ */ new Map(), Ni.set(n, t)), t;
}
function qi(n, t) {
  let e = n.get(t);
  return e || (e = /* @__PURE__ */ new Map(), n.set(t, e)), e;
}
function sn(n, t) {
  Di.has(n) || (Di.add(n), console.warn(`[aparte] The ${n.languages.join("/")} renderer failed; the source is shown instead.`, t));
}
function Qu(n) {
  for (const t of Array.from(n.classList))
    if (t.startsWith("language-")) return t.slice(9).toLowerCase() || null;
  return null;
}
function Zu(n) {
  return n.classList.contains("math-display") ? !0 : n.classList.contains("math-inline") ? !1 : n.parentElement?.tagName === "PRE";
}
function Ju(n) {
  return n.hasAttribute(Oi) || n.parentElement?.tagName === "PRE" && n.parentElement.hasAttribute(Oi);
}
function th(n, t) {
  let e = "";
  try {
    e = n.cacheKey?.(t) ?? "";
  } catch (s) {
    sn(n, s);
  }
  return `${t.language}${t.display ? "d" : "i"}${e}${t.source}`;
}
function fl(n) {
  return typeof n?.then == "function";
}
function eh(n) {
  return n.closest("pre") ?? Ht.get(n)?.drawing ?? n;
}
function nh(n) {
  return n.closest("pre") ?? n.parentElement ?? n;
}
const Es = /* @__PURE__ */ new Set(), Cs = /* @__PURE__ */ new Map();
let xs = !1;
function os(n, t) {
  t ? Cs.set(n, t) : Es.add(n), !xs && (xs = !0, queueMicrotask(() => {
    xs = !1;
    const e = [...Es], s = [...Cs];
    Es.clear(), Cs.clear();
    for (const r of e) rh(r);
    for (const [r, i] of s) r.isConnected && Me(r, i);
  }));
}
const Fi = /* @__PURE__ */ new WeakMap();
function sh(n, t, e) {
  let s = Fi.get(n);
  if (!s) {
    const r = /* @__PURE__ */ new Map();
    Fi.set(n, r), s = r, n.then(
      () => {
        for (const [i, a] of r) os(i, a);
        r.clear();
      },
      () => r.clear()
    );
  }
  (!s.has(t) || e === void 0) && s.set(t, e);
}
let ie = null;
function gl(n) {
  for (let t = n.parentElement; t; t = t.parentElement) {
    const e = getComputedStyle(t).overflowY;
    if (e === "auto" || e === "scroll") return t;
  }
  return null;
}
function rh(n) {
  if (!n.isConnected) return;
  const t = gl(n), e = t ? t.getBoundingClientRect().top + (parseFloat(getComputedStyle(t).scrollPaddingTop) || 0) : 0;
  ie = { scroller: t, top: e };
  try {
    Me(n, pl.get(n) ?? {});
  } finally {
    ie = null;
  }
}
function ih(n, t) {
  const e = eh(n);
  if (Hi.has(e) || typeof IntersectionObserver > "u") return !1;
  const s = gl(e);
  let r = Bi.get(IntersectionObserver);
  r || (r = { byScroller: /* @__PURE__ */ new WeakMap() }, Bi.set(IntersectionObserver, r));
  let i = s ? r.byScroller.get(s) : r.page;
  if (!i) {
    const a = new IntersectionObserver((o) => {
      for (const l of o) {
        const c = l.target;
        if (c.isConnected && !l.isIntersecting) continue;
        a.unobserve(c);
        const d = (Sn.get(a) ?? 1) - 1;
        if (Sn.set(a, d), d <= 0 && (a.disconnect(), s ? r.byScroller.delete(s) : r.page === a && (r.page = void 0)), !c.isConnected) continue;
        Hi.add(c);
        const h = ks.get(c);
        h && os(h);
      }
    }, { root: s, rootMargin: "100% 0px" });
    i = a, s ? r.byScroller.set(s, a) : r.page = a;
  }
  return ks.get(e) !== t && (ks.set(e, t), Sn.set(i, (Sn.get(i) ?? 0) + 1), i.observe(e)), !0;
}
function Qe(n, t, e, s, r, i, a = !0) {
  if (e.html === null) {
    Re(t, r.open);
    return;
  }
  const o = ie ? nh(t) : null, l = o ? o.getBoundingClientRect() : null, c = Ht.get(t);
  let d = c?.drawing;
  if (d || (d = document.createElement("span"), d.className = nn, r.display && d.setAttribute("data-aparte-display", ""), s.bare ? d.setAttribute("data-aparte-bare", "") : d.setAttribute("dir", "ltr"), t.after(d), Ur.set(d, t), t.parentElement?.tagName === "PRE" && t.parentElement.setAttribute(dl, "")), c?.entry !== e || d.childNodes.length === 0) {
    let h = a ? Pi.get(n) : void 0;
    a && !h && (h = /* @__PURE__ */ new WeakMap(), Pi.set(n, h));
    const u = h?.get(e);
    if (u && u.owner !== t && !u.owner.isConnected && t.isConnected && !u.drawing.isConnected && u.drawing.childNodes.length > 0)
      d.replaceChildren(...u.drawing.childNodes), u.drawing.remove(), Re(u.owner, !1);
    else {
      d.innerHTML = e.html;
      try {
        s.relabel?.(d, r);
      } catch (f) {
        sn(s, f);
      }
    }
    h && (c && c.entry !== e && h.get(c.entry)?.drawing === d && h.delete(c.entry), h.set(e, { drawing: d, owner: t }));
  }
  if (t.hidden = !0, t.style.setProperty("display", "none"), t.classList.remove(cl), Ht.set(t, { renderer: s, key: i, drawing: d, entry: e, ctx: r }), o && l && ie) {
    const h = o.getBoundingClientRect().height - l.height;
    h > 0 && l.bottom <= ie.top && (ie.scroller ? ie.scroller.scrollTop += h : window.scrollBy(0, h));
  }
}
function Re(n, t) {
  const e = Ht.get(n);
  e && (e.drawing.remove(), Ht.delete(n)), n.parentElement?.tagName === "PRE" && n.parentElement.removeAttribute(dl), n.hidden = !1, n.style.removeProperty("display"), n.classList.toggle(cl, t);
}
function ah(n, t, e, s, r, i) {
  const a = th(e, s);
  let o = Ht.get(t);
  if (o && o.renderer === e && o.key === a && o.drawing.childNodes.length > 0) return;
  const l = Xu(e), c = l.get(a);
  if (c) {
    Qe(n, t, c, e, s, a, !i);
    return;
  }
  if (!o && !i) {
    const f = ul.get(n)?.get(r);
    f && s.source.startsWith(f.source) && Qe(n, t, f, e, s, null), o = Ht.get(t);
  }
  if (e.lazy && !i && !o && ih(t, n)) return;
  const d = Yu(e), h = d.get(a);
  if (h) {
    sh(h, n, i);
    return;
  }
  let u;
  try {
    u = e.render(s);
  } catch (f) {
    sn(e, f), u = null;
  }
  if (!fl(u)) {
    Qe(n, t, l.set(a, u ?? null), e, s, a, !i);
    return;
  }
  const p = u.then((f) => (d.delete(a), l.set(a, f ?? null), f), (f) => {
    throw d.delete(a), sn(e, f), f;
  });
  d.set(a, p), p.then(() => os(n, i), () => {
  });
}
function oh(n, t, e, s, r) {
  const i = qi(ul, n), a = i.get(r);
  a && s.source.startsWith(a.source) ? Ht.get(t)?.entry !== a && Qe(n, t, a, e, s, null) : (i.delete(r), Re(t, !0));
  const o = qi(hl, n);
  if (o.get(r) === s.source) return;
  o.set(r, s.source);
  const l = () => {
    o.get(r) === s.source && o.delete(r);
  }, c = (h) => {
    if (h == null) return !1;
    const u = i.get(r);
    return u && !s.source.startsWith(u.source) ? !1 : (i.set(r, { source: s.source, html: h }), !0);
  };
  let d;
  try {
    d = e.render(s);
  } catch {
    d = null;
  }
  if (!fl(d)) {
    c(d) ? Qe(n, t, i.get(r), e, s, null) : d == null && l();
    return;
  }
  d.then((h) => {
    c(h) ? os(n) : h == null && l();
  }, l);
}
function lh(n) {
  for (const t of ["code", "kbd", "samp"])
    for (const e of Array.from(n.getElementsByTagName(t))) e.hasAttribute("dir") || e.setAttribute("dir", "ltr");
}
function Me(n, t = {}) {
  if (typeof document > "u") return;
  const { streaming: e = !1, refresh: s = !1, language: r } = t;
  if (!s && (lh(n), pl.set(n, { streaming: e }), e || hl.delete(n), !M(n).hasCodeLanguageRenderer())) {
    n.querySelector(`.${nn}`) && _l(n);
    return;
  }
  const i = Array.from(n.querySelectorAll('code[class*="language-"]')).filter((o) => !o.closest(`.${nn}`)), a = /* @__PURE__ */ new Map();
  i.forEach((o, l) => {
    const c = Qu(o);
    if (!c || r && c !== r) return;
    const d = M(s ? o : n), h = d.getCodeLanguageRenderer(c), u = Ht.get(o);
    if (s && (!u || u.key === null)) return;
    if (!h) {
      u && Re(o, !1);
      return;
    }
    const p = Zu(o), f = `${c}|${p ? "d" : "i"}`, _ = a.get(f) ?? 0;
    a.set(f, _ + 1);
    const g = `${f}|${_}`, v = o.textContent ?? "";
    if (!v.trim()) {
      u && Re(o, !1);
      return;
    }
    const S = e && (Ju(o) || l === i.length - 1), A = { language: c, source: v, display: p, open: S, host: o, config: d };
    S ? oh(n, o, h, A, g) : ah(n, o, h, A, g, s ? t : void 0);
  });
}
function _l(n) {
  for (const t of Array.from(n.querySelectorAll(`.${nn}`))) {
    const e = Ur.get(t);
    e ? Re(e, !1) : t.remove();
  }
}
function ch(n) {
  for (const t of Array.from(n.querySelectorAll(`.${nn}`))) {
    const e = Ur.get(t), s = e ? Ht.get(e) : void 0;
    if (s)
      try {
        s.renderer.relabel?.(t, s.ctx);
      } catch (r) {
        sn(s.renderer, r);
      }
  }
}
function ir(n, t) {
  return !!n && M(t).hasCodeLanguageRenderer(n);
}
const ml = /* @__PURE__ */ new Set([
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "form",
  "button",
  "textarea",
  "select",
  "option",
  "optgroup",
  "link",
  "meta",
  "base",
  "title",
  "head",
  "html",
  "body",
  "template",
  "noscript",
  "svg",
  "math",
  "portal"
]), Wr = /* @__PURE__ */ new Set([
  "a",
  "p",
  "br",
  "hr",
  "div",
  "span",
  "pre",
  "code",
  "kbd",
  "samp",
  "var",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "del",
  "ins",
  "mark",
  "small",
  "sub",
  "sup",
  "blockquote",
  "q",
  "cite",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "colgroup",
  "col",
  "img",
  "figure",
  "figcaption",
  "picture",
  "source",
  "input",
  // GFM task-list checkboxes only — `sanitizeChildren` drops every other `type`, and disables these
  "abbr",
  "details",
  "summary",
  "time",
  "wbr",
  "address"
]), dh = /* @__PURE__ */ new Set([
  // `id`/`name` are intentionally NOT allowlisted — they enable DOM clobbering
  // and LLM-authored markup has no legitimate need for author-controlled ids.
  "class",
  "style",
  "title",
  "dir",
  "lang",
  "role",
  "align",
  "aria-label",
  "aria-hidden",
  "aria-describedby",
  "aria-level"
]), uh = {
  // `target` and `rel` are NOT copied from the model's markup — `copyAttributes`
  // decides both below. Legacy `name` is dropped too (obsolete + a DOM-clobbering
  // vector).
  a: /* @__PURE__ */ new Set(["href"]),
  img: /* @__PURE__ */ new Set(["src", "alt", "width", "height", "loading", "srcset", "sizes", "decoding"]),
  source: /* @__PURE__ */ new Set(["src", "srcset", "type", "media", "sizes"]),
  input: /* @__PURE__ */ new Set(["type", "checked", "disabled"]),
  td: /* @__PURE__ */ new Set(["colspan", "rowspan", "headers"]),
  th: /* @__PURE__ */ new Set(["colspan", "rowspan", "scope", "headers"]),
  col: /* @__PURE__ */ new Set(["span", "width"]),
  colgroup: /* @__PURE__ */ new Set(["span"]),
  ol: /* @__PURE__ */ new Set(["start", "type", "reversed"]),
  time: /* @__PURE__ */ new Set(["datetime"]),
  details: /* @__PURE__ */ new Set(["open"])
}, hh = /* @__PURE__ */ new Set(["href", "src"]), ph = /^(?:https?:|mailto:|tel:|ftp:|sms:)/i, fh = /^(?:[#/.?]|[a-z0-9._~%+-]+(?:[/?#]|$))/i, gh = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon|svg\+xml)[;,]/i, bl = /[\u0000-\u0020]+/g, Ui = /^(?:https?:)?[/\\]{2}|^https?:/i, _h = /^aparte-/i, mh = /* @__PURE__ */ new Set([
  "data-aparte-chat",
  "data-aparte-host",
  "data-aparte-theme",
  "data-aparte-split-pane",
  "data-aparte-launcher-close",
  "data-aparte-launcher-maximize",
  "data-aparte-suggestions",
  "data-aparte-bubble",
  "data-aparte-empty",
  "data-aparte-panel",
  "data-aparte-panel-host",
  "data-aparte-card-part",
  "data-segment-id",
  "data-action"
]), bh = ["data-aparte-dialog-", "data-aparte-sidebar-", "data-checkpoint-"];
function vh(n) {
  return mh.has(n) || bh.some((t) => n.startsWith(t));
}
const yh = /* @__PURE__ */ new Set([
  "button",
  "link",
  "checkbox",
  "textbox",
  "searchbox",
  "combobox",
  "switch",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "slider",
  "spinbutton",
  "scrollbar",
  "treeitem",
  "gridcell",
  "listbox",
  "menu",
  "menubar",
  "radiogroup",
  "tablist",
  "tree",
  "treegrid",
  "grid",
  "dialog",
  "alertdialog",
  "application",
  "toolbar",
  "progressbar",
  "tabpanel"
]);
function wh(n, t) {
  const e = t === "source" ? "img" : t;
  for (const s of n.matchAll(/(?:^|[^a-z0-9+.-])([a-z][a-z0-9+.-]*:[^\s,]*)/gi))
    if (!ls(s[1], e)) return !1;
  return !0;
}
function ls(n, t) {
  const e = n.replace(bl, "");
  return !e || ph.test(e) || t === "img" && gh.test(e) ? !0 : /^[a-z][a-z0-9+.-]*:/i.test(e) ? !1 : fh.test(e);
}
const Sh = /* @__PURE__ */ new Set([
  "color",
  "background-color",
  "font-style",
  "font-weight",
  "font-family",
  "font-size",
  "font-variant",
  "font-variant-ligatures",
  "text-decoration",
  "text-decoration-line",
  "text-decoration-color",
  "text-decoration-style",
  "white-space"
]);
function Ah(n) {
  return n.includes("\\") ? !1 : n.startsWith("--") && !n.startsWith("--aparte-");
}
function kh(n) {
  const t = [];
  for (const e of n.split(";")) {
    const s = e.trim(), r = s.indexOf(":");
    if (r === -1) continue;
    const i = s.slice(0, r).trim().toLowerCase(), a = s.slice(r + 1);
    a.trim() && (!Sh.has(i) && !Ah(i) || a.includes("\\") || /url\s*\(|expression\s*\(|javascript:|vbscript:|[<>]/i.test(a) || t.push(s));
  }
  return t.length ? t.join("; ") : null;
}
function ar(n, t, e) {
  const s = uh[n];
  if (t.startsWith("on") || t.startsWith("formaction") || !t.startsWith("data-") && !dh.has(t) && !(s && s.has(t)) || vh(t) || t === "role" && e.trim().toLowerCase().split(/\s+/).some((r) => yh.has(r)) || hh.has(t) && !ls(e, n) || t === "srcset" && !wh(e, n)) return null;
  if (t === "style") return kh(e);
  if (t === "class") {
    const r = e.split(/\s+/).filter((i) => i && !_h.test(i));
    return r.length ? r.join(" ") : null;
  }
  return e;
}
function vl(n, t) {
  const e = n.replace(bl, ""), s = t.trim().toLowerCase();
  return s === "_self" && !Ui.test(e) ? [["target", "_self"]] : s || Ui.test(e) ? [["target", "_blank"], ["rel", "noopener noreferrer"]] : [];
}
function Eh(n, t, e) {
  for (const s of Array.from(n.attributes)) {
    const r = s.name.toLowerCase(), i = ar(e, r, s.value);
    i !== null && t.setAttribute(r, i);
  }
  if (e === "a")
    for (const [s, r] of vl(t.getAttribute("href") ?? "", n.getAttribute("target") ?? "")) t.setAttribute(s, r);
}
function or(n, t, e) {
  for (const s of Array.from(n.childNodes)) {
    if (s.nodeType === 3) {
      t.appendChild(e.createTextNode(s.nodeValue ?? ""));
      continue;
    }
    if (s.nodeType !== 1) continue;
    const r = s, i = r.tagName.toLowerCase();
    if (ml.has(i)) continue;
    if (!Wr.has(i)) {
      or(r, t, e);
      continue;
    }
    const a = i === "input";
    if (a && (r.getAttribute("type") ?? "").trim().toLowerCase() !== "checkbox") continue;
    const o = e.createElement(i);
    Eh(r, o, i), a && (o.setAttribute("type", "checkbox"), o.setAttribute("disabled", "")), or(r, o, e), t.appendChild(o);
  }
}
const Ch = /* @__PURE__ */ new Set(["html", "head", "body"]), xh = /* @__PURE__ */ new Set(["link", "meta", "base", "embed", "frame"]), Wi = /* @__PURE__ */ new Map();
function Th(n) {
  let t = Wi.get(n);
  return t || (t = new RegExp(`<\\s*\\/\\s*${n}\\s*>`, "gi"), Wi.set(n, t)), t;
}
const zi = /--!?>/g, Ih = /[A-Za-z]/, An = /\s/, Rh = /[\s/>]/, Lh = /[\s/>=]/, Mh = /^[a-z][a-z0-9_.:-]*$/, Oh = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  colon: ":",
  lpar: "(",
  rpar: ")",
  sol: "/",
  bsol: "\\",
  period: ".",
  comma: ",",
  semi: ";",
  num: "#",
  excl: "!",
  quest: "?",
  tab: "	",
  newline: `
`
};
function $h(n) {
  return n.includes("&") ? n.replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|([a-z]+));?/gi, (t, e, s, r) => {
    if (r !== void 0) return Oh[r.toLowerCase()] ?? t;
    const i = e !== void 0 ? parseInt(e, 16) : parseInt(s ?? "", 10);
    return i > 0 && i <= 1114111 && (i < 55296 || i > 57343) ? String.fromCodePoint(i) : "�";
  }) : n;
}
const Nh = (n) => n.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function Ph(n, t) {
  if (!Wr.has(n)) return "";
  const e = n === "input", s = (i) => t.find(([a]) => a === i)?.[1];
  if (e && (s("type") ?? "").trim().toLowerCase() !== "checkbox") return "";
  const r = [];
  e && (r.push('type="checkbox"'), s("checked") !== void 0 && r.push("checked"), r.push("disabled"));
  for (const [i, a] of t) {
    if (!Mh.test(i) || e && (i === "type" || i === "checked" || i === "disabled")) continue;
    const o = ar(n, i, a);
    o !== null && r.push(`${i}="${Nh(o)}"`);
  }
  if (n === "a") {
    const i = t.find(([o]) => o === "href"), a = i ? ar("a", "href", i[1]) : null;
    for (const [o, l] of vl(a ?? "", s("target") ?? "")) r.push(`${o}="${l}"`);
  }
  return `<${n}${r.length ? " " + r.join(" ") : ""}>`;
}
function yl(n, t) {
  const e = n.length;
  let s = t;
  for (; s < e && !Rh.test(n[s]); ) s++;
  const r = n.slice(t, s).toLowerCase(), i = [], a = /* @__PURE__ */ new Set();
  for (; s < e; ) {
    for (; s < e && (An.test(n[s]) || n[s] === "/"); ) s++;
    if (s >= e) break;
    if (n[s] === ">") return { tag: r, attrs: i, end: s + 1 };
    const o = s++;
    for (; s < e && !Lh.test(n[s]); ) s++;
    const l = n.slice(o, s).toLowerCase();
    let c = s;
    for (; c < e && An.test(n[c]); ) c++;
    let d = "";
    if (n[c] === "=") {
      for (c++; c < e && An.test(n[c]); ) c++;
      const h = n[c];
      if (h === '"' || h === "'") {
        const u = n.indexOf(h, c + 1);
        if (u < 0) break;
        d = n.slice(c + 1, u), s = u + 1;
      } else {
        const u = c;
        for (; c < e && !An.test(n[c]) && n[c] !== ">"; ) c++;
        d = n.slice(u, c), s = c;
      }
    }
    a.has(l) || (a.add(l), i.push([l, $h(d)]));
  }
  return { tag: r, attrs: i, end: -1 };
}
function Dh(n) {
  const t = n.length;
  let e = "", s = 0;
  for (; s < t; ) {
    const r = n.indexOf("<", s);
    if (r < 0) {
      e += n.slice(s);
      break;
    }
    if (e += n.slice(s, r), n.startsWith("<!--", r)) {
      const d = r + 4;
      if (n[d] === ">") s = d + 1;
      else if (n.startsWith("->", d)) s = d + 2;
      else {
        zi.lastIndex = d;
        const h = zi.exec(n);
        if (!h) break;
        s = h.index + h[0].length;
      }
      continue;
    }
    const i = n[r + 1] === "/", a = r + (i ? 2 : 1);
    if (!Ih.test(n[a] ?? "")) {
      if (n[r + 1] === "!" || n[r + 1] === "?" || i) {
        const d = n.indexOf(">", r + 1);
        s = d < 0 ? t : d + 1;
      } else
        e += "&lt;", s = r + 1;
      continue;
    }
    const { tag: o, attrs: l, end: c } = yl(n, a);
    if (c < 0) break;
    if (s = c, i)
      Wr.has(o) && (e += `</${o}>`);
    else if (ml.has(o) && !Ch.has(o) && !xh.has(o)) {
      const d = Th(o);
      d.lastIndex = c;
      const h = d.exec(n);
      if (!h) break;
      s = h.index + h[0].length;
    } else e += Ph(o, l);
  }
  return e;
}
function Gi(n) {
  return Dh(n);
}
const ji = (n) => {
  if (!n) return n;
  if (typeof DOMParser > "u") return Gi(n);
  let t;
  try {
    t = new DOMParser().parseFromString(n, "text/html");
  } catch {
    return Gi(n);
  }
  const e = t.createElement("div");
  return or(t.body, e, t), e.innerHTML;
}, Gt = "aparte-citation", wl = "aparte-citation-marker", Sl = /[\p{L}\p{N}]/u, Hh = [24, 12, 6], Al = /* @__PURE__ */ new Set(["A", "ABBR", "B", "CITE", "CODE", "DEL", "EM", "I", "INS", "KBD", "MARK", "Q", "S", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "U"]), Ki = /[.,;:!?)\]}»"'’”…。、，．！？：；」』）】》،؛؟]/, Bh = /[\u00a0\u202f]/, zr = /* @__PURE__ */ new WeakMap(), kl = /* @__PURE__ */ new WeakMap(), Vi = /* @__PURE__ */ new WeakSet(), Pn = /* @__PURE__ */ new WeakMap();
let Xt = null;
function Gr(n) {
  const t = n.url?.trim();
  return t && /^https?:\/\//i.test(t) && ls(t, "a") ? t : void 0;
}
function Kn(n) {
  const t = Gr(n);
  if (t)
    try {
      return new URL(t).hostname.replace(/^www\./, "");
    } catch {
    }
  return n.title ?? "";
}
function qh(n) {
  const t = Kn(n[0]) || "?";
  return n.length > 1 ? `${t} +${n.length - 1}` : t;
}
function lr(n, t) {
  const e = n.getLocale();
  return t === 1 ? e.sourcesOne ?? "1 source" : (e.sourcesCount ?? "{n} sources").replace("{n}", () => String(t));
}
function Fh(n) {
  if (typeof document > "u") return "";
  const t = document.createElement("textarea");
  return t.innerHTML = n, t.value;
}
function Xi(n) {
  return n.replace(/^[ \t]*(?:>[ \t]*)*(?:\d{1,9}[.)]|[*+-])[ \t]+(?:\[[ xX]\][ \t]+)?/gm, "").replace(/<!--[\s\S]*?-->/g, "").replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, "").replace(/<([a-z][a-z0-9+.-]*:[^>\s]+)>/gi, "$1").replace(/\]\([^)\n]*\)/g, "]").replace(/<\/?[A-Za-z][^>\n]*>/g, "").replace(/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, Fh);
}
function Uh(n) {
  const t = n.replace(/^ {0,3}(?:`{3,}|~{3,})[^\n]*$/gm, "");
  let e = "", s = 0;
  for (const i of t.matchAll(/(`+)([^`][\s\S]*?)\1/g))
    e += Xi(t.slice(s, i.index)) + i[2], s = (i.index ?? 0) + i[0].length;
  e += Xi(t.slice(s));
  let r = "";
  for (const i of e) Sl.test(i) && (r += i);
  return r;
}
function Wh(n) {
  let t = "";
  const e = [], s = n.ownerDocument.createTreeWalker(n, NodeFilter.SHOW_TEXT, {
    // A drawing (a formula, a diagram) shows its source differently; its placeholder, hidden
    // beside it, still holds the source as written.
    acceptNode: (r) => r.parentElement?.closest(`.aparte-code-drawing, .${Gt}`) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  for (let r = s.nextNode(); r; r = s.nextNode()) {
    const i = r.data;
    for (let a = 0; a < i.length; ) {
      const o = (i.codePointAt(a) ?? 0) > 65535 ? 2 : 1, l = i.slice(a, a + o);
      if (a += o, !!Sl.test(l)) {
        t += l;
        for (let c = 0; c < o; c++) e.push([r, a]);
      }
    }
  }
  return { text: t, ends: e };
}
function zh(n, t) {
  let e = 0;
  for (let s = n.indexOf(t); s >= 0; s = n.indexOf(t, s + 1)) e++;
  return e;
}
function Gh(n, t, e) {
  const s = Uh(n.slice(0, Math.max(0, Math.min(n.length, t.end))));
  if (!s) return null;
  for (const r of Hh) {
    const i = s.slice(-r), a = zh(s, i);
    let o = -1;
    for (let l = 0; l < a && (l === 0 || o >= 0); l++) o = e.text.indexOf(i, o + 1);
    if (o >= 0) return e.ends[o + i.length - 1] ?? null;
    if (i.length === s.length) break;
  }
  return null;
}
function Yi(n, t) {
  let e = t;
  for (; e < n.length && (Ki.test(n[e]) || Bh.test(n[e]) && Ki.test(n[e + 1] ?? "")); ) e++;
  return e - t;
}
function jh(n, t, e, s) {
  const r = e.parentElement?.closest("pre");
  if (r && n.contains(r)) {
    r.after(t);
    return;
  }
  let i = null;
  for (let l = e.parentElement; l && l !== n && Al.has(l.tagName); l = l.parentElement) i = l;
  if (!i) {
    e.splitText(s + Yi(e.data, s)), e.after(t);
    return;
  }
  let a = i;
  for (; a.nextSibling instanceof Element && a.nextSibling.classList.contains("aparte-code-drawing"); ) a = a.nextSibling;
  const o = a.nextSibling;
  if (o instanceof Text) {
    const l = Yi(o.data, 0);
    l > 0 && (o.splitText(l), a = o);
  }
  a.parentNode.insertBefore(t, a.nextSibling);
}
function Kh(n, t, e, s) {
  const r = (l) => {
    const c = document.createElement("span");
    c.className = wl, c.hidden = !0, l.parentNode.insertBefore(c, l), c.append(l), c.after(n);
  }, i = t.data.lastIndexOf(s, e);
  if (i >= 0 && i + s.length >= e) {
    const l = t.splitText(i);
    return l.splitText(s.length), r(l), !0;
  }
  const a = t.parentElement, o = s.replace(/^\[|\]$/g, "");
  return a && Al.has(a.tagName) && a.textContent?.trim() === o ? (r(a), !0) : !1;
}
function Vh(n, t) {
  const e = document.createElement("button");
  return e.type = "button", e.className = "aparte-citation aparte-tag aparte-tag--sm", e.setAttribute("aria-haspopup", "dialog"), e.setAttribute("aria-expanded", "false"), zr.set(e, n), El(e, t), e;
}
function El(n, t) {
  const e = zr.get(n) ?? [], s = qh(e);
  n.dataset.label = s, n.setAttribute("aria-label", `${s}, ${lr(t, e.length)}`);
}
function Cl(n) {
  const t = /* @__PURE__ */ new Set();
  for (const e of Array.from(n.querySelectorAll(`.${Gt}`)))
    e.parentNode && t.add(e.parentNode), e.remove();
  for (const e of Array.from(n.querySelectorAll(`.${wl}`)))
    e.parentNode && t.add(e.parentNode), e.replaceWith(...Array.from(e.childNodes));
  for (const e of t) e.normalize();
  Pn.delete(n);
}
function Qi(n, t) {
  if (typeof document > "u") return;
  const e = t.citations ?? [], s = new Map((t.sources ?? []).map((_) => [_.id, _])), r = JSON.stringify([t.content, e, [...s.values()].map((_) => [_.id, _.url, _.title, _.snippet])]), i = Array.from(n.querySelectorAll(`.${Gt}`)), a = Pn.get(n);
  if (a && a.signature === r && a.count === i.length) return;
  const o = document.activeElement, l = Xt?.root === n && (o === Xt.chip || (!o || o === document.body) && !Xt.chip.isConnected) ? Xt.at : -1, c = X?.root === n ? X.chip.isConnected ? i.indexOf(X.chip) : X.at : -1;
  if (Cl(n), e.length === 0 || s.size === 0) {
    Pn.set(n, { signature: r, count: 0 }), c >= 0 && Lt(!1);
    return;
  }
  const d = M(n);
  Vi.has(n) || (Vi.add(n), n.addEventListener("click", (_) => {
    const g = _.target?.closest?.(`.${Gt}`);
    !g || !n.contains(g) || (_.preventDefault(), Qh(g));
  }), n.addEventListener("focusin", (_) => {
    const g = _.target;
    g.classList?.contains(Gt) && (Xt = { root: n, chip: g, at: Array.from(n.querySelectorAll(`.${Gt}`)).indexOf(g) });
  }), n.addEventListener("focusout", (_) => {
    Xt?.root === n && _.relatedTarget && (Xt = null);
  }));
  const h = Wh(n), u = /* @__PURE__ */ new Map();
  for (const _ of e) {
    const g = _.sources.map((b) => s.get(b)).filter((b) => !!b);
    if (g.length === 0) continue;
    const v = Gh(t.content, _, h);
    if (!v) continue;
    const S = h.ends.indexOf(v), A = _.marker && _.start !== void 0 ? t.content.slice(_.start, _.end) : null, C = u.get(S) ?? { node: v[0], offset: v[1], marker: A, sources: [] };
    for (const b of g) C.sources.includes(b) || C.sources.push(b);
    u.set(S, C);
  }
  const p = [...u.values()].sort((_, g) => _.node === g.node ? g.offset - _.offset : _.node.compareDocumentPosition(g.node) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1);
  for (const _ of p) {
    const g = Vh(_.sources, d);
    kl.set(g, n), !(_.marker && Kh(g, _.node, _.offset, _.marker)) && jh(n, g, _.node, _.offset);
  }
  const f = Array.from(n.querySelectorAll(`.${Gt}`));
  if (Pn.set(n, { signature: r, count: f.length }), l >= 0 && (f[l] ? f[l].focus({ preventScroll: !0 }) : Xt = null), c >= 0 && X) {
    const _ = f[c];
    _ ? (X.chip = _, X.at = c, _.setAttribute("aria-expanded", "true"), _.setAttribute("aria-controls", X.el.id)) : Lt(!1);
  }
}
function Xh(n) {
  const t = M(n);
  for (const e of Array.from(n.querySelectorAll(`.${Gt}`))) El(e, t);
}
let X = null, Yh = 0;
function Qh(n) {
  X?.chip === n ? Lt(!0) : Zh(n);
}
function Zh(n) {
  Lt(!1);
  const t = zr.get(n) ?? [];
  if (t.length === 0) return;
  const e = kl.get(n) ?? n.parentElement, s = Array.from(e.querySelectorAll(`.${Gt}`)).indexOf(n), r = M(n), i = document.createElement("div");
  i.className = "aparte-citation-card aparte-popover", i.id = `aparte-citation-card-${++Yh}`;
  const a = n.closest(".aparte-viewport-container, aparte-chat-viewport") ?? n.ownerDocument.documentElement;
  i.dir = getComputedStyle(a).direction === "rtl" ? "rtl" : "ltr", i.setAttribute("role", "dialog"), i.setAttribute("aria-label", r.getLocale().sourcesCard ?? "Sources");
  const o = document.createElement("div");
  o.className = "aparte-citation-card__body";
  const l = document.createElement("p");
  l.className = "aparte-sr-only", l.setAttribute("role", "status"), i.append(o, l);
  const c = typeof i.showPopover == "function";
  c && (i.popover = "manual"), (n.closest("aparte-chat-viewport")?.parentElement ?? n.ownerDocument.body).append(i), c && i.showPopover(), n.setAttribute("aria-expanded", "true"), n.setAttribute("aria-controls", i.id);
  const d = typeof MutationObserver == "function" ? new MutationObserver(tp) : null;
  d?.observe(n.ownerDocument.body, { childList: !0, subtree: !0 }), X = { root: e, chip: n, at: s, el: i, body: o, status: l, sources: t, index: 0, config: r, watch: d }, Rl(), rn(), document.addEventListener("keydown", xl, !0), document.addEventListener("pointerdown", Tl, !0), window.addEventListener("scroll", Il, !0), window.addEventListener("resize", rn), i.addEventListener("focusout", np), i.addEventListener("keydown", ep), Jh(i);
}
function Jh(n) {
  (n.querySelector("a") ?? n.querySelector("button:not([disabled])"))?.focus();
}
function Lt(n) {
  if (!X) return;
  const { chip: t, el: e, watch: s } = X;
  X = null, s?.disconnect(), e.remove(), t.setAttribute("aria-expanded", "false"), t.removeAttribute("aria-controls"), document.removeEventListener("keydown", xl, !0), document.removeEventListener("pointerdown", Tl, !0), window.removeEventListener("scroll", Il, !0), window.removeEventListener("resize", rn), n && t.isConnected && t.focus();
}
function tp() {
  X && !X.chip.isConnected && Lt(!1);
}
function xl(n) {
  n.key !== "Escape" || !X || (n.preventDefault(), Lt(!0));
}
function ep(n) {
  if (n.key !== "Tab" || !X) return;
  const t = Array.from(X.el.querySelectorAll("a[href], button:not([disabled])")), e = n.shiftKey ? t[0] : t[t.length - 1];
  document.activeElement === e && (n.preventDefault(), Lt(!0));
}
function Tl(n) {
  if (!X) return;
  const t = n.target;
  t && (X.el.contains(t) || X.chip.contains(t)) || Lt(!1);
}
function np(n) {
  if (!X) return;
  const t = n.relatedTarget;
  t && (X.el.contains(t) || X.chip.contains(t)) || t && Lt(!1);
}
function sp(n) {
  for (let t = n.parentElement; t; t = t.parentElement) {
    const e = getComputedStyle(t).overflowY;
    if (e === "auto" || e === "scroll") return t;
  }
  return null;
}
function Il() {
  if (!X) return;
  const n = sp(X.chip);
  if (n) {
    const t = n.getBoundingClientRect(), e = X.chip.getBoundingClientRect();
    if (e.bottom < t.top || e.top > t.bottom) {
      Lt(!1);
      return;
    }
  }
  rn();
}
function rn() {
  if (!X) return;
  const { chip: n, el: t } = X;
  if (!n.isConnected) {
    Lt(!1);
    return;
  }
  const e = n.getBoundingClientRect();
  t.style.left = "0px", t.style.top = "0px";
  const s = t.getBoundingClientRect(), r = 6, a = getComputedStyle(n).direction === "rtl" ? e.right - t.offsetWidth : e.left, o = Math.max(8, Math.min(a, window.innerWidth - t.offsetWidth - 8));
  let l = e.bottom + r;
  l + t.offsetHeight > window.innerHeight - 8 && e.top - t.offsetHeight - r > 8 && (l = e.top - t.offsetHeight - r), t.style.left = `${o - s.left}px`, t.style.top = `${l - s.top}px`;
}
function Rl() {
  if (!X) return;
  const { el: n, body: t, status: e, sources: s, index: r, config: i } = X, a = i.getLocale(), o = s[r], l = n.contains(document.activeElement) ? document.activeElement.dataset.aparteCardPart : void 0;
  if (t.replaceChildren(), s.length > 1) {
    const u = document.createElement("div");
    u.className = "aparte-citation-card__pager";
    const p = Zi(a.sourcePrevious ?? "Previous source", i.getIcon("prevBranch"), "prev", r === 0, () => Ji(-1)), f = document.createElement("span");
    f.className = "aparte-citation-card__position", f.textContent = `${r + 1}/${s.length}`, f.setAttribute("aria-hidden", "true");
    const _ = Zi(a.sourceNext ?? "Next source", i.getIcon("nextBranch"), "next", r === s.length - 1, () => Ji(1));
    u.append(p, f, _), t.append(u);
  }
  const c = Gr(o), d = o.title || Kn(o) || o.url || "";
  if (c) {
    const u = document.createElement("a");
    u.className = "aparte-citation-card__title", u.href = c, u.target = "_blank", u.rel = "noopener noreferrer", u.dataset.aparteCardPart = "link", u.textContent = d, u.dir = "auto";
    const p = document.createElement("span");
    p.className = "aparte-sr-only", p.textContent = ` ${a.opensInNewTab ?? "(opens in a new tab)"}`, u.append(p), t.append(u);
  } else {
    const u = document.createElement("p");
    u.className = "aparte-citation-card__title", u.textContent = d, u.dir = "auto", t.append(u);
  }
  const h = Kn(o);
  if (h && h !== d) {
    const u = document.createElement("p");
    u.className = "aparte-citation-card__domain", u.textContent = h, u.dir = "auto", t.append(u);
  }
  if (o.snippet) {
    const u = document.createElement("p");
    u.className = "aparte-citation-card__snippet", u.textContent = o.snippet, u.dir = "auto", t.append(u);
  }
  if (s.length > 1 && (e.textContent = (a.sourcePosition ?? "Source {i} of {n}").replace("{i}", () => String(r + 1)).replace("{n}", () => String(s.length))), l) {
    const u = n.querySelector(`[data-aparte-card-part="${l}"]`);
    u && !u.disabled ? u.focus() : (n.querySelector(".aparte-citation-card__pager button:not([disabled])") ?? n.querySelector("a"))?.focus();
  }
}
function Zi(n, t, e, s, r) {
  const i = document.createElement("button");
  return i.type = "button", i.className = "aparte-btn aparte-btn--icon aparte-btn--sm", i.setAttribute("aria-label", n), i.dataset.aparteCardPart = e, i.disabled = s, i.innerHTML = t, i.addEventListener("click", r), i;
}
function Ji(n) {
  X && (X.index = Math.max(0, Math.min(X.sources.length - 1, X.index + n)), Rl(), rn());
}
function rp(n, t, e, s) {
  let r = n.querySelector(":scope > .aparte-sources");
  const i = [], a = /* @__PURE__ */ new Set();
  for (const h of e) {
    const u = h.url ?? `#${h.id}${h.title ?? ""}`;
    a.has(u) || (a.add(u), i.push(h));
  }
  if (i.length === 0) {
    r?.remove();
    return;
  }
  const o = s.getLocale().opensInNewTab ?? "(opens in a new tab)", l = [o, ...i.map((h) => `${h.url ?? h.id}${h.title ?? ""}`)].join("");
  if (!r)
    r = document.createElement("details"), r.className = "aparte-sources", t.after(r);
  else if (r.dataset.aparteKey === l) {
    r.querySelector("summary").textContent = lr(s, i.length);
    return;
  }
  r.dataset.aparteKey = l;
  const c = document.createElement("summary");
  c.className = "aparte-sources__summary", c.textContent = lr(s, i.length);
  const d = document.createElement("ol");
  d.className = "aparte-sources__list";
  for (const h of i) {
    const u = document.createElement("li");
    u.className = "aparte-sources__item";
    const p = Kn(h), f = h.title || p || h.url || "", _ = Gr(h);
    if (_) {
      const g = document.createElement("a");
      g.href = _, g.target = "_blank", g.rel = "noopener noreferrer", g.textContent = f, g.dir = "auto";
      const v = document.createElement("span");
      v.className = "aparte-sr-only", v.textContent = ` ${o}`, g.append(v), u.append(g);
    } else
      u.append(Object.assign(document.createElement("span"), { textContent: f, dir: "auto" }));
    if (p && p !== f) {
      const g = document.createElement("span");
      g.className = "aparte-sources__domain", g.textContent = p, g.dir = "auto", u.append(" ", g);
    }
    d.append(u);
  }
  r.replaceChildren(c, d);
}
const He = /* @__PURE__ */ new WeakMap(), ta = "<i>a</i>";
function ea() {
  return M().renderMarkdown(ta) !== q(ta);
}
function an(n, t, e, s) {
  ip(n, t, e, s), Me(t, { streaming: s });
}
function ip(n, t, e, s) {
  const r = M();
  if (s) {
    if (He.delete(t), n._aparteSmd === void 0) {
      const a = M().createStreamingMarkdownRenderer(t);
      a ? (t.textContent = "", n._aparteSmd = { renderer: a, written: 0 }) : n._aparteSmd = null;
    }
    const i = n._aparteSmd;
    if (i) {
      const a = e.slice(i.written);
      a && (i.renderer.write(a), i.written = e.length);
      return;
    }
  } else if (n._aparteSmd) {
    const i = n._aparteSmd, a = e.slice(i.written);
    if (a && (i.renderer.write(a), i.written = e.length), i.renderer.end(), n._aparteSmd = void 0, !ea()) {
      _l(t), Cl(t), t.innerHTML = r.sanitizeHtml(t.innerHTML), He.set(t, { content: e, config: r, version: Nt(r), writer: "parser" });
      return;
    }
  } else {
    const i = He.get(t);
    if (i?.content === e && (i.writer === "parser" && !ea() || i.writer === "markdown" && i.config === r && i.version === Nt(r)))
      return;
  }
  t.innerHTML = r.renderMarkdown(e), s ? He.delete(t) : He.set(t, { content: e, config: r, version: Nt(r), writer: "markdown" });
}
function cr(n) {
  if (!M().hasHighlightProvider()) return;
  const t = n.querySelectorAll("pre > code:not([data-aparte-highlighted])");
  for (const e of t) {
    const s = e.parentElement;
    if (!s) continue;
    const r = Array.from(e.classList).find((a) => a.startsWith("language-"))?.slice(9) ?? "";
    if (ir(r, n) || e.closest(".aparte-code-drawing")) continue;
    const i = e.textContent ?? "";
    e.setAttribute("data-aparte-highlighted", ""), M().highlightCode(i, r, { fallback: !1 }).then((a) => {
      (s.isConnected || s.parentElement) && Ll(s, a);
    }).catch(() => e.removeAttribute("data-aparte-highlighted"));
  }
}
function Ll(n, t) {
  const e = document.createElement("template");
  e.innerHTML = t;
  for (const s of Array.from(e.content.querySelectorAll("code"))) s.setAttribute("data-aparte-highlighted", "");
  n.replaceWith(e.content);
}
const ap = {
  type: "text",
  render: (n) => `<div class="aparte-segment aparte-segment-text" data-segment-id="${q(n.id)}"><div class="aparte-segment-content" dir="auto">${M().renderMarkdown(n.content)}</div></div>`,
  /*
   * A fence in a settled text segment is highlighted, as the thinking renderer does for
   * its own. The parser turns a streamed fence into a `code` segment, so this only ever
   * mattered for text built by hand (`setSegments`, a restored message, a server's) — and
   * the bubble's own pass skips any message that has segments, so that fence stayed bare.
   */
  setup: (n, t) => {
    const e = n.querySelector(".aparte-segment-content");
    e && (t.isStreaming === !0 ? an(n, e, t.content, !0) : (Me(e, { streaming: !1 }), cr(e)), Qi(e, t));
  },
  update: (n, t) => {
    const e = n.querySelector(".aparte-segment-content");
    e && (an(
      n,
      e,
      t.content,
      t.isStreaming !== !1
    ), t.isStreaming === !1 && cr(e), Qi(e, t));
  },
  getStyles: () => ""
};
function Ml(n, t) {
  const e = Math.max(1, Math.round(n / 1e3));
  try {
    const s = (a, o) => new Intl.NumberFormat(t, { style: "unit", unit: o, unitDisplay: "narrow" }).format(a);
    if (e < 60) return s(e, "second");
    const r = Math.floor(e / 60), i = e % 60;
    return i ? new Intl.ListFormat(t, { style: "narrow", type: "unit" }).format([s(r, "minute"), s(i, "second")]) : s(r, "minute");
  } catch {
    return `${e}s`;
  }
}
const op = 24;
function dr(n) {
  if (n.label && n.label !== "Thinking") return n.label;
  const t = M();
  if (!de(n)) return t.t("thinking");
  const s = n.showDuration ?? t.getSegmentDefaults("thinking")?.showDuration === !0 ? Uu(n) : void 0;
  return s === void 0 ? t.t("thought") : t.t("thoughtFor").replace("{duration}", () => Ml(s, t.getLocale().tag || void 0));
}
const ur = (n) => n.isStreaming === !0;
function na(n, t) {
  const e = dr(t), s = n.querySelector(".aparte-thinking-label");
  s && s.textContent !== e && (s.textContent = e), s?.classList.toggle("aparte-shimmer", ur(t)), n.querySelector(".aparte-thinking-content")?.setAttribute("aria-label", e);
}
const lp = {
  type: "thinking",
  /*
   * Markdown, like every other prose surface.
   *
   * The reasoning was rendered as escaped plain text in a `white-space: pre-wrap`
   * box, so a model that formats its thinking — headings, lists, `**bold**`, a
   * fenced snippet, which is most of them — showed its own syntax as literal
   * characters. Nothing said that was deliberate; it read as one, because the
   * `pre-wrap` made it look like a chosen preformatted block.
   *
   * `renderMarkdown` sanitizes its provider's output before it reaches innerHTML,
   * so this is exactly the text renderer's path, with the same guarantees and no
   * new class of risk. With no Markdown provider registered it degrades to the
   * zero-dependency default (escape + `<br>`), which is what it used to be.
   */
  /*
   * WEARS THE ACCORDION RECIPE. A reasoning block is a disclosure — `<details>`, a
   * `<summary>` you press, a panel, a chevron that turns — which is exactly what
   * `surface/accordion.css` already draws, and this renderer used to draw a second
   * time under four classes of its own. Two costs, both visible: it looked unrelated
   * to every other disclosure in the library, and its chevron was the CHARACTER `▼`,
   * a fourth way to draw a chevron here and the only one that is not a glyph — so it
   * could not take `--aparte-icon-size`, could not be replaced through the icon
   * provider, and rendered in whatever the platform font felt like.
   *
   * What stays thinking's own is the left rail and the quieter tone, which is the
   * only part that is genuinely about reasoning rather than about disclosure.
   * `.aparte-thinking-label` stays too: `relabel` below queries it.
   */
  render: (n) => `<details class="aparte-segment aparte-segment-thinking aparte-accordion__item" data-segment-id="${q(n.id)}" ${n.collapsed === !1 ? "open" : ""}><summary class="aparte-accordion__header aparte-thinking-header"><span class="aparte-thinking-label${D(ur(n) ? " aparte-shimmer" : "")}">${q(dr(n))}</span><span class="aparte-accordion__icon">${M().getIcon("expand")}</span></summary><div class="aparte-accordion__panel aparte-thinking-content" dir="auto" role="region" tabindex="0" aria-label="${D(dr(n))}">${M().renderMarkdown(n.content)}</div></details>`,
  /**
   * The default label is the only config-derived text here — and `segment.label`
   * still wins, exactly as in `render`, because that string is the app's.
   */
  relabel: (n, t) => na(n, t),
  /** A block restored from storage is drawn here: `update` only runs on one that changes. */
  setup: (n, t) => {
    const e = n.querySelector(".aparte-thinking-content");
    e && (ur(t) ? an(n, e, t.content, !0) : Me(e, { streaming: !1 }));
  },
  update: (n, t) => {
    na(n, t);
    const e = n.querySelector(".aparte-thinking-content");
    if (!e) return;
    const s = e.scrollHeight - e.scrollTop - e.clientHeight <= op, r = t.isStreaming !== !1;
    an(n, e, t.content, r), r || cr(e), s && (e.scrollTop = e.scrollHeight);
  },
  getStyles: () => ""
};
function Ol(n) {
  return typeof navigator < "u" && navigator.clipboard && typeof navigator.clipboard.writeText == "function" ? navigator.clipboard.writeText(n) : new Promise((t, e) => {
    if (typeof document > "u" || typeof document.execCommand != "function") {
      e(new Error("[aparte] No clipboard available in this context"));
      return;
    }
    const s = document.createElement("textarea");
    s.value = n, s.setAttribute("readonly", ""), s.setAttribute("aria-hidden", "true"), s.style.position = "fixed", s.style.top = "0", s.style.left = "-9999px", s.style.opacity = "0";
    const r = document.activeElement;
    document.body.appendChild(s), s.focus(), s.select(), s.setSelectionRange(0, n.length);
    let i = !1;
    try {
      i = document.execCommand("copy");
    } catch {
      i = !1;
    }
    s.remove(), r instanceof HTMLElement && r.focus(), i ? t() : e(new Error("[aparte] Clipboard write failed"));
  });
}
const cp = 1500;
function hr(n, t) {
  n.setAttribute("aria-label", t), n.setAttribute("title", t);
}
function jr(n) {
  const t = D(M().t("copy")), e = M().getIcon("copy");
  return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm ${D(n)}" data-action="copy" aria-label="${t}" title="${t}">${e}</button>`;
}
function $l(n, t) {
  n.addEventListener("click", () => {
    Ol(t()).catch(() => {
    }), n.innerHTML = M(n).getIcon("check"), hr(n, M(n).t("copied")), n.dataset.copied = "1", setTimeout(() => {
      n.innerHTML = M(n).getIcon("copy"), hr(n, M(n).t("copy")), delete n.dataset.copied;
    }, cp);
  });
}
function Nl(n) {
  n.dataset.copied || (hr(n, M().t("copy")), n.innerHTML = M().getIcon("copy"));
}
const dp = 400, up = 256, sa = /* @__PURE__ */ new Map();
function hp(n, t, e) {
  if (n.delete(t), n.size >= up) {
    const s = n.keys().next().value;
    s !== void 0 && n.delete(s);
  }
  n.set(t, e);
}
function ra(n) {
  const t = Number(n.dataset.aparteHlLen);
  return Number.isFinite(t) && t > 0 ? t : 0;
}
function pp(n, t, e, s, r) {
  const i = n.querySelector(t);
  if (!i) return;
  delete i.dataset.aparteSettled;
  const a = i.querySelector("[data-aparte-tail]"), o = ra(i);
  if (a && o <= e.length)
    a.textContent = e.slice(o);
  else {
    delete i.dataset.aparteHlLen;
    const d = i.querySelector("code");
    d ? d.textContent = e : i.innerHTML = `<pre><code class="language-${q(s || "text")}">${q(e)}</code></pre>`;
  }
  const l = e.lastIndexOf(`
`) + 1;
  if (l <= o) return;
  const c = Date.now();
  c - (sa.get(r) ?? 0) < dp || (hp(sa, r, c), M(n).highlightCode(e.slice(0, l), s).then((d) => {
    const h = n.querySelector(t);
    if (!h || h.dataset.aparteSettled !== void 0 || l <= ra(h)) return;
    h.innerHTML = d;
    const u = h.querySelector("code") ?? h, p = document.createElement("span");
    p.dataset.aparteTail = "", p.textContent = e.slice(l), u.appendChild(p), h.dataset.aparteHlLen = String(l);
  }).catch(() => {
  }));
}
const Ts = /* @__PURE__ */ new WeakMap(), Ce = /* @__PURE__ */ new WeakMap(), Is = /* @__PURE__ */ new WeakMap();
function ia(n, t) {
  const e = n.querySelector(".aparte-code-content-wrapper");
  if (!e) return;
  const s = `${t.language ?? ""}${t.content}`, r = M(), i = Is.get(n);
  if (i?.what === s && i.config === r) return;
  Is.set(n, { what: s, config: r });
  const a = (Ce.get(n) ?? 0) + 1;
  Ce.set(n, a), e.dataset.aparteSettled = "", r.highlightCode(t.content, t.language || "", { fallback: !1 }).then((o) => {
    Ce.get(n) === a && (e.innerHTML = o);
  }).catch(() => {
    Ce.get(n) === a && Is.delete(n);
  });
}
const Vn = (n) => (n.language || "").trim().split(/\s+/)[0] ?? "";
function aa(n, t) {
  const e = Vn(t), s = e ? M(n).getCodeLanguageRenderer(e) : void 0;
  n.toggleAttribute("data-aparte-bare", !!s && s.card !== !0);
}
function oa(n, t) {
  const e = n.querySelector(".aparte-code-content-wrapper");
  if (!e) return;
  Ce.set(n, (Ce.get(n) ?? 0) + 1), e.dataset.aparteSettled = "";
  const s = Vn(t);
  let r = Array.from(e.querySelectorAll("pre > code")).find((i) => i.classList.contains(`language-${s}`));
  r || (e.innerHTML = `<pre><code class="language-${q(s)}"></code></pre>`, r = e.querySelector("pre > code")), r.textContent !== t.content && (r.textContent = t.content), Me(e, { streaming: t.isStreaming === !0 });
}
const fp = {
  type: "code",
  render: (n) => {
    const t = jr("aparte-code-copy");
    return `
        <div class="aparte-segment aparte-segment-code" data-segment-id="${q(n.id)}">
            <div class="aparte-code-header">
                ${n.filename ? `<span class="aparte-code-filename">${q(n.filename)}</span>` : '<span class="aparte-code-header-filler"></span>'}
                <span class="aparte-code-language">${q(n.language || "")}</span>
                ${t}
            </div>
            <div class="aparte-code-content-wrapper">
                <pre><code class="language-${q(n.language || "text")}">${q(n.content)}</code></pre>
            </div>
        </div>
    `;
  },
  /** The copy button's icon and tooltip — nothing else here comes from config. */
  relabel: (n) => {
    const t = n.querySelector(".aparte-code-copy");
    t && Nl(t);
  },
  setup: (n, t) => {
    Ts.set(n, t.content), aa(n, t), ir(Vn(t), n) ? oa(n, t) : t.isStreaming !== !0 && ia(n, t);
    const e = n.querySelector(".aparte-code-copy");
    e && $l(e, () => Ts.get(n) ?? "");
  },
  update: (n, t) => {
    Ts.set(n, t.content), aa(n, t), ir(Vn(t), n) ? oa(n, t) : t.isStreaming === !0 ? pp(n, ".aparte-code-content-wrapper", t.content, t.language || "", t.id) : ia(n, t);
  },
  getStyles: () => ""
};
function pr(n, t) {
  switch (n) {
    case tt.NET_OFFLINE:
    case tt.NET_ERROR:
      return t("errorUnreachable");
    case tt.NET_TIMEOUT:
      return t("errorTimeout");
    case tt.CONFIG_INVALID_KEY:
      return t("errorRefused");
    case tt.USAGE_RATE_LIMIT:
      return t("errorRateLimited");
    case tt.USAGE_CONTEXT_EXCEEDED:
      return t("errorTooLong");
    case tt.PROVIDER_ERROR:
    case tt.PROVIDER_UNAVAILABLE:
      return t("errorFailed");
    case tt.USAGE_BAD_REQUEST:
    case tt.PROVIDER_POLICY:
    case tt.PROVIDER_MISCONFIGURED:
    case tt.CONFIG_INVALID_MODEL:
    case tt.UNKNOWN_ERROR:
      return t("errorNoAnswer");
    default:
      return;
  }
}
const gp = {
  type: "error",
  render: (n) => {
    const t = M(), e = pr(n.code, (i) => t.t(i)), s = t.getErrorRenderer?.();
    if (s) {
      const i = s({
        message: n.content,
        ...e !== void 0 ? { sentence: e } : {},
        ...n.details !== void 0 ? { details: n.details } : {},
        ...n.code !== void 0 ? { code: n.code } : {}
      });
      return i instanceof HTMLElement && i.setAttribute("data-segment-id", n.id), i;
    }
    const r = e ?? n.content;
    return `
        <div class="aparte-segment aparte-alert aparte-alert--danger aparte-segment-error" data-segment-id="${q(n.id)}"${n.code ? ` data-error-code="${D(n.code)}"` : ""}>
            <span class="aparte-alert__icon">${t.getIcon("error") || "⚠"}</span>
            <div class="aparte-alert__body">
                <div class="aparte-alert__title">${q(t.t("error"))}</div>
                <div class="aparte-alert__message">${q(r)}</div>
                ${n.details ? `<pre class="aparte-segment-error__details">${q(n.details)}</pre>` : ""}
            </div>
        </div>
    `;
  },
  /**
   * The icon, the heading (`locale.error`) and a sentence chosen by the code.
   *
   * Not a message the error keeps as its own: that is the app's, a setup error's or the
   * turn limit's text, in the language it was written in. Relabelling it would be
   * inventing content.
   */
  relabel: (n, t) => {
    const e = M();
    if (e.getErrorRenderer?.()) return;
    const s = n.querySelector(".aparte-alert__icon");
    s && (s.innerHTML = e.getIcon("error") || "⚠");
    const r = n.querySelector(".aparte-alert__title");
    r && (r.textContent = e.t("error"));
    const i = pr(t.code, (o) => e.t(o)), a = n.querySelector(".aparte-alert__message");
    a && i !== void 0 && (a.textContent = i);
  },
  getStyles: () => ""
};
function Pl(n, t) {
  if (!n || typeof n != "object" || Object.keys(n).length === 0) return "";
  if (t)
    try {
      const e = t(n);
      if (typeof e == "string") return e;
    } catch {
    }
  try {
    return JSON.stringify(n, null, 2);
  } catch {
    return "";
  }
}
const la = /* @__PURE__ */ new WeakSet();
function le(n, t) {
  const e = t.getToolLineProvider();
  if (e)
    try {
      const s = e(n);
      return s && typeof s == "object" ? s : void 0;
    } catch (s) {
      la.has(e) || (la.add(e), console.error("[aparte] The tool-line provider threw; the row keeps its default line. Further throws from it are not reported.", s));
      return;
    }
}
const on = (n) => typeof n == "string" ? n.trim() : "";
function Kr(n, t, e = le(n, t)) {
  const s = n.toolCall?.name ?? "tool", r = t.getToolDisplay(s)?.label;
  if (r !== void 0)
    try {
      const a = typeof r == "function" ? r(n) : r;
      if (typeof a == "string" && a.trim()) return { text: a.trim(), isLabel: !0 };
    } catch {
    }
  const i = on(e?.label);
  return i ? { text: i, isLabel: !0 } : { text: s, isLabel: !1 };
}
function _p(n, t, e = le(n, t)) {
  return Dl(n, t, e).text;
}
function Dl(n, t, e = le(n, t)) {
  const s = t.getToolSummary(n.toolCall?.name ?? "");
  if (s)
    try {
      const i = on(s(n));
      if (i) return { text: i, isWords: !1 };
    } catch {
    }
  const r = on(e?.target);
  return { text: r, isWords: r !== "" };
}
function Hl(n, t) {
  return on(t?.activity);
}
function mp(n) {
  return on(n?.note);
}
function Bl(n) {
  return Pl(n.toolCall?.input, M().getToolInputFormatter(n.toolCall?.name ?? ""));
}
function fr(n) {
  const t = M(), e = n.status ?? "pending", s = (r) => q(r);
  return e === "awaiting-approval" ? `${t.getIcon("pause")}${s(t.t("approvalWaiting"))}` : e === "pending" ? s(t.t("toolRunning")) : e === "resolved" ? `${t.getIcon("check")}${s(t.t("toolCompleted"))}` : e === "rejected" ? `${t.getIcon("close")}${s(t.t("toolRejected"))}` : e === "aborted" ? `${t.getIcon("stop")}${s(t.t("toolStopped"))}` : e === "failed" ? `${t.getIcon("close")}${s(t.t("toolFailed"))}` : "";
}
function bp(n) {
  const t = M();
  if (n.status === "rejected") {
    const e = n.refusal?.by;
    if (e === "policy") return t.t("toolRefusedByPolicy");
    if (e === "earlier-refusal") return t.t("toolNotRunAfterRefusal");
    const s = n.refusal?.instruction?.trim();
    return s ? t.t("toolRejectedSaid").replace("{instruction}", () => s) : "";
  }
  if (n.status === "aborted")
    switch (n.abortCause) {
      case "timeout":
        return t.t("toolTimedOut");
      case "no-handler":
        return t.t("toolUnavailable");
      case "no-resolver":
        return t.t("toolNoApprover");
      case "turn-limit":
        return t.t("toolTurnLimit");
      default:
        return "";
    }
  return "";
}
function ql(n, t) {
  return [bp(n), mp(t)].filter(Boolean).join(" · ");
}
function gr(n) {
  const t = Sp(n.result ?? "");
  return !t || n.status === "rejected" && n.refusal ? null : { key: "toolOutput", text: t };
}
function Rs(n, t, e) {
  const s = M().getToolDisplay(n.toolCall?.name ?? ""), r = s && "details" in s ? s.details : t?.details;
  if (r === !1) return { kind: "none" };
  if (typeof r != "function") return { kind: "parts" };
  try {
    const i = r(n, e ? vp(e) : void 0);
    return i ? { kind: "body", body: typeof i == "string" ? M().sanitizeHtml(i) : i } : { kind: "none" };
  } catch {
    return { kind: "none" };
  }
}
function _r(n) {
  return n.tagName === "DETAILS" ? n : n.querySelector(":scope > details.aparte-tool-disclosure");
}
const mr = (n) => n.querySelector(':scope > .aparte-tool-detail[data-details="app"], :scope > .aparte-tool-disclosure > .aparte-tool-detail[data-details="app"]');
function Fl(n, t) {
  const e = n.querySelector(".aparte-tool-detail");
  e && (typeof t != "string" && t.parentNode === e || (typeof t == "string" ? (e.innerHTML = t, ln.delete(e)) : (e.replaceChildren(t), ln.set(e, t)), Dn.set(e, Ul(t))));
}
const ln = /* @__PURE__ */ new WeakMap();
function vp(n) {
  const t = mr(n), e = t ? ln.get(t) : void 0;
  return e && e.parentNode === t ? e : void 0;
}
const Dn = /* @__PURE__ */ new WeakMap(), Ul = (n) => typeof n == "string" ? n : n.outerHTML;
function yp(n, t) {
  if (typeof t != "string" && n.contains(t)) {
    Dn.set(n, t.outerHTML);
    return;
  }
  const e = Dn.get(n), s = Ul(t);
  if (e === s) return;
  const r = document.createElement("div");
  typeof t == "string" ? r.innerHTML = t : r.append(t);
  const i = document.createElement("div");
  e !== void 0 && (i.innerHTML = e), e !== void 0 && br(i, r) && br(i, n) ? Wl(n, i, r) : (n.replaceChildren(...Array.from(r.childNodes)), typeof t == "string" ? ln.delete(n) : ln.set(n, t)), Dn.set(n, s);
}
function br(n, t) {
  if (n.childNodes.length !== t.childNodes.length) return !1;
  for (let e = 0; e < n.childNodes.length; e++) {
    const s = n.childNodes[e], r = t.childNodes[e];
    if (s.nodeType !== r.nodeType || s.nodeName !== r.nodeName || !br(s, r)) return !1;
  }
  return !0;
}
function Wl(n, t, e) {
  for (let s = 0; s < n.childNodes.length; s++) {
    const r = n.childNodes[s], i = t.childNodes[s], a = e.childNodes[s];
    if (r instanceof Element && i instanceof Element && a instanceof Element) {
      for (const { name: o, value: l } of Array.from(a.attributes))
        i.getAttribute(o) !== l && r.setAttribute(o, l);
      for (const { name: o } of Array.from(i.attributes))
        a.hasAttribute(o) || r.removeAttribute(o);
      Wl(r, i, a);
    } else i.nodeValue !== a.nodeValue && (r.nodeValue = a.nodeValue);
  }
}
function ca(n, t, e) {
  const s = n.querySelector(".aparte-tool-note");
  if (!s) return;
  const r = ql(t, e);
  s.textContent !== r && (s.textContent = r), s.toggleAttribute("hidden", !r), r ? s.setAttribute("title", r) : s.removeAttribute("title");
}
function da(n, t, e, s) {
  const r = n.querySelector(`[data-part="${t}"]`);
  if (!e) {
    r?.remove();
    return;
  }
  if (r) {
    const f = r.querySelector("code");
    f && f.textContent !== e && (f.textContent = e);
    const _ = r.querySelector(".aparte-tool-part-label"), g = M().t(s);
    _ && _.textContent !== g && (_.textContent = g), r.querySelector(".aparte-tool-part-body")?.setAttribute("aria-label", g);
    return;
  }
  const i = n.querySelector(".aparte-tool-detail");
  if (!i) return;
  const a = M(), o = document.createElement("div");
  o.className = "aparte-tool-part", o.dataset.part = t;
  const l = document.createElement("div");
  l.className = "aparte-tool-part-head";
  const c = document.createElement("span");
  c.className = "aparte-tool-part-label", c.textContent = a.t(s);
  const d = document.createElement("template");
  d.innerHTML = jr("aparte-tool-copy"), l.append(c, d.content);
  const h = document.createElement("div");
  h.className = "aparte-tool-part-body", h.setAttribute("role", "region"), h.tabIndex = 0, h.setAttribute("aria-label", c.textContent);
  const u = document.createElement("pre"), p = document.createElement("code");
  p.textContent = e, u.appendChild(p), h.appendChild(u), o.append(l, h), t === "input" ? i.prepend(o) : i.appendChild(o), zl(o);
}
function zl(n) {
  for (const t of n.querySelectorAll(".aparte-tool-copy")) {
    if (t.dataset.wired) continue;
    t.dataset.wired = "1";
    const e = t.closest(".aparte-tool-part");
    $l(t, () => e?.querySelector(".aparte-tool-part-body")?.textContent ?? "");
  }
}
const wp = 2e5;
function Gl(n) {
  const t = n.trim();
  if (!(t.length > wp || !(t.startsWith("{") || t.startsWith("["))))
    try {
      const e = JSON.parse(t);
      return e !== null && typeof e == "object" ? e : void 0;
    } catch {
      return;
    }
}
function Sp(n) {
  const t = Gl(n);
  return t === void 0 ? n : JSON.stringify(t, null, 2);
}
function ua(n) {
  const t = M();
  for (const e of n.querySelectorAll(".aparte-tool-part-body")) {
    const s = e.querySelector("code")?.textContent ?? "";
    !s || Gl(s) === void 0 || t.highlightCode(s, "json").then((r) => {
      (e.querySelector("code")?.textContent ?? "") === s && (e.innerHTML = r);
    }).catch(() => {
    });
  }
}
function jl(n, t) {
  return Dl(n, M(), t);
}
function ha(n, t, e) {
  const s = n.querySelector(".aparte-tool-target");
  if (!s) return;
  const { text: r, isWords: i } = jl(t, e);
  s.textContent !== r && (s.textContent = r), s.toggleAttribute("hidden", !r), s.classList.toggle("aparte-tool-target--words", i);
}
function pa(n, t, e) {
  const s = n.querySelector(".aparte-tool-activity");
  if (!s) return;
  const r = Hl(t, e);
  s.textContent !== r && (s.textContent = r), s.toggleAttribute("hidden", !r);
}
function Kl(n, t) {
  return Kr(n, M(), t);
}
function Vl(n) {
  const t = M(), e = t.getToolDisplay(n.toolCall?.name ?? "")?.icon;
  return (e ? t.getIcon(e) : void 0) || t.getIcon("tool");
}
const Vr = (n) => M().getToolDisplay(n.toolCall?.name ?? "")?.quiet ?? !0;
function Xl(n) {
  const t = n.status ?? "pending", e = Vr(n);
  return {
    shimmer: e && t === "pending",
    spinner: !e && t === "pending",
    stateHidden: e && (t === "pending" || t === "resolved")
  };
}
function fa(n, t) {
  const e = Xl(t);
  n.toggleAttribute("data-quiet", Vr(t)), n.querySelector(".aparte-tool-spinner")?.toggleAttribute("hidden", !e.spinner), n.querySelector(".aparte-tool-name")?.classList.toggle("aparte-shimmer", e.shimmer), n.querySelector(".aparte-tool-state")?.classList.toggle("aparte-sr-only", e.stateHidden);
}
function ga(n, t, e) {
  const s = n.querySelector(".aparte-tool-name");
  if (!s) return;
  const { text: r, isLabel: i } = Kl(t, e);
  s.textContent !== r && (s.textContent = r), s.classList.toggle("aparte-tool-name--label", i);
}
const vr = /* @__PURE__ */ new WeakMap();
function cs(n) {
  const t = n?.open;
  return t && typeof t.onOpen == "function" ? t : void 0;
}
function Ap(n) {
  const t = cs(n);
  return t ? ` data-opens${t.current ? " data-current" : ""}` : "";
}
function Xr(n) {
  const t = cs(n);
  if (!t) return "";
  const e = D(typeof t.label == "string" ? t.label.trim() : ""), s = M().getIcon("maximize");
  return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-tool-open" aria-label="${e}" title="${e}"${t.current ? ' aria-current="true"' : ""}>${s}</button>`;
}
function Ls(n, t, e) {
  const s = cs(t), r = n.querySelector(":scope > .aparte-tool-line");
  let i = n.querySelector(":scope > :is(.aparte-tool-line, .aparte-tool-open-slot) > .aparte-tool-open");
  if (s ? vr.set(n, s) : vr.delete(n), e && r && !!s != !!i)
    if (i)
      i.remove(), i = null;
    else {
      const o = document.createElement("template");
      o.innerHTML = Xr(t), i = o.content.firstElementChild, r.insertBefore(i, r.querySelector(":scope > .aparte-tool-activity"));
    }
  if (n.toggleAttribute("data-opens", !!s && !!i), n.toggleAttribute("data-current", !!s?.current && !!i), !s || !i) return;
  const a = typeof s.label == "string" ? s.label.trim() : "";
  i.getAttribute("aria-label") !== a && (i.setAttribute("aria-label", a), i.title = a), s.current ? i.setAttribute("aria-current", "true") : i.removeAttribute("aria-current");
}
const _a = /* @__PURE__ */ new WeakSet();
function kp(n) {
  _a.has(n) || (_a.add(n), n.addEventListener("click", (t) => {
    const e = vr.get(n), s = t.target;
    if (!(!e || !s?.closest || s.closest(".aparte-segment-tool-call") !== n) && !(!s.closest(".aparte-tool-open") && (_r(n) || s.closest(".aparte-tool-line")?.parentElement !== n || n.ownerDocument.getSelection?.()?.isCollapsed === !1)))
      try {
        e.onOpen(n);
      } catch (r) {
        console.error("[aparte] a tool line's onOpen threw", r);
      }
  }));
}
function ma(n, t, e = !0) {
  const s = fr(n), r = Vl(n), i = jl(n, t), a = Hl(n, t), o = ql(n, t), l = Kl(n, t), c = Xl(n), d = e ? Xr(t) : "";
  return `
                <span class="aparte-tool-label">
                    <span class="aparte-tool-icon">${r}</span>
                    <span class="aparte-tool-name${l.isLabel ? " aparte-tool-name--label" : ""}${c.shimmer ? " aparte-shimmer" : ""}">${q(l.text)}</span>
                    <span class="aparte-tool-target${i.isWords ? " aparte-tool-target--words" : ""}"${i.text ? "" : " hidden"}>${q(i.text)}</span>
                </span>
                <span class="aparte-spinner aparte-tool-spinner" aria-hidden="true"${c.spinner ? "" : " hidden"}></span>
                <span class="aparte-tool-state${c.stateHidden ? " aparte-sr-only" : ""}">${s}</span>
                <span class="aparte-tool-note"${o ? ` title="${D(o)}"` : " hidden"}>${q(o)}</span>${d}
                <span class="aparte-tool-activity"${a ? "" : " hidden"}>${q(a)}</span>`;
}
function ba(n) {
  return `<div class="aparte-segment aparte-segment-tool-call" data-segment-id="${q(n.id)}" data-status="${D(n.status ?? "pending")}" data-tool-call-id="${D(n.toolCall?.id ?? "")}" data-tool-name="${D(n.toolCall?.name ?? "tool")}" hidden></div>`;
}
const Se = (n) => n.hidden && n.classList.contains("aparte-segment-tool-call") && n.childElementCount === 0, Xe = /* @__PURE__ */ new WeakMap(), Hn = /* @__PURE__ */ new WeakMap();
function Ep(n) {
  return Hn.get(n) ?? null;
}
function va(n, t) {
  const e = Xe.get(n);
  return e || (n.classList.contains("aparte-segment-tool-call") ? null : t);
}
function ya(n, t, e) {
  const s = n.toolCall?.name ?? "tool", r = n.status ?? "pending", i = n.toolCall?.id ?? "", a = ma(n, e), o = Vr(n) ? " data-quiet" : "", l = Ap(e), c = M().getIcon("expand"), d = t.kind === "parts" ? Bl(n) : "", h = t.kind === "parts" ? gr(n) : null;
  if (t.kind === "none" || t.kind === "parts" && !d && !h)
    return `
        <div class="aparte-segment aparte-segment-tool-call" data-segment-id="${q(n.id)}" data-status="${D(r)}" data-tool-call-id="${D(i)}" data-tool-name="${D(s)}"${o}${l}><div class="aparte-tool-line">${a}</div>
        </div>
    `;
  const u = M(), p = jr("aparte-tool-copy"), f = n.collapsed !== void 0 ? !n.collapsed : u.getToolDisplay(s)?.open === !0, _ = Xr(e), g = _ ? `<details class="aparte-tool-disclosure"${f ? " open" : ""}>` : "", v = _ ? `<div class="aparte-segment aparte-segment-tool-call" data-segment-id="${q(n.id)}" data-status="${D(r)}" data-tool-call-id="${D(i)}" data-tool-name="${D(s)}"${o}${l}>${g}` : `<details class="aparte-segment aparte-segment-tool-call" data-segment-id="${q(n.id)}" data-status="${D(r)}" data-tool-call-id="${D(i)}" data-tool-name="${D(s)}"${o}${l}${f ? " open" : ""}>`, S = _ ? `</details><span class="aparte-tool-open-slot">${_}</span></div>` : "</details>", A = ma(n, e, !1);
  if (t.kind === "body") {
    const C = document.createElement("template");
    C.innerHTML = `
        ${v}
            <summary class="aparte-tool-summary"><span class="aparte-tool-toggle">${c}</span>${A}</summary>
            <div class="aparte-tool-detail" data-details="app"></div>
        ${S}`.trim();
    const b = C.content.firstElementChild;
    return Fl(b, t.body), b;
  }
  return `
        ${v}
            <summary class="aparte-tool-summary"><span class="aparte-tool-toggle">${c}</span>${A}</summary>
            <div class="aparte-tool-detail">
                ${d ? `
                <div class="aparte-tool-part" data-part="input">
                    <div class="aparte-tool-part-head"><span class="aparte-tool-part-label">${q(u.t("toolInput"))}</span>${p}</div>
                    <div class="aparte-tool-part-body" role="region" tabindex="0" aria-label="${D(u.t("toolInput"))}"><pre><code>${q(d)}</code></pre></div>
                </div>` : ""}
                ${h ? `
                <div class="aparte-tool-part" data-part="output">
                    <div class="aparte-tool-part-head"><span class="aparte-tool-part-label">${q(u.t(h.key))}</span>${p}</div>
                    <div class="aparte-tool-part-body" role="region" tabindex="0" aria-label="${D(u.t(h.key))}"><pre><code>${q(h.text)}</code></pre></div>
                </div>` : ""}
            </div>
        ${S}
    `;
}
const Ze = {
  type: "tool_call",
  render: (n) => {
    const t = n.toolCall?.name ?? "tool";
    if (M().isToolHidden(t)) return ba(n);
    const e = M().getToolRenderer(t);
    if (e) {
      Yl(t, e);
      const r = e.render(n);
      return r instanceof HTMLElement && (Xe.set(r, e), Hn.set(r, e)), r || ba(n);
    }
    const s = le(n, M());
    return ya(n, Rs(n, s), s);
  },
  /**
   * The pill's glyphs, and the label it wears while a person is deciding.
   *
   * The two highest-stakes strings in the library — the approval labels — are no
   * longer here: they are on the panel, which relabels itself. This still matters
   * though, because the request the pill describes stays open for as long as
   * somebody takes to decide, which is exactly long enough for a language switch.
   *
   * No child node is added or removed, per the relabel contract.
   */
  relabel: (n, t) => {
    if (Se(n)) return;
    const e = M(), s = va(n, e.getToolRenderer(t.toolCall?.name) ?? null);
    if (s) {
      s.relabel?.(n, t);
      return;
    }
    const r = le(t, e), i = n.querySelector(".aparte-tool-icon");
    i && (i.innerHTML = Vl(t)), ga(n, t, r), ha(n, t, r), pa(n, t, r), ca(n, t, r), Ls(n, r, !1);
    const a = n.querySelector('[data-part="input"] .aparte-tool-part-label');
    a && (a.textContent = e.t("toolInput")), n.querySelector('[data-part="input"] .aparte-tool-part-body')?.setAttribute("aria-label", e.t("toolInput"));
    const o = gr(t), l = n.querySelector('[data-part="output"] .aparte-tool-part-label');
    l && o && (l.textContent = e.t(o.key)), o && n.querySelector('[data-part="output"] .aparte-tool-part-body')?.setAttribute("aria-label", e.t(o.key));
    for (const h of n.querySelectorAll(".aparte-tool-copy")) Nl(h);
    const c = mr(n);
    if (c) {
      const h = Rs(t, r, n);
      h.kind === "body" && yp(c, h.body);
    }
    const d = n.querySelector(".aparte-tool-state");
    d && (d.innerHTML = fr(t)), fa(n, t);
  },
  /**
   * Patch in place. NEVER re-render, and never touch `open`.
   *
   * Without an `update` the bubble replaces the element wholesale — and a tool call
   * changes status several times per turn, so a disclosure the reader opened would
   * slam shut under them every time. The same rule the reasoning block has, for the
   * same reason: `collapsed` is honoured only when an update explicitly carries it.
   *
   * The one case that cannot be patched is a change of ELEMENT: a call that had
   * neither arguments nor a result rendered as a plain pill, and gaining a result
   * makes it a `<details>`. That falls back to a rebuild, which costs nothing because
   * there was no disclosure to lose.
   */
  update: (n, t) => {
    const e = t.status ?? "pending", s = M().isToolHidden(t.toolCall?.name ?? "tool");
    if (s && Se(n)) {
      n.setAttribute("data-status", e);
      return;
    }
    const r = s ? null : M().getToolRenderer(t.toolCall?.name) ?? null, i = Se(n) ? null : va(n, r);
    if (i && i === r && i.update && !Se(n)) {
      i.update(n, t);
      return;
    }
    const a = (g) => {
      const v = document.createElement("template");
      v.innerHTML = typeof g == "string" ? g.trim() : "";
      const S = typeof g == "string" ? v.content.firstElementChild : g;
      return S && (S.hasAttribute("data-segment-id") || S.setAttribute("data-segment-id", t.id), Ze.cleanup?.(n, t), n.replaceWith(S), Ze.setup?.(S, t)), S;
    };
    if (r || i || s || Se(n)) {
      a(Ze.render(t));
      return;
    }
    const o = le(t, M()), l = Rs(t, o, n), c = l.kind === "parts" ? Bl(t) : "", d = l.kind === "parts" ? gr(t) : null, h = l.kind === "body" || !!c || !!d, u = !!mr(n), p = _r(n), f = !!p && p !== n;
    if (h !== !!p || h && l.kind === "body" !== u || h && f !== !!cs(o)) {
      const g = p?.open, v = a(ya(t, l, o)), S = v && g !== void 0 ? _r(v) : null;
      S && g !== void 0 && (S.open = g);
      return;
    }
    n.setAttribute("data-status", e);
    const _ = n.querySelector(".aparte-tool-state");
    if (_ && (_.innerHTML = fr(t)), fa(n, t), ga(n, t, o), ha(n, t, o), pa(n, t, o), ca(n, t, o), Ls(n, o, !0), l.kind === "body") {
      Fl(n, l.body);
      return;
    }
    da(n, "input", c, "toolInput"), da(n, "output", d?.text ?? "", d?.key ?? "toolOutput"), ua(n);
  },
  setup: (n, t) => {
    const s = M().isToolHidden(t.toolCall?.name ?? "tool") ? void 0 : M().getToolRenderer(t.toolCall?.name);
    s && Hn.set(n, s), !Se(n) && (s || (Ls(n, le(t, M()), !1), kp(n)), zl(n), ua(n), s && Xe.set(n, s), s?.setup?.(n, t));
  },
  /**
   * The row leaves for good: the registered renderer that drew it, if any, cleans up. A
   * cleanup that throws is reported and goes no further: the row is replaced or removed
   * all the same, and the stream that caused it is not interrupted.
   */
  cleanup: (n, t) => {
    Hn.delete(n);
    const e = Xe.get(n);
    if (e) {
      Xe.delete(n);
      try {
        e.cleanup?.(n, t);
      } catch (s) {
        console.error("[aparte] a tool renderer's cleanup threw", s);
      }
    }
  },
  // CSS lives in styles/segment/ — see that folder for why a
  // built-in's rules belong there. `getStyles` stays for a CONSUMER's renderer, which
  // has no other way onto the page.
  getStyles: () => ""
};
function wa(n) {
  const t = document.createElement("div");
  return t.className = "aparte-segment aparte-segment-activity", t.setAttribute("data-segment-id", n.id), t.setAttribute("data-activity-type", n.activityType), t.hidden = !0, t;
}
const Sa = (n) => n.hidden && n.classList.contains("aparte-segment-activity") && n.childElementCount === 0, Ae = /* @__PURE__ */ new WeakMap(), Bn = /* @__PURE__ */ new WeakMap();
function Cp(n) {
  return Bn.get(n) ?? null;
}
const Ms = (n) => M().getActivityRenderer(n.activityType) ?? null, Je = {
  type: "activity",
  render: (n) => {
    const t = Ms(n);
    if (!t) return wa(n);
    const e = t.render(n);
    return e instanceof HTMLElement ? (Ae.set(e, t), Bn.set(e, t), e) : e.trim() ? e : wa(n);
  },
  setup: (n, t) => {
    const e = Ms(t);
    e && (Bn.set(n, e), !Sa(n) && (Ae.set(n, e), e.setup?.(n, t)));
  },
  /**
   * The agent sent it again. The renderer that drew it patches it, when it can and is still
   * the one registered; otherwise it is drawn again here, and the bubble follows the element.
   */
  update: (n, t) => {
    const e = Ms(t), s = Ae.get(n) ?? null;
    if (s && s === e && s.update) {
      s.update(n, t);
      return;
    }
    if (!e && !s && Sa(n)) {
      n.setAttribute("data-activity-type", t.activityType);
      return;
    }
    const r = Je.render(t);
    let i;
    if (typeof r == "string") {
      const a = document.createElement("template");
      a.innerHTML = r.trim(), i = a.content.firstElementChild;
    } else
      i = r;
    i && (i.hasAttribute("data-segment-id") || i.setAttribute("data-segment-id", t.id), Je.cleanup?.(n, t), n.replaceWith(i), Je.setup?.(i, t));
  },
  relabel: (n, t) => {
    Ae.get(n)?.relabel?.(n, t);
  },
  /** The element leaves for good: the renderer that drew it cleans up. A cleanup that throws is reported, nothing more. */
  cleanup: (n, t) => {
    Bn.delete(n);
    const e = Ae.get(n);
    if (e) {
      Ae.delete(n);
      try {
        e.cleanup?.(n, t);
      } catch (s) {
        console.error("[aparte] an activity renderer's cleanup threw", s);
      }
    }
  }
}, Aa = /* @__PURE__ */ new WeakMap();
function ue(n) {
  let t = Aa.get(n);
  return t || (t = { renderers: /* @__PURE__ */ new Map(), defaultsInstalled: !1, defaultsDeclined: !1 }, Aa.set(n, t)), t;
}
function xp(n) {
  const t = ue(n);
  if (n === _t || t.defaultsDeclined) return t.renderers;
  const e = new Map(ue(_t).renderers);
  for (const [s, r] of t.renderers) e.set(s, r);
  return e;
}
let ee = null;
function Tp(n, t = M()) {
  const e = ue(t);
  e.renderers.get(n.type) !== n && (e.renderers.set(n.type, n), Yr(t), Ee(t));
}
function Ip(n = M()) {
  ue(n).defaultsDeclined = !0;
}
function Rp(n = M()) {
  const t = ue(n);
  if (!(t.defaultsInstalled || t.defaultsDeclined)) {
    t.defaultsInstalled = !0;
    for (const e of Ql)
      t.renderers.has(e.type) || t.renderers.set(e.type, e);
    Yr(n);
  }
}
function ka(n, t = M()) {
  return xp(t).get(n);
}
const kn = /* @__PURE__ */ new Set();
function Yr(n = M()) {
  if (typeof document > "u") return;
  (!ee || !ee.isConnected) && (ee = document.createElement("style"), ee.id = "aparte-renderer-styles", document.head.appendChild(ee), ee.textContent = Array.from(kn).join(`
`));
  let t = !1;
  for (const e of ue(n).renderers.values()) {
    const s = e.getStyles?.();
    !s || kn.has(s) || (kn.add(s), t = !0);
  }
  t && (ee.textContent = Array.from(kn).join(`
`));
}
const Ea = /* @__PURE__ */ new WeakMap();
function Yl(n, t) {
  if (typeof document > "u") return;
  const e = t.getStyles?.();
  if (!e) return;
  let s = Ea.get(t);
  if (s || (s = `aparte-tool-renderer-${n}`, Ea.set(t, s)), document.getElementById(s)) return;
  const r = document.createElement("style");
  r.id = s, r.textContent = e, document.head.appendChild(r);
}
function Lp(n = M()) {
  const t = ue(n);
  t.defaultsInstalled = !0;
  for (const e of Ql)
    t.renderers.has(e.type) || Tp(e, n);
  Yr(n);
}
const Ql = [
  ap,
  lp,
  fp,
  gp,
  Ze,
  Je
], Zl = Jo;
function Os(n) {
  const { target: t, config: e, messageId: s, targetId: r, observe: i = !0 } = n;
  let a = new rr({ blocks: e.getStreamBlocks() }), o = /* @__PURE__ */ new Set(), l = null;
  const c = /* @__PURE__ */ new Map(), d = (x, P) => {
    const W = `tool-${x}`;
    t.updateSegment?.(W, c.has(W) ? P : { ...P, deferred: void 0 });
  };
  let h = "", u = !1, p = "", f = /* @__PURE__ */ new Map(), _ = [], g = [], v = /* @__PURE__ */ new Set();
  const S = (x) => {
    const P = x.content;
    typeof P == "string" && f.set(x.id, { text: x.type === "text", content: P });
  }, A = () => {
    if (_.length === 0) return;
    let x = 0;
    const P = [...f].map(([Y, { text: K, content: it }]) => {
      const ht = p.indexOf(it, x);
      return ht >= 0 && (x = ht + it.length), { id: Y, text: K, start: ht, length: it.length, citations: [] };
    }).filter((Y) => Y.text);
    if (P.length === 0) return;
    const W = /* @__PURE__ */ new Set();
    for (const Y of g) {
      const K = P.find((ct) => ct.start >= 0 && Y.end > ct.start && Y.end <= ct.start + ct.length);
      if (!K) continue;
      const it = Y.end - K.start, ht = Y.start === void 0 ? void 0 : Math.max(0, Math.min(it, Y.start - K.start));
      K.citations.push({ ...Y, end: it, ...ht === void 0 ? {} : { start: ht } });
      for (const ct of Y.sources) W.add(ct);
    }
    const U = P[P.length - 1], nt = /* @__PURE__ */ new Set();
    for (const Y of P) {
      const K = new Set(Y.citations.flatMap((ht) => ht.sources)), it = _.filter((ht) => K.has(ht.id) || Y === U && !W.has(ht.id));
      if (it.length === 0) {
        v.has(Y.id) && t.updateSegment?.(Y.id, { sources: void 0, citations: void 0 });
        continue;
      }
      nt.add(Y.id), t.updateSegment?.(Y.id, { sources: it, citations: Y.citations });
    }
    v = nt;
  }, C = (x) => {
    if (!l || u) return;
    const P = typeof Element < "u" && t instanceof Element ? $(t) : e, W = !x || P.getSegmentDefaults("thinking")?.collapsed === !1;
    t.updateSegment?.(l, W ? { isStreaming: !1 } : { collapsed: !0, isStreaming: !1 }), u = !0;
  }, b = [];
  let y = null;
  const E = () => {
    const x = b.at(-1) ?? null;
    x !== y && (y = x, t.setStep?.(s, x));
  }, R = () => {
    b.length = 0, E();
  }, w = () => {
    const x = a.finalize();
    for (const P of x)
      S(P), o.has(P.id) ? "content" in P && t.updateSegment?.(P.id, Ss(P)) : t.addSegment?.(P);
    A();
  }, I = /* @__PURE__ */ new Set(), O = (x) => I.has(x) ? !0 : (t.getMessage ? t.getMessage(s)?.segments : t.segments)?.some((W) => W.id === x) ? (I.add(x), !0) : !1, N = (x) => {
    switch (x.type) {
      case "step-start":
        b.push(x.name), E();
        break;
      case "step-end": {
        const P = b.lastIndexOf(x.name);
        P >= 0 && b.splice(P, 1), E();
        break;
      }
      case "run-start":
        t.updateMessage?.(s, { status: "streaming" });
        break;
      case "turn-start":
        C(!1), a = new rr({ blocks: e.getStreamBlocks() }), o = /* @__PURE__ */ new Set(), p = "", f = /* @__PURE__ */ new Map(), _ = v.size === 0 ? _.map((P) => ({ ...P, id: `${P.id}~` })) : [], g = [], v = /* @__PURE__ */ new Set(), l = null, h = "", u = !1;
        break;
      case "thinking-delta": {
        if (h += x.delta, l)
          t.updateSegment?.(l, { content: h });
        else {
          const P = {
            id: `think-${pt()}`,
            type: "thinking",
            content: h,
            isStreaming: !0
          };
          l = P.id, o.add(P.id), t.addSegment?.(P);
        }
        break;
      }
      case "text-delta": {
        C(!0), p += x.delta;
        const P = a.parse(x.delta);
        for (const U of P.segments)
          S(U), o.has(U.id) ? "content" in U && t.updateSegment?.(U.id, Ss(U)) : (t.addSegment?.(U), o.add(U.id));
        const W = a.getState().activeSegment;
        W ? (S(W), o.has(W.id) ? t.updateSegment?.(W.id, Ss(W)) : (t.addSegment?.(W), o.add(W.id))) : P.segments.length;
        break;
      }
      case "text-flush":
        w();
        break;
      case "activity": {
        const P = `activity-${x.id}`;
        if (O(P)) {
          t.updateSegment?.(P, { activityType: x.activityType, content: x.content });
          break;
        }
        I.add(P), w();
        const W = { id: P, type: "activity", activityId: x.id, activityType: x.activityType, content: x.content };
        t.addSegment?.(W);
        break;
      }
      case "sources": {
        const P = new Map(_.map((U) => [U.id, U]));
        for (const U of Array.isArray(x.sources) ? x.sources : []) P.set(U.id, { ...P.get(U.id), ...U });
        _ = [...P.values()];
        const W = new Set(g.map((U) => JSON.stringify([U.start, U.end, U.marker, U.sources])));
        for (const U of Array.isArray(x.citations) ? x.citations : []) {
          const nt = JSON.stringify([U.start, U.end, U.marker, U.sources]);
          W.has(nt) || (W.add(nt), g.push(U));
        }
        A();
        break;
      }
      case "tool-start": {
        C(!1);
        const P = {
          id: `tool-${x.toolCallId}`,
          type: "tool_call",
          toolCall: { id: x.toolCallId, name: x.name, input: x.input },
          status: "pending"
        };
        c.set(P.id, P);
        const W = e.getToolRenderer(x.name);
        W && Yl(x.name, W), t.addSegment?.(P);
        break;
      }
      case "tool-awaiting-approval":
        t.updateSegment?.(`tool-${x.toolCallId}`, { status: "awaiting-approval" }), kt(t, "aparte-tool-approval-request", { toolCallId: x.toolCallId, toolName: x.name, input: x.input }, r);
        break;
      case "tool-approved":
        d(x.toolCallId, { status: "pending" });
        break;
      case "tool-rejected":
        d(x.toolCallId, {
          status: "rejected",
          result: x.reason,
          ...x.by ? { refusal: x.instruction ? { by: x.by, instruction: x.instruction } : { by: x.by } } : {}
        });
        break;
      case "tool-resolved":
        d(x.toolCallId, {
          status: "resolved",
          result: x.result,
          ...x.structuredResult !== void 0 ? { structuredResult: x.structuredResult } : {}
        });
        break;
      case "tool-aborted":
        d(x.toolCallId, x.cause ? { status: "aborted", abortCause: x.cause } : { status: "aborted" });
        break;
      case "tool-failed":
        d(x.toolCallId, { status: "failed", result: x.error });
        break;
      case "turn-limit-exceeded":
        x.scope === "global" ? t.addSegment?.({
          id: `max-turns-${pt()}`,
          type: "error",
          // The CHAT's text, in its language — resolved from the target, as the
          // reasoning default is: a client on the global config also answers a
          // chat with its own.
          content: (typeof Element < "u" && t instanceof Element ? $(t) : e).t("maxTurnsReached").replace("{n}", () => String(x.limit)),
          code: tt.MAX_TURNS_EXCEEDED
        }) : x.toolCallId && d(x.toolCallId, { status: "aborted", abortCause: "turn-limit" });
        break;
      case "run-aborted":
        R(), kt(t, "aparte-message-aborted", { messageId: s }, r);
        break;
      case "run-suspended": {
        R();
        const P = x.ticket;
        for (const W of x.pending) {
          if (W.agentId != null) continue;
          const U = `tool-${W.toolCallId}`, nt = { reason: W.reason, ...typeof P == "string" ? { ticket: P } : {} };
          t.updateSegment?.(U, { deferred: nt });
        }
        if (t.updateMessage?.(s, { status: "completed" }), x.usage)
          try {
            t.setUsage?.(s, x.usage);
          } catch {
          }
        kt(t, "aparte-message-paused", { messageId: s }, r);
        break;
      }
      case "run-done":
        if (R(), t.updateMessage?.(s, {
          status: "completed",
          ...x.finishReason ? { finishReason: x.finishReason } : {}
        }), x.usage)
          try {
            t.setUsage?.(s, x.usage);
          } catch {
          }
        break;
    }
  }, G = () => typeof Element < "u" && t instanceof Element ? $(t) : e, B = /* @__PURE__ */ new Set(), j = (x, P) => {
    const W = /* @__PURE__ */ new Set();
    for (const nt of /* @__PURE__ */ new Set([P, e, _t]))
      for (const Y of nt.getRunEventObservers()) W.add(Y);
    if (W.size === 0) return !1;
    const U = { messageId: s, target: t, ...r !== void 0 ? { targetId: r } : {}, config: P };
    for (const nt of W)
      try {
        nt(x, U);
      } catch (Y) {
        B.has(nt) || (B.add(nt), console.error("[aparte] A run-event observer threw; the reply goes on without it. Further throws from it in this reply are not reported.", Y));
      }
    return !0;
  };
  return (x) => {
    const P = G(), W = !i || j(x, P), U = x.agentId;
    if (U == null && x.type !== "agent-start" && x.type !== "agent-end") {
      N(x);
      return;
    }
    !W && !Ca.has(P) && (Ca.add(P), console.warn(
      `[aparte] A sub-agent's events arrived (agent "${String(U)}") and nothing draws them: they are kept out of the reply and not shown. Add @aparte/plugin-subagents (setupSubagents()) to show one line per sub-agent, or hear them with config.observeRunEvents().`
    )), x.type === "tool-awaiting-approval" && kt(t, "aparte-tool-approval-request", { toolCallId: x.toolCallId, toolName: x.name, input: x.input, agentId: U }, r);
  };
}
const Ca = /* @__PURE__ */ new WeakSet();
function Mp(n, t) {
  return {
    [Symbol.asyncIterator]() {
      const e = n.getReader(), s = () => {
        try {
          e.cancel().catch(() => {
          });
        } catch {
        }
      };
      return t.aborted ? s() : t.addEventListener("abort", s, { once: !0 }), {
        async next() {
          const { done: r, value: i } = await e.read();
          return r ? { done: !0, value: void 0 } : { done: !1, value: i };
        },
        async return() {
          t.removeEventListener("abort", s);
          try {
            await e.cancel();
          } catch {
          }
          try {
            e.releaseLock();
          } catch {
          }
          return { done: !0, value: void 0 };
        }
      };
    }
  };
}
new TextEncoder();
function Qr(n) {
  const t = typeof document > "u" ? void 0 : document.baseURI;
  try {
    return t ? new URL(n, t) : new URL(n);
  } catch {
    return null;
  }
}
function Op() {
  const n = typeof location > "u" ? null : location.origin;
  return n && n !== "null" ? n : null;
}
function $p(n) {
  try {
    const t = new URL(n);
    return t.protocol === "http:" || t.protocol === "https:" ? t.origin : null;
  } catch {
    return null;
  }
}
function Np(n, t) {
  return n === t ? !0 : typeof n == "function" || typeof t == "function" ? !1 : n.length === t.length && n.every((e, s) => e === t[s]);
}
const xa = /* @__PURE__ */ new WeakSet();
function $s(n) {
  if (typeof n == "function")
    return (r, i) => {
      try {
        const a = n(i ? i.href : r);
        return a === "load" || a === "drop" ? a : "hold";
      } catch (a) {
        return xa.has(n) || (xa.add(n), console.warn("[aparte] The image policy threw, so the pictures it was asked about are held.", a)), "hold";
      }
    };
  let t = !1, e = !1;
  const s = /* @__PURE__ */ new Set();
  for (const r of n) {
    const i = typeof r == "string" ? r.trim() : "";
    if (i === "*") t = !0;
    else if (i === "self" || i === "'self'") e = !0;
    else {
      const a = $p(i);
      a ? s.add(a) : console.warn(`[aparte] setImagePolicy: ${JSON.stringify(r)} is not 'self', '*' or an http(s) origin, so it allows nothing.`);
    }
  }
  return (r, i) => t || i && (s.has(i.origin) || e && i.origin === Op()) ? "load" : "hold";
}
const ce = /^[\u0000- ]*$/;
function Pp(n, t, e) {
  if (ce.test(t)) return "load";
  const s = Qr(t);
  if (s) {
    if (s.protocol === "data:" || s.protocol === "blob:") return "load";
    if (s.protocol !== "http:" && s.protocol !== "https:") return "drop";
  }
  const r = n(t, s);
  return r === "hold" && s !== null && e?.has(s.href) ? "load" : r;
}
const Xn = /* @__PURE__ */ new WeakMap();
function Dp(n, t) {
  const e = Qr(t);
  if (!e) return;
  let s = Xn.get(n);
  s || Xn.set(n, s = /* @__PURE__ */ new Set()), s.add(e.href);
}
function Hp(n) {
  return Xn.get(n);
}
function Bp(n) {
  Xn.delete(n);
}
const En = /[\t\n\f\r ]/, qp = /^(?:|\d+w(?: \d+h)?|(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?x)$/;
function Jl(n) {
  const t = [], e = n.length;
  let s = 0;
  for (; s < e; ) {
    for (; s < e && (En.test(n[s]) || n[s] === ","); ) s++;
    if (s >= e) break;
    const r = s;
    for (; s < e && !En.test(n[s]); ) s++;
    let i = n.slice(r, s);
    const a = [];
    if (i.endsWith(","))
      i = i.replace(/,+$/, "");
    else {
      let l = "", c = "in";
      for (; ; ) {
        const d = n[s];
        if (c === "in") {
          if (d === void 0) {
            l && a.push(l);
            break;
          }
          if (d === ",") {
            s++, l && a.push(l);
            break;
          }
          En.test(d) ? (l && a.push(l), l = "", c = "after") : (l += d, d === "(" && (c = "parens"));
        } else if (c === "parens") {
          if (d === void 0) {
            a.push(l);
            break;
          }
          l += d, d === ")" && (c = "in");
        } else {
          if (d === void 0) break;
          if (!En.test(d)) {
            c = "in";
            continue;
          }
        }
        s++;
      }
    }
    const o = a.join(" ");
    i && qp.test(o) && t.push({ url: i, descriptor: o });
  }
  return t;
}
function tc(n) {
  return n.map((t) => t.descriptor ? `${t.url} ${t.descriptor}` : t.url).join(", ");
}
function ec(n) {
  const t = Qr(n);
  if (t?.hostname) return t.hostname;
  const e = n.trim();
  return e.length > 48 ? `${e.slice(0, 47)}…` : e;
}
function Yn(n, t, e, s = !1) {
  const r = ec(n), i = t ? e.named(r, t) : e.load(r), a = e.icon;
  return `${s ? '<span class="aparte-tag aparte-image-held" role="button" tabindex="0"' : `<a class="aparte-tag aparte-image-held" href="${D(n)}" target="_blank" rel="noopener noreferrer"`} data-aparte-image="${D(n)}"${t ? ` data-aparte-image-alt="${D(t)}"` : ""} title="${D(e.load(r))}" aria-label="${D(i)}"><span class="aparte-image-held__icon" aria-hidden="true">${a}</span>` + (t ? `<span class="aparte-tag__label aparte-image-held__alt">${q(t)}</span>` : "") + `<span class="aparte-image-held__host">${q(r)}</span>${s ? "</span>" : "</a>"}`;
}
function nc(n, t) {
  return `<img src="${D(n)}" alt="${D(t)}" referrerpolicy="no-referrer">`;
}
const sc = /<(?:img|source)\b|data-aparte-image/i, Fp = "a[data-aparte-image], span[data-aparte-image]";
function Up(n, t, e) {
  return !n || !sc.test(n) ? n : typeof document > "u" ? Xp(n, t, e) : Wp(n, t, e);
}
function rc(n, t, e) {
  const s = t === void 0 ? [] : Jl(t), r = ce.test(n) ? s[0]?.url : n;
  if (r === void 0) return null;
  const i = e(r);
  if (i !== "load") return { decision: i, address: r, srcset: null };
  const a = s.filter((o) => e(o.url) === "load");
  return { decision: i, address: r, srcset: a.length ? tc(a) : null };
}
function ic(n, t, e) {
  if (!ce.test(n) && e(n) !== "load") return !1;
  if (t === void 0) return ce.test(n) ? !1 : null;
  const s = Jl(t).filter((r) => e(r.url) === "load");
  return s.length ? tc(s) : ce.test(n) ? !1 : null;
}
function Wp(n, t, e) {
  const s = document.createElement("template");
  s.innerHTML = n;
  const r = s.content;
  let i, a = !1;
  const o = (l) => {
    const c = document.createElement("template");
    return c.innerHTML = l, c.content;
  };
  for (const l of Array.from(r.querySelectorAll(Fp))) {
    const c = l.getAttribute("data-aparte-image") ?? "", d = l.getAttribute("data-aparte-image-alt") ?? "", h = ce.test(c) ? "drop" : t(c);
    a = !0, h === "drop" ? l.remove() : l.replaceWith(o(h === "load" ? nc(c, d) : Yn(c, d, i ??= e(), !!l.parentElement?.closest("a"))));
  }
  for (const l of Array.from(r.querySelectorAll("source"))) {
    const c = ic(l.getAttribute("src") ?? "", l.getAttribute("srcset") ?? void 0, t);
    if (c === !1) {
      l.remove(), a = !0;
      continue;
    }
    c === null ? l.hasAttribute("srcset") && (l.removeAttribute("srcset"), a = !0) : c !== l.getAttribute("srcset") && (l.setAttribute("srcset", c), a = !0);
  }
  for (const l of Array.from(r.querySelectorAll("img"))) {
    const c = rc(l.getAttribute("src") ?? "", l.getAttribute("srcset") ?? void 0, t);
    if (!c) {
      l.hasAttribute("srcset") && (l.removeAttribute("srcset"), a = !0), l.parentElement?.localName === "picture" && l.getAttribute("referrerpolicy") !== "no-referrer" && (l.setAttribute("referrerpolicy", "no-referrer"), a = !0);
      continue;
    }
    if (a = !0, c.decision === "drop") {
      l.remove();
      continue;
    }
    if (c.decision === "hold") {
      l.replaceWith(o(Yn(c.address, l.getAttribute("alt") ?? "", i ??= e(), !!l.closest("a"))));
      continue;
    }
    c.srcset === null ? l.removeAttribute("srcset") : l.setAttribute("srcset", c.srcset), l.setAttribute("referrerpolicy", "no-referrer");
  }
  return a ? s.innerHTML : n;
}
const zp = /* @__PURE__ */ new Set(["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript", "plaintext"]), Gp = /* @__PURE__ */ new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]), jp = /[A-Za-z]/, Kp = /^[a-z][a-z0-9_.:-]*$/;
function Ns(n, t, e) {
  const s = t.filter(([i]) => !(i in e) && Kp.test(i)), r = Object.entries(e).filter((i) => i[1] !== null);
  return `<${n}${[...s, ...r].map(([i, a]) => ` ${i}="${D(a)}"`).join("")}>`;
}
function Vp(n, t, e) {
  const s = new RegExp(`<(/?)${t}(?=[\\s/>])`, "g");
  s.lastIndex = e;
  let r = 1;
  for (let i = s.exec(n); i; i = s.exec(n))
    if (r += i[1] ? -1 : 1, r === 0) {
      const a = n.indexOf(">", i.index);
      return a < 0 ? n.length : a + 1;
    }
  return -1;
}
function Xp(n, t, e) {
  if (!n || !sc.test(n)) return n;
  const s = n.toLowerCase(), r = n.length;
  let i, a = "", o = 0, l = 0;
  const c = [];
  for (; o < r; ) {
    const d = n.indexOf("<", o);
    if (d < 0) {
      a += n.slice(o);
      break;
    }
    if (a += n.slice(o, d), n.startsWith("<!--", d)) {
      const S = n.indexOf("-->", d + 4), A = S < 0 ? r : S + 3;
      a += n.slice(d, A), o = A;
      continue;
    }
    const h = n[d + 1] === "/", u = d + (h ? 2 : 1);
    if (!jp.test(n[u] ?? "")) {
      a += "<", o = d + 1;
      continue;
    }
    const { tag: p, attrs: f, end: _ } = yl(n, u);
    if (_ < 0) {
      a += n.slice(d);
      break;
    }
    o = _;
    const g = n.slice(d, _);
    if (h) {
      p === "a" && (l = Math.max(0, l - 1));
      const S = c.lastIndexOf(p);
      S >= 0 && (c.length = S), a += g;
      continue;
    }
    const v = (S) => f.find(([A]) => A === S)?.[1];
    if (zp.has(p)) {
      const S = s.indexOf(`</${p}`, _), A = S < 0 ? r : S;
      a += g + n.slice(_, A), o = A;
      continue;
    }
    if ((p === "a" || p === "span") && v("data-aparte-image") !== void 0) {
      const S = Vp(s, p, _);
      S >= 0 ? o = S : p === "a" && (l += 1);
      const A = v("data-aparte-image") ?? "", C = v("data-aparte-image-alt") ?? "", b = ce.test(A) ? "drop" : t(A);
      b === "load" ? a += nc(A, C) : b === "hold" && (a += Yn(A, C, i ??= e(), l > 0));
      continue;
    }
    if (p === "a" && (l += 1), p === "source") {
      const S = ic(v("src") ?? "", v("srcset"), t);
      if (S === !1) continue;
      a += S === (v("srcset") ?? null) ? g : Ns(p, f, { srcset: S });
      continue;
    }
    if (p === "img") {
      const S = rc(v("src") ?? "", v("srcset"), t);
      if (!S) {
        const A = c[c.length - 1] === "picture";
        v("srcset") === void 0 && (!A || v("referrerpolicy") === "no-referrer") ? a += g : a += Ns(p, f, { srcset: null, ...A ? { referrerpolicy: "no-referrer" } : {} });
        continue;
      }
      S.decision === "hold" ? a += Yn(S.address, v("alt") ?? "", i ??= e(), l > 0) : S.decision === "load" && (a += Ns(p, f, { srcset: S.srcset, referrerpolicy: "no-referrer" }));
      continue;
    }
    !Gp.has(p) && !g.endsWith("/>") && c.push(p), a += g;
  }
  return a;
}
class tn extends DOMException {
  /**
   * Which of the two ways it ended.
   *
   * `'no-presenter'` is a developer's setup problem and `'aborted'` is a person
   * stopping something; a host that reports them the same way reports a bug as a
   * user action. The distinction is why this carries a field at all.
   */
  reason;
  constructor(t = "aborted") {
    super(
      t === "no-presenter" ? "No elicitation presenter is mounted, so the request could not be shown." : "The request ended without an answer.",
      "AbortError"
    ), this.reason = t;
  }
}
function Yp(n) {
  return n ? n.tagName?.toLowerCase() === "aparte-chat" || n.hasAttribute?.("data-aparte-chat") === !0 : !1;
}
function jt(n) {
  let t = n ?? null;
  for (; t; ) {
    if (Yp(t)) return t;
    t = t.parentElement;
  }
  return null;
}
class Ta {
  exact = /* @__PURE__ */ new Map();
  // Keyed by the pattern's spelling, so two RegExp instances of one pattern are one
  // entry; a Map keeps first-insertion order, which is the order patterns are tried in.
  patterns = /* @__PURE__ */ new Map();
  any;
  /** The value registered under exactly this matcher — not a resolution. */
  get(t) {
    return t instanceof RegExp ? this.patterns.get(String(t))?.value : t === "*" ? this.any : this.exact.get(t);
  }
  set(t, e) {
    if (t instanceof RegExp) {
      const s = String(t), r = this.patterns.get(s);
      r ? r.value = e : this.patterns.set(s, { re: t, value: e });
    } else t === "*" ? this.any = e : this.exact.set(t, e);
  }
  delete(t) {
    t instanceof RegExp ? this.patterns.delete(String(t)) : t === "*" ? this.any = void 0 : this.exact.delete(t);
  }
  /** The value that applies to a tool named `name`, and how specifically it names it. */
  resolve(t) {
    if (typeof t != "string") return;
    const e = this.exact.get(t);
    if (e !== void 0) return { value: e, level: "exact" };
    for (const { re: s, value: r } of this.patterns.values())
      if (t.search(s) !== -1) return { value: r, level: "pattern" };
    return this.any !== void 0 ? { value: this.any, level: "any" } : void 0;
  }
  /** Every value registered, whatever its matcher. */
  values() {
    const t = [...this.exact.values(), ...[...this.patterns.values()].map((e) => e.value)];
    return this.any !== void 0 && t.push(this.any), t;
  }
  clear() {
    this.exact.clear(), this.patterns.clear(), this.any = void 0;
  }
}
let Ia = !1;
const ne = {
  copy: !1,
  retry: !1,
  edit: !1,
  feedback: !1,
  info: !1
}, Cn = {
  attachmentPreview: !1,
  filePreview: !1
}, Ra = () => {
}, ac = /* @__PURE__ */ new WeakMap();
function Nt(n) {
  return ac.get(n) ?? 0;
}
function Tt(n) {
  ac.set(n, Nt(n) + 1);
}
const yr = /* @__PURE__ */ new Set(), xn = /* @__PURE__ */ new Set();
function Qp(n) {
  return yr.add(n), () => {
    yr.delete(n);
  };
}
function Ee(n) {
  xn.size === 0 && queueMicrotask(() => {
    const t = [...xn];
    xn.clear();
    for (const e of t)
      for (const s of [...yr])
        try {
          s(e);
        } catch (r) {
          console.error("[aparte] a renderer-change listener threw", r);
        }
  }), xn.add(n);
}
const Zp = (n) => n instanceof RegExp ? `re:${String(n)}` : `name:${n}`, Ps = ["hidden", "open", "details", "quiet"];
function Ds(n, t) {
  if (!n || !(t in n) || t in Object.prototype) return;
  const e = n[t];
  return typeof e == "function" ? e.bind(n) : void 0;
}
const La = /* @__PURE__ */ new WeakSet();
function Jp(n) {
  const t = /* @__PURE__ */ new Set();
  for (let e = n; e && e !== Object.prototype; e = Object.getPrototypeOf(e))
    for (const s of Object.getOwnPropertyNames(e)) s !== "constructor" && t.add(s);
  return [...t];
}
class wr {
  _markdownProvider;
  _streamingMarkdownProvider;
  _highlightProvider;
  _codeLanguageRenderers = /* @__PURE__ */ new Map();
  // HTML sanitizer applied to markdown/highlight PROVIDER output (untrusted,
  // LLM-authored) before it is injected via innerHTML. Default = built-in
  // zero-dep allowlist sanitizer; `null` disables it (trusted content only).
  _sanitizer = ji;
  // Which pictures a model or a tool chose load without a click (`image-policy.ts`): by
  // default only `data:` and `blob:`, which make no request.
  _imagePolicy = [];
  _imageDecider = $s([]);
  /** Whether the app named an image policy, the default included; see `decideImage`. */
  _imagePolicyNamed = !1;
  _systemPromptTemplate;
  _systemPromptVarsProvider;
  _statusRenderer;
  _errorRenderer;
  _attachmentRenderer;
  _siblingNavRenderer;
  _bubbleShellRenderer;
  _iconProvider;
  _avatarProvider;
  _keyProvider;
  /**
   * Sources added with `registerKeyProvider` — consulted before `_keyProvider`,
   * newest first (see `getKey`).
   */
  _extraKeyProviders = /* @__PURE__ */ new Set();
  _locale = Ve;
  _actions = [];
  _listeners = /* @__PURE__ */ new Set();
  // AI Provider Management (BYORK)
  _aiProviders = /* @__PURE__ */ new Map();
  /**
   * What `refreshProviderModels()` last brought back, per provider.
   *
   * `getCurrentModel()` reads it beside `provider.getModels()`, the SYNCHRONOUS,
   * hand-declared list, which every preset of `@aparte/provider-openai-compat`
   * leaves empty because a compat endpoint's list is fetched at runtime. Without
   * the fetched list the current model resolves to `undefined`, and its declared
   * capabilities are unknown: `AparteClient._toolsForCurrentModel()` still sends the
   * tools then, and it is the fetched list that lets a model which declares no
   * `function_calling` be honoured.
   */
  _fetchedModels = /* @__PURE__ */ new Map();
  _modelConfig = {};
  /** Opt-in: gate the composer (block send + grey out) until a model is selected. */
  _requireModelSelection = !1;
  /** Host policy for the elicitation panel's free-text escape — see {@link setElicitationOptions}. */
  _elicitationAllowOther = !0;
  _elicitationLayout = "stepped";
  /** Whether a single choice answers on the click (buttons) or keeps its radios + the composer's button. */
  _elicitationAnswerOnClick = !0;
  _elicitationFieldRenderer;
  // Transport: where chat requests go + how auth is handled (AparteDirectTransport = browser-direct).
  _transport = new Mu();
  _modelPreferenceProvider;
  // Per-call approval policy (a mode: plan / ask / auto). `null` = the tools' own flags.
  _approvalPolicy = null;
  // What makes the context smaller — `@aparte/plugin-compaction` registers itself here. `null` = nothing does.
  _compactor = null;
  // Conversation persistence (optional, agnostic)
  _conversationManager;
  /*
   * Human-in-the-loop: presents typed input requests (ask_user, tool approval,
   * forms). Registered by the `<aparte-elicitation>` Web Component.
   *
   * A STACK, not one slot, and that is the fix for two real failures. Since
   * `<aparte-elicitation>` entered `<aparte-chat>`'s default composition, two plain
   * `<aparte-chat>` elements on a page each register one on the same global config:
   *
   *   - the second clobbered the first, so chat A's approval opened under chat B, and
   *     answering it under B decided A's tool call;
   *   - and when B unmounted it cleared the slot, leaving chat A mounted with a
   *     perfectly good presenter that never re-registered — every later approval and
   *     every `ask_user` in A rejected `no-presenter` for the life of the page,
   *     silently, because the warning fires at most once per config.
   *
   * Each entry carries the element that registered it, so a request naming a `target`
   * is routed to the presenter in the SAME chat, as `AparteElicitationRequest.target`
   * documents ("used to resolve WHICH instance presents").
   */
  _elicitationPresenters = [];
  /** Warn once per config, not once per request — a tool loop can ask repeatedly. */
  _warnedNoPresenter = !1;
  /**
   * The tail of the queue of requests waiting for the human, or `null` when none is.
   *
   * One request reaches the presenter at a time — not because a presenter could not
   * cope, but because the COMPOSER cannot: it has one panel slot, and a second
   * request would clobber the first's DOM. A second request WAITS: answering it
   * `cancel` on the spot would be a refusal invented for a question nobody was ever
   * shown.
   *
   * Here rather than in the presenter because this is the only place that sees
   * EVERY request whatever raised it — a tool handler, an app's own button, the
   * tool-approval gate. A custom presenter registered by a consumer gets the same
   * protection for free.
   */
  _elicitationQueue = /* @__PURE__ */ new Map();
  // Tool Registry
  _tools = /* @__PURE__ */ new Map();
  // By exact name, pattern or '*' — see `tool-table.ts` for the one resolution rule.
  _toolRenderers = new Ta();
  /** {@link overrideToolRenderer}'s stacks: what each matcher held below every override. */
  /** Per matcher: what it held below every override, then one entry per override — an object of its own, so two overrides of the same renderer are told apart. */
  _toolRendererOverrides = /* @__PURE__ */ new Map();
  /** Bumped by `reset()`: a restore function from before it must not undo what came after. */
  _overrideGeneration = 0;
  _toolDisplays = new Ta();
  /** By activity type — see {@link registerActivityRenderer}. */
  _activityRenderers = /* @__PURE__ */ new Map();
  /** What a plugin says about a call, read after the app's display — see {@link setToolLineProvider}. */
  _toolLineProvider = null;
  /** Tagged blocks the stream parser recognises in the prose — see {@link registerStreamBlock}. */
  _streamBlocks = /* @__PURE__ */ new Map();
  _segmentDefaults = /* @__PURE__ */ new Map();
  /** One entry per registration, so each remover takes back its own — see {@link observeRunEvents}. */
  _runEventObservers = [];
  // Host handlers — what the app declares it can actually complete.
  _hostHandlers = { ...Cn };
  // Bubble Actions — APARTE_DEFAULT_BUBBLE_ACTIONS is the single source of truth
  // (init here, restored by reset(), and the fallback in getBubbleActions()).
  _bubbleActionsConfig = { ...ne };
  _turnSummary = null;
  _streamingCaret = !1;
  _dateSeparators = !1;
  // ─────────────────────────────────────────────────────────────────────────
  // Provider Setters (Dependency Injection)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Register a custom action button. `zones` places it in the message (bubble)
   * toolbar. Re-registering the same id overwrites it. Notifies mounted elements
   * so they re-render. A button in the composer is an `<aparte-composer-action>`
   * element you write in your markup, not a registry entry.
   */
  registerAction(t) {
    const e = this._actions.findIndex((s) => s.id === t.id);
    e !== -1 ? (console.warn(`[AparteConfig] Action with ID "${t.id}" already registered. Overwriting.`), this._actions[e] = t) : this._actions.push(t), this._notify();
  }
  /** All registered actions for a zone, sorted by `order` (lower first). */
  getActions(t) {
    return this._actions.filter((e) => e.zones.includes(t)).sort((e, s) => (e.order || 0) - (s.order || 0));
  }
  /** Remove a custom action by id (from every zone); notifies mounted elements if it existed. */
  unregisterAction(t) {
    const e = this._actions.length;
    this._actions = this._actions.filter((s) => s.id !== t), this._actions.length !== e && this._notify();
  }
  /**
   * Configure which action buttons appear in message bubbles.
   * Unset keys keep their defaults — see {@link APARTE_DEFAULT_BUBBLE_ACTIONS}: none, so
   * a message carries no button until you turn one on.
   *
   * @example
   * aparteGlobalConfig.setBubbleActions({ copy: true })              // core copies on its own
   * aparteGlobalConfig.setBubbleActions({ retry: true, edit: true }) // you run AparteClient
   * aparteGlobalConfig.setBubbleActions({ feedback: true })          // you listen for aparte-feedback; calls merge, so copy stays on
   * // Explicit per-role ordered sets (replace the flag defaults for that role):
   * aparteGlobalConfig.setBubbleActions({ user: ['edit', 'copy'], assistant: ['copy', 'thumbUp', 'thumbDown', 'retry'] })
   */
  setBubbleActions(t) {
    this._bubbleActionsConfig = { ...this._bubbleActionsConfig, ...t }, this._notify();
  }
  /**
   * Fold the steps of a reply behind one line: a run of reasoning and tool calls between two
   * pieces of text becomes "Worked 9 s · 7 tools", which opens on the usual rows. A call
   * waiting for approval, a call that failed and a tool drawn by its own renderer stay out
   * of the fold. Off by default; `false` turns it off again.
   *
   * @example
   * aparteGlobalConfig.setTurnSummary(true);
   * aparteGlobalConfig.setTurnSummary({ openWhileRunning: true }); // watch the steps, folded at the end
   */
  setTurnSummary(t) {
    this._turnSummary = t === !1 ? null : t === !0 ? {} : t, Tt(this), this._notify();
  }
  /** Draw a blinking caret where the words of a reply are arriving. Off by default. */
  setStreamingCaret(t) {
    this._streamingCaret = t, this._notify();
  }
  getStreamingCaret() {
    return this._streamingCaret;
  }
  /** Draw the date above the first message of each day. Off by default. */
  setDateSeparators(t) {
    this._dateSeparators = t, this._notify();
  }
  getDateSeparators() {
    return this._dateSeparators;
  }
  /** The options {@link setTurnSummary} left, or null when replies are not folded. */
  getTurnSummary() {
    return this._turnSummary;
  }
  /**
   * Declare which host-dependent affordances your app handles. Core renders the
   * trigger only for the ones you claim — see {@link AparteHostHandlersConfig}.
   *
   * @example
   * aparteGlobalConfig.setHostHandlers({ attachmentPreview: true });
   */
  setHostHandlers(t) {
    this._hostHandlers = { ...this._hostHandlers, ...t }, this._notify();
  }
  /** Returns the resolved host-handler declarations (undeclared = false). */
  // `Required<...>` rather than a hand-written shape: the previous signature
  // listed the three keys literally, so adding a fourth to the interface left
  // this method silently returning a type without it — the caller's read did not
  // even typecheck. Derived from the interface, a new declaration cannot be
  // forgotten here.
  getHostHandlers() {
    return {
      attachmentPreview: this._hostHandlers.attachmentPreview ?? Cn.attachmentPreview,
      filePreview: this._hostHandlers.filePreview ?? Cn.filePreview
    };
  }
  /** Returns the resolved bubble actions config (flag defaults applied; per-role sets passed through). */
  getBubbleActions() {
    return {
      copy: this._bubbleActionsConfig.copy ?? ne.copy,
      retry: this._bubbleActionsConfig.retry ?? ne.retry,
      edit: this._bubbleActionsConfig.edit ?? ne.edit,
      feedback: this._bubbleActionsConfig.feedback ?? ne.feedback,
      info: this._bubbleActionsConfig.info ?? ne.info,
      feedbackReasons: this._bubbleActionsConfig.feedbackReasons,
      user: this._bubbleActionsConfig.user,
      assistant: this._bubbleActionsConfig.assistant
    };
  }
  /**
   * Set a custom Markdown renderer (e.g., marked, maritime-it)
   */
  setMarkdownProvider(t) {
    this._markdownProvider = t, Tt(this), this._notify();
  }
  /**
   * Set an incremental (streaming) Markdown renderer provider. Optional —
   * when set, the chat bubble uses it to render the assistant message
   * token-by-token DURING streaming (incremental parse + DOM append, O(n)),
   * instead of re-parsing the whole string on every token. With no one-shot
   * `setMarkdownProvider` registered, it also renders a COMPLETE string
   * (`renderMarkdown`): a restored reply, a non-streaming provider's answer, a
   * stored segment — so a reply renders the same however it arrived. A registered
   * one-shot provider takes over for those, and re-renders the finished message
   * at full fidelity.
   */
  setStreamingMarkdownProvider(t) {
    this._streamingMarkdownProvider = t, Tt(this), this._notify();
  }
  /**
   * Create an incremental Markdown renderer bound to `target`, or `null` when
   * no streaming-markdown provider is registered (the caller then falls back
   * to the one-shot `renderMarkdown`).
   */
  createStreamingMarkdownRenderer(t) {
    return this._streamingMarkdownProvider ? this._streamingMarkdownProvider(t) : null;
  }
  /**
   * Set a custom Syntax Highlighter (e.g., prism, highlight.js, shiki)
   * Supports both synchronous and asynchronous renderers.
   */
  setHighlightProvider(t) {
    this._highlightProvider = t, Tt(this), this._notify();
  }
  /**
   * Whether a syntax-highlight provider is registered. Lets consumers (e.g.
   * the bubble) skip the highlight pass — and avoid replacing already-rendered
   * code blocks with the plain fallback — when no highlighter is installed.
   */
  hasHighlightProvider() {
    return !!this._highlightProvider;
  }
  /**
   * Draw a language — `math`, `mermaid` — wherever it appears in a reply, whichever
   * Markdown provider produced it. Messages already on screen are drawn again.
   *
   * @returns a disposer that removes the renderer, if it is still the one registered.
   * @example aparteGlobalConfig.registerCodeLanguageRenderer({ languages: ['math'], render: ({ source }) => katex.renderToString(source) });
   */
  registerCodeLanguageRenderer(t) {
    const e = t.languages.map((s) => s.toLowerCase());
    for (const s of e) this._codeLanguageRenderers.set(s, t);
    return Tt(this), this._notify(), () => {
      let s = !1;
      for (const r of e)
        this._codeLanguageRenderers.get(r) === t && (this._codeLanguageRenderers.delete(r), s = !0);
      s && (Tt(this), this._notify());
    };
  }
  /** The renderer registered for `language`, if any. */
  getCodeLanguageRenderer(t) {
    return this._codeLanguageRenderers.get(t.toLowerCase());
  }
  /** Whether a renderer is registered for `language`, or for any language when none is given. */
  hasCodeLanguageRenderer(t) {
    return t === void 0 ? this._codeLanguageRenderers.size > 0 : this._codeLanguageRenderers.has(t.toLowerCase());
  }
  /**
   * Replace or disable the HTML sanitizer applied to markdown/highlight
   * provider output before it is injected into the DOM. Defaults to a built-in
   * zero-dependency allowlist sanitizer.
   *
   * The function you pass REPLACES the built-in one, chat rules included: no
   * `aparte-` classes, no layout styles, no form controls, external links in a new
   * tab. DOMPurify's defaults hold none of the four, so chain it in front of
   * `defaultSanitizer` rather than in its place (the example below).
   *
   * @param sanitizer A sanitizer function, or `null` to DISABLE sanitization.
   *   Disabling exposes you to XSS from LLM-authored content — only do so for
   *   content you fully trust and have already sanitized upstream. `null` prints
   *   a console warning, once.
   * @example aparteGlobalConfig.setHtmlSanitizer((html) => defaultSanitizer(DOMPurify.sanitize(html)));
   */
  setHtmlSanitizer(t) {
    t !== this._sanitizer && (t === null && console.warn(
      "[aparte] HTML sanitization is now DISABLED (setHtmlSanitizer(null)). Model-authored HTML will be inserted verbatim. Pass a sanitizer (defaultSanitizer, or DOMPurify chained before it) unless you sanitize upstream yourself."
    ), this._sanitizer = t, Tt(this), this._notify());
  }
  /**
   * Run the active sanitizer over provider-produced HTML, then the image policy
   * ({@link AparteConfig.setImagePolicy | setImagePolicy}): a picture the policy does not let
   * load comes back as a link that loads it on a click. Public so a streaming-markdown
   * provider (which appends DOM directly, bypassing `renderMarkdown`) can apply the same
   * rules. The image policy runs whichever sanitizer is set, none included, so replacing it
   * does not turn a reply's pictures back into requests the reader never made.
   */
  sanitizeHtml(t) {
    const e = this._sanitizer ? this._sanitizer(t) : t;
    return Up(e, (s) => this.decideImage(s), () => this._heldImageWords());
  }
  /**
   * Which pictures a model or a tool chose load before the reader asks — in a reply's
   * Markdown, in a card, in a tool's details. By default only `data:` and `blob:` pictures,
   * which make no request: any other is held, drawn as a small link that says where it would
   * load from, and loads in place when the reader clicks it.
   *
   * The reason is that a picture fetches its address the moment it is shown, and a
   * prompt-injected model can write the conversation into that address. Name what you trust:
   *
   * - a list — `'self'` for the page's own origin, an origin (`'https://cdn.example.com'`),
   *   or `'*'` for every picture;
   * - a function, which gets the picture's address (resolved against the page) and answers
   *   `'load'`, `'hold'` or `'drop'`.
   *
   * Every picture that loads goes with `referrerpolicy="no-referrer"`. What is on screen is
   * drawn again under the new policy. A CSP `img-src` is the stronger rule beside this one:
   * it also checks where a redirect leads, which no script on the page can see.
   *
   * @example aparteGlobalConfig.setImagePolicy(['self', 'https://cdn.example.com']);
   * @example aparteGlobalConfig.setImagePolicy((url) => url.startsWith('https://images.example.com/') ? 'load' : 'hold');
   */
  setImagePolicy(t) {
    this._imagePolicyNamed = !0, !Np(t, this._imagePolicy) && (this._imagePolicy = typeof t == "function" ? t : [...t], this._imageDecider = $s(t), Tt(this), this._notify());
  }
  /**
   * What the picture at `url` does under this config's image policy: `'load'`, `'hold'`
   * (shown as a link that loads it on a click) or `'drop'`. For a plugin that draws pictures
   * itself, as `@aparte/plugin-cards` does: ask before setting a `src`, because setting it is
   * the request.
   */
  decideImage(t) {
    const e = Pp(this._imageDecider, t, Hp(this));
    return e === "hold" && this._noteHeldImage(t), e;
  }
  /**
   * The first picture the default policy holds, said once to the developer. A picture that
   * waits for a click with nothing in the console reads as a broken image to whoever wrote
   * the app, and the line that changes it cannot be guessed. Silent once the app names a
   * policy, whatever it is: `setImagePolicy([])` keeps the default and the silence.
   */
  _noteHeldImage(t) {
    this._imagePolicyNamed || Ia || (Ia = !0, console.warn(
      `[aparte] A picture from ${ec(t)} waits for the reader's click: pictures a model or a tool chose load only from the sources the app allows. To load yours, call aparteGlobalConfig.setImagePolicy(['https://cdn.example.com']); to keep holding them without this note, setImagePolicy([]). Why: https://apartejs.dev/guides/markdown/#pictures-a-reply-can-load`
    ));
  }
  /**
   * The reader chose to see the picture at `url`: from now on it loads wherever this
   * config's image policy would only have held it (a picture the policy drops stays
   * dropped). Core calls it when a held picture's link is clicked; a plugin calls it from
   * its own "Show images", then draws again. Nothing on screen is redrawn by this call.
   */
  showImage(t) {
    Dp(this, t);
  }
  /** What a held picture says, in this config's language. */
  _heldImageWords() {
    return {
      load: (t) => this.t("imageLoad").replace("{host}", () => t),
      named: (t, e) => this.t("imageLoadNamed").replace("{host}", () => t).replace("{alt}", () => e),
      icon: this.getIcon("image")
    };
  }
  /**
   * Set the system prompt template. Supports `{{key}}` placeholders resolved via setSystemPromptVarsProvider.
   * Pass undefined to clear.
   */
  setSystemPrompt(t) {
    this._systemPromptTemplate = t;
  }
  /** Get the raw system prompt template (with unresolved placeholders). */
  getSystemPromptTemplate() {
    return this._systemPromptTemplate;
  }
  /**
   * Register a function that returns a map of variable name → value.
   * Called at request time to resolve `{{key}}` placeholders in the system prompt.
   * Example: () => ({ 'settings.lang': 'French' })
   */
  setSystemPromptVarsProvider(t) {
    this._systemPromptVarsProvider = t;
  }
  /**
   * Resolve the system prompt template by substituting all `{{key}}` placeholders.
   * Returns null if no template is set or the template is empty after trimming.
   */
  resolveSystemPrompt() {
    if (!this._systemPromptTemplate?.trim()) return null;
    const t = this._systemPromptVarsProvider ? this._systemPromptVarsProvider() : {};
    return this._systemPromptTemplate.replace(/\{\{([^}]+)\}\}/g, (s, r) => t[r.trim()] ?? "").trim() || null;
  }
  /**
   * Set a custom Icon provider (e.g., Lucide, FontAwesome, Material). It replaces the
   * whole set, icons added with `registerIcons` included; a name it leaves out keeps
   * core's drawing.
   * @param provider Object implementing AparteIconProvider interface
   */
  setIconProvider(t) {
    this._iconProvider = t, this._notify();
  }
  /**
   * Add icons to the set, or redraw some of it, keeping the others. A name core does not
   * draw is welcome: an action's `icon`, `<aparte-composer-action icon>` and
   * `<aparte-icon name>` then find it. To type such a name, merge it into
   * `AparteIconProvider`: `declare module '@aparte/core' { interface AparteIconProvider { share?: () => string } }`.
   *
   * @example
   * aparteGlobalConfig.registerIcons({ share: () => '<svg class="aparte-icon" viewBox="0 0 24 24">…</svg>' });
   * aparteGlobalConfig.registerAction({ id: 'share', icon: 'share', label: 'Share', zones: ['bubble'] });
   */
  registerIcons(t) {
    const e = this._iconProvider;
    if (e && La.has(e))
      Object.assign(e, t);
    else {
      const s = Object.assign(Object.create(e ?? null), t);
      La.add(s), this._iconProvider = s;
    }
    this._notify();
  }
  /**
   * The icon set as a **complete** provider: every name resolves, falling back
   * to `APARTE_DEFAULT_ICON_FALLBACKS` for anything the registered provider doesn't
   * implement. Callers (bubble action bar, composer controls) can therefore
   * invoke `icons.copy()` unconditionally.
   *
   * A registered provider may implement only a subset of the names; the missing ones
   * fall back, so `icons.retry()` never throws "is not a function".
   */
  getIconProvider() {
    const t = this._iconProvider, e = {};
    for (const s of Object.keys(wn))
      e[s] = Ds(t, s) ?? (() => wn[s]);
    for (const s of Jp(t)) {
      const r = Ds(t, s);
      r && !(s in e) && (e[s] = r);
    }
    return e;
  }
  /**
   * Set a custom avatar renderer. Lets framework consumers (Angular,
   * React, Vue, …) mount live components in place of the default
   * avatar text/image. Cleared by passing `null`.
   */
  setAvatarProvider(t) {
    this._avatarProvider = t ?? void 0, this._notify();
  }
  /** Returns the registered avatar provider, or null if none. */
  getAvatarProvider() {
    return this._avatarProvider ?? null;
  }
  /**
   * Set a custom typing-indicator renderer. Replaces the inner markup of
   * `<aparte-chat-status>` (avatar + animated dots + text) while the element keeps
   * owning show/hide. Return a string or an HTMLElement. Cleared by passing
   * `null`. Notifies mounted components so a live skin switch re-renders.
   */
  setStatusRenderer(t) {
    this._statusRenderer = t ?? void 0, this._notify();
  }
  /** Returns the registered status renderer, or null if none. */
  getStatusRenderer() {
    return this._statusRenderer ?? null;
  }
  /**
   * Set a custom error renderer. Drives the content of error bubbles (the
   * built-in `error` segment) — return a string or an HTMLElement, e.g. a
   * friendly message with a retry button. The bubble also carries `data-error`
   * on its `.aparte-message` while errored, for CSS theming. Cleared with `null`.
   * Notifies mounted components so a live change re-renders.
   */
  setErrorRenderer(t) {
    this._errorRenderer = t ?? void 0, this._notify();
  }
  /** Returns the registered error renderer, or null if none. */
  getErrorRenderer() {
    return this._errorRenderer ?? null;
  }
  /**
   * Set a custom attachment renderer. Replaces the chip rendered for each
   * attachment on a user message (default: image thumbnail / file chip) — return
   * a string or an HTMLElement, e.g. a PDF preview. You own the interactions for
   * custom output (see {@link AparteAttachmentRenderer}). Cleared with `null`.
   * Notifies mounted components so a live change re-renders.
   */
  setAttachmentRenderer(t) {
    this._attachmentRenderer = t ?? void 0, this._notify();
  }
  /** Returns the registered attachment renderer, or null if none. */
  getAttachmentRenderer() {
    return this._attachmentRenderer ?? null;
  }
  /**
   * Set a custom sibling (branch) position indicator. Replaces the `‹ N / M ›`
   * counter between the prev/next arrows — e.g. dots. Return a string or an
   * HTMLElement (see {@link AparteSiblingNavRenderer}); the arrows keep their
   * behavior. Cleared with `null`. Notifies mounted components.
   */
  setSiblingNavRenderer(t) {
    this._siblingNavRenderer = t ?? void 0, this._notify();
  }
  /** Returns the registered sibling-nav renderer, or null if none. */
  getSiblingNavRenderer() {
    return this._siblingNavRenderer ?? null;
  }
  /**
   * Set a custom bubble shell renderer (advanced) — replaces the structural
   * skeleton of `<aparte-chat-bubble>` while keeping its behavior. The shell must
   * honor the class-hook contract (root `.aparte-message`, region hooks) — see
   * {@link AparteBubbleShellRenderer}. For a fully custom element use `renderBubble`
   * (wrapper) instead. Cleared with `null`. Notifies mounted components.
   */
  setBubbleShellRenderer(t) {
    this._bubbleShellRenderer = t ?? void 0, this._notify();
  }
  /** Returns the registered bubble-shell renderer, or null if none. */
  getBubbleShellRenderer() {
    return this._bubbleShellRenderer ?? null;
  }
  /**
   * Set the current locale
   * @param locale AparteLocale object defining all strings
   */
  setLocale(t) {
    this._locale = t, this._notify();
  }
  /**
   * Restore the built-in English locale (the same `APARTE_DEFAULT_LOCALE` core ships
   * with). Counterpart of {@link setLocale} for language toggles — avoids
   * having to import `APARTE_DEFAULT_LOCALE` yourself.
   */
  resetLocale() {
    this._locale = Ve, this._notify();
  }
  /**
   * Get the current locale.
   *
   * Typed as the closed list PLUS the open half, and the asymmetry is the point:
   * `t()` keys on `AparteLocale` alone — a typo there is a compile error — while a
   * plugin reading its OWN key off this object gets `string | undefined` and
   * supplies its own default at the call site.
   *
   * `t()` is the one that has to be narrow, because it is the one that fails
   * silently: it returns `''` for a key nobody declared, and an empty label is
   * invisible on screen and in the console. A misspelt read here is `undefined`,
   * which the `?? 'fallback'` every caller already writes turns into the default.
   */
  getLocale() {
    return this._locale;
  }
  /**
   * Extend the current locale with partial translations.
   * Useful for plugins to register their own strings.
   * @param translations Partial locale object to merge
   */
  extendLocale(t) {
    this._locale = { ...this._locale, ...t }, this._notify();
  }
  getIcon(t) {
    const e = Ds(this._iconProvider, t);
    return e ? e() : Object.prototype.hasOwnProperty.call(wn, t) ? wn[t] : void 0;
  }
  /**
   * Set a custom Key provider (e.g., AparteVault override)
   */
  setKeyProvider(t) {
    this._keyProvider = t;
  }
  /**
   * Add a key source beside the one {@link AparteConfig.setKeyProvider | setKeyProvider()}
   * holds, and return the function that removes it. The sources are asked in the order they
   * were added, then `setKeyProvider`'s, and the first answer wins. `AparteClient`'s
   * `keyResolver` is registered this way, so the model selector can list a cloud provider's
   * models too. Each call is a source of its own, even with the same function.
   * @example
   * const release = aparteGlobalConfig.registerKeyProvider((providerId) =>
   *     providerId === 'openrouter' ? localStorage.getItem('openrouter-key') : undefined);
   * // when what owns the key goes away:
   * release();
   */
  registerKeyProvider(t) {
    const e = (s) => t(s);
    return this._extraKeyProviders.add(e), () => {
      this._extraKeyProviders.delete(e);
    };
  }
  /**
   * The credentials for a provider: a key, or the `{ apiKey, endpoint }` record
   * the transport and `fetchModels` both read.
   *
   * ONE resolution order, so the chat and the model list cannot disagree about
   * what an endpoint is: a registered resolver (`AparteClient`'s `keyResolver`)
   * first — which is the precedence the client has always documented — then
   * `setKeyProvider`.
   *
   * Registered sources answer NEWEST first. A page that mounts a second chat, or
   * remounts one to swap its options — the swap the wrappers document — leaves
   * more than one source here, and insertion order made the first resolver the
   * page ever registered answer for every later one, so the key could not be
   * changed. The snapshot is deliberate too: a source torn down while an earlier
   * one is being awaited must not shift the iteration underneath it.
   */
  async getKey(t) {
    for (const e of [...this._extraKeyProviders].reverse()) {
      const s = await e(t);
      if (s) return s;
    }
    if (this._keyProvider)
      return await this._keyProvider(t) || void 0;
  }
  /**
   * Fetch a provider's models, with the key and endpoint its key sources answer, so a
   * component that lists models never handles a key. The list is kept, and
   * `getCurrentModel()` reads the selected model's capabilities from it. Answers `[]` for an
   * unknown provider, one with no `fetchModels`, or a fetch that fails (with a console warning).
   */
  async refreshProviderModels(t) {
    const e = this._aiProviders.get(t);
    if (!e || !e.fetchModels) return [];
    try {
      const s = await this.getKey(t), r = await e.fetchModels(s), i = this._fetchedModels.get(t);
      if (r.length === 0 && i?.length) return i;
      const a = this.getCurrentModel()?.contextWindow;
      return this._fetchedModels.set(t, r), this.getCurrentModel()?.contextWindow !== a && this._notify(), r;
    } catch (s) {
      return console.warn(`[AparteConfig] Failed to refresh models for ${t}`, s), [];
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // AI Provider Management (BYORK - Bring Your Own Key)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Register one or more AI providers (e.g., OpenRouter, Gemini, Anthropic).
   *
   * When this leaves exactly one provider registered, offering exactly one model it knows
   * without a request (a scripted or an in-browser provider), and no model is selected,
   * that model is selected. A provider that lists its models over the network selects
   * nothing: name one with {@link AparteConfig.setModelConfig | setModelConfig()}, or let the
   * person pick in `<aparte-model-selector>`.
   * @param providers AparteAIProvider implementations
   * @example
   * aparteGlobalConfig.registerAIProvider(OpenRouterProvider);
   * aparteGlobalConfig.registerAIProvider(GeminiProvider, AnthropicProvider);
   */
  registerAIProvider(...t) {
    for (const e of t)
      e && (this._aiProviders.has(e.id) && console.warn(`[AparteConfig] AI Provider "${e.id}" already registered. Overwriting.`), this._aiProviders.set(e.id, e));
    if (!this.hasSelectedModel() && this._aiProviders.size === 1) {
      const e = [...this._aiProviders.values()][0], s = e.getModels();
      s.length === 1 && (this._modelConfig = { ...this._modelConfig, defaultProvider: e.id, defaultModel: s[0].id });
    }
    this._notify();
  }
  /**
   * Unregister an AI provider
   */
  unregisterAIProvider(t) {
    this._aiProviders.delete(t), this._notify();
  }
  /**
   * Get all registered AI providers
   * Optionally filtered by enabled providers in config
   */
  getAIProviders() {
    const t = Array.from(this._aiProviders.values()), e = this._modelConfig.enabledProviders;
    return e?.length ? t.filter((r) => e.includes(r.id)) : t;
  }
  /**
   * Get a specific AI provider by ID
   */
  getAIProvider(t) {
    return this._aiProviders.get(t);
  }
  /**
   * Set the transport that decides where chat requests go and how auth is
   * handled. Defaults to {@link AparteDirectTransport} (browser-direct — BYOK/local).
   * Use a `AparteBackendTransport` to keep API keys server-side (recommended for
   * production).
   */
  setTransport(t) {
    this._transport = t;
  }
  /** Get the active transport (AparteDirectTransport by default). */
  getTransport() {
    return this._transport;
  }
  /**
   * Register a model preference provider for agnostic persistence.
   * The host app decides how/where to store the selected provider & model.
   * `load` answers `{ provider, model }` — the names {@link AparteModelPreference} reads —
   * and {@link AparteConfig.restoreModelPreference | restoreModelPreference()} applies it.
   * @example
   * aparteGlobalConfig.setModelPreferenceProvider({
   *   save: (provider, model) => localStorage.setItem('model', JSON.stringify({ provider, model })),
   *   load: () => JSON.parse(localStorage.getItem('model') ?? 'null'),
   * });
   * aparteGlobalConfig.restoreModelPreference();
   */
  setModelPreferenceProvider(t) {
    this._modelPreferenceProvider = t;
  }
  /**
   * Decide per CALL whether a tool runs, asks, or is refused — a mode, not a flag.
   *
   * With a policy registered, the client's default approval channel evaluates it for
   * every tool call: `allow` runs without asking, `ask` puts the call to the person
   * exactly as a `needsApproval` tool is, `deny` refuses it with the policy's own
   * `reason` as what the model reads. `undefined` leaves the tool's `needsApproval`
   * to decide, as before. `null` removes the policy.
   *
   * `@aparte/plugin-approval` builds one from a classification of your tool names and
   * a switchable mode (plan / ask / auto-edit / auto); a host that owns its own
   * `approvalResolver` on `AparteClientOptions` is not affected — that resolver
   * already decides everything.
   *
   * @example
   * ```ts
   * aparteGlobalConfig.setApprovalPolicy((call) =>
   *   call.name === 'run_command'
   *     ? { verdict: 'ask' }
   *     : { verdict: 'allow' });
   * ```
   */
  setApprovalPolicy(t) {
    this._approvalPolicy = t, this._notify();
  }
  /** The registered approval policy, or `null`. */
  getApprovalPolicy() {
    return this._approvalPolicy;
  }
  /**
   * Register what makes the context smaller: the gauge's Compact now, a separator's
   * Retry and the client's pre-flight and overflow retry call it. `null` removes it.
   *
   * `@aparte/plugin-compaction`'s `setupCompaction()` registers itself here; core never
   * compacts on its own, so a page without a compactor has a gauge that measures and a
   * separator whose Retry falls back to the `aparte-compact` event. A chat reads the one
   * on ITS config first (`resolveConfig(chat).getCompactor()`), then the client's.
   *
   * Notifies like every other registration: a mounted gauge has to hear that "Compact
   * now" became possible after it was drawn, or went away.
   */
  setCompactor(t) {
    this._compactor = t, this._notify();
  }
  /** The registered compactor, or `null`. */
  getCompactor() {
    return this._compactor;
  }
  /**
   * What the policy says about one call, with the tool's own `needsApproval` as the
   * answer when it has no opinion. The one place the two are combined, so the client's
   * gate predicate and its approval channel cannot disagree.
   */
  ruleOnToolCall(t) {
    const e = this._tools.get(t.name)?.tool, s = this._approvalPolicy?.(t, e);
    return s || { verdict: e?.needsApproval ? "ask" : "allow" };
  }
  /**
   * Restore the saved model preference via the registered provider.
   * Should be called once at app startup, before any component mounts.
   * No-op if no provider is registered or nothing was saved. The saved selection is
   * applied without being saved again.
   */
  restoreModelPreference() {
    if (!this._modelPreferenceProvider) return null;
    const t = this._modelPreferenceProvider.load();
    return t?.provider && t?.model ? (this._modelConfig = { ...this._modelConfig, defaultProvider: t.provider, defaultModel: t.model }, this._notify(), t) : null;
  }
  /**
   * Select the default provider and model, merged over the current selection. With a
   * model-preference provider registered and both set, the selection is saved through it.
   */
  setModelConfig(t) {
    this._modelConfig = { ...this._modelConfig, ...t }, this._modelPreferenceProvider && this._modelConfig.defaultProvider && this._modelConfig.defaultModel && this._modelPreferenceProvider.save(this._modelConfig.defaultProvider, this._modelConfig.defaultModel), this._notify();
  }
  /**
   * Subscribe to configuration changes
   * @returns Unsubscribe function
   */
  subscribe(t) {
    return this._listeners.add(t), () => this._listeners.delete(t);
  }
  _notify() {
    this._listeners.forEach((t) => {
      try {
        t();
      } catch (e) {
        console.error("[AparteConfig] A config-change listener threw", e);
      }
    }), typeof window < "u" && window.dispatchEvent(new CustomEvent("aparte-config-change", {
      detail: { config: this, modelConfig: this._modelConfig }
    }));
  }
  /**
   * Get current model configuration
   */
  getModelConfig() {
    return { ...this._modelConfig };
  }
  /**
   * True when the model config has BOTH a provider and a model selected — i.e.
   * the chat can actually send. Used by the composer's `require-model` gate.
   */
  hasSelectedModel() {
    return !!(this._modelConfig.defaultProvider && this._modelConfig.defaultModel);
  }
  /**
   * Elicitation policy: whether a choice offers a free-text "Other…" escape.
   *
   * This is the HOST's decision, not the model's: the `ask_user` schema handed to the
   * model carries no `allow_other` field, because a small model fills a field it does
   * not understand (a question with `allow_other: true` and no options renders a radio
   * list whose only entry is "Other…"). Default `true`. A direct `requestUserInput`
   * caller can still set `allowOther` per field; that is the app talking, and it wins.
   *
   * `layout` decides how a form of SEVERAL questions is presented.
   * `'stepped'` (default) asks them one at a time with a chip per question;
   * `'stacked'` puts them all in the panel at once — the shape of an MCP elicitation
   * FORM collecting structured data, which is why it stays an option, but not the
   * right default for two different questions asked mid-conversation.
   *
   * `answerOnClick` decides how a question asked ON ITS OWN with a single choice — an
   * `enum` without `multiple` or a `default`, a `boolean` without a `default` — is
   * answered. `true` (default) renders the options as buttons and the click is the
   * answer: one decision, one gesture, the shape every chat product uses for "which
   * one?". `false` keeps the radios and the composer's button, so a person can
   * change their mind before committing — the shape a form or a screen reader
   * flow may prefer, and the one a host that wants a uniform "select, then send"
   * across every question asks for. A form of several questions always collects and
   * submits, whatever this says.
   */
  setElicitationOptions(t) {
    t.allowOther !== void 0 && (this._elicitationAllowOther = t.allowOther), t.layout !== void 0 && (this._elicitationLayout = t.layout), t.answerOnClick !== void 0 && (this._elicitationAnswerOnClick = t.answerOnClick), this._notify();
  }
  /** The elicitation policy (see {@link setElicitationOptions}). */
  getElicitationOptions() {
    return { allowOther: this._elicitationAllowOther, layout: this._elicitationLayout, answerOnClick: this._elicitationAnswerOnClick };
  }
  /**
   * Render one field of the question panel yourself.
   *
   * See {@link AparteElicitationFieldRenderer}. Return `null` for a field to let
   * the built-in render it, which is what makes overriding a single kind practical.
   * Pass `null` here to remove the renderer.
   */
  setElicitationFieldRenderer(t) {
    this._elicitationFieldRenderer = t ?? void 0, this._notify();
  }
  /** The custom field renderer, if one is registered. */
  getElicitationFieldRenderer() {
    return this._elicitationFieldRenderer;
  }
  /**
   * Opt-in UX: when enabled, `<aparte-composer>` blocks sending and greys out
   * until {@link hasSelectedModel} is true (e.g. while the model selector is
   * still fetching its list). Off by default so single-model / backend setups
   * that never select a model are unaffected.
   */
  setRequireModelSelection(t) {
    this._requireModelSelection !== t && (this._requireModelSelection = t, this._notify());
  }
  /** Whether the composer should gate on model selection (see {@link setRequireModelSelection}). */
  getRequireModelSelection() {
    return this._requireModelSelection;
  }
  /**
   * Get the currently selected model object, if available synchronously.
   * Returns undefined if no provider/model is selected, or if the provider's
   * models are only available asynchronously (fetchModels).
   */
  getCurrentModel() {
    const { defaultProvider: t, defaultModel: e } = this._modelConfig;
    if (!t || !e) return;
    const s = this._aiProviders.get(t);
    if (!s) return;
    const i = this._fetchedModels.get(t)?.find((o) => o.id === e);
    if (i) return i;
    const a = s.getModels();
    if (a instanceof Promise) {
      console.warn(
        `[AparteConfig] Provider "${t}".getModels() returned a Promise — it is ignored here, so this model resolves to undefined and nothing can read its capabilities. getModels() must return the list synchronously; implement fetchModels() for async fetching.`
      );
      return;
    }
    return a.find((o) => o.id === e);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Public Rendering Methods (with Fallbacks)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * The locale's string for `key`, or the default (English) locale's when the locale
   * leaves it out; `''` for a key neither declares.
   */
  t(t) {
    const e = this._locale[t] || Ve[t];
    return e === void 0 ? "" : e;
  }
  /**
   * Render a complete Markdown string to HTML: the one-shot provider when one is
   * registered, else the incremental provider run over the whole string, else core's
   * default (escape + `<br>`).
   *
   * The middle step is what makes the incremental provider enough on its own. Without
   * it a reply rendered two ways depending on how it arrived: rich while it streamed,
   * escaped source once it came back complete — a restored conversation, a
   * non-streaming provider, a stored segment. Same parser, same sanitizer, so the two
   * cannot disagree. It needs a `document` to write into; without one (a server render)
   * the default answers, as before.
   */
  renderMarkdown(t) {
    if (this._markdownProvider)
      try {
        return this.sanitizeHtml(this._markdownProvider(t));
      } catch (e) {
        console.warn("[AparteConfig] Markdown provider failed, using fallback:", e);
      }
    else if (this._streamingMarkdownProvider && typeof document < "u")
      try {
        const e = document.createElement("div"), s = this._streamingMarkdownProvider(e);
        return s.write(t), s.end(), this.sanitizeHtml(e.innerHTML);
      } catch (e) {
        console.warn("[AparteConfig] Streaming Markdown provider failed on a complete string, using fallback:", e);
      }
    return this._defaultMarkdownRenderer(t);
  }
  /**
   * Highlight code block
   * Fallback: Returns raw code wrapped in `<pre><code>`
   * Supports Promise if provider is async/streaming
   *
   * @param options.fallback `false` rejects when the highlight provider fails, instead of
   *   answering the plain block: for a caller that keeps what it highlighted, so a
   *   failure (a highlighter still loading its grammars) is tried again rather than kept.
   */
  async highlightCode(t, e, s = {}) {
    if (this._highlightProvider)
      try {
        const r = this._highlightProvider(t, e), i = r instanceof Promise ? await r : r;
        return this.sanitizeHtml(i);
      } catch (r) {
        if (console.warn("[AparteConfig] Highlight provider failed, using fallback:", r), s.fallback === !1) throw r;
      }
    return this._defaultHighlightRenderer(t);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Tool Registry
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Register a tool and its handler together.
   * The handler is called when the AI invokes the tool during streaming.
   * @example
   * aparteGlobalConfig.registerTool(askUserTool, askUserHandler);
   */
  registerTool(t, e) {
    this._tools.set(t.name, { tool: t, handler: e });
  }
  /** Unregister a tool by name */
  unregisterTool(t) {
    this._tools.delete(t);
  }
  /** Get all registered tool definitions (to pass in AparteChatRequest) */
  getTools() {
    return Array.from(this._tools.values()).map((t) => t.tool);
  }
  /**
   * The registered tools' own `systemPrompt`s, in registration order with a blank line
   * between, or `null` if none sets one. `AparteClient` sends them with every request, as a
   * system message after the app's own ({@link AparteConfig.resolveSystemPrompt | resolveSystemPrompt()});
   * a request you assemble yourself should send them the same way, or the model loses the
   * tools' instructions.
   *
   * Pass the tools the request actually carries, and only theirs come back: an instruction
   * to use a tool the model was not given (a model without `function_calling`, a turn sent
   * with `toolChoice: 'none'`) has it describe a call it cannot make. Without the argument,
   * every registered tool's.
   */
  resolveToolSystemPrompts(t) {
    const e = t ? new Set(t.map((r) => r.name)) : null, s = Array.from(this._tools.values()).filter((r) => !e || e.has(r.tool.name)).map((r) => r.tool.systemPrompt?.trim()).filter((r) => !!r);
    return s.length ? s.join(`

`) : null;
  }
  /** Get the handler for a tool by name */
  getToolHandler(t) {
    return this._tools.get(t)?.handler;
  }
  /**
   * Register a per-tool segment renderer.
   * Controls what appears in the chat bubble when the AI calls this tool.
   * Use this instead of the generic `tool_call` segment renderer for tool-specific UI.
   *
   * A renderer that needs a popover (a `<aparte-select>`, a menu) cannot open one
   * inside the row: the bubble is `content-visibility: auto`, which makes it the
   * containing block for `position: fixed` descendants and clips a popover to its
   * own box. Mount it on `document.body` and position it from the trigger's rect
   * instead — see [Custom tool
   * renderer](https://apartejs.dev/guides/tools/#custom-tool-renderer).
   *
   * The matcher is an exact name, a RegExp, or `'*'` — the same rule as
   * {@link registerToolDisplay}: the exact name wins, then the first pattern registered,
   * then `'*'`, which is one renderer for every tool without its own.
   *
   * @example
   * // Custom pill for a web-search tool
   * aparteGlobalConfig.registerToolRenderer('web_search', { render: (seg) => `<div class="aparte-tool-label">Searching...</div>` });
   *
   * Calls already on screen follow: those this registration now draws are drawn again
   * by it (the renderer that drew them before gets its `cleanup`), and nothing else on
   * the page is touched.
   *
   * @example
   * // One look for every tool an MCP server brings
   * aparteGlobalConfig.registerToolRenderer(/^mcp__/, { render: (seg) => myMcpCard(seg) });
   */
  registerToolRenderer(t, e) {
    this._toolRenderers.get(t) !== e && (this._toolRenderers.set(t, e), Ee(this));
  }
  /**
   * Put `renderer` over whatever this matcher holds, and get back the function that takes
   * it off again — the registration a component makes for as long as it is mounted.
   *
   * Overrides stack per matcher. The function restores what was there before THIS
   * override, and taking off an override that is no longer on top changes nothing on
   * screen: two components declaring the same tool, the newer wins, and unmounting the
   * older does not take the newer's away. When the last one goes, the matcher holds what
   * it held before the first — another registration, or nothing. Calls on screen follow
   * each change, as with {@link registerToolRenderer}. The returned function is safe to
   * call twice.
   *
   * @example
   * const restore = aparteGlobalConfig.overrideToolRenderer('get_weather', weatherCard);
   * // …later, when the component that declared it unmounts:
   * restore();
   */
  overrideToolRenderer(t, e) {
    const s = Zp(t), r = this._toolRenderers.get(t);
    let i = this._toolRendererOverrides.get(s);
    i ? i[i.length - 1].renderer !== r && i.splice(0, i.length, { renderer: r }) : (i = [{ renderer: r }], this._toolRendererOverrides.set(s, i));
    const a = { renderer: e };
    i.push(a), this.registerToolRenderer(t, e);
    const o = this._overrideGeneration;
    let l = !1;
    return () => {
      if (l || o !== this._overrideGeneration) return;
      l = !0;
      const c = i.indexOf(a);
      if (c <= 0) return;
      const d = c === i.length - 1;
      if (i.splice(c, 1), i.length === 1 && this._toolRendererOverrides.get(s) === i && this._toolRendererOverrides.delete(s), !d || this._toolRenderers.get(t) !== e) return;
      const h = i[i.length - 1].renderer;
      h ? this.registerToolRenderer(t, h) : this.unregisterToolRenderer(t);
    };
  }
  /**
   * Field defaults for a segment TYPE, filled in when a segment enters a message.
   *
   * One function for every type rather than one per field: a `setThinkingOpen()`
   * would need a sibling the next time any type wanted a default, and the type key
   * is a string, so a consumer's own segment type is covered by the same call.
   *
   * The problem it solves: a consumer streaming a reply does not CONSTRUCT its
   * segments — the parser does — so a per-segment field cannot express "reasoning
   * blocks open in my app": per-segment fields only reach segments you build yourself.
   *
   * Applied where identity is stamped (`utils/segments.ts`), so it covers every
   * path a segment can arrive by — the parser, `addSegment`, and the segments
   * seeded on an `appendMessage` — and no renderer has to look anything up.
   *
   * A field the producer set always wins, and identity is never defaulted. Read at
   * insertion and baked in: changing a default later does not reach segments already
   * on screen, because a block the reader opened has state the data does not.
   *
   * @example
   * // Reasoning blocks arrive open in this app, streaming or settled.
   * aparteGlobalConfig.setSegmentDefaults('thinking', { collapsed: false });
   *
   * @example
   * // A consumer's own type, same call.
   * aparteGlobalConfig.setSegmentDefaults('my-chart', { theme: 'dark' });
   */
  setSegmentDefaults(t, e) {
    this._segmentDefaults.set(t, { ...e });
  }
  /** The defaults registered for a type, or undefined. */
  getSegmentDefaults(t) {
    return this._segmentDefaults.get(t);
  }
  /** Drop the defaults for a type. */
  clearSegmentDefaults(t) {
    this._segmentDefaults.delete(t);
  }
  /** Unregister the renderer registered under this matcher. Calls on screen it drew go back to core's row. */
  unregisterToolRenderer(t) {
    this._toolRenderers.get(t) !== void 0 && (this._toolRenderers.delete(t), Ee(this));
  }
  /**
   * Draw one type of agent activity — the structured progress an agent reports while it
   * works ("3 of 5 sources read"), which reaches the reply as an `activity` segment and is
   * updated in place each time the agent sends it again. Returns the function that takes
   * this renderer off again (it changes nothing once another one has replaced it).
   *
   * An activity with no renderer for its type is kept on the message and draws nothing:
   * no row, no room, no orphan header on a turn that holds nothing else. It is never sent
   * to the model either way. Activities already on screen follow a registration.
   *
   * @example
   * const off = aparteGlobalConfig.registerActivityRenderer('search-progress', {
   *   render: (segment) => {
   *     const el = document.createElement('p');
   *     const { read, of } = segment.content as { read: number; of: number };
   *     el.textContent = `${read} of ${of} sources read`;
   *     return el;
   *   },
   *   update: (el, segment) => {
   *     const { read, of } = segment.content as { read: number; of: number };
   *     el.textContent = `${read} of ${of} sources read`;
   *   },
   * });
   */
  registerActivityRenderer(t, e) {
    return this._activityRenderers.get(t) !== e && (this._activityRenderers.set(t, e), Ee(this)), () => {
      this._activityRenderers.get(t) === e && (this._activityRenderers.delete(t), Ee(this));
    };
  }
  /** The renderer registered for an activity type, or undefined. */
  getActivityRenderer(t) {
    return this._activityRenderers.get(t);
  }
  /** The renderer that draws a tool named `toolName` — exact, pattern or `'*'` — or undefined. */
  getToolRenderer(t) {
    return this._toolRenderers.resolve(t)?.value;
  }
  /**
   * Say how a tool's calls are shown: a label in place of its identifier, an icon, what
   * the call targets, how its arguments read, whether its row is drawn at all, and
   * whether it opens.
   *
   * The matcher is an exact name, a RegExp, or `'*'` — "every tool nothing more
   * specific describes". One entry per matcher, and calls MERGE into it; the entry that
   * applies to a tool is the exact name's, else the first pattern registered that
   * matches, else `'*'`'s — whole, never a mix of two. Registering tells the chats on
   * the page, so a label reaches rows already drawn.
   *
   * Core never makes a label up: without one the row shows the identifier, which is the
   * app's wire format.
   *
   * @example
   * aparteGlobalConfig.registerToolDisplay('web_search', {
   *     label: 'Web search',
   *     icon: 'search',
   *     summary: (segment) => String(segment.toolCall.input['query'] ?? ''),
   * });
   *
   * @example
   * // A consumer chat: the reply is what matters; the calls stay in the history.
   * aparteGlobalConfig.registerToolDisplay('*', { hidden: true });
   *
   * @example
   * // An agent's chat: the spinner, "Running" and "Done" (the default is quiet), on every
   * // tool without an entry of its own — a tool with one says `quiet: false` there too.
   * aparteGlobalConfig.registerToolDisplay('*', { quiet: false });
   *
   * @example
   * // The line, and no raw JSON behind it: nothing, or a detail of the app's own.
   * aparteGlobalConfig.registerToolDisplay('read_file', { label: 'Read a file', details: false });
   * aparteGlobalConfig.registerToolDisplay('web_search', {
   *     label: 'Searched the web',
   *     details: (segment) => sourcesList(segment.result),
   * });
   */
  registerToolDisplay(t, e) {
    const s = this._toolDisplays.get(t), r = { ...s, ...e };
    this._toolDisplays.set(t, r), (Ps.some((a) => s?.[a] !== r[a]) || s === void 0 && this._anotherShapes(r)) && Tt(this), this._notify();
  }
  /** Forget the display registered under this matcher. */
  unregisterToolDisplay(t) {
    const e = this._toolDisplays.get(t);
    this._toolDisplays.delete(t), (Ps.some((r) => e?.[r] !== void 0) || e !== void 0 && this._anotherShapes(e)) && Tt(this), this._notify();
  }
  /** Whether an entry other than `own` sets a field that shapes a row. */
  _anotherShapes(t) {
    return this._toolDisplays.values().some((e) => e !== t && Ps.some((s) => e[s] !== void 0));
  }
  /** How a tool named `toolName` is shown — the entry that applies to it — or undefined. */
  getToolDisplay(t) {
    return this._toolDisplays.resolve(t)?.value;
  }
  /**
   * Whether a tool's calls draw nothing: its display says `hidden`, and no renderer is
   * registered for it MORE specifically. A `'*'` hide therefore leaves a tool with its
   * own renderer drawn (a plugin's receipt), while a hide as specific as the renderer
   * wins — the app said so for that tool. A hidden call stays in the message, in storage
   * and in the model's history; only its row is empty.
   */
  isToolHidden(t) {
    const e = this._toolDisplays.resolve(t);
    if (!e?.value.hidden) return !1;
    const s = this._toolRenderers.resolve(t), r = { exact: 2, pattern: 1, any: 0 };
    return !s || r[s.level] <= r[e.level];
  }
  /**
   * Say more about a call than its display does: what ran it, what it is doing now, a
   * short note after its state. For a plugin that knows a call from the inside — a
   * sub-agent's line is the line of the call that opened it.
   *
   * One provider per config; `null` removes it. It is consulted AFTER the app's display,
   * field by field, so the app always wins: `label` and `target` are read when the display
   * gives none, `details` when the display has no `details` key. `activity`, a second
   * line under the name, and `note` show in every state they are given: give `activity` for
   * the call's whole life, or never, or the row changes height. A function, called whenever the
   * row is drawn, updated or relabelled — never text stored on the segment — so its words
   * follow a language switch. One that throws, or returns nothing, leaves the default
   * line. A chat with a config of its own and no provider reads {@link aparteGlobalConfig}'s.
   *
   * @example
   * aparteGlobalConfig.setToolLineProvider((segment) =>
   *     segment.toolCall.name === 'delegate' ? { activity: 'Reading the parser', note: '3 tools' } : undefined);
   */
  setToolLineProvider(t) {
    this._toolLineProvider !== t && (this._toolLineProvider = t, Tt(this), this._notify());
  }
  /** The tool-line provider this config reads: its own, else the page's. */
  getToolLineProvider() {
    return this._toolLineProvider || this === _t ? this._toolLineProvider : _t._toolLineProvider;
  }
  /** Drop one field of the entry under `match`, and the entry when nothing is left. */
  _dropToolDisplayField(t, e) {
    const s = this._toolDisplays.get(t);
    if (!s || !(e in s)) return;
    const { [e]: r, ...i } = s;
    Object.keys(i).length ? this._toolDisplays.set(t, i) : this._toolDisplays.delete(t), this._notify();
  }
  /**
   * Say what a call targets, in the default row, after the tool's name.
   *
   * The default row names the tool and keeps its arguments behind a disclosure, so a
   * reader sees that a file was read, not which one. Replacing the row with
   * `registerToolRenderer` for that one line would mean re-implementing its six states,
   * the spinner, the disclosure and the relabel contract. This keeps all of them and
   * adds the line. A tool with its own renderer draws its own row, so its summary is
   * never read.
   *
   * The text is written as text, never parsed as HTML. It is read when the row
   * renders, on every update to the call (its arguments may still be arriving), and
   * on every config change — so registering one after a row is on screen shows up on
   * that row's next update.
   *
   * The `summary` field of {@link registerToolDisplay}, on its own: same matcher, same
   * entry.
   *
   * @example
   * // read_file skills.json
   * aparteGlobalConfig.registerToolSummary('read_file', (segment) =>
   *     String(segment.toolCall.input['path'] ?? ''));
   */
  registerToolSummary(t, e) {
    this.registerToolDisplay(t, { summary: e });
  }
  /** Drop the summary registered under this matcher; the rest of its display stays. */
  unregisterToolSummary(t) {
    this._dropToolDisplayField(t, "summary");
  }
  /** The summary that applies to a tool named `toolName`, or undefined. */
  getToolSummary(t) {
    return this.getToolDisplay(t)?.summary;
  }
  /**
   * Show a tool's arguments as a person reads them, in the approval panel and in the
   * default tool row's disclosure — one formatter for both. Without one, both show the
   * JSON the model sent. The `formatInput` field of {@link registerToolDisplay}, on its
   * own: same matcher, same entry.
   *
   * @example
   * // Approve "write_file notes.md (2 KB)" rather than a JSON object.
   * aparteGlobalConfig.registerToolInputFormatter('write_file', (input) =>
   *     `${String(input['path'] ?? '')} (${Math.ceil(String(input['content'] ?? '').length / 1024)} KB)`);
   */
  registerToolInputFormatter(t, e) {
    this.registerToolDisplay(t, { formatInput: e });
  }
  /** Drop the input formatter registered under this matcher; the rest of its display stays. */
  unregisterToolInputFormatter(t) {
    this._dropToolDisplayField(t, "formatInput");
  }
  /** The input formatter that applies to a tool named `toolName`, or undefined. */
  getToolInputFormatter(t) {
    return this.getToolDisplay(t)?.formatInput;
  }
  /**
   * Teach the stream parser a tagged block: `<tag attr="…">…</tag>` in the model's
   * prose becomes the segment `toSegment` builds, streamed delta by delta.
   *
   * The parser does the work once for every grammar — the earliest opening tag wins
   * against a code fence and a reasoning delimiter, a tag cut at a chunk boundary is
   * held back, attributes are parsed quoted or bare, and the block is closed at
   * `</tag>` or at the end of the stream. What the segment IS is yours: a `type` of
   * your own with a renderer from `registerSegmentRenderer`, or a built-in one. One
   * grammar per tag; registering the same tag again replaces it.
   *
   * Read by the stream adapter when a turn starts, so a block registered mid-turn
   * applies from the next turn. See {@link AparteStreamBlock}.
   *
   * @example
   * aparteGlobalConfig.registerStreamBlock({
   *   tag: 'cite',
   *   toSegment: ({ attrs, id }) => ({ id, type: 'citation', url: attrs['url'] ?? '', content: '' }),
   * });
   */
  registerStreamBlock(t) {
    this._streamBlocks.set(t.tag, t), this._notify();
  }
  /** Forget a block grammar by its tag. */
  unregisterStreamBlock(t) {
    this._streamBlocks.delete(t) && this._notify();
  }
  /** The registered block grammars, in registration order. */
  getStreamBlocks() {
    return Array.from(this._streamBlocks.values());
  }
  /**
   * Hear every event of a reply's run, before the reply handles it — including the
   * events of its sub-agents, which the reply never draws: an event that carries an
   * `agentId`, and `agent-start` / `agent-end`, are kept out of the reply whether anyone
   * observes them or not. This is how a plugin draws a sub-agent's conversation.
   *
   * A chat hears the observers of its own config first, then those of
   * {@link aparteGlobalConfig}, the way a segment renderer is found: one registered once on
   * the page reaches a chat that carries a config of its own. An observer that throws is
   * reported once per reply, and the reply goes on. Returns the function that removes it.
   *
   * @example
   * const stop = aparteGlobalConfig.observeRunEvents((event, { messageId }) => {
   *   if (event.type === 'agent-start') console.info(`${messageId}: ${event.name} started`);
   * });
   */
  observeRunEvents(t) {
    const e = { fn: t };
    return this._runEventObservers.push(e), () => {
      this._runEventObservers = this._runEventObservers.filter((s) => s !== e);
    };
  }
  /** The observers registered on this config, in registration order (read by the stream adapter). */
  getRunEventObservers() {
    return this._runEventObservers.map((t) => t.fn);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Conversation Manager (optional, agnostic persistence layer)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Register a AparteConversationManager so any UI controller can persist & load
   * conversations without coupling to a framework wrapper.
   */
  setConversationManager(t) {
    this._conversationManager = t;
  }
  /** Returns the registered AparteConversationManager, or undefined if none. */
  getConversationManager() {
    return this._conversationManager;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Elicitation (human-in-the-loop typed input)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Register the presenter that renders typed input requests (a choice, a
   * confirmation, a text field, a form) and resolves with the user's answer.
   * The `<aparte-elicitation>` Web Component registers itself here; an app can
   * override with its own framework-native presenter. Pass `null` to clear.
   *
   * Several can be registered, one per chat: `owner` is an element of the chat the
   * presenter belongs to (`<aparte-elicitation>` passes itself). A request whose `target`
   * is inside that chat reaches its presenter; a request with no `target`, or from a chat
   * with no presenter of its own, reaches the most recently registered one. Registering a
   * presenter again makes it the most recent.
   */
  setElicitationPresenter(t, e) {
    if (t === null) {
      this._elicitationPresenters = [];
      return;
    }
    this._elicitationPresenters = this._elicitationPresenters.filter((s) => s.fn !== t), this._elicitationPresenters.push(e === void 0 ? { fn: t } : { fn: t, owner: e });
  }
  /**
   * Withdraw ONE presenter, named, leaving any others registered.
   *
   * This is what an unmounting `<aparte-elicitation>` needs and what
   * `setElicitationPresenter(null)` could not express: clearing the slot took every
   * other mounted chat's presenter down with it. Removing a presenter that is not
   * registered is a no-op.
   */
  removeElicitationPresenter(t) {
    this._elicitationPresenters = this._elicitationPresenters.filter((e) => e.fn !== t);
  }
  /**
   * The presenter a request with no `target` would reach — the most recently
   * registered one. Kept for the callers that ask "is anybody able to present?".
   */
  getElicitationPresenter() {
    return this._elicitationPresenters[this._elicitationPresenters.length - 1]?.fn;
  }
  /**
   * The presenter that should handle THIS request.
   *
   * A `target` is an element inside the asking chat, so the presenter registered from
   * the same chat is the right one — found by comparing chat boundaries rather than by
   * `contains`, because the presenter is a sibling of the transcript, not an ancestor
   * of it. With no target, no match, or no boundary to compare, the top of the stack
   * is the answer.
   */
  _presenterFor(t) {
    const e = this._elicitationPresenters;
    if (e.length !== 0) {
      if (t) {
        const s = jt(t);
        if (s)
          for (let r = e.length - 1; r >= 0; r -= 1) {
            const i = e[r];
            if (i.owner && jt(i.owner) === s) return i.fn;
          }
      }
      return e[e.length - 1]?.fn;
    }
  }
  /**
   * Ask the person for typed input in the middle of a run, and wait for the answer. The
   * primitive behind `ask_user` and tool approval: the kind of question is its schema.
   *
   * **Resolves** `accept` with the value, or `decline` when the person declines.
   *
   * **Rejects**, with no answer, with an {@link AparteElicitationAbortError} (its `name` is
   * `'AbortError'`) whose `reason` is `'aborted'` — the turn was stopped, the signal fired,
   * or another request took the question away — or `'no-presenter'`, when nothing is mounted
   * to ask it (with a console warning, once). `await` it in a `try`, or attach a `.catch()`.
   *
   * The question goes to the presenter of the chat that holds `request.target` (see
   * {@link AparteConfig.setElicitationPresenter | setElicitationPresenter()});
   * `<aparte-elicitation>` is the default one, and registers itself once it is in the DOM.
   * A chat shows one question at a time: a second request in the same chat waits until the
   * first is answered or ends, and requests with no `target` share one queue.
   */
  requestUserInput(t) {
    const e = this._elicitationQueueKey(t), s = this._elicitationQueue.get(e), r = s === void 0 ? this._present(t) : s.then(
      () => this._present(t),
      () => this._present(t)
    ), i = r.then(Ra, Ra).then(() => {
      this._elicitationQueue.get(e) === i && this._elicitationQueue.delete(e);
    });
    return this._elicitationQueue.set(e, i), r;
  }
  /**
   * Which queue a request waits in: its own chat's.
   *
   * The wait exists so a second question cannot take the panel away from the one on
   * screen — a property of ONE panel, and `_present` routes by target, so a chat is
   * the right unit. One queue for the whole config would let an approval waiting in
   * the first chat hold the second chat's question behind it for ever. Requests that
   * name no chat share the `null` queue, because they all reach the same presenter —
   * the top of the stack.
   */
  _elicitationQueueKey(t) {
    return jt(t.target);
  }
  /** Hand ONE request to the presenter. Called only from the queue. */
  _present(t) {
    const e = this._presenterFor(t.target);
    if (!e)
      return this._warnedNoPresenter || (this._warnedNoPresenter = !0, console.warn(
        "[aparte] requestUserInput() was called with no elicitation presenter, so it rejected with an AbortError — nothing was ever shown to anybody. Add <aparte-elicitation></aparte-elicitation> inside your <aparte-chat> (the Angular wrapper's tag too) — or, under the React/Vue/Svelte wrappers, inside their [data-aparte-chat] host (every wrapper renders it by default, unless you passed `elicitation={false}`) — or register your own by calling setElicitationPresenter() on the config this chat resolves — the scoped one if you passed a `config`, aparteGlobalConfig otherwise."
      )), Promise.reject(new tn("no-presenter"));
    if (t.signal?.aborted) return Promise.reject(new tn("aborted"));
    const s = e(t), r = t.signal;
    return r ? new Promise((i, a) => {
      const o = () => a(new tn("aborted"));
      r.addEventListener("abort", o, { once: !0 }), s.then(i, a).finally(() => r.removeEventListener("abort", o));
    }) : s;
  }
  /**
   * Put the configuration back to its defaults: the providers and the selected model,
   * the tools with their renderers and summaries, the tool-line provider, the renderers and render hooks, the
   * Markdown and highlight providers, the code-language renderers, the sanitizer, the system prompt, the locale, icons,
   * avatars, actions and host handlers, the conversation manager, the question presenters
   * and their queue, the run-event observers. Three things stay: the transport, the key sources added with
   * {@link AparteConfig.registerKeyProvider | registerKeyProvider()} (an `AparteClient`'s
   * `keyResolver` among them), and the {@link AparteConfig.subscribe | subscribe()} listeners.
   */
  reset() {
    this._markdownProvider = void 0, this._streamingMarkdownProvider = void 0, this._highlightProvider = void 0, this._codeLanguageRenderers.clear(), this._systemPromptTemplate = void 0, this._systemPromptVarsProvider = void 0, this._statusRenderer = void 0, this._errorRenderer = void 0, this._attachmentRenderer = void 0, this._siblingNavRenderer = void 0, this._bubbleShellRenderer = void 0, this._iconProvider = void 0, this._segmentDefaults.clear(), this._avatarProvider = void 0, this._keyProvider = void 0, this._conversationManager = void 0, this._elicitationPresenters = [], this._elicitationQueue.clear(), this._locale = Ve, this._actions = [], this._sanitizer = ji, this._imagePolicy = [], this._imageDecider = $s([]), this._imagePolicyNamed = !1, Bp(this), this._aiProviders.clear(), this._fetchedModels.clear(), this._tools.clear(), this._toolRenderers.clear(), this._toolRendererOverrides.clear(), this._activityRenderers.clear(), this._overrideGeneration++, Ee(this), this._toolDisplays.clear(), this._toolLineProvider = null, this._streamBlocks.clear(), this._runEventObservers = [], this._modelConfig = {}, this._requireModelSelection = !1, this._elicitationAllowOther = !0, this._elicitationLayout = "stepped", this._elicitationAnswerOnClick = !0, this._elicitationFieldRenderer = void 0, this._modelPreferenceProvider = void 0, this._approvalPolicy = null, this._compactor = null, this._bubbleActionsConfig = { ...ne }, this._turnSummary = null, this._streamingCaret = !1, this._dateSeparators = !1, this._hostHandlers = { ...Cn }, this._notify();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Default Fallbacks (Zero-dependency)
  // ─────────────────────────────────────────────────────────────────────────
  _defaultMarkdownRenderer(t) {
    return q(t).replace(/\n/g, "<br>");
  }
  _defaultHighlightRenderer(t) {
    return `<pre><code>${q(t)}</code></pre>`;
  }
}
const Hs = Symbol.for("aparte.globalConfig.1");
function tf() {
  return typeof window < "u" ? (window[Hs] || (window[Hs] = new wr()), window[Hs]) : new wr();
}
const _t = tf(), Ma = "aparte-config-change";
function pe(n, t) {
  const e = (s) => {
    const r = s.detail;
    r?.config && r.config !== $(n) || t();
  };
  return window.addEventListener(Ma, e), () => window.removeEventListener(Ma, e);
}
const ef = /[\p{Z}\s]+/gu, nf = /[\p{Cc}\p{Co}\p{Cn}\p{Cs}\u2800]|(?!(?:\u200C|\u200D|\uFE0E|\uFE0F))\p{Default_Ignorable_Code_Point}/u, sf = /\u{1F3F4}\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0073}\u{E0063}\u{E0074}|\u{E0077}\u{E006C}\u{E0073})\u{E007F}/gu, rf = /(?:^| )\p{M}|\p{Mn}{5,}/u, af = /* @__PURE__ */ new Set(["‌", "‍", "︎", "️"]), of = /^[0-9#*]$/, lf = /^\p{Emoji}$/u, Oa = /^\p{Extended_Pictographic}$/u, cf = /^\p{Emoji_Modifier}$/u, $a = /^[\p{scx=Arab}\p{scx=Syrc}\p{scx=Thaa}\p{scx=Nkoo}\p{scx=Adlm}\p{scx=Rohg}\p{scx=Mong}\p{scx=Deva}\p{scx=Beng}\p{scx=Guru}\p{scx=Gujr}\p{scx=Orya}\p{scx=Taml}\p{scx=Telu}\p{scx=Knda}\p{scx=Mlym}\p{scx=Sinh}\p{scx=Mymr}\p{scx=Khmr}]$/u, df = /^[\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D\u0DCA\u1039\u17D2]$/;
function uf(n) {
  const t = Array.from(n);
  for (let e = 0; e < t.length; e++) {
    const s = t[e];
    if (!af.has(s)) continue;
    const r = t[e - 1] ?? "", i = t[e + 1] ?? "";
    if (s === "︎" || s === "️") {
      if (of.test(r)) {
        if (s !== "️" || i !== "⃣") return !1;
      } else if (!lf.test(r)) return !1;
      continue;
    }
    if (s === "‍") {
      const a = r === "️" ? t[e - 2] ?? "" : r;
      if ((Oa.test(a) || cf.test(a)) && Oa.test(i)) continue;
    }
    if (!($a.test(r) && ($a.test(i) || df.test(r) && (i === "" || i === " "))))
      return !1;
  }
  return !0;
}
const hf = 100;
function pf(n) {
  const t = (typeof n == "string" ? n : n.label).replace(ef, " ").trim();
  if (!t || t.length > hf) return null;
  const e = t.replace(sf, "🏴");
  return nf.test(e) || rf.test(e) || !uf(e) ? null : t;
}
const ff = /* @__PURE__ */ new WeakSet();
function Na(n) {
  return !!n && ff.has(n);
}
function gf(n) {
  const t = n.segments, e = t[t.length - 1];
  return n.status !== "streaming" || !e || e.isStreaming !== void 0 || e.type !== "text" && e.type !== "thinking" ? t : [...t.slice(0, -1), { ...e, isStreaming: !0 }];
}
function Pa(n, t, e) {
  if (n.setTokens?.(t.tokens), t.segments && t.segments.length > 0) {
    const s = n.getSegments?.() ?? [];
    if (s.length === t.segments.length) {
      const r = ol(t.status);
      for (const i of t.segments)
        if ("content" in i) {
          const a = { content: i.content };
          r && (a.isStreaming = !1);
          const o = s.find((l) => l.id === i.id);
          i.type === "text" && (i.sources || i.citations || o?.sources || o?.citations) && Object.assign(a, { sources: i.sources, citations: i.citations }), n.updateSegment?.(i.id, a);
        }
    } else
      n.setSegments?.(gf(t));
  } else t.content !== void 0 && n.setContent?.(t.content);
  t.attachments && t.attachments.length > 0 && n.setAttachments?.(t.attachments), e && e.count > 1 && n.setSiblings?.(e.count, e.index), t.usage !== void 0 && n.setUsage?.(t.usage), n.setFinishReason?.(t.finishReason), n.setContextSummary?.(t.contextSummary, { legacy: t.compaction === !0 });
}
const _f = 2, Zr = Symbol.for("aparte.derivedSegments");
function mf(n, t, e) {
  if (e <= 0 || n.length <= e) return { messages: n, tree: t };
  const s = n.length - e, r = n.slice(s), i = r[0], a = i?.id;
  let o;
  for (let p = n.length - 1; p >= 0; p--) {
    const f = n[p].contextSummary;
    if (f) {
      p < s && (o = { ...f, count: f.count + (s - p) });
      break;
    }
  }
  if (i && o && (r[0] = { ...i, contextSummary: o }), !a || !t) return { messages: r, tree: t };
  if (!new Set(t.messages.map((p) => p.message.id)).has(a)) return { messages: r, tree: t };
  const c = /* @__PURE__ */ new Map();
  for (const { message: p, parentId: f } of t.messages)
    if (f != null) {
      const _ = c.get(f) ?? [];
      _.push(p.id), c.set(f, _);
    }
  const d = /* @__PURE__ */ new Set(), h = [a];
  for (; h.length; ) {
    const p = h.pop();
    if (!d.has(p)) {
      d.add(p);
      for (const f of c.get(p) ?? []) h.push(f);
    }
  }
  const u = {
    headId: t.headId,
    messages: t.messages.filter((p) => d.has(p.message.id)).map((p) => p.message.id === a ? { message: o ? { ...p.message, contextSummary: o } : p.message, parentId: null } : p)
  };
  return { messages: r, tree: u };
}
function Jr(n) {
  if (!n[Zr]) return n;
  const { segments: t, ...e } = n;
  return e;
}
function bf(n) {
  return n.map(Jr);
}
function vf(n) {
  return {
    ...n,
    messages: n.messages.map((t) => ({ ...t, message: Jr(t.message) }))
  };
}
function oc(n) {
  return JSON.stringify(n, (t, e) => e && typeof e == "object" && !Array.isArray(e) ? Object.fromEntries(Object.keys(e).sort().map((s) => [s, e[s]])) : e);
}
function lc(n) {
  return $n(Jr(n));
}
function Tn(n) {
  return oc(n.map(lc));
}
function Da(n) {
  const t = [...n.messages].sort((e, s) => e.message.id < s.message.id ? -1 : e.message.id > s.message.id ? 1 : 0);
  return oc(t.map((e) => ({ parentId: e.parentId, message: lc(e.message) })));
}
const Ha = (n) => n.role === "user" && !n.compaction;
class yf {
  _adapter;
  _conversations = [];
  _activeId = null;
  _listeners = /* @__PURE__ */ new Set();
  _initialized = !1;
  _retention = null;
  _titleProvider = null;
  /** Ids whose messages are in memory. Every id, after a loadAll(); only fetched ones after loadMeta(). */
  _loaded = /* @__PURE__ */ new Set();
  /** One fetch per id at a time: a second ensureFull(id) while the first is in flight joins it. */
  _fetching = /* @__PURE__ */ new Map();
  /** One append per id at a time: the next addMessage(id) reads what the previous one wrote. */
  _appending = /* @__PURE__ */ new Map();
  /** The list on its way: a conversation created meanwhile waits for it, or the list would replace it. */
  _initPromise = null;
  /** The store this manager writes to. */
  get adapter() {
    return this._adapter;
  }
  constructor(t, e) {
    this._adapter = t, this._retention = e?.retention ?? null, this._titleProvider = e?.titleProvider ?? null;
  }
  // ─── Title provider ─────────────────────────────────────────────────────
  /**
   * Replace how a new conversation is titled from its first user message.
   * `null` restores the default (the message's text). The provider is consulted
   * once per conversation, on that first message; `updateTitle` is untouched.
   */
  setTitleProvider(t) {
    this._titleProvider = t;
  }
  /** The registered title provider, or `null` when the default applies. */
  getTitleProvider() {
    return this._titleProvider;
  }
  // ─── Initialisation ────────────────────────────────────────────────────
  /**
   * Load all conversations from the adapter. Call once at app startup.
   *
   * A later call re-reads the list from the store: rows it no longer lists are
   * dropped, and a conversation whose messages are already in memory keeps them —
   * so the one on screen goes on being persisted.
   */
  async init() {
    const t = (async () => {
      const e = !!(this._adapter.loadMeta && this._adapter.loadFull);
      this._adapter.loadMeta && !this._adapter.loadFull && console.warn("[AparteConversationManager] the adapter lists through loadMeta() but has no loadFull(): everything is loaded through loadAll() instead.");
      const s = new Map(this._conversations.filter((o) => this._loaded.has(o.id)).map((o) => [o.id, o]));
      this._loaded.clear();
      const r = e ? (await this._adapter.loadMeta()).map((o) => {
        const l = s.get(o.id);
        return l ? { ...o, messages: l.messages, ...l.tree ? { tree: l.tree } : {} } : { ...o, messages: [] };
      }) : (await this._adapter.loadAll()).map((o) => ({ ...o, messages: o.messages ?? [] })), i = /* @__PURE__ */ new Set(), a = r.filter((o) => !i.has(o.id) && (i.add(o.id), !0));
      a.length !== r.length && console.warn(`[AparteConversationManager] ${r.length - a.length} repeated id(s) in the list; the first row wins.`), this._conversations = a;
      for (const o of a) (!e || s.has(o.id)) && this._loaded.add(o.id);
      this._initialized = !0, this._notify();
    })();
    this._initPromise = t;
    try {
      await t;
    } finally {
      this._initPromise === t && (this._initPromise = null);
    }
  }
  /** Whether a conversation's messages are in memory (always, without split storage). */
  isLoaded(t) {
    return this._loaded.has(t);
  }
  /**
   * Fetch a conversation's messages through the adapter's loadFull(), the first time
   * they are needed; later calls resolve at once. The row keeps its place and its meta;
   * the messages (and the tree) come from the full record, and a message written to
   * the row while the fetch ran goes after them. Resolves `false` when the store has no
   * such record (or answers with another id) — the row is then NOT loaded, and says so,
   * rather than counting as an empty conversation.
   */
  async ensureFull(t) {
    if (this._loaded.has(t)) return !0;
    if (!this._adapter.loadFull) return !1;
    const e = this._fetching.get(t);
    if (e) return e;
    const s = (async () => {
      const r = await this._adapter.loadFull(t), i = this._find(t);
      return !i || !r ? !1 : r.id !== t ? (console.warn(`[AparteConversationManager] loadFull('${t}') answered with '${r.id}': ignored.`), !1) : (this._replace({ ...i, ...r, id: t, messages: r.messages ?? [] }), this._loaded.add(t), this._notify(), !0);
    })().finally(() => this._fetching.delete(t));
    return this._fetching.set(t, s), s;
  }
  /**
   * The row with its messages in memory — fetched first when they are not, so a
   * metadata change never writes a row back without them. `null` when the id is
   * unknown or the store has no record to fetch.
   */
  async _full(t) {
    return !this._loaded.has(t) && this._adapter.loadFull && !await this.ensureFull(t) ? null : this._find(t) ?? null;
  }
  /**
   * Whether `init()` has completed at least once. Consumers use this to
   * distinguish "manager still hydrating from storage" from "manager
   * hydrated, conversations is genuinely empty". The conversation-controller
   * relies on this to defer clearing the binding during the IndexedDB
   * hydration window (Angular APP_INITIALIZER race).
   */
  get initialized() {
    return this._initialized;
  }
  // ─── Read ───────────────────────────────────────────────────────────────
  get conversations() {
    return this._conversations;
  }
  get activeId() {
    return this._activeId;
  }
  get active() {
    return this._activeId ? this._conversations.find((t) => t.id === this._activeId) ?? null : null;
  }
  /** Active conversations (not archived), newest first. */
  get activeConversations() {
    return this._conversations.filter((t) => !t.archivedAt).sort((t, e) => e.updatedAt - t.updatedAt);
  }
  /** Archived conversations, newest first. */
  get archivedConversations() {
    return this._conversations.filter((t) => !!t.archivedAt).sort((t, e) => e.updatedAt - t.updatedAt);
  }
  // ─── Mutations ──────────────────────────────────────────────────────────
  /**
   * Create a new empty conversation, persist it, and make it active. Untitled by
   * default: the list shows its locale's `newChat` word for an empty title, so the
   * store never carries an English string a French UI would then display.
   */
  async createNew(t = "") {
    const e = Date.now(), s = {
      id: pt(),
      title: t,
      createdAt: e,
      updatedAt: e,
      messages: [],
      schemaVersion: _f
    };
    this._activeId = s.id, this._loaded.add(s.id), this._initPromise && await this._initPromise.catch(() => {
    }), this._conversations = [s, ...this._conversations];
    try {
      await this._adapter.save(s);
    } catch (r) {
      console.warn("[AparteConversationManager] save() failed for a new conversation; it stays in memory and the next write retries.", r);
    }
    return this._notify(), s;
  }
  /** Switch active conversation without touching storage. */
  select(t) {
    this._conversations.find((e) => e.id === t) && (this._activeId = t, this._notify());
  }
  /** Deselect the active conversation (no conv selected). */
  clearActive() {
    this._activeId = null, this._notify();
  }
  /**
   * Append a message to a conversation. Auto-generates title from first user message.
   *
   * One append at a time per conversation: two sends that overlap (a suggestion and a
   * quick type, coalesced into one new conversation) both suspend before reading the
   * record — for the messages, then for the title provider — so the queue keeps the
   * second one from reading a conversation with no user message in it yet and
   * taking its text as the title.
   */
  async addMessage(t, e) {
    const s = this._appending.get(t), r = s ? s.then(() => this._append(t, e)) : this._append(t, e), i = r.catch(() => {
    });
    return this._appending.set(t, i), i.then(() => {
      this._appending.get(t) === i && this._appending.delete(t);
    }), r;
  }
  async _append(t, e) {
    const s = await this._full(t);
    if (!s) return;
    const r = e.role === "user" && !e.compaction && s.messages.every((c) => c.role !== "user" || c.compaction), i = r ? await this._title(e) : null, a = this._find(t);
    if (!a) return;
    const o = a.messages.some((c) => c.id === e.id), l = {
      ...a,
      messages: o ? a.messages : [...a.messages, e],
      updatedAt: Date.now(),
      title: i ?? a.title
    };
    r && (l.autoTitle = !0), this._replace(l), await this._adapter.save(l), this._notify();
  }
  /**
   * Replace the flat active-path messages and optionally the full branch tree.
   * `messages` is always written (active path, for sidebar/title/compat).
   * `tree` is written when provided — it carries the full branching topology.
   */
  async updateMessages(t, e, s) {
    const r = this._find(t);
    if (!r) return;
    if (!this._loaded.has(t)) {
      console.warn(`[AparteConversationManager] updateMessages('${t}') before its messages were loaded: ignored.`);
      return;
    }
    const i = e.find(Ha);
    this._retention && ({ messages: e, tree: s } = mf(e, s, this._retention.maxMessages));
    const a = bf(e), o = s === void 0 ? void 0 : vf(s);
    let l = !0, c = s !== void 0;
    try {
      if (o !== void 0 && r.tree !== void 0) {
        const p = Da(o) !== Da(r.tree);
        l = p || o.headId === r.tree.headId && Tn(a) !== Tn(r.messages), c = p || o.headId !== r.tree.headId;
      } else
        l = Tn(a) !== Tn(r.messages), o !== void 0 && (c = !0);
    } catch {
    }
    let d;
    if (r.autoTitle) {
      const p = r.messages.find(Ha);
      i && (i.content ?? "") !== (p?.content ?? "") && (d = await this._title(i));
    }
    if (!l && !c && d === void 0) return;
    const h = this._find(t);
    if (!h) return;
    const u = {
      ...h,
      // What is stored is what the caller sent: segments a viewport DERIVED on
      // display are not the app's content. Stored, they would fill the record with
      // core-generated ids and freeze the parse as it stood the day it was saved —
      // a block grammar registered later would never apply to that message.
      messages: a,
      updatedAt: l ? Date.now() : h.updatedAt
    };
    o !== void 0 && (u.tree = o), d !== void 0 && (u.title = d), this._replace(u), await this._adapter.save(u), this._notify();
  }
  /** Permanently delete a conversation. */
  async delete(t) {
    this._conversations = this._conversations.filter((e) => e.id !== t), this._loaded.delete(t), this._activeId === t && (this._activeId = null), await this._adapter.delete(t), this._notify();
  }
  /** Archive a conversation (soft-delete). */
  async archive(t) {
    await this._meta(t, (e) => ({ ...e, archivedAt: Date.now() }), this._adapter.archive) && (this._activeId === t && (this._activeId = null), this._notify());
  }
  /**
   * A metadata change, through the adapter's own hook when it has one (the row is
   * updated in memory, nothing else travels), else through `save()` — with the
   * messages fetched first, so a row the list came with (`messages: []`) is never
   * written back over the stored ones.
   */
  async _meta(t, e, s) {
    if (s) {
      const a = this._find(t);
      return a ? (this._replace(e(a)), await s.call(this._adapter, t), !0) : !1;
    }
    const r = await this._full(t);
    if (!r) return !1;
    const i = e(r);
    return this._replace(i), await this._adapter.save(i), !0;
  }
  /** Restore an archived conversation. */
  async unarchive(t) {
    await this._meta(t, (e) => ({ ...e, archivedAt: void 0 }), this._adapter.unarchive) && this._notify();
  }
  /**
   * Pin a conversation, which the list shows in its "Pinned" group first. Metadata
   * only, like archive: `updatedAt` keeps the conversation's real chronological slot
   * for the day it is unpinned. An adapter that has `pin()` gets the call; one that
   * does not gets the whole record through `save()`.
   */
  async pin(t) {
    await this._meta(t, (e) => ({ ...e, pinnedAt: Date.now() }), this._adapter.pin) && this._notify();
  }
  /** Unpin a conversation. Metadata only — see `pin()`. */
  async unpin(t) {
    await this._meta(t, (e) => ({ ...e, pinnedAt: void 0 }), this._adapter.unpin) && this._notify();
  }
  /** Update the title manually. The full input is preserved — UI surfaces
   *  (sidebar list, topbar) are responsible for visual truncation via CSS
   *  (`min-w-0` + `truncate`). Auto-titles produced internally by
   *  `_autoTitle()` remain capped at a sensible length on input. */
  async updateTitle(t, e) {
    if (!this._find(t)) {
      console.warn(`[AparteConversationManager] updateTitle('${t}'): unknown conversation.`);
      return;
    }
    const s = e.trim();
    await this._meta(
      t,
      (i) => ({ ...i, title: s, autoTitle: !1 }),
      this._adapter.rename ? (i) => this._adapter.rename(i, s) : void 0
    ) && this._notify();
  }
  // ─── Observer ───────────────────────────────────────────────────────────
  subscribe(t) {
    return this._listeners.add(t), () => this._listeners.delete(t);
  }
  // ─── Private ────────────────────────────────────────────────────────────
  _find(t) {
    return this._conversations.find((e) => e.id === t);
  }
  _replace(t) {
    this._conversations = this._conversations.map(
      (e) => e.id === t.id ? t : e
    );
  }
  _notify() {
    const t = [...this._conversations];
    this._listeners.forEach((e) => {
      try {
        e(t);
      } catch (s) {
        console.error("[AparteConversationManager] listener threw:", s);
      }
    });
  }
  /**
   * The title of a conversation, decided on its first user message — and again if
   * that message is edited while the title is still the manager's: the provider's
   * answer when one is registered and answers, else the default.
   */
  async _title(t) {
    const e = this._autoTitle(t);
    if (!this._titleProvider) return e;
    try {
      return (await this._titleProvider((t.content ?? "").trim(), t)).trim() || e;
    } catch (s) {
      return console.warn("[AparteConversationManager] the title provider threw; the default title stands:", s), e;
    }
  }
  _autoTitle(t) {
    return (t.content ?? "").trim();
  }
}
function cc(n) {
  return n.map((t) => ({
    id: pt(),
    name: t.name,
    type: t.type || "application/octet-stream",
    url: URL.createObjectURL(t),
    size: t.size,
    blob: t
  }));
}
function wf(n) {
  if (n?.length && !(typeof URL > "u" || typeof URL.revokeObjectURL != "function"))
    for (const t of n)
      t.url?.startsWith("blob:") && URL.revokeObjectURL(t.url);
}
const Sr = /* @__PURE__ */ new Map();
function dc(n, t) {
  t ? Sr.set(n, t) : Sr.delete(n);
}
function Ar(n, t) {
  dc(n, t);
  try {
    window.dispatchEvent(new CustomEvent("aparte-conversation-status", { detail: { id: n, status: t } }));
  } catch {
  }
}
function Bs(n) {
  return Sr.get(n) ?? null;
}
const Sf = 6;
class Af {
  _binding;
  _options;
  _activeId = null;
  _isStreaming = !1;
  _isLoadingConversation = !1;
  _ensureInFlight = null;
  /** The conversation the turn in flight started in, and what the lists were told of it. */
  _turn = null;
  /** The reply the turn in flight writes into, from its `aparte-message-start`. */
  _turnMessage = null;
  _onSendCapture = null;
  _onPathChanged = null;
  _onMessageStart = null;
  _onMessageDone = null;
  _onMessageError = null;
  _onMessageAborted = null;
  _onMessagePaused = null;
  _onMessageResumed = null;
  _onSelectConversation = null;
  _onCompactDone = null;
  _unsubscribeManager = null;
  /** The manager the subscription above is on, so a replaced manager is re-subscribed. */
  _subscribedTo = null;
  /** Between bind() and unbind(): the only time a manager subscription may be installed. */
  _bound = !1;
  /** The binding shows the wait this controller asked for — see `_showWait`. */
  _waitShown = !1;
  /**
   * React to an external mutation of the manager (another component deleting or
   * archiving the active conversation). Without this the binding would keep
   * showing a phantom history for an id the manager no longer knows about.
   */
  _onManagerChanged = (t) => {
    if (!this._activeId) return;
    if (!t.some((s) => s.id === this._activeId && !s.archivedAt)) {
      if (this._isStreaming) {
        try {
          window.dispatchEvent(new CustomEvent("aparte-abort", {
            detail: { targetId: this._binding.hostId }
          }));
        } catch {
        }
        this._isStreaming = !1;
      }
      this._activeId = null, this._binding.clearMessages(), this._showWait(!1);
    }
  };
  constructor(t, e = {}) {
    this._binding = t, this._options = e;
  }
  /** The current active conversation id (null when none selected). */
  get activeId() {
    return this._activeId;
  }
  /**
   * Lazily resolve the conversation manager. Returns `undefined` if none is
   * registered — the controller then runs in degraded mode: optimistic UI
   * still works (user message is appended) but no persistence happens. This
   * keeps backward compatibility with hosts that haven't opted into the
   * conversation lifecycle yet.
   */
  _manager() {
    const t = this._options.manager ?? (() => {
      const e = $(this._binding.host), s = e.getConversationManager();
      return s || this._warnManagerOnTheWrongConfig(e), s;
    })();
    return t && this._bound && t !== this._subscribedTo && (this._unsubscribeManager?.(), this._subscribedTo = t, this._unsubscribeManager = t.subscribe(this._onManagerChanged)), t;
  }
  /**
   * Degraded mode is legitimate — a host that never opted into the conversation
   * lifecycle has no manager and should not be nagged. Registering one on the
   * WRONG config is not: a manager registered on the global singleton while the chat
   * uses its own `config` looks like it works (the optimistic UI still appends) and
   * saves nothing at all.
   *
   * Warned once per controller, and only in the case that is unambiguously a
   * mistake: no manager here, but one on the global.
   */
  _warnedNoManager = !1;
  _warnManagerOnTheWrongConfig(t) {
    this._warnedNoManager || t === _t || !_t.getConversationManager() || (this._warnedNoManager = !0, console.warn(
      "[aparte] This chat resolves its own config, but the conversation manager was registered on aparteGlobalConfig — so nothing is being persisted. Pass the same config to init(): `init(adapter, myConfig)`, using the config you gave the chat."
    ));
  }
  /**
   * Tell every conversation list on the page what the turn is doing, through
   * `aparte-conversation-status` on `window` — the mirror of the list's
   * `aparte-conversation-select`, which this controller hears. Always about the
   * conversation the turn started in: the person may have opened another since. A turn
   * that starts before its conversation exists (a first message) is told once it does.
   */
  _setTurn(t) {
    if (!t) {
      this._turn && Ar(this._turn.id, null), this._turn = null;
      return;
    }
    const e = this._turn?.id ?? (t === "running" ? this._activeId ?? this._manager()?.activeId ?? null : null);
    e && (this._turn = { id: e, status: t }, Ar(e, t));
  }
  /**
   * Whether a lifecycle event is about the turn in flight. A turn a newer send replaced
   * (a chip, a retry, an edit) says it stopped AFTER the new one started: its end must not
   * end the new turn's state. An event without a message id is taken as this turn's.
   */
  _ofThisTurn(t) {
    const e = t.detail?.messageId;
    return !e || !this._turnMessage || e === this._turnMessage;
  }
  /**
   * Attach event listeners to the binding host. Returns an unbind function.
   */
  bind() {
    const t = this._binding.host;
    this._onSendCapture = (s) => {
      const r = s, i = r.detail?.targetId;
      if (i && i !== this._binding.hostId) return;
      this._forgetDraft();
      const a = r.detail?.content ?? "", o = r.detail?.files, l = o?.length ? cc(o) : void 0, c = {
        id: pt(),
        role: "user",
        content: a,
        timestamp: r.detail?.timestamp ?? Date.now(),
        ...l ? { attachments: l } : {},
        ...r.detail?.tokens?.length ? { tokens: r.detail.tokens } : {},
        ...r.detail?.meta ? { metadata: r.detail.meta } : {}
      };
      this._binding.appendMessage(c), r.detail.echoed = !0, this._ensureConversationAndPersist(c);
    }, t.addEventListener("aparte-send", this._onSendCapture, { capture: !0 }), this._onPathChanged = () => {
      this._isLoadingConversation || this._persistActive();
    }, t.addEventListener("aparte-path-changed", this._onPathChanged), this._onMessageStart = (s) => {
      this._isStreaming = !0, this._turnMessage = s.detail?.messageId ?? null, this._setTurn("running");
    };
    const e = (s) => {
      this._ofThisTurn(s) && (this._isStreaming = !1, this._setTurn(null), this._turnMessage = null);
    };
    return this._onMessageDone = (s) => {
      e(s), queueMicrotask(() => this._persistActive());
    }, this._onMessageError = (s) => {
      e(s), queueMicrotask(() => this._persistActive());
    }, this._onMessageAborted = (s) => {
      e(s), queueMicrotask(() => this._persistActive());
    }, this._onMessagePaused = (s) => {
      this._ofThisTurn(s) && this._setTurn("waiting"), queueMicrotask(() => this._persistActive());
    }, this._onMessageResumed = (s) => {
      this._ofThisTurn(s) && this._setTurn("running");
    }, t.addEventListener("aparte-message-start", this._onMessageStart), t.addEventListener("aparte-message-done", this._onMessageDone), t.addEventListener("aparte-message-error", this._onMessageError), t.addEventListener("aparte-message-aborted", this._onMessageAborted), t.addEventListener("aparte-message-paused", this._onMessagePaused), t.addEventListener("aparte-message-resumed", this._onMessageResumed), this._onSelectConversation = (s) => {
      const r = s, i = r.detail?.targetId;
      i && i !== this._binding.hostId || this.setConversationId(r.detail?.id ?? null);
    }, this._onCompactDone = (s) => {
      const r = s.detail;
      r?.targetId && r.targetId !== this._binding.hostId || queueMicrotask(() => this._persistOnceSummarised(r ?? {}, 0));
    }, typeof window < "u" && (window.addEventListener("aparte-conversation-select", this._onSelectConversation), window.addEventListener("aparte-compact-done", this._onCompactDone)), this._bound = !0, this._manager(), () => this.unbind();
  }
  /** Detach event listeners. */
  /** Release handle for the hydration-retry subscription (see setConversationId). */
  _stopHydrationRetry = null;
  unbind() {
    this._bound = !1, this._subscribedTo = null, this._persistActive(), this._turn?.status === "running" && this._setTurn(null), this._turn = null, this._turnMessage = null, this._stopHydrationRetry?.(), this._stopHydrationRetry = null;
    const t = this._binding.host;
    this._onSendCapture && (t.removeEventListener("aparte-send", this._onSendCapture, { capture: !0 }), this._onSendCapture = null), this._onPathChanged && (t.removeEventListener("aparte-path-changed", this._onPathChanged), this._onPathChanged = null), this._onMessageStart && (t.removeEventListener("aparte-message-start", this._onMessageStart), this._onMessageStart = null), this._onMessageDone && (t.removeEventListener("aparte-message-done", this._onMessageDone), this._onMessageDone = null), this._onMessageError && (t.removeEventListener("aparte-message-error", this._onMessageError), this._onMessageError = null), this._onMessageAborted && (t.removeEventListener("aparte-message-aborted", this._onMessageAborted), this._onMessageAborted = null), this._onMessagePaused && (t.removeEventListener("aparte-message-paused", this._onMessagePaused), this._onMessagePaused = null), this._onMessageResumed && (t.removeEventListener("aparte-message-resumed", this._onMessageResumed), this._onMessageResumed = null), this._onCompactDone && typeof window < "u" && (window.removeEventListener("aparte-compact-done", this._onCompactDone), this._onCompactDone = null), this._onSelectConversation && typeof window < "u" && (window.removeEventListener("aparte-conversation-select", this._onSelectConversation), this._onSelectConversation = null), this._unsubscribeManager && (this._unsubscribeManager(), this._unsubscribeManager = null);
  }
  /**
   * Switch to (or clear) the active conversation.
   *  - `null`: clears the binding and deselects in the manager.
   *  - any id: loads the conversation's messages into the binding.
   *
   * Idempotent: calling with the current id forces a re-snapshot from the
   * manager (handy when external mutations could have desynchronised the
   * binding, or when a user re-selects the already-active conv from a
   * sidebar). Streams are only aborted on an actual id change so a same-id
   * reload never kills an in-flight response.
   */
  async setConversationId(t) {
    if (!this._options.keepDrafts || t === this._activeId) {
      await this._openConversation(t);
      return;
    }
    const e = ++this._draftCalls;
    this._draftAway || this._stashDraft(), this._draftAway = !0;
    try {
      await this._openConversation(t);
    } finally {
      e === this._draftCalls && (this._draftAway = !1);
    }
    e === this._draftCalls && await this._restoreDraft(e);
  }
  /** Drafts by conversation; the empty key is a chat that has no conversation yet. */
  _drafts = /* @__PURE__ */ new Map();
  _draftCalls = 0;
  _draftAway = !1;
  get _composer() {
    const { host: t, hostId: e } = this._binding;
    return t.querySelector("aparte-composer") ?? document.querySelector(`aparte-composer[target="${yt(e)}"]`);
  }
  _stashDraft() {
    if (!this._options.keepDrafts) return;
    const t = this._composer;
    if (!t) return;
    const e = this._activeId ?? "", s = t.value;
    s ? this._drafts.set(e, s) : this._drafts.delete(e), this._saveDraft(e, s);
  }
  /** A message was sent: what it was drafted from must not come back, in this tab or the next. */
  _forgetDraft() {
    if (!this._options.keepDrafts) return;
    const t = this._activeId ?? "";
    this._drafts.delete(t), this._saveDraft(t, "");
  }
  /** A store that fails loses a draft, and nothing else. */
  _saveDraft(t, e) {
    const s = this._draftAdapter();
    !t || !s || Promise.resolve().then(() => s.saveDraft(t, e)).catch((r) => {
      console.warn("[ConversationController] the draft could not be saved:", t, r);
    });
  }
  async _restoreDraft(t) {
    const e = this._activeId ?? "", s = this._draftAdapter();
    let r = this._drafts.get(e);
    if (r === void 0 && e && s)
      try {
        r = await s.loadDraft(e) ?? "";
      } catch (i) {
        console.warn("[ConversationController] the draft could not be read:", e, i);
      }
    t === this._draftCalls && this._composer?.setValue(r ?? "");
  }
  _draftAdapter() {
    const t = this._manager()?.adapter ?? null;
    return t?.loadDraft && t.saveDraft ? t : null;
  }
  async _openConversation(t) {
    const e = t !== this._activeId, s = this._manager();
    if (e && this._isStreaming) {
      this._turn?.status === "waiting" ? this._turn = null : this._setTurn(null), this._persistActive();
      try {
        window.dispatchEvent(new CustomEvent("aparte-abort", {
          detail: { targetId: this._binding.hostId }
        }));
      } catch {
      }
      this._isStreaming = !1;
    }
    if (t === null) {
      if (e && this._persistActive(), e && this._isStreaming) {
        try {
          window.dispatchEvent(new CustomEvent("aparte-abort", {
            detail: { targetId: this._binding.hostId }
          }));
        } catch {
        }
        this._isStreaming = !1;
      }
      this._activeId = null, s?.clearActive(), e && this._binding.clearMessages(), this._showWait(!1);
      return;
    }
    const r = s?.conversations.find((o) => o.id === t);
    if (!s || !r) {
      if (s && !s.initialized) {
        this._stopHydrationRetry?.();
        const o = s.subscribe(() => {
          o(), this._stopHydrationRetry = null, s.conversations.some((l) => l.id === t) ? this.setConversationId(t) : this._activeId === null && (console.warn("[ConversationController] id still unknown after hydration — clearing. id:", t), s.clearActive(), this._binding.clearMessages(), this._showWait(!1));
        });
        this._stopHydrationRetry = o, this._showWait(!1);
        return;
      }
      console.warn("[ConversationController] unknown id or no manager — clearing. manager:", !!s, "conv:", !!r), this._activeId = null, s?.clearActive(), this._binding.clearMessages(), this._showWait(!1);
      return;
    }
    this._activeId = t, s.select(t);
    let i = r;
    if (!s.isLoaded(t)) {
      this._showWait(!0), this._binding.clearMessages();
      let o = !1;
      try {
        o = await s.ensureFull(t);
      } catch (l) {
        console.warn("[ConversationController] the conversation could not be loaded:", t, l);
      }
      if (this._activeId !== t) return;
      if (!o) {
        s.conversations.some((l) => l.id === t) && console.warn("[ConversationController] no messages came back for", t, "— leaving it."), this._activeId = null, s.clearActive(), this._binding.clearMessages(), this._showWait(!1);
        return;
      }
      i = s.conversations.find((l) => l.id === t) ?? r;
    }
    this._isLoadingConversation = !0;
    try {
      this._binding.setMessages([...i.messages ?? []]), i.tree && this._binding.importTree && this._binding.importTree(i.tree);
    } finally {
      this._isLoadingConversation = !1, this._showWait(!1);
    }
    this._binding.host.dispatchEvent(new CustomEvent("aparte-conversation-loaded", {
      bubbles: !0,
      composed: !0,
      detail: { targetId: this._binding.hostId, conversationId: t }
    }));
  }
  /**
   * The binding's wait, owned here: whoever runs `setConversationId` last clears it
   * — a loaded conversation or a new chat that replaces a fetch, a delete of the
   * one being fetched — so a wait shown for one call never outlives the call that
   * superseded it.
   */
  _showWait(t) {
    this._waitShown !== t && (this._waitShown = t, this._binding.setLoading?.(t));
  }
  // ─────────────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────────────
  /**
   * Snapshot the binding's current messages and push them to the manager.
   * No-op when there is no active conversation or no manager registered.
   * Idempotent: safe to call multiple times in a row.
   *
   * Any message whose status is 'streaming' or 'pending' at persist-time is
   * normalised to 'completed' so that reloading the conversation does not
   * re-enter streaming UI (caret, spinner, no action buttons) for content
   * that was partially written before a switch or component destruction.
   */
  /**
   * Save once the binding holds what a compaction (or a Restore) announced. A transcript
   * kept in a framework store reaches the binding only when that framework renders, so a
   * save on the microtask wrote the conversation as it stood before the change. Bounded:
   * a run that changed nothing (skipped), or a binding that never shows the change, is
   * saved as it is.
   *
   * What "holds" means follows what the run said it did:
   * - a checkpoint — `messageId` names the message carrying it, and it holds once that
   *   message carries a `contextSummary` with its `createdAt` (a summary without the
   *   stamp is a half-written one);
   * - a Restore — it holds once no message of the path carries a checkpoint any more;
   * - an older host's summary MESSAGE (`compaction: true`, ending with the summary).
   * A run that names none of these has nothing to wait for.
   */
  _persistOnceSummarised(t, e) {
    const s = this._binding.getMessages();
    let r = !0;
    if (t.restored)
      r = !s.some((i) => i.contextSummary !== void 0);
    else if (t.messageId || t.summary) {
      const { messageId: i, summary: a } = t, o = !!i && s.some(
        (c) => c.id === i && typeof c.contextSummary?.createdAt == "number"
      ), l = !!a && s.some(
        (c) => c.compaction === !0 && typeof c.content == "string" && c.content.endsWith(a)
      );
      r = o || l;
    }
    if (r || !this._binding.afterRender || e >= Sf) {
      this._persistActive();
      return;
    }
    this._binding.afterRender(() => this._persistOnceSummarised(t, e + 1));
  }
  _persistActive() {
    if (!this._activeId) return;
    const t = this._manager();
    if (!t || !t.isLoaded(this._activeId)) return;
    const e = this._binding.getMessages().map(
      (r) => r.status === "streaming" || r.status === "pending" ? { ...r, status: "completed" } : r
    );
    let s = this._binding.exportTree?.();
    s && (s = {
      headId: s.headId,
      messages: s.messages.map(({ message: r, parentId: i }) => ({
        message: r.status === "streaming" || r.status === "pending" ? { ...r, status: "completed" } : r,
        parentId: i
      }))
    }), t.updateMessages(this._activeId, e, s);
  }
  async _ensureConversationAndPersist(t) {
    const e = this._manager();
    if (!e)
      return;
    const s = this._activeId;
    let r = s ?? e.activeId;
    if (r && this._activeId === null && this._ensureInFlight && (await this._ensureInFlight.catch(() => {
    }), r = this._activeId ?? r), r) {
      if (this._activeId !== null && this._activeId !== r) {
        await e.addMessage(r, t).catch(() => {
        });
        return;
      }
    } else {
      if (!this._ensureInFlight) {
        const i = (t.content ?? "").toString().trim();
        this._ensureInFlight = e.createNew(i).then((a) => a.id);
      }
      if (r = await this._ensureInFlight, this._ensureInFlight = null, this._activeId !== s && this._activeId !== r) {
        e.delete(r).catch(() => {
        });
        return;
      }
      this._activeId = r, this._options.onConversationCreated?.(r), this._isStreaming && !this._turn && this._setTurn("running");
    }
    await e.addMessage(r, t), !this._isStreaming && this._activeId === r && this._persistActive();
  }
}
function kf(n) {
  if (n.hasAttribute("data-glide")) return () => {
  };
  const t = n.ownerDocument, e = () => {
    t.removeEventListener("pointerdown", s, !0), t.removeEventListener("keydown", s, !0), n.removeEventListener("aparte-send", s);
  }, s = () => {
    n.setAttribute("data-glide", ""), e();
  };
  return t.addEventListener("pointerdown", s, !0), t.addEventListener("keydown", s, !0), n.addEventListener("aparte-send", s), e;
}
function Ef(n) {
  let t = n.parentElement;
  for (; t; ) {
    if ((t.tagName.toLowerCase() === "aparte-chat" || t.hasAttribute("data-aparte-chat")) && t.id) return t.id;
    t = t.parentElement;
  }
}
class Cf {
  constructor(t) {
    this._options = t;
  }
  _messageId = null;
  _state = null;
  _reason = "";
  /** The bubble the attributes were last written to, so they can be taken off it even after it left the lookup. */
  _marked = null;
  /** Listen on `window` for the three events; returns the function that stops. */
  start() {
    const t = (a) => this._options.active && !this._options.active() ? !1 : !a || a === this._options.ownId(), e = (a) => !!a && this._options.owns(a), s = (a) => {
      const o = a.detail;
      !t(o?.targetId) || !e(o?.messageId) || (this.clear(), this._set(o.messageId, "pending", ""));
    }, r = (a) => {
      const o = a.detail;
      !t(o?.targetId) || o?.skipped || o?.messageId && o.messageId === this._messageId && this.clear();
    }, i = (a) => {
      const o = a.detail;
      if (!(!t(o?.targetId) || !e(o?.messageId))) {
        if (o.aborted) {
          o.messageId === this._messageId && this.clear();
          return;
        }
        o.messageId !== this._messageId && this.clear(), this._set(o.messageId, "failed", o.error ?? "");
      }
    };
    return window.addEventListener("aparte-compact-start", s), window.addEventListener("aparte-compact-done", r), window.addEventListener("aparte-compact-error", i), () => {
      window.removeEventListener("aparte-compact-start", s), window.removeEventListener("aparte-compact-done", r), window.removeEventListener("aparte-compact-error", i);
    };
  }
  /** Take the state off the bubble and forget it. */
  clear() {
    const t = this._marked ?? (this._messageId ? this._options.bubbleOf(this._messageId) : null);
    this._messageId = null, this._state = null, this._reason = "", this._marked = null, t?.removeAttribute("data-checkpoint"), t?.removeAttribute("data-checkpoint-reason");
  }
  /** Write the remembered state onto the bubble, which may have been created since. */
  reapply() {
    !this._messageId || !this._state || this._write(this._messageId, this._state, this._reason);
  }
  _set(t, e, s) {
    this._messageId = t, this._state = e, this._reason = s, this._write(t, e, s);
  }
  _write(t, e, s) {
    const r = this._options.bubbleOf(t);
    r && (this._marked && this._marked !== r && (this._marked.removeAttribute("data-checkpoint"), this._marked.removeAttribute("data-checkpoint-reason")), this._marked = r, s ? r.setAttribute("data-checkpoint-reason", s) : r.removeAttribute("data-checkpoint-reason"), r.getAttribute("data-checkpoint") !== e && r.setAttribute("data-checkpoint", e));
  }
}
function kr(n) {
  for (let t = n.length - 1; t >= 0; t--) {
    const e = n[t].contextSummary?.summary;
    if (e !== void 0) return { summary: e, messages: n.slice(t) };
  }
  return { messages: n };
}
const xf = "The earlier part of this conversation was compacted. This is a summary of what came before; continue from it.", ti = (n) => `${xf}

${n}`;
function ke(n) {
  const t = (s) => typeof s == "string" ? [{ type: "text", text: s }] : s, e = [];
  for (const s of n) {
    const r = e[e.length - 1];
    s.role !== "user" || r?.role !== "user" ? e.push(s) : typeof r.content == "string" && typeof s.content == "string" ? e[e.length - 1] = { ...r, content: `${r.content}

${s.content}` } : e[e.length - 1] = {
      ...r,
      content: [...t(r.content), { type: "text", text: `

` }, ...t(s.content)]
    };
  }
  return e;
}
const Ba = "The tool call was stopped before it ran.", Tf = "The tool returned no output.";
function If(n) {
  const t = n.result?.trim();
  return n.status === "resolved" ? t || Tf : n.status === "failed" ? t || "The tool failed." : n.status === "rejected" && t || Ba;
}
const qs = (n) => n.type === "tool_call" && !!n.deferred && (n.status === "awaiting-approval" || n.status === "pending"), qa = (n) => n.type === "tool_call" && (n.status === "pending" || n.status === "awaiting-approval");
function uc(n, t, e = {}) {
  const s = n.segments ?? [];
  if (n.role !== "assistant" || !s.some((c) => c.type === "tool_call")) {
    const c = t(s) || (typeof n.content == "string" ? n.content : "");
    return c ? [{ role: n.role, content: c }] : [];
  }
  const r = [];
  let i = [], a = [];
  const o = () => {
    const c = t(i);
    if (a.length === 0)
      c && r.push({ role: "assistant", content: c });
    else {
      r.push({
        role: "assistant",
        content: c,
        toolCalls: a.map((d) => ({ id: d.toolCall.id, name: d.toolCall.name, input: d.toolCall.input }))
      });
      for (const d of a)
        e.openDeferred && qa(d) || r.push({ role: "tool", content: If(d), toolCallId: d.toolCall.id, toolName: d.toolCall.name });
    }
    i = [], a = [];
  };
  let l = !1;
  for (const c of s)
    c.type === "tool_call" ? (a.push(c), e.openDeferred && qa(c) && (l = !0)) : (a.length > 0 && !l && o(), i.push(c));
  return o(), r;
}
const hc = (n) => n.status === "streaming" || n.status === "pending";
function ds(n) {
  if (!n?.length) return "";
  const t = "```", e = [];
  for (const s of n) {
    const r = s.content;
    if (s.type === "text")
      r && e.push(r);
    else if (s.type === "code") {
      const i = s.language ?? "";
      e.push(`${t}${i}
${r ?? ""}
${t}`);
    } else {
      if (s.type === "thinking" || s.type === "tool_call" || s.type === "error" || s.type === "activity")
        continue;
      if (typeof r == "string" && r) {
        const i = s.wire, a = i && typeof i.before == "string" ? i.before : "", o = i && typeof i.after == "string" ? i.after : "";
        e.push(`${a}${r}${o}`);
      } else {
        const i = s.fallback;
        i && e.push(i);
      }
    }
  }
  return e.join(`
`).trim();
}
function Rf(n) {
  const t = ds(n.segments);
  return t || (typeof n.content == "string" && n.content ? n.content : "");
}
function Lf(n) {
  const t = Rf(n);
  return n.compaction ? ti(t) : t;
}
function qn(n) {
  return n.filter((t) => t.role !== "user" && t.role !== "assistant" ? !1 : t.status !== "error" && !hc(t)).flatMap((t) => {
    if (t.role === "assistant" && t.segments?.some((s) => s.type === "tool_call"))
      return uc(t, ds);
    const e = Lf(t);
    return e ? [{ role: t.role, content: e }] : [];
  });
}
function Te(n) {
  return n ? Math.ceil(n.length / 3.8) : 0;
}
const ei = (n) => {
  if (!n) return 0;
  try {
    return Te(JSON.stringify(n));
  } catch {
    return 0;
  }
};
function pc(n) {
  let t = 0;
  for (const e of n)
    t += Te(il(e.content)), e.toolCalls?.length && (t += ei(e.toolCalls));
  return t;
}
function Mf(n) {
  return n.some((t) => typeof t.content != "string" && t.content.some((e) => e.type !== "text"));
}
function Of(n) {
  const t = (n.tools ?? []).map((e) => ({ name: e.name, description: e.description, inputSchema: e.inputSchema }));
  return pc(n.messages) + (t.length ? ei(t) : 0);
}
function $f(n) {
  return pc(qn(n));
}
const Er = (n) => n.totalTokens ?? n.inputTokens + n.outputTokens;
function fc(n) {
  const t = n.getCurrentModel()?.capabilities;
  return (t ? !t.includes("function_calling") : !1) ? [] : n.getTools();
}
function Nf(n, t) {
  if (typeof t == "number" && Number.isFinite(t) && t > 0) return t;
  const e = n.getCurrentModel()?.contextWindow;
  return e && e > 0 ? e : void 0;
}
const gc = (n, t) => n.segments?.some((e) => e.type === t) === !0;
function Pf(n) {
  const t = n.usage?.inputTokens, e = n.contextEstimate;
  return gc(n, "tool_call") ? 1 : t && e && t > 0 && e > 0 ? Math.min(3, Math.max(0.5, t / e)) : 1;
}
function Df(n, t) {
  const e = n.usage;
  if (!gc(n, "thinking") || !(e.inputTokens > 0)) return Er(e);
  const s = n.segments ?? [], r = s.map((a) => a.type).lastIndexOf("tool_call"), i = Math.round(t * Te(ds(s.slice(r + 1))));
  return e.inputTokens + (e.outputTokens > 0 ? Math.min(i, e.outputTokens) : i);
}
function Hf(n) {
  const { messages: t, config: e } = n, s = kr(t), r = fc(e), i = Te(e.resolveSystemPrompt()) + Te(e.resolveToolSystemPrompts(r)), a = r.map((v) => ({ name: v.name, description: v.description, inputSchema: v.inputSchema })), o = a.length ? ei(a) : 0, l = s.summary === void 0 ? 0 : Te(ti(s.summary)), c = { system: i, tools: o, summary: l, messages: $f(s.messages) }, d = i + o + l + c.messages;
  let h = -1;
  for (let v = t.length - 1; v >= 0; v--)
    if (t[v].role === "assistant" && t[v].usage) {
      h = v;
      break;
    }
  const u = h >= 0 ? t[h] : void 0, p = Nf(e, n.windowOverride), f = (v, S) => ({
    ...p !== void 0 ? { window: p } : {},
    used: v,
    estimated: S,
    parts: c,
    other: Math.max(0, v - d)
  }), _ = u !== void 0 && !n.viewChanged && h === t.length - 1 && !t.some((v) => v.contextSummary !== void 0 && v.contextSummary.createdAt > u.timestamp), g = u ? Pf(u) : 1;
  return u && _ ? f(Df(u, g), !1) : f(Math.round(g * d), !0);
}
let Bf = 0, Fn = null;
function cn(n) {
  Fn?.push(n);
}
function Q(n, t, e) {
  const s = document.createElement(n);
  return t && (s.className = t), e != null && (s.textContent = e), s;
}
function ni(n, t, e) {
  const s = Q("span", "aparte-elic-option-body"), r = Q("span", "aparte-elic-option-title", n);
  if (r.dir = "auto", e) {
    const i = Q(
      "span",
      "aparte-tag aparte-tag--sm aparte-elic-option-badge",
      M().t("elicitationRecommended") || "Recommended"
    );
    r.append(" ", i);
  }
  return s.appendChild(r), t && s.appendChild(Object.assign(Q("span", "aparte-elic-option-desc", t), { dir: "auto" })), s;
}
function Cr(n, t, e) {
  const s = Q("button", "aparte-btn aparte-btn--block aparte-btn--surface aparte-elic-option aparte-elic-option--command" + (e ? " aparte-elic-option--recommended" : ""));
  return s.type = "button", s.appendChild(ni(n, t, e)), s;
}
function si(n, t, e) {
  let s;
  if (t.title && t.title.trim() !== e?.trim()) {
    const r = Q("p", "aparte-elic-title", t.title);
    r.dir = "auto", s = `elic-title-${pt()}`, r.id = s, n.appendChild(r);
  }
  return t.description && n.appendChild(Object.assign(Q("p", "aparte-elic-desc", t.description), { dir: "auto" })), s;
}
function _c(n, t) {
  n.setAttribute("role", t.multiple || t.commands ? "group" : "radiogroup"), t.titleId ? n.setAttribute("aria-labelledby", t.titleId) : t.fallbackLabel && n.setAttribute("aria-label", t.fallbackLabel);
}
function qf(n, t, e, s) {
  const r = Q("div", "aparte-elic-field aparte-elic-enum"), i = si(r, n, e), a = Q("div", "aparte-elic-options"), o = `elic-${pt()}`, l = n.multiple ? "checkbox" : "radio", c = l === "checkbox" ? "aparte-checkbox" : "aparte-radio", d = n.allowOther ?? M().getElicitationOptions().allowOther, h = new Set(Array.isArray(n.default) ? n.default : n.default != null ? [n.default] : []), u = s != null && !n.multiple && h.size === 0;
  _c(a, { multiple: n.multiple, commands: u, titleId: i, fallbackLabel: e });
  const p = (b, y, E, R) => {
    if (u) {
      const O = Cr(y, E, R);
      return O.addEventListener("click", () => s?.(b)), O;
    }
    const w = Q("label", "aparte-field-choice aparte-elic-option" + (R ? " aparte-elic-option--recommended" : "")), I = Q("input", c + " aparte-elic-control");
    return I.type = l, I.name = o, I.value = b, h.has(b) && (I.checked = !0), w.append(I, ni(y, E, R)), w;
  };
  for (const b of n.options)
    a.appendChild(p(b.value, b.label ?? b.value, b.description, b.recommended));
  let f = null, _ = !1;
  if (d) {
    const b = M();
    f = Q("input", "aparte-field aparte-elic-other-input"), f.type = "text", f.placeholder = b.t("elicitationOtherPlaceholder"), f.style.display = "none", f.setAttribute("aria-label", b.t("elicitationOtherLabel"));
    const y = f;
    if (u) {
      const E = Cr(b.t("elicitationOther"));
      E.classList.add("aparte-elic-option--other"), E.setAttribute("aria-expanded", "false"), E.addEventListener("click", () => {
        _ = !0, E.setAttribute("aria-expanded", "true"), y.style.display = "", y.focus(), t();
      });
      const R = E.querySelector(".aparte-elic-option-title");
      cn(() => {
        const w = M();
        R.textContent = w.t("elicitationOther"), y.placeholder = w.t("elicitationOtherPlaceholder"), y.setAttribute("aria-label", w.t("elicitationOtherLabel"));
      }), a.append(E, y);
    } else {
      const E = Q("label", "aparte-field-choice aparte-elic-option aparte-elic-option--other"), R = Q("input", c + " aparte-elic-control");
      R.type = l, R.name = o, R.value = "__other__";
      const w = Q("span", "aparte-elic-option-body"), I = Q("span", "aparte-elic-option-title", b.t("elicitationOther"));
      w.appendChild(I), cn(() => {
        const O = M();
        I.textContent = O.t("elicitationOther"), y.placeholder = O.t("elicitationOtherPlaceholder"), y.setAttribute("aria-label", O.t("elicitationOtherLabel"));
      }), w.appendChild(f), E.append(R, w), a.appendChild(E);
    }
  }
  r.appendChild(a);
  const g = () => Array.from(a.querySelectorAll(".aparte-elic-control")), v = () => a.querySelector('input[value="__other__"]');
  let S = !1;
  a.addEventListener("keydown", (b) => {
    S = b.key.startsWith("Arrow");
  }), a.addEventListener("click", () => {
    S = !1;
  }), a.addEventListener("change", () => {
    const b = v();
    b && f && (f.style.display = b.checked ? "" : "none", b.checked && !S && f.focus()), S = !1, t();
  }), f?.addEventListener("input", t);
  const A = () => f?.value.trim() ?? "";
  if (u)
    return {
      el: r,
      getValue: () => A(),
      isComplete: () => _ && A() !== "",
      focus: () => a.querySelector(".aparte-elic-option--command")?.focus(),
      offersSubmit: () => _
    };
  const C = () => {
    const b = v()?.checked && A() ? A() : "";
    if (n.multiple) {
      const E = g().filter((R) => R.checked && R.value !== "__other__").map((R) => R.value);
      return b && E.push(b), E;
    }
    const y = g().find((E) => E.checked);
    return y ? y.value === "__other__" ? b : y.value : "";
  };
  return {
    el: r,
    getValue: C,
    isComplete: () => {
      const b = C();
      return n.multiple ? b.length > 0 : b !== "";
    },
    focus: () => g()[0]?.focus()
  };
}
function Ff(n, t, e, s) {
  const r = Q("div", "aparte-elic-field aparte-elic-boolean"), i = si(r, n, e), a = Q("div", "aparte-elic-options"), o = `elic-${pt()}`, l = s != null && n.default == null;
  if (_c(a, { commands: l, titleId: i, fallbackLabel: e }), l) {
    const u = M(), p = (f, _, g) => {
      const v = Cr(_);
      if (v.addEventListener("click", () => s?.(f)), g) {
        const S = v.querySelector(".aparte-elic-option-title");
        cn(() => {
          S.textContent = M().t(g);
        });
      }
      a.appendChild(v);
    };
    return p(!0, n.trueLabel ?? u.t("elicitationYes"), n.trueLabel ? void 0 : "elicitationYes"), p(!1, n.falseLabel ?? u.t("elicitationNo"), n.falseLabel ? void 0 : "elicitationNo"), r.appendChild(a), {
      el: r,
      // Never read: the click settles, so nothing downstream asks this shape for
      // a value. `false` rather than a throw keeps the field total.
      getValue: () => !1,
      isComplete: () => !1,
      focus: () => a.querySelector(".aparte-elic-option--command")?.focus(),
      offersSubmit: () => !1
    };
  }
  const c = (u, p, f) => {
    const _ = Q("label", "aparte-field-choice aparte-elic-option"), g = Q("input", "aparte-radio aparte-elic-control");
    g.type = "radio", g.name = o, g.value = u, n.default != null && String(n.default) === u && (g.checked = !0);
    const v = Q("span", "aparte-elic-option-body"), S = Q("span", "aparte-elic-option-title", p);
    S.dir = "auto", f && cn(() => {
      S.textContent = M().t(f);
    }), v.appendChild(S), _.append(g, v), a.appendChild(_);
  }, d = M();
  c("true", n.trueLabel ?? d.t("elicitationYes"), n.trueLabel ? void 0 : "elicitationYes"), c("false", n.falseLabel ?? d.t("elicitationNo"), n.falseLabel ? void 0 : "elicitationNo"), r.appendChild(a), a.addEventListener("change", t);
  const h = () => a.querySelector("input:checked");
  return {
    el: r,
    getValue: () => h()?.value === "true",
    isComplete: () => h() != null,
    focus: () => a.querySelector("input")?.focus()
  };
}
function Uf(n, t, e) {
  const s = Q("div", "aparte-elic-field aparte-elic-string");
  si(s, n, e);
  const r = n.multiline ? Q("textarea", "aparte-field aparte-field--textarea aparte-elic-text") : Q("input", "aparte-field aparte-elic-text");
  n.multiline || (r.type = "text"), n.placeholder && r.setAttribute("placeholder", n.placeholder), n.default && (r.value = n.default), n.maxLength != null && r.setAttribute("maxlength", String(n.maxLength));
  const i = n.title || n.description || e || void 0;
  if (r.setAttribute("aria-label", i ?? M().t("elicitationAnswerLabel")), i == null) {
    const l = r;
    cn(() => {
      l.setAttribute("aria-label", M().t("elicitationAnswerLabel"));
    });
  }
  s.appendChild(r), r.addEventListener("input", t);
  const a = n.required ?? !0, o = () => r.value;
  return {
    el: s,
    getValue: () => o(),
    isComplete: () => {
      const l = o().trim();
      return !a && l === "" ? !0 : l.length >= (n.minLength ?? 1);
    },
    focus: () => r.focus()
  };
}
function Fa(n, t, e, s, r) {
  const i = M().getElicitationFieldRenderer()?.(n, { key: s, notifyChange: t });
  if (i)
    return {
      el: i.el,
      getValue: () => i.getValue(),
      isComplete: () => i.isComplete(),
      focus: () => i.focus?.()
    };
  switch (n.type) {
    case "enum":
      return qf(n, t, e, r);
    case "boolean":
      return Ff(n, t, e, r);
    // No `settle`: text is written, not chosen, so it always needs a commit.
    case "string":
      return Uf(n, t, e);
  }
}
function Wf(n, t, e) {
  const s = [], r = Fn;
  Fn = s;
  try {
    return { ...zf(n, t, e), relabel: () => {
      for (const a of s) a();
    } };
  } finally {
    Fn = r;
  }
}
function zf(n, t, e) {
  const s = Q("div", "aparte-elic-panel"), r = typeof n == "function" ? n() : n;
  r && s.appendChild(Object.assign(Q("p", "aparte-elic-message", r), { dir: "auto" }));
  let i = null, a = !1;
  const o = (p) => {
    a || (a = !0, i?.(p));
  }, l = (p) => {
    i = p;
  }, c = Q("div", "aparte-elic-body");
  s.appendChild(c);
  const d = Q("div", "aparte-elic-dismiss");
  if (s.appendChild(d), t.type === "object") {
    const p = Object.entries(t.properties), f = new Set(t.required ?? p.map(([w]) => w)), _ = M();
    let g = () => {
    };
    const v = () => {
      g(), e();
    }, S = p.map(([w, I]) => {
      const O = Fa(I, v, void 0, w);
      return !I.title && !O.el.querySelector(".aparte-elic-title") && O.el.insertBefore(Object.assign(Q("p", "aparte-elic-title", w), { dir: "auto" }), O.el.firstChild), c.appendChild(O.el), { key: w, field: O, required: f.has(w), header: I.header };
    }), A = () => S.every((w) => !w.required || w.field.isComplete()), C = {
      el: s,
      dismiss: d,
      getContent: () => Object.fromEntries(S.map((w) => [w.key, w.field.getValue()])),
      isComplete: A,
      focus: () => S[0]?.field.focus(),
      // A form of one behaves like a single field; only a real form steps.
      mode: () => "submit",
      canProceed: A,
      proceed: () => {
      },
      // A form never settles from inside: its questions are collected and
      // submitted together, and answering the last one on the click would be
      // WCAG's F36 word for word. Registered so the shape is total; never fired.
      onSettle: l
    };
    if (S.length < 2 || _.getElicitationOptions().layout !== "stepped") return C;
    s.classList.add("aparte-elic-panel--stepped");
    let b = 0;
    const y = `aparte-elic-${++Bf}`, E = Q("div", "aparte-tabs aparte-tabs--underline aparte-elic-steps");
    E.setAttribute("role", "tablist");
    const R = S.map((w, I) => {
      const O = Q("button", "aparte-tabs__tab aparte-elic-step");
      return O.type = "button", O.setAttribute("role", "tab"), O.textContent = w.header?.trim() || String(I + 1), O.dir = "auto", O.id = `${y}-tab-${I}`, w.field.el.id = `${y}-panel-${I}`, w.field.el.setAttribute("role", "tabpanel"), w.field.el.setAttribute("aria-labelledby", O.id), O.setAttribute("aria-controls", w.field.el.id), E.appendChild(O), O;
    });
    return s.insertBefore(E, c), E.addEventListener("aparte-tab-change", (w) => {
      b = R.indexOf(w.detail.tab);
    }), Wd(E), E.addEventListener("click", (w) => {
      const I = R.indexOf(w.target.closest(".aparte-elic-step"));
      I >= 0 && I === b && S[I].field.focus();
    }), g = () => {
      R.forEach((w, I) => {
        const O = S[I].field.isComplete();
        w.toggleAttribute("data-answered", O);
        const N = w.querySelector(".aparte-elic-step__mark");
        if (O && !N) {
          const G = Q("span", "aparte-elic-step__mark");
          G.setAttribute("aria-hidden", "true"), G.innerHTML = _.getIcon("check"), w.prepend(G);
        } else !O && N && N.remove();
      });
    }, g(), {
      ...C,
      focus: () => S[b]?.field.focus()
    };
  }
  const h = M().getElicitationOptions().answerOnClick, u = Fa(t, e, r, void 0, h ? o : void 0);
  return c.appendChild(u.el), {
    el: s,
    dismiss: d,
    getContent: () => u.getValue(),
    isComplete: () => u.isComplete(),
    focus: () => u.focus(),
    mode: () => u.offersSubmit?.() ?? !0 ? "submit" : "none",
    canProceed: () => u.isComplete(),
    proceed: () => {
    },
    onSettle: l
  };
}
let Gf = 0;
function Ut(n, t, e) {
  const s = document.createElement(n);
  return t && (s.className = t), e != null && (s.textContent = e), s;
}
let jf = 0;
function Kf(n, t, e, s, r = !0) {
  const i = M(), a = Ut("div", "aparte-elic-panel aparte-approval-panel"), o = Ut("div", "aparte-elic-body");
  a.appendChild(o);
  const l = () => typeof n == "function" ? n() : n, c = l() ? Object.assign(Ut("p", "aparte-elic-message", l()), { dir: "auto" }) : null;
  c && o.appendChild(c);
  let d = null;
  if (s) {
    d = Ut("div", "aparte-approval-args-label", i.t("approvalArgsLabel")), d.id = "aparte-approval-args-" + ++Gf;
    const y = Ut("pre", "aparte-approval-args");
    y.textContent = s, y.setAttribute("role", "group"), y.setAttribute("aria-labelledby", d.id), y.tabIndex = 0, o.append(d, y);
  }
  const h = Ut("div", "aparte-elic-dismiss");
  a.appendChild(h);
  let u = null, p = !1;
  const f = (y) => {
    p || (p = !0, u?.(y));
  }, _ = Ut("div", "aparte-approval-options");
  _.setAttribute("role", "group"), _.setAttribute("aria-label", i.t("approvalOptionsLabel")), c && (c.id ||= `aparte-approval-ask-${++jf}`, _.setAttribute("aria-describedby", c.id));
  const g = [], v = (y) => typeof y.label == "function" ? y.label() : y.label, S = (y) => typeof y.description == "function" ? y.description() : y.description, A = (y) => ni(v(y), S(y));
  for (const y of t) {
    const E = y.tone ?? "affirm", R = Ut("button", `aparte-btn aparte-btn--block aparte-btn--surface aparte-approval-option aparte-approval-option--${E}`);
    R.type = "button", R.appendChild(A(y)), R.addEventListener("click", () => f({ option: y.value })), _.appendChild(R), g.push({ button: R, option: y });
  }
  o.appendChild(_);
  const C = r ? Ut("textarea", "aparte-approval-instruction") : null;
  C && (C.rows = 1, C.placeholder = i.t("approvalInstructionPlaceholder"), C.setAttribute("aria-label", i.t("approvalInstructionPlaceholder")), C.addEventListener("input", e), o.appendChild(C));
  const b = () => C?.value.trim() ?? "";
  return {
    el: a,
    dismiss: h,
    onSettle: (y) => {
      u = y;
    },
    getContent: () => ({ instruction: b() }),
    isComplete: () => b().length > 0,
    focus: () => {
      a.querySelector(".aparte-approval-option")?.focus();
    },
    relabel: () => {
      const y = M(), E = y.t("approvalInstructionPlaceholder");
      C && (C.placeholder = E, C.setAttribute("aria-label", E)), _.setAttribute("aria-label", y.t("approvalOptionsLabel")), c && (c.textContent = l()), d && (d.textContent = y.t("approvalArgsLabel"));
      for (const { button: R, option: w } of g) R.replaceChildren(A(w));
    }
  };
}
function Vf(n) {
  return $(n.target ?? null).requestUserInput(n);
}
const Xf = "Not run: an earlier call of the same step was refused.", Ua = (n) => JSON.stringify([n.id, n.name, n.input]), Wa = /* @__PURE__ */ new Set(), se = /* @__PURE__ */ new Map(), za = "aparte-chat, aparte-chat-viewport, [data-aparte-chat]";
function Yf(n) {
  return {
    id: n,
    getMetadata: () => ({ id: n, name: n }),
    getModels: () => [],
    chat: async () => {
      throw new ut(
        "This turn has no provider in the page. Register one, or use a runner that calls the model elsewhere (createAgentStreamRunner, an AG-UI runner).",
        tt.CONFIG_NO_PROVIDER
      );
    }
  };
}
function Qf(n, t) {
  const e = [];
  let s = 0;
  for (const r of [...t].sort((i, a) => i.start - a.start)) {
    const i = n.indexOf(r.text, s);
    i < 0 || (s = i + r.text.length, e.push({ ...r, start: i, end: s }));
  }
  return e;
}
class Zf {
  _boundHandler = null;
  /** Between `start()` and `stop()`: the listeners are on `window`. The send handler alone is
   *  not the sign — the constructor prepares it without listening. */
  _listening = !1;
  _boundAbortHandler = null;
  _boundLoadedHandler = null;
  _boundRetryHandler = null;
  _boundEditHandler = null;
  _releaseKeyResolver = null;
  _isAborted = !1;
  /** Provider and model pairs whose window was already read again after a turn (see `_readWindowAfterTurn`). */
  _windowReadFor = /* @__PURE__ */ new Set();
  /**
   * The current model's window, read again once after a turn when it had none.
   *
   * A local server that loads a model on its first request — LM Studio's just-in-time
   * loading, Ollama — has no loaded window to report when the model list is fetched at
   * start-up, so the model comes without one, and the gauge and the compaction have
   * nothing to measure against. After a reply the model is loaded, and the provider's
   * own probe finds it. Once per provider and model: a server that never says costs one
   * request, not one per turn. The config announces the window when it appears.
   */
  async _readWindowAfterTurn() {
    const t = this._config, e = t.getCurrentModel(), s = t.getModelConfig().defaultProvider;
    if (!e || e.contextWindow || !s) return;
    const r = `${s}\0${e.id}`;
    this._windowReadFor.has(r) || (this._windowReadFor.add(r), await t.refreshProviderModels(s));
  }
  /**
   * Does this window event belong to this client?
   *
   * One rule for all the window-event handlers, so none of them can lack the guard:
   * in a two-client layout an unguarded event would make BOTH clients run — two paid
   * calls against whichever chat the DOM scan found first.
   *
   * A scoped client also answers only events ADDRESSED to it; an untargeted event is
   * not let through to every scoped client, or one broadcast would act on every chat
   * on the page.
   */
  _isForThisInstance(t) {
    if (!t) return !0;
    const e = t.detail, s = this.options.scopeToTargetId;
    if (s) return e?.targetId === s;
    if (this._config === _t) {
      if (se.size === 0) return !0;
      const a = this._resolveTarget(e?.targetId, t), o = a ? $(a) : _t;
      return o === _t || !se.has(o);
    }
    const r = this._resolveTarget(e?.targetId, t);
    if (!r) return !0;
    const i = $(r);
    return i === this._config || i === _t;
  }
  /** Aborts the in-flight vendor/transport fetch when the user stops a stream. */
  _streamController = null;
  options;
  /** Config read by this client — an instance config, or the global default. */
  _config;
  /** Whether this client, started on an instance config, counts in `claimedConfigs`. */
  _claims = !1;
  /**
   * A `keyResolver` becomes a key source on the client's config at once, before `start()`,
   * so everything that needs a key can use it — the model selector's list included.
   * `autoRegister` (on by default) installs core's built-in renderers on that config.
   */
  constructor(t = {}) {
    this.options = {
      autoRegister: !0,
      ...t
    }, this._config = t.config ?? _t, this._registerKeyResolver(), this.options.autoRegister ? Lp(this._config) : Ip(this._config), this._setupListeners();
  }
  /**
   * What every fresh user action does before it starts a turn.
   *
   * Clearing the abort flag happens at the START of the action rather than inside
   * `_streamTurn`, which runs after the auth and file-reading awaits — a reset there
   * would erase an abort that arrived while the user was still waiting for a large
   * attachment to be read.
   *
   * The superseded turn's TOOL handlers are not cancelled here, and do not need a
   * registry of their own: `_streamTurn` aborts the previous `_streamController`, and
   * the engine links every tool handler's controller to that run signal
   * (`invokeToolHandler`), so cutting the stream cuts its tools.
   */
  _beginUserTurn() {
    this._isAborted = !1;
  }
  /**
   * Put this client's `keyResolver` on its config, and hold the teardown so
   * `stop()` can take it back off.
   *
   * The teardown means a stopped client stops signing model-list requests, and a
   * remount — the way the wrappers document swapping options — replaces the source
   * instead of adding one behind it. Idempotent, so the usual
   * `new AparteClient({…}).start()` registers once.
   */
  _registerKeyResolver() {
    this._releaseKeyResolver || !this.options.keyResolver || (this._releaseKeyResolver = this._config.registerKeyProvider(this.options.keyResolver));
  }
  /**
   * Sets up the event listeners.
   * This is called once in the constructor.
   */
  _setupListeners() {
    this._boundHandler || (this._boundHandler = (t) => {
      const e = t;
      e.type === "aparte-send" && this._isForThisInstance(e) && (this._beginUserTurn(), this._handleSend(e));
    });
  }
  /**
   * Answer the chats: listen on `window` for `aparte-send`, `aparte-retry`, `aparte-edit`,
   * `aparte-abort` and `aparte-conversation-loaded`. Nothing streams before this is
   * called. Starting a stopped client puts its `keyResolver` back on the config.
   */
  start() {
    this._registerKeyResolver(), this._config !== _t && !this._claims && (this._claims = !0, se.set(this._config, (se.get(this._config) ?? 0) + 1)), this._boundHandler || this._setupListeners(), this._boundHandler && window.addEventListener("aparte-send", this._boundHandler), this._boundAbortHandler || (this._boundAbortHandler = (t) => {
      this._isForThisInstance(t) && this.abort();
    }), window.addEventListener("aparte-abort", this._boundAbortHandler), this._boundRetryHandler || (this._boundRetryHandler = (t) => {
      const e = t;
      this._isForThisInstance(e) && this._handleRetry(e);
    }), window.addEventListener("aparte-retry", this._boundRetryHandler), this._boundEditHandler || (this._boundEditHandler = (t) => {
      const e = t;
      this._isForThisInstance(e) && this._handleEdit(e);
    }), window.addEventListener("aparte-edit", this._boundEditHandler), this._boundLoadedHandler || (this._boundLoadedHandler = (t) => {
      if (!this._isForThisInstance(t)) return;
      const e = t.target instanceof HTMLElement ? t.target : void 0;
      this.resumeDeferred(e ?? t.detail?.targetId);
    }), window.addEventListener("aparte-conversation-loaded", this._boundLoadedHandler), this._listening = !0;
  }
  /**
   * Stop answering: abort the reply in flight, take this client's `keyResolver` off the
   * config, and remove the listeners.
   */
  stop() {
    if (this.abort(), this._claims) {
      this._claims = !1;
      const t = (se.get(this._config) ?? 1) - 1;
      t > 0 ? se.set(this._config, t) : se.delete(this._config);
    }
    this._releaseKeyResolver?.(), this._releaseKeyResolver = null, !(!this._listening || !this._boundHandler) && (this._listening = !1, window.removeEventListener("aparte-send", this._boundHandler), this._boundHandler = null, this._boundAbortHandler && (window.removeEventListener("aparte-abort", this._boundAbortHandler), this._boundAbortHandler = null), this._boundLoadedHandler && (window.removeEventListener("aparte-conversation-loaded", this._boundLoadedHandler), this._boundLoadedHandler = null), this._boundRetryHandler && (window.removeEventListener("aparte-retry", this._boundRetryHandler), this._boundRetryHandler = null), this._boundEditHandler && (window.removeEventListener("aparte-edit", this._boundEditHandler), this._boundEditHandler = null));
  }
  /**
   * Abort the current streaming response and all active tool calls.
   * Dispatches `aparte-message-aborted` on the target element.
   */
  abort() {
    this._isAborted = !0, this._streamController?.abort();
  }
  /**
   * Ask the human at the COMPOSER, and report what they decided.
   *
   * The default channel. Routing through `requestUserInput` puts the decision
   * where every other request for the user already goes, which is the whole point:
   * one queue, one panel slot, one teardown, and the same behaviour whether the
   * request came from a tool handler or from this gate.
   *
   * The tool NAME is the question and its ARGUMENTS are the body, because the
   * arguments are what is being approved — a decision surface that names the act and
   * hides its subject asks for a signature on a blank page. The transcript row stays the
   * anchor, but it is not the only place the call can be read. The panel is capped
   * at 50vh and the block inside it scrolls, so a long input cannot push the options
   * off the surface they are asked on.
   *
   * There is no `aparte-tool-decision` event and no `document` listener that answers
   * one: a decision is answered by a typed presenter registered per config instance,
   * never by a window event. A host
   * that wants to answer programmatically registers an `approvalResolver` (headless,
   * no DOM) or its own presenter, both strictly more capable than an id on an event.
   */
  async _askForApproval(t, e, s) {
    const r = t.agent?.name?.trim(), i = await Vf({
      kind: "approval",
      /*
       * A function, like the option labels below, and for the same reason: the
       * FRAME is locale text and follows a language switch while the question is
       * open. The tool's NAME is substituted into it and never translated — it is
       * wire format, the identifier the model called.
       */
      message: () => {
        const l = this._config.getLocale(), c = $(s), d = {
          id: `tool-${t.id}`,
          type: "tool_call",
          status: "awaiting-approval",
          toolCall: { id: t.id, name: t.name, input: t.input }
        }, h = Kr(d, c).text, u = _p(d, c), p = u ? `${h} ${u}` : h;
        return r ? (l.approvalAskBy ?? "Allow {tool} for {agent}?").replace(/\{(agent|tool)\}/g, (f, _) => _ === "agent" ? r : p) : (l.approvalAsk ?? "Allow {tool}?").replace("{tool}", () => p);
      },
      // A plain string, not a function: the arguments are the model's — its JSON, or
      // the tool's own formatter's reading of it — and do not change with the
      // language. Same text the transcript row shows, from the same function and the
      // same config — the chat's, which the row renders with — so the two surfaces
      // cannot disagree about what is being run.
      details: Pl(t.input, $(s).getToolInputFormatter(t.name)),
      // Functions, not strings, same as the question: these follow a language
      // switch while the request is open, which a resolved string cannot.
      options: [
        { value: "allow", label: () => this._config.getLocale().approveTool ?? "Approve", tone: "affirm" },
        { value: "deny", label: () => this._config.getLocale().rejectTool ?? "Reject", tone: "deny" }
      ],
      signal: e,
      target: s
    });
    if (i.action !== "accept") return { approved: !1, by: "person" };
    const a = i.content, o = a?.instruction?.trim();
    return o ? { approved: !1, instruction: o, by: "person" } : a?.option === "allow" ? { approved: !0 } : { approved: !1, by: "person" };
  }
  /**
   * Resolve the auth for a provider: `options.keyResolver` takes precedence,
   * then the aparteGlobalConfig key channel (`setKeyProvider`) so a key registered
   * there reaches the request. One key source on the happy path.
   */
  /**
   * The runner calls the model somewhere else — a server loop, an AG-UI agent — so the
   * page needs no provider of its own. The engine's loop, passed explicitly, still does.
   */
  get _modelRunsElsewhere() {
    const t = this.options.streamRunner;
    return !!t && t !== Ii;
  }
  /**
   * The provider a turn runs on: the registered one, else, when the model runs
   * elsewhere, a stand-in carrying the id the page named (none is fine: the server
   * picks). Undefined when the page must have one and has not.
   */
  _providerFor(t) {
    const e = t ? this._config.getAIProvider(t) : void 0;
    return e || (this._modelRunsElsewhere ? Yf(t ?? "") : void 0);
  }
  async _resolveAuth(t) {
    if (this.options.keyResolver) {
      const s = await this.options.keyResolver(t);
      if (s) return s;
    }
    return await this._config.getKey(t) || void 0;
  }
  /**
   * The shared tail of send / retry / edit: attach the current tools, run the
   * request interceptor, honour `toolChoice: 'none'`, reset the abort flag,
   * dispatch `aparte-message-start`, run the agentic `_streamLoop`, then dispatch
   * `aparte-message-done` or route the error to the lifecycle handler.
   *
   * Callers own only their turn-specific prep (target resolution, history
   * building, appending the assistant placeholder) and hand the fully-built
   * `messages` here — one place for the provider→interceptor→toolChoice→stream
   * sequence, so it can't drift between the three entry points.
   */
  async _streamTurn(t, e, s, r, i, a, o) {
    const l = this._targetIdOf(t), c = this._toolsForCurrentModel(), d = async (y) => {
      let E = {
        messages: y,
        modelId: i,
        stream: !0,
        tools: c.length ? c : void 0,
        ...o?.temperature !== void 0 ? { temperature: o.temperature } : {},
        ...o?.meta ? { _meta: o.meta } : {}
      };
      if (this.options.requestInterceptor && (E = await this.options.requestInterceptor(E)), E.toolChoice === "none") {
        const R = this._config.resolveToolSystemPrompts(c);
        E = {
          ...E,
          tools: void 0,
          messages: R ? E.messages.filter((w) => !(w.role === "system" && w.content === R)) : E.messages
        };
      }
      return E;
    };
    let h = await d(r);
    if (this._isAborted) {
      kt(t, "aparte-message-aborted", { messageId: e }, l), this._updateMessage(t, e, { status: "completed" });
      return;
    }
    kt(t, "aparte-message-start", { messageId: e, role: "assistant" }, l), o?.resume && kt(t, "aparte-message-paused", { messageId: e }, l), !o?.resume && s.id && this._updateMessage(t, e, {
      model: {
        providerId: s.id,
        modelId: h.modelId,
        ...h.temperature !== void 0 ? { temperature: h.temperature } : {}
      }
    });
    const u = new AbortController();
    this._streamController !== u && this._streamController?.abort(), this._streamController = u, this._turnsInFlight.add(e), this._agentNames.set(e, /* @__PURE__ */ new Map());
    const p = o?.rebuild ? $(t).getCompactor() ?? this._config.getCompactor() : null, f = () => {
      const y = t.getMessages?.() ?? [], E = y.findIndex((w) => w.id === e), R = E > 0 ? y[E - 1] : void 0;
      return R?.role === "user" ? [R.id, e] : [e];
    }, _ = () => o?.resume ? this._resumeMessages(t, e, h.messages) : h.messages, g = () => Of({ messages: _(), tools: h.tools }), v = () => Mf(_()) ? void 0 : g(), S = () => {
      this._closeOpenCalls(t, e), kt(t, "aparte-message-aborted", { messageId: e }, l), this._updateMessage(t, e, { status: "completed" });
    }, A = () => this._isAborted || u.signal.aborted, C = async () => {
      let y = o?.resume ? { usage: void 0, suspended: o.resume } : await this._streamLoop(t, e, s, h, a, u, void 0, o?.files);
      const E = this.options.maxTurns ?? 10;
      let R = 0, w = /* @__PURE__ */ new Set();
      const I = Os({ target: t, config: this._config, messageId: e, ...l ? { targetId: l } : {} });
      for (; y.suspended; ) {
        const G = this._isAborted || u.signal.aborted;
        if (!G && ++R > E) {
          this._closeOpenCalls(t, e), Os({ target: t, config: this._config, messageId: e, ...l ? { targetId: l } : {} })(
            { type: "turn-limit-exceeded", scope: "global", limit: E }
          );
          break;
        }
        const B = /* @__PURE__ */ new Set(), j = G ? void 0 : await this._answerDeferred(t, e, y.suspended.pending, u.signal, I, w, B);
        if (w = B, !j) {
          this._closeOpenCalls(t, e), (this._isAborted || u.signal.aborted) && kt(t, "aparte-message-aborted", { messageId: e }, l);
          break;
        }
        const x = {
          outcomes: j,
          ...y.suspended.ticket ? { token: y.suspended.ticket } : {}
        }, P = this._resumeMessages(t, e, h.messages);
        this._spendPause(t, e), kt(t, "aparte-message-resumed", { messageId: e }, l), y = await this._streamLoop(
          t,
          e,
          s,
          { ...h, messages: P },
          a,
          u,
          x
        );
      }
      const O = y.usage, N = y.finishReason;
      this._isAborted || u.signal.aborted ? (this._closeOpenCalls(t, e), this._updateMessage(t, e, { status: "completed" })) : (kt(t, "aparte-message-done", { messageId: e, role: "assistant", usage: O, ...N ? { finishReason: N } : {} }, l), this._readWindowAfterTurn());
    }, b = async (y) => {
      if (y.code !== tt.USAGE_CONTEXT_EXCEEDED || !p || !o?.rebuild || (t.getMessage?.(e)?.segments ?? t.getMessages?.()?.find((R) => R.id === e)?.segments ?? []).some((R) => R.type === "text" || R.type === "tool_call")) return "stands";
      try {
        const R = await p.compact({
          target: t,
          ...l ? { targetId: l } : {},
          force: !0,
          reason: "overflow",
          exclude: f(),
          signal: u.signal
        });
        if (A()) return "stopped";
        if (!R.ok || R.skipped) return "stands";
        h = await d(await o.rebuild());
      } catch {
        return "stands";
      }
      return this._updateMessage(t, e, { status: "pending" }), "resend";
    };
    try {
      for (let y = 0; ; y++)
        try {
          if (y === 0 && p?.beforeSend && o?.rebuild) {
            let E = !1;
            try {
              E = await p.beforeSend({
                target: t,
                ...l ? { targetId: l } : {},
                exclude: f(),
                requestTokens: g(),
                signal: u.signal
              });
            } catch (R) {
              console.warn("[AparteClient] The compactor threw before a send; sending the request as built.", R);
            }
            if (A()) {
              S();
              return;
            }
            E && (h = await d(await o.rebuild()));
          }
          this._updateMessage(t, e, { contextEstimate: v() }), await C();
          return;
        } catch (E) {
          if (this._closeOpenCalls(t, e), A()) {
            kt(t, "aparte-message-aborted", { messageId: e }, l), this._updateMessage(t, e, { status: "completed" });
            return;
          }
          const R = ut.from(E, tt.UNKNOWN_ERROR), w = y === 0 ? await b(R) : "stands";
          if (w === "resend") continue;
          if (w === "stopped") {
            S();
            return;
          }
          this._handleLifecycleError(t, e, R);
          return;
        }
    } finally {
      this._turnsInFlight.delete(e), this._agentNames.delete(e);
    }
  }
  /**
   * Replies a turn is running into right now, a pause it waits on included: a second
   * load of their conversation must not start them again (`resumeDeferred`).
   */
  _turnsInFlight = /* @__PURE__ */ new Set();
  /**
   * The name of each sub-agent of a turn in flight, by reply then `agentId`, as its
   * `agent-start` gave it: what a paused run's question says about who asks. A pending
   * call carries only an `agentId`. Lives as long as the turn, never on the message.
   */
  _agentNames = /* @__PURE__ */ new Map();
  /**
   * Handle aparte-retry — add a sibling branch to the assistant message and re-stream
   * using the same conversation history minus the retried reply.
   */
  /**
   * The registered tools, unless the current model says it cannot call one — the gate
   * lives in `toolsForCurrentModel` (with its reasoning), where the context measure reads
   * the same rule, so send / retry / edit and the gauge cannot drift.
   */
  _toolsForCurrentModel() {
    return fc(this._config);
  }
  async _handleRetry(t) {
    const { messageId: e, targetId: s } = t.detail ?? {};
    if (this._beginUserTurn(), !e) return;
    const r = this._resolveTarget(s, t);
    if (!r) {
      console.warn("[AparteClient] aparte-retry — no target found");
      return;
    }
    const i = r.getMessages?.() ?? [], a = i.findIndex((S) => S.id === e), l = (a >= 0 ? i[a] : void 0)?.role === "user" ? a + 1 : a, c = a >= 0 ? i.slice(0, l) : i, d = {
      id: pt(),
      role: "assistant",
      content: "",
      status: "pending",
      timestamp: Date.now()
    }, h = r.addSiblingOf?.(e, d) ?? d.id, u = this._config.getModelConfig(), p = u.defaultProvider, f = this._providerFor(p);
    if (!f) return;
    const _ = p ? await this._resolveAuth(p) : void 0, g = this._messagesToChatMessages(c), v = this._systemMessages();
    await this._streamTurn(
      r,
      h,
      f,
      [...v, ...ke(g)],
      u.defaultModel || "",
      _,
      {
        ...f.retryTemperature !== void 0 ? { temperature: f.retryTemperature } : {},
        ...this._turnMeta([...c].reverse().find((S) => S.role === "user")),
        rebuild: async () => [
          ...this._systemMessages(),
          ...ke(this._messagesToChatMessages(this._current(r, c)))
        ]
      }
    );
  }
  /**
   * The system messages a turn opens with: the app's own template, then the registered
   * tools' `systemPrompt`s.
   *
   * One helper for the three turn entry points (send, retry, edit), so the tool half
   * cannot be added to two of them and forgotten in the third — the same shape as the
   * abort-flag asymmetry `_beginUserTurn` exists to prevent.
   */
  _systemMessages() {
    const t = [], e = this._config.resolveSystemPrompt();
    e && t.push({ role: "system", content: e });
    const s = this._config.resolveToolSystemPrompts(this._toolsForCurrentModel());
    return s && t.push({ role: "system", content: s }), t;
  }
  /**
   * Handle aparte-edit — update the user message in place, truncate all subsequent
   * messages, then re-stream a fresh assistant response.
   */
  async _handleEdit(t) {
    const { messageId: e, content: s, targetId: r } = t.detail ?? {};
    if (this._beginUserTurn(), !e || s === void 0) return;
    const i = this._resolveTarget(r, t);
    if (!i) {
      console.warn("[AparteClient] aparte-edit — no target found");
      return;
    }
    const a = i.getMessages?.().find((v) => v.id === e);
    i.updateMessage?.(e, {
      content: s,
      ...a?.tokens ? { tokens: Qf(s, a.tokens) } : {}
    });
    const o = i.getMessages?.() ?? [], l = o.findIndex((v) => v.id === e);
    if (i.truncateResponsesAfter)
      i.truncateResponsesAfter(e);
    else {
      const v = l >= 0 && l + 1 < o.length ? o[l + 1]?.id : void 0;
      v && i.truncateFrom?.(v);
    }
    const c = l >= 0 ? o.slice(0, l + 1) : o, d = this._messagesToChatMessages(c), h = this._systemMessages(), u = this._config.getModelConfig(), p = u.defaultProvider, f = this._providerFor(p);
    if (!f) return;
    const _ = p ? await this._resolveAuth(p) : void 0, g = pt();
    i.appendMessage?.({
      id: g,
      role: "assistant",
      content: "",
      status: "pending",
      timestamp: Date.now()
    }), await this._streamTurn(
      i,
      g,
      f,
      [...h, ...ke(d)],
      u.defaultModel || "",
      _,
      {
        ...this._turnMeta(l >= 0 ? o[l] : void 0),
        rebuild: async () => [
          ...this._systemMessages(),
          ...ke(this._messagesToChatMessages(this._current(i, c)))
        ]
      }
    );
  }
  /**
   * These messages as the transcript holds them NOW. A retry or an edit slices the path
   * before it streams; a compaction that runs during the turn writes its checkpoint onto
   * one of those messages in the transcript, and the slice still holds the objects as they
   * were. Looked up by id, tree-wide, because a retry has moved the path since.
   */
  _current(t, e) {
    const s = new Map((t.getMessages?.() ?? []).map((r) => [r.id, r]));
    return e.map((r) => t.getMessage?.(r.id) ?? s.get(r.id) ?? r);
  }
  /**
   * The chain the gesture really came up, nearest node first.
   *
   * Read from a `window` listener, `event.target` is the shadow HOST when the event
   * left a tree of the consumer's own, and `parentElement` stops at that tree's root —
   * so a walk from either starts, or ends, outside the chat the person typed into.
   * `composedPath()` is the one chain that crosses. The fallback is for an event
   * dispatched by hand, which has no path.
   */
  _originChain(t) {
    const e = t?.composedPath?.() ?? [];
    if (e.length > 0) return e;
    const s = [];
    let r = t ? Dt(t) : null;
    for (; r; )
      s.push(r), r = r.parentElement;
    return s;
  }
  /**
   * The trees a lookup must search, the one the gesture came from FIRST.
   *
   * `document.getElementById` and `document.querySelectorAll` cannot see into a shadow
   * root, so a chat mounted in one — the arrangement the theming guide endorses — is
   * invisible to both: alone, the send would be dropped with a warning; on a page that
   * also holds a chat in the light DOM, the scan would answer with the WRONG chat, and
   * the person's message AND the model's reply would land in a transcript they never
   * typed into. Nearest tree first keeps it from swapping the other way round.
   */
  _rootsFor(t) {
    const e = [];
    for (const s of this._originChain(t)) {
      if (typeof s.getRootNode != "function") continue;
      const r = xe(s);
      e.includes(r) || e.push(r);
    }
    return e.includes(document) || e.push(document), e;
  }
  /** The element an id names, looked up in the gesture's own tree before the document. */
  _byId(t, e) {
    for (const s of this._rootsFor(e)) {
      const r = s.getElementById?.(t);
      if (r) return r;
    }
    return null;
  }
  /** The first chat that can render, own tree first — the path when nothing names one. */
  _scanForTarget(t) {
    for (const e of this._rootsFor(t))
      for (const s of e.querySelectorAll(za)) {
        const r = this._asRenderTarget(s);
        if (r) return r;
      }
    return null;
  }
  /**
   * Resolve a target element by id (from event detail.targetId) or via targetResolver / DOM scan.
   */
  _resolveTarget(t, e) {
    if (t) {
      const r = this._byId(t, e);
      if (r) return this._asRenderTarget(r) ?? r;
    }
    if (this.options.targetResolver) {
      const r = this.options.targetResolver();
      if (r) return this._asRenderTarget(r) ?? r;
    }
    const s = this._scanForTarget(e);
    if (s) return s;
    for (const r of this._rootsFor(e)) {
      const i = r.querySelector(za);
      if (i) return i;
    }
    return null;
  }
  /**
   * Resolve an element to a usable render target: itself when it exposes
   * `appendMessage`, else the viewport it delegates to. The `<aparte-chat>`
   * shell matches the host selectors/id but owns no `appendMessage` (it forwards
   * rendering to its `.viewport`), so returning the bare shell would make
   * send / retry / edit silently no-op. Returns null when neither can render.
   */
  _asRenderTarget(t) {
    if (!t) return null;
    if (typeof t.appendMessage == "function") return t;
    const e = t.viewport;
    return e && typeof e.appendMessage == "function" ? e : null;
  }
  /**
   * Which chat a render target BELONGS to — the id the lifecycle events must carry.
   *
   * Not `target.id`: the target is whatever renders, and an `<aparte-chat>` shell
   * delegates that to its `.viewport`, which has no id. So every lifecycle event on
   * a shell-shaped chat went out unstamped, and the receive side reads a missing id
   * as "for every chat on the page" — deliberately, so a single-chat page needs no
   * wiring. On a two-chat page one chat's turn therefore drove every composer.
   *
   * The climb is the same rule `aparte-composer._ownTargetId` uses on the receive
   * side, and it has to be, or the two would disagree about which chat is which:
   * the nearest `aparte-chat` / `[data-aparte-chat]` ancestor (or the element
   * itself) that HAS an id. Deliberately not `chatBoundaryOf` — that returns the
   * boundary whether or not it is identified, and an id-less boundary must fall
   * through to the next one up rather than answer "no id".
   */
  _targetIdOf(t) {
    let e = t ?? null;
    for (; e; ) {
      if ((e.tagName?.toLowerCase() === "aparte-chat" || e.hasAttribute?.("data-aparte-chat")) && e.id) return e.id;
      e = e.parentElement;
    }
    return t?.id || void 0;
  }
  /**
   * Convert AparteMessage[] to AparteChatMessage[] for re-submission (retry, edit).
   *
   * The SLICE is each caller's own business — retry cuts before the reply it is
   * regenerating, edit cuts after the message being reworded, send cuts at the last
   * answered turn. What a message CONTRIBUTES to the wire is not: send, retry and
   * edit must not disagree about it. A failed turn and a turn stopped before its
   * first token are filtered out rather than sent as
   * `{ role: 'assistant', content: '' }` — a claim the assistant said nothing, which
   * some providers reject outright and the rest read as an empty reply worth
   * imitating.
   */
  _messagesToChatMessages(t) {
    const { summary: e, messages: s } = kr(t);
    return [...this._summaryMessage(e), ...qn(s)];
  }
  /**
   * What the model reads in place of everything before a checkpoint: the summary, as a
   * `user` message under the same preamble a legacy compaction message gets, so it is
   * context and not something the person said. It may sit right before a user turn;
   * `mergeAdjacentUserMessages` joins the two where the history is assembled.
   */
  _summaryMessage(t) {
    return t === void 0 ? [] : [{ role: "user", content: ti(t) }];
  }
  /** A message's tokens and metadata as a turn's `_meta`: a send and its retry say the same. */
  _turnMeta(t) {
    const e = { ...t?.metadata ?? t?.meta, ...t?.tokens?.length ? { tokens: t.tokens } : {} };
    return Object.keys(e).length > 0 ? { meta: e } : {};
  }
  /** The "no model selected" warning is said once per client, not once per dropped send. */
  _warnedNoModel = !1;
  async _handleSend(t) {
    const { content: e, modelId: s, providerId: r } = t.detail;
    if (this._config.getRequireModelSelection() && !this._config.hasSelectedModel() && !s) {
      console.warn(
        "[AparteClient] Send refused: requireModelSelection is on and no model is selected yet. The composer blocks this, but this send did not come from it — disable your own send affordances while `hasSelectedModel()` is false."
      );
      return;
    }
    let i = null;
    const a = t.detail?.targetId;
    if (a) {
      const _ = this._byId(a, t), g = this._asRenderTarget(_);
      g ? i = g : console.warn("[AparteClient] ⚠️ targetId present but element not found or missing appendMessage:", a);
    }
    if (!i && this.options.targetResolver && (i = this._asRenderTarget(
      this.options.targetResolver()
    )), !i)
      for (const _ of this._originChain(t)) {
        const g = _;
        if (typeof g?.appendMessage == "function") {
          i = g;
          break;
        }
      }
    if (i || (i = this._scanForTarget(t)), !i) {
      console.warn("[AparteClient] ⚠️ No target element found with appendMessage support. Provide a targetResolver in AparteClientOptions or ensure the composer has a `target` attribute.");
      return;
    }
    if (this._closeDeferred(i), this.options.echoUserMessage !== !1 && t.detail?.echoed !== !0) {
      const _ = Array.isArray(t.detail?.files) ? t.detail.files : [];
      i.appendMessage?.({
        id: pt(),
        role: "user",
        content: e,
        timestamp: Date.now(),
        ..._.length > 0 ? { attachments: cc(_) } : {},
        ...t.detail?.tokens?.length ? { tokens: t.detail.tokens } : {},
        ...t.detail?.meta ? { metadata: t.detail.meta } : {}
      }), t.detail && typeof t.detail == "object" && (t.detail.echoed = !0);
    }
    const o = pt(), l = this._config.getModelConfig(), c = r || l.defaultProvider;
    if (!c && !this._modelRunsElsewhere) {
      this._warnedNoModel || (this._warnedNoModel = !0, console.warn(
        "[AparteClient] Send dropped: no model is selected. Call aparteGlobalConfig.setModelConfig({ defaultProvider, defaultModel }), mount <aparte-model-selector auto-select persist>, or register one provider with a single model — that one is selected on its own."
      )), this._handleLifecycleError(i, o, new ut(
        "No provider selected. Please configure a provider.",
        tt.CONFIG_NO_PROVIDER
      ));
      return;
    }
    const d = this._providerFor(c);
    if (!d) {
      this._handleLifecycleError(i, o, new ut(
        `Provider '${c}' is not registered.`,
        tt.CONFIG_MISSING_KEY,
        { providerId: c }
      ));
      return;
    }
    i.appendMessage?.({
      id: o,
      role: "assistant",
      content: "",
      status: "pending",
      timestamp: Date.now()
    });
    let h, u, p;
    const f = Array.isArray(t.detail?.files) ? t.detail.files : [];
    try {
      h = c ? await this._resolveAuth(c) : void 0;
      const _ = this._selectFilesToInject(f), g = _.length > 0 ? await this._filesToContentParts(_) : [];
      p = g.length > 0 ? g : void 0, u = this._buildMessages(e, i, p);
    } catch (_) {
      this._handleLifecycleError(i, o, ut.from(_, tt.UNKNOWN_ERROR));
      return;
    }
    await this._streamTurn(
      i,
      o,
      d,
      u,
      s || l.defaultModel || "",
      h,
      {
        rebuild: async () => this._buildMessages(e, i, p),
        ...f.length > 0 ? { files: f } : {},
        ...this._turnMeta(t.detail)
      }
    );
  }
  /**
   * Build the initial messages array, prepending system prompts and conversation history.
   */
  _buildMessages(t, e, s) {
    const r = this._systemMessages(), i = this.options.history ?? "viewport", a = e?.getMessages?.() ?? [];
    i === "viewport" ? r.push(...this._toHistoryMessages(a)) : typeof i == "function" && r.push(...i(a));
    const o = s && s.length > 0 ? [{ type: "text", text: t }, ...s] : t;
    return r.push({ role: "user", content: o }), ke(r);
  }
  _toHistoryMessages(t) {
    const { summary: e, messages: s } = kr(t);
    let r = 0;
    for (let i = 0; i < s.length; i++) {
      const a = s[i];
      a.role === "assistant" && a.status !== "error" && !hc(a) && (r = i + 1);
    }
    return [...this._summaryMessage(e), ...qn(s.slice(0, r))];
  }
  /**
   * Which of the send's pending files get inlined into the request: the
   * `rawFileInject` mode first —
   *   'none'        → nothing inline (RAG handles all file types),
   *   'images-only' → images inline, text/docs to the app layer,
   *   'all' (default) → images + text files inline —
   * then the optional per-file `fileInjectFilter` veto.
   */
  _selectFilesToInject(t) {
    const e = this.options.rawFileInject === "none" ? [] : this.options.rawFileInject === "images-only" ? t.filter((r) => r.type.startsWith("image/")) : t, s = this.options.fileInjectFilter;
    return s ? e.filter((r) => s(r)) : e;
  }
  /**
   * Convert an array of File objects to AparteContentPart[].
   * - Images → AparteImagePart (base64 data URL)
   * - Text files (txt, md, json, csv, xml, html, css, js, ts, …) → AparteTextPart
   *   injected as a fenced block so all models (including local) can read them.
   * - Other binary files → no content part, and a one-time `console.warn` naming the
   *   file (see the branch below for why it is not silent).
   */
  async _filesToContentParts(t) {
    const e = /^(text\/|application\/(json|xml|javascript|typescript|x-yaml|yaml|toml|csv|markdown))/i, s = /\.(txt|md|markdown|json|jsonl|csv|tsv|xml|html|htm|css|js|mjs|cjs|ts|tsx|jsx|py|rb|java|c|cpp|h|go|rs|php|sh|bash|zsh|fish|yaml|yml|toml|ini|env|log|svg|graphql|gql)$/i;
    return (await Promise.all(
      t.map((i) => i.type.startsWith("image/") ? new Promise((a, o) => {
        const l = new FileReader();
        l.onload = () => a({ type: "image", image: l.result, mimeType: i.type }), l.onerror = () => o(new Error(`Failed to read file: ${i.name}`)), l.readAsDataURL(i);
      }) : e.test(i.type) || s.test(i.name) ? new Promise((a, o) => {
        const l = new FileReader();
        l.onload = () => {
          const c = l.result, d = i.name.split(".").pop() ?? "";
          a({
            type: "text",
            text: `\`\`\`${d}
// File: ${i.name}
${c}
\`\`\``
          });
        }, l.onerror = () => o(new Error(`Failed to read file: ${i.name}`)), l.readAsText(i);
      }) : (Wa.has(i.name) || (Wa.add(i.name), console.warn(
        `[aparte] ${i.name} (${i.type || "unknown type"}) is attached to the message but is not sent to the model: aparté inlines images and text files only. Handle it in your app (RAG, an upload) — the chip stays visible either way.`
      )), Promise.resolve(null)))
    )).filter((i) => i !== null);
  }
  /**
   * What the loop does after one tool call. THREE outcomes, because a boolean
   * conflated two questions that a refusal answers differently.
   *
   * - `'continue'` — run the next tool call of this turn.
   * - `'respond'`  — skip this turn's remaining calls, then take another turn so the
   *                  model reads what happened. A human refusal: the model asked for
   *                  several calls and refusing one cannot license the others, but a
   *                  refusal it never reads is one the user has to retype as a message.
   * - `'halt'`     — the run is over: an abort, a turn limit, a missing handler.
   */
  /**
   * The turn's agent loop — the engine's `runStreamAgent` rendered through the core
   * adapter, or the runner a host injected — after the fetch-level abort bookkeeping.
   */
  /** One run of the loop: its usage, and whether it paused (a server loop). */
  async _streamLoop(t, e, s, r, i, a = new AbortController(), o, l) {
    this._streamController !== a && this._streamController?.abort(), this._streamController = a;
    const c = this.options.streamRunner ?? Ii;
    return this._runViaStreamRunner(c, t, e, s, r, i, a, o, l);
  }
  /**
   * Run the loop through a {@link AparteStreamRunner} — the engine's by default —
   * rendering its DOM-free events through {@link createStreamAdapter}. Builds the
   * runner's dependencies from this client's config / provider / transport. The
   * leading writes (status streaming, prefix segments) happen here; the runner's
   * `run-start` re-asserts `streaming` idempotently. The call sequence this
   * produces is pinned by the `stream-parity` suite's snapshots, recorded while
   * the inline loop it replaced still ran beside it.
   */
  async _runViaStreamRunner(t, e, s, r, i, a, o, l, c) {
    const d = o.signal, h = this._targetIdOf(e), u = Os({
      target: e,
      config: this._config,
      messageId: s,
      ...h ? { targetId: h } : {}
    }), p = i._meta?.prefixSegments;
    let f, _, g;
    const v = (w) => {
      if (u(w), w.type === "agent-start" && w.name && this._agentNames.get(s)?.set(w.agentId, w.name), w.agentId == null) {
        if (w.type === "tool-failed" && (g = w.error), w.type === "run-done" && (_ = w.finishReason), w.type === "run-suspended") {
          const I = w.ticket;
          f = { pending: w.pending, ...typeof I == "string" ? { ticket: I } : {} };
        }
        if (w.type === "run-start" && p?.length && !l)
          for (const I of p) e.addSegment?.(I);
      }
    }, S = async (w) => {
      const I = await this._config.getTransport().chat(r, w, a, { providerId: r.id, signal: d });
      return typeof I == "string" ? I : Mp(I, d);
    }, A = (w) => {
      const I = this._config.getToolHandler(w);
      if (!I) return;
      const O = { target: e, config: this._config };
      return (N, G, B) => I(N, G, B ? { ...O, run: B } : O);
    }, C = !!this.options.approvalResolver, b = (w) => {
      const I = this._config.getTools().find((O) => O.name === w);
      if (I)
        return {
          maxTurns: I.maxTurns,
          needsApproval: C ? I.needsApproval : (O) => {
            const N = this._config.ruleOnToolCall(O).verdict;
            return N === "allow" ? !1 : N;
          }
        };
    }, y = this._approvalResolverFor(e), E = (w) => {
      if (g === void 0 || w instanceof ut) return w;
      const I = w instanceof Error ? w.message || w.name : typeof w == "string" ? w : String(w);
      return I === g ? new ut(I, tt.UNKNOWN_ERROR, void 0, w) : w;
    };
    return {
      usage: await t({
        messageId: s,
        ...r.id ? { providerId: r.id } : {},
        ...l ? { deferral: l } : {},
        ...c && c.length > 0 ? { files: c } : {},
        baseRequest: i,
        transportCall: S,
        toolLookup: A,
        toolConfigLookup: b,
        approvalResolver: y,
        emitter: v,
        signal: d,
        maxTurns: this.options.maxTurns,
        // Forwarded, because the option's own JSDoc promises it means one thing
        // whichever loop runs — and the fix that introduced it only wired the
        // inline path, so setting it was silently ignored here. Exactly the
        // asymmetry the option was added to remove.
        toolTimeoutMs: this.options.toolTimeoutMs,
        // The id conventions the loop always had: prefixed artifact ids, but a
        // BARE uuid for the synthetic tool (the adapter renders `tool-<id>`).
        idGen: (w) => w === "synthetic-tool" ? pt() : `${w}-${pt()}`
      }).catch((w) => {
        throw E(w);
      }) ?? void 0,
      ..._ ? { finishReason: _ } : {},
      ...f ? { suspended: f } : {}
    };
  }
  /**
   * The approval channel a run asks through — and the one a paused server run's calls
   * are answered through, so the page asks the same way whichever loop paused.
   *
   * `gatedElsewhere`: a server already decided this call needs a person. The page's
   * policy may still answer it when it has an opinion (`auto` mode allows, a plan
   * refuses), but with none the person is asked. `ruleOnToolCall`'s own fallback —
   * the tool's `needsApproval` — reads a tool the page does not have, and said
   * "allow": the page approved, silently, what the server wanted a person to decide.
   */
  _approvalResolverFor(t, e = !1) {
    return this.options.approvalResolver ?? (async (s, r) => {
      const i = e ? this._config.getApprovalPolicy()?.(s, this._config.getTools().find((a) => a.name === s.name)) ?? { verdict: "ask" } : this._config.ruleOnToolCall(s);
      return i.verdict === "allow" ? { approved: !0 } : i.verdict === "deny" ? { approved: !1, reason: i.reason?.trim() || "Tool execution was refused by the approval policy.", by: "policy" } : this._askForApproval(s, r, t);
    });
  }
  /**
   * The answers a paused server run waits for, asked HERE because only the page can: an
   * approval through the same channel a run in the page uses (the panel, the policy, a
   * host's own resolver), a browser tool through the handler `registerTool` gave it.
   * A `queued` call needs nothing — the server runs it on resume. `undefined` when
   * nobody answered — the turn was stopped, or the channel gave up — and there is no
   * resume. A channel that CRASHES fails the turn, as it does for a run in the page.
   */
  async _answerDeferred(t, e, s, r, i, a = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set()) {
    const l = {}, c = this._approvalResolverFor(t, !0), d = (h) => {
      for (const u of s.slice(h + 1))
        l[u.toolCallId] = { kind: "decision", approved: !1, reason: Xf, by: "earlier-refusal" };
    };
    for (const [h, u] of s.entries()) {
      if (r.aborted) break;
      const p = { id: u.toolCallId, name: u.name, input: u.input ?? {} }, f = u.agentId === void 0 ? void 0 : this._agentNames.get(e)?.get(u.agentId), _ = u.agentId === void 0 ? p : { ...p, agent: { id: u.agentId, ...f ? { name: f } : {} } };
      if (u.reason === "approval") {
        let g;
        try {
          g = await c(_, r);
        } catch (v) {
          if (!r.aborted && v?.name !== "AbortError") throw v;
        }
        if (!g || r.aborted) return;
        if (l[u.toolCallId] = { kind: "decision", ...g }, g.approved) o.add(Ua(p));
        else {
          d(h);
          break;
        }
      } else if (u.reason === "external") {
        let g = null;
        const v = Ua(p);
        if (!a.has(v) && !o.has(v))
          try {
            g = await this._gateBrowserTool(_, r, t, i);
          } catch (b) {
            if (!r.aborted && b?.name !== "AbortError") throw b;
            g = void 0;
          }
        if (g === void 0 || r.aborted) return;
        if (g && !g.approved) {
          l[u.toolCallId] = { kind: "decision", ...g }, d(h);
          break;
        }
        const S = g?.payload, A = S && typeof S == "object" && !Array.isArray(S) ? { ...p, input: { ...p.input, ...S } } : p, C = this._config.getToolHandler(u.name);
        try {
          if (!C) throw new Error(`No browser handler is registered for "${u.name}".`);
          const b = await C(A, r, { target: t, config: this._config });
          l[u.toolCallId] = {
            kind: "result",
            content: b.content,
            ...b.structuredContent !== void 0 ? { structuredContent: b.structuredContent } : {}
          };
        } catch (b) {
          if (r.aborted) break;
          l[u.toolCallId] = { kind: "failed", error: b instanceof Error ? b.message : String(b) };
        }
      }
    }
    return r.aborted ? void 0 : l;
  }
  /**
   * Whether a browser tool a paused run asked for may run, decided as a run in the page
   * decides it. With a host `approvalResolver`, the tool's own `needsApproval` says whether
   * to ask and the resolver answers; without one, the approval policy and `needsApproval`
   * rule (`ruleOnToolCall`) and the default channel asks. `null` when nothing gates the
   * call, the decision when something did, `undefined` when nobody answered.
   */
  async _gateBrowserTool(t, e, s, r) {
    const i = this.options.approvalResolver ? this._config.getTools().find((o) => o.name === t.name)?.needsApproval ? "ask" : "allow" : this._config.ruleOnToolCall(t).verdict;
    if (i === "allow") return null;
    i === "ask" && r?.({
      type: "tool-awaiting-approval",
      toolCallId: t.id,
      name: t.name,
      input: t.input,
      ...t.agent ? { agentId: t.agent.id } : {}
    });
    const a = await this._approvalResolverFor(s)(t, e) ?? void 0;
    return a?.approved && i === "ask" && (t.agent ? r?.({ type: "tool-approved", toolCallId: t.id, agentId: t.agent.id }) : s.updateSegment?.(`tool-${t.id}`, { status: "pending" })), a;
  }
  /**
   * The ticket is spent the moment the resume leaves: the server answers these calls
   * now, so a pause saved from here on — the conversation manager saves before it cuts a
   * switch — would be resumed a second time, against a server that has moved on. The
   * history that resumes them is built first; a new pause marks what still waits.
   */
  _spendPause(t, e) {
    const s = t.getMessage?.(e)?.segments ?? t.getMessages?.()?.find((i) => i.id === e)?.segments, r = (i) => i.type === "tool_call" && !!i.deferred;
    s?.some(r) && t.updateMessage?.(e, {
      segments: s.map((i) => {
        if (!r(i)) return i;
        const { deferred: a, ...o } = i;
        return o;
      })
    });
  }
  /**
   * Close the reply's calls that can no longer finish — paused, queued, or running on a
   * server the page stopped listening to: each says it stopped, and forgets the pause.
   * A cut connection carries none of their last events, so nothing else would: the rows
   * would spin, and a queued call would keep its ticket, which a reload would then
   * resume against a server that had moved on. By the reply's id, not the chat's head — a retry during
   * the wait moves the head. A run in the page ends every call itself: nothing to do.
   */
  _closeOpenCalls(t, e) {
    const s = t.getMessage?.(e)?.segments ?? t.getMessages?.()?.find((i) => i.id === e)?.segments, r = (i) => i.type === "tool_call" && (i.status === "pending" || i.status === "awaiting-approval");
    s?.some(r) && t.updateMessage?.(e, {
      segments: s.map((i) => {
        if (!r(i)) return i;
        const { deferred: a, ...o } = i;
        return { ...o, status: "aborted" };
      })
    });
  }
  /**
   * The history a resume sends: the request the turn was sent with — interceptor and
   * `history` option included, not rebuilt from the transcript — then the reply so
   * far, its paused calls left open for the server to answer.
   */
  _resumeMessages(t, e, s) {
    const r = t.getMessages?.().find((i) => i.id === e);
    return [...s, ...r ? uc(r, ds, { openDeferred: !0 }) : []];
  }
  /**
   * What the send of a reloaded turn put before its reply, rebuilt the way
   * `_buildMessages` builds it: the system prompts, the history `options.history`
   * asks for — given the transcript before the reply, where the send also saw the
   * reply's empty shell; handing over the paused reply would send it twice — and the
   * message that asked.
   * That message goes as its text: the files a send read are not in a transcript.
   */
  _resumeBase(t, e) {
    const s = t.slice(0, e), r = s.map((o) => o.role).lastIndexOf("user"), i = this.options.history ?? "viewport", a = i === "viewport" ? this._toHistoryMessages(s) : typeof i == "function" ? i(s) : [];
    return ke([
      ...this._systemMessages(),
      ...a,
      ...r >= 0 ? qn([s[r]]) : []
    ]);
  }
  /**
   * A new message closes a wait nobody answered. The paused calls of the last reply are
   * marked stopped, so the history the new turn sends answers them ("stopped before it
   * ran") — a provider rejects a request that declares a call with no answer.
   */
  _closeDeferred(t) {
    const s = [...t.getMessages?.() ?? []].reverse().find((i) => i.role === "assistant");
    if (!s?.segments?.some(qs)) return;
    const r = s.segments.map((i) => {
      if (!qs(i)) return i;
      const { deferred: a, ...o } = i;
      return { ...o, status: "aborted" };
    });
    t.updateMessage?.(s.id, { segments: r });
  }
  /**
   * Answer a turn a server loop paused, when the conversation comes back — a reload, a
   * conversation reopened days later. The last reply's paused calls (they carry the
   * server's ticket) are put to the person again, or run in the page, and the loop
   * resumes on the server, into the same bubble.
   *
   * Called on its own when a conversation manager loads a conversation
   * (`aparte-conversation-loaded`); call it yourself after `setMessages` if you load
   * conversations another way. Resolves `true` when a resume ran, `false` when there
   * was nothing to resume.
   *
   * @param target The chat — an element, or its id. Defaults to the one `targetResolver` names, else the first on the page.
   */
  async resumeDeferred(t) {
    const e = typeof t == "string" ? this._byId(t) : t ?? this.options.targetResolver?.() ?? null, s = e ? this._asRenderTarget(e) : this._scanForTarget();
    if (!s) return !1;
    const r = s.getMessages?.() ?? [], i = [...r].reverse().find((u) => u.role === "assistant"), a = (i?.segments ?? []).filter(qs), o = a.find((u) => u.deferred?.ticket)?.deferred?.ticket;
    if (!i || a.length === 0 || !o || this._resuming.has(i.id) || this._turnsInFlight.has(i.id)) return !1;
    const l = this._config.getModelConfig(), c = i.model && this._config.getAIProvider(i.model.providerId) ? i.model : void 0, d = c?.providerId ?? l.defaultProvider, h = this._providerFor(d);
    if (!h)
      return console.warn("[AparteClient] Cannot resume the paused turn: no provider is selected."), !1;
    this._beginUserTurn(), this._resuming.add(i.id);
    try {
      const u = h.id ? await this._resolveAuth(h.id) : void 0, p = a.map((_) => ({
        toolCallId: _.toolCall.id,
        name: _.toolCall.name,
        input: _.toolCall.input,
        reason: _.deferred.reason
      })), f = this._resumeBase(r, r.indexOf(i));
      await this._streamTurn(s, i.id, h, f, c?.modelId ?? l.defaultModel ?? "", u, {
        resume: { pending: p, ticket: o },
        rebuild: async () => {
          const _ = s.getMessages?.() ?? [], g = _.findIndex((v) => v.id === i.id);
          return g >= 0 ? this._resumeBase(_, g) : f;
        },
        ...c?.temperature !== void 0 ? { temperature: c.temperature } : {}
      });
    } finally {
      this._resuming.delete(i.id);
    }
    return !0;
  }
  /** Replies being resumed, so a second load of the same conversation does not ask twice. */
  _resuming = /* @__PURE__ */ new Set();
  /**
   * Updates an existing message or appends a new error if ID lookup fails
   */
  _updateMessage(t, e, s) {
    t.updateMessage && t.updateMessage(e, s);
  }
  /**
   * Gracefully handles errors by updating the current message instead of duplicating it
   */
  _handleLifecycleError(t, e, s) {
    const r = {
      id: `error-${pt()}`,
      type: "error",
      content: s.message,
      code: s.code
    };
    if (pr(s.code, (i) => this._config.t(i)) !== void 0 && console.warn(`[aparte] A turn failed (${s.code}): ${s.message}`), t.updateMessage) {
      const i = t.getMessage?.(e)?.segments ?? t.getMessages?.()?.find((a) => a.id === e)?.segments ?? [];
      t.updateMessage(e, {
        status: "error",
        segments: [...i, r]
      });
    } else t.appendMessage && t.appendMessage({
      id: e,
      role: "assistant",
      status: "error",
      timestamp: Date.now(),
      segments: [r]
    });
    kt(t, "aparte-message-error", { messageId: e, error: s }, this._targetIdOf(t));
  }
}
function mc(n) {
  return n.next ? mc(n.next) : "current" in n ? n : null;
}
class Jf {
  _nodes = /* @__PURE__ */ new Map();
  _head = null;
  _root = { next: null, children: [] };
  // ─── Public read API ────────────────────────────────────────────────────
  /** ID of the currently active leaf message */
  get headId() {
    return this._head?.current.id ?? null;
  }
  /**
   * Returns the messages on the currently active path, root → head.
   * O(depth).
   */
  getMessages() {
    const t = this._head?.level ?? -1;
    if (t < 0) return [];
    const e = new Array(t + 1);
    for (let s = this._head; s; s = s.prev)
      e[s.level] = s.current;
    return e;
  }
  /**
   * Returns metadata about a specific message, or `undefined` if not found.
   *
   * Read methods (`getMessage`, `getMessageById`, `getBranches`) all return
   * `undefined` / `[]` for unknown ids — never throw — so callers can do a
   * single existence check at the top of a flow rather than wrapping every
   * call in try/catch.
   */
  getMessage(t) {
    const e = this._nodes.get(t);
    if (e)
      return {
        parentId: e.prev?.current.id ?? null,
        message: e.current,
        index: e.level
      };
  }
  /**
   * Returns the mutable message reference, or `undefined` if not found.
   * Mutations to the returned object are reflected in `getMessages()`.
   */
  getMessageById(t) {
    return this._nodes.get(t)?.current;
  }
  /**
   * Every message the tree holds — every branch, not just the active path.
   *
   * Unlike `getMessages()`, which walks head → root, this also sees a turn that a
   * retry has taken off the active path, so it answers questions about the whole
   * conversation ("is anything still streaming?"). No order is promised beyond
   * insertion: a caller that needs the topology reads `export()`.
   */
  getAllMessages() {
    const t = [];
    for (const e of this._nodes.values()) t.push(e.current);
    return t;
  }
  /**
   * Returns the IDs of all siblings of `messageId`
   * (i.e. all children of its parent, including itself).
   * Use this to build branch-picker UI.
   */
  getBranches(t) {
    const e = this._nodes.get(t);
    return e ? [...(e.prev ?? this._root).children] : [];
  }
  // ─── Public write API ───────────────────────────────────────────────────
  /**
   * Add a new message as a child of `parentId` (null = root).
   * If a message with the same id already exists, updates its data
   * and re-links it under the correct parent.
   */
  addOrUpdateMessage(t, e) {
    const s = this._nodes.get(e.id), r = t ? this._nodes.get(t) : void 0;
    if (t !== null && r === void 0)
      throw new Error(`AparteMessageRepository: parent "${t}" not found.`);
    const i = r ?? null;
    if (s) {
      s.current = e, this._relink(i, s);
      return;
    }
    const a = {
      prev: i,
      next: null,
      children: [],
      current: e,
      level: i ? i.level + 1 : 0
    };
    this._nodes.set(e.id, a), this._link(i, a), (this._head === i || this._head === null && i === null) && (this._head = a);
  }
  /**
   * Switch the active branch to `messageId`.
   * Updates `next` on the parent chain so getMessages() reflects the change.
   * Advances `head` to the deepest active node in the new branch.
   *
   * Silent no-op for unknown ids — mutation methods (`switchToBranch`,
   * `resetHead`, `updateMessage`, `clearChildren`) never throw.
   */
  switchToBranch(t) {
    const e = this._nodes.get(t);
    if (!e) return;
    const s = e.prev ?? this._root;
    s.next = e, this._head = mc(e);
  }
  /**
   * Remove all descendants of `messageId` (inclusive) and, when the head was among
   * them, set `head` to the parent of `messageId`. Used by edit/truncate flows.
   *
   * A head in a branch this call did not touch stays where it is.
   *
   * @param messageId  The first message to remove
   */
  resetHead(t) {
    const e = this._nodes.get(t);
    if (!e) return;
    const s = this._head;
    this._deleteDescendants(e);
    const r = e.prev ?? this._root;
    r.children = r.children.filter((a) => a !== t), r.next === e && (r.next = null), this._nodes.delete(t), s !== null && s !== e && this._nodes.get(s.current.id) === s || (this._head = e.prev);
  }
  /**
   * Update a message's data without changing its position in the tree.
   */
  updateMessage(t, e) {
    const s = this._nodes.get(t);
    s && (s.current = { ...s.current, ...e });
  }
  /**
   * Remove ALL children of `parentId` (and their descendants) and set head
   * to `parentId`. Used by edit to discard every previous response before
   * re-generating — ensures the new response starts with sibling count = 1.
   */
  clearChildren(t) {
    const e = this._nodes.get(t);
    if (e) {
      for (const s of [...e.children]) {
        const r = this._nodes.get(s);
        r && (this._deleteDescendants(r), this._nodes.delete(s));
      }
      e.children = [], e.next = null, this._head = e;
    }
  }
  /** Remove all messages and reset to empty state. */
  clear() {
    this._nodes.clear(), this._head = null, this._root = { next: null, children: [] };
  }
  /**
   * Import a previously-exported snapshot, rebuilding the full tree and
   * restoring the active head. Replaces any existing content (calls `clear()`
   * first). `export()` writes messages in topological order (parent before
   * child), which is the order this expects.
   */
  import(t) {
    this.clear();
    for (const { message: e, parentId: s } of t.messages) {
      if (s !== null && !this._nodes.has(s)) {
        console.warn(
          `[AparteMessageRepository] import: message "${e.id}" names a parent "${s}" the snapshot does not hold before it — skipped.`
        );
        continue;
      }
      if (this._nodes.has(e.id)) {
        console.warn(
          `[AparteMessageRepository] import: message "${e.id}" repeats an id already in the snapshot — skipped.`
        );
        continue;
      }
      this.addOrUpdateMessage(s, e);
    }
    t.headId && this.switchToBranch(t.headId);
  }
  /**
   * Export the full tree for serialisation or debugging.
   * Compatible with the assistant-ui ExportedMessageRepository format.
   *
   * Walked from the root through each node's `children`, so a parent is always
   * written before its children, even after `addOrUpdateMessage` re-parented an
   * existing node under a newer one; `import()` relies on that order.
   */
  export() {
    const t = [], e = (s, r) => {
      for (const i of s) {
        const a = this._nodes.get(i);
        a && (t.push({ message: a.current, parentId: r }), e(a.children, i));
      }
    };
    return e(this._root.children, null), { headId: this.headId, messages: t };
  }
  // ─── Private helpers ────────────────────────────────────────────────────
  _link(t, e) {
    const s = t ?? this._root;
    s.children = [...s.children, e.current.id], s.next === null && (s.next = e), e.prev = t;
  }
  _relink(t, e) {
    const s = e.prev ?? this._root;
    if (s !== (t ?? this._root) && (s.children = s.children.filter((i) => i !== e.current.id), s.next === e)) {
      const i = s.children[0];
      s.next = i ? this._nodes.get(i) ?? null : null;
    }
    e.prev = t;
    const r = t ?? this._root;
    r.children.includes(e.current.id) || (r.children = [...r.children, e.current.id]), r.next === null && (r.next = e), this._updateLevels(e, t ? t.level + 1 : 0);
  }
  _updateLevels(t, e) {
    t.level = e;
    for (const s of t.children) {
      const r = this._nodes.get(s);
      r && this._updateLevels(r, e + 1);
    }
  }
  _deleteDescendants(t) {
    for (const e of t.children) {
      const s = this._nodes.get(e);
      s && (this._deleteDescendants(s), this._nodes.delete(e));
    }
    t.children = [], t.next = null;
  }
}
function Be(n) {
  return n.status === "streaming" || n.status === "pending" ? !0 : n.status === void 0 && n.role === "assistant" && !n.content?.trim() && !n.segments?.length;
}
function tg(n, t, e) {
  let s = "other";
  try {
    s = new Intl.PluralRules(e).select(t);
  } catch {
  }
  const r = n.split("|"), i = (o) => r.find((l) => l.startsWith(`${o}:`)), a = i(s) ?? i("other") ?? n;
  return a.slice(a.indexOf(":") + 1).replace("{n}", String(t));
}
const eg = ".aparte-message-content, .aparte-segments, .aparte-content, .aparte-checkpoint__summary";
function Pt(n) {
  return !!n?.closest?.(eg);
}
const Ga = Symbol.for("aparte.dialogTriggers");
let xr = null, Qn = null;
function ng(n) {
  xr = n.target, Qn = null;
}
function sg(n) {
  Qn = n.target;
}
function rg(n) {
  const t = n.target;
  if (!t?.closest) return;
  const e = t.closest("[data-aparte-dialog-open]");
  if (e && !Pt(e)) {
    const r = e.getAttribute("data-aparte-dialog-open"), i = r ? document.getElementById(r) : null;
    i instanceof HTMLDialogElement && !i.open && (n.preventDefault(), i.showModal());
    return;
  }
  const s = t.closest("[data-aparte-dialog-close]");
  if (s && !Pt(s)) {
    const r = s.closest("dialog");
    r instanceof HTMLDialogElement && r.open && (n.preventDefault(), r.close(s.getAttribute("data-aparte-dialog-close") ?? ""));
    return;
  }
  if (t instanceof HTMLDialogElement && t.open && t.classList.contains("aparte-dialog") && !t.hasAttribute("data-aparte-dialog-static")) {
    const r = xr === t && Qn === t;
    xr = null, Qn = null, r && t.close();
  }
}
function ig(n = document) {
  const t = n;
  t[Ga] || (t[Ga] = !0, n.addEventListener("pointerdown", ng, !0), n.addEventListener("pointerup", sg, !0), n.addEventListener("click", rg));
}
const Fs = "defer-hydration", dn = /* @__PURE__ */ new WeakMap(), un = /* @__PURE__ */ new WeakMap(), qe = /* @__PURE__ */ new WeakSet(), Zn = /* @__PURE__ */ new WeakSet(), Tr = /* @__PURE__ */ new WeakMap(), ja = /* @__PURE__ */ new WeakSet();
function Ka(n) {
  if (Zn.has(n)) return !1;
  if (un.has(n)) return !0;
  const t = n.closest(`[${Fs}]`);
  if (!t) return !1;
  un.set(n, t);
  let e = dn.get(t);
  if (!e) {
    e = [], dn.set(t, e);
    const s = new MutationObserver(() => {
      t.hasAttribute(Fs) || ag(t);
    });
    s.observe(t, { attributes: !0, attributeFilter: [Fs] }), Tr.set(t, s);
  }
  return e.push(n), !0;
}
function ag(n) {
  Tr.get(n)?.disconnect(), Tr.delete(n);
  const t = dn.get(n) ?? [];
  dn.delete(n);
  for (const e of t)
    un.delete(e), e.isConnected && !Zn.has(e) && e.connectedCallback?.();
}
function rt(n) {
  if (ja.has(n)) return;
  ja.add(n);
  const t = n.prototype, e = t.connectedCallback, s = t.attributeChangedCallback, r = t.disconnectedCallback, i = n.observedAttributes ?? [];
  t.connectedCallback = function() {
    if (Ka(this)) {
      qe.add(this);
      return;
    }
    if (qe.has(this)) {
      qe.delete(this);
      for (const a of i) {
        const o = this.getAttribute(a);
        o !== null && s?.call(this, a, null, o);
      }
    }
    Zn.add(this), e?.call(this);
  }, s && (t.attributeChangedCallback = function(a, o, l) {
    if (Ka(this)) {
      qe.add(this);
      return;
    }
    s.call(this, a, o, l);
  }), t.disconnectedCallback = function() {
    const a = un.get(this);
    if (a) {
      un.delete(this);
      const o = dn.get(a);
      o && o.splice(o.indexOf(this), 1);
      return;
    }
    qe.has(this) || (Zn.delete(this), r?.call(this));
  };
}
function mt(n) {
  return n === "" ? !0 : !!n;
}
class bc extends HTMLElement {
  static get observedAttributes() {
    return ["value", "disabled", "selected", "data-status"];
  }
  connectedCallback() {
    this.setAttribute("role", "option"), this._updateAriaSelected(), this._updateStatusDot();
  }
  attributeChangedCallback(t) {
    t === "selected" && this._updateAriaSelected(), t === "disabled" && this.setAttribute("aria-disabled", this.hasAttribute("disabled") ? "true" : "false"), t === "data-status" && this._updateStatusDot();
  }
  get value() {
    return this.getAttribute("value") || this.textContent?.trim() || "";
  }
  set value(t) {
    this.setAttribute("value", t);
  }
  get label() {
    return Array.from(this.childNodes).find((e) => e.nodeType === Node.TEXT_NODE)?.textContent?.trim() || this.value;
  }
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(t) {
    this.toggleAttribute("disabled", mt(t));
  }
  get selected() {
    return this.hasAttribute("selected");
  }
  set selected(t) {
    this.toggleAttribute("selected", mt(t));
  }
  _updateAriaSelected() {
    this.setAttribute("aria-selected", this.selected ? "true" : "false");
  }
  _updateStatusDot() {
    const t = this.getAttribute("data-status");
    let e = this.querySelector(".aparte-status-dot");
    if (!t) {
      e?.remove();
      return;
    }
    e || (e = document.createElement("span"), e.className = "aparte-status-dot", e.setAttribute("aria-hidden", "true"), this.appendChild(e)), e.setAttribute("data-status", t);
  }
}
rt(bc);
customElements.get("aparte-option") || customElements.define("aparte-option", bc);
class us extends HTMLElement {
  /** Ids for the label span the group points `aria-labelledby` at. */
  static _labelIdSeq = 0;
  static get observedAttributes() {
    return ["label", "collapsible", "collapsed", "loading"];
  }
  connectedCallback() {
    this.setAttribute("role", "group"), this._render();
  }
  attributeChangedCallback(t, e, s) {
    e !== s && (t === "collapsed" && this._updateCollapsedState(), this.isConnected && this._render());
  }
  get label() {
    return this.getAttribute("label") || "";
  }
  set label(t) {
    this.setAttribute("label", t);
  }
  get collapsible() {
    return this.hasAttribute("collapsible");
  }
  set collapsible(t) {
    this.toggleAttribute("collapsible", mt(t));
  }
  get collapsed() {
    return this.hasAttribute("collapsed");
  }
  set collapsed(t) {
    this.toggleAttribute("collapsed", mt(t));
  }
  get loading() {
    return this.hasAttribute("loading");
  }
  set loading(t) {
    this.toggleAttribute("loading", mt(t));
  }
  _render() {
    if (this.label && !this.querySelector(".aparte-optgroup-header")) {
      const e = document.createElement("div");
      e.className = "aparte-optgroup-header";
      const s = document.createElement("span");
      if (s.className = "aparte-optgroup-label", s.id = `aparte-optgroup-label-${++us._labelIdSeq}`, s.textContent = this.label, this.setAttribute("aria-labelledby", s.id), e.appendChild(s), this.collapsible) {
        const r = document.createElement("span");
        r.className = "aparte-optgroup-chevron", r.innerHTML = $(this).getIcon("expand"), e.appendChild(r), e.style.cursor = "pointer", e.addEventListener("click", (i) => {
          i.stopPropagation(), this._toggleCollapse();
        });
      }
      this.insertBefore(e, this.firstChild);
    }
    this._updateLoadingState(), this._updateCollapsedState();
  }
  _updateLoadingState() {
    let t = this.querySelector(".aparte-optgroup-loader");
    if (this.loading) {
      if (!t) {
        t = document.createElement("div"), t.className = "aparte-optgroup-loader";
        const e = document.createElement("span");
        e.className = "aparte-spinner-small", t.replaceChildren(e, ` ${$(this).t("loading") || "Loading…"}`), this.appendChild(t);
      }
    } else t && t.remove();
  }
  _toggleCollapse() {
    this.collapsed = !this.collapsed, this.dispatchEvent(new CustomEvent("aparte-optgroup-toggle", {
      bubbles: !0,
      composed: !0,
      detail: {
        label: this.label,
        collapsed: this.collapsed
      }
    })), this._updateCollapsedState();
  }
  _updateCollapsedState() {
    this.querySelectorAll("aparte-option").forEach((e) => {
      e.style.display = this.collapsed ? "none" : "";
    });
  }
}
rt(us);
customElements.get("aparte-optgroup") || customElements.define("aparte-optgroup", us);
class hn extends HTMLElement {
  static _optIdSeq = 0;
  /** Fallback ids for the listbox `aria-controls` target when the host has no id. */
  static _listboxSeq = 0;
  _value = "";
  _isOpen = !1;
  _activeIndex = -1;
  _trigger = null;
  _dropdown = null;
  _searchInput = null;
  _observer = null;
  // Bound handlers for cleanup
  /**
   * Bound, like its two neighbours below — because an inline arrow on `this` can
   * never be removed.
   *
   * `_setupEventListeners()` runs on EVERY `connectedCallback`, and `_render()`'s
   * idempotency guard means the host element survives a re-connect. So each move
   * of the element (a portal, a Vue teleport, any framework re-parent) would add
   * another option-click listener and one click would fire the change handler once
   * per re-connect, unless the same bound reference is removed and re-added.
   */
  _boundHandleOptionClick = this._handleOptionClick.bind(this);
  _boundHandleDocumentClick = this._handleDocumentClick.bind(this);
  _boundHandleKeydown = this._handleKeydown.bind(this);
  /**
   * The trigger's own three, bound for the same reason as the option click: the
   * trigger element survives a re-connect, so listeners that cannot be removed would
   * stack. One re-parent would make a click toggle twice — open and shut inside the
   * same click, i.e. a control that looks dead — and announce `aparte-select-open`
   * twice.
   */
  _boundHandleTriggerClick = () => {
    this._toggle();
  };
  _boundHandleTriggerKeydown = (t) => {
    if (t.key === "Enter" || t.key === " ") {
      if (this._isOpen) return;
      t.preventDefault(), this._toggle();
    }
    t.key === "ArrowDown" && !this._isOpen && (t.preventDefault(), this._openDropdown());
  };
  _boundHandleSearchInput = (t) => {
    this._filterOptions(t.target.value.toLowerCase());
  };
  static get observedAttributes() {
    return ["value", "placeholder", "disabled", "searchable", "open"];
  }
  connectedCallback() {
    this._value = this.getAttribute("value") || "";
    const t = this.hasAttribute("open") && !this._isOpen;
    this._render(), this._applySearchable(), this._applyDisabled(), this._setupEventListeners(), this._setupMutationObserver(), t && this._openDropdown();
  }
  disconnectedCallback() {
    this.removeEventListener("click", this._boundHandleOptionClick), document.removeEventListener("click", this._boundHandleDocumentClick), document.removeEventListener("keydown", this._boundHandleKeydown), this._observer?.disconnect();
  }
  attributeChangedCallback(t, e, s) {
    if (this.isConnected) {
      if (t === "value" && e !== s && s !== this._value && (this._value = s || "", this._updateTriggerLabel()), t === "open") {
        const r = this.hasAttribute("open");
        r !== this._isOpen && (r ? this._openDropdown() : this._closeDropdown());
      }
      t === "placeholder" && this._updateTriggerLabel(), t === "searchable" && this._applySearchable(), t === "disabled" && (this._applyDisabled(), !this.hasAttribute("disabled") && this.hasAttribute("open") && this._openDropdown());
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────
  get value() {
    return this._value;
  }
  set value(t) {
    if (t === this._value) return;
    const e = this._value;
    this._value = t, this.setAttribute("value", t), this._updateTriggerLabel(), this._emitChange(e);
  }
  get open() {
    return this._isOpen;
  }
  set open(t) {
    this.toggleAttribute("open", mt(t));
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────
  /** The filter field: the combobox of a `searchable` select, since it takes the focus. */
  _buildSearchInput(t) {
    const e = document.createElement("input");
    return e.type = "text", e.className = "aparte-select-search", e.placeholder = t.t("selectSearchPlaceholder") || "Search…", e.setAttribute("aria-label", t.t("selectSearchLabel") || "Search options"), e.setAttribute("role", "combobox"), e.setAttribute("aria-haspopup", "listbox"), e.setAttribute("aria-autocomplete", "list"), e.setAttribute("aria-expanded", String(this._isOpen)), e;
  }
  /**
   * `searchable` set or removed after the first render: the field comes or goes, and the
   * combobox moves with it, so a framework that
   * binds it a beat late — Angular's `[searchable]` inside an `@if` — still gets a field.
   */
  _applySearchable() {
    if (!this._dropdown || !this._trigger) return;
    const t = this.hasAttribute("searchable");
    if (t === !!this._searchInput) return;
    this._isOpen && this._closeDropdown();
    const e = this._trigger.getAttribute("aria-controls");
    if (t) {
      const s = this._buildSearchInput($(this));
      e && s.setAttribute("aria-controls", e), this._dropdown.prepend(s), this._searchInput = s, s.addEventListener("input", this._boundHandleSearchInput), this._trigger.setAttribute("role", "button");
    } else
      this._searchInput.removeEventListener("input", this._boundHandleSearchInput), this._searchInput.remove(), this._searchInput = null, this._trigger.setAttribute("role", "combobox");
    this._updateNames();
  }
  _render() {
    const t = this.getAttribute("placeholder") || "Select...", e = this.hasAttribute("searchable");
    if (this.querySelector(".aparte-select-dropdown")) {
      this._updateTriggerLabel();
      return;
    }
    const s = Array.from(this.children), r = $(this), i = document.createElement("div");
    i.className = "aparte-select-trigger", i.setAttribute("tabindex", "0"), i.setAttribute("role", e ? "button" : "combobox"), i.setAttribute("aria-haspopup", "listbox"), i.setAttribute("aria-expanded", "false"), i.setAttribute("aria-label", this.getAttribute("aria-label") || t);
    const a = document.createElement("span");
    a.className = "aparte-select-label";
    const o = document.createElement("span");
    o.className = "aparte-select-label-text", o.textContent = t;
    const l = document.createElement("span");
    l.className = "aparte-select-label-sizer", l.setAttribute("aria-hidden", "true"), a.append(o, l);
    const c = document.createElement("span");
    c.className = "aparte-select-chevron", c.innerHTML = r.getIcon("expand"), i.append(a, c);
    const d = document.createElement("div");
    d.className = "aparte-select-dropdown", d.hidden = !this._isOpen;
    const h = e ? this._buildSearchInput(r) : null;
    h && d.appendChild(h);
    const u = document.createElement("div");
    u.className = "aparte-select-options", u.setAttribute("role", "listbox"), u.setAttribute("aria-label", i.getAttribute("aria-label") ?? t), u.id = this.id ? `${this.id}-listbox` : `aparte-listbox-${++hn._listboxSeq}`, i.setAttribute("aria-controls", u.id), h?.setAttribute("aria-controls", u.id), s.forEach((p) => {
      (p.tagName === "APARTE-OPTION" || p.tagName === "APARTE-OPTGROUP") && u.appendChild(p);
    }), d.appendChild(u), this._observer?.disconnect(), this.innerHTML = "", this.appendChild(i), this.appendChild(d), this._trigger = i, this._dropdown = d, this._searchInput = d.querySelector(".aparte-select-search"), this.isConnected && this._setupMutationObserver(), this._updateTriggerLabel();
  }
  _setupMutationObserver() {
    this._observer?.disconnect(), this._observer = new MutationObserver(() => {
      this._updateDropdownContent(), this._updateTriggerLabel(), this._restoreActive();
    }), this._observer.observe(this, { childList: !0, subtree: !0 });
  }
  /**
   * Put the roving highlight back after the options changed underneath it.
   *
   * `data-active` lives on an option ELEMENT, so replacing the list throws it
   * away while `_activeIndex` still claims a position: without this the highlight
   * disappears, `aria-activedescendant` points at an id no longer in the document, and
   * the next ArrowDown moves from the stale index — skipping an option. Only when
   * open and only when a position was held, so a refresh never invents one.
   */
  _restoreActive() {
    !this._isOpen || this._activeIndex < 0 || this.querySelector("aparte-option[data-active]") || this._setActive(this._activeIndex);
  }
  _updateDropdownContent() {
    if (!this._trigger || !this.contains(this._trigger)) {
      this._render();
      return;
    }
    const t = this.querySelector(".aparte-select-options");
    if (!t) {
      this._render();
      return;
    }
    const e = Array.from(this.children).filter(
      (s) => s.className !== "aparte-select-trigger" && s.className !== "aparte-select-dropdown"
    );
    e.length !== 0 && (this._observer?.disconnect(), t.innerHTML = "", e.forEach((s) => {
      t.appendChild(s);
    }), this.isConnected && this._observer?.observe(this, { childList: !0, subtree: !0 }), this._updateTriggerLabel(), this._restoreActive());
  }
  _setupEventListeners() {
    this._trigger?.removeEventListener("click", this._boundHandleTriggerClick), this._trigger?.addEventListener("click", this._boundHandleTriggerClick), this._trigger?.removeEventListener("keydown", this._boundHandleTriggerKeydown), this._trigger?.addEventListener("keydown", this._boundHandleTriggerKeydown), this.removeEventListener("click", this._boundHandleOptionClick), this.addEventListener("click", this._boundHandleOptionClick), this._searchInput?.removeEventListener("input", this._boundHandleSearchInput), this._searchInput?.addEventListener("input", this._boundHandleSearchInput), document.addEventListener("click", this._boundHandleDocumentClick), document.addEventListener("keydown", this._boundHandleKeydown);
  }
  _handleOptionClick(t) {
    const e = t.target.closest("aparte-option");
    e && !e.hasAttribute("disabled") && this._selectOption(e);
  }
  _handleDocumentClick(t) {
    const e = Dt(t);
    (!e || !this.contains(e)) && this._closeDropdown();
  }
  _handleKeydown(t) {
    if (!this._isOpen) return;
    const e = Et(this) === this._searchInput;
    switch (t.key) {
      case "Escape":
        t.preventDefault(), this._closeDropdown(), this._trigger?.focus();
        break;
      case "ArrowDown":
        t.preventDefault(), this._moveActive(1);
        break;
      case "ArrowUp":
        t.preventDefault(), this._moveActive(-1);
        break;
      case "Home":
        if (e) break;
        t.preventDefault(), this._setActive(0);
        break;
      case "End":
        if (e) break;
        t.preventDefault(), this._setActive(this._visibleOptions().length - 1);
        break;
      case "Enter": {
        const s = this._visibleOptions()[this._activeIndex];
        s && (t.preventDefault(), this._selectOption(s));
        break;
      }
    }
  }
  /** Non-disabled, non-filtered options in DOM order. */
  _visibleOptions() {
    return Array.from(this.querySelectorAll("aparte-option")).filter(
      (t) => !t.hasAttribute("disabled") && t.style.display !== "none"
    );
  }
  /** Move the active (keyboard-highlighted) option by `delta`, clamped. */
  _moveActive(t) {
    if (this._visibleOptions().length === 0) return;
    const s = this._activeIndex < 0 ? t > 0 ? -1 : 0 : this._activeIndex;
    this._setActive(s + t);
  }
  /**
   * The element that holds DOM focus while the list is being driven, and therefore
   * the one that must carry the combobox state a reader follows: the filter field
   * when the select is `searchable` (it is focused on open), the trigger otherwise.
   */
  _activeHost() {
    return this._searchInput ?? this._trigger;
  }
  /** `aria-expanded` belongs to the combobox — write it wherever the combobox is. */
  _setExpanded(t) {
    const e = String(t);
    this._trigger?.setAttribute("aria-expanded", e), this._searchInput?.setAttribute("aria-expanded", e);
  }
  /** Highlight the option at `index` (clamped) and point aria-activedescendant at it. */
  _setActive(t) {
    this.querySelectorAll("aparte-option").forEach((a) => a.removeAttribute("data-active"));
    const s = this._visibleOptions();
    if (s.length === 0) {
      this._activeIndex = -1, this._activeHost()?.removeAttribute("aria-activedescendant");
      return;
    }
    const r = Math.max(0, Math.min(t, s.length - 1));
    this._activeIndex = r;
    const i = s[r];
    i.id || (i.id = `aparte-option-${++hn._optIdSeq}`), i.setAttribute("data-active", ""), this._activeHost()?.setAttribute("aria-activedescendant", i.id), i.scrollIntoView?.({ block: "nearest" });
  }
  /** Clear the keyboard highlight (on close). */
  _clearActive() {
    this._activeIndex = -1, this._activeHost()?.removeAttribute("aria-activedescendant"), this.querySelectorAll("aparte-option").forEach((t) => t.removeAttribute("data-active"));
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────
  _toggle() {
    this._isOpen ? this._closeDropdown() : this._openDropdown();
  }
  _openDropdown() {
    if (this._isOpen || this.hasAttribute("disabled")) return;
    this._isOpen = !0, this._dropdown?.removeAttribute("hidden"), this._setExpanded(!0), this.setAttribute("open", ""), this._updatePosition(), this._searchInput?.focus();
    const e = this._visibleOptions().findIndex((s) => s.getAttribute("value") === this._value);
    this._setActive(e >= 0 ? e : 0), this.dispatchEvent(new CustomEvent("aparte-select-open", { bubbles: !0 }));
  }
  _closeDropdown() {
    this._isOpen = !1, this._clearActive(), this._dropdown?.setAttribute("hidden", ""), this._setExpanded(!1), this.removeAttribute("open"), this.removeAttribute("position"), this._dropdown && (this._dropdown.style.top = "", this._dropdown.style.bottom = "", this._dropdown.style.left = "", this._dropdown.style.width = ""), this._searchInput && (this._searchInput.value = "", this._filterOptions("")), this.dispatchEvent(new CustomEvent("aparte-select-close", { bubbles: !0 }));
  }
  _updatePosition() {
    if (!this._dropdown || !this._trigger) return;
    const t = this._trigger.getBoundingClientRect(), e = this._dropdown.offsetHeight || 300, s = window.innerHeight, r = s - t.bottom, i = 4;
    this._dropdown.style.left = `${t.left}px`, this._dropdown.style.width = `${t.width}px`, r < e && t.top > e ? (this._dropdown.style.top = "", this._dropdown.style.bottom = `${s - t.top + i}px`, this.setAttribute("position", "top")) : (this._dropdown.style.top = `${t.bottom + i}px`, this._dropdown.style.bottom = "", this.removeAttribute("position"));
  }
  _selectOption(t) {
    const e = t.getAttribute("value") || t.textContent?.trim() || "", s = this._value;
    this._value = e, this.setAttribute("value", e), this._updateTriggerLabel(), this._closeDropdown(), this._emitChange(s), this._trigger?.focus();
  }
  /**
   * The combobox and its listbox are named by the host's `aria-label`, else by the
   * placeholder — the same rule the first render applies, re-applied whenever the
   * placeholder or the selection changes. Written only when different: the mutation
   * observer watches this subtree.
   *
   * A `combobox` is NAMED by that attribute and VALUED by its visible label span, so
   * the name is the control and nothing else. A `button` — the shape a `searchable`
   * trigger takes, since the filter field is then the combobox — is named by its
   * CONTENT, which this very attribute overrides: a name of just the placeholder
   * ("Pick a model, button") would never say which model is selected. So the button's
   * name carries both halves, and drops the second when it would only repeat the
   * first (nothing selected: the value IS the placeholder).
   */
  _updateNames() {
    const t = this.getAttribute("placeholder") || "Select...", e = this.getAttribute("aria-label") || t, s = this.querySelector(".aparte-select-options");
    s && s.getAttribute("aria-label") !== e && s.setAttribute("aria-label", e);
    const r = this._trigger;
    if (!r) return;
    const i = this._getSelectedLabel() || t, a = r.getAttribute("role") === "button" && i !== e ? `${e}: ${i}` : e;
    r.getAttribute("aria-label") !== a && r.setAttribute("aria-label", a);
  }
  /**
   * `disabled` takes the trigger out of the tab order and says so — opacity alone
   * left it focusable and announced as operable. An open dropdown closes.
   */
  _applyDisabled() {
    const t = this._trigger;
    if (!t) return;
    const e = this.hasAttribute("disabled");
    t.setAttribute("tabindex", e ? "-1" : "0"), e ? (t.setAttribute("aria-disabled", "true"), this._isOpen && this._closeDropdown()) : t.removeAttribute("aria-disabled");
  }
  _updateTriggerLabel() {
    const t = this.getAttribute("placeholder") || "Select...", e = this._trigger?.querySelector(".aparte-select-label-text");
    if (e) {
      const i = this._getSelectedLabel() || t;
      e.textContent !== i && (e.textContent = i);
    }
    const s = this._trigger?.querySelector(".aparte-select-label-sizer");
    if (s) {
      const i = [t, ...Array.from(this.querySelectorAll("aparte-option"), (o) => Va(o))], a = Array.from(s.children, (o) => o.textContent ?? "");
      (i.length !== a.length || i.some((o, l) => o !== a[l])) && s.replaceChildren(...i.map((o) => {
        const l = document.createElement("span");
        return l.textContent = o, l;
      }));
    }
    this._updateNames(), this.querySelectorAll("aparte-option").forEach((i) => {
      i.getAttribute("value") === this._value ? i.setAttribute("selected", "") : i.removeAttribute("selected");
    });
  }
  _getSelectedLabel() {
    for (const t of this.querySelectorAll("aparte-option"))
      if (t.getAttribute("value") === this._value) return Va(t);
    return "";
  }
  _filterOptions(t) {
    this.querySelectorAll("aparte-option").forEach((s) => {
      const i = (s.textContent?.toLowerCase() || "").includes(t);
      s.style.display = i ? "" : "none";
    }), this._isOpen && this._setActive(0);
  }
  _emitChange(t) {
    const e = {
      value: this._value,
      label: this._getSelectedLabel(),
      previousValue: t
    };
    this.dispatchEvent(new CustomEvent("aparte-select-change", {
      bubbles: !0,
      composed: !0,
      detail: e
    }));
  }
}
function Va(n) {
  let t = "";
  for (const e of n.childNodes)
    e.nodeType === Node.ELEMENT_NODE && e.matches(".aparte-option__meta, .aparte-status-dot") || (t += e.textContent ?? "");
  return t.trim();
}
rt(hn);
customElements.get("aparte-select") || customElements.define("aparte-select", hn);
class vc extends HTMLElement {
  static get observedAttributes() {
    return ["value"];
  }
  /** Radius of the SVG circle (viewBox is 0 0 24 24, center at 12,12) */
  _r = 9;
  get _circ() {
    return 2 * Math.PI * this._r;
  }
  connectedCallback() {
    this._render();
  }
  attributeChangedCallback() {
    this._render();
  }
  _render() {
    const t = this.getAttribute("value"), e = t !== null ? Math.min(100, Math.max(0, parseFloat(t) || 0)) : null;
    this.setAttribute("role", "progressbar"), this.setAttribute("aria-valuemin", "0"), this.setAttribute("aria-valuemax", "100"), e !== null ? this.setAttribute("aria-valuenow", String(e)) : this.removeAttribute("aria-valuenow");
    const s = e !== null ? this._circ * (1 - e / 100) : 0, r = e !== null ? `${this._circ.toFixed(2)}` : `${(this._circ * 0.72).toFixed(2)} ${(this._circ * 0.28).toFixed(2)}`;
    this.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle class="aparte-spinner-track" cx="12" cy="12" r="${this._r}"/><circle class="aparte-spinner-fill" cx="12" cy="12" r="${this._r}" stroke-dasharray="${r}" stroke-dashoffset="${s.toFixed(2)}"/></svg>`;
  }
}
rt(vc);
customElements.get("aparte-progress-spinner") || customElements.define("aparte-progress-spinner", vc);
class yc extends HTMLElement {
  static get observedAttributes() {
    return ["name"];
  }
  _unsubscribe = null;
  connectedCallback() {
    this._render(), this._unsubscribe = pe(this, () => this._render());
  }
  disconnectedCallback() {
    this._unsubscribe?.(), this._unsubscribe = null;
  }
  attributeChangedCallback() {
    this.isConnected && this._render();
  }
  _render() {
    const t = this.getAttribute("name"), e = t ? $(this).getIcon(t) : null;
    this.innerHTML = e ?? "", this.firstElementChild?.setAttribute("aria-hidden", "true");
  }
}
rt(yc);
customElements.get("aparte-icon") || customElements.define("aparte-icon", yc);
function Xa(n) {
  let t = n.activeElement;
  for (; t?.shadowRoot?.activeElement; ) t = t.shadowRoot.activeElement;
  return t;
}
function Us(n, t) {
  for (let e = n; e; e = e.parentNode ?? (e instanceof ShadowRoot ? e.host : null))
    if (e === t) return !0;
  return !1;
}
function Ya(n, t, e, s, r) {
  const i = document.createElement("button");
  i.type = "button", i.className = "aparte-btn aparte-btn--icon aparte-btn--sm aparte-btn--ghost aparte-elic-hide", i.setAttribute("aria-expanded", "true"), i.innerHTML = e.getIcon("expand");
  const a = document.createElement("button");
  a.type = "button", a.className = "aparte-btn aparte-btn--ghost aparte-elic-reveal", a.setAttribute("aria-expanded", "false");
  const o = document.createElement("span");
  a.append(o), a.insertAdjacentHTML("beforeend", e.getIcon("collapse"));
  const l = (c) => {
    const d = c.t("elicitationHide");
    i.setAttribute("aria-label", d), i.title = d, o.textContent = c.t("elicitationWaiting");
  };
  return l(e), i.addEventListener("click", () => {
    n.setAttribute("data-collapsed", ""), r(), a.focus();
  }), a.addEventListener("click", () => {
    n.removeAttribute("data-collapsed"), r(), s();
  }), t.prepend(i), n.append(a), { relabel: l };
}
class Qa extends HTMLElement {
  _pending = null;
  /**
   * A turn ended — cancel the open question only if it was OUR turn.
   *
   * These two listeners sit on `window`, so they filter by instance: a Stop (or an
   * error) in one chat must not cancel the question a DIFFERENT chat is waiting on,
   * whose model would be told the user refused a question they were still looking at.
   *
   * The leniency rule is the composer's, deliberately: an event with no
   * `targetId` is for everyone (a single-chat app never sets one), and a chat we
   * cannot identify accepts everything rather than becoming deaf. Only a
   * MISMATCH is ignored.
   */
  _onTurnEnd = (t) => {
    const e = t.detail?.targetId, s = this._pendingTargetId();
    e && s && e !== s || this._cancelPending();
  };
  _unsubscribeConfig = null;
  connectedCallback() {
    this.style.display = "none", this._unsubscribeConfig = pe(this, () => this._relabelPending()), $(this).setElicitationPresenter(this._present, this), window.addEventListener("aparte-message-aborted", this._onTurnEnd), window.addEventListener("aparte-message-error", this._onTurnEnd);
  }
  /**
   * The boundary above us appeared, changed, or went away — move the
   * registration with it.
   *
   * `connectedCallback` alone is not enough and cannot be: registering is a
   * WRITE, and under all four wrappers it happens before `attachConfig` runs, so
   * it lands on the global singleton. `requestUserInput()` then resolves the
   * instance config, finds nothing, and rejects the request — the model
   * hears the user refuse a question the user never saw.
   *
   * See {@link AparteConfigAware}.
   */
  aparteConfigChanged(t, e) {
    e.removeElicitationPresenter(this._present), t.setElicitationPresenter(this._present, this);
  }
  disconnectedCallback() {
    $(this).removeElicitationPresenter(this._present), window.removeEventListener("aparte-message-aborted", this._onTurnEnd), window.removeEventListener("aparte-message-error", this._onTurnEnd), this._unsubscribeConfig?.(), this._unsubscribeConfig = null, this._cancelPending();
  }
  /**
   * Re-apply the open question's strings, in place.
   *
   * Two owners, and both have to move or the panel goes bilingual: the panel's own
   * defaults (`relabel`), and the Skip button, which this file builds and this file
   * therefore has to re-text. The composer's one button is a third, and it already
   * follows — `aparte-composer-send` remembers the panel state it was given.
   */
  _relabelPending() {
    if (!this._pending) return;
    const t = $(this);
    gt(t, () => this._pending.relabel());
  }
  _present = (t) => {
    const e = this._getComposer();
    return e ? new Promise((s, r) => {
      let i = !1;
      const a = {}, o = Xa(document), l = () => {
        const N = t.message;
        return String(typeof N == "function" ? N() : N ?? "");
      }, c = "aparte-chat, [data-aparte-chat], [data-aparte-host]", d = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])', h = e.closest(c) ?? e.parentElement ?? e, u = !(o instanceof HTMLElement) || o === document.body, p = u ? null : o, f = p !== null && Us(p, h), _ = p !== null && p.matches(d), g = p !== null && !f && (_ || p.tagName === "IFRAME" || p.closest(c) !== null), v = (N) => {
        let G = e.querySelector(":scope > .aparte-elic-status");
        G || (G = document.createElement("span"), G.className = "aparte-sr-only aparte-elic-status", G.setAttribute("role", "status"), e.appendChild(G));
        const B = G;
        B.textContent = "", N && setTimeout(() => {
          B.isConnected && (B.textContent = N);
        }, 60);
      }, S = (N, G) => {
        if (g) {
          v(G);
          return;
        }
        const B = window.scrollX, j = window.scrollY;
        _ && f ? (N.el.hasAttribute("tabindex") || N.el.setAttribute("tabindex", "-1"), N.el.hasAttribute("role") || N.el.setAttribute("role", "group"), G && !N.el.hasAttribute("aria-label") && N.el.setAttribute("aria-label", G), N.el.focus()) : N.focus(), u && (window.scrollX !== B || window.scrollY !== j) && window.scrollTo(B, j);
      }, A = () => {
        if (i) return !1;
        i = !0, this._pending = null;
        const N = Xa(document), G = N instanceof Node && Us(N, e);
        return e.hidePanel(a.token), v(""), G && ((!g && p !== null && p.isConnected && !Us(p, e) ? p : null) ?? e).focus(), !0;
      }, C = (N) => {
        A() && s(N);
      }, b = (N = "aborted") => {
        A() && r(new tn(N));
      };
      if (t.signal) {
        if (t.signal.aborted) {
          b();
          return;
        }
        t.signal.addEventListener("abort", () => b(), { once: !0 });
      }
      const y = $(this);
      if (t.kind === "approval") {
        const N = () => j.isComplete() && !j.el.hasAttribute("data-collapsed"), G = () => N() ? "submit" : "none", B = () => e.setPanelSubmitEnabled(N(), G()), j = gt(y, () => Kf(t.message, t.options ?? [], B, t.details, t.allowOther ?? !0));
        j.onSettle((P) => C({ action: "accept", content: P }));
        const x = Ya(j.el, j.dismiss, y, () => j.focus(), B);
        this._pending = {
          abort: () => b(),
          composer: e,
          relabel: () => {
            j.relabel(), x.relabel($(this));
          }
        }, a.token = e.showPanel(j.el, {
          submitEnabled: j.isComplete(),
          mode: G(),
          onSubmit: () => {
            j.isComplete() && C({ action: "accept", content: j.getContent() });
          },
          onEvict: () => b()
        }), S(j, l());
        return;
      }
      const E = t.schema ?? { type: "string" }, R = () => {
        const N = w.el.hasAttribute("data-collapsed");
        e.setPanelSubmitEnabled(!N && w.canProceed(), N ? "none" : w.mode());
      }, w = gt(y, () => Wf(t.message, E, R)), I = document.createElement("button");
      I.type = "button", I.className = "aparte-btn aparte-elic-skip", I.textContent = y.t("elicitationSkip"), I.addEventListener("click", () => C({ action: "decline" })), w.dismiss.appendChild(I);
      const O = Ya(w.el, w.dismiss, y, () => w.focus(), R);
      w.onSettle((N) => C({ action: "accept", content: N })), this._pending = {
        abort: () => b(),
        composer: e,
        relabel: () => {
          w.relabel();
          const N = $(this);
          I.textContent = N.t("elicitationSkip"), O.relabel(N);
        }
      }, a.token = e.showPanel(w.el, {
        submitEnabled: w.canProceed(),
        mode: w.mode(),
        /*
         * Something else took the slot — another request, a conversation switch,
         * or a turn ending. The composer tears the panel down either way; only
         * this callback can settle the promise, and without it the request hung
         * AND `_pending` stayed set, so every later question was short-circuited
         * for the life of the page. A rejection (`aborted`), not `decline`:
         * nobody declined anything, the question was taken away.
         */
        onEvict: () => b(),
        onSubmit: () => {
          w.isComplete() && C({ action: "accept", content: w.getContent() });
        }
      }), S(w, l());
    }) : Promise.reject(new tn("no-presenter"));
  };
  _cancelPending() {
    this._pending?.abort();
  }
  /**
   * The host id of the chat whose composer holds the open panel.
   *
   * Walks up from the composer rather than from `this`, because the panel lives in
   * the composer and that is what the turn belongs to. Matches the hosts
   * `aparte-chat-bubble._resolveTargetId()` matches, for the reason written there:
   * Angular's wrapper root IS the `<aparte-chat>` element, while the plain-root
   * wrappers render a `[data-aparte-chat]` div instead, so matching only the tag
   * resolves `undefined` on three wrappers out of four.
   */
  _pendingTargetId() {
    let t = this._pending?.composer ?? null;
    for (; t; ) {
      if ((t.tagName?.toLowerCase() === "aparte-chat" || t.hasAttribute?.("data-aparte-chat")) && t.id) return t.id;
      t = t.parentElement;
    }
  }
  /**
   * The composer to present in: the nearest one in an ancestor subtree, and
   * nothing else.
   *
   * There is no `document.querySelector('aparte-composer')` fallback: on a page with
   * two chats, an elicitation that could not find its own composer would mount its
   * panel in the OTHER chat's, so one conversation's question would appear under the
   * other conversation, and answering it would resolve a tool call belonging to a
   * chat the user was not looking at.
   *
   * Returning `null` instead REJECTS the request, which is honest: nothing was
   * shown, so nothing was answered. The warning names the fix, because this is a
   * setup mistake and only the developer can correct it — the guide's own example
   * puts `<aparte-elicitation>` inside `<aparte-chat>`.
   */
  _getComposer() {
    let t = this.parentElement;
    for (; t; ) {
      const e = t.querySelector("aparte-composer");
      if (e && typeof e.showPanel == "function") return e;
      if (t.tagName?.toLowerCase() === "aparte-chat" || t.hasAttribute?.("data-aparte-chat")) break;
      t = t.parentElement;
    }
    return console.warn(
      "[aparte-elicitation] No <aparte-composer> in this element's subtree, so the request could not be shown, so it REJECTED and the turn halted. Nothing was told to the model — there is nothing true to tell it. Move <aparte-elicitation> inside the <aparte-chat> it belongs to. It is deliberately NOT borrowing another chat's composer: on a page with two chats that put the question under the wrong one."
    ), null;
  }
}
typeof customElements < "u" && !customElements.get("aparte-elicitation") && (rt(Qa), customElements.define("aparte-elicitation", Qa));
function wc(n) {
  return !n.hasAttribute("loading") && !n.querySelector("aparte-chat-bubble");
}
class Sc extends HTMLElement {
  static get observedAttributes() {
    return ["placeholder", "disabled", "submit-on-enter", "attachments", "type-to-focus"];
  }
  _observer = null;
  _loadingObserver = null;
  _offGlide = null;
  /** Waits for a `<aparte-chat-viewport>` child to appear — see `_watchForViewport`. */
  _childObserver = null;
  /** The viewport is loading and the gate is on — see `_applyLoadingGate`. */
  _gated = !1;
  /** The composer's `disabled` is the gate's to remove, not one the consumer set. */
  _gateOwns = !1;
  /**
   * True only for the composition THIS element injected. An author-provided
   * composer (or a `framework-managed` host) is never edited by the attachments
   * toggle below — those own their own markup.
   */
  _ownsShell = !1;
  connectedCallback() {
    this._render(), this._forwardAttr("placeholder"), this._forwardAttr("disabled"), this._forwardAttr("submit-on-enter"), this._forwardAttr("type-to-focus"), this._syncEmptyWatch(), this._syncLoadingWatch(), this._watchForViewport(), this._offGlide?.(), this._offGlide = kf(this);
  }
  disconnectedCallback() {
    this._offGlide?.(), this._offGlide = null, this._observer?.disconnect(), this._observer = null, this._loadingObserver?.disconnect(), this._loadingObserver = null, this._childObserver?.disconnect(), this._childObserver = null;
  }
  attributeChangedCallback(t, e, s) {
    if (e === s) return;
    if (t === "attachments") {
      this._syncAttachments();
      return;
    }
    if (t === "type-to-focus") {
      const i = this.querySelector("aparte-composer");
      s !== null ? i?.setAttribute(t, s) : i?.removeAttribute(t);
      return;
    }
    if (t === "disabled" && s === null && this._gated) {
      this._gateOwns = !0;
      return;
    }
    const r = this.querySelector("aparte-composer");
    r && (s !== null ? r.setAttribute(t, s) : r.removeAttribute(t));
  }
  /** The message viewport (yours or the default), or `null` before connect. */
  get viewport() {
    return this.querySelector("aparte-chat-viewport");
  }
  /** The composer (yours or the default), or `null` before connect. */
  get composer() {
    return this.querySelector("aparte-composer");
  }
  _render() {
    if (this.hasAttribute("framework-managed") || this.querySelector("aparte-chat-viewport")) return;
    const t = this.getAttribute("placeholder"), e = (t !== null ? ` placeholder="${D(t)}"` : "") + (this.hasAttribute("disabled") ? " disabled" : ""), s = this.hasAttribute("attachments");
    this.innerHTML = `
      <aparte-chat-viewport></aparte-chat-viewport>
      <aparte-elicitation></aparte-elicitation>
      <aparte-composer${e}>
        <div class="aparte-composer-shell">
          ${s ? "<aparte-composer-attachments></aparte-composer-attachments>" : ""}
          <div class="aparte-composer-row">
            ${s ? "<aparte-composer-add-attachment></aparte-composer-add-attachment>" : ""}
            <aparte-composer-input></aparte-composer-input>
            <aparte-composer-send></aparte-composer-send>
          </div>
        </div>
      </aparte-composer>
    `, this._ownsShell = !0;
  }
  /**
   * Add/remove the two attachment primitives on the composition we injected, so
   * toggling the attribute after mount works like the wrappers' reactive prop
   * (there, a re-render does it). Author-provided markup is left alone.
   */
  _syncAttachments() {
    if (!this._ownsShell) return;
    const t = this.composer, e = t?.querySelector(".aparte-composer-shell"), s = e?.querySelector(".aparte-composer-row");
    if (!t || !e || !s) return;
    const r = e.querySelector("aparte-composer-attachments"), i = s.querySelector("aparte-composer-add-attachment");
    if (this.hasAttribute("attachments")) {
      r || e.insertBefore(document.createElement("aparte-composer-attachments"), s), i || s.insertBefore(document.createElement("aparte-composer-add-attachment"), s.firstChild);
      return;
    }
    r?.remove(), i?.remove(), t.clearAttachments();
  }
  /** Set an attribute on the inner composer only when the shell carries it. */
  _forwardAttr(t) {
    this.hasAttribute(t) && this.querySelector("aparte-composer")?.setAttribute(t, this.getAttribute(t) ?? "");
  }
  /**
   * Watch the viewport so `data-empty` follows the conversation.
   *
   * Runs whether or not `center-empty` is set, so an app that wants starters on an
   * empty thread, or a welcome of its own, can read `data-empty` instead of counting
   * messages itself. Every selector core writes against it requires `[center-empty]`,
   * so reflecting it everywhere moves no layout.
   */
  _syncEmptyWatch() {
    this._observer?.disconnect(), this._observer = null;
    const t = this.querySelector("aparte-chat-viewport");
    t && (this._updateEmpty(), this._observer = new MutationObserver(() => this._updateEmpty()), this._observer.observe(t, { childList: !0, subtree: !0, attributes: !0, attributeFilter: ["loading"] }));
  }
  /**
   * A transcript on its way cannot take a message: while the viewport says `loading`
   * the composer is disabled, whatever else the chat is set to. A send in that window
   * raced the fetch — the controller appended to a history that `setMessages`
   * overwrote a moment later. Independent of `center-empty`: every chat gates.
   */
  _syncLoadingWatch() {
    this._loadingObserver?.disconnect(), this._loadingObserver = null;
    const t = this.querySelector("aparte-chat-viewport");
    t && (this._applyLoadingGate(), this._loadingObserver = new MutationObserver(() => this._applyLoadingGate()), this._loadingObserver.observe(t, { attributes: !0, attributeFilter: ["loading"] }));
  }
  /**
   * Both watches above need a viewport to observe, and there might not be one at
   * connect: `<aparte-chat framework-managed>` IS Angular's host element — upgraded on
   * insert, filled by the template afterwards — and hand-written markup upgrades before
   * its children are parsed. This waits for the child to arrive, installs them, and
   * stops, so every chat gates, including those whose transcript is fetched.
   */
  _watchForViewport() {
    this._childObserver?.disconnect(), this._childObserver = null, !this.querySelector("aparte-chat-viewport") && (this._childObserver = new MutationObserver(() => {
      this.querySelector("aparte-chat-viewport") && (this._childObserver?.disconnect(), this._childObserver = null, this._syncEmptyWatch(), this._syncLoadingWatch());
    }), this._childObserver.observe(this, { childList: !0, subtree: !0 }));
  }
  /**
   * The gate only ever ADDS `disabled` and only ever removes what it added: a `disabled`
   * the consumer set — on this element, or on a composer of their own — stays.
   */
  _applyLoadingGate() {
    const t = this.querySelector("aparte-composer"), e = this.querySelector("aparte-chat-viewport")?.hasAttribute("loading") ?? !1;
    t && (e && !this._gated ? (this._gated = !0, this._gateOwns = !t.hasAttribute("disabled"), t.setAttribute("disabled", "")) : !e && this._gated && (this._gated = !1, this._gateOwns && !this.hasAttribute("disabled") && t.removeAttribute("disabled"), this._gateOwns = !1));
  }
  /**
   * Empty means no message AND none on its way. A viewport that says `loading` holds
   * no bubble yet but does not count as empty, so the welcome and the centred composer
   * stay hidden while a conversation is being fetched.
   */
  _updateEmpty() {
    const t = this.querySelector("aparte-chat-viewport");
    this.toggleAttribute("data-empty", !t || wc(t));
  }
}
rt(Sc);
customElements.get("aparte-chat") || customElements.define("aparte-chat", Sc);
function og(n, t) {
  const e = [];
  let s = -1, r = -1, i = 0;
  const a = () => {
    i >= 2 && e.push({ from: s, to: r }), s = -1, r = -1, i = 0;
  };
  return n.forEach((o, l) => {
    const c = t(o);
    c === "stop" ? a() : c === "fold" && (s < 0 && (s = l), r = l, i += 1);
  }), a(), e;
}
function In(n, t) {
  const e = `[data-segment-id="${yt(t)}"]`;
  return n.querySelector(`:scope > ${e}, :scope > .aparte-turn > .aparte-turn__body > ${e}`);
}
function lg(n) {
  let t = 1 / 0, e = -1 / 0;
  for (const s of n) {
    const { startedAt: r, endedAt: i } = as(s) ?? {};
    if (r == null || i == null) return;
    t = Math.min(t, r), e = Math.max(e, i);
  }
  return n.length > 0 ? e - t : void 0;
}
const cg = (n, t) => t ? n.split(t).length - 1 : 0;
function dg(n, t) {
  const e = n.createElement("span");
  e.className = "aparte-tag aparte-inline-token", t.kind && (e.dataset.kind = t.kind);
  const s = n.createElement("span");
  return s.className = "aparte-tag__label", s.textContent = t.label, e.appendChild(s), e;
}
function ug(n, t, e) {
  let s = cg(t.slice(0, e.start), e.text);
  const r = n.ownerDocument, i = r.createTreeWalker(n, NodeFilter.SHOW_TEXT);
  for (; i.nextNode(); ) {
    const a = i.currentNode;
    for (let o = a.data.indexOf(e.text); o >= 0; o = a.data.indexOf(e.text, o + e.text.length)) {
      if (s-- > 0) continue;
      const l = r.createRange();
      l.setStart(a, o), l.setEnd(a, o + e.text.length), l.deleteContents(), l.insertNode(dg(r, e));
      return;
    }
  }
}
function hg(n, t, e) {
  if (!n.querySelector(".aparte-inline-token"))
    for (const s of [...e].sort((r, i) => i.start - r.start))
      s.text && ug(n, t, s);
}
function Za(n, t, e) {
  const s = document.createElement("button");
  return s.type = "button", s.className = `aparte-btn aparte-btn--sm ${t}`, s.textContent = n, s.addEventListener("click", e), s;
}
function pg(n) {
  const t = document.createElement("div");
  t.className = "aparte-feedback-reasons", t.setAttribute("role", "group"), t.setAttribute("aria-label", n.title);
  const e = document.createElement("span");
  e.textContent = n.title, t.appendChild(e);
  for (const s of n.reasons)
    t.appendChild(Za(s, "aparte-btn--surface", () => n.onPick(s)));
  return t.appendChild(Za(n.dismiss, "aparte-btn--ghost", n.onClose)), t;
}
const Ja = (n) => !!n && typeof n.getMessages == "function" && typeof n.updateMessage == "function";
function fg(n) {
  const t = jt(n);
  if (Ja(t)) return t;
  const e = n.closest("aparte-chat-viewport");
  return Ja(e) ? e : null;
}
function gg(n, t) {
  const e = fg(n);
  if (!e) return 0;
  const s = e.getMessages().filter((i) => i.contextSummary !== void 0).map((i) => i.id);
  for (const i of s) e.updateMessage(i, { contextSummary: void 0 });
  const r = { restored: !0 };
  return t.messageId && (r.messageId = t.messageId), t.targetId && (r.targetId = t.targetId), window.dispatchEvent(new CustomEvent("aparte-compact-done", { detail: r })), s.length;
}
function zt(n, t, e) {
  const s = document.createElement(n);
  return s.className = t, e !== void 0 && (s.textContent = e), s;
}
function Fe(n, t) {
  const e = zt("button", "aparte-btn aparte-btn--ghost aparte-btn--sm aparte-checkpoint__action", t);
  return e.type = "button", e.setAttribute("data-checkpoint-action", n), e;
}
function _g(n) {
  const { kind: t, locale: e } = n, s = zt("div", "aparte-checkpoint");
  s.setAttribute("role", "group"), s.setAttribute("aria-label", e.checkpointGroup ?? "Context summary"), s.setAttribute("data-state", t);
  const r = zt("div", "aparte-checkpoint__row aparte-divider aparte-divider--label"), i = zt("div", "aparte-checkpoint__label");
  r.appendChild(i), s.appendChild(r);
  let a;
  if (t === "done") {
    const l = n.count ?? 0;
    a = l === 1 ? e.checkpointCountOne ?? "1 message summarised for the model" : (e.checkpointCount ?? "{n} messages summarised for the model").replace("{n}", () => String(l));
  } else t === "legacy" ? a = e.checkpointLegacy ?? "Earlier messages were summarised" : t === "pending" ? a = e.checkpointPending ?? "Summarising the context…" : a = e.checkpointFailed ?? "Couldn't summarise the context";
  const o = zt("span", "aparte-checkpoint__text", a);
  if (t === "pending" ? (o.classList.add("aparte-shimmer"), o.setAttribute("role", "status")) : t === "failed" && (o.setAttribute("role", "status"), n.reason && (o.title = n.reason, o.appendChild(zt("span", "aparte-sr-only", `: ${n.reason}`)))), i.appendChild(o), t === "done" || t === "legacy")
    if (n.confirming && t === "done") {
      const l = zt("span", "aparte-checkpoint__confirm"), c = zt("span", "aparte-checkpoint__question", e.checkpointRestoreConfirm ?? "Send the original messages to the model again?");
      c.id = `${n.summaryId}-question`;
      const d = Fe("restore-confirm", e.checkpointRestore ?? "Restore");
      d.setAttribute("aria-describedby", c.id), l.append(c, d, Fe("restore-cancel", e.cancel ?? "Cancel")), i.appendChild(l);
    } else {
      const l = Fe("toggle", n.open ? e.checkpointHide ?? "Hide summary" : e.checkpointShow ?? "Show summary");
      l.setAttribute("aria-expanded", String(n.open)), l.setAttribute("aria-controls", n.summaryId), i.appendChild(l), t === "done" && i.appendChild(Fe("restore", e.checkpointRestore ?? "Restore"));
    }
  else t === "failed" && i.appendChild(Fe("retry", e.retry ?? "Retry"));
  if (t === "done" || t === "legacy") {
    const l = zt("div", "aparte-checkpoint__summary aparte-segment-content");
    l.id = n.summaryId, n.open || (l.hidden = !0), s.appendChild(l);
  }
  return s;
}
function to(n, t) {
  return n.type === "tool_call" ? Ep(t) : n.type === "activity" ? Cp(t) : null;
}
let eo = !1;
function mg(n) {
  eo || (eo = !0, console.warn(`[aparte] No renderer for segment "${n}". Register one with registerSegmentRenderer({ type: '${n}', render }) from @aparte/core — see https://apartejs.dev/guides/customization/#custom-segment-types`));
}
function Ws(n) {
  const t = typeof n.fallback == "string" && n.fallback.trim() ? n.fallback : null;
  t || mg(n.type);
  const e = document.createElement("div");
  return e.className = t ? "aparte-segment aparte-segment-fallback" : "aparte-segment aparte-segment-unknown", e.textContent = t ?? `[Unknown segment type: ${n.type}]`, e;
}
function Yt(n, t) {
  const e = ka(n, t);
  return e || (Rp(t), ka(n, t));
}
function Ue(n, t) {
  let e;
  if (n instanceof HTMLElement)
    e = n;
  else {
    const s = document.createElement("div");
    s.innerHTML = n, e = s.firstElementChild;
  }
  return e && t && !e.hasAttribute("data-segment-id") && e.setAttribute("data-segment-id", t.id), e;
}
const en = /* @__PURE__ */ new Map();
function bg() {
  const n = [...en].filter(([e]) => !e.firstChild);
  en.clear();
  const t = n.map(([, { bubble: e, role: s }]) => {
    const r = getComputedStyle(e).getPropertyValue(`--aparte-avatar-image-${s}`).trim();
    return r !== "" && r !== "none";
  });
  n.forEach(([e], s) => e.toggleAttribute("data-image", t[s]));
}
let vg = 0;
class Ac extends HTMLElement {
  _contentEl = null;
  _segmentsEl = null;
  _attachmentsEl = null;
  _actionBarEl = null;
  _branchPickerEl = null;
  _footerEl = null;
  _content = "";
  _tokens;
  _streaming = !1;
  _segments = [];
  _role = "assistant";
  _attachments = [];
  _usage = null;
  /** The step the agent is on while this reply waits: live only, never part of the message. */
  _step = null;
  _finishReason = null;
  /** The checkpoint this message carries: the separator above it is drawn from it. */
  _contextSummary = null;
  /**
   * This message is one an older compaction wrote (`compaction: true`), as the host told
   * us. `null` until told: the `data-kind="compaction"` attribute the viewport and the
   * wrappers stamp from the same flag answers meanwhile.
   */
  _legacyCompaction = null;
  /** The summary panel under the separator is open. Kept here, not in the DOM, because a redraw rebuilds the DOM. */
  _checkpointOpen = !1;
  /** Restore asked for confirmation and has not been answered. */
  _confirmingRestore = !1;
  /** What the separator was last drawn from, so a re-sync that changes nothing leaves it (and a focused button) alone. */
  _checkpointDrawn = "";
  /** Names the separator's panel for `aria-controls`, unique on the page without needing a message id. */
  _checkpointId = `aparte-checkpoint-${++vg}`;
  /** Cleanup returned by the avatar provider — called on disconnect/re-render. */
  _avatarCleanup = null;
  /** Whether the avatar slot holds what a provider drew, which goes when the provider does. */
  _avatarFromProvider = !1;
  /** Sibling count for tree-based branch navigation (set by setSiblings()) */
  _siblingCount = 1;
  /**
   * Which accessible names the bubble wrote itself, and so may refresh on a language switch
   * or a name change. A custom shell's own are its author's: refreshed, a root's or a bar's
   * label of their own became "Assistant response" or "Message actions" at the first notify.
   */
  _wroteRootLabel = !1;
  _wroteBarLabel = !1;
  _wroteArrowLabels = !1;
  /** The shell renderer the bubble was last drawn with (`null`: the default frame). */
  _drawnShell = null;
  /** Sibling index for tree-based branch navigation (set by setSiblings()) */
  _siblingIndex = 0;
  /** True while the user-message inline editor is open. */
  _editing = !1;
  /** The live inline editor (the composer's contenteditable primitive), present only while `_editing`. */
  _editInput = null;
  /**
   * The `data-action` of the button the editor was opened from, so leaving it can hand
   * the keyboard back. The STRING, not the node: entering and leaving edit mode rewrite
   * the action bar's `innerHTML`, so the opener's identity is destroyed twice.
   */
  _editReturnAction = null;
  static get observedAttributes() {
    return ["data-role", "content", "timestamp", "message-id", "streaming", "name", "data-checkpoint", "data-checkpoint-reason"];
  }
  constructor() {
    super();
  }
  // Rebuild the action bar when the global config changes (e.g. a live skin
  // switch calling setBubbleActions / setIconProvider) so already-rendered
  // bubbles pick up the new per-role actions + icons without being re-created.
  _onConfigChange = (t) => {
    const e = t.detail;
    e?.config && e.config !== this._cfg || (this._updateActionBar(), this._updateName(), this._updateLocalizedLabels(), this._updateWaiting(), this._updateFinishNote(), this._checkpointDrawn = "", this._updateCheckpoint(), this._renderAvatar(), this._redrawSegmentsWhoseRendererChanged(), this._relabelSegments(), gt(this._cfg, () => ch(this)), Xh(this), this._syncSources(), this._updateTimestamp(this.getAttribute("timestamp")), this._redrawQueued || (this._redrawQueued = !0, queueMicrotask(() => {
      this._redrawQueued = !1, this.isConnected && this._redrawIfStale();
    })));
  };
  /** A {@link _redrawIfStale} is queued for the end of the current task. */
  _redrawQueued = !1;
  /** The {@link renderingVersionOf} count the content was last drawn with. */
  _drawnWithVersion = 0;
  /** Every segment on screen, by id: see {@link DrawnSegment}. */
  _drawn = /* @__PURE__ */ new Map();
  /** Segments written to with no `isStreaming: false` yet: settled when the message stops streaming. */
  _written = /* @__PURE__ */ new Set();
  /** The segments were released because the bubble was still out of the page at the next microtask. */
  _releasedWhileDetached = !1;
  /** A {@link _scheduleReleaseCheck} is queued. */
  _releaseCheckQueued = !1;
  /** Unsubscribes from the renderer registries' channel; set while connected. */
  _offRenderers = null;
  /** The tool renderer in effect for a call: none for a hidden call or another segment. */
  _toolRendererFor(t) {
    if (t.type !== "tool_call") return null;
    const e = this._cfg;
    if (Yt("tool_call", e) !== Ze) return null;
    const s = t.toolCall?.name;
    return !s || e.isToolHidden(s) ? null : e.getToolRenderer(s) ?? null;
  }
  /** The tool or activity renderer in effect for a segment, when core's own renderer for its type is what draws it. */
  _innerRendererFor(t) {
    return t.type !== "activity" ? this._toolRendererFor(t) : Yt("activity", this._cfg) !== Je ? null : this._cfg.getActivityRenderer(t.activityType) ?? null;
  }
  /**
   * Record a segment as drawn, set it up, then read back which tool renderer is behind the
   * row (tool-call.ts records it as the row is set up — one record, not a second lookup).
   * Recorded BEFORE `setup`: a setup that throws (a framework mount) leaves an element that
   * will still be cleaned up. The same id drawn twice releases the first element.
   */
  _install(t, e, s, r = t) {
    const i = this._drawn.get(t.id);
    i && i.el !== e && this._release(t.id);
    const a = { el: e, renderer: s, tool: null, segment: t };
    this._drawn.set(t.id, a), this.isConnected || this._scheduleReleaseCheck(), s?.setup && gt(this._cfg, () => s.setup(e, r)), a.tool = to(t, e);
  }
  /**
   * The segment as its renderer's `setup` sees it: one ADDED while the message streams is
   * arriving, flag or no flag.
   *
   * A text or reasoning segment flagged `isStreaming: true` is written by its renderer's
   * `setup` through the streaming renderer, from its first chunk. The stream parser's text
   * carries no flag at all, though: `update` reads a missing flag as "still arriving",
   * `setup` cannot, because a restored message's segments carry none either and are
   * finished. So its first chunk — drawn by `render` and `setup`, while `update` only runs
   * from the second — went through the one-shot provider, which reads `Done: **Book ` as
   * finished text: with marked, the `**` showed raw until the next chunk reached the
   * streaming renderer, which completes it. `addSegment` on a streaming message is a segment
   * arriving, and the bubble is what knows the message streams, so it tells `setup`
   * (`render` keeps the segment as stored: the reasoning label reads the flag, and would lose
   * its shimmer again at the next chunk). `setSegments` infers nothing — a hand-set text is
   * finished, and the streaming renderer would keep back what may still open a token (the
   * full stop after `**bold**`) until the turn ends; a framework host flags the segment
   * itself (`populateBubbleFromMessage`). Either way the segment joins `_written`, to be
   * settled — flushed, then drawn whole — when the message stops.
   */
  _drawnAs(t, e = !1) {
    return t.type !== "text" && t.type !== "thinking" ? t : t.isStreaming === !0 ? (this._written.add(t.id), t) : !e || t.isStreaming === !1 || !this._streaming ? t : (this._written.add(t.id), { ...t, isStreaming: !0 });
  }
  /**
   * The segment's element leaves for good: its renderer's `cleanup`, once. A cleanup that
   * throws is reported and costs nothing else — the element still goes, and the others
   * are still released.
   */
  _release(t) {
    const e = this._drawn.get(t);
    if (!e) return;
    this._drawn.delete(t);
    const s = e.renderer?.cleanup;
    if (s)
      try {
        gt(this._cfg, () => s.call(e.renderer, e.el, e.segment));
      } catch (r) {
        console.error("[aparte] a segment renderer's cleanup threw", r);
      }
  }
  _releaseAll() {
    for (const t of [...this._drawn.keys()]) this._release(t);
  }
  /**
   * Gone for good, or only moved? A keyed list moving a row takes it out and puts it back
   * before the next microtask, and must not unmount what its segments hold: decide then.
   */
  _scheduleReleaseCheck() {
    this._releaseCheckQueued || (this._releaseCheckQueued = !0, queueMicrotask(() => {
      this._releaseCheckQueued = !1, !(this.isConnected || this._drawn.size === 0) && (this._releaseAll(), this._releasedWhileDetached = !0);
    }));
  }
  /** One segment drawn again in place: its renderer cleans up, the current one draws. False when it was never drawn. */
  _redrawSegment(t) {
    const e = this._drawn.get(t.id);
    if (!e) return !1;
    const s = this._cfg, r = Yt(t.type, s), i = e.el;
    this._release(t.id);
    const a = r ? this._drawnAs(t) : t, o = r ? Ue(gt(s, () => r.render(t)), t) : Ws(t);
    return o ? (i.replaceWith(o), this._install(t, o, r, a), !0) : (i.remove(), !0);
  }
  /** The renderer that drew this segment is still the one in effect (for a tool call, the tool renderer too). */
  _stillDrawnByCurrent(t, e) {
    return Yt(t.type, this._cfg) === e.renderer && this._innerRendererFor(t) === e.tool;
  }
  /**
   * A renderer registered, unregistered or overridden since these segments were drawn: draw
   * again only the segments whose renderer is no longer the one that drew them (for a tool
   * call, the tool renderer counts), in place. The others keep their elements — and with
   * them anything mounted in them, which a redraw of the whole message would unmount.
   */
  _redrawSegmentsWhoseRendererChanged() {
    if (!(!this.isConnected || !this._segmentsEl || this._drawn.size === 0)) {
      for (const t of this._segments) {
        const e = this._drawn.get(t.id);
        !e || this._stillDrawnByCurrent(t, e) || this._redrawSegment(t);
      }
      this._syncTurns();
    }
  }
  /**
   * The registries' channel: a renderer changed on our config — or on the global one, whose
   * segment renderers a chat with its own config inherits.
   */
  _onRenderersChange = (t) => {
    t !== this._cfg && t !== _t || this._redrawSegmentsWhoseRendererChanged();
  };
  /**
   * A card a mounted renderer keeps (a framework component): its drawing reads none of the
   * providers a rendering-version bump announces, so it stays mounted through one — as long
   * as that renderer is still the one in effect.
   */
  _keepsItsDrawing(t, e) {
    return (Na(e.renderer) || Na(e.tool)) && this._stillDrawnByCurrent(t, e);
  }
  /**
   * A Markdown or highlight provider set after this message was drawn: draw it again.
   * Not mid-stream — the stream reads the providers as it goes, and its end redraws — and
   * not mid-edit, where the drawn message is hidden behind the editor and drawing it would
   * show it again beside the editor; leaving the edit calls this.
   *
   * Segment by segment, keeping the cards a mounted renderer holds: a highlighter that loads
   * after the first answer must not remount every card on the page and lose its state.
   */
  _redrawIfStale() {
    if (!(this._streaming || this._editing || Nt(this._cfg) === this._drawnWithVersion)) {
      if (this._segments.length === 0) {
        this._updateContent();
        return;
      }
      if (this._segments.some((t) => !this._drawn.has(t.id))) {
        this._renderSegments();
        return;
      }
      this._drawnWithVersion = Nt(this._cfg);
      for (const t of this._segments) {
        const e = this._drawn.get(t.id);
        this._keepsItsDrawing(t, e) || this._redrawSegment(t);
      }
      this._syncTurns(), this._reflectError(), this._syncCopyAction();
    }
  }
  /**
   * Ask every rendered segment to re-read its config-derived text.
   *
   * Not `_renderSegments()`, which wipes the container and rebuilds: that destroys a
   * mounted artifact preview, reverts a reasoning block the reader expanded by
   * clicking `<summary>` (the DOM's real state is never written back to `collapsed`),
   * resets scroll inside long terminal panes, drops focus from an Approve/Reject
   * gate, and throws away the incremental Markdown parser's buffered lookahead
   * mid-stream — for a change that added no content. It also fires container-wide
   * childList mutations, which is what the viewport's observer reads as "scroll to
   * the bottom".
   *
   * `relabel` is the narrow alternative, bound by the same no-child-node rule as
   * `update()`. A renderer that has no config-derived text does not implement it,
   * and this loop simply skips it.
   */
  _relabelSegments() {
    if (this._segmentsEl) {
      for (const t of this._segments) {
        const e = Yt(t.type, this._cfg);
        if (!e?.relabel) continue;
        const s = In(this._segmentsEl, t.id);
        s && gt(this._cfg, () => e.relabel(s, t));
      }
      this._syncTurns();
    }
  }
  /**
   * Re-apply the locale strings written straight into the markup by `_render()` —
   * the accessible names a screen reader reads, which nothing else refreshes.
   */
  _updateLocalizedLabels() {
    const t = this._cfg.getLocale(), e = (s, r) => {
      this.querySelector(s)?.setAttribute("aria-label", r);
    };
    this._wroteArrowLabels && (e(".aparte-branch-prev", t.previousResponse ?? "Previous response"), e(".aparte-branch-next", t.nextResponse ?? "Next response")), this._wroteBarLabel && e(".aparte-action-bar", t.messageActions ?? "Message actions");
  }
  /**
   * Config governing this bubble: the instance config of the nearest
   * `[data-aparte-host]` boundary, else the global singleton. Resolved live
   * (a single `closest()`) rather than cached — the boundary may be attached
   * AFTER this bubble mounts (AparteChatHost.bind() runs post-mount), so a
   * connect-time cache would freeze the wrong config.
   */
  get _cfg() {
    return $(this);
  }
  connectedCallback() {
    this._render(), this._updateContent(), this._updateTimestamp(this.getAttribute("timestamp")), this._releasedWhileDetached && (this._releasedWhileDetached = !1, this._segments.length > 0 && this._renderSegments()), window.addEventListener("aparte-config-change", this._onConfigChange), this._offRenderers ??= Qp(this._onRenderersChange), this.addEventListener("click", this._onBranchPickerClick), this.addEventListener("click", this._onLinkClick), this.addEventListener("click", this._onCheckpointClick), this.addEventListener("keydown", this._onCheckpointKeydown);
  }
  /**
   * The boundary above this bubble changed — under every wrapper the chat's own config is
   * attached AFTER the first messages are drawn. When that brings another frame
   * (`setBubbleShellRenderer`), the bubble is drawn again in it and its content put back,
   * so every message wears the chat's frame.
   *
   * Deferred to a microtask: a wrapper detaches the boundary as it unmounts (Vue's
   * `onBeforeUnmount`, Svelte's `onDestroy`), while the bubbles are still in the page, and
   * redrawing every one of them just before their removal would cost a frame per message.
   * After the microtask a removed bubble is no longer connected, and repeated notices fold
   * into one.
   */
  aparteConfigChanged() {
    queueMicrotask(() => {
      this._redrawFrameIfChanged(), this._redrawSegmentsWhoseRendererChanged();
    });
  }
  _redrawFrameIfChanged() {
    if (!(!this.isConnected || this._editing) && (this._cfg.getBubbleShellRenderer?.() ?? null) !== this._drawnShell) {
      if (this._avatarCleanup) {
        try {
          this._avatarCleanup();
        } catch {
        }
        this._avatarCleanup = null;
      }
      this._resetMarkdownStream(), this._releaseAll(), this.replaceChildren(), this._render(), this._updateContent(), this._segments.length > 0 && this._renderSegments(), this._updateAttachments(), this._updateTimestamp(this.getAttribute("timestamp")), this._updateBranchPicker(), this._updateCheckpoint();
    }
  }
  disconnectedCallback() {
    if (window.removeEventListener("aparte-config-change", this._onConfigChange), this._offRenderers?.(), this._offRenderers = null, this.removeEventListener("click", this._onBranchPickerClick), this.removeEventListener("click", this._onLinkClick), this.removeEventListener("click", this._onCheckpointClick), this.removeEventListener("keydown", this._onCheckpointKeydown), this._avatarCleanup) {
      try {
        this._avatarCleanup();
      } catch {
      }
      this._avatarCleanup = null;
    }
    this._scheduleReleaseCheck();
  }
  attributeChangedCallback(t, e, s) {
    if (e !== s)
      switch (t) {
        case "data-role":
          (s === "user" || s === "assistant") && (this._role = s, this._updateRole());
          break;
        case "content":
          this._content = s || "", this._resetMarkdownStream(), this._updateContent();
          break;
        case "timestamp":
          this._updateTimestamp(s);
          break;
        case "data-checkpoint":
          this._updateCheckpoint();
          break;
        case "data-checkpoint-reason":
          this.getAttribute("data-checkpoint") === "failed" && this._updateCheckpoint();
          break;
        case "streaming":
          this._updateStreaming(s !== null && s !== "false");
          break;
        case "name":
          this._updateName();
          break;
      }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────
  /** Append a token chunk (for streaming) */
  appendToken(t) {
    this._content += t, this._updateContent(), this._syncCopyAction();
  }
  /** The row under the action bar that asks why, when the app listed reasons. */
  _askFeedbackReason(t) {
    const e = this._cfg.getBubbleActions().feedbackReasons;
    if (!e?.length || this.querySelector(".aparte-feedback-reasons")) return;
    const s = pg({
      reasons: e,
      title: this._cfg.t("feedbackReasonTitle"),
      dismiss: this._cfg.t("feedbackReasonDismiss"),
      onPick: (r) => {
        s.remove(), this.dispatchEvent(new CustomEvent("aparte-feedback-reason", {
          bubbles: !0,
          composed: !0,
          detail: { messageId: t, reason: r }
        }));
      },
      onClose: () => s.remove()
    });
    this.querySelector(".aparte-footer")?.after(s);
  }
  /** The tokens a user message was written with, drawn as they looked in the composer. */
  setTokens(t) {
    this._tokens = t, this._drawTokens();
  }
  _drawTokens() {
    this._contentEl && this._role === "user" && this._tokens?.length && hg(this._contentEl, this._content, this._tokens);
  }
  /** Set content directly */
  setContent(t) {
    this._content = t, this.setAttribute("content", t), this._resetMarkdownStream(), this._updateContent(), this._syncCopyAction();
  }
  /**
   * Drop the incremental Markdown parser's state.
   *
   * Only needed where `_content` is REPLACED rather than grown. `appendToken` grows it, so
   * the parser's cursor stays valid there — which is the whole point of the seam.
   */
  _resetMarkdownStream() {
    const t = this;
    t._aparteSmd && t._aparteSmd.renderer.end(), t._aparteSmd = void 0;
  }
  /** Get current content */
  getContent() {
    return this._content;
  }
  /** Set segments for rich content */
  setSegments(t) {
    this._replaceSegments(t), this._syncSources(), this._updateWaiting();
  }
  /** The reply's sources, listed under its segments: the text segments' own, once each. */
  _syncSources() {
    const t = this._segmentsEl, e = t?.parentElement;
    if (!t || !e) return;
    const s = this._segments.flatMap((r) => r.type === "text" ? r.sources ?? [] : []);
    rp(e, t, s, this._cfg);
  }
  /** A whole new list, from `setSegments` or `updateMessage({ segments })`: copied in, then drawn. */
  _replaceSegments(t) {
    const e = [...t];
    if (this._resyncKeepingCards(e)) {
      this._syncSources();
      return;
    }
    this._segments = e, this._renderSegments();
  }
  /**
   * The same segments again, in the same order — the host re-syncing a message when its turn
   * ends — while a mounted renderer holds one of them: the cards it holds are handed the new
   * state, and only the other segments are drawn again, in place. Drawing everything again
   * unmounted every framework card at the end of every turn and lost its state. False, and
   * nothing touched, in every other case: those keep the full redraw.
   */
  _resyncKeepingCards(t) {
    if (!this._segmentsEl || t.length !== this._segments.length || t.some((s, r) => s.id !== this._segments[r].id || !this._drawn.has(s.id))) return !1;
    const e = new Set(t.filter((s) => this._keepsItsDrawing(s, this._drawn.get(s.id))).map((s) => s.id));
    if (e.size === 0) return !1;
    this._segments = t, this._drawnWithVersion = Nt(this._cfg);
    for (const s of t)
      e.has(s.id) ? this._applySegmentUpdate(s.id, s, s) : this._redrawSegment(s);
    return this._syncTurns(), this._reflectError(), this._syncCopyAction(), !0;
  }
  /** Add a segment */
  addSegment(t) {
    this._segments.push(t), this._appendSegmentEl(t), this._syncTurns(), t.type === "text" && t.sources && this._syncSources(), this._updateWaiting();
  }
  /** Update a specific segment */
  updateSegment(t, e) {
    const s = this._segments.findIndex((r) => r.id === t);
    if (s !== -1) {
      const r = al(this._segments[s], e);
      this._segments[s] = r, r.isStreaming === !1 ? this._written.delete(t) : "content" in e && this._written.add(t), this._applySegmentUpdate(t, r, e), "sources" in e && this._syncSources(), this._syncCopyAction(), ("status" in e || "isStreaming" in e) && (this._syncTurns(), this._updateWaiting());
    }
  }
  /** Append content to a segment */
  appendToSegment(t, e) {
    const s = this._segments.find((r) => r.id === t);
    s && "content" in s && (s.content += e, s.isStreaming !== !1 && this._written.add(t), this._applySegmentUpdate(t, s, { content: s.content }), this._syncCopyAction());
  }
  /**
   * The message stopped streaming, so a segment it was still writing is finished too.
   *
   * A segment written to with no `isStreaming` flag — `appendToSegment` from a stream driven
   * by hand, as the docs' own streaming demo does — goes through the incremental Markdown
   * parser, which holds back what may still open a token (the full stop after `**bold**`)
   * until it is told the text is complete. Nothing told it: the message ended with its tail
   * missing. Marked finished here, it is flushed and settled like any finished segment.
   */
  _settleWrittenSegments() {
    for (const t of this._written) {
      const e = this._segments.findIndex((i) => i.id === t), s = this._segments[e];
      if (!s || s.isStreaming === !1) continue;
      const r = { ...s, isStreaming: !1 };
      this._segments[e] = r, this._applySegmentUpdate(t, r, { isStreaming: !1 });
    }
    this._written.clear();
  }
  /** Get all segments */
  getSegments() {
    return [...this._segments];
  }
  /** Remove a segment by id (e.g. to discard a transient waiting indicator) */
  /**
   * Scoped to DIRECT children on purpose.
   *
   * Segments are appended as direct children of the container, but a descendant
   * query returns the first match in document order — and sanitized model
   * markdown renders inside that same container, with `data-*` attributes
   * deliberately preserved (they are inert). So a decoy `data-segment-id` planted
   * in an earlier segment's prose would win over the real segment element.
   *
   * Parser ids are unguessable UUIDs, but a tool segment is `tool-${toolCallId}`
   * and the MODEL chooses that id — so a decoy could point an update at the wrong
   * element and leave a rejected tool rendering as still-running: a spoof against
   * the human-in-the-loop control.
   */
  removeSegment(t) {
    const e = this._segments.findIndex((r) => r.id === t);
    e !== -1 && this._segments.splice(e, 1), this._release(t), (this._segmentsEl ? In(this._segmentsEl, t) : null)?.remove(), this._syncTurns(), this._syncSources(), this._updateWaiting(), this._syncCopyAction();
  }
  /** Set attachments (chips shown above message content, user role only) */
  setAttachments(t) {
    this._attachments = t, this._updateAttachments(), this._updateWaiting();
  }
  /**
   * Set token usage + timing for this message (assistant only).
   *
   * This is the *precondition* for the info ("i") action, not the trigger: the
   * button appears only if the app also declared it wants it —
   * `aparteGlobalConfig.setBubbleActions({ info: true })` — because the stats popover it
   * opens (`aparte-message-info`) is the app's, and core has none. Without usage
   * there is nothing to show, so the button never renders either way.
   */
  setUsage(t) {
    this._usage = t ?? null, this._updateActionBar();
  }
  /**
   * Say the step the agent is on ("Reading the parser") while this reply waits, or `null`
   * when it is on none. The client calls it as the run announces steps.
   *
   * Live only: the words show beside the waiting dots while the reply has nothing to show
   * (or between two calls), and are what a screen reader hears in place of "Typing". They
   * are never one of the message's segments, never saved and never sent to the model, and
   * they go with the reply's end even when nobody closed the step.
   */
  setStep(t) {
    const e = typeof t == "string" && t.trim() ? t.trim() : null;
    e !== this._step && (this._step = e, this._updateWaiting());
  }
  /**
   * Say why the model stopped writing this reply (assistant only).
   *
   * Only `'length'` draws anything: a quiet note after the content that the reply was cut
   * off, because otherwise a truncated answer reads as a finished one. Every other reason
   * is the ordinary end of a turn and says nothing. The note waits for the turn to settle.
   */
  setFinishReason(t) {
    this._finishReason = t ?? null, this._updateFinishNote();
  }
  /**
   * Say that the messages before this one were summarised for the model, or that they no
   * longer are (`null`).
   *
   * Draws, or removes, the separator above the message: "{n} messages summarised for the
   * model", with Show summary and Restore. The separator sits OUTSIDE `.aparte-message`
   * and inside this element, so it is not part of the message's frame and survives the
   * frame being drawn again. `legacy: true` says the message is itself the summary an
   * older compaction wrote (`compaction: true`): it is replaced by the separator, which
   * then has no count and no Restore. Omit `legacy` to leave what the host last said (or
   * the `data-kind="compaction"` attribute) in force.
   */
  setContextSummary(t, e) {
    this._contextSummary = t ?? null, e?.legacy !== void 0 && (this._legacyCompaction = e.legacy), this._contextSummary || (this._confirmingRestore = !1, this._isLegacyCompaction() || (this._checkpointOpen = !1)), this._updateCheckpoint();
  }
  /**
   * Update the branch picker UI for tree-based navigation.
   * The viewport calls this after a branch switch or re-render.
   * Prev/Next clicks dispatch `aparte-branch-navigate` (bubbles: true) so
   * the viewport can handle the actual tree switch.
   */
  setSiblings(t, e) {
    this._siblingCount = t, this._siblingIndex = e, this._updateBranchPicker();
  }
  /**
   * Atomic update for the message
   */
  updateMessage(t) {
    if ("role" in t && (this._role = t.role, this._updateRole()), "tokens" in t && (this._tokens = t.tokens), "content" in t && (this._content = t.content, this._updateContent()), "segments" in t && this._replaceSegments(t.segments), "timestamp" in t && this._updateTimestamp(t.timestamp), "status" in t) {
      const e = t.status === "streaming" || t.status === "pending";
      this._updateStreaming(e);
    }
    "attachments" in t && (this._attachments = t.attachments ?? [], this._updateAttachments(), this._updateWaiting()), "finishReason" in t && this.setFinishReason(t.finishReason), ("contextSummary" in t || "compaction" in t) && this.setContextSummary(
      "contextSummary" in t ? t.contextSummary : this._contextSummary,
      "compaction" in t ? { legacy: t.compaction === !0 } : void 0
    );
  }
  /**
   * Draw, or remove, the note under a reply cut off at the model's length limit.
   *
   * Created here rather than in the shell markup: a custom shell written from the contract
   * has no such region, and the note is only ever wanted next to the content it qualifies.
   * A shell with no content region simply shows none (the same null-guarded degradation as
   * the other regions).
   */
  _updateFinishNote() {
    const t = this._finishReason === "length" && !this._streaming && this._role !== "user";
    let e = this.querySelector(".aparte-finish-note");
    if (!t) {
      e?.remove();
      return;
    }
    if (!e) {
      const s = this.querySelector(".aparte-message-content");
      if (!s) return;
      e = document.createElement("div"), e.className = "aparte-finish-note", s.after(e);
    }
    e.textContent = this._cfg.getLocale().responseCutOff ?? "Cut off at the model's length limit.";
  }
  /** This message was written by an older compaction, as the host said or as its `data-kind` stamp says. */
  _isLegacyCompaction() {
    return this._legacyCompaction ?? this.getAttribute("data-kind") === "compaction";
  }
  /**
   * What the separator should say, or `null` for none. A compaction in progress or
   * failed outranks what the message already carries: it is what is happening now.
   */
  _checkpointKind() {
    const t = this.getAttribute("data-checkpoint");
    return t === "pending" || t === "failed" ? t : this._contextSummary ? "done" : this._isLegacyCompaction() ? "legacy" : null;
  }
  /** The text the summary panel shows: the checkpoint's summary, or the older compaction message itself. */
  _checkpointSummaryText() {
    return this._contextSummary ? this._contextSummary.summary : this._content;
  }
  /**
   * Draw the separator above the message, or take it off.
   *
   * Written into the light DOM as the FIRST child of the bubble, outside `.aparte-message`:
   * a custom shell roots at that class and is free to be anything, and the separator is not
   * its to carry. Drawn from `_render` (so every frame gets it) and from every setter that
   * changes what it says. A re-sync that changes nothing — the framework host calls this on
   * every render of every bubble — finds the same signature and the element in place and
   * leaves both alone, so a keyboard user's focus and a scrolled summary are not lost to a
   * rebuild; one that does change something rebuilds it and puts the focus back on the
   * button that had it (or on `focus`, which a click that swaps the buttons names).
   *
   * A message an older compaction wrote is marked `data-superseded` on its own row: it
   * stays in the DOM and does not paint (bubble.css), the separator speaking for it.
   */
  _updateCheckpoint(t) {
    const e = this.querySelector(".aparte-message");
    if (!e) return;
    const s = this._checkpointKind();
    e.toggleAttribute("data-superseded", this._isLegacyCompaction() && !this._contextSummary);
    const r = this.querySelector(":scope > .aparte-checkpoint");
    if (!s) {
      const u = r && document.activeElement && r.contains(document.activeElement);
      r?.remove(), this._checkpointDrawn = "", u && (e.hasAttribute("tabindex") || e.setAttribute("tabindex", "-1"), e.focus({ preventScroll: !0 }));
      return;
    }
    const i = this.getAttribute("data-checkpoint-reason") ?? "", a = this._checkpointSummaryText(), o = JSON.stringify([
      s,
      this._contextSummary?.count,
      this._contextSummary?.createdAt,
      i,
      this._checkpointOpen,
      this._confirmingRestore,
      this._checkpointOpen ? a : ""
    ]);
    if (r && !t && o === this._checkpointDrawn) return;
    const l = document.activeElement, c = r && l && r.contains(l) ? l.getAttribute("data-checkpoint-action") : null, d = _g({
      kind: s,
      count: this._contextSummary?.count,
      reason: i,
      open: this._checkpointOpen,
      confirming: this._confirmingRestore,
      summaryId: this._checkpointId,
      locale: this._cfg.getLocale()
    });
    if (this._checkpointOpen && (s === "done" || s === "legacy")) {
      const u = d.querySelector(".aparte-checkpoint__summary");
      u && (u.innerHTML = this._cfg.renderMarkdown(a));
    }
    r ? r.replaceWith(d) : this.prepend(d), this._checkpointDrawn = o;
    const h = t ?? c;
    h && d.querySelector(`[data-checkpoint-action="${yt(h)}"]`)?.focus();
  }
  /**
   * The separator's buttons. One delegated listener on the bubble, for the reason the branch
   * picker has one: the separator is rebuilt on every change, and a listener per button would
   * be lost with it.
   */
  _onCheckpointClick = (t) => {
    const e = t.target?.closest?.("[data-checkpoint-action]"), s = e?.closest(".aparte-checkpoint");
    if (!(!e || !s || s.parentElement !== this) && !e.closest(".aparte-checkpoint__summary"))
      switch (e.getAttribute("data-checkpoint-action")) {
        case "toggle":
          this._checkpointOpen = !this._checkpointOpen, this._updateCheckpoint("toggle");
          break;
        case "restore":
          this._confirmingRestore = !0, this._updateCheckpoint("restore-confirm");
          break;
        case "restore-cancel":
          this._confirmingRestore = !1, this._updateCheckpoint("restore");
          break;
        case "restore-confirm": {
          this._confirmingRestore = !1;
          const r = this.getAttribute("message-id") ?? void 0;
          gg(this, { messageId: r, targetId: this._resolveTargetId() }), this.setContextSummary(null);
          break;
        }
        case "retry": {
          const r = this._resolveTargetId(), i = this._cfg.getCompactor();
          i ? i.compact({ target: jt(this), ...r ? { targetId: r } : {}, force: !0, reason: "retry" }) : window.dispatchEvent(new CustomEvent("aparte-compact", { detail: { targetId: r } }));
          break;
        }
      }
  };
  /** Escape withdraws Restore's question, the way it closes every other inline prompt here. */
  _onCheckpointKeydown = (t) => {
    if (t.key !== "Escape" || !this._confirmingRestore) return;
    const e = t.target?.closest?.(".aparte-checkpoint");
    !e || e.parentElement !== this || (t.stopPropagation(), this._confirmingRestore = !1, this._updateCheckpoint("restore"));
  };
  // ─────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────
  _appendSegmentEl(t) {
    if (!this._segmentsEl) {
      console.warn("[AparteChatBubble] _appendSegmentEl ABORT: _segmentsEl is null");
      return;
    }
    this._segments.length === 1 && (this._drawnWithVersion = Nt(this._cfg));
    const e = Yt(t.type, this._cfg);
    if (e) {
      const s = this._drawnAs(t, !0), r = Ue(gt(this._cfg, () => e.render(t)), t);
      r && (this._segmentsEl.appendChild(r), this._install(t, r, e, s));
    } else {
      const s = Ws(t);
      this._segmentsEl.appendChild(s), this._install(t, s, void 0);
    }
    this._contentEl && (this._contentEl.style.display = "none"), this._reflectError();
  }
  /** Whether a segment joins a turn's fold, is passed over by it, or ends it. */
  _turnRole(t) {
    if (t.type === "thinking") return "fold";
    if (t.type !== "tool_call") return "stop";
    const e = t;
    return this._cfg.isToolHidden(e.toolCall?.name ?? "") ? "skip" : e.status === "awaiting-approval" || e.status === "failed" || this._toolRendererFor(t) ? "stop" : "fold";
  }
  /** The fold a drawn row sits in, or null when it is a direct child. */
  _turnHolding(t) {
    const e = t?.parentElement?.parentElement;
    return e?.classList.contains("aparte-turn") && e.parentElement === this._segmentsEl ? e : null;
  }
  _createTurn() {
    const t = document.createElement("details");
    t.className = "aparte-turn aparte-accordion__item";
    const e = document.createElement("summary");
    e.className = "aparte-accordion__header aparte-turn__summary";
    const s = document.createElement("span");
    s.className = "aparte-turn__label";
    const r = document.createElement("span");
    r.className = "aparte-turn__current";
    const i = document.createElement("span");
    i.className = "aparte-accordion__icon", i.innerHTML = this._cfg.getIcon("expand"), e.append(s, r, i), e.addEventListener("click", () => {
      t.dataset.touched = "";
    });
    const a = document.createElement("div");
    return a.className = "aparte-accordion__panel aparte-turn__body", t.append(e, a), t;
  }
  /**
   * Fold each run of steps behind its line, by moving the rows already drawn: a moved
   * `<details>` keeps its open state, a redraw would lose it. Called whenever the plan can
   * change, never per token. A fold is found again by its members, not by its place, so one
   * that grows or splits keeps its own open state.
   */
  _syncTurns() {
    const t = this._segmentsEl;
    if (!t || this._releasedWhileDetached) return;
    const e = this._cfg.getTurnSummary(), s = e ? og(this._segments, (c) => this._turnRole(c)) : [];
    if (s.length === 0 && !t.querySelector(":scope > .aparte-turn")) return;
    const r = (c, d, h) => {
      const u = h ? h.nextSibling : c.firstChild;
      return d !== u && c.insertBefore(d, u), d;
    }, i = (c) => this._drawn.get(c.id)?.el, a = /* @__PURE__ */ new Set(), o = new Map(s.map((c) => [c.from, c]));
    let l = null;
    for (let c = 0; c < this._segments.length; c += 1) {
      const d = o.get(c);
      if (!d) {
        const g = i(this._segments[c]);
        g && (l = r(t, g, l));
        continue;
      }
      const h = this._segments.slice(d.from, d.to + 1), p = h.map((g) => this._turnHolding(i(g))).find((g) => g && !a.has(g)) ?? this._createTurn();
      a.add(p), l = r(t, p, l);
      const f = p.querySelector(":scope > .aparte-turn__body");
      let _ = null;
      for (const g of h) {
        const v = i(g);
        v && (_ = r(f, v, _));
      }
      this._labelTurn(p, h, d.to === this._segments.length - 1, e?.openWhileRunning === !0), c = d.to;
    }
    for (const c of t.querySelectorAll(":scope > .aparte-turn"))
      a.has(c) || c.remove();
  }
  /** The fold's one line: what it is doing while it works, what it did once it has. */
  _labelTurn(t, e, s, r) {
    const i = this._cfg, a = e.filter((h) => this._turnRole(h) === "fold"), o = a.filter((h) => h.type === "tool_call"), l = this._streaming && s || o.some((h) => !de(h)), c = t.querySelector(":scope > summary > .aparte-turn__label"), d = t.querySelector(":scope > summary > .aparte-turn__current");
    c.classList.toggle("aparte-shimmer", l), c.textContent = l ? i.t("turnWorking") : this._turnOutcome(a, o.length), d.textContent = l && o.length > 0 ? this._stepName(o.at(-1)) : "", r && !("touched" in t.dataset) && (t.open = l);
  }
  _turnOutcome(t, e) {
    const s = this._cfg, r = s.getLocale().tag || void 0, i = e > 0 ? tg(s.t("turnTools"), e, r) : "", a = lg(t);
    if (a !== void 0) {
      const o = s.t("turnWorked").replace("{duration}", () => Ml(a, r));
      return i ? `${o} · ${i}` : o;
    }
    return i ? s.t("turnUsed").replace("{tools}", () => i) : s.t("thought");
  }
  /** What a call goes by on screen — the name its row shows, through the same function. */
  _stepName(t) {
    return Kr(t, this._cfg).text;
  }
  _applySegmentUpdate(t, e, s) {
    const r = this._segmentsEl ? In(this._segmentsEl, t) : null;
    if (!r) {
      this._renderSegments();
      return;
    }
    if (this._releasedWhileDetached) return;
    const i = Yt(e.type, this._cfg);
    if (!i) return;
    const a = this._drawn.get(t);
    if (a && a.renderer !== i) {
      a.segment = e, this._redrawSegment(e);
      return;
    }
    if (i.update) {
      gt(this._cfg, () => i.update(r, e));
      const o = this._drawn.get(t);
      if (o) {
        o.segment = e;
        const l = this._segmentsEl ? In(this._segmentsEl, t) : null;
        l && l !== o.el && (o.el = l, o.tool = to(e, l));
      }
    } else {
      const o = Ue(gt(this._cfg, () => i.render(e)), e);
      o && (this._release(t), r.replaceWith(o), this._install(e, o, i));
    }
    "collapsed" in s && (s.collapsed ? r.removeAttribute("open") : r.setAttribute("open", ""));
  }
  _getDisplayName() {
    const t = this.getAttribute("name");
    if (t) return t;
    const e = this._cfg.getLocale();
    return this._role === "user" ? e.roleNameUser ?? "You" : e.roleNameAssistant ?? "Assistant";
  }
  _getAvatarInitial() {
    const t = this._getDisplayName();
    return t.length > 0 ? t[0] : this._role === "user" ? "U" : "A";
  }
  _render() {
    const t = this.getAttribute("data-role"), e = t === "user" || t === "assistant" ? t : "assistant";
    if (this._role = e, this.getAttribute("role") !== "article" && this.setAttribute("role", "article"), this.hasAttribute("data-role") || this.setAttribute("data-role", e), this.querySelector(".aparte-message")) return;
    const s = this._getDisplayName(), r = this._getAvatarInitial(), i = this._cfg.getBubbleShellRenderer?.();
    if (this._drawnShell = i ?? null, this._avatarFromProvider = !1, this._wroteRootLabel = this._wroteBarLabel = this._wroteArrowLabels = !i, i) {
      const o = gt(this._cfg, () => i({ role: this._role, name: s, avatarInitial: r }));
      o instanceof HTMLElement ? this.replaceChildren(o) : this.innerHTML = o;
    } else
      this.innerHTML = `
      <div class="aparte-message" data-role="${D(e)}" role="article" aria-label="${D(this._getAriaLabel())}">
        <div class="aparte-avatar" data-role="${D(e)}"></div>
        <div class="aparte-body">
          <div class="aparte-header">
            <span class="aparte-name">${q(s)}</span>
            <span class="aparte-timestamp"></span>
          </div>
          <div class="aparte-attachments" hidden></div>
          <div class="aparte-message-content">
            <div class="aparte-segments"></div>
            <div class="aparte-content" dir="auto"></div>
            <div class="aparte-waiting" hidden>
              <span class="aparte-dots" aria-hidden="true"><span class="aparte-dot"></span><span class="aparte-dot"></span><span class="aparte-dot"></span></span>
              <span class="aparte-waiting-step aparte-shimmer" aria-hidden="true" dir="auto" hidden></span>
              <span class="aparte-sr-only" aria-live="polite">${q(this._cfg.getLocale().typing ?? "")}</span>
            </div>
          </div>
          <div class="aparte-footer">
            <div class="aparte-branch-picker" hidden>
              <button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-branch-prev" aria-label="${D(this._cfg.getLocale().previousResponse ?? "Previous response")}">${this._cfg.getIcon("prevBranch")}</button>
              <span class="aparte-branch-label">1 / 1</span>
              <!-- The move has to be ANNOUNCED. Pressing the arrows deliberately does not
                   take focus, so without a live region a screen-reader user gets the new
                   branch and no indication anything changed. The visible label cannot be
                   the region itself: a custom sibling-nav renderer may replace it with
                   dots, which reads as nothing. No new locale key — the position is
                   digits, and the buttons beside it already carry translated labels. -->
              <span class="aparte-sr-only aparte-branch-status" aria-live="polite"></span>
              <button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-branch-next" aria-label="${D(this._cfg.getLocale().nextResponse ?? "Next response")}">${this._cfg.getIcon("nextBranch")}</button>
            </div>
            <div class="aparte-action-bar" role="toolbar" aria-label="${D(this._cfg.getLocale().messageActions ?? "Message actions")}"></div>
          </div>
        </div>
      </div>
    `;
    const a = this.querySelector(".aparte-message");
    if (a && !a.hasAttribute("role") && (a.setAttribute("role", "article"), a.setAttribute("aria-label", this._getAriaLabel()), this._wroteRootLabel = !0), this._contentEl = this.querySelector(".aparte-content"), this._segmentsEl = this.querySelector(".aparte-segments"), this._attachmentsEl = this.querySelector(".aparte-attachments"), this._actionBarEl = this.querySelector(".aparte-action-bar"), this._actionBarEl && !this._actionBarEl.hasAttribute("role") && (this._actionBarEl.setAttribute("role", "toolbar"), this._actionBarEl.hasAttribute("aria-label") || (this._actionBarEl.setAttribute("aria-label", this._cfg.getLocale().messageActions ?? "Message actions"), this._wroteBarLabel = !0)), i) {
      const o = this.querySelector(".aparte-branch-prev"), l = this.querySelector(".aparte-branch-next"), c = (h) => {
        let u = "";
        const p = h.ownerDocument.createTreeWalker(h, NodeFilter.SHOW_TEXT);
        for (let f = p.nextNode(); f; f = p.nextNode()) {
          const _ = f.parentElement?.closest('[aria-hidden="true"], [hidden]');
          (!_ || !h.contains(_)) && (u += f.textContent ?? "");
        }
        return u;
      }, d = (h) => !!h && (h.hasAttribute("aria-label") || h.hasAttribute("aria-labelledby") || h.hasAttribute("title") || /\p{L}/u.test(c(h)));
      if ((o || l) && !d(o) && !d(l)) {
        const h = this._cfg.getLocale();
        o?.setAttribute("aria-label", h.previousResponse ?? "Previous response"), l?.setAttribute("aria-label", h.nextResponse ?? "Next response"), this._wroteArrowLabels = !0;
      }
    }
    this._actionBarEl?.addEventListener("keydown", this._onActionBarKeydown), this._branchPickerEl = this.querySelector(".aparte-branch-picker"), this._footerEl = this.querySelector(".aparte-footer"), this._transcriptBusy = !!this.closest("aparte-chat-viewport")?.hasAttribute("data-busy"), this._updateActionBar(), this._renderAvatar(), this._streaming && this._updateStreaming(!0), this._updateWaiting(), this._updateFinishNote(), this._updateCheckpoint();
  }
  /**
   * Show the built-in waiting indicator while this bubble is in flight and has
   * nothing to show yet — the gap between "user sends" and the first token.
   *
   * The dots are CSS (no per-token work, themable, honours reduced-motion); the
   * accessible name is `locale.typing`, next to the `aria-busy` the streaming state
   * already sets. A custom bubble shell without the region simply has no indicator
   * (same null-guarded degradation as the other region hooks).
   */
  _updateWaiting() {
    const e = !(this._segmentsEl ? Array.from(this._segmentsEl.children).some((_) => !_.hidden) : this._segments.length > 0) && !this._content.trim(), s = this._segments.at(-1), r = this._segmentsEl?.lastElementChild, i = s?.type === "tool_call" && s.status === "awaiting-approval", a = s?.type === "tool_call" && (de(s) || r?.hidden === !0) && r?.classList.contains("aparte-turn") !== !0, o = this._streaming && this._role !== "user" && !i && (e || a), l = this.querySelector(".aparte-message-content");
    l && (l.hidden = e && !o);
    const c = this.querySelector(".aparte-message");
    c && c.toggleAttribute("data-empty", e && !this._streaming && this._attachments.length === 0);
    const d = this.querySelector(".aparte-waiting");
    if (!d) return;
    d.hidden = !o;
    const h = o ? this._step : null;
    let u = d.querySelector(".aparte-waiting-step");
    if (!u && h) {
      u = document.createElement("span"), u.className = "aparte-waiting-step aparte-shimmer", u.setAttribute("aria-hidden", "true"), u.dir = "auto";
      const _ = d.querySelector(".aparte-dots");
      _ ? _.after(u) : d.prepend(u);
    }
    if (u && (u.hidden = !h, h && u.textContent !== h && (u.textContent = h)), !o) return;
    const p = h ?? this._cfg.getLocale().typing, f = d.querySelector(".aparte-sr-only");
    f && f.textContent !== p && (f.textContent = p);
  }
  /**
   * Hand the avatar host element off to the registered AvatarProvider, if any.
   *
   * With no provider the slot keeps what the shell rendered — for the default shell,
   * nothing, hidden while empty — and loses what a provider drew there before. An empty
   * slot still shows when the stylesheet names a picture for its role
   * (`--aparte-avatar-image-user` / `-assistant`): see `_markAvatarImage`.
   */
  _renderAvatar() {
    const t = this.querySelector(".aparte-avatar");
    if (!t) return;
    if (this._avatarCleanup) {
      try {
        this._avatarCleanup();
      } catch {
      }
      this._avatarCleanup = null;
    }
    const e = this._cfg.getAvatarProvider();
    if (!e) {
      this._avatarFromProvider && (t.replaceChildren(), this._avatarFromProvider = !1), this._markAvatarImage(t);
      return;
    }
    t.textContent = "";
    const s = e.render(this._role, t);
    this._avatarFromProvider = !0, typeof s == "function" && (this._avatarCleanup = s), this._markAvatarImage(t);
  }
  /**
   * A picture from the stylesheet alone: an empty slot whose role's `--aparte-avatar-image-*`
   * names an image gets `data-image`, which lifts the rule that hides an empty slot. Hidden
   * while empty, the token painted nothing. Read when the message is drawn and on every
   * config change, in a batch with the other bubbles' (see `pendingAvatarMarks`).
   */
  _markAvatarImage(t) {
    if (t.firstChild) {
      en.delete(t), t.removeAttribute("data-image");
      return;
    }
    en.size === 0 && queueMicrotask(bg), en.set(t, { bubble: this, role: this._role });
  }
  _updateRole() {
    const t = this.querySelector(".aparte-message"), e = this.querySelector(".aparte-avatar"), s = this.querySelector(".aparte-name");
    t && (t.setAttribute("data-role", this._role), this._wroteRootLabel && t.getAttribute("role") === "article" && t.setAttribute("aria-label", this._getAriaLabel())), e && (e.setAttribute("data-role", this._role), e.textContent && !this._avatarFromProvider && (e.textContent = this._getAvatarInitial())), s && (s.textContent = this._getDisplayName()), this._updateActionBar(), this._renderAvatar();
  }
  _updateName() {
    const t = this.querySelector(".aparte-avatar"), e = this.querySelector(".aparte-name");
    t && t.textContent && !this._cfg.getAvatarProvider() && !this._avatarFromProvider && (t.textContent = this._getAvatarInitial()), e && (e.textContent = this._getDisplayName());
    const s = this.querySelector(".aparte-message");
    this._wroteRootLabel && s?.getAttribute("role") === "article" && s.setAttribute("aria-label", this._getAriaLabel());
  }
  _updateContent() {
    if (this._contentEl) {
      if (this._segments.length > 0) {
        this._contentEl.style.display = "none", this._updateWaiting();
        return;
      }
      this._drawnWithVersion = Nt(this._cfg), this._contentEl.style.display = "", gt(
        this._cfg,
        () => an(this, this._contentEl, this._content, this._streaming)
      ), this._drawTokens(), this._updateWaiting(), this._streaming || this._highlightContentCode();
    }
  }
  /**
   * Apply the registered syntax-highlight provider to the code blocks produced
   * by the Markdown provider in the simple-content path. Provider-agnostic: a
   * full-block provider (e.g. Shiki) returns `<pre>…</pre>` so we replace the
   * element; a token provider (e.g. Prism, highlight.js) returns inner HTML so
   * we fill the existing `<code>`. No-op when no highlighter is installed.
   */
  _highlightContentCode() {
    !this._contentEl || !this._cfg.hasHighlightProvider() || this._contentEl.querySelectorAll("pre > code:not([data-aparte-highlighted])").forEach((t) => {
      const e = t.textContent ?? "";
      if (!e.trim()) return;
      const r = t.className.match(/language-([\w+#-]+)/i)?.[1] ?? "";
      if (this._cfg.hasCodeLanguageRenderer(r) || t.closest(".aparte-code-drawing")) return;
      const i = t.parentElement;
      t.setAttribute("data-aparte-highlighted", ""), Promise.resolve(this._cfg.highlightCode(e, r, { fallback: !1 })).then((a) => {
        const o = (a ?? "").trim();
        !o || !i || !this._contentEl?.contains(i) || (/^<pre[\s>]/i.test(o) ? Ll(i, o) : t.innerHTML = o);
      }).catch(() => {
        t.removeAttribute("data-aparte-highlighted");
      });
    });
  }
  _renderSegments() {
    if (this._segmentsEl) {
      this._drawnWithVersion = Nt(this._cfg), this._releaseAll(), this._segmentsEl.innerHTML = "";
      for (const t of this._segments) {
        const e = Yt(t.type, this._cfg);
        if (e) {
          const s = this._drawnAs(t), r = Ue(gt(this._cfg, () => e.render(t)), t);
          r && (this._segmentsEl.appendChild(r), this._install(t, r, e, s));
        } else {
          const s = Ws(t);
          this._segmentsEl.appendChild(s), this._install(t, s, void 0);
        }
      }
      this._syncTurns(), this._contentEl && (this._contentEl.style.display = this._segments.length > 0 ? "none" : ""), this._reflectError(), this._syncCopyAction(), this._syncSources();
    }
  }
  /**
   * Reflect the error state on the bubble: `data-error` on `.aparte-message` while
   * an error segment is present. Derived from segments (not the message `status`
   * attribute) so it works identically in vanilla and in every wrapper — the
   * error segment flows through the reactive list in all of them. CSS themes
   * `.aparte-message[data-error]`; custom error content is via setErrorRenderer.
   */
  _reflectError() {
    const t = this.querySelector(".aparte-message");
    if (!t) return;
    this._segments.some((s) => s.type === "error") ? t.setAttribute("data-error", "") : t.removeAttribute("data-error");
  }
  _updateTimestamp(t) {
    const e = this.querySelector(".aparte-timestamp");
    if (!(!e || !t))
      try {
        const s = new Date(isNaN(Number(t)) ? t : Number(t));
        e.textContent = s.toLocaleTimeString(this._cfg.getLocale().tag || void 0, {
          hour: "2-digit",
          minute: "2-digit"
        });
      } catch {
        e.textContent = "";
      }
  }
  /**
   * Named after its author when it has one: a `name` on the bubble is who wrote it (a human
   * agent answering on the assistant's side, a second assistant), and naming every one of
   * them "Assistant response" told a screen-reader user the opposite of what the page shows.
   * Without a name, the role names it.
   */
  _getAriaLabel() {
    const t = this._cfg.getLocale(), e = this.getAttribute("name");
    return e ? (t.messageFrom || "Message from {name}").replace("{name}", () => e) : this._role === "user" ? t.yourMessage ?? "Your message" : t.assistantResponse ?? "Assistant response";
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Attachments
  // ─────────────────────────────────────────────────────────────────────────
  _updateAttachments() {
    if (!this._attachmentsEl) return;
    if (this._role !== "user" || this._attachments.length === 0) {
      this._attachmentsEl.hidden = !0, this._attachmentsEl.innerHTML = "";
      return;
    }
    this._attachmentsEl.hidden = !1;
    const t = this._cfg.getAttachmentRenderer?.();
    if (t) {
      this._attachmentsEl.replaceChildren();
      for (const i of this._attachments) {
        const a = Ue(gt(this._cfg, () => t(i)));
        a && this._attachmentsEl.appendChild(a);
      }
      return;
    }
    this._attachmentsEl.innerHTML = this._attachments.map((i) => {
      const a = q(i.name);
      if (i.type.startsWith("image/") && this._isShowableUrl(i.url))
        return `<div class="aparte-thumbnail aparte-thumb aparte-thumb--image" title="${a}" data-type="${q(i.type)}"><img class="aparte-thumbnail__image" src="${q(i.url)}" alt="${a}" loading="lazy" /><span class="aparte-thumb__name">${a}</span></div>`;
      const o = this._isOpenableUrl(i.url) ? ` data-url="${q(i.url)}"` : "";
      return `<div class="aparte-thumbnail aparte-thumb aparte-thumb--file" title="${a}" data-type="${q(i.type)}"${o}><span class="aparte-thumbnail__label">${q(this._fileExt(i.name))}</span><span class="aparte-thumb__name">${a}</span></div>`;
    }).join("");
    const { attachmentPreview: e, filePreview: s } = this._cfg.getHostHandlers(), r = [e ? ".aparte-thumb--image" : "", s ? ".aparte-thumb--file[data-url]" : ""].filter(Boolean);
    r.length !== 0 && this._attachmentsEl.querySelectorAll(r.join(", ")).forEach((i) => {
      i.setAttribute("role", "button"), i.setAttribute("tabindex", "0");
      const a = () => {
        const o = i.querySelector(".aparte-thumbnail__image")?.src ?? i.dataset.url;
        o && this.dispatchEvent(new CustomEvent("aparte-attachment-preview", {
          bubbles: !0,
          composed: !0,
          detail: { url: o, name: i.getAttribute("title") ?? "", type: i.dataset.type ?? "" }
        }));
      };
      i.addEventListener("click", a), i.addEventListener("keydown", (o) => {
        const l = o.key;
        l !== "Enter" && l !== " " || (o.preventDefault(), a());
      });
    });
  }
  /** Uppercased file extension (≤4 chars), or 'FILE' when there is none. */
  /**
   * The same answer `copyAttributes` gives before it writes an `src`, plus `blob:`.
   *
   * An attachment's `url` is documented as "URL or data URI" and a storage adapter
   * re-mints it when a conversation is restored, so it is the app's value, not the
   * composer's — and, like every other URL core emits, it is asked whether its SCHEME
   * is allowed at all. A picture whose URL is refused is not half-rendered: it falls
   * back to the file chip, which still names the file.
   *
   * `blob:` is added because it is the shape core itself mints — `filesToAttachments`
   * calls `URL.createObjectURL`, and `AparteMessage.attachments` documents the same
   * on hydration. `isSafeUrl` refuses it, and rightly: that list governs MODEL
   * markup, which has no way to make a blob URL resolve.
   */
  _isShowableUrl(t) {
    return t ? ls(t, "img") || /^blob:/i.test(t.trim()) : !1;
  }
  /** A URL a browser opens in a tab: its own object URL, or a remote one. Never a data: URL, which a tab refuses. */
  _isOpenableUrl(t) {
    return !!t && /^(https?:|blob:)/i.test(t.trim());
  }
  _fileExt(t) {
    const e = t.lastIndexOf(".");
    return e > 0 ? t.slice(e + 1).toUpperCase().slice(0, 4) : "FILE";
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Branch Picker
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * The branch arrows are handled by DELEGATION, on this element, bound once.
   *
   * The listener lives on the host, which is never replaced, and `closest()` finds
   * whichever button exists at the moment of the click — so a click that lands while
   * a re-render is swapping the buttons is not lost.
   *
   * Bound in `connectedCallback` and removed in `disconnectedCallback` as a stable
   * field, so a re-connect never stacks listeners.
   */
  _onBranchPickerClick = (t) => {
    const s = t.target?.closest?.(".aparte-branch-prev, .aparte-branch-next");
    if (!s || !this.contains(s)) return;
    const r = s.classList.contains("aparte-branch-prev") ? "prev" : "next", i = this.getAttribute("message-id");
    if (!i) return;
    const a = { messageId: i, direction: r };
    this.dispatchEvent(new CustomEvent("aparte-branch-navigate", {
      bubbles: !0,
      composed: !0,
      detail: a
    }));
  };
  /**
   * A link the MODEL wrote is about to be followed. Announced as a cancelable event
   * before the browser acts, so a host can route it — an external browser, a
   * confirmation, an embedded view — without intercepting the DOM. With
   * no listener the browser follows it, which the sanitizer has already made open in
   * a new tab for an external URL; `preventDefault()` on the event cancels the click.
   *
   * Only anchors inside the message body: the action bar and the branch picker are
   * buttons, and an attachment tile is its own event.
   */
  _onLinkClick = (t) => {
    const s = t.target?.closest?.("a[href]");
    if (!s || !this.contains(s)) return;
    const r = {
      href: s.getAttribute("href") ?? "",
      anchor: s,
      messageId: this.getAttribute("message-id")
    };
    this.dispatchEvent(new CustomEvent("aparte-link-click", {
      bubbles: !0,
      composed: !0,
      cancelable: !0,
      detail: r
    })) || t.preventDefault();
  };
  /**
   * Whether a reply is streaming somewhere in this bubble's transcript. Set by the
   * viewport (`data-busy` on it, pushed here), read once on connect for a bubble
   * mounted while the flag was already up. While busy, the branch arrows and the
   * retry/edit actions are disabled — the transcript is read-only except for Stop.
   */
  _transcriptBusy = !1;
  setTranscriptBusy(t) {
    this._transcriptBusy !== t && (this._transcriptBusy = t, this._applyTranscriptBusy(), this._updateBranchPicker());
  }
  _applyTranscriptBusy() {
    if (this._actionBarEl)
      for (const t of this._actionBarEl.querySelectorAll('[data-action="retry"], [data-action="edit"]'))
        t.disabled = this._transcriptBusy;
  }
  _updateBranchPicker() {
    if (!this._branchPickerEl) return;
    if (this._siblingCount <= 1 || this._role !== "assistant") {
      this._branchPickerEl.hidden = !0, this._syncFooterVisibility();
      return;
    }
    this._branchPickerEl.hidden = !1, this._syncFooterVisibility();
    const t = this._branchPickerEl.querySelector(".aparte-branch-label");
    if (t) {
      const i = this._cfg.getSiblingNavRenderer?.();
      if (i) {
        const a = gt(this._cfg, () => i({ count: this._siblingCount, index: this._siblingIndex }));
        a instanceof HTMLElement ? t.replaceChildren(a) : t.innerHTML = a;
      } else
        t.textContent = `${this._siblingIndex + 1} / ${this._siblingCount}`;
    }
    const e = this._branchPickerEl.querySelector(".aparte-branch-status");
    if (e) {
      const i = `${this._siblingIndex + 1} / ${this._siblingCount}`;
      e.textContent !== i && (e.textContent = i);
    }
    const s = this._branchPickerEl.querySelector(".aparte-branch-prev"), r = this._branchPickerEl.querySelector(".aparte-branch-next");
    s && (s.disabled = this._transcriptBusy || this._siblingIndex === 0), r && (r.disabled = this._transcriptBusy || this._siblingIndex === this._siblingCount - 1);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Action Bar
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * What the copy action copies: the reply, not the reasoning. A `thinking` segment is
   * the model's scratchpad, and the client already keeps it out of the history it sends
   * back (`segmentsToWireText`) for the same reason — copying it along with the answer
   * pasted a paragraph of deliberation above every reply, which no assistant on the
   * market does. Segments with no `content` (a tool call) contribute nothing, so a
   * turn made only of those copies as `''` — and the action bar reads this to decide
   * whether to offer the button at all.
   */
  _copyableText() {
    return (this._content || this._segments.filter((t) => t.type !== "thinking" && t.type !== "activity").map((t) => t.content ?? "").join(`
`)).trim();
  }
  /**
   * The copy button is for text. `hidden` rather than removed: the bar is rebuilt
   * rarely and the text changes on every streamed token, so the button is toggled in
   * place from each path that changes what a copy would paste.
   */
  _syncCopyAction() {
    const t = this._actionBarEl?.querySelector(".aparte-action-copy");
    t && (t.hidden = this._copyableText() === "");
  }
  _updateActionBar() {
    if (!this._actionBarEl) return;
    if (this._editing) {
      this._renderEditActions();
      return;
    }
    const t = this._cfg.getBubbleActions(), e = this._cfg.getIconProvider(), s = this._cfg.getLocale(), r = [];
    if (this._role === "user")
      if (t.user)
        for (const i of t.user) r.push(this._actionButtonHtml(i, e, s));
      else
        t.copy && r.push(this._actionButtonHtml("copy", e, s)), t.edit && r.push(this._actionButtonHtml("edit", e, s));
    else if (this._role === "assistant")
      if (t.assistant)
        for (const i of t.assistant) r.push(this._actionButtonHtml(i, e, s));
      else
        t.copy && r.push(this._actionButtonHtml("copy", e, s)), t.retry && r.push(this._actionButtonHtml("retry", e, s)), t.feedback && (r.push(this._actionButtonHtml("thumbUp", e, s)), r.push(this._actionButtonHtml("thumbDown", e, s))), t.info && r.push(this._actionButtonHtml("info", e, s));
    this._actionBarEl.innerHTML = r.join(""), this._syncCopyAction(), this._appendCustomActions(), this._applyTranscriptBusy(), this._actionBarEl.querySelectorAll(".aparte-action-btn").forEach((i) => {
      i.addEventListener("click", (a) => this._handleActionClick(a));
    }), this._syncFooterVisibility();
  }
  /**
   * `role="toolbar"` promises a keyboard model. This is it.
   *
   * A toolbar is ONE tab stop whose members are reached with the arrow keys — that is
   * the whole of what the role means to a screen-reader user. Without it, tabbing
   * through a long transcript would walk every button of every message.
   *
   * The roving index is re-applied from `_syncFooterVisibility`, which is the single
   * funnel all three build paths run through (the flag-driven bar, the edit bar, and
   * the branch picker's own visibility pass). Re-deriving it there rather than in each
   * builder keeps the invariant true after a `setBubbleActions` rebuild.
   *
   * DISABLED buttons are skipped, not merely un-tabbable: while the transcript is busy
   * retry and edit are disabled, and a toolbar whose arrows stop on a dead control
   * reads as broken. If every button is disabled the bar keeps one tab stop anyway, so
   * focus sitting there when the turn ends is not thrown to the top of the page.
   */
  _rovingButtons() {
    return this._actionBarEl ? [...this._actionBarEl.querySelectorAll("button")] : [];
  }
  _setRovingIndex() {
    const t = this._rovingButtons();
    if (!t.length) return;
    const e = t.filter((i) => !i.disabled), r = t.find((i) => i.tabIndex === 0 && !i.disabled) ?? e[0] ?? t[0];
    for (const i of t) i.tabIndex = i === r ? 0 : -1;
  }
  /**
   * Left/Right walk the bar, Home/End jump to its ends, and both wrap.
   *
   * Arrow keys follow the READING direction, per the ARIA practices: in an RTL
   * transcript Left is "next". `dir` is resolved from the nearest ancestor that sets
   * it — the viewport writes it from `locale.direction` — because a bubble has none of
   * its own and `getComputedStyle` is not something jsdom can answer.
   */
  _onActionBarKeydown = (t) => {
    const e = t;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const r = this._rovingButtons().filter((d) => !d.disabled);
    if (r.length === 0) return;
    const i = document.activeElement, a = r.findIndex((d) => d === i);
    if (a === -1 && e.key !== "Home" && e.key !== "End") return;
    const l = (this.closest("[dir]")?.getAttribute("dir") ?? document.documentElement.dir) === "rtl" ? "ArrowLeft" : "ArrowRight";
    let c;
    e.key === "Home" ? c = 0 : e.key === "End" ? c = r.length - 1 : e.key === l ? c = (a + 1) % r.length : c = (a - 1 + r.length) % r.length, e.preventDefault();
    for (const d of this._rovingButtons()) d.tabIndex = d === r[c] ? 0 : -1;
    r[c]?.focus();
  };
  /**
   * An empty action bar is not a bar: with every action off it would be a
   * `role="toolbar"` with nothing in it (announced as such) that still reserves its
   * fixed height plus the footer's under every bubble. So both follow their
   * contents — the footer stays as long as the branch picker or the bar has
   * something to show.
   */
  _syncFooterVisibility() {
    if (this._actionBarEl && (this._actionBarEl.hidden = this._actionBarEl.children.length === 0), this._setRovingIndex(), !this._footerEl) return;
    const t = !this._actionBarEl || this._actionBarEl.hidden, e = !this._branchPickerEl || this._branchPickerEl.hidden;
    this._footerEl.hidden = t && e, this.querySelector(".aparte-message")?.toggleAttribute("data-branches", !e);
  }
  /** Append the registered custom action buttons for this bubble's role. */
  _appendCustomActions() {
    if (this._actionBarEl)
      for (const t of this._cfg.getActions("bubble")) {
        if (!(t.bubble?.roles ?? ["user", "assistant"]).includes(this._role)) continue;
        const s = document.createElement("button");
        s.type = "button", s.className = "aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-custom", s.dataset.action = `custom:${t.id}`, s.setAttribute("aria-label", t.label), s.setAttribute("title", t.label), s.innerHTML = t.icon.startsWith("<") ? t.icon : this._cfg.getIcon(t.icon) ?? t.iconFallback ?? "", this._actionBarEl.appendChild(s);
      }
  }
  /** Build the `<button>` HTML for a single named action (shared by flag + per-role rendering). */
  _actionButtonHtml(t, e, s) {
    switch (t) {
      case "copy": {
        const r = s.copy ?? "Copy";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-copy" data-action="copy" aria-label="${D(r)}" title="${D(r)}">${e.copy()}</button>`;
      }
      case "edit": {
        const r = s.edit ?? "Edit message";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-edit" data-action="edit" aria-label="${D(r)}" title="${D(r)}">${e.edit()}</button>`;
      }
      case "retry": {
        const r = s.retry ?? "Retry";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-retry" data-action="retry" aria-label="${D(r)}" title="${D(r)}">${e.retry()}</button>`;
      }
      case "thumbUp": {
        const r = s.feedbackPositive ?? "Good response";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-feedback-pos" data-action="feedback-positive" aria-label="${D(r)}" title="${D(r)}">${e.thumbUp()}</button>`;
      }
      case "thumbDown": {
        const r = s.feedbackNegative ?? "Bad response";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-feedback-neg" data-action="feedback-negative" aria-label="${D(r)}" title="${D(r)}">${e.thumbDown()}</button>`;
      }
      case "info": {
        if (!this._usage) return "";
        const r = s.messageInfo ?? "Details";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-info" data-action="info" aria-label="${D(r)}" title="${D(r)}">${this._cfg.getIcon("info")}</button>`;
      }
      default:
        return "";
    }
  }
  /** Render the edit-mode action bar: ✓ save (green) + ✗ cancel (red). */
  _renderEditActions() {
    if (!this._actionBarEl) return;
    const t = this._cfg.getLocale(), e = t.editConfirm ?? "Save", s = t.editCancel ?? "Cancel";
    this._actionBarEl.innerHTML = `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-btn--success aparte-action-btn aparte-action-edit-save" data-action="edit-save" aria-label="${D(e)}" title="${D(e)}">${this._cfg.getIcon("check")}</button><button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-btn--danger aparte-action-btn aparte-action-edit-cancel" data-action="edit-cancel" aria-label="${D(s)}" title="${D(s)}">${this._cfg.getIcon("close")}</button>`, this._actionBarEl.querySelectorAll(".aparte-action-btn").forEach((r) => {
      r.addEventListener("click", (i) => this._handleActionClick(i));
    }), this._syncFooterVisibility();
  }
  _handleActionClick(t) {
    const e = t.currentTarget, s = e.dataset.action, r = this.getAttribute("message-id");
    if (s?.startsWith("custom:") && r) {
      const i = s.slice(7), a = {
        actionId: i,
        zone: "bubble",
        messageId: r,
        role: this._role,
        targetId: this._resolveTargetId()
      };
      this.dispatchEvent(new CustomEvent("aparte-action", {
        bubbles: !0,
        composed: !0,
        detail: a
      })), this._cfg.getActions("bubble").find((o) => o.id === i)?.onClick?.(t);
      return;
    }
    switch (s) {
      case "copy": {
        const i = this._copyableText(), a = this._cfg.getIconProvider(), o = this._cfg.getLocale();
        Ol(i).then(() => {
          e.innerHTML = a.check(), e.setAttribute("data-copied", "");
          const l = o.copied ?? o.copy ?? "Copied";
          e.setAttribute("title", l), e.setAttribute("aria-label", l), setTimeout(() => {
            e.removeAttribute("data-copied"), e.innerHTML = a.copy();
            const c = o.copy ?? "Copy";
            e.setAttribute("title", c), e.setAttribute("aria-label", c);
          }, 2e3);
        }).catch(() => {
          console.warn("[aparte] Clipboard write failed");
        });
        break;
      }
      case "retry": {
        if (!r) break;
        const i = this._resolveTargetId(), a = { messageId: r, targetId: i };
        this.dispatchEvent(new CustomEvent("aparte-retry", {
          bubbles: !0,
          composed: !0,
          detail: a
        }));
        break;
      }
      case "edit": {
        this._enterEditMode();
        break;
      }
      case "edit-save": {
        this._exitEditMode(!0);
        break;
      }
      case "edit-cancel": {
        this._exitEditMode(!1);
        break;
      }
      case "feedback-positive":
      case "feedback-negative": {
        if (!r) break;
        const i = s === "feedback-positive" ? "positive" : "negative";
        e.setAttribute("data-submitted", "");
        const a = { messageId: r, value: i };
        this.dispatchEvent(new CustomEvent("aparte-feedback", {
          bubbles: !0,
          composed: !0,
          detail: a
        })), i === "negative" ? this._askFeedbackReason(r) : this.querySelector(".aparte-feedback-reasons")?.remove();
        break;
      }
      case "info": {
        if (!r) break;
        const i = {
          messageId: r,
          usage: this._usage ?? void 0
        };
        this.dispatchEvent(new CustomEvent("aparte-message-info", {
          bubbles: !0,
          composed: !0,
          detail: i
        }));
        break;
      }
    }
  }
  /**
   * Open the inline editor for a user message. Idempotent — a second `edit`
   * click while already editing is a no-op (no stacked editors).
   *
   * The editor reuses the composer's contenteditable primitive
   * (`<aparte-composer-input>`) so editing is iso with composing: same autosize,
   * IME, paste and styling. With no `<aparte-composer>` root it runs standalone —
   * `Enter` (Shift+Enter = newline) surfaces as `aparte-composer-submit`, which we
   * treat as save; `Esc` cancels.
   */
  _enterEditMode() {
    if (this._editing || !this._contentEl) return;
    const t = document.activeElement;
    this._editReturnAction = t instanceof HTMLElement && this.contains(t) ? t.getAttribute("data-action") ?? "edit" : null, this._editing = !0, this.querySelector(".aparte-message")?.setAttribute("data-editing", "");
    const e = document.createElement("aparte-composer-input");
    e.setAttribute("placeholder", this._cfg.getLocale().edit ?? "Edit message"), this._editInput = e, this._contentEl.style.display = "none", this._contentEl.insertAdjacentElement("afterend", e), e.setValue(this._content), e.addEventListener("aparte-composer-submit", () => this._exitEditMode(!0)), e.addEventListener("keydown", (s) => {
      s.key === "Escape" && !s.isComposing && (s.preventDefault(), this._exitEditMode(!1));
    }), this._updateActionBar(), e.focusEnd();
  }
  /**
   * Leave edit mode. When `save` is true and the text actually changed, emits
   * `aparte-edit`; otherwise restores the original message untouched. Always
   * restores the normal action bar and removes the inline editor.
   */
  _exitEditMode(t) {
    if (!this._editing) return;
    const e = this._editInput?.getValue() ?? "", s = this._content;
    this._editInput?.remove(), this._editInput = null, this._contentEl && (this._contentEl.style.display = ""), this.querySelector(".aparte-message")?.removeAttribute("data-editing"), this._editing = !1, this._redrawFrameIfChanged(), this._redrawIfStale(), this._updateActionBar();
    const r = this._editReturnAction;
    if (this._editReturnAction = null, r && this._actionBarEl) {
      const i = Array.from(this._actionBarEl.querySelectorAll("[data-action]")).find((o) => o.getAttribute("data-action") === r), a = i && !i.disabled ? i : this._actionBarEl.querySelector("button:not([disabled])");
      if (a) {
        for (const o of this._rovingButtons()) o.tabIndex = o === a ? 0 : -1;
        a.focus();
      }
    }
    if (t && e && e !== s) {
      const i = this.getAttribute("message-id");
      if (i) {
        const a = {
          messageId: i,
          content: e,
          targetId: this._resolveTargetId()
        };
        this.dispatchEvent(new CustomEvent("aparte-edit", {
          bubbles: !0,
          composed: !0,
          detail: a
        }));
      }
    }
  }
  _resolveTargetId() {
    let t = this.parentElement;
    for (; t; ) {
      if ((t.tagName?.toLowerCase() === "aparte-chat" || t.hasAttribute?.("data-aparte-chat")) && t.id) return t.id;
      t = t.parentElement;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────
  _updateStreaming(t) {
    const e = this._streaming;
    this._streaming = t, t || (this._step = null);
    const s = this.querySelector(".aparte-message");
    s && (s.setAttribute("data-streaming", String(t)), t ? (s.setAttribute("aria-busy", "true"), s.classList.add("aparte-message-streaming")) : (s.removeAttribute("aria-busy"), s.classList.remove("aparte-message-streaming")), s.toggleAttribute("data-caret", t && this._cfg.getStreamingCaret())), this._updateWaiting(), this._updateFinishNote(), e && !t && this._updateContent(), e && !t && this._settleWrittenSegments(), e && !t && this._segments.length > 0 && this._redrawIfStale(), this._syncTurns();
  }
}
rt(Ac);
customElements.get("aparte-chat-bubble") || customElements.define("aparte-chat-bubble", Ac);
class kc extends HTMLElement {
  static get observedAttributes() {
    return ["visible", "text"];
  }
  /**
   * Resolved LIVE, not cached. Caching it at connect made this element
   * permanently deaf to its own instance: `_onConfigChange` filters on
   * `detail.config !== this._cfg`, so once `_cfg` had latched the global config no
   * change for the real instance ever matched, and the filter meant to isolate
   * chats became the thing that silenced one.
   */
  get _cfg() {
    return $(this);
  }
  /** The word said when no `text` is set: the locale's `typing`, never an English literal. */
  _word() {
    return this._cfg.t("typing");
  }
  constructor() {
    super();
  }
  connectedCallback() {
    this._render(), window.addEventListener("aparte-config-change", this._onConfigChange);
  }
  disconnectedCallback() {
    window.removeEventListener("aparte-config-change", this._onConfigChange);
  }
  _onConfigChange = (t) => {
    const e = t.detail;
    e?.config && e.config !== this._cfg || (this.innerHTML = "", this._render());
  };
  attributeChangedCallback(t, e, s) {
    if (e !== s)
      switch (t) {
        case "visible":
          this._updateVisibility(s !== null);
          break;
        case "text":
          this._updateText(s);
          break;
      }
  }
  /**
   * Show the typing indicator
   */
  show() {
    this.setAttribute("visible", "");
  }
  /**
   * Hide the typing indicator
   */
  hide() {
    this.removeAttribute("visible");
  }
  /**
   * Toggle visibility
   */
  toggle() {
    this.hasAttribute("visible") ? this.hide() : this.show();
  }
  /**
   * Check if visible
   */
  isVisible() {
    return this.hasAttribute("visible");
  }
  _render() {
    const t = this.getAttribute("text") || this._word(), e = this.hasAttribute("visible");
    if (this.querySelector(".aparte-status-container")) return;
    const s = this._cfg?.getStatusRenderer?.();
    if (s) {
      this.innerHTML = `<div class="aparte-message aparte-status-container" data-visible="${e}" role="status" aria-live="polite"></div>`;
      const r = this.querySelector(".aparte-status-container");
      r.setAttribute("aria-label", t);
      const i = gt(this._cfg, () => s(t));
      i instanceof HTMLElement ? r.appendChild(i) : r.innerHTML = i;
      return;
    }
    this.innerHTML = `
      <div
        class="aparte-message aparte-status-container"
        data-visible="${e}"
        role="status"
        aria-live="polite"
      >
        <div class="aparte-avatar" data-role="assistant" style="visibility: hidden"></div>
        <div class="aparte-body">
          <div class="aparte-status-content">
            <div class="aparte-dots" aria-hidden="true">
              <span class="aparte-dot"></span>
            </div>
            <span class="aparte-status-text"></span>
            <span class="aparte-sr-only aparte-status-sr"></span>
          </div>
        </div>
      </div>
    `, this.querySelector(".aparte-status-container")?.setAttribute("aria-label", t), this._writeText(this.getAttribute("text"));
  }
  /**
   * The one writer for both text nodes, so exactly ONE of them is ever populated.
   *
   * The container is a polite live region, and a live region announces its CONTENT.
   * The dots-only default had none — an `aria-hidden` dot and an empty span — so the
   * whole state rode on `aria-label`, which names the region rather than reporting it,
   * and nothing was announced. The screen-reader span carries the fallback word in that
   * case; when `text` is set the visible span already carries the same string, and
   * populating both would have the region read it twice.
   */
  _writeText(t) {
    const e = t || null, s = this.querySelector(".aparte-status-text");
    s && (s.textContent = e ?? ""), this._syncLiveWord();
  }
  /**
   * The fallback word enters and leaves the live region WITH the element's visibility.
   *
   * Writing it at render time put it in the region while the host was still
   * `display: none` — every wrapper mounts `<aparte-chat-status>` once and flips
   * `visible` — so by the time the region was exposed its content had not changed, and
   * on the second and third turn there was not even a reveal to notice: the text was
   * byte-identical to what was already sitting there. Revealing a region that already
   * holds its text is the path assistive tech is documented not to announce reliably;
   * mutating one that is already exposed is the path that works. So the word is written
   * when `visible` arrives and cleared when it leaves, which makes every turn a real
   * change.
   *
   * With `text` set the visible span is the region's content and the screen-reader span
   * stays empty — one copy, read once.
   */
  _syncLiveWord() {
    const t = this.querySelector(".aparte-status-sr");
    if (!t) return;
    const e = !this.getAttribute("text");
    t.textContent = e && this.hasAttribute("visible") ? this._word() : "";
  }
  _updateVisibility(t) {
    const e = this.querySelector(".aparte-status-container");
    e && e.setAttribute("data-visible", String(t)), this._syncLiveWord();
  }
  _updateText(t) {
    const e = this.querySelector(".aparte-status-container");
    if (!e) return;
    const s = this._cfg?.getStatusRenderer?.();
    if (s) {
      const r = t || this._word();
      e.setAttribute("aria-label", r);
      const i = gt(this._cfg, () => s(r));
      i instanceof HTMLElement ? e.replaceChildren(i) : e.innerHTML = i;
      return;
    }
    this._writeText(t), e.setAttribute("aria-label", t || this._word());
  }
}
rt(kc);
customElements.get("aparte-chat-status") || customElements.define("aparte-chat-status", kc);
function no(n, t) {
  if (n.role !== "assistant" || n.segments?.length || typeof n.content != "string" || !n.content.trim()) return n;
  const e = $u(n.content, { blocks: t });
  return e.length <= 1 && e.every((r) => r.type === "text") ? n : Ir({ ...n, segments: e });
}
function Ir(n) {
  return Object.defineProperty(n, Zr, { value: !0, enumerable: !1 }), n;
}
function so(n) {
  return n[Zr] === !0;
}
function yg(n, t) {
  try {
    return new Intl.DateTimeFormat(t || void 0, { dateStyle: "long" }).format(n);
  } catch {
    return n.toDateString();
  }
}
class Ec extends HTMLElement {
  // The scroll surface: an internal `.aparte-viewport-container` div (core mode)
  // or the host element itself (framework-managed mode). HTMLElement covers both.
  _container = null;
  _scrollBtn = null;
  _bottomSpacer = null;
  /**
   * In framework-managed mode there is no spacer ELEMENT (an extra child would
   * collide with the framework's own DOM reconciliation). The spacer is an
   * additive `padding-bottom` on the host, tracked here so `_recalculateSpacer`
   * can read the current value without measuring an element.
   */
  _fwSpacerHeight = 0;
  _spacerRafId = null;
  _spacerFrozenUntil = 0;
  _layoutTransitionMs = 0;
  _repo = new Jf();
  _isAutoScrollEnabled = !0;
  /** The last scroll position we saw, so growth can be told from a gesture. */
  _lastScrollTop = 0;
  /** The scroll height at the last scroll event: how much it moved since bounds what churn can do. */
  _lastScrollHeight = 0;
  /** When the transcript last mutated under our observer — an engine's settle adjustment follows one. */
  _lastMutationAt = Number.NEGATIVE_INFINITY;
  /** How long after a mutation an engine's settle adjustment can arrive, and how far it moves. */
  _settleShadowMs = 100;
  _settleBoundPx = 100;
  /** When this component last moved `scrollTop` itself — see `_handleScroll`. "Never" is
   *  -Infinity rather than 0: `performance.now()` can be under a second old. */
  _ownScrollAt = Number.NEGATIVE_INFINITY;
  /** When the reader last touched the transcript (wheel, touch, pointer, key). */
  _readerInputAt = Number.NEGATIVE_INFINITY;
  /** A decrease inside this window after our own scroll, with no gesture, is the browser's. */
  _ownScrollWindowMs = 1e3;
  /** How long after a scroll of ours we keep re-anchoring while the layout churns.
   *  Not `readonly`: a test shortens it to run past the window's end in a few frames. */
  _settleWindowMs = 400;
  /**
   * Until when a smooth scroll of ours is in flight. A user send glides to the
   * bottom with `scrollTo({ behavior: 'smooth' })`, and the assistant placeholder and
   * first tokens land inside that glide. An instant `scrollTop = scrollHeight` write
   * cancels a running smooth scroll in every engine, so while this deadline is ahead
   * every bottom-pin RE-TARGETS the glide (a second smooth `scrollTo` is continuous)
   * instead of writing `scrollTop`; the browser's `scrollend` closes it early where
   * supported. Streaming is instant after that, as it must be to keep up with token
   * bursts.
   */
  _glideUntil = 0;
  /** The glide's budget when `scrollend` is not there to close it: Chromium's smooth scroll over a viewport takes ~300–500 ms. */
  _glideWindowMs = 450;
  /** Armed with each glide: when the window closes, a view still short of the bottom is pinned. */
  _glideSettleTimer = null;
  /** Deadline of the settle in flight (0 = none). Pushed forward, never stacked. */
  _settleUntil = 0;
  _settleRafId = null;
  /** The keys that scroll a focused scroll container — the only keydowns that are a gesture. */
  _scrollKeys = /* @__PURE__ */ new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
  _scrollThreshold = 50;
  /** When true, the next _autoScroll() call uses smooth instead of instant, then resets. */
  _smoothScrollOnce = !1;
  /**
   * DOM render cap: the max number of `<aparte-chat-bubble>` elements kept in the
   * DOM at once (a perf ceiling for very long conversations). This NEVER evicts
   * messages from the repository — the full conversation tree and its persistence
   * snapshot stay intact; only the oldest rendered bubbles are dropped from view.
   */
  _maxRenderedBubbles = 1e3;
  _resizeObserver = null;
  _mutationObserver = null;
  /**
   * Watches the size of the bubbles the bottom spacer measures — the last question and
   * everything after it. A bubble that has never been on screen measures its
   * `content-visibility` fallback (320px) until it is shown, and taking its real height
   * is neither a mutation nor a resize of the scroll container: without this, a spacer
   * sized from two fallbacks stayed wrong once they came into view.
   */
  _tailObserver = null;
  _tail = [];
  /** Each tail bubble's border-box height, as measured when it started being watched and as last reported. */
  _tailHeights = /* @__PURE__ */ new WeakMap();
  /**
   * Opening or closing a `<details>` — a tool row, a reasoning block, an artifact card, a host's
   * own — changes the transcript's height through an ATTRIBUTE, which neither observer sees: the
   * mutation observer watches children, and the resize observer leaves the wrapper out on
   * purpose. `toggle` does not bubble, so it is caught on the way down.
   */
  _onDisclosureToggle = () => {
    this._scheduleSpacerUpdate();
  };
  /** The `[overlay-composer]` shell this viewport floats in, if any. Followed, not read once: see `_wireOverlay`. */
  _overlayRoot = null;
  /** Watches the overlay shell's childList, so a stack child that mounts later (elicitation) gets observed too. */
  _overlayObserver = null;
  /** Watches the parent's `overlay-composer` attribute, so the mode follows a binding that lands after connect. */
  _overlayAttrObserver = null;
  /** Last `--aparte-bottom-inset` written, in px — style writes only when it changes. */
  _overlayInset = -1;
  /** Last `--aparte-transcript-inset` written on the host, in px — same write-on-change rule. */
  _transcriptInset = -1;
  _boundResetHandler = null;
  /**
   * Marks the bubble a compaction is writing its checkpoint onto (`data-checkpoint`). The
   * vanilla viewport's job: under a wrapper the transcript is the framework's, and the
   * host answers for it instead (`active` below).
   */
  _checkpointState = null;
  _stopCheckpointState = null;
  /**
   * When true, _reRenderActivePath() only dispatches aparte-path-changed without
   * touching the DOM. Set via setFrameworkManagedDOM(true) when a framework
   * (e.g. Angular) owns the bubble elements.
   */
  _frameworkManagedDOM = !1;
  /** Inside `setMessages`: each append leaves the layout work to the end of the loop. */
  _bulkAppend = !1;
  static get observedAttributes() {
    return ["scroll-threshold", "max-rendered-bubbles", "loading"];
  }
  /**
   * The transcript is on its way: a conversation was chosen and its messages are
   * being fetched. Two skeleton turns stand where they will be, the scroll surface
   * is `aria-busy`, and a visually hidden line names the wait. Reflected as the
   * `loading` attribute — `AparteConversationController` sets it through its
   * binding; a loop of your own sets it by hand. Not the same thing as `data-busy`,
   * which is a reply streaming into a transcript that is already there.
   */
  get loading() {
    return this.hasAttribute("loading");
  }
  set loading(t) {
    this.toggleAttribute("loading", mt(t));
  }
  setLoading(t) {
    this.loading = t;
  }
  /** Draw or remove the wait, from the attribute. Safe before the structure exists. */
  _syncLoading() {
    const t = this._container;
    if (!t) return;
    const e = this.hasAttribute("loading");
    if (t.setAttribute("aria-busy", e ? "true" : "false"), this._frameworkManagedDOM) return;
    const s = t.querySelector(":scope > .aparte-viewport-loading");
    if (!e) {
      s?.remove(), t.querySelector(":scope > .aparte-viewport-loading-status")?.remove();
      return;
    }
    if (s) return;
    const r = $(this), i = document.createElement("div");
    i.className = "aparte-viewport-loading", i.setAttribute("aria-hidden", "true"), i.innerHTML = '<span class="aparte-skeleton aparte-skeleton--rect aparte-viewport-loading__user"></span><span class="aparte-skeleton aparte-skeleton--text"></span><span class="aparte-skeleton aparte-skeleton--text"></span><span class="aparte-skeleton aparte-skeleton--text"></span><span class="aparte-skeleton aparte-skeleton--text aparte-viewport-loading__last"></span>';
    const a = document.createElement("span");
    a.className = "aparte-viewport-loading-status aparte-sr-only", a.setAttribute("role", "status"), t.prepend(i, a);
    const o = () => {
      a.isConnected && (a.textContent = r.t("loadingConversation"));
    };
    typeof requestAnimationFrame == "function" ? requestAnimationFrame(o) : o();
  }
  constructor() {
    super(), this._handleScroll = this._handleScroll.bind(this), this._handleScrollEnd = this._handleScrollEnd.bind(this);
  }
  connectedCallback() {
    this.hasAttribute("framework-managed") && (this._frameworkManagedDOM = !0), this._render(), this._setupEventListeners(), this._setupObservers(), this._updateTranscriptInset(), this._boundResetHandler = () => this.clearAll(), window.addEventListener("aparte-reset", this._boundResetHandler), window.addEventListener("aparte-config-change", this._onConfigChange), this._checkpointState ??= new Cf({
      // A bare `<aparte-chat-viewport id="…">` with no named host around it is its own
      // chat: the client names its events with that id (`_targetIdOf` falls back to the
      // element's own), so the watcher answers to it too, or every event is someone else's.
      ownId: () => Ef(this) ?? (this.id || void 0),
      bubbleOf: (t) => this.querySelector(`aparte-chat-bubble[message-id="${yt(t)}"]`),
      owns: (t) => !!this.getMessage(t),
      active: () => !this._frameworkManagedDOM
    }), this._stopCheckpointState ??= this._checkpointState.start();
  }
  /**
   * A locale switch changes the reading direction, and `dir` follows it, so a chat
   * already on screen flips to RTL without a reload.
   * Only OUR config: an instance-scoped change elsewhere must not touch us.
   */
  _onConfigChange = (t) => {
    const e = t.detail;
    if (e?.config && e.config !== $(this)) return;
    this._applyDirection(), this._scrollBtn?.setAttribute("aria-label", $(this).t("scrollToBottom")), (this._frameworkManagedDOM ? this : this.querySelector(".aparte-viewport-container"))?.setAttribute("aria-label", $(this).t("transcript")), this._syncDateSeparators();
  };
  /**
   * The transcript is a TAB STOP, with a name.
   *
   * A scrollable region that no element can hold focus in cannot be scrolled from
   * the keyboard in WebKit: Chromium and Firefox hand an unfocusable overflow box a
   * caret or a "scroller" tab stop of their own, Safari does not. So a plain-text
   * transcript — no links, no code blocks, nothing focusable inside — would be
   * unreadable past the first screen for a Safari keyboard user, with no error and
   * nothing on screen to say so.
   *
   * `tabindex="0"` on the surface itself, in BOTH DOM modes. In framework mode the
   * scroll button is inside the host and stays tabbable while it is visually hidden,
   * but a tab stop that exists because a hidden button happens to sit there is a
   * coincidence, not an affordance.
   *
   * The name ships WITH the tab stop rather than after it: a focusable `role="log"`
   * with no accessible name is announced as an unnamed region, which is a worse
   * answer than no tab stop at all. And the ROLE ships with both: a name on a
   * generic element is the same defect mirrored — `aria-label` is prohibited on an
   * element whose role resolves to none, which is what a bare custom element is. The
   * default mode already writes `role="log"` on the container before this runs, so
   * the guard here is what gives the framework-mode host the same declaration.
   */
  _nameScrollSurface(t) {
    t.setAttribute("tabindex", "0"), t.hasAttribute("role") || t.setAttribute("role", "log"), t.setAttribute("aria-label", $(this).t("transcript"));
  }
  /**
   * Mirror `locale.direction` onto the scroll surface: the container, or the viewport itself
   * when a framework renders the messages — a wrapper's transcript stayed left to right
   * under a right-to-left locale while its composer turned.
   */
  _applyDirection() {
    const t = this._frameworkManagedDOM ? this : this.querySelector(".aparte-viewport-container");
    if (!t) return;
    const e = $(this).getLocale().direction;
    e ? t.setAttribute("dir", e) : t.removeAttribute("dir");
  }
  disconnectedCallback() {
    window.removeEventListener("aparte-config-change", this._onConfigChange), this._boundResetHandler && (window.removeEventListener("aparte-reset", this._boundResetHandler), this._boundResetHandler = null), this._stopCheckpointState?.(), this._stopCheckpointState = null, this._cleanup();
  }
  attributeChangedCallback(t, e, s) {
    if (e !== s)
      switch (t) {
        case "scroll-threshold":
          this._scrollThreshold = parseInt(s || "50", 10);
          break;
        case "max-rendered-bubbles":
          this._maxRenderedBubbles = parseInt(s || "1000", 10), this._pruneRenderedBubbles();
          break;
        case "loading":
          this._syncLoading();
          break;
      }
  }
  /**
   * Configure viewport with options
   */
  configure(t) {
    t.scrollThreshold !== void 0 && (this._scrollThreshold = t.scrollThreshold), t.maxRenderedBubbles !== void 0 && (this._maxRenderedBubbles = t.maxRenderedBubbles, this._pruneRenderedBubbles()), t.layoutTransitionMs !== void 0 && (this._layoutTransitionMs = t.layoutTransitionMs);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Simple Content Streaming
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Append a token chunk to a message's content (simple text streaming)
   * @param messageId - Unique identifier for the message
   * @param chunk - Token chunk to append
   */
  appendToken(t, e) {
    const s = this._getOrCreateMessage(t);
    s.content = (s.content || "") + e, this._notifyBubble(t, "appendToken", e), this._autoScroll(), this._scheduleSpacerUpdate();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Segment-Aware Streaming
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Append content to a specific segment within a message
   * @param messageId - Message containing the segment
   * @param segmentId - Target segment ID
   * @param chunk - Content to append
   */
  appendToSegment(t, e, s) {
    const r = this._getOrCreateMessage(t);
    r.segments || (r.segments = []);
    const i = r.segments.findIndex((o) => o.id === e), a = i === -1 ? void 0 : r.segments[i];
    a && "content" in a && (r.segments[i] = {
      ...a,
      content: a.content + s,
      // Content arriving IS the segment's activity, so this is what
      // `endedAt` measures. Without it a thinking block's end would be
      // whenever someone happened to notice it had stopped — the end of
      // the turn, or the start of the next segment — and both of those
      // silently fold the waiting that followed into the duration.
      ...Wu(a)
    }), this.dispatchEvent(new CustomEvent("aparte-segment-update", {
      bubbles: !0,
      composed: !0,
      detail: { messageId: t, segmentId: e, content: s, append: !0 }
    })), this._notifyBubble(t, "appendToSegment", s, e), this._autoScroll();
  }
  /**
   * The active (head) message id — the target of `AparteClient`'s 1-argument
   * streaming convention (`addSegment(segment)`, `updateSegment(segmentId,
   * updates)`, …) which operates on "the current message". Lets a bare
   * `<aparte-chat-viewport>` be a valid `AparteClient` target, exactly like a
   * framework wrapper's host element.
   */
  _activeMessageId() {
    const t = this._repo.headId, e = this._streamingMessageId();
    return e !== null && e !== t ? null : t;
  }
  /**
   * The id of the message currently streaming, if any — searched across the whole
   * TREE, and answering with an OFF-HEAD one first when there are two.
   *
   * Not a scan of `getMessages()`, the active path: a retry or an edit on an
   * earlier bubble calls `addSiblingOf`, which switches the branch to the new pending
   * reply, so the turn still being written leaves the path and a path scan would find
   * nothing, appending the rest of that turn to the message that just replaced it.
   *
   * A new pending reply is itself marked streaming, so "the first one found" would
   * answer the head and let the write through — the very case this exists to refuse.
   * Answering the off-head one instead makes `_activeMessageId` refuse while ANY turn
   * elsewhere in the tree is still open. That also refuses the new turn's own first
   * deltas for as long as the superseded one has not settled, which is the trade this
   * whole path already makes: losing the tail is visible, writing it onto someone
   * else's message is not.
   */
  _streamingMessageId() {
    const t = this._repo.headId;
    let e = null;
    for (const s of this._repo.getAllMessages())
      if (s.isStreaming) {
        if (s.id !== t) return s.id;
        e = s.id;
      }
    return e;
  }
  /**
   * While a reply streams, the transcript is read-only except for Stop.
   *
   * The streaming message's own footer is hidden, and the branch picker and the
   * retry/edit buttons of every OTHER message are disabled: swapping a branch mid-stream would
   * re-render the active path under the reply being written, and a retry would cut
   * that reply off to start another. The state that
   * decides it is the whole transcript's, so it lives on the viewport (`data-busy`)
   * and is pushed to the bubbles it holds; a bubble mounted later, under a
   * framework's DOM, reads the attribute itself when it connects.
   */
  _syncBusy() {
    this._frameworkManagedDOM || this.setTranscriptBusy(this._streamingMessageId() !== null);
  }
  _busy = !1;
  /**
   * The transcript's read-only-while-streaming flag — `data-busy` on this element and
   * fanned out to the bubbles it holds. The vanilla path derives it from the
   * repository (`_syncBusy`); a framework host, whose messages live outside the
   * repository during a turn, writes it directly from its own streaming id.
   */
  setTranscriptBusy(t) {
    this._busy = t, this.toggleAttribute("data-busy", t);
    for (const e of this.querySelectorAll("aparte-chat-bubble"))
      e.setTranscriptBusy?.(t);
  }
  addSegment(t, e) {
    const s = typeof t == "string" ? t : this._activeMessageId(), r = typeof t == "string" ? e : t;
    if (!s || !r) return;
    const i = this._getOrCreateMessage(s);
    i.segments || (i.segments = []);
    const a = Mi(
      i.segments,
      r,
      s,
      // THIS chat's defaults, not the page's: two chats on one page can be
      // configured differently, and the config seam is per instance.
      $(this).getSegmentDefaults(r.type)
    );
    i.segments.push(a), this._notifyBubble(s, "addSegment", a), this._autoScroll();
  }
  updateSegment(t, e, s) {
    const r = s === void 0 && typeof e == "object", i = r ? this._activeMessageId() : t, a = r ? t : e, o = r ? e : s;
    if (!i) return;
    const l = this._repo.getMessageById(i);
    if (!l?.segments) return;
    const c = l.segments.findIndex((d) => d.id === a);
    if (c !== -1) {
      const d = l.segments[c], h = Fu(d, o);
      l.segments[c] = al(d, h), this._notifyBubble(i, "updateSegment", { segmentId: a, updates: h });
    }
  }
  removeSegment(t, e) {
    const s = e === void 0, r = s ? this._activeMessageId() : t, i = s ? t : e;
    if (!r || !i) return;
    const a = this._repo.getMessageById(r);
    if (a?.segments) {
      const o = a.segments.findIndex((l) => l.id === i);
      o !== -1 && (a.segments.splice(o, 1), Gu(a.segments));
    }
    this._notifyBubble(r, "removeSegment", i);
  }
  /**
   * Start a new streaming segment (e.g., thinking or code block)
   * Creates the segment and marks it as streaming
   */
  startSegment(t, e) {
    const s = { ...e, isStreaming: !0 };
    this.addSegment(t, s);
  }
  /**
   * Complete a streaming segment
   */
  completeSegment(t, e) {
    this.updateSegment(t, e, { isStreaming: !1 });
  }
  /**
   * Persist token usage on a message and propagate to the live bubble, which is
   * what allows the info ("i") action to render — provided the app declared it
   * with `aparteGlobalConfig.setBubbleActions({ info: true })`; it is off by default,
   * since the popover it opens belongs to the app.
   */
  setUsage(t, e) {
    const s = this._repo.getMessageById(t);
    s && (s.usage = e), this._notifyBubble(t, "setUsage", e);
  }
  /**
   * Say the step the agent is on ("Reading the parser") in the reply's waiting indicator,
   * or `null` for none. Live only: handed to the bubble, never written on the message.
   */
  setStep(t, e) {
    this._notifyBubble(t, "setStep", e);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Message Management
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Mark a message as finished streaming
   */
  completeMessage(t) {
    const e = this._repo.getMessageById(t);
    e && (e.isStreaming = !1, e.status = "completed", this._settleSegments(t, e), this._notifyBubble(t, "complete", { status: "completed" }), this._syncBusy(), this._recalculateSpacer());
  }
  /**
   * Close a finished message's still-open segments, one `updateSegment` each.
   *
   * Deliberately NOT a loop that writes `isStreaming` onto the objects: that path
   * stamps the model and tells the bubble nothing, so a renderer never learns its
   * segment settled — no `endedAt` in the rendered label, and no final Markdown
   * flush either. Going through `updateSegment` reuses the one path that does
   * both.
   */
  _settleSegments(t, e) {
    if (e.segments)
      for (const s of zu(e.segments))
        this.updateSegment(t, s, { isStreaming: !1 });
  }
  /**
   * Atomic update for a message by ID
   * Supports updating content, status, segments, and other metadata
   *
   * An id the tree does not hold is a silent no-op, deliberately: the message may have
   * been truncated away by an edit while a turn was still writing to it, and inventing
   * it back would put a message the reader deleted on screen. It does mean a late error
   * card can have nowhere to land — `aparte-message-error` still fires, so a host that
   * wants to show one has the event.
   */
  updateMessage(t, e) {
    const s = this._repo.getMessageById(t);
    s && (Object.assign(s, e), e.status && (s.isStreaming = e.status === "streaming" || e.status === "pending", ol(e.status) && this._settleSegments(t, s)), this._notifyBubble(t, "update", e), e.status && this._syncBusy(), this._autoScroll());
  }
  /**
   * Add a complete message to the message registry.
   *
   * @remarks
   * **Framework-managed DOM only.** Records the message in the tree but does NOT
   * paint a bubble on its own (a framework wrapper reconciles the DOM from the
   * list). For standalone / vanilla usage call {@link appendMessage} instead,
   * which both records the message and creates its bubble element.
   */
  addMessage(t) {
    const e = $n({ ...t });
    Be(t) && (e.isStreaming = !0), this._repo.addOrUpdateMessage(this._repo.headId, e), this._pruneRenderedBubbles(), this._syncBusy(), this._autoScroll();
  }
  /**
   * Append a new message and create its bubble in the DOM.
   * Implements the same contract as the Angular wrapper's appendMessage(),
   * making aparte-chat-viewport a fully standalone target for aparte-client.
   * When `_frameworkManagedDOM` is true, only the internal repo is updated —
   * the framework owns the DOM and will create the bubble element itself.
   */
  appendMessage(t, e) {
    t = no(t, $(this).getStreamBlocks());
    const s = e?.historical ? $n(t) : t.segments?.length ? { ...t, segments: t.segments.reduce(
      (r, i) => (r.push(Mi(
        r,
        i,
        t.id,
        $(this).getSegmentDefaults(i.type)
      )), r),
      []
    ) } : { ...t };
    if (!e?.historical && Be(t) && (s.isStreaming = !0), so(t) && Ir(s), this._repo.addOrUpdateMessage(this._repo.headId, s), !this._frameworkManagedDOM) {
      const r = this.querySelector(".aparte-messages-wrapper");
      if (r) {
        const i = document.createElement("aparte-chat-bubble");
        i.setAttribute("message-id", t.id), i.setAttribute("data-role", t.role), t.compaction && i.setAttribute("data-kind", "compaction"), t.timestamp && i.setAttribute("timestamp", String(t.timestamp)), t.content && i.setAttribute("content", t.content), Be(t) && i.setAttribute("streaming", ""), this._bottomSpacer && this._bottomSpacer.parentNode === r ? r.insertBefore(i, this._bottomSpacer) : r.appendChild(i), Pa(i, s);
      }
    }
    this._bulkAppend || (this._pruneRenderedBubbles(), this._syncBusy(), t.role === "user" && (this._isAutoScrollEnabled = !0, this._smoothScrollToBottom()), this._recalculateSpacer(), t.role === "user" ? requestAnimationFrame(() => {
      this._isAutoScrollEnabled && this._smoothScrollToBottom();
    }) : this._autoScroll());
  }
  /**
   * Update the last message content, optionally appending.
   * Implements the same contract as the Angular wrapper's updateLastMessage(),'
   * making aparte-chat-viewport a fully standalone streaming target for aparte-client.
   */
  updateLastMessage(t, e) {
    const s = this._repo.headId;
    if (s)
      if (e?.append)
        this.appendToken(s, t);
      else {
        const r = this._repo.getMessageById(s);
        r && (r.content = t), this._notifyBubble(s, "appendToken", t);
      }
  }
  /**
   * Add a new sibling branch to an assistant message (retry flow).
   * Creates a new empty assistant message as a sibling of `messageId`
   * under the same parent, switches the active branch to it, and
   * re-renders the active path.
   * @returns The index of the new branch in the siblings array, or 0 on failure.
   */
  addBranch(t) {
    const e = this._repo.getMessage(t);
    if (!e) return 0;
    const s = {
      id: pt(),
      role: "assistant",
      content: "",
      status: "pending",
      timestamp: Date.now()
    };
    return this._repo.addOrUpdateMessage(e.parentId, s), this._repo.switchToBranch(s.id), this._reRenderActivePath(), this._repo.getBranches(s.id).indexOf(s.id);
  }
  /**
   * Add a new message relative to `existingId`, switch to it, and re-render.
   *
   * Role-aware semantics:
   *  - existingId is an **assistant** message → create a sibling (same parent),
   *    so the active path replaces the old response with the new one.
   *  - existingId is a **user** message → create a child of that message,
   *    so the user message stays on the active path and the new response follows it.
   *
   * Returns the new message's ID, or null if `existingId` is not found.
   */
  addSiblingOf(t, e) {
    const s = this._repo.getMessage(t);
    if (!s) return null;
    const r = s.message.role === "user" ? t : s.parentId, i = { ...e };
    return Be(e) && (i.isStreaming = !0), this._repo.addOrUpdateMessage(r, i), this._repo.switchToBranch(e.id), this._reRenderActivePath(), e.id;
  }
  /**
   * Navigate to the previous or next sibling branch of a message.
   * Triggers a full re-render of the active path.
   */
  navigateBranch(t, e) {
    if (this._busy) return;
    const s = this._repo.getBranches(t), r = s.indexOf(t);
    if (r === -1) return;
    const i = e === "prev" ? r - 1 : r + 1;
    i < 0 || i >= s.length || (this._isAutoScrollEnabled = this._isAtBottom(), this._updateScrollButton(), this._repo.switchToBranch(s[i]), this._reRenderActivePath());
  }
  /**
   * Remove ALL responses to a user message (every child branch) and set head
   * back to `userMessageId`. Cleaner than `truncateFrom` for edit flows: it
   * discards stale sibling branches so the regenerated response starts alone.
   */
  truncateResponsesAfter(t) {
    const e = this._repo.getMessages();
    if (this._repo.clearChildren(t), !this._frameworkManagedDOM) {
      const s = this.querySelector(".aparte-messages-wrapper");
      if (s) {
        const r = e.findIndex((a) => a.id === t), i = r >= 0 ? e.slice(r + 1) : [];
        for (const a of i)
          s.querySelector(`aparte-chat-bubble[message-id="${yt(a.id)}"]`)?.remove();
      }
    }
  }
  /**
   * Remove all messages from `messageId` onwards (inclusive) from state and DOM.
   * Used by edit to truncate history before re-generating.
   */
  truncateFrom(t) {
    const e = this._repo.getMessages(), s = e.findIndex((i) => i.id === t);
    if (s === -1) return;
    const r = e.slice(s).map((i) => i.id);
    if (this._repo.resetHead(t), !this._frameworkManagedDOM) {
      const i = this.querySelector(".aparte-messages-wrapper");
      for (const a of r)
        i?.querySelector(`aparte-chat-bubble[message-id="${yt(a)}"]`)?.remove();
    }
  }
  /**
   * Get a message by ID
   */
  getMessage(t) {
    return this._repo.getMessageById(t);
  }
  /**
   * The messages on the currently ACTIVE path, root → head — not the whole tree.
   * A message that was retried contributes only the branch currently selected;
   * `exportTree()` is what returns every sibling.
   */
  getMessages() {
    return this._repo.getMessages();
  }
  /**
   * Export the full conversation tree (all branches, not just the active path).
   * The returned snapshot can be persisted and restored via `importTree()`.
   */
  exportTree() {
    return this._repo.export();
  }
  /**
   * Import a previously-exported tree snapshot, restoring the full branch
   * topology and the active head. Replaces any existing repo content.
   *
   * Always calls `_reRenderActivePath()`:
   * - In native DOM mode: rebuilds bubble elements.
   * - In framework-managed mode: skips DOM manipulation but dispatches
   *   `aparte-path-changed` with sibling metadata so the wrapper can update
   *   branch arrows on already-rendered bubbles.
   */
  importTree(t) {
    this.clearAll({ revokeAttachments: !1 });
    const e = $(this).getStreamBlocks();
    this._repo.import({
      ...t,
      messages: t.messages.map((s) => {
        const r = no(s.message, e), i = $n(r);
        return so(r) && Ir(i), { ...s, message: i };
      })
    }), this._reRenderActivePath();
  }
  /**
   * Clear all messages and remove all bubble elements from the DOM.
   * Also dispatches a aparte-reset-done event.
   *
   * In framework-managed mode the DOM is owned by the host framework
   * (Angular @for, React, etc.) and we must not clear `innerHTML` — doing
   * so desynchronises the framework's view tree from the live DOM and the
   * next change-detection pass throws `NotFoundError` on insertBefore.
   */
  clearAll(t) {
    if (t?.revokeAttachments !== !1)
      for (const e of this._repo.getAllMessages())
        wf(e.attachments);
    if (this._repo.clear(), this._syncBusy(), !this._frameworkManagedDOM) {
      const e = this.querySelector(".aparte-messages-wrapper");
      e && Array.from(e.querySelectorAll("aparte-chat-bubble")).forEach((s) => s.remove());
    }
    this._setSpacerHeight(0), this._isAutoScrollEnabled = !0, this._updateScrollButton(), this._checkpointState?.clear(), this.dispatchEvent(new CustomEvent("aparte-reset-done", { bubbles: !0, composed: !0 }));
  }
  /**
   * Replace the entire message list in one shot. Used when switching
   * conversations: clears existing repo + DOM, then appends each message.
   *
   * In framework-managed mode the framework re-renders the bubble DOM
   * itself; we only update the internal repo (used by aparte-client to
   * build chat history).
   */
  setMessages(t) {
    this.clearAll({ revokeAttachments: !1 }), this._bulkAppend = !0;
    try {
      for (const e of t)
        this.appendMessage(e, { historical: !0 });
    } finally {
      this._bulkAppend = !1;
    }
    this._pruneRenderedBubbles(), this._syncBusy(), t.some((e) => e.role === "user") && (this._isAutoScrollEnabled = !0), this._recalculateSpacer(), this._autoScroll();
  }
  /**
   * Scroll to bottom of viewport
   */
  scrollToBottom() {
    this._scrollToBottom();
  }
  /**
   * Reset the bottom spacer to 0 height immediately and freeze it for
   * 350 ms so the host-app layout transition (e.g. flex: 0→1 animation)
   * does not trigger a premature recalculation with mid-animation geometry.
   * Call before a full messages swap.
   */
  resetSpacer() {
    this._setSpacerHeight(0), this._layoutTransitionMs > 0 && (this._spacerFrozenUntil = Date.now() + this._layoutTransitionMs);
  }
  /**
   * Enable or disable auto-scroll. Turned off, it stays off through the scroll that comes
   * next — a jump of the page's own, smooth or not — and comes back once the reader is at
   * the bottom again.
   */
  setAutoScroll(t) {
    this._isAutoScrollEnabled = t, t || (this._readerInputAt = performance.now());
  }
  /**
   * Signal that a framework (e.g. Angular) manages the bubble DOM.
   * When true, branch navigation dispatches `aparte-path-changed` without
   * clearing/rebuilding the messages wrapper — the framework re-renders instead.
   */
  setFrameworkManagedDOM(t) {
    this._frameworkManagedDOM = t;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────
  _getOrCreateMessage(t) {
    const e = this._repo.getMessageById(t);
    if (e) return e;
    const s = {
      id: t,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: !0,
      status: "streaming"
    };
    return this._repo.addOrUpdateMessage(this._repo.headId, s), s;
  }
  _notifyBubble(t, e, s, r) {
    const i = this.querySelector(
      `aparte-chat-bubble[message-id="${yt(t)}"], [data-aparte-bubble][message-id="${yt(t)}"]`
    );
    if (i)
      switch (e) {
        case "appendToken":
          i.appendToken?.(s);
          break;
        case "appendToSegment":
          i.appendToSegment?.(r, s);
          break;
        case "addSegment":
          i.addSegment?.(s);
          break;
        case "updateSegment": {
          const { segmentId: a, updates: o } = s;
          i.updateSegment?.(a, o);
          break;
        }
        case "removeSegment":
          i.removeSegment?.(s);
          break;
        case "setUsage":
          i.setUsage?.(s);
          break;
        case "setStep":
          i.setStep?.(s);
          break;
        case "update": {
          const a = s;
          ["status", "segments", "content", "attachments", "usage", "finishReason", "contextSummary", "compaction"].some((l) => l in a) && i.updateMessage?.(s);
          break;
        }
        case "complete":
          i.updateMessage?.(s);
          break;
      }
  }
  /** The day on the first bubble of each one, by what is on screen: a branch has its own days. */
  _syncDateSeparators() {
    const t = $(this), e = t.getDateSeparators();
    if (!e && !this.querySelector("aparte-chat-bubble[data-date]")) return;
    const s = /* @__PURE__ */ new Date(), r = (o) => new Date(o.getFullYear(), o.getMonth(), o.getDate()).getTime(), i = r(s);
    let a = null;
    this.querySelectorAll("aparte-chat-bubble").forEach((o) => {
      const l = Number(o.getAttribute("timestamp")), c = l ? new Date(l) : null, d = c ? r(c) : null, h = e && c && d !== a;
      if (d !== null && (a = d), !h || !c) {
        o.hasAttribute("data-date") && o.removeAttribute("data-date");
        return;
      }
      const u = Math.round((i - d) / 864e5), p = u === 0 ? t.t("conversationGroupToday") : u === 1 ? t.t("conversationGroupYesterday") : yg(c, t.getLocale().tag);
      o.getAttribute("data-date") !== p && o.setAttribute("data-date", p);
    });
  }
  /**
   * Re-render the active path: clears the messages wrapper and rebuilds bubbles
   * for every message on the current active branch path (root → head).
   * Calls `setSiblings(count, index)` on each bubble that has siblings, and
   * dispatches `aparte-path-changed` so Angular wrapper can sync its signal.
   *
   * When `_frameworkManagedDOM` is true (set via setFrameworkManagedDOM), the DOM
   * manipulation is skipped — only `aparte-path-changed` is dispatched so the
   * framework can re-render from updated signal state.
   */
  _reRenderActivePath() {
    const t = this._repo.getMessages(), e = t.map((i) => {
      const a = this._repo.getBranches(i.id);
      return { id: i.id, count: a.length, index: a.indexOf(i.id) };
    });
    if (this._frameworkManagedDOM) {
      this._dispatchPathChanged(t, e);
      return;
    }
    const s = this.querySelector(".aparte-messages-wrapper");
    if (!s) return;
    s.innerHTML = "";
    const r = Math.max(0, t.length - this._maxRenderedBubbles);
    for (let i = r; i < t.length; i++) {
      const a = t[i], o = e[i], l = document.createElement("aparte-chat-bubble");
      l.setAttribute("message-id", a.id), l.setAttribute("data-role", a.role), a.compaction && l.setAttribute("data-kind", "compaction"), a.timestamp && l.setAttribute("timestamp", String(a.timestamp)), Be(a) && l.setAttribute("streaming", ""), s.appendChild(l), Pa(l, a, o);
    }
    this._syncDateSeparators(), this._dispatchPathChanged(t, e), this._syncBusy(), this._checkpointState?.reapply(), this._recalculateSpacer();
  }
  _dispatchPathChanged(t, e) {
    const s = { messages: t, siblings: e };
    this.dispatchEvent(new CustomEvent("aparte-path-changed", {
      bubbles: !0,
      composed: !0,
      detail: s
    }));
  }
  _autoScroll() {
    this._isAutoScrollEnabled && requestAnimationFrame(() => {
      this._isAutoScrollEnabled && this._scrollToBottom();
    }), this._pruneRenderedBubbles();
  }
  /**
   * Request that the next auto-scroll triggered by a DOM mutation uses
   * smooth behaviour instead of instant. Call this just before adding a
   * user message bubble so the viewport animates down rather than jumping.
   * Resets automatically after the first auto-scroll fires.
   */
  requestSmoothScroll() {
    this._smoothScrollOnce = !0;
  }
  _render() {
    if (this._frameworkManagedDOM) {
      this._setupFrameworkDOM();
      return;
    }
    if (this.querySelector(".aparte-viewport-container"))
      this._container = this.querySelector(".aparte-viewport-container"), this._scrollBtn = this.querySelector(".aparte-scroll-btn"), this._bottomSpacer = this.querySelector(".aparte-bottom-spacer");
    else {
      const t = document.createElement("div");
      t.className = "aparte-viewport-container";
      const e = $(this).getLocale();
      e.direction && t.setAttribute("dir", e.direction), t.setAttribute("role", "log"), t.setAttribute("aria-live", "polite"), t.setAttribute("aria-atomic", "false"), t.setAttribute("aria-relevant", "additions"), this._nameScrollSurface(t);
      const s = document.createElement("div");
      for (s.className = "aparte-messages-wrapper"; this.firstChild; )
        s.appendChild(this.firstChild);
      this._bottomSpacer = document.createElement("div"), this._bottomSpacer.className = "aparte-bottom-spacer", this._bottomSpacer.setAttribute("aria-hidden", "true"), s.appendChild(this._bottomSpacer), t.appendChild(s), this.appendChild(t), this._container = t, this._syncLoading(), this._scrollBtn = document.createElement("button"), this._scrollBtn.className = "aparte-btn aparte-btn--surface aparte-btn--circle aparte-btn--lg aparte-scroll-btn aparte-scroll-btn--hidden", this._scrollBtn.setAttribute("type", "button"), this._scrollBtn.setAttribute("aria-label", $(this).t("scrollToBottom"));
      const r = $(this).getIcon("scrollDown");
      this._scrollBtn.innerHTML = r, this.appendChild(this._scrollBtn);
    }
  }
  /**
   * DOM setup for framework-managed mode. The framework (React/Vue/Svelte/
   * Angular) renders the bubble elements as DIRECT children of the host, so we
   * must NOT relocate them into an internal wrapper — that desyncs the
   * framework's virtual DOM from the real DOM and throws NotFoundError on the
   * next append. Instead the HOST itself is the scroll surface, the spacer is
   * additive `padding-bottom` (no element), and the scroll button is a
   * `position: sticky` TRAILING foreign child (kept last by the framework
   * MutationObserver). A present foreign node is still a valid `insertBefore`
   * reference for the framework — the crash came from a RELOCATED node, not a
   * foreign one.
   */
  _setupFrameworkDOM() {
    if (this._container = this, this._bottomSpacer = null, this.classList.contains("aparte-viewport--framework")) {
      this._scrollBtn = this.querySelector(":scope > .aparte-scroll-btn");
      return;
    }
    this.classList.add("aparte-viewport--framework"), this._nameScrollSurface(this), this._applyDirection();
    const t = document.createElement("button");
    t.className = "aparte-btn aparte-btn--surface aparte-btn--circle aparte-btn--lg aparte-scroll-btn aparte-scroll-btn--hidden", t.setAttribute("type", "button"), t.setAttribute("aria-label", $(this).t("scrollToBottom"));
    const e = $(this).getIcon("scrollDown");
    t.innerHTML = e, this.appendChild(t), this._scrollBtn = t;
  }
  /**
   * Keep the sticky scroll button as the last child in framework-managed mode.
   * The framework usually inserts bubbles before its own trailing nodes (so the
   * button stays last), but a plain `appendChild` at the very end (e.g. some
   * Angular @for paths) can land a bubble after it — move it back. Idempotent:
   * a no-op when already last, so it never loops the MutationObserver.
   */
  _keepScrollButtonLast() {
    this._scrollBtn && this.lastElementChild !== this._scrollBtn && this.appendChild(this._scrollBtn);
  }
  /** Current spacer height — a padding value (framework) or the element's height (core). */
  _getSpacerHeight() {
    return this._frameworkManagedDOM ? this._fwSpacerHeight : this._bottomSpacer?.offsetHeight ?? 0;
  }
  /** Set the spacer — host padding (framework, additive to base padding) or element height (core). */
  _setSpacerHeight(t) {
    this._frameworkManagedDOM ? (this._fwSpacerHeight = t, this.style.setProperty("--aparte-fw-spacer", `${t}px`)) : this._bottomSpacer && (this._bottomSpacer.style.height = `${t}px`);
  }
  // Bound fields, not inline arrows: a custom element is re-connected every
  // time it is MOVED in the DOM (a portal, a dialog, a framework re-parenting),
  // so `_setupEventListeners` runs again each time. An inline arrow can never
  // be handed to `removeEventListener`, so it just accumulates — one branch
  // click then ran N handlers, N active-path re-renders and N storage writes
  // through the conversation controller. The window listeners next to these
  // were always removed properly; these two, attached to `this`, were not.
  _onScrollBtnClick = () => {
    this._isAutoScrollEnabled = !0, this._smoothScrollToBottom(), this._updateScrollButton();
  };
  /**
   * Only the inputs that can SCROLL count as the reader's hand: a wheel notch, a
   * touch, a navigation key, a press in the scrollbar's gutter. A press on a control
   * inside the transcript — a branch arrow, a copy button — is not a scroll gesture,
   * and counting it disarmed the follow through the swap it triggered (react-webkit,
   * 1 run in 6: the rebuild's height churn moved scrollTop within the second after
   * the click, and the click made that look like the reader's).
   */
  /**
   * Is a pointer pressed on the surface right now? A press on the TEXT is not a scroll
   * gesture (`_noteReaderInput` counts only the gutter), but a hand that is down and
   * dragging a selection past the edge scrolls the container all the same — and that
   * decrease is the reader's. Held from the press to its release, wherever it lands.
   */
  _pointerHeld = !1;
  _holdPointer = () => {
    this._pointerHeld = !0;
  };
  _releasePointer = () => {
    this._pointerHeld = !1;
  };
  _noteReaderInput = (t) => {
    if (!(t.type === "keydown" && !this._scrollKeys.has(t.key))) {
      if (t.type === "pointerdown") {
        const e = this._container;
        if (!e) return;
        const { clientX: s } = t, r = e.getBoundingClientRect();
        if (!(getComputedStyle(e).direction === "rtl" ? s <= r.right - e.clientWidth : s >= r.left + e.clientWidth)) return;
      }
      if (this._readerInputAt = performance.now(), this._gliding() && this._container && (this._glideUntil = 0, t.type === "wheel" || t.type === "touchmove")) {
        this._ownScrollAt = performance.now();
        const e = this._container.scrollTop;
        this._container.scrollTop = e;
      }
    }
  };
  _onBranchNavigate = (t) => {
    const e = t;
    e.stopPropagation(), this.navigateBranch(e.detail.messageId, e.detail.direction);
  };
  _setupEventListeners() {
    this._container?.addEventListener("scroll", this._handleScroll, { passive: !0 }), this._container?.addEventListener("scrollend", this._handleScrollEnd, { passive: !0 });
    for (const t of ["wheel", "touchmove", "pointerdown", "keydown"])
      this._container?.addEventListener(t, this._noteReaderInput, { passive: !0 });
    this._container?.addEventListener("pointerdown", this._holdPointer, { passive: !0 }), document.addEventListener("pointerup", this._releasePointer, !0), document.addEventListener("pointercancel", this._releasePointer, !0), this._scrollBtn?.addEventListener("click", this._onScrollBtnClick), this.addEventListener("aparte-branch-navigate", this._onBranchNavigate);
  }
  _setupObservers() {
    this._resizeObserver = new ResizeObserver(() => {
      this._updateOverlayInset(), this._updateTranscriptInset(), this._isAutoScrollEnabled && this._scrollToBottom(), this._recalculateSpacer(), this._updateScrollButton();
    });
    const t = this.querySelector(".aparte-messages-wrapper");
    this._container && (this._frameworkManagedDOM ? this._resizeObserver.observe(this._container, { box: "border-box" }) : this._resizeObserver.observe(this._container)), this._wireOverlay(), this.parentElement && (this._overlayAttrObserver = new MutationObserver(() => this._wireOverlay()), this._overlayAttrObserver.observe(this.parentElement, { attributes: !0, attributeFilter: ["overlay-composer"] })), this._mutationObserver = new MutationObserver((s) => {
      if (this._lastMutationAt = performance.now(), s.some((i) => i.type === "childList" && (i.target === this || i.target.classList?.contains("aparte-messages-wrapper"))) && this._syncDateSeparators(), this._frameworkManagedDOM && this._keepScrollButtonLast(), this._isAutoScrollEnabled && !this._gliding()) {
        const i = s.flatMap((o) => Array.from(o.addedNodes)).filter((o) => o instanceof Element && o.tagName === "APARTE-CHAT-BUBBLE"), a = i.length === 1 ? i[0] : void 0;
        if (a && a.getAttribute("data-role") === "user" && a.parentElement) {
          const o = a.parentElement.querySelectorAll("aparte-chat-bubble");
          o[o.length - 1] === a && (this._smoothScrollOnce = !0);
        }
      }
      this._isAutoScrollEnabled && requestAnimationFrame(() => {
        this._isAutoScrollEnabled && this._scrollToBottom();
      }), this._scheduleSpacerUpdate();
      const r = (i) => Array.from(i).some((a) => a instanceof Element && (a.tagName === "APARTE-CHAT-BUBBLE" || a.querySelector("aparte-chat-bubble") !== null));
      s.some((i) => r(i.addedNodes) || r(i.removedNodes)) && this._observeTail();
    }), this._tailObserver = new ResizeObserver((s) => {
      let r = !1;
      for (const i of s) {
        const a = Math.round(i.borderBoxSize?.[0]?.blockSize ?? i.contentRect.height);
        this._tailHeights.get(i.target) !== a && (r = !0), this._tailHeights.set(i.target, a);
      }
      r && this._scheduleSpacerUpdate();
    }), this._observeTail(), this.addEventListener("toggle", this._onDisclosureToggle, !0);
    const e = this._frameworkManagedDOM ? this : t;
    e && this._mutationObserver.observe(e, {
      childList: !0,
      subtree: !0
    });
  }
  /**
   * Follow the `[overlay-composer]` shell: observe its stack when the attribute is
   * there, unobserve it and drop the var when it is gone. A no-op while the shell
   * has not changed — it runs at setup and on every write of the attribute.
   */
  _wireOverlay() {
    const t = this.closest("[overlay-composer]");
    if (t !== this._overlayRoot) {
      for (const e of this._overlayStack()) this._resizeObserver?.unobserve(e);
      if (this._overlayObserver?.disconnect(), this._overlayObserver = null, this._overlayRoot = t, this._overlayInset = -1, this.style.removeProperty("--aparte-bottom-inset"), !(!t || !this._resizeObserver)) {
        for (const e of this._overlayStack()) this._resizeObserver.observe(e);
        this._overlayObserver = new MutationObserver(() => {
          for (const e of this._overlayStack()) this._resizeObserver?.observe(e);
          this._updateOverlayInset();
        }), this._overlayObserver.observe(t, { childList: !0 }), this._updateOverlayInset();
      }
    }
  }
  /**
   * The overlay shell's element children that are the floating bottom stack: not this
   * viewport, and not the scroll rail, which floats over the transcript by design —
   * shell.css names it the same way (`:not(aparte-chat-viewport, aparte-scroll-rail)`).
   * Counted, a rail centred on the transcript set the inset to the distance from its
   * own top edge (398px on the vanilla example) and held it there while the composer
   * grew under a draft.
   */
  _overlayStack() {
    return this._overlayRoot ? Array.from(this._overlayRoot.children).filter(
      (t) => t instanceof HTMLElement && t !== this && t.tagName.toLowerCase() !== "aparte-scroll-rail"
    ) : [];
  }
  /**
   * Measure how much of this viewport the overlay stack covers, and publish it as
   * `--aparte-bottom-inset` — the `::after` spacer (framework mode), the
   * container's own padding (core mode) and the scroll button's `bottom` all read
   * it (shell.css). Measured from the stack's highest visible top edge rather
   * than by summing heights, so margins and anything the host renders between
   * the rows count themselves. No-op outside overlay mode, and when the value
   * has not changed — a var write invalidates layout, and this runs from the
   * ResizeObserver its own write can re-trigger (core mode observes the
   * container's content box, which the padding is part of).
   */
  _updateOverlayInset() {
    if (!this._overlayRoot) return;
    const t = this.getBoundingClientRect().bottom;
    let e = 1 / 0;
    for (const r of this._overlayStack()) {
      const i = r.getBoundingClientRect();
      i.height > 0 && (e = Math.min(e, i.top));
    }
    const s = e === 1 / 0 ? 0 : Math.max(0, Math.round(t - e));
    s !== this._overlayInset && (this._overlayInset = s, this.style.setProperty("--aparte-bottom-inset", `${s}px`));
  }
  /**
   * Publish, on the chat host, how far from the host's inline edge the rows start —
   * the transcript's padding plus the scrollbar gutter the scroller reserves on both
   * edges, at whatever step its container query has taken — as
   * `--aparte-transcript-inset`. The composer pads by it (composer.css), so its box
   * lands on the row's box at every width. The composer cannot know the gutter
   * and a container query cannot reach it, so this is the one place both boxes read
   * it from. Written only when the value changes, for the
   * same reason `_updateOverlayInset` is. On the HOST, not on this element: the
   * composer is a sibling, and a custom property only travels down.
   */
  _updateTranscriptInset() {
    const t = this.parentElement;
    if (!t) return;
    const e = this.querySelector(".aparte-messages-wrapper") ?? this._container ?? this, s = parseFloat(getComputedStyle(e).paddingInlineStart) || 0, r = getComputedStyle(t).direction === "rtl", i = e.getBoundingClientRect(), a = t.getBoundingClientRect(), o = r ? a.right - i.right : i.left - a.left, l = Math.max(0, Math.round((o + s) * 10) / 10);
    l !== this._transcriptInset && (this._transcriptInset = l, t.style.setProperty("--aparte-transcript-inset", `${l}px`));
  }
  /** Is the scroll surface within `_scrollThreshold` of its bottom, right now? */
  _isAtBottom() {
    if (!this._container) return !0;
    const { scrollTop: t, scrollHeight: e, clientHeight: s } = this._container;
    return e - t - s <= this._scrollThreshold;
  }
  _handleScroll() {
    if (!this._container) return;
    const t = this._container.scrollTop, e = this._container.scrollHeight, s = this._lastScrollTop - t, r = Math.abs(e - this._lastScrollHeight), i = performance.now(), a = e < this._lastScrollHeight - 1, o = i - this._lastMutationAt < this._settleShadowMs && s <= this._settleBoundPx, l = i - this._ownScrollAt < this._ownScrollWindowMs && i - this._readerInputAt >= this._ownScrollWindowMs && !this._pointerHeld && (s <= r + 2 || a || o), c = s > 1 && !l, d = s > 1 && i - this._readerInputAt < this._ownScrollWindowMs;
    this._lastScrollTop = t, this._lastScrollHeight = e, this._isAtBottom() && !d ? this._isAutoScrollEnabled = !0 : c ? this._isAutoScrollEnabled = !1 : s > 1 && l && this._isAutoScrollEnabled && this._settleAtBottom(), this._updateScrollButton();
  }
  _scrollToBottom() {
    if (this._container) {
      if (this._fitsOnceCentred()) {
        this._smoothScrollOnce = !1, this._gliding() && (this._glideUntil = 0, this._ownScrollAt = performance.now(), this._container.scrollTop = 0);
        return;
      }
      if (this._smoothScrollOnce) {
        this._smoothScrollOnce = !1, this._smoothScrollToBottom();
        return;
      }
      if (this._gliding()) {
        this._retargetGlide();
        return;
      }
      this._ownScrollAt = performance.now(), this._container.scrollTop = this._container.scrollHeight, this._settleAtBottom();
    }
  }
  /** The transcript will fit once the room the centring spacer under the composer still
   *  holds (`center-empty`, or a wrapper's auto-centre) is back. That room is 0 once the
   *  slide is over, and outside those layouts. */
  _fitsOnceCentred() {
    if (!this._container) return !1;
    const t = this._centringRoom();
    return t > 0 && this._container.scrollHeight - this._getSpacerHeight() <= this._container.clientHeight + t;
  }
  _centringRoom() {
    const t = this.closest("aparte-chat[center-empty], .aparte-chat-container--auto-center");
    return t && parseFloat(getComputedStyle(t, "::after").height) || 0;
  }
  _gliding() {
    return performance.now() < this._glideUntil;
  }
  /**
   * A second smooth `scrollTo` is continuous where an instant write is a cut. It is also a
   * new smooth scroll: the engine runs it from where the view is, for as long as a first
   * one takes, so it opens a window of its own. Left on the first glide's deadline, the
   * window closed in the middle of the re-targeted run and the next pin cut it —
   * react-webkit in CI, a write 4 px short of the bottom ~330 ms into a send that had
   * re-targeted a glide already running.
   */
  _retargetGlide() {
    this._container && (this._ownScrollAt = performance.now(), this._armGlide(), this._container.scrollTo({ top: this._container.scrollHeight, behavior: "smooth" }));
  }
  /** Open the glide window from now, and arm the pin that catches a glide that missed. */
  _armGlide() {
    this._glideUntil = performance.now() + this._glideWindowMs, this._glideSettleTimer !== null && clearTimeout(this._glideSettleTimer), this._glideSettleTimer = setTimeout(() => {
      if (this._glideSettleTimer = null, !this._container || !this._isAutoScrollEnabled || this._gliding()) return;
      const t = this._container.scrollHeight - this._container.clientHeight;
      this._container.scrollTop < this._lastScrollTop - 1 || t - this._container.scrollTop > 1 && this._scrollToBottom();
    }, this._glideWindowMs + 16);
  }
  /**
   * The browser says a scroll came to rest — the glide is over ONLY if it rested at the
   * bottom. WebKit fires `scrollend` when a smooth scroll is REPLACED by another (our own
   * re-target), 45–60 ms into the glide and hundreds of pixels short; taken at its word,
   * that would close the window and the next pin would be the cut this guard exists
   * to prevent. Short of the bottom, the budget keeps bounding the window.
   */
  _handleScrollEnd() {
    if (!this._container) return;
    this._container.scrollHeight - this._container.clientHeight - this._container.scrollTop <= 1 && (this._glideUntil = 0);
  }
  /**
   * Confirm over the next few frames that we actually reached the bottom.
   *
   * One assignment is not enough. Content can settle in several layout passes
   * (1118 → 1121 → 1152 px on Safari in framework mode), and `scrollTop =
   * scrollHeight` run against a middle pass clamps to that layout's max and leaves
   * the rest unclosed. Auto-follow stays armed the whole time, so the component is
   * not disarmed — it is SATISFIED: `_isAtBottom()` answers "yes" for any gap under
   * `_scrollThreshold` (50), which is the right rule for keeping auto-follow armed
   * and the wrong one as a definition of "anchored".
   *
   * A BOUNDED retry, not one corrective frame: a single frame lands on the same
   * stale layout and can leave a wider gap than doing nothing. Bounded so it always
   * terminates; re-reads `_isAutoScrollEnabled` every frame so a reader who scrolls
   * away mid-settle is left alone.
   *
   * Bounded by TIME, and it does not stop at the first closed gap. A branch swap at
   * the bottom of a long transcript churns the scrollable max (891 -> 1091 -> 891):
   * the gap is closed for a frame against the tall layout, the height falls back with
   * WebKit holding `scrollTop`, and the transcript would stand short with auto-follow
   * still armed. A frame count is a proxy for time that fails exactly on the slow
   * engine, so the budget is real milliseconds, and a closed gap only ends the chain
   * when the window is over. One chain, not one per call: during a stream every token
   * would otherwise start its own.
   */
  _settleAtBottom() {
    if (this._settleUntil = performance.now() + this._settleWindowMs, this._settleRafId !== null) return;
    const t = () => {
      if (this._settleRafId = null, !this.isConnected || !this._container || !this._isAutoScrollEnabled) {
        this._settleUntil = 0;
        return;
      }
      const e = this._container.scrollHeight - this._container.clientHeight;
      e - this._container.scrollTop > 1 && !this._gliding() && (this._ownScrollAt = performance.now(), this._container.scrollTop = e), performance.now() < this._settleUntil ? this._settleRafId = requestAnimationFrame(t) : this._settleUntil = 0;
    };
    this._settleRafId = requestAnimationFrame(t);
  }
  _smoothScrollToBottom() {
    this._container && (this._ownScrollAt = performance.now(), typeof this._container.scrollTo == "function" && !this._prefersReducedMotion() ? (this._armGlide(), this._container.scrollTo({ top: this._container.scrollHeight, behavior: "smooth" })) : this._container.scrollTop = this._container.scrollHeight);
  }
  _prefersReducedMotion() {
    return typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  /**
   * Show/hide the scroll-to-bottom button from the **current geometry**, not from
   * `_isAutoScrollEnabled`.
   *
   * The two answer different questions: the flag is intent ("should new content
   * pull the view down"), the button is a fact ("is there anything below the
   * fold"). Mirroring the flag would make the button lie whenever the two diverge —
   * `navigateBranch` deliberately disarms auto-follow, so swapping a branch while
   * already at the bottom of a scrollable transcript would leave the button offering
   * to scroll nowhere. Re-derived on scroll, on the
   * post-mutation frame and after a path swap, so it converges to the truth
   * whatever a framework's render timing does in between.
   */
  _updateScrollButton() {
    const t = this._scrollBtn;
    if (!t) return;
    const e = this._isAtBottom();
    t.classList.contains("aparte-scroll-btn--hidden") === e && t.hasAttribute("tabindex") === e || (t.classList.toggle("aparte-scroll-btn--hidden", e), e ? (t.setAttribute("tabindex", "-1"), t.setAttribute("aria-hidden", "true")) : (t.removeAttribute("tabindex"), t.removeAttribute("aria-hidden")));
  }
  /**
   * Recalculate the bottom spacer height so the last user message is always
   * pinned to the top of the scroll area when a response is being generated.
   *
   * spacer = max(0, viewportHeight - lastUserBubble.offsetHeight - lastAssistantBubble.offsetHeight)
   *
   * The spacer shrinks progressively as the assistant streams content, eventually
   * reaching 0 when the combined height fills the viewport.
   */
  _recalculateSpacer() {
    if (!this._container || !this._frameworkManagedDOM && !this._bottomSpacer || Date.now() < this._spacerFrozenUntil) return;
    const t = Array.from(
      this.querySelectorAll("aparte-chat-bubble")
    );
    if (t.length === 0) {
      this._setSpacerHeight(0);
      return;
    }
    const e = [...t].reverse().find((u) => u.getAttribute("data-role") === "user");
    if (!e) {
      this._setSpacerHeight(0);
      return;
    }
    const s = this._getSpacerHeight(), r = this._container.getBoundingClientRect(), a = e.getBoundingClientRect().top - r.top + this._container.scrollTop, o = this._container.scrollHeight - s;
    if (o <= this._container.clientHeight + this._centringRoom()) {
      this._setSpacerHeight(0);
      return;
    }
    const l = o - a, c = parseFloat(getComputedStyle(this._container).scrollPaddingTop) || 0, d = this._container.clientHeight - c - l, h = this._container.clientHeight;
    this._setSpacerHeight(Math.min(Math.max(0, d), h)), this._isAutoScrollEnabled && this._scrollToBottom();
  }
  /** Point `_tailObserver` at the last question and the bubbles after it, and only those. */
  _observeTail() {
    if (!this._tailObserver) return;
    const t = Array.from(this.querySelectorAll("aparte-chat-bubble"));
    let e = t.length;
    for (; e > 0 && t[e - 1].getAttribute("data-role") !== "user"; ) e--;
    const s = e > 0 ? t.slice(e - 1) : [];
    for (const r of this._tail) s.includes(r) || this._tailObserver.unobserve(r);
    for (const r of s)
      this._tail.includes(r) || (this._tailHeights.set(r, Math.round(r.offsetHeight)), this._tailObserver.observe(r, { box: "border-box" }));
    this._tail = s;
  }
  /**
   * Schedule a spacer recalculation on the next animation frame.
   * Batches multiple rapid calls (e.g. during token streaming) into one.
   *
   * Single-RAF intentional: both the scroll-to-bottom queued by MutationObserver
   * and this spacer recalculation must land in the *same* frame so the browser
   * paints exactly once — with the correct scroll position *and* the correct
   * spacer height. A double-RAF would put the spacer shrink one frame after the
   * scroll, causing a 1-frame layout jump during streaming.
   */
  _scheduleSpacerUpdate() {
    this._spacerRafId === null && (this._spacerRafId = requestAnimationFrame(() => {
      this._spacerRafId = null, this._recalculateSpacer(), this._updateScrollButton();
    }));
  }
  /**
   * Cap the number of rendered bubbles in the DOM (perf ceiling only).
   *
   * Drops the oldest `<aparte-chat-bubble>` elements beyond `_maxRenderedBubbles`
   * from the DOM. It **never** touches the AparteMessageRepository — the conversation
   * model and its persistence snapshot stay complete (retention/eviction is a
   * consumer/persistence concern, not the viewport's). No-op when a framework
   * owns the DOM.
   */
  _pruneRenderedBubbles() {
    if (this._frameworkManagedDOM) return;
    const t = this.querySelector(".aparte-messages-wrapper");
    if (!t) return;
    const e = t.querySelectorAll("aparte-chat-bubble"), s = e.length - this._maxRenderedBubbles;
    for (let r = 0; r < s; r++)
      e[r]?.remove();
  }
  _cleanup() {
    this._container?.removeEventListener("scroll", this._handleScroll), this._container?.removeEventListener("scrollend", this._handleScrollEnd), this._glideSettleTimer !== null && (clearTimeout(this._glideSettleTimer), this._glideSettleTimer = null);
    for (const t of ["wheel", "touchmove", "pointerdown", "keydown"])
      this._container?.removeEventListener(t, this._noteReaderInput);
    this._container?.removeEventListener("pointerdown", this._holdPointer), document.removeEventListener("pointerup", this._releasePointer, !0), document.removeEventListener("pointercancel", this._releasePointer, !0), this._pointerHeld = !1, this._scrollBtn?.removeEventListener("click", this._onScrollBtnClick), this.removeEventListener("aparte-branch-navigate", this._onBranchNavigate), this._resizeObserver?.disconnect(), this._mutationObserver?.disconnect(), this._tailObserver?.disconnect(), this._tailObserver = null, this._tail = [], this.removeEventListener("toggle", this._onDisclosureToggle, !0), this._overlayObserver?.disconnect(), this._overlayObserver = null, this._overlayAttrObserver?.disconnect(), this._overlayAttrObserver = null, this._overlayRoot = null, this._overlayInset = -1, this._transcriptInset = -1, this._resizeObserver = null, this._mutationObserver = null, this._spacerRafId !== null && (cancelAnimationFrame(this._spacerRafId), this._spacerRafId = null), this._settleRafId !== null && (cancelAnimationFrame(this._settleRafId), this._settleRafId = null), this._settleUntil = 0;
  }
}
rt(Ec);
customElements.get("aparte-chat-viewport") || customElements.define("aparte-chat-viewport", Ec);
const wg = [
  "input",
  "textarea",
  "select",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="tree"]',
  '[role="grid"]'
].join(", "), Sg = "aparte-chat, [data-aparte-chat]";
function Ag(n) {
  const t = n.getAttribute("type-to-focus");
  return t === "page" || t === "off" ? t : "chat";
}
function kg(n) {
  if (n.defaultPrevented || n.isComposing) return !1;
  const t = n.getModifierState?.("AltGraph") === !0;
  return (n.ctrlKey || n.metaKey || n.altKey) && !t ? !1 : n.key === "Dead" ? !0 : n.key.length === 1 && n.key !== " ";
}
function Eg(n) {
  let t = n.activeElement;
  for (; t?.shadowRoot?.activeElement; ) t = t.shadowRoot.activeElement;
  return t;
}
function Cg(n) {
  const t = n.ownerDocument;
  let e = !1;
  const s = () => {
    const a = n.getAttribute("target"), o = n.closest(Sg) ?? (a ? t.getElementById(a) : null);
    return o ? [o, n] : [n];
  }, r = (a) => {
    const o = a.composedPath();
    e = s().some((l) => o.includes(l));
  }, i = (a) => {
    const o = Ag(n);
    if (o === "off" || !kg(a) || n.hasAttribute("disabled")) return;
    const l = n.querySelector("aparte-composer-input");
    if (!l || l.hasAttribute("disabled")) return;
    const c = Eg(t);
    if (!c?.closest(wg)) {
      if (o === "chat") {
        const d = !c || c === t.body || c === t.documentElement;
        if (!(!d && s().some((u) => u.contains(c))) && !(d && e)) return;
      }
      l.focusEnd?.();
    }
  };
  return t.addEventListener("pointerdown", r, !0), t.addEventListener("keydown", i), () => {
    t.removeEventListener("pointerdown", r, !0), t.removeEventListener("keydown", i);
  };
}
const xg = /* @__PURE__ */ new Set(["text", "search", "email", "url", "tel", "number", "password"]);
function Tg(n) {
  return n instanceof HTMLTextAreaElement ? n.rows === 1 : n instanceof HTMLInputElement && xg.has(n.type);
}
class hs extends HTMLElement {
  _value = "";
  _streaming = !1;
  _attachments = [];
  _listeners = /* @__PURE__ */ new Map();
  _panelActive = !1;
  /** What the send button means while a panel is up — see `showPanel`. */
  _panelMode = "submit";
  _panelSubmitEnabled = !1;
  _panelOnSubmit = null;
  /**
   * Who owns the one panel slot, and how to tell them they lost it.
   *
   * There is exactly one slot and `showPanel` empties it unconditionally, so every
   * path that closes a panel whose owner is still awaiting an answer — a second
   * `showPanel`, `hidePanel` without the owner's token, `_handleMessageDone` (which
   * fires on EVERY turn end) — must tell the owner. An owner that is not told keeps
   * its request pending, and every later request is short-circuited behind it.
   */
  _panelToken = null;
  _panelOnEvict = null;
  // Internal bus events that represent an observable STATE change — these are
  // mirrored to the public `aparte-composer-change` DOM event. `submit`/`cancel`
  // are actions, not state, and are covered by `aparte-send`/`aparte-cancel`.
  static _STATE_EVENTS = /* @__PURE__ */ new Set([
    "value-change",
    "streaming-change",
    "disabled-change",
    "attachments-change",
    "panel-change"
  ]);
  // Window event bindings
  _onMessageStart = this._handleMessageStart.bind(this);
  _onMessageDone = this._handleMessageDone.bind(this);
  /** Config governing THIS composer (nearest instance boundary, else global). */
  /**
   * Resolved LIVE, not cached at connect.
   *
   * A wrapper runs `AparteChatHost.bind()` — which calls `attachConfig` — from its
   * POST-mount hook, so this element connects BEFORE the boundary exists. Caching
   * would latch the global config forever: an instance `config` carrying an RTL
   * locale would flip the transcript and not the composer, and the
   * `requireModelSelection` gate would be read off the wrong object.
   * `aparte-chat-bubble` resolves live too, and its JSDoc names this race.
   */
  get _cfg() {
    return $(this);
  }
  /** Only OUR config: a change on another chat's instance must not touch us. */
  _onConfigChangeEvent = (t) => {
    const e = t.detail;
    e?.config && e.config !== this._cfg || this._onConfigChange();
  };
  /** True while `requireModelSelection` is on AND no model is selected — blocks send. */
  _modelGated = !1;
  _onConfigChange = () => {
    this._evaluateModelGate(), this._applyDirection();
  };
  /**
   * Mirror `locale.direction` onto ourselves, so everything inside — input, buttons,
   * the toolbar row and whatever the consumer put in it — inherits it.
   *
   * Without it an RTL locale flips the conversation and leaves the composer
   * left-to-right. It is also what makes the toolbar's placement idiom real:
   * `margin-inline-start: auto` in a subtree that inherits no direction is just
   * `margin-left`.
   *
   * One attribute on the host rather than a stamp per child: inheritance is the
   * mechanism, so nothing needs to know about the consumer's markup.
   */
  _applyDirection() {
    const t = (this._cfg ?? $(this)).getLocale().direction;
    t ? this.setAttribute("dir", t) : this.removeAttribute("dir");
  }
  static get observedAttributes() {
    return ["placeholder", "disabled", "target"];
  }
  /** Stops the document listeners of `type-to-focus`; null while disconnected. */
  _offTypeToFocus = null;
  connectedCallback() {
    window.addEventListener("aparte-message-start", this._onMessageStart), window.addEventListener("aparte-message-done", this._onMessageDone), window.addEventListener("aparte-message-error", this._onMessageDone), window.addEventListener("aparte-message-aborted", this._onMessageDone), window.addEventListener("aparte-config-change", this._onConfigChangeEvent), queueMicrotask(() => this._warnIfUnattached()), this._evaluateModelGate(), this._applyDirection(), this._offTypeToFocus?.(), this._offTypeToFocus = Cg(this);
  }
  disconnectedCallback() {
    window.removeEventListener("aparte-message-start", this._onMessageStart), window.removeEventListener("aparte-message-done", this._onMessageDone), window.removeEventListener("aparte-message-error", this._onMessageDone), window.removeEventListener("aparte-message-aborted", this._onMessageDone), window.removeEventListener("aparte-config-change", this._onConfigChangeEvent), this._listeners.clear(), this._offTypeToFocus?.(), this._offTypeToFocus = null;
  }
  attributeChangedCallback(t, e, s) {
    if (t === "disabled" && this._emit("disabled-change", { disabled: s !== null }), t === "placeholder")
      for (const r of this.querySelectorAll("aparte-composer-input"))
        r.syncPlaceholder?.();
  }
  // ── Public API ─────────────────────────────────────────────────────────
  get value() {
    return this._value;
  }
  get streaming() {
    return this._streaming;
  }
  get disabled() {
    return this.hasAttribute("disabled");
  }
  /**
   * The attribute is the state, so the property writes it. It has to exist: React 19
   * and Svelte assign the PROPERTY whenever the element has one of that name, and a
   * getter alone would make `<aparte-composer disabled="">` — a spelling the wrappers
   * type as valid — throw and take the render down. `presenceOn` because `''` is what
   * those templates hand a presence property.
   */
  set disabled(t) {
    this.toggleAttribute("disabled", mt(t));
  }
  /**
   * When false, Shift+Enter submits and a bare Enter inserts a newline —
   * the inverse of the default. Driven by the `submit-on-enter` attribute, and it
   * holds in a panel's one-line fields as it does in the editor.
   */
  get submitOnEnter() {
    return this.getAttribute("submit-on-enter") !== "false";
  }
  get attachments() {
    return this._attachments;
  }
  get placeholder() {
    return this.getAttribute("placeholder") ?? "";
  }
  /** Writes the attribute the inputs read (see `disabled` for why the setter exists). */
  set placeholder(t) {
    t == null ? this.removeAttribute("placeholder") : this.setAttribute("placeholder", String(t));
  }
  get targetId() {
    return this.getAttribute("target");
  }
  /**
   * Snapshot of the composer's observable state. Pair with the
   * `aparte-composer-change` DOM event to drive a custom send button or footer
   * control that lives outside the composer package:
   *
   * @example
   * // A custom send button. Keep it CLICKABLE while streaming — submit()
   * // routes to cancel() when a response is in flight, so one button is
   * // Send/Stop. Disabling it on `streaming` would make "stop" unreachable.
   * composer.addEventListener('aparte-composer-change', (e) => {
   *   const { streaming, disabled, value, attachments } = e.detail.state;
   *   myButton.textContent = streaming ? 'Stop' : 'Send';
   *   myButton.disabled = disabled || (!streaming && !value.trim() && attachments.length === 0);
   * });
   * myButton.addEventListener('click', () => composer.submit()); // send or stop
   */
  getState() {
    return {
      value: this._value,
      streaming: this._streaming,
      disabled: this.disabled,
      attachments: [...this._attachments],
      panelActive: this._panelActive,
      submitEnabled: this._panelSubmitEnabled
    };
  }
  /**
   * Set the composer's value — both what a send will submit and what the editor
   * shows. `<aparte-composer-input>` writes through any value it does not already
   * hold, so this prefills the visible field (a template button, a restored draft)
   * as readily as it stages text for an immediate `submit()`.
   */
  setValue(t) {
    this._value = t, this._emit("value-change", { value: t });
  }
  /** Append files to the pending attachments and notify. Does not de-duplicate. */
  addAttachments(t) {
    this._attachments = [...this._attachments, ...Array.from(t)], this._emit("attachments-change", { attachments: this._attachments });
  }
  /**
   * Show how an attachment's upload is going, for an app that uploads as soon as a file
   * is picked. While one is `uploading`, nothing is sent. `null` clears it.
   */
  setAttachmentState(t, e) {
    e ? this._attachmentStates.set(t, e) : this._attachmentStates.delete(t), this._syncUploading(), this.querySelector("aparte-composer-attachments")?.showState(t, e);
  }
  /** The state {@link setAttachmentState} last gave this file. */
  getAttachmentState(t) {
    return this._attachmentStates.get(t);
  }
  _attachmentStates = /* @__PURE__ */ new WeakMap();
  get _uploading() {
    return this._attachments.some((t) => this._attachmentStates.get(t)?.status === "uploading");
  }
  /** Reflected for the shipped CSS, the way the model gate is. */
  _syncUploading() {
    this.toggleAttribute("data-uploading", this._uploading);
  }
  /**
   * Drop one pending attachment and notify. Matched by IDENTITY — pass the same
   * `File` object the composer handed you, not an equal one; two picks of the same
   * file on disk are two distinct objects.
   */
  removeAttachment(t) {
    this._attachments = this._attachments.filter((e) => e !== t), this._syncUploading(), this._emit("attachments-change", { attachments: this._attachments });
  }
  /** Drop every pending attachment and notify. */
  clearAttachments() {
    this._attachments = [], this._syncUploading(), this._emit("attachments-change", { attachments: [] });
  }
  /**
   * Inject a panel into the composer. The send button calls `onSubmit` when clicked.
   *
   * While a panel is up, the composer is answering a QUESTION, not composing a
   * message — so the affordances that lead nowhere go away with the text input:
   * the attachment picker above all, which would otherwise stay clickable while the
   * user is being asked something. An affordance nothing can honour is not rendered.
   *
   * What STAYS, deliberately: the attachments strip, because pending attachments
   * are the user's state and not an action to offer — hiding them would look like
   * losing them; and the toolbar, because switching model still does something.
   *
   * The send button is the part the PANEL decides, through `mode`. `'submit'`
   * keeps it; `'none'` says this panel has no act for it and it is not drawn. `'none'`
   * is what a panel whose options settle on the first click needs — a single-choice
   * question, an approval. Flip between them at any time with
   * {@link setPanelSubmitEnabled}, which is how a panel that grows an act (an
   * "Other…" field, a written instruction) turns the button back on.
   *
   * The mode is declared with an attribute + CSS rather than inline `style.display`
   * on a child: an attribute is themeable, is visible to a consumer's own rules, and
   * does not clobber a `display` the consumer set.
   *
   * Returns the TOKEN for this panel. Pass it back to `hidePanel` so a presenter
   * that has already lost the slot cannot close the panel that replaced it, and
   * supply `onEvict` to be told when that happens — an owner that is not told is an
   * owner whose promise nobody can settle.
   */
  showPanel(t, e) {
    this._evictPanel();
    const s = this.querySelector("[data-aparte-panel-host]"), r = this.querySelector("aparte-composer-input");
    this.setAttribute("data-panel-active", ""), t.dataset.apartePanel = "true", t.addEventListener("keydown", this._onPanelKeydown), s ? s.appendChild(t) : r ? r.insertAdjacentElement("afterend", t) : this.appendChild(t), this._panelActive = !0, this._panelSubmitEnabled = e?.submitEnabled ?? !1, this._panelMode = e?.mode ?? "submit", this._reflectPanelMode(), this._panelOnSubmit = e?.onSubmit ?? null, this._panelOnEvict = e?.onEvict ?? null;
    const i = Symbol("aparte-composer-panel");
    return this._panelToken = i, this._emit("panel-change", { active: !0, submitEnabled: this._panelSubmitEnabled, mode: this._panelMode }), i;
  }
  /**
   * Remove the panel, tell its owner, and restore the composer's own controls.
   *
   * With a `token`, this closes the panel only if that token still owns the slot —
   * so a presenter settling late cannot tear down the panel that replaced it. With
   * no token it closes whatever is there, which is what a consumer driving the
   * composer directly means.
   *
   * The two forms differ on purpose, and the difference is who already knows:
   *
   * - **With a matching token** the OWNER is closing its own panel, which is what
   *   `<aparte-elicitation>`'s `close()` does right after it resolves. It must NOT be
   *   notified — telling it "you were evicted" for a request it just settled would
   *   fire `onEvict` against a finished promise.
   * - **With no token** somebody else is closing a panel they do not own, so the owner
   *   cannot know and has to be told. That includes the presenter's own defensive
   *   `hidePanel(undefined)` when it settles before `showPanel` ran: whatever is open
   *   then belongs to another request, and that request must not orphan.
   */
  hidePanel(t) {
    if (t !== void 0) {
      if (t !== this._panelToken) return;
      this._teardownPanel();
      return;
    }
    this._evictPanel();
  }
  /**
   * Enter in a panel's one-line field presses the send button, as it does in the editor.
   *
   * The panel takes the editor's place and the editor was the only thing listening, so
   * what a person wrote in a panel went out by mouse alone: Enter added a line to an
   * approval's instruction and did nothing in a question's text box. It lives here, once,
   * because the button is the composer's and so is `submit-on-enter`; `submit()` then
   * applies the panel's own gates (no act for the button, nothing written, put aside).
   * The key is cancelled even when nothing can be sent, as the editor does, so an empty
   * field does not fill with blank lines.
   *
   * Same IME guard as the editor: that Enter confirms a candidate. `defaultPrevented`
   * leaves the key to a field that used it, a combobox picking its highlighted row.
   */
  _onPanelKeydown = (t) => {
    t.key !== "Enter" || t.isComposing || t.keyCode === 229 || t.defaultPrevented || !Tg(t.target) || !(this.submitOnEnter ? !t.shiftKey : t.shiftKey) || (t.preventDefault(), this.submit());
  };
  /** Close the panel AND tell its owner, so a pending request never orphans. */
  _evictPanel() {
    const t = this._panelOnEvict;
    this._teardownPanel(), t?.();
  }
  _teardownPanel() {
    const t = document.activeElement, e = t instanceof Node && this.contains(t), s = this.querySelector("[data-aparte-panel]");
    s && s.remove(), this.removeAttribute("data-panel-active"), this._panelActive = !1, this._panelSubmitEnabled = !1, this._panelMode = "submit", this._reflectPanelMode(), this._panelOnSubmit = null, this._panelOnEvict = null, this._panelToken = null, this._emit("panel-change", { active: !1, submitEnabled: !1, mode: "submit" }), e && this.focus();
  }
  /**
   * Update the send button's state while a panel is active.
   *
   * `mode` moves with it because both can change on the same event — opening the
   * "Other…" field of a panel whose options settle on the click gives the button
   * an act it did not have — and two separate calls would flash a wrong state
   * between them.
   */
  setPanelSubmitEnabled(t, e) {
    this._panelActive && (this._panelSubmitEnabled = t, e && (this._panelMode = e), this._reflectPanelMode(), this._emit("panel-change", { active: !0, submitEnabled: t, mode: this._panelMode }));
  }
  /**
   * Publish the panel mode as an attribute, so CSS can act on it.
   *
   * The same reasoning `data-panel-active` is set for: an attribute is themeable, is
   * visible to a consumer's own rules, and does not clobber what the consumer set. It
   * is what lets `'none'` remove the send button without this component reaching
   * into it.
   */
  _reflectPanelMode() {
    this._panelActive ? this.setAttribute("data-panel-mode", this._panelMode) : this.removeAttribute("data-panel-mode");
  }
  get panelActive() {
    return this._panelActive;
  }
  /**
   * Recompute the model gate from the resolved config. When
   * `requireModelSelection` is on and no model is selected, block sending and
   * reflect `data-model-gated` so the shipped CSS greys the composer. Re-runs on
   * every config change (e.g. the model selector's auto-select firing).
   */
  _evaluateModelGate() {
    const t = this._cfg.getRequireModelSelection() && !this._cfg.hasSelectedModel();
    t !== this._modelGated && (this._modelGated = t, this.toggleAttribute("data-model-gated", t));
  }
  /** Submit the current value. Called by aparte-composer-send or programmatically. */
  submit() {
    if (this._panelActive) {
      this._panelMode !== "none" && this._panelSubmitEnabled && this._panelOnSubmit?.();
      return;
    }
    if (this._streaming) {
      this.cancel();
      return;
    }
    const t = this._value.trim();
    if (!t && this._attachments.length === 0 || this.disabled || this._modelGated || this._uploading) return;
    this._emit("submit", { value: t, attachments: this._attachments });
    const e = this.querySelector("aparte-composer-input")?.getTokens?.(), s = {
      content: t,
      timestamp: Date.now(),
      /*
       * `_ownTargetId()`, not the bare attribute — the same resolution `cancel()`
       * uses, and for the same reason. The wrappers all set `target`, so this is
       * byte-identical there; in RAW core nothing writes it, so every send carried
       * `targetId: undefined` and a page with two hand-written chats delivered the
       * reply to whichever one the host resolved first.
       */
      targetId: this._ownTargetId(),
      files: this._attachments.length > 0 ? [...this._attachments] : void 0,
      ...e?.length ? { tokens: e } : {}
    };
    this.dispatchEvent(new CustomEvent("aparte-send", {
      bubbles: !0,
      composed: !0,
      detail: s
    })), this.setValue(""), this.clearAttachments();
  }
  /** Cancel the current streaming response. */
  cancel() {
    this._emit("cancel", {}), this.dispatchEvent(new CustomEvent("aparte-cancel", { bubbles: !0, composed: !0 }));
    const t = { targetId: this._ownTargetId() };
    window.dispatchEvent(new CustomEvent("aparte-abort", { bubbles: !1, detail: t })), window.dispatchEvent(new CustomEvent("aparte-message-aborted", { bubbles: !1, detail: t }));
  }
  /**
   * Reset the composer to its initial state.
   * Clears value, attachments, and hides any active panel.
   * Call this when switching conversations.
   */
  reset() {
    this.setValue(""), this.clearAttachments(), this._panelActive && this._evictPanel();
  }
  /** Focus the input primitive inside this composer. */
  focus() {
    this.querySelector("aparte-composer-input")?.focus();
  }
  // ── Internal pub/sub ────────────────────────────────────────────────────
  /** @internal The composer parts' own bus. From outside, listen for `aparte-composer-change`. */
  _emit(t, e) {
    this._listeners.get(t)?.forEach((s) => s(e)), hs._STATE_EVENTS.has(t) && this.dispatchEvent(new CustomEvent("aparte-composer-change", {
      bubbles: !0,
      composed: !0,
      detail: { state: this.getState(), composer: this }
    }));
  }
  /** @internal The composer parts' own bus. From outside, listen for `aparte-composer-change`. */
  _on(t, e) {
    return this._listeners.has(t) || this._listeners.set(t, /* @__PURE__ */ new Set()), this._listeners.get(t).add(e), () => this._listeners.get(t)?.delete(e);
  }
  // ── Window events ───────────────────────────────────────────────────────
  /** A window lifecycle event is for THIS composer when neither side is scoped
   *  (single-instance broadcast) or the target ids match (multi-chat page).
   *  Without this filter, streaming in one chat flips every composer's state. */
  _isForThisComposer(t) {
    const e = t.detail?.targetId;
    return !e || !this._ownTargetId() || e === this._ownTargetId();
  }
  /**
   * Which chat this composer belongs to: its `target` attribute, or the id of the
   * chat host above it.
   *
   * All four wrappers set `target` themselves. In RAW core — the documented quick
   * start, where the markup is hand-written — nothing sets it, so the chat host above
   * is what identifies the composer; without either, it would accept every chat's
   * lifecycle events and, on a two-chat page, one chat's Stop would tear down the
   * other's open elicitation panel.
   *
   * The hosts matched are the ones `aparte-chat-bubble._resolveTargetId()` matches,
   * for the reason written there — Angular's wrapper root IS `<aparte-chat>`, the
   * other three render a `[data-aparte-chat]` div.
   */
  /**
   * A signal, not a guard: on a page with several chats, a composer attached to none
   * answers to every chat's lifecycle events (see `_ownTargetId`), and the symptom —
   * one chat's Stop evicting another's open question — is nowhere near its cause.
   * Said once, at the console, where the developer is.
   */
  _warnIfUnattached() {
    !this.isConnected || this._ownTargetId() || document.querySelectorAll("aparte-chat, [data-aparte-chat]").length < 2 || console.warn(`[aparte-composer] this composer belongs to no chat while the page has several: give it target="<chat id>" or place it under a chat host with an id, or it will answer to every chat's events.`);
  }
  _ownTargetId() {
    const t = this.targetId;
    if (t) return t;
    let e = this.parentElement;
    for (; e; ) {
      if ((e.tagName?.toLowerCase() === "aparte-chat" || e.hasAttribute?.("data-aparte-chat")) && e.id) return e.id;
      e = e.parentElement;
    }
  }
  /**
   * The message this composer's turn is writing, when the event that started it said.
   * Kept so the END of a DIFFERENT turn cannot be read as the end of this one — see
   * `_isForThisTurn`.
   */
  _streamingMessageId = null;
  /**
   * Whether a terminal event ends the turn this composer is following.
   *
   * `_isForThisComposer` answers "is this chat's?", and both turns of a retry belong
   * to the same chat: the client aborts the superseded reply and the engine emits
   * `run-aborted` for it, which must not turn Stop back into Send while the new reply
   * is still streaming, nor evict the open panel (the approval question a tool is
   * still waiting on). An event with no `messageId` still ends the turn: a loop of
   * one's own saying "done" means this one.
   */
  _isForThisTurn(t) {
    const e = t.detail?.messageId;
    return !e || this._streamingMessageId === null || e === this._streamingMessageId;
  }
  _handleMessageStart(t) {
    this._isForThisComposer(t) && (this._streamingMessageId = t.detail?.messageId ?? null, this._streaming = !0, this._emit("streaming-change", { streaming: !0 }));
  }
  _handleMessageDone(t) {
    !this._isForThisComposer(t) || !this._isForThisTurn(t) || (this._streamingMessageId = null, this._streaming = !1, this._emit("streaming-change", { streaming: !1 }), this._panelActive && this._evictPanel());
  }
}
rt(hs);
customElements.get("aparte-composer") || customElements.define("aparte-composer", hs);
function Cc(n, t) {
  const e = (n ?? "").split(",").map((i) => i.trim().toLowerCase()).filter(Boolean);
  if (e.length === 0) return !0;
  const s = t.name.toLowerCase(), r = t.type.toLowerCase();
  return e.some((i) => i.startsWith(".") ? s.endsWith(i) : i.endsWith("/*") ? r.startsWith(i.slice(0, -1)) : r === i);
}
const ri = "data-aparte-token", xc = "data-aparte-text", Ig = "￼", fn = (n) => n.nodeType === Node.TEXT_NODE, Rg = (n) => n.nodeType === Node.ELEMENT_NODE && n.hasAttribute(ri), Tc = (n) => Array.prototype.indexOf.call(n.parentNode.childNodes, n);
function gn(n, t = []) {
  return n.childNodes.forEach((e) => {
    fn(e) || e.nodeName === "BR" || Rg(e) ? t.push(e) : gn(e, t);
  }), t;
}
const Ic = (n) => fn(n) ? n.data.length : 1;
function Lg(n) {
  return gn(n).map((t) => fn(t) ? t.data : t.nodeName === "BR" ? `
` : Ig).join("");
}
function Mg(n, t, e) {
  const s = n.ownerDocument.createRange();
  s.setStart(t, e), s.collapse(!0);
  let r = 0;
  for (const i of gn(n)) {
    if (i === t) return r + e;
    if (s.comparePoint(i.parentNode, Tc(i)) >= 0) return r;
    r += Ic(i);
  }
  return r;
}
function ro(n, t) {
  let e = t;
  for (const s of gn(n)) {
    if (fn(s) && e <= s.data.length) return [s, e];
    if (e === 0) return [s.parentNode, Tc(s)];
    e -= Ic(s);
  }
  return [n, n.childNodes.length];
}
function io(n, t, e) {
  const s = n.ownerDocument.createRange();
  return s.setStart(...ro(n, t)), s.setEnd(...ro(n, e)), s;
}
function ao(n, t, e) {
  const s = n.createElement("span");
  s.className = "aparte-tag aparte-inline-token", s.setAttribute("contenteditable", "false"), s.setAttribute(ri, t), s.setAttribute(xc, e.text ?? e.label), e.kind && (s.dataset.kind = e.kind);
  const r = n.createElement("span");
  return r.className = "aparte-tag__label", r.textContent = e.label, s.appendChild(r), s;
}
function oo(n, t) {
  let e = "";
  const s = [];
  for (const i of gn(n))
    if (fn(i)) e += i.data;
    else if (i.nodeName === "BR") e += `
`;
    else {
      const a = i, o = t.get(a.getAttribute(ri) ?? ""), l = a.getAttribute(xc) ?? a.textContent ?? "", c = e.length;
      e += l, s.push({
        label: a.textContent ?? "",
        text: l,
        start: c,
        end: e.length,
        ...a.dataset.kind ? { kind: a.dataset.kind } : {},
        ...o?.data !== void 0 ? { data: o.data } : {}
      });
    }
  const r = e.length - e.trimStart().length;
  return { value: e.trim(), tokens: s.map((i) => ({ ...i, start: i.start - r, end: i.end - r })) };
}
class Rc extends HTMLElement {
  _editor = null;
  _maxHeight = 200;
  _minHeight = 44;
  /**
   * Re-measures the editor when its WIDTH changes.
   */
  _resizeObserver = null;
  _unsubscribes = [];
  // Bound handlers
  _onInput = this._handleInput.bind(this);
  _onKeydown = this._handleKeydown.bind(this);
  _onFocus = this._handleFocus.bind(this);
  _onBlur = this._handleBlur.bind(this);
  _onPaste = this._handlePaste.bind(this);
  static get observedAttributes() {
    return ["placeholder", "max-height", "min-height", "disabled"];
  }
  connectedCallback() {
    this._render(), this._editor = this.querySelector(".aparte-ci-editor"), this._editor?.addEventListener("input", this._onInput), this._editor?.addEventListener("keydown", this._onKeydown), this._editor?.addEventListener("focus", this._onFocus), this._editor?.addEventListener("blur", this._onBlur), this._editor?.addEventListener("paste", this._onPaste), this._connectToRoot(), this._scheduleInitialReflow(), this._editor && typeof ResizeObserver == "function" && (this._resizeObserver = new ResizeObserver(() => this._adjustHeight()), this._resizeObserver.observe(this._editor)), this._unsubscribes.push(pe(this, () => this._updatePlaceholder()));
  }
  disconnectedCallback() {
    this._editor?.removeEventListener("input", this._onInput), this._editor?.removeEventListener("keydown", this._onKeydown), this._editor?.removeEventListener("focus", this._onFocus), this._editor?.removeEventListener("blur", this._onBlur), this._editor?.removeEventListener("paste", this._onPaste), this._resizeObserver?.disconnect(), this._resizeObserver = null, this._unsubscribes.forEach((t) => t()), this._unsubscribes = [];
  }
  attributeChangedCallback(t, e, s) {
    t === "placeholder" && this._updatePlaceholder(), t === "max-height" && (this._maxHeight = parseInt(s || "200", 10)), t === "min-height" && (this._minHeight = parseInt(s || "44", 10)), t === "disabled" && this._updateDisabled(s !== null);
  }
  // ── Public API ──────────────────────────────────────────────────────────
  /**
   * The editor's text, with `<br>` serialized back to newlines — `textContent`
   * alone would collapse a multi-line draft onto a single line.
   */
  getValue() {
    return this._editor ? oo(this._editor, this._tokens).value : "";
  }
  /** The tokens in the draft, with their place in {@link getValue}. */
  getTokens() {
    return this._editor ? oo(this._editor, this._tokens).tokens : [];
  }
  /** The caret, or `null` when the editor does not hold a collapsed selection. */
  getCaret() {
    const t = this.ownerDocument?.getSelection();
    return !this._editor || !t?.rangeCount || !t.isCollapsed || !this._editor.contains(t.anchorNode) ? null : { text: Lg(this._editor), offset: Mg(this._editor, t.anchorNode, t.anchorOffset) };
  }
  /** The box of a range of the draft on screen, to anchor something to the text. */
  getRangeRect(t, e = t) {
    return this._editor ? io(this._editor, t, e).getClientRects?.()[0] ?? null : null;
  }
  /** Replace a range of the draft with text, and leave the caret after it. */
  replaceRange(t, e, s) {
    this._write(t, e, () => s ? this._insertPlain(s) : this._exec("delete"), () => this.ownerDocument.createTextNode(s));
  }
  /**
   * Replace a range of the draft with a token, followed by a space for the caret to land
   * on: a caret cannot rest after something that is not editable at the end of a line.
   */
  insertToken(t, e, s) {
    const r = String(++this._lastTokenId);
    this._tokens.set(r, s);
    const i = this.ownerDocument, a = () => {
      const o = i.createDocumentFragment();
      return o.append(ao(i, r, s), i.createTextNode(" ")), o;
    };
    this._write(t, e, () => this._exec("insertHTML", `${ao(i, r, s).outerHTML} `), a);
  }
  /** Replace the editor's content and mirror the value onto the parent composer. */
  setValue(t) {
    this._editor && (this._editor.textContent = t, this._tokens.clear(), this._updatePlaceholderVisibility(), this._adjustHeight(), this._getRoot()?.setValue(t));
  }
  /** Empty the editor and mirror the empty value onto the parent composer. */
  clear() {
    this._editor && (this._editor.innerHTML = "", this._tokens.clear(), this._updatePlaceholderVisibility(), this._adjustHeight(), this._getRoot()?.setValue(""));
  }
  /**
   * Re-read the placeholder fallback chain. Called by the composer when ITS
   * `placeholder` changes — this element observes only its own attribute, and the
   * composer's is one of the three sources it falls back to.
   */
  syncPlaceholder() {
    this._updatePlaceholder();
  }
  /** Focus the inner contenteditable rather than the host element. */
  focus() {
    this._editor?.focus();
  }
  /** Blur the inner contenteditable rather than the host element. */
  blur() {
    this._editor?.blur();
  }
  /** Focus the editor and place the caret at the very end of its content. */
  focusEnd() {
    if (!this._editor) return;
    this._editor.focus();
    const t = this.ownerDocument?.getSelection();
    if (!t) return;
    const e = this.ownerDocument.createRange();
    e.selectNodeContents(this._editor), e.collapse(!1), t.removeAllRanges(), t.addRange(e);
  }
  // ── Private ─────────────────────────────────────────────────────────────
  _getRoot() {
    return this.closest("aparte-composer");
  }
  /** What each pill in the editor stands for; a pill brought back by Undo finds its data here. */
  _tokens = /* @__PURE__ */ new Map();
  _lastTokenId = 0;
  /**
   * Through the browser's own edit commands, or Undo would not know about the change;
   * straight on the DOM where it has none.
   */
  _write(t, e, s, r) {
    const i = this._editor, a = this.ownerDocument?.getSelection();
    if (!i || !a) return;
    i.focus();
    const o = io(i, t, e);
    if (a.removeAllRanges(), a.addRange(o), s()) return;
    o.deleteContents();
    const l = r(), c = l.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? l.lastChild : l;
    o.insertNode(l), o.setStartAfter(c), o.collapse(!0), a.removeAllRanges(), a.addRange(o), this._handleInput();
  }
  /** A browser edit command, or `false` where there is none: a caller then edits the DOM. */
  _exec(t, e) {
    try {
      return this.ownerDocument.execCommand(t, !1, e);
    } catch {
      return !1;
    }
  }
  /**
   * Plain text, as one edit. Several lines go as `<br>`s, because `insertText` makes each
   * line a block, and the draft is read flat: the lines would be sent run together.
   */
  _insertPlain(t) {
    return /[\r\n]/.test(t) ? this._exec("insertHTML", q(t).replace(/\r\n?|\n/g, "<br>")) : this._exec("insertText", t);
  }
  _getPlaceholder() {
    return this.getAttribute("placeholder") || this._getRoot()?.placeholder || $(this).t("inputPlaceholder") || "Type a message...";
  }
  _render() {
    if (this.querySelector(".aparte-ci-editor")) return;
    const t = this.hasAttribute("disabled") || this._getRoot()?.disabled || !1, e = D(this._getPlaceholder());
    this.innerHTML = `<div
            class="aparte-ci-editor"
            contenteditable="${!t}"
            role="textbox"
            aria-multiline="true"
            aria-label="${e}"
            tabindex="${D(String(t ? -1 : 0))}"
            aria-disabled="${t}"
            data-placeholder="${e}"
        ></div>`, this._editor = this.querySelector(".aparte-ci-editor"), this._adjustHeight();
  }
  _connectToRoot() {
    const t = this._getRoot();
    t && (this._unsubscribes.push(
      t._on("disabled-change", ({ disabled: e }) => this._updateDisabled(e))
    ), this._unsubscribes.push(
      t._on("value-change", ({ value: e }) => {
        this.getValue() !== e.trim() && (e === "" ? this.clear() : this.setValue(e));
      })
    ));
  }
  _handleInput() {
    this._adjustHeight(), this._editor && !this._editor.textContent?.trim() && this._editor.innerHTML !== "" && (this._editor.innerHTML = ""), this._updatePlaceholderVisibility();
    const t = this.getValue();
    this._getRoot()?.setValue(t);
  }
  _handleKeydown(t) {
    if (t.isComposing || t.keyCode === 229 || t.defaultPrevented || t.key !== "Enter") return;
    if (this._getRoot()?.submitOnEnter ?? !0 ? !t.shiftKey : t.shiftKey) {
      t.preventDefault();
      const r = this._getRoot();
      if (r) {
        if (r.streaming) return;
        r.submit();
      } else
        this.dispatchEvent(new CustomEvent("aparte-composer-submit", { bubbles: !0 }));
    } else {
      if (t.preventDefault(), !this._editor?.textContent) return;
      this.ownerDocument?.execCommand("insertLineBreak");
    }
  }
  _handleFocus() {
    this.classList.add("aparte-is-focused");
  }
  _handleBlur() {
    this.classList.remove("aparte-is-focused");
  }
  _handlePaste(t) {
    t.preventDefault();
    const e = t.clipboardData;
    if (!e) return;
    const s = this._getRoot(), r = s?.querySelector("aparte-composer-add-attachment"), i = r ? Array.from(e.items).find((o) => o.type.startsWith("image/"))?.getAsFile() : void 0;
    if (i && Cc(r?.getAttribute("accept"), i)) {
      s?.addAttachments([i]);
      return;
    }
    const a = e.getData("text/plain");
    a && this._insertPlain(a);
  }
  _adjustHeight() {
    if (!this._editor) return;
    this._editor.style.height = "0px";
    const t = this.hasAttribute("min-height") ? this._minHeight : 0, e = this._editor.scrollHeight, s = Math.min(Math.max(e, t), this._maxHeight);
    this._editor.style.height = `${s}px`, this._editor.style.overflowY = e > this._maxHeight ? "auto" : "hidden";
  }
  /**
   * The first `_adjustHeight()` runs synchronously in `_render()` on connect —
   * before the stylesheet, flex layout and web fonts have necessarily settled.
   * On an unstabilized layout `scrollHeight` can read inflated, leaving the
   * editor stuck tall (misaligned with the composer controls) until the first
   * keystroke re-measures it. Re-measure once the layout is ready so it's
   * correct from the first paint.
   */
  _scheduleInitialReflow() {
    typeof requestAnimationFrame == "function" && requestAnimationFrame(() => this._adjustHeight()), document.fonts?.ready?.then(() => this._adjustHeight()).catch(() => {
    });
  }
  _updatePlaceholder() {
    if (this._editor) {
      const t = this._getPlaceholder();
      this._editor.setAttribute("data-placeholder", t), this._editor.setAttribute("aria-label", t);
    }
  }
  _updatePlaceholderVisibility() {
  }
  _updateDisabled(t) {
    this._editor && (this._editor.setAttribute("contenteditable", String(!t)), this._editor.setAttribute("aria-disabled", String(t)), this._editor.setAttribute("tabindex", t ? "-1" : "0"), t && this.ownerDocument?.activeElement === this._editor && this._editor.blur());
  }
  /** Escape a value before it lands in a double-quoted HTML attribute. */
}
rt(Rc);
customElements.get("aparte-composer-input") || customElements.define("aparte-composer-input", Rc);
class Lc extends HTMLElement {
  _button = null;
  _unsubscribes = [];
  /**
   * The last `panel-change` payload.
   *
   * This button has four meanings — send, stop, submit an answer, advance to the
   * next question — and three of them are decided by state it does not own: the
   * root's `streaming`, and this payload. It is kept so the button's chrome can be
   * recomputed after the event, for example on a config change.
   */
  _panel = null;
  // Bound handler
  _onClick = this._handleClick.bind(this);
  connectedCallback() {
    this._render(), this._button = this.querySelector(".aparte-cs-button"), this._button?.addEventListener("click", this._onClick), this._connectToRoot();
  }
  disconnectedCallback() {
    this._button?.removeEventListener("click", this._onClick), this._unsubscribes.forEach((t) => t()), this._unsubscribes = [];
  }
  // ── Private ─────────────────────────────────────────────────────────────
  _getRoot() {
    return this.closest("aparte-composer");
  }
  _render() {
    if (this.querySelector(".aparte-cs-button")) return;
    const t = $(this).t("sendButton") || "Send", e = this._getSendIcon(), s = this._getRoot(), r = !s || s.disabled || s.value.trim() === "";
    this.innerHTML = `<button
            type="button"
            class="aparte-btn aparte-btn--primary aparte-btn--solid aparte-btn--icon aparte-cs-button aparte-send-button"
            aria-label="${D(t)}"
            title="${D(t)}"
            data-act="send"
            ${r ? "disabled" : ""}
        >${e}</button>`;
  }
  _connectToRoot() {
    const t = this._getRoot();
    t && (this._unsubscribes.push(
      t._on("value-change", () => this._syncState())
    ), this._unsubscribes.push(
      t._on("disabled-change", () => this._syncState())
    ), this._unsubscribes.push(
      t._on("streaming-change", ({ streaming: e }) => {
        this._getRoot()?.panelActive || this._syncStreamingState(e);
      })
    ), this._unsubscribes.push(
      t._on("attachments-change", () => this._syncState())
    ), this._unsubscribes.push(
      t._on("panel-change", (e) => {
        this._panel = e, this._refreshChrome();
      })
    ), this._unsubscribes.push(pe(this, () => this._refreshChrome())));
  }
  /**
   * Write the chrome for the mode the button is IN, deciding before writing.
   *
   * Never `_render()`: it returns early once the button exists, and its own
   * disabled/icon computation consults neither `root.streaming` nor the panel — so
   * rebuilding mid-turn would put a paper plane back while a reply was still
   * streaming, and rebuilding with the question panel open would silently drop out
   * of answer mode. It would also take the focus off the one control in this
   * composer most likely to be holding it.
   */
  _refreshChrome() {
    if (this._button) {
      if (this._panel?.active) {
        this._syncPanelState();
        return;
      }
      if (this._getRoot()?.streaming) {
        this._syncStreamingState(!0);
        return;
      }
      this._syncState();
    }
  }
  /**
   * Panel open: this one button means "submit the answer".
   *
   * The icon moves with the meaning: a paper plane would read as "send a message"
   * while the label says "Submit". The button never turns into a "Next" while a form
   * has questions ahead (the panel's chips do that, and a button whose meaning
   * changed under the pointer would be a second way to do it). It is disabled
   * instead until every question has an answer, which is what the chips' marks explain.
   */
  _syncPanelState() {
    const t = this._panel;
    if (!this._button || !t?.active) return;
    const e = $(this);
    if (t.mode === "none") {
      this._button.disabled = !0;
      return;
    }
    this._button.disabled = !t.submitEnabled, this._button.innerHTML = this._getSubmitIcon(), this._button.setAttribute("data-act", "submit");
    const s = e.t("submitButton") || "Submit";
    this._button.setAttribute("aria-label", s), this._button.setAttribute("title", s), this._button.classList.remove("aparte-is-streaming");
  }
  _handleClick(t) {
    t.preventDefault(), this._getRoot()?.submit();
  }
  _syncState() {
    const t = this._getRoot();
    if (!t || !this._button || t.streaming) return;
    const e = t.value.trim() === "" && t.attachments.length === 0;
    this._button.disabled = t.disabled || e, this._button.innerHTML = this._getSendIcon(), this._button.setAttribute("data-act", "send");
    const s = $(this).t("sendButton") || "Send";
    this._button.setAttribute("aria-label", s), this._button.setAttribute("title", s), this._button.classList.remove("aparte-is-streaming");
  }
  _syncStreamingState(t) {
    if (this._button)
      if (t) {
        this._button.disabled = !1, this._button.innerHTML = this._getStopIcon(), this._button.setAttribute("data-act", "stop");
        const e = $(this).t("stopButton") || "Stop";
        this._button.setAttribute("aria-label", e), this._button.setAttribute("title", e), this._button.classList.add("aparte-is-streaming");
      } else
        this._syncState();
  }
  /**
   * The icon for submitting an ANSWER, which is not the same act as sending a
   * message — one button, two meanings, and it has to say which one it is.
   */
  _getSubmitIcon() {
    return $(this).getIcon("check");
  }
  _getSendIcon() {
    return $(this).getIcon("send") || "Send";
  }
  _getStopIcon() {
    return $(this).getIcon("stop");
  }
}
rt(Lc);
customElements.get("aparte-composer-send") || customElements.define("aparte-composer-send", Lc);
class Mc extends HTMLElement {
  _button = null;
  _unsubscribes = [];
  // Bound handler
  _onClick = this._handleClick.bind(this);
  connectedCallback() {
    this._render(), this._button = this.querySelector(".aparte-cc-button"), this._button?.addEventListener("click", this._onClick), this._connectToRoot(), this._unsubscribes.push(pe(this, () => this._refreshChrome()));
  }
  disconnectedCallback() {
    this._button?.removeEventListener("click", this._onClick), this._unsubscribes.forEach((t) => t()), this._unsubscribes = [];
  }
  // ── Private ─────────────────────────────────────────────────────────────
  _getRoot() {
    return this.closest("aparte-composer");
  }
  _render() {
    if (this.querySelector(".aparte-cc-button")) return;
    const t = $(this).t("stopButton") || "Stop", e = this._getStopIcon();
    this.innerHTML = `<button
            type="button"
            class="aparte-btn aparte-btn--icon aparte-cc-button"
            aria-label="${D(t)}"
            title="${D(t)}"
            hidden
        >${e}</button>`;
  }
  _connectToRoot() {
    const t = this._getRoot();
    t && (this._unsubscribes.push(
      t._on("streaming-change", ({ streaming: e }) => {
        this._button && (this._button.hidden = !e);
      })
    ), t.streaming && this._button && (this._button.hidden = !1));
  }
  _handleClick(t) {
    t.preventDefault(), this._getRoot()?.cancel();
  }
  /**
   * Re-read the accessible name and the icon in place.
   *
   * `hidden` is NOT touched: `_render()` always renders this button hidden and only
   * the root's `streaming-change` listener ever un-hides it, so a rebuild would make
   * the stop button vanish in the middle of a turn.
   */
  _refreshChrome() {
    if (!this._button) return;
    const t = $(this).t("stopButton") || "Stop";
    this._button.setAttribute("aria-label", t), this._button.setAttribute("title", t), this._button.innerHTML = this._getStopIcon();
  }
  _getStopIcon() {
    return $(this).getIcon("stop");
  }
}
rt(Mc);
customElements.get("aparte-composer-cancel") || customElements.define("aparte-composer-cancel", Mc);
class Oc extends HTMLElement {
  _unsubscribes = [];
  /** Object URLs minted for image previews — revoked on re-render/disconnect. */
  _objectUrls = [];
  connectedCallback() {
    this._render([]), this._connectToRoot();
  }
  disconnectedCallback() {
    this._unsubscribes.forEach((t) => t()), this._unsubscribes = [], this._revokeUrls();
  }
  // ── Private ─────────────────────────────────────────────────────────────
  _getRoot() {
    return this.closest("aparte-composer");
  }
  _connectToRoot() {
    const t = this._getRoot();
    t && (this._unsubscribes.push(
      t._on("attachments-change", ({ attachments: e }) => this._render(e))
    ), this._render(t.attachments));
  }
  /** Draw how a file's upload is going on its tile. */
  showState(t, e) {
    const s = this._getRoot()?.attachments.indexOf(t) ?? -1, r = this.querySelectorAll(".aparte-thumb")[s];
    if (!r) return;
    r.toggleAttribute("data-failed", e?.status === "error");
    let i = r.querySelector(".aparte-progress");
    if (e?.status !== "uploading") {
      i?.remove();
      return;
    }
    i || (i = document.createElement("div"), i.className = "aparte-progress aparte-thumb__progress", i.setAttribute("role", "progressbar"), i.setAttribute("aria-label", t.name), i.innerHTML = '<div class="aparte-progress__bar"></div>', r.appendChild(i));
    const a = e.progress !== void 0;
    i.classList.toggle("aparte-progress--indeterminate", !a), a ? (i.setAttribute("aria-valuenow", String(e.progress)), i.setAttribute("aria-valuemin", "0"), i.setAttribute("aria-valuemax", "100"), i.style.setProperty("--aparte-progress-value", String(e.progress))) : i.removeAttribute("aria-valuenow");
  }
  /** Release the previous render's blob URLs so they don't leak. */
  _revokeUrls() {
    this._objectUrls.forEach((t) => URL.revokeObjectURL(t)), this._objectUrls = [];
  }
  _render(t) {
    this.hidden = t.length === 0, this._revokeUrls();
    const e = $(this), s = (a) => (e.t("removeAttachment") || "Remove {name}").replace("{name}", () => a.name);
    this.innerHTML = t.map((a) => {
      const o = q(a.name), l = `<button class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-thumb__remove" type="button" aria-label="${D(s(a))}">${e.getIcon("close")}</button>`;
      if (a.type.startsWith("image/")) {
        const c = URL.createObjectURL(a);
        return this._objectUrls.push(c), `<div class="aparte-thumbnail aparte-thumb aparte-thumb--image" title="${o}"><img class="aparte-thumbnail__image" src="${D(c)}" alt="${o}" /><span class="aparte-thumb__name">${o}</span>${l}</div>`;
      }
      return `<div class="aparte-thumbnail aparte-thumb aparte-thumb--file" title="${o}"><span class="aparte-thumbnail__label">${q(this._ext(a.name))}</span><span class="aparte-thumb__name">${o}</span>${l}</div>`;
    }).join("");
    const r = this._getRoot();
    if (r) for (const a of t) {
      const o = r.getAttachmentState(a);
      o && this.showState(a, o);
    }
    if (this.querySelectorAll(".aparte-thumb__remove").forEach((a, o) => {
      a.addEventListener("click", (l) => {
        l.stopPropagation();
        const c = this._getRoot();
        c && c.removeAttachment(c.attachments[o]);
      });
    }), !$(this).getHostHandlers().attachmentPreview) return;
    const i = t.filter((a) => a.type.startsWith("image/"));
    this.querySelectorAll(".aparte-thumb--image").forEach((a, o) => {
      const l = a.querySelector(".aparte-thumbnail__image");
      if (!l) return;
      l.setAttribute("role", "button"), l.setAttribute("tabindex", "0"), l.setAttribute("aria-label", i[o]?.name ?? "");
      const c = () => {
        this.dispatchEvent(new CustomEvent("aparte-attachment-preview", {
          bubbles: !0,
          composed: !0,
          detail: { url: l.src, name: i[o]?.name ?? "", type: i[o]?.type ?? "" }
        }));
      };
      l.addEventListener("click", c), l.addEventListener("keydown", (d) => {
        const h = d.key;
        h !== "Enter" && h !== " " || (d.preventDefault(), c());
      });
    });
  }
  /** Uppercased file extension (≤4 chars), or 'FILE' when there is none. */
  _ext(t) {
    const e = t.lastIndexOf(".");
    return e > 0 ? t.slice(e + 1).toUpperCase().slice(0, 4) : "FILE";
  }
}
rt(Oc);
customElements.get("aparte-composer-attachments") || customElements.define("aparte-composer-attachments", Oc);
class $c extends HTMLElement {
  _button = null;
  _dragCleanup = null;
  _unsubscribes = [];
  // Bound handler
  _onClick = this._handleClick.bind(this);
  static get observedAttributes() {
    return ["accept", "multiple", "disabled"];
  }
  connectedCallback() {
    this._render(), this._button = this.querySelector(".aparte-caa-button"), this._button?.addEventListener("click", this._onClick), this._connectToRoot(), this._setupDragDrop(), this._unsubscribes.push(pe(this, () => this._refreshChrome()));
  }
  disconnectedCallback() {
    this._button?.removeEventListener("click", this._onClick), this._dragCleanup?.(), this._unsubscribes.forEach((t) => t()), this._unsubscribes = [];
  }
  attributeChangedCallback(t, e, s) {
    t === "disabled" && this._button && (this._button.disabled = s !== null);
  }
  // ── Private ─────────────────────────────────────────────────────────────
  _getRoot() {
    return this.closest("aparte-composer");
  }
  /**
   * Re-read the label and the icon on the button that already exists.
   *
   * Deliberately not a re-render: `_render()` returns early once the button is
   * there, and rebuilding it would drop focus if the user were on it — a locale or
   * icon change is not a reason to lose the keyboard.
   * The native file input and the drag listeners live outside this element
   * (on `document.body` and on the composer root), so they are untouched either way.
   */
  _refreshChrome() {
    if (!this._button) return;
    const t = $(this), e = t.t("actionUpload") || "Attach file";
    this._button.setAttribute("aria-label", e), this._button.setAttribute("title", e), this._button.innerHTML = t.getIcon("paperclip");
  }
  _render() {
    if (this.querySelector(".aparte-caa-button")) return;
    const t = $(this).t("actionUpload") || "Attach file", e = $(this).getIcon("paperclip"), s = this.hasAttribute("disabled") || this._getRoot()?.disabled || !1;
    this.innerHTML = `<button
            class="aparte-btn aparte-btn--icon aparte-caa-button aparte-action-button"
            aria-label="${D(t)}"
            title="${D(t)}"
            type="button"
            ${s ? "disabled" : ""}
        >${e}</button>`;
  }
  _connectToRoot() {
    const t = this._getRoot();
    t && (this._unsubscribes.push(
      t._on("disabled-change", ({ disabled: e }) => {
        this._button && (this._button.disabled = e);
      })
    ), this._unsubscribes.push(
      t._on("streaming-change", ({ streaming: e }) => {
        this._button && (this._button.disabled = t.disabled);
      })
    ));
  }
  _handleClick() {
    const t = document.createElement("input");
    t.type = "file", t.multiple = !this.hasAttribute("multiple") || this.getAttribute("multiple") !== "false";
    const e = this.getAttribute("accept");
    e && (t.accept = e), t.style.display = "none", document.body.appendChild(t), t.addEventListener("change", () => {
      t.files?.length && this._admit(t.files), document.body.removeChild(t);
    }, { once: !0 }), t.click();
  }
  /** Attach the files `accept` admits: the dialog's "All files" and a drop both bypass the browser's filter. */
  _admit(t) {
    const e = Array.from(t).filter((s) => Cc(this.getAttribute("accept"), s));
    e.length && this._getRoot()?.addAttachments(e);
  }
  _setupDragDrop() {
    const t = this._getRoot();
    if (!t) return;
    const e = (a) => {
      a.preventDefault(), a.stopPropagation();
    }, s = (a) => {
      t.disabled || (e(a), t.classList.add("aparte-is-dragover"));
    }, r = (a) => {
      e(a), t.classList.remove("aparte-is-dragover");
    }, i = (a) => {
      if (e(a), t.classList.remove("aparte-is-dragover"), t.disabled) return;
      const o = a.dataTransfer?.files;
      o?.length && this._admit(o);
    };
    t.addEventListener("dragover", s), t.addEventListener("dragleave", r), t.addEventListener("drop", i), this._dragCleanup = () => {
      t.removeEventListener("dragover", s), t.removeEventListener("dragleave", r), t.removeEventListener("drop", i);
    };
  }
}
rt($c);
customElements.get("aparte-composer-add-attachment") || customElements.define("aparte-composer-add-attachment", $c);
class Nc extends HTMLElement {
  _button = null;
  _unsubscribes = [];
  // Bound handler
  _onClick = this._handleClick.bind(this);
  static get observedAttributes() {
    return ["icon", "label", "disabled"];
  }
  connectedCallback() {
    this._render(), this._button = this.querySelector(".aparte-cact-button"), this._button?.addEventListener("click", this._onClick), this._connectToRoot(), this._unsubscribes.push(pe(this, () => {
      this._button && (this._button.innerHTML = this._resolveIcon(this.getAttribute("icon") ?? ""));
    }));
  }
  disconnectedCallback() {
    this._button?.removeEventListener("click", this._onClick), this._unsubscribes.forEach((t) => t()), this._unsubscribes = [];
  }
  attributeChangedCallback(t, e, s) {
    this._button && (t === "disabled" && (this._button.disabled = s !== null), t === "label" && (this._button.setAttribute("aria-label", s ?? ""), this._button.setAttribute("title", s ?? "")), t === "icon" && (this._button.innerHTML = this._resolveIcon(s ?? "")));
  }
  // ── Private ─────────────────────────────────────────────────────────────
  _getRoot() {
    return this.closest("aparte-composer");
  }
  _render() {
    if (this.querySelector(".aparte-cact-button")) return;
    const t = D(this.getAttribute("label") ?? ""), e = this._resolveIcon(this.getAttribute("icon") ?? ""), s = this.hasAttribute("disabled") || this._getRoot()?.disabled || !1;
    this.innerHTML = `<button
            class="aparte-btn aparte-btn--icon aparte-cact-button aparte-action-button"
            aria-label="${t}"
            title="${t}"
            type="button"
            ${s ? "disabled" : ""}
        >${e}</button>`;
  }
  _connectToRoot() {
    const t = this._getRoot();
    t && (this._unsubscribes.push(
      t._on("disabled-change", ({ disabled: e }) => {
        this._button && (this._button.disabled = e || this.hasAttribute("disabled"));
      })
    ), this._unsubscribes.push(
      t._on("streaming-change", ({ streaming: e }) => {
        this._button && (this._button.disabled = e || t.disabled || this.hasAttribute("disabled"));
      })
    ));
  }
  _handleClick(t) {
    this.dispatchEvent(new CustomEvent("aparte-action-click", {
      bubbles: !0,
      composed: !0,
      detail: { actionId: this.getAttribute("action-id") ?? "", composer: this._getRoot() }
    }));
  }
  _resolveIcon(t) {
    return t ? t.trimStart().startsWith("<") ? t : $(this).getIcon(t) ?? t : "";
  }
}
rt(Nc);
customElements.get("aparte-composer-action") || customElements.define("aparte-composer-action", Nc);
class Pc extends HTMLElement {
  _observer = null;
  connectedCallback() {
    this._syncEmpty(), this._observer ??= new MutationObserver((t) => {
      t.some((e) => !(e.type === "attributes" && e.target === this)) && this._syncEmpty();
    }), this._observer.observe(this, { childList: !0, subtree: !0, attributes: !0, attributeFilter: ["hidden", "data-empty"] });
  }
  disconnectedCallback() {
    this._observer?.disconnect(), this._observer = null;
  }
  /**
   * Reflect `data-empty` from the presence of an ELEMENT child.
   *
   * Not `:empty` in CSS: that selector does not match an element holding a whitespace
   * text node, so a template that indents its content keeps the row — separator,
   * padding and all — while it looks empty to the user. Every framework template
   * indents. An empty row must not draw its own separator (the same rule as an empty
   * bubble action bar).
   *
   * Non-whitespace TEXT counts as content, not just an element child: a hand-written
   * row holding a bare token count (`<aparte-composer-toolbar>1 240 tokens</…>`) is
   * not empty, and hiding it would be a twenty-minute mystery for whoever wrote it.
   */
  _syncEmpty() {
    const t = Array.from(this.children).some((r) => !r.hasAttribute("hidden") && !r.hasAttribute("data-empty")), e = Array.from(this.childNodes).some((r) => r.nodeType === Node.TEXT_NODE && (r.textContent ?? "").trim() !== ""), s = t || e;
    s !== !this.hasAttribute("data-empty") && (s ? this.removeAttribute("data-empty") : this.setAttribute("data-empty", ""));
  }
}
rt(Pc);
customElements.get("aparte-composer-toolbar") || customElements.define("aparte-composer-toolbar", Pc);
function Jn(n) {
  return n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function Rr(n, t) {
  let e = 0;
  for (const s of n.querySelectorAll("[data-conv-id]")) {
    const r = s.querySelector(".aparte-conv-item__title")?.textContent ?? s.textContent ?? "";
    s.hidden = t !== "" && !Jn(r).includes(t), s.hidden || e++;
  }
  for (const s of n.querySelectorAll(".aparte-conv-group"))
    s.hidden = t !== "" && !Array.from(s.querySelectorAll("[data-conv-id]")).some((r) => !r.hidden);
  return e;
}
const lo = (n) => n === "running" || n === "waiting" ? n : null;
function We(n, t) {
  return `[${n}="${yt(t)}"]`;
}
const zs = 864e5, Gs = 4, js = 8;
class Dc extends HTMLElement {
  _conversations = [];
  _activeId = null;
  /**
   * What stops the menus of the rows on screen: one `enhanceMenu` per `⋯`, and the
   * context menu over the whole list. A render replaces the rows, so it releases them
   * all and wires the new ones.
   */
  _menus = [];
  /** The context menu's element: one for the list, filled for the row it was asked about. */
  _contextMenu = null;
  _renaming = null;
  _warnedNoManager = !1;
  static get observedAttributes() {
    return ["active-id", "flat", "loading", "manage"];
  }
  /**
   * The list is on its way: rows of the kit's skeleton stand where the rows will be,
   * the element is `aria-busy`, and a visually hidden line names the wait. Reflected
   * as the `loading` attribute, so a site sets it while its store answers and clears
   * it when `conversations` is set. A list that is not there yet is not an empty list.
   */
  get loading() {
    return this.hasAttribute("loading");
  }
  set loading(t) {
    this.toggleAttribute("loading", mt(t));
  }
  /**
   * Let the list finish the gesture through the registered conversation manager.
   * Reflected as the `manage` attribute.
   *
   * The property exists because this is the attribute that authorises a WRITE, and Vue
   * and both Sveltes stringify a bound `false` onto an element that has no property of
   * that name — `manage="false"`, which `hasAttribute` reads as on. Without it,
   * turning management off would turn it on. `presenceOn`, like `loading` above it.
   */
  get manage() {
    return this.hasAttribute("manage");
  }
  set manage(t) {
    this.toggleAttribute("manage", mt(t));
  }
  // ─── Lifecycle ────────────────────────────────────────────────────────
  connectedCallback() {
    this.classList.contains("aparte-conv-list") || this.classList.add("aparte-conv-list"), this.getAttribute("role") || this.setAttribute("role", "navigation"), this.addEventListener("click", this._onClick), this.addEventListener("keydown", this._onKeydown), this.addEventListener("aparte-menu-select", this._onMenuSelect), this.addEventListener("pointerdown", this._onPress), this._render(), window.addEventListener("aparte-config-change", this._onConfigChange), window.addEventListener("aparte-conversation-status", this._onStatus);
  }
  disconnectedCallback() {
    this._releaseMenus(), this.removeEventListener("click", this._onClick), this.removeEventListener("keydown", this._onKeydown), this.removeEventListener("aparte-menu-select", this._onMenuSelect), this.removeEventListener("pointerdown", this._onPress), window.removeEventListener("pointerup", this._onRelease, !0), window.removeEventListener("pointercancel", this._onRelease, !0), this._pressed = !1, this._renderAfterPress = !1, window.removeEventListener("aparte-config-change", this._onConfigChange), window.removeEventListener("aparte-conversation-status", this._onStatus);
  }
  attributeChangedCallback(t, e, s) {
    e !== s && (t === "active-id" ? (this._activeId = s, this._updateActiveState()) : (t === "flat" || t === "loading") && this.isConnected && this._render());
  }
  /**
   * Re-render on a locale switch: every row's title fallback, the `⋯` button's name
   * and the group headings come from the locale, so without this the list stayed in
   * the previous language until something else happened to re-render it. Only OUR
   * config.
   */
  _onConfigChange = (t) => {
    const e = t.detail;
    e?.config && e.config !== $(this) || this._render();
  };
  /**
   * `aparte-conversation-status`, on `window`: the controller's, a list's, or an app's own.
   * Kept page-wide too (an app may dispatch the event itself), then drawn on this row.
   */
  _onStatus = (t) => {
    const e = t.detail;
    if (typeof e?.id != "string") return;
    dc(e.id, lo(e.status));
    const s = this.querySelector(We("data-conv-id", e.id));
    s && this._applyStatus(s, e.id);
  };
  // ─── Public API ───────────────────────────────────────────────────────
  /**
   * Say what a conversation is doing: `running` while an AI answers in it, `waiting`
   * while its turn waits for the person, `null` for neither. The row carries it as
   * `data-status`, a running title wears `aparte-shimmer`, a waiting row shows its mark
   * (`.aparte-conv-item__status`, an empty slot otherwise), and a screen reader hears
   * the state with the title. The look is CSS on `data-status`: a site that wants a dot
   * for `running` draws it in the slot and takes the shimmer off.
   *
   * A state is about a conversation, not about this list: it is kept page-wide and every
   * list on the page draws it, one that connects later included. Patched in place, and
   * kept across re-renders and for rows not drawn yet. The conversation controller sets
   * it on its own through `aparte-conversation-status`.
   */
  setConversationStatus(t, e) {
    Ar(t, lo(e));
  }
  /** What a conversation is doing, as last told; `null` for neither. */
  getConversationStatus(t) {
    return Bs(t);
  }
  /** Write a conversation's state onto its row — the same three things `_renderItem` draws. */
  _applyStatus(t, e) {
    const s = Bs(e);
    s ? t.setAttribute("data-status", s) : t.removeAttribute("data-status");
    const r = s === "running";
    t.querySelector(".aparte-conv-item__title")?.classList.toggle("aparte-shimmer", r);
    const i = t.querySelector(".aparte-conv-item__state");
    i && (i.textContent = this._statusWords(s));
  }
  /** The words a screen reader hears for a state. Literal `t('…')` reads, for the locale guard. */
  _statusWords(t) {
    return t === "running" ? this._t("conversationRunning") : t === "waiting" ? this._t("conversationWaiting") : "";
  }
  /** Set the list of conversations to display. Triggers a re-render. */
  set conversations(t) {
    this._conversations = Array.isArray(t) ? t : [], this._render();
  }
  get conversations() {
    return this._conversations;
  }
  // ─── Rendering ────────────────────────────────────────────────────────
  /**
   * A press holds every render until its click has landed. The host re-assigns
   * `conversations` on every manager change (a save moves a row, a select marks one),
   * and a row replaced between `mousedown` and `mouseup` loses its click: Chromium
   * sends it to the list, where the delegated handler matches nothing, and WebKit
   * sends none. Keeping the row node would not help: a row moved to its new place
   * leaves the document on the way, and the row that moves is often the one pressed
   * (the conversation just saved). So nothing changes under a pointer that is down,
   * and the render runs once, after the click.
   */
  _pressed = !1;
  _renderAfterPress = !1;
  _onPress = () => {
    this._pressed || (this._pressed = !0, window.addEventListener("pointerup", this._onRelease, !0), window.addEventListener("pointercancel", this._onRelease, !0));
  };
  _onRelease = () => {
    window.removeEventListener("pointerup", this._onRelease, !0), window.removeEventListener("pointercancel", this._onRelease, !0), setTimeout(() => {
      this._pressed = !1, this._renderAfterPress && (this._renderAfterPress = !1, this.isConnected && this._render());
    }, 0);
  };
  /** The name this element last wrote, so one the app wrote — before or after connect — is left alone. */
  _ownLabel = null;
  _render() {
    const t = this.getAttribute("aria-label");
    if (!this.hasAttribute("aria-labelledby") && (t === null || t === this._ownLabel) && (this._ownLabel = this._t("conversationList"), this.setAttribute("aria-label", this._ownLabel)), this._pressed) {
      this._renderAfterPress = !0;
      return;
    }
    this._releaseMenus(), this._renaming = null;
    const e = Et(this), s = e && this.contains(e) ? e.closest("[data-select-id], [data-more-id]") : null, r = s?.dataset.selectId ? We("data-select-id", s.dataset.selectId) : s?.dataset.moreId ? We("data-more-id", s.dataset.moreId) : null, i = s?.closest("[data-conv-id]") ?? null, a = (f) => !f.closest("[hidden]"), o = i ? Array.from(this.querySelectorAll("[data-conv-id]")).filter(a).indexOf(i) : -1, l = this.hasAttribute("loading");
    if (this.setAttribute("aria-busy", l ? "true" : "false"), l) {
      this.removeAttribute("data-no-match");
      const f = '<span class="aparte-skeleton aparte-skeleton--text"></span>';
      this.innerHTML = '<div class="aparte-conv-list-loading" aria-hidden="true">' + f + f + f + f + f + f + '</div><span class="aparte-conv-list-loading-status aparte-sr-only" role="status"></span>';
      const _ = this.querySelector(".aparte-conv-list-loading-status"), g = () => {
        _?.isConnected && (_.textContent = this._t("loadingConversations"));
      };
      typeof requestAnimationFrame == "function" ? requestAnimationFrame(g) : g();
      return;
    }
    const c = this.querySelector(":scope > .aparte-conv-list-no-match"), d = this._groups().map((f) => this._renderGroup(f)).join("");
    if (c) {
      for (const f of Array.from(this.childNodes)) f !== c && f.remove();
      c.insertAdjacentHTML("beforebegin", d);
    } else
      this.innerHTML = d;
    if (this._applyFilter(), this._wireMenus(), !r) return;
    const h = this.querySelector(r);
    if (h && a(h)) {
      h.focus();
      return;
    }
    const u = Array.from(this.querySelectorAll("[data-select-id]")).filter(a), p = o >= 0 ? u[o] ?? u[u.length - 1] : null;
    if (p) {
      p.focus();
      return;
    }
    this.hasAttribute("tabindex") || (this.setAttribute("tabindex", "-1"), this.addEventListener("blur", () => this.removeAttribute("tabindex"), { once: !0 })), this.focus();
  }
  /** The query `filter()` holds, folded; re-applied on every render, so new rows obey it. */
  _query = "";
  /**
   * Show only the conversations whose title contains `query`, case- and
   * accent-insensitive, and the date groups that still hold one; return how many match.
   * An empty query shows everything. The query is kept through every render — a new
   * conversation, a rename — and when nothing matches the list says so in a status line
   * (the locale's `conversationSearchEmpty`) and carries `data-no-match`.
   */
  filter(t) {
    return this._query = Jn(t), this._applyFilter();
  }
  _applyFilter() {
    const t = this._query;
    if (this.hasAttribute("loading")) return 0;
    const e = Rr(this, t), s = t !== "" && e === 0;
    this.toggleAttribute("data-no-match", s);
    let r = this.querySelector(":scope > .aparte-conv-list-no-match");
    const i = !r;
    r || (r = document.createElement("p"), r.className = "aparte-conv-list-no-match", r.setAttribute("role", "status"), this.appendChild(r));
    const a = s ? this._t("conversationSearchEmpty") : "", o = () => {
      r.isConnected && r.textContent !== a && (r.textContent = a);
    };
    return i && a && typeof requestAnimationFrame == "function" ? requestAnimationFrame(o) : o(), e;
  }
  _t(t) {
    return $(this).getLocale()[t] ?? Ve[t] ?? "";
  }
  /**
   * Pinned first, then the calendar buckets every chat product uses, then a heading
   * per month (newest first), then whatever carries no date. Flat when nothing is
   * dated or the host asked for `flat`: a heading over the only group would say
   * nothing.
   */
  _groups() {
    const t = this._conversations;
    if (this.hasAttribute("flat") || !t.some((d) => typeof d.updatedAt == "number"))
      return [{ key: "all", label: null, items: t }];
    const e = /* @__PURE__ */ new Date(), s = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime(), r = $(this).getLocale().tag, i = /* @__PURE__ */ new Map(), a = (d, h, u) => {
      let p = i.get(d);
      p || (p = { key: d, label: h, items: [] }, i.set(d, p)), p.items.push(u);
    };
    for (const d of t) {
      if (d.pinnedAt) {
        a("pinned", this._t("conversationGroupPinned"), d);
        continue;
      }
      const h = d.updatedAt;
      if (typeof h != "number") {
        a("undated", null, d);
        continue;
      }
      if (h >= s) a("today", this._t("conversationGroupToday"), d);
      else if (h >= s - zs) a("yesterday", this._t("conversationGroupYesterday"), d);
      else if (h >= s - 7 * zs) a("week", this._t("conversationGroupWeek"), d);
      else if (h >= s - 30 * zs) a("month", this._t("conversationGroupMonth"), d);
      else {
        const u = new Date(h), p = u.getFullYear() === e.getFullYear(), f = new Intl.DateTimeFormat(r, p ? { month: "long" } : { month: "long", year: "numeric" }).format(u), _ = f.charAt(0).toLocaleUpperCase(r) + f.slice(1);
        a(`m-${u.getFullYear()}-${String(u.getMonth()).padStart(2, "0")}`, _, d);
      }
    }
    const o = ["pinned", "today", "yesterday", "week", "month"].map((d) => i.get(d)).filter((d) => !!d), l = [...i.keys()].filter((d) => d.startsWith("m-")).sort((d, h) => h.localeCompare(d)).map((d) => i.get(d)), c = i.get("undated");
    return [...o, ...l, ...c ? [c] : []];
  }
  _renderGroup(t) {
    const e = t.items.map((r) => this._renderItem(r)).join("");
    if (t.label === null)
      return `<div class="aparte-conv-group">${e}</div>`;
    const s = q(t.label);
    return `
<div class="aparte-conv-group" role="group" aria-label="${D(t.label)}">
  <div class="aparte-menu__label aparte-conv-group__label" aria-hidden="true">${s}</div>
  ${e}
</div>`;
  }
  _renderItem(t) {
    const e = t.id === this._activeId, s = [
      "aparte-menu__item aparte-conv-item",
      e ? "aparte-conv-item--active" : "",
      t.archivedAt ? "aparte-conv-item--archived" : "",
      t.pinnedAt ? "aparte-conv-item--pinned" : ""
    ].filter(Boolean).join(" "), r = D(t.id), i = q(t.title || this._t("newChat")), a = D(this._t("conversationActions")), o = $(this).getIcon("more"), l = Bs(t.id), c = l ? ` data-status="${D(l)}"` : "", d = D(l === "running" ? "aparte-conv-item__title aparte-shimmer" : "aparte-conv-item__title"), h = q(this._statusWords(l));
    return `
<div class="${D(s)}" data-conv-id="${r}"${c}>
  <button
    class="aparte-conv-item__select"
    type="button"
    data-select-id="${r}"
    aria-current="${e ? "page" : "false"}"
  ><span class="${d}" dir="auto">${i}</span><span class="aparte-conv-item__status" aria-hidden="true"></span><span class="aparte-conv-item__state aparte-sr-only">${h}</span></button>
  <button
    class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-conv-item__more"
    type="button"
    data-more-id="${r}"
    aria-label="${a}"
    title="${a}"
    aria-haspopup="menu"
    aria-expanded="false"
  >${o}</button>
</div>`;
  }
  // ─── The row's menu ───────────────────────────────────────────────────
  _menuMarkup(t) {
    const e = $(this), s = e.getIcon("edit"), r = e.getIcon("pin"), i = e.getIcon(t.archivedAt ? "unarchive" : "archive"), a = e.getIcon("trash"), o = q(this._t("renameConversation")), l = q(this._t(t.pinnedAt ? "unpinConversation" : "pinConversation")), c = q(this._t(t.archivedAt ? "unarchiveConversation" : "archiveConversation")), d = q(this._t("deleteConversation"));
    return `
<button type="button" class="aparte-menu__item" role="menuitem" data-menu-action="rename">${s}<span>${o}</span></button>
<button type="button" class="aparte-menu__item" role="menuitem" data-menu-action="pin">${r}<span>${l}</span></button>
<button type="button" class="aparte-menu__item" role="menuitem" data-menu-action="archive">${i}<span>${c}</span></button>
<div class="aparte-menu__separator" role="separator"></div>
<button type="button" class="aparte-menu__item aparte-conv-menu__item--danger" role="menuitem" data-menu-action="delete">${a}<span>${d}</span></button>`;
  }
  /** The question the confirm step asks — the popover's accessible name while it asks it. */
  _confirmQuestion(t) {
    return this._t("deleteConversationConfirm").replace("{title}", () => t.title || this._t("newChat"));
  }
  _confirmMarkup(t) {
    const e = q(this._confirmQuestion(t)), s = q(this._t("cancel")), r = q(this._t("deleteConversation"));
    return `
<div class="aparte-conv-menu__confirm">
  <p class="aparte-conv-menu__question">${e}</p>
  <div class="aparte-conv-menu__actions">
    <button type="button" class="aparte-btn aparte-btn--sm aparte-btn--ghost" data-menu-action="cancel">${s}</button>
    <button type="button" class="aparte-btn aparte-btn--sm aparte-btn--danger aparte-btn--solid" data-menu-action="confirm-delete">${r}</button>
  </div>
</div>`;
  }
  /** A row menu's element, empty: `_fillMenu` gives it its items as it opens. */
  _newMenu() {
    const t = document.createElement("div");
    return t.className = "aparte-menu aparte-conv-menu", t.setAttribute("role", "menu"), t;
  }
  /**
   * Fills `menu` for the row's conversation and puts it in the row, as it opens; it leaves
   * the row when it closes, so a list with no menu open holds none. `enhanceMenu` places it
   * fixed to the window, because a sidebar scrolls and an absolute menu on the last rows
   * would be clipped by the list's own overflow. False — stay closed — when the
   * conversation is gone.
   */
  _fillMenu(t, e) {
    const s = t.dataset.convId, r = s ? this._conversations.find((i) => i.id === s) : void 0;
    return r ? (e.dataset.menuFor = r.id, e.setAttribute("role", "menu"), e.setAttribute("aria-label", r.title || this._t("newChat")), e.innerHTML = this._menuMarkup(r), t.appendChild(e), !0) : !1;
  }
  /**
   * The keyboard, the closing and the placing are `enhanceMenu`'s, the same code the kit
   * gives a host for its own menus: each row's `⋯` drives its own menu, and a right
   * click, Shift+F10 or the Menu key on a row opens one shared menu there
   * (`enhanceContextMenu`). Both fill as they open.
   */
  _wireMenus() {
    for (const e of this.querySelectorAll("[data-more-id]")) {
      const s = e.closest("[data-conv-id]");
      if (!s) continue;
      const r = this._newMenu();
      this._menus.push(Fd(e, r, {
        gap: Gs,
        margin: js,
        align: "end",
        onOpen: () => this._fillMenu(s, r),
        onClose: () => r.remove()
      }));
    }
    const t = this._contextMenu ??= this._newMenu();
    this._menus.push(Ud(this, t, {
      gap: Gs,
      margin: js,
      onOpen: (e) => {
        const s = e.closest("[data-conv-id]");
        return !s || !this.contains(s) || e.closest("[data-rename-id], [data-menu-for]") ? !1 : this._fillMenu(s, t);
      },
      onClose: () => t.remove()
    }));
  }
  /** Closes whichever menu is open, without moving the focus, and stops them all. */
  _releaseMenus() {
    for (const t of this._menus.splice(0)) t();
  }
  /**
   * Placed again once the question has taken the items' place, since it is not their
   * size: the `⋯` menu against its button, the context menu on the corner it opened at.
   */
  _placeQuestion(t, e) {
    const s = getComputedStyle(this).direction === "rtl", r = t === this._contextMenu ? null : this.querySelector(We("data-more-id", e)), i = t.getBoundingClientRect(), a = s ? i.right : i.left;
    el(r?.getBoundingClientRect() ?? { top: i.top, bottom: i.top, left: a, right: a }, t, {
      gap: r ? Gs : 0,
      margin: js,
      align: r ? "end" : "start",
      rtl: s
    });
  }
  /**
   * An item chosen in a row's menu: `enhanceMenu` asks before it closes. Delete keeps it
   * open, since the question takes the items' place. The event stops here: the menu is
   * this element's own, and what the list tells the page is `aparte-conversation-*`.
   */
  _onMenuSelect = (t) => {
    t.target.dataset.menuFor !== void 0 && (t.stopPropagation(), t.detail.item.dataset.menuAction === "delete" && t.preventDefault());
  };
  /**
   * The gesture, finished. The event has already gone out — cancelable, so a host
   * that wants the write for itself calls `preventDefault()` and this stands down —
   * and what is left is the registered conversation manager doing it. Without
   * `manage` the element behaves exactly as it did before the attribute existed.
   *
   * A `manage` with no manager registered is a menu that does nothing, so the first
   * gesture says so and names the call that fixes it. Said here rather than at
   * `connectedCallback` because a list in the page's HTML connects before the script
   * that registers the manager runs: a warning at connect would fire on a setup that
   * is perfectly correct one tick later.
   */
  _manage(t, e) {
    if (!this.hasAttribute("manage") || t.defaultPrevented) return;
    const s = this.getAttribute("target"), r = this.getRootNode(), i = s ? r.getElementById?.(s) ?? this.ownerDocument.getElementById(s) : null, a = $(i ?? this).getConversationManager();
    if (!a) {
      if (this._warnedNoManager) return;
      this._warnedNoManager = !0, console.warn(
        "[aparte-conversation-list] `manage` is set but no conversation manager is registered, so the row menu writes nothing. Call setConversationManager(manager) on your config, or drop `manage` and handle the events yourself."
      );
      return;
    }
    e(a).catch((o) => {
      console.warn("[aparte-conversation-list] the conversation manager refused the change:", o);
    });
  }
  /**
   * What the item does, once the menu has done its part: by now it has closed and put the
   * focus back on the `⋯` (or the row) — except for delete, kept open to ask.
   */
  _onMenuAction(t, e) {
    const s = this._conversations.find((i) => i.id === e.dataset.menuFor);
    if (!s) return;
    const r = s.id;
    switch (t) {
      case "rename": {
        const i = this.querySelector(We("data-conv-id", r));
        i && this._startRename(i, s);
        return;
      }
      // The two toggles dispatch each name as a LITERAL, in its own branch: the
      // manifest analyzer records a dispatch whose name is a ternary as an event
      // with no name (the Angular generator then crashes on it), and one whose
      // name is a local as an event called after the local.
      case "pin":
        if (s.pinnedAt) {
          const i = new CustomEvent(
            "aparte-conversation-unpin",
            { detail: { id: r }, bubbles: !0, composed: !0, cancelable: !0 }
          );
          this.dispatchEvent(i), this._manage(i, (a) => a.unpin(r));
        } else {
          const i = new CustomEvent(
            "aparte-conversation-pin",
            { detail: { id: r }, bubbles: !0, composed: !0, cancelable: !0 }
          );
          this.dispatchEvent(i), this._manage(i, (a) => a.pin(r));
        }
        return;
      case "archive":
        if (s.archivedAt) {
          const i = new CustomEvent(
            "aparte-conversation-unarchive",
            { detail: { id: r }, bubbles: !0, composed: !0, cancelable: !0 }
          );
          this.dispatchEvent(i), this._manage(i, (a) => a.unarchive(r));
        } else {
          const i = new CustomEvent(
            "aparte-conversation-archive",
            { detail: { id: r }, bubbles: !0, composed: !0, cancelable: !0 }
          );
          this.dispatchEvent(i), this._manage(i, (a) => a.archive(r));
        }
        return;
      case "delete": {
        const i = [...e.childNodes], a = document.createElement("div");
        a.innerHTML = this._confirmMarkup(s), e.append(...a.childNodes), e.setAttribute("role", "dialog"), e.setAttribute("aria-label", this._confirmQuestion(s)), e.querySelector('[data-menu-action="cancel"]')?.focus();
        for (const o of i) o.remove();
        this._placeQuestion(e, r);
        return;
      }
      case "cancel":
        return;
      case "confirm-delete": {
        const i = new CustomEvent(
          "aparte-conversation-delete",
          { detail: { id: r }, bubbles: !0, composed: !0, cancelable: !0 }
        );
        this.dispatchEvent(i), this._manage(i, (a) => a.delete(r));
        return;
      }
    }
  }
  /**
   * The delete question's own keys: the arrows, Home and End between its two answers.
   * A menu holds no item while it asks, so the menu's own arrows have nothing to move
   * to; Escape and Tab are still the menu's, and close it.
   */
  _onQuestionKeydown(t, e) {
    if (t.defaultPrevented) return;
    const s = Array.from(e.querySelectorAll("[data-menu-action]")), r = s.indexOf(Et(this)), i = (a) => {
      t.preventDefault(), s[(a + s.length) % s.length]?.focus();
    };
    switch (t.key) {
      case "ArrowDown":
        i(r + 1);
        return;
      case "ArrowUp":
        i(r - 1);
        return;
      case "Home":
        i(0);
        return;
      case "End":
        i(s.length - 1);
        return;
    }
  }
  // ─── Rename ───────────────────────────────────────────────────────────
  _startRename(t, e) {
    const s = t.querySelector(".aparte-conv-item__select");
    if (!s) return;
    const r = document.createElement("input");
    r.type = "text", r.className = "aparte-field aparte-field--sm aparte-conv-item__input", r.value = e.title, r.setAttribute("aria-label", this._t("conversationTitle")), r.dataset.renameId = e.id, s.replaceWith(r), this._renaming = { id: e.id, input: r, done: !1 }, r.addEventListener("blur", (i) => {
      const a = i.relatedTarget;
      this._finishRename(!0, !a || this.contains(a));
    }), r.focus(), r.select();
  }
  /**
   * One exit for the three ways out (Enter, Escape, leaving the field), guarded so
   * the blur a removal causes cannot commit a second time. The row is re-rendered
   * from the array either way: the list shows data, and the host's re-assignment is
   * what makes the new title appear.
   *
   * `restoreFocus` puts the keyboard back on the row: every exit destroys the field
   * the reader was in, so without it the focus lands on `<body>` and the next Tab
   * restarts at the top of the page. The caller decides — the blur path says no when
   * the focus is already heading somewhere live outside this list.
   */
  _finishRename(t, e) {
    const s = this._renaming;
    if (!s || s.done) return;
    s.done = !0;
    const r = this._conversations.find((a) => a.id === s.id), i = s.input.value.trim();
    if (this._render(), t && r && i && i !== r.title) {
      const a = new CustomEvent(
        "aparte-conversation-rename",
        { detail: { id: r.id, title: i }, bubbles: !0, composed: !0, cancelable: !0 }
      );
      this.dispatchEvent(a), this._manage(a, (o) => o.updateTitle(r.id, i));
    }
    e && this.querySelector(`[data-select-id="${yt(s.id)}"]`)?.focus();
  }
  // ─── Events ───────────────────────────────────────────────────────────
  _onClick = (t) => {
    const e = t.target, s = e.closest("[data-menu-action]"), r = s?.closest("[data-menu-for]");
    if (s && r) {
      t.stopPropagation(), this._onMenuAction(s.dataset.menuAction, r);
      return;
    }
    if (e.closest("[data-more-id]")) {
      t.stopPropagation();
      return;
    }
    if (e.closest("[data-rename-id]")) return;
    const i = e.closest("[data-select-id]");
    if (i) {
      const a = this.getAttribute("target");
      this.dispatchEvent(new CustomEvent(
        "aparte-conversation-select",
        { detail: { id: i.dataset.selectId, ...a ? { targetId: a } : {} }, bubbles: !0, composed: !0 }
      ));
    }
  };
  _onKeydown = (t) => {
    const e = t.target, s = e.closest("[data-menu-for]");
    if (s) {
      s.getAttribute("role") === "dialog" && this._onQuestionKeydown(t, s);
      return;
    }
    if (e.matches("[data-rename-id]")) {
      t.key === "Enter" ? (t.preventDefault(), this._finishRename(!0, !0)) : t.key === "Escape" && (t.preventDefault(), this._finishRename(!1, !0));
      return;
    }
  };
  /** Update active class without full re-render (perf optimisation). */
  _updateActiveState() {
    this.querySelectorAll("[data-conv-id]").forEach((e) => {
      const s = e.dataset.convId === this._activeId;
      e.classList.toggle("aparte-conv-item--active", s), e.querySelector("[data-select-id]")?.setAttribute("aria-current", s ? "page" : "false");
    });
  }
}
rt(Dc);
customElements.get("aparte-conversation-list") || customElements.define("aparte-conversation-list", Dc);
const Hc = (n) => typeof n == "string" || typeof n == "object" && n !== null && typeof n.label == "string", Ks = (n) => {
  try {
    const t = JSON.parse(n);
    return Array.isArray(t) ? t.filter(Hc) : [];
  } catch {
    return console.warn('[aparte-suggestions] `suggestions` is not a JSON array. Use ["…"] or [{"label": "…", "prompt": "…"}].'), [];
  }
}, co = (n) => typeof n == "string" ? n : n.label, uo = (n) => typeof n == "string" ? n : n.prompt ?? n.label;
class Bc extends HTMLElement {
  static get observedAttributes() {
    return ["suggestions", "target", "empty-only", "answers"];
  }
  _suggestions = [];
  _composer = null;
  /** The viewport of the chat this row serves, while `empty-only` follows it. */
  _transcript = null;
  _transcriptObserver = null;
  /** The composer sent since the transcript was last seen empty. */
  _sent = !1;
  _wasEmpty = !0;
  /** `hidden` was written by this element, so it is this element's to lift. */
  _hidOwn = !1;
  /*
   * `empty-only` follows the transcript: shown while it is empty, hidden once it has
   * messages, so a restored thread (nothing sent yet) has no starters on top of it
   * and a new chat brings them back. The send is the other half, because it comes first — the row
   * hides on the click rather than a frame later when the bubble lands — and because
   * it is all there is to read when the messages are not `<aparte-chat-bubble>`s
   * (a wrapper's `renderBubble`) or there is no transcript at all. A transcript seen
   * going from full to empty is a new conversation, which forgets the send.
   */
  _onSend = () => {
    this.hasAttribute("answers") && this._showAnswers([]), this.hasAttribute("empty-only") && (this._transcript || this._watchTranscript(), this._sent = !0, this._applyEmptyOnly());
  };
  _applyEmptyOnly = () => {
    const t = this._transcript ? wc(this._transcript) : !0;
    t && !this._wasEmpty && (this._sent = !1), this._wasEmpty = t, this._setHidden(!t || this._sent);
  };
  _onConfigChange = () => {
    const t = this.querySelector(".aparte-suggestions");
    t && t.setAttribute("aria-label", this._groupLabel());
  };
  /** The starters. Setting it re-renders; the `suggestions` attribute is the JSON form. */
  get suggestions() {
    return this._suggestions;
  }
  /**
   * Takes the array, or the JSON string the attribute documents.
   *
   * Both, because both arrive: React 19 and Svelte assign the PROPERTY whenever the
   * element has one of that name, so `<aparte-suggestions suggestions='[…]'>` — the
   * documented spelling, typed valid by both wrappers — reaches this setter as a
   * string while the attribute (and so `attributeChangedCallback`) is never written.
   */
  set suggestions(t) {
    this._suggestions = typeof t == "string" ? Ks(t) : Array.isArray(t) ? t.filter(Hc) : [], this.isConnected && this._render();
  }
  connectedCallback() {
    this.hasAttribute("suggestions") && this._readAttribute(), this._render(), this._watchComposer(), window.addEventListener("aparte-config-change", this._onConfigChange);
  }
  disconnectedCallback() {
    this._composer?.removeEventListener("aparte-send", this._onSend), this._composer = null, this._transcriptObserver?.disconnect(), this._transcriptObserver = null, this._transcript = null, this._stopHolding(), window.removeEventListener("aparte-config-change", this._onConfigChange);
  }
  attributeChangedCallback(t) {
    this.isConnected && (t === "suggestions" ? (this._readAttribute(), this._render()) : t === "target" ? this._watchComposer() : t === "answers" ? this._watchTranscript() : t === "empty-only" && (this._watchTranscript(), this.hasAttribute("empty-only") || (this._sent = !1, this._setHidden(!1))));
  }
  _groupLabel() {
    return $(this).t("suggestionsLabel") || "Suggested prompts";
  }
  _parsed = null;
  /**
   * Parse the `suggestions` attribute once per value. The attribute callback and
   * `connectedCallback` both arrive for a parsed element, in an order the parser
   * decides; without this, an invalid value warned twice.
   */
  _readAttribute() {
    const t = this.getAttribute("suggestions");
    t === null || t === this._parsed || (this._parsed = t, this._suggestions = Ks(t));
  }
  /**
   * The composer the click goes through, resolved the way the composer's own parts
   * resolve it — by ancestry first. Outside a composer, `target` names the chat and the
   * composer serving it is either inside that chat or points at it; the first composer
   * on the page is the last resort, so the one-chat page needs no attribute at all.
   */
  _resolveComposer() {
    const t = this.closest("aparte-composer");
    if (t) return t;
    const e = this.getAttribute("target");
    if (e) {
      const r = document.getElementById(e)?.querySelector("aparte-composer");
      if (r) return r;
      for (const i of document.querySelectorAll("aparte-composer[target]"))
        if (i.getAttribute("target") === e) return i;
    }
    return document.querySelector("aparte-composer");
  }
  _watchComposer() {
    this._composer?.removeEventListener("aparte-send", this._onSend), this._composer = this._resolveComposer(), this._composer?.addEventListener("aparte-send", this._onSend), this._watchTranscript();
  }
  /**
   * The transcript of the chat the click goes to: the chat around the composer, else
   * the one around this element, else the one `target` names (here, or on that
   * composer). No last resort on the page, unlike the composer's: following another
   * chat's transcript would be worse than following none, which falls back to the send.
   */
  _resolveTranscript() {
    const t = this.getAttribute("target") ?? this._composer?.getAttribute("target") ?? null, e = jt(this._composer) ?? jt(this) ?? (t ? document.getElementById(t) : null);
    return e ? e.matches("aparte-chat-viewport") ? e : e.querySelector("aparte-chat-viewport") : null;
  }
  /** Follow the transcript while `empty-only` or `answers` is set, and stop following it when neither is. */
  _watchTranscript() {
    const e = this.hasAttribute("empty-only") || this.hasAttribute("answers") ? this._resolveTranscript() : null;
    e !== this._transcript && (this._transcriptObserver?.disconnect(), this._transcriptObserver = null, this._transcript = e, e && (this._transcriptObserver = new MutationObserver(this._onTranscript), this._transcriptObserver.observe(e, {
      childList: !0,
      subtree: !0,
      attributes: !0,
      attributeFilter: ["loading"]
    }))), this._onTranscript();
  }
  _onTranscript = () => {
    this.hasAttribute("empty-only") && this._applyEmptyOnly(), this.hasAttribute("answers") && this._applyAnswers();
  };
  /**
   * `answers`: the replies the LAST message offered, written by a ```suggestions block
   * (`setupSuggestionBlocks`) as a hidden `[data-aparte-suggestions]` mark in that
   * message. A last message that is the person's, or that offers none, shows none: the
   * offer was for the answer it came with.
   */
  _applyAnswers() {
    const t = this._transcript?.querySelectorAll("aparte-chat-bubble"), e = t && t.length ? t[t.length - 1] : null, s = e && e.getAttribute("data-role") !== "user" ? e.querySelectorAll("[data-aparte-suggestions]") : null, r = s && s.length ? s[s.length - 1] : null, i = r ? Ks(r.getAttribute("data-aparte-suggestions") ?? "[]") : [];
    this._showAnswers(i.map(pf).filter((a) => a !== null));
  }
  /** Show these replies; the same ones already shown redraw nothing (a transcript mutation is frequent). */
  _showAnswers(t) {
    JSON.stringify(t) !== JSON.stringify(this._suggestions) && (this._suggestions = t, this.isConnected && this._render());
  }
  /** Set `hidden`, or lift it only when this element set it: a `hidden` the page wrote stays. */
  _setHidden(t) {
    if (t) {
      if (this.hidden) return;
      this.hidden = !0, this._hidOwn = !0;
    } else this._hidOwn && (this.hidden = !1, this._hidOwn = !1);
  }
  _render() {
    if (this.replaceChildren(), this._suggestions.length === 0) {
      this.setAttribute("data-empty", "");
      return;
    }
    this.removeAttribute("data-empty");
    const t = document.createElement("div");
    t.className = "aparte-suggestions", t.setAttribute("role", "group"), t.setAttribute("aria-label", this._groupLabel());
    for (const e of this._suggestions) {
      const s = document.createElement("button");
      s.type = "button", s.className = "aparte-btn aparte-btn--surface aparte-btn--pill aparte-suggestion", s.textContent = co(e);
      const r = uo(e);
      r !== s.textContent && (s.title = r), s.addEventListener("click", () => this._activate(e)), t.appendChild(s);
    }
    this.appendChild(t);
  }
  _sending = !1;
  _sendingTimer;
  _stopHolding = () => {
    this._sending = !1, clearTimeout(this._sendingTimer), window.removeEventListener("aparte-message-start", this._onTurnStart);
  };
  /**
   * The latch ends when ITS chat's turn starts. Another chat's `aparte-message-start` crosses the
   * window too, and must not release it: the second chip would then send a second message while the
   * first is still being built. The composer's own rule: an event naming no chat is for every chat.
   */
  _onTurnStart = (t) => {
    const e = t.detail?.targetId, s = this._ownChatId();
    (!e || !s || e === s) && this._stopHolding();
  };
  /** The chat the sending composer belongs to: its `target`, else the id of the chat host above it. */
  _ownChatId() {
    const t = this._composer, e = t?.getAttribute("target");
    if (e) return e;
    for (let s = t?.parentElement ?? null; s; s = s.parentElement)
      if ((s.tagName.toLowerCase() === "aparte-chat" || s.hasAttribute("data-aparte-chat")) && s.id) return s.id;
  }
  /** A chip sent: no other chip sends until the turn has started, or a second has passed without one. */
  _holdUntilStreaming() {
    this._stopHolding(), this._sending = !0, window.addEventListener("aparte-message-start", this._onTurnStart), this._sendingTimer = setTimeout(this._stopHolding, 1e3);
  }
  _activate(t) {
    const e = { label: co(t), prompt: uo(t) };
    if (!this.dispatchEvent(new CustomEvent("aparte-suggestion", {
      detail: e,
      bubbles: !0,
      composed: !0,
      cancelable: !0
    }))) return;
    const r = this._composer ?? this._resolveComposer();
    if (!r) {
      console.warn("[aparte-suggestions] no <aparte-composer> to send through — put the element inside one, or point `target` at the chat it serves.");
      return;
    }
    r !== this._composer && this._watchComposer();
    const i = r;
    if (i.panelActive) return;
    const a = this.getAttribute("mode") === "fill";
    if (!a && (i.streaming || this._sending)) return;
    const o = this.contains(document.activeElement), l = typeof r.value == "string" ? r.value : "", c = a ? [] : (r.attachments ?? []).slice();
    if (c.length && r.clearAttachments(), r.setValue(e.prompt), a) r.focus();
    else {
      let d = !1;
      const h = () => {
        d = !0;
      };
      r.addEventListener("aparte-send", h, { once: !0 }), r.submit(), r.removeEventListener("aparte-send", h), d && this._holdUntilStreaming(), c.length && r.addAttachments(c), (typeof r.value == "string" ? r.value : "") !== l && r.setValue(l), o && r.focus();
    }
  }
}
rt(Bc);
customElements.get("aparte-suggestions") || customElements.define("aparte-suggestions", Bc);
const ho = (n, t) => {
  const e = Number(n);
  return n !== null && Number.isFinite(e) && e > 0 && e <= 1 ? e : t;
}, Og = (n) => (n instanceof Element ? n.closest("aparte-chat, [data-aparte-chat]") : null)?.id || void 0, at = (n, t, e) => {
  const s = document.createElement(n);
  return s.className = t, e !== void 0 && (s.textContent = e), s;
}, po = "http://www.w3.org/2000/svg", $g = () => {
  const n = document.createElementNS(po, "svg");
  n.setAttribute("class", "aparte-context__ring"), n.setAttribute("viewBox", "0 0 36 36");
  for (const t of ["track", "value"]) {
    const e = document.createElementNS(po, "circle");
    e.setAttribute("class", `aparte-context__${t}`), e.setAttribute("cx", "18"), e.setAttribute("cy", "18"), e.setAttribute("r", "15.5"), t === "value" && e.setAttribute("pathLength", "100"), n.appendChild(e);
  }
  return n;
}, fo = (n) => !!n && typeof n.getMessages == "function", Ng = (n) => {
  if (!n) return null;
  if (fo(n)) return n;
  const t = n.viewport ?? n.querySelector("aparte-chat-viewport");
  return fo(t) ? t : null;
};
let Pg = 0;
const Dg = { system: 0, tools: 0, summary: 0, messages: 0 };
class qc extends HTMLElement {
  static get observedAttributes() {
    return ["window", "warn", "danger", "target", "variant", "used"];
  }
  /**
   * A reading with no transcript behind it: the `used` attribute's seed, or a turn's usage
   * when the chat's list cannot be read from here (a gauge placed far from its chat, a test).
   * When the list can be read, the measure comes from it and this is only the fallback.
   */
  _used = null;
  _level = null;
  /** The last turn's usage and the reply it belongs to, so the measure has it before the list has written it back. */
  _lastDone = null;
  /** What the model reads changed with nothing on the path to say so (a Restore): the reading is an estimate until the next turn reports. */
  _viewChanged = !1;
  /** A conversation was replaced and nothing has reported or loaded since: the list on screen is not read yet. */
  _blank = !1;
  /** The model refused a request as over its window; the level is `danger` until something changes. */
  _overflow = !1;
  _compact = null;
  _failure = "";
  _open = !1;
  /** The reading drawn last, so the `used` getter and the panel read what is on screen. */
  _measured = null;
  /** The chat an event last came from, for a gauge that is neither under its chat nor names it with `target`. */
  _seen = null;
  /** What the panel was last built from: a render that changes nothing leaves its nodes, and the focus in them, alone. */
  _panelSignature = "";
  _remember(t) {
    const e = t instanceof Element ? jt(t) : null;
    e && (this._seen = e);
  }
  _onDone = (t) => {
    const e = t.detail;
    !e?.usage || !this._isMine(e.targetId) || (this._remember(t.target), this._used = Er(e.usage), this._lastDone = { messageId: e.messageId, usage: e.usage }, this._viewChanged = !1, this._blank = !1, this._overflow = !1, this._render());
  };
  /**
   * A conversation is replaced — a new chat, or one loaded in place of the last — and the
   * previous reading is not this one's. The viewport says so with `aparte-reset-done` (no
   * detail: the chat is found from where the event came from). A load clears first and
   * `aparte-conversation-loaded` follows, so the reading is dropped here and read again
   * there. Until then the chat's list is not trusted: a framework's may not have caught up.
   */
  _onReset = (t) => {
    this._isMine(Og(t.target)) && (this._remember(t.target), this._used = null, this._lastDone = null, this._viewChanged = !1, this._overflow = !1, this._compact = null, this._blank = !0, this._render());
  };
  /**
   * The messages of a stored conversation are on screen: the reading is the last reply's
   * usage — what a turn would have reported had it just ended. A transcript with none
   * (an empty one, a conversation saved before usage was kept) shows nothing, the same as
   * a chat that has not spoken yet.
   */
  _onLoaded = (t) => {
    const e = t.detail;
    if (!this._isMine(e?.targetId)) return;
    this._remember(t.target), this._blank = !1, this._lastDone = null, this._viewChanged = !1, this._overflow = !1, this._compact = null;
    const i = [...t.target?.getMessages?.() ?? []].reverse().find((a) => a.role === "assistant" && a.usage);
    this._used = i?.usage ? Er(i.usage) : null, this._render();
  };
  /** A compaction began for this chat: say so on the element and in the panel. */
  _onCompactStart = (t) => {
    const e = t.detail;
    this._isMine(e?.targetId) && (this._compact = "running", this._failure = "", this._render());
  };
  /**
   * After a real compaction — or a Restore — what the model reads is a different size by an
   * amount nobody has measured yet, and the last reply's reported usage describes the request
   * from before. The gauge measures the request that would be sent now and says so with `~`,
   * rather than keeping a number it knows to be wrong or going blank until the next turn. The
   * event names the chat it compacted, so on a multi-chat page only that chat's gauge
   * moves; an unnamed one moves every gauge.
   *
   * Without a transcript to measure (a gauge that cannot read its chat's list) there is
   * nothing to estimate from, and the reading is dropped as it always was.
   */
  _onCompacted = (t) => {
    const e = t.detail;
    if (this._isMine(e?.targetId)) {
      if (this._compact = null, e?.skipped) {
        this._render();
        return;
      }
      this._viewChanged = !0, this._overflow = !1, this._messages() || (this._used = null), this._render();
    }
  };
  _onCompactError = (t) => {
    const e = t.detail;
    this._isMine(e?.targetId) && (this._compact = e?.aborted ? null : "failed", this._failure = e?.aborted ? "" : typeof e?.error == "string" ? e.error : "", this._render());
  };
  /** The model refused this chat's request as over its window: the number was wrong, and so is "ok". */
  _onMessageError = (t) => {
    const e = t.detail;
    this._isMine(e?.targetId) && e?.error?.code === tt.USAGE_CONTEXT_EXCEEDED && (this._remember(t.target), this._overflow = !0, this._render());
  };
  _onRerender = () => this._render();
  /** Tokens in use — what is drawn — else the last reported or seeded reading, else `null`. */
  get used() {
    return this._measured?.used ?? this._used;
  }
  /**
   * Writes the `used` attribute: a reading for a conversation restored without a turn of
   * this page, which had nothing to report until the next one. `null` clears it.
   */
  set used(t) {
    t == null ? this.removeAttribute("used") : this.setAttribute("used", String(t));
  }
  /** The window in force — the attribute, else the current model's. */
  get window() {
    return this._window();
  }
  /**
   * Writes the `window` attribute; `null` gives the model's own window back.
   *
   * The setter has to exist: React 19 and Svelte assign the PROPERTY whenever the
   * element has one of that name, so `<aparte-context window={8000}>` — a spelling
   * both wrappers type as valid — hit a getter alone and threw.
   */
  set window(t) {
    t == null ? this.removeAttribute("window") : this.setAttribute("window", String(t));
  }
  /** The current level, or `null` while nothing is shown. */
  get level() {
    return this._level;
  }
  /** The reading drawn now, parts and all, or `null` while nothing is shown. */
  get measure() {
    return this._measured;
  }
  connectedCallback() {
    window.addEventListener("aparte-message-done", this._onDone), window.addEventListener("aparte-message-error", this._onMessageError), window.addEventListener("aparte-compact-start", this._onCompactStart), window.addEventListener("aparte-compact-done", this._onCompacted), window.addEventListener("aparte-compact-error", this._onCompactError), window.addEventListener("aparte-reset-done", this._onReset), window.addEventListener("aparte-conversation-loaded", this._onLoaded), window.addEventListener("aparte-config-change", this._onRerender), this.addEventListener("click", this._onClick), this.addEventListener("keydown", this._onKeydown), this._render();
  }
  disconnectedCallback() {
    window.removeEventListener("aparte-message-done", this._onDone), window.removeEventListener("aparte-message-error", this._onMessageError), window.removeEventListener("aparte-compact-start", this._onCompactStart), window.removeEventListener("aparte-compact-done", this._onCompacted), window.removeEventListener("aparte-compact-error", this._onCompactError), window.removeEventListener("aparte-reset-done", this._onReset), window.removeEventListener("aparte-conversation-loaded", this._onLoaded), window.removeEventListener("aparte-config-change", this._onRerender), this.removeEventListener("click", this._onClick), this.removeEventListener("keydown", this._onKeydown), this._stopListeningWhileOpen();
  }
  attributeChangedCallback(t) {
    if (t === "used") {
      const e = Number(this.getAttribute("used"));
      this._used = this.hasAttribute("used") && Number.isFinite(e) && e >= 0 ? e : null;
    }
    this.isConnected && this._render();
  }
  /**
   * The config the chat this gauge watches answers to, not the one at the gauge's own
   * position. A gauge in a header, with `target=`, stands outside the chat's boundary, and
   * a chat that carries its own config (a wrapper's `config` prop) has its own prompt, tools,
   * window and compactor: the client and the plugin read them from there, so the gauge must
   * too, or it measures a different request and offers no Compact now. Resolved live, like
   * every config read: the boundary may be attached after this element connects.
   */
  _cfg() {
    return $(this._chat() ?? this);
  }
  _window() {
    const t = Number(this.getAttribute("window"));
    if (this.hasAttribute("window") && Number.isFinite(t) && t > 0) return t;
    const e = this._cfg().getCurrentModel();
    return e?.contextWindow && e.contextWindow > 0 ? e.contextWindow : null;
  }
  /** The chat this gauge watches: `target`, else the chat host above it — the composer's rule. */
  _ownTargetId() {
    const t = this.getAttribute("target");
    if (t) return t;
    let e = this.parentElement;
    for (; e; ) {
      if ((e.tagName.toLowerCase() === "aparte-chat" || e.hasAttribute("data-aparte-chat")) && e.id) return e.id;
      e = e.parentElement;
    }
  }
  _isMine(t) {
    const e = this._ownTargetId();
    return !t || !e || t === e;
  }
  /**
   * The chat's element: the one `target` names, else the chat above the gauge, else the one
   * its events last came from. Passed to the compactor as it is — a chat inside a shadow
   * root is not found by id, so the element is the address that always works.
   */
  _chat() {
    const t = this.getAttribute("target");
    if (t) {
      const r = this.getRootNode().getElementById?.(t) ?? document.getElementById(t);
      if (r) return r;
    }
    const e = jt(this);
    return e || (this._seen?.isConnected ? this._seen : null);
  }
  /** The chat's active path, or `null` when it cannot be read from here. */
  _messages() {
    const t = Ng(this._chat());
    if (!t) return null;
    try {
      return t.getMessages();
    } catch {
      return null;
    }
  }
  /**
   * What to draw: the measure of the chat's own transcript when it holds a reply with usage
   * (or the model has just refused a request, and an estimate is better than nothing), else
   * the seeded or reported number with nothing to break down.
   *
   * The last turn's usage is laid over its reply when the list has not written it back yet.
   * If the list does not hold that reply at all it is not used: the list is the path on
   * screen, and a reply that is not on it (a branch was switched) is not its reading.
   */
  _measure(t) {
    const e = this._messages(), s = this._lastDone, r = e && s?.messageId ? e.map((a) => a.id === s.messageId && !a.usage ? { ...a, usage: s.usage } : a) : e, i = !!r?.some((a) => a.role === "assistant" && a.usage);
    return r && (i && !this._blank || this._overflow && r.length > 0) ? Hf({ messages: r, config: this._cfg(), windowOverride: t, viewChanged: this._viewChanged }) : this._used === null ? null : { window: t, used: this._used, estimated: !1, parts: { ...Dg }, other: this._used };
  }
  _render() {
    const t = this._window(), e = t === null ? null : this._measure(t);
    if (this._compact ? this.setAttribute("data-compact", this._compact) : this.removeAttribute("data-compact"), t === null || e === null) {
      this._measured = null, this.setAttribute("data-empty", ""), this.removeAttribute("data-level"), this._open = !1, this._stopListeningWhileOpen(), this._panelSignature = "", this.replaceChildren(), this._level = null;
      return;
    }
    this._measured = e, this.removeAttribute("data-empty");
    const s = e.used, r = Math.min(1, s / t), i = ho(this.getAttribute("warn"), 0.75), a = ho(this.getAttribute("danger"), 0.9), o = this._overflow || r >= a ? "danger" : r >= i ? "warn" : "ok";
    this.setAttribute("data-level", o);
    const l = this.getAttribute("variant") === "ring";
    let c = this.querySelector(".aparte-context");
    c && c.classList.contains("aparte-context--ring") !== l && (this.replaceChildren(), c = null, this._panelSignature = "");
    let d = this.querySelector('[role="meter"]'), h = this.querySelector(".aparte-context__text"), u = this.querySelector(".aparte-context__toggle"), p = this.querySelector(".aparte-context__name"), f = this.querySelector(".aparte-context__panel");
    (!c || !d || !h || !u || !p || !f) && (c = at("div", l ? "aparte-context aparte-context--ring" : "aparte-context"), d = l ? $g() : at("div", "aparte-progress"), d.setAttribute("role", "meter"), l || d.appendChild(at("div", "aparte-progress__bar")), u = at("button", "aparte-btn aparte-btn--ghost aparte-btn--sm aparte-context__toggle"), u.type = "button", p = at("span", "aparte-sr-only"), p.classList.add("aparte-context__name"), h = at("span", "aparte-context__text"), u.append(p, h), f = at("div", "aparte-context__panel aparte-popover"), f.id = `aparte-context-panel-${++Pg}`, f.setAttribute("role", "group"), f.hidden = !0, u.setAttribute("aria-controls", f.id), c.append(d, u, f), this.replaceChildren(c), this._panelSignature = "");
    const _ = this._cfg(), g = _.getLocale().tag || void 0, v = new Intl.NumberFormat(g, { notation: "compact", maximumFractionDigits: 1 }), S = e.estimated ? "~" : "", A = `${S}${v.format(s)} / ${v.format(t)}`, C = Math.round(r * 100), b = _.t("contextLabel") || "Context window";
    if (l) {
      const y = d.querySelector(".aparte-context__value");
      y?.style.setProperty("--aparte-context-ratio", String(C)), y?.classList.toggle("aparte-context__value--empty", C === 0), c.title = A;
    } else
      d.style.setProperty("--aparte-progress-value", String(C));
    if (d.setAttribute("aria-valuemin", "0"), d.setAttribute("aria-valuemax", String(t)), d.setAttribute("aria-valuenow", String(s)), d.setAttribute("aria-label", `${b}: ${A}`), p.textContent = `${b}: `, u.setAttribute("aria-expanded", String(this._open)), h.textContent = l ? `${S}${new Intl.NumberFormat(g, { style: "percent", maximumFractionDigits: 0 }).format(C / 100)}` : A, f.setAttribute("aria-label", b), f.hidden = !this._open, this._open ? this._renderPanel(f, e, t, v) : this._panelSignature = "", o !== this._level) {
      this._level = o;
      const y = this._ownTargetId(), E = { level: o, used: s, window: t, ratio: r, targetId: y };
      this.dispatchEvent(new CustomEvent("aparte-context-threshold", { detail: E, bubbles: !0, composed: !0 }));
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // The panel
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * What the window holds, row by row, and what can be done about it.
   *
   * The parts are raw estimates and `used` is the number the gauge draws — measured or
   * calibrated — so they need not agree. The panel never shows a sum above the total: when
   * the estimates add up to more than `used`, each is scaled down to fit and `other` is
   * zero; otherwise the difference is `other`, the part the heuristic cannot see.
   */
  _renderPanel(t, e, s, r) {
    const i = this._cfg(), a = i.getCompactor(), o = this._chat(), l = this._ownTargetId();
    let c = null;
    try {
      c = a?.preview?.({ target: o, ...l ? { targetId: l } : {} }) ?? null;
    } catch {
      c = null;
    }
    const { parts: d, used: h } = e, u = d.system + d.tools + d.summary + d.messages, p = u > h && u > 0 ? h / u : 1, f = e.estimated ? "~" : "", _ = [
      { key: "system", label: i.t("contextSystem") || "System prompt", tokens: d.system * p, approx: "~" },
      { key: "tools", label: i.t("contextTools") || "Tools", tokens: d.tools * p, approx: "~" },
      { key: "summary", label: i.t("contextSummary") || "Summary", tokens: d.summary * p, approx: "~" },
      { key: "messages", label: i.t("contextMessages") || "Messages", tokens: d.messages * p, approx: "~" },
      { key: "other", label: i.t("contextOther") || "Other", tokens: p < 1 ? 0 : e.other, approx: "~" },
      { key: "free", label: i.t("contextFree") || "Free", tokens: Math.max(0, s - h), approx: f }
    ], g = `${f}${r.format(h)} / ${r.format(s)}`, v = c && c.tokens > 0 ? (i.t("contextReclaim") || "Compacting now would free ~{n} tokens").replace("{n}", () => r.format(Math.round(c.tokens))) : "", S = !!a && !!c && this._compact === null, A = at("ul", "aparte-context__rows");
    for (const w of _) {
      const I = at("li", "aparte-context__row");
      I.setAttribute("data-part", w.key), I.append(at("span", "aparte-context__row-label", w.label)), I.append(at("span", "aparte-context__row-value", `${w.approx}${r.format(Math.round(w.tokens))}`));
      const O = at("div", "aparte-progress aparte-context__row-bar");
      O.setAttribute("aria-hidden", "true"), O.style.setProperty("--aparte-progress-value", String(Math.round(Math.min(1, w.tokens / s) * 100))), O.appendChild(at("div", "aparte-progress__bar")), I.append(O), A.append(I);
    }
    const C = at("li", "aparte-context__row aparte-context__row--total");
    C.setAttribute("data-part", "total"), C.append(at("span", "aparte-context__row-label", i.t("contextTotal") || "Total"), at("span", "aparte-context__row-value", g)), A.append(C);
    const b = [A];
    if (this._compact === "running") {
      const w = at("p", "aparte-context__status aparte-shimmer", i.t("checkpointPending") || "Summarising the context…");
      w.setAttribute("role", "status"), b.push(w);
    } else if (this._compact === "failed") {
      const w = at("p", "aparte-context__status aparte-context__status--failed", i.t("checkpointFailed") || "Couldn't summarise the context");
      w.setAttribute("role", "status"), this._failure && (w.title = this._failure, w.appendChild(at("span", "aparte-sr-only", `: ${this._failure}`))), b.push(w, this._action("retry", i.t("retry") || "Retry"));
    }
    v && b.push(at("p", "aparte-context__reclaim", v)), S && b.push(this._action("compact", i.t("contextCompactNow") || "Compact now"));
    const y = at("div", "aparte-context__content");
    if (y.append(...b), y.innerHTML === this._panelSignature) return;
    this._panelSignature = y.innerHTML;
    const E = document.activeElement, R = E && t.contains(E) ? E.getAttribute("data-context-action") ?? "" : null;
    t.replaceChildren(...Array.from(y.childNodes)), R !== null && ((R ? t.querySelector(`[data-context-action="${yt(R)}"]`) : null) ?? this.querySelector(".aparte-context__toggle"))?.focus();
  }
  _action(t, e) {
    const s = at("button", "aparte-btn aparte-btn--sm aparte-btn--surface aparte-context__action", e);
    return s.type = "button", s.setAttribute("data-context-action", t), s;
  }
  /**
   * Ask the registered compactor to compact this chat now, as a person asked. With none
   * registered (Retry only — Compact now is not offered without one) the command event
   * is the way to ask, the one a host's own button uses.
   */
  async _compactNow(t) {
    const e = this._cfg().getCompactor(), s = this._ownTargetId();
    if (!e) {
      window.dispatchEvent(new CustomEvent("aparte-compact", { detail: { targetId: s } }));
      return;
    }
    this._compact = "running", this._failure = "", this._render();
    let r = null;
    try {
      const i = await e.compact({ target: this._chat(), ...s ? { targetId: s } : {}, force: !0, reason: t });
      i.ok ? i.skipped || (this._viewChanged = !0) : r = i.error;
    } catch (i) {
      r = i instanceof Error ? i.message : String(i);
    }
    this._compact === "running" && (this._compact = r === null ? null : "failed", this._failure = r ?? ""), this.isConnected && this._render();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // The disclosure
  // ─────────────────────────────────────────────────────────────────────────
  _onClick = (t) => {
    const e = t.target, s = e?.closest?.("[data-context-action]");
    if (s) {
      this._compactNow(s.getAttribute("data-context-action") === "retry" ? "retry" : "manual");
      return;
    }
    e?.closest?.(".aparte-context__panel") || e?.closest?.(".aparte-context") && this._setOpen(!this._open);
  };
  _setOpen(t, e = !1) {
    t !== this._open && (this._open = t, t ? this._listenWhileOpen() : this._stopListeningWhileOpen(), this._render(), t ? this._place() : e && this.querySelector(".aparte-context__toggle")?.focus());
  }
  /**
   * Escape and a click anywhere else close the panel. Listened for on the document only
   * while it is open: a page full of closed gauges holds no listeners but its own.
   */
  _onDocumentClick = (t) => {
    t.composedPath().includes(this) || this._setOpen(!1);
  };
  /**
   * Escape from inside the gauge — the toggle, the panel — is the gauge's, and it is
   * answered HERE, on the element, not on the document. An ancestor that also answers
   * Escape (a launcher closing its card, a dialog) listens on its own element, which runs
   * before any listener on the document, so a press consumed only there had already
   * closed the card around the panel it was meant for. Taken means stopped, so nothing
   * above answers it too, and prevented, so a listener that still sees it — one on this
   * element, a capture listener — knows it is spoken for, and a dialog around does not
   * take it as its own close request.
   */
  _onKeydown = (t) => {
    !this._open || t.key !== "Escape" || (t.preventDefault(), t.stopPropagation(), this._setOpen(!1, !0));
  };
  /**
   * A press elsewhere still closes the panel, but is left to whatever else listens for
   * Escape (a dialog, the composer).
   */
  _onDocumentKeydown = (t) => {
    t.key === "Escape" && this._setOpen(!1, this.contains(document.activeElement));
  };
  _listenWhileOpen() {
    document.addEventListener("click", this._onDocumentClick), document.addEventListener("keydown", this._onDocumentKeydown);
  }
  _stopListeningWhileOpen() {
    document.removeEventListener("click", this._onDocumentClick), document.removeEventListener("keydown", this._onDocumentKeydown);
  }
  /**
   * Where the panel opens: above the reading by default, since a gauge usually sits in the
   * composer at the foot of the page; below when there is no room above, and flush with the
   * other edge when it would run past the window's.
   */
  _place() {
    const t = this.querySelector(".aparte-context__panel");
    if (!t) return;
    t.removeAttribute("data-placement"), t.removeAttribute("data-align");
    const e = this.getBoundingClientRect(), s = t.getBoundingClientRect();
    s.height > 0 && e.top < s.height && t.setAttribute("data-placement", "below");
    const i = getComputedStyle(t).direction === "rtl" ? s.left < 0 : s.right > document.documentElement.clientWidth;
    s.width > 0 && i && t.setAttribute("data-align", "end");
  }
}
rt(qc);
customElements.get("aparte-context") || customElements.define("aparte-context", qc);
const Rn = 60, Hg = 6, Bg = 150, qg = 4, Fg = 1, go = 30;
class Fc extends HTMLElement {
  static get observedAttributes() {
    return ["target", "every"];
  }
  _host = null;
  _mutations = null;
  _resizes = null;
  /** The boxes the resize observer watches: the host, the transcript and its scroll surface. */
  _sized = [];
  _intersections = null;
  /** The bubbles the intersection observer watches — compared by identity, so a re-rendered bubble is re-observed. */
  _observedBubbles = [];
  /**
   * Every message the reading band watches: the ticked ones and, with `every="user"`, the
   * replies too, each read under the question above it.
   */
  _bandTargets = [];
  /** The scroll surface the observer is rooted on, and whose bottom edge is read. */
  _observedSurface = null;
  /** One frame does the queued work: a full rebuild when bubbles came or went, else the re-labels. */
  _frameQueued = !1;
  _rebuildWanted = !1;
  /** Ticked bubbles whose text changed since the last frame: only their names can have moved. */
  _relabel = /* @__PURE__ */ new Set();
  /**
   * Each message's excerpt, read once and forgotten when a mutation touches its text: a
   * rebuild re-read the head of all 500 questions of a long conversation, twice a turn, for
   * names that had not changed.
   */
  _excerpts = /* @__PURE__ */ new WeakMap();
  _pickQueued = !1;
  _currentId = null;
  /**
   * Visible ratio per message in the reading band, from the intersection observer. Keyed by
   * the element, not its id: an id changed in place keeps what the observer saw, and a
   * bubble that left is let go with it.
   */
  _visible = /* @__PURE__ */ new WeakMap();
  /** Whether the last question is on screen at all, from the second observer. */
  _onScreen = /* @__PURE__ */ new WeakSet();
  _onScreenObserver = null;
  /** The mark a jump asked for, held until the transcript has stopped moving. */
  _held = null;
  _settleTimer = null;
  _settleSurface = null;
  /** Re-alignments done for the jump in flight. */
  _alignPasses = 0;
  /** The custom properties written on this element, so each is written only when it changes. */
  _written = /* @__PURE__ */ new Map();
  _onConfigChange = () => this._rebuild();
  _onSurfaceScroll = () => this._bumpSettle();
  /** The id of the message the rail currently marks, or `null`. */
  get currentMessageId() {
    return this._currentId;
  }
  connectedCallback() {
    this.classList.contains("aparte-scroll-rail") || this.classList.add("aparte-scroll-rail"), this.getAttribute("role") || this.setAttribute("role", "navigation"), this.addEventListener("click", this._onClick), this.addEventListener("keydown", this._onKeydown), this.addEventListener("focusin", this._onFocusIn), this.addEventListener("focusout", this._onFocusOut), window.addEventListener("aparte-config-change", this._onConfigChange), this._attach();
  }
  disconnectedCallback() {
    this._detach(), this.removeEventListener("click", this._onClick), this.removeEventListener("keydown", this._onKeydown), this.removeEventListener("focusin", this._onFocusIn), this.removeEventListener("focusout", this._onFocusOut), window.removeEventListener("aparte-config-change", this._onConfigChange);
  }
  attributeChangedCallback(t) {
    this.isConnected && (t === "target" ? this._attach() : this._rebuild());
  }
  // ─── Wiring ───────────────────────────────────────────────────────────
  /** The chat this rail follows: `target`, else the host above it — the gauge's rule. */
  _findHost() {
    const t = this.getAttribute("target");
    if (t) return document.getElementById(t);
    let e = this.parentElement;
    for (; e; ) {
      if (e.tagName.toLowerCase() === "aparte-chat" || e.hasAttribute("data-aparte-chat")) return e;
      e = e.parentElement;
    }
    return null;
  }
  _attach() {
    if (this._detach(), this._host = this._findHost(), !this._host) {
      this._rebuild();
      return;
    }
    typeof MutationObserver < "u" && (this._mutations = new MutationObserver((t) => {
      for (const e of t) {
        if (this.contains(e.target)) continue;
        if (e.type === "attributes") {
          if (Uc(e.target)) {
            this._queueRebuild();
            return;
          }
          continue;
        }
        const r = (e.target instanceof Element ? e.target : e.target.parentElement)?.closest("aparte-chat-bubble");
        if (r) {
          this._excerpts.delete(r), this._ticked(r) && this._queueRelabel(r);
          continue;
        }
        if (e.type === "childList" && (_o(e.addedNodes) || _o(e.removedNodes))) {
          this._queueRebuild();
          return;
        }
      }
    }), this._mutations.observe(this._host, {
      childList: !0,
      subtree: !0,
      characterData: !0,
      attributes: !0,
      attributeFilter: ["message-id", "data-role"]
    })), typeof ResizeObserver < "u" && (this._resizes = new ResizeObserver(() => this._layout())), this._rebuild();
  }
  _detach() {
    this._mutations?.disconnect(), this._mutations = null, this._resizes?.disconnect(), this._resizes = null, this._sized = [], this._relabel.clear(), this._rebuildWanted = !1, this._unobserve(), this._release(), this._host = null;
  }
  /** Coalesce a burst of mutations into one frame of work: a rebuild, which re-names every tick too. */
  _queueRebuild() {
    this._rebuildWanted = !0, this._queueFrame();
  }
  _queueRelabel(t) {
    this._relabel.add(t), this._queueFrame();
  }
  _queueFrame() {
    this._frameQueued || (this._frameQueued = !0, requestAnimationFrame(() => {
      this._frameQueued = !1;
      const t = [...this._relabel];
      if (this._relabel.clear(), this._rebuildWanted) {
        this._rebuildWanted = !1, this._rebuild();
        return;
      }
      const e = $(this).getLocale();
      for (const s of t) this._label(s, e);
    }));
  }
  /** Whether a bubble has a tick: every message with `every="message"`, else the user's. */
  _ticked(t) {
    return t.hasAttribute("message-id") ? this.getAttribute("every") === "message" || t.getAttribute("data-role") === "user" : !1;
  }
  /** Re-name one bubble's tick, written only when the name changed. */
  _label(t, e) {
    if (!this._host?.contains(t)) return;
    const s = t.getAttribute("message-id");
    if (!s) return;
    const r = this.querySelector(`.aparte-scroll-rail__tick[data-message-id="${yt(s)}"]`);
    if (!r) return;
    const i = this._tickLabel(t, e);
    r.getAttribute("aria-label") !== i && (r.setAttribute("aria-label", i), r.title = i);
  }
  _viewport() {
    return this._host?.querySelector("aparte-chat-viewport") ?? null;
  }
  /** The element that scrolls: the vanilla container, or the viewport itself under a wrapper. */
  _scrollSurface() {
    const t = this._viewport();
    return t ? t.querySelector(".aparte-viewport-container") ?? t : null;
  }
  /** Every message bubble of the transcript, in document order. */
  _messages() {
    const t = this._viewport();
    return t ? Array.from(t.querySelectorAll("aparte-chat-bubble[message-id]")) : [];
  }
  /** The bubbles that get a tick, from all of them. */
  _bubbles(t = this._messages()) {
    return (this.getAttribute("every") === "message" ? "message" : "user") === "message" ? t : t.filter((s) => s.getAttribute("data-role") === "user");
  }
  // ─── Rendering ────────────────────────────────────────────────────────
  /** The first words of a message, for the tick's name. An excerpt, never a summary. */
  _excerpt(t) {
    const e = this._excerpts.get(t);
    if (e !== void 0) return e;
    const s = t.querySelector(".aparte-message-content") ?? t;
    let r = "";
    const i = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
    for (let l = i.nextNode(); l && r.length < Rn * 16; l = i.nextNode()) r += l.nodeValue ?? "";
    const a = r.slice(0, Rn * 16).replace(/\s+/g, " ").trim(), o = a.length > Rn ? `${a.slice(0, Rn - 1).trimEnd()}…` : a;
    return this._excerpts.set(t, o), o;
  }
  _tickLabel(t, e) {
    const s = t.getAttribute("data-role") === "user" ? e.roleNameUser ?? "You" : e.roleNameAssistant ?? "Assistant", r = this._excerpt(t);
    return r ? `${s}: ${r}` : s;
  }
  _list() {
    return this.querySelector(":scope > .aparte-scroll-rail__list");
  }
  /**
   * Reconcile the ticks with the bubbles, by message id. A tick that already exists is
   * kept — the same node, so the focus on it, its hover and its tooltip survive a turn
   * being appended or a reply streaming beside it — moved only when its order changed,
   * and dropped when its bubble left.
   */
  _rebuild() {
    this._watchSizes();
    const t = this._messages(), e = this._bubbles(t), s = $(this).getLocale(), r = s.scrollRailLabel ?? "Conversation outline";
    if (this.getAttribute("aria-label") !== r && this.setAttribute("aria-label", r), e.length < 2) {
      this.setAttribute("data-empty", ""), this.replaceChildren(), this._unobserve(), this._currentId = null, this._write("--aparte-scroll-rail-hit-size", ""), this._write("--aparte-scroll-rail-gap", "");
      return;
    }
    this.removeAttribute("data-empty");
    let i = this._list();
    i || (i = document.createElement("ol"), i.className = "aparte-scroll-rail__list", this.replaceChildren(i));
    const a = /* @__PURE__ */ new Map();
    for (const d of Array.from(i.children)) {
      const h = d.firstElementChild instanceof HTMLElement ? d.firstElementChild.dataset.messageId : void 0;
      h && a.set(h, d);
    }
    const o = new Set(e.map((d) => d.getAttribute("message-id")));
    for (const [d, h] of a)
      o.has(d) || (h.remove(), a.delete(d));
    let l = i.firstElementChild;
    for (const d of e) {
      const h = d.getAttribute("message-id");
      let u = a.get(h);
      if (!u) {
        u = document.createElement("li");
        const _ = document.createElement("button");
        _.type = "button", _.className = "aparte-scroll-rail__tick", _.dataset.messageId = h, _.tabIndex = -1, u.appendChild(_);
      }
      const p = u.firstElementChild, f = this._tickLabel(d, s);
      p.getAttribute("aria-label") !== f && (p.setAttribute("aria-label", f), p.title = f), h === this._currentId ? p.getAttribute("aria-current") !== "true" && p.setAttribute("aria-current", "true") : p.removeAttribute("aria-current"), u === l ? l = l.nextElementSibling : i.insertBefore(u, l);
    }
    const c = this._currentId !== null && !o.has(this._currentId);
    c && (this._currentId = null), this._syncTabStop(), (!Vs(this._observedBubbles, e) || !Vs(this._bandTargets, t)) && this._observe(e, t), this._layout(), c && this._pickCurrent();
  }
  /**
   * Which tick is current is read, not computed: the scroll surface is the root and an
   * intersection observer reports which bubbles reach a reading band — the top 30% of
   * the surface, from its very top so that the bubble a jump aligned there counts. The
   * rule is a scrollspy's: the LAST question that has reached the band is the one the
   * reader is under. (The largest visible share would name the first of three questions
   * sitting in the band at the bottom of a thread of short turns.) The one scroll
   * position read is the bottom, because there the reader is under the latest question
   * whatever the band holds, and the observer has nothing to report on the last few
   * pixels.
   *
   * The replies are watched too, and a reply in the band is read under its question. With
   * the questions alone the band was empty whenever the reader was inside a long reply, and
   * nothing moved the mark when the layout did: a bubble never rendered has an estimated
   * height (`content-visibility`) and takes its real one once the scroll has stopped, so a
   * still reader's question changed with no scroll and no question crossing the band. The
   * observer reports a reply entering the band whatever moved it.
   */
  _observe(t, e) {
    const s = typeof IntersectionObserver > "u" ? null : this._scrollSurface();
    if (!s) {
      this._unobserve(), this._observedBubbles = t, this._bandTargets = e;
      return;
    }
    (!this._intersections || !this._onScreenObserver || this._observedSurface !== s) && (this._unobserve(), this._intersections = new IntersectionObserver((l) => {
      for (const c of l) this._visible.set(c.target, c.isIntersecting ? c.intersectionRatio : 0);
      this._pickCurrent();
    }, { root: s, rootMargin: `0px 0px -${100 - go}% 0px`, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }), this._onScreenObserver = new IntersectionObserver((l) => {
      for (const c of l)
        c.isIntersecting ? this._onScreen.add(c.target) : this._onScreen.delete(c.target);
      this._pickCurrent();
    }, { root: s, threshold: [0] }), this._observedSurface = s, s.addEventListener("scroll", this._onRootScroll, { passive: !0 }));
    const r = new Set(e);
    for (const l of this._bandTargets) r.has(l) || this._intersections.unobserve(l);
    const i = new Set(this._bandTargets);
    for (const l of e) i.has(l) || this._intersections.observe(l);
    const a = t[t.length - 1], o = this._observedBubbles[this._observedBubbles.length - 1];
    o !== a && (o && this._onScreenObserver.unobserve(o), this._onScreenObserver.observe(a)), this._observedBubbles = t, this._bandTargets = e;
  }
  _unobserve() {
    this._intersections?.disconnect(), this._intersections = null, this._onScreenObserver?.disconnect(), this._onScreenObserver = null, this._observedSurface?.removeEventListener("scroll", this._onRootScroll), this._observedSurface = null, this._observedBubbles = [], this._bandTargets = [], this._visible = /* @__PURE__ */ new WeakMap(), this._onScreen = /* @__PURE__ */ new WeakSet();
  }
  /** A scroll only matters at the bottom edge, where the observer is silent: one pick per frame. */
  _onRootScroll = () => {
    this._pickQueued || (this._pickQueued = !0, requestAnimationFrame(() => {
      this._pickQueued = !1, this._pickCurrent();
    }));
  };
  /** At the bottom edge of a surface that scrolls; a surface with nothing to scroll has no bottom to be at. */
  _atBottom() {
    const t = this._observedSurface;
    if (!t) return !1;
    const e = t.scrollHeight - t.clientHeight;
    return e > 0 && e - t.scrollTop <= 2;
  }
  _pickCurrent() {
    if (this._held) return;
    const t = this._observedBubbles;
    if (t.length === 0) return;
    const e = t[t.length - 1], s = e.getAttribute("message-id");
    if (this._atBottom() || this._onScreen.has(e)) {
      this._setCurrent(s);
      return;
    }
    let r = null, i = null, a = !1;
    for (const o of this._bandTargets)
      this._ticked(o) && (i = o.getAttribute("message-id")), (this._visible.get(o) ?? 0) > 0 && (a = !0, i !== null && (r = i));
    r === null && a || (r ??= this._lastAbove(), r !== null && this._setCurrent(r));
  }
  /**
   * The last question whose top is above the reading band's lower edge: by halves, since
   * the questions are in document order and their tops only grow. A question never
   * rendered has its estimated height (`content-visibility`), which keeps that order.
   * `null` when no question is above the edge or nothing is laid out, and the mark stays
   * as it was.
   */
  _lastAbove() {
    const t = this._observedSurface, e = this._observedBubbles;
    if (!t || e.length === 0) return null;
    const s = t.getBoundingClientRect();
    if (s.height <= 0) return null;
    const r = s.top + s.height * go / 100;
    let i = 0, a = e.length - 1, o = -1;
    for (; i <= a; ) {
      const l = i + a >> 1;
      e[l].getBoundingClientRect().top < r ? (o = l, i = l + 1) : a = l - 1;
    }
    return o < 0 ? null : e[o].getAttribute("message-id");
  }
  /** The tick a message is read under: its own, else the question above it, as the band reads a reply. */
  _markFor(t) {
    const e = t.getAttribute("message-id");
    if (this._ticked(t)) return e;
    let s = null;
    for (const r of this._messages()) {
      if (r === t) break;
      this._ticked(r) && (s = r.getAttribute("message-id"));
    }
    return s ?? e;
  }
  _setCurrent(t) {
    if (this._currentId !== t) {
      this._currentId = t;
      for (const e of this.querySelectorAll(".aparte-scroll-rail__tick"))
        e.dataset.messageId === t ? (e.setAttribute("aria-current", "true"), this._reveal(e)) : e.removeAttribute("aria-current");
      this._syncTabStop();
    }
  }
  /**
   * One Tab stop for the whole rail, as in a toolbar: the tick that has the focus, else
   * the current one, else the last. Every tick was a button in the tab order, so a
   * keyboard reader crossed 500 of them between the transcript and the composer of a
   * long conversation; the arrows, Home and End walk the rail instead.
   */
  _syncTabStop(t = !1) {
    const e = Array.from(this.querySelectorAll(".aparte-scroll-rail__tick"));
    if (e.length === 0) return;
    const s = t ? null : Et(this), r = (s instanceof HTMLElement && e.includes(s) ? s : void 0) ?? e.find((i) => i.dataset.messageId === this._currentId) ?? e[e.length - 1];
    this._setTabStop(r, e);
  }
  /**
   * The stop follows the focus onto a tick, however it got there: the arrows, a click (a
   * click on the current tick moved the focus but not the stop, which made two), a host's
   * `focus()`.
   */
  _onFocusIn = (t) => {
    const e = t.target instanceof HTMLElement && t.target.classList.contains("aparte-scroll-rail__tick") ? t.target : null;
    e && this.contains(e) && this._setTabStop(e, Array.from(this.querySelectorAll(".aparte-scroll-rail__tick")));
  };
  /** Leaving the rail, the stop goes back to the current tick: Tab back in lands where the reader is. */
  _onFocusOut = (t) => {
    t.relatedTarget instanceof Node && this.contains(t.relatedTarget) || this._syncTabStop(!0);
  };
  _setTabStop(t, e) {
    for (const s of e) {
      const r = s === t ? 0 : -1;
      s.tabIndex !== r && (s.tabIndex = r);
    }
  }
  /** Past the floor the rail scrolls itself: the current tick is kept inside its window. */
  _reveal(t) {
    const e = this.clientHeight;
    if (!e) return;
    const s = t.offsetTop, r = s + t.offsetHeight;
    s < this.scrollTop ? this.scrollTop = s : r > this.scrollTop + e && (this.scrollTop = r - e);
  }
  // ─── Geometry ─────────────────────────────────────────────────────────
  /**
   * Point the resize observer at the boxes the geometry is read from. Re-pointed on each
   * rebuild: a viewport a wrapper mounts after the rail, or replaces, was never watched, and
   * the panel or composer that resized it later left the rail measuring the old box. The
   * scroll surface is watched for itself: a classic scrollbar appearing narrows it without
   * resizing the viewport, and the rail has to move clear of the bar.
   */
  _watchSizes() {
    if (!this._resizes) return;
    const t = [];
    for (const e of [this._host, this._viewport(), this._scrollSurface()]) e && !t.includes(e) && t.push(e);
    if (!Vs(this._sized, t)) {
      for (const e of this._sized) t.includes(e) || this._resizes.unobserve(e);
      for (const e of t) this._sized.includes(e) || this._resizes.observe(e);
      this._sized = t;
    }
  }
  /** Write a custom property on this element only when its value changed; '' removes it. */
  _write(t, e) {
    this._written.get(t) !== e && (this._written.set(t, e), e ? this.style.setProperty(t, e) : this.style.removeProperty(t));
  }
  /**
   * The three measurements the stylesheet positions the rail by, and the pitch.
   *
   * The scrollbar: `offsetWidth − clientWidth` of the scroll surface is the width of a
   * classic bar and 0 for an overlay one, so the rail sits clear of the bar exactly
   * where there is one. The extent: the transcript's box within the host, so the rail
   * spans the messages and not the composer under them. The pitch: the stylesheet's
   * 24px targets whenever `count × 24` fits the rail; otherwise the pitch that does,
   * never under `MIN_PITCH` — the rail sets `--aparte-scroll-rail-hit-size` on itself
   * and the gap, the padding and the zone all follow it, as they do for a consumer's
   * value. Past the floor the rail scrolls (`_reveal`), and the arrows still walk it.
   */
  _layout() {
    const t = this._host, e = this._viewport(), s = this._scrollSurface();
    if (t && s && this._write("--aparte-scroll-rail-bar", `${Math.max(0, s.offsetWidth - s.clientWidth)}px`), t && e) {
      const u = e.getBoundingClientRect(), p = t.getBoundingClientRect();
      u.height > 0 && p.height > 0 && (this._write("--aparte-scroll-rail-block-start", `${Math.max(0, Math.round(u.top - p.top))}px`), this._write("--aparte-scroll-rail-block-end", `${Math.max(0, Math.round(p.bottom - u.bottom))}px`));
    }
    const r = t ?? document.documentElement, i = getComputedStyle(r), a = parseFloat(i.getPropertyValue("--aparte-scroll-rail-hit-size")) || 24, o = parseFloat(i.getPropertyValue("--aparte-scroll-rail-tick-thickness")) || 2;
    (this._written.get("--aparte-scroll-rail-hit-size") ?? "") !== "" && this.scrollHeight <= this.clientHeight + 1 && (this._write("--aparte-scroll-rail-hit-size", ""), this._write("--aparte-scroll-rail-gap", ""));
    const c = this.clientHeight, d = this._list()?.children.length ?? 0;
    if (!d || !c || d * a <= c) {
      this._write("--aparte-scroll-rail-hit-size", ""), this._write("--aparte-scroll-rail-gap", "");
      return;
    }
    const h = Math.max(Hg, Math.floor(c / d));
    this._write("--aparte-scroll-rail-hit-size", `${h}px`), this._write("--aparte-scroll-rail-gap", `${Math.max(0, h - o)}px`);
  }
  // ─── Interaction ──────────────────────────────────────────────────────
  _onClick = (t) => {
    const e = t.target.closest(".aparte-scroll-rail__tick");
    if (!e || !this.contains(e)) return;
    const s = e.dataset.messageId;
    s && this.jumpTo(s);
  };
  /** The ticks are buttons; the arrows walk them, as in any toolbar. */
  _onKeydown = (t) => {
    if (t.key !== "ArrowDown" && t.key !== "ArrowUp" && t.key !== "Home" && t.key !== "End") return;
    const e = Array.from(this.querySelectorAll(".aparte-scroll-rail__tick")), s = e.indexOf(Et(this));
    if (s === -1) return;
    t.preventDefault();
    const r = t.key === "Home" ? 0 : t.key === "End" ? e.length - 1 : t.key === "ArrowDown" ? Math.min(e.length - 1, s + 1) : Math.max(0, s - 1), i = e[r];
    i && (this._setTabStop(i, e), i.focus());
  };
  /**
   * Scroll the transcript to a message. Announced first, cancelable; then a
   * `scrollIntoView` on the bubble, smooth unless the reader prefers reduced motion.
   * The clicked tick is the mark until the transcript has stopped moving: while a
   * smooth scroll crosses other questions the band would name each in turn.
   *
   * Where the scroll lands is checked once it has settled, and corrected. The bubbles
   * carry `content-visibility: auto`, so a bubble far from the reader has an estimated
   * height until it is rendered: the scroll aims at an estimate, the bubbles above it
   * take their real size on the way, and the message ends up above or below the top,
   * the further away the worse.
   * A second `scrollIntoView` from a rendered neighbourhood lands; a few are allowed.
   */
  jumpTo(t) {
    if (!this.dispatchEvent(new CustomEvent("aparte-scroll-rail-jump", {
      detail: { messageId: t },
      bubbles: !0,
      composed: !0,
      cancelable: !0
    }))) return;
    const s = this._bubbleOf(t);
    s && (this._viewport()?.setAutoScroll?.(!1), this._scrollTo(s), this._setCurrent(this._markFor(s)), this._hold(t));
  }
  _bubbleOf(t) {
    return this._viewport()?.querySelector(`aparte-chat-bubble[message-id="${yt(t)}"]`) ?? null;
  }
  _scrollTo(t) {
    const e = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollIntoView({ block: "start", behavior: e ? "auto" : "smooth" });
  }
  /** Keep `id` as the mark until the scroll surface has been still for `SETTLE_MS`. */
  _hold(t) {
    this._release(), this._held = t, this._alignPasses = 0, this._settleSurface = this._scrollSurface(), this._settleSurface?.addEventListener("scroll", this._onSurfaceScroll), this._bumpSettle();
  }
  _bumpSettle() {
    this._settleTimer !== null && clearTimeout(this._settleTimer), this._settleTimer = setTimeout(() => this._settle(), Bg);
  }
  /** The transcript is still: land on the message if the scroll did not, else release the hold. */
  _settle() {
    const t = this._held, e = this._settleSurface, s = t ? this._bubbleOf(t) : null;
    if (t && s && e && this._alignPasses < qg) {
      const r = e.getBoundingClientRect().top + (parseFloat(getComputedStyle(e).scrollPaddingTop) || 0), i = s.getBoundingClientRect().top - r;
      if (Math.abs(i) > Fg) {
        this._alignPasses++, this._scrollTo(s), this._bumpSettle();
        return;
      }
    }
    this._release(), t && this._setCurrent(s ? this._markFor(s) : t);
  }
  _release() {
    this._settleTimer !== null && clearTimeout(this._settleTimer), this._settleTimer = null, this._settleSurface?.removeEventListener("scroll", this._onSurfaceScroll), this._settleSurface = null, this._held = null;
  }
}
function Uc(n) {
  return n instanceof Element && n.localName === "aparte-chat-bubble";
}
function _o(n) {
  return Array.from(n).some((t) => t instanceof Element && (Uc(t) || t.localName === "aparte-chat-viewport" || t.querySelector("aparte-chat-bubble") !== null));
}
function Vs(n, t) {
  if (n.length !== t.length) return !1;
  for (let e = 0; e < n.length; e++) if (n[e] !== t[e]) return !1;
  return !0;
}
rt(Fc);
customElements.get("aparte-scroll-rail") || customElements.define("aparte-scroll-rail", Fc);
const Ug = "(max-width: 48rem)";
class Wc extends HTMLElement {
  static get observedAttributes() {
    return ["collapsed", "breakpoint"];
  }
  _media = null;
  _scrim = null;
  /** The control that last opened the drawer, to hand the focus back to. */
  _opener = null;
  _lastCollapsed = null;
  /**
   * `connectedCallback` has run and the element knows what its markup asked for.
   *
   * Not `isConnected`: during an UPGRADE the element is already in the document, so
   * `attributeChangedCallback` fires for every authored attribute — connected, and
   * before `connectedCallback` — which is the ordinary case for a server-rendered
   * `<aparte-sidebar collapsed>` upgraded when the module loads. Announcing there
   * tells the host its sidebar just closed when all that happened is that the markup
   * was read, and says `drawer: false` because the media query has not run yet.
   */
  _ready = !1;
  /**
   * The host (or the markup) asked for the column to be folded, so widening the
   * window must not unfold it. Only a collapse taken OUTSIDE the drawer state counts:
   * dismissing an overlay says nothing about what a wide window should show.
   */
  _closedByHost = !1;
  /**
   * `_closedByHost` has been taken from the markup once. A re-parent runs
   * `connectedCallback` again, and by then `collapsed` may be the BREAKPOINT's own
   * write — a drawer closes itself on the way in — so reading it back a second time
   * records the element's own doing as the host's word and the column never reopens.
   * Like `_initialCaptured` on `<aparte-split>`, it must survive the move.
   */
  _hostIntentSeeded = !1;
  /** Raised around `_applyDrawer`'s own writes, so the breakpoint is never read as a host's intent. */
  _auto = !1;
  /** The floating chat this sidebar is in, if any: its size decides the drawer, not the window's. */
  _launcher = null;
  _launcherWatch = null;
  /**
   * The element wrote `inert`/`aria-hidden` and may take them back. A host that inerts
   * the sidebar behind its own modal wrote them itself, and `_syncHidden` runs on every
   * breakpoint re-evaluation: without this it would un-inert the page behind the overlay.
   * Same convention as `_relabel`, which leaves a host-authored `aria-label` alone.
   */
  _ownHidden = !1;
  /** The query `filter()` was last given, kept so the sidebar's no-match can follow its lists. */
  _query = "";
  /** Watches the lists' own `data-no-match` and `loading`, which change with their renders. */
  _listWatch = null;
  /** Whether the sidebar is collapsed (hidden in the flow, or closed as a drawer). */
  get collapsed() {
    return this.hasAttribute("collapsed");
  }
  set collapsed(t) {
    this.toggleAttribute("collapsed", mt(t));
  }
  /** True while the sidebar is a drawer: the window is under the breakpoint, or it is in a floating chat's card. */
  get drawer() {
    return this.hasAttribute("data-drawer");
  }
  connectedCallback() {
    this.classList.contains("aparte-sidebar") || this.classList.add("aparte-sidebar"), this.getAttribute("role") || this.setAttribute("role", "complementary"), this._relabel(), this._hostIntentSeeded || (this._closedByHost = this.collapsed, this._hostIntentSeeded = !0), this.addEventListener("input", this._onInput), typeof MutationObserver == "function" && (this._listWatch = new MutationObserver((t) => {
      t.some((e) => e.target !== this) && this._syncNoMatch();
    }), this._listWatch.observe(this, { subtree: !0, attributes: !0, attributeFilter: ["data-no-match", "loading"] })), document.addEventListener("keydown", this._onKeydown), document.addEventListener("click", this._onDocumentClick), window.addEventListener("aparte-config-change", this._onConfigChange), this._launcher = this.closest("aparte-launcher"), this._launcher && typeof MutationObserver == "function" && (this._launcherWatch = new MutationObserver(() => this._followLauncher()), this._launcherWatch.observe(this._launcher, { attributes: !0, attributeFilter: ["open", "maximized", "maximizable"] })), this._watchBreakpoint(), this._syncHidden(), this._lastCollapsed = this.collapsed, this.id || (this.id = `aparte-sidebar-${++Wg}`), this._syncToggles(), this._ready = !0;
  }
  /**
   * The drawer's media query, from the `breakpoint` attribute: a length (`48rem`, the
   * default, or `640px`), or `none` for a column that never becomes a drawer — which
   * a narrow host that has room for it wants, and a documentation frame needs.
   */
  _watchBreakpoint() {
    this._media?.removeEventListener("change", this._onMediaChange), this._media = null;
    const t = (this.getAttribute("breakpoint") ?? "").trim();
    if (t !== "none" && typeof matchMedia == "function") {
      const e = t ? `(max-width: ${t})` : Ug;
      this._media = matchMedia(e), this._media.addEventListener("change", this._onMediaChange);
    } else if (t !== "none" && !this._launcher)
      return;
    this._applyDrawer(this._wantsDrawer());
  }
  /**
   * A drawer under the window's breakpoint, and in the card of a floating chat whatever
   * the window: the card is narrow in the widest one. `breakpoint="none"` is the host's
   * word for a column at any width, and it holds in a card too.
   */
  _wantsDrawer() {
    return (this.getAttribute("breakpoint") ?? "").trim() === "none" ? !1 : (this._media?.matches ?? !1) || this._inCard();
  }
  /**
   * In a floating chat that does not fill the window: its card, or the panel
   * `maximizable="panel"` runs along the window's edge, which is as narrow. Only as the
   * child of the card's shell, which is what holds the drawer there: anywhere else in a
   * card a drawer is fixed to the window, and one forced on a wide window would open over
   * the page the chat floats on.
   */
  _inCard() {
    const t = this._launcher;
    return !t || !this._cardShell() ? !1 : !(t.hasAttribute("maximized") && t.getAttribute("maximizable") !== "panel");
  }
  /**
   * The floating chat opened, closed or changed size. Its size decides the drawer, and a
   * drawer does not outlive the chat it is in: left open under a closed chat it would still
   * answer Escape for the whole page, and stand over the chat when it opens again.
   */
  _followLauncher() {
    this._applyDrawer(this._wantsDrawer()), this.drawer && !this.collapsed && !this._launcher?.hasAttribute("open") && (this._opener = null, this.close());
  }
  /**
   * The shell the scrim covers in a floating chat, when the sidebar is that shell's own
   * child: the stylesheet positions the drawer against it there (`sidebar.css`).
   */
  _cardShell() {
    const t = this._launcher ? this.parentElement : null;
    return t?.classList.contains("aparte-app-shell") ? t : null;
  }
  disconnectedCallback() {
    this.removeEventListener("input", this._onInput), this._listWatch?.disconnect(), this._listWatch = null, document.removeEventListener("keydown", this._onKeydown), document.removeEventListener("click", this._onDocumentClick), window.removeEventListener("aparte-config-change", this._onConfigChange), this._media?.removeEventListener("change", this._onMediaChange), this._media = null, this._launcherWatch?.disconnect(), this._launcherWatch = null, this._launcher = null, this._scrim?.remove(), this._scrim = null, this._ready = !1;
  }
  attributeChangedCallback(t) {
    if (!this._ready) return;
    if (t === "breakpoint") {
      this._watchBreakpoint();
      return;
    }
    if (t !== "collapsed") return;
    const e = this.collapsed;
    e !== this._lastCollapsed && (this._lastCollapsed = e, !this._auto && !this.drawer && (this._closedByHost = e), this._syncScrim(), this._syncHidden(), this._syncToggles(), e && this.drawer && this._opener?.isConnected ? (this._opener.focus(), this._opener = null) : !e && this.drawer && this._focusFirst(), this.dispatchEvent(new CustomEvent("aparte-sidebar-toggle", {
      detail: { collapsed: e, drawer: this.drawer },
      bubbles: !0,
      composed: !0
    })));
  }
  // ─── Public API ───────────────────────────────────────────────────────
  /** Open the sidebar. `opener` is the control to hand the focus back to when it closes. */
  open(t) {
    t && (this._opener = t), this.collapsed = !1;
  }
  close() {
    this.collapsed = !0;
  }
  toggle(t) {
    this.collapsed ? this.open(t) : this.close();
  }
  // ─── Drawer ───────────────────────────────────────────────────────────
  _onMediaChange = () => this._applyDrawer(this._wantsDrawer());
  /**
   * Entering the drawer state closes the sidebar: a narrow window that opens on an
   * overlay covering the chat is the wrong first screen. Leaving it reopens, since
   * a wide window has room for the column — unless the host had collapsed it before.
   */
  _applyDrawer(t) {
    const e = this.drawer;
    t !== e && (this._opener = null), this.toggleAttribute("data-drawer", t), this._auto = !0;
    try {
      t && !e ? this.collapsed = !0 : !t && e && !this._closedByHost && (this.collapsed = !1);
    } finally {
      this._auto = !1;
    }
    this._syncScrim(), this._syncHidden(), this._syncToggles();
  }
  /**
   * Every `[data-aparte-sidebar-toggle]` that drives THIS sidebar says what it does:
   * `aria-expanded` follows the state, `aria-controls` names the element. Synced from
   * the three places the state settles (connect, the attribute, the breakpoint), never
   * from `open()` alone — a close on Escape would otherwise leave an "expanded" that
   * lies. The row's own `⋯` button already did this; the sidebar's toggle did not.
   */
  _syncToggles() {
    const t = "[data-aparte-sidebar-toggle]", e = xe(this), s = e === document ? Array.from(document.querySelectorAll(t)) : [...e.querySelectorAll(t), ...document.querySelectorAll(t)];
    for (const r of s)
      Pt(r) || !this._drives(r) || (r.setAttribute("aria-expanded", String(!this.collapsed)), r.setAttribute("aria-controls", this.id));
  }
  /** Whether a toggle control targets this sidebar: named by id, else the nearest one. */
  _drives(t) {
    const e = t.getAttribute("data-aparte-sidebar-toggle");
    return e ? e === this.id : Gg(t) === this;
  }
  /**
   * A collapsed sidebar is invisible — folded to nothing in the flow, slid off the
   * screen as a drawer — so it must not keep its tab stops or its place in the
   * accessibility tree. `inert` covers focus and the pointer, `aria-hidden` covers
   * the readers that predate it; a browser without `inert` still gets the second.
   *
   * It removes only what it wrote. Both are standard global attributes a host sets
   * itself — inerting the sidebar behind its own modal is the ordinary pattern — and
   * this runs on every breakpoint re-evaluation, so clearing them unconditionally lets
   * an unrelated resize re-expose the page under an overlay. Same convention as
   * `_relabel`, which leaves a host-authored `aria-label` alone.
   *
   * Neither is declared `@attr`, and `data-drawer` is not the precedent: a `@attr` on a
   * STANDARD name displaces the wrappers' own prop for it — React's JSX props are
   * `Omit<HTMLAttributes, keyof T>`, so declaring `inert` here would retype
   * `<aparte-sidebar inert={busy}>` out of existence. The class docblock says it in prose.
   */
  _syncHidden() {
    this.collapsed ? (this.toggleAttribute("inert", !0), this.setAttribute("aria-hidden", "true"), this._ownHidden = !0) : this._ownHidden && (this.removeAttribute("inert"), this.removeAttribute("aria-hidden"), this._ownHidden = !1);
  }
  /**
   * The drawer covers the page, so the focus has to follow it in — otherwise the next
   * Tab walks the transcript under the overlay. The host owns the children, so this
   * takes the first thing that can hold focus and leaves the rest alone; a drawer with
   * nothing focusable in it keeps the focus where it was, which is the honest outcome.
   */
  _focusFirst() {
    mo(this)[0]?.focus();
  }
  _syncScrim() {
    const t = this.drawer && !this.collapsed;
    if (t && !this._scrim) {
      this._scrim = document.createElement("div"), this._scrim.className = "aparte-sidebar__scrim", this._scrim.setAttribute("aria-hidden", "true"), this._scrim.addEventListener("click", () => this.close());
      const e = this._cardShell();
      e ? (this._scrim.classList.add("aparte-sidebar__scrim--contained"), e.appendChild(this._scrim)) : this.appendChild(this._scrim);
    } else !t && this._scrim && (this._scrim.remove(), this._scrim = null);
  }
  _onKeydown = (t) => {
    if (!(!this.drawer || this.collapsed)) {
      if (t.key === "Escape") {
        if (t.defaultPrevented) return;
        t.preventDefault(), this.close();
        return;
      }
      if (t.key === "Tab") {
        const e = mo(this);
        if (e.length === 0) return;
        const s = e[0], r = e[e.length - 1], i = Et(this);
        this.contains(i) ? t.shiftKey && i === s ? (t.preventDefault(), r.focus()) : !t.shiftKey && i === r && (t.preventDefault(), s.focus()) : (t.preventDefault(), s.focus());
      }
    }
  };
  /** A `[data-aparte-sidebar-toggle]` anywhere toggles this sidebar — no script in the host. */
  _onDocumentClick = (t) => {
    const e = Dt(t)?.closest?.("[data-aparte-sidebar-toggle]");
    !e || Pt(e) || this._drives(e) && this.toggle(e);
  };
  // ─── Search ───────────────────────────────────────────────────────────
  _onInput = (t) => {
    const e = t.target;
    e?.matches?.("[data-aparte-sidebar-search]") && this.filter(e.value);
  };
  /**
   * Filter the conversation lists inside by title (case- and accent-insensitive; an
   * empty query shows everything), and return how many conversations match. Each list
   * keeps the query through its own renders and says when nothing matches; the
   * sidebar carries `data-no-match` then too.
   */
  filter(t) {
    this._query = t;
    let e = 0, s = !1;
    for (const r of this._lists())
      typeof r.filter == "function" ? e += r.filter(t) : (e += Rr(r, Jn(t)), s = !0);
    return s && typeof customElements < "u" && customElements.whenDefined("aparte-conversation-list").then(() => {
      if (this._query === t) for (const r of this._lists()) r.filter?.(t);
      this._syncNoMatch();
    }), this._syncNoMatch(), e;
  }
  _lists() {
    return Array.from(this.querySelectorAll("aparte-conversation-list"));
  }
  /**
   * `data-no-match` while the held query matches nothing in any list — read from the lists
   * themselves, so it follows their renders (a conversation that matches arriving, the last
   * match leaving) and is never set while one of them is still loading.
   */
  _syncNoMatch() {
    const t = Jn(this._query), e = t !== "" && this._lists().every((s) => typeof s.filter == "function" ? s.hasAttribute("data-no-match") : !s.hasAttribute("loading") && Rr(s, t) === 0);
    this.toggleAttribute("data-no-match", e);
  }
  // ─── Locale ───────────────────────────────────────────────────────────
  _onConfigChange = () => this._relabel();
  _relabel() {
    if (this.hasAttribute("aria-label") && this.dataset.ownLabel !== "locale") return;
    const t = $(this).getLocale();
    this.setAttribute("aria-label", t.sidebarLabel ?? "Conversations"), this.dataset.ownLabel = "locale";
  }
}
let Wg = 0;
const zg = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");
function mo(n) {
  return Array.from(n.querySelectorAll(zg)).filter((t) => !t.closest("[hidden]") && t.checkVisibility?.() !== !1);
}
function Gg(n) {
  return n.closest("aparte-sidebar") ?? n.closest(".aparte-app-shell")?.querySelector("aparte-sidebar") ?? xe(n).querySelector("aparte-sidebar") ?? document.querySelector("aparte-sidebar");
}
rt(Wc);
customElements.get("aparte-sidebar") || customElements.define("aparte-sidebar", Wc);
function bo(n, t, e) {
  return Number.isFinite(n) ? n < t ? t : n > e ? e : n : t;
}
function jg(n) {
  const t = Number.isFinite(n.startPercent) ? n.startPercent : 0;
  if (!Number.isFinite(n.containerPx) || n.containerPx <= 0) return bo(t, 0, 100);
  const r = ((!n.vertical && n.rtl) !== (n.primaryEnd === !0) ? -1 : 1) * n.deltaPx * 100 / n.containerPx;
  return bo(t + r, 0, 100);
}
function vo(n, t, e, s, r = !1) {
  if (n === "Home") return -100;
  if (n === "End") return 100;
  const i = (t ? 10 : 1) * (r ? -1 : 1);
  return s ? n === "ArrowUp" ? -i : n === "ArrowDown" ? i : null : n === "ArrowLeft" ? e ? i : -i : n === "ArrowRight" ? e ? -i : i : null;
}
const Kg = "(max-width: 48rem)", ze = 38, Vg = 300;
function Ge(n, t) {
  const e = Number.parseFloat(n ?? "");
  return Number.isFinite(e) ? e < 0 ? 0 : e > 100 ? 100 : e : t;
}
class ps extends HTMLElement {
  static get observedAttributes() {
    return ["position", "orientation", "primary", "collapsed", "breakpoint", "pane", "disabled", "label", "single"];
  }
  _handle = null;
  _scrim = null;
  _media = null;
  _observer = null;
  /** The pending `_measureBounds()` from a resize, batched to one per frame. */
  _measureRafId = null;
  /** The host size the last resize tick measured, so an unchanged one does nothing. */
  _observedPx = 0;
  /** Ids for the panes `aria-controls` names — a counter, the way the primitives do it. */
  static _paneIdSeq = 0;
  /** The live position. The attribute holds it only after a commit. */
  _position = ze;
  /** What `reset()` — and a double-click on the seam — goes back to. */
  _initialPosition = ze;
  /**
   * `_initialPosition` has been taken from the markup once. A re-parent runs
   * `connectedCallback` again, and by then the attribute holds the LAST COMMIT, not
   * what the author wrote: capturing a second time makes a framework re-render, a tab
   * switch or a drag-and-drop of the panel redefine what "reset" means.
   */
  _initialCaptured = !1;
  /** The size the primary pane had before it was collapsed, for the second Enter. */
  _preCollapsePosition = null;
  /** Committed values, so a reflection of our own does not read as a host's change. */
  _lastPosition = null;
  _lastCollapsed = null;
  _lastPane = null;
  /** What an attribute-driven commit blames. Raised around a key that changes state. */
  _source = "api";
  /**
   * `connectedCallback` has run and the element knows what its markup asked for.
   *
   * Not `isConnected`: during an UPGRADE the element is already in the document, so
   * `attributeChangedCallback` fires for every authored attribute — connected, and
   * before `connectedCallback` — which is the ordinary case for a server-rendered
   * `<aparte-split position="38">` upgraded when the module loads. Committing there
   * measures a layout the element has not set up yet (no `data-stacked`, so on a
   * phone the probe reads the stacked pane and writes `position="84"`), reflects that
   * over the authored number, and sends it to whatever the host persists.
   */
  _ready = !1;
  _dragging = !1;
  _captured = !1;
  /** The gesture actually moved the seam. A press that did not commits nothing. */
  _moved = !1;
  _pointerId = null;
  _dragStartPercent = ze;
  _dragOriginPx = 0;
  _dragContainerPx = 0;
  /** A key is down and has moved the seam; its keyup is the commit. */
  _keying = !1;
  // ─── Properties ───────────────────────────────────────────────────────
  /** The primary pane's size, as a percentage of the container. Setting it commits. */
  get position() {
    return this._position;
  }
  set position(t) {
    const e = Ge(String(t), this._position);
    this.isConnected && e === this._lastPosition || (this._position = e, this._setLive(e), this.isConnected && this._commit("api"));
  }
  /** The container's axis: `horizontal` (side by side) or `vertical` (stacked). */
  get orientation() {
    return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal";
  }
  set orientation(t) {
    this.setAttribute("orientation", t);
  }
  /** Which pane `position` sizes. */
  get primary() {
    return this.getAttribute("primary") === "end" ? "end" : "start";
  }
  set primary(t) {
    this.setAttribute("primary", t);
  }
  /** The primary pane is folded to its minimum. */
  get collapsed() {
    return this.hasAttribute("collapsed");
  }
  set collapsed(t) {
    this.toggleAttribute("collapsed", mt(t));
  }
  /** Which pane is shown while the split is stacked. */
  get pane() {
    return this.getAttribute("pane") === "end" ? "end" : "start";
  }
  set pane(t) {
    this.setAttribute("pane", t);
  }
  /** No drag, no keys, no tab stop. The seam stays drawn. */
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(t) {
    this.toggleAttribute("disabled", mt(t));
  }
  /**
   * True while the split is showing one pane. Read-only.
   *
   * Both routes into that state count. `data-stacked` is the one this element writes
   * from its own breakpoint; `.aparte-split--only-start` / `--only-end` are the CSS
   * route a host takes when it owns its breakpoints and sets `breakpoint="none"`. The
   * sheet gives the two byte-identical rules, so the element has to read them the same
   * way — every guard downstream keys on this getter, and a split stacked by the class
   * alone would measure a one-track grid and commit `position="100"`.
   */
  get stacked() {
    return this.hasAttribute("data-stacked") || this.hasAttribute("single") || this.classList.contains("aparte-split--only-start") || this.classList.contains("aparte-split--only-end");
  }
  /** One pane on demand, whatever the width. Reflected. */
  get single() {
    return this.hasAttribute("single");
  }
  set single(t) {
    this.toggleAttribute("single", mt(t));
  }
  // ─── Public API ───────────────────────────────────────────────────────
  /** Fold the primary pane to its minimum, remembering the size it had. */
  collapse() {
    this.collapsed = !0;
  }
  /** Unfold it, back to the size it had before it collapsed. */
  expand() {
    this.collapsed = !1;
  }
  toggleCollapse() {
    this.collapsed = !this.collapsed;
  }
  /** Show one pane, which only has a visible effect while the split is stacked. */
  showPane(t) {
    this.pane = t;
  }
  /**
   * Back to the position the split was FIRST connected with — a re-parent restores
   * that, it does not redefine it. What a double-click on the seam does.
   */
  reset() {
    this._position = this._initialPosition, this._setLive(this._position), this.isConnected && this._commit("api");
  }
  // ─── Lifecycle ────────────────────────────────────────────────────────
  connectedCallback() {
    this.classList.contains("aparte-split") || this.classList.add("aparte-split"), this._handle = this._ensureHandle();
    const t = this.getAttribute("position");
    t !== null ? (this._position = Ge(t, ze), this._setLive(this._position)) : this._position = Ge(
      getComputedStyle(this).getPropertyValue("--aparte-split-position"),
      ze
    ), this._initialCaptured || (this._initialPosition = this._position, this._initialCaptured = !0), this.collapsed && (this._lastCollapsed !== !0 && (this._preCollapsePosition = this._position), this._position = 0, this._setLive(0)), this._lastPosition = this._position, this._lastCollapsed = this.collapsed, this._lastPane = this.pane, this._stampHandle(), this._relabel(), this._measureBounds(), this._handle.addEventListener("pointerdown", this._onPointerDown), this._handle.addEventListener("dblclick", this._onDoubleClick), this._handle.addEventListener("focusout", this._onFocusOut), this.addEventListener("keydown", this._onKeydown), this.addEventListener("keyup", this._onKeyup), document.addEventListener("click", this._onDocumentClick), window.addEventListener("aparte-config-change", this._onConfigChange), this._watchBreakpoint(), this._watchSize(), this._ready = !0, this._syncPaneControls();
  }
  disconnectedCallback() {
    this._handle?.removeEventListener("pointerdown", this._onPointerDown), this._handle?.removeEventListener("dblclick", this._onDoubleClick), this._handle?.removeEventListener("focusout", this._onFocusOut), this.removeEventListener("keydown", this._onKeydown), this.removeEventListener("keyup", this._onKeyup), document.removeEventListener("click", this._onDocumentClick), window.removeEventListener("aparte-config-change", this._onConfigChange), this._releasePointer(), this._media?.removeEventListener("change", this._onMediaChange), this._media = null, this._observer?.disconnect(), this._observer = null, this._measureRafId !== null && (cancelAnimationFrame(this._measureRafId), this._measureRafId = null), this._removeScrim(), this._endMove?.(), this._handle?.removeAttribute("data-dragging"), this._dragging = !1, this._keying = !1, this._ready = !1;
  }
  attributeChangedCallback(t) {
    if (this._ready)
      switch (t) {
        case "position": {
          const e = Ge(this.getAttribute("position"), this._position);
          if (e === this._lastPosition) return;
          this._position = e, this._setLive(e), this._commit();
          return;
        }
        case "collapsed": {
          const e = this.collapsed;
          if (e === this._lastCollapsed) return;
          this._lastCollapsed = e, e ? (this._preCollapsePosition = this._position, this._position = 0) : this._position = this._preCollapsePosition ?? this._initialPosition, this._setLive(this._position), this._commit();
          return;
        }
        case "pane": {
          const e = this.pane;
          if (this._syncPaneControls(), e === this._lastPane) return;
          this._lastPane = e, this._commit();
          return;
        }
        case "orientation":
        case "primary":
          this._stampHandle(), this._measureBounds();
          return;
        case "disabled":
          this.disabled && this._dragging && this._endDrag("pointer", this._dragStartPercent), this._stampHandle();
          return;
        case "single":
          this.single && this._dragging && this._endDrag("pointer", this._dragStartPercent), this._stampHandle(), this._syncPaneControls(), this._moveBetweenOneAndTwo();
          return;
        case "breakpoint":
          this._watchBreakpoint();
          return;
        case "label":
          this._relabel();
      }
  }
  // ─── One pane ↔ two, in motion ────────────────────────────────────────
  /**
   * No layout worth reading: one pane is shown, or the tracks are in motion between one
   * and two. Whatever measures the panes or moves the seam asks this, not `stacked`
   * alone: a `pane` named while the split moves commits a position, and read from tracks
   * that are halfway it wrote the full width into `position`, so the split came back at
   * its maximum instead of the size it had.
   */
  get _unmeasurable() {
    return this.stacked || this.hasAttribute("data-moving");
  }
  /** Ends the move in flight: the inline tracks and the marker go, the sheet's state stays. */
  _endMove = null;
  /**
   * `single` just changed: move between one pane and two instead of jumping.
   *
   * The sheet's one-pane state takes the other pane out with `display: none`, which
   * cannot be animated. So for the length of the move the element keeps its three tracks
   * (`data-moving` holds the one-pane rules off) and drives them itself, in pixels it
   * measured: from what is on screen to what the sheet will show. When the move ends the
   * inline tracks and the marker are removed and the sheet's state is all that is left,
   * exactly as if nothing had been animated.
   *
   * It does nothing, and the change is immediate as before, when the reader asked for
   * less motion, when the split is stacked by its breakpoint (one pane either way), and
   * where there is no layout to measure.
   */
  _moveBetweenOneAndTwo() {
    if (this._endMove?.(), !this.isConnected || this.hasAttribute("data-stacked") || this.classList.contains("aparte-split--only-start") || this.classList.contains("aparte-split--only-end") || typeof matchMedia != "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = this.orientation === "vertical", e = t ? "gridTemplateRows" : "gridTemplateColumns", s = t ? this.clientHeight : this.clientWidth;
    if (s <= 0) return;
    this.setAttribute("data-moving", "");
    const r = getComputedStyle(this)[e];
    if (r.trim().split(/\s+/).length !== 3) {
      this.removeAttribute("data-moving");
      return;
    }
    const i = this.pane === "end" ? "end" : "start", a = i === "end" ? `0px 0px ${s}px` : `${s}px 0px 0px`, o = this.single, l = r.trim().split(/\s+/), c = this.children[i === "end" ? 0 : 2], d = t ? "blockSize" : "inlineSize", h = t ? "alignSelf" : "justifySelf", u = c ? { size: c.style[d], align: c.style[h] } : null;
    c && (c.style[d] = l[i === "end" ? 0 : 2], c.style[h] = i === "end" ? "end" : "start"), this.style[e] = o ? r : a, this.offsetWidth, this.setAttribute("data-moving", "run"), this.style[e] = o ? a : r;
    let p = null;
    const f = (v) => {
      v.target === this && v.propertyName.startsWith("grid-template") && _();
    }, _ = () => {
      p !== null && clearTimeout(p), this.removeEventListener("transitionend", f), this.style.removeProperty(t ? "grid-template-rows" : "grid-template-columns"), c && u && (c.style[d] = u.size, c.style[h] = u.align), this.removeAttribute("data-moving"), this._endMove = null, this._measureBounds();
    };
    this._endMove = _, this.addEventListener("transitionend", f);
    const g = Number.parseFloat(getComputedStyle(this).transitionDuration) || 0;
    p = setTimeout(_, g * 1e3 + 120);
  }
  // ─── Structure ────────────────────────────────────────────────────────
  /**
   * The seam. An author-written `.aparte-split__handle` is ADOPTED — a second one
   * would be a second tab stop drawn over the first — otherwise one is inserted
   * between the first two children, which is where a two-pane grid needs it.
   *
   * An adopted one is MOVED there if the author put it elsewhere. The sheet is
   * positional — three tracks with the seam in the middle, and the stacked rules hide
   * `:nth-child(1)` / `:nth-child(3)` — so a handle written first would take the
   * primary pane's track and make stacking hide the wrong child.
   */
  _ensureHandle() {
    const t = Array.from(this.children).find(
      (r) => r instanceof HTMLElement && r.classList.contains("aparte-split__handle")
    );
    if (t) {
      if (this.children[1] !== t) {
        const r = Array.from(this.children).filter((i) => i !== t)[1] ?? null;
        this.insertBefore(t, r);
      }
      return t;
    }
    const e = document.createElement("div");
    e.className = "aparte-split__handle";
    const s = this.children[1] ?? null;
    return s ? this.insertBefore(e, s) : this.appendChild(e), e;
  }
  /** The panes: every element child that is not the seam. */
  _panes() {
    return Array.from(this.children).filter(
      (t) => t instanceof HTMLElement && !t.classList.contains("aparte-split__handle")
    );
  }
  _primaryPane() {
    const t = this._panes();
    return (this.primary === "end" ? t[t.length - 1] : t[0]) ?? null;
  }
  /**
   * The APG's window splitter, plus the two states that take it out of the tab order.
   *
   * `aria-orientation` is the INVERSE of `orientation`: the attribute names the
   * separator's own axis, so a split whose panes sit side by side has a VERTICAL
   * separator between them.
   */
  _stampHandle() {
    const t = this._handle;
    if (!t) return;
    t.setAttribute("role", "separator"), t.setAttribute("aria-orientation", this.orientation === "vertical" ? "horizontal" : "vertical"), this.disabled || this.stacked ? t.removeAttribute("tabindex") : t.setAttribute("tabindex", "0"), t.setAttribute("aria-valuenow", String(Math.round(this._achievedPercent())));
    const e = this._primaryPane();
    e && (e.id || (e.id = `aparte-split-pane-${++ps._paneIdSeq}`), t.setAttribute("aria-controls", e.id));
  }
  // ─── Measurement ──────────────────────────────────────────────────────
  _measure(t) {
    const e = t.getBoundingClientRect();
    return this.orientation === "vertical" ? e.height : e.width;
  }
  /**
   * What the pane ACTUALLY got, which is not what was asked for: the CSS clamp between
   * `--aparte-split-min` and `--aparte-split-max` has the last word, and announcing the
   * requested value instead is how a splitter comes to tell a screen reader 5% while
   * the pane sits at 22%. Without layout (jsdom, `display: none`, before first paint)
   * the request is all there is, so it stands.
   *
   * While STACKED there is nothing to read: one pane is `display: none` and the other
   * spans the single track, so the ratio is 0 or 100 whatever the seam was set to.
   * Measuring it there would write `position="0"` into the attribute, the event and the
   * host's storage when "Preview" is tapped on a phone.
   */
  _achievedPercent() {
    if (this._unmeasurable) return this._position;
    const t = this._measure(this), e = this._primaryPane();
    return !e || !(t > 0) ? this._position : Math.max(0, Math.min(100, this._measure(e) / t * 100));
  }
  /**
   * The range the seam can actually reach, written onto the separator: park the pane
   * at 0% and read it, park it at 100% and read it, put the position back. Two forced
   * layouts in one synchronous task, so nothing paints in between.
   *
   * It also reconciles `aria-valuenow`, because the two have to be one story: the
   * requested percentage can sit outside the clamped range the probe just announced —
   * with a `--aparte-split-min` of `20rem`, `position="38"` on a 700px container asks
   * for 38 and gets ~46 — and a separator whose value is below its own minimum is the
   * unclamped-announcement bug this probe exists to prevent, just at rest. `_position`
   * is left alone: it is the REQUESTED value, and `reset()` means it.
   *
   * Gated on `!_dragging`: a ResizeObserver tick mid-gesture would move the pane to
   * both ends under the pointer. Gated on `!stacked` for the reason
   * `_achievedPercent()` is: a pane that spans everything measures the same at 0% and
   * at 100%, which would announce a range of one number.
   */
  _measureBounds() {
    const t = this._handle;
    if (!t || this._dragging || this._unmeasurable) return;
    const e = this._primaryPane(), s = this._measure(this);
    if (!e || !(s > 0)) {
      t.setAttribute("aria-valuemin", "0"), t.setAttribute("aria-valuemax", "100");
      return;
    }
    const r = this.style.getPropertyValue("--aparte-split-position");
    this.style.setProperty("--aparte-split-position", "0%");
    const i = this._measure(e) / s * 100;
    this.style.setProperty("--aparte-split-position", "100%");
    const a = this._measure(e) / s * 100;
    r ? this.style.setProperty("--aparte-split-position", r) : this.style.removeProperty("--aparte-split-position"), t.setAttribute("aria-valuemin", String(Math.round(i))), t.setAttribute("aria-valuemax", String(Math.round(a))), t.setAttribute("aria-valuenow", String(Math.round(this._achievedPercent())));
  }
  /**
   * Re-measure when the container's size changes — and only then. The probe writes the
   * host's `style` three times, and the reflection is commit-only precisely because a
   * `MutationObserver({ attributes: true })` (the docs' preview frame has one) reposts
   * a frame height per mutation, which resizes the split, which re-ticks this observer.
   * So: ignore a tick that did not move the size, and batch the rest to one per frame.
   */
  _watchSize() {
    typeof ResizeObserver == "function" && (this._observer = new ResizeObserver(() => {
      const t = this._measure(this);
      Math.abs(t - this._observedPx) <= 1 || (this._observedPx = t, this._measureRafId === null && (this._measureRafId = requestAnimationFrame(() => {
        this._measureRafId = null, this._measureBounds();
      })));
    }), this._observer.observe(this));
  }
  // ─── The one write, and the one event ─────────────────────────────────
  _setLive(t) {
    this.style.setProperty("--aparte-split-position", `${Math.round(t * 1e3) / 1e3}%`);
  }
  /**
   * The commit: reflect, announce, dispatch — once. Everything downstream reads the
   * ACHIEVED size, so the attribute, `aria-valuenow` and the detail are one number.
   *
   * There is no per-frame event on purpose. A bubbling, composed CustomEvent per
   * pointermove is a reconciler in the drag loop, and no pane in this repo re-lays
   * itself out in JS — they resize in CSS. The trigger for adding
   * `aparte-split-resizing` is a consumer whose pane needs a JS measurement mid-drag.
   */
  _commit(t = this._source) {
    const e = Math.round(this._achievedPercent());
    this._position = e, this._setLive(e), this._lastPosition = e, this.getAttribute("position") !== String(e) && this.setAttribute("position", String(e)), this._handle?.setAttribute("aria-valuenow", String(e)), this.dispatchEvent(
      new CustomEvent("aparte-split-resize", {
        detail: {
          position: e,
          collapsed: this.collapsed,
          stacked: this.stacked,
          pane: this.pane,
          orientation: this.orientation,
          source: t
        },
        bubbles: !0,
        composed: !0
      })
    );
  }
  // ─── Pointer ──────────────────────────────────────────────────────────
  /** The computed direction, never `document.dir`: a host can flip one subtree. */
  _rtl() {
    return getComputedStyle(this).direction === "rtl";
  }
  _onPointerDown = (t) => {
    this.disabled || this._unmeasurable || this._dragging || t.button > 0 || (t.preventDefault(), this._handle?.focus(), this._dragging = !0, this._captured = !1, this._moved = !1, this._pointerId = t.pointerId, this._dragStartPercent = this._position, this._dragOriginPx = this.orientation === "vertical" ? t.clientY : t.clientX, this._dragContainerPx = this._measure(this), this._handle?.setAttribute("data-dragging", ""), this._addScrim(), window.addEventListener("pointermove", this._onPointerMove), window.addEventListener("pointerup", this._onPointerUp), window.addEventListener("pointercancel", this._onPointerCancel));
  };
  /**
   * Only the pointer that started the gesture. On a hybrid device a hovering pen or a
   * stray touch delivers a `pointermove` with `buttons === 0`, which would otherwise
   * fall into the release branch below and end someone else's mouse drag.
   */
  _isOurPointer(t) {
    return this._pointerId === null || t.pointerId === this._pointerId;
  }
  _onPointerMove = (t) => {
    if (!this._dragging || !this._isOurPointer(t)) return;
    if (t.buttons === 0) {
      this._endDrag("pointer");
      return;
    }
    if (!this._captured && this._pointerId !== null) {
      this._captured = !0;
      try {
        this._handle?.setPointerCapture(this._pointerId);
      } catch {
      }
    }
    const e = this.orientation === "vertical" ? t.clientY : t.clientX;
    this._position = jg({
      startPercent: this._dragStartPercent,
      deltaPx: e - this._dragOriginPx,
      containerPx: this._dragContainerPx,
      rtl: this._rtl(),
      vertical: this.orientation === "vertical",
      primaryEnd: this.primary === "end"
    }), this._moved = !0, this._setLive(this._position);
  };
  _onPointerUp = (t) => {
    this._isOurPointer(t) && this._endDrag("pointer");
  };
  _onPointerCancel = (t) => {
    this._isOurPointer(t) && this._endDrag("pointer");
  };
  _endDrag(t, e) {
    if (!this._dragging) return;
    const s = this._moved;
    this._dragging = !1, this._moved = !1, this._releasePointer(), this._handle?.removeAttribute("data-dragging"), this._removeScrim(!s), e !== void 0 && (this._position = e, this._setLive(e)), !(!s && e === void 0) && (this._measureBounds(), this._commit(t));
  }
  _releasePointer() {
    if (window.removeEventListener("pointermove", this._onPointerMove), window.removeEventListener("pointerup", this._onPointerUp), window.removeEventListener("pointercancel", this._onPointerCancel), this._captured && this._pointerId !== null)
      try {
        this._handle?.releasePointerCapture(this._pointerId);
      } catch {
      }
    this._captured = !1, this._pointerId = null;
  }
  /**
   * The drag overlay: a fixed, transparent child of the HANDLE, alive for one gesture.
   * Topmost, so it swallows an iframe pane's hit-testing — the case this exists for —
   * and paints the drag cursor across the page. A child of the handle rather than of
   * the body so `click`, and therefore `dblclick`, still dispatches at the handle.
   */
  _addScrim() {
    if (this._scrim || !this._handle) return;
    const t = document.createElement("div");
    t.className = "aparte-split__scrim", t.setAttribute("aria-hidden", "true"), this._handle.appendChild(t), this._scrim = t;
  }
  /**
   * Take the overlay off.
   *
   * `retire` is the press that never moved — the one a click, and then a double-click,
   * is built from. Its release happened ON the scrim (nothing captured the pointer
   * yet), and WebKit works out what a click hit by walking the pointerup target's LIVE
   * ancestors: take the node out here and that chain is rooted nowhere, so no `click`
   * fires at all, no `dblclick` follows, and the seam never resets. Chromium and Gecko
   * resolve the target before dispatch and do not care.
   *
   * So a retired scrim goes INERT immediately — `pointer-events: none`, which is what
   * actually matters, since a full-page overlay left hit-testable is a page dead to the
   * pointer — and leaves the document a moment later. Not on the next task: a first
   * measurement removed it there and it still raced the click under a loaded machine
   * (the trace is in `e2e/tests/layout.spec.ts`). The reference is dropped either way,
   * so the next press builds its own; an inert one on its way out costs nothing.
   *
   * Teardown never retires: `disconnectedCallback` takes the live one out at once.
   */
  _removeScrim(t = !1) {
    const e = this._scrim;
    if (this._scrim = null, !!e) {
      if (!t) {
        e.remove();
        return;
      }
      e.style.pointerEvents = "none", setTimeout(() => e.remove(), Vg);
    }
  }
  _onDoubleClick = () => {
    this.disabled || this._unmeasurable || this.reset();
  };
  // ─── Keyboard ─────────────────────────────────────────────────────────
  _onKeydown = (t) => {
    if (this._dragging && t.key === "Escape") {
      t.preventDefault(), this._endDrag("pointer", this._dragStartPercent);
      return;
    }
    if (this.disabled || this._unmeasurable || t.target !== this._handle) return;
    if (t.key === "Enter") {
      t.preventDefault(), this._source = "keyboard";
      try {
        this.toggleCollapse();
      } finally {
        this._source = "api";
      }
      return;
    }
    const e = vo(
      t.key,
      t.shiftKey,
      this._rtl(),
      this.orientation === "vertical",
      this.primary === "end"
    );
    e !== null && (t.preventDefault(), this._keying = !0, this._position = Ge(String(this._position + e), this._position), this._setLive(this._position));
  };
  /**
   * The keyup commits, not the keydown: a held arrow repeats, and one release should
   * write one attribute and send one event, not thirty.
   */
  _onKeyup = (t) => {
    !this._keying || t.target !== this._handle || vo(t.key, t.shiftKey, this._rtl(), this.orientation === "vertical") !== null && (this._keying = !1, this._commit("keyboard"));
  };
  /**
   * The other end of a key step. If focus leaves the seam while the key is still down —
   * alt-tab, a click into a pane, a host moving focus — the keyup never arrives, and
   * the pane would stay where the keydown put it while the attribute and
   * `aria-valuenow` kept the old number for good. What is rendered is what commits.
   */
  _onFocusOut = () => {
    this._keying && (this._keying = !1, this._commit("keyboard"));
  };
  // ─── The breakpoint ───────────────────────────────────────────────────
  /**
   * The stacking query, from the `breakpoint` attribute: a length (`48rem`, the
   * default, or `640px`), or `none` for a split that stays two panes at any width —
   * which a documentation frame needs and a host with its own breakpoint wants.
   */
  _watchBreakpoint() {
    this._media?.removeEventListener("change", this._onMediaChange), this._media = null;
    const t = (this.getAttribute("breakpoint") ?? "").trim();
    if (t === "none") {
      this._applyStacked(!1);
      return;
    }
    if (typeof matchMedia != "function") return;
    const e = t ? `(max-width: ${t})` : Kg;
    this._media = matchMedia(e), this._media.addEventListener("change", this._onMediaChange), this._applyStacked(this._media.matches);
  }
  _onMediaChange = (t) => this._applyStacked(t.matches);
  /**
   * Entering the stacked state shows the START pane: the chat, never a preview of
   * nothing — the same judgement that makes the sidebar's drawer enter closed. Unless
   * the markup already named one, which is an answer to the same question and a better
   * one. Leaving it restores both panes, and with them the seam and its tab stop.
   *
   * `was` is the ATTRIBUTE, not the `stacked` getter: the getter also counts
   * `.aparte-split--only-*`, the CSS route a host takes when it owns its breakpoints
   * and sets `breakpoint="none"`. Read through the getter, that mount looks like a
   * split leaving a stacked state it never entered — and the `pane` the author wrote
   * is deleted on the way in.
   */
  _applyStacked(t) {
    const e = this.hasAttribute("data-stacked");
    t && !e && this._dragging && this._endDrag("pointer", this._dragStartPercent), this.toggleAttribute("data-stacked", t), t !== e && this._syncPaneControls(), t && !e ? this.hasAttribute("pane") || this.showPane("start") : !t && e && this.removeAttribute("pane"), this._lastPane = this.pane, this._stampHandle(), t !== e && this._measureBounds();
  }
  /**
   * A `[data-aparte-split-pane]` anywhere on the page switches a split's pane, so a
   * two-button toggle in a header needs no script.
   *
   * The value is `start` or `end` — the pane to show. Any other non-empty value names
   * a split's `id` and TOGGLES that one; empty toggles the nearest split, else the
   * first on the page. Same shape as `[data-aparte-sidebar-toggle]`.
   */
  _onDocumentClick = (t) => {
    const e = Dt(t)?.closest?.("[data-aparte-split-pane]");
    if (!e || Pt(e)) return;
    const s = (e.getAttribute("data-aparte-split-pane") ?? "").trim(), r = s === "start" || s === "end" ? s : null, i = r ? "" : s;
    if (i) {
      if (i !== this.id) return;
    } else if ((e.closest("aparte-split") ?? xe(e).querySelector("aparte-split") ?? document.querySelector("aparte-split")) !== this) return;
    this.showPane(r ?? (this.pane === "start" ? "end" : "start"));
  };
  /**
   * The two-button switch says which pane it shows: `aria-pressed` on every
   * `[data-aparte-split-pane="start"|"end"]` that reaches this split, true on the one
   * naming the pane in view, while the split is stacked; side by side both panes are in
   * view and neither button is pressed, so none carries it. A toggle (an id, or empty) is
   * an action and gets none. Read when the split connects, whenever `pane` changes and
   * when it stacks or unstacks, so a control added later is stamped at the next switch.
   */
  _syncPaneControls() {
    const t = /* @__PURE__ */ new Set([xe(this), document]);
    for (const e of t)
      for (const s of e.querySelectorAll("[data-aparte-split-pane]")) {
        const r = (s.getAttribute("data-aparte-split-pane") ?? "").trim();
        r !== "start" && r !== "end" || s.localName !== "button" && s.getAttribute("role") !== "button" || Pt(s) || (s.closest("aparte-split") ?? xe(s).querySelector("aparte-split") ?? document.querySelector("aparte-split")) !== this || (this.stacked ? s.setAttribute("aria-pressed", String(r === this.pane)) : s.removeAttribute("aria-pressed"));
      }
  }
  // ─── Locale ───────────────────────────────────────────────────────────
  _onConfigChange = () => this._relabel();
  /**
   * The seam's accessible name. A host that wrote its own `aria-label` — or an
   * `aria-labelledby` pointing at a heading — keeps it: `data-own-label` marks the
   * one we set, so a language switch replaces ours and never theirs.
   */
  _relabel() {
    const t = this._handle;
    if (!t || t.hasAttribute("aria-labelledby") || t.hasAttribute("aria-label") && t.dataset.ownLabel !== "locale") return;
    const e = $(this).getLocale();
    t.setAttribute("aria-label", this.getAttribute("label") ?? e.splitHandleLabel ?? "Resize the panes"), t.dataset.ownLabel = "locale";
  }
}
rt(ps);
customElements.get("aparte-split") || customElements.define("aparte-split", ps);
const Xg = "(max-width: 30rem), (max-height: 30rem)", Yg = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");
class $t extends HTMLElement {
  static get observedAttributes() {
    return ["open", "label", "breakpoint", "header", "heading", "subheading", "maximizable", "maximized"];
  }
  _button = null;
  /**
   * The element's header and the parts of it a render updates. Built once and updated in
   * place, never redrawn: the maximize button is what the person just pressed, and a new
   * node would take the focus out from under them.
   */
  _header = null;
  _avatar = null;
  /** The provider that drew the header's avatar, and what it returned to undo it. */
  _avatarDrawnBy = null;
  _avatarCleanup = null;
  _title = null;
  _subtitle = null;
  _maximize = null;
  _closeControl = null;
  /**
   * Watches the element's own children. The button is the one child that is not the host's,
   * so it is the one a framework reconciling the others knows nothing about: Vue's
   * hydration removes "more child nodes than client vdom", Svelte 4's removes what its
   * claim did not take. Without this it stays removed — a closed launcher then shows
   * nothing, and nothing can open the chat.
   */
  _childWatch = null;
  /**
   * Watches for a config boundary appearing, changing or leaving inside the element. A
   * framework wrapper attaches its chat's `config` from a post-mount hook, after the
   * launcher has connected and drawn its button, and `attachConfig` tells the elements
   * INSIDE the boundary, never the launcher around it.
   */
  _hostWatch = null;
  _media = null;
  _lastOpen = null;
  /**
   * `connectedCallback` has run. During an UPGRADE `attributeChangedCallback` fires for
   * every authored attribute before it — `<aparte-launcher open>` server-rendered and
   * upgraded when the module loads — and announcing a toggle there tells the host its
   * chat just opened when all that happened is that the markup was read.
   */
  _ready = !1;
  /** The chat is open. */
  get open() {
    return this.hasAttribute("open");
  }
  set open(t) {
    this.toggleAttribute("open", mt(t));
  }
  /** True while the window is under the breakpoint, where the open chat fills it. */
  get sheet() {
    return this.hasAttribute("data-sheet");
  }
  /** The open chat is maximized: the whole window, or a panel along its edge with `maximizable="panel"`. */
  get maximized() {
    return this.hasAttribute("maximized");
  }
  set maximized(t) {
    this.toggleAttribute("maximized", mt(t));
  }
  /**
   * The open chat covers the whole window: a sheet under the breakpoint, or maximized
   * without `maximizable="panel"`. What a page reads to take itself out of reach — the
   * launcher keeps Tab inside it meanwhile, and does not own the page.
   */
  get covers() {
    if (!this.open) return !1;
    if (this.sheet) return !0;
    if (!this.maximized) return !1;
    if (!this._panel) return !0;
    const t = this.getBoundingClientRect().width;
    return t > 0 && t >= document.documentElement.clientWidth - 1;
  }
  /** Maximized, the chat is a panel along the window's edge rather than the whole window. */
  get _panel() {
    return this.getAttribute("maximizable") === "panel";
  }
  /**
   * The element draws its header over a card that has none. A property as well as the
   * attribute because the attribute's OFF is a value, `"false"`, and a framework handed
   * `header={false}` removes a boolean attribute instead — which here means ON.
   */
  get header() {
    return this.getAttribute("header") !== "false";
  }
  set header(t) {
    t === !1 || t === "false" ? this.setAttribute("header", "false") : this.removeAttribute("header");
  }
  connectedCallback() {
    if (this.classList.contains("aparte-launcher") || this.classList.add("aparte-launcher"), !this._button) {
      const t = this.querySelector(":scope > button.aparte-launcher__button");
      this._button = t instanceof HTMLButtonElement ? t : document.createElement("button"), this._button.type = "button", this._button.addEventListener("click", this._onButtonClick);
    }
    for (const t of this.querySelectorAll(":scope > .aparte-launcher__button, :scope > .aparte-launcher__header"))
      t !== this._button && t !== this._header && t.remove();
    this._button.parentNode !== this && this.appendChild(this._button), typeof MutationObserver == "function" && (this._childWatch ??= new MutationObserver((t) => {
      t.some((e) => e.target === this || $t._touchesParts(e)) && this._onChildren();
    }), this._childWatch.observe(this, { childList: !0, subtree: !0 }), this._hostWatch ??= new MutationObserver(() => this._render()), this._hostWatch.observe(this, { attributes: !0, attributeFilter: [Gn], subtree: !0 })), this.addEventListener("click", this._onClick), this.addEventListener("keydown", this._onKeydown), window.addEventListener("aparte-config-change", this._onConfigChange), this._watchBreakpoint(), this._lastOpen = this.open, this._render(), this._ready = !0;
  }
  disconnectedCallback() {
    this.removeEventListener("click", this._onClick), this.removeEventListener("keydown", this._onKeydown), window.removeEventListener("aparte-config-change", this._onConfigChange), this._childWatch?.disconnect(), this._hostWatch?.disconnect(), this._media?.removeEventListener("change", this._onMediaChange), this._media = null, this._clearAvatar(), this._ready = !1;
  }
  attributeChangedCallback(t, e, s) {
    if (!this._ready) return;
    if (t === "breakpoint") {
      this._watchBreakpoint();
      return;
    }
    if (this._render(), t === "maximized") {
      e === null != (s === null) && this._announce();
      return;
    }
    if (t === "maximizable") {
      this.open && this.maximized && e === "panel" != (s === "panel") && this._announce();
      return;
    }
    if (t !== "open") return;
    const r = this.open;
    r !== this._lastOpen && (this._lastOpen = r, !r && this._button && this.contains(Et(this)) && this._button.focus(), this._announce());
  }
  _announce() {
    this.dispatchEvent(new CustomEvent("aparte-launcher-toggle", {
      detail: { open: this.open, sheet: this.sheet, maximized: this.maximized, covers: this.covers },
      bubbles: !0,
      composed: !0
    }));
  }
  // ─── Public API ───────────────────────────────────────────────────────
  /** Open the chat. */
  show() {
    this.open = !0;
  }
  /** Close the chat. */
  close() {
    this.open = !1;
  }
  /** Open the chat when it is closed, close it when it is open. */
  toggle() {
    this.open = !this.open;
  }
  /**
   * Maximize the chat: the whole window, or a panel along its edge with
   * `maximizable="panel"`. Kept while the chat is closed, so it opens maximized.
   */
  maximize() {
    this.maximized = !0;
  }
  /** Bring the chat back to its card. */
  restore() {
    this.maximized = !1;
  }
  // ─── Button ───────────────────────────────────────────────────────────
  /**
   * The one opening that is a person's: the composer takes the focus, since they opened the
   * chat to write. `show()` and `open` are a script's — a page restoring the state it saved,
   * a host driving `open` from its own state — and a focus that jumps on page load is
   * unasked for, and on a phone raises the keyboard over a sheet nobody pressed. An authored
   * `open` never took the focus either, so the three ways of starting open now agree.
   */
  _onButtonClick = () => {
    const t = !this.open;
    this.toggle(), t && this._focusChat();
  };
  _onConfigChange = () => this._render();
  /** Everything the element draws, for the state it is in and the config it answers to. */
  _render() {
    const t = this._config();
    this._renderButton(t), this._renderHeader(t), this._syncMaximizeControls();
  }
  /**
   * The children changed: a framework reconciled them, hydration took out what it did not
   * render, a card arrived late. The button and the header go back if they were taken out,
   * and a card that now brings a header of its own is no longer given a second one.
   */
  _onChildren() {
    this._keepButton(), this._renderHeader(this._config()), this._syncMaximizeControls();
  }
  /**
   * The config the button answers to: the chat's own when the chat inside carries an
   * instance config (a wrapper's `config` prop, `attachConfig(chat, config)`), else the
   * one at the launcher's own place — an ancestor's boundary, or the page's. The button
   * labels and draws a control of THAT chat, and the chat's boundary is below the launcher,
   * so resolving from the launcher alone read the page's locale and icons next to a chat
   * in another language. Resolved live, never kept: the boundary may arrive after connect.
   */
  _config() {
    const t = Array.from(this.querySelectorAll(`[${Gn}]`)).find((e) => !Pt(e));
    return $(t ?? this);
  }
  /**
   * The button is a child of the element, whatever was done to the children since: put
   * back at the end when something took it out. A button that is still a child stays
   * where it is, since the host may have placed it. Called on every render, and from the
   * observer for the removal that comes with no render at all.
   */
  _keepButton() {
    this._button && this._button.parentNode !== this && this.appendChild(this._button);
  }
  /**
   * The button, for the state it is in: the bubble (and the label, as a pill) while
   * closed, a close glyph while open. Its name comes from the locale when it shows no
   * text, and from that text when it does — a visible label the name did not contain
   * is what speech users cannot say to press it. `aria-expanded` is the disclosure's whole
   * contract: there is no `aria-controls`, since the one element it could name without
   * writing an id on the host's card is the launcher itself, the button's own ancestor.
   */
  _renderButton(t) {
    const e = this._button;
    if (!e) return;
    this._keepButton();
    const s = t.getLocale(), r = this.open, i = r ? "" : (this.getAttribute("label") ?? "").trim(), a = i ? "aparte-btn--pill" : "aparte-btn--circle";
    e.className = ["aparte-btn", "aparte-btn--primary", "aparte-btn--solid", "aparte-btn--lg", a, "aparte-launcher__button"].join(" "), e.setAttribute("aria-expanded", String(r)), i ? e.removeAttribute("aria-label") : e.setAttribute("aria-label", r ? s.launcherClose ?? "Close the chat" : s.launcherOpen ?? "Open the chat");
    const o = [$t._glyph(r ? t.getIcon("launcherClose") ?? t.getIcon("close") : t.getIcon("launcherOpen") ?? t.getIcon("messageSquare"))];
    if (i) {
      const l = document.createElement("span");
      l.className = "aparte-launcher__label", l.textContent = i, o.push(l);
    }
    e.replaceChildren(...o);
  }
  /** A glyph, out of the accessibility tree: what holds it is named by its label. */
  static _glyph(t) {
    const e = document.createElement("span");
    return e.className = "aparte-launcher__icon", e.setAttribute("aria-hidden", "true"), e.innerHTML = t, e;
  }
  // ─── Header ───────────────────────────────────────────────────────────
  /**
   * A card that brings its own header: a `<header>` at its top level — how every card in
   * this repository with a header of its own is written, so they keep theirs and are not
   * given a second. A close control alone is not one: an "End chat" in a card's footer is a
   * close control too, and took the header away when it counted.
   */
  _cardHasHeader() {
    return Array.from(this.children).some((t) => t !== this._button && t !== this._header && t.querySelector(":scope > header") !== null);
  }
  /**
   * A change deeper in the card that the element answers: a header, or a maximize
   * control, arriving or leaving — a framework rendering a card's header after the card,
   * a conditional control. A streamed reply adds text and spans, so it calls for nothing.
   */
  static _touchesParts(t) {
    const e = "header, [data-aparte-launcher-maximize]";
    return [...t.addedNodes, ...t.removedNodes].some((s) => s instanceof Element && (s.matches(e) || s.querySelector(e) !== null));
  }
  /** An icon-only control of the header: the recipe's ghost icon button. */
  static _headerButton(t) {
    const e = document.createElement("button");
    return e.type = "button", e.className = `aparte-btn aparte-btn--icon aparte-btn--ghost aparte-launcher__${t}`, e;
  }
  /** A control's name, spoken and shown on hover: an icon alone says nothing to a pointer. */
  static _name(t, e, s) {
    t.setAttribute("aria-label", e), t.setAttribute("title", e), t.replaceChildren($t._glyph(s));
  }
  _buildHeader() {
    const t = document.createElement("div");
    t.className = "aparte-app-header aparte-launcher__header", this._avatar = document.createElement("span"), this._avatar.className = "aparte-avatar aparte-launcher__avatar", this._avatar.setAttribute("data-role", "assistant"), this._avatar.setAttribute("aria-hidden", "true");
    const e = document.createElement("div");
    e.className = "aparte-launcher__heading", this._title = document.createElement("span"), this._title.className = "aparte-app-header__title aparte-launcher__title", this._title.setAttribute("role", "heading"), this._title.setAttribute("aria-level", "2"), this._subtitle = document.createElement("span"), this._subtitle.className = "aparte-launcher__subheading", e.append(this._title, this._subtitle);
    const s = document.createElement("div");
    return s.className = "aparte-app-header__actions", this._maximize = $t._headerButton("maximize"), this._maximize.setAttribute("data-aparte-launcher-maximize", ""), this._closeControl = $t._headerButton("close"), this._closeControl.setAttribute("data-aparte-launcher-close", ""), s.append(this._maximize, this._closeControl), t.append(this._avatar, e, s), t;
  }
  /**
   * The header, when the element draws one: the title, the line under it, the maximize
   * button for its state, the ✕. It goes first among the children, and the stylesheet
   * joins it to the card under it.
   */
  _renderHeader(t) {
    if (!this.header || this._cardHasHeader()) {
      const l = !!this._header?.contains(Et(this));
      this._clearAvatar(), this._header?.remove(), l && (this._focusTarget() ?? this._button)?.focus();
      return;
    }
    const e = this._header ??= this._buildHeader(), s = t.getLocale(), r = (this.getAttribute("label") ?? "").trim(), i = (this.getAttribute("heading") ?? (r || (s.launcherHeading ?? "Chat"))).trim();
    this._title.textContent = i, this._title.hidden = !i, this._drawAvatar(t);
    const a = (this.getAttribute("subheading") ?? "").trim();
    this._subtitle.textContent = a, this._subtitle.hidden = !a;
    const o = this._maximize;
    o.hidden = !this.hasAttribute("maximizable"), $t._name(
      o,
      this.maximized ? s.launcherRestore ?? "Shrink the chat" : s.launcherMaximize ?? "Expand the chat",
      t.getIcon(this.maximized ? "minimize" : "maximize")
    ), $t._name(this._closeControl, s.launcherClose ?? "Close the chat", t.getIcon("close")), this.firstElementChild !== e && this.prepend(e), this._markAvatarImage();
  }
  /**
   * The assistant's avatar, by the provider that draws it in the messages — the one place an
   * app says what its assistant looks like, a framework component included. Drawn again only
   * when the provider changes, since a render runs on every attribute and a provider may
   * mount a component. Empty without one, and the stylesheet folds an empty slot away.
   */
  _drawAvatar(t) {
    const e = t.getAvatarProvider();
    if (e !== this._avatarDrawnBy && (this._clearAvatar(), !(!e || !this._avatar))) {
      this._avatarDrawnBy = e;
      try {
        const s = e.render("assistant", this._avatar);
        typeof s == "function" && (this._avatarCleanup = s);
      } catch (s) {
        this._avatar.replaceChildren(), console.error("[aparte] The avatar provider failed for the launcher's header, which shows no avatar. It is called with a host outside any message there.", s);
      }
    }
  }
  /**
   * A picture from the stylesheet alone (`--aparte-avatar-image-assistant`), as a message's
   * slot shows it: an empty slot that has one is marked, which lifts the rule folding an empty
   * slot away. Read after the header is in the document, where its style resolves.
   */
  _markAvatarImage() {
    const t = this._avatar;
    if (!t) return;
    const e = typeof getComputedStyle == "function" ? getComputedStyle(t).backgroundImage : "";
    t.toggleAttribute("data-image", !t.firstChild && !!e && e !== "none");
  }
  _clearAvatar() {
    try {
      this._avatarCleanup?.();
    } catch {
    }
    this._avatarCleanup = null, this._avatarDrawnBy = null, this._avatar?.replaceChildren();
  }
  /**
   * A maximize control of the host's says what it does: `aria-pressed` follows the state.
   * The element's own button is the exception, because it changes its NAME with the state
   * instead, and a toggle whose name changes must not also say it is pressed.
   */
  _syncMaximizeControls() {
    const t = String(this.maximized);
    for (const e of this.querySelectorAll("[data-aparte-launcher-maximize]"))
      e === this._maximize || Pt(e) || e.setAttribute("aria-pressed", t);
  }
  // ─── Sheet ────────────────────────────────────────────────────────────
  _onMediaChange = (t) => this._applySheet(t.matches);
  /** The sheet's media query, from `breakpoint`: a length, or `none` for a card at any width. */
  _watchBreakpoint() {
    this._media?.removeEventListener("change", this._onMediaChange), this._media = null;
    const t = (this.getAttribute("breakpoint") ?? "").trim();
    if (t === "none" || typeof matchMedia != "function") {
      this._applySheet(!1);
      return;
    }
    this._media = matchMedia(t ? `(max-width: ${t})` : Xg), this._media.addEventListener("change", this._onMediaChange), this._applySheet(this._media.matches);
  }
  /**
   * An open chat that turns into a sheet now covers the page, and one that turns back no
   * longer does: announced, so a host that takes its page out of reach under the sheet
   * follows the window without a media query of its own, which would be a second copy
   * of `breakpoint` to keep in step.
   */
  _applySheet(t) {
    if (t === this.sheet) return;
    this.toggleAttribute("data-sheet", t);
    const e = Et(this);
    t && e?.matches("[data-aparte-launcher-maximize]") && this.contains(e) && (this._closeControl?.isConnected ? this._closeControl : this._focusTarget())?.focus(), this._ready && this.open && this._announce();
  }
  // ─── Focus and keys ───────────────────────────────────────────────────
  /** What the chat lets the focus land on: yours to decide, so only what is visible. */
  _focusables() {
    return Array.from(this.querySelectorAll(Yg)).filter((t) => !t.closest("[hidden]") && t.checkVisibility?.() !== !1);
  }
  /**
   * The composer when there is one — the person opened the chat to write — else the
   * first thing in the card that holds focus. The button itself never: it is what the
   * person just pressed. Nor the element's header, which comes first in the DOM: its ✕
   * is not what anyone opened the chat for, and focus landing there would read the way
   * out before the way in.
   */
  _focusChat() {
    this._focusTarget()?.focus();
  }
  /**
   * Where the focus goes in the chat: the composer, else the card's first control, else —
   * when the chat covers the window and its button is hidden — the header's ✕, the one way
   * out left on screen.
   */
  _focusTarget() {
    return Array.from(this.querySelectorAll('[role="textbox"]:not([aria-disabled="true"])')).find((e) => !Pt(e) && !e.closest("[hidden]") && e.checkVisibility?.() !== !1) ?? this._focusables().find((e) => e !== this._button && !this._header?.contains(e)) ?? (this.covers && this._closeControl?.isConnected ? this._closeControl : void 0);
  }
  /**
   * A `[data-aparte-launcher-close]` inside closes the chat, and a
   * `[data-aparte-launcher-maximize]` enlarges it or brings it back — no script in your card.
   */
  _onClick = (t) => {
    const e = Dt(t), s = (r) => {
      const i = e?.closest?.(r);
      return !!i && this.contains(i) && !Pt(i);
    };
    s("[data-aparte-launcher-close]") ? this.close() : s("[data-aparte-launcher-maximize]") && (this.maximized = !this.maximized);
  };
  /**
   * A modal dialog open inside the card, with the key pressed inside it. The browser
   * closes it on Escape — unless the keydown was cancelled, which is what closing the
   * launcher would do: the dialog refused its close request and the card hidden under it.
   * An engine that cannot tell a modal dialog from one opened with `show()` (no `:modal`)
   * leaves the key to the dialog, which is the answer that loses nothing.
   */
  _inModalDialog(t) {
    const e = Dt(t)?.closest?.("dialog[open]");
    if (!e || !this.contains(e)) return !1;
    try {
      return e.matches(":modal");
    } catch {
      return !0;
    }
  }
  /** A sidebar open as a drawer inside the card: Escape closes it before it closes the chat. */
  _drawerOpen() {
    return this.querySelector("aparte-sidebar[data-drawer]:not([collapsed])") !== null;
  }
  _onKeydown = (t) => {
    if (!this.open) return;
    if (t.key === "Escape") {
      if (t.defaultPrevented || t.isComposing || t.keyCode === 229 || this._inModalDialog(t) || this._drawerOpen()) return;
      t.preventDefault(), this.maximized && !this.sheet ? this.maximized = !1 : this.close();
      return;
    }
    if (t.key !== "Tab" || !this.covers) return;
    const e = this._focusables();
    if (e.length === 0) return;
    const s = e[0], r = e[e.length - 1], i = Et(this);
    t.shiftKey && i === s ? (t.preventDefault(), r.focus()) : !t.shiftKey && i === r && (t.preventDefault(), s.focus());
  };
}
rt($t);
customElements.get("aparte-launcher") || customElements.define("aparte-launcher", $t);
const yo = Symbol.for("aparte.imageHolds"), zc = ".aparte-image-held[data-aparte-image]";
function Gc(n) {
  const t = n.getAttribute("data-aparte-image") ?? "";
  $(n).showImage(t);
  const e = document.createElement("img");
  e.setAttribute("referrerpolicy", "no-referrer"), e.setAttribute("alt", n.getAttribute("data-aparte-image-alt") ?? ""), e.setAttribute("src", t);
  const s = n === document.activeElement;
  n.replaceWith(e), s && (e.tabIndex = -1, e.focus({ preventScroll: !0 }));
}
function Qg(n) {
  if (n.button !== 0 || n.ctrlKey || n.metaKey || n.shiftKey || n.altKey) return;
  const t = n.target?.closest?.(zc);
  t && (n.preventDefault(), n.stopPropagation(), Gc(t));
}
function Zg(n) {
  if (n.key !== "Enter" && n.key !== " ") return;
  const t = n.target;
  t?.matches?.(`span${zc}`) && (n.preventDefault(), n.stopPropagation(), Gc(t));
}
function Jg() {
  const n = document;
  n[yo] || (n[yo] = !0, n.addEventListener("click", Qg, !0), n.addEventListener("keydown", Zg, !0));
}
typeof document < "u" && (ig(), Jg());
function t_(n) {
  const t = /^data:([^;,]*)(?:;[^;,]*)*;base64,(.*)$/s.exec(n.image);
  return t ? { type: "image", source: { type: "data", value: t[2], mimeType: n.mimeType ?? (t[1] || "application/octet-stream") } } : { type: "image", source: { type: "url", value: n.image, ...n.mimeType ? { mimeType: n.mimeType } : {} } };
}
function e_(n, t, e) {
  const s = [];
  return n.forEach((r, i) => {
    const a = `aparte-${i}`, o = il(r.content), l = Array.isArray(r.content) && r.content.some((c) => c.type === "image");
    r.role === "user" && l && !t ? s.push({
      id: a,
      role: "user",
      content: r.content.map((c) => c.type === "image" ? t_(c) : { type: "text", text: c.text })
    }) : r.role === "system" || r.role === "user" ? (l && e(`the agent's AG-UI version takes text only, which DROPS non-text parts: the images of message ${i} are not sent.`), s.push({ id: a, role: r.role, content: o })) : r.role === "assistant" ? s.push({
      id: a,
      role: "assistant",
      ...o ? { content: o } : {},
      ...r.toolCalls?.length ? {
        toolCalls: r.toolCalls.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) }
        }))
      } : {}
    }) : r.role === "tool" && r.toolCallId && s.push({ id: a, role: "tool", content: o, toolCallId: r.toolCallId });
  }), s;
}
function n_(n) {
  return (n ?? []).map((t) => ({ name: t.name, description: t.description, parameters: t.inputSchema }));
}
const s_ = ["type", "timestamp", "rawEvent", "metadata"], r_ = {
  RUN_STARTED: ["threadId", "runId", "parentRunId", "protocolVersion", "input"],
  RUN_FINISHED: ["threadId", "runId", "outcome", "result", "usage"],
  RUN_ERROR: ["message", "code", "usage"],
  STEP_STARTED: ["stepName", "subagentRunId"],
  STEP_FINISHED: ["stepName", "subagentRunId"],
  TEXT_MESSAGE_START: ["messageId", "role", "name", "subagentRunId"],
  TEXT_MESSAGE_CONTENT: ["messageId", "delta", "subagentRunId"],
  TEXT_MESSAGE_END: ["messageId", "subagentRunId"],
  TEXT_MESSAGE_CHUNK: ["messageId", "role", "name", "delta", "subagentRunId"],
  TOOL_CALL_START: ["toolCallId", "toolCallName", "parentMessageId", "subagentRunId"],
  TOOL_CALL_ARGS: ["toolCallId", "delta", "subagentRunId"],
  TOOL_CALL_END: ["toolCallId", "subagentRunId"],
  TOOL_CALL_CHUNK: ["toolCallId", "toolCallName", "parentMessageId", "delta", "subagentRunId"],
  TOOL_CALL_RESULT: ["messageId", "toolCallId", "content", "role", "subagentRunId"],
  REASONING_START: ["messageId", "subagentRunId"],
  REASONING_END: ["messageId", "subagentRunId"],
  REASONING_MESSAGE_START: ["messageId", "role", "subagentRunId"],
  REASONING_MESSAGE_CONTENT: ["messageId", "delta", "subagentRunId"],
  REASONING_MESSAGE_END: ["messageId", "subagentRunId"],
  REASONING_MESSAGE_CHUNK: ["messageId", "delta", "subagentRunId"],
  REASONING_ENCRYPTED_VALUE: ["subtype", "entityId", "encryptedValue", "subagentRunId"],
  STATE_SNAPSHOT: ["snapshot", "subagentRunId"],
  STATE_DELTA: ["delta", "subagentRunId"],
  MESSAGES_SNAPSHOT: ["messages"],
  ACTIVITY_SNAPSHOT: ["messageId", "activityType", "content", "replace", "subagentRunId"],
  ACTIVITY_DELTA: ["messageId", "activityType", "patch", "subagentRunId"],
  RAW: ["event", "source", "subagentRunId"],
  CUSTOM: ["name", "value", "subagentRunId"],
  SUBAGENT_STARTED: ["subagentRunId", "name", "description", "parentMessageId", "parentToolCallId", "parentSubagentRunId"],
  SUBAGENT_FINISHED: ["subagentRunId", "outcome", "result"],
  SUBAGENT_ERROR: ["subagentRunId", "message", "code"]
}, i_ = /* @__PURE__ */ new Set(["developer", "system", "assistant", "user"]), a_ = /* @__PURE__ */ new Set(["success", "interrupt", "cancelled"]), o_ = /* @__PURE__ */ new Set(["text", "image", "audio", "video", "document"]);
function l_(n, t) {
  const e = r_[n.type];
  if (!e) {
    t(`dropped an event of a type this runner does not know: ${n.type}.`);
    return;
  }
  const s = { ...n };
  for (const i of Object.keys(s))
    !s_.includes(i) && !e.includes(i) && (delete s[i], t(`stripped /${i} from ${n.type}: AG-UI 1.0 does not describe it.`));
  (s.type === "TEXT_MESSAGE_START" || s.type === "TEXT_MESSAGE_CHUNK") && typeof s.role == "string" && !i_.has(s.role) && (t(`stripped /role from ${s.type}: "${s.role}" is not a message role.`), delete s.role);
  const r = s.outcome;
  return s.type === "RUN_FINISHED" && r && typeof r == "object" && !Array.isArray(r) && !a_.has(String(r.type)) && (t(`stripped /outcome from RUN_FINISHED: "${String(r.type)}" is not an outcome AG-UI 1.0 describes; the run ends as a plain one.`), delete s.outcome), s.type === "MESSAGES_SNAPSHOT" && Array.isArray(s.messages) && (s.messages = s.messages.map((i, a) => {
    const o = i?.content;
    if (!Array.isArray(o)) return i;
    const l = o.filter((c, d) => {
      const h = o_.has(String(c?.type));
      return h || t(`stripped /messages/${a}/content/${d} from MESSAGES_SNAPSHOT: "${String(c?.type)}" is not a content part.`), h;
    });
    return { ...i, content: l };
  })), s;
}
const c_ = /* @__PURE__ */ new Set(["add", "remove", "replace", "move", "copy", "test"]);
function d_(n) {
  if (n === "") return [];
  if (!n.startsWith("/")) throw new Error(`"${n}" is not a JSON Pointer`);
  return n.slice(1).split("/").map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
}
function pn(n) {
  return typeof n == "object" && n !== null;
}
function _n(n, t, e) {
  if (e && t === "-") return n.length;
  if (!/^(0|[1-9]\d*)$/.test(t)) throw new Error(`"${t}" is not an array index`);
  const s = Number(t);
  if (s > n.length || !e && s === n.length) throw new Error(`index ${s} is out of range`);
  return s;
}
function fs(n, t) {
  const e = d_(t), s = e.pop();
  let r = n;
  for (const i of e) {
    if (!pn(r)) throw new Error(`"${t}" does not resolve`);
    if (r = Array.isArray(r) ? r[_n(r, i, !1)] : Object.hasOwn(r, i) ? r[i] : void 0, r === void 0) throw new Error(`"${t}" does not resolve`);
  }
  if (!pn(r)) throw new Error(`"${t}" does not resolve`);
  return { parent: r, key: s };
}
function Xs(n, t) {
  if (t === "") return n;
  const { parent: e, key: s } = fs(n, t), r = Array.isArray(e) ? e[_n(e, s, !1)] : Object.hasOwn(e, s) ? e[s] : void 0;
  if (r === void 0) throw new Error(`"${t}" does not resolve`);
  return r;
}
function Ys(n, t, e) {
  if (t === "") return e;
  const { parent: s, key: r } = fs(n, t);
  return Array.isArray(s) ? s.splice(_n(s, r, !0), 0, e) : s[r] = e, n;
}
function wo(n, t) {
  if (t === "") throw new Error("the whole document cannot be removed");
  const { parent: e, key: s } = fs(n, t);
  if (Array.isArray(e)) e.splice(_n(e, s, !1), 1);
  else if (Object.hasOwn(e, s)) delete e[s];
  else throw new Error(`"${t}" does not resolve`);
  return n;
}
function u_(n, t, e) {
  if (t === "") return e;
  const { parent: s, key: r } = fs(n, t);
  if (Array.isArray(s)) s[_n(s, r, !1)] = e;
  else if (Object.hasOwn(s, r)) s[r] = e;
  else throw new Error(`"${t}" does not resolve`);
  return n;
}
function Lr(n, t) {
  if (n === t) return !0;
  if (!pn(n) || !pn(t) || Array.isArray(n) !== Array.isArray(t)) return !1;
  if (Array.isArray(n)) return n.length === t.length && n.every((r, i) => Lr(r, t[i]));
  const e = Object.keys(n), s = Object.keys(t);
  return e.length === s.length && e.every((r) => Object.hasOwn(t, r) && Lr(n[r], t[r]));
}
function h_(n, t) {
  const e = t.path;
  if (typeof e != "string") throw new Error("an operation has no path");
  const s = typeof t.from == "string" ? t.from : void 0;
  if ((t.op === "add" || t.op === "replace" || t.op === "test") && !("value" in t)) throw new Error(`${String(t.op)} has no value`);
  switch (t.op) {
    case "add":
      return Ys(n, e, structuredClone(t.value));
    case "remove":
      return wo(n, e);
    case "replace":
      return u_(n, e, structuredClone(t.value));
    case "move": {
      if (s === void 0) throw new Error("move has no from");
      if (e.startsWith(`${s}/`)) throw new Error(`"${s}" cannot move into its own child "${e}"`);
      const r = Xs(n, s);
      return Ys(wo(n, s), e, r);
    }
    case "copy": {
      if (s === void 0) throw new Error("copy has no from");
      return Ys(n, e, structuredClone(Xs(n, s)));
    }
    case "test":
      if (!Lr(Xs(n, e), t.value)) throw new Error(`test failed at "${e}"`);
      return n;
    default:
      throw new Error(`unknown operation "${String(t.op)}"`);
  }
}
function p_(n, t, e) {
  return jc(n, t, e, { event: "STATE_DELTA", field: "delta", what: "state" });
}
function f_(n, t, e) {
  return jc(n, t, e, { event: "ACTIVITY_DELTA", field: "patch", what: "activity" });
}
function jc(n, t, e, s) {
  const { event: r, field: i, what: a } = s;
  if (!Array.isArray(t))
    return e(`Failed to apply ${a} patch: ${r} carried no list of operations; the ${a} is left as it was.`), n;
  const o = [];
  t.forEach((l, c) => {
    pn(l) && !Array.isArray(l) && c_.has(String(l.op)) ? o.push(l) : e(`dropped /${i}/${c}: ${JSON.stringify(l)} is not a JSON Patch operation.`);
  });
  try {
    let l = structuredClone(n);
    for (const c of o) l = h_(l, c);
    return l;
  } catch (l) {
    return e(`Failed to apply ${a} patch: ${l.message}; the ${a} is left as it was.`), n;
  }
}
function g_(n = []) {
  const t = new Map(n.map((r) => [r.id, JSON.parse(JSON.stringify(r))])), e = (r) => {
    let i = t.get(r);
    return i || (i = { id: r, name: "subagent", status: "running", messages: [] }, t.set(r, i)), i;
  }, s = (r, i) => {
    for (const a of e(r).messages) {
      if (a.role !== "assistant") continue;
      const o = a.toolCalls?.find((l) => l.id === i);
      if (o) return o;
    }
  };
  return {
    /** Announced (again, by a resumed run: the same invocation going on). */
    start(r, i) {
      const a = e(r);
      Object.assign(a, i), a.status = "running", delete a.interruptIds;
    },
    end(r, i, a) {
      const o = e(r);
      o.status = i, a?.length ? o.interruptIds = a : delete o.interruptIds;
    },
    text(r, i, a) {
      const o = e(r).messages;
      let l = o.find((c) => c.role === "assistant" && c.id === i);
      l || (l = { id: i, role: "assistant", content: "" }, o.push(l)), l.content = (l.content ?? "") + a;
    },
    /** A call joins the assistant message that ends the transcript, as one model step writes text then calls. */
    call(r, i, a) {
      const o = s(r, i);
      if (o) {
        a && (o.function.name = a);
        return;
      }
      const l = e(r).messages, c = l.at(-1);
      let d;
      c?.role === "assistant" ? d = c : (d = { id: `${i}:call`, role: "assistant" }, l.push(d)), d.toolCalls = [...d.toolCalls ?? [], { id: i, type: "function", function: { name: a, arguments: "" } }];
    },
    args(r, i, a) {
      const o = s(r, i);
      o && (o.function.arguments += a);
    },
    result(r, i, a, o) {
      e(r).messages.push({ id: i ?? `${a}:result`, role: "tool", toolCallId: a, content: o });
    },
    /** The run's sub-agents, `tanstack` set on each when the run was TanStack AI's. */
    records(r = !1) {
      return [...t.values()].map((i) => r ? { ...i, tanstack: !0 } : i);
    }
  };
}
function __(n, t = /* @__PURE__ */ new Map()) {
  return n.filter((e) => e.tanstack).flatMap((e) => m_(e.messages, t).map((s, r) => {
    if (s.role !== "assistant" && s.role !== "tool") return s;
    const i = r === 0 ? {
      metadata: {
        tanstack: {
          subagent: {
            name: e.name,
            status: e.status,
            ...e.description !== void 0 ? { description: e.description } : {},
            ...e.parentToolCallId !== void 0 ? { parentToolCallId: e.parentToolCallId } : {},
            ...e.parentSubagentRunId !== void 0 ? { parentSubagentRunId: e.parentSubagentRunId } : {},
            ...e.interruptIds ? { interruptIds: e.interruptIds } : {},
            ...e.metadata ? { metadata: e.metadata } : {}
          }
        }
      }
    } : {};
    return { ...s, subagentRunId: e.id, ...i };
  }));
}
function m_(n, t) {
  if (t.size === 0) return [...n];
  const e = [];
  for (let s = 0; s < n.length; s++) {
    const r = n[s];
    if (e.push(r), !(r.role !== "assistant" || !r.toolCalls?.length)) {
      for (; n[s + 1]?.role === "tool"; ) e.push(n[++s]);
      for (const i of r.toolCalls) {
        const a = t.get(i.id);
        a && e.push(a);
      }
    }
  }
  return e;
}
function b_(n, t) {
  for (let e = 0; e < Math.max(n.length, t.length); e++) {
    const s = (n[e] ?? 0) - (t[e] ?? 0);
    if (s !== 0) return s;
  }
  return 0;
}
function v_(n, t) {
  const e = n !== void 0 && b_(n, [0, 0, 57]) <= 0;
  let s = 0, r, i;
  const a = /* @__PURE__ */ new Set(), o = (l, c) => {
    a.has(l) || (a.add(l), t(c));
  };
  return (l) => {
    switch (l.type) {
      case "THINKING_START":
        return r = `thinking-${++s}`, o("THINKING_START", `translated the retired THINKING_START into REASONING_START${typeof l.title == "string" ? `, dropping its title "${l.title}"` : ""}; the agent should send REASONING_* events.`), [{ type: "REASONING_START", messageId: r }];
      case "THINKING_END": {
        const c = r ?? `thinking-${++s}`;
        return r = void 0, [{ type: "REASONING_END", messageId: c }];
      }
      case "THINKING_TEXT_MESSAGE_START":
        return i = `thinking-message-${++s}`, [{ type: "REASONING_MESSAGE_START", messageId: i, role: "reasoning" }];
      case "THINKING_TEXT_MESSAGE_CONTENT":
        return [{ type: "REASONING_MESSAGE_CONTENT", messageId: i ?? `thinking-message-${s}`, delta: l.delta }];
      case "THINKING_TEXT_MESSAGE_END": {
        const c = i ?? `thinking-message-${s}`;
        return i = void 0, [{ type: "REASONING_MESSAGE_END", messageId: c }];
      }
    }
    if (e) {
      if (l.type.startsWith("SUBAGENT_"))
        return o(l.type, `dropping ${l.type}: the agent's AG-UI version predates subagents (0.0.57 or older).`), [];
      if ("subagentRunId" in l) {
        const { subagentRunId: c, ...d } = l;
        return [d];
      }
    }
    return [l];
  };
}
function ot(n) {
  return new ut(`The agent stream is malformed: ${n}.`, tt.PROVIDER_ERROR, { agUi: "malformed" });
}
const y_ = /* @__PURE__ */ new Set([
  "TEXT_MESSAGE_CONTENT",
  "TEXT_MESSAGE_CHUNK",
  "TOOL_CALL_ARGS",
  "TOOL_CALL_CHUNK",
  "REASONING_MESSAGE_CONTENT",
  "REASONING_MESSAGE_CHUNK"
]), w_ = [
  "messageId",
  "toolCallId",
  "toolCallName",
  "parentMessageId",
  "stepName",
  "subagentRunId",
  "threadId",
  "runId",
  "parentRunId",
  "protocolVersion",
  "name",
  "role",
  "message",
  "code",
  "activityType",
  "entityId",
  "encryptedValue",
  "subtype",
  "description",
  "parentToolCallId",
  "parentSubagentRunId"
], S_ = {
  TEXT_MESSAGE_START: ["messageId"],
  TEXT_MESSAGE_CONTENT: ["messageId", "delta"],
  TEXT_MESSAGE_END: ["messageId"],
  TOOL_CALL_START: ["toolCallId", "toolCallName"],
  TOOL_CALL_ARGS: ["toolCallId", "delta"],
  TOOL_CALL_END: ["toolCallId"],
  TOOL_CALL_RESULT: ["toolCallId"],
  REASONING_START: ["messageId"],
  REASONING_END: ["messageId"],
  REASONING_MESSAGE_START: ["messageId"],
  REASONING_MESSAGE_CONTENT: ["messageId", "delta"],
  REASONING_MESSAGE_END: ["messageId"],
  STEP_STARTED: ["stepName"],
  STEP_FINISHED: ["stepName"],
  SUBAGENT_STARTED: ["subagentRunId"],
  SUBAGENT_FINISHED: ["subagentRunId"],
  SUBAGENT_ERROR: ["subagentRunId"]
}, So = " (TanStack AI frames runs this way: give createAgUiRunner relaxedRunFraming: true to read it)";
function A_(n) {
  let t = !1, e = !1, s;
  const r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), l = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Map(), d = (g) => typeof g.subagentRunId == "string" ? g.subagentRunId : "", h = (g, v) => `${g}\0${v}`, u = () => {
    r.clear(), i.clear(), a.clear(), o.clear(), l.clear(), c.clear();
  }, p = () => [...r.keys()].map((g) => `text message "${g}"`).concat([...i.keys()].map((g) => `reasoning message "${g}"`)).concat([...a.keys()].map((g) => `tool call "${g}"`)).concat([...o].map((g) => `step "${g.split("\0")[1]}"`)).concat([...l].map((g) => `subagent "${g}"`)), f = (g, v, S) => {
    const A = S.subagentRunId;
    if (A === void 0) return;
    const C = v.get(g);
    if (C !== void 0 && C !== A) throw ot(`${S.type} for "${g}" is attributed to "${String(A)}", but "${g}" started attributed to "${String(C)}"`);
  }, _ = ((g) => {
    const v = g.type, S = !t;
    t = !0;
    for (const b of S_[v] ?? []) if (g[b] === void 0) throw ot(`${v} needs "${b}"`);
    for (const b of w_) if (b in g && g[b] !== void 0 && typeof g[b] != "string") throw ot(`"${b}" must be a string on ${v}`);
    if (y_.has(v) && "delta" in g && typeof g.delta != "string") throw ot(`"delta" must be a string on ${v}`);
    if (v === "RUN_STARTED") {
      if (e && !n) throw ot("RUN_STARTED while a run is still active");
      e = !0, s = void 0, u();
      return;
    }
    if (!n) {
      if (S && v !== "RUN_ERROR") throw ot(`the first event must be RUN_STARTED, not ${v}${So}`);
      if (s === "finished" && v !== "RUN_ERROR") throw ot(`${v} after the run finished${So}`);
      if (s === "error") throw ot(`${v} after the run ended with RUN_ERROR`);
    }
    if (v === "RUN_ERROR") {
      e = !1, s !== "finished" && (s = "error"), u();
      return;
    }
    const A = d(g), C = c.get(A);
    switch (C && v !== C.type && v !== "RAW" && c.delete(A), (v === "SUBAGENT_FINISHED" || v === "SUBAGENT_ERROR") && c.delete(String(g.subagentRunId)), v) {
      case "TEXT_MESSAGE_START":
        r.set(String(g.messageId), g.subagentRunId);
        break;
      case "TEXT_MESSAGE_CONTENT":
      case "TEXT_MESSAGE_END": {
        const b = String(g.messageId);
        if (!r.has(b)) throw ot(`${v} for "${b}", but no open text message has that id`);
        f(b, r, g), v === "TEXT_MESSAGE_END" && r.delete(b);
        break;
      }
      case "TEXT_MESSAGE_CHUNK":
      case "REASONING_MESSAGE_CHUNK": {
        const b = typeof g.messageId == "string" ? g.messageId : void 0, y = typeof g.role == "string" ? g.role : void 0, E = c.get(A);
        if (!E || b !== void 0 && b !== E.id) {
          if (b === void 0) throw ot(`the first ${v} of a stream needs a messageId`);
          c.set(A, { type: v, id: b, ...y !== void 0 ? { label: y } : {} });
        } else if (y !== void 0 && E.label !== void 0 && y !== E.label)
          throw ot(`${v} changes its role from "${E.label}" to "${y}" in the middle of message "${E.id}"`);
        break;
      }
      case "TOOL_CALL_CHUNK": {
        const b = typeof g.toolCallId == "string" ? g.toolCallId : void 0, y = typeof g.toolCallName == "string" ? g.toolCallName : void 0, E = c.get(A);
        if (!E || b !== void 0 && b !== E.id) {
          if (b === void 0 || y === void 0) throw ot("the first TOOL_CALL_CHUNK of a call needs a toolCallId and a toolCallName");
          c.set(A, { type: v, id: b, label: y });
        } else if (y !== void 0 && y !== E.label)
          throw ot(`TOOL_CALL_CHUNK changes its toolCallName from "${E.label}" to "${y}" in the middle of call "${E.id}"`);
        break;
      }
      case "TOOL_CALL_START":
        a.set(String(g.toolCallId), g.subagentRunId);
        break;
      case "TOOL_CALL_ARGS":
      case "TOOL_CALL_END": {
        const b = String(g.toolCallId);
        if (!a.has(b)) throw ot(`${v} for "${b}", but no open tool call has that id`);
        f(b, a, g), v === "TOOL_CALL_END" && a.delete(b);
        break;
      }
      case "REASONING_MESSAGE_START": {
        const b = String(g.messageId);
        if (g.role !== void 0 && g.role !== "reasoning")
          throw ot(`REASONING_MESSAGE_START "${b}" has the role "${String(g.role)}", where only role "reasoning" is allowed`);
        i.set(b, g.subagentRunId);
        break;
      }
      case "REASONING_MESSAGE_CONTENT":
      case "REASONING_MESSAGE_END": {
        const b = String(g.messageId);
        if (!i.has(b)) throw ot(`${v} for "${b}", but no open reasoning message has that id`);
        f(b, i, g), v === "REASONING_MESSAGE_END" && i.delete(b);
        break;
      }
      case "STEP_STARTED":
        o.add(h(A, String(g.stepName)));
        break;
      case "STEP_FINISHED": {
        const b = h(A, String(g.stepName));
        if (!o.has(b)) throw ot(`STEP_FINISHED for step "${String(g.stepName)}", which was not started${A ? ` by "${A}"` : ""}`);
        o.delete(b);
        break;
      }
      case "SUBAGENT_STARTED": {
        const b = String(g.subagentRunId);
        if (typeof g.name != "string" || !g.name) throw ot(`SUBAGENT_STARTED "${b}" needs a name`);
        l.add(b);
        break;
      }
      case "SUBAGENT_FINISHED":
      case "SUBAGENT_ERROR": {
        const b = String(g.subagentRunId);
        if (!l.has(b)) throw ot(`${v} for subagent "${b}", which was not started`);
        l.delete(b);
        break;
      }
      case "RUN_FINISHED": {
        const b = g.outcome;
        if (b !== void 0 && (typeof b != "object" || b === null || Array.isArray(b)))
          throw ot("RUN_FINISHED.outcome must be an object");
        if (!n) {
          const y = p();
          if (y.length) throw ot(`${y.join(", ")} still running at RUN_FINISHED`);
          s = "finished";
        }
        c.clear(), e = !1;
        break;
      }
    }
  });
  return _.end = () => {
    if (!n) return;
    const g = p();
    if (g.length) throw ot(`${g.join(", ")} still running at the end of the stream`);
  }, _;
}
async function* k_(n, t) {
  const e = !!(t && /ndjson|jsonl/i.test(t)), s = n.getReader(), r = new TextDecoder();
  let i = "", a = [];
  const o = (d) => {
    const h = d.trim();
    if (!(!h || h === "[DONE]"))
      try {
        const u = JSON.parse(h);
        return u && typeof u == "object" && typeof u.type == "string" ? u : void 0;
      } catch {
        return;
      }
  }, l = () => {
    const d = o(a.join(`
`));
    return a = [], d;
  }, c = (d) => {
    const h = d.endsWith("\r") ? d.slice(0, -1) : d;
    if (e) return o(h);
    if (h === "") return l();
    h.startsWith("data:") && a.push(h.slice(5).replace(/^ /, ""));
  };
  try {
    for (; ; ) {
      const { done: d, value: h } = await s.read();
      if (d) break;
      i += r.decode(h, { stream: !0 });
      let u;
      for (; (u = i.indexOf(`
`)) !== -1; ) {
        const p = c(i.slice(0, u));
        i = i.slice(u + 1), p && (yield p);
      }
    }
    if (i += r.decode(), i) {
      const d = c(i);
      d && (yield d);
    }
    if (!e) {
      const d = l();
      d && (yield d);
    }
  } finally {
    s.releaseLock();
  }
}
const je = "1.0";
function Qs(n) {
  return /^\d+(\.\d+)*$/.test(n) ? n.split(".").map(Number) : void 0;
}
function Zs(n, t) {
  for (let e = 0; e < Math.max(n.length, t.length); e++) {
    const s = (n[e] ?? 0) - (t[e] ?? 0);
    if (s !== 0) return s;
  }
  return 0;
}
function E_(n) {
  if (n)
    try {
      const t = JSON.parse(n);
      return t && t.v === 1 && typeof t.threadId == "string" && typeof t.runId == "string" && Array.isArray(t.interrupts) ? t : void 0;
    } catch {
      return;
    }
}
const lt = "";
function dt(n) {
  return n ? { agentId: n } : {};
}
function C_(n) {
  const e = n.metadata?.tanstack?.subagentPlan?.steps;
  if (!Array.isArray(e)) return;
  const s = e.map((r) => Array.isArray(r?.names) ? r.names.filter((i) => typeof i == "string" && i !== "") : []).filter((r) => r.length > 0);
  return s.length ? s : void 0;
}
function x_(n) {
  if (n.reason === "tool_call" || n.reason === "confirmation" || n.reason === "approval_required") return "approval";
  if (/client_tool/.test(n.reason)) return "external";
}
function Ao(n, t = "last") {
  const e = (Array.isArray(n) ? n : n && typeof n == "object" ? [n] : []).filter((a) => !!a && typeof a == "object"), s = t === "first" ? e[0] : e.at(-1);
  if (!s) return;
  const r = (a) => typeof s[a] == "number" ? s[a] : 0, i = r("cachedInputTokens");
  return {
    inputTokens: r("inputTokens"),
    outputTokens: r("outputTokens"),
    totalTokens: r("totalTokens") || void 0,
    ...i ? { cacheReadTokens: i } : {}
  };
}
function ko(n) {
  if (!n.trim()) return {};
  try {
    return JSON.parse(n);
  } catch {
    return { arguments: n };
  }
}
function Eo(n) {
  if (typeof n == "string") return n;
  if (n == null) return "";
  if (Array.isArray(n)) {
    const t = n.filter((e) => e?.type === "text" && typeof e.text == "string").map((e) => e.text);
    if (t.length) return t.join(`
`);
  }
  return JSON.stringify(n);
}
function Kc(n) {
  return Zl(n).reason;
}
function T_(n, t) {
  if (!t) return { interruptId: n.id, status: "cancelled" };
  if (t.kind === "decision" && n.kind === "external" && !t.approved)
    return {
      interruptId: n.id,
      status: "resolved",
      payload: { error: Kc(t) },
      metadata: { tanstack: { state: "output-error" } }
    };
  if (t.kind === "decision") {
    const e = !t.approved && t.instruction ? { instruction: t.instruction } : {};
    return { interruptId: n.id, status: "resolved", payload: { approved: t.approved, ...e } };
  }
  return t.kind === "failed" ? {
    interruptId: n.id,
    status: "resolved",
    payload: { error: t.error },
    metadata: { tanstack: { state: "output-error" } }
  } : {
    interruptId: n.id,
    status: "resolved",
    payload: t.structuredContent !== void 0 ? t.structuredContent : t.content
  };
}
function I_(n) {
  const t = n.onWarning ?? ((c) => console.warn(`[aparte] AG-UI: ${c}`)), e = n.peerProtocolVersion ? Qs(n.peerProtocolVersion) : void 0, s = !e || Zs(e, [1, 0]) >= 0, r = e !== void 0 && Zs(e, [0, 0, 39]) <= 0, i = /* @__PURE__ */ new Map(), a = n.threadId !== void 0, o = /* @__PURE__ */ new Map(), l = async (c, d) => {
    const h = n.fetch ?? fetch, u = typeof n.headers == "function" ? await n.headers() : n.headers ?? {}, p = c.baseRequest, f = E_(c.deferral?.token), _ = c.deferral?.outcomes ?? {}, g = f?.threadId ?? (typeof n.threadId == "function" ? n.threadId(c) : n.threadId) ?? `aparte-${pt()}`;
    d.threadId = g;
    const v = `aparte-run-${pt()}`, S = new Set((f?.interrupts ?? []).map((m) => m.toolCallId)), A = e_(p.messages, r, t), C = Array.isArray(f?.subagents) ? f.subagents : [], b = new Set(C.filter((m) => m.tanstack).map((m) => m.id)), y = /* @__PURE__ */ new Map();
    for (const [m, T] of Object.entries(_)) {
      if (S.has(m) || T.kind === "decision" && T.approved) continue;
      const F = {
        id: `aparte-result-${m}`,
        role: "tool",
        toolCallId: m,
        content: T.kind === "failed" ? `Error: ${T.error}` : T.kind === "decision" ? Kc(T) : T.content
      }, k = f?.agents?.[m];
      k !== void 0 && b.has(k) ? y.set(m, F) : A.push(F);
    }
    A.push(...__(C, y));
    const E = f ? [] : o.get(g) ?? [];
    o.delete(g);
    const R = f?.interrupts.length ? f.interrupts.map((m) => T_(m, m.kind === "unanswerable" ? void 0 : _[m.toolCallId])) : E.length ? E.map((m) => ({ interruptId: m, status: "cancelled" })) : void 0, w = {
      threadId: g,
      runId: v,
      ...s ? { protocolVersion: je } : {},
      ...f ? { parentRunId: f.runId } : {},
      state: i.has(g) ? i.get(g) : {},
      messages: A,
      tools: n_(p.tools),
      context: n.context ?? [],
      forwardedProps: n.forwardedProps ?? {},
      ...R ? { resume: R } : {}
    }, I = await h(n.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...u },
      body: JSON.stringify(w),
      signal: c.signal,
      ...n.credentials ? { credentials: n.credentials } : {}
    });
    if (!I.ok || !I.body) {
      const m = await I.text().catch(() => "");
      throw new ut(
        m.trim().slice(0, 300) || `The agent endpoint answered HTTP ${I.status}.`,
        ut.codeForStatus(I.status) ?? tt.PROVIDER_ERROR,
        void 0,
        void 0,
        I.status
      );
    }
    const O = new Map(p.messages.flatMap((m) => (m.toolCalls ?? []).map((T) => [T.id, { name: T.name, input: T.input ?? {} }]))), N = new Set(O.keys()), G = new Set((p.tools ?? []).map((m) => m.name)), B = /* @__PURE__ */ new Map(), j = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Set(), P = /* @__PURE__ */ new Set(), W = /* @__PURE__ */ new Set();
    let U, nt, Y;
    const K = c.emitter, it = /* @__PURE__ */ new Map(), ht = (m) => {
      let T = it.get(m);
      return T || (T = { textOpen: !1, stepEnded: !1 }, it.set(m, T)), T;
    }, ct = /* @__PURE__ */ new Map(), _e = /* @__PURE__ */ new Map(), te = /* @__PURE__ */ new Map(), me = new Map(Object.entries(f?.agents ?? {}).filter((m) => typeof m[1] == "string")), V = /* @__PURE__ */ new Map(), H = g_(C);
    let xt = !1, J = !1;
    const qt = (m) => typeof m.subagentRunId == "string" ? m.subagentRunId : void 0, wt = (m) => {
      let T = typeof m.messageId == "string" ? m.messageId : void 0;
      if (m.type.endsWith("_CHUNK")) {
        const L = `${m.type}\0${qt(m) ?? lt}`;
        T !== void 0 ? _e.set(L, T) : T = _e.get(L);
      }
      const F = T !== void 0 ? ct.get(T) : void 0;
      if (F !== void 0) return F;
      const k = qt(m) ?? lt;
      return T !== void 0 && ct.set(T, k), k;
    }, Ne = (m) => qt(m) ?? (typeof m.parentMessageId == "string" ? ct.get(m.parentMessageId) : void 0) ?? lt, vi = (m) => B.get(m)?.owner ?? me.get(m), Kt = (m) => {
      const T = it.get(m);
      T?.textOpen && (K({ type: "text-flush", ...dt(m) }), T.textOpen = !1);
    }, vd = (m) => {
      V.has(m) || (V.set(m, { open: !0 }), K({ type: "agent-start", agentId: m }));
    }, Vt = [], _s = (m) => {
      for (let T = Vt.length - 1; T >= 0; T -= 1) {
        const F = Vt[T];
        m !== void 0 && F.owner !== m || (Vt.splice(T, 1), K({ type: "step-end", name: F.name, ...dt(F.owner) }));
      }
    };
    d.closeSteps = _s;
    const ms = /* @__PURE__ */ new Map(), bs = (m, T) => {
      ms.set(m, T), K({ type: "activity", id: m, activityType: T.activityType, content: T.content, ...dt(T.owner) });
    }, be = f?.plan;
    let St = be && Array.isArray(be.steps) ? { steps: be.steps, status: new Map(Object.entries(be.status ?? {})) } : void 0;
    const yi = typeof be?.id == "string" ? be.id : `router-plan:${v}`, wi = (m, T) => {
      const F = m === void 0 ? -1 : St?.steps.findIndex((L) => L.includes(m)) ?? -1;
      if (!St || F < 0) return;
      if (T === "in-progress")
        for (const L of St.steps.slice(0, F).flat()) St.status.get(L) !== "failed" && St.status.set(L, "done");
      St.status.set(m, T);
      const k = St.steps.flat().map((L) => ({ title: L, status: St.status.get(L) ?? "pending" }));
      bs(yi, { activityType: "plan", content: { steps: k }, owner: lt });
    }, Pe = (m, T, F = {}) => {
      _s(m);
      const k = V.get(m);
      k && (k.open = !1), K({ type: "agent-end", agentId: m, status: T, ...F, ...k?.parent ? { parentAgentId: k.parent } : {} }), k && !k.parent && wi(k.name, T === "waiting" ? "blocked" : T);
    }, Si = (m) => {
      for (const [T, F] of [...V].reverse())
        F.open && (Kt(T), Pe(T, "failed", { error: m }));
    }, De = (m) => {
      const T = B.get(m);
      if (!T || j.has(m) || N.has(m)) return;
      const F = ko(T.args);
      j.set(m, { name: T.name, input: F, owner: T.owner }), Kt(T.owner), K({ type: "tool-start", toolCallId: m, name: T.name, input: F, ...dt(T.owner) }), ht(T.owner).stepEnded = !0;
    }, vs = (m) => {
      const T = ht(m);
      T.stepEnded && (T.stepEnded = !1, Kt(m), K({ type: "turn-start", ...dt(m) }));
    }, yd = (m) => {
      const T = j.get(m.toolCallId) ?? O.get(m.toolCallId);
      if (T) return T;
      const F = B.get(m.toolCallId);
      if (F) return { name: F.name, input: ko(F.args) };
      const k = m.metadata;
      return { name: typeof k?.toolName == "string" ? k.toolName : "", input: k?.input ?? {} };
    };
    let ys = !1, Ai = !1;
    const wd = () => {
      if (!Ai) {
        Ai = !0, K({ type: "run-start" }), K({ type: "turn-start" });
        for (const [m, T] of Object.entries(_)) {
          const F = me.get(m) ?? lt;
          if (F && (ht(F).stepEnded = !0), T.kind === "result") {
            K({
              type: "tool-resolved",
              toolCallId: m,
              result: T.content,
              ...T.structuredContent !== void 0 ? { structuredResult: T.structuredContent } : {},
              ...dt(F)
            }), W.add(m);
            continue;
          }
          if (T.kind === "failed") {
            K({ type: "tool-failed", toolCallId: m, error: T.error, ...dt(F) }), W.add(m);
            continue;
          }
          T.approved ? K({ type: "tool-approved", toolCallId: m, ...dt(F) }) : (K({ type: "tool-rejected", toolCallId: m, ...Zl(T), ...dt(F) }), P.add(m));
        }
      }
    }, ki = A_(!s || n.relaxedRunFraming === !0), Sd = v_(e, t);
    async function* Ad(m, T) {
      for await (const F of k_(m, T))
        for (const k of Sd(F)) {
          const L = l_(k, t);
          L && (yield L);
        }
    }
    for await (const m of Ad(I.body, I.headers.get("content-type"))) {
      ki(m), wd(), /^(TEXT_MESSAGE|REASONING|TOOL_CALL)_/.test(m.type) && (ys = !1);
      const T = qt(m);
      T !== void 0 && !m.type.startsWith("SUBAGENT_") && vd(T);
      const F = m.metadata;
      switch (F && typeof F == "object" && typeof F.tanstack == "object" && (xt = !0), m.type) {
        case "RUN_STARTED": {
          if (U) {
            t(`the agent's run failed ("${U.message}") and the stream ran it again; the reply shows the new run.`);
            for (const [L, Z] of j)
              x.has(L) || (K({ type: "tool-aborted", toolCallId: L, ...dt(Z.owner) }), x.add(L));
            Si(U.message), U = void 0;
          }
          const k = m.protocolVersion;
          if (typeof k == "string") {
            const L = Qs(k);
            L ? Zs(L, Qs(je)) > 0 && t(`the agent speaks AG-UI ${k}, newer than the ${je} this runner speaks; reading its stream as ${je}.`) : t(`the agent declares protocol version "${k}", which this runner cannot interpret; reading its stream as ${je}.`);
          }
          break;
        }
        case "TEXT_MESSAGE_START":
        case "REASONING_START":
        case "REASONING_MESSAGE_START": {
          const k = wt(m);
          k === lt && (J = !0), vs(k);
          break;
        }
        case "TEXT_MESSAGE_CONTENT":
        case "TEXT_MESSAGE_CHUNK": {
          const k = wt(m), L = typeof m.delta == "string" ? m.delta : "";
          k === lt && (J = !0), L && (vs(k), K({ type: "text-delta", delta: L, ...dt(k) }), ht(k).textOpen = !0);
          const Z = typeof m.messageId == "string" ? m.messageId : _e.get(`${m.type}\0${T ?? lt}`);
          k !== lt && L && Z !== void 0 && H.text(k, Z, L);
          break;
        }
        case "TEXT_MESSAGE_END":
          Kt(wt(m));
          break;
        case "REASONING_MESSAGE_CONTENT":
        case "REASONING_MESSAGE_CHUNK": {
          const k = wt(m), L = typeof m.delta == "string" ? m.delta : "";
          L && (vs(k), K({ type: "thinking-delta", delta: L, ...dt(k) }));
          break;
        }
        case "TOOL_CALL_START": {
          const k = String(m.toolCallId);
          B.has(k) || te.set(T ?? lt, k);
          const L = Ne(m), Z = String(m.toolCallName ?? "");
          B.set(k, { name: Z, args: "", owner: L }), L === lt ? J = !0 : H.call(L, k, Z);
          break;
        }
        case "TOOL_CALL_ARGS": {
          const k = String(m.toolCallId), L = B.get(k);
          L && typeof m.delta == "string" && (L.args += m.delta, L.owner !== lt && H.args(L.owner, k, m.delta));
          break;
        }
        case "TOOL_CALL_CHUNK": {
          const k = typeof m.toolCallId == "string" ? m.toolCallId : te.get(T ?? lt);
          if (!k) break;
          let L = B.get(k);
          L || (L = { name: "", args: "", owner: Ne(m) }, B.set(k, L), te.set(T ?? lt, k)), typeof m.toolCallName == "string" && m.toolCallName && (L.name = m.toolCallName), typeof m.delta == "string" && (L.args += m.delta), L.owner === lt ? J = !0 : (H.call(L.owner, k, L.name), typeof m.delta == "string" && H.args(L.owner, k, m.delta));
          break;
        }
        case "TOOL_CALL_END": {
          De(String(m.toolCallId));
          break;
        }
        case "TOOL_CALL_RESULT": {
          const k = String(m.toolCallId);
          if (De(k), P.has(k) || W.has(k)) break;
          x.add(k);
          const L = vi(k) ?? T ?? lt, Z = Eo(m.content);
          if (L !== lt && H.result(L, typeof m.messageId == "string" ? m.messageId : void 0, k, Z), m.metadata?.tanstack?.state === "output-error")
            K({ type: "tool-failed", toolCallId: k, error: Z, ...dt(L) });
          else {
            const ye = Array.isArray(m.content) ? { structuredResult: m.content } : {};
            K({ type: "tool-resolved", toolCallId: k, result: Z, ...ye, ...dt(L) });
          }
          break;
        }
        case "SUBAGENT_STARTED": {
          const k = String(m.subagentRunId), L = typeof m.parentToolCallId == "string" ? m.parentToolCallId : void 0, Z = typeof m.parentSubagentRunId == "string" ? m.parentSubagentRunId : void 0;
          L && De(L);
          const Ft = String(m.name);
          V.set(k, { open: !0, name: Ft, ...Z ? { parent: Z } : {} });
          const ye = m.metadata;
          if (H.start(k, {
            name: Ft,
            ...typeof m.description == "string" ? { description: m.description } : {},
            ...L ? { parentToolCallId: L } : {},
            ...Z ? { parentSubagentRunId: Z } : {},
            ...ye && typeof ye == "object" && !Array.isArray(ye) ? { metadata: ye } : {}
          }), !Z) {
            if (!St) {
              const Ci = C_(m);
              Ci && (St = { steps: Ci, status: /* @__PURE__ */ new Map() });
            }
            wi(Ft, "in-progress");
          }
          K({
            type: "agent-start",
            agentId: k,
            name: Ft,
            ...typeof m.description == "string" ? { description: m.description } : {},
            ...L ? { toolCallId: L } : {},
            ...Z ? { parentAgentId: Z } : {}
          });
          break;
        }
        case "SUBAGENT_FINISHED":
        case "SUBAGENT_ERROR": {
          const k = String(m.subagentRunId);
          Kt(k);
          for (const [Z, Ft] of B) Ft.owner === k && De(Z);
          const L = m.outcome;
          if (m.type === "SUBAGENT_ERROR")
            H.end(k, "error"), Pe(k, "failed", { error: typeof m.message == "string" && m.message ? m.message : "The sub-agent failed." });
          else if (L?.type === "suspended") {
            const Z = Array.isArray(L.interruptIds) ? L.interruptIds.filter((Ft) => typeof Ft == "string") : [];
            H.end(k, "suspended", Z), Pe(k, "waiting");
          } else
            H.end(k, "finished"), Pe(k, "done", m.result !== void 0 ? { result: Eo(m.result) } : {});
          break;
        }
        case "RUN_ERROR": {
          U = new ut(
            typeof m.message == "string" && m.message ? m.message : "The agent run failed.",
            tt.PROVIDER_ERROR,
            { agUi: "run-error", ...typeof m.code == "string" ? { code: m.code } : {} }
          );
          break;
        }
        // State is run-scoped in AG-UI 1.0: a sub-agent's STATE_* updates the run's state
        // exactly as the parent's does — its `subagentRunId` is provenance, and the
        // protocol forbids withholding the update because a sub-agent sent it.
        case "STATE_SNAPSHOT":
          i.set(g, m.snapshot);
          break;
        case "STATE_DELTA":
          i.set(g, p_(i.has(g) ? i.get(g) : {}, m.delta, t));
          break;
        case "RUN_FINISHED": {
          for (const k of B.keys()) De(k);
          for (const k of it.keys()) Kt(k);
          V.size === 0 ? nt = Ao(m.usage) ?? nt : J && (nt = Ao(m.usage, "first") ?? nt), J = !1, ht(lt).stepEnded = !0;
          for (const k of it.values()) k.stepEnded = !0;
          ys = !0, Y = {
            runId: typeof m.runId == "string" ? m.runId : v,
            outcome: m.outcome
          };
          break;
        }
        // A step is a name with a start and an end, its owner's: shown while it lasts
        // (the waiting indicator, a sub-agent's line). Steps may nest and overlap, and
        // one ends the latest open step of its name under the same owner.
        case "STEP_STARTED": {
          const k = T ?? lt, L = String(m.stepName ?? "");
          Vt.push({ owner: k, name: L }), K({ type: "step-start", name: L, ...dt(k) });
          break;
        }
        case "STEP_FINISHED": {
          const k = T ?? lt, L = String(m.stepName ?? "");
          for (let Z = Vt.length - 1; Z >= 0; Z -= 1)
            if (!(Vt[Z].owner !== k || Vt[Z].name !== L)) {
              Vt.splice(Z, 1), K({ type: "step-end", name: L, ...dt(k) });
              break;
            }
          break;
        }
        // An activity is structured progress, drawn by the renderer the app registered for
        // its type. A snapshot overwrites it unless it says `replace: false` (AG-UI 1.0:
        // "only an explicit false asks a consumer to leave what is already there") — its
        // type included; a delta patches what is held. Either way the page gets it whole.
        case "ACTIVITY_SNAPSHOT": {
          const k = String(m.messageId ?? ""), L = ms.get(k);
          if (L && m.replace === !1) break;
          bs(k, { activityType: String(m.activityType ?? ""), content: m.content, owner: L?.owner ?? T ?? lt });
          break;
        }
        case "ACTIVITY_DELTA": {
          const k = String(m.messageId ?? ""), L = ms.get(k);
          if (!L) {
            t(`ACTIVITY_DELTA for "${k}", an activity no ACTIVITY_SNAPSHOT created: skipped.`);
            break;
          }
          const Z = f_(L.content, m.patch, t);
          Z !== L.content && bs(k, { ...L, content: Z });
          break;
        }
      }
    }
    if (_s(), c.signal.aborted) return nt;
    if (U) {
      for (const [m, T] of j) x.has(m) || K({ type: "tool-aborted", toolCallId: m, ...dt(T.owner) });
      for (const m of it.keys()) Kt(m);
      throw Si(U.message), U;
    }
    if (!Y)
      throw new ut("The agent stream ended without RUN_FINISHED.", tt.PROVIDER_ERROR);
    if (!ys)
      throw new ut("The agent stream was cut: it ended in the middle of a step, after a RUN_FINISHED.", tt.PROVIDER_ERROR);
    ki.end();
    for (const m of it.keys()) Kt(m);
    const ve = [], Ei = [], yn = [];
    if (Y.outcome?.type === "interrupt")
      for (const m of Y.outcome.interrupts ?? []) {
        const T = x_(m);
        if (!T || !m.toolCallId) {
          yn.push(m.id);
          continue;
        }
        const F = yd(m), k = m.subagentRunId ?? vi(m.toolCallId) ?? lt;
        T === "approval" && K({ type: "tool-awaiting-approval", toolCallId: m.toolCallId, name: F.name, input: F.input, ...dt(k) }), Ei.push({ id: m.id, toolCallId: m.toolCallId, kind: T }), ve.push({ toolCallId: m.toolCallId, name: F.name, input: F.input, reason: T, ...dt(k) });
      }
    else {
      const m = Y.outcome, T = Array.isArray(m?.pendingToolCallIds) ? new Set(m.pendingToolCallIds.filter((F) => typeof F == "string")) : void 0;
      for (const [F, k] of j) {
        if (x.has(F)) continue;
        m?.type !== "cancelled" && (T ? T.has(F) : G.has(k.name)) ? ve.push({ toolCallId: F, name: k.name, input: k.input, reason: "external", ...dt(k.owner) }) : K({ type: "tool-aborted", toolCallId: F, ...dt(k.owner) });
      }
    }
    for (const [m, T] of [...V].reverse())
      T.open && Pe(m, ve.some((F) => F.agentId === m) ? "waiting" : "done");
    if (ve.length > 0) {
      const m = yn.map((k) => ({ id: k, toolCallId: "", kind: "unanswerable" })), T = ve.filter((k) => k.agentId).map((k) => [k.toolCallId, k.agentId]), F = {
        v: 1,
        threadId: g,
        runId: Y.runId,
        interrupts: [...Ei, ...m],
        ...T.length ? { agents: Object.fromEntries(T) } : {},
        ...H.records().length ? { subagents: H.records(xt) } : {},
        ...St ? { plan: { id: yi, steps: St.steps, status: Object.fromEntries(St.status) } } : {}
      };
      d.suspended = !0, K({ type: "run-suspended", pending: ve, ...nt ? { usage: nt } : {}, ticket: JSON.stringify(F) });
    } else
      yn.length && a && o.set(g, yn), K({ type: "run-done", ...nt ? { usage: nt } : {} });
    return nt;
  };
  return async (c) => {
    const d = { suspended: !1 };
    try {
      return await l(c, d);
    } finally {
      d.threadId && !a && !d.suspended && i.delete(d.threadId), d.closeSteps?.();
    }
  };
}
function ii() {
  return { async: !1, breaks: !1, extensions: null, gfm: !0, hooks: null, pedantic: !1, renderer: null, silent: !1, tokenizer: null, walkTokens: null };
}
var fe = ii();
function Vc(n) {
  fe = n;
}
var ae = { exec: () => null };
function re(n) {
  let t = [];
  return (e) => {
    let s = Math.max(0, Math.min(3, e - 1)), r = t[s];
    return r || (r = n(s), t[s] = r), r;
  };
}
function z(n, t = "") {
  let e = typeof n == "string" ? n : n.source, s = { replace: (r, i) => {
    let a = typeof i == "string" ? i : i.source;
    return a = a.replace(ft.caret, "$1"), e = e.replace(r, a), s;
  }, getRegex: () => new RegExp(e, t) };
  return s;
}
var Xc = ((n = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + n);
  } catch {
    return !1;
  }
})(), ft = { codeRemoveIndent: /^(?: {0,3}\t| {1,4})/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, endingSpaceTabChar: /[ \t]$/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, leadingSpaceTab: /^[ \t]+/, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, blockquoteMarkerWhitespace: /^( {0,3}>)([ \t]+)/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\][ \t]+\S/, listReplaceTask: /^\[[ xX]\][ \t]+/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, numericCharacterReference: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/, numericCharacterReferenceOrAmpersand: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (n) => new RegExp(`^( {0,3}${n})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: re((n) => new RegExp(`^ {0,${n}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: re((n) => new RegExp(`^ {0,${n}}((?:-[ 	]*){3,}|(?:_[ 	]*){3,}|(?:\\*[ 	]*){3,})(?:\\n+|$)`)), fencesBeginRegex: re((n) => new RegExp(`^ {0,${n}}(?:\`\`\`|~~~)`)), headingBeginRegex: re((n) => new RegExp(`^ {0,${n}}#{1,6}(?:\\s|$)`)), pedanticHeadingBeginRegex: re((n) => new RegExp(`^ {0,${n}}#`)), htmlBeginRegex: re((n) => new RegExp(`^ {0,${n}}(?:</?(?:${bn})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, "i")), blockquoteBeginRegex: re((n) => new RegExp(`^ {0,${n}}>`)) }, R_ = /^(?:[ \t]*(?:\n|$))+/, L_ = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/, M_ = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/, mn = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/, O_ = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/, ai = / {0,3}(?:[*+-]|\d{1,9}[.)])/, Yc = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |fences|blockquote|heading|hr|html|table))+?)\n {0,3}(=+|-+)[ \t]*(?:\n+|$)/, Qc = z(Yc).replace(/bull/g, ai).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex(), $_ = z(Yc).replace(/bull/g, ai).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(), oi = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/, N_ = /^[^\n]+/, li = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+/, P_ = z(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", li).replace("title", /(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\))/).getRegex(), D_ = z(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, ai).getRegex(), bn = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul", ci = /<!--(?:-?>|[\s\S]*?(?:-->|$))/, H_ = z("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?:[ \\t]+|\\n|/?>|$)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", ci).replace("tag", bn).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(), Zc = (n) => z(oi).replace("hr", mn).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", n).replace("html", " {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)").replace("tag", bn).getRegex(), B_ = Zc(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/), q_ = Zc(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/), F_ = z(/^( {0,3}> ?(?:(?![ \t]*(?:\n|$))(paragraph)|[^\n]*)(?:\n|$))+/).replace("paragraph", q_).getRegex(), di = { blockquote: F_, code: L_, def: P_, fences: M_, heading: O_, hr: mn, html: H_, lheading: Qc, list: D_, newline: R_, paragraph: B_, table: ae, text: N_ }, Co = z("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", mn).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", " {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)").replace("tag", bn).getRegex(), U_ = { ...di, lheading: $_, table: Co, paragraph: z(oi).replace("hr", mn).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", Co).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", " {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)").replace("tag", bn).getRegex() }, W_ = { ...di, html: z(`^ *(?:comment(?: *\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1>(?: *\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?>(?: *\\n{2,}|\\s*$))`).replace("comment", ci).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: ae, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: z(oi).replace("hr", mn).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", Qc).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() }, z_ = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/, G_ = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/, Jc = /^( {2,}|\\)\n(?!\s*$)[ \t]*/, j_ = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/, Bt = /[\p{P}\p{S}]/u, Oe = /[\s\p{P}\p{S}]/u, vn = /[^\s\p{P}\p{S}]/u, K_ = z(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, Oe).getRegex(), V_ = /[\p{Pi}\p{Ps}"']/u, td = /(?!~)[\p{P}\p{S}]/u, X_ = /(?!~)[\s\p{P}\p{S}]/u, Y_ = /(?:[^\s\p{P}\p{S}]|~)/u, Q_ = z(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Xc ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex(), ed = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/, Z_ = z(ed, "u").replace(/punct/g, Bt).getRegex(), J_ = z(ed, "u").replace(/punct/g, td).getRegex(), tm = /^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/, em = z(tm, "u").replace(/openQuote/g, V_).replace(/punct/g, Bt).getRegex(), nd = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)", nm = z(nd, "gu").replace(/notPunctSpace/g, vn).replace(/punctSpace/g, Oe).replace(/punct/g, Bt).getRegex(), sm = z(nd, "gu").replace(/notPunctSpace/g, Y_).replace(/punctSpace/g, X_).replace(/punct/g, td).getRegex(), rm = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)[\\s](\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)", im = z(rm, "gu").replace(/notPunctSpace/g, vn).replace(/punctSpace/g, Oe).replace(/punct/g, Bt).getRegex(), am = z("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, vn).replace(/punctSpace/g, Oe).replace(/punct/g, Bt).getRegex(), om = "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)[\\s](_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)", lm = z(om, "gu").replace(/notPunctSpace/g, vn).replace(/punctSpace/g, Oe).replace(/punct/g, Bt).getRegex(), cm = z(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, Bt).getRegex(), dm = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", um = z(dm, "gu").replace(/notPunctSpace/g, vn).replace(/punctSpace/g, Oe).replace(/punct/g, Bt).getRegex(), hm = z(/\\(punct)/, "gu").replace(/punct/g, Bt).getRegex(), pm = z(/(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\(punct)/, "gu").replace(/punct/g, Bt).getRegex(), fm = z(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(), gm = z(ci).replace("(?:-->|$)", "-->").getRegex(), _m = z("^comment|^</[a-zA-Z][a-zA-Z0-9-]*\\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", gm).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(), sd = /\[(?:\\[\s\S]|[^\[\]\\])*\]/, ts = z(/(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/).replace("brackets", sd).getRegex(), mm = z(/^!?\[(label)\]\([ \t\n]*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?[ \t\n]*\)/).replace("label", ts).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^)\\])*\)/).getRegex(), bm = z(/^!?\[(label)\]\[(ref)\]/).replace("label", ts).replace("ref", li).getRegex(), vm = z(/^!?\[(ref)\](?:\[\])?/).replace("ref", li).getRegex(), xo = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999}/, ym = z(/(?:[^\[\]\\`]*(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?/).replace("brackets", sd).getRegex(), wm = z("reflink|nolink(?!\\()", "g").replace("reflink", z(/^!?\[(label)\]\[(ref)\]/).replace("label", ym).replace("ref", xo).getRegex()).replace("nolink", z(/^!?\[(ref)\](?:\[\])?/).replace("ref", xo).getRegex()).getRegex(), To = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/, Sm = /[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/, Am = z(/(?:mailto:email|xmpp:email(?:\/[A-Za-z0-9@.]+)?)/).replace(/email/g, Sm).getRegex(), ui = { _backpedal: ae, anyPunctuation: hm, anyPunctuationOutsideCode: pm, autolink: fm, blockSkip: Q_, br: Jc, code: G_, del: ae, delLDelim: ae, delRDelim: ae, emStrongLDelim: Z_, emStrongRDelimAst: nm, emStrongRDelimUnd: am, escape: z_, link: mm, nolink: vm, punctuation: K_, reflink: bm, reflinkSearch: wm, tag: _m, text: j_, url: ae }, km = { ...ui, emStrongLDelim: em, emStrongRDelimAst: im, emStrongRDelimUnd: lm, link: z(/^!?\[(label)\]\((.*?)\)/).replace("label", ts).getRegex(), reflink: z(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", ts).getRegex() }, Mr = { ...ui, emStrongRDelimAst: sm, emStrongLDelim: J_, delLDelim: cm, delRDelim: um, url: z(/^emailProtocol|^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("emailProtocol", Am).replace("protocol", To).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: z(/^(?:[^a-zA-Z0-9](?=emailProtocol)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|wwwStart|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=emailProtocol)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/).replace("protocol", To).replace(/emailProtocol/g, /(?:mailto|xmpp):/).replace("wwwStart", Xc ? "(?<![^\\s*_~(])www\\." : "www\\.").getRegex() }, Em = { ...Mr, br: z(Jc).replace("{2,}", "*").getRegex(), text: z(Mr.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() }, Ln = { normal: di, gfm: U_, pedantic: W_ }, Ke = { normal: ui, gfm: Mr, breaks: Em, pedantic: km }, Cm = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }, Io = (n) => Cm[n];
function At(n, t) {
  if (t) {
    if (ft.escapeTest.test(n)) return n.replace(ft.escapeReplace, Io);
  } else if (ft.escapeTestNoEncode.test(n)) return n.replace(ft.escapeReplaceNoEncode, Io);
  return n;
}
function xm(n) {
  return ft.numericCharacterReference.test(n) ? n.replace(ft.numericCharacterReferenceOrAmpersand, (t, e, s) => {
    if (e === void 0 && s === void 0) return "&amp;";
    let r = e === void 0 ? Number.parseInt(s, 16) : Number.parseInt(e, 10);
    return r === 0 || r > 1114111 || r >= 55296 && r <= 57343 ? "�" : r === 38 ? "&amp;" : String.fromCodePoint(r);
  }) : n;
}
function Ro(n) {
  try {
    n = encodeURI(n).replace(ft.percentDecode, "%");
  } catch {
    return null;
  }
  return n;
}
function Lo(n, t) {
  let e = n.replace(ft.findPipe, (i, a, o) => {
    let l = !1, c = a;
    for (; --c >= 0 && o[c] === "\\"; ) l = !l;
    return l ? "|" : " |";
  }), s = e.split(ft.splitPipe), r = 0;
  if (s[0].trim() || s.shift(), s.length > 0 && !s.at(-1)?.trim() && s.pop(), t) if (s.length > t) s.splice(t);
  else for (; s.length < t; ) s.push("");
  for (; r < s.length; r++) s[r] = s[r].trim().replace(ft.slashPipe, "|");
  return s;
}
function Wt(n, t, e) {
  let s = n.length;
  if (s === 0) return "";
  let r = 0;
  for (; r < s && n.charAt(s - r - 1) === t; )
    r++;
  return n.slice(0, s - r);
}
function Mo(n) {
  let t = n.split(`
`), e = t.length - 1;
  for (; e >= 0 && ft.blankLine.test(t[e]); ) e--;
  return t.length - e <= 2 ? n : t.slice(0, e + 1).join(`
`);
}
function es(n) {
  return n.trim().replace(ft.multipleSpaceGlobal, " ").toLowerCase().toUpperCase().toLowerCase();
}
function Oo(n, t) {
  if (n.indexOf(t[0]) === -1 && n.indexOf(t[1]) === -1) return -1;
  let e = 0;
  for (let s = 0; s < n.length; s++) if (n[s] === "\\") s++;
  else if (n[s] === t[0]) e++;
  else if (n[s] === t[1] && (e--, e < 0)) return s;
  return e > 0 ? -2 : -1;
}
var Le = /* @__PURE__ */ new WeakMap();
function hi(n) {
  let t = { "*": -1, _: -1 }, e = -1, s = n.length;
  for (let r = 0; r < s; r++) {
    let i = n[r];
    if (i !== "*" && i !== "_" && i !== "~") continue;
    let a = r === 0 ? `
` : n[r - 1], o = r + 1;
    for (; o < s && n[o] === i; ) o++;
    a !== " " && a !== "	" && a !== `
` && a !== "\r" && a !== "\f" && (i === "~" ? e = r : t[i] = r), r = o - 1;
  }
  return { maskedSrc: n, lastPossibleEmStrongCloserIndex: t, lastPossibleDelCloserIndex: e };
}
function Tm(n, t) {
  let e = hi(t), s = Le.get(n);
  s ? s.push(e) : Le.set(n, [e]);
}
function Im(n) {
  let t = Le.get(n);
  t && (t.pop(), t.length === 0 && Le.delete(n));
}
function Rm(n, t, e) {
  let s = Le.get(n)?.at(-1);
  return s && s.maskedSrc === t ? s.lastPossibleEmStrongCloserIndex[e] : hi(t).lastPossibleEmStrongCloserIndex[e];
}
function Lm(n, t) {
  let e = Le.get(n)?.at(-1);
  return e && e.maskedSrc === t ? e.lastPossibleDelCloserIndex : hi(t).lastPossibleDelCloserIndex;
}
function Mn(n, t = 0) {
  let e = t, s = "";
  for (let r of n) if (r === "	") {
    let i = 4 - e % 4;
    s += " ".repeat(i), e += i;
  } else s += r, e++;
  return s;
}
function $o(n, t, e, s, r) {
  let i = t.href, a = t.title || null, o = n[1].replace(r.other.outputLinkReplace, "$1"), l = n[0].charAt(0) === "!", c = s.state.inLink, d = s.state.linkEmitted, h = s.state.inRawBlock;
  s.state.inLink = !0, s.state.linkEmitted = !1;
  let u = s.inlineTokens(o), p = s.state.linkEmitted;
  if (s.state.linkEmitted = d, s.state.inLink = c, !l) {
    if (p) {
      s.state.inRawBlock = h;
      return;
    }
    s.state.linkEmitted = !0;
  }
  return { type: l ? "image" : "link", raw: e, href: i, title: a, text: o, tokens: u };
}
function Mm(n, t, e) {
  let s = n.match(e.other.indentCodeCompensation);
  if (s === null) return t;
  let r = s[1];
  return t.split(`
`).map((i) => {
    let a = i.match(e.other.beginningSpace);
    if (a === null) return i;
    let [o] = a;
    return i.slice(Math.min(o.length, r.length));
  }).join(`
`);
}
function No(n, t, e, s) {
  if (!t.includes("<")) return !1;
  for (let r = 0; r < t.length; r++) {
    if (t[r] === "\\") {
      r++;
      continue;
    }
    if (t[r] === "`") {
      let o = s.inline.code.exec(t.slice(r));
      if (o) {
        r += o[0].length - 1;
        continue;
      }
    }
    if (t[r] !== "<") continue;
    let i = n.slice(e + r), a = s.inline.tag.exec(i) || s.inline.autolink.exec(i);
    if (a) {
      if (a[0].length > t.length - r) return !0;
      r += a[0].length - 1;
    }
  }
  return !1;
}
var Ie = class {
  options;
  rules;
  lexer;
  constructor(t) {
    this.options = t || fe;
  }
  space(t) {
    let e = this.rules.block.newline.exec(t);
    if (e && e[0].length > 0) return { type: "space", raw: e[0] };
  }
  code(t) {
    let e = this.rules.block.code.exec(t);
    if (e) {
      let s = this.options.pedantic ? e[0] : Mo(e[0]), r = s.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: s, codeBlockStyle: "indented", text: r };
    }
  }
  fences(t) {
    let e = this.rules.block.fences.exec(t);
    if (e) {
      let s = e[0], r = Mm(s, e[3] || "", this.rules);
      return { type: "code", raw: s, lang: e[2] ? e[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : e[2], text: r };
    }
  }
  heading(t) {
    let e = this.rules.block.heading.exec(t);
    if (e) {
      let s = e[2].trim();
      if (this.rules.other.endingHash.test(s)) {
        let r = Wt(s, "#");
        (this.options.pedantic || !r || this.rules.other.endingSpaceTabChar.test(r)) && (s = r.trim());
      }
      return { type: "heading", raw: Wt(e[0], `
`), depth: e[1].length, text: s, tokens: this.lexer.inline(s) };
    }
  }
  hr(t) {
    let e = this.rules.block.hr.exec(t);
    if (e) return { type: "hr", raw: Wt(e[0], `
`) };
  }
  blockquote(t) {
    let e = this.rules.block.blockquote.exec(t);
    if (e) {
      let s = Wt(e[0], `
`).split(`
`), r = "", i = "", a = [];
      for (; s.length > 0; ) {
        let o = !1, l = [], c;
        for (c = 0; c < s.length; c++) if (this.rules.other.blockquoteStart.test(s[c])) l.push(s[c]), o = !0;
        else if (!o) l.push(s[c]);
        else break;
        s = s.slice(c);
        let d = l.join(`
`), h = d.replace(this.rules.other.blockquoteMarkerWhitespace, (f, _, g) => _ + Mn(g, _.length)).replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        r = r ? `${r}
${d}` : d, i = i ? `${i}
${h}` : h;
        let u = this.lexer.state.top;
        if (this.lexer.state.top = !0, this.lexer.blockTokens(h, a, !0), this.lexer.state.top = u, s.length === 0) break;
        let p = a.at(-1);
        if (p?.type === "code" || p?.type === "heading" || p?.type === "hr" || p?.type === "html" || p?.type === "table") break;
        if (p?.type === "blockquote") {
          let f = p, _ = s.join(`
`), g = f.raw + `
` + _.replace(this.rules.other.blockquoteSetextReplace2, ""), v = this.blockquote(g);
          a[a.length - 1] = v;
          let S = g.substring(v.raw.length).replace(/^\n/, ""), A = S ? S.split(`
`).length : 0, C = A ? s.slice(0, -A) : s;
          if (C.length > 0 && (r = `${r}
${C.join(`
`)}`), i = i.substring(0, i.length - f.text.length) + v.text, s = s.slice(C.length), s.length > 0 && this.rules.other.blockquoteStart.test(s[0])) continue;
          break;
        } else if (p?.type === "list") {
          let f = p, _ = f.raw + `
` + s.join(`
`), g = this.list(_);
          a[a.length - 1] = g;
          let v = g.raw.length > f.raw.length ? _.slice(f.raw.length + 1, g.raw.length).split(`
`).length : 0;
          if (v > 0) {
            let S = s.slice(0, v).join(`
`);
            r = `${r}
${S}`, i = `${i}
${S}`;
          }
          s = s.slice(v);
          continue;
        }
      }
      return { type: "blockquote", raw: r, tokens: a, text: i };
    }
  }
  list(t) {
    let e = this.rules.block.list.exec(t);
    if (e) {
      let s = t, r = () => s.length - t.length, i = e[1].trim(), a = i.length > 1, o = { type: "list", raw: "", ordered: a, start: a ? +i.slice(0, -1) : "", loose: !1, items: [] };
      i = a ? `\\d{1,9}\\${i.slice(-1)}` : `\\${i}`, this.options.pedantic && (i = a ? i : "[*+-]");
      let l = this.rules.other.listItemRegex(i), c = !1;
      for (; t; ) {
        let h = !1, u = "";
        if (!(e = l.exec(t)) || this.rules.block.hr.test(t)) break;
        let p = r();
        t = t.substring(e[0].length);
        let f = e[2].split(`
`, 1)[0], _ = e[1].length, g = this.options.pedantic ? Mn(f, _) : f.replace(this.rules.other.leadingSpaceTab, (b) => Mn(b, _)), v = t.split(`
`, 1)[0], S = !g.trim(), A = 0;
        if (this.options.pedantic ? (A = 2, u = g.trimStart()) : S ? A = _ + 1 : (A = g.search(this.rules.other.nonSpaceChar), A = A > 4 ? 1 : A, u = g.slice(A), A += _), S && this.rules.other.blankLine.test(v) && (t = t.substring(v.length + 1), h = !0), !h) {
          let b = this.rules.other.nextBulletRegex(A), y = this.rules.other.hrRegex(A), E = this.rules.other.fencesBeginRegex(A), R = this.options.pedantic ? this.rules.other.pedanticHeadingBeginRegex(A) : this.rules.other.headingBeginRegex(A), w = this.rules.other.htmlBeginRegex(A), I = this.rules.other.blockquoteBeginRegex(A);
          for (; t; ) {
            let O = t.split(`
`, 1)[0], N;
            if (v = O, this.options.pedantic ? (v = v.replace(this.rules.other.listReplaceNesting, "  "), N = v) : N = v.replace(this.rules.other.leadingSpaceTab, (G) => Mn(G)), E.test(v) || R.test(v) || w.test(v) || I.test(v) || b.test(v) || y.test(v)) break;
            if (N.search(this.rules.other.nonSpaceChar) >= A || !v.trim()) u += `
` + N.slice(A);
            else {
              if (S || g.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || E.test(g) || R.test(g) || w.test(g) || y.test(g)) break;
              let G = !this.options.pedantic && /^ {0,3}(?:=+|-+) *$/.test(v) && this.rules.block.lheading.test(`${g}
${v}`) ? `    ${N.replace(/^ {0,3}/, "")}` : v;
              u += `
` + G;
            }
            S = !v.trim(), t = t.substring(O.length + 1), g = N.slice(A);
          }
        }
        let C = s.slice(p, r());
        o.loose || (c ? o.loose = !0 : this.rules.other.doubleBlankLine.test(C) && (c = !0)), o.items.push({ type: "list_item", raw: C, task: !!this.options.gfm && this.rules.other.listIsTask.test(u), loose: !1, text: u, tokens: [] });
      }
      let d = o.items.at(-1);
      if (d) d.raw = d.raw.trimEnd(), d.text = d.text.trimEnd();
      else return;
      o.raw = s.slice(0, r()).trimEnd();
      for (let h of o.items) if (this.lexer.state.top = !1, h.tokens = this.lexer.blockTokens(h.text, []), !o.loose) {
        let u = h.tokens.filter((f) => f.type === "space"), p = u.length > 0 && u.some((f) => this.rules.other.anyLine.test(f.raw));
        o.loose = p;
      }
      for (let h of o.items) {
        let u = h.tokens[0];
        if (h.task && (u?.type === "text" || u?.type === "paragraph")) {
          h.text = h.text.replace(this.rules.other.listReplaceTask, ""), u.raw = u.raw.replace(this.rules.other.listReplaceTask, ""), u.text = u.text.replace(this.rules.other.listReplaceTask, "");
          for (let f = this.lexer.inlineQueue.length - 1; f >= 0; f--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[f].src)) {
            this.lexer.inlineQueue[f].src = this.lexer.inlineQueue[f].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let p = this.rules.other.listTaskCheckbox.exec(h.raw);
          if (p) {
            let f = { type: "checkbox", raw: p[0] + " ", checked: p[0] !== "[ ]" };
            h.checked = f.checked, o.loose ? h.tokens[0] && ["paragraph", "text"].includes(h.tokens[0].type) && "tokens" in h.tokens[0] && h.tokens[0].tokens ? (h.tokens[0].raw = f.raw + h.tokens[0].raw, h.tokens[0].text = f.raw + h.tokens[0].text, h.tokens[0].tokens.unshift(f)) : h.tokens.unshift({ type: "paragraph", raw: f.raw, text: f.raw, tokens: [f] }) : h.tokens.unshift(f);
          }
        } else h.task && (h.task = !1);
      }
      if (o.loose) for (let h of o.items) {
        h.loose = !0;
        for (let u of h.tokens) u.type === "text" && (u.type = "paragraph");
      }
      return o;
    }
  }
  html(t) {
    let e = this.rules.block.html.exec(t);
    if (e) {
      let s = Mo(e[0]);
      return { type: "html", block: !0, raw: s, pre: e[1] === "pre" || e[1] === "script" || e[1] === "style", text: s };
    }
  }
  def(t) {
    let e = this.rules.block.def.exec(t);
    if (e) {
      if (!this.rules.other.startAngleBracket.test(e[2]) && Oo(e[2], "()") !== -1) return;
      let s = es(e[1]), r = e[2] ? e[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", i = e[3] ? e[3].substring(1, e[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : e[3];
      return { type: "def", tag: s, raw: Wt(e[0], `
`), href: r, title: i };
    }
  }
  table(t) {
    let e = this.rules.block.table.exec(t);
    if (!e || !this.rules.other.tableDelimiter.test(e[2])) return;
    let s = Lo(e[1]), r = e[2].replace(this.rules.other.tableAlignChars, "").split("|"), i = e[3]?.trim() ? e[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], a = { type: "table", raw: Wt(e[0], `
`), header: [], align: [], rows: [] };
    if (s.length === r.length) {
      for (let o of r) this.rules.other.tableAlignRight.test(o) ? a.align.push("right") : this.rules.other.tableAlignCenter.test(o) ? a.align.push("center") : this.rules.other.tableAlignLeft.test(o) ? a.align.push("left") : a.align.push(null);
      for (let o = 0; o < s.length; o++) a.header.push({ text: s[o], tokens: this.lexer.inline(s[o]), header: !0, align: a.align[o] });
      for (let o of i) a.rows.push(Lo(o, a.header.length).map((l, c) => ({ text: l, tokens: this.lexer.inline(l), header: !1, align: a.align[c] })));
      return a;
    }
  }
  lheading(t) {
    let e = this.rules.block.lheading.exec(t);
    if (e) {
      let s = e[1].trim();
      return { type: "heading", raw: Wt(e[0], `
`), depth: e[2].charAt(0) === "=" ? 1 : 2, text: s, tokens: this.lexer.inline(s) };
    }
  }
  paragraph(t) {
    let e = this.rules.block.paragraph.exec(t);
    if (e) {
      let s = e[1].charAt(e[1].length - 1) === `
` ? e[1].slice(0, -1) : e[1];
      return { type: "paragraph", raw: e[0], text: s, tokens: this.lexer.inline(s) };
    }
  }
  text(t) {
    let e = this.rules.block.text.exec(t);
    if (e) return { type: "text", raw: e[0], text: e[0], tokens: this.lexer.inline(e[0]) };
  }
  escape(t) {
    let e = this.rules.inline.escape.exec(t);
    if (e) return { type: "escape", raw: e[0], text: e[1] };
  }
  tag(t) {
    let e = this.rules.inline.tag.exec(t);
    if (e) return !this.lexer.state.inLink && this.rules.other.startATag.test(e[0]) ? this.lexer.state.inLink = !0 : this.lexer.state.inLink && this.rules.other.endATag.test(e[0]) && (this.lexer.state.inLink = !1), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(e[0]) ? this.lexer.state.inRawBlock = !0 : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(e[0]) && (this.lexer.state.inRawBlock = !1), { type: "html", raw: e[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: !1, text: e[0] };
  }
  link(t) {
    if (this.lexer.state.linkParenPossible === !1) return;
    let e = this.rules.inline.link.exec(t);
    if (e) {
      let s = e[0].charAt(0) === "!" ? 2 : 1;
      if (!this.options.pedantic && No(t, e[1], s, this.rules)) return;
      let r = e[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(r)) {
        if (!this.rules.other.endAngleBracket.test(r)) return;
        let l = Wt(r.slice(0, -1), "\\");
        if ((r.length - l.length) % 2 === 0) return;
      } else {
        let l = Oo(e[2], "()");
        if (l === -2) return;
        if (l > -1) {
          let c = (e[0].indexOf("!") === 0 ? 5 : 4) + e[1].length + l;
          e[2] = e[2].substring(0, l), e[0] = e[0].substring(0, c).trim(), e[3] = "";
        }
      }
      let i = Wt(e[0].slice(0, -1), "\\");
      if ((e[0].length - i.length) % 2 === 0) return;
      let a = e[2], o = "";
      if (this.options.pedantic) {
        let l = this.rules.other.pedanticHrefTitle.exec(a);
        l && (a = l[1], o = l[3]);
      } else o = e[3] ? e[3].slice(1, -1) : "";
      return a = a.trim(), this.rules.other.startAngleBracket.test(a) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(r) ? a = a.slice(1) : a = a.slice(1, -1)), $o(e, { href: a && a.replace(this.rules.inline.anyPunctuation, "$1"), title: o && o.replace(this.rules.inline.anyPunctuation, "$1") }, e[0], this.lexer, this.rules);
    }
  }
  reflink(t, e) {
    let s;
    if ((s = this.rules.inline.reflink.exec(t)) || (s = this.rules.inline.nolink.exec(t))) {
      let r = s[0].charAt(0) === "!" ? 2 : 1;
      if (!this.options.pedantic && No(t, s[1], r, this.rules)) return;
      let i = e[es(s[2] || s[1])];
      if (!i) {
        let a = s[0].charAt(0);
        return { type: "text", raw: a, text: a };
      }
      return $o(s, i, s[0], this.lexer, this.rules);
    }
  }
  emStrong(t, e, s = "") {
    let r = this.rules.inline.emStrongLDelim.exec(t);
    if (!r || !r[1] && !r[2] && !r[3] && !r[4]) return;
    let i = r[0][0], a = s === i, o = e.length - t.length, l = o;
    for (; !this.options.pedantic && l > 0 && e[l - 1] === i; ) l--;
    let c = [...e.slice(Math.max(0, l - 2), l)].at(-1) ?? "", d = c === "*" || c === "_" || !!this.rules.inline.punctuation.exec(c);
    l < o && (s = c);
    let h = l < o ? d : !!this.rules.inline.punctuation.exec(s);
    if (r[4] && s.match(this.rules.other.unicodeAlphaNumeric)) return;
    let u = r[1] || r[3] || "";
    if (!u || !s || h) {
      let p = [...r[0]].length - 1, f, _, g = p, v = 0, S = o - l + p, A = !this.options.pedantic && !!c.trim() && (!!u || i === "*" && !d);
      if (i !== "*" && i !== "_") return;
      let C = i === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd, b = Rm(this, e, i), y = e.length - t.length + p;
      if (b < y) return;
      e = e.slice(-1 * t.length + p);
      let E = b - y;
      for (C.lastIndex = 0; (r = C.exec(e)) !== null && !(r.index > E); ) {
        if (f = r[1] || r[2] || r[3] || r[4] || r[5] || r[6], !f) continue;
        if (_ = [...f].length, r[3] || r[4]) {
          g += _;
          continue;
        } else if (r[5] || r[6] || A) {
          if (a && (r[5] || r[6])) break;
          if (S % 3 && !((S + _) % 3)) {
            v += _;
            continue;
          }
        }
        if (g -= _, g > 0) continue;
        _ = Math.min(_, _ + g + v);
        let R = [...r[0]][0].length, w = t.slice(0, p + r.index + R + _);
        if (Math.min(p, _) % 2) {
          let O = w.slice(1, -1);
          return { type: "em", raw: w, text: O, tokens: this.lexer.inlineTokens(O) };
        }
        let I = w.slice(2, -2);
        return { type: "strong", raw: w, text: I, tokens: this.lexer.inlineTokens(I) };
      }
    }
  }
  codespan(t) {
    let e = this.rules.inline.code.exec(t);
    if (e) {
      let s = e[2].replace(this.rules.other.newLineCharGlobal, " "), r = this.rules.other.nonSpaceChar.test(s), i = this.rules.other.startingSpaceChar.test(s) && this.rules.other.endingSpaceChar.test(s);
      return r && i && (s = s.substring(1, s.length - 1)), { type: "codespan", raw: e[0], text: s };
    }
  }
  br(t) {
    let e = this.rules.inline.br.exec(t);
    if (e) return { type: "br", raw: e[0] };
  }
  del(t, e, s = "") {
    let r = this.rules.inline.delLDelim.exec(t);
    if (r && (!r[1] || !s || this.rules.inline.punctuation.exec(s))) {
      let i = [...r[0]].length - 1, a, o, l = i, c = this.rules.inline.delRDelim, d = Lm(this, e), h = e.length - t.length + i;
      if (d < h) return;
      e = e.slice(-1 * t.length + i);
      let u = d - h;
      for (c.lastIndex = 0; (r = c.exec(e)) !== null && !(r.index > u); ) {
        if (a = r[1] || r[2] || r[3] || r[4] || r[5] || r[6], !a || (o = [...a].length, o !== i)) continue;
        if (r[3] || r[4]) {
          l += o;
          continue;
        }
        if (l -= o, l > 0) continue;
        o = Math.min(o, o + l);
        let p = [...r[0]][0].length, f = t.slice(0, i + r.index + p + o), _ = f.slice(i, -i);
        return { type: "del", raw: f, text: _, tokens: this.lexer.inlineTokens(_) };
      }
    }
  }
  autolink(t) {
    let e = this.rules.inline.autolink.exec(t);
    if (e) {
      let s, r;
      return e[2] === "@" ? (s = e[1], r = "mailto:" + s) : (s = e[1], r = s), { type: "link", raw: e[0], text: s, href: r, autolink: !0, tokens: [{ type: "text", raw: s, text: s }] };
    }
  }
  url(t) {
    let e;
    if (e = this.rules.inline.url.exec(t)) {
      let s, r;
      if (e[2] === "@") s = e[0], r = "mailto:" + s;
      else {
        let i;
        do
          i = e[0], e[0] = this.rules.inline._backpedal.exec(e[0])?.[0] ?? "";
        while (i !== e[0]);
        s = e[0], e[1] === "www." ? r = "http://" + e[0] : r = e[0];
      }
      return { type: "link", raw: e[0], text: s, href: r, autolink: !0, tokens: [{ type: "text", raw: s, text: s }] };
    }
  }
  inlineText(t) {
    let e = this.rules.inline.text.exec(t);
    if (e) {
      let s = this.lexer.state.inRawBlock;
      return { type: "text", raw: e[0], text: s ? e[0] : xm(e[0]), escaped: s };
    }
  }
}, It = class Or {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(t) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = t || fe, this.options.tokenizer = this.options.tokenizer || new Ie(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: !1, inRawBlock: !1, linkEmitted: !1, linkParenPossible: !0, top: !0 };
    let e = { other: ft, block: Ln.normal, inline: Ke.normal };
    this.options.pedantic ? (e.block = Ln.pedantic, e.inline = Ke.pedantic) : this.options.gfm && (e.block = Ln.gfm, this.options.breaks ? e.inline = Ke.breaks : e.inline = Ke.gfm), this.tokenizer.rules = e;
  }
  static get rules() {
    return { block: Ln, inline: Ke };
  }
  static lex(t, e) {
    return new Or(e).lex(t);
  }
  static lexInline(t, e) {
    return new Or(e).inlineTokens(t);
  }
  lex(t) {
    t = t.replace(ft.carriageReturn, `
`), this.blockTokens(t, this.tokens);
    for (let e = 0; e < this.inlineQueue.length; e++) {
      let s = this.inlineQueue[e];
      this.state.inRawBlock = !1, this.inlineTokens(s.src, s.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(t, e = [], s = !1) {
    this.tokenizer.lexer = this, this.options.pedantic && (t = t.replace(ft.tabCharGlobal, "    ").replace(ft.spaceLine, ""));
    let r = 1 / 0;
    for (; t; ) {
      if (t.length < r) r = t.length;
      else {
        this.infiniteLoopError(t.charCodeAt(0));
        break;
      }
      let i;
      if (this.options.extensions?.block?.some((o) => (i = o.call({ lexer: this }, t, e)) ? (t = t.substring(i.raw.length), e.push(i), !0) : !1)) continue;
      if (i = this.tokenizer.space(t)) {
        t = t.substring(i.raw.length);
        let o = e.at(-1);
        i.raw.length === 1 && o !== void 0 ? o.raw += `
` : e.push(i);
        continue;
      }
      if (i = this.tokenizer.code(t)) {
        t = t.substring(i.raw.length);
        let o = e.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + i.raw, o.text += `
` + i.text, this.inlineQueue.at(-1).src = o.text) : e.push(i);
        continue;
      }
      if (i = this.tokenizer.fences(t)) {
        t = t.substring(i.raw.length), e.push(i);
        continue;
      }
      if (i = this.tokenizer.heading(t)) {
        t = t.substring(i.raw.length), e.push(i);
        continue;
      }
      if (i = this.tokenizer.hr(t)) {
        t = t.substring(i.raw.length), e.push(i);
        continue;
      }
      if (i = this.tokenizer.blockquote(t)) {
        t = t.substring(i.raw.length), e.push(i);
        continue;
      }
      if (i = this.tokenizer.list(t)) {
        t = t.substring(i.raw.length), e.push(i);
        continue;
      }
      if (i = this.tokenizer.html(t)) {
        t = t.substring(i.raw.length), e.push(i);
        continue;
      }
      if (i = this.tokenizer.def(t)) {
        t = t.substring(i.raw.length);
        let o = e.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + i.raw, o.text += `
` + i.raw, this.inlineQueue.at(-1).src = o.text) : (this.tokens.links[i.tag] || (this.tokens.links[i.tag] = { href: i.href, title: i.title }), e.push(i));
        continue;
      }
      if (i = this.tokenizer.table(t)) {
        t = t.substring(i.raw.length), e.push(i);
        continue;
      }
      if (i = this.tokenizer.lheading(t)) {
        t = t.substring(i.raw.length), e.push(i);
        continue;
      }
      let a = t;
      if (this.options.extensions?.startBlock) {
        let o = 1 / 0, l = t.slice(1), c;
        this.options.extensions.startBlock.forEach((d) => {
          c = d.call({ lexer: this }, l), typeof c == "number" && c >= 0 && (o = Math.min(o, c));
        }), o < 1 / 0 && o >= 0 && (a = t.substring(0, o + 1));
      }
      if (this.state.top && (i = this.tokenizer.paragraph(a))) {
        let o = e.at(-1);
        s && o?.type === "paragraph" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + i.raw, o.text += `
` + i.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : e.push(i), s = a.length !== t.length, t = t.substring(i.raw.length);
        continue;
      }
      if (i = this.tokenizer.text(t)) {
        t = t.substring(i.raw.length);
        let o = e.at(-1);
        o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + i.raw, o.text += `
` + i.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : e.push(i);
        continue;
      }
      if (t) {
        this.infiniteLoopError(t.charCodeAt(0));
        break;
      }
    }
    return this.state.top = !0, e;
  }
  inline(t, e = []) {
    return this.inlineQueue.push({ src: t, tokens: e }), e;
  }
  linkInText(t) {
    if (!t.includes("[")) return !1;
    let e = this.tokenizer.rules.inline.link;
    for (let s of t.matchAll(this.tokenizer.rules.inline.blockSkip)) if (e.test(s[0]) && t.charAt(s.index - 1) !== "!") return !0;
    for (let s of t.matchAll(this.tokenizer.rules.inline.reflinkSearch)) {
      let r = s[0], i = r.lastIndexOf("[");
      if (!(r.charAt(0) === "!" || !Object.hasOwn(this.tokens.links, es(r.slice(i + 1, -1)))) && !(i > 1 && this.linkInText(r.slice(1, i - 1)))) return !0;
    }
    return !1;
  }
  inlineTokens(t, e = []) {
    this.tokenizer.lexer = this;
    let s = this.state.linkParenPossible;
    this.state.linkParenPossible = s && t.includes(")");
    try {
      return this.#t(t, e);
    } finally {
      this.state.linkParenPossible = s;
    }
  }
  #t(t, e) {
    let s = t.includes("*") || t.includes("_") || t.includes("~") || this.options.hooks?.emStrongMask || this.tokenizer.emStrong !== Ie.prototype.emStrong || this.tokenizer.del !== Ie.prototype.del ? this.#n(t) : t;
    Tm(this.tokenizer, s);
    try {
      return this.#e(t, s, e);
    } finally {
      Im(this.tokenizer);
    }
  }
  #e(t, e, s) {
    let r = !1, i = "", a = 1 / 0;
    for (; t; ) {
      if (t.length < a) a = t.length;
      else {
        this.infiniteLoopError(t.charCodeAt(0));
        break;
      }
      r || (i = ""), r = !1;
      let o;
      if (this.options.extensions?.inline?.some((c) => (o = c.call({ lexer: this }, t, s)) ? (t = t.substring(o.raw.length), s.push(o), !0) : !1)) continue;
      if (o = this.tokenizer.escape(t)) {
        t = t.substring(o.raw.length), s.push(o);
        continue;
      }
      if (o = this.tokenizer.tag(t)) {
        t = t.substring(o.raw.length), s.push(o);
        continue;
      }
      if (o = this.tokenizer.link(t)) {
        t = t.substring(o.raw.length), s.push(o);
        continue;
      }
      if (o = this.tokenizer.reflink(t, this.tokens.links)) {
        t = t.substring(o.raw.length);
        let c = s.at(-1);
        o.type === "text" && c?.type === "text" ? (c.raw += o.raw, c.text += o.text) : s.push(o);
        continue;
      }
      if (o = this.tokenizer.emStrong(t, e, i)) {
        t = t.substring(o.raw.length), s.push(o);
        continue;
      }
      if (o = this.tokenizer.codespan(t)) {
        t = t.substring(o.raw.length), s.push(o);
        continue;
      }
      if (o = this.tokenizer.br(t)) {
        t = t.substring(o.raw.length), s.push(o);
        continue;
      }
      if (o = this.tokenizer.del(t, e, i)) {
        t = t.substring(o.raw.length), s.push(o);
        continue;
      }
      if (o = this.tokenizer.autolink(t)) {
        t = t.substring(o.raw.length), s.push(o);
        continue;
      }
      if (!this.state.inLink && (o = this.tokenizer.url(t))) {
        t = t.substring(o.raw.length), s.push(o);
        continue;
      }
      let l = t;
      if (this.options.extensions?.startInline) {
        let c = 1 / 0, d = t.slice(1), h;
        this.options.extensions.startInline.forEach((u) => {
          h = u.call({ lexer: this }, d), typeof h == "number" && h >= 0 && (c = Math.min(c, h));
        }), c < 1 / 0 && c >= 0 && (l = t.substring(0, c + 1));
      }
      if (o = this.tokenizer.inlineText(l)) {
        t = t.substring(o.raw.length), o.raw.slice(-1) !== "_" && (i = o.raw.slice(-1)), r = !0;
        let c = s.at(-1);
        c?.type === "text" ? (c.raw += o.raw, c.text += o.text) : s.push(o);
        continue;
      }
      if (t) {
        this.infiniteLoopError(t.charCodeAt(0));
        break;
      }
    }
    return s;
  }
  #n(t) {
    let e = t;
    if (this.tokens.links && t.includes("[")) {
      let s = this.tokenizer.rules.inline.reflinkSearch, r = (i) => {
        let a = i.lastIndexOf("[");
        if (!Object.hasOwn(this.tokens.links, es(i.slice(a + 1, -1)))) return i;
        if (a > 1 && i.charAt(0) !== "!") {
          let o = i.slice(1, a - 1);
          if (this.linkInText(o)) return "[" + o.replace(s, r) + "][" + "a".repeat(i.length - a - 2) + "]";
        }
        return "[" + "a".repeat(i.length - 2) + "]";
      };
      e = e.replace(s, r);
    }
    return e = e.replace(this.tokenizer.rules.inline.anyPunctuationOutsideCode, (s, r, i) => i ? "+".repeat(s.length) : r ? r + s.slice(r.length, -r.length).replace(/`/g, "+") + r : s), e = e.replace(this.tokenizer.rules.inline.blockSkip, (s, r, i) => {
      let a = i ? i.length : 0;
      return s.slice(0, a) + "[" + "a".repeat(s.length - a - 2) + "]";
    }), e = this.options.hooks?.emStrongMask?.call({ lexer: this }, e) ?? e, e;
  }
  infiniteLoopError(t) {
    let e = "Infinite loop on byte: " + t;
    if (this.options.silent) console.error(e);
    else throw new Error(e);
  }
}, ns = class {
  options;
  parser;
  constructor(t) {
    this.options = t || fe;
  }
  space(t) {
    return "";
  }
  code({ text: t, lang: e, escaped: s }) {
    let r = (e || "").match(ft.notSpaceStart)?.[0], i = t ? t.replace(ft.endingNewline, "") + `
` : "";
    return r ? '<pre><code class="language-' + At(r) + '">' + (s ? i : At(i, !0)) + `</code></pre>
` : "<pre><code>" + (s ? i : At(i, !0)) + `</code></pre>
`;
  }
  blockquote({ tokens: t }) {
    return `<blockquote>
${this.parser.parse(t)}</blockquote>
`;
  }
  html({ text: t }) {
    return t;
  }
  def(t) {
    return "";
  }
  heading({ tokens: t, depth: e }) {
    return `<h${e}>${this.parser.parseInline(t)}</h${e}>
`;
  }
  hr(t) {
    return `<hr>
`;
  }
  list(t) {
    let e = t.ordered, s = t.start, r = "";
    for (let o = 0; o < t.items.length; o++) {
      let l = t.items[o];
      r += this.listitem(l);
    }
    let i = e ? "ol" : "ul", a = e && s !== 1 ? ' start="' + s + '"' : "";
    return "<" + i + a + `>
` + r + "</" + i + `>
`;
  }
  listitem(t) {
    return `<li>${this.parser.parse(t.tokens)}</li>
`;
  }
  checkbox({ checked: t }) {
    return "<input " + (t ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: t }) {
    return `<p>${this.parser.parseInline(t)}</p>
`;
  }
  table(t) {
    let e = "", s = "";
    for (let i = 0; i < t.header.length; i++) s += this.tablecell(t.header[i]);
    e += this.tablerow({ text: s });
    let r = "";
    for (let i = 0; i < t.rows.length; i++) {
      let a = t.rows[i];
      s = "";
      for (let o = 0; o < a.length; o++) s += this.tablecell(a[o]);
      r += this.tablerow({ text: s });
    }
    return r && (r = `<tbody>${r}</tbody>`), `<table>
<thead>
` + e + `</thead>
` + r + `</table>
`;
  }
  tablerow({ text: t }) {
    return `<tr>
${t}</tr>
`;
  }
  tablecell(t) {
    let e = this.parser.parseInline(t.tokens), s = t.header ? "th" : "td";
    return (t.align ? `<${s} align="${t.align}">` : `<${s}>`) + e + `</${s}>
`;
  }
  strong({ tokens: t }) {
    return `<strong>${this.parser.parseInline(t)}</strong>`;
  }
  em({ tokens: t }) {
    return `<em>${this.parser.parseInline(t)}</em>`;
  }
  codespan({ text: t }) {
    return `<code>${At(t, !0)}</code>`;
  }
  br(t) {
    return "<br>";
  }
  del({ tokens: t }) {
    return `<del>${this.parser.parseInline(t)}</del>`;
  }
  link({ href: t, title: e, text: s, tokens: r, autolink: i }) {
    let a = i ? At(s, !0) : this.parser.parseInline(r), o = Ro(t);
    if (o === null) return a;
    t = At(o, i);
    let l = '<a href="' + t + '"';
    return e && (l += ' title="' + At(e) + '"'), l += ">" + a + "</a>", l;
  }
  image({ href: t, title: e, text: s, tokens: r }) {
    r && (s = this.parser.parseInline(r, this.parser.textRenderer));
    let i = Ro(t);
    if (i === null) return At(s);
    t = i;
    let a = `<img src="${At(t)}" alt="${At(s)}"`;
    return e && (a += ` title="${At(e)}"`), a += ">", a;
  }
  text(t) {
    return "tokens" in t && t.tokens ? this.parser.parseInline(t.tokens) : "escaped" in t && t.escaped ? t.text : At(t.text);
  }
}, pi = class {
  parser;
  strong({ text: t, tokens: e }) {
    return e ? this.parser.parseInline(e, this) : t;
  }
  em({ text: t, tokens: e }) {
    return e ? this.parser.parseInline(e, this) : t;
  }
  codespan({ text: t }) {
    return t;
  }
  del({ text: t, tokens: e }) {
    return e ? this.parser.parseInline(e, this) : t;
  }
  html({ text: t }) {
    return t;
  }
  text({ text: t }) {
    return t;
  }
  link({ text: t, tokens: e }) {
    return e ? this.parser.parseInline(e, this) : t;
  }
  image({ text: t, tokens: e }) {
    return e ? this.parser.parseInline(e, this) : t;
  }
  br() {
    return "";
  }
  checkbox({ raw: t }) {
    return t;
  }
}, Rt = class $r {
  options;
  renderer;
  textRenderer;
  constructor(t) {
    this.options = t || fe, this.options.renderer = this.options.renderer || new ns(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new pi(), this.textRenderer.parser = this;
  }
  static parse(t, e) {
    return new $r(e).parse(t);
  }
  static parseInline(t, e) {
    return new $r(e).parseInline(t);
  }
  parse(t) {
    this.renderer.parser = this;
    let e = "";
    for (let s = 0; s < t.length; s++) {
      let r = t[s];
      if (this.options.extensions?.renderers?.[r.type]) {
        let a = r, o = this.options.extensions.renderers[a.type].call({ parser: this }, a);
        if (o !== !1 || !["space", "hr", "heading", "code", "table", "blockquote", "list", "checkbox", "html", "def", "paragraph", "text"].includes(a.type)) {
          e += o || "";
          continue;
        }
      }
      let i = r;
      switch (i.type) {
        case "space": {
          e += this.renderer.space(i);
          break;
        }
        case "hr": {
          e += this.renderer.hr(i);
          break;
        }
        case "heading": {
          e += this.renderer.heading(i);
          break;
        }
        case "code": {
          e += this.renderer.code(i);
          break;
        }
        case "table": {
          e += this.renderer.table(i);
          break;
        }
        case "blockquote": {
          e += this.renderer.blockquote(i);
          break;
        }
        case "list": {
          e += this.renderer.list(i);
          break;
        }
        case "checkbox": {
          e += this.renderer.checkbox(i);
          break;
        }
        case "html": {
          e += this.renderer.html(i);
          break;
        }
        case "def": {
          e += this.renderer.def(i);
          break;
        }
        case "paragraph": {
          e += this.renderer.paragraph(i);
          break;
        }
        case "text": {
          e += this.renderer.text(i);
          break;
        }
        default: {
          let a = 'Token with "' + i.type + '" type was not found.';
          if (this.options.silent) return console.error(a), "";
          throw new Error(a);
        }
      }
    }
    return e;
  }
  parseInline(t, e = this.renderer) {
    this.renderer.parser = this;
    let s = "";
    for (let r = 0; r < t.length; r++) {
      let i = t[r];
      if (this.options.extensions?.renderers?.[i.type]) {
        let o = this.options.extensions.renderers[i.type].call({ parser: this }, i);
        if (o !== !1 || !["escape", "html", "link", "image", "checkbox", "strong", "em", "codespan", "br", "del", "text"].includes(i.type)) {
          s += o || "";
          continue;
        }
      }
      let a = i;
      switch (a.type) {
        case "escape": {
          s += e.text(a);
          break;
        }
        case "html": {
          s += e.html(a);
          break;
        }
        case "link": {
          s += e.link(a);
          break;
        }
        case "image": {
          s += e.image(a);
          break;
        }
        case "checkbox": {
          s += e.checkbox(a);
          break;
        }
        case "strong": {
          s += e.strong(a);
          break;
        }
        case "em": {
          s += e.em(a);
          break;
        }
        case "codespan": {
          s += e.codespan(a);
          break;
        }
        case "br": {
          s += e.br(a);
          break;
        }
        case "del": {
          s += e.del(a);
          break;
        }
        case "text": {
          s += e.text(a);
          break;
        }
        default: {
          let o = 'Token with "' + a.type + '" type was not found.';
          if (this.options.silent) return console.error(o), "";
          throw new Error(o);
        }
      }
    }
    return s;
  }
}, Ye = class {
  options;
  block;
  constructor(t) {
    this.options = t || fe;
  }
  static passThroughHooks = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"]);
  static passThroughHooksRespectAsync = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"]);
  preprocess(t) {
    return t;
  }
  postprocess(t) {
    return t;
  }
  processAllTokens(t) {
    return t;
  }
  emStrongMask(t) {
    return t;
  }
  provideLexer(t = this.block) {
    return t ? It.lex : It.lexInline;
  }
  provideParser(t = this.block) {
    return t ? Rt.parse : Rt.parseInline;
  }
};
function Qt(n, t) {
  if (Array.isArray(t)) for (let e = 0; e < t.length; e++) n.push(t[e]);
  else n.push(t);
}
var Nr = class {
  defaults = ii();
  options = this.setOptions;
  parse = this.parseMarkdown(!0);
  parseInline = this.parseMarkdown(!1);
  Parser = Rt;
  Renderer = ns;
  TextRenderer = pi;
  Lexer = It;
  Tokenizer = Ie;
  Hooks = Ye;
  constructor(...t) {
    this.use(...t);
  }
  walkTokens(t, e) {
    let s = [];
    for (let r of t) switch (Qt(s, e.call(this, r)), r.type) {
      case "table": {
        let i = r;
        for (let a of i.header) Qt(s, this.walkTokens(a.tokens, e));
        for (let a of i.rows) for (let o of a) Qt(s, this.walkTokens(o.tokens, e));
        break;
      }
      case "list": {
        let i = r;
        Qt(s, this.walkTokens(i.items, e));
        break;
      }
      default: {
        let i = r;
        this.defaults.extensions?.childTokens?.[i.type] ? this.defaults.extensions.childTokens[i.type].forEach((a) => {
          let o = i[a].flat(1 / 0);
          Qt(s, this.walkTokens(o, e));
        }) : i.tokens && Qt(s, this.walkTokens(i.tokens, e));
      }
    }
    return s;
  }
  use(...t) {
    let e = this.defaults.extensions || { renderers: /* @__PURE__ */ Object.create(null), childTokens: /* @__PURE__ */ Object.create(null) };
    return t.forEach((s) => {
      let r = { ...s };
      if (r.async = this.defaults.async || r.async || !1, s.extensions && (s.extensions.forEach((i) => {
        if (!i.name) throw new Error("extension name required");
        if ("renderer" in i) {
          let a = e.renderers[i.name];
          a ? e.renderers[i.name] = function(...o) {
            let l = i.renderer.apply(this, o);
            return l === !1 && (l = a.apply(this, o)), l;
          } : e.renderers[i.name] = i.renderer;
        }
        if ("tokenizer" in i) {
          if (!i.level || i.level !== "block" && i.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let a = e[i.level];
          a ? a.unshift(i.tokenizer) : e[i.level] = [i.tokenizer], i.start && (i.level === "block" ? e.startBlock ? e.startBlock.push(i.start) : e.startBlock = [i.start] : i.level === "inline" && (e.startInline ? e.startInline.push(i.start) : e.startInline = [i.start]));
        }
        "childTokens" in i && i.childTokens && (e.childTokens[i.name] = i.childTokens);
      }), r.extensions = e), s.renderer) {
        let i = this.defaults.renderer || new ns(this.defaults);
        for (let a in s.renderer) {
          if (!(a in i)) throw new Error(`renderer '${a}' does not exist`);
          if (["options", "parser"].includes(a)) continue;
          let o = a, l = s.renderer[o], c = i[o];
          i[o] = (...d) => {
            let h = l.apply(i, d);
            return h === !1 && (h = c.apply(i, d)), h === !1 ? "" : h ?? "";
          };
        }
        r.renderer = i;
      }
      if (s.tokenizer) {
        let i = this.defaults.tokenizer || new Ie(this.defaults);
        for (let a in s.tokenizer) {
          if (!(a in i)) throw new Error(`tokenizer '${a}' does not exist`);
          if (["options", "rules", "lexer"].includes(a)) continue;
          let o = a, l = s.tokenizer[o], c = i[o];
          i[o] = (...d) => {
            let h = l.apply(i, d);
            return h === !1 && (h = c.apply(i, d)), h;
          };
        }
        r.tokenizer = i;
      }
      if (s.hooks) {
        let i = this.defaults.hooks || new Ye();
        for (let a in s.hooks) {
          if (!(a in i)) throw new Error(`hook '${a}' does not exist`);
          if (["options", "block"].includes(a)) continue;
          let o = a, l = s.hooks[o], c = i[o];
          Ye.passThroughHooks.has(a) ? i[o] = (d) => {
            if (i.options.async && Ye.passThroughHooksRespectAsync.has(a)) return (async () => {
              let u = await l.call(i, d);
              return c.call(i, u);
            })();
            let h = l.call(i, d);
            return c.call(i, h);
          } : i[o] = (...d) => {
            if (i.options.async) return (async () => {
              let u = await l.apply(i, d);
              return u === !1 && (u = await c.apply(i, d)), u;
            })();
            let h = l.apply(i, d);
            return h === !1 && (h = c.apply(i, d)), h;
          };
        }
        r.hooks = i;
      }
      if (s.walkTokens) {
        let i = this.defaults.walkTokens, a = s.walkTokens;
        r.walkTokens = function(o) {
          let l = [];
          return Qt(l, a.call(this, o)), i && Qt(l, i.call(this, o)), l;
        };
      }
      this.defaults = { ...this.defaults, ...r };
    }), this;
  }
  setOptions(t) {
    return this.defaults = { ...this.defaults, ...t }, this;
  }
  lexer(t, e) {
    return It.lex(t, e ?? this.defaults);
  }
  parser(t, e) {
    return Rt.parse(t, e ?? this.defaults);
  }
  parseMarkdown(t) {
    return (e, s) => {
      let r = { ...s }, i = { ...this.defaults, ...r }, a = this.onError(!!i.silent, !!i.async);
      if (this.defaults.async === !0 && r.async === !1) return a(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof e > "u" || e === null) return a(new Error("marked(): input parameter is undefined or null"));
      if (typeof e != "string") return a(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(e) + ", string expected"));
      if (i.hooks && (i.hooks.options = i, i.hooks.block = t), i.async) return (async () => {
        let o = i.hooks ? await i.hooks.preprocess(e) : e, l = await (i.hooks ? await i.hooks.provideLexer(t) : t ? It.lex : It.lexInline)(o, i), c = i.hooks ? await i.hooks.processAllTokens(l) : l;
        i.walkTokens && await Promise.all(this.walkTokens(c, i.walkTokens));
        let d = await (i.hooks ? await i.hooks.provideParser(t) : t ? Rt.parse : Rt.parseInline)(c, i);
        return i.hooks ? await i.hooks.postprocess(d) : d;
      })().catch(a);
      try {
        i.hooks && (e = i.hooks.preprocess(e));
        let o = (i.hooks ? i.hooks.provideLexer(t) : t ? It.lex : It.lexInline)(e, i);
        i.hooks && (o = i.hooks.processAllTokens(o)), i.walkTokens && this.walkTokens(o, i.walkTokens);
        let l = (i.hooks ? i.hooks.provideParser(t) : t ? Rt.parse : Rt.parseInline)(o, i);
        return i.hooks && (l = i.hooks.postprocess(l)), l;
      } catch (o) {
        return a(o);
      }
    };
  }
  onError(t, e) {
    return (s) => {
      if (s.message += `
Please report this to https://github.com/markedjs/marked.`, t) {
        let r = "<p>An error occurred:</p><pre>" + At(s.message + "", !0) + "</pre>";
        return e ? Promise.resolve(r) : r;
      }
      if (e) return Promise.reject(s);
      throw s;
    };
  }
}, he = new Nr();
function et(n, t) {
  return he.parse(n, t);
}
et.options = et.setOptions = function(n) {
  return he.setOptions(n), et.defaults = he.defaults, Vc(et.defaults), et;
};
et.getDefaults = ii;
et.defaults = fe;
function Om(...n) {
  return he.use(...n), et.defaults = he.defaults, Vc(et.defaults), et;
}
et.use = Om;
et.walkTokens = function(n, t) {
  return he.walkTokens(n, t);
};
et.parseInline = he.parseInline;
et.Parser = Rt;
et.parser = Rt.parse;
et.Renderer = ns;
et.TextRenderer = pi;
et.Lexer = It;
et.lexer = It.lex;
et.Tokenizer = Ie;
et.Hooks = Ye;
et.parse = et;
et.options;
et.setOptions;
et.walkTokens;
et.parseInline;
Rt.parse;
It.lex;
var $m = Object.defineProperty, Nm = Object.defineProperties, Pm = Object.getOwnPropertyDescriptors, Po = Object.getOwnPropertySymbols, Dm = Object.prototype.hasOwnProperty, Hm = Object.prototype.propertyIsEnumerable, Do = (n, t, e) => t in n ? $m(n, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : n[t] = e, rd = (n, t) => {
  for (var e in t || (t = {})) Dm.call(t, e) && Do(n, e, t[e]);
  if (Po) for (var e of Po(t)) Hm.call(t, e) && Do(n, e, t[e]);
  return n;
}, id = (n, t) => Nm(n, Pm(t)), st = { PROSE: 0, FENCE_MARKER: 1, FENCE_INFO: 2, FENCE_BODY: 3, CODE_SPAN: 4, CODE_SPAN_OPEN: 5 }, Bm = /^(`{3,}|~{3,})(.*)$/, qm = (n) => n !== void 0 && n >= "0" && n <= "9", Fm = (n, t) => {
  let e = t;
  if (n[e] === "-" || n[e] === "*" || n[e] === "+") e += 1;
  else {
    for (; qm(n[e]) && e - t < 9; ) e += 1;
    if (e === t || n[e] !== "." && n[e] !== ")") return -1;
    e += 1;
  }
  return n[e] === " " ? e + 1 : -1;
}, Um = (n, t, e) => {
  let s = 0, r = t, i = !1, a = t;
  for (; ; ) {
    for (; a < e && n[a] === " "; ) a += 1;
    if (n[a] === ">") {
      s += 1, a += n[a + 1] === " " ? 2 : 1, r = a, i = !1;
      continue;
    }
    let o = a < e ? Fm(n, a) : -1;
    if (o === -1) return { contentStart: a, listIndent: i ? a - r : 0, quoteDepth: s };
    a = o, i = !0;
  }
}, Wm = (n, t, e, s) => {
  let r = t;
  for (let i = 0; i < s; i += 1) {
    for (; r < e && n[r] === " "; ) r += 1;
    if (n[r] !== ">") return -1;
    r += 1, n[r] === " " && (r += 1);
  }
  return r;
}, zm = (n, t, e, s, r) => {
  let i = t + s;
  n.fill(st.FENCE_MARKER, i, i + r), n.fill(st.FENCE_INFO, i + r, Math.min(e + 1, n.length));
}, Gm = (n, t, e, s) => {
  let r = t;
  for (; r < e && n[r] === " "; ) r += 1;
  let i = 0;
  for (; r < e && n[r] === s.char; ) r += 1, i += 1;
  if (i < s.length) return !1;
  for (; r < e; ) {
    if (n[r] !== " " && n[r] !== "	" && n[r] !== "\r") return !1;
    r += 1;
  }
  return !0;
}, jm = (n, t, e, s) => {
  let r = s > e && n[s - 1] === "\r" ? s - 1 : s, i = Um(n, e, r), a = n.slice(i.contentStart, r).match(Bm);
  if (!a) return null;
  let [, o, l] = a, c = o[0];
  return c === "`" && l.includes("`") ? null : (zm(t, e, s, i.contentStart - e, o.length), { char: c, length: o.length, listIndent: i.listIndent, quoteDepth: i.quoteDepth });
}, Km = (n, t, e, s) => {
  let r = Wm(n, t, e, s.quoteDepth);
  if (r === -1 || s.listIndent === 0) return r;
  let i = r;
  for (; i < e && n[i] === " "; ) i += 1;
  return i === e || n[i] === "\r" && i + 1 === e || i - r >= s.listIndent ? r : -1;
}, Vm = (n, t) => {
  let e = n.length, s = null, r = 0;
  for (; r < e; ) {
    let i = n.indexOf(`
`, r);
    i === -1 && (i = e);
    let a = s ? Km(n, r, i, s) : -1;
    s && a === -1 && (s = null), s ? Gm(n, a, i, s) ? (t.fill(st.FENCE_MARKER, r, i), s = null) : t.fill(st.FENCE_BODY, r, Math.min(i + 1, e)) : s = jm(n, t, r, i), r = i + 1;
  }
  return s;
}, Ho = (n, t) => {
  let e = t + 1;
  for (; e < n.length && n[e] === "`"; ) e += 1;
  return e;
}, Xm = (n, t) => {
  let e = t + 1;
  for (; e < n.length && (n[e] === " " || n[e] === "	" || n[e] === "\r"); ) e += 1;
  return e < n.length && n[e] === `
`;
}, Ym = (n, t, e) => {
  let s = e;
  for (; ; ) {
    let r = n.indexOf("`", s);
    if (r === -1) return -1;
    let i = r > s && n[r - 1] === "\\" && t[r - 1] === st.PROSE;
    if (t[r] === st.PROSE && !i) return r;
    s = r + 1;
  }
}, Qm = (n, t) => {
  let e = n.length, s = -1, r = 0, i = 0;
  for (; i < e; ) {
    if (s < 0) {
      if (i = Ym(n, t, i), i === -1) break;
      let o = Ho(n, i);
      s = i, r = o - i, i = o;
      continue;
    }
    if (t[i] !== st.PROSE) {
      t.fill(st.CODE_SPAN_OPEN, s, i), s = -1, i += 1;
      continue;
    }
    if (n[i] === `
` && Xm(n, i)) {
      s = -1, i += 1;
      continue;
    }
    if (n[i] !== "`") {
      i += 1;
      continue;
    }
    let a = Ho(n, i);
    a - i === r && (t.fill(st.CODE_SPAN, s, a), s = -1), i = a;
  }
  return s >= 0 ? (t.fill(st.CODE_SPAN_OPEN, s, e), { start: s, runLength: r }) : null;
}, Zm = (n) => {
  let t = new Uint8Array(n.length), e = Vm(n, t), s = Qm(n, t);
  return { text: n, regions: t, openFence: e, openSpan: s, mathMask: null, linkUrlMask: null, htmlTagMask: null };
}, Pr = null, Un = null, Ct = (n) => {
  if (Un !== null && n === Pr) return Un;
  let t = Zm(n);
  return Pr = n, Un = t, t;
}, Jm = () => {
  Pr = null, Un = null;
}, tb = (n, t) => t >= n.regions.length ? n.openFence !== null || n.openSpan !== null : t < 0 ? !1 : n.regions[t] !== st.PROSE, eb = (n, t) => n.regions[t] === st.CODE_SPAN, fi = (n, t) => {
  let e = Ct(n), s = t + t, r = 0;
  for (let i = n.indexOf(s); i !== -1; i = n.indexOf(s, i)) e.regions[i] === st.PROSE ? (r += 1, i += 2) : i += 1;
  return r;
}, gi = new Uint8Array(0), nb = (n) => n === "inlineLatex" || n === "blockLatex", sb = (n, t) => t === "[" && n === "none" ? "blockLatex" : t === "]" && n === "blockLatex" ? "none" : t === "(" && n === "none" ? "inlineLatex" : t === ")" && n === "inlineLatex" ? "none" : null, rb = (n, t) => t ? n === "blockDollar" ? "none" : "blockDollar" : n === "blockDollar" ? n : n === "inlineDollar" ? "none" : "inlineDollar", ib = (n) => n.includes("$") || n.includes("\\(") || n.includes("\\["), ab = (n, t, e) => {
  let s = n[t + 1];
  if (n[t] === "\\") {
    if (s === "$") return { context: e, length: 2 };
    let r = sb(e, s);
    return r === null ? null : { context: r, length: 2 };
  }
  if (n[t] === "$" && !nb(e)) {
    let r = s === "$";
    return { context: rb(e, r), length: r ? 2 : 1 };
  }
  return null;
}, ob = (n) => {
  let { text: t, regions: e } = n, s = t.length, r = new Uint8Array(s), i = "none", a = 0;
  for (; a < s; ) {
    r[a] = i === "none" ? 0 : 1;
    let o = e[a] === st.PROSE ? ab(t, a, i) : null;
    if (o === null) {
      a += 1;
      continue;
    }
    i = o.context, o.length === 2 && (r[a + 1] = i === "none" ? 0 : 1), a += o.length;
  }
  return r;
}, $e = (n, t) => t < 0 || t >= n.text.length ? !1 : (n.mathMask === null && (n.mathMask = ib(n.text) ? ob(n) : gi), n.mathMask[t] === 1), lb = (n, t, e, s) => {
  let { text: r, regions: i } = n, a = new Uint8Array(e - t), o = 0;
  for (let c = e - 1; c >= t; c -= 1) r[c] === ")" && i[c] === st.PROSE && (o = 1), a[c - t] = o;
  let l = !1;
  for (let c = t; c < e; c += 1) l && a[c - t] === 1 && (s[c] = 1), i[c] === st.PROSE && (r[c] === ")" ? l = !1 : r[c] === "(" && (l = c > 0 && r[c - 1] === "]"));
}, cb = (n) => {
  let { text: t } = n, e = t.length, s = new Uint8Array(e), r = 0;
  for (; r < e; ) {
    let i = t.indexOf(`
`, r);
    i === -1 && (i = e), lb(n, r, i, s), r = i + 1;
  }
  return s;
}, _i = (n, t) => t < 0 || t >= n.text.length ? !1 : (n.linkUrlMask === null && (n.linkUrlMask = n.text.includes("](") ? cb(n) : gi), n.linkUrlMask[t] === 1), db = (n) => {
  let { text: t, regions: e } = n, s = t.length, r = new Uint8Array(s), i = !1;
  for (let a = 0; a < s; a += 1) {
    if (t[a] === `
`) {
      i = !1;
      continue;
    }
    if (r[a] = i ? 1 : 0, e[a] === st.PROSE) {
      if (t[a] === ">") i = !1;
      else if (t[a] === "<") {
        let o = t[a + 1];
        i = o !== void 0 && (o >= "a" && o <= "z" || o >= "A" && o <= "Z" || o === "/");
      }
    }
  }
  return r;
}, ad = (n, t) => t < 0 || t >= n.text.length ? !1 : (n.htmlTagMask === null && (n.htmlTagMask = n.text.includes("<") ? db(n) : gi), n.htmlTagMask[t] === 1), vt = (n, t) => tb(Ct(n), t), Zt = (n, t) => eb(Ct(n), t), ub = /^(\s*(?:[-*+]|\d+[.)]) +)>(=?\s*[$]?\d)/gm, hb = (n) => !n || typeof n != "string" || !n.includes(">") ? n : n.replace(ub, (t, e, s, r) => vt(n, r) ? t : `${e}\\>${s}`), Jt = (n, { delimiter: t, markerLength: e, regex: s }) => {
  let r = n.lastIndexOf(t, n.length - 2), i = r === -1 ? n.length - 1 : r;
  return n.slice(Math.max(0, i - e + 1)).match(s);
}, pb = { delimiter: "*", markerLength: 2, regex: /(\*\*)([^*]*\*?)$/ }, fb = { delimiter: "_", markerLength: 2, regex: /(__)([^_]*?)$/ }, gb = { delimiter: "*", markerLength: 3, regex: /(\*\*\*)([^*]*?)$/ }, _b = { delimiter: "*", markerLength: 1, regex: /(\*)([^*]*?)$/ }, mb = { delimiter: "_", markerLength: 1, regex: /(_)([^_]*?)$/ }, bb = { delimiter: "~", markerLength: 2, regex: /(~~)([^~]*?)$/ }, vb = { delimiter: "_", markerLength: 2, regex: /(__)([^_]+)_$/ }, yb = { delimiter: "~", markerLength: 2, regex: /(~~)([^~]+)~$/ }, ge = /^[\s_~*`]*$/, od = /^[\s]*[-*+][\s]+$/, wb = /[\p{L}\p{N}_]/u, Sb = /^\*{4,}$/, Mt = (n) => {
  if (!n) return !1;
  let t = n.charCodeAt(0);
  return t >= 48 && t <= 57 || t >= 65 && t <= 90 || t >= 97 && t <= 122 || t === 95 ? !0 : wb.test(n);
}, Ab = (n, t) => {
  let e = 1;
  for (let s = t - 1; s >= 0; s -= 1) if (n[s] === "]") e += 1;
  else if (n[s] === "[" && (e -= 1, e === 0)) return s;
  return -1;
}, ld = (n, t) => {
  let e = 1;
  for (let s = t + 1; s < n.length; s += 1) if (n[s] === "[") e += 1;
  else if (n[s] === "]" && (e -= 1, e === 0)) return s;
  return -1;
}, kb = (n, t) => $e(Ct(n), t), gs = (n, t, e) => {
  let s = 0;
  for (let l = t - 1; l >= 0; l -= 1) if (n[l] === `
`) {
    s = l + 1;
    break;
  }
  let r = n.length;
  for (let l = t; l < n.length; l += 1) if (n[l] === `
`) {
    r = l;
    break;
  }
  let i = n.substring(s, r), a = 0, o = !1;
  for (let l of i) if (l === e) a += 1;
  else if (l !== " " && l !== "	") {
    o = !0;
    break;
  }
  return a >= 3 && !o;
}, Eb = (n, t, e, s) => e === "\\" || $e(n, t) ? !0 : e !== "*" && s === "*" ? (t < n.text.length - 2 ? n.text[t + 2] : "") !== "*" : e === "*" || (!e || e === " " || e === "	" || e === `
`) && (!s || s === " " || s === "	" || s === `
`), ss = (n) => n === " " || n === "	" || n === `
`, Cb = (n, t) => !!(n && t && Mt(n) && Mt(t)), xb = (n, t, e, s) => {
  let r = Cb(n, t), i = !!t && !ss(t), a = !!n && !ss(n);
  return r && e % 2 === 0 && !s ? { count: !1 } : a && e % 2 === 1 || i ? { count: !0, inWordAsteriskChain: r } : { count: !1 };
}, cd = (n) => {
  let t = Ct(n), e = 0, s = !1, r = n.length;
  for (let i = 0; i < r; i += 1) {
    if (n[i] !== "*" || t.regions[i] !== st.PROSE) {
      Mt(n[i]) || (s = !1);
      continue;
    }
    let a = i > 0 ? n[i - 1] : "", o = i < r - 1 ? n[i + 1] : "";
    if (Eb(t, i, a, o)) continue;
    let l = xb(a, o, e, s);
    l.count && (e += 1, s = l.inWordAsteriskChain);
  }
  return e;
}, Tb = (n, t, e, s) => !!(e === "\\" || $e(n, t) || _i(n, t) || ad(n, t) || e === "_" || s === "_" || e && s && Mt(e) && Mt(s)), Ib = (n) => {
  let t = Ct(n), e = 0, s = n.length;
  for (let r = 0; r < s; r += 1) {
    if (n[r] !== "_" || t.regions[r] !== st.PROSE) continue;
    let i = r > 0 ? n[r - 1] : "", a = r < s - 1 ? n[r + 1] : "";
    Tb(t, r, i, a) || (e += 1);
  }
  return e;
}, Rb = (n) => {
  let t = Ct(n), e = 0, s = 0;
  for (let r = 0; r < n.length; r += 1) n[r] === "*" && t.regions[r] === st.PROSE ? s += 1 : (s >= 3 && (e += Math.floor(s / 3)), s = 0);
  return s >= 3 && (e += Math.floor(s / 3)), e;
}, mi = (n) => fi(n, "*"), Bo = (n) => n === "" || n === " " || n === "	" || n === `
`, Lb = (n, t, e, s, r) => {
  if (!(Bo(e) && Bo(s))) return !1;
  if (t > r.lineEnd) {
    let i = n.indexOf(`
`, t);
    r.lineEnd = i === -1 ? n.length : i, r.result = gs(n, t, "_");
  }
  return r.result;
}, Mb = (n, t, e, s) => {
  let r = n.text, i = t, a = !1;
  i > 0 && r[i - 1] === "\\" && (i += 1, a = !0);
  let o = e - i;
  if (o < 2) return !1;
  let l = i > 0 ? r[i - 1] : "", c = a ? "\\" : l, d = e < r.length ? r[e] : "";
  return Mt(c) && Mt(d) || Lb(r, i, c, d, s) || $e(n, i) || _i(n, i) || ad(n, i) ? !1 : Math.floor(o / 2) % 2 === 1;
}, qo = (n) => {
  let t = Ct(n), e = n.length, s = { lineEnd: -1, result: !1 }, r = !1, i = 0;
  for (; i < e; ) {
    if (n[i] !== "_" || t.regions[i] !== st.PROSE) {
      i += 1;
      continue;
    }
    let a = i, o = i + 1;
    for (; o < e && n[o] === "_" && t.regions[o] === st.PROSE; ) o += 1;
    i = o, Mb(t, a, o, s) && (r = !r);
  }
  return r;
}, Ob = (n, t, e) => {
  if (!t || ge.test(t)) return !0;
  let s = n.substring(0, e).lastIndexOf(`
`), r = s === -1 ? 0 : s + 1, i = n.substring(r, e);
  return od.test(i) && t.includes(`
`) ? !0 : gs(n, e, "*");
}, $b = (n) => {
  let t = Jt(n, pb);
  if (!t) return n;
  let e = t[2], s = n.lastIndexOf(t[1]);
  return vt(n, s) || Zt(n, s) || Ob(n, e, s) ? n : mi(n) % 2 === 1 ? e.endsWith("*") ? `${n}*` : `${n}**` : n;
}, Nb = (n, t, e) => {
  if (!t || ge.test(t)) return !0;
  let s = n.substring(0, e).lastIndexOf(`
`), r = s === -1 ? 0 : s + 1, i = n.substring(r, e);
  return od.test(i) && t.includes(`
`) ? !0 : gs(n, e, "_");
}, Pb = (n) => {
  let t = Jt(n, fb);
  if (!t) {
    let r = Jt(n, vb);
    if (r) {
      let i = n.lastIndexOf(r[1]);
      if (!(vt(n, i) || Zt(n, i)) && qo(n)) return `${n}_`;
    }
    return n;
  }
  let e = t[2], s = n.lastIndexOf(t[1]);
  return vt(n, s) || Zt(n, s) || Nb(n, e, s) ? n : qo(n) ? `${n}__` : n;
}, Db = (n, t) => {
  let { text: e } = n;
  return e[t] === "*" && n.regions[t] === st.PROSE && e[t - 1] !== "*" && e[t + 1] !== "*" && e[t - 1] !== "\\" && !$e(n, t);
}, Hb = (n) => {
  let t = Ct(n);
  for (let e = n.indexOf("*"); e !== -1; e = n.indexOf("*", e + 1)) {
    if (!Db(t, e)) continue;
    let s = e > 0 ? n[e - 1] : "", r = e < n.length - 1 ? n[e + 1] : "", i = !s || ss(s), a = !r || ss(r);
    if (!(i && a) && !(s && r && Mt(s) && Mt(r)) && !a) return e;
  }
  return -1;
}, Bb = (n) => {
  if (!Jt(n, _b)) return n;
  let t = Hb(n);
  if (t === -1 || vt(n, t) || Zt(n, t)) return n;
  let e = n.substring(t + 1);
  return !e || ge.test(e) ? n : cd(n) % 2 === 1 ? `${n}*` : n;
}, dd = (n) => {
  let t = Ct(n);
  for (let e = n.indexOf("_"); e !== -1; e = n.indexOf("_", e + 1)) if (t.regions[e] === st.PROSE && n[e - 1] !== "_" && n[e + 1] !== "_" && n[e - 1] !== "\\" && !$e(t, e) && !_i(t, e)) {
    let s = e > 0 ? n[e - 1] : "", r = e < n.length - 1 ? n[e + 1] : "";
    if (s && r && Mt(s) && Mt(r)) continue;
    return e;
  }
  return -1;
}, qb = (n) => {
  let t = n.length;
  for (; t > 0 && n[t - 1] === `
`; ) t -= 1;
  if (t < n.length) {
    let e = n.slice(0, t), s = n.slice(t);
    return `${e}_${s}`;
  }
  return `${n}_`;
}, Fb = (n) => {
  if (!n.endsWith("**")) return null;
  let t = n.slice(0, -2);
  if (mi(t) % 2 !== 1) return null;
  let e = t.indexOf("**"), s = dd(t);
  return e !== -1 && s !== -1 && e < s ? `${t}_**` : null;
}, Ub = (n) => {
  if (!Jt(n, mb)) return n;
  let t = dd(n);
  if (t === -1) return n;
  let e = n.substring(t + 1);
  if (!e || ge.test(e) || vt(n, t) || Zt(n, t)) return n;
  if (Ib(n) % 2 === 1) {
    let s = Fb(n);
    return s !== null ? s : qb(n);
  }
  return n;
}, Wb = (n) => {
  let t = mi(n), e = cd(n);
  return t % 2 === 0 && e % 2 === 0;
}, zb = (n, t, e) => !t || ge.test(t) || vt(n, e) || Zt(n, e) ? !0 : gs(n, e, "*"), Gb = (n) => {
  if (Sb.test(n)) return n;
  let t = Jt(n, gb);
  if (!t) return n;
  let e = t[2], s = n.lastIndexOf(t[1]);
  return zb(n, e, s) ? n : Rb(n) % 2 === 1 ? Wb(n) ? n : `${n}***` : n;
}, jb = /<[a-zA-Z/][^>]*$/, Kb = /[a-zA-Z/]/, Vb = (n) => n.includes("$") || n.includes("\\(") || n.includes("\\["), Xb = (n, t) => {
  let e = n[t + 1];
  return e !== void 0 && Kb.test(e);
}, Yb = (n) => {
  let t = n.match(jb);
  if (!t || t.index === void 0) return n;
  let e = Vb(n);
  for (let s = t.index; s < n.length; s += 1) if (!(n[s] !== "<" || !Xb(n, s)) && !vt(n, s) && !(e && kb(n, s))) return n.substring(0, s).trimEnd();
  return n;
}, Qb = (n) => {
  let t = Ct(n);
  if (t.openFence) return n;
  let e = t.openSpan;
  if (!e) return n;
  let s = n.slice(e.start + e.runLength);
  if (!s || ge.test(s)) return n;
  let r = 0, i = n.length - 1;
  for (; i >= 0 && n[i] === "`"; ) r += 1, i -= 1;
  return r >= e.runLength ? n : n + "`".repeat(e.runLength - r);
}, Zb = (n) => fi(n, "$"), Jb = (n) => {
  let t = Ct(n), e = 0;
  for (let s = 0; s < n.length; s += 1) {
    if (n[s] === "\\") {
      s += 1;
      continue;
    }
    t.regions[s] === st.PROSE && n[s] === "$" && (s + 1 < n.length && n[s + 1] === "$" ? s += 1 : e += 1);
  }
  return e;
}, tv = (n) => {
  if (n.endsWith("$") && !n.endsWith("$$")) return `${n}$`;
  let t = n.indexOf("$$");
  return t !== -1 && n.indexOf(`
`, t) !== -1 && !n.endsWith(`
`) ? `${n}
$$` : `${n}$$`;
}, ev = (n) => Zb(n) % 2 === 0 ? n : tv(n), nv = (n) => Jb(n) % 2 === 1 ? `${n}$` : n, rs = "streamdown:incomplete-image", sv = (n, t, e) => {
  if (n.substring(t + 2).includes(")")) return null;
  let s = Ab(n, t);
  if (s === -1 || vt(n, s)) return null;
  let r = s > 0 && n[s - 1] === "!", i = r ? s - 1 : s, a = n.substring(0, i), o = n.substring(s + 1, t);
  return r ? `${a}![${o}](${rs})` : e === "text-only" ? `${a}${o}` : `${a}[${o}](streamdown:incomplete-link)`;
}, Fo = (n, t) => {
  for (let e = 0; e < t; e++) if (n[e] === "[" && !vt(n, e)) {
    if (e > 0 && n[e - 1] === "!") continue;
    let s = ld(n, e);
    if (s === -1) return e;
    if (s + 1 < n.length && n[s + 1] === "(") {
      let r = n.indexOf(")", s + 2);
      r !== -1 && (e = r);
    }
  }
  return t;
}, rv = (n, t, e) => {
  let s = t > 0 && n[t - 1] === "!", r = s ? t - 1 : t;
  if (!n.substring(t + 1).includes("]")) {
    let i = n.substring(0, r);
    if (s) {
      let a = n.substring(t + 1);
      return `${i}![${a}](${rs})`;
    }
    if (e === "text-only") {
      let a = Fo(n, t);
      return n.substring(0, a) + n.substring(a + 1);
    }
    return `${n}](streamdown:incomplete-link)`;
  }
  if (ld(n, t) === -1) {
    let i = n.substring(0, r);
    if (s) {
      let a = n.substring(t + 1);
      return `${i}![${a}](${rs})`;
    }
    if (e === "text-only") {
      let a = Fo(n, t);
      return n.substring(0, a) + n.substring(a + 1);
    }
    return `${n}](streamdown:incomplete-link)`;
  }
  return null;
}, iv = (n, t) => {
  let e = n.lastIndexOf("](");
  if (e !== -1 && !vt(n, e)) {
    let s = sv(n, e, t);
    if (s !== null) return s;
  }
  for (let s = n.lastIndexOf("["); s !== -1; s = s === 0 ? -1 : n.lastIndexOf("[", s - 1)) if (!vt(n, s)) {
    let r = rv(n, s, t);
    if (r !== null) return r;
  }
  return n;
}, av = 32, ud = (n, t = "protocol") => {
  let e = n;
  for (let s = 0; s < av; s += 1) {
    let r = iv(e, t);
    if (r.length >= e.length) return r;
    e = r;
  }
  return e;
}, ov = /^-{1,2}$/, lv = /^[\s]*-{1,2}[\s]+$/, cv = /^={1,2}$/, dv = /^[\s]*={1,2}[\s]+$/, uv = (n) => {
  if (!n || typeof n != "string") return n;
  let t = n.lastIndexOf(`
`);
  if (t === -1) return n;
  let e = n.substring(t + 1), s = n.substring(0, t), r = e.trim();
  if (ov.test(r) && !e.match(lv)) {
    let i = s.split(`
`).at(-1);
    if (i && i.trim().length > 0) return `${n}​`;
  }
  if (cv.test(r) && !e.match(dv)) {
    let i = s.split(`
`).at(-1);
    if (i && i.trim().length > 0) return `${n}​`;
  }
  return n;
}, hv = /([\p{L}\p{N}_])~(?!~)(?=[\p{L}\p{N}_])/gu, pv = (n) => !n || typeof n != "string" || !n.includes("~") ? n : n.replace(hv, (t, e, s) => {
  let r = s + e.length;
  return vt(n, r) ? t : `${e}\\~`;
}), Uo = (n) => fi(n, "~"), fv = (n) => {
  let t = Jt(n, bb);
  if (t) {
    let e = t[2];
    if (!e || ge.test(e)) return n;
    let s = n.lastIndexOf(t[1]);
    if (vt(n, s) || Zt(n, s)) return n;
    if (Uo(n) % 2 === 1) return `${n}~~`;
  } else {
    let e = Jt(n, yb);
    if (e) {
      let s = n.lastIndexOf(e[0].slice(0, 2));
      if (vt(n, s) || Zt(n, s)) return n;
      if (Uo(n) % 2 === 1) return `${n}~`;
    }
  }
  return n;
}, Js = (n) => n !== !1, gv = (n) => n === !0, bt = { SINGLE_TILDE: 0, COMPARISON_OPERATORS: 5, HTML_TAGS: 10, SETEXT_HEADINGS: 15, LINKS: 20, BOLD_ITALIC: 30, BOLD: 35, ITALIC_DOUBLE_UNDERSCORE: 40, ITALIC_SINGLE_ASTERISK: 41, ITALIC_SINGLE_UNDERSCORE: 42, INLINE_CODE: 50, STRIKETHROUGH: 60, KATEX: 70, INLINE_KATEX: 75, DEFAULT: 100 }, _v = [{ handler: { name: "singleTilde", handle: pv, priority: bt.SINGLE_TILDE }, optionKey: "singleTilde" }, { handler: { name: "comparisonOperators", handle: hb, priority: bt.COMPARISON_OPERATORS }, optionKey: "comparisonOperators" }, { handler: { name: "htmlTags", handle: Yb, priority: bt.HTML_TAGS }, optionKey: "htmlTags" }, { handler: { name: "setextHeadings", handle: uv, priority: bt.SETEXT_HEADINGS }, optionKey: "setextHeadings" }, { handler: { name: "links", handle: ud, priority: bt.LINKS }, optionKey: "links", earlyReturn: (n) => n.endsWith("](streamdown:incomplete-link)") || n.endsWith(`](${rs})`) }, { handler: { name: "boldItalic", handle: Gb, priority: bt.BOLD_ITALIC }, optionKey: "boldItalic" }, { handler: { name: "bold", handle: $b, priority: bt.BOLD }, optionKey: "bold" }, { handler: { name: "italicDoubleUnderscore", handle: Pb, priority: bt.ITALIC_DOUBLE_UNDERSCORE }, optionKey: "italic" }, { handler: { name: "italicSingleAsterisk", handle: Bb, priority: bt.ITALIC_SINGLE_ASTERISK }, optionKey: "italic" }, { handler: { name: "italicSingleUnderscore", handle: Ub, priority: bt.ITALIC_SINGLE_UNDERSCORE }, optionKey: "italic" }, { handler: { name: "inlineCode", handle: Qb, priority: bt.INLINE_CODE }, optionKey: "inlineCode" }, { handler: { name: "strikethrough", handle: fv, priority: bt.STRIKETHROUGH }, optionKey: "strikethrough" }, { handler: { name: "katex", handle: ev, priority: bt.KATEX }, optionKey: "katex" }, { handler: { name: "inlineKatex", handle: nv, priority: bt.INLINE_KATEX }, optionKey: "inlineKatex" }], mv = (n) => {
  var t;
  let e = (t = n?.linkMode) != null ? t : "protocol";
  return _v.filter(({ handler: s, optionKey: r }) => s.name === "links" ? Js(n?.links) || Js(n?.images) : s.name === "inlineKatex" ? gv(n?.inlineKatex) : Js(n?.[r])).map(({ handler: s, earlyReturn: r }) => s.name === "links" ? { handler: id(rd({}, s), { handle: (i) => ud(i, e) }), earlyReturn: e === "protocol" ? r : void 0 } : { handler: s, earlyReturn: r });
}, bv = (n, t) => {
  var e;
  if (!n || typeof n != "string") return n;
  let s = n.endsWith(" ") && !n.endsWith("  ") ? n.slice(0, -1) : n, r = mv(t), i = ((e = t?.handlers) != null ? e : []).map((o) => {
    var l;
    return { handler: id(rd({}, o), { priority: (l = o.priority) != null ? l : bt.DEFAULT }), earlyReturn: void 0 };
  }), a = [...r, ...i].sort((o, l) => {
    var c, d;
    return ((c = o.handler.priority) != null ? c : 0) - ((d = l.handler.priority) != null ? d : 0);
  });
  try {
    for (let { handler: o, earlyReturn: l } of a) if (s = o.handle(s), l != null && l(s)) return s;
    return s.endsWith(" ") && !s.endsWith("  ") ? s.slice(0, -1) : s;
  } finally {
    Jm();
  }
}, Wo = bv;
const Dr = (n) => n === void 0 || /\s/.test(n);
function hd(n, t) {
  if (n[t] !== `
`) return !1;
  for (let e = t + 1; e < n.length; e++) {
    if (n[e] === `
`) return !0;
    if (n[e] !== " " && n[e] !== "	") return !1;
  }
  return !1;
}
const vv = /^ {0,3}(?:~~~|#{1,6}(?:[ \t]|$)|>|<(?:[/!?]|(?:address|article|aside|blockquote|details|dialog|div|dl|fieldset|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|script|section|style|table|textarea|ul)(?=[\s/>]|$))|([-*_])(?:[ \t]*\1){2,}[ \t]*$)/i, yv = /^ {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]/;
function wv(n, t, e) {
  const s = n.indexOf(`
`, t + 1), r = n.slice(t + 1, s < 0 ? n.length : s);
  return vv.test(r) || e && yv.test(r);
}
function pd(n, t, e) {
  const s = n.indexOf(`
`, t), r = /\S/.test(n.slice(t, s < 0 ? n.length : s));
  for (let i = t; i < n.length; i++) {
    if (e !== "" && n.startsWith(e, i)) return { at: i, closed: !0 };
    if (n[i] === "`" || n[i] === `
` && (hd(n, i) || wv(n, i, r))) return { at: i, closed: !1 };
    n[i] === "\\" && e !== "\\)" && e !== "\\]" && i++;
  }
  return { at: n.length, closed: !1 };
}
function fd(n) {
  if (n[0] !== "$" || Dr(n[1]) || n[1] === "$") return -1;
  let t = 0;
  for (let e = 1; e < n.length; e++) {
    const s = n[e];
    if (s === "\\") {
      e++;
      continue;
    }
    if (s === "`" || hd(n, e)) return -1;
    if (s === "{") {
      t++;
      continue;
    }
    if (s === "}") {
      t = Math.max(0, t - 1);
      continue;
    }
    if (!(s !== "$" || t > 0))
      return Dr(n[e - 1]) || /\d/.test(n[e + 1] ?? "") ? -1 : e;
  }
  return -1;
}
function Hr(n, t, e) {
  const { at: s, closed: r } = pd(n, t, e);
  return r ? s : -1;
}
function is(n, t, e) {
  return pd(n, t, e).at;
}
function Br(n, t, e) {
  return n.startsWith("\\") ? /[\p{L}\p{N}]$/u.test(e) || /^\s*[\d.,]*\s*$/.test(t) : !1;
}
const qr = [
  { open: "$$", close: "$$", display: !0 },
  { open: "\\[", close: "\\]", display: !0 },
  { open: "\\(", close: "\\)", display: !1 }
];
function gd(n, t) {
  const e = [];
  let s = -1;
  for (let r = 0; r < n.length; ) {
    const i = n[r];
    if (i === "`") {
      const l = /^`+/.exec(n.slice(r))[0], c = n.indexOf(l, r + l.length);
      r = c === -1 ? r + l.length : c + l.length;
      continue;
    }
    let a = -1;
    const o = qr.find((l) => n.startsWith(l.open, r));
    if (o) {
      const l = r + o.open.length, c = Hr(n, l, o.close);
      c !== -1 ? a = c + o.close.length : t && (a = is(n, l, o.close));
    } else if (i === "\\") {
      r += 2;
      continue;
    } else if (i === "$") {
      const l = fd(n.slice(r));
      l !== -1 ? a = r + l + 1 : s < 0 && !Dr(n[r + 1]) && n[r + 1] !== "$" && (s = r);
    }
    if (a <= r) {
      r++;
      continue;
    }
    e.push([r, a]), r = a;
  }
  return { spans: e, openDollar: s };
}
function zo(n) {
  const { spans: t, openDollar: e } = gd(n, !0);
  if (e >= 0) {
    const a = is(n, e + 1, "");
    if (!t.some(([o, l]) => o < a && l > e)) {
      for (let o = e; o < a; o++) n[o] === "[" && t.push([o, o + 1]);
      t.sort((o, l) => o[0] - l[0]);
    }
  }
  const s = [];
  let r = "", i = 0;
  for (const [a, o] of t)
    r += n.slice(i, a) + `${s.length}`, s.push(n.slice(a, o)), i = o;
  return r += n.slice(i), {
    masked: r,
    unmask: (a) => a.replace(/\uE000(\d+)\uE001/g, (o, l) => s[Number(l)] ?? "")
  };
}
function Go(n, t) {
  const e = t.length - n.length;
  let s = "";
  for (let o = 0; o < n.length; o++) s += t[e + o] === "+" ? n[o] : t[e + o];
  s = s.replace(/\[a+\]/g, (o) => `\`${"a".repeat(o.length - 2)}\``);
  const r = gd(s, !1).spans.filter(([o, l]) => !Br(s.slice(o, o + 2), s.slice(o + 2, l - 2), s.slice(0, o)));
  let i = t.slice(0, e), a = 0;
  for (const [o, l] of r)
    i += t.slice(e + a, e + o) + "a".repeat(l - o), a = l;
  return i + t.slice(e + a);
}
const Sv = (n) => n.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function jo(n, t) {
  const e = n.open ? " data-aparte-open" : "", r = `<code class="language-math ${n.display ? "math-display" : "math-inline"}"${e}>${Sv(n.text)}</code>`;
  return t ? `<pre${e}>${r}</pre>
` : r;
}
function Ko(n = {}) {
  const t = n.live === !0;
  return {
    // marked looks ahead for the `*`, `_` or `~` closing an emphasis or a strikethrough
    // on a masked copy of the text; a formula left in it closes an italic opened before
    // it (`*the optimum $x^*$*`). Its `emStrongMask` hook cannot hide one: it receives a
    // copy where `\(` is already `++`, so the formulas are found on the real text here.
    // marked's own tokenizer is reached through the instance's prototype, not imported:
    // this module is the chunk both entries share, and it imports nothing from marked.
    tokenizer: {
      emStrong(e, s, r) {
        return Object.getPrototypeOf(this).emStrong.call(this, e, Go(e, s), r);
      },
      del(e, s, r) {
        return Object.getPrototypeOf(this).del.call(this, e, Go(e, s), r);
      }
    },
    extensions: [
      {
        name: "aparteMathBlock",
        level: "block",
        // Where a block may start inside this paragraph. marked hands `start` the
        // source minus its first character, so only a real newline marks a line.
        start(e) {
          const s = e.search(/\n[ \t]*\n/), r = /\n {0,3}(\$\$|\\\[)/.exec(s < 0 ? e : e.slice(0, s));
          return r ? r.index + 1 : void 0;
        },
        tokenizer(e) {
          const s = /^ {0,3}(\$\$|\\\[)/.exec(e);
          if (!s) return;
          const r = qr.find((d) => d.open === s[1]), i = s[0].length, a = Hr(e, i, r.close);
          if (a === -1)
            return !t || is(e, i, r.close) < e.length ? void 0 : { type: "aparteMathBlock", raw: e, text: e.slice(i).trim(), display: !0, open: !0 };
          const o = e.slice(i, a).trim();
          if (Br(r.open, o, "")) return;
          const l = /^[ \t]*(\n|$)/.exec(e.slice(a + r.close.length));
          return l ? { type: "aparteMathBlock", raw: e.slice(0, a + r.close.length + l[0].length), text: o, display: !0, open: !1 } : void 0;
        },
        renderer: (e) => jo(e, !0)
      },
      {
        name: "aparteMathInline",
        level: "inline",
        start(e) {
          const s = e.search(/\$|\\[([]/);
          return s === -1 ? void 0 : s;
        },
        tokenizer(e, s) {
          for (const i of qr) {
            if (!e.startsWith(i.open)) continue;
            const a = Hr(e, i.open.length, i.close);
            if (a === -1)
              return !t || i.open !== "$$" && /[\p{L}\p{N}]$/u.test(s.at(-1)?.raw ?? "") || is(e, i.open.length, i.close) < e.length ? void 0 : { type: "aparteMathInline", raw: e, text: e.slice(i.open.length), display: i.display, open: !0 };
            const o = e.slice(i.open.length, a);
            return Br(i.open, o, s.at(-1)?.raw ?? "") ? void 0 : { type: "aparteMathInline", raw: e.slice(0, a + i.close.length), text: o, display: i.display, open: !1 };
          }
          const r = fd(e);
          if (r !== -1)
            return { type: "aparteMathInline", raw: e.slice(0, r + 1), text: e.slice(1, r), display: !1, open: !1 };
        },
        renderer: (e) => jo(e, !1)
      }
    ]
  };
}
const Vo = "streamdown:", Av = /(^|[ \t])[*_~`]+$/;
function kv(n, t) {
  const e = n.replace(Av, "$1");
  if (!t) return Wo(e);
  let { masked: s, unmask: r } = zo(e);
  return /$/.test(s) && /[\s\\]$/.test(e) && ({ masked: s, unmask: r } = zo(e.replace(/[\s\\]+$/, ""))), r(Wo(s, { katex: !1 }));
}
function Ev(n, t, e) {
  const s = document.createElement("template");
  if (s.innerHTML = n, t) {
    for (const r of s.content.querySelectorAll(`a[href^="${Vo}"]`)) r.removeAttribute("href");
    for (const r of s.content.querySelectorAll(`img[src^="${Vo}"]`)) r.remove();
  }
  return s.innerHTML = e.sanitizeHtml(s.innerHTML), Array.from(s.content.childNodes);
}
function Cv(n, t, e) {
  let s = "", r = [];
  const i = (a) => {
    const o = (a ? t.arriving : t.finished).lexer(s);
    let l = 0;
    for (; l < o.length && l < r.length; ) {
      const d = a && l === o.length - 1, h = r[l];
      if (h.raw !== o[l].raw || h.healed !== d) break;
      l++;
    }
    for (const d of r.slice(l)) for (const h of d.nodes) h.remove();
    const c = r.slice(0, l);
    for (let d = l; d < o.length; d++) {
      const h = o[d].raw, u = a && d === o.length - 1, p = u ? t.arriving.parse(kv(h, t.math), { async: !1 }) : t.finished.parse(h, { async: !1 }), f = Ev(p, u, e);
      n.append(...f), c.push({ raw: h, healed: u, nodes: f });
    }
    r = c;
  };
  return {
    write(a) {
      s += a, i(!0);
    },
    end() {
      i(!1);
    }
  };
}
function xv(n, t = _t) {
  const { math: e, ...s } = {}, r = et;
  let i, a;
  const o = () => e ?? t.hasCodeLanguageRenderer("math"), l = () => i ??= new Nr(s, Ko()), c = () => a ??= new Nr(s, Ko({ live: !0 }));
  t.setMarkdownProvider((d) => (o() ? l() : r).parse(d, { async: !1 })), t.setStreamingMarkdownProvider((d) => {
    const h = o();
    return Cv(d, h ? { finished: l(), arriving: c(), math: !0 } : { finished: r, arriving: r, math: !1 }, t);
  });
}
class Tv {
  constructor(t) {
    this.key = t;
  }
  read() {
    try {
      return JSON.parse(sessionStorage.getItem(this.key) ?? "[]");
    } catch {
      return [];
    }
  }
  write(t) {
    try {
      sessionStorage.setItem(this.key, JSON.stringify(t));
    } catch {
    }
  }
  async loadAll() {
    return this.read();
  }
  async save(t) {
    const e = this.read(), s = e.findIndex((r) => r.id === t.id);
    s >= 0 ? e[s] = t : e.push(t), this.write(e);
  }
  async delete(t) {
    this.write(this.read().filter((e) => e.id !== t));
  }
}
class oe extends Error {
  constructor(t, e) {
    super(t), this.name = "StorageError", this.status = e;
  }
}
const Xo = (n) => n instanceof oe && (n.status === 0 || n.status === 408 || n.status === 429 || n.status >= 500), Iv = (n) => n instanceof oe && (n.status === 401 || n.status === 419), Rv = (n) => new Promise((t) => setTimeout(t, n));
function Lv({ messages: n, tree: t, ...e }) {
  return e;
}
class Mv {
  constructor(t, { csrf: e = "", onProblem: s = () => {
  } } = {}) {
    this.url = t.replace(/\/+$/, ""), this.csrf = e, this.onProblem = s, this.unsent = /* @__PURE__ */ new Map(), this.sending = null, this.reload = null, this.timer = null, this.delay = 0, this.told = /* @__PURE__ */ new Set(), this.stopped = !1, this.catchUp = this.catchUp.bind(this), this.onVisible = () => {
      document.visibilityState === "visible" && this.catchUp();
    }, window.addEventListener("online", this.catchUp), document.addEventListener("visibilitychange", this.onVisible);
  }
  /** Stop sending and listening: the page is being left. */
  stop() {
    this.stopped = !0, clearTimeout(this.timer), window.removeEventListener("online", this.catchUp), document.removeEventListener("visibilitychange", this.onVisible);
  }
  /**
   * Laravel's token against forged requests, as it stands now: the cookie it sends again
   * with every answer when there is one, else the token the page was drawn with, which goes
   * stale when the session changes hands.
   */
  token() {
    const t = document.cookie.split("; ").find((e) => e.startsWith("XSRF-TOKEN="));
    return t ? { "X-XSRF-TOKEN": decodeURIComponent(t.slice(11)) } : { "X-CSRF-TOKEN": this.csrf };
  }
  async request(t, e, s) {
    const r = e === void 0 ? this.url : `${this.url}/${encodeURIComponent(e)}`;
    let i;
    try {
      i = await fetch(r, {
        method: t,
        credentials: "same-origin",
        // A redirect is to a sign-in page, not to a conversation: it is not followed.
        redirect: "manual",
        headers: { Accept: "application/json", ...s ? { "Content-Type": "application/json" } : {}, ...this.token() },
        ...s ? { body: JSON.stringify(s) } : {}
      });
    } catch {
      throw new oe(`aparté: ${t} ${r} did not reach the server.`, 0);
    }
    if (i.type === "opaqueredirect")
      throw new oe(`aparté: the server redirected ${t} ${r}, as it does when nobody is signed in.`, 401);
    if (!i.ok)
      throw new oe(`aparté: the server answered ${i.status} to ${t} ${r}.`, i.status);
    return i;
  }
  /** Tell, once for each thing that went wrong, what is not kept. */
  problem(t, e, s) {
    const r = `${t}:${s ?? ""}`;
    this.told.has(r) || (this.told.add(r), console.warn(`aparté: ${t === "gone" ? "a conversation is no longer on the server" : "the conversations are not being kept"} (${t}).`, e), this.onProblem({ reason: t, status: e?.status ?? 0, ...s ? { conversationId: s } : {} }));
  }
  async loadMeta() {
    for (let t = 0; ; t++)
      try {
        const e = (await (await this.request("GET")).json()).conversations ?? [], s = new Set(e.map((r) => r.id));
        return [...[...this.unsent.values()].filter((r) => !s.has(r.id)).map(Lv), ...e];
      } catch (e) {
        if (t === 2 || !Xo(e)) throw e;
        await Rv(400 * 3 ** t);
      }
  }
  async loadFull(t) {
    if (this.unsent.has(t)) return this.unsent.get(t);
    try {
      return await (await this.request("GET", t)).json();
    } catch (e) {
      if (e instanceof oe && e.status === 404)
        return this.problem("gone", e, t), null;
      throw e;
    }
  }
  async loadAll() {
    const t = await this.loadMeta();
    return (await Promise.all(t.map(({ id: e }) => this.loadFull(e)))).filter(Boolean);
  }
  async save(t) {
    this.unsent.set(t.id, t), await this.flush();
  }
  /**
   * Send what the server does not have: one conversation at a time and never two requests
   * at once, so an older state never lands after a newer one.
   */
  flush() {
    return this.sending ??= (async () => {
      try {
        for (; this.unsent.size > 0 && !this.stopped; ) {
          const [t, e] = this.unsent.entries().next().value;
          try {
            await this.request("PUT", t, e);
          } catch (s) {
            if (Xo(s)) {
              this.problem("unreachable", s), this.later();
              return;
            }
            if (Iv(s)) {
              this.problem("signed-out", s);
              return;
            }
            this.unsent.get(t) === e && this.unsent.delete(t), this.problem(s?.status === 413 ? "too-large" : "refused", s, t);
            continue;
          }
          this.unsent.get(t) === e && this.unsent.delete(t);
        }
        this.unsent.size === 0 && (this.delay = 0, this.told.clear());
      } finally {
        this.sending = null;
      }
    })(), this.sending;
  }
  /** Ask the server again later, at longer and longer intervals. */
  later() {
    this.timer || this.stopped || (this.delay = Math.min((this.delay || 1e3) * 2, 6e4), this.timer = setTimeout(() => {
      this.timer = null, this.catchUp();
    }, this.delay));
  }
  /** The list could not be read when the chat started: read it (`reload`) once the server answers. */
  whenBack(t) {
    this.reload = t, this.later();
  }
  /** What is still owed: the conversations not sent, then the list not read. */
  async catchUp() {
    if (this.stopped || (await this.flush(), this.unsent.size > 0 || !this.reload)) return;
    const t = this.reload;
    try {
      await t(), this.reload === t && (this.reload = null), this.delay = 0;
    } catch {
      this.later();
    }
  }
  async delete(t) {
    this.unsent.delete(t);
    try {
      await this.request("DELETE", t);
    } catch (e) {
      if (!(e instanceof oe && e.status === 404)) throw e;
    }
  }
  /** A title, a pin or an archive date, without the messages travelling. */
  async change(t, e) {
    const s = this.unsent.get(t);
    if (s) {
      const r = { ...s };
      for (const [i, a] of Object.entries(e))
        a === null ? delete r[i] : r[i] = a;
      "title" in e && (r.autoTitle = !1), this.unsent.set(t, r), await this.flush();
      return;
    }
    await this.request("PATCH", t, e);
  }
  rename(t, e) {
    return this.change(t, { title: e });
  }
  pin(t) {
    return this.change(t, { pinnedAt: Date.now() });
  }
  unpin(t) {
    return this.change(t, { pinnedAt: null });
  }
  archive(t) {
    return this.change(t, { archivedAt: Date.now() });
  }
  unarchive(t) {
    return this.change(t, { archivedAt: null });
  }
}
function Ov(n, t) {
  if (typeof n?.body != "string") return n;
  const e = JSON.parse(n.body);
  if (!Array.isArray(e.resume)) return n;
  for (const s of e.resume) {
    const r = t[s.interruptId]?.instruction;
    r && (s.payload = { ...s.payload, instruction: r });
  }
  return { ...n, body: JSON.stringify(e) };
}
function $v(n, t) {
  const e = n.querySelector("[data-aparte-empty-state]");
  if (!e) return;
  const s = new MutationObserver(() => r());
  function r() {
    t.getMessages().length !== 0 && (e.hidden = !0, s.disconnect());
  }
  s.observe(t, { childList: !0, subtree: !0 }), r();
}
let Yo = !1;
function Nv() {
  if (Yo) return;
  Yo = !0;
  const n = document.documentElement, t = () => {
    n.dataset.aparteTheme = n.classList.contains("dark") ? "dark" : "light";
  };
  new MutationObserver(t).observe(n, { attributes: !0, attributeFilter: ["class"] }), t();
}
const bi = [], _d = [];
function Gv(n) {
  _d.push(n);
  for (const t of bi) t.stops.push(md(n, t.config, t.chat, t.options));
}
function md(n, t, e, s) {
  try {
    return n(t, e, s);
  } catch (r) {
    console.error("aparté: a function given to onAparteSetup failed.", r);
    return;
  }
}
const Qo = /* @__PURE__ */ new Set();
function bd(n) {
  const t = n.getAttribute("for") || (n.localName === "aparte-conversation-list" ? n.getAttribute("target") : null);
  if (t) {
    const e = document.getElementById(t);
    return e?.localName === "aparte-chat" ? e : (Qo.has(t) || (Qo.add(t), console.warn(`aparté: an element names the chat "${t}", and no <aparte-chat> of the page has that id.`)), null);
  }
  for (let e = n.parentElement; e; e = e.parentElement) {
    const s = e.querySelector("aparte-chat[data-aparte-endpoint]");
    if (s) return s;
  }
  return null;
}
function Pv(n) {
  const t = (e) => [...document.querySelectorAll(e)].filter((s) => bd(s) === n);
  return {
    lists: () => t("aparte-conversation-list"),
    titles: () => t("[data-aparte-title]"),
    any: () => t("aparte-conversation-list, [data-aparte-new-chat]").length > 0
  };
}
function Dv(n, t, e, s, r) {
  const i = /* @__PURE__ */ new WeakSet(), a = /* @__PURE__ */ new WeakMap(), o = () => {
    const u = e.active, p = e.activeConversations.map(({ id: f, title: _, updatedAt: g, pinnedAt: v }) => ({ id: f, title: _, updatedAt: g, pinnedAt: v }));
    for (const f of r.lists())
      i.has(f) || (ll(f, t), f.hasAttribute("target") || f.setAttribute("target", n.id), i.add(f)), f.conversations = p, u ? f.setAttribute("active-id", u.id) : f.removeAttribute("active-id");
    for (const f of r.titles())
      a.has(f) || a.set(f, f.getAttribute("data-aparte-title") || f.textContent), f.textContent = u?.title || a.get(f);
  }, l = (u) => {
    const p = u.closest("aparte-sidebar");
    p?.drawer && p.close();
  }, c = (u) => {
    if (u.detail?.targetId !== n.id) return;
    const p = u.target?.closest?.("aparte-conversation-list");
    p && l(p);
  }, d = (u) => {
    const p = u.target?.closest?.("[data-aparte-new-chat]");
    !p || bd(p) !== n || (l(p), s.setConversationId(null), n.querySelector("aparte-composer-input")?.focus());
  };
  document.addEventListener("aparte-conversation-select", c), document.addEventListener("click", d);
  const h = e.subscribe(o);
  return o(), () => {
    document.removeEventListener("aparte-conversation-select", c), document.removeEventListener("click", d), h();
  };
}
async function Hv(n) {
  n.dataset.aparteMounted = "";
  const {
    aparteEndpoint: t,
    aparteCsrf: e,
    aparteThread: s,
    aparteScope: r,
    aparteConversations: i
  } = n.dataset, a = new wr();
  ll(n, a), xv(void 0, a);
  let o;
  const l = pt();
  let c = {};
  const d = Pv(n), h = i ? new Mv(i, {
    csrf: e ?? "",
    onProblem: (A) => {
      A.reason === "gone" && o?.init().catch(() => {
      }), n.dispatchEvent(new CustomEvent("aparte-conversations-problem", { detail: A, bubbles: !0, composed: !0 }));
    }
  }) : null, u = { storage: h ?? new Tv(`aparte-laravel:${t}:${r ?? ""}:${n.id}`), client: {} }, p = !!s && !i && !d.any();
  if (s && !p && console.warn(`aparté: this chat has a list of conversations, so each is its own thread and thread="${s}" is not used.`), t) {
    const A = I_({
      endpoint: t,
      threadId: () => p && s || o?.activeId || l,
      headers: { "X-CSRF-TOKEN": e ?? "" },
      fetch: (C, b) => fetch(C, Ov(b, c))
    });
    u.client.streamRunner = (C) => (c = C.deferral?.outcomes ?? {}, A(C));
  }
  const f = { chat: n, config: a, options: u, stops: [], stopped: !1, storage: null };
  f.stops = _d.map((A) => md(A, a, n, u)), f.storage = u.storage, bi.push(f), o = new yf(u.storage), a.setConversationManager(o);
  const _ = n.viewport, g = new Af({
    hostId: n.id,
    host: n,
    getMessages: () => _.getMessages(),
    setMessages: (A) => _.setMessages(A),
    appendMessage: (A) => _.appendMessage(A),
    clearMessages: (A) => _.clearAll(A),
    setLoading: (A) => _.setLoading(A),
    exportTree: () => _.exportTree(),
    importTree: (A) => _.importTree(A)
  });
  g.bind();
  const v = new Zf({ ...u.client, config: a, scopeToTargetId: n.id });
  v.start(), Object.assign(f, { client: v, controller: g, unbindUi: Dv(n, a, o, g, d) }), $v(n, _);
  const S = d.lists();
  for (const A of S) A.setAttribute("loading", "");
  try {
    await o.init();
  } catch (A) {
    u.storage === h ? (console.warn("aparté: the conversations could not be loaded; they will be when the server answers.", A), h.whenBack(() => o.init())) : console.warn("aparté: the conversations could not be loaded; this chat goes on without them.", A);
  } finally {
    for (const A of S) A.removeAttribute("loading");
  }
  f.stopped || o.activeId || await g.setConversationId(o.activeConversations[0]?.id ?? null);
}
function tr() {
  const n = document.querySelectorAll("aparte-chat[data-aparte-endpoint]:not([data-aparte-mounted])");
  n.length !== 0 && ([...n].some((t) => "aparteFollowDark" in t.dataset) && Nv(), customElements.whenDefined("aparte-chat").then(() => n.forEach((t) => {
    Hv(t).catch((e) => console.error("aparté: a chat did not start.", e));
  })));
}
function Bv() {
  for (const n of bi.splice(0)) {
    n.stopped = !0, delete n.chat.dataset.aparteMounted;
    try {
      for (const t of n.stops) typeof t == "function" && t();
      n.storage?.stop?.(), n.unbindUi?.(), n.controller?.unbind(), n.client?.stop();
    } catch (t) {
      console.error("aparté: a chat did not stop cleanly.", t);
    }
  }
}
globalThis.__aparteLaravel ? console.warn("aparté for Laravel is loaded twice on this page; the second copy does nothing. If your app imports it, set APARTE_ASSETS=vite so that the package stops serving its own.") : (globalThis.__aparteLaravel = !0, document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", tr, { once: !0 }) : setTimeout(tr), document.addEventListener("livewire:navigating", Bv), document.addEventListener("livewire:navigated", tr));
export {
  Gv as onAparteSetup
};
