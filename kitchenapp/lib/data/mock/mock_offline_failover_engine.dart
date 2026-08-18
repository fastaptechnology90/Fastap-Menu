import 'mock_section_registry.dart';

class MockOfflineFailoverRegistry {
  MockOfflineFailoverRegistry._();

  static String _connectivityStatus = 'degraded';
  static final List<Map<String, dynamic>> _modules = _seedModules();
  static final List<Map<String, dynamic>> _queue = _seedQueue();
  static final List<Map<String, dynamic>> _recovery = _seedRecovery();
  static int _syncedToday = 14;
  static String _lastRestoreAt = '18 min ago';

  static List<Map<String, dynamic>> modulesFor(String section) {
    if (section == 'All') {
      return _modules.map(_serializeModule).toList();
    }
    return _modules
        .where((item) => item['section'] == section)
        .map(_serializeModule)
        .toList();
  }

  static List<Map<String, dynamic>> queueFor(String section) {
    if (section == 'All') {
      return _queue.map(_serializeQueue).toList();
    }
    return _queue
        .where((item) => item['section'] == section)
        .map(_serializeQueue)
        .toList();
  }

  static List<Map<String, dynamic>> recoveryFor(String section) {
    if (section == 'All') {
      return _recovery.map(_serializeRecovery).toList();
    }
    return _recovery
        .where((item) => item['section'] == section)
        .map(_serializeRecovery)
        .toList();
  }

  static Map<String, dynamic> performModuleAction({
    required String moduleId,
    required String action,
  }) {
    final module = _findModule(moduleId);
    if (module == null) {
      throw ArgumentError('Offline module not found');
    }

    final moduleName = module['moduleName'] as String;

    switch (action) {
      case 'enable_offline_mode':
        module['status'] = 'offline';
        _connectivityStatus = 'degraded';
        return {
          'success': true,
          'message': 'Offline mode enabled · $moduleName',
        };
      case 'disable_offline_mode':
        module['status'] = 'online';
        module['pendingCount'] = 0;
        module['lastSyncedAt'] = 'Just now';
        _syncedToday++;
        return {
          'success': true,
          'message': 'Module back online · $moduleName',
        };
      case 'force_sync_module':
        module['status'] = 'syncing';
        module['pendingCount'] = 0;
        module['lastSyncedAt'] = 'Just now';
        module['status'] = 'online';
        _syncedToday++;
        return {
          'success': true,
          'message': 'Force sync complete · $moduleName',
        };
      default:
        throw ArgumentError('Unknown module action: $action');
    }
  }

  static Map<String, dynamic> performQueueAction({
    required String queueId,
    required String action,
  }) {
    final item = _findQueueItem(queueId);
    if (item == null) {
      throw ArgumentError('Queue item not found');
    }

    final label = item['label'] as String;

    switch (action) {
      case 'retry_sync':
        item['status'] = 'synced';
        _syncedToday++;
        return {
          'success': true,
          'message': 'Queue item synced · $label',
        };
      case 'prioritize_item':
        item['status'] = 'priority';
        _queue.remove(item);
        _queue.insert(0, item);
        return {
          'success': true,
          'message': 'Queue item prioritized · $label',
        };
      case 'discard_item':
        item['status'] = 'discarded';
        return {
          'success': true,
          'message': 'Queue item discarded · $label',
        };
      default:
        throw ArgumentError('Unknown queue action: $action');
    }
  }

  static Map<String, dynamic> performRecoveryAction({
    required String recoveryId,
    required String action,
  }) {
    final job = _findRecoveryJob(recoveryId);
    if (job == null) {
      throw ArgumentError('Recovery job not found');
    }

    final jobName = job['jobName'] as String;

    switch (action) {
      case 'start_recovery':
        job['status'] = 'running';
        job['progress'] = 25;
        return {
          'success': true,
          'message': 'Recovery started · $jobName',
        };
      case 'pause_recovery':
        job['status'] = 'paused';
        return {
          'success': true,
          'message': 'Recovery paused · $jobName',
        };
      case 'complete_recovery':
        job['status'] = 'completed';
        job['progress'] = 100;
        _syncedToday += 3;
        return {
          'success': true,
          'message': 'Recovery completed · $jobName',
        };
      default:
        throw ArgumentError('Unknown recovery action: $action');
    }
  }

