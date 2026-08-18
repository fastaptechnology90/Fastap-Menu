import 'mock_section_registry.dart';

class MockBackupRecoveryRegistry {
  MockBackupRecoveryRegistry._();

  static final List<Map<String, dynamic>> _auto = _seedAuto();
  static final List<Map<String, dynamic>> _manual = _seedManual();
  static final List<Map<String, dynamic>> _cloud = _seedCloud();
  static final List<Map<String, dynamic>> _restores = _seedRestores();
  static final List<Map<String, dynamic>> _recovery = _seedRecovery();
  static int _completedToday = 9;

  static List<Map<String, dynamic>> autoFor(String section) {
    return _filterSection(_auto, section).map(_serializeAuto).toList();
  }

  static List<Map<String, dynamic>> manualFor(String section) {
    return _filterSection(_manual, section).map(_serializeManual).toList();
  }

  static List<Map<String, dynamic>> cloudFor(String section) {
    return _filterSection(_cloud, section).map(_serializeCloud).toList();
  }

  static List<Map<String, dynamic>> restoresFor(String section) {
    return _filterSection(_restores, section).map(_serializeRestore).toList();
  }

  static List<Map<String, dynamic>> recoveryFor(String section) {
    return _filterSection(_recovery, section).map(_serializeRecovery).toList();
  }

  static Map<String, dynamic> performAutoAction({
    required String backupId,
    required String action,
  }) {
    final job = _find(_auto, backupId);
    if (job == null) {
      throw ArgumentError('Auto backup job not found');
    }

    final name = job['jobName'] as String;

    switch (action) {
      case 'enable_schedule':
        job['status'] = 'active';
        return {'success': true, 'message': 'Auto backup enabled · $name'};
      case 'run_now':
        job['status'] = 'running';
        job['lastRunLabel'] = 'Just now';
        _completedToday++;
        return {'success': true, 'message': 'Auto backup started · $name'};
      case 'pause_schedule':
        job['status'] = 'paused';
        return {'success': true, 'message': 'Auto backup paused · $name'};
      default:
        throw ArgumentError('Unknown auto backup action: $action');
    }
  }

  static Map<String, dynamic> performManualAction({
    required String backupId,
    required String action,
  }) {
    final job = _find(_manual, backupId);
    if (job == null) {
      throw ArgumentError('Manual backup job not found');
    }

    final name = job['backupName'] as String;

    switch (action) {
      case 'start_backup':
        job['status'] = 'running';
        _completedToday++;
        return {'success': true, 'message': 'Manual backup started · $name'};
      case 'cancel_backup':
        job['status'] = 'cancelled';
        return {'success': true, 'message': 'Manual backup cancelled · $name'};
      case 'verify_backup':
        job['status'] = 'verified';
        return {'success': true, 'message': 'Backup verified · $name'};
      default:
        throw ArgumentError('Unknown manual backup action: $action');
    }
  }

  static Map<String, dynamic> performCloudAction({
    required String syncId,
    required String action,
  }) {
    final job = _find(_cloud, syncId);
    if (job == null) {
      throw ArgumentError('Cloud sync job not found');
    }

    final name = job['syncName'] as String;

    switch (action) {
      case 'sync_now':
        job['status'] = 'syncing';
        job['lagMinutes'] = 0;
        _completedToday++;
        return {'success': true, 'message': 'Cloud sync started · $name'};
      case 'retry_sync':
        job['status'] = 'retrying';
        job['lagMinutes'] = 0;
        return {'success': true, 'message': 'Cloud sync retried · $name'};
      case 'pause_sync':
        job['status'] = 'paused';
        return {'success': true, 'message': 'Cloud sync paused · $name'};
      default:
        throw ArgumentError('Unknown cloud sync action: $action');
    }
  }

