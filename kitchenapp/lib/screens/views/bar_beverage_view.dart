import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/bar/bar_beverage_snapshot.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/bar/bar_beverage_widgets.dart';

class BarBeverageView extends StatelessWidget {
  const BarBeverageView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.barBeverageLoading && controller.barBeverage == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.barBeverage;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.barBeverageErrorMessage ??
            'Bar & beverage system unavailable',
        onRetry: () => controller.refreshBarBeverage(),
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
                    'System 24 · Bar & Beverage Kitchen System',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Drink queue · bartenders · customization · timers',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.barBeverageLoading
                    ? null
                    : () => controller.refreshBarBeverage(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.barBeverageActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.premium.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.premium.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.barBeverageActionMessage!,
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
                Text(
                  'Drink preparation queue',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                if (snapshot.drinkQueue.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.panelBorder),
                    ),
                    child: Text(
                      'No drinks in the bar queue',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )
                else
                  ...snapshot.drinkQueue.map(
                    (drink) => BeverageDrinkCard(
                      drink: drink,
                      onAction: (action) => _handleAction(controller, drink, action),
                    ),
                  ),
                const SizedBox(height: 8),
                Text(
                  'Bartender assignment',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                BartenderPanel(bartenders: snapshot.bartenders),
              ],
            );
            final side = BarSidePanel(
              stats: snapshot.stats,
              flags: snapshot.barFeatures,
              onBalance: controller.balanceBarQueue,
              processing: controller.barBeverageLoading,
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

  void _handleAction(
    KitchenCommandController controller,
    BeverageDrink drink,
    String action,
  ) {
    if (action == 'assign_bartender') {
      controller.performBarBeverageAction(
        drinkId: drink.id,
        action: action,
        bartenderName: 'Bar Team',
      );
      return;
    }
    if (action == 'apply_customization') {
      controller.performBarBeverageAction(
        drinkId: drink.id,
        action: action,
        customization: drink.customization,
      );
      return;
    }

    controller.performBarBeverageAction(
      drinkId: drink.id,
      action: action,
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
