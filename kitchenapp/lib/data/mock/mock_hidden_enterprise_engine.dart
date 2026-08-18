import 'mock_section_registry.dart';

class MockHiddenEnterpriseRegistry {
  MockHiddenEnterpriseRegistry._();

  static final List<Map<String, dynamic>> _softDelete = _seedSoftDelete();
  static final List<Map<String, dynamic>> _orders = _seedOrders();
  static final List<Map<String, dynamic>> _replays = _seedReplays();
  static final List<Map<String, dynamic>> _versions = _seedVersions();
  static final List<Map<String, dynamic>> _devices = _seedDevices();
  static final List<Map<String, dynamic>> _sessions = _seedSessions();
  static final List<Map<String, dynamic>> _lockdowns = _seedLockdowns();
  static final List<Map<String, dynamic>> _queues = _seedQueues();

  static List<Map<String, dynamic>> softDeleteFor(String section) {
    return _filterSection(_softDelete, section)
        .map(_serializeSoftDelete)
        .toList();
  }

  static List<Map<String, dynamic>> ordersFor(String section) {
    return _filterSection(_orders, section).map(_serializeOrder).toList();
  }

  static List<Map<String, dynamic>> replaysFor(String section) {
    return _filterSection(_replays, section).map(_serializeReplay).toList();
  }

  static List<Map<String, dynamic>> versionsFor(String section) {
    return _filterSection(_versions, section).map(_serializeVersion).toList();
  }

  static List<Map<String, dynamic>> devicesFor(String section) {
    return _filterSection(_devices, section).map(_serializeDevice).toList();
  }

  static List<Map<String, dynamic>> sessionsFor(String section) {
    return _filterSection(_sessions, section).map(_serializeSession).toList();
  }

  static List<Map<String, dynamic>> lockdownsFor(String section) {
    return _filterSection(_lockdowns, section).map(_serializeLockdown).toList();
  }

  static List<Map<String, dynamic>> queuesFor(String section) {
    return _filterSection(_queues, section).map(_serializeQueue).toList();
  }

  static Map<String, dynamic> performSoftDeleteAction({
    required String itemId,
    required String action,
  }) => _perform(_softDelete, itemId, action, 'Soft delete item', {
        'recover_item': (item) {
          item['status'] = 'recovered';
          return 'Soft delete recovered · ${item['itemName']}';
        },
        'purge_item': (item) {
          item['status'] = 'purged';
          return 'Item purged · ${item['itemName']}';
        },
        'extend_retention': (item) {
          item['retentionLabel'] = '14 days';
          return 'Retention extended · ${item['itemName']}';
        },
      });

  static Map<String, dynamic> performOrderAction({
    required String orderId,
    required String action,
  }) => _perform(_orders, orderId, action, 'Deleted order', {
        'restore_order': (item) {
          item['status'] = 'restored';
          return 'Order restored · ${item['orderLabel']}';
        },
        'preview_order': (item) {
          item['status'] = 'previewed';
          return 'Restore preview generated · ${item['orderLabel']}';
        },
        'discard_order': (item) {
          item['status'] = 'discarded';
          return 'Order permanently discarded · ${item['orderLabel']}';
        },
      });

  static Map<String, dynamic> performReplayAction({
    required String replayId,
    required String action,
  }) => _perform(_replays, replayId, action, 'Action replay', {
        'replay_actions': (item) {
          item['status'] = 'replayed';
          return 'Action replay started · ${item['replayLabel']}';
        },
        'export_replay': (item) {
          item['status'] = 'exported';
          return 'Replay exported · ${item['replayLabel']}';
        },
        'archive_replay': (item) {
          item['status'] = 'archived';
          return 'Replay archived · ${item['replayLabel']}';
        },
      });

  static Map<String, dynamic> performVersionAction({
    required String versionId,
    required String action,
  }) => _perform(_versions, versionId, action, 'Version log', {
        'restore_version': (item) {
          item['status'] = 'restored';
          return 'Version restored · ${item['versionLabel']}';
        },
        'compare_version': (item) {
          item['status'] = 'compared';
          return 'Version diff generated · ${item['versionLabel']}';
        },
        'archive_version': (item) {
          item['status'] = 'archived';
          return 'Version archived · ${item['versionLabel']}';
        },
      });

