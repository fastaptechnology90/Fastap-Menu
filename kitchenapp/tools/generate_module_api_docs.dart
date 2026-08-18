import 'dart:io';

/// Generates one API doc file per module under docs/api/modules/.
void main() {
  final modules = _modules;
  final outDir = Directory('docs/api/modules');
  if (!outDir.existsSync()) {
    outDir.createSync(recursive: true);
  }

  for (final module in modules) {
    final file = File('${outDir.path}/${module.file}');
    file.writeAsStringSync(_render(module));
    stdout.writeln('Wrote ${file.path}');
  }

  final index = File('docs/api/MODULE_INDEX.md');
  index.writeAsStringSync(_renderIndex(modules));
  stdout.writeln('Wrote ${index.path}');

  stdout.writeln('\nGenerated ${modules.length} module API documents.');
}

String _renderIndex(List<_Module> modules) {
  final buffer = StringBuffer('''
# API Module Index

Implement your server **one module at a time**. Each file below is a self-contained spec.

**Base URL:** `{BASE_URL}/api/v1`  
**Full reference:** [API_REFERENCE.md](../API_REFERENCE.md)  
**Integration:** [INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md)

---

''');

  for (final module in modules) {
    buffer.writeln(
      '${module.number}. [${module.title}](modules/${module.file}) — '
      '${module.endpoints.length} endpoint(s) — '
      'Schema: `${module.schemaTest}`',
    );
  }

  return buffer.toString();
}

String _render(_Module module) {
  final buffer = StringBuffer('''
# ${module.number}. ${module.title}

**Module ID:** `${module.id}`  
**Schema test:** `test/${module.schemaTest}`  
**Flutter endpoints:** `lib/core/api/${module.endpointFile}`

---

## Overview

${module.description}

**Auth required:** ${module.authRequired ? 'Yes (Bearer token)' : 'No for login routes; Yes for session routes'}

---

## Endpoints

''');

  for (final endpoint in module.endpoints) {
    buffer.writeln('### ${endpoint.method} `${endpoint.path}`');
    buffer.writeln();
    if (endpoint.description.isNotEmpty) {
      buffer.writeln(endpoint.description);
      buffer.writeln();
    }
    if (endpoint.query.isNotEmpty) {
      buffer.writeln('**Query parameters:**');
      buffer.writeln();
      buffer.writeln('| Param | Description |');
      buffer.writeln('|-------|-------------|');
      for (final q in endpoint.query) {
        buffer.writeln('| `$q` | See global conventions |');
      }
      buffer.writeln();
    }
    if (endpoint.request != null) {
      buffer.writeln('**Request body:**');
      buffer.writeln();
      buffer.writeln('```json');
      buffer.writeln(endpoint.request);
      buffer.writeln('```');
      buffer.writeln();
    }
    buffer.writeln('**Response 200:**');
    buffer.writeln();
    buffer.writeln('```json');
    buffer.writeln(endpoint.response);
    buffer.writeln('```');
    buffer.writeln();
    if (endpoint.errors.isNotEmpty) {
      buffer.writeln('**Errors:** ${endpoint.errors}');
      buffer.writeln();
    }
    buffer.writeln('---');
    buffer.writeln();
  }

  buffer.writeln('''
## Implementation checklist

- [ ] Implement all GET board/load endpoints
- [ ] Implement all POST action endpoints
- [ ] Return `{ "success": true }` envelope
- [ ] Match field names exactly (camelCase)
- [ ] Validate response against `${module.schemaTest}`
- [ ] Test with curl before connecting the app

## Navigation

- [Module index](../MODULE_INDEX.md)
- [Full API reference](../../API_REFERENCE.md)
- [Step 3 guide](../../STEP3_API_DOCUMENTATION.md)
''');

  return buffer.toString();
}

class _Endpoint {
  const _Endpoint({
    required this.method,
    required this.path,
    required this.response,
    this.description = '',
    this.request,
    this.query = const [],
    this.errors = '',
  });

  final String method;
  final String path;
  final String description;
  final String? request;
  final List<String> query;
  final String response;
  final String errors;
}

class _Module {
  const _Module({
    required this.number,
    required this.file,
    required this.id,
    required this.title,
    required this.description,
    required this.endpointFile,
    required this.schemaTest,
    required this.endpoints,
    this.authRequired = true,
  });

