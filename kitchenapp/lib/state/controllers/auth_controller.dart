import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_exception.dart';
import '../../core/config/api_config.dart';
import '../../core/storage/session_storage.dart';
import '../../models/auth/auth_session.dart';
import '../../models/auth/login_method.dart';
import '../../core/config/app_variant_config.dart';
import '../../core/config/app_variant_content.dart';
import '../../data/staff_role_registry.dart';
import '../../data/staff_role_access_policy.dart';
import '../../data/enterprise_system_nav_registry.dart';
import '../../models/auth/staff_role.dart';
import '../../services/api_connectivity_service.dart';
import '../../services/auth_service.dart';
import '../../services/feature_entitlements_service.dart';
import '../../models/features/feature_entitlements.dart';

enum AuthStatus {
  initial,
  loading,
  authenticated,
  unauthenticated,
  error,
}

class AuthController extends ChangeNotifier {
  AuthController({AuthService? authService})
      : _authService = authService ?? AuthService() {
    _authService.onSessionInvalidated = _handleRemoteSessionInvalidated;
  }

  final AuthService _authService;
  final SessionStorage _sessionStorage = SessionStorage();
  final ApiConnectivityService _connectivity = const ApiConnectivityService();
  final Uuid _uuid = const Uuid();

  AuthStatus _status = AuthStatus.initial;
  AuthSession? _session;
  FeatureEntitlementsSnapshot? _featureEntitlements;
  String? _errorMessage;
  String? _deviceId;
  String? _apiConnectivityMessage;
  Timer? _sessionTimer;
  DateTime? _lastActivityAt;

  AuthStatus get status => _status;
  AuthSession? get session => _session;
  String? get errorMessage => _errorMessage;
  String? get deviceId => _deviceId;
  String? get apiConnectivityMessage => _apiConnectivityMessage;
  String get apiBaseUrl => ApiConfig.activeBaseUrl;
  FeatureEntitlementsSnapshot? get featureEntitlements => _featureEntitlements;
  bool get isAuthenticated =>
      _status == AuthStatus.authenticated && _session != null;

  AuthService get authService => _authService;

  bool hasPermission(String permission) =>
      _session?.hasPermission(permission) ?? false;

  bool get canEmergencyLogout => hasPermission('emergency.logout');

  bool canAccessSystem(int systemNumber) {
    final session = _session;
    if (session == null) {
      return false;
    }
    if (_featureEntitlements != null &&
        !_featureEntitlements!.isSystemEnabled(systemNumber)) {
      return false;
    }
    return StaffRoleAccessPolicy.canAccessSystem(
      role: session.user.role,
      permissions: session.permissions,
      systemNumber: systemNumber,
    );
  }

  bool canAccessNav(int navIndex) {
    final session = _session;
    if (session == null) {
      return false;
    }

    final systemNumber =
        EnterpriseSystemNavRegistry.systemNumberForNavIndex(navIndex);
    if (systemNumber != null &&
        _featureEntitlements != null &&
        !_featureEntitlements!.isSystemEnabled(systemNumber)) {
      return false;
    }
    if (navIndex == 49 &&
        _featureEntitlements != null &&
        !_featureEntitlements!.isSystemEnabled(49)) {
      return false;
    }

    return StaffRoleAccessPolicy.canAccessNavIndex(
      role: session.user.role,
      permissions: session.permissions,
      navIndex: navIndex,
    );
  }

  bool isNavBlockedByEntitlements(int navIndex) {
    if (_featureEntitlements == null) {
      return false;
    }
    final systemNumber =
        EnterpriseSystemNavRegistry.systemNumberForNavIndex(navIndex);
    if (systemNumber != null &&
        !_featureEntitlements!.isSystemEnabled(systemNumber)) {
      return true;
    }
    return navIndex == 49 && !_featureEntitlements!.isSystemEnabled(49);
  }

