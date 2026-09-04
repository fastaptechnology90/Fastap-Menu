import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import '../../models/kitchen_order.dart';

class CompactOrderTile extends StatelessWidget {
  const CompactOrderTile({
    super.key,
    required this.order,
    this.onAction,
    this.deliveryMode = false,
  });

  final KitchenOrder order;
  // Runs a kitchen action (accept / prepare / ready / cancel …) for this order.
  // When provided, the detail sheet shows the matching action buttons.
  final Future<void> Function(String orderId, String action)? onAction;
  // Waiter app: show delivery actions (Start Delivery / Delivered) in place of
  // the kitchen actions.
  final bool deliveryMode;

  // Waiter-facing status label for the delivery flow; plain kitchen label otherwise.
  String get statusText => deliveryMode
      ? switch (order.rawStatus) {
          'ready' => 'Ready to pick up',
          'serving' => 'On the way',
          'served' => 'Delivered',
          _ => order.status,
        }
      : order.status;

  // Which actions to offer for the order's current machine status.
  static List<(String, String, IconData)> _actionsForStatus(
    String s,
    bool deliveryMode,
  ) {
    if (deliveryMode) {
      return switch (s) {
        'ready' => [('Start Delivery', 'serve', Icons.delivery_dining)],
        'serving' => [('Delivered', 'deliver', Icons.check_circle)],
        _ => const [],
      };
    }
    switch (s) {
      case 'new':
        return [('Accept', 'accept', Icons.check), ('Reject', 'reject', Icons.close), ('Cancel', 'cancel', Icons.block)];
      case 'accepted':
      case 'confirmed':
        return [('Start', 'prepare', Icons.play_arrow), ('Delay', 'delay', Icons.schedule), ('Cancel', 'cancel', Icons.block)];
      case 'preparing':
      case 'delayed':
        return [('Ready', 'ready', Icons.task_alt), ('Delay', 'delay', Icons.schedule), ('Re-fire', 'refire', Icons.replay)];
      case 'ready':
        return [('Re-fire', 'refire', Icons.replay)];
      default:
        return const [];
    }
  }