  final String number;
  final String file;
  final String id;
  final String title;
  final String description;
  final String endpointFile;
  final String schemaTest;
  final List<_Endpoint> endpoints;
  final bool authRequired;
}

const _boardResponse = '''{
  "success": true,
  "data": { /* module snapshot — see schema test */ }
}''';

const _actionRequest = '''{
  "action": "approve"
}''';

const _actionResponse = '''{
  "success": true
}''';

const _orderActionResponse = '''{
  "success": true,
  "order": { /* updated order object */ }
}''';

const _sessionResponse = '''{
  "success": true,
  "data": {
    "token": "uuid",
    "user": {
      "id": "STF-001",
      "name": "Chef Arjun Mehta",
      "role": "headChef",
      "section": "Main",
      "phone": "+919876543210",
      "staffCode": "KCH-001"
    },
    "expiresAt": "2026-06-06T20:00:00.000Z",
    "deviceId": "device-001",
    "shiftId": "SHIFT-612",
    "permissions": ["kds.view", "order.accept"],
    "loginMethod": "password",
    "geoVerified": true
  }
}''';

final _modules = <_Module>[
  _Module(
    number: '01',
    file: '01-authentication.md',
    id: 'auth',
    title: 'Authentication & Session',
    description: 'Staff login (password, PIN, OTP, QR, biometric), session management, device binding, and logout.',
    endpointFile: 'auth_endpoints.dart',
    schemaTest: 'auth_session_test.dart',
    authRequired: false,
    endpoints: [
      _Endpoint(
        method: 'POST',
        path: '/auth/otp/request',
        description: 'Send OTP to registered mobile.',
        request: '{"phone": "+919876543210", "deviceId": "device-uuid"}',
        response: '{"success": true, "message": "OTP sent successfully", "expiresInSeconds": 300}',
        errors: '`404` mobile not registered',
      ),
      _Endpoint(
        method: 'POST',
        path: '/auth/otp/verify',
        description: 'Verify OTP and create session.',
        request: '{"phone": "+919876543210", "otp": "123456", "deviceId": "device-uuid"}',
        response: _sessionResponse,
        errors: '`401` invalid OTP',
      ),
      _Endpoint(
        method: 'POST',
        path: '/auth/pin',
        request: '{"staffCode": "KCH-001", "pin": "4521", "deviceId": "device-uuid"}',
        response: _sessionResponse,
      ),
      _Endpoint(
        method: 'POST',
        path: '/auth/password',
        request: '{"staffCode": "KCH-001", "password": "chef@123", "deviceId": "device-uuid"}',
        response: _sessionResponse,
      ),
      _Endpoint(
        method: 'POST',
        path: '/auth/qr/verify',
        request: '{"qrToken": "KCH-001", "deviceId": "device-uuid"}',
        response: _sessionResponse,
      ),
      _Endpoint(
        method: 'POST',
        path: '/auth/biometric',
        request: '{"staffCode": "KCH-001", "biometricType": "fingerprint", "deviceId": "device-uuid"}',
        response: _sessionResponse,
      ),
      _Endpoint(
        method: 'GET',
        path: '/auth/session',
        description: 'Validate/restore session. Auth required.',
        response: '{"success": true, "session": { /* session object */ }}',
        errors: '`401` session not found',
      ),
      _Endpoint(
        method: 'GET',
        path: '/auth/permissions',
        response: '{"success": true, "permissions": ["kds.view", "order.accept"]}',
      ),
      _Endpoint(
        method: 'GET',
        path: '/auth/shift/current',
        response: '{"success": true, "shift": {"id": "SHIFT-612", "startedAt": "...", "endsAt": "..."}}',
      ),
      _Endpoint(
        method: 'POST',
        path: '/auth/device/bind',
        request: '{"deviceId": "device-uuid"}',
        response: '{"success": true, "message": "Device bound successfully"}',
      ),
      _Endpoint(
        method: 'POST',
        path: '/auth/activity',
        request: '{"action": "kds.view", "deviceId": "device-uuid"}',
        response: '{"success": true, "lastActivityAt": "2026-06-06T12:30:00.000Z"}',
      ),
      _Endpoint(
        method: 'POST',
        path: '/auth/logout',
        response: '{"success": true}',
      ),
      _Endpoint(
        method: 'POST',
        path: '/auth/emergency-logout',
        response: '{"success": true, "message": "Emergency logout executed"}',
      ),
    ],
  ),
  _Module(
    number: '02',
    file: '02-dashboard.md',
    id: 'dashboard',
    title: 'Live Dashboard',
    description: 'Kitchen command center overview — widgets, metrics, workload, and active orders.',
    endpointFile: 'dashboard_endpoints.dart',
    schemaTest: 'dashboard_snapshot_test.dart',
    endpoints: [
      _Endpoint(method: 'GET', path: '/dashboard', query: ['section'], response: _boardResponse),
      _Endpoint(method: 'GET', path: '/dashboard/widgets', query: ['section'], response: '{"success": true, "widgets": [], "lastSyncedAt": "..."}'),
      _Endpoint(method: 'GET', path: '/dashboard/metrics', query: ['section'], response: '{"success": true, "metrics": [], "lastSyncedAt": "..."}'),
      _Endpoint(method: 'GET', path: '/dashboard/orders', query: ['section'], response: '{"success": true, "orders": []}'),
    ],
  ),
  _Module(
    number: '03',
    file: '03-kds.md',
    id: 'kds',
    title: 'Kitchen Display System (KDS)',
    description: 'Live order queue, section grouping, reorder, and order actions.',
    endpointFile: 'kds_endpoints.dart',
    schemaTest: 'kds_snapshot_test.dart',
    endpoints: [
      _Endpoint(
        method: 'GET',
        path: '/kds',
        query: ['section', 'view', 'filter'],
        description: '`view`: queue | section. `filter`: all | vip | priority | delayed.',
        response: _boardResponse,
      ),
      _Endpoint(
        method: 'POST',
        path: '/kds/reorder',
        request: '{"orderIds": ["ORD-001", "ORD-002"]}',
        response: _actionResponse,
      ),
      _Endpoint(
        method: 'POST',
        path: '/kds/orders/{orderId}/action',
        description: 'Actions: accept, prepare, ready, delay, reject, hold, refire, reassign, cancel_item, modify_item.',
        request: _actionRequest,
        response: _orderActionResponse,
      ),
    ],
  ),
  _Module(
    number: '04',
    file: '04-section-management.md',
    id: 'sections',
    title: 'Section Management',
    endpointFile: 'section_endpoints.dart',
    schemaTest: 'section_snapshot_test.dart',
    description: 'Section overview, routing, optimize, reroute, assign chef.',
    endpoints: [
      _Endpoint(method: 'GET', path: '/sections/overview', query: ['section', 'includeRouting'], response: _boardResponse),
      _Endpoint(method: 'POST', path: '/sections/optimize', response: '{"success": true, "message": "Queue optimized"}'),
      _Endpoint(method: 'POST', path: '/sections/orders/{orderId}/reroute', request: '{"section": "Tandoor"}', response: _actionResponse),
      _Endpoint(method: 'POST', path: '/sections/{sectionId}/assign-chef', request: '{"chefName": "Chef Name"}', response: _actionResponse),
    ],
  ),
  _Module(number: '05', file: '05-order-processing.md', id: 'processing', title: 'Order Processing', endpointFile: 'order_processing_endpoints.dart', schemaTest: 'processing_snapshot_test.dart', description: 'Order pipeline board and processing actions.', endpoints: [
    _Endpoint(method: 'GET', path: '/orders/processing', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/orders/processing/optimize', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/orders/{orderId}/process', request: _actionRequest, response: _orderActionResponse),
  ]),
  _Module(number: '06', file: '06-course-firing.md', id: 'firing', title: 'Course Firing', endpointFile: 'course_firing_endpoints.dart', schemaTest: 'course_firing_snapshot_test.dart', description: 'Multi-course pacing and firing sessions.', endpoints: [
    _Endpoint(method: 'GET', path: '/firing/sessions', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/firing/sync-pacing', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/firing/sessions/{sessionId}/action', request: '{"action": "fire", "courseType": "main"}', response: _actionResponse),
  ]),
  _Module(number: '07', file: '07-food-prep.md', id: 'prep', title: 'Food Prep', endpointFile: 'prep_endpoints.dart', schemaTest: 'prep_snapshot_test.dart', description: 'Prep task board and step actions.', endpoints: [
    _Endpoint(method: 'GET', path: '/prep/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/prep/tasks/{taskId}/action', request: '{"action": "complete_step", "stepIndex": 1}', response: _actionResponse),
  ]),
  _Module(number: '08', file: '08-modifiers.md', id: 'modifiers', title: 'Modifier Management', endpointFile: 'modifier_endpoints.dart', schemaTest: 'modifier_snapshot_test.dart', description: 'Order modifiers, allergies, substitutions.', endpoints: [
    _Endpoint(method: 'GET', path: '/modifiers/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/modifiers/orders/{orderId}/action', request: '{"action": "acknowledge", "modifierId": "MOD-001"}', response: _actionResponse),
  ]),
  _Module(number: '09', file: '09-chef-tasks.md', id: 'chef-tasks', title: 'Chef Task Management', endpointFile: 'chef_task_endpoints.dart', schemaTest: 'chef_task_snapshot_test.dart', description: 'Chef workload balancing and task assignment.', endpoints: [
    _Endpoint(method: 'GET', path: '/chef-tasks/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/chef-tasks/balance', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/chef-tasks/{taskId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '10', file: '10-allergy-safety.md', id: 'safety', title: 'Allergy & Safety', endpointFile: 'allergy_safety_endpoints.dart', schemaTest: 'allergy_safety_snapshot_test.dart', description: 'Allergy cases and safety protocols.', endpoints: [
    _Endpoint(method: 'GET', path: '/safety/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/safety/cases/{caseId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '11', file: '11-ai-assistant.md', id: 'ai', title: 'AI Kitchen Assistant', endpointFile: 'ai_assistant_endpoints.dart', schemaTest: 'ai_assistant_snapshot_test.dart', description: 'AI suggestions and voice commands.', endpoints: [
    _Endpoint(method: 'GET', path: '/ai/assistant', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/ai/assistant/apply', request: '{"suggestionId": "SUG-001"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/ai/voice', request: '{"command": "mark ready", "orderId": "ORD-001"}', response: _actionResponse),
  ]),
  _Module(number: '12', file: '12-order-priority.md', id: 'priority', title: 'Order Priority', endpointFile: 'order_priority_endpoints.dart', schemaTest: 'order_priority_snapshot_test.dart', description: 'VIP/priority queue management.', endpoints: [
    _Endpoint(method: 'GET', path: '/orders/priority', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/orders/priority/reprioritize', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/orders/{orderId}/priority', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '13', file: '13-kitchen-communication.md', id: 'comms', title: 'Kitchen Communication', endpointFile: 'kitchen_communication_endpoints.dart', schemaTest: 'kitchen_communication_snapshot_test.dart', description: 'Messages, announcements, broadcasts, delay updates.', endpoints: [
    _Endpoint(method: 'GET', path: '/kitchen/communication', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/kitchen/communication/message', request: '{"threadId": "T1", "message": "text", "sender": "Chef"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/kitchen/communication/voice-note', request: '{"threadId": "T1", "sender": "Chef"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/kitchen/communication/delay-update', request: '{"orderId": "ORD-1", "minutes": 5, "sender": "Chef"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/kitchen/communication/announcement', request: '{"title": "...", "body": "...", "author": "...", "scope": "All"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/kitchen/communication/broadcast', request: '{"message": "...", "author": "...", "scope": "All"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/kitchen/communication/alert-action', request: '{"alertId": "A1", "action": "ack"}', response: _actionResponse),
  ]),
  _Module(number: '14', file: '14-inventory.md', id: 'inventory', title: 'Inventory & Stock', endpointFile: 'inventory_endpoints.dart', schemaTest: 'inventory_snapshot_test.dart', description: 'Stock levels, deductions, substitutions.', endpoints: [
    _Endpoint(method: 'GET', path: '/inventory/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/inventory/sync', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/inventory/deduct', request: '{"itemId": "I1", "quantity": 2, "orderId": "ORD-1"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/inventory/validate', request: '{"orderId": "ORD-1"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/inventory/substitute', request: '{"itemId": "I1", "substituteId": "I2"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/inventory/alert-action', request: '{"alertId": "A1", "action": "ack"}', response: _actionResponse),
  ]),
  _Module(number: '15', file: '15-recipe-costing.md', id: 'recipes', title: 'Recipe Costing', endpointFile: 'recipe_costing_endpoints.dart', schemaTest: 'recipe_costing_snapshot_test.dart', description: 'Recipe costs, waste tracking, portion adjustments.', endpoints: [
    _Endpoint(method: 'GET', path: '/recipes/costing', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/recipes/costing/refresh', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/recipes/costing/waste', request: '{"recipeId": "R1", "plates": 2, "reason": " spoilage"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/recipes/{recipeId}/costing', request: '{"portion": "half"}', response: _actionResponse),
  ]),
  _Module(number: '16', file: '16-prep-stations.md', id: 'prep-stations', title: 'Prep Station Management', endpointFile: 'prep_station_endpoints.dart', schemaTest: 'prep_station_snapshot_test.dart', description: 'Station queues and staff assignment.', endpoints: [
    _Endpoint(method: 'GET', path: '/prep/stations', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/prep/stations/balance', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/prep/stations/{stationId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/prep/stations/{stationId}/assign', request: '{"staffName": "Chef Name"}', response: _actionResponse),
  ]),
  _Module(number: '17', file: '17-batch-cooking.md', id: 'batch', title: 'Batch Cooking', endpointFile: 'batch_cooking_endpoints.dart', schemaTest: 'batch_cooking_snapshot_test.dart', description: 'Batch forecasts and production runs.', endpoints: [
    _Endpoint(method: 'GET', path: '/batch/cooking', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/batch/cooking/forecast', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/batch/cooking/{batchId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '18', file: '18-delay-escalation.md', id: 'delays', title: 'Delay Escalation', endpointFile: 'delay_escalation_endpoints.dart', schemaTest: 'delay_escalation_snapshot_test.dart', description: 'Delay reasons and auto-escalation.', endpoints: [
    _Endpoint(method: 'GET', path: '/delays/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/delays/reason', request: '{"orderId": "ORD-1", "reason": "Backlog"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/delays/auto-escalate', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/delays/{orderId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '19', file: '19-quality-control.md', id: 'qc', title: 'Quality Control', endpointFile: 'quality_control_endpoints.dart', schemaTest: 'quality_control_snapshot_test.dart', description: 'QC checks, audits, complaints.', endpoints: [
    _Endpoint(method: 'GET', path: '/qc/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/qc/audit/random', request: '{"section": "Main"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/qc/complaints', request: '{"orderId": "ORD-1", "reason": "...", "severity": "medium"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/qc/checks/{checkId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/qc/orders/{orderId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '20', file: '20-customer-returns.md', id: 'returns', title: 'Customer Returns', endpointFile: 'customer_return_endpoints.dart', schemaTest: 'customer_return_snapshot_test.dart', description: 'Return/refire workflow.', endpoints: [
    _Endpoint(method: 'GET', path: '/returns/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/returns/create', request: '{"orderId": "ORD-1", "returnType": "refire", "reason": "..."}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/returns/{returnId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '21', file: '21-expeditor.md', id: 'expeditor', title: 'Expeditor Management', endpointFile: 'expeditor_endpoints.dart', schemaTest: 'expeditor_snapshot_test.dart', description: 'Table coordination and ticket management.', endpoints: [
    _Endpoint(method: 'GET', path: '/expeditor/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/expeditor/coordinate', request: '{"groupId": "G1"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/expeditor/sync-tables', request: '{"tableNumber": "12"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/expeditor/tickets/{ticketId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '22', file: '22-packing-delivery.md', id: 'packing', title: 'Packing & Delivery', endpointFile: 'packing_endpoints.dart', schemaTest: 'packing_delivery_snapshot_test.dart', description: 'Packing jobs and label printing.', endpoints: [
    _Endpoint(method: 'GET', path: '/packing/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/packing/labels/print', request: '{"jobId": "J1"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/packing/jobs/{jobId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '23', file: '23-delivery-aggregator.md', id: 'aggregator', title: 'Delivery Aggregator', endpointFile: 'delivery_aggregator_endpoints.dart', schemaTest: 'delivery_aggregator_snapshot_test.dart', description: 'Swiggy/Zomato-style aggregator orders.', endpoints: [
    _Endpoint(method: 'GET', path: '/aggregator/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/aggregator/sync-all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/aggregator/orders/{orderId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '24', file: '24-bar-beverage.md', id: 'bar', title: 'Bar & Beverage', endpointFile: 'bar_beverage_endpoints.dart', schemaTest: 'bar_beverage_snapshot_test.dart', description: 'Bar queue and drink preparation.', endpoints: [
    _Endpoint(method: 'GET', path: '/bar/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/bar/balance-queue', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/bar/drinks/{drinkId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '25', file: '25-bakery-dessert.md', id: 'bakery', title: 'Bakery & Dessert', endpointFile: 'bakery_dessert_endpoints.dart', schemaTest: 'bakery_dessert_snapshot_test.dart', description: 'Bakery production jobs.', endpoints: [
    _Endpoint(method: 'GET', path: '/bakery/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/bakery/production/start', request: '{"itemName": "Croissant"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/bakery/jobs/{jobId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '26', file: '26-cloud-kitchen.md', id: 'cloud-kitchen', title: 'Cloud Kitchen', endpointFile: 'cloud_kitchen_endpoints.dart', schemaTest: 'cloud_kitchen_snapshot_test.dart', description: 'Multi-brand cloud kitchen load balancing.', endpoints: [
    _Endpoint(method: 'GET', path: '/cloud-kitchen/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/cloud-kitchen/balance-load', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/cloud-kitchen/orders/{orderId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '27', file: '27-banquet.md', id: 'banquet', title: 'Banquet Operations', endpointFile: 'banquet_endpoints.dart', schemaTest: 'banquet_snapshot_test.dart', description: 'Banquet events and schedules.', endpoints: [
    _Endpoint(method: 'GET', path: '/banquet/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/banquet/schedule/start', request: '{"eventName": "Wedding"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/banquet/events/{eventId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '28', file: '28-room-service.md', id: 'room-service', title: 'Room Service', endpointFile: 'room_service_endpoints.dart', schemaTest: 'room_service_snapshot_test.dart', description: 'In-room dining and tray dispatch.', endpoints: [
    _Endpoint(method: 'GET', path: '/room-service/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/room-service/trays/dispatch', request: '{"orderId": "ORD-1"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/room-service/orders/{orderId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '29', file: '29-hygiene.md', id: 'hygiene', title: 'Cleaning & Hygiene', endpointFile: 'cleaning_hygiene_endpoints.dart', schemaTest: 'cleaning_hygiene_snapshot_test.dart', description: 'Hygiene tasks and audits.', endpoints: [
    _Endpoint(method: 'GET', path: '/hygiene/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/hygiene/audit/start', request: '{"auditType": "daily"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hygiene/tasks/{taskId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '30', file: '30-equipment.md', id: 'equipment', title: 'Equipment Management', endpointFile: 'equipment_endpoints.dart', schemaTest: 'equipment_snapshot_test.dart', description: 'Kitchen equipment assets and maintenance.', endpoints: [
    _Endpoint(method: 'GET', path: '/equipment/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/equipment/maintenance/raise', request: '{"assetId": "A1", "issueSummary": "..."}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/equipment/assets/{assetId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '31', file: '31-smart-energy.md', id: 'energy', title: 'Smart Energy', endpointFile: 'smart_energy_endpoints.dart', schemaTest: 'smart_energy_snapshot_test.dart', description: 'Energy monitoring and shutdown triggers.', endpoints: [
    _Endpoint(method: 'GET', path: '/energy/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/energy/shutdown/trigger', request: '{"equipmentName": "Oven 1"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/energy/alerts/{alertId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '32', file: '32-iot-devices.md', id: 'iot', title: 'IoT Devices', endpointFile: 'iot_device_endpoints.dart', schemaTest: 'iot_device_snapshot_test.dart', description: 'Connected kitchen IoT device management.', endpoints: [
    _Endpoint(method: 'GET', path: '/iot/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/iot/sync/all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/iot/devices/{deviceId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '33', file: '33-staff-performance.md', id: 'staff-performance', title: 'Staff Performance', endpointFile: 'staff_performance_endpoints.dart', schemaTest: 'staff_performance_snapshot_test.dart', description: 'Performance metrics and incentives.', endpoints: [
    _Endpoint(method: 'GET', path: '/staff-performance/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/staff-performance/recalculate', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/staff-performance/staff/{staffId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/staff-performance/incentives/{incentiveId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '34', file: '34-staff-shifts.md', id: 'staff-shift', title: 'Staff Shifts', endpointFile: 'staff_shift_endpoints.dart', schemaTest: 'staff_shift_snapshot_test.dart', description: 'Shift management, swaps, handovers.', endpoints: [
    _Endpoint(method: 'GET', path: '/staff-shift/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/staff-shift/sync/all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/staff-shift/staff/{staffId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/staff-shift/swaps/{swapId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/staff-shift/handovers/{handoverId}/action', request: '{"action": "accept", "note": "..."}', response: _actionResponse),
  ]),
  _Module(number: '35', file: '35-staff-wellness.md', id: 'staff-wellness', title: 'Staff Wellness', endpointFile: 'staff_wellness_endpoints.dart', schemaTest: 'staff_wellness_snapshot_test.dart', description: 'Wellness scans and recommendations.', endpoints: [
    _Endpoint(method: 'GET', path: '/staff-wellness/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/staff-wellness/run-scan', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/staff-wellness/alerts/{alertId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/staff-wellness/recommendations/{recommendationId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '36', file: '36-live-alerts.md', id: 'live-alerts', title: 'Live Alerts', endpointFile: 'live_alert_endpoints.dart', schemaTest: 'live_alert_snapshot_test.dart', description: 'Real-time kitchen alert board.', endpoints: [
    _Endpoint(method: 'GET', path: '/live-alerts/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/live-alerts/sync/all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/live-alerts/{alertId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '37', file: '37-panic-emergency.md', id: 'panic', title: 'Panic & Emergency', endpointFile: 'panic_emergency_endpoints.dart', schemaTest: 'panic_emergency_snapshot_test.dart', description: 'Emergency incidents and evacuation.', endpoints: [
    _Endpoint(method: 'GET', path: '/panic-emergency/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/panic-emergency/trigger-panic', request: '{"emergencyType": "fire", "section": "Main"}', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/panic-emergency/sync/all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/panic-emergency/incidents/{incidentId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/panic-emergency/evacuations/{evacuationId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '38', file: '38-offline-failover.md', id: 'offline', title: 'Offline Failover', endpointFile: 'offline_failover_endpoints.dart', schemaTest: 'offline_failover_snapshot_test.dart', description: 'Offline mode and sync recovery.', endpoints: [
    _Endpoint(method: 'GET', path: '/offline-failover/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/offline-failover/restore-sync', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/offline-failover/sync/all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/offline-failover/modules/{moduleId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/offline-failover/queue/{queueId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/offline-failover/recovery/{recoveryId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '39', file: '39-analytics-reporting.md', id: 'analytics', title: 'Analytics & Reporting', endpointFile: 'analytics_reporting_endpoints.dart', schemaTest: 'analytics_reporting_snapshot_test.dart', description: 'Reports and insights generation.', endpoints: [
    _Endpoint(method: 'GET', path: '/analytics-reporting/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/analytics-reporting/generate-all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/analytics-reporting/reports/{reportId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/analytics-reporting/insights/{insightId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '40', file: '40-kitchen-heatmap.md', id: 'heatmap', title: 'Kitchen Heatmap', endpointFile: 'kitchen_heatmap_endpoints.dart', schemaTest: 'kitchen_heatmap_snapshot_test.dart', description: 'Station density and rush hotspots.', endpoints: [
    _Endpoint(method: 'GET', path: '/kitchen-heatmap/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/kitchen-heatmap/refresh-all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/kitchen-heatmap/stations/{stationId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/kitchen-heatmap/hotspots/{hotspotId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/kitchen-heatmap/density/{densityId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/kitchen-heatmap/rush/{rushId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '41', file: '41-hardware-integration.md', id: 'hardware', title: 'Hardware Integration', endpointFile: 'hardware_integration_endpoints.dart', schemaTest: 'hardware_integration_snapshot_test.dart', description: 'Displays, tablets, printers, scanners, NFC.', endpoints: [
    _Endpoint(method: 'GET', path: '/hardware-integration/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/hardware-integration/sync-all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hardware-integration/displays/{displayId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hardware-integration/tablets/{tabletId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hardware-integration/printers/{printerId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hardware-integration/smartwatches/{watchId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hardware-integration/nfc/{nfcId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hardware-integration/scanners/{scannerId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '42', file: '42-smartwatch-support.md', id: 'smartwatch', title: 'Smartwatch Support', endpointFile: 'smartwatch_support_endpoints.dart', schemaTest: 'smartwatch_support_snapshot_test.dart', description: 'Smartwatch alerts for orders, delays, tasks.', endpoints: [
    _Endpoint(method: 'GET', path: '/smartwatch-support/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/smartwatch-support/push-all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/smartwatch-support/orders/{alertId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/smartwatch-support/delays/{alertId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/smartwatch-support/emergency/{alertId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/smartwatch-support/tasks/{taskId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '43', file: '43-multi-branch.md', id: 'multi-branch', title: 'Multi-Branch Sync', endpointFile: 'multi_branch_endpoints.dart', schemaTest: 'multi_branch_snapshot_test.dart', description: 'Central kitchen, branch sync, shared inventory.', endpoints: [
    _Endpoint(method: 'GET', path: '/multi-branch/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/multi-branch/sync-all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/multi-branch/central/{kitchenId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/multi-branch/recipes/{syncId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/multi-branch/branches/{branchId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/multi-branch/inventory/{inventoryId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/multi-branch/forecasts/{forecastId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '44', file: '44-audit-compliance.md', id: 'audit', title: 'Audit & Compliance', endpointFile: 'audit_compliance_endpoints.dart', schemaTest: 'audit_compliance_snapshot_test.dart', description: 'Food safety, hygiene, and incident logs.', endpoints: [
    _Endpoint(method: 'GET', path: '/audit-compliance/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/audit-compliance/export-all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/audit-compliance/actions/{logId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/audit-compliance/food-safety/{logId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/audit-compliance/hygiene/{logId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/audit-compliance/staff/{logId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/audit-compliance/incidents/{incidentId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '45', file: '45-backup-recovery.md', id: 'backup', title: 'Backup & Recovery', endpointFile: 'backup_recovery_endpoints.dart', schemaTest: 'backup_recovery_snapshot_test.dart', description: 'Auto/manual backup and restore workflows.', endpoints: [
    _Endpoint(method: 'GET', path: '/backup-recovery/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/backup-recovery/run-all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/backup-recovery/auto/{backupId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/backup-recovery/manual/{backupId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/backup-recovery/cloud/{syncId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/backup-recovery/restores/{restoreId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/backup-recovery/recovery/{recoveryId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '46', file: '46-sandbox-training.md', id: 'sandbox', title: 'Sandbox Training', endpointFile: 'sandbox_training_endpoints.dart', schemaTest: 'sandbox_training_snapshot_test.dart', description: 'Training simulations and SOP modules.', endpoints: [
    _Endpoint(method: 'GET', path: '/sandbox-training/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/sandbox-training/launch-all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/sandbox-training/demo/{demoId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/sandbox-training/practice/{sessionId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/sandbox-training/sop/{sopId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/sandbox-training/simulations/{simulationId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '47', file: '47-hidden-enterprise.md', id: 'hidden', title: 'Hidden Enterprise', endpointFile: 'hidden_enterprise_endpoints.dart', schemaTest: 'hidden_enterprise_snapshot_test.dart', description: 'Advanced admin: soft delete, replay, lockdown.', endpoints: [
    _Endpoint(method: 'GET', path: '/hidden-enterprise/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/hidden-enterprise/activate-all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hidden-enterprise/soft-delete/{itemId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hidden-enterprise/orders/{orderId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hidden-enterprise/replays/{replayId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hidden-enterprise/versions/{versionId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hidden-enterprise/devices/{deviceId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hidden-enterprise/sessions/{sessionId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hidden-enterprise/lockdown/{lockdownId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/hidden-enterprise/queue/{queueId}/action', request: _actionRequest, response: _actionResponse),
  ]),
  _Module(number: '48', file: '48-future-ai-expansion.md', id: 'future-ai', title: 'Future AI Expansion', endpointFile: 'future_ai_expansion_endpoints.dart', schemaTest: 'future_ai_expansion_snapshot_test.dart', description: 'Robotic kitchen, plating AI, prep automation.', endpoints: [
    _Endpoint(method: 'GET', path: '/future-ai-expansion/board', query: ['section'], response: _boardResponse),
    _Endpoint(method: 'POST', path: '/future-ai-expansion/activate-all', response: _actionResponse),
    _Endpoint(method: 'POST', path: '/future-ai-expansion/cooking-assistant/{entryId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/future-ai-expansion/robotic/{entryId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/future-ai-expansion/plating/{entryId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/future-ai-expansion/waste/{entryId}/action', request: _actionRequest, response: _actionResponse),
    _Endpoint(method: 'POST', path: '/future-ai-expansion/prep-automation/{entryId}/action', request: _actionRequest, response: _actionResponse),
  ]),
];
