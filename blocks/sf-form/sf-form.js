/**
 * Salesforce Entity Bridge form block.
 *
 * Authored rows (from the Experience Workspace plugin):
 *   entity | Lead
 *   title  | Lead form
 *   submit | https://…/submit
 *   First Name | FirstName | text | required |
 *   …
 */

function textOf(cell) {
  return (cell?.textContent || '').trim();
}

function parseBlock(block) {
  const rows = [...block.children].map((row) => [...row.children].map(textOf));
  const meta = { entity: '', title: '', submitUrl: '' };
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
      picklist: (e || '').split('|').map((v) => v.trim()).filter(Boolean),
    });
  });

  return { meta, fields };
}

function createControl(field) {
  const id = `sf-${field.name}`;
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
    field.picklist.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      control.append(opt);
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
  return control;
}

function readValue(control) {
  if (control.type === 'checkbox') return control.checked;
  if (control.multiple) {
    return [...control.selectedOptions].map((o) => o.value).filter(Boolean).join(';');
  }
  return control.value;
}

export default function decorate(block) {
  const { meta, fields } = parseBlock(block);
  if (!meta.entity || !fields.length) {
    block.innerHTML = '<p class="sf-form-error">This Salesforce form is missing an entity or fields.</p>';
    return;
  }

  const form = document.createElement('form');
  form.className = 'sf-form-el';
  form.noValidate = false;

  if (meta.title) {
    const heading = document.createElement('h2');
    heading.className = 'sf-form-title';
    heading.textContent = meta.title;
    form.append(heading);
  }

  const entityInput = document.createElement('input');
  entityInput.type = 'hidden';
  entityInput.name = '_entity';
  entityInput.value = meta.entity;
  form.append(entityInput);

  fields.forEach((field) => {
    const control = createControl(field);
    if (field.type === 'hidden') {
      form.append(control);
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = `sf-form-field sf-form-field-${field.type}`;
    const label = document.createElement('label');
    label.htmlFor = control.id;
    label.textContent = field.label + (field.required ? ' *' : '');
    if (field.type === 'checkbox') {
      wrap.append(control, label);
    } else {
      wrap.append(label, control);
    }
    form.append(wrap);
  });

  const actions = document.createElement('div');
  actions.className = 'sf-form-actions';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Submit';
  actions.append(submit);
  form.append(actions);

  const status = document.createElement('p');
  status.className = 'sf-form-status';
  status.hidden = true;
  form.append(status);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!meta.submitUrl) {
      status.hidden = false;
      status.dataset.type = 'error';
      status.textContent = 'No App Builder submit URL is configured on this form.';
      return;
    }
    if (!form.reportValidity()) return;

    // Compatible with securgov salesforce-submit: flat API fields plus
    // optional { entity, fields } wrapper used by this plugin.
    const values = {};
    form.querySelectorAll('[name]').forEach((control) => {
      if (control.name === '_entity') return;
      values[control.name] = readValue(control);
    });
    const payload = {
      entity: meta.entity,
      fields: values,
      ...values,
    };

    submit.disabled = true;
    status.hidden = false;
    status.dataset.type = 'info';
    status.textContent = 'Submitting to Salesforce…';

    try {
      const resp = await fetch(meta.submitUrl, {
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
      status.dataset.type = 'success';
      status.textContent = data?.id
        ? `Created ${meta.entity} ${data.id}`
        : (data?.message || 'Submitted successfully.');
      form.reset();
    } catch (error) {
      status.dataset.type = 'error';
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  block.replaceChildren(form);
}
