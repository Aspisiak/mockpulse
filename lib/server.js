const express = require('express');
const cors = require('cors');
const path = require('path');

function matchPath(routePath, requestPath) {
  // Convert /api/users/:id to regex and extract param names
  const paramNames = [];
  const cleanRoutePath = routePath.replace(/\/$/, ''); // Remove trailing slash
  const cleanRequestPath = requestPath.replace(/\/$/, '');

  const regexPath = cleanRoutePath.replace(/:([a-zA-Z0-9_]+)/g, (match, paramName) => {
    paramNames.push(paramName);
    return '([^/]+)';
  });

  const regex = new RegExp(`^${regexPath}$`);
  const match = cleanRequestPath.match(regex);
  if (!match) return null;

  const params = {};
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1];
  });
  return params;
}

function createServer(store, port) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // SSE client pool for live logs
  let sseClients = [];

  const broadcastLog = (logData) => {
    const dataString = `data: ${JSON.stringify(logData)}\n\n`;
    sseClients.forEach(client => client.write(dataString));
  };

  // Serve Dashboard Static Files
  app.use('/_dashboard', express.static(path.join(__dirname, '../public')));

  // Redirect /dashboard and /_dashboard to /_dashboard/
  app.get('/dashboard', (req, res) => res.redirect('/_dashboard/'));
  app.get('/_dashboard', (req, res) => res.redirect('/_dashboard/'));

  // SSE Stream Endpoint
  app.get('/_logs', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', clientCount: sseClients.length })}\n\n`);

    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
  });

  // --- Dashboard Manager API ---

  // Get active client stats
  app.get('/_api/status', (req, res) => {
    res.json({
      status: 'running',
      port,
      activeClients: sseClients.length,
      routeCount: store.getRoutes().length
    });
  });

  // Get all routes
  app.get('/_api/routes', (req, res) => {
    res.json(store.getRoutes());
  });

  // Create a new route
  app.post('/_api/routes', (req, res) => {
    try {
      const newRoute = store.addRoute(req.body);
      res.status(201).json(newRoute);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a route
  app.put('/_api/routes/:id', (req, res) => {
    try {
      const updated = store.updateRoute(req.params.id, req.body);
      if (updated) {
        res.json(updated);
      } else {
        res.status(404).json({ error: 'Route not found' });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete a route
  app.delete('/_api/routes/:id', (req, res) => {
    const deleted = store.deleteRoute(req.params.id);
    if (deleted) {
      res.json(deleted);
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  });

  // Reset runtime states
  app.post('/_api/reset', (req, res) => {
    store.resetAllStates();
    res.json({ message: 'Runtime states reset successfully' });
  });

  // --- Wildcard Mock Router Engine ---

  app.all('*', (req, res, next) => {
    // Skip internal dashboard routes
    if (req.path.startsWith('/_dashboard') || req.path.startsWith('/_api') || req.path.startsWith('/_logs')) {
      return next();
    }

    const start = Date.now();
    const routes = store.getRoutes();

    // Find first route that matches path pattern and HTTP method
    let matchedRoute = null;
    let pathParams = {};

    for (const route of routes) {
      if (route.method === req.method) {
        const params = matchPath(route.path, req.path);
        if (params) {
          matchedRoute = route;
          pathParams = params;
          break;
        }
      }
    }

    // 404 - Not Found handler
    if (!matchedRoute) {
      const duration = Date.now() - start;
      const responseBody = {
        error: 'Not Found',
        message: `No mock route matched for ${req.method} ${req.path}`
      };
      
      broadcastLog({
        time: new Date().toISOString(),
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body,
        status: 404,
        response: responseBody,
        duration,
        matchedRoute: null
      });

      return res.status(404).json(responseBody);
    }

    // Process Response
    let responseBody = matchedRoute.response;

    if (matchedRoute.isStateful) {
      const routeId = matchedRoute.id;

      if (req.method === 'GET') {
        // Return runtime state
        responseBody = store.getRuntimeState(routeId);
      } else if (req.method === 'POST') {
        // Find matching GET route to mutate its state
        const getRoute = routes.find(r => r.method === 'GET' && r.path === matchedRoute.path);
        if (getRoute) {
          const currentState = store.getRuntimeState(getRoute.id);
          if (Array.isArray(currentState)) {
            // Append item with ID
            const newItem = {
              id: req.body.id || Math.random().toString(36).substring(2, 9),
              ...req.body
            };
            currentState.push(newItem);
            store.setRuntimeState(getRoute.id, currentState);
            
            // If the POST mock response is empty or standard success, return the newly created item
            if (!responseBody || (typeof responseBody === 'object' && Object.keys(responseBody).length === 2 && responseBody.status === 'success')) {
              responseBody = newItem;
            }
          }
        }
      } else if (req.method === 'DELETE') {
        // Find parent GET route (e.g., if DELETE is /api/users/:id, check /api/users or match /api/users/:id path pattern)
        const parentPath = matchedRoute.path.replace(/\/:[a-zA-Z0-9_]+$/, ''); // Strip /:id
        const getRoute = routes.find(r => r.method === 'GET' && (r.path === parentPath || r.path === matchedRoute.path));
        
        if (getRoute) {
          const currentState = store.getRuntimeState(getRoute.id);
          if (Array.isArray(currentState) && pathParams.id) {
            const updatedState = currentState.filter(item => String(item.id) !== String(pathParams.id));
            store.setRuntimeState(getRoute.id, updatedState);
          }
        }
      } else if (req.method === 'PUT' || req.method === 'PATCH') {
        const parentPath = matchedRoute.path.replace(/\/:[a-zA-Z0-9_]+$/, '');
        const getRoute = routes.find(r => r.method === 'GET' && (r.path === parentPath || r.path === matchedRoute.path));
        
        if (getRoute) {
          const currentState = store.getRuntimeState(getRoute.id);
          if (Array.isArray(currentState) && pathParams.id) {
            const index = currentState.findIndex(item => String(item.id) === String(pathParams.id));
            if (index !== -1) {
              currentState[index] = {
                ...currentState[index],
                ...req.body,
                id: currentState[index].id // Retain original ID
              };
              store.setRuntimeState(getRoute.id, currentState);
              responseBody = currentState[index];
            }
          }
        }
      }
    }

    // Delay response if latency is set
    setTimeout(() => {
      res.status(matchedRoute.status).json(responseBody);

      const duration = Date.now() - start;
      broadcastLog({
        time: new Date().toISOString(),
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body,
        status: matchedRoute.status,
        response: responseBody,
        duration,
        matchedRoute: matchedRoute.path
      });
    }, matchedRoute.latency || 0);
  });

  return app;
}

module.exports = { createServer };
