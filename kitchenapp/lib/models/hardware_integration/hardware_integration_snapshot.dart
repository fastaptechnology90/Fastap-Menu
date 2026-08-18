class HardwareIntegrationSnapshot {
  const HardwareIntegrationSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.displayScreens,
    required this.tablets,
    required this.thermalPrinters,
    required this.smartwatches,
    required this.nfcDevices,
    required this.barcodeScanners,
    required this.stats,
    required this.supportedDevices,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<KitchenDisplayScreen> displayScreens;
  final List<KitchenTablet> tablets;
  final List<ThermalPrinter> thermalPrinters;
  final List<IntegratedSmartwatch> smartwatches;
  final List<NfcDevice> nfcDevices;
  final List<BarcodeScanner> barcodeScanners;
  final HardwareIntegrationStats stats;
  final HardwareSupportedDevices supportedDevices;
  final List<String> sections;

  factory HardwareIntegrationSnapshot.fromJson(Map<String, dynamic> json) {
    return HardwareIntegrationSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      displayScreens: (json['displayScreens'] as List<dynamic>)
          .map(
            (item) =>
                KitchenDisplayScreen.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      tablets: (json['tablets'] as List<dynamic>)
          .map((item) => KitchenTablet.fromJson(item as Map<String, dynamic>))
          .toList(),
      thermalPrinters: (json['thermalPrinters'] as List<dynamic>)
          .map((item) => ThermalPrinter.fromJson(item as Map<String, dynamic>))
          .toList(),
      smartwatches: (json['smartwatches'] as List<dynamic>)
          .map(
            (item) =>
                IntegratedSmartwatch.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      nfcDevices: (json['nfcDevices'] as List<dynamic>)
          .map((item) => NfcDevice.fromJson(item as Map<String, dynamic>))
          .toList(),
      barcodeScanners: (json['barcodeScanners'] as List<dynamic>)
          .map((item) => BarcodeScanner.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: HardwareIntegrationStats.fromJson(
        json['stats'] as Map<String, dynamic>,
      ),
      supportedDevices: HardwareSupportedDevices.fromJson(
        json['supportedDevices'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class KitchenDisplayScreen {
  const KitchenDisplayScreen({
    required this.id,
    required this.deviceName,
    required this.section,
    required this.connectionStatus,
    required this.resolution,
    required this.ordersShown,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String deviceName;
  final String section;
  final String connectionStatus;
  final String resolution;
  final int ordersShown;
  final String status;
  final List<String> availableActions;

  factory KitchenDisplayScreen.fromJson(Map<String, dynamic> json) {
    return KitchenDisplayScreen(
      id: json['id'] as String,
      deviceName: json['deviceName'] as String,
      section: json['section'] as String,
      connectionStatus: json['connectionStatus'] as String? ?? 'offline',
      resolution: json['resolution'] as String? ?? '1920×1080',
      ordersShown: json['ordersShown'] as int? ?? 0,
      status: json['status'] as String? ?? 'idle',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class KitchenTablet {
  const KitchenTablet({
    required this.id,
    required this.deviceName,
    required this.section,
    required this.connectionStatus,
    required this.assignedRole,
    required this.batteryPercent,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String deviceName;
  final String section;
  final String connectionStatus;
  final String assignedRole;
  final int batteryPercent;
  final String status;
  final List<String> availableActions;

  factory KitchenTablet.fromJson(Map<String, dynamic> json) {
    return KitchenTablet(
      id: json['id'] as String,
      deviceName: json['deviceName'] as String,
      section: json['section'] as String,
      connectionStatus: json['connectionStatus'] as String? ?? 'offline',
      assignedRole: json['assignedRole'] as String? ?? 'Station',
      batteryPercent: json['batteryPercent'] as int? ?? 0,
      status: json['status'] as String? ?? 'idle',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ThermalPrinter {
  const ThermalPrinter({
    required this.id,
    required this.deviceName,
    required this.section,
    required this.connectionStatus,
    required this.paperLevel,
    required this.queueCount,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String deviceName;
  final String section;
  final String connectionStatus;
  final String paperLevel;
  final int queueCount;
  final String status;
  final List<String> availableActions;

  factory ThermalPrinter.fromJson(Map<String, dynamic> json) {
    return ThermalPrinter(
      id: json['id'] as String,
      deviceName: json['deviceName'] as String,
      section: json['section'] as String,
      connectionStatus: json['connectionStatus'] as String? ?? 'offline',
      paperLevel: json['paperLevel'] as String? ?? 'ok',
      queueCount: json['queueCount'] as int? ?? 0,
      status: json['status'] as String? ?? 'idle',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class IntegratedSmartwatch {
  const IntegratedSmartwatch({
    required this.id,
    required this.deviceName,
    required this.section,
    required this.connectionStatus,
    required this.wearerName,
    required this.lastPing,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String deviceName;
  final String section;
  final String connectionStatus;
  final String wearerName;
  final String lastPing;
  final String status;
  final List<String> availableActions;

  factory IntegratedSmartwatch.fromJson(Map<String, dynamic> json) {
    return IntegratedSmartwatch(
      id: json['id'] as String,
      deviceName: json['deviceName'] as String,
      section: json['section'] as String,
      connectionStatus: json['connectionStatus'] as String? ?? 'offline',
      wearerName: json['wearerName'] as String? ?? 'Unassigned',
      lastPing: json['lastPing'] as String? ?? 'Unknown',
      status: json['status'] as String? ?? 'idle',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class NfcDevice {
  const NfcDevice({
    required this.id,
    required this.deviceName,
    required this.section,
    required this.connectionStatus,
    required this.tapCountToday,
    required this.lastTap,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String deviceName;
  final String section;
  final String connectionStatus;
  final int tapCountToday;
  final String lastTap;
  final String status;
  final List<String> availableActions;

  factory NfcDevice.fromJson(Map<String, dynamic> json) {
    return NfcDevice(
      id: json['id'] as String,
      deviceName: json['deviceName'] as String,
      section: json['section'] as String,
      connectionStatus: json['connectionStatus'] as String? ?? 'offline',
      tapCountToday: json['tapCountToday'] as int? ?? 0,
      lastTap: json['lastTap'] as String? ?? 'Never',
      status: json['status'] as String? ?? 'idle',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class BarcodeScanner {
  const BarcodeScanner({
    required this.id,
    required this.deviceName,
    required this.section,
    required this.connectionStatus,
    required this.scansToday,
    required this.calibrationStatus,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String deviceName;
  final String section;
  final String connectionStatus;
  final int scansToday;
  final String calibrationStatus;
  final String status;
  final List<String> availableActions;

  factory BarcodeScanner.fromJson(Map<String, dynamic> json) {
    return BarcodeScanner(
      id: json['id'] as String,
      deviceName: json['deviceName'] as String,
      section: json['section'] as String,
      connectionStatus: json['connectionStatus'] as String? ?? 'offline',
      scansToday: json['scansToday'] as int? ?? 0,
      calibrationStatus: json['calibrationStatus'] as String? ?? 'ok',
      status: json['status'] as String? ?? 'idle',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class HardwareIntegrationStats {
  const HardwareIntegrationStats({
    required this.connectedDevices,
    required this.offlineDevices,
    required this.lowBatteryTablets,
    required this.printersNeedingPaper,
    required this.uncalibratedScanners,
    required this.syncedToday,
  });

  final int connectedDevices;
  final int offlineDevices;
  final int lowBatteryTablets;
  final int printersNeedingPaper;
  final int uncalibratedScanners;
  final int syncedToday;

  factory HardwareIntegrationStats.fromJson(Map<String, dynamic> json) {
    return HardwareIntegrationStats(
      connectedDevices: json['connectedDevices'] as int? ?? 0,
      offlineDevices: json['offlineDevices'] as int? ?? 0,
      lowBatteryTablets: json['lowBatteryTablets'] as int? ?? 0,
      printersNeedingPaper: json['printersNeedingPaper'] as int? ?? 0,
      uncalibratedScanners: json['uncalibratedScanners'] as int? ?? 0,
      syncedToday: json['syncedToday'] as int? ?? 0,
    );
  }
}

class HardwareSupportedDevices {
  const HardwareSupportedDevices({
    required this.kitchenDisplayScreens,
    required this.tablets,
    required this.thermalPrinters,
    required this.smartwatches,
    required this.nfcDevices,
    required this.barcodeScanners,
  });

  final bool kitchenDisplayScreens;
  final bool tablets;
  final bool thermalPrinters;
  final bool smartwatches;
  final bool nfcDevices;
  final bool barcodeScanners;

  factory HardwareSupportedDevices.fromJson(Map<String, dynamic> json) {
    return HardwareSupportedDevices(
      kitchenDisplayScreens: json['kitchenDisplayScreens'] as bool? ?? false,
      tablets: json['tablets'] as bool? ?? false,
      thermalPrinters: json['thermalPrinters'] as bool? ?? false,
      smartwatches: json['smartwatches'] as bool? ?? false,
      nfcDevices: json['nfcDevices'] as bool? ?? false,
      barcodeScanners: json['barcodeScanners'] as bool? ?? false,
    );
  }
}

class HardwareIntegrationActionResult {
  const HardwareIntegrationActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory HardwareIntegrationActionResult.fromJson(Map<String, dynamic> json) {
    return HardwareIntegrationActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Hardware action applied',
    );
  }
}
