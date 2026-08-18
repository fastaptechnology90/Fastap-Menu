// ignore_for_file: avoid_print
import 'dart:convert';
import 'dart:io';

import 'package:kitchenapp/core/api/ai_assistant_endpoints.dart';
import 'package:kitchenapp/core/api/analytics_reporting_endpoints.dart';
import 'package:kitchenapp/core/api/audit_compliance_endpoints.dart';
import 'package:kitchenapp/core/api/backup_recovery_endpoints.dart';
import 'package:kitchenapp/core/api/bakery_dessert_endpoints.dart';
import 'package:kitchenapp/core/api/banquet_endpoints.dart';
import 'package:kitchenapp/core/api/bar_beverage_endpoints.dart';
import 'package:kitchenapp/core/api/batch_cooking_endpoints.dart';
import 'package:kitchenapp/core/api/cleaning_hygiene_endpoints.dart';
import 'package:kitchenapp/core/api/cloud_kitchen_endpoints.dart';
import 'package:kitchenapp/core/api/course_firing_endpoints.dart';
import 'package:kitchenapp/core/api/customer_return_endpoints.dart';
import 'package:kitchenapp/core/api/delay_escalation_endpoints.dart';
import 'package:kitchenapp/core/api/delivery_aggregator_endpoints.dart';
import 'package:kitchenapp/core/api/equipment_endpoints.dart';
import 'package:kitchenapp/core/api/expeditor_endpoints.dart';
import 'package:kitchenapp/core/api/future_ai_expansion_endpoints.dart';
import 'package:kitchenapp/core/api/hardware_integration_endpoints.dart';
import 'package:kitchenapp/core/api/hidden_enterprise_endpoints.dart';
import 'package:kitchenapp/core/api/inventory_endpoints.dart';
import 'package:kitchenapp/core/api/iot_device_endpoints.dart';
import 'package:kitchenapp/core/api/kitchen_communication_endpoints.dart';
import 'package:kitchenapp/core/api/kitchen_heatmap_endpoints.dart';
import 'package:kitchenapp/core/api/modifier_endpoints.dart';
import 'package:kitchenapp/core/api/multi_branch_endpoints.dart';
import 'package:kitchenapp/core/api/offline_failover_endpoints.dart';
import 'package:kitchenapp/core/api/order_priority_endpoints.dart';
import 'package:kitchenapp/core/api/packing_endpoints.dart';
import 'package:kitchenapp/core/api/panic_emergency_endpoints.dart';
import 'package:kitchenapp/core/api/prep_endpoints.dart';
import 'package:kitchenapp/core/api/prep_station_endpoints.dart';
import 'package:kitchenapp/core/api/quality_control_endpoints.dart';
import 'package:kitchenapp/core/api/recipe_costing_endpoints.dart';
import 'package:kitchenapp/core/api/room_service_endpoints.dart';
import 'package:kitchenapp/core/api/sandbox_training_endpoints.dart';
import 'package:kitchenapp/core/api/staff_performance_endpoints.dart';
import 'package:kitchenapp/core/api/staff_shift_endpoints.dart';
import 'package:kitchenapp/core/api/smart_energy_endpoints.dart';
import 'package:kitchenapp/core/api/smartwatch_support_endpoints.dart';
import 'package:kitchenapp/core/api/staff_wellness_endpoints.dart';
import 'package:kitchenapp/core/api/waiter_auto_assignment_endpoints.dart';
import 'package:kitchenapp/data/mock/mock_ai_assistant_engine.dart';
import 'package:kitchenapp/data/mock/mock_analytics_reporting_engine.dart';
import 'package:kitchenapp/data/mock/mock_audit_compliance_engine.dart';
import 'package:kitchenapp/data/mock/mock_backup_recovery_engine.dart';
import 'package:kitchenapp/data/mock/mock_bakery_dessert_engine.dart';
import 'package:kitchenapp/data/mock/mock_banquet_engine.dart';
import 'package:kitchenapp/data/mock/mock_bar_beverage_engine.dart';
import 'package:kitchenapp/data/mock/mock_batch_cooking_engine.dart';
import 'package:kitchenapp/data/mock/mock_cleaning_hygiene_engine.dart';
import 'package:kitchenapp/data/mock/mock_cloud_kitchen_engine.dart';
import 'package:kitchenapp/data/mock/mock_course_firing_engine.dart';
import 'package:kitchenapp/data/mock/mock_customer_return_engine.dart';
import 'package:kitchenapp/data/mock/mock_delay_escalation_engine.dart';
import 'package:kitchenapp/data/mock/mock_delivery_aggregator_engine.dart';
import 'package:kitchenapp/data/mock/mock_equipment_engine.dart';
import 'package:kitchenapp/data/mock/mock_expeditor_engine.dart';
import 'package:kitchenapp/data/mock/mock_future_ai_expansion_engine.dart';
import 'package:kitchenapp/data/mock/mock_hardware_integration_engine.dart';
import 'package:kitchenapp/data/mock/mock_hidden_enterprise_engine.dart';
import 'package:kitchenapp/data/mock/mock_inventory_engine.dart';
import 'package:kitchenapp/data/mock/mock_iot_device_engine.dart';
import 'package:kitchenapp/data/mock/mock_kitchen_communication_engine.dart';
import 'package:kitchenapp/data/mock/mock_kitchen_heatmap_engine.dart';
import 'package:kitchenapp/data/mock/mock_modifier_engine.dart';
import 'package:kitchenapp/data/mock/mock_multi_branch_engine.dart';
import 'package:kitchenapp/data/mock/mock_offline_failover_engine.dart';
import 'package:kitchenapp/data/mock/mock_order_priority_engine.dart';
import 'package:kitchenapp/data/mock/mock_packing_engine.dart';
import 'package:kitchenapp/data/mock/mock_panic_emergency_engine.dart';
import 'package:kitchenapp/data/mock/mock_prep_engine.dart';
import 'package:kitchenapp/data/mock/mock_prep_station_engine.dart';
import 'package:kitchenapp/data/mock/mock_quality_control_engine.dart';
import 'package:kitchenapp/data/mock/mock_recipe_costing_engine.dart';
import 'package:kitchenapp/data/mock/mock_room_service_engine.dart';
import 'package:kitchenapp/data/mock/mock_sandbox_training_engine.dart';
import 'package:kitchenapp/data/mock/mock_section_engine.dart';
import 'package:kitchenapp/data/mock/mock_staff_performance_engine.dart';
import 'package:kitchenapp/data/mock/mock_staff_shift_engine.dart';
import 'package:kitchenapp/data/mock/mock_smart_energy_engine.dart';
import 'package:kitchenapp/data/mock/mock_smartwatch_support_engine.dart';
import 'package:kitchenapp/data/mock/mock_staff_wellness_engine.dart';
import 'package:kitchenapp/data/mock/mock_waiter_auto_assignment_engine.dart';

