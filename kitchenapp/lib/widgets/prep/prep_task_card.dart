import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/prep/prep_snapshot.dart';

class PrepTaskCard extends StatelessWidget {
  const PrepTaskCard({
    super.key,
    required this.task,
    required this.onAction,
  });

  final PrepTask task;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final overdue = task.timerSeconds > task.timerTargetSeconds &&
        task.status == 'in_progress';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: overdue
              ? AppColors.danger
              : task.vip
              ? AppColors.premium
              : AppColors.panelBorder,
          width: overdue || task.vip ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.soup_kitchen_outlined,
                color: overdue ? AppColors.danger : AppColors.primary,
                size: 18,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  task.dishName,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
              _Tag(label: task.modeLabel, color: AppColors.info),
              if (task.vip)
                const _Tag(label: 'VIP', color: AppColors.premium),
              if (task.allergy)
                const _Tag(label: 'Allergy', color: AppColors.danger),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${task.kotNumber} · ${task.location} · ${task.section} · ${task.statusLabel}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _MetaChip(Icons.person_outline, task.assignedChef),
              const SizedBox(width: 8),
              _MetaChip(Icons.restaurant, '${task.portions} portions'),
              const SizedBox(width: 8),
              _MetaChip(
                Icons.timer_outlined,
                '${task.timer} / ${task.timerRemaining} left',
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: task.progress,
              minHeight: 6,
              backgroundColor: AppColors.chipBackground,
              color: overdue ? AppColors.danger : AppColors.primary,
            ),
          ),
          if (task.alerts.isNotEmpty) ...[
            const SizedBox(height: 10),
            ...task.alerts.map(
              (alert) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  alert,
                  style: TextStyle(
                    color: alert.contains('Auto alert')
                        ? AppColors.warning
                        : AppColors.info,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Text(
            'Step-by-step flow',
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          ...task.steps.map(
            (step) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                step.done ? Icons.check_circle : Icons.radio_button_unchecked,
                color: step.done ? AppColors.primary : AppColors.secondaryText,
                size: 20,
              ),
              title: Text(
                '${step.order}. ${step.label}',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  decoration: step.done ? TextDecoration.lineThrough : null,
                ),
              ),
              subtitle: Text('${step.durationMinutes}m'),
              trailing: !step.done && task.availableActions.contains('complete_step')
                  ? TextButton(
                      onPressed: () => onAction('complete_step:${step.order}'),
                      child: const Text('Done'),
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Ingredient checklist',
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: task.ingredients
                .map(
                  (item) => FilterChip(
                    label: Text('${item.name} · ${item.quantity}'),
                    selected: item.checked,
                    onSelected: item.checked
                        ? null
                        : (_) => onAction('check_ingredient:${item.name}'),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: task.availableActions
                .where((action) => !action.startsWith('mode_'))
                .map(
                  (action) => OutlinedButton(
                    onPressed: () => onAction(action),
                    child: Text(_actionLabel(action)),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: task.availableActions
                .where((action) => action.startsWith('mode_'))
                .map(
                  (action) => TextButton(
                    onPressed: () => onAction(action),
                    child: Text(_modeActionLabel(action)),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }

  static String _actionLabel(String action) {
    if (action.startsWith('complete_step:')) {
      return 'Complete step';
    }
    if (action.startsWith('check_ingredient:')) {
      return 'Check ingredient';
    }
    return switch (action) {
      'start' => 'Start prep',
      'pause' => 'Pause',
      'resume' => 'Resume',
      'complete' => 'Mark complete',
      'complete_step' => 'Next step',
      'check_next_ingredient' => 'Check next item',
      _ => action,
    };
  }

  static String _modeActionLabel(String action) {
    return switch (action) {
      'mode_standard' => 'Standard',
      'mode_fast' => 'Fast',
      'mode_premium' => 'Premium',
      'mode_bulk' => 'Bulk',
      'mode_scheduled' => 'Scheduled',
      _ => action,
    };
  }
}

class PrepBoardPanel extends StatelessWidget {
  const PrepBoardPanel({
    super.key,
    required this.stats,
    required this.prepModes,
    required this.stationLoad,
  });

  final PrepStats stats;
  final List<PrepModeSummary> prepModes;
  final List<PrepStationLoad> stationLoad;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Panel(
          title: 'Preparation stats',
          child: Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              _Stat(label: 'Tasks', value: '${stats.total}'),
              _Stat(label: 'Active', value: '${stats.active}'),
              _Stat(label: 'Paused', value: '${stats.paused}'),
              _Stat(label: 'Pending', value: '${stats.pending}'),
              _Stat(label: 'Alerts', value: '${stats.alerts}'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Preparation modes',
          child: prepModes.isEmpty
              ? const Text(
                  'No active preparation modes.',
                  style: TextStyle(color: AppColors.secondaryText),
                )
              : Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: prepModes
                      .map(
                        (mode) => Chip(
                          label: Text('${mode.label} · ${mode.count}'),
                          backgroundColor:
                              AppColors.primary.withValues(alpha: 0.08),
                        ),
                      )
                      .toList(),
                ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Station load',
          child: stationLoad.isEmpty
              ? const Text(
                  'No station load for this filter.',
                  style: TextStyle(color: AppColors.secondaryText),
                )
              : Column(
                  children: stationLoad
                      .map(
                        (station) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      station.section,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                  Text('${station.taskCount} tasks'),
                                ],
                              ),
                              const SizedBox(height: 6),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: station.load,
                                  minHeight: 8,
                                  backgroundColor: AppColors.chipBackground,
                                  color: station.load > 0.85
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
