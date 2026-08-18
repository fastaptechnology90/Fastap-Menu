import 'package:uuid/uuid.dart';

import '../../data/mock/mock_delay_escalation_engine.dart';
import '../../data/mock/mock_quality_control_engine.dart';
import '../../data/mock/mock_customer_return_engine.dart';
import '../../data/mock/mock_expeditor_engine.dart';
import '../../data/mock/mock_packing_engine.dart';
import '../../data/mock/mock_delivery_aggregator_engine.dart';
import '../../data/mock/mock_bar_beverage_engine.dart';
import '../../data/mock/mock_bakery_dessert_engine.dart';
import '../../data/mock/mock_cloud_kitchen_engine.dart';
import '../../data/mock/mock_banquet_engine.dart';
import '../../data/mock/mock_room_service_engine.dart';
import '../../data/mock/mock_cleaning_hygiene_engine.dart';
import '../../data/mock/mock_equipment_engine.dart';
import '../../data/mock/mock_smart_energy_engine.dart';
import '../../data/mock/mock_iot_device_engine.dart';
import '../../data/mock/mock_staff_performance_engine.dart';
import '../../data/mock/mock_staff_shift_engine.dart';
import '../../data/mock/mock_staff_wellness_engine.dart';
import '../../data/mock/mock_live_alert_engine.dart';
import '../../data/mock/mock_panic_emergency_engine.dart';
import '../../data/mock/mock_offline_failover_engine.dart';
import '../../data/mock/mock_analytics_reporting_engine.dart';
import '../../data/mock/mock_kitchen_heatmap_engine.dart';
import '../../data/mock/mock_hardware_integration_engine.dart';
import '../../data/mock/mock_smartwatch_support_engine.dart';
import '../../data/mock/mock_multi_branch_engine.dart';
import '../../data/mock/mock_audit_compliance_engine.dart';
import '../../data/mock/mock_backup_recovery_engine.dart';
import '../../data/mock/mock_sandbox_training_engine.dart';
import '../../data/mock/mock_hidden_enterprise_engine.dart';
import '../../data/mock/mock_future_ai_expansion_engine.dart';
import '../../data/mock/mock_dashboard_calculator.dart';
import '../../data/mock/mock_kds_engine.dart';
import '../../data/mock/mock_kitchen_orders.dart';
import '../../data/mock/mock_order_store.dart';
import '../../data/mock/mock_staff_directory.dart';
import '../../data/mock/mock_recipe_costing_engine.dart';
import '../../data/mock/mock_section_engine.dart';
import '../../data/mock/mock_course_firing_engine.dart';
import '../../data/mock/mock_batch_cooking_engine.dart';
import '../../data/mock/mock_chef_task_registry.dart';
import '../../data/mock/mock_ai_assistant_engine.dart';
import '../../data/mock/mock_allergy_safety_registry.dart';
import '../../data/mock/mock_inventory_engine.dart';
import '../../data/mock/mock_kitchen_communication_engine.dart';
import '../../data/mock/mock_modifier_engine.dart';
import '../../data/mock/mock_order_priority_engine.dart';
import '../../data/mock/mock_prep_station_engine.dart';
import '../../data/mock/mock_prep_engine.dart';
import '../../data/mock/mock_order_processing_engine.dart';
import '../api/ai_assistant_endpoints.dart';
import '../api/batch_cooking_endpoints.dart';
import '../api/chef_task_endpoints.dart';
import '../api/allergy_safety_endpoints.dart';
import '../api/course_firing_endpoints.dart';
import '../api/modifier_endpoints.dart';
import '../api/order_priority_endpoints.dart';
import '../api/prep_station_endpoints.dart';
import '../api/prep_endpoints.dart';
import '../api/inventory_endpoints.dart';
import '../api/kitchen_communication_endpoints.dart';
import '../api/kds_endpoints.dart';
import '../api/order_processing_endpoints.dart';
import '../api/recipe_costing_endpoints.dart';
import '../api/section_endpoints.dart';
import '../api/api_exception.dart';
import '../api/auth_endpoints.dart';
import '../api/delay_escalation_endpoints.dart';
import '../api/quality_control_endpoints.dart';
import '../api/customer_return_endpoints.dart';
import '../api/expeditor_endpoints.dart';
import '../api/packing_endpoints.dart';
import '../api/delivery_aggregator_endpoints.dart';
import '../api/bar_beverage_endpoints.dart';
import '../api/bakery_dessert_endpoints.dart';
import '../api/cloud_kitchen_endpoints.dart';
import '../api/banquet_endpoints.dart';
import '../api/room_service_endpoints.dart';
import '../api/cleaning_hygiene_endpoints.dart';
import '../api/equipment_endpoints.dart';
import '../api/smart_energy_endpoints.dart';
import '../api/iot_device_endpoints.dart';
import '../api/staff_performance_endpoints.dart';
import '../api/staff_shift_endpoints.dart';
import '../api/staff_wellness_endpoints.dart';
import '../api/live_alert_endpoints.dart';
import '../api/panic_emergency_endpoints.dart';
import '../api/offline_failover_endpoints.dart';
import '../api/analytics_reporting_endpoints.dart';
import '../api/kitchen_heatmap_endpoints.dart';
import '../api/hardware_integration_endpoints.dart';
import '../api/smartwatch_support_endpoints.dart';
import '../api/multi_branch_endpoints.dart';
import '../api/audit_compliance_endpoints.dart';
import '../api/backup_recovery_endpoints.dart';
import '../api/sandbox_training_endpoints.dart';
import '../api/hidden_enterprise_endpoints.dart';
import '../api/future_ai_expansion_endpoints.dart';
import '../api/waiter_auto_assignment_endpoints.dart';
import '../../data/mock/mock_waiter_auto_assignment_engine.dart';
import '../api/dashboard_endpoints.dart';
import '../api/kitchen_api_client.dart';
import '../config/api_config.dart';
import '../../models/auth/staff_role.dart';

class MockKitchenApiClient implements KitchenApiClient {
  MockKitchenApiClient();

  static final Map<String, Map<String, dynamic>> _sessions = {};
  static final Map<String, String> _otpStore = {};
  static final Map<String, String> _staffActiveDevices = {};
  static final Map<String, String> _staffActiveTokens = {};
  static const _uuid = Uuid();

  @override
  String? authToken;

  Future<void> _delay() async {
    await Future<void>.delayed(ApiConfig.mockNetworkDelay);
  }

  Map<String, dynamic>? _sessionFromToken(String? token) {
    if (token == null) {
      return null;
    }
    return _sessions[token];
  }

  Map<String, dynamic> _requireSession() {
    final session = _sessionFromToken(authToken);
    if (session == null) {
      throw const ApiException(message: 'Unauthorized', statusCode: 401);
    }
    return session;
  }

  void _enforceSingleDevice(String staffId, String deviceId) {
    if (deviceId.isEmpty) {
      return;
    }
    final activeDevice = _staffActiveDevices[staffId];
    if (activeDevice != null && activeDevice != deviceId) {
      throw const ApiException(
        message: 'Staff already logged in on another device',
        code: 'DEVICE_CONFLICT',
        statusCode: 409,
      );
    }
  }

  void _registerStaffDevice(String staffId, String deviceId, String token) {
    if (deviceId.isEmpty) {
      return;
    }
    _staffActiveDevices[staffId] = deviceId;
    _staffActiveTokens[staffId] = token;
  }

  void _releaseStaffSession(Map<String, dynamic> session) {
    final user = session['user'] as Map<String, dynamic>?;
    final staffId = user?['id']?.toString();
    if (staffId == null) {
      return;
    }
    if (_staffActiveTokens[staffId] == session['token']) {
      _staffActiveDevices.remove(staffId);
      _staffActiveTokens.remove(staffId);
    }
  }

  void _clearAllStaffDevices() {
    _staffActiveDevices.clear();
    _staffActiveTokens.clear();
  }

