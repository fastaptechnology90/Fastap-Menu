import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/constants/app_colors.dart';

class AuthTextField extends StatelessWidget {
  const AuthTextField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.prefixIcon,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.maxLength,
    this.textCapitalization = TextCapitalization.none,
    this.inputFormatters,
  });

  final String label;
  final String? hint;
  final TextEditingController controller;
  final IconData? prefixIcon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final int? maxLength;
  final TextCapitalization textCapitalization;
  final List<TextInputFormatter>? inputFormatters;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          maxLength: maxLength,
          textCapitalization: textCapitalization,
          autocorrect: false,
          enableSuggestions: false,
          inputFormatters: inputFormatters,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: prefixIcon == null
                ? null
                : Icon(prefixIcon, color: AppColors.primary),
            counterText: '',
          ),
        ),
      ],
    );
  }
}
