class IotDeviceSnapshot {
  const IotDeviceSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.smartDevices,
    required this.temperatureReadings,
    required this.maintenanceAlerts,
    required this.usageAnalytics,
    required this.stats,
    required this.iotFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<SmartDevice> smartDevices;
  final List<TemperatureReading> temperatureReadings;
  final List<IotMaintenanceAlert> maintenanceAlerts;
  final List<IotUsageMetric> usageAnalytics;
  final IotDeviceStats stats;
  final IotDeviceFeatureFlags iotFeatures;
  final List<String> sections;

  factory IotDeviceSnapshot.fromJson(Map<String, dynamic> json) {
    return IotDeviceSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      smartDevices: (json['smartDevices'] as List<dynamic>)
          .map((item) => SmartDevice.fromJson(item as Map<String, dynamic>))
          .toList(),
      temperatureReadings: (json['temperatureReadings'] as List<dynamic>)
          .map(
            (item) => TemperatureReading.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      maintenanceAlerts: (json['maintenanceAlerts'] as List<dynamic>)
          .map(
            (item) =>
                IotMaintenanceAlert.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      usageAnalytics: (json['usageAnalytics'] as List<dynamic>)
          .map((item) => IotUsageMetric.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: IotDeviceStats.fromJson(json['stats'] as Map<String, dynamic>),
      iotFeatures: IotDeviceFeatureFlags.fromJson(
        json['iotFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class SmartDevice {
  const SmartDevice({
    required this.id,
    required this.deviceName,
    required this.deviceType,
    required this.section,
    required this.connectionStatus,
    required this.firmwareVersion,
    required this.lastSyncedAt,
    required this.availableActions,
  });

  final String id;
  final String deviceName;
  final String deviceType;
  final String section;
  final String connectionStatus;
  final String firmwareVersion;
  final String lastSyncedAt;
  final List<String> availableActions;

  factory SmartDevice.fromJson(Map<String, dynamic> json) {
    return SmartDevice(
      id: json['id'] as String,
      deviceName: json['deviceName'] as String,
      deviceType: json['deviceType'] as String? ?? 'General',
      section: json['section'] as String,
      connectionStatus: json['connectionStatus'] as String? ?? 'offline',
      firmwareVersion: json['firmwareVersion'] as String? ?? 'v1.0',
      lastSyncedAt: json['lastSyncedAt'] as String? ?? 'Unknown',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class TemperatureReading {
  const TemperatureReading({
    required this.id,
    required this.deviceName,
    required this.section,
    required this.currentTemp,
    required this.targetTemp,
    required this.status,
  });

  final String id;
  final String deviceName;
  final String section;
  final String currentTemp;
  final String targetTemp;
  final String status;

  factory TemperatureReading.fromJson(Map<String, dynamic> json) {
    return TemperatureReading(
      id: json['id'] as String,
      deviceName: json['deviceName'] as String,
      section: json['section'] as String,
      currentTemp: json['currentTemp'] as String? ?? '0°C',
      targetTemp: json['targetTemp'] as String? ?? '0°C',
      status: json['status'] as String? ?? 'stable',
    );
  }
}

class IotMaintenanceAlert {
  const IotMaintenanceAlert({
    required this.id,
    required this.deviceId,
    required this.deviceName,
    required this.section,
    required this.alertType,
    required this.dueInDays,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String deviceId;
  final String deviceName;
  final String section;
  final String alertType;
  final int dueInDays;
  final String status;
  final List<String> availableActions;

  factory IotMaintenanceAlert.fromJson(Map<String, dynamic> json) {
    return IotMaintenanceAlert(
      id: json['id'] as String,
      deviceId: json['deviceId'] as String,
      deviceName: json['deviceName'] as String,
      section: json['section'] as String,
      alertType: json['alertType'] as String? ?? 'maintenance',
      dueInDays: json['dueInDays'] as int? ?? 0,
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class IotUsageMetric {
  const IotUsageMetric({
    required this.id,
    required this.deviceName,
    required this.section,
    required this.cyclesToday,
    required this.uptimeHours,
    required this.efficiencyPercent,
  });

  final String id;
  final String deviceName;
  final String section;
  final int cyclesToday;
  final double uptimeHours;
  final int efficiencyPercent;

  factory IotUsageMetric.fromJson(Map<String, dynamic> json) {
    return IotUsageMetric(
      id: json['id'] as String,
      deviceName: json['deviceName'] as String,
      section: json['section'] as String,
      cyclesToday: json['cyclesToday'] as int? ?? 0,
      uptimeHours: (json['uptimeHours'] as num?)?.toDouble() ?? 0,
      efficiencyPercent: json['efficiencyPercent'] as int? ?? 0,
    );
  }
}

class IotDeviceStats {
  const IotDeviceStats({
    required this.connectedDevices,
    required this.offlineDevices,
    required this.tempAlerts,
    required this.maintenanceDue,
    required this.avgEfficiency,
    required this.syncedToday,
  });

  final int connectedDevices;
  final int offlineDevices;
  final int tempAlerts;
  final int maintenanceDue;
  final int avgEfficiency;
  final int syncedToday;

  factory IotDeviceStats.fromJson(Map<String, dynamic> json) {
    return IotDeviceStats(
      connectedDevices: json['connectedDevices'] as int? ?? 0,
      offlineDevices: json['offlineDevices'] as int? ?? 0,
      tempAlerts: json['tempAlerts'] as int? ?? 0,
      maintenanceDue: json['maintenanceDue'] as int? ?? 0,
      avgEfficiency: json['avgEfficiency'] as int? ?? 0,
      syncedToday: json['syncedToday'] as int? ?? 0,
    );
  }
}

class IotDeviceFeatureFlags {
  const IotDeviceFeatureFlags({
    required this.smartOvens,
    required this.smartFryers,
    required this.smartRefrigerators,
    required this.smartCoffeeMachines,
    required this.temperatureMonitoring,
    required this.autoMaintenanceAlerts,
    required this.smartUsageAnalytics,
  });

  final bool smartOvens;
  final bool smartFryers;
  final bool smartRefrigerators;
  final bool smartCoffeeMachines;
  final bool temperatureMonitoring;
  final bool autoMaintenanceAlerts;
  final bool smartUsageAnalytics;

  factory IotDeviceFeatureFlags.fromJson(Map<String, dynamic> json) {
    return IotDeviceFeatureFlags(
      smartOvens: json['smartOvens'] as bool? ?? false,
      smartFryers: json['smartFryers'] as bool? ?? false,
      smartRefrigerators: json['smartRefrigerators'] as bool? ?? false,
      smartCoffeeMachines: json['smartCoffeeMachines'] as bool? ?? false,
      temperatureMonitoring: json['temperatureMonitoring'] as bool? ?? false,
      autoMaintenanceAlerts: json['autoMaintenanceAlerts'] as bool? ?? false,
      smartUsageAnalytics: json['smartUsageAnalytics'] as bool? ?? false,
    );
  }
}

class IotDeviceActionResult {
  const IotDeviceActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory IotDeviceActionResult.fromJson(Map<String, dynamic> json) {
    return IotDeviceActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'IoT action applied',
    );
  }
}
