/// HTTP and API contract constants for the waiter app.
class ApiConstants {
  const ApiConstants._();

  static const apiVersion = 'v1';
  static const defaultProductionBaseUrl =
      'https://digitalrestuarants.thefingo.com';

  static const connectTimeoutSeconds = 20;
  static const sessionTimeoutMinutes = 480;
  static const otpResendSeconds = 30;
  static const maxRetries = 1;

  static String apiRoot(String baseUrl) => '$baseUrl/api/$apiVersion';
  static String healthUrl(String baseUrl) => '$baseUrl/api/health';
}
