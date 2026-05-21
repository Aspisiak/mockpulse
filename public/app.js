// State Management
let routes = [];
let logs = [];
const MAX_LOGS = 50;

// DOM Elements
const serverStatusEl = document.getElementById('server-status');
const serverPortEl = document.getElementById('server-port');
const activeListenersEl = document.getElementById('active-listeners');
const routesListContainer = document.getElementById('routes-list-container');
const trafficFeedContainer = document.getElementById('traffic-feed-container');
const routeModal = document.getElementById('route-modal');
const modalTitle = document.getElementById('modal-title');
const routeForm = document.getElementById('route-form');
const jsonValidationError = document.getElementById('json-validation-error');
const toastNotification = document.getElementById('toast-notification');

// Form Inputs
const formRouteId = document.getElementById('form-route-id');
const formMethod = document.getElementById('form-method');
const formPath = document.getElementById('form-path');
const formStatus = document.getElementById('form-status');
const formLatency = document.getElementById('form-latency');
const formStateful = document.getElementById('form-stateful');
const formResponse = document.getElementById('form-response');

// Button Triggers
const btnAddRoute = document.getElementById('btn-add-route');
const btnResetState = document.getElementById('btn-reset-state');
const btnClearLogs = document.getElementById('btn-clear-logs');
const btnFormatJson = document.getElementById('btn-format-json');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
  fetchStatus();
  fetchRoutes();
  setupSSE();
  setupEventListeners();
});

// Toast System
function showToast(message, type = 'success') {
  toastNotification.textContent = message;
  toastNotification.className = `toast active ${type}`;
  
  setTimeout(() => {
    toastNotification.classList.remove('active');
  }, 4000);
}

// Format JSON Response
btnFormatJson.addEventListener('click', () => {
  try {
    const rawVal = formResponse.value.trim();
    if (!rawVal) return;
    const parsed = JSON.parse(rawVal);
    formResponse.value = JSON.stringify(parsed, null, 2);
    jsonValidationError.classList.remove('active');
  } catch (e) {
    jsonValidationError.classList.add('active');
  }
});

// Fetch Server Status
async function fetchStatus() {
  try {
    const res = await fetch('/_api/status');
    const status = await res.json();
    serverStatusEl.textContent = 'Active';
    serverStatusEl.parentElement.querySelector('.stat-dot').className = 'stat-dot pulsing';
    serverPortEl.textContent = status.port;
    activeListenersEl.textContent = status.activeClients;
  } catch (error) {
    serverStatusEl.textContent = 'Disconnected';
    serverStatusEl.parentElement.querySelector('.stat-dot').className = 'stat-dot';
    showToast('Failed to connect to MockPulse API server', 'error');
  }
}

// Fetch All Routes
async function fetchRoutes() {
  try {
    const res = await fetch('/_api/routes');
    routes = await res.json();
    renderRoutes();
  } catch (error) {
    routesListContainer.innerHTML = `<div class="loading-state">Error fetching mock definitions. Check connection.</div>`;
  }
}