  String? navAccessBlockReason(int navIndex) {
    final session = _session;
    if (session == null) {
      return 'Sign in to open this module.';
    }
    if (isNavBlockedByEntitlements(navIndex)) {
      return 'This module is disabled for your restaurant. '
          'Contact your manager or platform admin.';
    }
    if (!StaffRoleAccessPolicy.canAccessNavIndex(
      role: session.user.role,
      permissions: session.permissions,
      navIndex: navIndex,
    )) {
      return 'This module is not available for your staff role.';
    }
    return null;
  }

  List<MainShellTab> get visibleShellTabs {
    final session = _session;
    if (session == null) {
      return MainShellTab.values;
    }
    if (_featureEntitlements == null) {
      return StaffRoleAccessPolicy.visibleShellTabs(
        role: session.user.role,
        permissions: session.permissions,
      );
    }

    const kitchenNav = [1, 2, 3, 4, 5];
    const alertsNav = [12, 17, 35, 36];
    final tabs = <MainShellTab>[MainShellTab.home];

    if (kitchenNav.any(canAccessNav)) {
      tabs.add(MainShellTab.kitchen);
    }

    final hasOperations = [
      for (var systemNumber = 2; systemNumber <= 49; systemNumber++)
        if (canAccessSystem(systemNumber)) systemNumber,
    ].isNotEmpty;
    if (hasOperations) {
      tabs.add(MainShellTab.operations);
    }

    if (alertsNav.any(canAccessNav)) {
      tabs.add(MainShellTab.alerts);
    }

    tabs.add(MainShellTab.profile);
    return tabs;
  }

  static const double _kitchenLatitude = 19.0760;
  static const double _kitchenLongitude = 72.8777;

  Future<void> bootstrap() async {
    _setStatus(AuthStatus.loading);
    _deviceId = await _sessionStorage.loadDeviceId();
    _deviceId ??= _uuid.v4();
    await _sessionStorage.saveDeviceId(_deviceId!);

    if (!ApiConfig.useMockApi) {
      final health = await _connectivity.checkHealth();
      _apiConnectivityMessage = health.summary;
      if (!health.reachable) {
        _errorMessage =
            '${AppVariantContent.serverUnreachableMessage} '
            '(${ApiConfig.activeBaseUrl})';
      }
    }

    final restored = await _authService.restoreSession();
    if (restored != null) {
      if (!_isRoleAllowedForCurrentApp(restored.user.role)) {
        await _authService.logout();
        _errorMessage = StaffRoleRegistry.roleMismatchMessage(
          AppVariantConfig.variant,
        );
        _setStatus(AuthStatus.unauthenticated);
        return;
      }
      _session = restored;
      _lastActivityAt = DateTime.now();
      await _refreshFeatureEntitlements();
      _startSessionWatch();
      _setStatus(AuthStatus.authenticated);
      return;
    }

    _setStatus(AuthStatus.unauthenticated);
  }

  Future<bool> submitAccessRequest({
    required String name,
    required String email,
    required String phone,
    required String staffCode,
    required StaffRole role,
  }) async {
    return _profileAction(() async {
      await _authService.submitAccessRequest(
        name: name,
        email: email,
        phone: phone,
        staffCode: staffCode,
        role: role.name,
      );
    });
  }

  Future<bool> requestOtp(String phone, {StaffRole? role}) async {
    return _guard(() async {
      await _authService.requestOtp(
        phone,
        deviceId: _requireDeviceId(),
        role: role?.name,
      );
    });
  }

  Future<bool> verifyOtp(
    String phone,
    String otp, {
    StaffRole? role,
  }) async {
    return _guard(() async {
      _session = await _authService.verifyOtp(
        phone: phone,
        otp: otp,
        deviceId: _requireDeviceId(),
        role: role?.name,
        latitude: _kitchenLatitude,
        longitude: _kitchenLongitude,
      );
      await _onAuthenticated(LoginMethod.otp.name);
    });
  }

