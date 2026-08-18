import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/prep/prep_snapshot.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/prep/prep_task_card.dart';

class FoodPrepView extends StatelessWidget {
  const FoodPrepView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.prepLoading && controller.prepBoard == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.prepBoard;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.prepErrorMessage ?? 'Preparation board unavailable',
        onRetry: () => controller.refreshPrep(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
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
                    'System 7 · Food Preparation Management',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Recipe flow · timers · ingredient checklist · prep modes',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.prepLoading
                    ? null
                    : () => controller.refreshPrep(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.prepActionMessage != null) ...[
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
              controller.prepActionMessage!,
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 960;
            final tasks = _TasksPanel(
              snapshot: snapshot,
              onAction: (taskId, action) {
                controller.performPrepAction(taskId: taskId, action: action);
              },
            );
            final board = PrepBoardPanel(
              stats: snapshot.stats,
              prepModes: snapshot.prepModes,
              stationLoad: snapshot.stationLoad,
            );

            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: tasks),
                  const SizedBox(width: 16),
                  Expanded(flex: 2, child: board),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                tasks,
                const SizedBox(height: 16),
                board,
              ],
            );
          },
        ),
      ],
    );
  }
}

class _TasksPanel extends StatelessWidget {
  const _TasksPanel({required this.snapshot, required this.onAction});

  final PrepSnapshot snapshot;
  final void Function(String taskId, String action) onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Active prep board · ${snapshot.tasks.length} tasks',
          style: const TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 12),
        if (snapshot.tasks.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: const Text(
              'No preparation tasks for this section filter.',
              style: TextStyle(color: AppColors.secondaryText),
            ),
          )
        else
          ...snapshot.tasks.map(
            (task) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: PrepTaskCard(
                task: task,
                onAction: (action) => onAction(task.id, action),
              ),
            ),
          ),
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
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, style: const TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