  static Map<String, dynamic> performDeviceAction({
    required String deviceId,
    required String action,
  }) => _perform(_devices, deviceId, action, 'Tracked device', {
        'trace_device': (item) {
          item['status'] = 'traced';
          item['lastSeen'] = 'Just now';
          return 'Device trace refreshed · ${item['deviceName']}';
        },
        'revoke_device': (item) {
          item['status'] = 'revoked';
          return 'Device session revoked · ${item['deviceName']}';
        },
        'flag_device': (item) {
          item['status'] = 'flagged';
          return 'Device flagged · ${item['deviceName']}';
        },
      });

  static Map<String, dynamic> performSessionAction({
    required String sessionId,
    required String action,
  }) => _perform(_sessions, sessionId, action, 'Session log', {
        'review_session': (item) {
          item['status'] = 'reviewed';
          return 'Session reviewed · ${item['sessionLabel']}';
        },
        'terminate_session': (item) {
          item['status'] = 'terminated';
          return 'Session terminated · ${item['sessionLabel']}';
        },
        'export_session': (item) {
          item['status'] = 'exported';
          return 'Session log exported · ${item['sessionLabel']}';
        },
      });

  static Map<String, dynamic> performLockdownAction({
    required String lockdownId,
    required String action,
  }) => _perform(_lockdowns, lockdownId, action, 'Emergency lockdown', {
        'arm_lockdown': (item) {
          item['status'] = 'armed';
          return 'Lockdown armed · ${item['lockdownName']}';
        },
        'release_lockdown': (item) {
          item['status'] = 'released';
          return 'Lockdown released · ${item['lockdownName']}';
        },
        'test_lockdown': (item) {
          item['status'] = 'tested';
          return 'Lockdown test completed · ${item['lockdownName']}';
        },
      });

  static Map<String, dynamic> performQueueAction({
    required String queueId,
    required String action,
  }) => _perform(_queues, queueId, action, 'Queue recovery', {
        'recover_queue': (item) {
          item['status'] = 'recovered';
          return 'Queue recovered · ${item['queueName']}';
        },
        'rebuild_queue': (item) {
          item['status'] = 'rebuilding';
          return 'Queue rebuild started · ${item['queueName']}';
        },
        'cancel_recovery': (item) {
          item['status'] = 'cancelled';
          return 'Recovery cancelled · ${item['queueName']}';
        },
      });

  static Map<String, dynamic> activateAll() {
    for (final item in _softDelete) {
      if (item['status'] == 'recoverable') {
        item['status'] = 'recovered';
      }
    }
    for (final item in _queues) {
      if (item['status'] == 'pending') {
        item['status'] = 'recovered';
      }
    }
    return {
      'success': true,
      'message': 'Hidden enterprise systems activated · 8 modules armed',
    };
  }

  static Map<String, dynamic> _perform(
    List<Map<String, dynamic>> items,
    String id,
    String action,
    String label,
    Map<String, String Function(Map<String, dynamic>)> handlers,
  ) {
    final item = _find(items, id);
    if (item == null) {
      throw ArgumentError('$label not found');
    }

    final handler = handlers[action];
    if (handler == null) {
      throw ArgumentError('Unknown $label action: $action');
    }

    return {'success': true, 'message': handler(item)};
  }

  static List<Map<String, dynamic>> _filterSection(
    List<Map<String, dynamic>> items,
    String section,
  ) {
    if (section == 'All') {
      return items;
    }
    return items.where((item) => item['section'] == section).toList();
  }

  static Map<String, dynamic>? _find(
    List<Map<String, dynamic>> items,
    String id,
  ) {
    for (final item in items) {
      if (item['id'] == id) {
        return item;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeSoftDelete(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'itemName': item['itemName'],
      'section': item['section'],
      'deletedAt': item['deletedAt'],
      'retentionLabel': item['retentionLabel'],
      'status': item['status'],
      'availableActions': const ['recover_item', 'purge_item', 'extend_retention'],
    };
  }

  static Map<String, dynamic> _serializeOrder(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'orderLabel': item['orderLabel'],
      'section': item['section'],
      'deletedAt': item['deletedAt'],
      'orderType': item['orderType'],
      'status': item['status'],
      'availableActions': const ['restore_order', 'preview_order', 'discard_order'],
    };
  }

  static Map<String, dynamic> _serializeReplay(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'replayLabel': item['replayLabel'],
      'section': item['section'],
      'actorName': item['actorName'],
      'stepCount': item['stepCount'],
      'status': item['status'],
      'availableActions': const ['replay_actions', 'export_replay', 'archive_replay'],
    };
  }

