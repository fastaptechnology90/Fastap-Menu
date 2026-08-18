import 'package:flutter/material.dart';

import '../core/constants/app_constants.dart';
import '../state/kitchen_command_controller.dart';
import 'views/ai_kitchen_assistant_view.dart';
import 'views/enterprise_features_view.dart';
import 'views/food_prep_view.dart';
import 'views/live_kds_view.dart';
import 'views/kitchen_dashboard_view.dart';
import 'views/allergy_safety_view.dart';
import 'views/chef_task_management_view.dart';
import 'views/course_firing_view.dart';
import 'views/modifier_management_view.dart';
import 'views/order_processing_view.dart';
import 'views/section_management_view.dart';
import 'views/inventory_stock_view.dart';
import 'views/kitchen_communication_view.dart';
import 'views/order_priority_view.dart';
import 'views/delay_escalation_view.dart';
import 'views/quality_control_view.dart';
import 'views/customer_return_view.dart';
import 'views/expeditor_management_view.dart';
import 'views/packing_delivery_view.dart';
import 'views/delivery_aggregator_view.dart';
import 'views/bar_beverage_view.dart';
import 'views/bakery_dessert_view.dart';
import 'views/cloud_kitchen_view.dart';
import 'views/banquet_view.dart';
import 'views/room_service_view.dart';
import 'views/cleaning_hygiene_view.dart';
import 'views/equipment_view.dart';
import 'views/smart_energy_view.dart';
import 'views/iot_device_view.dart';
import 'views/staff_performance_view.dart';
import 'views/staff_shift_view.dart';
import 'views/staff_wellness_view.dart';
import 'views/live_alert_view.dart';
import 'views/panic_emergency_view.dart';
import 'views/offline_failover_view.dart';
import 'views/analytics_reporting_view.dart';
import 'views/kitchen_heatmap_view.dart';
import 'views/hardware_integration_view.dart';
import 'views/smartwatch_support_view.dart';
import 'views/multi_branch_view.dart';
import 'views/audit_compliance_view.dart';
import 'views/backup_recovery_view.dart';
import 'views/sandbox_training_view.dart';
import 'views/hidden_enterprise_view.dart';
import 'views/future_ai_expansion_view.dart';
import 'views/waiter_auto_assignment_view.dart';
import 'views/batch_cooking_view.dart';
import 'views/prep_station_management_view.dart';
import 'views/recipe_costing_view.dart';
import 'views/staff_command_view.dart';
import '../state/auth_controller.dart';
import '../widgets/kitchen/app_header.dart';
import '../widgets/kitchen/section_filter.dart';

class KitchenCommandCenterScreen extends StatefulWidget {
  const KitchenCommandCenterScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<KitchenCommandCenterScreen> createState() =>
      _KitchenCommandCenterScreenState();
}

