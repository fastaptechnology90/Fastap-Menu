import 'package:flutter/material.dart';

import 'package:kitchenapp/core/config/api_config.dart';
import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/core/storage/app_preferences.dart';
import 'package:kitchenapp/presentation/screens/profile/profile_widgets.dart';
import 'package:kitchenapp/state/auth_controller.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _prefs = AppPreferences();
  bool _notifications = true;
  bool _soundAlerts = true;
  bool _haptic = true;
  bool _compactMode = false;
  bool _loading = true;
  bool _checkingApi = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final notifications = await _prefs.notificationsEnabled();
    final sound = await _prefs.soundAlertsEnabled();
    final haptic = await _prefs.hapticEnabled();
    final compact = await _prefs.compactModeEnabled();
    if (!mounted) return;
    setState(() {
      _notifications = notifications;
      _soundAlerts = sound;
      _haptic = haptic;
      _compactMode = compact;
      _loading = false;
    });
  }

  Future<void> _testApiConnection() async {
    setState(() => _checkingApi = true);
    final result = await widget.auth.recheckApiConnectivity();
    if (!mounted) return;
    setState(() => _checkingApi = false);
    showProfileSnackBar(
      context,
      result.reachable
          ? 'Server connected · ${result.summary}'
          : 'Connection failed · ${result.message ?? 'Unknown error'}',
    );
  }

  Future<void> _resetOnboarding() async {
    await _prefs.resetOnboarding();
    if (!mounted) return;
    showProfileSnackBar(
      context,
      'Onboarding reset — restart the app to see it again',
    );
  }

  @override
  Widget build(BuildContext context) {
    return ProfileScreenScaffold(
      title: 'Settings',
      subtitle: 'Preferences and app behavior',
      child: _loading
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(48),
                child: CircularProgressIndicator(),
              ),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const ProfileSectionTitle(
                  'Notifications',
                  subtitle: 'Control alerts on this device',
                ),
                _SettingsToggleTile(
                  icon: Icons.notifications_active_outlined,
                  title: 'Push notifications',
                  subtitle: 'Order delays, VIP alerts, and broadcasts',
                  value: _notifications,
                  onChanged: (value) async {
                    setState(() => _notifications = value);
                    await _prefs.setNotificationsEnabled(value);
                  },
                ),
                _SettingsToggleTile(
                  icon: Icons.volume_up_outlined,
                  title: 'Sound alerts',
                  subtitle: 'KDS priority chimes and alert tones',
                  value: _soundAlerts,
                  onChanged: (value) async {
                    setState(() => _soundAlerts = value);
                    await _prefs.setSoundAlertsEnabled(value);
                  },
                ),
                _SettingsToggleTile(
                  icon: Icons.vibration_rounded,
                  title: 'Haptic feedback',
                  subtitle: 'Vibration on critical kitchen actions',
                  value: _haptic,
                  onChanged: (value) async {
                    setState(() => _haptic = value);
                    await _prefs.setHapticEnabled(value);
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                const ProfileSectionTitle(
                  'Display',
                  subtitle: 'Layout preferences',
                ),
                _SettingsToggleTile(
                  icon: Icons.view_compact_alt_outlined,
                  title: 'Compact mode',
                  subtitle: 'Denser cards on dashboard and lists',
                  value: _compactMode,
                  onChanged: (value) async {
                    setState(() => _compactMode = value);
                    await _prefs.setCompactModeEnabled(value);
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                const ProfileSectionTitle('System'),
                ProfileMenuTile(
                  icon: Icons.cloud_outlined,
                  title: 'API mode',
                  subtitle: ApiConfig.modeLabel,
                ),
                if (!ApiConfig.useMockApi) ...[
                  ProfileMenuTile(
                    icon: Icons.link_outlined,
                    title: 'Server URL',
                    subtitle: ApiConfig.activeBaseUrl,
                    color: AppColors.info,
                  ),
                  ProfileMenuTile(
                    icon: Icons.wifi_tethering_outlined,
                    title: _checkingApi ? 'Testing connection…' : 'Test server connection',
                    subtitle: widget.auth.apiConnectivityMessage ?? 'Tap to verify API health',
                    onTap: _checkingApi ? null : _testApiConnection,
                    color: AppColors.primary,
                  ),
                ],
                ProfileMenuTile(
                  icon: Icons.replay_outlined,
                  title: 'Show onboarding again',
                  subtitle: 'Reset first-run walkthrough',
                  onTap: _resetOnboarding,
                ),
                ProfileMenuTile(
                  icon: Icons.devices_other_outlined,
                  title: 'Device ID',
                  subtitle: _shortDeviceId(widget.auth.deviceId),
                  color: AppColors.info,
                ),
              ],
            ),
    );
  }
}

String _shortDeviceId(String? deviceId) {
  if (deviceId == null || deviceId.isEmpty) {
    return 'Not bound';
  }
  if (deviceId.length <= 16) {
    return deviceId;
  }
  return '${deviceId.substring(0, 8)}…${deviceId.substring(deviceId.length - 4)}';
}

class _SettingsToggleTile extends StatelessWidget {
  const _SettingsToggleTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        child: Ink(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.panelBorder),
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(icon, color: AppColors.primary),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.primaryText,
                      ),
                    ),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.secondaryText,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Switch.adaptive(
                value: value,
                activeTrackColor: AppColors.primary.withValues(alpha: 0.45),
                activeThumbColor: AppColors.primary,
                onChanged: onChanged,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
