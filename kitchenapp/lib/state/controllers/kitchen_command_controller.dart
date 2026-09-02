import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/api/api_exception.dart';
import '../../models/dashboard/dashboard_snapshot.dart';
import '../../models/kds/kds_snapshot.dart';
import '../../models/kds/kds_view_mode.dart';
import '../../models/kitchen_order.dart';
import '../../models/firing/course_firing_snapshot.dart';
import '../../models/modifiers/modifier_snapshot.dart';
import '../../models/prep/prep_snapshot.dart';
import '../../models/processing/processing_snapshot.dart';
import '../../models/sections/section_overview_snapshot.dart';
import '../../models/sections/section_routing.dart';
import '../../services/course_firing_service.dart';
import '../../models/ai/ai_assistant_snapshot.dart';
import '../../models/chef_tasks/chef_task_snapshot.dart';
import '../../models/safety/allergy_safety_snapshot.dart';
import '../../services/ai_assistant_service.dart';
import '../../services/chef_task_service.dart';
import '../../services/allergy_safety_service.dart';
import '../../services/modifier_service.dart';
import '../../services/prep_service.dart';
import '../../services/dashboard_service.dart';
import '../../services/kds_service.dart';
import '../../services/order_processing_service.dart';
import '../../models/priority/order_priority_snapshot.dart';
import '../../models/communication/kitchen_communication_snapshot.dart';
import '../../models/inventory/inventory_snapshot.dart';
import '../../services/inventory_service.dart';
import '../../models/recipes/recipe_costing_snapshot.dart';
import '../../models/prep_stations/prep_station_snapshot.dart';
import '../../models/batch_cooking/batch_cooking_snapshot.dart';
import '../../models/delays/delay_escalation_snapshot.dart';
import '../../services/delay_escalation_service.dart';
import '../../models/quality/quality_control_snapshot.dart';
import '../../services/quality_control_service.dart';
import '../../models/returns/customer_return_snapshot.dart';
import '../../services/customer_return_service.dart';
import '../../models/expeditor/expeditor_snapshot.dart';
import '../../services/expeditor_service.dart';
import '../../models/packing/packing_delivery_snapshot.dart';
import '../../services/packing_service.dart';
import '../../models/aggregator/delivery_aggregator_snapshot.dart';
import '../../services/delivery_aggregator_service.dart';
import '../../models/bar/bar_beverage_snapshot.dart';
import '../../services/bar_beverage_service.dart';
import '../../models/bakery/bakery_dessert_snapshot.dart';
import '../../services/bakery_dessert_service.dart';
import '../../models/cloud_kitchen/cloud_kitchen_snapshot.dart';
import '../../services/cloud_kitchen_service.dart';
import '../../models/banquet/banquet_snapshot.dart';
import '../../services/banquet_service.dart';
import '../../models/room_service/room_service_snapshot.dart';
import '../../services/room_service_service.dart';
import '../../models/hygiene/cleaning_hygiene_snapshot.dart';
import '../../services/cleaning_hygiene_service.dart';
import '../../models/equipment/equipment_snapshot.dart';
import '../../services/equipment_service.dart';
import '../../models/energy/smart_energy_snapshot.dart';
import '../../services/smart_energy_service.dart';
import '../../models/iot/iot_device_snapshot.dart';
import '../../services/iot_device_service.dart';
import '../../models/staff_performance/staff_performance_snapshot.dart';
import '../../services/staff_performance_service.dart';
import '../../models/staff_shift/staff_shift_snapshot.dart';
import '../../services/staff_shift_service.dart';
import '../../models/staff_wellness/staff_wellness_snapshot.dart';
import '../../services/staff_wellness_service.dart';
import '../../models/live_alerts/live_alert_snapshot.dart';
import '../../services/live_alert_service.dart';
import '../../models/panic_emergency/panic_emergency_snapshot.dart';
import '../../services/panic_emergency_service.dart';
import '../../models/offline_failover/offline_failover_snapshot.dart';
import '../../services/offline_failover_service.dart';
import '../../models/analytics_reporting/analytics_reporting_snapshot.dart';
import '../../services/analytics_reporting_service.dart';
import '../../models/kitchen_heatmap/kitchen_heatmap_snapshot.dart';
import '../../services/kitchen_heatmap_service.dart';
import '../../models/hardware_integration/hardware_integration_snapshot.dart';
import '../../services/hardware_integration_service.dart';
import '../../models/smartwatch_support/smartwatch_support_snapshot.dart';
import '../../services/smartwatch_support_service.dart';
import '../../models/multi_branch/multi_branch_snapshot.dart';
import '../../services/multi_branch_service.dart';
import '../../models/audit_compliance/audit_compliance_snapshot.dart';
import '../../services/audit_compliance_service.dart';
import '../../models/backup_recovery/backup_recovery_snapshot.dart';
import '../../services/backup_recovery_service.dart';
import '../../models/sandbox_training/sandbox_training_snapshot.dart';
import '../../services/sandbox_training_service.dart';
import '../../models/hidden_enterprise/hidden_enterprise_snapshot.dart';
import '../../services/hidden_enterprise_service.dart';
import '../../models/future_ai_expansion/future_ai_expansion_snapshot.dart';
import '../../models/waiter/waiter_assignment_snapshot.dart';
import '../../services/waiter_auto_assignment_service.dart';
import '../../services/future_ai_expansion_service.dart';
import '../../services/batch_cooking_service.dart';
import '../../services/prep_station_service.dart';
import '../../services/recipe_costing_service.dart';
import '../../services/kitchen_communication_service.dart';
import '../../services/order_priority_service.dart';
import '../../services/section_service.dart';
import 'auth_controller.dart';

class KitchenCommandController extends ChangeNotifier {
  KitchenCommandController({required AuthController auth})
      : _auth = auth,
        _dashboardService = DashboardService.fromAuth(auth.authService),
        _kdsService = KdsService.fromAuth(auth.authService),
        _sectionService = SectionService.fromAuth(auth.authService),
        _processingService = OrderProcessingService.fromAuth(auth.authService),
        _firingService = CourseFiringService.fromAuth(auth.authService),
        _prepService = PrepService.fromAuth(auth.authService),
        _modifierService = ModifierService.fromAuth(auth.authService),
        _safetyService = AllergySafetyService.fromAuth(auth.authService),
        _chefTaskService = ChefTaskService.fromAuth(auth.authService),
        _aiAssistantService = AiAssistantService.fromAuth(auth.authService),
        _orderPriorityService = OrderPriorityService.fromAuth(auth.authService),
        _communicationService =
            KitchenCommunicationService.fromAuth(auth.authService),
        _inventoryService = InventoryService.fromAuth(auth.authService),
        _recipeCostingService = RecipeCostingService.fromAuth(auth.authService),
        _prepStationService = PrepStationService.fromAuth(auth.authService),
        _batchCookingService = BatchCookingService.fromAuth(auth.authService),
        _delayEscalationService =
            DelayEscalationService.fromAuth(auth.authService),
        _qualityControlService =
            QualityControlService.fromAuth(auth.authService),
        _customerReturnService =
            CustomerReturnService.fromAuth(auth.authService),
        _expeditorService = ExpeditorService.fromAuth(auth.authService),
        _packingService = PackingService.fromAuth(auth.authService),
        _deliveryAggregatorService =
            DeliveryAggregatorService.fromAuth(auth.authService),
        _barBeverageService = BarBeverageService.fromAuth(auth.authService),
        _bakeryDessertService = BakeryDessertService.fromAuth(auth.authService),
        _cloudKitchenService = CloudKitchenService.fromAuth(auth.authService),
        _banquetService = BanquetService.fromAuth(auth.authService),
        _roomServiceService = RoomServiceService.fromAuth(auth.authService),
        _cleaningHygieneService =
            CleaningHygieneService.fromAuth(auth.authService),
        _equipmentService = EquipmentService.fromAuth(auth.authService),
        _smartEnergyService = SmartEnergyService.fromAuth(auth.authService),
        _iotDeviceService = IotDeviceService.fromAuth(auth.authService),
        _staffPerformanceService =
            StaffPerformanceService.fromAuth(auth.authService),
        _staffShiftService = StaffShiftService.fromAuth(auth.authService),
        _staffWellnessService = StaffWellnessService.fromAuth(auth.authService),
        _liveAlertService = LiveAlertService.fromAuth(auth.authService),
        _panicEmergencyService =
            PanicEmergencyService.fromAuth(auth.authService),
        _offlineFailoverService =
            OfflineFailoverService.fromAuth(auth.authService),
        _analyticsReportingService =
            AnalyticsReportingService.fromAuth(auth.authService),
        _kitchenHeatmapService =
            KitchenHeatmapService.fromAuth(auth.authService),
        _hardwareIntegrationService =
            HardwareIntegrationService.fromAuth(auth.authService),
        _smartwatchSupportService =
            SmartwatchSupportService.fromAuth(auth.authService),
        _multiBranchService = MultiBranchService.fromAuth(auth.authService),
        _auditComplianceService =
            AuditComplianceService.fromAuth(auth.authService),
        _backupRecoveryService =
            BackupRecoveryService.fromAuth(auth.authService),
        _sandboxTrainingService =
            SandboxTrainingService.fromAuth(auth.authService),
        _hiddenEnterpriseService =
            HiddenEnterpriseService.fromAuth(auth.authService),
        _futureAiExpansionService =
            FutureAiExpansionService.fromAuth(auth.authService),
        _waiterAutoAssignmentService =
            WaiterAutoAssignmentService.fromAuth(auth.authService);

  final AuthController _auth;
  final DashboardService _dashboardService;
  final KdsService _kdsService;
  final SectionService _sectionService;
  final OrderProcessingService _processingService;
  final CourseFiringService _firingService;
  final PrepService _prepService;
  final ModifierService _modifierService;
  final AllergySafetyService _safetyService;
  final ChefTaskService _chefTaskService;
  final AiAssistantService _aiAssistantService;
  final OrderPriorityService _orderPriorityService;
  final KitchenCommunicationService _communicationService;
  final InventoryService _inventoryService;
  final RecipeCostingService _recipeCostingService;
  final PrepStationService _prepStationService;
  final BatchCookingService _batchCookingService;
  final DelayEscalationService _delayEscalationService;
  final QualityControlService _qualityControlService;
  final CustomerReturnService _customerReturnService;
  final ExpeditorService _expeditorService;
  final PackingService _packingService;
  final DeliveryAggregatorService _deliveryAggregatorService;
  final BarBeverageService _barBeverageService;
  final BakeryDessertService _bakeryDessertService;
  final CloudKitchenService _cloudKitchenService;
  final BanquetService _banquetService;
  final RoomServiceService _roomServiceService;
  final CleaningHygieneService _cleaningHygieneService;
  final EquipmentService _equipmentService;
  final SmartEnergyService _smartEnergyService;
  final IotDeviceService _iotDeviceService;
  final StaffPerformanceService _staffPerformanceService;
  final StaffShiftService _staffShiftService;
  final StaffWellnessService _staffWellnessService;
  final LiveAlertService _liveAlertService;
  final PanicEmergencyService _panicEmergencyService;
  final OfflineFailoverService _offlineFailoverService;
  final AnalyticsReportingService _analyticsReportingService;
  final KitchenHeatmapService _kitchenHeatmapService;
  final HardwareIntegrationService _hardwareIntegrationService;
  final SmartwatchSupportService _smartwatchSupportService;
  final MultiBranchService _multiBranchService;
  final AuditComplianceService _auditComplianceService;
  final BackupRecoveryService _backupRecoveryService;
  final SandboxTrainingService _sandboxTrainingService;
  final HiddenEnterpriseService _hiddenEnterpriseService;
  final FutureAiExpansionService _futureAiExpansionService;
  final WaiterAutoAssignmentService _waiterAutoAssignmentService;

  int _selectedNav = 0;
  String _selectedSection = 'All';
  DashboardSnapshot? _dashboard;
  KdsSnapshot? _kds;
  SectionManagementSnapshot? _sectionManagement;
  ProcessingSnapshot? _processing;
  CourseFiringSnapshot? _courseFiring;
  PrepSnapshot? _prepBoard;
  ModifierSnapshot? _modifierBoard;
  AllergySafetySnapshot? _allergySafety;
  ChefTaskSnapshot? _chefTasks;
  AiAssistantSnapshot? _aiAssistant;
  OrderPrioritySnapshot? _orderPriority;
  KitchenCommunicationSnapshot? _kitchenCommunication;
  InventorySnapshot? _inventory;
  RecipeCostingSnapshot? _recipeCosting;
  PrepStationSnapshot? _prepStations;
  BatchCookingSnapshot? _batchCooking;
  DelayEscalationSnapshot? _delayEscalation;
  QualityControlSnapshot? _qualityControl;
  CustomerReturnSnapshot? _customerReturn;
  ExpeditorSnapshot? _expeditor;
  PackingDeliverySnapshot? _packing;
  DeliveryAggregatorSnapshot? _deliveryAggregator;
  BarBeverageSnapshot? _barBeverage;
  BakeryDessertSnapshot? _bakeryDessert;
  CloudKitchenSnapshot? _cloudKitchen;
  BanquetSnapshot? _banquet;
  RoomServiceSnapshot? _roomService;
  CleaningHygieneSnapshot? _cleaningHygiene;
  EquipmentSnapshot? _equipment;
  SmartEnergySnapshot? _smartEnergy;
  IotDeviceSnapshot? _iotDevice;
  StaffPerformanceSnapshot? _staffPerformance;
  StaffShiftSnapshot? _staffShift;
  StaffWellnessSnapshot? _staffWellness;
  LiveAlertSnapshot? _liveAlerts;
  PanicEmergencySnapshot? _panicEmergency;
  OfflineFailoverSnapshot? _offlineFailover;
  AnalyticsReportingSnapshot? _analyticsReporting;
  KitchenHeatmapSnapshot? _kitchenHeatmap;
  HardwareIntegrationSnapshot? _hardwareIntegration;
  SmartwatchSupportSnapshot? _smartwatchSupport;
  MultiBranchSnapshot? _multiBranch;
  AuditComplianceSnapshot? _auditCompliance;
  BackupRecoverySnapshot? _backupRecovery;
  SandboxTrainingSnapshot? _sandboxTraining;
  HiddenEnterpriseSnapshot? _hiddenEnterprise;
  FutureAiExpansionSnapshot? _futureAiExpansion;
  WaiterAssignmentSnapshot? _waiterAutoAssignment;
  KdsViewMode _kdsViewMode = KdsViewMode.queue;
  KdsFilter _kdsFilter = KdsFilter.all;
  bool _loading = false;
  bool _kdsLoading = false;
  bool _sectionsLoading = false;
  bool _processingLoading = false;
  bool _firingLoading = false;
  bool _prepLoading = false;
  bool _modifierLoading = false;
  bool _safetyLoading = false;
  bool _chefTaskLoading = false;
  bool _aiLoading = false;
  bool _priorityLoading = false;
  bool _communicationLoading = false;
  bool _inventoryLoading = false;
  bool _recipeCostingLoading = false;
  bool _prepStationLoading = false;
  bool _batchCookingLoading = false;
  bool _delayEscalationLoading = false;
  bool _qualityControlLoading = false;
  bool _customerReturnLoading = false;
  bool _expeditorLoading = false;
  bool _packingLoading = false;
  bool _deliveryAggregatorLoading = false;
  bool _barBeverageLoading = false;
  bool _bakeryDessertLoading = false;
  bool _cloudKitchenLoading = false;
  bool _banquetLoading = false;
  bool _roomServiceLoading = false;
  bool _cleaningHygieneLoading = false;
  bool _equipmentLoading = false;
  bool _smartEnergyLoading = false;
  bool _iotDeviceLoading = false;
  bool _staffPerformanceLoading = false;
  bool _staffShiftLoading = false;
  bool _staffWellnessLoading = false;
  bool _liveAlertLoading = false;
  bool _panicEmergencyLoading = false;
  bool _offlineFailoverLoading = false;
  bool _analyticsReportingLoading = false;
  bool _kitchenHeatmapLoading = false;
  bool _hardwareIntegrationLoading = false;
  bool _smartwatchSupportLoading = false;
  bool _multiBranchLoading = false;
  bool _auditComplianceLoading = false;
  bool _backupRecoveryLoading = false;
  bool _sandboxTrainingLoading = false;
  bool _hiddenEnterpriseLoading = false;
  bool _futureAiExpansionLoading = false;
  bool _waiterAutoAssignmentLoading = false;
  bool _refreshing = false;
  String? _errorMessage;
  String? _kdsErrorMessage;
  String? _sectionsErrorMessage;
  String? _sectionsActionMessage;
  String? _processingErrorMessage;
  String? _processingActionMessage;
  String? _firingErrorMessage;
  String? _firingActionMessage;
  String? _prepErrorMessage;
  String? _prepActionMessage;
  String? _modifierErrorMessage;
  String? _modifierActionMessage;
  String? _safetyErrorMessage;
  String? _safetyActionMessage;
  String? _chefTaskErrorMessage;
  String? _chefTaskActionMessage;
  String? _aiErrorMessage;
  String? _aiActionMessage;
  String? _priorityErrorMessage;
  String? _priorityActionMessage;
  String? _communicationErrorMessage;
  String? _communicationActionMessage;
  String? _inventoryErrorMessage;
  String? _inventoryActionMessage;
  String? _recipeCostingErrorMessage;
  String? _recipeCostingActionMessage;
  String? _prepStationErrorMessage;
  String? _prepStationActionMessage;
  String? _batchCookingErrorMessage;
  String? _batchCookingActionMessage;
  String? _delayEscalationErrorMessage;
  String? _delayEscalationActionMessage;
  String? _qualityControlErrorMessage;
  String? _qualityControlActionMessage;
  String? _customerReturnErrorMessage;
  String? _customerReturnActionMessage;
  String? _expeditorErrorMessage;
  String? _expeditorActionMessage;
  String? _packingErrorMessage;
  String? _packingActionMessage;
  String? _deliveryAggregatorErrorMessage;
  String? _deliveryAggregatorActionMessage;
  String? _barBeverageErrorMessage;
  String? _barBeverageActionMessage;
  String? _bakeryDessertErrorMessage;
  String? _bakeryDessertActionMessage;
  String? _cloudKitchenErrorMessage;
  String? _cloudKitchenActionMessage;
  String? _banquetErrorMessage;
  String? _banquetActionMessage;
  String? _roomServiceErrorMessage;
  String? _roomServiceActionMessage;
  String? _cleaningHygieneErrorMessage;
  String? _cleaningHygieneActionMessage;
  String? _equipmentErrorMessage;
  String? _equipmentActionMessage;
  String? _smartEnergyErrorMessage;
  String? _smartEnergyActionMessage;
  String? _iotDeviceErrorMessage;
  String? _iotDeviceActionMessage;
  String? _staffPerformanceErrorMessage;
  String? _staffPerformanceActionMessage;
  String? _staffShiftErrorMessage;
  String? _staffShiftActionMessage;
  String? _staffWellnessErrorMessage;
  String? _staffWellnessActionMessage;
  String? _liveAlertErrorMessage;
  String? _liveAlertActionMessage;
  String? _panicEmergencyErrorMessage;
  String? _panicEmergencyActionMessage;
  String? _offlineFailoverErrorMessage;
  String? _offlineFailoverActionMessage;
  String? _analyticsReportingErrorMessage;
  String? _analyticsReportingActionMessage;
  String? _kitchenHeatmapErrorMessage;
  String? _kitchenHeatmapActionMessage;
  String? _hardwareIntegrationErrorMessage;
  String? _hardwareIntegrationActionMessage;
  String? _smartwatchSupportErrorMessage;
  String? _smartwatchSupportActionMessage;
  String? _multiBranchErrorMessage;
  String? _multiBranchActionMessage;
  String? _auditComplianceErrorMessage;
  String? _auditComplianceActionMessage;
  String? _backupRecoveryErrorMessage;
  String? _backupRecoveryActionMessage;
  String? _sandboxTrainingErrorMessage;
  String? _sandboxTrainingActionMessage;
  String? _hiddenEnterpriseErrorMessage;
  String? _hiddenEnterpriseActionMessage;
  String? _futureAiExpansionErrorMessage;
  String? _futureAiExpansionActionMessage;
  String? _waiterAutoAssignmentErrorMessage;
  String? _waiterAutoAssignmentActionMessage;
  Timer? _pollTimer;
  Timer? _kdsTimer;

