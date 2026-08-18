import { z } from "zod";

export const RegisterBody = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["restaurant_owner", "super_admin"]).optional(),
});

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const HealthCheckResponse = z.object({
  status: z.string(),
});

export const CreateRestaurantBody = z.object({
  name: z.string(),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  currency: z.string().optional(),
  primaryColor: z.string().optional(),
  businessType: z.string().optional(),
  timezone: z.string().optional(),
});

export const UpdateRestaurantBody = CreateRestaurantBody.partial();
