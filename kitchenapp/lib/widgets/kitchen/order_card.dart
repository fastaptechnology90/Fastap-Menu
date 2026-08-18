import 'package:flutter/material.dart';

import '../../models/kitchen_order.dart';
import '../common/mini_chip.dart';
import '../common/panel_card.dart';
import '../common/status_pill.dart';

class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order, this.onReady});

  final KitchenOrder order;
  final VoidCallback? onReady;

  @override
  Widget build(BuildContext context) {
    final previewItems = order.items.take(4).toList();
    final remaining = order.items.length - previewItems.length;

    return PanelCard(
      title: order.title,
      icon: order.icon,
      expandChild: false,
      trailing: StatusPill(
        icon: order.priorityIcon,
        label: order.status,
        color: order.color,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              MiniChip(order.section),
              MiniChip(order.location),
              if (order.vip) const MiniChip('VIP'),
              if (order.allergy) const MiniChip('Allergy'),
            ],
          ),
          const SizedBox(height: 12),
          ...previewItems.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                item,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xff25312d),
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ),
          if (remaining > 0)
            Text(
              '+ $remaining more item${remaining == 1 ? '' : 's'}',
              style: const TextStyle(
                color: Color(0xff5a6762),
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: order.progress.clamp(0.0, 1.0),
              color: order.color,
              backgroundColor: order.color.withValues(alpha: 0.12),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.timer_outlined, size: 18, color: order.color),
              const SizedBox(width: 6),
              Text(
                order.timer,
                style: TextStyle(
                  color: order.color,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              FilledButton.tonalIcon(
                onPressed: onReady,
                icon: const Icon(Icons.check_circle_outline, size: 18),
                label: const Text('Ready'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
