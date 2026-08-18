class SmartEnergySnapshot {
  const SmartEnergySnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.gasLeakAlerts,
    required this.energyUsage,
    required this.shutdownAlerts,
    required this.temperatureAlerts,
    required this.stats,
    required this.energyFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<GasLeakAlert> gasLeakAlerts;
  final List<EnergyUsageReading> energyUsage;
  final List<SmartShutdownAlert> shutdownAlerts;
  final List<HighTemperatureAlert> temperatureAlerts;
  final SmartEnergyStats stats;
  final SmartEnergyFeatureFlags energyFeatures;
  final List<String> sections;

  factory SmartEnergySnapshot.fromJson(Map<String, dynamic> json) {
    return SmartEnergySnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      gasLeakAlerts: (json['gasLeakAlerts'] as List<dynamic>)
          .map((item) => GasLeakAlert.fromJson(item as Map<String, dynamic>))
          .toList(),
      energyUsage: (json['energyUsage'] as List<dynamic>)
          .map((item) => EnergyUsageReading.fromJson(item as Map<String, dynamic>))
          .toList(),
      shutdownAlerts: (json['shutdownAlerts'] as List<dynamic>)
          .map(
            (item) => SmartShutdownAlert.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      temperatureAlerts: (json['temperatureAlerts'] as List<dynamic>)
          .map(
            (item) =>
                HighTemperatureAlert.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: SmartEnergyStats.fromJson(json['stats'] as Map<String, dynamic>),
      energyFeatures: SmartEnergyFeatureFlags.fromJson(
        json['energyFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class GasLeakAlert {
  const GasLeakAlert({
    required this.id,
    required this.location,
    required this.section,
    required this.sensorLevel,
    required this.threshold,
    required this.severity,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String location;
  final String section;
  final String sensorLevel;
  final String threshold;
  final String severity;
  final String status;
  final List<String> availableActions;

  factory GasLeakAlert.fromJson(Map<String, dynamic> json) {
    return GasLeakAlert(
      id: json['id'] as String,
      location: json['location'] as String,
      section: json['section'] as String,
      sensorLevel: json['sensorLevel'] as String? ?? '0 ppm',
      threshold: json['threshold'] as String? ?? '50 ppm',
      severity: json['severity'] as String? ?? 'normal',
      status: json['status'] as String? ?? 'monitoring',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class EnergyUsageReading {
  const EnergyUsageReading({
    required this.id,
    required this.meterName,
    required this.section,
    required this.currentKwh,
    required this.dailyKwh,
    required this.peakWindow,
    required this.trend,
  });

  final String id;
  final String meterName;
  final String section;
  final double currentKwh;
  final double dailyKwh;
  final String peakWindow;
  final String trend;

  factory EnergyUsageReading.fromJson(Map<String, dynamic> json) {
    return EnergyUsageReading(
      id: json['id'] as String,
      meterName: json['meterName'] as String,
      section: json['section'] as String,
      currentKwh: (json['currentKwh'] as num?)?.toDouble() ?? 0,
      dailyKwh: (json['dailyKwh'] as num?)?.toDouble() ?? 0,
      peakWindow: json['peakWindow'] as String? ?? 'N/A',
      trend: json['trend'] as String? ?? 'stable',
    );
  }
}

class SmartShutdownAlert {
  const SmartShutdownAlert({
    required this.id,
    required this.equipmentName,
    required this.section,
    required this.reason,
    required this.scheduledTime,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String equipmentName;
  final String section;
  final String reason;
  final String scheduledTime;
  final String status;
  final List<String> availableActions;

  factory SmartShutdownAlert.fromJson(Map<String, dynamic> json) {
    return SmartShutdownAlert(
      id: json['id'] as String,
      equipmentName: json['equipmentName'] as String,
      section: json['section'] as String,
      reason: json['reason'] as String? ?? '',
      scheduledTime: json['scheduledTime'] as String? ?? 'Immediate',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class HighTemperatureAlert {
  const HighTemperatureAlert({
    required this.id,
    required this.equipmentName,
    required this.section,
    required this.currentTemp,
    required this.threshold,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String equipmentName;
  final String section;
  final String currentTemp;
  final String threshold;
  final String status;
  final List<String> availableActions;

  factory HighTemperatureAlert.fromJson(Map<String, dynamic> json) {
    return HighTemperatureAlert(
      id: json['id'] as String,
      equipmentName: json['equipmentName'] as String,
      section: json['section'] as String,
      currentTemp: json['currentTemp'] as String? ?? '0°C',
      threshold: json['threshold'] as String? ?? '0°C',
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class SmartEnergyStats {
  const SmartEnergyStats({
    required this.totalDailyKwh,
    required this.activeGasAlerts,
    required this.pendingShutdowns,
    required this.temperatureAlerts,
    required this.sectionsMonitored,
    required this.resolvedToday,
  });

  final double totalDailyKwh;
  final int activeGasAlerts;
  final int pendingShutdowns;
  final int temperatureAlerts;
  final int sectionsMonitored;
  final int resolvedToday;

  factory SmartEnergyStats.fromJson(Map<String, dynamic> json) {
    return SmartEnergyStats(
      totalDailyKwh: (json['totalDailyKwh'] as num?)?.toDouble() ?? 0,
      activeGasAlerts: json['activeGasAlerts'] as int? ?? 0,
      pendingShutdowns: json['pendingShutdowns'] as int? ?? 0,
      temperatureAlerts: json['temperatureAlerts'] as int? ?? 0,
      sectionsMonitored: json['sectionsMonitored'] as int? ?? 0,
      resolvedToday: json['resolvedToday'] as int? ?? 0,
    );
  }
}

class SmartEnergyFeatureFlags {
  const SmartEnergyFeatureFlags({
    required this.gasLeakAlerts,
    required this.energyUsageTracking,
    required this.smartShutdownAlerts,
    required this.highTemperatureAlerts,
  });

  final bool gasLeakAlerts;
  final bool energyUsageTracking;
  final bool smartShutdownAlerts;
  final bool highTemperatureAlerts;

  factory SmartEnergyFeatureFlags.fromJson(Map<String, dynamic> json) {
    return SmartEnergyFeatureFlags(
      gasLeakAlerts: json['gasLeakAlerts'] as bool? ?? false,
      energyUsageTracking: json['energyUsageTracking'] as bool? ?? false,
      smartShutdownAlerts: json['smartShutdownAlerts'] as bool? ?? false,
      highTemperatureAlerts: json['highTemperatureAlerts'] as bool? ?? false,
    );
  }
}

class SmartEnergyActionResult {
  const SmartEnergyActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory SmartEnergyActionResult.fromJson(Map<String, dynamic> json) {
    return SmartEnergyActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Energy action applied',
    );
  }
}
