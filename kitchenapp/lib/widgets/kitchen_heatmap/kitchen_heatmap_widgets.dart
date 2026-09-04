import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/kitchen_heatmap/kitchen_heatmap_snapshot.dart';

class StationHeatmapList extends StatelessWidget {
  const StationHeatmapList({
    super.key,
    required this.stations,
    required this.onAction,
  });

  final List<StationHeatCell> stations;
  final ValueChanged<(StationHeatCell station, String action)> onAction;

  Color _heatColor(String level) {
    return switch (level) {
      'critical' => AppColors.danger,
      'high' => AppColors.warning,
      'medium' => AppColors.info,
      _ => AppColors.primary,
    };
  }

  @override
  Widget build(BuildContext context) {
    if (stations.isEmpty) {
      return const _EmptyBox(message: 'No station heat data');
    }

    return Column(
      children: stations
          .map(
            (station) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _heatColor(station.heatLevel).withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _heatColor(station.heatLevel).withValues(alpha: 0.3),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          station.stationName,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(
                        label: station.heatLevel,
                        color: _heatColor(station.heatLevel),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${station.section} · ${station.loadPercent}% load · ${station.ordersQueued} queued',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: station.loadPercent / 100,
                    backgroundColor: AppColors.panelBorder,
                    color: _heatColor(station.heatLevel),
                  ),
                  if (station.availableActions.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: station.availableActions
                          .map(
                            (action) => action == 'escalate_station'
                                ? FilledButton(
                                    onPressed: () =>
                                        onAction((station, action)),
                                    style: FilledButton.styleFrom(
                                      backgroundColor: AppColors.danger,
                                    ),
                                    child: Text(_actionLabel(action)),
                                  )
                                : OutlinedButton(
                                    onPressed: () =>
                                        onAction((station, action)),
                                    child: Text(_actionLabel(action)),
                                  ),
                          )
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'rebalance_station' => 'Rebalance',
      'pause_station' => 'Pause',
      'escalate_station' => 'Escalate',
      _ => action,
    };
  }
}

class DelayHotspotList extends StatelessWidget {
  const DelayHotspotList({
    super.key,
    required this.hotspots,
    required this.onAction,
  });

  final List<DelayHotspot> hotspots;
  final ValueChanged<(DelayHotspot hotspot, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (hotspots.isEmpty) {
      return const _EmptyBox(message: 'No delay hotspots');
    }

    return Column(
      children: hotspots
          .map(
            (hotspot) => _HeatmapActionCard(
              title: hotspot.zoneName,
              subtitle:
                  '${hotspot.section} · ${hotspot.delayMinutes} min delay · ${hotspot.severity}',
              tagLabel: hotspot.status,
              tagColor: AppColors.warning,
              actions: hotspot.availableActions,
              onAction: (action) => onAction((hotspot, action)),
              primaryActions: const {'reroute_orders'},
            ),
          )
          .toList(),
    );
  }
}

class StaffDensityList extends StatelessWidget {
  const StaffDensityList({
    super.key,
    required this.zones,
    required this.onAction,
  });

  final List<StaffDensityZone> zones;
  final ValueChanged<(StaffDensityZone zone, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (zones.isEmpty) {
      return const _EmptyBox(message: 'No staff density data');
    }

    return Column(
      children: zones
          .map(
            (zone) => _HeatmapActionCard(
              title: zone.zoneName,
              subtitle:
                  '${zone.section} · ${zone.staffCount}/${zone.capacity} staff · ${zone.densityLevel}',
              tagLabel: zone.densityLevel,
              tagColor: zone.densityLevel == 'understaffed'
                  ? AppColors.danger
                  : zone.densityLevel == 'overstaffed'
                      ? AppColors.warning
                      : AppColors.primary,
              actions: zone.availableActions,
              onAction: (action) => onAction((zone, action)),
              primaryActions: const {'request_backup'},
            ),
          )
          .toList(),
    );
  }
}

class RushVisualizationList extends StatelessWidget {
  const RushVisualizationList({
    super.key,
    required this.zones,
    required this.onAction,
  });

  final List<RushVisualizationZone> zones;
  final ValueChanged<(RushVisualizationZone zone, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (zones.isEmpty) {
      return const _EmptyBox(message: 'No rush zones');
    }

    return Column(
      children: zones
          .map(
            (zone) => _HeatmapActionCard(
              title: zone.zoneName,
              subtitle:
                  '${zone.section} · ${zone.coversExpected} covers · ${zone.windowLabel}',
              tagLabel: zone.rushLevel,
              tagColor: AppColors.premium,
              actions: zone.availableActions,
              onAction: (action) => onAction((zone, action)),
              primaryActions: const {'activate_rush_mode'},
            ),
          )
          .toList(),
    );
  }
}

class KitchenHeatmapSidePanel extends StatelessWidget {
  const KitchenHeatmapSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onRefreshAll,
    required this.processing,
  });

  final KitchenHeatmapStats stats;
  final KitchenHeatmapFeatureFlags flags;
  final VoidCallback onRefreshAll;
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
            'Heatmap metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Hot stations', '${stats.hotStations}'),
          _StatRow('Delay hotspots', '${stats.delayHotspots}'),
          _StatRow('Understaffed', '${stats.understaffedZones}'),
          _StatRow('Overstaffed', '${stats.overstaffedZones}'),
          _StatRow('Active rush zones', '${stats.activeRushZones}'),
          _StatRow('Avg load', '${stats.avgLoadPercent}%'),
          const SizedBox(height: 16),
          Text(
            'Heatmap modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Busy station mapping', flags.busyStationMapping),
          _FeatureChip('Delay hotspots', flags.delayHotspots),
          _FeatureChip('Staff density tracking', flags.staffDensityTracking),
          _FeatureChip('Rush visualization', flags.rushVisualization),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onRefreshAll,
              icon: const Icon(Icons.grid_on_outlined, size: 18),
              label: const Text('Refresh heatmap'),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeatmapActionCard extends StatelessWidget {
  const _HeatmapActionCard({
    required this.title,
    required this.subtitle,
    required this.tagLabel,
    required this.tagColor,
    required this.actions,
    required this.onAction,
    required this.primaryActions,
  });

  final String title;
  final String subtitle;
  final String tagLabel;
  final Color tagColor;
  final List<String> actions;
  final ValueChanged<String> onAction;
  final Set<String> primaryActions;

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
      'acknowledge_hotspot' => 'Acknowledge',
      'reroute_orders' => 'Reroute',
      'clear_hotspot' => 'Clear',
      'rebalance_staff' => 'Rebalance',
      'request_backup' => 'Backup',
      'activate_rush_mode' => 'Activate rush',
      'extend_rush_window' => 'Extend',
      'dismiss_rush' => 'Dismiss',
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
