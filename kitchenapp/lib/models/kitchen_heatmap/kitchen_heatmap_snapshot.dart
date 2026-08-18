class KitchenHeatmapSnapshot {
  const KitchenHeatmapSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.stationHeatmap,
    required this.delayHotspots,
    required this.staffDensity,
    required this.rushZones,
    required this.stats,
    required this.heatmapFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<StationHeatCell> stationHeatmap;
  final List<DelayHotspot> delayHotspots;
  final List<StaffDensityZone> staffDensity;
  final List<RushVisualizationZone> rushZones;
  final KitchenHeatmapStats stats;
  final KitchenHeatmapFeatureFlags heatmapFeatures;
  final List<String> sections;

  factory KitchenHeatmapSnapshot.fromJson(Map<String, dynamic> json) {
    return KitchenHeatmapSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      stationHeatmap: (json['stationHeatmap'] as List<dynamic>)
          .map((item) => StationHeatCell.fromJson(item as Map<String, dynamic>))
          .toList(),
      delayHotspots: (json['delayHotspots'] as List<dynamic>)
          .map((item) => DelayHotspot.fromJson(item as Map<String, dynamic>))
          .toList(),
      staffDensity: (json['staffDensity'] as List<dynamic>)
          .map((item) => StaffDensityZone.fromJson(item as Map<String, dynamic>))
          .toList(),
      rushZones: (json['rushZones'] as List<dynamic>)
          .map(
            (item) => RushVisualizationZone.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: KitchenHeatmapStats.fromJson(json['stats'] as Map<String, dynamic>),
      heatmapFeatures: KitchenHeatmapFeatureFlags.fromJson(
        json['heatmapFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class StationHeatCell {
  const StationHeatCell({
    required this.id,
    required this.stationName,
    required this.section,
    required this.heatLevel,
    required this.loadPercent,
    required this.ordersQueued,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String stationName;
  final String section;
  final String heatLevel;
  final int loadPercent;
  final int ordersQueued;
  final String status;
  final List<String> availableActions;

  factory StationHeatCell.fromJson(Map<String, dynamic> json) {
    return StationHeatCell(
      id: json['id'] as String,
      stationName: json['stationName'] as String,
      section: json['section'] as String,
      heatLevel: json['heatLevel'] as String? ?? 'medium',
      loadPercent: json['loadPercent'] as int? ?? 0,
      ordersQueued: json['ordersQueued'] as int? ?? 0,
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class DelayHotspot {
  const DelayHotspot({
    required this.id,
    required this.zoneName,
    required this.section,
    required this.delayMinutes,
    required this.severity,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String zoneName;
  final String section;
  final int delayMinutes;
  final String severity;
  final String status;
  final List<String> availableActions;

  factory DelayHotspot.fromJson(Map<String, dynamic> json) {
    return DelayHotspot(
      id: json['id'] as String,
      zoneName: json['zoneName'] as String,
      section: json['section'] as String,
      delayMinutes: json['delayMinutes'] as int? ?? 0,
      severity: json['severity'] as String? ?? 'medium',
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class StaffDensityZone {
  const StaffDensityZone({
    required this.id,
    required this.zoneName,
    required this.section,
    required this.staffCount,
    required this.capacity,
    required this.densityLevel,
    required this.availableActions,
  });

  final String id;
  final String zoneName;
  final String section;
  final int staffCount;
  final int capacity;
  final String densityLevel;
  final List<String> availableActions;

  factory StaffDensityZone.fromJson(Map<String, dynamic> json) {
    return StaffDensityZone(
      id: json['id'] as String,
      zoneName: json['zoneName'] as String,
      section: json['section'] as String,
      staffCount: json['staffCount'] as int? ?? 0,
      capacity: json['capacity'] as int? ?? 0,
      densityLevel: json['densityLevel'] as String? ?? 'balanced',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class RushVisualizationZone {
  const RushVisualizationZone({
    required this.id,
    required this.zoneName,
    required this.section,
    required this.rushLevel,
    required this.coversExpected,
    required this.windowLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String zoneName;
  final String section;
  final String rushLevel;
  final int coversExpected;
  final String windowLabel;
  final String status;
  final List<String> availableActions;

  factory RushVisualizationZone.fromJson(Map<String, dynamic> json) {
    return RushVisualizationZone(
      id: json['id'] as String,
      zoneName: json['zoneName'] as String,
      section: json['section'] as String,
      rushLevel: json['rushLevel'] as String? ?? 'moderate',
      coversExpected: json['coversExpected'] as int? ?? 0,
      windowLabel: json['windowLabel'] as String? ?? 'Now',
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class KitchenHeatmapStats {
  const KitchenHeatmapStats({
    required this.hotStations,
    required this.delayHotspots,
    required this.overstaffedZones,
    required this.understaffedZones,
    required this.activeRushZones,
    required this.avgLoadPercent,
  });

  final int hotStations;
  final int delayHotspots;
  final int overstaffedZones;
  final int understaffedZones;
  final int activeRushZones;
  final int avgLoadPercent;

  factory KitchenHeatmapStats.fromJson(Map<String, dynamic> json) {
    return KitchenHeatmapStats(
      hotStations: json['hotStations'] as int? ?? 0,
      delayHotspots: json['delayHotspots'] as int? ?? 0,
      overstaffedZones: json['overstaffedZones'] as int? ?? 0,
      understaffedZones: json['understaffedZones'] as int? ?? 0,
      activeRushZones: json['activeRushZones'] as int? ?? 0,
      avgLoadPercent: json['avgLoadPercent'] as int? ?? 0,
    );
  }
}

class KitchenHeatmapFeatureFlags {
  const KitchenHeatmapFeatureFlags({
    required this.busyStationMapping,
    required this.delayHotspots,
    required this.staffDensityTracking,
    required this.rushVisualization,
  });

  final bool busyStationMapping;
  final bool delayHotspots;
  final bool staffDensityTracking;
  final bool rushVisualization;

  factory KitchenHeatmapFeatureFlags.fromJson(Map<String, dynamic> json) {
    return KitchenHeatmapFeatureFlags(
      busyStationMapping: json['busyStationMapping'] as bool? ?? false,
      delayHotspots: json['delayHotspots'] as bool? ?? false,
      staffDensityTracking: json['staffDensityTracking'] as bool? ?? false,
      rushVisualization: json['rushVisualization'] as bool? ?? false,
    );
  }
}

class KitchenHeatmapActionResult {
  const KitchenHeatmapActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory KitchenHeatmapActionResult.fromJson(Map<String, dynamic> json) {
    return KitchenHeatmapActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Heatmap action applied',
    );
  }
}
