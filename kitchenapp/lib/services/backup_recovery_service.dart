import '../core/api/api_provider.dart';
import '../core/api/backup_recovery_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/backup_recovery/backup_recovery_snapshot.dart';
import '../services/auth_service.dart';

class BackupRecoveryService {
  BackupRecoveryService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory BackupRecoveryService.fromAuth(AuthService authService) {
    return BackupRecoveryService(apiClient: authService.apiClient);
  }

  Future<BackupRecoverySnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      BackupRecoveryEndpoints.board,
      query: {'section': section},
    );

    return BackupRecoverySnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<BackupRecoveryActionResult> performAutoBackupAction({
    required String backupId,
    required String action,
  }) async {
    final response = await _api.post(
      BackupRecoveryEndpoints.autoBackupAction(backupId),
      body: {'action': action},
    );
    return BackupRecoveryActionResult.fromJson(response);
  }

  Future<BackupRecoveryActionResult> performManualBackupAction({
    required String backupId,
    required String action,
  }) async {
    final response = await _api.post(
      BackupRecoveryEndpoints.manualBackupAction(backupId),
      body: {'action': action},
    );
    return BackupRecoveryActionResult.fromJson(response);
  }

  Future<BackupRecoveryActionResult> performCloudSyncAction({
    required String syncId,
    required String action,
  }) async {
    final response = await _api.post(
      BackupRecoveryEndpoints.cloudSyncAction(syncId),
      body: {'action': action},
    );
    return BackupRecoveryActionResult.fromJson(response);
  }

  Future<BackupRecoveryActionResult> performRestoreAction({
    required String restoreId,
    required String action,
  }) async {
    final response = await _api.post(
      BackupRecoveryEndpoints.restoreAction(restoreId),
      body: {'action': action},
    );
    return BackupRecoveryActionResult.fromJson(response);
  }

  Future<BackupRecoveryActionResult> performDataRecoveryAction({
    required String recoveryId,
    required String action,
  }) async {
    final response = await _api.post(
      BackupRecoveryEndpoints.dataRecoveryAction(recoveryId),
      body: {'action': action},
    );
    return BackupRecoveryActionResult.fromJson(response);
  }

  Future<BackupRecoveryActionResult> runAll() async {
    final response = await _api.post(BackupRecoveryEndpoints.runAll);
    return BackupRecoveryActionResult.fromJson(response);
  }
}
