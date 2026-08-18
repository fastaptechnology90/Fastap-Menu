import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/hygiene/cleaning_hygiene_snapshot.dart';

class CleaningScheduleCard extends StatelessWidget {
  const CleaningScheduleCard({
    super.key,
    required this.schedule,
    required this.onAction,
  });

  final CleaningSchedule schedule;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    return _TaskCard(
      title: schedule.taskName,
      subtitle:
          '${schedule.section} · ${schedule.frequency} · ${schedule.scheduledTime}',
      meta: 'Staff: ${schedule.assignedStaff}',
      status: schedule.status,
      actions: schedule.availableActions,
      onAction: onAction,
    );
  }
}

class HygieneChecklistCard extends StatelessWidget {
  const HygieneChecklistCard({
    super.key,
    required this.checklist,
    required this.onAction,
  });

  final HygieneChecklist checklist;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    return _TaskCard(
      title: checklist.title,
      subtitle: '${checklist.section} · ${checklist.itemsCompleted}/${checklist.totalItems} items',
      status: checklist.status,
      actions: checklist.availableActions,
      onAction: onAction,
    );
  }
}

class SanitizationTaskCard extends StatelessWidget {
  const SanitizationTaskCard({
    super.key,
    required this.task,
    required this.onAction,
  });

  final SanitizationTask task;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final statusColor = task.status == 'overdue'
        ? AppColors.danger
        : task.status == 'sanitized'
            ? AppColors.primary
            : AppColors.warning;

    return _TaskCard(
      title: task.equipmentName,
      subtitle: '${task.section} · Last ${task.lastSanitized}',
      meta: 'Due in ${task.dueInMinutes}m',
      status: task.status,
      statusColor: statusColor,
      actions: task.availableActions,
      onAction: onAction,
    );
  }
}

class FoodSafetyList extends StatelessWidget {
  const FoodSafetyList({super.key, required this.entries});

  final List<FoodSafetyEntry> entries;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return const _EmptyBox(message: 'No food safety checks logged');
    }

    return Column(
      children: entries
          .map(
            (entry) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: entry.status == 'alert'
                    ? AppColors.danger.withValues(alpha: 0.06)
                    : Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: entry.status == 'alert'
                      ? AppColors.danger.withValues(alpha: 0.25)
                      : AppColors.panelBorder,
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry.checkType,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${entry.section} · ${entry.reading} (limit ${entry.threshold})',
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(
                    label: entry.status,
                    color: entry.status == 'alert'
                        ? AppColors.danger
                        : AppColors.primary,
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class DeepCleaningList extends StatelessWidget {
  const DeepCleaningList({
    super.key,
    required this.jobs,
    required this.onAction,
  });

  final List<DeepCleaningJob> jobs;
  final ValueChanged<(DeepCleaningJob job, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (jobs.isEmpty) {
      return const _EmptyBox(message: 'No deep cleaning jobs scheduled');
    }

    return Column(
      children: jobs
          .map(
            (job) => _TaskCard(
              title: job.areaName,
              subtitle: '${job.section} · ${job.scheduledDate}',
              meta: 'Team: ${job.assignedTeam}',
              status: job.status,
              actions: job.availableActions,
              onAction: (action) => onAction((job, action)),
            ),
          )
          .toList(),
    );
  }
}

class ComplianceRecordList extends StatelessWidget {
  const ComplianceRecordList({
    super.key,
    required this.records,
    required this.onAction,
  });

  final List<ComplianceRecord> records;
  final ValueChanged<(ComplianceRecord record, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) {
      return const _EmptyBox(message: 'No compliance records');
    }

    return Column(
      children: records
          .map(
            (record) => Container(
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
                          record.title,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(
                        label: record.recordType,
                        color: AppColors.info,
                      ),
                      const SizedBox(width: 8),
                      _Tag(
                        label: record.status,
                        color: record.status == 'pending'
                            ? AppColors.warning
                            : AppColors.primary,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${record.section} · Updated ${record.lastUpdated}',
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: record.availableActions
                        .map(
                          (action) => OutlinedButton(
                            onPressed: () => onAction((record, action)),
                            child: Text(_actionLabel(action)),
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

  static String _actionLabel(String action) {
    return switch (action) {
      'verify_staff' => 'Verify staff',
      'record_audit' => 'Record audit',
      'hold_task' => 'Hold',
      _ => action,
    };
  }
}

class CleaningHygieneSidePanel extends StatelessWidget {
  const CleaningHygieneSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onStartAudit,
    required this.processing,
  });

  final CleaningHygieneStats stats;
  final CleaningHygieneFeatureFlags flags;
  final VoidCallback onStartAudit;
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
            'Hygiene metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Scheduled tasks', '${stats.scheduledTasks}'),
          _StatRow('Open checklists', '${stats.checklistsOpen}'),
          _StatRow('Sanitization due', '${stats.sanitizationDue}'),
          _StatRow('Food safety alerts', '${stats.foodSafetyAlerts}'),
          _StatRow('Deep clean pending', '${stats.deepCleanPending}'),
          _StatRow('Compliance issues', '${stats.complianceIssues}'),
          _StatRow('Completed today', '${stats.completedToday}'),
          const SizedBox(height: 16),
          const Text(
            'Active hygiene modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Cleaning schedules', flags.cleaningSchedules),
          _FeatureChip('Hygiene checklists', flags.hygieneChecklists),
          _FeatureChip('Equipment sanitization', flags.equipmentSanitization),
          _FeatureChip('Food safety tracking', flags.foodSafetyTracking),
          _FeatureChip('Deep cleaning', flags.deepCleaningManagement),
          _FeatureChip('FSSAI SOP tracking', flags.fssaiSopTracking),
          _FeatureChip('Audit logs', flags.hygieneAuditLogs),
          _FeatureChip('Staff verification', flags.staffHygieneVerification),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onStartAudit,
              icon: const Icon(Icons.fact_check, size: 18),
              label: const Text('Start hygiene audit'),
            ),
          ),
        ],
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({
    required this.title,
    required this.subtitle,
    required this.status,
    required this.actions,
    required this.onAction,
    this.meta,
    this.statusColor,
  });

  final String title;
  final String subtitle;
  final String? meta;
  final String status;
  final Color? statusColor;
  final List<String> actions;
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
              _Tag(
                label: status,
                color: statusColor ?? AppColors.secondaryText,
              ),
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
          if (meta != null) ...[
            const SizedBox(height: 4),
            Text(
              meta!,
              style: const TextStyle(
                color: AppColors.bodyText,
                fontWeight: FontWeight.w600,
                fontSize: 11,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: actions
                .map(
                  (action) => action == 'complete_checklist' ||
                          action == 'complete_task' ||
                          action == 'mark_sanitized'
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
      ),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'start_task' => 'Start',
      'complete_checklist' => 'Complete checklist',
      'mark_sanitized' => 'Mark sanitized',
      'schedule_deep_clean' => 'Schedule',
      'complete_task' => 'Complete',
      'hold_task' => 'Hold',
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
