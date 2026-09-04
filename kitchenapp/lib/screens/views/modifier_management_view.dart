import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/modifiers/modifier_snapshot.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/modifiers/modifier_order_card.dart';

class ModifierManagementView extends StatelessWidget {
  const ModifierManagementView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.modifierLoading && controller.modifierBoard == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.modifierBoard;
    if (snapshot == null) {
      return _EmptyState(
        message:
            controller.modifierErrorMessage ?? 'Modifier board unavailable',
        onRetry: () => controller.refreshModifiers(),
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
                    'System 8 · Modifier & Customization Management',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Allergy alerts · chef confirm · acknowledgment tracking',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.modifierLoading
                    ? null
                    : () => controller.refreshModifiers(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.modifierActionMessage != null) ...[
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
              controller.modifierActionMessage!,
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
            final orders = _OrdersPanel(
              snapshot: snapshot,
              onAction: (orderId, action) =>
                  _handleAction(context, orderId, action, snapshot),
            );
            final smart = ModifierSmartPanel(
              stats: snapshot.stats,
              smartAlerts: snapshot.smartAlerts,
              catalog: snapshot.catalog,
            );

            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: orders),
                  const SizedBox(width: 16),
                  Expanded(flex: 2, child: smart),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                orders,
                const SizedBox(height: 16),
                smart,
              ],
            );
          },
        ),
      ],
    );
  }

  Future<void> _handleAction(
    BuildContext context,
    String orderId,
    String action,
    ModifierSnapshot snapshot,
  ) async {
    if (action == 'apply_modifier') {
      final type = await _pickModifierType(context, snapshot.catalog);
      if (!context.mounted || type == null) {
        return;
      }
      await controller.performModifierAction(
        orderId: orderId,
        action: action,
        modifierType: type,
      );
      return;
    }

    if (action == 'replace_side') {
      final order = snapshot.orders.firstWhere((item) => item.orderId == orderId);
      final itemName = await _pickItem(context, order.items);
      if (!context.mounted || itemName == null) {
        return;
      }
      final replacement = await _promptReplacement(context, itemName);
      if (!context.mounted || replacement == null || replacement.isEmpty) {
        return;
      }
      await controller.performModifierAction(
        orderId: orderId,
        action: action,
        itemName: itemName,
        replacement: replacement,
      );
      return;
    }

    await controller.performModifierAction(orderId: orderId, action: action);
  }

  Future<String?> _pickModifierType(
    BuildContext context,
    List<ModifierCatalogItem> catalog,
  ) {
    return showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Apply modifier'),
        children: catalog
            .map(
              (item) => SimpleDialogOption(
                onPressed: () => Navigator.pop(context, _typeForLabel(item.label)),
                child: Text(item.label),
              ),
            )
            .toList(),
      ),
    );
  }

  Future<String?> _pickItem(BuildContext context, List<String> items) {
    if (items.length == 1) {
      return Future.value(items.first);
    }
    return showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Select item'),
        children: items
            .map(
              (item) => SimpleDialogOption(
                onPressed: () => Navigator.pop(context, item),
                child: Text(item),
              ),
            )
            .toList(),
      ),
    );
  }

  Future<String?> _promptReplacement(BuildContext context, String itemName) async {
    final field = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Replace side · $itemName'),
        content: TextField(
          controller: field,
          decoration: const InputDecoration(hintText: 'Replacement item'),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, field.text.trim()),
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }

  static String _typeForLabel(String label) {
    return switch (label) {
      'Extra spicy' => 'extra_spicy',
      'No onion' => 'no_onion',
      'No garlic' => 'no_garlic',
      'Jain preparation' => 'jain_preparation',
      'Allergy modifiers' => 'allergy_modifiers',
      'Extra cheese' => 'extra_cheese',
      'Half-half customization' => 'half_half',
      'Side replacement' => 'side_replacement',
      _ => label.toLowerCase().replaceAll(' ', '_'),
    };
  }
}

class _OrdersPanel extends StatelessWidget {
  const _OrdersPanel({required this.snapshot, required this.onAction});

  final ModifierSnapshot snapshot;
  final void Function(String orderId, String action) onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Modifier queue · ${snapshot.orders.length} KOTs',
          style: TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 12),
        if (snapshot.orders.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: Text(
              'No orders with modifiers for this section filter.',
              style: TextStyle(color: AppColors.secondaryText),
            ),
          )
        else
          ...snapshot.orders.map(
            (order) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ModifierOrderCard(
                order: order,
                onAction: (action) => onAction(order.orderId, action),
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
