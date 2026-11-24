// データ層。画面側は Store だけを触り、保存先（端末内 / Supabase）は意識しない。
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const LOCAL_KEY = "future-lab-v3";
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

export const uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const now = () => new Date().toISOString();

/* ---------- 端末内に保存 ---------- */
class LocalAdapter {
  name = "local";
  async load() {
    try { return JSON.parse(ls.get(LOCAL_KEY) || "[]"); } catch { return []; }
  }
  async saveAll(records) { return ls.set(LOCAL_KEY, JSON.stringify(records)); }
}

/* ---------- Supabase に保存（同期） ---------- */
class SupabaseAdapter {
  name = "cloud";
  constructor(createClient) {
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  async session() { const { data } = await this.sb.auth.getSession(); return data.session; }
  async sendCode(email) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } });
    if (error) throw error;
  }
  async verifyCode(email, token) {
    const { error } = await this.sb.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
  }
  async signOut() { await this.sb.auth.signOut(); }
  async load() {
    const out = []; let from = 0;
    for (;;) {
      const { data, error } = await this.sb.from("records").select("id,kind,data,deleted,updated_at").range(from, from + 999);
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    return out.filter(r => !r.deleted).map(r => ({ id: r.id, kind: r.kind, data: r.data, updated_at: r.updated_at }));
  }
  async save(rec) {
    const { error } = await this.sb.from("records").upsert({ id: rec.id, kind: rec.kind, data: rec.data, deleted: false, updated_at: rec.updated_at }, { onConflict: "user_id,id" });
    if (error) throw error;
  }
  async remove(id) {
    const { error } = await this.sb.from("records").update({ deleted: true, updated_at: now() }).eq("id", id);
    if (error) throw error;
  }
  listen(onRow) {
    this.channel = this.sb.channel("records-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "records" }, p => onRow(p.new && p.new.id ? p.new : null))
      .subscribe();
  }
}

/* ---------- Store ---------- */
export const Store = {
  records: new Map(),
  adapter: null,
  status: "loading",
  listeners: new Set(),
  cloudReady: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(msg) { this.listeners.forEach(fn => fn(msg)); },

  async init() {
    if (this.cloudReady) {
      const { createClient } = await import("../vendor/supabase-js-2.119.0.mjs");
      this.adapter = new SupabaseAdapter(createClient);
      const s = await this.adapter.session();
      if (!s) { this.status = "signed-out"; return; }
      await this.loadCloud();
    } else {
      this.adapter = new LocalAdapter();
      (await this.adapter.load()).forEach(r => this.records.set(r.id, r));
      this.status = "ready";
    }
  },

  async loadCloud() {
    const rows = await this.adapter.load();
    // はじめてログインした端末に、前から端末内にあったデータがあれば引っ越す
    const local = await new LocalAdapter().load();
    if (!rows.length && local.length) {
      for (const r of local) await this.adapter.save(r);
      rows.push(...local);
    }
    this.records = new Map(rows.map(r => [r.id, r]));
    this.status = "ready";
    this.adapter.listen(row => {
      if (!row) return;
      const mine = this.records.get(row.id);
      if (row.deleted) { if (mine) { this.records.delete(row.id); this.emit("remote"); } return; }
      if (mine && mine.updated_at >= row.updated_at) return;
      this.records.set(row.id, { id: row.id, kind: row.kind, data: row.data, updated_at: row.updated_at });
      this.emit("remote");
    });
  },

  list(kind) { return [...this.records.values()].filter(r => r.kind === kind); },
  get(id) { return this.records.get(id) || null; },

  async put(kind, id, data) {
    const rec = { id, kind, data, updated_at: now() };
    this.records.set(id, rec);
    this.emit("local");
    return this.persist(rec);
  },
  async remove(id) {
    this.records.delete(id);
    this.emit("local");
    return this.persist(null, id);
  },
  async persist(rec, removedId) {
    try {
      if (this.adapter.name === "local") {
        if (!(await this.adapter.saveAll([...this.records.values()]))) throw new Error("この端末に保存できませんでした（プライベートブラウズでは保存されません）");
      } else if (rec) await this.adapter.save(rec);
      else await this.adapter.remove(removedId);
      this.emit("saved");
      return true;
    } catch (e) {
      this.emit({ error: e.message || String(e) });
      return false;
    }
  },

  exportAll() { return JSON.stringify({ app: "future-lab", version: 3, records: [...this.records.values()] }, null, 1); },
  async importAll(text) {
    const j = JSON.parse(text);
    if (!Array.isArray(j.records)) throw new Error("形式が違います");
    for (const r of j.records) {
      if (!r || !r.id || !["type", "item", "setting"].includes(r.kind)) continue;
      this.records.set(r.id, r);
      if (this.adapter.name !== "local") await this.adapter.save(r);
    }
    if (this.adapter.name === "local") await this.adapter.saveAll([...this.records.values()]);
    this.emit("local");
  },
};
