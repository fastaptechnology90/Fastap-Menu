import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/iot/iot_device_snapshot.dart';

class SmartDeviceCard extends StatelessWidget {
  const SmartDeviceCard({
    super.key,
    required this.device,
    required this.onAction,
  });

  final SmartDevice device;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final statusColor = device.connectionStatus == 'connected'
        ? AppColors.primary
        : device.connectionStatus == 'offline'
            ? AppColors.danger
            : AppColors.warning;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: statusColor.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  device.deviceName,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: device.deviceType, color: AppColors.info),
              const SizedBox(width: 8),
              _Tag(label: device.connectionStatus, color: statusColor),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${device.section} · ${device.firmwareVersion} · synced ${device.lastSyncedAt}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: device.availableActions
                .map(
                  (action) => action == 'connect_device' ||
                          action == 'restart_device'
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
      'connect_device' => 'Connect',
      'sync_temperature' => 'Sync temp',
      'log_usage' => 'Log usage',
      'restart_device' => 'Restart',
      'hold_device' => 'Hold',
      _ => action,
    };
  }
}

class TemperatureReadingList extends StatelessWidget {
  const TemperatureReadingList({super.key, required this.readings});

  final List<TemperatureReading> readings;

  @override
  Widget build(BuildContext context) {
    if (readings.isEmpty) {
      return const _EmptyBox(message: 'No temperature sensors reporting');
    }

    return Column(
      children: readings
          .map(
            (reading) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: reading.status == 'alert'
                    ? AppColors.danger.withValues(alpha: 0.06)
                    : Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: reading.status == 'alert'
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
                          reading.deviceName,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${reading.section} · ${reading.currentTemp} (target ${reading.targetTemp})',
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
                    label: reading.status,
                    color: reading.status == 'alert'
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

class IotMaintenanceAlertList extends StatelessWidget {
  const IotMaintenanceAlertList({
    super.key,
    required this.alerts,
    required this.onAction,
  });

  final List<IotMaintenanceAlert> alerts;
  final ValueChanged<(IotMaintenanceAlert alert, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _EmptyBox(message: 'No maintenance alerts');
    }

    return Column(
      children: alerts
          .map(
            (alert) => Container(
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          alert.deviceName,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(label: alert.status, color: AppColors.warning),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${alert.section} · ${alert.alertType} · due in ${alert.dueInDays} days',
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
      'acknowledge_maintenance' => 'Acknowledge',
      'schedule_maintenance' => 'Schedule',
      'hold_device' => 'Hold',
      _ => action,
    };
  }
}

class IotUsageAnalyticsList extends StatelessWidget {
  const IotUsageAnalyticsList({super.key, required this.metrics});

  final List<IotUsageMetric> metrics;

  @override
  Widget build(BuildContext context) {
    if (metrics.isEmpty) {
      return const _EmptyBox(message: 'No usage analytics');
    }

    return Column(
      children: metrics
          .map(
            (metric) => Container(
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
                          metric.deviceName,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${metric.section} · ${metric.cyclesToday} cycles · ${metric.uptimeHours}h uptime',
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${metric.efficiencyPercent}%',
                    style: TextStyle(
                      color: metric.efficiencyPercent >= 85
                          ? AppColors.primary
                          : AppColors.warning,
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

class IotDeviceSidePanel extends StatelessWidget {
  const IotDeviceSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onSyncAll,
    required this.processing,
  });

  final IotDeviceStats stats;
  final IotDeviceFeatureFlags flags;
  final VoidCallback onSyncAll;
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
            'IoT metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Connected', '${stats.connectedDevices}'),
          _StatRow('Offline', '${stats.offlineDevices}'),
          _StatRow('Temp alerts', '${stats.tempAlerts}'),
          _StatRow('Maintenance due', '${stats.maintenanceDue}'),
          _StatRow('Avg efficiency', '${stats.avgEfficiency}%'),
          _StatRow('Synced today', '${stats.syncedToday}'),
          const SizedBox(height: 16),
          const Text(
            'Active IoT modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Smart ovens', flags.smartOvens),
          _FeatureChip('Smart fryers', flags.smartFryers),
          _FeatureChip('Smart refrigerators', flags.smartRefrigerators),
          _FeatureChip('Smart coffee machines', flags.smartCoffeeMachines),
          _FeatureChip('Temperature monitoring', flags.temperatureMonitoring),
          _FeatureChip('Auto maintenance', flags.autoMaintenanceAlerts),
          _FeatureChip('Usage analytics', flags.smartUsageAnalytics),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onSyncAll,
              icon: const Icon(Icons.sync, size: 18),
              label: const Text('Sync all devices'),
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
