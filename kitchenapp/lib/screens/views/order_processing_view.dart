import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/processing/processing_snapshot.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/processing/order_processing_system_capabilities.dart';
import '../../widgets/processing/processing_order_card.dart';

class OrderProcessingView extends StatelessWidget {
  const OrderProcessingView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.processingLoading && controller.processing == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.processing;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.processingErrorMessage ?? 'Processing unavailable',
        onRetry: () => controller.refreshProcessing(),
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
                    'System 5 · Advanced Order Processing',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Hold · reassign · modify · batch cooking · AI queue',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.processingLoading
                    ? null
                    : () => controller.refreshProcessing(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.processingActionMessage != null) ...[
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
              controller.processingActionMessage!,
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        const OrderProcessingSystemCapabilitiesExpandable(),
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 960;
            final queue = _QueuePanel(
              snapshot: snapshot,
              onAction: (order, action) => _handleAction(context, order, action),
            );
            final smart = ProcessingSmartPanel(
              flags: snapshot.smartProcessing,
              stats: snapshot.stats,
              batchCooking: snapshot.batchCooking,
              cookingSequence: snapshot.cookingSequence,
              onOptimize: () => controller.optimizeProcessingQueue(),
              optimizing: controller.processingLoading,
            );

            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: queue),
                  const SizedBox(width: 16),
                  Expanded(flex: 2, child: smart),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                queue,
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
    ProcessingOrder order,
    String action,
  ) async {
    final orderId = order.base.id;
    if (orderId == null) {
      return;
    }

    if (action == 'reassign') {
      final section = await _pickSection(context);
      if (!context.mounted || section == null) {
        return;
      }
      await controller.performProcessingAction(
        orderId: orderId,
        action: action,
        targetSection: section,
      );
      return;
    }

    if (action == 'cancel_item' || action == 'modify_item') {
      final itemName = await _pickLineItem(context, order);
      if (!context.mounted || itemName == null) {
        return;
      }
      String? modification;
      if (action == 'modify_item') {
        modification = await _promptModification(context, itemName);
        if (!context.mounted ||
            modification == null ||
            modification.isEmpty) {
          return;
        }
      }
      await controller.performProcessingAction(
        orderId: orderId,
        action: action,
        itemName: itemName,
        modification: modification,
      );
      return;
    }

    await controller.performProcessingAction(orderId: orderId, action: action);
  }

  Future<String?> _pickSection(BuildContext context) async {
    return showDialog<String>(
      context: context,
      builder: (context) {
        final sections = controller.sections.where((s) => s != 'All').toList();
        return SimpleDialog(
          title: const Text('Reassign to section'),
          children: sections
              .map(
                (section) => SimpleDialogOption(
                  onPressed: () => Navigator.pop(context, section),
                  child: Text(section),
                ),
              )
              .toList(),
        );
      },
    );
  }

  Future<String?> _pickLineItem(BuildContext context, ProcessingOrder order) async {
    final items = order.lineItems
        .where((item) => item.modifiable)
        .map((item) => item.name)
        .toList();
    if (items.isEmpty) {
      return null;
    }
    if (items.length == 1) {
      return items.first;
    }
    return showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Select line item'),
        children: items
            .map(
              (name) => SimpleDialogOption(
                onPressed: () => Navigator.pop(context, name),
                child: Text(name),
              ),
            )
            .toList(),
      ),
    );
  }

  Future<String?> _promptModification(
    BuildContext context,
    String itemName,
  ) async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Modify $itemName'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'e.g. Extra spicy, no garlic',
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }
}

class _QueuePanel extends StatelessWidget {
  const _QueuePanel({
    required this.snapshot,
    required this.onAction,
  });

  final ProcessingSnapshot snapshot;
  final void Function(ProcessingOrder order, String action) onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Processing queue · ${snapshot.orders.length} KOTs',
          style: const TextStyle(
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
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: const Text(
              'No orders in the processing queue for this section.',
              style: TextStyle(color: AppColors.secondaryText),
            ),
          )
        else
          ...snapshot.orders.map(
            (order) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ProcessingOrderCard(
                order: order,
                onAction: (action) => onAction(order, action),
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
          Text(message, style: const TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
