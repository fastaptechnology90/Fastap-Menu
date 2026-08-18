/// Canonical feature list for System 1 · Authentication & Security.
class AuthSystemCatalog {
  const AuthSystemCatalog._();

  static const title = 'Authentication & Security System';

  static const loginMethods = [
    'Mobile OTP login',
    'PIN login',
    'Password login',
    'QR staff login',
    'NFC login',
    'Face recognition login',
    'Fingerprint login',
  ];

  static const staffRoles = [
    'Head chef',
    'Sous chef',
    'Line cook',
    'Tandoor chef',
    'Chinese chef',
    'Beverage chef',
    'Dessert chef',
    'Bakery chef',
    'Kitchen helper',
    'Kitchen manager',
    'Expeditor',
    'Packing staff',
    'Waiter',
    'Housekeeping',
  ];

  static const securityFeatures = [
    'Shift-based login',
    'Device binding',
    'Session timeout',
    'Multi-device restriction',
    'Emergency logout',
    'Geo restriction',
    'Activity tracking',
    'Permission control',
    'Secure session handling',
  ];

  static const loginMethodCount = 7;
  static const staffRoleCount = 14;
  static const securityFeatureCount = 9;
}
