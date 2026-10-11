import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.js';

let mongo;
let app;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('crm-test'));
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.syncIndexes();
});

async function registerEmployee(name, email) {
  const res = await request(app).post('/api/auth/register').send({ name, email, password: 'secret123' });
  assert.equal(res.status, 201);
  return res.body.data.token;
}

async function submitEnquiry(overrides = {}) {
  const res = await request(app)
    .post('/api/enquiries/public')
    .send({ name: 'Riya Sharma', email: 'riya@example.com', courseInterest: 'Full Stack Web Development', ...overrides });
  assert.equal(res.status, 201);
  return res.body.data.enquiry;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Employee register / login', () => {
  it('registers an employee and returns a JWT without the password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'Asha@Fastor.com', password: 'secret123' });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.employee.email, 'asha@fastor.com');
    assert.equal(res.body.data.employee.password, undefined);
  });

  it('rejects a duplicate email', async () => {
    await registerEmployee('Asha', 'asha@fastor.com');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha 2', email: 'asha@fastor.com', password: 'secret123' });
    assert.equal(res.status, 409);
  });

  it('rejects invalid registration data', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: '1' });
    assert.equal(res.status, 400);
    assert.equal(res.body.errors.length, 3);
  });

  it('logs in with correct credentials and rejects a wrong password', async () => {
    await registerEmployee('Asha', 'asha@fastor.com');

    const ok = await request(app).post('/api/auth/login').send({ email: 'asha@fastor.com', password: 'secret123' });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.data.token);

    const bad = await request(app).post('/api/auth/login').send({ email: 'asha@fastor.com', password: 'wrong' });
    assert.equal(bad.status, 401);
  });

  it('returns the logged-in employee from /me', async () => {
    const token = await registerEmployee('Asha', 'asha@fastor.com');
    const res = await request(app).get('/api/auth/me').set(auth(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.employee.email, 'asha@fastor.com');
    assert.equal((await request(app).get('/api/auth/me')).status, 401);
  });
});

describe('Public enquiry form', () => {
  it('accepts a submission without authentication', async () => {
    const enquiry = await submitEnquiry({ phone: '+91 98765 43210' });
    assert.equal(enquiry.claimedBy, null);
    assert.equal(enquiry.source, 'online');
  });

  it('validates the form fields', async () => {
    const res = await request(app).post('/api/enquiries/public').send({ name: 'R', email: 'bad' });
    assert.equal(res.status, 400);
  });
});

describe('Leads', () => {
  it('requires a valid token for protected routes', async () => {
    assert.equal((await request(app).get('/api/enquiries/public')).status, 401);
    assert.equal((await request(app).get('/api/enquiries/public').set(auth('not-a-token'))).status, 401);
    assert.equal((await request(app).get('/api/enquiries/private')).status, 401);
  });

  it('lists unclaimed leads to every employee', async () => {
    const token = await registerEmployee('Asha', 'asha@fastor.com');
    await submitEnquiry();
    await submitEnquiry({ email: 'karan@example.com', name: 'Karan' });

    const res = await request(app).get('/api/enquiries/public').set(auth(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.total, 2);
  });

  it('claiming makes a lead private to the claiming employee', async () => {
    const asha = await registerEmployee('Asha', 'asha@fastor.com');
    const ravi = await registerEmployee('Ravi', 'ravi@fastor.com');
    const lead = await submitEnquiry();
    await submitEnquiry({ email: 'karan@example.com', name: 'Karan' });

    const claim = await request(app).patch(`/api/enquiries/${lead.id}/claim`).set(auth(asha));
    assert.equal(claim.status, 200);
    assert.ok(claim.body.data.enquiry.claimedBy);

    // No longer public, for anyone
    const pub = await request(app).get('/api/enquiries/public').set(auth(ravi));
    assert.equal(pub.body.data.total, 1);
    assert.ok(pub.body.data.items.every((e) => e.id !== lead.id));

    // Visible in Asha's private list only
    const ashaPrivate = await request(app).get('/api/enquiries/private').set(auth(asha));
    assert.deepEqual(
      ashaPrivate.body.data.items.map((e) => e.id),
      [lead.id]
    );
    const raviPrivate = await request(app).get('/api/enquiries/private').set(auth(ravi));
    assert.equal(raviPrivate.body.data.total, 0);
  });

  it('does not let a second employee claim an already claimed lead', async () => {
    const asha = await registerEmployee('Asha', 'asha@fastor.com');
    const ravi = await registerEmployee('Ravi', 'ravi@fastor.com');
    const lead = await submitEnquiry();

    assert.equal((await request(app).patch(`/api/enquiries/${lead.id}/claim`).set(auth(asha))).status, 200);
    const second = await request(app).patch(`/api/enquiries/${lead.id}/claim`).set(auth(ravi));
    assert.equal(second.status, 409);

    const again = await request(app).patch(`/api/enquiries/${lead.id}/claim`).set(auth(asha));
    assert.equal(again.status, 409);
  });

  it('allows only one winner when two employees claim at the same time', async () => {
    const asha = await registerEmployee('Asha', 'asha@fastor.com');
    const ravi = await registerEmployee('Ravi', 'ravi@fastor.com');
    const lead = await submitEnquiry();

    const results = await Promise.all([
      request(app).patch(`/api/enquiries/${lead.id}/claim`).set(auth(asha)),
      request(app).patch(`/api/enquiries/${lead.id}/claim`).set(auth(ravi)),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  });

  it('returns 400 for an invalid id and 404 for an unknown lead', async () => {
    const token = await registerEmployee('Asha', 'asha@fastor.com');
    assert.equal((await request(app).patch('/api/enquiries/123/claim').set(auth(token))).status, 400);
    const unknown = new mongoose.Types.ObjectId().toString();
    assert.equal((await request(app).patch(`/api/enquiries/${unknown}/claim`).set(auth(token))).status, 404);
  });
});
