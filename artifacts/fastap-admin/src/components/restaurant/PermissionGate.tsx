import { useRestaurant } from "@/contexts/RestaurantContext";

export function PermissionGate({ permission, children, fallback = null }: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { checkPermission } = useRestaurant();
  if (!checkPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
