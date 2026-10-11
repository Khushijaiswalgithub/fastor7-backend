# Fastor CRM – Backend (REST API)

A REST API for a small CRM. Employees/counselors have accounts, prospective students fill a public enquiry form, and counselors **claim** enquiries. A claimed enquiry becomes private to that counselor.

**Stack:** Node.js · Express · MongoDB (Mongoose) · JWT · bcrypt · zod (validation)

## Quick start

```bash
npm install
npm run dev        # http://localhost:5000
```

No database setup is needed to try it. If `MONGO_URI` is empty, the server starts a **temporary in-memory MongoDB**, and its data is lost on restart.

To use a real database, copy `.env.example` to `.env` and set:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/crm   # e.g. MongoDB Atlas (free tier)
JWT_SECRET=<a long random string>
```

Run the tests (each run uses its own in-memory database):

```bash
npm test
```

## How it works

| Concept | Implementation |
|---|---|
| CRM account per employee, identified by email | `Employee` model, unique email, bcrypt-hashed password |
| Public enquiry form | `POST /api/enquiries/public`, **no authentication** |
| Public enquiries (visible to all employees) | Enquiries with `claimedBy: null` |
| Claim → private enquiry | `claimedBy` is set to the employee's id. The lead then disappears from the public list and shows only in that employee's private list |
| No double claims | The claim is one atomic update (`findOneAndUpdate` on `{ _id, claimedBy: null }`), so if two counselors claim at the same moment, exactly one succeeds and the other gets `409` |

## API

Base URL: `http://localhost:5000/api`. Protected routes need the header `Authorization: Bearer <token>`.

| # | Method | Endpoint | Auth | Description |
|---|---|---|---|---|
| 1 | POST | `/auth/register` | – | Register an employee |
| 2 | POST | `/auth/login` | – | Log in, returns a JWT |
| 3 | GET | `/auth/me` | ✔ | The logged-in employee |
| 4 | POST | `/enquiries/public` | – | **Public form:** submit an enquiry |
| 5 | GET | `/enquiries/public` | ✔ | Unclaimed leads |
| 6 | PATCH | `/enquiries/:id/claim` | ✔ | Claim a lead |
| 7 | GET | `/enquiries/private` | ✔ | Leads claimed by the logged-in employee |

### 1. Register: `POST /api/auth/register`
```json
{ "name": "Asha", "email": "asha@fastor.com", "password": "secret123" }
```
`201` → `{ "success": true, "data": { "token": "<jwt>", "employee": { "id", "name", "email", ... } } }`
Errors: `400` validation, `409` email already registered.

### 2. Login: `POST /api/auth/login`
```json
{ "email": "asha@fastor.com", "password": "secret123" }
```
`200` → `{ "success": true, "data": { "token": "<jwt>", "employee": { ... } } }`
Errors: `401` invalid email or password.

### 4. Public enquiry form: `POST /api/enquiries/public` (no auth)
```json
{
  "name": "Riya Sharma",
  "email": "riya@example.com",
  "phone": "+91 98765 43210",
  "courseInterest": "Full Stack Web Development",
  "message": "Weekend batch?",
  "source": "online"
}
```
`phone`, `message` and `source` are optional. `source` is `"online"` (form circulated online, the default) or `"counselor"` (shared by a counselor after a call).
`201` → `{ "success": true, "message": "Enquiry submitted successfully", "data": { "enquiry": { ..., "claimedBy": null } } }`

### 5. Unclaimed leads: `GET /api/enquiries/public?page=1&limit=20`
`200` → `{ "success": true, "data": { "items": [ ... ], "page": 1, "limit": 20, "total": 2, "totalPages": 1 } }`

### 6. Claim a lead: `PATCH /api/enquiries/:id/claim`
`200` → `{ "success": true, "message": "Enquiry claimed successfully", "data": { "enquiry": { ..., "claimedBy": "<employeeId>", "claimedAt": "..." } } }`
Errors: `400` invalid id, `404` not found, `409` already claimed (by you or by another counselor).

### 7. My leads: `GET /api/enquiries/private?page=1&limit=20`
Same shape as #5, containing only the leads claimed by the logged-in employee.

### Error format
```json
{ "success": false, "message": "Validation failed", "errors": [{ "field": "email", "message": "Invalid email" }] }
```

## Postman

Import `Fastor-CRM.postman_collection.json`. **Login** and **Register** save the token automatically, and **Submit enquiry** saves the enquiry id that **Claim** uses.

## Project structure

```
src/
  config/        env.js (settings), db.js (MongoDB connection)
  models/        Employee.js, Enquiry.js
  middleware/    auth.js (JWT), validate.js (zod), errorHandler.js
  controllers/   authController.js, enquiryController.js
  routes/        authRoutes.js, enquiryRoutes.js
  app.js         Express app
  server.js      starts the server
tests/api.test.js  12 API tests (node:test + supertest + in-memory MongoDB)
```
