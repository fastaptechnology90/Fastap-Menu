import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/cloud_kitchen/cloud_kitchen_widgets.dart';

class CloudKitchenView extends StatelessWidget {
  const CloudKitchenView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.cloudKitchenLoading && controller.cloudKitchen == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.cloudKitchen;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.cloudKitchenErrorMessage ??
            'Cloud kitchen system unavailable',
        onRetry: () => controller.refreshCloudKitchen(),
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
                    'System 26 · Cloud Kitchen Management',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Multi-brand · segregation · delivery · load · inventory',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.cloudKitchenLoading
                    ? null
                    : () => controller.refreshCloudKitchen(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.cloudKitchenActionMessage != null) ...[
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
              controller.cloudKitchenActionMessage!,
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
                const Text(
                  'Brand-wise segregation',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ...snapshot.brandLanes.map(
                  (lane) => BrandLaneCard(lane: lane),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Multi-brand order management',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                if (snapshot.brandOrders.isEmpty)
                  const _EmptyBox(message: 'No brand orders in queue')
                else
                  ...snapshot.brandOrders.map(
                    (order) => BrandOrderCard(
                      order: order,
                      onAction: (action) => controller.performCloudKitchenAction(
                        orderId: order.orderId,
                        action: action,
                        brandId: order.brandId,
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                const Text(
                  'Delivery order handling',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                DeliveryQueueList(entries: snapshot.deliveryQueue),
                const SizedBox(height: 8),
                const Text(
                  'Kitchen load balancing',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                LoadBalanceList(slots: snapshot.loadBalance),
                const SizedBox(height: 8),
                const Text(
                  'Shared inventory visibility',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                SharedInventoryList(items: snapshot.sharedInventory),
              ],
            );
            final side = CloudKitchenSidePanel(
              stats: snapshot.stats,
              flags: snapshot.cloudKitchenFeatures,
              onBalanceLoad: controller.balanceCloudKitchenLoad,
              processing: controller.cloudKitchenLoading,
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
          Text(message, style: const TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: AppColors.secondaryText,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
