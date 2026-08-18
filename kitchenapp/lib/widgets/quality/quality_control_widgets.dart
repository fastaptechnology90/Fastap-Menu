import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/quality/quality_control_snapshot.dart';

class QcPendingCheckCard extends StatelessWidget {
  const QcPendingCheckCard({
    super.key,
    required this.check,
    required this.onToggleItem,
    required this.onValidateCategory,
    required this.onOrderAction,
  });

  final QcPendingCheck check;
  final void Function(String itemId, bool passed) onToggleItem;
  final ValueChanged<String> onValidateCategory;
  final ValueChanged<String> onOrderAction;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (check.status) {
      'awaiting_supervisor' => AppColors.warning,
      'ready_to_approve' => AppColors.primary,
      'partial' => AppColors.info,
      _ => AppColors.secondaryText,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: statusColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  check.kotNumber,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: _statusLabel(check.status), color: statusColor),
              const SizedBox(width: 8),
              _Tag(label: '${check.score}%', color: AppColors.primary),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${check.dishName} · ${check.location}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          if (check.supervisorRequired) ...[
            const SizedBox(height: 6),
            Text(
              'Supervisor: ${check.assignedSupervisor ?? 'Required'}',
              style: const TextStyle(
                color: AppColors.warning,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ],
          const SizedBox(height: 12),
          const Text(
            'Quality checklist',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 8),
          ...check.checklist.map(
            (item) => QcChecklistRow(
              item: item,
              onToggle: () => onToggleItem(item.id, item.passed != true),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: () => onValidateCategory('validate_presentation'),
                child: const Text('Presentation'),
              ),
              OutlinedButton(
                onPressed: () => onValidateCategory('validate_temperature'),
                child: const Text('Temperature'),
              ),
              OutlinedButton(
                onPressed: () => onValidateCategory('validate_hygiene'),
                child: const Text('Hygiene'),
              ),
              OutlinedButton(
                onPressed: () => onValidateCategory('validate_quality'),
                child: const Text('Quality'),
              ),
              ...check.availableActions
                  .where(
                    (action) =>
                        !action.startsWith('validate_') &&
                        action != 'request_redo',
                  )
                  .map(
                    (action) => FilledButton(
                      onPressed: () => onOrderAction(action),
                      child: Text(_actionLabel(action)),
                    ),
                  ),
              if (check.availableActions.contains('request_redo'))
                OutlinedButton(
                  onPressed: () => onOrderAction('request_redo'),
                  child: const Text('Re-fire'),
                ),
            ],
          ),
        ],
      ),
    );
  }

  static String _statusLabel(String status) {
    return switch (status) {
      'awaiting_supervisor' => 'Awaiting supervisor',
      'ready_to_approve' => 'Ready to approve',
      'partial' => 'In progress',
      'approved' => 'Approved',
      'rejected' => 'Rejected',
      _ => 'Pending',
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'supervisor_signoff' => 'Supervisor sign-off',
      'approve' => 'Approve QC',
      'reject' => 'Reject food',
      _ => action,
    };
  }
}

class QcChecklistRow extends StatelessWidget {
  const QcChecklistRow({
    super.key,
    required this.item,
    required this.onToggle,
  });

  final QcChecklistItem item;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final icon = switch (item.passed) {
      true => Icons.check_circle,
      false => Icons.cancel,
      _ => Icons.radio_button_unchecked,
    };
    final color = switch (item.passed) {
      true => AppColors.primary,
      false => AppColors.danger,
      _ => AppColors.secondaryText,
    };

    return InkWell(
      onTap: onToggle,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                item.label,
                style: const TextStyle(
                  color: AppColors.bodyText,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
            _CategoryChip(category: item.category),
          ],
        ),
      ),
    );
  }
}

class QcSidePanel extends StatelessWidget {
  const QcSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onRandomAudit,
    required this.processing,
  });

  final QcStats stats;
  final QcFeatureFlags flags;
  final VoidCallback onRandomAudit;
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
            'QC scoreboard',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Pending checks', '${stats.pendingChecks}'),
          _StatRow('Awaiting supervisor', '${stats.awaitingSupervisor}'),
          _StatRow('Pass rate', '${stats.passRate}%'),
          _StatRow('Average score', '${stats.averageScore}%'),
          _StatRow('Open complaints', '${stats.openComplaints}'),
          _StatRow('Rejections today', '${stats.rejectionsToday}'),
          _StatRow('Random audits', '${stats.randomAudits}'),
          const SizedBox(height: 16),
          const Text(
            'Active QC modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          ...[
            ('Food quality checklist', flags.foodQualityChecklist),
            ('Presentation validation', flags.presentationValidation),
            ('Temperature validation', flags.temperatureValidation),
            ('Hygiene validation', flags.hygieneValidation),
            ('Supervisor approval', flags.supervisorApproval),
            ('Random audits', flags.randomAudits),
            ('QC scoring', flags.qcScoring),
            ('Complaint tracking', flags.complaintTracking),
            ('Rejected food tracking', flags.rejectedFoodTracking),
          ].map(
            (entry) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Icon(
                    entry.$2 ? Icons.check_circle : Icons.circle_outlined,
                    size: 16,
                    color: entry.$2 ? AppColors.primary : AppColors.secondaryText,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      entry.$1,
                      style: const TextStyle(
                        color: AppColors.bodyText,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onRandomAudit,
              icon: const Icon(Icons.fact_check_outlined, size: 18),
              label: const Text('Trigger random audit'),
            ),
          ),
        ],
      ),
    );
  }
}

class QcAuditList extends StatelessWidget {
  const QcAuditList({super.key, required this.audits});

  final List<QcRandomAudit> audits;

  @override
  Widget build(BuildContext context) {
    if (audits.isEmpty) {
      return const _EmptyList(message: 'No random audits logged');
    }

    return Column(
      children: audits
          .map(
            (audit) => Container(
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
                          audit.dishName,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(label: '${audit.score}%', color: AppColors.info),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${audit.section} · ${audit.auditor}',
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    audit.notes,
                    style: const TextStyle(
                      color: AppColors.bodyText,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class QcComplaintList extends StatelessWidget {
  const QcComplaintList({super.key, required this.complaints});

  final List<QcComplaint> complaints;

  @override
  Widget build(BuildContext context) {
    if (complaints.isEmpty) {
      return const _EmptyList(message: 'No complaints logged');
    }

    return Column(
      children: complaints
          .map(
            (complaint) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.warning.withValues(alpha: 0.25),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          complaint.kotNumber,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(
                        label: complaint.severity,
                        color: complaint.severity == 'high'
                            ? AppColors.danger
                            : AppColors.warning,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    complaint.reason,
                    style: const TextStyle(
                      color: AppColors.bodyText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class QcRejectionList extends StatelessWidget {
  const QcRejectionList({super.key, required this.rejections});

  final List<QcRejection> rejections;

  @override
  Widget build(BuildContext context) {
    if (rejections.isEmpty) {
      return const _EmptyList(message: 'No rejected food logged');
    }

    return Column(
      children: rejections
          .map(
            (rejection) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.danger.withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${rejection.kotNumber} · ${rejection.dishName}',
                    style: const TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    rejection.reason,
                    style: const TextStyle(
                      color: AppColors.bodyText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${rejection.rejectedBy} · ${rejection.disposition}',
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
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
                fontSize: 12,
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

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.category});

  final String category;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.panelBorder.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        category,
        style: const TextStyle(
          color: AppColors.secondaryText,
          fontWeight: FontWeight.w700,
          fontSize: 10,
        ),
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

class _EmptyList extends StatelessWidget {
  const _EmptyList({required this.message});

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