  static String _actionPast(String action) => switch (action) {
        'accept' => 'accepted',
        'reject' => 'rejected',
        'cancel' => 'cancelled',
        'prepare' => 'started',
        'ready' => 'marked ready',
        'delay' => 'delayed',
        'refire' => 're-fired',
        'serve' => 'out for delivery',
        'deliver' => 'delivered',
        _ => 'updated',
      };

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        onTap: () => _showDetail(context),
        child: Ink(
          decoration: BoxDecoration(
            // Subtle status-tinted card so the queue reads at a glance and feels
            // less flat/white.
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color.alphaBlend(order.color.withValues(alpha: 0.06), AppColors.surface),
                AppColors.surface,
              ],
            ),
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            border: Border.all(color: order.color.withValues(alpha: 0.18)),
            boxShadow: [
              BoxShadow(
                color: order.color.withValues(alpha: 0.12),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 4,
                height: 72,
                decoration: BoxDecoration(
                  color: order.color,
                  borderRadius: const BorderRadius.horizontal(
                    left: Radius.circular(AppSpacing.radiusLg),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.lg,
                    AppSpacing.md,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              order.color.withValues(alpha: 0.2),
                              order.color.withValues(alpha: 0.06),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(order.icon, color: order.color, size: 22),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    order.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.primaryText,
                                    ),
                                  ),
                                ),
                                if (order.vip) _Badge('VIP', AppColors.premium),
                                if (order.allergy)
                                  _Badge('Allergy', AppColors.warning),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${order.section} · ${order.location}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.secondaryText,
                              ),
                            ),
                            if (order.items.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                order.items.take(3).join(' · '),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.primaryText,
                                ),
                              ),
                            ],
                            const SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: order.progress.clamp(0.0, 1.0),
                                minHeight: 4,
                                backgroundColor:
                                    order.color.withValues(alpha: 0.12),
                                color: order.color,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: order.color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              order.timer,
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                color: order.color,
                                fontSize: 12,
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            statusText,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: AppColors.secondaryText,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    final messenger = ScaffoldMessenger.of(context);
    final actions = onAction == null ? const <(String, String, IconData)>[] : _actionsForStatus(order.rawStatus, deliveryMode);
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      // Tall orders (many modifiers) pushed the action buttons off-screen with
      // no way to reach them. Make the sheet scrollable and cap its height.
      isScrollControlled: true,
      builder: (context) => ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              0,
              AppSpacing.lg,
              AppSpacing.xl,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(order.icon, color: order.color),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    order.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: order.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(
                      color: order.color,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '${order.section} · ${order.location} · ${order.timer}',
              style: TextStyle(
                color: AppColors.secondaryText,
                fontSize: 13,
              ),
            ),
            const Divider(height: 24),
            const Text('Items', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            if (order.items.isEmpty)
              Text(
                'No items listed',
                style: TextStyle(color: AppColors.secondaryText),
              )
            else
              ...order.items.map(
                (item) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Icon(
                        Icons.circle,
                        size: 6,
                        color: AppColors.secondaryText,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          item,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (order.addOns.isNotEmpty) ...[
              const SizedBox(height: 14),
              const Text('Add-ons', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              ...order.addOns.map(
                (line) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Icon(Icons.add_circle_outline,
                          size: 14, color: AppColors.secondaryText),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(line,
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            if (order.modifiers.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text('Modifiers / Removals',
                  style: TextStyle(
                      fontWeight: FontWeight.w800, color: AppColors.primary)),
              const SizedBox(height: 6),
              ...order.modifiers.map(
                (line) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Icon(Icons.remove_circle_outline,
                          size: 14, color: AppColors.primary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(line,
                            style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: AppColors.primary)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            if (order.cookingNotes.isNotEmpty) ...[
              const SizedBox(height: 14),
              const Text('Notes', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              ...order.cookingNotes.map(
                (line) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Icon(Icons.sticky_note_2_outlined,
                          size: 14, color: AppColors.secondaryText),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(line,
                            style:
                                const TextStyle(fontStyle: FontStyle.italic)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            if (deliveryMode && onAction != null) ...[
              const SizedBox(height: 16),
              if (order.paymentStatus == 'paid') ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF059669).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF059669).withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: Color(0xFF059669), size: 18),
                      const SizedBox(width: 8),
                      Text(
                        'Paid · ₹${order.total.toStringAsFixed(0)}',
                        style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF059669)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                _outlinedAction(context, messenger, Icons.table_restaurant_outlined,
                    'Clear Table', 'clear_table', 'Table cleared for the next guest'),
              ] else ...[
                // Once the waiter has asked the guest to pay, don't offer the
                // button again — show an "Already requested" state instead.
                if (order.billRequested)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.hourglass_top, color: AppColors.primary, size: 18),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Already requested for payment',
                            style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  _outlinedAction(context, messenger, Icons.receipt_long_outlined,
                      'Request Payment from Guest', 'request_payment', 'Payment requested from the guest'),
                const SizedBox(height: 12),
                Text(
                  'Payment received · ₹${order.total.toStringAsFixed(0)} — how did the guest pay?',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                ),
                const SizedBox(height: 8),
                Builder(builder: (context) {
                  // Fit three method chips per row inside the sheet's padding.
                  final chipW = (MediaQuery.of(context).size.width - AppSpacing.lg * 2 - 16) / 3;
                  return Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _payButton(context, messenger, 'Cash', 'collect_cash', chipW),
                      _payButton(context, messenger, 'UPI', 'collect_upi', chipW),
                      _payButton(context, messenger, 'Card', 'collect_card', chipW),
                      _payButton(context, messenger, 'Wallet', 'collect_wallet', chipW),
                      _payButton(context, messenger, 'NFC', 'collect_nfc', chipW),
                    ],
                  );
                }),
              ],
            ],
            if (actions.isNotEmpty) ...[
              const SizedBox(height: 18),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: actions.map((a) {
                  final danger = a.$2 == 'reject' || a.$2 == 'cancel';
                  final color = danger ? AppColors.danger : AppColors.primary;
                  return FilledButton.tonalIcon(
                    onPressed: () async {
                      Navigator.of(context).pop();
                      try {
                        await onAction!(order.id ?? '', a.$2);
                        messenger
                          ..hideCurrentSnackBar()
                          ..showSnackBar(SnackBar(
                            content: Text('Order ${_actionPast(a.$2)}'),
                            duration: const Duration(milliseconds: 1600),
                            behavior: SnackBarBehavior.floating,
                          ));
                      } catch (_) {
                        messenger
                          ..hideCurrentSnackBar()
                          ..showSnackBar(SnackBar(
                            content: const Text('Could not update the order. Check connection and try again.'),
                            backgroundColor: AppColors.danger,
                            behavior: SnackBarBehavior.floating,
                          ));
                      }
                    },
                    icon: Icon(a.$3, size: 16, color: color),
                    label: Text(a.$1, style: TextStyle(color: color, fontWeight: FontWeight.w800)),
                    style: FilledButton.styleFrom(
                      backgroundColor: color.withValues(alpha: 0.1),
                      foregroundColor: color,
                    ),
                  );
                }).toList(),
              ),
            ],
          ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _payButton(
    BuildContext context,
    ScaffoldMessengerState messenger,
    String label,
    String action,
    double width,
  ) {
    return SizedBox(
      width: width,
      child: FilledButton(
        onPressed: () async {
          Navigator.of(context).pop();
          try {
            await onAction!(order.id ?? '', action);
            messenger
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(
                content: Text('Payment received · $label · ₹${order.total.toStringAsFixed(0)}'),
                behavior: SnackBarBehavior.floating,
                duration: const Duration(milliseconds: 1600),
              ));
          } catch (_) {
            messenger
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(
                content: Text('Could not mark paid. Check connection and try again.'),
                backgroundColor: AppColors.danger,
                behavior: SnackBarBehavior.floating,
              ));
          }
        },
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF059669),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 12),
        ),
        child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _outlinedAction(
    BuildContext context,
    ScaffoldMessengerState messenger,
    IconData icon,
    String label,
    String action,
    String done,
  ) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () async {
          Navigator.of(context).pop();
          try {
            await onAction!(order.id ?? '', action);
            messenger
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(
                content: Text(done),
                behavior: SnackBarBehavior.floating,
                duration: const Duration(milliseconds: 1600),
              ));
          } catch (_) {
            messenger
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(
                content: Text('Something went wrong. Check connection and try again.'),
                backgroundColor: AppColors.danger,
                behavior: SnackBarBehavior.floating,
              ));
          }
        },
        icon: Icon(icon, size: 18),
        label: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: BorderSide(color: AppColors.primary.withValues(alpha: 0.4)),
          padding: const EdgeInsets.symmetric(vertical: 12),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.label, this.color);

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(left: 6),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
    );
  }
}
