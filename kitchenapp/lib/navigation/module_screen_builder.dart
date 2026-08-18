import 'package:flutter/material.dart';

import '../state/auth_controller.dart';
import '../screens/views/ai_kitchen_assistant_view.dart';
import '../screens/views/allergy_safety_view.dart';
import '../screens/views/analytics_reporting_view.dart';
import '../screens/views/audit_compliance_view.dart';
import '../screens/views/backup_recovery_view.dart';
import '../screens/views/bakery_dessert_view.dart';
import '../screens/views/banquet_view.dart';
import '../screens/views/bar_beverage_view.dart';
import '../screens/views/batch_cooking_view.dart';
import '../screens/views/chef_task_management_view.dart';
import '../screens/views/cleaning_hygiene_view.dart';
import '../screens/views/cloud_kitchen_view.dart';
import '../screens/views/course_firing_view.dart';
import '../screens/views/customer_return_view.dart';
import '../screens/views/delay_escalation_view.dart';
import '../screens/views/delivery_aggregator_view.dart';
import '../screens/views/enterprise_features_view.dart';
import '../screens/views/equipment_view.dart';
import '../screens/views/expeditor_management_view.dart';
import '../screens/views/food_prep_view.dart';
import '../screens/views/future_ai_expansion_view.dart';
import '../screens/views/hardware_integration_view.dart';
import '../screens/views/hidden_enterprise_view.dart';
import '../screens/views/inventory_stock_view.dart';
import '../screens/views/iot_device_view.dart';
import '../screens/views/kitchen_communication_view.dart';
import '../screens/views/kitchen_dashboard_view.dart';
import '../screens/views/kitchen_heatmap_view.dart';
import '../screens/views/live_alert_view.dart';
import '../screens/views/live_kds_view.dart';
import '../screens/views/modifier_management_view.dart';
import '../screens/views/multi_branch_view.dart';
import '../screens/views/offline_failover_view.dart';
import '../screens/views/order_priority_view.dart';
import '../screens/views/order_processing_view.dart';
import '../screens/views/packing_delivery_view.dart';
import '../screens/views/panic_emergency_view.dart';
import '../screens/views/prep_station_management_view.dart';
import '../screens/views/quality_control_view.dart';
import '../screens/views/recipe_costing_view.dart';
import '../screens/views/room_service_view.dart';
import '../screens/views/sandbox_training_view.dart';
import '../screens/views/section_management_view.dart';
import '../screens/views/smart_energy_view.dart';
import '../screens/views/smartwatch_support_view.dart';
import '../screens/views/staff_command_view.dart';
import '../screens/views/staff_performance_view.dart';
import '../screens/views/staff_shift_view.dart';
import '../screens/views/staff_wellness_view.dart';
import '../screens/views/waiter_auto_assignment_view.dart';
import '../data/enterprise_system_nav_registry.dart';
import '../presentation/widgets/common/role_access_denied.dart';
import '../presentation/widgets/module/module_detail_header.dart';
import '../state/kitchen_command_controller.dart';
import '../widgets/common/enterprise_system_capabilities.dart';

class ModuleScreenBuilder {
  const ModuleScreenBuilder._();

  static String titleFor(int navIndex) {
    return EnterpriseSystemNavRegistry.moduleLabelForNavIndex(navIndex);
  }