  static Map<String, dynamic> restoreSync() {
    _connectivityStatus = 'online';
    _lastRestoreAt = 'Just now';
    for (final module in _modules) {
      if (module['status'] != 'online') {
        module['status'] = 'online';
        module['pendingCount'] = 0;
        module['lastSyncedAt'] = 'Just now';
      }
    }
    for (final item in _queue) {
      if (item['status'] == 'pending' || item['status'] == 'priority') {
        item['status'] = 'synced';
      }
    }
    _syncedToday += _queue.length;
    return {
      'success': true,
      'message': 'Auto sync restoration complete · all modules online',
    };
  }

  static Map<String, dynamic> syncAll() {
    _syncedToday++;
    return {
      'success': true,
      'message':
          'Failover board synced · connectivity $_connectivityStatus',
    };
  }

  static Map<String, dynamic>? _findModule(String moduleId) {
    for (final module in _modules) {
      if (module['id'] == moduleId) {
        return module;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findQueueItem(String queueId) {
    for (final item in _queue) {
      if (item['id'] == queueId) {
        return item;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findRecoveryJob(String recoveryId) {
    for (final job in _recovery) {
      if (job['id'] == recoveryId) {
        return job;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeModule(Map<String, dynamic> module) {
    return {
      'id': module['id'],
      'moduleName': module['moduleName'],
      'moduleType': module['moduleType'],
      'section': module['section'],
      'status': module['status'],
      'lastSyncedAt': module['lastSyncedAt'],
      'pendingCount': module['pendingCount'],
      'availableActions': _moduleActions(module),
    };
  }

  static List<String> _moduleActions(Map<String, dynamic> module) {
    return switch (module['status']) {
      'online' => ['enable_offline_mode', 'force_sync_module'],
      'offline' => ['disable_offline_mode', 'force_sync_module'],
      'syncing' => <String>[],
      _ => ['force_sync_module'],
    };
  }

  static Map<String, dynamic> _serializeQueue(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'itemType': item['itemType'],
      'label': item['label'],
      'section': item['section'],
      'queuedAt': item['queuedAt'],
      'status': item['status'],
      'availableActions': item['status'] == 'pending' ||
              item['status'] == 'priority'
          ? ['retry_sync', 'prioritize_item', 'discard_item']
          : <String>[],
    };
  }

  static Map<String, dynamic> _serializeRecovery(Map<String, dynamic> job) {
    return {
      'id': job['id'],
      'jobName': job['jobName'],
      'section': job['section'],
      'progress': job['progress'],
      'status': job['status'],
      'availableActions': _recoveryActions(job),
    };
  }

  static List<String> _recoveryActions(Map<String, dynamic> job) {
    return switch (job['status']) {
      'pending' => ['start_recovery'],
      'running' => ['pause_recovery', 'complete_recovery'],
      'paused' => ['start_recovery', 'complete_recovery'],
      _ => <String>[],
    };
  }

  static List<Map<String, dynamic>> _seedModules() {
    return [
      {
        'id': 'OFF-KDS-001',
        'moduleName': 'Offline KDS',
        'moduleType': 'offline_kds',
        'section': 'Main',
        'status': 'offline',
        'lastSyncedAt': '12 min ago',
        'pendingCount': 6,
      },
      {
        'id': 'OFF-ORD-001',
        'moduleName': 'Offline order sync',
        'moduleType': 'offline_order_sync',
        'section': 'Main',
        'status': 'syncing',
        'lastSyncedAt': 'Syncing…',
        'pendingCount': 3,
      },
      {
        'id': 'OFF-PREP-001',
        'moduleName': 'Offline prep tracking',
        'moduleType': 'offline_prep_tracking',
        'section': 'Tandoor',
        'status': 'offline',
        'lastSyncedAt': '8 min ago',
        'pendingCount': 4,
      },
      {
        'id': 'OFF-KDS-002',
        'moduleName': 'Offline KDS',
        'moduleType': 'offline_kds',
        'section': 'Chinese',
        'status': 'online',
        'lastSyncedAt': 'Just now',
        'pendingCount': 0,
      },
    ];
  }

  static List<Map<String, dynamic>> _seedQueue() {
    return [
      {
        'id': 'Q-001',
        'itemType': 'order',
        'label': 'KOT-1042 · butter chicken',
        'section': 'Main',
        'queuedAt': '11 min ago',
        'status': 'pending',
      },
      {
        'id': 'Q-002',
        'itemType': 'order',
        'label': 'KOT-1045 · dal makhani',
        'section': 'Main',
        'queuedAt': '9 min ago',
        'status': 'pending',
      },
      {
        'id': 'Q-003',
        'itemType': 'prep',
        'label': 'Prep batch · naan dough',
        'section': 'Tandoor',
        'queuedAt': '7 min ago',
        'status': 'pending',
      },
      {
        'id': 'Q-004',
        'itemType': 'kds',
        'label': 'KDS bump · Table 8 ready',
        'section': 'Chinese',
        'queuedAt': '5 min ago',
        'status': 'priority',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedRecovery() {
    return [
      {
        'id': 'REC-001',
        'jobName': 'Main section queue recovery',
        'section': 'Main',
        'progress': 0,
        'status': 'pending',
      },
      {
        'id': 'REC-002',
        'jobName': 'Tandoor prep sync recovery',
        'section': 'Tandoor',
        'progress': 62,
        'status': 'running',
      },
    ];
  }

  static String get connectivityStatus => _connectivityStatus;
  static int get syncedToday => _syncedToday;
  static String get lastRestoreAt => _lastRestoreAt;
}

class MockOfflineFailoverEngine {
  const MockOfflineFailoverEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final offlineModules = MockOfflineFailoverRegistry.modulesFor(section);
    final queuedItems = MockOfflineFailoverRegistry.queueFor(section);
    final recoveryJobs = MockOfflineFailoverRegistry.recoveryFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'connectivityStatus': MockOfflineFailoverRegistry.connectivityStatus,
      'offlineModules': offlineModules,
      'queuedItems': queuedItems,
      'recoveryJobs': recoveryJobs,
      'stats': {
        'connectivityStatus': MockOfflineFailoverRegistry.connectivityStatus,
        'offlineModulesCount': offlineModules
            .where((item) => item['status'] == 'offline')
            .length,
        'pendingQueueItems': queuedItems
            .where((item) =>
                item['status'] == 'pending' || item['status'] == 'priority')
            .length,
        'activeRecoveryJobs': recoveryJobs
            .where((item) =>
                item['status'] == 'running' || item['status'] == 'pending')
            .length,
        'syncedToday': MockOfflineFailoverRegistry.syncedToday,
        'lastRestoreAt': MockOfflineFailoverRegistry.lastRestoreAt,
      },
      'failoverFeatures': {
        'offlineKds': offlineModules.any(
          (item) => item['moduleType'] == 'offline_kds',
        ),
        'offlineOrderSync': offlineModules.any(
          (item) => item['moduleType'] == 'offline_order_sync',
        ),
        'offlinePrepTracking': offlineModules.any(
          (item) => item['moduleType'] == 'offline_prep_tracking',
        ),
        'queueRecovery': recoveryJobs.isNotEmpty,
        'autoSyncRestoration': true,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
