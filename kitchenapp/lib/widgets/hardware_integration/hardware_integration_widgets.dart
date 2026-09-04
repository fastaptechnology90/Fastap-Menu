import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/hardware_integration/hardware_integration_snapshot.dart';

class KitchenDisplayList extends StatelessWidget {
  const KitchenDisplayList({
    super.key,
    required this.displays,
    required this.onAction,
  });

  final List<KitchenDisplayScreen> displays;
  final ValueChanged<(KitchenDisplayScreen display, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _HardwareDeviceList(
      emptyMessage: 'No kitchen display screens',
      items: displays
          .map(
            (display) => _HardwareDeviceCard(
              title: display.deviceName,
              subtitle:
                  '${display.section} · ${display.resolution} · ${display.ordersShown} orders',
              statusLabel: display.connectionStatus,
              statusColor: _connectionColor(display.connectionStatus),
              actions: display.availableActions,
              primaryActions: const {'sync_content'},
              onAction: (action) => onAction((display, action)),
            ),
          )
          .toList(),
    );
  }
}

class KitchenTabletList extends StatelessWidget {
  const KitchenTabletList({
    super.key,
    required this.tablets,
    required this.onAction,
  });

  final List<KitchenTablet> tablets;
  final ValueChanged<(KitchenTablet tablet, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _HardwareDeviceList(
      emptyMessage: 'No tablets registered',
      items: tablets
          .map(
            (tablet) => _HardwareDeviceCard(
              title: tablet.deviceName,
              subtitle:
                  '${tablet.section} · ${tablet.assignedRole} · ${tablet.batteryPercent}% battery',
              statusLabel: tablet.status,
              statusColor: tablet.batteryPercent < 30
                  ? AppColors.warning
                  : _connectionColor(tablet.connectionStatus),
              actions: tablet.availableActions,
              primaryActions: const {'pair_tablet'},
              onAction: (action) => onAction((tablet, action)),
            ),
          )
          .toList(),
    );
  }
}

class ThermalPrinterList extends StatelessWidget {
  const ThermalPrinterList({
    super.key,
    required this.printers,
    required this.onAction,
  });

  final List<ThermalPrinter> printers;
  final ValueChanged<(ThermalPrinter printer, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _HardwareDeviceList(
      emptyMessage: 'No thermal printers',
      items: printers
          .map(
            (printer) => _HardwareDeviceCard(
              title: printer.deviceName,
              subtitle:
                  '${printer.section} · Paper ${printer.paperLevel} · ${printer.queueCount} queued',
              statusLabel: printer.connectionStatus,
              statusColor: printer.paperLevel == 'low'
                  ? AppColors.warning
                  : _connectionColor(printer.connectionStatus),
              actions: printer.availableActions,
              primaryActions: const {'test_print'},
              onAction: (action) => onAction((printer, action)),
            ),
          )
          .toList(),
    );
  }
}

class IntegratedSmartwatchList extends StatelessWidget {
  const IntegratedSmartwatchList({
    super.key,
    required this.smartwatches,
    required this.onAction,
  });

  final List<IntegratedSmartwatch> smartwatches;
  final ValueChanged<(IntegratedSmartwatch watch, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _HardwareDeviceList(
      emptyMessage: 'No smartwatches paired',
      items: smartwatches
          .map(
            (watch) => _HardwareDeviceCard(
              title: watch.deviceName,
              subtitle:
                  '${watch.section} · ${watch.wearerName} · Ping ${watch.lastPing}',
              statusLabel: watch.connectionStatus,
              statusColor: _connectionColor(watch.connectionStatus),
              actions: watch.availableActions,
              primaryActions: const {'pair_watch'},
              onAction: (action) => onAction((watch, action)),
            ),
          )
          .toList(),
    );
  }
}

class NfcDeviceList extends StatelessWidget {
  const NfcDeviceList({
    super.key,
    required this.devices,
    required this.onAction,
  });

  final List<NfcDevice> devices;
  final ValueChanged<(NfcDevice device, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _HardwareDeviceList(
      emptyMessage: 'No NFC devices',
      items: devices
          .map(
            (device) => _HardwareDeviceCard(
              title: device.deviceName,
              subtitle:
                  '${device.section} · ${device.tapCountToday} taps · Last ${device.lastTap}',
              statusLabel: device.status,
              statusColor: _connectionColor(device.connectionStatus),
              actions: device.availableActions,
              primaryActions: const {'sync_credentials'},
              onAction: (action) => onAction((device, action)),
            ),
          )
          .toList(),
    );
  }
}

