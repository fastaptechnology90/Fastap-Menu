import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';

class PanelCard extends StatelessWidget {
  const PanelCard({
    super.key,
    required this.title,
    required this.icon,
    required this.child,
    this.trailing,
    this.compact = false,
    this.expandChild = true,
  });

  final String title;
  final IconData icon;
  final Widget child;
  final Widget? trailing;
  final bool compact;
  final bool expandChild;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(compact ? 14 : 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.panelBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(10),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: expandChild ? MainAxisSize.max : MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 8),
                Flexible(
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: trailing!,
                  ),
                ),
              ],
            ],
          ),
          SizedBox(height: compact ? 10 : 14),
          if (expandChild) Expanded(child: child) else child,
        ],
      ),
    );
  }
}