  static Widget build({
    required int navIndex,
    required KitchenCommandController controller,
    required AuthController auth,
    bool embedded = false,
  }) {
    return switch (navIndex) {
      1 => LiveKdsView(controller: controller),
      2 => SectionManagementView(controller: controller),
      3 => OrderProcessingView(controller: controller),
      4 => CourseFiringView(controller: controller),
      5 => FoodPrepView(controller: controller),
      6 => ModifierManagementView(controller: controller),
      7 => ChefTaskManagementView(controller: controller),
      8 => StaffCommandView(auth: auth, controller: controller),
      9 => AllergySafetyView(controller: controller),
      10 => AiKitchenAssistantView(controller: controller),
      11 => OrderPriorityView(controller: controller),
      12 => KitchenCommunicationView(
          controller: controller,
          embedded: embedded,
        ),
      13 => InventoryStockView(controller: controller),
      14 => RecipeCostingView(controller: controller),
      15 => PrepStationManagementView(controller: controller),
      16 => BatchCookingView(controller: controller),
      17 => DelayEscalationView(
          controller: controller,
          embedded: embedded,
        ),
      18 => QualityControlView(controller: controller),
      19 => CustomerReturnView(controller: controller),
      20 => ExpeditorManagementView(controller: controller),
      21 => PackingDeliveryView(controller: controller),
      22 => DeliveryAggregatorView(controller: controller),
      23 => BarBeverageView(controller: controller),
      24 => BakeryDessertView(controller: controller),
      25 => CloudKitchenView(controller: controller),
      26 => BanquetView(controller: controller),
      27 => RoomServiceView(controller: controller),
      28 => CleaningHygieneView(controller: controller),
      29 => EquipmentView(controller: controller),
      30 => SmartEnergyView(controller: controller),
      31 => IotDeviceView(controller: controller),
      32 => StaffPerformanceView(controller: controller),
      33 => StaffShiftView(controller: controller),
      34 => StaffWellnessView(controller: controller),
      35 => LiveAlertView(controller: controller, embedded: embedded),
      36 => PanicEmergencyView(
          controller: controller,
          embedded: embedded,
        ),
      37 => OfflineFailoverView(controller: controller),
      38 => AnalyticsReportingView(controller: controller),
      39 => KitchenHeatmapView(controller: controller),
      40 => HardwareIntegrationView(controller: controller),
      41 => SmartwatchSupportView(controller: controller),
      42 => MultiBranchView(controller: controller),
      43 => AuditComplianceView(controller: controller),
      44 => BackupRecoveryView(controller: controller),
      45 => SandboxTrainingView(controller: controller),
      46 => HiddenEnterpriseView(controller: controller),
      47 => FutureAiExpansionView(controller: controller),
      48 => WaiterAutoAssignmentView(controller: controller),
      49 => EnterpriseFeaturesView(controller: controller, auth: auth),
      _ => KitchenDashboardView(controller: controller),
    };
  }

  static Future<void> open(
    BuildContext context, {
    required int navIndex,
    required KitchenCommandController controller,
    required AuthController auth,
  }) {
    if (!auth.canAccessNav(navIndex)) {
      final reason = auth.navAccessBlockReason(navIndex) ??
          'This module is not available.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(reason)),
      );
      return Future.value();
    }

    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ModuleDetailScreen(
          navIndex: navIndex,
          controller: controller,
          auth: auth,
        ),
      ),
    );
  }
}

class ModuleDetailScreen extends StatefulWidget {
  const ModuleDetailScreen({
    super.key,
    required this.navIndex,
    required this.controller,
    required this.auth,
  });

  final int navIndex;
  final KitchenCommandController controller;
  final AuthController auth;

  @override
  State<ModuleDetailScreen> createState() => _ModuleDetailScreenState();
}

class _ModuleDetailScreenState extends State<ModuleDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      refreshModule(widget.controller, widget.navIndex);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.auth.canAccessNav(widget.navIndex)) {
      final blockedByEntitlements =
          widget.auth.isNavBlockedByEntitlements(widget.navIndex);
      final reason = widget.auth.navAccessBlockReason(widget.navIndex);
      return Scaffold(
        appBar: AppBar(title: const Text('Access restricted')),
        body: RoleAccessDenied(
          title: blockedByEntitlements
              ? 'Module disabled'
              : 'Not available for your role',
          message: reason ?? 'This module is not available.',
        ),
      );
    }

    final title = ModuleScreenBuilder.titleFor(widget.navIndex);
    final isDashboard = widget.navIndex == 0;
    final systemNumber =
        EnterpriseSystemNavRegistry.systemNumberForNavIndex(widget.navIndex);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
        ),
      ),
      body: isDashboard
          ? Padding(
              padding: const EdgeInsets.all(20),
              child: KitchenDashboardView(
                controller: widget.controller,
                useExpandedBody: true,
              ),
            )
          : ListenableBuilder(
              listenable: widget.controller,
              builder: (context, _) {
                return SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ModuleDetailHeader(
                        navIndex: widget.navIndex,
                        title: title,
                        loading: moduleLoading(widget.controller, widget.navIndex),
                        onRefresh: () =>
                            refreshModule(widget.controller, widget.navIndex),
                      ),
                      if (systemNumber != null) ...[
                        const SizedBox(height: 12),
                        EnterpriseSystemCapabilitiesExpandable(
                          systemNumber: systemNumber,
                        ),
                      ],
                      const SizedBox(height: 16),
                      ModuleScreenBuilder.build(
                        navIndex: widget.navIndex,
                        controller: widget.controller,
                        auth: widget.auth,
                        embedded: true,
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
