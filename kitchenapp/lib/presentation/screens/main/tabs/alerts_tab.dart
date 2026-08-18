import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/navigation/module_screen_builder.dart';
import 'package:kitchenapp/presentation/screens/main/widgets/home_summary.dart';
import 'package:kitchenapp/presentation/screens/main/widgets/kitchen_module_preview.dart';
import 'package:kitchenapp/presentation/screens/main/widgets/kitchen_tab_widgets.dart';
import 'package:kitchenapp/presentation/widgets/module/ops_alert_widgets.dart';
import 'package:kitchenapp/state/auth_controller.dart';
import 'package:kitchenapp/state/kitchen_command_controller.dart';

class AlertsTab extends StatelessWidget {
  const AlertsTab({
    super.key,
    required this.controller,
    required this.auth,
  });

  final KitchenCommandController controller;
  final AuthController auth;

  static const _modules = [
    _AlertModule(
      'Live Alerts',
      'Delay · VIP · stock · equipment',
      Icons.notifications_active_rounded,
      AppColors.warning,
      35,
    ),
    _AlertModule(
      'Delay Escalation',
      'Timers · bottlenecks · auto escalate',
      Icons.timer_off_rounded,
      Color(0xffea580c),
      17,
    ),
    _AlertModule(
      'Kitchen Comms',
      'Broadcasts · threads · announcements',
      Icons.forum_rounded,
      AppColors.info,
      12,
    ),
    _AlertModule(
      'Panic & Emergency',
      'Incidents · evacuation · escalation',
      Icons.emergency_rounded,
      AppColors.danger,
      36,
    ),
  ];

  List<_AlertModule> _visibleModules(AuthController auth) {
    return _modules
        .where((module) => auth.canAccessNav(module.navIndex))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([controller, auth]),
      builder: (context, _) {
        final modules = _visibleModules(auth);
        final canViewLiveAlerts = auth.canAccessNav(35);
        final snapshot = controller.liveAlerts;
        final stats = snapshot?.stats;
        final activeAlerts = snapshot?.alerts
                .where(
                  (alert) =>
                      alert.status == 'active' || alert.status == 'escalated',
                )
                .take(4)
                .toList() ??
            const [];

        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TabScreenHeader(
                      title: 'Alerts & Comms',
                      subtitle:
                          'Monitor live signals, delays, and emergency workflows',
                      icon: Icons.notifications_active_rounded,
                      gradientColors: const [
                        Color(0xff9a3412),
                        Color(0xffc2410c),
                        Color(0xffea580c),
                      ],
                      loading: controller.liveAlertLoading,
                      onRefresh: () => controller.refreshLiveAlerts(),
                      chips: [
                        TabHeaderChip(
                          '${stats?.activeAlerts ?? '—'} active',
                          icon: Icons.bolt_rounded,
                        ),
                        TabHeaderChip(
                          '${stats?.criticalAlerts ?? '—'} critical',
                          icon: Icons.warning_amber_rounded,
                        ),
                        TabHeaderChip(
                          '${stats?.resolvedToday ?? '—'} resolved today',
                          icon: Icons.check_circle_outline,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    if (stats != null)
                      KitchenPreviewStatGrid(
                        stats: [
                          KitchenPreviewStat(
                            'Active',
                            '${stats.activeAlerts}',
                            Icons.notifications_active_rounded,
                            AppColors.warning,
                          ),
                          KitchenPreviewStat(
                            'Critical',
                            '${stats.criticalAlerts}',
                            Icons.error_outline_rounded,
                            AppColors.danger,
                          ),
                          KitchenPreviewStat(
                            'Delay',
                            '${stats.delayAlerts}',
                            Icons.timer_off_rounded,
                            const Color(0xffea580c),
                          ),
                          KitchenPreviewStat(
                            'Emergency',
                            '${stats.emergencyAlerts}',
                            Icons.emergency_rounded,
                            AppColors.danger,
                          ),
                        ],
                      )
                    else if (controller.liveAlertLoading)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else
                      _AlertsUnavailableBanner(
                        message: controller.liveAlertErrorMessage ??
                            'Live alert feed not loaded yet',
                        onRetry: () => controller.refreshLiveAlerts(),
                      ),
                    if (canViewLiveAlerts) ...[
                      const SizedBox(height: AppSpacing.xl),
                      HomeSectionTitle(
                        title: 'Live feed preview',
                        subtitle: activeAlerts.isEmpty
                            ? 'No active alerts right now'
                            : 'Top ${activeAlerts.length} active alerts',
                      ),
                      const SizedBox(height: AppSpacing.md),
                      if (activeAlerts.isEmpty && !controller.liveAlertLoading)
                        const _AlertsClearState()
                      else
                        ...activeAlerts.map(
                          (alert) => AlertPreviewTile(alert: alert),
                        ),
                      const SizedBox(height: AppSpacing.lg),
                      KitchenOpenModuleButton(
                        title: 'Open full live alerts',
                        subtitle:
                            'Manage, acknowledge, and escalate in module 35',
                        icon: Icons.open_in_new_rounded,
                        onTap: () => ModuleScreenBuilder.open(
                          context,
                          navIndex: 35,
                          controller: controller,
                          auth: auth,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                    const HomeSectionTitle(
                      title: 'Alert modules',
                      subtitle: 'Comms, escalation, and emergency systems',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate((context, index) {
                  final module = modules[index];
                  return OpsAlertModuleTile(
                    label: module.label,
                    subtitle: module.subtitle,
                    icon: module.icon,
                    color: module.color,
                    badge: '#${module.navIndex}',
                    onTap: () => ModuleScreenBuilder.open(
                      context,
                      navIndex: module.navIndex,
                      controller: controller,
                      auth: auth,
                    ),
                  );
                }, childCount: modules.length),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _AlertModule {
  const _AlertModule(
    this.label,
    this.subtitle,
    this.icon,
    this.color,
    this.navIndex,
  );

  final String label;
  final String subtitle;
  final IconData icon;
  final Color color;
  final int navIndex;
}

class _AlertsUnavailableBanner extends StatelessWidget {
  const _AlertsUnavailableBanner({
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.22)),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, color: AppColors.warning),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: AppColors.primaryText,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

class _AlertsClearState extends StatelessWidget {
  const _AlertsClearState();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.14)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.check_circle_rounded,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Kitchen is clear',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    color: AppColors.primaryText,
                  ),
                ),
                Text(
                  'No active or escalated alerts in the feed',
                  style: TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
