import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/backup_recovery/backup_recovery_snapshot.dart';

void main() {
  test('backup recovery snapshot parses API payload', () {
    final snapshot = BackupRecoverySnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'autoBackups': [
        {
          'id': 'BK-AUT-001',
          'jobName': 'Nightly kitchen snapshot',
          'section': 'Main',
          'scheduleLabel': 'Daily 02:00',
          'lastRunLabel': '6 hr ago',
          'status': 'active',
          'availableActions': ['run_now'],
        },
      ],
      'manualBackups': [
        {
          'id': 'BK-MAN-001',
          'backupName': 'Pre-banquet full backup',
          'section': 'Continental',
          'sizeLabel': '2.4 GB',
          'requestedBy': 'Banquet manager',
          'status': 'pending',
          'availableActions': ['start_backup'],
        },
      ],
      'cloudSyncJobs': [
        {
          'id': 'BK-CLD-001',
          'syncName': 'Azure kitchen data sync',
          'section': 'Main',
          'destination': 'Azure Blob',
          'lagMinutes': 0,
          'status': 'syncing',
          'availableActions': ['sync_now'],
        },
      ],
      'recoveryRestores': [
        {
          'id': 'BK-RST-001',
          'restoreLabel': 'Restore point · Jun 5 23:00',
          'section': 'Main',
          'createdAt': 'Jun 5 23:00',
          'integrity': 'verified',
          'status': 'available',
          'availableActions': ['initiate_restore'],
        },
      ],
      'dataRecoveryTasks': [
        {
          'id': 'BK-RCV-001',
          'taskName': 'Recover deleted prep list',
          'section': 'Main',
          'dataScope': 'Prep board',
          'priority': 'high',
          'status': 'queued',
          'availableActions': ['start_recovery'],
        },
      ],
      'stats': {
        'activeAutoBackups': 1,
        'pendingManualBackups': 1,
        'cloudSyncLagMinutes': 0,
        'availableRestorePoints': 1,
        'activeRecoveries': 1,
        'completedToday': 9,
      },
      'backupFeatures': {
        'autoBackup': true,
        'manualBackup': true,
        'cloudSynchronization': true,
        'recoveryRestore': true,
        'dataRecovery': true,
      },
    });

    expect(snapshot.autoBackups.first.jobName, 'Nightly kitchen snapshot');
    expect(snapshot.manualBackups.first.sizeLabel, '2.4 GB');
    expect(snapshot.backupFeatures.dataRecovery, isTrue);
    expect(snapshot.stats.completedToday, 9);
  });
}