  static Map<String, dynamic> _serializeVersion(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'versionLabel': item['versionLabel'],
      'section': item['section'],
      'snapshotType': item['snapshotType'],
      'createdAt': item['createdAt'],
      'status': item['status'],
      'availableActions': const [
        'restore_version',
        'compare_version',
        'archive_version',
      ],
    };
  }

  static Map<String, dynamic> _serializeDevice(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'deviceName': item['deviceName'],
      'section': item['section'],
      'lastSeen': item['lastSeen'],
      'sessionLabel': item['sessionLabel'],
      'status': item['status'],
      'availableActions': const ['trace_device', 'revoke_device', 'flag_device'],
    };
  }

  static Map<String, dynamic> _serializeSession(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'sessionLabel': item['sessionLabel'],
      'section': item['section'],
      'userName': item['userName'],
      'durationLabel': item['durationLabel'],
      'status': item['status'],
      'availableActions': const [
        'review_session',
        'terminate_session',
        'export_session',
      ],
    };
  }

  static Map<String, dynamic> _serializeLockdown(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'lockdownName': item['lockdownName'],
      'section': item['section'],
      'scopeLabel': item['scopeLabel'],
      'severity': item['severity'],
      'status': item['status'],
      'availableActions': const ['arm_lockdown', 'release_lockdown', 'test_lockdown'],
    };
  }

  static Map<String, dynamic> _serializeQueue(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'queueName': item['queueName'],
      'section': item['section'],
      'ordersAffected': item['ordersAffected'],
      'recoveryMode': item['recoveryMode'],
      'status': item['status'],
      'availableActions': const ['recover_queue', 'rebuild_queue', 'cancel_recovery'],
    };
  }

  static List<Map<String, dynamic>> _seedSoftDelete() => [
        {
          'id': 'HE-SD-001',
          'itemName': 'Prep list batch #44',
          'section': 'Main',
          'deletedAt': '2 hr ago',
          'retentionLabel': '7 days',
          'status': 'recoverable',
        },
        {
          'id': 'HE-SD-002',
          'itemName': 'Modifier rule set · spice level',
          'section': 'Tandoor',
          'deletedAt': 'Yesterday',
          'retentionLabel': '3 days',
          'status': 'recoverable',
        },
      ];

  static List<Map<String, dynamic>> _seedOrders() => [
        {
          'id': 'HE-ORD-001',
          'orderLabel': 'Order #2801 VIP',
          'section': 'Main',
          'deletedAt': '45 min ago',
          'orderType': 'VIP',
          'status': 'restorable',
        },
        {
          'id': 'HE-ORD-002',
          'orderLabel': 'Banquet table 12',
          'section': 'Continental',
          'deletedAt': '3 hr ago',
          'orderType': 'Banquet',
          'status': 'restorable',
        },
      ];

  static List<Map<String, dynamic>> _seedReplays() => [
        {
          'id': 'HE-RPL-001',
          'replayLabel': 'KDS bump sequence · #2847',
          'section': 'Main',
          'actorName': 'Chef Rahul',
          'stepCount': 6,
          'status': 'available',
        },
        {
          'id': 'HE-RPL-002',
          'replayLabel': 'Section reroute chain',
          'section': 'Tandoor',
          'actorName': 'Supervisor Meera',
          'stepCount': 4,
          'status': 'available',
        },
      ];

  static List<Map<String, dynamic>> _seedVersions() => [
        {
          'id': 'HE-VER-001',
          'versionLabel': 'Menu v2.4 rollback point',
          'section': 'Main',
          'snapshotType': 'Menu config',
          'createdAt': 'Jun 5 18:00',
          'status': 'archived',
        },
        {
          'id': 'HE-VER-002',
          'versionLabel': 'Recipe costing snapshot',
          'section': 'Main',
          'snapshotType': 'Costing',
          'createdAt': 'Jun 4 22:30',
          'status': 'archived',
        },
      ];

  static List<Map<String, dynamic>> _seedDevices() => [
        {
          'id': 'HE-DEV-001',
          'deviceName': 'Pass printer terminal',
          'section': 'Main',
          'lastSeen': '3 min ago',
          'sessionLabel': 'Active shift',
          'status': 'tracked',
        },
        {
          'id': 'HE-DEV-002',
          'deviceName': 'KDS display node 3',
          'section': 'Main',
          'lastSeen': 'Just now',
          'sessionLabel': 'Live board',
          'status': 'tracked',
        },
      ];

  static List<Map<String, dynamic>> _seedSessions() => [
        {
          'id': 'HE-SES-001',
          'sessionLabel': 'Chef Rahul kitchen session',
          'section': 'Main',
          'userName': 'Chef Rahul',
          'durationLabel': '4h 12m',
          'status': 'active',
        },
        {
          'id': 'HE-SES-002',
          'sessionLabel': 'Overnight batch sync session',
          'section': 'Main',
          'userName': 'System',
          'durationLabel': '38 min',
          'status': 'closed',
        },
      ];

  static List<Map<String, dynamic>> _seedLockdowns() => [
        {
          'id': 'HE-LCK-001',
          'lockdownName': 'Pass station lockdown',
          'section': 'Main',
          'scopeLabel': 'Pass + expo',
          'severity': 'high',
          'status': 'standby',
        },
        {
          'id': 'HE-LCK-002',
          'lockdownName': 'Full kitchen lockdown',
          'section': 'Main',
          'scopeLabel': 'All stations',
          'severity': 'critical',
          'status': 'standby',
        },
      ];

  static List<Map<String, dynamic>> _seedQueues() => [
        {
          'id': 'HE-QUE-001',
          'queueName': 'Main line queue rebuild',
          'section': 'Main',
          'ordersAffected': 14,
          'recoveryMode': 'standard',
          'status': 'pending',
        },
        {
          'id': 'HE-QUE-002',
          'queueName': 'KDS cache recovery',
          'section': 'Main',
          'ordersAffected': 8,
          'recoveryMode': 'fast',
          'status': 'running',
        },
      ];
}

