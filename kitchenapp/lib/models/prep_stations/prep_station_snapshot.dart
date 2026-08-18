class PrepStationSnapshot {
  const PrepStationSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.stations,
    required this.stats,
    required this.stationFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<PrepStation> stations;
  final PrepStationStats stats;
  final PrepStationFeatureFlags stationFeatures;
  final List<String> sections;

  factory PrepStationSnapshot.fromJson(Map<String, dynamic> json) {
    return PrepStationSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      stations: (json['stations'] as List<dynamic>)
          .map((item) => PrepStation.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: PrepStationStats.fromJson(json['stats'] as Map<String, dynamic>),
      stationFeatures: PrepStationFeatureFlags.fromJson(
        json['stationFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class PrepStation {
  const PrepStation({
    required this.id,
    required this.name,
    required this.type,
    required this.kitchenSection,
    required this.assignedStaff,
    required this.queueCount,
    required this.timerSeconds,
    required this.timerRunning,
    required this.timerLabel,
    required this.workload,
    required this.productivityScore,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String name;
  final String type;
  final String kitchenSection;
  final String assignedStaff;
  final int queueCount;
  final int timerSeconds;
  final bool timerRunning;
  final String timerLabel;
  final double workload;
  final double productivityScore;
  final String status;
  final List<String> availableActions;

  factory PrepStation.fromJson(Map<String, dynamic> json) {
    return PrepStation(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String,
      kitchenSection: json['kitchenSection'] as String,
      assignedStaff: json['assignedStaff'] as String,
      queueCount: json['queueCount'] as int,
      timerSeconds: json['timerSeconds'] as int,
      timerRunning: json['timerRunning'] as bool? ?? false,
      timerLabel: json['timerLabel'] as String? ?? '00:00',
      workload: (json['workload'] as num).toDouble(),
      productivityScore: (json['productivityScore'] as num).toDouble(),
      status: json['status'] as String,
      availableActions:
          (json['availableActions'] as List<dynamic>? ?? const [])
              .map((item) => item.toString())
              .toList(),
    );
  }
}

class PrepStationStats {
  const PrepStationStats({
    required this.stations,
    required this.activeTimers,
    required this.avgWorkload,
    required this.totalQueue,
    required this.avgProductivity,
  });

  final int stations;
  final int activeTimers;
  final double avgWorkload;
  final int totalQueue;
  final double avgProductivity;

  factory PrepStationStats.fromJson(Map<String, dynamic> json) {
    return PrepStationStats(
      stations: json['stations'] as int? ?? 0,
      activeTimers: json['activeTimers'] as int? ?? 0,
      avgWorkload: (json['avgWorkload'] as num?)?.toDouble() ?? 0,
      totalQueue: json['totalQueue'] as int? ?? 0,
      avgProductivity: (json['avgProductivity'] as num?)?.toDouble() ?? 0,
    );
  }
}

class PrepStationFeatureFlags {
  const PrepStationFeatureFlags({
    required this.cuttingStation,
    required this.sauceStation,
    required this.grillStation,
    required this.fryStation,
    required this.beverageStation,
    required this.dessertPrepStation,
    required this.stationWorkloadTracking,
    required this.prepTimers,
    required this.queueBalancing,
    required this.staffAssignment,
    required this.productivityTracking,
  });

  final bool cuttingStation;
  final bool sauceStation;
  final bool grillStation;
  final bool fryStation;
  final bool beverageStation;
  final bool dessertPrepStation;
  final bool stationWorkloadTracking;
  final bool prepTimers;
  final bool queueBalancing;
  final bool staffAssignment;
  final bool productivityTracking;

  factory PrepStationFeatureFlags.fromJson(Map<String, dynamic> json) {
    return PrepStationFeatureFlags(
      cuttingStation: json['cuttingStation'] as bool? ?? false,
      sauceStation: json['sauceStation'] as bool? ?? false,
      grillStation: json['grillStation'] as bool? ?? false,
      fryStation: json['fryStation'] as bool? ?? false,
      beverageStation: json['beverageStation'] as bool? ?? false,
      dessertPrepStation: json['dessertPrepStation'] as bool? ?? false,
      stationWorkloadTracking:
          json['stationWorkloadTracking'] as bool? ?? false,
      prepTimers: json['prepTimers'] as bool? ?? false,
      queueBalancing: json['queueBalancing'] as bool? ?? false,
      staffAssignment: json['staffAssignment'] as bool? ?? false,
      productivityTracking: json['productivityTracking'] as bool? ?? false,
    );
  }
}

class PrepStationActionResult {
  const PrepStationActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory PrepStationActionResult.fromJson(Map<String, dynamic> json) {
    return PrepStationActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Prep station action applied',
    );
  }
}