  static Map<String, dynamic> performRestoreAction({
    required String restoreId,
    required String action,
  }) {
    final point = _find(_restores, restoreId);
    if (point == null) {
      throw ArgumentError('Recovery restore point not found');
    }

    final label = point['restoreLabel'] as String;

    switch (action) {
      case 'initiate_restore':
        point['status'] = 'restoring';
        _completedToday++;
        return {'success': true, 'message': 'Restore initiated · $label'};
      case 'verify_restore':
        point['integrity'] = 'verified';
        point['status'] = 'verified';
        return {'success': true, 'message': 'Restore point verified · $label'};
      case 'cancel_restore':
        point['status'] = 'available';
        return {'success': true, 'message': 'Restore cancelled · $label'};
      default:
        throw ArgumentError('Unknown restore action: $action');
    }
  }

  static Map<String, dynamic> performRecoveryAction({
    required String recoveryId,
    required String action,
  }) {
    final task = _find(_recovery, recoveryId);
    if (task == null) {
      throw ArgumentError('Data recovery task not found');
    }

    final name = task['taskName'] as String;

    switch (action) {
      case 'start_recovery':
        task['status'] = 'running';
        _completedToday++;
        return {'success': true, 'message': 'Data recovery started · $name'};
      case 'prioritize_recovery':
        task['priority'] = 'high';
        task['status'] = 'priority';
        return {'success': true, 'message': 'Recovery prioritized · $name'};
      case 'cancel_recovery':
        task['status'] = 'cancelled';
        return {'success': true, 'message': 'Recovery cancelled · $name'};
      default:
        throw ArgumentError('Unknown data recovery action: $action');
    }
  }

  static Map<String, dynamic> runAll() {
    for (final job in _auto) {
      if (job['status'] == 'active') {
        job['lastRunLabel'] = 'Just now';
      }
    }
    for (final job in _cloud) {
      if (job['status'] != 'paused') {
        job['lagMinutes'] = 0;
        job['status'] = 'synced';
      }
    }
    _completedToday += 4;
    return {
      'success': true,
      'message': 'Backup & recovery run completed · all schedules triggered',
    };
  }

  static int get completedToday => _completedToday;

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

