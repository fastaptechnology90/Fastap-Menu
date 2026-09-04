import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/audit_compliance/audit_compliance_snapshot.dart';

class AuditActionLogList extends StatelessWidget {
  const AuditActionLogList({
    super.key,
    required this.logs,
    required this.onAction,
  });

  final List<AuditActionLog> logs;
  final ValueChanged<(AuditActionLog log, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _AuditList(
      emptyMessage: 'No action logs',
      items: logs
          .map(
            (log) => _AuditCard(
              title: log.actionLabel,
              subtitle:
                  '${log.section} · ${log.actorName} · ${log.timestampLabel}',
              tagLabel: log.status,
              tagColor: log.severity == 'high'
                  ? AppColors.warning
                  : AppColors.primary,
              actions: log.availableActions,
              primaryActions: const {'review_log'},
              onAction: (action) => onAction((log, action)),
            ),
          )
          .toList(),
    );
  }
}

class FoodSafetyLogList extends StatelessWidget {
  const FoodSafetyLogList({
    super.key,
    required this.logs,
    required this.onAction,
  });

  final List<FoodSafetyLog> logs;
  final ValueChanged<(FoodSafetyLog log, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _AuditList(
      emptyMessage: 'No food safety logs',
      items: logs
          .map(
            (log) => _AuditCard(
              title: log.checkName,
              subtitle:
                  '${log.section} · ${log.reading} · Threshold ${log.threshold}',
              tagLabel: log.status,
              tagColor: log.status == 'flagged'
                  ? AppColors.danger
                  : AppColors.primary,
              actions: log.availableActions,
              primaryActions: const {'acknowledge_check'},
              onAction: (action) => onAction((log, action)),
            ),
          )
          .toList(),
    );
  }
}

class HygieneLogList extends StatelessWidget {
  const HygieneLogList({
    super.key,
    required this.logs,
    required this.onAction,
  });

  final List<HygieneLog> logs;
  final ValueChanged<(HygieneLog log, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _AuditList(
      emptyMessage: 'No hygiene logs',
      items: logs
          .map(
            (log) => _AuditCard(
              title: log.taskName,
              subtitle:
                  '${log.section} · ${log.dueLabel} · ${log.complianceLevel}',
              tagLabel: log.status,
              tagColor: log.complianceLevel == 'ok'
                  ? AppColors.primary
                  : AppColors.warning,
              actions: log.availableActions,
              primaryActions: const {'mark_compliant'},
              onAction: (action) => onAction((log, action)),
            ),
          )
          .toList(),
    );
  }
}

class StaffActivityLogList extends StatelessWidget {
  const StaffActivityLogList({
    super.key,
    required this.logs,
    required this.onAction,
  });

  final List<StaffActivityLog> logs;
  final ValueChanged<(StaffActivityLog log, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _AuditList(
      emptyMessage: 'No staff activity logs',
      items: logs
          .map(
            (log) => _AuditCard(
              title: log.activityLabel,
              subtitle: '${log.section} · ${log.staffName} · ${log.activityType}',
              tagLabel: log.status,
              tagColor: log.status == 'flagged'
                  ? AppColors.warning
                  : AppColors.info,
              actions: log.availableActions,
              primaryActions: const {'review_activity'},
              onAction: (action) => onAction((log, action)),
            ),
          )
          .toList(),
    );
  }
}

class IncidentLogList extends StatelessWidget {
  const IncidentLogList({
    super.key,
    required this.incidents,
    required this.onAction,
  });

  final List<IncidentLog> incidents;
  final ValueChanged<(IncidentLog incident, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _AuditList(
      emptyMessage: 'No incident logs',
      items: incidents
          .map(
            (incident) => _AuditCard(
              title: incident.incidentTitle,
              subtitle:
                  '${incident.section} · ${incident.severity} · ${incident.reportedAt}',
              tagLabel: incident.status,
              tagColor: incident.severity == 'critical'
                  ? AppColors.danger
                  : AppColors.warning,
              actions: incident.availableActions,
              primaryActions: const {'investigate_incident', 'close_incident'},
              onAction: (action) => onAction((incident, action)),
            ),
          )
          .toList(),
    );
  }
}

class AuditComplianceSidePanel extends StatelessWidget {
  const AuditComplianceSidePanel({
    super.key,
    required this.stats,
    required this.features,
    required this.onExportAll,
    required this.processing,
  });

  final AuditComplianceStats stats;
  final AuditComplianceFeatureFlags features;
  final VoidCallback onExportAll;
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
            'Compliance metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Pending reviews', '${stats.pendingReviews}'),
          _StatRow('Food safety flags', '${stats.foodSafetyFlags}'),
          _StatRow('Hygiene issues', '${stats.hygieneIssues}'),
          _StatRow('Staff alerts', '${stats.staffAlerts}'),
          _StatRow('Open incidents', '${stats.openIncidents}'),
          _StatRow('Exported today', '${stats.exportedToday}'),
          const SizedBox(height: 16),
          Text(
            'Audit features',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Action logs', features.actionLogs),
          _FeatureChip('Food safety logs', features.foodSafetyLogs),
          _FeatureChip('Hygiene logs', features.hygieneLogs),
          _FeatureChip('Staff activity logs', features.staffActivityLogs),
          _FeatureChip('Incident logs', features.incidentLogs),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onExportAll,
              icon: const Icon(Icons.file_download_outlined, size: 18),
              label: const Text('Export compliance logs'),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuditList extends StatelessWidget {
  const _AuditList({required this.emptyMessage, required this.items});

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

class _AuditCard extends StatelessWidget {
  const _AuditCard({
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
                            style: action == 'escalate_incident'
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
      'review_log' => 'Review',
      'flag_action' => 'Flag',
      'archive_log' => 'Archive',
      'acknowledge_check' => 'Acknowledge',
      'escalate_check' => 'Escalate',
      'schedule_recheck' => 'Recheck',
      'acknowledge_task' => 'Acknowledge',
      'schedule_clean' => 'Schedule',
      'mark_compliant' => 'Compliant',
      'review_activity' => 'Review',
      'notify_manager' => 'Notify',
      'clear_alert' => 'Clear',
      'investigate_incident' => 'Investigate',
      'escalate_incident' => 'Escalate',
      'close_incident' => 'Close',
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
