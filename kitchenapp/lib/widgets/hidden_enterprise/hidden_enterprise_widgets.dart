import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/hidden_enterprise/hidden_enterprise_snapshot.dart';

class HiddenEnterpriseSidePanel extends StatelessWidget {
  const HiddenEnterpriseSidePanel({
    super.key,
    required this.stats,
    required this.features,
    required this.onActivateAll,
    required this.processing,
  });

  final HiddenEnterpriseStats stats;
  final HiddenEnterpriseFeatureFlags features;
  final VoidCallback onActivateAll;
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
            'Hidden systems metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Recoverable items', '${stats.recoverableItems}'),
          _StatRow('Restorable orders', '${stats.restorableOrders}'),
          _StatRow('Replays available', '${stats.replayAvailable}'),
          _StatRow('Version snapshots', '${stats.versionSnapshots}'),
          _StatRow('Tracked devices', '${stats.trackedDevices}'),
          _StatRow('Active sessions', '${stats.activeSessions}'),
          _StatRow('Lockdown armed', '${stats.lockdownArmed}'),
          _StatRow('Queue recoveries', '${stats.queueRecoveries}'),
          const SizedBox(height: 16),
          Text(
            'Hidden systems',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Soft delete recovery', features.softDeleteRecovery),
          _FeatureChip('Restore deleted orders', features.restoreDeletedOrders),
          _FeatureChip('Action replay', features.actionReplay),
          _FeatureChip('Version logs', features.versionLogs),
          _FeatureChip('Device tracking', features.deviceTracking),
          _FeatureChip('Session logs', features.sessionLogs),
          _FeatureChip('Emergency lockdown', features.emergencyLockdownMode),
          _FeatureChip('Queue recovery engine', features.queueRecoveryEngine),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onActivateAll,
              icon: const Icon(Icons.admin_panel_settings_outlined, size: 18),
              label: const Text('Activate hidden systems'),
              style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            ),
          ),
        ],
      ),
    );
  }
}

class HiddenEnterpriseSection extends StatelessWidget {
  const HiddenEnterpriseSection({
    super.key,
    required this.title,
    required this.emptyMessage,
    required this.items,
    required this.onAction,
  });

  final String title;
  final String emptyMessage;
  final List<HiddenEnterpriseItemView> items;
  final void Function(String id, String action) onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 12),
          child: Text(
            title,
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
        ),
        if (items.isEmpty)
          _EmptyBox(message: emptyMessage)
        else
          Column(
            children: items
                .map(
                  (item) => _HiddenCard(
                    title: item.title,
                    subtitle: item.subtitle,
                    tagLabel: item.tagLabel,
                    tagColor: item.tagColor,
                    actions: item.actions,
                    primaryActions: item.primaryActions,
                    onAction: (action) => onAction(item.id, action),
                  ),
                )
                .toList(),
          ),
      ],
    );
  }
}

class HiddenEnterpriseItemView {
  const HiddenEnterpriseItemView({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.tagLabel,
    required this.tagColor,
    required this.actions,
    required this.primaryActions,
  });

  final String id;
  final String title;
  final String subtitle;
  final String tagLabel;
  final Color tagColor;
  final List<String> actions;
  final Set<String> primaryActions;
}

HiddenEnterpriseItemView softDeleteItemView(SoftDeleteItem item) {
  return HiddenEnterpriseItemView(
    id: item.id,
    title: item.itemName,
    subtitle: '${item.section} · ${item.deletedAt} · ${item.retentionLabel}',
    tagLabel: item.status,
    tagColor: AppColors.warning,
    actions: item.availableActions,
    primaryActions: const {'recover_item'},
  );
}

HiddenEnterpriseItemView deletedOrderItemView(DeletedOrderRestore item) {
  return HiddenEnterpriseItemView(
    id: item.id,
    title: item.orderLabel,
    subtitle: '${item.section} · ${item.orderType} · ${item.deletedAt}',
    tagLabel: item.status,
    tagColor: AppColors.info,
    actions: item.availableActions,
    primaryActions: const {'restore_order'},
  );
}

