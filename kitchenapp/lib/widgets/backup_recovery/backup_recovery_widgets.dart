import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/backup_recovery/backup_recovery_snapshot.dart';

class AutoBackupList extends StatelessWidget {
  const AutoBackupList({
    super.key,
    required this.jobs,
    required this.onAction,
  });

  final List<AutoBackupJob> jobs;
  final ValueChanged<(AutoBackupJob job, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _BackupList(
      emptyMessage: 'No auto backup jobs',
      items: jobs
          .map(
            (job) => _BackupCard(
              title: job.jobName,
              subtitle:
                  '${job.section} · ${job.scheduleLabel} · Last ${job.lastRunLabel}',
              tagLabel: job.status,
              tagColor: job.status == 'active'
                  ? AppColors.primary
                  : AppColors.secondaryText,
              actions: job.availableActions,
              primaryActions: const {'run_now'},
              onAction: (action) => onAction((job, action)),
            ),
          )
          .toList(),
    );
  }
}

class ManualBackupList extends StatelessWidget {
  const ManualBackupList({
    super.key,
    required this.backups,
    required this.onAction,
  });

  final List<ManualBackupJob> backups;
  final ValueChanged<(ManualBackupJob backup, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _BackupList(
      emptyMessage: 'No manual backups',
      items: backups
          .map(
            (backup) => _BackupCard(
              title: backup.backupName,
              subtitle:
                  '${backup.section} · ${backup.sizeLabel} · ${backup.requestedBy}',
              tagLabel: backup.status,
              tagColor: backup.status == 'pending'
                  ? AppColors.warning
                  : AppColors.primary,
              actions: backup.availableActions,
              primaryActions: const {'start_backup'},
              onAction: (action) => onAction((backup, action)),
            ),
          )
          .toList(),
    );
  }
}

class CloudSyncList extends StatelessWidget {
  const CloudSyncList({
    super.key,
    required this.jobs,
    required this.onAction,
  });

  final List<CloudSyncJob> jobs;
  final ValueChanged<(CloudSyncJob job, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _BackupList(
      emptyMessage: 'No cloud sync jobs',
      items: jobs
          .map(
            (job) => _BackupCard(
              title: job.syncName,
              subtitle:
                  '${job.section} → ${job.destination} · ${job.lagMinutes} min lag',
              tagLabel: job.status,
              tagColor: job.lagMinutes > 0
                  ? AppColors.warning
                  : AppColors.info,
              actions: job.availableActions,
              primaryActions: const {'sync_now'},
              onAction: (action) => onAction((job, action)),
            ),
          )
          .toList(),
    );
  }
}

class RecoveryRestoreList extends StatelessWidget {
  const RecoveryRestoreList({
    super.key,
    required this.points,
    required this.onAction,
  });

  final List<RecoveryRestorePoint> points;
  final ValueChanged<(RecoveryRestorePoint point, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _BackupList(
      emptyMessage: 'No restore points',
      items: points
          .map(
            (point) => _BackupCard(
              title: point.restoreLabel,
              subtitle:
                  '${point.section} · ${point.createdAt} · ${point.integrity}',
              tagLabel: point.status,
              tagColor: point.integrity == 'verified'
                  ? AppColors.primary
                  : AppColors.warning,
              actions: point.availableActions,
              primaryActions: const {'initiate_restore'},
              onAction: (action) => onAction((point, action)),
            ),
          )
          .toList(),
    );
  }
}

class DataRecoveryList extends StatelessWidget {
  const DataRecoveryList({
    super.key,
    required this.tasks,
    required this.onAction,
  });

  final List<DataRecoveryTask> tasks;
  final ValueChanged<(DataRecoveryTask task, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _BackupList(
      emptyMessage: 'No data recovery tasks',
      items: tasks
          .map(
            (task) => _BackupCard(
              title: task.taskName,
              subtitle:
                  '${task.section} · ${task.dataScope} · ${task.priority}',
              tagLabel: task.status,
              tagColor: task.priority == 'high'
                  ? AppColors.danger
                  : AppColors.info,
              actions: task.availableActions,
              primaryActions: const {'start_recovery'},
              onAction: (action) => onAction((task, action)),
            ),
          )
          .toList(),
    );
  }
}

class BackupRecoverySidePanel extends StatelessWidget {
  const BackupRecoverySidePanel({
    super.key,
    required this.stats,
    required this.features,
    required this.onRunAll,
    required this.processing,
  });

  final BackupRecoveryStats stats;
  final BackupRecoveryFeatureFlags features;
  final VoidCallback onRunAll;
  final bool processing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Backup metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Active auto backups', '${stats.activeAutoBackups}'),
          _StatRow('Pending manual', '${stats.pendingManualBackups}'),
          _StatRow('Cloud sync lag', '${stats.cloudSyncLagMinutes} min'),
          _StatRow('Restore points', '${stats.availableRestorePoints}'),
          _StatRow('Active recoveries', '${stats.activeRecoveries}'),
          _StatRow('Completed today', '${stats.completedToday}'),
          const SizedBox(height: 16),
          Text(
            'Backup features',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Auto backup', features.autoBackup),
          _FeatureChip('Manual backup', features.manualBackup),
          _FeatureChip('Cloud synchronization', features.cloudSynchronization),
          _FeatureChip('Recovery restore', features.recoveryRestore),
          _FeatureChip('Data recovery', features.dataRecovery),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onRunAll,
              icon: const Icon(Icons.backup_outlined, size: 18),
              label: const Text('Run all backups'),
            ),
          ),
        ],
      ),
    );
  }
}

class _BackupList extends StatelessWidget {
  const _BackupList({required this.emptyMessage, required this.items});

  final String emptyMessage;
  final List<Widget> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return _EmptyBox(message: emptyMessage);
    }

    return Column(children: items);
  }
}

class _BackupCard extends StatelessWidget {
  const _BackupCard({
    required this.title,
    required this.subtitle,
    required this.tagLabel,
    required this.tagColor,
    required this.actions,
    required this.primaryActions,
    required this.onAction,
  });

  final String title;
  final String subtitle;
  final String tagLabel;
  final Color tagColor;
  final List<String> actions;
  final Set<String> primaryActions;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _Tag(label: tagLabel, color: tagColor),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          if (actions.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: actions
                  .map(
                    (action) => primaryActions.contains(action)
                        ? FilledButton(
                            onPressed: () => onAction(action),
                            child: Text(_actionLabel(action)),
                          )
                        : OutlinedButton(
                            onPressed: () => onAction(action),
                            child: Text(_actionLabel(action)),
                          ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'enable_schedule' => 'Enable',
      'run_now' => 'Run now',
      'pause_schedule' => 'Pause',
      'start_backup' => 'Start',
      'cancel_backup' => 'Cancel',
      'verify_backup' => 'Verify',
      'sync_now' => 'Sync',
      'retry_sync' => 'Retry',
      'pause_sync' => 'Pause',
      'initiate_restore' => 'Restore',
      'verify_restore' => 'Verify',
      'cancel_restore' => 'Cancel',
      'start_recovery' => 'Start',
      'prioritize_recovery' => 'Prioritize',
      'cancel_recovery' => 'Cancel',
      _ => action,
    };
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureChip extends StatelessWidget {
  const _FeatureChip(this.label, this.active);

  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(
            active ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 16,
            color: active ? AppColors.premium : AppColors.secondaryText,
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: active ? AppColors.primaryText : AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  const _EmptyBox({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Text(
        message,
        style: TextStyle(
          color: AppColors.secondaryText,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
