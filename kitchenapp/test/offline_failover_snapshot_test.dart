import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/offline_failover/offline_failover_snapshot.dart';

void main() {
  test('offline failover snapshot parses API payload', () {
    final snapshot = OfflineFailoverSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'connectivityStatus': 'degraded',
      'sections': ['All', 'Main'],
      'offlineModules': [
        {
          'id': 'OFF-KDS-001',
          'moduleName': 'Offline KDS',
          'moduleType': 'offline_kds',
          'section': 'Main',
          'status': 'offline',
          'lastSyncedAt': '12 min ago',
          'pendingCount': 6,
          'availableActions': ['force_sync_module'],
        },
      ],
      'queuedItems': [
        {
          'id': 'Q-001',
          'itemType': 'order',
          'label': 'KOT-1042 · butter chicken',
          'section': 'Main',
          'queuedAt': '11 min ago',
          'status': 'pending',
          'availableActions': ['retry_sync'],
        },
      ],
      'recoveryJobs': [
        {
          'id': 'REC-001',
          'jobName': 'Main section queue recovery',
          'section': 'Main',
          'progress': 0,
          'status': 'pending',
          'availableActions': ['start_recovery'],
        },
      ],
      'stats': {
        'connectivityStatus': 'degraded',
        'offlineModulesCount': 1,
        'pendingQueueItems': 1,
        'activeRecoveryJobs': 1,
        'syncedToday': 14,
        'lastRestoreAt': '18 min ago',
      },
      'failoverFeatures': {
        'offlineKds': true,
        'offlineOrderSync': false,
        'offlinePrepTracking': false,
        'queueRecovery': true,
        'autoSyncRestoration': true,
      },
    });

    expect(snapshot.offlineModules.length, 1);
    expect(snapshot.connectivityStatus, 'degraded');
    expect(snapshot.failoverFeatures.offlineKds, isTrue);
    expect(snapshot.stats.syncedToday, 14);
  });
}
