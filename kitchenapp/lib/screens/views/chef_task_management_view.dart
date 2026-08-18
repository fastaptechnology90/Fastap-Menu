import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/chef_tasks/chef_task_snapshot.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/chef_tasks/chef_task_card.dart';

class ChefTaskManagementView extends StatelessWidget {
  const ChefTaskManagementView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.chefTaskLoading && controller.chefTasks == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.chefTasks;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.chefTaskErrorMessage ?? 'Chef task board unavailable',
        onRetry: () => controller.refreshChefTasks(),
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
                    'System 10 · Chef Task Management',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Assign · transfer · multi-chef coordination · workload balance',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.chefTaskLoading
                    ? null
                    : () => controller.refreshChefTasks(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.chefTaskActionMessage != null) ...[
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
              controller.chefTaskActionMessage!,
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
              onAction: (task, action) =>
                  _handleAction(context, task, action, snapshot.chefs),
            );
            final board = ChefTaskBoardPanel(
              stats: snapshot.stats,
              workloadBoard: snapshot.workloadBoard,
              onBalance: () => controller.balanceChefWorkload(),
              balancing: controller.chefTaskLoading,
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

  Future<void> _handleAction(
    BuildContext context,
    ChefTask task,
    String action,
    List<ChefProfile> chefs,
  ) async {
    if (action == 'transfer' || action == 'reassign') {
      final chef = await _pickChef(context, chefs, task.assignedChefId);
      if (!context.mounted || chef == null) {
        return;
      }
      await controller.performChefTaskAction(
        taskId: task.id,
        action: action,
        targetChefId: chef.id,
      );
      return;
    }

    await controller.performChefTaskAction(taskId: task.id, action: action);
  }

  Future<ChefProfile?> _pickChef(
    BuildContext context,
    List<ChefProfile> chefs,
    String currentChefId,
  ) {
    final options = chefs.where((chef) => chef.id != currentChefId).toList();
    return showDialog<ChefProfile>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Transfer to chef'),
        children: options
            .map(
              (chef) => SimpleDialogOption(
                onPressed: () => Navigator.pop(context, chef),
                child: Text('${chef.name} · ${chef.section}'),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _TasksPanel extends StatelessWidget {
  const _TasksPanel({required this.snapshot, required this.onAction});

  final ChefTaskSnapshot snapshot;
  final void Function(ChefTask task, String action) onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Live chef tasks · ${snapshot.tasks.length}',
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
              'No chef tasks for this section filter.',
              style: TextStyle(color: AppColors.secondaryText),
            ),
          )
        else
          ...snapshot.tasks.map(
            (task) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ChefTaskCard(
                task: task,
                onAction: (action) => onAction(task, action),
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
