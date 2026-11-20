/*
 * Map Salesforce describe fields to HTML form controls and build an
 * `sf-form` block that embeds a JSON definition for the page block to render.
 */

/** Salesforce soapType / type → HTML input type (or select/textarea/checkbox). */
export const FIELD_TYPES = {
  string: 'text',
  textarea: 'textarea',
  email: 'email',
  phone: 'tel',
  url: 'url',
  int: 'number',
  double: 'number',
  currency: 'number',
  percent: 'number',
  boolean: 'checkbox',
  date: 'date',
  datetime: 'datetime-local',
  time: 'time',
  picklist: 'select',
  multipicklist: 'select-multiple',
  reference: 'text',
  id: 'hidden',
  base64: 'file',
  address: 'text',
  location: 'text',
  combobox: 'text',
  anyType: 'text',
};

const SKIP_TYPES = new Set(['base64', 'address', 'location', 'complexvalue']);

/**
 * Choose an HTML control type for a Salesforce field describe entry.
 * @param {object} field Salesforce DescribeSObjectResult.fields[] entry
 */
export function mapFieldType(field) {
  if (!field) return 'text';
  if (field.type === 'string' && field.length > 255) return 'textarea';
  if (field.htmlFormatted && field.type === 'textarea') return 'textarea';
  return FIELD_TYPES[field.type] || 'text';
}

/**
 * Fields suitable for a create form: createable, not auto-number / calculated.
 * @param {object[]} fields
 */
export function selectableFields(fields = []) {
  return fields
    .filter((f) => f && f.createable && !f.autoNumber && !f.calculated)
    .filter((f) => !SKIP_TYPES.has(f.type))
    .filter((f) => f.name !== 'OwnerId' && f.name !== 'RecordTypeId')
    .map((f) => ({
      name: f.name,
      label: f.label || f.name,
      type: mapFieldType(f),
      sfType: f.type,
      required: f.nillable === false && !f.defaultedOnCreate,
      nillable: !!f.nillable,
      length: f.length || null,
      picklistValues: (f.picklistValues || [])
        .filter((p) => p.active !== false)
        .map((p) => ({ value: p.value, label: p.label || p.value })),
    }))
    .sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Compact JSON definition consumed by `blocks/sf-form`.
 * @param {{ entity: string, title?: string, submitUrl: string, fields: object[] }} opts
 */
export function buildFormDefinition({
  entity, title, submitUrl, fields,
}) {
  return {
    entity,
    title: title || `${entity} form`,
    submit: submitUrl,
    submitLabel: 'Submit',
    fields: fields.map((f) => ({
      name: f.name,
      label: f.label || f.name,
      type: f.type || 'text',
      required: !!f.required,
      options: (f.picklistValues || []).map((p) => (
        typeof p === 'string' ? { value: p, label: p } : { value: p.value, label: p.label || p.value }
      )),
    })),
  };
}

/**
 * Build an Edge Delivery `sf-form` authoring table for Document Authoring /
 * `sendHTML`. DA recognises blocks as tables whose first row is the block
 * name; later that becomes `<div class="sf-form">` on the page. The body cell
 * holds JSON that `blocks/sf-form` parses into a form.
 *
 * @param {{ entity: string, title?: string, submitUrl: string, fields: object[] }} opts
 */
export function buildFormBlockHtml(opts) {
  const definition = buildFormDefinition(opts);
  const json = JSON.stringify(definition, null, 2);
  return [
    '<table>',
    '<tbody>',
    '<tr><th>sf-form</th></tr>',
    `<tr><td><pre><code>${escapeHtml(json)}</code></pre></td></tr>`,
    '</tbody>',
    '</table>',
  ].join('');
}

/**
 * Short human summary for the plugin result preview.
 */
export function formSummary({ entity, fields }) {
  const required = fields.filter((f) => f.required).length;
  const count = `${fields.length} field${fields.length === 1 ? '' : 's'}`;
  const req = required ? ` (${required} required)` : '';
  return `${entity}: ${count}${req}`;
}
