import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';

class SectionFilter extends StatelessWidget {
  const SectionFilter({
    super.key,
    required this.sections,
    required this.selected,
    required this.onChanged,
  });

  final List<String> sections;
  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Section filter',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: AppColors.secondaryText,
            letterSpacing: 0.4,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: sections.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
            itemBuilder: (context, index) {
              final section = sections[index];
              final active = section == selected;

              return Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => onChanged(section),
                  borderRadius: BorderRadius.circular(20),
                  child: Ink(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      gradient: active
                          ? LinearGradient(
                              colors: [
                                AppColors.primary.withValues(alpha: 0.16),
                                AppColors.primary.withValues(alpha: 0.06),
                              ],
                            )
                          : null,
                      color: active ? null : AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: active
                            ? AppColors.primary.withValues(alpha: 0.35)
                            : AppColors.panelBorder,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          active
                              ? Icons.check_circle_rounded
                              : Icons.kitchen_outlined,
                          size: 16,
                          color: active
                              ? AppColors.primary
                              : AppColors.secondaryText,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          section,
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                            color: active
                                ? AppColors.primary
                                : AppColors.bodyText,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