class MockHiddenEnterpriseEngine {
  const MockHiddenEnterpriseEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final softDeleteItems = MockHiddenEnterpriseRegistry.softDeleteFor(section);
    final deletedOrders = MockHiddenEnterpriseRegistry.ordersFor(section);
    final actionReplays = MockHiddenEnterpriseRegistry.replaysFor(section);
    final versionLogs = MockHiddenEnterpriseRegistry.versionsFor(section);
    final deviceTracking = MockHiddenEnterpriseRegistry.devicesFor(section);
    final sessionLogs = MockHiddenEnterpriseRegistry.sessionsFor(section);
    final emergencyLockdowns =
        MockHiddenEnterpriseRegistry.lockdownsFor(section);
    final queueRecoveries = MockHiddenEnterpriseRegistry.queuesFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'softDeleteItems': softDeleteItems,
      'deletedOrders': deletedOrders,
      'actionReplays': actionReplays,
      'versionLogs': versionLogs,
      'deviceTracking': deviceTracking,
      'sessionLogs': sessionLogs,
      'emergencyLockdowns': emergencyLockdowns,
      'queueRecoveries': queueRecoveries,
      'stats': {
        'recoverableItems': softDeleteItems
            .where((item) => item['status'] == 'recoverable')
            .length,
        'restorableOrders': deletedOrders
            .where((item) => item['status'] == 'restorable')
            .length,
        'replayAvailable': actionReplays
            .where((item) => item['status'] == 'available')
            .length,
        'versionSnapshots': versionLogs.length,
        'trackedDevices': deviceTracking.length,
        'activeSessions':
            sessionLogs.where((item) => item['status'] == 'active').length,
        'lockdownArmed':
            emergencyLockdowns.where((item) => item['status'] == 'armed').length,
        'queueRecoveries': queueRecoveries
            .where((item) =>
                item['status'] == 'pending' || item['status'] == 'running')
            .length,
      },
      'hiddenFeatures': {
        'softDeleteRecovery': softDeleteItems.isNotEmpty,
        'restoreDeletedOrders': deletedOrders.isNotEmpty,
        'actionReplay': actionReplays.isNotEmpty,
        'versionLogs': versionLogs.isNotEmpty,
        'deviceTracking': deviceTracking.isNotEmpty,
        'sessionLogs': sessionLogs.isNotEmpty,
        'emergencyLockdownMode': emergencyLockdowns.isNotEmpty,
        'queueRecoveryEngine': queueRecoveries.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