  Future<bool> loginWithPin(
    String staffCode,
    String pin, {
    required StaffRole role,
  }) async {
    return _guard(() async {
      _session = await _authService.loginWithPin(
        staffCode: staffCode,
        pin: pin,
        deviceId: _requireDeviceId(),
        role: role.name,
        latitude: _kitchenLatitude,
        longitude: _kitchenLongitude,
      );
      await _onAuthenticated(LoginMethod.pin.name);
    });
  }

  Future<bool> loginWithPassword(
    String staffCode,
    String password, {
    required StaffRole role,
  }) async {
    return _guard(() async {
      _session = await _authService.loginWithPassword(
        staffCode: staffCode,
        password: password,
        deviceId: _requireDeviceId(),
        role: role.name,
        latitude: _kitchenLatitude,
        longitude: _kitchenLongitude,
      );
      await _onAuthenticated(LoginMethod.password.name);
    });
  }

  Future<bool> loginWithQr(
    String qrToken, {
    required StaffRole role,
  }) async {
    return _guard(() async {
      _session = await _authService.loginWithQr(
        qrToken: qrToken,
        deviceId: _requireDeviceId(),
        role: role.name,
        latitude: _kitchenLatitude,
        longitude: _kitchenLongitude,
      );
      await _onAuthenticated(LoginMethod.qr.name);
    });
  }

  Future<bool> loginWithBiometric({
    required String staffCode,
    required LoginMethod method,
    required StaffRole role,
    bool deviceVerified = false,
    String? hardwareToken,
  }) async {
    return _guard(() async {
      _session = await _authService.loginWithBiometric(
        staffCode: staffCode,
        biometricType: method.name,
        deviceId: _requireDeviceId(),
        role: role.name,
        deviceVerified: deviceVerified,
        hardwareToken: hardwareToken,
        latitude: _kitchenLatitude,
        longitude: _kitchenLongitude,
      );
      await _onAuthenticated(method.name);
    });
  }

  Future<void> logout({bool emergency = false}) async {
    await _authService.logout(emergency: emergency);
    _sessionTimer?.cancel();
    _session = null;
    _setStatus(AuthStatus.unauthenticated);
  }

  Future<bool> updateProfile({
    String? name,
    String? phone,
    String? section,
    String? avatarBase64,
    bool clearAvatar = false,
  }) {
    return _profileAction(() async {
      _session = await _authService.updateProfile(
        name: name,
        phone: phone,
        section: section,
        avatarBase64: avatarBase64,
        clearAvatar: clearAvatar,
      );
      await _authService.logActivity('profile.update');
    });
  }