  Map<String, dynamic> _buildSession(
    Map<String, dynamic> staff, {
    required String loginMethod,
    required String deviceId,
    Map<String, dynamic>? requestBody,
  }) {
    final staffId = staff['id'] as String;
    _enforceSingleDevice(staffId, deviceId);

    final token = _uuid.v4();
    final safeUser = {
      'id': staff['id'],
      'name': staff['name'],
      'role': staff['role'],
      'section': staff['section'],
      'phone': staff['phone'],
      'staffCode': staff['staffCode'],
      'email': staff['email'] ?? '',
      if (staff['avatarUrl'] != null) 'avatarUrl': staff['avatarUrl'],
    };
    final session = {
      'token': token,
      'user': safeUser,
      'expiresAt': DateTime.now()
          .add(const Duration(hours: 8))
          .toIso8601String(),
      'deviceId': deviceId,
      'shiftId': 'SHIFT-${DateTime.now().day}${DateTime.now().hour}',
      'permissions': staff['permissions'],
      'loginMethod': loginMethod,
      'geoVerified': _geoVerifiedForRequest(requestBody),
    };
    _sessions[token] = session;
    _registerStaffDevice(staffId, deviceId, token);
    authToken = token;
    return session;
  }

  bool _geoVerifiedForRequest(Map<String, dynamic>? body) {
    if (body == null) {
      return true;
    }
    final lat = body['latitude'];
    final lng = body['longitude'];
    if (lat == null || lng == null) {
      return true;
    }
    return _verifyGeo(body);
  }

  bool _verifyGeo(Map<String, dynamic>? body) {
    if (body == null) {
      return true;
    }
    final lat = body['latitude'];
    final lng = body['longitude'];
    if (lat == null || lng == null) {
      return true;
    }
    final latitude = (lat as num).toDouble();
    final longitude = (lng as num).toDouble();
    return latitude > 18.9 &&
        latitude < 19.3 &&
        longitude > 72.7 &&
        longitude < 73.1;
  }

  void restoreSessionFromCache(Map<String, dynamic> sessionJson) {
    final token = sessionJson['token'] as String;
    _sessions[token] = sessionJson;
    authToken = token;
  }

