import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';

/// The bar that says "orders are waiting and nobody has said they heard".
///
/// It sits above every tab, not just the KDS, because the alarm can start
/// while the chef is looking at Prep or the waiter at Home. Acknowledging is
/// the only thing that stops the sound, so the target is deliberately large
/// enough for a gloved hand.
class KitchenAlarmBanner extends StatelessWidget {
  const KitchenAlarmBanner({
    super.key,
    required this.controller,
    this.margin = const EdgeInsets.fromLTRB(20, 12, 20, 0),
  });

  final KitchenCommandController controller;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller.alarm,
      builder: (context, _) {
        final alarm = controller.alarm;
        if (!alarm.isRinging) {
          return const SizedBox.shrink();
        }

        final count = alarm.pendingCount;
        final escalated = alarm.escalationStage > 1;

        return Padding(
          padding: margin,
          child: Material(
            color: AppColors.danger,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: alarm.acknowledge,
              borderRadius: BorderRadius.circular(14),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.notifications_active_rounded,
                      color: Colors.white,
                      size: 30,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            count == 1
                                ? '1 new order'
                                : '$count new orders',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 22,
                              height: 1.1,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            escalated
                                ? 'Still waiting — tap to silence'
                                : 'Tap to silence',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w500,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      constraints: const BoxConstraints(minHeight: 48),
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'Heard it',
                        style: TextStyle(
                          color: AppColors.danger,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
