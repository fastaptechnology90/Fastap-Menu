import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/auth/login_method.dart';

class LoginMethodSelector extends StatelessWidget {
  const LoginMethodSelector({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final LoginMethod selected;
  final ValueChanged<LoginMethod> onSelected;

  static const displayOrder = [
    LoginMethod.password,
    LoginMethod.pin,
    LoginMethod.otp,
    LoginMethod.qr,
    LoginMethod.nfc,
    LoginMethod.face,
    LoginMethod.fingerprint,
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: displayOrder.map((method) {
          final isSelected = method == selected;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              selected: isSelected,
              showCheckmark: false,
              avatar: Icon(
                method.icon,
                size: 16,
                color: isSelected ? Colors.white : AppColors.primary,
              ),
              label: Text(method.label),
              labelStyle: TextStyle(
                fontWeight: FontWeight.w700,
                color: isSelected ? Colors.white : AppColors.bodyText,
              ),
              selectedColor: AppColors.primary,
              backgroundColor: Colors.white,
              side: BorderSide(
                color: isSelected ? AppColors.primary : AppColors.panelBorder,
              ),
              onSelected: (_) => onSelected(method),
            ),
          );
        }).toList(),
      ),
    );
  }
}
