/// Platform currency — Indian Rupee only across the kitchen app.
class AppCurrency {
  const AppCurrency._();

  static const String code = 'INR';
  static const String symbol = '₹';

  static String format(num value, {int fractionDigits = 0}) {
    return '$symbol${value.toStringAsFixed(fractionDigits)}';
  }

  static String formatCompact(num value) {
    if (value >= 10000000) {
      return '$symbol${(value / 10000000).toStringAsFixed(1)}Cr';
    }
    if (value >= 100000) {
      return '$symbol${(value / 100000).toStringAsFixed(1)}L';
    }
    if (value >= 1000) {
      return '$symbol${(value / 1000).toStringAsFixed(1)}K';
    }
    return format(value);
  }
}
