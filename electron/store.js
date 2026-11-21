// Хранилище: настройки, память и навыки лежат в ~/Library/Application Support/Claugem
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const PROVIDERS = {
  gemini:     { label: 'Google Gemini (бесплатный тариф)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', needsKey: true,  keyUrl: 'https://aistudio.google.com/apikey' },
  groq:       { label: 'Groq (бесплатный тариф)',          baseUrl: 'https://api.groq.com/openai/v1',                         model: 'llama-3.3-70b-versatile', needsKey: true, keyUrl: 'https://console.groq.com/keys' },
  openrouter: { label: 'OpenRouter — бесплатные DeepSeek и др.',   baseUrl: 'https://openrouter.ai/api/v1',                           model: 'deepseek/deepseek-v4-flash-0731:free', needsKey: true, keyUrl: 'https://openrouter.ai/keys' },
  ollama:     { label: 'Ollama (локально, без лимитов)',   baseUrl: 'http://localhost:11434/v1',                              model: 'qwen2.5-coder:7b', needsKey: false, keyUrl: 'https://ollama.com/download' },
  anthropic:  { label: 'Claude (платный API)',             baseUrl: 'https://api.anthropic.com/v1',                           model: 'claude-sonnet-5-5', needsKey: true, keyUrl: 'https://console.anthropic.com/settings/keys' }
};

const DEFAULTS = {
  provider: 'gemini',
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
    provider: s.provider, workspace: s.workspace, autoApprove: s.autoApprove,
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
function activeConfig() {
  const s = loadSettings();
  const p = PROVIDERS[s.provider];
  return { id: s.provider, baseUrl: p.baseUrl, model: s.models[s.provider] || p.model, apiKey: decrypt(s.keys[s.provider]), needsKey: p.needsKey, workspace: s.workspace, autoApprove: s.autoApprove };
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

// Цепочка запасных вариантов: если провайдер упёрся в лимит — берём следующий
async function fallbackChain(primary) {
  const s = loadSettings();
  const chain = [primary];
  if (!freeCache.length) { try { await fetchFreeModels(); } catch {} }
  const orKey = decrypt(s.keys.openrouter);
  if (orKey) {
    for (const m of freeCache.slice(0, 8)) {
      if (primary.id === 'openrouter' && m.id === primary.model) continue;
      chain.push({ ...primary, id: 'openrouter', baseUrl: PROVIDERS.openrouter.baseUrl, apiKey: orKey, model: m.id });
    }
  }
  for (const id of ['gemini', 'groq']) {
    const k = decrypt(s.keys[id]);
    if (k && id !== primary.id) chain.push({ ...primary, id, baseUrl: PROVIDERS[id].baseUrl, apiKey: k, model: s.models[id] || PROVIDERS[id].model });
  }
  if (primary.id !== 'ollama') chain.push({ ...primary, id: 'ollama', baseUrl: PROVIDERS.ollama.baseUrl, apiKey: '', model: s.models.ollama || PROVIDERS.ollama.model });
  return chain;
}

module.exports = { fetchFreeModels, fallbackChain, PROVIDERS, publicSettings, updateSettings, activeConfig, readMemory, appendMemory, listSkills, readSkill, writeSkill, skillsDir };
