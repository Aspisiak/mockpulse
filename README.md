# ⚡ MockPulse

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![GitHub Stars](https://img.shields.io/github/stars/Aspisiak/mockpulse.svg?style=social&label=Star)](https://github.com/Aspisiak/mockpulse)

> **Turn your mock API schema into a stateful server with a premium real-time monitoring dashboard using a single command.**

MockPulse is a zero-configuration local API mocking server with a built-in, beautiful dark-themed developer dashboard. It runs instantly, records incoming traffic, simulates network latency, and supports dynamic, stateful in-memory CRUD operations.

```
           ┌────────────────────────┐
           │     npx mockpulse      │
           └───────────┬────────────┘
                       │ (boots local server)
                       ▼
         ┌─────────────┴─────────────┐
         │  Express Server (:3000)   │
         └─────┬───────────────┬─────┘
               │               │
  (Serves Mocks)               │ (Streams Live Traffic Logs via SSE)
               ▼               ▼
        ┌─────────────┐  ┌─────────────┐
        │   Your App  │  │  Dashboard  │
        │ (React/iOS) │  │ /_dashboard │
        └─────────────┘  └─────────────┘
```

---

## ✨ Features

* ⚡ **Zero-Config Startup:** Run a single CLI command to start mocking immediately.
* 🖥️ **Premium Dev Dashboard:** Inspect incoming HTTP requests (headers, queries, request bodies, durations) in a gorgeous glassmorphic real-time interface.
* 🔄 **Stateful CRUD Simulation:** GET requests return live records. POSTs append objects, PUTs/PATCHs merge modifications, and DELETEs remove records in-memory automatically.
* ⏱️ **Latency & Network Simulator:** Configure millisecond delays per endpoint to test spinners, loaders, and timeout boundaries.
* 💾 **Declarative Persistence:** Mocks are stored in a simple, readable `mockpulse.json` file in your project directory. Keep it in git to share mocks with your team!

---

## 🚀 Quick Start (60 Seconds)

### 1. Run the Server
No installation required. Run the command below in your project folder:

```bash
npx @artur/mockpulse
```

* **Mock API Server:** `http://localhost:3000`
* **Developer Dashboard:** `http://localhost:3000/_dashboard/` (Opens automatically)

### 2. Make an API Call
Open another terminal and send a request to the default user list:

```bash
curl http://localhost:3000/api/users
```

### 3. Add a New Mock Route
Click **"Add Route"** on the dashboard, fill in your path (e.g. `/api/orders`), set status/latency, paste your JSON response body, and click **"Save Endpoint"**. The route is active immediately!

---

## 🔄 Stateful Mocking Example

MockPulse automatically mutates states of arrays.

1. **GET list:**
   ```bash
   curl http://localhost:3000/api/users
   # Returns: [{ "id": "1", "name": "Ada Lovelace" }, ...]
   ```

2. **POST new item:**
   ```bash
   curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d '{"name": "Grace Hopper", "role": "Pioneer"}'
   # Returns: { "id": "generated_uuid", "name": "Grace Hopper", "role": "Pioneer" }
   ```

3. **GET list again:**
   ```bash
   curl http://localhost:3000/api/users
   # Returns: [{ "id": "1", "name": "Ada Lovelace" }, ..., { "id": "generated_uuid", "name": "Grace Hopper", "role": "Pioneer" }]
   ```

To reset the data back to its original state, click **"Reset State"** on the Dashboard.

---

## ⚙️ CLI Arguments

Customize the server directly from your terminal:

```bash
npx @artur/mockpulse --port 4500 --file ./custom-mocks.json
```

| Argument | Shorthand | Description | Default |
|:---|:---|:---|:---|
| `--port` | `-p` | Port number to run the server & dashboard on | `3000` |
| `--file` | `-f` | Path to store the mock definitions JSON file | `./mockpulse.json` |

---

## 🛠️ Local Development

If you want to contribute or build MockPulse locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/Aspisiak/mockpulse.git
   cd mockpulse
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## 📄 License

MIT License - Copyright (c) 2026.