HiddenEnterpriseItemView actionReplayItemView(ActionReplayEntry item) {
  return HiddenEnterpriseItemView(
    id: item.id,
    title: item.replayLabel,
    subtitle: '${item.section} · ${item.actorName} · ${item.stepCount} steps',
    tagLabel: item.status,
    tagColor: AppColors.premium,
    actions: item.availableActions,
    primaryActions: const {'replay_actions'},
  );
}

HiddenEnterpriseItemView versionLogItemView(VersionLogEntry item) {
  return HiddenEnterpriseItemView(
    id: item.id,
    title: item.versionLabel,
    subtitle: '${item.section} · ${item.snapshotType} · ${item.createdAt}',
    tagLabel: item.status,
    tagColor: AppColors.primary,
    actions: item.availableActions,
    primaryActions: const {'restore_version'},
  );
}

HiddenEnterpriseItemView deviceTrackingItemView(DeviceTrackingEntry item) {
  return HiddenEnterpriseItemView(
    id: item.id,
    title: item.deviceName,
    subtitle: '${item.section} · ${item.sessionLabel} · ${item.lastSeen}',
    tagLabel: item.status,
    tagColor: AppColors.primary,
    actions: item.availableActions,
    primaryActions: const {'trace_device'},
  );
}

HiddenEnterpriseItemView sessionLogItemView(SessionLogEntry item) {
  return HiddenEnterpriseItemView(
    id: item.id,
    title: item.sessionLabel,
    subtitle: '${item.section} · ${item.userName} · ${item.durationLabel}',
    tagLabel: item.status,
    tagColor: item.status == 'active' ? AppColors.warning : AppColors.secondaryText,
    actions: item.availableActions,
    primaryActions: const {'review_session'},
  );
}

HiddenEnterpriseItemView lockdownItemView(EmergencyLockdownEntry item) {
  return HiddenEnterpriseItemView(
    id: item.id,
    title: item.lockdownName,
    subtitle: '${item.section} · ${item.scopeLabel} · ${item.severity}',
    tagLabel: item.status,
    tagColor: AppColors.danger,
    actions: item.availableActions,
    primaryActions: const {'arm_lockdown'},
  );
}

HiddenEnterpriseItemView queueRecoveryItemView(QueueRecoveryEntry item) {
  return HiddenEnterpriseItemView(
    id: item.id,
    title: item.queueName,
    subtitle:
        '${item.section} · ${item.ordersAffected} orders · ${item.recoveryMode}',
    tagLabel: item.status,
    tagColor: AppColors.warning,
    actions: item.availableActions,
    primaryActions: const {'recover_queue'},
  );
}

class _HiddenCard extends StatelessWidget {
  const _HiddenCard({
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
                            style: action == 'arm_lockdown'
                                ? FilledButton.styleFrom(
                                    backgroundColor: AppColors.danger,
                                  )
                                : null,
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
      'recover_item' => 'Recover',
      'purge_item' => 'Purge',
      'extend_retention' => 'Extend',
      'restore_order' => 'Restore',
      'preview_order' => 'Preview',
      'discard_order' => 'Discard',
      'replay_actions' => 'Replay',
      'export_replay' => 'Export',
      'archive_replay' => 'Archive',
      'restore_version' => 'Restore',
      'compare_version' => 'Compare',
      'archive_version' => 'Archive',
      'trace_device' => 'Trace',
      'revoke_device' => 'Revoke',
      'flag_device' => 'Flag',
      'review_session' => 'Review',
      'terminate_session' => 'Terminate',
      'export_session' => 'Export',
      'arm_lockdown' => 'Arm',
      'release_lockdown' => 'Release',
      'test_lockdown' => 'Test',
      'recover_queue' => 'Recover',
      'rebuild_queue' => 'Rebuild',
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
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: active ? AppColors.primaryText : AppColors.secondaryText,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
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
