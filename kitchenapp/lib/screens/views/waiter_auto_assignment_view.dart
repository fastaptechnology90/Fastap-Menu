import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/waiter/waiter_assignment_snapshot.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/waiter/waiter_auto_assignment_widgets.dart';

class WaiterAutoAssignmentView extends StatelessWidget {
  const WaiterAutoAssignmentView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        if (controller.waiterAutoAssignmentLoading &&
            controller.waiterAutoAssignment == null) {
          return const _WaiterModuleLoading();
        }

        final snapshot = controller.waiterAutoAssignment;
        if (snapshot == null) {
          return _EmptyState(
            message: controller.waiterAutoAssignmentErrorMessage ??
                'Waiter auto assignment unavailable',
            onRetry: () => controller.refreshWaiterAutoAssignment(),
          );
        }

        return _WaiterBoard(
          controller: controller,
          snapshot: snapshot,
        );
      },
    );
  }
}

class _WaiterModuleLoading extends StatelessWidget {
  const _WaiterModuleLoading();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 48),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 16),
          Text(
            'Loading waiter tasks…',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _WaiterBoard extends StatelessWidget {
  const _WaiterBoard({
    required this.controller,
    required this.snapshot,
  });

  final KitchenCommandController controller;
  final WaiterAssignmentSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.panelBorder),
          ),
          child: Wrap(
            spacing: 12,
            runSpacing: 10,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'System 49 · Waiter Auto Assignment',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Auto task allocation · ready alerts · delivery confirmation',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              Wrap(
                spacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: controller.waiterAutoAssignmentLoading
                        ? null
                        : () => controller.autoAllocateWaiterTasks(),
                    icon: const Icon(Icons.auto_mode, size: 18),
                    label: const Text('Auto allocate'),
                  ),
                  OutlinedButton.icon(
                    onPressed: controller.waiterAutoAssignmentLoading
                        ? null
                        : () => controller.balanceWaiterWorkload(),
                    icon: const Icon(Icons.balance, size: 18),
                    label: const Text('Balance workload'),
                  ),
                  OutlinedButton.icon(
                    onPressed: controller.waiterAutoAssignmentLoading
                        ? null
                        : () => controller.refreshWaiterAutoAssignment(),
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Refresh'),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (controller.waiterAutoAssignmentActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.waiterAutoAssignmentActionMessage!,
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        WaiterAssignmentStatsRow(stats: snapshot.stats),
        const SizedBox(height: 14),
        WaiterFeatureFlagRow(flags: snapshot.featureFlags),
        const SizedBox(height: 18),
        const Text(
          'Order ready notifications',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            color: AppColors.primaryText,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 10),
        WaiterNotificationList(
          notifications: snapshot.notifications,
          onAction: (notification, action) =>
              controller.performWaiterNotificationAction(
            notification.id,
            action,
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          'Auto-assigned delivery tasks',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            color: AppColors.primaryText,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 10),
        WaiterTaskList(
          tasks: snapshot.tasks,
          onAction: (task, action) =>
              controller.performWaiterTaskAction(task.id, action),
        ),
        const SizedBox(height: 18),
        WaiterWorkloadList(entries: snapshot.workloadBoard),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.room_service_outlined,
            size: 48,
            color: AppColors.primary,
          ),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.bodyText),
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
