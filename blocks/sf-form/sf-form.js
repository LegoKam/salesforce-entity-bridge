/**
 * Salesforce Entity Bridge form block.
 *
 * Preferred authoring (plugin Insert at cursor): one cell of JSON
 *   {
 *     "entity": "Lead",
 *     "title": "Lead form",
 *     "submit": "https://…/submit",
 *     "fields": [{ "name", "label", "type", "required", "options" }]
 *   }
 *
 * Legacy table rows are still supported:
 *   entity | Lead
 *   title  | Lead form
 *   submit | https://…/submit
 *   First Name | FirstName | text | required |
 */

function textOf(cell) {
  return (cell?.textContent || '').trim();
}

function extractJsonText(block) {
  const code = block.querySelector('code, pre');
  const raw = (code?.textContent || block.textContent || '').trim();
  if (!raw) return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function parseJsonDefinition(block) {
  const jsonText = extractJsonText(block);
  if (!jsonText) return null;
  try {
    const data = JSON.parse(jsonText);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    if (!data.entity || !Array.isArray(data.fields)) return null;
    return {
      entity: String(data.entity),
      title: data.title ? String(data.title) : '',
      submitUrl: String(data.submit || data.submitUrl || data.action || ''),
      submitLabel: String(data.submitLabel || 'Submit'),
      fields: data.fields.map((f) => ({
        label: f.label || f.name,
        name: f.name,
        type: String(f.type || 'text').toLowerCase(),
        required: !!f.required,
        picklist: (f.options || f.picklist || []).map((o) => (
          typeof o === 'string'
            ? { value: o, label: o }
            : { value: o.value, label: o.label || o.value }
        )).filter((o) => o.value),
      })).filter((f) => f.name),
    };
  } catch {
    return null;
  }
}

function parseLegacyRows(block) {
  const rows = [...block.children].map((row) => [...row.children].map(textOf));
  const meta = { entity: '', title: '', submitUrl: '', submitLabel: 'Submit' };
  const fields = [];

  rows.forEach((cols) => {
    const [a, b, c, d, e] = cols;
    const key = (a || '').toLowerCase();
    if (key === 'entity' && b) {
      meta.entity = b;
      return;
    }
    if (key === 'title' && b) {
      meta.title = b;
      return;
    }
    if ((key === 'submit' || key === 'submit url' || key === 'action') && b) {
      meta.submitUrl = b;
      return;
    }
    if (!a || !b) return;
    fields.push({
      label: a,
      name: b,
      type: (c || 'text').toLowerCase(),
      required: (d || '').toLowerCase() === 'required',
      picklist: (e || '').split('|').map((v) => v.trim()).filter(Boolean)
        .map((value) => ({ value, label: value })),
    });
  });

  return { ...meta, fields };
}

function parseBlock(block) {
  return parseJsonDefinition(block) || parseLegacyRows(block);
}

function createControl(field) {
  const id = `sf-${field.name.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  let control;

  if (field.type === 'textarea') {
    control = document.createElement('textarea');
    control.rows = 4;
  } else if (field.type === 'select' || field.type === 'select-multiple') {
    control = document.createElement('select');
    if (field.type === 'select-multiple') control.multiple = true;
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = field.required ? 'Select…' : '—';
    control.append(blank);
    field.picklist.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      control.append(option);
    });
  } else if (field.type === 'checkbox') {
    control = document.createElement('input');
    control.type = 'checkbox';
  } else if (field.type === 'hidden') {
    control = document.createElement('input');
    control.type = 'hidden';
  } else {
    control = document.createElement('input');
    control.type = field.type || 'text';
  }

  control.id = id;
  control.name = field.name;
  if (field.required && field.type !== 'checkbox') control.required = true;
  if (control.placeholder === undefined && field.type !== 'checkbox' && field.type !== 'select'
    && field.type !== 'select-multiple' && field.type !== 'hidden') {
    control.placeholder = field.label;
  }
  return control;
}

function readValue(control) {
  if (control.type === 'checkbox') return control.checked;
  if (control.multiple) {
    return [...control.selectedOptions].map((o) => o.value).filter(Boolean).join(';');
  }
  return control.value;
}

function setStatus(el, type, message) {
  el.hidden = false;
  el.dataset.type = type;
  el.textContent = message;
}

export default function decorate(block) {
  const def = parseBlock(block);
  if (!def.entity || !def.fields.length) {
    block.innerHTML = '<p class="sf-form-error">This Salesforce form is missing an entity or fields.</p>';
    return;
  }

  const form = document.createElement('form');
  form.className = 'sf-form-el';
  form.noValidate = false;

  if (def.title) {
    const heading = document.createElement('h2');
    heading.className = 'sf-form-title';
    heading.textContent = def.title;
    form.append(heading);
  }

  const entityInput = document.createElement('input');
  entityInput.type = 'hidden';
  entityInput.name = '_entity';
  entityInput.value = def.entity;
  form.append(entityInput);

  const grid = document.createElement('div');
  grid.className = 'sf-form-grid';

  def.fields.forEach((field) => {
    const control = createControl(field);
    if (field.type === 'hidden') {
      form.append(control);
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = `sf-form-field sf-form-field-${field.type}`;
    if (field.type === 'textarea') wrap.classList.add('sf-form-field-wide');

    const label = document.createElement('label');
    label.htmlFor = control.id;
    label.textContent = field.label;
    if (field.required) {
      const req = document.createElement('abbr');
      req.title = 'required';
      req.textContent = ' *';
      label.append(req);
    }

    if (field.type === 'checkbox') {
      wrap.classList.add('sf-form-field-check');
      wrap.append(control, label);
    } else {
      wrap.append(label, control);
    }
    grid.append(wrap);
  });

  form.append(grid);

  const actions = document.createElement('div');
  actions.className = 'sf-form-actions';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = def.submitLabel || 'Submit';
  actions.append(submit);
  form.append(actions);

  const status = document.createElement('p');
  status.className = 'sf-form-status';
  status.hidden = true;
  status.setAttribute('aria-live', 'polite');
  form.append(status);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!def.submitUrl) {
      setStatus(status, 'error', 'No App Builder submit URL is configured on this form.');
      return;
    }
    if (!form.reportValidity()) return;

    const values = {};
    form.querySelectorAll('[name]').forEach((control) => {
      if (control.name === '_entity') return;
      values[control.name] = readValue(control);
    });
    const payload = {
      entity: def.entity,
      fields: values,
      ...values,
    };

    submit.disabled = true;
    setStatus(status, 'info', 'Submitting to Salesforce…');

    try {
      const resp = await fetch(def.submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { message: text };
      }
      if (!resp.ok || data?.status === 'failure') {
        throw new Error(data?.error || data?.message || `Submit failed (${resp.status})`);
      }
      setStatus(
        status,
        'success',
        data?.id ? `Created ${def.entity} ${data.id}` : (data?.message || 'Submitted successfully.'),
      );
      form.reset();
    } catch (error) {
      setStatus(status, 'error', error.message);
    } finally {
      submit.disabled = false;
    }
  });

  block.replaceChildren(form);
}
