/*
 * Map Salesforce describe fields to HTML form controls and build an
 * `sf-form` block that can be inserted into the document.
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
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(text) {
  return `<div>${escapeHtml(text)}</div>`;
}

function row(...cells) {
  return `<div>${cells.map(cell).join('')}</div>`;
}

/**
 * Build EDS `sf-form` block markup for Document Authoring / sendHTML.
 *
 * Rows:
 *   entity | <SObjectApiName>
 *   title  | <form heading>
 *   submit | <App Builder submit URL>
 *   <Label> | <ApiName> | <htmlType> | required|optional | <picklist csv>
 *
 * @param {{ entity: string, title?: string, submitUrl: string, fields: object[] }} opts
 */
export function buildFormBlockHtml({
  entity, title, submitUrl, fields,
}) {
  const heading = title || `${entity} form`;
  const rows = [
    row('entity', entity),
    row('title', heading),
    row('submit', submitUrl),
    ...fields.map((f) => {
      const pick = (f.picklistValues || []).map((p) => p.value).join('|');
      return row(
        f.label,
        f.name,
        f.type,
        f.required ? 'required' : 'optional',
        pick,
      );
    }),
  ];
  return `<div class="sf-form">${rows.join('')}</div>`;
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
