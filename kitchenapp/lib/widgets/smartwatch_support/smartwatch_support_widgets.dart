import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/smartwatch_support/smartwatch_support_snapshot.dart';

class WatchOrderAlertList extends StatelessWidget {
  const WatchOrderAlertList({
    super.key,
    required this.alerts,
    required this.onAction,
  });

  final List<WatchOrderAlert> alerts;
  final ValueChanged<(WatchOrderAlert alert, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _WatchAlertList(
      emptyMessage: 'No order alerts',
      items: alerts
          .map(
            (alert) => _WatchAlertCard(
              title: alert.title,
              subtitle:
                  '${alert.section} · ${alert.priority} · ${alert.recipient}',
              tagLabel: alert.status,
              tagColor: _priorityColor(alert.priority),
              actions: alert.availableActions,
              primaryActions: const {'push_to_watch'},
              onAction: (action) => onAction((alert, action)),
            ),
          )
          .toList(),
    );
  }
}

class WatchDelayAlertList extends StatelessWidget {
  const WatchDelayAlertList({
    super.key,
    required this.alerts,
    required this.onAction,
  });

  final List<WatchDelayAlert> alerts;
  final ValueChanged<(WatchDelayAlert alert, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _WatchAlertList(
      emptyMessage: 'No delay alerts',
      items: alerts
          .map(
            (alert) => _WatchAlertCard(
              title: alert.title,
              subtitle:
                  '${alert.section} · ${alert.delayMinutes} min · ${alert.severity}',
              tagLabel: alert.status,
              tagColor: _severityColor(alert.severity),
              actions: alert.availableActions,
              primaryActions: const {'push_to_watch', 'escalate_delay'},
              onAction: (action) => onAction((alert, action)),
            ),
          )
          .toList(),
    );
  }
}

class WatchEmergencyAlertList extends StatelessWidget {
  const WatchEmergencyAlertList({
    super.key,
    required this.alerts,
    required this.onAction,
  });

  final List<WatchEmergencyAlert> alerts;
  final ValueChanged<(WatchEmergencyAlert alert, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _WatchAlertList(
      emptyMessage: 'No emergency alerts',
      items: alerts
          .map(
            (alert) => _WatchAlertCard(
              title: alert.title,
              subtitle:
                  '${alert.section} · ${alert.alertType} · ${alert.severity}',
              tagLabel: alert.status,
              tagColor: AppColors.danger,
              actions: alert.availableActions,
              primaryActions: const {'broadcast_emergency'},
              onAction: (action) => onAction((alert, action)),
            ),
          )
          .toList(),
    );
  }
}

class WatchTaskNotificationList extends StatelessWidget {
  const WatchTaskNotificationList({
    super.key,
    required this.tasks,
    required this.onAction,
  });

  final List<WatchTaskNotification> tasks;
  final ValueChanged<(WatchTaskNotification task, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _WatchAlertList(
      emptyMessage: 'No task notifications',
      items: tasks
          .map(
            (task) => _WatchAlertCard(
              title: task.title,
              subtitle:
                  '${task.section} · ${task.assignee} · Due ${task.dueLabel}',
              tagLabel: task.status,
              tagColor: task.status == 'completed'
                  ? AppColors.primary
                  : AppColors.warning,
              actions: task.availableActions,
              primaryActions: const {'push_to_watch', 'mark_done'},
              onAction: (action) => onAction((task, action)),
            ),
          )
          .toList(),
    );
  }
}

class SmartwatchSupportSidePanel extends StatelessWidget {
  const SmartwatchSupportSidePanel({
    super.key,
    required this.stats,
    required this.features,
    required this.onPushAll,
    required this.processing,
  });

  final SmartwatchSupportStats stats;
  final SmartwatchSupportFeatureFlags features;
  final VoidCallback onPushAll;
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
            'Smartwatch metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Order alerts', '${stats.activeOrderAlerts}'),
          _StatRow('Delay alerts', '${stats.activeDelayAlerts}'),
          _StatRow('Emergency active', '${stats.emergencyActive}'),
          _StatRow('Pending tasks', '${stats.pendingTasks}'),
          _StatRow('Watches connected', '${stats.watchesConnected}'),
          _StatRow('Pushed today', '${stats.pushedToday}'),
          const SizedBox(height: 16),
          const Text(
            'Smartwatch features',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Order alerts', features.orderAlerts),
          _FeatureChip('Delay alerts', features.delayAlerts),
          _FeatureChip('Emergency alerts', features.emergencyAlerts),
          _FeatureChip('Task notifications', features.taskNotifications),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onPushAll,
              icon: const Icon(Icons.watch_outlined, size: 18),
              label: const Text('Push all to watches'),
            ),
          ),
        ],
      ),
    );
  }
}

Color _priorityColor(String priority) {
  return switch (priority) {
    'high' => AppColors.danger,
    'medium' => AppColors.warning,
    _ => AppColors.info,
  };
}

Color _severityColor(String severity) {
  return switch (severity) {
    'critical' => AppColors.danger,
    'high' => AppColors.warning,
    _ => AppColors.info,
  };
}

class _WatchAlertList extends StatelessWidget {
  const _WatchAlertList({
    required this.emptyMessage,
    required this.items,
  });

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

class _WatchAlertCard extends StatelessWidget {
  const _WatchAlertCard({
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
                  title,
                  style: const TextStyle(
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
            style: const TextStyle(
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
                            style: action == 'broadcast_emergency'
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
      'push_to_watch' => 'Push',
      'acknowledge_order' => 'Acknowledge',
      'mute_order' => 'Mute',
      'escalate_delay' => 'Escalate',
      'snooze_delay' => 'Snooze',
      'broadcast_emergency' => 'Broadcast',
      'acknowledge_emergency' => 'Acknowledge',
      'resolve_emergency' => 'Resolve',
      'mark_done' => 'Done',
      'reassign_task' => 'Reassign',
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
