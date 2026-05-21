const fs = require('fs');
const path = require('path');

class Store {
  constructor(filePath) {
    this.filePath = path.resolve(filePath || './mockpulse.json');
    this.routes = [];
    this.runtimeStates = {}; // Holds in-memory mutable states for stateful mocks
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        const config = JSON.parse(data);
        this.routes = config.routes || [];
      } else {
        this.routes = this.getDefaultRoutes();
        this.save();
      }
    } catch (error) {
      console.error(`[MockPulse] Error loading configuration file: ${error.message}`);
      this.routes = this.getDefaultRoutes();
    }
    
    // Initialize in-memory states
    this.resetAllStates();
  }

  save() {
    try {
      const data = JSON.stringify({ routes: this.routes }, null, 2);
      fs.writeFileSync(this.filePath, data, 'utf8');
    } catch (error) {
      console.error(`[MockPulse] Error saving configuration file: ${error.message}`);
    }
  }

  getDefaultRoutes() {
    return [
      {
        id: "default-users-get",
        path: "/api/users",
        method: "GET",
        status: 200,
        latency: 0,
        isStateful: true,
        response: [
          { "id": "1", "name": "Ada Lovelace", "email": "ada@computing.org", "role": "Founder" },
          { "id": "2", "name": "Alan Turing", "email": "alan@enigma.gov", "role": "Architect" },
          { "id": "3", "name": "Grace Hopper", "email": "grace@compiler.net", "role": "Compiler Pioneer" }
        ]
      },
      {
        id: "default-users-post",
        path: "/api/users",
        method: "POST",
        status: 201,
        latency: 300,
        isStateful: true,
        response: { "status": "success", "message": "User created" }
      },
      {
        id: "default-users-delete",
        path: "/api/users/:id",
        method: "DELETE",
        status: 200,
        latency: 100,
        isStateful: true,
        response: { "status": "success", "message": "User deleted" }
      },
      {
        id: "default-delayed-get",
        path: "/api/delayed",
        method: "GET",
        status: 200,
        latency: 1500,
        isStateful: false,
        response: {
          "message": "Sorry for the delay! This endpoint simulates a slow connection.",
          "delayMs": 1500
        }
      },
      {
        id: "default-error-get",
        path: "/api/error",
        method: "GET",
        status: 500,
        latency: 0,
        isStateful: false,
        response: {
          "error": "Internal Server Error",
          "message": "This endpoint is pre-configured to simulate a server crash."
        }
      }
    ];
  }

  getRoutes() {
    return this.routes;
  }

  getRouteById(id) {
    return this.routes.find(r => r.id === id);
  }

  addRoute(route) {
    const newRoute = {
      id: route.id || Math.random().toString(36).substring(2, 9),
      path: route.path,
      method: route.method.toUpperCase(),
      status: parseInt(route.status, 10) || 200,
      latency: parseInt(route.latency, 10) || 0,
      isStateful: !!route.isStateful,
      response: route.response
    };
    this.routes.push(newRoute);
    this.resetState(newRoute.id);
    this.save();
    return newRoute;
  }

  updateRoute(id, updatedData) {
    const index = this.routes.findIndex(r => r.id === id);
    if (index !== -1) {
      this.routes[index] = {
        ...this.routes[index],
        path: updatedData.path,
        method: updatedData.method.toUpperCase(),
        status: parseInt(updatedData.status, 10) || 200,
        latency: parseInt(updatedData.latency, 10) || 0,
        isStateful: !!updatedData.isStateful,
        response: updatedData.response
      };
      this.resetState(id);
      this.save();
      return this.routes[index];
    }
    return null;
  }

  deleteRoute(id) {
    const index = this.routes.findIndex(r => r.id === id);
    if (index !== -1) {
      const deleted = this.routes.splice(index, 1)[0];
      delete this.runtimeStates[id];
      this.save();
      return deleted;
    }
    return null;
  }

  // --- Runtime State Management for Stateful Mocks ---

  resetState(id) {
    const route = this.getRouteById(id);
    if (route) {
      // Deep copy the original response to serve as the initial state
      this.runtimeStates[id] = JSON.parse(JSON.stringify(route.response));
    }
  }

  resetAllStates() {
    this.runtimeStates = {};
    for (const route of this.routes) {
      this.resetState(route.id);
    }
  }

  getRuntimeState(id) {
    if (!(id in this.runtimeStates)) {
      this.resetState(id);
    }
    return this.runtimeStates[id];
  }

  setRuntimeState(id, newState) {
    this.runtimeStates[id] = newState;
  }
}

module.exports = Store;
