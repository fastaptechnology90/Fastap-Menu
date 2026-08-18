import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/hardware_integration/hardware_integration_widgets.dart';

class HardwareIntegrationView extends StatelessWidget {
  const HardwareIntegrationView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.hardwareIntegrationLoading &&
        controller.hardwareIntegration == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.hardwareIntegration;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.hardwareIntegrationErrorMessage ??
            'Hardware integration unavailable',
        onRetry: () => controller.refreshHardwareIntegration(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.panelBorder),
          ),
          child: Wrap(
            spacing: 12,
            runSpacing: 10,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'System 41 · Hardware Integration System',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Displays · tablets · printers · watches · NFC · scanners',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.hardwareIntegrationLoading
                    ? null
                    : () => controller.refreshHardwareIntegration(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.hardwareIntegrationActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.hardwareIntegrationActionMessage!,
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 960;
            final main = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionTitle('Kitchen display screens'),
                KitchenDisplayList(
                  displays: snapshot.displayScreens,
                  onAction: (entry) => controller.performDisplayAction(
                    displayId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Tablets'),
                KitchenTabletList(
                  tablets: snapshot.tablets,
                  onAction: (entry) => controller.performTabletAction(
                    tabletId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Thermal printers'),
                ThermalPrinterList(
                  printers: snapshot.thermalPrinters,
                  onAction: (entry) => controller.performPrinterAction(
                    printerId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Smartwatches'),
                IntegratedSmartwatchList(
                  smartwatches: snapshot.smartwatches,
                  onAction: (entry) => controller.performSmartwatchAction(
                    watchId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('NFC devices'),
                NfcDeviceList(
                  devices: snapshot.nfcDevices,
                  onAction: (entry) => controller.performNfcAction(
                    nfcId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Barcode scanners'),
                BarcodeScannerList(
                  scanners: snapshot.barcodeScanners,
                  onAction: (entry) => controller.performScannerAction(
                    scannerId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
              ],
            );
            final side = HardwareIntegrationSidePanel(
              stats: snapshot.stats,
              supportedDevices: snapshot.supportedDevices,
              onSyncAll: controller.syncAllHardwareIntegration,
              processing: controller.hardwareIntegrationLoading,
            );

            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: main),
                  const SizedBox(width: 16),
                  Expanded(flex: 2, child: side),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                main,
                const SizedBox(height: 16),
                side,
              ],
            );
          },
        ),
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 12),
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.primaryText,
          fontWeight: FontWeight.w800,
          fontSize: 16,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, style: const TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
