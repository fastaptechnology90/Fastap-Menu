import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/equipment/equipment_snapshot.dart';

class EquipmentAssetCard extends StatelessWidget {
  const EquipmentAssetCard({
    super.key,
    required this.asset,
    required this.onAction,
  });

  final EquipmentAsset asset;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final healthColor = asset.healthPercent >= 80
        ? AppColors.primary
        : asset.healthPercent >= 60
            ? AppColors.warning
            : AppColors.danger;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: healthColor.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  asset.assetName,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: asset.equipmentType, color: AppColors.info),
              const SizedBox(width: 8),
              _Tag(label: asset.status, color: healthColor),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${asset.section} · Health ${asset.healthPercent}% · Last service ${asset.lastService}',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: asset.availableActions
                .map(
                  (action) => action == 'resolve_ticket' ||
                          action == 'mark_operational'
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
      'raise_maintenance' => 'Raise ticket',
      'schedule_amc' => 'Schedule AMC',
      'log_usage' => 'Log usage',
      'mark_operational' => 'Mark operational',
      'resolve_ticket' => 'Resolve',
      'hold_asset' => 'Hold',
      _ => action,
    };
  }
}

class AmcReminderList extends StatelessWidget {
  const AmcReminderList({super.key, required this.reminders});

  final List<AmcReminder> reminders;

  @override
  Widget build(BuildContext context) {
    if (reminders.isEmpty) {
      return const _EmptyBox(message: 'No AMC reminders');
    }

    return Column(
      children: reminders
          .map(
            (item) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.warning.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.assetName,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${item.section} · ${item.provider} · due in ${item.dueInDays} days',
                          style: TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(label: item.status, color: AppColors.warning),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class MaintenanceTicketList extends StatelessWidget {
  const MaintenanceTicketList({
    super.key,
    required this.tickets,
    required this.onAction,
  });

  final List<MaintenanceTicket> tickets;
  final ValueChanged<(MaintenanceTicket ticket, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (tickets.isEmpty) {
      return const _EmptyBox(message: 'No maintenance tickets');
    }

    return Column(
      children: tickets
          .map(
            (ticket) => Container(
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
                          ticket.assetName,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(
                        label: ticket.priority,
                        color: ticket.priority == 'high'
                            ? AppColors.danger
                            : AppColors.info,
                      ),
                      const SizedBox(width: 8),
                      _Tag(label: ticket.status, color: AppColors.secondaryText),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${ticket.section} · ${ticket.issueSummary}',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ticket.availableActions
                        .map(
                          (action) => action == 'resolve_ticket'
                              ? FilledButton(
                                  onPressed: () => onAction((ticket, action)),
                                  child: const Text('Resolve'),
                                )
                              : OutlinedButton(
                                  onPressed: () => onAction((ticket, action)),
                                  child: const Text('Hold'),
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

class BreakdownAlertList extends StatelessWidget {
  const BreakdownAlertList({
    super.key,
    required this.alerts,
    required this.onAction,
  });

  final List<BreakdownAlert> alerts;
  final ValueChanged<(BreakdownAlert alert, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _EmptyBox(message: 'No breakdown alerts');
    }

    return Column(
      children: alerts
          .map(
            (alert) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.danger.withValues(alpha: 0.25),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          alert.assetName,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(label: alert.severity, color: AppColors.danger),
                      const SizedBox(width: 8),
                      _Tag(label: alert.status, color: AppColors.secondaryText),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${alert.section} · ${alert.alertType}',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: alert.availableActions
                        .map(
                          (action) => OutlinedButton(
                            onPressed: () => onAction((alert, action)),
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
      'acknowledge_breakdown' => 'Acknowledge',
      'raise_maintenance' => 'Raise ticket',
      'resolve_ticket' => 'Resolve',
      _ => action,
    };
  }
}

class UsageAnalyticsList extends StatelessWidget {
  const UsageAnalyticsList({super.key, required this.entries});

  final List<UsageAnalyticsEntry> entries;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return const _EmptyBox(message: 'No usage analytics');
    }

    return Column(
      children: entries
          .map(
            (entry) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.panelBorder),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry.assetName,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${entry.section} · ${entry.usageHours}h · peak ${entry.peakWindow}',
                          style: TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${entry.utilizationPercent}%',
                    style: TextStyle(
                      color: entry.utilizationPercent >= 85
                          ? AppColors.warning
                          : AppColors.primary,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
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

class EquipmentSidePanel extends StatelessWidget {
  const EquipmentSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onRaiseMaintenance,
    required this.processing,
  });

  final EquipmentStats stats;
  final EquipmentFeatureFlags flags;
  final VoidCallback onRaiseMaintenance;
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
            'Equipment metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Total assets', '${stats.totalAssets}'),
          _StatRow('Operational', '${stats.operationalAssets}'),
          _StatRow('Open tickets', '${stats.openTickets}'),
          _StatRow('Active breakdowns', '${stats.activeBreakdowns}'),
          _StatRow('AMC due soon', '${stats.amcDueSoon}'),
          _StatRow('High utilization', '${stats.highUtilization}'),
          _StatRow('Resolved today', '${stats.resolvedToday}'),
          const SizedBox(height: 16),
          Text(
            'Active equipment modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Health tracking', flags.equipmentHealthTracking),
          _FeatureChip('AMC reminders', flags.amcReminders),
          _FeatureChip('Maintenance tickets', flags.maintenanceTickets),
          _FeatureChip('Breakdown alerts', flags.breakdownAlerts),
          _FeatureChip('Usage analytics', flags.usageAnalytics),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onRaiseMaintenance,
              icon: const Icon(Icons.build_circle_outlined, size: 18),
              label: const Text('Raise maintenance ticket'),
            ),
          ),
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
