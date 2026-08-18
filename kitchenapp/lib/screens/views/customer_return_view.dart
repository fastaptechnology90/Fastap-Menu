import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/returns/customer_return_snapshot.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/returns/customer_return_widgets.dart';

class CustomerReturnView extends StatelessWidget {
  const CustomerReturnView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.customerReturnLoading && controller.customerReturn == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.customerReturn;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.customerReturnErrorMessage ??
            'Customer return system unavailable',
        onRetry: () => controller.refreshCustomerReturn(),
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
                    'System 20 · Customer Return & Re-fire System',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Wrong item · burnt item · re-fire · priority remake · tags',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.customerReturnLoading
                    ? null
                    : () => controller.refreshCustomerReturn(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.customerReturnActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.warning.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.customerReturnActionMessage!,
              style: const TextStyle(
                color: AppColors.warning,
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
                  'Open return requests',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                if (snapshot.returnRequests.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.panelBorder),
                    ),
                    child: const Text(
                      'No open return requests for this section',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )
                else
                  ...snapshot.returnRequests.map(
                    (request) => ReturnRequestCard(
                      request: request,
                      onAction: (action) => _handleAction(controller, request, action),
                    ),
                  ),
                const SizedBox(height: 8),
                const Text(
                  'Complaint tags',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ComplaintTagList(tags: snapshot.complaintTags),
                const SizedBox(height: 8),
                const Text(
                  'Return history',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ReturnHistoryList(history: snapshot.history),
              ],
            );
            final side = ReturnSidePanel(
              stats: snapshot.stats,
              flags: snapshot.returnFeatures,
              processing: controller.customerReturnLoading,
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
    ReturnRequest request,
    String action,
  ) {
    if (action == 'tag_complaint') {
      controller.performCustomerReturnAction(
        returnId: request.id,
        action: action,
        tag: request.reason,
        severity: 'medium',
      );
      return;
    }

    controller.performCustomerReturnAction(
      returnId: request.id,
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
          Text(message, style: const TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
