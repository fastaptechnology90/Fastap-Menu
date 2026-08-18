import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/offline_failover/offline_failover_snapshot.dart';

class OfflineModuleCard extends StatelessWidget {
  const OfflineModuleCard({
    super.key,
    required this.module,
    required this.onAction,
  });

  final OfflineModuleStatus module;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (module.status) {
      'online' => AppColors.primary,
      'offline' => AppColors.warning,
      'syncing' => AppColors.info,
      _ => AppColors.secondaryText,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: statusColor.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  module.moduleName,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: module.status, color: statusColor),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${module.section} · ${module.pendingCount} pending · synced ${module.lastSyncedAt}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          if (module.availableActions.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: module.availableActions
                  .map(
                    (action) => action == 'force_sync_module' ||
                            action == 'disable_offline_mode'
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
      'enable_offline_mode' => 'Go offline',
      'disable_offline_mode' => 'Go online',
      'force_sync_module' => 'Force sync',
      _ => action,
    };
  }
}

class FailoverQueueList extends StatelessWidget {
  const FailoverQueueList({
    super.key,
    required this.items,
    required this.onAction,
  });

  final List<FailoverQueueItem> items;
  final ValueChanged<(FailoverQueueItem item, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyBox(message: 'Failover queue empty');
    }

    return Column(
      children: items
          .map(
            (item) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.label,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(label: item.status, color: AppColors.info),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.section} · ${item.itemType} · queued ${item.queuedAt}',
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  if (item.availableActions.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: item.availableActions
                          .map(
                            (action) => action == 'retry_sync'
                                ? FilledButton(
                                    onPressed: () => onAction((item, action)),
                                    child: Text(_actionLabel(action)),
                                  )
                                : OutlinedButton(
                                    onPressed: () => onAction((item, action)),
                                    child: Text(_actionLabel(action)),
                                  ),
                          )
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'retry_sync' => 'Retry sync',
      'prioritize_item' => 'Prioritize',
      'discard_item' => 'Discard',
      _ => action,
    };
  }
}

class QueueRecoveryList extends StatelessWidget {
  const QueueRecoveryList({
    super.key,
    required this.jobs,
    required this.onAction,
  });

  final List<QueueRecoveryJob> jobs;
  final ValueChanged<(QueueRecoveryJob job, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (jobs.isEmpty) {
      return const _EmptyBox(message: 'No recovery jobs');
    }

    return Column(
      children: jobs
          .map(
            (job) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
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
                          job.jobName,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(label: job.status, color: AppColors.warning),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${job.section} · ${job.progress}% complete',
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: job.progress / 100,
                    backgroundColor: AppColors.panelBorder,
                    color: AppColors.primary,
                  ),
                  if (job.availableActions.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: job.availableActions
                          .map(
                            (action) => action == 'start_recovery' ||
                                    action == 'complete_recovery'
                                ? FilledButton(
                                    onPressed: () => onAction((job, action)),
                                    child: Text(_actionLabel(action)),
                                  )
                                : OutlinedButton(
                                    onPressed: () => onAction((job, action)),
                                    child: Text(_actionLabel(action)),
                                  ),
                          )
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'start_recovery' => 'Start',
      'pause_recovery' => 'Pause',
      'complete_recovery' => 'Complete',
      _ => action,
    };
  }
}

class OfflineFailoverSidePanel extends StatelessWidget {
  const OfflineFailoverSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onRestoreSync,
    required this.onSyncAll,
    required this.processing,
  });

  final OfflineFailoverStats stats;
  final OfflineFailoverFeatureFlags flags;
  final VoidCallback onRestoreSync;
  final VoidCallback onSyncAll;
  final bool processing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Failover metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Connectivity', stats.connectivityStatus),
          _StatRow('Offline modules', '${stats.offlineModulesCount}'),
          _StatRow('Pending queue', '${stats.pendingQueueItems}'),
          _StatRow('Recovery jobs', '${stats.activeRecoveryJobs}'),
          _StatRow('Synced today', '${stats.syncedToday}'),
          _StatRow('Last restore', stats.lastRestoreAt),
          const SizedBox(height: 16),
          const Text(
            'Offline modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Offline KDS', flags.offlineKds),
          _FeatureChip('Offline order sync', flags.offlineOrderSync),
          _FeatureChip('Offline prep tracking', flags.offlinePrepTracking),
          _FeatureChip('Queue recovery', flags.queueRecovery),
          _FeatureChip('Auto sync restoration', flags.autoSyncRestoration),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onRestoreSync,
              icon: const Icon(Icons.cloud_sync_outlined, size: 18),
              label: const Text('Restore sync'),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: processing ? null : onSyncAll,
              icon: const Icon(Icons.sync, size: 18),
              label: const Text('Sync failover board'),
            ),
          ),
        ],
      ),
    );
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
              style: const TextStyle(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
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
            color: active ? AppColors.primary : AppColors.secondaryText,
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: AppColors.secondaryText,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
