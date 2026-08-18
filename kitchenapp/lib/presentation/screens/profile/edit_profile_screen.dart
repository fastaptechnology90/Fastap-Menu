import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/presentation/screens/profile/profile_widgets.dart';
import 'package:kitchenapp/presentation/widgets/common/primary_button.dart';
import 'package:kitchenapp/state/auth_controller.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _sectionController;
  late final TextEditingController _staffCodeController;
  File? _pickedImage;
  bool _clearAvatar = false;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    final user = widget.auth.session?.user;
    _nameController = TextEditingController(text: user?.name ?? '');
    _phoneController = TextEditingController(text: user?.phone ?? '');
    _sectionController = TextEditingController(text: user?.section ?? '');
    _staffCodeController = TextEditingController(text: user?.staffCode ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _sectionController.dispose();
    _staffCodeController.dispose();
    super.dispose();
  }

  String? get _currentAvatarUrl {
    if (_clearAvatar) {
      return null;
    }
    return widget.auth.session?.user.avatarUrl;
  }

  void _onAvatarChanged(File? file, {bool clear = false}) {
    setState(() {
      _pickedImage = clear ? null : file;
      _clearAvatar = clear;
    });
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      showProfileSnackBar(context, 'Name cannot be empty', error: true);
      return;
    }

    String? avatarBase64;
    if (_pickedImage != null) {
      final bytes = await _pickedImage!.readAsBytes();
      avatarBase64 = base64Encode(bytes);
    }

    setState(() => _loading = true);
    final ok = await widget.auth.updateProfile(
      name: name,
      phone: _phoneController.text.trim(),
      section: _sectionController.text.trim(),
      avatarBase64: avatarBase64,
      clearAvatar: _clearAvatar,
    );
    if (!mounted) return;
    setState(() => _loading = false);

    if (ok) {
      showProfileSnackBar(context, 'Profile updated successfully');
      Navigator.pop(context);
      return;
    }

    showProfileSnackBar(
      context,
      widget.auth.errorMessage ?? 'Unable to update profile',
      error: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.auth.session?.user;

    return ProfileScreenScaffold(
      title: 'Edit profile',
      subtitle: 'Update your kitchen identity',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ProfileAvatarPicker(
            name: _nameController.text.isEmpty ? user?.name : _nameController.text,
            avatarUrl: _currentAvatarUrl,
            localFile: _pickedImage,
            onChanged: _onAvatarChanged,
          ),
          const SizedBox(height: AppSpacing.lg),
          const ProfileInfoBanner(
            message:
                'Your staff code and role are managed by your kitchen admin. '
                'You can update your photo, display name, phone, and section here.',
          ),
          const SizedBox(height: AppSpacing.xl),
          ProfileFormField(
            label: 'Full name',
            controller: _nameController,
            icon: Icons.person_outline,
          ),
          const SizedBox(height: AppSpacing.md),
          ProfileFormField(
            label: 'Mobile number',
            controller: _phoneController,
            icon: Icons.phone_outlined,
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: AppSpacing.md),
          ProfileFormField(
            label: 'Kitchen section',
            controller: _sectionController,
            icon: Icons.kitchen_outlined,
          ),
          const SizedBox(height: AppSpacing.md),
          ProfileFormField(
            label: 'Staff code',
            controller: _staffCodeController,
            icon: Icons.badge_outlined,
            enabled: false,
          ),
          const SizedBox(height: AppSpacing.xxl),
          PrimaryButton(
            label: 'Save changes',
            icon: Icons.check_rounded,
            loading: _loading,
            onPressed: _loading ? null : _save,
          ),
        ],
      ),
    );
  }
}
