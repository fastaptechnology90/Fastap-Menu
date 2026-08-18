import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/chef_tasks/chef_task_snapshot.dart';

class ChefTaskCard extends StatelessWidget {
  const ChefTaskCard({
    super.key,
    required this.task,
    required this.onAction,
  });

  final ChefTask task;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor(task.status);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: statusColor.withValues(alpha: 0.45), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.assignment_ind_outlined, color: statusColor, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  task.title,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
              _Tag(label: task.statusLabel, color: statusColor),
              if (task.priority == 'vip')
                const _Tag(label: 'VIP', color: AppColors.premium),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${task.kotNumber} · ${task.section} · ${task.assignedChef}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _MetaChip(Icons.badge_outlined, task.skillTag),
              _MetaChip(Icons.schedule_outlined, task.shiftId),
              _MetaChip(Icons.speed_outlined, '${(task.workloadScore * 100).round()}% load'),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: task.progress,
              minHeight: 6,
              backgroundColor: AppColors.chipBackground,
              color: statusColor,
            ),
          ),
          if (task.coordination.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              task.coordination.join(' · '),
              style: const TextStyle(
                color: AppColors.info,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: task.availableActions
                .map(
                  (action) => OutlinedButton(
                    onPressed: () => onAction(action),
                    style: action == 'escalate'
                        ? OutlinedButton.styleFrom(foregroundColor: AppColors.danger)
                        : null,
                    child: Text(_actionLabel(action)),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }

  static Color _statusColor(String status) {
    return switch (status) {
      'assigned' => AppColors.info,
      'in_progress' => AppColors.primary,
      'waiting' => AppColors.warning,
      'completed' => AppColors.secondaryText,
      'delayed' => AppColors.danger,
      'escalated' => AppColors.premium,
      _ => AppColors.primary,
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'start' => 'Start',
      'complete' => 'Complete',
      'transfer' => 'Transfer',
      'reassign' => 'Reassign',
      'mark_waiting' => 'Mark waiting',
      'resume' => 'Resume',
      'escalate' => 'Escalate',
      _ => action,
    };
  }
}

class ChefTaskBoardPanel extends StatelessWidget {
  const ChefTaskBoardPanel({
    super.key,
    required this.stats,
    required this.workloadBoard,
    required this.onBalance,
    required this.balancing,
  });

  final ChefTaskStats stats;
  final List<ChefWorkloadItem> workloadBoard;
  final VoidCallback onBalance;
  final bool balancing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Panel(
          title: 'Task status',
          child: Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              _Stat(label: 'Total', value: '${stats.total}'),
              _Stat(label: 'Assigned', value: '${stats.assigned}'),
              _Stat(label: 'In progress', value: '${stats.inProgress}'),
              _Stat(label: 'Waiting', value: '${stats.waiting}'),
              _Stat(label: 'Delayed', value: '${stats.delayed}'),
              _Stat(label: 'Escalated', value: '${stats.escalated}'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Chef workload board',
          child: workloadBoard.isEmpty
              ? const Text(
                  'No chef workload for this filter.',
                  style: TextStyle(color: AppColors.secondaryText),
                )
              : Column(
                  children: workloadBoard
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      item.chef,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                  Text('${item.taskCount} tasks'),
                                ],
                              ),
                              const SizedBox(height: 6),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: item.load,
                                  minHeight: 8,
                                  backgroundColor: AppColors.chipBackground,
                                  color: item.load > 0.85
                                      ? AppColors.danger
                                      : AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: balancing ? null : onBalance,
            icon: balancing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.balance_outlined),
            label: const Text('Balance section workload'),
          ),
        ),
      ],
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.child});

  final String title;
  final Widget child;

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
          Text(
            title,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          child,
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
      margin: const EdgeInsets.only(left: 6),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip(this.icon, this.label);

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.secondaryText),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: const TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w900,
            fontSize: 20,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}
