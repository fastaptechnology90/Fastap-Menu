import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/live_alerts/live_alert_snapshot.dart';

class LiveAlertCard extends StatelessWidget {
  const LiveAlertCard({
    super.key,
    required this.alert,
    required this.onAction,
  });

  final LiveAlert alert;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final severityColor = switch (alert.severity) {
      'critical' => AppColors.danger,
      'high' => AppColors.warning,
      'medium' => AppColors.info,
      _ => AppColors.secondaryText,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: alert.severity == 'critical'
            ? AppColors.danger.withValues(alpha: 0.05)
            : AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: severityColor.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  alert.title,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: _typeLabel(alert.alertType), color: severityColor),
              const SizedBox(width: 8),
              _Tag(label: alert.status, color: AppColors.info),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${alert.section} · ${alert.severity} · ${alert.triggeredAt}',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            alert.message,
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          if (alert.availableActions.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: alert.availableActions
                  .map(
                    (action) =>
                        action == 'broadcast_alert' || action == 'escalate_alert'
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
        ],
      ),
    );
  }

  static String _typeLabel(String type) {
    return switch (type) {
      'delay' => 'Delay',
      'vip' => 'VIP',
      'emergency' => 'Emergency',
      'low_stock' => 'Stock',
      'equipment' => 'Equipment',
      'hygiene' => 'Hygiene',
      _ => type,
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'acknowledge_alert' => 'Acknowledge',
      'escalate_alert' => 'Escalate',
      'resolve_alert' => 'Resolve',
      'snooze_alert' => 'Snooze',
      'broadcast_alert' => 'Broadcast',
      _ => action,
    };
  }
}

class LiveAlertSidePanel extends StatelessWidget {
  const LiveAlertSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onSyncAll,
    required this.processing,
  });

  final LiveAlertStats stats;
  final LiveAlertFeatureFlags flags;
  final VoidCallback onSyncAll;
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
            'Alert engine metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Active alerts', '${stats.activeAlerts}'),
          _StatRow('Critical', '${stats.criticalAlerts}'),
          _StatRow('Delay alerts', '${stats.delayAlerts}'),
          _StatRow('VIP alerts', '${stats.vipAlerts}'),
          _StatRow('Emergency', '${stats.emergencyAlerts}'),
          _StatRow('Resolved today', '${stats.resolvedToday}'),
          const SizedBox(height: 16),
          Text(
            'Alert channels',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Delay alerts', flags.delayAlerts),
          _FeatureChip('VIP alerts', flags.vipAlerts),
          _FeatureChip('Emergency alerts', flags.emergencyAlerts),
          _FeatureChip('Low stock alerts', flags.lowStockAlerts),
          _FeatureChip('Equipment alerts', flags.equipmentAlerts),
          _FeatureChip('Hygiene alerts', flags.hygieneAlerts),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onSyncAll,
              icon: const Icon(Icons.notifications_active_outlined, size: 18),
              label: const Text('Sync alert engine'),
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
