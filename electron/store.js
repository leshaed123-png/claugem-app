// Хранилище: настройки, память и навыки лежат в ~/Library/Application Support/Claugem
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const PROVIDERS = {
  pollinations: { label: 'Pollinations (без ключа и регистрации)', baseUrl: 'https://text.pollinations.ai/openai', model: 'openai', needsKey: false, native: false, keyUrl: 'https://pollinations.ai' },
  gemini:     { label: 'Google Gemini (бесплатный тариф)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', needsKey: true,  keyUrl: 'https://aistudio.google.com/apikey' },
  groq:       { label: 'Groq (бесплатный тариф)',          baseUrl: 'https://api.groq.com/openai/v1',                         model: 'llama-3.3-70b-versatile', needsKey: true, keyUrl: 'https://console.groq.com/keys' },
  openrouter: { label: 'OpenRouter — бесплатные DeepSeek и др.',   baseUrl: 'https://openrouter.ai/api/v1',                           model: 'deepseek/deepseek-v4-flash-0731:free', needsKey: true, keyUrl: 'https://openrouter.ai/keys' },
  ollama:     { label: 'Ollama (локально, без лимитов)',   baseUrl: 'http://localhost:11434/v1',                              model: 'qwen2.5-coder:7b', needsKey: false, keyUrl: 'https://ollama.com/download' },
  anthropic:  { label: 'Claude (платный API)',             baseUrl: 'https://api.anthropic.com/v1',                           model: 'claude-sonnet-5-5', needsKey: true, keyUrl: 'https://console.anthropic.com/settings/keys' }
};

const DEFAULTS = {
  provider: 'pollinations',
  models: {},          // переопределение модели по провайдеру
  keys: {},            // зашифрованные ключи (base64)
  workspace: '',
  autoApprove: false   // выполнять команды без подтверждения
};

