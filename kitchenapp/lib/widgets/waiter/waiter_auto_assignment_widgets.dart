import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/waiter/waiter_assignment_snapshot.dart';
import '../common/mini_chip.dart';
import '../common/panel_card.dart';

class WaiterAssignmentStatsRow extends StatelessWidget {
  const WaiterAssignmentStatsRow({super.key, required this.stats});

  final WaiterAssignmentStats stats;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        _StatChip('Open tasks', '${stats.openTasks}'),
        _StatChip('Ready alerts', '${stats.readyNotifications}'),
        _StatChip('Confirmed today', '${stats.deliveriesConfirmedToday}'),
        _StatChip('Auto-assignments', '${stats.autoAssignmentsToday}'),
        _StatChip('Balanced waiters', '${stats.balancedWaiters}'),
      ],
    );
  }
}

class WaiterFeatureFlagRow extends StatelessWidget {
  const WaiterFeatureFlagRow({super.key, required this.flags});

  final WaiterFeatureFlags flags;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        MiniChip(
          flags.autoTaskAllocation ? 'Auto allocation' : 'Manual allocation',
        ),
        MiniChip(
          flags.orderReadyNotifications
              ? 'Ready notifications'
              : 'Notifications off',
        ),
        MiniChip(
          flags.deliveryConfirmation
              ? 'Delivery confirmation'
              : 'No confirmation',
        ),
        MiniChip(
          flags.workloadBalanceAlgorithm ? 'Workload balance' : 'Balance off',
        ),
        MiniChip(
          flags.inHotelNavigation
              ? 'In-hotel navigation'
              : 'Navigation (future)',
        ),
        MiniChip(
          flags.noManualCalling ? 'No manual calling' : 'Manual calling',
        ),
      ],
    );
  }
}

class WaiterNotificationList extends StatelessWidget {
  const WaiterNotificationList({
    super.key,
    required this.notifications,
    required this.onAction,
  });

  final List<WaiterReadyNotification> notifications;
  final void Function(WaiterReadyNotification notification, String action)
      onAction;

  @override
  Widget build(BuildContext context) {
    if (notifications.isEmpty) {
      return const _EmptyBox(message: 'No waiter notifications');
    }

    return Column(
      children: notifications
          .map(
            (notification) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: notification.status == 'new'
                    ? AppColors.info.withValues(alpha: 0.08)
                    : AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: notification.status == 'new'
                      ? AppColors.info.withValues(alpha: 0.35)
                      : AppColors.panelBorder,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.notifications_active_outlined,
                        color: notification.status == 'new'
                            ? AppColors.info
                            : AppColors.secondaryText,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          notification.title,
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: AppColors.primaryText,
                          ),
                        ),
                      ),
                      MiniChip(notification.status),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    notification.body,
                    style: TextStyle(
                      color: AppColors.bodyText,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    notification.createdAt,
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    children: notification.availableActions
                        .map(
                          (action) => OutlinedButton(
                            onPressed: () => onAction(notification, action),
                            child: Text(_label(action)),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class WaiterTaskList extends StatelessWidget {
  const WaiterTaskList({
    super.key,
    required this.tasks,
    required this.onAction,
  });

  final List<WaiterDeliveryTask> tasks;
  final void Function(WaiterDeliveryTask task, String action) onAction;

  @override
  Widget build(BuildContext context) {
    if (tasks.isEmpty) {
      return const _EmptyBox(message: 'No waiter delivery tasks');
    }

    return Column(
      children: tasks
          .map(
            (task) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.panelBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${task.kotNumber} · Table ${task.tableNumber}',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            color: AppColors.primaryText,
                          ),
                        ),
                      ),
                      MiniChip(task.priority),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    task.assignedWaiter,
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(task.message),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    children: task.availableActions
                        .map(
                          (action) => FilledButton(
                            onPressed: () => onAction(task, action),
                            child: Text(_label(action)),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class WaiterWorkloadList extends StatelessWidget {
  const WaiterWorkloadList({super.key, required this.entries});

  final List<WaiterWorkloadEntry> entries;

  @override
  Widget build(BuildContext context) {
    return PanelCard(
      title: 'Workload balance',
      icon: Icons.balance_outlined,
      expandChild: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: entries
            .map(
              (entry) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  entry.waiterName,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  '${entry.activeTasks} active · ${entry.completedToday} done today',
                ),
                trailing: MiniChip(entry.status),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.chipBackground,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 18,
              color: AppColors.primaryText,
            ),
          ),
          Text(label, style: TextStyle(color: AppColors.secondaryText)),
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
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.chipBackground,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: TextStyle(color: AppColors.secondaryText),
      ),
    );
  }
}

String _label(String action) {
  return switch (action) {
    'acknowledge' => 'Acknowledge',
    'start_delivery' => 'Start delivery',
    'accept_task' => 'Accept task',
    'confirm_delivery' => 'Confirm delivery',
    _ => action,
  };
}
