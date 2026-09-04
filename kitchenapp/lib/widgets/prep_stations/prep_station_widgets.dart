import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/prep_stations/prep_station_snapshot.dart';

class PrepStationCard extends StatelessWidget {
  const PrepStationCard({
    super.key,
    required this.station,
    required this.onAction,
    required this.onAssign,
  });

  final PrepStation station;
  final ValueChanged<String> onAction;
  final VoidCallback onAssign;

  @override
  Widget build(BuildContext context) {
    final overloaded = station.workload > 0.8;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: overloaded ? AppColors.warning : AppColors.panelBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(_iconForType(station.type), color: AppColors.primary, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  station.name,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _StatusTag(status: station.status),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${station.kitchenSection} · ${station.assignedStaff}',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 14,
            runSpacing: 8,
            children: [
              _Meta('Queue', '${station.queueCount}'),
              _Meta('Timer', station.timerLabel),
              _Meta('Load', '${(station.workload * 100).round()}%'),
              _Meta(
                'Productivity',
                '${(station.productivityScore * 100).round()}%',
              ),
            ],
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: station.workload,
            backgroundColor: AppColors.chipBackground,
            color: overloaded ? AppColors.warning : AppColors.primary,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: onAssign,
                child: const Text('Assign staff'),
              ),
              ...station.availableActions.map(
                (action) => OutlinedButton(
                  onPressed: () => onAction(action),
                  child: Text(_actionLabel(action)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static IconData _iconForType(String type) {
    return switch (type) {
      'cutting' => Icons.content_cut_outlined,
      'sauce' => Icons.water_drop_outlined,
      'grill' => Icons.outdoor_grill_outlined,
      'fry' => Icons.local_fire_department_outlined,
      'beverage' => Icons.local_cafe_outlined,
      'dessert' => Icons.cake_outlined,
      _ => Icons.countertops_outlined,
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'start_timer' => 'Start timer',
      'pause_timer' => 'Pause timer',
      'reset_timer' => 'Reset timer',
      'clear_queue' => 'Clear queue',
      'reduce_load' => 'Reduce load',
      _ => action,
    };
  }
}

class PrepStationSidePanel extends StatelessWidget {
  const PrepStationSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onBalance,
    required this.balancing,
  });

  final PrepStationStats stats;
  final PrepStationFeatureFlags flags;
  final VoidCallback onBalance;
  final bool balancing;

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
            'Station operations',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              _Stat('Stations', stats.stations),
              _Stat('Active timers', stats.activeTimers),
              _Stat('Queue total', stats.totalQueue),
              _Stat(
                'Avg load',
                '${(stats.avgWorkload * 100).round()}%',
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FlagChip('Cutting', flags.cuttingStation),
              _FlagChip('Sauce', flags.sauceStation),
              _FlagChip('Grill', flags.grillStation),
              _FlagChip('Fry', flags.fryStation),
              _FlagChip('Beverage', flags.beverageStation),
              _FlagChip('Dessert prep', flags.dessertPrepStation),
              _FlagChip('Workload', flags.stationWorkloadTracking),
              _FlagChip('Prep timers', flags.prepTimers),
              _FlagChip('Queue balance', flags.queueBalancing),
              _FlagChip('Staff assign', flags.staffAssignment),
              _FlagChip('Productivity', flags.productivityTracking),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: balancing ? null : onBalance,
            icon: balancing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.balance, size: 18),
            label: const Text('Balance station queues'),
          ),
        ],
      ),
    );
  }
}

class _StatusTag extends StatelessWidget {
  const _StatusTag({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'active' => AppColors.primary,
      'paused' => AppColors.warning,
      _ => AppColors.secondaryText,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Text(
      '$label: $value',
      style: TextStyle(
        color: AppColors.secondaryText,
        fontWeight: FontWeight.w700,
        fontSize: 12,
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);

  final String label;
  final dynamic value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$value',
          style: TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w900,
            fontSize: 20,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

class _FlagChip extends StatelessWidget {
  const _FlagChip(this.label, this.enabled);

  final String label;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(
        enabled ? Icons.check_circle : Icons.radio_button_unchecked,
        size: 16,
        color: enabled ? AppColors.primary : AppColors.secondaryText,
      ),
      label: Text(label),
      backgroundColor: enabled
          ? AppColors.primary.withValues(alpha: 0.08)
          : AppColors.chipBackground,
    );
  }
}
