/*
 * Salesforce access from the plugin goes through App Builder web actions
 * (browser → Runtime → Salesforce). Runtime holds the Connected App secrets.
 */

function trimSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function actionUrl(base, name) {
  const root = trimSlash(base);
  if (!root) throw new Error('Set the App Builder URL in Settings.');
  // Accept either the package base or a full action URL.
  if (/\/(entities|describe|submit)\/?$/.test(root)) {
    return root.replace(/\/(entities|describe|submit)\/?$/, `/${name}`);
  }
  return `${root}/${name}`;
}

async function callAction(settings, name, body = {}, { signal } = {}) {
  const url = actionUrl(settings.appBuilderUrl, name);
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  let payload = null;
  const text = await resp.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text };
  }
  if (!resp.ok) {
    const message = payload?.error
      || payload?.message
      || `App Builder ${name} failed (${resp.status}).`;
    throw new Error(message);
  }
  return payload;
}

/**
 * List createable Salesforce sObjects (entities) via App Builder.
 * @returns {Promise<{ name: string, label: string }[]>}
 */
export async function listEntities(settings, options) {
  const data = await callAction(settings, 'entities', {}, options);
  const entities = data?.entities || data?.sobjects || [];
  return entities
    .map((e) => ({
      name: e.name || e.apiName,
      label: e.label || e.name || e.apiName,
      createable: e.createable !== false,
    }))
    .filter((e) => e.name && e.createable)
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Describe one sObject and return its fields.
 * @returns {Promise<{ name: string, label: string, fields: object[] }>}
 */
export async function describeEntity(settings, entityName, options) {
  if (!entityName) throw new Error('Choose a Salesforce entity.');
  const data = await callAction(settings, 'describe', { entity: entityName }, options);
  return {
    name: data?.name || entityName,
    label: data?.label || entityName,
    fields: data?.fields || [],
  };
}

/**
 * Smoke-test App Builder + Salesforce token exchange.
 */
export async function testConnection(settings, options) {
  const entities = await listEntities(settings, options);
  return {
    ok: true,
    count: entities.length,
    sample: entities.slice(0, 5).map((e) => e.name),
  };
}

export function submitActionUrl(settings) {
  return actionUrl(settings.appBuilderUrl, 'submit');
}