class BarcodeScannerList extends StatelessWidget {
  const BarcodeScannerList({
    super.key,
    required this.scanners,
    required this.onAction,
  });

  final List<BarcodeScanner> scanners;
  final ValueChanged<(BarcodeScanner scanner, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _HardwareDeviceList(
      emptyMessage: 'No barcode scanners',
      items: scanners
          .map(
            (scanner) => _HardwareDeviceCard(
              title: scanner.deviceName,
              subtitle:
                  '${scanner.section} · ${scanner.scansToday} scans · ${scanner.calibrationStatus}',
              statusLabel: scanner.connectionStatus,
              statusColor: scanner.calibrationStatus != 'ok'
                  ? AppColors.warning
                  : _connectionColor(scanner.connectionStatus),
              actions: scanner.availableActions,
              primaryActions: const {'calibrate_scanner'},
              onAction: (action) => onAction((scanner, action)),
            ),
          )
          .toList(),
    );
  }
}

class HardwareIntegrationSidePanel extends StatelessWidget {
  const HardwareIntegrationSidePanel({
    super.key,
    required this.stats,
    required this.supportedDevices,
    required this.onSyncAll,
    required this.processing,
  });

  final HardwareIntegrationStats stats;
  final HardwareSupportedDevices supportedDevices;
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
            'Hardware metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Connected', '${stats.connectedDevices}'),
          _StatRow('Offline', '${stats.offlineDevices}'),
          _StatRow('Low battery tablets', '${stats.lowBatteryTablets}'),
          _StatRow('Printers low paper', '${stats.printersNeedingPaper}'),
          _StatRow('Uncalibrated scanners', '${stats.uncalibratedScanners}'),
          _StatRow('Synced today', '${stats.syncedToday}'),
          const SizedBox(height: 16),
          Text(
            'Supported devices',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip(
            'Kitchen display screens',
            supportedDevices.kitchenDisplayScreens,
          ),
          _FeatureChip('Tablets', supportedDevices.tablets),
          _FeatureChip('Thermal printers', supportedDevices.thermalPrinters),
          _FeatureChip('Smartwatches', supportedDevices.smartwatches),
          _FeatureChip('NFC devices', supportedDevices.nfcDevices),
          _FeatureChip('Barcode scanners', supportedDevices.barcodeScanners),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onSyncAll,
              icon: const Icon(Icons.sync_outlined, size: 18),
              label: const Text('Sync all hardware'),
            ),
          ),
        ],
      ),
    );
  }
}

Color _connectionColor(String status) {
  return switch (status) {
    'connected' => AppColors.primary,
    'offline' => AppColors.danger,
    _ => AppColors.secondaryText,
  };
}

class _HardwareDeviceList extends StatelessWidget {
  const _HardwareDeviceList({
    required this.emptyMessage,
    required this.items,
  });

  final String emptyMessage;
  final List<Widget> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return _EmptyBox(message: emptyMessage);
    }

    return Column(children: items);
  }
}

class _HardwareDeviceCard extends StatelessWidget {
  const _HardwareDeviceCard({
    required this.title,
    required this.subtitle,
    required this.statusLabel,
    required this.statusColor,
    required this.actions,
    required this.primaryActions,
    required this.onAction,
  });

  final String title;
  final String subtitle;
  final String statusLabel;
  final Color statusColor;
  final List<String> actions;
  final Set<String> primaryActions;
  final ValueChanged<String> onAction;

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
              _Tag(label: statusLabel, color: statusColor),
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
      'restart_display' => 'Restart',
      'sync_content' => 'Sync KDS',
      'test_signal' => 'Test signal',
      'pair_tablet' => 'Pair',
      'restart_tablet' => 'Restart',
      'lock_tablet' => 'Lock',
      'test_print' => 'Test print',
      'clear_queue' => 'Clear queue',
      'replace_paper' => 'Replace paper',
      'pair_watch' => 'Pair',
      'push_alert_test' => 'Test alert',
      'disconnect_watch' => 'Disconnect',
      'test_tap' => 'Test tap',
      'sync_credentials' => 'Sync creds',
      'disable_nfc' => 'Disable',
      'calibrate_scanner' => 'Calibrate',
      'test_scan' => 'Test scan',
      'restart_scanner' => 'Restart',
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
