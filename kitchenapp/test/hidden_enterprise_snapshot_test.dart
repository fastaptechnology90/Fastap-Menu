import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/hidden_enterprise/hidden_enterprise_snapshot.dart';

void main() {
  test('hidden enterprise snapshot parses API payload', () {
    final snapshot = HiddenEnterpriseSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'softDeleteItems': [
        {
          'id': 'HE-SD-001',
          'itemName': 'Prep list batch #44',
          'section': 'Main',
          'deletedAt': '2 hr ago',
          'retentionLabel': '7 days',
          'status': 'recoverable',
          'availableActions': ['recover_item'],
        },
      ],
      'deletedOrders': [
        {
          'id': 'HE-ORD-001',
          'orderLabel': 'Order #2801 VIP',
          'section': 'Main',
          'deletedAt': '45 min ago',
          'orderType': 'VIP',
          'status': 'restorable',
          'availableActions': ['restore_order'],
        },
      ],
      'actionReplays': [
        {
          'id': 'HE-RPL-001',
          'replayLabel': 'KDS bump sequence · #2847',
          'section': 'Main',
          'actorName': 'Chef Rahul',
          'stepCount': 6,
          'status': 'available',
          'availableActions': ['replay_actions'],
        },
      ],
      'versionLogs': [
        {
          'id': 'HE-VER-001',
          'versionLabel': 'Menu v2.4 rollback point',
          'section': 'Main',
          'snapshotType': 'Menu config',
          'createdAt': 'Jun 5 18:00',
          'status': 'archived',
          'availableActions': ['restore_version'],
        },
      ],
      'deviceTracking': [
        {
          'id': 'HE-DEV-001',
          'deviceName': 'Pass printer terminal',
          'section': 'Main',
          'lastSeen': '3 min ago',
          'sessionLabel': 'Active shift',
          'status': 'tracked',
          'availableActions': ['trace_device'],
        },
      ],
      'sessionLogs': [
        {
          'id': 'HE-SES-001',
          'sessionLabel': 'Chef Rahul kitchen session',
          'section': 'Main',
          'userName': 'Chef Rahul',
          'durationLabel': '4h 12m',
          'status': 'active',
          'availableActions': ['review_session'],
        },
      ],
      'emergencyLockdowns': [
        {
          'id': 'HE-LCK-001',
          'lockdownName': 'Pass station lockdown',
          'section': 'Main',
          'scopeLabel': 'Pass + expo',
          'severity': 'high',
          'status': 'standby',
          'availableActions': ['arm_lockdown'],
        },
      ],
      'queueRecoveries': [
        {
          'id': 'HE-QUE-001',
          'queueName': 'Main line queue rebuild',
          'section': 'Main',
          'ordersAffected': 14,
          'recoveryMode': 'standard',
          'status': 'pending',
          'availableActions': ['recover_queue'],
        },
      ],
      'stats': {
        'recoverableItems': 1,
        'restorableOrders': 1,
        'replayAvailable': 1,
        'versionSnapshots': 1,
        'trackedDevices': 1,
        'activeSessions': 1,
        'lockdownArmed': 0,
        'queueRecoveries': 1,
      },
      'hiddenFeatures': {
        'softDeleteRecovery': true,
        'restoreDeletedOrders': true,
        'actionReplay': true,
        'versionLogs': true,
        'deviceTracking': true,
        'sessionLogs': true,
        'emergencyLockdownMode': true,
        'queueRecoveryEngine': true,
      },
    });

    expect(snapshot.softDeleteItems.first.itemName, 'Prep list batch #44');
    expect(snapshot.deletedOrders.first.orderLabel, 'Order #2801 VIP');
    expect(snapshot.hiddenFeatures.queueRecoveryEngine, isTrue);
    expect(snapshot.stats.recoverableItems, 1);
  });
}