class _KitchenCommandCenterScreenState
    extends State<KitchenCommandCenterScreen> {
  late final KitchenCommandController controller;
  final ScrollController _scrollController = ScrollController();
  int _lastNavIndex = 0;

  @override
  void initState() {
    super.initState();
    controller = KitchenCommandController(auth: widget.auth);
    controller.addListener(_handleNavScrollReset);
    controller.bootstrap();
  }

  void _handleNavScrollReset() {
    if (_lastNavIndex == controller.selectedNav) {
      return;
    }
    _lastNavIndex = controller.selectedNav;
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  void dispose() {
    controller.removeListener(_handleNavScrollReset);
    _scrollController.dispose();
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final wide =
            MediaQuery.sizeOf(context).width >= AppConstants.desktopBreakpoint;

        return Scaffold(
          body: SafeArea(
            child: Row(
              children: [
                if (wide)
                  NavigationRail(
                    selectedIndex: controller.selectedNav,
                    onDestinationSelected: controller.selectNav,
                    minWidth: 84,
                    labelType: NavigationRailLabelType.all,
                    destinations: const [
                      NavigationRailDestination(
                        icon: Icon(Icons.dashboard_outlined),
                        selectedIcon: Icon(Icons.dashboard),
                        label: Text('Live'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.monitor_outlined),
                        selectedIcon: Icon(Icons.monitor),
                        label: Text('KDS'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.hub_outlined),
                        selectedIcon: Icon(Icons.hub),
                        label: Text('Sections'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.sync_alt_outlined),
                        selectedIcon: Icon(Icons.sync_alt),
                        label: Text('Processing'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.local_fire_department_outlined),
                        selectedIcon: Icon(Icons.local_fire_department),
                        label: Text('Firing'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.soup_kitchen_outlined),
                        selectedIcon: Icon(Icons.soup_kitchen),
                        label: Text('Prep'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.tune_outlined),
                        selectedIcon: Icon(Icons.tune),
                        label: Text('Modifiers'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.assignment_ind_outlined),
                        selectedIcon: Icon(Icons.assignment_ind),
                        label: Text('Tasks'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.groups_2_outlined),
                        selectedIcon: Icon(Icons.groups_2),
                        label: Text('Staff'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.health_and_safety_outlined),
                        selectedIcon: Icon(Icons.health_and_safety),
                        label: Text('Safety'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.psychology_outlined),
                        selectedIcon: Icon(Icons.psychology),
                        label: Text('AI'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.low_priority_outlined),
                        selectedIcon: Icon(Icons.low_priority),
                        label: Text('Priority'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.forum_outlined),
                        selectedIcon: Icon(Icons.forum),
                        label: Text('Comms'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.inventory_2_outlined),
                        selectedIcon: Icon(Icons.inventory_2),
                        label: Text('Stock'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.menu_book_outlined),
                        selectedIcon: Icon(Icons.menu_book),
                        label: Text('Recipes'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.countertops_outlined),
                        selectedIcon: Icon(Icons.countertops),
                        label: Text('Stations'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.layers_outlined),
                        selectedIcon: Icon(Icons.layers),
                        label: Text('Batch'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.timer_off_outlined),
                        selectedIcon: Icon(Icons.timer_off),
                        label: Text('Delays'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.verified_outlined),
                        selectedIcon: Icon(Icons.verified),
                        label: Text('QC'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.replay_outlined),
                        selectedIcon: Icon(Icons.replay),
                        label: Text('Returns'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.fact_check_outlined),
                        selectedIcon: Icon(Icons.fact_check),
                        label: Text('Expeditor'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.inventory_outlined),
                        selectedIcon: Icon(Icons.inventory),
                        label: Text('Packing'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.delivery_dining_outlined),
                        selectedIcon: Icon(Icons.delivery_dining),
                        label: Text('Aggregator'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.local_bar_outlined),
                        selectedIcon: Icon(Icons.local_bar),
                        label: Text('Bar'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.cake_outlined),
                        selectedIcon: Icon(Icons.cake),
                        label: Text('Bakery'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.cloud_outlined),
                        selectedIcon: Icon(Icons.cloud),
                        label: Text('Cloud'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.celebration_outlined),
                        selectedIcon: Icon(Icons.celebration),
                        label: Text('Banquet'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.hotel_outlined),
                        selectedIcon: Icon(Icons.hotel),
                        label: Text('Rooms'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.cleaning_services_outlined),
                        selectedIcon: Icon(Icons.cleaning_services),
                        label: Text('Hygiene'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.precision_manufacturing_outlined),
                        selectedIcon: Icon(Icons.precision_manufacturing),
                        label: Text('Equipment'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.bolt_outlined),
                        selectedIcon: Icon(Icons.bolt),
                        label: Text('Energy'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.sensors_outlined),
                        selectedIcon: Icon(Icons.sensors),
                        label: Text('IoT'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.leaderboard_outlined),
                        selectedIcon: Icon(Icons.leaderboard),
                        label: Text('Performance'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.schedule_outlined),
                        selectedIcon: Icon(Icons.schedule),
                        label: Text('Shifts'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.self_improvement_outlined),
                        selectedIcon: Icon(Icons.self_improvement),
                        label: Text('Wellness'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.notifications_active_outlined),
                        selectedIcon: Icon(Icons.notifications_active),
                        label: Text('Alerts'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.emergency_outlined),
                        selectedIcon: Icon(Icons.emergency),
                        label: Text('Emergency'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.cloud_off_outlined),
                        selectedIcon: Icon(Icons.cloud_off),
                        label: Text('Offline'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.insights_outlined),
                        selectedIcon: Icon(Icons.insights),
                        label: Text('Analytics'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.grid_on_outlined),
                        selectedIcon: Icon(Icons.grid_on),
                        label: Text('Heatmap'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.devices_outlined),
                        selectedIcon: Icon(Icons.devices),
                        label: Text('Hardware'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.watch_outlined),
                        selectedIcon: Icon(Icons.watch),
                        label: Text('Watch'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.account_tree_outlined),
                        selectedIcon: Icon(Icons.account_tree),
                        label: Text('Branches'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.fact_check_outlined),
                        selectedIcon: Icon(Icons.fact_check),
                        label: Text('Audit'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.backup_outlined),
                        selectedIcon: Icon(Icons.backup),
                        label: Text('Backup'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.school_outlined),
                        selectedIcon: Icon(Icons.school),
                        label: Text('Training'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.admin_panel_settings_outlined),
                        selectedIcon: Icon(Icons.admin_panel_settings),
                        label: Text('Hidden'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.auto_awesome_outlined),
                        selectedIcon: Icon(Icons.auto_awesome),
                        label: Text('Future AI'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.view_list_outlined),
                        selectedIcon: Icon(Icons.view_list),
                        label: Text('Features'),
                      ),
                    ],
                  ),
                Expanded(
                  child: CustomScrollView(
                    controller: _scrollController,
                    slivers: [
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
                          child: AppHeader(
                            selectedNav: controller.selectedNav,
                            onNavSelected: controller.selectNav,
                            showTabs: !wide,
                            auth: widget.auth,
                            controller: controller,
                          ),
                        ),
                      ),
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: SectionFilter(
                            sections: controller.sections,
                            selected: controller.selectedSection,
                            onChanged: controller.selectSection,
                          ),
                        ),
                      ),
                      SliverPadding(
                        padding: const EdgeInsets.all(20),
                        sliver: SliverToBoxAdapter(
                          child: _contentFor(controller.selectedNav),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _contentFor(int index) {
    return switch (index) {
      1 => LiveKdsView(controller: controller),
      2 => SectionManagementView(controller: controller),
      3 => OrderProcessingView(controller: controller),
      4 => CourseFiringView(controller: controller),
      5 => FoodPrepView(controller: controller),
      6 => ModifierManagementView(controller: controller),
      7 => ChefTaskManagementView(controller: controller),
      8 => StaffCommandView(auth: widget.auth, controller: controller),
      9 => AllergySafetyView(controller: controller),
      10 => AiKitchenAssistantView(controller: controller),
      11 => OrderPriorityView(controller: controller),
      12 => KitchenCommunicationView(controller: controller),
      13 => InventoryStockView(controller: controller),
      14 => RecipeCostingView(controller: controller),
      15 => PrepStationManagementView(controller: controller),
      16 => BatchCookingView(controller: controller),
      17 => DelayEscalationView(controller: controller),
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
      35 => LiveAlertView(controller: controller),
      36 => PanicEmergencyView(controller: controller),
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
      49 => EnterpriseFeaturesView(controller: controller, auth: widget.auth),
      _ => KitchenDashboardView(controller: controller),
    };
  }
}
