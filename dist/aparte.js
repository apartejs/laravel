const Ai = /* @__PURE__ */ new Set();
function ec(s) {
  const t = String(s?.type ?? "undefined");
  Ai.has(t) || (Ai.add(t), console.warn(
    `[runStreamAgent] Ignoring unrecognised stream event "${t}". The reply is unaffected; this usually means the provider or its SDK emits a part this version of aparté does not map yet.`
  ));
}
async function Ei(s) {
  const {
    transportCall: t,
    toolLookup: e,
    toolConfigLookup: n,
    approvalResolver: i,
    emitter: r,
    signal: a,
    maxTurns: o = 10,
    toolTimeoutMs: l = 3e5,
    deferral: c
  } = s;
  let d = s.baseRequest, u = 0;
  const h = s.idGen ?? ((y) => `${y}-${u++}`), p = [...d.messages], f = (y) => {
    p.push(y), s.onHistoryAppend?.(y);
  };
  let _ = !0, g = 0, m, A;
  r({ type: "run-start" });
  const k = c ? nc(p) : [];
  if (k.length > 0) {
    const y = [], b = { turns: 1, maxTurns: o, toolLookup: e, toolConfigLookup: n, approvalResolver: i, emitter: r, signal: a, toolTimeoutMs: l, declareCall: () => {
    }, append: f, deferral: c };
    for (const [v, w] of k.entries()) {
      if (y.length > 0) {
        y.push({ toolCallId: w.id, name: w.name, input: w.input, reason: Ci(w, n) });
        continue;
      }
      let T;
      try {
        T = await Ti(w, b);
      } catch (S) {
        for (const x of k.slice(v + 1)) r({ type: "tool-aborted", toolCallId: x.id });
        throw S;
      }
      if (typeof T == "object") {
        y.push({ toolCallId: w.id, name: w.name, input: w.input, reason: T.defer });
        continue;
      }
      if (T === "stop-run") {
        for (const S of k.slice(v + 1)) r({ type: "tool-aborted", toolCallId: S.id });
        _ = !1;
        break;
      }
    }
    if (y.length > 0 && !a.aborted) {
      r({ type: "run-suspended", pending: y });
      return;
    }
  }
  for (; _ && !a.aborted; ) {
    if (g++, A = void 0, g > o) {
      r({ type: "turn-limit-exceeded", scope: "global", limit: o });
      break;
    }
    const y = d.toolChoice;
    if (g === 1 && y && typeof y == "object" && !Array.isArray(y) && y.input !== void 0) {
      const D = y, P = h("synthetic-tool");
      r({ type: "tool-start", toolCallId: P, name: D.name, input: D.input });
      const at = e(D.name);
      if (!at) {
        r({ type: "tool-aborted", toolCallId: P, cause: "no-handler" }), _ = !1;
        continue;
      }
      const z = await Ha(at, { id: P, name: D.name, input: D.input }, a, l);
      if (z.status === "aborted") {
        r(z.cause ? { type: "tool-aborted", toolCallId: P, cause: z.cause } : { type: "tool-aborted", toolCallId: P }), _ = !1;
        continue;
      }
      if (z.status === "failed")
        throw r({ type: "tool-failed", toolCallId: P, error: Ba(z.error) }), z.error;
      r({ type: "tool-resolved", toolCallId: P, result: z.content, structuredResult: z.structuredContent }), f({ role: "assistant", content: "", toolCalls: [{ id: P, name: D.name, input: D.input }] }), f({ role: "tool", content: z.content, toolCallId: P, toolName: D.name }), d = { ...d, toolChoice: "none", tools: void 0 };
    }
    const b = { ...d, messages: p }, v = d.toolChoice;
    v && typeof v == "object" && (d = { ...d, toolChoice: "auto" });
    let w;
    try {
      w = await t(b);
    } catch (D) {
      if (a.aborted || D?.name === "AbortError") {
        _ = !1;
        break;
      }
      throw D;
    }
    if (typeof w == "string") {
      r({ type: "turn-start" }), r({ type: "text-delta", delta: w }), r({ type: "text-flush" });
      break;
    }
    r({ type: "turn-start" });
    let T = "";
    const S = [];
    let x = !1, L = null;
    const E = (D) => {
      S.push(D), !L && (L = { role: "assistant", content: T.trim(), toolCalls: S }, f(L));
    }, N = () => {
      L && (L.content = T.trim());
    }, G = /* @__PURE__ */ new Set(), j = (D) => {
      let P = D;
      for (let at = 2; G.has(P); at++) P = `${D}#${at}`;
      return G.add(P), P;
    }, X = [], tt = {
      turns: g,
      maxTurns: o,
      toolLookup: e,
      toolConfigLookup: n,
      approvalResolver: i,
      emitter: r,
      signal: a,
      toolTimeoutMs: l,
      declareCall: E,
      append: f,
      deferral: c && { ...c, outcomes: void 0 }
    }, dt = w[Symbol.asyncIterator](), Et = async () => {
      if (!a.aborted) return !1;
      try {
        await dt.return?.(void 0);
      } catch {
      }
      return _ = !1, !0;
    };
    try {
      for (; !await Et(); ) {
        const D = await dt.next();
        if (await Et() || D.done) break;
        const P = D.value;
        if (P.type === "thinking") {
          r({ type: "thinking-delta", delta: P.delta });
          continue;
        }
        if (P.type === "text") {
          T += P.delta, r({ type: "text-delta", delta: P.delta });
          continue;
        }
        if (P.type === "sources") {
          r({ type: "sources", sources: P.sources, ...P.citations ? { citations: P.citations } : {} });
          continue;
        }
        if (P.type === "done") {
          P.usage && (m = P.usage), P.finishReason && (A = P.finishReason);
          continue;
        }
        if (P.type === "error")
          throw P.code === void 0 ? new Error(P.message) : Object.assign(new Error(P.message), { code: P.code });
        if (P.type !== "tool_use") {
          ec(P);
          continue;
        }
        x = !0;
        const at = j(P.id);
        r({ type: "tool-start", toolCallId: at, name: P.name, input: P.input });
        const z = { id: at, name: P.name, input: P.input };
        if (X.length > 0) {
          E(z);
          const Qt = Ci(z, n);
          Qt === "approval" && r({ type: "tool-awaiting-approval", toolCallId: z.id, name: z.name, input: z.input }), X.push({ toolCallId: z.id, name: z.name, input: z.input, reason: Qt });
          continue;
        }
        const Yt = await Ti(z, tt);
        if (typeof Yt == "object") {
          E(z), X.push({ toolCallId: z.id, name: z.name, input: z.input, reason: Yt.defer });
          continue;
        }
        if (Yt === "stop-run") {
          _ = !1;
          break;
        }
        if (Yt === "stop-turn") break;
      }
      r({ type: "text-flush" }), N();
    } finally {
      try {
        await dt.return?.(void 0);
      } catch {
      }
    }
    if (X.length > 0 && !a.aborted)
      return r({ type: "run-suspended", pending: X, usage: m }), m;
    x || (_ = !1);
  }
  return a.aborted && r({ type: "run-aborted" }), r({ type: "run-done", usage: m, ...A ? { finishReason: A } : {} }), m;
}
function nc(s) {
  for (let t = s.length - 1; t >= 0; t--) {
    const e = s[t];
    if (e.role === "assistant") {
      if (!e.toolCalls?.length) return [];
      const n = new Set(s.slice(t + 1).filter((i) => i.role === "tool").map((i) => i.toolCallId));
      return e.toolCalls.filter((i) => !n.has(i.id));
    }
    if (e.role !== "tool") return [];
  }
  return [];
}
function Ci(s, t) {
  const e = t?.(s.name);
  if (e?.external) return "external";
  const n = typeof e?.needsApproval == "function" ? e.needsApproval({ id: s.id, name: s.name, input: s.input }) : e?.needsApproval;
  return n && n !== "deny" ? "approval" : "queued";
}
function Da(s) {
  const t = s.reason?.trim(), e = s.by ?? (t ? "policy" : "person"), n = t || (e === "policy" ? "Tool execution was refused by the approval policy." : e === "earlier-refusal" ? "Not run: an earlier call of the same step was refused." : s.instruction ? `The user rejected this tool call and said: ${s.instruction}` : "Tool execution was rejected by the user.");
  return s.instruction ? { reason: n, by: e, instruction: s.instruction } : { reason: n, by: e };
}
function xi(s, t, e) {
  const n = Da(e);
  return s.emitter({ type: "tool-rejected", toolCallId: t.id, ...n }), s.declareCall(t), s.append({ role: "tool", content: n.reason, toolCallId: t.id, toolName: t.name }), "stop-turn";
}
async function Ti(s, t) {
  const { signal: e } = t, n = s.input, i = t.toolConfigLookup?.(s.name), r = t.deferral?.outcomes?.[s.id];
  if (r?.kind === "decision" && !r.approved) return xi(t, s, r);
  const a = i?.maxTurns ?? t.maxTurns;
  if (t.turns > a)
    return t.emitter({ type: "turn-limit-exceeded", scope: "tool", limit: a, toolCallId: s.id }), "stop-run";
  if (i?.external) {
    if (!t.deferral)
      return t.emitter({ type: "tool-aborted", toolCallId: s.id, cause: "no-handler" }), "stop-run";
    if (!r || r.kind === "decision") return { defer: "external" };
    if (r.kind === "failed")
      throw t.emitter({ type: "tool-failed", toolCallId: s.id, error: r.error }), new Error(r.error);
    return t.emitter({ type: "tool-resolved", toolCallId: s.id, result: r.content, structuredResult: r.structuredContent }), t.declareCall(s), t.append({ role: "tool", content: r.content, toolCallId: s.id, toolName: s.name }), "continue";
  }
  const o = t.toolLookup(s.name);
  if (!o)
    return t.emitter({ type: "tool-aborted", toolCallId: s.id, cause: "no-handler" }), "stop-run";
  let l = s.input;
  const c = typeof i?.needsApproval == "function" ? i.needsApproval({ id: s.id, name: s.name, input: n }) : i?.needsApproval;
  if (c) {
    const u = r?.kind === "decision" && c !== "deny" ? r : void 0;
    if (c !== "deny" && !u && t.emitter({ type: "tool-awaiting-approval", toolCallId: s.id, name: s.name, input: s.input }), !u && t.deferral && c !== "deny") return { defer: "approval" };
    if (!u && !t.approvalResolver)
      return t.emitter({ type: "tool-aborted", toolCallId: s.id, cause: "no-resolver" }), "stop-run";
    let h = u;
    if (!h && !e.aborted && t.approvalResolver)
      try {
        h = await t.approvalResolver(
          { id: s.id, name: s.name, input: n },
          e
        );
      } catch (p) {
        if (!e.aborted && p?.name !== "AbortError") throw p;
      }
    if (e.aborted || !h)
      return t.emitter({ type: "tool-aborted", toolCallId: s.id, cause: "stopped" }), "stop-run";
    if (!h.approved)
      return xi(t, s, h), "stop-turn";
    h.payload && typeof h.payload == "object" && !Array.isArray(h.payload) && (l = { ...n, ...h.payload }), t.emitter({ type: "tool-approved", toolCallId: s.id });
  }
  const d = await Ha(
    o,
    { id: s.id, name: s.name, input: l },
    e,
    t.toolTimeoutMs
  );
  if (d.status === "aborted")
    return t.emitter(d.cause ? { type: "tool-aborted", toolCallId: s.id, cause: d.cause } : { type: "tool-aborted", toolCallId: s.id }), "stop-run";
  if (d.status === "failed")
    throw t.emitter({ type: "tool-failed", toolCallId: s.id, error: Ba(d.error) }), d.error;
  return t.emitter({ type: "tool-resolved", toolCallId: s.id, result: d.content, structuredResult: d.structuredContent }), t.declareCall(s), t.append({ role: "tool", content: d.content, toolCallId: s.id, toolName: s.name }), "continue";
}
async function Ha(s, t, e, n) {
  if (e.aborted) return { status: "aborted", cause: "stopped" };
  const i = new AbortController(), r = () => i.abort();
  e.addEventListener("abort", r, { once: !0 });
  let a;
  const o = new Promise((u) => {
    a = () => u({ status: "aborted", cause: "stopped" }), e.addEventListener("abort", a, { once: !0 });
  });
  let l, c = !1;
  const d = new Promise((u) => {
    l = setTimeout(() => {
      c = !0, i.abort(), u({ status: "aborted", cause: "timeout" });
    }, n);
  });
  try {
    return await Promise.race([
      s(t, i.signal).then((h) => ({ status: "resolved", content: h.content, structuredContent: h.structuredContent })),
      d,
      o
    ]);
  } catch (u) {
    return u?.name === "AbortError" ? e.aborted ? { status: "aborted", cause: "stopped" } : c ? { status: "aborted", cause: "timeout" } : { status: "aborted" } : { status: "failed", error: u };
  } finally {
    clearTimeout(l), e.removeEventListener("abort", r), a && e.removeEventListener("abort", a);
  }
}
function Ba(s) {
  return s instanceof Error ? s.message || s.name : typeof s == "string" ? s : String(s);
}
const sc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/></svg>', ic = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5 9.5 17.5 19.5 7"/></svg>', rc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3 3.7 10.4a.9.9 0 0 0 .1 1.7l6.2 2 2 6.2a.9.9 0 0 0 1.7.1L21 3Z"/><path d="M10 14 21 3"/></svg>', ac = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="aparte-icon aparte-icon-spin"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>', oc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.75v5"/><path d="M12 16.25h.01"/></svg>', lc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 9.5 12 16l6.5-6.5"/></svg>', cc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 14.5 12 8l6.5 6.5"/></svg>', dc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4.5h5.5V10"/><path d="M10 19.5H4.5V14"/><path d="m19.5 4.5-6 6"/><path d="m4.5 19.5 6-6"/></svg>', uc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 10H14V4.5"/><path d="M4.5 14H10v5.5"/><path d="m14 10 5.5-5.5"/><path d="m10 14-5.5 5.5"/></svg>', hc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6.5 10.5 12 5 17.5"/><path d="M13 18h6"/></svg>', pc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.4 21a5.2 5.2 0 0 1-3.7-8.9l8.6-8.6a3.5 3.5 0 0 1 4.9 4.9l-8.6 8.6a1.7 1.7 0 0 1-2.5-2.5l7.4-7.4"/></svg>', fc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="8.5" cy="9" r="1.5"/><path d="M20.5 15.5l-4-4-8 8"/></svg>', gc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8.5Z"/><path d="M13.5 3v5.5H19"/></svg>', _c = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5v15"/><path d="M6 13.5l6 6 6-6"/></svg>', mc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.35-5.65L4 8.5"/><path d="M4 3.5v5h5"/></svg>', bc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5H6a2 2 0 0 0-2 2v11.5a2 2 0 0 0 2 2h11.5a2 2 0 0 0 2-2V13"/><path d="M17.75 3.25a2.05 2.05 0 0 1 2.9 2.9l-9.15 9.15-3.9 1 1-3.9Z"/></svg>', vc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 10.5v10"/><path d="M6.5 10.5h3l3.2-6.4a1.75 1.75 0 0 1 3.3.8V9h4a2 2 0 0 1 2 2.35l-1.3 7.3a2 2 0 0 1-2 1.6H9.5"/></svg>', yc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 13.5v-10"/><path d="M17.5 13.5h-3l-3.2 6.4a1.75 1.75 0 0 1-3.3-.8V15h-4a2 2 0 0 1-2-2.35l1.3-7.3a2 2 0 0 1 2-1.6h9.1"/></svg>', wc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6 9 12l5.5 6"/></svg>', Sc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6 15 12l-5.5 6"/></svg>', kc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5a5.5 5.5 0 0 0-5.1 7.6L3.5 17l3.5 3.5 5.9-5.9a5.5 5.5 0 0 0 7.6-5.1l-3.1 3.1-2.7-.8-.8-2.7 3.1-3.1Z"/></svg>', Ac = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11"/><path d="M17.5 6.5l-11 11"/></svg>', Ec = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5"/></svg>', Cc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.5" height="14" rx="1.5"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5"/></svg>', xc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.25"/><path d="M12 7.75h.01"/></svg>', Tc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 21 8"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><polyline points="9 14 12 11 15 14"/><line x1="12" y1="11" x2="12" y2="19"/></svg>', Ic = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 21 8"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><polyline points="9 14 12 17 15 14"/><line x1="12" y1="11" x2="12" y2="17"/></svg>', Rc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v12m0 0-4.5-4.5M12 15.5l4.5-4.5M4.5 20h15"/></svg>', Mc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18.5" cy="12" r="1.1"/></svg>', Lc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 3.5h7"/><path d="M10 3.5v5l-3 3.5V14h10v-2l-3-3.5v-5"/><path d="M12 14v6.5"/></svg>', Oc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M8 7V5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 5v2"/><path d="m6.5 7 .8 12a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/><path d="M10 11v5.5M14 11v5.5"/></svg>', $c = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9.5L4.5 21V6.5A2.5 2.5 0 0 1 6.5 4Z"/></svg>', Nc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M4.5 12h15M4.5 17h15"/></svg>', Pc = '<svg class="aparte-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 4.3 2.9 18a1.5 1.5 0 0 0 1.3 2.3h15.6a1.5 1.5 0 0 0 1.3-2.3L13.3 4.3a1.5 1.5 0 0 0-2.6 0Z"/><path d="M12 9.5V14M12 17.2v.1"/></svg>', Dc = {
  copy: sc,
  check: ic,
  send: rc,
  loading: ac,
  error: oc,
  expand: lc,
  collapse: cc,
  maximize: dc,
  minimize: uc,
  terminal: hc,
  paperclip: pc,
  image: fc,
  file: gc,
  scrollDown: _c,
  retry: mc,
  edit: bc,
  thumbUp: vc,
  thumbDown: yc,
  prevBranch: wc,
  nextBranch: Sc,
  tool: kc,
  close: Ac,
  stop: Ec,
  pause: Cc,
  info: xc,
  archive: Tc,
  unarchive: Ic,
  download: Rc,
  more: Mc,
  pin: Lc,
  trash: Oc,
  menu: Nc,
  alertTriangle: Pc,
  messageSquare: $c
};
function qa(s) {
  return typeof s == "string" ? s : s.filter((t) => t.type === "text").map((t) => t.text).join("");
}
var U = /* @__PURE__ */ ((s) => (s.CONFIG_NO_PROVIDER = "CONFIG_NO_PROVIDER", s.CONFIG_MISSING_KEY = "CONFIG_MISSING_KEY", s.CONFIG_INVALID_KEY = "CONFIG_INVALID_KEY", s.CONFIG_INVALID_MODEL = "CONFIG_INVALID_MODEL", s.USAGE_RATE_LIMIT = "USAGE_RATE_LIMIT", s.USAGE_CONTEXT_EXCEEDED = "USAGE_CONTEXT_EXCEEDED", s.USAGE_BAD_REQUEST = "USAGE_BAD_REQUEST", s.NET_OFFLINE = "NET_OFFLINE", s.NET_TIMEOUT = "NET_TIMEOUT", s.NET_ERROR = "NET_ERROR", s.PROVIDER_ERROR = "PROVIDER_ERROR", s.PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE", s.PROVIDER_POLICY = "PROVIDER_POLICY", s.PROVIDER_MISCONFIGURED = "PROVIDER_MISCONFIGURED", s.MAX_TURNS_EXCEEDED = "MAX_TURNS_EXCEEDED", s.UNKNOWN_ERROR = "UNKNOWN_ERROR", s))(U || {});
class Z extends Error {
  constructor(t, e, n, i, r) {
    super(t), this.message = t, this.code = e, this.data = n, this.originalError = i, this.httpStatus = r, this.name = "AparteError";
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
  static from(t, e = "UNKNOWN_ERROR", n) {
    if (t instanceof Z) return t;
    const i = t instanceof Error ? t.message : String(t), r = t?.status || t?.statusCode || n, a = t?.code, o = e !== "UNKNOWN_ERROR" ? e : Z.carriedCode(a) ?? Z.codeForStatus(r) ?? Z.codeForFailure(t) ?? e;
    return new Z(i, o, void 0, t, r);
  }
  /** The value as an {@link AparteErrorCode}, when it is one — a Node `ECONNRESET` or a vendor's own string is not. */
  static carriedCode(t) {
    return typeof t == "string" && Object.values(U).includes(t) ? t : void 0;
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
const ze = Dc, ve = {
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
function Hc(s) {
  return typeof s.buildRequest == "function" && typeof s.parseStream == "function" && typeof s.defaultEndpoint == "string" && (typeof s.authHeaders == "function" || typeof s.authQuery == "function");
}
function Bc(s) {
  return typeof s == "string" ? { key: s } : s && typeof s == "object" ? { key: s.apiKey, endpoint: s.endpoint } : {};
}
function qc(s, t, e) {
  const n = s?.error, i = typeof n == "object" ? n?.message : n;
  return typeof i == "string" && i ? i : `${e} ${t}`;
}
function Fc(s) {
  return typeof s == "string" && Object.values(U).includes(s);
}
async function Uc(s, t = "HTTP", e) {
  const n = await s.json().catch(() => {
  }), i = qc(n, s.status, t), r = n?.error?.code, a = e?.classifyError?.(s.status, n) ?? (Fc(r) ? r : void 0) ?? Z.codeForStatus(s.status) ?? U.UNKNOWN_ERROR;
  return new Z(i, a, void 0, void 0, s.status);
}
async function Wc(s, t, e) {
  const n = await t.json();
  if (typeof s.parseText != "function")
    throw new Error(`Provider "${e}" cannot resolve a non-streaming response: parseText is not implemented.`);
  const i = s.parseText(n);
  let r;
  try {
    r = s.parseSources?.(n);
  } catch {
    r = void 0;
  }
  return zc(i, r);
}
function zc(s, t) {
  if (!t || t.sources.length === 0) return s;
  const e = [{ type: "text", delta: s }, { type: "sources", ...t }, { type: "done" }];
  return new ReadableStream({
    pull(n) {
      const i = e.shift();
      i ? n.enqueue(i) : n.close();
    }
  });
}
class Gc {
  byok;
  warnedBrowserKey = !1;
  constructor(t = {}) {
    this.byok = t.byok ?? !1;
  }
  async chat(t, e, n, i) {
    const { key: r, endpoint: a } = Bc(n);
    if (!this.byok && r && this.warnBrowserKeyOnce(i.providerId), !Hc(t)) {
      if (typeof t.chat != "function")
        throw new Error(`Provider "${i.providerId}" exposes neither a format-adapter surface nor chat().`);
      return t.chat(e, n, i);
    }
    const o = a || t.defaultEndpoint, l = t.buildRequest(e);
    let c = `${o}${l.path}`;
    const d = { "Content-Type": "application/json", ...l.headers };
    if (r && t.authHeaders && Object.assign(d, t.authHeaders(r)), r && t.authQuery) {
      const h = new URLSearchParams(t.authQuery(r)).toString();
      c += (c.includes("?") ? "&" : "?") + h;
    }
    const u = await fetch(c, {
      method: "POST",
      headers: d,
      body: JSON.stringify(l.body),
      signal: i.signal
    });
    if (!u.ok)
      throw await Uc(u, "HTTP", t);
    if (e.stream === !1)
      return Wc(t, u, i.providerId);
    if (!u.body)
      throw new Error(`Provider "${i.providerId}" returned no response body for a streaming request.`);
    return t.parseStream(u.body);
  }
  warnBrowserKeyOnce(t) {
    this.warnedBrowserKey || (this.warnedBrowserKey = !0, console.warn(
      `[Aparte] AparteDirectTransport is sending the "${t}" API key straight from the browser — it is visible to anyone who opens devtools. Fine for BYOK or local models: pass new AparteDirectTransport({ byok: true }) to silence this. For a server-held key, use AparteBackendTransport so the key never reaches the client.`
    ));
  }
}
function J() {
  return typeof crypto < "u" && typeof crypto.randomUUID == "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
const jc = [
  { start: "<think>", end: "</think>" },
  { start: "<thinking>", end: "</thinking>" }
];
class hs {
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
    this._thinkingDelimiters = e ? Array.isArray(e) ? e : [e] : jc, this._blocks = t.blocks ?? [], this._options = {
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
      const n = this._parseNext();
      if (!n)
        break;
      n.segment && e.push(n.segment), this._state.buffer = n.remaining;
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
    const t = [], e = (n) => n.replace(/\n?```[ \t]*$/, "");
    if (this._state.activeSegment) {
      if ("content" in this._state.activeSegment) {
        const n = this._state.activeSegment;
        let i = n.content + this._state.buffer;
        (n.type === "text" || n.type === "code") && (i = e(i)), n.content = i;
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
    let n = -1;
    for (const c of this._thinkingDelimiters) {
      const d = t.indexOf(c.start);
      d !== -1 && (n === -1 || d < n) && (n = d);
    }
    let i = -1, r;
    for (const c of this._blocks) {
      const d = this._indexOfTag(t, c.tag);
      d !== -1 && (i === -1 || d < i) && (i = d, r = c);
    }
    const a = [];
    if (e !== -1 && a.push({ type: "code", index: e }), n !== -1 && a.push({ type: "thinking", index: n }), i !== -1 && a.push({ type: "block", index: i }), a.sort((c, d) => c.index - d.index), a.length === 0)
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
      const c = this._startBlock(t, r);
      return c ? c.segment && l ? (this._pendingSegment = c.segment, { segment: l, remaining: c.remaining }) : { segment: l ?? c.segment, remaining: c.remaining } : (l && (this._state.activeSegment = l), null);
    }
  }
  _startCodeBlock(t) {
    const e = t.indexOf(`
`);
    if (e === -1)
      return null;
    const i = t.slice(0, e).slice(3).trim() || "markdown";
    return i === "markdown" || i === "md" ? { segment: null, remaining: t.slice(e + 1) } : (this._state.mode = "code", this._state.codeLanguage = i, this._state.activeSegment = this._createCodeSegment(i, ""), this._state.activeSegment.isStreaming = !0, { segment: null, remaining: t.slice(e + 1) });
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
    const n = t.slice(0, e);
    this._state.activeSegment && "content" in this._state.activeSegment && (this._state.activeSegment.content += n);
    const i = this._closed(this._state.activeSegment);
    this._state.mode = "text", this._state.activeSegment = null;
    const r = t.slice(e + 4), a = r.startsWith(`
`) ? r.slice(1) : r;
    return { segment: i, remaining: a };
  }
  _startThinkingBlock(t) {
    const e = this._thinkingDelimiters.find((n) => t.startsWith(n.start));
    return e ? (this._state.mode = "thinking", this._state.thinkingEnd = e.end, this._state.activeSegment = this._createThinkingSegment(""), { segment: null, remaining: t.slice(e.start.length) }) : null;
  }
  _parseThinkingMode(t) {
    const e = this._state.thinkingEnd ?? this._thinkingDelimiters[0].end, n = t.indexOf(e);
    if (n === -1) {
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
    const i = t.slice(0, n);
    this._state.activeSegment && "content" in this._state.activeSegment && (this._state.activeSegment.content += i);
    const r = this._closed(this._state.activeSegment);
    return this._state.mode = "text", this._state.activeSegment = null, this._state.thinkingEnd = void 0, { segment: r, remaining: t.slice(n + e.length) };
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
    const n = "<" + e;
    let i = 0;
    for (; ; ) {
      const r = t.indexOf(n, i);
      if (r === -1) return -1;
      const a = t[r + n.length];
      if (a === void 0) return -1;
      if (a === ">" || a === "/" || /\s/.test(a)) return r;
      i = r + 1;
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
    let n = null, i = !1, r = -1;
    for (let a = 1 + e.length; a < t.length; a++) {
      const o = t[a];
      if (o === ">" && r === -1 && (r = a), n) {
        if (o === n) n = null;
        else if (o === `
`) return r;
        continue;
      }
      if (o === ">") return a;
      if (o === "=") {
        i = !0;
        continue;
      }
      if (i && (o === '"' || o === "'")) {
        n = o, i = !1;
        continue;
      }
      /\s/.test(o) || (i = !1);
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
    const n = this._tagEnd(t, e.tag);
    if (n === -1) return null;
    const i = t.slice(1 + e.tag.length, n), r = i.trimEnd().endsWith("/"), a = r ? i.trimEnd().slice(0, -1) : i, o = /* @__PURE__ */ Object.create(null);
    for (const d of a.matchAll(/([A-Za-z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g))
      o[d[1]] = d[2] ?? d[3] ?? d[4] ?? "";
    const l = e.toSegment({ attrs: o, id: this._options.autoGenerateIds ? this._generateId() : "" });
    l.content = "";
    const c = t.slice(n + 1);
    return r ? { segment: this._closed(l), remaining: c } : (l.isStreaming = !0, this._state.mode = "block", this._state.blockEnd = `</${e.tag}>`, this._state.activeSegment = l, { segment: null, remaining: c });
  }
  /**
   * Stream the body of the open block until its closing tag — the same
   * partial-delimiter handling the thinking mode uses, so a closing
   * tag split across two chunks is never emitted as content.
   */
  _parseBlockMode(t) {
    const e = this._state.blockEnd, n = t.indexOf(e), i = this._state.activeSegment;
    if (n === -1) {
      if (this._isPartialMatch(t, e)) {
        const a = this._getPartialMatchLength(t, e), o = t.slice(0, t.length - a);
        return o && i && (i.content += o), o ? { segment: null, remaining: t.slice(-a) } : null;
      }
      if (t.length > e.length) {
        const a = t.slice(0, -e.length);
        return i && (i.content += a), { segment: null, remaining: t.slice(-e.length) };
      }
      return null;
    }
    i && (i.content += t.slice(0, n));
    const r = this._closed(this._state.activeSegment);
    return this._state.mode = "text", this._state.activeSegment = null, this._state.blockEnd = void 0, { segment: r, remaining: t.slice(n + e.length) };
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
    return ++this._state.segmentCounter, `${this._options.idPrefix}-${J()}`;
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
    for (let n = 1; n < e.length; n++)
      if (t.endsWith(e.slice(0, n)))
        return !0;
    return !1;
  }
  _getPartialMatchLength(t, e) {
    for (let n = e.length - 1; n >= 1; n--)
      if (t.endsWith(e.slice(0, n)))
        return n;
    return 0;
  }
}
function Kc(s, t) {
  const e = new hs(t), n = e.parse(s), i = e.finalize();
  return [...n.segments, ...i];
}
const Vc = /* @__PURE__ */ new Set(["pending", "awaiting-approval"]), Xc = ["content", "output", "result"];
function Yc(s) {
  return Xc.some((t) => t in s);
}
function Ii(s, t, e, n) {
  const i = Jc(t, n);
  return {
    ...i,
    messageId: t.messageId ?? e,
    index: t.index ?? s.length,
    // A start already present is kept — a segment a consumer rebuilt from their own
    // storage keeps the number it was persisted with. `adoptSegment` is the path
    // that never writes one at all.
    ...hn(i, { startedAt: Tn(t)?.startedAt ?? Date.now() })
  };
}
function Qc(s, t, e, n = !1) {
  return {
    ...t,
    messageId: e,
    index: s.length,
    isStreaming: !1,
    ...t.type === "tool_call" && (t.status === "awaiting-approval" || t.status === "pending" && !n) && !t.deferred?.ticket ? { status: "aborted" } : {}
  };
}
const Zc = /* @__PURE__ */ new Set(["id", "type", "messageId", "index"]);
function Tn(s) {
  return s.meta?.aparte;
}
function hn(s, t) {
  return { meta: { ...s.meta, aparte: { ...s.meta?.aparte, ...t } } };
}
function Jc(s, t) {
  if (!t) return s;
  const e = { ...s };
  for (const [n, i] of Object.entries(t))
    if (!(Zc.has(n) || n in s)) {
      if (n === "meta") {
        const { aparte: r, ...a } = i ?? {};
        e.meta = a;
        continue;
      }
      e[n] = i;
    }
  return e;
}
function Wt(s) {
  return s.type === "tool_call" ? !Vc.has(s.status) : s.isStreaming === !1;
}
function td(s, t) {
  if (Wt(s)) return t;
  const e = { ...s, ...t };
  if (Wt(e)) {
    const n = Tn(s)?.endedAt;
    return { ...t, ...hn(s, { endedAt: n ?? Date.now() }) };
  }
  return Yc(t) ? { ...t, ...hn(s, { endedAt: Date.now() }) } : t;
}
function Fa(s, t) {
  const e = { ...s, ...t };
  return "meta" in t ? {
    ...e,
    meta: {
      ...s.meta,
      ...t.meta,
      // Neither side's timing wins by accident: whichever one carries it, wins,
      // and a consumer writing `meta` without an `aparte` key keeps ours.
      ...s.meta?.aparte || t.meta?.aparte ? { aparte: { ...s.meta?.aparte, ...t.meta?.aparte } } : {}
    }
  } : e;
}
function ed(s) {
  const { startedAt: t, endedAt: e } = Tn(s) ?? {};
  if (!(t == null || e == null))
    return e - t;
}
function nd(s) {
  return Wt(s) ? {} : hn(s, { endedAt: Date.now() });
}
function Dn(s) {
  return {
    content: s.content,
    ...s.isStreaming === !1 ? { isStreaming: !1 } : {}
  };
}
function Ua(s) {
  return s != null && s !== "streaming" && s !== "pending";
}
function sd(s) {
  return s.filter((t) => !Wt(t)).map((t) => t.id);
}
function nn(s) {
  if (!s.segments?.length) return { ...s };
  const t = s.status === "streaming" || s.status === "pending";
  return {
    ...s,
    segments: s.segments.reduce((e, n) => (e.push(Qc(e, n, s.id, t)), e), [])
  };
}
function id(s) {
  for (let t = 0; t < s.length; t++) {
    const e = s[t];
    e.index !== t && (s[t] = { ...e, index: t });
  }
}
const pn = "data-aparte-host", fn = Symbol.for("aparte.instanceConfig");
function rd(s, t, e) {
  if (t === e) return;
  const n = (i) => {
    const r = i.aparteConfigChanged;
    typeof r == "function" && r.call(i, t, e);
  };
  n(s);
  for (const i of s.querySelectorAll("*")) n(i);
}
function ad(s, t) {
  const e = s[fn] ?? I(s.parentElement);
  s[fn] = t, s.setAttribute(pn, ""), rd(s, t, e);
}
function I(s) {
  const t = `[${pn}]`;
  let e = s?.closest?.(t);
  for (; e && !e[fn]; ) e = e.parentElement?.closest(t);
  return e?.[fn] ?? lt;
}
let sn = null;
function nt(s, t) {
  const e = sn;
  sn = s;
  try {
    return t();
  } finally {
    sn = e;
  }
}
function R(s) {
  return sn ?? I(s);
}
function ut(s, t, e, n) {
  const i = n ?? (s.id || void 0), r = e && typeof e == "object" ? { targetId: i, ...e } : e;
  s.dispatchEvent(new CustomEvent(t, { bubbles: !0, composed: !0, detail: r }));
}
function $(s) {
  let t = "";
  for (let e = 0; e < s.length; e++) {
    const n = s[e];
    n === "&" ? t += "&amp;" : n === "<" ? t += "&lt;" : n === ">" ? t += "&gt;" : n === '"' ? t += "&quot;" : n === "'" ? t += "&#039;" : t += n;
  }
  return t;
}
const O = $, xe = "aparte-code-drawing", Wa = "aparte-code-pending", Ri = "data-aparte-open", za = "data-aparte-drawn", od = 4 * 1024 * 1024;
class ld {
  entries = /* @__PURE__ */ new Map();
  size = 0;
  get(t) {
    const e = this.entries.get(t);
    return e && (this.entries.delete(t), this.entries.set(t, e)), e;
  }
  set(t, e) {
    const n = this.entries.get(t);
    n && (this.size -= Hn(t, n), this.entries.delete(t));
    const i = { html: e };
    this.entries.set(t, i), this.size += Hn(t, i);
    for (const [r, a] of this.entries) {
      if (this.size <= od || r === t) break;
      this.entries.delete(r), this.size -= Hn(r, a);
    }
    return i;
  }
}
const Hn = (s, t) => s.length + (t.html?.length ?? 0), kt = /* @__PURE__ */ new WeakMap(), js = /* @__PURE__ */ new WeakMap(), Mi = /* @__PURE__ */ new WeakMap(), Li = /* @__PURE__ */ new WeakMap(), Oi = /* @__PURE__ */ new WeakMap(), Ga = /* @__PURE__ */ new WeakMap(), ja = /* @__PURE__ */ new WeakMap(), Ka = /* @__PURE__ */ new WeakMap(), $i = /* @__PURE__ */ new WeakSet(), Ni = /* @__PURE__ */ new WeakSet(), Bn = /* @__PURE__ */ new WeakMap(), Pi = /* @__PURE__ */ new WeakMap(), Ge = /* @__PURE__ */ new WeakMap();
function cd(s) {
  let t = Mi.get(s);
  return t || (t = new ld(), Mi.set(s, t)), t;
}
function dd(s) {
  let t = Li.get(s);
  return t || (t = /* @__PURE__ */ new Map(), Li.set(s, t)), t;
}
function Di(s, t) {
  let e = s.get(t);
  return e || (e = /* @__PURE__ */ new Map(), s.set(t, e)), e;
}
function Te(s, t) {
  $i.has(s) || ($i.add(s), console.warn(`[aparte] The ${s.languages.join("/")} renderer failed; the source is shown instead.`, t));
}
function ud(s) {
  for (const t of Array.from(s.classList))
    if (t.startsWith("language-")) return t.slice(9).toLowerCase() || null;
  return null;
}
function hd(s) {
  return s.classList.contains("math-display") ? !0 : s.classList.contains("math-inline") ? !1 : s.parentElement?.tagName === "PRE";
}
function pd(s) {
  return s.hasAttribute(Ri) || s.parentElement?.tagName === "PRE" && s.parentElement.hasAttribute(Ri);
}
function fd(s, t) {
  let e = "";
  try {
    e = s.cacheKey?.(t) ?? "";
  } catch (n) {
    Te(s, n);
  }
  return `${t.language}${t.display ? "d" : "i"}${e}${t.source}`;
}
function Va(s) {
  return typeof s?.then == "function";
}
function gd(s) {
  return s.closest("pre") ?? kt.get(s)?.drawing ?? s;
}
function _d(s) {
  return s.closest("pre") ?? s.parentElement ?? s;
}
const qn = /* @__PURE__ */ new Set(), Fn = /* @__PURE__ */ new Map();
let Un = !1;
function In(s, t) {
  t ? Fn.set(s, t) : qn.add(s), !Un && (Un = !0, queueMicrotask(() => {
    Un = !1;
    const e = [...qn], n = [...Fn];
    qn.clear(), Fn.clear();
    for (const i of e) bd(i);
    for (const [i, r] of n) i.isConnected && ae(i, r);
  }));
}
const Hi = /* @__PURE__ */ new WeakMap();
function md(s, t, e) {
  let n = Hi.get(s);
  if (!n) {
    const i = /* @__PURE__ */ new Map();
    Hi.set(s, i), n = i, s.then(
      () => {
        for (const [r, a] of i) In(r, a);
        i.clear();
      },
      () => i.clear()
    );
  }
  (!n.has(t) || e === void 0) && n.set(t, e);
}
let qt = null;
function Xa(s) {
  for (let t = s.parentElement; t; t = t.parentElement) {
    const e = getComputedStyle(t).overflowY;
    if (e === "auto" || e === "scroll") return t;
  }
  return null;
}
function bd(s) {
  if (!s.isConnected) return;
  const t = Xa(s), e = t ? t.getBoundingClientRect().top + (parseFloat(getComputedStyle(t).scrollPaddingTop) || 0) : 0;
  qt = { scroller: t, top: e };
  try {
    ae(s, Ka.get(s) ?? {});
  } finally {
    qt = null;
  }
}
function vd(s, t) {
  const e = gd(s);
  if (Ni.has(e) || typeof IntersectionObserver > "u") return !1;
  const n = Xa(e);
  let i = Pi.get(IntersectionObserver);
  i || (i = { byScroller: /* @__PURE__ */ new WeakMap() }, Pi.set(IntersectionObserver, i));
  let r = n ? i.byScroller.get(n) : i.page;
  if (!r) {
    const a = new IntersectionObserver((o) => {
      for (const l of o) {
        const c = l.target;
        if (c.isConnected && !l.isIntersecting) continue;
        a.unobserve(c);
        const d = (Ge.get(a) ?? 1) - 1;
        if (Ge.set(a, d), d <= 0 && (a.disconnect(), n ? i.byScroller.delete(n) : i.page === a && (i.page = void 0)), !c.isConnected) continue;
        Ni.add(c);
        const u = Bn.get(c);
        u && In(u);
      }
    }, { root: n, rootMargin: "100% 0px" });
    r = a, n ? i.byScroller.set(n, a) : i.page = a;
  }
  return Bn.get(e) !== t && (Bn.set(e, t), Ge.set(r, (Ge.get(r) ?? 0) + 1), r.observe(e)), !0;
}
function Se(s, t, e, n, i, r, a = !0) {
  if (e.html === null) {
    ie(t, i.open);
    return;
  }
  const o = qt ? _d(t) : null, l = o ? o.getBoundingClientRect() : null, c = kt.get(t);
  let d = c?.drawing;
  if (d || (d = document.createElement("span"), d.className = xe, i.display && d.setAttribute("data-aparte-display", ""), n.bare ? d.setAttribute("data-aparte-bare", "") : d.setAttribute("dir", "ltr"), t.after(d), js.set(d, t), t.parentElement?.tagName === "PRE" && t.parentElement.setAttribute(za, "")), c?.entry !== e || d.childNodes.length === 0) {
    let u = a ? Oi.get(s) : void 0;
    a && !u && (u = /* @__PURE__ */ new WeakMap(), Oi.set(s, u));
    const h = u?.get(e);
    if (h && h.owner !== t && !h.owner.isConnected && t.isConnected && !h.drawing.isConnected && h.drawing.childNodes.length > 0)
      d.replaceChildren(...h.drawing.childNodes), h.drawing.remove(), ie(h.owner, !1);
    else {
      d.innerHTML = e.html;
      try {
        n.relabel?.(d, i);
      } catch (f) {
        Te(n, f);
      }
    }
    u && (c && c.entry !== e && u.get(c.entry)?.drawing === d && u.delete(c.entry), u.set(e, { drawing: d, owner: t }));
  }
  if (t.hidden = !0, t.style.setProperty("display", "none"), t.classList.remove(Wa), kt.set(t, { renderer: n, key: r, drawing: d, entry: e, ctx: i }), o && l && qt) {
    const u = o.getBoundingClientRect().height - l.height;
    u > 0 && l.bottom <= qt.top && (qt.scroller ? qt.scroller.scrollTop += u : window.scrollBy(0, u));
  }
}
function ie(s, t) {
  const e = kt.get(s);
  e && (e.drawing.remove(), kt.delete(s)), s.parentElement?.tagName === "PRE" && s.parentElement.removeAttribute(za), s.hidden = !1, s.style.removeProperty("display"), s.classList.toggle(Wa, t);
}
function yd(s, t, e, n, i, r) {
  const a = fd(e, n);
  let o = kt.get(t);
  if (o && o.renderer === e && o.key === a && o.drawing.childNodes.length > 0) return;
  const l = cd(e), c = l.get(a);
  if (c) {
    Se(s, t, c, e, n, a, !r);
    return;
  }
  if (!o && !r) {
    const f = Ga.get(s)?.get(i);
    f && n.source.startsWith(f.source) && Se(s, t, f, e, n, null), o = kt.get(t);
  }
  if (e.lazy && !r && !o && vd(t, s)) return;
  const d = dd(e), u = d.get(a);
  if (u) {
    md(u, s, r);
    return;
  }
  let h;
  try {
    h = e.render(n);
  } catch (f) {
    Te(e, f), h = null;
  }
  if (!Va(h)) {
    Se(s, t, l.set(a, h ?? null), e, n, a, !r);
    return;
  }
  const p = h.then((f) => (d.delete(a), l.set(a, f ?? null), f), (f) => {
    throw d.delete(a), Te(e, f), f;
  });
  d.set(a, p), p.then(() => In(s, r), () => {
  });
}
function wd(s, t, e, n, i) {
  const r = Di(Ga, s), a = r.get(i);
  a && n.source.startsWith(a.source) ? kt.get(t)?.entry !== a && Se(s, t, a, e, n, null) : (r.delete(i), ie(t, !0));
  const o = Di(ja, s);
  if (o.get(i) === n.source) return;
  o.set(i, n.source);
  const l = () => {
    o.get(i) === n.source && o.delete(i);
  }, c = (u) => {
    if (u == null) return !1;
    const h = r.get(i);
    return h && !n.source.startsWith(h.source) ? !1 : (r.set(i, { source: n.source, html: u }), !0);
  };
  let d;
  try {
    d = e.render(n);
  } catch {
    d = null;
  }
  if (!Va(d)) {
    c(d) ? Se(s, t, r.get(i), e, n, null) : d == null && l();
    return;
  }
  d.then((u) => {
    c(u) ? In(s) : u == null && l();
  }, l);
}
function Sd(s) {
  for (const t of ["code", "kbd", "samp"])
    for (const e of Array.from(s.getElementsByTagName(t))) e.hasAttribute("dir") || e.setAttribute("dir", "ltr");
}
function ae(s, t = {}) {
  if (typeof document > "u") return;
  const { streaming: e = !1, refresh: n = !1, language: i } = t;
  if (!n && (Sd(s), Ka.set(s, { streaming: e }), e || ja.delete(s), !R(s).hasCodeLanguageRenderer())) {
    s.querySelector(`.${xe}`) && Ya(s);
    return;
  }
  const r = Array.from(s.querySelectorAll('code[class*="language-"]')).filter((o) => !o.closest(`.${xe}`)), a = /* @__PURE__ */ new Map();
  r.forEach((o, l) => {
    const c = ud(o);
    if (!c || i && c !== i) return;
    const d = R(n ? o : s), u = d.getCodeLanguageRenderer(c), h = kt.get(o);
    if (n && (!h || h.key === null)) return;
    if (!u) {
      h && ie(o, !1);
      return;
    }
    const p = hd(o), f = `${c}|${p ? "d" : "i"}`, _ = a.get(f) ?? 0;
    a.set(f, _ + 1);
    const g = `${f}|${_}`, m = o.textContent ?? "";
    if (!m.trim()) {
      h && ie(o, !1);
      return;
    }
    const A = e && (pd(o) || l === r.length - 1), k = { language: c, source: m, display: p, open: A, host: o, config: d };
    A ? wd(s, o, u, k, g) : yd(s, o, u, k, g, n ? t : void 0);
  });
}
function Ya(s) {
  for (const t of Array.from(s.querySelectorAll(`.${xe}`))) {
    const e = js.get(t);
    e ? ie(e, !1) : t.remove();
  }
}
function kd(s) {
  for (const t of Array.from(s.querySelectorAll(`.${xe}`))) {
    const e = js.get(t), n = e ? kt.get(e) : void 0;
    if (n)
      try {
        n.renderer.relabel?.(t, n.ctx);
      } catch (i) {
        Te(n.renderer, i);
      }
  }
}
function ps(s, t) {
  return !!s && R(t).hasCodeLanguageRenderer(s);
}
const Qa = /* @__PURE__ */ new Set([
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
]), Ks = /* @__PURE__ */ new Set([
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
]), Ad = /* @__PURE__ */ new Set([
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
]), Ed = {
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
}, Cd = /* @__PURE__ */ new Set(["href", "src"]), xd = /^(?:https?:|mailto:|tel:|ftp:|sms:)/i, Td = /^(?:[#/.?]|[a-z0-9._~%+-]+(?:[/?#]|$))/i, Id = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon|svg\+xml)[;,]/i, Za = /[\u0000-\u0020]+/g, Bi = /^(?:https?:)?[/\\]{2}|^https?:/i, Rd = /^aparte-/i, Md = /* @__PURE__ */ new Set([
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
]), Ld = ["data-aparte-dialog-", "data-aparte-sidebar-", "data-checkpoint-"];
function Od(s) {
  return Md.has(s) || Ld.some((t) => s.startsWith(t));
}
const $d = /* @__PURE__ */ new Set([
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
function Nd(s, t) {
  const e = t === "source" ? "img" : t;
  for (const n of s.matchAll(/(?:^|[^a-z0-9+.-])([a-z][a-z0-9+.-]*:[^\s,]*)/gi))
    if (!Rn(n[1], e)) return !1;
  return !0;
}
function Rn(s, t) {
  const e = s.replace(Za, "");
  return !e || xd.test(e) || t === "img" && Id.test(e) ? !0 : /^[a-z][a-z0-9+.-]*:/i.test(e) ? !1 : Td.test(e);
}
const Pd = /* @__PURE__ */ new Set([
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
function Dd(s) {
  return s.includes("\\") ? !1 : s.startsWith("--") && !s.startsWith("--aparte-");
}
function Hd(s) {
  const t = [];
  for (const e of s.split(";")) {
    const n = e.trim(), i = n.indexOf(":");
    if (i === -1) continue;
    const r = n.slice(0, i).trim().toLowerCase(), a = n.slice(i + 1);
    a.trim() && (!Pd.has(r) && !Dd(r) || a.includes("\\") || /url\s*\(|expression\s*\(|javascript:|vbscript:|[<>]/i.test(a) || t.push(n));
  }
  return t.length ? t.join("; ") : null;
}
function fs(s, t, e) {
  const n = Ed[s];
  if (t.startsWith("on") || t.startsWith("formaction") || !t.startsWith("data-") && !Ad.has(t) && !(n && n.has(t)) || Od(t) || t === "role" && e.trim().toLowerCase().split(/\s+/).some((i) => $d.has(i)) || Cd.has(t) && !Rn(e, s) || t === "srcset" && !Nd(e, s)) return null;
  if (t === "style") return Hd(e);
  if (t === "class") {
    const i = e.split(/\s+/).filter((r) => r && !Rd.test(r));
    return i.length ? i.join(" ") : null;
  }
  return e;
}
function Ja(s, t) {
  const e = s.replace(Za, ""), n = t.trim().toLowerCase();
  return n === "_self" && !Bi.test(e) ? [["target", "_self"]] : n || Bi.test(e) ? [["target", "_blank"], ["rel", "noopener noreferrer"]] : [];
}
function Bd(s, t, e) {
  for (const n of Array.from(s.attributes)) {
    const i = n.name.toLowerCase(), r = fs(e, i, n.value);
    r !== null && t.setAttribute(i, r);
  }
  if (e === "a")
    for (const [n, i] of Ja(t.getAttribute("href") ?? "", s.getAttribute("target") ?? "")) t.setAttribute(n, i);
}
function gs(s, t, e) {
  for (const n of Array.from(s.childNodes)) {
    if (n.nodeType === 3) {
      t.appendChild(e.createTextNode(n.nodeValue ?? ""));
      continue;
    }
    if (n.nodeType !== 1) continue;
    const i = n, r = i.tagName.toLowerCase();
    if (Qa.has(r)) continue;
    if (!Ks.has(r)) {
      gs(i, t, e);
      continue;
    }
    const a = r === "input";
    if (a && (i.getAttribute("type") ?? "").trim().toLowerCase() !== "checkbox") continue;
    const o = e.createElement(r);
    Bd(i, o, r), a && (o.setAttribute("type", "checkbox"), o.setAttribute("disabled", "")), gs(i, o, e), t.appendChild(o);
  }
}
const qd = /* @__PURE__ */ new Set(["html", "head", "body"]), Fd = /* @__PURE__ */ new Set(["link", "meta", "base", "embed", "frame"]), qi = /* @__PURE__ */ new Map();
function Ud(s) {
  let t = qi.get(s);
  return t || (t = new RegExp(`<\\s*\\/\\s*${s}\\s*>`, "gi"), qi.set(s, t)), t;
}
const Fi = /--!?>/g, Wd = /[A-Za-z]/, je = /\s/, zd = /[\s/>]/, Gd = /[\s/>=]/, jd = /^[a-z][a-z0-9_.:-]*$/, Kd = {
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
function Vd(s) {
  return s.includes("&") ? s.replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|([a-z]+));?/gi, (t, e, n, i) => {
    if (i !== void 0) return Kd[i.toLowerCase()] ?? t;
    const r = e !== void 0 ? parseInt(e, 16) : parseInt(n ?? "", 10);
    return r > 0 && r <= 1114111 && (r < 55296 || r > 57343) ? String.fromCodePoint(r) : "�";
  }) : s;
}
const Xd = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function Yd(s, t) {
  if (!Ks.has(s)) return "";
  const e = s === "input", n = (r) => t.find(([a]) => a === r)?.[1];
  if (e && (n("type") ?? "").trim().toLowerCase() !== "checkbox") return "";
  const i = [];
  e && (i.push('type="checkbox"'), n("checked") !== void 0 && i.push("checked"), i.push("disabled"));
  for (const [r, a] of t) {
    if (!jd.test(r) || e && (r === "type" || r === "checked" || r === "disabled")) continue;
    const o = fs(s, r, a);
    o !== null && i.push(`${r}="${Xd(o)}"`);
  }
  if (s === "a") {
    const r = t.find(([o]) => o === "href"), a = r ? fs("a", "href", r[1]) : null;
    for (const [o, l] of Ja(a ?? "", n("target") ?? "")) i.push(`${o}="${l}"`);
  }
  return `<${s}${i.length ? " " + i.join(" ") : ""}>`;
}
function to(s, t) {
  const e = s.length;
  let n = t;
  for (; n < e && !zd.test(s[n]); ) n++;
  const i = s.slice(t, n).toLowerCase(), r = [], a = /* @__PURE__ */ new Set();
  for (; n < e; ) {
    for (; n < e && (je.test(s[n]) || s[n] === "/"); ) n++;
    if (n >= e) break;
    if (s[n] === ">") return { tag: i, attrs: r, end: n + 1 };
    const o = n++;
    for (; n < e && !Gd.test(s[n]); ) n++;
    const l = s.slice(o, n).toLowerCase();
    let c = n;
    for (; c < e && je.test(s[c]); ) c++;
    let d = "";
    if (s[c] === "=") {
      for (c++; c < e && je.test(s[c]); ) c++;
      const u = s[c];
      if (u === '"' || u === "'") {
        const h = s.indexOf(u, c + 1);
        if (h < 0) break;
        d = s.slice(c + 1, h), n = h + 1;
      } else {
        const h = c;
        for (; c < e && !je.test(s[c]) && s[c] !== ">"; ) c++;
        d = s.slice(h, c), n = c;
      }
    }
    a.has(l) || (a.add(l), r.push([l, Vd(d)]));
  }
  return { tag: i, attrs: r, end: -1 };
}
function Qd(s) {
  const t = s.length;
  let e = "", n = 0;
  for (; n < t; ) {
    const i = s.indexOf("<", n);
    if (i < 0) {
      e += s.slice(n);
      break;
    }
    if (e += s.slice(n, i), s.startsWith("<!--", i)) {
      const d = i + 4;
      if (s[d] === ">") n = d + 1;
      else if (s.startsWith("->", d)) n = d + 2;
      else {
        Fi.lastIndex = d;
        const u = Fi.exec(s);
        if (!u) break;
        n = u.index + u[0].length;
      }
      continue;
    }
    const r = s[i + 1] === "/", a = i + (r ? 2 : 1);
    if (!Wd.test(s[a] ?? "")) {
      if (s[i + 1] === "!" || s[i + 1] === "?" || r) {
        const d = s.indexOf(">", i + 1);
        n = d < 0 ? t : d + 1;
      } else
        e += "&lt;", n = i + 1;
      continue;
    }
    const { tag: o, attrs: l, end: c } = to(s, a);
    if (c < 0) break;
    if (n = c, r)
      Ks.has(o) && (e += `</${o}>`);
    else if (Qa.has(o) && !qd.has(o) && !Fd.has(o)) {
      const d = Ud(o);
      d.lastIndex = c;
      const u = d.exec(s);
      if (!u) break;
      n = u.index + u[0].length;
    } else e += Yd(o, l);
  }
  return e;
}
function Ui(s) {
  return Qd(s);
}
const Wi = (s) => {
  if (!s) return s;
  if (typeof DOMParser > "u") return Ui(s);
  let t;
  try {
    t = new DOMParser().parseFromString(s, "text/html");
  } catch {
    return Ui(s);
  }
  const e = t.createElement("div");
  return gs(t.body, e, t), e.innerHTML;
}, It = "aparte-citation", eo = "aparte-citation-marker", no = /[\p{L}\p{N}]/u, Zd = [24, 12, 6], so = /* @__PURE__ */ new Set(["A", "ABBR", "B", "CITE", "CODE", "DEL", "EM", "I", "INS", "KBD", "MARK", "Q", "S", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "U"]), zi = /[.,;:!?)\]}»"'’”…。、，．！？：；」』）】》،؛؟]/, Jd = /[\u00a0\u202f]/, Vs = /* @__PURE__ */ new WeakMap(), io = /* @__PURE__ */ new WeakMap(), Gi = /* @__PURE__ */ new WeakSet(), rn = /* @__PURE__ */ new WeakMap();
let Mt = null;
function Xs(s) {
  const t = s.url?.trim();
  return t && /^https?:\/\//i.test(t) && Rn(t, "a") ? t : void 0;
}
function gn(s) {
  const t = Xs(s);
  if (t)
    try {
      return new URL(t).hostname.replace(/^www\./, "");
    } catch {
    }
  return s.title ?? "";
}
function tu(s) {
  const t = gn(s[0]) || "?";
  return s.length > 1 ? `${t} +${s.length - 1}` : t;
}
function _s(s, t) {
  const e = s.getLocale();
  return t === 1 ? e.sourcesOne ?? "1 source" : (e.sourcesCount ?? "{n} sources").replace("{n}", () => String(t));
}
function eu(s) {
  if (typeof document > "u") return "";
  const t = document.createElement("textarea");
  return t.innerHTML = s, t.value;
}
function ji(s) {
  return s.replace(/^[ \t]*(?:>[ \t]*)*(?:\d{1,9}[.)]|[*+-])[ \t]+(?:\[[ xX]\][ \t]+)?/gm, "").replace(/<!--[\s\S]*?-->/g, "").replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, "").replace(/<([a-z][a-z0-9+.-]*:[^>\s]+)>/gi, "$1").replace(/\]\([^)\n]*\)/g, "]").replace(/<\/?[A-Za-z][^>\n]*>/g, "").replace(/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, eu);
}
function nu(s) {
  const t = s.replace(/^ {0,3}(?:`{3,}|~{3,})[^\n]*$/gm, "");
  let e = "", n = 0;
  for (const r of t.matchAll(/(`+)([^`][\s\S]*?)\1/g))
    e += ji(t.slice(n, r.index)) + r[2], n = (r.index ?? 0) + r[0].length;
  e += ji(t.slice(n));
  let i = "";
  for (const r of e) no.test(r) && (i += r);
  return i;
}
function su(s) {
  let t = "";
  const e = [], n = s.ownerDocument.createTreeWalker(s, NodeFilter.SHOW_TEXT, {
    // A drawing (a formula, a diagram) shows its source differently; its placeholder, hidden
    // beside it, still holds the source as written.
    acceptNode: (i) => i.parentElement?.closest(`.aparte-code-drawing, .${It}`) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  for (let i = n.nextNode(); i; i = n.nextNode()) {
    const r = i.data;
    for (let a = 0; a < r.length; ) {
      const o = (r.codePointAt(a) ?? 0) > 65535 ? 2 : 1, l = r.slice(a, a + o);
      if (a += o, !!no.test(l)) {
        t += l;
        for (let c = 0; c < o; c++) e.push([i, a]);
      }
    }
  }
  return { text: t, ends: e };
}
function iu(s, t) {
  let e = 0;
  for (let n = s.indexOf(t); n >= 0; n = s.indexOf(t, n + 1)) e++;
  return e;
}
function ru(s, t, e) {
  const n = nu(s.slice(0, Math.max(0, Math.min(s.length, t.end))));
  if (!n) return null;
  for (const i of Zd) {
    const r = n.slice(-i), a = iu(n, r);
    let o = -1;
    for (let l = 0; l < a && (l === 0 || o >= 0); l++) o = e.text.indexOf(r, o + 1);
    if (o >= 0) return e.ends[o + r.length - 1] ?? null;
    if (r.length === n.length) break;
  }
  return null;
}
function Ki(s, t) {
  let e = t;
  for (; e < s.length && (zi.test(s[e]) || Jd.test(s[e]) && zi.test(s[e + 1] ?? "")); ) e++;
  return e - t;
}
function au(s, t, e, n) {
  const i = e.parentElement?.closest("pre");
  if (i && s.contains(i)) {
    i.after(t);
    return;
  }
  let r = null;
  for (let l = e.parentElement; l && l !== s && so.has(l.tagName); l = l.parentElement) r = l;
  if (!r) {
    e.splitText(n + Ki(e.data, n)), e.after(t);
    return;
  }
  let a = r;
  for (; a.nextSibling instanceof Element && a.nextSibling.classList.contains("aparte-code-drawing"); ) a = a.nextSibling;
  const o = a.nextSibling;
  if (o instanceof Text) {
    const l = Ki(o.data, 0);
    l > 0 && (o.splitText(l), a = o);
  }
  a.parentNode.insertBefore(t, a.nextSibling);
}
function ou(s, t, e, n) {
  const i = (l) => {
    const c = document.createElement("span");
    c.className = eo, c.hidden = !0, l.parentNode.insertBefore(c, l), c.append(l), c.after(s);
  }, r = t.data.lastIndexOf(n, e);
  if (r >= 0 && r + n.length >= e) {
    const l = t.splitText(r);
    return l.splitText(n.length), i(l), !0;
  }
  const a = t.parentElement, o = n.replace(/^\[|\]$/g, "");
  return a && so.has(a.tagName) && a.textContent?.trim() === o ? (i(a), !0) : !1;
}
function lu(s, t) {
  const e = document.createElement("button");
  return e.type = "button", e.className = "aparte-citation aparte-tag aparte-tag--sm", e.setAttribute("aria-haspopup", "dialog"), e.setAttribute("aria-expanded", "false"), Vs.set(e, s), ro(e, t), e;
}
function ro(s, t) {
  const e = Vs.get(s) ?? [], n = tu(e);
  s.dataset.label = n, s.setAttribute("aria-label", `${n}, ${_s(t, e.length)}`);
}
function ao(s) {
  const t = /* @__PURE__ */ new Set();
  for (const e of Array.from(s.querySelectorAll(`.${It}`)))
    e.parentNode && t.add(e.parentNode), e.remove();
  for (const e of Array.from(s.querySelectorAll(`.${eo}`)))
    e.parentNode && t.add(e.parentNode), e.replaceWith(...Array.from(e.childNodes));
  for (const e of t) e.normalize();
  rn.delete(s);
}
function Vi(s, t) {
  if (typeof document > "u") return;
  const e = t.citations ?? [], n = new Map((t.sources ?? []).map((_) => [_.id, _])), i = JSON.stringify([t.content, e, [...n.values()].map((_) => [_.id, _.url, _.title, _.snippet])]), r = Array.from(s.querySelectorAll(`.${It}`)), a = rn.get(s);
  if (a && a.signature === i && a.count === r.length) return;
  const o = document.activeElement, l = Mt?.root === s && (o === Mt.chip || (!o || o === document.body) && !Mt.chip.isConnected) ? Mt.at : -1, c = q?.root === s ? q.chip.isConnected ? r.indexOf(q.chip) : q.at : -1;
  if (ao(s), e.length === 0 || n.size === 0) {
    rn.set(s, { signature: i, count: 0 }), c >= 0 && gt(!1);
    return;
  }
  const d = R(s);
  Gi.has(s) || (Gi.add(s), s.addEventListener("click", (_) => {
    const g = _.target?.closest?.(`.${It}`);
    !g || !s.contains(g) || (_.preventDefault(), uu(g));
  }), s.addEventListener("focusin", (_) => {
    const g = _.target;
    g.classList?.contains(It) && (Mt = { root: s, chip: g, at: Array.from(s.querySelectorAll(`.${It}`)).indexOf(g) });
  }), s.addEventListener("focusout", (_) => {
    Mt?.root === s && _.relatedTarget && (Mt = null);
  }));
  const u = su(s), h = /* @__PURE__ */ new Map();
  for (const _ of e) {
    const g = _.sources.map((b) => n.get(b)).filter((b) => !!b);
    if (g.length === 0) continue;
    const m = ru(t.content, _, u);
    if (!m) continue;
    const A = u.ends.indexOf(m), k = _.marker && _.start !== void 0 ? t.content.slice(_.start, _.end) : null, y = h.get(A) ?? { node: m[0], offset: m[1], marker: k, sources: [] };
    for (const b of g) y.sources.includes(b) || y.sources.push(b);
    h.set(A, y);
  }
  const p = [...h.values()].sort((_, g) => _.node === g.node ? g.offset - _.offset : _.node.compareDocumentPosition(g.node) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1);
  for (const _ of p) {
    const g = lu(_.sources, d);
    io.set(g, s), !(_.marker && ou(g, _.node, _.offset, _.marker)) && au(s, g, _.node, _.offset);
  }
  const f = Array.from(s.querySelectorAll(`.${It}`));
  if (rn.set(s, { signature: i, count: f.length }), l >= 0 && (f[l] ? f[l].focus({ preventScroll: !0 }) : Mt = null), c >= 0 && q) {
    const _ = f[c];
    _ ? (q.chip = _, q.at = c, _.setAttribute("aria-expanded", "true"), _.setAttribute("aria-controls", q.el.id)) : gt(!1);
  }
}
function cu(s) {
  const t = R(s);
  for (const e of Array.from(s.querySelectorAll(`.${It}`))) ro(e, t);
}
let q = null, du = 0;
function uu(s) {
  q?.chip === s ? gt(!0) : hu(s);
}
function hu(s) {
  gt(!1);
  const t = Vs.get(s) ?? [];
  if (t.length === 0) return;
  const e = io.get(s) ?? s.parentElement, n = Array.from(e.querySelectorAll(`.${It}`)).indexOf(s), i = R(s), r = document.createElement("div");
  r.className = "aparte-citation-card aparte-popover", r.id = `aparte-citation-card-${++du}`;
  const a = s.closest(".aparte-viewport-container, aparte-chat-viewport") ?? s.ownerDocument.documentElement;
  r.dir = getComputedStyle(a).direction === "rtl" ? "rtl" : "ltr", r.setAttribute("role", "dialog"), r.setAttribute("aria-label", i.getLocale().sourcesCard ?? "Sources");
  const o = document.createElement("div");
  o.className = "aparte-citation-card__body";
  const l = document.createElement("p");
  l.className = "aparte-sr-only", l.setAttribute("role", "status"), r.append(o, l);
  const c = typeof r.showPopover == "function";
  c && (r.popover = "manual"), (s.closest("aparte-chat-viewport")?.parentElement ?? s.ownerDocument.body).append(r), c && r.showPopover(), s.setAttribute("aria-expanded", "true"), s.setAttribute("aria-controls", r.id);
  const d = typeof MutationObserver == "function" ? new MutationObserver(fu) : null;
  d?.observe(s.ownerDocument.body, { childList: !0, subtree: !0 }), q = { root: e, chip: s, at: n, el: r, body: o, status: l, sources: t, index: 0, config: i, watch: d }, uo(), Ie(), document.addEventListener("keydown", oo, !0), document.addEventListener("pointerdown", lo, !0), window.addEventListener("scroll", co, !0), window.addEventListener("resize", Ie), r.addEventListener("focusout", _u), r.addEventListener("keydown", gu), pu(r);
}
function pu(s) {
  (s.querySelector("a") ?? s.querySelector("button:not([disabled])"))?.focus();
}
function gt(s) {
  if (!q) return;
  const { chip: t, el: e, watch: n } = q;
  q = null, n?.disconnect(), e.remove(), t.setAttribute("aria-expanded", "false"), t.removeAttribute("aria-controls"), document.removeEventListener("keydown", oo, !0), document.removeEventListener("pointerdown", lo, !0), window.removeEventListener("scroll", co, !0), window.removeEventListener("resize", Ie), s && t.isConnected && t.focus();
}
function fu() {
  q && !q.chip.isConnected && gt(!1);
}
function oo(s) {
  s.key !== "Escape" || !q || (s.preventDefault(), gt(!0));
}
function gu(s) {
  if (s.key !== "Tab" || !q) return;
  const t = Array.from(q.el.querySelectorAll("a[href], button:not([disabled])")), e = s.shiftKey ? t[0] : t[t.length - 1];
  document.activeElement === e && (s.preventDefault(), gt(!0));
}
function lo(s) {
  if (!q) return;
  const t = s.target;
  t && (q.el.contains(t) || q.chip.contains(t)) || gt(!1);
}
function _u(s) {
  if (!q) return;
  const t = s.relatedTarget;
  t && (q.el.contains(t) || q.chip.contains(t)) || t && gt(!1);
}
function mu(s) {
  for (let t = s.parentElement; t; t = t.parentElement) {
    const e = getComputedStyle(t).overflowY;
    if (e === "auto" || e === "scroll") return t;
  }
  return null;
}
function co() {
  if (!q) return;
  const s = mu(q.chip);
  if (s) {
    const t = s.getBoundingClientRect(), e = q.chip.getBoundingClientRect();
    if (e.bottom < t.top || e.top > t.bottom) {
      gt(!1);
      return;
    }
  }
  Ie();
}
function Ie() {
  if (!q) return;
  const { chip: s, el: t } = q;
  if (!s.isConnected) {
    gt(!1);
    return;
  }
  const e = s.getBoundingClientRect();
  t.style.left = "0px", t.style.top = "0px";
  const n = t.getBoundingClientRect(), i = 6, a = getComputedStyle(s).direction === "rtl" ? e.right - t.offsetWidth : e.left, o = Math.max(8, Math.min(a, window.innerWidth - t.offsetWidth - 8));
  let l = e.bottom + i;
  l + t.offsetHeight > window.innerHeight - 8 && e.top - t.offsetHeight - i > 8 && (l = e.top - t.offsetHeight - i), t.style.left = `${o - n.left}px`, t.style.top = `${l - n.top}px`;
}
function uo() {
  if (!q) return;
  const { el: s, body: t, status: e, sources: n, index: i, config: r } = q, a = r.getLocale(), o = n[i], l = s.contains(document.activeElement) ? document.activeElement.dataset.aparteCardPart : void 0;
  if (t.replaceChildren(), n.length > 1) {
    const h = document.createElement("div");
    h.className = "aparte-citation-card__pager";
    const p = Xi(a.sourcePrevious ?? "Previous source", r.getIcon("prevBranch"), "prev", i === 0, () => Yi(-1)), f = document.createElement("span");
    f.className = "aparte-citation-card__position", f.textContent = `${i + 1}/${n.length}`, f.setAttribute("aria-hidden", "true");
    const _ = Xi(a.sourceNext ?? "Next source", r.getIcon("nextBranch"), "next", i === n.length - 1, () => Yi(1));
    h.append(p, f, _), t.append(h);
  }
  const c = Xs(o), d = o.title || gn(o) || o.url || "";
  if (c) {
    const h = document.createElement("a");
    h.className = "aparte-citation-card__title", h.href = c, h.target = "_blank", h.rel = "noopener noreferrer", h.dataset.aparteCardPart = "link", h.textContent = d, h.dir = "auto";
    const p = document.createElement("span");
    p.className = "aparte-sr-only", p.textContent = ` ${a.opensInNewTab ?? "(opens in a new tab)"}`, h.append(p), t.append(h);
  } else {
    const h = document.createElement("p");
    h.className = "aparte-citation-card__title", h.textContent = d, h.dir = "auto", t.append(h);
  }
  const u = gn(o);
  if (u && u !== d) {
    const h = document.createElement("p");
    h.className = "aparte-citation-card__domain", h.textContent = u, h.dir = "auto", t.append(h);
  }
  if (o.snippet) {
    const h = document.createElement("p");
    h.className = "aparte-citation-card__snippet", h.textContent = o.snippet, h.dir = "auto", t.append(h);
  }
  if (n.length > 1 && (e.textContent = (a.sourcePosition ?? "Source {i} of {n}").replace("{i}", () => String(i + 1)).replace("{n}", () => String(n.length))), l) {
    const h = s.querySelector(`[data-aparte-card-part="${l}"]`);
    h && !h.disabled ? h.focus() : (s.querySelector(".aparte-citation-card__pager button:not([disabled])") ?? s.querySelector("a"))?.focus();
  }
}
function Xi(s, t, e, n, i) {
  const r = document.createElement("button");
  return r.type = "button", r.className = "aparte-btn aparte-btn--icon aparte-btn--sm", r.setAttribute("aria-label", s), r.dataset.aparteCardPart = e, r.disabled = n, r.innerHTML = t, r.addEventListener("click", i), r;
}
function Yi(s) {
  q && (q.index = Math.max(0, Math.min(q.sources.length - 1, q.index + s)), uo(), Ie());
}
function bu(s, t, e, n) {
  let i = s.querySelector(":scope > .aparte-sources");
  const r = [], a = /* @__PURE__ */ new Set();
  for (const u of e) {
    const h = u.url ?? `#${u.id}${u.title ?? ""}`;
    a.has(h) || (a.add(h), r.push(u));
  }
  if (r.length === 0) {
    i?.remove();
    return;
  }
  const o = n.getLocale().opensInNewTab ?? "(opens in a new tab)", l = [o, ...r.map((u) => `${u.url ?? u.id}${u.title ?? ""}`)].join("");
  if (!i)
    i = document.createElement("details"), i.className = "aparte-sources", t.after(i);
  else if (i.dataset.aparteKey === l) {
    i.querySelector("summary").textContent = _s(n, r.length);
    return;
  }
  i.dataset.aparteKey = l;
  const c = document.createElement("summary");
  c.className = "aparte-sources__summary", c.textContent = _s(n, r.length);
  const d = document.createElement("ol");
  d.className = "aparte-sources__list";
  for (const u of r) {
    const h = document.createElement("li");
    h.className = "aparte-sources__item";
    const p = gn(u), f = u.title || p || u.url || "", _ = Xs(u);
    if (_) {
      const g = document.createElement("a");
      g.href = _, g.target = "_blank", g.rel = "noopener noreferrer", g.textContent = f, g.dir = "auto";
      const m = document.createElement("span");
      m.className = "aparte-sr-only", m.textContent = ` ${o}`, g.append(m), h.append(g);
    } else
      h.append(Object.assign(document.createElement("span"), { textContent: f, dir: "auto" }));
    if (p && p !== f) {
      const g = document.createElement("span");
      g.className = "aparte-sources__domain", g.textContent = p, g.dir = "auto", h.append(" ", g);
    }
    d.append(h);
  }
  i.replaceChildren(c, d);
}
const de = /* @__PURE__ */ new WeakMap(), Qi = "<i>a</i>";
function Zi() {
  return R().renderMarkdown(Qi) !== $(Qi);
}
function Re(s, t, e, n) {
  vu(s, t, e, n), ae(t, { streaming: n });
}
function vu(s, t, e, n) {
  const i = R();
  if (n) {
    if (de.delete(t), s._aparteSmd === void 0) {
      const a = R().createStreamingMarkdownRenderer(t);
      a ? (t.textContent = "", s._aparteSmd = { renderer: a, written: 0 }) : s._aparteSmd = null;
    }
    const r = s._aparteSmd;
    if (r) {
      const a = e.slice(r.written);
      a && (r.renderer.write(a), r.written = e.length);
      return;
    }
  } else if (s._aparteSmd) {
    const r = s._aparteSmd, a = e.slice(r.written);
    if (a && (r.renderer.write(a), r.written = e.length), r.renderer.end(), s._aparteSmd = void 0, !Zi()) {
      Ya(t), ao(t), t.innerHTML = i.sanitizeHtml(t.innerHTML), de.set(t, { content: e, config: i, version: yt(i), writer: "parser" });
      return;
    }
  } else {
    const r = de.get(t);
    if (r?.content === e && (r.writer === "parser" && !Zi() || r.writer === "markdown" && r.config === i && r.version === yt(i)))
      return;
  }
  t.innerHTML = i.renderMarkdown(e), n ? de.delete(t) : de.set(t, { content: e, config: i, version: yt(i), writer: "markdown" });
}
function ms(s) {
  if (!R().hasHighlightProvider()) return;
  const t = s.querySelectorAll("pre > code:not([data-aparte-highlighted])");
  for (const e of t) {
    const n = e.parentElement;
    if (!n) continue;
    const i = Array.from(e.classList).find((a) => a.startsWith("language-"))?.slice(9) ?? "";
    if (ps(i, s) || e.closest(".aparte-code-drawing")) continue;
    const r = e.textContent ?? "";
    e.setAttribute("data-aparte-highlighted", ""), R().highlightCode(r, i, { fallback: !1 }).then((a) => {
      (n.isConnected || n.parentElement) && ho(n, a);
    }).catch(() => e.removeAttribute("data-aparte-highlighted"));
  }
}
function ho(s, t) {
  const e = document.createElement("template");
  e.innerHTML = t;
  for (const n of Array.from(e.content.querySelectorAll("code"))) n.setAttribute("data-aparte-highlighted", "");
  s.replaceWith(e.content);
}
const yu = {
  type: "text",
  render: (s) => `<div class="aparte-segment aparte-segment-text" data-segment-id="${$(s.id)}"><div class="aparte-segment-content" dir="auto">${R().renderMarkdown(s.content)}</div></div>`,
  /*
   * A fence in a settled text segment is highlighted, as the thinking renderer does for
   * its own. The parser turns a streamed fence into a `code` segment, so this only ever
   * mattered for text built by hand (`setSegments`, a restored message, a server's) — and
   * the bubble's own pass skips any message that has segments, so that fence stayed bare.
   */
  setup: (s, t) => {
    const e = s.querySelector(".aparte-segment-content");
    e && (t.isStreaming === !0 ? Re(s, e, t.content, !0) : (ae(e, { streaming: !1 }), ms(e)), Vi(e, t));
  },
  update: (s, t) => {
    const e = s.querySelector(".aparte-segment-content");
    e && (Re(
      s,
      e,
      t.content,
      t.isStreaming !== !1
    ), t.isStreaming === !1 && ms(e), Vi(e, t));
  },
  getStyles: () => ""
};
function po(s, t) {
  const e = Math.max(1, Math.round(s / 1e3));
  try {
    const n = (a, o) => new Intl.NumberFormat(t, { style: "unit", unit: o, unitDisplay: "narrow" }).format(a);
    if (e < 60) return n(e, "second");
    const i = Math.floor(e / 60), r = e % 60;
    return r ? new Intl.ListFormat(t, { style: "narrow", type: "unit" }).format([n(i, "minute"), n(r, "second")]) : n(i, "minute");
  } catch {
    return `${e}s`;
  }
}
const wu = 24;
function bs(s) {
  if (s.label && s.label !== "Thinking") return s.label;
  const t = R();
  if (!Wt(s)) return t.t("thinking");
  const n = s.showDuration ?? t.getSegmentDefaults("thinking")?.showDuration === !0 ? ed(s) : void 0;
  return n === void 0 ? t.t("thought") : t.t("thoughtFor").replace("{duration}", () => po(n, t.getLocale().tag || void 0));
}
const vs = (s) => s.isStreaming === !0;
function Ji(s, t) {
  const e = bs(t), n = s.querySelector(".aparte-thinking-label");
  n && n.textContent !== e && (n.textContent = e), n?.classList.toggle("aparte-shimmer", vs(t)), s.querySelector(".aparte-thinking-content")?.setAttribute("aria-label", e);
}
const Su = {
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
  render: (s) => `<details class="aparte-segment aparte-segment-thinking aparte-accordion__item" data-segment-id="${$(s.id)}" ${s.collapsed === !1 ? "open" : ""}><summary class="aparte-accordion__header aparte-thinking-header"><span class="aparte-thinking-label${O(vs(s) ? " aparte-shimmer" : "")}">${$(bs(s))}</span><span class="aparte-accordion__icon">${R().getIcon("expand")}</span></summary><div class="aparte-accordion__panel aparte-thinking-content" dir="auto" role="region" tabindex="0" aria-label="${O(bs(s))}">${R().renderMarkdown(s.content)}</div></details>`,
  /**
   * The default label is the only config-derived text here — and `segment.label`
   * still wins, exactly as in `render`, because that string is the app's.
   */
  relabel: (s, t) => Ji(s, t),
  /** A block restored from storage is drawn here: `update` only runs on one that changes. */
  setup: (s, t) => {
    const e = s.querySelector(".aparte-thinking-content");
    e && (vs(t) ? Re(s, e, t.content, !0) : ae(e, { streaming: !1 }));
  },
  update: (s, t) => {
    Ji(s, t);
    const e = s.querySelector(".aparte-thinking-content");
    if (!e) return;
    const n = e.scrollHeight - e.scrollTop - e.clientHeight <= wu, i = t.isStreaming !== !1;
    Re(s, e, t.content, i), i || ms(e), n && (e.scrollTop = e.scrollHeight);
  },
  getStyles: () => ""
};
function fo(s) {
  return typeof navigator < "u" && navigator.clipboard && typeof navigator.clipboard.writeText == "function" ? navigator.clipboard.writeText(s) : new Promise((t, e) => {
    if (typeof document > "u" || typeof document.execCommand != "function") {
      e(new Error("[aparte] No clipboard available in this context"));
      return;
    }
    const n = document.createElement("textarea");
    n.value = s, n.setAttribute("readonly", ""), n.setAttribute("aria-hidden", "true"), n.style.position = "fixed", n.style.top = "0", n.style.left = "-9999px", n.style.opacity = "0";
    const i = document.activeElement;
    document.body.appendChild(n), n.focus(), n.select(), n.setSelectionRange(0, s.length);
    let r = !1;
    try {
      r = document.execCommand("copy");
    } catch {
      r = !1;
    }
    n.remove(), i instanceof HTMLElement && i.focus(), r ? t() : e(new Error("[aparte] Clipboard write failed"));
  });
}
const ku = 1500;
function ys(s, t) {
  s.setAttribute("aria-label", t), s.setAttribute("title", t);
}
function Ys(s) {
  const t = O(R().t("copy")), e = R().getIcon("copy");
  return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm ${O(s)}" data-action="copy" aria-label="${t}" title="${t}">${e}</button>`;
}
function go(s, t) {
  s.addEventListener("click", () => {
    fo(t()).catch(() => {
    }), s.innerHTML = R(s).getIcon("check"), ys(s, R(s).t("copied")), s.dataset.copied = "1", setTimeout(() => {
      s.innerHTML = R(s).getIcon("copy"), ys(s, R(s).t("copy")), delete s.dataset.copied;
    }, ku);
  });
}
function _o(s) {
  s.dataset.copied || (ys(s, R().t("copy")), s.innerHTML = R().getIcon("copy"));
}
const Au = 400, Eu = 256, tr = /* @__PURE__ */ new Map();
function Cu(s, t, e) {
  if (s.delete(t), s.size >= Eu) {
    const n = s.keys().next().value;
    n !== void 0 && s.delete(n);
  }
  s.set(t, e);
}
function er(s) {
  const t = Number(s.dataset.aparteHlLen);
  return Number.isFinite(t) && t > 0 ? t : 0;
}
function xu(s, t, e, n, i) {
  const r = s.querySelector(t);
  if (!r) return;
  delete r.dataset.aparteSettled;
  const a = r.querySelector("[data-aparte-tail]"), o = er(r);
  if (a && o <= e.length)
    a.textContent = e.slice(o);
  else {
    delete r.dataset.aparteHlLen;
    const d = r.querySelector("code");
    d ? d.textContent = e : r.innerHTML = `<pre><code class="language-${$(n || "text")}">${$(e)}</code></pre>`;
  }
  const l = e.lastIndexOf(`
`) + 1;
  if (l <= o) return;
  const c = Date.now();
  c - (tr.get(i) ?? 0) < Au || (Cu(tr, i, c), R(s).highlightCode(e.slice(0, l), n).then((d) => {
    const u = s.querySelector(t);
    if (!u || u.dataset.aparteSettled !== void 0 || l <= er(u)) return;
    u.innerHTML = d;
    const h = u.querySelector("code") ?? u, p = document.createElement("span");
    p.dataset.aparteTail = "", p.textContent = e.slice(l), h.appendChild(p), u.dataset.aparteHlLen = String(l);
  }).catch(() => {
  }));
}
const Wn = /* @__PURE__ */ new WeakMap(), te = /* @__PURE__ */ new WeakMap(), zn = /* @__PURE__ */ new WeakMap();
function nr(s, t) {
  const e = s.querySelector(".aparte-code-content-wrapper");
  if (!e) return;
  const n = `${t.language ?? ""}${t.content}`, i = R(), r = zn.get(s);
  if (r?.what === n && r.config === i) return;
  zn.set(s, { what: n, config: i });
  const a = (te.get(s) ?? 0) + 1;
  te.set(s, a), e.dataset.aparteSettled = "", i.highlightCode(t.content, t.language || "", { fallback: !1 }).then((o) => {
    te.get(s) === a && (e.innerHTML = o);
  }).catch(() => {
    te.get(s) === a && zn.delete(s);
  });
}
const _n = (s) => (s.language || "").trim().split(/\s+/)[0] ?? "";
function sr(s, t) {
  const e = _n(t), n = e ? R(s).getCodeLanguageRenderer(e) : void 0;
  s.toggleAttribute("data-aparte-bare", !!n && n.card !== !0);
}
function ir(s, t) {
  const e = s.querySelector(".aparte-code-content-wrapper");
  if (!e) return;
  te.set(s, (te.get(s) ?? 0) + 1), e.dataset.aparteSettled = "";
  const n = _n(t);
  let i = Array.from(e.querySelectorAll("pre > code")).find((r) => r.classList.contains(`language-${n}`));
  i || (e.innerHTML = `<pre><code class="language-${$(n)}"></code></pre>`, i = e.querySelector("pre > code")), i.textContent !== t.content && (i.textContent = t.content), ae(e, { streaming: t.isStreaming === !0 });
}
const Tu = {
  type: "code",
  render: (s) => {
    const t = Ys("aparte-code-copy");
    return `
        <div class="aparte-segment aparte-segment-code" data-segment-id="${$(s.id)}">
            <div class="aparte-code-header">
                ${s.filename ? `<span class="aparte-code-filename">${$(s.filename)}</span>` : '<span class="aparte-code-header-filler"></span>'}
                <span class="aparte-code-language">${$(s.language || "")}</span>
                ${t}
            </div>
            <div class="aparte-code-content-wrapper">
                <pre><code class="language-${$(s.language || "text")}">${$(s.content)}</code></pre>
            </div>
        </div>
    `;
  },
  /** The copy button's icon and tooltip — nothing else here comes from config. */
  relabel: (s) => {
    const t = s.querySelector(".aparte-code-copy");
    t && _o(t);
  },
  setup: (s, t) => {
    Wn.set(s, t.content), sr(s, t), ps(_n(t), s) ? ir(s, t) : t.isStreaming !== !0 && nr(s, t);
    const e = s.querySelector(".aparte-code-copy");
    e && go(e, () => Wn.get(s) ?? "");
  },
  update: (s, t) => {
    Wn.set(s, t.content), sr(s, t), ps(_n(t), s) ? ir(s, t) : t.isStreaming === !0 ? xu(s, ".aparte-code-content-wrapper", t.content, t.language || "", t.id) : nr(s, t);
  },
  getStyles: () => ""
};
function ws(s, t) {
  switch (s) {
    case U.NET_OFFLINE:
    case U.NET_ERROR:
      return t("errorUnreachable");
    case U.NET_TIMEOUT:
      return t("errorTimeout");
    case U.CONFIG_INVALID_KEY:
      return t("errorRefused");
    case U.USAGE_RATE_LIMIT:
      return t("errorRateLimited");
    case U.USAGE_CONTEXT_EXCEEDED:
      return t("errorTooLong");
    case U.PROVIDER_ERROR:
    case U.PROVIDER_UNAVAILABLE:
      return t("errorFailed");
    case U.USAGE_BAD_REQUEST:
    case U.PROVIDER_POLICY:
    case U.PROVIDER_MISCONFIGURED:
    case U.CONFIG_INVALID_MODEL:
    case U.UNKNOWN_ERROR:
      return t("errorNoAnswer");
    default:
      return;
  }
}
const Iu = {
  type: "error",
  render: (s) => {
    const t = R(), e = ws(s.code, (r) => t.t(r)), n = t.getErrorRenderer?.();
    if (n) {
      const r = n({
        message: s.content,
        ...e !== void 0 ? { sentence: e } : {},
        ...s.details !== void 0 ? { details: s.details } : {},
        ...s.code !== void 0 ? { code: s.code } : {}
      });
      return r instanceof HTMLElement && r.setAttribute("data-segment-id", s.id), r;
    }
    const i = e ?? s.content;
    return `
        <div class="aparte-segment aparte-alert aparte-alert--danger aparte-segment-error" data-segment-id="${$(s.id)}"${s.code ? ` data-error-code="${O(s.code)}"` : ""}>
            <span class="aparte-alert__icon">${t.getIcon("error") || "⚠"}</span>
            <div class="aparte-alert__body">
                <div class="aparte-alert__title">${$(t.t("error"))}</div>
                <div class="aparte-alert__message">${$(i)}</div>
                ${s.details ? `<pre class="aparte-segment-error__details">${$(s.details)}</pre>` : ""}
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
  relabel: (s, t) => {
    const e = R();
    if (e.getErrorRenderer?.()) return;
    const n = s.querySelector(".aparte-alert__icon");
    n && (n.innerHTML = e.getIcon("error") || "⚠");
    const i = s.querySelector(".aparte-alert__title");
    i && (i.textContent = e.t("error"));
    const r = ws(t.code, (o) => e.t(o)), a = s.querySelector(".aparte-alert__message");
    a && r !== void 0 && (a.textContent = r);
  },
  getStyles: () => ""
};
function mo(s, t) {
  if (!s || typeof s != "object" || Object.keys(s).length === 0) return "";
  if (t)
    try {
      const e = t(s);
      if (typeof e == "string") return e;
    } catch {
    }
  try {
    return JSON.stringify(s, null, 2);
  } catch {
    return "";
  }
}
function bo(s, t) {
  const e = s.toolCall?.name ?? "tool", n = t.getToolDisplay(e)?.label;
  if (n !== void 0)
    try {
      const i = typeof n == "function" ? n(s) : n;
      if (typeof i == "string" && i.trim()) return { text: i.trim(), isLabel: !0 };
    } catch {
    }
  return { text: e, isLabel: !1 };
}
function vo(s, t) {
  const e = t.getToolSummary(s.toolCall?.name ?? "");
  if (!e) return "";
  try {
    const n = e(s);
    return typeof n == "string" ? n.trim() : "";
  } catch {
    return "";
  }
}
function yo(s) {
  return mo(s.toolCall?.input, R().getToolInputFormatter(s.toolCall?.name ?? ""));
}
function Ss(s) {
  const t = R(), e = s.status ?? "pending", n = (i) => $(i);
  return e === "awaiting-approval" ? `${t.getIcon("pause")}${n(t.t("approvalWaiting"))}` : e === "pending" ? n(t.t("toolRunning")) : e === "resolved" ? `${t.getIcon("check")}${n(t.t("toolCompleted"))}` : e === "rejected" ? `${t.getIcon("close")}${n(t.t("toolRejected"))}` : e === "aborted" ? `${t.getIcon("stop")}${n(t.t("toolStopped"))}` : e === "failed" ? `${t.getIcon("close")}${n(t.t("toolFailed"))}` : "";
}
function wo(s) {
  const t = R();
  if (s.status === "rejected") {
    const e = s.refusal?.by;
    if (e === "policy") return t.t("toolRefusedByPolicy");
    if (e === "earlier-refusal") return t.t("toolNotRunAfterRefusal");
    const n = s.refusal?.instruction?.trim();
    return n ? t.t("toolRejectedSaid").replace("{instruction}", () => n) : "";
  }
  if (s.status === "aborted")
    switch (s.abortCause) {
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
function ks(s) {
  const t = Lu(s.result ?? "");
  return !t || s.status === "rejected" && s.refusal ? null : { key: "toolOutput", text: t };
}
function Gn(s) {
  const t = R().getToolDisplay(s.toolCall?.name ?? "")?.details;
  if (t === !1) return { kind: "none" };
  if (typeof t != "function") return { kind: "parts" };
  try {
    const e = t(s);
    return e ? { kind: "body", body: typeof e == "string" ? R().sanitizeHtml(e) : e } : { kind: "none" };
  } catch {
    return { kind: "none" };
  }
}
const rr = (s) => s.querySelector(':scope > .aparte-tool-detail[data-details="app"]');
function So(s, t) {
  const e = s.querySelector(".aparte-tool-detail");
  e && (typeof t == "string" ? e.innerHTML = t : e.replaceChildren(t), an.set(e, ko(t)));
}
const an = /* @__PURE__ */ new WeakMap(), ko = (s) => typeof s == "string" ? s : s.outerHTML;
function Ru(s, t) {
  if (typeof t != "string" && s.contains(t)) {
    an.set(s, t.outerHTML);
    return;
  }
  const e = an.get(s), n = ko(t);
  if (e === n) return;
  const i = document.createElement("div");
  typeof t == "string" ? i.innerHTML = t : i.append(t);
  const r = document.createElement("div");
  e !== void 0 && (r.innerHTML = e), e !== void 0 && As(r, i) && As(r, s) ? Ao(s, r, i) : s.replaceChildren(...Array.from(i.childNodes)), an.set(s, n);
}
function As(s, t) {
  if (s.childNodes.length !== t.childNodes.length) return !1;
  for (let e = 0; e < s.childNodes.length; e++) {
    const n = s.childNodes[e], i = t.childNodes[e];
    if (n.nodeType !== i.nodeType || n.nodeName !== i.nodeName || !As(n, i)) return !1;
  }
  return !0;
}
function Ao(s, t, e) {
  for (let n = 0; n < s.childNodes.length; n++) {
    const i = s.childNodes[n], r = t.childNodes[n], a = e.childNodes[n];
    if (i instanceof Element && r instanceof Element && a instanceof Element) {
      for (const { name: o, value: l } of Array.from(a.attributes))
        r.getAttribute(o) !== l && i.setAttribute(o, l);
      for (const { name: o } of Array.from(r.attributes))
        a.hasAttribute(o) || i.removeAttribute(o);
      Ao(i, r, a);
    } else r.nodeValue !== a.nodeValue && (i.nodeValue = a.nodeValue);
  }
}
function ar(s, t) {
  const e = s.querySelector(".aparte-tool-note");
  if (!e) return;
  const n = wo(t);
  e.textContent !== n && (e.textContent = n), e.toggleAttribute("hidden", !n), n ? e.setAttribute("title", n) : e.removeAttribute("title");
}
function or(s, t, e, n) {
  const i = s.querySelector(`[data-part="${t}"]`);
  if (!e) {
    i?.remove();
    return;
  }
  if (i) {
    const f = i.querySelector("code");
    f && f.textContent !== e && (f.textContent = e);
    const _ = i.querySelector(".aparte-tool-part-label"), g = R().t(n);
    _ && _.textContent !== g && (_.textContent = g), i.querySelector(".aparte-tool-part-body")?.setAttribute("aria-label", g);
    return;
  }
  const r = s.querySelector(".aparte-tool-detail");
  if (!r) return;
  const a = R(), o = document.createElement("div");
  o.className = "aparte-tool-part", o.dataset.part = t;
  const l = document.createElement("div");
  l.className = "aparte-tool-part-head";
  const c = document.createElement("span");
  c.className = "aparte-tool-part-label", c.textContent = a.t(n);
  const d = document.createElement("template");
  d.innerHTML = Ys("aparte-tool-copy"), l.append(c, d.content);
  const u = document.createElement("div");
  u.className = "aparte-tool-part-body", u.setAttribute("role", "region"), u.tabIndex = 0, u.setAttribute("aria-label", c.textContent);
  const h = document.createElement("pre"), p = document.createElement("code");
  p.textContent = e, h.appendChild(p), u.appendChild(h), o.append(l, u), t === "input" ? r.prepend(o) : r.appendChild(o), Eo(o);
}
function Eo(s) {
  for (const t of s.querySelectorAll(".aparte-tool-copy")) {
    if (t.dataset.wired) continue;
    t.dataset.wired = "1";
    const e = t.closest(".aparte-tool-part");
    go(t, () => e?.querySelector(".aparte-tool-part-body")?.textContent ?? "");
  }
}
const Mu = 2e5;
function Co(s) {
  const t = s.trim();
  if (!(t.length > Mu || !(t.startsWith("{") || t.startsWith("["))))
    try {
      const e = JSON.parse(t);
      return e !== null && typeof e == "object" ? e : void 0;
    } catch {
      return;
    }
}
function Lu(s) {
  const t = Co(s);
  return t === void 0 ? s : JSON.stringify(t, null, 2);
}
function lr(s) {
  const t = R();
  for (const e of s.querySelectorAll(".aparte-tool-part-body")) {
    const n = e.querySelector("code")?.textContent ?? "";
    !n || Co(n) === void 0 || t.highlightCode(n, "json").then((i) => {
      (e.querySelector("code")?.textContent ?? "") === n && (e.innerHTML = i);
    }).catch(() => {
    });
  }
}
function xo(s) {
  return vo(s, R());
}
function cr(s, t) {
  const e = s.querySelector(".aparte-tool-target");
  if (!e) return;
  const n = xo(t);
  e.textContent !== n && (e.textContent = n), e.toggleAttribute("hidden", !n);
}
function To(s) {
  return bo(s, R());
}
function Io(s) {
  const t = R(), e = t.getToolDisplay(s.toolCall?.name ?? "")?.icon;
  return (e ? t.getIcon(e) : void 0) || t.getIcon("tool");
}
const Qs = (s) => R().getToolDisplay(s.toolCall?.name ?? "")?.quiet ?? !0;
function Ro(s) {
  const t = s.status ?? "pending", e = Qs(s);
  return {
    shimmer: e && t === "pending",
    spinner: !e && t === "pending",
    stateHidden: e && (t === "pending" || t === "resolved")
  };
}
function dr(s, t) {
  const e = Ro(t);
  s.toggleAttribute("data-quiet", Qs(t)), s.querySelector(".aparte-tool-spinner")?.toggleAttribute("hidden", !e.spinner), s.querySelector(".aparte-tool-name")?.classList.toggle("aparte-shimmer", e.shimmer), s.querySelector(".aparte-tool-state")?.classList.toggle("aparte-sr-only", e.stateHidden);
}
function ur(s, t) {
  const e = s.querySelector(".aparte-tool-name");
  if (!e) return;
  const { text: n, isLabel: i } = To(t);
  e.textContent !== n && (e.textContent = n), e.classList.toggle("aparte-tool-name--label", i);
}
function Ou(s) {
  const t = Ss(s), e = Io(s), n = xo(s), i = wo(s), r = To(s), a = Ro(s);
  return `
                <span class="aparte-tool-label">
                    <span class="aparte-tool-icon">${e}</span>
                    <span class="aparte-tool-name${r.isLabel ? " aparte-tool-name--label" : ""}${a.shimmer ? " aparte-shimmer" : ""}">${$(r.text)}</span>
                    <span class="aparte-tool-target"${n ? "" : " hidden"}>${$(n)}</span>
                </span>
                <span class="aparte-spinner aparte-tool-spinner" aria-hidden="true"${a.spinner ? "" : " hidden"}></span>
                <span class="aparte-tool-state${a.stateHidden ? " aparte-sr-only" : ""}">${t}</span>
                <span class="aparte-tool-note"${i ? ` title="${O(i)}"` : " hidden"}>${$(i)}</span>`;
}
function hr(s) {
  return `<div class="aparte-segment aparte-segment-tool-call" data-segment-id="${$(s.id)}" data-status="${O(s.status ?? "pending")}" data-tool-call-id="${O(s.toolCall?.id ?? "")}" data-tool-name="${O(s.toolCall?.name ?? "tool")}" hidden></div>`;
}
const Zt = (s) => s.hidden && s.classList.contains("aparte-segment-tool-call") && s.childElementCount === 0, ye = /* @__PURE__ */ new WeakMap(), on = /* @__PURE__ */ new WeakMap();
function pr(s) {
  return on.get(s) ?? null;
}
function fr(s, t) {
  const e = ye.get(s);
  return e || (s.classList.contains("aparte-segment-tool-call") ? null : t);
}
function gr(s, t) {
  const e = s.toolCall?.name ?? "tool", n = s.status ?? "pending", i = s.toolCall?.id ?? "", r = Ou(s), a = Qs(s) ? " data-quiet" : "", o = R().getIcon("expand"), l = t.kind === "parts" ? yo(s) : "", c = t.kind === "parts" ? ks(s) : null;
  if (t.kind === "none" || t.kind === "parts" && !l && !c)
    return `
        <div class="aparte-segment aparte-segment-tool-call" data-segment-id="${$(s.id)}" data-status="${O(n)}" data-tool-call-id="${O(i)}" data-tool-name="${O(e)}"${a}><div class="aparte-tool-line">${r}</div>
        </div>
    `;
  const d = R(), u = Ys("aparte-tool-copy"), h = s.collapsed !== void 0 ? !s.collapsed : d.getToolDisplay(e)?.open === !0;
  if (t.kind === "body") {
    const p = document.createElement("template");
    p.innerHTML = `
        <details class="aparte-segment aparte-segment-tool-call" data-segment-id="${$(s.id)}" data-status="${O(n)}" data-tool-call-id="${O(i)}" data-tool-name="${O(e)}"${a}${h ? " open" : ""}>
            <summary class="aparte-tool-summary"><span class="aparte-tool-toggle">${o}</span>${r}</summary>
            <div class="aparte-tool-detail" data-details="app"></div>
        </details>`.trim();
    const f = p.content.firstElementChild;
    return So(f, t.body), f;
  }
  return `
        <details class="aparte-segment aparte-segment-tool-call" data-segment-id="${$(s.id)}" data-status="${O(n)}" data-tool-call-id="${O(i)}" data-tool-name="${O(e)}"${a}${h ? " open" : ""}>
            <summary class="aparte-tool-summary"><span class="aparte-tool-toggle">${o}</span>${r}</summary>
            <div class="aparte-tool-detail">
                ${l ? `
                <div class="aparte-tool-part" data-part="input">
                    <div class="aparte-tool-part-head"><span class="aparte-tool-part-label">${$(d.t("toolInput"))}</span>${u}</div>
                    <div class="aparte-tool-part-body" role="region" tabindex="0" aria-label="${O(d.t("toolInput"))}"><pre><code>${$(l)}</code></pre></div>
                </div>` : ""}
                ${c ? `
                <div class="aparte-tool-part" data-part="output">
                    <div class="aparte-tool-part-head"><span class="aparte-tool-part-label">${$(d.t(c.key))}</span>${u}</div>
                    <div class="aparte-tool-part-body" role="region" tabindex="0" aria-label="${O(d.t(c.key))}"><pre><code>${$(c.text)}</code></pre></div>
                </div>` : ""}
            </div>
        </details>
    `;
}
const ke = {
  type: "tool_call",
  render: (s) => {
    const t = s.toolCall?.name ?? "tool";
    if (R().isToolHidden(t)) return hr(s);
    const e = R().getToolRenderer(t);
    if (e) {
      Mo(t, e);
      const n = e.render(s);
      return n instanceof HTMLElement && (ye.set(n, e), on.set(n, e)), n || hr(s);
    }
    return gr(s, Gn(s));
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
  relabel: (s, t) => {
    if (Zt(s)) return;
    const e = R(), n = fr(s, e.getToolRenderer(t.toolCall?.name) ?? null);
    if (n) {
      n.relabel?.(s, t);
      return;
    }
    const i = s.querySelector(".aparte-tool-icon");
    i && (i.innerHTML = Io(t)), ur(s, t), cr(s, t), ar(s, t);
    const r = s.querySelector('[data-part="input"] .aparte-tool-part-label');
    r && (r.textContent = e.t("toolInput")), s.querySelector('[data-part="input"] .aparte-tool-part-body')?.setAttribute("aria-label", e.t("toolInput"));
    const a = ks(t), o = s.querySelector('[data-part="output"] .aparte-tool-part-label');
    o && a && (o.textContent = e.t(a.key)), a && s.querySelector('[data-part="output"] .aparte-tool-part-body')?.setAttribute("aria-label", e.t(a.key));
    for (const d of s.querySelectorAll(".aparte-tool-copy")) _o(d);
    const l = rr(s);
    if (l) {
      const d = Gn(t);
      d.kind === "body" && Ru(l, d.body);
    }
    const c = s.querySelector(".aparte-tool-state");
    c && (c.innerHTML = Ss(t)), dr(s, t);
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
  update: (s, t) => {
    const e = t.status ?? "pending", n = R().isToolHidden(t.toolCall?.name ?? "tool");
    if (n && Zt(s)) {
      s.setAttribute("data-status", e);
      return;
    }
    const i = n ? null : R().getToolRenderer(t.toolCall?.name) ?? null, r = Zt(s) ? null : fr(s, i);
    if (r && r === i && r.update && !Zt(s)) {
      r.update(s, t);
      return;
    }
    const a = (p) => {
      const f = document.createElement("template");
      f.innerHTML = typeof p == "string" ? p.trim() : "";
      const _ = typeof p == "string" ? f.content.firstElementChild : p;
      _ && (_.hasAttribute("data-segment-id") || _.setAttribute("data-segment-id", t.id), ke.cleanup?.(s, t), s.replaceWith(_), ke.setup?.(_, t));
    };
    if (i || r || n || Zt(s)) {
      a(ke.render(t));
      return;
    }
    const o = Gn(t), l = o.kind === "parts" ? yo(t) : "", c = o.kind === "parts" ? ks(t) : null, d = o.kind === "body" || !!l || !!c, u = !!rr(s);
    if (d !== (s.tagName === "DETAILS") || d && o.kind === "body" !== u) {
      a(gr(t, o));
      return;
    }
    s.setAttribute("data-status", e);
    const h = s.querySelector(".aparte-tool-state");
    if (h && (h.innerHTML = Ss(t)), dr(s, t), ur(s, t), cr(s, t), ar(s, t), o.kind === "body") {
      So(s, o.body);
      return;
    }
    or(s, "input", l, "toolInput"), or(s, "output", c?.text ?? "", c?.key ?? "toolOutput"), lr(s);
  },
  setup: (s, t) => {
    const n = R().isToolHidden(t.toolCall?.name ?? "tool") ? void 0 : R().getToolRenderer(t.toolCall?.name);
    n && on.set(s, n), !Zt(s) && (Eo(s), lr(s), n && ye.set(s, n), n?.setup?.(s, t));
  },
  /**
   * The row leaves for good: the registered renderer that drew it, if any, cleans up. A
   * cleanup that throws is reported and goes no further: the row is replaced or removed
   * all the same, and the stream that caused it is not interrupted.
   */
  cleanup: (s, t) => {
    on.delete(s);
    const e = ye.get(s);
    if (e) {
      ye.delete(s);
      try {
        e.cleanup?.(s, t);
      } catch (n) {
        console.error("[aparte] a tool renderer's cleanup threw", n);
      }
    }
  },
  // CSS lives in styles/segment/ — see that folder for why a
  // built-in's rules belong there. `getStyles` stays for a CONSUMER's renderer, which
  // has no other way onto the page.
  getStyles: () => ""
}, _r = /* @__PURE__ */ new WeakMap();
function zt(s) {
  let t = _r.get(s);
  return t || (t = { renderers: /* @__PURE__ */ new Map(), defaultsInstalled: !1, defaultsDeclined: !1 }, _r.set(s, t)), t;
}
function $u(s) {
  const t = zt(s);
  if (s === lt || t.defaultsDeclined) return t.renderers;
  const e = new Map(zt(lt).renderers);
  for (const [n, i] of t.renderers) e.set(n, i);
  return e;
}
let Nt = null;
function Nu(s, t = R()) {
  const e = zt(t);
  e.renderers.get(s.type) !== s && (e.renderers.set(s.type, s), Zs(t), ln(t));
}
function Pu(s = R()) {
  zt(s).defaultsDeclined = !0;
}
function Du(s = R()) {
  const t = zt(s);
  if (!(t.defaultsInstalled || t.defaultsDeclined)) {
    t.defaultsInstalled = !0;
    for (const e of Lo)
      t.renderers.has(e.type) || t.renderers.set(e.type, e);
    Zs(s);
  }
}
function mr(s, t = R()) {
  return $u(t).get(s);
}
const Ke = /* @__PURE__ */ new Set();
function Zs(s = R()) {
  if (typeof document > "u") return;
  (!Nt || !Nt.isConnected) && (Nt = document.createElement("style"), Nt.id = "aparte-renderer-styles", document.head.appendChild(Nt), Nt.textContent = Array.from(Ke).join(`
`));
  let t = !1;
  for (const e of zt(s).renderers.values()) {
    const n = e.getStyles?.();
    !n || Ke.has(n) || (Ke.add(n), t = !0);
  }
  t && (Nt.textContent = Array.from(Ke).join(`
`));
}
const br = /* @__PURE__ */ new WeakMap();
function Mo(s, t) {
  if (typeof document > "u") return;
  const e = t.getStyles?.();
  if (!e) return;
  let n = br.get(t);
  if (n || (n = `aparte-tool-renderer-${s}`, br.set(t, n)), document.getElementById(n)) return;
  const i = document.createElement("style");
  i.id = n, i.textContent = e, document.head.appendChild(i);
}
function Hu(s = R()) {
  const t = zt(s);
  t.defaultsInstalled = !0;
  for (const e of Lo)
    t.renderers.has(e.type) || Nu(e, s);
  Zs(s);
}
const Lo = [
  yu,
  Su,
  Tu,
  Iu,
  ke
], Oo = Da;
function jn(s) {
  const { target: t, config: e, messageId: n, targetId: i } = s;
  let r = new hs({ blocks: e.getStreamBlocks() }), a = /* @__PURE__ */ new Set(), o = null;
  const l = /* @__PURE__ */ new Map(), c = (y, b) => {
    const v = `tool-${y}`;
    t.updateSegment?.(v, l.has(v) ? b : { ...b, deferred: void 0 });
  };
  let d = "", u = !1, h = "", p = /* @__PURE__ */ new Map(), f = [], _ = [], g = /* @__PURE__ */ new Set();
  const m = (y) => {
    const b = y.content;
    typeof b == "string" && p.set(y.id, { text: y.type === "text", content: b });
  }, A = () => {
    if (f.length === 0) return;
    let y = 0;
    const b = [...p].map(([S, { text: x, content: L }]) => {
      const E = h.indexOf(L, y);
      return E >= 0 && (y = E + L.length), { id: S, text: x, start: E, length: L.length, citations: [] };
    }).filter((S) => S.text);
    if (b.length === 0) return;
    const v = /* @__PURE__ */ new Set();
    for (const S of _) {
      const x = b.find((N) => N.start >= 0 && S.end > N.start && S.end <= N.start + N.length);
      if (!x) continue;
      const L = S.end - x.start, E = S.start === void 0 ? void 0 : Math.max(0, Math.min(L, S.start - x.start));
      x.citations.push({ ...S, end: L, ...E === void 0 ? {} : { start: E } });
      for (const N of S.sources) v.add(N);
    }
    const w = b[b.length - 1], T = /* @__PURE__ */ new Set();
    for (const S of b) {
      const x = new Set(S.citations.flatMap((E) => E.sources)), L = f.filter((E) => x.has(E.id) || S === w && !v.has(E.id));
      if (L.length === 0) {
        g.has(S.id) && t.updateSegment?.(S.id, { sources: void 0, citations: void 0 });
        continue;
      }
      T.add(S.id), t.updateSegment?.(S.id, { sources: L, citations: S.citations });
    }
    g = T;
  }, k = (y) => {
    if (!o || u) return;
    const b = typeof Element < "u" && t instanceof Element ? I(t) : e, v = !y || b.getSegmentDefaults("thinking")?.collapsed === !1;
    t.updateSegment?.(o, v ? { isStreaming: !1 } : { collapsed: !0, isStreaming: !1 }), u = !0;
  };
  return (y) => {
    switch (y.type) {
      case "run-start":
        t.updateMessage?.(n, { status: "streaming" });
        break;
      case "turn-start":
        k(!1), r = new hs({ blocks: e.getStreamBlocks() }), a = /* @__PURE__ */ new Set(), h = "", p = /* @__PURE__ */ new Map(), f = g.size === 0 ? f.map((b) => ({ ...b, id: `${b.id}~` })) : [], _ = [], g = /* @__PURE__ */ new Set(), o = null, d = "", u = !1;
        break;
      case "thinking-delta": {
        if (d += y.delta, o)
          t.updateSegment?.(o, { content: d });
        else {
          const b = {
            id: `think-${J()}`,
            type: "thinking",
            content: d,
            isStreaming: !0
          };
          o = b.id, a.add(b.id), t.addSegment?.(b);
        }
        break;
      }
      case "text-delta": {
        k(!0), h += y.delta;
        const b = r.parse(y.delta);
        for (const w of b.segments)
          m(w), a.has(w.id) ? "content" in w && t.updateSegment?.(w.id, Dn(w)) : (t.addSegment?.(w), a.add(w.id));
        const v = r.getState().activeSegment;
        v ? (m(v), a.has(v.id) ? t.updateSegment?.(v.id, Dn(v)) : (t.addSegment?.(v), a.add(v.id))) : b.segments.length;
        break;
      }
      case "text-flush": {
        const b = r.finalize();
        for (const v of b)
          m(v), a.has(v.id) ? "content" in v && t.updateSegment?.(v.id, Dn(v)) : t.addSegment?.(v);
        A();
        break;
      }
      case "sources": {
        const b = new Map(f.map((w) => [w.id, w]));
        for (const w of Array.isArray(y.sources) ? y.sources : []) b.set(w.id, { ...b.get(w.id), ...w });
        f = [...b.values()];
        const v = new Set(_.map((w) => JSON.stringify([w.start, w.end, w.marker, w.sources])));
        for (const w of Array.isArray(y.citations) ? y.citations : []) {
          const T = JSON.stringify([w.start, w.end, w.marker, w.sources]);
          v.has(T) || (v.add(T), _.push(w));
        }
        A();
        break;
      }
      case "tool-start": {
        k(!1);
        const b = {
          id: `tool-${y.toolCallId}`,
          type: "tool_call",
          toolCall: { id: y.toolCallId, name: y.name, input: y.input },
          status: "pending"
        };
        l.set(b.id, b);
        const v = e.getToolRenderer(y.name);
        v && Mo(y.name, v), t.addSegment?.(b);
        break;
      }
      case "tool-awaiting-approval":
        t.updateSegment?.(`tool-${y.toolCallId}`, { status: "awaiting-approval" }), ut(t, "aparte-tool-approval-request", { toolCallId: y.toolCallId, toolName: y.name, input: y.input }, i);
        break;
      case "tool-approved":
        c(y.toolCallId, { status: "pending" });
        break;
      case "tool-rejected":
        c(y.toolCallId, {
          status: "rejected",
          result: y.reason,
          ...y.by ? { refusal: y.instruction ? { by: y.by, instruction: y.instruction } : { by: y.by } } : {}
        });
        break;
      case "tool-resolved":
        c(y.toolCallId, {
          status: "resolved",
          result: y.result,
          ...y.structuredResult !== void 0 ? { structuredResult: y.structuredResult } : {}
        });
        break;
      case "tool-aborted":
        c(y.toolCallId, y.cause ? { status: "aborted", abortCause: y.cause } : { status: "aborted" });
        break;
      case "tool-failed":
        c(y.toolCallId, { status: "failed", result: y.error });
        break;
      case "turn-limit-exceeded":
        y.scope === "global" ? t.addSegment?.({
          id: `max-turns-${J()}`,
          type: "error",
          // The CHAT's text, in its language — resolved from the target, as the
          // reasoning default is: a client on the global config also answers a
          // chat with its own.
          content: (typeof Element < "u" && t instanceof Element ? I(t) : e).t("maxTurnsReached").replace("{n}", () => String(y.limit)),
          code: U.MAX_TURNS_EXCEEDED
        }) : y.toolCallId && c(y.toolCallId, { status: "aborted", abortCause: "turn-limit" });
        break;
      case "run-aborted":
        ut(t, "aparte-message-aborted", { messageId: n }, i);
        break;
      case "run-suspended": {
        const b = y.ticket;
        for (const v of y.pending) {
          const w = `tool-${v.toolCallId}`, T = { reason: v.reason, ...typeof b == "string" ? { ticket: b } : {} };
          t.updateSegment?.(w, { deferred: T });
        }
        if (t.updateMessage?.(n, { status: "completed" }), y.usage)
          try {
            t.setUsage?.(n, y.usage);
          } catch {
          }
        ut(t, "aparte-message-paused", { messageId: n }, i);
        break;
      }
      case "run-done":
        if (t.updateMessage?.(n, {
          status: "completed",
          ...y.finishReason ? { finishReason: y.finishReason } : {}
        }), y.usage)
          try {
            t.setUsage?.(n, y.usage);
          } catch {
          }
        break;
    }
  };
}
function Bu(s, t) {
  return {
    [Symbol.asyncIterator]() {
      const e = s.getReader(), n = () => {
        try {
          e.cancel().catch(() => {
          });
        } catch {
        }
      };
      return t.aborted ? n() : t.addEventListener("abort", n, { once: !0 }), {
        async next() {
          const { done: i, value: r } = await e.read();
          return i ? { done: !0, value: void 0 } : { done: !1, value: r };
        },
        async return() {
          t.removeEventListener("abort", n);
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
function Js(s) {
  const t = typeof document > "u" ? void 0 : document.baseURI;
  try {
    return t ? new URL(s, t) : new URL(s);
  } catch {
    return null;
  }
}
function qu() {
  const s = typeof location > "u" ? null : location.origin;
  return s && s !== "null" ? s : null;
}
function Fu(s) {
  try {
    const t = new URL(s);
    return t.protocol === "http:" || t.protocol === "https:" ? t.origin : null;
  } catch {
    return null;
  }
}
function Uu(s, t) {
  return s === t ? !0 : typeof s == "function" || typeof t == "function" ? !1 : s.length === t.length && s.every((e, n) => e === t[n]);
}
const vr = /* @__PURE__ */ new WeakSet();
function Kn(s) {
  if (typeof s == "function")
    return (i, r) => {
      try {
        const a = s(r ? r.href : i);
        return a === "load" || a === "drop" ? a : "hold";
      } catch (a) {
        return vr.has(s) || (vr.add(s), console.warn("[aparte] The image policy threw, so the pictures it was asked about are held.", a)), "hold";
      }
    };
  let t = !1, e = !1;
  const n = /* @__PURE__ */ new Set();
  for (const i of s) {
    const r = typeof i == "string" ? i.trim() : "";
    if (r === "*") t = !0;
    else if (r === "self" || r === "'self'") e = !0;
    else {
      const a = Fu(r);
      a ? n.add(a) : console.warn(`[aparte] setImagePolicy: ${JSON.stringify(i)} is not 'self', '*' or an http(s) origin, so it allows nothing.`);
    }
  }
  return (i, r) => t || r && (n.has(r.origin) || e && r.origin === qu()) ? "load" : "hold";
}
const Ut = /^[\u0000- ]*$/;
function Wu(s, t, e) {
  if (Ut.test(t)) return "load";
  const n = Js(t);
  if (n) {
    if (n.protocol === "data:" || n.protocol === "blob:") return "load";
    if (n.protocol !== "http:" && n.protocol !== "https:") return "drop";
  }
  const i = s(t, n);
  return i === "hold" && n !== null && e?.has(n.href) ? "load" : i;
}
const mn = /* @__PURE__ */ new WeakMap();
function zu(s, t) {
  const e = Js(t);
  if (!e) return;
  let n = mn.get(s);
  n || mn.set(s, n = /* @__PURE__ */ new Set()), n.add(e.href);
}
function Gu(s) {
  return mn.get(s);
}
function ju(s) {
  mn.delete(s);
}
const Ve = /[\t\n\f\r ]/, Ku = /^(?:|\d+w(?: \d+h)?|(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?x)$/;
function $o(s) {
  const t = [], e = s.length;
  let n = 0;
  for (; n < e; ) {
    for (; n < e && (Ve.test(s[n]) || s[n] === ","); ) n++;
    if (n >= e) break;
    const i = n;
    for (; n < e && !Ve.test(s[n]); ) n++;
    let r = s.slice(i, n);
    const a = [];
    if (r.endsWith(","))
      r = r.replace(/,+$/, "");
    else {
      let l = "", c = "in";
      for (; ; ) {
        const d = s[n];
        if (c === "in") {
          if (d === void 0) {
            l && a.push(l);
            break;
          }
          if (d === ",") {
            n++, l && a.push(l);
            break;
          }
          Ve.test(d) ? (l && a.push(l), l = "", c = "after") : (l += d, d === "(" && (c = "parens"));
        } else if (c === "parens") {
          if (d === void 0) {
            a.push(l);
            break;
          }
          l += d, d === ")" && (c = "in");
        } else {
          if (d === void 0) break;
          if (!Ve.test(d)) {
            c = "in";
            continue;
          }
        }
        n++;
      }
    }
    const o = a.join(" ");
    r && Ku.test(o) && t.push({ url: r, descriptor: o });
  }
  return t;
}
function No(s) {
  return s.map((t) => t.descriptor ? `${t.url} ${t.descriptor}` : t.url).join(", ");
}
function Po(s) {
  const t = Js(s);
  if (t?.hostname) return t.hostname;
  const e = s.trim();
  return e.length > 48 ? `${e.slice(0, 47)}…` : e;
}
function bn(s, t, e, n = !1) {
  const i = Po(s), r = t ? e.named(i, t) : e.load(i), a = e.icon;
  return `${n ? '<span class="aparte-tag aparte-image-held" role="button" tabindex="0"' : `<a class="aparte-tag aparte-image-held" href="${O(s)}" target="_blank" rel="noopener noreferrer"`} data-aparte-image="${O(s)}"${t ? ` data-aparte-image-alt="${O(t)}"` : ""} title="${O(e.load(i))}" aria-label="${O(r)}"><span class="aparte-image-held__icon" aria-hidden="true">${a}</span>` + (t ? `<span class="aparte-tag__label aparte-image-held__alt">${$(t)}</span>` : "") + `<span class="aparte-image-held__host">${$(i)}</span>${n ? "</span>" : "</a>"}`;
}
function Do(s, t) {
  return `<img src="${O(s)}" alt="${O(t)}" referrerpolicy="no-referrer">`;
}
const Ho = /<(?:img|source)\b|data-aparte-image/i, Vu = "a[data-aparte-image], span[data-aparte-image]";
function Xu(s, t, e) {
  return !s || !Ho.test(s) ? s : typeof document > "u" ? nh(s, t, e) : Yu(s, t, e);
}
function Bo(s, t, e) {
  const n = t === void 0 ? [] : $o(t), i = Ut.test(s) ? n[0]?.url : s;
  if (i === void 0) return null;
  const r = e(i);
  if (r !== "load") return { decision: r, address: i, srcset: null };
  const a = n.filter((o) => e(o.url) === "load");
  return { decision: r, address: i, srcset: a.length ? No(a) : null };
}
function qo(s, t, e) {
  if (!Ut.test(s) && e(s) !== "load") return !1;
  if (t === void 0) return Ut.test(s) ? !1 : null;
  const n = $o(t).filter((i) => e(i.url) === "load");
  return n.length ? No(n) : Ut.test(s) ? !1 : null;
}
function Yu(s, t, e) {
  const n = document.createElement("template");
  n.innerHTML = s;
  const i = n.content;
  let r, a = !1;
  const o = (l) => {
    const c = document.createElement("template");
    return c.innerHTML = l, c.content;
  };
  for (const l of Array.from(i.querySelectorAll(Vu))) {
    const c = l.getAttribute("data-aparte-image") ?? "", d = l.getAttribute("data-aparte-image-alt") ?? "", u = Ut.test(c) ? "drop" : t(c);
    a = !0, u === "drop" ? l.remove() : l.replaceWith(o(u === "load" ? Do(c, d) : bn(c, d, r ??= e(), !!l.parentElement?.closest("a"))));
  }
  for (const l of Array.from(i.querySelectorAll("source"))) {
    const c = qo(l.getAttribute("src") ?? "", l.getAttribute("srcset") ?? void 0, t);
    if (c === !1) {
      l.remove(), a = !0;
      continue;
    }
    c === null ? l.hasAttribute("srcset") && (l.removeAttribute("srcset"), a = !0) : c !== l.getAttribute("srcset") && (l.setAttribute("srcset", c), a = !0);
  }
  for (const l of Array.from(i.querySelectorAll("img"))) {
    const c = Bo(l.getAttribute("src") ?? "", l.getAttribute("srcset") ?? void 0, t);
    if (!c) {
      l.hasAttribute("srcset") && (l.removeAttribute("srcset"), a = !0), l.parentElement?.localName === "picture" && l.getAttribute("referrerpolicy") !== "no-referrer" && (l.setAttribute("referrerpolicy", "no-referrer"), a = !0);
      continue;
    }
    if (a = !0, c.decision === "drop") {
      l.remove();
      continue;
    }
    if (c.decision === "hold") {
      l.replaceWith(o(bn(c.address, l.getAttribute("alt") ?? "", r ??= e(), !!l.closest("a"))));
      continue;
    }
    c.srcset === null ? l.removeAttribute("srcset") : l.setAttribute("srcset", c.srcset), l.setAttribute("referrerpolicy", "no-referrer");
  }
  return a ? n.innerHTML : s;
}
const Qu = /* @__PURE__ */ new Set(["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript", "plaintext"]), Zu = /* @__PURE__ */ new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]), Ju = /[A-Za-z]/, th = /^[a-z][a-z0-9_.:-]*$/;
function Vn(s, t, e) {
  const n = t.filter(([r]) => !(r in e) && th.test(r)), i = Object.entries(e).filter((r) => r[1] !== null);
  return `<${s}${[...n, ...i].map(([r, a]) => ` ${r}="${O(a)}"`).join("")}>`;
}
function eh(s, t, e) {
  const n = new RegExp(`<(/?)${t}(?=[\\s/>])`, "g");
  n.lastIndex = e;
  let i = 1;
  for (let r = n.exec(s); r; r = n.exec(s))
    if (i += r[1] ? -1 : 1, i === 0) {
      const a = s.indexOf(">", r.index);
      return a < 0 ? s.length : a + 1;
    }
  return -1;
}
function nh(s, t, e) {
  if (!s || !Ho.test(s)) return s;
  const n = s.toLowerCase(), i = s.length;
  let r, a = "", o = 0, l = 0;
  const c = [];
  for (; o < i; ) {
    const d = s.indexOf("<", o);
    if (d < 0) {
      a += s.slice(o);
      break;
    }
    if (a += s.slice(o, d), s.startsWith("<!--", d)) {
      const A = s.indexOf("-->", d + 4), k = A < 0 ? i : A + 3;
      a += s.slice(d, k), o = k;
      continue;
    }
    const u = s[d + 1] === "/", h = d + (u ? 2 : 1);
    if (!Ju.test(s[h] ?? "")) {
      a += "<", o = d + 1;
      continue;
    }
    const { tag: p, attrs: f, end: _ } = to(s, h);
    if (_ < 0) {
      a += s.slice(d);
      break;
    }
    o = _;
    const g = s.slice(d, _);
    if (u) {
      p === "a" && (l = Math.max(0, l - 1));
      const A = c.lastIndexOf(p);
      A >= 0 && (c.length = A), a += g;
      continue;
    }
    const m = (A) => f.find(([k]) => k === A)?.[1];
    if (Qu.has(p)) {
      const A = n.indexOf(`</${p}`, _), k = A < 0 ? i : A;
      a += g + s.slice(_, k), o = k;
      continue;
    }
    if ((p === "a" || p === "span") && m("data-aparte-image") !== void 0) {
      const A = eh(n, p, _);
      A >= 0 ? o = A : p === "a" && (l += 1);
      const k = m("data-aparte-image") ?? "", y = m("data-aparte-image-alt") ?? "", b = Ut.test(k) ? "drop" : t(k);
      b === "load" ? a += Do(k, y) : b === "hold" && (a += bn(k, y, r ??= e(), l > 0));
      continue;
    }
    if (p === "a" && (l += 1), p === "source") {
      const A = qo(m("src") ?? "", m("srcset"), t);
      if (A === !1) continue;
      a += A === (m("srcset") ?? null) ? g : Vn(p, f, { srcset: A });
      continue;
    }
    if (p === "img") {
      const A = Bo(m("src") ?? "", m("srcset"), t);
      if (!A) {
        const k = c[c.length - 1] === "picture";
        m("srcset") === void 0 && (!k || m("referrerpolicy") === "no-referrer") ? a += g : a += Vn(p, f, { srcset: null, ...k ? { referrerpolicy: "no-referrer" } : {} });
        continue;
      }
      A.decision === "hold" ? a += bn(A.address, m("alt") ?? "", r ??= e(), l > 0) : A.decision === "load" && (a += Vn(p, f, { srcset: A.srcset, referrerpolicy: "no-referrer" }));
      continue;
    }
    !Zu.has(p) && !g.endsWith("/>") && c.push(p), a += g;
  }
  return a;
}
class Ae extends DOMException {
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
function sh(s) {
  return s ? s.tagName?.toLowerCase() === "aparte-chat" || s.hasAttribute?.("data-aparte-chat") === !0 : !1;
}
function Rt(s) {
  let t = s ?? null;
  for (; t; ) {
    if (sh(t)) return t;
    t = t.parentElement;
  }
  return null;
}
class yr {
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
      const n = String(t), i = this.patterns.get(n);
      i ? i.value = e : this.patterns.set(n, { re: t, value: e });
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
    for (const { re: n, value: i } of this.patterns.values())
      if (t.search(n) !== -1) return { value: i, level: "pattern" };
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
let wr = !1;
const Pt = {
  copy: !1,
  retry: !1,
  edit: !1,
  feedback: !1,
  info: !1
}, Xe = {
  attachmentPreview: !1,
  filePreview: !1
}, Sr = () => {
}, Fo = /* @__PURE__ */ new WeakMap();
function yt(s) {
  return Fo.get(s) ?? 0;
}
function bt(s) {
  Fo.set(s, yt(s) + 1);
}
const Es = /* @__PURE__ */ new Set(), Ye = /* @__PURE__ */ new Set();
function ih(s) {
  return Es.add(s), () => {
    Es.delete(s);
  };
}
function ln(s) {
  Ye.size === 0 && queueMicrotask(() => {
    const t = [...Ye];
    Ye.clear();
    for (const e of t)
      for (const n of [...Es])
        try {
          n(e);
        } catch (i) {
          console.error("[aparte] a renderer-change listener threw", i);
        }
  }), Ye.add(s);
}
const rh = (s) => s instanceof RegExp ? `re:${String(s)}` : `name:${s}`, Xn = ["hidden", "open", "details", "quiet"];
function Yn(s, t) {
  if (!s || !(t in s) || t in Object.prototype) return;
  const e = s[t];
  return typeof e == "function" ? e.bind(s) : void 0;
}
const kr = /* @__PURE__ */ new WeakSet();
function ah(s) {
  const t = /* @__PURE__ */ new Set();
  for (let e = s; e && e !== Object.prototype; e = Object.getPrototypeOf(e))
    for (const n of Object.getOwnPropertyNames(e)) n !== "constructor" && t.add(n);
  return [...t];
}
class Cs {
  _markdownProvider;
  _streamingMarkdownProvider;
  _highlightProvider;
  _codeLanguageRenderers = /* @__PURE__ */ new Map();
  // HTML sanitizer applied to markdown/highlight PROVIDER output (untrusted,
  // LLM-authored) before it is injected via innerHTML. Default = built-in
  // zero-dep allowlist sanitizer; `null` disables it (trusted content only).
  _sanitizer = Wi;
  // Which pictures a model or a tool chose load without a click (`image-policy.ts`): by
  // default only `data:` and `blob:`, which make no request.
  _imagePolicy = [];
  _imageDecider = Kn([]);
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
  _locale = ve;
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
  _transport = new Gc();
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
  _toolRenderers = new yr();
  /** {@link overrideToolRenderer}'s stacks: what each matcher held below every override. */
  /** Per matcher: what it held below every override, then one entry per override — an object of its own, so two overrides of the same renderer are told apart. */
  _toolRendererOverrides = /* @__PURE__ */ new Map();
  /** Bumped by `reset()`: a restore function from before it must not undo what came after. */
  _overrideGeneration = 0;
  _toolDisplays = new yr();
  /** Tagged blocks the stream parser recognises in the prose — see {@link registerStreamBlock}. */
  _streamBlocks = /* @__PURE__ */ new Map();
  _segmentDefaults = /* @__PURE__ */ new Map();
  // Host handlers — what the app declares it can actually complete.
  _hostHandlers = { ...Xe };
  // Bubble Actions — APARTE_DEFAULT_BUBBLE_ACTIONS is the single source of truth
  // (init here, restored by reset(), and the fallback in getBubbleActions()).
  _bubbleActionsConfig = { ...Pt };
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
    const e = this._actions.findIndex((n) => n.id === t.id);
    e !== -1 ? (console.warn(`[AparteConfig] Action with ID "${t.id}" already registered. Overwriting.`), this._actions[e] = t) : this._actions.push(t), this._notify();
  }
  /** All registered actions for a zone, sorted by `order` (lower first). */
  getActions(t) {
    return this._actions.filter((e) => e.zones.includes(t)).sort((e, n) => (e.order || 0) - (n.order || 0));
  }
  /** Remove a custom action by id (from every zone); notifies mounted elements if it existed. */
  unregisterAction(t) {
    const e = this._actions.length;
    this._actions = this._actions.filter((n) => n.id !== t), this._actions.length !== e && this._notify();
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
    this._turnSummary = t === !1 ? null : t === !0 ? {} : t, bt(this), this._notify();
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
      attachmentPreview: this._hostHandlers.attachmentPreview ?? Xe.attachmentPreview,
      filePreview: this._hostHandlers.filePreview ?? Xe.filePreview
    };
  }
  /** Returns the resolved bubble actions config (flag defaults applied; per-role sets passed through). */
  getBubbleActions() {
    return {
      copy: this._bubbleActionsConfig.copy ?? Pt.copy,
      retry: this._bubbleActionsConfig.retry ?? Pt.retry,
      edit: this._bubbleActionsConfig.edit ?? Pt.edit,
      feedback: this._bubbleActionsConfig.feedback ?? Pt.feedback,
      info: this._bubbleActionsConfig.info ?? Pt.info,
      feedbackReasons: this._bubbleActionsConfig.feedbackReasons,
      user: this._bubbleActionsConfig.user,
      assistant: this._bubbleActionsConfig.assistant
    };
  }
  /**
   * Set a custom Markdown renderer (e.g., marked, maritime-it)
   */
  setMarkdownProvider(t) {
    this._markdownProvider = t, bt(this), this._notify();
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
    this._streamingMarkdownProvider = t, bt(this), this._notify();
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
    this._highlightProvider = t, bt(this), this._notify();
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
    const e = t.languages.map((n) => n.toLowerCase());
    for (const n of e) this._codeLanguageRenderers.set(n, t);
    return bt(this), this._notify(), () => {
      let n = !1;
      for (const i of e)
        this._codeLanguageRenderers.get(i) === t && (this._codeLanguageRenderers.delete(i), n = !0);
      n && (bt(this), this._notify());
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
    ), this._sanitizer = t, bt(this), this._notify());
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
    return Xu(e, (n) => this.decideImage(n), () => this._heldImageWords());
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
    this._imagePolicyNamed = !0, !Uu(t, this._imagePolicy) && (this._imagePolicy = typeof t == "function" ? t : [...t], this._imageDecider = Kn(t), bt(this), this._notify());
  }
  /**
   * What the picture at `url` does under this config's image policy: `'load'`, `'hold'`
   * (shown as a link that loads it on a click) or `'drop'`. For a plugin that draws pictures
   * itself, as `@aparte/plugin-cards` does: ask before setting a `src`, because setting it is
   * the request.
   */
  decideImage(t) {
    const e = Wu(this._imageDecider, t, Gu(this));
    return e === "hold" && this._noteHeldImage(t), e;
  }
  /**
   * The first picture the default policy holds, said once to the developer. A picture that
   * waits for a click with nothing in the console reads as a broken image to whoever wrote
   * the app, and the line that changes it cannot be guessed. Silent once the app names a
   * policy, whatever it is: `setImagePolicy([])` keeps the default and the silence.
   */
  _noteHeldImage(t) {
    this._imagePolicyNamed || wr || (wr = !0, console.warn(
      `[aparte] A picture from ${Po(t)} waits for the reader's click: pictures a model or a tool chose load only from the sources the app allows. To load yours, call aparteGlobalConfig.setImagePolicy(['https://cdn.example.com']); to keep holding them without this note, setImagePolicy([]). Why: https://apartejs.dev/guides/markdown/#pictures-a-reply-can-load`
    ));
  }
  /**
   * The reader chose to see the picture at `url`: from now on it loads wherever this
   * config's image policy would only have held it (a picture the policy drops stays
   * dropped). Core calls it when a held picture's link is clicked; a plugin calls it from
   * its own "Show images", then draws again. Nothing on screen is redrawn by this call.
   */
  showImage(t) {
    zu(this, t);
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
    return this._systemPromptTemplate.replace(/\{\{([^}]+)\}\}/g, (n, i) => t[i.trim()] ?? "").trim() || null;
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
    if (e && kr.has(e))
      Object.assign(e, t);
    else {
      const n = Object.assign(Object.create(e ?? null), t);
      kr.add(n), this._iconProvider = n;
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
    for (const n of Object.keys(ze))
      e[n] = Yn(t, n) ?? (() => ze[n]);
    for (const n of ah(t)) {
      const i = Yn(t, n);
      i && !(n in e) && (e[n] = i);
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
    this._locale = ve, this._notify();
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
    const e = Yn(this._iconProvider, t);
    return e ? e() : Object.prototype.hasOwnProperty.call(ze, t) ? ze[t] : void 0;
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
    const e = (n) => t(n);
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
      const n = await e(t);
      if (n) return n;
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
      const n = await this.getKey(t), i = await e.fetchModels(n), r = this._fetchedModels.get(t);
      if (i.length === 0 && r?.length) return r;
      const a = this.getCurrentModel()?.contextWindow;
      return this._fetchedModels.set(t, i), this.getCurrentModel()?.contextWindow !== a && this._notify(), i;
    } catch (n) {
      return console.warn(`[AparteConfig] Failed to refresh models for ${t}`, n), [];
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
      const e = [...this._aiProviders.values()][0], n = e.getModels();
      n.length === 1 && (this._modelConfig = { ...this._modelConfig, defaultProvider: e.id, defaultModel: n[0].id });
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
    return e?.length ? t.filter((i) => e.includes(i.id)) : t;
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
    const e = this._tools.get(t.name)?.tool, n = this._approvalPolicy?.(t, e);
    return n || { verdict: e?.needsApproval ? "ask" : "allow" };
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
    const n = this._aiProviders.get(t);
    if (!n) return;
    const r = this._fetchedModels.get(t)?.find((o) => o.id === e);
    if (r) return r;
    const a = n.getModels();
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
    const e = this._locale[t] || ve[t];
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
        const e = document.createElement("div"), n = this._streamingMarkdownProvider(e);
        return n.write(t), n.end(), this.sanitizeHtml(e.innerHTML);
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
  async highlightCode(t, e, n = {}) {
    if (this._highlightProvider)
      try {
        const i = this._highlightProvider(t, e), r = i instanceof Promise ? await i : i;
        return this.sanitizeHtml(r);
      } catch (i) {
        if (console.warn("[AparteConfig] Highlight provider failed, using fallback:", i), n.fallback === !1) throw i;
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
    const e = t ? new Set(t.map((i) => i.name)) : null, n = Array.from(this._tools.values()).filter((i) => !e || e.has(i.tool.name)).map((i) => i.tool.systemPrompt?.trim()).filter((i) => !!i);
    return n.length ? n.join(`

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
    this._toolRenderers.get(t) !== e && (this._toolRenderers.set(t, e), ln(this));
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
    const n = rh(t), i = this._toolRenderers.get(t);
    let r = this._toolRendererOverrides.get(n);
    r ? r[r.length - 1].renderer !== i && r.splice(0, r.length, { renderer: i }) : (r = [{ renderer: i }], this._toolRendererOverrides.set(n, r));
    const a = { renderer: e };
    r.push(a), this.registerToolRenderer(t, e);
    const o = this._overrideGeneration;
    let l = !1;
    return () => {
      if (l || o !== this._overrideGeneration) return;
      l = !0;
      const c = r.indexOf(a);
      if (c <= 0) return;
      const d = c === r.length - 1;
      if (r.splice(c, 1), r.length === 1 && this._toolRendererOverrides.get(n) === r && this._toolRendererOverrides.delete(n), !d || this._toolRenderers.get(t) !== e) return;
      const u = r[r.length - 1].renderer;
      u ? this.registerToolRenderer(t, u) : this.unregisterToolRenderer(t);
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
    this._toolRenderers.get(t) !== void 0 && (this._toolRenderers.delete(t), ln(this));
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
    const n = this._toolDisplays.get(t), i = { ...n, ...e };
    this._toolDisplays.set(t, i), (Xn.some((a) => n?.[a] !== i[a]) || n === void 0 && this._anotherShapes(i)) && bt(this), this._notify();
  }
  /** Forget the display registered under this matcher. */
  unregisterToolDisplay(t) {
    const e = this._toolDisplays.get(t);
    this._toolDisplays.delete(t), (Xn.some((i) => e?.[i] !== void 0) || e !== void 0 && this._anotherShapes(e)) && bt(this), this._notify();
  }
  /** Whether an entry other than `own` sets a field that shapes a row. */
  _anotherShapes(t) {
    return this._toolDisplays.values().some((e) => e !== t && Xn.some((n) => e[n] !== void 0));
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
    const n = this._toolRenderers.resolve(t), i = { exact: 2, pattern: 1, any: 0 };
    return !n || i[n.level] <= i[e.level];
  }
  /** Drop one field of the entry under `match`, and the entry when nothing is left. */
  _dropToolDisplayField(t, e) {
    const n = this._toolDisplays.get(t);
    if (!n || !(e in n)) return;
    const { [e]: i, ...r } = n;
    Object.keys(r).length ? this._toolDisplays.set(t, r) : this._toolDisplays.delete(t), this._notify();
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
    this._elicitationPresenters = this._elicitationPresenters.filter((n) => n.fn !== t), this._elicitationPresenters.push(e === void 0 ? { fn: t } : { fn: t, owner: e });
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
        const n = Rt(t);
        if (n)
          for (let i = e.length - 1; i >= 0; i -= 1) {
            const r = e[i];
            if (r.owner && Rt(r.owner) === n) return r.fn;
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
    const e = this._elicitationQueueKey(t), n = this._elicitationQueue.get(e), i = n === void 0 ? this._present(t) : n.then(
      () => this._present(t),
      () => this._present(t)
    ), r = i.then(Sr, Sr).then(() => {
      this._elicitationQueue.get(e) === r && this._elicitationQueue.delete(e);
    });
    return this._elicitationQueue.set(e, r), i;
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
    return Rt(t.target);
  }
  /** Hand ONE request to the presenter. Called only from the queue. */
  _present(t) {
    const e = this._presenterFor(t.target);
    if (!e)
      return this._warnedNoPresenter || (this._warnedNoPresenter = !0, console.warn(
        "[aparte] requestUserInput() was called with no elicitation presenter, so it rejected with an AbortError — nothing was ever shown to anybody. Add <aparte-elicitation></aparte-elicitation> inside your <aparte-chat> (the Angular wrapper's tag too) — or, under the React/Vue/Svelte wrappers, inside their [data-aparte-chat] host (every wrapper renders it by default, unless you passed `elicitation={false}`) — or register your own by calling setElicitationPresenter() on the config this chat resolves — the scoped one if you passed a `config`, aparteGlobalConfig otherwise."
      )), Promise.reject(new Ae("no-presenter"));
    if (t.signal?.aborted) return Promise.reject(new Ae("aborted"));
    const n = e(t), i = t.signal;
    return i ? new Promise((r, a) => {
      const o = () => a(new Ae("aborted"));
      i.addEventListener("abort", o, { once: !0 }), n.then(r, a).finally(() => i.removeEventListener("abort", o));
    }) : n;
  }
  /**
   * Put the configuration back to its defaults: the providers and the selected model,
   * the tools with their renderers and summaries, the renderers and render hooks, the
   * Markdown and highlight providers, the code-language renderers, the sanitizer, the system prompt, the locale, icons,
   * avatars, actions and host handlers, the conversation manager, the question presenters
   * and their queue. Three things stay: the transport, the key sources added with
   * {@link AparteConfig.registerKeyProvider | registerKeyProvider()} (an `AparteClient`'s
   * `keyResolver` among them), and the {@link AparteConfig.subscribe | subscribe()} listeners.
   */
  reset() {
    this._markdownProvider = void 0, this._streamingMarkdownProvider = void 0, this._highlightProvider = void 0, this._codeLanguageRenderers.clear(), this._systemPromptTemplate = void 0, this._systemPromptVarsProvider = void 0, this._statusRenderer = void 0, this._errorRenderer = void 0, this._attachmentRenderer = void 0, this._siblingNavRenderer = void 0, this._bubbleShellRenderer = void 0, this._iconProvider = void 0, this._segmentDefaults.clear(), this._avatarProvider = void 0, this._keyProvider = void 0, this._conversationManager = void 0, this._elicitationPresenters = [], this._elicitationQueue.clear(), this._locale = ve, this._actions = [], this._sanitizer = Wi, this._imagePolicy = [], this._imageDecider = Kn([]), this._imagePolicyNamed = !1, ju(this), this._aiProviders.clear(), this._fetchedModels.clear(), this._tools.clear(), this._toolRenderers.clear(), this._toolRendererOverrides.clear(), this._overrideGeneration++, ln(this), this._toolDisplays.clear(), this._streamBlocks.clear(), this._modelConfig = {}, this._requireModelSelection = !1, this._elicitationAllowOther = !0, this._elicitationLayout = "stepped", this._elicitationAnswerOnClick = !0, this._elicitationFieldRenderer = void 0, this._modelPreferenceProvider = void 0, this._approvalPolicy = null, this._compactor = null, this._bubbleActionsConfig = { ...Pt }, this._turnSummary = null, this._streamingCaret = !1, this._dateSeparators = !1, this._hostHandlers = { ...Xe }, this._notify();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Default Fallbacks (Zero-dependency)
  // ─────────────────────────────────────────────────────────────────────────
  _defaultMarkdownRenderer(t) {
    return $(t).replace(/\n/g, "<br>");
  }
  _defaultHighlightRenderer(t) {
    return `<pre><code>${$(t)}</code></pre>`;
  }
}
const Qn = Symbol.for("aparte.globalConfig.1");
function oh() {
  return typeof window < "u" ? (window[Qn] || (window[Qn] = new Cs()), window[Qn]) : new Cs();
}
const lt = oh(), Ar = "aparte-config-change";
function Kt(s, t) {
  const e = (n) => {
    const i = n.detail;
    i?.config && i.config !== I(s) || t();
  };
  return window.addEventListener(Ar, e), () => window.removeEventListener(Ar, e);
}
const lh = /[\p{Z}\s]+/gu, ch = /[\p{Cc}\p{Co}\p{Cn}\p{Cs}\u2800]|(?!(?:\u200C|\u200D|\uFE0E|\uFE0F))\p{Default_Ignorable_Code_Point}/u, dh = /\u{1F3F4}\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0073}\u{E0063}\u{E0074}|\u{E0077}\u{E006C}\u{E0073})\u{E007F}/gu, uh = /(?:^| )\p{M}|\p{Mn}{5,}/u, hh = /* @__PURE__ */ new Set(["‌", "‍", "︎", "️"]), ph = /^[0-9#*]$/, fh = /^\p{Emoji}$/u, Er = /^\p{Extended_Pictographic}$/u, gh = /^\p{Emoji_Modifier}$/u, Cr = /^[\p{scx=Arab}\p{scx=Syrc}\p{scx=Thaa}\p{scx=Nkoo}\p{scx=Adlm}\p{scx=Rohg}\p{scx=Mong}\p{scx=Deva}\p{scx=Beng}\p{scx=Guru}\p{scx=Gujr}\p{scx=Orya}\p{scx=Taml}\p{scx=Telu}\p{scx=Knda}\p{scx=Mlym}\p{scx=Sinh}\p{scx=Mymr}\p{scx=Khmr}]$/u, _h = /^[\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D\u0DCA\u1039\u17D2]$/;
function mh(s) {
  const t = Array.from(s);
  for (let e = 0; e < t.length; e++) {
    const n = t[e];
    if (!hh.has(n)) continue;
    const i = t[e - 1] ?? "", r = t[e + 1] ?? "";
    if (n === "︎" || n === "️") {
      if (ph.test(i)) {
        if (n !== "️" || r !== "⃣") return !1;
      } else if (!fh.test(i)) return !1;
      continue;
    }
    if (n === "‍") {
      const a = i === "️" ? t[e - 2] ?? "" : i;
      if ((Er.test(a) || gh.test(a)) && Er.test(r)) continue;
    }
    if (!(Cr.test(i) && (Cr.test(r) || _h.test(i) && (r === "" || r === " "))))
      return !1;
  }
  return !0;
}
const bh = 100;
function vh(s) {
  const t = (typeof s == "string" ? s : s.label).replace(lh, " ").trim();
  if (!t || t.length > bh) return null;
  const e = t.replace(dh, "🏴");
  return ch.test(e) || uh.test(e) || !mh(e) ? null : t;
}
const yh = /* @__PURE__ */ new WeakSet();
function xr(s) {
  return !!s && yh.has(s);
}
function wh(s) {
  const t = s.segments, e = t[t.length - 1];
  return s.status !== "streaming" || !e || e.isStreaming !== void 0 || e.type !== "text" && e.type !== "thinking" ? t : [...t.slice(0, -1), { ...e, isStreaming: !0 }];
}
function Tr(s, t, e) {
  if (s.setTokens?.(t.tokens), t.segments && t.segments.length > 0) {
    const n = s.getSegments?.() ?? [];
    if (n.length === t.segments.length) {
      const i = Ua(t.status);
      for (const r of t.segments)
        if ("content" in r) {
          const a = { content: r.content };
          i && (a.isStreaming = !1);
          const o = n.find((l) => l.id === r.id);
          r.type === "text" && (r.sources || r.citations || o?.sources || o?.citations) && Object.assign(a, { sources: r.sources, citations: r.citations }), s.updateSegment?.(r.id, a);
        }
    } else
      s.setSegments?.(wh(t));
  } else t.content !== void 0 && s.setContent?.(t.content);
  t.attachments && t.attachments.length > 0 && s.setAttachments?.(t.attachments), e && e.count > 1 && s.setSiblings?.(e.count, e.index), t.usage !== void 0 && s.setUsage?.(t.usage), s.setFinishReason?.(t.finishReason), s.setContextSummary?.(t.contextSummary, { legacy: t.compaction === !0 });
}
const Sh = 2, ti = Symbol.for("aparte.derivedSegments");
function kh(s, t, e) {
  if (e <= 0 || s.length <= e) return { messages: s, tree: t };
  const n = s.length - e, i = s.slice(n), r = i[0], a = r?.id;
  let o;
  for (let p = s.length - 1; p >= 0; p--) {
    const f = s[p].contextSummary;
    if (f) {
      p < n && (o = { ...f, count: f.count + (n - p) });
      break;
    }
  }
  if (r && o && (i[0] = { ...r, contextSummary: o }), !a || !t) return { messages: i, tree: t };
  if (!new Set(t.messages.map((p) => p.message.id)).has(a)) return { messages: i, tree: t };
  const c = /* @__PURE__ */ new Map();
  for (const { message: p, parentId: f } of t.messages)
    if (f != null) {
      const _ = c.get(f) ?? [];
      _.push(p.id), c.set(f, _);
    }
  const d = /* @__PURE__ */ new Set(), u = [a];
  for (; u.length; ) {
    const p = u.pop();
    if (!d.has(p)) {
      d.add(p);
      for (const f of c.get(p) ?? []) u.push(f);
    }
  }
  const h = {
    headId: t.headId,
    messages: t.messages.filter((p) => d.has(p.message.id)).map((p) => p.message.id === a ? { message: o ? { ...p.message, contextSummary: o } : p.message, parentId: null } : p)
  };
  return { messages: i, tree: h };
}
function ei(s) {
  if (!s[ti]) return s;
  const { segments: t, ...e } = s;
  return e;
}
function Ah(s) {
  return s.map(ei);
}
function Eh(s) {
  return {
    ...s,
    messages: s.messages.map((t) => ({ ...t, message: ei(t.message) }))
  };
}
function Uo(s) {
  return JSON.stringify(s, (t, e) => e && typeof e == "object" && !Array.isArray(e) ? Object.fromEntries(Object.keys(e).sort().map((n) => [n, e[n]])) : e);
}
function Wo(s) {
  return nn(ei(s));
}
function Qe(s) {
  return Uo(s.map(Wo));
}
function Ir(s) {
  const t = [...s.messages].sort((e, n) => e.message.id < n.message.id ? -1 : e.message.id > n.message.id ? 1 : 0);
  return Uo(t.map((e) => ({ parentId: e.parentId, message: Wo(e.message) })));
}
const Rr = (s) => s.role === "user" && !s.compaction;
class Ch {
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
      const n = new Map(this._conversations.filter((o) => this._loaded.has(o.id)).map((o) => [o.id, o]));
      this._loaded.clear();
      const i = e ? (await this._adapter.loadMeta()).map((o) => {
        const l = n.get(o.id);
        return l ? { ...o, messages: l.messages, ...l.tree ? { tree: l.tree } : {} } : { ...o, messages: [] };
      }) : (await this._adapter.loadAll()).map((o) => ({ ...o, messages: o.messages ?? [] })), r = /* @__PURE__ */ new Set(), a = i.filter((o) => !r.has(o.id) && (r.add(o.id), !0));
      a.length !== i.length && console.warn(`[AparteConversationManager] ${i.length - a.length} repeated id(s) in the list; the first row wins.`), this._conversations = a;
      for (const o of a) (!e || n.has(o.id)) && this._loaded.add(o.id);
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
    const n = (async () => {
      const i = await this._adapter.loadFull(t), r = this._find(t);
      return !r || !i ? !1 : i.id !== t ? (console.warn(`[AparteConversationManager] loadFull('${t}') answered with '${i.id}': ignored.`), !1) : (this._replace({ ...r, ...i, id: t, messages: i.messages ?? [] }), this._loaded.add(t), this._notify(), !0);
    })().finally(() => this._fetching.delete(t));
    return this._fetching.set(t, n), n;
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
    const e = Date.now(), n = {
      id: J(),
      title: t,
      createdAt: e,
      updatedAt: e,
      messages: [],
      schemaVersion: Sh
    };
    this._activeId = n.id, this._loaded.add(n.id), this._initPromise && await this._initPromise.catch(() => {
    }), this._conversations = [n, ...this._conversations];
    try {
      await this._adapter.save(n);
    } catch (i) {
      console.warn("[AparteConversationManager] save() failed for a new conversation; it stays in memory and the next write retries.", i);
    }
    return this._notify(), n;
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
    const n = this._appending.get(t), i = n ? n.then(() => this._append(t, e)) : this._append(t, e), r = i.catch(() => {
    });
    return this._appending.set(t, r), r.then(() => {
      this._appending.get(t) === r && this._appending.delete(t);
    }), i;
  }
  async _append(t, e) {
    const n = await this._full(t);
    if (!n) return;
    const i = e.role === "user" && !e.compaction && n.messages.every((c) => c.role !== "user" || c.compaction), r = i ? await this._title(e) : null, a = this._find(t);
    if (!a) return;
    const o = a.messages.some((c) => c.id === e.id), l = {
      ...a,
      messages: o ? a.messages : [...a.messages, e],
      updatedAt: Date.now(),
      title: r ?? a.title
    };
    i && (l.autoTitle = !0), this._replace(l), await this._adapter.save(l), this._notify();
  }
  /**
   * Replace the flat active-path messages and optionally the full branch tree.
   * `messages` is always written (active path, for sidebar/title/compat).
   * `tree` is written when provided — it carries the full branching topology.
   */
  async updateMessages(t, e, n) {
    const i = this._find(t);
    if (!i) return;
    if (!this._loaded.has(t)) {
      console.warn(`[AparteConversationManager] updateMessages('${t}') before its messages were loaded: ignored.`);
      return;
    }
    const r = e.find(Rr);
    this._retention && ({ messages: e, tree: n } = kh(e, n, this._retention.maxMessages));
    const a = Ah(e), o = n === void 0 ? void 0 : Eh(n);
    let l = !0, c = n !== void 0;
    try {
      if (o !== void 0 && i.tree !== void 0) {
        const p = Ir(o) !== Ir(i.tree);
        l = p || o.headId === i.tree.headId && Qe(a) !== Qe(i.messages), c = p || o.headId !== i.tree.headId;
      } else
        l = Qe(a) !== Qe(i.messages), o !== void 0 && (c = !0);
    } catch {
    }
    let d;
    if (i.autoTitle) {
      const p = i.messages.find(Rr);
      r && (r.content ?? "") !== (p?.content ?? "") && (d = await this._title(r));
    }
    if (!l && !c && d === void 0) return;
    const u = this._find(t);
    if (!u) return;
    const h = {
      ...u,
      // What is stored is what the caller sent: segments a viewport DERIVED on
      // display are not the app's content. Stored, they would fill the record with
      // core-generated ids and freeze the parse as it stood the day it was saved —
      // a block grammar registered later would never apply to that message.
      messages: a,
      updatedAt: l ? Date.now() : u.updatedAt
    };
    o !== void 0 && (h.tree = o), d !== void 0 && (h.title = d), this._replace(h), await this._adapter.save(h), this._notify();
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
  async _meta(t, e, n) {
    if (n) {
      const a = this._find(t);
      return a ? (this._replace(e(a)), await n.call(this._adapter, t), !0) : !1;
    }
    const i = await this._full(t);
    if (!i) return !1;
    const r = e(i);
    return this._replace(r), await this._adapter.save(r), !0;
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
    const n = e.trim();
    await this._meta(
      t,
      (r) => ({ ...r, title: n, autoTitle: !1 }),
      this._adapter.rename ? (r) => this._adapter.rename(r, n) : void 0
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
      } catch (n) {
        console.error("[AparteConversationManager] listener threw:", n);
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
    } catch (n) {
      return console.warn("[AparteConversationManager] the title provider threw; the default title stands:", n), e;
    }
  }
  _autoTitle(t) {
    return (t.content ?? "").trim();
  }
}
function ct(s) {
  return s.replace(/["\\]/g, "\\$&").replace(/[\n\r\f]/g, (t) => `\\${t.charCodeAt(0).toString(16)} `);
}
function zo(s) {
  return s.map((t) => ({
    id: J(),
    name: t.name,
    type: t.type || "application/octet-stream",
    url: URL.createObjectURL(t),
    size: t.size,
    blob: t
  }));
}
function xh(s) {
  if (s?.length && !(typeof URL > "u" || typeof URL.revokeObjectURL != "function"))
    for (const t of s)
      t.url?.startsWith("blob:") && URL.revokeObjectURL(t.url);
}
const xs = /* @__PURE__ */ new Map();
function Go(s, t) {
  t ? xs.set(s, t) : xs.delete(s);
}
function Ts(s, t) {
  Go(s, t);
  try {
    window.dispatchEvent(new CustomEvent("aparte-conversation-status", { detail: { id: s, status: t } }));
  } catch {
  }
}
function Zn(s) {
  return xs.get(s) ?? null;
}
const Th = 6;
class Ih {
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
    if (!t.some((n) => n.id === this._activeId && !n.archivedAt)) {
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
      const e = I(this._binding.host), n = e.getConversationManager();
      return n || this._warnManagerOnTheWrongConfig(e), n;
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
    this._warnedNoManager || t === lt || !lt.getConversationManager() || (this._warnedNoManager = !0, console.warn(
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
      this._turn && Ts(this._turn.id, null), this._turn = null;
      return;
    }
    const e = this._turn?.id ?? (t === "running" ? this._activeId ?? this._manager()?.activeId ?? null : null);
    e && (this._turn = { id: e, status: t }, Ts(e, t));
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
    this._onSendCapture = (n) => {
      const i = n, r = i.detail?.targetId;
      if (r && r !== this._binding.hostId) return;
      this._forgetDraft();
      const a = i.detail?.content ?? "", o = i.detail?.files, l = o?.length ? zo(o) : void 0, c = {
        id: J(),
        role: "user",
        content: a,
        timestamp: i.detail?.timestamp ?? Date.now(),
        ...l ? { attachments: l } : {},
        ...i.detail?.tokens?.length ? { tokens: i.detail.tokens } : {},
        ...i.detail?.meta ? { metadata: i.detail.meta } : {}
      };
      this._binding.appendMessage(c), i.detail.echoed = !0, this._ensureConversationAndPersist(c);
    }, t.addEventListener("aparte-send", this._onSendCapture, { capture: !0 }), this._onPathChanged = () => {
      this._isLoadingConversation || this._persistActive();
    }, t.addEventListener("aparte-path-changed", this._onPathChanged), this._onMessageStart = (n) => {
      this._isStreaming = !0, this._turnMessage = n.detail?.messageId ?? null, this._setTurn("running");
    };
    const e = (n) => {
      this._ofThisTurn(n) && (this._isStreaming = !1, this._setTurn(null), this._turnMessage = null);
    };
    return this._onMessageDone = (n) => {
      e(n), queueMicrotask(() => this._persistActive());
    }, this._onMessageError = (n) => {
      e(n), queueMicrotask(() => this._persistActive());
    }, this._onMessageAborted = (n) => {
      e(n), queueMicrotask(() => this._persistActive());
    }, this._onMessagePaused = (n) => {
      this._ofThisTurn(n) && this._setTurn("waiting"), queueMicrotask(() => this._persistActive());
    }, this._onMessageResumed = (n) => {
      this._ofThisTurn(n) && this._setTurn("running");
    }, t.addEventListener("aparte-message-start", this._onMessageStart), t.addEventListener("aparte-message-done", this._onMessageDone), t.addEventListener("aparte-message-error", this._onMessageError), t.addEventListener("aparte-message-aborted", this._onMessageAborted), t.addEventListener("aparte-message-paused", this._onMessagePaused), t.addEventListener("aparte-message-resumed", this._onMessageResumed), this._onSelectConversation = (n) => {
      const i = n, r = i.detail?.targetId;
      r && r !== this._binding.hostId || this.setConversationId(i.detail?.id ?? null);
    }, this._onCompactDone = (n) => {
      const i = n.detail;
      i?.targetId && i.targetId !== this._binding.hostId || queueMicrotask(() => this._persistOnceSummarised(i ?? {}, 0));
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
    return t.querySelector("aparte-composer") ?? document.querySelector(`aparte-composer[target="${ct(e)}"]`);
  }
  _stashDraft() {
    if (!this._options.keepDrafts) return;
    const t = this._composer;
    if (!t) return;
    const e = this._activeId ?? "", n = t.value;
    n ? this._drafts.set(e, n) : this._drafts.delete(e), this._saveDraft(e, n);
  }
  /** A message was sent: what it was drafted from must not come back, in this tab or the next. */
  _forgetDraft() {
    if (!this._options.keepDrafts) return;
    const t = this._activeId ?? "";
    this._drafts.delete(t), this._saveDraft(t, "");
  }
  /** A store that fails loses a draft, and nothing else. */
  _saveDraft(t, e) {
    const n = this._draftAdapter();
    !t || !n || Promise.resolve().then(() => n.saveDraft(t, e)).catch((i) => {
      console.warn("[ConversationController] the draft could not be saved:", t, i);
    });
  }
  async _restoreDraft(t) {
    const e = this._activeId ?? "", n = this._draftAdapter();
    let i = this._drafts.get(e);
    if (i === void 0 && e && n)
      try {
        i = await n.loadDraft(e) ?? "";
      } catch (r) {
        console.warn("[ConversationController] the draft could not be read:", e, r);
      }
    t === this._draftCalls && this._composer?.setValue(i ?? "");
  }
  _draftAdapter() {
    const t = this._manager()?.adapter ?? null;
    return t?.loadDraft && t.saveDraft ? t : null;
  }
  async _openConversation(t) {
    const e = t !== this._activeId, n = this._manager();
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
      this._activeId = null, n?.clearActive(), e && this._binding.clearMessages(), this._showWait(!1);
      return;
    }
    const i = n?.conversations.find((o) => o.id === t);
    if (!n || !i) {
      if (n && !n.initialized) {
        this._stopHydrationRetry?.();
        const o = n.subscribe(() => {
          o(), this._stopHydrationRetry = null, n.conversations.some((l) => l.id === t) ? this.setConversationId(t) : this._activeId === null && (console.warn("[ConversationController] id still unknown after hydration — clearing. id:", t), n.clearActive(), this._binding.clearMessages(), this._showWait(!1));
        });
        this._stopHydrationRetry = o, this._showWait(!1);
        return;
      }
      console.warn("[ConversationController] unknown id or no manager — clearing. manager:", !!n, "conv:", !!i), this._activeId = null, n?.clearActive(), this._binding.clearMessages(), this._showWait(!1);
      return;
    }
    this._activeId = t, n.select(t);
    let r = i;
    if (!n.isLoaded(t)) {
      this._showWait(!0), this._binding.clearMessages();
      let o = !1;
      try {
        o = await n.ensureFull(t);
      } catch (l) {
        console.warn("[ConversationController] the conversation could not be loaded:", t, l);
      }
      if (this._activeId !== t) return;
      if (!o) {
        n.conversations.some((l) => l.id === t) && console.warn("[ConversationController] no messages came back for", t, "— leaving it."), this._activeId = null, n.clearActive(), this._binding.clearMessages(), this._showWait(!1);
        return;
      }
      r = n.conversations.find((l) => l.id === t) ?? i;
    }
    this._isLoadingConversation = !0;
    try {
      this._binding.setMessages([...r.messages ?? []]), r.tree && this._binding.importTree && this._binding.importTree(r.tree);
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
    const n = this._binding.getMessages();
    let i = !0;
    if (t.restored)
      i = !n.some((r) => r.contextSummary !== void 0);
    else if (t.messageId || t.summary) {
      const { messageId: r, summary: a } = t, o = !!r && n.some(
        (c) => c.id === r && typeof c.contextSummary?.createdAt == "number"
      ), l = !!a && n.some(
        (c) => c.compaction === !0 && typeof c.content == "string" && c.content.endsWith(a)
      );
      i = o || l;
    }
    if (i || !this._binding.afterRender || e >= Th) {
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
      (i) => i.status === "streaming" || i.status === "pending" ? { ...i, status: "completed" } : i
    );
    let n = this._binding.exportTree?.();
    n && (n = {
      headId: n.headId,
      messages: n.messages.map(({ message: i, parentId: r }) => ({
        message: i.status === "streaming" || i.status === "pending" ? { ...i, status: "completed" } : i,
        parentId: r
      }))
    }), t.updateMessages(this._activeId, e, n);
  }
  async _ensureConversationAndPersist(t) {
    const e = this._manager();
    if (!e)
      return;
    const n = this._activeId;
    let i = n ?? e.activeId;
    if (i && this._activeId === null && this._ensureInFlight && (await this._ensureInFlight.catch(() => {
    }), i = this._activeId ?? i), i) {
      if (this._activeId !== null && this._activeId !== i) {
        await e.addMessage(i, t).catch(() => {
        });
        return;
      }
    } else {
      if (!this._ensureInFlight) {
        const r = (t.content ?? "").toString().trim();
        this._ensureInFlight = e.createNew(r).then((a) => a.id);
      }
      if (i = await this._ensureInFlight, this._ensureInFlight = null, this._activeId !== n && this._activeId !== i) {
        e.delete(i).catch(() => {
        });
        return;
      }
      this._activeId = i, this._options.onConversationCreated?.(i), this._isStreaming && !this._turn && this._setTurn("running");
    }
    await e.addMessage(i, t), !this._isStreaming && this._activeId === i && this._persistActive();
  }
}
function Rh(s) {
  if (s.hasAttribute("data-glide")) return () => {
  };
  const t = s.ownerDocument, e = () => {
    t.removeEventListener("pointerdown", n, !0), t.removeEventListener("keydown", n, !0), s.removeEventListener("aparte-send", n);
  }, n = () => {
    s.setAttribute("data-glide", ""), e();
  };
  return t.addEventListener("pointerdown", n, !0), t.addEventListener("keydown", n, !0), s.addEventListener("aparte-send", n), e;
}
function Mh(s) {
  let t = s.parentElement;
  for (; t; ) {
    if ((t.tagName.toLowerCase() === "aparte-chat" || t.hasAttribute("data-aparte-chat")) && t.id) return t.id;
    t = t.parentElement;
  }
}
class Lh {
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
    const t = (a) => this._options.active && !this._options.active() ? !1 : !a || a === this._options.ownId(), e = (a) => !!a && this._options.owns(a), n = (a) => {
      const o = a.detail;
      !t(o?.targetId) || !e(o?.messageId) || (this.clear(), this._set(o.messageId, "pending", ""));
    }, i = (a) => {
      const o = a.detail;
      !t(o?.targetId) || o?.skipped || o?.messageId && o.messageId === this._messageId && this.clear();
    }, r = (a) => {
      const o = a.detail;
      if (!(!t(o?.targetId) || !e(o?.messageId))) {
        if (o.aborted) {
          o.messageId === this._messageId && this.clear();
          return;
        }
        o.messageId !== this._messageId && this.clear(), this._set(o.messageId, "failed", o.error ?? "");
      }
    };
    return window.addEventListener("aparte-compact-start", n), window.addEventListener("aparte-compact-done", i), window.addEventListener("aparte-compact-error", r), () => {
      window.removeEventListener("aparte-compact-start", n), window.removeEventListener("aparte-compact-done", i), window.removeEventListener("aparte-compact-error", r);
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
  _set(t, e, n) {
    this._messageId = t, this._state = e, this._reason = n, this._write(t, e, n);
  }
  _write(t, e, n) {
    const i = this._options.bubbleOf(t);
    i && (this._marked && this._marked !== i && (this._marked.removeAttribute("data-checkpoint"), this._marked.removeAttribute("data-checkpoint-reason")), this._marked = i, n ? i.setAttribute("data-checkpoint-reason", n) : i.removeAttribute("data-checkpoint-reason"), i.getAttribute("data-checkpoint") !== e && i.setAttribute("data-checkpoint", e));
  }
}
function Is(s) {
  for (let t = s.length - 1; t >= 0; t--) {
    const e = s[t].contextSummary?.summary;
    if (e !== void 0) return { summary: e, messages: s.slice(t) };
  }
  return { messages: s };
}
const Oh = "The earlier part of this conversation was compacted. This is a summary of what came before; continue from it.", ni = (s) => `${Oh}

${s}`;
function Jt(s) {
  const t = (n) => typeof n == "string" ? [{ type: "text", text: n }] : n, e = [];
  for (const n of s) {
    const i = e[e.length - 1];
    n.role !== "user" || i?.role !== "user" ? e.push(n) : typeof i.content == "string" && typeof n.content == "string" ? e[e.length - 1] = { ...i, content: `${i.content}

${n.content}` } : e[e.length - 1] = {
      ...i,
      content: [...t(i.content), { type: "text", text: `

` }, ...t(n.content)]
    };
  }
  return e;
}
const Mr = "The tool call was stopped before it ran.", $h = "The tool returned no output.";
function Nh(s) {
  const t = s.result?.trim();
  return s.status === "resolved" ? t || $h : s.status === "failed" ? t || "The tool failed." : s.status === "rejected" && t || Mr;
}
const Ee = (s) => s.type === "tool_call" && !!s.deferred && (s.status === "awaiting-approval" || s.status === "pending");
function jo(s, t, e = {}) {
  const n = s.segments ?? [];
  if (s.role !== "assistant" || !n.some((c) => c.type === "tool_call")) {
    const c = t(n) || (typeof s.content == "string" ? s.content : "");
    return c ? [{ role: s.role, content: c }] : [];
  }
  const i = [];
  let r = [], a = [];
  const o = () => {
    const c = t(r);
    if (a.length === 0)
      c && i.push({ role: "assistant", content: c });
    else {
      i.push({
        role: "assistant",
        content: c,
        toolCalls: a.map((d) => ({ id: d.toolCall.id, name: d.toolCall.name, input: d.toolCall.input }))
      });
      for (const d of a)
        e.openDeferred && Ee(d) || i.push({ role: "tool", content: Nh(d), toolCallId: d.toolCall.id, toolName: d.toolCall.name });
    }
    r = [], a = [];
  };
  let l = !1;
  for (const c of n)
    c.type === "tool_call" ? (a.push(c), e.openDeferred && Ee(c) && (l = !0)) : (a.length > 0 && !l && o(), r.push(c));
  return o(), i;
}
const Ko = (s) => s.status === "streaming" || s.status === "pending";
function Mn(s) {
  if (!s?.length) return "";
  const t = "```", e = [];
  for (const n of s) {
    const i = n.content;
    if (n.type === "text")
      i && e.push(i);
    else if (n.type === "code") {
      const r = n.language ?? "";
      e.push(`${t}${r}
${i ?? ""}
${t}`);
    } else {
      if (n.type === "thinking" || n.type === "tool_call" || n.type === "error")
        continue;
      if (typeof i == "string" && i) {
        const r = n.wire, a = r && typeof r.before == "string" ? r.before : "", o = r && typeof r.after == "string" ? r.after : "";
        e.push(`${a}${i}${o}`);
      } else {
        const r = n.fallback;
        r && e.push(r);
      }
    }
  }
  return e.join(`
`).trim();
}
function Ph(s) {
  const t = Mn(s.segments);
  return t || (typeof s.content == "string" && s.content ? s.content : "");
}
function Dh(s) {
  const t = Ph(s);
  return s.compaction ? ni(t) : t;
}
function cn(s) {
  return s.filter((t) => t.role !== "user" && t.role !== "assistant" ? !1 : t.status !== "error" && !Ko(t)).flatMap((t) => {
    if (t.role === "assistant" && t.segments?.some((n) => n.type === "tool_call"))
      return jo(t, Mn);
    const e = Dh(t);
    return e ? [{ role: t.role, content: e }] : [];
  });
}
function ee(s) {
  return s ? Math.ceil(s.length / 3.8) : 0;
}
const si = (s) => {
  if (!s) return 0;
  try {
    return ee(JSON.stringify(s));
  } catch {
    return 0;
  }
};
function Vo(s) {
  let t = 0;
  for (const e of s)
    t += ee(qa(e.content)), e.toolCalls?.length && (t += si(e.toolCalls));
  return t;
}
function Hh(s) {
  return s.some((t) => typeof t.content != "string" && t.content.some((e) => e.type !== "text"));
}
function Bh(s) {
  const t = (s.tools ?? []).map((e) => ({ name: e.name, description: e.description, inputSchema: e.inputSchema }));
  return Vo(s.messages) + (t.length ? si(t) : 0);
}
function qh(s) {
  return Vo(cn(s));
}
const Rs = (s) => s.totalTokens ?? s.inputTokens + s.outputTokens;
function Xo(s) {
  const t = s.getCurrentModel()?.capabilities;
  return (t ? !t.includes("function_calling") : !1) ? [] : s.getTools();
}
function Fh(s, t) {
  if (typeof t == "number" && Number.isFinite(t) && t > 0) return t;
  const e = s.getCurrentModel()?.contextWindow;
  return e && e > 0 ? e : void 0;
}
const Yo = (s, t) => s.segments?.some((e) => e.type === t) === !0;
function Uh(s) {
  const t = s.usage?.inputTokens, e = s.contextEstimate;
  return Yo(s, "tool_call") ? 1 : t && e && t > 0 && e > 0 ? Math.min(3, Math.max(0.5, t / e)) : 1;
}
function Wh(s, t) {
  const e = s.usage;
  if (!Yo(s, "thinking") || !(e.inputTokens > 0)) return Rs(e);
  const n = s.segments ?? [], i = n.map((a) => a.type).lastIndexOf("tool_call"), r = Math.round(t * ee(Mn(n.slice(i + 1))));
  return e.inputTokens + (e.outputTokens > 0 ? Math.min(r, e.outputTokens) : r);
}
function zh(s) {
  const { messages: t, config: e } = s, n = Is(t), i = Xo(e), r = ee(e.resolveSystemPrompt()) + ee(e.resolveToolSystemPrompts(i)), a = i.map((m) => ({ name: m.name, description: m.description, inputSchema: m.inputSchema })), o = a.length ? si(a) : 0, l = n.summary === void 0 ? 0 : ee(ni(n.summary)), c = { system: r, tools: o, summary: l, messages: qh(n.messages) }, d = r + o + l + c.messages;
  let u = -1;
  for (let m = t.length - 1; m >= 0; m--)
    if (t[m].role === "assistant" && t[m].usage) {
      u = m;
      break;
    }
  const h = u >= 0 ? t[u] : void 0, p = Fh(e, s.windowOverride), f = (m, A) => ({
    ...p !== void 0 ? { window: p } : {},
    used: m,
    estimated: A,
    parts: c,
    other: Math.max(0, m - d)
  }), _ = h !== void 0 && !s.viewChanged && u === t.length - 1 && !t.some((m) => m.contextSummary !== void 0 && m.contextSummary.createdAt > h.timestamp), g = h ? Uh(h) : 1;
  return h && _ ? f(Wh(h, g), !1) : f(Math.round(g * d), !0);
}
function Gt(s) {
  return s.composedPath?.()[0] ?? s.target;
}
function ne(s) {
  return s.getRootNode();
}
function wt(s) {
  return s.getRootNode().activeElement ?? document.activeElement;
}
let Gh = 0, dn = null;
function Me(s) {
  dn?.push(s);
}
function F(s, t, e) {
  const n = document.createElement(s);
  return t && (n.className = t), e != null && (n.textContent = e), n;
}
function ii(s, t, e) {
  const n = F("span", "aparte-elic-option-body"), i = F("span", "aparte-elic-option-title", s);
  if (i.dir = "auto", e) {
    const r = F(
      "span",
      "aparte-tag aparte-tag--sm aparte-elic-option-badge",
      R().t("elicitationRecommended") || "Recommended"
    );
    i.append(" ", r);
  }
  return n.appendChild(i), t && n.appendChild(Object.assign(F("span", "aparte-elic-option-desc", t), { dir: "auto" })), n;
}
function Ms(s, t, e) {
  const n = F("button", "aparte-btn aparte-btn--block aparte-btn--surface aparte-elic-option aparte-elic-option--command" + (e ? " aparte-elic-option--recommended" : ""));
  return n.type = "button", n.appendChild(ii(s, t, e)), n;
}
function ri(s, t, e) {
  let n;
  if (t.title && t.title.trim() !== e?.trim()) {
    const i = F("p", "aparte-elic-title", t.title);
    i.dir = "auto", n = `elic-title-${J()}`, i.id = n, s.appendChild(i);
  }
  return t.description && s.appendChild(Object.assign(F("p", "aparte-elic-desc", t.description), { dir: "auto" })), n;
}
function Qo(s, t) {
  s.setAttribute("role", t.multiple || t.commands ? "group" : "radiogroup"), t.titleId ? s.setAttribute("aria-labelledby", t.titleId) : t.fallbackLabel && s.setAttribute("aria-label", t.fallbackLabel);
}
function jh(s, t, e, n) {
  const i = F("div", "aparte-elic-field aparte-elic-enum"), r = ri(i, s, e), a = F("div", "aparte-elic-options"), o = `elic-${J()}`, l = s.multiple ? "checkbox" : "radio", c = l === "checkbox" ? "aparte-checkbox" : "aparte-radio", d = s.allowOther ?? R().getElicitationOptions().allowOther, u = new Set(Array.isArray(s.default) ? s.default : s.default != null ? [s.default] : []), h = n != null && !s.multiple && u.size === 0;
  Qo(a, { multiple: s.multiple, commands: h, titleId: r, fallbackLabel: e });
  const p = (b, v, w, T) => {
    if (h) {
      const L = Ms(v, w, T);
      return L.addEventListener("click", () => n?.(b)), L;
    }
    const S = F("label", "aparte-field-choice aparte-elic-option" + (T ? " aparte-elic-option--recommended" : "")), x = F("input", c + " aparte-elic-control");
    return x.type = l, x.name = o, x.value = b, u.has(b) && (x.checked = !0), S.append(x, ii(v, w, T)), S;
  };
  for (const b of s.options)
    a.appendChild(p(b.value, b.label ?? b.value, b.description, b.recommended));
  let f = null, _ = !1;
  if (d) {
    const b = R();
    f = F("input", "aparte-field aparte-elic-other-input"), f.type = "text", f.placeholder = b.t("elicitationOtherPlaceholder"), f.style.display = "none", f.setAttribute("aria-label", b.t("elicitationOtherLabel"));
    const v = f;
    if (h) {
      const w = Ms(b.t("elicitationOther"));
      w.classList.add("aparte-elic-option--other"), w.setAttribute("aria-expanded", "false"), w.addEventListener("click", () => {
        _ = !0, w.setAttribute("aria-expanded", "true"), v.style.display = "", v.focus(), t();
      });
      const T = w.querySelector(".aparte-elic-option-title");
      Me(() => {
        const S = R();
        T.textContent = S.t("elicitationOther"), v.placeholder = S.t("elicitationOtherPlaceholder"), v.setAttribute("aria-label", S.t("elicitationOtherLabel"));
      }), a.append(w, v);
    } else {
      const w = F("label", "aparte-field-choice aparte-elic-option aparte-elic-option--other"), T = F("input", c + " aparte-elic-control");
      T.type = l, T.name = o, T.value = "__other__";
      const S = F("span", "aparte-elic-option-body"), x = F("span", "aparte-elic-option-title", b.t("elicitationOther"));
      S.appendChild(x), Me(() => {
        const L = R();
        x.textContent = L.t("elicitationOther"), v.placeholder = L.t("elicitationOtherPlaceholder"), v.setAttribute("aria-label", L.t("elicitationOtherLabel"));
      }), S.appendChild(f), w.append(T, S), a.appendChild(w);
    }
  }
  i.appendChild(a);
  const g = () => Array.from(a.querySelectorAll(".aparte-elic-control")), m = () => a.querySelector('input[value="__other__"]');
  let A = !1;
  a.addEventListener("keydown", (b) => {
    A = b.key.startsWith("Arrow");
  }), a.addEventListener("click", () => {
    A = !1;
  }), a.addEventListener("change", () => {
    const b = m();
    b && f && (f.style.display = b.checked ? "" : "none", b.checked && !A && f.focus()), A = !1, t();
  }), f?.addEventListener("input", t);
  const k = () => f?.value.trim() ?? "";
  if (h)
    return {
      el: i,
      getValue: () => k(),
      isComplete: () => _ && k() !== "",
      focus: () => a.querySelector(".aparte-elic-option--command")?.focus(),
      offersSubmit: () => _
    };
  const y = () => {
    const b = m()?.checked && k() ? k() : "";
    if (s.multiple) {
      const w = g().filter((T) => T.checked && T.value !== "__other__").map((T) => T.value);
      return b && w.push(b), w;
    }
    const v = g().find((w) => w.checked);
    return v ? v.value === "__other__" ? b : v.value : "";
  };
  return {
    el: i,
    getValue: y,
    isComplete: () => {
      const b = y();
      return s.multiple ? b.length > 0 : b !== "";
    },
    focus: () => g()[0]?.focus()
  };
}
function Kh(s, t, e, n) {
  const i = F("div", "aparte-elic-field aparte-elic-boolean"), r = ri(i, s, e), a = F("div", "aparte-elic-options"), o = `elic-${J()}`, l = n != null && s.default == null;
  if (Qo(a, { commands: l, titleId: r, fallbackLabel: e }), l) {
    const h = R(), p = (f, _, g) => {
      const m = Ms(_);
      if (m.addEventListener("click", () => n?.(f)), g) {
        const A = m.querySelector(".aparte-elic-option-title");
        Me(() => {
          A.textContent = R().t(g);
        });
      }
      a.appendChild(m);
    };
    return p(!0, s.trueLabel ?? h.t("elicitationYes"), s.trueLabel ? void 0 : "elicitationYes"), p(!1, s.falseLabel ?? h.t("elicitationNo"), s.falseLabel ? void 0 : "elicitationNo"), i.appendChild(a), {
      el: i,
      // Never read: the click settles, so nothing downstream asks this shape for
      // a value. `false` rather than a throw keeps the field total.
      getValue: () => !1,
      isComplete: () => !1,
      focus: () => a.querySelector(".aparte-elic-option--command")?.focus(),
      offersSubmit: () => !1
    };
  }
  const c = (h, p, f) => {
    const _ = F("label", "aparte-field-choice aparte-elic-option"), g = F("input", "aparte-radio aparte-elic-control");
    g.type = "radio", g.name = o, g.value = h, s.default != null && String(s.default) === h && (g.checked = !0);
    const m = F("span", "aparte-elic-option-body"), A = F("span", "aparte-elic-option-title", p);
    A.dir = "auto", f && Me(() => {
      A.textContent = R().t(f);
    }), m.appendChild(A), _.append(g, m), a.appendChild(_);
  }, d = R();
  c("true", s.trueLabel ?? d.t("elicitationYes"), s.trueLabel ? void 0 : "elicitationYes"), c("false", s.falseLabel ?? d.t("elicitationNo"), s.falseLabel ? void 0 : "elicitationNo"), i.appendChild(a), a.addEventListener("change", t);
  const u = () => a.querySelector("input:checked");
  return {
    el: i,
    getValue: () => u()?.value === "true",
    isComplete: () => u() != null,
    focus: () => a.querySelector("input")?.focus()
  };
}
function Vh(s, t, e) {
  const n = F("div", "aparte-elic-field aparte-elic-string");
  ri(n, s, e);
  const i = s.multiline ? F("textarea", "aparte-field aparte-field--textarea aparte-elic-text") : F("input", "aparte-field aparte-elic-text");
  s.multiline || (i.type = "text"), s.placeholder && i.setAttribute("placeholder", s.placeholder), s.default && (i.value = s.default), s.maxLength != null && i.setAttribute("maxlength", String(s.maxLength));
  const r = s.title || s.description || e || void 0;
  if (i.setAttribute("aria-label", r ?? R().t("elicitationAnswerLabel")), r == null) {
    const l = i;
    Me(() => {
      l.setAttribute("aria-label", R().t("elicitationAnswerLabel"));
    });
  }
  n.appendChild(i), i.addEventListener("input", t);
  const a = s.required ?? !0, o = () => i.value;
  return {
    el: n,
    getValue: () => o(),
    isComplete: () => {
      const l = o().trim();
      return !a && l === "" ? !0 : l.length >= (s.minLength ?? 1);
    },
    focus: () => i.focus()
  };
}
function Lr(s, t, e, n, i) {
  const r = R().getElicitationFieldRenderer()?.(s, { key: n, notifyChange: t });
  if (r)
    return {
      el: r.el,
      getValue: () => r.getValue(),
      isComplete: () => r.isComplete(),
      focus: () => r.focus?.()
    };
  switch (s.type) {
    case "enum":
      return jh(s, t, e, i);
    case "boolean":
      return Kh(s, t, e, i);
    // No `settle`: text is written, not chosen, so it always needs a commit.
    case "string":
      return Vh(s, t, e);
  }
}
function Xh(s, t, e) {
  const n = [], i = dn;
  dn = n;
  try {
    return { ...Yh(s, t, e), relabel: () => {
      for (const a of n) a();
    } };
  } finally {
    dn = i;
  }
}
function Yh(s, t, e) {
  const n = F("div", "aparte-elic-panel"), i = typeof s == "function" ? s() : s;
  i && n.appendChild(Object.assign(F("p", "aparte-elic-message", i), { dir: "auto" }));
  let r = null, a = !1;
  const o = (p) => {
    a || (a = !0, r?.(p));
  }, l = (p) => {
    r = p;
  }, c = F("div", "aparte-elic-body");
  n.appendChild(c);
  const d = F("div", "aparte-elic-dismiss");
  if (n.appendChild(d), t.type === "object") {
    let p = function(x) {
      v = x, k.forEach((L, E) => {
        L.field.el.hidden = E !== x;
      }), m();
    };
    const f = Object.entries(t.properties), _ = new Set(t.required ?? f.map(([x]) => x)), g = R();
    let m = () => {
    };
    const A = () => {
      m(), e();
    }, k = f.map(([x, L]) => {
      const E = Lr(L, A, void 0, x);
      return !L.title && !E.el.querySelector(".aparte-elic-title") && E.el.insertBefore(Object.assign(F("p", "aparte-elic-title", x), { dir: "auto" }), E.el.firstChild), c.appendChild(E.el), { key: x, field: E, required: _.has(x), header: L.header };
    }), y = () => k.every((x) => !x.required || x.field.isComplete()), b = {
      el: n,
      dismiss: d,
      getContent: () => Object.fromEntries(k.map((x) => [x.key, x.field.getValue()])),
      isComplete: y,
      focus: () => k[0]?.field.focus(),
      // A form of one behaves like a single field; only a real form steps.
      mode: () => "submit",
      canProceed: y,
      proceed: () => {
      },
      // A form never settles from inside: its questions are collected and
      // submitted together, and answering the last one on the click would be
      // WCAG's F36 word for word. Registered so the shape is total; never fired.
      onSettle: l
    };
    if (k.length < 2 || g.getElicitationOptions().layout !== "stepped") return b;
    n.classList.add("aparte-elic-panel--stepped");
    let v = 0;
    const w = `aparte-elic-${++Gh}`, T = F("div", "aparte-tabs aparte-tabs--underline aparte-elic-steps");
    T.setAttribute("role", "tablist");
    const S = k.map((x, L) => {
      const E = F("button", "aparte-tabs__tab aparte-elic-step");
      return E.type = "button", E.setAttribute("role", "tab"), E.textContent = x.header?.trim() || String(L + 1), E.dir = "auto", E.addEventListener("click", () => {
        p(L), x.field.focus();
      }), E.id = `${w}-tab-${L}`, x.field.el.id = `${w}-panel-${L}`, x.field.el.setAttribute("role", "tabpanel"), x.field.el.setAttribute("aria-labelledby", E.id), E.setAttribute("aria-controls", x.field.el.id), E.addEventListener("keydown", (N) => {
        const G = getComputedStyle(T).direction === "rtl" ? "ArrowLeft" : "ArrowRight", j = G === "ArrowRight" ? "ArrowLeft" : "ArrowRight", X = N.key === G ? 1 : N.key === j ? -1 : 0;
        let tt = -1;
        X ? tt = (L + X + k.length) % k.length : N.key === "Home" ? tt = 0 : N.key === "End" && (tt = k.length - 1), !(tt < 0) && (N.preventDefault(), p(tt), S[tt]?.focus());
      }), T.appendChild(E), E;
    });
    return n.insertBefore(T, c), m = () => {
      S.forEach((x, L) => {
        x.setAttribute("aria-selected", String(L === v)), x.tabIndex = L === v ? 0 : -1;
        const E = k[L].field.isComplete();
        x.toggleAttribute("data-answered", E);
        const N = x.querySelector(".aparte-elic-step__mark");
        if (E && !N) {
          const G = F("span", "aparte-elic-step__mark");
          G.setAttribute("aria-hidden", "true"), G.innerHTML = g.getIcon("check"), x.prepend(G);
        } else !E && N && N.remove();
      });
    }, p(0), {
      ...b,
      focus: () => k[v]?.field.focus()
    };
  }
  const u = R().getElicitationOptions().answerOnClick, h = Lr(t, e, i, void 0, u ? o : void 0);
  return c.appendChild(h.el), {
    el: n,
    dismiss: d,
    getContent: () => h.getValue(),
    isComplete: () => h.isComplete(),
    focus: () => h.focus(),
    mode: () => h.offersSubmit?.() ?? !0 ? "submit" : "none",
    canProceed: () => h.isComplete(),
    proceed: () => {
    },
    onSettle: l
  };
}
let Qh = 0;
function Ct(s, t, e) {
  const n = document.createElement(s);
  return t && (n.className = t), e != null && (n.textContent = e), n;
}
let Zh = 0;
function Jh(s, t, e, n, i = !0) {
  const r = R(), a = Ct("div", "aparte-elic-panel aparte-approval-panel"), o = Ct("div", "aparte-elic-body");
  a.appendChild(o);
  const l = () => typeof s == "function" ? s() : s, c = l() ? Object.assign(Ct("p", "aparte-elic-message", l()), { dir: "auto" }) : null;
  c && o.appendChild(c);
  let d = null;
  if (n) {
    d = Ct("div", "aparte-approval-args-label", r.t("approvalArgsLabel")), d.id = "aparte-approval-args-" + ++Qh;
    const v = Ct("pre", "aparte-approval-args");
    v.textContent = n, v.setAttribute("role", "group"), v.setAttribute("aria-labelledby", d.id), v.tabIndex = 0, o.append(d, v);
  }
  const u = Ct("div", "aparte-elic-dismiss");
  a.appendChild(u);
  let h = null, p = !1;
  const f = (v) => {
    p || (p = !0, h?.(v));
  }, _ = Ct("div", "aparte-approval-options");
  _.setAttribute("role", "group"), _.setAttribute("aria-label", r.t("approvalOptionsLabel")), c && (c.id ||= `aparte-approval-ask-${++Zh}`, _.setAttribute("aria-describedby", c.id));
  const g = [], m = (v) => typeof v.label == "function" ? v.label() : v.label, A = (v) => typeof v.description == "function" ? v.description() : v.description, k = (v) => ii(m(v), A(v));
  for (const v of t) {
    const w = v.tone ?? "affirm", T = Ct("button", `aparte-btn aparte-btn--block aparte-btn--surface aparte-approval-option aparte-approval-option--${w}`);
    T.type = "button", T.appendChild(k(v)), T.addEventListener("click", () => f({ option: v.value })), _.appendChild(T), g.push({ button: T, option: v });
  }
  o.appendChild(_);
  const y = i ? Ct("textarea", "aparte-approval-instruction") : null;
  y && (y.rows = 1, y.placeholder = r.t("approvalInstructionPlaceholder"), y.setAttribute("aria-label", r.t("approvalInstructionPlaceholder")), y.addEventListener("input", e), o.appendChild(y));
  const b = () => y?.value.trim() ?? "";
  return {
    el: a,
    dismiss: u,
    onSettle: (v) => {
      h = v;
    },
    getContent: () => ({ instruction: b() }),
    isComplete: () => b().length > 0,
    focus: () => {
      a.querySelector(".aparte-approval-option")?.focus();
    },
    relabel: () => {
      const v = R(), w = v.t("approvalInstructionPlaceholder");
      y && (y.placeholder = w, y.setAttribute("aria-label", w)), _.setAttribute("aria-label", v.t("approvalOptionsLabel")), c && (c.textContent = l()), d && (d.textContent = v.t("approvalArgsLabel"));
      for (const { button: T, option: S } of g) T.replaceChildren(k(S));
    }
  };
}
function tp(s) {
  return I(s.target ?? null).requestUserInput(s);
}
const ep = "Not run: an earlier call of the same step was refused.", Or = (s) => JSON.stringify([s.id, s.name, s.input]), $r = /* @__PURE__ */ new Set(), Dt = /* @__PURE__ */ new Map(), Nr = "aparte-chat, aparte-chat-viewport, [data-aparte-chat]";
function np(s) {
  return {
    id: s,
    getMetadata: () => ({ id: s, name: s }),
    getModels: () => [],
    chat: async () => {
      throw new Z(
        "This turn has no provider in the page. Register one, or use a runner that calls the model elsewhere (createAgentStreamRunner, an AG-UI runner).",
        U.CONFIG_NO_PROVIDER
      );
    }
  };
}
function sp(s, t) {
  const e = [];
  let n = 0;
  for (const i of [...t].sort((r, a) => r.start - a.start)) {
    const r = s.indexOf(i.text, n);
    r < 0 || (n = r + i.text.length, e.push({ ...i, start: r, end: n }));
  }
  return e;
}
class ip {
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
    const t = this._config, e = t.getCurrentModel(), n = t.getModelConfig().defaultProvider;
    if (!e || e.contextWindow || !n) return;
    const i = `${n}\0${e.id}`;
    this._windowReadFor.has(i) || (this._windowReadFor.add(i), await t.refreshProviderModels(n));
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
    const e = t.detail, n = this.options.scopeToTargetId;
    if (n) return e?.targetId === n;
    if (this._config === lt) {
      if (Dt.size === 0) return !0;
      const a = this._resolveTarget(e?.targetId, t), o = a ? I(a) : lt;
      return o === lt || !Dt.has(o);
    }
    const i = this._resolveTarget(e?.targetId, t);
    if (!i) return !0;
    const r = I(i);
    return r === this._config || r === lt;
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
    }, this._config = t.config ?? lt, this._registerKeyResolver(), this.options.autoRegister ? Hu(this._config) : Pu(this._config), this._setupListeners();
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
    this._registerKeyResolver(), this._config !== lt && !this._claims && (this._claims = !0, Dt.set(this._config, (Dt.get(this._config) ?? 0) + 1)), this._boundHandler || this._setupListeners(), this._boundHandler && window.addEventListener("aparte-send", this._boundHandler), this._boundAbortHandler || (this._boundAbortHandler = (t) => {
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
      const t = (Dt.get(this._config) ?? 1) - 1;
      t > 0 ? Dt.set(this._config, t) : Dt.delete(this._config);
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
  async _askForApproval(t, e, n) {
    const i = await tp({
      kind: "approval",
      /*
       * A function, like the option labels below, and for the same reason: the
       * FRAME is locale text and follows a language switch while the question is
       * open. The tool's NAME is substituted into it and never translated — it is
       * wire format, the identifier the model called.
       */
      message: () => {
        const o = this._config.getLocale(), l = I(n), c = {
          id: `tool-${t.id}`,
          type: "tool_call",
          status: "awaiting-approval",
          toolCall: { id: t.id, name: t.name, input: t.input }
        }, d = bo(c, l).text, u = vo(c, l);
        return (o.approvalAsk ?? "Allow {tool}?").replace("{tool}", () => u ? `${d} ${u}` : d);
      },
      // A plain string, not a function: the arguments are the model's — its JSON, or
      // the tool's own formatter's reading of it — and do not change with the
      // language. Same text the transcript row shows, from the same function and the
      // same config — the chat's, which the row renders with — so the two surfaces
      // cannot disagree about what is being run.
      details: mo(t.input, I(n).getToolInputFormatter(t.name)),
      // Functions, not strings, same as the question: these follow a language
      // switch while the request is open, which a resolved string cannot.
      options: [
        { value: "allow", label: () => this._config.getLocale().approveTool ?? "Approve", tone: "affirm" },
        { value: "deny", label: () => this._config.getLocale().rejectTool ?? "Reject", tone: "deny" }
      ],
      signal: e,
      target: n
    });
    if (i.action !== "accept") return { approved: !1, by: "person" };
    const r = i.content, a = r?.instruction?.trim();
    return a ? { approved: !1, instruction: a, by: "person" } : r?.option === "allow" ? { approved: !0 } : { approved: !1, by: "person" };
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
    return !!t && t !== Ei;
  }
  /**
   * The provider a turn runs on: the registered one, else, when the model runs
   * elsewhere, a stand-in carrying the id the page named (none is fine: the server
   * picks). Undefined when the page must have one and has not.
   */
  _providerFor(t) {
    const e = t ? this._config.getAIProvider(t) : void 0;
    return e || (this._modelRunsElsewhere ? np(t ?? "") : void 0);
  }
  async _resolveAuth(t) {
    if (this.options.keyResolver) {
      const n = await this.options.keyResolver(t);
      if (n) return n;
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
  async _streamTurn(t, e, n, i, r, a, o) {
    const l = this._targetIdOf(t), c = this._toolsForCurrentModel(), d = async (v) => {
      let w = {
        messages: v,
        modelId: r,
        stream: !0,
        tools: c.length ? c : void 0,
        ...o?.temperature !== void 0 ? { temperature: o.temperature } : {},
        ...o?.meta ? { _meta: o.meta } : {}
      };
      if (this.options.requestInterceptor && (w = await this.options.requestInterceptor(w)), w.toolChoice === "none") {
        const T = this._config.resolveToolSystemPrompts(c);
        w = {
          ...w,
          tools: void 0,
          messages: T ? w.messages.filter((S) => !(S.role === "system" && S.content === T)) : w.messages
        };
      }
      return w;
    };
    let u = await d(i);
    if (this._isAborted) {
      ut(t, "aparte-message-aborted", { messageId: e }, l), this._updateMessage(t, e, { status: "completed" });
      return;
    }
    ut(t, "aparte-message-start", { messageId: e, role: "assistant" }, l), o?.resume && ut(t, "aparte-message-paused", { messageId: e }, l), !o?.resume && n.id && this._updateMessage(t, e, {
      model: {
        providerId: n.id,
        modelId: u.modelId,
        ...u.temperature !== void 0 ? { temperature: u.temperature } : {}
      }
    });
    const h = new AbortController();
    this._streamController !== h && this._streamController?.abort(), this._streamController = h, this._turnsInFlight.add(e);
    const p = o?.rebuild ? I(t).getCompactor() ?? this._config.getCompactor() : null, f = () => {
      const v = t.getMessages?.() ?? [], w = v.findIndex((S) => S.id === e), T = w > 0 ? v[w - 1] : void 0;
      return T?.role === "user" ? [T.id, e] : [e];
    }, _ = () => o?.resume ? this._resumeMessages(t, e, u.messages) : u.messages, g = () => Bh({ messages: _(), tools: u.tools }), m = () => Hh(_()) ? void 0 : g(), A = () => {
      this._closeOpenCalls(t, e), ut(t, "aparte-message-aborted", { messageId: e }, l), this._updateMessage(t, e, { status: "completed" });
    }, k = () => this._isAborted || h.signal.aborted, y = async () => {
      let v = o?.resume ? { usage: void 0, suspended: o.resume } : await this._streamLoop(t, e, n, u, a, h, void 0, o?.files);
      const w = this.options.maxTurns ?? 10;
      let T = 0, S = /* @__PURE__ */ new Set();
      const x = jn({ target: t, config: this._config, messageId: e, ...l ? { targetId: l } : {} });
      for (; v.suspended; ) {
        const N = this._isAborted || h.signal.aborted;
        if (!N && ++T > w) {
          this._closeOpenCalls(t, e), jn({ target: t, config: this._config, messageId: e, ...l ? { targetId: l } : {} })(
            { type: "turn-limit-exceeded", scope: "global", limit: w }
          );
          break;
        }
        const G = /* @__PURE__ */ new Set(), j = N ? void 0 : await this._answerDeferred(t, v.suspended.pending, h.signal, x, S, G);
        if (S = G, !j) {
          this._closeOpenCalls(t, e), (this._isAborted || h.signal.aborted) && ut(t, "aparte-message-aborted", { messageId: e }, l);
          break;
        }
        const X = {
          outcomes: j,
          ...v.suspended.ticket ? { token: v.suspended.ticket } : {}
        }, tt = this._resumeMessages(t, e, u.messages);
        this._spendPause(t, e), ut(t, "aparte-message-resumed", { messageId: e }, l), v = await this._streamLoop(
          t,
          e,
          n,
          { ...u, messages: tt },
          a,
          h,
          X
        );
      }
      const L = v.usage, E = v.finishReason;
      this._isAborted || h.signal.aborted ? (this._closeOpenCalls(t, e), this._updateMessage(t, e, { status: "completed" })) : (ut(t, "aparte-message-done", { messageId: e, role: "assistant", usage: L, ...E ? { finishReason: E } : {} }, l), this._readWindowAfterTurn());
    }, b = async (v) => {
      if (v.code !== U.USAGE_CONTEXT_EXCEEDED || !p || !o?.rebuild || (t.getMessage?.(e)?.segments ?? t.getMessages?.()?.find((T) => T.id === e)?.segments ?? []).some((T) => T.type === "text" || T.type === "tool_call")) return "stands";
      try {
        const T = await p.compact({
          target: t,
          ...l ? { targetId: l } : {},
          force: !0,
          reason: "overflow",
          exclude: f(),
          signal: h.signal
        });
        if (k()) return "stopped";
        if (!T.ok || T.skipped) return "stands";
        u = await d(await o.rebuild());
      } catch {
        return "stands";
      }
      return this._updateMessage(t, e, { status: "pending" }), "resend";
    };
    try {
      for (let v = 0; ; v++)
        try {
          if (v === 0 && p?.beforeSend && o?.rebuild) {
            let w = !1;
            try {
              w = await p.beforeSend({
                target: t,
                ...l ? { targetId: l } : {},
                exclude: f(),
                requestTokens: g(),
                signal: h.signal
              });
            } catch (T) {
              console.warn("[AparteClient] The compactor threw before a send; sending the request as built.", T);
            }
            if (k()) {
              A();
              return;
            }
            w && (u = await d(await o.rebuild()));
          }
          this._updateMessage(t, e, { contextEstimate: m() }), await y();
          return;
        } catch (w) {
          if (this._closeOpenCalls(t, e), k()) {
            ut(t, "aparte-message-aborted", { messageId: e }, l), this._updateMessage(t, e, { status: "completed" });
            return;
          }
          const T = Z.from(w, U.UNKNOWN_ERROR), S = v === 0 ? await b(T) : "stands";
          if (S === "resend") continue;
          if (S === "stopped") {
            A();
            return;
          }
          this._handleLifecycleError(t, e, T);
          return;
        }
    } finally {
      this._turnsInFlight.delete(e);
    }
  }
  /**
   * Replies a turn is running into right now, a pause it waits on included: a second
   * load of their conversation must not start them again (`resumeDeferred`).
   */
  _turnsInFlight = /* @__PURE__ */ new Set();
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
    return Xo(this._config);
  }
  async _handleRetry(t) {
    const { messageId: e, targetId: n } = t.detail ?? {};
    if (this._beginUserTurn(), !e) return;
    const i = this._resolveTarget(n, t);
    if (!i) {
      console.warn("[AparteClient] aparte-retry — no target found");
      return;
    }
    const r = i.getMessages?.() ?? [], a = r.findIndex((A) => A.id === e), l = (a >= 0 ? r[a] : void 0)?.role === "user" ? a + 1 : a, c = a >= 0 ? r.slice(0, l) : r, d = {
      id: J(),
      role: "assistant",
      content: "",
      status: "pending",
      timestamp: Date.now()
    }, u = i.addSiblingOf?.(e, d) ?? d.id, h = this._config.getModelConfig(), p = h.defaultProvider, f = this._providerFor(p);
    if (!f) return;
    const _ = p ? await this._resolveAuth(p) : void 0, g = this._messagesToChatMessages(c), m = this._systemMessages();
    await this._streamTurn(
      i,
      u,
      f,
      [...m, ...Jt(g)],
      h.defaultModel || "",
      _,
      {
        ...f.retryTemperature !== void 0 ? { temperature: f.retryTemperature } : {},
        ...this._turnMeta([...c].reverse().find((A) => A.role === "user")),
        rebuild: async () => [
          ...this._systemMessages(),
          ...Jt(this._messagesToChatMessages(this._current(i, c)))
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
    const n = this._config.resolveToolSystemPrompts(this._toolsForCurrentModel());
    return n && t.push({ role: "system", content: n }), t;
  }
  /**
   * Handle aparte-edit — update the user message in place, truncate all subsequent
   * messages, then re-stream a fresh assistant response.
   */
  async _handleEdit(t) {
    const { messageId: e, content: n, targetId: i } = t.detail ?? {};
    if (this._beginUserTurn(), !e || n === void 0) return;
    const r = this._resolveTarget(i, t);
    if (!r) {
      console.warn("[AparteClient] aparte-edit — no target found");
      return;
    }
    const a = r.getMessages?.().find((m) => m.id === e);
    r.updateMessage?.(e, {
      content: n,
      ...a?.tokens ? { tokens: sp(n, a.tokens) } : {}
    });
    const o = r.getMessages?.() ?? [], l = o.findIndex((m) => m.id === e);
    if (r.truncateResponsesAfter)
      r.truncateResponsesAfter(e);
    else {
      const m = l >= 0 && l + 1 < o.length ? o[l + 1]?.id : void 0;
      m && r.truncateFrom?.(m);
    }
    const c = l >= 0 ? o.slice(0, l + 1) : o, d = this._messagesToChatMessages(c), u = this._systemMessages(), h = this._config.getModelConfig(), p = h.defaultProvider, f = this._providerFor(p);
    if (!f) return;
    const _ = p ? await this._resolveAuth(p) : void 0, g = J();
    r.appendMessage?.({
      id: g,
      role: "assistant",
      content: "",
      status: "pending",
      timestamp: Date.now()
    }), await this._streamTurn(
      r,
      g,
      f,
      [...u, ...Jt(d)],
      h.defaultModel || "",
      _,
      {
        ...this._turnMeta(l >= 0 ? o[l] : void 0),
        rebuild: async () => [
          ...this._systemMessages(),
          ...Jt(this._messagesToChatMessages(this._current(r, c)))
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
    const n = new Map((t.getMessages?.() ?? []).map((i) => [i.id, i]));
    return e.map((i) => t.getMessage?.(i.id) ?? n.get(i.id) ?? i);
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
    const n = [];
    let i = t ? Gt(t) : null;
    for (; i; )
      n.push(i), i = i.parentElement;
    return n;
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
    for (const n of this._originChain(t)) {
      if (typeof n.getRootNode != "function") continue;
      const i = ne(n);
      e.includes(i) || e.push(i);
    }
    return e.includes(document) || e.push(document), e;
  }
  /** The element an id names, looked up in the gesture's own tree before the document. */
  _byId(t, e) {
    for (const n of this._rootsFor(e)) {
      const i = n.getElementById?.(t);
      if (i) return i;
    }
    return null;
  }
  /** The first chat that can render, own tree first — the path when nothing names one. */
  _scanForTarget(t) {
    for (const e of this._rootsFor(t))
      for (const n of e.querySelectorAll(Nr)) {
        const i = this._asRenderTarget(n);
        if (i) return i;
      }
    return null;
  }
  /**
   * Resolve a target element by id (from event detail.targetId) or via targetResolver / DOM scan.
   */
  _resolveTarget(t, e) {
    if (t) {
      const i = this._byId(t, e);
      if (i) return this._asRenderTarget(i) ?? i;
    }
    if (this.options.targetResolver) {
      const i = this.options.targetResolver();
      if (i) return this._asRenderTarget(i) ?? i;
    }
    const n = this._scanForTarget(e);
    if (n) return n;
    for (const i of this._rootsFor(e)) {
      const r = i.querySelector(Nr);
      if (r) return r;
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
    const { summary: e, messages: n } = Is(t);
    return [...this._summaryMessage(e), ...cn(n)];
  }
  /**
   * What the model reads in place of everything before a checkpoint: the summary, as a
   * `user` message under the same preamble a legacy compaction message gets, so it is
   * context and not something the person said. It may sit right before a user turn;
   * `mergeAdjacentUserMessages` joins the two where the history is assembled.
   */
  _summaryMessage(t) {
    return t === void 0 ? [] : [{ role: "user", content: ni(t) }];
  }
  /** A message's tokens and metadata as a turn's `_meta`: a send and its retry say the same. */
  _turnMeta(t) {
    const e = { ...t?.metadata ?? t?.meta, ...t?.tokens?.length ? { tokens: t.tokens } : {} };
    return Object.keys(e).length > 0 ? { meta: e } : {};
  }
  /** The "no model selected" warning is said once per client, not once per dropped send. */
  _warnedNoModel = !1;
  async _handleSend(t) {
    const { content: e, modelId: n, providerId: i } = t.detail;
    if (this._config.getRequireModelSelection() && !this._config.hasSelectedModel() && !n) {
      console.warn(
        "[AparteClient] Send refused: requireModelSelection is on and no model is selected yet. The composer blocks this, but this send did not come from it — disable your own send affordances while `hasSelectedModel()` is false."
      );
      return;
    }
    let r = null;
    const a = t.detail?.targetId;
    if (a) {
      const _ = this._byId(a, t), g = this._asRenderTarget(_);
      g ? r = g : console.warn("[AparteClient] ⚠️ targetId present but element not found or missing appendMessage:", a);
    }
    if (!r && this.options.targetResolver && (r = this._asRenderTarget(
      this.options.targetResolver()
    )), !r)
      for (const _ of this._originChain(t)) {
        const g = _;
        if (typeof g?.appendMessage == "function") {
          r = g;
          break;
        }
      }
    if (r || (r = this._scanForTarget(t)), !r) {
      console.warn("[AparteClient] ⚠️ No target element found with appendMessage support. Provide a targetResolver in AparteClientOptions or ensure the composer has a `target` attribute.");
      return;
    }
    if (this._closeDeferred(r), this.options.echoUserMessage !== !1 && t.detail?.echoed !== !0) {
      const _ = Array.isArray(t.detail?.files) ? t.detail.files : [];
      r.appendMessage?.({
        id: J(),
        role: "user",
        content: e,
        timestamp: Date.now(),
        ..._.length > 0 ? { attachments: zo(_) } : {},
        ...t.detail?.tokens?.length ? { tokens: t.detail.tokens } : {},
        ...t.detail?.meta ? { metadata: t.detail.meta } : {}
      }), t.detail && typeof t.detail == "object" && (t.detail.echoed = !0);
    }
    const o = J(), l = this._config.getModelConfig(), c = i || l.defaultProvider;
    if (!c && !this._modelRunsElsewhere) {
      this._warnedNoModel || (this._warnedNoModel = !0, console.warn(
        "[AparteClient] Send dropped: no model is selected. Call aparteGlobalConfig.setModelConfig({ defaultProvider, defaultModel }), mount <aparte-model-selector auto-select persist>, or register one provider with a single model — that one is selected on its own."
      )), this._handleLifecycleError(r, o, new Z(
        "No provider selected. Please configure a provider.",
        U.CONFIG_NO_PROVIDER
      ));
      return;
    }
    const d = this._providerFor(c);
    if (!d) {
      this._handleLifecycleError(r, o, new Z(
        `Provider '${c}' is not registered.`,
        U.CONFIG_MISSING_KEY,
        { providerId: c }
      ));
      return;
    }
    r.appendMessage?.({
      id: o,
      role: "assistant",
      content: "",
      status: "pending",
      timestamp: Date.now()
    });
    let u, h, p;
    const f = Array.isArray(t.detail?.files) ? t.detail.files : [];
    try {
      u = c ? await this._resolveAuth(c) : void 0;
      const _ = this._selectFilesToInject(f), g = _.length > 0 ? await this._filesToContentParts(_) : [];
      p = g.length > 0 ? g : void 0, h = this._buildMessages(e, r, p);
    } catch (_) {
      this._handleLifecycleError(r, o, Z.from(_, U.UNKNOWN_ERROR));
      return;
    }
    await this._streamTurn(
      r,
      o,
      d,
      h,
      n || l.defaultModel || "",
      u,
      {
        rebuild: async () => this._buildMessages(e, r, p),
        ...f.length > 0 ? { files: f } : {},
        ...this._turnMeta(t.detail)
      }
    );
  }
  /**
   * Build the initial messages array, prepending system prompts and conversation history.
   */
  _buildMessages(t, e, n) {
    const i = this._systemMessages(), r = this.options.history ?? "viewport", a = e?.getMessages?.() ?? [];
    r === "viewport" ? i.push(...this._toHistoryMessages(a)) : typeof r == "function" && i.push(...r(a));
    const o = n && n.length > 0 ? [{ type: "text", text: t }, ...n] : t;
    return i.push({ role: "user", content: o }), Jt(i);
  }
  _toHistoryMessages(t) {
    const { summary: e, messages: n } = Is(t);
    let i = 0;
    for (let r = 0; r < n.length; r++) {
      const a = n[r];
      a.role === "assistant" && a.status !== "error" && !Ko(a) && (i = r + 1);
    }
    return [...this._summaryMessage(e), ...cn(n.slice(0, i))];
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
    const e = this.options.rawFileInject === "none" ? [] : this.options.rawFileInject === "images-only" ? t.filter((i) => i.type.startsWith("image/")) : t, n = this.options.fileInjectFilter;
    return n ? e.filter((i) => n(i)) : e;
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
    const e = /^(text\/|application\/(json|xml|javascript|typescript|x-yaml|yaml|toml|csv|markdown))/i, n = /\.(txt|md|markdown|json|jsonl|csv|tsv|xml|html|htm|css|js|mjs|cjs|ts|tsx|jsx|py|rb|java|c|cpp|h|go|rs|php|sh|bash|zsh|fish|yaml|yml|toml|ini|env|log|svg|graphql|gql)$/i;
    return (await Promise.all(
      t.map((r) => r.type.startsWith("image/") ? new Promise((a, o) => {
        const l = new FileReader();
        l.onload = () => a({ type: "image", image: l.result, mimeType: r.type }), l.onerror = () => o(new Error(`Failed to read file: ${r.name}`)), l.readAsDataURL(r);
      }) : e.test(r.type) || n.test(r.name) ? new Promise((a, o) => {
        const l = new FileReader();
        l.onload = () => {
          const c = l.result, d = r.name.split(".").pop() ?? "";
          a({
            type: "text",
            text: `\`\`\`${d}
// File: ${r.name}
${c}
\`\`\``
          });
        }, l.onerror = () => o(new Error(`Failed to read file: ${r.name}`)), l.readAsText(r);
      }) : ($r.has(r.name) || ($r.add(r.name), console.warn(
        `[aparte] ${r.name} (${r.type || "unknown type"}) is attached to the message but is not sent to the model: aparté inlines images and text files only. Handle it in your app (RAG, an upload) — the chip stays visible either way.`
      )), Promise.resolve(null)))
    )).filter((r) => r !== null);
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
  async _streamLoop(t, e, n, i, r, a = new AbortController(), o, l) {
    this._streamController !== a && this._streamController?.abort(), this._streamController = a;
    const c = this.options.streamRunner ?? Ei;
    return this._runViaStreamRunner(c, t, e, n, i, r, a, o, l);
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
  async _runViaStreamRunner(t, e, n, i, r, a, o, l, c) {
    const d = o.signal, u = this._targetIdOf(e), h = jn({
      target: e,
      config: this._config,
      messageId: n,
      ...u ? { targetId: u } : {}
    }), p = r._meta?.prefixSegments;
    let f, _, g;
    const m = (S) => {
      if (h(S), S.type === "tool-failed" && (g = S.error), S.type === "run-done" && (_ = S.finishReason), S.type === "run-suspended") {
        const x = S.ticket;
        f = { pending: S.pending, ...typeof x == "string" ? { ticket: x } : {} };
      }
      if (S.type === "run-start" && p?.length && !l)
        for (const x of p) e.addSegment?.(x);
    }, A = async (S) => {
      const x = await this._config.getTransport().chat(i, S, a, { providerId: i.id, signal: d });
      return typeof x == "string" ? x : Bu(x, d);
    }, k = (S) => {
      const x = this._config.getToolHandler(S);
      if (!x) return;
      const L = { target: e, config: this._config };
      return (E, N) => x(E, N, L);
    }, y = !!this.options.approvalResolver, b = (S) => {
      const x = this._config.getTools().find((L) => L.name === S);
      if (x)
        return {
          maxTurns: x.maxTurns,
          needsApproval: y ? x.needsApproval : (L) => {
            const E = this._config.ruleOnToolCall(L).verdict;
            return E === "allow" ? !1 : E;
          }
        };
    }, v = this._approvalResolverFor(e), w = (S) => {
      if (g === void 0 || S instanceof Z) return S;
      const x = S instanceof Error ? S.message || S.name : typeof S == "string" ? S : String(S);
      return x === g ? new Z(x, U.UNKNOWN_ERROR, void 0, S) : S;
    };
    return {
      usage: await t({
        messageId: n,
        ...i.id ? { providerId: i.id } : {},
        ...l ? { deferral: l } : {},
        ...c && c.length > 0 ? { files: c } : {},
        baseRequest: r,
        transportCall: A,
        toolLookup: k,
        toolConfigLookup: b,
        approvalResolver: v,
        emitter: m,
        signal: d,
        maxTurns: this.options.maxTurns,
        // Forwarded, because the option's own JSDoc promises it means one thing
        // whichever loop runs — and the fix that introduced it only wired the
        // inline path, so setting it was silently ignored here. Exactly the
        // asymmetry the option was added to remove.
        toolTimeoutMs: this.options.toolTimeoutMs,
        // The id conventions the loop always had: prefixed artifact ids, but a
        // BARE uuid for the synthetic tool (the adapter renders `tool-<id>`).
        idGen: (S) => S === "synthetic-tool" ? J() : `${S}-${J()}`
      }).catch((S) => {
        throw w(S);
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
    return this.options.approvalResolver ?? (async (n, i) => {
      const r = e ? this._config.getApprovalPolicy()?.(n, this._config.getTools().find((a) => a.name === n.name)) ?? { verdict: "ask" } : this._config.ruleOnToolCall(n);
      return r.verdict === "allow" ? { approved: !0 } : r.verdict === "deny" ? { approved: !1, reason: r.reason?.trim() || "Tool execution was refused by the approval policy.", by: "policy" } : this._askForApproval(n, i, t);
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
  async _answerDeferred(t, e, n, i, r = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set()) {
    const o = {}, l = this._approvalResolverFor(t, !0), c = (d) => {
      for (const u of e.slice(d + 1))
        o[u.toolCallId] = { kind: "decision", approved: !1, reason: ep, by: "earlier-refusal" };
    };
    for (const [d, u] of e.entries()) {
      if (n.aborted) break;
      const h = { id: u.toolCallId, name: u.name, input: u.input ?? {} };
      if (u.reason === "approval") {
        let p;
        try {
          p = await l(h, n);
        } catch (f) {
          if (!n.aborted && f?.name !== "AbortError") throw f;
        }
        if (!p || n.aborted) return;
        if (o[u.toolCallId] = { kind: "decision", ...p }, p.approved) a.add(Or(h));
        else {
          c(d);
          break;
        }
      } else if (u.reason === "external") {
        let p = null;
        const f = Or(h);
        if (!r.has(f) && !a.has(f))
          try {
            p = await this._gateBrowserTool(h, n, t, i);
          } catch (A) {
            if (!n.aborted && A?.name !== "AbortError") throw A;
            p = void 0;
          }
        if (p === void 0 || n.aborted) return;
        if (p && !p.approved) {
          o[u.toolCallId] = { kind: "decision", ...p }, c(d);
          break;
        }
        const _ = p?.payload, g = _ && typeof _ == "object" && !Array.isArray(_) ? { ...h, input: { ...h.input, ..._ } } : h, m = this._config.getToolHandler(u.name);
        try {
          if (!m) throw new Error(`No browser handler is registered for "${u.name}".`);
          const A = await m(g, n, { target: t, config: this._config });
          o[u.toolCallId] = {
            kind: "result",
            content: A.content,
            ...A.structuredContent !== void 0 ? { structuredContent: A.structuredContent } : {}
          };
        } catch (A) {
          if (n.aborted) break;
          o[u.toolCallId] = { kind: "failed", error: A instanceof Error ? A.message : String(A) };
        }
      }
    }
    return n.aborted ? void 0 : o;
  }
  /**
   * Whether a browser tool a paused run asked for may run, decided as a run in the page
   * decides it. With a host `approvalResolver`, the tool's own `needsApproval` says whether
   * to ask and the resolver answers; without one, the approval policy and `needsApproval`
   * rule (`ruleOnToolCall`) and the default channel asks. `null` when nothing gates the
   * call, the decision when something did, `undefined` when nobody answered.
   */
  async _gateBrowserTool(t, e, n, i) {
    const r = this.options.approvalResolver ? this._config.getTools().find((o) => o.name === t.name)?.needsApproval ? "ask" : "allow" : this._config.ruleOnToolCall(t).verdict;
    if (r === "allow") return null;
    r === "ask" && i?.({ type: "tool-awaiting-approval", toolCallId: t.id, name: t.name, input: t.input });
    const a = await this._approvalResolverFor(n)(t, e) ?? void 0;
    return a?.approved && r === "ask" && n.updateSegment?.(`tool-${t.id}`, { status: "pending" }), a;
  }
  /**
   * The ticket is spent the moment the resume leaves: the server answers these calls
   * now, so a pause saved from here on — the conversation manager saves before it cuts a
   * switch — would be resumed a second time, against a server that has moved on. The
   * history that resumes them is built first; a new pause marks what still waits.
   */
  _spendPause(t, e) {
    const n = t.getMessage?.(e)?.segments ?? t.getMessages?.()?.find((r) => r.id === e)?.segments, i = (r) => r.type === "tool_call" && !!r.deferred;
    n?.some(i) && t.updateMessage?.(e, {
      segments: n.map((r) => {
        if (!i(r)) return r;
        const { deferred: a, ...o } = r;
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
    const n = t.getMessage?.(e)?.segments ?? t.getMessages?.()?.find((r) => r.id === e)?.segments, i = (r) => r.type === "tool_call" && (r.status === "pending" || r.status === "awaiting-approval");
    n?.some(i) && t.updateMessage?.(e, {
      segments: n.map((r) => {
        if (!i(r)) return r;
        const { deferred: a, ...o } = r;
        return { ...o, status: "aborted" };
      })
    });
  }
  /**
   * The history a resume sends: the request the turn was sent with — interceptor and
   * `history` option included, not rebuilt from the transcript — then the reply so
   * far, its paused calls left open for the server to answer.
   */
  _resumeMessages(t, e, n) {
    const i = t.getMessages?.().find((r) => r.id === e);
    return [...n, ...i ? jo(i, Mn, { openDeferred: !0 }) : []];
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
    const n = t.slice(0, e), i = n.map((o) => o.role).lastIndexOf("user"), r = this.options.history ?? "viewport", a = r === "viewport" ? this._toHistoryMessages(n) : typeof r == "function" ? r(n) : [];
    return Jt([
      ...this._systemMessages(),
      ...a,
      ...i >= 0 ? cn([n[i]]) : []
    ]);
  }
  /**
   * A new message closes a wait nobody answered. The paused calls of the last reply are
   * marked stopped, so the history the new turn sends answers them ("stopped before it
   * ran") — a provider rejects a request that declares a call with no answer.
   */
  _closeDeferred(t) {
    const n = [...t.getMessages?.() ?? []].reverse().find((r) => r.role === "assistant");
    if (!n?.segments?.some(Ee)) return;
    const i = n.segments.map((r) => {
      if (!Ee(r)) return r;
      const { deferred: a, ...o } = r;
      return { ...o, status: "aborted" };
    });
    t.updateMessage?.(n.id, { segments: i });
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
    const e = typeof t == "string" ? this._byId(t) : t ?? this.options.targetResolver?.() ?? null, n = e ? this._asRenderTarget(e) : this._scanForTarget();
    if (!n) return !1;
    const i = n.getMessages?.() ?? [], r = [...i].reverse().find((h) => h.role === "assistant"), a = (r?.segments ?? []).filter(Ee), o = a.find((h) => h.deferred?.ticket)?.deferred?.ticket;
    if (!r || a.length === 0 || !o || this._resuming.has(r.id) || this._turnsInFlight.has(r.id)) return !1;
    const l = this._config.getModelConfig(), c = r.model && this._config.getAIProvider(r.model.providerId) ? r.model : void 0, d = c?.providerId ?? l.defaultProvider, u = this._providerFor(d);
    if (!u)
      return console.warn("[AparteClient] Cannot resume the paused turn: no provider is selected."), !1;
    this._beginUserTurn(), this._resuming.add(r.id);
    try {
      const h = u.id ? await this._resolveAuth(u.id) : void 0, p = a.map((_) => ({
        toolCallId: _.toolCall.id,
        name: _.toolCall.name,
        input: _.toolCall.input,
        reason: _.deferred.reason
      })), f = this._resumeBase(i, i.indexOf(r));
      await this._streamTurn(n, r.id, u, f, c?.modelId ?? l.defaultModel ?? "", h, {
        resume: { pending: p, ticket: o },
        rebuild: async () => {
          const _ = n.getMessages?.() ?? [], g = _.findIndex((m) => m.id === r.id);
          return g >= 0 ? this._resumeBase(_, g) : f;
        },
        ...c?.temperature !== void 0 ? { temperature: c.temperature } : {}
      });
    } finally {
      this._resuming.delete(r.id);
    }
    return !0;
  }
  /** Replies being resumed, so a second load of the same conversation does not ask twice. */
  _resuming = /* @__PURE__ */ new Set();
  /**
   * Updates an existing message or appends a new error if ID lookup fails
   */
  _updateMessage(t, e, n) {
    t.updateMessage && t.updateMessage(e, n);
  }
  /**
   * Gracefully handles errors by updating the current message instead of duplicating it
   */
  _handleLifecycleError(t, e, n) {
    const i = {
      id: `error-${J()}`,
      type: "error",
      content: n.message,
      code: n.code
    };
    if (ws(n.code, (r) => this._config.t(r)) !== void 0 && console.warn(`[aparte] A turn failed (${n.code}): ${n.message}`), t.updateMessage) {
      const r = t.getMessage?.(e)?.segments ?? t.getMessages?.()?.find((a) => a.id === e)?.segments ?? [];
      t.updateMessage(e, {
        status: "error",
        segments: [...r, i]
      });
    } else t.appendMessage && t.appendMessage({
      id: e,
      role: "assistant",
      status: "error",
      timestamp: Date.now(),
      segments: [i]
    });
    ut(t, "aparte-message-error", { messageId: e, error: n }, this._targetIdOf(t));
  }
}
function Zo(s) {
  return s.next ? Zo(s.next) : "current" in s ? s : null;
}
class rp {
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
    for (let n = this._head; n; n = n.prev)
      e[n.level] = n.current;
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
    const n = this._nodes.get(e.id), i = t ? this._nodes.get(t) : void 0;
    if (t !== null && i === void 0)
      throw new Error(`AparteMessageRepository: parent "${t}" not found.`);
    const r = i ?? null;
    if (n) {
      n.current = e, this._relink(r, n);
      return;
    }
    const a = {
      prev: r,
      next: null,
      children: [],
      current: e,
      level: r ? r.level + 1 : 0
    };
    this._nodes.set(e.id, a), this._link(r, a), (this._head === r || this._head === null && r === null) && (this._head = a);
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
    const n = e.prev ?? this._root;
    n.next = e, this._head = Zo(e);
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
    const n = this._head;
    this._deleteDescendants(e);
    const i = e.prev ?? this._root;
    i.children = i.children.filter((a) => a !== t), i.next === e && (i.next = null), this._nodes.delete(t), n !== null && n !== e && this._nodes.get(n.current.id) === n || (this._head = e.prev);
  }
  /**
   * Update a message's data without changing its position in the tree.
   */
  updateMessage(t, e) {
    const n = this._nodes.get(t);
    n && (n.current = { ...n.current, ...e });
  }
  /**
   * Remove ALL children of `parentId` (and their descendants) and set head
   * to `parentId`. Used by edit to discard every previous response before
   * re-generating — ensures the new response starts with sibling count = 1.
   */
  clearChildren(t) {
    const e = this._nodes.get(t);
    if (e) {
      for (const n of [...e.children]) {
        const i = this._nodes.get(n);
        i && (this._deleteDescendants(i), this._nodes.delete(n));
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
    for (const { message: e, parentId: n } of t.messages) {
      if (n !== null && !this._nodes.has(n)) {
        console.warn(
          `[AparteMessageRepository] import: message "${e.id}" names a parent "${n}" the snapshot does not hold before it — skipped.`
        );
        continue;
      }
      if (this._nodes.has(e.id)) {
        console.warn(
          `[AparteMessageRepository] import: message "${e.id}" repeats an id already in the snapshot — skipped.`
        );
        continue;
      }
      this.addOrUpdateMessage(n, e);
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
    const t = [], e = (n, i) => {
      for (const r of n) {
        const a = this._nodes.get(r);
        a && (t.push({ message: a.current, parentId: i }), e(a.children, r));
      }
    };
    return e(this._root.children, null), { headId: this.headId, messages: t };
  }
  // ─── Private helpers ────────────────────────────────────────────────────
  _link(t, e) {
    const n = t ?? this._root;
    n.children = [...n.children, e.current.id], n.next === null && (n.next = e), e.prev = t;
  }
  _relink(t, e) {
    const n = e.prev ?? this._root;
    if (n !== (t ?? this._root) && (n.children = n.children.filter((r) => r !== e.current.id), n.next === e)) {
      const r = n.children[0];
      n.next = r ? this._nodes.get(r) ?? null : null;
    }
    e.prev = t;
    const i = t ?? this._root;
    i.children.includes(e.current.id) || (i.children = [...i.children, e.current.id]), i.next === null && (i.next = e), this._updateLevels(e, t ? t.level + 1 : 0);
  }
  _updateLevels(t, e) {
    t.level = e;
    for (const n of t.children) {
      const i = this._nodes.get(n);
      i && this._updateLevels(i, e + 1);
    }
  }
  _deleteDescendants(t) {
    for (const e of t.children) {
      const n = this._nodes.get(e);
      n && (this._deleteDescendants(n), this._nodes.delete(e));
    }
    t.children = [], t.next = null;
  }
}
function ue(s) {
  return s.status === "streaming" || s.status === "pending" ? !0 : s.status === void 0 && s.role === "assistant" && !s.content?.trim() && !s.segments?.length;
}
function ap(s, t, e = {}) {
  const { gap: n = 4, margin: i = 8, side: r = "below", align: a = "start", rtl: o = !1 } = e, l = t.getBoundingClientRect(), c = (h, p, f) => Math.max(i, Math.min(h, p - f - i));
  let d, u;
  if (r === "beside") {
    const h = s.right + n, p = s.left - l.width - n, [f, _] = o ? [p, h] : [h, p], g = (m) => m >= i && m + l.width <= window.innerWidth - i;
    u = g(f) || !g(_) ? f : _, d = s.top;
  } else {
    const h = s.bottom + n, p = s.top - l.height - n, f = h + l.height <= window.innerHeight - i, _ = p >= i;
    r === "below" ? d = f || !_ ? h : p : d = _ || !f ? p : h, u = a === "start" !== o ? s.left : s.right - l.width;
  }
  t.style.top = `${c(d, window.innerHeight, l.height)}px`, t.style.left = `${c(u, window.innerWidth, l.width)}px`;
}
const op = ".aparte-message-content, .aparte-segments, .aparte-content, .aparte-checkpoint__summary";
function St(s) {
  return !!s?.closest?.(op);
}
const Pr = Symbol.for("aparte.dialogTriggers");
let Ls = null, vn = null;
function lp(s) {
  Ls = s.target, vn = null;
}
function cp(s) {
  vn = s.target;
}
function dp(s) {
  const t = s.target;
  if (!t?.closest) return;
  const e = t.closest("[data-aparte-dialog-open]");
  if (e && !St(e)) {
    const i = e.getAttribute("data-aparte-dialog-open"), r = i ? document.getElementById(i) : null;
    r instanceof HTMLDialogElement && !r.open && (s.preventDefault(), r.showModal());
    return;
  }
  const n = t.closest("[data-aparte-dialog-close]");
  if (n && !St(n)) {
    const i = n.closest("dialog");
    i instanceof HTMLDialogElement && i.open && (s.preventDefault(), i.close(n.getAttribute("data-aparte-dialog-close") ?? ""));
    return;
  }
  if (t instanceof HTMLDialogElement && t.open && t.classList.contains("aparte-dialog") && !t.hasAttribute("data-aparte-dialog-static")) {
    const i = Ls === t && vn === t;
    Ls = null, vn = null, i && t.close();
  }
}
function up(s = document) {
  const t = s;
  t[Pr] || (t[Pr] = !0, s.addEventListener("pointerdown", lp, !0), s.addEventListener("pointerup", cp, !0), s.addEventListener("click", dp));
}
const Jn = "defer-hydration", Le = /* @__PURE__ */ new WeakMap(), Oe = /* @__PURE__ */ new WeakMap(), he = /* @__PURE__ */ new WeakSet(), yn = /* @__PURE__ */ new WeakSet(), Os = /* @__PURE__ */ new WeakMap(), Dr = /* @__PURE__ */ new WeakSet();
function Hr(s) {
  if (yn.has(s)) return !1;
  if (Oe.has(s)) return !0;
  const t = s.closest(`[${Jn}]`);
  if (!t) return !1;
  Oe.set(s, t);
  let e = Le.get(t);
  if (!e) {
    e = [], Le.set(t, e);
    const n = new MutationObserver(() => {
      t.hasAttribute(Jn) || hp(t);
    });
    n.observe(t, { attributes: !0, attributeFilter: [Jn] }), Os.set(t, n);
  }
  return e.push(s), !0;
}
function hp(s) {
  Os.get(s)?.disconnect(), Os.delete(s);
  const t = Le.get(s) ?? [];
  Le.delete(s);
  for (const e of t)
    Oe.delete(e), e.isConnected && !yn.has(e) && e.connectedCallback?.();
}
function V(s) {
  if (Dr.has(s)) return;
  Dr.add(s);
  const t = s.prototype, e = t.connectedCallback, n = t.attributeChangedCallback, i = t.disconnectedCallback, r = s.observedAttributes ?? [];
  t.connectedCallback = function() {
    if (Hr(this)) {
      he.add(this);
      return;
    }
    if (he.has(this)) {
      he.delete(this);
      for (const a of r) {
        const o = this.getAttribute(a);
        o !== null && n?.call(this, a, null, o);
      }
    }
    yn.add(this), e?.call(this);
  }, n && (t.attributeChangedCallback = function(a, o, l) {
    if (Hr(this)) {
      he.add(this);
      return;
    }
    n.call(this, a, o, l);
  }), t.disconnectedCallback = function() {
    const a = Oe.get(this);
    if (a) {
      Oe.delete(this);
      const o = Le.get(a);
      o && o.splice(o.indexOf(this), 1);
      return;
    }
    he.has(this) || (yn.delete(this), i?.call(this));
  };
}
function st(s) {
  return s === "" ? !0 : !!s;
}
class Jo extends HTMLElement {
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
    this.toggleAttribute("disabled", st(t));
  }
  get selected() {
    return this.hasAttribute("selected");
  }
  set selected(t) {
    this.toggleAttribute("selected", st(t));
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
V(Jo);
customElements.get("aparte-option") || customElements.define("aparte-option", Jo);
class Ln extends HTMLElement {
  /** Ids for the label span the group points `aria-labelledby` at. */
  static _labelIdSeq = 0;
  static get observedAttributes() {
    return ["label", "collapsible", "collapsed", "loading"];
  }
  connectedCallback() {
    this.setAttribute("role", "group"), this._render();
  }
  attributeChangedCallback(t, e, n) {
    e !== n && (t === "collapsed" && this._updateCollapsedState(), this.isConnected && this._render());
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
    this.toggleAttribute("collapsible", st(t));
  }
  get collapsed() {
    return this.hasAttribute("collapsed");
  }
  set collapsed(t) {
    this.toggleAttribute("collapsed", st(t));
  }
  get loading() {
    return this.hasAttribute("loading");
  }
  set loading(t) {
    this.toggleAttribute("loading", st(t));
  }
  _render() {
    if (this.label && !this.querySelector(".aparte-optgroup-header")) {
      const e = document.createElement("div");
      e.className = "aparte-optgroup-header";
      const n = document.createElement("span");
      if (n.className = "aparte-optgroup-label", n.id = `aparte-optgroup-label-${++Ln._labelIdSeq}`, n.textContent = this.label, this.setAttribute("aria-labelledby", n.id), e.appendChild(n), this.collapsible) {
        const i = document.createElement("span");
        i.className = "aparte-optgroup-chevron", i.innerHTML = I(this).getIcon("expand"), e.appendChild(i), e.style.cursor = "pointer", e.addEventListener("click", (r) => {
          r.stopPropagation(), this._toggleCollapse();
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
        e.className = "aparte-spinner-small", t.replaceChildren(e, ` ${I(this).t("loading") || "Loading…"}`), this.appendChild(t);
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
V(Ln);
customElements.get("aparte-optgroup") || customElements.define("aparte-optgroup", Ln);
class $e extends HTMLElement {
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
  attributeChangedCallback(t, e, n) {
    if (this.isConnected) {
      if (t === "value" && e !== n && n !== this._value && (this._value = n || "", this._updateTriggerLabel()), t === "open") {
        const i = this.hasAttribute("open");
        i !== this._isOpen && (i ? this._openDropdown() : this._closeDropdown());
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
    this.toggleAttribute("open", st(t));
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
      const n = this._buildSearchInput(I(this));
      e && n.setAttribute("aria-controls", e), this._dropdown.prepend(n), this._searchInput = n, n.addEventListener("input", this._boundHandleSearchInput), this._trigger.setAttribute("role", "button");
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
    const n = Array.from(this.children), i = I(this), r = document.createElement("div");
    r.className = "aparte-select-trigger", r.setAttribute("tabindex", "0"), r.setAttribute("role", e ? "button" : "combobox"), r.setAttribute("aria-haspopup", "listbox"), r.setAttribute("aria-expanded", "false"), r.setAttribute("aria-label", this.getAttribute("aria-label") || t);
    const a = document.createElement("span");
    a.className = "aparte-select-label";
    const o = document.createElement("span");
    o.className = "aparte-select-label-text", o.textContent = t;
    const l = document.createElement("span");
    l.className = "aparte-select-label-sizer", l.setAttribute("aria-hidden", "true"), a.append(o, l);
    const c = document.createElement("span");
    c.className = "aparte-select-chevron", c.innerHTML = i.getIcon("expand"), r.append(a, c);
    const d = document.createElement("div");
    d.className = "aparte-select-dropdown", d.hidden = !this._isOpen;
    const u = e ? this._buildSearchInput(i) : null;
    u && d.appendChild(u);
    const h = document.createElement("div");
    h.className = "aparte-select-options", h.setAttribute("role", "listbox"), h.setAttribute("aria-label", r.getAttribute("aria-label") ?? t), h.id = this.id ? `${this.id}-listbox` : `aparte-listbox-${++$e._listboxSeq}`, r.setAttribute("aria-controls", h.id), u?.setAttribute("aria-controls", h.id), n.forEach((p) => {
      (p.tagName === "APARTE-OPTION" || p.tagName === "APARTE-OPTGROUP") && h.appendChild(p);
    }), d.appendChild(h), this._observer?.disconnect(), this.innerHTML = "", this.appendChild(r), this.appendChild(d), this._trigger = r, this._dropdown = d, this._searchInput = d.querySelector(".aparte-select-search"), this.isConnected && this._setupMutationObserver(), this._updateTriggerLabel();
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
      (n) => n.className !== "aparte-select-trigger" && n.className !== "aparte-select-dropdown"
    );
    e.length !== 0 && (this._observer?.disconnect(), t.innerHTML = "", e.forEach((n) => {
      t.appendChild(n);
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
    const e = Gt(t);
    (!e || !this.contains(e)) && this._closeDropdown();
  }
  _handleKeydown(t) {
    if (!this._isOpen) return;
    const e = wt(this) === this._searchInput;
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
        const n = this._visibleOptions()[this._activeIndex];
        n && (t.preventDefault(), this._selectOption(n));
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
    const n = this._activeIndex < 0 ? t > 0 ? -1 : 0 : this._activeIndex;
    this._setActive(n + t);
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
    const n = this._visibleOptions();
    if (n.length === 0) {
      this._activeIndex = -1, this._activeHost()?.removeAttribute("aria-activedescendant");
      return;
    }
    const i = Math.max(0, Math.min(t, n.length - 1));
    this._activeIndex = i;
    const r = n[i];
    r.id || (r.id = `aparte-option-${++$e._optIdSeq}`), r.setAttribute("data-active", ""), this._activeHost()?.setAttribute("aria-activedescendant", r.id), r.scrollIntoView?.({ block: "nearest" });
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
    const e = this._visibleOptions().findIndex((n) => n.getAttribute("value") === this._value);
    this._setActive(e >= 0 ? e : 0), this.dispatchEvent(new CustomEvent("aparte-select-open", { bubbles: !0 }));
  }
  _closeDropdown() {
    this._isOpen = !1, this._clearActive(), this._dropdown?.setAttribute("hidden", ""), this._setExpanded(!1), this.removeAttribute("open"), this.removeAttribute("position"), this._dropdown && (this._dropdown.style.top = "", this._dropdown.style.bottom = "", this._dropdown.style.left = "", this._dropdown.style.width = ""), this._searchInput && (this._searchInput.value = "", this._filterOptions("")), this.dispatchEvent(new CustomEvent("aparte-select-close", { bubbles: !0 }));
  }
  _updatePosition() {
    if (!this._dropdown || !this._trigger) return;
    const t = this._trigger.getBoundingClientRect(), e = this._dropdown.offsetHeight || 300, n = window.innerHeight, i = n - t.bottom, r = 4;
    this._dropdown.style.left = `${t.left}px`, this._dropdown.style.width = `${t.width}px`, i < e && t.top > e ? (this._dropdown.style.top = "", this._dropdown.style.bottom = `${n - t.top + r}px`, this.setAttribute("position", "top")) : (this._dropdown.style.top = `${t.bottom + r}px`, this._dropdown.style.bottom = "", this.removeAttribute("position"));
  }
  _selectOption(t) {
    const e = t.getAttribute("value") || t.textContent?.trim() || "", n = this._value;
    this._value = e, this.setAttribute("value", e), this._updateTriggerLabel(), this._closeDropdown(), this._emitChange(n), this._trigger?.focus();
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
    const t = this.getAttribute("placeholder") || "Select...", e = this.getAttribute("aria-label") || t, n = this.querySelector(".aparte-select-options");
    n && n.getAttribute("aria-label") !== e && n.setAttribute("aria-label", e);
    const i = this._trigger;
    if (!i) return;
    const r = this._getSelectedLabel() || t, a = i.getAttribute("role") === "button" && r !== e ? `${e}: ${r}` : e;
    i.getAttribute("aria-label") !== a && i.setAttribute("aria-label", a);
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
      const r = this._getSelectedLabel() || t;
      e.textContent !== r && (e.textContent = r);
    }
    const n = this._trigger?.querySelector(".aparte-select-label-sizer");
    if (n) {
      const r = [t, ...Array.from(this.querySelectorAll("aparte-option"), (o) => Br(o))], a = Array.from(n.children, (o) => o.textContent ?? "");
      (r.length !== a.length || r.some((o, l) => o !== a[l])) && n.replaceChildren(...r.map((o) => {
        const l = document.createElement("span");
        return l.textContent = o, l;
      }));
    }
    this._updateNames(), this.querySelectorAll("aparte-option").forEach((r) => {
      r.getAttribute("value") === this._value ? r.setAttribute("selected", "") : r.removeAttribute("selected");
    });
  }
  _getSelectedLabel() {
    for (const t of this.querySelectorAll("aparte-option"))
      if (t.getAttribute("value") === this._value) return Br(t);
    return "";
  }
  _filterOptions(t) {
    this.querySelectorAll("aparte-option").forEach((n) => {
      const r = (n.textContent?.toLowerCase() || "").includes(t);
      n.style.display = r ? "" : "none";
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
function Br(s) {
  let t = "";
  for (const e of s.childNodes)
    e.nodeType === Node.ELEMENT_NODE && e.matches(".aparte-option__meta, .aparte-status-dot") || (t += e.textContent ?? "");
  return t.trim();
}
V($e);
customElements.get("aparte-select") || customElements.define("aparte-select", $e);
class tl extends HTMLElement {
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
    const n = e !== null ? this._circ * (1 - e / 100) : 0, i = e !== null ? `${this._circ.toFixed(2)}` : `${(this._circ * 0.72).toFixed(2)} ${(this._circ * 0.28).toFixed(2)}`;
    this.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle class="aparte-spinner-track" cx="12" cy="12" r="${this._r}"/><circle class="aparte-spinner-fill" cx="12" cy="12" r="${this._r}" stroke-dasharray="${i}" stroke-dashoffset="${n.toFixed(2)}"/></svg>`;
  }
}
V(tl);
customElements.get("aparte-progress-spinner") || customElements.define("aparte-progress-spinner", tl);
class el extends HTMLElement {
  static get observedAttributes() {
    return ["name"];
  }
  _unsubscribe = null;
  connectedCallback() {
    this._render(), this._unsubscribe = Kt(this, () => this._render());
  }
  disconnectedCallback() {
    this._unsubscribe?.(), this._unsubscribe = null;
  }
  attributeChangedCallback() {
    this.isConnected && this._render();
  }
  _render() {
    const t = this.getAttribute("name"), e = t ? I(this).getIcon(t) : null;
    this.innerHTML = e ?? "", this.firstElementChild?.setAttribute("aria-hidden", "true");
  }
}
V(el);
customElements.get("aparte-icon") || customElements.define("aparte-icon", el);
function qr(s) {
  let t = s.activeElement;
  for (; t?.shadowRoot?.activeElement; ) t = t.shadowRoot.activeElement;
  return t;
}
function ts(s, t) {
  for (let e = s; e; e = e.parentNode ?? (e instanceof ShadowRoot ? e.host : null))
    if (e === t) return !0;
  return !1;
}
function Fr(s, t, e, n, i) {
  const r = document.createElement("button");
  r.type = "button", r.className = "aparte-btn aparte-btn--icon aparte-btn--sm aparte-btn--ghost aparte-elic-hide", r.setAttribute("aria-expanded", "true"), r.innerHTML = e.getIcon("expand");
  const a = document.createElement("button");
  a.type = "button", a.className = "aparte-btn aparte-btn--ghost aparte-elic-reveal", a.setAttribute("aria-expanded", "false");
  const o = document.createElement("span");
  a.append(o), a.insertAdjacentHTML("beforeend", e.getIcon("collapse"));
  const l = (c) => {
    const d = c.t("elicitationHide");
    r.setAttribute("aria-label", d), r.title = d, o.textContent = c.t("elicitationWaiting");
  };
  return l(e), r.addEventListener("click", () => {
    s.setAttribute("data-collapsed", ""), i(), a.focus();
  }), a.addEventListener("click", () => {
    s.removeAttribute("data-collapsed"), i(), n();
  }), t.prepend(r), s.append(a), { relabel: l };
}
class Ur extends HTMLElement {
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
    const e = t.detail?.targetId, n = this._pendingTargetId();
    e && n && e !== n || this._cancelPending();
  };
  _unsubscribeConfig = null;
  connectedCallback() {
    this.style.display = "none", this._unsubscribeConfig = Kt(this, () => this._relabelPending()), I(this).setElicitationPresenter(this._present, this), window.addEventListener("aparte-message-aborted", this._onTurnEnd), window.addEventListener("aparte-message-error", this._onTurnEnd);
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
    I(this).removeElicitationPresenter(this._present), window.removeEventListener("aparte-message-aborted", this._onTurnEnd), window.removeEventListener("aparte-message-error", this._onTurnEnd), this._unsubscribeConfig?.(), this._unsubscribeConfig = null, this._cancelPending();
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
    const t = I(this);
    nt(t, () => this._pending.relabel());
  }
  _present = (t) => {
    const e = this._getComposer();
    return e ? new Promise((n, i) => {
      let r = !1;
      const a = {}, o = qr(document), l = () => {
        const E = t.message;
        return String(typeof E == "function" ? E() : E ?? "");
      }, c = "aparte-chat, [data-aparte-chat], [data-aparte-host]", d = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])', u = e.closest(c) ?? e.parentElement ?? e, h = !(o instanceof HTMLElement) || o === document.body, p = h ? null : o, f = p !== null && ts(p, u), _ = p !== null && p.matches(d), g = p !== null && !f && (_ || p.tagName === "IFRAME" || p.closest(c) !== null), m = (E) => {
        let N = e.querySelector(":scope > .aparte-elic-status");
        N || (N = document.createElement("span"), N.className = "aparte-sr-only aparte-elic-status", N.setAttribute("role", "status"), e.appendChild(N));
        const G = N;
        G.textContent = "", E && setTimeout(() => {
          G.isConnected && (G.textContent = E);
        }, 60);
      }, A = (E, N) => {
        if (g) {
          m(N);
          return;
        }
        const G = window.scrollX, j = window.scrollY;
        _ && f ? (E.el.hasAttribute("tabindex") || E.el.setAttribute("tabindex", "-1"), E.el.hasAttribute("role") || E.el.setAttribute("role", "group"), N && !E.el.hasAttribute("aria-label") && E.el.setAttribute("aria-label", N), E.el.focus()) : E.focus(), h && (window.scrollX !== G || window.scrollY !== j) && window.scrollTo(G, j);
      }, k = () => {
        if (r) return !1;
        r = !0, this._pending = null;
        const E = qr(document), N = E instanceof Node && ts(E, e);
        return e.hidePanel(a.token), m(""), N && ((!g && p !== null && p.isConnected && !ts(p, e) ? p : null) ?? e).focus(), !0;
      }, y = (E) => {
        k() && n(E);
      }, b = (E = "aborted") => {
        k() && i(new Ae(E));
      };
      if (t.signal) {
        if (t.signal.aborted) {
          b();
          return;
        }
        t.signal.addEventListener("abort", () => b(), { once: !0 });
      }
      const v = I(this);
      if (t.kind === "approval") {
        const E = () => j.isComplete() && !j.el.hasAttribute("data-collapsed"), N = () => E() ? "submit" : "none", G = () => e.setPanelSubmitEnabled(E(), N()), j = nt(v, () => Jh(t.message, t.options ?? [], G, t.details, t.allowOther ?? !0));
        j.onSettle((tt) => y({ action: "accept", content: tt }));
        const X = Fr(j.el, j.dismiss, v, () => j.focus(), G);
        this._pending = {
          abort: () => b(),
          composer: e,
          relabel: () => {
            j.relabel(), X.relabel(I(this));
          }
        }, a.token = e.showPanel(j.el, {
          submitEnabled: j.isComplete(),
          mode: N(),
          onSubmit: () => {
            j.isComplete() && y({ action: "accept", content: j.getContent() });
          },
          onEvict: () => b()
        }), A(j, l());
        return;
      }
      const w = t.schema ?? { type: "string" }, T = () => {
        const E = S.el.hasAttribute("data-collapsed");
        e.setPanelSubmitEnabled(!E && S.canProceed(), E ? "none" : S.mode());
      }, S = nt(v, () => Xh(t.message, w, T)), x = document.createElement("button");
      x.type = "button", x.className = "aparte-btn aparte-elic-skip", x.textContent = v.t("elicitationSkip"), x.addEventListener("click", () => y({ action: "decline" })), S.dismiss.appendChild(x);
      const L = Fr(S.el, S.dismiss, v, () => S.focus(), T);
      S.onSettle((E) => y({ action: "accept", content: E })), this._pending = {
        abort: () => b(),
        composer: e,
        relabel: () => {
          S.relabel();
          const E = I(this);
          x.textContent = E.t("elicitationSkip"), L.relabel(E);
        }
      }, a.token = e.showPanel(S.el, {
        submitEnabled: S.canProceed(),
        mode: S.mode(),
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
          S.isComplete() && y({ action: "accept", content: S.getContent() });
        }
      }), A(S, l());
    }) : Promise.reject(new Ae("no-presenter"));
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
typeof customElements < "u" && !customElements.get("aparte-elicitation") && (V(Ur), customElements.define("aparte-elicitation", Ur));
function nl(s) {
  return !s.hasAttribute("loading") && !s.querySelector("aparte-chat-bubble");
}
class sl extends HTMLElement {
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
    this._render(), this._forwardAttr("placeholder"), this._forwardAttr("disabled"), this._forwardAttr("submit-on-enter"), this._forwardAttr("type-to-focus"), this._syncEmptyWatch(), this._syncLoadingWatch(), this._watchForViewport(), this._offGlide?.(), this._offGlide = Rh(this);
  }
  disconnectedCallback() {
    this._offGlide?.(), this._offGlide = null, this._observer?.disconnect(), this._observer = null, this._loadingObserver?.disconnect(), this._loadingObserver = null, this._childObserver?.disconnect(), this._childObserver = null;
  }
  attributeChangedCallback(t, e, n) {
    if (e === n) return;
    if (t === "attachments") {
      this._syncAttachments();
      return;
    }
    if (t === "type-to-focus") {
      const r = this.querySelector("aparte-composer");
      n !== null ? r?.setAttribute(t, n) : r?.removeAttribute(t);
      return;
    }
    if (t === "disabled" && n === null && this._gated) {
      this._gateOwns = !0;
      return;
    }
    const i = this.querySelector("aparte-composer");
    i && (n !== null ? i.setAttribute(t, n) : i.removeAttribute(t));
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
    const t = this.getAttribute("placeholder"), e = (t !== null ? ` placeholder="${O(t)}"` : "") + (this.hasAttribute("disabled") ? " disabled" : ""), n = this.hasAttribute("attachments");
    this.innerHTML = `
      <aparte-chat-viewport></aparte-chat-viewport>
      <aparte-elicitation></aparte-elicitation>
      <aparte-composer${e}>
        <div class="aparte-composer-shell">
          ${n ? "<aparte-composer-attachments></aparte-composer-attachments>" : ""}
          <div class="aparte-composer-row">
            ${n ? "<aparte-composer-add-attachment></aparte-composer-add-attachment>" : ""}
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
    const t = this.composer, e = t?.querySelector(".aparte-composer-shell"), n = e?.querySelector(".aparte-composer-row");
    if (!t || !e || !n) return;
    const i = e.querySelector("aparte-composer-attachments"), r = n.querySelector("aparte-composer-add-attachment");
    if (this.hasAttribute("attachments")) {
      i || e.insertBefore(document.createElement("aparte-composer-attachments"), n), r || n.insertBefore(document.createElement("aparte-composer-add-attachment"), n.firstChild);
      return;
    }
    i?.remove(), r?.remove(), t.clearAttachments();
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
    this.toggleAttribute("data-empty", !t || nl(t));
  }
}
V(sl);
customElements.get("aparte-chat") || customElements.define("aparte-chat", sl);
function pp(s, t, e) {
  let n = "other";
  try {
    n = new Intl.PluralRules(e).select(t);
  } catch {
  }
  const i = s.split("|"), r = (o) => i.find((l) => l.startsWith(`${o}:`)), a = r(n) ?? r("other") ?? s;
  return a.slice(a.indexOf(":") + 1).replace("{n}", String(t));
}
function fp(s, t) {
  const e = [];
  let n = -1, i = -1, r = 0;
  const a = () => {
    r >= 2 && e.push({ from: n, to: i }), n = -1, i = -1, r = 0;
  };
  return s.forEach((o, l) => {
    const c = t(o);
    c === "stop" ? a() : c === "fold" && (n < 0 && (n = l), i = l, r += 1);
  }), a(), e;
}
function Ze(s, t) {
  const e = `[data-segment-id="${ct(t)}"]`;
  return s.querySelector(`:scope > ${e}, :scope > .aparte-turn > .aparte-turn__body > ${e}`);
}
function gp(s) {
  let t = 1 / 0, e = -1 / 0;
  for (const n of s) {
    const { startedAt: i, endedAt: r } = Tn(n) ?? {};
    if (i == null || r == null) return;
    t = Math.min(t, i), e = Math.max(e, r);
  }
  return s.length > 0 ? e - t : void 0;
}
const _p = (s, t) => t ? s.split(t).length - 1 : 0;
function mp(s, t) {
  const e = s.createElement("span");
  e.className = "aparte-tag aparte-inline-token", t.kind && (e.dataset.kind = t.kind);
  const n = s.createElement("span");
  return n.className = "aparte-tag__label", n.textContent = t.label, e.appendChild(n), e;
}
function bp(s, t, e) {
  let n = _p(t.slice(0, e.start), e.text);
  const i = s.ownerDocument, r = i.createTreeWalker(s, NodeFilter.SHOW_TEXT);
  for (; r.nextNode(); ) {
    const a = r.currentNode;
    for (let o = a.data.indexOf(e.text); o >= 0; o = a.data.indexOf(e.text, o + e.text.length)) {
      if (n-- > 0) continue;
      const l = i.createRange();
      l.setStart(a, o), l.setEnd(a, o + e.text.length), l.deleteContents(), l.insertNode(mp(i, e));
      return;
    }
  }
}
function vp(s, t, e) {
  if (!s.querySelector(".aparte-inline-token"))
    for (const n of [...e].sort((i, r) => r.start - i.start))
      n.text && bp(s, t, n);
}
function Wr(s, t, e) {
  const n = document.createElement("button");
  return n.type = "button", n.className = `aparte-btn aparte-btn--sm ${t}`, n.textContent = s, n.addEventListener("click", e), n;
}
function yp(s) {
  const t = document.createElement("div");
  t.className = "aparte-feedback-reasons", t.setAttribute("role", "group"), t.setAttribute("aria-label", s.title);
  const e = document.createElement("span");
  e.textContent = s.title, t.appendChild(e);
  for (const n of s.reasons)
    t.appendChild(Wr(n, "aparte-btn--surface", () => s.onPick(n)));
  return t.appendChild(Wr(s.dismiss, "aparte-btn--ghost", s.onClose)), t;
}
const zr = (s) => !!s && typeof s.getMessages == "function" && typeof s.updateMessage == "function";
function wp(s) {
  const t = Rt(s);
  if (zr(t)) return t;
  const e = s.closest("aparte-chat-viewport");
  return zr(e) ? e : null;
}
function Sp(s, t) {
  const e = wp(s);
  if (!e) return 0;
  const n = e.getMessages().filter((r) => r.contextSummary !== void 0).map((r) => r.id);
  for (const r of n) e.updateMessage(r, { contextSummary: void 0 });
  const i = { restored: !0 };
  return t.messageId && (i.messageId = t.messageId), t.targetId && (i.targetId = t.targetId), window.dispatchEvent(new CustomEvent("aparte-compact-done", { detail: i })), n.length;
}
function Tt(s, t, e) {
  const n = document.createElement(s);
  return n.className = t, e !== void 0 && (n.textContent = e), n;
}
function pe(s, t) {
  const e = Tt("button", "aparte-btn aparte-btn--ghost aparte-btn--sm aparte-checkpoint__action", t);
  return e.type = "button", e.setAttribute("data-checkpoint-action", s), e;
}
function kp(s) {
  const { kind: t, locale: e } = s, n = Tt("div", "aparte-checkpoint");
  n.setAttribute("role", "group"), n.setAttribute("aria-label", e.checkpointGroup ?? "Context summary"), n.setAttribute("data-state", t);
  const i = Tt("div", "aparte-checkpoint__row aparte-divider aparte-divider--label"), r = Tt("div", "aparte-checkpoint__label");
  i.appendChild(r), n.appendChild(i);
  let a;
  if (t === "done") {
    const l = s.count ?? 0;
    a = l === 1 ? e.checkpointCountOne ?? "1 message summarised for the model" : (e.checkpointCount ?? "{n} messages summarised for the model").replace("{n}", () => String(l));
  } else t === "legacy" ? a = e.checkpointLegacy ?? "Earlier messages were summarised" : t === "pending" ? a = e.checkpointPending ?? "Summarising the context…" : a = e.checkpointFailed ?? "Couldn't summarise the context";
  const o = Tt("span", "aparte-checkpoint__text", a);
  if (t === "pending" ? (o.classList.add("aparte-shimmer"), o.setAttribute("role", "status")) : t === "failed" && (o.setAttribute("role", "status"), s.reason && (o.title = s.reason, o.appendChild(Tt("span", "aparte-sr-only", `: ${s.reason}`)))), r.appendChild(o), t === "done" || t === "legacy")
    if (s.confirming && t === "done") {
      const l = Tt("span", "aparte-checkpoint__confirm"), c = Tt("span", "aparte-checkpoint__question", e.checkpointRestoreConfirm ?? "Send the original messages to the model again?");
      c.id = `${s.summaryId}-question`;
      const d = pe("restore-confirm", e.checkpointRestore ?? "Restore");
      d.setAttribute("aria-describedby", c.id), l.append(c, d, pe("restore-cancel", e.cancel ?? "Cancel")), r.appendChild(l);
    } else {
      const l = pe("toggle", s.open ? e.checkpointHide ?? "Hide summary" : e.checkpointShow ?? "Show summary");
      l.setAttribute("aria-expanded", String(s.open)), l.setAttribute("aria-controls", s.summaryId), r.appendChild(l), t === "done" && r.appendChild(pe("restore", e.checkpointRestore ?? "Restore"));
    }
  else t === "failed" && r.appendChild(pe("retry", e.retry ?? "Retry"));
  if (t === "done" || t === "legacy") {
    const l = Tt("div", "aparte-checkpoint__summary aparte-segment-content");
    l.id = s.summaryId, s.open || (l.hidden = !0), n.appendChild(l);
  }
  return n;
}
let Gr = !1;
function Ap(s) {
  Gr || (Gr = !0, console.warn(`[aparte] No renderer for segment "${s}". Register one with registerSegmentRenderer({ type: '${s}', render }) from @aparte/core — see https://apartejs.dev/guides/customization/#custom-segment-types`));
}
function es(s) {
  const t = typeof s.fallback == "string" && s.fallback.trim() ? s.fallback : null;
  t || Ap(s.type);
  const e = document.createElement("div");
  return e.className = t ? "aparte-segment aparte-segment-fallback" : "aparte-segment aparte-segment-unknown", e.textContent = t ?? `[Unknown segment type: ${s.type}]`, e;
}
function Ht(s, t) {
  const e = mr(s, t);
  return e || (Du(t), mr(s, t));
}
function fe(s, t) {
  let e;
  if (s instanceof HTMLElement)
    e = s;
  else {
    const n = document.createElement("div");
    n.innerHTML = s, e = n.firstElementChild;
  }
  return e && t && !e.hasAttribute("data-segment-id") && e.setAttribute("data-segment-id", t.id), e;
}
const Ce = /* @__PURE__ */ new Map();
function Ep() {
  const s = [...Ce].filter(([e]) => !e.firstChild);
  Ce.clear();
  const t = s.map(([, { bubble: e, role: n }]) => {
    const i = getComputedStyle(e).getPropertyValue(`--aparte-avatar-image-${n}`).trim();
    return i !== "" && i !== "none";
  });
  s.forEach(([e], n) => e.toggleAttribute("data-image", t[n]));
}
let Cp = 0;
class il extends HTMLElement {
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
  _checkpointId = `aparte-checkpoint-${++Cp}`;
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
    e?.config && e.config !== this._cfg || (this._updateActionBar(), this._updateName(), this._updateLocalizedLabels(), this._updateWaiting(), this._updateFinishNote(), this._checkpointDrawn = "", this._updateCheckpoint(), this._renderAvatar(), this._redrawSegmentsWhoseRendererChanged(), this._relabelSegments(), nt(this._cfg, () => kd(this)), cu(this), this._syncSources(), this._updateTimestamp(this.getAttribute("timestamp")), this._redrawQueued || (this._redrawQueued = !0, queueMicrotask(() => {
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
    if (Ht("tool_call", e) !== ke) return null;
    const n = t.toolCall?.name;
    return !n || e.isToolHidden(n) ? null : e.getToolRenderer(n) ?? null;
  }
  /**
   * Record a segment as drawn, set it up, then read back which tool renderer is behind the
   * row (tool-call.ts records it as the row is set up — one record, not a second lookup).
   * Recorded BEFORE `setup`: a setup that throws (a framework mount) leaves an element that
   * will still be cleaned up. The same id drawn twice releases the first element.
   */
  _install(t, e, n, i = t) {
    const r = this._drawn.get(t.id);
    r && r.el !== e && this._release(t.id);
    const a = { el: e, renderer: n, tool: null, segment: t };
    this._drawn.set(t.id, a), this.isConnected || this._scheduleReleaseCheck(), n?.setup && nt(this._cfg, () => n.setup(e, i)), t.type === "tool_call" && (a.tool = pr(e));
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
    const n = e.renderer?.cleanup;
    if (n)
      try {
        nt(this._cfg, () => n.call(e.renderer, e.el, e.segment));
      } catch (i) {
        console.error("[aparte] a segment renderer's cleanup threw", i);
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
    const n = this._cfg, i = Ht(t.type, n), r = e.el;
    this._release(t.id);
    const a = i ? this._drawnAs(t) : t, o = i ? fe(nt(n, () => i.render(t)), t) : es(t);
    return o ? (r.replaceWith(o), this._install(t, o, i, a), !0) : (r.remove(), !0);
  }
  /** The renderer that drew this segment is still the one in effect (for a tool call, the tool renderer too). */
  _stillDrawnByCurrent(t, e) {
    return Ht(t.type, this._cfg) === e.renderer && this._toolRendererFor(t) === e.tool;
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
    t !== this._cfg && t !== lt || this._redrawSegmentsWhoseRendererChanged();
  };
  /**
   * A card a mounted renderer keeps (a framework component): its drawing reads none of the
   * providers a rendering-version bump announces, so it stays mounted through one — as long
   * as that renderer is still the one in effect.
   */
  _keepsItsDrawing(t, e) {
    return (xr(e.renderer) || t.type === "tool_call" && xr(e.tool)) && this._stillDrawnByCurrent(t, e);
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
    if (!(this._streaming || this._editing || yt(this._cfg) === this._drawnWithVersion)) {
      if (this._segments.length === 0) {
        this._updateContent();
        return;
      }
      if (this._segments.some((t) => !this._drawn.has(t.id))) {
        this._renderSegments();
        return;
      }
      this._drawnWithVersion = yt(this._cfg);
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
        const e = Ht(t.type, this._cfg);
        if (!e?.relabel) continue;
        const n = Ze(this._segmentsEl, t.id);
        n && nt(this._cfg, () => e.relabel(n, t));
      }
      this._syncTurns();
    }
  }
  /**
   * Re-apply the locale strings written straight into the markup by `_render()` —
   * the accessible names a screen reader reads, which nothing else refreshes.
   */
  _updateLocalizedLabels() {
    const t = this._cfg.getLocale(), e = (n, i) => {
      this.querySelector(n)?.setAttribute("aria-label", i);
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
    return I(this);
  }
  connectedCallback() {
    this._render(), this._updateContent(), this._updateTimestamp(this.getAttribute("timestamp")), this._releasedWhileDetached && (this._releasedWhileDetached = !1, this._segments.length > 0 && this._renderSegments()), window.addEventListener("aparte-config-change", this._onConfigChange), this._offRenderers ??= ih(this._onRenderersChange), this.addEventListener("click", this._onBranchPickerClick), this.addEventListener("click", this._onLinkClick), this.addEventListener("click", this._onCheckpointClick), this.addEventListener("keydown", this._onCheckpointKeydown);
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
  attributeChangedCallback(t, e, n) {
    if (e !== n)
      switch (t) {
        case "data-role":
          (n === "user" || n === "assistant") && (this._role = n, this._updateRole());
          break;
        case "content":
          this._content = n || "", this._resetMarkdownStream(), this._updateContent();
          break;
        case "timestamp":
          this._updateTimestamp(n);
          break;
        case "data-checkpoint":
          this._updateCheckpoint();
          break;
        case "data-checkpoint-reason":
          this.getAttribute("data-checkpoint") === "failed" && this._updateCheckpoint();
          break;
        case "streaming":
          this._updateStreaming(n !== null && n !== "false");
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
    const n = yp({
      reasons: e,
      title: this._cfg.t("feedbackReasonTitle"),
      dismiss: this._cfg.t("feedbackReasonDismiss"),
      onPick: (i) => {
        n.remove(), this.dispatchEvent(new CustomEvent("aparte-feedback-reason", {
          bubbles: !0,
          composed: !0,
          detail: { messageId: t, reason: i }
        }));
      },
      onClose: () => n.remove()
    });
    this.querySelector(".aparte-footer")?.after(n);
  }
  /** The tokens a user message was written with, drawn as they looked in the composer. */
  setTokens(t) {
    this._tokens = t, this._drawTokens();
  }
  _drawTokens() {
    this._contentEl && this._role === "user" && this._tokens?.length && vp(this._contentEl, this._content, this._tokens);
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
    const n = this._segments.flatMap((i) => i.type === "text" ? i.sources ?? [] : []);
    bu(e, t, n, this._cfg);
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
    if (!this._segmentsEl || t.length !== this._segments.length || t.some((n, i) => n.id !== this._segments[i].id || !this._drawn.has(n.id))) return !1;
    const e = new Set(t.filter((n) => this._keepsItsDrawing(n, this._drawn.get(n.id))).map((n) => n.id));
    if (e.size === 0) return !1;
    this._segments = t, this._drawnWithVersion = yt(this._cfg);
    for (const n of t)
      e.has(n.id) ? this._applySegmentUpdate(n.id, n, n) : this._redrawSegment(n);
    return this._syncTurns(), this._reflectError(), this._syncCopyAction(), !0;
  }
  /** Add a segment */
  addSegment(t) {
    this._segments.push(t), this._appendSegmentEl(t), this._syncTurns(), t.type === "text" && t.sources && this._syncSources(), this._updateWaiting();
  }
  /** Update a specific segment */
  updateSegment(t, e) {
    const n = this._segments.findIndex((i) => i.id === t);
    if (n !== -1) {
      const i = Fa(this._segments[n], e);
      this._segments[n] = i, i.isStreaming === !1 ? this._written.delete(t) : "content" in e && this._written.add(t), this._applySegmentUpdate(t, i, e), "sources" in e && this._syncSources(), this._syncCopyAction(), ("status" in e || "isStreaming" in e) && (this._syncTurns(), this._updateWaiting());
    }
  }
  /** Append content to a segment */
  appendToSegment(t, e) {
    const n = this._segments.find((i) => i.id === t);
    n && "content" in n && (n.content += e, n.isStreaming !== !1 && this._written.add(t), this._applySegmentUpdate(t, n, { content: n.content }), this._syncCopyAction());
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
      const e = this._segments.findIndex((r) => r.id === t), n = this._segments[e];
      if (!n || n.isStreaming === !1) continue;
      const i = { ...n, isStreaming: !1 };
      this._segments[e] = i, this._applySegmentUpdate(t, i, { isStreaming: !1 });
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
    const e = this._segments.findIndex((i) => i.id === t);
    e !== -1 && this._segments.splice(e, 1), this._release(t), (this._segmentsEl ? Ze(this._segmentsEl, t) : null)?.remove(), this._syncTurns(), this._syncSources(), this._updateWaiting(), this._syncCopyAction();
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
      const n = this.querySelector(".aparte-message-content");
      if (!n) return;
      e = document.createElement("div"), e.className = "aparte-finish-note", n.after(e);
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
    const n = this._checkpointKind();
    e.toggleAttribute("data-superseded", this._isLegacyCompaction() && !this._contextSummary);
    const i = this.querySelector(":scope > .aparte-checkpoint");
    if (!n) {
      const h = i && document.activeElement && i.contains(document.activeElement);
      i?.remove(), this._checkpointDrawn = "", h && (e.hasAttribute("tabindex") || e.setAttribute("tabindex", "-1"), e.focus({ preventScroll: !0 }));
      return;
    }
    const r = this.getAttribute("data-checkpoint-reason") ?? "", a = this._checkpointSummaryText(), o = JSON.stringify([
      n,
      this._contextSummary?.count,
      this._contextSummary?.createdAt,
      r,
      this._checkpointOpen,
      this._confirmingRestore,
      this._checkpointOpen ? a : ""
    ]);
    if (i && !t && o === this._checkpointDrawn) return;
    const l = document.activeElement, c = i && l && i.contains(l) ? l.getAttribute("data-checkpoint-action") : null, d = kp({
      kind: n,
      count: this._contextSummary?.count,
      reason: r,
      open: this._checkpointOpen,
      confirming: this._confirmingRestore,
      summaryId: this._checkpointId,
      locale: this._cfg.getLocale()
    });
    if (this._checkpointOpen && (n === "done" || n === "legacy")) {
      const h = d.querySelector(".aparte-checkpoint__summary");
      h && (h.innerHTML = this._cfg.renderMarkdown(a));
    }
    i ? i.replaceWith(d) : this.prepend(d), this._checkpointDrawn = o;
    const u = t ?? c;
    u && d.querySelector(`[data-checkpoint-action="${ct(u)}"]`)?.focus();
  }
  /**
   * The separator's buttons. One delegated listener on the bubble, for the reason the branch
   * picker has one: the separator is rebuilt on every change, and a listener per button would
   * be lost with it.
   */
  _onCheckpointClick = (t) => {
    const e = t.target?.closest?.("[data-checkpoint-action]"), n = e?.closest(".aparte-checkpoint");
    if (!(!e || !n || n.parentElement !== this) && !e.closest(".aparte-checkpoint__summary"))
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
          const i = this.getAttribute("message-id") ?? void 0;
          Sp(this, { messageId: i, targetId: this._resolveTargetId() }), this.setContextSummary(null);
          break;
        }
        case "retry": {
          const i = this._resolveTargetId(), r = this._cfg.getCompactor();
          r ? r.compact({ target: Rt(this), ...i ? { targetId: i } : {}, force: !0, reason: "retry" }) : window.dispatchEvent(new CustomEvent("aparte-compact", { detail: { targetId: i } }));
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
    this._segments.length === 1 && (this._drawnWithVersion = yt(this._cfg));
    const e = Ht(t.type, this._cfg);
    if (e) {
      const n = this._drawnAs(t, !0), i = fe(nt(this._cfg, () => e.render(t)), t);
      i && (this._segmentsEl.appendChild(i), this._install(t, i, e, n));
    } else {
      const n = es(t);
      this._segmentsEl.appendChild(n), this._install(t, n, void 0);
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
    const n = document.createElement("span");
    n.className = "aparte-turn__label";
    const i = document.createElement("span");
    i.className = "aparte-turn__current";
    const r = document.createElement("span");
    r.className = "aparte-accordion__icon", r.innerHTML = this._cfg.getIcon("expand"), e.append(n, i, r), e.addEventListener("click", () => {
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
    const e = this._cfg.getTurnSummary(), n = e ? fp(this._segments, (c) => this._turnRole(c)) : [];
    if (n.length === 0 && !t.querySelector(":scope > .aparte-turn")) return;
    const i = (c, d, u) => {
      const h = u ? u.nextSibling : c.firstChild;
      return d !== h && c.insertBefore(d, h), d;
    }, r = (c) => this._drawn.get(c.id)?.el, a = /* @__PURE__ */ new Set(), o = new Map(n.map((c) => [c.from, c]));
    let l = null;
    for (let c = 0; c < this._segments.length; c += 1) {
      const d = o.get(c);
      if (!d) {
        const g = r(this._segments[c]);
        g && (l = i(t, g, l));
        continue;
      }
      const u = this._segments.slice(d.from, d.to + 1), p = u.map((g) => this._turnHolding(r(g))).find((g) => g && !a.has(g)) ?? this._createTurn();
      a.add(p), l = i(t, p, l);
      const f = p.querySelector(":scope > .aparte-turn__body");
      let _ = null;
      for (const g of u) {
        const m = r(g);
        m && (_ = i(f, m, _));
      }
      this._labelTurn(p, u, d.to === this._segments.length - 1, e?.openWhileRunning === !0), c = d.to;
    }
    for (const c of t.querySelectorAll(":scope > .aparte-turn"))
      a.has(c) || c.remove();
  }
  /** The fold's one line: what it is doing while it works, what it did once it has. */
  _labelTurn(t, e, n, i) {
    const r = this._cfg, a = e.filter((u) => this._turnRole(u) === "fold"), o = a.filter((u) => u.type === "tool_call"), l = this._streaming && n || o.some((u) => !Wt(u)), c = t.querySelector(":scope > summary > .aparte-turn__label"), d = t.querySelector(":scope > summary > .aparte-turn__current");
    c.classList.toggle("aparte-shimmer", l), c.textContent = l ? r.t("turnWorking") : this._turnOutcome(a, o.length), d.textContent = l && o.length > 0 ? this._stepName(o.at(-1)) : "", i && !("touched" in t.dataset) && (t.open = l);
  }
  _turnOutcome(t, e) {
    const n = this._cfg, i = n.getLocale().tag || void 0, r = e > 0 ? pp(n.t("turnTools"), e, i) : "", a = gp(t);
    if (a !== void 0) {
      const o = n.t("turnWorked").replace("{duration}", () => po(a, i));
      return r ? `${o} · ${r}` : o;
    }
    return r ? n.t("turnUsed").replace("{tools}", () => r) : n.t("thought");
  }
  /** What a call goes by on screen: the label the app gave it, else its identifier. */
  _stepName(t) {
    const e = t.toolCall?.name ?? "", n = this._cfg.getToolDisplay(e)?.label;
    if (typeof n != "function") return n ?? e;
    try {
      return n(t);
    } catch {
      return e;
    }
  }
  _applySegmentUpdate(t, e, n) {
    const i = this._segmentsEl ? Ze(this._segmentsEl, t) : null;
    if (!i) {
      this._renderSegments();
      return;
    }
    if (this._releasedWhileDetached) return;
    const r = Ht(e.type, this._cfg);
    if (!r) return;
    const a = this._drawn.get(t);
    if (a && a.renderer !== r) {
      a.segment = e, this._redrawSegment(e);
      return;
    }
    if (r.update) {
      nt(this._cfg, () => r.update(i, e));
      const o = this._drawn.get(t);
      if (o) {
        o.segment = e;
        const l = this._segmentsEl ? Ze(this._segmentsEl, t) : null;
        l && l !== o.el && (o.el = l, o.tool = e.type === "tool_call" ? pr(l) : null);
      }
    } else {
      const o = fe(nt(this._cfg, () => r.render(e)), e);
      o && (this._release(t), i.replaceWith(o), this._install(e, o, r));
    }
    "collapsed" in n && (n.collapsed ? i.removeAttribute("open") : i.setAttribute("open", ""));
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
    const n = this._getDisplayName(), i = this._getAvatarInitial(), r = this._cfg.getBubbleShellRenderer?.();
    if (this._drawnShell = r ?? null, this._avatarFromProvider = !1, this._wroteRootLabel = this._wroteBarLabel = this._wroteArrowLabels = !r, r) {
      const o = nt(this._cfg, () => r({ role: this._role, name: n, avatarInitial: i }));
      o instanceof HTMLElement ? this.replaceChildren(o) : this.innerHTML = o;
    } else
      this.innerHTML = `
      <div class="aparte-message" data-role="${O(e)}" role="article" aria-label="${O(this._getAriaLabel())}">
        <div class="aparte-avatar" data-role="${O(e)}"></div>
        <div class="aparte-body">
          <div class="aparte-header">
            <span class="aparte-name">${$(n)}</span>
            <span class="aparte-timestamp"></span>
          </div>
          <div class="aparte-attachments" hidden></div>
          <div class="aparte-message-content">
            <div class="aparte-segments"></div>
            <div class="aparte-content" dir="auto"></div>
            <div class="aparte-waiting" hidden>
              <span class="aparte-dots" aria-hidden="true"><span class="aparte-dot"></span><span class="aparte-dot"></span><span class="aparte-dot"></span></span>
              <span class="aparte-sr-only"></span>
            </div>
          </div>
          <div class="aparte-footer">
            <div class="aparte-branch-picker" hidden>
              <button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-branch-prev" aria-label="${O(this._cfg.getLocale().previousResponse ?? "Previous response")}">${this._cfg.getIcon("prevBranch")}</button>
              <span class="aparte-branch-label">1 / 1</span>
              <!-- The move has to be ANNOUNCED. Pressing the arrows deliberately does not
                   take focus, so without a live region a screen-reader user gets the new
                   branch and no indication anything changed. The visible label cannot be
                   the region itself: a custom sibling-nav renderer may replace it with
                   dots, which reads as nothing. No new locale key — the position is
                   digits, and the buttons beside it already carry translated labels. -->
              <span class="aparte-sr-only aparte-branch-status" aria-live="polite"></span>
              <button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-branch-next" aria-label="${O(this._cfg.getLocale().nextResponse ?? "Next response")}">${this._cfg.getIcon("nextBranch")}</button>
            </div>
            <div class="aparte-action-bar" role="toolbar" aria-label="${O(this._cfg.getLocale().messageActions ?? "Message actions")}"></div>
          </div>
        </div>
      </div>
    `;
    const a = this.querySelector(".aparte-message");
    if (a && !a.hasAttribute("role") && (a.setAttribute("role", "article"), a.setAttribute("aria-label", this._getAriaLabel()), this._wroteRootLabel = !0), this._contentEl = this.querySelector(".aparte-content"), this._segmentsEl = this.querySelector(".aparte-segments"), this._attachmentsEl = this.querySelector(".aparte-attachments"), this._actionBarEl = this.querySelector(".aparte-action-bar"), this._actionBarEl && !this._actionBarEl.hasAttribute("role") && (this._actionBarEl.setAttribute("role", "toolbar"), this._actionBarEl.hasAttribute("aria-label") || (this._actionBarEl.setAttribute("aria-label", this._cfg.getLocale().messageActions ?? "Message actions"), this._wroteBarLabel = !0)), r) {
      const o = this.querySelector(".aparte-branch-prev"), l = this.querySelector(".aparte-branch-next"), c = (u) => {
        let h = "";
        const p = u.ownerDocument.createTreeWalker(u, NodeFilter.SHOW_TEXT);
        for (let f = p.nextNode(); f; f = p.nextNode()) {
          const _ = f.parentElement?.closest('[aria-hidden="true"], [hidden]');
          (!_ || !u.contains(_)) && (h += f.textContent ?? "");
        }
        return h;
      }, d = (u) => !!u && (u.hasAttribute("aria-label") || u.hasAttribute("aria-labelledby") || u.hasAttribute("title") || /\p{L}/u.test(c(u)));
      if ((o || l) && !d(o) && !d(l)) {
        const u = this._cfg.getLocale();
        o?.setAttribute("aria-label", u.previousResponse ?? "Previous response"), l?.setAttribute("aria-label", u.nextResponse ?? "Next response"), this._wroteArrowLabels = !0;
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
    const e = !(this._segmentsEl ? Array.from(this._segmentsEl.children).some((p) => !p.hidden) : this._segments.length > 0) && !this._content.trim(), n = this._segments.at(-1), i = this._segmentsEl?.lastElementChild, r = n?.type === "tool_call" && n.status === "awaiting-approval", a = n?.type === "tool_call" && (Wt(n) || i?.hidden === !0) && i?.classList.contains("aparte-turn") !== !0, o = this._streaming && this._role !== "user" && !r && (e || a), l = this.querySelector(".aparte-message-content");
    l && (l.hidden = e && !o);
    const c = this.querySelector(".aparte-message");
    c && c.toggleAttribute("data-empty", e && !this._streaming && this._attachments.length === 0);
    const d = this.querySelector(".aparte-waiting");
    if (!d || (d.hidden = !o, !o)) return;
    const u = this._cfg.getLocale().typing, h = d.querySelector(".aparte-sr-only");
    h && h.textContent !== u && (h.textContent = u);
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
    const n = e.render(this._role, t);
    this._avatarFromProvider = !0, typeof n == "function" && (this._avatarCleanup = n), this._markAvatarImage(t);
  }
  /**
   * A picture from the stylesheet alone: an empty slot whose role's `--aparte-avatar-image-*`
   * names an image gets `data-image`, which lifts the rule that hides an empty slot. Hidden
   * while empty, the token painted nothing. Read when the message is drawn and on every
   * config change, in a batch with the other bubbles' (see `pendingAvatarMarks`).
   */
  _markAvatarImage(t) {
    if (t.firstChild) {
      Ce.delete(t), t.removeAttribute("data-image");
      return;
    }
    Ce.size === 0 && queueMicrotask(Ep), Ce.set(t, { bubble: this, role: this._role });
  }
  _updateRole() {
    const t = this.querySelector(".aparte-message"), e = this.querySelector(".aparte-avatar"), n = this.querySelector(".aparte-name");
    t && (t.setAttribute("data-role", this._role), this._wroteRootLabel && t.getAttribute("role") === "article" && t.setAttribute("aria-label", this._getAriaLabel())), e && (e.setAttribute("data-role", this._role), e.textContent && !this._avatarFromProvider && (e.textContent = this._getAvatarInitial())), n && (n.textContent = this._getDisplayName()), this._updateActionBar(), this._renderAvatar();
  }
  _updateName() {
    const t = this.querySelector(".aparte-avatar"), e = this.querySelector(".aparte-name");
    t && t.textContent && !this._cfg.getAvatarProvider() && !this._avatarFromProvider && (t.textContent = this._getAvatarInitial()), e && (e.textContent = this._getDisplayName());
    const n = this.querySelector(".aparte-message");
    this._wroteRootLabel && n?.getAttribute("role") === "article" && n.setAttribute("aria-label", this._getAriaLabel());
  }
  _updateContent() {
    if (this._contentEl) {
      if (this._segments.length > 0) {
        this._contentEl.style.display = "none", this._updateWaiting();
        return;
      }
      this._drawnWithVersion = yt(this._cfg), this._contentEl.style.display = "", nt(
        this._cfg,
        () => Re(this, this._contentEl, this._content, this._streaming)
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
      const i = t.className.match(/language-([\w+#-]+)/i)?.[1] ?? "";
      if (this._cfg.hasCodeLanguageRenderer(i) || t.closest(".aparte-code-drawing")) return;
      const r = t.parentElement;
      t.setAttribute("data-aparte-highlighted", ""), Promise.resolve(this._cfg.highlightCode(e, i, { fallback: !1 })).then((a) => {
        const o = (a ?? "").trim();
        !o || !r || !this._contentEl?.contains(r) || (/^<pre[\s>]/i.test(o) ? ho(r, o) : t.innerHTML = o);
      }).catch(() => {
        t.removeAttribute("data-aparte-highlighted");
      });
    });
  }
  _renderSegments() {
    if (this._segmentsEl) {
      this._drawnWithVersion = yt(this._cfg), this._releaseAll(), this._segmentsEl.innerHTML = "";
      for (const t of this._segments) {
        const e = Ht(t.type, this._cfg);
        if (e) {
          const n = this._drawnAs(t), i = fe(nt(this._cfg, () => e.render(t)), t);
          i && (this._segmentsEl.appendChild(i), this._install(t, i, e, n));
        } else {
          const n = es(t);
          this._segmentsEl.appendChild(n), this._install(t, n, void 0);
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
    this._segments.some((n) => n.type === "error") ? t.setAttribute("data-error", "") : t.removeAttribute("data-error");
  }
  _updateTimestamp(t) {
    const e = this.querySelector(".aparte-timestamp");
    if (!(!e || !t))
      try {
        const n = new Date(isNaN(Number(t)) ? t : Number(t));
        e.textContent = n.toLocaleTimeString(this._cfg.getLocale().tag || void 0, {
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
      for (const r of this._attachments) {
        const a = fe(nt(this._cfg, () => t(r)));
        a && this._attachmentsEl.appendChild(a);
      }
      return;
    }
    this._attachmentsEl.innerHTML = this._attachments.map((r) => {
      const a = $(r.name);
      if (r.type.startsWith("image/") && this._isShowableUrl(r.url))
        return `<div class="aparte-thumbnail aparte-thumb aparte-thumb--image" title="${a}" data-type="${$(r.type)}"><img class="aparte-thumbnail__image" src="${$(r.url)}" alt="${a}" loading="lazy" /><span class="aparte-thumb__name">${a}</span></div>`;
      const o = this._isOpenableUrl(r.url) ? ` data-url="${$(r.url)}"` : "";
      return `<div class="aparte-thumbnail aparte-thumb aparte-thumb--file" title="${a}" data-type="${$(r.type)}"${o}><span class="aparte-thumbnail__label">${$(this._fileExt(r.name))}</span><span class="aparte-thumb__name">${a}</span></div>`;
    }).join("");
    const { attachmentPreview: e, filePreview: n } = this._cfg.getHostHandlers(), i = [e ? ".aparte-thumb--image" : "", n ? ".aparte-thumb--file[data-url]" : ""].filter(Boolean);
    i.length !== 0 && this._attachmentsEl.querySelectorAll(i.join(", ")).forEach((r) => {
      r.setAttribute("role", "button"), r.setAttribute("tabindex", "0");
      const a = () => {
        const o = r.querySelector(".aparte-thumbnail__image")?.src ?? r.dataset.url;
        o && this.dispatchEvent(new CustomEvent("aparte-attachment-preview", {
          bubbles: !0,
          composed: !0,
          detail: { url: o, name: r.getAttribute("title") ?? "", type: r.dataset.type ?? "" }
        }));
      };
      r.addEventListener("click", a), r.addEventListener("keydown", (o) => {
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
    return t ? Rn(t, "img") || /^blob:/i.test(t.trim()) : !1;
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
    const n = t.target?.closest?.(".aparte-branch-prev, .aparte-branch-next");
    if (!n || !this.contains(n)) return;
    const i = n.classList.contains("aparte-branch-prev") ? "prev" : "next", r = this.getAttribute("message-id");
    if (!r) return;
    const a = { messageId: r, direction: i };
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
    const n = t.target?.closest?.("a[href]");
    if (!n || !this.contains(n)) return;
    const i = {
      href: n.getAttribute("href") ?? "",
      anchor: n,
      messageId: this.getAttribute("message-id")
    };
    this.dispatchEvent(new CustomEvent("aparte-link-click", {
      bubbles: !0,
      composed: !0,
      cancelable: !0,
      detail: i
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
      const r = this._cfg.getSiblingNavRenderer?.();
      if (r) {
        const a = nt(this._cfg, () => r({ count: this._siblingCount, index: this._siblingIndex }));
        a instanceof HTMLElement ? t.replaceChildren(a) : t.innerHTML = a;
      } else
        t.textContent = `${this._siblingIndex + 1} / ${this._siblingCount}`;
    }
    const e = this._branchPickerEl.querySelector(".aparte-branch-status");
    if (e) {
      const r = `${this._siblingIndex + 1} / ${this._siblingCount}`;
      e.textContent !== r && (e.textContent = r);
    }
    const n = this._branchPickerEl.querySelector(".aparte-branch-prev"), i = this._branchPickerEl.querySelector(".aparte-branch-next");
    n && (n.disabled = this._transcriptBusy || this._siblingIndex === 0), i && (i.disabled = this._transcriptBusy || this._siblingIndex === this._siblingCount - 1);
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
    return (this._content || this._segments.filter((t) => t.type !== "thinking").map((t) => t.content ?? "").join(`
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
    const t = this._cfg.getBubbleActions(), e = this._cfg.getIconProvider(), n = this._cfg.getLocale(), i = [];
    if (this._role === "user")
      if (t.user)
        for (const r of t.user) i.push(this._actionButtonHtml(r, e, n));
      else
        t.copy && i.push(this._actionButtonHtml("copy", e, n)), t.edit && i.push(this._actionButtonHtml("edit", e, n));
    else if (this._role === "assistant")
      if (t.assistant)
        for (const r of t.assistant) i.push(this._actionButtonHtml(r, e, n));
      else
        t.copy && i.push(this._actionButtonHtml("copy", e, n)), t.retry && i.push(this._actionButtonHtml("retry", e, n)), t.feedback && (i.push(this._actionButtonHtml("thumbUp", e, n)), i.push(this._actionButtonHtml("thumbDown", e, n))), t.info && i.push(this._actionButtonHtml("info", e, n));
    this._actionBarEl.innerHTML = i.join(""), this._syncCopyAction(), this._appendCustomActions(), this._applyTranscriptBusy(), this._actionBarEl.querySelectorAll(".aparte-action-btn").forEach((r) => {
      r.addEventListener("click", (a) => this._handleActionClick(a));
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
    const e = t.filter((r) => !r.disabled), i = t.find((r) => r.tabIndex === 0 && !r.disabled) ?? e[0] ?? t[0];
    for (const r of t) r.tabIndex = r === i ? 0 : -1;
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
    const i = this._rovingButtons().filter((d) => !d.disabled);
    if (i.length === 0) return;
    const r = document.activeElement, a = i.findIndex((d) => d === r);
    if (a === -1 && e.key !== "Home" && e.key !== "End") return;
    const l = (this.closest("[dir]")?.getAttribute("dir") ?? document.documentElement.dir) === "rtl" ? "ArrowLeft" : "ArrowRight";
    let c;
    e.key === "Home" ? c = 0 : e.key === "End" ? c = i.length - 1 : e.key === l ? c = (a + 1) % i.length : c = (a - 1 + i.length) % i.length, e.preventDefault();
    for (const d of this._rovingButtons()) d.tabIndex = d === i[c] ? 0 : -1;
    i[c]?.focus();
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
        const n = document.createElement("button");
        n.type = "button", n.className = "aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-custom", n.dataset.action = `custom:${t.id}`, n.setAttribute("aria-label", t.label), n.setAttribute("title", t.label), n.innerHTML = t.icon.startsWith("<") ? t.icon : this._cfg.getIcon(t.icon) ?? t.iconFallback ?? "", this._actionBarEl.appendChild(n);
      }
  }
  /** Build the `<button>` HTML for a single named action (shared by flag + per-role rendering). */
  _actionButtonHtml(t, e, n) {
    switch (t) {
      case "copy": {
        const i = n.copy ?? "Copy";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-copy" data-action="copy" aria-label="${O(i)}" title="${O(i)}">${e.copy()}</button>`;
      }
      case "edit": {
        const i = n.edit ?? "Edit message";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-edit" data-action="edit" aria-label="${O(i)}" title="${O(i)}">${e.edit()}</button>`;
      }
      case "retry": {
        const i = n.retry ?? "Retry";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-retry" data-action="retry" aria-label="${O(i)}" title="${O(i)}">${e.retry()}</button>`;
      }
      case "thumbUp": {
        const i = n.feedbackPositive ?? "Good response";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-feedback-pos" data-action="feedback-positive" aria-label="${O(i)}" title="${O(i)}">${e.thumbUp()}</button>`;
      }
      case "thumbDown": {
        const i = n.feedbackNegative ?? "Bad response";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-feedback-neg" data-action="feedback-negative" aria-label="${O(i)}" title="${O(i)}">${e.thumbDown()}</button>`;
      }
      case "info": {
        if (!this._usage) return "";
        const i = n.messageInfo ?? "Details";
        return `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-action-btn aparte-action-info" data-action="info" aria-label="${O(i)}" title="${O(i)}">${this._cfg.getIcon("info")}</button>`;
      }
      default:
        return "";
    }
  }
  /** Render the edit-mode action bar: ✓ save (green) + ✗ cancel (red). */
  _renderEditActions() {
    if (!this._actionBarEl) return;
    const t = this._cfg.getLocale(), e = t.editConfirm ?? "Save", n = t.editCancel ?? "Cancel";
    this._actionBarEl.innerHTML = `<button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-btn--success aparte-action-btn aparte-action-edit-save" data-action="edit-save" aria-label="${O(e)}" title="${O(e)}">${this._cfg.getIcon("check")}</button><button type="button" class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-btn--danger aparte-action-btn aparte-action-edit-cancel" data-action="edit-cancel" aria-label="${O(n)}" title="${O(n)}">${this._cfg.getIcon("close")}</button>`, this._actionBarEl.querySelectorAll(".aparte-action-btn").forEach((i) => {
      i.addEventListener("click", (r) => this._handleActionClick(r));
    }), this._syncFooterVisibility();
  }
  _handleActionClick(t) {
    const e = t.currentTarget, n = e.dataset.action, i = this.getAttribute("message-id");
    if (n?.startsWith("custom:") && i) {
      const r = n.slice(7), a = {
        actionId: r,
        zone: "bubble",
        messageId: i,
        role: this._role,
        targetId: this._resolveTargetId()
      };
      this.dispatchEvent(new CustomEvent("aparte-action", {
        bubbles: !0,
        composed: !0,
        detail: a
      })), this._cfg.getActions("bubble").find((o) => o.id === r)?.onClick?.(t);
      return;
    }
    switch (n) {
      case "copy": {
        const r = this._copyableText(), a = this._cfg.getIconProvider(), o = this._cfg.getLocale();
        fo(r).then(() => {
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
        if (!i) break;
        const r = this._resolveTargetId(), a = { messageId: i, targetId: r };
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
        if (!i) break;
        const r = n === "feedback-positive" ? "positive" : "negative";
        e.setAttribute("data-submitted", "");
        const a = { messageId: i, value: r };
        this.dispatchEvent(new CustomEvent("aparte-feedback", {
          bubbles: !0,
          composed: !0,
          detail: a
        })), r === "negative" ? this._askFeedbackReason(i) : this.querySelector(".aparte-feedback-reasons")?.remove();
        break;
      }
      case "info": {
        if (!i) break;
        const r = {
          messageId: i,
          usage: this._usage ?? void 0
        };
        this.dispatchEvent(new CustomEvent("aparte-message-info", {
          bubbles: !0,
          composed: !0,
          detail: r
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
    e.setAttribute("placeholder", this._cfg.getLocale().edit ?? "Edit message"), this._editInput = e, this._contentEl.style.display = "none", this._contentEl.insertAdjacentElement("afterend", e), e.setValue(this._content), e.addEventListener("aparte-composer-submit", () => this._exitEditMode(!0)), e.addEventListener("keydown", (n) => {
      n.key === "Escape" && !n.isComposing && (n.preventDefault(), this._exitEditMode(!1));
    }), this._updateActionBar(), e.focusEnd();
  }
  /**
   * Leave edit mode. When `save` is true and the text actually changed, emits
   * `aparte-edit`; otherwise restores the original message untouched. Always
   * restores the normal action bar and removes the inline editor.
   */
  _exitEditMode(t) {
    if (!this._editing) return;
    const e = this._editInput?.getValue() ?? "", n = this._content;
    this._editInput?.remove(), this._editInput = null, this._contentEl && (this._contentEl.style.display = ""), this.querySelector(".aparte-message")?.removeAttribute("data-editing"), this._editing = !1, this._redrawFrameIfChanged(), this._redrawIfStale(), this._updateActionBar();
    const i = this._editReturnAction;
    if (this._editReturnAction = null, i && this._actionBarEl) {
      const r = Array.from(this._actionBarEl.querySelectorAll("[data-action]")).find((o) => o.getAttribute("data-action") === i), a = r && !r.disabled ? r : this._actionBarEl.querySelector("button:not([disabled])");
      if (a) {
        for (const o of this._rovingButtons()) o.tabIndex = o === a ? 0 : -1;
        a.focus();
      }
    }
    if (t && e && e !== n) {
      const r = this.getAttribute("message-id");
      if (r) {
        const a = {
          messageId: r,
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
    this._streaming = t;
    const n = this.querySelector(".aparte-message");
    n && (n.setAttribute("data-streaming", String(t)), t ? (n.setAttribute("aria-busy", "true"), n.classList.add("aparte-message-streaming")) : (n.removeAttribute("aria-busy"), n.classList.remove("aparte-message-streaming")), n.toggleAttribute("data-caret", t && this._cfg.getStreamingCaret())), this._updateWaiting(), this._updateFinishNote(), e && !t && this._updateContent(), e && !t && this._settleWrittenSegments(), e && !t && this._segments.length > 0 && this._redrawIfStale(), this._syncTurns();
  }
}
V(il);
customElements.get("aparte-chat-bubble") || customElements.define("aparte-chat-bubble", il);
class rl extends HTMLElement {
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
    return I(this);
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
  attributeChangedCallback(t, e, n) {
    if (e !== n)
      switch (t) {
        case "visible":
          this._updateVisibility(n !== null);
          break;
        case "text":
          this._updateText(n);
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
    const n = this._cfg?.getStatusRenderer?.();
    if (n) {
      this.innerHTML = `<div class="aparte-message aparte-status-container" data-visible="${e}" role="status" aria-live="polite"></div>`;
      const i = this.querySelector(".aparte-status-container");
      i.setAttribute("aria-label", t);
      const r = nt(this._cfg, () => n(t));
      r instanceof HTMLElement ? i.appendChild(r) : i.innerHTML = r;
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
    const e = t || null, n = this.querySelector(".aparte-status-text");
    n && (n.textContent = e ?? ""), this._syncLiveWord();
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
    const n = this._cfg?.getStatusRenderer?.();
    if (n) {
      const i = t || this._word();
      e.setAttribute("aria-label", i);
      const r = nt(this._cfg, () => n(i));
      r instanceof HTMLElement ? e.replaceChildren(r) : e.innerHTML = r;
      return;
    }
    this._writeText(t), e.setAttribute("aria-label", t || this._word());
  }
}
V(rl);
customElements.get("aparte-chat-status") || customElements.define("aparte-chat-status", rl);
function jr(s, t) {
  if (s.role !== "assistant" || s.segments?.length || typeof s.content != "string" || !s.content.trim()) return s;
  const e = Kc(s.content, { blocks: t });
  return e.length <= 1 && e.every((i) => i.type === "text") ? s : $s({ ...s, segments: e });
}
function $s(s) {
  return Object.defineProperty(s, ti, { value: !0, enumerable: !1 }), s;
}
function Kr(s) {
  return s[ti] === !0;
}
function xp(s, t) {
  try {
    return new Intl.DateTimeFormat(t || void 0, { dateStyle: "long" }).format(s);
  } catch {
    return s.toDateString();
  }
}
class al extends HTMLElement {
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
  _repo = new rp();
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
    this.toggleAttribute("loading", st(t));
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
    const n = t.querySelector(":scope > .aparte-viewport-loading");
    if (!e) {
      n?.remove(), t.querySelector(":scope > .aparte-viewport-loading-status")?.remove();
      return;
    }
    if (n) return;
    const i = I(this), r = document.createElement("div");
    r.className = "aparte-viewport-loading", r.setAttribute("aria-hidden", "true"), r.innerHTML = '<span class="aparte-skeleton aparte-skeleton--rect aparte-viewport-loading__user"></span><span class="aparte-skeleton aparte-skeleton--text"></span><span class="aparte-skeleton aparte-skeleton--text"></span><span class="aparte-skeleton aparte-skeleton--text"></span><span class="aparte-skeleton aparte-skeleton--text aparte-viewport-loading__last"></span>';
    const a = document.createElement("span");
    a.className = "aparte-viewport-loading-status aparte-sr-only", a.setAttribute("role", "status"), t.prepend(r, a);
    const o = () => {
      a.isConnected && (a.textContent = i.t("loadingConversation"));
    };
    typeof requestAnimationFrame == "function" ? requestAnimationFrame(o) : o();
  }
  constructor() {
    super(), this._handleScroll = this._handleScroll.bind(this), this._handleScrollEnd = this._handleScrollEnd.bind(this);
  }
  connectedCallback() {
    this.hasAttribute("framework-managed") && (this._frameworkManagedDOM = !0), this._render(), this._setupEventListeners(), this._setupObservers(), this._updateTranscriptInset(), this._boundResetHandler = () => this.clearAll(), window.addEventListener("aparte-reset", this._boundResetHandler), window.addEventListener("aparte-config-change", this._onConfigChange), this._checkpointState ??= new Lh({
      // A bare `<aparte-chat-viewport id="…">` with no named host around it is its own
      // chat: the client names its events with that id (`_targetIdOf` falls back to the
      // element's own), so the watcher answers to it too, or every event is someone else's.
      ownId: () => Mh(this) ?? (this.id || void 0),
      bubbleOf: (t) => this.querySelector(`aparte-chat-bubble[message-id="${ct(t)}"]`),
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
    if (e?.config && e.config !== I(this)) return;
    this._applyDirection(), this._scrollBtn?.setAttribute("aria-label", I(this).t("scrollToBottom")), (this._frameworkManagedDOM ? this : this.querySelector(".aparte-viewport-container"))?.setAttribute("aria-label", I(this).t("transcript")), this._syncDateSeparators();
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
    t.setAttribute("tabindex", "0"), t.hasAttribute("role") || t.setAttribute("role", "log"), t.setAttribute("aria-label", I(this).t("transcript"));
  }
  /**
   * Mirror `locale.direction` onto the scroll surface: the container, or the viewport itself
   * when a framework renders the messages — a wrapper's transcript stayed left to right
   * under a right-to-left locale while its composer turned.
   */
  _applyDirection() {
    const t = this._frameworkManagedDOM ? this : this.querySelector(".aparte-viewport-container");
    if (!t) return;
    const e = I(this).getLocale().direction;
    e ? t.setAttribute("dir", e) : t.removeAttribute("dir");
  }
  disconnectedCallback() {
    window.removeEventListener("aparte-config-change", this._onConfigChange), this._boundResetHandler && (window.removeEventListener("aparte-reset", this._boundResetHandler), this._boundResetHandler = null), this._stopCheckpointState?.(), this._stopCheckpointState = null, this._cleanup();
  }
  attributeChangedCallback(t, e, n) {
    if (e !== n)
      switch (t) {
        case "scroll-threshold":
          this._scrollThreshold = parseInt(n || "50", 10);
          break;
        case "max-rendered-bubbles":
          this._maxRenderedBubbles = parseInt(n || "1000", 10), this._pruneRenderedBubbles();
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
    const n = this._getOrCreateMessage(t);
    n.content = (n.content || "") + e, this._notifyBubble(t, "appendToken", e), this._autoScroll(), this._scheduleSpacerUpdate();
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
  appendToSegment(t, e, n) {
    const i = this._getOrCreateMessage(t);
    i.segments || (i.segments = []);
    const r = i.segments.findIndex((o) => o.id === e), a = r === -1 ? void 0 : i.segments[r];
    a && "content" in a && (i.segments[r] = {
      ...a,
      content: a.content + n,
      // Content arriving IS the segment's activity, so this is what
      // `endedAt` measures. Without it a thinking block's end would be
      // whenever someone happened to notice it had stopped — the end of
      // the turn, or the start of the next segment — and both of those
      // silently fold the waiting that followed into the duration.
      ...nd(a)
    }), this.dispatchEvent(new CustomEvent("aparte-segment-update", {
      bubbles: !0,
      composed: !0,
      detail: { messageId: t, segmentId: e, content: n, append: !0 }
    })), this._notifyBubble(t, "appendToSegment", n, e), this._autoScroll();
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
    for (const n of this._repo.getAllMessages())
      if (n.isStreaming) {
        if (n.id !== t) return n.id;
        e = n.id;
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
    const n = typeof t == "string" ? t : this._activeMessageId(), i = typeof t == "string" ? e : t;
    if (!n || !i) return;
    const r = this._getOrCreateMessage(n);
    r.segments || (r.segments = []);
    const a = Ii(
      r.segments,
      i,
      n,
      // THIS chat's defaults, not the page's: two chats on one page can be
      // configured differently, and the config seam is per instance.
      I(this).getSegmentDefaults(i.type)
    );
    r.segments.push(a), this._notifyBubble(n, "addSegment", a), this._autoScroll();
  }
  updateSegment(t, e, n) {
    const i = n === void 0 && typeof e == "object", r = i ? this._activeMessageId() : t, a = i ? t : e, o = i ? e : n;
    if (!r) return;
    const l = this._repo.getMessageById(r);
    if (!l?.segments) return;
    const c = l.segments.findIndex((d) => d.id === a);
    if (c !== -1) {
      const d = l.segments[c], u = td(d, o);
      l.segments[c] = Fa(d, u), this._notifyBubble(r, "updateSegment", { segmentId: a, updates: u });
    }
  }
  removeSegment(t, e) {
    const n = e === void 0, i = n ? this._activeMessageId() : t, r = n ? t : e;
    if (!i || !r) return;
    const a = this._repo.getMessageById(i);
    if (a?.segments) {
      const o = a.segments.findIndex((l) => l.id === r);
      o !== -1 && (a.segments.splice(o, 1), id(a.segments));
    }
    this._notifyBubble(i, "removeSegment", r);
  }
  /**
   * Start a new streaming segment (e.g., thinking or code block)
   * Creates the segment and marks it as streaming
   */
  startSegment(t, e) {
    const n = { ...e, isStreaming: !0 };
    this.addSegment(t, n);
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
    const n = this._repo.getMessageById(t);
    n && (n.usage = e), this._notifyBubble(t, "setUsage", e);
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
      for (const n of sd(e.segments))
        this.updateSegment(t, n, { isStreaming: !1 });
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
    const n = this._repo.getMessageById(t);
    n && (Object.assign(n, e), e.status && (n.isStreaming = e.status === "streaming" || e.status === "pending", Ua(e.status) && this._settleSegments(t, n)), this._notifyBubble(t, "update", e), e.status && this._syncBusy(), this._autoScroll());
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
    const e = nn({ ...t });
    ue(t) && (e.isStreaming = !0), this._repo.addOrUpdateMessage(this._repo.headId, e), this._pruneRenderedBubbles(), this._syncBusy(), this._autoScroll();
  }
  /**
   * Append a new message and create its bubble in the DOM.
   * Implements the same contract as the Angular wrapper's appendMessage(),
   * making aparte-chat-viewport a fully standalone target for aparte-client.
   * When `_frameworkManagedDOM` is true, only the internal repo is updated —
   * the framework owns the DOM and will create the bubble element itself.
   */
  appendMessage(t, e) {
    t = jr(t, I(this).getStreamBlocks());
    const n = e?.historical ? nn(t) : t.segments?.length ? { ...t, segments: t.segments.reduce(
      (i, r) => (i.push(Ii(
        i,
        r,
        t.id,
        I(this).getSegmentDefaults(r.type)
      )), i),
      []
    ) } : { ...t };
    if (!e?.historical && ue(t) && (n.isStreaming = !0), Kr(t) && $s(n), this._repo.addOrUpdateMessage(this._repo.headId, n), !this._frameworkManagedDOM) {
      const i = this.querySelector(".aparte-messages-wrapper");
      if (i) {
        const r = document.createElement("aparte-chat-bubble");
        r.setAttribute("message-id", t.id), r.setAttribute("data-role", t.role), t.compaction && r.setAttribute("data-kind", "compaction"), t.timestamp && r.setAttribute("timestamp", String(t.timestamp)), t.content && r.setAttribute("content", t.content), ue(t) && r.setAttribute("streaming", ""), this._bottomSpacer && this._bottomSpacer.parentNode === i ? i.insertBefore(r, this._bottomSpacer) : i.appendChild(r), Tr(r, n);
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
    const n = this._repo.headId;
    if (n)
      if (e?.append)
        this.appendToken(n, t);
      else {
        const i = this._repo.getMessageById(n);
        i && (i.content = t), this._notifyBubble(n, "appendToken", t);
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
    const n = {
      id: J(),
      role: "assistant",
      content: "",
      status: "pending",
      timestamp: Date.now()
    };
    return this._repo.addOrUpdateMessage(e.parentId, n), this._repo.switchToBranch(n.id), this._reRenderActivePath(), this._repo.getBranches(n.id).indexOf(n.id);
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
    const n = this._repo.getMessage(t);
    if (!n) return null;
    const i = n.message.role === "user" ? t : n.parentId, r = { ...e };
    return ue(e) && (r.isStreaming = !0), this._repo.addOrUpdateMessage(i, r), this._repo.switchToBranch(e.id), this._reRenderActivePath(), e.id;
  }
  /**
   * Navigate to the previous or next sibling branch of a message.
   * Triggers a full re-render of the active path.
   */
  navigateBranch(t, e) {
    if (this._busy) return;
    const n = this._repo.getBranches(t), i = n.indexOf(t);
    if (i === -1) return;
    const r = e === "prev" ? i - 1 : i + 1;
    r < 0 || r >= n.length || (this._isAutoScrollEnabled = this._isAtBottom(), this._updateScrollButton(), this._repo.switchToBranch(n[r]), this._reRenderActivePath());
  }
  /**
   * Remove ALL responses to a user message (every child branch) and set head
   * back to `userMessageId`. Cleaner than `truncateFrom` for edit flows: it
   * discards stale sibling branches so the regenerated response starts alone.
   */
  truncateResponsesAfter(t) {
    const e = this._repo.getMessages();
    if (this._repo.clearChildren(t), !this._frameworkManagedDOM) {
      const n = this.querySelector(".aparte-messages-wrapper");
      if (n) {
        const i = e.findIndex((a) => a.id === t), r = i >= 0 ? e.slice(i + 1) : [];
        for (const a of r)
          n.querySelector(`aparte-chat-bubble[message-id="${ct(a.id)}"]`)?.remove();
      }
    }
  }
  /**
   * Remove all messages from `messageId` onwards (inclusive) from state and DOM.
   * Used by edit to truncate history before re-generating.
   */
  truncateFrom(t) {
    const e = this._repo.getMessages(), n = e.findIndex((r) => r.id === t);
    if (n === -1) return;
    const i = e.slice(n).map((r) => r.id);
    if (this._repo.resetHead(t), !this._frameworkManagedDOM) {
      const r = this.querySelector(".aparte-messages-wrapper");
      for (const a of i)
        r?.querySelector(`aparte-chat-bubble[message-id="${ct(a)}"]`)?.remove();
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
    const e = I(this).getStreamBlocks();
    this._repo.import({
      ...t,
      messages: t.messages.map((n) => {
        const i = jr(n.message, e), r = nn(i);
        return Kr(i) && $s(r), { ...n, message: r };
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
        xh(e.attachments);
    if (this._repo.clear(), this._syncBusy(), !this._frameworkManagedDOM) {
      const e = this.querySelector(".aparte-messages-wrapper");
      e && Array.from(e.querySelectorAll("aparte-chat-bubble")).forEach((n) => n.remove());
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
    const n = {
      id: t,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: !0,
      status: "streaming"
    };
    return this._repo.addOrUpdateMessage(this._repo.headId, n), n;
  }
  _notifyBubble(t, e, n, i) {
    const r = this.querySelector(
      `aparte-chat-bubble[message-id="${ct(t)}"], [data-aparte-bubble][message-id="${ct(t)}"]`
    );
    if (r)
      switch (e) {
        case "appendToken":
          r.appendToken?.(n);
          break;
        case "appendToSegment":
          r.appendToSegment?.(i, n);
          break;
        case "addSegment":
          r.addSegment?.(n);
          break;
        case "updateSegment": {
          const { segmentId: a, updates: o } = n;
          r.updateSegment?.(a, o);
          break;
        }
        case "removeSegment":
          r.removeSegment?.(n);
          break;
        case "setUsage":
          r.setUsage?.(n);
          break;
        case "update": {
          const a = n;
          ["status", "segments", "content", "attachments", "usage", "finishReason", "contextSummary", "compaction"].some((l) => l in a) && r.updateMessage?.(n);
          break;
        }
        case "complete":
          r.updateMessage?.(n);
          break;
      }
  }
  /** The day on the first bubble of each one, by what is on screen: a branch has its own days. */
  _syncDateSeparators() {
    const t = I(this), e = t.getDateSeparators();
    if (!e && !this.querySelector("aparte-chat-bubble[data-date]")) return;
    const n = /* @__PURE__ */ new Date(), i = (o) => new Date(o.getFullYear(), o.getMonth(), o.getDate()).getTime(), r = i(n);
    let a = null;
    this.querySelectorAll("aparte-chat-bubble").forEach((o) => {
      const l = Number(o.getAttribute("timestamp")), c = l ? new Date(l) : null, d = c ? i(c) : null, u = e && c && d !== a;
      if (d !== null && (a = d), !u || !c) {
        o.hasAttribute("data-date") && o.removeAttribute("data-date");
        return;
      }
      const h = Math.round((r - d) / 864e5), p = h === 0 ? t.t("conversationGroupToday") : h === 1 ? t.t("conversationGroupYesterday") : xp(c, t.getLocale().tag);
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
    const t = this._repo.getMessages(), e = t.map((r) => {
      const a = this._repo.getBranches(r.id);
      return { id: r.id, count: a.length, index: a.indexOf(r.id) };
    });
    if (this._frameworkManagedDOM) {
      this._dispatchPathChanged(t, e);
      return;
    }
    const n = this.querySelector(".aparte-messages-wrapper");
    if (!n) return;
    n.innerHTML = "";
    const i = Math.max(0, t.length - this._maxRenderedBubbles);
    for (let r = i; r < t.length; r++) {
      const a = t[r], o = e[r], l = document.createElement("aparte-chat-bubble");
      l.setAttribute("message-id", a.id), l.setAttribute("data-role", a.role), a.compaction && l.setAttribute("data-kind", "compaction"), a.timestamp && l.setAttribute("timestamp", String(a.timestamp)), ue(a) && l.setAttribute("streaming", ""), n.appendChild(l), Tr(l, a, o);
    }
    this._syncDateSeparators(), this._dispatchPathChanged(t, e), this._syncBusy(), this._checkpointState?.reapply(), this._recalculateSpacer();
  }
  _dispatchPathChanged(t, e) {
    const n = { messages: t, siblings: e };
    this.dispatchEvent(new CustomEvent("aparte-path-changed", {
      bubbles: !0,
      composed: !0,
      detail: n
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
      const e = I(this).getLocale();
      e.direction && t.setAttribute("dir", e.direction), t.setAttribute("role", "log"), t.setAttribute("aria-live", "polite"), t.setAttribute("aria-atomic", "false"), t.setAttribute("aria-relevant", "additions"), this._nameScrollSurface(t);
      const n = document.createElement("div");
      for (n.className = "aparte-messages-wrapper"; this.firstChild; )
        n.appendChild(this.firstChild);
      this._bottomSpacer = document.createElement("div"), this._bottomSpacer.className = "aparte-bottom-spacer", this._bottomSpacer.setAttribute("aria-hidden", "true"), n.appendChild(this._bottomSpacer), t.appendChild(n), this.appendChild(t), this._container = t, this._syncLoading(), this._scrollBtn = document.createElement("button"), this._scrollBtn.className = "aparte-btn aparte-btn--surface aparte-btn--circle aparte-btn--lg aparte-scroll-btn aparte-scroll-btn--hidden", this._scrollBtn.setAttribute("type", "button"), this._scrollBtn.setAttribute("aria-label", I(this).t("scrollToBottom"));
      const i = I(this).getIcon("scrollDown");
      this._scrollBtn.innerHTML = i, this.appendChild(this._scrollBtn);
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
    t.className = "aparte-btn aparte-btn--surface aparte-btn--circle aparte-btn--lg aparte-scroll-btn aparte-scroll-btn--hidden", t.setAttribute("type", "button"), t.setAttribute("aria-label", I(this).t("scrollToBottom"));
    const e = I(this).getIcon("scrollDown");
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
        const { clientX: n } = t, i = e.getBoundingClientRect();
        if (!(getComputedStyle(e).direction === "rtl" ? n <= i.right - e.clientWidth : n >= i.left + e.clientWidth)) return;
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
    this._container && (this._frameworkManagedDOM ? this._resizeObserver.observe(this._container, { box: "border-box" }) : this._resizeObserver.observe(this._container)), this._wireOverlay(), this.parentElement && (this._overlayAttrObserver = new MutationObserver(() => this._wireOverlay()), this._overlayAttrObserver.observe(this.parentElement, { attributes: !0, attributeFilter: ["overlay-composer"] })), this._mutationObserver = new MutationObserver((n) => {
      if (this._lastMutationAt = performance.now(), n.some((r) => r.type === "childList" && (r.target === this || r.target.classList?.contains("aparte-messages-wrapper"))) && this._syncDateSeparators(), this._frameworkManagedDOM && this._keepScrollButtonLast(), this._isAutoScrollEnabled && !this._gliding()) {
        const r = n.flatMap((o) => Array.from(o.addedNodes)).filter((o) => o instanceof Element && o.tagName === "APARTE-CHAT-BUBBLE"), a = r.length === 1 ? r[0] : void 0;
        if (a && a.getAttribute("data-role") === "user" && a.parentElement) {
          const o = a.parentElement.querySelectorAll("aparte-chat-bubble");
          o[o.length - 1] === a && (this._smoothScrollOnce = !0);
        }
      }
      this._isAutoScrollEnabled && requestAnimationFrame(() => {
        this._isAutoScrollEnabled && this._scrollToBottom();
      }), this._scheduleSpacerUpdate();
      const i = (r) => Array.from(r).some((a) => a instanceof Element && (a.tagName === "APARTE-CHAT-BUBBLE" || a.querySelector("aparte-chat-bubble") !== null));
      n.some((r) => i(r.addedNodes) || i(r.removedNodes)) && this._observeTail();
    }), this._tailObserver = new ResizeObserver((n) => {
      let i = !1;
      for (const r of n) {
        const a = Math.round(r.borderBoxSize?.[0]?.blockSize ?? r.contentRect.height);
        this._tailHeights.get(r.target) !== a && (i = !0), this._tailHeights.set(r.target, a);
      }
      i && this._scheduleSpacerUpdate();
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
    for (const i of this._overlayStack()) {
      const r = i.getBoundingClientRect();
      r.height > 0 && (e = Math.min(e, r.top));
    }
    const n = e === 1 / 0 ? 0 : Math.max(0, Math.round(t - e));
    n !== this._overlayInset && (this._overlayInset = n, this.style.setProperty("--aparte-bottom-inset", `${n}px`));
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
    const e = this.querySelector(".aparte-messages-wrapper") ?? this._container ?? this, n = parseFloat(getComputedStyle(e).paddingInlineStart) || 0, i = getComputedStyle(t).direction === "rtl", r = e.getBoundingClientRect(), a = t.getBoundingClientRect(), o = i ? a.right - r.right : r.left - a.left, l = Math.max(0, Math.round((o + n) * 10) / 10);
    l !== this._transcriptInset && (this._transcriptInset = l, t.style.setProperty("--aparte-transcript-inset", `${l}px`));
  }
  /** Is the scroll surface within `_scrollThreshold` of its bottom, right now? */
  _isAtBottom() {
    if (!this._container) return !0;
    const { scrollTop: t, scrollHeight: e, clientHeight: n } = this._container;
    return e - t - n <= this._scrollThreshold;
  }
  _handleScroll() {
    if (!this._container) return;
    const t = this._container.scrollTop, e = this._container.scrollHeight, n = this._lastScrollTop - t, i = Math.abs(e - this._lastScrollHeight), r = performance.now(), a = e < this._lastScrollHeight - 1, o = r - this._lastMutationAt < this._settleShadowMs && n <= this._settleBoundPx, l = r - this._ownScrollAt < this._ownScrollWindowMs && r - this._readerInputAt >= this._ownScrollWindowMs && !this._pointerHeld && (n <= i + 2 || a || o), c = n > 1 && !l, d = n > 1 && r - this._readerInputAt < this._ownScrollWindowMs;
    this._lastScrollTop = t, this._lastScrollHeight = e, this._isAtBottom() && !d ? this._isAutoScrollEnabled = !0 : c ? this._isAutoScrollEnabled = !1 : n > 1 && l && this._isAutoScrollEnabled && this._settleAtBottom(), this._updateScrollButton();
  }
  _scrollToBottom() {
    if (this._container) {
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
    const e = [...t].reverse().find((h) => h.getAttribute("data-role") === "user");
    if (!e) {
      this._setSpacerHeight(0);
      return;
    }
    const n = this._getSpacerHeight(), i = this._container.getBoundingClientRect(), a = e.getBoundingClientRect().top - i.top + this._container.scrollTop, o = this._container.scrollHeight - n;
    if (o <= this._container.clientHeight) {
      this._setSpacerHeight(0);
      return;
    }
    const l = o - a, c = parseFloat(getComputedStyle(this._container).scrollPaddingTop) || 0, d = this._container.clientHeight - c - l, u = this._container.clientHeight;
    this._setSpacerHeight(Math.min(Math.max(0, d), u)), this._isAutoScrollEnabled && this._scrollToBottom();
  }
  /** Point `_tailObserver` at the last question and the bubbles after it, and only those. */
  _observeTail() {
    if (!this._tailObserver) return;
    const t = Array.from(this.querySelectorAll("aparte-chat-bubble"));
    let e = t.length;
    for (; e > 0 && t[e - 1].getAttribute("data-role") !== "user"; ) e--;
    const n = e > 0 ? t.slice(e - 1) : [];
    for (const i of this._tail) n.includes(i) || this._tailObserver.unobserve(i);
    for (const i of n)
      this._tail.includes(i) || (this._tailHeights.set(i, Math.round(i.offsetHeight)), this._tailObserver.observe(i, { box: "border-box" }));
    this._tail = n;
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
    const e = t.querySelectorAll("aparte-chat-bubble"), n = e.length - this._maxRenderedBubbles;
    for (let i = 0; i < n; i++)
      e[i]?.remove();
  }
  _cleanup() {
    this._container?.removeEventListener("scroll", this._handleScroll), this._container?.removeEventListener("scrollend", this._handleScrollEnd), this._glideSettleTimer !== null && (clearTimeout(this._glideSettleTimer), this._glideSettleTimer = null);
    for (const t of ["wheel", "touchmove", "pointerdown", "keydown"])
      this._container?.removeEventListener(t, this._noteReaderInput);
    this._container?.removeEventListener("pointerdown", this._holdPointer), document.removeEventListener("pointerup", this._releasePointer, !0), document.removeEventListener("pointercancel", this._releasePointer, !0), this._pointerHeld = !1, this._scrollBtn?.removeEventListener("click", this._onScrollBtnClick), this.removeEventListener("aparte-branch-navigate", this._onBranchNavigate), this._resizeObserver?.disconnect(), this._mutationObserver?.disconnect(), this._tailObserver?.disconnect(), this._tailObserver = null, this._tail = [], this.removeEventListener("toggle", this._onDisclosureToggle, !0), this._overlayObserver?.disconnect(), this._overlayObserver = null, this._overlayAttrObserver?.disconnect(), this._overlayAttrObserver = null, this._overlayRoot = null, this._overlayInset = -1, this._transcriptInset = -1, this._resizeObserver = null, this._mutationObserver = null, this._spacerRafId !== null && (cancelAnimationFrame(this._spacerRafId), this._spacerRafId = null), this._settleRafId !== null && (cancelAnimationFrame(this._settleRafId), this._settleRafId = null), this._settleUntil = 0;
  }
}
V(al);
customElements.get("aparte-chat-viewport") || customElements.define("aparte-chat-viewport", al);
const Tp = [
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
].join(", "), Ip = "aparte-chat, [data-aparte-chat]";
function Rp(s) {
  const t = s.getAttribute("type-to-focus");
  return t === "page" || t === "off" ? t : "chat";
}
function Mp(s) {
  if (s.defaultPrevented || s.isComposing) return !1;
  const t = s.getModifierState?.("AltGraph") === !0;
  return (s.ctrlKey || s.metaKey || s.altKey) && !t ? !1 : s.key === "Dead" ? !0 : s.key.length === 1 && s.key !== " ";
}
function Lp(s) {
  let t = s.activeElement;
  for (; t?.shadowRoot?.activeElement; ) t = t.shadowRoot.activeElement;
  return t;
}
function Op(s) {
  const t = s.ownerDocument;
  let e = !1;
  const n = () => {
    const a = s.getAttribute("target"), o = s.closest(Ip) ?? (a ? t.getElementById(a) : null);
    return o ? [o, s] : [s];
  }, i = (a) => {
    const o = a.composedPath();
    e = n().some((l) => o.includes(l));
  }, r = (a) => {
    const o = Rp(s);
    if (o === "off" || !Mp(a) || s.hasAttribute("disabled")) return;
    const l = s.querySelector("aparte-composer-input");
    if (!l || l.hasAttribute("disabled")) return;
    const c = Lp(t);
    if (!c?.closest(Tp)) {
      if (o === "chat") {
        const d = !c || c === t.body || c === t.documentElement;
        if (!(!d && n().some((h) => h.contains(c))) && !(d && e)) return;
      }
      l.focusEnd?.();
    }
  };
  return t.addEventListener("pointerdown", i, !0), t.addEventListener("keydown", r), () => {
    t.removeEventListener("pointerdown", i, !0), t.removeEventListener("keydown", r);
  };
}
const $p = /* @__PURE__ */ new Set(["text", "search", "email", "url", "tel", "number", "password"]);
function Np(s) {
  return s instanceof HTMLTextAreaElement ? s.rows === 1 : s instanceof HTMLInputElement && $p.has(s.type);
}
class On extends HTMLElement {
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
    return I(this);
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
    const t = (this._cfg ?? I(this)).getLocale().direction;
    t ? this.setAttribute("dir", t) : this.removeAttribute("dir");
  }
  static get observedAttributes() {
    return ["placeholder", "disabled", "target"];
  }
  /** Stops the document listeners of `type-to-focus`; null while disconnected. */
  _offTypeToFocus = null;
  connectedCallback() {
    window.addEventListener("aparte-message-start", this._onMessageStart), window.addEventListener("aparte-message-done", this._onMessageDone), window.addEventListener("aparte-message-error", this._onMessageDone), window.addEventListener("aparte-message-aborted", this._onMessageDone), window.addEventListener("aparte-config-change", this._onConfigChangeEvent), queueMicrotask(() => this._warnIfUnattached()), this._evaluateModelGate(), this._applyDirection(), this._offTypeToFocus?.(), this._offTypeToFocus = Op(this);
  }
  disconnectedCallback() {
    window.removeEventListener("aparte-message-start", this._onMessageStart), window.removeEventListener("aparte-message-done", this._onMessageDone), window.removeEventListener("aparte-message-error", this._onMessageDone), window.removeEventListener("aparte-message-aborted", this._onMessageDone), window.removeEventListener("aparte-config-change", this._onConfigChangeEvent), this._listeners.clear(), this._offTypeToFocus?.(), this._offTypeToFocus = null;
  }
  attributeChangedCallback(t, e, n) {
    if (t === "disabled" && this._emit("disabled-change", { disabled: n !== null }), t === "placeholder")
      for (const i of this.querySelectorAll("aparte-composer-input"))
        i.syncPlaceholder?.();
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
    this.toggleAttribute("disabled", st(t));
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
    const n = this.querySelector("[data-aparte-panel-host]"), i = this.querySelector("aparte-composer-input");
    this.setAttribute("data-panel-active", ""), t.dataset.apartePanel = "true", t.addEventListener("keydown", this._onPanelKeydown), n ? n.appendChild(t) : i ? i.insertAdjacentElement("afterend", t) : this.appendChild(t), this._panelActive = !0, this._panelSubmitEnabled = e?.submitEnabled ?? !1, this._panelMode = e?.mode ?? "submit", this._reflectPanelMode(), this._panelOnSubmit = e?.onSubmit ?? null, this._panelOnEvict = e?.onEvict ?? null;
    const r = Symbol("aparte-composer-panel");
    return this._panelToken = r, this._emit("panel-change", { active: !0, submitEnabled: this._panelSubmitEnabled, mode: this._panelMode }), r;
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
    t.key !== "Enter" || t.isComposing || t.keyCode === 229 || t.defaultPrevented || !Np(t.target) || !(this.submitOnEnter ? !t.shiftKey : t.shiftKey) || (t.preventDefault(), this.submit());
  };
  /** Close the panel AND tell its owner, so a pending request never orphans. */
  _evictPanel() {
    const t = this._panelOnEvict;
    this._teardownPanel(), t?.();
  }
  _teardownPanel() {
    const t = document.activeElement, e = t instanceof Node && this.contains(t), n = this.querySelector("[data-aparte-panel]");
    n && n.remove(), this.removeAttribute("data-panel-active"), this._panelActive = !1, this._panelSubmitEnabled = !1, this._panelMode = "submit", this._reflectPanelMode(), this._panelOnSubmit = null, this._panelOnEvict = null, this._panelToken = null, this._emit("panel-change", { active: !1, submitEnabled: !1, mode: "submit" }), e && this.focus();
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
    const e = this.querySelector("aparte-composer-input")?.getTokens?.(), n = {
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
      detail: n
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
    this._listeners.get(t)?.forEach((n) => n(e)), On._STATE_EVENTS.has(t) && this.dispatchEvent(new CustomEvent("aparte-composer-change", {
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
V(On);
customElements.get("aparte-composer") || customElements.define("aparte-composer", On);
function ol(s, t) {
  const e = (s ?? "").split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
  if (e.length === 0) return !0;
  const n = t.name.toLowerCase(), i = t.type.toLowerCase();
  return e.some((r) => r.startsWith(".") ? n.endsWith(r) : r.endsWith("/*") ? i.startsWith(r.slice(0, -1)) : i === r);
}
const ai = "data-aparte-token", ll = "data-aparte-text", Pp = "￼", Pe = (s) => s.nodeType === Node.TEXT_NODE, Dp = (s) => s.nodeType === Node.ELEMENT_NODE && s.hasAttribute(ai), cl = (s) => Array.prototype.indexOf.call(s.parentNode.childNodes, s);
function De(s, t = []) {
  return s.childNodes.forEach((e) => {
    Pe(e) || e.nodeName === "BR" || Dp(e) ? t.push(e) : De(e, t);
  }), t;
}
const dl = (s) => Pe(s) ? s.data.length : 1;
function Hp(s) {
  return De(s).map((t) => Pe(t) ? t.data : t.nodeName === "BR" ? `
` : Pp).join("");
}
function Bp(s, t, e) {
  const n = s.ownerDocument.createRange();
  n.setStart(t, e), n.collapse(!0);
  let i = 0;
  for (const r of De(s)) {
    if (r === t) return i + e;
    if (n.comparePoint(r.parentNode, cl(r)) >= 0) return i;
    i += dl(r);
  }
  return i;
}
function Vr(s, t) {
  let e = t;
  for (const n of De(s)) {
    if (Pe(n) && e <= n.data.length) return [n, e];
    if (e === 0) return [n.parentNode, cl(n)];
    e -= dl(n);
  }
  return [s, s.childNodes.length];
}
function Xr(s, t, e) {
  const n = s.ownerDocument.createRange();
  return n.setStart(...Vr(s, t)), n.setEnd(...Vr(s, e)), n;
}
function Yr(s, t, e) {
  const n = s.createElement("span");
  n.className = "aparte-tag aparte-inline-token", n.setAttribute("contenteditable", "false"), n.setAttribute(ai, t), n.setAttribute(ll, e.text ?? e.label), e.kind && (n.dataset.kind = e.kind);
  const i = s.createElement("span");
  return i.className = "aparte-tag__label", i.textContent = e.label, n.appendChild(i), n;
}
function Qr(s, t) {
  let e = "";
  const n = [];
  for (const r of De(s))
    if (Pe(r)) e += r.data;
    else if (r.nodeName === "BR") e += `
`;
    else {
      const a = r, o = t.get(a.getAttribute(ai) ?? ""), l = a.getAttribute(ll) ?? a.textContent ?? "", c = e.length;
      e += l, n.push({
        label: a.textContent ?? "",
        text: l,
        start: c,
        end: e.length,
        ...a.dataset.kind ? { kind: a.dataset.kind } : {},
        ...o?.data !== void 0 ? { data: o.data } : {}
      });
    }
  const i = e.length - e.trimStart().length;
  return { value: e.trim(), tokens: n.map((r) => ({ ...r, start: r.start - i, end: r.end - i })) };
}
class ul extends HTMLElement {
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
    this._render(), this._editor = this.querySelector(".aparte-ci-editor"), this._editor?.addEventListener("input", this._onInput), this._editor?.addEventListener("keydown", this._onKeydown), this._editor?.addEventListener("focus", this._onFocus), this._editor?.addEventListener("blur", this._onBlur), this._editor?.addEventListener("paste", this._onPaste), this._connectToRoot(), this._scheduleInitialReflow(), this._editor && typeof ResizeObserver == "function" && (this._resizeObserver = new ResizeObserver(() => this._adjustHeight()), this._resizeObserver.observe(this._editor)), this._unsubscribes.push(Kt(this, () => this._updatePlaceholder()));
  }
  disconnectedCallback() {
    this._editor?.removeEventListener("input", this._onInput), this._editor?.removeEventListener("keydown", this._onKeydown), this._editor?.removeEventListener("focus", this._onFocus), this._editor?.removeEventListener("blur", this._onBlur), this._editor?.removeEventListener("paste", this._onPaste), this._resizeObserver?.disconnect(), this._resizeObserver = null, this._unsubscribes.forEach((t) => t()), this._unsubscribes = [];
  }
  attributeChangedCallback(t, e, n) {
    t === "placeholder" && this._updatePlaceholder(), t === "max-height" && (this._maxHeight = parseInt(n || "200", 10)), t === "min-height" && (this._minHeight = parseInt(n || "44", 10)), t === "disabled" && this._updateDisabled(n !== null);
  }
  // ── Public API ──────────────────────────────────────────────────────────
  /**
   * The editor's text, with `<br>` serialized back to newlines — `textContent`
   * alone would collapse a multi-line draft onto a single line.
   */
  getValue() {
    return this._editor ? Qr(this._editor, this._tokens).value : "";
  }
  /** The tokens in the draft, with their place in {@link getValue}. */
  getTokens() {
    return this._editor ? Qr(this._editor, this._tokens).tokens : [];
  }
  /** The caret, or `null` when the editor does not hold a collapsed selection. */
  getCaret() {
    const t = this.ownerDocument?.getSelection();
    return !this._editor || !t?.rangeCount || !t.isCollapsed || !this._editor.contains(t.anchorNode) ? null : { text: Hp(this._editor), offset: Bp(this._editor, t.anchorNode, t.anchorOffset) };
  }
  /** The box of a range of the draft on screen, to anchor something to the text. */
  getRangeRect(t, e = t) {
    return this._editor ? Xr(this._editor, t, e).getClientRects?.()[0] ?? null : null;
  }
  /** Replace a range of the draft with text, and leave the caret after it. */
  replaceRange(t, e, n) {
    this._write(t, e, () => n ? this._insertPlain(n) : this._exec("delete"), () => this.ownerDocument.createTextNode(n));
  }
  /**
   * Replace a range of the draft with a token, followed by a space for the caret to land
   * on: a caret cannot rest after something that is not editable at the end of a line.
   */
  insertToken(t, e, n) {
    const i = String(++this._lastTokenId);
    this._tokens.set(i, n);
    const r = this.ownerDocument, a = () => {
      const o = r.createDocumentFragment();
      return o.append(Yr(r, i, n), r.createTextNode(" ")), o;
    };
    this._write(t, e, () => this._exec("insertHTML", `${Yr(r, i, n).outerHTML} `), a);
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
  _write(t, e, n, i) {
    const r = this._editor, a = this.ownerDocument?.getSelection();
    if (!r || !a) return;
    r.focus();
    const o = Xr(r, t, e);
    if (a.removeAllRanges(), a.addRange(o), n()) return;
    o.deleteContents();
    const l = i(), c = l.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? l.lastChild : l;
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
    return /[\r\n]/.test(t) ? this._exec("insertHTML", $(t).replace(/\r\n?|\n/g, "<br>")) : this._exec("insertText", t);
  }
  _getPlaceholder() {
    return this.getAttribute("placeholder") || this._getRoot()?.placeholder || I(this).t("inputPlaceholder") || "Type a message...";
  }
  _render() {
    if (this.querySelector(".aparte-ci-editor")) return;
    const t = this.hasAttribute("disabled") || this._getRoot()?.disabled || !1, e = O(this._getPlaceholder());
    this.innerHTML = `<div
            class="aparte-ci-editor"
            contenteditable="${!t}"
            role="textbox"
            aria-multiline="true"
            aria-label="${e}"
            tabindex="${O(String(t ? -1 : 0))}"
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
      const i = this._getRoot();
      if (i) {
        if (i.streaming) return;
        i.submit();
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
    const n = this._getRoot(), i = n?.querySelector("aparte-composer-add-attachment"), r = i ? Array.from(e.items).find((o) => o.type.startsWith("image/"))?.getAsFile() : void 0;
    if (r && ol(i?.getAttribute("accept"), r)) {
      n?.addAttachments([r]);
      return;
    }
    const a = e.getData("text/plain");
    a && this._insertPlain(a);
  }
  _adjustHeight() {
    if (!this._editor) return;
    this._editor.style.height = "0px";
    const t = this.hasAttribute("min-height") ? this._minHeight : 0, e = this._editor.scrollHeight, n = Math.min(Math.max(e, t), this._maxHeight);
    this._editor.style.height = `${n}px`, this._editor.style.overflowY = e > this._maxHeight ? "auto" : "hidden";
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
V(ul);
customElements.get("aparte-composer-input") || customElements.define("aparte-composer-input", ul);
class hl extends HTMLElement {
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
    const t = I(this).t("sendButton") || "Send", e = this._getSendIcon(), n = this._getRoot(), i = !n || n.disabled || n.value.trim() === "";
    this.innerHTML = `<button
            type="button"
            class="aparte-btn aparte-btn--primary aparte-btn--solid aparte-btn--icon aparte-cs-button aparte-send-button"
            aria-label="${O(t)}"
            title="${O(t)}"
            data-act="send"
            ${i ? "disabled" : ""}
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
    ), this._unsubscribes.push(Kt(this, () => this._refreshChrome())));
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
    const e = I(this);
    if (t.mode === "none") {
      this._button.disabled = !0;
      return;
    }
    this._button.disabled = !t.submitEnabled, this._button.innerHTML = this._getSubmitIcon(), this._button.setAttribute("data-act", "submit");
    const n = e.t("submitButton") || "Submit";
    this._button.setAttribute("aria-label", n), this._button.setAttribute("title", n), this._button.classList.remove("aparte-is-streaming");
  }
  _handleClick(t) {
    t.preventDefault(), this._getRoot()?.submit();
  }
  _syncState() {
    const t = this._getRoot();
    if (!t || !this._button || t.streaming) return;
    const e = t.value.trim() === "" && t.attachments.length === 0;
    this._button.disabled = t.disabled || e, this._button.innerHTML = this._getSendIcon(), this._button.setAttribute("data-act", "send");
    const n = I(this).t("sendButton") || "Send";
    this._button.setAttribute("aria-label", n), this._button.setAttribute("title", n), this._button.classList.remove("aparte-is-streaming");
  }
  _syncStreamingState(t) {
    if (this._button)
      if (t) {
        this._button.disabled = !1, this._button.innerHTML = this._getStopIcon(), this._button.setAttribute("data-act", "stop");
        const e = I(this).t("stopButton") || "Stop";
        this._button.setAttribute("aria-label", e), this._button.setAttribute("title", e), this._button.classList.add("aparte-is-streaming");
      } else
        this._syncState();
  }
  /**
   * The icon for submitting an ANSWER, which is not the same act as sending a
   * message — one button, two meanings, and it has to say which one it is.
   */
  _getSubmitIcon() {
    return I(this).getIcon("check");
  }
  _getSendIcon() {
    return I(this).getIcon("send") || "Send";
  }
  _getStopIcon() {
    return I(this).getIcon("stop");
  }
}
V(hl);
customElements.get("aparte-composer-send") || customElements.define("aparte-composer-send", hl);
class pl extends HTMLElement {
  _button = null;
  _unsubscribes = [];
  // Bound handler
  _onClick = this._handleClick.bind(this);
  connectedCallback() {
    this._render(), this._button = this.querySelector(".aparte-cc-button"), this._button?.addEventListener("click", this._onClick), this._connectToRoot(), this._unsubscribes.push(Kt(this, () => this._refreshChrome()));
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
    const t = I(this).t("stopButton") || "Stop", e = this._getStopIcon();
    this.innerHTML = `<button
            type="button"
            class="aparte-btn aparte-btn--icon aparte-cc-button"
            aria-label="${O(t)}"
            title="${O(t)}"
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
    const t = I(this).t("stopButton") || "Stop";
    this._button.setAttribute("aria-label", t), this._button.setAttribute("title", t), this._button.innerHTML = this._getStopIcon();
  }
  _getStopIcon() {
    return I(this).getIcon("stop");
  }
}
V(pl);
customElements.get("aparte-composer-cancel") || customElements.define("aparte-composer-cancel", pl);
class fl extends HTMLElement {
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
    const n = this._getRoot()?.attachments.indexOf(t) ?? -1, i = this.querySelectorAll(".aparte-thumb")[n];
    if (!i) return;
    i.toggleAttribute("data-failed", e?.status === "error");
    let r = i.querySelector(".aparte-progress");
    if (e?.status !== "uploading") {
      r?.remove();
      return;
    }
    r || (r = document.createElement("div"), r.className = "aparte-progress aparte-thumb__progress", r.setAttribute("role", "progressbar"), r.setAttribute("aria-label", t.name), r.innerHTML = '<div class="aparte-progress__bar"></div>', i.appendChild(r));
    const a = e.progress !== void 0;
    r.classList.toggle("aparte-progress--indeterminate", !a), a ? (r.setAttribute("aria-valuenow", String(e.progress)), r.setAttribute("aria-valuemin", "0"), r.setAttribute("aria-valuemax", "100"), r.style.setProperty("--aparte-progress-value", String(e.progress))) : r.removeAttribute("aria-valuenow");
  }
  /** Release the previous render's blob URLs so they don't leak. */
  _revokeUrls() {
    this._objectUrls.forEach((t) => URL.revokeObjectURL(t)), this._objectUrls = [];
  }
  _render(t) {
    this.hidden = t.length === 0, this._revokeUrls();
    const e = I(this), n = (a) => (e.t("removeAttachment") || "Remove {name}").replace("{name}", () => a.name);
    this.innerHTML = t.map((a) => {
      const o = $(a.name), l = `<button class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-thumb__remove" type="button" aria-label="${O(n(a))}">${e.getIcon("close")}</button>`;
      if (a.type.startsWith("image/")) {
        const c = URL.createObjectURL(a);
        return this._objectUrls.push(c), `<div class="aparte-thumbnail aparte-thumb aparte-thumb--image" title="${o}"><img class="aparte-thumbnail__image" src="${O(c)}" alt="${o}" /><span class="aparte-thumb__name">${o}</span>${l}</div>`;
      }
      return `<div class="aparte-thumbnail aparte-thumb aparte-thumb--file" title="${o}"><span class="aparte-thumbnail__label">${$(this._ext(a.name))}</span><span class="aparte-thumb__name">${o}</span>${l}</div>`;
    }).join("");
    const i = this._getRoot();
    if (i) for (const a of t) {
      const o = i.getAttachmentState(a);
      o && this.showState(a, o);
    }
    if (this.querySelectorAll(".aparte-thumb__remove").forEach((a, o) => {
      a.addEventListener("click", (l) => {
        l.stopPropagation();
        const c = this._getRoot();
        c && c.removeAttachment(c.attachments[o]);
      });
    }), !I(this).getHostHandlers().attachmentPreview) return;
    const r = t.filter((a) => a.type.startsWith("image/"));
    this.querySelectorAll(".aparte-thumb--image").forEach((a, o) => {
      const l = a.querySelector(".aparte-thumbnail__image");
      if (!l) return;
      l.setAttribute("role", "button"), l.setAttribute("tabindex", "0"), l.setAttribute("aria-label", r[o]?.name ?? "");
      const c = () => {
        this.dispatchEvent(new CustomEvent("aparte-attachment-preview", {
          bubbles: !0,
          composed: !0,
          detail: { url: l.src, name: r[o]?.name ?? "", type: r[o]?.type ?? "" }
        }));
      };
      l.addEventListener("click", c), l.addEventListener("keydown", (d) => {
        const u = d.key;
        u !== "Enter" && u !== " " || (d.preventDefault(), c());
      });
    });
  }
  /** Uppercased file extension (≤4 chars), or 'FILE' when there is none. */
  _ext(t) {
    const e = t.lastIndexOf(".");
    return e > 0 ? t.slice(e + 1).toUpperCase().slice(0, 4) : "FILE";
  }
}
V(fl);
customElements.get("aparte-composer-attachments") || customElements.define("aparte-composer-attachments", fl);
class gl extends HTMLElement {
  _button = null;
  _dragCleanup = null;
  _unsubscribes = [];
  // Bound handler
  _onClick = this._handleClick.bind(this);
  static get observedAttributes() {
    return ["accept", "multiple", "disabled"];
  }
  connectedCallback() {
    this._render(), this._button = this.querySelector(".aparte-caa-button"), this._button?.addEventListener("click", this._onClick), this._connectToRoot(), this._setupDragDrop(), this._unsubscribes.push(Kt(this, () => this._refreshChrome()));
  }
  disconnectedCallback() {
    this._button?.removeEventListener("click", this._onClick), this._dragCleanup?.(), this._unsubscribes.forEach((t) => t()), this._unsubscribes = [];
  }
  attributeChangedCallback(t, e, n) {
    t === "disabled" && this._button && (this._button.disabled = n !== null);
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
    const t = I(this), e = t.t("actionUpload") || "Attach file";
    this._button.setAttribute("aria-label", e), this._button.setAttribute("title", e), this._button.innerHTML = t.getIcon("paperclip");
  }
  _render() {
    if (this.querySelector(".aparte-caa-button")) return;
    const t = I(this).t("actionUpload") || "Attach file", e = I(this).getIcon("paperclip"), n = this.hasAttribute("disabled") || this._getRoot()?.disabled || !1;
    this.innerHTML = `<button
            class="aparte-btn aparte-btn--icon aparte-caa-button aparte-action-button"
            aria-label="${O(t)}"
            title="${O(t)}"
            type="button"
            ${n ? "disabled" : ""}
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
    const e = Array.from(t).filter((n) => ol(this.getAttribute("accept"), n));
    e.length && this._getRoot()?.addAttachments(e);
  }
  _setupDragDrop() {
    const t = this._getRoot();
    if (!t) return;
    const e = (a) => {
      a.preventDefault(), a.stopPropagation();
    }, n = (a) => {
      t.disabled || (e(a), t.classList.add("aparte-is-dragover"));
    }, i = (a) => {
      e(a), t.classList.remove("aparte-is-dragover");
    }, r = (a) => {
      if (e(a), t.classList.remove("aparte-is-dragover"), t.disabled) return;
      const o = a.dataTransfer?.files;
      o?.length && this._admit(o);
    };
    t.addEventListener("dragover", n), t.addEventListener("dragleave", i), t.addEventListener("drop", r), this._dragCleanup = () => {
      t.removeEventListener("dragover", n), t.removeEventListener("dragleave", i), t.removeEventListener("drop", r);
    };
  }
}
V(gl);
customElements.get("aparte-composer-add-attachment") || customElements.define("aparte-composer-add-attachment", gl);
class _l extends HTMLElement {
  _button = null;
  _unsubscribes = [];
  // Bound handler
  _onClick = this._handleClick.bind(this);
  static get observedAttributes() {
    return ["icon", "label", "disabled"];
  }
  connectedCallback() {
    this._render(), this._button = this.querySelector(".aparte-cact-button"), this._button?.addEventListener("click", this._onClick), this._connectToRoot(), this._unsubscribes.push(Kt(this, () => {
      this._button && (this._button.innerHTML = this._resolveIcon(this.getAttribute("icon") ?? ""));
    }));
  }
  disconnectedCallback() {
    this._button?.removeEventListener("click", this._onClick), this._unsubscribes.forEach((t) => t()), this._unsubscribes = [];
  }
  attributeChangedCallback(t, e, n) {
    this._button && (t === "disabled" && (this._button.disabled = n !== null), t === "label" && (this._button.setAttribute("aria-label", n ?? ""), this._button.setAttribute("title", n ?? "")), t === "icon" && (this._button.innerHTML = this._resolveIcon(n ?? "")));
  }
  // ── Private ─────────────────────────────────────────────────────────────
  _getRoot() {
    return this.closest("aparte-composer");
  }
  _render() {
    if (this.querySelector(".aparte-cact-button")) return;
    const t = O(this.getAttribute("label") ?? ""), e = this._resolveIcon(this.getAttribute("icon") ?? ""), n = this.hasAttribute("disabled") || this._getRoot()?.disabled || !1;
    this.innerHTML = `<button
            class="aparte-btn aparte-btn--icon aparte-cact-button aparte-action-button"
            aria-label="${t}"
            title="${t}"
            type="button"
            ${n ? "disabled" : ""}
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
    return t ? t.trimStart().startsWith("<") ? t : I(this).getIcon(t) ?? t : "";
  }
}
V(_l);
customElements.get("aparte-composer-action") || customElements.define("aparte-composer-action", _l);
class ml extends HTMLElement {
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
    const t = Array.from(this.children).some((i) => !i.hasAttribute("hidden") && !i.hasAttribute("data-empty")), e = Array.from(this.childNodes).some((i) => i.nodeType === Node.TEXT_NODE && (i.textContent ?? "").trim() !== ""), n = t || e;
    n !== !this.hasAttribute("data-empty") && (n ? this.removeAttribute("data-empty") : this.setAttribute("data-empty", ""));
  }
}
V(ml);
customElements.get("aparte-composer-toolbar") || customElements.define("aparte-composer-toolbar", ml);
function wn(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function Ns(s, t) {
  let e = 0;
  for (const n of s.querySelectorAll("[data-conv-id]")) {
    const i = n.querySelector(".aparte-conv-item__title")?.textContent ?? n.textContent ?? "";
    n.hidden = t !== "" && !wn(i).includes(t), n.hidden || e++;
  }
  for (const n of s.querySelectorAll(".aparte-conv-group"))
    n.hidden = t !== "" && !Array.from(n.querySelectorAll("[data-conv-id]")).some((i) => !i.hidden);
  return e;
}
const Zr = (s) => s === "running" || s === "waiting" ? s : null;
function ns(s, t) {
  return `[${s}="${ct(t)}"]`;
}
const ss = 864e5, qp = 4, Fp = 8;
class bl extends HTMLElement {
  _conversations = [];
  _activeId = null;
  _open = null;
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
    this.toggleAttribute("loading", st(t));
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
    this.toggleAttribute("manage", st(t));
  }
  // ─── Lifecycle ────────────────────────────────────────────────────────
  connectedCallback() {
    this.classList.contains("aparte-conv-list") || this.classList.add("aparte-conv-list"), this.getAttribute("role") || this.setAttribute("role", "navigation"), this.addEventListener("click", this._onClick), this.addEventListener("keydown", this._onKeydown), this.addEventListener("focusout", this._onFocusOut), this.addEventListener("pointerdown", this._onPress), this._render(), window.addEventListener("aparte-config-change", this._onConfigChange), window.addEventListener("aparte-conversation-status", this._onStatus);
  }
  disconnectedCallback() {
    this._closeMenu(), this.removeEventListener("click", this._onClick), this.removeEventListener("keydown", this._onKeydown), this.removeEventListener("focusout", this._onFocusOut), this.removeEventListener("pointerdown", this._onPress), window.removeEventListener("pointerup", this._onRelease, !0), window.removeEventListener("pointercancel", this._onRelease, !0), this._pressed = !1, this._renderAfterPress = !1, window.removeEventListener("aparte-config-change", this._onConfigChange), window.removeEventListener("aparte-conversation-status", this._onStatus);
  }
  attributeChangedCallback(t, e, n) {
    e !== n && (t === "active-id" ? (this._activeId = n, this._updateActiveState()) : (t === "flat" || t === "loading") && this.isConnected && this._render());
  }
  /**
   * Re-render on a locale switch: every row's title fallback, the `⋯` button's name
   * and the group headings come from the locale, so without this the list stayed in
   * the previous language until something else happened to re-render it. Only OUR
   * config.
   */
  _onConfigChange = (t) => {
    const e = t.detail;
    e?.config && e.config !== I(this) || this._render();
  };
  /**
   * `aparte-conversation-status`, on `window`: the controller's, a list's, or an app's own.
   * Kept page-wide too (an app may dispatch the event itself), then drawn on this row.
   */
  _onStatus = (t) => {
    const e = t.detail;
    if (typeof e?.id != "string") return;
    Go(e.id, Zr(e.status));
    const n = this.querySelector(ns("data-conv-id", e.id));
    n && this._applyStatus(n, e.id);
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
    Ts(t, Zr(e));
  }
  /** What a conversation is doing, as last told; `null` for neither. */
  getConversationStatus(t) {
    return Zn(t);
  }
  /** Write a conversation's state onto its row — the same three things `_renderItem` draws. */
  _applyStatus(t, e) {
    const n = Zn(e);
    n ? t.setAttribute("data-status", n) : t.removeAttribute("data-status");
    const i = n === "running";
    t.querySelector(".aparte-conv-item__title")?.classList.toggle("aparte-shimmer", i);
    const r = t.querySelector(".aparte-conv-item__state");
    r && (r.textContent = this._statusWords(n));
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
    this._closeMenu(), this._renaming = null;
    const e = wt(this), n = e && this.contains(e) ? e.closest("[data-select-id], [data-more-id]") : null, i = n?.dataset.selectId ? ns("data-select-id", n.dataset.selectId) : n?.dataset.moreId ? ns("data-more-id", n.dataset.moreId) : null, r = n?.closest("[data-conv-id]") ?? null, a = (f) => !f.closest("[hidden]"), o = r ? Array.from(this.querySelectorAll("[data-conv-id]")).filter(a).indexOf(r) : -1, l = this.hasAttribute("loading");
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
    if (this._applyFilter(), !i) return;
    const u = this.querySelector(i);
    if (u && a(u)) {
      u.focus();
      return;
    }
    const h = Array.from(this.querySelectorAll("[data-select-id]")).filter(a), p = o >= 0 ? h[o] ?? h[h.length - 1] : null;
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
    return this._query = wn(t), this._applyFilter();
  }
  _applyFilter() {
    const t = this._query;
    if (this.hasAttribute("loading")) return 0;
    const e = Ns(this, t), n = t !== "" && e === 0;
    this.toggleAttribute("data-no-match", n);
    let i = this.querySelector(":scope > .aparte-conv-list-no-match");
    const r = !i;
    i || (i = document.createElement("p"), i.className = "aparte-conv-list-no-match", i.setAttribute("role", "status"), this.appendChild(i));
    const a = n ? this._t("conversationSearchEmpty") : "", o = () => {
      i.isConnected && i.textContent !== a && (i.textContent = a);
    };
    return r && a && typeof requestAnimationFrame == "function" ? requestAnimationFrame(o) : o(), e;
  }
  _t(t) {
    return I(this).getLocale()[t] ?? ve[t] ?? "";
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
    const e = /* @__PURE__ */ new Date(), n = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime(), i = I(this).getLocale().tag, r = /* @__PURE__ */ new Map(), a = (d, u, h) => {
      let p = r.get(d);
      p || (p = { key: d, label: u, items: [] }, r.set(d, p)), p.items.push(h);
    };
    for (const d of t) {
      if (d.pinnedAt) {
        a("pinned", this._t("conversationGroupPinned"), d);
        continue;
      }
      const u = d.updatedAt;
      if (typeof u != "number") {
        a("undated", null, d);
        continue;
      }
      if (u >= n) a("today", this._t("conversationGroupToday"), d);
      else if (u >= n - ss) a("yesterday", this._t("conversationGroupYesterday"), d);
      else if (u >= n - 7 * ss) a("week", this._t("conversationGroupWeek"), d);
      else if (u >= n - 30 * ss) a("month", this._t("conversationGroupMonth"), d);
      else {
        const h = new Date(u), p = h.getFullYear() === e.getFullYear(), f = new Intl.DateTimeFormat(i, p ? { month: "long" } : { month: "long", year: "numeric" }).format(h), _ = f.charAt(0).toLocaleUpperCase(i) + f.slice(1);
        a(`m-${h.getFullYear()}-${String(h.getMonth()).padStart(2, "0")}`, _, d);
      }
    }
    const o = ["pinned", "today", "yesterday", "week", "month"].map((d) => r.get(d)).filter((d) => !!d), l = [...r.keys()].filter((d) => d.startsWith("m-")).sort((d, u) => u.localeCompare(d)).map((d) => r.get(d)), c = r.get("undated");
    return [...o, ...l, ...c ? [c] : []];
  }
  _renderGroup(t) {
    const e = t.items.map((i) => this._renderItem(i)).join("");
    if (t.label === null)
      return `<div class="aparte-conv-group">${e}</div>`;
    const n = $(t.label);
    return `
<div class="aparte-conv-group" role="group" aria-label="${O(t.label)}">
  <div class="aparte-menu__label aparte-conv-group__label" aria-hidden="true">${n}</div>
  ${e}
</div>`;
  }
  _renderItem(t) {
    const e = t.id === this._activeId, n = [
      "aparte-menu__item aparte-conv-item",
      e ? "aparte-conv-item--active" : "",
      t.archivedAt ? "aparte-conv-item--archived" : "",
      t.pinnedAt ? "aparte-conv-item--pinned" : ""
    ].filter(Boolean).join(" "), i = O(t.id), r = $(t.title || this._t("newChat")), a = O(this._t("conversationActions")), o = I(this).getIcon("more"), l = Zn(t.id), c = l ? ` data-status="${O(l)}"` : "", d = O(l === "running" ? "aparte-conv-item__title aparte-shimmer" : "aparte-conv-item__title"), u = $(this._statusWords(l));
    return `
<div class="${O(n)}" data-conv-id="${i}"${c}>
  <button
    class="aparte-conv-item__select"
    type="button"
    data-select-id="${i}"
    aria-current="${e ? "page" : "false"}"
  ><span class="${d}" dir="auto">${r}</span><span class="aparte-conv-item__status" aria-hidden="true"></span><span class="aparte-conv-item__state aparte-sr-only">${u}</span></button>
  <button
    class="aparte-btn aparte-btn--icon aparte-btn--sm aparte-conv-item__more"
    type="button"
    data-more-id="${i}"
    aria-label="${a}"
    title="${a}"
    aria-haspopup="menu"
    aria-expanded="false"
  >${o}</button>
</div>`;
  }
  // ─── The row's menu ───────────────────────────────────────────────────
  _menuMarkup(t) {
    const e = I(this), n = e.getIcon("edit"), i = e.getIcon("pin"), r = e.getIcon(t.archivedAt ? "unarchive" : "archive"), a = e.getIcon("trash"), o = $(this._t("renameConversation")), l = $(this._t(t.pinnedAt ? "unpinConversation" : "pinConversation")), c = $(this._t(t.archivedAt ? "unarchiveConversation" : "archiveConversation")), d = $(this._t("deleteConversation"));
    return `
<button type="button" class="aparte-menu__item" role="menuitem" data-menu-action="rename">${n}<span>${o}</span></button>
<button type="button" class="aparte-menu__item" role="menuitem" data-menu-action="pin">${i}<span>${l}</span></button>
<button type="button" class="aparte-menu__item" role="menuitem" data-menu-action="archive">${r}<span>${c}</span></button>
<div class="aparte-menu__separator" role="separator"></div>
<button type="button" class="aparte-menu__item aparte-conv-menu__item--danger" role="menuitem" data-menu-action="delete">${a}<span>${d}</span></button>`;
  }
  /** The question the confirm step asks — the popover's accessible name while it asks it. */
  _confirmQuestion(t) {
    return this._t("deleteConversationConfirm").replace("{title}", () => t.title || this._t("newChat"));
  }
  _confirmMarkup(t) {
    const e = $(this._confirmQuestion(t)), n = $(this._t("cancel")), i = $(this._t("deleteConversation"));
    return `
<div class="aparte-conv-menu__confirm">
  <p class="aparte-conv-menu__question">${e}</p>
  <div class="aparte-conv-menu__actions">
    <button type="button" class="aparte-btn aparte-btn--sm aparte-btn--ghost" data-menu-action="cancel">${n}</button>
    <button type="button" class="aparte-btn aparte-btn--sm aparte-btn--danger aparte-btn--solid" data-menu-action="confirm-delete">${i}</button>
  </div>
</div>`;
  }
  _openMenu(t, e) {
    this._closeMenu();
    const n = t.dataset.convId, i = this._conversations.find((a) => a.id === n);
    if (!i) return;
    const r = document.createElement("div");
    r.className = "aparte-menu aparte-conv-menu", r.setAttribute("role", "menu"), r.setAttribute("aria-label", i.title || this._t("newChat")), r.innerHTML = this._menuMarkup(i), t.appendChild(r), e.setAttribute("aria-expanded", "true"), this._open = { id: n, row: t, button: e, menu: r }, this._placeMenu(e, r), r.querySelector('[role="menuitem"]')?.focus(), document.addEventListener("pointerdown", this._onDocumentPointerDown, !0), document.addEventListener("pointerup", this._onDocumentPointerUp, !0), document.addEventListener("pointercancel", this._onDocumentPointerUp, !0), window.addEventListener("scroll", this._onWindowScroll, !0), window.addEventListener("resize", this._onWindowScroll);
  }
  /**
   * Fixed, below the button's end edge, flipped above it when the viewport ends
   * first. Fixed rather than absolute because a sidebar scrolls: an absolute menu on
   * the last rows would be clipped by the list's own overflow. No anchoring library —
   * the menu closes on any scroll or resize, which is what makes the arithmetic
   * safe to do once.
   */
  _placeMenu(t, e) {
    ap(t.getBoundingClientRect(), e, {
      gap: qp,
      margin: Fp,
      align: "end",
      rtl: getComputedStyle(this).direction === "rtl"
    });
  }
  _closeMenu(t = !1) {
    const e = this._open;
    e && (this._open = null, e.menu.remove(), e.button.setAttribute("aria-expanded", "false"), document.removeEventListener("pointerdown", this._onDocumentPointerDown, !0), document.removeEventListener("pointerup", this._onDocumentPointerUp, !0), document.removeEventListener("pointercancel", this._onDocumentPointerUp, !0), this._pressInMenu = !1, window.removeEventListener("scroll", this._onWindowScroll, !0), window.removeEventListener("resize", this._onWindowScroll), t && e.button.isConnected && e.button.focus());
  }
  /**
   * A pointer is down inside the open menu. WebKit does not move the focus to a
   * button on mousedown: the element that held it is blurred instead — `focusout`
   * with no `relatedTarget` — before the click reaches the item. `_onFocusOut` used
   * to read that as the focus leaving the menu and close it on the press, so with a
   * mouse no item could be chosen at all. Held from the press to its release.
   */
  _pressInMenu = !1;
  _onDocumentPointerUp = () => {
    this._pressInMenu = !1;
  };
  _onDocumentPointerDown = (t) => {
    const e = this._open;
    if (!e) return;
    const n = Gt(t);
    this._pressInMenu = !!n && e.menu.contains(n), !(e.menu.contains(n) || e.button.contains(n)) && this._closeMenu();
  };
  _onWindowScroll = () => {
    this._closeMenu();
  };
  _onFocusOut = (t) => {
    const e = this._open;
    if (!e) return;
    const n = t.relatedTarget;
    !n && this._pressInMenu || n && (e.menu.contains(n) || e.button.contains(n)) || e.menu.contains(t.target) && this._closeMenu();
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
    const n = I(this).getConversationManager();
    if (!n) {
      if (this._warnedNoManager) return;
      this._warnedNoManager = !0, console.warn(
        "[aparte-conversation-list] `manage` is set but no conversation manager is registered, so the row menu writes nothing. Call setConversationManager(manager) on your config, or drop `manage` and handle the events yourself."
      );
      return;
    }
    e(n).catch((i) => {
      console.warn("[aparte-conversation-list] the conversation manager refused the change:", i);
    });
  }
  _onMenuAction(t) {
    const e = this._open;
    if (!e) return;
    const n = this._conversations.find((r) => r.id === e.id);
    if (!n) {
      this._closeMenu();
      return;
    }
    const i = n.id;
    switch (t) {
      case "rename":
        this._closeMenu(), this._startRename(e.row, n);
        return;
      // The two toggles dispatch each name as a LITERAL, in its own branch: the
      // manifest analyzer records a dispatch whose name is a ternary as an event
      // with no name (the Angular generator then crashes on it), and one whose
      // name is a local as an event called after the local.
      case "pin":
        if (this._closeMenu(!0), n.pinnedAt) {
          const r = new CustomEvent(
            "aparte-conversation-unpin",
            { detail: { id: i }, bubbles: !0, composed: !0, cancelable: !0 }
          );
          this.dispatchEvent(r), this._manage(r, (a) => a.unpin(i));
        } else {
          const r = new CustomEvent(
            "aparte-conversation-pin",
            { detail: { id: i }, bubbles: !0, composed: !0, cancelable: !0 }
          );
          this.dispatchEvent(r), this._manage(r, (a) => a.pin(i));
        }
        return;
      case "archive":
        if (this._closeMenu(!0), n.archivedAt) {
          const r = new CustomEvent(
            "aparte-conversation-unarchive",
            { detail: { id: i }, bubbles: !0, composed: !0, cancelable: !0 }
          );
          this.dispatchEvent(r), this._manage(r, (a) => a.unarchive(i));
        } else {
          const r = new CustomEvent(
            "aparte-conversation-archive",
            { detail: { id: i }, bubbles: !0, composed: !0, cancelable: !0 }
          );
          this.dispatchEvent(r), this._manage(r, (a) => a.archive(i));
        }
        return;
      case "delete": {
        const r = [...e.menu.childNodes], a = document.createElement("div");
        a.innerHTML = this._confirmMarkup(n), e.menu.append(...a.childNodes), e.menu.setAttribute("role", "dialog"), e.menu.setAttribute("aria-label", this._confirmQuestion(n)), e.menu.querySelector('[data-menu-action="cancel"]')?.focus();
        for (const o of r) o.remove();
        this._placeMenu(e.button, e.menu);
        return;
      }
      case "cancel":
        this._closeMenu(!0);
        return;
      case "confirm-delete": {
        this._closeMenu(!0);
        const r = new CustomEvent(
          "aparte-conversation-delete",
          { detail: { id: i }, bubbles: !0, composed: !0, cancelable: !0 }
        );
        this.dispatchEvent(r), this._manage(r, (a) => a.delete(i));
        return;
      }
    }
  }
  _menuFocusables() {
    const t = this._open;
    return t ? Array.from(t.menu.querySelectorAll('[role="menuitem"], [data-menu-action]')) : [];
  }
  _onMenuKeydown(t) {
    const e = this._menuFocusables(), n = e.indexOf(wt(this)), i = (r) => {
      t.preventDefault(), e[(r + e.length) % e.length]?.focus();
    };
    switch (t.key) {
      case "Escape":
        t.preventDefault(), this._closeMenu(!0);
        return;
      case "Tab":
        t.preventDefault(), this._closeMenu(!0);
        return;
      case "ArrowDown":
        i(n + 1);
        return;
      case "ArrowUp":
        i(n - 1);
        return;
      case "Home":
        i(0);
        return;
      case "End":
        i(e.length - 1);
        return;
    }
  }
  // ─── Rename ───────────────────────────────────────────────────────────
  _startRename(t, e) {
    const n = t.querySelector(".aparte-conv-item__select");
    if (!n) return;
    const i = document.createElement("input");
    i.type = "text", i.className = "aparte-field aparte-field--sm aparte-conv-item__input", i.value = e.title, i.setAttribute("aria-label", this._t("conversationTitle")), i.dataset.renameId = e.id, n.replaceWith(i), this._renaming = { id: e.id, input: i, done: !1 }, i.addEventListener("blur", (r) => {
      const a = r.relatedTarget;
      this._finishRename(!0, !a || this.contains(a));
    }), i.focus(), i.select();
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
    const n = this._renaming;
    if (!n || n.done) return;
    n.done = !0;
    const i = this._conversations.find((a) => a.id === n.id), r = n.input.value.trim();
    if (this._render(), t && i && r && r !== i.title) {
      const a = new CustomEvent(
        "aparte-conversation-rename",
        { detail: { id: i.id, title: r }, bubbles: !0, composed: !0, cancelable: !0 }
      );
      this.dispatchEvent(a), this._manage(a, (o) => o.updateTitle(i.id, r));
    }
    e && this.querySelector(`[data-select-id="${ct(n.id)}"]`)?.focus();
  }
  // ─── Events ───────────────────────────────────────────────────────────
  _onClick = (t) => {
    const e = t.target, n = e.closest("[data-menu-action]");
    if (n && this._open?.menu.contains(n)) {
      t.stopPropagation(), this._onMenuAction(n.dataset.menuAction);
      return;
    }
    const i = e.closest("[data-more-id]");
    if (i) {
      t.stopPropagation(), this._open?.button === i ? this._closeMenu(!0) : this._openMenu(i.closest("[data-conv-id]"), i);
      return;
    }
    if (e.closest("[data-rename-id]")) return;
    const r = e.closest("[data-select-id]");
    r && (this._closeMenu(), this.dispatchEvent(new CustomEvent(
      "aparte-conversation-select",
      { detail: { id: r.dataset.selectId }, bubbles: !0, composed: !0 }
    )));
  };
  _onKeydown = (t) => {
    const e = t.target;
    if (this._open?.menu.contains(e)) {
      this._onMenuKeydown(t);
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
      const n = e.dataset.convId === this._activeId;
      e.classList.toggle("aparte-conv-item--active", n), e.querySelector("[data-select-id]")?.setAttribute("aria-current", n ? "page" : "false");
    });
  }
}
V(bl);
customElements.get("aparte-conversation-list") || customElements.define("aparte-conversation-list", bl);
const vl = (s) => typeof s == "string" || typeof s == "object" && s !== null && typeof s.label == "string", is = (s) => {
  try {
    const t = JSON.parse(s);
    return Array.isArray(t) ? t.filter(vl) : [];
  } catch {
    return console.warn('[aparte-suggestions] `suggestions` is not a JSON array. Use ["…"] or [{"label": "…", "prompt": "…"}].'), [];
  }
}, Jr = (s) => typeof s == "string" ? s : s.label, ta = (s) => typeof s == "string" ? s : s.prompt ?? s.label;
class yl extends HTMLElement {
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
    const t = this._transcript ? nl(this._transcript) : !0;
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
    this._suggestions = typeof t == "string" ? is(t) : Array.isArray(t) ? t.filter(vl) : [], this.isConnected && this._render();
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
    return I(this).t("suggestionsLabel") || "Suggested prompts";
  }
  _parsed = null;
  /**
   * Parse the `suggestions` attribute once per value. The attribute callback and
   * `connectedCallback` both arrive for a parsed element, in an order the parser
   * decides; without this, an invalid value warned twice.
   */
  _readAttribute() {
    const t = this.getAttribute("suggestions");
    t === null || t === this._parsed || (this._parsed = t, this._suggestions = is(t));
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
      const i = document.getElementById(e)?.querySelector("aparte-composer");
      if (i) return i;
      for (const r of document.querySelectorAll("aparte-composer[target]"))
        if (r.getAttribute("target") === e) return r;
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
    const t = this.getAttribute("target") ?? this._composer?.getAttribute("target") ?? null, e = Rt(this._composer) ?? Rt(this) ?? (t ? document.getElementById(t) : null);
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
    const t = this._transcript?.querySelectorAll("aparte-chat-bubble"), e = t && t.length ? t[t.length - 1] : null, n = e && e.getAttribute("data-role") !== "user" ? e.querySelectorAll("[data-aparte-suggestions]") : null, i = n && n.length ? n[n.length - 1] : null, r = i ? is(i.getAttribute("data-aparte-suggestions") ?? "[]") : [];
    this._showAnswers(r.map(vh).filter((a) => a !== null));
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
      const n = document.createElement("button");
      n.type = "button", n.className = "aparte-btn aparte-btn--surface aparte-btn--pill aparte-suggestion", n.textContent = Jr(e);
      const i = ta(e);
      i !== n.textContent && (n.title = i), n.addEventListener("click", () => this._activate(e)), t.appendChild(n);
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
    const e = t.detail?.targetId, n = this._ownChatId();
    (!e || !n || e === n) && this._stopHolding();
  };
  /** The chat the sending composer belongs to: its `target`, else the id of the chat host above it. */
  _ownChatId() {
    const t = this._composer, e = t?.getAttribute("target");
    if (e) return e;
    for (let n = t?.parentElement ?? null; n; n = n.parentElement)
      if ((n.tagName.toLowerCase() === "aparte-chat" || n.hasAttribute("data-aparte-chat")) && n.id) return n.id;
  }
  /** A chip sent: no other chip sends until the turn has started, or a second has passed without one. */
  _holdUntilStreaming() {
    this._stopHolding(), this._sending = !0, window.addEventListener("aparte-message-start", this._onTurnStart), this._sendingTimer = setTimeout(this._stopHolding, 1e3);
  }
  _activate(t) {
    const e = { label: Jr(t), prompt: ta(t) };
    if (!this.dispatchEvent(new CustomEvent("aparte-suggestion", {
      detail: e,
      bubbles: !0,
      composed: !0,
      cancelable: !0
    }))) return;
    const i = this._composer ?? this._resolveComposer();
    if (!i) {
      console.warn("[aparte-suggestions] no <aparte-composer> to send through — put the element inside one, or point `target` at the chat it serves.");
      return;
    }
    i !== this._composer && this._watchComposer();
    const r = i;
    if (r.panelActive) return;
    const a = this.getAttribute("mode") === "fill";
    if (!a && (r.streaming || this._sending)) return;
    const o = this.contains(document.activeElement), l = typeof i.value == "string" ? i.value : "", c = a ? [] : (i.attachments ?? []).slice();
    if (c.length && i.clearAttachments(), i.setValue(e.prompt), a) i.focus();
    else {
      let d = !1;
      const u = () => {
        d = !0;
      };
      i.addEventListener("aparte-send", u, { once: !0 }), i.submit(), i.removeEventListener("aparte-send", u), d && this._holdUntilStreaming(), c.length && i.addAttachments(c), (typeof i.value == "string" ? i.value : "") !== l && i.setValue(l), o && i.focus();
    }
  }
}
V(yl);
customElements.get("aparte-suggestions") || customElements.define("aparte-suggestions", yl);
const ea = (s, t) => {
  const e = Number(s);
  return s !== null && Number.isFinite(e) && e > 0 && e <= 1 ? e : t;
}, Up = (s) => (s instanceof Element ? s.closest("aparte-chat, [data-aparte-chat]") : null)?.id || void 0, Y = (s, t, e) => {
  const n = document.createElement(s);
  return n.className = t, e !== void 0 && (n.textContent = e), n;
}, na = "http://www.w3.org/2000/svg", Wp = () => {
  const s = document.createElementNS(na, "svg");
  s.setAttribute("class", "aparte-context__ring"), s.setAttribute("viewBox", "0 0 36 36");
  for (const t of ["track", "value"]) {
    const e = document.createElementNS(na, "circle");
    e.setAttribute("class", `aparte-context__${t}`), e.setAttribute("cx", "18"), e.setAttribute("cy", "18"), e.setAttribute("r", "15.5"), t === "value" && e.setAttribute("pathLength", "100"), s.appendChild(e);
  }
  return s;
}, sa = (s) => !!s && typeof s.getMessages == "function", zp = (s) => {
  if (!s) return null;
  if (sa(s)) return s;
  const t = s.viewport ?? s.querySelector("aparte-chat-viewport");
  return sa(t) ? t : null;
};
let Gp = 0;
const jp = { system: 0, tools: 0, summary: 0, messages: 0 };
class wl extends HTMLElement {
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
    const e = t instanceof Element ? Rt(t) : null;
    e && (this._seen = e);
  }
  _onDone = (t) => {
    const e = t.detail;
    !e?.usage || !this._isMine(e.targetId) || (this._remember(t.target), this._used = Rs(e.usage), this._lastDone = { messageId: e.messageId, usage: e.usage }, this._viewChanged = !1, this._blank = !1, this._overflow = !1, this._render());
  };
  /**
   * A conversation is replaced — a new chat, or one loaded in place of the last — and the
   * previous reading is not this one's. The viewport says so with `aparte-reset-done` (no
   * detail: the chat is found from where the event came from). A load clears first and
   * `aparte-conversation-loaded` follows, so the reading is dropped here and read again
   * there. Until then the chat's list is not trusted: a framework's may not have caught up.
   */
  _onReset = (t) => {
    this._isMine(Up(t.target)) && (this._remember(t.target), this._used = null, this._lastDone = null, this._viewChanged = !1, this._overflow = !1, this._compact = null, this._blank = !0, this._render());
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
    const r = [...t.target?.getMessages?.() ?? []].reverse().find((a) => a.role === "assistant" && a.usage);
    this._used = r?.usage ? Rs(r.usage) : null, this._render();
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
    this._isMine(e?.targetId) && e?.error?.code === U.USAGE_CONTEXT_EXCEEDED && (this._remember(t.target), this._overflow = !0, this._render());
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
    return I(this._chat() ?? this);
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
      const i = this.getRootNode().getElementById?.(t) ?? document.getElementById(t);
      if (i) return i;
    }
    const e = Rt(this);
    return e || (this._seen?.isConnected ? this._seen : null);
  }
  /** The chat's active path, or `null` when it cannot be read from here. */
  _messages() {
    const t = zp(this._chat());
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
    const e = this._messages(), n = this._lastDone, i = e && n?.messageId ? e.map((a) => a.id === n.messageId && !a.usage ? { ...a, usage: n.usage } : a) : e, r = !!i?.some((a) => a.role === "assistant" && a.usage);
    return i && (r && !this._blank || this._overflow && i.length > 0) ? zh({ messages: i, config: this._cfg(), windowOverride: t, viewChanged: this._viewChanged }) : this._used === null ? null : { window: t, used: this._used, estimated: !1, parts: { ...jp }, other: this._used };
  }
  _render() {
    const t = this._window(), e = t === null ? null : this._measure(t);
    if (this._compact ? this.setAttribute("data-compact", this._compact) : this.removeAttribute("data-compact"), t === null || e === null) {
      this._measured = null, this.setAttribute("data-empty", ""), this.removeAttribute("data-level"), this._open = !1, this._stopListeningWhileOpen(), this._panelSignature = "", this.replaceChildren(), this._level = null;
      return;
    }
    this._measured = e, this.removeAttribute("data-empty");
    const n = e.used, i = Math.min(1, n / t), r = ea(this.getAttribute("warn"), 0.75), a = ea(this.getAttribute("danger"), 0.9), o = this._overflow || i >= a ? "danger" : i >= r ? "warn" : "ok";
    this.setAttribute("data-level", o);
    const l = this.getAttribute("variant") === "ring";
    let c = this.querySelector(".aparte-context");
    c && c.classList.contains("aparte-context--ring") !== l && (this.replaceChildren(), c = null, this._panelSignature = "");
    let d = this.querySelector('[role="meter"]'), u = this.querySelector(".aparte-context__text"), h = this.querySelector(".aparte-context__toggle"), p = this.querySelector(".aparte-context__name"), f = this.querySelector(".aparte-context__panel");
    (!c || !d || !u || !h || !p || !f) && (c = Y("div", l ? "aparte-context aparte-context--ring" : "aparte-context"), d = l ? Wp() : Y("div", "aparte-progress"), d.setAttribute("role", "meter"), l || d.appendChild(Y("div", "aparte-progress__bar")), h = Y("button", "aparte-btn aparte-btn--ghost aparte-btn--sm aparte-context__toggle"), h.type = "button", p = Y("span", "aparte-sr-only"), p.classList.add("aparte-context__name"), u = Y("span", "aparte-context__text"), h.append(p, u), f = Y("div", "aparte-context__panel aparte-popover"), f.id = `aparte-context-panel-${++Gp}`, f.setAttribute("role", "group"), f.hidden = !0, h.setAttribute("aria-controls", f.id), c.append(d, h, f), this.replaceChildren(c), this._panelSignature = "");
    const _ = this._cfg(), g = _.getLocale().tag || void 0, m = new Intl.NumberFormat(g, { notation: "compact", maximumFractionDigits: 1 }), A = e.estimated ? "~" : "", k = `${A}${m.format(n)} / ${m.format(t)}`, y = Math.round(i * 100), b = _.t("contextLabel") || "Context window";
    if (l) {
      const v = d.querySelector(".aparte-context__value");
      v?.style.setProperty("--aparte-context-ratio", String(y)), v?.classList.toggle("aparte-context__value--empty", y === 0), c.title = k;
    } else
      d.style.setProperty("--aparte-progress-value", String(y));
    if (d.setAttribute("aria-valuemin", "0"), d.setAttribute("aria-valuemax", String(t)), d.setAttribute("aria-valuenow", String(n)), d.setAttribute("aria-label", `${b}: ${k}`), p.textContent = `${b}: `, h.setAttribute("aria-expanded", String(this._open)), u.textContent = l ? `${A}${new Intl.NumberFormat(g, { style: "percent", maximumFractionDigits: 0 }).format(y / 100)}` : k, f.setAttribute("aria-label", b), f.hidden = !this._open, this._open ? this._renderPanel(f, e, t, m) : this._panelSignature = "", o !== this._level) {
      this._level = o;
      const v = this._ownTargetId(), w = { level: o, used: n, window: t, ratio: i, targetId: v };
      this.dispatchEvent(new CustomEvent("aparte-context-threshold", { detail: w, bubbles: !0, composed: !0 }));
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
  _renderPanel(t, e, n, i) {
    const r = this._cfg(), a = r.getCompactor(), o = this._chat(), l = this._ownTargetId();
    let c = null;
    try {
      c = a?.preview?.({ target: o, ...l ? { targetId: l } : {} }) ?? null;
    } catch {
      c = null;
    }
    const { parts: d, used: u } = e, h = d.system + d.tools + d.summary + d.messages, p = h > u && h > 0 ? u / h : 1, f = e.estimated ? "~" : "", _ = [
      { key: "system", label: r.t("contextSystem") || "System prompt", tokens: d.system * p, approx: "~" },
      { key: "tools", label: r.t("contextTools") || "Tools", tokens: d.tools * p, approx: "~" },
      { key: "summary", label: r.t("contextSummary") || "Summary", tokens: d.summary * p, approx: "~" },
      { key: "messages", label: r.t("contextMessages") || "Messages", tokens: d.messages * p, approx: "~" },
      { key: "other", label: r.t("contextOther") || "Other", tokens: p < 1 ? 0 : e.other, approx: "~" },
      { key: "free", label: r.t("contextFree") || "Free", tokens: Math.max(0, n - u), approx: f }
    ], g = `${f}${i.format(u)} / ${i.format(n)}`, m = c && c.tokens > 0 ? (r.t("contextReclaim") || "Compacting now would free ~{n} tokens").replace("{n}", () => i.format(Math.round(c.tokens))) : "", A = !!a && !!c && this._compact === null, k = Y("ul", "aparte-context__rows");
    for (const S of _) {
      const x = Y("li", "aparte-context__row");
      x.setAttribute("data-part", S.key), x.append(Y("span", "aparte-context__row-label", S.label)), x.append(Y("span", "aparte-context__row-value", `${S.approx}${i.format(Math.round(S.tokens))}`));
      const L = Y("div", "aparte-progress aparte-context__row-bar");
      L.setAttribute("aria-hidden", "true"), L.style.setProperty("--aparte-progress-value", String(Math.round(Math.min(1, S.tokens / n) * 100))), L.appendChild(Y("div", "aparte-progress__bar")), x.append(L), k.append(x);
    }
    const y = Y("li", "aparte-context__row aparte-context__row--total");
    y.setAttribute("data-part", "total"), y.append(Y("span", "aparte-context__row-label", r.t("contextTotal") || "Total"), Y("span", "aparte-context__row-value", g)), k.append(y);
    const b = [k];
    if (this._compact === "running") {
      const S = Y("p", "aparte-context__status aparte-shimmer", r.t("checkpointPending") || "Summarising the context…");
      S.setAttribute("role", "status"), b.push(S);
    } else if (this._compact === "failed") {
      const S = Y("p", "aparte-context__status aparte-context__status--failed", r.t("checkpointFailed") || "Couldn't summarise the context");
      S.setAttribute("role", "status"), this._failure && (S.title = this._failure, S.appendChild(Y("span", "aparte-sr-only", `: ${this._failure}`))), b.push(S, this._action("retry", r.t("retry") || "Retry"));
    }
    m && b.push(Y("p", "aparte-context__reclaim", m)), A && b.push(this._action("compact", r.t("contextCompactNow") || "Compact now"));
    const v = Y("div", "aparte-context__content");
    if (v.append(...b), v.innerHTML === this._panelSignature) return;
    this._panelSignature = v.innerHTML;
    const w = document.activeElement, T = w && t.contains(w) ? w.getAttribute("data-context-action") ?? "" : null;
    t.replaceChildren(...Array.from(v.childNodes)), T !== null && ((T ? t.querySelector(`[data-context-action="${ct(T)}"]`) : null) ?? this.querySelector(".aparte-context__toggle"))?.focus();
  }
  _action(t, e) {
    const n = Y("button", "aparte-btn aparte-btn--sm aparte-btn--surface aparte-context__action", e);
    return n.type = "button", n.setAttribute("data-context-action", t), n;
  }
  /**
   * Ask the registered compactor to compact this chat now, as a person asked. With none
   * registered (Retry only — Compact now is not offered without one) the command event
   * is the way to ask, the one a host's own button uses.
   */
  async _compactNow(t) {
    const e = this._cfg().getCompactor(), n = this._ownTargetId();
    if (!e) {
      window.dispatchEvent(new CustomEvent("aparte-compact", { detail: { targetId: n } }));
      return;
    }
    this._compact = "running", this._failure = "", this._render();
    let i = null;
    try {
      const r = await e.compact({ target: this._chat(), ...n ? { targetId: n } : {}, force: !0, reason: t });
      r.ok ? r.skipped || (this._viewChanged = !0) : i = r.error;
    } catch (r) {
      i = r instanceof Error ? r.message : String(r);
    }
    this._compact === "running" && (this._compact = i === null ? null : "failed", this._failure = i ?? ""), this.isConnected && this._render();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // The disclosure
  // ─────────────────────────────────────────────────────────────────────────
  _onClick = (t) => {
    const e = t.target, n = e?.closest?.("[data-context-action]");
    if (n) {
      this._compactNow(n.getAttribute("data-context-action") === "retry" ? "retry" : "manual");
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
    const e = this.getBoundingClientRect(), n = t.getBoundingClientRect();
    n.height > 0 && e.top < n.height && t.setAttribute("data-placement", "below");
    const r = getComputedStyle(t).direction === "rtl" ? n.left < 0 : n.right > document.documentElement.clientWidth;
    n.width > 0 && r && t.setAttribute("data-align", "end");
  }
}
V(wl);
customElements.get("aparte-context") || customElements.define("aparte-context", wl);
const Je = 60, Kp = 6, Vp = 150, Xp = 4, Yp = 1, ia = 30;
class Sl extends HTMLElement {
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
          if (kl(e.target)) {
            this._queueRebuild();
            return;
          }
          continue;
        }
        const i = (e.target instanceof Element ? e.target : e.target.parentElement)?.closest("aparte-chat-bubble");
        if (i) {
          this._excerpts.delete(i), this._ticked(i) && this._queueRelabel(i);
          continue;
        }
        if (e.type === "childList" && (ra(e.addedNodes) || ra(e.removedNodes))) {
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
      const e = I(this).getLocale();
      for (const n of t) this._label(n, e);
    }));
  }
  /** Whether a bubble has a tick: every message with `every="message"`, else the user's. */
  _ticked(t) {
    return t.hasAttribute("message-id") ? this.getAttribute("every") === "message" || t.getAttribute("data-role") === "user" : !1;
  }
  /** Re-name one bubble's tick, written only when the name changed. */
  _label(t, e) {
    if (!this._host?.contains(t)) return;
    const n = t.getAttribute("message-id");
    if (!n) return;
    const i = this.querySelector(`.aparte-scroll-rail__tick[data-message-id="${ct(n)}"]`);
    if (!i) return;
    const r = this._tickLabel(t, e);
    i.getAttribute("aria-label") !== r && (i.setAttribute("aria-label", r), i.title = r);
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
    return (this.getAttribute("every") === "message" ? "message" : "user") === "message" ? t : t.filter((n) => n.getAttribute("data-role") === "user");
  }
  // ─── Rendering ────────────────────────────────────────────────────────
  /** The first words of a message, for the tick's name. An excerpt, never a summary. */
  _excerpt(t) {
    const e = this._excerpts.get(t);
    if (e !== void 0) return e;
    const n = t.querySelector(".aparte-message-content") ?? t;
    let i = "";
    const r = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    for (let l = r.nextNode(); l && i.length < Je * 16; l = r.nextNode()) i += l.nodeValue ?? "";
    const a = i.slice(0, Je * 16).replace(/\s+/g, " ").trim(), o = a.length > Je ? `${a.slice(0, Je - 1).trimEnd()}…` : a;
    return this._excerpts.set(t, o), o;
  }
  _tickLabel(t, e) {
    const n = t.getAttribute("data-role") === "user" ? e.roleNameUser ?? "You" : e.roleNameAssistant ?? "Assistant", i = this._excerpt(t);
    return i ? `${n}: ${i}` : n;
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
    const t = this._messages(), e = this._bubbles(t), n = I(this).getLocale(), i = n.scrollRailLabel ?? "Conversation outline";
    if (this.getAttribute("aria-label") !== i && this.setAttribute("aria-label", i), e.length < 2) {
      this.setAttribute("data-empty", ""), this.replaceChildren(), this._unobserve(), this._currentId = null, this._write("--aparte-scroll-rail-hit-size", ""), this._write("--aparte-scroll-rail-gap", "");
      return;
    }
    this.removeAttribute("data-empty");
    let r = this._list();
    r || (r = document.createElement("ol"), r.className = "aparte-scroll-rail__list", this.replaceChildren(r));
    const a = /* @__PURE__ */ new Map();
    for (const d of Array.from(r.children)) {
      const u = d.firstElementChild instanceof HTMLElement ? d.firstElementChild.dataset.messageId : void 0;
      u && a.set(u, d);
    }
    const o = new Set(e.map((d) => d.getAttribute("message-id")));
    for (const [d, u] of a)
      o.has(d) || (u.remove(), a.delete(d));
    let l = r.firstElementChild;
    for (const d of e) {
      const u = d.getAttribute("message-id");
      let h = a.get(u);
      if (!h) {
        h = document.createElement("li");
        const _ = document.createElement("button");
        _.type = "button", _.className = "aparte-scroll-rail__tick", _.dataset.messageId = u, _.tabIndex = -1, h.appendChild(_);
      }
      const p = h.firstElementChild, f = this._tickLabel(d, n);
      p.getAttribute("aria-label") !== f && (p.setAttribute("aria-label", f), p.title = f), u === this._currentId ? p.getAttribute("aria-current") !== "true" && p.setAttribute("aria-current", "true") : p.removeAttribute("aria-current"), h === l ? l = l.nextElementSibling : r.insertBefore(h, l);
    }
    const c = this._currentId !== null && !o.has(this._currentId);
    c && (this._currentId = null), this._syncTabStop(), (!rs(this._observedBubbles, e) || !rs(this._bandTargets, t)) && this._observe(e, t), this._layout(), c && this._pickCurrent();
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
    const n = typeof IntersectionObserver > "u" ? null : this._scrollSurface();
    if (!n) {
      this._unobserve(), this._observedBubbles = t, this._bandTargets = e;
      return;
    }
    (!this._intersections || !this._onScreenObserver || this._observedSurface !== n) && (this._unobserve(), this._intersections = new IntersectionObserver((l) => {
      for (const c of l) this._visible.set(c.target, c.isIntersecting ? c.intersectionRatio : 0);
      this._pickCurrent();
    }, { root: n, rootMargin: `0px 0px -${100 - ia}% 0px`, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }), this._onScreenObserver = new IntersectionObserver((l) => {
      for (const c of l)
        c.isIntersecting ? this._onScreen.add(c.target) : this._onScreen.delete(c.target);
      this._pickCurrent();
    }, { root: n, threshold: [0] }), this._observedSurface = n, n.addEventListener("scroll", this._onRootScroll, { passive: !0 }));
    const i = new Set(e);
    for (const l of this._bandTargets) i.has(l) || this._intersections.unobserve(l);
    const r = new Set(this._bandTargets);
    for (const l of e) r.has(l) || this._intersections.observe(l);
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
    const e = t[t.length - 1], n = e.getAttribute("message-id");
    if (this._atBottom() || this._onScreen.has(e)) {
      this._setCurrent(n);
      return;
    }
    let i = null, r = null, a = !1;
    for (const o of this._bandTargets)
      this._ticked(o) && (r = o.getAttribute("message-id")), (this._visible.get(o) ?? 0) > 0 && (a = !0, r !== null && (i = r));
    i === null && a || (i ??= this._lastAbove(), i !== null && this._setCurrent(i));
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
    const n = t.getBoundingClientRect();
    if (n.height <= 0) return null;
    const i = n.top + n.height * ia / 100;
    let r = 0, a = e.length - 1, o = -1;
    for (; r <= a; ) {
      const l = r + a >> 1;
      e[l].getBoundingClientRect().top < i ? (o = l, r = l + 1) : a = l - 1;
    }
    return o < 0 ? null : e[o].getAttribute("message-id");
  }
  /** The tick a message is read under: its own, else the question above it, as the band reads a reply. */
  _markFor(t) {
    const e = t.getAttribute("message-id");
    if (this._ticked(t)) return e;
    let n = null;
    for (const i of this._messages()) {
      if (i === t) break;
      this._ticked(i) && (n = i.getAttribute("message-id"));
    }
    return n ?? e;
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
    const n = t ? null : wt(this), i = (n instanceof HTMLElement && e.includes(n) ? n : void 0) ?? e.find((r) => r.dataset.messageId === this._currentId) ?? e[e.length - 1];
    this._setTabStop(i, e);
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
    for (const n of e) {
      const i = n === t ? 0 : -1;
      n.tabIndex !== i && (n.tabIndex = i);
    }
  }
  /** Past the floor the rail scrolls itself: the current tick is kept inside its window. */
  _reveal(t) {
    const e = this.clientHeight;
    if (!e) return;
    const n = t.offsetTop, i = n + t.offsetHeight;
    n < this.scrollTop ? this.scrollTop = n : i > this.scrollTop + e && (this.scrollTop = i - e);
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
    if (!rs(this._sized, t)) {
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
    const t = this._host, e = this._viewport(), n = this._scrollSurface();
    if (t && n && this._write("--aparte-scroll-rail-bar", `${Math.max(0, n.offsetWidth - n.clientWidth)}px`), t && e) {
      const h = e.getBoundingClientRect(), p = t.getBoundingClientRect();
      h.height > 0 && p.height > 0 && (this._write("--aparte-scroll-rail-block-start", `${Math.max(0, Math.round(h.top - p.top))}px`), this._write("--aparte-scroll-rail-block-end", `${Math.max(0, Math.round(p.bottom - h.bottom))}px`));
    }
    const i = t ?? document.documentElement, r = getComputedStyle(i), a = parseFloat(r.getPropertyValue("--aparte-scroll-rail-hit-size")) || 24, o = parseFloat(r.getPropertyValue("--aparte-scroll-rail-tick-thickness")) || 2;
    (this._written.get("--aparte-scroll-rail-hit-size") ?? "") !== "" && this.scrollHeight <= this.clientHeight + 1 && (this._write("--aparte-scroll-rail-hit-size", ""), this._write("--aparte-scroll-rail-gap", ""));
    const c = this.clientHeight, d = this._list()?.children.length ?? 0;
    if (!d || !c || d * a <= c) {
      this._write("--aparte-scroll-rail-hit-size", ""), this._write("--aparte-scroll-rail-gap", "");
      return;
    }
    const u = Math.max(Kp, Math.floor(c / d));
    this._write("--aparte-scroll-rail-hit-size", `${u}px`), this._write("--aparte-scroll-rail-gap", `${Math.max(0, u - o)}px`);
  }
  // ─── Interaction ──────────────────────────────────────────────────────
  _onClick = (t) => {
    const e = t.target.closest(".aparte-scroll-rail__tick");
    if (!e || !this.contains(e)) return;
    const n = e.dataset.messageId;
    n && this.jumpTo(n);
  };
  /** The ticks are buttons; the arrows walk them, as in any toolbar. */
  _onKeydown = (t) => {
    if (t.key !== "ArrowDown" && t.key !== "ArrowUp" && t.key !== "Home" && t.key !== "End") return;
    const e = Array.from(this.querySelectorAll(".aparte-scroll-rail__tick")), n = e.indexOf(wt(this));
    if (n === -1) return;
    t.preventDefault();
    const i = t.key === "Home" ? 0 : t.key === "End" ? e.length - 1 : t.key === "ArrowDown" ? Math.min(e.length - 1, n + 1) : Math.max(0, n - 1), r = e[i];
    r && (this._setTabStop(r, e), r.focus());
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
    const n = this._bubbleOf(t);
    n && (this._viewport()?.setAutoScroll?.(!1), this._scrollTo(n), this._setCurrent(this._markFor(n)), this._hold(t));
  }
  _bubbleOf(t) {
    return this._viewport()?.querySelector(`aparte-chat-bubble[message-id="${ct(t)}"]`) ?? null;
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
    this._settleTimer !== null && clearTimeout(this._settleTimer), this._settleTimer = setTimeout(() => this._settle(), Vp);
  }
  /** The transcript is still: land on the message if the scroll did not, else release the hold. */
  _settle() {
    const t = this._held, e = this._settleSurface, n = t ? this._bubbleOf(t) : null;
    if (t && n && e && this._alignPasses < Xp) {
      const i = e.getBoundingClientRect().top + (parseFloat(getComputedStyle(e).scrollPaddingTop) || 0), r = n.getBoundingClientRect().top - i;
      if (Math.abs(r) > Yp) {
        this._alignPasses++, this._scrollTo(n), this._bumpSettle();
        return;
      }
    }
    this._release(), t && this._setCurrent(n ? this._markFor(n) : t);
  }
  _release() {
    this._settleTimer !== null && clearTimeout(this._settleTimer), this._settleTimer = null, this._settleSurface?.removeEventListener("scroll", this._onSurfaceScroll), this._settleSurface = null, this._held = null;
  }
}
function kl(s) {
  return s instanceof Element && s.localName === "aparte-chat-bubble";
}
function ra(s) {
  return Array.from(s).some((t) => t instanceof Element && (kl(t) || t.localName === "aparte-chat-viewport" || t.querySelector("aparte-chat-bubble") !== null));
}
function rs(s, t) {
  if (s.length !== t.length) return !1;
  for (let e = 0; e < s.length; e++) if (s[e] !== t[e]) return !1;
  return !0;
}
V(Sl);
customElements.get("aparte-scroll-rail") || customElements.define("aparte-scroll-rail", Sl);
const Qp = "(max-width: 48rem)";
class Al extends HTMLElement {
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
    this.toggleAttribute("collapsed", st(t));
  }
  /** True while the window is under the breakpoint and the sidebar is a drawer. */
  get drawer() {
    return this.hasAttribute("data-drawer");
  }
  connectedCallback() {
    this.classList.contains("aparte-sidebar") || this.classList.add("aparte-sidebar"), this.getAttribute("role") || this.setAttribute("role", "complementary"), this._relabel(), this._hostIntentSeeded || (this._closedByHost = this.collapsed, this._hostIntentSeeded = !0), this.addEventListener("input", this._onInput), typeof MutationObserver == "function" && (this._listWatch = new MutationObserver((t) => {
      t.some((e) => e.target !== this) && this._syncNoMatch();
    }), this._listWatch.observe(this, { subtree: !0, attributes: !0, attributeFilter: ["data-no-match", "loading"] })), document.addEventListener("keydown", this._onKeydown), document.addEventListener("click", this._onDocumentClick), window.addEventListener("aparte-config-change", this._onConfigChange), this._watchBreakpoint(), this._syncHidden(), this._lastCollapsed = this.collapsed, this.id || (this.id = `aparte-sidebar-${++Zp}`), this._syncToggles(), this._ready = !0;
  }
  /**
   * The drawer's media query, from the `breakpoint` attribute: a length (`48rem`, the
   * default, or `640px`), or `none` for a column that never becomes a drawer — which
   * a narrow host that has room for it wants, and a documentation frame needs.
   */
  _watchBreakpoint() {
    this._media?.removeEventListener("change", this._onMediaChange), this._media = null;
    const t = (this.getAttribute("breakpoint") ?? "").trim();
    if (t === "none") {
      this._applyDrawer(!1);
      return;
    }
    if (typeof matchMedia != "function") return;
    const e = t ? `(max-width: ${t})` : Qp;
    this._media = matchMedia(e), this._media.addEventListener("change", this._onMediaChange), this._applyDrawer(this._media.matches);
  }
  disconnectedCallback() {
    this.removeEventListener("input", this._onInput), this._listWatch?.disconnect(), this._listWatch = null, document.removeEventListener("keydown", this._onKeydown), document.removeEventListener("click", this._onDocumentClick), window.removeEventListener("aparte-config-change", this._onConfigChange), this._media?.removeEventListener("change", this._onMediaChange), this._media = null, this._ready = !1;
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
  _onMediaChange = (t) => this._applyDrawer(t.matches);
  /**
   * Entering the drawer state closes the sidebar: a narrow window that opens on an
   * overlay covering the chat is the wrong first screen. Leaving it reopens, since
   * a wide window has room for the column — unless the host had collapsed it before.
   */
  _applyDrawer(t) {
    const e = this.drawer;
    this.toggleAttribute("data-drawer", t), this._auto = !0;
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
    const t = "[data-aparte-sidebar-toggle]", e = ne(this), n = e === document ? Array.from(document.querySelectorAll(t)) : [...e.querySelectorAll(t), ...document.querySelectorAll(t)];
    for (const i of n)
      St(i) || !this._drives(i) || (i.setAttribute("aria-expanded", String(!this.collapsed)), i.setAttribute("aria-controls", this.id));
  }
  /** Whether a toggle control targets this sidebar: named by id, else the nearest one. */
  _drives(t) {
    const e = t.getAttribute("data-aparte-sidebar-toggle");
    return e ? e === this.id : tf(t) === this;
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
    aa(this)[0]?.focus();
  }
  _syncScrim() {
    const t = this.drawer && !this.collapsed;
    t && !this._scrim ? (this._scrim = document.createElement("div"), this._scrim.className = "aparte-sidebar__scrim", this._scrim.setAttribute("aria-hidden", "true"), this._scrim.addEventListener("click", () => this.close()), this.appendChild(this._scrim)) : !t && this._scrim && (this._scrim.remove(), this._scrim = null);
  }
  _onKeydown = (t) => {
    if (!(!this.drawer || this.collapsed)) {
      if (t.key === "Escape") {
        t.preventDefault(), this.close();
        return;
      }
      if (t.key === "Tab") {
        const e = aa(this);
        if (e.length === 0) return;
        const n = e[0], i = e[e.length - 1], r = wt(this);
        this.contains(r) ? t.shiftKey && r === n ? (t.preventDefault(), i.focus()) : !t.shiftKey && r === i && (t.preventDefault(), n.focus()) : (t.preventDefault(), n.focus());
      }
    }
  };
  /** A `[data-aparte-sidebar-toggle]` anywhere toggles this sidebar — no script in the host. */
  _onDocumentClick = (t) => {
    const e = Gt(t)?.closest?.("[data-aparte-sidebar-toggle]");
    !e || St(e) || this._drives(e) && this.toggle(e);
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
    let e = 0, n = !1;
    for (const i of this._lists())
      typeof i.filter == "function" ? e += i.filter(t) : (e += Ns(i, wn(t)), n = !0);
    return n && typeof customElements < "u" && customElements.whenDefined("aparte-conversation-list").then(() => {
      if (this._query === t) for (const i of this._lists()) i.filter?.(t);
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
    const t = wn(this._query), e = t !== "" && this._lists().every((n) => typeof n.filter == "function" ? n.hasAttribute("data-no-match") : !n.hasAttribute("loading") && Ns(n, t) === 0);
    this.toggleAttribute("data-no-match", e);
  }
  // ─── Locale ───────────────────────────────────────────────────────────
  _onConfigChange = () => this._relabel();
  _relabel() {
    if (this.hasAttribute("aria-label") && this.dataset.ownLabel !== "locale") return;
    const t = I(this).getLocale();
    this.setAttribute("aria-label", t.sidebarLabel ?? "Conversations"), this.dataset.ownLabel = "locale";
  }
}
let Zp = 0;
const Jp = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");
function aa(s) {
  return Array.from(s.querySelectorAll(Jp)).filter((t) => !t.closest("[hidden]") && t.checkVisibility?.() !== !1);
}
function tf(s) {
  return s.closest("aparte-sidebar") ?? ne(s).querySelector("aparte-sidebar") ?? document.querySelector("aparte-sidebar");
}
V(Al);
customElements.get("aparte-sidebar") || customElements.define("aparte-sidebar", Al);
function oa(s, t, e) {
  return Number.isFinite(s) ? s < t ? t : s > e ? e : s : t;
}
function ef(s) {
  const t = Number.isFinite(s.startPercent) ? s.startPercent : 0;
  if (!Number.isFinite(s.containerPx) || s.containerPx <= 0) return oa(t, 0, 100);
  const i = ((!s.vertical && s.rtl) !== (s.primaryEnd === !0) ? -1 : 1) * s.deltaPx * 100 / s.containerPx;
  return oa(t + i, 0, 100);
}
function la(s, t, e, n, i = !1) {
  if (s === "Home") return -100;
  if (s === "End") return 100;
  const r = (t ? 10 : 1) * (i ? -1 : 1);
  return n ? s === "ArrowUp" ? -r : s === "ArrowDown" ? r : null : s === "ArrowLeft" ? e ? r : -r : s === "ArrowRight" ? e ? -r : r : null;
}
const nf = "(max-width: 48rem)", ge = 38, sf = 300;
function _e(s, t) {
  const e = Number.parseFloat(s ?? "");
  return Number.isFinite(e) ? e < 0 ? 0 : e > 100 ? 100 : e : t;
}
class $n extends HTMLElement {
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
  _position = ge;
  /** What `reset()` — and a double-click on the seam — goes back to. */
  _initialPosition = ge;
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
  _dragStartPercent = ge;
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
    const e = _e(String(t), this._position);
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
    this.toggleAttribute("collapsed", st(t));
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
    this.toggleAttribute("disabled", st(t));
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
    this.toggleAttribute("single", st(t));
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
    t !== null ? (this._position = _e(t, ge), this._setLive(this._position)) : this._position = _e(
      getComputedStyle(this).getPropertyValue("--aparte-split-position"),
      ge
    ), this._initialCaptured || (this._initialPosition = this._position, this._initialCaptured = !0), this.collapsed && (this._lastCollapsed !== !0 && (this._preCollapsePosition = this._position), this._position = 0, this._setLive(0)), this._lastPosition = this._position, this._lastCollapsed = this.collapsed, this._lastPane = this.pane, this._stampHandle(), this._relabel(), this._measureBounds(), this._handle.addEventListener("pointerdown", this._onPointerDown), this._handle.addEventListener("dblclick", this._onDoubleClick), this._handle.addEventListener("focusout", this._onFocusOut), this.addEventListener("keydown", this._onKeydown), this.addEventListener("keyup", this._onKeyup), document.addEventListener("click", this._onDocumentClick), window.addEventListener("aparte-config-change", this._onConfigChange), this._watchBreakpoint(), this._watchSize(), this._ready = !0, this._syncPaneControls();
  }
  disconnectedCallback() {
    this._handle?.removeEventListener("pointerdown", this._onPointerDown), this._handle?.removeEventListener("dblclick", this._onDoubleClick), this._handle?.removeEventListener("focusout", this._onFocusOut), this.removeEventListener("keydown", this._onKeydown), this.removeEventListener("keyup", this._onKeyup), document.removeEventListener("click", this._onDocumentClick), window.removeEventListener("aparte-config-change", this._onConfigChange), this._releasePointer(), this._media?.removeEventListener("change", this._onMediaChange), this._media = null, this._observer?.disconnect(), this._observer = null, this._measureRafId !== null && (cancelAnimationFrame(this._measureRafId), this._measureRafId = null), this._removeScrim(), this._endMove?.(), this._handle?.removeAttribute("data-dragging"), this._dragging = !1, this._keying = !1, this._ready = !1;
  }
  attributeChangedCallback(t) {
    if (this._ready)
      switch (t) {
        case "position": {
          const e = _e(this.getAttribute("position"), this._position);
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
    const t = this.orientation === "vertical", e = t ? "gridTemplateRows" : "gridTemplateColumns", n = t ? this.clientHeight : this.clientWidth;
    if (n <= 0) return;
    this.setAttribute("data-moving", "");
    const i = getComputedStyle(this)[e];
    if (i.trim().split(/\s+/).length !== 3) {
      this.removeAttribute("data-moving");
      return;
    }
    const r = this.pane === "end" ? "end" : "start", a = r === "end" ? `0px 0px ${n}px` : `${n}px 0px 0px`, o = this.single, l = i.trim().split(/\s+/), c = this.children[r === "end" ? 0 : 2], d = t ? "blockSize" : "inlineSize", u = t ? "alignSelf" : "justifySelf", h = c ? { size: c.style[d], align: c.style[u] } : null;
    c && (c.style[d] = l[r === "end" ? 0 : 2], c.style[u] = r === "end" ? "end" : "start"), this.style[e] = o ? i : a, this.offsetWidth, this.setAttribute("data-moving", "run"), this.style[e] = o ? a : i;
    let p = null;
    const f = (m) => {
      m.target === this && m.propertyName.startsWith("grid-template") && _();
    }, _ = () => {
      p !== null && clearTimeout(p), this.removeEventListener("transitionend", f), this.style.removeProperty(t ? "grid-template-rows" : "grid-template-columns"), c && h && (c.style[d] = h.size, c.style[u] = h.align), this.removeAttribute("data-moving"), this._endMove = null, this._measureBounds();
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
      (i) => i instanceof HTMLElement && i.classList.contains("aparte-split__handle")
    );
    if (t) {
      if (this.children[1] !== t) {
        const i = Array.from(this.children).filter((r) => r !== t)[1] ?? null;
        this.insertBefore(t, i);
      }
      return t;
    }
    const e = document.createElement("div");
    e.className = "aparte-split__handle";
    const n = this.children[1] ?? null;
    return n ? this.insertBefore(e, n) : this.appendChild(e), e;
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
    e && (e.id || (e.id = `aparte-split-pane-${++$n._paneIdSeq}`), t.setAttribute("aria-controls", e.id));
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
    const e = this._primaryPane(), n = this._measure(this);
    if (!e || !(n > 0)) {
      t.setAttribute("aria-valuemin", "0"), t.setAttribute("aria-valuemax", "100");
      return;
    }
    const i = this.style.getPropertyValue("--aparte-split-position");
    this.style.setProperty("--aparte-split-position", "0%");
    const r = this._measure(e) / n * 100;
    this.style.setProperty("--aparte-split-position", "100%");
    const a = this._measure(e) / n * 100;
    i ? this.style.setProperty("--aparte-split-position", i) : this.style.removeProperty("--aparte-split-position"), t.setAttribute("aria-valuemin", String(Math.round(r))), t.setAttribute("aria-valuemax", String(Math.round(a))), t.setAttribute("aria-valuenow", String(Math.round(this._achievedPercent())));
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
    this._position = ef({
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
    const n = this._moved;
    this._dragging = !1, this._moved = !1, this._releasePointer(), this._handle?.removeAttribute("data-dragging"), this._removeScrim(!n), e !== void 0 && (this._position = e, this._setLive(e)), !(!n && e === void 0) && (this._measureBounds(), this._commit(t));
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
      e.style.pointerEvents = "none", setTimeout(() => e.remove(), sf);
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
    const e = la(
      t.key,
      t.shiftKey,
      this._rtl(),
      this.orientation === "vertical",
      this.primary === "end"
    );
    e !== null && (t.preventDefault(), this._keying = !0, this._position = _e(String(this._position + e), this._position), this._setLive(this._position));
  };
  /**
   * The keyup commits, not the keydown: a held arrow repeats, and one release should
   * write one attribute and send one event, not thirty.
   */
  _onKeyup = (t) => {
    !this._keying || t.target !== this._handle || la(t.key, t.shiftKey, this._rtl(), this.orientation === "vertical") !== null && (this._keying = !1, this._commit("keyboard"));
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
    const e = t ? `(max-width: ${t})` : nf;
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
    const e = Gt(t)?.closest?.("[data-aparte-split-pane]");
    if (!e || St(e)) return;
    const n = (e.getAttribute("data-aparte-split-pane") ?? "").trim(), i = n === "start" || n === "end" ? n : null, r = i ? "" : n;
    if (r) {
      if (r !== this.id) return;
    } else if ((e.closest("aparte-split") ?? ne(e).querySelector("aparte-split") ?? document.querySelector("aparte-split")) !== this) return;
    this.showPane(i ?? (this.pane === "start" ? "end" : "start"));
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
    const t = /* @__PURE__ */ new Set([ne(this), document]);
    for (const e of t)
      for (const n of e.querySelectorAll("[data-aparte-split-pane]")) {
        const i = (n.getAttribute("data-aparte-split-pane") ?? "").trim();
        i !== "start" && i !== "end" || n.localName !== "button" && n.getAttribute("role") !== "button" || St(n) || (n.closest("aparte-split") ?? ne(n).querySelector("aparte-split") ?? document.querySelector("aparte-split")) !== this || (this.stacked ? n.setAttribute("aria-pressed", String(i === this.pane)) : n.removeAttribute("aria-pressed"));
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
    const e = I(this).getLocale();
    t.setAttribute("aria-label", this.getAttribute("label") ?? e.splitHandleLabel ?? "Resize the panes"), t.dataset.ownLabel = "locale";
  }
}
V($n);
customElements.get("aparte-split") || customElements.define("aparte-split", $n);
const rf = "(max-width: 30rem), (max-height: 30rem)", af = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");
class vt extends HTMLElement {
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
    this.toggleAttribute("open", st(t));
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
    this.toggleAttribute("maximized", st(t));
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
      t.some((e) => e.target === this || vt._touchesParts(e)) && this._onChildren();
    }), this._childWatch.observe(this, { childList: !0, subtree: !0 }), this._hostWatch ??= new MutationObserver(() => this._render()), this._hostWatch.observe(this, { attributes: !0, attributeFilter: [pn], subtree: !0 })), this.addEventListener("click", this._onClick), this.addEventListener("keydown", this._onKeydown), window.addEventListener("aparte-config-change", this._onConfigChange), this._watchBreakpoint(), this._lastOpen = this.open, this._render(), this._ready = !0;
  }
  disconnectedCallback() {
    this.removeEventListener("click", this._onClick), this.removeEventListener("keydown", this._onKeydown), window.removeEventListener("aparte-config-change", this._onConfigChange), this._childWatch?.disconnect(), this._hostWatch?.disconnect(), this._media?.removeEventListener("change", this._onMediaChange), this._media = null, this._clearAvatar(), this._ready = !1;
  }
  attributeChangedCallback(t, e, n) {
    if (!this._ready) return;
    if (t === "breakpoint") {
      this._watchBreakpoint();
      return;
    }
    if (this._render(), t === "maximized") {
      e === null != (n === null) && this._announce();
      return;
    }
    if (t === "maximizable") {
      this.open && this.maximized && e === "panel" != (n === "panel") && this._announce();
      return;
    }
    if (t !== "open") return;
    const i = this.open;
    i !== this._lastOpen && (this._lastOpen = i, !i && this._button && this.contains(wt(this)) && this._button.focus(), this._announce());
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
    const t = Array.from(this.querySelectorAll(`[${pn}]`)).find((e) => !St(e));
    return I(t ?? this);
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
    const n = t.getLocale(), i = this.open, r = i ? "" : (this.getAttribute("label") ?? "").trim(), a = r ? "aparte-btn--pill" : "aparte-btn--circle";
    e.className = ["aparte-btn", "aparte-btn--primary", "aparte-btn--solid", "aparte-btn--lg", a, "aparte-launcher__button"].join(" "), e.setAttribute("aria-expanded", String(i)), r ? e.removeAttribute("aria-label") : e.setAttribute("aria-label", i ? n.launcherClose ?? "Close the chat" : n.launcherOpen ?? "Open the chat");
    const o = [vt._glyph(i ? t.getIcon("launcherClose") ?? t.getIcon("close") : t.getIcon("launcherOpen") ?? t.getIcon("messageSquare"))];
    if (r) {
      const l = document.createElement("span");
      l.className = "aparte-launcher__label", l.textContent = r, o.push(l);
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
    return [...t.addedNodes, ...t.removedNodes].some((n) => n instanceof Element && (n.matches(e) || n.querySelector(e) !== null));
  }
  /** An icon-only control of the header: the recipe's ghost icon button. */
  static _headerButton(t) {
    const e = document.createElement("button");
    return e.type = "button", e.className = `aparte-btn aparte-btn--icon aparte-btn--ghost aparte-launcher__${t}`, e;
  }
  /** A control's name, spoken and shown on hover: an icon alone says nothing to a pointer. */
  static _name(t, e, n) {
    t.setAttribute("aria-label", e), t.setAttribute("title", e), t.replaceChildren(vt._glyph(n));
  }
  _buildHeader() {
    const t = document.createElement("div");
    t.className = "aparte-app-header aparte-launcher__header", this._avatar = document.createElement("span"), this._avatar.className = "aparte-avatar aparte-launcher__avatar", this._avatar.setAttribute("data-role", "assistant"), this._avatar.setAttribute("aria-hidden", "true");
    const e = document.createElement("div");
    e.className = "aparte-launcher__heading", this._title = document.createElement("span"), this._title.className = "aparte-app-header__title aparte-launcher__title", this._title.setAttribute("role", "heading"), this._title.setAttribute("aria-level", "2"), this._subtitle = document.createElement("span"), this._subtitle.className = "aparte-launcher__subheading", e.append(this._title, this._subtitle);
    const n = document.createElement("div");
    return n.className = "aparte-app-header__actions", this._maximize = vt._headerButton("maximize"), this._maximize.setAttribute("data-aparte-launcher-maximize", ""), this._closeControl = vt._headerButton("close"), this._closeControl.setAttribute("data-aparte-launcher-close", ""), n.append(this._maximize, this._closeControl), t.append(this._avatar, e, n), t;
  }
  /**
   * The header, when the element draws one: the title, the line under it, the maximize
   * button for its state, the ✕. It goes first among the children, and the stylesheet
   * joins it to the card under it.
   */
  _renderHeader(t) {
    if (!this.header || this._cardHasHeader()) {
      const l = !!this._header?.contains(wt(this));
      this._clearAvatar(), this._header?.remove(), l && (this._focusTarget() ?? this._button)?.focus();
      return;
    }
    const e = this._header ??= this._buildHeader(), n = t.getLocale(), i = (this.getAttribute("label") ?? "").trim(), r = (this.getAttribute("heading") ?? (i || (n.launcherHeading ?? "Chat"))).trim();
    this._title.textContent = r, this._title.hidden = !r, this._drawAvatar(t);
    const a = (this.getAttribute("subheading") ?? "").trim();
    this._subtitle.textContent = a, this._subtitle.hidden = !a;
    const o = this._maximize;
    o.hidden = !this.hasAttribute("maximizable"), vt._name(
      o,
      this.maximized ? n.launcherRestore ?? "Shrink the chat" : n.launcherMaximize ?? "Expand the chat",
      t.getIcon(this.maximized ? "minimize" : "maximize")
    ), vt._name(this._closeControl, n.launcherClose ?? "Close the chat", t.getIcon("close")), this.firstElementChild !== e && this.prepend(e), this._markAvatarImage();
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
        const n = e.render("assistant", this._avatar);
        typeof n == "function" && (this._avatarCleanup = n);
      } catch (n) {
        this._avatar.replaceChildren(), console.error("[aparte] The avatar provider failed for the launcher's header, which shows no avatar. It is called with a host outside any message there.", n);
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
      e === this._maximize || St(e) || e.setAttribute("aria-pressed", t);
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
    this._media = matchMedia(t ? `(max-width: ${t})` : rf), this._media.addEventListener("change", this._onMediaChange), this._applySheet(this._media.matches);
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
    const e = wt(this);
    t && e?.matches("[data-aparte-launcher-maximize]") && this.contains(e) && (this._closeControl?.isConnected ? this._closeControl : this._focusTarget())?.focus(), this._ready && this.open && this._announce();
  }
  // ─── Focus and keys ───────────────────────────────────────────────────
  /** What the chat lets the focus land on: yours to decide, so only what is visible. */
  _focusables() {
    return Array.from(this.querySelectorAll(af)).filter((t) => !t.closest("[hidden]") && t.checkVisibility?.() !== !1);
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
    return Array.from(this.querySelectorAll('[role="textbox"]:not([aria-disabled="true"])')).find((e) => !St(e) && !e.closest("[hidden]") && e.checkVisibility?.() !== !1) ?? this._focusables().find((e) => e !== this._button && !this._header?.contains(e)) ?? (this.covers && this._closeControl?.isConnected ? this._closeControl : void 0);
  }
  /**
   * A `[data-aparte-launcher-close]` inside closes the chat, and a
   * `[data-aparte-launcher-maximize]` enlarges it or brings it back — no script in your card.
   */
  _onClick = (t) => {
    const e = Gt(t), n = (i) => {
      const r = e?.closest?.(i);
      return !!r && this.contains(r) && !St(r);
    };
    n("[data-aparte-launcher-close]") ? this.close() : n("[data-aparte-launcher-maximize]") && (this.maximized = !this.maximized);
  };
  /**
   * A modal dialog open inside the card, with the key pressed inside it. The browser
   * closes it on Escape — unless the keydown was cancelled, which is what closing the
   * launcher would do: the dialog refused its close request and the card hidden under it.
   * An engine that cannot tell a modal dialog from one opened with `show()` (no `:modal`)
   * leaves the key to the dialog, which is the answer that loses nothing.
   */
  _inModalDialog(t) {
    const e = Gt(t)?.closest?.("dialog[open]");
    if (!e || !this.contains(e)) return !1;
    try {
      return e.matches(":modal");
    } catch {
      return !0;
    }
  }
  _onKeydown = (t) => {
    if (!this.open) return;
    if (t.key === "Escape") {
      if (t.defaultPrevented || t.isComposing || t.keyCode === 229 || this._inModalDialog(t)) return;
      t.preventDefault(), this.maximized && !this.sheet ? this.maximized = !1 : this.close();
      return;
    }
    if (t.key !== "Tab" || !this.covers) return;
    const e = this._focusables();
    if (e.length === 0) return;
    const n = e[0], i = e[e.length - 1], r = wt(this);
    t.shiftKey && r === n ? (t.preventDefault(), i.focus()) : !t.shiftKey && r === i && (t.preventDefault(), n.focus());
  };
}
V(vt);
customElements.get("aparte-launcher") || customElements.define("aparte-launcher", vt);
const ca = Symbol.for("aparte.imageHolds"), El = ".aparte-image-held[data-aparte-image]";
function Cl(s) {
  const t = s.getAttribute("data-aparte-image") ?? "";
  I(s).showImage(t);
  const e = document.createElement("img");
  e.setAttribute("referrerpolicy", "no-referrer"), e.setAttribute("alt", s.getAttribute("data-aparte-image-alt") ?? ""), e.setAttribute("src", t);
  const n = s === document.activeElement;
  s.replaceWith(e), n && (e.tabIndex = -1, e.focus({ preventScroll: !0 }));
}
function of(s) {
  if (s.button !== 0 || s.ctrlKey || s.metaKey || s.shiftKey || s.altKey) return;
  const t = s.target?.closest?.(El);
  t && (s.preventDefault(), s.stopPropagation(), Cl(t));
}
function lf(s) {
  if (s.key !== "Enter" && s.key !== " ") return;
  const t = s.target;
  t?.matches?.(`span${El}`) && (s.preventDefault(), s.stopPropagation(), Cl(t));
}
function cf() {
  const s = document;
  s[ca] || (s[ca] = !0, s.addEventListener("click", of, !0), s.addEventListener("keydown", lf, !0));
}
typeof document < "u" && (up(), cf());
function df(s) {
  const t = /^data:([^;,]*)(?:;[^;,]*)*;base64,(.*)$/s.exec(s.image);
  return t ? { type: "image", source: { type: "data", value: t[2], mimeType: s.mimeType ?? (t[1] || "application/octet-stream") } } : { type: "image", source: { type: "url", value: s.image, ...s.mimeType ? { mimeType: s.mimeType } : {} } };
}
function uf(s, t, e) {
  const n = [];
  return s.forEach((i, r) => {
    const a = `aparte-${r}`, o = qa(i.content), l = Array.isArray(i.content) && i.content.some((c) => c.type === "image");
    i.role === "user" && l && !t ? n.push({
      id: a,
      role: "user",
      content: i.content.map((c) => c.type === "image" ? df(c) : { type: "text", text: c.text })
    }) : i.role === "system" || i.role === "user" ? (l && e(`the agent's AG-UI version takes text only, which DROPS non-text parts: the images of message ${r} are not sent.`), n.push({ id: a, role: i.role, content: o })) : i.role === "assistant" ? n.push({
      id: a,
      role: "assistant",
      ...o ? { content: o } : {},
      ...i.toolCalls?.length ? {
        toolCalls: i.toolCalls.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) }
        }))
      } : {}
    }) : i.role === "tool" && i.toolCallId && n.push({ id: a, role: "tool", content: o, toolCallId: i.toolCallId });
  }), n;
}
function hf(s) {
  return (s ?? []).map((t) => ({ name: t.name, description: t.description, parameters: t.inputSchema }));
}
const pf = ["type", "timestamp", "rawEvent", "metadata"], ff = {
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
}, gf = /* @__PURE__ */ new Set(["developer", "system", "assistant", "user"]), _f = /* @__PURE__ */ new Set(["success", "interrupt", "cancelled"]), mf = /* @__PURE__ */ new Set(["text", "image", "audio", "video", "document"]);
function bf(s, t) {
  const e = ff[s.type];
  if (!e) {
    t(`dropped an event of a type this runner does not know: ${s.type}.`);
    return;
  }
  const n = { ...s };
  for (const r of Object.keys(n))
    !pf.includes(r) && !e.includes(r) && (delete n[r], t(`stripped /${r} from ${s.type}: AG-UI 1.0 does not describe it.`));
  (n.type === "TEXT_MESSAGE_START" || n.type === "TEXT_MESSAGE_CHUNK") && typeof n.role == "string" && !gf.has(n.role) && (t(`stripped /role from ${n.type}: "${n.role}" is not a message role.`), delete n.role);
  const i = n.outcome;
  return n.type === "RUN_FINISHED" && i && typeof i == "object" && !Array.isArray(i) && !_f.has(String(i.type)) && (t(`stripped /outcome from RUN_FINISHED: "${String(i.type)}" is not an outcome AG-UI 1.0 describes; the run ends as a plain one.`), delete n.outcome), n.type === "MESSAGES_SNAPSHOT" && Array.isArray(n.messages) && (n.messages = n.messages.map((r, a) => {
    const o = r?.content;
    if (!Array.isArray(o)) return r;
    const l = o.filter((c, d) => {
      const u = mf.has(String(c?.type));
      return u || t(`stripped /messages/${a}/content/${d} from MESSAGES_SNAPSHOT: "${String(c?.type)}" is not a content part.`), u;
    });
    return { ...r, content: l };
  })), n;
}
const vf = /* @__PURE__ */ new Set(["add", "remove", "replace", "move", "copy", "test"]);
function yf(s) {
  if (s === "") return [];
  if (!s.startsWith("/")) throw new Error(`"${s}" is not a JSON Pointer`);
  return s.slice(1).split("/").map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
}
function Ne(s) {
  return typeof s == "object" && s !== null;
}
function He(s, t, e) {
  if (e && t === "-") return s.length;
  if (!/^(0|[1-9]\d*)$/.test(t)) throw new Error(`"${t}" is not an array index`);
  const n = Number(t);
  if (n > s.length || !e && n === s.length) throw new Error(`index ${n} is out of range`);
  return n;
}
function Nn(s, t) {
  const e = yf(t), n = e.pop();
  let i = s;
  for (const r of e) {
    if (!Ne(i)) throw new Error(`"${t}" does not resolve`);
    if (i = Array.isArray(i) ? i[He(i, r, !1)] : Object.hasOwn(i, r) ? i[r] : void 0, i === void 0) throw new Error(`"${t}" does not resolve`);
  }
  if (!Ne(i)) throw new Error(`"${t}" does not resolve`);
  return { parent: i, key: n };
}
function as(s, t) {
  if (t === "") return s;
  const { parent: e, key: n } = Nn(s, t), i = Array.isArray(e) ? e[He(e, n, !1)] : Object.hasOwn(e, n) ? e[n] : void 0;
  if (i === void 0) throw new Error(`"${t}" does not resolve`);
  return i;
}
function os(s, t, e) {
  if (t === "") return e;
  const { parent: n, key: i } = Nn(s, t);
  return Array.isArray(n) ? n.splice(He(n, i, !0), 0, e) : n[i] = e, s;
}
function da(s, t) {
  if (t === "") throw new Error("the whole document cannot be removed");
  const { parent: e, key: n } = Nn(s, t);
  if (Array.isArray(e)) e.splice(He(e, n, !1), 1);
  else if (Object.hasOwn(e, n)) delete e[n];
  else throw new Error(`"${t}" does not resolve`);
  return s;
}
function wf(s, t, e) {
  if (t === "") return e;
  const { parent: n, key: i } = Nn(s, t);
  if (Array.isArray(n)) n[He(n, i, !1)] = e;
  else if (Object.hasOwn(n, i)) n[i] = e;
  else throw new Error(`"${t}" does not resolve`);
  return s;
}
function Ps(s, t) {
  if (s === t) return !0;
  if (!Ne(s) || !Ne(t) || Array.isArray(s) !== Array.isArray(t)) return !1;
  if (Array.isArray(s)) return s.length === t.length && s.every((i, r) => Ps(i, t[r]));
  const e = Object.keys(s), n = Object.keys(t);
  return e.length === n.length && e.every((i) => Object.hasOwn(t, i) && Ps(s[i], t[i]));
}
function Sf(s, t) {
  const e = t.path;
  if (typeof e != "string") throw new Error("an operation has no path");
  const n = typeof t.from == "string" ? t.from : void 0;
  if ((t.op === "add" || t.op === "replace" || t.op === "test") && !("value" in t)) throw new Error(`${String(t.op)} has no value`);
  switch (t.op) {
    case "add":
      return os(s, e, structuredClone(t.value));
    case "remove":
      return da(s, e);
    case "replace":
      return wf(s, e, structuredClone(t.value));
    case "move": {
      if (n === void 0) throw new Error("move has no from");
      if (e.startsWith(`${n}/`)) throw new Error(`"${n}" cannot move into its own child "${e}"`);
      const i = as(s, n);
      return os(da(s, n), e, i);
    }
    case "copy": {
      if (n === void 0) throw new Error("copy has no from");
      return os(s, e, structuredClone(as(s, n)));
    }
    case "test":
      if (!Ps(as(s, e), t.value)) throw new Error(`test failed at "${e}"`);
      return s;
    default:
      throw new Error(`unknown operation "${String(t.op)}"`);
  }
}
function kf(s, t, e) {
  if (!Array.isArray(t))
    return e("Failed to apply state patch: STATE_DELTA carried no list of operations; the state is left as it was."), s;
  const n = [];
  t.forEach((i, r) => {
    Ne(i) && !Array.isArray(i) && vf.has(String(i.op)) ? n.push(i) : e(`dropped /delta/${r}: ${JSON.stringify(i)} is not a JSON Patch operation.`);
  });
  try {
    let i = structuredClone(s);
    for (const r of n) i = Sf(i, r);
    return i;
  } catch (i) {
    return e(`Failed to apply state patch: ${i.message}; the state is left as it was.`), s;
  }
}
function Af(s, t) {
  for (let e = 0; e < Math.max(s.length, t.length); e++) {
    const n = (s[e] ?? 0) - (t[e] ?? 0);
    if (n !== 0) return n;
  }
  return 0;
}
function Ef(s, t) {
  const e = s !== void 0 && Af(s, [0, 0, 57]) <= 0;
  let n = 0, i, r;
  const a = /* @__PURE__ */ new Set(), o = (l, c) => {
    a.has(l) || (a.add(l), t(c));
  };
  return (l) => {
    switch (l.type) {
      case "THINKING_START":
        return i = `thinking-${++n}`, o("THINKING_START", `translated the retired THINKING_START into REASONING_START${typeof l.title == "string" ? `, dropping its title "${l.title}"` : ""}; the agent should send REASONING_* events.`), [{ type: "REASONING_START", messageId: i }];
      case "THINKING_END": {
        const c = i ?? `thinking-${++n}`;
        return i = void 0, [{ type: "REASONING_END", messageId: c }];
      }
      case "THINKING_TEXT_MESSAGE_START":
        return r = `thinking-message-${++n}`, [{ type: "REASONING_MESSAGE_START", messageId: r, role: "reasoning" }];
      case "THINKING_TEXT_MESSAGE_CONTENT":
        return [{ type: "REASONING_MESSAGE_CONTENT", messageId: r ?? `thinking-message-${n}`, delta: l.delta }];
      case "THINKING_TEXT_MESSAGE_END": {
        const c = r ?? `thinking-message-${n}`;
        return r = void 0, [{ type: "REASONING_MESSAGE_END", messageId: c }];
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
function Q(s) {
  return new Z(`The agent stream is malformed: ${s}.`, U.PROVIDER_ERROR, { agUi: "malformed" });
}
const Cf = /* @__PURE__ */ new Set([
  "TEXT_MESSAGE_CONTENT",
  "TEXT_MESSAGE_CHUNK",
  "TOOL_CALL_ARGS",
  "TOOL_CALL_CHUNK",
  "REASONING_MESSAGE_CONTENT",
  "REASONING_MESSAGE_CHUNK"
]), xf = [
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
], Tf = {
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
}, ua = " (TanStack AI frames runs this way: give createAgUiRunner relaxedRunFraming: true to read it)";
function If(s) {
  let t = !1, e = !1, n;
  const i = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), l = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Map(), d = (g) => typeof g.subagentRunId == "string" ? g.subagentRunId : "", u = (g, m) => `${g}\0${m}`, h = () => {
    i.clear(), r.clear(), a.clear(), o.clear(), l.clear(), c.clear();
  }, p = () => [...i.keys()].map((g) => `text message "${g}"`).concat([...r.keys()].map((g) => `reasoning message "${g}"`)).concat([...a.keys()].map((g) => `tool call "${g}"`)).concat([...o].map((g) => `step "${g.split("\0")[1]}"`)).concat([...l].map((g) => `subagent "${g}"`)), f = (g, m, A) => {
    const k = A.subagentRunId;
    if (k === void 0) return;
    const y = m.get(g);
    if (y !== void 0 && y !== k) throw Q(`${A.type} for "${g}" is attributed to "${String(k)}", but "${g}" started attributed to "${String(y)}"`);
  }, _ = ((g) => {
    const m = g.type, A = !t;
    t = !0;
    for (const b of Tf[m] ?? []) if (g[b] === void 0) throw Q(`${m} needs "${b}"`);
    for (const b of xf) if (b in g && g[b] !== void 0 && typeof g[b] != "string") throw Q(`"${b}" must be a string on ${m}`);
    if (Cf.has(m) && "delta" in g && typeof g.delta != "string") throw Q(`"delta" must be a string on ${m}`);
    if (m === "RUN_STARTED") {
      if (e && !s) throw Q("RUN_STARTED while a run is still active");
      e = !0, n = void 0, h();
      return;
    }
    if (!s) {
      if (A && m !== "RUN_ERROR") throw Q(`the first event must be RUN_STARTED, not ${m}${ua}`);
      if (n === "finished" && m !== "RUN_ERROR") throw Q(`${m} after the run finished${ua}`);
      if (n === "error") throw Q(`${m} after the run ended with RUN_ERROR`);
    }
    if (m === "RUN_ERROR") {
      e = !1, n !== "finished" && (n = "error"), h();
      return;
    }
    const k = d(g), y = c.get(k);
    switch (y && m !== y.type && m !== "RAW" && c.delete(k), (m === "SUBAGENT_FINISHED" || m === "SUBAGENT_ERROR") && c.delete(String(g.subagentRunId)), m) {
      case "TEXT_MESSAGE_START":
        i.set(String(g.messageId), g.subagentRunId);
        break;
      case "TEXT_MESSAGE_CONTENT":
      case "TEXT_MESSAGE_END": {
        const b = String(g.messageId);
        if (!i.has(b)) throw Q(`${m} for "${b}", but no open text message has that id`);
        f(b, i, g), m === "TEXT_MESSAGE_END" && i.delete(b);
        break;
      }
      case "TEXT_MESSAGE_CHUNK":
      case "REASONING_MESSAGE_CHUNK": {
        const b = typeof g.messageId == "string" ? g.messageId : void 0, v = typeof g.role == "string" ? g.role : void 0, w = c.get(k);
        if (!w || b !== void 0 && b !== w.id) {
          if (b === void 0) throw Q(`the first ${m} of a stream needs a messageId`);
          c.set(k, { type: m, id: b, ...v !== void 0 ? { label: v } : {} });
        } else if (v !== void 0 && w.label !== void 0 && v !== w.label)
          throw Q(`${m} changes its role from "${w.label}" to "${v}" in the middle of message "${w.id}"`);
        break;
      }
      case "TOOL_CALL_CHUNK": {
        const b = typeof g.toolCallId == "string" ? g.toolCallId : void 0, v = typeof g.toolCallName == "string" ? g.toolCallName : void 0, w = c.get(k);
        if (!w || b !== void 0 && b !== w.id) {
          if (b === void 0 || v === void 0) throw Q("the first TOOL_CALL_CHUNK of a call needs a toolCallId and a toolCallName");
          c.set(k, { type: m, id: b, label: v });
        } else if (v !== void 0 && v !== w.label)
          throw Q(`TOOL_CALL_CHUNK changes its toolCallName from "${w.label}" to "${v}" in the middle of call "${w.id}"`);
        break;
      }
      case "TOOL_CALL_START":
        a.set(String(g.toolCallId), g.subagentRunId);
        break;
      case "TOOL_CALL_ARGS":
      case "TOOL_CALL_END": {
        const b = String(g.toolCallId);
        if (!a.has(b)) throw Q(`${m} for "${b}", but no open tool call has that id`);
        f(b, a, g), m === "TOOL_CALL_END" && a.delete(b);
        break;
      }
      case "REASONING_MESSAGE_START": {
        const b = String(g.messageId);
        if (g.role !== void 0 && g.role !== "reasoning")
          throw Q(`REASONING_MESSAGE_START "${b}" has the role "${String(g.role)}", where only role "reasoning" is allowed`);
        r.set(b, g.subagentRunId);
        break;
      }
      case "REASONING_MESSAGE_CONTENT":
      case "REASONING_MESSAGE_END": {
        const b = String(g.messageId);
        if (!r.has(b)) throw Q(`${m} for "${b}", but no open reasoning message has that id`);
        f(b, r, g), m === "REASONING_MESSAGE_END" && r.delete(b);
        break;
      }
      case "STEP_STARTED":
        o.add(u(k, String(g.stepName)));
        break;
      case "STEP_FINISHED": {
        const b = u(k, String(g.stepName));
        if (!o.has(b)) throw Q(`STEP_FINISHED for step "${String(g.stepName)}", which was not started${k ? ` by "${k}"` : ""}`);
        o.delete(b);
        break;
      }
      case "SUBAGENT_STARTED": {
        const b = String(g.subagentRunId);
        if (typeof g.name != "string" || !g.name) throw Q(`SUBAGENT_STARTED "${b}" needs a name`);
        l.add(b);
        break;
      }
      case "SUBAGENT_FINISHED":
      case "SUBAGENT_ERROR": {
        const b = String(g.subagentRunId);
        if (!l.has(b)) throw Q(`${m} for subagent "${b}", which was not started`);
        l.delete(b);
        break;
      }
      case "RUN_FINISHED": {
        const b = g.outcome;
        if (b !== void 0 && (typeof b != "object" || b === null || Array.isArray(b)))
          throw Q("RUN_FINISHED.outcome must be an object");
        if (!s) {
          const v = p();
          if (v.length) throw Q(`${v.join(", ")} still running at RUN_FINISHED`);
          n = "finished";
        }
        c.clear(), e = !1;
        break;
      }
    }
  });
  return _.end = () => {
    if (!s) return;
    const g = p();
    if (g.length) throw Q(`${g.join(", ")} still running at the end of the stream`);
  }, _;
}
async function* Rf(s, t) {
  const e = !!(t && /ndjson|jsonl/i.test(t)), n = s.getReader(), i = new TextDecoder();
  let r = "", a = [];
  const o = (d) => {
    const u = d.trim();
    if (!(!u || u === "[DONE]"))
      try {
        const h = JSON.parse(u);
        return h && typeof h == "object" && typeof h.type == "string" ? h : void 0;
      } catch {
        return;
      }
  }, l = () => {
    const d = o(a.join(`
`));
    return a = [], d;
  }, c = (d) => {
    const u = d.endsWith("\r") ? d.slice(0, -1) : d;
    if (e) return o(u);
    if (u === "") return l();
    u.startsWith("data:") && a.push(u.slice(5).replace(/^ /, ""));
  };
  try {
    for (; ; ) {
      const { done: d, value: u } = await n.read();
      if (d) break;
      r += i.decode(u, { stream: !0 });
      let h;
      for (; (h = r.indexOf(`
`)) !== -1; ) {
        const p = c(r.slice(0, h));
        r = r.slice(h + 1), p && (yield p);
      }
    }
    if (r += i.decode(), r) {
      const d = c(r);
      d && (yield d);
    }
    if (!e) {
      const d = l();
      d && (yield d);
    }
  } finally {
    n.releaseLock();
  }
}
const me = "1.0";
function ls(s) {
  return /^\d+(\.\d+)*$/.test(s) ? s.split(".").map(Number) : void 0;
}
function cs(s, t) {
  for (let e = 0; e < Math.max(s.length, t.length); e++) {
    const n = (s[e] ?? 0) - (t[e] ?? 0);
    if (n !== 0) return n;
  }
  return 0;
}
function Mf(s) {
  if (s)
    try {
      const t = JSON.parse(s);
      return t && t.v === 1 && typeof t.threadId == "string" && typeof t.runId == "string" && Array.isArray(t.interrupts) ? t : void 0;
    } catch {
      return;
    }
}
function Lf(s) {
  if (s.reason === "tool_call" || s.reason === "confirmation" || s.reason === "approval_required") return "approval";
  if (/client_tool/.test(s.reason)) return "external";
}
function Of(s) {
  const e = (Array.isArray(s) ? s : s && typeof s == "object" ? [s] : []).filter((r) => !!r && typeof r == "object").at(-1);
  if (!e) return;
  const n = (r) => typeof e[r] == "number" ? e[r] : 0, i = n("cachedInputTokens");
  return {
    inputTokens: n("inputTokens"),
    outputTokens: n("outputTokens"),
    totalTokens: n("totalTokens") || void 0,
    ...i ? { cacheReadTokens: i } : {}
  };
}
function ha(s) {
  if (!s.trim()) return {};
  try {
    return JSON.parse(s);
  } catch {
    return { arguments: s };
  }
}
function $f(s) {
  if (typeof s == "string") return s;
  if (s == null) return "";
  if (Array.isArray(s)) {
    const t = s.filter((e) => e?.type === "text" && typeof e.text == "string").map((e) => e.text);
    if (t.length) return t.join(`
`);
  }
  return JSON.stringify(s);
}
function xl(s) {
  return Oo(s).reason;
}
function Nf(s, t) {
  if (!t) return { interruptId: s.id, status: "cancelled" };
  if (t.kind === "decision" && s.kind === "external" && !t.approved)
    return {
      interruptId: s.id,
      status: "resolved",
      payload: { error: xl(t) },
      metadata: { tanstack: { state: "output-error" } }
    };
  if (t.kind === "decision") {
    const e = !t.approved && t.instruction ? { instruction: t.instruction } : {};
    return { interruptId: s.id, status: "resolved", payload: { approved: t.approved, ...e } };
  }
  return t.kind === "failed" ? {
    interruptId: s.id,
    status: "resolved",
    payload: { error: t.error },
    metadata: { tanstack: { state: "output-error" } }
  } : {
    interruptId: s.id,
    status: "resolved",
    payload: t.structuredContent !== void 0 ? t.structuredContent : t.content
  };
}
function Pf(s) {
  const t = s.onWarning ?? ((c) => console.warn(`[aparte] AG-UI: ${c}`)), e = s.peerProtocolVersion ? ls(s.peerProtocolVersion) : void 0, n = !e || cs(e, [1, 0]) >= 0, i = e !== void 0 && cs(e, [0, 0, 39]) <= 0, r = /* @__PURE__ */ new Map(), a = s.threadId !== void 0, o = /* @__PURE__ */ new Map(), l = async (c, d) => {
    const u = s.fetch ?? fetch, h = typeof s.headers == "function" ? await s.headers() : s.headers ?? {}, p = c.baseRequest, f = Mf(c.deferral?.token), _ = c.deferral?.outcomes ?? {}, g = f?.threadId ?? (typeof s.threadId == "function" ? s.threadId(c) : s.threadId) ?? `aparte-${J()}`;
    d.threadId = g;
    const m = `aparte-run-${J()}`, A = new Set((f?.interrupts ?? []).map((C) => C.toolCallId)), k = uf(p.messages, i, t);
    for (const [C, M] of Object.entries(_))
      A.has(C) || M.kind === "decision" && M.approved || k.push({
        id: `aparte-result-${C}`,
        role: "tool",
        toolCallId: C,
        content: M.kind === "failed" ? `Error: ${M.error}` : M.kind === "decision" ? xl(M) : M.content
      });
    const y = f ? [] : o.get(g) ?? [];
    o.delete(g);
    const b = f?.interrupts.length ? f.interrupts.map((C) => Nf(C, C.kind === "unanswerable" ? void 0 : _[C.toolCallId])) : y.length ? y.map((C) => ({ interruptId: C, status: "cancelled" })) : void 0, v = {
      threadId: g,
      runId: m,
      ...n ? { protocolVersion: me } : {},
      ...f ? { parentRunId: f.runId } : {},
      state: r.has(g) ? r.get(g) : {},
      messages: k,
      tools: hf(p.tools),
      context: s.context ?? [],
      forwardedProps: s.forwardedProps ?? {},
      ...b ? { resume: b } : {}
    }, w = await u(s.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...h },
      body: JSON.stringify(v),
      signal: c.signal,
      ...s.credentials ? { credentials: s.credentials } : {}
    });
    if (!w.ok || !w.body) {
      const C = await w.text().catch(() => "");
      throw new Z(
        C.trim().slice(0, 300) || `The agent endpoint answered HTTP ${w.status}.`,
        Z.codeForStatus(w.status) ?? U.PROVIDER_ERROR,
        void 0,
        void 0,
        w.status
      );
    }
    const T = new Map(p.messages.flatMap((C) => (C.toolCalls ?? []).map((M) => [M.id, { name: M.name, input: M.input ?? {} }]))), S = new Set(T.keys()), x = new Set((p.tools ?? []).map((C) => C.name)), L = /* @__PURE__ */ new Map(), E = /* @__PURE__ */ new Map(), N = /* @__PURE__ */ new Set(), G = /* @__PURE__ */ new Set(), j = /* @__PURE__ */ new Set();
    let X = !1, tt, dt, Et;
    const D = c.emitter, P = (C) => {
      const M = L.get(C);
      if (!M || E.has(C) || S.has(C)) return;
      const B = ha(M.args);
      E.set(C, { name: M.name, input: B }), X && (D({ type: "text-flush" }), X = !1), D({ type: "tool-start", toolCallId: C, name: M.name, input: B }), at = !0;
    };
    let at = !1;
    const z = () => {
      at && (at = !1, X && (D({ type: "text-flush" }), X = !1), D({ type: "turn-start" }));
    }, Yt = (C) => {
      const M = E.get(C.toolCallId) ?? T.get(C.toolCallId);
      if (M) return M;
      const B = L.get(C.toolCallId);
      if (B) return { name: B.name, input: ha(B.args) };
      const mt = C.metadata;
      return { name: typeof mt?.toolName == "string" ? mt.toolName : "", input: mt?.input ?? {} };
    };
    let Qt = !1, wi = !1;
    const Zl = () => {
      if (!wi) {
        wi = !0, D({ type: "run-start" }), D({ type: "turn-start" });
        for (const [C, M] of Object.entries(_)) {
          if (M.kind === "result") {
            D({
              type: "tool-resolved",
              toolCallId: C,
              result: M.content,
              ...M.structuredContent !== void 0 ? { structuredResult: M.structuredContent } : {}
            }), j.add(C);
            continue;
          }
          if (M.kind === "failed") {
            D({ type: "tool-failed", toolCallId: C, error: M.error }), j.add(C);
            continue;
          }
          M.approved ? D({ type: "tool-approved", toolCallId: C }) : (D({ type: "tool-rejected", toolCallId: C, ...Oo(M) }), G.add(C));
        }
      }
    }, Si = If(!n || s.relaxedRunFraming === !0), Jl = Ef(e, t);
    async function* tc(C, M) {
      for await (const B of Rf(C, M))
        for (const mt of Jl(B)) {
          const ce = bf(mt, t);
          ce && (yield ce);
        }
    }
    for await (const C of tc(w.body, w.headers.get("content-type")))
      switch (Si(C), Zl(), /^(TEXT_MESSAGE|REASONING|TOOL_CALL)_/.test(C.type) && (Qt = !1), C.type) {
        case "RUN_STARTED": {
          if (tt) {
            t(`the agent's run failed ("${tt.message}") and the stream ran it again; the reply shows the new run.`);
            for (const [B] of E)
              N.has(B) || (D({ type: "tool-aborted", toolCallId: B }), N.add(B));
            tt = void 0;
          }
          const M = C.protocolVersion;
          if (typeof M == "string") {
            const B = ls(M);
            B ? cs(B, ls(me)) > 0 && t(`the agent speaks AG-UI ${M}, newer than the ${me} this runner speaks; reading its stream as ${me}.`) : t(`the agent declares protocol version "${M}", which this runner cannot interpret; reading its stream as ${me}.`);
          }
          break;
        }
        case "TEXT_MESSAGE_START":
        case "REASONING_START":
        case "REASONING_MESSAGE_START":
          z();
          break;
        case "TEXT_MESSAGE_CONTENT":
        case "TEXT_MESSAGE_CHUNK": {
          const M = typeof C.delta == "string" ? C.delta : "";
          M && (z(), D({ type: "text-delta", delta: M }), X = !0);
          break;
        }
        case "TEXT_MESSAGE_END": {
          X && (D({ type: "text-flush" }), X = !1);
          break;
        }
        case "REASONING_MESSAGE_CONTENT":
        case "REASONING_MESSAGE_CHUNK": {
          const M = typeof C.delta == "string" ? C.delta : "";
          M && (z(), D({ type: "thinking-delta", delta: M }));
          break;
        }
        case "TOOL_CALL_START": {
          const M = String(C.toolCallId);
          L.set(M, { name: String(C.toolCallName ?? ""), args: "" });
          break;
        }
        case "TOOL_CALL_ARGS": {
          const M = L.get(String(C.toolCallId));
          M && typeof C.delta == "string" && (M.args += C.delta);
          break;
        }
        case "TOOL_CALL_CHUNK": {
          const M = typeof C.toolCallId == "string" ? C.toolCallId : [...L.keys()].at(-1);
          if (!M) break;
          const B = L.get(M) ?? { name: "", args: "" };
          typeof C.toolCallName == "string" && C.toolCallName && (B.name = C.toolCallName), typeof C.delta == "string" && (B.args += C.delta), L.set(M, B);
          break;
        }
        case "TOOL_CALL_END": {
          P(String(C.toolCallId));
          break;
        }
        case "TOOL_CALL_RESULT": {
          const M = String(C.toolCallId);
          if (P(M), G.has(M) || j.has(M)) break;
          N.add(M);
          const B = $f(C.content);
          if (C.metadata?.tanstack?.state === "output-error")
            D({ type: "tool-failed", toolCallId: M, error: B });
          else {
            const ce = Array.isArray(C.content) ? { structuredResult: C.content } : {};
            D({ type: "tool-resolved", toolCallId: M, result: B, ...ce });
          }
          break;
        }
        case "RUN_ERROR": {
          tt = new Z(
            typeof C.message == "string" && C.message ? C.message : "The agent run failed.",
            U.PROVIDER_ERROR,
            { agUi: "run-error", ...typeof C.code == "string" ? { code: C.code } : {} }
          );
          break;
        }
        case "STATE_SNAPSHOT":
          r.set(g, C.snapshot);
          break;
        case "STATE_DELTA":
          r.set(g, kf(r.has(g) ? r.get(g) : {}, C.delta, t));
          break;
        case "RUN_FINISHED": {
          for (const M of L.keys()) P(M);
          X && (D({ type: "text-flush" }), X = !1), dt = Of(C.usage) ?? dt, at = !0, Qt = !0, Et = {
            runId: typeof C.runId == "string" ? C.runId : m,
            outcome: C.outcome
          };
          break;
        }
      }
    if (c.signal.aborted) return dt;
    if (tt) {
      for (const [C] of E) N.has(C) || D({ type: "tool-aborted", toolCallId: C });
      throw X && D({ type: "text-flush" }), tt;
    }
    if (!Et)
      throw new Z("The agent stream ended without RUN_FINISHED.", U.PROVIDER_ERROR);
    if (!Qt)
      throw new Z("The agent stream was cut: it ended in the middle of a step, after a RUN_FINISHED.", U.PROVIDER_ERROR);
    Si.end(), X && D({ type: "text-flush" });
    const Ue = [], ki = [], We = [];
    if (Et.outcome?.type === "interrupt")
      for (const C of Et.outcome.interrupts ?? []) {
        const M = Lf(C);
        if (!M || !C.toolCallId) {
          We.push(C.id);
          continue;
        }
        const B = Yt(C);
        M === "approval" && D({ type: "tool-awaiting-approval", toolCallId: C.toolCallId, name: B.name, input: B.input }), ki.push({ id: C.id, toolCallId: C.toolCallId, kind: M }), Ue.push({ toolCallId: C.toolCallId, name: B.name, input: B.input, reason: M });
      }
    else {
      const C = Et.outcome, M = Array.isArray(C?.pendingToolCallIds) ? new Set(C.pendingToolCallIds.filter((B) => typeof B == "string")) : void 0;
      for (const [B, mt] of E) {
        if (N.has(B)) continue;
        C?.type !== "cancelled" && (M ? M.has(B) : x.has(mt.name)) ? Ue.push({ toolCallId: B, name: mt.name, input: mt.input, reason: "external" }) : D({ type: "tool-aborted", toolCallId: B });
      }
    }
    if (Ue.length > 0) {
      const C = We.map((B) => ({ id: B, toolCallId: "", kind: "unanswerable" })), M = { v: 1, threadId: g, runId: Et.runId, interrupts: [...ki, ...C] };
      d.suspended = !0, D({ type: "run-suspended", pending: Ue, ...dt ? { usage: dt } : {}, ticket: JSON.stringify(M) });
    } else
      We.length && a && o.set(g, We), D({ type: "run-done", ...dt ? { usage: dt } : {} });
    return dt;
  };
  return async (c) => {
    const d = { suspended: !1 };
    try {
      return await l(c, d);
    } finally {
      d.threadId && !a && !d.suspended && r.delete(d.threadId);
    }
  };
}
function oi() {
  return { async: !1, breaks: !1, extensions: null, gfm: !0, hooks: null, pedantic: !1, renderer: null, silent: !1, tokenizer: null, walkTokens: null };
}
var Vt = oi();
function Tl(s) {
  Vt = s;
}
var Ft = { exec: () => null };
function Bt(s) {
  let t = [];
  return (e) => {
    let n = Math.max(0, Math.min(3, e - 1)), i = t[n];
    return i || (i = s(n), t[n] = i), i;
  };
}
function H(s, t = "") {
  let e = typeof s == "string" ? s : s.source, n = { replace: (i, r) => {
    let a = typeof r == "string" ? r : r.source;
    return a = a.replace(et.caret, "$1"), e = e.replace(i, a), n;
  }, getRegex: () => new RegExp(e, t) };
  return n;
}
var Il = ((s = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + s);
  } catch {
    return !1;
  }
})(), et = { codeRemoveIndent: /^(?: {0,3}\t| {1,4})/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, endingSpaceTabChar: /[ \t]$/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, leadingSpaceTab: /^[ \t]+/, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, blockquoteMarkerWhitespace: /^( {0,3}>)([ \t]+)/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\][ \t]+\S/, listReplaceTask: /^\[[ xX]\][ \t]+/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, numericCharacterReference: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/, numericCharacterReferenceOrAmpersand: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (s) => new RegExp(`^( {0,3}${s})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: Bt((s) => new RegExp(`^ {0,${s}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: Bt((s) => new RegExp(`^ {0,${s}}((?:-[ 	]*){3,}|(?:_[ 	]*){3,}|(?:\\*[ 	]*){3,})(?:\\n+|$)`)), fencesBeginRegex: Bt((s) => new RegExp(`^ {0,${s}}(?:\`\`\`|~~~)`)), headingBeginRegex: Bt((s) => new RegExp(`^ {0,${s}}#{1,6}(?:\\s|$)`)), pedanticHeadingBeginRegex: Bt((s) => new RegExp(`^ {0,${s}}#`)), htmlBeginRegex: Bt((s) => new RegExp(`^ {0,${s}}(?:</?(?:${qe})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, "i")), blockquoteBeginRegex: Bt((s) => new RegExp(`^ {0,${s}}>`)) }, Df = /^(?:[ \t]*(?:\n|$))+/, Hf = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/, Bf = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/, Be = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/, qf = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/, li = / {0,3}(?:[*+-]|\d{1,9}[.)])/, Rl = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |fences|blockquote|heading|hr|html|table))+?)\n {0,3}(=+|-+)[ \t]*(?:\n+|$)/, Ml = H(Rl).replace(/bull/g, li).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex(), Ff = H(Rl).replace(/bull/g, li).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(), ci = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/, Uf = /^[^\n]+/, di = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+/, Wf = H(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", di).replace("title", /(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\))/).getRegex(), zf = H(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, li).getRegex(), qe = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul", ui = /<!--(?:-?>|[\s\S]*?(?:-->|$))/, Gf = H("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?:[ \\t]+|\\n|/?>|$)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", ui).replace("tag", qe).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(), Ll = (s) => H(ci).replace("hr", Be).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", s).replace("html", " {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)").replace("tag", qe).getRegex(), jf = Ll(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/), Kf = Ll(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/), Vf = H(/^( {0,3}> ?(?:(?![ \t]*(?:\n|$))(paragraph)|[^\n]*)(?:\n|$))+/).replace("paragraph", Kf).getRegex(), hi = { blockquote: Vf, code: Hf, def: Wf, fences: Bf, heading: qf, hr: Be, html: Gf, lheading: Ml, list: zf, newline: Df, paragraph: jf, table: Ft, text: Uf }, pa = H("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", Be).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", " {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)").replace("tag", qe).getRegex(), Xf = { ...hi, lheading: Ff, table: pa, paragraph: H(ci).replace("hr", Be).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", pa).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", " {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)").replace("tag", qe).getRegex() }, Yf = { ...hi, html: H(`^ *(?:comment(?: *\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1>(?: *\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?>(?: *\\n{2,}|\\s*$))`).replace("comment", ui).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: Ft, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: H(ci).replace("hr", Be).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", Ml).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() }, Qf = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/, Zf = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/, Ol = /^( {2,}|\\)\n(?!\s*$)[ \t]*/, Jf = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/, At = /[\p{P}\p{S}]/u, oe = /[\s\p{P}\p{S}]/u, Fe = /[^\s\p{P}\p{S}]/u, tg = H(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, oe).getRegex(), eg = /[\p{Pi}\p{Ps}"']/u, $l = /(?!~)[\p{P}\p{S}]/u, ng = /(?!~)[\s\p{P}\p{S}]/u, sg = /(?:[^\s\p{P}\p{S}]|~)/u, ig = H(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Il ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex(), Nl = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/, rg = H(Nl, "u").replace(/punct/g, At).getRegex(), ag = H(Nl, "u").replace(/punct/g, $l).getRegex(), og = /^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/, lg = H(og, "u").replace(/openQuote/g, eg).replace(/punct/g, At).getRegex(), Pl = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)", cg = H(Pl, "gu").replace(/notPunctSpace/g, Fe).replace(/punctSpace/g, oe).replace(/punct/g, At).getRegex(), dg = H(Pl, "gu").replace(/notPunctSpace/g, sg).replace(/punctSpace/g, ng).replace(/punct/g, $l).getRegex(), ug = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)[\\s](\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)", hg = H(ug, "gu").replace(/notPunctSpace/g, Fe).replace(/punctSpace/g, oe).replace(/punct/g, At).getRegex(), pg = H("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, Fe).replace(/punctSpace/g, oe).replace(/punct/g, At).getRegex(), fg = "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)[\\s](_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)", gg = H(fg, "gu").replace(/notPunctSpace/g, Fe).replace(/punctSpace/g, oe).replace(/punct/g, At).getRegex(), _g = H(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, At).getRegex(), mg = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", bg = H(mg, "gu").replace(/notPunctSpace/g, Fe).replace(/punctSpace/g, oe).replace(/punct/g, At).getRegex(), vg = H(/\\(punct)/, "gu").replace(/punct/g, At).getRegex(), yg = H(/(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\(punct)/, "gu").replace(/punct/g, At).getRegex(), wg = H(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(), Sg = H(ui).replace("(?:-->|$)", "-->").getRegex(), kg = H("^comment|^</[a-zA-Z][a-zA-Z0-9-]*\\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", Sg).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(), Dl = /\[(?:\\[\s\S]|[^\[\]\\])*\]/, Sn = H(/(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/).replace("brackets", Dl).getRegex(), Ag = H(/^!?\[(label)\]\([ \t\n]*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?[ \t\n]*\)/).replace("label", Sn).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^)\\])*\)/).getRegex(), Eg = H(/^!?\[(label)\]\[(ref)\]/).replace("label", Sn).replace("ref", di).getRegex(), Cg = H(/^!?\[(ref)\](?:\[\])?/).replace("ref", di).getRegex(), fa = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999}/, xg = H(/(?:[^\[\]\\`]*(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?/).replace("brackets", Dl).getRegex(), Tg = H("reflink|nolink(?!\\()", "g").replace("reflink", H(/^!?\[(label)\]\[(ref)\]/).replace("label", xg).replace("ref", fa).getRegex()).replace("nolink", H(/^!?\[(ref)\](?:\[\])?/).replace("ref", fa).getRegex()).getRegex(), ga = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/, Ig = /[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/, Rg = H(/(?:mailto:email|xmpp:email(?:\/[A-Za-z0-9@.]+)?)/).replace(/email/g, Ig).getRegex(), pi = { _backpedal: Ft, anyPunctuation: vg, anyPunctuationOutsideCode: yg, autolink: wg, blockSkip: ig, br: Ol, code: Zf, del: Ft, delLDelim: Ft, delRDelim: Ft, emStrongLDelim: rg, emStrongRDelimAst: cg, emStrongRDelimUnd: pg, escape: Qf, link: Ag, nolink: Cg, punctuation: tg, reflink: Eg, reflinkSearch: Tg, tag: kg, text: Jf, url: Ft }, Mg = { ...pi, emStrongLDelim: lg, emStrongRDelimAst: hg, emStrongRDelimUnd: gg, link: H(/^!?\[(label)\]\((.*?)\)/).replace("label", Sn).getRegex(), reflink: H(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", Sn).getRegex() }, Ds = { ...pi, emStrongRDelimAst: dg, emStrongLDelim: ag, delLDelim: _g, delRDelim: bg, url: H(/^emailProtocol|^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("emailProtocol", Rg).replace("protocol", ga).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: H(/^(?:[^a-zA-Z0-9](?=emailProtocol)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|wwwStart|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=emailProtocol)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/).replace("protocol", ga).replace(/emailProtocol/g, /(?:mailto|xmpp):/).replace("wwwStart", Il ? "(?<![^\\s*_~(])www\\." : "www\\.").getRegex() }, Lg = { ...Ds, br: H(Ol).replace("{2,}", "*").getRegex(), text: H(Ds.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() }, tn = { normal: hi, gfm: Xf, pedantic: Yf }, be = { normal: pi, gfm: Ds, breaks: Lg, pedantic: Mg }, Og = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }, _a = (s) => Og[s];
function ot(s, t) {
  if (t) {
    if (et.escapeTest.test(s)) return s.replace(et.escapeReplace, _a);
  } else if (et.escapeTestNoEncode.test(s)) return s.replace(et.escapeReplaceNoEncode, _a);
  return s;
}
function $g(s) {
  return et.numericCharacterReference.test(s) ? s.replace(et.numericCharacterReferenceOrAmpersand, (t, e, n) => {
    if (e === void 0 && n === void 0) return "&amp;";
    let i = e === void 0 ? Number.parseInt(n, 16) : Number.parseInt(e, 10);
    return i === 0 || i > 1114111 || i >= 55296 && i <= 57343 ? "�" : i === 38 ? "&amp;" : String.fromCodePoint(i);
  }) : s;
}
function ma(s) {
  try {
    s = encodeURI(s).replace(et.percentDecode, "%");
  } catch {
    return null;
  }
  return s;
}
function ba(s, t) {
  let e = s.replace(et.findPipe, (r, a, o) => {
    let l = !1, c = a;
    for (; --c >= 0 && o[c] === "\\"; ) l = !l;
    return l ? "|" : " |";
  }), n = e.split(et.splitPipe), i = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), t) if (n.length > t) n.splice(t);
  else for (; n.length < t; ) n.push("");
  for (; i < n.length; i++) n[i] = n[i].trim().replace(et.slashPipe, "|");
  return n;
}
function xt(s, t, e) {
  let n = s.length;
  if (n === 0) return "";
  let i = 0;
  for (; i < n && s.charAt(n - i - 1) === t; )
    i++;
  return s.slice(0, n - i);
}
function va(s) {
  let t = s.split(`
`), e = t.length - 1;
  for (; e >= 0 && et.blankLine.test(t[e]); ) e--;
  return t.length - e <= 2 ? s : t.slice(0, e + 1).join(`
`);
}
function kn(s) {
  return s.trim().replace(et.multipleSpaceGlobal, " ").toLowerCase().toUpperCase().toLowerCase();
}
function ya(s, t) {
  if (s.indexOf(t[0]) === -1 && s.indexOf(t[1]) === -1) return -1;
  let e = 0;
  for (let n = 0; n < s.length; n++) if (s[n] === "\\") n++;
  else if (s[n] === t[0]) e++;
  else if (s[n] === t[1] && (e--, e < 0)) return n;
  return e > 0 ? -2 : -1;
}
var re = /* @__PURE__ */ new WeakMap();
function fi(s) {
  let t = { "*": -1, _: -1 }, e = -1, n = s.length;
  for (let i = 0; i < n; i++) {
    let r = s[i];
    if (r !== "*" && r !== "_" && r !== "~") continue;
    let a = i === 0 ? `
` : s[i - 1], o = i + 1;
    for (; o < n && s[o] === r; ) o++;
    a !== " " && a !== "	" && a !== `
` && a !== "\r" && a !== "\f" && (r === "~" ? e = i : t[r] = i), i = o - 1;
  }
  return { maskedSrc: s, lastPossibleEmStrongCloserIndex: t, lastPossibleDelCloserIndex: e };
}
function Ng(s, t) {
  let e = fi(t), n = re.get(s);
  n ? n.push(e) : re.set(s, [e]);
}
function Pg(s) {
  let t = re.get(s);
  t && (t.pop(), t.length === 0 && re.delete(s));
}
function Dg(s, t, e) {
  let n = re.get(s)?.at(-1);
  return n && n.maskedSrc === t ? n.lastPossibleEmStrongCloserIndex[e] : fi(t).lastPossibleEmStrongCloserIndex[e];
}
function Hg(s, t) {
  let e = re.get(s)?.at(-1);
  return e && e.maskedSrc === t ? e.lastPossibleDelCloserIndex : fi(t).lastPossibleDelCloserIndex;
}
function en(s, t = 0) {
  let e = t, n = "";
  for (let i of s) if (i === "	") {
    let r = 4 - e % 4;
    n += " ".repeat(r), e += r;
  } else n += i, e++;
  return n;
}
function wa(s, t, e, n, i) {
  let r = t.href, a = t.title || null, o = s[1].replace(i.other.outputLinkReplace, "$1"), l = s[0].charAt(0) === "!", c = n.state.inLink, d = n.state.linkEmitted, u = n.state.inRawBlock;
  n.state.inLink = !0, n.state.linkEmitted = !1;
  let h = n.inlineTokens(o), p = n.state.linkEmitted;
  if (n.state.linkEmitted = d, n.state.inLink = c, !l) {
    if (p) {
      n.state.inRawBlock = u;
      return;
    }
    n.state.linkEmitted = !0;
  }
  return { type: l ? "image" : "link", raw: e, href: r, title: a, text: o, tokens: h };
}
function Bg(s, t, e) {
  let n = s.match(e.other.indentCodeCompensation);
  if (n === null) return t;
  let i = n[1];
  return t.split(`
`).map((r) => {
    let a = r.match(e.other.beginningSpace);
    if (a === null) return r;
    let [o] = a;
    return r.slice(Math.min(o.length, i.length));
  }).join(`
`);
}
function Sa(s, t, e, n) {
  if (!t.includes("<")) return !1;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "\\") {
      i++;
      continue;
    }
    if (t[i] === "`") {
      let o = n.inline.code.exec(t.slice(i));
      if (o) {
        i += o[0].length - 1;
        continue;
      }
    }
    if (t[i] !== "<") continue;
    let r = s.slice(e + i), a = n.inline.tag.exec(r) || n.inline.autolink.exec(r);
    if (a) {
      if (a[0].length > t.length - i) return !0;
      i += a[0].length - 1;
    }
  }
  return !1;
}
var se = class {
  options;
  rules;
  lexer;
  constructor(t) {
    this.options = t || Vt;
  }
  space(t) {
    let e = this.rules.block.newline.exec(t);
    if (e && e[0].length > 0) return { type: "space", raw: e[0] };
  }
  code(t) {
    let e = this.rules.block.code.exec(t);
    if (e) {
      let n = this.options.pedantic ? e[0] : va(e[0]), i = n.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: n, codeBlockStyle: "indented", text: i };
    }
  }
  fences(t) {
    let e = this.rules.block.fences.exec(t);
    if (e) {
      let n = e[0], i = Bg(n, e[3] || "", this.rules);
      return { type: "code", raw: n, lang: e[2] ? e[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : e[2], text: i };
    }
  }
  heading(t) {
    let e = this.rules.block.heading.exec(t);
    if (e) {
      let n = e[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let i = xt(n, "#");
        (this.options.pedantic || !i || this.rules.other.endingSpaceTabChar.test(i)) && (n = i.trim());
      }
      return { type: "heading", raw: xt(e[0], `
`), depth: e[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(t) {
    let e = this.rules.block.hr.exec(t);
    if (e) return { type: "hr", raw: xt(e[0], `
`) };
  }
  blockquote(t) {
    let e = this.rules.block.blockquote.exec(t);
    if (e) {
      let n = xt(e[0], `
`).split(`
`), i = "", r = "", a = [];
      for (; n.length > 0; ) {
        let o = !1, l = [], c;
        for (c = 0; c < n.length; c++) if (this.rules.other.blockquoteStart.test(n[c])) l.push(n[c]), o = !0;
        else if (!o) l.push(n[c]);
        else break;
        n = n.slice(c);
        let d = l.join(`
`), u = d.replace(this.rules.other.blockquoteMarkerWhitespace, (f, _, g) => _ + en(g, _.length)).replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        i = i ? `${i}
${d}` : d, r = r ? `${r}
${u}` : u;
        let h = this.lexer.state.top;
        if (this.lexer.state.top = !0, this.lexer.blockTokens(u, a, !0), this.lexer.state.top = h, n.length === 0) break;
        let p = a.at(-1);
        if (p?.type === "code" || p?.type === "heading" || p?.type === "hr" || p?.type === "html" || p?.type === "table") break;
        if (p?.type === "blockquote") {
          let f = p, _ = n.join(`
`), g = f.raw + `
` + _.replace(this.rules.other.blockquoteSetextReplace2, ""), m = this.blockquote(g);
          a[a.length - 1] = m;
          let A = g.substring(m.raw.length).replace(/^\n/, ""), k = A ? A.split(`
`).length : 0, y = k ? n.slice(0, -k) : n;
          if (y.length > 0 && (i = `${i}
${y.join(`
`)}`), r = r.substring(0, r.length - f.text.length) + m.text, n = n.slice(y.length), n.length > 0 && this.rules.other.blockquoteStart.test(n[0])) continue;
          break;
        } else if (p?.type === "list") {
          let f = p, _ = f.raw + `
` + n.join(`
`), g = this.list(_);
          a[a.length - 1] = g;
          let m = g.raw.length > f.raw.length ? _.slice(f.raw.length + 1, g.raw.length).split(`
`).length : 0;
          if (m > 0) {
            let A = n.slice(0, m).join(`
`);
            i = `${i}
${A}`, r = `${r}
${A}`;
          }
          n = n.slice(m);
          continue;
        }
      }
      return { type: "blockquote", raw: i, tokens: a, text: r };
    }
  }
  list(t) {
    let e = this.rules.block.list.exec(t);
    if (e) {
      let n = t, i = () => n.length - t.length, r = e[1].trim(), a = r.length > 1, o = { type: "list", raw: "", ordered: a, start: a ? +r.slice(0, -1) : "", loose: !1, items: [] };
      r = a ? `\\d{1,9}\\${r.slice(-1)}` : `\\${r}`, this.options.pedantic && (r = a ? r : "[*+-]");
      let l = this.rules.other.listItemRegex(r), c = !1;
      for (; t; ) {
        let u = !1, h = "";
        if (!(e = l.exec(t)) || this.rules.block.hr.test(t)) break;
        let p = i();
        t = t.substring(e[0].length);
        let f = e[2].split(`
`, 1)[0], _ = e[1].length, g = this.options.pedantic ? en(f, _) : f.replace(this.rules.other.leadingSpaceTab, (b) => en(b, _)), m = t.split(`
`, 1)[0], A = !g.trim(), k = 0;
        if (this.options.pedantic ? (k = 2, h = g.trimStart()) : A ? k = _ + 1 : (k = g.search(this.rules.other.nonSpaceChar), k = k > 4 ? 1 : k, h = g.slice(k), k += _), A && this.rules.other.blankLine.test(m) && (t = t.substring(m.length + 1), u = !0), !u) {
          let b = this.rules.other.nextBulletRegex(k), v = this.rules.other.hrRegex(k), w = this.rules.other.fencesBeginRegex(k), T = this.options.pedantic ? this.rules.other.pedanticHeadingBeginRegex(k) : this.rules.other.headingBeginRegex(k), S = this.rules.other.htmlBeginRegex(k), x = this.rules.other.blockquoteBeginRegex(k);
          for (; t; ) {
            let L = t.split(`
`, 1)[0], E;
            if (m = L, this.options.pedantic ? (m = m.replace(this.rules.other.listReplaceNesting, "  "), E = m) : E = m.replace(this.rules.other.leadingSpaceTab, (N) => en(N)), w.test(m) || T.test(m) || S.test(m) || x.test(m) || b.test(m) || v.test(m)) break;
            if (E.search(this.rules.other.nonSpaceChar) >= k || !m.trim()) h += `
` + E.slice(k);
            else {
              if (A || g.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || w.test(g) || T.test(g) || S.test(g) || v.test(g)) break;
              let N = !this.options.pedantic && /^ {0,3}(?:=+|-+) *$/.test(m) && this.rules.block.lheading.test(`${g}
${m}`) ? `    ${E.replace(/^ {0,3}/, "")}` : m;
              h += `
` + N;
            }
            A = !m.trim(), t = t.substring(L.length + 1), g = E.slice(k);
          }
        }
        let y = n.slice(p, i());
        o.loose || (c ? o.loose = !0 : this.rules.other.doubleBlankLine.test(y) && (c = !0)), o.items.push({ type: "list_item", raw: y, task: !!this.options.gfm && this.rules.other.listIsTask.test(h), loose: !1, text: h, tokens: [] });
      }
      let d = o.items.at(-1);
      if (d) d.raw = d.raw.trimEnd(), d.text = d.text.trimEnd();
      else return;
      o.raw = n.slice(0, i()).trimEnd();
      for (let u of o.items) if (this.lexer.state.top = !1, u.tokens = this.lexer.blockTokens(u.text, []), !o.loose) {
        let h = u.tokens.filter((f) => f.type === "space"), p = h.length > 0 && h.some((f) => this.rules.other.anyLine.test(f.raw));
        o.loose = p;
      }
      for (let u of o.items) {
        let h = u.tokens[0];
        if (u.task && (h?.type === "text" || h?.type === "paragraph")) {
          u.text = u.text.replace(this.rules.other.listReplaceTask, ""), h.raw = h.raw.replace(this.rules.other.listReplaceTask, ""), h.text = h.text.replace(this.rules.other.listReplaceTask, "");
          for (let f = this.lexer.inlineQueue.length - 1; f >= 0; f--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[f].src)) {
            this.lexer.inlineQueue[f].src = this.lexer.inlineQueue[f].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let p = this.rules.other.listTaskCheckbox.exec(u.raw);
          if (p) {
            let f = { type: "checkbox", raw: p[0] + " ", checked: p[0] !== "[ ]" };
            u.checked = f.checked, o.loose ? u.tokens[0] && ["paragraph", "text"].includes(u.tokens[0].type) && "tokens" in u.tokens[0] && u.tokens[0].tokens ? (u.tokens[0].raw = f.raw + u.tokens[0].raw, u.tokens[0].text = f.raw + u.tokens[0].text, u.tokens[0].tokens.unshift(f)) : u.tokens.unshift({ type: "paragraph", raw: f.raw, text: f.raw, tokens: [f] }) : u.tokens.unshift(f);
          }
        } else u.task && (u.task = !1);
      }
      if (o.loose) for (let u of o.items) {
        u.loose = !0;
        for (let h of u.tokens) h.type === "text" && (h.type = "paragraph");
      }
      return o;
    }
  }
  html(t) {
    let e = this.rules.block.html.exec(t);
    if (e) {
      let n = va(e[0]);
      return { type: "html", block: !0, raw: n, pre: e[1] === "pre" || e[1] === "script" || e[1] === "style", text: n };
    }
  }
  def(t) {
    let e = this.rules.block.def.exec(t);
    if (e) {
      if (!this.rules.other.startAngleBracket.test(e[2]) && ya(e[2], "()") !== -1) return;
      let n = kn(e[1]), i = e[2] ? e[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r = e[3] ? e[3].substring(1, e[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : e[3];
      return { type: "def", tag: n, raw: xt(e[0], `
`), href: i, title: r };
    }
  }
  table(t) {
    let e = this.rules.block.table.exec(t);
    if (!e || !this.rules.other.tableDelimiter.test(e[2])) return;
    let n = ba(e[1]), i = e[2].replace(this.rules.other.tableAlignChars, "").split("|"), r = e[3]?.trim() ? e[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], a = { type: "table", raw: xt(e[0], `
`), header: [], align: [], rows: [] };
    if (n.length === i.length) {
      for (let o of i) this.rules.other.tableAlignRight.test(o) ? a.align.push("right") : this.rules.other.tableAlignCenter.test(o) ? a.align.push("center") : this.rules.other.tableAlignLeft.test(o) ? a.align.push("left") : a.align.push(null);
      for (let o = 0; o < n.length; o++) a.header.push({ text: n[o], tokens: this.lexer.inline(n[o]), header: !0, align: a.align[o] });
      for (let o of r) a.rows.push(ba(o, a.header.length).map((l, c) => ({ text: l, tokens: this.lexer.inline(l), header: !1, align: a.align[c] })));
      return a;
    }
  }
  lheading(t) {
    let e = this.rules.block.lheading.exec(t);
    if (e) {
      let n = e[1].trim();
      return { type: "heading", raw: xt(e[0], `
`), depth: e[2].charAt(0) === "=" ? 1 : 2, text: n, tokens: this.lexer.inline(n) };
    }
  }
  paragraph(t) {
    let e = this.rules.block.paragraph.exec(t);
    if (e) {
      let n = e[1].charAt(e[1].length - 1) === `
` ? e[1].slice(0, -1) : e[1];
      return { type: "paragraph", raw: e[0], text: n, tokens: this.lexer.inline(n) };
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
      let n = e[0].charAt(0) === "!" ? 2 : 1;
      if (!this.options.pedantic && Sa(t, e[1], n, this.rules)) return;
      let i = e[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(i)) {
        if (!this.rules.other.endAngleBracket.test(i)) return;
        let l = xt(i.slice(0, -1), "\\");
        if ((i.length - l.length) % 2 === 0) return;
      } else {
        let l = ya(e[2], "()");
        if (l === -2) return;
        if (l > -1) {
          let c = (e[0].indexOf("!") === 0 ? 5 : 4) + e[1].length + l;
          e[2] = e[2].substring(0, l), e[0] = e[0].substring(0, c).trim(), e[3] = "";
        }
      }
      let r = xt(e[0].slice(0, -1), "\\");
      if ((e[0].length - r.length) % 2 === 0) return;
      let a = e[2], o = "";
      if (this.options.pedantic) {
        let l = this.rules.other.pedanticHrefTitle.exec(a);
        l && (a = l[1], o = l[3]);
      } else o = e[3] ? e[3].slice(1, -1) : "";
      return a = a.trim(), this.rules.other.startAngleBracket.test(a) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(i) ? a = a.slice(1) : a = a.slice(1, -1)), wa(e, { href: a && a.replace(this.rules.inline.anyPunctuation, "$1"), title: o && o.replace(this.rules.inline.anyPunctuation, "$1") }, e[0], this.lexer, this.rules);
    }
  }
  reflink(t, e) {
    let n;
    if ((n = this.rules.inline.reflink.exec(t)) || (n = this.rules.inline.nolink.exec(t))) {
      let i = n[0].charAt(0) === "!" ? 2 : 1;
      if (!this.options.pedantic && Sa(t, n[1], i, this.rules)) return;
      let r = e[kn(n[2] || n[1])];
      if (!r) {
        let a = n[0].charAt(0);
        return { type: "text", raw: a, text: a };
      }
      return wa(n, r, n[0], this.lexer, this.rules);
    }
  }
  emStrong(t, e, n = "") {
    let i = this.rules.inline.emStrongLDelim.exec(t);
    if (!i || !i[1] && !i[2] && !i[3] && !i[4]) return;
    let r = i[0][0], a = n === r, o = e.length - t.length, l = o;
    for (; !this.options.pedantic && l > 0 && e[l - 1] === r; ) l--;
    let c = [...e.slice(Math.max(0, l - 2), l)].at(-1) ?? "", d = c === "*" || c === "_" || !!this.rules.inline.punctuation.exec(c);
    l < o && (n = c);
    let u = l < o ? d : !!this.rules.inline.punctuation.exec(n);
    if (i[4] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
    let h = i[1] || i[3] || "";
    if (!h || !n || u) {
      let p = [...i[0]].length - 1, f, _, g = p, m = 0, A = o - l + p, k = !this.options.pedantic && !!c.trim() && (!!h || r === "*" && !d);
      if (r !== "*" && r !== "_") return;
      let y = r === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd, b = Dg(this, e, r), v = e.length - t.length + p;
      if (b < v) return;
      e = e.slice(-1 * t.length + p);
      let w = b - v;
      for (y.lastIndex = 0; (i = y.exec(e)) !== null && !(i.index > w); ) {
        if (f = i[1] || i[2] || i[3] || i[4] || i[5] || i[6], !f) continue;
        if (_ = [...f].length, i[3] || i[4]) {
          g += _;
          continue;
        } else if (i[5] || i[6] || k) {
          if (a && (i[5] || i[6])) break;
          if (A % 3 && !((A + _) % 3)) {
            m += _;
            continue;
          }
        }
        if (g -= _, g > 0) continue;
        _ = Math.min(_, _ + g + m);
        let T = [...i[0]][0].length, S = t.slice(0, p + i.index + T + _);
        if (Math.min(p, _) % 2) {
          let L = S.slice(1, -1);
          return { type: "em", raw: S, text: L, tokens: this.lexer.inlineTokens(L) };
        }
        let x = S.slice(2, -2);
        return { type: "strong", raw: S, text: x, tokens: this.lexer.inlineTokens(x) };
      }
    }
  }
  codespan(t) {
    let e = this.rules.inline.code.exec(t);
    if (e) {
      let n = e[2].replace(this.rules.other.newLineCharGlobal, " "), i = this.rules.other.nonSpaceChar.test(n), r = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return i && r && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: e[0], text: n };
    }
  }
  br(t) {
    let e = this.rules.inline.br.exec(t);
    if (e) return { type: "br", raw: e[0] };
  }
  del(t, e, n = "") {
    let i = this.rules.inline.delLDelim.exec(t);
    if (i && (!i[1] || !n || this.rules.inline.punctuation.exec(n))) {
      let r = [...i[0]].length - 1, a, o, l = r, c = this.rules.inline.delRDelim, d = Hg(this, e), u = e.length - t.length + r;
      if (d < u) return;
      e = e.slice(-1 * t.length + r);
      let h = d - u;
      for (c.lastIndex = 0; (i = c.exec(e)) !== null && !(i.index > h); ) {
        if (a = i[1] || i[2] || i[3] || i[4] || i[5] || i[6], !a || (o = [...a].length, o !== r)) continue;
        if (i[3] || i[4]) {
          l += o;
          continue;
        }
        if (l -= o, l > 0) continue;
        o = Math.min(o, o + l);
        let p = [...i[0]][0].length, f = t.slice(0, r + i.index + p + o), _ = f.slice(r, -r);
        return { type: "del", raw: f, text: _, tokens: this.lexer.inlineTokens(_) };
      }
    }
  }
  autolink(t) {
    let e = this.rules.inline.autolink.exec(t);
    if (e) {
      let n, i;
      return e[2] === "@" ? (n = e[1], i = "mailto:" + n) : (n = e[1], i = n), { type: "link", raw: e[0], text: n, href: i, autolink: !0, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(t) {
    let e;
    if (e = this.rules.inline.url.exec(t)) {
      let n, i;
      if (e[2] === "@") n = e[0], i = "mailto:" + n;
      else {
        let r;
        do
          r = e[0], e[0] = this.rules.inline._backpedal.exec(e[0])?.[0] ?? "";
        while (r !== e[0]);
        n = e[0], e[1] === "www." ? i = "http://" + e[0] : i = e[0];
      }
      return { type: "link", raw: e[0], text: n, href: i, autolink: !0, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(t) {
    let e = this.rules.inline.text.exec(t);
    if (e) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: e[0], text: n ? e[0] : $g(e[0]), escaped: n };
    }
  }
}, pt = class Hs {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(t) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = t || Vt, this.options.tokenizer = this.options.tokenizer || new se(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: !1, inRawBlock: !1, linkEmitted: !1, linkParenPossible: !0, top: !0 };
    let e = { other: et, block: tn.normal, inline: be.normal };
    this.options.pedantic ? (e.block = tn.pedantic, e.inline = be.pedantic) : this.options.gfm && (e.block = tn.gfm, this.options.breaks ? e.inline = be.breaks : e.inline = be.gfm), this.tokenizer.rules = e;
  }
  static get rules() {
    return { block: tn, inline: be };
  }
  static lex(t, e) {
    return new Hs(e).lex(t);
  }
  static lexInline(t, e) {
    return new Hs(e).inlineTokens(t);
  }
  lex(t) {
    t = t.replace(et.carriageReturn, `
`), this.blockTokens(t, this.tokens);
    for (let e = 0; e < this.inlineQueue.length; e++) {
      let n = this.inlineQueue[e];
      this.state.inRawBlock = !1, this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(t, e = [], n = !1) {
    this.tokenizer.lexer = this, this.options.pedantic && (t = t.replace(et.tabCharGlobal, "    ").replace(et.spaceLine, ""));
    let i = 1 / 0;
    for (; t; ) {
      if (t.length < i) i = t.length;
      else {
        this.infiniteLoopError(t.charCodeAt(0));
        break;
      }
      let r;
      if (this.options.extensions?.block?.some((o) => (r = o.call({ lexer: this }, t, e)) ? (t = t.substring(r.raw.length), e.push(r), !0) : !1)) continue;
      if (r = this.tokenizer.space(t)) {
        t = t.substring(r.raw.length);
        let o = e.at(-1);
        r.raw.length === 1 && o !== void 0 ? o.raw += `
` : e.push(r);
        continue;
      }
      if (r = this.tokenizer.code(t)) {
        t = t.substring(r.raw.length);
        let o = e.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.at(-1).src = o.text) : e.push(r);
        continue;
      }
      if (r = this.tokenizer.fences(t)) {
        t = t.substring(r.raw.length), e.push(r);
        continue;
      }
      if (r = this.tokenizer.heading(t)) {
        t = t.substring(r.raw.length), e.push(r);
        continue;
      }
      if (r = this.tokenizer.hr(t)) {
        t = t.substring(r.raw.length), e.push(r);
        continue;
      }
      if (r = this.tokenizer.blockquote(t)) {
        t = t.substring(r.raw.length), e.push(r);
        continue;
      }
      if (r = this.tokenizer.list(t)) {
        t = t.substring(r.raw.length), e.push(r);
        continue;
      }
      if (r = this.tokenizer.html(t)) {
        t = t.substring(r.raw.length), e.push(r);
        continue;
      }
      if (r = this.tokenizer.def(t)) {
        t = t.substring(r.raw.length);
        let o = e.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.raw, this.inlineQueue.at(-1).src = o.text) : (this.tokens.links[r.tag] || (this.tokens.links[r.tag] = { href: r.href, title: r.title }), e.push(r));
        continue;
      }
      if (r = this.tokenizer.table(t)) {
        t = t.substring(r.raw.length), e.push(r);
        continue;
      }
      if (r = this.tokenizer.lheading(t)) {
        t = t.substring(r.raw.length), e.push(r);
        continue;
      }
      let a = t;
      if (this.options.extensions?.startBlock) {
        let o = 1 / 0, l = t.slice(1), c;
        this.options.extensions.startBlock.forEach((d) => {
          c = d.call({ lexer: this }, l), typeof c == "number" && c >= 0 && (o = Math.min(o, c));
        }), o < 1 / 0 && o >= 0 && (a = t.substring(0, o + 1));
      }
      if (this.state.top && (r = this.tokenizer.paragraph(a))) {
        let o = e.at(-1);
        n && o?.type === "paragraph" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : e.push(r), n = a.length !== t.length, t = t.substring(r.raw.length);
        continue;
      }
      if (r = this.tokenizer.text(t)) {
        t = t.substring(r.raw.length);
        let o = e.at(-1);
        o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : e.push(r);
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
    for (let n of t.matchAll(this.tokenizer.rules.inline.blockSkip)) if (e.test(n[0]) && t.charAt(n.index - 1) !== "!") return !0;
    for (let n of t.matchAll(this.tokenizer.rules.inline.reflinkSearch)) {
      let i = n[0], r = i.lastIndexOf("[");
      if (!(i.charAt(0) === "!" || !Object.hasOwn(this.tokens.links, kn(i.slice(r + 1, -1)))) && !(r > 1 && this.linkInText(i.slice(1, r - 1)))) return !0;
    }
    return !1;
  }
  inlineTokens(t, e = []) {
    this.tokenizer.lexer = this;
    let n = this.state.linkParenPossible;
    this.state.linkParenPossible = n && t.includes(")");
    try {
      return this.#t(t, e);
    } finally {
      this.state.linkParenPossible = n;
    }
  }
  #t(t, e) {
    let n = t.includes("*") || t.includes("_") || t.includes("~") || this.options.hooks?.emStrongMask || this.tokenizer.emStrong !== se.prototype.emStrong || this.tokenizer.del !== se.prototype.del ? this.#n(t) : t;
    Ng(this.tokenizer, n);
    try {
      return this.#e(t, n, e);
    } finally {
      Pg(this.tokenizer);
    }
  }
  #e(t, e, n) {
    let i = !1, r = "", a = 1 / 0;
    for (; t; ) {
      if (t.length < a) a = t.length;
      else {
        this.infiniteLoopError(t.charCodeAt(0));
        break;
      }
      i || (r = ""), i = !1;
      let o;
      if (this.options.extensions?.inline?.some((c) => (o = c.call({ lexer: this }, t, n)) ? (t = t.substring(o.raw.length), n.push(o), !0) : !1)) continue;
      if (o = this.tokenizer.escape(t)) {
        t = t.substring(o.raw.length), n.push(o);
        continue;
      }
      if (o = this.tokenizer.tag(t)) {
        t = t.substring(o.raw.length), n.push(o);
        continue;
      }
      if (o = this.tokenizer.link(t)) {
        t = t.substring(o.raw.length), n.push(o);
        continue;
      }
      if (o = this.tokenizer.reflink(t, this.tokens.links)) {
        t = t.substring(o.raw.length);
        let c = n.at(-1);
        o.type === "text" && c?.type === "text" ? (c.raw += o.raw, c.text += o.text) : n.push(o);
        continue;
      }
      if (o = this.tokenizer.emStrong(t, e, r)) {
        t = t.substring(o.raw.length), n.push(o);
        continue;
      }
      if (o = this.tokenizer.codespan(t)) {
        t = t.substring(o.raw.length), n.push(o);
        continue;
      }
      if (o = this.tokenizer.br(t)) {
        t = t.substring(o.raw.length), n.push(o);
        continue;
      }
      if (o = this.tokenizer.del(t, e, r)) {
        t = t.substring(o.raw.length), n.push(o);
        continue;
      }
      if (o = this.tokenizer.autolink(t)) {
        t = t.substring(o.raw.length), n.push(o);
        continue;
      }
      if (!this.state.inLink && (o = this.tokenizer.url(t))) {
        t = t.substring(o.raw.length), n.push(o);
        continue;
      }
      let l = t;
      if (this.options.extensions?.startInline) {
        let c = 1 / 0, d = t.slice(1), u;
        this.options.extensions.startInline.forEach((h) => {
          u = h.call({ lexer: this }, d), typeof u == "number" && u >= 0 && (c = Math.min(c, u));
        }), c < 1 / 0 && c >= 0 && (l = t.substring(0, c + 1));
      }
      if (o = this.tokenizer.inlineText(l)) {
        t = t.substring(o.raw.length), o.raw.slice(-1) !== "_" && (r = o.raw.slice(-1)), i = !0;
        let c = n.at(-1);
        c?.type === "text" ? (c.raw += o.raw, c.text += o.text) : n.push(o);
        continue;
      }
      if (t) {
        this.infiniteLoopError(t.charCodeAt(0));
        break;
      }
    }
    return n;
  }
  #n(t) {
    let e = t;
    if (this.tokens.links && t.includes("[")) {
      let n = this.tokenizer.rules.inline.reflinkSearch, i = (r) => {
        let a = r.lastIndexOf("[");
        if (!Object.hasOwn(this.tokens.links, kn(r.slice(a + 1, -1)))) return r;
        if (a > 1 && r.charAt(0) !== "!") {
          let o = r.slice(1, a - 1);
          if (this.linkInText(o)) return "[" + o.replace(n, i) + "][" + "a".repeat(r.length - a - 2) + "]";
        }
        return "[" + "a".repeat(r.length - 2) + "]";
      };
      e = e.replace(n, i);
    }
    return e = e.replace(this.tokenizer.rules.inline.anyPunctuationOutsideCode, (n, i, r) => r ? "+".repeat(n.length) : i ? i + n.slice(i.length, -i.length).replace(/`/g, "+") + i : n), e = e.replace(this.tokenizer.rules.inline.blockSkip, (n, i, r) => {
      let a = r ? r.length : 0;
      return n.slice(0, a) + "[" + "a".repeat(n.length - a - 2) + "]";
    }), e = this.options.hooks?.emStrongMask?.call({ lexer: this }, e) ?? e, e;
  }
  infiniteLoopError(t) {
    let e = "Infinite loop on byte: " + t;
    if (this.options.silent) console.error(e);
    else throw new Error(e);
  }
}, An = class {
  options;
  parser;
  constructor(t) {
    this.options = t || Vt;
  }
  space(t) {
    return "";
  }
  code({ text: t, lang: e, escaped: n }) {
    let i = (e || "").match(et.notSpaceStart)?.[0], r = t ? t.replace(et.endingNewline, "") + `
` : "";
    return i ? '<pre><code class="language-' + ot(i) + '">' + (n ? r : ot(r, !0)) + `</code></pre>
` : "<pre><code>" + (n ? r : ot(r, !0)) + `</code></pre>
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
    let e = t.ordered, n = t.start, i = "";
    for (let o = 0; o < t.items.length; o++) {
      let l = t.items[o];
      i += this.listitem(l);
    }
    let r = e ? "ol" : "ul", a = e && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + r + a + `>
` + i + "</" + r + `>
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
    let e = "", n = "";
    for (let r = 0; r < t.header.length; r++) n += this.tablecell(t.header[r]);
    e += this.tablerow({ text: n });
    let i = "";
    for (let r = 0; r < t.rows.length; r++) {
      let a = t.rows[r];
      n = "";
      for (let o = 0; o < a.length; o++) n += this.tablecell(a[o]);
      i += this.tablerow({ text: n });
    }
    return i && (i = `<tbody>${i}</tbody>`), `<table>
<thead>
` + e + `</thead>
` + i + `</table>
`;
  }
  tablerow({ text: t }) {
    return `<tr>
${t}</tr>
`;
  }
  tablecell(t) {
    let e = this.parser.parseInline(t.tokens), n = t.header ? "th" : "td";
    return (t.align ? `<${n} align="${t.align}">` : `<${n}>`) + e + `</${n}>
`;
  }
  strong({ tokens: t }) {
    return `<strong>${this.parser.parseInline(t)}</strong>`;
  }
  em({ tokens: t }) {
    return `<em>${this.parser.parseInline(t)}</em>`;
  }
  codespan({ text: t }) {
    return `<code>${ot(t, !0)}</code>`;
  }
  br(t) {
    return "<br>";
  }
  del({ tokens: t }) {
    return `<del>${this.parser.parseInline(t)}</del>`;
  }
  link({ href: t, title: e, text: n, tokens: i, autolink: r }) {
    let a = r ? ot(n, !0) : this.parser.parseInline(i), o = ma(t);
    if (o === null) return a;
    t = ot(o, r);
    let l = '<a href="' + t + '"';
    return e && (l += ' title="' + ot(e) + '"'), l += ">" + a + "</a>", l;
  }
  image({ href: t, title: e, text: n, tokens: i }) {
    i && (n = this.parser.parseInline(i, this.parser.textRenderer));
    let r = ma(t);
    if (r === null) return ot(n);
    t = r;
    let a = `<img src="${ot(t)}" alt="${ot(n)}"`;
    return e && (a += ` title="${ot(e)}"`), a += ">", a;
  }
  text(t) {
    return "tokens" in t && t.tokens ? this.parser.parseInline(t.tokens) : "escaped" in t && t.escaped ? t.text : ot(t.text);
  }
}, gi = class {
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
}, ft = class Bs {
  options;
  renderer;
  textRenderer;
  constructor(t) {
    this.options = t || Vt, this.options.renderer = this.options.renderer || new An(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new gi(), this.textRenderer.parser = this;
  }
  static parse(t, e) {
    return new Bs(e).parse(t);
  }
  static parseInline(t, e) {
    return new Bs(e).parseInline(t);
  }
  parse(t) {
    this.renderer.parser = this;
    let e = "";
    for (let n = 0; n < t.length; n++) {
      let i = t[n];
      if (this.options.extensions?.renderers?.[i.type]) {
        let a = i, o = this.options.extensions.renderers[a.type].call({ parser: this }, a);
        if (o !== !1 || !["space", "hr", "heading", "code", "table", "blockquote", "list", "checkbox", "html", "def", "paragraph", "text"].includes(a.type)) {
          e += o || "";
          continue;
        }
      }
      let r = i;
      switch (r.type) {
        case "space": {
          e += this.renderer.space(r);
          break;
        }
        case "hr": {
          e += this.renderer.hr(r);
          break;
        }
        case "heading": {
          e += this.renderer.heading(r);
          break;
        }
        case "code": {
          e += this.renderer.code(r);
          break;
        }
        case "table": {
          e += this.renderer.table(r);
          break;
        }
        case "blockquote": {
          e += this.renderer.blockquote(r);
          break;
        }
        case "list": {
          e += this.renderer.list(r);
          break;
        }
        case "checkbox": {
          e += this.renderer.checkbox(r);
          break;
        }
        case "html": {
          e += this.renderer.html(r);
          break;
        }
        case "def": {
          e += this.renderer.def(r);
          break;
        }
        case "paragraph": {
          e += this.renderer.paragraph(r);
          break;
        }
        case "text": {
          e += this.renderer.text(r);
          break;
        }
        default: {
          let a = 'Token with "' + r.type + '" type was not found.';
          if (this.options.silent) return console.error(a), "";
          throw new Error(a);
        }
      }
    }
    return e;
  }
  parseInline(t, e = this.renderer) {
    this.renderer.parser = this;
    let n = "";
    for (let i = 0; i < t.length; i++) {
      let r = t[i];
      if (this.options.extensions?.renderers?.[r.type]) {
        let o = this.options.extensions.renderers[r.type].call({ parser: this }, r);
        if (o !== !1 || !["escape", "html", "link", "image", "checkbox", "strong", "em", "codespan", "br", "del", "text"].includes(r.type)) {
          n += o || "";
          continue;
        }
      }
      let a = r;
      switch (a.type) {
        case "escape": {
          n += e.text(a);
          break;
        }
        case "html": {
          n += e.html(a);
          break;
        }
        case "link": {
          n += e.link(a);
          break;
        }
        case "image": {
          n += e.image(a);
          break;
        }
        case "checkbox": {
          n += e.checkbox(a);
          break;
        }
        case "strong": {
          n += e.strong(a);
          break;
        }
        case "em": {
          n += e.em(a);
          break;
        }
        case "codespan": {
          n += e.codespan(a);
          break;
        }
        case "br": {
          n += e.br(a);
          break;
        }
        case "del": {
          n += e.del(a);
          break;
        }
        case "text": {
          n += e.text(a);
          break;
        }
        default: {
          let o = 'Token with "' + a.type + '" type was not found.';
          if (this.options.silent) return console.error(o), "";
          throw new Error(o);
        }
      }
    }
    return n;
  }
}, we = class {
  options;
  block;
  constructor(t) {
    this.options = t || Vt;
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
    return t ? pt.lex : pt.lexInline;
  }
  provideParser(t = this.block) {
    return t ? ft.parse : ft.parseInline;
  }
};
function Lt(s, t) {
  if (Array.isArray(t)) for (let e = 0; e < t.length; e++) s.push(t[e]);
  else s.push(t);
}
var qs = class {
  defaults = oi();
  options = this.setOptions;
  parse = this.parseMarkdown(!0);
  parseInline = this.parseMarkdown(!1);
  Parser = ft;
  Renderer = An;
  TextRenderer = gi;
  Lexer = pt;
  Tokenizer = se;
  Hooks = we;
  constructor(...t) {
    this.use(...t);
  }
  walkTokens(t, e) {
    let n = [];
    for (let i of t) switch (Lt(n, e.call(this, i)), i.type) {
      case "table": {
        let r = i;
        for (let a of r.header) Lt(n, this.walkTokens(a.tokens, e));
        for (let a of r.rows) for (let o of a) Lt(n, this.walkTokens(o.tokens, e));
        break;
      }
      case "list": {
        let r = i;
        Lt(n, this.walkTokens(r.items, e));
        break;
      }
      default: {
        let r = i;
        this.defaults.extensions?.childTokens?.[r.type] ? this.defaults.extensions.childTokens[r.type].forEach((a) => {
          let o = r[a].flat(1 / 0);
          Lt(n, this.walkTokens(o, e));
        }) : r.tokens && Lt(n, this.walkTokens(r.tokens, e));
      }
    }
    return n;
  }
  use(...t) {
    let e = this.defaults.extensions || { renderers: /* @__PURE__ */ Object.create(null), childTokens: /* @__PURE__ */ Object.create(null) };
    return t.forEach((n) => {
      let i = { ...n };
      if (i.async = this.defaults.async || i.async || !1, n.extensions && (n.extensions.forEach((r) => {
        if (!r.name) throw new Error("extension name required");
        if ("renderer" in r) {
          let a = e.renderers[r.name];
          a ? e.renderers[r.name] = function(...o) {
            let l = r.renderer.apply(this, o);
            return l === !1 && (l = a.apply(this, o)), l;
          } : e.renderers[r.name] = r.renderer;
        }
        if ("tokenizer" in r) {
          if (!r.level || r.level !== "block" && r.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let a = e[r.level];
          a ? a.unshift(r.tokenizer) : e[r.level] = [r.tokenizer], r.start && (r.level === "block" ? e.startBlock ? e.startBlock.push(r.start) : e.startBlock = [r.start] : r.level === "inline" && (e.startInline ? e.startInline.push(r.start) : e.startInline = [r.start]));
        }
        "childTokens" in r && r.childTokens && (e.childTokens[r.name] = r.childTokens);
      }), i.extensions = e), n.renderer) {
        let r = this.defaults.renderer || new An(this.defaults);
        for (let a in n.renderer) {
          if (!(a in r)) throw new Error(`renderer '${a}' does not exist`);
          if (["options", "parser"].includes(a)) continue;
          let o = a, l = n.renderer[o], c = r[o];
          r[o] = (...d) => {
            let u = l.apply(r, d);
            return u === !1 && (u = c.apply(r, d)), u === !1 ? "" : u ?? "";
          };
        }
        i.renderer = r;
      }
      if (n.tokenizer) {
        let r = this.defaults.tokenizer || new se(this.defaults);
        for (let a in n.tokenizer) {
          if (!(a in r)) throw new Error(`tokenizer '${a}' does not exist`);
          if (["options", "rules", "lexer"].includes(a)) continue;
          let o = a, l = n.tokenizer[o], c = r[o];
          r[o] = (...d) => {
            let u = l.apply(r, d);
            return u === !1 && (u = c.apply(r, d)), u;
          };
        }
        i.tokenizer = r;
      }
      if (n.hooks) {
        let r = this.defaults.hooks || new we();
        for (let a in n.hooks) {
          if (!(a in r)) throw new Error(`hook '${a}' does not exist`);
          if (["options", "block"].includes(a)) continue;
          let o = a, l = n.hooks[o], c = r[o];
          we.passThroughHooks.has(a) ? r[o] = (d) => {
            if (r.options.async && we.passThroughHooksRespectAsync.has(a)) return (async () => {
              let h = await l.call(r, d);
              return c.call(r, h);
            })();
            let u = l.call(r, d);
            return c.call(r, u);
          } : r[o] = (...d) => {
            if (r.options.async) return (async () => {
              let h = await l.apply(r, d);
              return h === !1 && (h = await c.apply(r, d)), h;
            })();
            let u = l.apply(r, d);
            return u === !1 && (u = c.apply(r, d)), u;
          };
        }
        i.hooks = r;
      }
      if (n.walkTokens) {
        let r = this.defaults.walkTokens, a = n.walkTokens;
        i.walkTokens = function(o) {
          let l = [];
          return Lt(l, a.call(this, o)), r && Lt(l, r.call(this, o)), l;
        };
      }
      this.defaults = { ...this.defaults, ...i };
    }), this;
  }
  setOptions(t) {
    return this.defaults = { ...this.defaults, ...t }, this;
  }
  lexer(t, e) {
    return pt.lex(t, e ?? this.defaults);
  }
  parser(t, e) {
    return ft.parse(t, e ?? this.defaults);
  }
  parseMarkdown(t) {
    return (e, n) => {
      let i = { ...n }, r = { ...this.defaults, ...i }, a = this.onError(!!r.silent, !!r.async);
      if (this.defaults.async === !0 && i.async === !1) return a(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof e > "u" || e === null) return a(new Error("marked(): input parameter is undefined or null"));
      if (typeof e != "string") return a(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(e) + ", string expected"));
      if (r.hooks && (r.hooks.options = r, r.hooks.block = t), r.async) return (async () => {
        let o = r.hooks ? await r.hooks.preprocess(e) : e, l = await (r.hooks ? await r.hooks.provideLexer(t) : t ? pt.lex : pt.lexInline)(o, r), c = r.hooks ? await r.hooks.processAllTokens(l) : l;
        r.walkTokens && await Promise.all(this.walkTokens(c, r.walkTokens));
        let d = await (r.hooks ? await r.hooks.provideParser(t) : t ? ft.parse : ft.parseInline)(c, r);
        return r.hooks ? await r.hooks.postprocess(d) : d;
      })().catch(a);
      try {
        r.hooks && (e = r.hooks.preprocess(e));
        let o = (r.hooks ? r.hooks.provideLexer(t) : t ? pt.lex : pt.lexInline)(e, r);
        r.hooks && (o = r.hooks.processAllTokens(o)), r.walkTokens && this.walkTokens(o, r.walkTokens);
        let l = (r.hooks ? r.hooks.provideParser(t) : t ? ft.parse : ft.parseInline)(o, r);
        return r.hooks && (l = r.hooks.postprocess(l)), l;
      } catch (o) {
        return a(o);
      }
    };
  }
  onError(t, e) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, t) {
        let i = "<p>An error occurred:</p><pre>" + ot(n.message + "", !0) + "</pre>";
        return e ? Promise.resolve(i) : i;
      }
      if (e) return Promise.reject(n);
      throw n;
    };
  }
}, jt = new qs();
function W(s, t) {
  return jt.parse(s, t);
}
W.options = W.setOptions = function(s) {
  return jt.setOptions(s), W.defaults = jt.defaults, Tl(W.defaults), W;
};
W.getDefaults = oi;
W.defaults = Vt;
function qg(...s) {
  return jt.use(...s), W.defaults = jt.defaults, Tl(W.defaults), W;
}
W.use = qg;
W.walkTokens = function(s, t) {
  return jt.walkTokens(s, t);
};
W.parseInline = jt.parseInline;
W.Parser = ft;
W.parser = ft.parse;
W.Renderer = An;
W.TextRenderer = gi;
W.Lexer = pt;
W.lexer = pt.lex;
W.Tokenizer = se;
W.Hooks = we;
W.parse = W;
W.options;
W.setOptions;
W.walkTokens;
W.parseInline;
ft.parse;
pt.lex;
var Fg = Object.defineProperty, Ug = Object.defineProperties, Wg = Object.getOwnPropertyDescriptors, ka = Object.getOwnPropertySymbols, zg = Object.prototype.hasOwnProperty, Gg = Object.prototype.propertyIsEnumerable, Aa = (s, t, e) => t in s ? Fg(s, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : s[t] = e, Hl = (s, t) => {
  for (var e in t || (t = {})) zg.call(t, e) && Aa(s, e, t[e]);
  if (ka) for (var e of ka(t)) Gg.call(t, e) && Aa(s, e, t[e]);
  return s;
}, Bl = (s, t) => Ug(s, Wg(t)), K = { PROSE: 0, FENCE_MARKER: 1, FENCE_INFO: 2, FENCE_BODY: 3, CODE_SPAN: 4, CODE_SPAN_OPEN: 5 }, jg = /^(`{3,}|~{3,})(.*)$/, Kg = (s) => s !== void 0 && s >= "0" && s <= "9", Vg = (s, t) => {
  let e = t;
  if (s[e] === "-" || s[e] === "*" || s[e] === "+") e += 1;
  else {
    for (; Kg(s[e]) && e - t < 9; ) e += 1;
    if (e === t || s[e] !== "." && s[e] !== ")") return -1;
    e += 1;
  }
  return s[e] === " " ? e + 1 : -1;
}, Xg = (s, t, e) => {
  let n = 0, i = t, r = !1, a = t;
  for (; ; ) {
    for (; a < e && s[a] === " "; ) a += 1;
    if (s[a] === ">") {
      n += 1, a += s[a + 1] === " " ? 2 : 1, i = a, r = !1;
      continue;
    }
    let o = a < e ? Vg(s, a) : -1;
    if (o === -1) return { contentStart: a, listIndent: r ? a - i : 0, quoteDepth: n };
    a = o, r = !0;
  }
}, Yg = (s, t, e, n) => {
  let i = t;
  for (let r = 0; r < n; r += 1) {
    for (; i < e && s[i] === " "; ) i += 1;
    if (s[i] !== ">") return -1;
    i += 1, s[i] === " " && (i += 1);
  }
  return i;
}, Qg = (s, t, e, n, i) => {
  let r = t + n;
  s.fill(K.FENCE_MARKER, r, r + i), s.fill(K.FENCE_INFO, r + i, Math.min(e + 1, s.length));
}, Zg = (s, t, e, n) => {
  let i = t;
  for (; i < e && s[i] === " "; ) i += 1;
  let r = 0;
  for (; i < e && s[i] === n.char; ) i += 1, r += 1;
  if (r < n.length) return !1;
  for (; i < e; ) {
    if (s[i] !== " " && s[i] !== "	" && s[i] !== "\r") return !1;
    i += 1;
  }
  return !0;
}, Jg = (s, t, e, n) => {
  let i = n > e && s[n - 1] === "\r" ? n - 1 : n, r = Xg(s, e, i), a = s.slice(r.contentStart, i).match(jg);
  if (!a) return null;
  let [, o, l] = a, c = o[0];
  return c === "`" && l.includes("`") ? null : (Qg(t, e, n, r.contentStart - e, o.length), { char: c, length: o.length, listIndent: r.listIndent, quoteDepth: r.quoteDepth });
}, t_ = (s, t, e, n) => {
  let i = Yg(s, t, e, n.quoteDepth);
  if (i === -1 || n.listIndent === 0) return i;
  let r = i;
  for (; r < e && s[r] === " "; ) r += 1;
  return r === e || s[r] === "\r" && r + 1 === e || r - i >= n.listIndent ? i : -1;
}, e_ = (s, t) => {
  let e = s.length, n = null, i = 0;
  for (; i < e; ) {
    let r = s.indexOf(`
`, i);
    r === -1 && (r = e);
    let a = n ? t_(s, i, r, n) : -1;
    n && a === -1 && (n = null), n ? Zg(s, a, r, n) ? (t.fill(K.FENCE_MARKER, i, r), n = null) : t.fill(K.FENCE_BODY, i, Math.min(r + 1, e)) : n = Jg(s, t, i, r), i = r + 1;
  }
  return n;
}, Ea = (s, t) => {
  let e = t + 1;
  for (; e < s.length && s[e] === "`"; ) e += 1;
  return e;
}, n_ = (s, t) => {
  let e = t + 1;
  for (; e < s.length && (s[e] === " " || s[e] === "	" || s[e] === "\r"); ) e += 1;
  return e < s.length && s[e] === `
`;
}, s_ = (s, t, e) => {
  let n = e;
  for (; ; ) {
    let i = s.indexOf("`", n);
    if (i === -1) return -1;
    let r = i > n && s[i - 1] === "\\" && t[i - 1] === K.PROSE;
    if (t[i] === K.PROSE && !r) return i;
    n = i + 1;
  }
}, i_ = (s, t) => {
  let e = s.length, n = -1, i = 0, r = 0;
  for (; r < e; ) {
    if (n < 0) {
      if (r = s_(s, t, r), r === -1) break;
      let o = Ea(s, r);
      n = r, i = o - r, r = o;
      continue;
    }
    if (t[r] !== K.PROSE) {
      t.fill(K.CODE_SPAN_OPEN, n, r), n = -1, r += 1;
      continue;
    }
    if (s[r] === `
` && n_(s, r)) {
      n = -1, r += 1;
      continue;
    }
    if (s[r] !== "`") {
      r += 1;
      continue;
    }
    let a = Ea(s, r);
    a - r === i && (t.fill(K.CODE_SPAN, n, a), n = -1), r = a;
  }
  return n >= 0 ? (t.fill(K.CODE_SPAN_OPEN, n, e), { start: n, runLength: i }) : null;
}, r_ = (s) => {
  let t = new Uint8Array(s.length), e = e_(s, t), n = i_(s, t);
  return { text: s, regions: t, openFence: e, openSpan: n, mathMask: null, linkUrlMask: null, htmlTagMask: null };
}, Fs = null, un = null, ht = (s) => {
  if (un !== null && s === Fs) return un;
  let t = r_(s);
  return Fs = s, un = t, t;
}, a_ = () => {
  Fs = null, un = null;
}, o_ = (s, t) => t >= s.regions.length ? s.openFence !== null || s.openSpan !== null : t < 0 ? !1 : s.regions[t] !== K.PROSE, l_ = (s, t) => s.regions[t] === K.CODE_SPAN, _i = (s, t) => {
  let e = ht(s), n = t + t, i = 0;
  for (let r = s.indexOf(n); r !== -1; r = s.indexOf(n, r)) e.regions[r] === K.PROSE ? (i += 1, r += 2) : r += 1;
  return i;
}, mi = new Uint8Array(0), c_ = (s) => s === "inlineLatex" || s === "blockLatex", d_ = (s, t) => t === "[" && s === "none" ? "blockLatex" : t === "]" && s === "blockLatex" ? "none" : t === "(" && s === "none" ? "inlineLatex" : t === ")" && s === "inlineLatex" ? "none" : null, u_ = (s, t) => t ? s === "blockDollar" ? "none" : "blockDollar" : s === "blockDollar" ? s : s === "inlineDollar" ? "none" : "inlineDollar", h_ = (s) => s.includes("$") || s.includes("\\(") || s.includes("\\["), p_ = (s, t, e) => {
  let n = s[t + 1];
  if (s[t] === "\\") {
    if (n === "$") return { context: e, length: 2 };
    let i = d_(e, n);
    return i === null ? null : { context: i, length: 2 };
  }
  if (s[t] === "$" && !c_(e)) {
    let i = n === "$";
    return { context: u_(e, i), length: i ? 2 : 1 };
  }
  return null;
}, f_ = (s) => {
  let { text: t, regions: e } = s, n = t.length, i = new Uint8Array(n), r = "none", a = 0;
  for (; a < n; ) {
    i[a] = r === "none" ? 0 : 1;
    let o = e[a] === K.PROSE ? p_(t, a, r) : null;
    if (o === null) {
      a += 1;
      continue;
    }
    r = o.context, o.length === 2 && (i[a + 1] = r === "none" ? 0 : 1), a += o.length;
  }
  return i;
}, le = (s, t) => t < 0 || t >= s.text.length ? !1 : (s.mathMask === null && (s.mathMask = h_(s.text) ? f_(s) : mi), s.mathMask[t] === 1), g_ = (s, t, e, n) => {
  let { text: i, regions: r } = s, a = new Uint8Array(e - t), o = 0;
  for (let c = e - 1; c >= t; c -= 1) i[c] === ")" && r[c] === K.PROSE && (o = 1), a[c - t] = o;
  let l = !1;
  for (let c = t; c < e; c += 1) l && a[c - t] === 1 && (n[c] = 1), r[c] === K.PROSE && (i[c] === ")" ? l = !1 : i[c] === "(" && (l = c > 0 && i[c - 1] === "]"));
}, __ = (s) => {
  let { text: t } = s, e = t.length, n = new Uint8Array(e), i = 0;
  for (; i < e; ) {
    let r = t.indexOf(`
`, i);
    r === -1 && (r = e), g_(s, i, r, n), i = r + 1;
  }
  return n;
}, bi = (s, t) => t < 0 || t >= s.text.length ? !1 : (s.linkUrlMask === null && (s.linkUrlMask = s.text.includes("](") ? __(s) : mi), s.linkUrlMask[t] === 1), m_ = (s) => {
  let { text: t, regions: e } = s, n = t.length, i = new Uint8Array(n), r = !1;
  for (let a = 0; a < n; a += 1) {
    if (t[a] === `
`) {
      r = !1;
      continue;
    }
    if (i[a] = r ? 1 : 0, e[a] === K.PROSE) {
      if (t[a] === ">") r = !1;
      else if (t[a] === "<") {
        let o = t[a + 1];
        r = o !== void 0 && (o >= "a" && o <= "z" || o >= "A" && o <= "Z" || o === "/");
      }
    }
  }
  return i;
}, ql = (s, t) => t < 0 || t >= s.text.length ? !1 : (s.htmlTagMask === null && (s.htmlTagMask = s.text.includes("<") ? m_(s) : mi), s.htmlTagMask[t] === 1), rt = (s, t) => o_(ht(s), t), Ot = (s, t) => l_(ht(s), t), b_ = /^(\s*(?:[-*+]|\d+[.)]) +)>(=?\s*[$]?\d)/gm, v_ = (s) => !s || typeof s != "string" || !s.includes(">") ? s : s.replace(b_, (t, e, n, i) => rt(s, i) ? t : `${e}\\>${n}`), $t = (s, { delimiter: t, markerLength: e, regex: n }) => {
  let i = s.lastIndexOf(t, s.length - 2), r = i === -1 ? s.length - 1 : i;
  return s.slice(Math.max(0, r - e + 1)).match(n);
}, y_ = { delimiter: "*", markerLength: 2, regex: /(\*\*)([^*]*\*?)$/ }, w_ = { delimiter: "_", markerLength: 2, regex: /(__)([^_]*?)$/ }, S_ = { delimiter: "*", markerLength: 3, regex: /(\*\*\*)([^*]*?)$/ }, k_ = { delimiter: "*", markerLength: 1, regex: /(\*)([^*]*?)$/ }, A_ = { delimiter: "_", markerLength: 1, regex: /(_)([^_]*?)$/ }, E_ = { delimiter: "~", markerLength: 2, regex: /(~~)([^~]*?)$/ }, C_ = { delimiter: "_", markerLength: 2, regex: /(__)([^_]+)_$/ }, x_ = { delimiter: "~", markerLength: 2, regex: /(~~)([^~]+)~$/ }, Xt = /^[\s_~*`]*$/, Fl = /^[\s]*[-*+][\s]+$/, T_ = /[\p{L}\p{N}_]/u, I_ = /^\*{4,}$/, _t = (s) => {
  if (!s) return !1;
  let t = s.charCodeAt(0);
  return t >= 48 && t <= 57 || t >= 65 && t <= 90 || t >= 97 && t <= 122 || t === 95 ? !0 : T_.test(s);
}, R_ = (s, t) => {
  let e = 1;
  for (let n = t - 1; n >= 0; n -= 1) if (s[n] === "]") e += 1;
  else if (s[n] === "[" && (e -= 1, e === 0)) return n;
  return -1;
}, Ul = (s, t) => {
  let e = 1;
  for (let n = t + 1; n < s.length; n += 1) if (s[n] === "[") e += 1;
  else if (s[n] === "]" && (e -= 1, e === 0)) return n;
  return -1;
}, M_ = (s, t) => le(ht(s), t), Pn = (s, t, e) => {
  let n = 0;
  for (let l = t - 1; l >= 0; l -= 1) if (s[l] === `
`) {
    n = l + 1;
    break;
  }
  let i = s.length;
  for (let l = t; l < s.length; l += 1) if (s[l] === `
`) {
    i = l;
    break;
  }
  let r = s.substring(n, i), a = 0, o = !1;
  for (let l of r) if (l === e) a += 1;
  else if (l !== " " && l !== "	") {
    o = !0;
    break;
  }
  return a >= 3 && !o;
}, L_ = (s, t, e, n) => e === "\\" || le(s, t) ? !0 : e !== "*" && n === "*" ? (t < s.text.length - 2 ? s.text[t + 2] : "") !== "*" : e === "*" || (!e || e === " " || e === "	" || e === `
`) && (!n || n === " " || n === "	" || n === `
`), En = (s) => s === " " || s === "	" || s === `
`, O_ = (s, t) => !!(s && t && _t(s) && _t(t)), $_ = (s, t, e, n) => {
  let i = O_(s, t), r = !!t && !En(t), a = !!s && !En(s);
  return i && e % 2 === 0 && !n ? { count: !1 } : a && e % 2 === 1 || r ? { count: !0, inWordAsteriskChain: i } : { count: !1 };
}, Wl = (s) => {
  let t = ht(s), e = 0, n = !1, i = s.length;
  for (let r = 0; r < i; r += 1) {
    if (s[r] !== "*" || t.regions[r] !== K.PROSE) {
      _t(s[r]) || (n = !1);
      continue;
    }
    let a = r > 0 ? s[r - 1] : "", o = r < i - 1 ? s[r + 1] : "";
    if (L_(t, r, a, o)) continue;
    let l = $_(a, o, e, n);
    l.count && (e += 1, n = l.inWordAsteriskChain);
  }
  return e;
}, N_ = (s, t, e, n) => !!(e === "\\" || le(s, t) || bi(s, t) || ql(s, t) || e === "_" || n === "_" || e && n && _t(e) && _t(n)), P_ = (s) => {
  let t = ht(s), e = 0, n = s.length;
  for (let i = 0; i < n; i += 1) {
    if (s[i] !== "_" || t.regions[i] !== K.PROSE) continue;
    let r = i > 0 ? s[i - 1] : "", a = i < n - 1 ? s[i + 1] : "";
    N_(t, i, r, a) || (e += 1);
  }
  return e;
}, D_ = (s) => {
  let t = ht(s), e = 0, n = 0;
  for (let i = 0; i < s.length; i += 1) s[i] === "*" && t.regions[i] === K.PROSE ? n += 1 : (n >= 3 && (e += Math.floor(n / 3)), n = 0);
  return n >= 3 && (e += Math.floor(n / 3)), e;
}, vi = (s) => _i(s, "*"), Ca = (s) => s === "" || s === " " || s === "	" || s === `
`, H_ = (s, t, e, n, i) => {
  if (!(Ca(e) && Ca(n))) return !1;
  if (t > i.lineEnd) {
    let r = s.indexOf(`
`, t);
    i.lineEnd = r === -1 ? s.length : r, i.result = Pn(s, t, "_");
  }
  return i.result;
}, B_ = (s, t, e, n) => {
  let i = s.text, r = t, a = !1;
  r > 0 && i[r - 1] === "\\" && (r += 1, a = !0);
  let o = e - r;
  if (o < 2) return !1;
  let l = r > 0 ? i[r - 1] : "", c = a ? "\\" : l, d = e < i.length ? i[e] : "";
  return _t(c) && _t(d) || H_(i, r, c, d, n) || le(s, r) || bi(s, r) || ql(s, r) ? !1 : Math.floor(o / 2) % 2 === 1;
}, xa = (s) => {
  let t = ht(s), e = s.length, n = { lineEnd: -1, result: !1 }, i = !1, r = 0;
  for (; r < e; ) {
    if (s[r] !== "_" || t.regions[r] !== K.PROSE) {
      r += 1;
      continue;
    }
    let a = r, o = r + 1;
    for (; o < e && s[o] === "_" && t.regions[o] === K.PROSE; ) o += 1;
    r = o, B_(t, a, o, n) && (i = !i);
  }
  return i;
}, q_ = (s, t, e) => {
  if (!t || Xt.test(t)) return !0;
  let n = s.substring(0, e).lastIndexOf(`
`), i = n === -1 ? 0 : n + 1, r = s.substring(i, e);
  return Fl.test(r) && t.includes(`
`) ? !0 : Pn(s, e, "*");
}, F_ = (s) => {
  let t = $t(s, y_);
  if (!t) return s;
  let e = t[2], n = s.lastIndexOf(t[1]);
  return rt(s, n) || Ot(s, n) || q_(s, e, n) ? s : vi(s) % 2 === 1 ? e.endsWith("*") ? `${s}*` : `${s}**` : s;
}, U_ = (s, t, e) => {
  if (!t || Xt.test(t)) return !0;
  let n = s.substring(0, e).lastIndexOf(`
`), i = n === -1 ? 0 : n + 1, r = s.substring(i, e);
  return Fl.test(r) && t.includes(`
`) ? !0 : Pn(s, e, "_");
}, W_ = (s) => {
  let t = $t(s, w_);
  if (!t) {
    let i = $t(s, C_);
    if (i) {
      let r = s.lastIndexOf(i[1]);
      if (!(rt(s, r) || Ot(s, r)) && xa(s)) return `${s}_`;
    }
    return s;
  }
  let e = t[2], n = s.lastIndexOf(t[1]);
  return rt(s, n) || Ot(s, n) || U_(s, e, n) ? s : xa(s) ? `${s}__` : s;
}, z_ = (s, t) => {
  let { text: e } = s;
  return e[t] === "*" && s.regions[t] === K.PROSE && e[t - 1] !== "*" && e[t + 1] !== "*" && e[t - 1] !== "\\" && !le(s, t);
}, G_ = (s) => {
  let t = ht(s);
  for (let e = s.indexOf("*"); e !== -1; e = s.indexOf("*", e + 1)) {
    if (!z_(t, e)) continue;
    let n = e > 0 ? s[e - 1] : "", i = e < s.length - 1 ? s[e + 1] : "", r = !n || En(n), a = !i || En(i);
    if (!(r && a) && !(n && i && _t(n) && _t(i)) && !a) return e;
  }
  return -1;
}, j_ = (s) => {
  if (!$t(s, k_)) return s;
  let t = G_(s);
  if (t === -1 || rt(s, t) || Ot(s, t)) return s;
  let e = s.substring(t + 1);
  return !e || Xt.test(e) ? s : Wl(s) % 2 === 1 ? `${s}*` : s;
}, zl = (s) => {
  let t = ht(s);
  for (let e = s.indexOf("_"); e !== -1; e = s.indexOf("_", e + 1)) if (t.regions[e] === K.PROSE && s[e - 1] !== "_" && s[e + 1] !== "_" && s[e - 1] !== "\\" && !le(t, e) && !bi(t, e)) {
    let n = e > 0 ? s[e - 1] : "", i = e < s.length - 1 ? s[e + 1] : "";
    if (n && i && _t(n) && _t(i)) continue;
    return e;
  }
  return -1;
}, K_ = (s) => {
  let t = s.length;
  for (; t > 0 && s[t - 1] === `
`; ) t -= 1;
  if (t < s.length) {
    let e = s.slice(0, t), n = s.slice(t);
    return `${e}_${n}`;
  }
  return `${s}_`;
}, V_ = (s) => {
  if (!s.endsWith("**")) return null;
  let t = s.slice(0, -2);
  if (vi(t) % 2 !== 1) return null;
  let e = t.indexOf("**"), n = zl(t);
  return e !== -1 && n !== -1 && e < n ? `${t}_**` : null;
}, X_ = (s) => {
  if (!$t(s, A_)) return s;
  let t = zl(s);
  if (t === -1) return s;
  let e = s.substring(t + 1);
  if (!e || Xt.test(e) || rt(s, t) || Ot(s, t)) return s;
  if (P_(s) % 2 === 1) {
    let n = V_(s);
    return n !== null ? n : K_(s);
  }
  return s;
}, Y_ = (s) => {
  let t = vi(s), e = Wl(s);
  return t % 2 === 0 && e % 2 === 0;
}, Q_ = (s, t, e) => !t || Xt.test(t) || rt(s, e) || Ot(s, e) ? !0 : Pn(s, e, "*"), Z_ = (s) => {
  if (I_.test(s)) return s;
  let t = $t(s, S_);
  if (!t) return s;
  let e = t[2], n = s.lastIndexOf(t[1]);
  return Q_(s, e, n) ? s : D_(s) % 2 === 1 ? Y_(s) ? s : `${s}***` : s;
}, J_ = /<[a-zA-Z/][^>]*$/, tm = /[a-zA-Z/]/, em = (s) => s.includes("$") || s.includes("\\(") || s.includes("\\["), nm = (s, t) => {
  let e = s[t + 1];
  return e !== void 0 && tm.test(e);
}, sm = (s) => {
  let t = s.match(J_);
  if (!t || t.index === void 0) return s;
  let e = em(s);
  for (let n = t.index; n < s.length; n += 1) if (!(s[n] !== "<" || !nm(s, n)) && !rt(s, n) && !(e && M_(s, n))) return s.substring(0, n).trimEnd();
  return s;
}, im = (s) => {
  let t = ht(s);
  if (t.openFence) return s;
  let e = t.openSpan;
  if (!e) return s;
  let n = s.slice(e.start + e.runLength);
  if (!n || Xt.test(n)) return s;
  let i = 0, r = s.length - 1;
  for (; r >= 0 && s[r] === "`"; ) i += 1, r -= 1;
  return i >= e.runLength ? s : s + "`".repeat(e.runLength - i);
}, rm = (s) => _i(s, "$"), am = (s) => {
  let t = ht(s), e = 0;
  for (let n = 0; n < s.length; n += 1) {
    if (s[n] === "\\") {
      n += 1;
      continue;
    }
    t.regions[n] === K.PROSE && s[n] === "$" && (n + 1 < s.length && s[n + 1] === "$" ? n += 1 : e += 1);
  }
  return e;
}, om = (s) => {
  if (s.endsWith("$") && !s.endsWith("$$")) return `${s}$`;
  let t = s.indexOf("$$");
  return t !== -1 && s.indexOf(`
`, t) !== -1 && !s.endsWith(`
`) ? `${s}
$$` : `${s}$$`;
}, lm = (s) => rm(s) % 2 === 0 ? s : om(s), cm = (s) => am(s) % 2 === 1 ? `${s}$` : s, Cn = "streamdown:incomplete-image", dm = (s, t, e) => {
  if (s.substring(t + 2).includes(")")) return null;
  let n = R_(s, t);
  if (n === -1 || rt(s, n)) return null;
  let i = n > 0 && s[n - 1] === "!", r = i ? n - 1 : n, a = s.substring(0, r), o = s.substring(n + 1, t);
  return i ? `${a}![${o}](${Cn})` : e === "text-only" ? `${a}${o}` : `${a}[${o}](streamdown:incomplete-link)`;
}, Ta = (s, t) => {
  for (let e = 0; e < t; e++) if (s[e] === "[" && !rt(s, e)) {
    if (e > 0 && s[e - 1] === "!") continue;
    let n = Ul(s, e);
    if (n === -1) return e;
    if (n + 1 < s.length && s[n + 1] === "(") {
      let i = s.indexOf(")", n + 2);
      i !== -1 && (e = i);
    }
  }
  return t;
}, um = (s, t, e) => {
  let n = t > 0 && s[t - 1] === "!", i = n ? t - 1 : t;
  if (!s.substring(t + 1).includes("]")) {
    let r = s.substring(0, i);
    if (n) {
      let a = s.substring(t + 1);
      return `${r}![${a}](${Cn})`;
    }
    if (e === "text-only") {
      let a = Ta(s, t);
      return s.substring(0, a) + s.substring(a + 1);
    }
    return `${s}](streamdown:incomplete-link)`;
  }
  if (Ul(s, t) === -1) {
    let r = s.substring(0, i);
    if (n) {
      let a = s.substring(t + 1);
      return `${r}![${a}](${Cn})`;
    }
    if (e === "text-only") {
      let a = Ta(s, t);
      return s.substring(0, a) + s.substring(a + 1);
    }
    return `${s}](streamdown:incomplete-link)`;
  }
  return null;
}, hm = (s, t) => {
  let e = s.lastIndexOf("](");
  if (e !== -1 && !rt(s, e)) {
    let n = dm(s, e, t);
    if (n !== null) return n;
  }
  for (let n = s.lastIndexOf("["); n !== -1; n = n === 0 ? -1 : s.lastIndexOf("[", n - 1)) if (!rt(s, n)) {
    let i = um(s, n, t);
    if (i !== null) return i;
  }
  return s;
}, pm = 32, Gl = (s, t = "protocol") => {
  let e = s;
  for (let n = 0; n < pm; n += 1) {
    let i = hm(e, t);
    if (i.length >= e.length) return i;
    e = i;
  }
  return e;
}, fm = /^-{1,2}$/, gm = /^[\s]*-{1,2}[\s]+$/, _m = /^={1,2}$/, mm = /^[\s]*={1,2}[\s]+$/, bm = (s) => {
  if (!s || typeof s != "string") return s;
  let t = s.lastIndexOf(`
`);
  if (t === -1) return s;
  let e = s.substring(t + 1), n = s.substring(0, t), i = e.trim();
  if (fm.test(i) && !e.match(gm)) {
    let r = n.split(`
`).at(-1);
    if (r && r.trim().length > 0) return `${s}​`;
  }
  if (_m.test(i) && !e.match(mm)) {
    let r = n.split(`
`).at(-1);
    if (r && r.trim().length > 0) return `${s}​`;
  }
  return s;
}, vm = /([\p{L}\p{N}_])~(?!~)(?=[\p{L}\p{N}_])/gu, ym = (s) => !s || typeof s != "string" || !s.includes("~") ? s : s.replace(vm, (t, e, n) => {
  let i = n + e.length;
  return rt(s, i) ? t : `${e}\\~`;
}), Ia = (s) => _i(s, "~"), wm = (s) => {
  let t = $t(s, E_);
  if (t) {
    let e = t[2];
    if (!e || Xt.test(e)) return s;
    let n = s.lastIndexOf(t[1]);
    if (rt(s, n) || Ot(s, n)) return s;
    if (Ia(s) % 2 === 1) return `${s}~~`;
  } else {
    let e = $t(s, x_);
    if (e) {
      let n = s.lastIndexOf(e[0].slice(0, 2));
      if (rt(s, n) || Ot(s, n)) return s;
      if (Ia(s) % 2 === 1) return `${s}~`;
    }
  }
  return s;
}, ds = (s) => s !== !1, Sm = (s) => s === !0, it = { SINGLE_TILDE: 0, COMPARISON_OPERATORS: 5, HTML_TAGS: 10, SETEXT_HEADINGS: 15, LINKS: 20, BOLD_ITALIC: 30, BOLD: 35, ITALIC_DOUBLE_UNDERSCORE: 40, ITALIC_SINGLE_ASTERISK: 41, ITALIC_SINGLE_UNDERSCORE: 42, INLINE_CODE: 50, STRIKETHROUGH: 60, KATEX: 70, INLINE_KATEX: 75, DEFAULT: 100 }, km = [{ handler: { name: "singleTilde", handle: ym, priority: it.SINGLE_TILDE }, optionKey: "singleTilde" }, { handler: { name: "comparisonOperators", handle: v_, priority: it.COMPARISON_OPERATORS }, optionKey: "comparisonOperators" }, { handler: { name: "htmlTags", handle: sm, priority: it.HTML_TAGS }, optionKey: "htmlTags" }, { handler: { name: "setextHeadings", handle: bm, priority: it.SETEXT_HEADINGS }, optionKey: "setextHeadings" }, { handler: { name: "links", handle: Gl, priority: it.LINKS }, optionKey: "links", earlyReturn: (s) => s.endsWith("](streamdown:incomplete-link)") || s.endsWith(`](${Cn})`) }, { handler: { name: "boldItalic", handle: Z_, priority: it.BOLD_ITALIC }, optionKey: "boldItalic" }, { handler: { name: "bold", handle: F_, priority: it.BOLD }, optionKey: "bold" }, { handler: { name: "italicDoubleUnderscore", handle: W_, priority: it.ITALIC_DOUBLE_UNDERSCORE }, optionKey: "italic" }, { handler: { name: "italicSingleAsterisk", handle: j_, priority: it.ITALIC_SINGLE_ASTERISK }, optionKey: "italic" }, { handler: { name: "italicSingleUnderscore", handle: X_, priority: it.ITALIC_SINGLE_UNDERSCORE }, optionKey: "italic" }, { handler: { name: "inlineCode", handle: im, priority: it.INLINE_CODE }, optionKey: "inlineCode" }, { handler: { name: "strikethrough", handle: wm, priority: it.STRIKETHROUGH }, optionKey: "strikethrough" }, { handler: { name: "katex", handle: lm, priority: it.KATEX }, optionKey: "katex" }, { handler: { name: "inlineKatex", handle: cm, priority: it.INLINE_KATEX }, optionKey: "inlineKatex" }], Am = (s) => {
  var t;
  let e = (t = s?.linkMode) != null ? t : "protocol";
  return km.filter(({ handler: n, optionKey: i }) => n.name === "links" ? ds(s?.links) || ds(s?.images) : n.name === "inlineKatex" ? Sm(s?.inlineKatex) : ds(s?.[i])).map(({ handler: n, earlyReturn: i }) => n.name === "links" ? { handler: Bl(Hl({}, n), { handle: (r) => Gl(r, e) }), earlyReturn: e === "protocol" ? i : void 0 } : { handler: n, earlyReturn: i });
}, Em = (s, t) => {
  var e;
  if (!s || typeof s != "string") return s;
  let n = s.endsWith(" ") && !s.endsWith("  ") ? s.slice(0, -1) : s, i = Am(t), r = ((e = t?.handlers) != null ? e : []).map((o) => {
    var l;
    return { handler: Bl(Hl({}, o), { priority: (l = o.priority) != null ? l : it.DEFAULT }), earlyReturn: void 0 };
  }), a = [...i, ...r].sort((o, l) => {
    var c, d;
    return ((c = o.handler.priority) != null ? c : 0) - ((d = l.handler.priority) != null ? d : 0);
  });
  try {
    for (let { handler: o, earlyReturn: l } of a) if (n = o.handle(n), l != null && l(n)) return n;
    return n.endsWith(" ") && !n.endsWith("  ") ? n.slice(0, -1) : n;
  } finally {
    a_();
  }
}, Ra = Em;
const Us = (s) => s === void 0 || /\s/.test(s);
function jl(s, t) {
  if (s[t] !== `
`) return !1;
  for (let e = t + 1; e < s.length; e++) {
    if (s[e] === `
`) return !0;
    if (s[e] !== " " && s[e] !== "	") return !1;
  }
  return !1;
}
const Cm = /^ {0,3}(?:~~~|#{1,6}(?:[ \t]|$)|>|<(?:[/!?]|(?:address|article|aside|blockquote|details|dialog|div|dl|fieldset|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|script|section|style|table|textarea|ul)(?=[\s/>]|$))|([-*_])(?:[ \t]*\1){2,}[ \t]*$)/i, xm = /^ {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]/;
function Tm(s, t, e) {
  const n = s.indexOf(`
`, t + 1), i = s.slice(t + 1, n < 0 ? s.length : n);
  return Cm.test(i) || e && xm.test(i);
}
function Kl(s, t, e) {
  const n = s.indexOf(`
`, t), i = /\S/.test(s.slice(t, n < 0 ? s.length : n));
  for (let r = t; r < s.length; r++) {
    if (e !== "" && s.startsWith(e, r)) return { at: r, closed: !0 };
    if (s[r] === "`" || s[r] === `
` && (jl(s, r) || Tm(s, r, i))) return { at: r, closed: !1 };
    s[r] === "\\" && e !== "\\)" && e !== "\\]" && r++;
  }
  return { at: s.length, closed: !1 };
}
function Vl(s) {
  if (s[0] !== "$" || Us(s[1]) || s[1] === "$") return -1;
  let t = 0;
  for (let e = 1; e < s.length; e++) {
    const n = s[e];
    if (n === "\\") {
      e++;
      continue;
    }
    if (n === "`" || jl(s, e)) return -1;
    if (n === "{") {
      t++;
      continue;
    }
    if (n === "}") {
      t = Math.max(0, t - 1);
      continue;
    }
    if (!(n !== "$" || t > 0))
      return Us(s[e - 1]) || /\d/.test(s[e + 1] ?? "") ? -1 : e;
  }
  return -1;
}
function Ws(s, t, e) {
  const { at: n, closed: i } = Kl(s, t, e);
  return i ? n : -1;
}
function xn(s, t, e) {
  return Kl(s, t, e).at;
}
function zs(s, t, e) {
  return s.startsWith("\\") ? /[\p{L}\p{N}]$/u.test(e) || /^\s*[\d.,]*\s*$/.test(t) : !1;
}
const Gs = [
  { open: "$$", close: "$$", display: !0 },
  { open: "\\[", close: "\\]", display: !0 },
  { open: "\\(", close: "\\)", display: !1 }
];
function Xl(s, t) {
  const e = [];
  let n = -1;
  for (let i = 0; i < s.length; ) {
    const r = s[i];
    if (r === "`") {
      const l = /^`+/.exec(s.slice(i))[0], c = s.indexOf(l, i + l.length);
      i = c === -1 ? i + l.length : c + l.length;
      continue;
    }
    let a = -1;
    const o = Gs.find((l) => s.startsWith(l.open, i));
    if (o) {
      const l = i + o.open.length, c = Ws(s, l, o.close);
      c !== -1 ? a = c + o.close.length : t && (a = xn(s, l, o.close));
    } else if (r === "\\") {
      i += 2;
      continue;
    } else if (r === "$") {
      const l = Vl(s.slice(i));
      l !== -1 ? a = i + l + 1 : n < 0 && !Us(s[i + 1]) && s[i + 1] !== "$" && (n = i);
    }
    if (a <= i) {
      i++;
      continue;
    }
    e.push([i, a]), i = a;
  }
  return { spans: e, openDollar: n };
}
function Ma(s) {
  const { spans: t, openDollar: e } = Xl(s, !0);
  if (e >= 0) {
    const a = xn(s, e + 1, "");
    if (!t.some(([o, l]) => o < a && l > e)) {
      for (let o = e; o < a; o++) s[o] === "[" && t.push([o, o + 1]);
      t.sort((o, l) => o[0] - l[0]);
    }
  }
  const n = [];
  let i = "", r = 0;
  for (const [a, o] of t)
    i += s.slice(r, a) + `${n.length}`, n.push(s.slice(a, o)), r = o;
  return i += s.slice(r), {
    masked: i,
    unmask: (a) => a.replace(/\uE000(\d+)\uE001/g, (o, l) => n[Number(l)] ?? "")
  };
}
function La(s, t) {
  const e = t.length - s.length;
  let n = "";
  for (let o = 0; o < s.length; o++) n += t[e + o] === "+" ? s[o] : t[e + o];
  n = n.replace(/\[a+\]/g, (o) => `\`${"a".repeat(o.length - 2)}\``);
  const i = Xl(n, !1).spans.filter(([o, l]) => !zs(n.slice(o, o + 2), n.slice(o + 2, l - 2), n.slice(0, o)));
  let r = t.slice(0, e), a = 0;
  for (const [o, l] of i)
    r += t.slice(e + a, e + o) + "a".repeat(l - o), a = l;
  return r + t.slice(e + a);
}
const Im = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function Oa(s, t) {
  const e = s.open ? " data-aparte-open" : "", i = `<code class="language-math ${s.display ? "math-display" : "math-inline"}"${e}>${Im(s.text)}</code>`;
  return t ? `<pre${e}>${i}</pre>
` : i;
}
function $a(s = {}) {
  const t = s.live === !0;
  return {
    // marked looks ahead for the `*`, `_` or `~` closing an emphasis or a strikethrough
    // on a masked copy of the text; a formula left in it closes an italic opened before
    // it (`*the optimum $x^*$*`). Its `emStrongMask` hook cannot hide one: it receives a
    // copy where `\(` is already `++`, so the formulas are found on the real text here.
    // marked's own tokenizer is reached through the instance's prototype, not imported:
    // this module is the chunk both entries share, and it imports nothing from marked.
    tokenizer: {
      emStrong(e, n, i) {
        return Object.getPrototypeOf(this).emStrong.call(this, e, La(e, n), i);
      },
      del(e, n, i) {
        return Object.getPrototypeOf(this).del.call(this, e, La(e, n), i);
      }
    },
    extensions: [
      {
        name: "aparteMathBlock",
        level: "block",
        // Where a block may start inside this paragraph. marked hands `start` the
        // source minus its first character, so only a real newline marks a line.
        start(e) {
          const n = e.search(/\n[ \t]*\n/), i = /\n {0,3}(\$\$|\\\[)/.exec(n < 0 ? e : e.slice(0, n));
          return i ? i.index + 1 : void 0;
        },
        tokenizer(e) {
          const n = /^ {0,3}(\$\$|\\\[)/.exec(e);
          if (!n) return;
          const i = Gs.find((d) => d.open === n[1]), r = n[0].length, a = Ws(e, r, i.close);
          if (a === -1)
            return !t || xn(e, r, i.close) < e.length ? void 0 : { type: "aparteMathBlock", raw: e, text: e.slice(r).trim(), display: !0, open: !0 };
          const o = e.slice(r, a).trim();
          if (zs(i.open, o, "")) return;
          const l = /^[ \t]*(\n|$)/.exec(e.slice(a + i.close.length));
          return l ? { type: "aparteMathBlock", raw: e.slice(0, a + i.close.length + l[0].length), text: o, display: !0, open: !1 } : void 0;
        },
        renderer: (e) => Oa(e, !0)
      },
      {
        name: "aparteMathInline",
        level: "inline",
        start(e) {
          const n = e.search(/\$|\\[([]/);
          return n === -1 ? void 0 : n;
        },
        tokenizer(e, n) {
          for (const r of Gs) {
            if (!e.startsWith(r.open)) continue;
            const a = Ws(e, r.open.length, r.close);
            if (a === -1)
              return !t || r.open !== "$$" && /[\p{L}\p{N}]$/u.test(n.at(-1)?.raw ?? "") || xn(e, r.open.length, r.close) < e.length ? void 0 : { type: "aparteMathInline", raw: e, text: e.slice(r.open.length), display: r.display, open: !0 };
            const o = e.slice(r.open.length, a);
            return zs(r.open, o, n.at(-1)?.raw ?? "") ? void 0 : { type: "aparteMathInline", raw: e.slice(0, a + r.close.length), text: o, display: r.display, open: !1 };
          }
          const i = Vl(e);
          if (i !== -1)
            return { type: "aparteMathInline", raw: e.slice(0, i + 1), text: e.slice(1, i), display: !1, open: !1 };
        },
        renderer: (e) => Oa(e, !1)
      }
    ]
  };
}
const Na = "streamdown:", Rm = /(^|[ \t])[*_~`]+$/;
function Mm(s, t) {
  const e = s.replace(Rm, "$1");
  if (!t) return Ra(e);
  let { masked: n, unmask: i } = Ma(e);
  return /$/.test(n) && /[\s\\]$/.test(e) && ({ masked: n, unmask: i } = Ma(e.replace(/[\s\\]+$/, ""))), i(Ra(n, { katex: !1 }));
}
function Lm(s, t, e) {
  const n = document.createElement("template");
  if (n.innerHTML = s, t) {
    for (const i of n.content.querySelectorAll(`a[href^="${Na}"]`)) i.removeAttribute("href");
    for (const i of n.content.querySelectorAll(`img[src^="${Na}"]`)) i.remove();
  }
  return n.innerHTML = e.sanitizeHtml(n.innerHTML), Array.from(n.content.childNodes);
}
function Om(s, t, e) {
  let n = "", i = [];
  const r = (a) => {
    const o = (a ? t.arriving : t.finished).lexer(n);
    let l = 0;
    for (; l < o.length && l < i.length; ) {
      const d = a && l === o.length - 1, u = i[l];
      if (u.raw !== o[l].raw || u.healed !== d) break;
      l++;
    }
    for (const d of i.slice(l)) for (const u of d.nodes) u.remove();
    const c = i.slice(0, l);
    for (let d = l; d < o.length; d++) {
      const u = o[d].raw, h = a && d === o.length - 1, p = h ? t.arriving.parse(Mm(u, t.math), { async: !1 }) : t.finished.parse(u, { async: !1 }), f = Lm(p, h, e);
      s.append(...f), c.push({ raw: u, healed: h, nodes: f });
    }
    i = c;
  };
  return {
    write(a) {
      n += a, r(!0);
    },
    end() {
      r(!1);
    }
  };
}
function $m(s, t = lt) {
  const { math: e, ...n } = {}, i = W;
  let r, a;
  const o = () => e ?? t.hasCodeLanguageRenderer("math"), l = () => r ??= new qs(n, $a()), c = () => a ??= new qs(n, $a({ live: !0 }));
  t.setMarkdownProvider((d) => (o() ? l() : i).parse(d, { async: !1 })), t.setStreamingMarkdownProvider((d) => {
    const u = o();
    return Om(d, u ? { finished: l(), arriving: c(), math: !0 } : { finished: i, arriving: i, math: !1 }, t);
  });
}
class Nm {
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
    const e = this.read(), n = e.findIndex((i) => i.id === t.id);
    n >= 0 ? e[n] = t : e.push(t), this.write(e);
  }
  async delete(t) {
    this.write(this.read().filter((e) => e.id !== t));
  }
}
function Pm(s, t) {
  if (typeof s?.body != "string") return s;
  const e = JSON.parse(s.body);
  if (!Array.isArray(e.resume)) return s;
  for (const n of e.resume) {
    const i = t[n.interruptId]?.instruction;
    i && (n.payload = { ...n.payload, instruction: i });
  }
  return { ...s, body: JSON.stringify(e) };
}
function Dm(s, t) {
  const e = s.querySelector("[data-aparte-empty-state]");
  if (!e) return;
  const n = new MutationObserver(() => i());
  function i() {
    t.getMessages().length !== 0 && (e.hidden = !0, n.disconnect());
  }
  n.observe(t, { childList: !0, subtree: !0 }), i();
}
let Pa = !1;
function Hm() {
  if (Pa) return;
  Pa = !0;
  const s = document.documentElement, t = () => {
    s.dataset.aparteTheme = s.classList.contains("dark") ? "dark" : "light";
  };
  new MutationObserver(t).observe(s, { attributes: !0, attributeFilter: ["class"] }), t();
}
const yi = [], Yl = [];
function jm(s) {
  Yl.push(s);
  for (const t of yi) t.stops.push(Ql(s, t.config, t.chat));
}
function Ql(s, t, e) {
  try {
    return s(t, e);
  } catch (n) {
    console.error("aparté: a function given to onAparteSetup failed.", n);
    return;
  }
}
async function Bm(s) {
  s.dataset.aparteMounted = "";
  const { aparteEndpoint: t, aparteCsrf: e, aparteThread: n, aparteScope: i } = s.dataset, r = new Cs();
  ad(s, r), $m(void 0, r);
  const a = Yl.map((f) => Ql(f, r, s)), o = new Ch(new Nm(`aparte-laravel:${t}:${i ?? ""}:${s.id}`));
  await o.init(), r.setConversationManager(o);
  const l = s.viewport, c = new Ih({
    hostId: s.id,
    host: s,
    getMessages: () => l.getMessages(),
    setMessages: (f) => l.setMessages(f),
    appendMessage: (f) => l.appendMessage(f),
    clearMessages: (f) => l.clearAll(f),
    setLoading: (f) => l.setLoading(f),
    exportTree: () => l.exportTree(),
    importTree: (f) => l.importTree(f)
  });
  c.bind();
  const d = J();
  let u = {};
  const h = Pf({
    endpoint: t,
    threadId: () => n || o.activeId || d,
    headers: { "X-CSRF-TOKEN": e ?? "" },
    fetch: (f, _) => fetch(f, Pm(_, u))
  }), p = new ip({
    config: r,
    scopeToTargetId: s.id,
    streamRunner: (f) => (u = f.deferral?.outcomes ?? {}, h(f))
  });
  p.start(), yi.push({ client: p, controller: c, config: r, chat: s, stops: a }), await c.setConversationId(o.activeConversations[0]?.id ?? null), Dm(s, l);
}
function us() {
  const s = document.querySelectorAll("aparte-chat[data-aparte-endpoint]:not([data-aparte-mounted])");
  s.length !== 0 && ([...s].some((t) => "aparteFollowDark" in t.dataset) && Hm(), customElements.whenDefined("aparte-chat").then(() => s.forEach(Bm)));
}
function qm() {
  for (const { client: s, controller: t, stops: e, chat: n } of yi.splice(0)) {
    delete n.dataset.aparteMounted;
    try {
      for (const i of e) typeof i == "function" && i();
      t.unbind(), s.stop();
    } catch (i) {
      console.error("aparté: a chat did not stop cleanly.", i);
    }
  }
}
globalThis.__aparteLaravel ? console.warn("aparté for Laravel is loaded twice on this page; the second copy does nothing. If your app imports it, set APARTE_ASSETS=vite so that the package stops serving its own.") : (globalThis.__aparteLaravel = !0, document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", us, { once: !0 }) : setTimeout(us), document.addEventListener("livewire:navigating", qm), document.addEventListener("livewire:navigated", us));
export {
  jm as onAparteSetup
};
