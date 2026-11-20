// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import {
  KEYS,
  isConfigured,
  loadSettings,
  normaliseInstanceUrl,
  saveSettings,
} from './secrets.js';
import {
  describeEntity,
  listEntities,
  submitActionUrl,
  testConnection,
} from './salesforce.js';
import {
  FIELD_TYPES,
  buildFormBlockHtml,
  formSummary,
  selectableFields,
} from './form-builder.js';

const TYPE_OPTIONS = [...new Set(Object.values(FIELD_TYPES))];

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([name, value]) => {
    if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else if (value === true) node.setAttribute(name, '');
    else if (value !== false && value != null) node.setAttribute(name, value);
  });
  node.append(...children.filter((child) => child != null));
  return node;
}

function field(label, control, hint) {
  return el('label', { class: 'field' }, el('span', { class: 'field-label' }, label), control, hint);
}

function setStatus(node, message = '', type = 'info') {
  node.textContent = message;
  node.dataset.type = type;
  node.hidden = !message;
}

(async function init() {
  const sdk = await DA_SDK;
  const { context, actions } = sdk;
  const { org } = context;
  let { token } = sdk;
  window.addEventListener('message', (e) => {
    if (e.data?.token) token = e.data.token;
  });

  const state = {
    settings: {
      instanceUrl: '',
      clientId: '',
      clientSecret: '',
      oauthAuthorizeUrl: 'https://login.salesforce.com/services/oauth2/authorize',
      tokenUrl: '',
      refreshToken: '',
      scope: 'api chatter_api full id openid refresh_token visualforce web',
      callbackUrl: '',
      oauthState: '',
      apiVersion: 'v59.0',
      objectName: '',
      appBuilderUrl: '',
    },
    entities: [],
    entityFilter: '',
    selectedEntity: null,
    fields: [],
    selected: new Map(), // apiName → { ...field, type, required }
    title: '',
    selection: '',
    result: '',
    resultMeta: null,
    loadFailed: false,
    controller: null,
  };

  /* ---------- Shared UI bits ---------- */

  const notice = el('p', { class: 'notice', hidden: true });
  const status = el('p', { class: 'status', role: 'status', hidden: true });
  const entitySearch = el('input', {
    type: 'search',
    placeholder: 'Filter entities…',
    autocomplete: 'off',
  });
  const entityList = el('ul', { class: 'entity-list' });
  const loadEntitiesBtn = el('button', { type: 'button' }, 'Load entities');
  const fieldList = el('ul', { class: 'field-list' });
  const titleInput = el('input', {
    type: 'text',
    placeholder: 'Form title (optional)',
    autocomplete: 'off',
  });
  const selectRequiredBtn = el('button', { type: 'button', class: 'quiet' }, 'Select required');
  const selectAllBtn = el('button', { type: 'button', class: 'quiet' }, 'Select all');
  const clearFieldsBtn = el('button', { type: 'button', class: 'quiet' }, 'Clear');
  const buildBtn = el('button', { type: 'button', class: 'primary', disabled: true }, 'Build form');
  const resultPreview = el('div', { class: 'result-preview' });
  const resultActions = el('div', { class: 'actions' });
  const resultSection = el(
    'section',
    { class: 'result', hidden: true },
    el('h2', {}, 'Ready to insert'),
    resultPreview,
    resultActions,
  );

  const settingsView = el('main', { class: 'view', hidden: true });
  const mainView = el('main', { class: 'view' });

  function renderConfigured() {
    const configured = isConfigured(state.settings);
    notice.hidden = configured || state.loadFailed;
    notice.textContent = configured
      ? ''
      : 'Salesforce is not configured yet. Open Settings to add connection details and the App Builder URL.';
    loadEntitiesBtn.disabled = !configured;
    buildBtn.disabled = !configured || !state.selectedEntity || state.selected.size === 0;
  }

  function filteredEntities() {
    const q = state.entityFilter.trim().toLowerCase();
    if (!q) return state.entities;
    return state.entities.filter((e) => e.label.toLowerCase().includes(q)
      || e.name.toLowerCase().includes(q));
  }

  function moveField(name, delta) {
    const index = state.fields.findIndex((f) => f.name === name);
    if (index < 0) return;
    const next = index + delta;
    if (next < 0 || next >= state.fields.length) return;
    const copy = [...state.fields];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    state.fields = copy;
    renderFields();
  }

  function renderFields() {
    fieldList.replaceChildren(...state.fields.map((f, index) => {
      const selected = state.selected.get(f.name);
      const typeSelect = el(
        'select',
        {
          class: 'field-type-select',
          disabled: !selected,
          onchange: (e) => {
            const current = state.selected.get(f.name);
            if (!current) return;
            current.type = e.target.value;
            state.selected.set(f.name, current);
          },
        },
        ...TYPE_OPTIONS.map((t) => el(
          'option',
          { value: t, selected: (selected?.type || f.type) === t },
          t,
        )),
      );
      const moveUp = el('button', {
        type: 'button',
        class: 'quiet field-move',
        title: 'Move up',
        'aria-label': `Move ${f.label} up`,
        disabled: index === 0,
        onclick: () => moveField(f.name, -1),
      }, '↑');
      const moveDown = el('button', {
        type: 'button',
        class: 'quiet field-move',
        title: 'Move down',
        'aria-label': `Move ${f.label} down`,
        disabled: index === state.fields.length - 1,
        onclick: () => moveField(f.name, 1),
      }, '↓');
      return el(
        'li',
        {},
        el(
          'label',
          {},
          el('input', {
            type: 'checkbox',
            checked: !!selected,
            onchange: (e) => {
              if (e.target.checked) {
                state.selected.set(f.name, {
                  ...f,
                  type: selected?.type || f.type,
                  required: f.required,
                });
              } else {
                state.selected.delete(f.name);
              }
              renderFields();
              renderConfigured();
            },
          }),
          el(
            'span',
            { class: 'field-meta' },
            el('span', { class: 'field-name' }, f.label),
            el(
              'span',
              { class: 'field-api' },
              `${f.name} · SF ${f.sfType}${f.required ? ' · required' : ''}`,
            ),
          ),
        ),
        el('div', { class: 'field-controls' }, typeSelect, moveUp, moveDown),
      );
    }));
    renderConfigured();
  }

  function renderEntities() {
    const items = filteredEntities();
    entityList.replaceChildren(...items.map((entity) => {
      const active = state.selectedEntity?.name === entity.name;
      return el(
        'li',
        {},
        el(
          'button',
          {
            type: 'button',
            class: active ? 'is-active' : '',
            'data-entity': entity.name,
          },
          el(
            'span',
            { class: 'entity-meta' },
            el('span', { class: 'entity-name' }, entity.label),
            el('span', { class: 'entity-api' }, entity.name),
          ),
        ),
      );
    }));
  }

  async function onSelectEntity(entity) {
    if (state.controller) state.controller.abort();
    state.selectedEntity = entity;
    state.fields = [];
    state.selected = new Map();
    state.title = `${entity.label} form`;
    titleInput.value = state.title;
    renderEntities();
    renderFields();
    resultSection.hidden = true;
    state.controller = new AbortController();
    setStatus(status, `Loading ${entity.label} fields…`);
    try {
      const described = await describeEntity(
        state.settings,
        entity.name,
        { signal: state.controller.signal },
      );
      state.fields = selectableFields(described.fields);
      // Pre-select required fields
      state.fields.filter((f) => f.required).forEach((f) => {
        state.selected.set(f.name, { ...f });
      });
      renderFields();
      setStatus(
        status,
        `${state.fields.length} createable fields on ${entity.name}.`,
        'success',
      );
    } catch (error) {
      if (error.name === 'AbortError') setStatus(status, 'Stopped.');
      else setStatus(status, error.message, 'error');
    } finally {
      state.controller = null;
    }
  }

  entityList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-entity]');
    if (!button) return;
    const entity = state.entities.find((e) => e.name === button.dataset.entity);
    if (entity) onSelectEntity(entity);
  });

  async function onLoadEntities() {
    if (!isConfigured(state.settings)) {
      setStatus(status, 'Configure Salesforce in Settings first.', 'error');
      return;
    }
    if (state.controller) state.controller.abort();
    state.controller = new AbortController();
    loadEntitiesBtn.disabled = true;
    loadEntitiesBtn.textContent = 'Loading…';
    setStatus(status, 'Fetching Salesforce entities…');
    try {
      state.entities = await listEntities(state.settings, { signal: state.controller.signal });
      renderEntities();
      setStatus(
        status,
        `Loaded ${state.entities.length} createable entities.`,
        'success',
      );
    } catch (error) {
      if (error.name === 'AbortError') setStatus(status, 'Stopped.');
      else setStatus(status, error.message, 'error');
    } finally {
      state.controller = null;
      loadEntitiesBtn.textContent = 'Load entities';
      renderConfigured();
    }
  }

  function selectedFieldsList() {
    // Preserve the author-arranged field order from the list (↑↓).
    return state.fields
      .map((f) => state.selected.get(f.name))
      .filter(Boolean);
  }

  function applyResult(mode) {
    const { result, resultMeta } = state;
    if (!result) return;
    if (mode === 'replace') {
      actions.sendHTML(result);
      setStatus(status, 'Replaced the current selection.', 'success');
      return;
    }
    if (mode === 'insert-after') {
      actions.sendHTML(`${resultMeta?.selectionHtml || ''}${result}`);
      setStatus(status, 'Inserted after the selection.', 'success');
      return;
    }
    actions.sendHTML(result);
    setStatus(status, 'Inserted the Salesforce form at the cursor.', 'success');
  }

  function renderResultActions() {
    const hasSelection = !!state.selection;
    const buttons = [
      el('button', {
        type: 'button',
        class: 'primary',
        onclick: () => applyResult(hasSelection ? 'replace' : 'insert'),
      }, hasSelection ? 'Replace selection' : 'Insert at cursor'),
    ];
    if (hasSelection) {
      buttons.push(el('button', {
        type: 'button',
        onclick: () => applyResult('insert-after'),
      }, 'Insert after selection'));
    }
    resultActions.replaceChildren(...buttons);
  }

  function buildForm() {
    if (!state.selectedEntity || state.selected.size === 0) {
      setStatus(status, 'Select an entity and at least one field.', 'error');
      return;
    }
    const fields = selectedFieldsList();
    const submitUrl = submitActionUrl(state.settings);
    const html = buildFormBlockHtml({
      entity: state.selectedEntity.name,
      title: titleInput.value.trim() || `${state.selectedEntity.label} form`,
      submitUrl,
      fields,
    });
    state.result = html;
    state.resultMeta = {
      entity: state.selectedEntity.name,
      fields,
      selectionHtml: state.selection,
    };
    resultPreview.textContent = `${formSummary({
      entity: state.selectedEntity.name,
      fields,
    })} — inserts an Edge Delivery \`sf-form\` block (JSON → rendered form).`;
    renderResultActions();
    resultSection.hidden = false;
    setStatus(status, 'sf-form block ready. Insert it onto the page.', 'success');
  }

  async function refreshSelection() {
    try {
      state.selection = await actions.getSelection();
    } catch {
      state.selection = '';
    }
    if (state.result) renderResultActions();
  }

  entitySearch.addEventListener('input', () => {
    state.entityFilter = entitySearch.value;
    renderEntities();
  });
  loadEntitiesBtn.addEventListener('click', onLoadEntities);
  buildBtn.addEventListener('click', buildForm);
  selectRequiredBtn.addEventListener('click', () => {
    state.fields.filter((f) => f.required).forEach((f) => {
      state.selected.set(f.name, { ...(state.selected.get(f.name) || f) });
    });
    renderFields();
  });
  selectAllBtn.addEventListener('click', () => {
    state.fields.forEach((f) => {
      state.selected.set(f.name, { ...(state.selected.get(f.name) || f) });
    });
    renderFields();
  });
  clearFieldsBtn.addEventListener('click', () => {
    state.selected = new Map();
    renderFields();
  });

  mainView.append(
    el(
      'header',
      {},
      el('h1', {}, 'Salesforce Entity Bridge'),
      el('button', {
        type: 'button',
        class: 'quiet',
        onclick: () => {
          mainView.hidden = true;
          settingsView.hidden = false;
        },
      }, 'Settings'),
    ),
    notice,
    el(
      'section',
      {},
      el(
        'div',
        { class: 'section-head' },
        el('h2', {}, '1. Entity'),
        el('div', { class: 'toolbar' }, loadEntitiesBtn),
      ),
      el('div', { class: 'search-row' }, entitySearch),
      el('p', { class: 'hint' }, 'Pull createable Salesforce objects (Lead, Contact, …), then pick one.'),
      entityList,
    ),
    el(
      'section',
      {},
      el(
        'div',
        { class: 'section-head' },
        el('h2', {}, '2. Fields'),
        el(
          'div',
          { class: 'toolbar' },
          selectRequiredBtn,
          selectAllBtn,
          clearFieldsBtn,
        ),
      ),
      el('p', { class: 'hint' }, 'Tick fields to include. Change the HTML type if needed. Use ↑↓ to set form order.'),
      fieldList,
      field('Form title', titleInput),
    ),
    buildBtn,
    status,
    resultSection,
  );

  /* ---------- Settings view ---------- */

  const instanceInput = el('input', {
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'myorg.my.salesforce.com',
  });
  const clientIdInput = el('input', {
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    class: 'secret-mask',
  });
  const clientSecretInput = el('input', {
    type: 'password',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const authorizeInput = el('input', {
    type: 'url',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const tokenUrlInput = el('input', {
    type: 'url',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const refreshInput = el('input', {
    type: 'password',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const scopeInput = el('input', {
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const callbackInput = el('input', {
    type: 'url',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const oauthStateInput = el('input', {
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    class: 'secret-mask',
  });
  const apiVersionInput = el('input', {
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'v59.0',
  });
  const objectNameInput = el('input', {
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'salesforce_car_licence_details__c',
  });
  const appBuilderInput = el('input', {
    type: 'url',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'https://….adobeioruntime.net/api/v1/web/…/salesforce-entity-bridge',
  });
  const saveBtn = el('button', { type: 'submit', class: 'primary' }, 'Save');
  const testBtn = el('button', { type: 'button' }, 'Test connection');
  const settingsStatus = el('p', { class: 'status', role: 'status', hidden: true });

  function fillForm() {
    const { settings } = state;
    instanceInput.value = settings.instanceUrl;
    clientIdInput.value = '';
    clientIdInput.placeholder = settings.clientId ? 'Saved. Leave blank to keep it.' : 'Connected App consumer key';
    clientSecretInput.value = '';
    clientSecretInput.placeholder = settings.clientSecret ? 'Saved. Leave blank to keep it.' : 'Connected App consumer secret';
    authorizeInput.value = settings.oauthAuthorizeUrl;
    tokenUrlInput.value = settings.tokenUrl;
    refreshInput.value = '';
    refreshInput.placeholder = settings.refreshToken ? 'Saved. Leave blank to keep it.' : 'OAuth refresh token';
    scopeInput.value = settings.scope;
    callbackInput.value = settings.callbackUrl || '';
    oauthStateInput.value = '';
    oauthStateInput.placeholder = settings.oauthState ? 'Saved. Leave blank to keep it.' : 'OAuth state';
    apiVersionInput.value = settings.apiVersion || 'v59.0';
    objectNameInput.value = settings.objectName || '';
    appBuilderInput.value = settings.appBuilderUrl;
  }

  function readForm() {
    const keep = (entered, existing) => entered || existing || '';
    const instanceUrl = normaliseInstanceUrl(instanceInput.value);
    let tokenUrl = tokenUrlInput.value.trim();
    if (!tokenUrl && instanceUrl) {
      tokenUrl = `${instanceUrl}/services/oauth2/token`;
    }
    return {
      instanceUrl,
      clientId: keep(clientIdInput.value.trim(), state.settings.clientId),
      clientSecret: keep(clientSecretInput.value.trim(), state.settings.clientSecret),
      oauthAuthorizeUrl: authorizeInput.value.trim()
        || 'https://login.salesforce.com/services/oauth2/authorize',
      tokenUrl,
      refreshToken: keep(refreshInput.value.trim(), state.settings.refreshToken),
      scope: scopeInput.value.trim()
        || 'api chatter_api full id openid refresh_token visualforce web',
      callbackUrl: callbackInput.value.trim(),
      oauthState: keep(oauthStateInput.value.trim(), state.settings.oauthState),
      apiVersion: apiVersionInput.value.trim() || 'v59.0',
      objectName: objectNameInput.value.trim(),
      appBuilderUrl: appBuilderInput.value.trim().replace(/\/+$/, ''),
    };
  }

  async function withBusy(button, label, task) {
    const original = button.textContent;
    saveBtn.disabled = true;
    testBtn.disabled = true;
    button.textContent = label;
    try {
      await task();
    } catch (error) {
      setStatus(settingsStatus, error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      testBtn.disabled = false;
      button.textContent = original;
    }
  }

  function onSave(e) {
    e.preventDefault();
    const settings = readForm();
    if (!isConfigured(settings)) {
      setStatus(
        settingsStatus,
        'Instance URL, client ID/secret, token URL, refresh token, and App Builder URL are required.',
        'error',
      );
      return;
    }
    withBusy(saveBtn, 'Saving…', async () => {
      state.settings = await saveSettings({ org, token, settings });
      state.loadFailed = false;
      fillForm();
      renderConfigured();
      setStatus(
        settingsStatus,
        `Saved for everyone in ${org}. Mirror the same values into the App Builder .env before deploying Runtime actions.`,
        'success',
      );
    });
  }

  function onTest() {
    const settings = readForm();
    if (!isConfigured(settings)) {
      setStatus(settingsStatus, 'Fill in the required connection fields first.', 'error');
      return;
    }
    withBusy(testBtn, 'Testing…', async () => {
      setStatus(settingsStatus, 'Calling App Builder → Salesforce…');
      const result = await testConnection(settings);
      setStatus(
        settingsStatus,
        `Connected. ${result.count} createable entities (e.g. ${result.sample.join(', ') || 'none'}).`,
        'success',
      );
    });
  }

  testBtn.addEventListener('click', onTest);

  settingsView.append(
    el(
      'header',
      {},
      el('h1', {}, 'Settings'),
      el('button', {
        type: 'button',
        class: 'quiet',
        onclick: () => {
          settingsView.hidden = true;
          mainView.hidden = false;
        },
      }, 'Back'),
    ),
    el(
      'p',
      { class: 'hint' },
      `Stored in the secrets sheet of ${org}'s da.live config (${KEYS.clientSecret}, ${KEYS.refreshToken}, …). `
      + 'Anyone who can read that config can read these values. Form submissions use App Builder so secrets are not embedded in the published page.',
    ),
    el(
      'form',
      { onsubmit: onSave },
      field('Salesforce instance', instanceInput, el('span', { class: 'hint' }, 'Host only or full URL, e.g. myorg.my.salesforce.com')),
      field('Consumer key (client ID)', clientIdInput),
      field('Consumer secret', clientSecretInput),
      field('OAuth authorize URL', authorizeInput),
      field('Access / refresh token URL', tokenUrlInput, el('span', { class: 'hint' }, 'https://{instance}/services/oauth2/token')),
      field('Refresh token', refreshInput),
      field('Authorization scope', scopeInput),
      field('OAuth callback URL', callbackInput),
      field('OAuth state', oauthStateInput),
      field('API version', apiVersionInput),
      field('Default object', objectNameInput, el('span', { class: 'hint' }, 'Preferred sObject when loading entities, e.g. salesforce_car_licence_details__c')),
      field('App Builder base URL', appBuilderInput, el('span', { class: 'hint' }, 'Package URL that exposes /entities, /describe, and /submit')),
      el('div', { class: 'actions' }, saveBtn, testBtn),
      settingsStatus,
    ),
  );

  document.body.append(mainView, settingsView);
  document.documentElement.addEventListener('pointerenter', refreshSelection);

  refreshSelection();
  try {
    state.settings = await loadSettings({ org, token });
  } catch (error) {
    state.loadFailed = true;
    setStatus(status, error.message, 'error');
  }
  fillForm();
  renderConfigured();
}());