const dir = () => app.getPath('userData');
const settingsFile = () => path.join(dir(), 'settings.json');
// Встроенные навыки копируются в папку пользователя при первом обращении (свои файлы не затираются)
let seeded = false;
const skillsDir = () => {
  const d = path.join(dir(), 'skills');
  fs.mkdirSync(d, { recursive: true });
  if (!seeded) {
    seeded = true;
    const bundled = path.join(__dirname, '..', 'skills');
    try { for (const f of fs.readdirSync(bundled)) if (!fs.existsSync(path.join(d, f))) fs.copyFileSync(path.join(bundled, f), path.join(d, f)); } catch {}
  }
  return d;
};
const memoryFile = () => path.join(dir(), 'memory.md');

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}
function saveSettings(s) {
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2));
}
function encrypt(v) {
  if (!v) return '';
  return safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(v).toString('base64') : 'raw:' + v;
}
function decrypt(v) {
  if (!v) return '';
  if (v.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'));
  return v.replace(/^raw:/, '');
}

// Публичный вид настроек для интерфейса (ключи не отдаём)
function publicSettings() {
  const s = loadSettings();
  return {
    provider: s.provider, workspace: s.workspace || defaultWorkspace(), autoApprove: s.autoApprove,
    models: s.models, hasKey: Object.fromEntries(Object.keys(PROVIDERS).map(k => [k, !!s.keys[k]])),
    providers: PROVIDERS
  };
}
function updateSettings(patch) {
  const s = loadSettings();
  if (patch.provider) s.provider = patch.provider;
  if (typeof patch.workspace === 'string') s.workspace = patch.workspace;
  if (typeof patch.autoApprove === 'boolean') s.autoApprove = patch.autoApprove;
  if (patch.models) s.models = { ...s.models, ...patch.models };
  if (patch.keys) for (const [k, v] of Object.entries(patch.keys)) if (v) s.keys[k] = encrypt(v);
  saveSettings(s);
  return publicSettings();
}
function defaultWorkspace() {
  const d = path.join(app.getPath('documents'), 'Claugem');
  fs.mkdirSync(d, { recursive: true });
  return d;
}
const mk = (id, model, apiKey) => ({ id, baseUrl: PROVIDERS[id].baseUrl, model, apiKey, needsKey: PROVIDERS[id].needsKey, native: PROVIDERS[id].native !== false });
function activeConfig() {
  const s = loadSettings();
  const base = mk(s.provider, s.models[s.provider] || PROVIDERS[s.provider].model, decrypt(s.keys[s.provider]));
  return { ...base, workspace: s.workspace || defaultWorkspace(), autoApprove: s.autoApprove };
}

// ---- Память и навыки (то, как агент «учится») ----
const readMemory = () => { try { return fs.readFileSync(memoryFile(), 'utf8'); } catch { return ''; } };
const appendMemory = (note) => fs.appendFileSync(memoryFile(), `- ${note.replace(/\n/g, ' ')}\n`);
const safeName = (n) => String(n).toLowerCase().replace(/[^a-z0-9а-яё_-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'skill';

function listSkills() {
  return fs.readdirSync(skillsDir()).filter(f => f.endsWith('.md')).map(f => {
    const txt = fs.readFileSync(path.join(skillsDir(), f), 'utf8');
    const m = txt.match(/^description:\s*(.*)$/m);
    return { name: f.replace(/\.md$/, ''), description: m ? m[1] : '' };
  });
}
function readSkill(name) { return fs.readFileSync(path.join(skillsDir(), safeName(name) + '.md'), 'utf8'); }
function writeSkill(name, description, content) {
  const n = safeName(name);
  fs.writeFileSync(path.join(skillsDir(), n + '.md'), `---\nname: ${n}\ndescription: ${description.replace(/\n/g, ' ')}\n---\n\n${content}\n`);
  return n;
}

// ---- Бесплатные модели OpenRouter (список обновляется сам) ----
let freeCache = [];
async function fetchFreeModels() {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error('OpenRouter models: ' + res.status);
  const { data } = await res.json();
  freeCache = data
    .filter(m => Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0 && (m.supported_parameters || []).includes('tools') && !/^openrouter\//.test(m.id))
    .sort((a, b) => (/deepseek/.test(b.id) - /deepseek/.test(a.id)) || ((b.context_length || 0) - (a.context_length || 0)))
    .map(m => ({ id: m.id, name: m.name, context: m.context_length }));
  return freeCache;
}

// ---- Pollinations: список моделей без ключа ----
let pollCache = [];
async function fetchPollinationsModels() {
  if (pollCache.length) return pollCache;
  try {
    const res = await fetch('https://text.pollinations.ai/models');
    const data = await res.json();
    pollCache = (Array.isArray(data) ? data : []).map(m => ({ id: m.name || m.id, label: m.description || m.name || m.id }))
      .filter(m => m.id && !/audio|vision|image/i.test(m.id))
      .sort((a, b) => (/deepseek/i.test(b.id) - /deepseek/i.test(a.id)));
  } catch {}
  if (!pollCache.length) pollCache = [{ id: 'openai', label: 'GPT-класс' }, { id: 'deepseek', label: 'DeepSeek' }];
  return pollCache;
}

// Готовый список для выбора в один клик
async function listModels() {
  const s = loadSettings();
  const out = [];
  for (const m of await fetchPollinationsModels()) out.push({ provider: 'pollinations', model: m.id, label: m.label, group: 'Без ключа · работает сразу', needsKey: false });
  const fr = freeCache.length ? freeCache : await fetchFreeModels().catch(() => []);
  for (const m of fr.slice(0, 40)) out.push({ provider: 'openrouter', model: m.id, label: m.name, group: 'OpenRouter · бесплатные (нужен бесплатный ключ)', needsKey: true });
  for (const m of ['llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'deepseek-r1-distill-llama-70b']) out.push({ provider: 'groq', model: m, label: m, group: 'Groq · бесплатно (нужен бесплатный ключ)', needsKey: true });
  out.push({ provider: 'gemini', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', group: 'Google · бесплатно (нужен бесплатный ключ)', needsKey: true });
  return out.map(o => ({ ...o, locked: o.needsKey && !s.keys[o.provider] }));
}

// Цепочка запасных вариантов: упёрлись в лимит — берём следующий бесплатный
async function fallbackChain(primary) {
  const s = loadSettings();
  const chain = [primary];
  const seen = new Set([primary.id + primary.model]);
  const add = (c) => { const k = c.id + c.model; if (!seen.has(k)) { seen.add(k); chain.push(c); } };
  const orKey = decrypt(s.keys.openrouter);
  if (orKey) {
    if (!freeCache.length) { try { await fetchFreeModels(); } catch {} }
    for (const m of freeCache.slice(0, 8)) add(mk('openrouter', m.id, orKey));
  }
  for (const id of ['gemini', 'groq']) { const k = decrypt(s.keys[id]); if (k) add(mk(id, s.models[id] || PROVIDERS[id].model, k)); }
  for (const m of (await fetchPollinationsModels()).slice(0, 4)) add(mk('pollinations', m.id, ''));
  return chain;
}

module.exports = { fetchFreeModels, fallbackChain, listModels, PROVIDERS, publicSettings, updateSettings, activeConfig, readMemory, appendMemory, listSkills, readSkill, writeSkill, skillsDir };
