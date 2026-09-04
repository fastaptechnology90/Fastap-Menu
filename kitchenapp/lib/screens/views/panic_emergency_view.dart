import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/panic_emergency/panic_emergency_widgets.dart';

class PanicEmergencyView extends StatelessWidget {
  const PanicEmergencyView({
    super.key,
    required this.controller,
    this.embedded = false,
  });

  final KitchenCommandController controller;
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    if (controller.panicEmergencyLoading && controller.panicEmergency == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.panicEmergency;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.panicEmergencyErrorMessage ??
            'Panic & emergency system unavailable',
        onRetry: () => controller.refreshPanicEmergency(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!embedded)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: Wrap(
              spacing: 12,
              runSpacing: 10,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'System 37 · Panic & Emergency System',
                      style: TextStyle(
                        color: AppColors.primaryText,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Panic button · broadcasts · evacuation · escalation',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                OutlinedButton.icon(
                  onPressed: controller.panicEmergencyLoading
                      ? null
                      : () => controller.refreshPanicEmergency(),
                  icon: const Icon(Icons.refresh, size: 18),
                  label: const Text('Refresh'),
                ),
              ],
            ),
          ),
        if (controller.panicEmergencyActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.panicEmergencyActionMessage!,
              style: TextStyle(
                color: AppColors.danger,
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
                PanicButtonPanel(
                  onTrigger: (type) => controller.triggerPanicButton(
                    emergencyType: type,
                  ),
                  processing: controller.panicEmergencyLoading,
                ),
                const SizedBox(height: 16),
                Text(
                  'Active incidents',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ...snapshot.incidents.map(
                  (incident) => EmergencyIncidentCard(
                    incident: incident,
                    onAction: (action) =>
                        controller.performPanicIncidentAction(
                      incidentId: incident.id,
                      action: action,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Evacuation alerts',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                EvacuationAlertList(
                  alerts: snapshot.evacuationAlerts,
                  onAction: (entry) => controller.performEvacuationAction(
                    evacuationId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Emergency broadcast log',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                EmergencyBroadcastList(broadcasts: snapshot.broadcastLog),
              ],
            );
            final side = PanicEmergencySidePanel(
              stats: snapshot.stats,
              flags: snapshot.emergencyFeatures,
              onSyncAll: controller.syncAllPanicEmergency,
              processing: controller.panicEmergencyLoading,
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
          Text(message, style: TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
