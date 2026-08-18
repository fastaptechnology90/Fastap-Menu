import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Save, CreditCard, Flame, KeyRound, MessageSquare, Mail, Cloud, MapPin, Plug,
} from "lucide-react";
import { api, type IntegrationsConfig, type IntegrationServiceDef } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";

const CATEGORY_META: Record<string, { label: string; icon: typeof CreditCard }> = {
  payments: { label: "Payment Gateways", icon: CreditCard },
  firebase: { label: "Firebase", icon: Flame },
  auth: { label: "OAuth / Auth", icon: KeyRound },
  messaging: { label: "SMS & WhatsApp", icon: MessageSquare },
  email: { label: "Email", icon: Mail },
  storage: { label: "Storage & CDN", icon: Cloud },
  maps: { label: "Maps", icon: MapPin },
};

type Props = {
  integrations?: IntegrationsConfig;
  onSaved?: (cfg: IntegrationsConfig) => void;
};

export default function IntegrationsSettings({ integrations, onSaved }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: schemaData, isLoading: schemaLoading } = useQuery({
    queryKey: ["integrations-schema"],
    queryFn: api.settings.integrationsSchema,
  });

  const [local, setLocal] = useState<IntegrationsConfig>({
    defaultPaymentGateway: "razorpay",
    services: {},
  });

  useEffect(() => {
    if (integrations) {
      setLocal({
        defaultPaymentGateway: integrations.defaultPaymentGateway || "razorpay",
        services: { ...integrations.services },
      });
    }
  }, [integrations]);

  const saveMutation = useMutation({
    mutationFn: (cfg: IntegrationsConfig) => api.settings.update({ integrations: cfg }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      if (data.integrations) {
        setLocal(data.integrations);
        onSaved?.(data.integrations);
      }
      toast({ title: "Integration settings saved" });
    },
    onError: () => toast({ title: "Failed to save integrations", variant: "destructive" }),
  });

  const services = schemaData?.services ?? [];
  const categories = useMemo(
    () => [...new Set(services.map(s => s.category))],
    [services],
  );

  const paymentServices = services.filter(s => s.category === "payments");
  const enabledPaymentIds = paymentServices
    .filter(s => local.services[s.id]?.enabled === true)
    .map(s => s.id);

  const setServiceField = (serviceId: string, key: string, value: string | boolean) => {
    setLocal(prev => ({
      ...prev,
      services: {
        ...prev.services,
        [serviceId]: { ...(prev.services[serviceId] ?? {}), [key]: value },
      },
    }));
  };

  const renderField = (service: IntegrationServiceDef, field: IntegrationServiceDef["fields"][0]) => {
    const val = local.services[service.id]?.[field.key];
    const id = `${service.id}-${field.key}`;

    if (field.type === "switch") {
      return (
        <div key={field.key} className="flex items-center justify-between py-2">
          <Label htmlFor={id} className="font-normal">{field.label}</Label>
          <Switch
            id={id}
            checked={val === true}
            onCheckedChange={v => setServiceField(service.id, field.key, v)}
          />
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
          <Textarea
            id={id}
            rows={6}
            className="font-mono text-xs"
            placeholder={field.placeholder}
            value={String(val ?? "")}
            onChange={e => setServiceField(service.id, field.key, e.target.value)}
          />
        </div>
      );
    }

    if (field.type === "select" && field.options?.length) {
      return (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <Select value={String(val ?? "")} onValueChange={v => setServiceField(service.id, field.key, v)}>
            <SelectTrigger id={id}><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {field.options.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-1.5">
        <Label htmlFor={id}>{field.label}</Label>
        {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
        <Input
          id={id}
          type={field.type === "password" ? "password" : "text"}
          placeholder={field.placeholder ?? (field.secret ? "Leave blank to keep existing" : "")}
          value={String(val ?? "")}
          onChange={e => setServiceField(service.id, field.key, e.target.value)}
        />
      </div>
    );
  };

  const renderServiceCard = (service: IntegrationServiceDef) => {
    const enabled = local.services[service.id]?.enabled === true;
    const isPayment = service.category === "payments";
    const hasKeys = isPayment && enabled && service.fields
      .filter(f => f.secret && f.key !== "enabled" && f.key !== "webhookSecret")
      .some(f => {
        const v = local.services[service.id]?.[f.key];
        return v != null && String(v).length > 0 && String(v) !== "••••••••";
      });
    return (
      <Card key={service.id} className={enabled ? "border-primary/30" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                {service.name}
                {enabled && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Active</Badge>}
                {isPayment && enabled && !hasKeys && (
                  <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Demo mode</Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">{service.description}</CardDescription>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={v => setServiceField(service.id, "enabled", v)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {service.fields
            .filter(f => f.key !== "enabled")
            .map(f => renderField(service, f))}
        </CardContent>
      </Card>
    );
  };

  if (schemaLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-primary" />
            Default Payment Gateway
          </CardTitle>
          <CardDescription>
            Used when multiple payment gateways are enabled. Guest checkout reads this from the public config API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={local.defaultPaymentGateway}
            onValueChange={v => setLocal(prev => ({ ...prev, defaultPaymentGateway: v }))}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Select gateway" />
            </SelectTrigger>
            <SelectContent>
              {paymentServices.map(s => (
                <SelectItem key={s.id} value={s.id} disabled={!enabledPaymentIds.includes(s.id)}>
                  {s.name}{!enabledPaymentIds.includes(s.id) ? " (enable first)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {enabledPaymentIds.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">Enable at least one payment gateway below.</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue={categories[0] ?? "payments"}>
        <TabsList className="flex-wrap h-auto gap-1">
          {categories.map(cat => {
            const meta = CATEGORY_META[cat] ?? { label: cat, icon: Plug };
            const Icon = meta.icon;
            const count = services.filter(s => s.category === cat && local.services[s.id]?.enabled).length;
            return (
              <TabsTrigger key={cat} value={cat} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
                {count > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{count}</Badge>}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {categories.map(cat => (
          <TabsContent key={cat} value={cat} className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {services.filter(s => s.category === cat).map(renderServiceCard)}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex justify-end sticky bottom-4 z-10">
        <Button
          size="lg"
          onClick={() => saveMutation.mutate(local)}
          disabled={saveMutation.isPending}
          className="shadow-lg"
        >
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Integrations
        </Button>
      </div>
    </div>
  );
}
