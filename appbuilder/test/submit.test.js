const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSalesforcePayload,
  extractSalesforceInput,
  validatePayload,
  main,
  CAR_LICENCE_FIELDS,
} = require('../actions/submit/index.js');

describe('Salesforce submit (demo-open-auth patterns)', () => {
  it('car licence allowlist only forwards known fields', () => {
    assert.deepEqual(buildSalesforcePayload({
      Name__c: 'Alex Citizen',
      Email_Address__c: 'alex@example.com',
      attribute__c: 'user-id',
      unexpected: 'not forwarded',
      SALESFORCE_CONSUMER_SECRET: 'not forwarded',
    }, 'salesforce_car_licence_details__c'), {
      Name__c: 'Alex Citizen',
      Email_Address__c: 'alex@example.com',
      attribute__c: 'user-id',
    });
    assert.ok(CAR_LICENCE_FIELDS.includes('Name__c'));
  });

  it('requires a name and valid email for car licence object', () => {
    assert.deepEqual(
      validatePayload({ Email_Address__c: 'invalid' }, 'salesforce_car_licence_details__c'),
      [
        'Name__c is required',
        'Email_Address__c must be a valid email address',
      ],
    );
  });

  it('extracts plugin { entity, fields } shape', () => {
    assert.deepEqual(extractSalesforceInput({
      entity: 'Lead',
      fields: { FirstName: 'Alex', LastName: 'Citizen' },
    }), {
      entity: 'Lead',
      record: { FirstName: 'Alex', LastName: 'Citizen' },
    });
  });

  it('extracts nested AEM Forms data field (CarLicenceInput)', () => {
    assert.deepEqual(extractSalesforceInput({
      SALESFORCE_OBJECT_NAME: 'salesforce_car_licence_details__c',
      data: JSON.stringify({
        afJsonSchemaRoot: {},
        CarLicenceInput: {
          Name__c: 'Alex Citizen',
          Email_Address__c: 'alex@example.com',
        },
      }),
    }), {
      entity: 'salesforce_car_licence_details__c',
      record: {
        Name__c: 'Alex Citizen',
        Email_Address__c: 'alex@example.com',
      },
    });
  });

  it('extracts nested AEM Forms raw multipart body', () => {
    const boundary = '----TestBoundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="data"',
      '',
      '{"afJsonSchemaRoot":{},"CarLicenceInput":{"Name__c":"Alex Citizen","Email_Address__c":"alex@example.com"}}',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    assert.deepEqual(extractSalesforceInput({
      SALESFORCE_OBJECT_NAME: 'salesforce_car_licence_details__c',
      __ow_headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      __ow_body: Buffer.from(body).toString('base64'),
    }), {
      entity: 'salesforce_car_licence_details__c',
      record: {
        Name__c: 'Alex Citizen',
        Email_Address__c: 'alex@example.com',
      },
    });
  });

  it('rejects methods other than POST', async () => {
    const response = await main({ __ow_method: 'GET' });
    assert.equal(response.statusCode, 405);
    assert.equal(response.body.message, 'Method not allowed');
  });

  it('reports missing server-side configuration without exposing credentials', async () => {
    const response = await main({
      __ow_method: 'POST',
      Name__c: 'Alex Citizen',
      Email_Address__c: 'alex@example.com',
    });
    assert.equal(response.statusCode, 500);
    assert.equal(response.body.message, 'Salesforce integration is not configured');
  });
});
