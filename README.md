# API Gateway

The single entry point for all client-facing traffic in the Airline Booking microservices system. It routes requests to the correct downstream service, enforces authentication on protected routes, applies rate limiting, and logs every incoming request.

---

## Architecture Overview

```
CLIENT
  |
  v
API GATEWAY (Port 3005)
  |
  |-- /authservice/*  ──────────────────>  AuthService     (Port 7000)
  |-- /flightservice/* ────────────────>  FlightsandSearch (Port 3000)
  |-- /bookingservice/* ──[auth check]──>  BookingService   (Port 5000)
                              |
                              v
                        AuthService (token validation)
```

The gateway never processes business logic. Its sole responsibilities are:
- **Routing** — forward requests to the right service
- **Authentication** — validate JWTs before forwarding booking requests
- **Rate Limiting** — cap requests per IP per minute
- **Logging** — log every request with Morgan

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Node.js + Express 5.2.1 | Server runtime and framework |
| http-proxy-middleware 3.0.5 | Transparent HTTP proxy/routing |
| axios 1.13.2 | HTTP client for auth token validation |
| express-rate-limit 8.2.1 | Per-IP rate limiting |
| morgan 1.10.1 | HTTP request logger |
| pm2 6.0.14 | Process manager for production |
| nodemon 3.1.11 | Auto-restart in development |

---

## Server Configuration

| Setting | Value |
|---|---|
| Port | 3005 |
| Trust Proxy | 1 (for correct IP behind load balancer) |

---

## Proxy Routes

### `GET /home` — Health Check
- **Auth required:** No
- **Response:** `{ message: "OK" }`
- **Purpose:** Confirms the gateway is alive.

---

### `/authservice/*` — Auth Service Proxy
- **Proxied to:** `http://localhost:7000`
- **Auth required:** No
- **Methods:** All (POST for signup/signin, GET for token validation)
- **What happens:** Request is forwarded as-is to AuthService. No transformation.

---

### `/flightservice/*` — Flights & Search Proxy
- **Proxied to:** `http://localhost:3000`
- **Auth required:** No
- **Methods:** All (GET for search, POST/PATCH/DELETE for admin flight management)
- **What happens:** Request is forwarded as-is to FlightsandSearch service.

---

### `/bookingservice/*` — Booking Service Proxy (Protected)
- **Proxied to:** `http://localhost:5000`
- **Auth required:** YES — `x-access-token` header mandatory
- **Methods:** All
- **What happens:**
  1. Gateway intercepts the request before forwarding.
  2. Reads the `x-access-token` header from the incoming request.
  3. Sends a GET request to `http://localhost:7000/authservice/api/v1/isauthenticated` with the token.
  4. If AuthService responds with success → request is forwarded to BookingService.
  5. If token is missing, invalid, or AuthService is unreachable → gateway returns `401 Unauthorized`.

---

## Middleware Pipeline

### 1. Morgan Logger
Applied globally. Logs every request in standard format to stdout. Runs before all routes.

### 2. Rate Limiter
Applied globally to all routes.

| Setting | Value |
|---|---|
| Window | 1 minute |
| Max requests | 1000 per IP |
| Response on limit | `429 Too Many Requests` |

Configured with `trust proxy: 1` so the real client IP is used (not the load balancer's IP).

### 3. Authentication Middleware (Booking routes only)
Custom middleware that runs before the `/bookingservice/*` proxy.

**Flow:**
```
Request arrives at /bookingservice/*
  |
  v
Read x-access-token from headers
  |
  +--> Missing?  --> 401 { message: "Missing auth token" }
  |
  v
POST to AuthService /isauthenticated with token
  |
  +--> Invalid?  --> 401 { message: "Unauthorized" }
  +--> Error?    --> 401 { message: "Unauthorized" }
  |
  v
Forward request to BookingService
```

---

## Authentication Token Flow (Detailed)

```
Client
  | 1. Sends POST /bookingservice/api/v1/bookings
  |    Headers: { x-access-token: "eyJhbGci..." }
  v
API Gateway
  | 2. Intercepts request, reads token from header
  | 3. Calls AuthService: GET /authservice/api/v1/isauthenticated
  |    Headers: { x-access-token: "eyJhbGci..." }
  v
AuthService
  | 4. Decodes JWT, verifies signature, checks expiry
  | 5. Returns: { success: true, data: userId }
  v
API Gateway
  | 6. Receives success response
  | 7. Forwards original request to BookingService
  v
BookingService
  | 8. Processes booking request
  v
API Gateway
  | 9. Returns BookingService response to client
  v
Client
```

---

## Rate Limiting Behavior

All routes are rate-limited. If a client exceeds 1000 requests per minute:
- Gateway returns HTTP `429 Too Many Requests`
- The downstream service never receives the request

---

## Environment Variables

No `.env` file is required. All downstream service URLs are hardcoded to localhost in development.

---

## Running the Service

```bash
# Install dependencies
npm install

# Development (auto-restart)
npx nodemon index.js

# Production (with pm2 process manager)
npx pm2 start index.js
```

---

## Project Structure

```
API_gateway/
├── index.js          # Entry point — all routes, middleware, and proxy setup
├── package.json      # Dependencies and scripts
└── node_modules/
```

---

## Error Responses

| Scenario | HTTP Code | Response |
|---|---|---|
| Missing x-access-token on /bookingservice | 401 | `{ message: "Missing auth token" }` |
| Invalid / expired token | 401 | `{ message: "Unauthorized" }` |
| AuthService unreachable | 401 | `{ message: "Unauthorized" }` |
| Rate limit exceeded | 429 | Default express-rate-limit message |

---

## Inter-Service Communication

| Calls | Direction | Purpose |
|---|---|---|
| API Gateway → AuthService | HTTP GET | Validate x-access-token before forwarding booking requests |

The gateway itself does not have a database and holds no state.
