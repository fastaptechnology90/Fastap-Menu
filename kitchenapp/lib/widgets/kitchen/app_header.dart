import 'package:flutter/material.dart';

import '../../core/config/api_config.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_constants.dart';
import '../../data/enterprise_system_nav_registry.dart';
import '../../state/auth_controller.dart';
import '../../state/kitchen_command_controller.dart';
import '../auth/role_badge.dart';
import '../common/status_pill.dart';
import 'module_switcher.dart';

class AppHeader extends StatelessWidget {
  const AppHeader({
    super.key,
    required this.selectedNav,
    required this.onNavSelected,
    required this.showTabs,
    required this.auth,
    this.controller,
  });

  final int selectedNav;
  final ValueChanged<int> onNavSelected;
  final bool showTabs;
  final AuthController auth;
  final KitchenCommandController? controller;

  @override
  Widget build(BuildContext context) {
    final session = auth.session;
    final user = session?.user;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 16,
          runSpacing: 16,
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppConstants.brandName,
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  AppConstants.commandCenterTitle,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  EnterpriseSystemNavRegistry.moduleLabelForNavIndex(selectedNav),
                  style: TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (user != null) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        user.name,
                        style: TextStyle(
                          color: AppColors.bodyText,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      RoleBadge(role: user.role, compact: true),
                      MiniStaffMeta(
                        icon: Icons.schedule_outlined,
                        label: 'Shift ${session!.shiftId}',
                      ),
                    ],
                  ),
                ],
              ],
            ),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                ModuleSwitcherButton(
                  selectedNav: selectedNav,
                  onNavSelected: onNavSelected,
                ),
                StatusPill(
                  icon: Icons.api_outlined,
                  label: ApiConfig.modeLabel,
                  color: AppColors.primary,
                ),
                StatusPill(
                  icon: Icons.verified_user_outlined,
                  label: session == null ? 'Unsecured' : 'Shift secured',
                  color: AppColors.primary,
                ),
                StatusPill(
                  icon: Icons.devices_other_outlined,
                  label: 'Device bound',
                  color: AppColors.info,
                ),
                StatusPill(
                  icon: Icons.wifi_tethering,
                  label: _syncLabel(),
                  color: AppColors.info,
                ),
                StatusPill(
                  icon: Icons.warning_amber_rounded,
                  label: _escalationLabel(),
                  color: AppColors.warning,
                ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert),
                  onSelected: (value) async {
                    if (value == 'logout') {
                      await auth.logout();
                    } else if (value == 'emergency') {
                      await auth.logout(emergency: true);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Emergency logout executed'),
                            backgroundColor: AppColors.danger,
                          ),
                        );
                      }
                    }
                  },
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'logout',
                      child: ListTile(
                        leading: Icon(Icons.logout),
                        title: Text('Sign out'),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    if (auth.canEmergencyLogout)
                      PopupMenuItem(
                        value: 'emergency',
                        child: ListTile(
                          leading: Icon(Icons.emergency, color: AppColors.danger),
                          title: Text('Emergency logout'),
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ],
        ),
        if (showTabs) ...[
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SegmentedButton<int>(
              selected: {selectedNav},
              onSelectionChanged: (selection) => onNavSelected(selection.first),
              segments: const [
                ButtonSegment(
                  value: 0,
                  icon: Icon(Icons.dashboard_outlined),
                  label: Text('Live'),
                ),
                ButtonSegment(
                  value: 1,
                  icon: Icon(Icons.monitor_outlined),
                  label: Text('KDS'),
                ),
                ButtonSegment(
                  value: 2,
                  icon: Icon(Icons.hub_outlined),
                  label: Text('Sections'),
                ),
                ButtonSegment(
                  value: 3,
                  icon: Icon(Icons.sync_alt_outlined),
                  label: Text('Processing'),
                ),
                ButtonSegment(
                  value: 4,
                  icon: Icon(Icons.local_fire_department_outlined),
                  label: Text('Firing'),
                ),
                ButtonSegment(
                  value: 5,
                  icon: Icon(Icons.soup_kitchen_outlined),
                  label: Text('Prep'),
                ),
                ButtonSegment(
                  value: 6,
                  icon: Icon(Icons.tune_outlined),
                  label: Text('Modifiers'),
                ),
                ButtonSegment(
                  value: 7,
                  icon: Icon(Icons.assignment_ind_outlined),
                  label: Text('Tasks'),
                ),
                ButtonSegment(
                  value: 8,
                  icon: Icon(Icons.groups_2_outlined),
                  label: Text('Staff'),
                ),
                ButtonSegment(
                  value: 9,
                  icon: Icon(Icons.health_and_safety_outlined),
                  label: Text('Safety'),
                ),
                ButtonSegment(
                  value: 10,
                  icon: Icon(Icons.psychology_outlined),
                  label: Text('AI'),
                ),
                ButtonSegment(
                  value: 11,
                  icon: Icon(Icons.low_priority_outlined),
                  label: Text('Priority'),
                ),
                ButtonSegment(
                  value: 12,
                  icon: Icon(Icons.forum_outlined),
                  label: Text('Comms'),
                ),
                ButtonSegment(
                  value: 13,
                  icon: Icon(Icons.inventory_2_outlined),
                  label: Text('Stock'),
                ),
                ButtonSegment(
                  value: 14,
                  icon: Icon(Icons.menu_book_outlined),
                  label: Text('Recipes'),
                ),
                ButtonSegment(
                  value: 15,
                  icon: Icon(Icons.countertops_outlined),
                  label: Text('Stations'),
                ),
                ButtonSegment(
                  value: 16,
                  icon: Icon(Icons.layers_outlined),
                  label: Text('Batch'),
                ),
                ButtonSegment(
                  value: 17,
                  icon: Icon(Icons.timer_off_outlined),
                  label: Text('Delays'),
                ),
                ButtonSegment(
                  value: 18,
                  icon: Icon(Icons.verified_outlined),
                  label: Text('QC'),
                ),
                ButtonSegment(
                  value: 19,
                  icon: Icon(Icons.replay_outlined),
                  label: Text('Returns'),
                ),
                ButtonSegment(
                  value: 20,
                  icon: Icon(Icons.fact_check_outlined),
                  label: Text('Expeditor'),
                ),
                ButtonSegment(
                  value: 21,
                  icon: Icon(Icons.inventory_outlined),
                  label: Text('Packing'),
                ),
                ButtonSegment(
                  value: 22,
                  icon: Icon(Icons.delivery_dining_outlined),
                  label: Text('Aggregator'),
                ),
                ButtonSegment(
                  value: 23,
                  icon: Icon(Icons.local_bar_outlined),
                  label: Text('Bar'),
                ),
                ButtonSegment(
                  value: 24,
                  icon: Icon(Icons.cake_outlined),
                  label: Text('Bakery'),
                ),
                ButtonSegment(
                  value: 25,
                  icon: Icon(Icons.cloud_outlined),
                  label: Text('Cloud'),
                ),
                ButtonSegment(
                  value: 26,
                  icon: Icon(Icons.celebration_outlined),
                  label: Text('Banquet'),
                ),
                ButtonSegment(
                  value: 27,
                  icon: Icon(Icons.hotel_outlined),
                  label: Text('Rooms'),
                ),
                ButtonSegment(
                  value: 28,
                  icon: Icon(Icons.cleaning_services_outlined),
                  label: Text('Hygiene'),
                ),
                ButtonSegment(
                  value: 29,
                  icon: Icon(Icons.precision_manufacturing_outlined),
                  label: Text('Equipment'),
                ),
                ButtonSegment(
                  value: 30,
                  icon: Icon(Icons.bolt_outlined),
                  label: Text('Energy'),
                ),
                ButtonSegment(
                  value: 31,
                  icon: Icon(Icons.sensors_outlined),
                  label: Text('IoT'),
                ),
                ButtonSegment(
                  value: 32,
                  icon: Icon(Icons.leaderboard_outlined),
                  label: Text('Performance'),
                ),
                ButtonSegment(
                  value: 33,
                  icon: Icon(Icons.schedule_outlined),
                  label: Text('Shifts'),
                ),
                ButtonSegment(
                  value: 34,
                  icon: Icon(Icons.self_improvement_outlined),
                  label: Text('Wellness'),
                ),
                ButtonSegment(
                  value: 35,
                  icon: Icon(Icons.notifications_active_outlined),
                  label: Text('Alerts'),
                ),
                ButtonSegment(
                  value: 36,
                  icon: Icon(Icons.emergency_outlined),
                  label: Text('Emergency'),
                ),
                ButtonSegment(
                  value: 37,
                  icon: Icon(Icons.cloud_off_outlined),
                  label: Text('Offline'),
                ),
                ButtonSegment(
                  value: 38,
                  icon: Icon(Icons.insights_outlined),
                  label: Text('Analytics'),
                ),
                ButtonSegment(
                  value: 39,
                  icon: Icon(Icons.grid_on_outlined),
                  label: Text('Heatmap'),
                ),
                ButtonSegment(
                  value: 40,
                  icon: Icon(Icons.devices_outlined),
                  label: Text('Hardware'),
                ),
                ButtonSegment(
                  value: 41,
                  icon: Icon(Icons.watch_outlined),
                  label: Text('Watch'),
                ),
                ButtonSegment(
                  value: 42,
                  icon: Icon(Icons.account_tree_outlined),
                  label: Text('Branches'),
                ),
                ButtonSegment(
                  value: 43,
                  icon: Icon(Icons.fact_check_outlined),
                  label: Text('Audit'),
                ),
                ButtonSegment(
                  value: 44,
                  icon: Icon(Icons.backup_outlined),
                  label: Text('Backup'),
                ),
                ButtonSegment(
                  value: 45,
                  icon: Icon(Icons.school_outlined),
                  label: Text('Training'),
                ),
                ButtonSegment(
                  value: 46,
                  icon: Icon(Icons.admin_panel_settings_outlined),
                  label: Text('Hidden'),
                ),
                ButtonSegment(
                  value: 47,
                  icon: Icon(Icons.auto_awesome_outlined),
                  label: Text('Future AI'),
                ),
                ButtonSegment(
                  value: 48,
                  icon: Icon(Icons.view_list_outlined),
                  label: Text('Features'),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  String _syncLabel() {
    final synced = controller?.lastSyncedAt;
    if (synced == null) {
      return 'Live sync';
    }
    final hour = synced.hour.toString().padLeft(2, '0');
    final minute = synced.minute.toString().padLeft(2, '0');
    return 'Synced $hour:$minute';
  }

  String _escalationLabel() {
    final alerts = controller?.dashboard?.rushAlerts.length ?? 0;
    if (alerts == 0) {
      return 'No escalations';
    }
    return '$alerts escalations';
  }
}

class MiniStaffMeta extends StatelessWidget {
  const MiniStaffMeta({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.secondaryText),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w700,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}