  static Map<String, dynamic> _serializeAuto(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'jobName': item['jobName'],
      'section': item['section'],
      'scheduleLabel': item['scheduleLabel'],
      'lastRunLabel': item['lastRunLabel'],
      'status': item['status'],
      'availableActions': const ['enable_schedule', 'run_now', 'pause_schedule'],
    };
  }

  static Map<String, dynamic> _serializeManual(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'backupName': item['backupName'],
      'section': item['section'],
      'sizeLabel': item['sizeLabel'],
      'requestedBy': item['requestedBy'],
      'status': item['status'],
      'availableActions': const ['start_backup', 'cancel_backup', 'verify_backup'],
    };
  }

  static Map<String, dynamic> _serializeCloud(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'syncName': item['syncName'],
      'section': item['section'],
      'destination': item['destination'],
      'lagMinutes': item['lagMinutes'],
      'status': item['status'],
      'availableActions': const ['sync_now', 'retry_sync', 'pause_sync'],
    };
  }

  static Map<String, dynamic> _serializeRestore(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'restoreLabel': item['restoreLabel'],
      'section': item['section'],
      'createdAt': item['createdAt'],
      'integrity': item['integrity'],
      'status': item['status'],
      'availableActions': const [
        'initiate_restore',
        'verify_restore',
        'cancel_restore',
      ],
    };
  }

  static Map<String, dynamic> _serializeRecovery(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'taskName': item['taskName'],
      'section': item['section'],
      'dataScope': item['dataScope'],
      'priority': item['priority'],
      'status': item['status'],
      'availableActions': const [
        'start_recovery',
        'prioritize_recovery',
        'cancel_recovery',
      ],
    };
  }

  static List<Map<String, dynamic>> _seedAuto() {
    return [
      {
        'id': 'BK-AUT-001',
        'jobName': 'Nightly kitchen snapshot',
        'section': 'Main',
        'scheduleLabel': 'Daily 02:00',
        'lastRunLabel': '6 hr ago',
        'status': 'active',
      },
      {
        'id': 'BK-AUT-002',
        'jobName': 'Hourly order queue backup',
        'section': 'Main',
        'scheduleLabel': 'Every hour',
        'lastRunLabel': '42 min ago',
        'status': 'active',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedManual() {
    return [
      {
        'id': 'BK-MAN-001',
        'backupName': 'Pre-banquet full backup',
        'section': 'Continental',
        'sizeLabel': '2.4 GB',
        'requestedBy': 'Banquet manager',
        'status': 'pending',
      },
      {
        'id': 'BK-MAN-002',
        'backupName': 'Menu revision snapshot',
        'section': 'Main',
        'sizeLabel': '860 MB',
        'requestedBy': 'Chef Rahul',
        'status': 'verified',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedCloud() {
    return [
      {
        'id': 'BK-CLD-001',
        'syncName': 'Azure kitchen data sync',
        'section': 'Main',
        'destination': 'Azure Blob',
        'lagMinutes': 0,
        'status': 'syncing',
      },
      {
        'id': 'BK-CLD-002',
        'syncName': 'Branch config sync',
        'section': 'Main',
        'destination': 'Cloud hub',
        'lagMinutes': 8,
        'status': 'lagging',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedRestores() {
    return [
      {
        'id': 'BK-RST-001',
        'restoreLabel': 'Restore point · Jun 5 23:00',
        'section': 'Main',
        'createdAt': 'Jun 5 23:00',
        'integrity': 'verified',
        'status': 'available',
      },
      {
        'id': 'BK-RST-002',
        'restoreLabel': 'Rollback · Jun 4 prep board',
        'section': 'Main',
        'createdAt': 'Jun 4 18:30',
        'integrity': 'pending',
        'status': 'available',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedRecovery() {
    return [
      {
        'id': 'BK-RCV-001',
        'taskName': 'Recover deleted prep list',
        'section': 'Main',
        'dataScope': 'Prep board',
        'priority': 'high',
        'status': 'queued',
      },
      {
        'id': 'BK-RCV-002',
        'taskName': 'Rebuild KDS cache',
        'section': 'Main',
        'dataScope': 'Live KDS',
        'priority': 'medium',
        'status': 'running',
      },
    ];
  }
}

class MockBackupRecoveryEngine {
  const MockBackupRecoveryEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final autoBackups = MockBackupRecoveryRegistry.autoFor(section);
    final manualBackups = MockBackupRecoveryRegistry.manualFor(section);
    final cloudSyncJobs = MockBackupRecoveryRegistry.cloudFor(section);
    final recoveryRestores = MockBackupRecoveryRegistry.restoresFor(section);
    final dataRecoveryTasks = MockBackupRecoveryRegistry.recoveryFor(section);

    final maxLag = cloudSyncJobs.isEmpty
        ? 0
        : cloudSyncJobs
            .map((item) => item['lagMinutes'] as int)
            .reduce((a, b) => a > b ? a : b);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'autoBackups': autoBackups,
      'manualBackups': manualBackups,
      'cloudSyncJobs': cloudSyncJobs,
      'recoveryRestores': recoveryRestores,
      'dataRecoveryTasks': dataRecoveryTasks,
      'stats': {
        'activeAutoBackups':
            autoBackups.where((item) => item['status'] == 'active').length,
        'pendingManualBackups':
            manualBackups.where((item) => item['status'] == 'pending').length,
        'cloudSyncLagMinutes': maxLag,
        'availableRestorePoints': recoveryRestores
            .where((item) => item['status'] == 'available')
            .length,
        'activeRecoveries': dataRecoveryTasks
            .where((item) =>
                item['status'] == 'running' || item['status'] == 'queued')
            .length,
        'completedToday': MockBackupRecoveryRegistry.completedToday,
      },
      'backupFeatures': {
        'autoBackup': autoBackups.isNotEmpty,
        'manualBackup': manualBackups.isNotEmpty,
        'cloudSynchronization': cloudSyncJobs.isNotEmpty,
        'recoveryRestore': recoveryRestores.isNotEmpty,
        'dataRecovery': dataRecoveryTasks.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
