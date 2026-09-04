import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/future_ai_expansion/future_ai_expansion_widgets.dart';

class FutureAiExpansionView extends StatelessWidget {
  const FutureAiExpansionView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.futureAiExpansionLoading &&
        controller.futureAiExpansion == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.futureAiExpansion;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.futureAiExpansionErrorMessage ??
            'Future AI expansion unavailable',
        onRetry: () => controller.refreshFutureAiExpansion(),
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
                    'System 48 · Future AI Expansion Features',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Cooking · robotics · plating · waste · prep automation',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.futureAiExpansionLoading
                    ? null
                    : () => controller.refreshFutureAiExpansion(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.futureAiExpansionActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.premium.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border:
                  Border.all(color: AppColors.premium.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.futureAiExpansionActionMessage!,
              style: TextStyle(
                color: AppColors.premium,
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
                FutureAiExpansionSection(
                  title: 'AI cooking assistant',
                  emptyMessage: 'No cooking assistants',
                  items: snapshot.cookingAssistants
                      .map(cookingAssistantItemView)
                      .toList(),
                  onAction: controller.performFutureCookingAssistantAction,
                ),
                FutureAiExpansionSection(
                  title: 'AI robotic kitchen integration',
                  emptyMessage: 'No robotic integrations',
                  items:
                      snapshot.roboticKitchens.map(roboticKitchenItemView).toList(),
                  onAction: controller.performFutureRoboticKitchenAction,
                ),
                FutureAiExpansionSection(
                  title: 'AI plating suggestions',
                  emptyMessage: 'No plating suggestions',
                  items: snapshot.platingSuggestions
                      .map(platingSuggestionItemView)
                      .toList(),
                  onAction: controller.performFuturePlatingSuggestionAction,
                ),
                FutureAiExpansionSection(
                  title: 'AI waste reduction engine',
                  emptyMessage: 'No waste insights',
                  items:
                      snapshot.wasteReductions.map(wasteReductionItemView).toList(),
                  onAction: controller.performFutureWasteReductionAction,
                ),
                FutureAiExpansionSection(
                  title: 'AI preparation automation',
                  emptyMessage: 'No prep automations',
                  items:
                      snapshot.prepAutomations.map(prepAutomationItemView).toList(),
                  onAction: controller.performFuturePrepAutomationAction,
                ),
              ],
            );
            final side = FutureAiExpansionSidePanel(
              stats: snapshot.stats,
              features: snapshot.futureFeatures,
              onActivateAll: controller.activateAllFutureAiExpansion,
              processing: controller.futureAiExpansionLoading,
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