  int get selectedNav => _selectedNav;
  String get selectedSection => _selectedSection;
  DashboardSnapshot? get dashboard => _dashboard;
  KdsSnapshot? get kds => _kds;
  SectionManagementSnapshot? get sectionManagement => _sectionManagement;
  ProcessingSnapshot? get processing => _processing;
  CourseFiringSnapshot? get courseFiring => _courseFiring;
  PrepSnapshot? get prepBoard => _prepBoard;
  ModifierSnapshot? get modifierBoard => _modifierBoard;
  AllergySafetySnapshot? get allergySafety => _allergySafety;
  ChefTaskSnapshot? get chefTasks => _chefTasks;
  AiAssistantSnapshot? get aiAssistant => _aiAssistant;
  OrderPrioritySnapshot? get orderPriority => _orderPriority;
  KitchenCommunicationSnapshot? get kitchenCommunication => _kitchenCommunication;
  InventorySnapshot? get inventory => _inventory;
  RecipeCostingSnapshot? get recipeCosting => _recipeCosting;
  PrepStationSnapshot? get prepStations => _prepStations;
  BatchCookingSnapshot? get batchCooking => _batchCooking;
  DelayEscalationSnapshot? get delayEscalation => _delayEscalation;
  QualityControlSnapshot? get qualityControl => _qualityControl;
  CustomerReturnSnapshot? get customerReturn => _customerReturn;
  ExpeditorSnapshot? get expeditor => _expeditor;
  PackingDeliverySnapshot? get packing => _packing;
  DeliveryAggregatorSnapshot? get deliveryAggregator => _deliveryAggregator;
  BarBeverageSnapshot? get barBeverage => _barBeverage;
  BakeryDessertSnapshot? get bakeryDessert => _bakeryDessert;
  CloudKitchenSnapshot? get cloudKitchen => _cloudKitchen;
  BanquetSnapshot? get banquet => _banquet;
  RoomServiceSnapshot? get roomService => _roomService;
  CleaningHygieneSnapshot? get cleaningHygiene => _cleaningHygiene;
  EquipmentSnapshot? get equipment => _equipment;
  SmartEnergySnapshot? get smartEnergy => _smartEnergy;
  IotDeviceSnapshot? get iotDevice => _iotDevice;
  StaffPerformanceSnapshot? get staffPerformance => _staffPerformance;
  StaffShiftSnapshot? get staffShift => _staffShift;
  StaffWellnessSnapshot? get staffWellness => _staffWellness;
  LiveAlertSnapshot? get liveAlerts => _liveAlerts;
  PanicEmergencySnapshot? get panicEmergency => _panicEmergency;
  OfflineFailoverSnapshot? get offlineFailover => _offlineFailover;
  AnalyticsReportingSnapshot? get analyticsReporting => _analyticsReporting;
  KitchenHeatmapSnapshot? get kitchenHeatmap => _kitchenHeatmap;
  HardwareIntegrationSnapshot? get hardwareIntegration => _hardwareIntegration;
  SmartwatchSupportSnapshot? get smartwatchSupport => _smartwatchSupport;
  MultiBranchSnapshot? get multiBranch => _multiBranch;
  AuditComplianceSnapshot? get auditCompliance => _auditCompliance;
  BackupRecoverySnapshot? get backupRecovery => _backupRecovery;
  SandboxTrainingSnapshot? get sandboxTraining => _sandboxTraining;
  HiddenEnterpriseSnapshot? get hiddenEnterprise => _hiddenEnterprise;
  FutureAiExpansionSnapshot? get futureAiExpansion => _futureAiExpansion;
  WaiterAssignmentSnapshot? get waiterAutoAssignment => _waiterAutoAssignment;
  KdsViewMode get kdsViewMode => _kdsViewMode;
  KdsFilter get kdsFilter => _kdsFilter;
  bool get loading => _loading;
  bool get kdsLoading => _kdsLoading;
  bool get sectionsLoading => _sectionsLoading;
  bool get processingLoading => _processingLoading;
  bool get firingLoading => _firingLoading;
  bool get prepLoading => _prepLoading;
  bool get modifierLoading => _modifierLoading;
  bool get safetyLoading => _safetyLoading;
  bool get chefTaskLoading => _chefTaskLoading;
  bool get aiLoading => _aiLoading;
  bool get priorityLoading => _priorityLoading;
  bool get communicationLoading => _communicationLoading;
  bool get inventoryLoading => _inventoryLoading;
  bool get recipeCostingLoading => _recipeCostingLoading;
  bool get prepStationLoading => _prepStationLoading;
  bool get batchCookingLoading => _batchCookingLoading;
  bool get delayEscalationLoading => _delayEscalationLoading;
  bool get qualityControlLoading => _qualityControlLoading;
  bool get customerReturnLoading => _customerReturnLoading;
  bool get expeditorLoading => _expeditorLoading;
  bool get packingLoading => _packingLoading;
  bool get deliveryAggregatorLoading => _deliveryAggregatorLoading;
  bool get barBeverageLoading => _barBeverageLoading;
  bool get bakeryDessertLoading => _bakeryDessertLoading;
  bool get cloudKitchenLoading => _cloudKitchenLoading;
  bool get banquetLoading => _banquetLoading;
  bool get roomServiceLoading => _roomServiceLoading;
  bool get cleaningHygieneLoading => _cleaningHygieneLoading;
  bool get equipmentLoading => _equipmentLoading;
  bool get smartEnergyLoading => _smartEnergyLoading;
  bool get iotDeviceLoading => _iotDeviceLoading;
  bool get staffPerformanceLoading => _staffPerformanceLoading;
  bool get staffShiftLoading => _staffShiftLoading;
  bool get staffWellnessLoading => _staffWellnessLoading;
  bool get liveAlertLoading => _liveAlertLoading;
  bool get panicEmergencyLoading => _panicEmergencyLoading;
  bool get offlineFailoverLoading => _offlineFailoverLoading;
  bool get analyticsReportingLoading => _analyticsReportingLoading;
  bool get kitchenHeatmapLoading => _kitchenHeatmapLoading;
  bool get hardwareIntegrationLoading => _hardwareIntegrationLoading;
  bool get smartwatchSupportLoading => _smartwatchSupportLoading;
  bool get multiBranchLoading => _multiBranchLoading;
  bool get auditComplianceLoading => _auditComplianceLoading;
  bool get backupRecoveryLoading => _backupRecoveryLoading;
  bool get sandboxTrainingLoading => _sandboxTrainingLoading;
  bool get hiddenEnterpriseLoading => _hiddenEnterpriseLoading;
  bool get futureAiExpansionLoading => _futureAiExpansionLoading;
  bool get waiterAutoAssignmentLoading => _waiterAutoAssignmentLoading;
  bool get refreshing => _refreshing;
  String? get errorMessage => _errorMessage;
  String? get kdsErrorMessage => _kdsErrorMessage;
  String? get sectionsErrorMessage => _sectionsErrorMessage;
  String? get sectionsActionMessage => _sectionsActionMessage;
  String? get processingErrorMessage => _processingErrorMessage;
  String? get processingActionMessage => _processingActionMessage;
  String? get firingErrorMessage => _firingErrorMessage;
  String? get firingActionMessage => _firingActionMessage;
  String? get prepErrorMessage => _prepErrorMessage;
  String? get prepActionMessage => _prepActionMessage;
  String? get modifierErrorMessage => _modifierErrorMessage;
  String? get modifierActionMessage => _modifierActionMessage;
  String? get safetyErrorMessage => _safetyErrorMessage;
  String? get safetyActionMessage => _safetyActionMessage;
  String? get chefTaskErrorMessage => _chefTaskErrorMessage;
  String? get chefTaskActionMessage => _chefTaskActionMessage;
  String? get aiErrorMessage => _aiErrorMessage;
  String? get aiActionMessage => _aiActionMessage;
  String? get priorityErrorMessage => _priorityErrorMessage;
  String? get priorityActionMessage => _priorityActionMessage;
  String? get communicationErrorMessage => _communicationErrorMessage;
  String? get communicationActionMessage => _communicationActionMessage;
  String? get inventoryErrorMessage => _inventoryErrorMessage;
  String? get inventoryActionMessage => _inventoryActionMessage;
  String? get recipeCostingErrorMessage => _recipeCostingErrorMessage;
  String? get recipeCostingActionMessage => _recipeCostingActionMessage;
  String? get prepStationErrorMessage => _prepStationErrorMessage;
  String? get prepStationActionMessage => _prepStationActionMessage;
  String? get batchCookingErrorMessage => _batchCookingErrorMessage;
  String? get batchCookingActionMessage => _batchCookingActionMessage;
  String? get delayEscalationErrorMessage => _delayEscalationErrorMessage;
  String? get delayEscalationActionMessage => _delayEscalationActionMessage;
  String? get qualityControlErrorMessage => _qualityControlErrorMessage;
  String? get qualityControlActionMessage => _qualityControlActionMessage;
  String? get customerReturnErrorMessage => _customerReturnErrorMessage;
  String? get customerReturnActionMessage => _customerReturnActionMessage;
  String? get expeditorErrorMessage => _expeditorErrorMessage;
  String? get expeditorActionMessage => _expeditorActionMessage;
  String? get packingErrorMessage => _packingErrorMessage;
  String? get packingActionMessage => _packingActionMessage;
  String? get deliveryAggregatorErrorMessage => _deliveryAggregatorErrorMessage;
  String? get deliveryAggregatorActionMessage =>
      _deliveryAggregatorActionMessage;
  String? get barBeverageErrorMessage => _barBeverageErrorMessage;
  String? get barBeverageActionMessage => _barBeverageActionMessage;
  String? get bakeryDessertErrorMessage => _bakeryDessertErrorMessage;
  String? get bakeryDessertActionMessage => _bakeryDessertActionMessage;
  String? get cloudKitchenErrorMessage => _cloudKitchenErrorMessage;
  String? get cloudKitchenActionMessage => _cloudKitchenActionMessage;
  String? get banquetErrorMessage => _banquetErrorMessage;
  String? get banquetActionMessage => _banquetActionMessage;
  String? get roomServiceErrorMessage => _roomServiceErrorMessage;
  String? get roomServiceActionMessage => _roomServiceActionMessage;
  String? get cleaningHygieneErrorMessage => _cleaningHygieneErrorMessage;
  String? get cleaningHygieneActionMessage => _cleaningHygieneActionMessage;
  String? get equipmentErrorMessage => _equipmentErrorMessage;
  String? get equipmentActionMessage => _equipmentActionMessage;
  String? get smartEnergyErrorMessage => _smartEnergyErrorMessage;
  String? get smartEnergyActionMessage => _smartEnergyActionMessage;
  String? get iotDeviceErrorMessage => _iotDeviceErrorMessage;
  String? get iotDeviceActionMessage => _iotDeviceActionMessage;
  String? get staffPerformanceErrorMessage => _staffPerformanceErrorMessage;
  String? get staffPerformanceActionMessage => _staffPerformanceActionMessage;
  String? get staffShiftErrorMessage => _staffShiftErrorMessage;
  String? get staffShiftActionMessage => _staffShiftActionMessage;
  String? get staffWellnessErrorMessage => _staffWellnessErrorMessage;
  String? get staffWellnessActionMessage => _staffWellnessActionMessage;
  String? get liveAlertErrorMessage => _liveAlertErrorMessage;
  String? get liveAlertActionMessage => _liveAlertActionMessage;
  String? get panicEmergencyErrorMessage => _panicEmergencyErrorMessage;
  String? get panicEmergencyActionMessage => _panicEmergencyActionMessage;
  String? get offlineFailoverErrorMessage => _offlineFailoverErrorMessage;
  String? get offlineFailoverActionMessage => _offlineFailoverActionMessage;
  String? get analyticsReportingErrorMessage => _analyticsReportingErrorMessage;
  String? get analyticsReportingActionMessage =>
      _analyticsReportingActionMessage;
  String? get kitchenHeatmapErrorMessage => _kitchenHeatmapErrorMessage;
  String? get kitchenHeatmapActionMessage => _kitchenHeatmapActionMessage;
  String? get hardwareIntegrationErrorMessage =>
      _hardwareIntegrationErrorMessage;
  String? get hardwareIntegrationActionMessage =>
      _hardwareIntegrationActionMessage;
  String? get smartwatchSupportErrorMessage => _smartwatchSupportErrorMessage;
  String? get smartwatchSupportActionMessage =>
      _smartwatchSupportActionMessage;
  String? get multiBranchErrorMessage => _multiBranchErrorMessage;
  String? get multiBranchActionMessage => _multiBranchActionMessage;
  String? get auditComplianceErrorMessage => _auditComplianceErrorMessage;
  String? get auditComplianceActionMessage => _auditComplianceActionMessage;
  String? get backupRecoveryErrorMessage => _backupRecoveryErrorMessage;
  String? get backupRecoveryActionMessage => _backupRecoveryActionMessage;
  String? get sandboxTrainingErrorMessage => _sandboxTrainingErrorMessage;
  String? get sandboxTrainingActionMessage => _sandboxTrainingActionMessage;
  String? get hiddenEnterpriseErrorMessage => _hiddenEnterpriseErrorMessage;
  String? get hiddenEnterpriseActionMessage => _hiddenEnterpriseActionMessage;
  String? get futureAiExpansionErrorMessage => _futureAiExpansionErrorMessage;
  String? get futureAiExpansionActionMessage =>
      _futureAiExpansionActionMessage;
  String? get waiterAutoAssignmentErrorMessage =>
      _waiterAutoAssignmentErrorMessage;
  String? get waiterAutoAssignmentActionMessage =>
      _waiterAutoAssignmentActionMessage;