void main() {
  const section = 'All';
  final outDir = Directory(
    '../artifacts/api-server/src/lib/mobile-kitchen/fixtures',
  );
  outDir.createSync(recursive: true);

  final entries = <String, Map<String, dynamic>>{
    '/sections/overview': MockSectionEngine.buildOverview(filterSection: section),
    CourseFiringEndpoints.sessions: MockCourseFiringEngine.buildSnapshot(section: section),
    PrepEndpoints.board: MockPrepEngine.buildSnapshot(section: section),
    ModifierEndpoints.board: MockModifierEngine.buildSnapshot(section: section),
   // AllergySafetyEndpoints.board: MockAllergySafetyEngine.buildSnapshot(section: section),
   // ChefTaskEndpoints.board: MockChefTaskEngine.buildSnapshot(section: section),
    AiAssistantEndpoints.assistant: MockAiAssistantEngine.buildSnapshot(section: section),
    OrderPriorityEndpoints.board: MockOrderPriorityEngine.buildSnapshot(section: section),
    KitchenCommunicationEndpoints.board: MockKitchenCommunicationEngine.buildSnapshot(section: section),
    InventoryEndpoints.board: MockInventoryEngine.buildSnapshot(section: section),
    RecipeCostingEndpoints.board: MockRecipeCostingEngine.buildSnapshot(section: section),
    PrepStationEndpoints.board: MockPrepStationEngine.buildSnapshot(section: section),
    BatchCookingEndpoints.board: MockBatchCookingEngine.buildSnapshot(section: section),
    DelayEscalationEndpoints.board: MockDelayEscalationEngine.buildSnapshot(section: section),
    QualityControlEndpoints.board: MockQualityControlEngine.buildSnapshot(section: section),
    CustomerReturnEndpoints.board: MockCustomerReturnEngine.buildSnapshot(section: section),
    ExpeditorEndpoints.board: MockExpeditorEngine.buildSnapshot(section: section),
    PackingEndpoints.board: MockPackingEngine.buildSnapshot(section: section),
    DeliveryAggregatorEndpoints.board: MockDeliveryAggregatorEngine.buildSnapshot(section: section),
    BarBeverageEndpoints.board: MockBarBeverageEngine.buildSnapshot(section: section),
    BakeryDessertEndpoints.board: MockBakeryDessertEngine.buildSnapshot(section: section),
    CloudKitchenEndpoints.board: MockCloudKitchenEngine.buildSnapshot(section: section),
    BanquetEndpoints.board: MockBanquetEngine.buildSnapshot(section: section),
    RoomServiceEndpoints.board: MockRoomServiceEngine.buildSnapshot(section: section),
    CleaningHygieneEndpoints.board: MockCleaningHygieneEngine.buildSnapshot(section: section),
    EquipmentEndpoints.board: MockEquipmentEngine.buildSnapshot(section: section),
    SmartEnergyEndpoints.board: MockSmartEnergyEngine.buildSnapshot(section: section),
    IotDeviceEndpoints.board: MockIotDeviceEngine.buildSnapshot(section: section),
    StaffPerformanceEndpoints.board: MockStaffPerformanceEngine.buildSnapshot(section: section),
    StaffShiftEndpoints.board: MockStaffShiftEngine.buildSnapshot(section: section),
    StaffWellnessEndpoints.board: MockStaffWellnessEngine.buildSnapshot(section: section),
    PanicEmergencyEndpoints.board: MockPanicEmergencyEngine.buildSnapshot(section: section),
    OfflineFailoverEndpoints.board: MockOfflineFailoverEngine.buildSnapshot(section: section),
    AnalyticsReportingEndpoints.board: MockAnalyticsReportingEngine.buildSnapshot(section: section),
    KitchenHeatmapEndpoints.board: MockKitchenHeatmapEngine.buildSnapshot(section: section),
    HardwareIntegrationEndpoints.board: MockHardwareIntegrationEngine.buildSnapshot(section: section),
    SmartwatchSupportEndpoints.board: MockSmartwatchSupportEngine.buildSnapshot(section: section),
    MultiBranchEndpoints.board: MockMultiBranchEngine.buildSnapshot(section: section),
    AuditComplianceEndpoints.board: MockAuditComplianceEngine.buildSnapshot(section: section),
    BackupRecoveryEndpoints.board: MockBackupRecoveryEngine.buildSnapshot(section: section),
    SandboxTrainingEndpoints.board: MockSandboxTrainingEngine.buildSnapshot(section: section),
    HiddenEnterpriseEndpoints.board: MockHiddenEnterpriseEngine.buildSnapshot(section: section),
    FutureAiExpansionEndpoints.board: MockFutureAiExpansionEngine.buildSnapshot(section: section),
    WaiterAutoAssignmentEndpoints.board: MockWaiterAutoAssignmentEngine.buildSnapshot(section: section),
  };

  final index = <String, String>{};
  for (final entry in entries.entries) {
    final path = entry.key.replaceAll('/', '_').replaceAll(':', '');
    final fileName = path.startsWith('_') ? path.substring(1) : path;
    final safeName = fileName.isEmpty ? 'root' : fileName;
    final file = File('${outDir.path}/$safeName.json');
    final payload = entry.value.containsKey('data') ? entry.value : {'data': entry.value};
    file.writeAsStringSync(const JsonEncoder.withIndent('  ').convert(payload));
    index[entry.key] = '$safeName.json';
    print('Wrote ${file.path}');
  }

  File('${outDir.path}/index.json').writeAsStringSync(
    const JsonEncoder.withIndent('  ').convert(index),
  );
  print('Done: ${entries.length} fixtures');
}
