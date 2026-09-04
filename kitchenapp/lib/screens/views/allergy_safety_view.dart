import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/safety/allergy_safety_snapshot.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/safety/safety_case_card.dart';

class AllergySafetyView extends StatelessWidget {
  const AllergySafetyView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.safetyLoading && controller.allergySafety == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.allergySafety;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.safetyErrorMessage ?? 'Safety board unavailable',
        onRetry: () => controller.refreshSafety(),
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
                    'System 9 · Food Allergy & Safety Engine',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Allergy color coding · chef confirm · cross-contamination alerts',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.safetyLoading
                    ? null
                    : () => controller.refreshSafety(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.safetyActionMessage != null) ...[
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
              controller.safetyActionMessage!,
              style: TextStyle(
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
            final cases = _CasesPanel(
              snapshot: snapshot,
              onAction: (caseId, action) {
                controller.performSafetyAction(caseId: caseId, action: action);
              },
            );
            final board = SafetyBoardPanel(
              stats: snapshot.stats,
              safetyFeatures: snapshot.safetyFeatures,
              allergyTypes: snapshot.allergyTypes,
            );

            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: cases),
                  const SizedBox(width: 16),
                  Expanded(flex: 2, child: board),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                cases,
                const SizedBox(height: 16),
                board,
              ],
            );
          },
        ),
      ],
    );
  }
}

class _CasesPanel extends StatelessWidget {
  const _CasesPanel({required this.snapshot, required this.onAction});

  final AllergySafetySnapshot snapshot;
  final void Function(String caseId, String action) onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Active safety cases · ${snapshot.cases.length}',
          style: TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 12),
        if (snapshot.cases.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: Text(
              'No allergy or safety cases for this section filter.',
              style: TextStyle(color: AppColors.secondaryText),
            ),
          )
        else
          ...snapshot.cases.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: SafetyCaseCard(
                safetyCase: item,
                onAction: (action) => onAction(item.id, action),
              ),
            ),
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