  @override
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? query,
  }) async {
    await _delay();
    final section = query?['section'] ?? 'All';

    switch (path) {
      case AuthEndpoints.session:
        final session = _sessionFromToken(authToken);
        if (session == null) {
          throw const ApiException(message: 'Session not found', statusCode: 401);
        }
        return {'success': true, 'session': session};

      case AuthEndpoints.permissions:
        final session = _requireSession();
        return {
          'success': true,
          'permissions': session['permissions'],
        };

      case AuthEndpoints.shiftCurrent:
        final session = _requireSession();
        return {
          'success': true,
          'shift': {
            'id': session['shiftId'],
            'startedAt': DateTime.now()
                .subtract(const Duration(hours: 2))
                .toIso8601String(),
            'endsAt': DateTime.now()
                .add(const Duration(hours: 6))
                .toIso8601String(),
          },
        };

      case DashboardEndpoints.dashboard:
        _requireSession();
        return _dashboardResponse(section);

      case DashboardEndpoints.widgets:
        _requireSession();
        final dashboard = _buildDashboard(section);
        return {
          'success': true,
          'widgets': dashboard['widgets'],
          'lastSyncedAt': dashboard['lastSyncedAt'],
        };

      case DashboardEndpoints.metrics:
        _requireSession();
        final dashboard = _buildDashboard(section);
        return {
          'success': true,
          'metrics': dashboard['metrics'],
          'lastSyncedAt': dashboard['lastSyncedAt'],
        };

      case DashboardEndpoints.orders:
        _requireSession();
        final dashboard = _buildDashboard(section);
        return {
          'success': true,
          'orders': dashboard['orders'],
        };

      case KdsEndpoints.kds:
        _requireSession();
        final view = query?['view'] ?? 'queue';
        final filter = query?['filter'] ?? 'all';
        return {
          'success': true,
          'data': MockKdsEngine.buildPayload(
            section: section,
            view: view,
            filter: filter,
          ),
        };

      case SectionEndpoints.overview:
        _requireSession();
        final includeRouting = query?['includeRouting'] == 'true';
        final overview = MockSectionEngine.buildOverview(
          filterSection: section,
        );
        if (!includeRouting) {
          return {'success': true, 'data': overview};
        }
        return {
          'success': true,
          'data': {
            'overview': overview,
            'routing': MockSectionEngine.buildRoutingBoard(),
          },
        };

      case OrderProcessingEndpoints.processing:
        _requireSession();
        return {
          'success': true,
          'data': MockOrderProcessingEngine.buildSnapshot(section: section),
        };

      case CourseFiringEndpoints.sessions:
        _requireSession();
        return {
          'success': true,
          'data': MockCourseFiringEngine.buildSnapshot(section: section),
        };

      case PrepEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockPrepEngine.buildSnapshot(section: section),
        };

      case ModifierEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockModifierEngine.buildSnapshot(section: section),
        };

      case AllergySafetyEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockAllergySafetyEngine.buildSnapshot(section: section),
        };

      case ChefTaskEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockChefTaskEngine.buildSnapshot(section: section),
        };

      case AiAssistantEndpoints.assistant:
        _requireSession();
        return {
          'success': true,
          'data': MockAiAssistantEngine.buildSnapshot(section: section),
        };

      case OrderPriorityEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockOrderPriorityEngine.buildSnapshot(section: section),
        };

      case KitchenCommunicationEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockKitchenCommunicationEngine.buildSnapshot(section: section),
        };

      case InventoryEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockInventoryEngine.buildSnapshot(section: section),
        };

      case RecipeCostingEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockRecipeCostingEngine.buildSnapshot(section: section),
        };

      case PrepStationEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockPrepStationEngine.buildSnapshot(section: section),
        };

      case BatchCookingEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockBatchCookingEngine.buildSnapshot(section: section),
        };

      case DelayEscalationEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockDelayEscalationEngine.buildSnapshot(section: section),
        };

      case QualityControlEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockQualityControlEngine.buildSnapshot(section: section),
        };

      case CustomerReturnEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockCustomerReturnEngine.buildSnapshot(section: section),
        };

      case ExpeditorEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockExpeditorEngine.buildSnapshot(section: section),
        };

      case PackingEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockPackingEngine.buildSnapshot(section: section),
        };

      case DeliveryAggregatorEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockDeliveryAggregatorEngine.buildSnapshot(section: section),
        };

      case BarBeverageEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockBarBeverageEngine.buildSnapshot(section: section),
        };

      case BakeryDessertEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockBakeryDessertEngine.buildSnapshot(section: section),
        };

      case CloudKitchenEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockCloudKitchenEngine.buildSnapshot(section: section),
        };

      case BanquetEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockBanquetEngine.buildSnapshot(section: section),
        };

      case RoomServiceEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockRoomServiceEngine.buildSnapshot(section: section),
        };

      case CleaningHygieneEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockCleaningHygieneEngine.buildSnapshot(section: section),
        };

      case EquipmentEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockEquipmentEngine.buildSnapshot(section: section),
        };

      case SmartEnergyEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockSmartEnergyEngine.buildSnapshot(section: section),
        };

      case IotDeviceEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockIotDeviceEngine.buildSnapshot(section: section),
        };

      case StaffPerformanceEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockStaffPerformanceEngine.buildSnapshot(section: section),
        };

      case StaffShiftEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockStaffShiftEngine.buildSnapshot(section: section),
        };

      case StaffWellnessEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockStaffWellnessEngine.buildSnapshot(section: section),
        };

      case LiveAlertEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockLiveAlertEngine.buildSnapshot(section: section),
        };

      case PanicEmergencyEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockPanicEmergencyEngine.buildSnapshot(section: section),
        };

      case OfflineFailoverEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockOfflineFailoverEngine.buildSnapshot(section: section),
        };

      case AnalyticsReportingEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockAnalyticsReportingEngine.buildSnapshot(section: section),
        };

      case KitchenHeatmapEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockKitchenHeatmapEngine.buildSnapshot(section: section),
        };

      case HardwareIntegrationEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockHardwareIntegrationEngine.buildSnapshot(section: section),
        };

      case SmartwatchSupportEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockSmartwatchSupportEngine.buildSnapshot(section: section),
        };

      case MultiBranchEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockMultiBranchEngine.buildSnapshot(section: section),
        };

      case AuditComplianceEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockAuditComplianceEngine.buildSnapshot(section: section),
        };

      case BackupRecoveryEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockBackupRecoveryEngine.buildSnapshot(section: section),
        };

      case SandboxTrainingEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockSandboxTrainingEngine.buildSnapshot(section: section),
        };

      case HiddenEnterpriseEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockHiddenEnterpriseEngine.buildSnapshot(section: section),
        };

      case FutureAiExpansionEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockFutureAiExpansionEngine.buildSnapshot(section: section),
        };

      case WaiterAutoAssignmentEndpoints.board:
        _requireSession();
        return {
          'success': true,
          'data': MockWaiterAutoAssignmentEngine.buildSnapshot(section: section),
        };

      default:
        throw ApiException(message: 'Mock route not found: $path', statusCode: 404);
    }
  }

  @override
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    await _delay();
    final payload = body ?? {};

    if (path.startsWith('/sections/orders/') && path.endsWith('/reroute')) {
      _requireSession();
      final orderId = path.split('/')[3];
      final section = payload['section']?.toString() ?? '';
      MockSectionEngine.rerouteOrder(orderId, section);
      return {'success': true};
    }

    if (path.startsWith('/sections/') && path.endsWith('/assign-chef')) {
      _requireSession();
      final sectionId = path.split('/')[2];
      final chefName = payload['chefName']?.toString() ?? '';
      MockSectionEngine.assignChef(
        _sectionNameFromId(sectionId),
        chefName,
      );
      return {'success': true};
    }

    if (path.startsWith('/chef-tasks/') &&
        !path.endsWith('/balance') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final taskId = segments[2];
      final action = payload['action']?.toString() ?? '';
      try {
        return MockChefTaskEngine.performAction(
          taskId,
          action,
          targetChefId: payload['targetChefId']?.toString(),
          targetChefName: payload['targetChefName']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid chef task action');
      }
    }

    if (path.startsWith('/safety/cases/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final caseId = segments[3];
      final action = payload['action']?.toString() ?? '';
      try {
        return MockAllergySafetyEngine.performAction(caseId, action);
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid safety action');
      }
    }

    if (path.startsWith('/modifiers/orders/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final orderId = segments[3];
      final action = payload['action']?.toString() ?? '';
      try {
        return MockModifierEngine.performAction(
          orderId,
          action,
          modifierId: payload['modifierId']?.toString(),
          modifierType: payload['modifierType']?.toString(),
          itemName: payload['itemName']?.toString(),
          replacement: payload['replacement']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid modifier action');
      }
    }

    if (path.startsWith('/prep/tasks/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final taskId = segments[3];
      final action = payload['action']?.toString() ?? '';
      try {
        return MockPrepEngine.performAction(
          taskId,
          action,
          stepIndex: payload['stepIndex'] as int?,
          ingredient: payload['ingredient']?.toString(),
          mode: payload['mode']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid prep action');
      }
    }

    if (path.startsWith('/firing/sessions/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final sessionId = segments[3];
      final action = payload['action']?.toString() ?? '';
      try {
        return MockCourseFiringEngine.performAction(
          sessionId,
          action,
          courseType: payload['courseType']?.toString(),
          servingMode: payload['servingMode']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid firing action');
      }
    }

    if (path.startsWith('/delays/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final orderId = segments[2];
      try {
        return MockDelayEscalationRegistry.performAction(
          orderId: orderId,
          action: payload['action']?.toString() ?? '',
          reason: payload['reason']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid delay action');
      }
    }

    if (path.startsWith('/qc/checks/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final checkId = segments[3];
      try {
        return MockQualityControlRegistry.performCheckAction(
          checkId: checkId,
          action: payload['action']?.toString() ?? '',
          itemId: payload['itemId']?.toString(),
          passed: payload['passed'] as bool?,
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid QC check action');
      }
    }

    if (path.startsWith('/qc/orders/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final orderId = segments[3];
      try {
        return MockQualityControlRegistry.performOrderAction(
          orderId: orderId,
          action: payload['action']?.toString() ?? '',
          reason: payload['reason']?.toString(),
          supervisorName: payload['supervisorName']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid QC order action');
      }
    }

    if (path.startsWith('/returns/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final returnId = segments[2];
      try {
        return MockCustomerReturnRegistry.performAction(
          returnId: returnId,
          action: payload['action']?.toString() ?? '',
          tag: payload['tag']?.toString(),
          severity: payload['severity']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid return action');
      }
    }

    if (path.startsWith('/expeditor/tickets/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final ticketId = segments[3];
      try {
        return MockExpeditorRegistry.performTicketAction(
          ticketId: ticketId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid expeditor action');
      }
    }

    if (path.startsWith('/waiter-auto-assignment/tasks/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final taskId = segments[3];
      try {
        return MockWaiterAutoAssignmentEngine.performTaskAction(
          taskId: taskId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid waiter task action');
      }
    }

    if (path.startsWith('/waiter-auto-assignment/notifications/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final notificationId = segments[3];
      try {
        return MockWaiterAutoAssignmentEngine.performNotificationAction(
          notificationId: notificationId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid waiter notification action',
        );
      }
    }

    if (path.startsWith('/packing/jobs/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final jobId = segments[3];
      try {
        return MockPackingRegistry.performAction(
          jobId: jobId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid packing action');
      }
    }

    if (path.startsWith('/aggregator/orders/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final orderId = segments[3];
      try {
        return MockDeliveryAggregatorRegistry.performAction(
          orderId: orderId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid aggregator action');
      }
    }

    if (path.startsWith('/bar/drinks/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final drinkId = segments[3];
      try {
        return MockBarBeverageRegistry.performAction(
          drinkId: drinkId,
          action: payload['action']?.toString() ?? '',
          bartenderName: payload['bartenderName']?.toString(),
          customization: payload['customization']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid bar action');
      }
    }

    if (path.startsWith('/bakery/jobs/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final jobId = segments[3];
      try {
        return MockBakeryDessertRegistry.performAction(
          jobId: jobId,
          action: payload['action']?.toString() ?? '',
          customization: payload['customization']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid bakery action');
      }
    }

    if (path.startsWith('/cloud-kitchen/orders/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final orderId = segments[3];
      try {
        return MockCloudKitchenRegistry.performAction(
          orderId: orderId,
          action: payload['action']?.toString() ?? '',
          brandId: payload['brandId']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid cloud kitchen action');
      }
    }

    if (path.startsWith('/banquet/events/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final eventId = segments[3];
      try {
        return MockBanquetRegistry.performAction(
          eventId: eventId,
          action: payload['action']?.toString() ?? '',
          guestCount: payload['guestCount'] as int?,
          counterName: payload['counterName']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid banquet action');
      }
    }

    if (path.startsWith('/room-service/orders/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final orderId = segments[3];
      try {
        return MockRoomServiceRegistry.performAction(
          orderId: orderId,
          action: payload['action']?.toString() ?? '',
          trayId: payload['trayId']?.toString(),
          scheduledTime: payload['scheduledTime']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid room service action');
      }
    }

    if (path.startsWith('/hygiene/tasks/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final taskId = segments[3];
      try {
        return MockCleaningHygieneRegistry.performAction(
          taskId: taskId,
          action: payload['action']?.toString() ?? '',
          staffName: payload['staffName']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid hygiene action');
      }
    }

    if (path.startsWith('/equipment/assets/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final assetId = segments[3];
      try {
        return MockEquipmentRegistry.performAction(
          assetId: assetId,
          action: payload['action']?.toString() ?? '',
          issueSummary: payload['issueSummary']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid equipment action');
      }
    }

    if (path.startsWith('/energy/alerts/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final alertId = segments[3];
      try {
        return MockSmartEnergyRegistry.performAction(
          alertId: alertId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid energy action');
      }
    }

    if (path.startsWith('/iot/devices/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final deviceId = segments[3];
      try {
        return MockIotDeviceRegistry.performAction(
          deviceId: deviceId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid IoT action');
      }
    }

    if (path.startsWith('/staff-performance/staff/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final staffId = segments[3];
      try {
        return MockStaffPerformanceRegistry.performStaffAction(
          staffId: staffId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid staff performance action',
        );
      }
    }

    if (path.startsWith('/staff-performance/incentives/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final incentiveId = segments[3];
      try {
        return MockStaffPerformanceRegistry.performIncentiveAction(
          incentiveId: incentiveId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid incentive action');
      }
    }

    if (path.startsWith('/staff-shift/staff/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final staffId = segments[3];
      try {
        return MockStaffShiftRegistry.performStaffAction(
          staffId: staffId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid shift action');
      }
    }

    if (path.startsWith('/staff-shift/swaps/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final swapId = segments[3];
      try {
        return MockStaffShiftRegistry.performSwapAction(
          swapId: swapId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid swap action');
      }
    }

    if (path.startsWith('/staff-shift/handovers/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final handoverId = segments[3];
      try {
        return MockStaffShiftRegistry.performHandoverAction(
          handoverId: handoverId,
          action: payload['action']?.toString() ?? '',
          note: payload['note']?.toString(),
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid handover action');
      }
    }

    if (path.startsWith('/staff-wellness/alerts/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final alertId = segments[3];
      try {
        return MockStaffWellnessRegistry.performAlertAction(
          alertId: alertId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid wellness action');
      }
    }

    if (path.startsWith('/staff-wellness/recommendations/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final recommendationId = segments[3];
      try {
        return MockStaffWellnessRegistry.performRecommendationAction(
          recommendationId: recommendationId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid recommendation action',
        );
      }
    }

    if (path.startsWith('/live-alerts/') &&
        path.endsWith('/action') &&
        !path.contains('/sync/')) {
      _requireSession();
      final segments = path.split('/');
      final alertId = segments[2];
      try {
        return MockLiveAlertRegistry.performAction(
          alertId: alertId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid live alert action');
      }
    }

    if (path.startsWith('/panic-emergency/incidents/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final incidentId = segments[3];
      try {
        return MockPanicEmergencyRegistry.performIncidentAction(
          incidentId: incidentId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid incident action');
      }
    }

    if (path.startsWith('/panic-emergency/evacuations/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final evacuationId = segments[3];
      try {
        return MockPanicEmergencyRegistry.performEvacuationAction(
          evacuationId: evacuationId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid evacuation action',
        );
      }
    }

    if (path.startsWith('/offline-failover/modules/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final moduleId = segments[3];
      try {
        return MockOfflineFailoverRegistry.performModuleAction(
          moduleId: moduleId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid module action');
      }
    }

    if (path.startsWith('/offline-failover/queue/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final queueId = segments[3];
      try {
        return MockOfflineFailoverRegistry.performQueueAction(
          queueId: queueId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid queue action');
      }
    }

    if (path.startsWith('/offline-failover/recovery/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final recoveryId = segments[3];
      try {
        return MockOfflineFailoverRegistry.performRecoveryAction(
          recoveryId: recoveryId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid recovery action');
      }
    }

    if (path.startsWith('/analytics-reporting/reports/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final reportId = segments[3];
      try {
        return MockAnalyticsReportingRegistry.performReportAction(
          reportId: reportId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid report action');
      }
    }

    if (path.startsWith('/analytics-reporting/insights/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final insightId = segments[3];
      try {
        return MockAnalyticsReportingRegistry.performInsightAction(
          insightId: insightId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid insight action');
      }
    }

    if (path.startsWith('/kitchen-heatmap/stations/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final stationId = segments[3];
      try {
        return MockKitchenHeatmapRegistry.performStationAction(
          stationId: stationId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid station action');
      }
    }

    if (path.startsWith('/kitchen-heatmap/hotspots/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final hotspotId = segments[3];
      try {
        return MockKitchenHeatmapRegistry.performHotspotAction(
          hotspotId: hotspotId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid hotspot action');
      }
    }

    if (path.startsWith('/kitchen-heatmap/density/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final densityId = segments[3];
      try {
        return MockKitchenHeatmapRegistry.performDensityAction(
          densityId: densityId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid density action');
      }
    }

    if (path.startsWith('/kitchen-heatmap/rush/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final rushId = segments[3];
      try {
        return MockKitchenHeatmapRegistry.performRushAction(
          rushId: rushId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid rush action');
      }
    }

    if (path.startsWith('/hardware-integration/displays/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final displayId = segments[3];
      try {
        return MockHardwareIntegrationRegistry.performDisplayAction(
          displayId: displayId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid display action');
      }
    }

    if (path.startsWith('/hardware-integration/tablets/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final tabletId = segments[3];
      try {
        return MockHardwareIntegrationRegistry.performTabletAction(
          tabletId: tabletId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid tablet action');
      }
    }

    if (path.startsWith('/hardware-integration/printers/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final printerId = segments[3];
      try {
        return MockHardwareIntegrationRegistry.performPrinterAction(
          printerId: printerId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid printer action');
      }
    }

    if (path.startsWith('/hardware-integration/smartwatches/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final watchId = segments[3];
      try {
        return MockHardwareIntegrationRegistry.performSmartwatchAction(
          watchId: watchId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid smartwatch action');
      }
    }

    if (path.startsWith('/hardware-integration/nfc/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final nfcId = segments[3];
      try {
        return MockHardwareIntegrationRegistry.performNfcAction(
          nfcId: nfcId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid NFC action');
      }
    }

    if (path.startsWith('/hardware-integration/scanners/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final scannerId = segments[3];
      try {
        return MockHardwareIntegrationRegistry.performScannerAction(
          scannerId: scannerId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid scanner action');
      }
    }

    if (path.startsWith('/smartwatch-support/orders/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final alertId = segments[3];
      try {
        return MockSmartwatchSupportRegistry.performOrderAction(
          alertId: alertId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid order alert action');
      }
    }

    if (path.startsWith('/smartwatch-support/delays/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final alertId = segments[3];
      try {
        return MockSmartwatchSupportRegistry.performDelayAction(
          alertId: alertId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid delay alert action');
      }
    }

    if (path.startsWith('/smartwatch-support/emergency/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final alertId = segments[3];
      try {
        return MockSmartwatchSupportRegistry.performEmergencyAction(
          alertId: alertId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid emergency alert action',
        );
      }
    }

    if (path.startsWith('/smartwatch-support/tasks/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final taskId = segments[3];
      try {
        return MockSmartwatchSupportRegistry.performTaskAction(
          taskId: taskId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid task alert action');
      }
    }

    if (path.startsWith('/multi-branch/central/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final kitchenId = segments[3];
      try {
        return MockMultiBranchRegistry.performCentralAction(
          kitchenId: kitchenId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid central kitchen action',
        );
      }
    }

    if (path.startsWith('/multi-branch/recipes/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final syncId = segments[3];
      try {
        return MockMultiBranchRegistry.performRecipeAction(
          syncId: syncId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid recipe sync action');
      }
    }

    if (path.startsWith('/multi-branch/branches/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final branchId = segments[3];
      try {
        return MockMultiBranchRegistry.performBranchAction(
          branchId: branchId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid branch sync action');
      }
    }

    if (path.startsWith('/multi-branch/inventory/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final inventoryId = segments[3];
      try {
        return MockMultiBranchRegistry.performInventoryAction(
          inventoryId: inventoryId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid shared inventory action',
        );
      }
    }

    if (path.startsWith('/multi-branch/forecasts/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final forecastId = segments[3];
      try {
        return MockMultiBranchRegistry.performForecastAction(
          forecastId: forecastId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid forecast action');
      }
    }

    if (path.startsWith('/audit-compliance/actions/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final logId = segments[3];
      try {
        return MockAuditComplianceRegistry.performActionLogAction(
          logId: logId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid action log action');
      }
    }

    if (path.startsWith('/audit-compliance/food-safety/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final logId = segments[3];
      try {
        return MockAuditComplianceRegistry.performFoodSafetyAction(
          logId: logId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid food safety log action',
        );
      }
    }

    if (path.startsWith('/audit-compliance/hygiene/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final logId = segments[3];
      try {
        return MockAuditComplianceRegistry.performHygieneAction(
          logId: logId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid hygiene log action');
      }
    }

    if (path.startsWith('/audit-compliance/staff/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final logId = segments[3];
      try {
        return MockAuditComplianceRegistry.performStaffAction(
          logId: logId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid staff activity log action',
        );
      }
    }

    if (path.startsWith('/audit-compliance/incidents/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final incidentId = segments[3];
      try {
        return MockAuditComplianceRegistry.performIncidentAction(
          incidentId: incidentId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid incident log action');
      }
    }

    if (path.startsWith('/backup-recovery/auto/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final backupId = segments[3];
      try {
        return MockBackupRecoveryRegistry.performAutoAction(
          backupId: backupId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid auto backup action');
      }
    }

    if (path.startsWith('/backup-recovery/manual/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final backupId = segments[3];
      try {
        return MockBackupRecoveryRegistry.performManualAction(
          backupId: backupId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid manual backup action',
        );
      }
    }

    if (path.startsWith('/backup-recovery/cloud/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final syncId = segments[3];
      try {
        return MockBackupRecoveryRegistry.performCloudAction(
          syncId: syncId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid cloud sync action');
      }
    }

    if (path.startsWith('/backup-recovery/restores/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final restoreId = segments[3];
      try {
        return MockBackupRecoveryRegistry.performRestoreAction(
          restoreId: restoreId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid restore action');
      }
    }

    if (path.startsWith('/backup-recovery/recovery/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final recoveryId = segments[3];
      try {
        return MockBackupRecoveryRegistry.performRecoveryAction(
          recoveryId: recoveryId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid recovery action');
      }
    }

    if (path.startsWith('/sandbox-training/demo/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final demoId = segments[3];
      try {
        return MockSandboxTrainingRegistry.performDemoAction(
          demoId: demoId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid demo kitchen action');
      }
    }

    if (path.startsWith('/sandbox-training/practice/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final sessionId = segments[3];
      try {
        return MockSandboxTrainingRegistry.performPracticeAction(
          sessionId: sessionId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid practice session action',
        );
      }
    }

    if (path.startsWith('/sandbox-training/sop/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final sopId = segments[3];
      try {
        return MockSandboxTrainingRegistry.performSopAction(
          sopId: sopId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid SOP training action');
      }
    }

    if (path.startsWith('/sandbox-training/simulations/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final simulationId = segments[3];
      try {
        return MockSandboxTrainingRegistry.performSimulationAction(
          simulationId: simulationId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid simulation action');
      }
    }

    if (path.startsWith('/hidden-enterprise/soft-delete/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final itemId = segments[3];
      try {
        return MockHiddenEnterpriseRegistry.performSoftDeleteAction(
          itemId: itemId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid soft delete action');
      }
    }

    if (path.startsWith('/hidden-enterprise/orders/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final orderId = segments[3];
      try {
        return MockHiddenEnterpriseRegistry.performOrderAction(
          orderId: orderId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid deleted order action');
      }
    }

    if (path.startsWith('/hidden-enterprise/replays/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final replayId = segments[3];
      try {
        return MockHiddenEnterpriseRegistry.performReplayAction(
          replayId: replayId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid action replay action');
      }
    }

    if (path.startsWith('/hidden-enterprise/versions/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final versionId = segments[3];
      try {
        return MockHiddenEnterpriseRegistry.performVersionAction(
          versionId: versionId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid version log action');
      }
    }

    if (path.startsWith('/hidden-enterprise/devices/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final deviceId = segments[3];
      try {
        return MockHiddenEnterpriseRegistry.performDeviceAction(
          deviceId: deviceId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid device tracking action');
      }
    }

    if (path.startsWith('/hidden-enterprise/sessions/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final sessionId = segments[3];
      try {
        return MockHiddenEnterpriseRegistry.performSessionAction(
          sessionId: sessionId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid session log action');
      }
    }

    if (path.startsWith('/hidden-enterprise/lockdown/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final lockdownId = segments[3];
      try {
        return MockHiddenEnterpriseRegistry.performLockdownAction(
          lockdownId: lockdownId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid lockdown action');
      }
    }

    if (path.startsWith('/hidden-enterprise/queue/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final queueId = segments[3];
      try {
        return MockHiddenEnterpriseRegistry.performQueueAction(
          queueId: queueId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid queue recovery action');
      }
    }

    if (path.startsWith('/future-ai-expansion/cooking-assistant/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final entryId = segments[3];
      try {
        return MockFutureAiExpansionRegistry.performCookingAssistantAction(
          entryId: entryId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid cooking assistant action',
        );
      }
    }

    if (path.startsWith('/future-ai-expansion/robotic/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final entryId = segments[3];
      try {
        return MockFutureAiExpansionRegistry.performRoboticKitchenAction(
          entryId: entryId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid robotic kitchen action',
        );
      }
    }

    if (path.startsWith('/future-ai-expansion/plating/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final entryId = segments[3];
      try {
        return MockFutureAiExpansionRegistry.performPlatingSuggestionAction(
          entryId: entryId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid plating suggestion action',
        );
      }
    }

    if (path.startsWith('/future-ai-expansion/waste/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final entryId = segments[3];
      try {
        return MockFutureAiExpansionRegistry.performWasteReductionAction(
          entryId: entryId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid waste reduction action',
        );
      }
    }

    if (path.startsWith('/future-ai-expansion/prep-automation/') &&
        path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final entryId = segments[3];
      try {
        return MockFutureAiExpansionRegistry.performPrepAutomationAction(
          entryId: entryId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(
          message: error.message ?? 'Invalid prep automation action',
        );
      }
    }

    if (path.startsWith('/batch/cooking/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final batchId = segments[3];
      try {
        return MockBatchCookingRegistry.performAction(
          batchId: batchId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid batch action');
      }
    }

    if (path.startsWith('/prep/stations/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final stationId = segments[3];
      try {
        return MockPrepStationRegistry.performAction(
          stationId: stationId,
          action: payload['action']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid prep station action');
      }
    }

    if (path.startsWith('/prep/stations/') && path.endsWith('/assign')) {
      _requireSession();
      final segments = path.split('/');
      final stationId = segments[3];
      try {
        return MockPrepStationRegistry.assignStaff(
          stationId: stationId,
          staffName: payload['staffName']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid staff assignment');
      }
    }

    if (path.startsWith('/recipes/') && path.endsWith('/costing') && path.split('/').length == 4) {
      _requireSession();
      final recipeId = path.split('/')[2];
      try {
        return MockRecipeCostingRegistry.adjustPortion(
          recipeId: recipeId,
          portion: payload['portion']?.toString() ?? '',
        );
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid portion update');
      }
    }

    if (path.startsWith('/orders/') && path.endsWith('/priority')) {
      _requireSession();
      final segments = path.split('/');
      final orderId = segments[2];
      final action = payload['action']?.toString() ?? '';
      try {
        return MockOrderPriorityEngine.performAction(orderId, action);
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid priority action');
      }
    }

    if (path.startsWith('/orders/') && path.endsWith('/process')) {
      _requireSession();
      final segments = path.split('/');
      final orderId = segments[2];
      final action = payload['action']?.toString() ?? '';
      try {
        final updated = MockOrderStore.processAction(
          orderId,
          action,
          targetSection: payload['targetSection']?.toString(),
          itemName: payload['itemName']?.toString(),
          modification: payload['modification']?.toString(),
        );
        return {
          'success': true,
          'order': MockDashboardCalculator.serializeOrder(updated),
        };
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Invalid action');
      }
    }

    if (path.startsWith('/kds/orders/') && path.endsWith('/action')) {
      _requireSession();
      final segments = path.split('/');
      final orderId = segments[3];
      final action = payload['action']?.toString() ?? '';
      try {
        final updated = MockOrderStore.processAction(orderId, action);
        return {
          'success': true,
          'order': MockDashboardCalculator.serializeOrder(updated),
        };
      } on ArgumentError catch (error) {
        throw ApiException(message: error.message ?? 'Unknown KDS action');
      }
    }

    switch (path) {
      case AuthEndpoints.register:
        final role = payload['role']?.toString() ?? '';
        if (role.isEmpty ||
            !StaffRole.values.any((entry) => entry.name == role)) {
          throw const ApiException(
            message: 'Please select a valid staff role',
            statusCode: 400,
          );
        }
        return {
          'success': true,
          'message':
              'Registration submitted. An administrator will review your request.',
          'role': role,
        };

      case AuthEndpoints.otpRequest:
        final phone = payload['phone']?.toString() ?? '';
        if (MockStaffDirectory.byPhone(phone) == null) {
          throw const ApiException(
            message: 'Mobile number not registered',
            statusCode: 404,
          );
        }
        _otpStore[phone] = '123456';
        return {
          'success': true,
          'message': 'OTP sent successfully',
          'expiresInSeconds': 300,
        };

      case AuthEndpoints.otpVerify:
        return _loginWithOtp(payload);

      case AuthEndpoints.pinLogin:
        return _loginWithPin(payload);

      case AuthEndpoints.passwordLogin:
        return _loginWithPassword(payload);

      case AuthEndpoints.qrVerify:
        return _loginWithQr(payload);

      case AuthEndpoints.biometricLogin:
        return _loginWithBiometric(payload);

      case AuthEndpoints.deviceBind:
        final session = _requireSession();
        session['deviceId'] = payload['deviceId'];
        return {'success': true, 'message': 'Device bound successfully'};

      case AuthEndpoints.activity:
        final session = _requireSession();
        final deviceId = payload['deviceId']?.toString() ?? '';
        final sessionDevice = session['deviceId']?.toString() ?? '';
        if (deviceId.isNotEmpty &&
            sessionDevice.isNotEmpty &&
            deviceId != sessionDevice) {
          throw const ApiException(
            message: 'Activity rejected for unbound device',
            code: 'DEVICE_MISMATCH',
            statusCode: 403,
          );
        }
        session['lastActivityAt'] = DateTime.now().toIso8601String();
        return {'success': true, 'lastActivityAt': session['lastActivityAt']};

      case AuthEndpoints.logout:
        final session = _sessionFromToken(authToken);
        if (session != null) {
          _releaseStaffSession(session);
          _sessions.remove(session['token']);
        }
        authToken = null;
        return {'success': true};

      case AuthEndpoints.emergencyLogout:
        _sessions.clear();
        _clearAllStaffDevices();
        authToken = null;
        return {
          'success': true,
          'message': 'Emergency logout executed',
        };

      case AuthEndpoints.profile:
        return _updateProfile(payload);

      case AuthEndpoints.changeEmail:
        return _changeEmail(payload);

      case AuthEndpoints.changePassword:
        return _changePassword(payload);

      case AuthEndpoints.deleteAccount:
        return _deleteAccount(payload);

      case KdsEndpoints.reorder:
        _requireSession();
        final ids = (payload['orderIds'] as List<dynamic>)
            .map((item) => item.toString())
            .toList();
        MockOrderStore.reorder(ids);
        return {'success': true};

      case SectionEndpoints.optimize:
        _requireSession();
        return {
          'success': true,
          ...MockSectionEngine.optimizeQueue(),
        };

      case OrderProcessingEndpoints.optimize:
        _requireSession();
        return {
          'success': true,
          ...MockOrderProcessingEngine.optimizeQueue(),
        };

      case CourseFiringEndpoints.syncPacing:
        _requireSession();
        return {
          'success': true,
          ...MockCourseFiringEngine.syncAllPacing(),
        };

      case ChefTaskEndpoints.balance:
        _requireSession();
        return {
          'success': true,
          ...MockChefTaskEngine.balanceWorkload(),
        };

      case AiAssistantEndpoints.apply:
        _requireSession();
        final suggestionId = payload['suggestionId']?.toString() ?? '';
        return {
          'success': true,
          ...MockAiAssistantEngine.applySuggestion(suggestionId),
        };

      case AiAssistantEndpoints.voice:
        _requireSession();
        final command = payload['command']?.toString() ?? '';
        final orderId = payload['orderId']?.toString();
        try {
          return MockAiAssistantEngine.executeVoiceCommand(
            command,
            orderId: orderId,
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Invalid voice command');
        }

      case OrderPriorityEndpoints.reprioritize:
        _requireSession();
        return {
          'success': true,
          ...MockOrderPriorityEngine.reprioritizeQueue(),
        };

      case KitchenCommunicationEndpoints.message:
        _requireSession();
        try {
          return MockKitchenCommunicationRegistry.sendMessage(
            threadId: payload['threadId']?.toString() ?? '',
            message: payload['message']?.toString() ?? '',
            sender: payload['sender']?.toString() ?? 'Kitchen Team',
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Invalid message');
        }

      case KitchenCommunicationEndpoints.voiceNote:
        _requireSession();
        try {
          return MockKitchenCommunicationRegistry.sendVoiceNote(
            threadId: payload['threadId']?.toString() ?? '',
            sender: payload['sender']?.toString() ?? 'Kitchen Team',
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Invalid voice note');
        }

      case KitchenCommunicationEndpoints.delayUpdate:
        _requireSession();
        try {
          return MockKitchenCommunicationRegistry.sendDelayUpdate(
            orderId: payload['orderId']?.toString() ?? '',
            minutes: payload['minutes'] as int? ?? 5,
            sender: payload['sender']?.toString() ?? 'Kitchen Team',
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Invalid delay update');
        }

      case KitchenCommunicationEndpoints.announcement:
        _requireSession();
        return MockKitchenCommunicationRegistry.postAnnouncement(
          title: payload['title']?.toString() ?? '',
          body: payload['body']?.toString() ?? '',
          author: payload['author']?.toString() ?? 'Kitchen Team',
          scope: payload['scope']?.toString() ?? 'All',
        );

      case KitchenCommunicationEndpoints.broadcast:
        _requireSession();
        return MockKitchenCommunicationRegistry.sendBroadcast(
          message: payload['message']?.toString() ?? '',
          author: payload['author']?.toString() ?? 'Kitchen Team',
          scope: payload['scope']?.toString() ?? 'All',
        );

      case KitchenCommunicationEndpoints.alertAction:
        _requireSession();
        try {
          return MockKitchenCommunicationRegistry.performAlertAction(
            alertId: payload['alertId']?.toString() ?? '',
            action: payload['action']?.toString() ?? '',
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Invalid alert action');
        }

      case InventoryEndpoints.sync:
        _requireSession();
        return {
          'success': true,
          ...MockInventoryRegistry.syncStock(),
        };

      case InventoryEndpoints.deduct:
        _requireSession();
        try {
          return MockInventoryRegistry.deductIngredient(
            itemId: payload['itemId']?.toString() ?? '',
            quantity: (payload['quantity'] as num?)?.toDouble() ?? 0,
            orderId: payload['orderId']?.toString(),
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Invalid deduction');
        }

      case InventoryEndpoints.validate:
        _requireSession();
        try {
          return MockInventoryRegistry.validateRecipeStock(
            orderId: payload['orderId']?.toString(),
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Validation failed');
        }

      case InventoryEndpoints.substitute:
        _requireSession();
        try {
          return MockInventoryRegistry.applySubstitution(
            itemId: payload['itemId']?.toString() ?? '',
            substituteId: payload['substituteId']?.toString() ?? '',
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Invalid substitution');
        }

      case InventoryEndpoints.alertAction:
        _requireSession();
        try {
          return MockInventoryRegistry.performAlertAction(
            alertId: payload['alertId']?.toString() ?? '',
            action: payload['action']?.toString() ?? '',
          );
        } on ArgumentError catch (error) {
          throw ApiException(
            message: error.message ?? 'Invalid inventory alert action',
          );
        }

      case RecipeCostingEndpoints.refresh:
        _requireSession();
        return {
          'success': true,
          ...MockRecipeCostingRegistry.refreshCosting(),
        };

      case RecipeCostingEndpoints.waste:
        _requireSession();
        try {
          return MockRecipeCostingRegistry.recordWaste(
            recipeId: payload['recipeId']?.toString() ?? '',
            plates: (payload['plates'] as num?)?.toDouble() ?? 1,
            reason: payload['reason']?.toString() ?? 'Kitchen waste',
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Invalid waste record');
        }

      case PrepStationEndpoints.balance:
        _requireSession();
        return {
          'success': true,
          ...MockPrepStationRegistry.balanceQueues(),
        };

      case BatchCookingEndpoints.forecast:
        _requireSession();
        return {
          'success': true,
          ...MockBatchCookingRegistry.refreshForecast(),
        };

      case DelayEscalationEndpoints.reason:
        _requireSession();
        try {
          return MockDelayEscalationRegistry.logDelayReason(
            orderId: payload['orderId']?.toString() ?? '',
            reason: payload['reason']?.toString() ?? 'Kitchen backlog',
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Invalid delay reason');
        }

      case DelayEscalationEndpoints.autoEscalate:
        _requireSession();
        return {
          'success': true,
          ...MockDelayEscalationRegistry.autoEscalateAll(),
        };

      case QualityControlEndpoints.randomAudit:
        _requireSession();
        try {
          return MockQualityControlRegistry.triggerRandomAudit(
            section: payload['section']?.toString(),
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Unable to trigger audit');
        }

      case QualityControlEndpoints.complaints:
        _requireSession();
        try {
          return MockQualityControlRegistry.logComplaint(
            orderId: payload['orderId']?.toString() ?? '',
            reason: payload['reason']?.toString() ?? 'Guest complaint',
            severity: payload['severity']?.toString() ?? 'medium',
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Unable to log complaint');
        }

      case CustomerReturnEndpoints.create:
        _requireSession();
        try {
          return MockCustomerReturnRegistry.createReturn(
            orderId: payload['orderId']?.toString() ?? '',
            returnType: payload['returnType']?.toString() ?? 'refire',
            reason: payload['reason']?.toString() ?? 'Guest return',
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Unable to create return');
        }

      case ExpeditorEndpoints.coordinate:
        _requireSession();
        try {
          return MockExpeditorRegistry.coordinateSections(
            groupId: payload['groupId']?.toString(),
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Unable to coordinate');
        }

      case ExpeditorEndpoints.syncTables:
        _requireSession();
        try {
          return MockExpeditorRegistry.syncTables(
            tableNumber: payload['tableNumber']?.toString(),
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Unable to sync tables');
        }

      case PackingEndpoints.printLabels:
        _requireSession();
        try {
          return MockPackingRegistry.printAllLabels(
            jobId: payload['jobId']?.toString(),
          );
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Unable to print labels');
        }

      case DeliveryAggregatorEndpoints.syncAll:
        _requireSession();
        return MockDeliveryAggregatorRegistry.syncAllOrders();

      case BarBeverageEndpoints.balanceQueue:
        _requireSession();
        try {
          return MockBarBeverageRegistry.balanceQueue();
        } on ArgumentError catch (error) {
          throw ApiException(message: error.message ?? 'Unable to balance queue');
        }

      case BakeryDessertEndpoints.startProduction:
        _requireSession();
        return MockBakeryDessertRegistry.startProduction(
          itemName: payload['itemName']?.toString(),
        );

      case CloudKitchenEndpoints.balanceLoad:
        _requireSession();
        return MockCloudKitchenRegistry.balanceLoad();

      case BanquetEndpoints.startSchedule:
        _requireSession();
        return MockBanquetRegistry.startSchedule(
          eventName: payload['eventName']?.toString(),
        );

      case RoomServiceEndpoints.dispatchTray:
        _requireSession();
        return MockRoomServiceRegistry.dispatchTray(
          orderId: payload['orderId']?.toString(),
        );

      case CleaningHygieneEndpoints.startAudit:
        _requireSession();
        return MockCleaningHygieneRegistry.startAudit(
          auditType: payload['auditType']?.toString(),
        );

      case EquipmentEndpoints.raiseMaintenance:
        _requireSession();
        return MockEquipmentRegistry.raiseMaintenance(
          assetId: payload['assetId']?.toString(),
          issueSummary: payload['issueSummary']?.toString(),
        );

      case SmartEnergyEndpoints.triggerShutdown:
        _requireSession();
        return MockSmartEnergyRegistry.triggerShutdown(
          equipmentName: payload['equipmentName']?.toString(),
        );

      case IotDeviceEndpoints.syncAll:
        _requireSession();
        return MockIotDeviceRegistry.syncAll();

      case StaffPerformanceEndpoints.recalculate:
        _requireSession();
        return MockStaffPerformanceRegistry.recalculate();

      case StaffShiftEndpoints.syncAll:
        _requireSession();
        return MockStaffShiftRegistry.syncAll();

      case StaffWellnessEndpoints.runScan:
        _requireSession();
        return MockStaffWellnessRegistry.runScan();

      case LiveAlertEndpoints.syncAll:
        _requireSession();
        return MockLiveAlertRegistry.syncAll();

      case PanicEmergencyEndpoints.triggerPanic:
        _requireSession();
        return MockPanicEmergencyRegistry.triggerPanic(
          emergencyType: payload['emergencyType']?.toString(),
          section: payload['section']?.toString(),
        );

      case PanicEmergencyEndpoints.syncAll:
        _requireSession();
        return MockPanicEmergencyRegistry.syncAll();

      case OfflineFailoverEndpoints.restoreSync:
        _requireSession();
        return MockOfflineFailoverRegistry.restoreSync();

      case OfflineFailoverEndpoints.syncAll:
        _requireSession();
        return MockOfflineFailoverRegistry.syncAll();

      case AnalyticsReportingEndpoints.generateAll:
        _requireSession();
        return MockAnalyticsReportingRegistry.generateAll();

      case KitchenHeatmapEndpoints.refreshAll:
        _requireSession();
        return MockKitchenHeatmapRegistry.refreshAll();

      case HardwareIntegrationEndpoints.syncAll:
        _requireSession();
        return MockHardwareIntegrationRegistry.syncAll();

      case SmartwatchSupportEndpoints.pushAll:
        _requireSession();
        return MockSmartwatchSupportRegistry.pushAll();

      case MultiBranchEndpoints.syncAll:
        _requireSession();
        return MockMultiBranchRegistry.syncAll();

      case AuditComplianceEndpoints.exportAll:
        _requireSession();
        return MockAuditComplianceRegistry.exportAll();

      case BackupRecoveryEndpoints.runAll:
        _requireSession();
        return MockBackupRecoveryRegistry.runAll();

      case SandboxTrainingEndpoints.launchAll:
        _requireSession();
        return MockSandboxTrainingRegistry.launchAll();

      case HiddenEnterpriseEndpoints.activateAll:
        _requireSession();
        return MockHiddenEnterpriseRegistry.activateAll();

      case FutureAiExpansionEndpoints.activateAll:
        _requireSession();
        return MockFutureAiExpansionRegistry.activateAll();

      case WaiterAutoAssignmentEndpoints.autoAllocate:
        _requireSession();
        return MockWaiterAutoAssignmentEngine.autoAllocate();

      case WaiterAutoAssignmentEndpoints.balanceWorkload:
        _requireSession();
        return MockWaiterAutoAssignmentEngine.balanceWorkload();

      default:
        throw ApiException(message: 'Mock route not found: $path', statusCode: 404);
    }
  }

  void _assertStaffRole(Map<String, dynamic> staff, Map<String, dynamic> body) {
    final role = body['role']?.toString();
    if (role == null || role.isEmpty) {
      return;
    }
    if (staff['role']?.toString() != role) {
      throw const ApiException(
        message: 'Selected role does not match this staff account',
        statusCode: 403,
        code: 'ROLE_MISMATCH',
      );
    }
  }

  Map<String, dynamic> _loginWithOtp(Map<String, dynamic> body) {
    if (!_verifyGeo(body)) {
      throw const ApiException(
        message: 'Login blocked outside approved kitchen geo zone',
        code: 'GEO_BLOCKED',
      );
    }
    final phone = body['phone']?.toString() ?? '';
    final otp = body['otp']?.toString() ?? '';
    final staff = MockStaffDirectory.byPhone(phone);
    if (staff == null || _otpStore[phone] != otp) {
      throw const ApiException(message: 'Invalid OTP', statusCode: 401);
    }
    _assertStaffRole(staff, body);
    _ensureStaffActive(staff);
    final session = _buildSession(
      staff,
      loginMethod: 'otp',
      deviceId: body['deviceId']?.toString() ?? '',
      requestBody: body,
    );
    return {'success': true, 'data': session};
  }

  Map<String, dynamic> _loginWithPin(Map<String, dynamic> body) {
    if (!_verifyGeo(body)) {
      throw const ApiException(
        message: 'Login blocked outside approved kitchen geo zone',
        code: 'GEO_BLOCKED',
      );
    }
    final staffCode = body['staffCode']?.toString() ?? '';
    final pin = body['pin']?.toString() ?? '';
    final staff = MockStaffDirectory.byCode(staffCode);
    if (staff == null || staff['pin'] != pin) {
      throw const ApiException(
        message: 'Invalid staff code or PIN',
        statusCode: 401,
      );
    }
    _assertStaffRole(staff, body);
    _ensureStaffActive(staff);
    final session = _buildSession(
      staff,
      loginMethod: 'pin',
      deviceId: body['deviceId']?.toString() ?? '',
      requestBody: body,
    );
    return {'success': true, 'data': session};
  }

  Map<String, dynamic> _loginWithPassword(Map<String, dynamic> body) {
    if (!_verifyGeo(body)) {
      throw const ApiException(
        message: 'Login blocked outside approved kitchen geo zone',
        code: 'GEO_BLOCKED',
      );
    }
    final staffCode = body['staffCode']?.toString() ?? '';
    final password = body['password']?.toString() ?? '';
    final staff = MockStaffDirectory.byCode(staffCode);
    if (staff == null || staff['password'] != password) {
      throw const ApiException(
        message: 'Invalid staff code or password',
        statusCode: 401,
      );
    }
    _assertStaffRole(staff, body);
    _ensureStaffActive(staff);
    final session = _buildSession(
      staff,
      loginMethod: 'password',
      deviceId: body['deviceId']?.toString() ?? '',
      requestBody: body,
    );
    return {'success': true, 'data': session};
  }

  Map<String, dynamic> _loginWithQr(Map<String, dynamic> body) {
    if (!_verifyGeo(body)) {
      throw const ApiException(
        message: 'Login blocked outside approved kitchen geo zone',
        code: 'GEO_BLOCKED',
      );
    }
    final qrToken = body['qrToken']?.toString() ?? '';
    final staff = MockStaffDirectory.byCode(qrToken);
    if (staff == null) {
      throw const ApiException(
        message: 'Invalid QR staff token',
        statusCode: 401,
      );
    }
    _assertStaffRole(staff, body);
    _ensureStaffActive(staff);
    final session = _buildSession(
      staff,
      loginMethod: 'qr',
      deviceId: body['deviceId']?.toString() ?? '',
      requestBody: body,
    );
    return {'success': true, 'data': session};
  }

  Map<String, dynamic> _loginWithBiometric(Map<String, dynamic> body) {
    if (!_verifyGeo(body)) {
      throw const ApiException(
        message: 'Login blocked outside approved kitchen geo zone',
        code: 'GEO_BLOCKED',
      );
    }
    final staffCode = body['staffCode']?.toString() ?? '';
    final biometricType = body['biometricType']?.toString() ?? '';
    final staff = MockStaffDirectory.byCode(staffCode);
    if (staff == null) {
      throw const ApiException(
        message: 'Biometric profile not enrolled',
        statusCode: 401,
      );
    }
    _assertStaffRole(staff, body);
    _ensureStaffActive(staff);
    if (!{'face', 'fingerprint', 'nfc'}.contains(biometricType)) {
      throw const ApiException(message: 'Unsupported biometric type');
    }

    if (biometricType == 'face' || biometricType == 'fingerprint') {
      if (body['deviceVerified'] != true) {
        throw const ApiException(
          message: 'Complete device biometric verification first',
          statusCode: 403,
        );
      }
      final token = body['hardwareToken']?.toString();
      if (token != null &&
          token.isNotEmpty &&
          token != 'local-auth-verified') {
        throw const ApiException(
          message: 'Device biometric verification failed',
          statusCode: 403,
        );
      }
    }

    final hardwareToken = body['hardwareToken']?.toString();
    if (biometricType == 'nfc' &&
        hardwareToken != null &&
        hardwareToken.isNotEmpty) {
      final normalizedToken = hardwareToken.toUpperCase();
      final staffCodeNormalized = staffCode.toUpperCase();
      if (normalizedToken != staffCodeNormalized &&
          !normalizedToken.contains(staffCodeNormalized)) {
        throw const ApiException(
          message: 'NFC badge does not match staff code',
          statusCode: 403,
        );
      }
    }

    final session = _buildSession(
      staff,
      loginMethod: biometricType,
      deviceId: body['deviceId']?.toString() ?? '',
      requestBody: body,
    );
    return {'success': true, 'data': session};
  }

  Map<String, dynamic> _buildDashboard(String section) {
    final filtered = MockKitchenOrders.filterBySection(
      MockKitchenOrders.orders,
      section,
    );
    return MockDashboardCalculator.buildDashboard(
      section: section,
      orders: filtered,
    );
  }

  Map<String, dynamic> _dashboardResponse(String section) {
    return {
      'success': true,
      'data': _buildDashboard(section),
    };
  }

  String _sectionNameFromId(String sectionId) {
    return switch (sectionId.toLowerCase()) {
      'main' => 'Main',
      'tandoor' => 'Tandoor',
      'chinese' => 'Chinese',
      'beverage' => 'Beverage',
      'dessert' => 'Dessert',
      'bakery' => 'Bakery',
      'bar' => 'Bar',
      'grill' => 'Grill',
      'fry' => 'Fry',
      'salad' => 'Salad',
      'pizza' => 'Pizza',
      _ => sectionId,
    };
  }

  @override
  Future<Map<String, dynamic>> delete(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    await _delay();
    throw ApiException(message: 'Mock route not found: $path', statusCode: 404);
  }

  @override
  void dispose() {}

  void _ensureStaffActive(Map<String, dynamic> staff) {
    if (staff['deleted'] == true) {
      throw const ApiException(
        message: 'This account has been deleted',
        statusCode: 403,
      );
    }
  }

  Map<String, dynamic> _staffRecordForSession(Map<String, dynamic> session) {
    final user = session['user'] as Map<String, dynamic>;
    final staff = MockStaffDirectory.byId(user['id'] as String) ??
        MockStaffDirectory.byCode(user['staffCode'] as String);
    if (staff == null) {
      throw const ApiException(
        message: 'Staff record not found',
        statusCode: 404,
      );
    }
    return staff;
  }

  void _syncSessionUser(
    Map<String, dynamic> session,
    Map<String, dynamic> staff,
  ) {
    final user = session['user'] as Map<String, dynamic>;
    user['name'] = staff['name'];
    user['phone'] = staff['phone'];
    user['section'] = staff['section'];
    user['email'] = staff['email'] ?? '';
    if (staff['avatarUrl'] != null) {
      user['avatarUrl'] = staff['avatarUrl'];
    } else {
      user.remove('avatarUrl');
    }
  }

  Map<String, dynamic> _updateProfile(Map<String, dynamic> payload) {
    final session = _requireSession();
    final staff = _staffRecordForSession(session);
    final name = payload['name']?.toString().trim();
    final phone = payload['phone']?.toString().trim();
    final section = payload['section']?.toString().trim();
    final avatarBase64 = payload['avatarBase64']?.toString();
    final clearAvatar = payload['clearAvatar'] == true;
    if (name != null && name.isNotEmpty) {
      staff['name'] = name;
    }
    if (phone != null && phone.isNotEmpty) {
      staff['phone'] = phone;
    }
    if (section != null && section.isNotEmpty) {
      staff['section'] = section;
    }
    if (clearAvatar) {
      staff.remove('avatarUrl');
    } else if (avatarBase64 != null && avatarBase64.isNotEmpty) {
      staff['avatarUrl'] = 'data:image/jpeg;base64,$avatarBase64';
    }
    _syncSessionUser(session, staff);
    return {
      'success': true,
      'session': session,
      'message': 'Profile updated successfully',
    };
  }

  Map<String, dynamic> _changeEmail(Map<String, dynamic> payload) {
    final session = _requireSession();
    final staff = _staffRecordForSession(session);
    final password = payload['password']?.toString() ?? '';
    final email = payload['email']?.toString().trim() ?? '';
    if (staff['password'] != password) {
      throw const ApiException(
        message: 'Incorrect password',
        statusCode: 401,
      );
    }
    if (!email.contains('@') || !email.contains('.')) {
      throw const ApiException(
        message: 'Enter a valid email address',
        statusCode: 400,
      );
    }
    staff['email'] = email;
    _syncSessionUser(session, staff);
    return {
      'success': true,
      'session': session,
      'message': 'Work email updated successfully',
    };
  }

  Map<String, dynamic> _changePassword(Map<String, dynamic> payload) {
    final session = _requireSession();
    final staff = _staffRecordForSession(session);
    final current = payload['currentPassword']?.toString() ?? '';
    final next = payload['newPassword']?.toString() ?? '';
    if (staff['password'] != current) {
      throw const ApiException(
        message: 'Current password is incorrect',
        statusCode: 401,
      );
    }
    if (next.length < 6) {
      throw const ApiException(
        message: 'Password must be at least 6 characters',
        statusCode: 400,
      );
    }
    staff['password'] = next;
    return {
      'success': true,
      'message': 'Password changed successfully',
    };
  }

  Map<String, dynamic> _deleteAccount(Map<String, dynamic> payload) {
    final session = _requireSession();
    final staff = _staffRecordForSession(session);
    final password = payload['password']?.toString() ?? '';
    final confirmation = payload['confirmation']?.toString() ?? '';
    if (staff['password'] != password) {
      throw const ApiException(
        message: 'Incorrect password',
        statusCode: 401,
      );
    }
    if (confirmation != 'DELETE') {
      throw const ApiException(
        message: 'Type DELETE to confirm account removal',
        statusCode: 400,
      );
    }
    staff['deleted'] = true;
    _releaseStaffSession(session);
    _sessions.remove(session['token']);
    authToken = null;
    return {
      'success': true,
      'message': 'Account deleted permanently',
    };
  }
}
