import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/audit_compliance/audit_compliance_widgets.dart';

class AuditComplianceView extends StatelessWidget {
  const AuditComplianceView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.auditComplianceLoading &&
        controller.auditCompliance == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.auditCompliance;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.auditComplianceErrorMessage ??
            'Audit & compliance unavailable',
        onRetry: () => controller.refreshAuditCompliance(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
                    'System 44 · Audit & Compliance System',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Actions · food safety · hygiene · staff · incidents',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.auditComplianceLoading
                    ? null
                    : () => controller.refreshAuditCompliance(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.auditComplianceActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.auditComplianceActionMessage!,
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
                const _SectionTitle('Action logs'),
                AuditActionLogList(
                  logs: snapshot.actionLogs,
                  onAction: (entry) => controller.performAuditActionLogAction(
                    logId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Food safety logs'),
                FoodSafetyLogList(
                  logs: snapshot.foodSafetyLogs,
                  onAction: (entry) => controller.performFoodSafetyLogAction(
                    logId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Hygiene logs'),
                HygieneLogList(
                  logs: snapshot.hygieneLogs,
                  onAction: (entry) => controller.performHygieneLogAction(
                    logId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Staff activity logs'),
                StaffActivityLogList(
                  logs: snapshot.staffActivityLogs,
                  onAction: (entry) => controller.performStaffActivityLogAction(
                    logId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Incident logs'),
                IncidentLogList(
                  incidents: snapshot.incidentLogs,
                  onAction: (entry) => controller.performIncidentLogAction(
                    incidentId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
              ],
            );
            final side = AuditComplianceSidePanel(
              stats: snapshot.stats,
              features: snapshot.auditFeatures,
              onExportAll: controller.exportAllAuditCompliance,
              processing: controller.auditComplianceLoading,
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
        style: TextStyle(
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
          Text(message, style: TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