  Future<bool> changeEmail({
    required String email,
    required String password,
  }) {
    return _profileAction(() async {
      _session = await _authService.changeEmail(
        email: email,
        password: password,
      );
      await _authService.logActivity('profile.change_email');
    });
  }

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) {
    return _profileAction(() async {
      await _authService.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
      await _authService.logActivity('profile.change_password');
    });
  }

  Future<bool> deleteAccount({
    required String password,
    required String confirmation,
  }) {
    return _profileAction(() async {
      await _authService.deleteAccount(
        password: password,
        confirmation: confirmation,
      );
      _sessionTimer?.cancel();
      _session = null;
      _setStatus(AuthStatus.unauthenticated);
    });
  }

  Future<List<String>> refreshPermissions() async {
    _errorMessage = null;
    try {
      final permissions = await _authService.fetchPermissions();
      if (_session != null) {
        _session = _session!.copyWith(permissions: permissions);
      }
      notifyListeners();
      return permissions;
    } on ApiException catch (error) {
      _errorMessage = error.message;
      notifyListeners();
      rethrow;
    } catch (_) {
      _errorMessage = 'Unable to load permissions.';
      notifyListeners();
      rethrow;
    }
  }

  void recordActivity(String action) {
    _lastActivityAt = DateTime.now();
    unawaited(
      _authService.logActivity(
        action,
        deviceId: _deviceId,
      ),
    );
    notifyListeners();
  }

  Future<bool> _guard(Future<void> Function() action) async {
    _errorMessage = null;
    _setStatus(AuthStatus.loading);
    try {
      await action();
      return true;
    } on ApiException catch (error) {
      _errorMessage = error.code == 'DEVICE_CONFLICT'
          ? 'This staff account is already active on another device. '
              'Sign out there first or use emergency logout.'
          : error.message;
      _setStatus(
        _session == null ? AuthStatus.unauthenticated : AuthStatus.authenticated,
      );
      return false;
    } catch (_) {
      _errorMessage = 'Sign in failed. Check credentials and try again.';
      _setStatus(
        _session == null ? AuthStatus.unauthenticated : AuthStatus.authenticated,
      );
      return false;
    }
  }

  Future<bool> _profileAction(Future<void> Function() action) async {
    _errorMessage = null;
    try {
      await action();
      notifyListeners();
      return true;
    } on ApiException catch (error) {
      _errorMessage = error.message;
      notifyListeners();
      return false;
    } catch (_) {
      _errorMessage = 'Something went wrong. Please try again.';
      notifyListeners();
      return false;
    }
  }

  Future<void> _onAuthenticated(String method) async {
    final session = _session;
    if (session != null &&
        !_isRoleAllowedForCurrentApp(session.user.role)) {
      await _authService.logout();
      _session = null;
      _errorMessage = StaffRoleRegistry.roleMismatchMessage(
        AppVariantConfig.variant,
      );
      _setStatus(AuthStatus.unauthenticated);
      return;
    }

    _lastActivityAt = DateTime.now();
    await _authService.bindDevice(_requireDeviceId());
    await _authService.logActivity(
      'login',
      deviceId: _deviceId,
      meta: {'method': method},
    );
    await _refreshFeatureEntitlements();
    _startSessionWatch();
    _setStatus(AuthStatus.authenticated);
  }

  Future<void> _refreshFeatureEntitlements() async {
    final entitlements = await FeatureEntitlementsService(
      apiClient: _authService.apiClient,
    ).fetchEntitlements();
    if (entitlements == null) return;

    _featureEntitlements = entitlements;
    if (!ApiConfig.useMockApi) {
      try {
        final perms = await _authService.fetchPermissions();
        if (_session != null) {
          _session = _session!.copyWith(permissions: perms);
        }
      } catch (_) {
        // Permissions refresh is best-effort.
      }
    }
  }

  void _startSessionWatch() {
    _sessionTimer?.cancel();
    _sessionTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      final current = _session;
      if (current == null) {
        return;
      }

      if (current.isExpired) {
        unawaited(logout());
        _errorMessage = 'Session expired. Please sign in again.';
        notifyListeners();
        return;
      }

      final idleLimit = DateTime.now().subtract(
        Duration(minutes: ApiConfig.sessionTimeoutMinutes),
      );
      if (_lastActivityAt != null && _lastActivityAt!.isBefore(idleLimit)) {
        unawaited(logout());
        _errorMessage = 'Session timed out due to inactivity.';
        notifyListeners();
      }
    });
  }

  String _requireDeviceId() {
    final id = _deviceId;
    if (id == null) {
      throw ApiException(message: 'Device binding unavailable');
    }
    return id;
  }

  Future<ApiConnectivityResult> recheckApiConnectivity() async {
    final result = await _connectivity.checkHealth();
    _apiConnectivityMessage = result.summary;
    notifyListeners();
    return result;
  }

  void _handleRemoteSessionInvalidated() {
    if (_status != AuthStatus.authenticated) {
      return;
    }
    _sessionTimer?.cancel();
    _session = null;
    _featureEntitlements = null;
    _errorMessage = 'Session expired. Please sign in again.';
    _setStatus(AuthStatus.unauthenticated);
  }

  void _setStatus(AuthStatus value) {
    _status = value;
    notifyListeners();
  }

  bool _isRoleAllowedForCurrentApp(StaffRole role) =>
      StaffRoleRegistry.isRoleAllowedForCurrentApp(role);

  @override
  void dispose() {
    _sessionTimer?.cancel();
    _authService.dispose();
    super.dispose();
  }
}
