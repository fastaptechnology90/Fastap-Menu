import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/energy/smart_energy_snapshot.dart';

class GasLeakAlertList extends StatelessWidget {
  const GasLeakAlertList({
    super.key,
    required this.alerts,
    required this.onAction,
  });

  final List<GasLeakAlert> alerts;
  final ValueChanged<(GasLeakAlert alert, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _EmptyBox(message: 'No gas sensors reporting');
    }

    return Column(
      children: alerts
          .map(
            (alert) => _AlertCard(
              title: alert.location,
              subtitle:
                  '${alert.section} · ${alert.sensorLevel} (limit ${alert.threshold})',
              status: alert.status,
              severityColor: alert.severity == 'warning'
                  ? AppColors.danger
                  : AppColors.primary,
              actions: alert.availableActions,
              onAction: (action) => onAction((alert, action)),
            ),
          )
          .toList(),
    );
  }
}

class EnergyUsageList extends StatelessWidget {
  const EnergyUsageList({super.key, required this.readings});

  final List<EnergyUsageReading> readings;

  @override
  Widget build(BuildContext context) {
    if (readings.isEmpty) {
      return const _EmptyBox(message: 'No energy meters configured');
    }

    return Column(
      children: readings
          .map(
            (reading) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
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
                          reading.meterName,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${reading.section} · ${reading.dailyKwh} kWh today · peak ${reading.peakWindow}',
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${reading.currentKwh} kW',
                        style: const TextStyle(
                          color: AppColors.primaryText,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      _Tag(
                        label: reading.trend,
                        color: reading.trend == 'rising'
                            ? AppColors.warning
                            : AppColors.primary,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class SmartShutdownList extends StatelessWidget {
  const SmartShutdownList({
    super.key,
    required this.alerts,
    required this.onAction,
  });

  final List<SmartShutdownAlert> alerts;
  final ValueChanged<(SmartShutdownAlert alert, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _EmptyBox(message: 'No smart shutdown alerts');
    }

    return Column(
      children: alerts
          .map(
            (alert) => _AlertCard(
              title: alert.equipmentName,
              subtitle:
                  '${alert.section} · ${alert.reason} · ${alert.scheduledTime}',
              status: alert.status,
              severityColor: AppColors.warning,
              actions: alert.availableActions,
              onAction: (action) => onAction((alert, action)),
            ),
          )
          .toList(),
    );
  }
}

class HighTemperatureAlertList extends StatelessWidget {
  const HighTemperatureAlertList({
    super.key,
    required this.alerts,
    required this.onAction,
  });

  final List<HighTemperatureAlert> alerts;
  final ValueChanged<(HighTemperatureAlert alert, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _EmptyBox(message: 'No temperature alerts');
    }

    return Column(
      children: alerts
          .map(
            (alert) => _AlertCard(
              title: alert.equipmentName,
              subtitle:
                  '${alert.section} · ${alert.currentTemp} (limit ${alert.threshold})',
              status: alert.status,
              severityColor: alert.status == 'active'
                  ? AppColors.danger
                  : AppColors.info,
              actions: alert.availableActions,
              onAction: (action) => onAction((alert, action)),
            ),
          )
          .toList(),
    );
  }
}

class SmartEnergySidePanel extends StatelessWidget {
  const SmartEnergySidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onTriggerShutdown,
    required this.processing,
  });

  final SmartEnergyStats stats;
  final SmartEnergyFeatureFlags flags;
  final VoidCallback onTriggerShutdown;
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
            'Energy metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Daily kWh', stats.totalDailyKwh.toStringAsFixed(1)),
          _StatRow('Gas alerts', '${stats.activeGasAlerts}'),
          _StatRow('Pending shutdowns', '${stats.pendingShutdowns}'),
          _StatRow('Temperature alerts', '${stats.temperatureAlerts}'),
          _StatRow('Sections monitored', '${stats.sectionsMonitored}'),
          _StatRow('Resolved today', '${stats.resolvedToday}'),
          const SizedBox(height: 16),
          const Text(
            'Active energy modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Gas leak alerts', flags.gasLeakAlerts),
          _FeatureChip('Energy usage tracking', flags.energyUsageTracking),
          _FeatureChip('Smart shutdown alerts', flags.smartShutdownAlerts),
          _FeatureChip('High temperature alerts', flags.highTemperatureAlerts),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onTriggerShutdown,
              icon: const Icon(Icons.power_settings_new, size: 18),
              label: const Text('Trigger smart shutdown'),
            ),
          ),
        ],
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({
    required this.title,
    required this.subtitle,
    required this.status,
    required this.severityColor,
    required this.actions,
    required this.onAction,
  });

  final String title;
  final String subtitle;
  final String status;
  final Color severityColor;
  final List<String> actions;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: severityColor.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: severityColor.withValues(alpha: 0.25)),
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
              _Tag(label: status, color: severityColor),
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
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: actions
                .map(
                  (action) => action == 'trigger_shutdown' ||
                          action == 'resolve_gas_leak' ||
                          action == 'reset_temperature'
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
      'acknowledge_alert' => 'Acknowledge',
      'resolve_gas_leak' => 'Resolve gas',
      'trigger_shutdown' => 'Shutdown',
      'cancel_shutdown' => 'Cancel',
      'reset_temperature' => 'Reset temp',
      'hold_alert' => 'Hold',
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