  List<String> get sections => _dashboard?.sections ?? const ['All'];

  String? headChefForSection(String sectionName) {
    final profiles = _sectionManagement?.overview.sections;
    if (profiles == null) {
      return null;
    }
    for (final profile in profiles) {
      if (profile.name == sectionName) {
        return profile.headChef;
      }
    }
    return null;
  }

  List<KitchenOrder> get visibleOrders => _dashboard?.orders ?? const [];

  DateTime? get lastSyncedAt =>
      _kds?.lastSyncedAt ?? _dashboard?.lastSyncedAt;

  Future<void> bootstrap() async {
    _loading = true;
    notifyListeners();

    Future<void> refreshIfAllowed(int system, Future<void> Function() refresh) {
      if (_auth.canAccessSystem(system)) {
        return refresh();
      }
      return Future<void>.value();
    }

    await Future.wait([
      refreshIfAllowed(2, refreshDashboard),
      refreshIfAllowed(3, refreshKds),
      refreshIfAllowed(4, refreshSections),
      refreshIfAllowed(5, refreshProcessing),
      refreshIfAllowed(6, refreshFiring),
      refreshIfAllowed(7, refreshPrep),
      refreshIfAllowed(8, refreshModifiers),
      refreshIfAllowed(9, refreshSafety),
      refreshIfAllowed(10, refreshChefTasks),
      refreshIfAllowed(11, refreshAiAssistant),
      refreshIfAllowed(12, refreshOrderPriority),
      refreshIfAllowed(13, refreshKitchenCommunication),
      refreshIfAllowed(14, refreshInventory),
      refreshIfAllowed(15, refreshRecipeCosting),
      refreshIfAllowed(16, refreshPrepStations),
      refreshIfAllowed(17, refreshBatchCooking),
      refreshIfAllowed(18, refreshDelayEscalation),
      refreshIfAllowed(19, refreshQualityControl),
      refreshIfAllowed(20, refreshCustomerReturn),
      refreshIfAllowed(21, refreshExpeditor),
      refreshIfAllowed(22, refreshPacking),
      refreshIfAllowed(23, refreshDeliveryAggregator),
      refreshIfAllowed(24, refreshBarBeverage),
      refreshIfAllowed(25, refreshBakeryDessert),
      refreshIfAllowed(26, refreshCloudKitchen),
      refreshIfAllowed(27, refreshBanquet),
      refreshIfAllowed(28, refreshRoomService),
      refreshIfAllowed(29, refreshCleaningHygiene),
      refreshIfAllowed(30, refreshEquipment),
      refreshIfAllowed(31, refreshSmartEnergy),
      refreshIfAllowed(32, refreshIotDevice),
      refreshIfAllowed(33, refreshStaffPerformance),
      refreshIfAllowed(34, refreshStaffShift),
      refreshIfAllowed(35, refreshStaffWellness),
      refreshIfAllowed(36, refreshLiveAlerts),
      refreshIfAllowed(37, refreshPanicEmergency),
      refreshIfAllowed(38, refreshOfflineFailover),
      refreshIfAllowed(39, refreshAnalyticsReporting),
      refreshIfAllowed(40, refreshKitchenHeatmap),
      refreshIfAllowed(41, refreshHardwareIntegration),
      refreshIfAllowed(42, refreshSmartwatchSupport),
      refreshIfAllowed(43, refreshMultiBranch),
      refreshIfAllowed(44, refreshAuditCompliance),
      refreshIfAllowed(45, refreshBackupRecovery),
      refreshIfAllowed(46, refreshSandboxTraining),
      refreshIfAllowed(47, refreshHiddenEnterprise),
      refreshIfAllowed(48, refreshFutureAiExpansion),
      refreshIfAllowed(49, refreshWaiterAutoAssignment),
    ]);
    _loading = false;
    _startPolling();
    notifyListeners();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) {
        unawaited(refreshDashboard(silent: true));
        if (_selectedNav == 1) {
          unawaited(refreshKds(silent: true));
        }
        if (_selectedNav == 2) {
          unawaited(refreshSections(silent: true));
        }
        if (_selectedNav == 3) {
          unawaited(refreshProcessing(silent: true));
        }
        if (_selectedNav == 4) {
          unawaited(refreshFiring(silent: true));
        }
        if (_selectedNav == 5) {
          unawaited(refreshPrep(silent: true));
        }
        if (_selectedNav == 6) {
          unawaited(refreshModifiers(silent: true));
        }
        if (_selectedNav == 7) {
          unawaited(refreshChefTasks(silent: true));
        }
        if (_selectedNav == 9) {
          unawaited(refreshSafety(silent: true));
        }
        if (_selectedNav == 10) {
          unawaited(refreshAiAssistant(silent: true));
        }
        if (_selectedNav == 11) {
          unawaited(refreshOrderPriority(silent: true));
        }
        if (_selectedNav == 12) {
          unawaited(refreshKitchenCommunication(silent: true));
        }
        if (_selectedNav == 13) {
          unawaited(refreshInventory(silent: true));
        }
        if (_selectedNav == 14) {
          unawaited(refreshRecipeCosting(silent: true));
        }
        if (_selectedNav == 15) {
          unawaited(refreshPrepStations(silent: true));
        }
        if (_selectedNav == 16) {
          unawaited(refreshBatchCooking(silent: true));
        }
        if (_selectedNav == 17) {
          unawaited(refreshDelayEscalation(silent: true));
        }
        if (_selectedNav == 18) {
          unawaited(refreshQualityControl(silent: true));
        }
        if (_selectedNav == 19) {
          unawaited(refreshCustomerReturn(silent: true));
        }
        if (_selectedNav == 20) {
          unawaited(refreshExpeditor(silent: true));
        }
        if (_selectedNav == 21) {
          unawaited(refreshPacking(silent: true));
        }
        if (_selectedNav == 22) {
          unawaited(refreshDeliveryAggregator(silent: true));
        }
        if (_selectedNav == 23) {
          unawaited(refreshBarBeverage(silent: true));
        }
        if (_selectedNav == 24) {
          unawaited(refreshBakeryDessert(silent: true));
        }
        if (_selectedNav == 25) {
          unawaited(refreshCloudKitchen(silent: true));
        }
        if (_selectedNav == 26) {
          unawaited(refreshBanquet(silent: true));
        }
        if (_selectedNav == 27) {
          unawaited(refreshRoomService(silent: true));
        }
        if (_selectedNav == 28) {
          unawaited(refreshCleaningHygiene(silent: true));
        }
        if (_selectedNav == 29) {
          unawaited(refreshEquipment(silent: true));
        }
        if (_selectedNav == 30) {
          unawaited(refreshSmartEnergy(silent: true));
        }
        if (_selectedNav == 31) {
          unawaited(refreshIotDevice(silent: true));
        }
        if (_selectedNav == 32) {
          unawaited(refreshStaffPerformance(silent: true));
        }
        if (_selectedNav == 33) {
          unawaited(refreshStaffShift(silent: true));
        }
        if (_selectedNav == 34) {
          unawaited(refreshStaffWellness(silent: true));
        }
        if (_selectedNav == 35) {
          unawaited(refreshLiveAlerts(silent: true));
        }
        if (_selectedNav == 36) {
          unawaited(refreshPanicEmergency(silent: true));
        }
        if (_selectedNav == 37) {
          unawaited(refreshOfflineFailover(silent: true));
        }
        if (_selectedNav == 38) {
          unawaited(refreshAnalyticsReporting(silent: true));
        }
        if (_selectedNav == 39) {
          unawaited(refreshKitchenHeatmap(silent: true));
        }
        if (_selectedNav == 40) {
          unawaited(refreshHardwareIntegration(silent: true));
        }
        if (_selectedNav == 41) {
          unawaited(refreshSmartwatchSupport(silent: true));
        }
        if (_selectedNav == 42) {
          unawaited(refreshMultiBranch(silent: true));
        }
        if (_selectedNav == 43) {
          unawaited(refreshAuditCompliance(silent: true));
        }
        if (_selectedNav == 44) {
          unawaited(refreshBackupRecovery(silent: true));
        }
        if (_selectedNav == 45) {
          unawaited(refreshSandboxTraining(silent: true));
        }
        if (_selectedNav == 46) {
          unawaited(refreshHiddenEnterprise(silent: true));
        }
        if (_selectedNav == 47) {
          unawaited(refreshFutureAiExpansion(silent: true));
        }
      },
    );

    // Live per-second countdown is now handled locally by each order tile's _LiveTimer widget,
    // so we no longer rebuild the whole KDS board every second (that per-second notifyListeners
    // was the main source of jank / "slow app"). Base values still re-sync on the 15s refresh.
    _kdsTimer?.cancel();
  }

  Future<void> refreshDashboard({bool silent = false}) async {
    if (!silent) {
      _refreshing = true;
      notifyListeners();
    }

    try {
      _dashboard = await _dashboardService.fetchDashboard(
        section: _selectedSection,
      );
      _errorMessage = null;
    } on ApiException catch (error) {
      _errorMessage = error.message;
    } catch (error, stack) {
      if (kDebugMode) {
        debugPrint('refreshDashboard failed: $error\n$stack');
      }
      _errorMessage =
          'Unable to load dashboard data. Check your connection and try again.';
    }

    _refreshing = false;
    notifyListeners();
  }

  Future<void> refreshKds({bool silent = false}) async {
    if (!silent) {
      _kdsLoading = true;
      notifyListeners();
    }

    try {
      final fresh = await _kdsService.fetchKds(
        section: _selectedSection,
        view: _kdsViewMode,
        filter: _kdsFilter,
      );
      _kds = silent && _kds != null
          ? fresh.mergeLiveTimersFrom(_kds!)
          : fresh;
      _kdsErrorMessage = null;
    } on ApiException catch (error) {
      _kdsErrorMessage = error.message;
    } catch (_) {
      _kdsErrorMessage = 'Unable to load KDS orders.';
    }

    _kdsLoading = false;
    notifyListeners();
  }

  Future<void> refreshSections({bool silent = false}) async {
    if (!silent) {
      _sectionsLoading = true;
      notifyListeners();
    }

    try {
      _sectionManagement = await _sectionService.fetchManagement(
        section: _selectedSection,
      );
      _sectionsErrorMessage = null;
    } on ApiException catch (error) {
      _sectionsErrorMessage = error.message;
    } catch (_) {
      _sectionsErrorMessage = 'Unable to load section management data.';
    }

    _sectionsLoading = false;
    notifyListeners();
  }

  Future<void> refreshProcessing({bool silent = false}) async {
    if (!silent) {
      _processingLoading = true;
      notifyListeners();
    }

    try {
      _processing = await _processingService.fetchProcessing(
        section: _selectedSection,
      );
      _processingErrorMessage = null;
    } on ApiException catch (error) {
      _processingErrorMessage = error.message;
    } catch (_) {
      _processingErrorMessage = 'Unable to load order processing data.';
    }

    _processingLoading = false;
    notifyListeners();
  }

  Future<void> optimizeProcessingQueue() async {
    final result = await _processingService.optimizeQueue();
    _processingActionMessage = result.message;
    await _syncAfterProcessingChange();
  }

  Future<void> performProcessingAction({
    required String orderId,
    required String action,
    String? targetSection,
    String? itemName,
    String? modification,
  }) async {
    await _processingService.processAction(
      orderId: orderId,
      action: action,
      targetSection: targetSection,
      itemName: itemName,
      modification: modification,
    );
    _processingActionMessage = _messageForProcessingAction(
      action,
      orderId,
      targetSection: targetSection,
      itemName: itemName,
    );
    await _syncAfterProcessingChange();
  }

  String _messageForProcessingAction(
    String action,
    String orderId, {
    String? targetSection,
    String? itemName,
  }) {
    return switch (action) {
      'accept' => 'Accepted $orderId',
      'reject' => 'Rejected $orderId',
      'hold' => 'Held $orderId',
      'release' => 'Released $orderId from hold',
      'prepare' => 'Started preparation for $orderId',
      'ready' => '$orderId marked ready',
      'delay' => '$orderId marked delayed',
      'refire' => 'Re-fire requested for $orderId',
      'reassign' => 'Rerouted $orderId to $targetSection',
      'cancel_item' => 'Cancelled $itemName on $orderId',
      'modify_item' => 'Modified $itemName on $orderId',
      _ => 'Updated $orderId',
    };
  }

  Future<void> _syncAfterProcessingChange() async {
    await Future.wait([
      refreshProcessing(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshSections(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshFiring({bool silent = false}) async {
    if (!silent) {
      _firingLoading = true;
      notifyListeners();
    }

    try {
      _courseFiring = await _firingService.fetchSessions(
        section: _selectedSection,
      );
      _firingErrorMessage = null;
    } on ApiException catch (error) {
      _firingErrorMessage = error.message;
    } catch (_) {
      _firingErrorMessage = 'Unable to load course firing data.';
    }

    _firingLoading = false;
    notifyListeners();
  }

  Future<void> syncAllFiringPacing() async {
    final result = await _firingService.syncPacing();
    _firingActionMessage = result.message;
    await _syncAfterFiringChange();
  }

  Future<void> performFiringAction({
    required String sessionId,
    required String action,
    String? courseType,
  }) async {
    await _firingService.performAction(
      sessionId: sessionId,
      action: action,
      courseType: courseType,
    );
    _firingActionMessage = _messageForFiringAction(
      action,
      sessionId,
      courseType: courseType,
    );
    await _syncAfterFiringChange();
  }

  String _messageForFiringAction(
    String action,
    String sessionId, {
    String? courseType,
  }) {
    if (action == 'sync_pacing') {
      return 'Pacing synchronized for $sessionId';
    }
    if (action == 'sequential_serving') {
      return 'Sequential serving enabled for $sessionId';
    }
    if (action == 'simultaneous_serving') {
      return 'Simultaneous serving enabled for $sessionId';
    }
    final course = courseType ?? 'course';
    return switch (action) {
      'fire_starter' || 'fire_main' || 'fire_dessert' =>
        'Fired $course on $sessionId',
      'hold_starter' || 'hold_main' || 'hold_dessert' =>
        'Held $course on $sessionId',
      'resume_starter' || 'resume_main' || 'resume_dessert' =>
        'Resumed $course on $sessionId',
      _ => 'Updated $sessionId',
    };
  }

  Future<void> _syncAfterFiringChange() async {
    await Future.wait([
      refreshFiring(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshProcessing(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshPrep({bool silent = false}) async {
    if (!silent) {
      _prepLoading = true;
      notifyListeners();
    }

    try {
      _prepBoard = await _prepService.fetchBoard(section: _selectedSection);
      _prepErrorMessage = null;
    } on ApiException catch (error) {
      _prepErrorMessage = error.message;
    } catch (_) {
      _prepErrorMessage = 'Unable to load preparation board.';
    }

    _prepLoading = false;
    notifyListeners();
  }

  Future<void> performPrepAction({
    required String taskId,
    required String action,
  }) async {
    var apiAction = action;
    int? stepIndex;
    String? ingredient;

    if (action.startsWith('complete_step:')) {
      apiAction = 'complete_step';
      stepIndex = int.tryParse(action.split(':').last);
    } else if (action.startsWith('check_ingredient:')) {
      apiAction = 'check_next_ingredient';
      ingredient = action.substring('check_ingredient:'.length);
    }

    await _prepService.performAction(
      taskId: taskId,
      action: apiAction,
      stepIndex: stepIndex,
      ingredient: ingredient,
    );
    _prepActionMessage = _messageForPrepAction(apiAction, taskId);
    await _syncAfterPrepChange();
  }

  String _messageForPrepAction(String action, String taskId) {
    return switch (action) {
      'start' => 'Started preparation $taskId',
      'pause' => 'Paused $taskId',
      'resume' => 'Resumed $taskId',
      'complete' => 'Completed $taskId',
      'complete_step' => 'Step completed on $taskId',
      'check_next_ingredient' => 'Ingredient checked on $taskId',
      'mode_standard' => 'Standard mode set on $taskId',
      'mode_fast' => 'Fast mode set on $taskId',
      'mode_premium' => 'Premium mode set on $taskId',
      'mode_bulk' => 'Bulk mode set on $taskId',
      'mode_scheduled' => 'Scheduled mode set on $taskId',
      _ => 'Updated $taskId',
    };
  }

  Future<void> _syncAfterPrepChange() async {
    await Future.wait([
      refreshPrep(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshProcessing(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshModifiers({bool silent = false}) async {
    if (!silent) {
      _modifierLoading = true;
      notifyListeners();
    }

    try {
      _modifierBoard = await _modifierService.fetchBoard(
        section: _selectedSection,
      );
      _modifierErrorMessage = null;
    } on ApiException catch (error) {
      _modifierErrorMessage = error.message;
    } catch (_) {
      _modifierErrorMessage = 'Unable to load modifier board.';
    }

    _modifierLoading = false;
    notifyListeners();
  }

  Future<void> performModifierAction({
    required String orderId,
    required String action,
    String? modifierType,
    String? itemName,
    String? replacement,
  }) async {
    await _modifierService.performAction(
      orderId: orderId,
      action: action,
      modifierType: modifierType,
      itemName: itemName,
      replacement: replacement,
    );
    _modifierActionMessage = _messageForModifierAction(
      action,
      orderId,
      modifierType: modifierType,
    );
    await _syncAfterModifierChange();
  }

  String _messageForModifierAction(
    String action,
    String orderId, {
    String? modifierType,
  }) {
    if (action.startsWith('acknowledge:') || action == 'acknowledge_all') {
      return 'Modifier acknowledged on $orderId';
    }
    if (action.startsWith('confirm_chef:')) {
      return 'Chef confirmation recorded for $orderId';
    }
    return switch (action) {
      'apply_modifier' => 'Applied $modifierType modifier to $orderId',
      'replace_side' => 'Side replacement updated on $orderId',
      _ => 'Updated modifiers on $orderId',
    };
  }

  Future<void> _syncAfterModifierChange() async {
    await Future.wait([
      refreshModifiers(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshProcessing(silent: true),
      refreshPrep(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshSafety({bool silent = false}) async {
    if (!silent) {
      _safetyLoading = true;
      notifyListeners();
    }

    try {
      _allergySafety = await _safetyService.fetchBoard(
        section: _selectedSection,
      );
      _safetyErrorMessage = null;
    } on ApiException catch (error) {
      _safetyErrorMessage = error.message;
    } catch (_) {
      _safetyErrorMessage = 'Unable to load allergy safety board.';
    }

    _safetyLoading = false;
    notifyListeners();
  }

  Future<void> performSafetyAction({
    required String caseId,
    required String action,
  }) async {
    await _safetyService.performAction(caseId: caseId, action: action);
    _safetyActionMessage = _messageForSafetyAction(action, caseId);
    await _syncAfterSafetyChange();
  }

  String _messageForSafetyAction(String action, String caseId) {
    return switch (action) {
      'confirm_chef' => 'Chef safety confirmation recorded for $caseId',
      'acknowledge_sop' => 'Safety SOP acknowledged for $caseId',
      'mark_contained' => 'Cross-contamination risk contained for $caseId',
      'clear_case' => 'Safety case cleared for $caseId',
      'escalate' => 'Safety case escalated · head chef notified',
      _ => 'Updated safety case $caseId',
    };
  }

  Future<void> _syncAfterSafetyChange() async {
    await Future.wait([
      refreshSafety(silent: true),
      refreshModifiers(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshPrep(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshChefTasks({bool silent = false}) async {
    if (!silent) {
      _chefTaskLoading = true;
      notifyListeners();
    }

    try {
      _chefTasks = await _chefTaskService.fetchBoard(section: _selectedSection);
      _chefTaskErrorMessage = null;
    } on ApiException catch (error) {
      _chefTaskErrorMessage = error.message;
    } catch (_) {
      _chefTaskErrorMessage = 'Unable to load chef task board.';
    }

    _chefTaskLoading = false;
    notifyListeners();
  }

  Future<void> balanceChefWorkload() async {
    final result = await _chefTaskService.balanceWorkload();
    _chefTaskActionMessage = result.message;
    await _syncAfterChefTaskChange();
  }

  Future<void> performChefTaskAction({
    required String taskId,
    required String action,
    String? targetChefId,
  }) async {
    await _chefTaskService.performAction(
      taskId: taskId,
      action: action,
      targetChefId: targetChefId,
    );
    _chefTaskActionMessage = _messageForChefTaskAction(action, taskId);
    await _syncAfterChefTaskChange();
  }

  String _messageForChefTaskAction(String action, String taskId) {
    return switch (action) {
      'start' => 'Started task $taskId',
      'complete' => 'Completed task $taskId',
      'transfer' => 'Transferred task $taskId',
      'reassign' => 'Reassigned task $taskId',
      'mark_waiting' => 'Task $taskId marked waiting',
      'resume' => 'Resumed task $taskId',
      'escalate' => 'Escalated task $taskId',
      _ => 'Updated task $taskId',
    };
  }

  Future<void> _syncAfterChefTaskChange() async {
    await Future.wait([
      refreshChefTasks(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshSections(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshAiAssistant({bool silent = false}) async {
    if (!silent) {
      _aiLoading = true;
      notifyListeners();
    }

    try {
      _aiAssistant = await _aiAssistantService.fetchAssistant(
        section: _selectedSection,
      );
      _aiErrorMessage = null;
    } on ApiException catch (error) {
      _aiErrorMessage = error.message;
    } catch (_) {
      _aiErrorMessage = 'Unable to load AI assistant data.';
    }

    _aiLoading = false;
    notifyListeners();
  }

  Future<void> applyAiSuggestion(String suggestionId) async {
    final result = await _aiAssistantService.applySuggestion(suggestionId);
    _aiActionMessage = result.message;
    await _syncAfterAiAction();
  }

  Future<void> executeAiVoiceCommand(String command) async {
    final result = await _aiAssistantService.executeVoiceCommand(
      command: command,
    );
    _aiActionMessage = result.message;
    await _syncAfterAiAction();
  }

  Future<void> _syncAfterAiAction() async {
    await Future.wait([
      refreshAiAssistant(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshProcessing(silent: true),
      refreshChefTasks(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshOrderPriority({bool silent = false}) async {
    if (!silent) {
      _priorityLoading = true;
      notifyListeners();
    }

    try {
      _orderPriority = await _orderPriorityService.fetchBoard(
        section: _selectedSection,
      );
      _priorityErrorMessage = null;
    } on ApiException catch (error) {
      _priorityErrorMessage = error.message;
    } catch (_) {
      _priorityErrorMessage = 'Unable to load order priority board.';
    }

    _priorityLoading = false;
    notifyListeners();
  }

  Future<void> reprioritizeOrderQueue() async {
    final result = await _orderPriorityService.reprioritizeQueue();
    _priorityActionMessage = result.message;
    await _syncAfterPriorityChange();
  }

  Future<void> performPriorityAction({
    required String orderId,
    required String action,
  }) async {
    final result = await _orderPriorityService.performAction(
      orderId: orderId,
      action: action,
    );
    _priorityActionMessage = result.message;
    await _syncAfterPriorityChange();
  }

  Future<void> _syncAfterPriorityChange() async {
    await Future.wait([
      refreshOrderPriority(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshProcessing(silent: true),
      refreshSections(silent: true),
    ]);
    notifyListeners();
  }

  String get _communicationSender =>
      _auth.session?.user.name ?? 'Kitchen Team';

  Future<void> refreshKitchenCommunication({bool silent = false}) async {
    if (!silent) {
      _communicationLoading = true;
      notifyListeners();
    }

    try {
      _kitchenCommunication = await _communicationService.fetchBoard(
        section: _selectedSection,
      );
      _communicationErrorMessage = null;
    } on ApiException catch (error) {
      _communicationErrorMessage = error.message;
    } catch (_) {
      _communicationErrorMessage = 'Unable to load kitchen communication.';
    }

    _communicationLoading = false;
    notifyListeners();
  }

  Future<void> sendKitchenMessage({
    required String threadId,
    required String message,
  }) async {
    final result = await _communicationService.sendMessage(
      threadId: threadId,
      message: message,
      sender: _communicationSender,
    );
    _communicationActionMessage = result.message;
    await _syncAfterCommunicationChange();
  }

  Future<void> sendKitchenVoiceNote({required String threadId}) async {
    final result = await _communicationService.sendVoiceNote(
      threadId: threadId,
      sender: _communicationSender,
    );
    _communicationActionMessage = result.message;
    await _syncAfterCommunicationChange();
  }

  Future<void> sendKitchenDelayUpdate({
    required String orderId,
    required int minutes,
  }) async {
    final result = await _communicationService.sendDelayUpdate(
      orderId: orderId,
      minutes: minutes,
      sender: _communicationSender,
    );
    _communicationActionMessage = result.message;
    await _syncAfterCommunicationChange();
  }

  Future<void> postChefAnnouncement({
    required String title,
    required String body,
  }) async {
    if (title.isEmpty || body.isEmpty) {
      _communicationActionMessage = 'Announcement title and body required';
      notifyListeners();
      return;
    }

    final result = await _communicationService.postAnnouncement(
      title: title,
      body: body,
      author: _communicationSender,
      scope: _selectedSection,
    );
    _communicationActionMessage = result.message;
    await _syncAfterCommunicationChange();
  }

  Future<void> sendKitchenBroadcast({required String message}) async {
    if (message.isEmpty) {
      _communicationActionMessage = 'Broadcast message required';
      notifyListeners();
      return;
    }

    final result = await _communicationService.sendBroadcast(
      message: message,
      author: _communicationSender,
      scope: _selectedSection,
    );
    _communicationActionMessage = result.message;
    await _syncAfterCommunicationChange();
  }

  Future<void> performCommunicationAlertAction({
    required String alertId,
    required String action,
  }) async {
    final result = await _communicationService.performAlertAction(
      alertId: alertId,
      action: action,
    );
    _communicationActionMessage = result.message;
    await _syncAfterCommunicationChange();
  }

  Future<void> _syncAfterCommunicationChange() async {
    await Future.wait([
      refreshKitchenCommunication(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshProcessing(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshInventory({bool silent = false}) async {
    if (!silent) {
      _inventoryLoading = true;
      notifyListeners();
    }

    try {
      _inventory = await _inventoryService.fetchBoard(section: _selectedSection);
      _inventoryErrorMessage = null;
    } on ApiException catch (error) {
      _inventoryErrorMessage = error.message;
    } catch (_) {
      _inventoryErrorMessage = 'Unable to load inventory board.';
    }

    _inventoryLoading = false;
    notifyListeners();
  }

  Future<void> syncInventoryStock() async {
    final result = await _inventoryService.syncStock();
    _inventoryActionMessage = result.message;
    await _syncAfterInventoryChange();
  }

  Future<void> deductInventoryItem({
    required String itemId,
    required double quantity,
  }) async {
    final result = await _inventoryService.deductIngredient(
      itemId: itemId,
      quantity: quantity,
    );
    _inventoryActionMessage = result.message;
    await _syncAfterInventoryChange();
  }

  Future<void> validateInventoryRecipeStock() async {
    final result = await _inventoryService.validateRecipeStock();
    _inventoryActionMessage = result.message;
    await _syncAfterInventoryChange();
  }

  Future<void> applyInventorySubstitution({
    required String itemId,
    required String substituteId,
  }) async {
    final result = await _inventoryService.applySubstitution(
      itemId: itemId,
      substituteId: substituteId,
    );
    _inventoryActionMessage = result.message;
    await _syncAfterInventoryChange();
  }

  Future<void> performInventoryAlertAction({
    required String alertId,
    required String action,
  }) async {
    final result = await _inventoryService.performAlertAction(
      alertId: alertId,
      action: action,
    );
    _inventoryActionMessage = result.message;
    await _syncAfterInventoryChange();
  }

  Future<void> _syncAfterInventoryChange() async {
    await Future.wait([
      refreshInventory(silent: true),
      refreshDashboard(silent: true),
      refreshPrep(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshRecipeCosting({bool silent = false}) async {
    if (!silent) {
      _recipeCostingLoading = true;
      notifyListeners();
    }

    try {
      _recipeCosting = await _recipeCostingService.fetchBoard(
        section: _selectedSection,
      );
      _recipeCostingErrorMessage = null;
    } on ApiException catch (error) {
      _recipeCostingErrorMessage = error.message;
    } catch (_) {
      _recipeCostingErrorMessage = 'Unable to load recipe costing board.';
    }

    _recipeCostingLoading = false;
    notifyListeners();
  }

  Future<void> refreshRecipeCosts() async {
    final result = await _recipeCostingService.refreshCosting();
    _recipeCostingActionMessage = result.message;
    await _syncAfterRecipeCostingChange();
  }

  Future<void> recordRecipeWaste({
    required String recipeId,
    required double plates,
  }) async {
    final result = await _recipeCostingService.recordWaste(
      recipeId: recipeId,
      plates: plates,
    );
    _recipeCostingActionMessage = result.message;
    await _syncAfterRecipeCostingChange();
  }

  Future<void> adjustRecipePortion({
    required String recipeId,
    required String portion,
  }) async {
    final result = await _recipeCostingService.adjustPortion(
      recipeId: recipeId,
      portion: portion,
    );
    _recipeCostingActionMessage = result.message;
    await _syncAfterRecipeCostingChange();
  }

  Future<void> _syncAfterRecipeCostingChange() async {
    await Future.wait([
      refreshRecipeCosting(silent: true),
      refreshInventory(silent: true),
      refreshDashboard(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshPrepStations({bool silent = false}) async {
    if (!silent) {
      _prepStationLoading = true;
      notifyListeners();
    }

    try {
      _prepStations = await _prepStationService.fetchBoard(
        section: _selectedSection,
      );
      _prepStationErrorMessage = null;
    } on ApiException catch (error) {
      _prepStationErrorMessage = error.message;
    } catch (_) {
      _prepStationErrorMessage = 'Unable to load prep station board.';
    }

    _prepStationLoading = false;
    notifyListeners();
  }

  Future<void> balancePrepStationQueues() async {
    final result = await _prepStationService.balanceQueues();
    _prepStationActionMessage = result.message;
    await _syncAfterPrepStationChange();
  }

  Future<void> assignPrepStationStaff({
    required String stationId,
    required String staffName,
  }) async {
    final result = await _prepStationService.assignStaff(
      stationId: stationId,
      staffName: staffName,
    );
    _prepStationActionMessage = result.message;
    await _syncAfterPrepStationChange();
  }

  Future<void> performPrepStationAction({
    required String stationId,
    required String action,
  }) async {
    final result = await _prepStationService.performAction(
      stationId: stationId,
      action: action,
    );
    _prepStationActionMessage = result.message;
    await _syncAfterPrepStationChange();
  }

  Future<void> _syncAfterPrepStationChange() async {
    await Future.wait([
      refreshPrepStations(silent: true),
      refreshPrep(silent: true),
      refreshDashboard(silent: true),
      refreshSections(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshBatchCooking({bool silent = false}) async {
    if (!silent) {
      _batchCookingLoading = true;
      notifyListeners();
    }

    try {
      _batchCooking = await _batchCookingService.fetchBoard(
        section: _selectedSection,
      );
      _batchCookingErrorMessage = null;
    } on ApiException catch (error) {
      _batchCookingErrorMessage = error.message;
    } catch (_) {
      _batchCookingErrorMessage = 'Unable to load batch cooking board.';
    }

    _batchCookingLoading = false;
    notifyListeners();
  }

  Future<void> refreshBatchForecast() async {
    final result = await _batchCookingService.refreshForecast();
    _batchCookingActionMessage = result.message;
    await _syncAfterBatchCookingChange();
  }

  Future<void> performBatchCookingAction({
    required String batchId,
    required String action,
  }) async {
    final result = await _batchCookingService.performAction(
      batchId: batchId,
      action: action,
    );
    _batchCookingActionMessage = result.message;
    await _syncAfterBatchCookingChange();
  }

  Future<void> _syncAfterBatchCookingChange() async {
    await Future.wait([
      refreshBatchCooking(silent: true),
      refreshPrep(silent: true),
      refreshFiring(silent: true),
      refreshDashboard(silent: true),
      refreshInventory(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshDelayEscalation({bool silent = false}) async {
    if (!silent) {
      _delayEscalationLoading = true;
      notifyListeners();
    }

    try {
      _delayEscalation = await _delayEscalationService.fetchBoard(
        section: _selectedSection,
      );
      _delayEscalationErrorMessage = null;
    } on ApiException catch (error) {
      _delayEscalationErrorMessage = error.message;
    } catch (_) {
      _delayEscalationErrorMessage = 'Unable to load delay escalation board.';
    }

    _delayEscalationLoading = false;
    notifyListeners();
  }

  Future<void> logDelayReason({
    required String orderId,
    required String reason,
  }) async {
    final result = await _delayEscalationService.logDelayReason(
      orderId: orderId,
      reason: reason,
    );
    _delayEscalationActionMessage = result.message;
    await _syncAfterDelayEscalationChange();
  }

  Future<void> autoEscalateAllDelays() async {
    final result = await _delayEscalationService.autoEscalateAll();
    _delayEscalationActionMessage = result.message;
    await _syncAfterDelayEscalationChange();
  }

  Future<void> performDelayEscalationAction({
    required String orderId,
    required String action,
  }) async {
    final result = await _delayEscalationService.performAction(
      orderId: orderId,
      action: action,
    );
    _delayEscalationActionMessage = result.message;
    await _syncAfterDelayEscalationChange();
  }

  Future<void> _syncAfterDelayEscalationChange() async {
    await Future.wait([
      refreshDelayEscalation(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshProcessing(silent: true),
      refreshOrderPriority(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshQualityControl({bool silent = false}) async {
    if (!silent) {
      _qualityControlLoading = true;
      notifyListeners();
    }

    try {
      _qualityControl = await _qualityControlService.fetchBoard(
        section: _selectedSection,
      );
      _qualityControlErrorMessage = null;
    } on ApiException catch (error) {
      _qualityControlErrorMessage = error.message;
    } catch (_) {
      _qualityControlErrorMessage = 'Unable to load quality control board.';
    }

    _qualityControlLoading = false;
    notifyListeners();
  }

  Future<void> performQcCheckAction({
    required String checkId,
    required String action,
    String? itemId,
    bool? passed,
  }) async {
    final result = await _qualityControlService.performCheckAction(
      checkId: checkId,
      action: action,
      itemId: itemId,
      passed: passed,
    );
    _qualityControlActionMessage = result.message;
    await _syncAfterQualityControlChange();
  }

  Future<void> performQcOrderAction({
    required String orderId,
    required String action,
    String? reason,
  }) async {
    final supervisorName = _auth.session?.user.name;
    final result = await _qualityControlService.performOrderAction(
      orderId: orderId,
      action: action,
      reason: reason,
      supervisorName: supervisorName,
    );
    _qualityControlActionMessage = result.message;
    await _syncAfterQualityControlChange();
  }

  Future<void> triggerRandomQcAudit() async {
    final result = await _qualityControlService.triggerRandomAudit(
      section: _selectedSection,
    );
    _qualityControlActionMessage = result.message;
    await _syncAfterQualityControlChange();
  }

  Future<void> logQcComplaint({
    required String orderId,
    required String reason,
  }) async {
    final result = await _qualityControlService.logComplaint(
      orderId: orderId,
      reason: reason,
    );
    _qualityControlActionMessage = result.message;
    await _syncAfterQualityControlChange();
  }

  Future<void> _syncAfterQualityControlChange() async {
    await Future.wait([
      refreshQualityControl(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshProcessing(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshCustomerReturn({bool silent = false}) async {
    if (!silent) {
      _customerReturnLoading = true;
      notifyListeners();
    }

    try {
      _customerReturn = await _customerReturnService.fetchBoard(
        section: _selectedSection,
      );
      _customerReturnErrorMessage = null;
    } on ApiException catch (error) {
      _customerReturnErrorMessage = error.message;
    } catch (_) {
      _customerReturnErrorMessage = 'Unable to load customer return board.';
    }

    _customerReturnLoading = false;
    notifyListeners();
  }

  Future<void> performCustomerReturnAction({
    required String returnId,
    required String action,
    String? tag,
    String? severity,
  }) async {
    final result = await _customerReturnService.performAction(
      returnId: returnId,
      action: action,
      tag: tag,
      severity: severity,
    );
    _customerReturnActionMessage = result.message;
    await _syncAfterCustomerReturnChange();
  }

  Future<void> createCustomerReturn({
    required String orderId,
    required String returnType,
    required String reason,
  }) async {
    final result = await _customerReturnService.createReturn(
      orderId: orderId,
      returnType: returnType,
      reason: reason,
    );
    _customerReturnActionMessage = result.message;
    await _syncAfterCustomerReturnChange();
  }

  Future<void> _syncAfterCustomerReturnChange() async {
    await Future.wait([
      refreshCustomerReturn(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshProcessing(silent: true),
      refreshOrderPriority(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshExpeditor({bool silent = false}) async {
    if (!silent) {
      _expeditorLoading = true;
      notifyListeners();
    }

    try {
      _expeditor = await _expeditorService.fetchBoard(
        section: _selectedSection,
      );
      _expeditorErrorMessage = null;
    } on ApiException catch (error) {
      _expeditorErrorMessage = error.message;
    } catch (_) {
      _expeditorErrorMessage = 'Unable to load expeditor board.';
    }

    _expeditorLoading = false;
    notifyListeners();
  }

  Future<void> performExpeditorAction({
    required String ticketId,
    required String action,
  }) async {
    final result = await _expeditorService.performTicketAction(
      ticketId: ticketId,
      action: action,
    );
    _expeditorActionMessage = result.message;
    await _syncAfterExpeditorChange();
  }

  Future<void> coordinateExpeditorSections({String? groupId}) async {
    final result = await _expeditorService.coordinateSections(groupId: groupId);
    _expeditorActionMessage = result.message;
    await _syncAfterExpeditorChange();
  }

  Future<void> syncExpeditorTable(String tableNumber) async {
    final result = await _expeditorService.syncTables(tableNumber: tableNumber);
    _expeditorActionMessage = result.message;
    await _syncAfterExpeditorChange();
  }

  Future<void> syncAllExpeditorTables() async {
    final result = await _expeditorService.syncTables();
    _expeditorActionMessage = result.message;
    await _syncAfterExpeditorChange();
  }

  Future<void> _syncAfterExpeditorChange() async {
    await Future.wait([
      refreshExpeditor(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshProcessing(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshPacking({bool silent = false}) async {
    if (!silent) {
      _packingLoading = true;
      notifyListeners();
    }

    try {
      _packing = await _packingService.fetchBoard(
        section: _selectedSection,
      );
      _packingErrorMessage = null;
    } on ApiException catch (error) {
      _packingErrorMessage = error.message;
    } catch (_) {
      _packingErrorMessage = 'Unable to load packing board.';
    }

    _packingLoading = false;
    notifyListeners();
  }

  Future<void> performPackingAction({
    required String jobId,
    required String action,
  }) async {
    final result = await _packingService.performAction(
      jobId: jobId,
      action: action,
    );
    _packingActionMessage = result.message;
    await _syncAfterPackingChange();
  }

  Future<void> printAllPackingLabels() async {
    final result = await _packingService.printLabels();
    _packingActionMessage = result.message;
    await _syncAfterPackingChange();
  }

  Future<void> _syncAfterPackingChange() async {
    await Future.wait([
      refreshPacking(silent: true),
      refreshDashboard(silent: true),
      refreshExpeditor(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshDeliveryAggregator({bool silent = false}) async {
    if (!silent) {
      _deliveryAggregatorLoading = true;
      notifyListeners();
    }

    try {
      _deliveryAggregator = await _deliveryAggregatorService.fetchBoard(
        section: _selectedSection,
      );
      _deliveryAggregatorErrorMessage = null;
    } on ApiException catch (error) {
      _deliveryAggregatorErrorMessage = error.message;
    } catch (_) {
      _deliveryAggregatorErrorMessage =
          'Unable to load delivery aggregator board.';
    }

    _deliveryAggregatorLoading = false;
    notifyListeners();
  }

  Future<void> performDeliveryAggregatorAction({
    required String orderId,
    required String action,
  }) async {
    final result = await _deliveryAggregatorService.performAction(
      orderId: orderId,
      action: action,
    );
    _deliveryAggregatorActionMessage = result.message;
    await _syncAfterDeliveryAggregatorChange();
  }

  Future<void> syncAllAggregatorOrders() async {
    final result = await _deliveryAggregatorService.syncAllOrders();
    _deliveryAggregatorActionMessage = result.message;
    await _syncAfterDeliveryAggregatorChange();
  }

  Future<void> _syncAfterDeliveryAggregatorChange() async {
    await Future.wait([
      refreshDeliveryAggregator(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshPacking(silent: true),
      refreshOrderPriority(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshBarBeverage({bool silent = false}) async {
    if (!silent) {
      _barBeverageLoading = true;
      notifyListeners();
    }

    try {
      _barBeverage = await _barBeverageService.fetchBoard(
        section: _selectedSection,
      );
      _barBeverageErrorMessage = null;
    } on ApiException catch (error) {
      _barBeverageErrorMessage = error.message;
    } catch (_) {
      _barBeverageErrorMessage = 'Unable to load bar beverage board.';
    }

    _barBeverageLoading = false;
    notifyListeners();
  }

  Future<void> performBarBeverageAction({
    required String drinkId,
    required String action,
    String? bartenderName,
    String? customization,
  }) async {
    final result = await _barBeverageService.performAction(
      drinkId: drinkId,
      action: action,
      bartenderName: bartenderName,
      customization: customization,
    );
    _barBeverageActionMessage = result.message;
    await _syncAfterBarBeverageChange();
  }

  Future<void> balanceBarQueue() async {
    final result = await _barBeverageService.balanceQueue();
    _barBeverageActionMessage = result.message;
    await _syncAfterBarBeverageChange();
  }

  Future<void> _syncAfterBarBeverageChange() async {
    await Future.wait([
      refreshBarBeverage(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshPacking(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshBakeryDessert({bool silent = false}) async {
    if (!silent) {
      _bakeryDessertLoading = true;
      notifyListeners();
    }

    try {
      _bakeryDessert = await _bakeryDessertService.fetchBoard(
        section: _selectedSection,
      );
      _bakeryDessertErrorMessage = null;
    } on ApiException catch (error) {
      _bakeryDessertErrorMessage = error.message;
    } catch (_) {
      _bakeryDessertErrorMessage = 'Unable to load bakery dessert board.';
    }

    _bakeryDessertLoading = false;
    notifyListeners();
  }

  Future<void> performBakeryDessertAction({
    required String jobId,
    required String action,
    String? customization,
  }) async {
    final result = await _bakeryDessertService.performAction(
      jobId: jobId,
      action: action,
      customization: customization,
    );
    _bakeryDessertActionMessage = result.message;
    await _syncAfterBakeryDessertChange();
  }

  Future<void> startBakeryProduction({String? itemName}) async {
    final result = await _bakeryDessertService.startProduction(itemName: itemName);
    _bakeryDessertActionMessage = result.message;
    await _syncAfterBakeryDessertChange();
  }

  Future<void> _syncAfterBakeryDessertChange() async {
    await Future.wait([
      refreshBakeryDessert(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshPacking(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshCloudKitchen({bool silent = false}) async {
    if (!silent) {
      _cloudKitchenLoading = true;
      notifyListeners();
    }

    try {
      _cloudKitchen = await _cloudKitchenService.fetchBoard(
        section: _selectedSection,
      );
      _cloudKitchenErrorMessage = null;
    } on ApiException catch (error) {
      _cloudKitchenErrorMessage = error.message;
    } catch (_) {
      _cloudKitchenErrorMessage = 'Unable to load cloud kitchen board.';
    }

    _cloudKitchenLoading = false;
    notifyListeners();
  }

  Future<void> performCloudKitchenAction({
    required String orderId,
    required String action,
    String? brandId,
  }) async {
    final result = await _cloudKitchenService.performAction(
      orderId: orderId,
      action: action,
      brandId: brandId,
    );
    _cloudKitchenActionMessage = result.message;
    await _syncAfterCloudKitchenChange();
  }

  Future<void> balanceCloudKitchenLoad() async {
    final result = await _cloudKitchenService.balanceLoad();
    _cloudKitchenActionMessage = result.message;
    await _syncAfterCloudKitchenChange();
  }

  Future<void> _syncAfterCloudKitchenChange() async {
    await Future.wait([
      refreshCloudKitchen(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshDeliveryAggregator(silent: true),
      refreshPacking(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshBanquet({bool silent = false}) async {
    if (!silent) {
      _banquetLoading = true;
      notifyListeners();
    }

    try {
      _banquet = await _banquetService.fetchBoard(section: _selectedSection);
      _banquetErrorMessage = null;
    } on ApiException catch (error) {
      _banquetErrorMessage = error.message;
    } catch (_) {
      _banquetErrorMessage = 'Unable to load banquet board.';
    }

    _banquetLoading = false;
    notifyListeners();
  }

  Future<void> performBanquetAction({
    required String eventId,
    required String action,
    int? guestCount,
    String? counterName,
  }) async {
    final result = await _banquetService.performAction(
      eventId: eventId,
      action: action,
      guestCount: guestCount,
      counterName: counterName,
    );
    _banquetActionMessage = result.message;
    await _syncAfterBanquetChange();
  }

  Future<void> startBanquetSchedule({String? eventName}) async {
    final result = await _banquetService.startSchedule(eventName: eventName);
    _banquetActionMessage = result.message;
    await _syncAfterBanquetChange();
  }

  Future<void> _syncAfterBanquetChange() async {
    await Future.wait([
      refreshBanquet(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshBakeryDessert(silent: true),
      refreshPacking(silent: true),
      refreshExpeditor(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshRoomService({bool silent = false}) async {
    if (!silent) {
      _roomServiceLoading = true;
      notifyListeners();
    }

    try {
      _roomService = await _roomServiceService.fetchBoard(
        section: _selectedSection,
      );
      _roomServiceErrorMessage = null;
    } on ApiException catch (error) {
      _roomServiceErrorMessage = error.message;
    } catch (_) {
      _roomServiceErrorMessage = 'Unable to load room service board.';
    }

    _roomServiceLoading = false;
    notifyListeners();
  }

  Future<void> performRoomServiceAction({
    required String orderId,
    required String action,
    String? trayId,
    String? scheduledTime,
  }) async {
    final result = await _roomServiceService.performAction(
      orderId: orderId,
      action: action,
      trayId: trayId,
      scheduledTime: scheduledTime,
    );
    _roomServiceActionMessage = result.message;
    await _syncAfterRoomServiceChange();
  }

  Future<void> dispatchRoomServiceTrays({String? orderId}) async {
    final result = await _roomServiceService.dispatchTray(orderId: orderId);
    _roomServiceActionMessage = result.message;
    await _syncAfterRoomServiceChange();
  }

  Future<void> _syncAfterRoomServiceChange() async {
    await Future.wait([
      refreshRoomService(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshPacking(silent: true),
      refreshExpeditor(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshCleaningHygiene({bool silent = false}) async {
    if (!silent) {
      _cleaningHygieneLoading = true;
      notifyListeners();
    }

    try {
      _cleaningHygiene = await _cleaningHygieneService.fetchBoard(
        section: _selectedSection,
      );
      _cleaningHygieneErrorMessage = null;
    } on ApiException catch (error) {
      _cleaningHygieneErrorMessage = error.message;
    } catch (_) {
      _cleaningHygieneErrorMessage = 'Unable to load cleaning hygiene board.';
    }

    _cleaningHygieneLoading = false;
    notifyListeners();
  }

  Future<void> performCleaningHygieneAction({
    required String taskId,
    required String action,
    String? staffName,
  }) async {
    final result = await _cleaningHygieneService.performAction(
      taskId: taskId,
      action: action,
      staffName: staffName,
    );
    _cleaningHygieneActionMessage = result.message;
    await _syncAfterCleaningHygieneChange();
  }

  Future<void> startCleaningHygieneAudit({String? auditType}) async {
    final result = await _cleaningHygieneService.startAudit(auditType: auditType);
    _cleaningHygieneActionMessage = result.message;
    await _syncAfterCleaningHygieneChange();
  }

  Future<void> _syncAfterCleaningHygieneChange() async {
    await Future.wait([
      refreshCleaningHygiene(silent: true),
      refreshDashboard(silent: true),
      refreshQualityControl(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshEquipment({bool silent = false}) async {
    if (!silent) {
      _equipmentLoading = true;
      notifyListeners();
    }

    try {
      _equipment = await _equipmentService.fetchBoard(section: _selectedSection);
      _equipmentErrorMessage = null;
    } on ApiException catch (error) {
      _equipmentErrorMessage = error.message;
    } catch (_) {
      _equipmentErrorMessage = 'Unable to load equipment board.';
    }

    _equipmentLoading = false;
    notifyListeners();
  }

  Future<void> performEquipmentAction({
    required String assetId,
    required String action,
    String? issueSummary,
  }) async {
    final result = await _equipmentService.performAction(
      assetId: assetId,
      action: action,
      issueSummary: issueSummary,
    );
    _equipmentActionMessage = result.message;
    await _syncAfterEquipmentChange();
  }

  Future<void> raiseEquipmentMaintenance({
    String? assetId,
    String? issueSummary,
  }) async {
    final result = await _equipmentService.raiseMaintenance(
      assetId: assetId,
      issueSummary: issueSummary,
    );
    _equipmentActionMessage = result.message;
    await _syncAfterEquipmentChange();
  }

  Future<void> _syncAfterEquipmentChange() async {
    await Future.wait([
      refreshEquipment(silent: true),
      refreshDashboard(silent: true),
      refreshCleaningHygiene(silent: true),
      refreshDelayEscalation(silent: true),
      refreshSmartEnergy(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshSmartEnergy({bool silent = false}) async {
    if (!silent) {
      _smartEnergyLoading = true;
      notifyListeners();
    }

    try {
      _smartEnergy = await _smartEnergyService.fetchBoard(
        section: _selectedSection,
      );
      _smartEnergyErrorMessage = null;
    } on ApiException catch (error) {
      _smartEnergyErrorMessage = error.message;
    } catch (_) {
      _smartEnergyErrorMessage = 'Unable to load smart energy board.';
    }

    _smartEnergyLoading = false;
    notifyListeners();
  }

  Future<void> performSmartEnergyAction({
    required String alertId,
    required String action,
  }) async {
    final result = await _smartEnergyService.performAction(
      alertId: alertId,
      action: action,
    );
    _smartEnergyActionMessage = result.message;
    await _syncAfterSmartEnergyChange();
  }

  Future<void> triggerSmartEnergyShutdown({String? equipmentName}) async {
    final result = await _smartEnergyService.triggerShutdown(
      equipmentName: equipmentName,
    );
    _smartEnergyActionMessage = result.message;
    await _syncAfterSmartEnergyChange();
  }

  Future<void> _syncAfterSmartEnergyChange() async {
    await Future.wait([
      refreshSmartEnergy(silent: true),
      refreshDashboard(silent: true),
      refreshEquipment(silent: true),
      refreshDelayEscalation(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshIotDevice({bool silent = false}) async {
    if (!silent) {
      _iotDeviceLoading = true;
      notifyListeners();
    }

    try {
      _iotDevice = await _iotDeviceService.fetchBoard(
        section: _selectedSection,
      );
      _iotDeviceErrorMessage = null;
    } on ApiException catch (error) {
      _iotDeviceErrorMessage = error.message;
    } catch (_) {
      _iotDeviceErrorMessage = 'Unable to load IoT device board.';
    }

    _iotDeviceLoading = false;
    notifyListeners();
  }

  Future<void> performIotDeviceAction({
    required String deviceId,
    required String action,
  }) async {
    final result = await _iotDeviceService.performAction(
      deviceId: deviceId,
      action: action,
    );
    _iotDeviceActionMessage = result.message;
    await _syncAfterIotDeviceChange();
  }

  Future<void> syncAllIotDevices() async {
    final result = await _iotDeviceService.syncAll();
    _iotDeviceActionMessage = result.message;
    await _syncAfterIotDeviceChange();
  }

  Future<void> _syncAfterIotDeviceChange() async {
    await Future.wait([
      refreshIotDevice(silent: true),
      refreshDashboard(silent: true),
      refreshEquipment(silent: true),
      refreshSmartEnergy(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshStaffPerformance({bool silent = false}) async {
    if (!silent) {
      _staffPerformanceLoading = true;
      notifyListeners();
    }

    try {
      _staffPerformance = await _staffPerformanceService.fetchBoard(
        section: _selectedSection,
      );
      _staffPerformanceErrorMessage = null;
    } on ApiException catch (error) {
      _staffPerformanceErrorMessage = error.message;
    } catch (_) {
      _staffPerformanceErrorMessage =
          'Unable to load staff performance board.';
    }

    _staffPerformanceLoading = false;
    notifyListeners();
  }

  Future<void> performStaffPerformanceAction({
    required String staffId,
    required String action,
  }) async {
    final result = await _staffPerformanceService.performStaffAction(
      staffId: staffId,
      action: action,
    );
    _staffPerformanceActionMessage = result.message;
    await _syncAfterStaffPerformanceChange();
  }

  Future<void> performStaffIncentiveAction({
    required String incentiveId,
    required String action,
  }) async {
    final result = await _staffPerformanceService.performIncentiveAction(
      incentiveId: incentiveId,
      action: action,
    );
    _staffPerformanceActionMessage = result.message;
    await _syncAfterStaffPerformanceChange();
  }

  Future<void> recalculateStaffPerformance() async {
    final result = await _staffPerformanceService.recalculate();
    _staffPerformanceActionMessage = result.message;
    await _syncAfterStaffPerformanceChange();
  }

  Future<void> _syncAfterStaffPerformanceChange() async {
    await Future.wait([
      refreshStaffPerformance(silent: true),
      refreshDashboard(silent: true),
      refreshChefTasks(silent: true),
      refreshDelayEscalation(silent: true),
      refreshQualityControl(silent: true),
      refreshCustomerReturn(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshStaffShift({bool silent = false}) async {
    if (!silent) {
      _staffShiftLoading = true;
      notifyListeners();
    }

    try {
      _staffShift = await _staffShiftService.fetchBoard(
        section: _selectedSection,
      );
      _staffShiftErrorMessage = null;
    } on ApiException catch (error) {
      _staffShiftErrorMessage = error.message;
    } catch (_) {
      _staffShiftErrorMessage = 'Unable to load staff shift board.';
    }

    _staffShiftLoading = false;
    notifyListeners();
  }

  Future<void> performStaffShiftAction({
    required String staffId,
    required String action,
  }) async {
    final result = await _staffShiftService.performStaffAction(
      staffId: staffId,
      action: action,
    );
    _staffShiftActionMessage = result.message;
    await _syncAfterStaffShiftChange();
  }

  Future<void> performShiftSwapAction({
    required String swapId,
    required String action,
  }) async {
    final result = await _staffShiftService.performSwapAction(
      swapId: swapId,
      action: action,
    );
    _staffShiftActionMessage = result.message;
    await _syncAfterStaffShiftChange();
  }

  Future<void> performShiftHandoverAction({
    required String handoverId,
    required String action,
    String? note,
  }) async {
    final result = await _staffShiftService.performHandoverAction(
      handoverId: handoverId,
      action: action,
      note: note,
    );
    _staffShiftActionMessage = result.message;
    await _syncAfterStaffShiftChange();
  }

  Future<void> syncAllStaffShifts() async {
    final result = await _staffShiftService.syncAll();
    _staffShiftActionMessage = result.message;
    await _syncAfterStaffShiftChange();
  }

  Future<void> _syncAfterStaffShiftChange() async {
    await Future.wait([
      refreshStaffShift(silent: true),
      refreshDashboard(silent: true),
      refreshChefTasks(silent: true),
      refreshStaffPerformance(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshStaffWellness({bool silent = false}) async {
    if (!silent) {
      _staffWellnessLoading = true;
      notifyListeners();
    }

    try {
      _staffWellness = await _staffWellnessService.fetchBoard(
        section: _selectedSection,
      );
      _staffWellnessErrorMessage = null;
    } on ApiException catch (error) {
      _staffWellnessErrorMessage = error.message;
    } catch (_) {
      _staffWellnessErrorMessage = 'Unable to load staff wellness board.';
    }

    _staffWellnessLoading = false;
    notifyListeners();
  }

  Future<void> performStaffWellnessAlertAction({
    required String alertId,
    required String action,
  }) async {
    final result = await _staffWellnessService.performAlertAction(
      alertId: alertId,
      action: action,
    );
    _staffWellnessActionMessage = result.message;
    await _syncAfterStaffWellnessChange();
  }

  Future<void> performStaffWellnessRecommendationAction({
    required String recommendationId,
    required String action,
  }) async {
    final result = await _staffWellnessService.performRecommendationAction(
      recommendationId: recommendationId,
      action: action,
    );
    _staffWellnessActionMessage = result.message;
    await _syncAfterStaffWellnessChange();
  }

  Future<void> runStaffWellnessScan() async {
    final result = await _staffWellnessService.runScan();
    _staffWellnessActionMessage = result.message;
    await _syncAfterStaffWellnessChange();
  }

  Future<void> _syncAfterStaffWellnessChange() async {
    await Future.wait([
      refreshStaffWellness(silent: true),
      refreshDashboard(silent: true),
      refreshStaffShift(silent: true),
      refreshStaffPerformance(silent: true),
      refreshChefTasks(silent: true),
      refreshDelayEscalation(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshLiveAlerts({bool silent = false}) async {
    if (!silent) {
      _liveAlertLoading = true;
      notifyListeners();
    }

    try {
      _liveAlerts = await _liveAlertService.fetchBoard(
        section: _selectedSection,
      );
      _liveAlertErrorMessage = null;
    } on ApiException catch (error) {
      _liveAlertErrorMessage = error.message;
    } catch (_) {
      _liveAlertErrorMessage = 'Unable to load live alert board.';
    }

    _liveAlertLoading = false;
    notifyListeners();
  }

  Future<void> performLiveAlertAction({
    required String alertId,
    required String action,
  }) async {
    final result = await _liveAlertService.performAction(
      alertId: alertId,
      action: action,
    );
    _liveAlertActionMessage = result.message;
    await _syncAfterLiveAlertChange();
  }

  Future<void> syncAllLiveAlerts() async {
    final result = await _liveAlertService.syncAll();
    _liveAlertActionMessage = result.message;
    await _syncAfterLiveAlertChange();
  }

  Future<void> _syncAfterLiveAlertChange() async {
    await Future.wait([
      refreshLiveAlerts(silent: true),
      refreshDashboard(silent: true),
      refreshDelayEscalation(silent: true),
      refreshOrderPriority(silent: true),
      refreshInventory(silent: true),
      refreshEquipment(silent: true),
      refreshCleaningHygiene(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshPanicEmergency({bool silent = false}) async {
    if (!silent) {
      _panicEmergencyLoading = true;
      notifyListeners();
    }

    try {
      _panicEmergency = await _panicEmergencyService.fetchBoard(
        section: _selectedSection,
      );
      _panicEmergencyErrorMessage = null;
    } on ApiException catch (error) {
      _panicEmergencyErrorMessage = error.message;
    } catch (_) {
      _panicEmergencyErrorMessage =
          'Unable to load panic & emergency board.';
    }

    _panicEmergencyLoading = false;
    notifyListeners();
  }

  Future<void> triggerPanicButton({required String emergencyType}) async {
    final result = await _panicEmergencyService.triggerPanic(
      emergencyType: emergencyType,
      section: _selectedSection,
    );
    _panicEmergencyActionMessage = result.message;
    await _syncAfterPanicEmergencyChange();
  }

  Future<void> performPanicIncidentAction({
    required String incidentId,
    required String action,
  }) async {
    final result = await _panicEmergencyService.performIncidentAction(
      incidentId: incidentId,
      action: action,
    );
    _panicEmergencyActionMessage = result.message;
    await _syncAfterPanicEmergencyChange();
  }

  Future<void> performEvacuationAction({
    required String evacuationId,
    required String action,
  }) async {
    final result = await _panicEmergencyService.performEvacuationAction(
      evacuationId: evacuationId,
      action: action,
    );
    _panicEmergencyActionMessage = result.message;
    await _syncAfterPanicEmergencyChange();
  }

  Future<void> syncAllPanicEmergency() async {
    final result = await _panicEmergencyService.syncAll();
    _panicEmergencyActionMessage = result.message;
    await _syncAfterPanicEmergencyChange();
  }

  Future<void> _syncAfterPanicEmergencyChange() async {
    await Future.wait([
      refreshPanicEmergency(silent: true),
      refreshDashboard(silent: true),
      refreshLiveAlerts(silent: true),
      refreshDelayEscalation(silent: true),
      refreshEquipment(silent: true),
      refreshSmartEnergy(silent: true),
      refreshCleaningHygiene(silent: true),
      refreshQualityControl(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshOfflineFailover({bool silent = false}) async {
    if (!silent) {
      _offlineFailoverLoading = true;
      notifyListeners();
    }

    try {
      _offlineFailover = await _offlineFailoverService.fetchBoard(
        section: _selectedSection,
      );
      _offlineFailoverErrorMessage = null;
    } on ApiException catch (error) {
      _offlineFailoverErrorMessage = error.message;
    } catch (_) {
      _offlineFailoverErrorMessage =
          'Unable to load offline failover board.';
    }

    _offlineFailoverLoading = false;
    notifyListeners();
  }

  Future<void> performOfflineModuleAction({
    required String moduleId,
    required String action,
  }) async {
    final result = await _offlineFailoverService.performModuleAction(
      moduleId: moduleId,
      action: action,
    );
    _offlineFailoverActionMessage = result.message;
    await _syncAfterOfflineFailoverChange();
  }

  Future<void> performFailoverQueueAction({
    required String queueId,
    required String action,
  }) async {
    final result = await _offlineFailoverService.performQueueAction(
      queueId: queueId,
      action: action,
    );
    _offlineFailoverActionMessage = result.message;
    await _syncAfterOfflineFailoverChange();
  }

  Future<void> performQueueRecoveryAction({
    required String recoveryId,
    required String action,
  }) async {
    final result = await _offlineFailoverService.performRecoveryAction(
      recoveryId: recoveryId,
      action: action,
    );
    _offlineFailoverActionMessage = result.message;
    await _syncAfterOfflineFailoverChange();
  }

  Future<void> restoreOfflineSync() async {
    final result = await _offlineFailoverService.restoreSync();
    _offlineFailoverActionMessage = result.message;
    await _syncAfterOfflineFailoverChange();
  }

  Future<void> syncAllOfflineFailover() async {
    final result = await _offlineFailoverService.syncAll();
    _offlineFailoverActionMessage = result.message;
    await _syncAfterOfflineFailoverChange();
  }

  Future<void> _syncAfterOfflineFailoverChange() async {
    await Future.wait([
      refreshOfflineFailover(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshProcessing(silent: true),
      refreshPrep(silent: true),
      refreshLiveAlerts(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshAnalyticsReporting({bool silent = false}) async {
    if (!silent) {
      _analyticsReportingLoading = true;
      notifyListeners();
    }

    try {
      _analyticsReporting = await _analyticsReportingService.fetchBoard(
        section: _selectedSection,
      );
      _analyticsReportingErrorMessage = null;
    } on ApiException catch (error) {
      _analyticsReportingErrorMessage = error.message;
    } catch (_) {
      _analyticsReportingErrorMessage =
          'Unable to load analytics reporting board.';
    }

    _analyticsReportingLoading = false;
    notifyListeners();
  }

  Future<void> performAnalyticsReportAction({
    required String reportId,
    required String action,
  }) async {
    final result = await _analyticsReportingService.performReportAction(
      reportId: reportId,
      action: action,
    );
    _analyticsReportingActionMessage = result.message;
    await _syncAfterAnalyticsReportingChange();
  }

  Future<void> performAnalyticsInsightAction({
    required String insightId,
    required String action,
  }) async {
    final result = await _analyticsReportingService.performInsightAction(
      insightId: insightId,
      action: action,
    );
    _analyticsReportingActionMessage = result.message;
    await _syncAfterAnalyticsReportingChange();
  }

  Future<void> generateAllAnalyticsReports() async {
    final result = await _analyticsReportingService.generateAll();
    _analyticsReportingActionMessage = result.message;
    await _syncAfterAnalyticsReportingChange();
  }

  Future<void> _syncAfterAnalyticsReportingChange() async {
    await Future.wait([
      refreshAnalyticsReporting(silent: true),
      refreshDashboard(silent: true),
      refreshStaffPerformance(silent: true),
      refreshDelayEscalation(silent: true),
      refreshRecipeCosting(silent: true),
      refreshAiAssistant(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshKitchenHeatmap({bool silent = false}) async {
    if (!silent) {
      _kitchenHeatmapLoading = true;
      notifyListeners();
    }

    try {
      _kitchenHeatmap = await _kitchenHeatmapService.fetchBoard(
        section: _selectedSection,
      );
      _kitchenHeatmapErrorMessage = null;
    } on ApiException catch (error) {
      _kitchenHeatmapErrorMessage = error.message;
    } catch (_) {
      _kitchenHeatmapErrorMessage =
          'Unable to load live kitchen heatmap board.';
    }

    _kitchenHeatmapLoading = false;
    notifyListeners();
  }

  Future<void> performHeatmapStationAction({
    required String stationId,
    required String action,
  }) async {
    final result = await _kitchenHeatmapService.performStationAction(
      stationId: stationId,
      action: action,
    );
    _kitchenHeatmapActionMessage = result.message;
    await _syncAfterKitchenHeatmapChange();
  }

  Future<void> performDelayHotspotAction({
    required String hotspotId,
    required String action,
  }) async {
    final result = await _kitchenHeatmapService.performHotspotAction(
      hotspotId: hotspotId,
      action: action,
    );
    _kitchenHeatmapActionMessage = result.message;
    await _syncAfterKitchenHeatmapChange();
  }

  Future<void> performStaffDensityAction({
    required String densityId,
    required String action,
  }) async {
    final result = await _kitchenHeatmapService.performDensityAction(
      densityId: densityId,
      action: action,
    );
    _kitchenHeatmapActionMessage = result.message;
    await _syncAfterKitchenHeatmapChange();
  }

  Future<void> performRushZoneAction({
    required String rushId,
    required String action,
  }) async {
    final result = await _kitchenHeatmapService.performRushAction(
      rushId: rushId,
      action: action,
    );
    _kitchenHeatmapActionMessage = result.message;
    await _syncAfterKitchenHeatmapChange();
  }

  Future<void> refreshAllKitchenHeatmap() async {
    final result = await _kitchenHeatmapService.refreshAll();
    _kitchenHeatmapActionMessage = result.message;
    await _syncAfterKitchenHeatmapChange();
  }

  Future<void> _syncAfterKitchenHeatmapChange() async {
    await Future.wait([
      refreshKitchenHeatmap(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshSections(silent: true),
      refreshDelayEscalation(silent: true),
      refreshAnalyticsReporting(silent: true),
      refreshStaffPerformance(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshHardwareIntegration({bool silent = false}) async {
    if (!silent) {
      _hardwareIntegrationLoading = true;
      notifyListeners();
    }

    try {
      _hardwareIntegration = await _hardwareIntegrationService.fetchBoard(
        section: _selectedSection,
      );
      _hardwareIntegrationErrorMessage = null;
    } on ApiException catch (error) {
      _hardwareIntegrationErrorMessage = error.message;
    } catch (_) {
      _hardwareIntegrationErrorMessage =
          'Unable to load hardware integration board.';
    }

    _hardwareIntegrationLoading = false;
    notifyListeners();
  }

  Future<void> performDisplayAction({
    required String displayId,
    required String action,
  }) async {
    final result = await _hardwareIntegrationService.performDisplayAction(
      displayId: displayId,
      action: action,
    );
    _hardwareIntegrationActionMessage = result.message;
    await _syncAfterHardwareIntegrationChange();
  }

  Future<void> performTabletAction({
    required String tabletId,
    required String action,
  }) async {
    final result = await _hardwareIntegrationService.performTabletAction(
      tabletId: tabletId,
      action: action,
    );
    _hardwareIntegrationActionMessage = result.message;
    await _syncAfterHardwareIntegrationChange();
  }

  Future<void> performPrinterAction({
    required String printerId,
    required String action,
  }) async {
    final result = await _hardwareIntegrationService.performPrinterAction(
      printerId: printerId,
      action: action,
    );
    _hardwareIntegrationActionMessage = result.message;
    await _syncAfterHardwareIntegrationChange();
  }

  Future<void> performSmartwatchAction({
    required String watchId,
    required String action,
  }) async {
    final result = await _hardwareIntegrationService.performSmartwatchAction(
      watchId: watchId,
      action: action,
    );
    _hardwareIntegrationActionMessage = result.message;
    await _syncAfterHardwareIntegrationChange();
  }

  Future<void> performNfcAction({
    required String nfcId,
    required String action,
  }) async {
    final result = await _hardwareIntegrationService.performNfcAction(
      nfcId: nfcId,
      action: action,
    );
    _hardwareIntegrationActionMessage = result.message;
    await _syncAfterHardwareIntegrationChange();
  }

  Future<void> performScannerAction({
    required String scannerId,
    required String action,
  }) async {
    final result = await _hardwareIntegrationService.performScannerAction(
      scannerId: scannerId,
      action: action,
    );
    _hardwareIntegrationActionMessage = result.message;
    await _syncAfterHardwareIntegrationChange();
  }

  Future<void> syncAllHardwareIntegration() async {
    final result = await _hardwareIntegrationService.syncAll();
    _hardwareIntegrationActionMessage = result.message;
    await _syncAfterHardwareIntegrationChange();
  }

  Future<void> _syncAfterHardwareIntegrationChange() async {
    await Future.wait([
      refreshHardwareIntegration(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
      refreshIotDevice(silent: true),
      refreshOfflineFailover(silent: true),
      refreshKitchenHeatmap(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshSmartwatchSupport({bool silent = false}) async {
    if (!silent) {
      _smartwatchSupportLoading = true;
      notifyListeners();
    }

    try {
      _smartwatchSupport = await _smartwatchSupportService.fetchBoard(
        section: _selectedSection,
      );
      _smartwatchSupportErrorMessage = null;
    } on ApiException catch (error) {
      _smartwatchSupportErrorMessage = error.message;
    } catch (_) {
      _smartwatchSupportErrorMessage =
          'Unable to load smartwatch support board.';
    }

    _smartwatchSupportLoading = false;
    notifyListeners();
  }

  Future<void> performWatchOrderAction({
    required String alertId,
    required String action,
  }) async {
    final result = await _smartwatchSupportService.performOrderAction(
      alertId: alertId,
      action: action,
    );
    _smartwatchSupportActionMessage = result.message;
    await _syncAfterSmartwatchSupportChange();
  }

  Future<void> performWatchDelayAction({
    required String alertId,
    required String action,
  }) async {
    final result = await _smartwatchSupportService.performDelayAction(
      alertId: alertId,
      action: action,
    );
    _smartwatchSupportActionMessage = result.message;
    await _syncAfterSmartwatchSupportChange();
  }

  Future<void> performWatchEmergencyAction({
    required String alertId,
    required String action,
  }) async {
    final result = await _smartwatchSupportService.performEmergencyAction(
      alertId: alertId,
      action: action,
    );
    _smartwatchSupportActionMessage = result.message;
    await _syncAfterSmartwatchSupportChange();
  }

  Future<void> performWatchTaskAction({
    required String taskId,
    required String action,
  }) async {
    final result = await _smartwatchSupportService.performTaskAction(
      taskId: taskId,
      action: action,
    );
    _smartwatchSupportActionMessage = result.message;
    await _syncAfterSmartwatchSupportChange();
  }

  Future<void> pushAllSmartwatchAlerts() async {
    final result = await _smartwatchSupportService.pushAll();
    _smartwatchSupportActionMessage = result.message;
    await _syncAfterSmartwatchSupportChange();
  }

  Future<void> _syncAfterSmartwatchSupportChange() async {
    await Future.wait([
      refreshSmartwatchSupport(silent: true),
      refreshDashboard(silent: true),
      refreshLiveAlerts(silent: true),
      refreshPanicEmergency(silent: true),
      refreshDelayEscalation(silent: true),
      refreshChefTasks(silent: true),
      refreshHardwareIntegration(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshMultiBranch({bool silent = false}) async {
    if (!silent) {
      _multiBranchLoading = true;
      notifyListeners();
    }

    try {
      _multiBranch = await _multiBranchService.fetchBoard(
        section: _selectedSection,
      );
      _multiBranchErrorMessage = null;
    } on ApiException catch (error) {
      _multiBranchErrorMessage = error.message;
    } catch (_) {
      _multiBranchErrorMessage = 'Unable to load multi-branch board.';
    }

    _multiBranchLoading = false;
    notifyListeners();
  }

  Future<void> performCentralKitchenAction({
    required String kitchenId,
    required String action,
  }) async {
    final result = await _multiBranchService.performCentralAction(
      kitchenId: kitchenId,
      action: action,
    );
    _multiBranchActionMessage = result.message;
    await _syncAfterMultiBranchChange();
  }

  Future<void> performRecipeSyncAction({
    required String syncId,
    required String action,
  }) async {
    final result = await _multiBranchService.performRecipeAction(
      syncId: syncId,
      action: action,
    );
    _multiBranchActionMessage = result.message;
    await _syncAfterMultiBranchChange();
  }

  Future<void> performBranchKitchenAction({
    required String branchId,
    required String action,
  }) async {
    final result = await _multiBranchService.performBranchAction(
      branchId: branchId,
      action: action,
    );
    _multiBranchActionMessage = result.message;
    await _syncAfterMultiBranchChange();
  }

  Future<void> performSharedInventoryAction({
    required String inventoryId,
    required String action,
  }) async {
    final result = await _multiBranchService.performInventoryAction(
      inventoryId: inventoryId,
      action: action,
    );
    _multiBranchActionMessage = result.message;
    await _syncAfterMultiBranchChange();
  }

  Future<void> performDemandForecastAction({
    required String forecastId,
    required String action,
  }) async {
    final result = await _multiBranchService.performForecastAction(
      forecastId: forecastId,
      action: action,
    );
    _multiBranchActionMessage = result.message;
    await _syncAfterMultiBranchChange();
  }

  Future<void> syncAllMultiBranch() async {
    final result = await _multiBranchService.syncAll();
    _multiBranchActionMessage = result.message;
    await _syncAfterMultiBranchChange();
  }

  Future<void> _syncAfterMultiBranchChange() async {
    await Future.wait([
      refreshMultiBranch(silent: true),
      refreshDashboard(silent: true),
      refreshInventory(silent: true),
      refreshRecipeCosting(silent: true),
      refreshCloudKitchen(silent: true),
      refreshBatchCooking(silent: true),
      refreshAnalyticsReporting(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshAuditCompliance({bool silent = false}) async {
    if (!silent) {
      _auditComplianceLoading = true;
      notifyListeners();
    }

    try {
      _auditCompliance = await _auditComplianceService.fetchBoard(
        section: _selectedSection,
      );
      _auditComplianceErrorMessage = null;
    } on ApiException catch (error) {
      _auditComplianceErrorMessage = error.message;
    } catch (_) {
      _auditComplianceErrorMessage =
          'Unable to load audit & compliance board.';
    }

    _auditComplianceLoading = false;
    notifyListeners();
  }

  Future<void> performAuditActionLogAction({
    required String logId,
    required String action,
  }) async {
    final result = await _auditComplianceService.performActionLogAction(
      logId: logId,
      action: action,
    );
    _auditComplianceActionMessage = result.message;
    await _syncAfterAuditComplianceChange();
  }

  Future<void> performFoodSafetyLogAction({
    required String logId,
    required String action,
  }) async {
    final result = await _auditComplianceService.performFoodSafetyAction(
      logId: logId,
      action: action,
    );
    _auditComplianceActionMessage = result.message;
    await _syncAfterAuditComplianceChange();
  }

  Future<void> performHygieneLogAction({
    required String logId,
    required String action,
  }) async {
    final result = await _auditComplianceService.performHygieneAction(
      logId: logId,
      action: action,
    );
    _auditComplianceActionMessage = result.message;
    await _syncAfterAuditComplianceChange();
  }

  Future<void> performStaffActivityLogAction({
    required String logId,
    required String action,
  }) async {
    final result = await _auditComplianceService.performStaffActivityAction(
      logId: logId,
      action: action,
    );
    _auditComplianceActionMessage = result.message;
    await _syncAfterAuditComplianceChange();
  }

  Future<void> performIncidentLogAction({
    required String incidentId,
    required String action,
  }) async {
    final result = await _auditComplianceService.performIncidentAction(
      incidentId: incidentId,
      action: action,
    );
    _auditComplianceActionMessage = result.message;
    await _syncAfterAuditComplianceChange();
  }

  Future<void> exportAllAuditCompliance() async {
    final result = await _auditComplianceService.exportAll();
    _auditComplianceActionMessage = result.message;
    await _syncAfterAuditComplianceChange();
  }

  Future<void> _syncAfterAuditComplianceChange() async {
    await Future.wait([
      refreshAuditCompliance(silent: true),
      refreshDashboard(silent: true),
      refreshQualityControl(silent: true),
      refreshCleaningHygiene(silent: true),
      refreshSafety(silent: true),
      refreshStaffPerformance(silent: true),
      refreshCustomerReturn(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshBackupRecovery({bool silent = false}) async {
    if (!silent) {
      _backupRecoveryLoading = true;
      notifyListeners();
    }

    try {
      _backupRecovery = await _backupRecoveryService.fetchBoard(
        section: _selectedSection,
      );
      _backupRecoveryErrorMessage = null;
    } on ApiException catch (error) {
      _backupRecoveryErrorMessage = error.message;
    } catch (_) {
      _backupRecoveryErrorMessage =
          'Unable to load backup & recovery board.';
    }

    _backupRecoveryLoading = false;
    notifyListeners();
  }

  Future<void> performAutoBackupAction({
    required String backupId,
    required String action,
  }) async {
    final result = await _backupRecoveryService.performAutoBackupAction(
      backupId: backupId,
      action: action,
    );
    _backupRecoveryActionMessage = result.message;
    await _syncAfterBackupRecoveryChange();
  }

  Future<void> performManualBackupAction({
    required String backupId,
    required String action,
  }) async {
    final result = await _backupRecoveryService.performManualBackupAction(
      backupId: backupId,
      action: action,
    );
    _backupRecoveryActionMessage = result.message;
    await _syncAfterBackupRecoveryChange();
  }

  Future<void> performCloudSyncAction({
    required String syncId,
    required String action,
  }) async {
    final result = await _backupRecoveryService.performCloudSyncAction(
      syncId: syncId,
      action: action,
    );
    _backupRecoveryActionMessage = result.message;
    await _syncAfterBackupRecoveryChange();
  }

  Future<void> performRestoreAction({
    required String restoreId,
    required String action,
  }) async {
    final result = await _backupRecoveryService.performRestoreAction(
      restoreId: restoreId,
      action: action,
    );
    _backupRecoveryActionMessage = result.message;
    await _syncAfterBackupRecoveryChange();
  }

  Future<void> performDataRecoveryAction({
    required String recoveryId,
    required String action,
  }) async {
    final result = await _backupRecoveryService.performDataRecoveryAction(
      recoveryId: recoveryId,
      action: action,
    );
    _backupRecoveryActionMessage = result.message;
    await _syncAfterBackupRecoveryChange();
  }

  Future<void> runAllBackupRecovery() async {
    final result = await _backupRecoveryService.runAll();
    _backupRecoveryActionMessage = result.message;
    await _syncAfterBackupRecoveryChange();
  }

  Future<void> _syncAfterBackupRecoveryChange() async {
    await Future.wait([
      refreshBackupRecovery(silent: true),
      refreshDashboard(silent: true),
      refreshOfflineFailover(silent: true),
      refreshKds(silent: true),
      refreshPrep(silent: true),
      refreshAuditCompliance(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshSandboxTraining({bool silent = false}) async {
    if (!silent) {
      _sandboxTrainingLoading = true;
      notifyListeners();
    }

    try {
      _sandboxTraining = await _sandboxTrainingService.fetchBoard(
        section: _selectedSection,
      );
      _sandboxTrainingErrorMessage = null;
    } on ApiException catch (error) {
      _sandboxTrainingErrorMessage = error.message;
    } catch (_) {
      _sandboxTrainingErrorMessage =
          'Unable to load sandbox & training board.';
    }

    _sandboxTrainingLoading = false;
    notifyListeners();
  }

  Future<void> performDemoKitchenAction({
    required String demoId,
    required String action,
  }) async {
    final result = await _sandboxTrainingService.performDemoAction(
      demoId: demoId,
      action: action,
    );
    _sandboxTrainingActionMessage = result.message;
    await _syncAfterSandboxTrainingChange();
  }

  Future<void> performPracticeSessionAction({
    required String sessionId,
    required String action,
  }) async {
    final result = await _sandboxTrainingService.performPracticeAction(
      sessionId: sessionId,
      action: action,
    );
    _sandboxTrainingActionMessage = result.message;
    await _syncAfterSandboxTrainingChange();
  }

  Future<void> performSopTrainingAction({
    required String sopId,
    required String action,
  }) async {
    final result = await _sandboxTrainingService.performSopAction(
      sopId: sopId,
      action: action,
    );
    _sandboxTrainingActionMessage = result.message;
    await _syncAfterSandboxTrainingChange();
  }

  Future<void> performSimulationAction({
    required String simulationId,
    required String action,
  }) async {
    final result = await _sandboxTrainingService.performSimulationAction(
      simulationId: simulationId,
      action: action,
    );
    _sandboxTrainingActionMessage = result.message;
    await _syncAfterSandboxTrainingChange();
  }

  Future<void> launchAllSandboxTraining() async {
    final result = await _sandboxTrainingService.launchAll();
    _sandboxTrainingActionMessage = result.message;
    await _syncAfterSandboxTrainingChange();
  }

  Future<void> _syncAfterSandboxTrainingChange() async {
    await Future.wait([
      refreshSandboxTraining(silent: true),
      refreshDashboard(silent: true),
      refreshChefTasks(silent: true),
      refreshStaffPerformance(silent: true),
      refreshStaffShift(silent: true),
      refreshSafety(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshHiddenEnterprise({bool silent = false}) async {
    if (!silent) {
      _hiddenEnterpriseLoading = true;
      notifyListeners();
    }

    try {
      _hiddenEnterprise = await _hiddenEnterpriseService.fetchBoard(
        section: _selectedSection,
      );
      _hiddenEnterpriseErrorMessage = null;
    } on ApiException catch (error) {
      _hiddenEnterpriseErrorMessage = error.message;
    } catch (_) {
      _hiddenEnterpriseErrorMessage =
          'Unable to load hidden enterprise board.';
    }

    _hiddenEnterpriseLoading = false;
    notifyListeners();
  }

  Future<void> performSoftDeleteAction(String itemId, String action) async {
    final result = await _hiddenEnterpriseService.performSoftDeleteAction(
      itemId: itemId,
      action: action,
    );
    _hiddenEnterpriseActionMessage = result.message;
    await _syncAfterHiddenEnterpriseChange();
  }

  Future<void> performDeletedOrderAction(String orderId, String action) async {
    final result = await _hiddenEnterpriseService.performDeletedOrderAction(
      orderId: orderId,
      action: action,
    );
    _hiddenEnterpriseActionMessage = result.message;
    await _syncAfterHiddenEnterpriseChange();
  }

  Future<void> performActionReplayAction(String replayId, String action) async {
    final result = await _hiddenEnterpriseService.performActionReplayAction(
      replayId: replayId,
      action: action,
    );
    _hiddenEnterpriseActionMessage = result.message;
    await _syncAfterHiddenEnterpriseChange();
  }

  Future<void> performVersionLogAction(String versionId, String action) async {
    final result = await _hiddenEnterpriseService.performVersionLogAction(
      versionId: versionId,
      action: action,
    );
    _hiddenEnterpriseActionMessage = result.message;
    await _syncAfterHiddenEnterpriseChange();
  }

  Future<void> performDeviceTrackingAction(
    String deviceId,
    String action,
  ) async {
    final result = await _hiddenEnterpriseService.performDeviceTrackingAction(
      deviceId: deviceId,
      action: action,
    );
    _hiddenEnterpriseActionMessage = result.message;
    await _syncAfterHiddenEnterpriseChange();
  }

  Future<void> performSessionLogAction(String sessionId, String action) async {
    final result = await _hiddenEnterpriseService.performSessionLogAction(
      sessionId: sessionId,
      action: action,
    );
    _hiddenEnterpriseActionMessage = result.message;
    await _syncAfterHiddenEnterpriseChange();
  }

  Future<void> performLockdownAction(String lockdownId, String action) async {
    final result = await _hiddenEnterpriseService.performLockdownAction(
      lockdownId: lockdownId,
      action: action,
    );
    _hiddenEnterpriseActionMessage = result.message;
    await _syncAfterHiddenEnterpriseChange();
  }

  Future<void> performHiddenQueueRecoveryAction(
    String queueId,
    String action,
  ) async {
    final result = await _hiddenEnterpriseService.performQueueRecoveryAction(
      queueId: queueId,
      action: action,
    );
    _hiddenEnterpriseActionMessage = result.message;
    await _syncAfterHiddenEnterpriseChange();
  }

  Future<void> activateAllHiddenEnterprise() async {
    final result = await _hiddenEnterpriseService.activateAll();
    _hiddenEnterpriseActionMessage = result.message;
    await _syncAfterHiddenEnterpriseChange();
  }

  Future<void> _syncAfterHiddenEnterpriseChange() async {
    await Future.wait([
      refreshHiddenEnterprise(silent: true),
      refreshDashboard(silent: true),
      refreshBackupRecovery(silent: true),
      refreshAuditCompliance(silent: true),
      refreshOfflineFailover(silent: true),
      refreshKds(silent: true),
      refreshPanicEmergency(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshFutureAiExpansion({bool silent = false}) async {
    if (!silent) {
      _futureAiExpansionLoading = true;
      notifyListeners();
    }

    try {
      _futureAiExpansion = await _futureAiExpansionService.fetchBoard(
        section: _selectedSection,
      );
      _futureAiExpansionErrorMessage = null;
    } on ApiException catch (error) {
      _futureAiExpansionErrorMessage = error.message;
    } catch (_) {
      _futureAiExpansionErrorMessage =
          'Unable to load future AI expansion board.';
    }

    _futureAiExpansionLoading = false;
    notifyListeners();
  }

  Future<void> performFutureCookingAssistantAction(
    String entryId,
    String action,
  ) async {
    final result = await _futureAiExpansionService.performCookingAssistantAction(
      entryId: entryId,
      action: action,
    );
    _futureAiExpansionActionMessage = result.message;
    await _syncAfterFutureAiExpansionChange();
  }

  Future<void> performFutureRoboticKitchenAction(
    String entryId,
    String action,
  ) async {
    final result = await _futureAiExpansionService.performRoboticKitchenAction(
      entryId: entryId,
      action: action,
    );
    _futureAiExpansionActionMessage = result.message;
    await _syncAfterFutureAiExpansionChange();
  }

  Future<void> performFuturePlatingSuggestionAction(
    String entryId,
    String action,
  ) async {
    final result =
        await _futureAiExpansionService.performPlatingSuggestionAction(
      entryId: entryId,
      action: action,
    );
    _futureAiExpansionActionMessage = result.message;
    await _syncAfterFutureAiExpansionChange();
  }

  Future<void> performFutureWasteReductionAction(
    String entryId,
    String action,
  ) async {
    final result = await _futureAiExpansionService.performWasteReductionAction(
      entryId: entryId,
      action: action,
    );
    _futureAiExpansionActionMessage = result.message;
    await _syncAfterFutureAiExpansionChange();
  }

  Future<void> performFuturePrepAutomationAction(
    String entryId,
    String action,
  ) async {
    final result = await _futureAiExpansionService.performPrepAutomationAction(
      entryId: entryId,
      action: action,
    );
    _futureAiExpansionActionMessage = result.message;
    await _syncAfterFutureAiExpansionChange();
  }

  Future<void> activateAllFutureAiExpansion() async {
    final result = await _futureAiExpansionService.activateAll();
    _futureAiExpansionActionMessage = result.message;
    await _syncAfterFutureAiExpansionChange();
  }

  Future<void> _syncAfterFutureAiExpansionChange() async {
    await Future.wait([
      refreshFutureAiExpansion(silent: true),
      refreshDashboard(silent: true),
      refreshAiAssistant(silent: true),
      refreshInventory(silent: true),
      refreshPrep(silent: true),
      refreshRecipeCosting(silent: true),
      refreshBatchCooking(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> refreshWaiterAutoAssignment({bool silent = false}) async {
    if (!silent) {
      _waiterAutoAssignmentLoading = true;
      notifyListeners();
    }

    try {
      _waiterAutoAssignment = await _waiterAutoAssignmentService.fetchBoard(
        section: _selectedSection,
      );
      _waiterAutoAssignmentErrorMessage = null;
    } on ApiException catch (error) {
      _waiterAutoAssignmentErrorMessage = error.message;
    } catch (_) {
      _waiterAutoAssignmentErrorMessage =
          'Unable to load waiter auto assignment board.';
    }

    _waiterAutoAssignmentLoading = false;
    notifyListeners();
  }

  Future<void> autoAllocateWaiterTasks() async {
    final result = await _waiterAutoAssignmentService.autoAllocate();
    _waiterAutoAssignmentActionMessage = result.message;
    await _syncAfterWaiterAutoAssignmentChange();
  }

  Future<void> balanceWaiterWorkload() async {
    final result = await _waiterAutoAssignmentService.balanceWorkload();
    _waiterAutoAssignmentActionMessage = result.message;
    await _syncAfterWaiterAutoAssignmentChange();
  }

  Future<void> performWaiterTaskAction(String taskId, String action) async {
    final result = await _waiterAutoAssignmentService.performTaskAction(
      taskId: taskId,
      action: action,
    );
    _waiterAutoAssignmentActionMessage = result.message;
    await _syncAfterWaiterAutoAssignmentChange();
  }

  Future<void> performWaiterNotificationAction(
    String notificationId,
    String action,
  ) async {
    final result = await _waiterAutoAssignmentService.performNotificationAction(
      notificationId: notificationId,
      action: action,
    );
    _waiterAutoAssignmentActionMessage = result.message;
    await _syncAfterWaiterAutoAssignmentChange();
  }

  Future<void> _syncAfterWaiterAutoAssignmentChange() async {
    await Future.wait([
      refreshWaiterAutoAssignment(silent: true),
      refreshDashboard(silent: true),
      refreshExpeditor(silent: true),
      refreshKitchenCommunication(silent: true),
      refreshRoomService(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> optimizeSectionQueue() async {
    final result = await _sectionService.optimizeQueue();
    _sectionsActionMessage = result.message;
    await Future.wait([
      refreshSections(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> rerouteOrderToSection({
    required String orderId,
    required String section,
  }) async {
    await _sectionService.rerouteOrder(orderId: orderId, section: section);
    _sectionsActionMessage = 'Rerouted $orderId to $section section';
    await Future.wait([
      refreshSections(silent: true),
      refreshDashboard(silent: true),
      refreshKds(silent: true),
    ]);
    notifyListeners();
  }

  Future<void> assignSectionChef({
    required String sectionName,
    required String chefName,
  }) async {
    await _sectionService.assignChef(
      sectionName: sectionName,
      chefName: chefName,
    );
    _sectionsActionMessage = 'Assigned $chefName to $sectionName section';
    await refreshSections(silent: true);
    notifyListeners();
  }

  Future<void> applyRoutingRecommendation(
    RoutingRecommendation recommendation,
  ) async {
    switch (recommendation.action) {
      case 'balance_load':
        await optimizeSectionQueue();
      case 'assign_chef':
        final headChef = headChefForSection(recommendation.targetSection);
        final chef = headChef == null ? 'Relief chef' : 'Relief · $headChef';
        await assignSectionChef(
          sectionName: recommendation.targetSection,
          chefName: chef,
        );
      case 'none':
        _sectionsActionMessage = recommendation.message;
        notifyListeners();
      default:
        await optimizeSectionQueue();
    }
  }

  Future<void> performKdsAction(String orderId, String action) async {
    await _kdsService.performAction(orderId: orderId, action: action);
    await Future.wait([refreshKds(silent: true), refreshDashboard(silent: true)]);
  }

  Future<void> reorderKds(List<String> orderIds) async {
    await _kdsService.reorder(orderIds);
    await refreshKds(silent: true);
  }

  void selectNav(int index) {
    if (_selectedNav == index) {
      return;
    }
    _selectedNav = index;
    notifyListeners();
    if (index == 1) {
      unawaited(refreshKds());
    } else if (index == 2) {
      unawaited(refreshSections());
    } else if (index == 3) {
      unawaited(refreshProcessing());
    } else if (index == 4) {
      unawaited(refreshFiring());
    } else if (index == 5) {
      unawaited(refreshPrep());
    } else if (index == 6) {
      unawaited(refreshModifiers());
    } else if (index == 7) {
      unawaited(refreshChefTasks());
    } else if (index == 9) {
      unawaited(refreshSafety());
    } else if (index == 10) {
      unawaited(refreshAiAssistant());
    } else if (index == 11) {
      unawaited(refreshOrderPriority());
    } else if (index == 12) {
      unawaited(refreshKitchenCommunication());
    } else if (index == 13) {
      unawaited(refreshInventory());
    } else if (index == 14) {
      unawaited(refreshRecipeCosting());
    } else if (index == 15) {
      unawaited(refreshPrepStations());
    } else if (index == 16) {
      unawaited(refreshBatchCooking());
    } else if (index == 17) {
      unawaited(refreshDelayEscalation());
    } else if (index == 18) {
      unawaited(refreshQualityControl());
    } else if (index == 19) {
      unawaited(refreshCustomerReturn());
    } else if (index == 20) {
      unawaited(refreshExpeditor());
    } else if (index == 21) {
      unawaited(refreshPacking());
    } else if (index == 22) {
      unawaited(refreshDeliveryAggregator());
    } else if (index == 23) {
      unawaited(refreshBarBeverage());
    } else if (index == 24) {
      unawaited(refreshBakeryDessert());
    } else if (index == 25) {
      unawaited(refreshCloudKitchen());
    } else if (index == 26) {
      unawaited(refreshBanquet());
    } else if (index == 27) {
      unawaited(refreshRoomService());
    } else if (index == 28) {
      unawaited(refreshCleaningHygiene());
    } else if (index == 29) {
      unawaited(refreshEquipment());
    } else if (index == 30) {
      unawaited(refreshSmartEnergy());
    } else if (index == 31) {
      unawaited(refreshIotDevice());
    } else if (index == 32) {
      unawaited(refreshStaffPerformance());
    } else if (index == 33) {
      unawaited(refreshStaffShift());
    } else if (index == 34) {
      unawaited(refreshStaffWellness());
    } else if (index == 35) {
      unawaited(refreshLiveAlerts());
    } else if (index == 36) {
      unawaited(refreshPanicEmergency());
    } else if (index == 37) {
      unawaited(refreshOfflineFailover());
    } else if (index == 38) {
      unawaited(refreshAnalyticsReporting());
    } else if (index == 39) {
      unawaited(refreshKitchenHeatmap());
    } else if (index == 40) {
      unawaited(refreshHardwareIntegration());
    } else if (index == 41) {
      unawaited(refreshSmartwatchSupport());
    } else if (index == 42) {
      unawaited(refreshMultiBranch());
    } else if (index == 43) {
      unawaited(refreshAuditCompliance());
    } else if (index == 44) {
      unawaited(refreshBackupRecovery());
    } else if (index == 45) {
      unawaited(refreshSandboxTraining());
    } else if (index == 46) {
      unawaited(refreshHiddenEnterprise());
    } else if (index == 47) {
      unawaited(refreshFutureAiExpansion());
    }
  }

  void selectSection(String section) {
    if (_selectedSection == section) {
      return;
    }
    _selectedSection = section;
    notifyListeners();
    unawaited(
      Future.wait([
        refreshDashboard(),
        refreshKds(),
        refreshSections(),
        refreshProcessing(),
        refreshFiring(),
        refreshPrep(),
        refreshModifiers(),
        refreshSafety(),
        refreshChefTasks(),
        refreshAiAssistant(),
        refreshOrderPriority(),
        refreshKitchenCommunication(),
        refreshInventory(),
        refreshRecipeCosting(),
        refreshPrepStations(),
        refreshBatchCooking(),
        refreshDelayEscalation(),
        refreshQualityControl(),
        refreshCustomerReturn(),
        refreshExpeditor(),
        refreshPacking(),
        refreshDeliveryAggregator(),
        refreshBarBeverage(),
        refreshBakeryDessert(),
        refreshCloudKitchen(),
        refreshBanquet(),
        refreshRoomService(),
        refreshCleaningHygiene(),
        refreshEquipment(),
        refreshSmartEnergy(),
        refreshIotDevice(),
        refreshStaffPerformance(),
        refreshStaffShift(),
        refreshStaffWellness(),
        refreshLiveAlerts(),
        refreshPanicEmergency(),
        refreshOfflineFailover(),
        refreshAnalyticsReporting(),
        refreshKitchenHeatmap(),
        refreshHardwareIntegration(),
        refreshSmartwatchSupport(),
        refreshMultiBranch(),
        refreshAuditCompliance(),
        refreshBackupRecovery(),
        refreshSandboxTraining(),
        refreshHiddenEnterprise(),
        refreshFutureAiExpansion(),
      ]),
    );
  }

  void selectKdsViewMode(KdsViewMode mode) {
    if (_kdsViewMode == mode) {
      return;
    }
    _kdsViewMode = mode;
    if (mode == KdsViewMode.vip) {
      _kdsFilter = KdsFilter.vip;
    } else if (mode == KdsViewMode.priority) {
      _kdsFilter = KdsFilter.priority;
    } else if (_kdsFilter != KdsFilter.all) {
      _kdsFilter = KdsFilter.all;
    }
    notifyListeners();
    unawaited(refreshKds());
  }

  void selectKdsFilter(KdsFilter filter) {
    if (_kdsFilter == filter) {
      return;
    }
    _kdsFilter = filter;
    notifyListeners();
    unawaited(refreshKds());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _kdsTimer?.cancel();
    super.dispose();
  }
}