// Render Routes list
function renderRoutes() {
  if (routes.length === 0) {
    routesListContainer.innerHTML = `
      <div class="loading-state">
        <p>No endpoints configured.</p>
        <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
          Click "Add Route" to define your first API mock.
        </span>
      </div>
    `;
    return;
  }

  routesListContainer.innerHTML = '';
  routes.forEach(route => {
    const card = document.createElement('div');
    card.className = 'route-card';

    const methodLower = route.method.toLowerCase();
    const statusClass = route.status >= 400 ? 'status-4xx' : (route.status >= 200 && route.status < 300 ? 'status-2xx' : '');

    card.innerHTML = `
      <div class="route-meta-group">
        <span class="method-badge ${methodLower}">${route.method}</span>
        <div class="route-info">
          <div class="route-path" title="${route.path}">${route.path}</div>
          <div class="route-badges">
            <span class="pill-badge ${statusClass}">HTTP ${route.status}</span>
            ${route.isStateful ? '<span class="pill-badge stateful">Stateful</span>' : ''}
            ${route.latency > 0 ? `<span class="pill-badge latency">${route.latency}ms</span>` : ''}
          </div>
        </div>
      </div>
      <div class="route-card-actions">
        <button class="btn-icon-only edit-route-btn" data-id="${route.id}" title="Edit Endpoint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path></svg>
        </button>
        <button class="btn-icon-only danger delete-route-btn" data-id="${route.id}" title="Delete Endpoint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;

    // Attach Event Listeners to Card buttons
    card.querySelector('.edit-route-btn').addEventListener('click', () => openModal(route.id));
    card.querySelector('.delete-route-btn').addEventListener('click', () => deleteRoute(route.id));

    routesListContainer.appendChild(card);
  });
}

// Setup EventSource (SSE) for Real-Time Request stream
function setupSSE() {
  const eventSource = new EventSource('/_logs');

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'connected') {
      activeListenersEl.textContent = data.clientCount;
      return;
    }

    addTrafficLog(data);
    fetchStatus(); // Refresh active sse stats
  };

  eventSource.onerror = () => {
    eventSource.close();
    setTimeout(setupSSE, 5000); // Reconnect loop
  };
}

// Add Traffic Log card
function addTrafficLog(log) {
  logs.unshift(log);
  if (logs.length > MAX_LOGS) {
    logs.pop();
  }

  renderTrafficLogs();
}

// Render traffic feed
function renderTrafficLogs() {
  const container = trafficFeedContainer;
  
  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-traffic-state">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
        </div>
        <p>Waiting for incoming HTTP requests...</p>
        <span class="subtext">Make a request to any port path to see it streamed live.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  logs.forEach((log, index) => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const statusClass = log.status >= 400 ? 'status-4xx' : (log.status >= 200 && log.status < 300 ? 'status-2xx' : '');
    const statusBadgeClass = log.status >= 500 ? 's5xx' : (log.status >= 400 ? 's4xx' : (log.status >= 300 ? 's3xx' : 's2xx'));
    const methodLower = log.method.toLowerCase();
    
    // Parse time
    const timestamp = new Date(log.time).toLocaleTimeString();
    
    // Check if body and response are empty/objects
    const formattedHeaders = JSON.stringify(log.headers, null, 2);
    const formattedBody = log.body && Object.keys(log.body).length > 0 ? JSON.stringify(log.body, null, 2) : '';
    const formattedResponse = typeof log.response === 'object' ? JSON.stringify(log.response, null, 2) : String(log.response);

    entry.innerHTML = `
      <div class="log-header" onclick="this.parentElement.classList.toggle('expanded')">
        <div class="log-meta-group">
          <span class="method-badge ${methodLower}">${log.method}</span>
          <div class="log-path" title="${log.path}">${log.path}</div>
          <span class="log-timestamp">${timestamp}</span>
        </div>
        <div class="log-metrics">
          <span class="log-status-badge ${statusBadgeClass}">${log.status}</span>
          <span class="log-duration">${log.duration}ms</span>
          <svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>
      <div class="log-body">
        <div class="log-details-grid">
          <div class="log-block">
            <div class="log-block-title">Request Headers</div>
            <pre class="log-body-content">${formattedHeaders}</pre>
          </div>
          <div class="log-block">
            <div class="log-block-title">Payload (Body)</div>
            ${formattedBody ? `<pre class="log-body-content">${formattedBody}</pre>` : `<div class="log-body-content empty">No payload sent</div>`}
          </div>
        </div>
        <div class="log-block" style="margin-top: 1rem;">
          <div class="log-block-title">Response JSON</div>
          <pre class="log-body-content" style="color: #60a5fa;">${formattedResponse}</pre>
        </div>
      </div>
    `;

    container.appendChild(entry);
  });
}

// Modal management
function openModal(routeId = null) {
  routeModal.classList.add('active');
  jsonValidationError.classList.remove('active');
  
  if (routeId) {
    modalTitle.textContent = 'Edit Mock Endpoint';
    const route = routes.find(r => r.id === routeId);
    
    formRouteId.value = route.id;
    formMethod.value = route.method;
    formPath.value = route.path;
    formStatus.value = route.status;
    formLatency.value = route.latency;
    formStateful.checked = route.isStateful;
    formResponse.value = JSON.stringify(route.response, null, 2);
  } else {
    modalTitle.textContent = 'Create Mock Endpoint';
    formRouteId.value = '';
    formMethod.value = 'GET';
    formPath.value = '/api/';
    formStatus.value = 200;
    formLatency.value = 0;
    formStateful.checked = true;
    formResponse.value = '{\n  "status": "success",\n  "data": {}\n}';
  }
}

function closeModal() {
  routeModal.classList.remove('active');
  routeForm.reset();
}

// Delete route API call
async function deleteRoute(id) {
  if (!confirm('Are you sure you want to delete this mock endpoint?')) return;
  
  try {
    const res = await fetch(`/_api/routes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Mock endpoint deleted successfully');
      fetchRoutes();
    } else {
      showToast('Failed to delete mock endpoint', 'error');
    }
  } catch (error) {
    showToast('Failed to connect to server', 'error');
  }
}

// Reset stateful values API call
async function resetStatefulDb() {
  try {
    const res = await fetch('/_api/reset', { method: 'POST' });
    if (res.ok) {
      showToast('In-memory stateful DB reset successfully');
      fetchRoutes();
    } else {
      showToast('Failed to reset states', 'error');
    }
  } catch (error) {
    showToast('Failed to connect to server', 'error');
  }
}

// Event Listeners setup
function setupEventListeners() {
  btnAddRoute.addEventListener('click', () => openModal());
  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);
  
  btnResetState.addEventListener('click', resetStatefulDb);
  btnClearLogs.addEventListener('click', () => {
    logs = [];
    renderTrafficLogs();
    showToast('Traffic logs cleared');
  });

  // Handle Form Submission
  routeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate JSON first
    let parsedResponse = null;
    try {
      parsedResponse = JSON.parse(formResponse.value.trim());
      jsonValidationError.classList.remove('active');
    } catch (err) {
      jsonValidationError.classList.add('active');
      return;
    }

    const payload = {
      path: formPath.value.trim(),
      method: formMethod.value,
      status: parseInt(formStatus.value, 10),
      latency: parseInt(formLatency.value, 10) || 0,
      isStateful: formStateful.checked,
      response: parsedResponse
    };

    const id = formRouteId.value;
    const url = id ? `/_api/routes/${id}` : '/_api/routes';
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(id ? 'Endpoint updated successfully' : 'Endpoint created successfully');
        closeModal();
        fetchRoutes();
      } else {
        const err = await res.json();
        showToast(`Error: ${err.error || 'Failed to save endpoint'}`, 'error');
      }
    } catch (error) {
      showToast('Network error saving endpoint', 'error');
    }
  });

  // Modal overlay close click
  routeModal.addEventListener('click', (e) => {
    if (e.target === routeModal) {
      closeModal();
    }
  });
}
